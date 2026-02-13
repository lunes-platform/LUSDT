import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  PORT: parseInt(process.env.PORT || '3001'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174'
  ],

  OPS_BASIC_AUTH_USER: process.env.OPS_BASIC_AUTH_USER || '',
  OPS_BASIC_AUTH_PASS: process.env.OPS_BASIC_AUTH_PASS || '',

  // Solana Configuration
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  SOLANA_WALLET_PRIVATE_KEY: process.env.SOLANA_WALLET_PRIVATE_KEY || '',
  SOLANA_MULTISIG_VAULT: process.env.SOLANA_MULTISIG_VAULT || '', // Cofre para taxas USDT
  USDT_TOKEN_MINT: process.env.USDT_TOKEN_MINT || 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',

  // Fee Distribution Wallets (Solana) — 80% dev / 15% insurance / 5% staking
  DEV_SOLANA_WALLET: process.env.DEV_SOLANA_WALLET || '',
  INSURANCE_SOLANA_WALLET: process.env.INSURANCE_SOLANA_WALLET || '',
  STAKING_REWARDS_SOLANA_WALLET: process.env.STAKING_REWARDS_SOLANA_WALLET || '',

  // Lunes Configuration
  LUNES_RPC_URL: process.env.LUNES_RPC_URL || 'ws://localhost:9944',
  LUNES_WALLET_SEED: process.env.LUNES_WALLET_SEED || '',
  LUSDT_CONTRACT_ADDRESS: process.env.LUSDT_CONTRACT_ADDRESS || '',
  TAX_MANAGER_CONTRACT_ADDRESS: process.env.TAX_MANAGER_CONTRACT_ADDRESS || '',
  LUSDT_CONTRACT_ABI_PATH: process.env.LUSDT_CONTRACT_ABI_PATH || '',
  TAX_MANAGER_CONTRACT_ABI_PATH: process.env.TAX_MANAGER_CONTRACT_ABI_PATH || '',

  // HSM Configuration
  HSM_TYPE: process.env.HSM_TYPE || 'development',
  AWS_KMS_KEY_ID: process.env.AWS_KMS_KEY_ID,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  VAULT_URL: process.env.VAULT_URL,
  VAULT_TOKEN: process.env.VAULT_TOKEN,
  VAULT_KEY_PATH: process.env.VAULT_KEY_PATH,
  BACKUP_HSM_TYPE: process.env.BACKUP_HSM_TYPE,

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/bridge_db',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Bridge Authentication
  BRIDGE_API_KEY: process.env.BRIDGE_API_KEY || '',
  BRIDGE_API_SECRET: process.env.BRIDGE_API_SECRET || '',

  // Security
  RATE_LIMIT_PER_HOUR: parseInt(process.env.RATE_LIMIT_PER_HOUR || '100'),
  MAX_TRANSACTION_VALUE: parseFloat(process.env.MAX_TRANSACTION_VALUE || '100000'),
  TREASURY_MIN_BALANCE: parseFloat(process.env.TREASURY_MIN_BALANCE || '50000'),

  // Hot Wallet Spending Limits (USDT, human-readable units)
  HOT_WALLET_SINGLE_TX_LIMIT: parseFloat(process.env.HOT_WALLET_SINGLE_TX_LIMIT || '10000'),
  HOT_WALLET_DAILY_LIMIT: parseFloat(process.env.HOT_WALLET_DAILY_LIMIT || '50000'),

  // Multisig Enforcement — when true, outbound USDT transfers require vault verification
  REQUIRE_MULTISIG_VAULT: process.env.REQUIRE_MULTISIG_VAULT === 'true',

  // Monitoring
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || '',
  ALERT_EMAIL: process.env.ALERT_EMAIL || '',
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
  PARITY_CHECK_INTERVAL: parseInt(process.env.PARITY_CHECK_INTERVAL || '60000'),
  PARITY_DEVIATION_THRESHOLD: parseFloat(process.env.PARITY_DEVIATION_THRESHOLD || '0.01'),

  // Bridge Service
  REQUIRED_CONFIRMATIONS: process.env.REQUIRED_CONFIRMATIONS || 'finalized',
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
  RETRY_DELAY: parseInt(process.env.RETRY_DELAY || '5000'),
  PROCESSING_TIMEOUT: parseInt(process.env.PROCESSING_TIMEOUT || '30000'),
};

// Validação de configurações críticas
export function validateConfig(): void {
  const requiredEnvVars = ['DATABASE_URL'];

  // Em staging/production exigimos também as credenciais de wallet/contrato
  if (config.NODE_ENV === 'production' || config.NODE_ENV === 'staging') {
    requiredEnvVars.push(
      'SOLANA_WALLET_PRIVATE_KEY',
      'LUNES_WALLET_SEED',
      'LUSDT_CONTRACT_ADDRESS',
      'BRIDGE_API_KEY',
      'BRIDGE_API_SECRET',
      'SOLANA_MULTISIG_VAULT'
    );
  }

  const cfg = config as unknown as Record<string, unknown>;
  const missingVars = requiredEnvVars.filter(varName => {
    const envVal = process.env[varName];
    if (envVal && envVal.length > 0) return false;

    const cfgVal = cfg[varName];
    if (typeof cfgVal === 'string') return cfgVal.length === 0;
    return !cfgVal;
  });

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  if (config.NODE_ENV === 'production') {
    if (!config.DISCORD_WEBHOOK_URL && !config.ALERT_EMAIL) {
      throw new Error('At least one alert method (Discord or Email) must be configured in production');
    }

    if (!config.OPS_BASIC_AUTH_USER || !config.OPS_BASIC_AUTH_PASS) {
      throw new Error('Missing OPS_BASIC_AUTH_USER/OPS_BASIC_AUTH_PASS (required to protect ops/admin endpoints in production)');
    }
  }
}

// Configurações específicas por ambiente
export const getEnvironmentConfig = () => {
  switch (config.NODE_ENV) {
    case 'production':
      return {
        ...config,
        SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
        USDT_TOKEN_MINT: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        REQUIRED_CONFIRMATIONS: 'finalized',
        MAX_TRANSACTION_VALUE: 100000,
        RATE_LIMIT_PER_HOUR: 50
      };
    case 'staging':
      return {
        ...config,
        SOLANA_RPC_URL: 'https://api.devnet.solana.com',
        USDT_TOKEN_MINT: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
        MAX_TRANSACTION_VALUE: 10000,
        RATE_LIMIT_PER_HOUR: 100
      };
    default:
      return config;
  }
}; 