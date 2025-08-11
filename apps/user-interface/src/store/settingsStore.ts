import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SettingsStore, UserPreferences } from '../types/settings';

const defaultPreferences: UserPreferences = {
  theme: 'system',
  notifications: {
    enabled: true,
    email: true,
    push: false,
    transactionUpdates: true,
    marketingEmails: false,
  },
  privacy: {
    analytics: false,
    crashReporting: true,
  },
  trading: {
    defaultSlippage: 0.5,
    autoApprove: false,
    confirmTransactions: true,
  },
  display: {
    currency: 'USD',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    compactMode: false,
  },
  networks: {
    solana: {
      rpcUrl: 'https://api.devnet.solana.com',
      network: 'devnet',
    },
    lunes: {
      rpcUrl: 'wss://rpc.lunes.io',
      network: 'mainnet',
    },
  },
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      preferences: defaultPreferences,
      isLoading: false,
      error: null,
      hasUnsavedChanges: false,

      updatePreferences: (updates) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...updates,
            // Handle nested updates properly
            notifications: updates.notifications 
              ? { ...state.preferences.notifications, ...updates.notifications }
              : state.preferences.notifications,
            privacy: updates.privacy 
              ? { ...state.preferences.privacy, ...updates.privacy }
              : state.preferences.privacy,
            trading: updates.trading 
              ? { ...state.preferences.trading, ...updates.trading }
              : state.preferences.trading,
            display: updates.display 
              ? { ...state.preferences.display, ...updates.display }
              : state.preferences.display,
            networks: updates.networks 
              ? {
                  solana: updates.networks.solana 
                    ? { ...state.preferences.networks.solana, ...updates.networks.solana }
                    : state.preferences.networks.solana,
                  lunes: updates.networks.lunes 
                    ? { ...state.preferences.networks.lunes, ...updates.networks.lunes }
                    : state.preferences.networks.lunes,
                }
              : state.preferences.networks,
          },
          hasUnsavedChanges: true,
        }));
      },

      resetToDefaults: () => {
        set({
          preferences: defaultPreferences,
          hasUnsavedChanges: true,
        });
      },

      saveSettings: async () => {
        set({ isLoading: true, error: null });
        
        try {
          // Mock API call - in real implementation, this would save to backend
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          set({ 
            isLoading: false,
            hasUnsavedChanges: false,
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to save settings',
            isLoading: false 
          });
        }
      },

      loadSettings: async () => {
        set({ isLoading: true, error: null });
        
        try {
          // Mock API call - in real implementation, this would load from backend
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // For now, just use the persisted settings
          set({ 
            isLoading: false,
            hasUnsavedChanges: false,
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load settings',
            isLoading: false 
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'lusdt-settings-store',
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
);

export default useSettingsStore;