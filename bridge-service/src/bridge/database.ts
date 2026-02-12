import { Pool, QueryResult } from 'pg';
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
  private pool: Pool;
  private isInitialized: boolean = false;

  constructor() {
    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
      ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('💾 Initializing database connection...');
      
      // Test connection
      const client = await this.pool.connect();
      try {
        await client.query('SELECT NOW()');
        this.isInitialized = true;
        logger.info('✅ Database connected successfully');
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('❌ Failed to initialize database', error as Error);
      throw error;
    }
  }

  private mapRowToTransaction(row: any): TransactionRecord {
    return {
      id: row.id,
      sourceChain: row.source_chain,
      destinationChain: row.destination_chain,
      sourceSignature: row.source_signature,
      destinationSignature: row.destination_signature,
      amount: parseFloat(row.amount),
      sourceAddress: row.source_address,
      destinationAddress: row.destination_address,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      retryCount: row.retry_count,
      errorMessage: row.error_message,
      metadata: row.metadata
    };
  }

  async saveTransaction(transaction: Omit<TransactionRecord, 'id' | 'createdAt' | 'retryCount'>): Promise<string> {
    try {
      const id = this.generateTransactionId();
      
      const query = `
        INSERT INTO transactions (
          id, source_chain, destination_chain, source_signature, 
          destination_signature, amount, source_address, destination_address, 
          status, created_at, retry_count, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 0, $10)
        RETURNING id
      `;

      const values = [
        id,
        transaction.sourceChain,
        transaction.destinationChain,
        transaction.sourceSignature,
        transaction.destinationSignature || null,
        transaction.amount,
        transaction.sourceAddress,
        transaction.destinationAddress,
        transaction.status,
        transaction.metadata || {}
      ];

      await this.pool.query(query, values);
      
      logger.info('💾 Transaction saved to DB', { 
        id, 
        sourceChain: transaction.sourceChain,
        amount: transaction.amount 
      });

      return id;
    } catch (error) {
      logger.error('❌ Failed to save transaction', error as Error);
      throw error;
    }
  }

  async updateTransaction(id: string, updates: Partial<TransactionRecord>): Promise<void> {
    try {
      // Build dynamic update query
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Helper to add field
      const addField = (col: string, val: any) => {
        setClauses.push(`${col} = $${paramIndex++}`);
        values.push(val);
      };

      if (updates.status) addField('status', updates.status);
      if (updates.destinationSignature) addField('destination_signature', updates.destinationSignature);
      if (updates.errorMessage) addField('error_message', updates.errorMessage);
      if (updates.metadata) addField('metadata', updates.metadata);
      
      // Handle completion timestamp
      if (updates.status === 'completed') {
        setClauses.push(`completed_at = COALESCE(completed_at, NOW())`);
      }

      if (setClauses.length === 0) return;

      values.push(id);
      const query = `
        UPDATE transactions 
        SET ${setClauses.join(', ')} 
        WHERE id = $${paramIndex}
      `;

      const result = await this.pool.query(query, values);

      if (result.rowCount === 0) {
        throw new Error(`Transaction ${id} not found`);
      }
      
      logger.info('📝 Transaction updated in DB', { id, updates: Object.keys(updates) });
    } catch (error) {
      logger.error('❌ Failed to update transaction', { id, error });
      throw error;
    }
  }

  async getTransaction(id: string): Promise<TransactionRecord | null> {
    try {
      const result = await this.pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
      
      if (result.rows.length === 0) return null;
      return this.mapRowToTransaction(result.rows[0]);
    } catch (error) {
      logger.error('❌ Failed to get transaction', { id, error });
      throw error;
    }
  }

  async getTransactionBySignature(signature: string): Promise<TransactionRecord | null> {
    try {
      const query = `
        SELECT * FROM transactions 
        WHERE source_signature = $1 OR destination_signature = $1
        LIMIT 1
      `;
      const result = await this.pool.query(query, [signature]);
      
      if (result.rows.length === 0) return null;
      return this.mapRowToTransaction(result.rows[0]);
    } catch (error) {
      logger.error('❌ Failed to get transaction by signature', { signature, error });
      throw error;
    }
  }

  async getPendingTransactions(): Promise<TransactionRecord[]> {
    try {
      const query = `
        SELECT * FROM transactions 
        WHERE status IN ('pending', 'processing')
        ORDER BY created_at ASC
      `;
      const result = await this.pool.query(query);
      return result.rows.map(this.mapRowToTransaction);
    } catch (error) {
      logger.error('❌ Failed to get pending transactions', error as Error);
      throw error;
    }
  }

  async getTransactionsByStatus(status: TransactionRecord['status']): Promise<TransactionRecord[]> {
    try {
      const query = `
        SELECT * FROM transactions 
        WHERE status = $1
        ORDER BY created_at DESC
      `;
      const result = await this.pool.query(query, [status]);
      return result.rows.map(this.mapRowToTransaction);
    } catch (error) {
      logger.error('❌ Failed to get transactions by status', { status, error });
      throw error;
    }
  }

  async getTransactionHistory(limit: number = 100, offset: number = 0): Promise<TransactionRecord[]> {
    try {
      const query = `
        SELECT * FROM transactions 
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      const result = await this.pool.query(query, [limit, offset]);
      return result.rows.map(this.mapRowToTransaction);
    } catch (error) {
      logger.error('❌ Failed to get transaction history', error as Error);
      throw error;
    }
  }

  async getStatistics(): Promise<BridgeStatistics> {
    try {
      // Using the VIEW created in schema.sql would be more efficient, 
      // but we'll use direct queries to be safe if view doesn't exist yet
      const query = `
        SELECT
          COUNT(*) as total_transactions,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_transactions,
          COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) as pending_transactions,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_transactions,
          COALESCE(SUM(amount), 0) as total_volume,
          COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'), 0) as daily_volume,
          COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0) as weekly_volume,
          COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) as monthly_volume
        FROM transactions
      `;

      const result = await this.pool.query(query);
      const row = result.rows[0];

      // Calculate average processing time separately
      const timeQuery = `
        SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_time
        FROM transactions
        WHERE status = 'completed' AND completed_at IS NOT NULL
      `;
      const timeResult = await this.pool.query(timeQuery);
      
      return {
        totalTransactions: parseInt(row.total_transactions),
        completedTransactions: parseInt(row.completed_transactions),
        pendingTransactions: parseInt(row.pending_transactions),
        failedTransactions: parseInt(row.failed_transactions),
        totalVolumeUSDT: parseFloat(row.total_volume),
        dailyVolume: parseFloat(row.daily_volume),
        weeklyVolume: parseFloat(row.weekly_volume),
        monthlyVolume: parseFloat(row.monthly_volume),
        averageProcessingTime: Math.round(parseFloat(timeResult.rows[0].avg_time || '0'))
      };
    } catch (error) {
      logger.error('❌ Failed to get statistics', error as Error);
      throw error;
    }
  }

  async incrementRetryCount(id: string): Promise<void> {
    try {
      const query = `
        UPDATE transactions 
        SET retry_count = retry_count + 1 
        WHERE id = $1
      `;
      await this.pool.query(query, [id]);
    } catch (error) {
      logger.error('❌ Failed to increment retry count', { id, error });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Archive or delete old completed/failed transactions (> 30 days)
      const query = `
        DELETE FROM transactions 
        WHERE status IN ('completed', 'failed') 
        AND created_at < NOW() - INTERVAL '30 days'
      `;
      const result = await this.pool.query(query);
      
      if (result.rowCount && result.rowCount > 0) {
        logger.info(`🧹 Cleaned up ${result.rowCount} old transactions`);
      }
    } catch (error) {
      logger.error('❌ Failed to cleanup database', error as Error);
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('📴 Database connections closed');
    } catch (error) {
      logger.error('❌ Failed to close database', error as Error);
      throw error;
    }
  }

  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `tx_${timestamp}_${random}`;
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.pool.query('SELECT COUNT(*) as count FROM transactions');
      return {
        isConnected: this.isInitialized,
        totalRecords: parseInt(result.rows[0].count),
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      return {
        isConnected: false,
        error: (error as Error).message
      };
    }
  }
}
