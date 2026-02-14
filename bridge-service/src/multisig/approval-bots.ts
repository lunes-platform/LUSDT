/**
 * Approval Bots — 3 validadores independentes com funções segregadas.
 *
 * Bot 1 (OriginValidator):  valida origem da transação e finalidade on-chain
 * Bot 2 (RiskValidator):    valida limites, padrões de fraude, anomalias
 * Bot 3 (BackupValidator):  contingência — valida integridade + heartbeat
 *
 * Cada bot assina sua aprovação com HMAC usando seu secret.
 * As aprovações são independentes e assíncronas.
 */

import crypto from 'crypto';
import {
  BotApproval,
  BotRejection,
  BotRole,
  MultisigProposal,
  ValidationResult,
  ValidationCheck,
  ISigner,
} from './types';
import { logger } from '../utils/logger';

// ── Base Bot ────────────────────────────────────────────────────────

export abstract class ApprovalBot {
  protected botId: string;
  protected botRole: BotRole;
  protected hmacSecret: string;

  constructor(botId: string, botRole: BotRole, hmacSecret: string) {
    this.botId = botId;
    this.botRole = botRole;
    this.hmacSecret = hmacSecret;
  }

  /**
   * Valida a proposta e retorna aprovação ou rejeição.
   */
  async evaluate(proposal: MultisigProposal): Promise<BotApproval | BotRejection> {
    try {
      const result = await this.validate(proposal);

      if (result.valid && result.riskScore < 80) {
        return this.createApproval(proposal, result);
      } else {
        const failedChecks = result.checks.filter(c => !c.passed);
        const reason = failedChecks.map(c => `${c.name}: ${c.detail}`).join('; ');
        return this.createRejection(
          proposal,
          reason || `Risk score too high: ${result.riskScore}`,
          result.riskScore >= 90 ? 'critical' : 'warning',
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Bot ${this.botId} evaluation error`, { proposalId: proposal.id, error: message });
      return this.createRejection(proposal, `Bot error: ${message}`, 'warning');
    }
  }

  getBotId(): string { return this.botId; }
  getBotRole(): BotRole { return this.botRole; }

  protected abstract validate(proposal: MultisigProposal): Promise<ValidationResult>;

  private createApproval(proposal: MultisigProposal, result: ValidationResult): BotApproval {
    const signature = this.signProposal(proposal);
    return {
      botId: this.botId,
      botRole: this.botRole,
      timestamp: Date.now(),
      signature,
      validationDetails: result,
    };
  }

  private createRejection(
    proposal: MultisigProposal,
    reason: string,
    severity: 'warning' | 'critical',
  ): BotRejection {
    return {
      botId: this.botId,
      botRole: this.botRole,
      timestamp: Date.now(),
      reason,
      severity,
    };
  }

  private signProposal(proposal: MultisigProposal): string {
    const payload = `${proposal.id}:${proposal.recipient}:${proposal.amount}:${proposal.tokenMint}`;
    return crypto.createHmac('sha256', this.hmacSecret).update(payload).digest('hex');
  }
}

// ── Bot 1: Origin Validator ─────────────────────────────────────────
// Valida que a transação de origem realmente existe e está finalizada.

export interface OriginValidatorDeps {
  isSourceTransactionFinalized: (signature: string) => Promise<boolean>;
  getSourceTransactionAmount: (signature: string) => Promise<number | null>;
}

export class OriginValidatorBot extends ApprovalBot {
  private deps: OriginValidatorDeps;

  constructor(botId: string, hmacSecret: string, deps: OriginValidatorDeps) {
    super(botId, 'origin_validator', hmacSecret);
    this.deps = deps;
  }

  protected async validate(proposal: MultisigProposal): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];
    let riskScore = 0;

    // Check 1: Source transaction exists and is finalized
    const sourceSignature = proposal.metadata.sourceSignature as string | undefined;
    if (!sourceSignature) {
      checks.push({ name: 'source_signature', passed: false, detail: 'No source signature provided' });
      riskScore += 50;
    } else {
      const isFinalized = await this.deps.isSourceTransactionFinalized(sourceSignature);
      checks.push({
        name: 'source_finalized',
        passed: isFinalized,
        detail: isFinalized ? 'Source tx finalized' : 'Source tx NOT finalized',
      });
      if (!isFinalized) riskScore += 100; // Block
    }

    // Check 2: Source amount matches proposal
    if (sourceSignature) {
      const sourceAmount = await this.deps.getSourceTransactionAmount(sourceSignature);
      if (sourceAmount === null) {
        checks.push({ name: 'amount_match', passed: false, detail: 'Could not verify source amount' });
        riskScore += 30;
      } else {
        const tolerance = 0.001; // 0.1% tolerance for rounding
        const match = Math.abs(sourceAmount - proposal.amount) / proposal.amount < tolerance;
        checks.push({
          name: 'amount_match',
          passed: match,
          detail: match ? `Amount matches: $${sourceAmount}` : `Mismatch: source=$${sourceAmount} vs proposal=$${proposal.amount}`,
        });
        if (!match) riskScore += 80;
      }
    }

    // Check 3: Recipient is valid (non-empty)
    const hasRecipient = !!proposal.recipient && proposal.recipient.length > 20;
    checks.push({
      name: 'recipient_valid',
      passed: hasRecipient,
      detail: hasRecipient ? 'Recipient address valid' : 'Invalid recipient',
    });
    if (!hasRecipient) riskScore += 50;

    return { valid: riskScore < 80, checks, riskScore: Math.min(riskScore, 100) };
  }
}

// ── Bot 2: Risk Validator ───────────────────────────────────────────
// Valida limites de gastos, padrões de fraude e anomalias.

export interface RiskValidatorDeps {
  getRecentProposalCount: (windowMinutes: number) => number;
  getRecipientHistory: (recipient: string) => { totalSent: number; txCount: number };
  getVaultBalance: () => Promise<number>;
}

export class RiskValidatorBot extends ApprovalBot {
  private deps: RiskValidatorDeps;
  private maxProposalsPerHour: number;
  private suspiciousAmountThreshold: number;
  private maxRecipientDailyVolume: number;

  constructor(
    botId: string,
    hmacSecret: string,
    deps: RiskValidatorDeps,
    options?: {
      maxProposalsPerHour?: number;
      suspiciousAmountThreshold?: number;
      maxRecipientDailyVolume?: number;
    },
  ) {
    super(botId, 'risk_validator', hmacSecret);
    this.deps = deps;
    this.maxProposalsPerHour = options?.maxProposalsPerHour ?? 20;
    this.suspiciousAmountThreshold = options?.suspiciousAmountThreshold ?? 50_000;
    this.maxRecipientDailyVolume = options?.maxRecipientDailyVolume ?? 25_000;
  }

  protected async validate(proposal: MultisigProposal): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];
    let riskScore = 0;

    // Check 1: Velocity — too many proposals in short time
    const recentCount = this.deps.getRecentProposalCount(60);
    const velocityOk = recentCount < this.maxProposalsPerHour;
    checks.push({
      name: 'velocity_check',
      passed: velocityOk,
      detail: velocityOk ? `${recentCount} proposals/hr (ok)` : `${recentCount} proposals/hr exceeds limit ${this.maxProposalsPerHour}`,
    });
    if (!velocityOk) riskScore += 60;

    // Check 2: Suspicious amount (round numbers, unusually large)
    const isSuspiciousAmount = proposal.amount >= this.suspiciousAmountThreshold;
    checks.push({
      name: 'amount_risk',
      passed: !isSuspiciousAmount,
      detail: isSuspiciousAmount ? `High-value: $${proposal.amount}` : `Amount $${proposal.amount} within normal range`,
    });
    if (isSuspiciousAmount) riskScore += 20; // Flag but don't block (timelock handles it)

    // Check 3: Recipient daily volume
    const recipientHistory = this.deps.getRecipientHistory(proposal.recipient);
    const recipientOverLimit = recipientHistory.totalSent + proposal.amount > this.maxRecipientDailyVolume;
    checks.push({
      name: 'recipient_volume',
      passed: !recipientOverLimit,
      detail: recipientOverLimit
        ? `Recipient would exceed daily cap ($${recipientHistory.totalSent + proposal.amount} > $${this.maxRecipientDailyVolume})`
        : `Recipient volume ok ($${recipientHistory.totalSent + proposal.amount})`,
    });
    if (recipientOverLimit) riskScore += 40;

    // Check 4: Vault solvency
    const vaultBalance = await this.deps.getVaultBalance();
    const solventAfterTransfer = vaultBalance >= proposal.amount;
    checks.push({
      name: 'vault_solvency',
      passed: solventAfterTransfer,
      detail: solventAfterTransfer
        ? `Vault $${vaultBalance} covers $${proposal.amount}`
        : `INSUFFICIENT vault $${vaultBalance} for $${proposal.amount}`,
    });
    if (!solventAfterTransfer) riskScore += 100;

    return { valid: riskScore < 80, checks, riskScore: Math.min(riskScore, 100) };
  }
}

// ── Bot 3: Backup Validator ─────────────────────────────────────────
// Contingência: valida integridade dos dados + heartbeat do sistema.

export interface BackupValidatorDeps {
  isBridgeServiceHealthy: () => Promise<boolean>;
  isDatabaseReachable: () => Promise<boolean>;
  getProposalFromDatabase: (bridgeTxId: string) => Promise<{ amount: number; status: string } | null>;
}

export class BackupValidatorBot extends ApprovalBot {
  private deps: BackupValidatorDeps;

  constructor(botId: string, hmacSecret: string, deps: BackupValidatorDeps) {
    super(botId, 'backup_validator', hmacSecret);
    this.deps = deps;
  }

  protected async validate(proposal: MultisigProposal): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];
    let riskScore = 0;

    // Check 1: Service health
    const serviceHealthy = await this.deps.isBridgeServiceHealthy();
    checks.push({
      name: 'service_health',
      passed: serviceHealthy,
      detail: serviceHealthy ? 'Bridge service healthy' : 'Bridge service UNHEALTHY',
    });
    if (!serviceHealthy) riskScore += 50;

    // Check 2: Database reachable
    const dbOk = await this.deps.isDatabaseReachable();
    checks.push({
      name: 'database_health',
      passed: dbOk,
      detail: dbOk ? 'Database reachable' : 'Database UNREACHABLE',
    });
    if (!dbOk) riskScore += 40;

    // Check 3: Cross-reference with database
    const dbRecord = await this.deps.getProposalFromDatabase(proposal.bridgeTransactionId);
    if (!dbRecord) {
      checks.push({ name: 'db_cross_ref', passed: false, detail: 'No matching DB record for bridge tx' });
      riskScore += 60;
    } else {
      const amountMatch = Math.abs(dbRecord.amount - proposal.amount) < 0.01;
      checks.push({
        name: 'db_cross_ref',
        passed: amountMatch,
        detail: amountMatch ? 'DB amount matches proposal' : `DB amount $${dbRecord.amount} != proposal $${proposal.amount}`,
      });
      if (!amountMatch) riskScore += 80;
    }

    // Check 4: Proposal not too old
    const age = Date.now() - proposal.createdAt;
    const notTooOld = age < 600_000; // 10 min
    checks.push({
      name: 'proposal_freshness',
      passed: notTooOld,
      detail: notTooOld ? `Proposal age ${Math.round(age / 1000)}s (ok)` : `Proposal too old: ${Math.round(age / 1000)}s`,
    });
    if (!notTooOld) riskScore += 30;

    return { valid: riskScore < 80, checks, riskScore: Math.min(riskScore, 100) };
  }
}
