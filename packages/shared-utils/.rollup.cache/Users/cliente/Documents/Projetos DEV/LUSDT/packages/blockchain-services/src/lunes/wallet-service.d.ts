import { ApiPromise } from '@polkadot/api';
import { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { LunesWallet, TransactionResult, NetworkStatus } from '../types';
export interface LunesWalletServiceConfig {
    wsEndpoint: string;
    appName: string;
}
/**
 * Serviço para gerenciar conexões de carteira Lunes/Polkadot
 */
export declare class LunesWalletService {
    private config;
    private api;
    private currentWallet;
    private availableAccounts;
    constructor(config: LunesWalletServiceConfig);
    /**
     * Inicializa a conexão com a rede Lunes
     */
    initialize(): Promise<void>;
    /**
     * Habilita extensões de carteira e obtém contas disponíveis
     */
    enableWalletExtensions(): Promise<InjectedAccountWithMeta[]>;
    /**
     * Conecta a uma conta específica
     */
    connect(accountAddress: string): Promise<LunesWallet>;
    /**
     * Desconecta a carteira atual
     */
    disconnect(): Promise<void>;
    /**
     * Obtém a carteira conectada atual
     */
    getCurrentWallet(): LunesWallet | null;
    /**
     * Verifica se há uma carteira conectada
     */
    isConnected(): boolean;
    /**
     * Obtém contas disponíveis
     */
    getAvailableAccounts(): InjectedAccountWithMeta[];
    /**
     * Obtém o saldo nativo da conta conectada
     */
    getNativeBalance(): Promise<number>;
    /**
     * Transfere tokens nativos
     */
    transferNative(to: string, amount: number): Promise<TransactionResult>;
    /**
     * Assina uma mensagem
     */
    signMessage(message: string): Promise<string>;
    /**
     * Obtém informações da rede
     */
    getNetworkInfo(): Promise<NetworkStatus>;
    /**
     * Monitora mudanças na conta
     */
    subscribeToAccountChanges(callback: (balance: number) => void): Promise<() => void> | null;
    /**
     * Obtém a API Polkadot
     */
    getApi(): ApiPromise | null;
    /**
     * Desconecta da rede
     */
    disconnect_network(): Promise<void>;
}
//# sourceMappingURL=wallet-service.d.ts.map