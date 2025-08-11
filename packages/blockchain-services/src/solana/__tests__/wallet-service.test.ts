import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Connection, PublicKey } from '@solana/web3.js';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { SolanaWalletService } from '../wallet-service';
import { WalletError, TransactionError } from '../../types';

// Mock dependencies
vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn(),
  PublicKey: vi.fn(),
  Transaction: vi.fn()
}));

vi.mock('../wallet-adapters', () => ({
  walletAdapterRegistry: {
    initialize: vi.fn(),
    getAvailableWallets: vi.fn(),
    getInstalledWallets: vi.fn(),
    hasAvailableWallets: vi.fn(),
    getAdapter: vi.fn(),
    cleanup: vi.fn()
  },
  WalletDetectionService: {
    getBestAvailableWallet: vi.fn(),
    isWalletInstalled: vi.fn(),
    getInstallationInstructions: vi.fn()
  },
  WalletErrorRecoveryService: {
    recoverFromError: vi.fn(),
    getUserFriendlyMessage: vi.fn()
  }
}));

const mockConnection = {
  getBalance: vi.fn(),
  getLatestBlockhash: vi.fn(),
  sendRawTransaction: vi.fn(),
  confirmTransaction: vi.fn(),
  getSlot: vi.fn(),
  getBlockTime: vi.fn(),
  getVersion: vi.fn(),
  onAccountChange: vi.fn(),
  removeAccountChangeListener: vi.fn()
};

const mockAdapter = {
  name: 'Phantom',
  icon: 'phantom-icon',
  url: 'https://phantom.app',
  readyState: WalletReadyState.Installed,
  publicKey: new PublicKey('11111111111111111111111111111112'),
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
  signMessage: vi.fn()
};

const mockWalletInfo = {
  type: 'phantom' as const,
  name: 'Phantom',
  icon: 'phantom-icon',
  url: 'https://phantom.app',
  adapter: mockAdapter,
  readyState: WalletReadyState.Installed,
  installed: true,
  supported: true
};

describe('SolanaWalletService', () => {
  let service: SolanaWalletService;
  const config = {
    rpcEndpoint: 'https://api.devnet.solana.com',
    commitment: 'confirmed' as const
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    (Connection as any).mockImplementation(() => mockConnection);
    
    // Setup default mocks for wallet adapter registry
    const { walletAdapterRegistry } = await import('../wallet-adapters');
    walletAdapterRegistry.initialize.mockResolvedValue(undefined);
    walletAdapterRegistry.getAvailableWallets.mockReturnValue([mockWalletInfo]);
    walletAdapterRegistry.getInstalledWallets.mockReturnValue([mockWalletInfo]);
    walletAdapterRegistry.hasAvailableWallets.mockReturnValue(true);
    walletAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
    walletAdapterRegistry.cleanup.mockResolvedValue(undefined);
    
    service = new SolanaWalletService(config);
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      
      await service.initialize();
      
      expect(walletAdapterRegistry.initialize).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      
      await service.initialize();
      await service.initialize();
      
      expect(walletAdapterRegistry.initialize).toHaveBeenCalledTimes(1);
    });

    it('should throw error if initialization fails', async () => {
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      walletAdapterRegistry.initialize.mockRejectedValue(new Error('Init failed'));
      
      await expect(service.initialize()).rejects.toThrow(WalletError);
    });
  });

  describe('getAvailableWallets', () => {
    beforeEach(async () => {
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      walletAdapterRegistry.initialize.mockResolvedValue(undefined);
      walletAdapterRegistry.getAvailableWallets.mockReturnValue([mockWalletInfo]);
      await service.initialize();
    });

    it('should return available wallets', async () => {
      const wallets = await service.getAvailableWallets();
      
      expect(wallets).toEqual([mockWalletInfo]);
    });
  });

  describe('connect', () => {
    beforeEach(async () => {
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      walletAdapterRegistry.initialize.mockResolvedValue(undefined);
      walletAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockAdapter.connect.mockResolvedValue(undefined);
      mockConnection.getBalance.mockResolvedValue(1000000000); // 1 SOL
      mockConnection.onAccountChange.mockReturnValue(123);
      await service.initialize();
    });

    it('should connect to wallet successfully', async () => {
      const wallet = await service.connect('phantom');
      
      expect(mockAdapter.connect).toHaveBeenCalled();
      expect(wallet).toEqual({
        address: mockAdapter.publicKey.toString(),
        publicKey: mockAdapter.publicKey.toString(),
        connected: true,
        name: 'Phantom',
        icon: 'phantom-icon',
        adapter: mockAdapter
      });
    });

    it('should throw error if wallet not found', async () => {
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      walletAdapterRegistry.getAdapter.mockReturnValue(null);
      
      await expect(service.connect('phantom')).rejects.toThrow(WalletError);
    });

    it('should throw error if wallet not installed', async () => {
      mockAdapter.readyState = WalletReadyState.NotDetected;
      
      await expect(service.connect('phantom')).rejects.toThrow(WalletError);
    });

    it('should throw error if wallet not supported', async () => {
      mockAdapter.readyState = WalletReadyState.Unsupported;
      
      await expect(service.connect('phantom')).rejects.toThrow(WalletError);
    });

    it('should throw error if wallet still loading', async () => {
      mockAdapter.readyState = WalletReadyState.Loading;
      
      await expect(service.connect('phantom')).rejects.toThrow(WalletError);
    });

    it('should throw error if no public key returned', async () => {
      mockAdapter.publicKey = null;
      
      await expect(service.connect('phantom')).rejects.toThrow(WalletError);
    });

    it('should disconnect current wallet before connecting new one', async () => {
      // First connection
      await service.connect('phantom');
      expect(service.isConnected()).toBe(true);
      
      // Second connection should disconnect first
      const mockAdapter2 = { ...mockAdapter, name: 'Solflare' };
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      walletAdapterRegistry.getAdapter.mockReturnValue(mockAdapter2);
      
      await service.connect('solflare');
      
      expect(mockAdapter.disconnect).toHaveBeenCalled();
    });
  });

  describe('connectBestAvailable', () => {
    beforeEach(async () => {
      const { walletAdapterRegistry, WalletDetectionService } = await import('../wallet-adapters');
      walletAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      WalletDetectionService.getBestAvailableWallet.mockReturnValue(mockWalletInfo);
      mockAdapter.connect.mockResolvedValue(undefined);
      mockConnection.getBalance.mockResolvedValue(1000000000);
      mockConnection.onAccountChange.mockReturnValue(123);
      await service.initialize();
    });

    it('should connect to best available wallet', async () => {
      const wallet = await service.connectBestAvailable();
      
      expect(wallet.name).toBe('Phantom');
      expect(mockAdapter.connect).toHaveBeenCalled();
    });

    it('should throw error if no wallets available', async () => {
      const { WalletDetectionService } = await import('../wallet-adapters');
      WalletDetectionService.getBestAvailableWallet.mockReturnValue(null);
      
      await expect(service.connectBestAvailable()).rejects.toThrow(WalletError);
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      walletAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockAdapter.connect.mockResolvedValue(undefined);
      mockConnection.getBalance.mockResolvedValue(1000000000);
      mockConnection.onAccountChange.mockReturnValue(123);
      await service.initialize();
      await service.connect('phantom');
    });

    it('should disconnect wallet successfully', async () => {
      await service.disconnect();
      
      expect(mockAdapter.disconnect).toHaveBeenCalled();
      expect(mockConnection.removeAccountChangeListener).toHaveBeenCalledWith(123);
      expect(service.getCurrentWallet()).toBeNull();
    });

    it('should handle disconnect errors gracefully', async () => {
      mockAdapter.disconnect.mockRejectedValue(new Error('Disconnect failed'));
      
      await expect(service.disconnect()).resolves.not.toThrow();
      expect(service.getCurrentWallet()).toBeNull();
    });
  });

  describe('getSolBalance', () => {
    beforeEach(async () => {
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      walletAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockAdapter.connect.mockResolvedValue(undefined);
      mockConnection.getBalance.mockResolvedValue(1000000000); // 1 SOL
      mockConnection.onAccountChange.mockReturnValue(123);
      await service.initialize();
      await service.connect('phantom');
    });

    it('should return SOL balance', async () => {
      const balance = await service.getSolBalance();
      
      expect(balance).toBe(1); // 1 SOL
      expect(mockConnection.getBalance).toHaveBeenCalledWith(mockAdapter.publicKey);
    });

    it('should throw error if no wallet connected', async () => {
      await service.disconnect();
      
      await expect(service.getSolBalance()).rejects.toThrow(WalletError);
    });

    it('should throw error if balance fetch fails', async () => {
      mockConnection.getBalance.mockRejectedValue(new Error('Network error'));
      
      await expect(service.getSolBalance()).rejects.toThrow(WalletError);
    });
  });

  describe('sendTransaction', () => {
    const mockTransaction = { recentBlockhash: null, feePayer: null };
    const mockSignedTransaction = { serialize: vi.fn().mockReturnValue(new Uint8Array()) };

    beforeEach(async () => {
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      walletAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockAdapter.connect.mockResolvedValue(undefined);
      mockAdapter.signTransaction.mockResolvedValue(mockSignedTransaction);
      mockConnection.getBalance.mockResolvedValue(1000000000);
      mockConnection.onAccountChange.mockReturnValue(123);
      mockConnection.getLatestBlockhash.mockResolvedValue({ blockhash: 'test-blockhash' });
      mockConnection.sendRawTransaction.mockResolvedValue('test-signature');
      mockConnection.confirmTransaction.mockResolvedValue({
        context: { slot: 12345 },
        value: { err: null }
      });
      await service.initialize();
      await service.connect('phantom');
    });

    it('should send transaction successfully', async () => {
      const result = await service.sendTransaction(mockTransaction as any);
      
      expect(result).toEqual({
        signature: 'test-signature',
        success: true,
        blockHeight: 12345,
        confirmations: 1
      });
      expect(mockAdapter.signTransaction).toHaveBeenCalled();
      expect(mockConnection.sendRawTransaction).toHaveBeenCalled();
    });

    it('should throw error if no wallet connected', async () => {
      await service.disconnect();
      
      await expect(service.sendTransaction(mockTransaction as any)).rejects.toThrow(WalletError);
    });

    it('should throw error if transaction confirmation fails', async () => {
      mockConnection.confirmTransaction.mockResolvedValue({
        context: { slot: 12345 },
        value: { err: 'Transaction failed' }
      });
      
      await expect(service.sendTransaction(mockTransaction as any)).rejects.toThrow(TransactionError);
    });
  });

  describe('signMessage', () => {
    beforeEach(async () => {
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      walletAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockAdapter.connect.mockResolvedValue(undefined);
      mockAdapter.signMessage.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
      mockConnection.getBalance.mockResolvedValue(1000000000);
      mockConnection.onAccountChange.mockReturnValue(123);
      await service.initialize();
      await service.connect('phantom');
    });

    it('should sign message successfully', async () => {
      const signature = await service.signMessage('test message');
      
      expect(signature).toBe(Buffer.from([1, 2, 3, 4]).toString('base64'));
      expect(mockAdapter.signMessage).toHaveBeenCalledWith(new TextEncoder().encode('test message'));
    });

    it('should throw error if no wallet connected', async () => {
      await service.disconnect();
      
      await expect(service.signMessage('test')).rejects.toThrow(WalletError);
    });

    it('should throw error if signing fails', async () => {
      mockAdapter.signMessage.mockRejectedValue(new Error('Signing failed'));
      
      await expect(service.signMessage('test')).rejects.toThrow(WalletError);
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should check if wallet is installed', async () => {
      const { WalletDetectionService } = await import('../wallet-adapters');
      WalletDetectionService.isWalletInstalled.mockReturnValue(true);
      
      const isInstalled = await service.isWalletInstalled('phantom');
      
      expect(isInstalled).toBe(true);
      expect(WalletDetectionService.isWalletInstalled).toHaveBeenCalledWith('phantom');
    });

    it('should get installation instructions', async () => {
      const { WalletDetectionService } = await import('../wallet-adapters');
      const mockInstructions = {
        name: 'Phantom',
        url: 'https://phantom.app',
        instructions: ['Install Phantom']
      };
      WalletDetectionService.getInstallationInstructions.mockReturnValue(mockInstructions);
      
      const instructions = service.getInstallationInstructions('phantom');
      
      expect(instructions).toEqual(mockInstructions);
    });

    it('should recover from errors', async () => {
      const { WalletErrorRecoveryService } = await import('../wallet-adapters');
      const mockRecovery = {
        canRecover: true,
        recoveryAction: 'retry',
        userMessage: 'Please try again'
      };
      WalletErrorRecoveryService.recoverFromError.mockResolvedValue(mockRecovery);
      
      const error = new WalletError('Test error', 'TEST_ERROR');
      const recovery = await service.recoverFromError(error, 'phantom');
      
      expect(recovery).toEqual(mockRecovery);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      const { walletAdapterRegistry } = await import('../wallet-adapters');
      await service.initialize();
      
      await service.cleanup();
      
      expect(walletAdapterRegistry.cleanup).toHaveBeenCalled();
    });
  });
});