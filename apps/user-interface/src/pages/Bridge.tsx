import React, { useState } from 'react';
import { DepositForm } from '../components/bridge';
import { Button } from '@lusdt/shared-components';

const Bridge: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'redemption'>('deposit');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">LUSDT Bridge</h1>
        <p className="mt-2 text-lg text-gray-600">
          Convert between USDT and LUSDT across chains
        </p>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`px-6 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === 'deposit'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Depósito (USDT → LUSDT)
          </button>
          <button
            onClick={() => setActiveTab('redemption')}
            className={`px-6 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === 'redemption'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Resgate (LUSDT → USDT)
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'deposit' && (
          <DepositForm />
        )}
        
        {activeTab === 'redemption' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white shadow rounded-lg border-2 border-dashed border-gray-300">
              <div className="px-4 py-12 text-center">
                <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Resgate em Desenvolvimento
                </h3>
                <p className="text-gray-600 mb-4">
                  A funcionalidade de resgate LUSDT → USDT será implementada em breve.
                </p>
                <p className="text-sm text-gray-500">
                  Por enquanto, use a funcionalidade de depósito para converter USDT em LUSDT.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Bridge;