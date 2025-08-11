import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { routes } from '../../utils/routes';
import type { NavigationItem } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  const navigation: NavigationItem[] = routes.map(route => ({
    name: route.title,
    href: route.path,
    icon: route.icon,
    current: location.pathname === route.path
  }));

  return (
    <>
      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={onClose} />
        </div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Mobile close button */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 lg:hidden">
            <span className="text-lg font-semibold text-gray-900">Menu</span>
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={onClose}
            >
              <span className="sr-only">Close sidebar</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6">
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                      ${item.current
                        ? 'bg-blue-100 text-blue-900 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                      }
                    `}
                    onClick={() => {
                      // Close mobile sidebar when navigating
                      if (window.innerWidth < 1024) {
                        onClose();
                      }
                    }}
                  >
                    {Icon && (
                      <Icon
                        className={`
                          mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-200
                          ${item.current ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}
                        `}
                      />
                    )}
                    <span className="truncate">{item.name}</span>
                    {item.current && (
                      <div className="ml-auto h-2 w-2 bg-blue-600 rounded-full"></div>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Quick Stats */}
            <div className="mt-8 px-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Quick Stats
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Active Bridges</span>
                  <span className="font-medium text-gray-900">2</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total Volume</span>
                  <span className="font-medium text-gray-900">$1.2K</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Success Rate</span>
                  <span className="font-medium text-green-600">98.5%</span>
                </div>
              </div>
            </div>
          </nav>

          {/* Footer */}
          <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 mb-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">L</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">LUSDT Bridge</p>
                <p className="text-xs text-gray-500">v1.0.0</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Powered by</span>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">Solana</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Lunes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;