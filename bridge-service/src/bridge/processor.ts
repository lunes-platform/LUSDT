import { SolanaClient, SolanaTransfer } from '../solana/client';
import { LunesClient, LunesTransfer } from '../lunes/client';
import { Database, TransactionRecord } from './database';
import { BridgeMonitoring } from '../monitoring/metrics';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { PublicKey } from '@solana/web3.js';
import { decodeAddress, encodeAddress } from '@polkadot/keyring';
import { VaultExecutor } from '../multisig/vault-executor';

export class BridgeProcessor {
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private processingSemaphore: Set<string> = new Set();

  private vaultExecutor?: VaultExecutor;

  constructor(
    private solanaClient: SolanaClient,
    private lunesClient: LunesClient,
    private database: Database,
    private monitoring: BridgeMonitoring,
    vaultExecutor?: VaultExecutor,
  ) {
    this.vaultExecutor = vaultExecutor;
    if (vaultExecutor) {
      logger.info('🏦 BridgeProcessor using VaultExecutor (multisig mode)');
    } else {
      logger.warn('⚠️  BridgeProcessor using direct SolanaClient (single-signer mode)');
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bridge processor already running');
      return;
    }

    logger.info('🌉 Starting bridge processor...');
    this.isRunning = true;

    // Inicia monitoramento
    await this.monitoring.start();

    // Configura listeners para transações
    await this.setupTransactionListeners();

    // Processa transações pendentes periodicamente
    this.processingInterval = setInterval(async () => {
      await this.processPendingTransactions();
    }, 10000); // A cada 10 segundos

    // Processamento inicial de transações pendentes
    await this.processPendingTransactions();

    logger.info('✅ Bridge processor started successfully');
  }

  async stop(): Promise<void> {
    logger.info('🛑 Stopping bridge processor...');
    this.isRunning = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    await this.monitoring.stop();

    logger.info('✅ Bridge processor stopped');
  }

  private async setupTransactionListeners(): Promise<void> {
    try {
      // Listener para eventos de burn no Lunes (LUSDT -> USDT)
      await this.lunesClient.watchForBurnEvents(async (event: LunesTransfer) => {
        await this.handleLunesToSolanaTransfer(event);
      });

      // Listener para transferências incoming na Solana (USDT -> LUSDT)
      await this.solanaClient.watchForIncomingTransfers(async (transfer: SolanaTransfer) => {
        await this.handleSolanaToLunesTransfer(transfer);
      });

      logger.info('👂 Transaction listeners configured');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to setup transaction listeners', {
        error: message,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async handleSolanaToLunesTransfer(transfer: SolanaTransfer): Promise<void> {
    try {
      logger.info('🔄 Processing Solana -> Lunes transfer', transfer);

      // Validações de segurança
      if (!this.validateTransferAmount(transfer.amount)) {
        logger.error('❌ Transfer amount validation failed', transfer);
        return;
      }

      if (!this.validateSolanaAddress(transfer.recipient)) {
        logger.error('❌ Recipient address validation failed', transfer);
        return;
      }

      // Cria registro da transação
      const transactionId = await this.database.saveTransaction({
        sourceChain: 'solana',
        destinationChain: 'lunes',
        sourceSignature: transfer.signature || '',
        amount: transfer.amount,
        sourceAddress: transfer.recipient, // Endereço que recebeu na Solana
        destinationAddress: transfer.recipient, // Será mapeado para endereço Lunes
        status: 'pending',
        metadata: {
          solanaSignature: transfer.signature,
          timestamp: transfer.timestamp
        }
      });

      logger.info('💾 Solana->Lunes transaction saved', { transactionId });
    } catch (error) {
      logger.error('❌ Failed to handle Solana->Lunes transfer', { error, transfer });
    }
  }

  private async handleLunesToSolanaTransfer(event: LunesTransfer): Promise<void> {
    try {
      logger.info('🔄 Processing Lunes -> Solana transfer', event);

      // Validações de segurança
      if (!this.validateTransferAmount(event.amount)) {
        logger.error('❌ Transfer amount validation failed', event);
        return;
      }

      if (!this.validateLunesAddress(event.from)) {
        logger.error('❌ Source address validation failed', event);
        return;
      }

      // Cria registro da transação
      const transactionId = await this.database.saveTransaction({
        sourceChain: 'lunes',
        destinationChain: 'solana',
        sourceSignature: event.txHash || '',
        amount: event.amount,
        sourceAddress: event.from,
        destinationAddress: event.to, // Endereço Solana de destino
        status: 'pending',
        metadata: {
          lunesBlockHash: event.blockHash,
          lunesTxHash: event.txHash,
          timestamp: event.timestamp
        }
      });

      logger.info('💾 Lunes->Solana transaction saved', { transactionId });
    } catch (error) {
      logger.error('❌ Failed to handle Lunes->Solana transfer', { error, event });
    }
  }

  private async processPendingTransactions(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const pendingTransactions = await this.database.getPendingTransactions();
      
      if (pendingTransactions.length === 0) {
        return;
      }

      logger.info(`🔄 Processing ${pendingTransactions.length} pending transactions`);

      for (const transaction of pendingTransactions) {
        // Evita processamento duplicado
        if (this.processingSemaphore.has(transaction.id)) {
          continue;
        }

        this.processingSemaphore.add(transaction.id);

        try {
          await this.processTransaction(transaction);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`❌ Failed to process transaction ${transaction.id}`, {
            error: message,
            stack: error instanceof Error ? error.stack : undefined
          });
        } finally {
          this.processingSemaphore.delete(transaction.id);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Error processing pending transactions', {
        error: message,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  private async processTransaction(transaction: TransactionRecord): Promise<void> {
    try {
      // Verifica se já excedeu o número máximo de tentativas
      if (transaction.retryCount >= config.MAX_RETRIES) {
        await this.database.updateTransaction(transaction.id, {
          status: 'failed',
          errorMessage: 'Max retries exceeded'
        });
        logger.error(`❌ Transaction ${transaction.id} failed after ${config.MAX_RETRIES} retries`);
        return;
      }

      // Marca como processando
      await this.database.updateTransaction(transaction.id, {
        status: 'processing'
      });

      let result: string;

      if (transaction.sourceChain === 'solana' && transaction.destinationChain === 'lunes') {
        result = await this.executeSolanaToLunesTransfer(transaction);
      } else if (transaction.sourceChain === 'lunes' && transaction.destinationChain === 'solana') {
        result = await this.executeLunesToSolanaTransfer(transaction);
      } else {
        throw new Error(`Invalid transfer direction: ${transaction.sourceChain} -> ${transaction.destinationChain}`);
      }

      // Marca como completada
      await this.database.updateTransaction(transaction.id, {
        status: 'completed',
        destinationSignature: result
      });

      logger.info(`✅ Transaction ${transaction.id} completed successfully`, {
        sourceChain: transaction.sourceChain,
        destinationChain: transaction.destinationChain,
        amount: transaction.amount,
        destinationSignature: result
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Incrementa contador de tentativas e agenda retry
      await this.database.incrementRetryCount(transaction.id);
      await this.database.updateTransaction(transaction.id, {
        status: 'pending',
        errorMessage: message
      });

      logger.error(`❌ Transaction ${transaction.id} failed, will retry`, {
        retryCount: transaction.retryCount + 1,
        error: message
      });
    }
  }

  private async executeSolanaToLunesTransfer(transaction: TransactionRecord): Promise<string> {
    try {
      // Verifica se a transação Solana está confirmada
      const isConfirmed = await this.solanaClient.isTransactionConfirmed(transaction.sourceSignature);
      if (!isConfirmed) {
        throw new Error('Source transaction not yet confirmed');
      }

      // === CRITICAL: Deduct USDT fee BEFORE minting to maintain 100% backing ===
      // Fee is deducted from the deposited USDT, so we mint less LUSDT.
      // This ensures: USDT in vault == LUSDT total supply (always 100% backed)
      // Query Tax Manager for adaptive fee rate (falls back to 60 bps if unavailable)
      const stablecoinFeeBps = await this.lunesClient.queryTaxManagerFeeBps();
      const feeAmount = (transaction.amount * stablecoinFeeBps) / 10000;
      const mintAmount = transaction.amount - feeAmount;

      logger.info('🪙 Executing Solana->Lunes: Minting LUSDT (fee-adjusted)', {
        recipient: transaction.destinationAddress,
        depositedUsdt: transaction.amount,
        usdtFee: feeAmount,
        mintAmount,
      });

      // Step 1: Distribute USDT fee (80% dev / 15% insurance / 5% staking rewards)
      if (feeAmount > 0) {
        const devAmount = feeAmount * 0.80;
        const insuranceAmount = feeAmount * 0.15;
        const stakingAmount = feeAmount - devAmount - insuranceAmount; // 5%

        try {
          if (config.DEV_SOLANA_WALLET) {
            await this.solanaClient.transferUSDT(config.DEV_SOLANA_WALLET, devAmount);
            logger.info('💰 USDT dev fee distributed (80%)', { amount: devAmount });
          }
          if (config.INSURANCE_SOLANA_WALLET) {
            await this.solanaClient.transferUSDT(config.INSURANCE_SOLANA_WALLET, insuranceAmount);
            logger.info('💰 USDT insurance fee distributed (15%)', { amount: insuranceAmount });
          }
          if (config.STAKING_REWARDS_SOLANA_WALLET && stakingAmount > 0) {
            await this.solanaClient.transferUSDT(config.STAKING_REWARDS_SOLANA_WALLET, stakingAmount);
            logger.info('💰 USDT staking rewards distributed (5%)', { amount: stakingAmount });
          }
        } catch (feeError) {
          // Fee distribution failure should NOT block the mint
          // Log and continue — fee can be collected manually later
          const msg = feeError instanceof Error ? feeError.message : String(feeError);
          logger.error('⚠️ USDT fee distribution failed (mint will proceed)', { error: msg });
        }
      }

      // Step 2: Mint only the net amount (deposit - fee) to maintain 1:1 backing
      const lunesSignature = await this.lunesClient.mintLUSDT(
        transaction.destinationAddress,
        mintAmount
      );

      logger.info('✅ Mint completed with 100% backing maintained', {
        vaultUsdt: mintAmount,
        mintedLusdt: mintAmount,
        feeCollected: feeAmount,
      });

      return lunesSignature;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Solana->Lunes transfer execution failed', {
        error: message,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async executeLunesToSolanaTransfer(transaction: TransactionRecord): Promise<string> {
    try {
      logger.info('💸 Executing Lunes->Solana: Transferring USDT', {
        recipient: transaction.destinationAddress,
        amount: transaction.amount
      });

      // Verifica se a transação Lunes está finalizada
      const isFinalized = await this.lunesClient.isTransactionFinalized(transaction.sourceSignature);
      if (!isFinalized) {
        throw new Error('Source transaction not yet finalized');
      }

      // Transfere USDT na Solana — via multisig se VaultExecutor disponível
      let solanaSignature: string;

      if (this.vaultExecutor) {
        logger.info('🏦 Routing through VaultExecutor (multisig approval)', {
          transactionId: transaction.id,
        });
        solanaSignature = await this.vaultExecutor.requestTransfer(
          transaction.id,
          transaction.destinationAddress,
          transaction.amount,
          {
            sourceChain: 'lunes',
            sourceSignature: transaction.sourceSignature,
            bridgeTransactionId: transaction.id,
          },
        );
      } else {
        solanaSignature = await this.solanaClient.transferUSDT(
          transaction.destinationAddress,
          transaction.amount
        );
      }

      return solanaSignature;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Lunes->Solana transfer execution failed', {
        error: message,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private validateTransferAmount(amount: number): boolean {
    if (amount <= 0) {
      return false;
    }

    if (amount > config.MAX_TRANSACTION_VALUE) {
      return false;
    }

    return true;
  }

  private validateSolanaAddress(address: string): boolean {
    try {
      if (!address) return false;
      const pubkey = new PublicKey(address);
      return PublicKey.isOnCurve(pubkey.toBytes());
    } catch {
      return false;
    }
  }

  private validateLunesAddress(address: string): boolean {
    try {
      if (!address) return false;
      const decoded = decodeAddress(address);
      const reencoded = encodeAddress(decoded);
      return reencoded.length > 0;
    } catch {
      return false;
    }
  }

  // Métodos para estatísticas e monitoring
  async getProcessingStats(): Promise<any> {
    const pendingTransactions = await this.database.getPendingTransactions();
    const stats = await this.database.getStatistics();
    
    return {
      isRunning: this.isRunning,
      pendingCount: pendingTransactions.length,
      processingCount: this.processingSemaphore.size,
      totalProcessed: stats.completedTransactions,
      successRate: stats.totalTransactions > 0 
        ? (stats.completedTransactions / stats.totalTransactions) * 100 
        : 100
    };
  }
}