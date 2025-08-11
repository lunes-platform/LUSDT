import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { WalletDisplay, WalletModal } from '../wallet';
import { useWalletStore } from '../../store/walletStore';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { solana, lunes } = useWalletStore();
  
  const hasConnectedWallets = solana?.connected || lunes?.connected;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          <div className="flex items-center">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden"
              onClick={onMenuClick}
            >
              <span className="sr-only">Open main menu</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link to="/" className="flex items-center ml-4 lg:ml-0">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">L</span>
                </div>
                <span className="ml-2 text-xl font-bold text-gray-900">LUSDT Bridge</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {/* Network Status */}
            <div className="hidden sm:flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-500">Solana</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-500">Lunes</span>
                </div>
              </div>
              
              {/* Bridge Status */}
              <div className="flex items-center space-x-1 px-2 py-1 bg-green-50 rounded-full">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-700 font-medium">Bridge Online</span>
              </div>
            </div>

            {/* Wallet Connection Status */}
            <div className="flex items-center space-x-2">
              {hasConnectedWallets ? (
                <WalletDisplay />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowWalletModal(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Connect Wallets
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Wallet Modal */}
      <WalletModal 
        isOpen={showWalletModal} 
        onClose={() => setShowWalletModal(false)} 
      />
    </header>
  );
};

export default Header;