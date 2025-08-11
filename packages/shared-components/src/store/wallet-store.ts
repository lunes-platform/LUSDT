import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
// Tipos locais mínimos para evitar dependência de @lusdt/blockchain-services
export interface SolanaWallet { connected: boolean; address: string }
export interface LunesWallet { connected: boolean; address: string }
export interface TokenBalance { mint: string; amount: number; decimals?: number }
export interface WalletError { code?: string | number; message: string }

export interface WalletState {
  // Solana wallet state
  solanaWallet: SolanaWallet | null;
  solanaConnecting: boolean;
  solanaBalances: TokenBalance[];
  
  // Lunes wallet state
  lunesWallet: LunesWallet | null;
  lunesConnecting: boolean;
  lunesBalance: number;
  
  // General state
  error: string | null;
  lastUpdated: Date | null;
}

export interface WalletActions {
  // Solana actions
  setSolanaWallet: (wallet: SolanaWallet | null) => void;
  setSolanaConnecting: (connecting: boolean) => void;
  setSolanaBalances: (balances: TokenBalance[]) => void;
  updateSolanaBalance: (mint: string, balance: TokenBalance) => void;
  
  // Lunes actions
  setLunesWallet: (wallet: LunesWallet | null) => void;
  setLunesConnecting: (connecting: boolean) => void;
  setLunesBalance: (balance: number) => void;
  
  // General actions
  setError: (error: string | null) => void;
  clearError: () => void;
  disconnectAll: () => void;
  updateLastUpdated: () => void;
  
  // Computed getters
  isAnyWalletConnected: () => boolean;
  getTokenBalance: (mint: string) => TokenBalance | null;
}

export type WalletStore = WalletState & WalletActions;

/**
 * Store global para gerenciar estado das carteiras
 */
export const useWalletStore = create<WalletStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    solanaWallet: null,
    solanaConnecting: false,
    solanaBalances: [],
    lunesWallet: null,
    lunesConnecting: false,
    lunesBalance: 0,
    error: null,
    lastUpdated: null,

    // Solana actions
    setSolanaWallet: (wallet) => {
      set({ 
        solanaWallet: wallet,
        solanaConnecting: false,
        error: null,
        lastUpdated: new Date()
      });
    },

    setSolanaConnecting: (connecting) => {
      set({ solanaConnecting: connecting });
      if (connecting) {
        set({ error: null });
      }
    },

    setSolanaBalances: (balances) => {
      set({ 
        solanaBalances: balances,
        lastUpdated: new Date()
      });
    },

    updateSolanaBalance: (mint, balance) => {
      const currentBalances = get().solanaBalances;
      const updatedBalances = currentBalances.filter(b => b.mint !== mint);
      updatedBalances.push(balance);
      
      set({ 
        solanaBalances: updatedBalances,
        lastUpdated: new Date()
      });
    },

    // Lunes actions
    setLunesWallet: (wallet) => {
      set({ 
        lunesWallet: wallet,
        lunesConnecting: false,
        error: null,
        lastUpdated: new Date()
      });
    },

    setLunesConnecting: (connecting) => {
      set({ lunesConnecting: connecting });
      if (connecting) {
        set({ error: null });
      }
    },

    setLunesBalance: (balance) => {
      set({ 
        lunesBalance: balance,
        lastUpdated: new Date()
      });
    },

    // General actions
    setError: (error) => {
      set({ 
        error,
        solanaConnecting: false,
        lunesConnecting: false
      });
    },

    clearError: () => {
      set({ error: null });
    },

    disconnectAll: () => {
      set({
        solanaWallet: null,
        solanaConnecting: false,
        solanaBalances: [],
        lunesWallet: null,
        lunesConnecting: false,
        lunesBalance: 0,
        error: null,
        lastUpdated: new Date()
      });
    },

    updateLastUpdated: () => {
      set({ lastUpdated: new Date() });
    },

    // Computed getters
    isAnyWalletConnected: () => {
      const state = get();
      return !!(state.solanaWallet?.connected || state.lunesWallet?.connected);
    },

    getTokenBalance: (mint) => {
      const balances = get().solanaBalances;
      return balances.find(b => b.mint === mint) || null;
    }
  }))
);

// Selectors for better performance
export const selectSolanaWallet = (state: WalletStore) => state.solanaWallet;
export const selectLunesWallet = (state: WalletStore) => state.lunesWallet;
export const selectIsConnecting = (state: WalletStore) => 
  state.solanaConnecting || state.lunesConnecting;
export const selectWalletError = (state: WalletStore) => state.error;
export const selectSolanaBalances = (state: WalletStore) => state.solanaBalances;
export const selectLunesBalance = (state: WalletStore) => state.lunesBalance;

// Hooks for common use cases
export const useSolanaWallet = () => useWalletStore(selectSolanaWallet);
export const useLunesWallet = () => useWalletStore(selectLunesWallet);
export const useWalletError = () => useWalletStore(selectWalletError);
export const useIsWalletConnecting = () => useWalletStore(selectIsConnecting);