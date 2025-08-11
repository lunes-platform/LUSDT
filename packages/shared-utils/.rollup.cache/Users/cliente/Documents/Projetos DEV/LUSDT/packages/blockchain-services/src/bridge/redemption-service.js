import { TransactionError } from '../types';
/**
 * Serviço para gerenciar resgates LUSDT → USDT
 */
export class RedemptionService {
    lunesContractService;
    solanaTokenService;
    config;
    constructor(lunesContractService, solanaTokenService, config) {
        this.lunesContractService = lunesContractService;
        this.solanaTokenService = solanaTokenService;
        this.config = config;
    }
    /**
     * Inicia um resgate LUSDT para USDT
     */
    async initiateRedemption(params) {
        try {
            // Validate parameters
            this.validateRedemptionParams(params);
            // Check LUSDT balance
            const wallet = this.lunesContractService.walletService.getCurrentWallet();
            if (!wallet) {
                throw new TransactionError('No wallet connected', 'NO_WALLET');
            }
            const balance = await this.lunesContractService.getPSP22Balance(this.config.lusdtContractName, wallet.address);
            if (balance < params.amount) {
                throw new TransactionError('Insufficient LUSDT balance', 'INSUFFICIENT_BALANCE');
            }
            // Calculate fee
            const fee = await this.calculateRedemptionFee(params.amount, params.feeType);
            // Burn LUSDT tokens
            const burnResult = await this.burnLUSDT(params.amount, params.destinationAddress);
            // Create bridge transaction record
            const bridgeTransaction = {
                id: this.generateTransactionId(),
                type: 'redemption',
                status: 'pending',
                amount: params.amount,
                fee,
                sourceNetwork: 'lunes',
                destinationNetwork: 'solana',
                sourceTransaction: burnResult.transactionHash,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Notify bridge service
            await this.notifyBridgeService(bridgeTransaction, params);
            return bridgeTransaction;
        }
        catch (error) {
            if (error instanceof TransactionError) {
                throw error;
            }
            throw new TransactionError(`Failed to initiate redemption: ${error instanceof Error ? error.message : 'Unknown error'}`, 'REDEMPTION_INITIATION_FAILED', undefined, true);
        }
    }
    /**
     * Verifica o status de um resgate
     */
    async checkRedemptionStatus(transactionId) {
        try {
            const response = await fetch(`${this.config.bridgeServiceUrl}/redemptions/${transactionId}/status`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const transaction = await response.json();
            return transaction;
        }
        catch (error) {
            throw new TransactionError(`Failed to check redemption status: ${error instanceof Error ? error.message : 'Unknown error'}`, 'STATUS_CHECK_FAILED');
        }
    }
    /**
     * Lista resgates do usuário
     */
    async getUserRedemptions(userAddress) {
        try {
            const response = await fetch(`${this.config.bridgeServiceUrl}/redemptions?user=${userAddress}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const redemptions = await response.json();
            return redemptions;
        }
        catch (error) {
            throw new TransactionError(`Failed to get user redemptions: ${error instanceof Error ? error.message : 'Unknown error'}`, 'USER_REDEMPTIONS_FAILED');
        }
    }
    /**
     * Calcula a taxa de resgate
     */
    async calculateRedemptionFee(amount, feeType) {
        try {
            const response = await fetch(`${this.config.bridgeServiceUrl}/redemptions/fee?amount=${amount}&feeType=${feeType}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const { fee } = await response.json();
            return fee;
        }
        catch (error) {
            throw new TransactionError(`Failed to calculate redemption fee: ${error instanceof Error ? error.message : 'Unknown error'}`, 'FEE_CALCULATION_FAILED');
        }
    }
    /**
     * Obtém status do multisig para um resgate
     */
    async getMultisigStatus(transactionId) {
        try {
            const response = await fetch(`${this.config.bridgeServiceUrl}/redemptions/${transactionId}/multisig`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const multisigStatus = await response.json();
            return multisigStatus;
        }
        catch (error) {
            throw new TransactionError(`Failed to get multisig status: ${error instanceof Error ? error.message : 'Unknown error'}`, 'MULTISIG_STATUS_FAILED');
        }
    }
    /**
     * Monitora um resgate até a conclusão
     */
    async monitorRedemption(transactionId, onStatusUpdate, onMultisigUpdate) {
        return new Promise((resolve, reject) => {
            const checkStatus = async () => {
                try {
                    const transaction = await this.checkRedemptionStatus(transactionId);
                    onStatusUpdate(transaction);
                    // Check multisig status if callback provided
                    if (onMultisigUpdate && transaction.status === 'processing') {
                        try {
                            const multisigStatus = await this.getMultisigStatus(transactionId);
                            onMultisigUpdate(multisigStatus);
                        }
                        catch (error) {
                            console.warn('Failed to get multisig status:', error);
                        }
                    }
                    if (transaction.status === 'completed') {
                        resolve(transaction);
                    }
                    else if (transaction.status === 'failed') {
                        reject(new TransactionError('Redemption failed', 'REDEMPTION_FAILED', transactionId));
                    }
                    else {
                        // Continue monitoring
                        setTimeout(checkStatus, 5000); // Check every 5 seconds
                    }
                }
                catch (error) {
                    reject(error);
                }
            };
            checkStatus();
        });
    }
    /**
     * Queima tokens LUSDT
     */
    async burnLUSDT(amount, destinationAddress) {
        try {
            // Call burn function on LUSDT contract
            const result = await this.lunesContractService.executeContract({
                contractAddress: this.config.lusdtContractName,
                method: 'burn',
                args: [amount, destinationAddress]
            });
            return result;
        }
        catch (error) {
            throw new TransactionError(`Failed to burn LUSDT: ${error instanceof Error ? error.message : 'Unknown error'}`, 'BURN_FAILED', undefined, true);
        }
    }
    /**
     * Valida parâmetros de resgate
     */
    validateRedemptionParams(params) {
        if (params.amount <= 0) {
            throw new TransactionError('Amount must be greater than 0', 'INVALID_AMOUNT');
        }
        if (!params.destinationAddress) {
            throw new TransactionError('Destination address is required', 'MISSING_DESTINATION');
        }
        // Validate Solana address format (simplified)
        if (params.destinationAddress.length < 32) {
            throw new TransactionError('Invalid Solana address format', 'INVALID_ADDRESS');
        }
        if (!['lunes', 'lusdt', 'usdt'].includes(params.feeType)) {
            throw new TransactionError('Invalid fee type', 'INVALID_FEE_TYPE');
        }
    }
    /**
     * Gera ID único para transação
     */
    generateTransactionId() {
        return `redemption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Notifica o serviço de bridge sobre o resgate
     */
    async notifyBridgeService(transaction, params) {
        try {
            const response = await fetch(`${this.config.bridgeServiceUrl}/redemptions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...transaction,
                    destinationAddress: params.destinationAddress,
                    feeType: params.feeType
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            console.warn('Failed to notify bridge service:', error);
            // Don't throw error here as the burn transaction was already sent
        }
    }
}
//# sourceMappingURL=redemption-service.js.map