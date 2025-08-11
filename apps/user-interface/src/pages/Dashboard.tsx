import React, { useState } from 'react';
import { useWalletStore } from '../store/walletStore';
import { useTransactionStore } from '../store/transactionStore';
import { WalletModal } from '../components/wallet';
import { BalanceCard, TransactionHistory, QuickActions } from '../components/dashboard';

const Dashboard: React.FC = () => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { solana, lunes, refreshBalances } = useWalletStore();
  const { getTransactionSummary } = useTransactionStore();
  
  const hasConnectedWallets = solana?.connected || lunes?.connected;
  const transactionSummary = getTransactionSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your LUSDT bridge activity
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Balance Cards */}
        <BalanceCard
          title="USDT Balance"
          balance={solana?.connected ? solana.balance : null}
          token="USDT"
          icon={
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">U</span>
            </div>
          }
          onClick={refreshBalances}
        />

        <BalanceCard
          title="LUSDT Balance"
          balance={lunes?.connected ? lunes.balance : null}
          token="LUSDT"
          icon={
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">L</span>
            </div>
          }
          onClick={refreshBalances}
        />

        <BalanceCard
          title="Total Transactions"
          balance={transactionSummary.totalTransactions}
          token=""
          icon={
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          }
        />

        <BalanceCard
          title="Total Volume"
          balance={transactionSummary.totalVolume}
          token="USD"
          icon={
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          }
        />
      </div>

      {/* Quick Actions */}
      <QuickActions onConnectWallet={() => setShowWalletModal(true)} />

      {/* Recent Transactions */}
      <TransactionHistory limit={5} />
      
      {/* Wallet Modal */}
      <WalletModal 
        isOpen={showWalletModal} 
        onClose={() => setShowWalletModal(false)} 
      />
    </div>
  );
};

export default Dashboard;