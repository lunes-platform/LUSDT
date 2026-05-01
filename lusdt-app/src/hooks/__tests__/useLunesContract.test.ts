import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLunesContract } from '../useLunesContract'

// Mock @polkadot/api — previne conexões WebSocket reais em testes
// ApiPromise.create retorna uma Promise pendente para manter o hook em estado
// isConnecting: true sem nunca resolver, testando comportamento de "não inicializado"
vi.mock('@polkadot/api', () => {
  const WsProvider = vi.fn().mockImplementation(function () {
    return { on: vi.fn(), disconnect: vi.fn(), isConnected: false }
  })
  return {
    ApiPromise: { create: vi.fn().mockReturnValue(new Promise(() => {})) },
    WsProvider,
  }
})

vi.mock('@polkadot/api-contract', () => ({
  ContractPromise: vi.fn().mockImplementation(function () {
    return { query: {}, tx: {} }
  }),
}))

vi.mock('@polkadot/extension-dapp', () => ({
  web3Enable: vi.fn().mockResolvedValue([]),
  web3Accounts: vi.fn().mockResolvedValue([]),
  web3FromSource: vi.fn().mockResolvedValue({ signer: {} }),
}))

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

})