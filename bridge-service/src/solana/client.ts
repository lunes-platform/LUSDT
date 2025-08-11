import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, TokenAccountsFilter, GetProgramAccountsFilter, AccountInfo, ParsedAccountData } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { logger } from '../utils/logger';
import { config } from '../config/env';

export interface SolanaTransfer {
  amount: number;
  recipient: string;
  signature?: string;
  timestamp: Date;
}

export class SolanaClient {
  private connection: Connection;
  private keypair: Keypair;
  private usdtMint: PublicKey;
  private multisigVault: PublicKey;

  constructor(rpcUrl: string, privateKey: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privateKey)));
    this.usdtMint = new PublicKey(config.USDT_TOKEN_MINT);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🔗 Initializing Solana client...');
      
      // Verifica conexão
      const version = await this.connection.getVersion();
      logger.info('✅ Connected to Solana', { version });
      
      // Verifica saldo
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      logger.info('💰 Solana wallet balance', { 
        wallet: this.keypair.publicKey.toString(),
        balance: balance / 1e9 
      });

      // Configurar endereço do multisig vault (deve ser fornecido via configuração)
      if (process.env.SOLANA_MULTISIG_VAULT) {
        this.multisigVault = new PublicKey(process.env.SOLANA_MULTISIG_VAULT);
        logger.info('🏦 Multisig vault configured', { vault: this.multisigVault.toString() });
      }

    } catch (error) {
      logger.error('❌ Failed to initialize Solana client', error);
      throw error;
    }
  }

  async getUSDTBalance(address?: string): Promise<number> {
    try {
      const wallet = address ? new PublicKey(address) : this.keypair.publicKey;
      const tokenAccount = await getAssociatedTokenAddress(this.usdtMint, wallet);
      const account = await getAccount(this.connection, tokenAccount);
      return Number(account.amount) / 1e6; // USDT has 6 decimals
    } catch (error) {
      logger.debug('Could not get USDT balance', { error: error.message });
      return 0;
    }
  }

  async transferUSDT(recipient: string, amount: number): Promise<string> {
    try {
      logger.info('💸 Initiating USDT transfer', { recipient, amount });

      const recipientPubkey = new PublicKey(recipient);
      const sourceTokenAccount = await getAssociatedTokenAddress(this.usdtMint, this.keypair.publicKey);
      const destinationTokenAccount = await getAssociatedTokenAddress(this.usdtMint, recipientPubkey);

      const transaction = new Transaction().add(
        createTransferInstruction(
          sourceTokenAccount,
          destinationTokenAccount,
          this.keypair.publicKey,
          amount * 1e6, // Convert to smallest unit
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.keypair],
        { commitment: 'confirmed' }
      );

      logger.info('✅ USDT transfer completed', { signature, recipient, amount });
      return signature;
    } catch (error) {
      logger.error('❌ USDT transfer failed', { error, recipient, amount });
      throw error;
    }
  }

  async watchForIncomingTransfers(callback: (transfer: SolanaTransfer) => void): Promise<void> {
    logger.info('👀 Starting to watch for incoming USDT transfers...');
    
    const ourTokenAccount = await getAssociatedTokenAddress(this.usdtMint, this.keypair.publicKey);
    
    this.connection.onAccountChange(
      ourTokenAccount,
      async (accountInfo) => {
        try {
          // Parse account data to get transaction details
          const parsedData = accountInfo.data as ParsedAccountData;
          logger.debug('Account change detected', { parsedData });
          
          // Here you would implement logic to detect incoming transfers
          // For now, this is a placeholder that would need more sophisticated implementation
          
        } catch (error) {
          logger.error('Error processing account change', error);
        }
      },
      'confirmed'
    );
  }

  async getTransactionDetails(signature: string): Promise<any> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      return transaction;
    } catch (error) {
      logger.error('Error getting transaction details', { signature, error });
      throw error;
    }
  }

  async getRecentTransactions(limit: number = 100): Promise<any[]> {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        this.keypair.publicKey,
        { limit }
      );
      
      const transactions = [];
      for (const sig of signatures) {
        try {
          const tx = await this.getTransactionDetails(sig.signature);
          if (tx) transactions.push(tx);
        } catch (error) {
          logger.debug('Could not get transaction', { signature: sig.signature });
        }
      }
      
      return transactions;
    } catch (error) {
      logger.error('Error getting recent transactions', error);
      throw error;
    }
  }

  async isTransactionConfirmed(signature: string): Promise<boolean> {
    try {
      const status = await this.connection.getSignatureStatus(signature);
      return status.value?.confirmationStatus === 'confirmed' || 
             status.value?.confirmationStatus === 'finalized';
    } catch (error) {
      logger.error('Error checking transaction confirmation', { signature, error });
      return false;
    }
  }

  getPublicKey(): string {
    return this.keypair.publicKey.toString();
  }

  async getNetworkInfo(): Promise<any> {
    try {
      const [epochInfo, blockHeight, version] = await Promise.all([
        this.connection.getEpochInfo(),
        this.connection.getBlockHeight(),
        this.connection.getVersion()
      ]);

      return {
        epochInfo,
        blockHeight,
        version,
        endpoint: this.connection.rpcEndpoint
      };
    } catch (error) {
      logger.error('Error getting network info', error);
      throw error;
    }
  }
}