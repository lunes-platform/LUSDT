import React, { useState } from 'react';
import { useWalletStore, getSolanaWallets, isLunesWalletAvailable } from '../../store/walletStore';
import { WalletReadyState } from '../../types/wallet';

interface WalletConnectorProps {
  onClose?: () => void;
}

const WalletConnector: React.FC<WalletConnectorProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'solana' | 'lunes'>('solana');
  const { 
    solana, 
    lunes, 
    isConnecting, 
    error, 
    connectSolanaWallet, 
    connectLunesWallet,
    clearError 
  } = useWalletStore();

  const solanaWallets = getSolanaWallets();
  const lunesAvailable = isLunesWalletAvailable();

  const handleSolanaConnect = async (walletName: string) => {
    clearError();
    await connectSolanaWallet(walletName);
    if (onClose) onClose();
  };

  const handleLunesConnect = async () => {
    clearError();
    await connectLunesWallet();
    if (onClose) onClose();
  };

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Connect Wallet</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Tabs */}
        <div className="mt-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('solana')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'solana'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Solana Wallets
            </button>
            <button
              onClick={() => setActiveTab('lunes')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'lunes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Lunes Wallet
            </button>
          </nav>
        </div>
      </div>

      <div className="px-6 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={clearError}
                  className="text-red-400 hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'solana' && (
          <div className="space-y-3">
            {solanaWallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => handleSolanaConnect(wallet.name)}
                disabled={isConnecting || !wallet.installed || solana?.connected}
                className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${
                  wallet.installed && !solana?.connected
                    ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">
                      {wallet.name.charAt(0)}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{wallet.name}</p>
                    <p className="text-xs text-gray-500">
                      {wallet.installed ? 'Detected' : 'Not installed'}
                    </p>
                  </div>
                </div>
                
                {solana?.connected && solana.wallet?.name === wallet.name ? (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    Connected
                  </span>
                ) : !wallet.installed ? (
                  <a
                    href={wallet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Install
                  </a>
                ) : isConnecting ? (
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                ) : null}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'lunes' && (
          <div className="space-y-3">
            <button
              onClick={handleLunesConnect}
              disabled={isConnecting || !lunesAvailable || lunes?.connected}
              className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${
                lunesAvailable && !lunes?.connected
                  ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  : 'border-gray-100 bg-gray-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-white">P</span>
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Polkadot.js Extension</p>
                  <p className="text-xs text-gray-500">
                    {lunesAvailable ? 'Detected' : 'Not installed'}
                  </p>
                </div>
              </div>
              
              {lunes?.connected ? (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Connected
                </span>
              ) : !lunesAvailable ? (
                <a
                  href="https://polkadot.js.org/extension/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  Install
                </a>
              ) : isConnecting ? (
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              ) : null}
            </button>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
        <p className="text-xs text-gray-500 text-center">
          By connecting a wallet, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default WalletConnector;