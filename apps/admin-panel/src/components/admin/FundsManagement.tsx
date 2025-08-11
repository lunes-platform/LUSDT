import { useState, useEffect, useCallback } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { useConfirmDialog } from '../common/ConfirmDialog';
import Loading from '../common/Loading';
import { validateSubstrateAddress } from '../../utils/validation';
import { getErrorMessage } from '../../utils/error';
import { logAdminAction, updateAuditResult, AuditAction } from '../../utils/audit';
import type { DistributionWallets as SharedDistributionWallets } from '../../types/contracts';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import {
  BanknotesIcon,
  CogIcon,
  ChartBarIcon,
  WalletIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Usamos o tipo compartilhado do contrato (development, marketing, burn, reserve)
type DistributionWallets = SharedDistributionWallets;

interface FeeConfig {
  transfer_fee: number;
  mint_fee: number;
  burn_fee: number;
}

export default function FundsManagement() {
  const {
    taxManagerService,
    currentAccount,
    isConnected,
    tokenInfo,
    setError
  } = useAdminStore();

  // Estados locais
  const [distributionWallets, setDistributionWallets] = useState<DistributionWallets>({
    development: '',
    marketing: '',
    burn: '',
    reserve: ''
  });
  const [newWallets, setNewWallets] = useState<DistributionWallets>({
    development: '',
    marketing: '',
    burn: '',
    reserve: ''
  });
  const [monthlyVolume, setMonthlyVolume] = useState<string>('0');
  const [feeConfig, setFeeConfig] = useState<FeeConfig>({
    transfer_fee: 0,
    mint_fee: 0,
    burn_fee: 0
  });
  const [localLoading, setLocalLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { showConfirm, ConfirmDialogComponent } = useConfirmDialog();

  // Verificar se é owner
  const isOwner = !!tokenInfo && currentAccount === tokenInfo.owner;

  // Carregar carteiras de distribuição
  const loadDistributionWallets = useCallback(async () => {
    if (!taxManagerService) return;

    try {
      const wallets = await taxManagerService.getDistributionWallets();
      setDistributionWallets(wallets);
      setNewWallets(wallets);
    } catch (error) {
      setError('Erro ao carregar carteiras de distribuição: ' + getErrorMessage(error));
    }
  }, [taxManagerService, setError]);

  // Carregar volume mensal
  const loadMonthlyVolume = useCallback(async () => {
    if (!taxManagerService) return;

    try {
      const volume = await taxManagerService.getMonthlyVolume();
      setMonthlyVolume(volume);
    } catch (error) {
      console.warn('Erro ao carregar volume mensal:', getErrorMessage(error));
    }
  }, [taxManagerService]);

  // Carregar configuração de taxas
  const loadFeeConfig = useCallback(async () => {
    if (!taxManagerService) return;

    try {
      const config = await taxManagerService.getFeeConfig();
      setFeeConfig(config);
    } catch (error) {
      console.warn('Erro ao carregar configuração de taxas:', getErrorMessage(error));
    }
  }, [taxManagerService]);

  // Validar formulário de carteiras
  const validateWalletsForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validar cada carteira
    const marketingValidation = validateSubstrateAddress(newWallets.marketing);
    if (!marketingValidation.isValid) {
      errors.marketing = 'Endereço marketing inválido';
    }

    const developmentValidation = validateSubstrateAddress(newWallets.development);
    if (!developmentValidation.isValid) {
      errors.development = 'Endereço development inválido';
    }

    const burnValidation = validateSubstrateAddress(newWallets.burn);
    if (!burnValidation.isValid) {
      errors.burn = 'Endereço burn inválido';
    }

    const reserveValidation = validateSubstrateAddress(newWallets.reserve);
    if (!reserveValidation.isValid) {
      errors.reserve = 'Endereço reserve inválido';
    }

    // Verificar se as carteiras são diferentes
    const walletAddresses = [newWallets.development, newWallets.marketing, newWallets.burn, newWallets.reserve];
    const uniqueAddresses = new Set(walletAddresses);
    if (uniqueAddresses.size !== walletAddresses.length) {
      errors.duplicate = 'Carteiras não podem ser idênticas';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Atualizar carteiras de distribuição
  const handleUpdateWallets = async () => {
    if (!taxManagerService || !currentAccount) return;
    if (!validateWalletsForm()) return;

    const confirmed = await showConfirm({
      title: 'Confirmar Atualização de Carteiras',
      message: 'Você tem certeza que deseja atualizar as carteiras de distribuição?',
      confirmText: 'Sim, Atualizar',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    const logId = logAdminAction(
      AuditAction.DISTRIBUTION_WALLETS_UPDATED,
      currentAccount,
      { 
        oldWallets: distributionWallets,
        newWallets: newWallets
      }
    );

    setLocalLoading(true);
    setError(null);

    try {
      const result = await taxManagerService.updateDistributionWallets(currentAccount, newWallets);
      
      if (result.txHash) {
        updateAuditResult(logId, 'success', result.txHash);
        // sucesso local pode ser exibido em alerta se necessário
        
        // Atualizar dados
        setTimeout(() => {
          loadDistributionWallets();
        }, 3000);
      } else {
        throw new Error(result.error || 'Transação falhou');
      }
    } catch (error) {
      updateAuditResult(logId, 'failure', undefined, getErrorMessage(error));
      setError('Erro ao atualizar carteiras: ' + getErrorMessage(error));
    } finally {
      setLocalLoading(false);
    }
  };

  // Carregar todos os dados
  useEffect(() => {
    if (!isConnected) return;

    loadDistributionWallets();
    loadMonthlyVolume();
    loadFeeConfig();
  }, [isConnected, loadDistributionWallets, loadMonthlyVolume, loadFeeConfig]);

  // Formatação de números
  const formatAmount = (amount: string): string => {
    const amountNum = parseInt(amount) / 1_000_000;
    return amountNum.toLocaleString('pt-BR', { 
      minimumFractionDigits: 6, 
      maximumFractionDigits: 6 
    });
  };

  const formatAddress = (address: string): string => {
    if (!address) return 'Não definido';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const formatPercentage = (basisPoints: number): string => {
    return (basisPoints / 100).toFixed(2) + '%';
  };

  // Calcular taxas estimadas
  const calculateEstimatedFees = (): string => {
    const volume = parseInt(monthlyVolume);
    const avgFee = (feeConfig.transfer_fee + feeConfig.mint_fee + feeConfig.burn_fee) / 3;
    const estimatedFees = (volume * avgFee) / 10000; // basis points para decimal
    return formatAmount(estimatedFees.toString());
  };

  // Dados para gráficos
  const pieData = [
    { name: 'Treasury', value: 50, color: '#3B82F6' },
    { name: 'Marketing', value: 30, color: '#10B981' },
    { name: 'Development', value: 20, color: '#F59E0B' }
  ];

  const barData = [
    { name: 'Transfer', fee: feeConfig.transfer_fee / 100, volume: parseInt(monthlyVolume) * 0.7 },
    { name: 'Mint', fee: feeConfig.mint_fee / 100, volume: parseInt(monthlyVolume) * 0.2 },
    { name: 'Burn', fee: feeConfig.burn_fee / 100, volume: parseInt(monthlyVolume) * 0.1 }
  ];

  if (!isConnected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <div className="text-yellow-400 text-4xl mb-4">🔗</div>
        <h2 className="text-xl font-semibold text-yellow-900 mb-2">
          Conecte sua Carteira
        </h2>
        <p className="text-yellow-700">
          Conecte sua carteira para gerenciar fundos e distribuições
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialogComponent />
      {localLoading && <Loading overlay text="Atualizando carteiras..." />}

      {/* Estatísticas dos Fundos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <ChartBarIcon className="h-6 w-6 mr-2 text-blue-600" />
            Volume Mensal
          </h3>
          <div className="text-3xl font-bold text-blue-900">
            {formatAmount(monthlyVolume)} LUSDT
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Volume de transações deste mês
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <BanknotesIcon className="h-6 w-6 mr-2 text-green-600" />
            Taxas Estimadas
          </h3>
          <div className="text-3xl font-bold text-green-900">
            {calculateEstimatedFees()} LUSDT
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Receita estimada este mês
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <CogIcon className="h-6 w-6 mr-2 text-purple-600" />
            Configuração de Taxas
          </h3>
          <div className="space-y-1">
            <div className="text-sm text-gray-600">
              Taxa de Transferência: <span className="font-semibold">{formatPercentage(feeConfig.transfer_fee)}</span>
            </div>
            <div className="text-sm text-gray-600">
              Taxa de Mint: <span className="font-semibold">{formatPercentage(feeConfig.mint_fee)}</span>
            </div>
            <div className="text-sm text-gray-600">
              Taxa de Burn: <span className="font-semibold">{formatPercentage(feeConfig.burn_fee)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Carteiras de Distribuição Atuais */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <WalletIcon className="h-6 w-6 mr-2 text-gray-600" />
          Carteiras de Distribuição
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-blue-600">Development</div>
            <div className="text-sm font-mono text-blue-900 mt-1">
              {formatAddress(distributionWallets.development)}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-green-600">Marketing</div>
            <div className="text-sm font-mono text-green-900 mt-1">
              {formatAddress(distributionWallets.marketing)}
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-red-600">Burn</div>
            <div className="text-sm font-mono text-red-900 mt-1">
              {formatAddress(distributionWallets.burn)}
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-yellow-600">Reserve</div>
            <div className="text-sm font-mono text-yellow-900 mt-1">
              {formatAddress(distributionWallets.reserve)}
            </div>
          </div>
        </div>

        {!isOwner && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
            <p className="text-sm text-gray-700">
              📖 Visualização apenas - Apenas o Owner pode atualizar carteiras
            </p>
          </div>
        )}

        {/* Formulário de Atualização */}
        {isOwner && (
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-800">Atualizar Carteiras</h4>
            
            {validationErrors.duplicate && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">{validationErrors.duplicate}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="marketing" className="block text-sm font-medium text-gray-700">
                  Marketing Wallet
                </label>
                <input
                  type="text"
                  id="marketing"
                  value={newWallets.marketing}
                  onChange={(e) => setNewWallets({ ...newWallets, marketing: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f"
                />
                {validationErrors.marketing && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.marketing}</p>
                )}
              </div>

              <div>
                <label htmlFor="development" className="block text-sm font-medium text-gray-700">
                  Development Wallet
                </label>
                <input
                  type="text"
                  id="development"
                  value={newWallets.development}
                  onChange={(e) => setNewWallets({ ...newWallets, development: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="5D34dL5prEUaGNQtPPZ3yN5Y6BnkfXunKXXz6fo7ZJbLwRRH"
                />
                {validationErrors.development && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.development}</p>
                )}
              </div>

              <div>
                <label htmlFor="burn" className="block text-sm font-medium text-gray-700">
                  Burn Wallet
                </label>
                <input
                  type="text"
                  id="burn"
                  value={newWallets.burn}
                  onChange={(e) => setNewWallets({ ...newWallets, burn: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="5Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
                {validationErrors.burn && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.burn}</p>
                )}
              </div>

              <div>
                <label htmlFor="reserve" className="block text-sm font-medium text-gray-700">
                  Reserve Wallet
                </label>
                <input
                  type="text"
                  id="reserve"
                  value={newWallets.reserve}
                  onChange={(e) => setNewWallets({ ...newWallets, reserve: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="5Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
                {validationErrors.reserve && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.reserve}</p>
                )}
              </div>
            </div>

            <button
              onClick={handleUpdateWallets}
              disabled={localLoading || !newWallets.development || !newWallets.marketing || !newWallets.burn || !newWallets.reserve}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <ArrowPathIcon className="h-5 w-5 mr-2" />
              {localLoading ? 'Atualizando...' : 'Atualizar Carteiras'}
            </button>
          </div>
        )}
      </div>

      {/* Gráficos de Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Distribuição de Fundos
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Volume por Tipo de Operação
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'fee' ? `${value}%` : formatAmount(value.toString()),
                  name === 'fee' ? 'Taxa' : 'Volume'
                ]}
              />
              <Legend />
              <Bar dataKey="volume" fill="#3B82F6" name="Volume" />
              <Bar dataKey="fee" fill="#10B981" name="Taxa %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}