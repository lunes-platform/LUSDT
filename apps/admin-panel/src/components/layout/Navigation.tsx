import { useState } from 'react';
import {
  ChartBarIcon,
  CogIcon,
  CurrencyDollarIcon,
  DocumentChartBarIcon,
  AdjustmentsHorizontalIcon,
  
} from '@heroicons/react/24/outline';

export type NavigationTab = 'dashboard' | 'token-management' | 'tax-overview' | 'transaction-monitoring' | 'system-config';

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

const navigationItems = [
  {
    id: 'dashboard' as NavigationTab,
    name: 'Dashboard',
    icon: ChartBarIcon,
    description: 'Visão geral do sistema'
  },
  {
    id: 'token-management' as NavigationTab,
    name: 'Token Management',
    icon: CurrencyDollarIcon,
    description: 'Gerenciar LUSDT Token'
  },
  {
    id: 'tax-overview' as NavigationTab,
    name: 'Tax Manager',
    icon: AdjustmentsHorizontalIcon,
    description: 'Configurar taxas e preços'
  },
  {
    id: 'transaction-monitoring' as NavigationTab,
    name: 'Transactions',
    icon: DocumentChartBarIcon,
    description: 'Monitorar transações'
  },
  {
    id: 'system-config' as NavigationTab,
    name: 'System Config',
    icon: CogIcon,
    description: 'Configurações do sistema'
  }
];

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop Navigation */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-gray-800">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <span className="text-2xl">🏦</span>
                <h1 className="ml-2 text-lg font-semibold text-white">
                  LUSDT Admin
                </h1>
              </div>
              <nav className="mt-8 flex-1 px-2 space-y-1">
                {navigationItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left transition-colors duration-150 ${
                        isActive
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <item.icon
                        className={`mr-3 flex-shrink-0 h-6 w-6 ${
                          isActive ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-300'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
            
            {/* Footer */}
            <div className="flex-shrink-0 flex bg-gray-700 p-4">
              <div className="flex items-center">
                <div>
                  <p className="text-sm font-medium text-white">LUSDT Admin Panel</p>
                  <p className="text-xs text-gray-300">v1.0.0</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Mobile menu button */}
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl">🏦</span>
            <h1 className="ml-2 text-lg font-semibold text-white">
              LUSDT Admin
            </h1>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-300 hover:text-white focus:outline-none focus:text-white"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="bg-gray-800 px-2 pt-2 pb-3 space-y-1">
            {navigationItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <item.icon
                    className={`mr-3 flex-shrink-0 h-6 w-6 ${
                      isActive ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-300'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tab Navigation for smaller screens */}
      <div className="lg:hidden bg-white shadow">
        <div className="px-4 py-2">
          <div className="flex space-x-1 overflow-x-auto">
            {navigationItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-md transition-colors duration-150 ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}