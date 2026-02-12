import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  TokenAccountNotFoundError
} from '@solana/spl-token';
import { useWallet } from '../components/WalletProvider';
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../contracts/addresses';

export function useSolanaContract() {
  const { solanaWallet } = useWallet();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conectar à rede Solana
  useEffect(() => {
    if (solanaWallet) {
      setIsConnecting(true);
      try {
        const conn = new Connection(NETWORK_CONFIG.solana.rpcUrl, 'confirmed');
        setConnection(conn);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao conectar Solana');
      } finally {
        setIsConnecting(false);
      }
    }
  }, [solanaWallet]);

  // Buscar saldo USDT
  const getUsdtBalance = useCallback(async (address?: string): Promise<string> => {
    if (!connection) return '0';

    try {
      const walletAddress = address || solanaWallet?.address;
      if (!walletAddress) return '0';

      const publicKey = new PublicKey(walletAddress);
      const usdtMint = new PublicKey(CONTRACT_ADDRESSES.solana.usdtMint);
      
      const tokenAccount = await getAssociatedTokenAddress(usdtMint, publicKey);
      
      try {
        const account = await getAccount(connection, tokenAccount);
        // USDT tem 6 decimais
        const balance = Number(account.amount) / Math.pow(10, 6);
        return balance.toString();
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError) {
          return '0';
        }
        throw error;
      }
    } catch (error) {
      console.error('Erro ao buscar saldo USDT:', error);
      return '0';
    }
  }, [connection, solanaWallet]);

  // Buscar saldo SOL
  const getSolBalance = useCallback(async (address?: string): Promise<string> => {
    if (!connection) return '0';

    try {
      const walletAddress = address || solanaWallet?.address;
      if (!walletAddress) return '0';

      const publicKey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(publicKey);
      
      // Converter de lamports para SOL
      return (balance / 1e9).toString();
    } catch (error) {
      console.error('Erro ao buscar saldo SOL:', error);
      return '0';
    }
  }, [connection, solanaWallet]);

  // Transferir USDT
  const transferUsdt = useCallback(async (
    to: string, 
    amount: string, 
    memo?: string
  ): Promise<string> => {
    if (!connection || !solanaWallet) {
      throw new Error('Conexão ou carteira não disponível');
    }

    try {
      const fromPubkey = new PublicKey(solanaWallet.address);
      const toPubkey = new PublicKey(to);
      const usdtMint = new PublicKey(CONTRACT_ADDRESSES.solana.usdtMint);

      // Converter amount para unidades menores (6 decimais para USDT)
      const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, 6));

      // Obter endereços das contas de token
      const fromTokenAccount = await getAssociatedTokenAddress(usdtMint, fromPubkey);
      const toTokenAccount = await getAssociatedTokenAddress(usdtMint, toPubkey);

      const transaction = new Transaction();

      // Verificar se a conta de destino existe
      try {
        await getAccount(connection, toTokenAccount);
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError) {
          // Criar conta de token associada
          transaction.add(
            createAssociatedTokenAccountInstruction(
              fromPubkey, // payer
              toTokenAccount, // associatedToken
              toPubkey, // owner
              usdtMint // mint
            )
          );
        }
      }

      // Adicionar instrução de transferência
      transaction.add(
        createTransferInstruction(
          fromTokenAccount, // source
          toTokenAccount, // destination
          fromPubkey, // owner
          amountInSmallestUnit // amount
        )
      );

      // Obter blockhash recente
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Assinar transação (isso seria feito pela carteira)
      // @ts-ignore - Phantom wallet
      const signedTransaction = await window.solana.signTransaction(transaction);
      
      // Enviar transação
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      // Aguardar confirmação
      await connection.confirmTransaction(signature);
      
      return signature;
    } catch (error) {
      throw new Error(`Erro ao transferir USDT: ${error}`);
    }
  }, [connection, solanaWallet]);

  // Criar conta de token USDT se não existir
  const createUsdtTokenAccount = useCallback(async (): Promise<string> => {
    if (!connection || !solanaWallet) {
      throw new Error('Conexão ou carteira não disponível');
    }

    try {
      const publicKey = new PublicKey(solanaWallet.address);
      const usdtMint = new PublicKey(CONTRACT_ADDRESSES.solana.usdtMint);
      
      const tokenAccount = await getAssociatedTokenAddress(usdtMint, publicKey);

      // Verificar se já existe
      try {
        await getAccount(connection, tokenAccount);
        return tokenAccount.toString(); // Já existe
      } catch (error) {
        if (!(error instanceof TokenAccountNotFoundError)) {
          throw error;
        }
      }

      // Criar nova conta
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          publicKey, // payer
          tokenAccount, // associatedToken
          publicKey, // owner
          usdtMint // mint
        )
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // @ts-ignore - Phantom wallet
      const signedTransaction = await window.solana.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      await connection.confirmTransaction(signature);
      
      return signature;
    } catch (error) {
      throw new Error(`Erro ao criar conta USDT: ${error}`);
    }
  }, [connection, solanaWallet]);

  // Verificar se conta USDT existe
  const usdtAccountExists = useCallback(async (address?: string): Promise<boolean> => {
    if (!connection) return false;

    try {
      const walletAddress = address || solanaWallet?.address;
      if (!walletAddress) return false;

      const publicKey = new PublicKey(walletAddress);
      const usdtMint = new PublicKey(CONTRACT_ADDRESSES.solana.usdtMint);
      const tokenAccount = await getAssociatedTokenAddress(usdtMint, publicKey);

      try {
        await getAccount(connection, tokenAccount);
        return true;
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError) {
          return false;
        }
        throw error;
      }
    } catch (error) {
      console.error('Erro ao verificar conta USDT:', error);
      return false;
    }
  }, [connection, solanaWallet]);

  return {
    // Estado
    connection,
    isConnected: !!connection && !!solanaWallet,
    isConnecting,
    error,

    // Funções de saldo
    getUsdtBalance,
    getSolBalance,

    // Funções de transação
    transferUsdt,
    createUsdtTokenAccount,
    usdtAccountExists,
  };
}