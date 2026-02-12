import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { ContractPromise, Abi } from '@polkadot/api-contract';
import { KeyringPair } from '@polkadot/keyring/types';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';

export interface LunesTransfer {
  amount: number;
  from: string;
  to: string;
  blockHash?: string;
  txHash?: string;
  timestamp: Date;
}

export interface ContractCall {
  method: string;
  args: any[];
  value?: number;
}

export class LunesClient {
  private api!: ApiPromise;
  private keyring: Keyring;
  private account!: KeyringPair;
  private contract!: ContractPromise;
  private taxManagerContract: ContractPromise | null = null;
  private provider!: WsProvider;

  // LUSDT uses 6 decimals (USDT-compatible)
  private static readonly LUSDT_DECIMALS = 6;
  private static readonly LUSDT_MULTIPLIER = 10 ** LunesClient.LUSDT_DECIMALS;

  // Default fallback fee in case Tax Manager query fails
  private static readonly DEFAULT_FEE_BPS = 60;

  constructor(
    private rpcUrl: string,
    private walletSeed: string,
    private contractAddress: string
  ) {
    this.keyring = new Keyring({ type: 'sr25519' });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🔗 Initializing Lunes client...');

      // Conecta ao node
      this.provider = new WsProvider(this.rpcUrl);
      this.api = await ApiPromise.create({ provider: this.provider });

      await this.api.isReady;
      logger.info('✅ Connected to Lunes network');

      // Carrega conta (suporta mnemonic e dev URIs como //Alice)
      if (this.walletSeed.startsWith('//')) {
        this.account = this.keyring.addFromUri(this.walletSeed);
      } else {
        this.account = this.keyring.addFromMnemonic(this.walletSeed);
      }
      logger.info('🔑 Wallet loaded', { address: this.account.address });

      // Verifica saldo
      const balance = await this.getBalance();
      logger.info('💰 Lunes wallet balance', {
        address: this.account.address,
        balance: balance
      });

      // Carrega contrato LUSDT (vai precisar do ABI)
      try {
        await this.loadContract();
        logger.info('📋 LUSDT contract loaded', { address: this.contractAddress });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('⚠️  Could not load contract (may not be deployed yet)', { error: message });
      }

      // Carrega contrato Tax Manager para consultas de fee dinâmica
      try {
        await this.loadTaxManagerContract();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('⚠️  Could not load Tax Manager contract (will use fallback fee)', { error: message });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to initialize Lunes client', {
        error: message,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private contractAbi!: Abi;

  private async loadContract(): Promise<void> {
    // Carrega ABI do arquivo .contract compilado
    const abiPath = config.LUSDT_CONTRACT_ABI_PATH
      || path.resolve(__dirname, '../../../contracts/lusdt_token/target/ink/lusdt_token.contract');

    let contractJson: any;

    if (fs.existsSync(abiPath)) {
      const raw = fs.readFileSync(abiPath, 'utf8');
      contractJson = JSON.parse(raw);
      logger.info('📋 Loaded contract ABI from file', { path: abiPath });
    } else {
      // Fallback: tenta o target/ink no root do monorepo
      const fallbackPath = path.resolve(__dirname, '../../../../target/ink/lusdt_token/lusdt_token.contract');
      if (fs.existsSync(fallbackPath)) {
        const raw = fs.readFileSync(fallbackPath, 'utf8');
        contractJson = JSON.parse(raw);
        logger.info('📋 Loaded contract ABI from fallback', { path: fallbackPath });
      } else {
        throw new Error(`Contract ABI not found at ${abiPath} or ${fallbackPath}. Build with: cd contracts/lusdt_token && cargo contract build --release`);
      }
    }

    this.contractAbi = new Abi(contractJson, this.api.registry.getChainProperties());
    this.contract = new ContractPromise(this.api, this.contractAbi, this.contractAddress);
    logger.info('✅ Contract loaded with real ABI', {
      messages: this.contractAbi.messages.map(m => m.method).join(', ')
    });
  }

  private async loadTaxManagerContract(): Promise<void> {
    const taxManagerAddress = config.TAX_MANAGER_CONTRACT_ADDRESS;
    if (!taxManagerAddress) {
      logger.warn('⚠️  TAX_MANAGER_CONTRACT_ADDRESS not configured, dynamic fee disabled');
      return;
    }

    const abiPath = config.TAX_MANAGER_CONTRACT_ABI_PATH
      || path.resolve(__dirname, '../../../contracts/tax_manager/target/ink/tax_manager.contract');

    let contractJson: any;

    if (fs.existsSync(abiPath)) {
      const raw = fs.readFileSync(abiPath, 'utf8');
      contractJson = JSON.parse(raw);
    } else {
      const fallbackPath = path.resolve(__dirname, '../../../../target/ink/tax_manager/tax_manager.contract');
      if (fs.existsSync(fallbackPath)) {
        const raw = fs.readFileSync(fallbackPath, 'utf8');
        contractJson = JSON.parse(raw);
      } else {
        throw new Error(`Tax Manager ABI not found at ${abiPath} or ${fallbackPath}`);
      }
    }

    const abi = new Abi(contractJson, this.api.registry.getChainProperties());
    this.taxManagerContract = new ContractPromise(this.api, abi, taxManagerAddress);
    logger.info('📋 Tax Manager contract loaded', {
      address: taxManagerAddress,
      messages: abi.messages.map(m => m.method).join(', ')
    });
  }

  /**
   * Query Tax Manager for current adaptive fee rate (bps).
   * Returns the fee based on monthly volume tier:
   *   - ≤ $10K: 60 bps (0.60%)
   *   - $10K-$100K: 50 bps (0.50%)
   *   - > $100K: 30 bps (0.30%)
   * Falls back to DEFAULT_FEE_BPS (60) if query fails.
   */
  async queryTaxManagerFeeBps(): Promise<number> {
    try {
      if (!this.taxManagerContract) {
        logger.debug('Tax Manager contract not loaded, using fallback fee');
        return LunesClient.DEFAULT_FEE_BPS;
      }

      const gasLimit = this.api.registry.createType('WeightV2', {
        refTime: 5_000_000_000_000n,
        proofSize: 5_000_000n
      }) as any;

      const result = await this.taxManagerContract.query.getCurrentFeeBps(
        this.account.address,
        { gasLimit, storageDepositLimit: null }
      );

      if (result.result.isOk && result.output) {
        const feeBps = parseInt(result.output.toString(), 10);
        if (feeBps > 0 && feeBps <= 1000) { // sanity check: max 10%
          logger.info('📊 Tax Manager fee queried', { feeBps });
          return feeBps;
        }
      }

      logger.warn('⚠️  Tax Manager fee query returned invalid value, using fallback');
      return LunesClient.DEFAULT_FEE_BPS;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('⚠️  Tax Manager fee query failed, using fallback', { error: message });
      return LunesClient.DEFAULT_FEE_BPS;
    }
  }

  async getTotalSupply(): Promise<number> {
    try {
      if (!this.contract) {
        throw new Error('Contract not loaded');
      }

      // Estima gas para leitura
      const gasLimit = this.api.registry.createType('WeightV2', {
        refTime: 10_000_000_000,
        proofSize: 10_000
      }) as any;

      // Chama total_supply (query)
      const result = await this.contract.query.totalSupply(
        this.account.address,
        { gasLimit, storageDepositLimit: null }
      );

      if (result.result.isOk && result.output) {
        const supply = result.output.toString();
        return parseFloat(supply) / LunesClient.LUSDT_MULTIPLIER;
      }

      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error getting total supply', { error: message });
      return 0;
    }
  }

  async getBalance(address?: string): Promise<number> {
    try {
      const account = address || this.account.address;
      const balance = await this.api.query.system.account(account);
      const free = (balance as any)?.data?.free;
      if (!free) return 0;
      return parseFloat(free.toString()) / 1e12; // Convert to LUNES
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error getting balance', { address, error: message });
      return 0;
    }
  }

  async mintLUSDT(recipient: string, amount: number): Promise<string> {
    try {
      logger.info('🪙 Minting LUSDT', { recipient, amount });

      if (!this.contract) {
        throw new Error('Contract not loaded');
      }

      // Estima gas
      const gasLimit = this.api.registry.createType('WeightV2', {
        refTime: 100_000_000_000,
        proofSize: 100_000
      }) as any;

      // Chama mint
      const result = await this.contract.tx
        .mint({
          gasLimit,
          storageDepositLimit: null
        }, recipient, Math.round(amount * LunesClient.LUSDT_MULTIPLIER)) // Convert to smallest unit
        .signAndSend(this.account);

      logger.info('✅ LUSDT mint transaction sent', {
        txHash: result.toString(),
        recipient,
        amount
      });

      return result.toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ LUSDT mint failed', {
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
        recipient,
        amount
      });
      throw error;
    }
  }

  async burnLUSDT(amount: number, solanaRecipient: string): Promise<string> {
    try {
      logger.info('🔥 Burning LUSDT', { amount, solanaRecipient });

      if (!this.contract) {
        throw new Error('Contract not loaded');
      }

      const gasLimit = this.api.registry.createType('WeightV2', {
        refTime: 100_000_000_000,
        proofSize: 100_000
      }) as any;

      const result = await this.contract.tx
        .burn({
          gasLimit,
          storageDepositLimit: null
        }, Math.round(amount * LunesClient.LUSDT_MULTIPLIER), solanaRecipient)
        .signAndSend(this.account);

      logger.info('✅ LUSDT burn transaction sent', {
        txHash: result.toString(),
        amount,
        solanaRecipient
      });

      return result.toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ LUSDT burn failed', {
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
        amount,
        solanaRecipient
      });
      throw error;
    }
  }

  async watchForBurnEvents(callback: (event: LunesTransfer) => void): Promise<void> {
    logger.info('👀 Starting to watch for LUSDT burn events...');

    // Subscribe to contract events
    this.api.query.system.events((events: any) => {
      events.forEach((record: any) => {
        const { event } = record;

        if (event.section === 'contracts' && event.method === 'ContractEmitted') {
          try {
            const [contractAddress, eventData] = event.data;

            if (contractAddress.toString() === this.contractAddress) {
              // Decodifica o evento usando o ABI real
              try {
                const decoded = this.contractAbi.decodeEvent(eventData);
                const eventName = decoded.event.identifier;

                logger.info('📨 Contract event decoded', {
                  event: eventName,
                  args: decoded.args.map(a => a.toString())
                });

                // RedemptionRequested = evento de burn (pedido de resgate para Solana)
                if (eventName === 'RedemptionRequested') {
                  const from = decoded.args[0]?.toString() || '';
                  const rawAmount = decoded.args[1]?.toString() || '0';
                  const solanaRecipient = decoded.args[2]?.toString() || '';
                  const amount = parseFloat(rawAmount) / LunesClient.LUSDT_MULTIPLIER;

                  logger.info('🔥 Burn/Redemption event detected', {
                    from,
                    amount,
                    solanaRecipient
                  });

                  callback({
                    amount,
                    from,
                    to: solanaRecipient,
                    timestamp: new Date()
                  });
                }
              } catch (decodeErr) {
                // Fallback: log raw event se decode falhar
                logger.debug('Contract event (raw)', { eventData: eventData.toString() });
              }
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Error processing contract event', {
              error: message,
              stack: error instanceof Error ? error.stack : undefined
            });
          }
        }
      });
    });
  }

  async getTransactionDetails(txHash: string): Promise<any> {
    try {
      const blockHash = await this.api.rpc.chain.getBlockHash();
      const block = await this.api.rpc.chain.getBlock(blockHash);

      const transaction = block.block.extrinsics.find(ext =>
        ext.hash.toString() === txHash
      );

      return transaction ? transaction.toHuman() : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error getting transaction details', { txHash, error: message });
      throw error;
    }
  }

  async isTransactionFinalized(txHash: string): Promise<boolean> {
    try {
      // In Substrate, we typically check if the transaction is in a finalized block
      const finalizedHead = await this.api.rpc.chain.getFinalizedHead();
      const finalizedBlock = await this.api.rpc.chain.getBlock(finalizedHead);

      const isInBlock = finalizedBlock.block.extrinsics.some(ext =>
        ext.hash.toString() === txHash
      );

      return !!isInBlock;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error checking transaction finalization', {
        txHash,
        error: message,
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  async getLUSDTBalance(address?: string): Promise<number> {
    try {
      if (!this.contract) {
        throw new Error('Contract not loaded');
      }

      const account = address || this.account.address;

      // Query balance method on contract
      const gasLimit = this.api.registry.createType('WeightV2', {
        refTime: 10_000_000_000,
        proofSize: 10_000
      }) as any;

      const result = await this.contract.query.balanceOf(
        account,
        { gasLimit, storageDepositLimit: null },
        account
      );

      if (result.result.isOk) {
        const balance = result.output?.toString() || '0';
        return parseFloat(balance) / LunesClient.LUSDT_MULTIPLIER; // Convert from smallest unit
      }

      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error getting LUSDT balance', { address, error: message });
      return 0;
    }
  }

  getAddress(): string {
    return this.account.address;
  }

  async getNetworkInfo(): Promise<any> {
    try {
      const [chain, nodeName, nodeVersion, properties] = await Promise.all([
        this.api.rpc.system.chain(),
        this.api.rpc.system.name(),
        this.api.rpc.system.version(),
        this.api.rpc.system.properties()
      ]);

      return {
        chain: chain.toString(),
        nodeName: nodeName.toString(),
        nodeVersion: nodeVersion.toString(),
        properties: properties.toString(),
        endpoint: this.rpcUrl
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error getting network info', {
        error: message,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
      logger.info('📴 Disconnected from Lunes network');
    }
  }
}