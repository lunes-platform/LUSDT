// API Client para comunicação com Bridge Service
// API Client for Bridge Service communication
import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Transaction record interface / Interface de registro de transação
 */
export interface TransactionRecord {
  id: string;
  sourceChain: 'solana' | 'lunes';
  destinationChain: 'solana' | 'lunes';
  amount: number;
  sourceAddress: string;
  destinationAddress: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  feeType?: 'lunes' | 'lusdt' | 'usdt';
  feeAmount?: number;
  feeCurrency?: string;
  txHash?: string;
}

/**
 * Bridge statistics interface / Interface de estatísticas da ponte
 */
export interface BridgeStats {
  totalTransactions: number;
  pendingTransactions: number;
  completedTransactions: number;
  failedTransactions: number;
  uptime: number;
  lastProcessed: string;
  totalVolume?: string;
  successRate?: number;
}

/**
 * Health check response / Resposta de verificação de saúde
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  timestamp: string;
  version: string;
}

/**
 * Fee calculation response / Resposta de cálculo de taxa
 */
export interface FeeCalculation {
  feeType: 'lunes' | 'lusdt' | 'usdt';
  feeAmount: number;
  feeCurrency: string;
  feePercentage: number;
  totalAmount: number;
  netAmount: number;
}

/**
 * Bridge transaction request / Requisição de transação de ponte
 */
export interface BridgeTransactionRequest {
  sourceChain: 'solana' | 'lunes';
  destinationChain: 'solana' | 'lunes';
  amount: string;
  sourceAddress: string;
  destinationAddress: string;
  feeType?: 'lunes' | 'lusdt' | 'usdt';
  sourceSignature?: string;
}

/**
 * Bridge transaction response / Resposta de transação de ponte
 */
export interface BridgeTransactionResponse {
  transactionId: string;
  status: 'pending' | 'processing';
  estimatedCompletionTime: number;
  message?: string;
}

/**
 * Admin update request / Requisição de atualização administrativa
 */
export interface AdminUpdateRequest {
  action: 'pause' | 'unpause' | 'updateLunesPrice' | 'updateFeeConfig' | 'updateWallets';
  adminAddress: string;
  signature?: string;
  data?: any;
}

/**
 * LUSDT Bridge API Client
 * Cliente de API da Ponte LUSDT
 */
function getDefaultBridgeApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_BRIDGE_API_URL;

  // If an explicit non-local URL is provided, always honor it.
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // In browser runtime, prefer deriving from the current host when running outside localhost.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const origin = window.location.origin;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';

    if (!isLocalHost) {
      // If the app is served over HTTPS, the API must also be HTTPS to avoid mixed-content.
      // Prefer proxying the backend under the same origin.
      if (protocol === 'https:') {
        return `${origin}/api`;
      }

      return `http://${host}:3100`;
    }
  }

  // Local development fallback.
  return envUrl || 'http://localhost:3001';
}

class BridgeAPIClient {
  private baseURL: string;

  constructor(baseURL: string = getDefaultBridgeApiBaseUrl()) {
    this.baseURL = baseURL;
  }

  /**
   * Generic request handler / Manipulador de requisições genérico
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network request failed');
    }
  }

  // ==================== HEALTH & STATUS ====================

  /**
   * Health check / Verificação de saúde
   */
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  /**
   * Bridge statistics / Estatísticas da ponte
   */
  async getStatistics(): Promise<BridgeStats> {
    return this.request<BridgeStats>('/stats');
  }

  /**
   * Get bridge configuration / Obter configuração da ponte
   */
  async getBridgeConfig(): Promise<BridgeConfig> {
    return this.request<BridgeConfig>('/bridge/config');
  }

  /**
   * Get reserve data / Obter dados de reservas
   */
  async getReserves(): Promise<ReserveDataResponse> {
    return this.request<ReserveDataResponse>('/bridge/reserves');
  }

  // ==================== TRANSACTIONS ====================

  /**
   * Get all transactions / Obter todas as transações
   */
  async getTransactions(status?: 'pending' | 'processing' | 'completed' | 'failed'): Promise<{
    transactions: TransactionRecord[];
    total: number;
  }> {
    const endpoint = status ? `/transactions?status=${status}` : '/transactions';
    return this.request(endpoint);
  }

  /**
   * Get recent transactions / Obter transações recentes
   */
  async getRecentTransactions(limit: number = 10): Promise<TransactionRecord[]> {
    const result = await this.getTransactions();
    return result.transactions.slice(0, limit);
  }

  /**
   * Get specific transaction / Obter transação específica
   */
  async getTransaction(id: string): Promise<TransactionRecord> {
    return this.request<TransactionRecord>(`/transactions/${id}`);
  }

  /**
   * Get user transactions / Obter transações do usuário
   */
  async getUserTransactions(address: string): Promise<TransactionRecord[]> {
    const result = await this.getTransactions();
    return result.transactions.filter(
      tx => tx.sourceAddress === address || tx.destinationAddress === address
    );
  }

  // ==================== BRIDGE OPERATIONS ====================

  /**
   * Calculate fee for transaction / Calcular taxa para transação
   */
  async calculateFee(
    amount: number,
    sourceChain: 'solana' | 'lunes',
    feeType?: 'lunes' | 'lusdt' | 'usdt'
  ): Promise<FeeCalculation> {
    return this.request<FeeCalculation>('/bridge/calculate-fee', {
      method: 'POST',
      body: JSON.stringify({ amount, sourceChain, feeType }),
    });
  }

  /**
   * Solana → Lunes transfer / Transferência Solana → Lunes
   */
  async bridgeSolanaToLunes(data: {
    amount: string;
    sourceAddress: string;
    destinationAddress: string;
    feeType?: 'lunes' | 'lusdt' | 'usdt';
  }): Promise<BridgeTransactionResponse> {
    return this.request<BridgeTransactionResponse>('/bridge/solana-to-lunes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Lunes → Solana transfer / Transferência Lunes → Solana
   */
  async bridgeLunesToSolana(data: {
    amount: string;
    sourceAddress: string;
    destinationAddress: string;
    feeType?: 'lunes' | 'lusdt' | 'usdt';
  }): Promise<BridgeTransactionResponse> {
    return this.request<BridgeTransactionResponse>('/bridge/lunes-to-solana', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Generic bridge transaction / Transação de ponte genérica
   */
  async createBridgeTransaction(data: BridgeTransactionRequest): Promise<BridgeTransactionResponse> {
    if (data.sourceChain === 'solana' && data.destinationChain === 'lunes') {
      return this.bridgeSolanaToLunes(data);
    } else if (data.sourceChain === 'lunes' && data.destinationChain === 'solana') {
      return this.bridgeLunesToSolana(data);
    }
    throw new Error('Invalid bridge direction');
  }

  // ==================== ADMIN OPERATIONS ====================

  /**
   * Admin: Pause contract / Admin: Pausar contrato
   */
  async adminPauseContract(adminAddress: string, reason: string): Promise<{ success: boolean; message: string }> {
    return this.request('/admin/pause', {
      method: 'POST',
      body: JSON.stringify({ adminAddress, reason }),
    });
  }

  /**
   * Admin: Unpause contract / Admin: Despausar contrato
   */
  async adminUnpauseContract(adminAddress: string): Promise<{ success: boolean; message: string }> {
    return this.request('/admin/unpause', {
      method: 'POST',
      body: JSON.stringify({ adminAddress }),
    });
  }

  /**
   * Admin: Update LUNES price / Admin: Atualizar preço LUNES
   */
  async adminUpdateLunesPrice(adminAddress: string, newPrice: number): Promise<{ success: boolean; message: string }> {
    return this.request('/admin/update-lunes-price', {
      method: 'POST',
      body: JSON.stringify({ adminAddress, newPrice }),
    });
  }

  /**
   * Admin: Update fee configuration / Admin: Atualizar configuração de taxas
   */
  async adminUpdateFeeConfig(adminAddress: string, config: {
    lowVolumeFee: number;
    mediumVolumeFee: number;
    highVolumeFee: number;
  }): Promise<{ success: boolean; message: string }> {
    return this.request('/admin/update-fee-config', {
      method: 'POST',
      body: JSON.stringify({ adminAddress, config }),
    });
  }

  /**
   * Admin: Get contract status / Admin: Obter status do contrato
   */
  async adminGetContractStatus(): Promise<{
    isPaused: boolean;
    pauseReason?: string;
    lunesPrice: number;
    monthlyVolume: number;
    totalSupply: number;
  }> {
    return this.request('/admin/contract-status');
  }

  // ==================== WEBHOOKS & NOTIFICATIONS ====================

  /**
   * Send webhook notification / Enviar notificação via webhook
   */
  async sendWebhookNotification(type: string, data: any): Promise<{ received: boolean }> {
    return this.request('/webhook/notification', {
      method: 'POST',
      body: JSON.stringify({ type, data, timestamp: new Date().toISOString() }),
    });
  }
}

/**
 * React hook for Bridge API
 * Hook React para API da Ponte
 */
export function useBridgeAPI() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = useMemo(() => new BridgeAPIClient(), []);

  // Health check periódico / Periodic health check
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await client.getHealth();
        setIsConnected(true);
        setError(null);
      } catch (err) {
        setIsConnected(false);
        setError(err instanceof Error ? err.message : 'Connection failed');
      } finally {
        setIsLoading(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Every 30s

    return () => clearInterval(interval);
  }, [client]);

  return {
    client,
    isConnected,
    error,
    isLoading,
  };
}

/**
 * Hook for polling a specific transaction until completion.
 * Must be called at the top-level of a React component or custom hook.
 */
export function useTransactionPolling(
  client: BridgeAPIClient,
  transactionId: string | null,
  onUpdate: (tx: TransactionRecord) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled || !transactionId) return;

    let isMounted = true;

    const pollTransaction = async () => {
      try {
        const transaction = await client.getTransaction(transactionId);
        if (!isMounted) return true;

        onUpdate(transaction);

        return transaction.status === 'completed' || transaction.status === 'failed';
      } catch (err) {
        console.error('Error polling transaction:', err);
        return false;
      }
    };

    const interval = setInterval(async () => {
      const shouldStop = await pollTransaction();
      if (shouldStop) clearInterval(interval);
    }, 5000);

    pollTransaction();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [client, enabled, transactionId, onUpdate]);
}
