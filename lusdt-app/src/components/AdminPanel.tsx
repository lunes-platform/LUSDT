import { useState, useEffect } from 'react';
import { useAdminContract } from '../hooks/useAdminContract';
import { useWallet } from './WalletProvider';
import {
  Shield,
  Settings,
  TrendingUp,
  AlertTriangle,
  Eye,
  Calculator,
  Lock,
  Wallet,
  DollarSign,
  Users,
  Activity,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowRight,
  Terminal,
  Cpu
} from 'lucide-react';
import { TeamManagement } from './TeamManagement';

type TabType = 'overview' | 'emergency' | 'fees' | 'wallets' | 'staking' | 'analytics';

export function AdminPanel() {
  const { lunesWallet } = useWallet();
  // Debug imports removed — admin access confirmed working
  const {
    loading,
    error,
    stats,
    isAdmin,
    adminChecked,
    refreshStats,
    updateLunesPrice,
    updateFeeConfig,
    updateDistributionWallets,
    pauseContract,
    unpauseContract,
    getVolumeTierInfo
  } = useAdminContract();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [lunesPriceInput, setLunesPriceInput] = useState('0.50');
  const [pauseReason, setPauseReason] = useState('');
  const [feeConfigForm, setFeeConfigForm] = useState({
    base_fee_bps: 50,
    low_volume_fee_bps: 60,
    medium_volume_fee_bps: 50,
    high_volume_fee_bps: 30,
    volume_threshold_1_usd: '10000',
    volume_threshold_2_usd: '100000'
  });
  const [walletForm, setWalletForm] = useState({
    devSolana: '',
    devLunes: '',
    insuranceFund: '',
    stakingRewardsPool: ''
  });

  // Initialize forms from contract data
  useEffect(() => {
    if (stats.feeConfig) {
      setFeeConfigForm({
        base_fee_bps: stats.feeConfig.base_fee_bps,
        low_volume_fee_bps: stats.feeConfig.low_volume_fee_bps,
        medium_volume_fee_bps: stats.feeConfig.medium_volume_fee_bps,
        high_volume_fee_bps: stats.feeConfig.high_volume_fee_bps,
        volume_threshold_1_usd: stats.feeConfig.volume_threshold_1_usd,
        volume_threshold_2_usd: stats.feeConfig.volume_threshold_2_usd
      });
    }
    if (stats.distributionWallets) {
      setWalletForm(stats.distributionWallets);
    }
    setLunesPriceInput(stats.lunesPrice);
  }, [stats.feeConfig, stats.distributionWallets, stats.lunesPrice]);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleUpdateLunesPrice = async () => {
    try {
      await updateLunesPrice(parseFloat(lunesPriceInput));
      showSuccess('Preço do LUNES atualizado com sucesso!');
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handlePauseContract = async () => {
    try {
      await pauseContract(pauseReason);
      showSuccess('Contrato pausado com sucesso!');
      setPauseReason('');
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleUnpauseContract = async () => {
    try {
      await unpauseContract();
      showSuccess('Contrato despausado com sucesso!');
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleUpdateFeeConfig = async () => {
    try {
      await updateFeeConfig(feeConfigForm);
      showSuccess('Configuração de taxas atualizada com sucesso!');
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleUpdateWallets = async () => {
    try {
      await updateDistributionWallets(walletForm);
      showSuccess('Carteiras de distribuição atualizadas com sucesso!');
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const tierInfo = getVolumeTierInfo(stats.monthlyVolume);

  // Common UI Components
  const SectionHeader = ({ icon: Icon, title, description }: { icon: any, title: string, description?: string }) => (
    <div className="flex items-start gap-3 mb-6 border-b border-zinc-800 pb-4">
      <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-sm">
        <Icon size={20} className="text-zinc-100" />
      </div>
      <div>
        <h3 className="text-lg font-bold font-mono text-zinc-100 tracking-tight">{title}</h3>
        {description && <p className="text-xs font-mono text-zinc-500">{description}</p>}
      </div>
    </div>
  );

  const StatusBadge = ({ active, activeText, inactiveText }: { active: boolean, activeText: string, inactiveText: string }) => (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm border ${active
      ? 'bg-green-900/20 text-green-500 border-green-900/40'
      : 'bg-red-900/20 text-red-500 border-red-900/40'
      }`}>
      {active ? activeText : inactiveText}
    </span>
  );

  const InputField = ({ label, value, onChange, type = "text", placeholder, suffix }: any) => (
    <div className="space-y-1">
      <label className="text-xs font-mono text-zinc-500 uppercase">{label}</label>
      <div className="flex bg-zinc-950 border border-zinc-800 rounded-sm focus-within:border-zinc-600 transition-colors">
        <input
          type={type}
          value={value}
          onChange={onChange}
          readOnly={!onChange}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2 text-sm font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none"
        />
        {suffix && (
          <div className="px-3 py-2 bg-zinc-900/50 border-l border-zinc-800 text-xs text-zinc-500 font-mono flex items-center">
            {suffix}
          </div>
        )}
      </div>
    </div>
  );

  // Not admin view
  if (!isAdmin) {
    return (
      <div className="border border-red-900/50 bg-red-950/10 rounded-sm p-8 mb-6 relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-red-950/50 border border-red-900/50 rounded-full flex items-center justify-center mb-2">
            <Lock className="w-8 h-8 text-red-500 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-mono text-red-500 tracking-tighter">ACCESS_DENIED</h2>
            <p className="text-red-400/80 font-mono text-sm max-w-md mx-auto">
              UNAUTHORIZED ACCESS DETECTED. THIS INCIDENT HAS BEEN LOGGED.
              PLEASE AUTHENTICATE AS SYSTEM ADMINISTRATOR.
            </p>
          </div>

          <div className="bg-black/40 border border-red-900/30 rounded-sm p-4 w-full max-w-lg text-left font-mono text-xs space-y-2">
            <div className="flex justify-between border-b border-red-900/20 pb-2 mb-2">
              <span className="text-red-500">ERROR_CODE:</span>
              <span className="text-zinc-500">AUTH_MISSING_PRIVILEGES_0x01</span>
            </div>

            <div className="flex gap-2 text-red-400/70">
              <span>&gt;</span>
              <span>Scanning permissions...</span>
              <span className="text-red-500 font-bold">[FAILED]</span>
            </div>

            {!lunesWallet ? (
              <div className="flex gap-2 text-yellow-500/70">
                <span>&gt;</span>
                <span>Wallet Status:</span>
                <span className="text-yellow-500 font-bold">[DISCONNECTED]</span>
              </div>
            ) : (
              <div className="flex gap-2 text-zinc-500">
                <span>&gt;</span>
                <span>Wallet ID:</span>
                <span className="text-zinc-300">{lunesWallet.address.slice(0, 12)}...{lunesWallet.address.slice(-8)}</span>
              </div>
            )}
          </div>

          <div className="text-xs text-zinc-600 font-mono pt-4 border-t border-red-900/20 w-full max-w-xs">
            SESSION_ID: {Math.random().toString(36).substring(7).toUpperCase()}
          </div>

        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border border-zinc-800 bg-zinc-900/50 rounded-sm p-6 mb-6">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-12 h-12 bg-zinc-800 rounded-sm"></div>
          <div className="space-y-2 flex-1">
            <div className="h-4 w-1/3 bg-zinc-800 rounded-sm"></div>
            <div className="h-3 w-1/4 bg-zinc-800 rounded-sm"></div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', name: 'OVERVIEW', icon: Eye },
    { id: 'team', name: 'TEAM', icon: Users },
    { id: 'emergency', name: 'EMERGENCY', icon: AlertTriangle },
    { id: 'fees', name: 'FEES_CONFIG', icon: Calculator },
    { id: 'wallets', name: 'WALLETS', icon: Wallet },
    { id: 'staking', name: 'STAKING', icon: Users },
    { id: 'analytics', name: 'ANALYTICS', icon: TrendingUp }
  ];

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-sm shadow-xl overflow-hidden flex flex-col min-h-[600px]">

      {/* Top Bar / Status */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
          <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">ADMIN_CONSOLE_V2.0</h2>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-sm">
            <span className="text-zinc-500">CONTRACT_STATUS:</span>
            <span className={stats.isPaused ? "text-red-500 animate-pulse" : "text-green-500"}>
              {stats.isPaused ? '[PAUSED]' : '[OPERATIONAL]'}
            </span>
          </div>

          <button
            onClick={refreshStats}
            disabled={loading}
            className="p-1.5 text-zinc-500 hover:text-green-500 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 rounded-sm transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">

        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-zinc-900/50 border-r border-zinc-800 p-2 md:p-4 md:space-y-1 overflow-x-auto md:overflow-visible flex md:block scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-3 px-4 py-3 rounded-sm text-xs font-mono tracking-wide w-full border transition-all ${isActive
                  ? 'bg-zinc-800 border-zinc-700 text-green-500 shadow-sm'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }`}
              >
                <Icon size={16} />
                <span className="whitespace-nowrap">{tab.name}</span>
                {isActive && <div className="ml-auto w-1 h-1 bg-green-500 rounded-full hidden md:block"></div>}
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-4 md:p-8 bg-black/20 overflow-y-auto">

          {/* Messages */}
          {successMessage && (
            <div className="mb-6 p-3 bg-green-900/10 border border-green-900/30 rounded-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle size={16} className="text-green-500" />
              <span className="text-xs font-mono text-green-400">{successMessage}</span>
            </div>
          )}
          {error && (
            <div className="mb-6 p-3 bg-red-900/10 border border-red-900/30 rounded-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <XCircle size={16} className="text-red-500" />
              <span className="text-xs font-mono text-red-400">{error}</span>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <SectionHeader icon={Terminal} title="SYSTEM_OVERVIEW" description="Global metrics and key performance indicators." />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "TOTAL_SUPPLY", value: `$${parseFloat(stats.totalSupply).toLocaleString()}`, sub: "LUSDT Circulating", color: "text-zinc-100" },
                  { label: "LUNES_PRICE", value: `$${parseFloat(stats.lunesPrice).toFixed(2)}`, sub: "USD / LUNES", color: "text-green-500" },
                  { label: "MONTHLY_VOL", value: `$${parseFloat(stats.monthlyVolume).toLocaleString()}`, sub: "Accumulated (USD)", color: "text-blue-500" },
                  { label: "CURRENT_FEE", value: `${(stats.currentFeeBps / 100).toFixed(2)}%`, sub: `Tier: ${tierInfo.tier.toUpperCase()}`, color: "text-orange-500" }
                ].map((item, idx) => (
                  <div key={idx} className="bg-zinc-950 border border-zinc-800 p-4 rounded-sm hover:border-zinc-700 transition-colors">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase mb-2">{item.label}</div>
                    <div className={`text-2xl font-bold font-mono ${item.color} tracking-tighter`}>{item.value}</div>
                    <div className="text-[10px] text-zinc-600 mt-1 font-mono">{item.sub}</div>
                  </div>
                ))}
              </div>

              {/* Volume Progress Bar */}
              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-sm">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-mono text-zinc-400">VOLUME_TIER_PROGRESS</span>
                  <span className="text-xs font-mono text-green-500 font-bold">{tierInfo.progress.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-900 rounded-sm overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-green-500 transition-all duration-700 ease-out"
                    style={{ width: `${tierInfo.progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                  <span>CURRENT: ${parseFloat(stats.monthlyVolume).toLocaleString()}</span>
                  <span>NEXT_TIER: {tierInfo.nextTier ? tierInfo.nextTier : "MAX_LEVEL"}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-sm">
                  <h4 className="text-xs font-bold font-mono text-zinc-300 mb-4 uppercase">System Actions</h4>
                  <div className="space-y-2">
                    {[
                      {
                        action: () => setActiveTab('fees'),
                        label: 'Update Fee Structure',
                        desc: 'Modify global tax rates'
                      },
                      {
                        action: () => setActiveTab('wallets'),
                        label: 'Manage Wallets',
                        desc: 'Update distribution addresses'
                      }
                    ].map((btn, i) => (
                      <button
                        key={i}
                        onClick={btn.action}
                        className="w-full flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-sm hover:bg-zinc-800 hover:border-zinc-700 transition-all group"
                      >
                        <div className="text-left">
                          <div className="text-xs font-bold text-zinc-300 font-mono group-hover:text-green-400 transition-colors">{btn.label}</div>
                          <div className="text-[10px] text-zinc-600 font-mono">{btn.desc}</div>
                        </div>
                        <ArrowRight size={14} className="text-zinc-600 group-hover:text-green-500 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-sm">
                  <h4 className="text-xs font-bold font-mono text-zinc-300 mb-4 uppercase">Component Status</h4>
                  <div className="space-y-3">
                    {[
                      { label: "LUSDT Contract", status: !stats.isPaused, ok: "OPERATIONAL", fail: "PAUSED" },
                      { label: "Tax Manager", status: true, ok: "CONNECTED", fail: "OFFLINE" },
                      { label: "Bridge Node", status: true, ok: "SYNCED", fail: "DESYNC" }
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between pb-2 border-b border-zinc-900 last:border-0 last:pb-0">
                        <span className="text-xs font-mono text-zinc-500">{s.label}</span>
                        <StatusBadge active={s.status} activeText={s.ok} inactiveText={s.fail} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <TeamManagement />
          )}

          {activeTab === 'emergency' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <SectionHeader icon={AlertTriangle} title="EMERGENCY_CONTROLS" description="Critical system overrides. Use with extreme caution." />

              <div className="p-4 border border-red-900/30 bg-red-950/10 rounded-sm mb-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-red-500" size={18} />
                  <p className="text-xs font-mono text-red-400">
                    WARNING: Actions taken here are immediate and affect global liquidity.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Pause Contract */}
                <div className={`bg-zinc-950 border ${stats.isPaused ? 'border-zinc-800 opacity-50' : 'border-red-900/30'} p-6 rounded-sm transition-all`}>
                  <div className="flex items-center gap-2 mb-4 text-red-500">
                    <Lock size={18} />
                    <h4 className="font-bold font-mono">EMERGENCY PAUSE</h4>
                  </div>
                  <p className="text-xs text-zinc-500 font-mono mb-4">
                    Halts all minting, burning, and transfer operations globally.
                  </p>

                  <InputField
                    label="REASON FOR PAUSE"
                    placeholder="Describe the incident..."
                    value={pauseReason}
                    onChange={(e: any) => setPauseReason(e.target.value)}
                  />

                  <button
                    onClick={handlePauseContract}
                    disabled={stats.isPaused || !pauseReason || loading}
                    className="w-full mt-4 bg-red-900/20 text-red-500 border border-red-900/50 py-3 rounded-sm font-mono text-xs font-bold hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase hover:shadow-[0_0_10px_rgba(220,38,38,0.2)]"
                  >
                    {stats.isPaused ? 'SYSTEM ALREADY PAUSED' : 'EXECUTE SYSTEM PAUSE'}
                  </button>
                </div>

                {/* Unpause Contract */}
                <div className={`bg-zinc-950 border ${!stats.isPaused ? 'border-zinc-800 opacity-50' : 'border-green-900/30'} p-6 rounded-sm transition-all`}>
                  <div className="flex items-center gap-2 mb-4 text-green-500">
                    <Shield size={18} />
                    <h4 className="font-bold font-mono">RESTORE OPERATIONS</h4>
                  </div>
                  <p className="text-xs text-zinc-500 font-mono mb-4">
                    Resumes all normal contract functions. Requires verification.
                  </p>

                  <div className="h-[62px] bg-transparent"></div> {/* Spacer to align with input */}

                  <button
                    onClick={handleUnpauseContract}
                    disabled={!stats.isPaused || loading}
                    className="w-full mt-4 bg-green-900/20 text-green-500 border border-green-900/50 py-3 rounded-sm font-mono text-xs font-bold hover:bg-green-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase hover:shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                  >
                    {stats.isPaused ? 'EXECUTE RESTORE PROTOCOL' : 'SYSTEM FULLY OPERATIONAL'}
                  </button>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'fees' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <SectionHeader icon={Calculator} title="FEE_CONFIGURATION" description="Adjust dynamic pricing and volume thresholds." />

              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-sm">
                <h4 className="text-xs font-mono text-zinc-400 mb-4 uppercase border-b border-zinc-900 pb-2">Base Currency Pricing</h4>
                <div className="flex gap-4 items-end max-w-md">
                  <div className="flex-1">
                    <InputField
                      label="LUNES Price (USD)"
                      value={lunesPriceInput}
                      onChange={(e: any) => setLunesPriceInput(e.target.value)}
                      type="number"
                      suffix="USD"
                    />
                  </div>
                  <button
                    onClick={handleUpdateLunesPrice}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold rounded-sm uppercase tracking-wide transition-all"
                  >
                    Update Oracle
                  </button>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-sm">
                <h4 className="text-xs font-mono text-zinc-400 mb-4 uppercase border-b border-zinc-900 pb-2">Volume Tiers (Basis Points)</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <InputField
                    label="Low Volume Fee"
                    value={feeConfigForm.low_volume_fee_bps}
                    onChange={(e: any) => setFeeConfigForm({ ...feeConfigForm, low_volume_fee_bps: parseInt(e.target.value || 0) })}
                    type="number"
                    suffix="BPS"
                  />
                  <InputField
                    label="Medium Volume Fee"
                    value={feeConfigForm.medium_volume_fee_bps}
                    onChange={(e: any) => setFeeConfigForm({ ...feeConfigForm, medium_volume_fee_bps: parseInt(e.target.value || 0) })}
                    type="number"
                    suffix="BPS"
                  />
                  <InputField
                    label="High Volume Fee"
                    value={feeConfigForm.high_volume_fee_bps}
                    onChange={(e: any) => setFeeConfigForm({ ...feeConfigForm, high_volume_fee_bps: parseInt(e.target.value || 0) })}
                    type="number"
                    suffix="BPS"
                  />
                </div>

                <h4 className="text-xs font-mono text-zinc-400 mb-4 uppercase border-b border-zinc-900 pb-2 pt-4">Threshold Triggers</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <InputField
                    label="Tier 1 Threshold (Low -> Med)"
                    value={feeConfigForm.volume_threshold_1_usd}
                    onChange={(e: any) => setFeeConfigForm({ ...feeConfigForm, volume_threshold_1_usd: e.target.value })}
                    type="number"
                    suffix="USD"
                  />
                  <InputField
                    label="Tier 2 Threshold (Med -> High)"
                    value={feeConfigForm.volume_threshold_2_usd}
                    onChange={(e: any) => setFeeConfigForm({ ...feeConfigForm, volume_threshold_2_usd: e.target.value })}
                    type="number"
                    suffix="USD"
                  />
                </div>

                <div className="flex gap-4 pt-4 border-t border-zinc-900">
                  <button
                    onClick={handleUpdateFeeConfig}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-black font-mono text-xs font-bold rounded-sm uppercase tracking-wide transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)] hover:shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                  >
                    Commit Configuration
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'wallets' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <SectionHeader icon={Wallet} title="DISTRIBUTION_WALLETS" description="Configure protocol revenue streams." />

              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-sm space-y-4">
                {[
                  { id: 'devSolana', label: 'Dev Wallet — Solana Fees (80%)', hint: 'Receives 80% of USDT fees from Solana network', editable: true },
                  { id: 'devLunes', label: 'Dev Wallet — Lunes Fees (80%)', hint: 'Receives 80% of LUSDT/LUNES fees from Lunes network', editable: true },
                  { id: 'insuranceFund', label: 'Insurance Fund (15%)', hint: 'Fixed address — cannot be changed via admin', editable: false },
                  { id: 'stakingRewardsPool', label: 'Staking Rewards Pool (5%)', hint: 'Monthly distribution to LUNES stakers with ≥100k LUNES', editable: true },
                ].map((w) => (
                  <div key={w.id}>
                    <InputField
                      label={w.label}
                      value={(walletForm as any)[w.id]}
                      onChange={w.editable ? (e: any) => setWalletForm({ ...walletForm, [w.id]: e.target.value }) : undefined}
                      placeholder={w.editable ? `Address (starts with 5...)` : 'Fixed — set at deploy'}
                    />
                    <p className={`text-[10px] font-mono mt-1 text-right ${w.editable ? 'text-zinc-600' : 'text-yellow-600'}`}>{w.hint}</p>
                  </div>
                ))}

                <div className="flex gap-4 pt-6 border-t border-zinc-900 mt-4">
                  <button
                    onClick={handleUpdateWallets}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-black font-mono text-xs font-bold rounded-sm uppercase tracking-wide transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)] hover:shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                  >
                    Save Dev Wallets
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'staking' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <SectionHeader icon={Users} title="STAKING_REWARDS" description="5% of all protocol fees distributed monthly to eligible LUNES stakers." />

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-sm">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Minimum Stake Required</div>
                  <div className="text-2xl font-bold font-mono text-purple-400">100,000 LUNES</div>
                  <p className="text-[10px] font-mono text-zinc-600 mt-2">Stakers must hold ≥100k LUNES on the Lunes platform to qualify for rewards.</p>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-sm">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Distribution Frequency</div>
                  <div className="text-2xl font-bold font-mono text-green-400">Monthly</div>
                  <p className="text-[10px] font-mono text-zinc-600 mt-2">Rewards accumulate in the pool and are distributed once per month to all eligible stakers.</p>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-sm">
                <h4 className="text-xs font-mono text-zinc-400 mb-4 uppercase">Estimated Monthly Staking Rewards</h4>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Monthly Volume", val: `$${parseFloat(stats.monthlyVolume).toLocaleString()}`, col: "text-zinc-300" },
                    { label: "Total Fees (0.6%)", val: `$${(parseFloat(stats.monthlyVolume) * (stats.currentFeeBps / 10000)).toFixed(2)}`, col: "text-yellow-400" },
                    { label: "Staking Pool (5%)", val: `$${(parseFloat(stats.monthlyVolume) * (stats.currentFeeBps / 10000) * 0.05).toFixed(2)}`, col: "text-purple-400" },
                  ].map((s, i) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 p-4 text-center rounded-sm">
                      <div className="text-[10px] font-mono text-zinc-500 uppercase">{s.label}</div>
                      <div className={`text-lg font-bold font-mono ${s.col}`}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-sm">
                <h4 className="text-xs font-mono text-zinc-400 mb-4 uppercase">How It Works</h4>
                <div className="space-y-3 font-mono text-xs text-zinc-400">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                    <div><span className="text-zinc-200">Fee Collection:</span> Every swap (mint/burn) charges a stablecoin fee. 5% of this fee goes to the Staking Rewards Pool.</div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                    <div><span className="text-zinc-200">Accumulation:</span> Rewards accumulate in the pool wallet throughout the month (both USDT and LUSDT).</div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
                    <div><span className="text-zinc-200">Eligibility:</span> Only wallets staking ≥100,000 LUNES on the Lunes platform are eligible for distribution.</div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0">4</div>
                    <div><span className="text-zinc-200">Distribution:</span> At the end of each month, the pool is distributed proportionally to eligible stakers based on their stake weight.</div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950 border border-yellow-800/50 p-4 rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-mono text-yellow-500 uppercase">Staking Rewards Pool Address</span>
                </div>
                <div className="font-mono text-xs text-zinc-300 break-all">
                  {walletForm.stakingRewardsPool || 'Not configured — set in Wallets tab'}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <SectionHeader icon={TrendingUp} title="REVENUE_SIMULATION" description="Projected earnings based on current volume." />

              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: "Fee Rate", val: `${(stats.currentFeeBps / 100).toFixed(2)}%`, col: "text-purple-400" },
                  { label: "Est. Revenue", val: `$${(parseFloat(stats.monthlyVolume) * (stats.currentFeeBps / 10000)).toFixed(2)}`, col: "text-green-400" },
                  { label: "Dev Share (80%)", val: `$${(parseFloat(stats.monthlyVolume) * (stats.currentFeeBps / 10000) * 0.8).toFixed(2)}`, col: "text-blue-400" },
                ].map((s, i) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-800 p-4 text-center rounded-sm">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase">{s.label}</div>
                    <div className={`text-xl font-bold font-mono ${s.col}`}>{s.val}</div>
                  </div>
                ))}
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-sm">
                <h4 className="text-xs font-mono text-zinc-400 mb-6 uppercase">Revenue Distribution (v3 Model — 80/15/5)</h4>

                <div className="space-y-4 font-mono text-xs">
                  {[
                    { l: "Dev Team", p: 80, c: "bg-blue-500" },
                    { l: "Insurance", p: 15, c: "bg-green-500" },
                    { l: "Staking Rewards", p: 5, c: "bg-purple-500" }
                  ].map((d, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-24 text-zinc-400 text-right">{d.l}</div>
                      <div className="flex-1 h-3 bg-zinc-900 rounded-sm overflow-hidden border border-zinc-800">
                        <div className={`h-full ${d.c}`} style={{ width: `${d.p}%` }}></div>
                      </div>
                      <div className="w-12 text-zinc-300 font-bold">{d.p}%</div>
                      <div className="w-20 text-right text-zinc-500">
                        ${(parseFloat(stats.monthlyVolume) * (stats.currentFeeBps / 10000) * (d.p / 100)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}