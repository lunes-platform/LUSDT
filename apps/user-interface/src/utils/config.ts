import type { AppConfig } from '../types';

export const config: AppConfig = {
  solana: {
    rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    network: (import.meta.env.VITE_SOLANA_NETWORK as 'mainnet-beta' | 'devnet' | 'testnet') || 'devnet',
    usdtMintAddress: import.meta.env.VITE_USDT_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
  },
  lunes: {
    rpcUrl: import.meta.env.VITE_LUNES_RPC_URL || 'wss://rpc.lunes.io',
    lusdtContractAddress: import.meta.env.VITE_LUSDT_CONTRACT_ADDRESS || '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    taxManagerContractAddress: import.meta.env.VITE_TAX_MANAGER_CONTRACT_ADDRESS || '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'
  },
  bridge: {
    apiUrl: import.meta.env.VITE_BRIDGE_API_URL || 'http://localhost:3000',
    wsUrl: import.meta.env.VITE_BRIDGE_WS_URL || 'ws://localhost:3000'
  },
  app: {
    name: import.meta.env.VITE_APP_NAME || 'LUSDT Bridge',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: (import.meta.env.VITE_ENVIRONMENT as 'development' | 'staging' | 'production') || 'development'
  },
  features: {
    analytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    debug: import.meta.env.VITE_ENABLE_DEBUG === 'true',
    testnet: import.meta.env.VITE_ENABLE_TESTNET === 'true'
  }
};

export const isDevelopment = config.app.environment === 'development';
export const isProduction = config.app.environment === 'production';
export const isTestnet = config.features.testnet;