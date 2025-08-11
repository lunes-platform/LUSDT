import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { 
  SolanaWalletAdapterRegistry,
  WalletDetectionService,
  WalletErrorRecoveryService,
  walletAdapterRegistry
} from '../wallet-adapters';
import { WalletError } from '../../types';

// Mock wallet adapters
const mockPhantomAdapter = {
  name: 'Phantom',
  icon: 'phantom-icon',
  url: 'https://phantom.app',
  readyState: WalletReadyState.Installed,
  publicKey: null,
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn()
};

const mockSolflareAdapter = {
  name: 'Solflare',
  icon: 'solflare-icon',
  url: 'https://solflare.com',
  readyState: WalletReadyState.NotDetected,
  publicKey: null,
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn()
};

// Mock the wallet adapter imports
vi.mock('@solana/wallet-adapter-phantom', () => ({
  PhantomWalletAdapter: vi.fn(() => mockPhantomAdapter)
}));

vi.mock('@solana/wallet-adapter-solflare', () => ({
  SolflareWalletAdapter: vi.fn(() => mockSolflareAdapter)
}));

describe('SolanaWalletAdapterRegistry', () => {
  let registry: SolanaWalletAdapterRegistry;

  beforeEach(() => {
    registry = new SolanaWalletAdapterRegistry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await registry.cleanup();
  });

  describe('initialize', () => {
    it('should initialize wallet adapters successfully', async () => {
      await registry.initialize();
      
      const availableWallets = registry.getAvailableWallets();
      expect(availableWallets).toHaveLength(2);
      expect(availableWallets.find(w => w.type === 'phantom')).toBeDefined();
      expect(availableWallets.find(w => w.type === 'solflare')).toBeDefined();
    });

    it('should not reinitialize if already initialized', async () => {
      await registry.initialize();
      await registry.initialize(); // Second call should not throw
      
      const availableWallets = registry.getAvailableWallets();
      expect(availableWallets).toHaveLength(2);
    });
  });

  describe('getAvailableWallets', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should return all registered wallets with correct info', () => {
      const wallets = registry.getAvailableWallets();
      
      expect(wallets).toHaveLength(2);
      
      const phantom = wallets.find(w => w.type === 'phantom');
      expect(phantom).toEqual({
        type: 'phantom',
        name: 'Phantom',
        icon: 'phantom-icon',
        url: 'https://phantom.app',
        adapter: mockPhantomAdapter,
        readyState: WalletReadyState.Installed,
        installed: true,
        supported: true
      });
      
      const solflare = wallets.find(w => w.type === 'solflare');
      expect(solflare).toEqual({
        type: 'solflare',
        name: 'Solflare',
        icon: 'solflare-icon',
        url: 'https://solflare.com',
        adapter: mockSolflareAdapter,
        readyState: WalletReadyState.NotDetected,
        installed: false,
        supported: true
      });
    });
  });

  describe('getInstalledWallets', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should return only installed wallets', () => {
      const installedWallets = registry.getInstalledWallets();
      
      expect(installedWallets).toHaveLength(1);
      expect(installedWallets[0].type).toBe('phantom');
      expect(installedWallets[0].installed).toBe(true);
    });
  });

  describe('isWalletAvailable', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should return true for installed wallets', () => {
      expect(registry.isWalletAvailable('phantom')).toBe(true);
    });

    it('should return false for not installed wallets', () => {
      expect(registry.isWalletAvailable('solflare')).toBe(false);
    });

    it('should return false for unknown wallets', () => {
      expect(registry.isWalletAvailable('unknown' as any)).toBe(false);
    });
  });

  describe('hasAvailableWallets', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should return true when installed wallets exist', () => {
      expect(registry.hasAvailableWallets()).toBe(true);
    });

    it('should return false when no wallets are installed', () => {
      // Mock both adapters as not detected
      mockPhantomAdapter.readyState = WalletReadyState.NotDetected;
      mockSolflareAdapter.readyState = WalletReadyState.NotDetected;
      
      expect(registry.hasAvailableWallets()).toBe(false);
    });
  });

  describe('getAdapter', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should return the correct adapter for a wallet type', () => {
      const adapter = registry.getAdapter('phantom');
      expect(adapter).toBe(mockPhantomAdapter);
    });

    it('should return null for unknown wallet types', () => {
      const adapter = registry.getAdapter('unknown' as any);
      expect(adapter).toBeNull();
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should disconnect and cleanup all adapters', async () => {
      mockPhantomAdapter.connected = true;
      
      await registry.cleanup();
      
      expect(mockPhantomAdapter.disconnect).toHaveBeenCalled();
      expect(mockPhantomAdapter.removeAllListeners).toHaveBeenCalled();
      expect(mockSolflareAdapter.removeAllListeners).toHaveBeenCalled();
    });
  });
});

describe('WalletDetectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectWallets', () => {
    it('should detect and return available wallets', async () => {
      const wallets = await WalletDetectionService.detectWallets();
      
      expect(wallets).toHaveLength(2);
      expect(wallets.find(w => w.type === 'phantom')).toBeDefined();
      expect(wallets.find(w => w.type === 'solflare')).toBeDefined();
    });
  });

  describe('isWalletInstalled', () => {
    beforeEach(async () => {
      // Reset mock adapter states
      mockPhantomAdapter.readyState = WalletReadyState.Installed;
      mockSolflareAdapter.readyState = WalletReadyState.NotDetected;
      await walletAdapterRegistry.initialize();
    });

    afterEach(async () => {
      await walletAdapterRegistry.cleanup();
    });

    it('should return true for installed wallets', () => {
      expect(WalletDetectionService.isWalletInstalled('phantom')).toBe(true);
    });

    it('should return false for not installed wallets', () => {
      expect(WalletDetectionService.isWalletInstalled('solflare')).toBe(false);
    });
  });

  describe('getBestAvailableWallet', () => {
    beforeEach(async () => {
      // Reset mock adapter states
      mockPhantomAdapter.readyState = WalletReadyState.Installed;
      mockSolflareAdapter.readyState = WalletReadyState.NotDetected;
      await walletAdapterRegistry.initialize();
    });

    afterEach(async () => {
      await walletAdapterRegistry.cleanup();
    });

    it('should return Phantom when available', () => {
      const bestWallet = WalletDetectionService.getBestAvailableWallet();
      
      expect(bestWallet).toBeDefined();
      expect(bestWallet?.type).toBe('phantom');
    });

    it('should return Solflare when Phantom is not available', () => {
      // Mock Phantom as not installed and Solflare as installed
      mockPhantomAdapter.readyState = WalletReadyState.NotDetected;
      mockSolflareAdapter.readyState = WalletReadyState.Installed;
      
      const bestWallet = WalletDetectionService.getBestAvailableWallet();
      
      expect(bestWallet).toBeDefined();
      expect(bestWallet?.type).toBe('solflare');
    });

    it('should return null when no wallets are available', () => {
      // Mock both as not installed
      mockPhantomAdapter.readyState = WalletReadyState.NotDetected;
      mockSolflareAdapter.readyState = WalletReadyState.NotDetected;
      
      const bestWallet = WalletDetectionService.getBestAvailableWallet();
      
      expect(bestWallet).toBeNull();
    });
  });

  describe('getInstallationInstructions', () => {
    it('should return correct instructions for Phantom', () => {
      const instructions = WalletDetectionService.getInstallationInstructions('phantom');
      
      expect(instructions.name).toBe('Phantom');
      expect(instructions.url).toBe('https://phantom.app/');
      expect(instructions.instructions).toContain('Visit phantom.app');
    });

    it('should return correct instructions for Solflare', () => {
      const instructions = WalletDetectionService.getInstallationInstructions('solflare');
      
      expect(instructions.name).toBe('Solflare');
      expect(instructions.url).toBe('https://solflare.com/');
      expect(instructions.instructions).toContain('Visit solflare.com');
    });

    it('should return default instructions for unknown wallets', () => {
      const instructions = WalletDetectionService.getInstallationInstructions('unknown' as any);
      
      expect(instructions.name).toBe('Unknown Wallet');
      expect(instructions.url).toBe('');
      expect(instructions.instructions).toContain('Wallet not recognized');
    });
  });
});

describe('WalletErrorRecoveryService', () => {
  describe('recoverFromError', () => {
    it('should handle WALLET_NOT_INSTALLED error', async () => {
      const error = new WalletError('Wallet not installed', 'WALLET_NOT_INSTALLED');
      const recovery = await WalletErrorRecoveryService.recoverFromError(error, 'phantom');
      
      expect(recovery.canRecover).toBe(false);
      expect(recovery.recoveryAction).toBe('install');
      expect(recovery.userMessage).toContain('phantom wallet is not installed');
    });

    it('should handle USER_REJECTED error', async () => {
      const error = new WalletError('User rejected', 'USER_REJECTED');
      const recovery = await WalletErrorRecoveryService.recoverFromError(error, 'phantom');
      
      expect(recovery.canRecover).toBe(true);
      expect(recovery.recoveryAction).toBe('retry');
      expect(recovery.userMessage).toContain('Connection was rejected');
    });

    it('should handle CONNECTION_FAILED error', async () => {
      const error = new WalletError('Connection failed', 'CONNECTION_FAILED');
      const recovery = await WalletErrorRecoveryService.recoverFromError(error, 'phantom');
      
      expect(recovery.canRecover).toBe(true);
      expect(recovery.recoveryAction).toBe('retry');
      expect(recovery.userMessage).toContain('Connection failed');
    });

    it('should handle unknown errors', async () => {
      const error = new WalletError('Unknown error', 'UNKNOWN_ERROR');
      const recovery = await WalletErrorRecoveryService.recoverFromError(error, 'phantom');
      
      expect(recovery.canRecover).toBe(false);
      expect(recovery.recoveryAction).toBeUndefined();
      expect(recovery.userMessage).toContain('An unexpected error occurred');
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly message for WALLET_NOT_INSTALLED', () => {
      const error = new WalletError('Wallet not installed', 'WALLET_NOT_INSTALLED');
      const message = WalletErrorRecoveryService.getUserFriendlyMessage(error, 'phantom');
      
      expect(message).toBe('Phantom wallet is not installed. Please install it from the official website.');
    });

    it('should return user-friendly message for USER_REJECTED', () => {
      const error = new WalletError('User rejected', 'USER_REJECTED');
      const message = WalletErrorRecoveryService.getUserFriendlyMessage(error, 'phantom');
      
      expect(message).toBe('You rejected the connection request. Please try again and approve the connection.');
    });

    it('should return user-friendly message for unknown errors', () => {
      const error = new WalletError('Unknown error', 'UNKNOWN_ERROR');
      const message = WalletErrorRecoveryService.getUserFriendlyMessage(error, 'phantom');
      
      expect(message).toBe('An error occurred while connecting to Phantom: Unknown error');
    });
  });
});