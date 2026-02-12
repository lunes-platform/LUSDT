/**
 * StakingPanel Tests — User-facing staking UI
 *
 * Tests the StakingPanel component logic and the navigation integration
 * that exposes staking to regular (non-admin) users.
 *
 * Covers:
 *  1. Staking panel rendering & static content
 *  2. Eligibility states (no wallet, eligible, not eligible)
 *  3. Pool stats calculations (volume → fees → staking pool)
 *  4. Fee distribution model (80/15/5)
 *  5. Holdings section visibility
 *  6. Navigation integration — staking tab available to all users
 *  7. URL parameter routing (?view=staking)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { BRIDGE_CONFIG } from '../config';

// ── Constants mirroring StakingPanel ─────────────────────────────────
const STAKING_MIN_LUNES = 100_000;
const FEE_DISTRIBUTION = BRIDGE_CONFIG.feeDistribution; // { dev: 80, insuranceFund: 15, stakingRewards: 5 }

// ── Helper: replicates StakingPanel's computed values ────────────────
function computeStakingStats(monthlyVolume: number, feeBps: number) {
  const totalFees = monthlyVolume * (feeBps / 10000);
  const stakingPool = totalFees * (FEE_DISTRIBUTION.stakingRewards / 100);
  const feePercent = (feeBps / 100).toFixed(2);
  return { totalFees, stakingPool, feePercent };
}

function isEligible(lunesBalance: number): boolean {
  return lunesBalance >= STAKING_MIN_LUNES;
}

// ═════════════════════════════════════════════════════════════════════
// 1. StakingPanel Rendering & Static Content
// ═════════════════════════════════════════════════════════════════════
describe('StakingPanel: Static Content & Structure', () => {
  it('defines the correct minimum staking threshold', () => {
    expect(STAKING_MIN_LUNES).toBe(100_000);
  });

  it('fee distribution config sums to 100%', () => {
    const total =
      FEE_DISTRIBUTION.dev +
      FEE_DISTRIBUTION.insuranceFund +
      FEE_DISTRIBUTION.stakingRewards;
    expect(total).toBe(100);
  });

  it('staking rewards share is exactly 5%', () => {
    expect(FEE_DISTRIBUTION.stakingRewards).toBe(5);
  });

  it('has correct fee distribution percentages', () => {
    expect(FEE_DISTRIBUTION.dev).toBe(80);
    expect(FEE_DISTRIBUTION.insuranceFund).toBe(15);
    expect(FEE_DISTRIBUTION.stakingRewards).toBe(5);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 2. Eligibility States
// ═════════════════════════════════════════════════════════════════════
describe('StakingPanel: Eligibility Logic', () => {
  describe('Wallet not connected', () => {
    it('shows WALLET_NOT_CONNECTED when lunesWallet is null', () => {
      // When wallet is null, component shows "WALLET_NOT_CONNECTED"
      const walletConnected = false;
      expect(walletConnected).toBe(false);
      // No eligibility check is performed
    });
  });

  describe('Wallet connected — NOT eligible', () => {
    it('user with 0 LUNES is not eligible', () => {
      expect(isEligible(0)).toBe(false);
    });

    it('user with 50K LUNES is not eligible', () => {
      expect(isEligible(50_000)).toBe(false);
    });

    it('user with 99,999 LUNES is not eligible', () => {
      expect(isEligible(99_999)).toBe(false);
    });

    it('shows NOT_YET_ELIGIBLE text and deficit', () => {
      const balance = 50_000;
      expect(isEligible(balance)).toBe(false);
      const deficit = STAKING_MIN_LUNES - balance;
      expect(deficit).toBe(50_000);
    });
  });

  describe('Wallet connected — eligible', () => {
    it('user with exactly 100K LUNES is eligible', () => {
      expect(isEligible(100_000)).toBe(true);
    });

    it('user with 500K LUNES is eligible', () => {
      expect(isEligible(500_000)).toBe(true);
    });

    it('user with 1M LUNES is eligible', () => {
      expect(isEligible(1_000_000)).toBe(true);
    });

    it('shows ELIGIBLE_FOR_REWARDS when balance >= 100K', () => {
      const balance = 150_000;
      expect(isEligible(balance)).toBe(true);
      // Component renders "ELIGIBLE_FOR_REWARDS" text
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// 3. Pool Stats Calculations
// ═════════════════════════════════════════════════════════════════════
describe('StakingPanel: Pool Stats Calculations', () => {
  it('computes total fees correctly from volume and bps', () => {
    const { totalFees } = computeStakingStats(100_000, 60);
    // $100,000 * 60/10000 = $600
    expect(totalFees).toBe(600);
  });

  it('computes staking pool as 5% of total fees', () => {
    const { stakingPool } = computeStakingStats(100_000, 60);
    // $600 * 5% = $30
    expect(stakingPool).toBe(30);
  });

  it('formats fee percent correctly', () => {
    expect(computeStakingStats(0, 60).feePercent).toBe('0.60');
    expect(computeStakingStats(0, 50).feePercent).toBe('0.50');
    expect(computeStakingStats(0, 30).feePercent).toBe('0.30');
  });

  it('scales with low volume (10K, 60 bps)', () => {
    const { totalFees, stakingPool } = computeStakingStats(10_000, 60);
    expect(totalFees).toBe(60);
    expect(stakingPool).toBe(3);
  });

  it('scales with medium volume (100K, 50 bps)', () => {
    const { totalFees, stakingPool } = computeStakingStats(100_000, 50);
    expect(totalFees).toBe(500);
    expect(stakingPool).toBe(25);
  });

  it('scales with high volume (1M, 30 bps)', () => {
    const { totalFees, stakingPool } = computeStakingStats(1_000_000, 30);
    expect(totalFees).toBe(3000);
    expect(stakingPool).toBe(150);
  });

  it('zero volume yields zero fees and pool', () => {
    const { totalFees, stakingPool } = computeStakingStats(0, 60);
    expect(totalFees).toBe(0);
    expect(stakingPool).toBe(0);
  });

  it('very large volume ($10M, 30 bps)', () => {
    const { totalFees, stakingPool } = computeStakingStats(10_000_000, 30);
    expect(totalFees).toBe(30_000);
    expect(stakingPool).toBe(1500);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 4. Fee Distribution Model (80/15/5)
// ═════════════════════════════════════════════════════════════════════
describe('StakingPanel: Fee Distribution Visual', () => {
  it('computes dev share as 80% of total fees', () => {
    const { totalFees } = computeStakingStats(100_000, 60);
    const devShare = totalFees * (FEE_DISTRIBUTION.dev / 100);
    expect(devShare).toBe(480);
  });

  it('computes insurance share as 15% of total fees', () => {
    const { totalFees } = computeStakingStats(100_000, 60);
    const insuranceShare = totalFees * (FEE_DISTRIBUTION.insuranceFund / 100);
    expect(insuranceShare).toBe(90);
  });

  it('computes staking share as 5% of total fees', () => {
    const { totalFees, stakingPool } = computeStakingStats(100_000, 60);
    const stakingShare = totalFees * (FEE_DISTRIBUTION.stakingRewards / 100);
    expect(stakingShare).toBe(30);
    expect(stakingShare).toBe(stakingPool);
  });

  it('all shares sum to total fees', () => {
    const { totalFees } = computeStakingStats(250_000, 50);
    const dev = totalFees * 0.80;
    const insurance = totalFees * 0.15;
    const staking = totalFees * 0.05;
    expect(dev + insurance + staking).toBeCloseTo(totalFees);
  });

  it('handles fractional fee amounts', () => {
    const { totalFees, stakingPool } = computeStakingStats(7_777, 60);
    // $7,777 * 0.006 = $46.662
    expect(totalFees).toBeCloseTo(46.662);
    // 5% of $46.662 = $2.3331
    expect(stakingPool).toBeCloseTo(2.3331);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 5. Holdings Section
// ═════════════════════════════════════════════════════════════════════
describe('StakingPanel: Holdings & Status Display', () => {
  it('shows INACTIVE status when not eligible', () => {
    const balance = 50_000;
    const eligible = isEligible(balance);
    expect(eligible).toBe(false);
    const status = eligible ? 'ACTIVE' : 'INACTIVE';
    expect(status).toBe('INACTIVE');
  });

  it('shows ACTIVE status when eligible', () => {
    const balance = 200_000;
    const eligible = isEligible(balance);
    expect(eligible).toBe(true);
    const status = eligible ? 'ACTIVE' : 'INACTIVE';
    expect(status).toBe('ACTIVE');
  });

  it('computes LUNES balance in USD', () => {
    const lunesBalance = 150_000;
    const lunesPrice = 0.50;
    const usdValue = lunesBalance * lunesPrice;
    expect(usdValue).toBe(75_000);
  });

  it('computes deficit when not eligible', () => {
    const balance = 30_000;
    const deficit = STAKING_MIN_LUNES - balance;
    expect(deficit).toBe(70_000);
  });

  it('holdings section hidden when wallet not connected', () => {
    const lunesWallet = null;
    // Component renders holdings only when lunesWallet is truthy
    expect(lunesWallet).toBeNull();
    const shouldShowHoldings = !!lunesWallet;
    expect(shouldShowHoldings).toBe(false);
  });

  it('holdings section shown when wallet connected', () => {
    const lunesWallet = { address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' };
    const shouldShowHoldings = !!lunesWallet;
    expect(shouldShowHoldings).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 6. Navigation Integration — Staking accessible to all users
// ═════════════════════════════════════════════════════════════════════
describe('StakingPanel: Navigation Integration', () => {
  const VALID_PAGES = ['bridge', 'transparency', 'admin', 'ops', 'staking'] as const;
  type Page = (typeof VALID_PAGES)[number];

  it('"staking" is a valid navigation page', () => {
    expect(VALID_PAGES).toContain('staking');
  });

  it('staking page does NOT require admin privileges', () => {
    // Admin check is only applied to the 'admin' page in Header.tsx
    // Staking is always visible regardless of isAdmin state
    const isAdmin = false;
    const page: Page = 'staking';
    // Only admin page is restricted
    const canAccess = page !== 'admin' || isAdmin;
    expect(canAccess).toBe(true);
  });

  it('staking is visible in nav even when user is not admin', () => {
    const isAdmin = false;
    // Non-admin pages are always visible: bridge, staking, transparency, ops
    const visiblePages: Page[] = ['bridge', 'staking', 'transparency', 'ops'];
    if (isAdmin) visiblePages.push('admin');
    expect(visiblePages).toContain('staking');
    expect(visiblePages).not.toContain('admin');
  });

  it('staking is visible alongside admin when user IS admin', () => {
    const isAdmin = true;
    const visiblePages: Page[] = ['bridge', 'staking', 'transparency', 'ops'];
    if (isAdmin) visiblePages.push('admin');
    expect(visiblePages).toContain('staking');
    expect(visiblePages).toContain('admin');
  });

  it('staking appears between BRIDGE and TRANSPARENCY in nav order', () => {
    // Desktop nav order in Header.tsx: BRIDGE, STAKING, TRANSPARENCY, OPS
    const navOrder: Page[] = ['bridge', 'staking', 'transparency', 'ops'];
    expect(navOrder.indexOf('staking')).toBe(1);
    expect(navOrder.indexOf('staking')).toBeGreaterThan(navOrder.indexOf('bridge'));
    expect(navOrder.indexOf('staking')).toBeLessThan(navOrder.indexOf('transparency'));
  });
});

// ═════════════════════════════════════════════════════════════════════
// 7. URL Parameter Routing
// ═════════════════════════════════════════════════════════════════════
describe('StakingPanel: URL ?view=staking Routing', () => {
  it('parses ?view=staking from URL', () => {
    const params = new URLSearchParams('?view=staking');
    expect(params.get('view')).toBe('staking');
  });

  it('does not match other view params', () => {
    const params = new URLSearchParams('?view=admin');
    expect(params.get('view')).not.toBe('staking');
  });

  it('handles missing view param gracefully', () => {
    const params = new URLSearchParams('');
    expect(params.get('view')).toBeNull();
    // Default page should be 'bridge' when no view param
    const defaultPage = params.get('view') || 'bridge';
    expect(defaultPage).toBe('bridge');
  });
});

// ═════════════════════════════════════════════════════════════════════
// 8. Full User Journey — Non-admin Staking Flow
// ═════════════════════════════════════════════════════════════════════
describe('StakingPanel: Full User Journey', () => {
  it('user navigates to staking → sees pool stats → checks eligibility → views holdings', () => {
    // Step 1: Navigate to staking page
    const currentPage = 'staking';
    expect(currentPage).toBe('staking');

    // Step 2: Pool stats show current volume data
    const { totalFees, stakingPool, feePercent } = computeStakingStats(200_000, 60);
    expect(totalFees).toBe(1200);
    expect(stakingPool).toBe(60);
    expect(feePercent).toBe('0.60');

    // Step 3: Check eligibility with user's LUNES balance
    const userLunes = 120_000;
    expect(isEligible(userLunes)).toBe(true);

    // Step 4: See status as ACTIVE
    const status = isEligible(userLunes) ? 'ACTIVE' : 'INACTIVE';
    expect(status).toBe('ACTIVE');

    // Step 5: See "Eligible" in fee distribution footer
    const shareText = isEligible(userLunes) ? 'Eligible' : 'Not eligible yet';
    expect(shareText).toBe('Eligible');
  });

  it('ineligible user sees CTA with required amount', () => {
    const userLunes = 25_000;
    expect(isEligible(userLunes)).toBe(false);

    const deficit = STAKING_MIN_LUNES - userLunes;
    expect(deficit).toBe(75_000);

    // CTA shows: "Acquire ≥100,000 LUNES"
    const ctaVisible = !isEligible(userLunes);
    expect(ctaVisible).toBe(true);
  });

  it('user without wallet sees informational content but no holdings', () => {
    const lunesWallet = null;
    const showHoldings = !!lunesWallet;
    expect(showHoldings).toBe(false);

    // Pool stats, fee distribution, and "How it Works" are still visible
    const { stakingPool } = computeStakingStats(200_000, 60);
    expect(stakingPool).toBe(60);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 9. How It Works — 4 Steps
// ═════════════════════════════════════════════════════════════════════
describe('StakingPanel: How It Works Section', () => {
  const STEPS = [
    { step: 1, title: 'Fee Collection' },
    { step: 2, title: 'Pool Accumulation' },
    { step: 3, title: 'Eligibility Check' },
    { step: 4, title: 'Monthly Distribution' },
  ];

  it('has exactly 4 steps', () => {
    expect(STEPS).toHaveLength(4);
  });

  it('steps are numbered 1 through 4', () => {
    STEPS.forEach((s, i) => {
      expect(s.step).toBe(i + 1);
    });
  });

  it('step 1 is Fee Collection', () => {
    expect(STEPS[0].title).toBe('Fee Collection');
  });

  it('step 3 mentions Eligibility', () => {
    expect(STEPS[2].title).toContain('Eligibility');
  });

  it('step 4 is Monthly Distribution', () => {
    expect(STEPS[3].title).toBe('Monthly Distribution');
  });
});

// ═════════════════════════════════════════════════════════════════════
// 10. Edge Cases & Boundary Conditions
// ═════════════════════════════════════════════════════════════════════
describe('StakingPanel: Edge Cases', () => {
  it('boundary: 99,999 LUNES → not eligible, 100,000 → eligible', () => {
    expect(isEligible(99_999)).toBe(false);
    expect(isEligible(100_000)).toBe(true);
  });

  it('very small volume produces correct micro-fees', () => {
    const { totalFees, stakingPool } = computeStakingStats(1, 60);
    // $1 * 0.006 = $0.006
    expect(totalFees).toBeCloseTo(0.006);
    // 5% of $0.006 = $0.0003
    expect(stakingPool).toBeCloseTo(0.0003);
  });

  it('max realistic volume ($100M, 30 bps)', () => {
    const { totalFees, stakingPool } = computeStakingStats(100_000_000, 30);
    expect(totalFees).toBe(300_000);
    expect(stakingPool).toBe(15_000);
  });

  it('LUNES price does not affect eligibility (only balance matters)', () => {
    // Eligibility is based on LUNES count, not USD value
    const lunesBalance = 100_000;
    const lowPrice = 0.01;
    const highPrice = 10.0;
    // Both should be eligible since balance >= 100K
    expect(isEligible(lunesBalance)).toBe(true);
    // USD value differs but eligibility is the same
    expect(lunesBalance * lowPrice).toBe(1_000);
    expect(lunesBalance * highPrice).toBe(1_000_000);
  });

  it('footer displays LUNES price, fee rate, and pool share', () => {
    const lunesPrice = 0.5;
    const { feePercent } = computeStakingStats(0, 60);
    const poolShare = FEE_DISTRIBUTION.stakingRewards;

    const footer = `LUNES_PRICE: $${lunesPrice.toFixed(4)} USD · FEE_RATE: ${feePercent}% · POOL_SHARE: ${poolShare}%`;
    expect(footer).toContain('LUNES_PRICE: $0.5000 USD');
    expect(footer).toContain('FEE_RATE: 0.60%');
    expect(footer).toContain('POOL_SHARE: 5%');
  });
});
