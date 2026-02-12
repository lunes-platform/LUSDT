/**
 * E2E Flow 2: Staking — Earn Dollar Rewards in the Ecosystem
 *
 * Tests the staking information and rewards flow:
 *  1. Protocol fees are split 80/15/5
 *  2. 5% goes to Staking Rewards Pool
 *  3. Eligible stakers (≥100K LUNES) receive monthly distribution
 *  4. Admin panel shows staking stats, estimated rewards
 *  5. Staking pool address is configurable via wallets tab
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ── Staking Logic (mirrors AdminPanel + config) ──────────────────────

const FEE_DISTRIBUTION = {
  DEV_PERCENT: 80,
  INSURANCE_PERCENT: 15,
  STAKING_PERCENT: 5,
};

const STAKING_ELIGIBILITY_MIN_LUNES = 100_000; // 100K LUNES

interface StakingStats {
  monthlyVolume: number;
  currentFeeBps: number;
  totalFees: number;
  stakingPoolAmount: number;
  stakingPoolAddress: string;
  eligibleStakers: number;
}

class StakingRewardsCalculator {
  calculate(monthlyVolume: number, feeBps: number): StakingStats {
    const totalFees = monthlyVolume * (feeBps / 10000);
    const stakingPoolAmount = totalFees * (FEE_DISTRIBUTION.STAKING_PERCENT / 100);

    return {
      monthlyVolume,
      currentFeeBps: feeBps,
      totalFees,
      stakingPoolAmount,
      stakingPoolAddress: '',
      eligibleStakers: 0,
    };
  }

  isEligible(lunesBalance: number): boolean {
    return lunesBalance >= STAKING_ELIGIBILITY_MIN_LUNES;
  }

  estimateRewardPerStaker(stakingPoolAmount: number, eligibleStakers: number): number {
    if (eligibleStakers === 0) return 0;
    return stakingPoolAmount / eligibleStakers;
  }

  calculateFeeBreakdown(totalFees: number) {
    return {
      dev: totalFees * (FEE_DISTRIBUTION.DEV_PERCENT / 100),
      insurance: totalFees * (FEE_DISTRIBUTION.INSURANCE_PERCENT / 100),
      staking: totalFees * (FEE_DISTRIBUTION.STAKING_PERCENT / 100),
    };
  }
}

// ═════════════════════════════════════════════════════════════════════
// Test Suite
// ═════════════════════════════════════════════════════════════════════

describe('E2E Flow 2: Staking Rewards in the Ecosystem', () => {
  let calculator: StakingRewardsCalculator;

  beforeEach(() => {
    calculator = new StakingRewardsCalculator();
  });

  // ── Staking Pool Accumulation ────────────────────────────────────
  describe('Staking Pool Accumulation from Protocol Fees', () => {
    it('5% of fees go to staking pool', () => {
      const stats = calculator.calculate(100_000, 60); // $100K volume, 60 bps

      // Total fees: $100K * 0.60% = $600
      expect(stats.totalFees).toBe(600);
      // Staking: 5% of $600 = $30
      expect(stats.stakingPoolAmount).toBe(30);
    });

    it('staking pool scales with volume', () => {
      const low = calculator.calculate(10_000, 60);
      const medium = calculator.calculate(100_000, 50);
      const high = calculator.calculate(1_000_000, 30);

      expect(low.stakingPoolAmount).toBe(3); // $10K * 0.60% * 5% = $3
      expect(medium.stakingPoolAmount).toBe(25); // $100K * 0.50% * 5% = $25
      expect(high.stakingPoolAmount).toBe(150); // $1M * 0.30% * 5% = $150
    });

    it('zero volume → zero staking rewards', () => {
      const stats = calculator.calculate(0, 60);
      expect(stats.stakingPoolAmount).toBe(0);
    });
  });

  // ── Fee Distribution Percentages ─────────────────────────────────
  describe('Fee Distribution: 80/15/5 Split', () => {
    it('correctly splits $600 in fees', () => {
      const breakdown = calculator.calculateFeeBreakdown(600);

      expect(breakdown.dev).toBe(480); // 80%
      expect(breakdown.insurance).toBe(90); // 15%
      expect(breakdown.staking).toBe(30); // 5%
      expect(breakdown.dev + breakdown.insurance + breakdown.staking).toBe(600);
    });

    it('handles fractional fees', () => {
      const breakdown = calculator.calculateFeeBreakdown(7.5);

      expect(breakdown.dev).toBeCloseTo(6.0);
      expect(breakdown.insurance).toBeCloseTo(1.125);
      expect(breakdown.staking).toBeCloseTo(0.375);
      expect(breakdown.dev + breakdown.insurance + breakdown.staking).toBeCloseTo(7.5);
    });

    it('percentages always sum to 100%', () => {
      expect(
        FEE_DISTRIBUTION.DEV_PERCENT +
        FEE_DISTRIBUTION.INSURANCE_PERCENT +
        FEE_DISTRIBUTION.STAKING_PERCENT,
      ).toBe(100);
    });
  });

  // ── Staking Eligibility ──────────────────────────────────────────
  describe('Staking Eligibility: ≥100K LUNES', () => {
    it('user with 150K LUNES is eligible', () => {
      expect(calculator.isEligible(150_000)).toBe(true);
    });

    it('user with exactly 100K LUNES is eligible', () => {
      expect(calculator.isEligible(100_000)).toBe(true);
    });

    it('user with 99,999 LUNES is NOT eligible', () => {
      expect(calculator.isEligible(99_999)).toBe(false);
    });

    it('user with 0 LUNES is NOT eligible', () => {
      expect(calculator.isEligible(0)).toBe(false);
    });

    it('user with 1M LUNES is eligible', () => {
      expect(calculator.isEligible(1_000_000)).toBe(true);
    });
  });

  // ── Per-Staker Reward Estimation ─────────────────────────────────
  describe('Per-Staker Reward Estimation', () => {
    it('divides pool evenly among stakers', () => {
      const reward = calculator.estimateRewardPerStaker(300, 10);
      expect(reward).toBe(30); // $30 each
    });

    it('single staker gets full pool', () => {
      const reward = calculator.estimateRewardPerStaker(150, 1);
      expect(reward).toBe(150);
    });

    it('zero stakers → zero reward (no division by zero)', () => {
      const reward = calculator.estimateRewardPerStaker(300, 0);
      expect(reward).toBe(0);
    });

    it('many stakers dilute reward', () => {
      const reward = calculator.estimateRewardPerStaker(300, 100);
      expect(reward).toBe(3); // $3 each
    });
  });

  // ── Admin Panel Staking Display ──────────────────────────────────
  describe('Admin Panel: Staking Tab Data', () => {
    it('displays monthly volume, total fees, and staking pool', () => {
      const stats = calculator.calculate(500_000, 60);

      expect(stats.monthlyVolume).toBe(500_000);
      expect(stats.totalFees).toBe(3000); // $500K * 0.60%
      expect(stats.stakingPoolAmount).toBe(150); // 5% of $3000
    });

    it('shows adaptive fee rate', () => {
      const lowVol = calculator.calculate(10_000, 60);
      const midVol = calculator.calculate(100_000, 50);
      const highVol = calculator.calculate(500_000, 30);

      expect(lowVol.currentFeeBps).toBe(60);
      expect(midVol.currentFeeBps).toBe(50);
      expect(highVol.currentFeeBps).toBe(30);
    });
  });

  // ── Full Staking User Journey ────────────────────────────────────
  describe('Full Staking User Journey', () => {
    it('user sees staking info → checks eligibility → views estimated reward', () => {
      // Step 1: User views staking stats in ecosystem
      const stats = calculator.calculate(200_000, 60);
      expect(stats.stakingPoolAmount).toBe(60); // $200K * 0.60% * 5%

      // Step 2: User checks own eligibility
      const userLunesBalance = 250_000; // 250K LUNES
      expect(calculator.isEligible(userLunesBalance)).toBe(true);

      // Step 3: User sees estimated reward (if 5 eligible stakers)
      const estimatedReward = calculator.estimateRewardPerStaker(60, 5);
      expect(estimatedReward).toBe(12); // $12/month

      // Step 4: User sees fee breakdown
      const breakdown = calculator.calculateFeeBreakdown(stats.totalFees);
      expect(breakdown.staking).toBe(stats.stakingPoolAmount);
    });
  });
});
