import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Layout from './Layout';
import { useWalletStore } from '../../store/walletStore';

// Mock the wallet store
vi.mock('../../store/walletStore', () => ({
  useWalletStore: vi.fn()
}));

// Mock the transaction store
vi.mock('../../store/transactionStore', () => ({
  useTransactionStore: vi.fn(() => ({
    getTransactionSummary: () => ({
      totalTransactions: 0,
      totalVolume: 0,
      successfulTransactions: 0,
      pendingTransactions: 0,
      failedTransactions: 0,
      averageAmount: 0,
      totalFees: 0
    })
  }))
}));

const mockWalletStore = {
  solana: null,
  lunes: null,
  isConnecting: false,
  error: null,
  refreshBalances: vi.fn()
};

const MockRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useWalletStore as any).mockReturnValue(mockWalletStore);
    
    // Mock window.innerWidth for responsive tests
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  it('renders layout with header, sidebar, and footer', () => {
    render(
      <MockRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MockRouter>
    );

    expect(screen.getByText('LUSDT Bridge')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByText('© 2024 LUSDT Bridge. All rights reserved.')).toBeInTheDocument();
  });

  it('shows mobile menu button on mobile screens', () => {
    // Mock mobile screen width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });

    render(
      <MockRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MockRouter>
    );

    const menuButton = screen.getByRole('button', { name: /open main menu/i });
    expect(menuButton).toBeInTheDocument();
  });

  it('opens and closes mobile sidebar', () => {
    render(
      <MockRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MockRouter>
    );

    const menuButton = screen.getByRole('button', { name: /open main menu/i });
    
    // Open sidebar
    fireEvent.click(menuButton);
    expect(screen.getByText('Menu')).toBeInTheDocument();
    
    // Close sidebar
    const closeButton = screen.getByRole('button', { name: /close sidebar/i });
    fireEvent.click(closeButton);
  });

  it('displays navigation items', () => {
    render(
      <MockRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MockRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Bridge')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows network status indicators', () => {
    render(
      <MockRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MockRouter>
    );

    expect(screen.getByText('Solana')).toBeInTheDocument();
    expect(screen.getByText('Lunes')).toBeInTheDocument();
    expect(screen.getByText('Bridge Online')).toBeInTheDocument();
  });

  it('displays wallet connection button when no wallets connected', () => {
    render(
      <MockRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MockRouter>
    );

    expect(screen.getByText('Connect Wallets')).toBeInTheDocument();
  });

  it('shows wallet display when wallets are connected', () => {
    (useWalletStore as any).mockReturnValue({
      ...mockWalletStore,
      solana: {
        connected: true,
        publicKey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        wallet: { name: 'Phantom' },
        balance: 100
      }
    });

    render(
      <MockRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MockRouter>
    );

    expect(screen.getByText('Solana Connected')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    render(
      <MockRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MockRouter>
    );

    // Should show home breadcrumb
    const homeLink = screen.getByTitle('Go to Dashboard');
    expect(homeLink).toBeInTheDocument();
  });

  it('applies responsive classes correctly', () => {
    const { container } = render(
      <MockRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MockRouter>
    );

    const mainElement = container.querySelector('main');
    expect(mainElement).toHaveClass('lg:ml-64', 'pb-16', 'lg:pb-0');
  });
});