import { SolanaClient } from '../solana/client';
import { LunesClient } from '../lunes/client';
import { Database } from '../bridge/database';
import { logger } from '../utils/logger';
import { config } from '../config/env';

export interface HealthStatus {
  solana: {
    connected: boolean;
    balance: number;
    usdtBalance: number;
    networkInfo?: any;
    lastChecked: Date;
  };
  lunes: {
    connected: boolean;
    balance: number;
    lusdtBalance: number;
    networkInfo?: any;
    lastChecked: Date;
  };
  database: {
    connected: boolean;
    totalRecords: number;
    lastChecked: Date;
  };
  bridge: {
    pendingTransactions: number;
    failedTransactions: number;
    processingErrors: number;
    lastProcessed: Date;
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export interface BridgeMetrics {
  transactions: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    hourlyRate: number;
    dailyVolume: number;
  };
  balances: {
    solanaUSDT: number;
    lunesLUSDT: number;
    solanaSOL: number;
    lunesLUNES: number;
  };
  performance: {
    averageProcessingTime: number;
    successRate: number;
    errorRate: number;
    uptime: number;
  };
  parity: {
    deviation: number;
    threshold: number;
    status: 'ok' | 'warning' | 'critical';
  };
}

export class BridgeMonitoring {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private parityCheckInterval: NodeJS.Timeout | null = null;
  private startTime: Date;
  private metrics: Partial<BridgeMetrics> = {};
  private lastHealthCheck: HealthStatus | null = null;

  constructor(
    private solanaClient: SolanaClient,
    private lunesClient: LunesClient,
    private database: Database
  ) {
    this.startTime = new Date();
  }

  async start(): Promise<void> {
    logger.info('📊 Starting bridge monitoring...');

    // Health checks periódicos
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Health check failed', { error: message });
      }
    }, config.HEALTH_CHECK_INTERVAL);

    // Verificação de paridade periódica
    this.parityCheckInterval = setInterval(async () => {
      try {
        await this.checkParity();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Parity check failed', { error: message });
      }
    }, config.PARITY_CHECK_INTERVAL);

    // Health check inicial
    await this.performHealthCheck();
    await this.checkParity();

    logger.info('✅ Bridge monitoring started');
  }

  async stop(): Promise<void> {
    logger.info('🛑 Stopping bridge monitoring...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.parityCheckInterval) {
      clearInterval(this.parityCheckInterval);
      this.parityCheckInterval = null;
    }

    logger.info('✅ Bridge monitoring stopped');
  }

  async getHealthStatus(): Promise<HealthStatus> {
    if (!this.lastHealthCheck) {
      await this.performHealthCheck();
    }
    return this.lastHealthCheck!;
  }

  async getMetrics(): Promise<BridgeMetrics> {
    await this.updateMetrics();
    return this.metrics as BridgeMetrics;
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const now = new Date();
      
      // Verifica Solana
      const solanaHealth = await this.checkSolanaHealth();
      
      // Verifica Lunes
      const lunesHealth = await this.checkLunesHealth();
      
      // Verifica Database
      const databaseHealth = await this.checkDatabaseHealth();
      
      // Verifica Bridge
      const bridgeHealth = await this.checkBridgeHealth();

      // Determina status geral
      const overall = this.determineOverallHealth(solanaHealth, lunesHealth, databaseHealth, bridgeHealth);

      this.lastHealthCheck = {
        solana: { ...solanaHealth, lastChecked: now },
        lunes: { ...lunesHealth, lastChecked: now },
        database: { ...databaseHealth, lastChecked: now },
        bridge: bridgeHealth,
        overall
      };

      // Log status críticos
      if (overall === 'unhealthy') {
        logger.error('🚨 Bridge health is UNHEALTHY', this.lastHealthCheck);
        await this.sendAlert('Bridge health is UNHEALTHY', this.lastHealthCheck);
      } else if (overall === 'degraded') {
        logger.warn('⚠️  Bridge health is DEGRADED', this.lastHealthCheck);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Health check failed', { error: message });
      throw error;
    }
  }

  private determineOverallHealth(
    solana: Omit<HealthStatus['solana'], 'lastChecked'>,
    lunes: Omit<HealthStatus['lunes'], 'lastChecked'>,
    database: Omit<HealthStatus['database'], 'lastChecked'>,
    bridge: HealthStatus['bridge']
  ): HealthStatus['overall'] {
    if (!solana.connected || !lunes.connected || !database.connected) {
      return 'unhealthy';
    }

    if (bridge.failedTransactions > 0 || bridge.processingErrors > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  private async checkSolanaHealth(): Promise<Omit<HealthStatus['solana'], 'lastChecked'>> {
    try {
      const [balance, usdtBalance, networkInfo] = await Promise.all([
        this.solanaClient.getSolBalance(),
        this.solanaClient.getUSDTBalance(),
        this.solanaClient.getNetworkInfo()
      ]);

      return {
        connected: true,
        balance,
        usdtBalance,
        networkInfo
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Solana health check failed', { error: message });
      return {
        connected: false,
        balance: 0,
        usdtBalance: 0
      };
    }
  }

  private async checkLunesHealth(): Promise<Omit<HealthStatus['lunes'], 'lastChecked'>> {
    try {
      const [balance, lusdtBalance, networkInfo] = await Promise.all([
        this.lunesClient.getBalance(),
        this.lunesClient.getLUSDTBalance(),
        this.lunesClient.getNetworkInfo()
      ]);

      return {
        connected: true,
        balance,
        lusdtBalance,
        networkInfo
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Lunes health check failed', { error: message });
      return {
        connected: false,
        balance: 0,
        lusdtBalance: 0
      };
    }
  }

  private async checkDatabaseHealth(): Promise<Omit<HealthStatus['database'], 'lastChecked'>> {
    try {
      const status = await this.database.getHealthStatus();
      return {
        connected: status.isConnected,
        totalRecords: status.totalRecords
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Database health check failed', { error: message });
      return {
        connected: false,
        totalRecords: 0
      };
    }
  }

  private async checkBridgeHealth(): Promise<HealthStatus['bridge']> {
    try {
      const [pendingTxs, failedTxs] = await Promise.all([
        this.database.getPendingTransactions(),
        this.database.getTransactionsByStatus('failed')
      ]);

      return {
        pendingTransactions: pendingTxs.length,
        failedTransactions: failedTxs.length,
        processingErrors: 0,
        lastProcessed: new Date()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Bridge health check failed', { error: message });
      return {
        pendingTransactions: 0,
        failedTransactions: 0,
        processingErrors: 0,
        lastProcessed: new Date()
      };
    }
  }

  private async updateMetrics(): Promise<void> {
    try {
      const [stats, health, parity] = await Promise.all([
        this.database.getStatistics(),
        this.getHealthStatus(),
        this.calculateParity()
      ]);

      this.metrics = {
        transactions: {
          total: stats.totalTransactions,
          completed: stats.completedTransactions,
          pending: stats.pendingTransactions,
          failed: stats.failedTransactions,
          hourlyRate: 0,
          dailyVolume: stats.dailyVolume
        },
        balances: {
          solanaUSDT: health.solana.usdtBalance,
          lunesLUSDT: health.lunes.lusdtBalance,
          solanaSOL: health.solana.balance,
          lunesLUNES: health.lunes.balance
        },
        performance: {
          averageProcessingTime: stats.averageProcessingTime,
          successRate: stats.totalTransactions > 0 ? (stats.completedTransactions / stats.totalTransactions) : 0,
          errorRate: stats.totalTransactions > 0 ? (stats.failedTransactions / stats.totalTransactions) : 0,
          uptime: (Date.now() - this.startTime.getTime()) / 1000
        },
        parity
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to update metrics', { error: message });
    }
  }

  private async checkParity(): Promise<void> {
    try {
      const parity = await this.calculateParity();

      if (parity.status === 'critical') {
        logger.error('🚨 CRITICAL: Parity deviation detected', parity);
        await this.sendAlert('Critical parity deviation detected', parity);
      } else if (parity.status === 'warning') {
        logger.warn('⚠️  WARNING: Parity deviation detected', parity);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Parity check failed', { error: message });
    }
  }

  private async calculateParity(): Promise<BridgeMetrics['parity']> {
    try {
      const deviation = 0;
      const threshold = config.PARITY_DEVIATION_THRESHOLD;

      const status: BridgeMetrics['parity']['status'] = deviation > threshold
        ? (deviation > threshold * 2 ? 'critical' : 'warning')
        : 'ok';

      return {
        deviation,
        threshold,
        status
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to calculate parity', { error: message });
      return {
        deviation: 0,
        threshold: config.PARITY_DEVIATION_THRESHOLD,
        status: 'ok'
      };
    }
  }

  private async sendAlert(message: string, data?: any): Promise<void> {
    try {
      // Implementar notificações (Discord, Email, etc.)
      logger.error(`🚨 ALERT: ${message}`, data);
      
      // TODO: Implementar Discord webhook
      if (config.DISCORD_WEBHOOK_URL) {
        // await this.sendDiscordNotification(message, data);
      }
      
      // TODO: Implementar notificação por email
      if (config.ALERT_EMAIL) {
        // await this.sendEmailNotification(message, data);
      }
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to send alert', { error: errMessage });
    }
  }
}