import { useState, useEffect, useCallback } from 'react';
import { useAdminStore } from '../../store/adminStore';
import Loading from '../common/Loading';
import { getErrorMessage } from '../../utils/error';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface Transaction {
  id: string;
  type: 'deposit' | 'redemption' | 'mint' | 'burn' | 'transfer';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  amount: string;
  from: string;
  to: string;
  timestamp: Date;
  txHash?: string;
  blockNumber?: number;
  fee?: string;
  error?: string;
}

interface TransactionFilters {
  type: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  address: string;
}

export default function TransactionMonitoring() {
  const { isConnected, setError } = useAdminStore();

  // Estados locais
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({
    type: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    address: ''
  });

  // Carregar transações (mock data)
  const loadTransactions = useCallback(async () => {
    setLocalLoading(true);
    try {
      // Mock de dados - em produção viria de indexer/API
      const mockTransactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'deposit',
          status: 'completed',
          amount: '1000000000', // 1000 LUSDT
          from: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
          to: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
          timestamp: new Date(Date.now() - 3600000), // 1 hora atrás
          txHash: '0x1234567890abcdef',
          blockNumber: 1234567,
          fee: '5000000' // 5 LUSDT
        },
        {
          id: 'tx-002',
          type: 'redemption',
          status: 'processing',
          amount: '500000000', // 500 LUSDT
          from: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
          to: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
          timestamp: new Date(Date.now() - 1800000), // 30 min atrás
          txHash: '0xabcdef1234567890',
          blockNumber: 1234568,
          fee: '2500000' // 2.5 LUSDT
        },
        {
          id: 'tx-003',
          type: 'mint',
          status: 'failed',
          amount: '2000000000', // 2000 LUSDT
          from: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
          to: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
          timestamp: new Date(Date.now() - 7200000), // 2 horas atrás
          error: 'Insufficient permissions'
        },
        {
          id: 'tx-004',
          type: 'transfer',
          status: 'pending',
          amount: '750000000', // 750 LUSDT
          from: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
          to: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
          timestamp: new Date(Date.now() - 300000), // 5 min atrás
          fee: '3750000' // 3.75 LUSDT
        }
      ];

      // Simular delay de rede
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setTransactions(mockTransactions);
      setFilteredTransactions(mockTransactions);
    } catch (error) {
      setError('Erro ao carregar transações: ' + getErrorMessage(error));
    } finally {
      setLocalLoading(false);
    }
  }, [setError]);

  // Aplicar filtros
  const applyFilters = useCallback(() => {
    let filtered = transactions;

    // Filtro por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(tx => 
        tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.txHash?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.to.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por tipo
    if (filters.type) {
      filtered = filtered.filter(tx => tx.type === filters.type);
    }

    // Filtro por status
    if (filters.status) {
      filtered = filtered.filter(tx => tx.status === filters.status);
    }

    // Filtro por data
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(tx => tx.timestamp >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(tx => tx.timestamp <= toDate);
    }

    // Filtro por valor
    if (filters.minAmount) {
      const minAmount = parseFloat(filters.minAmount) * 1_000_000;
      filtered = filtered.filter(tx => parseInt(tx.amount) >= minAmount);
    }

    if (filters.maxAmount) {
      const maxAmount = parseFloat(filters.maxAmount) * 1_000_000;
      filtered = filtered.filter(tx => parseInt(tx.amount) <= maxAmount);
    }

    // Filtro por endereço
    if (filters.address) {
      filtered = filtered.filter(tx => 
        tx.from.toLowerCase().includes(filters.address.toLowerCase()) ||
        tx.to.toLowerCase().includes(filters.address.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, searchTerm, filters]);

  // Aplicar filtros quando mudarem
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Carregar dados iniciais
  useEffect(() => {
    if (isConnected) {
      loadTransactions();
    }
  }, [isConnected, loadTransactions]);

  // Formatação
  const formatAmount = (amount: string): string => {
    const amountNum = parseInt(amount) / 1_000_000;
    return amountNum.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 6 
    });
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-blue-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'bg-blue-100 text-blue-800';
      case 'redemption':
        return 'bg-purple-100 text-purple-800';
      case 'mint':
        return 'bg-green-100 text-green-800';
      case 'burn':
        return 'bg-red-100 text-red-800';
      case 'transfer':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      address: ''
    });
    setSearchTerm('');
  };

  const exportTransactions = () => {
    // Implementar exportação CSV
    const csvContent = [
      ['ID', 'Tipo', 'Status', 'Valor', 'De', 'Para', 'Data', 'TX Hash', 'Taxa'].join(','),
      ...filteredTransactions.map(tx => [
        tx.id,
        tx.type,
        tx.status,
        formatAmount(tx.amount),
        tx.from,
        tx.to,
        tx.timestamp.toISOString(),
        tx.txHash || '',
        tx.fee ? formatAmount(tx.fee) : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isConnected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <div className="text-yellow-400 text-4xl mb-4">🔗</div>
        <h2 className="text-xl font-semibold text-yellow-900 mb-2">
          Conecte sua Carteira
        </h2>
        <p className="text-yellow-700">
          Conecte sua carteira para monitorar transações
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {localLoading && <Loading overlay text="Carregando transações..." />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            📊 Monitoramento de Transações
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Monitore e analise todas as transações do sistema LUSDT
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={loadTransactions}
            disabled={localLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Atualizar
          </button>
          
          <button
            onClick={exportTransactions}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Filtros e Busca</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="mt-2 sm:mt-0 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
        </div>

        {/* Busca */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Buscar por ID, hash, endereço..."
            />
          </div>
        </div>

        {/* Filtros Avançados */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Todos</option>
                <option value="deposit">Depósito</option>
                <option value="redemption">Resgate</option>
                <option value="mint">Mint</option>
                <option value="burn">Burn</option>
                <option value="transfer">Transferência</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Todos</option>
                <option value="pending">Pendente</option>
                <option value="processing">Processando</option>
                <option value="completed">Concluído</option>
                <option value="failed">Falhou</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor Mínimo (LUSDT)
              </label>
              <input
                type="number"
                value={filters.minAmount}
                onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="0.00"
                step="0.000001"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor Máximo (LUSDT)
              </label>
              <input
                type="number"
                value={filters.maxAmount}
                onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="0.00"
                step="0.000001"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endereço
              </label>
              <input
                type="text"
                value={filters.address}
                onChange={(e) => setFilters({ ...filters, address: e.target.value })}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="5GrwvaEF..."
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Total de Transações</div>
          <div className="text-2xl font-bold text-gray-900">{filteredTransactions.length}</div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Concluídas</div>
          <div className="text-2xl font-bold text-green-600">
            {filteredTransactions.filter(tx => tx.status === 'completed').length}
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Pendentes</div>
          <div className="text-2xl font-bold text-yellow-600">
            {filteredTransactions.filter(tx => tx.status === 'pending' || tx.status === 'processing').length}
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Falharam</div>
          <div className="text-2xl font-bold text-red-600">
            {filteredTransactions.filter(tx => tx.status === 'failed').length}
          </div>
        </div>
      </div>

      {/* Lista de Transações */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Transações ({filteredTransactions.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID / Hash
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  De / Para
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{tx.id}</div>
                    {tx.txHash && (
                      <div className="text-sm text-gray-500 font-mono">
                        {formatAddress(tx.txHash)}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(tx.type)}`}>
                      {tx.type}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(tx.status)}
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                        {tx.status}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatAmount(tx.amount)} LUSDT
                    </div>
                    {tx.fee && (
                      <div className="text-sm text-gray-500">
                        Taxa: {formatAmount(tx.fee)} LUSDT
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div>De: {formatAddress(tx.from)}</div>
                      <div>Para: {formatAddress(tx.to)}</div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{tx.timestamp.toLocaleDateString('pt-BR')}</div>
                    <div>{tx.timestamp.toLocaleTimeString('pt-BR')}</div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">
                      Ver Detalhes
                    </button>
                    {tx.status === 'failed' && (
                      <button className="text-red-600 hover:text-red-900">
                        Reprocessar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Nenhuma transação encontrada
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Tente ajustar os filtros ou aguarde novas transações.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}