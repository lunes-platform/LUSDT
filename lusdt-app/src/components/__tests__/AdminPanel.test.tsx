import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminPanel } from '../AdminPanel'

// Mock the hooks
vi.mock('../../hooks/useLunesContract', () => ({
  useLunesContract: () => ({
    isOwner: vi.fn().mockResolvedValue(true),
    isPaused: vi.fn().mockResolvedValue(false),
    emergencyPause: vi.fn().mockResolvedValue('mock-hash'),
    emergencyUnpause: vi.fn().mockResolvedValue('mock-hash'),
    getLunesPrice: vi.fn().mockResolvedValue('500000') // $0.50 with 6 decimals
  })
}))

vi.mock('../WalletProvider', () => ({
  useWallet: () => ({
    lunesWallet: {
      address: 'mock-lunes-address-1234567890',
      network: 'lunes',
      connected: true
    }
  })
}))

describe('AdminPanel', () => {
  it('should render admin panel for owner', async () => {
    render(<AdminPanel />)
    
    await waitFor(() => {
      expect(screen.getByText('Painel Administrativo')).toBeInTheDocument()
      expect(screen.getByText('OWNER')).toBeInTheDocument()
    })
  })

  it('should display contract status', async () => {
    render(<AdminPanel />)
    
    await waitFor(() => {
      expect(screen.getByText('Status do Contrato')).toBeInTheDocument()
      expect(screen.getByText('Ativo')).toBeInTheDocument()
    })
  })

  it('should display LUNES price', async () => {
    render(<AdminPanel />)
    
    await waitFor(() => {
      expect(screen.getByText('Preço LUNES:')).toBeInTheDocument()
      expect(screen.getByText('$0.50')).toBeInTheDocument()
    })
  })

  it('should display wallet address', async () => {
    render(<AdminPanel />)
    
    await waitFor(() => {
      expect(screen.getByText('Sua Carteira:')).toBeInTheDocument()
      expect(screen.getByText(/mock-l...7890/)).toBeInTheDocument()
    })
  })

  it('should handle pause button click', async () => {
    render(<AdminPanel />)
    
    await waitFor(() => {
      const pauseButton = screen.getByText(/Pausar Contrato/)
      expect(pauseButton).toBeInTheDocument()
    })

    const pauseButton = screen.getByText(/Pausar Contrato/)
    fireEvent.click(pauseButton)

    await waitFor(() => {
      expect(screen.getByText('Processando...')).toBeInTheDocument()
    })
  })

  it('should display security warning', async () => {
    render(<AdminPanel />)
    
    await waitFor(() => {
      expect(screen.getByText(/Você tem privilégios administrativos/)).toBeInTheDocument()
      expect(screen.getByText(/pausar o contrato afetará todos os usuários/)).toBeInTheDocument()
    })
  })

  it('should show loading state initially', () => {
    render(<AdminPanel />)
    
    // Should show loading animation initially
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})