import { useState } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { LoadingSpinner } from '../common/Loading';
import ErrorAlert from '../common/ErrorAlert';
import { WalletIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function Header() {
  const {
    isConnected,
    currentAccount,
    accounts,
    networkInfo,
    error,
    connectWallet,
    disconnectWallet,
    setCurrentAccount,
    setError
  } = useAdminStore();
  
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectWallet();
    } catch (error) {
      console.error('Erro ao conectar:', error);
      // O erro já está no store
    } finally {
      setIsConnecting(false);
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const getNetworkBadge = () => {
    if (!networkInfo) return null;
    
    const isLocal = networkInfo.currentNetwork?.includes('127.0.0.1') || 
                   networkInfo.currentNetwork?.includes('localhost');
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isLocal 
          ? 'bg-yellow-100 text-yellow-800' 
          : 'bg-green-100 text-green-800'
      }`}>
        {isLocal ? '🔧 Local' : '🌐 ' + (networkInfo.chain || 'Rede')}
      </span>
    );
  };

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo e título */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span className="text-2xl">🏦</span>
                <h1 className="ml-2 text-xl font-semibold text-gray-900">
                  LUSDT Admin Panel
                </h1>
              </div>
              
              {networkInfo && getNetworkBadge()}
            </div>
            
            {/* Área de conexão */}
            <div className="flex items-center space-x-4">
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <WalletIcon className="w-4 h-4 mr-2" />
                      Conectar Carteira
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center space-x-3">
                  {/* Seletor de conta */}
                  <div className="min-w-0">
                    <select
                      value={currentAccount || ''}
                      onChange={(e) => setCurrentAccount(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {accounts.map((account) => (
                        <option key={account.address} value={account.address}>
                          {account.meta.name || 'Sem nome'} ({formatAddress(account.address)})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Botão desconectar */}
                  <button
                    onClick={disconnectWallet}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Desconectar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Alerta de erro global */}
      {error && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <ErrorAlert
              title="Erro de Conexão"
              message={error}
              onClose={() => setError(null)}
              variant="error"
            />
          </div>
        </div>
      )}

      {/* Aviso para instalar extensão */}
      {!isConnected && !isConnecting && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-blue-400 mr-3" />
              <p className="text-sm text-blue-700">
                Para usar o painel administrativo, você precisa ter a{' '}
                <a 
                  href="https://polkadot.js.org/extension/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-medium underline hover:text-blue-800"
                >
                  extensão Polkadot.js
                </a>
                {' '}instalada e configurada.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}