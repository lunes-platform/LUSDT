import { useState, useEffect, useCallback } from 'react';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { web3FromSource } from '@polkadot/extension-dapp';
import { useWallet } from '../components/WalletProvider';
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../contracts/addresses';
import { LUSDT_TOKEN_METADATA, TAX_MANAGER_METADATA } from '../contracts/metadata';
import type { LusdtTokenContract, TaxManagerContract } from '../contracts/types';

// Helper to create proper WeightV2 gas limits for contract queries/txs
function createGasLimit(api: ApiPromise, refTime: bigint, proofSize: bigint) {
  return api.registry.createType('WeightV2', { refTime, proofSize }) as any;
}

// Helper to unwrap ink! Result<T, E> output: {ok: value} or {err: ...}
function unwrapOutput(output: any): any {
  const json = output?.toJSON?.() ?? output;
  if (json && typeof json === 'object' && 'ok' in json) return json.ok;
  return json;
}

// Standard gas limits
const QUERY_REF_TIME = 5_000_000_000_000n;
const QUERY_PROOF_SIZE = 5_000_000n;
const TX_REF_TIME = 50_000_000_000n;
const TX_PROOF_SIZE = 5_000_000n;

export function useLunesContract() {
  const { lunesWallet } = useWallet();
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [lusdtContract, setLusdtContract] = useState<ContractPromise | null>(null);
  const [taxManagerContract, setTaxManagerContract] = useState<ContractPromise | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Conectar à API Polkadot
  useEffect(() => {
    const connectApi = async () => {
      if (!lunesWallet?.address) return;

      setIsConnecting(true);
      setError(null);

      try {
        console.log('🌐 Connecting to Lunes network...', NETWORK_CONFIG.lunes.rpcUrl);

        const provider = new WsProvider(NETWORK_CONFIG.lunes.rpcUrl);
        const apiInstance = await ApiPromise.create({
          provider,
          types: {
            // Tipos customizados se necessário
          }
        });

        await apiInstance.isReady;

        console.log('✅ Connected to Lunes network');

        // Inicializar contratos com metadados reais
        const lusdtContractInstance = new ContractPromise(
          apiInstance,
          LUSDT_TOKEN_METADATA,
          CONTRACT_ADDRESSES.lunes.lusdtToken
        );

        const taxManagerContractInstance = new ContractPromise(
          apiInstance,
          TAX_MANAGER_METADATA,
          CONTRACT_ADDRESSES.lunes.taxManager
        );

        setApi(apiInstance);
        setLusdtContract(lusdtContractInstance);
        setTaxManagerContract(taxManagerContractInstance);
        setIsReady(true);

        console.log('✅ Contracts initialized successfully');

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao conectar à rede Lunes';
        console.error('❌ Failed to connect to Lunes:', errorMessage);
        setError(errorMessage);
      } finally {
        setIsConnecting(false);
      }
    };

    connectApi();

    return () => {
      if (api) {
        console.log('🔌 Disconnecting from Lunes network...');
        api.disconnect();
      }
    };
  }, [lunesWallet?.address]);

  // Verificar se contrato está pausado
  const isPaused = useCallback(async (): Promise<boolean> => {
    if (!lusdtContract) {
      throw new Error('LUSDT contract not initialized');
    }

    try {
      const gasLimit = createGasLimit(api!, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const { result, output } = await lusdtContract.query.isPaused(
        lunesWallet?.address || '',
        { gasLimit, storageDepositLimit: null }
      );

      if (result.isErr) {
        throw new Error(`Contract query failed: ${result.asErr.toString()}`);
      }

      return !!unwrapOutput(output);
    } catch (error) {
      console.error('Error checking contract pause status:', error);
      return false;
    }
  }, [lusdtContract, lunesWallet?.address]);

  // Verificar se usuário é admin (has DEFAULT_ADMIN_ROLE = 0)
  const isOwner = useCallback(async (): Promise<boolean> => {
    if (!lusdtContract || !lunesWallet?.address) {
      return false;
    }

    try {
      const gasLimit = createGasLimit(api!, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const DEFAULT_ADMIN_ROLE = 0;
      const { result, output } = await lusdtContract.query.hasRole(
        lunesWallet.address,
        { gasLimit, storageDepositLimit: null },
        DEFAULT_ADMIN_ROLE,
        lunesWallet.address
      );

      if (result.isErr) {
        throw new Error(`Contract query failed: ${result.asErr.toString()}`);
      }

      // output is Result<bool, Error> — parse the inner bool
      const raw = output?.toJSON();
      // ink! returns { ok: true/false } or just true/false
      const hasRole = typeof raw === 'object' && raw !== null && 'ok' in (raw as any)
        ? (raw as any).ok
        : raw;
      console.log('🔐 isOwner check:', { address: lunesWallet.address, hasRole, raw });
      return !!hasRole;
    } catch (error) {
      console.error('Error checking owner status:', error);
      return false;
    }
  }, [lusdtContract, lunesWallet?.address]);

  // Obter saldo LUSDT
  const getLusdtBalance = useCallback(async (address?: string): Promise<string> => {
    if (!lusdtContract) {
      return '0';
    }

    try {
      const targetAddress = address || lunesWallet?.address;
      if (!targetAddress) return '0';

      const gasLimit = createGasLimit(api!, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const { result, output } = await lusdtContract.query.balanceOf(
        targetAddress,
        { gasLimit, storageDepositLimit: null },
        targetAddress
      );

      if (result.isErr) {
        throw new Error(`Contract query failed: ${result.asErr.toString()}`);
      }

      const balance = Number(unwrapOutput(output) ?? 0);
      return (balance / 1e6).toString();
    } catch (error) {
      console.error('Error getting LUSDT balance:', error);
      return '0';
    }
  }, [lusdtContract, lunesWallet?.address]);

  // Obter saldo nativo LUNES (via system.account)
  const getLunesBalance = useCallback(async (address?: string): Promise<string> => {
    if (!api) {
      return '0';
    }

    try {
      const targetAddress = address || lunesWallet?.address;
      if (!targetAddress) return '0';

      const accountInfo = await api.query.system.account(targetAddress);
      const free = (accountInfo as any).data?.free?.toBigInt?.() ?? BigInt(0);
      // LUNES tem 12 decimais
      const balance = Number(free) / 1e12;
      return balance.toString();
    } catch (error) {
      console.error('Erro ao buscar saldo LUNES:', error);
      return '0';
    }
  }, [api, lunesWallet?.address]);

  // Obter supply total
  const getTotalSupply = useCallback(async (): Promise<string> => {
    if (!lusdtContract) {
      return '0';
    }

    try {
      const gasLimit = createGasLimit(api!, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const { result, output } = await lusdtContract.query.totalSupply(
        lunesWallet?.address || '',
        { gasLimit, storageDepositLimit: null }
      );

      if (result.isErr) {
        throw new Error(`Contract query failed: ${result.asErr.toString()}`);
      }

      const supply = Number(unwrapOutput(output) ?? 0);
      return (supply / 1e6).toString();
    } catch (error) {
      console.error('Error getting total supply:', error);
      return '0';
    }
  }, [lusdtContract, lunesWallet?.address]);

  // Mint LUSDT (apenas bridge)
  const mintLusdt = useCallback(async (to: string, amount: string): Promise<string> => {
    if (!lusdtContract || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    try {
      // Verificar se é o bridge account
      const isBridgeAccount = await isOwner(); // Temporário - implementar verificação real
      if (!isBridgeAccount) {
        throw new Error('Unauthorized: Only bridge account can mint');
      }

      // Verificar se contrato não está pausado
      const paused = await isPaused();
      if (paused) {
        throw new Error('Contract is paused');
      }

      // Obter injector da carteira
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      // Converter amount para unidades mínimas
      const amountInUnits = (parseFloat(amount) * Math.pow(10, 6)).toString();

      console.log('🪙 Minting LUSDT:', { to, amount, amountInUnits });

      const gasLimit = createGasLimit(api!, TX_REF_TIME, TX_PROOF_SIZE);

      const result = await lusdtContract.tx
        .mint({ gasLimit, storageDepositLimit: null }, to, amountInUnits)
        .signAndSend(lunesWallet.address, { signer }, ({ status, events, dispatchError }) => {
          if (dispatchError) {
            throw new Error(`Transaction failed: ${dispatchError.toString()}`);
          }

          if (status.isInBlock) {
            console.log('✅ Mint transaction included in block');
          } else if (status.isFinalized) {
            console.log('✅ Mint transaction finalized');
          }
        });

      return result.toString();
    } catch (error) {
      console.error('Error minting LUSDT:', error);
      throw error;
    }
  }, [lusdtContract, lunesWallet, isPaused, isOwner]);

  // Burn LUSDT
  const burnLusdt = useCallback(async (amount: string, solanaRecipient: string): Promise<string> => {
    if (!lusdtContract || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    try {
      // Verificar se contrato não está pausado
      const paused = await isPaused();
      if (paused) {
        throw new Error('Contract is paused');
      }

      // Verificar saldo suficiente
      const balance = await getLusdtBalance(lunesWallet.address);
      if (parseFloat(balance) < parseFloat(amount)) {
        throw new Error('Insufficient LUSDT balance');
      }

      // Obter injector da carteira
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      // Converter amount para unidades mínimas
      const amountInUnits = (parseFloat(amount) * Math.pow(10, 6)).toString();

      console.log('🔥 Burning LUSDT:', { amount, solanaRecipient, amountInUnits });

      const gasLimit = createGasLimit(api!, TX_REF_TIME, TX_PROOF_SIZE);

      const result = await lusdtContract.tx
        .burn({ gasLimit, storageDepositLimit: null }, amountInUnits, solanaRecipient)
        .signAndSend(lunesWallet.address, { signer }, ({ status, events, dispatchError }) => {
          if (dispatchError) {
            throw new Error(`Transaction failed: ${dispatchError.toString()}`);
          }

          if (status.isInBlock) {
            console.log('✅ Burn transaction included in block');
          } else if (status.isFinalized) {
            console.log('✅ Burn transaction finalized');
          }
        });

      return result.toString();
    } catch (error) {
      console.error('Error burning LUSDT:', error);
      throw error;
    }
  }, [lusdtContract, lunesWallet, isPaused, getLusdtBalance]);

  // Transfer LUSDT
  const transferLusdt = useCallback(async (to: string, amount: string): Promise<string> => {
    if (!lusdtContract || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    try {
      // Verificar se contrato não está pausado
      const paused = await isPaused();
      if (paused) {
        throw new Error('Contract is paused');
      }

      // Verificar saldo suficiente
      const balance = await getLusdtBalance(lunesWallet.address);
      if (parseFloat(balance) < parseFloat(amount)) {
        throw new Error('Insufficient LUSDT balance');
      }

      // Obter injector da carteira
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      // Converter amount para unidades mínimas
      const amountInUnits = (parseFloat(amount) * Math.pow(10, 6)).toString();

      console.log('💸 Transferring LUSDT:', { to, amount, amountInUnits });

      const gasLimit = createGasLimit(api!, TX_REF_TIME, TX_PROOF_SIZE);

      const result = await lusdtContract.tx
        .transfer({ gasLimit, storageDepositLimit: null }, to, amountInUnits)
        .signAndSend(lunesWallet.address, { signer }, ({ status, events, dispatchError }) => {
          if (dispatchError) {
            throw new Error(`Transaction failed: ${dispatchError.toString()}`);
          }

          if (status.isInBlock) {
            console.log('✅ Transfer transaction included in block');
          } else if (status.isFinalized) {
            console.log('✅ Transfer transaction finalized');
          }
        });

      return result.toString();
    } catch (error) {
      console.error('Error transferring LUSDT:', error);
      throw error;
    }
  }, [lusdtContract, lunesWallet, isPaused, getLusdtBalance]);

  // Admin: Pausar contrato
  const pauseContract = useCallback(async (): Promise<string> => {
    if (!lusdtContract || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    try {
      const isBridgeOwner = await isOwner();
      if (!isBridgeOwner) {
        throw new Error('Unauthorized: Only owner can pause contract');
      }

      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      console.log('⏸️ Pausing contract...');

      const gasLimit = createGasLimit(api!, TX_REF_TIME, TX_PROOF_SIZE);

      const result = await lusdtContract.tx
        .pause({ gasLimit, storageDepositLimit: null })
        .signAndSend(lunesWallet.address, { signer }, ({ status, dispatchError }) => {
          if (dispatchError) {
            throw new Error(`Transaction failed: ${dispatchError.toString()}`);
          }
          if (status.isInBlock) console.log('✅ Pause transaction included in block');
          else if (status.isFinalized) console.log('✅ Pause transaction finalized');
        });

      return result.toString();
    } catch (error) {
      console.error('Error pausing contract:', error);
      throw error;
    }
  }, [lusdtContract, lunesWallet, isOwner]);

  // Admin: Despausar contrato
  const unpauseContract = useCallback(async (): Promise<string> => {
    if (!lusdtContract || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    try {
      const isBridgeOwner = await isOwner();
      if (!isBridgeOwner) {
        throw new Error('Unauthorized: Only owner can unpause contract');
      }

      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      console.log('▶️ Unpausing contract...');

      const gasLimit = createGasLimit(api!, TX_REF_TIME, TX_PROOF_SIZE);

      const result = await lusdtContract.tx
        .unpause({ gasLimit, storageDepositLimit: null })
        .signAndSend(lunesWallet.address, { signer }, ({ status, dispatchError }) => {
          if (dispatchError) {
            throw new Error(`Transaction failed: ${dispatchError.toString()}`);
          }
          if (status.isInBlock) console.log('✅ Unpause transaction included in block');
          else if (status.isFinalized) console.log('✅ Unpause transaction finalized');
        });

      return result.toString();
    } catch (error) {
      console.error('Error unpausing contract:', error);
      throw error;
    }
  }, [lusdtContract, lunesWallet, isOwner]);

  // Obter preço do LUNES
  const getLunesPrice = useCallback(async (): Promise<string> => {
    if (!taxManagerContract) {
      return '0'; // No contract — return zero, not fake data
    }

    try {
      const gasLimit = createGasLimit(api!, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const { result, output } = await taxManagerContract.query.getLunesPrice(
        lunesWallet?.address || '',
        { gasLimit, storageDepositLimit: null }
      );

      if (result.isErr) {
        throw new Error(`Contract query failed: ${result.asErr.toString()}`);
      }

      const price = Number(unwrapOutput(output) ?? 0);
      return (price / 1e6).toString();
    } catch (error) {
      console.error('Error getting Lunes price:', error);
      return '0'; // Error — return zero, not fake data
    }
  }, [taxManagerContract, lunesWallet?.address]);

  // Obter taxa atual
  const getCurrentFeeBps = useCallback(async (): Promise<number> => {
    if (!taxManagerContract) {
      return 0; // No contract — return zero, not fake data
    }

    try {
      const gasLimit = createGasLimit(api!, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const { result, output } = await taxManagerContract.query.getCurrentFeeBps(
        lunesWallet?.address || '',
        { gasLimit, storageDepositLimit: null }
      );

      if (result.isErr) {
        throw new Error(`Contract query failed: ${result.asErr.toString()}`);
      }

      return Number(unwrapOutput(output) ?? 60);
    } catch (error) {
      console.error('Error getting current fee:', error);
      return 0; // Error — return zero
    }
  }, [taxManagerContract, lunesWallet?.address]);

  // Obter volume mensal
  const getMonthlyVolume = useCallback(async (): Promise<string> => {
    if (!taxManagerContract) {
      return '0'; // No contract — return zero, not fake data
    }

    try {
      const gasLimit = createGasLimit(api!, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const { result, output } = await taxManagerContract.query.getMonthlyVolumeUsd(
        lunesWallet?.address || '',
        { gasLimit, storageDepositLimit: null }
      );

      if (result.isErr) {
        throw new Error(`Contract query failed: ${result.asErr.toString()}`);
      }

      const volume = Number(unwrapOutput(output) ?? 0);
      return (volume / 1e6).toString();
    } catch (error) {
      console.error('Error getting monthly volume:', error);
      return '0'; // Error — return zero
    }
  }, [taxManagerContract, lunesWallet?.address]);

  // === APPROVAL FUNCTIONS FOR TAX MANAGER ===
  // Users must approve Tax Manager to spend their LUNES (burn fee) and LUSDT (burn operation fee).
  // Without approvals, Tax Manager's transfer_from calls will fail.

  // Check current allowances for Tax Manager
  const checkTaxManagerApproval = useCallback(async (): Promise<{
    lusdtAllowance: string;
    lunesAllowance: string;
    lusdtApproved: boolean;
    lunesApproved: boolean;
  }> => {
    const defaultResult = { lusdtAllowance: '0', lunesAllowance: '0', lusdtApproved: false, lunesApproved: false };
    if (!lusdtContract || !lunesWallet?.address) return defaultResult;

    try {
      const gasLimit = createGasLimit(api!, QUERY_REF_TIME, QUERY_PROOF_SIZE);
      const taxManagerAddr = CONTRACT_ADDRESSES.lunes.taxManager;

      // Query LUSDT allowance for Tax Manager
      const { result: lusdtResult, output: lusdtOutput } = await lusdtContract.query.allowance(
        lunesWallet.address,
        { gasLimit, storageDepositLimit: null },
        lunesWallet.address,
        taxManagerAddr
      );

      let lusdtAllowance = '0';
      if (lusdtResult.isOk && lusdtOutput) {
        const raw = Number(unwrapOutput(lusdtOutput) ?? 0);
        lusdtAllowance = (raw / 1e6).toFixed(6);
      }

      // For LUNES native token approval, we'd need the LUNES PSP22 contract
      // For now, check if the LUNES token contract is available
      let lunesAllowance = '0';
      // LUNES token is a separate PSP22 contract — query if address is configured
      const lunesTokenAddr = CONTRACT_ADDRESSES.lunes.lunesToken;
      if (lunesTokenAddr && lunesTokenAddr !== taxManagerAddr) {
        try {
          // Create a minimal PSP22 query using the LUSDT ABI (same PSP22 interface)
          const lunesTokenContract = new ContractPromise(api!, LUSDT_TOKEN_METADATA, lunesTokenAddr);
          const { result: lunesResult, output: lunesOutput } = await lunesTokenContract.query.allowance(
            lunesWallet.address,
            { gasLimit, storageDepositLimit: null },
            lunesWallet.address,
            taxManagerAddr
          );

          if (lunesResult.isOk && lunesOutput) {
            const raw = Number(unwrapOutput(lunesOutput) ?? 0);
            lunesAllowance = (raw / 1e12).toFixed(6); // LUNES uses 12 decimals
          }
        } catch (e) {
          console.warn('Could not query LUNES allowance:', e);
        }
      }

      // Consider "approved" if allowance > 1000 tokens (sufficient for normal operations)
      const lusdtApproved = parseFloat(lusdtAllowance) > 1000;
      const lunesApproved = parseFloat(lunesAllowance) > 100;

      console.log('🔐 Tax Manager approvals:', { lusdtAllowance, lunesAllowance, lusdtApproved, lunesApproved });
      return { lusdtAllowance, lunesAllowance, lusdtApproved, lunesApproved };
    } catch (error) {
      console.error('Error checking Tax Manager approval:', error);
      return defaultResult;
    }
  }, [lusdtContract, lunesWallet?.address, api]);

  // Approve Tax Manager to spend LUSDT (needed for burn: LUSDT fee)
  const approveLusdtForTaxManager = useCallback(async (amount?: string): Promise<string> => {
    if (!lusdtContract || !lunesWallet) {
      throw new Error('Contract or wallet not available');
    }

    try {
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      // Default: approve max u128 (unlimited) — standard DeFi pattern
      const approveAmount = amount
        ? (parseFloat(amount) * 1e6).toString()
        : '340282366920938463463374607431768211455'; // u128::MAX

      const gasLimit = createGasLimit(api!, TX_REF_TIME, TX_PROOF_SIZE);
      const taxManagerAddr = CONTRACT_ADDRESSES.lunes.taxManager;

      console.log('✅ Approving Tax Manager for LUSDT:', { spender: taxManagerAddr, amount: approveAmount });

      const result = await lusdtContract.tx
        .approve({ gasLimit, storageDepositLimit: null }, taxManagerAddr, approveAmount)
        .signAndSend(lunesWallet.address, { signer }, ({ status }) => {
          if (status.isInBlock) console.log('✅ LUSDT approval included in block');
          else if (status.isFinalized) console.log('✅ LUSDT approval finalized');
        });

      return result.toString();
    } catch (error) {
      console.error('Error approving LUSDT for Tax Manager:', error);
      throw error;
    }
  }, [lusdtContract, lunesWallet, api]);

  // Approve Tax Manager to spend LUNES (needed for burn fee on both mint and burn)
  const approveLunesForTaxManager = useCallback(async (amount?: string): Promise<string> => {
    if (!api || !lunesWallet) {
      throw new Error('API or wallet not available');
    }

    try {
      const injector = await web3FromSource(lunesWallet.source || 'polkadot-js');
      const { signer } = injector;

      // LUNES token uses 12 decimals
      const approveAmount = amount
        ? (parseFloat(amount) * 1e12).toString()
        : '340282366920938463463374607431768211455'; // u128::MAX

      const gasLimit = createGasLimit(api, TX_REF_TIME, TX_PROOF_SIZE);
      const taxManagerAddr = CONTRACT_ADDRESSES.lunes.taxManager;
      const lunesTokenAddr = CONTRACT_ADDRESSES.lunes.lunesToken;

      // Create LUNES PSP22 contract reference (same PSP22 interface as LUSDT)
      const lunesTokenContract = new ContractPromise(api, LUSDT_TOKEN_METADATA, lunesTokenAddr);

      console.log('✅ Approving Tax Manager for LUNES:', { spender: taxManagerAddr, amount: approveAmount });

      const result = await lunesTokenContract.tx
        .approve({ gasLimit, storageDepositLimit: null }, taxManagerAddr, approveAmount)
        .signAndSend(lunesWallet.address, { signer }, ({ status }) => {
          if (status.isInBlock) console.log('✅ LUNES approval included in block');
          else if (status.isFinalized) console.log('✅ LUNES approval finalized');
        });

      return result.toString();
    } catch (error) {
      console.error('Error approving LUNES for Tax Manager:', error);
      throw error;
    }
  }, [api, lunesWallet]);

  // Calcular taxa baseada no volume
  // v3 model: dual-fee — USDT/LUSDT stablecoin fee + LUNES burn fee
  const calculateFee = useCallback(async (amount: string): Promise<{
    feeAmount: string;
    feeCurrency: string;
    netAmount: string;
    feePercentBps: number;
    volumeTier: 'low' | 'medium' | 'high';
  }> => {
    try {
      const amountNum = parseFloat(amount);
      const [feeRate, monthlyVolume] = await Promise.all([
        getCurrentFeeBps(),
        getMonthlyVolume()
      ]);

      // Determinar tier baseado no volume mensal
      let volumeTier: 'low' | 'medium' | 'high';
      if (parseFloat(monthlyVolume) <= 10000) {
        volumeTier = 'low';
      } else if (parseFloat(monthlyVolume) <= 100000) {
        volumeTier = 'medium';
      } else {
        volumeTier = 'high';
      }

      // Calcular taxa em USD (mesma moeda da transação)
      const feeAmount = amountNum * feeRate / 10000;
      const netAmount = amountNum - feeAmount;

      return {
        feeAmount: feeAmount.toFixed(6),
        feeCurrency: 'USD',
        netAmount: netAmount.toFixed(6),
        feePercentBps: feeRate,
        volumeTier
      };
    } catch (error) {
      console.error('Error calculating fee:', error);
      return {
        feeAmount: '0',
        feeCurrency: 'USD',
        netAmount: amount,
        feePercentBps: 0,
        volumeTier: 'low'
      };
    }
  }, [getCurrentFeeBps, getMonthlyVolume]);

  return {
    // Estado da conexão
    api,
    isConnected: !!api && !!lusdtContract && !!taxManagerContract,
    isConnecting,
    isReady,
    error,

    // Funções LUSDT
    getLunesBalance,
    getLusdtBalance,
    getTotalSupply,
    mintLusdt,
    burnLusdt,
    transferLusdt,

    // Funções administrativas
    isPaused,
    isOwner,

    // Funções Tax Manager
    getLunesPrice,
    getCurrentFeeBps,
    getMonthlyVolume,
    calculateFee,

    // Approval functions (v3: required for Tax Manager fee collection)
    checkTaxManagerApproval,
    approveLusdtForTaxManager,
    approveLunesForTaxManager,

    // Contratos (para uso avançado)
    lusdtContract,
    taxManagerContract,
  };
}