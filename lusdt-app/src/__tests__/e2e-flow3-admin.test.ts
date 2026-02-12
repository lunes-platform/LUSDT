/**
 * E2E Flow 3: Admin Panel — Management & Governance
 *
 * Tests the admin team's ability to manage the project:
 *  1. Emergency pause/unpause
 *  2. Fee configuration (adaptive tiers)
 *  3. LUNES price update
 *  4. Distribution wallet management
 *  5. Role-based access control (RBAC)
 *  6. Non-admin users are blocked from all actions
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ── Mock Admin Contract (mirrors useAdminContract.ts) ────────────────

interface FeeConfig {
  base_fee_bps: number;
  volume_threshold_1_usd: string;
  volume_threshold_2_usd: string;
  low_volume_fee_bps: number;
  medium_volume_fee_bps: number;
  high_volume_fee_bps: number;
}

interface DistributionWallets {
  devSolana: string;
  devLunes: string;
  insuranceFund: string;
  stakingRewardsPool: string;
}

interface AdminStats {
  isPaused: boolean;
  totalSupply: string;
  lunesPrice: string;
  monthlyVolume: string;
  currentFeeBps: number;
  feeConfig: FeeConfig | null;
  distributionWallets: DistributionWallets | null;
}

const ROLE_MAP: Record<string, number> = {
  ADMIN: 0,
  PAUSER: 1,
  MINTER: 2,
  TAX_MANAGER: 3,
};

class MockAdminContract {
  private owner: string;
  private paused = false;
  private pauseReason = '';
  private lunesPrice = 500_000; // $0.50 (6 decimals)
  private feeConfig: FeeConfig = {
    base_fee_bps: 50,
    volume_threshold_1_usd: '10000',
    volume_threshold_2_usd: '100000',
    low_volume_fee_bps: 60,
    medium_volume_fee_bps: 50,
    high_volume_fee_bps: 30,
  };
  private wallets: DistributionWallets = {
    devSolana: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    devLunes: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
    insuranceFund: '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y',
    stakingRewardsPool: '',
  };
  private roles: Map<string, Set<number>> = new Map();
  private totalSupply = '1000000';
  private monthlyVolume = '50000';

  constructor(ownerAddress: string) {
    this.owner = ownerAddress;
    this.roles.set(ownerAddress, new Set([ROLE_MAP.ADMIN]));
  }

  private isAdmin(caller: string): boolean {
    return this.roles.get(caller)?.has(ROLE_MAP.ADMIN) ?? false;
  }

  private hasRole(caller: string, role: number): boolean {
    return this.roles.get(caller)?.has(role) ?? false;
  }

  async getStats(): Promise<AdminStats> {
    return {
      isPaused: this.paused,
      totalSupply: this.totalSupply,
      lunesPrice: (this.lunesPrice / 1_000_000).toFixed(6),
      monthlyVolume: this.monthlyVolume,
      currentFeeBps: this.feeConfig.low_volume_fee_bps,
      feeConfig: this.feeConfig,
      distributionWallets: this.wallets,
    };
  }

  async emergencyPause(caller: string, reason: string): Promise<string> {
    if (!this.isAdmin(caller) && !this.hasRole(caller, ROLE_MAP.PAUSER)) {
      throw new Error('Unauthorized: Only owner or pauser can pause');
    }
    this.paused = true;
    this.pauseReason = reason;
    return 'paused';
  }

  async emergencyUnpause(caller: string): Promise<string> {
    if (!this.isAdmin(caller)) {
      throw new Error('Unauthorized: Only owner can unpause');
    }
    this.paused = false;
    this.pauseReason = '';
    return 'unpaused';
  }

  async updateLunesPrice(caller: string, newPrice: number): Promise<string> {
    if (!this.isAdmin(caller)) throw new Error('Unauthorized: Only owner can update price');
    if (newPrice <= 0) throw new Error('Price must be positive');
    this.lunesPrice = Math.floor(newPrice * 1_000_000);
    return 'price_updated';
  }

  async updateFeeConfig(caller: string, config: FeeConfig): Promise<string> {
    if (!this.isAdmin(caller)) throw new Error('Unauthorized: Only owner can update fee config');
    if (config.low_volume_fee_bps > 1000) throw new Error('Fee too high (max 10%)');
    if (config.high_volume_fee_bps > config.medium_volume_fee_bps) throw new Error('High fee must be <= medium');
    if (config.medium_volume_fee_bps > config.low_volume_fee_bps) throw new Error('Medium fee must be <= low');
    this.feeConfig = config;
    return 'fee_config_updated';
  }

  async updateDistributionWallets(caller: string, wallets: Partial<DistributionWallets>): Promise<string> {
    if (!this.isAdmin(caller)) throw new Error('Unauthorized: Only owner can update wallets');
    // Insurance fund is fixed — cannot be changed
    if (wallets.insuranceFund && wallets.insuranceFund !== this.wallets.insuranceFund) {
      throw new Error('Insurance fund address cannot be changed');
    }
    // Validate SS58 addresses (47-48 chars)
    for (const [key, addr] of Object.entries(wallets)) {
      if (addr && key !== 'insuranceFund' && (addr.length < 47 || addr.length > 48)) {
        throw new Error(`Invalid address format for ${key}`);
      }
    }
    this.wallets = { ...this.wallets, ...wallets };
    return 'wallets_updated';
  }

  async grantRole(caller: string, roleName: string, account: string): Promise<string> {
    if (!this.isAdmin(caller)) throw new Error('Unauthorized: Only owner can grant roles');
    const roleId = ROLE_MAP[roleName];
    if (roleId === undefined) throw new Error('Invalid role');
    if (!this.roles.has(account)) this.roles.set(account, new Set());
    this.roles.get(account)!.add(roleId);
    return 'role_granted';
  }

  async revokeRole(caller: string, roleName: string, account: string): Promise<string> {
    if (!this.isAdmin(caller)) throw new Error('Unauthorized: Only owner can revoke roles');
    const roleId = ROLE_MAP[roleName];
    if (roleId === undefined) throw new Error('Invalid role');
    this.roles.get(account)?.delete(roleId);
    return 'role_revoked';
  }

  isPausedState(): boolean {
    return this.paused;
  }

  getLunesPriceUsd(): number {
    return this.lunesPrice / 1_000_000;
  }

  getFeeConfig(): FeeConfig {
    return { ...this.feeConfig };
  }
}

// ═════════════════════════════════════════════════════════════════════
// Test Suite
// ═════════════════════════════════════════════════════════════════════

describe('E2E Flow 3: Admin Panel — Project Management', () => {
  const OWNER = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
  const BRIDGE = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
  const PAUSER = '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y';
  const USER = '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYUM3aU1qh';

  let admin: MockAdminContract;

  beforeEach(() => {
    admin = new MockAdminContract(OWNER);
  });

  // ── Emergency Pause/Unpause ──────────────────────────────────────
  describe('Emergency Pause/Unpause', () => {
    it('owner can pause the contract', async () => {
      await admin.emergencyPause(OWNER, 'Security audit');
      expect(admin.isPausedState()).toBe(true);
    });

    it('owner can unpause the contract', async () => {
      await admin.emergencyPause(OWNER, 'test');
      await admin.emergencyUnpause(OWNER);
      expect(admin.isPausedState()).toBe(false);
    });

    it('non-admin cannot pause', async () => {
      await expect(admin.emergencyPause(USER, 'hack')).rejects.toThrow('Unauthorized');
    });

    it('non-admin cannot unpause', async () => {
      await admin.emergencyPause(OWNER, 'test');
      await expect(admin.emergencyUnpause(USER)).rejects.toThrow('Unauthorized');
    });

    it('pauser role can pause but not unpause', async () => {
      await admin.grantRole(OWNER, 'PAUSER', PAUSER);
      await admin.emergencyPause(PAUSER, 'Suspicious activity');
      expect(admin.isPausedState()).toBe(true);

      await expect(admin.emergencyUnpause(PAUSER)).rejects.toThrow('Unauthorized');
    });
  });

  // ── Fee Configuration ────────────────────────────────────────────
  describe('Fee Configuration', () => {
    it('owner can update fee config', async () => {
      const newConfig: FeeConfig = {
        base_fee_bps: 40,
        volume_threshold_1_usd: '20000',
        volume_threshold_2_usd: '200000',
        low_volume_fee_bps: 55,
        medium_volume_fee_bps: 40,
        high_volume_fee_bps: 25,
      };

      await admin.updateFeeConfig(OWNER, newConfig);
      const config = admin.getFeeConfig();
      expect(config.low_volume_fee_bps).toBe(55);
      expect(config.medium_volume_fee_bps).toBe(40);
      expect(config.high_volume_fee_bps).toBe(25);
    });

    it('rejects fee > 10%', async () => {
      const badConfig: FeeConfig = {
        base_fee_bps: 50,
        volume_threshold_1_usd: '10000',
        volume_threshold_2_usd: '100000',
        low_volume_fee_bps: 1001,
        medium_volume_fee_bps: 50,
        high_volume_fee_bps: 30,
      };

      await expect(admin.updateFeeConfig(OWNER, badConfig)).rejects.toThrow('Fee too high');
    });

    it('rejects inverted tier fees', async () => {
      const invertedConfig: FeeConfig = {
        base_fee_bps: 50,
        volume_threshold_1_usd: '10000',
        volume_threshold_2_usd: '100000',
        low_volume_fee_bps: 30,
        medium_volume_fee_bps: 50,
        high_volume_fee_bps: 60,
      };

      await expect(admin.updateFeeConfig(OWNER, invertedConfig)).rejects.toThrow();
    });

    it('non-admin cannot update fees', async () => {
      const config: FeeConfig = {
        base_fee_bps: 50,
        volume_threshold_1_usd: '10000',
        volume_threshold_2_usd: '100000',
        low_volume_fee_bps: 60,
        medium_volume_fee_bps: 50,
        high_volume_fee_bps: 30,
      };

      await expect(admin.updateFeeConfig(USER, config)).rejects.toThrow('Unauthorized');
    });
  });

  // ── LUNES Price Update ───────────────────────────────────────────
  describe('LUNES Price Update', () => {
    it('owner can update LUNES price', async () => {
      await admin.updateLunesPrice(OWNER, 0.75);
      expect(admin.getLunesPriceUsd()).toBeCloseTo(0.75);
    });

    it('rejects zero price', async () => {
      await expect(admin.updateLunesPrice(OWNER, 0)).rejects.toThrow('Price must be positive');
    });

    it('rejects negative price', async () => {
      await expect(admin.updateLunesPrice(OWNER, -1)).rejects.toThrow('Price must be positive');
    });

    it('non-admin cannot update price', async () => {
      await expect(admin.updateLunesPrice(USER, 1.0)).rejects.toThrow('Unauthorized');
    });
  });

  // ── Distribution Wallet Management ───────────────────────────────
  describe('Distribution Wallet Management', () => {
    it('owner can update dev wallets', async () => {
      const newWallet = '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYUM3aU1qh';
      await admin.updateDistributionWallets(OWNER, { devSolana: newWallet });
      const stats = await admin.getStats();
      expect(stats.distributionWallets?.devSolana).toBe(newWallet);
    });

    it('insurance fund address cannot be changed', async () => {
      await expect(
        admin.updateDistributionWallets(OWNER, { insuranceFund: 'different_address_that_is_valid_and_long_enough' }),
      ).rejects.toThrow('Insurance fund address cannot be changed');
    });

    it('rejects invalid address format', async () => {
      await expect(
        admin.updateDistributionWallets(OWNER, { devSolana: 'short' }),
      ).rejects.toThrow('Invalid address format');
    });

    it('non-admin cannot update wallets', async () => {
      await expect(
        admin.updateDistributionWallets(USER, { devSolana: OWNER }),
      ).rejects.toThrow('Unauthorized');
    });
  });

  // ── Role-Based Access Control ────────────────────────────────────
  describe('Role-Based Access Control (RBAC)', () => {
    it('owner can grant MINTER role', async () => {
      const result = await admin.grantRole(OWNER, 'MINTER', BRIDGE);
      expect(result).toBe('role_granted');
    });

    it('owner can grant PAUSER role', async () => {
      const result = await admin.grantRole(OWNER, 'PAUSER', PAUSER);
      expect(result).toBe('role_granted');
    });

    it('owner can revoke a role', async () => {
      await admin.grantRole(OWNER, 'MINTER', BRIDGE);
      const result = await admin.revokeRole(OWNER, 'MINTER', BRIDGE);
      expect(result).toBe('role_revoked');
    });

    it('rejects invalid role names', async () => {
      await expect(admin.grantRole(OWNER, 'INVALID_ROLE', USER)).rejects.toThrow('Invalid role');
    });

    it('non-admin cannot grant roles', async () => {
      await expect(admin.grantRole(USER, 'MINTER', USER)).rejects.toThrow('Unauthorized');
    });

    it('non-admin cannot revoke roles', async () => {
      await expect(admin.revokeRole(USER, 'ADMIN', OWNER)).rejects.toThrow('Unauthorized');
    });
  });

  // ── Admin Stats Display ──────────────────────────────────────────
  describe('Admin Stats Display', () => {
    it('displays complete stats', async () => {
      const stats = await admin.getStats();

      expect(stats.isPaused).toBe(false);
      expect(stats.totalSupply).toBeTruthy();
      expect(stats.lunesPrice).toBeTruthy();
      expect(stats.monthlyVolume).toBeTruthy();
      expect(stats.currentFeeBps).toBeGreaterThan(0);
      expect(stats.feeConfig).not.toBeNull();
      expect(stats.distributionWallets).not.toBeNull();
    });

    it('stats reflect pause state', async () => {
      await admin.emergencyPause(OWNER, 'test');
      const stats = await admin.getStats();
      expect(stats.isPaused).toBe(true);
    });

    it('stats reflect price update', async () => {
      await admin.updateLunesPrice(OWNER, 1.25);
      const stats = await admin.getStats();
      expect(parseFloat(stats.lunesPrice)).toBeCloseTo(1.25);
    });
  });

  // ── Non-Admin Blocked from Everything ────────────────────────────
  describe('Non-Admin User Blocked from All Actions', () => {
    it('blocks all admin actions for regular user', async () => {
      await expect(admin.emergencyPause(USER, 'hack')).rejects.toThrow('Unauthorized');
      await expect(admin.updateLunesPrice(USER, 999)).rejects.toThrow('Unauthorized');
      await expect(admin.grantRole(USER, 'ADMIN', USER)).rejects.toThrow('Unauthorized');
      await expect(admin.revokeRole(USER, 'ADMIN', OWNER)).rejects.toThrow('Unauthorized');

      // Can still read stats
      const stats = await admin.getStats();
      expect(stats).toBeTruthy();
    });
  });

  // ── Full Admin Journey ───────────────────────────────────────────
  describe('Full Admin Journey', () => {
    it('admin sets up system → pauses → configures → unpauses', async () => {
      // Step 1: Grant bridge MINTER role
      await admin.grantRole(OWNER, 'MINTER', BRIDGE);

      // Step 2: Update LUNES price
      await admin.updateLunesPrice(OWNER, 0.65);
      expect(admin.getLunesPriceUsd()).toBeCloseTo(0.65);

      // Step 3: Configure fees
      await admin.updateFeeConfig(OWNER, {
        base_fee_bps: 45,
        volume_threshold_1_usd: '15000',
        volume_threshold_2_usd: '150000',
        low_volume_fee_bps: 55,
        medium_volume_fee_bps: 45,
        high_volume_fee_bps: 25,
      });
      expect(admin.getFeeConfig().low_volume_fee_bps).toBe(55);

      // Step 4: Pause for maintenance
      await admin.emergencyPause(OWNER, 'Fee config update');
      expect(admin.isPausedState()).toBe(true);

      // Step 5: Verify stats during pause
      const stats = await admin.getStats();
      expect(stats.isPaused).toBe(true);
      expect(stats.currentFeeBps).toBe(55);

      // Step 6: Unpause
      await admin.emergencyUnpause(OWNER);
      expect(admin.isPausedState()).toBe(false);
    });
  });
});
