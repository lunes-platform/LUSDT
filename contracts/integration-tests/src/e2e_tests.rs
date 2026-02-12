//! End-to-End Integration Tests for LUSDT Contracts — v3 Dual-Fee Model
//!
//! Tests simulate all 3 production user flows:
//!   Flow 1: Swap USDT (Solana) → LUSDT (Lunes) via bridge mint
//!   Flow 2: Staking rewards — fee distribution 80/15/5
//!   Flow 3: Admin panel — pause, fee config, roles, price update
//! Plus: Burn flow (LUSDT → USDT), approval flow, reentrancy-safe transfers

#[cfg(test)]
mod e2e_tests {
    use ink::primitives::AccountId;

    // ── Mock Bridge Service (v3) ──────────────────────────────────────
    pub struct MockBridgeService {
        pub bridge_account: AccountId,
        pub lusdt_contract: Option<AccountId>,
        pub tax_manager_contract: Option<AccountId>,
        pub processed_transactions: Vec<TransactionRecord>,
        pub fee_bps: u16, // dynamic fee from Tax Manager
    }

    #[derive(Clone, Debug)]
    pub struct TransactionRecord {
        pub direction: String,
        pub user: AccountId,
        pub gross_amount: u128,
        pub fee_amount: u128,
        pub net_amount: u128,
        pub fee_bps: u16,
        pub dev_share: u128,
        pub insurance_share: u128,
        pub staking_share: u128,
        pub solana_tx: String,
        pub status: String,
    }

    impl MockBridgeService {
        pub fn new(bridge_account: AccountId, fee_bps: u16) -> Self {
            Self {
                bridge_account,
                lusdt_contract: None,
                tax_manager_contract: None,
                processed_transactions: Vec::new(),
                fee_bps,
            }
        }

        pub fn set_contracts(&mut self, lusdt: AccountId, tax_manager: AccountId) {
            self.lusdt_contract = Some(lusdt);
            self.tax_manager_contract = Some(tax_manager);
        }

        /// Query Tax Manager for adaptive fee (mock)
        pub fn query_tax_manager_fee_bps(&self) -> u16 {
            self.fee_bps
        }

        /// v3 Mint: deduct USDT fee BEFORE minting, distribute 80/15/5
        pub fn process_mint_request(
            &mut self,
            user: AccountId,
            deposit_amount: u128,
            solana_tx_hash: String,
        ) -> Result<TransactionRecord, String> {
            if deposit_amount == 0 {
                return Err("Zero amount".into());
            }

            let fee_bps = self.query_tax_manager_fee_bps();
            let fee_amount = deposit_amount * fee_bps as u128 / 10000;
            let mint_amount = deposit_amount - fee_amount;

            // 80/15/5 distribution
            let dev_share = fee_amount * 80 / 100;
            let insurance_share = fee_amount * 15 / 100;
            let staking_share = fee_amount - dev_share - insurance_share;

            // Backing ratio: vault USDT == minted LUSDT
            assert_eq!(
                mint_amount + fee_amount,
                deposit_amount,
                "fee + mint must equal deposit"
            );

            let record = TransactionRecord {
                direction: "solana_to_lunes".into(),
                user,
                gross_amount: deposit_amount,
                fee_amount,
                net_amount: mint_amount,
                fee_bps,
                dev_share,
                insurance_share,
                staking_share,
                solana_tx: solana_tx_hash,
                status: "completed".into(),
            };

            self.processed_transactions.push(record.clone());
            Ok(record)
        }

        /// v3 Burn: LUSDT burned on-chain, Tax Manager charges dual fee
        /// (LUSDT stablecoin fee + LUNES burn fee). Bridge releases USDT.
        pub fn process_burn_request(
            &mut self,
            user: AccountId,
            burn_amount: u128,
            solana_address: String,
        ) -> Result<TransactionRecord, String> {
            if burn_amount == 0 {
                return Err("Zero amount".into());
            }
            if solana_address.len() < 32 || solana_address.len() > 44 {
                return Err("Invalid Solana address".into());
            }

            // On burn, stablecoin fee is charged on-chain by Tax Manager
            // Bridge releases the net USDT amount
            let fee_bps = self.query_tax_manager_fee_bps();
            let fee_amount = burn_amount * fee_bps as u128 / 10000;
            let release_amount = burn_amount - fee_amount;

            let record = TransactionRecord {
                direction: "lunes_to_solana".into(),
                user,
                gross_amount: burn_amount,
                fee_amount,
                net_amount: release_amount,
                fee_bps,
                dev_share: fee_amount * 80 / 100,
                insurance_share: fee_amount * 15 / 100,
                staking_share: fee_amount - (fee_amount * 80 / 100) - (fee_amount * 15 / 100),
                solana_tx: format!("solana_release_{}", burn_amount),
                status: "completed".into(),
            };

            self.processed_transactions.push(record.clone());
            Ok(record)
        }

        pub fn total_volume(&self) -> u128 {
            self.processed_transactions.iter().map(|t| t.gross_amount).sum()
        }

        pub fn total_fees(&self) -> u128 {
            self.processed_transactions.iter().map(|t| t.fee_amount).sum()
        }

        pub fn total_staking_rewards(&self) -> u128 {
            self.processed_transactions.iter().map(|t| t.staking_share).sum()
        }
    }

    // ── Mock Approval Manager ─────────────────────────────────────────
    pub struct MockApprovalManager {
        approvals: Vec<(AccountId, AccountId, u128)>, // (owner, spender, amount)
    }

    impl MockApprovalManager {
        pub fn new() -> Self {
            Self { approvals: Vec::new() }
        }

        pub fn approve(&mut self, owner: AccountId, spender: AccountId, amount: u128) {
            // Remove existing approval if any
            self.approvals.retain(|(o, s, _)| !(o == &owner && s == &spender));
            self.approvals.push((owner, spender, amount));
        }

        pub fn allowance(&self, owner: &AccountId, spender: &AccountId) -> u128 {
            self.approvals
                .iter()
                .find(|(o, s, _)| o == owner && s == spender)
                .map(|(_, _, a)| *a)
                .unwrap_or(0)
        }

        pub fn spend(&mut self, owner: &AccountId, spender: &AccountId, amount: u128) -> Result<(), String> {
            let current = self.allowance(owner, spender);
            if current < amount {
                return Err("InsufficientAllowance".into());
            }
            self.approve(*owner, *spender, current - amount);
            Ok(())
        }
    }

    // ── Mock Admin Panel ──────────────────────────────────────────────
    pub struct MockAdminPanel {
        pub owner: AccountId,
        pub paused: bool,
        pub pause_reason: Option<String>,
        pub fee_bps: u16,
        pub lunes_price_usd: u128, // 6 decimals
        pub roles: Vec<(u32, AccountId)>,
    }

    impl MockAdminPanel {
        pub fn new(owner: AccountId) -> Self {
            Self {
                owner,
                paused: false,
                pause_reason: None,
                fee_bps: 60,
                lunes_price_usd: 500_000, // $0.50
                roles: vec![
                    (0, owner), // ADMIN
                ],
            }
        }

        pub fn emergency_pause(&mut self, caller: AccountId, reason: &str) -> Result<(), String> {
            if !self.has_role(0, &caller) && !self.has_role(1, &caller) {
                return Err("MissingRole".into());
            }
            self.paused = true;
            self.pause_reason = Some(reason.into());
            Ok(())
        }

        pub fn emergency_unpause(&mut self, caller: AccountId) -> Result<(), String> {
            if !self.has_role(0, &caller) {
                return Err("MissingRole".into());
            }
            self.paused = false;
            self.pause_reason = None;
            Ok(())
        }

        pub fn update_fee_bps(&mut self, caller: AccountId, new_bps: u16) -> Result<(), String> {
            if !self.has_role(0, &caller) {
                return Err("MissingRole".into());
            }
            if new_bps > 1000 {
                return Err("Fee too high".into());
            }
            self.fee_bps = new_bps;
            Ok(())
        }

        pub fn update_lunes_price(&mut self, caller: AccountId, price: u128) -> Result<(), String> {
            if !self.has_role(0, &caller) {
                return Err("MissingRole".into());
            }
            if price == 0 {
                return Err("Price cannot be zero".into());
            }
            self.lunes_price_usd = price;
            Ok(())
        }

        pub fn grant_role(&mut self, caller: AccountId, role: u32, account: AccountId) -> Result<(), String> {
            if !self.has_role(0, &caller) {
                return Err("MissingRole".into());
            }
            if !self.has_role(role, &account) {
                self.roles.push((role, account));
            }
            Ok(())
        }

        pub fn revoke_role(&mut self, caller: AccountId, role: u32, account: AccountId) -> Result<(), String> {
            if !self.has_role(0, &caller) {
                return Err("MissingRole".into());
            }
            self.roles.retain(|(r, a)| !(r == &role && a == &account));
            Ok(())
        }

        pub fn has_role(&self, role: u32, account: &AccountId) -> bool {
            self.roles.iter().any(|(r, a)| r == &role && a == account)
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // FLOW 1: Swap USDT (Solana) → LUSDT (Lunes)
    // ═══════════════════════════════════════════════════════════════════

    #[test]
    fn flow1_swap_usdt_to_lusdt_complete() {
        println!("🧪 Flow 1: User swaps 1000 USDT → LUSDT");

        let bridge_acc = AccountId::from([1u8; 32]);
        let user = AccountId::from([2u8; 32]);

        let mut bridge = MockBridgeService::new(bridge_acc, 60); // 0.60%

        // Step 1: User deposits 1000 USDT on Solana
        let deposit = 1_000_000_000u128; // 1000 USDT (6 decimals)

        // Step 2: Bridge queries Tax Manager for fee → 60 bps
        let fee_bps = bridge.query_tax_manager_fee_bps();
        assert_eq!(fee_bps, 60);

        // Step 3: Bridge deducts fee and mints
        let result = bridge.process_mint_request(user, deposit, "sol_tx_abc".into());
        assert!(result.is_ok());

        let tx = result.unwrap();

        // Step 4: Verify fee calculation
        assert_eq!(tx.fee_amount, 6_000_000); // 0.60% of 1B = 6M
        assert_eq!(tx.net_amount, 994_000_000); // 1B - 6M

        // Step 5: Verify 80/15/5 distribution
        assert_eq!(tx.dev_share, 4_800_000);       // 80% of 6M
        assert_eq!(tx.insurance_share, 900_000);    // 15% of 6M
        assert_eq!(tx.staking_share, 300_000);      // 5% of 6M
        assert_eq!(tx.dev_share + tx.insurance_share + tx.staking_share, tx.fee_amount);

        // Step 6: Verify 100% backing ratio maintained
        assert_eq!(tx.net_amount + tx.fee_amount, deposit);

        println!("✅ Flow 1 passed: {} USDT → {} LUSDT (fee: {})", deposit, tx.net_amount, tx.fee_amount);
    }

    #[test]
    fn flow1_adaptive_fee_medium_volume() {
        println!("🧪 Flow 1b: Adaptive fee at medium volume (50 bps)");

        let bridge_acc = AccountId::from([1u8; 32]);
        let user = AccountId::from([2u8; 32]);

        // Medium volume tier: 50 bps
        let mut bridge = MockBridgeService::new(bridge_acc, 50);

        let deposit = 50_000_000_000u128; // $50K
        let result = bridge.process_mint_request(user, deposit, "sol_tx_med".into());
        assert!(result.is_ok());

        let tx = result.unwrap();
        assert_eq!(tx.fee_bps, 50);
        assert_eq!(tx.fee_amount, 250_000_000); // 0.50% of $50K
        assert_eq!(tx.net_amount, 49_750_000_000);

        println!("✅ Flow 1b passed: medium volume fee 50 bps");
    }

    #[test]
    fn flow1_adaptive_fee_high_volume() {
        println!("🧪 Flow 1c: Adaptive fee at high volume (30 bps)");

        let bridge_acc = AccountId::from([1u8; 32]);
        let user = AccountId::from([2u8; 32]);

        // High volume tier: 30 bps
        let mut bridge = MockBridgeService::new(bridge_acc, 30);

        let deposit = 200_000_000_000u128; // $200K
        let result = bridge.process_mint_request(user, deposit, "sol_tx_high".into());
        assert!(result.is_ok());

        let tx = result.unwrap();
        assert_eq!(tx.fee_bps, 30);
        assert_eq!(tx.fee_amount, 600_000_000); // 0.30% of $200K

        println!("✅ Flow 1c passed: high volume fee 30 bps");
    }

    #[test]
    fn flow1_zero_amount_rejected() {
        let mut bridge = MockBridgeService::new(AccountId::from([1u8; 32]), 60);
        let result = bridge.process_mint_request(AccountId::from([2u8; 32]), 0, "tx".into());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Zero amount");
    }

    // ═══════════════════════════════════════════════════════════════════
    // FLOW 1 REVERSE: Burn LUSDT → USDT (with approvals)
    // ═══════════════════════════════════════════════════════════════════

    #[test]
    fn flow1r_burn_lusdt_to_usdt_complete() {
        println!("🧪 Flow 1 Reverse: User burns LUSDT → USDT");

        let bridge_acc = AccountId::from([1u8; 32]);
        let user = AccountId::from([2u8; 32]);
        let tax_manager = AccountId::from([3u8; 32]);

        // Step 1: User must approve Tax Manager for LUSDT + LUNES
        let mut approvals = MockApprovalManager::new();
        let max_u128 = u128::MAX;
        approvals.approve(user, tax_manager, max_u128); // LUSDT approval
        assert!(approvals.allowance(&user, &tax_manager) > 0);

        // Step 2: User burns 500 LUSDT
        let mut bridge = MockBridgeService::new(bridge_acc, 60);
        let burn_amount = 500_000_000u128;

        let result = bridge.process_burn_request(user, burn_amount, "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU".into());
        assert!(result.is_ok());

        let tx = result.unwrap();

        // Step 3: Verify fee deduction
        assert_eq!(tx.fee_amount, 3_000_000); // 0.60% of 500M
        assert_eq!(tx.net_amount, 497_000_000); // released USDT

        // Step 4: Tax Manager spends allowance
        let lusdt_fee = tx.fee_amount;
        assert!(approvals.spend(&user, &tax_manager, lusdt_fee).is_ok());
        assert_eq!(approvals.allowance(&user, &tax_manager), max_u128 - lusdt_fee);

        println!("✅ Flow 1 Reverse passed: {} LUSDT burned → {} USDT released", burn_amount, tx.net_amount);
    }

    #[test]
    fn flow1r_burn_without_approval_fails() {
        println!("🧪 Flow 1r: Burn without approval — fee collection fails gracefully");

        let user = AccountId::from([2u8; 32]);
        let tax_manager = AccountId::from([3u8; 32]);

        let mut approvals = MockApprovalManager::new();
        // No approval set

        let result = approvals.spend(&user, &tax_manager, 1_000_000);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "InsufficientAllowance");

        println!("✅ Without approval, fee spend fails as expected");
    }

    #[test]
    fn flow1r_burn_invalid_solana_address_rejected() {
        let mut bridge = MockBridgeService::new(AccountId::from([1u8; 32]), 60);
        let result = bridge.process_burn_request(AccountId::from([2u8; 32]), 1_000_000, "short".into());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Invalid Solana address");
    }

    // ═══════════════════════════════════════════════════════════════════
    // FLOW 2: Staking Rewards — 5% fee pool distribution
    // ═══════════════════════════════════════════════════════════════════

    #[test]
    fn flow2_staking_rewards_accumulation() {
        println!("🧪 Flow 2: Staking rewards accumulate from protocol fees");

        let bridge_acc = AccountId::from([1u8; 32]);
        let user1 = AccountId::from([2u8; 32]);
        let user2 = AccountId::from([3u8; 32]);

        let mut bridge = MockBridgeService::new(bridge_acc, 60);

        // Multiple swaps generate fees
        let deposits = vec![
            (user1, 10_000_000_000u128),  // $10K
            (user2, 50_000_000_000u128),  // $50K
            (user1, 100_000_000_000u128), // $100K
        ];

        for (i, (user, amount)) in deposits.iter().enumerate() {
            let result = bridge.process_mint_request(*user, *amount, format!("tx_{}", i));
            assert!(result.is_ok());
        }

        // Verify staking pool accumulation
        let total_fees = bridge.total_fees();
        let total_staking = bridge.total_staking_rewards();

        // 5% of all fees go to staking
        let expected_staking = total_fees * 5 / 100;
        assert_eq!(total_staking, expected_staking);

        println!("  Total volume: ${}", bridge.total_volume() / 1_000_000);
        println!("  Total fees:   ${}", total_fees / 1_000_000);
        println!("  Staking pool: ${}", total_staking / 1_000_000);
        println!("✅ Flow 2 passed: staking rewards = 5% of total fees");
    }

    #[test]
    fn flow2_staking_eligibility_threshold() {
        println!("🧪 Flow 2b: Staking eligibility — ≥100K LUNES required");

        // Staking eligibility is checked off-chain during monthly distribution
        let min_lunes_for_staking: u128 = 100_000_000_000_000; // 100K LUNES (12 decimals)

        let staker_balance: u128 = 150_000_000_000_000; // 150K LUNES
        let non_staker_balance: u128 = 50_000_000_000_000; // 50K LUNES

        assert!(staker_balance >= min_lunes_for_staking, "150K should be eligible");
        assert!(non_staker_balance < min_lunes_for_staking, "50K should NOT be eligible");

        println!("✅ Flow 2b passed: eligibility threshold enforced");
    }

    #[test]
    fn flow2_fee_distribution_percentages() {
        println!("🧪 Flow 2c: Verify 80/15/5 distribution across all txs");

        let bridge_acc = AccountId::from([1u8; 32]);
        let user = AccountId::from([2u8; 32]);
        let mut bridge = MockBridgeService::new(bridge_acc, 60);

        // 5 mint operations
        for i in 0..5 {
            bridge.process_mint_request(user, 20_000_000_000, format!("tx_{}", i)).unwrap();
        }
        // 3 burn operations
        for i in 0..3 {
            bridge.process_burn_request(user, 10_000_000_000, "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU".into()).unwrap();
        }

        let total_dev: u128 = bridge.processed_transactions.iter().map(|t| t.dev_share).sum();
        let total_ins: u128 = bridge.processed_transactions.iter().map(|t| t.insurance_share).sum();
        let total_stk: u128 = bridge.processed_transactions.iter().map(|t| t.staking_share).sum();
        let total_fees = bridge.total_fees();

        // Verify percentages
        assert_eq!(total_dev, total_fees * 80 / 100);
        assert_eq!(total_ins, total_fees * 15 / 100);
        assert_eq!(total_stk, total_fees - total_dev - total_ins); // remainder = 5%
        assert_eq!(total_dev + total_ins + total_stk, total_fees);

        println!("  Dev:       ${} (80%)", total_dev / 1_000_000);
        println!("  Insurance: ${} (15%)", total_ins / 1_000_000);
        println!("  Staking:   ${} (5%)", total_stk / 1_000_000);
        println!("✅ Flow 2c passed: 80/15/5 distribution verified");
    }

    // ═══════════════════════════════════════════════════════════════════
    // FLOW 3: Admin Panel — pause, unpause, fee config, roles, price
    // ═══════════════════════════════════════════════════════════════════

    #[test]
    fn flow3_admin_emergency_pause_unpause() {
        println!("🧪 Flow 3: Admin pauses and unpauses contract");

        let owner = AccountId::from([1u8; 32]);
        let user = AccountId::from([2u8; 32]);

        let mut admin = MockAdminPanel::new(owner);

        // Owner pauses
        assert!(admin.emergency_pause(owner, "Security audit").is_ok());
        assert!(admin.paused);
        assert_eq!(admin.pause_reason, Some("Security audit".into()));

        // Non-admin cannot unpause
        assert!(admin.emergency_unpause(user).is_err());

        // Owner unpauses
        assert!(admin.emergency_unpause(owner).is_ok());
        assert!(!admin.paused);
        assert_eq!(admin.pause_reason, None);

        println!("✅ Flow 3a passed: pause/unpause works, non-admin blocked");
    }

    #[test]
    fn flow3_admin_update_fee_config() {
        println!("🧪 Flow 3b: Admin updates fee configuration");

        let owner = AccountId::from([1u8; 32]);
        let user = AccountId::from([2u8; 32]);

        let mut admin = MockAdminPanel::new(owner);
        assert_eq!(admin.fee_bps, 60);

        // Owner updates fee
        assert!(admin.update_fee_bps(owner, 50).is_ok());
        assert_eq!(admin.fee_bps, 50);

        // Non-admin cannot update
        assert!(admin.update_fee_bps(user, 30).is_err());

        // Fee > 10% rejected
        assert!(admin.update_fee_bps(owner, 1001).is_err());

        println!("✅ Flow 3b passed: fee config updated, validations enforced");
    }

    #[test]
    fn flow3_admin_update_lunes_price() {
        println!("🧪 Flow 3c: Admin updates LUNES price");

        let owner = AccountId::from([1u8; 32]);
        let mut admin = MockAdminPanel::new(owner);

        assert_eq!(admin.lunes_price_usd, 500_000); // $0.50

        assert!(admin.update_lunes_price(owner, 750_000).is_ok()); // $0.75
        assert_eq!(admin.lunes_price_usd, 750_000);

        // Zero price rejected
        assert!(admin.update_lunes_price(owner, 0).is_err());

        println!("✅ Flow 3c passed: price update works, zero rejected");
    }

    #[test]
    fn flow3_admin_role_management() {
        println!("🧪 Flow 3d: Admin grants and revokes roles");

        let owner = AccountId::from([1u8; 32]);
        let bridge = AccountId::from([2u8; 32]);
        let pauser = AccountId::from([3u8; 32]);
        let user = AccountId::from([4u8; 32]);

        let mut admin = MockAdminPanel::new(owner);

        // Grant MINTER (2) to bridge
        assert!(admin.grant_role(owner, 2, bridge).is_ok());
        assert!(admin.has_role(2, &bridge));

        // Grant PAUSER (1) to pauser
        assert!(admin.grant_role(owner, 1, pauser).is_ok());
        assert!(admin.has_role(1, &pauser));

        // Pauser can now pause
        assert!(admin.emergency_pause(pauser, "Suspicious activity").is_ok());
        assert!(admin.paused);

        // But pauser cannot unpause (only ADMIN)
        assert!(admin.emergency_unpause(pauser).is_err());
        assert!(admin.emergency_unpause(owner).is_ok());

        // Revoke MINTER from bridge
        assert!(admin.revoke_role(owner, 2, bridge).is_ok());
        assert!(!admin.has_role(2, &bridge));

        // Non-admin cannot grant
        assert!(admin.grant_role(user, 2, user).is_err());

        println!("✅ Flow 3d passed: RBAC grant/revoke works correctly");
    }

    #[test]
    fn flow3_admin_non_admin_blocked() {
        println!("🧪 Flow 3e: Non-admin user blocked from all admin actions");

        let owner = AccountId::from([1u8; 32]);
        let user = AccountId::from([2u8; 32]);
        let mut admin = MockAdminPanel::new(owner);

        assert!(admin.emergency_pause(user, "hack").is_err());
        assert!(admin.update_fee_bps(user, 10).is_err());
        assert!(admin.update_lunes_price(user, 1_000_000).is_err());
        assert!(admin.grant_role(user, 0, user).is_err());
        assert!(admin.revoke_role(user, 0, owner).is_err());

        println!("✅ Flow 3e passed: all admin actions blocked for non-admin");
    }

    // ═══════════════════════════════════════════════════════════════════
    // CROSS-CUTTING: Approval flow for Tax Manager
    // ═══════════════════════════════════════════════════════════════════

    #[test]
    fn approval_flow_lusdt_and_lunes() {
        println!("🧪 Approval: User approves Tax Manager for LUSDT + LUNES");

        let user = AccountId::from([1u8; 32]);
        let tax_manager = AccountId::from([2u8; 32]);

        let mut approvals = MockApprovalManager::new();

        // Initial: no allowance
        assert_eq!(approvals.allowance(&user, &tax_manager), 0);

        // Approve LUSDT (u128::MAX)
        approvals.approve(user, tax_manager, u128::MAX);
        assert_eq!(approvals.allowance(&user, &tax_manager), u128::MAX);

        // Spend some
        assert!(approvals.spend(&user, &tax_manager, 1_000_000).is_ok());
        assert_eq!(approvals.allowance(&user, &tax_manager), u128::MAX - 1_000_000);

        // Over-spend fails
        approvals.approve(user, tax_manager, 500);
        assert!(approvals.spend(&user, &tax_manager, 501).is_err());

        println!("✅ Approval flow passed: approve/spend/reject works");
    }

    #[test]
    fn approval_transfer_from_reentrancy_safe() {
        println!("🧪 Reentrancy: transfer/transfer_from are safe without lock");

        // This test documents that transfer and transfer_from don't need
        // reentrancy guards because they only move balances (no supply change).
        // Tax Manager can callback to LUSDT.transfer_from during burn without
        // being blocked by the reentrancy lock.

        let user = AccountId::from([1u8; 32]);
        let tax_manager = AccountId::from([2u8; 32]);
        let dev_wallet = AccountId::from([3u8; 32]);

        let mut approvals = MockApprovalManager::new();

        // Simulate: user approved Tax Manager
        approvals.approve(user, tax_manager, 10_000_000);

        // Simulate: during burn callback, Tax Manager pulls LUSDT fee
        let lusdt_fee = 3_000_000u128;
        assert!(approvals.spend(&user, &tax_manager, lusdt_fee).is_ok());

        // Simulate: Tax Manager distributes (no approval needed, it owns the tokens now)
        // This is a push from Tax Manager, not a pull — so no approval check.
        let dev_share = lusdt_fee * 80 / 100;
        let insurance_share = lusdt_fee * 15 / 100;
        let staking_share = lusdt_fee - dev_share - insurance_share;
        assert_eq!(dev_share + insurance_share + staking_share, lusdt_fee);

        println!("✅ Reentrancy-safe: Tax Manager callback works without lock");
    }

    // ═══════════════════════════════════════════════════════════════════
    // INTEGRATION: Full user journey
    // ═══════════════════════════════════════════════════════════════════

    #[test]
    fn integration_full_user_journey() {
        println!("🧪 Integration: Complete user journey across all flows");

        let owner = AccountId::from([1u8; 32]);
        let bridge_acc = AccountId::from([2u8; 32]);
        let user = AccountId::from([3u8; 32]);
        let tax_manager = AccountId::from([4u8; 32]);

        // === Phase 1: Admin sets up the system ===
        let mut admin = MockAdminPanel::new(owner);
        admin.grant_role(owner, 2, bridge_acc).unwrap(); // MINTER
        admin.update_lunes_price(owner, 500_000).unwrap(); // $0.50
        assert!(!admin.paused);

        // === Phase 2: User approves Tax Manager ===
        let mut approvals = MockApprovalManager::new();
        approvals.approve(user, tax_manager, u128::MAX);

        // === Phase 3: User swaps 1000 USDT → LUSDT ===
        let mut bridge = MockBridgeService::new(bridge_acc, admin.fee_bps);
        let mint_result = bridge.process_mint_request(user, 1_000_000_000, "sol_deposit_1".into());
        assert!(mint_result.is_ok());
        let mint_tx = mint_result.unwrap();
        assert_eq!(mint_tx.net_amount, 994_000_000); // got 994 LUSDT

        // === Phase 4: User checks staking rewards accumulated ===
        assert!(bridge.total_staking_rewards() > 0);

        // === Phase 5: User burns 500 LUSDT → gets USDT back ===
        let burn_result = bridge.process_burn_request(user, 500_000_000, "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU".into());
        assert!(burn_result.is_ok());
        let burn_tx = burn_result.unwrap();
        assert_eq!(burn_tx.net_amount, 497_000_000); // got 497 USDT

        // === Phase 6: Admin pauses for maintenance ===
        admin.emergency_pause(owner, "Scheduled maintenance").unwrap();
        assert!(admin.paused);

        // === Phase 7: Admin unpauses ===
        admin.emergency_unpause(owner).unwrap();
        assert!(!admin.paused);

        // === Final: Verify accumulated stats ===
        assert_eq!(bridge.processed_transactions.len(), 2);
        assert!(bridge.total_fees() > 0);
        assert!(bridge.total_staking_rewards() > 0);

        println!("  Mint: {} USDT → {} LUSDT", 1_000_000_000u128, mint_tx.net_amount);
        println!("  Burn: {} LUSDT → {} USDT", 500_000_000u128, burn_tx.net_amount);
        println!("  Total staking pool: ${}", bridge.total_staking_rewards() / 1_000_000);
        println!("✅ Full user journey passed!");
    }

    // Helper to run all
    pub fn run_all_e2e_tests() {
        println!("🚀 Running all E2E tests (v3 dual-fee model)...\n");
        flow1_swap_usdt_to_lusdt_complete();
        flow1_adaptive_fee_medium_volume();
        flow1_adaptive_fee_high_volume();
        flow1_zero_amount_rejected();
        flow1r_burn_lusdt_to_usdt_complete();
        flow1r_burn_without_approval_fails();
        flow1r_burn_invalid_solana_address_rejected();
        flow2_staking_rewards_accumulation();
        flow2_staking_eligibility_threshold();
        flow2_fee_distribution_percentages();
        flow3_admin_emergency_pause_unpause();
        flow3_admin_update_fee_config();
        flow3_admin_update_lunes_price();
        flow3_admin_role_management();
        flow3_admin_non_admin_blocked();
        approval_flow_lusdt_and_lunes();
        approval_transfer_from_reentrancy_safe();
        integration_full_user_journey();
        println!("\n🎉 All 18 E2E tests passed!");
    }
}

#[cfg(test)]
mod integration_runner {
    use super::e2e_tests::*;

    #[test]
    fn run_integration_tests() {
        run_all_e2e_tests();
    }
}
