// Re-export shared types
export * from '@lusdt/shared-utils';
export * from '@lusdt/blockchain-services';

// Application-specific types
export interface AppConfig {
  solana: {
    rpcUrl: string;
    network: 'mainnet-beta' | 'devnet' | 'testnet';
    usdtMintAddress: string;
  };
  lunes: {
    rpcUrl: string;
    lusdtContractAddress: string;
    taxManagerContractAddress: string;
  };
  bridge: {
    apiUrl: string;
    wsUrl: string;
  };
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
  };
  features: {
    analytics: boolean;
    debug: boolean;
    testnet: boolean;
  };
}

export interface RouteConfig {
  path: string;
  title: string;
  component: React.ComponentType;
  requiresWallet?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  hideFromNav?: boolean;
}

export interface NavigationItem {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  current?: boolean;
  children?: NavigationItem[];
}

export interface BreadcrumbItem {
  name: string;
  href?: string;
  current?: boolean;
}