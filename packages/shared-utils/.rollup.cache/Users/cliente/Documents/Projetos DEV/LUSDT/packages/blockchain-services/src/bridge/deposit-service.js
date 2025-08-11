import { TransactionError } from '../types';
/**
 * Serviço para gerenciar depósitos USDT → LUSDT
 */
export class DepositService {
    solanaTokenService;
    lunesContractService;
    config;
    constructor(solanaTokenService, lunesContractService, config) {
        this.solanaTokenService = solanaTokenService;
        this.lunesContractService = lunesContractService;
        this.config = config;
    }
    /**
     * Inicia um depósito USDT para LUSDT
     */
    async initiateDeposit(params) {
        try {
            // Validate parameters
            this.validateDepositParams(params);
            // Check USDT balance
            const balance = await this.solanaTokenService.getTokenBalance(this.config.usdtMint);
            if (!balance || balance.amount < params.amount) {
                throw new TransactionError('Insufficient USDT balance', 'INSUFFICIENT_BALANCE');
            }
            // Create memo with destination address
            const memo = this.createDepositMemo(params.destinationAddress, params.memo);
            // Transfer USDT to treasury
            const transferResult = await this.solanaTokenService.transferToken({
                mint: this.config.usdtMint,
                to: this.config.treasuryAddress,
                amount: params.amount,
                memo
            });
            // Create bridge transaction record
            const bridgeTransaction = {
                id: this.generateTransactionId(),
                type: 'deposit',
                status: 'pending',
                amount: params.amount,
                fee: 0, // Fee will be calculated by bridge service
                sourceNetwork: 'solana',
                destinationNetwork: 'lunes',
                sourceTransaction: transferResult.signature,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Notify bridge service
            await this.notifyBridgeService(bridgeTransaction);
            return bridgeTransaction;
        }
        catch (error) {
            if (error instanceof TransactionError) {
                throw error;
            }
            throw new TransactionError(`Failed to initiate deposit: ${error instanceof Error ? error.message : 'Unknown error'}`, 'DEPOSIT_INITIATION_FAILED', undefined, true);
        }
    }
    /**
     * Verifica o status de um depósito
     */
    async checkDepositStatus(transactionId) {
        try {
            const response = await fetch(`${this.config.bridgeServiceUrl}/deposits/${transactionId}/status`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const transaction = await response.json();
            return transaction;
        }
        catch (error) {
            throw new TransactionError(`Failed to check deposit status: ${error instanceof Error ? error.message : 'Unknown error'}`, 'STATUS_CHECK_FAILED');
        }
    }
    /**
     * Lista depósitos do usuário
     */
    async getUserDeposits(userAddress) {
        try {
            const response = await fetch(`${this.config.bridgeServiceUrl}/deposits?user=${userAddress}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const deposits = await response.json();
            return deposits;
        }
        catch (error) {
            throw new TransactionError(`Failed to get user deposits: ${error instanceof Error ? error.message : 'Unknown error'}`, 'USER_DEPOSITS_FAILED');
        }
    }
    /**
     * Calcula a taxa de depósito
     */
    async calculateDepositFee(amount) {
        try {
            const response = await fetch(`${this.config.bridgeServiceUrl}/deposits/fee?amount=${amount}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const { fee } = await response.json();
            return fee;
        }
        catch (error) {
            throw new TransactionError(`Failed to calculate deposit fee: ${error instanceof Error ? error.message : 'Unknown error'}`, 'FEE_CALCULATION_FAILED');
        }
    }
    /**
     * Monitora um depósito até a conclusão
     */
    async monitorDeposit(transactionId, onStatusUpdate) {
        return new Promise((resolve, reject) => {
            const checkStatus = async () => {
                try {
                    const transaction = await this.checkDepositStatus(transactionId);
                    onStatusUpdate(transaction);
                    if (transaction.status === 'completed') {
                        resolve(transaction);
                    }
                    else if (transaction.status === 'failed') {
                        reject(new TransactionError('Deposit failed', 'DEPOSIT_FAILED', transactionId));
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
     * Valida parâmetros de depósito
     */
    validateDepositParams(params) {
        if (params.amount <= 0) {
            throw new TransactionError('Amount must be greater than 0', 'INVALID_AMOUNT');
        }
        if (!params.destinationAddress) {
            throw new TransactionError('Destination address is required', 'MISSING_DESTINATION');
        }
        // Validate Lunes address format (simplified)
        if (params.destinationAddress.length < 40) {
            throw new TransactionError('Invalid Lunes address format', 'INVALID_ADDRESS');
        }
    }
    /**
     * Cria memo para o depósito
     */
    createDepositMemo(destinationAddress, userMemo) {
        const bridgeMemo = `LUSDT_DEPOSIT:${destinationAddress}`;
        return userMemo ? `${bridgeMemo}:${userMemo}` : bridgeMemo;
    }
    /**
     * Gera ID único para transação
     */
    generateTransactionId() {
        return `deposit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Notifica o serviço de bridge sobre o depósito
     */
    async notifyBridgeService(transaction) {
        try {
            const response = await fetch(`${this.config.bridgeServiceUrl}/deposits`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transaction)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            console.warn('Failed to notify bridge service:', error);
            // Don't throw error here as the deposit transaction was already sent
        }
    }
}
//# sourceMappingURL=deposit-service.js.map