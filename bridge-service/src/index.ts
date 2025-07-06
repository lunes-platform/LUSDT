import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { SolanaClient } from './solana/client';
import { LunesClient } from './lunes/client';
import { BridgeProcessor } from './bridge/processor';
import { Database } from './bridge/database';
import { BridgeMonitoring } from './monitoring/metrics';
import { logger } from './utils/logger';
import { config } from './config/env';

// Carrega variáveis de ambiente
dotenv.config();

class BridgeService {
  private app: express.Application;
  private solanaClient: SolanaClient;
  private lunesClient: LunesClient;
  private database: Database;
  private bridgeProcessor: BridgeProcessor;
  private monitoring: BridgeMonitoring;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Segurança
    this.app.use(helmet());
    this.app.use(cors({
      origin: config.ALLOWED_ORIGINS,
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100, // máximo 100 requests por IP
      message: 'Too many requests from this IP'
    });
    this.app.use(limiter);

    // Compressão e parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Logging de requests
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.monitoring.getHealthStatus();
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          ...health
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });

    // Métricas
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.monitoring.getMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Status das transações
    this.app.get('/transactions/:signature', async (req, res) => {
      try {
        const { signature } = req.params;
        const transaction = await this.database.getTransactionBySignature(signature);
        
        if (!transaction) {
          return res.status(404).json({ error: 'Transaction not found' });
        }
        
        res.json(transaction);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Estatísticas
    this.app.get('/stats', async (req, res) => {
      try {
        const stats = await this.database.getStatistics();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Webhook para notificações (opcional)
    this.app.post('/webhook/solana', async (req, res) => {
      try {
        // Processa webhook de transações Solana
        logger.info('Received Solana webhook', req.body);
        res.json({ status: 'received' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing LUSDT Bridge Service...');

      // Inicializa componentes
      this.database = new Database();
      await this.database.initialize();

      this.solanaClient = new SolanaClient(
        config.SOLANA_RPC_URL,
        config.SOLANA_WALLET_PRIVATE_KEY
      );
      await this.solanaClient.initialize();

      this.lunesClient = new LunesClient(
        config.LUNES_RPC_URL,
        config.LUNES_WALLET_SEED,
        config.LUSDT_CONTRACT_ADDRESS
      );
      await this.lunesClient.initialize();

      this.monitoring = new BridgeMonitoring(
        this.solanaClient,
        this.lunesClient,
        this.database
      );

      this.bridgeProcessor = new BridgeProcessor(
        this.solanaClient,
        this.lunesClient,
        this.database,
        this.monitoring
      );

      // Inicia o processador principal
      await this.bridgeProcessor.start();

      logger.info('✅ Bridge Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Bridge Service:', error);
      process.exit(1);
    }
  }

  async start(): Promise<void> {
    const port = config.PORT || 3000;
    
    this.app.listen(port, () => {
      logger.info(`🌉 LUSDT Bridge Service running on port ${port}`);
      logger.info(`📊 Health check: http://localhost:${port}/health`);
      logger.info(`📈 Metrics: http://localhost:${port}/metrics`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down Bridge Service...');
    
    try {
      await this.bridgeProcessor.stop();
      await this.database.close();
      logger.info('✅ Bridge Service shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Inicializa e inicia o serviço
async function main() {
  const bridgeService = new BridgeService();
  await bridgeService.initialize();
  await bridgeService.start();
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Inicia o serviço
main().catch((error) => {
  logger.error('Failed to start Bridge Service:', error);
  process.exit(1);
}); 