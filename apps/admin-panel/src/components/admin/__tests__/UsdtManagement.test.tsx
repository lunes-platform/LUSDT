import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UsdtManagement from '../UsdtManagement';
import { useAdminStore } from '../../../store/adminStore';

// Mock do store
vi.mock('../../../store/adminStore');

// Mock dos serviços
vi.mock('../../../services/lusdt', () => ({
  LusdtTokenService: vi.fn().mockImplementation(() => ({
    balanceOf: vi.fn(),
    transfer: vi.fn(),
    getTransferHistory: vi.fn(),
    getTotalSupply: vi.fn()
  }))
}));

const mockStore = {
  lusdtService: {
    balanceOf: vi.fn(),
    transfer: vi.fn(),
    getTransferHistory: vi.fn(),
    getTotalSupply: vi.fn()
  },
  currentAccount: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  isConnected: true,
  totalSupply: '1000000000000', // 1M LUSDT (6 decimals)
  owner: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  bridgeAccount: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f',
  setLoading: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  refreshContractData: vi.fn()
};

describe('🪙 USDT Management Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAdminStore as any).mockReturnValue(mockStore);
  });

  describe('Balance Display', () => {
    it('should display current USDT balance', async () => {
      mockStore.lusdtService.balanceOf.mockResolvedValue('500000000'); // 500 LUSDT
      
      render(<UsdtManagement />);
      
      expect(screen.getByText('Saldo LUSDT')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByText('500.000000 LUSDT')).toBeInTheDocument();
      });
    });

    it('should handle balance loading error', async () => {
      mockStore.lusdtService.balanceOf.mockRejectedValue(new Error('Network error'));
      
      render(<UsdtManagement />);
      
      await waitFor(() => {
        expect(mockStore.setError).toHaveBeenCalledWith(
          expect.stringContaining('Erro ao carregar saldo')
        );
      });
    });

    it('should display total supply correctly', () => {
      render(<UsdtManagement />);
      
      expect(screen.getByText('Total Supply')).toBeInTheDocument();
      expect(screen.getByText('1,000.000000 LUSDT')).toBeInTheDocument();
    });
  });

  describe('Transfer Functionality', () => {
    it('should render transfer form', () => {
      render(<UsdtManagement />);
      
      expect(screen.getByLabelText('Destinatário')).toBeInTheDocument();
      expect(screen.getByLabelText('Quantidade (LUSDT)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /transferir/i })).toBeInTheDocument();
    });

    it('should validate transfer inputs', async () => {
      render(<UsdtManagement />);
      
      const transferButton = screen.getByRole('button', { name: /transferir/i });
      
      // Tentar transferir sem dados
      fireEvent.click(transferButton);
      
      expect(mockStore.lusdtService.transfer).not.toHaveBeenCalled();
    });

    it('should validate recipient address format', async () => {
      render(<UsdtManagement />);
      
      const recipientInput = screen.getByLabelText('Destinatário');
      const amountInput = screen.getByLabelText('Quantidade (LUSDT)');
      const transferButton = screen.getByRole('button', { name: /transferir/i });
      
      fireEvent.change(recipientInput, { target: { value: 'invalid-address' } });
      fireEvent.change(amountInput, { target: { value: '100' } });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(screen.getByText(/endereço inválido/i)).toBeInTheDocument();
      });
    });

    it('should validate transfer amount', async () => {
      render(<UsdtManagement />);
      
      const recipientInput = screen.getByLabelText('Destinatário');
      const amountInput = screen.getByLabelText('Quantidade (LUSDT)');
      const transferButton = screen.getByRole('button', { name: /transferir/i });
      
      fireEvent.change(recipientInput, { 
        target: { value: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f' } 
      });
      fireEvent.change(amountInput, { target: { value: '-10' } });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(screen.getByText(/quantidade inválida/i)).toBeInTheDocument();
      });
    });

    it('should execute successful transfer', async () => {
      mockStore.lusdtService.transfer.mockResolvedValue({
        txHash: '0x123456',
        error: null,
        status: 'finalized'
      });

      render(<UsdtManagement />);
      
      const recipientInput = screen.getByLabelText('Destinatário');
      const amountInput = screen.getByLabelText('Quantidade (LUSDT)');
      const transferButton = screen.getByRole('button', { name: /transferir/i });
      
      fireEvent.change(recipientInput, { 
        target: { value: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f' } 
      });
      fireEvent.change(amountInput, { target: { value: '100.5' } });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(mockStore.lusdtService.transfer).toHaveBeenCalledWith(
          mockStore.currentAccount,
          '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f',
          '100500000' // 100.5 * 1M
        );
      });
    });
  });

  describe('Transaction History', () => {
    it('should display transaction history', async () => {
      const mockHistory = [
        {
          txHash: '0x123456',
          from: mockStore.currentAccount,
          to: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f',
          amount: '100000000',
          timestamp: Date.now(),
          type: 'transfer'
        }
      ];
      
      mockStore.lusdtService.getTransferHistory.mockResolvedValue(mockHistory);
      
      render(<UsdtManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Histórico de Transações')).toBeInTheDocument();
        expect(screen.getByText('100.000000 LUSDT')).toBeInTheDocument();
      });
    });

    it('should handle empty transaction history', async () => {
      mockStore.lusdtService.getTransferHistory.mockResolvedValue([]);
      
      render(<UsdtManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma transação encontrada')).toBeInTheDocument();
      });
    });

    it('should format transaction dates correctly', async () => {
      const mockHistory = [
        {
          txHash: '0x123456',
          from: mockStore.currentAccount,
          to: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f',
          amount: '100000000',
          timestamp: new Date('2024-01-15T10:30:00Z').getTime(),
          type: 'transfer'
        }
      ];
      
      mockStore.lusdtService.getTransferHistory.mockResolvedValue(mockHistory);
      
      render(<UsdtManagement />);
      
      await waitFor(() => {
        expect(screen.getByText(/15\/01\/2024/)).toBeInTheDocument();
      });
    });
  });

  describe('Access Control', () => {
    it('should show limited view for non-connected users', () => {
      const disconnectedStore = { ...mockStore, isConnected: false };
      (useAdminStore as any).mockReturnValue(disconnectedStore);
      
      render(<UsdtManagement />);
      
      expect(screen.getByRole('heading', { name: /conecte sua carteira/i })).toBeInTheDocument();
    });

    it('should disable transfer for non-owner accounts', () => {
      const nonOwnerStore = { 
        ...mockStore, 
        currentAccount: '5D34dL5prEUaGNQtPPZ3yN5Y6BnkfXunKXXz6fo7ZJbLwRRH'
      };
      (useAdminStore as any).mockReturnValue(nonOwnerStore);
      
      render(<UsdtManagement />);
      
      const transferButton = screen.getByRole('button', { name: /transferir/i });
      expect(transferButton).toBeDisabled();
    });
  });

  describe('Real-time Updates', () => {
    it('should refresh data periodically', async () => {
      vi.useFakeTimers();
      
      render(<UsdtManagement />);
      
      // Avançar 30 segundos
      vi.advanceTimersByTime(30000);
      
      await waitFor(() => {
        expect(mockStore.lusdtService.balanceOf).toHaveBeenCalledTimes(2);
      });
      
      vi.useRealTimers();
    });

    it('should handle refresh errors gracefully', async () => {
      mockStore.lusdtService.balanceOf
        .mockResolvedValueOnce('500000000')
        .mockRejectedValueOnce(new Error('Network error'));
      
      vi.useFakeTimers();
      render(<UsdtManagement />);
      
      vi.advanceTimersByTime(30000);
      
      await waitFor(() => {
        expect(mockStore.setError).toHaveBeenCalledWith(
          expect.stringContaining('Erro ao atualizar dados')
        );
      });
      
      vi.useRealTimers();
    });
  });
});