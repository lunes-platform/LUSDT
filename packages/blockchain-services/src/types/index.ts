// Common types for blockchain services

export interface WalletConnection {
  address: string;
  publicKey: string;
  connected: boolean;
  name: string;
  icon?: string;
}

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  symbol: string;
  name: string;
}

export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
  blockHeight?: number;
  confirmations?: number;
}

export interface NetworkStatus {
  connected: boolean;
  blockHeight: number;
  lastUpdate: Date;
}

// Solana specific types
export interface SolanaWallet extends WalletConnection {
  adapter: any; // Wallet adapter instance
}

export interface SolanaTokenAccount {
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
}

export interface SolanaTransaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized';
}

// Lunes/Polkadot specific types
export interface LunesWallet extends WalletConnection {
  signer: any; // Polkadot signer instance
}

export interface ContractCall {
  contractAddress: string;
  method: string;
  args: any[];
  value?: number;
  gasLimit?: number;
}

export interface ContractResult {
  transactionHash: string;
  blockNumber: number;
  gasUsed: number;
  success: boolean;
  events?: any[];
}

// Bridge specific types
export interface DepositParams {
  amount: number;
  destinationAddress: string;
  memo?: string;
}

export interface RedemptionParams {
  amount: number;
  destinationAddress: string;
  feeType: 'lunes' | 'lusdt' | 'usdt';
}

export interface BridgeTransaction {
  id: string;
  type: 'deposit' | 'redemption';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  fee: number;
  sourceNetwork: 'solana' | 'lunes';
  destinationNetwork: 'solana' | 'lunes';
  sourceTransaction?: string;
  destinationTransaction?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Error types
export class WalletError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

export class TransactionError extends Error {
  constructor(
    message: string,
    public code: string,
    public transactionId?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public network: 'solana' | 'lunes',
    public cause?: Error
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}