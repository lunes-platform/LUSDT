import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VolumeInfo } from '../VolumeInfo'

// Mock the hook
vi.mock('../../hooks/useLunesContract', () => ({
  useLunesContract: () => ({
    getMonthlyVolume: vi.fn().mockResolvedValue('50000000000') // $50K with 6 decimals
  })
}))

describe('VolumeInfo', () => {
  it('should render volume information', async () => {
    render(<VolumeInfo />)
    
    await waitFor(() => {
      expect(screen.getByText('Volume Mensal')).toBeInTheDocument()
      expect(screen.getByText('Afeta as taxas')).toBeInTheDocument()
    })
  })

  it('should display volume amount', async () => {
    render(<VolumeInfo />)
    
    await waitFor(() => {
      expect(screen.getByText('Volume Total:')).toBeInTheDocument()
      expect(screen.getByText('$50.000')).toBeInTheDocument()
    })
  })

  it('should show correct tier for medium volume', async () => {
    render(<VolumeInfo />)
    
    await waitFor(() => {
      expect(screen.getByText('Tier Atual:')).toBeInTheDocument()
      expect(screen.getByText('Médio')).toBeInTheDocument()
      expect(screen.getByText('(0.5%)')).toBeInTheDocument()
    })
  })

  it('should display progress bar', async () => {
    render(<VolumeInfo />)
    
    await waitFor(() => {
      expect(screen.getByText('$0')).toBeInTheDocument()
      expect(screen.getByText('$10K')).toBeInTheDocument()
      expect(screen.getByText('$100K+')).toBeInTheDocument()
    })
  })

  it('should show next tier information', async () => {
    render(<VolumeInfo />)
    
    await waitFor(() => {
      expect(screen.getByText(/Próximo tier em/)).toBeInTheDocument()
      expect(screen.getByText(/\$100K/)).toBeInTheDocument()
      expect(screen.getByText(/(taxa 0.3%)/)).toBeInTheDocument()
    })
  })

  it('should show loading state initially', () => {
    render(<VolumeInfo />)
    
    // Should show loading animation initially
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})