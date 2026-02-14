import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

import { PublicKey } from '@solana/web3.js';
import { SolanaClient } from './solana/client';
import { LunesClient } from './lunes/client';
import { BridgeProcessor } from './bridge/processor';
import { Database } from './bridge/database';
import { BridgeMonitoring } from './monitoring/metrics';
import { UsdtFeeCollector } from './bridge/usdt-fee-collector';
import { logger } from './utils/logger';
import { config, validateConfig } from './config/env';
import { AdminRoutes } from './admin/adminRoutes';

// Carrega variáveis de ambiente
dotenv.config();

class BridgeService {
  private app: express.Application;
  private solanaClient?: SolanaClient;
  private lunesClient?: LunesClient;
  private database?: Database;
  private bridgeProcessor?: BridgeProcessor;
  private monitoring?: BridgeMonitoring;
  private feeCollector?: UsdtFeeCollector;
  private adminRoutes: AdminRoutes;
  private startupErrors: string[] = [];

  constructor() {
    this.app = express();
    this.adminRoutes = new AdminRoutes();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * v3 Dual-fee model: determines stablecoin fee type based on operation direction.
   * Mint (Solana→Lunes): USDT fee + LUNES burn
   * Burn (Lunes→Solana): LUSDT fee + LUNES burn
   */
  private determineOptimalFeeType(
    amount: number,
    sourceChain: 'solana' | 'lunes'
  ): 'usdt' | 'lusdt' {
    if (sourceChain === 'solana') {
      return 'usdt';  // Mint: charge USDT fee
    }
    return 'lusdt';    // Burn: charge LUSDT fee
  }

  /**
   * v3 Dual-fee calculation: stablecoin fee (revenue) + LUNES burn fee
   * Returns both fees for display to the user.
   */
  private calculateFee(amount: number, feeType: 'usdt' | 'lusdt' | 'lunes'): {
    amount: number;
    currency: string;
    lunesBurnFee: number;
    lunesBurnCurrency: string;
    totalFeeUsd: number;
  } {
    // Stablecoin fee: 0.30% - 0.60% based on volume tier (using default 0.60% for now)
    const stablecoinFeeBps = 60; // 0.60% — will be fetched from contract in production
    const lunesBurnFeeBps = 10;  // 0.10% — LUNES burn fee
    const lunesPrice = 0.50;     // $0.50 — will be fetched from contract in production

    const stablecoinFee = (amount * stablecoinFeeBps) / 10000;

    // LUNES burn fee: calculated in USD then converted to LUNES with caps
    const burnFeeUsd = (amount * lunesBurnFeeBps) / 10000;
    let lunesBurnFee = burnFeeUsd / lunesPrice;

    // Apply intelligent caps (same as contract)
    if (amount <= 100) lunesBurnFee = Math.min(lunesBurnFee, 0.5);
    else if (amount <= 1000) lunesBurnFee = Math.min(lunesBurnFee, 2.0);
    else if (amount <= 10000) lunesBurnFee = Math.min(lunesBurnFee, 10.0);
    else lunesBurnFee = Math.min(lunesBurnFee, 50.0);

    const currency = feeType === 'usdt' ? 'USDT' : feeType === 'lusdt' ? 'LUSDT' : 'LUNES';

    return {
      amount: stablecoinFee,
      currency,
      lunesBurnFee,
      lunesBurnCurrency: 'LUNES',
      totalFeeUsd: stablecoinFee + burnFeeUsd,
    };
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

  private requireOpsAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (config.NODE_ENV !== 'production' && config.NODE_ENV !== 'staging') {
      next();
      return;
    }

    const header = req.header('authorization') || '';
    if (!header.toLowerCase().startsWith('basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="ops"');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const base64 = header.slice(6).trim();
    let decoded = '';
    try {
      decoded = Buffer.from(base64, 'base64').toString('utf8');
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const idx = decoded.indexOf(':');
    if (idx === -1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (user !== config.OPS_BASIC_AUTH_USER || pass !== config.OPS_BASIC_AUTH_PASS) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  }

  private requireBridgeAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (config.NODE_ENV !== 'production' && config.NODE_ENV !== 'staging') {
      next();
      return;
    }

    // Option 1: HMAC signature (preferred for server-to-server)
    const signature = req.header('x-bridge-signature');
    const timestamp = req.header('x-bridge-timestamp');
    if (signature && timestamp && config.BRIDGE_API_SECRET) {
      const age = Math.abs(Date.now() - parseInt(timestamp, 10));
      if (age > 300_000) {
        res.status(401).json({ error: 'Request timestamp expired (>5 min)' });
        return;
      }
      const payload = `${timestamp}.${JSON.stringify(req.body)}`;
      const expected = crypto.createHmac('sha256', config.BRIDGE_API_SECRET).update(payload).digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        next();
        return;
      }
      res.status(401).json({ error: 'Invalid HMAC signature' });
      return;
    }

    // Option 2: Static API key (simpler, for trusted frontends)
    const apiKey = req.header('x-bridge-api-key');
    if (apiKey && config.BRIDGE_API_KEY && crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(config.BRIDGE_API_KEY))) {
      next();
      return;
    }

    // Option 3: Fall back to Basic Auth (ops credentials)
    const authHeader = req.header('authorization') || '';
    if (authHeader.toLowerCase().startsWith('basic ')) {
      return this.requireOpsAuth(req, res, next);
    }

    res.status(401).json({ error: 'Bridge authentication required. Provide X-Bridge-API-Key, X-Bridge-Signature, or Basic Auth.' });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        if (!this.monitoring) {
          res.status(503).json({
            status: 'degraded',
            reason: 'Service not fully initialized',
            timestamp: new Date().toISOString(),
            startupErrors: this.startupErrors
          });
          return;
        }

        const health = await this.monitoring.getHealthStatus();
        res.json({ status: 'healthy', timestamp: new Date().toISOString(), ...health });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({
          status: 'unhealthy',
          error: message
        });
      }
    });

    // Métricas
    this.app.get('/metrics', async (req, res) => {
      try {
        if (!this.monitoring) {
          res.status(503).json({
            error: 'Service not fully initialized',
            startupErrors: this.startupErrors
          });
          return;
        }

        const metrics = await this.monitoring.getMetrics();
        res.json(metrics);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Ops: overview (read-only; protegido em staging/production)
    this.app.get('/ops/overview', this.requireOpsAuth.bind(this), async (req, res) => {
      try {
        const isStrictEnv = config.NODE_ENV === 'production' || config.NODE_ENV === 'staging';

        if (isStrictEnv && (!this.database || !this.solanaClient || !this.lunesClient || !this.monitoring)) {
          res.status(503).json({
            error: 'Service not fully initialized',
            startupErrors: this.startupErrors
          });
          return;
        }

        const [health, stats, solNetworkInfo, solBalance, solUsdtBalance, lunesBalance] = await Promise.all([
          this.monitoring
            ? this.monitoring.getHealthStatus()
            : Promise.resolve({
                overall: 'degraded',
                solana: { connected: !!this.solanaClient },
                lunes: { connected: !!this.lunesClient },
                database: { connected: !!this.database }
              }),
          this.database ? this.database.getStatistics() : Promise.resolve(null),
          this.solanaClient ? this.solanaClient.getNetworkInfo().catch(() => null) : Promise.resolve(null),
          this.solanaClient ? this.solanaClient.getSolBalance().catch(() => 0) : Promise.resolve(0),
          this.solanaClient ? this.solanaClient.getUSDTBalance().catch(() => 0) : Promise.resolve(0),
          this.lunesClient ? this.lunesClient.getBalance().catch(() => 0) : Promise.resolve(0)
        ]);

        res.json({
          health,
          stats,
          solana: solNetworkInfo,
          startupErrors: this.startupErrors,
          wallets: {
            solana: {
              address: this.solanaClient ? this.solanaClient.getPublicKey() : '',
              usdtBalance: solUsdtBalance,
              solBalance
            },
            lunes: {
              address: this.lunesClient ? this.lunesClient.getAddress() : '',
              lunesBalance
            }
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Ops: recent transactions (read-only; protegido em staging/production)
    this.app.get('/ops/transactions/recent', this.requireOpsAuth.bind(this), async (req, res) => {
      try {
        const isStrictEnv = config.NODE_ENV === 'production' || config.NODE_ENV === 'staging';
        if (isStrictEnv && !this.database) {
          res.status(503).json({
            error: 'Service not fully initialized',
            startupErrors: this.startupErrors
          });
          return;
        }

        const limitRaw = req.query.limit as string | undefined;
        const limit = Math.min(Math.max(parseInt(limitRaw || '50', 10) || 50, 1), 200);

        if (!this.database) {
          res.json({ transactions: [], total: 0, startupErrors: this.startupErrors });
          return;
        }

        const transactions = await this.database.getTransactionHistory(limit, 0);
        res.json({ transactions, total: transactions.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Listar transações (compatível com frontend)
    this.app.get('/transactions', async (req, res) => {
      try {
        if (!this.database) {
          res.status(503).json({ error: 'Database not initialized', startupErrors: this.startupErrors });
          return;
        }

        const status = req.query.status as string | undefined;

        const transactions = status
          ? await this.database.getTransactionsByStatus(status as any)
          : await this.database.getTransactionHistory(100, 0);

        res.json({
          transactions,
          total: transactions.length
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Buscar transação por signature (endpoint auxiliar)
    this.app.get('/transactions/by-signature/:signature', async (req, res) => {
      try {
        if (!this.database) {
          res.status(503).json({ error: 'Database not initialized', startupErrors: this.startupErrors });
          return;
        }

        const { signature } = req.params;
        const transaction = await this.database.getTransactionBySignature(signature);

        if (!transaction) {
          res.status(404).json({ error: 'Transaction not found' });
          return;
        }

        res.json(transaction);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Buscar transação por ID (compatível com frontend)
    this.app.get('/transactions/:id', async (req, res, next) => {
      try {
        if (!this.database) {
          res.status(503).json({ error: 'Database not initialized', startupErrors: this.startupErrors });
          return;
        }

        const { id } = req.params;

        const transaction = await this.database.getTransaction(id);
        if (!transaction) {
          res.status(404).json({ error: 'Transaction not found' });
          return;
        }

        res.json(transaction);
      } catch (error) {
        next(error);
      }
    });

    // Estatísticas
    this.app.get('/stats', async (req, res) => {
      try {
        if (!this.database) {
          res.status(503).json({ error: 'Database not initialized', startupErrors: this.startupErrors });
          return;
        }

        const stats = await this.database.getStatistics();
        res.json(stats);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Configuração pública da Bridge
    this.app.get('/bridge/config', async (req, res) => {
      try {
        // Se estiver em modo degraded sem clients, não podemos fornecer endereços
        if (!this.solanaClient && (config.NODE_ENV === 'production' || config.NODE_ENV === 'staging')) {
          res.status(503).json({ error: 'Bridge service not fully initialized', startupErrors: this.startupErrors });
          return;
        }

        const solanaAddress = this.solanaClient ? this.solanaClient.getPublicKey() : '';
        
        res.json({
          solanaBridgeAddress: solanaAddress,
          lunesContractAddress: config.LUSDT_CONTRACT_ADDRESS,
          limits: {
            minAmount: 1,
            maxAmount: config.MAX_TRANSACTION_VALUE
          },
          status: this.monitoring ? 'active' : 'degraded'
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Dados de Reservas (Proof of Reserve)
    this.app.get('/bridge/reserves', async (req, res) => {
      try {
        // Valores padrão em caso de falha nos clientes
        let usdtBalance = 0;
        let lusdtSupply = 0;
        let lastUpdate = new Date().toISOString();

        if (this.solanaClient) {
          try {
            usdtBalance = await this.solanaClient.getUSDTBalance();
          } catch (e) {
            logger.error('Failed to get USDT balance for reserves', { error: e });
          }
        }

        if (this.lunesClient) {
          try {
            lusdtSupply = await this.lunesClient.getTotalSupply();
          } catch (e) {
            logger.error('Failed to get LUSDT supply for reserves', { error: e });
          }
        }

        // Backing Ratio
        const ratio = lusdtSupply > 0 ? (usdtBalance / lusdtSupply) * 100 : 100;

        res.json({
          totalBackingUSDT: usdtBalance,
          totalCirculatingLUSDT: lusdtSupply,
          backingRatio: ratio,
          lastUpdate,
          reserves: {
            solanaWallet: this.solanaClient ? this.solanaClient.getPublicKey() : '',
            lunesContract: config.LUSDT_CONTRACT_ADDRESS
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Calcular taxa (compatível com frontend)
    this.app.post('/bridge/calculate-fee', async (req, res) => {
      try {
        const { amount, sourceChain, feeType } = req.body;

        if (amount === undefined || !sourceChain) {
          res.status(400).json({ error: 'Missing required fields: amount, sourceChain' });
          return;
        }

        const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
          res.status(400).json({ error: 'Invalid amount: Must be a positive number' });
          return;
        }

        const optimalFeeType = feeType || this.determineOptimalFeeType(parsedAmount, sourceChain);
        const fee = this.calculateFee(parsedAmount, optimalFeeType);
        const stablecoinFeePercentage = (fee.amount / parsedAmount) * 100;
        const totalFeePercentage = (fee.totalFeeUsd / parsedAmount) * 100;

        res.json({
          // v3 dual-fee model
          feeModel: 'dual',
          feeType: optimalFeeType,
          // Stablecoin fee (revenue: 80% dev / 15% insurance / 5% staking)
          stablecoinFee: parseFloat(fee.amount.toFixed(6)),
          stablecoinCurrency: fee.currency,
          stablecoinFeePercentage: parseFloat(stablecoinFeePercentage.toFixed(2)),
          // LUNES burn fee (deflationary)
          lunesBurnFee: parseFloat(fee.lunesBurnFee.toFixed(6)),
          lunesBurnCurrency: fee.lunesBurnCurrency,
          // Totals
          totalFeeUsd: parseFloat(fee.totalFeeUsd.toFixed(6)),
          totalFeePercentage: parseFloat(totalFeePercentage.toFixed(2)),
          netAmount: parsedAmount - fee.amount,
          // Legacy compatibility
          feeAmount: fee.amount,
          feeCurrency: fee.currency,
          feePercentage: parseFloat(stablecoinFeePercentage.toFixed(2)),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Criar transação Solana -> Lunes (persistir no DB e deixar BridgeProcessor processar)
    this.app.post('/bridge/solana-to-lunes', this.requireBridgeAuth.bind(this), async (req, res) => {
      try {
        if (!this.database) {
          res.status(503).json({ error: 'Database not initialized', startupErrors: this.startupErrors });
          return;
        }

        const { amount, sourceAddress, destinationAddress, sourceSignature } = req.body;

        if (!amount || !sourceAddress || !destinationAddress) {
          res.status(400).json({
            error: 'Missing required fields: amount, sourceAddress, destinationAddress'
          });
          return;
        }

        const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
          res.status(400).json({ error: 'Invalid amount: Must be a positive number' });
          return;
        }

        const transactionId = await this.database.saveTransaction({
          sourceChain: 'solana',
          destinationChain: 'lunes',
          sourceSignature: sourceSignature || '',
          destinationSignature: undefined,
          amount: parsedAmount,
          sourceAddress,
          destinationAddress,
          status: 'pending',
          metadata: {
            sourceSignature: sourceSignature || null,
            createdVia: 'api'
          }
        });

        res.status(201).json({
          transactionId,
          status: 'pending',
          estimatedCompletionTime: 30,
          message: 'Bridge transaction initiated'
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Criar transação Lunes -> Solana (persistir no DB e deixar BridgeProcessor processar)
    this.app.post('/bridge/lunes-to-solana', this.requireBridgeAuth.bind(this), async (req, res) => {
      try {
        if (!this.database) {
          res.status(503).json({ error: 'Database not initialized', startupErrors: this.startupErrors });
          return;
        }

        const { amount, sourceAddress, destinationAddress, sourceSignature } = req.body;

        if (!amount || !sourceAddress || !destinationAddress) {
          res.status(400).json({
            error: 'Missing required fields: amount, sourceAddress, destinationAddress'
          });
          return;
        }

        const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
          res.status(400).json({ error: 'Invalid amount: Must be a positive number' });
          return;
        }

        const transactionId = await this.database.saveTransaction({
          sourceChain: 'lunes',
          destinationChain: 'solana',
          sourceSignature: sourceSignature || '',
          destinationSignature: undefined,
          amount: parsedAmount,
          sourceAddress,
          destinationAddress,
          status: 'pending',
          metadata: {
            sourceSignature: sourceSignature || null,
            createdVia: 'api'
          }
        });

        res.status(201).json({
          transactionId,
          status: 'pending',
          estimatedCompletionTime: 30,
          message: 'Bridge transaction initiated'
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Webhook genérico usado pelo frontend
    this.app.post('/webhook/notification', async (req, res) => {
      try {
        logger.info('Received webhook notification', req.body);
        res.json({ received: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Rotas admin (protegidas por Basic Auth em staging/production)
    this.app.use('/admin', this.requireOpsAuth.bind(this), this.adminRoutes.getRouter());

    // === USDT FEE COLLECTOR ADMIN ENDPOINTS ===
    
    // Initialize fee collector with wallet addresses / Inicializar coletor com endereços
    this.app.post('/admin/fee-collector/initialize', this.requireOpsAuth.bind(this), async (req, res): Promise<void> => {
      try {
        const { devSolanaAddress, insuranceFundAddress } = req.body;

        if (!devSolanaAddress || !insuranceFundAddress) {
          res.status(400).json({
            error: 'Missing required fields: devSolanaAddress, insuranceFundAddress'
          });
          return;
        }

        // Validate Solana addresses / Validar endereços Solana
        try {
          new PublicKey(devSolanaAddress);
          new PublicKey(insuranceFundAddress);
        } catch {
          res.status(400).json({
            error: 'Invalid Solana address format'
          });
          return;
        }

        // Initialize fee collector / Inicializar coletor
        await this.initializeFeeCollector(devSolanaAddress, insuranceFundAddress);

        res.json({
          success: true,
          message: 'USDT Fee Collector initialized successfully',
          devWallet: devSolanaAddress,
          insuranceWallet: insuranceFundAddress
        });

        logger.info('✅ Fee collector initialized via admin API', {
          devWallet: devSolanaAddress,
          insuranceWallet: insuranceFundAddress
        });

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('❌ Failed to initialize fee collector', { error: message });
        res.status(500).json({
          error: 'Failed to initialize fee collector',
          details: message
        });
      }
    });

    // Get fee collector status and stats / Obter status e estatísticas
    this.app.get('/admin/fee-collector/stats', this.requireOpsAuth.bind(this), async (req, res): Promise<void> => {
      try {
        if (!this.feeCollector) {
          res.status(503).json({
            error: 'Fee collector not initialized',
            status: 'not_configured'
          });
          return;
        }

        const stats = this.feeCollector.getStats();

        res.json({
          status: 'active',
          ...stats
        });

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('❌ Failed to get fee collector stats', { error: message });
        res.status(500).json({ error: message });
      }
    });

    // Update dev wallet (configurable via admin) / Atualizar carteira dev
    this.app.post('/admin/fee-collector/update-dev-wallet', this.requireOpsAuth.bind(this), async (req, res): Promise<void> => {
      try {
        const { newAddress } = req.body;

        if (!newAddress) {
          res.status(400).json({
            error: 'Missing required field: newAddress'
          });
          return;
        }

        if (!this.feeCollector) {
          res.status(503).json({
            error: 'Fee collector not initialized'
          });
          return;
        }

        // Validate address / Validar endereço
        try {
          new PublicKey(newAddress);
        } catch {
          res.status(400).json({
            error: 'Invalid Solana address format'
          });
          return;
        }

        this.feeCollector.updateDevWallet(newAddress);

        res.json({
          success: true,
          message: 'Dev wallet updated successfully',
          newAddress
        });

        logger.info('📝 Dev wallet updated via admin API', { newAddress });

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('❌ Failed to update dev wallet', { error: message });
        res.status(500).json({
          error: 'Failed to update dev wallet',
          details: message
        });
      }
    });

    // Get insurance wallet (read-only) / Obter carteira de seguro (somente leitura)
    this.app.get('/admin/fee-collector/insurance-wallet', this.requireOpsAuth.bind(this), async (req, res): Promise<void> => {
      try {
        if (!this.feeCollector) {
          res.status(503).json({
            error: 'Fee collector not initialized'
          });
          return;
        }

        res.json({
          insuranceWallet: this.feeCollector.getInsuranceWallet(),
          note: 'Insurance fund is fixed and cannot be changed via admin'
        });

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Pause fee collection / Pausar coleta de taxas
    this.app.post('/admin/fee-collector/pause', this.requireOpsAuth.bind(this), async (req, res): Promise<void> => {
      try {
        if (!this.feeCollector) {
          res.status(503).json({
            error: 'Fee collector not initialized'
          });
          return;
        }

        this.feeCollector.pause();

        res.json({
          success: true,
          message: 'Fee collection paused',
          status: 'paused'
        });

        logger.info('⏸️ Fee collection paused via admin API');

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Resume fee collection / Retomar coleta de taxas
    this.app.post('/admin/fee-collector/resume', this.requireOpsAuth.bind(this), async (req, res): Promise<void> => {
      try {
        if (!this.feeCollector) {
          res.status(503).json({
            error: 'Fee collector not initialized'
          });
          return;
        }

        this.feeCollector.resume();

        res.json({
          success: true,
          message: 'Fee collection resumed',
          status: 'active'
        });

        logger.info('▶️ Fee collection resumed via admin API');

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Webhook para notificações (opcional)
    this.app.post('/webhook/solana', async (req, res) => {
      try {
        // Processa webhook de transações Solana
        logger.info('Received Solana webhook', req.body);
        res.json({ status: 'received' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing LUSDT Bridge Service...');

      try {
        validateConfig();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.startupErrors.push(message);
        logger.error('Config validation failed', { error: message });
        if (config.NODE_ENV === 'production' || config.NODE_ENV === 'staging') {
          throw error;
        }
      }

      // Inicializa DB (opcional em development)
      try {
        this.database = new Database();
        await this.database.initialize();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.startupErrors.push(`database: ${message}`);
        logger.error('Database initialization failed', { error: message });
        if (config.NODE_ENV === 'production' || config.NODE_ENV === 'staging') {
          throw error;
        }
        this.database = undefined;
      }

      // Inicializa Solana (opcional em development)
      try {
        if (config.SOLANA_WALLET_PRIVATE_KEY) {
          this.solanaClient = new SolanaClient(
            config.SOLANA_RPC_URL,
            config.SOLANA_WALLET_PRIVATE_KEY
          );
          await this.solanaClient.initialize();
        } else {
          this.startupErrors.push('solana: missing SOLANA_WALLET_PRIVATE_KEY');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.startupErrors.push(`solana: ${message}`);
        logger.error('Solana client initialization failed', { error: message });
        if (config.NODE_ENV === 'production' || config.NODE_ENV === 'staging') {
          throw error;
        }
        this.solanaClient = undefined;
      }

      // Inicializa Lunes (opcional em development)
      try {
        if (config.LUNES_WALLET_SEED && config.LUSDT_CONTRACT_ADDRESS) {
          this.lunesClient = new LunesClient(
            config.LUNES_RPC_URL,
            config.LUNES_WALLET_SEED,
            config.LUSDT_CONTRACT_ADDRESS
          );
          await this.lunesClient.initialize();
        } else {
          this.startupErrors.push('lunes: missing LUNES_WALLET_SEED/LUSDT_CONTRACT_ADDRESS');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.startupErrors.push(`lunes: ${message}`);
        logger.error('Lunes client initialization failed', { error: message });
        if (config.NODE_ENV === 'production' || config.NODE_ENV === 'staging') {
          throw error;
        }
        this.lunesClient = undefined;
      }

      if (this.database && this.solanaClient && this.lunesClient) {
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

        await this.bridgeProcessor.start();
        logger.info('✅ Bridge Service initialized successfully');
      } else {
        logger.warn('⚠️  Bridge Service started in degraded mode', {
          startupErrors: this.startupErrors
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to initialize Bridge Service', { error: message });
      if (config.NODE_ENV === 'production' || config.NODE_ENV === 'staging') {
        process.exit(1);
      }
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
      if (this.bridgeProcessor) {
        await this.bridgeProcessor.stop();
      }
      if (this.feeCollector) {
        this.feeCollector.pause(); // Pause fee collection on shutdown
      }
      if (this.database) {
        await this.database.close();
      }
      logger.info('✅ Bridge Service shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  }

  /**
   * Initialize USDT Fee Collector
   * Inicializar Coletor de Taxas USDT
   */
  private async initializeFeeCollector(
    devSolanaAddress: string,
    insuranceFundAddress: string
  ): Promise<void> {
    try {
      if (!this.solanaClient || !this.lunesClient) {
        throw new Error('Solana or Lunes client not initialized');
      }

      // Get connection and API from clients
      const solanaConnection = (this.solanaClient as any).connection;
      const lunesApi = (this.lunesClient as any).api;

      if (!solanaConnection || !lunesApi) {
        throw new Error('Failed to access client connections');
      }

      // Import ContractPromise dynamically to avoid circular dependencies
      const { ContractPromise } = await import('@polkadot/api-contract');
      const { default: taxManagerMetadata } = await import('./contracts/tax_manager.json');

      // Create contract instance
      const taxManagerContract = new ContractPromise(
        lunesApi,
        taxManagerMetadata,
        config.TAX_MANAGER_CONTRACT_ADDRESS || ''
      );

      // Create fee collector with real SolanaClient for USDT transfers
      this.feeCollector = new UsdtFeeCollector(
        solanaConnection,
        this.solanaClient,
        lunesApi,
        taxManagerContract,
        devSolanaAddress,
        insuranceFundAddress
      );

      // Start listening for events
      await this.feeCollector.startListening();

      logger.info('✅ USDT Fee Collector initialized', {
        devWallet: devSolanaAddress,
        insuranceWallet: insuranceFundAddress
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to initialize fee collector', { error: message });
      throw error;
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
  logger.error('Unhandled Rejection', { promise, reason });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});

// Inicia o serviço
main().catch((error) => {
  logger.error('Failed to start Bridge Service', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});