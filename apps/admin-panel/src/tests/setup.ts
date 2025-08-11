import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock da extensão Polkadot.js
const mockWeb3Enable = vi.fn().mockResolvedValue([{ name: 'polkadot-js', version: '1.0.0' }]);
const mockWeb3Accounts = vi.fn().mockResolvedValue([
  {
    address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    meta: {
      name: 'Test Account',
      source: 'polkadot-js'
    }
  }
]);
const mockWeb3FromAddress = vi.fn().mockResolvedValue({
  signer: {
    signPayload: vi.fn(),
    signRaw: vi.fn()
  }
});

vi.mock('@polkadot/extension-dapp', () => ({
  web3Enable: mockWeb3Enable,
  web3Accounts: mockWeb3Accounts,
  web3FromAddress: mockWeb3FromAddress
}));

// Mock da API Polkadot
const mockApi = {
  isReady: Promise.resolve(),
  disconnect: vi.fn(),
  rpc: {
    system: {
      chain: vi.fn().mockResolvedValue({ toString: () => 'Development' }),
      version: vi.fn().mockResolvedValue({ toString: () => '1.0.0' }),
      properties: vi.fn().mockResolvedValue({ toHuman: () => ({}) })
    }
  }
};

vi.mock('@polkadot/api', () => ({
  ApiPromise: {
    create: vi.fn().mockResolvedValue(mockApi)
  },
  WsProvider: vi.fn()
}));

// Mock do ContractPromise
const mockContract = {
  query: {},
  tx: {}
};

vi.mock('@polkadot/api-contract', () => ({
  ContractPromise: vi.fn().mockImplementation(() => mockContract)
}));

// Mock das funções de utilidade Polkadot
vi.mock('@polkadot/util-crypto', () => ({
  decodeAddress: vi.fn().mockImplementation((address: string) => {
    // Mock simples - aceita endereços válidos
    if (address === '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' || 
        address.startsWith('5') && address.length >= 46) {
      return new Uint8Array(32); // 32 bytes array
    }
    throw new Error('Invalid address');
  }),
  encodeAddress: vi.fn().mockImplementation((decoded: Uint8Array, format: number) => {
    if (decoded.length === 32) {
      return '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
    }
    return null;
  })
}));

vi.mock('@polkadot/util', () => ({
  isHex: vi.fn().mockImplementation((value: string) => {
    return /^0x[0-9a-fA-F]+$/.test(value);
  }),
  hexToU8a: vi.fn().mockImplementation((hex: string) => {
    return new Uint8Array();
  })
}));

// Mock do console para testes mais limpos
Object.defineProperty(window, 'console', {
  value: {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
});

// Configuração global para testes
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock do window.matchMedia para headless UI
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});