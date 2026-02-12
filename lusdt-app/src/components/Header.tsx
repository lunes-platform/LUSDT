import { useState, useEffect } from 'react'
import { useWallet } from './WalletProvider'
import { useLunesContract } from '../hooks/useLunesContract'
import { Wallet, LogOut, Menu, X, Eye, Shield, Activity, ArrowRightLeft, Terminal, Coins } from 'lucide-react'
import { cn } from '../utils/cn'

interface HeaderProps {
  onNavigate?: (page: 'bridge' | 'transparency' | 'admin' | 'ops' | 'staking') => void
  currentPage?: 'bridge' | 'transparency' | 'admin' | 'ops' | 'staking'
}

export function Header({ onNavigate, currentPage = 'bridge' }: HeaderProps) {
  const { solanaWallet, lunesWallet, connectSolana, connectLunes, disconnect, isConnecting } = useWallet()
  const { isOwner } = useLunesContract()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    const checkAdmin = async () => {
      if (lunesWallet?.address) {
        try {
          const owner = await isOwner()
          if (mounted) setIsAdmin(owner)
        } catch (e) {
          console.error('Failed to check owner', e)
          if (mounted) setIsAdmin(false)
        }
      } else {
        if (mounted) setIsAdmin(false)
      }
    }
    checkAdmin()
    return () => {
      mounted = false
    }
  }, [lunesWallet?.address, isOwner])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const NavButton = ({ page, icon: Icon, label, mobile = false }: { page: 'bridge' | 'transparency' | 'admin' | 'ops' | 'staking', icon: any, label: string, mobile?: boolean }) => {
    const isActive = currentPage === page
    return (
      <button
        onClick={() => {
          if (onNavigate) onNavigate(page)
          if (mobile) setIsMobileMenuOpen(false)
        }}
        className={cn(
          "flex items-center space-x-2 px-3 py-2 rounded-sm transition-all duration-200 text-sm font-mono border",
          isActive
            ? "bg-zinc-800 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
            : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 hover:border-zinc-800",
          mobile && "w-full justify-between"
        )}
      >
        <div className="flex items-center gap-2">
          <Icon size={14} />
          <span className={cn(!mobile && "hidden lg:block")}>{label}</span>
          <span className={cn(!mobile && "lg:hidden")}>{label}</span>
        </div>
        {isActive && mobile && <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
      </button>
    )
  }

  return (
    <header className="bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        {/* Mobile Header */}
        <div className="flex justify-between items-center py-3 md:py-4">
          <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => onNavigate && onNavigate('bridge')}>
            <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 rounded-sm flex items-center justify-center group-hover:border-green-500/50 transition-colors">
              <Terminal className="text-green-500 w-4 h-4" />
            </div>
            <span className="text-lg md:text-xl font-bold font-mono text-zinc-100 tracking-tight">
              LUSDT<span className="text-zinc-600">_BRIDGE</span>
            </span>
          </div>

          {/* Desktop Wallet Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Solana Wallet */}
            <div className="flex items-center space-x-2">
              {solanaWallet ? (
                <div className="flex items-center space-x-2 bg-zinc-900 px-3 py-2 rounded-sm border border-zinc-800 hover:border-green-500/30 transition-colors group">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-mono text-zinc-300 hidden lg:block">
                    SOL: {formatAddress(solanaWallet.address)}
                  </span>
                  <span className="text-xs font-mono text-zinc-300 lg:hidden">
                    SOL
                  </span>
                  <button
                    onClick={() => disconnect('solana')}
                    className="text-zinc-500 hover:text-red-500 ml-2 transition-colors"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectSolana}
                  disabled={isConnecting}
                  className="flex items-center space-x-2 bg-zinc-900 text-zinc-400 border border-zinc-700 px-3 py-2 rounded-sm hover:text-green-400 hover:border-green-500 transition-all font-mono text-xs uppercase"
                >
                  <Wallet size={14} />
                  <span className="hidden lg:block">{isConnecting ? 'CONNECTING...' : 'CONNECT SOL'}</span>
                  <span className="lg:hidden">SOL</span>
                </button>
              )}
            </div>

            {/* Lunes Wallet */}
            <div className="flex items-center space-x-2">
              {lunesWallet ? (
                <div className="flex items-center space-x-2 bg-zinc-900 px-3 py-2 rounded-sm border border-zinc-800 hover:border-green-500/30 transition-colors">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-mono text-zinc-300 hidden lg:block">
                    LUNES: {formatAddress(lunesWallet.address)}
                  </span>
                  <span className="text-xs font-mono text-zinc-300 lg:hidden">
                    LUNES
                  </span>
                  <button
                    onClick={() => disconnect('lunes')}
                    className="text-zinc-500 hover:text-red-500 ml-2 transition-colors"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectLunes}
                  disabled={isConnecting}
                  className="flex items-center space-x-2 bg-zinc-900 text-zinc-400 border border-zinc-700 px-3 py-2 rounded-sm hover:text-green-400 hover:border-green-500 transition-all font-mono text-xs uppercase"
                >
                  <Wallet size={14} />
                  <span className="hidden lg:block">{isConnecting ? 'CONNECTING...' : 'CONNECT LUNES'}</span>
                  <span className="lg:hidden">LUNES</span>
                </button>
              )}
            </div>

            <div className="h-6 w-px bg-zinc-800 mx-2"></div>

            {/* Navigation Buttons */}
            {onNavigate && <NavButton page="bridge" icon={ArrowRightLeft} label="BRIDGE" />}
            {onNavigate && <NavButton page="staking" icon={Coins} label="STAKING" />}
            {onNavigate && <NavButton page="transparency" icon={Eye} label="TRANSPARENCY" />}
            {onNavigate && <NavButton page="ops" icon={Activity} label="OPS" />}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-sm border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-green-500 transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800 py-4 space-y-4 bg-zinc-950/95 backdrop-blur-xl absolute left-0 right-0 px-4 shadow-2xl border-b">

            {/* Mobile Wallets */}
            <div className="grid grid-cols-2 gap-3">
              {/* SOL */}
              {solanaWallet ? (
                <div className="flex flex-col bg-zinc-900 border border-zinc-800 p-3 rounded-sm">
                  <span className="text-xs font-mono text-zinc-500 mb-2">SOLANA</span>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-zinc-300 font-mono">{formatAddress(solanaWallet.address)}</span>
                    </div>
                    <button onClick={() => disconnect('solana')}><LogOut size={12} className="text-red-500" /></button>
                  </div>
                </div>
              ) : (
                <button onClick={connectSolana} className="flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 p-3 rounded-sm hover:border-green-500/50 hover:text-green-500 transition-colors text-zinc-400 gap-2">
                  <Wallet size={16} />
                  <span className="text-xs font-mono">CONNECT SOL</span>
                </button>
              )}

              {/* LUNES */}
              {lunesWallet ? (
                <div className="flex flex-col bg-zinc-900 border border-zinc-800 p-3 rounded-sm">
                  <span className="text-xs font-mono text-zinc-500 mb-2">LUNES</span>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-zinc-300 font-mono">{formatAddress(lunesWallet.address)}</span>
                    </div>
                    <button onClick={() => disconnect('lunes')}><LogOut size={12} className="text-red-500" /></button>
                  </div>
                </div>
              ) : (
                <button onClick={connectLunes} className="flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 p-3 rounded-sm hover:border-green-500/50 hover:text-green-500 transition-colors text-zinc-400 gap-2">
                  <Wallet size={16} />
                  <span className="text-xs font-mono">CONNECT LUNES</span>
                </button>
              )}
            </div>

            <div className="border-t border-zinc-800 pt-2 space-y-2">
              {onNavigate && <NavButton page="bridge" icon={ArrowRightLeft} label="BRIDGE PROTOCOL" mobile />}
              {onNavigate && <NavButton page="staking" icon={Coins} label="STAKING REWARDS" mobile />}
              {onNavigate && <NavButton page="transparency" icon={Eye} label="TRANSPARENCY LOGS" mobile />}
              {onNavigate && <NavButton page="ops" icon={Activity} label="OPERATIONS" mobile />}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}