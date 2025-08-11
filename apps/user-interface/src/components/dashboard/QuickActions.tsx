import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../hooks/useWallet';

interface QuickActionsProps {
  onConnectWallet?: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onConnectWallet }) => {
  const navigate = useNavigate();
  const { solana, lunes, hasAnyConnection, canDeposit, canRedeem } = useWallet();

  const actions = [
    {
      id: 'deposit',
      title: 'Deposit USDT → LUSDT',
      description: 'Convert USDT to LUSDT',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      color: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      enabled: canDeposit,
      requiredWallets: ['Solana', 'Lunes'],
      onClick: () => navigate('/bridge?type=deposit')
    },
    {
      id: 'redeem',
      title: 'Redeem LUSDT → USDT',
      description: 'Convert LUSDT back to USDT',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      ),
      color: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
      enabled: canRedeem,
      requiredWallets: ['Lunes', 'Solana'],
      onClick: () => navigate('/bridge?type=redemption')
    },
    {
      id: 'history',
      title: 'View History',
      description: 'Check transaction history',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      color: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500',
      enabled: hasAnyConnection,
      requiredWallets: [],
      onClick: () => navigate('/history')
    }
  ];

  const getWalletStatus = (walletName: string) => {
    switch (walletName) {
      case 'Solana':
        return solana?.connected;
      case 'Lunes':
        return lunes?.connected;
      default:
        return false;
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          Quick Actions
        </h3>
        
        {!hasAnyConnection ? (
          <div className="text-center py-6">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">Connect your wallets to start bridging</p>
            <button
              onClick={onConnectWallet}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Connect Wallets
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((action) => (
              <div key={action.id} className="relative">
                <button
                  onClick={action.onClick}
                  disabled={!action.enabled}
                  className={`w-full p-4 text-left rounded-lg border transition-all duration-200 ${
                    action.enabled
                      ? 'border-gray-200 hover:border-blue-300 hover:shadow-md bg-white'
                      : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 p-2 rounded-lg text-white ${
                      action.enabled ? action.color.split(' ')[0] : 'bg-gray-400'
                    }`}>
                      {action.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900">
                        {action.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {action.description}
                      </p>
                      
                      {action.requiredWallets.length > 0 && (
                        <div className="flex items-center space-x-2 mt-2">
                          {action.requiredWallets.map((wallet) => (
                            <div
                              key={wallet}
                              className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${
                                getWalletStatus(wallet)
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                getWalletStatus(wallet) ? 'bg-green-500' : 'bg-red-500'
                              }`} />
                              <span>{wallet}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
                
                {!action.enabled && action.requiredWallets.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-2">
                        Connect required wallets:
                      </p>
                      <div className="flex justify-center space-x-1">
                        {action.requiredWallets.map((wallet) => (
                          <span
                            key={wallet}
                            className={`text-xs px-2 py-1 rounded-full ${
                              getWalletStatus(wallet)
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {wallet}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickActions;