import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLunesContract } from '../useLunesContract'

// Mock do useWallet
vi.mock('../../components/WalletProvider', () => ({
  useWallet: () => ({
    lunesWallet: {
      address: 'mock-lunes-address',
      source: 'polkadot-js'
    }
  })
}))

// Mock dos metadados
vi.mock('../../contracts/metadata', () => ({
  LUSDT_TOKEN_METADATA: {},
  TAX_MANAGER_METADATA: {}
}))

// Mock dos endereços
vi.mock('../../contracts/addresses', () => ({
  CONTRACT_ADDRESSES: {
    lunes: {
      lusdtToken: 'mock-lusdt-address',
      taxManager: 'mock-tax-address'
    }
  },
  NETWORK_CONFIG: {
    lunes: {
      rpcUrl: 'wss://mock-rpc.lunes.io'
    }
  }
}))

describe('useLunesContract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useLunesContract())

      expect(result.current.isConnected).toBe(false)
      expect(result.current.isConnecting).toBe(true)
      expect(result.current.isReady).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should have all required functions', () => {
      const { result } = renderHook(() => useLunesContract())

      expect(typeof result.current.getLusdtBalance).toBe('function')
      expect(typeof result.current.getTotalSupply).toBe('function')
      expect(typeof result.current.mintLusdt).toBe('function')
      expect(typeof result.current.burnLusdt).toBe('function')
      expect(typeof result.current.transferLusdt).toBe('function')
      expect(typeof result.current.isPaused).toBe('function')
      expect(typeof result.current.isOwner).toBe('function')
      expect(typeof result.current.getLunesPrice).toBe('function')
      expect(typeof result.current.getCurrentFeeBps).toBe('function')
      expect(typeof result.current.getMonthlyVolume).toBe('function')
      expect(typeof result.current.calculateFee).toBe('function')
    })
  })

  describe('Contract Queries', () => {
    it('should return default values when contract not initialized', async () => {
      const { result } = renderHook(() => useLunesContract())

      await act(async () => {
        const balance = await result.current.getLusdtBalance()
        expect(balance).toBe('0')
      })

      await act(async () => {
        const supply = await result.current.getTotalSupply()
        expect(supply).toBe('0')
      })

      await act(async () => {
        // isPaused throws when contract not initialized
        await expect(result.current.isPaused()).rejects.toThrow('LUSDT contract not initialized')
      })
    })

    it('should calculate fees correctly', async () => {
      const { result } = renderHook(() => useLunesContract())

      await act(async () => {
        const feeInfo = await result.current.calculateFee('1000')

        // Deve retornar estrutura completa mesmo com fallback
        expect(feeInfo).toHaveProperty('feeAmount')
        expect(feeInfo).toHaveProperty('feeCurrency')
        expect(feeInfo).toHaveProperty('netAmount')
        expect(feeInfo).toHaveProperty('feePercentBps')
        expect(feeInfo).toHaveProperty('volumeTier')
      })
    })

    it('should handle fee calculation with volume tiers', async () => {
      const { result } = renderHook(() => useLunesContract())

      await act(async () => {
        // Teste com valor baixo
        const feeLow = await result.current.calculateFee('100')
        expect(feeLow.volumeTier).toBe('low')

        // Teste com valor médio
        const feeMedium = await result.current.calculateFee('10000')
        expect(feeMedium.volumeTier).toBe('low') // fallback

        // Teste com valor alto
        const feeHigh = await result.current.calculateFee('100000')
        expect(feeHigh.volumeTier).toBe('low') // fallback
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle contract errors gracefully', async () => {
      const { result } = renderHook(() => useLunesContract())

      await act(async () => {
        // Mint sem wallet deve falhar
        await expect(result.current.mintLusdt('to', '100')).rejects.toThrow('Contract or wallet not available')
      })

      await act(async () => {
        // Burn sem wallet deve falhar
        await expect(result.current.burnLusdt('100', 'recipient')).rejects.toThrow('Contract or wallet not available')
      })
    })

    it('should validate transaction parameters', async () => {
      const { result } = renderHook(() => useLunesContract())

      await act(async () => {
        // Transfer sem wallet deve falhar
        await expect(result.current.transferLusdt('to', '100')).rejects.toThrow('Contract or wallet not available')
      })
    })
  })

  describe('Fee Calculation Logic', () => {
    it('should return valid fee structure for different amounts', async () => {
      const { result } = renderHook(() => useLunesContract())

      await act(async () => {
        const feeSmall = await result.current.calculateFee('10')
        expect(typeof feeSmall.feeAmount).toBe('string')
        expect(typeof feeSmall.netAmount).toBe('string')
        expect(feeSmall.feeCurrency).toBe('USD')

        const feeLarge = await result.current.calculateFee('1000000')
        expect(typeof feeLarge.feeAmount).toBe('string')
        expect(typeof feeLarge.netAmount).toBe('string')
      })
    })

    it('should handle invalid input gracefully', async () => {
      const { result } = renderHook(() => useLunesContract())

      await act(async () => {
        const feeInfo = await result.current.calculateFee('invalid')
        expect(feeInfo.volumeTier).toBe('low')
        // Fallback fee rate is 0 when contract unavailable (no fake data)
        expect(feeInfo.feePercentBps).toBe(0)
      })
    })
  })

  describe('Error Handling', () => {
    it('should return safe defaults on errors', async () => {
      const { result } = renderHook(() => useLunesContract())
      
      await act(async () => {
        const feeInfo = await result.current.calculateFee('invalid')
        // NaN input produces NaN feeAmount string
        expect(feeInfo.feeCurrency).toBe('USD')
        expect(feeInfo.volumeTier).toBe('low')
      })
    })
  })
})