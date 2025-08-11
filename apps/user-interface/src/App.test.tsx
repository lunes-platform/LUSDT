import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from './pages/Dashboard';

// Mock the router for testing
const MockRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('App Structure', () => {
  it('renders Dashboard component', () => {
    render(
      <MockRouter>
        <Dashboard />
      </MockRouter>
    );
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Overview of your LUSDT bridge activity')).toBeInTheDocument();
  });

  it('displays balance cards', () => {
    render(
      <MockRouter>
        <Dashboard />
      </MockRouter>
    );
    
    expect(screen.getByText('USDT Balance')).toBeInTheDocument();
    expect(screen.getByText('LUSDT Balance')).toBeInTheDocument();
    expect(screen.getByText('Total Transactions')).toBeInTheDocument();
  });

  it('shows quick action buttons', () => {
    render(
      <MockRouter>
        <Dashboard />
      </MockRouter>
    );
    
    expect(screen.getByText('Deposit USDT → LUSDT')).toBeInTheDocument();
    expect(screen.getByText('Redeem LUSDT → USDT')).toBeInTheDocument();
  });
});