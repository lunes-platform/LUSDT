import { useState, useEffect } from 'react'
import { WalletProvider } from './components/WalletProvider'
import { Header } from './components/Header'
import { BridgeInterface } from './components/BridgeInterface'
import { BalanceCard } from './components/BalanceCard'
import { VolumeInfo } from './components/VolumeInfo'
import { AdminPanel } from './components/AdminPanel'
import { OpsPanel } from './components/OpsPanel'
import { StakingPanel } from './components/StakingPanel'
import { Footer } from './components/Footer'
import { LandingPage } from './components/LandingPage'
import { TransparencyPage } from './components/TransparencyPage'
import { Zap, Shield, Coins, Terminal, Activity } from 'lucide-react'

import { ToastProvider } from './components/ui/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  // ... (state and effect hooks remain the same) ...
  const [showLandingPage, setShowLandingPage] = useState(true)
  const [currentPage, setCurrentPage] = useState<'bridge' | 'transparency' | 'admin' | 'ops' | 'staking'>('bridge')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('view')

    if (view === 'admin') {
      setShowLandingPage(false)
      setCurrentPage('admin')
    } else if (view === 'ops') {
      setShowLandingPage(false)
      setCurrentPage('ops')
    } else if (view === 'transparency') {
      setShowLandingPage(false)
      setCurrentPage('transparency')
    } else if (view === 'staking') {
      setShowLandingPage(false)
      setCurrentPage('staking')
    }
  }, [])

  const handleGetStarted = () => {
    setShowLandingPage(false)
    setCurrentPage('bridge')
  }

  const handleShowTransparency = () => {
    setShowLandingPage(false)
    setCurrentPage('transparency')
  }

  const handleShowAdmin = () => {
    setShowLandingPage(false)
    setCurrentPage('admin')
  }

  const handleShowOps = () => {
    setShowLandingPage(false)
    setCurrentPage('ops')
  }

  if (showLandingPage) {
    return (
      <LandingPage
        onGetStarted={handleGetStarted}
        onShowTransparency={handleShowTransparency}
        onShowAdmin={handleShowAdmin}
        onShowOps={handleShowOps}
      />
    )
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <WalletProvider>
          <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-green-500/30">
            <Header onNavigate={setCurrentPage} currentPage={currentPage} />

            {currentPage === 'bridge' && (
              <main className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto space-y-8">
                  {/* Header Section */}
                  <div className="border border-zinc-800 bg-zinc-900/50 p-8 rounded-sm text-center relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500/0 via-green-500/50 to-green-500/0 opacity-50"></div>

                    <h1 className="text-3xl md:text-4xl font-bold font-mono tracking-tighter mb-4 flex items-center justify-center gap-3">
                      <div className="w-10 h-10 bg-zinc-800 border border-zinc-700 flex items-center justify-center rounded-sm">
                        <Terminal className="w-6 h-6 text-green-500" />
                      </div>
                      LUSDT_BRIDGE_PROTOCOL
                    </h1>

                    <p className="text-zinc-500 font-mono text-sm max-w-xl mx-auto">
                      SECURE CROSS-CHAIN ASSET TRANSFER SYSTEM. <br />
                      <span className="text-green-500/60">OPERATIONAL STATUS: NORMAL</span>
                    </p>

                    <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs font-mono">
                      <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-sm text-zinc-400">
                        <Zap className="w-3 h-3 text-yellow-500" />
                        <span>LATENCY: LOW</span>
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-sm text-zinc-400">
                        <Shield className="w-3 h-3 text-green-500" />
                        <span>SECURITY: MAX</span>
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-sm text-zinc-400">
                        <Coins className="w-3 h-3 text-blue-500" />
                        <span>FEES: OPTIMIZED</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <BalanceCard />
                    <VolumeInfo />
                  </div>

                  <BridgeInterface />
                </div>
              </main>
            )}

            {currentPage === 'admin' && (
              <main className="container mx-auto px-4 py-8">
                <div className="max-w-6xl mx-auto space-y-6">
                  <div className="border border-zinc-800 bg-zinc-900/50 p-6 rounded-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-900/10 border border-red-900/30 text-red-500 rounded-sm">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold font-mono text-zinc-100">ADMIN_COMMAND_CENTER</h1>
                        <p className="text-zinc-500 text-xs font-mono">AUTHORIZED PERSONNEL ONLY // SYSTEM CONFIGURATION</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="px-3 py-1 bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-500 rounded-sm flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        SYSTEM_ACTIVE
                      </div>
                    </div>
                  </div>
                  <AdminPanel />
                </div>
              </main>
            )}

            {currentPage === 'ops' && (
              <main className="container mx-auto px-4 py-8">
                <div className="max-w-6xl mx-auto">
                  <div className="mb-6 border-b border-zinc-800 pb-4">
                    <h1 className="text-2xl font-bold font-mono text-zinc-100 flex items-center gap-2">
                      <Activity className="w-6 h-6 text-blue-500" />
                      OPERATIONS_PANEL
                    </h1>
                  </div>
                  <OpsPanel />
                </div>
              </main>
            )}

            {currentPage === 'staking' && (
              <main className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                  <StakingPanel />
                </div>
              </main>
            )}

            {currentPage === 'transparency' && <TransparencyPage onNavigate={setCurrentPage} />}

            {currentPage === 'bridge' && <Footer />}
          </div>
        </WalletProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App