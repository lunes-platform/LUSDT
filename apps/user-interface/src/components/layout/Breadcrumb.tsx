import React from 'react';
import { Link } from 'react-router-dom';
import type { BreadcrumbItem } from '../../types';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <nav className="flex items-center space-x-2 text-sm" aria-label="Breadcrumb">
      <div className="flex items-center space-x-2">
        {/* Home Icon */}
        <Link
          to="/"
          className="text-gray-400 hover:text-gray-600 transition-colors duration-150"
          title="Go to Dashboard"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </Link>
        
        {items.length > 1 && (
          <svg className="h-4 w-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      <ol className="flex items-center space-x-2">
        {items.slice(1).map((item, index) => (
          <li key={item.name} className="flex items-center space-x-2">
            {item.current ? (
              <span 
                className="text-gray-900 font-medium px-2 py-1 bg-gray-100 rounded-md" 
                aria-current="page"
              >
                {item.name}
              </span>
            ) : (
              <>
                <Link
                  to={item.href || '#'}
                  className="text-gray-600 hover:text-gray-900 transition-colors duration-150 px-2 py-1 rounded-md hover:bg-gray-50"
                >
                  {item.name}
                </Link>
                {index < items.slice(1).length - 1 && (
                  <svg className="h-4 w-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;