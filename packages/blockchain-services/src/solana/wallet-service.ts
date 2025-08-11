import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { WalletAdapter, WalletReadyState } from '@solana/wallet-adapter-base';
import { 
  SolanaWallet, 
  WalletConnection, 
  TransactionResult, 
  WalletError,
  TransactionError 
} from '../types';
import { 
  SolanaWalletType,
  walletAdapterRegistry,
  WalletDetectionService,
  WalletErrorRecoveryService,
  WalletAdapterInfo
} from './wallet-adapters';

export interface SolanaWalletServiceConfig {
  rpcEndpoint: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * Enhanced Solana wallet service with comprehensive adapter integration
 * Supports multiple wallet types with automatic detection and error recovery
 */
export class SolanaWalletService {
  private connection: Connection;
  private currentWallet: SolanaWallet | null = null;
  private initialized = false;
  private accountSubscription: number | null = null;

  constructor(private config: SolanaWalletServiceConfig) {
    this.connection = new Connection(
      config.rpcEndpoint,
      config.commitment || 'confirmed'
    );
  }

  /**
   * Initialize the wallet service and detect available wallets
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await walletAdapterRegistry.initialize();
      this.setupGlobalEventListeners();
      this.initialized = true;
    } catch (error) {
      throw new WalletError(
        'Failed to initialize wallet service',
        'SERVICE_INIT_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all available wallets with detailed information
   */
  async getAvailableWallets(): Promise<WalletAdapterInfo[]> {
    await this.ensureInitialized();
    return walletAdapterRegistry.getAvailableWallets();
  }

  /**
   * Get only installed wallets
   */
  async getInstalledWallets(): Promise<WalletAdapterInfo[]> {
    await this.ensureInitialized();
    return walletAdapterRegistry.getInstalledWallets();
  }

  /**
   * Check if any wallets are available
   */
  async hasAvailableWallets(): Promise<boolean> {
    await this.ensureInitialized();
    return walletAdapterRegistry.hasAvailableWallets();
  }

  /**
   * Get the best available wallet automatically
   */
  async getBestAvailableWallet(): Promise<WalletAdapterInfo | null> {
    await this.ensureInitialized();
    return WalletDetectionService.getBestAvailableWallet();
  }

  /**
   * Connect to a specific wallet with enhanced error handling
   */
  async connect(walletType: SolanaWalletType): Promise<SolanaWallet> {
    await this.ensureInitialized();

    try {
      // Disconnect current wallet if connected
      if (this.currentWallet) {
        await this.disconnect();
      }

      const adapter = walletAdapterRegistry.getAdapter(walletType);
      if (!adapter) {
        throw new WalletError(
          `Wallet ${walletType} not found`,
          'WALLET_NOT_FOUND'
        );
      }

      // Check wallet availability
      if (adapter.readyState === WalletReadyState.NotDetected) {
        throw new WalletError(
          `Wallet ${walletType} is not installed`,
          'WALLET_NOT_INSTALLED'
        );
      }

      if (adapter.readyState === WalletReadyState.Unsupported) {
        throw new WalletError(
          `Wallet ${walletType} is not supported in this environment`,
          'WALLET_NOT_SUPPORTED'
        );
      }

      // For Loadable wallets, allow connect() to trigger loading on demand

      // Attempt connection
      await adapter.connect();

      if (!adapter.publicKey) {
        throw new WalletError(
          'Failed to get public key from wallet',
          'NO_PUBLIC_KEY'
        );
      }

      // Create wallet object
      this.currentWallet = {
        address: adapter.publicKey.toString(),
        publicKey: adapter.publicKey.toString(),
        connected: true,
        name: adapter.name,
        icon: adapter.icon,
        adapter
      };

      // Setup account monitoring
      await this.setupAccountMonitoring();

      return this.currentWallet;
    } catch (error) {
      // Enhanced error handling with recovery suggestions
      if (error instanceof WalletError) {
        const recovery = await WalletErrorRecoveryService.recoverFromError(error, walletType);
        error.message = recovery.userMessage;
        throw error;
      }
      
      throw new WalletError(
        WalletErrorRecoveryService.getUserFriendlyMessage(
          new WalletError('Connection failed', 'CONNECTION_FAILED'),
          walletType
        ),
        'CONNECTION_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Connect to the best available wallet automatically
   */
  async connectBestAvailable(): Promise<SolanaWallet> {
    const bestWallet = await this.getBestAvailableWallet();
    if (!bestWallet) {
      throw new WalletError(
        'No compatible wallets found. Please install Phantom or Solflare.',
        'NO_WALLETS_AVAILABLE'
      );
    }

    return this.connect(bestWallet.type);
  }

  /**
   * Disconnect the current wallet with cleanup
   */
  async disconnect(): Promise<void> {
    if (this.currentWallet?.adapter) {
      try {
        // Remove account subscription
        if (this.accountSubscription !== null) {
          this.connection.removeAccountChangeListener(this.accountSubscription);
          this.accountSubscription = null;
        }

        // Disconnect adapter
        await this.currentWallet.adapter.disconnect();
      } catch (error) {
        console.warn('Error disconnecting wallet:', error);
      }
    }
    this.currentWallet = null;
  }

  /**
   * Obtém a carteira conectada atual
   */
  getCurrentWallet(): SolanaWallet | null {
    return this.currentWallet;
  }

  /**
   * Verifica se há uma carteira conectada
   */
  isConnected(): boolean {
    return this.currentWallet?.connected ?? false;
  }

  /**
   * Obtém o saldo de SOL da carteira conectada
   */
  async getSolBalance(): Promise<number> {
    if (!this.currentWallet) {
      throw new WalletError('No wallet connected', 'NO_WALLET');
    }

    try {
      const publicKey = new PublicKey(this.currentWallet.publicKey);
      const balance = await this.connection.getBalance(publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      throw new WalletError(
        'Failed to get SOL balance',
        'BALANCE_FETCH_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Envia uma transação
   */
  async sendTransaction(transaction: Transaction): Promise<TransactionResult> {
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
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: this.config.commitment
        }
      );

      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction(
        signature,
        this.config.commitment
      );

      if (confirmation.value.err) {
        throw new TransactionError(
          `Transaction failed: ${confirmation.value.err}`,
          'TRANSACTION_FAILED',
          signature
        );
      }

      return {
        signature,
        success: true,
        blockHeight: confirmation.context.slot,
        confirmations: 1
      };
    } catch (error) {
      if (error instanceof TransactionError) {
        throw error;
      }

      throw new TransactionError(
        `Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEND_FAILED',
        undefined,
        true // retryable
      );
    }
  }

  /**
   * Assina uma mensagem
   */
  async signMessage(message: string): Promise<string> {
    if (!this.currentWallet?.adapter) {
      throw new WalletError('No wallet connected', 'NO_WALLET');
    }

    try {
      const messageBytes = new TextEncoder().encode(message);
      const signature = await this.currentWallet.adapter.signMessage(messageBytes);
      return Buffer.from(signature).toString('base64');
    } catch (error) {
      throw new WalletError(
        'Failed to sign message',
        'SIGN_FAILED',
        error instanceof Error ? error : undefined
      );
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
    } catch (error) {
      throw new WalletError(
        'Failed to get network info',
        'NETWORK_INFO_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Monitora mudanças na conta
   */
  subscribeToAccountChanges(
    callback: (balance: number) => void
  ): number | null {
    if (!this.currentWallet) {
      return null;
    }

    try {
      const publicKey = new PublicKey(this.currentWallet.publicKey);
      return this.connection.onAccountChange(
        publicKey,
        (accountInfo) => {
          const balance = accountInfo.lamports / 1e9;
          callback(balance);
        },
        this.config.commitment
      );
    } catch (error) {
      console.error('Failed to subscribe to account changes:', error);
      return null;
    }
  }

  /**
   * Remove subscription de mudanças na conta
   */
  unsubscribeFromAccountChanges(subscriptionId: number): void {
    try {
      this.connection.removeAccountChangeListener(subscriptionId);
    } catch (error) {
      console.error('Failed to unsubscribe from account changes:', error);
    }
  }

  /**
   * Get wallet installation instructions
   */
  getInstallationInstructions(walletType: SolanaWalletType): {
    name: string;
    url: string;
    instructions: string[];
  } {
    return WalletDetectionService.getInstallationInstructions(walletType);
  }

  /**
   * Check if a specific wallet is installed
   */
  async isWalletInstalled(walletType: SolanaWalletType): Promise<boolean> {
    await this.ensureInitialized();
    return WalletDetectionService.isWalletInstalled(walletType);
  }

  /**
   * Attempt to recover from wallet errors
   */
  async recoverFromError(error: WalletError, walletType: SolanaWalletType): Promise<{
    canRecover: boolean;
    recoveryAction?: string;
    userMessage: string;
  }> {
    return WalletErrorRecoveryService.recoverFromError(error, walletType);
  }

  /**
   * Setup account monitoring for balance changes
   */
  private async setupAccountMonitoring(): Promise<void> {
    if (!this.currentWallet) {
      return;
    }

    try {
      const publicKey = new PublicKey(this.currentWallet.publicKey);
      this.accountSubscription = this.connection.onAccountChange(
        publicKey,
        (accountInfo) => {
          const balance = accountInfo.lamports / 1e9;
          this.emitBalanceChange(balance);
        },
        this.config.commitment
      );
    } catch (error) {
      console.warn('Failed to setup account monitoring:', error);
    }
  }

  /**
   * Setup global event listeners for wallet state changes
   */
  private setupGlobalEventListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('walletStateChange', (event: any) => {
      this.handleWalletStateChange(event.detail);
    });

    window.addEventListener('walletConnect', (event: any) => {
      this.handleWalletConnect(event.detail);
    });

    window.addEventListener('walletDisconnect', (event: any) => {
      this.handleWalletDisconnect(event.detail);
    });

    window.addEventListener('walletError', (event: any) => {
      this.handleWalletError(event.detail);
    });
  }

  /**
   * Handle wallet state changes
   */
  private handleWalletStateChange(detail: { type: SolanaWalletType; readyState: WalletReadyState }): void {
    // Emit custom event for UI updates
    this.emitEvent('walletStateChange', detail);
  }

  /**
   * Handle wallet connection events
   */
  private handleWalletConnect(detail: { type: SolanaWalletType; publicKey: string }): void {
    this.emitEvent('walletConnect', detail);
  }

  /**
   * Handle wallet disconnection events
   */
  private handleWalletDisconnect(detail: { type: SolanaWalletType }): void {
    if (this.currentWallet && this.currentWallet.adapter.name.toLowerCase().includes(detail.type)) {
      this.currentWallet = null;
      if (this.accountSubscription !== null) {
        this.connection.removeAccountChangeListener(this.accountSubscription);
        this.accountSubscription = null;
      }
    }
    this.emitEvent('walletDisconnect', detail);
  }

  /**
   * Handle wallet error events
   */
  private handleWalletError(detail: { type: SolanaWalletType; error: any }): void {
    this.emitEvent('walletError', detail);
  }

  /**
   * Emit balance change events
   */
  private emitBalanceChange(balance: number): void {
    this.emitEvent('balanceChange', { balance });
  }

  /**
   * Emit custom events
   */
  private emitEvent(eventType: string, data: any): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`solanaWallet:${eventType}`, {
        detail: data
      }));
    }
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Cleanup resources when service is destroyed
   */
  async cleanup(): Promise<void> {
    await this.disconnect();
    await walletAdapterRegistry.cleanup();
    this.initialized = false;
  }
}