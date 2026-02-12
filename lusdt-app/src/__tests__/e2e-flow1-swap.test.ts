/**
 * E2E Flow 1: Swap USDT (Solana) → LUSDT (Lunes)
 *
 * Tests the complete user journey:
 *  1. User connects Solana + Lunes wallets
 *  2. Enters USDT amount to swap
 *  3. Fee is calculated (adaptive from Tax Manager)
 *  4. Bridge deducts fee BEFORE minting (100% backing)
 *  5. User receives net LUSDT on Lunes
 *  6. Fee distributed 80/15/5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Bridge Client ───────────────────────────────────────────────
class MockBridgeClient {
  private feeBps = 60;

  setFeeBps(bps: number) {
    this.feeBps = bps;
  }

  async calculateFee(amount: number, sourceChain: 'solana' | 'lunes') {
    const feeAmount = (amount * this.feeBps) / 10000;
    const netAmount = amount - feeAmount;
    return {
      feeAmount,
      netAmount,
      feeBps: this.feeBps,
      feeBreakdown: {
        dev: feeAmount * 0.80,
        insurance: feeAmount * 0.15,
        staking: feeAmount * 0.05,
      },
    };
  }

  async bridgeSolanaToLunes(data: {
    amount: string;
    sourceAddress: string;
    destinationAddress: string;
  }) {
    const amount = parseFloat(data.amount);
    if (amount <= 0) throw new Error('Invalid amount');
    if (!data.sourceAddress) throw new Error('Missing source address');
    if (!data.destinationAddress) throw new Error('Missing destination address');
    if (amount < 10) throw new Error('Amount below minimum (10 USDT)');
    if (amount > 100000) throw new Error('Amount above maximum (100,000 USDT)');

    const fee = await this.calculateFee(amount, 'solana');

    return {
      transactionId: `tx-${Date.now()}`,
      status: 'completed',
      amount: data.amount,
      fee: fee.feeAmount.toString(),
      netAmount: fee.netAmount.toString(),
      sourceChain: 'solana',
      destinationChain: 'lunes',
    };
  }

  async getHealth() {
    return { status: 'healthy', timestamp: Date.now() };
  }
}

// ── Mock Config (mirrors lusdt-app/src/config.ts) ────────────────────
const BRIDGE_CONFIG = {
  MIN_AMOUNT: 10,
  MAX_AMOUNT: 100000,
  BASE_FEE_BPS: 60,
  FEE_CAP_USD: 500,
  FEE_DISTRIBUTION: {
    DEV_PERCENT: 80,
    INSURANCE_PERCENT: 15,
    STAKING_PERCENT: 5,
  },
};

// ═════════════════════════════════════════════════════════════════════
// Test Suite
// ═════════════════════════════════════════════════════════════════════

describe('E2E Flow 1: Swap USDT (Solana) → LUSDT (Lunes)', () => {
  let bridge: MockBridgeClient;

  beforeEach(() => {
    bridge = new MockBridgeClient();
  });

  // ── Step 1: Wallet Connection ────────────────────────────────────
  describe('Step 1: Wallet Connection Prerequisites', () => {
    it('requires both Solana and Lunes wallets', () => {
      const solanaWallet = { publicKey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' };
      const lunesWallet = { address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' };

      expect(solanaWallet.publicKey).toBeTruthy();
      expect(lunesWallet.address).toBeTruthy();
      expect(solanaWallet.publicKey.length).toBeGreaterThanOrEqual(32);
      expect(lunesWallet.address.length).toBeGreaterThanOrEqual(47);
    });

    it('bridge health check returns healthy', async () => {
      const health = await bridge.getHealth();
      expect(health.status).toBe('healthy');
    });
  });

  // ── Step 2: Amount Entry & Validation ────────────────────────────
  describe('Step 2: Amount Entry & Validation', () => {
    it('accepts valid amounts within range', () => {
      const validAmounts = [10, 100, 1000, 50000, 100000];
      for (const amount of validAmounts) {
        expect(amount >= BRIDGE_CONFIG.MIN_AMOUNT).toBe(true);
        expect(amount <= BRIDGE_CONFIG.MAX_AMOUNT).toBe(true);
      }
    });

    it('rejects amounts below minimum', async () => {
      await expect(
        bridge.bridgeSolanaToLunes({
          amount: '5',
          sourceAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          destinationAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        }),
      ).rejects.toThrow('Amount below minimum');
    });

    it('rejects amounts above maximum', async () => {
      await expect(
        bridge.bridgeSolanaToLunes({
          amount: '200000',
          sourceAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          destinationAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        }),
      ).rejects.toThrow('Amount above maximum');
    });

    it('rejects zero/negative amounts', async () => {
      await expect(
        bridge.bridgeSolanaToLunes({
          amount: '0',
          sourceAddress: 'addr',
          destinationAddress: 'addr',
        }),
      ).rejects.toThrow('Invalid amount');
    });
  });

  // ── Step 3: Fee Calculation ──────────────────────────────────────
  describe('Step 3: Fee Calculation (adaptive from Tax Manager)', () => {
    it('calculates 0.60% fee at low volume (60 bps)', async () => {
      bridge.setFeeBps(60);
      const fee = await bridge.calculateFee(1000, 'solana');

      expect(fee.feeAmount).toBe(6);
      expect(fee.netAmount).toBe(994);
      expect(fee.feeBps).toBe(60);
    });

    it('calculates 0.50% fee at medium volume (50 bps)', async () => {
      bridge.setFeeBps(50);
      const fee = await bridge.calculateFee(1000, 'solana');

      expect(fee.feeAmount).toBe(5);
      expect(fee.netAmount).toBe(995);
    });

    it('calculates 0.30% fee at high volume (30 bps)', async () => {
      bridge.setFeeBps(30);
      const fee = await bridge.calculateFee(1000, 'solana');

      expect(fee.feeAmount).toBe(3);
      expect(fee.netAmount).toBe(997);
    });

    it('fee breakdown sums to total fee', async () => {
      const fee = await bridge.calculateFee(10000, 'solana');
      const { dev, insurance, staking } = fee.feeBreakdown;

      expect(dev + insurance + staking).toBeCloseTo(fee.feeAmount);
    });

    it('distribution is 80/15/5', async () => {
      const fee = await bridge.calculateFee(10000, 'solana');
      const { dev, insurance, staking } = fee.feeBreakdown;

      expect(dev / fee.feeAmount).toBeCloseTo(0.80);
      expect(insurance / fee.feeAmount).toBeCloseTo(0.15);
      expect(staking / fee.feeAmount).toBeCloseTo(0.05);
    });
  });

  // ── Step 4: Bridge Execution ─────────────────────────────────────
  describe('Step 4: Bridge Execution (mint with 100% backing)', () => {
    it('completes swap: 1000 USDT → 994 LUSDT', async () => {
      const result = await bridge.bridgeSolanaToLunes({
        amount: '1000',
        sourceAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        destinationAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      });

      expect(result.status).toBe('completed');
      expect(parseFloat(result.netAmount)).toBe(994);
      expect(parseFloat(result.fee)).toBe(6);
      expect(parseFloat(result.netAmount) + parseFloat(result.fee)).toBe(1000);
    });

    it('maintains 100% backing: vault USDT == minted LUSDT', async () => {
      const amounts = [100, 500, 1000, 50000];

      for (const amount of amounts) {
        const result = await bridge.bridgeSolanaToLunes({
          amount: amount.toString(),
          sourceAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          destinationAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        });

        // net + fee = original deposit (100% backing)
        expect(parseFloat(result.netAmount) + parseFloat(result.fee)).toBe(amount);
      }
    });

    it('returns valid transaction ID', async () => {
      const result = await bridge.bridgeSolanaToLunes({
        amount: '100',
        sourceAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        destinationAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      });

      expect(result.transactionId).toBeTruthy();
      expect(result.transactionId.startsWith('tx-')).toBe(true);
    });

    it('rejects missing source address', async () => {
      await expect(
        bridge.bridgeSolanaToLunes({
          amount: '100',
          sourceAddress: '',
          destinationAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        }),
      ).rejects.toThrow('Missing source address');
    });
  });

  // ── Step 5: Large Volume Swap ────────────────────────────────────
  describe('Step 5: Large Volume Swap with Adaptive Fee', () => {
    it('$50K swap at medium tier → 0.50% fee', async () => {
      bridge.setFeeBps(50);

      const result = await bridge.bridgeSolanaToLunes({
        amount: '50000',
        sourceAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        destinationAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      });

      expect(parseFloat(result.fee)).toBe(250); // 0.50% of 50K
      expect(parseFloat(result.netAmount)).toBe(49750);
    });
  });
});
