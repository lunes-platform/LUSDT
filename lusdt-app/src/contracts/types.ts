// Tipos baseados nos contratos reais
export interface LusdtTokenContract {
  // Funções principais do token
  mint: (to: string, amount: string) => Promise<string>;
  burn: (amount: string, solanaRecipient: string) => Promise<string>;
  transfer: (to: string, amount: string) => Promise<string>;
  balanceOf: (account: string) => Promise<string>;
  totalSupply: () => Promise<string>;
  
  // Funções administrativas
  getOwner: () => Promise<string>;
  getBridgeAccount: () => Promise<string>;
  setBridgeAccount: (newBridge: string) => Promise<string>;
  
  // Controle de emergência
  isPaused: () => Promise<boolean>;
  emergencyPause: () => Promise<string>;
  emergencyUnpause: () => Promise<string>;
}

export interface TaxManagerContract {
  // Processamento de taxas
  processFees: (operation: 'Mint' | 'Burn', user: string, amount: string) => Promise<string>;
  processFeesFlexible: (
    operation: 'Mint' | 'Burn', 
    user: string, 
    amount: string, 
    feeType: 'Lunes' | 'Lusdt' | 'Usdt'
  ) => Promise<string>;
  
  // Configurações
  getLunesPrice: () => Promise<string>;
  updateLunesPrice: (newPrice: string) => Promise<string>;
  getCurrentFeeBps: () => Promise<number>;
  getMonthlyVolumeUsd: () => Promise<string>;
  
  // Carteiras de distribuição
  getWallets: () => Promise<DistributionWallets>;
  updateDistributionWallets: (wallets: DistributionWallets) => Promise<string>;
}

export interface DistributionWallets {
  devSolana: string;
  devLunes: string;
  insuranceFund: string;
}

export interface FeeConfig {
  baseFee: number; // em basis points (100 = 1%)
  volumeThreshold1: string; // em USD
  volumeThreshold2: string; // em USD
  lowVolumeFee: number; // basis points
  mediumVolumeFee: number; // basis points
  highVolumeFee: number; // basis points
}

// Eventos dos contratos
export interface TransferEvent {
  from?: string;
  to?: string;
  value: string;
  blockTimestamp: number;
}

export interface RedemptionRequestedEvent {
  from: string;
  amount: string;
  solanaRecipientAddress: string;
  requestId: string;
  blockTimestamp: number;
}

export interface FeesProcessedEvent {
  operation: 'Mint' | 'Burn';
  user: string;
  lusdtAmount: string;
  feeInLunes: string;
}

// ═══ Staking Manager Contract ═══

export interface StakingManagerContract {
  // User actions
  stake: (amount: string) => Promise<string>;
  unstake: () => Promise<string>;
  claimRewards: () => Promise<string>;

  // Queries
  getStakerInfo: (user: string) => Promise<StakerInfo>;
  getPendingRewards: (user: string) => Promise<string>;
  getTotalStaked: () => Promise<string>;
  getStakerCount: () => Promise<number>;
  getTotalRewardsDeposited: () => Promise<string>;
  getTotalRewardsClaimed: () => Promise<string>;
  getMinStake: () => Promise<string>;
  isPaused: () => Promise<boolean>;
  getUndistributedRewards: () => Promise<string>;
}

export interface StakerInfo {
  amount: string;         // LUNES staked (raw, 12 decimals)
  rewardPerTokenPaid: string;
  pendingRewards: string; // LUSDT rewards (raw, 6 decimals)
  stakedAt: number;       // Timestamp ms
}