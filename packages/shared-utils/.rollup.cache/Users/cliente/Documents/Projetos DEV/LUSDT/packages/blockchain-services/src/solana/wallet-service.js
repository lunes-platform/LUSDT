import { Connection, PublicKey } from '@solana/web3.js';
import { WalletError, TransactionError } from '../types';
/**
 * Serviço para gerenciar conexões de carteira Solana
 * Suporta múltiplos tipos de carteira com interface unificada
 */
export class SolanaWalletService {
    config;
    connection;
    currentWallet = null;
    availableWallets = new Map();
    constructor(config) {
        this.config = config;
        this.connection = new Connection(config.rpcEndpoint, config.commitment || 'confirmed');
    }
    /**
     * Registra um adaptador de carteira
     */
    registerWallet(type, adapter) {
        this.availableWallets.set(type, adapter);
    }
    /**
     * Lista carteiras disponíveis
     */
    getAvailableWallets() {
        return Array.from(this.availableWallets.entries()).map(([type, adapter]) => ({
            type,
            name: adapter.name,
            icon: adapter.icon,
            installed: adapter.readyState === 'Installed'
        }));
    }
    /**
     * Conecta a uma carteira específica
     */
    async connect(walletType) {
        try {
            const adapter = this.availableWallets.get(walletType);
            if (!adapter) {
                throw new WalletError(`Wallet ${walletType} not registered`, 'WALLET_NOT_REGISTERED');
            }
            if (adapter.readyState !== 'Installed') {
                throw new WalletError(`Wallet ${walletType} is not installed`, 'WALLET_NOT_INSTALLED');
            }
            await adapter.connect();
            if (!adapter.publicKey) {
                throw new WalletError('Failed to get public key from wallet', 'NO_PUBLIC_KEY');
            }
            this.currentWallet = {
                address: adapter.publicKey.toString(),
                publicKey: adapter.publicKey.toString(),
                connected: true,
                name: adapter.name,
                icon: adapter.icon,
                adapter
            };
            return this.currentWallet;
        }
        catch (error) {
            if (error instanceof WalletError) {
                throw error;
            }
            throw new WalletError(`Failed to connect to ${walletType}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CONNECTION_FAILED', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Desconecta a carteira atual
     */
    async disconnect() {
        if (this.currentWallet?.adapter) {
            try {
                await this.currentWallet.adapter.disconnect();
            }
            catch (error) {
                console.warn('Error disconnecting wallet:', error);
            }
        }
        this.currentWallet = null;
    }
    /**
     * Obtém a carteira conectada atual
     */
    getCurrentWallet() {
        return this.currentWallet;
    }
    /**
     * Verifica se há uma carteira conectada
     */
    isConnected() {
        return this.currentWallet?.connected ?? false;
    }
    /**
     * Obtém o saldo de SOL da carteira conectada
     */
    async getSolBalance() {
        if (!this.currentWallet) {
            throw new WalletError('No wallet connected', 'NO_WALLET');
        }
        try {
            const publicKey = new PublicKey(this.currentWallet.publicKey);
            const balance = await this.connection.getBalance(publicKey);
            return balance / 1e9; // Convert lamports to SOL
        }
        catch (error) {
            throw new WalletError('Failed to get SOL balance', 'BALANCE_FETCH_FAILED', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Envia uma transação
     */
    async sendTransaction(transaction) {
        if (!this.currentWallet?.adapter) {
            throw new WalletError('No wallet connected', 'NO_WALLET');
        }
        try {
            // Get recent blockhash
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = new PublicKey(this.currentWallet.publicKey);
            // Sign transaction
            const signedTransaction = await this.currentWallet.adapter.signTransaction(transaction);
            // Send transaction
            const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: this.config.commitment
            });
            // Confirm transaction
            const confirmation = await this.connection.confirmTransaction(signature, this.config.commitment);
            if (confirmation.value.err) {
                throw new TransactionError(`Transaction failed: ${confirmation.value.err}`, 'TRANSACTION_FAILED', signature);
            }
            return {
                signature,
                success: true,
                blockHeight: confirmation.context.slot,
                confirmations: 1
            };
        }
        catch (error) {
            if (error instanceof TransactionError) {
                throw error;
            }
            throw new TransactionError(`Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`, 'SEND_FAILED', undefined, true // retryable
            );
        }
    }
    /**
     * Assina uma mensagem
     */
    async signMessage(message) {
        if (!this.currentWallet?.adapter) {
            throw new WalletError('No wallet connected', 'NO_WALLET');
        }
        try {
            const messageBytes = new TextEncoder().encode(message);
            const signature = await this.currentWallet.adapter.signMessage(messageBytes);
            return Buffer.from(signature).toString('base64');
        }
        catch (error) {
            throw new WalletError('Failed to sign message', 'SIGN_FAILED', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Obtém informações da rede
     */
    async getNetworkInfo() {
        try {
            const slot = await this.connection.getSlot();
            const blockTime = await this.connection.getBlockTime(slot);
            const version = await this.connection.getVersion();
            return {
                slot,
                blockTime: blockTime ? new Date(blockTime * 1000) : null,
                version: version['solana-core']
            };
        }
        catch (error) {
            throw new WalletError('Failed to get network info', 'NETWORK_INFO_FAILED', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Monitora mudanças na conta
     */
    subscribeToAccountChanges(callback) {
        if (!this.currentWallet) {
            return null;
        }
        try {
            const publicKey = new PublicKey(this.currentWallet.publicKey);
            return this.connection.onAccountChange(publicKey, (accountInfo) => {
                const balance = accountInfo.lamports / 1e9;
                callback(balance);
            }, this.config.commitment);
        }
        catch (error) {
            console.error('Failed to subscribe to account changes:', error);
            return null;
        }
    }
    /**
     * Remove subscription de mudanças na conta
     */
    unsubscribeFromAccountChanges(subscriptionId) {
        try {
            this.connection.removeAccountChangeListener(subscriptionId);
        }
        catch (error) {
            console.error('Failed to unsubscribe from account changes:', error);
        }
    }
}
//# sourceMappingURL=wallet-service.js.map