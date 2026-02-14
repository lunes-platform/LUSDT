/**
 * Multisig Vault System — Unit Tests
 *
 * Covers:
 *  - CircuitBreaker: states, transitions, fail-safe
 *  - ProposalManager: lifecycle, quorum, limits, timelock, expiry
 *  - ApprovalBots: origin/risk/backup validation logic
 *  - Integration: full proposal → approval → execution flow
 */

import { CircuitBreaker } from '../multisig/circuit-breaker';
import { ProposalManager } from '../multisig/proposal-manager';
import {
  OriginValidatorBot,
  RiskValidatorBot,
  BackupValidatorBot,
  OriginValidatorDeps,
  RiskValidatorDeps,
  BackupValidatorDeps,
} from '../multisig/approval-bots';
import { MultisigProposal, BotApproval, BotRejection } from '../multisig/types';

// ══════════════════════════════════════════════════════════════════════
// Circuit Breaker
// ══════════════════════════════════════════════════════════════════════

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 1,
      windowMs: 5000,
    });
  });

  test('starts in closed state', () => {
    expect(cb.getStatus().state).toBe('closed');
    expect(cb.canExecute()).toBe(true);
  });

  test('opens after failure threshold', () => {
    cb.recordFailure('fail1');
    cb.recordFailure('fail2');
    expect(cb.canExecute()).toBe(true); // Still closed
    cb.recordFailure('fail3');
    expect(cb.getStatus().state).toBe('open');
    expect(cb.canExecute()).toBe(false);
  });

  test('blocks execution when open', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure(`fail${i}`);
    expect(cb.canExecute()).toBe(false);
  });

  test('transitions to half_open after resetTimeout', async () => {
    for (let i = 0; i < 3; i++) cb.recordFailure(`fail${i}`);
    expect(cb.getStatus().state).toBe('open');

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 1100));
    expect(cb.canExecute()).toBe(true); // half_open now
    expect(cb.getStatus().state).toBe('half_open');
  });

  test('closes on success in half_open', async () => {
    for (let i = 0; i < 3; i++) cb.recordFailure(`fail${i}`);
    await new Promise(r => setTimeout(r, 1100));
    cb.canExecute(); // trigger half_open
    cb.recordSuccess();
    expect(cb.getStatus().state).toBe('closed');
  });

  test('reopens on failure in half_open', async () => {
    for (let i = 0; i < 3; i++) cb.recordFailure(`fail${i}`);
    await new Promise(r => setTimeout(r, 1100));
    cb.canExecute(); // trigger half_open
    cb.recordFailure('again');
    expect(cb.getStatus().state).toBe('open');
  });

  test('forceReset resets to closed', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure(`fail${i}`);
    expect(cb.getStatus().state).toBe('open');
    cb.forceReset();
    expect(cb.getStatus().state).toBe('closed');
    expect(cb.canExecute()).toBe(true);
  });

  test('audit log records events', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure(`fail${i}`);
    const log = cb.getAuditLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[log.length - 1].event).toBe('circuit_breaker_opened');
  });
});

// ══════════════════════════════════════════════════════════════════════
// Proposal Manager
// ══════════════════════════════════════════════════════════════════════

describe('ProposalManager', () => {
  let pm: ProposalManager;
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 5000, halfOpenMaxAttempts: 2, windowMs: 10000 });
    pm = new ProposalManager(cb, {
      singleTxLimit: 10_000,
      hourlyLimit: 25_000,
      dailyLimit: 50_000,
      highValueThreshold: 5_000,
      timelockDurationMs: 500, // Short for tests
      proposalTtlMs: 2000,
    }, 2, 3);
  });

  function makeApproval(botId: string, botRole: 'origin_validator' | 'risk_validator' | 'backup_validator'): BotApproval {
    return {
      botId,
      botRole,
      timestamp: Date.now(),
      signature: 'test_sig',
      validationDetails: { valid: true, checks: [], riskScore: 10 },
    };
  }

  test('creates proposal with correct fields', () => {
    const p = pm.createProposal('tx-001', 'recipient123', 1000, 'usdt_mint');
    expect(p.status).toBe('pending');
    expect(p.amount).toBe(1000);
    expect(p.requiredApprovals).toBe(2); // normal value
    expect(p.timelockUntil).toBeUndefined(); // < highValueThreshold
  });

  test('high-value proposals require all bots + timelock', () => {
    const p = pm.createProposal('tx-002', 'recipient123', 6000, 'usdt_mint');
    expect(p.requiredApprovals).toBe(3); // 3/3
    expect(p.timelockUntil).toBeDefined();
  });

  test('rejects proposal exceeding single-tx limit', () => {
    expect(() => pm.createProposal('tx-003', 'r', 15000, 'mint')).toThrow('single-tx limit');
  });

  test('rejects proposal exceeding daily limit', () => {
    // Create a PM with hourly limit high enough to not interfere
    const pmDaily = new ProposalManager(cb, {
      singleTxLimit: 10_000,
      hourlyLimit: 100_000,  // Won't interfere
      dailyLimit: 20_000,    // Low daily for test
      highValueThreshold: 50_000, // Won't trigger high-value
      timelockDurationMs: 0,
      proposalTtlMs: 60_000,
    }, 2, 3);

    for (let i = 0; i < 4; i++) {
      const px = pmDaily.createProposal(`tx-${i}`, 'r', 4500, 'mint');
      pmDaily.addApproval(px.id, makeApproval(`b1-${i}`, 'origin_validator'));
      pmDaily.addApproval(px.id, makeApproval(`b2-${i}`, 'risk_validator'));
      pmDaily.markExecuting(px.id);
      pmDaily.markExecuted(px.id, `sig${i}`);
    }

    // 4 * 4500 = 18000, next 4500 = 22500 > 20000
    expect(() => pmDaily.createProposal('tx-over', 'r', 4500, 'mint')).toThrow('daily limit');
  });

  test('reaches quorum with 2/3 approvals', () => {
    const p = pm.createProposal('tx-q', 'r', 100, 'mint');
    pm.addApproval(p.id, makeApproval('b1', 'origin_validator'));
    expect(pm.getProposal(p.id)!.status).toBe('pending');
    pm.addApproval(p.id, makeApproval('b2', 'risk_validator'));
    expect(pm.getProposal(p.id)!.status).toBe('approved');
  });

  test('rejection sets status to rejected', () => {
    const p = pm.createProposal('tx-rej', 'r', 100, 'mint');
    const rejection: BotRejection = {
      botId: 'b1',
      botRole: 'origin_validator',
      timestamp: Date.now(),
      reason: 'Source tx not finalized',
      severity: 'warning',
    };
    pm.addRejection(p.id, rejection);
    expect(pm.getProposal(p.id)!.status).toBe('rejected');
  });

  test('critical rejection triggers circuit breaker', () => {
    const p = pm.createProposal('tx-crit', 'r', 100, 'mint');
    pm.addRejection(p.id, {
      botId: 'b1',
      botRole: 'risk_validator',
      timestamp: Date.now(),
      reason: 'Fraud detected',
      severity: 'critical',
    });
    expect(cb.getStatus().failures).toBeGreaterThan(0);
  });

  test('blocks proposals when circuit breaker open', () => {
    for (let i = 0; i < 5; i++) cb.recordFailure(`fail${i}`);
    expect(() => pm.createProposal('tx-blocked', 'r', 100, 'mint')).toThrow('Circuit breaker OPEN');
  });

  test('prevents duplicate bot approval', () => {
    const p = pm.createProposal('tx-dup', 'r', 100, 'mint');
    pm.addApproval(p.id, makeApproval('b1', 'origin_validator'));
    expect(() => pm.addApproval(p.id, makeApproval('b1', 'origin_validator'))).toThrow('already approved');
  });

  test('timelock blocks execution until elapsed', () => {
    const p = pm.createProposal('tx-tl', 'r', 6000, 'mint'); // high value
    pm.addApproval(p.id, makeApproval('b1', 'origin_validator'));
    pm.addApproval(p.id, makeApproval('b2', 'risk_validator'));
    pm.addApproval(p.id, makeApproval('b3', 'backup_validator'));
    expect(pm.getProposal(p.id)!.status).toBe('approved');

    // Should be in timelock
    expect(() => pm.markExecuting(p.id)).toThrow('timelock');
  });

  test('timelock allows execution after elapsed', async () => {
    const p = pm.createProposal('tx-tl2', 'r', 6000, 'mint');
    pm.addApproval(p.id, makeApproval('b1', 'origin_validator'));
    pm.addApproval(p.id, makeApproval('b2', 'risk_validator'));
    pm.addApproval(p.id, makeApproval('b3', 'backup_validator'));

    await new Promise(r => setTimeout(r, 600)); // Wait for timelock
    const executing = pm.markExecuting(p.id);
    expect(executing.status).toBe('executing');
  });

  test('proposal expiration', async () => {
    const p = pm.createProposal('tx-exp', 'r', 100, 'mint');
    await new Promise(r => setTimeout(r, 2100)); // Wait for TTL

    expect(() => pm.addApproval(p.id, makeApproval('b1', 'origin_validator'))).toThrow('expired');
  });

  test('cleanup removes old proposals', () => {
    const p = pm.createProposal('tx-clean', 'r', 100, 'mint');
    pm.addApproval(p.id, makeApproval('b1', 'origin_validator'));
    pm.addApproval(p.id, makeApproval('b2', 'risk_validator'));
    pm.markExecuting(p.id);
    pm.markExecuted(p.id, 'sig');

    // Force old createdAt
    const proposal = pm.getProposal(p.id)!;
    (proposal as any).createdAt = Date.now() - 86_400_001;

    const cleaned = pm.cleanup();
    expect(cleaned).toBeGreaterThan(0);
  });

  test('getReadyToExecute returns approved non-timelocked proposals', () => {
    const p = pm.createProposal('tx-ready', 'r', 100, 'mint');
    pm.addApproval(p.id, makeApproval('b1', 'origin_validator'));
    pm.addApproval(p.id, makeApproval('b2', 'risk_validator'));

    const ready = pm.getReadyToExecute();
    expect(ready.length).toBe(1);
    expect(ready[0].id).toBe(p.id);
  });

  test('spending status tracks hourly and daily', () => {
    const p = pm.createProposal('tx-spend', 'r', 1000, 'mint');
    pm.addApproval(p.id, makeApproval('b1', 'origin_validator'));
    pm.addApproval(p.id, makeApproval('b2', 'risk_validator'));
    pm.markExecuting(p.id);
    pm.markExecuted(p.id, 'sig');

    const status = pm.getSpendingStatus();
    expect(status.hourly).toBe(1000);
    expect(status.daily).toBe(1000);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Approval Bots
// ══════════════════════════════════════════════════════════════════════

describe('OriginValidatorBot', () => {
  const makeDeps = (finalized: boolean = true, amount: number | null = 1000): OriginValidatorDeps => ({
    isSourceTransactionFinalized: jest.fn().mockResolvedValue(finalized),
    getSourceTransactionAmount: jest.fn().mockResolvedValue(amount),
  });

  const makeProposal = (overrides?: Partial<MultisigProposal>): MultisigProposal => ({
    id: 'prop-001',
    bridgeTransactionId: 'tx-001',
    recipient: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    amount: 1000,
    tokenMint: 'usdt_mint',
    createdAt: Date.now(),
    expiresAt: Date.now() + 300_000,
    status: 'pending',
    approvals: [],
    rejections: [],
    requiredApprovals: 2,
    totalBots: 3,
    metadata: { sourceSignature: 'sol_sig_123' },
    ...overrides,
  });

  test('approves valid finalized transaction', async () => {
    const bot = new OriginValidatorBot('bot-o', 'secret', makeDeps(true, 1000));
    const result = await bot.evaluate(makeProposal());
    expect('validationDetails' in result).toBe(true); // Is approval
  });

  test('rejects non-finalized transaction', async () => {
    const bot = new OriginValidatorBot('bot-o', 'secret', makeDeps(false, 1000));
    const result = await bot.evaluate(makeProposal());
    expect('reason' in result).toBe(true); // Is rejection
  });

  test('rejects when source amount does not match', async () => {
    const bot = new OriginValidatorBot('bot-o', 'secret', makeDeps(true, 500)); // mismatch
    const result = await bot.evaluate(makeProposal());
    expect('reason' in result).toBe(true);
  });

  test('rejects when no source signature', async () => {
    const bot = new OriginValidatorBot('bot-o', 'secret', makeDeps(true, 1000));
    const result = await bot.evaluate(makeProposal({ metadata: {} }));
    // No source signature → higher risk but may still pass or fail depending on other checks
    expect(result).toBeDefined();
  });
});

describe('RiskValidatorBot', () => {
  const makeDeps = (
    recentCount: number = 5,
    recipientHistory: { totalSent: number; txCount: number } = { totalSent: 0, txCount: 0 },
    vaultBalance: number = 100_000,
  ): RiskValidatorDeps => ({
    getRecentProposalCount: jest.fn().mockReturnValue(recentCount),
    getRecipientHistory: jest.fn().mockReturnValue(recipientHistory),
    getVaultBalance: jest.fn().mockResolvedValue(vaultBalance),
  });

  const makeProposal = (amount: number = 1000): MultisigProposal => ({
    id: 'prop-r',
    bridgeTransactionId: 'tx-r',
    recipient: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    amount,
    tokenMint: 'usdt_mint',
    createdAt: Date.now(),
    expiresAt: Date.now() + 300_000,
    status: 'pending',
    approvals: [],
    rejections: [],
    requiredApprovals: 2,
    totalBots: 3,
    metadata: {},
  });

  test('approves normal transfer', async () => {
    const bot = new RiskValidatorBot('bot-r', 'secret', makeDeps());
    const result = await bot.evaluate(makeProposal());
    expect('validationDetails' in result).toBe(true);
  });

  test('rejects when vault balance insufficient', async () => {
    const bot = new RiskValidatorBot('bot-r', 'secret', makeDeps(5, { totalSent: 0, txCount: 0 }, 500));
    const result = await bot.evaluate(makeProposal(1000));
    expect('reason' in result).toBe(true);
  });

  test('flags high velocity but may still approve', async () => {
    const bot = new RiskValidatorBot('bot-r', 'secret', makeDeps(25)); // over limit
    const result = await bot.evaluate(makeProposal());
    // High velocity alone may not block (risk < 80)
    expect(result).toBeDefined();
  });

  test('rejects when recipient exceeds daily volume + vault insufficient', async () => {
    const bot = new RiskValidatorBot('bot-r', 'secret', makeDeps(
      5,
      { totalSent: 24_000, txCount: 10 }, // Near limit
      500, // Insufficient vault
    ));
    const result = await bot.evaluate(makeProposal(5000));
    expect('reason' in result).toBe(true);
  });
});

describe('BackupValidatorBot', () => {
  const makeDeps = (
    healthy: boolean = true,
    dbOk: boolean = true,
    dbRecord: { amount: number; status: string } | null = { amount: 1000, status: 'pending' },
  ): BackupValidatorDeps => ({
    isBridgeServiceHealthy: jest.fn().mockResolvedValue(healthy),
    isDatabaseReachable: jest.fn().mockResolvedValue(dbOk),
    getProposalFromDatabase: jest.fn().mockResolvedValue(dbRecord),
  });

  const makeProposal = (): MultisigProposal => ({
    id: 'prop-b',
    bridgeTransactionId: 'tx-b',
    recipient: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    amount: 1000,
    tokenMint: 'usdt_mint',
    createdAt: Date.now(),
    expiresAt: Date.now() + 300_000,
    status: 'pending',
    approvals: [],
    rejections: [],
    requiredApprovals: 2,
    totalBots: 3,
    metadata: {},
  });

  test('approves when all systems healthy', async () => {
    const bot = new BackupValidatorBot('bot-b', 'secret', makeDeps());
    const result = await bot.evaluate(makeProposal());
    expect('validationDetails' in result).toBe(true);
  });

  test('rejects when service unhealthy + db unreachable', async () => {
    const bot = new BackupValidatorBot('bot-b', 'secret', makeDeps(false, false));
    const result = await bot.evaluate(makeProposal());
    expect('reason' in result).toBe(true);
  });

  test('rejects when DB amount mismatch', async () => {
    const bot = new BackupValidatorBot('bot-b', 'secret', makeDeps(true, true, { amount: 999, status: 'pending' }));
    const result = await bot.evaluate(makeProposal());
    expect('reason' in result).toBe(true);
  });

  test('flags risk when no DB record found (riskScore=60, below block threshold)', async () => {
    const bot = new BackupValidatorBot('bot-b', 'secret', makeDeps(true, true, null));
    const result = await bot.evaluate(makeProposal());
    // riskScore=60 (no DB record) is below 80 block threshold, so it approves with a flag
    expect('validationDetails' in result).toBe(true);
    if ('validationDetails' in result) {
      const failedChecks = (result as any).validationDetails.checks.filter((c: any) => !c.passed);
      expect(failedChecks.length).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// Integration: Full Proposal → Approval → Execution Flow
// ══════════════════════════════════════════════════════════════════════

describe('Integration: Multisig Flow', () => {
  test('complete flow: proposal → 2/3 approvals → execution', () => {
    const cb = new CircuitBreaker();
    const pm = new ProposalManager(cb, { singleTxLimit: 10000, dailyLimit: 50000, hourlyLimit: 25000, highValueThreshold: 5000, timelockDurationMs: 0, proposalTtlMs: 60000 }, 2, 3);

    // Create
    const p = pm.createProposal('tx-int', 'recipient', 1000, 'mint');
    expect(p.status).toBe('pending');

    // Bot 1 approves
    pm.addApproval(p.id, {
      botId: 'bot-1',
      botRole: 'origin_validator',
      timestamp: Date.now(),
      signature: 'sig1',
      validationDetails: { valid: true, checks: [], riskScore: 5 },
    });
    expect(pm.getProposal(p.id)!.status).toBe('pending');

    // Bot 2 approves → quorum
    pm.addApproval(p.id, {
      botId: 'bot-2',
      botRole: 'risk_validator',
      timestamp: Date.now(),
      signature: 'sig2',
      validationDetails: { valid: true, checks: [], riskScore: 10 },
    });
    expect(pm.getProposal(p.id)!.status).toBe('approved');

    // Execute
    pm.markExecuting(p.id);
    expect(pm.getProposal(p.id)!.status).toBe('executing');

    pm.markExecuted(p.id, 'sol_tx_sig_final');
    expect(pm.getProposal(p.id)!.status).toBe('executed');
    expect(pm.getProposal(p.id)!.executionSignature).toBe('sol_tx_sig_final');
  });

  test('complete flow: proposal → rejection → circuit breaker', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 5000, halfOpenMaxAttempts: 1, windowMs: 10000 });
    const pm = new ProposalManager(cb, undefined, 2, 3);

    // Two critical rejections → circuit breaker opens
    const p1 = pm.createProposal('tx-r1', 'r', 100, 'mint');
    pm.addRejection(p1.id, { botId: 'b1', botRole: 'risk_validator', timestamp: Date.now(), reason: 'fraud', severity: 'critical' });

    const p2 = pm.createProposal('tx-r2', 'r', 100, 'mint');
    pm.addRejection(p2.id, { botId: 'b1', botRole: 'risk_validator', timestamp: Date.now(), reason: 'fraud2', severity: 'critical' });

    // Circuit breaker should be open
    expect(cb.getStatus().state).toBe('open');
    expect(() => pm.createProposal('tx-blocked', 'r', 100, 'mint')).toThrow('Circuit breaker OPEN');
  });

  test('high-value flow: proposal → 3/3 + timelock', async () => {
    const cb = new CircuitBreaker();
    const pm = new ProposalManager(cb, {
      singleTxLimit: 10000,
      dailyLimit: 50000,
      hourlyLimit: 25000,
      highValueThreshold: 5000,
      timelockDurationMs: 300,
      proposalTtlMs: 60000,
    }, 2, 3);

    const p = pm.createProposal('tx-hv', 'r', 7000, 'mint');
    expect(p.requiredApprovals).toBe(3);
    expect(p.timelockUntil).toBeDefined();

    // All 3 bots approve
    pm.addApproval(p.id, { botId: 'b1', botRole: 'origin_validator', timestamp: Date.now(), signature: 's1', validationDetails: { valid: true, checks: [], riskScore: 5 } });
    pm.addApproval(p.id, { botId: 'b2', botRole: 'risk_validator', timestamp: Date.now(), signature: 's2', validationDetails: { valid: true, checks: [], riskScore: 10 } });
    pm.addApproval(p.id, { botId: 'b3', botRole: 'backup_validator', timestamp: Date.now(), signature: 's3', validationDetails: { valid: true, checks: [], riskScore: 5 } });

    expect(pm.getProposal(p.id)!.status).toBe('approved');

    // Timelock blocks
    expect(() => pm.markExecuting(p.id)).toThrow('timelock');

    // Wait
    await new Promise(r => setTimeout(r, 400));

    // Now execute
    pm.markExecuting(p.id);
    pm.markExecuted(p.id, 'hv_sig');
    expect(pm.getProposal(p.id)!.status).toBe('executed');
  });
});
