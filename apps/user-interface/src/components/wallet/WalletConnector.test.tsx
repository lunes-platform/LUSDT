import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WalletConnector from './WalletConnector';
import { useWalletStore } from '../../store/walletStore';

// Mock the wallet store
vi.mock('../../store/walletStore', () => ({
  useWalletStore: vi.fn(),
  getSolanaWallets: vi.fn(() => [
    {
      name: 'Phantom',
      icon: '/phantom-icon.png',
      url: 'https://phantom.app',
      installed: true,
      readyState: 'Installed'
    },
    {
      name: 'Solflare',
      icon: '/solflare-icon.png',
      url: 'https://solflare.com',
      installed: false,
      readyState: 'NotDetected'
    }
  ]),
  isLunesWalletAvailable: vi.fn(() => true)
}));

const mockWalletStore = {
  solana: null,
  lunes: null,
  isConnecting: false,
  error: null,
  connectSolanaWallet: vi.fn(),
  connectLunesWallet: vi.fn(),
  clearError: vi.fn()
};

describe('WalletConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useWalletStore as any).mockReturnValue(mockWalletStore);
  });

  it('renders wallet connector with tabs', () => {
    render(<WalletConnector />);
    
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.getByText('Solana Wallets')).toBeInTheDocument();
    expect(screen.getByText('Lunes Wallet')).toBeInTheDocument();
  });

  it('shows Solana wallets by default', () => {
    render(<WalletConnector />);
    
    expect(screen.getByText('Phantom')).toBeInTheDocument();
    expect(screen.getByText('Solflare')).toBeInTheDocument();
    expect(screen.getByText('Detected')).toBeInTheDocument();
    expect(screen.getByText('Not installed')).toBeInTheDocument();
  });

  it('switches to Lunes tab when clicked', () => {
    render(<WalletConnector />);
    
    fireEvent.click(screen.getByText('Lunes Wallet'));
    
    expect(screen.getByText('Polkadot.js Extension')).toBeInTheDocument();
  });

  it('calls connectSolanaWallet when Phantom is clicked', async () => {
    render(<WalletConnector />);
    
    fireEvent.click(screen.getByText('Phantom'));
    
    await waitFor(() => {
      expect(mockWalletStore.connectSolanaWallet).toHaveBeenCalledWith('Phantom');
    });
  });

  it('calls connectLunesWallet when Polkadot extension is clicked', async () => {
    render(<WalletConnector />);
    
    fireEvent.click(screen.getByText('Lunes Wallet'));
    fireEvent.click(screen.getByText('Polkadot.js Extension'));
    
    await waitFor(() => {
      expect(mockWalletStore.connectLunesWallet).toHaveBeenCalled();
    });
  });

  it('displays error message when error exists', () => {
    (useWalletStore as any).mockReturnValue({
      ...mockWalletStore,
      error: 'Connection failed'
    });

    render(<WalletConnector />);
    
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('shows loading state when connecting', () => {
    (useWalletStore as any).mockReturnValue({
      ...mockWalletStore,
      isConnecting: true
    });

    render(<WalletConnector />);
    
    // Should show loading spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<WalletConnector onClose={onClose} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });
});