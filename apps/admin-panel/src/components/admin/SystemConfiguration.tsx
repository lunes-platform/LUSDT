import { useState, useEffect, useCallback } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { useConfirmDialog } from '../common/ConfirmDialog';
import Loading from '../common/Loading';
import ErrorAlert from '../common/ErrorAlert';
import { getErrorMessage } from '../../utils/error';
import {
  CogIcon,
  ServerIcon,
  BellIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface NetworkEndpoint {
  name: string;
  url: string;
  status: 'active' | 'inactive' | 'error';
  latency?: number;
}

interface AlertThreshold {
  name: string;
  type: 'balance' | 'volume' | 'error_rate' | 'latency';
  threshold: number;
  unit: string;
  enabled: boolean;
}

interface SystemHealth {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  lastCheck: Date;
}

export default function SystemConfiguration() {
  const {
    isConnected,
    adminPermissions,
    setError
  } = useAdminStore();

  // Estados locais
  const [networkEndpoints, setNetworkEndpoints] = useState<NetworkEndpoint[]>([
    {
      name: 'Solana Mainnet',
      url: 'https://api.mainnet-beta.solana.com',
      status: 'active',
      latency: 120
    },
    {
      name: 'Solana Devnet',
      url: 'https://api.devnet.solana.com',
      status: 'inactive',
      latency: 95
    },
    {
      name: 'Lunes Network',
      url: 'wss://lunes-node.example.com',
      status: 'active',
      latency: 85
    }
  ]);

  const [alertThresholds, setAlertThresholds] = useState<AlertThreshold[]>([
    {
      name: 'Saldo Mínimo Bridge',
      type: 'balance',
      threshold: 10000,
      unit: 'LUSDT',
      enabled: true
    },
    {
      name: 'Volume Diário Máximo',
      type: 'volume',
      threshold: 1000000,
      unit: 'LUSDT',
      enabled: true
    },
    {
      name: 'Taxa de Erro Máxima',
      type: 'error_rate',
      threshold: 5,
      unit: '%',
      enabled: true
    },
    {
      name: 'Latência Máxima',
      type: 'latency',
      threshold: 5000,
      unit: 'ms',
      enabled: true
    }
  ]);

  const [systemHealth, setSystemHealth] = useState<SystemHealth[]>([
    {
      component: 'Bridge Service',
      status: 'healthy',
      message: 'Operando normalmente',
      lastCheck: new Date()
    },
    {
      component: 'Database',
      status: 'healthy',
      message: 'Conexão estável',
      lastCheck: new Date()
    },
    {
      component: 'Monitoring',
      status: 'warning',
      message: 'Alguns alertas pendentes',
      lastCheck: new Date()
    },
    {
      component: 'Backup System',
      status: 'healthy',
      message: 'Último backup: 2h atrás',
      lastCheck: new Date()
    }
  ]);

  const [localLoading, setLocalLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [newEndpoint, setNewEndpoint] = useState({ name: '', url: '' });
  const [editingThreshold, setEditingThreshold] = useState<AlertThreshold | null>(null);

  const { showConfirm, ConfirmDialogComponent } = useConfirmDialog();

  // Verificar saúde do sistema
  const checkSystemHealth = useCallback(async () => {
    setLocalLoading(true);
    try {
      // Mock de verificação - em produção faria chamadas reais
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedHealth = systemHealth.map(component => ({
        ...component,
        lastCheck: new Date(),
        // Simular algumas mudanças de status
        status: Math.random() > 0.8 ? 'warning' : component.status
      }));
      
      setSystemHealth(updatedHealth);
      setSuccess('Verificação de saúde do sistema concluída');
    } catch (error) {
      setError('Erro ao verificar saúde do sistema: ' + getErrorMessage(error));
    } finally {
      setLocalLoading(false);
    }
  }, [systemHealth, setError]);

  // Testar endpoint
  const testEndpoint = async (endpoint: NetworkEndpoint) => {
    setLocalLoading(true);
    try {
      // Mock de teste - em produção faria ping real
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedEndpoints = networkEndpoints.map(ep => 
        ep.name === endpoint.name 
          ? { ...ep, status: 'active' as const, latency: Math.floor(Math.random() * 200) + 50 }
          : ep
      );
      
      setNetworkEndpoints(updatedEndpoints);
      setSuccess(`Endpoint ${endpoint.name} testado com sucesso`);
    } catch (error) {
      setError('Erro ao testar endpoint: ' + getErrorMessage(error));
    } finally {
      setLocalLoading(false);
    }
  };

  // Adicionar endpoint
  const addEndpoint = async () => {
    if (!newEndpoint.name || !newEndpoint.url) return;

    const confirmed = await showConfirm({
      title: 'Adicionar Endpoint',
      message: `Deseja adicionar o endpoint "${newEndpoint.name}"?`,
      confirmText: 'Adicionar',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    const endpoint: NetworkEndpoint = {
      name: newEndpoint.name,
      url: newEndpoint.url,
      status: 'inactive'
    };

    setNetworkEndpoints([...networkEndpoints, endpoint]);
    setNewEndpoint({ name: '', url: '' });
    setSuccess('Endpoint adicionado com sucesso');
  };

  // Remover endpoint
  const removeEndpoint = async (endpoint: NetworkEndpoint) => {
    const confirmed = await showConfirm({
      title: 'Remover Endpoint',
      message: `Deseja remover o endpoint "${endpoint.name}"?`,
      confirmText: 'Remover',
      cancelText: 'Cancelar',
      variant: 'danger'
    });

    if (!confirmed) return;

    setNetworkEndpoints(networkEndpoints.filter(ep => ep.name !== endpoint.name));
    setSuccess('Endpoint removido com sucesso');
  };

  // Atualizar threshold
  const updateThreshold = async (threshold: AlertThreshold) => {
    if (!editingThreshold) return;

    const confirmed = await showConfirm({
      title: 'Atualizar Threshold',
      message: `Deseja atualizar o threshold "${threshold.name}"?`,
      confirmText: 'Atualizar',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    const updatedThresholds = alertThresholds.map(t => 
      t.name === threshold.name ? editingThreshold : t
    );

    setAlertThresholds(updatedThresholds);
    setEditingThreshold(null);
    setSuccess('Threshold atualizado com sucesso');
  };

  // Toggle threshold
  const toggleThreshold = (threshold: AlertThreshold) => {
    const updatedThresholds = alertThresholds.map(t => 
      t.name === threshold.name ? { ...t, enabled: !t.enabled } : t
    );
    setAlertThresholds(updatedThresholds);
  };

  // Executar backup
  const executeBackup = async () => {
    const confirmed = await showConfirm({
      title: 'Executar Backup',
      message: 'Deseja executar um backup manual do sistema?',
      confirmText: 'Executar',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    setLocalLoading(true);
    try {
      // Mock de backup - em produção executaria backup real
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSuccess('Backup executado com sucesso');
    } catch (error) {
      setError('Erro ao executar backup: ' + getErrorMessage(error));
    } finally {
      setLocalLoading(false);
    }
  };

  // Limpar mensagens de sucesso
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Verificação automática de saúde
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(checkSystemHealth, 60000); // A cada minuto
    return () => clearInterval(interval);
  }, [isConnected, checkSystemHealth]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'active':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'critical':
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'inactive':
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
          Conecte sua carteira para acessar as configurações do sistema
        </p>
      </div>
    );
  }

  // Verificar permissões
  const hasPermissions = adminPermissions.canUpdateBridge || adminPermissions.canUpdateTaxManager;

  return (
    <div className="space-y-6">
      <ConfirmDialogComponent />
      {localLoading && <Loading overlay text="Processando..." />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            ⚙️ Configurações do Sistema
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie endpoints, alertas e configurações do sistema LUSDT
          </p>
        </div>
        
        <button
          onClick={checkSystemHealth}
          disabled={localLoading}
          className="mt-4 sm:mt-0 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Verificar Saúde
        </button>
      </div>

      {/* Alertas */}
      {success && (
        <ErrorAlert
          title="Sucesso"
          message={success}
          onClose={() => setSuccess(null)}
          variant="info"
        />
      )}

      {!hasPermissions && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                Permissões Limitadas
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                Você tem acesso limitado às configurações. Algumas funcionalidades podem estar desabilitadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Saúde do Sistema */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <ShieldCheckIcon className="h-6 w-6 mr-2 text-green-600" />
          Saúde do Sistema
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {systemHealth.map((component) => (
            <div key={component.component} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900">{component.component}</h4>
                {getStatusIcon(component.status)}
              </div>
              
              <div className="mb-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(component.status)}`}>
                  {component.status}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">{component.message}</p>
              
              <p className="text-xs text-gray-500">
                Última verificação: {component.lastCheck.toLocaleTimeString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoints de Rede */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <ServerIcon className="h-6 w-6 mr-2 text-blue-600" />
          Endpoints de Rede
        </h3>
        
        {/* Lista de Endpoints */}
        <div className="space-y-4 mb-6">
          {networkEndpoints.map((endpoint) => (
            <div key={endpoint.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center">
                  {getStatusIcon(endpoint.status)}
                  <h4 className="ml-2 text-sm font-medium text-gray-900">{endpoint.name}</h4>
                  <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(endpoint.status)}`}>
                    {endpoint.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{endpoint.url}</p>
                {endpoint.latency && (
                  <p className="text-xs text-gray-500 mt-1">Latência: {endpoint.latency}ms</p>
                )}
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => testEndpoint(endpoint)}
                  disabled={localLoading}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Testar
                </button>
                
                {hasPermissions && (
                  <button
                    onClick={() => removeEndpoint(endpoint)}
                    disabled={localLoading}
                    className="inline-flex items-center px-3 py-1 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Adicionar Endpoint */}
        {hasPermissions && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Adicionar Novo Endpoint</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={newEndpoint.name}
                onChange={(e) => setNewEndpoint({ ...newEndpoint, name: e.target.value })}
                placeholder="Nome do endpoint"
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <input
                type="url"
                value={newEndpoint.url}
                onChange={(e) => setNewEndpoint({ ...newEndpoint, url: e.target.value })}
                placeholder="URL do endpoint"
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <button
                onClick={addEndpoint}
                disabled={!newEndpoint.name || !newEndpoint.url || localLoading}
                className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Thresholds de Alerta */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <BellIcon className="h-6 w-6 mr-2 text-yellow-600" />
          Thresholds de Alerta
        </h3>
        
        <div className="space-y-4">
          {alertThresholds.map((threshold) => (
            <div key={threshold.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center">
                  <h4 className="text-sm font-medium text-gray-900">{threshold.name}</h4>
                  <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    threshold.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {threshold.enabled ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Threshold: {threshold.threshold.toLocaleString('pt-BR')} {threshold.unit}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => toggleThreshold(threshold)}
                  className={`inline-flex items-center px-3 py-1 border shadow-sm text-xs font-medium rounded ${
                    threshold.enabled
                      ? 'border-red-300 text-red-700 bg-white hover:bg-red-50'
                      : 'border-green-300 text-green-700 bg-white hover:bg-green-50'
                  }`}
                >
                  {threshold.enabled ? 'Desativar' : 'Ativar'}
                </button>
                
                {hasPermissions && (
                  <button
                    onClick={() => setEditingThreshold(threshold)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Edição de Threshold */}
      {editingThreshold && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Editar Threshold: {editingThreshold.name}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor do Threshold
              </label>
              <div className="flex">
                <input
                  type="number"
                  value={editingThreshold.threshold}
                  onChange={(e) => setEditingThreshold({
                    ...editingThreshold,
                    threshold: parseFloat(e.target.value) || 0
                  })}
                  className="flex-1 block w-full border-gray-300 rounded-l-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <span className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-r-md">
                  {editingThreshold.unit}
                </span>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setEditingThreshold(null)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => updateThreshold(editingThreshold)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup e Recuperação */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <CogIcon className="h-6 w-6 mr-2 text-gray-600" />
          Backup e Recuperação
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Status do Backup</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Último backup:</span>
                <span className="text-sm font-medium text-gray-900">2 horas atrás</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Próximo backup:</span>
                <span className="text-sm font-medium text-gray-900">Em 22 horas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <span className="text-sm font-medium text-green-600">✓ Funcionando</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Ações</h4>
            <div className="space-y-2">
              {hasPermissions && (
                <button
                  onClick={executeBackup}
                  disabled={localLoading}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  Executar Backup Manual
                </button>
              )}
              
              <button
                disabled
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"
              >
                Restaurar Backup (Em breve)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}