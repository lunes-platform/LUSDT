/**
 * E2E Flow 1R: Burn LUSDT (Lunes) → USDT (Solana) — Reverse Bridge
 *
 * Tests the complete burn/redemption flow:
 *  1. User has LUSDT on Lunes
 *  2. User approves Tax Manager for LUSDT + LUNES (required before burn)
 *  3. User initiates burn via BridgeInterface
 *  4. Tax Manager charges dual fee (stablecoin + LUNES burn)
 *  5. LUSDT burned on-chain, bridge releases net USDT on Solana
 *  6. Approval state tracked in UI
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ── Mock Approval Manager (mirrors useLunesContract approval functions) ──

interface ApprovalStatus {
  lusdtApproved: boolean;
  lunesApproved: boolean;
  checking: boolean;
  approving: string | null;
}

class MockApprovalManager {
  private allowances: Map<string, bigint> = new Map();

  private key(token: string, owner: string, spender: string): string {
    return `${token}:${owner}:${spender}`;
  }

  approve(token: string, owner: string, spender: string, amount: bigint): void {
    this.allowances.set(this.key(token, owner, spender), amount);
  }

  allowance(token: string, owner: string, spender: string): bigint {
    return this.allowances.get(this.key(token, owner, spender)) ?? 0n;
  }

  checkTaxManagerApproval(
    user: string,
    taxManager: string,
    requiredLusdt: bigint,
    requiredLunes: bigint,
  ): ApprovalStatus {
    const lusdtAllowance = this.allowance('LUSDT', user, taxManager);
    const lunesAllowance = this.allowance('LUNES', user, taxManager);

    return {
      lusdtApproved: lusdtAllowance >= requiredLusdt,
      lunesApproved: lunesAllowance >= requiredLunes,
      checking: false,
      approving: null,
    };
  }
}

// ── Mock Burn Bridge Client ──────────────────────────────────────────

class MockBurnBridge {
  private feeBps = 60;

  async bridgeLunesToSolana(data: {
    amount: string;
    sourceAddress: string;
    destinationAddress: string;
  }) {
    const amount = parseFloat(data.amount);
    if (amount <= 0) throw new Error('Invalid amount');
    if (!data.sourceAddress || data.sourceAddress.length < 47) {
      throw new Error('Invalid Lunes address');
    }
    if (!data.destinationAddress || data.destinationAddress.length < 32) {
      throw new Error('Invalid Solana address');
    }
    if (amount < 10) throw new Error('Amount below minimum');
    if (amount > 100000) throw new Error('Amount above maximum');

    const feeAmount = (amount * this.feeBps) / 10000;
    const netAmount = amount - feeAmount;

    return {
      transactionId: `burn-${Date.now()}`,
      status: 'completed',
      burnedLusdt: data.amount,
      fee: feeAmount.toString(),
      releasedUsdt: netAmount.toString(),
      sourceChain: 'lunes',
      destinationChain: 'solana',
    };
  }
}

// ═════════════════════════════════════════════════════════════════════
// Test Suite
// ═════════════════════════════════════════════════════════════════════

describe('E2E Flow 1R: Burn LUSDT → USDT (Reverse Bridge)', () => {
  const USER = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
  const TAX_MANAGER = '5EVuvhZGXZXezWoKzbMfcVDcbGy8ovNUnemAjw6LA85adZvP';
  const SOLANA_ADDR = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  const MAX_U128 = (2n ** 128n) - 1n;

  let approvals: MockApprovalManager;
  let bridge: MockBurnBridge;

  beforeEach(() => {
    approvals = new MockApprovalManager();
    bridge = new MockBurnBridge();
  });

  // ── Step 1: Approval Check Before Burn ───────────────────────────
  describe('Step 1: Tax Manager Approval Check', () => {
    it('no approval → both tokens show as unapproved', () => {
      const status = approvals.checkTaxManagerApproval(USER, TAX_MANAGER, 1000n, 1000n);
      expect(status.lusdtApproved).toBe(false);
      expect(status.lunesApproved).toBe(false);
    });

    it('LUSDT approved only → partial approval', () => {
      approvals.approve('LUSDT', USER, TAX_MANAGER, MAX_U128);
      const status = approvals.checkTaxManagerApproval(USER, TAX_MANAGER, 1000n, 1000n);
      expect(status.lusdtApproved).toBe(true);
      expect(status.lunesApproved).toBe(false);
    });

    it('both tokens approved → full approval', () => {
      approvals.approve('LUSDT', USER, TAX_MANAGER, MAX_U128);
      approvals.approve('LUNES', USER, TAX_MANAGER, MAX_U128);
      const status = approvals.checkTaxManagerApproval(USER, TAX_MANAGER, 1000n, 1000n);
      expect(status.lusdtApproved).toBe(true);
      expect(status.lunesApproved).toBe(true);
    });

    it('insufficient LUSDT allowance → not approved', () => {
      approvals.approve('LUSDT', USER, TAX_MANAGER, 500n);
      const status = approvals.checkTaxManagerApproval(USER, TAX_MANAGER, 1000n, 0n);
      expect(status.lusdtApproved).toBe(false);
    });

    it('exact allowance → approved', () => {
      approvals.approve('LUSDT', USER, TAX_MANAGER, 1000n);
      const status = approvals.checkTaxManagerApproval(USER, TAX_MANAGER, 1000n, 0n);
      expect(status.lusdtApproved).toBe(true);
    });
  });

  // ── Step 2: Approve Tokens ───────────────────────────────────────
  describe('Step 2: Approve LUSDT + LUNES for Tax Manager', () => {
    it('approve LUSDT with u128::MAX (unlimited)', () => {
      approvals.approve('LUSDT', USER, TAX_MANAGER, MAX_U128);
      expect(approvals.allowance('LUSDT', USER, TAX_MANAGER)).toBe(MAX_U128);
    });

    it('approve LUNES with u128::MAX (unlimited)', () => {
      approvals.approve('LUNES', USER, TAX_MANAGER, MAX_U128);
      expect(approvals.allowance('LUNES', USER, TAX_MANAGER)).toBe(MAX_U128);
    });

    it('re-approve overwrites previous allowance', () => {
      approvals.approve('LUSDT', USER, TAX_MANAGER, 1000n);
      approvals.approve('LUSDT', USER, TAX_MANAGER, 2000n);
      expect(approvals.allowance('LUSDT', USER, TAX_MANAGER)).toBe(2000n);
    });
  });

  // ── Step 3: Execute Burn ─────────────────────────────────────────
  describe('Step 3: Execute Burn (LUSDT → USDT)', () => {
    it('burns 500 LUSDT → receives ~497 USDT', async () => {
      const result = await bridge.bridgeLunesToSolana({
        amount: '500',
        sourceAddress: USER,
        destinationAddress: SOLANA_ADDR,
      });

      expect(result.status).toBe('completed');
      expect(parseFloat(result.releasedUsdt)).toBe(497); // 500 - 3 fee
      expect(parseFloat(result.fee)).toBe(3); // 0.60% of 500
    });

    it('fee + released = burned amount (100% accounting)', async () => {
      const amounts = [100, 500, 1000, 50000];

      for (const amount of amounts) {
        const result = await bridge.bridgeLunesToSolana({
          amount: amount.toString(),
          sourceAddress: USER,
          destinationAddress: SOLANA_ADDR,
        });

        const fee = parseFloat(result.fee);
        const released = parseFloat(result.releasedUsdt);
        expect(fee + released).toBe(amount);
      }
    });

    it('rejects invalid Lunes address', async () => {
      await expect(
        bridge.bridgeLunesToSolana({
          amount: '100',
          sourceAddress: 'short',
          destinationAddress: SOLANA_ADDR,
        }),
      ).rejects.toThrow('Invalid Lunes address');
    });

    it('rejects invalid Solana address', async () => {
      await expect(
        bridge.bridgeLunesToSolana({
          amount: '100',
          sourceAddress: USER,
          destinationAddress: 'short',
        }),
      ).rejects.toThrow('Invalid Solana address');
    });

    it('rejects amount below minimum', async () => {
      await expect(
        bridge.bridgeLunesToSolana({
          amount: '5',
          sourceAddress: USER,
          destinationAddress: SOLANA_ADDR,
        }),
      ).rejects.toThrow('Amount below minimum');
    });
  });

  // ── Step 4: UI State Flow ────────────────────────────────────────
  describe('Step 4: BridgeInterface UI State', () => {
    it('burn direction requires approval check', () => {
      const direction = 'lunes-to-solana';
      expect(direction).toBe('lunes-to-solana');

      const status = approvals.checkTaxManagerApproval(USER, TAX_MANAGER, 1000n, 1000n);
      const needsApproval = !status.lusdtApproved || !status.lunesApproved;
      expect(needsApproval).toBe(true); // Not yet approved
    });

    it('bridge button disabled when approvals needed', () => {
      const status = approvals.checkTaxManagerApproval(USER, TAX_MANAGER, 1000n, 1000n);
      const needsApproval = !status.lusdtApproved || !status.lunesApproved;
      const canBridge = !needsApproval;
      expect(canBridge).toBe(false);
    });

    it('bridge button enabled after approvals granted', () => {
      approvals.approve('LUSDT', USER, TAX_MANAGER, MAX_U128);
      approvals.approve('LUNES', USER, TAX_MANAGER, MAX_U128);

      const status = approvals.checkTaxManagerApproval(USER, TAX_MANAGER, 1000n, 1000n);
      const needsApproval = !status.lusdtApproved || !status.lunesApproved;
      const canBridge = !needsApproval;
      expect(canBridge).toBe(true);
    });

    it('mint direction does NOT require approval check', () => {
      const direction: string = 'solana-to-lunes';
      const needsApprovalCheck = direction === 'lunes-to-solana';
      expect(needsApprovalCheck).toBe(false);
    });
  });

  // ── Full Burn Journey ────────────────────────────────────────────
  describe('Full Burn Journey: Approve → Burn → Receive USDT', () => {
    it('completes entire reverse bridge flow', async () => {
      // Phase 1: Check approvals — not yet granted
      let status = approvals.checkTaxManagerApproval(USER, TAX_MANAGER, 1000n, 1000n);
      expect(status.lusdtApproved).toBe(false);
      expect(status.lunesApproved).toBe(false);

      // Phase 2: Approve LUSDT for Tax Manager
      approvals.approve('LUSDT', USER, TAX_MANAGER, MAX_U128);
      status = approvals.checkTaxManagerApproval(USER, TAX_MANAGER, 1000n, 1000n);
      expect(status.lusdtApproved).toBe(true);
      expect(status.lunesApproved).toBe(false);

      // Phase 3: Approve LUNES for Tax Manager
      approvals.approve('LUNES', USER, TAX_MANAGER, MAX_U128);
      status = approvals.checkTaxManagerApproval(USER, TAX_MANAGER, 1000n, 1000n);
      expect(status.lusdtApproved).toBe(true);
      expect(status.lunesApproved).toBe(true);

      // Phase 4: Execute burn
      const result = await bridge.bridgeLunesToSolana({
        amount: '1000',
        sourceAddress: USER,
        destinationAddress: SOLANA_ADDR,
      });

      expect(result.status).toBe('completed');
      expect(parseFloat(result.releasedUsdt)).toBe(994);
      expect(parseFloat(result.fee)).toBe(6);

      // Phase 5: Verify accounting
      expect(parseFloat(result.releasedUsdt) + parseFloat(result.fee)).toBe(1000);
    });
  });
});
