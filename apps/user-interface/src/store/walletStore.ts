import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WalletStore, WalletState, SolanaWallet, LunesWallet, WalletReadyState } from '../types/wallet';

// Mock wallet detection for now - will be replaced with actual wallet adapters
const detectSolanaWallets = () => {
  const wallets = [
    {
      name: 'Phantom',
      icon: '/phantom-icon.png',
      url: 'https://phantom.app',
      installed: typeof window !== 'undefined' && 'solana' in window && window.solana?.isPhantom,
      readyState: typeof window !== 'undefined' && 'solana' in window && window.solana?.isPhantom 
        ? WalletReadyState.Installed 
        : WalletReadyState.NotDetected
    },
    {
      name: 'Solflare',
      icon: '/solflare-icon.png',
      url: 'https://solflare.com',
      installed: typeof window !== 'undefined' && 'solflare' in window,
      readyState: typeof window !== 'undefined' && 'solflare' in window 
        ? WalletReadyState.Installed 
        : WalletReadyState.NotDetected
    }
  ];
  
  return wallets;
};

const detectLunesWallet = () => {
  return typeof window !== 'undefined' && 'injectedWeb3' in window;
};

const initialState: WalletState = {
  solana: null,
  lunes: null,
  isConnecting: false,
  error: null
};

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      connectSolanaWallet: async (walletName: string) => {
        set({ isConnecting: true, error: null });
        
        try {
          // Mock connection for now
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const mockWallet: SolanaWallet = {
            publicKey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
            connected: true,
            connecting: false,
            disconnecting: false,
            wallet: {
              name: walletName,
              icon: `/${walletName.toLowerCase()}-icon.png`,
              url: `https://${walletName.toLowerCase()}.app`,
              installed: true,
              readyState: WalletReadyState.Installed
            },
            balance: 100.5 // Mock balance
          };
          
          set({ 
            solana: mockWallet,
            isConnecting: false 
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to connect Solana wallet',
            isConnecting: false 
          });
        }
      },

      connectLunesWallet: async () => {
        set({ isConnecting: true, error: null });
        
        try {
          // Mock connection for now
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const mockWallet: LunesWallet = {
            address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
            connected: true,
            connecting: false,
            disconnecting: false,
            account: null, // Mock account
            balance: 250.75 // Mock balance
          };
          
          set({ 
            lunes: mockWallet,
            isConnecting: false 
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to connect Lunes wallet',
            isConnecting: false 
          });
        }
      },

      disconnectSolanaWallet: async () => {
        const { solana } = get();
        if (!solana) return;
        
        set({ 
          solana: { 
            ...solana, 
            disconnecting: true 
          } 
        });
        
        try {
          // Mock disconnection
          await new Promise(resolve => setTimeout(resolve, 500));
          
          set({ solana: null });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to disconnect Solana wallet',
            solana: { 
              ...solana, 
              disconnecting: false 
            }
          });
        }
      },

      disconnectLunesWallet: async () => {
        const { lunes } = get();
        if (!lunes) return;
        
        set({ 
          lunes: { 
            ...lunes, 
            disconnecting: true 
          } 
        });
        
        try {
          // Mock disconnection
          await new Promise(resolve => setTimeout(resolve, 500));
          
          set({ lunes: null });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to disconnect Lunes wallet',
            lunes: { 
              ...lunes, 
              disconnecting: false 
            }
          });
        }
      },

      disconnectAllWallets: async () => {
        const { disconnectSolanaWallet, disconnectLunesWallet } = get();
        await Promise.all([
          disconnectSolanaWallet(),
          disconnectLunesWallet()
        ]);
      },

      refreshBalances: async () => {
        const { solana, lunes } = get();
        
        try {
          // Mock balance refresh
          if (solana) {
            set({
              solana: {
                ...solana,
                balance: Math.random() * 1000 // Mock new balance
              }
            });
          }
          
          if (lunes) {
            set({
              lunes: {
                ...lunes,
                balance: Math.random() * 1000 // Mock new balance
              }
            });
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to refresh balances'
          });
        }
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'lusdt-wallet-store',
      partialize: (state) => ({
        // Only persist connection status, not sensitive data
        solana: state.solana ? {
          ...state.solana,
          connecting: false,
          disconnecting: false
        } : null,
        lunes: state.lunes ? {
          ...state.lunes,
          connecting: false,
          disconnecting: false
        } : null
      })
    }
  )
);

// Utility functions
export const getSolanaWallets = detectSolanaWallets;
export const isLunesWalletAvailable = detectLunesWallet;