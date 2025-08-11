import { Connection } from '@solana/web3.js';
import { SolanaWalletService } from './wallet-service';
import { TokenBalance, TransactionResult } from '../types';
export interface TokenTransferParams {
    mint: string;
    to: string;
    amount: number;
    memo?: string;
}
/**
 * Serviço para operações com tokens SPL na Solana
 */
export declare class SolanaTokenService {
    private connection;
    private walletService;
    constructor(connection: Connection, walletService: SolanaWalletService);
    /**
     * Obtém o saldo de um token específico
     */
    getTokenBalance(mint: string): Promise<TokenBalance | null>;
    /**
     * Obtém todos os saldos de tokens da carteira
     */
    getAllTokenBalances(): Promise<TokenBalance[]>;
    /**
     * Transfere tokens SPL
     */
    transferToken(params: TokenTransferParams): Promise<TransactionResult>;
    /**
     * Transfere SOL nativo
     */
    transferSol(to: string, amount: number, memo?: string): Promise<TransactionResult>;
    /**
     * Verifica se uma conta de token existe
     */
    tokenAccountExists(mint: string, owner: string): Promise<boolean>;
    /**
     * Obtém informações de um mint de token
     */
    getMintInfo(mint: string): Promise<{
        mint: string;
        decimals: any;
        supply: any;
        mintAuthority: any;
        freezeAuthority: any;
        isInitialized: any;
    }>;
}
//# sourceMappingURL=token-service.d.ts.map