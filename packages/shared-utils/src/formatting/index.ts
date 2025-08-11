import { format, formatDistanceToNow, isValid } from 'date-fns';

// Number formatting
export function formatNumber(
  value: number,
  options: {
    decimals?: number;
    compact?: boolean;
    currency?: string;
  } = {}
): string {
  const { decimals = 2, compact = false, currency } = options;

  if (currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      notation: compact ? 'compact' : 'standard'
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? 'compact' : 'standard'
  }).format(value);
}

// Token amount formatting
export function formatTokenAmount(
  amount: number,
  decimals: number = 6,
  symbol?: string
): string {
  const formatted = formatNumber(amount, { decimals });
  return symbol ? `${formatted} ${symbol}` : formatted;
}

// Address formatting
export function formatAddress(
  address: string,
  options: {
    start?: number;
    end?: number;
    separator?: string;
  } = {}
): string {
  const { start = 6, end = 4, separator = '...' } = options;
  
  if (address.length <= start + end) {
    return address;
  }
  
  return `${address.slice(0, start)}${separator}${address.slice(-end)}`;
}

// Transaction hash formatting
export function formatTransactionHash(hash: string): string {
  return formatAddress(hash, { start: 8, end: 8 });
}

// Date formatting
export function formatDate(
  date: Date | string | number,
  formatString: string = 'MMM dd, yyyy HH:mm'
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (!isValid(dateObj)) {
    return 'Invalid date';
  }
  
  return format(dateObj, formatString);
}

// Relative time formatting
export function formatRelativeTime(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (!isValid(dateObj)) {
    return 'Invalid date';
  }
  
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

// Percentage formatting
export function formatPercentage(
  value: number,
  decimals: number = 2
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value / 100);
}

// File size formatting
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  
  return `${size.toFixed(2)} ${sizes[i]}`;
}

// Duration formatting
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

// Status formatting
export function formatTransactionStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'Pending',
    'processing': 'Processing',
    'completed': 'Completed',
    'failed': 'Failed',
    'cancelled': 'Cancelled'
  };
  
  return statusMap[status] || status;
}

// Network name formatting
export function formatNetworkName(network: string): string {
  const networkMap: Record<string, string> = {
    'solana': 'Solana',
    'lunes': 'Lunes',
    'ethereum': 'Ethereum',
    'polygon': 'Polygon'
  };
  
  return networkMap[network] || network;
}