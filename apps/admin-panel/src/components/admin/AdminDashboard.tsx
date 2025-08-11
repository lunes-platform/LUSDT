import { useState, useEffect, useCallback } from 'react';
import { useAdminStore } from '../../store/adminStore';
import Loading from '../common/Loading';
// import ErrorAlert from '../common/ErrorAlert';
import { getErrorMessage } from '../../utils/error';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ServerIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  CpuChipIcon,
  GlobeAltIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  
} from 'recharts';

interface SystemMetrics {
  totalSupply: string;
  totalTransactions: number;
  dailyVolume: string;
  monthlyVolume: string;
  totalFees: string;
  activeUsers: number;
  bridgeBalance: string;
  treasuryBalance: string;
}

interface BridgeStatus {
  operational: boolean;
  paused: boolean;
  lastProcessed: Date;
  queueLength: number;
  processingTime: number;
  successRate: number;
  errorRate: number;
  uptime: number;
}

interface NetworkStatus {
  solana: {
    connected: boolean;
    blockHeight: number;
    tps: number;
    avgFee: number;
    health: 'healthy' | 'degraded' | 'down';
  };
  lunes: {
    connected: boolean;
    blockHeight: number;
    finalizedHeight: number;
    avgBlockTime: number;
    health: 'healthy' | 'degraded' | 'down';
  };
}

interface TransactionAnalytics {
  hourlyData: Array<{
    time: string;
    deposits: number;
    redemptions: number;
    volume: number;
    fees: number;
  }>;
  dailyData: Array<{
    date: string;
    transactions: number;
    volume: number;
    fees: number;
    successRate: number;
  }>;
}

export default function AdminDashboard() {
  const {
    isConnected,
    tokenInfo,
    lusdtService,
    taxManagerService,
    setError
  } = useAdminStore();

  // Estados locais
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    totalSupply: '0',
    totalTransactions: 0,
    dailyVolume: '0',
    monthlyVolume: '0',
    totalFees: '0',
    activeUsers: 0,
    bridgeBalance: '0',
    treasuryBalance: '0'
  });

  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({
    operational: true,
    paused: false,
    lastProcessed: new Date(),
    queueLength: 0,
    processingTime: 0,
    successRate: 99.5,
    errorRate: 0.5,
    uptime: 99.9
  });

  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    solana: {
      connected: true,
      blockHeight: 0,
      tps: 0,
      avgFee: 0,
      health: 'healthy'
    },
    lunes: {
      connected: true,
      blockHeight: 0,
      finalizedHeight: 0,
      avgBlockTime: 0,
      health: 'healthy'
    }
  });

  const [transactionAnalytics, setTransactionAnalytics] = useState<TransactionAnalytics>({
    hourlyData: [],
    dailyData: []
  });

  const [localLoading, setLocalLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Carregar métricas do sistema
  const loadSystemMetrics = useCallback(async () => {
    if (!lusdtService || !taxManagerService) return;

    try {
      const [totalSupply, monthlyVolume] = await Promise.all([
        lusdtService.getTotalSupply(),
        taxManagerService.getMonthlyVolume()
      ]);

      // Mock de dados adicionais - em produção viria de indexer/API
      setSystemMetrics({
        totalSupply,
        totalTransactions: 15420,
        dailyVolume: '125000000000', // 125k LUSDT
        monthlyVolume,
        totalFees: '2500000000', // 2.5k LUSDT
        activeUsers: 1250,
        bridgeBalance: '50000000000', // 50k LUSDT
        treasuryBalance: '100000000000' // 100k USDT
      });
    } catch (error) {
      console.error('Erro ao carregar métricas do sistema:', error);
    }
  }, [lusdtService, taxManagerService]);

  // Carregar status da bridge
  const loadBridgeStatus = useCallback(async () => {
    if (!tokenInfo) return;

    try {
      // Mock de dados - em produção viria de serviço de monitoramento
      setBridgeStatus({
        operational: !tokenInfo.isPaused,
        paused: tokenInfo.isPaused,
        lastProcessed: new Date(Date.now() - 30000), // 30 segundos atrás
        queueLength: 3,
        processingTime: 45, // segundos
        successRate: 99.2,
        errorRate: 0.8,
        uptime: 99.95
      });
    } catch (error) {
      console.error('Erro ao carregar status da bridge:', error);
    }
  }, [tokenInfo]);

  // Carregar status das redes
  const loadNetworkStatus = useCallback(async () => {
    try {
      // Mock de dados - em produção viria de APIs das redes
      setNetworkStatus({
        solana: {
          connected: true,
          blockHeight: 245678901,
          tps: 2847,
          avgFee: 0.00025,
          health: 'healthy'
        },
        lunes: {
          connected: true,
          blockHeight: 1234567,
          finalizedHeight: 1234565,
          avgBlockTime: 6.2,
          health: 'healthy'
        }
      });
    } catch (error) {
      console.error('Erro ao carregar status das redes:', error);
    }
  }, []);

  // Carregar analytics de transações
  const loadTransactionAnalytics = useCallback(async () => {
    try {
      // Mock de dados - em produção viria de indexer
      const now = new Date();
      const hourlyData = [];
      const dailyData = [];

      // Dados das últimas 24 horas
      for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        hourlyData.push({
          time: time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          deposits: Math.floor(Math.random() * 50) + 10,
          redemptions: Math.floor(Math.random() * 30) + 5,
          volume: Math.floor(Math.random() * 100000) + 50000,
          fees: Math.floor(Math.random() * 500) + 100
        });
      }

      // Dados dos últimos 30 dias
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        dailyData.push({
          date: date.toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit' }),
          transactions: Math.floor(Math.random() * 500) + 200,
          volume: Math.floor(Math.random() * 1000000) + 500000,
          fees: Math.floor(Math.random() * 5000) + 1000,
          successRate: 95 + Math.random() * 4 // 95-99%
        });
      }

      setTransactionAnalytics({ hourlyData, dailyData });
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
    }
  }, []);

  // Carregar todos os dados
  const loadAllData = useCallback(async () => {
    setLocalLoading(true);
    try {
      await Promise.all([
        loadSystemMetrics(),
        loadBridgeStatus(),
        loadNetworkStatus(),
        loadTransactionAnalytics()
      ]);
    } catch (error) {
      setError('Erro ao carregar dados do dashboard: ' + getErrorMessage(error));
    } finally {
      setLocalLoading(false);
    }
  }, [loadSystemMetrics, loadBridgeStatus, loadNetworkStatus, loadTransactionAnalytics, setError]);

  // Configurar atualização automática
  useEffect(() => {
    if (!isConnected) return;

    // Carregar dados iniciais
    loadAllData();

    // Configurar refresh automático a cada 30 segundos
    const interval = setInterval(loadAllData, 30000);
    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, loadAllData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  // Formatação de números
  const formatAmount = (amount: string | number): string => {
    const amountNum = typeof amount === 'string' ? parseInt(amount) / 1_000_000 : amount;
    return amountNum.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  const formatPercentage = (num: number): string => {
    return num.toFixed(2) + '%';
  };

  // Recharts Tooltip passes ValueType which can be string | number | (string | number)[]
  // Create a safe formatter to extract a primitive value for our formatters
  const asPrimitive = (v: unknown): number | string => {
    if (Array.isArray(v)) return (v[0] as number | string) ?? '';
    if (typeof v === 'number' || typeof v === 'string') return v;
    return '';
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'down': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircleIcon className="h-5 w-5" />;
      case 'degraded': return <ExclamationTriangleIcon className="h-5 w-5" />;
      case 'down': return <ExclamationTriangleIcon className="h-5 w-5" />;
      default: return <ClockIcon className="h-5 w-5" />;
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <div className="text-yellow-400 text-4xl mb-4">🔗</div>
        <h2 className="text-xl font-semibold text-yellow-900 mb-2">
          Conecte sua Carteira
        </h2>
        <p className="text-yellow-700">
          Conecte sua carteira para visualizar o dashboard administrativo
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {localLoading && <Loading overlay text="Carregando dashboard..." />}

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <BanknotesIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Supply
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {formatAmount(systemMetrics.totalSupply)} LUSDT
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ArrowTrendingUpIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Volume Diário
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {formatAmount(systemMetrics.dailyVolume)} LUSDT
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CurrencyDollarIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Taxas Coletadas
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {formatAmount(systemMetrics.totalFees)} LUSDT
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Transações Totais
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {formatNumber(systemMetrics.totalTransactions)}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Status da Bridge e Redes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status da Bridge */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <ServerIcon className="h-6 w-6 mr-2 text-gray-600" />
            Status da Bridge
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Status Operacional</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                bridgeStatus.operational ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {bridgeStatus.operational ? (
                  <>
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Operacional
                  </>
                ) : (
                  <>
                    <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                    Inativo
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Pausado</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                bridgeStatus.paused ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
              }`}>
                {bridgeStatus.paused ? 'Sim' : 'Não'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Fila de Processamento</span>
              <span className="text-sm text-gray-900">{bridgeStatus.queueLength} transações</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Tempo Médio</span>
              <span className="text-sm text-gray-900">{bridgeStatus.processingTime}s</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Taxa de Sucesso</span>
              <span className="text-sm text-green-600 font-medium">
                {formatPercentage(bridgeStatus.successRate)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Uptime</span>
              <span className="text-sm text-green-600 font-medium">
                {formatPercentage(bridgeStatus.uptime)}
              </span>
            </div>
          </div>
        </div>

        {/* Status das Redes */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <GlobeAltIcon className="h-6 w-6 mr-2 text-gray-600" />
            Status das Redes
          </h3>
          
          <div className="space-y-6">
            {/* Solana */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Solana Network</h4>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  getHealthColor(networkStatus.solana.health)
                }`}>
                  {getHealthIcon(networkStatus.solana.health)}
                  <span className="ml-1 capitalize">{networkStatus.solana.health}</span>
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Block Height:</span>
                  <span className="ml-2 font-medium">{formatNumber(networkStatus.solana.blockHeight)}</span>
                </div>
                <div>
                  <span className="text-gray-500">TPS:</span>
                  <span className="ml-2 font-medium">{formatNumber(networkStatus.solana.tps)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Avg Fee:</span>
                  <span className="ml-2 font-medium">{networkStatus.solana.avgFee} SOL</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className={`ml-2 font-medium ${
                    networkStatus.solana.connected ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {networkStatus.solana.connected ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
              </div>
            </div>

            {/* Lunes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Lunes Network</h4>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  getHealthColor(networkStatus.lunes.health)
                }`}>
                  {getHealthIcon(networkStatus.lunes.health)}
                  <span className="ml-1 capitalize">{networkStatus.lunes.health}</span>
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Block Height:</span>
                  <span className="ml-2 font-medium">{formatNumber(networkStatus.lunes.blockHeight)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Finalized:</span>
                  <span className="ml-2 font-medium">{formatNumber(networkStatus.lunes.finalizedHeight)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Block Time:</span>
                  <span className="ml-2 font-medium">{networkStatus.lunes.avgBlockTime}s</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className={`ml-2 font-medium ${
                    networkStatus.lunes.connected ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {networkStatus.lunes.connected ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos de Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume de Transações por Hora */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Volume de Transações (24h)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={transactionAnalytics.hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => {
                  const v = asPrimitive(value);
                  const display = name === 'volume' || name === 'fees' ? `${formatAmount(v)} LUSDT` : v;
                  const label = name === 'deposits' ? 'Depósitos' : name === 'redemptions' ? 'Resgates' : name === 'volume' ? 'Volume' : 'Taxas';
                  return [display as string | number, label];
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="volume" 
                stackId="1"
                stroke="#3B82F6" 
                fill="#3B82F6" 
                fillOpacity={0.6}
                name="Volume"
              />
              <Area 
                type="monotone" 
                dataKey="fees" 
                stackId="2"
                stroke="#10B981" 
                fill="#10B981" 
                fillOpacity={0.6}
                name="Taxas"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Transações por Tipo */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Transações por Tipo (24h)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={transactionAnalytics.hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="deposits" fill="#3B82F6" name="Depósitos" />
              <Bar dataKey="redemptions" fill="#10B981" name="Resgates" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tendências Diárias */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Tendências Diárias (30 dias)
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={transactionAnalytics.dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip 
              formatter={(value, name) => {
                const v = asPrimitive(value);
                const display = name === 'volume' || name === 'fees' ? `${formatAmount(v)} LUSDT` : name === 'successRate' && typeof v === 'number' ? `${v}%` : v;
                const label = name === 'transactions' ? 'Transações' : name === 'volume' ? 'Volume' : name === 'fees' ? 'Taxas' : 'Taxa de Sucesso';
                return [display as string | number, label];
              }}
            />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="transactions" 
              stroke="#3B82F6" 
              strokeWidth={2}
              name="Transações"
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="volume" 
              stroke="#10B981" 
              strokeWidth={2}
              name="Volume"
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="successRate" 
              stroke="#F59E0B" 
              strokeWidth={2}
              name="Taxa de Sucesso (%)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Informações Adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <ShieldCheckIcon className="h-6 w-6 mr-2 text-green-600" />
            Segurança
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Multisig Ativo</span>
              <span className="text-sm font-medium text-green-600">✓ Sim</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Emergency Pause</span>
              <span className="text-sm font-medium text-green-600">✓ Disponível</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Rate Limiting</span>
              <span className="text-sm font-medium text-green-600">✓ Ativo</span>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <CpuChipIcon className="h-6 w-6 mr-2 text-blue-600" />
            Performance
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Usuários Ativos</span>
              <span className="text-sm font-medium text-gray-900">
                {formatNumber(systemMetrics.activeUsers)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Saldo Bridge</span>
              <span className="text-sm font-medium text-gray-900">
                {formatAmount(systemMetrics.bridgeBalance)} LUSDT
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Saldo Treasury</span>
              <span className="text-sm font-medium text-gray-900">
                {formatAmount(systemMetrics.treasuryBalance)} USDT
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <SignalIcon className="h-6 w-6 mr-2 text-purple-600" />
            Monitoramento
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Última Atualização</span>
              <span className="text-sm font-medium text-gray-900">
                {new Date().toLocaleTimeString('pt-BR')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Auto Refresh</span>
              <span className="text-sm font-medium text-green-600">✓ 30s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Alertas Ativos</span>
              <span className="text-sm font-medium text-gray-900">0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}