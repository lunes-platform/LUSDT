import React, { useState } from 'react';
import { useWalletStore } from '../../store/walletStore';

interface WalletDisplayProps {
  compact?: boolean;
}

const WalletDisplay: React.FC<WalletDisplayProps> = ({ compact = false }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const { 
    solana, 
    lunes, 
    disconnectSolanaWallet, 
    disconnectLunesWallet, 
    disconnectAllWallets,
    refreshBalances 
  } = useWalletStore();

  const hasConnectedWallets = solana?.connected || lunes?.connected;

  const formatAddress = (address: string, length = 4) => {
    if (!address) return '';
    return `${address.slice(0, length)}...${address.slice(-length)}`;
  };

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(balance);
  };

  if (!hasConnectedWallets) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        {solana?.connected && (
          <div className="flex items-center space-x-1 bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span>Solana</span>
          </div>
        )}
        {lunes?.connected && (
          <div className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Lunes</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-2 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <div className="flex items-center space-x-1">
          {solana?.connected && (
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          )}
          {lunes?.connected && (
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          )}
        </div>
        <span className="font-medium">
          {solana?.connected && lunes?.connected 
            ? 'Both Connected' 
            : solana?.connected 
            ? 'Solana Connected' 
            : 'Lunes Connected'}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Connected Wallets</h3>
                <button
                  onClick={refreshBalances}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  title="Refresh balances"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                {solana?.connected && (
                  <div className="border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-white">S</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {solana.wallet?.name || 'Solana Wallet'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatAddress(solana.publicKey)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          disconnectSolanaWallet();
                          setShowDropdown(false);
                        }}
                        className="text-gray-400 hover:text-red-500 focus:outline-none"
                        title="Disconnect"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-xs text-gray-600">
                      Balance: {formatBalance(solana.balance)} USDT
                    </div>
                  </div>
                )}

                {lunes?.connected && (
                  <div className="border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-white">L</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Lunes Wallet</p>
                          <p className="text-xs text-gray-500">
                            {formatAddress(lunes.address)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          disconnectLunesWallet();
                          setShowDropdown(false);
                        }}
                        className="text-gray-400 hover:text-red-500 focus:outline-none"
                        title="Disconnect"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-xs text-gray-600">
                      Balance: {formatBalance(lunes.balance)} LUSDT
                    </div>
                  </div>
                )}
              </div>

              {solana?.connected && lunes?.connected && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => {
                      disconnectAllWallets();
                      setShowDropdown(false);
                    }}
                    className="w-full text-center text-sm text-red-600 hover:text-red-800 focus:outline-none"
                  >
                    Disconnect All Wallets
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WalletDisplay;