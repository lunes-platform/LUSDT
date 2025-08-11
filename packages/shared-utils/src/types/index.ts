// Base blockchain types (defined here to avoid circular dependencies)
export interface WalletConnection {
  address: string;
  publicKey: string;
  connected: boolean;
  network: string;
}

export interface TokenBalance {
  symbol: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

export interface TransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
  timestamp: Date;
}

export interface NetworkStatus {
  connected: boolean;
  network: string;
  blockHeight?: number;
  latency?: number;
}

// Additional utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// UI state types
export interface LoadingState {
  [key: string]: boolean;
}

export interface ErrorState {
  [key: string]: string | null;
}

export interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

// Form types
export interface FormField<T = any> {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

export interface FormState<T extends Record<string, any>> {
  fields: {
    [K in keyof T]: FormField<T[K]>;
  };
  isValid: boolean;
  isSubmitting: boolean;
  submitCount: number;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  mode: ThemeMode;
  primaryColor: string;
  accentColor: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  fontFamily: 'inter' | 'system' | 'mono';
}

// User preferences
export interface UserPreferences {
  theme: ThemeConfig;
  language: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  privacy: {
    analytics: boolean;
    crashReporting: boolean;
  };
}

// Analytics types
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId: string;
}

export interface AnalyticsConfig {
  enabled: boolean;
  trackingId?: string;
  userId?: string;
  sessionId: string;
}

// Feature flag types
export interface FeatureFlags {
  [key: string]: boolean;
}

// Environment types
export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  environment: Environment;
  apiUrl: string;
  wsUrl: string;
  solanaRpcUrl: string;
  lunesRpcUrl: string;
  enableDebug: boolean;
  enableAnalytics: boolean;
  featureFlags: FeatureFlags;
}