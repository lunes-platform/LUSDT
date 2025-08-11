import { SolanaTokenService } from '../solana/token-service';
import { LunesContractService } from '../lunes/contract-service';
import { DepositParams, BridgeTransaction } from '../types';
export interface DepositServiceConfig {
    usdtMint: string;
    treasuryAddress: string;
    bridgeServiceUrl: string;
    confirmationsRequired: number;
}
/**
 * Serviço para gerenciar depósitos USDT → LUSDT
 */
export declare class DepositService {
    private solanaTokenService;
    private lunesContractService;
    private config;
    constructor(solanaTokenService: SolanaTokenService, lunesContractService: LunesContractService, config: DepositServiceConfig);
    /**
     * Inicia um depósito USDT para LUSDT
     */
    initiateDeposit(params: DepositParams): Promise<BridgeTransaction>;
    /**
     * Verifica o status de um depósito
     */
    checkDepositStatus(transactionId: string): Promise<BridgeTransaction>;
    /**
     * Lista depósitos do usuário
     */
    getUserDeposits(userAddress: string): Promise<BridgeTransaction[]>;
    /**
     * Calcula a taxa de depósito
     */
    calculateDepositFee(amount: number): Promise<number>;
    /**
     * Monitora um depósito até a conclusão
     */
    monitorDeposit(transactionId: string, onStatusUpdate: (transaction: BridgeTransaction) => void): Promise<BridgeTransaction>;
    /**
     * Valida parâmetros de depósito
     */
    private validateDepositParams;
    /**
     * Cria memo para o depósito
     */
    private createDepositMemo;
    /**
     * Gera ID único para transação
     */
    private generateTransactionId;
    /**
     * Notifica o serviço de bridge sobre o depósito
     */
    private notifyBridgeService;
}
//# sourceMappingURL=deposit-service.d.ts.map