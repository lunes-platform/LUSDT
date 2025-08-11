import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
// Tipo local mínimo para transações de bridge (evita dependência de services)
export type BridgeTransaction = {
  id: string;
  type: 'deposit' | 'redemption';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  from?: string;
  to?: string;
  createdAt: Date;
  updatedAt?: Date;
  txHash?: string;
};

export interface TransactionState {
  // Active transactions
  pendingTransactions: BridgeTransaction[];
  completedTransactions: BridgeTransaction[];
  failedTransactions: BridgeTransaction[];
  
  // Transaction history
  transactionHistory: BridgeTransaction[];
  historyLoading: boolean;
  historyError: string | null;
  
  // Current transaction being tracked
  currentTransaction: BridgeTransaction | null;
  trackingStatus: 'idle' | 'tracking' | 'error';
  
  // Pagination
  currentPage: number;
  totalPages: number;
  totalTransactions: number;
  
  // Filters
  filters: {
    type?: 'deposit' | 'redemption';
    status?: BridgeTransaction['status'];
    dateFrom?: Date;
    dateTo?: Date;
  };
  
  // Last update timestamp
  lastUpdated: Date | null;
}

export interface TransactionActions {
  // Transaction management
  addTransaction: (transaction: BridgeTransaction) => void;
  updateTransaction: (id: string, updates: Partial<BridgeTransaction>) => void;
  removeTransaction: (id: string) => void;
  
  // History management
  setTransactionHistory: (transactions: BridgeTransaction[]) => void;
  addToHistory: (transaction: BridgeTransaction) => void;
  setHistoryLoading: (loading: boolean) => void;
  setHistoryError: (error: string | null) => void;
  
  // Current transaction tracking
  setCurrentTransaction: (transaction: BridgeTransaction | null) => void;
  setTrackingStatus: (status: 'idle' | 'tracking' | 'error') => void;
  
  // Pagination
  setCurrentPage: (page: number) => void;
  setPagination: (current: number, total: number, totalTransactions: number) => void;
  
  // Filters
  setFilters: (filters: TransactionState['filters']) => void;
  clearFilters: () => void;
  
  // Utility actions
  clearAll: () => void;
  updateLastUpdated: () => void;
  
  // Computed getters
  getAllTransactions: () => BridgeTransaction[];
  getTransactionById: (id: string) => BridgeTransaction | null;
  getTransactionsByStatus: (status: BridgeTransaction['status']) => BridgeTransaction[];
  getTransactionsByType: (type: 'deposit' | 'redemption') => BridgeTransaction[];
  getPendingCount: () => number;
  getCompletedCount: () => number;
  getFailedCount: () => number;
}

export type TransactionStore = TransactionState & TransactionActions;

/**
 * Store global para gerenciar estado das transações
 */
export const useTransactionStore = create<TransactionStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    pendingTransactions: [],
    completedTransactions: [],
    failedTransactions: [],
    transactionHistory: [],
    historyLoading: false,
    historyError: null,
    currentTransaction: null,
    trackingStatus: 'idle',
    currentPage: 1,
    totalPages: 1,
    totalTransactions: 0,
    filters: {},
    lastUpdated: null,

    // Transaction management
    addTransaction: (transaction) => {
      const state = get();
      
      // Add to appropriate list based on status
      switch (transaction.status) {
        case 'pending':
        case 'processing':
          set({
            pendingTransactions: [...state.pendingTransactions, transaction],
            lastUpdated: new Date()
          });
          break;
        case 'completed':
          set({
            completedTransactions: [...state.completedTransactions, transaction],
            lastUpdated: new Date()
          });
          break;
        case 'failed':
        case 'cancelled':
          set({
            failedTransactions: [...state.failedTransactions, transaction],
            lastUpdated: new Date()
          });
          break;
      }
      
      // Also add to history if not already there
      const existsInHistory = state.transactionHistory.some(t => t.id === transaction.id);
      if (!existsInHistory) {
        set({
          transactionHistory: [transaction, ...state.transactionHistory],
          totalTransactions: state.totalTransactions + 1
        });
      }
    },

    updateTransaction: (id, updates) => {
      const state = get();
      const updateTransactionInList = (list: BridgeTransaction[]) =>
        list.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t);

      // Find and update in all lists
      const updatedPending = updateTransactionInList(state.pendingTransactions);
      const updatedCompleted = updateTransactionInList(state.completedTransactions);
      const updatedFailed = updateTransactionInList(state.failedTransactions);
      const updatedHistory = updateTransactionInList(state.transactionHistory);

      // If status changed, move between lists
      const transaction = state.transactionHistory.find(t => t.id === id);
      if (transaction && updates.status && updates.status !== transaction.status) {
        // Remove from current list
        const filteredPending = state.pendingTransactions.filter(t => t.id !== id);
        const filteredCompleted = state.completedTransactions.filter(t => t.id !== id);
        const filteredFailed = state.failedTransactions.filter(t => t.id !== id);

        // Add to new list
        const updatedTransaction = { ...transaction, ...updates, updatedAt: new Date() };
        switch (updates.status) {
          case 'pending':
          case 'processing':
            set({
              pendingTransactions: [...filteredPending, updatedTransaction],
              completedTransactions: filteredCompleted,
              failedTransactions: filteredFailed,
              transactionHistory: updatedHistory,
              lastUpdated: new Date()
            });
            break;
          case 'completed':
            set({
              pendingTransactions: filteredPending,
              completedTransactions: [...filteredCompleted, updatedTransaction],
              failedTransactions: filteredFailed,
              transactionHistory: updatedHistory,
              lastUpdated: new Date()
            });
            break;
          case 'failed':
          case 'cancelled':
            set({
              pendingTransactions: filteredPending,
              completedTransactions: filteredCompleted,
              failedTransactions: [...filteredFailed, updatedTransaction],
              transactionHistory: updatedHistory,
              lastUpdated: new Date()
            });
            break;
        }
      } else {
        // Just update in place
        set({
          pendingTransactions: updatedPending,
          completedTransactions: updatedCompleted,
          failedTransactions: updatedFailed,
          transactionHistory: updatedHistory,
          lastUpdated: new Date()
        });
      }

      // Update current transaction if it's the one being updated
      if (state.currentTransaction?.id === id) {
        set({
          currentTransaction: { ...state.currentTransaction, ...updates, updatedAt: new Date() }
        });
      }
    },

    removeTransaction: (id) => {
      const state = get();
      set({
        pendingTransactions: state.pendingTransactions.filter(t => t.id !== id),
        completedTransactions: state.completedTransactions.filter(t => t.id !== id),
        failedTransactions: state.failedTransactions.filter(t => t.id !== id),
        transactionHistory: state.transactionHistory.filter(t => t.id !== id),
        totalTransactions: Math.max(0, state.totalTransactions - 1),
        lastUpdated: new Date()
      });

      if (state.currentTransaction?.id === id) {
        set({ currentTransaction: null });
      }
    },

    // History management
    setTransactionHistory: (transactions) => {
      set({
        transactionHistory: transactions,
        historyLoading: false,
        historyError: null,
        lastUpdated: new Date()
      });
    },

    addToHistory: (transaction) => {
      const state = get();
      const exists = state.transactionHistory.some(t => t.id === transaction.id);
      if (!exists) {
        set({
          transactionHistory: [transaction, ...state.transactionHistory],
          totalTransactions: state.totalTransactions + 1,
          lastUpdated: new Date()
        });
      }
    },

    setHistoryLoading: (loading) => {
      set({ historyLoading: loading });
    },

    setHistoryError: (error) => {
      set({ 
        historyError: error,
        historyLoading: false
      });
    },

    // Current transaction tracking
    setCurrentTransaction: (transaction) => {
      set({ currentTransaction: transaction });
    },

    setTrackingStatus: (status) => {
      set({ trackingStatus: status });
    },

    // Pagination
    setCurrentPage: (page) => {
      set({ currentPage: page });
    },

    setPagination: (current, total, totalTransactions) => {
      set({
        currentPage: current,
        totalPages: total,
        totalTransactions
      });
    },

    // Filters
    setFilters: (filters) => {
      set({ 
        filters,
        currentPage: 1 // Reset to first page when filters change
      });
    },

    clearFilters: () => {
      set({ 
        filters: {},
        currentPage: 1
      });
    },

    // Utility actions
    clearAll: () => {
      set({
        pendingTransactions: [],
        completedTransactions: [],
        failedTransactions: [],
        transactionHistory: [],
        historyLoading: false,
        historyError: null,
        currentTransaction: null,
        trackingStatus: 'idle',
        currentPage: 1,
        totalPages: 1,
        totalTransactions: 0,
        filters: {},
        lastUpdated: new Date()
      });
    },

    updateLastUpdated: () => {
      set({ lastUpdated: new Date() });
    },

    // Computed getters
    getAllTransactions: () => {
      const state = get();
      return [
        ...state.pendingTransactions,
        ...state.completedTransactions,
        ...state.failedTransactions
      ];
    },

    getTransactionById: (id) => {
      const state = get();
      return state.transactionHistory.find(t => t.id === id) || null;
    },

    getTransactionsByStatus: (status) => {
      const state = get();
      switch (status) {
        case 'pending':
        case 'processing':
          return state.pendingTransactions.filter(t => t.status === status);
        case 'completed':
          return state.completedTransactions;
        case 'failed':
        case 'cancelled':
          return state.failedTransactions.filter(t => t.status === status);
        default:
          return [];
      }
    },

    getTransactionsByType: (type) => {
      const state = get();
      return state.transactionHistory.filter(t => t.type === type);
    },

    getPendingCount: () => {
      return get().pendingTransactions.length;
    },

    getCompletedCount: () => {
      return get().completedTransactions.length;
    },

    getFailedCount: () => {
      return get().failedTransactions.length;
    }
  }))
);

// Selectors
export const selectPendingTransactions = (state: TransactionStore) => state.pendingTransactions;
export const selectCompletedTransactions = (state: TransactionStore) => state.completedTransactions;
export const selectFailedTransactions = (state: TransactionStore) => state.failedTransactions;
export const selectTransactionHistory = (state: TransactionStore) => state.transactionHistory;
export const selectCurrentTransaction = (state: TransactionStore) => state.currentTransaction;
export const selectTransactionCounts = (state: TransactionStore) => ({
  pending: state.pendingTransactions.length,
  completed: state.completedTransactions.length,
  failed: state.failedTransactions.length,
  total: state.totalTransactions
});

// Hooks
export const usePendingTransactions = () => useTransactionStore(selectPendingTransactions);
export const useCompletedTransactions = () => useTransactionStore(selectCompletedTransactions);
export const useTransactionHistory = () => useTransactionStore(selectTransactionHistory);
export const useCurrentTransaction = () => useTransactionStore(selectCurrentTransaction);
export const useTransactionCounts = () => useTransactionStore(selectTransactionCounts);