import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FundsManagement from '../FundsManagement';
import { useAdminStore } from '../../../store/adminStore';

// Mock do store
vi.mock('../../../store/adminStore');

// Mock dos serviços
vi.mock('../../../services/taxManager', () => ({
  TaxManagerService: vi.fn().mockImplementation(() => ({
    getDistributionWallets: vi.fn(),
    updateDistributionWallets: vi.fn(),
    getMonthlyVolume: vi.fn(),
    getFeeConfig: vi.fn()
  }))
}));

const mockStore = {
  taxManagerService: {
    getDistributionWallets: vi.fn(),
    updateDistributionWallets: vi.fn(),
    getMonthlyVolume: vi.fn(),
    getFeeConfig: vi.fn()
  },
  currentAccount: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  isConnected: true,
  owner: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  setLoading: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn()
};

describe('💰 Funds Management Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAdminStore as any).mockReturnValue(mockStore);
  });

  describe('Distribution Wallets Display', () => {
    it('should display current distribution wallets', async () => {
      const mockWallets = {
        treasury: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        marketing: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f',
        development: '5D34dL5prEUaGNQtPPZ3yN5Y6BnkfXunKXXz6fo7ZJbLwRRH'
      };
      
      mockStore.taxManagerService.getDistributionWallets.mockResolvedValue(mockWallets);
      
      render(<FundsManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Treasury')).toBeInTheDocument();
        expect(screen.getByText('Marketing')).toBeInTheDocument();
        expect(screen.getByText('Development')).toBeInTheDocument();
      });
    });

    it('should format wallet addresses correctly', async () => {
      const mockWallets = {
        treasury: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        marketing: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f',
        development: '5D34dL5prEUaGNQtPPZ3yN5Y6BnkfXunKXXz6fo7ZJbLwRRH'
      };
      
      mockStore.taxManagerService.getDistributionWallets.mockResolvedValue(mockWallets);
      
      render(<FundsManagement />);
      
      await waitFor(() => {
        // Verificar se endereços são formatados (mostrando apenas início e fim)
        expect(screen.getByText(/5GrwvaEF...tERHpNehXCPcNoHGKutQY/)).toBeInTheDocument();
      });
    });
  });

  describe('Wallet Configuration', () => {
    it('should render wallet update form for owner', () => {
      render(<FundsManagement />);
      
      expect(screen.getByLabelText('Treasury Wallet')).toBeInTheDocument();
      expect(screen.getByLabelText('Marketing Wallet')).toBeInTheDocument();
      expect(screen.getByLabelText('Development Wallet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /atualizar carteiras/i })).toBeInTheDocument();
    });

    it('should validate wallet addresses', async () => {
      render(<FundsManagement />);
      
      const treasuryInput = screen.getByLabelText('Treasury Wallet');
      const updateButton = screen.getByRole('button', { name: /atualizar carteiras/i });
      
      fireEvent.change(treasuryInput, { target: { value: 'invalid-address' } });
      fireEvent.click(updateButton);
      
      await waitFor(() => {
        expect(screen.getByText(/endereço treasury inválido/i)).toBeInTheDocument();
      });
    });

    it('should prevent duplicate wallet addresses', async () => {
      render(<FundsManagement />);
      
      const treasuryInput = screen.getByLabelText('Treasury Wallet');
      const marketingInput = screen.getByLabelText('Marketing Wallet');
      const updateButton = screen.getByRole('button', { name: /atualizar carteiras/i });
      
      const sameAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      
      fireEvent.change(treasuryInput, { target: { value: sameAddress } });
      fireEvent.change(marketingInput, { target: { value: sameAddress } });
      fireEvent.click(updateButton);
      
      await waitFor(() => {
        expect(screen.getByText(/carteiras não podem ser idênticas/i)).toBeInTheDocument();
      });
    });

    it('should execute successful wallet update', async () => {
      mockStore.taxManagerService.updateDistributionWallets.mockResolvedValue({
        txHash: '0x123456',
        error: null,
        status: 'finalized'
      });
      
      render(<FundsManagement />);
      
      const treasuryInput = screen.getByLabelText('Treasury Wallet');
      const marketingInput = screen.getByLabelText('Marketing Wallet');
      const developmentInput = screen.getByLabelText('Development Wallet');
      const updateButton = screen.getByRole('button', { name: /atualizar carteiras/i });
      
      fireEvent.change(treasuryInput, { 
        target: { value: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' } 
      });
      fireEvent.change(marketingInput, { 
        target: { value: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f' } 
      });
      fireEvent.change(developmentInput, { 
        target: { value: '5D34dL5prEUaGNQtPPZ3yN5Y6BnkfXunKXXz6fo7ZJbLwRRH' } 
      });
      fireEvent.click(updateButton);
      
      await waitFor(() => {
        expect(mockStore.taxManagerService.updateDistributionWallets).toHaveBeenCalledWith(
          mockStore.currentAccount,
          {
            treasury: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
            marketing: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f',
            development: '5D34dL5prEUaGNQtPPZ3yN5Y6BnkfXunKXXz6fo7ZJbLwRRH'
          }
        );
      });
    });
  });

  describe('Fund Statistics', () => {
    it('should display monthly volume statistics', async () => {
      const mockVolume = '50000000000'; // 50k LUSDT
      mockStore.taxManagerService.getMonthlyVolume.mockResolvedValue(mockVolume);
      
      render(<FundsManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Volume Mensal')).toBeInTheDocument();
        expect(screen.getByText('50,000.000000 LUSDT')).toBeInTheDocument();
      });
    });

    it('should display fee configuration', async () => {
      const mockFeeConfig = {
        transfer_fee: 25,  // 0.25%
        mint_fee: 10,     // 0.10%
        burn_fee: 50      // 0.50%
      };
      
      mockStore.taxManagerService.getFeeConfig.mockResolvedValue(mockFeeConfig);
      
      render(<FundsManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Taxa de Transferência: 0.25%')).toBeInTheDocument();
        expect(screen.getByText('Taxa de Mint: 0.10%')).toBeInTheDocument();
        expect(screen.getByText('Taxa de Burn: 0.50%')).toBeInTheDocument();
      });
    });

    it('should calculate projected monthly fees', async () => {
      const mockVolume = '100000000000'; // 100k LUSDT
      const mockFeeConfig = { transfer_fee: 25, mint_fee: 10, burn_fee: 50 };
      
      mockStore.taxManagerService.getMonthlyVolume.mockResolvedValue(mockVolume);
      mockStore.taxManagerService.getFeeConfig.mockResolvedValue(mockFeeConfig);
      
      render(<FundsManagement />);
      
      await waitFor(() => {
        // 100k * 0.25% = 250 LUSDT em taxas estimadas
        expect(screen.getByText(/250\.000000 LUSDT/)).toBeInTheDocument();
      });
    });
  });

  describe('Fund Distribution Chart', () => {
    it('should render distribution visualization', async () => {
      const mockWallets = {
        treasury: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        marketing: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f',
        development: '5D34dL5prEUaGNQtPPZ3yN5Y6BnkfXunKXXz6fo7ZJbLwRRH'
      };
      
      mockStore.taxManagerService.getDistributionWallets.mockResolvedValue(mockWallets);
      
      render(<FundsManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Distribuição de Fundos')).toBeInTheDocument();
      });
    });
  });

  describe('Access Control', () => {
    it('should show read-only view for non-owner', () => {
      const nonOwnerStore = { 
        ...mockStore, 
        currentAccount: '5D34dL5prEUaGNQtPPZ3yN5Y6BnkfXunKXXz6fo7ZJbLwRRH'
      };
      (useAdminStore as any).mockReturnValue(nonOwnerStore);
      
      render(<FundsManagement />);
      
      expect(screen.queryByRole('button', { name: /atualizar carteiras/i })).not.toBeInTheDocument();
      expect(screen.getByText(/visualização apenas/i)).toBeInTheDocument();
    });

    it('should show connection prompt for disconnected users', () => {
      const disconnectedStore = { ...mockStore, isConnected: false };
      (useAdminStore as any).mockReturnValue(disconnectedStore);
      
      render(<FundsManagement />);
      
      expect(screen.getByText(/conecte sua carteira/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle wallet loading errors', async () => {
      mockStore.taxManagerService.getDistributionWallets.mockRejectedValue(
        new Error('Failed to load wallets')
      );
      
      render(<FundsManagement />);
      
      await waitFor(() => {
        expect(mockStore.setError).toHaveBeenCalledWith(
          expect.stringContaining('Erro ao carregar carteiras')
        );
      });
    });

    it('should handle update errors gracefully', async () => {
      mockStore.taxManagerService.updateDistributionWallets.mockResolvedValue({
        txHash: null,
        error: 'Transaction failed',
        status: 'error'
      });
      
      render(<FundsManagement />);
      
      const treasuryInput = screen.getByLabelText('Treasury Wallet');
      const updateButton = screen.getByRole('button', { name: /atualizar carteiras/i });
      
      fireEvent.change(treasuryInput, { 
        target: { value: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' } 
      });
      fireEvent.click(updateButton);
      
      await waitFor(() => {
        expect(mockStore.setError).toHaveBeenCalledWith(
          expect.stringContaining('Transaction failed')
        );
      });
    });
  });
});