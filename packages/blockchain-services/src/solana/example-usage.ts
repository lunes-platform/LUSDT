/**
 * Example usage of the enhanced Solana wallet service with adapter integration
 * This file demonstrates how to use the wallet adapters in a real application
 */

import { SolanaWalletService } from './wallet-service';
import { WalletDetectionService } from './wallet-adapters';

// Example configuration
const config = {
  rpcEndpoint: 'https://api.devnet.solana.com',
  commitment: 'confirmed' as const
};

/**
 * Example: Basic wallet connection flow
 */
export async function basicWalletConnection() {
  const walletService = new SolanaWalletService(config);
  
  try {
    // Initialize the service
    await walletService.initialize();
    
    // Check available wallets
    const availableWallets = await walletService.getAvailableWallets();
    console.log('Available wallets:', availableWallets);
    
    // Check if any wallets are installed
    if (!await walletService.hasAvailableWallets()) {
      console.log('No wallets installed. Please install Phantom or Solflare.');
      return;
    }
    
    // Connect to the best available wallet
    const wallet = await walletService.connectBestAvailable();
    console.log('Connected to wallet:', wallet.name, wallet.address);
    
    // Get SOL balance
    const balance = await walletService.getSolBalance();
    console.log('SOL balance:', balance);
    
    // Disconnect when done
    await walletService.disconnect();
    
  } catch (error) {
    console.error('Wallet connection error:', error);
  } finally {
    await walletService.cleanup();
  }
}

/**
 * Example: Specific wallet connection with error handling
 */
export async function specificWalletConnection() {
  const walletService = new SolanaWalletService(config);
  
  try {
    await walletService.initialize();
    
    // Check if Phantom is installed
    if (await walletService.isWalletInstalled('phantom')) {
      try {
        const wallet = await walletService.connect('phantom');
        console.log('Connected to Phantom:', wallet.address);
      } catch (error) {
        // Handle connection error with recovery suggestions
        const recovery = await walletService.recoverFromError(error as any, 'phantom');
        console.log('Connection failed:', recovery.userMessage);
        
        if (recovery.canRecover && recovery.recoveryAction === 'retry') {
          console.log('You can try connecting again');
        }
      }
    } else {
      // Show installation instructions
      const instructions = walletService.getInstallationInstructions('phantom');
      console.log('Phantom not installed. Instructions:', instructions);
    }
    
  } catch (error) {
    console.error('Service error:', error);
  } finally {
    await walletService.cleanup();
  }
}

/**
 * Example: Wallet detection without connecting
 */
export async function walletDetection() {
  try {
    // Detect wallets without initializing a full service
    const wallets = await WalletDetectionService.detectWallets();
    
    console.log('Detected wallets:');
    wallets.forEach(wallet => {
      console.log(`- ${wallet.name}: ${wallet.installed ? 'Installed' : 'Not installed'}`);
      
      if (!wallet.installed) {
        const instructions = WalletDetectionService.getInstallationInstructions(wallet.type);
        console.log(`  Install from: ${instructions.url}`);
      }
    });
    
    // Get the best available wallet
    const bestWallet = WalletDetectionService.getBestAvailableWallet();
    if (bestWallet) {
      console.log('Best available wallet:', bestWallet.name);
    } else {
      console.log('No wallets available');
    }
    
  } catch (error) {
    console.error('Detection error:', error);
  }
}

/**
 * Example: React component usage (pseudo-code)
 */
export function ExampleReactComponent() {
  // This would be used in a React component like this:
  /*
  import { useSolanaWallet } from '@lusdt/blockchain-services';
  
  function WalletConnector() {
    const {
      wallet,
      connected,
      connecting,
      availableWallets,
      connect,
      disconnect,
      error,
      clearError
    } = useSolanaWallet({
      config: {
        rpcEndpoint: 'https://api.devnet.solana.com',
        commitment: 'confirmed'
      },
      autoConnect: true,
      preferredWallet: 'phantom'
    });
    
    if (connecting) {
      return <div>Connecting to wallet...</div>;
    }
    
    if (error) {
      return (
        <div>
          <p>Error: {error.message}</p>
          <button onClick={clearError}>Clear Error</button>
        </div>
      );
    }
    
    if (connected && wallet) {
      return (
        <div>
          <p>Connected to {wallet.name}</p>
          <p>Address: {wallet.address}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      );
    }
    
    return (
      <div>
        <h3>Available Wallets:</h3>
        {availableWallets.map(wallet => (
          <button
            key={wallet.type}
            onClick={() => connect(wallet.type)}
            disabled={!wallet.installed}
          >
            {wallet.name} {!wallet.installed && '(Not Installed)'}
          </button>
        ))}
      </div>
    );
  }
  */
  
  return 'See source code for React component example';
}

/**
 * Example: Event handling
 */
export function setupWalletEventHandling() {
  if (typeof window === 'undefined') {
    return;
  }
  
  // Listen for wallet state changes
  window.addEventListener('solanaWallet:walletConnect', (event: any) => {
    console.log('Wallet connected:', event.detail);
  });
  
  window.addEventListener('solanaWallet:walletDisconnect', (event: any) => {
    console.log('Wallet disconnected:', event.detail);
  });
  
  window.addEventListener('solanaWallet:balanceChange', (event: any) => {
    console.log('Balance changed:', event.detail.balance);
  });
  
  window.addEventListener('solanaWallet:walletError', (event: any) => {
    console.error('Wallet error:', event.detail);
  });
}

// Export examples for testing
export const examples = {
  basicWalletConnection,
  specificWalletConnection,
  walletDetection,
  setupWalletEventHandling
};