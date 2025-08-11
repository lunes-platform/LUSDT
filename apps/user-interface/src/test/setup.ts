import '@testing-library/jest-dom';

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SOLANA_RPC_URL: 'https://api.devnet.solana.com',
    VITE_SOLANA_NETWORK: 'devnet',
    VITE_USDT_MINT_ADDRESS: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    VITE_LUNES_RPC_URL: 'wss://rpc.lunes.io',
    VITE_LUSDT_CONTRACT_ADDRESS: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    VITE_TAX_MANAGER_CONTRACT_ADDRESS: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
    VITE_BRIDGE_API_URL: 'http://localhost:3000',
    VITE_BRIDGE_WS_URL: 'ws://localhost:3000',
    VITE_APP_NAME: 'LUSDT Bridge',
    VITE_APP_VERSION: '1.0.0',
    VITE_ENVIRONMENT: 'development',
    VITE_ENABLE_ANALYTICS: 'false',
    VITE_ENABLE_DEBUG: 'true',
    VITE_ENABLE_TESTNET: 'true'
  }
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});