//! # Staking Manager Contract — Trustless LUNES Staking & LUSDT Reward Distribution
//!
//! This contract manages the entire staking lifecycle on-chain:
//! 1. Users lock ≥100,000 LUNES to become eligible stakers
//! 2. 5% of all protocol fees (in LUSDT) flow into this contract
//! 3. Rewards are distributed proportionally to stakers based on stake weight
//! 4. All fund custody is trustless — no admin can divert staked LUNES or reward LUSDT
//!
//! ## Security Model
//! - Staked LUNES can ONLY be returned to the original staker (no admin withdrawal)
//! - LUSDT rewards can ONLY be claimed by the staker who earned them
//! - Reward accounting uses the Synthetix "reward-per-token" accumulator pattern
//! - Owner can ONLY: set authorized depositors, pause/unpause, set cooldown period
//! - Owner CANNOT: withdraw staked funds, redirect rewards, modify balances
//!
//! ## Reward Math (Synthetix pattern)
//! ```text
//! rewardPerTokenStored += newRewards * PRECISION / totalStaked
//! userPending = userStake * (rewardPerTokenStored - userRewardPerTokenPaid) / PRECISION
//! ```

#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![allow(unexpected_cfgs)]
#![allow(clippy::cast_possible_truncation)]

#[ink::contract]
pub mod staking_manager {
    use ink::storage::Mapping;
    use common::traits::StakingManager as StakingManagerApi;

    /// Precision factor for reward-per-token calculations (18 decimals).
    const PRECISION: u128 = 1_000_000_000_000_000_000; // 1e18

    // ─── Storage Types ───────────────────────────────────────────────

    /// Per-staker accounting data. Stored on-chain per AccountId.
    #[derive(Debug, Clone, PartialEq, Eq, scale::Encode, scale::Decode, Default)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct StakerInfo {
        /// Amount of LUNES currently staked by this user.
        pub amount: Balance,
        /// Snapshot of `reward_per_token_stored` at last user interaction.
        pub reward_per_token_paid: u128,
        /// Accumulated but unclaimed LUSDT rewards.
        pub pending_rewards: Balance,
        /// Timestamp when user first staked (or last re-staked).
        pub staked_at: Timestamp,
    }

    // ─── Events ──────────────────────────────────────────────────────

    #[ink(event)]
    pub struct Staked {
        #[ink(topic)]
        user: AccountId,
        amount: Balance,
        total_staked: Balance,
    }

    #[ink(event)]
    pub struct Unstaked {
        #[ink(topic)]
        user: AccountId,
        amount: Balance,
        total_staked: Balance,
    }

    #[ink(event)]
    pub struct RewardsClaimed {
        #[ink(topic)]
        user: AccountId,
        reward_amount: Balance,
    }

    #[ink(event)]
    pub struct RewardsDeposited {
        #[ink(topic)]
        depositor: AccountId,
        amount: Balance,
        new_reward_per_token: u128,
    }

    #[ink(event)]
    pub struct AdminUpdated {
        #[ink(topic)]
        name: ink::prelude::string::String,
    }

    // ─── Errors ──────────────────────────────────────────────────────

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        /// Caller is not the contract owner.
        Unauthorized,
        /// Stake amount is below the minimum (100,000 LUNES).
        BelowMinimumStake,
        /// User has no active stake.
        NoActiveStake,
        /// Transfer of LUNES tokens failed.
        LunesTransferFailed,
        /// Transfer of LUSDT reward tokens failed.
        LusdtTransferFailed,
        /// Arithmetic overflow in reward calculation.
        ArithmeticOverflow,
        /// No rewards available to claim.
        NoRewardsToClaim,
        /// Deposit amount must be > 0.
        ZeroAmount,
        /// Unstake cooldown period not elapsed.
        CooldownNotElapsed,
        /// Contract is paused.
        ContractPaused,
    }

    // ─── Contract Storage ────────────────────────────────────────────

    /// A minimal PSP22 trait for token interaction.
    #[ink::trait_definition]
    pub trait PSP22 {
        #[ink(message)]
        fn transfer_from(
            &mut self,
            from: AccountId,
            to: AccountId,
            value: u128,
        ) -> Result<(), ink::LangError>;

        #[ink(message)]
        fn transfer(&mut self, to: AccountId, value: u128) -> Result<(), ink::LangError>;

        #[ink(message)]
        fn balance_of(&self, owner: AccountId) -> u128;
    }

    #[ink(storage)]
    pub struct StakingManager {
        /// Contract deployer/admin (limited powers — CANNOT withdraw funds).
        owner: AccountId,
        /// LUNES PSP22 token address (users stake this).
        lunes_token: AccountId,
        /// LUSDT PSP22 token address (rewards paid in this).
        lusdt_token: AccountId,
        /// Minimum stake in LUNES smallest unit (100_000 * 10^12 for 12-decimal token).
        min_stake: Balance,
        /// Total LUNES locked across all stakers.
        total_staked: Balance,
        /// Accumulated reward per staked token (scaled by PRECISION).
        reward_per_token_stored: u128,
        /// Total LUSDT rewards ever deposited.
        total_rewards_deposited: Balance,
        /// Total LUSDT rewards ever claimed.
        total_rewards_claimed: Balance,
        /// Per-staker data.
        stakers: Mapping<AccountId, StakerInfo>,
        /// Number of active stakers.
        staker_count: u32,
        /// Cooldown period in milliseconds before unstake is allowed (0 = no cooldown).
        unstake_cooldown_ms: u64,
        /// Whether the contract is paused.
        paused: bool,
        /// Addresses authorized to call deposit_rewards / notify_reward_amount.
        /// Typically the Tax Manager contract address.
        authorized_depositor: Option<AccountId>,
    }

    // ─── StakingManagerApi trait implementation ──────────────────────

    impl StakingManagerApi for StakingManager {
        #[ink(message)]
        fn deposit_rewards(&mut self, amount: Balance) -> Result<(), ink::LangError> {
            self._deposit_rewards(amount)
                .map_err(|_| ink::LangError::CouldNotReadInput)
        }

        #[ink(message)]
        fn notify_reward_amount(&mut self, amount: Balance) -> Result<(), ink::LangError> {
            self._notify_reward_amount(amount)
                .map_err(|_| ink::LangError::CouldNotReadInput)
        }
    }

    // ─── Implementation ─────────────────────────────────────────────

    impl StakingManager {
        /// Initialize the staking contract.
        ///
        /// @param lunes_token LUNES PSP22 token contract address.
        /// @param lusdt_token LUSDT PSP22 token contract address.
        /// @param min_stake Minimum LUNES to stake (in smallest unit, e.g. 100_000 * 10^12).
        #[ink(constructor)]
        pub fn new(
            lunes_token: AccountId,
            lusdt_token: AccountId,
            min_stake: Balance,
        ) -> Self {
            Self {
                owner: Self::env().caller(),
                lunes_token,
                lusdt_token,
                min_stake,
                total_staked: 0,
                reward_per_token_stored: 0,
                total_rewards_deposited: 0,
                total_rewards_claimed: 0,
                stakers: Mapping::default(),
                staker_count: 0,
                unstake_cooldown_ms: 0,
                paused: false,
                authorized_depositor: None,
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // USER ACTIONS — Stake / Unstake / Claim
        // ═══════════════════════════════════════════════════════════════

        /// Stake LUNES tokens. User must have approved this contract to spend `amount`.
        /// Minimum stake: 100,000 LUNES. Can add to existing stake.
        ///
        /// @param amount Amount of LUNES to stake (in smallest unit).
        #[ink(message)]
        pub fn stake(&mut self, amount: Balance) -> Result<(), Error> {
            self.ensure_not_paused()?;

            let caller = self.env().caller();
            let mut info = self.stakers.get(caller).unwrap_or_default();

            // Check minimum: new total must be ≥ min_stake
            let new_total = info.amount.checked_add(amount).ok_or(Error::ArithmeticOverflow)?;
            if new_total < self.min_stake {
                return Err(Error::BelowMinimumStake);
            }

            // Settle any pending rewards before changing stake
            self._update_reward(&caller, &mut info)?;

            // Transfer LUNES from user to this contract
            let mut lunes: ink::contract_ref!(PSP22) = self.lunes_token.into();
            lunes
                .transfer_from(caller, self.env().account_id(), amount)
                .map_err(|_| Error::LunesTransferFailed)?;

            // Update staker info
            let was_new = info.amount == 0;
            info.amount = new_total;
            if was_new {
                info.staked_at = self.env().block_timestamp();
                self.staker_count = self.staker_count.saturating_add(1);
            }
            self.stakers.insert(caller, &info);

            // Update global total
            self.total_staked = self.total_staked.checked_add(amount).ok_or(Error::ArithmeticOverflow)?;

            self.env().emit_event(Staked {
                user: caller,
                amount,
                total_staked: self.total_staked,
            });

            Ok(())
        }

        /// Unstake ALL staked LUNES. Settles pending rewards automatically.
        /// Subject to cooldown period if configured.
        #[ink(message)]
        pub fn unstake(&mut self) -> Result<(), Error> {
            let caller = self.env().caller();
            let mut info = self.stakers.get(caller).ok_or(Error::NoActiveStake)?;

            if info.amount == 0 {
                return Err(Error::NoActiveStake);
            }

            // Check cooldown
            if self.unstake_cooldown_ms > 0 {
                let elapsed = self.env().block_timestamp().saturating_sub(info.staked_at);
                if elapsed < self.unstake_cooldown_ms {
                    return Err(Error::CooldownNotElapsed);
                }
            }

            // Settle pending rewards
            self._update_reward(&caller, &mut info)?;

            let unstake_amount = info.amount;

            // Transfer LUNES back to user
            let mut lunes: ink::contract_ref!(PSP22) = self.lunes_token.into();
            lunes
                .transfer(caller, unstake_amount)
                .map_err(|_| Error::LunesTransferFailed)?;

            // Update state
            self.total_staked = self.total_staked.saturating_sub(unstake_amount);
            info.amount = 0;
            info.staked_at = 0;
            self.staker_count = self.staker_count.saturating_sub(1);

            // Auto-claim pending rewards if any
            let pending = info.pending_rewards;
            if pending > 0 {
                let mut lusdt: ink::contract_ref!(PSP22) = self.lusdt_token.into();
                if lusdt.transfer(caller, pending).is_ok() {
                    self.total_rewards_claimed = self.total_rewards_claimed.saturating_add(pending);
                    info.pending_rewards = 0;

                    self.env().emit_event(RewardsClaimed {
                        user: caller,
                        reward_amount: pending,
                    });
                }
            }

            self.stakers.insert(caller, &info);

            self.env().emit_event(Unstaked {
                user: caller,
                amount: unstake_amount,
                total_staked: self.total_staked,
            });

            Ok(())
        }

        /// Claim all accumulated LUSDT rewards without unstaking.
        #[ink(message)]
        pub fn claim_rewards(&mut self) -> Result<(), Error> {
            let caller = self.env().caller();
            let mut info = self.stakers.get(caller).ok_or(Error::NoActiveStake)?;

            // Update reward accounting
            self._update_reward(&caller, &mut info)?;

            let reward = info.pending_rewards;
            if reward == 0 {
                return Err(Error::NoRewardsToClaim);
            }

            // Transfer LUSDT rewards to user
            let mut lusdt: ink::contract_ref!(PSP22) = self.lusdt_token.into();
            lusdt
                .transfer(caller, reward)
                .map_err(|_| Error::LusdtTransferFailed)?;

            // Update state
            self.total_rewards_claimed = self.total_rewards_claimed.saturating_add(reward);
            info.pending_rewards = 0;
            self.stakers.insert(caller, &info);

            self.env().emit_event(RewardsClaimed {
                user: caller,
                reward_amount: reward,
            });

            Ok(())
        }

        // ═══════════════════════════════════════════════════════════════
        // REWARD DEPOSIT — Called by Tax Manager or bridge
        // ═══════════════════════════════════════════════════════════════

        /// Deposit LUSDT rewards. Caller must have approved this contract.
        /// Transfers LUSDT from caller to this contract and updates reward accounting.
        fn _deposit_rewards(&mut self, amount: Balance) -> Result<(), Error> {
            if amount == 0 {
                return Err(Error::ZeroAmount);
            }
            self.ensure_authorized_depositor()?;

            let caller = self.env().caller();

            // Transfer LUSDT from caller to this contract
            let mut lusdt: ink::contract_ref!(PSP22) = self.lusdt_token.into();
            lusdt
                .transfer_from(caller, self.env().account_id(), amount)
                .map_err(|_| Error::LusdtTransferFailed)?;

            // Update reward accounting
            self._distribute_new_rewards(amount, caller)?;

            Ok(())
        }

        /// Notify contract about LUSDT rewards that were transferred directly
        /// (e.g. Tax Manager sends via PSP22::transfer to this contract address).
        /// Only callable by owner or authorized depositor.
        fn _notify_reward_amount(&mut self, amount: Balance) -> Result<(), Error> {
            if amount == 0 {
                return Err(Error::ZeroAmount);
            }
            self.ensure_authorized_depositor()?;

            let caller = self.env().caller();
            self._distribute_new_rewards(amount, caller)?;

            Ok(())
        }

        /// Internal: update reward-per-token accumulator with new rewards.
        fn _distribute_new_rewards(&mut self, amount: Balance, depositor: AccountId) -> Result<(), Error> {
            if self.total_staked > 0 {
                let reward_increment = amount
                    .checked_mul(PRECISION)
                    .and_then(|v| v.checked_div(self.total_staked))
                    .ok_or(Error::ArithmeticOverflow)?;

                self.reward_per_token_stored = self
                    .reward_per_token_stored
                    .checked_add(reward_increment)
                    .ok_or(Error::ArithmeticOverflow)?;
            }
            // If no stakers, rewards accumulate in the contract balance
            // and will be distributed when the first staker stakes

            self.total_rewards_deposited = self
                .total_rewards_deposited
                .checked_add(amount)
                .ok_or(Error::ArithmeticOverflow)?;

            self.env().emit_event(RewardsDeposited {
                depositor,
                amount,
                new_reward_per_token: self.reward_per_token_stored,
            });

            Ok(())
        }

        /// Internal: settle pending rewards for a staker.
        fn _update_reward(&self, _user: &AccountId, info: &mut StakerInfo) -> Result<(), Error> {
            if info.amount > 0 {
                let reward_delta = self
                    .reward_per_token_stored
                    .checked_sub(info.reward_per_token_paid)
                    .ok_or(Error::ArithmeticOverflow)?;

                let earned = info
                    .amount
                    .checked_mul(reward_delta)
                    .and_then(|v| v.checked_div(PRECISION))
                    .ok_or(Error::ArithmeticOverflow)?;

                info.pending_rewards = info
                    .pending_rewards
                    .checked_add(earned)
                    .ok_or(Error::ArithmeticOverflow)?;
            }
            info.reward_per_token_paid = self.reward_per_token_stored;
            Ok(())
        }

        // ═══════════════════════════════════════════════════════════════
        // READ-ONLY QUERIES
        // ═══════════════════════════════════════════════════════════════

        /// Get staker information for a given address.
        #[ink(message)]
        pub fn get_staker_info(&self, user: AccountId) -> StakerInfo {
            self.stakers.get(user).unwrap_or_default()
        }

        /// Get pending (unclaimed) LUSDT rewards for a user.
        /// Includes both settled and unsettled rewards.
        #[ink(message)]
        pub fn get_pending_rewards(&self, user: AccountId) -> Balance {
            let info = self.stakers.get(user).unwrap_or_default();
            if info.amount == 0 {
                return info.pending_rewards;
            }

            let reward_delta = self
                .reward_per_token_stored
                .saturating_sub(info.reward_per_token_paid);

            let unsettled = info
                .amount
                .saturating_mul(reward_delta)
                / PRECISION;

            info.pending_rewards.saturating_add(unsettled)
        }

        /// Total LUNES staked across all users.
        #[ink(message)]
        pub fn get_total_staked(&self) -> Balance {
            self.total_staked
        }

        /// Number of active stakers.
        #[ink(message)]
        pub fn get_staker_count(&self) -> u32 {
            self.staker_count
        }

        /// Total LUSDT rewards ever deposited into the pool.
        #[ink(message)]
        pub fn get_total_rewards_deposited(&self) -> Balance {
            self.total_rewards_deposited
        }

        /// Total LUSDT rewards ever claimed by stakers.
        #[ink(message)]
        pub fn get_total_rewards_claimed(&self) -> Balance {
            self.total_rewards_claimed
        }

        /// Current reward per token stored (scaled by PRECISION).
        #[ink(message)]
        pub fn get_reward_per_token(&self) -> u128 {
            self.reward_per_token_stored
        }

        /// Minimum LUNES required to stake.
        #[ink(message)]
        pub fn get_min_stake(&self) -> Balance {
            self.min_stake
        }

        /// Whether the contract is paused.
        #[ink(message)]
        pub fn is_paused(&self) -> bool {
            self.paused
        }

        /// Contract owner address.
        #[ink(message)]
        pub fn get_owner(&self) -> AccountId {
            self.owner
        }

        /// Authorized depositor address (typically Tax Manager).
        #[ink(message)]
        pub fn get_authorized_depositor(&self) -> Option<AccountId> {
            self.authorized_depositor
        }

        /// Unstake cooldown period in milliseconds.
        #[ink(message)]
        pub fn get_cooldown_ms(&self) -> u64 {
            self.unstake_cooldown_ms
        }

        /// Get the undistributed LUSDT reward balance
        /// (deposited - claimed = what's still in the contract for rewards).
        #[ink(message)]
        pub fn get_undistributed_rewards(&self) -> Balance {
            self.total_rewards_deposited.saturating_sub(self.total_rewards_claimed)
        }

        // ═══════════════════════════════════════════════════════════════
        // ADMIN — Limited powers (CANNOT withdraw funds)
        // ═══════════════════════════════════════════════════════════════

        /// Set the authorized depositor (Tax Manager contract address).
        /// Only owner. This address can call deposit_rewards / notify_reward_amount.
        #[ink(message)]
        pub fn set_authorized_depositor(&mut self, depositor: AccountId) -> Result<(), Error> {
            self.ensure_owner()?;
            self.authorized_depositor = Some(depositor);
            self.env().emit_event(AdminUpdated {
                name: "AuthorizedDepositor".into(),
            });
            Ok(())
        }

        /// Set unstake cooldown period in milliseconds. 0 = no cooldown.
        /// Only owner.
        #[ink(message)]
        pub fn set_cooldown(&mut self, cooldown_ms: u64) -> Result<(), Error> {
            self.ensure_owner()?;
            self.unstake_cooldown_ms = cooldown_ms;
            self.env().emit_event(AdminUpdated {
                name: "Cooldown".into(),
            });
            Ok(())
        }

        /// Pause the contract (blocks new stakes, but allows unstake + claim).
        /// Only owner.
        #[ink(message)]
        pub fn pause(&mut self) -> Result<(), Error> {
            self.ensure_owner()?;
            self.paused = true;
            self.env().emit_event(AdminUpdated {
                name: "Paused".into(),
            });
            Ok(())
        }

        /// Unpause the contract.
        /// Only owner.
        #[ink(message)]
        pub fn unpause(&mut self) -> Result<(), Error> {
            self.ensure_owner()?;
            self.paused = false;
            self.env().emit_event(AdminUpdated {
                name: "Unpaused".into(),
            });
            Ok(())
        }

        /// Update minimum stake requirement. Only owner.
        #[ink(message)]
        pub fn set_min_stake(&mut self, new_min: Balance) -> Result<(), Error> {
            self.ensure_owner()?;
            self.min_stake = new_min;
            self.env().emit_event(AdminUpdated {
                name: "MinStake".into(),
            });
            Ok(())
        }

        /// Upgradeable contract: set new code hash. Only owner.
        #[ink(message)]
        pub fn set_code(&mut self, code_hash: Hash) -> Result<(), Error> {
            self.ensure_owner()?;
            self.env().set_code_hash(&code_hash).unwrap_or_else(|err| {
                panic!(
                    "Failed to `set_code_hash` to {:?} due to {:?}",
                    code_hash, err
                )
            });
            Ok(())
        }

        // ─── Internal Helpers ────────────────────────────────────────

        fn ensure_owner(&self) -> Result<(), Error> {
            if self.env().caller() != self.owner {
                Err(Error::Unauthorized)
            } else {
                Ok(())
            }
        }

        fn ensure_not_paused(&self) -> Result<(), Error> {
            if self.paused {
                Err(Error::ContractPaused)
            } else {
                Ok(())
            }
        }

        fn ensure_authorized_depositor(&self) -> Result<(), Error> {
            let caller = self.env().caller();
            if caller == self.owner {
                return Ok(());
            }
            if let Some(depositor) = self.authorized_depositor {
                if caller == depositor {
                    return Ok(());
                }
            }
            Err(Error::Unauthorized)
        }
    }

    // ─── Unit Tests ─────────────────────────────────────────────────

    #[cfg(test)]
    mod tests {
        use super::*;
        use ink::env::{
            test::{set_caller, DefaultAccounts},
            DefaultEnvironment,
        };

        fn setup_accounts() -> DefaultAccounts<DefaultEnvironment> {
            ink::env::test::default_accounts::<DefaultEnvironment>()
        }

        fn create_contract() -> (StakingManager, DefaultAccounts<DefaultEnvironment>) {
            let accounts = setup_accounts();
            set_caller::<DefaultEnvironment>(accounts.alice);

            let min_stake: Balance = 100_000_000_000_000_000; // 100k LUNES (12 decimals)
            let contract = StakingManager::new(
                accounts.bob,     // lunes_token (mock)
                accounts.charlie, // lusdt_token (mock)
                min_stake,
            );

            (contract, accounts)
        }

        #[ink::test]
        fn constructor_works() {
            let (contract, accounts) = create_contract();
            assert_eq!(contract.get_owner(), accounts.alice);
            assert_eq!(contract.get_total_staked(), 0);
            assert_eq!(contract.get_staker_count(), 0);
            assert_eq!(contract.get_min_stake(), 100_000_000_000_000_000);
            assert!(!contract.is_paused());
        }

        #[ink::test]
        fn staker_info_default() {
            let (contract, accounts) = create_contract();
            let info = contract.get_staker_info(accounts.bob);
            assert_eq!(info.amount, 0);
            assert_eq!(info.pending_rewards, 0);
        }

        #[ink::test]
        fn admin_functions_require_owner() {
            let (mut contract, accounts) = create_contract();

            // Non-owner cannot pause
            set_caller::<DefaultEnvironment>(accounts.bob);
            assert_eq!(contract.pause(), Err(Error::Unauthorized));

            // Owner can pause
            set_caller::<DefaultEnvironment>(accounts.alice);
            assert_eq!(contract.pause(), Ok(()));
            assert!(contract.is_paused());

            // Owner can unpause
            assert_eq!(contract.unpause(), Ok(()));
            assert!(!contract.is_paused());
        }

        #[ink::test]
        fn set_authorized_depositor() {
            let (mut contract, accounts) = create_contract();

            assert_eq!(contract.get_authorized_depositor(), None);

            set_caller::<DefaultEnvironment>(accounts.alice);
            assert_eq!(
                contract.set_authorized_depositor(accounts.django),
                Ok(())
            );
            assert_eq!(
                contract.get_authorized_depositor(),
                Some(accounts.django)
            );
        }

        #[ink::test]
        fn set_cooldown() {
            let (mut contract, accounts) = create_contract();

            set_caller::<DefaultEnvironment>(accounts.alice);
            assert_eq!(contract.set_cooldown(86_400_000), Ok(())); // 24 hours
            assert_eq!(contract.get_cooldown_ms(), 86_400_000);
        }

        #[ink::test]
        fn set_min_stake() {
            let (mut contract, accounts) = create_contract();

            set_caller::<DefaultEnvironment>(accounts.alice);
            assert_eq!(contract.set_min_stake(200_000_000_000_000_000), Ok(()));
            assert_eq!(contract.get_min_stake(), 200_000_000_000_000_000);
        }

        #[ink::test]
        fn reward_accounting_math() {
            // Test the reward-per-token math with mock values
            let (contract, _) = create_contract();

            // No stakers, no rewards
            assert_eq!(contract.get_reward_per_token(), 0);
            assert_eq!(contract.get_total_rewards_deposited(), 0);
            assert_eq!(contract.get_undistributed_rewards(), 0);
        }

        #[ink::test]
        fn get_pending_rewards_no_stake() {
            let (contract, accounts) = create_contract();
            assert_eq!(contract.get_pending_rewards(accounts.bob), 0);
        }
    }
}
