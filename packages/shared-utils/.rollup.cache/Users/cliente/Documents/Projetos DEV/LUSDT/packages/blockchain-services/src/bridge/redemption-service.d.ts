import { LunesContractService } from '../lunes/contract-service';
import { SolanaTokenService } from '../solana/token-service';
import { RedemptionParams, BridgeTransaction } from '../types';
export interface RedemptionServiceConfig {
    lusdtContractName: string;
    bridgeServiceUrl: string;
    multisigThreshold: number;
}
/**
 * Serviço para gerenciar resgates LUSDT → USDT
 */
export declare class RedemptionService {
    private lunesContractService;
    private solanaTokenService;
    private config;
    constructor(lunesContractService: LunesContractService, solanaTokenService: SolanaTokenService, config: RedemptionServiceConfig);
    /**
     * Inicia um resgate LUSDT para USDT
     */
    initiateRedemption(params: RedemptionParams): Promise<BridgeTransaction>;
    /**
     * Verifica o status de um resgate
     */
    checkRedemptionStatus(transactionId: string): Promise<BridgeTransaction>;
    /**
     * Lista resgates do usuário
     */
    getUserRedemptions(userAddress: string): Promise<BridgeTransaction[]>;
    /**
     * Calcula a taxa de resgate
     */
    calculateRedemptionFee(amount: number, feeType: 'lunes' | 'lusdt' | 'usdt'): Promise<number>;
    /**
     * Obtém status do multisig para um resgate
     */
    getMultisigStatus(transactionId: string): Promise<{
        proposalId: string;
        approvals: number;
        required: number;
        approved: boolean;
    }>;
    /**
     * Monitora um resgate até a conclusão
     */
    monitorRedemption(transactionId: string, onStatusUpdate: (transaction: BridgeTransaction) => void, onMultisigUpdate?: (status: any) => void): Promise<BridgeTransaction>;
    /**
     * Queima tokens LUSDT
     */
    private burnLUSDT;
    /**
     * Valida parâmetros de resgate
     */
    private validateRedemptionParams;
    /**
     * Gera ID único para transação
     */
    private generateTransactionId;
    /**
     * Notifica o serviço de bridge sobre o resgate
     */
    private notifyBridgeService;
}
//# sourceMappingURL=redemption-service.d.ts.map