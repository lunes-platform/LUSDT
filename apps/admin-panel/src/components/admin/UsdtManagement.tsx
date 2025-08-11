import { useState, useEffect, useCallback } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { useConfirmDialog } from '../common/ConfirmDialog';
import Loading from '../common/Loading';
import { validateSubstrateAddress, validateTokenAmount } from '../../utils/validation';
import { getErrorMessage } from '../../utils/error';
import { logAdminAction, updateAuditResult, AuditAction } from '../../utils/audit';
// import {
//   BanknotesIcon,
//   ArrowRightIcon,
//   ClockIcon,
//   ArrowPathIcon,
//   CurrencyDollarIcon,
//   DocumentTextIcon
// } from '@heroicons/react/24/outline';

interface TransferHistory {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  type: 'transfer' | 'mint' | 'burn';
}

export default function UsdtManagement() {
  const {
    lusdtService,
    currentAccount,
    isConnected,
    tokenInfo,
    setError,
    refreshData
  } = useAdminStore();

  // Estados locais
  const [balance, setBalance] = useState<string>('0');
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [transferHistory, setTransferHistory] = useState<TransferHistory[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { showConfirm, ConfirmDialogComponent } = useConfirmDialog();

  // Verificar se é dono ou bridge
  const owner = tokenInfo?.owner;
  const bridgeAccount = tokenInfo?.bridgeAccount;
  const canTransfer = currentAccount === owner || currentAccount === bridgeAccount;

  // Carregar saldo USDT do usuário atual
  const loadBalance = useCallback(async () => {
    if (!lusdtService || !currentAccount) return;

    try {
      const userBalance = await lusdtService.getBalanceOf(currentAccount);
      setBalance(userBalance);
    } catch (error) {
      setError('Erro ao carregar saldo USDT: ' + getErrorMessage(error));
    }
  }, [lusdtService, currentAccount, setError]);

  // Carregar histórico de transferências (mock por enquanto)
  const loadTransferHistory = useCallback(async () => {
    if (!lusdtService || !currentAccount) return;

    try {
      // Mock de histórico - em produção viria do contrato ou indexer
      const mockHistory: TransferHistory[] = [
        {
          txHash: '0x123...abc',
          from: currentAccount,
          to: '5FZoQhgUCmqBxnkHX7jCqThScS2xQWiwiF61msg63CFL3Y8f',
          amount: '100000000',
          timestamp: Date.now() - 86400000, // 1 dia atrás
          type: 'transfer'
        }
      ];
      setTransferHistory(mockHistory);
    } catch (error) {
      console.warn('Erro ao carregar histórico:', getErrorMessage(error));
    }
  }, [lusdtService, currentAccount]);

  // Validar dados do formulário
  const validateTransferForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validar endereço destinatário
    const addressValidation = validateSubstrateAddress(recipient);
    if (!addressValidation.isValid) {
      errors.recipient = addressValidation.error || 'Endereço inválido';
    }

    // Validar quantidade
    const amountValidation = validateTokenAmount(amount);
    if (!amountValidation.isValid) {
      errors.amount = amountValidation.error || 'Quantidade inválida';
    }

    // Verificar se não está tentando transferir para si mesmo
    if (recipient === currentAccount) {
      errors.recipient = 'Não é possível transferir para si mesmo';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Executar transferência
  const handleTransfer = async () => {
    if (!lusdtService || !currentAccount) return;
    if (!validateTransferForm()) return;

    const confirmed = await showConfirm({
      title: 'Confirmar Transferência',
      message: `Você tem certeza que deseja transferir ${amount} LUSDT para ${recipient}?`,
      confirmText: 'Sim, Transferir',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    const logId = logAdminAction(
      AuditAction.BRIDGE_ACCOUNT_UPDATED, // Ação existente como proxy
      currentAccount,
      { recipient, amount, type: 'transfer' }
    );

    setLocalLoading(true);
    setError(null);
    // limpar mensagens de sucesso/erro antigas

    try {
      // Converter para wei (6 decimais)
      const amountWei = (parseFloat(amount) * 1_000_000).toString();
      
      const result = await lusdtService.transfer(currentAccount, recipient, amountWei);
      
      if (result.txHash) {
        updateAuditResult(logId, 'success', result.txHash);
        // sucesso local
        
        // Limpar formulário
        setRecipient('');
        setAmount('');
        setValidationErrors({});
        
        // Atualizar dados
        setTimeout(() => {
          loadBalance();
          loadTransferHistory();
          refreshData();
        }, 3000);
      } else {
        throw new Error(result.error || 'Transação falhou');
      }
    } catch (error) {
      updateAuditResult(logId, 'failure', undefined, getErrorMessage(error));
      setError('Erro ao transferir LUSDT: ' + getErrorMessage(error));
    } finally {
      setLocalLoading(false);
    }
  };

  // Atualizar dados periodicamente
  useEffect(() => {
    if (!isConnected) return;

    loadBalance();
    loadTransferHistory();

    const interval = setInterval(() => {
      loadBalance().catch(() => {
        console.warn('Erro ao atualizar saldo automaticamente');
      });
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [isConnected, loadBalance, loadTransferHistory]);

  // Formatação de números
  const formatAmount = (amount: string): string => {
    const amountNum = parseInt(amount) / 1_000_000;
    return amountNum.toLocaleString('pt-BR', { 
      minimumFractionDigits: 6, 
      maximumFractionDigits: 6 
    });
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isConnected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <div className="text-yellow-400 text-4xl mb-4">🔗</div>
        <h2 className="text-xl font-semibold text-yellow-900 mb-2">
          Conecte sua Carteira
        </h2>
        <p className="text-yellow-700">
          Conecte sua carteira para gerenciar seus tokens LUSDT
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialogComponent />
      {localLoading && <Loading overlay text="Processando transferência..." />}

      {/* Saldo e Total Supply */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              💰
              Saldo LUSDT
            </h3>
            <button
              onClick={loadBalance}
              className="text-gray-400 hover:text-gray-600"
              title="Atualizar saldo"
            >
              🔄
            </button>
          </div>
          <div className="text-3xl font-bold text-green-900">
            {formatAmount(balance)} LUSDT
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Seu saldo atual de tokens LUSDT
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            🏦 Total Supply
          </h3>
          <div className="text-3xl font-bold text-blue-900">
            {formatAmount(tokenInfo?.totalSupply ?? '0')} LUSDT
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Total de tokens em circulação
          </p>
        </div>
      
      </div>

      {/* Formulário de Transferência */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          ➡️
          Transferir LUSDT
        </h3>

        {!canTransfer && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Apenas o Owner e Bridge podem realizar transferências
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
              Destinatário
            </label>
            <input
              type="text"
              id="recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={!canTransfer}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
              placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
            />
            {validationErrors.recipient && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.recipient}</p>
            )}
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Quantidade (LUSDT)
            </label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!canTransfer}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
              placeholder="100.000000"
              step="0.000001"
            />
            {validationErrors.amount && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.amount}</p>
            )}
          </div>

          <button
            onClick={handleTransfer}
            disabled={localLoading || !canTransfer || !recipient || !amount}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 flex items-center justify-center"
          >
            <span className="mr-2" role="img" aria-label="arrow">➡️</span>
            {localLoading ? 'Transferindo...' : 'Transferir LUSDT'}
          </button>
        </div>
      </div>

      {/* Histórico de Transações */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <span className="mr-2" role="img" aria-label="doc">📄</span>
          Histórico de Transações
        </h3>

        {transferHistory.length === 0 ? (
          <div className="text-center py-8">
            ⏰
            <p className="text-gray-500">Nenhuma transação encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    De
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Para
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TX Hash
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transferHistory.map((tx, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(tx.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                      {formatAddress(tx.from)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                      {formatAddress(tx.to)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700">
                      {formatAmount(tx.amount)} LUSDT
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">
                      <a
                        href={`#${tx.txHash}`}
                        className="hover:underline"
                        title="Ver transação"
                      >
                        {formatAddress(tx.txHash)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}