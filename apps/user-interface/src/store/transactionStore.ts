import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Transaction, TransactionFilter, TransactionSummary } from '../types/transaction';

interface TransactionState {
  transactions: Transaction[];
  filter: TransactionFilter;
  isLoading: boolean;
  error: string | null;
}

interface TransactionActions {
  addTransaction: (transaction: Omit<Transaction, 'id' | 'timestamp'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  setFilter: (filter: Partial<TransactionFilter>) => void;
  clearFilter: () => void;
  getFilteredTransactions: () => Transaction[];
  getTransactionSummary: () => TransactionSummary;
  refreshTransactions: () => Promise<void>;
  clearError: () => void;
}

type TransactionStore = TransactionState & TransactionActions;

// Mock transaction data for development
const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'deposit',
    status: 'completed',
    amount: 100,
    fromToken: 'USDT',
    toToken: 'LUSDT',
    fromAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    toAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    fromNetwork: 'solana',
    toNetwork: 'lunes',
    txHash: '5j7s8K9mN2pQ3rT4uV5wX6yZ7aB8cD9eF0gH1iJ2kL3mN4oP5qR6sT7uV8wX9yZ0',
    bridgeTxHash: '0x1234567890abcdef1234567890abcdef12345678',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    fee: 0.5,
  },
  {
    id: '2',
    type: 'redemption',
    status: 'processing',
    amount: 50,
    fromToken: 'LUSDT',
    toToken: 'USDT',
    fromAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    toAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    fromNetwork: 'lunes',
    toNetwork: 'solana',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    estimatedTime: 15,
    fee: 0.25,
  },
  {
    id: '3',
    type: 'deposit',
    status: 'failed',
    amount: 200,
    fromToken: 'USDT',
    toToken: 'LUSDT',
    fromAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    toAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    fromNetwork: 'solana',
    toNetwork: 'lunes',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    fee: 1.0,
    error: 'Insufficient balance for transaction fees',
  }
];

const initialState: TransactionState = {
  transactions: mockTransactions,
  filter: {},
  isLoading: false,
  error: null,
};

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addTransaction: (transactionData) => {
        const transaction: Transaction = {
          ...transactionData,
          id: Date.now().toString(),
          timestamp: new Date(),
        };

        set((state) => ({
          transactions: [transaction, ...state.transactions],
        }));
      },

      updateTransaction: (id, updates) => {
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, ...updates } : tx
          ),
        }));
      },

      setFilter: (newFilter) => {
        set((state) => ({
          filter: { ...state.filter, ...newFilter },
        }));
      },

      clearFilter: () => {
        set({ filter: {} });
      },

      getFilteredTransactions: () => {
        const { transactions, filter } = get();
        
        return transactions.filter((tx) => {
          // Status filter
          if (filter.status && filter.status.length > 0) {
            if (!filter.status.includes(tx.status)) return false;
          }

          // Type filter
          if (filter.type && filter.type.length > 0) {
            if (!filter.type.includes(tx.type)) return false;
          }

          // Date range filter
          if (filter.dateRange) {
            const txDate = new Date(tx.timestamp);
            if (txDate < filter.dateRange.start || txDate > filter.dateRange.end) {
              return false;
            }
          }

          // Amount range filter
          if (filter.amountRange) {
            if (tx.amount < filter.amountRange.min || tx.amount > filter.amountRange.max) {
              return false;
            }
          }

          return true;
        });
      },

      getTransactionSummary: () => {
        const transactions = get().getFilteredTransactions();
        
        const summary: TransactionSummary = {
          totalTransactions: transactions.length,
          totalVolume: transactions.reduce((sum, tx) => sum + tx.amount, 0),
          successfulTransactions: transactions.filter(tx => tx.status === 'completed').length,
          pendingTransactions: transactions.filter(tx => tx.status === 'pending' || tx.status === 'processing').length,
          failedTransactions: transactions.filter(tx => tx.status === 'failed').length,
          averageAmount: 0,
          totalFees: transactions.reduce((sum, tx) => sum + tx.fee, 0),
        };

        summary.averageAmount = summary.totalTransactions > 0 
          ? summary.totalVolume / summary.totalTransactions 
          : 0;

        return summary;
      },

      refreshTransactions: async () => {
        set({ isLoading: true, error: null });
        
        try {
          // Mock API call - in real implementation, this would fetch from the bridge API
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // For now, just simulate some updates to existing transactions
          const { transactions } = get();
          const updatedTransactions = transactions.map(tx => {
            if (tx.status === 'processing') {
              // Randomly complete some processing transactions
              return Math.random() > 0.5 
                ? { ...tx, status: 'completed' as const }
                : tx;
            }
            return tx;
          });

          set({ 
            transactions: updatedTransactions,
            isLoading: false 
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to refresh transactions',
            isLoading: false 
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'lusdt-transaction-store',
      partialize: (state) => ({
        transactions: state.transactions,
        filter: state.filter,
      }),
    }
  )
);

export default useTransactionStore;