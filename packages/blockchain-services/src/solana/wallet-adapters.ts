import { WalletAdapter, WalletReadyState } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletError } from '../types';

export type SolanaWalletType = 'phantom' | 'solflare' | 'sollet' | 'ledger';

export interface WalletAdapterInfo {
  type: SolanaWalletType;
  name: string;
  icon: string;
  url: string;
  adapter: WalletAdapter;
  readyState: WalletReadyState;
  installed: boolean;
  supported: boolean;
}

/**
 * Registry for managing Solana wallet adapters
 * Handles initialization, detection, and lifecycle management
 */
export class SolanaWalletAdapterRegistry {
  private adapters: Map<SolanaWalletType, WalletAdapter> = new Map();
  private initialized = false;

  /**
   * Initialize all supported wallet adapters
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Phantom adapter
      const phantomAdapter = new PhantomWalletAdapter();
      this.adapters.set('phantom', phantomAdapter);

      // Initialize Solflare adapter
      const solflareAdapter = new SolflareWalletAdapter();
      this.adapters.set('solflare', solflareAdapter);

      // Setup event listeners for all adapters
      this.setupEventListeners();

      this.initialized = true;
    } catch (error) {
      throw new WalletError(
        'Failed to initialize wallet adapters',
        'ADAPTER_INIT_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a specific wallet adapter
   */
  getAdapter(type: SolanaWalletType): WalletAdapter | null {
    return this.adapters.get(type) || null;
  }

  /**
   * Get all available wallet adapters with their info
   */
  getAvailableWallets(): WalletAdapterInfo[] {
    return Array.from(this.adapters.entries()).map(([type, adapter]) => ({
      type,
      name: adapter.name,
      icon: adapter.icon,
      url: adapter.url,
      adapter,
      readyState: adapter.readyState,
      installed: adapter.readyState === WalletReadyState.Installed,
      supported: adapter.readyState !== WalletReadyState.Unsupported
    }));
  }

  /**
   * Get only installed wallets
   */
  getInstalledWallets(): WalletAdapterInfo[] {
    return this.getAvailableWallets().filter(wallet => wallet.installed);
  }

  /**
   * Check if a specific wallet is available
   */
  isWalletAvailable(type: SolanaWalletType): boolean {
    const adapter = this.adapters.get(type);
    return adapter ? adapter.readyState === WalletReadyState.Installed : false;
  }

  /**
   * Check if any wallet is available
   */
  hasAvailableWallets(): boolean {
    return this.getInstalledWallets().length > 0;
  }

  /**
   * Get wallet installation URL
   */
  getInstallationUrl(type: SolanaWalletType): string | null {
    const adapter = this.adapters.get(type);
    return adapter?.url || null;
  }

  /**
   * Setup event listeners for wallet state changes
   */
  private setupEventListeners(): void {
    this.adapters.forEach((adapter, type) => {
      adapter.on('readyStateChange', (readyState) => {
        console.log(`Wallet ${type} ready state changed:`, readyState);
        this.onWalletStateChange(type, readyState);
      });

      adapter.on('connect', (publicKey) => {
        console.log(`Wallet ${type} connected:`, publicKey?.toString());
        this.onWalletConnect(type, publicKey);
      });

      adapter.on('disconnect', () => {
        console.log(`Wallet ${type} disconnected`);
        this.onWalletDisconnect(type);
      });

      adapter.on('error', (error) => {
        console.error(`Wallet ${type} error:`, error);
        this.onWalletError(type, error);
      });
    });
  }

  /**
   * Handle wallet state changes
   */
  private onWalletStateChange(type: SolanaWalletType, readyState: WalletReadyState): void {
    // Emit custom event for state changes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('walletStateChange', {
        detail: { type, readyState }
      }));
    }
  }

  /**
   * Handle wallet connection
   */
  private onWalletConnect(type: SolanaWalletType, publicKey: any): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('walletConnect', {
        detail: { type, publicKey: publicKey?.toString() }
      }));
    }
  }

  /**
   * Handle wallet disconnection
   */
  private onWalletDisconnect(type: SolanaWalletType): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('walletDisconnect', {
        detail: { type }
      }));
    }
  }

  /**
   * Handle wallet errors
   */
  private onWalletError(type: SolanaWalletType, error: any): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('walletError', {
        detail: { type, error }
      }));
    }
  }

  /**
   * Cleanup all adapters
   */
  async cleanup(): Promise<void> {
    for (const [type, adapter] of this.adapters) {
      try {
        if (adapter.connected) {
          await adapter.disconnect();
        }
        adapter.removeAllListeners();
      } catch (error) {
        console.warn(`Error cleaning up wallet ${type}:`, error);
      }
    }
    this.adapters.clear();
    this.initialized = false;
  }
}

/**
 * Singleton instance of the wallet adapter registry
 */
export const walletAdapterRegistry = new SolanaWalletAdapterRegistry();

/**
 * Utility functions for wallet detection and management
 */
export class WalletDetectionService {
  /**
   * Detect all available wallets in the browser
   */
  static async detectWallets(): Promise<WalletAdapterInfo[]> {
    await walletAdapterRegistry.initialize();
    return walletAdapterRegistry.getAvailableWallets();
  }

  /**
   * Check if a specific wallet is installed
   */
  static isWalletInstalled(type: SolanaWalletType): boolean {
    return walletAdapterRegistry.isWalletAvailable(type);
  }

  /**
   * Get the best available wallet (prioritize Phantom, then Solflare)
   */
  static getBestAvailableWallet(): WalletAdapterInfo | null {
    const installed = walletAdapterRegistry.getInstalledWallets();
    
    // Priority order: Phantom, Solflare, others
    const priority: SolanaWalletType[] = ['phantom', 'solflare'];
    
    for (const type of priority) {
      const wallet = installed.find(w => w.type === type);
      if (wallet) {
        return wallet;
      }
    }
    
    // Return first available if no priority wallet found
    return installed[0] || null;
  }

  /**
   * Get installation instructions for a wallet
   */
  static getInstallationInstructions(type: SolanaWalletType): {
    name: string;
    url: string;
    instructions: string[];
  } {
    const instructions = {
      phantom: {
        name: 'Phantom',
        url: 'https://phantom.app/',
        instructions: [
          'Visit phantom.app',
          'Click "Download" and select your browser',
          'Install the browser extension',
          'Create or import your wallet',
          'Refresh this page and try connecting again'
        ]
      },
      solflare: {
        name: 'Solflare',
        url: 'https://solflare.com/',
        instructions: [
          'Visit solflare.com',
          'Click "Download" and select "Browser Extension"',
          'Install the extension from your browser\'s store',
          'Set up your wallet',
          'Refresh this page and try connecting again'
        ]
      },
      sollet: {
        name: 'Sollet',
        url: 'https://www.sollet.io/',
        instructions: [
          'Visit sollet.io',
          'This is a web-based wallet',
          'Create or import your wallet',
          'Use the web interface to connect'
        ]
      },
      ledger: {
        name: 'Ledger',
        url: 'https://www.ledger.com/',
        instructions: [
          'Connect your Ledger hardware wallet',
          'Install the Solana app on your Ledger',
          'Open the Solana app on your device',
          'Use a compatible interface like Solflare to connect'
        ]
      }
    };

    return instructions[type] || {
      name: 'Unknown Wallet',
      url: '',
      instructions: ['Wallet not recognized']
    };
  }
}

/**
 * Error recovery service for wallet connection issues
 */
export class WalletErrorRecoveryService {
  /**
   * Attempt to recover from wallet connection errors
   */
  static async recoverFromError(
    error: WalletError,
    walletType: SolanaWalletType
  ): Promise<{
    canRecover: boolean;
    recoveryAction?: string;
    userMessage: string;
  }> {
    switch (error.code) {
      case 'WALLET_NOT_INSTALLED':
        return {
          canRecover: false,
          recoveryAction: 'install',
          userMessage: `${walletType} wallet is not installed. Please install it and try again.`
        };

      case 'USER_REJECTED':
        return {
          canRecover: true,
          recoveryAction: 'retry',
          userMessage: 'Connection was rejected. Please try connecting again and approve the request.'
        };

      case 'CONNECTION_FAILED':
        return {
          canRecover: true,
          recoveryAction: 'retry',
          userMessage: 'Connection failed. Please check your wallet and try again.'
        };

      case 'WALLET_NOT_READY':
        return {
          canRecover: true,
          recoveryAction: 'wait',
          userMessage: 'Wallet is not ready. Please wait a moment and try again.'
        };

      default:
        return {
          canRecover: false,
          userMessage: `An unexpected error occurred: ${error.message}`
        };
    }
  }

  /**
   * Get user-friendly error messages
   */
  static getUserFriendlyMessage(error: WalletError, walletType: SolanaWalletType): string {
    const walletName = walletType.charAt(0).toUpperCase() + walletType.slice(1);
    
    switch (error.code) {
      case 'WALLET_NOT_INSTALLED':
        return `${walletName} wallet is not installed. Please install it from the official website.`;
      
      case 'USER_REJECTED':
        return 'You rejected the connection request. Please try again and approve the connection.';
      
      case 'CONNECTION_FAILED':
        return `Failed to connect to ${walletName}. Please make sure the wallet is unlocked and try again.`;
      
      case 'WALLET_NOT_READY':
        return `${walletName} wallet is not ready. Please wait a moment and try again.`;
      
      case 'NO_PUBLIC_KEY':
        return 'Unable to get your wallet address. Please check your wallet connection.';
      
      default:
        return `An error occurred while connecting to ${walletName}: ${error.message}`;
    }
  }
}