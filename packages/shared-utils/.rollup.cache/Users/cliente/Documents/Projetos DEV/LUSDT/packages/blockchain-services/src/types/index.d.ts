export interface WalletConnection {
    address: string;
    publicKey: string;
    connected: boolean;
    name: string;
    icon?: string;
}
export interface TokenBalance {
    mint: string;
    amount: number;
    decimals: number;
    symbol: string;
    name: string;
}
export interface TransactionResult {
    signature: string;
    success: boolean;
    error?: string;
    blockHeight?: number;
    confirmations?: number;
}
export interface NetworkStatus {
    connected: boolean;
    blockHeight: number;
    lastUpdate: Date;
}
export interface SolanaWallet extends WalletConnection {
    adapter: any;
}
export interface SolanaTokenAccount {
    mint: string;
    owner: string;
    amount: string;
    decimals: number;
}
export interface SolanaTransaction {
    signature: string;
    slot: number;
    blockTime: number | null;
    confirmationStatus: 'processed' | 'confirmed' | 'finalized';
}
export interface LunesWallet extends WalletConnection {
    signer: any;
}
export interface ContractCall {
    contractAddress: string;
    method: string;
    args: any[];
    value?: number;
    gasLimit?: number;
}
export interface ContractResult {
    transactionHash: string;
    blockNumber: number;
    gasUsed: number;
    success: boolean;
    events?: any[];
}
export interface DepositParams {
    amount: number;
    destinationAddress: string;
    memo?: string;
}
export interface RedemptionParams {
    amount: number;
    destinationAddress: string;
    feeType: 'lunes' | 'lusdt' | 'usdt';
}
export interface BridgeTransaction {
    id: string;
    type: 'deposit' | 'redemption';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    amount: number;
    fee: number;
    sourceNetwork: 'solana' | 'lunes';
    destinationNetwork: 'solana' | 'lunes';
    sourceTransaction?: string;
    destinationTransaction?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class WalletError extends Error {
    code: string;
    cause?: Error | undefined;
    constructor(message: string, code: string, cause?: Error | undefined);
}
export declare class TransactionError extends Error {
    code: string;
    transactionId?: string | undefined;
    retryable: boolean;
    constructor(message: string, code: string, transactionId?: string | undefined, retryable?: boolean);
}
export declare class NetworkError extends Error {
    network: 'solana' | 'lunes';
    cause?: Error | undefined;
    constructor(message: string, network: 'solana' | 'lunes', cause?: Error | undefined);
}
//# sourceMappingURL=index.d.ts.map