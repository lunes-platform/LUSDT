import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaxOverview from '../TaxOverview';
import { useAdminStore } from '../../../store/adminStore';

// Mock do store
vi.mock('../../../store/adminStore');

// Mock da biblioteca de gráficos
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />
}));

// Mock dos serviços
vi.mock('../../../services/taxManager', () => ({
  TaxManagerService: vi.fn().mockImplementation(() => ({
    getFeeConfig: vi.fn(),
    updateFeeConfig: vi.fn(),
    getMonthlyVolume: vi.fn(),
    getLunesPrice: vi.fn(),
    updateLunesPrice: vi.fn(),
    getTaxHistory: vi.fn()
  }))
}));

const mockStore = {
  taxManagerService: {
    getFeeConfig: vi.fn(),
    updateFeeConfig: vi.fn(),
    getMonthlyVolume: vi.fn(),
    getLunesPrice: vi.fn(),
    updateLunesPrice: vi.fn(),
    getTaxHistory: vi.fn()
  },
  currentAccount: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  isConnected: true,
  owner: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  setLoading: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn()
};

describe('📊 Tax Overview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAdminStore as any).mockReturnValue(mockStore);
  });

  describe('Fee Configuration Display', () => {
    it('should display current fee rates', async () => {
      const mockFeeConfig = {
        transfer_fee: 25,  // 0.25%
        mint_fee: 10,     // 0.10%
        burn_fee: 50      // 0.50%
      };
      
      mockStore.taxManagerService.getFeeConfig.mockResolvedValue(mockFeeConfig);
      
      render(<TaxOverview />);
      
      await waitFor(() => {
        expect(screen.getByText('Configuração de Taxas')).toBeInTheDocument();
        expect(screen.getByText('0.25%')).toBeInTheDocument(); // Transfer fee
        expect(screen.getByText('0.10%')).toBeInTheDocument(); // Mint fee
        expect(screen.getByText('0.50%')).toBeInTheDocument(); // Burn fee
      });
    });

    it('should convert basis points to percentage correctly', async () => {
      const mockFeeConfig = {
        transfer_fee: 100,  // 1.00%
        mint_fee: 50,      // 0.50%
        burn_fee: 250      // 2.50%
      };
      
      mockStore.taxManagerService.getFeeConfig.mockResolvedValue(mockFeeConfig);
      
      render(<TaxOverview />);
      
      await waitFor(() => {
        expect(screen.getByText('1.00%')).toBeInTheDocument();
        expect(screen.getByText('0.50%')).toBeInTheDocument();
        expect(screen.getByText('2.50%')).toBeInTheDocument();
      });
    });
  });

  describe('Fee Configuration Update', () => {
    it('should render fee update form for owner', () => {
      render(<TaxOverview />);
      
      expect(screen.getByLabelText('Taxa de Transferência (%)')).toBeInTheDocument();
      expect(screen.getByLabelText('Taxa de Mint (%)')).toBeInTheDocument();
      expect(screen.getByLabelText('Taxa de Burn (%)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /atualizar taxas/i })).toBeInTheDocument();
    });

    it('should validate fee percentages', async () => {
      render(<TaxOverview />);
      
      const transferFeeInput = screen.getByLabelText('Taxa de Transferência (%)');
      const updateButton = screen.getByRole('button', { name: /atualizar taxas/i });
      
      // Teste com taxa negativa
      fireEvent.change(transferFeeInput, { target: { value: '-1' } });
      fireEvent.click(updateButton);
      
      await waitFor(() => {
        expect(screen.getByText(/taxa não pode ser negativa/i)).toBeInTheDocument();
      });
    });

    it('should validate maximum fee limits', async () => {
      render(<TaxOverview />);
      
      const transferFeeInput = screen.getByLabelText('Taxa de Transferência (%)');
      const updateButton = screen.getByRole('button', { name: /atualizar taxas/i });
      
      // Teste com taxa muito alta (>10%)
      fireEvent.change(transferFeeInput, { target: { value: '15' } });
      fireEvent.click(updateButton);
      
      await waitFor(() => {
        expect(screen.getByText(/taxa muito alta/i)).toBeInTheDocument();
      });
    });

    it('should execute successful fee update', async () => {
      mockStore.taxManagerService.updateFeeConfig.mockResolvedValue({
        txHash: '0x123456',
        error: null,
        status: 'finalized'
      });
      
      render(<TaxOverview />);
      
      const transferFeeInput = screen.getByLabelText('Taxa de Transferência (%)');
      const mintFeeInput = screen.getByLabelText('Taxa de Mint (%)');
      const burnFeeInput = screen.getByLabelText('Taxa de Burn (%)');
      const updateButton = screen.getByRole('button', { name: /atualizar taxas/i });
      
      fireEvent.change(transferFeeInput, { target: { value: '0.5' } });
      fireEvent.change(mintFeeInput, { target: { value: '0.2' } });
      fireEvent.change(burnFeeInput, { target: { value: '1.0' } });
      fireEvent.click(updateButton);
      
      await waitFor(() => {
        expect(mockStore.taxManagerService.updateFeeConfig).toHaveBeenCalledWith(
          mockStore.currentAccount,
          {
            transfer_fee: 50,   // 0.5% = 50 basis points
            mint_fee: 20,      // 0.2% = 20 basis points
            burn_fee: 100      // 1.0% = 100 basis points
          }
        );
      });
    });
  });

  describe('LUNES Price Management', () => {
    it('should display current LUNES price', async () => {
      const mockPrice = '1500000'; // $1.50 (6 decimals)
      mockStore.taxManagerService.getLunesPrice.mockResolvedValue(mockPrice);
      
      render(<TaxOverview />);
      
      await waitFor(() => {
        expect(screen.getByText('Preço LUNES')).toBeInTheDocument();
        expect(screen.getByText('$1.500000')).toBeInTheDocument();
      });
    });

    it('should render price update form', () => {
      render(<TaxOverview />);
      
      expect(screen.getByLabelText('Novo Preço LUNES ($)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /atualizar preço/i })).toBeInTheDocument();
    });

    it('should validate price input', async () => {
      render(<TaxOverview />);
      
      const priceInput = screen.getByLabelText('Novo Preço LUNES ($)');
      const updateButton = screen.getByRole('button', { name: /atualizar preço/i });
      
      fireEvent.change(priceInput, { target: { value: '-5' } });
      fireEvent.click(updateButton);
      
      await waitFor(() => {
        expect(screen.getByText(/preço inválido/i)).toBeInTheDocument();
      });
    });

    it('should execute successful price update', async () => {
      mockStore.taxManagerService.updateLunesPrice.mockResolvedValue({
        txHash: '0x789abc',
        error: null,
        status: 'finalized'
      });
      
      render(<TaxOverview />);
      
      const priceInput = screen.getByLabelText('Novo Preço LUNES ($)');
      const updateButton = screen.getByRole('button', { name: /atualizar preço/i });
      
      fireEvent.change(priceInput, { target: { value: '2.50' } });
      fireEvent.click(updateButton);
      
      await waitFor(() => {
        expect(mockStore.taxManagerService.updateLunesPrice).toHaveBeenCalledWith(
          mockStore.currentAccount,
          '2500000' // $2.50 = 2500000 (6 decimals)
        );
      });
    });
  });

  describe('Tax Statistics and Charts', () => {
    it('should display monthly volume', async () => {
      const mockVolume = '75000000000'; // 75k LUSDT
      mockStore.taxManagerService.getMonthlyVolume.mockResolvedValue(mockVolume);
      
      render(<TaxOverview />);
      
      await waitFor(() => {
        expect(screen.getByText('Volume Mensal')).toBeInTheDocument();
        expect(screen.getByText('75,000.000000 LUSDT')).toBeInTheDocument();
      });
    });

    it('should render tax revenue chart', async () => {
      const mockTaxHistory = [
        { date: '2024-01-01', revenue: 100, volume: 10000 },
        { date: '2024-01-02', revenue: 150, volume: 15000 },
        { date: '2024-01-03', revenue: 200, volume: 20000 }
      ];
      
      mockStore.taxManagerService.getTaxHistory.mockResolvedValue(mockTaxHistory);
      
      render(<TaxOverview />);
      
      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.getByText('Receita de Taxas')).toBeInTheDocument();
      });
    });

    it('should render fee distribution pie chart', async () => {
      const mockFeeConfig = {
        transfer_fee: 25,
        mint_fee: 10,
        burn_fee: 50
      };
      
      mockStore.taxManagerService.getFeeConfig.mockResolvedValue(mockFeeConfig);
      
      render(<TaxOverview />);
      
      await waitFor(() => {
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
        expect(screen.getByText('Distribuição de Taxas')).toBeInTheDocument();
      });
    });

    it('should calculate total fees collected', async () => {
      const mockTaxHistory = [
        { date: '2024-01-01', revenue: 100, volume: 10000 },
        { date: '2024-01-02', revenue: 150, volume: 15000 }
      ];
      
      mockStore.taxManagerService.getTaxHistory.mockResolvedValue(mockTaxHistory);
      
      render(<TaxOverview />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Coletado')).toBeInTheDocument();
        expect(screen.getByText('250.000000 LUSDT')).toBeInTheDocument(); // 100 + 150
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should refresh data periodically', async () => {
      vi.useFakeTimers();
      
      render(<TaxOverview />);
      
      // Avançar 1 minuto
      vi.advanceTimersByTime(60000);
      
      await waitFor(() => {
        expect(mockStore.taxManagerService.getFeeConfig).toHaveBeenCalledTimes(2);
      });
      
      vi.useRealTimers();
    });
  });

  describe('Access Control', () => {
    it('should show read-only view for non-owner', () => {
      const nonOwnerStore = { 
        ...mockStore, 
        currentAccount: '5D34dL5prEUaGNQtPPZ3yN5Y6BnkfXunKXXz6fo7ZJbLwRRH'
      };
      (useAdminStore as any).mockReturnValue(nonOwnerStore);
      
      render(<TaxOverview />);
      
      expect(screen.queryByRole('button', { name: /atualizar taxas/i })).not.toBeInTheDocument();
      expect(screen.getByText(/visualização apenas/i)).toBeInTheDocument();
    });

    it('should require connection', () => {
      const disconnectedStore = { ...mockStore, isConnected: false };
      (useAdminStore as any).mockReturnValue(disconnectedStore);
      
      render(<TaxOverview />);
      
      expect(screen.getByText(/conecte sua carteira/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle fee config loading errors', async () => {
      mockStore.taxManagerService.getFeeConfig.mockRejectedValue(
        new Error('Failed to load fee config')
      );
      
      render(<TaxOverview />);
      
      await waitFor(() => {
        expect(mockStore.setError).toHaveBeenCalledWith(
          expect.stringContaining('Erro ao carregar configuração')
        );
      });
    });

    it('should handle update transaction errors', async () => {
      mockStore.taxManagerService.updateFeeConfig.mockResolvedValue({
        txHash: null,
        error: 'Insufficient permissions',
        status: 'error'
      });
      
      render(<TaxOverview />);
      
      const transferFeeInput = screen.getByLabelText('Taxa de Transferência (%)');
      const updateButton = screen.getByRole('button', { name: /atualizar taxas/i });
      
      fireEvent.change(transferFeeInput, { target: { value: '1.0' } });
      fireEvent.click(updateButton);
      
      await waitFor(() => {
        expect(mockStore.setError).toHaveBeenCalledWith(
          expect.stringContaining('Insufficient permissions')
        );
      });
    });
  });
});