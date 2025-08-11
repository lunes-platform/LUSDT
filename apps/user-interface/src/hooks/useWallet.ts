import { useCallback, useEffect } from 'react';
import { useWalletStore } from '../store/walletStore';

export const useWallet = () => {
  const store = useWalletStore();

  // Auto-refresh balances every 30 seconds when wallets are connected
  useEffect(() => {
    const hasConnectedWallets = store.solana?.connected || store.lunes?.connected;
    
    if (!hasConnectedWallets) return;

    const interval = setInterval(() => {
      store.refreshBalances();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [store.solana?.connected, store.lunes?.connected, store.refreshBalances]);

  // Utility functions
  const isFullyConnected = useCallback(() => {
    return store.solana?.connected && store.lunes?.connected;
  }, [store.solana?.connected, store.lunes?.connected]);

  const hasAnyConnection = useCallback(() => {
    return store.solana?.connected || store.lunes?.connected;
  }, [store.solana?.connected, store.lunes?.connected]);

  const canDeposit = useCallback(() => {
    return store.solana?.connected && store.lunes?.connected;
  }, [store.solana?.connected, store.lunes?.connected]);

  const canRedeem = useCallback(() => {
    return store.lunes?.connected && store.solana?.connected;
  }, [store.lunes?.connected, store.solana?.connected]);

  const getTotalUSDTBalance = useCallback(() => {
    return (store.solana?.balance || 0) + (store.lunes?.balance || 0);
  }, [store.solana?.balance, store.lunes?.balance]);

  return {
    ...store,
    // Computed values
    isFullyConnected: isFullyConnected(),
    hasAnyConnection: hasAnyConnection(),
    canDeposit: canDeposit(),
    canRedeem: canRedeem(),
    totalBalance: getTotalUSDTBalance(),
    
    // Utility functions
    isFullyConnected,
    hasAnyConnection,
    canDeposit,
    canRedeem,
    getTotalUSDTBalance
  };
};

export default useWallet;