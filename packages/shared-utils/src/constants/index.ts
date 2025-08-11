// Network constants
export const NETWORKS = {
  SOLANA: 'solana',
  LUNES: 'lunes'
} as const;

export const NETWORK_NAMES = {
  [NETWORKS.SOLANA]: 'Solana',
  [NETWORKS.LUNES]: 'Lunes'
} as const;

// Transaction status constants
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

// Transaction type constants
export const TRANSACTION_TYPES = {
  DEPOSIT: 'deposit',
  REDEMPTION: 'redemption'
} as const;

// Fee type constants
export const FEE_TYPES = {
  LUNES: 'lunes',
  LUSDT: 'lusdt',
  USDT: 'usdt'
} as const;

// Wallet types
export const SOLANA_WALLET_TYPES = {
  PHANTOM: 'phantom',
  SOLFLARE: 'solflare',
  SOLLET: 'sollet',
  LEDGER: 'ledger'
} as const;

// Token constants
export const TOKENS = {
  USDT: 'USDT',
  LUSDT: 'LUSDT',
  SOL: 'SOL',
  LUNES: 'LUNES'
} as const;

// Default values
export const DEFAULT_DECIMALS = {
  [TOKENS.USDT]: 6,
  [TOKENS.LUSDT]: 12,
  [TOKENS.SOL]: 9,
  [TOKENS.LUNES]: 12
} as const;

// API endpoints (to be configured per environment)
export const DEFAULT_ENDPOINTS = {
  SOLANA_MAINNET: 'https://api.mainnet-beta.solana.com',
  SOLANA_DEVNET: 'https://api.devnet.solana.com',
  LUNES_MAINNET: 'wss://rpc.lunes.io',
  LUNES_TESTNET: 'wss://testnet-rpc.lunes.io'
} as const;

// Time constants
export const TIME_INTERVALS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000
} as const;

// Polling intervals
export const POLLING_INTERVALS = {
  FAST: 2000,    // 2 seconds
  NORMAL: 5000,  // 5 seconds
  SLOW: 10000,   // 10 seconds
  VERY_SLOW: 30000 // 30 seconds
} as const;

// UI constants
export const BREAKPOINTS = {
  XS: 320,
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536
} as const;

// Error codes
export const ERROR_CODES = {
  // Wallet errors
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  WALLET_CONNECTION_FAILED: 'WALLET_CONNECTION_FAILED',
  WALLET_NOT_INSTALLED: 'WALLET_NOT_INSTALLED',
  
  // Transaction errors
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // Bridge errors
  BRIDGE_ERROR: 'BRIDGE_ERROR',
  DEPOSIT_FAILED: 'DEPOSIT_FAILED',
  REDEMPTION_FAILED: 'REDEMPTION_FAILED'
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  WALLET_CONNECTED: 'Wallet connected successfully',
  TRANSACTION_SENT: 'Transaction sent successfully',
  DEPOSIT_INITIATED: 'Deposit initiated successfully',
  REDEMPTION_INITIATED: 'Redemption initiated successfully'
} as const;

// Error messages
export const ERROR_MESSAGES = {
  [ERROR_CODES.WALLET_NOT_CONNECTED]: 'Please connect your wallet first',
  [ERROR_CODES.WALLET_CONNECTION_FAILED]: 'Failed to connect wallet',
  [ERROR_CODES.WALLET_NOT_INSTALLED]: 'Wallet extension not installed',
  [ERROR_CODES.INSUFFICIENT_BALANCE]: 'Insufficient balance',
  [ERROR_CODES.TRANSACTION_FAILED]: 'Transaction failed',
  [ERROR_CODES.INVALID_AMOUNT]: 'Invalid amount',
  [ERROR_CODES.INVALID_ADDRESS]: 'Invalid address format',
  [ERROR_CODES.NETWORK_ERROR]: 'Network connection error',
  [ERROR_CODES.API_ERROR]: 'API request failed',
  [ERROR_CODES.TIMEOUT_ERROR]: 'Request timed out',
  [ERROR_CODES.BRIDGE_ERROR]: 'Bridge service error',
  [ERROR_CODES.DEPOSIT_FAILED]: 'Deposit failed',
  [ERROR_CODES.REDEMPTION_FAILED]: 'Redemption failed'
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  WALLET_PREFERENCE: 'lusdt_wallet_preference',
  THEME_PREFERENCE: 'lusdt_theme_preference',
  TRANSACTION_HISTORY: 'lusdt_transaction_history',
  USER_SETTINGS: 'lusdt_user_settings'
} as const;

// Feature flags
export const FEATURE_FLAGS = {
  ENABLE_WEBSOCKETS: 'enable_websockets',
  ENABLE_NOTIFICATIONS: 'enable_notifications',
  ENABLE_ANALYTICS: 'enable_analytics',
  ENABLE_DEBUG_MODE: 'enable_debug_mode'
} as const;