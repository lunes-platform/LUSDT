import { useState, useEffect, useCallback } from 'react';
import { ApiPromise } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { web3FromSource } from '@polkadot/extension-dapp';
import { useWallet } from '../components/WalletProvider';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';
import { LUSDT_TOKEN_METADATA, STAKING_MANAGER_METADATA } from '../contracts/metadata';
import type { StakerInfo } from '../contracts/types';

// Gas limits for contract queries and transactions
const QUERY_REF_TIME = 5_000_000_000_000n;
const QUERY_PROOF_SIZE = 5_000_000n;
const TX_REF_TIME = 50_000_000_000n;
const TX_PROOF_SIZE = 5_000_000n;

// LUNES uses 12 decimals on native chain
const LUNES_DECIMALS = 12;
// LUSDT uses 6 decimals
const LUSDT_DECIMALS = 6;

function createGasLimit(api: ApiPromise, refTime: bigint, proofSize: bigint) {
  return api.registry.createType('WeightV2', { refTime, proofSize }) as any;
}

function unwrapOutput(output: any): any {
  const json = output?.toJSON?.() ?? output;
  if (json && typeof json === 'object' && 'ok' in json) return json.ok;
  return json;
}

export interface StakingContractState {
  isAvailable: boolean;
  totalStaked: number;       // LUNES (human-readable)
  stakerCount: number;
  totalRewardsDeposited: number; // LUSDT
  undistributedRewards: number;  // LUSDT
  minStake: number;          // LUNES
  isPaused: boolean;
  // Current user state
  userStaked: number;        // LUNES
  userPendingRewards: number; // LUSDT
  userStakedAt: number;      // timestamp
  isUserStaking: boolean;
}

export function useStakingContract(api: ApiPromise | null) {
  const { lunesWallet } = useWallet();
  const [stakingContract, setStakingContract] = useState<ContractPromise | null>(null);
  const [state, setState] = useState<StakingContractState>({
    isAvailable: false,
    totalStaked: 0,
    stakerCount: 0,
    totalRewardsDeposited: 0,
    undistributedRewards: 0,
    minStake: 100_000,
    isPaused: false,
    userStaked: 0,
    userPendingRewards: 0,
    userStakedAt: 0,
    isUserStaking: false,
  });
  const [loading, setLoading] = useState(false);

  // Initialize staking contract when API is available
  useEffect(() => {
    if (!api) return;
    const stakingAddr = CONTRACT_ADDRESSES.lunes.stakingManager;
    if (!stakingAddr) {
      setState(prev => ({ ...prev, isAvailable: false }));
      return;
    }

    try {
      const contract = new ContractPromise(api, STAKING_MANAGER_METADATA, stakingAddr);
      setStakingContract(contract);
      setState(prev => ({ ...prev, isAvailable: true }));
      console.log('✅ StakingManager contract initialized:', stakingAddr);
    } catch (e) {
      console.warn('⚠️ StakingManager contract not available:', e);
      setState(prev => ({ ...prev, isAvailable: false }));
    }
  }, [api]);

  // ─── Query Functions ──────────────────────────────────────────

  const queryContract = useCallback(async (
    methodName: string,
    ...args: any[]
  ): Promise<any> => {
    if (!stakingContract || !api) return null;
    try {
      const gasLimit = createGasLimit(api, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const callerAddr = lunesWallet?.address || '';
      const method = (stakingContract.query as any)[methodName];
      if (!method) return null;

      const { result, output } = await method(
        callerAddr,
        { gasLimit, storageDepositLimit: null },
        ...args,
      );

      if (result.isErr) return null;
      return unwrapOutput(output);
    } catch (e) {
      console.warn(`StakingContract query ${methodName} failed:`, e);
      return null;
    }
  }, [stakingContract, api, lunesWallet?.address]);

  // Load all staking data
  const loadStakingData = useCallback(async () => {
    if (!stakingContract || !api) return;
    setLoading(true);

    try {
      const [
        totalStakedRaw,
        stakerCount,
        totalRewardsRaw,
        undistributedRaw,
        minStakeRaw,
        paused,
      ] = await Promise.all([
        queryContract('getTotalStaked'),
        queryContract('getStakerCount'),
        queryContract('getTotalRewardsDeposited'),
        queryContract('getUndistributedRewards'),
        queryContract('getMinStake'),
        queryContract('isPaused'),
      ]);

      let userStaked = 0;
      let userPendingRewards = 0;
      let userStakedAt = 0;

      if (lunesWallet?.address) {
        const [stakerInfo, pendingRaw] = await Promise.all([
          queryContract('getStakerInfo', lunesWallet.address),
          queryContract('getPendingRewards', lunesWallet.address),
        ]);

        if (stakerInfo) {
          userStaked = Number(stakerInfo.amount ?? 0) / Math.pow(10, LUNES_DECIMALS);
          userStakedAt = Number(stakerInfo.stakedAt ?? 0);
        }
        if (pendingRaw !== null) {
          userPendingRewards = Number(pendingRaw) / Math.pow(10, LUSDT_DECIMALS);
        }
      }

      setState({
        isAvailable: true,
        totalStaked: Number(totalStakedRaw ?? 0) / Math.pow(10, LUNES_DECIMALS),
        stakerCount: Number(stakerCount ?? 0),
        totalRewardsDeposited: Number(totalRewardsRaw ?? 0) / Math.pow(10, LUSDT_DECIMALS),
        undistributedRewards: Number(undistributedRaw ?? 0) / Math.pow(10, LUSDT_DECIMALS),
        minStake: Number(minStakeRaw ?? 0) / Math.pow(10, LUNES_DECIMALS),
        isPaused: !!paused,
        userStaked,
        userPendingRewards,
        userStakedAt,
        isUserStaking: userStaked > 0,
      });
    } catch (e) {
      console.error('Failed to load staking data:', e);
    } finally {
      setLoading(false);
    }
  }, [stakingContract, api, lunesWallet?.address, queryContract]);

  // ─── Transaction Functions ────────────────────────────────────

  const sendTx = useCallback(async (methodName: string, ...args: any[]): Promise<string> => {
    if (!stakingContract || !api || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
    const { signer } = injector;
    const gasLimit = createGasLimit(api, TX_REF_TIME, TX_PROOF_SIZE);
    const method = (stakingContract.tx as any)[methodName];
    if (!method) throw new Error(`Method ${methodName} not found`);

    const result = await method(
      { gasLimit, storageDepositLimit: null },
      ...args,
    ).signAndSend(lunesWallet.address, { signer }, ({ status, dispatchError }: any) => {
      if (dispatchError) {
        throw new Error(`Transaction failed: ${dispatchError.toString()}`);
      }
      if (status.isInBlock) {
        console.log(`✅ ${methodName} included in block`);
      } else if (status.isFinalized) {
        console.log(`✅ ${methodName} finalized`);
      }
    });

    return result.toString();
  }, [stakingContract, api, lunesWallet]);

  // Approve LUNES spending by StakingManager, then stake
  const stake = useCallback(async (amountHuman: number): Promise<string> => {
    if (!api || !lunesWallet) throw new Error('Not connected');

    const amountRaw = BigInt(Math.floor(amountHuman * Math.pow(10, LUNES_DECIMALS))).toString();
    const stakingAddr = CONTRACT_ADDRESSES.lunes.stakingManager;

    // Step 1: Approve StakingManager to spend LUNES
    const lunesTokenAddr = CONTRACT_ADDRESSES.lunes.lunesToken;
    if (lunesTokenAddr) {
      const lunesTokenContract = new ContractPromise(api, LUSDT_TOKEN_METADATA, lunesTokenAddr);
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const gasLimit = createGasLimit(api, TX_REF_TIME, TX_PROOF_SIZE);
      const maxApproval = '340282366920938463463374607431768211455'; // u128::MAX

      await lunesTokenContract.tx
        .approve({ gasLimit, storageDepositLimit: null }, stakingAddr, maxApproval)
        .signAndSend(lunesWallet.address, { signer: injector.signer }, ({ status }: any) => {
          if (status.isInBlock) console.log('✅ LUNES approval for staking included in block');
        });
    }

    // Step 2: Call stake on StakingManager
    const result = await sendTx('stake', amountRaw);
    await loadStakingData();
    return result;
  }, [api, lunesWallet, sendTx, loadStakingData]);

  const unstake = useCallback(async (): Promise<string> => {
    const result = await sendTx('unstake');
    await loadStakingData();
    return result;
  }, [sendTx, loadStakingData]);

  const claimRewards = useCallback(async (): Promise<string> => {
    const result = await sendTx('claimRewards');
    await loadStakingData();
    return result;
  }, [sendTx, loadStakingData]);

  return {
    ...state,
    loading,
    loadStakingData,
    stake,
    unstake,
    claimRewards,
  };
}
