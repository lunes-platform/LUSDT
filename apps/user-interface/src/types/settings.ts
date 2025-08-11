export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    enabled: boolean;
    email: boolean;
    push: boolean;
    transactionUpdates: boolean;
    marketingEmails: boolean;
  };
  privacy: {
    analytics: boolean;
    crashReporting: boolean;
  };
  trading: {
    defaultSlippage: number;
    autoApprove: boolean;
    confirmTransactions: boolean;
  };
  display: {
    currency: 'USD' | 'EUR' | 'BTC' | 'ETH';
    language: 'en' | 'es' | 'pt' | 'fr';
    timezone: string;
    compactMode: boolean;
  };
  networks: {
    solana: {
      rpcUrl: string;
      network: 'mainnet-beta' | 'devnet' | 'testnet';
    };
    lunes: {
      rpcUrl: string;
      network: 'mainnet' | 'testnet';
    };
  };
}

export interface SettingsState {
  preferences: UserPreferences;
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
}

export interface SettingsActions {
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  resetToDefaults: () => void;
  saveSettings: () => Promise<void>;
  loadSettings: () => Promise<void>;
  clearError: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;