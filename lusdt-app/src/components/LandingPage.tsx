import { useState } from 'react'
import { ArrowRight, Shield, Zap, Coins, Globe, Terminal, Activity, Lock, Cpu, ChevronRight, CheckCircle } from 'lucide-react'
import { cn } from '../utils/cn'

interface LandingPageProps {
  onGetStarted: () => void
  onShowTransparency?: () => void
  onShowAdmin?: () => void
  onShowOps?: () => void
}

export function LandingPage({ onGetStarted, onShowTransparency, onShowAdmin, onShowOps }: LandingPageProps) {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  const features = [
    {
      icon: <Shield className="w-5 h-5 text-green-500" />,
      title: "SECURE_PROTOCOL",
      description: "Audited smart contracts with reentrancy guards and emergency circuit breakers.",
      code: "0x1...F3A [VERIFIED]"
    },
    {
      icon: <Zap className="w-5 h-5 text-green-500" />,
      title: "INSTANT_FINALITY",
      description: "Cross-chain bridging with optimistic verification and automated liquidity rebalancing.",
      code: "LATENCY: <2s"
    },
    {
      icon: <Coins className="w-5 h-5 text-green-500" />,
      title: "DYNAMIC_FEES",
      description: "Volume-based fee adaptation algorithm with slippage protection.",
      code: "AUTO_ADJUST: ON"
    },
    {
      icon: <Globe className="w-5 h-5 text-green-500" />,
      title: "INTEROPERABILITY",
      description: "Native Solana-Lunes integration via trustless messaging protocol.",
      code: "NET: ACTIVE"
    }
  ]

  const stats = [
    { label: "TOTAL_VOLUME", value: "$2,542,000.00", icon: <TrendingUpIcon /> },
    { label: "TX_COUNT", value: "12,405", icon: <ActivityIcon /> },
    { label: "TOTAL_USERS", value: "842", icon: <UsersIcon /> },
    { label: "SYS_STATUS", value: "OPERATIONAL", icon: <CheckIcon className="text-green-500" /> }
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-mono selection:bg-green-900 selection:text-green-50">
      {/* Grid Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-500/10 border border-green-500/20 flex items-center justify-center rounded-sm">
              <Terminal className="w-4 h-4 text-green-500" />
            </div>
            <span className="text-lg font-bold tracking-tighter text-zinc-100">
              LUSDT<span className="text-green-500">_BRIDGE</span>
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-1 text-xs text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span>MAINNET_LIVE</span>
            </div>
            <button
              onClick={onGetStarted}
              className="bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-2 text-sm font-bold rounded-sm transition-colors flex items-center gap-2 group"
            >
              <span>CONNECT_WALLET</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative container mx-auto px-4 pt-20 pb-16">
        {/* Hero */}
        <div className="max-w-5xl mx-auto mb-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center space-x-2 border border-green-500/20 bg-green-500/5 px-3 py-1 text-xs text-green-500 mb-6 font-mono rounded-sm">
                <Cpu className="w-3 h-3" />
                <span>PROTOCOL_V1.0.2 INITIALIZED</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold text-zinc-100 tracking-tight leading-none mb-6">
                TRUSTLESS <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600">
                  LIQUIDITY
                </span> <br />
                LAYER
              </h1>
              <p className="text-lg text-zinc-400 mb-8 max-w-lg leading-relaxed border-l-2 border-zinc-800 pl-6">
                Securely transfer USDT between Solana and Lunes networks.
                Zero-knowledge proof validation with institutional-grade security architecture.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onGetStarted}
                  className="bg-green-600 hover:bg-green-500 text-zinc-950 px-8 py-4 text-sm font-bold rounded-sm transition-all flex items-center justify-center gap-2 group shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]"
                >
                  <span>INITIATE_BRIDGE</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  onClick={onShowTransparency}
                  className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-8 py-4 text-sm font-bold rounded-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Activity className="w-4 h-4" />
                  <span>VIEW_METRICS</span>
                </button>
              </div>
            </div>

            {/* Hero Visual - Terminal/Data Style */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-emerald-600 rounded-sm blur opacity-20"></div>
              <div className="relative bg-zinc-900 border border-zinc-800 rounded-sm p-6 font-mono text-xs overflow-hidden">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                  </div>
                  <div className="text-zinc-500">bash-3.2$ ./bridge_daemon</div>
                </div>
                <div className="space-y-2 font-mono">
                  <div className="text-green-500">$ connecting to solana_mainnet...</div>
                  <div className="text-zinc-400">[OK] Connection established (45ms)</div>
                  <div className="text-green-500">$ connecting to lunes_node...</div>
                  <div className="text-zinc-400">[OK] Connection established (32ms)</div>
                  <div className="text-zinc-500 border-l-2 border-zinc-700 pl-3 py-1 my-2">
                    Syncing liquidity pools...<br />
                    {'>'} Pool A: $1.2M USDT [SYNCED]<br />
                    {'>'} Pool B: $1.2M LUSDT [SYNCED]
                  </div>
                  <div className="text-zinc-300">Ready for transactions. <span className="animate-pulse">_</span></div>
                </div>
              </div>

              {/* Floating Stats */}
              <div className="absolute -bottom-6 -right-6 bg-zinc-950 border border-zinc-800 p-4 rounded-sm shadow-xl hidden md:block">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="text-xs font-bold text-zinc-300">SYSTEM HEALTH: 100%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800 border-y border-zinc-800 mb-32">
          {stats.map((stat, i) => (
            <div key={i} className="bg-zinc-950 p-6 flex items-center justify-between group hover:bg-zinc-900 transition-colors">
              <div>
                <div className="text-zinc-500 text-xs font-mono mb-1">{stat.label}</div>
                <div className="text-xl md:text-2xl font-bold text-zinc-100">{stat.value}</div>
              </div>
              <div className="text-zinc-700 group-hover:text-green-500 transition-colors opacity-50">
                {stat.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Features - Technical Grid */}
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-12 border-b border-zinc-800 pb-6">
            <div>
              <h2 className="text-3xl font-bold text-zinc-100 mb-2">SYSTEM ARCHITECTURE</h2>
              <p className="text-zinc-400 max-w-lg">Technical specifications and security protocols currently active on the network.</p>
            </div>
            <div className="hidden md:block font-mono text-xs text-zinc-500 text-right">
              LAST_AUDIT: 2024-03-15<br />
              STATUS: PASSED
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative bg-zinc-900/50 border border-zinc-800 p-6 rounded-sm hover:border-green-500/50 transition-colors"
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-green-500/10 rounded-sm">
                    {feature.icon}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-sm">
                    {index + 1 < 10 ? `0${index + 1}` : index + 1}
                  </div>
                </div>
                <h3 className="text-sm font-bold text-zinc-100 mb-2 font-mono">{feature.title}</h3>
                <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                  {feature.description}
                </p>
                <div className="font-mono text-[10px] text-green-500 border-t border-zinc-800 pt-3">
                  {feature.code}
                </div>

                {/* Corner Accents */}
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-green-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-green-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-800 bg-zinc-950 py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center space-x-2 mb-6 opacity-50 hover:opacity-100 transition-opacity">
            <Terminal className="w-5 h-5 text-zinc-400" />
            <span className="font-bold text-zinc-400">LUSDT CORE</span>
          </div>
          <p className="text-zinc-600 text-sm max-w-md mx-auto mb-8">
            Decentralized cross-chain bridge infrastructure. <br />
            Built for automated, high-frequency liquidity movement.
          </p>
          <div className="text-xs text-zinc-700 font-mono">
            SYSTEM_ID: LUSDT-BRIDGE-V1 • 2024 © ALL RIGHTS RESERVED
          </div>
        </div>
      </footer>
    </div>
  )
}

function TrendingUpIcon(props: any) {
  return <Activity className="w-6 h-6" {...props} />
}
function ActivityIcon(props: any) {
  return <Terminal className="w-6 h-6" {...props} />
}
function UsersIcon(props: any) {
  return <Cpu className="w-6 h-6" {...props} />
}
function CheckIcon(props: any) {
  return <CheckCircle className="w-6 h-6" {...props} />
}
