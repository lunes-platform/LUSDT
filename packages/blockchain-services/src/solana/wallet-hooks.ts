import { useState, useEffect, useCallback, useRef } from 'react';
import { SolanaWalletService, SolanaWalletServiceConfig } from './wallet-service';
import { SolanaWalletType, WalletAdapterInfo } from './wallet-adapters';
import { SolanaWallet, WalletError } from '../types';

export interface UseSolanaWalletOptions {
  config: SolanaWalletServiceConfig;
  autoConnect?: boolean;
  preferredWallet?: SolanaWalletType;
}

export interface UseSolanaWalletReturn {
  // Wallet state
  wallet: SolanaWallet | null;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  
  // Available wallets
  availableWallets: WalletAdapterInfo[];
  installedWallets: WalletAdapterInfo[];
  hasWallets: boolean;
  
  // Balance and network info
  balance: number | null;
  networkInfo: any;
  
  // Actions
  connect: (walletType?: SolanaWalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (transaction: any) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  
  // Utilities
  isWalletInstalled: (walletType: SolanaWalletType) => boolean;
  getInstallationInstructions: (walletType: SolanaWalletType) => {
    name: string;
    url: string;
    instructions: string[];
  };
  
  // Error handling
  error: WalletError | null;
  clearError: () => void;
}

/**
 * React hook for Solana wallet integration
 * Provides comprehensive wallet management with automatic state updates
 */
export function useSolanaWallet(options: UseSolanaWalletOptions): UseSolanaWalletReturn {
  const { config, autoConnect = false, preferredWallet } = options;
  
  // State
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<WalletAdapterInfo[]>([]);
  const [installedWallets, setInstalledWallets] = useState<WalletAdapterInfo[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [error, setError] = useState<WalletError | null>(null);
  
  // Service instance
  const serviceRef = useRef<SolanaWalletService | null>(null);
  
  // Initialize service
  useEffect(() => {
    serviceRef.current = new SolanaWalletService(config);
    
    const initializeService = async () => {
      try {
        await serviceRef.current!.initialize();
        
        // Load available wallets
        const available = await serviceRef.current!.getAvailableWallets();
        const installed = await serviceRef.current!.getInstalledWallets();
        
        setAvailableWallets(available);
        setInstalledWallets(installed);
        
        // Auto-connect if enabled
        if (autoConnect && installed.length > 0) {
          const walletToConnect = preferredWallet 
            ? installed.find(w => w.type === preferredWallet)?.type || installed[0].type
            : installed[0].type;
          
          await connectWallet(walletToConnect);
        }
      } catch (err) {
        setError(err instanceof WalletError ? err : new WalletError('Initialization failed', 'INIT_FAILED'));
      }
    };
    
    initializeService();
    
    // Cleanup on unmount
    return () => {
      if (serviceRef.current) {
        serviceRef.current.cleanup();
      }
    };
  }, [config, autoConnect, preferredWallet]);
  
  // Setup event listeners
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    const handleWalletConnect = (event: CustomEvent) => {
      console.log('Wallet connected:', event.detail);
    };
    
    const handleWalletDisconnect = (event: CustomEvent) => {
      console.log('Wallet disconnected:', event.detail);
      setWallet(null);
      setBalance(null);
    };
    
    const handleWalletError = (event: CustomEvent) => {
      console.error('Wallet error:', event.detail);
      setError(new WalletError('Wallet error occurred', 'WALLET_ERROR'));
    };
    
    const handleBalanceChange = (event: CustomEvent) => {
      setBalance(event.detail.balance);
    };
    
    window.addEventListener('solanaWallet:walletConnect', handleWalletConnect as EventListener);
    window.addEventListener('solanaWallet:walletDisconnect', handleWalletDisconnect as EventListener);
    window.addEventListener('solanaWallet:walletError', handleWalletError as EventListener);
    window.addEventListener('solanaWallet:balanceChange', handleBalanceChange as EventListener);
    
    return () => {
      window.removeEventListener('solanaWallet:walletConnect', handleWalletConnect as EventListener);
      window.removeEventListener('solanaWallet:walletDisconnect', handleWalletDisconnect as EventListener);
      window.removeEventListener('solanaWallet:walletError', handleWalletError as EventListener);
      window.removeEventListener('solanaWallet:balanceChange', handleBalanceChange as EventListener);
    };
  }, []);
  
  // Connect wallet
  const connectWallet = useCallback(async (walletType?: SolanaWalletType) => {
    if (!serviceRef.current) {
      throw new WalletError('Service not initialized', 'SERVICE_NOT_READY');
    }
    
    setConnecting(true);
    setError(null);
    
    try {
      let connectedWallet: SolanaWallet;
      
      if (walletType) {
        connectedWallet = await serviceRef.current.connect(walletType);
      } else {
        connectedWallet = await serviceRef.current.connectBestAvailable();
      }
      
      setWallet(connectedWallet);
      
      // Load initial balance
      const solBalance = await serviceRef.current.getSolBalance();
      setBalance(solBalance);
      
      // Load network info
      const netInfo = await serviceRef.current.getNetworkInfo();
      setNetworkInfo(netInfo);
      
    } catch (err) {
      const walletError = err instanceof WalletError ? err : new WalletError('Connection failed', 'CONNECTION_FAILED');
      setError(walletError);
      throw walletError;
    } finally {
      setConnecting(false);
    }
  }, []);
  
  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    if (!serviceRef.current) {
      return;
    }
    
    setDisconnecting(true);
    setError(null);
    
    try {
      await serviceRef.current.disconnect();
      setWallet(null);
      setBalance(null);
      setNetworkInfo(null);
    } catch (err) {
      const walletError = err instanceof WalletError ? err : new WalletError('Disconnection failed', 'DISCONNECT_FAILED');
      setError(walletError);
    } finally {
      setDisconnecting(false);
    }
  }, []);
  
  // Send transaction
  const sendTransaction = useCallback(async (transaction: any): Promise<string> => {
    if (!serviceRef.current) {
      throw new WalletError('Service not initialized', 'SERVICE_NOT_READY');
    }
    
    if (!wallet) {
      throw new WalletError('No wallet connected', 'NO_WALLET');
    }
    
    try {
      const result = await serviceRef.current.sendTransaction(transaction);
      return result.signature;
    } catch (err) {
      const walletError = err instanceof WalletError ? err : new WalletError('Transaction failed', 'TRANSACTION_FAILED');
      setError(walletError);
      throw walletError;
    }
  }, [wallet]);
  
  // Sign message
  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!serviceRef.current) {
      throw new WalletError('Service not initialized', 'SERVICE_NOT_READY');
    }
    
    if (!wallet) {
      throw new WalletError('No wallet connected', 'NO_WALLET');
    }
    
    try {
      return await serviceRef.current.signMessage(message);
    } catch (err) {
      const walletError = err instanceof WalletError ? err : new WalletError('Message signing failed', 'SIGN_FAILED');
      setError(walletError);
      throw walletError;
    }
  }, [wallet]);
  
  // Check if wallet is installed
  const isWalletInstalled = useCallback((walletType: SolanaWalletType): boolean => {
    return installedWallets.some(w => w.type === walletType);
  }, [installedWallets]);
  
  // Get installation instructions
  const getInstallationInstructions = useCallback((walletType: SolanaWalletType) => {
    if (!serviceRef.current) {
      throw new WalletError('Service not initialized', 'SERVICE_NOT_READY');
    }
    
    return serviceRef.current.getInstallationInstructions(walletType);
  }, []);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return {
    // State
    wallet,
    connected: !!wallet?.connected,
    connecting,
    disconnecting,
    
    // Available wallets
    availableWallets,
    installedWallets,
    hasWallets: installedWallets.length > 0,
    
    // Balance and network
    balance,
    networkInfo,
    
    // Actions
    connect: connectWallet,
    disconnect: disconnectWallet,
    sendTransaction,
    signMessage,
    
    // Utilities
    isWalletInstalled,
    getInstallationInstructions,
    
    // Error handling
    error,
    clearError
  };
}

/**
 * Hook for wallet detection without connecting
 */
export function useWalletDetection(config: SolanaWalletServiceConfig) {
  const [availableWallets, setAvailableWallets] = useState<WalletAdapterInfo[]>([]);
  const [installedWallets, setInstalledWallets] = useState<WalletAdapterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WalletError | null>(null);
  
  useEffect(() => {
    const detectWallets = async () => {
      try {
        const service = new SolanaWalletService(config);
        await service.initialize();
        
        const available = await service.getAvailableWallets();
        const installed = await service.getInstalledWallets();
        
        setAvailableWallets(available);
        setInstalledWallets(installed);
        
        await service.cleanup();
      } catch (err) {
        setError(err instanceof WalletError ? err : new WalletError('Detection failed', 'DETECTION_FAILED'));
      } finally {
        setLoading(false);
      }
    };
    
    detectWallets();
  }, [config]);
  
  return {
    availableWallets,
    installedWallets,
    hasWallets: installedWallets.length > 0,
    loading,
    error
  };
}