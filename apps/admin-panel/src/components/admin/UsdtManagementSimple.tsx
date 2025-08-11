import { useState, useEffect, useCallback } from 'react';
import { useAdminStore } from '../../store/adminStore';

export default function UsdtManagement() {
  const {
    lusdtService,
    currentAccount,
    totalSupply,
    isConnected,
    owner,
    bridgeAccount,
    setLoading,
    setError,
    setSuccess,
    refreshContractData
  } = useAdminStore();

  const [balance, setBalance] = useState<string>('0');

  if (!isConnected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
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
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Saldo LUSDT
        </h3>
        <div className="text-3xl font-bold text-green-900">
          500.000000 LUSDT
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Total Supply
        </h3>
        <div className="text-3xl font-bold text-blue-900">
          1,000.000000 LUSDT
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Transferir LUSDT
        </h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
              Destinatário
            </label>
            <input
              type="text"
              id="recipient"
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500"
              placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
            />
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Quantidade (LUSDT)
            </label>
            <input
              type="number"
              id="amount"
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500"
              placeholder="100.000000"
              step="0.000001"
            />
          </div>

          <button
            className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Transferir LUSDT
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Histórico de Transações
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-500">Nenhuma transação encontrada</p>
        </div>
      </div>
    </div>
  );
}