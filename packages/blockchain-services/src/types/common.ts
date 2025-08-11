/**
 * Tipos comuns para serviços blockchain
 */

import { z } from 'zod';

// === TIPOS DE REDE ===
export enum NetworkType {
  SOLANA = 'solana',
  LUNES = 'lunes'
}

export enum Environment {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  DEVNET = 'devnet',
  LOCAL = 'local'
}

// === CONFIGURAÇÃO DE REDE ===
export interface NetworkConfig {
  name: string;
  type: NetworkType;
  environment: Environment;
  rpcUrl: string;
  wsUrl?: string;
  explorerUrl?: string;
  chainId?: number;
}

// === WALLET ===
export interface WalletInfo {
  name: string;
  icon: string;
  url: string;
  installed: boolean;
  supported: boolean;
}

export interface ConnectedWallet {
  address: string;
  publicKey: string;
  network: NetworkType;
  walletName: string;
  balance?: string;
}

// === TRANSAÇÕES ===
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMING = 'confirming',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface TransactionBase {
  id: string;
  hash: string;
  status: TransactionStatus;
  timestamp: Date;
  network: NetworkType;
  from: string;
  to?: string;
  amount?: string;
  fee?: string;
  confirmations?: number;
  blockHeight?: number;
}

// === TOKENS ===
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
  network: NetworkType;
}

export interface TokenBalance {
  token: TokenInfo;
  balance: string;
  balanceFormatted: string;
  usdValue?: string;
}

// === CONTRATOS ===
export interface ContractInfo {
  address: string;
  name: string;
  network: NetworkType;
  abi?: any;
  metadata?: any;
}

// === EVENTOS ===
export interface BlockchainEvent {
  type: string;
  network: NetworkType;
  data: any;
  timestamp: Date;
}

// === ERROS ===
export enum ErrorCode {
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  WALLET_CONNECTION_REJECTED = 'WALLET_CONNECTION_REJECTED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  USER_REJECTED = 'USER_REJECTED',
  TIMEOUT = 'TIMEOUT'
}

export class BlockchainError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'BlockchainError';
  }
}

// === VALIDAÇÃO COM ZOD ===

// Schema para validação de endereços
export const AddressSchema = z.object({
  address: z.string().min(1, 'Endereço é obrigatório'),
  network: z.nativeEnum(NetworkType)
});

// Schema para validação de valores
export const AmountSchema = z.object({
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    'Valor deve ser um número positivo'
  ),
  decimals: z.number().min(0).max(18)
});

// Schema para configuração de transação
export const TransactionConfigSchema = z.object({
  to: z.string().min(1, 'Destinatário é obrigatório'),
  amount: z.string().min(1, 'Valor é obrigatório'),
  memo: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  maxFee: z.string().optional()
});

// === UTILITÁRIOS DE TIPO ===

// Tipo para callbacks de eventos
export type EventCallback<T = any> = (data: T) => void;

// Tipo para configuração de retry
export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
}

// Tipo para paginação
export interface PaginationConfig {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Tipo para resposta paginada
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// === CONSTANTES ===

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2
};

export const DEFAULT_PAGINATION: PaginationConfig = {
  page: 1,
  limit: 20
};

// Configurações de rede padrão
export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  'solana-mainnet': {
    name: 'Solana Mainnet',
    type: NetworkType.SOLANA,
    environment: Environment.MAINNET,
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com'
  },
  'solana-devnet': {
    name: 'Solana Devnet',
    type: NetworkType.SOLANA,
    environment: Environment.DEVNET,
    rpcUrl: 'https://api.devnet.solana.com',
    explorerUrl: 'https://explorer.solana.com'
  },
  'lunes-mainnet': {
    name: 'Lunes Mainnet',
    type: NetworkType.LUNES,
    environment: Environment.MAINNET,
    rpcUrl: 'wss://ws.lunes.io',
    explorerUrl: 'https://explorer.lunes.io'
  },
  'lunes-testnet': {
    name: 'Lunes Testnet',
    type: NetworkType.LUNES,
    environment: Environment.TESTNET,
    rpcUrl: 'wss://ws-test.lunes.io',
    explorerUrl: 'https://explorer-test.lunes.io'
  }
};

// Tokens conhecidos
export const KNOWN_TOKENS: Record<string, TokenInfo> = {
  'usdt-solana': {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    network: NetworkType.SOLANA
  },
  'lusdt-lunes': {
    address: '', // Será preenchido após deploy
    symbol: 'LUSDT',
    name: 'Lunes USD Tether',
    decimals: 12,
    network: NetworkType.LUNES
  }
};