/**
 * Simplified Bridge Service for LUSDT / Serviço de Ponte Simplificado para LUSDT
 * This is a working, minimal implementation for demonstration
 * Esta é uma implementação mínima funcional para demonstração
 * 
 * Features / Recursos:
 * - Cross-chain transfers between Solana and Lunes / Transferências cross-chain entre Solana e Lunes
 * - Transaction tracking and monitoring / Rastreamento e monitoramento de transações
 * - RESTful API for bridge operations / API RESTful para operações de ponte
 * - Health checks and statistics / Verificações de saúde e estatísticas
 */

import express from 'express';
import { logger } from './utils/logger';

/**
 * Bridge statistics interface / Interface de estatísticas da ponte
 */
interface BridgeStats {
  /** Total number of transactions processed / Número total de transações processadas */
  totalTransactions: number;
  /** Current pending transactions / Transações pendentes atuais */
  pendingTransactions: number;
  /** Successfully completed transactions / Transações concluídas com sucesso */
  completedTransactions: number;
  /** Failed transactions / Transações que falharam */
  failedTransactions: number;
  /** Service uptime in seconds / Tempo de atividade do serviço em segundos */
  uptime: number;
  /** Last transaction processed timestamp / Timestamp da última transação processada */
  lastProcessed: Date;
}

/**
 * Transaction record interface / Interface de registro de transação
 */
interface TransactionRecord {
  /** Unique transaction identifier / Identificador único da transação */
  id: string;
  /** Source blockchain / Blockchain de origem */
  sourceChain: 'solana' | 'lunes';
  /** Destination blockchain / Blockchain de destino */
  destinationChain: 'solana' | 'lunes';
  /** Transfer amount / Valor da transferência */
  amount: number;
  /** Source wallet address / Endereço da carteira de origem */
  sourceAddress: string;
  /** Destination wallet address / Endereço da carteira de destino */
  destinationAddress: string;
  /** Current transaction status / Status atual da transação */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Transaction creation timestamp / Timestamp de criação da transação */
  createdAt: Date;
  /** Transaction completion timestamp / Timestamp de conclusão da transação */
  completedAt?: Date;
  /** Fee type for this transaction / Tipo de taxa para esta transação */
  feeType?: 'lunes' | 'lusdt' | 'usdt';
  /** Fee amount collected / Valor da taxa coletada */
  feeAmount?: number;
  /** Fee currency / Moeda da taxa */
  feeCurrency?: string;
}

export class SimpleBridge {
  private app: express.Application;
  private transactions: Map<string, TransactionRecord>;
  private stats: BridgeStats;
  private startTime: Date;

  constructor() {
    this.app = express();
    this.transactions = new Map();
    this.startTime = new Date();
    this.stats = {
      totalTransactions: 0,
      pendingTransactions: 0,
      completedTransactions: 0,
      failedTransactions: 0,
      uptime: 0,
      lastProcessed: new Date()
    };

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      next();
    });

    // Request logging
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
    this.app.get('/health', (req, res) => {
      const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
      res.json({
        status: 'healthy',
        uptime,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Get bridge statistics
    this.app.get('/stats', (req, res) => {
      this.updateStats();
      res.json(this.stats);
    });

    // Get all transactions
    this.app.get('/transactions', (req, res) => {
      const status = req.query.status as string;
      let transactions = Array.from(this.transactions.values());
      
      if (status) {
        transactions = transactions.filter(tx => tx.status === status);
      }

      res.json({
        transactions,
        total: transactions.length
      });
    });

    // Get specific transaction
    this.app.get('/transactions/:id', (req, res) => {
      const { id } = req.params;
      const transaction = this.transactions.get(id);
      
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      res.json(transaction);
    });

    // Simulate Solana → Lunes transfer
    this.app.post('/bridge/solana-to-lunes', (req, res) => {
      try {
        const { amount, sourceAddress, destinationAddress } = req.body;
        
        if (!amount || !sourceAddress || !destinationAddress) {
          return res.status(400).json({ 
            error: 'Missing required fields: amount, sourceAddress, destinationAddress' 
          });
        }

        const transactionId = this.generateTransactionId();
        // Determine optimal fee type and calculate fees
        const feeType = this.determineOptimalFeeType(parseFloat(amount), 'solana', sourceAddress);
        const fee = this.calculateFee(parseFloat(amount), feeType);

        const transaction: TransactionRecord = {
          id: transactionId,
          sourceChain: 'solana',
          destinationChain: 'lunes',
          amount: parseFloat(amount),
          sourceAddress,
          destinationAddress,
          status: 'pending',
          createdAt: new Date(),
          feeType,
          feeAmount: fee.amount,
          feeCurrency: fee.currency
        };

        this.transactions.set(transactionId, transaction);
        this.stats.totalTransactions++;
        this.stats.pendingTransactions++;

        logger.info('🌉 New Solana → Lunes bridge request', {
          transactionId,
          amount,
          sourceAddress,
          destinationAddress
        });

        // Simulate processing
        this.processTransaction(transactionId);

        res.status(201).json({
          transactionId,
          status: 'pending',
          message: 'Bridge transaction initiated'
        });
      } catch (error) {
        logger.error('Error creating Solana → Lunes transaction', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Simulate Lunes → Solana transfer
    this.app.post('/bridge/lunes-to-solana', (req, res) => {
      try {
        const { amount, sourceAddress, destinationAddress } = req.body;
        
        if (!amount || !sourceAddress || !destinationAddress) {
          return res.status(400).json({ 
            error: 'Missing required fields: amount, sourceAddress, destinationAddress' 
          });
        }

        const transactionId = this.generateTransactionId();
        // Determine optimal fee type and calculate fees
        const feeType = this.determineOptimalFeeType(parseFloat(amount), 'lunes', sourceAddress);
        const fee = this.calculateFee(parseFloat(amount), feeType);

        const transaction: TransactionRecord = {
          id: transactionId,
          sourceChain: 'lunes',
          destinationChain: 'solana',
          amount: parseFloat(amount),
          sourceAddress,
          destinationAddress,
          status: 'pending',
          createdAt: new Date(),
          feeType,
          feeAmount: fee.amount,
          feeCurrency: fee.currency
        };

        this.transactions.set(transactionId, transaction);
        this.stats.totalTransactions++;
        this.stats.pendingTransactions++;

        logger.info('🌉 New Lunes → Solana bridge request', {
          transactionId,
          amount,
          sourceAddress,
          destinationAddress
        });

        // Simulate processing
        this.processTransaction(transactionId);

        res.status(201).json({
          transactionId,
          status: 'pending',
          message: 'Bridge transaction initiated'
        });
      } catch (error) {
        logger.error('Error creating Lunes → Solana transaction', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine optimal fee type based on transaction and user context
   * Determinar tipo de taxa ótimo baseado no contexto da transação e usuário
   */
  private determineOptimalFeeType(
    amount: number, 
    sourceChain: 'solana' | 'lunes',
    userAddress: string
  ): 'lunes' | 'lusdt' | 'usdt' {
    // For Solana → Lunes: User has USDT, charge in USDT
    if (sourceChain === 'solana') {
      return 'usdt';
    }
    
    // For Lunes → Solana: More options available
    if (amount <= 100) {
      // Small transactions: prefer LUSDT (most convenient)
      return 'lusdt';
    } else if (amount <= 1000) {
      // Medium transactions: prefer LUNES (cheapest with caps)
      return 'lunes';
    } else {
      // Large transactions: prefer USDT via bridge (best rates)
      return 'usdt';
    }
  }

  /**
   * Calculate fee based on amount and type
   * Calcular taxa baseada no valor e tipo
   */
  private calculateFee(amount: number, feeType: 'lunes' | 'lusdt' | 'usdt'): { amount: number, currency: string } {
    const baseFeeRate = 0.005; // 0.5% base rate
    
    switch (feeType) {
      case 'usdt':
        // USDT fees: 0.1% (lowest rate, but only for bridge operations)
        return { amount: amount * 0.001, currency: 'USDT' };
      
      case 'lusdt':
        // LUSDT fees: 0.3% (convenient for users)
        return { amount: amount * 0.003, currency: 'LUSDT' };
      
      case 'lunes':
        // LUNES fees: 0.5% but with intelligent caps (most flexible)
        const feeInUsd = amount * baseFeeRate;
        // Simulate LUNES price of $1.00 for this example
        const lunesPrice = 1.0;
        let feeInLunes = feeInUsd / lunesPrice;
        
        // Apply intelligent caps
        if (amount <= 100) {
          feeInLunes = Math.min(feeInLunes, 0.5); // Max 0.5 LUNES
        } else if (amount <= 1000) {
          feeInLunes = Math.min(feeInLunes, 2.0); // Max 2 LUNES
        } else if (amount <= 10000) {
          feeInLunes = Math.min(feeInLunes, 10.0); // Max 10 LUNES
        } else {
          feeInLunes = Math.min(feeInLunes, 50.0); // Max 50 LUNES
        }
        
        return { amount: feeInLunes, currency: 'LUNES' };
      
      default:
        return { amount: 0, currency: 'UNKNOWN' };
    }
  }

  private async processTransaction(transactionId: string): Promise<void> {
    setTimeout(async () => {
      const transaction = this.transactions.get(transactionId);
      if (!transaction) return;

      try {
        // Update to processing
        transaction.status = 'processing';
        this.transactions.set(transactionId, transaction);

        logger.info(`⏳ Processing transaction ${transactionId}`);

        // Simulate processing time (2-5 seconds)
        const processingTime = Math.random() * 3000 + 2000;
        
        setTimeout(() => {
          // Simulate 95% success rate
          const success = Math.random() > 0.05;
          
          if (success) {
            transaction.status = 'completed';
            transaction.completedAt = new Date();
            this.stats.completedTransactions++;
            this.stats.pendingTransactions--;
            
            logger.info(`✅ Transaction ${transactionId} completed successfully`);
          } else {
            transaction.status = 'failed';
            transaction.completedAt = new Date();
            this.stats.failedTransactions++;
            this.stats.pendingTransactions--;
            
            logger.error(`❌ Transaction ${transactionId} failed`);
          }

          this.transactions.set(transactionId, transaction);
          this.stats.lastProcessed = new Date();
        }, processingTime);

      } catch (error) {
        transaction.status = 'failed';
        transaction.completedAt = new Date();
        this.stats.failedTransactions++;
        this.stats.pendingTransactions--;
        this.transactions.set(transactionId, transaction);
        
        logger.error(`❌ Transaction ${transactionId} processing error:`, { error });
      }
    }, 1000); // Initial delay
  }

  private updateStats(): void {
    this.stats.uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  public start(port: number = 3000): void {
    this.app.listen(port, () => {
      logger.info(`🌉 LUSDT Bridge Service started on port ${port}`);
      logger.info('📊 Available endpoints:');
      logger.info('  GET  /health - Health check');
      logger.info('  GET  /stats - Bridge statistics');
      logger.info('  GET  /transactions - List all transactions');
      logger.info('  GET  /transactions/:id - Get specific transaction');
      logger.info('  POST /bridge/solana-to-lunes - Initiate Solana → Lunes transfer');
      logger.info('  POST /bridge/lunes-to-solana - Initiate Lunes → Solana transfer');
    });
  }
}

// Start the bridge if this file is run directly
if (require.main === module) {
  const bridge = new SimpleBridge();
  const port = parseInt(process.env.PORT || '3000');
  bridge.start(port);
}