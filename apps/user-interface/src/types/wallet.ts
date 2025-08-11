// Wallet-specific types for the user interface

export interface WalletInfo {
  name: string;
  icon: string;
  url: string;
  installed: boolean;
  readyState: WalletReadyState;
}

export enum WalletReadyState {
  Installed = 'Installed',
  NotDetected = 'NotDetected',
  Loadable = 'Loadable',
  Loading = 'Loading',
  Unsupported = 'Unsupported'
}

export interface SolanaWallet {
  publicKey: string;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  wallet: WalletInfo | null;
  balance: number;
}

export interface LunesWallet {
  address: string;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  account: any; // Polkadot account type
  balance: number;
}

export interface WalletState {
  solana: SolanaWallet | null;
  lunes: LunesWallet | null;
  isConnecting: boolean;
  error: string | null;
}

export interface WalletActions {
  connectSolanaWallet: (walletName: string) => Promise<void>;
  connectLunesWallet: () => Promise<void>;
  disconnectSolanaWallet: () => Promise<void>;
  disconnectLunesWallet: () => Promise<void>;
  disconnectAllWallets: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  clearError: () => void;
}

export type WalletStore = WalletState & WalletActions;