import { useState, useEffect, useCallback } from 'react';
import { ApiPromise } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { web3FromSource } from '@polkadot/extension-dapp';
import { useWallet } from '../components/WalletProvider';
import { useLunesContract } from './useLunesContract';

// WeightV2 gas limit constants
const QUERY_REF_TIME = 5_000_000_000_000n;
const QUERY_PROOF_SIZE = 5_000_000n;
const TX_REF_TIME = 50_000_000_000n;
const TX_PROOF_SIZE = 5_000_000n;

function createGasLimit(api: ApiPromise, refTime: bigint, proofSize: bigint) {
  return api.registry.createType('WeightV2', { refTime, proofSize }) as any;
}

// Helper to unwrap ink! Result<T, E> output: {ok: value} or {err: ...}
function unwrapOutput(output: any): any {
  const json = output?.toJSON?.() ?? output;
  if (json && typeof json === 'object' && 'ok' in json) return json.ok;
  return json;
}

// Types for Admin Operations — v3 model (80% dev / 15% insurance / 5% staking)
type DistributionWallets = {
  devSolana: string;
  devLunes: string;
  insuranceFund: string;
  stakingRewardsPool: string;
};

type FeeConfig = {
  base_fee_bps: number;
  volume_threshold_1_usd: string;
  volume_threshold_2_usd: string;
  low_volume_fee_bps: number;
  medium_volume_fee_bps: number;
  high_volume_fee_bps: number;
};

type ContractStats = {
  isPaused: boolean;
  totalSupply: string;
  lunesPrice: string;
  monthlyVolume: string;
  currentFeeBps: number;
  feeConfig: FeeConfig | null;
  distributionWallets: DistributionWallets | null;
  roles: Record<string, boolean>; // Cache of user roles
};

export function useAdminContract() {
  const { lunesWallet } = useWallet();
  const { lusdtContract, taxManagerContract, isOwner, isPaused, getLunesPrice, getTotalSupply } = useLunesContract();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdminRole, setIsAdminRole] = useState(false);
  const [stats, setStats] = useState<ContractStats>({
    isPaused: false,
    totalSupply: '0',
    lunesPrice: '0.50',
    monthlyVolume: '0',
    currentFeeBps: 60,
    feeConfig: null,
    distributionWallets: null,
    roles: {}
  });

  // Fetch all contract statistics
  const refreshStats = useCallback(async () => {
    if (!lusdtContract || !taxManagerContract || !lunesWallet) return;

    try {
      setLoading(true);

      const [
        pausedStatus,
        supply,
        price,
        monthlyVol,
        feeBps
      ] = await Promise.all([
        isPaused(),
        getTotalSupply(),
        getLunesPrice(),
        getMonthlyVolume(),
        getCurrentFeeBps()
      ]);

      // Fetch fee config
      const feeConfig = await getFeeConfig();

      // Fetch distribution wallets
      const wallets = await getDistributionWallets();

      setStats({
        isPaused: pausedStatus,
        totalSupply: supply,
        lunesPrice: price,
        monthlyVolume: monthlyVol,
        currentFeeBps: feeBps,
        feeConfig,
        distributionWallets: wallets,
        roles: {}
      });

    } catch (err) {
      console.error('Error refreshing stats:', err);
      setError(err instanceof Error ? err.message : 'Error fetching stats');
    } finally {
      setLoading(false);
    }
  }, [lusdtContract, taxManagerContract, lunesWallet, isPaused, getTotalSupply, getLunesPrice]);

  // Check admin role and auto-refresh when contracts are ready
  useEffect(() => {
    const checkAdminAndRefresh = async () => {
      if (!lusdtContract || !taxManagerContract || !lunesWallet) {
        setAdminChecked(false);
        setIsAdminRole(false);
        return;
      }

      try {
        const hasAdmin = await isOwner();
        console.log('🔐 Admin check result:', hasAdmin);
        setIsAdminRole(hasAdmin);
        setAdminChecked(true);

        if (hasAdmin) {
          await refreshStats();
        }
      } catch (err) {
        console.error('Error checking admin role:', err);
        setIsAdminRole(false);
        setAdminChecked(true);
      }
    };

    checkAdminAndRefresh();
  }, [lusdtContract, taxManagerContract, lunesWallet?.address]);

  // Get monthly volume from Tax Manager
  const getMonthlyVolume = useCallback(async (): Promise<string> => {
    if (!taxManagerContract) return '0';

    try {
      const api = (taxManagerContract as any).api as ApiPromise;
      const gasLimit = createGasLimit(api, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const { result, output } = await taxManagerContract.query.getMonthlyVolumeUsd(
        lunesWallet?.address || '',
        { value: 0, gasLimit }
      );

      if (result.isErr) throw new Error('Failed to get monthly volume');

      const volume = Number(unwrapOutput(output) ?? 0);
      return (volume / 1_000_000).toFixed(2);
    } catch (error) {
      console.error('Error getting monthly volume:', error);
      return '0';
    }
  }, [taxManagerContract, lunesWallet?.address]);

  // Get current fee in basis points
  const getCurrentFeeBps = useCallback(async (): Promise<number> => {
    if (!taxManagerContract) return 60;

    try {
      const api = (taxManagerContract as any).api as ApiPromise;
      const gasLimit = createGasLimit(api, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const { result, output } = await taxManagerContract.query.getCurrentFeeBps(
        lunesWallet?.address || '',
        { value: 0, gasLimit }
      );

      if (result.isErr) throw new Error('Failed to get current fee');

      return Number(unwrapOutput(output) ?? 60);
    } catch (error) {
      console.error('Error getting current fee:', error);
      return 60;
    }
  }, [taxManagerContract, lunesWallet?.address]);

  // Get fee configuration
  const getFeeConfig = useCallback(async (): Promise<FeeConfig | null> => {
    if (!taxManagerContract) return null;

    try {
      const api = (taxManagerContract as any).api as ApiPromise;
      const gasLimit = createGasLimit(api, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const { result, output } = await taxManagerContract.query.getFeeConfig(
        lunesWallet?.address || '',
        { value: 0, gasLimit }
      );

      if (result.isErr || !output) return null;

      const rawConfig = unwrapOutput(output) as any;
      if (!rawConfig) return null;

      return {
        base_fee_bps: rawConfig.base_fee_bps || rawConfig.baseFeeBps || 50,
        volume_threshold_1_usd: ((rawConfig.volume_threshold_1_usd || rawConfig.volumeThreshold1Usd || 0) / 1_000_000).toString(),
        volume_threshold_2_usd: ((rawConfig.volume_threshold_2_usd || rawConfig.volumeThreshold2Usd || 0) / 1_000_000).toString(),
        low_volume_fee_bps: rawConfig.low_volume_fee_bps || rawConfig.lowVolumeFeeBps || 60,
        medium_volume_fee_bps: rawConfig.medium_volume_fee_bps || rawConfig.mediumVolumeFeeBps || 50,
        high_volume_fee_bps: rawConfig.high_volume_fee_bps || rawConfig.highVolumeFeeBps || 30
      };
    } catch (error) {
      console.error('Error getting fee config:', error);
      return null;
    }
  }, [taxManagerContract, lunesWallet?.address]);

  // Get distribution wallets
  const getDistributionWallets = useCallback(async (): Promise<DistributionWallets | null> => {
    if (!taxManagerContract) return null;

    try {
      const api = (taxManagerContract as any).api as ApiPromise;
      const gasLimit = createGasLimit(api, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const { result, output } = await taxManagerContract.query.getWallets(
        lunesWallet?.address || '',
        { value: 0, gasLimit }
      );

      if (result.isErr || !output) return null;

      const rawWallets = unwrapOutput(output) as any;
      if (!rawWallets) return null;

      return {
        devSolana: rawWallets.devSolana || rawWallets.dev_solana || '',
        devLunes: rawWallets.devLunes || rawWallets.dev_lunes || '',
        insuranceFund: rawWallets.insuranceFund || rawWallets.insurance_fund || '',
        stakingRewardsPool: rawWallets.stakingRewardsPool || rawWallets.staking_rewards_pool || ''
      };
    } catch (error) {
      console.error('Error getting distribution wallets:', error);
      return null;
    }
  }, [taxManagerContract, lunesWallet?.address]);

  // Update LUNES price (Admin only)
  const updateLunesPrice = useCallback(async (newPrice: number): Promise<string> => {
    if (!taxManagerContract || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    const isAdmin = await isOwner();
    if (!isAdmin) {
      throw new Error('Unauthorized: Only owner can update price');
    }

    try {
      setLoading(true);
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      // Convert to 6 decimals
      const priceInUnits = Math.floor(newPrice * 1_000_000);

      console.log('💰 Updating LUNES price:', { newPrice, priceInUnits });

      const api = (taxManagerContract as any).api as ApiPromise;
      const gasLimit = createGasLimit(api, TX_REF_TIME, TX_PROOF_SIZE);

      const result = await taxManagerContract.tx
        .updateLunesPrice({ value: 0, gasLimit, storageDepositLimit: null }, priceInUnits)
        .signAndSend(lunesWallet.address, { signer }, ({ status, dispatchError }) => {
          if (dispatchError) {
            throw new Error(`Transaction failed: ${dispatchError.toString()}`);
          }
          if (status.isInBlock) console.log('✅ Price update included in block');
          if (status.isFinalized) console.log('✅ Price update finalized');
        });

      await refreshStats();
      return result.toString();
    } catch (error) {
      console.error('Error updating LUNES price:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [taxManagerContract, lunesWallet, isOwner, refreshStats]);

  // Update fee configuration (Admin only)
  const updateFeeConfig = useCallback(async (config: FeeConfig): Promise<string> => {
    if (!taxManagerContract || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    const isAdmin = await isOwner();
    if (!isAdmin) {
      throw new Error('Unauthorized: Only owner can update fee config');
    }

    try {
      setLoading(true);
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      // Convert thresholds to 6 decimals
      const configForContract = {
        base_fee_bps: config.base_fee_bps,
        volume_threshold_1_usd: Math.floor(parseFloat(config.volume_threshold_1_usd) * 1_000_000),
        volume_threshold_2_usd: Math.floor(parseFloat(config.volume_threshold_2_usd) * 1_000_000),
        low_volume_fee_bps: config.low_volume_fee_bps,
        medium_volume_fee_bps: config.medium_volume_fee_bps,
        high_volume_fee_bps: config.high_volume_fee_bps
      };

      console.log('📊 Updating fee config:', configForContract);

      const api = (taxManagerContract as any).api as ApiPromise;
      const gasLimit = createGasLimit(api, TX_REF_TIME, TX_PROOF_SIZE);

      const result = await taxManagerContract.tx
        .updateFeeConfig({ value: 0, gasLimit, storageDepositLimit: null }, configForContract)
        .signAndSend(lunesWallet.address, { signer }, ({ status, dispatchError }) => {
          if (dispatchError) {
            throw new Error(`Transaction failed: ${dispatchError.toString()}`);
          }
          if (status.isInBlock) console.log('✅ Fee config update included in block');
          if (status.isFinalized) console.log('✅ Fee config update finalized');
        });

      await refreshStats();
      return result.toString();
    } catch (error) {
      console.error('Error updating fee config:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [taxManagerContract, lunesWallet, isOwner, refreshStats]);

  // Update dev wallets (Admin only) — insurance_fund is fixed and cannot be changed
  const updateDistributionWallets = useCallback(async (wallets: DistributionWallets): Promise<string> => {
    if (!taxManagerContract || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    const isAdmin = await isOwner();
    if (!isAdmin) {
      throw new Error('Unauthorized: Only owner can update wallets');
    }

    try {
      setLoading(true);
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      // Validate addresses (SS58 format: 47-48 chars)
      const validateAddress = (addr: string) => addr && addr.length >= 47 && addr.length <= 48;

      if (!validateAddress(wallets.devSolana) || !validateAddress(wallets.devLunes)) {
        throw new Error('Invalid address format. Addresses must be 47-48 characters (SS58)');
      }

      console.log('👛 Updating dev wallets:', { devSolana: wallets.devSolana, devLunes: wallets.devLunes });

      const api = (taxManagerContract as any).api as ApiPromise;
      const gasLimit = createGasLimit(api, TX_REF_TIME, TX_PROOF_SIZE);

      const result = await taxManagerContract.tx
        .updateDevWallets({ value: 0, gasLimit, storageDepositLimit: null }, wallets.devSolana, wallets.devLunes)
        .signAndSend(lunesWallet.address, { signer }, ({ status, dispatchError }) => {
          if (dispatchError) {
            throw new Error(`Transaction failed: ${dispatchError.toString()}`);
          }
          if (status.isInBlock) console.log('✅ Dev wallets update included in block');
          if (status.isFinalized) console.log('✅ Dev wallets update finalized');
        });

      await refreshStats();
      return result.toString();
    } catch (error) {
      console.error('Error updating dev wallets:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [taxManagerContract, lunesWallet, isOwner, refreshStats]);

  // Pause contract (Admin only)
  const pauseContract = useCallback(async (reason: string): Promise<string> => {
    if (!lusdtContract || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    const isAdmin = await isOwner();
    if (!isAdmin) {
      throw new Error('Unauthorized: Only owner can pause');
    }

    try {
      setLoading(true);
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      console.log('⏸️ Pausing contract:', { reason });

      const api = (lusdtContract as any).api as ApiPromise;
      const gasLimit = createGasLimit(api, TX_REF_TIME, TX_PROOF_SIZE);

      const result = await lusdtContract.tx
        .emergencyPause({ value: 0, gasLimit, storageDepositLimit: null }, reason)
        .signAndSend(lunesWallet.address, { signer }, ({ status, dispatchError }) => {
          if (dispatchError) {
            throw new Error(`Transaction failed: ${dispatchError.toString()}`);
          }
          if (status.isInBlock) console.log('✅ Pause included in block');
          if (status.isFinalized) console.log('✅ Pause finalized');
        });

      await refreshStats();
      return result.toString();
    } catch (error) {
      console.error('Error pausing contract:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [lusdtContract, lunesWallet, isOwner, refreshStats]);

  // Unpause contract (Admin only)
  const unpauseContract = useCallback(async (): Promise<string> => {
    if (!lusdtContract || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    const isAdmin = await isOwner();
    if (!isAdmin) {
      throw new Error('Unauthorized: Only owner can unpause');
    }

    try {
      setLoading(true);
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      console.log('▶️ Unpausing contract');

      const api = (lusdtContract as any).api as ApiPromise;
      const gasLimit = createGasLimit(api, TX_REF_TIME, TX_PROOF_SIZE);

      const result = await lusdtContract.tx
        .emergencyUnpause({ value: 0, gasLimit, storageDepositLimit: null })
        .signAndSend(lunesWallet.address, { signer }, ({ status, dispatchError }) => {
          if (dispatchError) {
            throw new Error(`Transaction failed: ${dispatchError.toString()}`);
          }
          if (status.isInBlock) console.log('✅ Unpause included in block');
          if (status.isFinalized) console.log('✅ Unpause finalized');
        });

      await refreshStats();
      return result.toString();
    } catch (error) {
      console.error('Error unpausing contract:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [lusdtContract, lunesWallet, isOwner, refreshStats]);

  // Get volume tier info
  const getVolumeTierInfo = useCallback((volume: string): {
    tier: 'low' | 'medium' | 'high';
    feeRate: number;
    nextTier?: string;
    progress: number;
  } => {
    const vol = parseFloat(volume);
    const config = stats.feeConfig;

    if (!config) {
      return { tier: 'low', feeRate: 60, progress: 0 };
    }

    const threshold1 = parseFloat(config.volume_threshold_1_usd);
    const threshold2 = parseFloat(config.volume_threshold_2_usd);

    if (vol <= threshold1) {
      const progress = Math.min((vol / threshold1) * 100, 100);
      return {
        tier: 'low',
        feeRate: config.low_volume_fee_bps,
        nextTier: `Médio (${threshold1.toLocaleString()} USD)`,
        progress
      };
    } else if (vol <= threshold2) {
      const progress = Math.min(((vol - threshold1) / (threshold2 - threshold1)) * 100, 100);
      return {
        tier: 'medium',
        feeRate: config.medium_volume_fee_bps,
        nextTier: `Alto (${threshold2.toLocaleString()} USD)`,
        progress
      };
    } else {
      return {
        tier: 'high',
        feeRate: config.high_volume_fee_bps,
        progress: 100
      };
    }
  }, [stats.feeConfig]);

  // Load stats on mount and when dependencies change
  useEffect(() => {
    if (lusdtContract && taxManagerContract && lunesWallet) {
      refreshStats();
    }
  }, [lusdtContract, taxManagerContract, lunesWallet, refreshStats]);

  // Roles Mapping
  const ROLE_MAP: Record<string, number> = {
    ADMIN: 0,
    PAUSER: 1,
    MINTER: 2,
    TAX_MANAGER: 3,
    OPERATOR: 1
  };

  // Grant Role
  const grantRole = useCallback(async (roleName: string, account: string): Promise<string> => {
    if (!lusdtContract || !lunesWallet) throw new Error('Contract or wallet not available');

    const roleId = ROLE_MAP[roleName];
    if (roleId === undefined) throw new Error('Invalid role');

    try {
      setLoading(true);
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      console.log(`Granting role ${roleName} (${roleId}) to ${account}`);

      const api = (lusdtContract as any).api as ApiPromise;
      const gasLimit = createGasLimit(api, TX_REF_TIME, TX_PROOF_SIZE);

      const result = await lusdtContract.tx
        .grantRole({ value: 0, gasLimit, storageDepositLimit: null }, roleId, account)
        .signAndSend(lunesWallet.address, { signer }, ({ status, dispatchError }) => {
          if (dispatchError) {
            console.error('Grant Role Error:', dispatchError.toString());
          }
          if (status.isInBlock) console.log('✅ Grant Role included in block');
        });

      return "Role granted successfully";
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [lusdtContract, lunesWallet]);

  // Revoke Role
  const revokeRole = useCallback(async (roleName: string, account: string): Promise<string> => {
    if (!lusdtContract || !lunesWallet) throw new Error('Contract not ready');

    const roleId = ROLE_MAP[roleName];
    if (roleId === undefined) throw new Error('Invalid role');

    try {
      setLoading(true);
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      console.log(`Revoking role ${roleName} (${roleId}) from ${account}`);

      const api = (lusdtContract as any).api as ApiPromise;
      const gasLimit = createGasLimit(api, TX_REF_TIME, TX_PROOF_SIZE);

      await lusdtContract.tx
        .revokeRole({ value: 0, gasLimit, storageDepositLimit: null }, roleId, account)
        .signAndSend(lunesWallet.address, { signer });

      return "Role revoked successfully";
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  }, [lusdtContract, lunesWallet]);

  return {
    // State

    loading,
    error,
    stats,
    isAdmin: isAdminRole,
    adminChecked,

    // Actions
    refreshStats,
    updateLunesPrice,
    updateFeeConfig,
    updateDistributionWallets,
    pauseContract,
    unpauseContract,
    getVolumeTierInfo,
    grantRole,
    revokeRole,
    roles: {} // Placeholder until we implementing caching
  };
}
