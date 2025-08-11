import { useState, useEffect } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { LusdtTokenService } from '../../services/lusdt';
import { useConfirmDialog } from '../common/ConfirmDialog';
import { LoadingSpinner } from '../common/Loading';
import ErrorAlert from '../common/ErrorAlert';
import { getErrorMessage } from '../../utils/error';
import { 
  BanknotesIcon, 
  ShieldCheckIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

export default function TokenManagement() {
  const {
    lusdtService,
    currentAccount,
    tokenInfo,
    adminPermissions,
    refreshTokenData,
    isLoading
  } = useAdminStore();

  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados dos formulários
  const [newBridge, setNewBridge] = useState('');
  const [newTaxManager, setNewTaxManager] = useState('');
  const [newEmergencyAdmin, setNewEmergencyAdmin] = useState('');
  const [mintTo, setMintTo] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [pauseReason, setPauseReason] = useState('');

  const { showConfirm, ConfirmDialog } = useConfirmDialog();

  // Atualizar dados quando o serviço estiver disponível
  useEffect(() => {
    if (lusdtService && !tokenInfo) {
      refreshTokenData();
    }
  }, [lusdtService, tokenInfo, refreshTokenData]);

  // Limpar mensagens após um tempo
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleRefresh = async () => {
    setLocalLoading(true);
    setError(null);
    try {
      await refreshTokenData();
      setSuccess('Dados atualizados com sucesso!');
    } catch (err) {
      setError('Erro ao atualizar dados: ' + getErrorMessage(err));
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSetBridgeAccount = async () => {
    if (!lusdtService || !currentAccount || !newBridge) return;
    
    showConfirm({
      title: 'Confirmar Alteração',
      message: `Deseja alterar a conta bridge para ${LusdtTokenService.formatAddress(newBridge)}?`,
      variant: 'warning',
      onConfirm: async () => {
        setLocalLoading(true);
        setError(null);
        try {
          const result = await lusdtService.setBridgeAccount(currentAccount, newBridge);
          if (result.txHash) {
            setSuccess(`Conta bridge atualizada! TX: ${result.txHash}`);
            setNewBridge('');
            // Aguardar um pouco antes de atualizar
            setTimeout(() => refreshTokenData(), 3000);
          } else {
            throw new Error(result.error || 'Transação falhou');
          }
        } catch (err) {
          setError('Erro ao definir conta bridge: ' + getErrorMessage(err));
        } finally {
          setLocalLoading(false);
        }
      }
    });
  };

  const handleSetTaxManager = async () => {
    if (!lusdtService || !currentAccount || !newTaxManager) return;
    
    showConfirm({
      title: 'Confirmar Alteração',
      message: `Deseja alterar o contrato tax manager para ${LusdtTokenService.formatAddress(newTaxManager)}?`,
      variant: 'warning',
      onConfirm: async () => {
        setLocalLoading(true);
        setError(null);
        try {
          const result = await lusdtService.setTaxManagerContract(currentAccount, newTaxManager);
          if (result.txHash) {
            setSuccess(`Tax manager atualizado! TX: ${result.txHash}`);
            setNewTaxManager('');
            setTimeout(() => refreshTokenData(), 3000);
          } else {
            throw new Error(result.error || 'Transação falhou');
          }
        } catch (err) {
          setError('Erro ao definir tax manager: ' + getErrorMessage(err));
        } finally {
          setLocalLoading(false);
        }
      }
    });
  };

  const handleUpdateEmergencyAdmin = async () => {
    if (!lusdtService || !currentAccount || !newEmergencyAdmin) return;
    
    showConfirm({
      title: 'Confirmar Alteração',
      message: `Deseja alterar o administrador de emergência para ${LusdtTokenService.formatAddress(newEmergencyAdmin)}?`,
      variant: 'warning',
      onConfirm: async () => {
        setLocalLoading(true);
        setError(null);
        try {
          const result = await lusdtService.updateEmergencyAdmin(currentAccount, newEmergencyAdmin);
          if (result.txHash) {
            setSuccess(`Admin de emergência atualizado! TX: ${result.txHash}`);
            setNewEmergencyAdmin('');
            setTimeout(() => refreshTokenData(), 3000);
          } else {
            throw new Error(result.error || 'Transação falhou');
          }
        } catch (err) {
          setError('Erro ao atualizar admin de emergência: ' + getErrorMessage(err));
        } finally {
          setLocalLoading(false);
        }
      }
    });
  };

  const handleMint = async () => {
    if (!lusdtService || !currentAccount || !mintTo || !mintAmount) return;
    
    const amountWei = LusdtTokenService.toWei(mintAmount);
    
    showConfirm({
      title: 'Confirmar Mint',
      message: `Deseja mintar ${mintAmount} LUSDT para ${LusdtTokenService.formatAddress(mintTo)}?`,
      variant: 'info',
      onConfirm: async () => {
        setLocalLoading(true);
        setError(null);
        try {
          const result = await lusdtService.mint(currentAccount, mintTo, amountWei);
          if (result.txHash) {
            setSuccess(`${mintAmount} LUSDT mintados com sucesso! TX: ${result.txHash}`);
            setMintTo('');
            setMintAmount('');
            setTimeout(() => refreshTokenData(), 3000);
          } else {
            throw new Error(result.error || 'Transação falhou');
          }
        } catch (err) {
          setError('Erro ao mintar tokens: ' + getErrorMessage(err));
        } finally {
          setLocalLoading(false);
        }
      }
    });
  };

  const handleEmergencyPause = async () => {
    if (!lusdtService || !currentAccount || !pauseReason) return;
    
    showConfirm({
      title: 'Confirmar Pausa de Emergência',
      message: `Deseja pausar o contrato? Motivo: "${pauseReason}". Esta ação bloqueará todas as transferências.`,
      variant: 'danger',
      onConfirm: async () => {
        setLocalLoading(true);
        setError(null);
        try {
          const result = await lusdtService.emergencyPause(currentAccount, pauseReason);
          if (result.txHash) {
            setSuccess(`Contrato pausado! TX: ${result.txHash}`);
            setPauseReason('');
            setTimeout(() => refreshTokenData(), 3000);
          } else {
            throw new Error(result.error || 'Transação falhou');
          }
        } catch (err) {
          setError('Erro ao pausar contrato: ' + getErrorMessage(err));
        } finally {
          setLocalLoading(false);
        }
      }
    });
  };

  const handleEmergencyUnpause = async () => {
    if (!lusdtService || !currentAccount) return;
    
    showConfirm({
      title: 'Confirmar Remoção de Pausa',
      message: 'Deseja remover a pausa de emergência e reativar as transferências?',
      variant: 'success',
      onConfirm: async () => {
        setLocalLoading(true);
        setError(null);
        try {
          const result = await lusdtService.emergencyUnpause(currentAccount);
          if (result.txHash) {
            setSuccess(`Pausa removida! TX: ${result.txHash}`);
            setTimeout(() => refreshTokenData(), 3000);
          } else {
            throw new Error(result.error || 'Transação falhou');
          }
        } catch (err) {
          setError('Erro ao remover pausa: ' + getErrorMessage(err));
        } finally {
          setLocalLoading(false);
        }
      }
    });
  };

  if (!currentAccount) {
    return (
      <div className="text-center py-12">
        <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Conecte sua carteira</h3>
        <p className="mt-1 text-sm text-gray-500">
          Para gerenciar o token LUSDT, conecte sua carteira primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      
      {/* Header com botão de refresh */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          🪙 Gerenciamento de Token LUSDT
        </h2>
        
        <button
          onClick={handleRefresh}
          disabled={isLoading || localLoading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {(isLoading || localLoading) ? (
            <LoadingSpinner className="w-4 h-4 mr-2" />
          ) : (
            <ArrowPathIcon className="w-4 h-4 mr-2" />
          )}
          Atualizar
        </button>
      </div>

      {/* Alertas */}
      {error && (
        <ErrorAlert
          title="Erro"
          message={error}
          onClose={() => setError(null)}
          variant="error"
        />
      )}
      
      {success && (
        <ErrorAlert
          title="Sucesso"
          message={success}
          onClose={() => setSuccess(null)}
          variant="info"
        />
      )}

      {/* Informações do Token */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          📊 Informações do Token
        </h3>
        
        {tokenInfo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <BanknotesIcon className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <div className="text-sm font-medium text-blue-600">Total Supply</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {LusdtTokenService.fromWei(tokenInfo.totalSupply)} LUSDT
                  </div>
                </div>
              </div>
            </div>
            
            <div className={`p-4 rounded-lg ${tokenInfo.isPaused ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className="flex items-center">
                <ExclamationTriangleIcon className={`h-8 w-8 mr-3 ${tokenInfo.isPaused ? 'text-red-600' : 'text-green-600'}`} />
                <div>
                  <div className={`text-sm font-medium ${tokenInfo.isPaused ? 'text-red-600' : 'text-green-600'}`}>
                    Status
                  </div>
                  <div className={`text-2xl font-bold ${tokenInfo.isPaused ? 'text-red-900' : 'text-green-900'}`}>
                    {tokenInfo.isPaused ? '⏸️ Pausado' : '✅ Ativo'}
                  </div>
                  {tokenInfo.isPaused && tokenInfo.pauseReason && (
                    <div className="text-xs text-red-700 mt-1">
                      {tokenInfo.pauseReason}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-purple-600">Owner</div>
              <div className="text-sm font-mono text-purple-900 mt-1">
                {LusdtTokenService.formatAddress(tokenInfo.owner)}
              </div>
              {currentAccount === tokenInfo.owner && (
                <div className="text-xs text-purple-700 mt-1">👑 Você é o owner</div>
              )}
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-orange-600">Bridge</div>
              <div className="text-sm font-mono text-orange-900 mt-1">
                {LusdtTokenService.formatAddress(tokenInfo.bridgeAccount)}
              </div>
              {currentAccount === tokenInfo.bridgeAccount && (
                <div className="text-xs text-orange-700 mt-1">🌉 Você é o bridge</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <LoadingSpinner className="w-8 h-8 mx-auto" />
            <p className="mt-2 text-sm text-gray-500">Carregando informações do token...</p>
          </div>
        )}
      </div>

      {/* Funções do Owner */}
      {adminPermissions.canUpdateBridge && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            👑 Funções do Proprietário
          </h3>
          
          <div className="space-y-6">
            {/* Atualizar Bridge */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Novo Endereço Bridge
              </label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newBridge}
                  onChange={(e) => setNewBridge(e.target.value)}
                  placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
                  className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <button
                  onClick={handleSetBridgeAccount}
                  disabled={!newBridge || localLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  Atualizar Bridge
                </button>
              </div>
            </div>

            {/* Atualizar Tax Manager */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Novo Contrato Tax Manager
              </label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newTaxManager}
                  onChange={(e) => setNewTaxManager(e.target.value)}
                  placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
                  className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <button
                  onClick={handleSetTaxManager}
                  disabled={!newTaxManager || localLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                >
                  Atualizar Tax Manager
                </button>
              </div>
            </div>

            {/* Atualizar Emergency Admin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Novo Administrador de Emergência
              </label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newEmergencyAdmin}
                  onChange={(e) => setNewEmergencyAdmin(e.target.value)}
                  placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
                  className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <button
                  onClick={handleUpdateEmergencyAdmin}
                  disabled={!newEmergencyAdmin || localLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  Atualizar Emergency Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Funções do Bridge */}
      {adminPermissions.canMint && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            🌉 Funções do Bridge
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Endereço Destinatário
              </label>
              <input
                type="text"
                value={mintTo}
                onChange={(e) => setMintTo(e.target.value)}
                placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantidade (LUSDT)
              </label>
              <input
                type="number"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                placeholder="100.000000"
                step="0.000001"
                min="0"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <button
              onClick={handleMint}
              disabled={!mintTo || !mintAmount || localLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              <CurrencyDollarIcon className="w-4 h-4 mr-2" />
              Mintar LUSDT
            </button>
          </div>
        </div>
      )}

      {/* Funções de Emergência */}
      {adminPermissions.canPause && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            🚨 Controles de Emergência
          </h3>
          
          {!tokenInfo?.isPaused ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo da Pausa
              </label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="Ex: Vulnerabilidade detectada"
                  className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                />
                <button
                  onClick={handleEmergencyPause}
                  disabled={!pauseReason || localLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  ⏸️ Pausar Contrato
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-red-600 mb-4">
                ⚠️ O contrato está pausado. Nenhuma transferência pode ser realizada.
              </p>
              <button
                onClick={handleEmergencyUnpause}
                disabled={localLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                ▶️ Remover Pausa
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sem permissões */}
      {!adminPermissions.canMint && !adminPermissions.canPause && !adminPermissions.canUpdateBridge && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                Sem Permissões Administrativas
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                Você não tem permissões administrativas para este contrato. 
                Conecte-se com a conta do Owner, Bridge ou Emergency Admin para gerenciar o token.
              </p>
              {tokenInfo && (
                <div className="mt-3 text-xs text-yellow-600">
                  <div>• Owner: {LusdtTokenService.formatAddress(tokenInfo.owner)}</div>
                  <div>• Bridge: {LusdtTokenService.formatAddress(tokenInfo.bridgeAccount)}</div>
                  <div>• Emergency Admin: {LusdtTokenService.formatAddress(tokenInfo.emergencyAdmin)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}