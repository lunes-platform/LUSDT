import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { WalletError, TransactionError } from '../types';
/**
 * Serviço para gerenciar conexões de carteira Lunes/Polkadot
 */
export class LunesWalletService {
    config;
    api = null;
    currentWallet = null;
    availableAccounts = [];
    constructor(config) {
        this.config = config;
    }
    /**
     * Inicializa a conexão com a rede Lunes
     */
    async initialize() {
        try {
            const provider = new WsProvider(this.config.wsEndpoint);
            this.api = await ApiPromise.create({ provider });
            // Wait for API to be ready
            await this.api.isReady;
        }
        catch (error) {
            throw new WalletError(`Failed to initialize Lunes connection: ${error instanceof Error ? error.message : 'Unknown error'}`, 'INITIALIZATION_FAILED', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Habilita extensões de carteira e obtém contas disponíveis
     */
    async enableWalletExtensions() {
        try {
            // Enable wallet extensions
            const extensions = await web3Enable(this.config.appName);
            if (extensions.length === 0) {
                throw new WalletError('No wallet extensions found. Please install Polkadot.js extension.', 'NO_EXTENSIONS');
            }
            // Get available accounts
            this.availableAccounts = await web3Accounts();
            if (this.availableAccounts.length === 0) {
                throw new WalletError('No accounts found in wallet extensions.', 'NO_ACCOUNTS');
            }
            return this.availableAccounts;
        }
        catch (error) {
            if (error instanceof WalletError) {
                throw error;
            }
            throw new WalletError(`Failed to enable wallet extensions: ${error instanceof Error ? error.message : 'Unknown error'}`, 'EXTENSION_ENABLE_FAILED', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Conecta a uma conta específica
     */
    async connect(accountAddress) {
        if (!this.api) {
            throw new WalletError('API not initialized', 'API_NOT_INITIALIZED');
        }
        try {
            const account = this.availableAccounts.find(acc => acc.address === accountAddress);
            if (!account) {
                throw new WalletError(`Account ${accountAddress} not found`, 'ACCOUNT_NOT_FOUND');
            }
            // Get signer for the account
            const injector = await web3FromAddress(accountAddress);
            this.currentWallet = {
                address: account.address,
                publicKey: account.address, // In Polkadot, address is derived from public key
                connected: true,
                name: account.meta.name || 'Unknown Account',
                signer: injector.signer
            };
            return this.currentWallet;
        }
        catch (error) {
            if (error instanceof WalletError) {
                throw error;
            }
            throw new WalletError(`Failed to connect to account: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CONNECTION_FAILED', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Desconecta a carteira atual
     */
    async disconnect() {
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
     * Obtém contas disponíveis
     */
    getAvailableAccounts() {
        return this.availableAccounts;
    }
    /**
     * Obtém o saldo nativo da conta conectada
     */
    async getNativeBalance() {
        if (!this.api || !this.currentWallet) {
            throw new WalletError('API not initialized or no wallet connected', 'NO_WALLET_OR_API');
        }
        try {
            const { data: balance } = await this.api.query.system.account(this.currentWallet.address);
            const free = balance.free.toBn();
            const decimals = this.api.registry.chainDecimals[0] || 12;
            return free.toNumber() / Math.pow(10, decimals);
        }
        catch (error) {
            throw new WalletError('Failed to get native balance', 'BALANCE_FETCH_FAILED', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Transfere tokens nativos
     */
    async transferNative(to, amount) {
        if (!this.api || !this.currentWallet) {
            throw new WalletError('API not initialized or no wallet connected', 'NO_WALLET_OR_API');
        }
        try {
            const decimals = this.api.registry.chainDecimals[0] || 12;
            const value = amount * Math.pow(10, decimals);
            // Create transfer transaction
            const transfer = this.api.tx.balances.transfer(to, value);
            // Sign and send transaction
            const hash = await transfer.signAndSend(this.currentWallet.address, { signer: this.currentWallet.signer });
            return {
                signature: hash.toString(),
                success: true
            };
        }
        catch (error) {
            throw new TransactionError(`Failed to transfer native tokens: ${error instanceof Error ? error.message : 'Unknown error'}`, 'TRANSFER_FAILED', undefined, true);
        }
    }
    /**
     * Assina uma mensagem
     */
    async signMessage(message) {
        if (!this.currentWallet) {
            throw new WalletError('No wallet connected', 'NO_WALLET');
        }
        try {
            const signature = await this.currentWallet.signer.signRaw({
                address: this.currentWallet.address,
                data: message,
                type: 'bytes'
            });
            return signature.signature;
        }
        catch (error) {
            throw new WalletError('Failed to sign message', 'SIGN_FAILED', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Obtém informações da rede
     */
    async getNetworkInfo() {
        if (!this.api) {
            throw new WalletError('API not initialized', 'API_NOT_INITIALIZED');
        }
        try {
            const [chain, nodeName, nodeVersion] = await Promise.all([
                this.api.rpc.system.chain(),
                this.api.rpc.system.name(),
                this.api.rpc.system.version()
            ]);
            const header = await this.api.rpc.chain.getHeader();
            const blockHeight = header.number.toNumber();
            return {
                connected: true,
                blockHeight,
                lastUpdate: new Date()
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
        if (!this.api || !this.currentWallet) {
            return null;
        }
        try {
            const unsubscribe = this.api.query.system.account(this.currentWallet.address, ({ data: balance }) => {
                const free = balance.free.toBn();
                const decimals = this.api.registry.chainDecimals[0] || 12;
                const balanceValue = free.toNumber() / Math.pow(10, decimals);
                callback(balanceValue);
            });
            return unsubscribe;
        }
        catch (error) {
            console.error('Failed to subscribe to account changes:', error);
            return null;
        }
    }
    /**
     * Obtém a API Polkadot
     */
    getApi() {
        return this.api;
    }
    /**
     * Desconecta da rede
     */
    async disconnect_network() {
        if (this.api) {
            await this.api.disconnect();
            this.api = null;
        }
    }
}
//# sourceMappingURL=wallet-service.js.map