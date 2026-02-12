import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './WalletProvider';
import { useLunesContract } from '../hooks/useLunesContract';
import { useStakingContract } from '../hooks/useStakingContract';
import { useBridgeAPI } from '../api/bridgeClient';
import { BRIDGE_CONFIG } from '../config';
import {
  Coins,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  Wallet,
  ArrowRight,
  Zap,
  Terminal,
  RefreshCw,
  Database,
  Link2,
  Lock,
  Unlock,
  Gift,
  Loader2,
  Users,
  ShieldCheck,
} from 'lucide-react';

const STAKING_MIN_LUNES = 100_000;

export function StakingPanel() {
  const { lunesWallet } = useWallet();
  const {
    api,
    getLusdtBalance,
    getMonthlyVolume,
    getCurrentFeeBps,
    getLunesPrice,
    isConnected,
  } = useLunesContract();
  const { client: bridgeAPI, isConnected: bridgeConnected } = useBridgeAPI();

  // Staking contract hook
  const staking = useStakingContract(api);

  const [loading, setLoading] = useState(true);
  const [lunesBalance, setLunesBalance] = useState(0);
  const [lusdtBalance, setLusdtBalance] = useState('0');
  const [monthlyVolume, setMonthlyVolume] = useState(0);
  const [currentFeeBps, setCurrentFeeBps] = useState(0);
  const [lunesPrice, setLunesPrice] = useState(0);
  const [dataSource, setDataSource] = useState<'contract' | 'bridge-api' | 'none'>('none');

  // Staking action states
  const [stakeAmount, setStakeAmount] = useState('');
  const [actionLoading, setActionLoading] = useState<'stake' | 'unstake' | 'claim' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const totalFees = monthlyVolume * (currentFeeBps / 10000);
  const stakingPool = totalFees * (BRIDGE_CONFIG.feeDistribution.stakingRewards / 100);
  const feePercent = (currentFeeBps / 100).toFixed(2);
  const canStake = lunesBalance >= STAKING_MIN_LUNES || staking.isUserStaking;
  const availableToStake = lunesBalance;

  // Query native LUNES balance from chain via api.query.system.account
  const queryNativeLunesBalance = useCallback(async (): Promise<number> => {
    if (!api || !lunesWallet?.address) return 0;
    try {
      const accountInfo = await api.query.system.account(lunesWallet.address);
      const free = (accountInfo as any).data?.free;
      if (free) {
        return Number(free.toBigInt()) / 1e12;
      }
      return 0;
    } catch (e) {
      console.error('StakingPanel: failed to query native LUNES balance', e);
      return 0;
    }
  }, [api, lunesWallet?.address]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vol, fee, price, balance] = await Promise.all([
        getMonthlyVolume().catch(() => '0'),
        getCurrentFeeBps().catch(() => 0),
        getLunesPrice().catch(() => '0'),
        getLusdtBalance().catch(() => '0'),
      ]);

      let contractVolume = parseFloat(vol);
      let contractFee = fee;
      let contractPrice = parseFloat(price);
      let source: 'contract' | 'bridge-api' | 'none' = 'none';

      if (contractVolume > 0 || contractFee > 0 || contractPrice > 0) {
        source = 'contract';
      }

      if (bridgeConnected) {
        try {
          const [stats, contractStatus] = await Promise.all([
            bridgeAPI.getStatistics().catch(() => null),
            bridgeAPI.adminGetContractStatus().catch(() => null),
          ]);
          if (contractStatus) {
            if (contractVolume === 0 && contractStatus.monthlyVolume > 0) {
              contractVolume = contractStatus.monthlyVolume;
              source = 'bridge-api';
            }
            if (contractPrice === 0 && contractStatus.lunesPrice > 0) {
              contractPrice = contractStatus.lunesPrice;
              source = 'bridge-api';
            }
          }
          if (stats && (stats as any).totalVolumeUSDT && contractVolume === 0) {
            contractVolume = (stats as any).totalVolumeUSDT;
            source = 'bridge-api';
          }
        } catch (e) {
          console.warn('StakingPanel: Bridge API fallback failed', e);
        }
      }

      setMonthlyVolume(contractVolume);
      setCurrentFeeBps(contractFee);
      setLunesPrice(contractPrice);
      setLusdtBalance(balance);
      setDataSource(source);

      const nativeLunes = await queryNativeLunesBalance();
      setLunesBalance(nativeLunes);

      // Load staking contract data
      await staking.loadStakingData();
    } catch (e) {
      console.error('StakingPanel: failed to load data', e);
    } finally {
      setLoading(false);
    }
  }, [getMonthlyVolume, getCurrentFeeBps, getLunesPrice, getLusdtBalance, queryNativeLunesBalance, bridgeAPI, bridgeConnected, staking.loadStakingData]);

  useEffect(() => {
    if (lunesWallet) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [lunesWallet, loadData]);

  // Clear messages after 5s
  useEffect(() => {
    if (actionSuccess || actionError) {
      const t = setTimeout(() => { setActionSuccess(null); setActionError(null); }, 5000);
      return () => clearTimeout(t);
    }
  }, [actionSuccess, actionError]);

  // ── Staking Actions ──────────────────────────────────────────────
  const handleStake = async () => {
    const amount = parseFloat(stakeAmount);
    if (!amount || amount < STAKING_MIN_LUNES) {
      setActionError(`Minimum stake is ${STAKING_MIN_LUNES.toLocaleString()} LUNES`);
      return;
    }
    if (amount > lunesBalance) {
      setActionError('Insufficient LUNES balance');
      return;
    }
    setActionLoading('stake');
    setActionError(null);
    try {
      await staking.stake(amount);
      setActionSuccess(`Successfully staked ${amount.toLocaleString()} LUNES!`);
      setStakeAmount('');
      const nativeLunes = await queryNativeLunesBalance();
      setLunesBalance(nativeLunes);
    } catch (e: any) {
      setActionError(e.message || 'Stake failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnstake = async () => {
    setActionLoading('unstake');
    setActionError(null);
    try {
      await staking.unstake();
      setActionSuccess('Successfully unstaked! LUNES returned to your wallet.');
      const nativeLunes = await queryNativeLunesBalance();
      setLunesBalance(nativeLunes);
    } catch (e: any) {
      setActionError(e.message || 'Unstake failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClaim = async () => {
    setActionLoading('claim');
    setActionError(null);
    try {
      await staking.claimRewards();
      setActionSuccess(`Claimed ${staking.userPendingRewards.toFixed(2)} LUSDT rewards!`);
    } catch (e: any) {
      setActionError(e.message || 'Claim failed');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Skeleton loader ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-zinc-900 border border-zinc-800 rounded-sm" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-zinc-900 border border-zinc-800 rounded-sm" />
          ))}
        </div>
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-sm" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ═══ Hero Banner ═══ */}
      <div className="border border-zinc-800 bg-zinc-900/50 p-6 md:p-8 rounded-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/0 via-purple-500/50 to-purple-500/0 opacity-60" />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-900/30 border border-purple-800/50 flex items-center justify-center rounded-sm">
                <Coins className="w-5 h-5 text-purple-400" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold font-mono tracking-tighter text-zinc-100">
                STAKING_REWARDS
              </h1>
            </div>
            <p className="text-zinc-500 font-mono text-xs max-w-lg">
              Lock your LUNES in the on-chain staking contract to earn LUSDT rewards.
              All funds are managed by smart contract — trustless, no admin can divert.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-sm text-xs font-mono text-zinc-400 hover:text-purple-400 hover:border-purple-800/50 transition-all"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            REFRESH
          </button>
        </div>
      </div>

      {/* ═══ Action Messages ═══ */}
      {actionError && (
        <div className="border border-red-900/50 bg-red-950/10 p-4 rounded-sm flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs font-mono text-red-400">{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="border border-green-900/50 bg-green-950/10 p-4 rounded-sm flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
          <span className="text-xs font-mono text-green-400">{actionSuccess}</span>
        </div>
      )}

      {/* ═══ STAKING ACTION PANEL ═══ */}
      <div className="border border-purple-900/30 bg-zinc-900/50 p-6 rounded-sm">
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-mono text-purple-400 uppercase font-bold">On-Chain Staking — Trustless Fund Management</h3>
        </div>

        {!lunesWallet ? (
          <div className="text-center py-8">
            <Wallet className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <div className="text-sm font-mono text-zinc-400">Connect your Lunes wallet to start staking</div>
            <div className="text-[10px] font-mono text-zinc-600 mt-1">
              Staking requires ≥{STAKING_MIN_LUNES.toLocaleString()} LUNES locked in the smart contract
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Stake / Unstake */}
            <div className="space-y-4">
              {/* Current stake status */}
              <div className={`border rounded-sm p-4 ${staking.isUserStaking ? 'border-green-900/40 bg-green-950/5' : 'border-zinc-800 bg-zinc-950/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Your Staked LUNES</span>
                  {staking.isUserStaking && <Lock className="w-3 h-3 text-green-500" />}
                </div>
                <div className={`text-2xl font-bold font-mono tracking-tighter ${staking.isUserStaking ? 'text-green-400' : 'text-zinc-500'}`}>
                  {staking.userStaked.toLocaleString()} LUNES
                </div>
                {staking.isUserStaking && (
                  <div className="text-[10px] font-mono text-green-600 mt-1">
                    ≈ ${(staking.userStaked * lunesPrice).toFixed(2)} USD · Locked in smart contract
                  </div>
                )}
              </div>

              {/* Stake input */}
              {!staking.isUserStaking && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase">Amount to Stake</label>
                    <button
                      onClick={() => setStakeAmount(Math.max(lunesBalance, STAKING_MIN_LUNES).toString())}
                      className="text-[10px] font-mono text-purple-400 hover:text-purple-300"
                    >
                      MAX: {lunesBalance.toLocaleString()}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={e => setStakeAmount(e.target.value)}
                      placeholder={`Min ${STAKING_MIN_LUNES.toLocaleString()} LUNES`}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-sm px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-purple-800 focus:outline-none"
                    />
                    <button
                      onClick={handleStake}
                      disabled={!!actionLoading || !stakeAmount}
                      className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-mono text-xs font-bold rounded-sm transition-colors"
                    >
                      {actionLoading === 'stake' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      STAKE
                    </button>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-600">
                    Your LUNES will be locked in the smart contract. Min: {STAKING_MIN_LUNES.toLocaleString()} LUNES.
                  </div>
                </div>
              )}

              {/* Unstake button */}
              {staking.isUserStaking && (
                <button
                  onClick={handleUnstake}
                  disabled={!!actionLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-950 border border-zinc-800 hover:border-red-900/50 hover:bg-red-950/10 text-zinc-400 hover:text-red-400 font-mono text-xs font-bold rounded-sm transition-all"
                >
                  {actionLoading === 'unstake' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                  UNSTAKE ALL — Return {staking.userStaked.toLocaleString()} LUNES
                </button>
              )}
            </div>

            {/* Right: Rewards */}
            <div className="space-y-4">
              {/* Pending rewards */}
              <div className={`border rounded-sm p-4 ${staking.userPendingRewards > 0 ? 'border-yellow-900/40 bg-yellow-950/5' : 'border-zinc-800 bg-zinc-950/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Pending LUSDT Rewards</span>
                  {staking.userPendingRewards > 0 && <Gift className="w-3 h-3 text-yellow-500" />}
                </div>
                <div className={`text-2xl font-bold font-mono tracking-tighter ${staking.userPendingRewards > 0 ? 'text-yellow-400' : 'text-zinc-500'}`}>
                  ${staking.userPendingRewards.toFixed(6)} LUSDT
                </div>
                {staking.userPendingRewards > 0 && (
                  <div className="text-[10px] font-mono text-yellow-600 mt-1">
                    Earned from protocol fees — claim anytime
                  </div>
                )}
              </div>

              {/* Claim button */}
              <button
                onClick={handleClaim}
                disabled={!!actionLoading || staking.userPendingRewards <= 0}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 font-mono text-xs font-bold rounded-sm transition-all ${
                  staking.userPendingRewards > 0
                    ? 'bg-yellow-600 hover:bg-yellow-500 text-black'
                    : 'bg-zinc-950 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {actionLoading === 'claim' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Gift className="w-4 h-4" />
                )}
                {staking.userPendingRewards > 0
                  ? `CLAIM ${staking.userPendingRewards.toFixed(2)} LUSDT`
                  : 'NO REWARDS TO CLAIM'}
              </button>

              {/* Wallet balances */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-sm">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">LUNES Wallet</div>
                  <div className="text-sm font-bold font-mono text-zinc-100">{lunesBalance.toLocaleString()}</div>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-sm">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">LUSDT Wallet</div>
                  <div className="text-sm font-bold font-mono text-zinc-100">${parseFloat(lusdtBalance).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Global Staking Stats ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-3 h-3 text-purple-400" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Total Staked</span>
          </div>
          <div className="text-lg font-bold font-mono text-zinc-100 tracking-tighter">
            {staking.totalStaked.toLocaleString()}
          </div>
          <div className="text-[10px] font-mono text-zinc-600">LUNES locked</div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Active Stakers</span>
          </div>
          <div className="text-lg font-bold font-mono text-zinc-100 tracking-tighter">
            {staking.stakerCount}
          </div>
          <div className="text-[10px] font-mono text-zinc-600">participants</div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-3 h-3 text-yellow-400" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Total Distributed</span>
          </div>
          <div className="text-lg font-bold font-mono text-yellow-400 tracking-tighter">
            ${staking.totalRewardsDeposited.toFixed(2)}
          </div>
          <div className="text-[10px] font-mono text-zinc-600">LUSDT rewards</div>
        </div>

        <div className="bg-zinc-900/50 border border-purple-900/30 p-4 rounded-sm">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-3 h-3 text-purple-400" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Pool Balance</span>
          </div>
          <div className="text-lg font-bold font-mono text-purple-400 tracking-tighter">
            ${staking.undistributedRewards.toFixed(2)}
          </div>
          <div className="text-[10px] font-mono text-zinc-600">unclaimed LUSDT</div>
        </div>
      </div>

      {/* ═══ Protocol Fee Stats ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Monthly Protocol Volume</span>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100 tracking-tighter">
            ${monthlyVolume.toLocaleString()}
          </div>
          <div className="text-[10px] font-mono text-zinc-600 mt-1">Fee rate: {feePercent}%</div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-sm">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Total Fees Generated</span>
          </div>
          <div className="text-2xl font-bold font-mono text-yellow-400 tracking-tighter">
            ${totalFees.toFixed(2)}
          </div>
          <div className="text-[10px] font-mono text-zinc-600 mt-1">From {feePercent}% on all swaps</div>
        </div>

        <div className="bg-zinc-900/50 border border-purple-900/30 p-5 rounded-sm">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Est. Staking Pool (5%)</span>
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400 tracking-tighter">
            ${stakingPool.toFixed(2)}
          </div>
          <div className="text-[10px] font-mono text-zinc-600 mt-1">5% of protocol fees → stakers</div>
        </div>
      </div>

      {/* ═══ Fee Distribution Visual ═══ */}
      <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-sm">
        <h3 className="text-xs font-mono text-zinc-400 uppercase mb-5 flex items-center gap-2">
          <Terminal className="w-3 h-3" />
          Fee Distribution Model (v3)
        </h3>

        <div className="space-y-3">
          {[
            { label: 'Dev Team', pct: BRIDGE_CONFIG.feeDistribution.dev, color: 'bg-blue-500', textColor: 'text-blue-400', amount: totalFees * 0.80 },
            { label: 'Insurance Fund', pct: BRIDGE_CONFIG.feeDistribution.insuranceFund, color: 'bg-green-500', textColor: 'text-green-400', amount: totalFees * 0.15 },
            { label: 'Staking Rewards', pct: BRIDGE_CONFIG.feeDistribution.stakingRewards, color: 'bg-purple-500', textColor: 'text-purple-400', amount: stakingPool },
          ].map((d, i) => (
            <div key={i} className="flex items-center gap-4 font-mono text-xs">
              <div className="w-28 text-zinc-400 text-right">{d.label}</div>
              <div className="flex-1 h-3 bg-zinc-950 rounded-sm overflow-hidden border border-zinc-800">
                <div className={`h-full ${d.color} transition-all duration-700`} style={{ width: `${d.pct}%` }} />
              </div>
              <div className={`w-10 font-bold ${d.textColor}`}>{d.pct}%</div>
              <div className="w-20 text-right text-zinc-500">${d.amount.toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between text-[10px] font-mono text-zinc-600">
          <span>TOTAL FEES THIS MONTH: ${totalFees.toFixed(2)}</span>
          <span>YOUR SHARE: {staking.isUserStaking ? 'Staking — Eligible' : 'Not staking yet'}</span>
        </div>
      </div>

      {/* ═══ How It Works ═══ */}
      <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-sm">
        <h3 className="text-xs font-mono text-zinc-400 uppercase mb-5 flex items-center gap-2">
          <Shield className="w-3 h-3" />
          How On-Chain Staking Works
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              step: 1,
              icon: Lock,
              title: 'Lock LUNES',
              desc: `Stake ≥${STAKING_MIN_LUNES.toLocaleString()} LUNES by approving and locking them in the StakingManager smart contract. Your tokens are held on-chain — no admin can access them.`,
            },
            {
              step: 2,
              icon: Zap,
              title: 'Fees Flow In',
              desc: `Every swap (mint/burn) charges a ${feePercent}% fee. 5% of this fee is sent as LUSDT directly to the StakingManager contract by the Tax Manager.`,
            },
            {
              step: 3,
              icon: TrendingUp,
              title: 'Proportional Rewards',
              desc: 'Rewards accumulate proportionally based on your stake weight vs total staked. More LUNES staked = larger share of the LUSDT reward pool.',
            },
            {
              step: 4,
              icon: Gift,
              title: 'Claim Anytime',
              desc: 'Claim your accumulated LUSDT rewards at any time. The smart contract calculates and sends your exact share — fully trustless, no manual distribution needed.',
            },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3 p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-sm">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-800/30 text-purple-400 flex items-center justify-center text-xs font-bold font-mono shrink-0">
                {item.step}
              </div>
              <div>
                <div className="text-xs font-mono font-bold text-zinc-200 mb-1">{item.title}</div>
                <div className="text-[11px] font-mono text-zinc-500 leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Security Notice ═══ */}
      <div className="border border-green-900/30 bg-green-950/5 p-5 rounded-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-mono font-bold text-green-400 mb-1">TRUSTLESS — Smart Contract Managed</div>
            <div className="text-[10px] font-mono text-green-600 leading-relaxed">
              All staked LUNES and LUSDT rewards are held by the StakingManager smart contract on the Lunes blockchain.
              No admin can withdraw, redirect, or modify fund balances. Your stake can ONLY be returned to YOUR wallet.
              LUSDT rewards are calculated on-chain using the Synthetix reward-per-token accumulator pattern.
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Footer: data source + prices ═══ */}
      <div className="text-center text-[10px] font-mono text-zinc-600 py-2 space-y-1">
        <div>
          LUNES_PRICE: ${lunesPrice.toFixed(4)} USD · FEE_RATE: {feePercent}% · POOL_SHARE: {BRIDGE_CONFIG.feeDistribution.stakingRewards}%
        </div>
        <div className="flex items-center justify-center gap-2">
          {dataSource === 'contract' && (
            <>
              <Database className="w-3 h-3 text-green-600" />
              <span className="text-green-600">LIVE — On-chain contract data</span>
            </>
          )}
          {dataSource === 'bridge-api' && (
            <>
              <Link2 className="w-3 h-3 text-blue-600" />
              <span className="text-blue-600">LIVE — Bridge API data</span>
            </>
          )}
          {dataSource === 'none' && (
            <>
              <AlertTriangle className="w-3 h-3 text-zinc-500" />
              <span className="text-zinc-500">NO DATA SOURCE — Connect wallet to load real data</span>
            </>
          )}
          {staking.isAvailable && (
            <>
              <span className="text-zinc-700">·</span>
              <ShieldCheck className="w-3 h-3 text-green-600" />
              <span className="text-green-600">STAKING CONTRACT ACTIVE</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
