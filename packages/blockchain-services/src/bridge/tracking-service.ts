import { BridgeTransaction, TransactionError } from '../types';

export interface TrackingServiceConfig {
  bridgeServiceUrl: string;
  pollingInterval: number;
}

export interface TransactionStatusUpdate {
  transactionId: string;
  status: BridgeTransaction['status'];
  timestamp: Date;
  details?: any;
}

/**
 * Serviço para rastreamento de transações bridge
 */
export class TransactionTrackingService {
  private activeTracking: Map<string, NodeJS.Timeout> = new Map();
  private statusCallbacks: Map<string, (update: TransactionStatusUpdate) => void> = new Map();

  constructor(private config: TrackingServiceConfig) {}

  /**
   * Inicia o rastreamento de uma transação
   */
  startTracking(
    transactionId: string,
    onStatusUpdate: (update: TransactionStatusUpdate) => void
  ): void {
    // Stop existing tracking if any
    this.stopTracking(transactionId);

    // Store callback
    this.statusCallbacks.set(transactionId, onStatusUpdate);

    // Start polling
    const intervalId = setInterval(async () => {
      try {
        await this.checkTransactionStatus(transactionId);
      } catch (error) {
        console.error(`Error tracking transaction ${transactionId}:`, error);
        // Continue tracking despite errors
      }
    }, this.config.pollingInterval);

    this.activeTracking.set(transactionId, intervalId);

    // Initial status check
    this.checkTransactionStatus(transactionId);
  }

  /**
   * Para o rastreamento de uma transação
   */
  stopTracking(transactionId: string): void {
    const intervalId = this.activeTracking.get(transactionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activeTracking.delete(transactionId);
    }
    this.statusCallbacks.delete(transactionId);
  }

  /**
   * Para todos os rastreamentos ativos
   */
  stopAllTracking(): void {
    for (const [transactionId] of this.activeTracking) {
      this.stopTracking(transactionId);
    }
  }

  /**
   * Obtém o status atual de uma transação
   */
  async getTransactionStatus(transactionId: string): Promise<BridgeTransaction> {
    try {
      const response = await fetch(
        `${this.config.bridgeServiceUrl}/transactions/${transactionId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const transaction = await response.json();
      return transaction;
    } catch (error) {
      throw new TransactionError(
        `Failed to get transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STATUS_FETCH_FAILED'
      );
    }
  }

  /**
   * Obtém histórico de transações do usuário
   */
  async getUserTransactionHistory(
    userAddress: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<BridgeTransaction[]> {
    try {
      const response = await fetch(
        `${this.config.bridgeServiceUrl}/transactions?user=${userAddress}&limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const transactions = await response.json();
      return transactions;
    } catch (error) {
      throw new TransactionError(
        `Failed to get transaction history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'HISTORY_FETCH_FAILED'
      );
    }
  }

  /**
   * Busca transações por filtros
   */
  async searchTransactions(filters: {
    user?: string;
    type?: 'deposit' | 'redemption';
    status?: BridgeTransaction['status'];
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<BridgeTransaction[]> {
    try {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (value instanceof Date) {
            params.append(key, value.toISOString());
          } else {
            params.append(key, value.toString());
          }
        }
      });

      const response = await fetch(
        `${this.config.bridgeServiceUrl}/transactions/search?${params}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const transactions = await response.json();
      return transactions;
    } catch (error) {
      throw new TransactionError(
        `Failed to search transactions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEARCH_FAILED'
      );
    }
  }

  /**
   * Obtém estatísticas de transações
   */
  async getTransactionStats(userAddress?: string): Promise<{
    totalTransactions: number;
    totalVolume: number;
    successRate: number;
    averageProcessingTime: number;
    byStatus: Record<BridgeTransaction['status'], number>;
    byType: Record<BridgeTransaction['type'], number>;
  }> {
    try {
      const url = userAddress 
        ? `${this.config.bridgeServiceUrl}/transactions/stats?user=${userAddress}`
        : `${this.config.bridgeServiceUrl}/transactions/stats`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const stats = await response.json();
      return stats;
    } catch (error) {
      throw new TransactionError(
        `Failed to get transaction stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STATS_FETCH_FAILED'
      );
    }
  }

  /**
   * Verifica se uma transação está sendo rastreada
   */
  isTracking(transactionId: string): boolean {
    return this.activeTracking.has(transactionId);
  }

  /**
   * Obtém lista de transações sendo rastreadas
   */
  getActiveTrackingList(): string[] {
    return Array.from(this.activeTracking.keys());
  }

  /**
   * Verifica o status de uma transação e notifica callbacks
   */
  private async checkTransactionStatus(transactionId: string): Promise<void> {
    try {
      const transaction = await this.getTransactionStatus(transactionId);
      const callback = this.statusCallbacks.get(transactionId);

      if (callback) {
        const update: TransactionStatusUpdate = {
          transactionId,
          status: transaction.status,
          timestamp: new Date(),
          details: transaction
        };

        callback(update);

        // Stop tracking if transaction is completed or failed
        if (transaction.status === 'completed' || transaction.status === 'failed') {
          this.stopTracking(transactionId);
        }
      }
    } catch (error) {
      // Log error but don't stop tracking
      console.error(`Failed to check status for transaction ${transactionId}:`, error);
    }
  }

  /**
   * Cria um WebSocket para atualizações em tempo real (se disponível)
   */
  createRealtimeConnection(
    transactionId: string,
    onUpdate: (update: TransactionStatusUpdate) => void
  ): WebSocket | null {
    try {
      const wsUrl = this.config.bridgeServiceUrl.replace(/^http/, 'ws');
      const ws = new WebSocket(`${wsUrl}/transactions/${transactionId}/stream`);

      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          onUpdate(update);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
      };

      return ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      return null;
    }
  }
}