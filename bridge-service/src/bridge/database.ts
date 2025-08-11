import { logger } from '../utils/logger';
import { config } from '../config/env';

export interface TransactionRecord {
  id: string;
  sourceChain: 'solana' | 'lunes';
  destinationChain: 'solana' | 'lunes';
  sourceSignature: string;
  destinationSignature?: string;
  amount: number;
  sourceAddress: string;
  destinationAddress: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  retryCount: number;
  errorMessage?: string;
  metadata?: any;
}

export interface BridgeStatistics {
  totalTransactions: number;
  completedTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  totalVolumeUSDT: number;
  dailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
  averageProcessingTime: number;
}

export class Database {
  private transactions: Map<string, TransactionRecord>;
  private isInitialized: boolean = false;

  constructor() {
    this.transactions = new Map();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('💾 Initializing database...');
      
      // Para uma implementação real, você conectaria a um banco real (PostgreSQL, MongoDB, etc.)
      // Por enquanto, vamos usar um armazenamento em memória
      
      if (config.NODE_ENV === 'production') {
        logger.warn('⚠️  Using in-memory database in production - data will be lost on restart!');
        logger.warn('⚠️  Consider implementing persistent database connection');
      }

      // Aqui seria onde você configuraria:
      // - Pool de conexões PostgreSQL
      // - Configuração MongoDB
      // - Migrações de banco
      // - Índices necessários

      this.isInitialized = true;
      logger.info('✅ Database initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize database', error);
      throw error;
    }
  }

  async saveTransaction(transaction: Omit<TransactionRecord, 'id' | 'createdAt' | 'retryCount'>): Promise<string> {
    try {
      const id = this.generateTransactionId();
      const record: TransactionRecord = {
        ...transaction,
        id,
        createdAt: new Date(),
        retryCount: 0
      };

      this.transactions.set(id, record);
      
      logger.info('💾 Transaction saved', { 
        id, 
        sourceChain: transaction.sourceChain,
        destinationChain: transaction.destinationChain,
        amount: transaction.amount
      });

      return id;
    } catch (error) {
      logger.error('❌ Failed to save transaction', error);
      throw error;
    }
  }

  async updateTransaction(id: string, updates: Partial<TransactionRecord>): Promise<void> {
    try {
      const existing = this.transactions.get(id);
      if (!existing) {
        throw new Error(`Transaction ${id} not found`);
      }

      const updated = { 
        ...existing, 
        ...updates,
        // Se status mudou para completed, marca o timestamp
        ...(updates.status === 'completed' && !existing.completedAt ? { completedAt: new Date() } : {})
      };
      
      this.transactions.set(id, updated);
      
      logger.info('📝 Transaction updated', { 
        id, 
        status: updated.status,
        updates: Object.keys(updates)
      });
    } catch (error) {
      logger.error('❌ Failed to update transaction', { id, error });
      throw error;
    }
  }

  async getTransaction(id: string): Promise<TransactionRecord | null> {
    try {
      return this.transactions.get(id) || null;
    } catch (error) {
      logger.error('❌ Failed to get transaction', { id, error });
      throw error;
    }
  }

  async getTransactionBySignature(signature: string): Promise<TransactionRecord | null> {
    try {
      for (const transaction of this.transactions.values()) {
        if (transaction.sourceSignature === signature || 
            transaction.destinationSignature === signature) {
          return transaction;
        }
      }
      return null;
    } catch (error) {
      logger.error('❌ Failed to get transaction by signature', { signature, error });
      throw error;
    }
  }

  async getPendingTransactions(): Promise<TransactionRecord[]> {
    try {
      const pending = Array.from(this.transactions.values())
        .filter(tx => tx.status === 'pending' || tx.status === 'processing')
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      return pending;
    } catch (error) {
      logger.error('❌ Failed to get pending transactions', error);
      throw error;
    }
  }

  async getTransactionsByStatus(status: TransactionRecord['status']): Promise<TransactionRecord[]> {
    try {
      return Array.from(this.transactions.values())
        .filter(tx => tx.status === status)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      logger.error('❌ Failed to get transactions by status', { status, error });
      throw error;
    }
  }

  async getTransactionHistory(limit: number = 100, offset: number = 0): Promise<TransactionRecord[]> {
    try {
      const allTransactions = Array.from(this.transactions.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return allTransactions.slice(offset, offset + limit);
    } catch (error) {
      logger.error('❌ Failed to get transaction history', error);
      throw error;
    }
  }

  async getStatistics(): Promise<BridgeStatistics> {
    try {
      const allTransactions = Array.from(this.transactions.values());
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const completed = allTransactions.filter(tx => tx.status === 'completed');
      const pending = allTransactions.filter(tx => tx.status === 'pending' || tx.status === 'processing');
      const failed = allTransactions.filter(tx => tx.status === 'failed');

      const dailyTransactions = allTransactions.filter(tx => tx.createdAt >= dayAgo);
      const weeklyTransactions = allTransactions.filter(tx => tx.createdAt >= weekAgo);
      const monthlyTransactions = allTransactions.filter(tx => tx.createdAt >= monthAgo);

      // Calcula tempos de processamento
      const processingTimes = completed
        .filter(tx => tx.completedAt)
        .map(tx => tx.completedAt!.getTime() - tx.createdAt.getTime());
      
      const averageProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

      return {
        totalTransactions: allTransactions.length,
        completedTransactions: completed.length,
        pendingTransactions: pending.length,
        failedTransactions: failed.length,
        totalVolumeUSDT: allTransactions.reduce((sum, tx) => sum + tx.amount, 0),
        dailyVolume: dailyTransactions.reduce((sum, tx) => sum + tx.amount, 0),
        weeklyVolume: weeklyTransactions.reduce((sum, tx) => sum + tx.amount, 0),
        monthlyVolume: monthlyTransactions.reduce((sum, tx) => sum + tx.amount, 0),
        averageProcessingTime: Math.round(averageProcessingTime / 1000) // em segundos
      };
    } catch (error) {
      logger.error('❌ Failed to get statistics', error);
      throw error;
    }
  }

  async incrementRetryCount(id: string): Promise<void> {
    try {
      const transaction = this.transactions.get(id);
      if (!transaction) {
        throw new Error(`Transaction ${id} not found`);
      }

      transaction.retryCount += 1;
      this.transactions.set(id, transaction);

      logger.info('🔄 Transaction retry count incremented', { 
        id, 
        retryCount: transaction.retryCount 
      });
    } catch (error) {
      logger.error('❌ Failed to increment retry count', { id, error });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 dias

      let cleaned = 0;
      for (const [id, transaction] of this.transactions.entries()) {
        // Remove transações antigas que foram completadas ou falharam
        if ((transaction.status === 'completed' || transaction.status === 'failed') &&
            transaction.createdAt < cutoff) {
          this.transactions.delete(id);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`🧹 Cleaned up ${cleaned} old transactions`);
      }
    } catch (error) {
      logger.error('❌ Failed to cleanup database', error);
    }
  }

  async close(): Promise<void> {
    try {
      // Para uma implementação real, você fecharia as conexões do banco
      logger.info('📴 Database connections closed');
    } catch (error) {
      logger.error('❌ Failed to close database', error);
      throw error;
    }
  }

  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `tx_${timestamp}_${random}`;
  }

  // Métodos para debugging/monitoring
  async getHealthStatus(): Promise<any> {
    return {
      isConnected: this.isInitialized,
      totalRecords: this.transactions.size,
      lastUpdate: new Date().toISOString()
    };
  }
}