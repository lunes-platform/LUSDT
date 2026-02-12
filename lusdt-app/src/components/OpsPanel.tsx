import { useEffect, useMemo, useState } from 'react'
import { Activity, Database, RefreshCw, Wallet, Terminal, Info } from 'lucide-react'
import { cn } from '../utils/cn'

type OpsOverviewResponse = {
  health: any
  stats: any
  solana?: any
  wallets: {
    solana: {
      address: string
      usdtBalance: number
      solBalance: number
    }
    lunes: {
      address: string
      lunesBalance: number
    }
  }
}

type OpsTransactionsResponse = {
  transactions: Array<{
    id: string
    sourceChain: string
    destinationChain: string
    sourceSignature: string
    destinationSignature?: string
    amount: number
    sourceAddress: string
    destinationAddress: string
    status: string
    createdAt: string
    completedAt?: string
  }>
  total: number
}

function formatNumber(value: number, decimals: number = 4) {
  if (Number.isNaN(value)) return '0'
  return value.toFixed(decimals)
}

function formatAddress(addr: string, head: number = 8, tail: number = 6) {
  if (!addr) return ''
  if (addr.length <= head + tail) return addr
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`
}

export function OpsPanel() {
  const baseUrl = useMemo(() => {
    const envUrl = import.meta.env.VITE_BRIDGE_API_URL
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) return envUrl

    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      const protocol = window.location.protocol
      const origin = window.location.origin
      const isLocalHost = host === 'localhost' || host === '127.0.0.1'

      if (!isLocalHost) {
        if (protocol === 'https:') return `${origin}/api`
        return `http://${host}:3100`
      }
    }

    return envUrl || 'http://localhost:3000'
  }, [])

  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')

  const [overview, setOverview] = useState<OpsOverviewResponse | null>(null)
  const [transactions, setTransactions] = useState<OpsTransactionsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    if (!user || !pass) return null
    const token = btoa(`${user}:${pass}`)
    return `Basic ${token}`
  }, [user, pass])

  const fetchJson = async <T,>(path: string): Promise<T> => {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: authHeader
        ? {
          Authorization: authHeader,
        }
        : undefined,
    })

    if (!res.ok) {
      let payload: any = null
      try {
        payload = await res.json()
      } catch {
        // ignore
      }

      const baseMessage = payload?.error || payload?.message || `HTTP ${res.status}`
      const startupErrors = Array.isArray(payload?.startupErrors) ? payload.startupErrors : null
      const details = startupErrors && startupErrors.length > 0 ? ` | ${startupErrors.join(' | ')}` : ''

      throw new Error(`${baseMessage}${details}`)
    }

    return res.json()
  }

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const [o, t] = await Promise.all([
        fetchJson<OpsOverviewResponse>('/ops/overview'),
        fetchJson<OpsTransactionsResponse>('/ops/transactions/recent?limit=50'),
      ])
      setOverview(o)
      setTransactions(t)
    } catch (e) {
      setOverview(null)
      setTransactions(null)
      setError(e instanceof Error ? e.message : 'Falha ao carregar Ops')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authHeader) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader])

  return (
    <div className="space-y-6">
      <div className="bg-zinc-950 border border-zinc-800 rounded-sm p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Terminal size={64} />
        </div>
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Terminal size={18} className="text-green-500" />
              <h2 className="text-lg font-bold font-mono text-zinc-100 uppercase tracking-tighter">Ops Terminal</h2>
            </div>
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-wide">
              SYSTEM_DIAGNOSTICS & TELEMETRY // AUTHREQ
            </p>
          </div>
          <button
            onClick={reload}
            disabled={!authHeader || loading}
            className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-2 rounded-sm hover:text-green-500 hover:border-green-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono uppercase"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
            REFRESH_DATA
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10">
          <div>
            <label className="text-[10px] font-mono font-bold text-zinc-500 uppercase mb-1 block">USER_ID</label>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 placeholder-zinc-700"
              placeholder="OPS_BASIC_AUTH_USER"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold text-zinc-500 uppercase mb-1 block">ACCESS_KEY</label>
            <input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              type="password"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 placeholder-zinc-700"
              placeholder="OPS_BASIC_AUTH_PASS"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold text-zinc-500 uppercase mb-1 block">API_ENDPOINT</label>
            <input
              value={baseUrl}
              disabled
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-sm px-3 py-2 text-xs font-mono text-zinc-500 cursor-not-allowed"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 text-xs font-mono bg-red-950/20 border border-red-900/50 text-red-500 rounded-sm px-3 py-2 flex items-center gap-2">
            <Info size={14} />
            ERROR: {error}
          </div>
        )}
      </div>

      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-sm p-5 hover:border-green-500/30 transition-colors">
            <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-2">
              <Activity size={16} className="text-green-500" />
              <h3 className="font-bold font-mono text-zinc-300 text-xs uppercase tracking-wider">System Health</h3>
            </div>
            <div className="text-xs font-mono text-zinc-400 space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-600">OVERALL_STATUS</span>
                <span className="text-zinc-200">{overview.health?.overall || 'UNKNOWN'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">SOLANA_NODE</span>
                <span className={overview.health?.solana?.connected ? 'text-green-500' : 'text-red-500'}>
                  {overview.health?.solana?.connected ? '[ONLINE]' : '[OFFLINE]'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">LUNES_NODE</span>
                <span className={overview.health?.lunes?.connected ? 'text-green-500' : 'text-red-500'}>
                  {overview.health?.lunes?.connected ? '[ONLINE]' : '[OFFLINE]'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">DB_CONNECTION</span>
                <span className={overview.health?.database?.connected ? 'text-green-500' : 'text-red-500'}>
                  {overview.health?.database?.connected ? '[ONLINE]' : '[OFFLINE]'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-sm p-5 hover:border-blue-500/30 transition-colors">
            <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-2">
              <Wallet size={16} className="text-blue-500" />
              <h3 className="font-bold font-mono text-zinc-300 text-xs uppercase tracking-wider">Operational Wallets</h3>
            </div>
            <div className="text-xs font-mono text-zinc-400 space-y-4">
              <div>
                <div className="text-blue-500 font-bold mb-1">[SOLANA_VAULT]</div>
                <div className="text-zinc-600 mb-1 tracking-tight">{formatAddress(overview.wallets.solana.address)}</div>
                <div className="flex justify-between"><span className="text-zinc-600">SOL</span> <span className="text-zinc-200">{formatNumber(overview.wallets.solana.solBalance, 4)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-600">USDT</span> <span className="text-zinc-200">{formatNumber(overview.wallets.solana.usdtBalance, 2)}</span></div>
              </div>
              <div className="border-t border-zinc-900 pt-2">
                <div className="text-purple-500 font-bold mb-1">[LUNES_VAULT]</div>
                <div className="text-zinc-600 mb-1 tracking-tight">{formatAddress(overview.wallets.lunes.address)}</div>
                <div className="flex justify-between"><span className="text-zinc-600">LUNES</span> <span className="text-zinc-200">{formatNumber(overview.wallets.lunes.lunesBalance, 4)}</span></div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-sm p-5 hover:border-purple-500/30 transition-colors">
            <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-2">
              <Database size={16} className="text-purple-500" />
              <h3 className="font-bold font-mono text-zinc-300 text-xs uppercase tracking-wider">Transaction DB</h3>
            </div>
            <div className="text-xs font-mono text-zinc-400 space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-600">TOTAL_RECORDS</span>
                <span className="text-zinc-200">{overview.stats?.totalTransactions ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">PENDING</span>
                <span className="text-yellow-500">{overview.stats?.pendingTransactions ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">COMPLETED</span>
                <span className="text-green-500">{overview.stats?.completedTransactions ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">FAILED</span>
                <span className="text-red-500">{overview.stats?.failedTransactions ?? '-'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {transactions && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
            <h3 className="font-bold font-mono text-zinc-300 text-xs uppercase tracking-wider">Recent Transactions</h3>
            <p className="text-[10px] font-mono text-zinc-600 uppercase">LIMIT: 50 RECORDS</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs font-mono">
              <thead className="bg-zinc-900 text-zinc-500 border-b border-zinc-800">
                <tr>
                  <th className="text-left px-4 py-3 font-medium uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 font-medium uppercase tracking-wider">PATH</th>
                  <th className="text-left px-4 py-3 font-medium uppercase tracking-wider">STATUS</th>
                  <th className="text-right px-4 py-3 font-medium uppercase tracking-wider">AMOUNT</th>
                  <th className="text-left px-4 py-3 font-medium uppercase tracking-wider">TIMESTAMP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {transactions.transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3 text-zinc-400 font-medium">{formatAddress(tx.id, 10, 6)}</td>
                    <td className="px-4 py-3 text-zinc-500">{tx.sourceChain} → {tx.destinationChain}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-sm text-[10px] uppercase font-bold",
                        tx.status === 'completed' ? "bg-green-500/10 text-green-500" :
                          tx.status === 'pending' ? "bg-yellow-500/10 text-yellow-500" :
                            "bg-red-500/10 text-red-500"
                      )}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">{formatNumber(tx.amount, 2)}</td>
                    <td className="px-4 py-3 text-zinc-600">{new Date(tx.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
