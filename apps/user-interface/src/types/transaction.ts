export interface Transaction {
  id: string;
  type: 'deposit' | 'redemption';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  fromToken: 'USDT' | 'LUSDT';
  toToken: 'USDT' | 'LUSDT';
  fromAddress: string;
  toAddress: string;
  fromNetwork: 'solana' | 'lunes';
  toNetwork: 'solana' | 'lunes';
  txHash?: string;
  bridgeTxHash?: string;
  timestamp: Date;
  estimatedTime?: number; // in minutes
  fee: number;
  error?: string;
}

export interface TransactionFilter {
  status?: Transaction['status'][];
  type?: Transaction['type'][];
  dateRange?: {
    start: Date;
    end: Date;
  };
  amountRange?: {
    min: number;
    max: number;
  };
}

export interface TransactionSummary {
  totalTransactions: number;
  totalVolume: number;
  successfulTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  averageAmount: number;
  totalFees: number;
}