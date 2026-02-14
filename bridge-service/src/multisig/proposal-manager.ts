/**
 * Proposal Manager
 *
 * O bridge NÃO executa transferências diretamente.
 * Em vez disso, cria uma PROPOSTA que precisa de M-of-N aprovações de bots.
 * Só após quorum, a execução é liberada via multisig on-chain.
 */

import crypto from 'crypto';
import {
  MultisigProposal,
  ProposalStatus,
  BotApproval,
  BotRejection,
  SpendingPolicy,
  AuditEntry,
} from './types';
import { CircuitBreaker } from './circuit-breaker';
import { logger } from '../utils/logger';

const DEFAULT_POLICY: SpendingPolicy = {
  singleTxLimit: 10_000,
  hourlyLimit: 25_000,
  dailyLimit: 50_000,
  highValueThreshold: 5_000,    // Above this → 3/3 + timelock
  timelockDurationMs: 600_000,  // 10 min delay for high-value
  proposalTtlMs: 300_000,       // 5 min TTL for proposals
};

export class ProposalManager {
  private proposals: Map<string, MultisigProposal> = new Map();
  private hourlySpent: number = 0;
  private dailySpent: number = 0;
  private hourlyResetTime: number = Date.now();
  private dailyResetTime: number = Date.now();
  private circuitBreaker: CircuitBreaker;
  private policy: SpendingPolicy;
  private auditLog: AuditEntry[] = [];
  private requiredApprovals: number;
  private totalBots: number;

  constructor(
    circuitBreaker: CircuitBreaker,
    policy?: Partial<SpendingPolicy>,
    requiredApprovals: number = 2,
    totalBots: number = 3,
  ) {
    this.circuitBreaker = circuitBreaker;
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.requiredApprovals = requiredApprovals;
    this.totalBots = totalBots;
  }

  // ── Create proposal ───────────────────────────────────────────────

  createProposal(
    bridgeTransactionId: string,
    recipient: string,
    amount: number,
    tokenMint: string,
    metadata: Record<string, unknown> = {},
  ): MultisigProposal {
    // Circuit breaker check
    if (!this.circuitBreaker.canExecute()) {
      throw new Error('Circuit breaker OPEN — all proposals blocked. Contact ops team.');
    }

    // Spending limits
    this.resetLimitsIfNeeded();

    if (amount > this.policy.singleTxLimit) {
      throw new Error(
        `Amount $${amount} exceeds single-tx limit $${this.policy.singleTxLimit}. Requires manual multisig.`
      );
    }

    if (this.hourlySpent + amount > this.policy.hourlyLimit) {
      throw new Error(
        `Would exceed hourly limit ($${this.hourlySpent + amount} > $${this.policy.hourlyLimit}).`
      );
    }

    if (this.dailySpent + amount > this.policy.dailyLimit) {
      throw new Error(
        `Would exceed daily limit ($${this.dailySpent + amount} > $${this.policy.dailyLimit}).`
      );
    }

    // Determine required approvals and timelock
    const isHighValue = amount >= this.policy.highValueThreshold;
    const requiredApprovals = isHighValue ? this.totalBots : this.requiredApprovals; // 3/3 for high value
    const now = Date.now();

    const proposal: MultisigProposal = {
      id: this.generateProposalId(),
      bridgeTransactionId,
      recipient,
      amount,
      tokenMint,
      createdAt: now,
      expiresAt: now + this.policy.proposalTtlMs,
      status: 'pending',
      approvals: [],
      rejections: [],
      requiredApprovals,
      totalBots: this.totalBots,
      timelockUntil: isHighValue ? now + this.policy.timelockDurationMs : undefined,
      metadata,
    };

    this.proposals.set(proposal.id, proposal);

    this.audit('info', 'proposal_created', proposal.id, {
      amount,
      recipient,
      requiredApprovals,
      isHighValue,
      timelockUntil: proposal.timelockUntil,
    });

    logger.info('📋 Proposal created', {
      proposalId: proposal.id,
      amount,
      requiredApprovals,
      isHighValue,
    });

    return proposal;
  }

  // ── Bot approval ──────────────────────────────────────────────────

  addApproval(proposalId: string, approval: BotApproval): MultisigProposal {
    const proposal = this.getProposalOrThrow(proposalId);

    if (proposal.status !== 'pending') {
      throw new Error(`Proposal ${proposalId} is ${proposal.status}, cannot approve`);
    }

    if (this.isExpired(proposal)) {
      proposal.status = 'expired';
      throw new Error(`Proposal ${proposalId} expired`);
    }

    // Prevent duplicate approval from same bot
    if (proposal.approvals.some(a => a.botId === approval.botId)) {
      throw new Error(`Bot ${approval.botId} already approved proposal ${proposalId}`);
    }

    // Validate that the approval's validation checks passed
    if (!approval.validationDetails.valid) {
      throw new Error(`Bot ${approval.botId} validation failed — cannot approve`);
    }

    proposal.approvals.push(approval);

    this.audit('info', 'proposal_approved', proposalId, {
      botId: approval.botId,
      botRole: approval.botRole,
      approvalCount: proposal.approvals.length,
      required: proposal.requiredApprovals,
    });

    logger.info('✅ Bot approval added', {
      proposalId,
      botId: approval.botId,
      approvals: `${proposal.approvals.length}/${proposal.requiredApprovals}`,
    });

    // Check quorum
    if (proposal.approvals.length >= proposal.requiredApprovals) {
      proposal.status = 'approved';
      this.audit('info', 'proposal_quorum_reached', proposalId, {
        approvals: proposal.approvals.length,
      });
      logger.info('🎯 Quorum reached!', { proposalId });
    }

    return proposal;
  }

  // ── Bot rejection ─────────────────────────────────────────────────

  addRejection(proposalId: string, rejection: BotRejection): MultisigProposal {
    const proposal = this.getProposalOrThrow(proposalId);

    if (proposal.status !== 'pending') {
      throw new Error(`Proposal ${proposalId} is ${proposal.status}, cannot reject`);
    }

    proposal.rejections.push(rejection);
    proposal.status = 'rejected';

    this.audit(rejection.severity === 'critical' ? 'critical' : 'warning', 'proposal_rejected', proposalId, {
      botId: rejection.botId,
      botRole: rejection.botRole,
      reason: rejection.reason,
    });

    logger.warn('❌ Proposal rejected', {
      proposalId,
      botId: rejection.botId,
      reason: rejection.reason,
    });

    // Critical rejection → circuit breaker
    if (rejection.severity === 'critical') {
      this.circuitBreaker.recordFailure(`Critical rejection: ${rejection.reason}`);
    }

    return proposal;
  }

  // ── Mark execution ────────────────────────────────────────────────

  markExecuting(proposalId: string): MultisigProposal {
    const proposal = this.getProposalOrThrow(proposalId);

    if (proposal.status !== 'approved') {
      throw new Error(`Proposal ${proposalId} is ${proposal.status}, cannot execute`);
    }

    // Timelock check
    if (proposal.timelockUntil && Date.now() < proposal.timelockUntil) {
      const remaining = Math.ceil((proposal.timelockUntil - Date.now()) / 1000);
      throw new Error(`Proposal ${proposalId} is in timelock — ${remaining}s remaining`);
    }

    proposal.status = 'executing';
    return proposal;
  }

  markExecuted(proposalId: string, signature: string): MultisigProposal {
    const proposal = this.getProposalOrThrow(proposalId);

    if (proposal.status !== 'executing') {
      throw new Error(`Proposal ${proposalId} is ${proposal.status}, cannot mark executed`);
    }

    proposal.status = 'executed';
    proposal.executionSignature = signature;

    // Track spending
    this.hourlySpent += proposal.amount;
    this.dailySpent += proposal.amount;

    this.circuitBreaker.recordSuccess();

    this.audit('info', 'proposal_executed', proposalId, {
      signature,
      amount: proposal.amount,
      dailySpent: this.dailySpent,
    });

    logger.info('✅ Proposal executed', { proposalId, signature });

    return proposal;
  }

  markFailed(proposalId: string, reason: string): MultisigProposal {
    const proposal = this.getProposalOrThrow(proposalId);
    proposal.status = 'failed';

    this.circuitBreaker.recordFailure(reason);

    this.audit('critical', 'proposal_failed', proposalId, { reason });
    logger.error('❌ Proposal execution failed', { proposalId, reason });

    return proposal;
  }

  // ── Queries ───────────────────────────────────────────────────────

  getProposal(proposalId: string): MultisigProposal | undefined {
    return this.proposals.get(proposalId);
  }

  getReadyToExecute(): MultisigProposal[] {
    const now = Date.now();
    return Array.from(this.proposals.values()).filter(p => {
      if (p.status !== 'approved') return false;
      if (p.timelockUntil && now < p.timelockUntil) return false;
      return true;
    });
  }

  getPendingProposals(): MultisigProposal[] {
    return Array.from(this.proposals.values()).filter(p => p.status === 'pending');
  }

  getSpendingStatus(): { hourly: number; daily: number; hourlyLimit: number; dailyLimit: number } {
    this.resetLimitsIfNeeded();
    return {
      hourly: this.hourlySpent,
      daily: this.dailySpent,
      hourlyLimit: this.policy.hourlyLimit,
      dailyLimit: this.policy.dailyLimit,
    };
  }

  getAuditLog(limit: number = 100): AuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Cleanup: marca expiradas e remove propostas antigas.
   */
  cleanup(): number {
    let cleaned = 0;
    const cutoff = Date.now() - 86_400_000; // 24h

    for (const [id, proposal] of this.proposals) {
      if (this.isExpired(proposal) && proposal.status === 'pending') {
        proposal.status = 'expired';
        cleaned++;
      }
      // Remove finalized proposals older than 24h
      if (
        ['executed', 'rejected', 'expired', 'failed'].includes(proposal.status) &&
        proposal.createdAt < cutoff
      ) {
        this.proposals.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ── Internal ──────────────────────────────────────────────────────

  private getProposalOrThrow(proposalId: string): MultisigProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    return proposal;
  }

  private isExpired(proposal: MultisigProposal): boolean {
    return Date.now() > proposal.expiresAt;
  }

  private resetLimitsIfNeeded(): void {
    const now = Date.now();
    if (now - this.hourlyResetTime >= 3_600_000) {
      this.hourlySpent = 0;
      this.hourlyResetTime = now;
    }
    if (now - this.dailyResetTime >= 86_400_000) {
      this.dailySpent = 0;
      this.dailyResetTime = now;
    }
  }

  private generateProposalId(): string {
    return `prop_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private audit(
    severity: AuditEntry['severity'],
    event: string,
    proposalId: string,
    details: Record<string, unknown>,
  ): void {
    const entry: AuditEntry = {
      timestamp: Date.now(),
      event,
      proposalId,
      details,
      severity,
    };
    this.auditLog.push(entry);
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-500);
    }
  }
}
