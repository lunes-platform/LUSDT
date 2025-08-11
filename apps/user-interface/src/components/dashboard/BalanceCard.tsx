import React from 'react';

interface BalanceCardProps {
  title: string;
  balance: number | null;
  token: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
  onClick?: () => void;
}

const BalanceCard: React.FC<BalanceCardProps> = ({
  title,
  balance,
  token,
  icon,
  trend,
  isLoading = false,
  onClick
}) => {
  const formatBalance = (value: number | null) => {
    if (value === null) return '---.--';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value);
  };

  return (
    <div 
      className={`bg-white overflow-hidden shadow rounded-lg transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:scale-105' : ''
      }`}
      onClick={onClick}
    >
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {icon}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
                  ) : (
                    `${formatBalance(balance)} ${token}`
                  )}
                </div>
                {trend && !isLoading && (
                  <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {trend.isPositive ? (
                      <svg className="self-center flex-shrink-0 h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="self-center flex-shrink-0 h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="sr-only">
                      {trend.isPositive ? 'Increased' : 'Decreased'} by
                    </span>
                    {Math.abs(trend.value).toFixed(2)}%
                  </div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceCard;