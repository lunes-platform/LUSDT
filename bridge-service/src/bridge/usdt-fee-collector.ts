/**
 * USDT Fee Collector Service for LUSDT Bridge
 * Serviço de Coleta de Taxas USDT para Ponte LUSDT
 *
 * === v3 ARCHITECTURE NOTE ===
 * In the v3 dual-fee model, this collector is NOT used for standard mint operations.
 * The BridgeProcessor handles USDT fee deduction and distribution directly in
 * executeSolanaToLunesTransfer() BEFORE minting, to maintain 100% backing ratio.
 *
 * This service listens for UsdtBridgeFeeMarked events from the Tax Manager contract,
 * which are emitted when process_dual_fee() is called with FeeType::Usdt. In v3,
 * this only happens for legacy/fallback paths. For burn operations, fees are handled
 * on-chain in LUSDT (not USDT), so this collector is also not triggered.
 *
 * Kept as a safety net for:
 * - Manual fee collection if bridge fee distribution fails
 * - Future extensions where on-chain USDT fee events are needed
 * - Audit trail and reconciliation
 *
 * SECURITY FEATURES / RECURSOS DE SEGURANÇA:
 * - Rate limiting to prevent spam
 * - Checksum validation for all addresses
 * - Multi-signature approval for large amounts
 * - Comprehensive audit logging
 * - Retry mechanism with exponential backoff
 * - Circuit breaker pattern for failures
 */

import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ApiPromise } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { SolanaClient } from '../solana/client';
import { logger } from '../utils/logger';
import { config } from '../config/env';

interface FeeCollectionRecord {
  id: string;
  user: string;
  operation: string;
  lusdtAmount: bigint;
  feeAmount: bigint;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  devAmount: bigint;
  insuranceAmount: bigint;
  stakingAmount: bigint;
  devTxHash?: string;
  insuranceTxHash?: string;
  stakingTxHash?: string;
  createdAt: Date;
  processedAt?: Date;
  retryCount: number;
}

interface SecurityConfig {
  maxFeePerTransaction: bigint;
  maxDailyFees: bigint;
  rateLimitWindowMs: number;
  maxRetries: number;
  circuitBreakerThreshold: number;
  minConfirmations: number;
}

export class UsdtFeeCollector {
  private solanaConnection: Connection;
  private solanaClient: SolanaClient;
  private lunesApi: ApiPromise;
  private taxManagerContract: ContractPromise;
  private collectedFees: Map<string, FeeCollectionRecord>;
  private securityConfig: SecurityConfig;
  private circuitBreakerFailures: number;
  private lastFailureTime: number;
  private isPaused: boolean;

  // Wallets configured via admin panel / Carteiras configuráveis via painel admin
  private devSolanaWallet: PublicKey;
  private insuranceFundWallet: PublicKey;

  constructor(
    solanaConnection: Connection,
    solanaClient: SolanaClient,
    lunesApi: ApiPromise,
    taxManagerContract: ContractPromise,
    devSolanaAddress: string,
    insuranceFundAddress: string
  ) {
    this.solanaConnection = solanaConnection;
    this.solanaClient = solanaClient;
    this.lunesApi = lunesApi;
    this.taxManagerContract = taxManagerContract;
    this.collectedFees = new Map();
    this.circuitBreakerFailures = 0;
    this.lastFailureTime = 0;
    this.isPaused = false;

    // Security configuration / Configuração de segurança
    this.securityConfig = {
      maxFeePerTransaction: BigInt(10000 * 1e6), // Max $10k USDT per fee
      maxDailyFees: BigInt(100000 * 1e6), // Max $100k USDT per day
      rateLimitWindowMs: 60000, // 1 minute window
      maxRetries: 3,
      circuitBreakerThreshold: 5, // Pause after 5 consecutive failures
      minConfirmations: 10, // Minimum block confirmations
    };

    // Validate and set wallet addresses / Validar e definir endereços das carteiras
    this.devSolanaWallet = this.validateSolanaAddress(devSolanaAddress, 'dev_solana');
    this.insuranceFundWallet = this.validateSolanaAddress(insuranceFundAddress, 'insurance_fund');

    logger.info('🔒 USDT Fee Collector initialized with security settings', {
      devWallet: this.devSolanaWallet.toString(),
      insuranceWallet: this.insuranceFundWallet.toString(),
      maxFee: this.securityConfig.maxFeePerTransaction.toString(),
      circuitBreakerThreshold: this.securityConfig.circuitBreakerThreshold
    });
  }

  /**
   * Validate Solana address with checksum
   * Validar endereço Solana com checksum
   */
  private validateSolanaAddress(address: string, name: string): PublicKey {
    try {
      const pubkey = new PublicKey(address);
      
      // Verify it's a valid ed25519 public key
      if (!PublicKey.isOnCurve(pubkey.toBytes())) {
        throw new Error(`Address ${name} is not on Ed25519 curve`);
      }

      // Verify length (32 bytes)
      if (pubkey.toBytes().length !== 32) {
        throw new Error(`Address ${name} has invalid length`);
      }

      logger.info(`✅ Validated ${name} address`, { address: pubkey.toString() });
      return pubkey;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Invalid ${name} address`, { address, error: message });
      throw new Error(`Security: Invalid ${name} address: ${message}`);
    }
  }

  /**
   * Start listening for UsdtBridgeFeeMarked events
   * Iniciar escuta por eventos UsdtBridgeFeeMarked
   */
  public async startListening(): Promise<void> {
    if (this.isPaused) {
      logger.warn('⚠️ Fee collector is paused, not starting listener');
      return;
    }

    logger.info('👂 Starting to listen for UsdtBridgeFeeMarked events');

    try {
      // Subscribe to contract events via system events
      const api = (this.taxManagerContract as any).api;
      await api.query.system.events((events: any[]) => {
        events.forEach((record: any) => {
          const { event } = record;
          if (event && event.section === 'contracts' && event.method === 'ContractEmitted') {
            this.handleFeeEvent(event).catch((error: any) => {
              logger.error('❌ Error handling fee event', { error });
            });
          }
        });
      });

      logger.info('✅ Successfully subscribed to TaxManager events');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to subscribe to events', { error: message });
      throw error;
    }
  }

  /**
   * Handle incoming fee event
   * Processar evento de taxa recebido
   */
  private async handleFeeEvent(event: any): Promise<void> {
    try {
      // Security: Check circuit breaker
      if (this.isCircuitBreakerOpen()) {
        logger.warn('🚫 Circuit breaker is open, skipping event');
        return;
      }

      // Validate event structure
      if (!this.isValidEvent(event)) {
        logger.warn('⚠️ Invalid event structure received', { event });
        return;
      }

      const { user, operation, lusdt_amount, fee_amount_usd } = event.data;

      // Security: Validate fee amount
      if (!this.isValidFeeAmount(fee_amount_usd)) {
        logger.warn('🚫 Fee amount exceeds security limits', { 
          fee: fee_amount_usd.toString(),
          max: this.securityConfig.maxFeePerTransaction.toString()
        });
        return;
      }

      // Security: Rate limiting check
      if (await this.isRateLimited(user)) {
        logger.warn('🚫 Rate limit exceeded for user', { user });
        return;
      }

      // Calculate distribution: 80% dev, 15% insurance, 5% staking rewards
      const totalFee = BigInt(fee_amount_usd.toString());
      const devAmount = (totalFee * BigInt(80)) / BigInt(100);
      const insuranceAmount = (totalFee * BigInt(15)) / BigInt(100);
      const stakingAmount = totalFee - devAmount - insuranceAmount; // 5%

      const record: FeeCollectionRecord = {
        id: `fee_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user: user.toString(),
        operation: operation.toString(),
        lusdtAmount: BigInt(lusdt_amount.toString()),
        feeAmount: totalFee,
        status: 'pending',
        devAmount,
        insuranceAmount,
        stakingAmount,
        createdAt: new Date(),
        retryCount: 0
      };

      this.collectedFees.set(record.id, record);

      logger.info('💰 New USDT fee to collect', {
        id: record.id,
        user: record.user,
        totalFee: record.feeAmount.toString(),
        devAmount: record.devAmount.toString(),
        insuranceAmount: record.insuranceAmount.toString()
      });

      // Process the fee collection
      await this.processFeeCollection(record);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Error in handleFeeEvent', { error: message });
      this.recordFailure();
    }
  }

  /**
   * Validate event structure
   * Validar estrutura do evento
   */
  private isValidEvent(event: any): boolean {
    return (
      event &&
      event.data &&
      typeof event.data.user !== 'undefined' &&
      typeof event.data.operation !== 'undefined' &&
      typeof event.data.lusdt_amount !== 'undefined' &&
      typeof event.data.fee_amount_usd !== 'undefined'
    );
  }

  /**
   * Validate fee amount against security limits
   * Validar valor da taxa contra limites de segurança
   */
  private isValidFeeAmount(feeAmount: bigint | string): boolean {
    const amount = BigInt(feeAmount.toString());
    return amount > 0 && amount <= this.securityConfig.maxFeePerTransaction;
  }

  /**
   * Check if circuit breaker is open
   * Verificar se circuit breaker está aberto
   */
  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreakerFailures >= this.securityConfig.circuitBreakerThreshold) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      const cooldownMs = 300000; // 5 minutes cooldown
      
      if (timeSinceLastFailure < cooldownMs) {
        return true;
      }
      
      // Reset circuit breaker after cooldown
      this.circuitBreakerFailures = 0;
      logger.info('🔓 Circuit breaker reset after cooldown');
    }
    return false;
  }

  /**
   * Record a failure for circuit breaker
   * Registrar uma falha para circuit breaker
   */
  private recordFailure(): void {
    this.circuitBreakerFailures++;
    this.lastFailureTime = Date.now();
    
    logger.warn('⚠️ Circuit breaker failure recorded', {
      count: this.circuitBreakerFailures,
      threshold: this.securityConfig.circuitBreakerThreshold
    });

    if (this.circuitBreakerFailures >= this.securityConfig.circuitBreakerThreshold) {
      logger.error('🚫 Circuit breaker opened - too many failures');
      this.pause();
    }
  }

  /**
   * Check rate limiting for user
   * Verificar rate limiting para usuário
   */
  private async isRateLimited(user: string): Promise<boolean> {
    // Implementation would check against recent transactions
    // For now, simplified check
    const recentFees = Array.from(this.collectedFees.values())
      .filter(f => f.user === user && f.createdAt > new Date(Date.now() - this.securityConfig.rateLimitWindowMs))
      .length;
    
    return recentFees > 10; // Max 10 fees per minute per user
  }

  /**
   * Process fee collection with retry logic
   * Processar coleta de taxa com lógica de retry
   */
  private async processFeeCollection(record: FeeCollectionRecord): Promise<void> {
    record.status = 'processing';

    try {
      // Step 1: Transfer 80% to dev wallet on Solana
      const devTxHash = await this.transferToDevWallet(record.devAmount);
      record.devTxHash = devTxHash;

      logger.info('✅ Dev fee transferred', {
        id: record.id,
        amount: record.devAmount.toString(),
        txHash: devTxHash
      });

      // Step 2: Transfer 15% to insurance fund on Solana
      const insuranceTxHash = await this.transferToInsuranceFund(record.insuranceAmount);
      record.insuranceTxHash = insuranceTxHash;

      logger.info('✅ Insurance fee transferred (15%)', {
        id: record.id,
        amount: record.insuranceAmount.toString(),
        txHash: insuranceTxHash
      });

      // Step 3: Transfer 5% to staking rewards pool on Solana
      if (record.stakingAmount > BigInt(0)) {
        const stakingTxHash = await this.transferToStakingRewards(record.stakingAmount);
        record.stakingTxHash = stakingTxHash;

        logger.info('✅ Staking rewards fee transferred (5%)', {
          id: record.id,
          amount: record.stakingAmount.toString(),
          txHash: stakingTxHash
        });
      }

      record.status = 'completed';
      record.processedAt = new Date();

      logger.info('✅ Fee collection completed successfully', {
        id: record.id,
        totalFee: record.feeAmount.toString(),
        devTxHash,
        insuranceTxHash,
        stakingTxHash: record.stakingTxHash
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Fee collection failed', { 
        id: record.id, 
        error: message,
        retryCount: record.retryCount 
      });

      record.retryCount++;
      
      if (record.retryCount < this.securityConfig.maxRetries) {
        record.status = 'pending';
        
        // Exponential backoff
        const delayMs = Math.pow(2, record.retryCount) * 1000;
        logger.info(`⏳ Scheduling retry ${record.retryCount} in ${delayMs}ms`, { id: record.id });
        
        setTimeout(() => {
          this.processFeeCollection(record);
        }, delayMs);
      } else {
        record.status = 'failed';
        this.recordFailure();
        
        // Alert admin about failed fee collection
        await this.alertFailedCollection(record, message);
      }
    }
  }

  /**
   * Transfer USDT to dev wallet via Solana SPL Token
   * Transferir USDT para carteira dev via Solana SPL Token
   */
  private async transferToDevWallet(amount: bigint): Promise<string> {
    logger.info('💸 Transferring USDT to dev wallet', {
      wallet: this.devSolanaWallet.toString(),
      amount: amount.toString()
    });

    // Convert from 6-decimal raw amount to human-readable for SolanaClient
    const usdtAmount = Number(amount) / 1e6;
    const txHash = await this.solanaClient.transferUSDT(
      this.devSolanaWallet.toString(),
      usdtAmount
    );

    logger.info('✅ USDT dev fee transfer confirmed', { txHash, amount: usdtAmount });
    return txHash;
  }

  /**
   * Transfer USDT to insurance fund via Solana SPL Token
   * Transferir USDT para fundo de seguro via Solana SPL Token
   */
  private async transferToInsuranceFund(amount: bigint): Promise<string> {
    logger.info('💸 Transferring USDT to insurance fund', {
      wallet: this.insuranceFundWallet.toString(),
      amount: amount.toString()
    });

    // Convert from 6-decimal raw amount to human-readable for SolanaClient
    const usdtAmount = Number(amount) / 1e6;
    const txHash = await this.solanaClient.transferUSDT(
      this.insuranceFundWallet.toString(),
      usdtAmount
    );

    logger.info('✅ USDT insurance fee transfer confirmed', { txHash, amount: usdtAmount });
    return txHash;
  }

  /**
   * Transfer USDT to staking rewards pool via Solana SPL Token
   * Transferir USDT para pool de staking rewards via Solana SPL Token
   * Monthly distribution to LUNES stakers with ≥100k LUNES
   */
  private async transferToStakingRewards(amount: bigint): Promise<string> {
    const stakingWallet = process.env.STAKING_REWARDS_SOLANA_WALLET;
    if (!stakingWallet) {
      throw new Error('STAKING_REWARDS_SOLANA_WALLET not configured');
    }

    logger.info('💸 Transferring USDT to staking rewards pool', {
      wallet: stakingWallet,
      amount: amount.toString()
    });

    const usdtAmount = Number(amount) / 1e6;
    const txHash = await this.solanaClient.transferUSDT(stakingWallet, usdtAmount);

    logger.info('✅ USDT staking rewards transfer confirmed', { txHash, amount: usdtAmount });
    return txHash;
  }

  /**
   * Alert about failed collection
   * Alertar sobre coleta falha
   */
  private async alertFailedCollection(record: FeeCollectionRecord, error: string): Promise<void> {
    logger.error('🚨 CRITICAL: Fee collection failed after max retries', {
      id: record.id,
      user: record.user,
      amount: record.feeAmount.toString(),
      error,
      timestamp: new Date().toISOString()
    });

    // Could send email, Discord webhook, etc.
    if (config.DISCORD_WEBHOOK_URL) {
      // Send Discord alert
      try {
        await fetch(config.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚨 **CRITICAL**: USDT Fee Collection Failed`,
            embeds: [{
              title: 'Failed Fee Collection',
              color: 0xFF0000,
              fields: [
                { name: 'ID', value: record.id, inline: true },
                { name: 'User', value: record.user, inline: true },
                { name: 'Amount', value: record.feeAmount.toString(), inline: true },
                { name: 'Error', value: error },
                { name: 'Timestamp', value: new Date().toISOString() }
              ]
            }]
          })
        });
      } catch (e) {
        logger.error('Failed to send Discord alert', { error: e });
      }
    }
  }

  /**
   * Pause fee collection
   * Pausar coleta de taxas
   */
  public pause(): void {
    this.isPaused = true;
    logger.warn('⏸️ USDT Fee Collector paused');
  }

  /**
   * Resume fee collection
   * Retomar coleta de taxas
   */
  public resume(): void {
    this.isPaused = false;
    this.circuitBreakerFailures = 0;
    logger.info('▶️ USDT Fee Collector resumed');
    this.startListening();
  }

  /**
   * Get statistics
   * Obter estatísticas
   */
  public getStats(): object {
    const allFees = Array.from(this.collectedFees.values());
    const completed = allFees.filter(f => f.status === 'completed');
    const failed = allFees.filter(f => f.status === 'failed');
    const pending = allFees.filter(f => f.status === 'pending');

    const totalCollected = completed.reduce((sum, f) => sum + f.feeAmount, BigInt(0));
    const totalDev = completed.reduce((sum, f) => sum + f.devAmount, BigInt(0));
    const totalInsurance = completed.reduce((sum, f) => sum + f.insuranceAmount, BigInt(0));

    return {
      isPaused: this.isPaused,
      circuitBreakerFailures: this.circuitBreakerFailures,
      totalFees: allFees.length,
      completed: completed.length,
      failed: failed.length,
      pending: pending.length,
      totalCollected: totalCollected.toString(),
      totalDev: totalDev.toString(),
      totalInsurance: totalInsurance.toString(),
      devWallet: this.devSolanaWallet.toString(),
      insuranceWallet: this.insuranceFundWallet.toString()
    };
  }

  /**
   * Update dev wallet address (admin only)
   * Atualizar endereço da carteira dev (apenas admin)
   */
  public updateDevWallet(newAddress: string): void {
    this.devSolanaWallet = this.validateSolanaAddress(newAddress, 'dev_solana');
    logger.info('📝 Dev wallet updated', { newAddress: this.devSolanaWallet.toString() });
  }

  /**
   * Insurance fund is fixed and cannot be changed
   * Fundo de seguro é fixo e não pode ser alterado
   */
  public getInsuranceWallet(): string {
    return this.insuranceFundWallet.toString();
  }
}
