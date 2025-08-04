// Types for LUSDT Token Contract
export interface TokenInfo {
  totalSupply: string;
  owner: string;
  bridgeAccount: string;
  emergencyAdmin: string;
  taxManagerContract: string;
  isPaused: boolean;
  pauseReason?: string;
}

// Types for Tax Manager Contract
export interface TaxManagerInfo {
  owner: string;
  lunesPrice: string;
  monthlyVolume: string;
  distributionWallets: DistributionWallets;
  feeConfig: FeeConfig;
}

export interface DistributionWallets {
  development: string;
  marketing: string;
  burn: string;
  reserve: string;
}

export interface FeeConfig {
  baseFeeUsd: string;
  percentageFee: number; // em basis points (100 = 1%)
  minFeeUsd: string;
  maxFeeUsd: string;
}

// Transaction types
export interface TransactionResult {
  txHash: string;
  blockHash?: string;
  success: boolean;
  error?: string;
}

// Common types
export interface Account {
  address: string;
  name?: string;
  meta: {
    name: string;
    source: string;
  };
}

export interface ContractError {
  message: string;
  code?: string;
  details?: any;
}

// Admin permissions
export enum AdminRole {
  OWNER = 'owner',
  BRIDGE = 'bridge',
  EMERGENCY_ADMIN = 'emergency_admin',
  NONE = 'none'
}

export interface AdminPermissions {
  role: AdminRole;
  canMint: boolean;
  canPause: boolean;
  canUpdateBridge: boolean;
  canUpdateTaxManager: boolean;
  canManageTaxes: boolean;
}