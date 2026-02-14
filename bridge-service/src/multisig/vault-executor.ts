/**
 * Vault Executor — Orquestra o fluxo completo:
 *
 *  1. Bridge chama requestTransfer()
 *  2. ProposalManager cria proposta
 *  3. 3 Bots avaliam em paralelo
 *  4. Se quorum (2/3 normal, 3/3 high-value) → executa via SolanaClient
 *  5. Se rejeitado → bloqueia, loga, circuit breaker reage
 *
 * Em produção, a execução final deve ser via programa multisig on-chain (Squads).
 * Este executor abstrai o fluxo para que a transição seja transparente.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ProposalManager } from './proposal-manager';
import { CircuitBreaker } from './circuit-breaker';
import {
  ApprovalBot,
  OriginValidatorBot,
  RiskValidatorBot,
  BackupValidatorBot,
  OriginValidatorDeps,
  RiskValidatorDeps,
  BackupValidatorDeps,
} from './approval-bots';
import { ISigner, MultisigProposal, BotApproval, BotRejection, SpendingPolicy } from './types';
import { logger } from '../utils/logger';
import { config } from '../config/env';

export interface VaultExecutorConfig {
  connection: Connection;
  usdtMint: PublicKey;
  signer: ISigner;
  botSecrets: { origin: string; risk: string; backup: string };
  originDeps: OriginValidatorDeps;
  riskDeps: RiskValidatorDeps;
  backupDeps: BackupValidatorDeps;
  policy?: Partial<SpendingPolicy>;
  requiredApprovals?: number;
  totalBots?: number;
}

export class VaultExecutor {
  private proposalManager: ProposalManager;
  private circuitBreaker: CircuitBreaker;
  private bots: ApprovalBot[];
  private connection: Connection;
  private usdtMint: PublicKey;
  private signer: ISigner;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(cfg: VaultExecutorConfig) {
    this.connection = cfg.connection;
    this.usdtMint = cfg.usdtMint;
    this.signer = cfg.signer;

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 300_000,
      halfOpenMaxAttempts: 2,
      windowMs: 600_000,
    });

    this.proposalManager = new ProposalManager(
      this.circuitBreaker,
      cfg.policy,
      cfg.requiredApprovals ?? 2,
      cfg.totalBots ?? 3,
    );

    this.bots = [
      new OriginValidatorBot('bot-origin-01', cfg.botSecrets.origin, cfg.originDeps),
      new RiskValidatorBot('bot-risk-01', cfg.botSecrets.risk, cfg.riskDeps),
      new BackupValidatorBot('bot-backup-01', cfg.botSecrets.backup, cfg.backupDeps),
    ];
  }

  /**
   * Inicia o executor — cleanup periódico de propostas expiradas.
   */
  start(): void {
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.proposalManager.cleanup();
      if (cleaned > 0) {
        logger.info(`🧹 Cleaned ${cleaned} expired/old proposals`);
      }
    }, 60_000);

    logger.info('🏦 VaultExecutor started', {
      bots: this.bots.map(b => `${b.getBotId()} (${b.getBotRole()})`),
    });
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    logger.info('🏦 VaultExecutor stopped');
  }

  /**
   * Fluxo principal — substitui o antigo transferUSDT direto.
   *
   * 1. Cria proposta
   * 2. Bots avaliam em paralelo
   * 3. Se quorum → executa transferência
   * 4. Retorna signature da transação
   */
  async requestTransfer(
    bridgeTransactionId: string,
    recipient: string,
    amount: number,
    metadata: Record<string, unknown> = {},
  ): Promise<string> {
    // Step 1: Criar proposta
    const proposal = this.proposalManager.createProposal(
      bridgeTransactionId,
      recipient,
      amount,
      this.usdtMint.toString(),
      metadata,
    );

    logger.info('📋 Transfer proposal created', {
      proposalId: proposal.id,
      amount,
      recipient,
    });

    // Step 2: Bots avaliam em paralelo
    const evaluations = await Promise.allSettled(
      this.bots.map(bot => bot.evaluate(proposal)),
    );

    for (let i = 0; i < evaluations.length; i++) {
      const result = evaluations[i];
      const bot = this.bots[i];

      if (result.status === 'rejected') {
        logger.error(`❌ Bot ${bot.getBotId()} crashed during evaluation`, {
          error: result.reason,
        });
        // Bot crash = rejection (fail-safe)
        this.proposalManager.addRejection(proposal.id, {
          botId: bot.getBotId(),
          botRole: bot.getBotRole(),
          timestamp: Date.now(),
          reason: `Bot crash: ${result.reason}`,
          severity: 'critical',
        });
        continue;
      }

      const evaluation = result.value;

      if ('validationDetails' in evaluation) {
        // It's an approval
        try {
          this.proposalManager.addApproval(proposal.id, evaluation as BotApproval);
        } catch (err) {
          // Proposal may have been rejected by another bot already
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(`Could not add approval from ${bot.getBotId()}: ${msg}`);
        }
      } else {
        // It's a rejection
        try {
          this.proposalManager.addRejection(proposal.id, evaluation as BotRejection);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(`Could not add rejection from ${bot.getBotId()}: ${msg}`);
        }
      }
    }

    // Step 3: Verificar status final
    const updatedProposal = this.proposalManager.getProposal(proposal.id)!;

    if (updatedProposal.status === 'rejected') {
      const reasons = updatedProposal.rejections.map(r => `${r.botId}: ${r.reason}`).join('; ');
      throw new Error(`Transfer REJECTED by bots: ${reasons}`);
    }

    if (updatedProposal.status !== 'approved') {
      throw new Error(
        `Quorum not reached: ${updatedProposal.approvals.length}/${updatedProposal.requiredApprovals} approvals. ` +
        `Status: ${updatedProposal.status}`
      );
    }

    // Step 4: Timelock check
    if (updatedProposal.timelockUntil && Date.now() < updatedProposal.timelockUntil) {
      const remaining = Math.ceil((updatedProposal.timelockUntil - Date.now()) / 1000);
      throw new Error(
        `High-value transfer approved but in TIMELOCK — ${remaining}s remaining. ` +
        `Will be executable after ${new Date(updatedProposal.timelockUntil).toISOString()}`
      );
    }

    // Step 5: Executar transferência
    this.proposalManager.markExecuting(proposal.id);

    try {
      const signature = await this.executeOnChainTransfer(recipient, amount);
      this.proposalManager.markExecuted(proposal.id, signature);

      logger.info('✅ Multisig transfer executed', {
        proposalId: proposal.id,
        signature,
        approvals: updatedProposal.approvals.length,
        amount,
      });

      return signature;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.proposalManager.markFailed(proposal.id, message);
      throw error;
    }
  }

  /**
   * Executa transferência on-chain.
   *
   * Em produção com Squads, isso seria: squads.executeTransaction(proposalTxId)
   * Aqui usamos o signer (que em produção será KMS/Vault, não chave local).
   */
  private async executeOnChainTransfer(recipient: string, amount: number): Promise<string> {
    const signerPubkeyStr = await this.signer.getPublicKey();
    const signerPubkey = new PublicKey(signerPubkeyStr);
    const recipientPubkey = new PublicKey(recipient);

    const sourceTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      this.usdtMint,
      signerPubkey,
    );

    const destinationTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      this.usdtMint,
      recipientPubkey,
    );

    const instruction = Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      sourceTokenAccount,
      destinationTokenAccount,
      signerPubkey,
      [],
      Math.round(amount * 1e6),
    );

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash('finalized')
    ).blockhash;
    transaction.feePayer = signerPubkey;

    // Sign via signer abstraction (KMS/Vault in production)
    const signedTx = await this.signer.signTransaction(transaction) as Transaction;

    // Send pre-signed transaction (no additional signers needed)
    const rawTx = signedTx.serialize();
    const signature = await this.connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: 'finalized',
    });

    await this.connection.confirmTransaction(signature, 'finalized');

    return signature;
  }

  // ── Queries ───────────────────────────────────────────────────────

  getProposalManager(): ProposalManager {
    return this.proposalManager;
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  getStatus(): {
    circuitBreaker: any;
    spending: any;
    pendingProposals: number;
    readyToExecute: number;
  } {
    return {
      circuitBreaker: this.circuitBreaker.getStatus(),
      spending: this.proposalManager.getSpendingStatus(),
      pendingProposals: this.proposalManager.getPendingProposals().length,
      readyToExecute: this.proposalManager.getReadyToExecute().length,
    };
  }
}
