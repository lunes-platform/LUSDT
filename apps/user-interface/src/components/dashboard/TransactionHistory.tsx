import React, { useState } from 'react';
import { useTransactionStore } from '../../store/transactionStore';
import type { Transaction, TransactionFilter } from '../../types/transaction';

interface TransactionHistoryProps {
  limit?: number;
  showFilters?: boolean;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ 
  limit = 5, 
  showFilters = false 
}) => {
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const { 
    getFilteredTransactions, 
    setFilter, 
    clearFilter, 
    filter, 
    refreshTransactions, 
    isLoading 
  } = useTransactionStore();

  const transactions = getFilteredTransactions();
  const displayedTransactions = showAllTransactions 
    ? transactions 
    : transactions.slice(0, limit);

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: Transaction['type']) => {
    if (type === 'deposit') {
      return (
        <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      );
    }
    return (
      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    );
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount);
  };

  const handleStatusFilter = (status: Transaction['status']) => {
    const currentStatuses = filter.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    
    setFilter({ status: newStatuses.length > 0 ? newStatuses : undefined });
  };

  const handleTypeFilter = (type: Transaction['type']) => {
    const currentTypes = filter.type || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    
    setFilter({ type: newTypes.length > 0 ? newTypes : undefined });
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Transaction History
          </h3>
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start bridging to see your transaction history.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Transaction History
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={refreshTransactions}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50"
              title="Refresh transactions"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              {(['completed', 'processing', 'pending', 'failed'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusFilter(status)}
                  className={`px-2 py-1 text-xs rounded-full border ${
                    filter.status?.includes(status)
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700">Type:</span>
              {(['deposit', 'redemption'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => handleTypeFilter(type)}
                  className={`px-2 py-1 text-xs rounded-full border ${
                    filter.type?.includes(type)
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {type}
                </button>
              ))}
              {(filter.status || filter.type) && (
                <button
                  onClick={clearFilter}
                  className="px-2 py-1 text-xs text-red-600 hover:text-red-800"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flow-root">
          <ul className="-mb-8">
            {displayedTransactions.map((transaction, index) => (
              <li key={transaction.id}>
                <div className="relative pb-8">
                  {index !== displayedTransactions.length - 1 && (
                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" />
                  )}
                  <div className="relative flex space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                      {getTypeIcon(transaction.type)}
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                      <div>
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">
                            {transaction.type === 'deposit' ? 'Deposit' : 'Redemption'}
                          </span>{' '}
                          {formatAmount(transaction.amount)} {transaction.fromToken} → {transaction.toToken}
                        </p>
                        <p className="text-xs text-gray-500">
                          From {transaction.fromNetwork} to {transaction.toNetwork}
                        </p>
                        {transaction.error && (
                          <p className="text-xs text-red-600 mt-1">
                            {transaction.error}
                          </p>
                        )}
                      </div>
                      <div className="whitespace-nowrap text-right text-sm">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </div>
                        <time className="text-xs text-gray-500 block mt-1">
                          {formatDate(transaction.timestamp)}
                        </time>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {transactions.length > limit && !showAllTransactions && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowAllTransactions(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View all {transactions.length} transactions
            </button>
          </div>
        )}

        {showAllTransactions && transactions.length > limit && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowAllTransactions(false)}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Show less
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionHistory;