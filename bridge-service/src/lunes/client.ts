import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { KeyringPair } from '@polkadot/keyring/types';
import { WeightV2 } from '@polkadot/types/interfaces';
import { logger } from '../utils/logger';
import { config } from '../config/env';

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
  private api: ApiPromise;
  private keyring: Keyring;
  private account: KeyringPair;
  private contract: ContractPromise;
  private provider: WsProvider;

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

      // Carrega conta
      this.account = this.keyring.addFromMnemonic(this.walletSeed);
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
        logger.warn('⚠️  Could not load contract (may not be deployed yet)', { error: error.message });
      }

    } catch (error) {
      logger.error('❌ Failed to initialize Lunes client', error);
      throw error;
    }
  }

  private async loadContract(): Promise<void> {
    // Aqui você precisaria do ABI do contrato LUSDT
    // Por enquanto, vamos usar um placeholder
    const contractABI = {
      source: {
        hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        language: "ink! 5.1.1",
        compiler: "rustc 1.88.0"
      },
      contract: {
        name: "lusdt_token",
        version: "0.1.0",
        authors: ["Bridge Service"]
      },
      spec: {
        constructors: [],
        docs: [],
        events: [],
        lang_error: { displayName: ["ink", "LangError"], type: 4 },
        messages: [
          {
            args: [
              { label: "to", type: { displayName: ["AccountId"], type: 0 } },
              { label: "amount", type: { displayName: ["Balance"], type: 1 } }
            ],
            default: false,
            docs: [],
            label: "mint",
            mutates: true,
            payable: false,
            returnType: { displayName: ["Result"], type: 2 },
            selector: "0x94e6348f"
          },
          {
            args: [
              { label: "amount", type: { displayName: ["Balance"], type: 1 } },
              { label: "solana_recipient_address", type: { displayName: ["String"], type: 3 } }
            ],
            default: false,
            docs: [],
            label: "burn",
            mutates: true,
            payable: false,
            returnType: { displayName: ["Result"], type: 2 },
            selector: "0x7a1ade4e"
          }
        ]
      },
      types: []
    };

    this.contract = new ContractPromise(this.api, contractABI, this.contractAddress);
  }

  async getBalance(address?: string): Promise<number> {
    try {
      const account = address || this.account.address;
      const balance = await this.api.query.system.account(account);
      return parseFloat(balance.data.free.toString()) / 1e12; // Convert to LUNES
    } catch (error) {
      logger.error('Error getting balance', { address, error });
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
      }) as WeightV2;

      // Chama mint
      const result = await this.contract.tx
        .mint({ 
          gasLimit,
          storageDepositLimit: null
        }, recipient, amount * 1e12) // Convert to smallest unit
        .signAndSend(this.account);

      logger.info('✅ LUSDT mint transaction sent', { 
        txHash: result.toString(),
        recipient, 
        amount 
      });

      return result.toString();
    } catch (error) {
      logger.error('❌ LUSDT mint failed', { error, recipient, amount });
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
      }) as WeightV2;

      const result = await this.contract.tx
        .burn({ 
          gasLimit,
          storageDepositLimit: null
        }, amount * 1e12, solanaRecipient)
        .signAndSend(this.account);

      logger.info('✅ LUSDT burn transaction sent', { 
        txHash: result.toString(),
        amount, 
        solanaRecipient 
      });

      return result.toString();
    } catch (error) {
      logger.error('❌ LUSDT burn failed', { error, amount, solanaRecipient });
      throw error;
    }
  }

  async watchForBurnEvents(callback: (event: LunesTransfer) => void): Promise<void> {
    logger.info('👀 Starting to watch for LUSDT burn events...');
    
    // Subscribe to contract events
    this.api.query.system.events((events) => {
      events.forEach((record) => {
        const { event } = record;
        
        if (event.section === 'contracts' && event.method === 'ContractEmitted') {
          try {
            // Parse contract event
            const [contractAddress, eventData] = event.data;
            
            if (contractAddress.toString() === this.contractAddress) {
              // Decode event data - this would need proper ABI decoding
              logger.debug('Contract event detected', { eventData: eventData.toString() });
              
              // TODO: Properly decode and handle burn events
              // callback({
              //   amount: ...,
              //   from: ...,
              //   to: ...,
              //   timestamp: new Date()
              // });
            }
          } catch (error) {
            logger.error('Error processing contract event', error);
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
      logger.error('Error getting transaction details', { txHash, error });
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
      
      return isInBlock;
    } catch (error) {
      logger.error('Error checking transaction finalization', { txHash, error });
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
      }) as WeightV2;

      const result = await this.contract.query.balanceOf(
        account,
        { gasLimit, storageDepositLimit: null },
        account
      );

      if (result.result.isOk) {
        const balance = result.output?.toString() || '0';
        return parseFloat(balance) / 1e12; // Convert from smallest unit
      }
      
      return 0;
    } catch (error) {
      logger.debug('Could not get LUSDT balance', { error: error.message });
      return 0;
    }
  }

  getAddress(): string {
    return this.account.address;
  }

  async getNetworkInfo(): Promise<any> {
    try {
      const [chain, runtime, health] = await Promise.all([
        this.api.rpc.system.chain(),
        this.api.rpc.state.getRuntimeVersion(),
        this.api.rpc.system.health()
      ]);

      return {
        chain: chain.toString(),
        runtime: runtime.toHuman(),
        health: health.toHuman(),
        endpoint: this.rpcUrl
      };
    } catch (error) {
      logger.error('Error getting network info', error);
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