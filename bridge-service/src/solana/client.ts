import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { logger } from '../utils/logger';
import { config } from '../config/env';

export interface SolanaTransfer {
  amount: number;
  recipient: string;
  signature?: string;
  timestamp: Date;
}

export class SolanaClient {
  private connections: Connection[];
  private currentConnectionIndex = 0;
  private keypair: Keypair;
  private usdtMint: PublicKey;
  private multisigVault?: PublicKey;
  private dailySpent: number = 0;
  private dailyResetTime: number = Date.now();

  constructor(rpcUrls: string | string[], privateKey: string) {
    const urls = Array.isArray(rpcUrls) ? rpcUrls : rpcUrls.split(',').map(u => u.trim());
    this.connections = urls.map(url => new Connection(url, 'finalized'));

    // Suporta ambos os formatos: JSON array [1,2,3,...] e Base58 string
    const trimmedKey = privateKey.trim();
    if (trimmedKey.startsWith('[')) {
      this.keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(trimmedKey)));
    } else {
      this.keypair = Keypair.fromSecretKey(bs58.decode(trimmedKey));
    }

    this.usdtMint = new PublicKey(config.USDT_TOKEN_MINT);
  }

  private get connection(): Connection {
    return this.connections[this.currentConnectionIndex];
  }

  private async withConnection<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
    let lastError: any;
    for (let attempts = 0; attempts < this.connections.length; attempts++) {
      try {
        return await fn(this.connection);
      } catch (error) {
        lastError = error;
        logger.warn('⚠️ Solana RPC error, rotating endpoint...', {
          endpoint: this.connection.rpcEndpoint,
          error: lastError instanceof Error ? lastError.message : String(lastError)
        });
        if (this.connections.length > 1) {
          this.currentConnectionIndex = (this.currentConnectionIndex + 1) % this.connections.length;
        } else {
          break;
        }
      }
    }
    throw lastError;
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🔗 Initializing Solana client...');

      // Verifica conexão
      const version = await this.withConnection(c => c.getVersion());
      logger.info('✅ Connected to Solana', { version, endpoint: this.connection.rpcEndpoint });

      // Verifica saldo
      const balance = await this.withConnection(c => c.getBalance(this.keypair.publicKey));
      logger.info('💰 Solana wallet balance', {
        wallet: this.keypair.publicKey.toString(),
        balance: balance / 1e9
      });

      // Configurar endereço do multisig vault (deve ser fornecido via configuração)
      if (process.env.SOLANA_MULTISIG_VAULT) {
        this.multisigVault = new PublicKey(process.env.SOLANA_MULTISIG_VAULT);
        logger.info('🏦 Multisig vault configured', { vault: this.multisigVault.toString() });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to initialize Solana client', { error: message });
      throw error;
    }
  }

  async getUSDTBalance(address?: string): Promise<number> {
    try {
      const wallet = address ? new PublicKey(address) : this.keypair.publicKey;
      const associatedAddress = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        this.usdtMint,
        wallet
      );

      const balance = await this.withConnection(c => c.getTokenAccountBalance(associatedAddress));
      return balance.value.uiAmount || 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug('Could not get USDT balance', { error: message });
      return 0;
    }
  }

  async getSolBalance(address?: string): Promise<number> {
    try {
      const wallet = address ? new PublicKey(address) : this.keypair.publicKey;
      const lamports = await this.withConnection(c => c.getBalance(wallet));
      return lamports / 1e9;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug('Could not get SOL balance', { error: message });
      return 0;
    }
  }

  private resetDailyLimitIfNeeded(): void {
    const now = Date.now();
    if (now - this.dailyResetTime >= 86_400_000) {
      this.dailySpent = 0;
      this.dailyResetTime = now;
      logger.info('🔄 Daily spending limit reset');
    }
  }

  async transferUSDT(recipient: string, amount: number): Promise<string> {
    try {
      logger.info('💸 Initiating USDT transfer', { recipient, amount });

      // === SPENDING LIMITS (FIX 5) ===
      if (amount > config.HOT_WALLET_SINGLE_TX_LIMIT) {
        throw new Error(
          `Transfer amount $${amount} exceeds single-tx limit $${config.HOT_WALLET_SINGLE_TX_LIMIT}. Use multisig for large transfers.`
        );
      }

      this.resetDailyLimitIfNeeded();
      if (this.dailySpent + amount > config.HOT_WALLET_DAILY_LIMIT) {
        throw new Error(
          `Transfer would exceed daily limit ($${this.dailySpent + amount} > $${config.HOT_WALLET_DAILY_LIMIT}). Retry tomorrow or use multisig.`
        );
      }

      // === MULTISIG VAULT ENFORCEMENT (FIX 4) ===
      if (config.REQUIRE_MULTISIG_VAULT) {
        if (!this.multisigVault) {
          throw new Error('REQUIRE_MULTISIG_VAULT is true but SOLANA_MULTISIG_VAULT address not configured');
        }
        const vaultBalance = await this.getUSDTBalance(this.multisigVault.toString());
        if (vaultBalance < amount) {
          throw new Error(
            `Multisig vault balance ($${vaultBalance}) insufficient for transfer ($${amount}). Replenish vault first.`
          );
        }
        logger.info('🏦 Multisig vault balance verified', { vaultBalance, transferAmount: amount });
      }

      // === TREASURY MINIMUM BALANCE CHECK ===
      const currentBalance = await this.getUSDTBalance();
      if (currentBalance - amount < config.TREASURY_MIN_BALANCE) {
        throw new Error(
          `Transfer would drop treasury below minimum ($${currentBalance} - $${amount} < $${config.TREASURY_MIN_BALANCE})`
        );
      }

      const recipientPubkey = new PublicKey(recipient);
      const sourceTokenAccount = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        this.usdtMint,
        this.keypair.publicKey
      );
      const destinationTokenAccount = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        this.usdtMint,
        recipientPubkey
      );

      const instruction = Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        sourceTokenAccount,
        destinationTokenAccount,
        this.keypair.publicKey,
        [],
        Math.round(amount * 1e6)
      );

      const transaction = new Transaction().add(instruction);

      const signature = await this.withConnection(c => sendAndConfirmTransaction(
        c,
        transaction,
        [this.keypair],
        { commitment: 'finalized' }
      ));

      this.dailySpent += amount;
      logger.info('✅ USDT transfer completed', { signature, recipient, amount, dailySpent: this.dailySpent });
      return signature;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ USDT transfer failed', { error: message, recipient, amount });
      throw error;
    }
  }

  async watchForIncomingTransfers(callback: (transfer: SolanaTransfer) => void): Promise<void> {
    logger.info('👀 Starting to watch for incoming USDT transfers...');

    const ourTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      this.usdtMint,
      this.keypair.publicKey
    );

    let lastSignature: string | undefined;

    // Polling approach: check for new token transactions every 5 seconds
    const poll = async () => {
      try {
        const signatures = await this.withConnection(c => c.getSignaturesForAddress(
          ourTokenAccount,
          { limit: 10, before: undefined, until: lastSignature },
          'finalized'
        ));

        if (signatures.length === 0) return;

        // Update cursor to skip already-processed txs
        lastSignature = signatures[0].signature;

        for (const sig of signatures.reverse()) {
          try {
            const tx = await this.withConnection(c => c.getParsedTransaction(sig.signature, {
              commitment: 'finalized',
              maxSupportedTransactionVersion: 0
            }));

            if (!tx?.meta || tx.meta.err) continue;

            // Parse token balance changes
            const preBalances = tx.meta.preTokenBalances || [];
            const postBalances = tx.meta.postTokenBalances || [];

            // Find our account's token balance change
            const ourPost = postBalances.find(
              b => b.mint === this.usdtMint.toString() &&
                b.owner === this.keypair.publicKey.toString()
            );
            const ourPre = preBalances.find(
              b => b.mint === this.usdtMint.toString() &&
                b.owner === this.keypair.publicKey.toString()
            );

            if (ourPost) {
              const postAmount = parseFloat(ourPost.uiTokenAmount.uiAmountString || '0');
              const preAmount = ourPre ? parseFloat(ourPre.uiTokenAmount.uiAmountString || '0') : 0;
              const diff = postAmount - preAmount;

              if (diff > 0) {
                // Incoming USDT transfer detected!
                // Find the sender (account that decreased balance)
                const sender = preBalances.find(
                  b => b.mint === this.usdtMint.toString() &&
                    b.owner !== this.keypair.publicKey.toString()
                );

                logger.info('💰 Incoming USDT transfer detected', {
                  amount: diff,
                  signature: sig.signature,
                  sender: sender?.owner || 'unknown'
                });

                callback({
                  amount: diff,
                  recipient: this.keypair.publicKey.toString(),
                  signature: sig.signature,
                  timestamp: new Date((sig.blockTime || 0) * 1000)
                });
              }
            }
          } catch (txErr) {
            const message = txErr instanceof Error ? txErr.message : String(txErr);
            logger.error('Error parsing transaction', { signature: sig.signature, error: message });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Error polling for transfers', { error: message });
      }
    };

    // Initialize lastSignature with current latest
    const initial = await this.withConnection(c => c.getSignaturesForAddress(ourTokenAccount, { limit: 1 }, 'finalized'));
    if (initial.length > 0) {
      lastSignature = initial[0].signature;
      logger.info('📍 USDT watcher initialized', { lastSignature });
    }

    // Poll every 5 seconds
    setInterval(poll, 5000);
  }

  async getTransactionDetails(signature: string): Promise<any> {
    try {
      const transaction = await this.withConnection(c => c.getTransaction(signature, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0
      }));
      return transaction;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error getting transaction details', { signature, error: message });
      throw error;
    }
  }

  async getRecentTransactions(limit: number = 100): Promise<any[]> {
    try {
      const signatures = await this.withConnection(c => c.getSignaturesForAddress(
        this.keypair.publicKey,
        { limit }
      ));

      const transactions = [];
      for (const sig of signatures) {
        try {
          const tx = await this.getTransactionDetails(sig.signature);
          if (tx) transactions.push(tx);
        } catch (error) {
          logger.debug('Could not get transaction', { signature: sig.signature });
        }
      }

      return transactions;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error getting recent transactions', { error: message });
      throw error;
    }
  }

  async isTransactionConfirmed(signature: string): Promise<boolean> {
    try {
      const status = await this.withConnection(c => c.getSignatureStatus(signature));
      return status.value?.confirmationStatus === 'finalized';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error checking transaction confirmation', { signature, error: message });
      return false;
    }
  }

  getPublicKey(): string {
    return this.keypair.publicKey.toString();
  }

  async getNetworkInfo(): Promise<any> {
    try {
      const [epochInfo, blockHeight, version] = await this.withConnection(c => Promise.all([
        c.getEpochInfo(),
        c.getBlockHeight(),
        c.getVersion()
      ]));

      return {
        epochInfo,
        blockHeight,
        version,
        endpoint: this.connection.rpcEndpoint
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error getting network info', { error: message });
      throw error;
    }
  }
}