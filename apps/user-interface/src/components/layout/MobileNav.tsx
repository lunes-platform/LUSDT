import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { routes } from '../../utils/routes';
import { useWallet } from '../../hooks/useWallet';

const MobileNav: React.FC = () => {
  const location = useLocation();
  const { hasAnyConnection } = useWallet();

  const mobileNavItems = routes.filter(route => 
    // Show all routes, but indicate which require wallet connection
    true
  ).map(route => ({
    ...route,
    current: location.pathname === route.path,
    disabled: route.requiresWallet && !hasAnyConnection
  }));

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="grid grid-cols-4 h-16">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex flex-col items-center justify-center space-y-1 transition-colors duration-200
                ${item.current
                  ? 'text-blue-600 bg-blue-50'
                  : item.disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
              onClick={(e) => {
                if (item.disabled) {
                  e.preventDefault();
                }
              }}
            >
              {Icon && (
                <Icon className="h-5 w-5" />
              )}
              <span className="text-xs font-medium truncate max-w-full px-1">
                {item.title}
              </span>
              {item.current && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full"></div>
              )}
              {item.disabled && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full"></div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default MobileNav;