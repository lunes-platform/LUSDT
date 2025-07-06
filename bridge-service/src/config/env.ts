import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  PORT: parseInt(process.env.PORT || '3000'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],

  // Solana Configuration
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  SOLANA_WALLET_PRIVATE_KEY: process.env.SOLANA_WALLET_PRIVATE_KEY || '',
  USDT_TOKEN_MINT: process.env.USDT_TOKEN_MINT || 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',

  // Lunes Configuration
  LUNES_RPC_URL: process.env.LUNES_RPC_URL || 'ws://localhost:9944',
  LUNES_WALLET_SEED: process.env.LUNES_WALLET_SEED || '',
  LUSDT_CONTRACT_ADDRESS: process.env.LUSDT_CONTRACT_ADDRESS || '',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/bridge_db',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Security
  RATE_LIMIT_PER_HOUR: parseInt(process.env.RATE_LIMIT_PER_HOUR || '100'),
  MAX_TRANSACTION_VALUE: parseFloat(process.env.MAX_TRANSACTION_VALUE || '100000'),
  TREASURY_MIN_BALANCE: parseFloat(process.env.TREASURY_MIN_BALANCE || '50000'),

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
  const requiredEnvVars = [
    'SOLANA_WALLET_PRIVATE_KEY',
    'LUNES_WALLET_SEED',
    'LUSDT_CONTRACT_ADDRESS',
    'DATABASE_URL'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  if (config.NODE_ENV === 'production') {
    if (!config.DISCORD_WEBHOOK_URL && !config.ALERT_EMAIL) {
      throw new Error('At least one alert method (Discord or Email) must be configured in production');
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