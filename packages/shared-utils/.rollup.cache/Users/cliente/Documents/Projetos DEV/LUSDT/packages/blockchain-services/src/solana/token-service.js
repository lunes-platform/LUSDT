import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount, TokenAccountNotFoundError } from '@solana/spl-token';
import { TransactionError } from '../types';
/**
 * Serviço para operações com tokens SPL na Solana
 */
export class SolanaTokenService {
    connection;
    walletService;
    constructor(connection, walletService) {
        this.connection = connection;
        this.walletService = walletService;
    }
    /**
     * Obtém o saldo de um token específico
     */
    async getTokenBalance(mint) {
        const wallet = this.walletService.getCurrentWallet();
        if (!wallet) {
            throw new TransactionError('No wallet connected', 'NO_WALLET');
        }
        try {
            const mintPublicKey = new PublicKey(mint);
            const ownerPublicKey = new PublicKey(wallet.publicKey);
            // Get associated token account
            const associatedTokenAccount = await getAssociatedTokenAddress(mintPublicKey, ownerPublicKey);
            try {
                const tokenAccount = await getAccount(this.connection, associatedTokenAccount);
                // Get mint info for decimals
                const mintInfo = await this.connection.getParsedAccountInfo(mintPublicKey);
                const decimals = mintInfo.value?.data?.parsed?.info?.decimals || 0;
                return {
                    mint,
                    amount: Number(tokenAccount.amount) / Math.pow(10, decimals),
                    decimals,
                    symbol: 'UNKNOWN', // Would need to fetch from metadata
                    name: 'Unknown Token'
                };
            }
            catch (error) {
                if (error instanceof TokenAccountNotFoundError) {
                    return {
                        mint,
                        amount: 0,
                        decimals: 0,
                        symbol: 'UNKNOWN',
                        name: 'Unknown Token'
                    };
                }
                throw error;
            }
        }
        catch (error) {
            throw new TransactionError(`Failed to get token balance: ${error instanceof Error ? error.message : 'Unknown error'}`, 'BALANCE_FETCH_FAILED');
        }
    }
    /**
     * Obtém todos os saldos de tokens da carteira
     */
    async getAllTokenBalances() {
        const wallet = this.walletService.getCurrentWallet();
        if (!wallet) {
            throw new TransactionError('No wallet connected', 'NO_WALLET');
        }
        try {
            const ownerPublicKey = new PublicKey(wallet.publicKey);
            // Get all token accounts
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(ownerPublicKey, { programId: TOKEN_PROGRAM_ID });
            const balances = [];
            for (const { account } of tokenAccounts.value) {
                const parsedInfo = account.data.parsed.info;
                const mint = parsedInfo.mint;
                const amount = parsedInfo.tokenAmount.uiAmount || 0;
                const decimals = parsedInfo.tokenAmount.decimals;
                if (amount > 0) {
                    balances.push({
                        mint,
                        amount,
                        decimals,
                        symbol: 'UNKNOWN', // Would need metadata lookup
                        name: 'Unknown Token'
                    });
                }
            }
            return balances;
        }
        catch (error) {
            throw new TransactionError(`Failed to get token balances: ${error instanceof Error ? error.message : 'Unknown error'}`, 'BALANCES_FETCH_FAILED');
        }
    }
    /**
     * Transfere tokens SPL
     */
    async transferToken(params) {
        const wallet = this.walletService.getCurrentWallet();
        if (!wallet) {
            throw new TransactionError('No wallet connected', 'NO_WALLET');
        }
        try {
            const mintPublicKey = new PublicKey(params.mint);
            const fromPublicKey = new PublicKey(wallet.publicKey);
            const toPublicKey = new PublicKey(params.to);
            // Get associated token accounts
            const fromTokenAccount = await getAssociatedTokenAddress(mintPublicKey, fromPublicKey);
            const toTokenAccount = await getAssociatedTokenAddress(mintPublicKey, toPublicKey);
            // Get mint info for decimals
            const mintInfo = await this.connection.getParsedAccountInfo(mintPublicKey);
            const decimals = mintInfo.value?.data?.parsed?.info?.decimals || 0;
            const amount = params.amount * Math.pow(10, decimals);
            const transaction = new Transaction();
            // Check if destination token account exists
            try {
                await getAccount(this.connection, toTokenAccount);
            }
            catch (error) {
                if (error instanceof TokenAccountNotFoundError) {
                    // Create associated token account
                    transaction.add(createAssociatedTokenAccountInstruction(fromPublicKey, // payer
                    toTokenAccount, // associated token account
                    toPublicKey, // owner
                    mintPublicKey // mint
                    ));
                }
                else {
                    throw error;
                }
            }
            // Add transfer instruction
            transaction.add(createTransferInstruction(fromTokenAccount, // source
            toTokenAccount, // destination
            fromPublicKey, // owner
            amount // amount
            ));
            // Add memo if provided
            if (params.memo) {
                const memoInstruction = SystemProgram.transfer({
                    fromPubkey: fromPublicKey,
                    toPubkey: fromPublicKey,
                    lamports: 0
                });
                // Add memo data (simplified - would need proper memo program)
                transaction.add(memoInstruction);
            }
            return await this.walletService.sendTransaction(transaction);
        }
        catch (error) {
            if (error instanceof TransactionError) {
                throw error;
            }
            throw new TransactionError(`Failed to transfer token: ${error instanceof Error ? error.message : 'Unknown error'}`, 'TRANSFER_FAILED', undefined, true);
        }
    }
    /**
     * Transfere SOL nativo
     */
    async transferSol(to, amount, memo) {
        const wallet = this.walletService.getCurrentWallet();
        if (!wallet) {
            throw new TransactionError('No wallet connected', 'NO_WALLET');
        }
        try {
            const fromPublicKey = new PublicKey(wallet.publicKey);
            const toPublicKey = new PublicKey(to);
            const lamports = amount * LAMPORTS_PER_SOL;
            const transaction = new Transaction().add(SystemProgram.transfer({
                fromPubkey: fromPublicKey,
                toPubkey: toPublicKey,
                lamports
            }));
            // Add memo if provided
            if (memo) {
                // Would add proper memo instruction here
            }
            return await this.walletService.sendTransaction(transaction);
        }
        catch (error) {
            if (error instanceof TransactionError) {
                throw error;
            }
            throw new TransactionError(`Failed to transfer SOL: ${error instanceof Error ? error.message : 'Unknown error'}`, 'SOL_TRANSFER_FAILED', undefined, true);
        }
    }
    /**
     * Verifica se uma conta de token existe
     */
    async tokenAccountExists(mint, owner) {
        try {
            const mintPublicKey = new PublicKey(mint);
            const ownerPublicKey = new PublicKey(owner);
            const associatedTokenAccount = await getAssociatedTokenAddress(mintPublicKey, ownerPublicKey);
            await getAccount(this.connection, associatedTokenAccount);
            return true;
        }
        catch (error) {
            if (error instanceof TokenAccountNotFoundError) {
                return false;
            }
            throw error;
        }
    }
    /**
     * Obtém informações de um mint de token
     */
    async getMintInfo(mint) {
        try {
            const mintPublicKey = new PublicKey(mint);
            const mintInfo = await this.connection.getParsedAccountInfo(mintPublicKey);
            if (!mintInfo.value) {
                throw new Error('Mint not found');
            }
            const data = mintInfo.value.data.parsed.info;
            return {
                mint,
                decimals: data.decimals,
                supply: data.supply,
                mintAuthority: data.mintAuthority,
                freezeAuthority: data.freezeAuthority,
                isInitialized: data.isInitialized
            };
        }
        catch (error) {
            throw new TransactionError(`Failed to get mint info: ${error instanceof Error ? error.message : 'Unknown error'}`, 'MINT_INFO_FAILED');
        }
    }
}
//# sourceMappingURL=token-service.js.map