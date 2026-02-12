import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

// Tipos simples
interface Wallet {
  address: string
  network: 'solana' | 'lunes'
  connected: boolean
  source?: string // Para compatibilidade com Polkadot.js
}

interface WalletContextType {
  solanaWallet: Wallet | null
  lunesWallet: Wallet | null
  connectSolana: () => Promise<void>
  connectLunes: () => Promise<void>
  disconnect: (network: 'solana' | 'lunes') => void
  isConnecting: boolean
}

const WalletContext = createContext<WalletContextType | null>(null)

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet deve ser usado dentro de WalletProvider')
  }
  return context
}

/**
 * Obtém o provider da Solana.
 * Prioridade: Solflare -> Phantom (Modern) -> Legacy (window.solana)
 */
function getSolanaProvider(): any | null {
  if (typeof window === 'undefined') return null

  // Prioridade 1: Solflare (Conforme solicitado)
  const solflare = (window as any).solflare
  if (solflare?.isSolflare) return solflare

  // Prioridade 2: Phantom (API moderna)
  const phantom = (window as any).phantom?.solana
  if (phantom?.isPhantom) return phantom

  // Prioridade 3: Fallback para API legada (pode ser Phantom ou outra)
  const legacy = (window as any).solana
  if (legacy?.isPhantom) return legacy

  return null
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [solanaWallet, setSolanaWallet] = useState<Wallet | null>(null)
  const [lunesWallet, setLunesWallet] = useState<Wallet | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  // Conectar Solana (Solflare > Phantom)
  const connectSolana = useCallback(async () => {
    setIsConnecting(true)
    try {
      const provider = getSolanaProvider()

      if (!provider) {
        // Se nenhum provider, sugere Solflare por ser a preferência
        window.open('https://solflare.com/', '_blank')
        return
      }

      // Timeout de 15 segundos para evitar "CONNECTING..." infinito
      const response = await Promise.race([
        provider.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 15000)
        )
      ]) as { publicKey: { toString(): string } }

      // Solflare retorna void no connect(), mas popula o publicKey no provider
      // Phantom retorna objeto com publicKey
      const publicKey = response?.publicKey || provider.publicKey

      if (publicKey) {
        const walletName = provider.isSolflare ? 'Solflare' : 'Phantom'
        setSolanaWallet({
          address: publicKey.toString(),
          network: 'solana',
          connected: true
        })
        console.log(`✅ Solana wallet connected (${walletName}):`, publicKey.toString())
      }
    } catch (error: any) {
      // Usuário rejeitou a conexão — não mostrar alerta
      if (error?.code === 4001 || error?.message?.includes('User rejected')) {
        console.log('ℹ️ User rejected Solana connection')
      } else if (error?.message === 'Connection timeout') {
        console.error('⏱️ Solana connection timed out')
      } else {
        console.error('❌ Erro ao conectar Solana:', error)
      }
    } finally {
      setIsConnecting(false)
    }
  }, [])

  // Conectar Lunes (Polkadot.js / Lunes Wallet)
  const connectLunes = useCallback(async () => {
    setIsConnecting(true)
    try {
      const { web3Accounts, web3Enable } = await import('@polkadot/extension-dapp')

      const extensions = await web3Enable('LUSDT Bridge')
      if (extensions.length === 0) {
        alert('Por favor, instale a extensão Polkadot.js ou Lunes Wallet')
        return
      }

      const accounts = await web3Accounts()
      if (accounts.length > 0) {
        // Prefere contas da Lunes Wallet, senão pega a primeira
        const lunesAccount = accounts.find(a => a.meta.source === 'lunes-wallet') || accounts[0]
        setLunesWallet({
          address: lunesAccount.address,
          network: 'lunes',
          connected: true,
          source: lunesAccount.meta.source
        })
        console.log('✅ Lunes wallet connected:', lunesAccount.address, `(${lunesAccount.meta.source})`)
      }
    } catch (error) {
      console.error('❌ Erro ao conectar Lunes:', error)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  // Desconectar
  const disconnect = useCallback((network: 'solana' | 'lunes') => {
    if (network === 'solana') {
      setSolanaWallet(null)
      try {
        const provider = getSolanaProvider()
        provider?.disconnect()
      } catch (e) { /* silently ignore */ }
    } else {
      setLunesWallet(null)
    }
  }, [])

  // Auto-reconectar ao carregar (eager connect)
  useEffect(() => {
    const provider = getSolanaProvider()
    if (!provider) return

    // Tenta reconexão silenciosa (onlyIfTrusted = true)
    // Só funciona se o usuário já autorizou antes
    provider.connect({ onlyIfTrusted: true })
      .then((resp: { publicKey: { toString(): string } } | void) => {
        // Solflare pode retornar void
        const publicKey = (resp as any)?.publicKey || provider.publicKey

        if (publicKey) {
          const walletName = provider.isSolflare ? 'Solflare' : 'Phantom'
          setSolanaWallet({
            address: publicKey.toString(),
            network: 'solana',
            connected: true
          })
          console.log(`✅ Solana auto-reconnected (${walletName}):`, publicKey.toString())
        }
      })
      .catch(() => {
        // Silencioso — usuário não autorizou previamente
      })
  }, [])

  return (
    <WalletContext.Provider value={{
      solanaWallet,
      lunesWallet,
      connectSolana,
      connectLunes,
      disconnect,
      isConnecting
    }}>
      {children}
    </WalletContext.Provider>
  )
}