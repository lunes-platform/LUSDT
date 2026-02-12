import { useState, useEffect } from 'react'
import { useWallet } from './WalletProvider'
import { useLunesContract } from '../hooks/useLunesContract'
import { useSolanaContract } from '../hooks/useSolanaContract'
import { RefreshCw, Wallet, Coins } from 'lucide-react'

interface Balances {
  sol: string
  usdt: string
  lunes: string
  lusdt: string
}

export function BalanceCard() {
  const { solanaWallet, lunesWallet } = useWallet()
  const { getLunesBalance, getLusdtBalance } = useLunesContract()
  const { getUsdtBalance, getSolBalance } = useSolanaContract()

  const [balances, setBalances] = useState<Balances>({
    sol: '0',
    usdt: '0',
    lunes: '0',
    lusdt: '0'
  })
  const [loading, setLoading] = useState(false)

  const refetch = async () => {
    if (!solanaWallet && !lunesWallet) return

    setLoading(true)
    try {
      const newBalances: Balances = {
        sol: '0',
        usdt: '0',
        lunes: '0',
        lusdt: '0'
      }

      // Buscar saldos Solana
      if (solanaWallet) {
        const [solBalance, usdtBalance] = await Promise.all([
          getSolBalance(),
          getUsdtBalance()
        ])
        newBalances.sol = solBalance
        newBalances.usdt = usdtBalance
      }

      // Buscar saldos Lunes (dados reais da blockchain)
      if (lunesWallet) {
        const [lusdtBalance, lunesBalance] = await Promise.all([
          getLusdtBalance(),
          getLunesBalance()
        ])
        newBalances.lusdt = lusdtBalance
        newBalances.lunes = lunesBalance
      }

      setBalances(newBalances)
    } catch (error) {
      console.error('Erro ao buscar saldos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [solanaWallet, lunesWallet])

  if (!solanaWallet && !lunesWallet) {
    return null
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-sm relative group overflow-hidden">
      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
        <Wallet size={64} />
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-2 sm:space-y-0 relative z-10">
        <h3 className="text-sm font-bold font-mono text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
          <span className="text-green-500">bw_balance</span>
          <span>// ASSET_HOLDINGS</span>
        </h3>
        <button
          onClick={refetch}
          disabled={loading}
          className="self-start sm:self-auto p-1.5 hover:bg-zinc-800 rounded-sm transition-all duration-200 text-zinc-400 hover:text-green-500 border border-transparent hover:border-zinc-700"
          title="SYNC_BALANCES"
        >
          <RefreshCw size={14} className={`transition-transform ${loading ? 'animate-spin' : 'hover:rotate-180'}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
        {/* Solana Balances */}
        {solanaWallet ? (
          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-sm relative group/card">
            <div className="absolute top-0 left-0 w-0.5 h-full bg-zinc-800 group-hover/card:bg-green-500 transition-colors"></div>
            <h4 className="text-xs font-mono text-zinc-500 mb-3 flex items-center gap-2 uppercase">
              <span>SOLANA_NET</span>
              <div className="h-px flex-1 bg-zinc-800"></div>
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-zinc-900/50 p-2 rounded-sm border border-zinc-800/50">
                <span className="text-xs text-zinc-400 font-mono">SOL</span>
                <span className="text-sm font-bold font-mono text-zinc-100">{balances.sol}</span>
              </div>
              <div className="flex justify-between items-center bg-zinc-900/50 p-2 rounded-sm border border-zinc-800/50">
                <span className="text-xs text-zinc-400 font-mono">USDT</span>
                <span className="text-sm font-bold font-mono text-zinc-100">{balances.usdt}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-950/30 border border-zinc-800 border-dashed p-4 rounded-sm flex items-center justify-center text-zinc-600 font-mono text-xs">
            NO_CONNECTION_SOL
          </div>
        )}

        {/* Lunes Balances */}
        {lunesWallet ? (
          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-sm relative group/card">
            <div className="absolute top-0 left-0 w-0.5 h-full bg-zinc-800 group-hover/card:bg-green-500 transition-colors"></div>
            <h4 className="text-xs font-mono text-zinc-500 mb-3 flex items-center gap-2 uppercase">
              <span>LUNES_NET</span>
              <div className="h-px flex-1 bg-zinc-800"></div>
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-zinc-900/50 p-2 rounded-sm border border-zinc-800/50">
                <span className="text-xs text-zinc-400 font-mono">LUNES</span>
                <span className="text-sm font-bold font-mono text-zinc-100">{balances.lunes}</span>
              </div>
              <div className="flex justify-between items-center bg-zinc-900/50 p-2 rounded-sm border border-zinc-800/50">
                <span className="text-xs text-zinc-400 font-mono">LUSDT</span>
                <span className="text-sm font-bold font-mono text-zinc-100">{balances.lusdt}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-950/30 border border-zinc-800 border-dashed p-4 rounded-sm flex items-center justify-center text-zinc-600 font-mono text-xs">
            NO_CONNECTION_LUNES
          </div>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 bg-zinc-950/80 flex items-center justify-center z-20 backdrop-blur-sm">
          <div className="flex items-center space-x-2 text-xs text-green-500 font-mono border border-green-500/30 bg-green-500/10 px-4 py-2 rounded-sm">
            <RefreshCw className="animate-spin w-3 h-3" />
            <span>SYNCING_DATA...</span>
          </div>
        </div>
      )}
    </div>
  )
}