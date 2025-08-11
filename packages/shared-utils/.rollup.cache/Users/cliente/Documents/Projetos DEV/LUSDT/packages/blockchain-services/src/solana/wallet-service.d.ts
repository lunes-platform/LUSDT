import { Transaction } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { SolanaWallet, TransactionResult } from '../types';
export type SolanaWalletType = 'phantom' | 'solflare' | 'sollet' | 'ledger';
export interface SolanaWalletServiceConfig {
    rpcEndpoint: string;
    commitment?: 'processed' | 'confirmed' | 'finalized';
}
/**
 * Serviço para gerenciar conexões de carteira Solana
 * Suporta múltiplos tipos de carteira com interface unificada
 */
export declare class SolanaWalletService {
    private config;
    private connection;
    private currentWallet;
    private availableWallets;
    constructor(config: SolanaWalletServiceConfig);
    /**
     * Registra um adaptador de carteira
     */
    registerWallet(type: SolanaWalletType, adapter: WalletAdapter): void;
    /**
     * Lista carteiras disponíveis
     */
    getAvailableWallets(): Array<{
        type: SolanaWalletType;
        name: string;
        icon?: string;
        installed: boolean;
    }>;
    /**
     * Conecta a uma carteira específica
     */
    connect(walletType: SolanaWalletType): Promise<SolanaWallet>;
    /**
     * Desconecta a carteira atual
     */
    disconnect(): Promise<void>;
    /**
     * Obtém a carteira conectada atual
     */
    getCurrentWallet(): SolanaWallet | null;
    /**
     * Verifica se há uma carteira conectada
     */
    isConnected(): boolean;
    /**
     * Obtém o saldo de SOL da carteira conectada
     */
    getSolBalance(): Promise<number>;
    /**
     * Envia uma transação
     */
    sendTransaction(transaction: Transaction): Promise<TransactionResult>;
    /**
     * Assina uma mensagem
     */
    signMessage(message: string): Promise<string>;
    /**
     * Obtém informações da rede
     */
    getNetworkInfo(): Promise<{
        slot: number;
        blockTime: Date | null;
        version: string;
    }>;
    /**
     * Monitora mudanças na conta
     */
    subscribeToAccountChanges(callback: (balance: number) => void): number | null;
    /**
     * Remove subscription de mudanças na conta
     */
    unsubscribeFromAccountChanges(subscriptionId: number): void;
}
//# sourceMappingURL=wallet-service.d.ts.map