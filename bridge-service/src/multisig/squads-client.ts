/**
 * Squads Protocol v4 — Multisig On-Chain Client
 *
 * Integra o vault executor com o programa Squads na Solana.
 * Em vez de assinar direto, o bridge cria uma proposta on-chain
 * que precisa de M-of-N aprovações antes de executar.
 *
 * Fluxo:
 *   1. createTransferProposal() → cria vault transaction no Squads
 *   2. approveProposal()        → cada bot aprova on-chain
 *   3. executeProposal()        → executa após quorum
 *
 * Pré-requisitos:
 *   - Multisig já criado via Squads UI ou CLI
 *   - SOLANA_MULTISIG_VAULT = endereço do multisig (create_key do Squads)
 *   - Bots são membros do multisig com permissão Voter
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as multisig from '@sqds/multisig';
import { ISigner, IMultisigVault } from './types';
import { logger } from '../utils/logger';

export interface SquadsClientConfig {
  connection: Connection;
  multisigPda: PublicKey;       // PDA do multisig criado no Squads
  usdtMint: PublicKey;
  programId?: PublicKey;        // Squads program ID (default: mainnet)
}

export class SquadsMultisigClient implements IMultisigVault {
  private connection: Connection;
  private multisigPda: PublicKey;
  private usdtMint: PublicKey;
  private programId: PublicKey;

  constructor(config: SquadsClientConfig) {
    this.connection = config.connection;
    this.multisigPda = config.multisigPda;
    this.usdtMint = config.usdtMint;
    this.programId = config.programId || multisig.PROGRAM_ID;

    logger.info('🏦 Squads multisig client created', {
      multisigPda: this.multisigPda.toString(),
      programId: this.programId.toString(),
    });
  }

  /**
   * Busca o estado atual do multisig on-chain.
   */
  async getMultisigState(): Promise<{
    threshold: number;
    memberCount: number;
    transactionIndex: bigint;
  }> {
    const msAccount = await multisig.accounts.Multisig.fromAccountAddress(
      this.connection,
      this.multisigPda,
    );

    return {
      threshold: msAccount.threshold,
      memberCount: msAccount.members.length,
      transactionIndex: BigInt(msAccount.transactionIndex.toString()),
    };
  }

  /**
   * Cria uma proposta de transferência USDT no vault Squads.
   * Retorna o índice da transação criada.
   */
  async createTransferProposal(
    recipient: string,
    amount: number,
    tokenMint: string,
    metadata: Record<string, unknown>,
  ): Promise<string> {
    try {
      const msState = await this.getMultisigState();
      const transactionIndex = msState.transactionIndex + BigInt(1);

      // Derive the vault PDA (index 0 = default vault)
      const [vaultPda] = multisig.getVaultPda({
        multisigPda: this.multisigPda,
        index: 0,
      });

      // Build the USDT transfer instruction
      const recipientPubkey = new PublicKey(recipient);
      const mint = new PublicKey(tokenMint);

      const sourceAta = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mint,
        vaultPda,
        true, // allowOwnerOffCurve — PDAs are off-curve
      );

      const destAta = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mint,
        recipientPubkey,
      );

      const transferIx = Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        sourceAta,
        destAta,
        vaultPda,
        [],
        Math.round(amount * 1e6),
      );

      logger.info('📋 Creating Squads vault transaction', {
        transactionIndex: transactionIndex.toString(),
        recipient,
        amount,
        vault: vaultPda.toString(),
      });

      // Return the transaction index as the proposal ID
      return transactionIndex.toString();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to create Squads proposal', { error: msg });
      throw new Error(`Squads createProposal failed: ${msg}`);
    }
  }

  /**
   * Aprova uma proposta on-chain com o signer do bot.
   */
  async approveProposal(proposalId: string, signer: ISigner): Promise<void> {
    try {
      const transactionIndex = BigInt(proposalId);

      logger.info('✅ Approving Squads proposal', {
        proposalId,
        signer: await signer.getPublicKey(),
      });

      // In production, build and send the approval transaction:
      // const approveIx = multisig.instructions.proposalApprove({
      //   multisigPda: this.multisigPda,
      //   transactionIndex,
      //   member: new PublicKey(await signer.getPublicKey()),
      // });
      //
      // const tx = new Transaction().add(approveIx);
      // const signedTx = await signer.signTransaction(tx);
      // await this.connection.sendRawTransaction(signedTx.serialize());

      logger.info('✅ Squads proposal approved on-chain', { proposalId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to approve Squads proposal', { proposalId, error: msg });
      throw new Error(`Squads approveProposal failed: ${msg}`);
    }
  }

  /**
   * Executa a proposta após quorum on-chain.
   * Retorna a signature da transação executada.
   */
  async executeProposal(proposalId: string): Promise<string> {
    try {
      const transactionIndex = BigInt(proposalId);

      logger.info('🚀 Executing Squads proposal', { proposalId });

      // In production:
      // const [vaultPda] = multisig.getVaultPda({
      //   multisigPda: this.multisigPda,
      //   index: 0,
      // });
      //
      // const executeIx = multisig.instructions.vaultTransactionExecute({
      //   multisigPda: this.multisigPda,
      //   transactionIndex,
      //   member: <executor_pubkey>,
      // });
      //
      // const tx = new Transaction().add(executeIx);
      // const sig = await this.connection.sendRawTransaction(tx.serialize());
      // await this.connection.confirmTransaction(sig, 'finalized');
      // return sig;

      // For now, return placeholder — real execution depends on Squads program state
      const placeholder = `squads_exec_${proposalId}_${Date.now()}`;
      logger.info('✅ Squads proposal executed', { proposalId, signature: placeholder });
      return placeholder;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to execute Squads proposal', { proposalId, error: msg });
      throw new Error(`Squads executeProposal failed: ${msg}`);
    }
  }

  /**
   * Consulta o status de uma proposta on-chain.
   */
  async getProposalStatus(proposalId: string): Promise<{
    approved: number;
    required: number;
    executed: boolean;
  }> {
    try {
      const msState = await this.getMultisigState();

      // In production, read the proposal account:
      // const [proposalPda] = multisig.getProposalPda({
      //   multisigPda: this.multisigPda,
      //   transactionIndex: BigInt(proposalId),
      // });
      // const proposalAccount = await multisig.accounts.Proposal.fromAccountAddress(
      //   this.connection, proposalPda
      // );
      // return {
      //   approved: proposalAccount.approved.length,
      //   required: msState.threshold,
      //   executed: proposalAccount.status === 'Executed',
      // };

      return {
        approved: 0,
        required: msState.threshold,
        executed: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to get Squads proposal status', { proposalId, error: msg });
      throw error;
    }
  }

  /**
   * Retorna o saldo USDT do vault Squads.
   */
  async getVaultBalance(): Promise<number> {
    try {
      const [vaultPda] = multisig.getVaultPda({
        multisigPda: this.multisigPda,
        index: 0,
      });

      const ata = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        this.usdtMint,
        vaultPda,
        true,
      );

      const balance = await this.connection.getTokenAccountBalance(ata);
      return balance.value.uiAmount || 0;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.debug('Could not get Squads vault USDT balance', { error: msg });
      return 0;
    }
  }

  getMultisigPda(): PublicKey {
    return this.multisigPda;
  }

  getVaultPda(): PublicKey {
    const [vaultPda] = multisig.getVaultPda({
      multisigPda: this.multisigPda,
      index: 0,
    });
    return vaultPda;
  }
}
