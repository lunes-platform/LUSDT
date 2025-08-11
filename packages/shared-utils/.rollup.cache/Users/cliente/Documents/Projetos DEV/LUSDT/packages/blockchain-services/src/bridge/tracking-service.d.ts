import { BridgeTransaction } from '../types';
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
export declare class TransactionTrackingService {
    private config;
    private activeTracking;
    private statusCallbacks;
    constructor(config: TrackingServiceConfig);
    /**
     * Inicia o rastreamento de uma transação
     */
    startTracking(transactionId: string, onStatusUpdate: (update: TransactionStatusUpdate) => void): void;
    /**
     * Para o rastreamento de uma transação
     */
    stopTracking(transactionId: string): void;
    /**
     * Para todos os rastreamentos ativos
     */
    stopAllTracking(): void;
    /**
     * Obtém o status atual de uma transação
     */
    getTransactionStatus(transactionId: string): Promise<BridgeTransaction>;
    /**
     * Obtém histórico de transações do usuário
     */
    getUserTransactionHistory(userAddress: string, limit?: number, offset?: number): Promise<BridgeTransaction[]>;
    /**
     * Busca transações por filtros
     */
    searchTransactions(filters: {
        user?: string;
        type?: 'deposit' | 'redemption';
        status?: BridgeTransaction['status'];
        dateFrom?: Date;
        dateTo?: Date;
        limit?: number;
        offset?: number;
    }): Promise<BridgeTransaction[]>;
    /**
     * Obtém estatísticas de transações
     */
    getTransactionStats(userAddress?: string): Promise<{
        totalTransactions: number;
        totalVolume: number;
        successRate: number;
        averageProcessingTime: number;
        byStatus: Record<BridgeTransaction['status'], number>;
        byType: Record<BridgeTransaction['type'], number>;
    }>;
    /**
     * Verifica se uma transação está sendo rastreada
     */
    isTracking(transactionId: string): boolean;
    /**
     * Obtém lista de transações sendo rastreadas
     */
    getActiveTrackingList(): string[];
    /**
     * Verifica o status de uma transação e notifica callbacks
     */
    private checkTransactionStatus;
    /**
     * Cria um WebSocket para atualizações em tempo real (se disponível)
     */
    createRealtimeConnection(transactionId: string, onUpdate: (update: TransactionStatusUpdate) => void): WebSocket | null;
}
//# sourceMappingURL=tracking-service.d.ts.map