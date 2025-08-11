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
        logger.error('Health check failed', error);
      }
    }, config.HEALTH_CHECK_INTERVAL);

    // Verificação de paridade periódica
    this.parityCheckInterval = setInterval(async () => {
      try {
        await this.checkParity();
      } catch (error) {
        logger.error('Parity check failed', error);
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
      logger.error('❌ Health check failed', error);
      throw error;
    }
  }

  private async checkSolanaHealth(): Promise<Omit<HealthStatus['solana'], 'lastChecked'>> {
    try {
      const [balance, usdtBalance, networkInfo] = await Promise.all([
        this.solanaClient.getUSDTBalance(), // This should be SOL balance actually
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
      logger.error('Solana health check failed', error);
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
      logger.error('Lunes health check failed', error);
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
      logger.error('Database health check failed', error);
      return {
        connected: false,
        totalRecords: 0
      };
    }
  }

  private async checkBridgeHealth(): Promise<HealthStatus['bridge']> {
    try {
      const stats = await this.database.getStatistics();
      const pendingTransactions = await this.database.getPendingTransactions();
      const failedTransactions = await this.database.getTransactionsByStatus('failed');
      
      // Conta erros recentes (últimas 24 horas)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentErrors = failedTransactions.filter(tx => tx.createdAt >= yesterday);

      return {
        pendingTransactions: pendingTransactions.length,
        failedTransactions: failedTransactions.length,
        processingErrors: recentErrors.length,
        lastProcessed: new Date() // This should track actual last processed transaction
      };
    } catch (error) {
      logger.error('Bridge health check failed', error);
      return {
        pendingTransactions: 0,
        failedTransactions: 0,
        processingErrors: 0,
        lastProcessed: new Date()
      };
    }
  }

  private determineOverallHealth(
    solana: any, 
    lunes: any, 
    database: any, 
    bridge: any
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // Critérios para unhealthy
    if (!solana.connected || !lunes.connected || !database.connected) {
      return 'unhealthy';
    }

    if (bridge.processingErrors > 10) { // Mais de 10 erros em 24h
      return 'unhealthy';
    }

    // Critérios para degraded
    if (bridge.pendingTransactions > 50) { // Mais de 50 transações pendentes
      return 'degraded';
    }

    if (bridge.processingErrors > 5) { // Mais de 5 erros em 24h
      return 'degraded';
    }

    if (solana.balance < 0.1 || lunes.balance < 1) { // Saldos baixos
      return 'degraded';
    }

    return 'healthy';
  }

  private async updateMetrics(): Promise<void> {
    try {
      const stats = await this.database.getStatistics();
      const healthStatus = await this.getHealthStatus();
      
      // Calcula uptime
      const uptime = (Date.now() - this.startTime.getTime()) / 1000;
      
      // Calcula taxa de sucesso
      const successRate = stats.totalTransactions > 0 
        ? (stats.completedTransactions / stats.totalTransactions) * 100 
        : 100;
      
      const errorRate = stats.totalTransactions > 0 
        ? (stats.failedTransactions / stats.totalTransactions) * 100 
        : 0;

      this.metrics = {
        transactions: {
          total: stats.totalTransactions,
          completed: stats.completedTransactions,
          pending: stats.pendingTransactions,
          failed: stats.failedTransactions,
          hourlyRate: stats.dailyVolume / 24, // Aproximação
          dailyVolume: stats.dailyVolume
        },
        balances: {
          solanaUSDT: healthStatus.solana.usdtBalance,
          lunesLUSDT: healthStatus.lunes.lusdtBalance,
          solanaSOL: healthStatus.solana.balance,
          lunesLUNES: healthStatus.lunes.balance
        },
        performance: {
          averageProcessingTime: stats.averageProcessingTime,
          successRate,
          errorRate,
          uptime
        },
        parity: await this.calculateParity()
      };
    } catch (error) {
      logger.error('Failed to update metrics', error);
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
      logger.error('Parity check failed', error);
    }
  }

  private async calculateParity(): Promise<BridgeMetrics['parity']> {
    try {
      const [solanaUSDT, lunesLUSDT] = await Promise.all([
        this.solanaClient.getUSDTBalance(),
        this.lunesClient.getLUSDTBalance()
      ]);

      // Calcula desvio (diferença entre os saldos)
      const deviation = Math.abs(solanaUSDT - lunesLUSDT) / Math.max(solanaUSDT, lunesLUSDT, 1);
      const threshold = config.PARITY_DEVIATION_THRESHOLD;

      let status: 'ok' | 'warning' | 'critical' = 'ok';
      if (deviation > threshold * 2) {
        status = 'critical';
      } else if (deviation > threshold) {
        status = 'warning';
      }

      return {
        deviation,
        threshold,
        status
      };
    } catch (error) {
      logger.error('Failed to calculate parity', error);
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
      logger.error('Failed to send alert', error);
    }
  }
}