import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
// Tipos locais mínimos para evitar dependência de @lusdt/blockchain-services no pacote de UI
export interface NetworkStatus {
  connected: boolean;
  blockHeight: number;
  lastUpdate: Date;
}

export interface SystemState {
  // Network status
  solanaNetwork: NetworkStatus & { tps?: number; avgFee?: number };
  lunesNetwork: NetworkStatus & { avgBlockTime?: number; finalizedHeight?: number };
  
  // Bridge status
  bridgeStatus: {
    operational: boolean;
    paused: boolean;
    lastProcessed: Date | null;
    queueLength: number;
    version?: string;
  };
  
  // Fee rates
  feeRates: {
    depositFee: number;
    redemptionFee: number;
    feeCap: number;
    lastUpdated: Date | null;
  };
  
  // System metrics
  metrics: {
    totalDeposits: number;
    totalRedemptions: number;
    totalVolume: number;
    avgProcessingTime: number;
    successRate: number;
    lastUpdated: Date | null;
  };
  
  // System notifications
  notifications: Array<{
    id: string;
    type: 'maintenance' | 'warning' | 'info' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    dismissed: boolean;
  }>;
  
  // Loading states
  loading: {
    networkStatus: boolean;
    bridgeStatus: boolean;
    feeRates: boolean;
    metrics: boolean;
  };
  
  // Error states
  errors: {
    networkStatus: string | null;
    bridgeStatus: string | null;
    feeRates: string | null;
    metrics: string | null;
  };
  
  // Last update timestamp
  lastUpdated: Date | null;
}

export interface SystemActions {
  // Network status actions
  setSolanaNetwork: (status: SystemState['solanaNetwork']) => void;
  setLunesNetwork: (status: SystemState['lunesNetwork']) => void;
  updateNetworkStatus: (network: 'solana' | 'lunes', updates: Partial<NetworkStatus>) => void;
  
  // Bridge status actions
  setBridgeStatus: (status: SystemState['bridgeStatus']) => void;
  updateBridgeStatus: (updates: Partial<SystemState['bridgeStatus']>) => void;
  
  // Fee rates actions
  setFeeRates: (rates: SystemState['feeRates']) => void;
  updateFeeRates: (updates: Partial<SystemState['feeRates']>) => void;
  
  // Metrics actions
  setMetrics: (metrics: SystemState['metrics']) => void;
  updateMetrics: (updates: Partial<SystemState['metrics']>) => void;
  
  // Notification actions
  addNotification: (notification: Omit<SystemState['notifications'][0], 'id' | 'timestamp' | 'dismissed'>) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Loading state actions
  setLoading: (key: keyof SystemState['loading'], loading: boolean) => void;
  setAllLoading: (loading: boolean) => void;
  
  // Error state actions
  setError: (key: keyof SystemState['errors'], error: string | null) => void;
  clearError: (key: keyof SystemState['errors']) => void;
  clearAllErrors: () => void;
  
  // Utility actions
  updateLastUpdated: () => void;
  refreshAll: () => Promise<void>;
  
  // Computed getters
  isAnyNetworkDown: () => boolean;
  isBridgeOperational: () => boolean;
  getActiveNotifications: () => SystemState['notifications'];
  hasErrors: () => boolean;
  isLoading: () => boolean;
}

export type SystemStore = SystemState & SystemActions;

/**
 * Store global para gerenciar estado do sistema
 */
export const useSystemStore = create<SystemStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    solanaNetwork: {
      connected: false,
      blockHeight: 0,
      lastUpdate: new Date(),
      tps: 0,
      avgFee: 0
    },
    lunesNetwork: {
      connected: false,
      blockHeight: 0,
      lastUpdate: new Date(),
      avgBlockTime: 0,
      finalizedHeight: 0
    },
    bridgeStatus: {
      operational: false,
      paused: false,
      lastProcessed: null,
      queueLength: 0
    },
    feeRates: {
      depositFee: 0,
      redemptionFee: 0,
      feeCap: 0,
      lastUpdated: null
    },
    metrics: {
      totalDeposits: 0,
      totalRedemptions: 0,
      totalVolume: 0,
      avgProcessingTime: 0,
      successRate: 0,
      lastUpdated: null
    },
    notifications: [],
    loading: {
      networkStatus: false,
      bridgeStatus: false,
      feeRates: false,
      metrics: false
    },
    errors: {
      networkStatus: null,
      bridgeStatus: null,
      feeRates: null,
      metrics: null
    },
    lastUpdated: null,

    // Network status actions
    setSolanaNetwork: (status) => {
      set({
        solanaNetwork: status,
        lastUpdated: new Date()
      });
    },

    setLunesNetwork: (status) => {
      set({
        lunesNetwork: status,
        lastUpdated: new Date()
      });
    },

    updateNetworkStatus: (network, updates) => {
      const state = get();
      if (network === 'solana') {
        set({
          solanaNetwork: { ...state.solanaNetwork, ...updates },
          lastUpdated: new Date()
        });
      } else {
        set({
          lunesNetwork: { ...state.lunesNetwork, ...updates },
          lastUpdated: new Date()
        });
      }
    },

    // Bridge status actions
    setBridgeStatus: (status) => {
      set({
        bridgeStatus: status,
        lastUpdated: new Date()
      });
    },

    updateBridgeStatus: (updates) => {
      const state = get();
      set({
        bridgeStatus: { ...state.bridgeStatus, ...updates },
        lastUpdated: new Date()
      });
    },

    // Fee rates actions
    setFeeRates: (rates) => {
      set({
        feeRates: rates,
        lastUpdated: new Date()
      });
    },

    updateFeeRates: (updates) => {
      const state = get();
      set({
        feeRates: { ...state.feeRates, ...updates },
        lastUpdated: new Date()
      });
    },

    // Metrics actions
    setMetrics: (metrics) => {
      set({
        metrics: metrics,
        lastUpdated: new Date()
      });
    },

    updateMetrics: (updates) => {
      const state = get();
      set({
        metrics: { ...state.metrics, ...updates },
        lastUpdated: new Date()
      });
    },

    // Notification actions
    addNotification: (notification) => {
      const state = get();
      const newNotification = {
        ...notification,
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        dismissed: false
      };

      set({
        notifications: [newNotification, ...state.notifications],
        lastUpdated: new Date()
      });
    },

    dismissNotification: (id) => {
      const state = get();
      set({
        notifications: state.notifications.map(n => 
          n.id === id ? { ...n, dismissed: true } : n
        ),
        lastUpdated: new Date()
      });
    },

    clearNotifications: () => {
      set({
        notifications: [],
        lastUpdated: new Date()
      });
    },

    // Loading state actions
    setLoading: (key, loading) => {
      const state = get();
      set({
        loading: { ...state.loading, [key]: loading }
      });
    },

    setAllLoading: (loading) => {
      set({
        loading: {
          networkStatus: loading,
          bridgeStatus: loading,
          feeRates: loading,
          metrics: loading
        }
      });
    },

    // Error state actions
    setError: (key, error) => {
      const state = get();
      set({
        errors: { ...state.errors, [key]: error },
        loading: { ...state.loading, [key]: false }
      });
    },

    clearError: (key) => {
      const state = get();
      set({
        errors: { ...state.errors, [key]: null }
      });
    },

    clearAllErrors: () => {
      set({
        errors: {
          networkStatus: null,
          bridgeStatus: null,
          feeRates: null,
          metrics: null
        }
      });
    },

    // Utility actions
    updateLastUpdated: () => {
      set({ lastUpdated: new Date() });
    },

    refreshAll: async () => {
      // This would trigger refresh of all system data
      // Implementation would depend on the specific services
      set({ lastUpdated: new Date() });
    },

    // Computed getters
    isAnyNetworkDown: () => {
      const state = get();
      return !state.solanaNetwork.connected || !state.lunesNetwork.connected;
    },

    isBridgeOperational: () => {
      const state = get();
      return state.bridgeStatus.operational && !state.bridgeStatus.paused;
    },

    getActiveNotifications: () => {
      const state = get();
      return state.notifications.filter(n => !n.dismissed);
    },

    hasErrors: () => {
      const state = get();
      return Object.values(state.errors).some(error => error !== null);
    },

    isLoading: () => {
      const state = get();
      return Object.values(state.loading).some(loading => loading);
    }
  }))
);

// Selectors
export const selectSolanaNetwork = (state: SystemStore) => state.solanaNetwork;
export const selectLunesNetwork = (state: SystemStore) => state.lunesNetwork;
export const selectBridgeStatus = (state: SystemStore) => state.bridgeStatus;
export const selectFeeRates = (state: SystemStore) => state.feeRates;
export const selectMetrics = (state: SystemStore) => state.metrics;
export const selectNotifications = (state: SystemStore) => state.notifications;
export const selectSystemHealth = (state: SystemStore) => ({
  solanaConnected: state.solanaNetwork.connected,
  lunesConnected: state.lunesNetwork.connected,
  bridgeOperational: state.bridgeStatus.operational && !state.bridgeStatus.paused,
  hasErrors: Object.values(state.errors).some(error => error !== null),
  isLoading: Object.values(state.loading).some(loading => loading)
});

// Hooks
export const useSolanaNetwork = () => useSystemStore(selectSolanaNetwork);
export const useLunesNetwork = () => useSystemStore(selectLunesNetwork);
export const useBridgeStatus = () => useSystemStore(selectBridgeStatus);
export const useFeeRates = () => useSystemStore(selectFeeRates);
export const useSystemMetrics = () => useSystemStore(selectMetrics);
export const useSystemNotifications = () => useSystemStore(selectNotifications);
export const useSystemHealth = () => useSystemStore(selectSystemHealth);