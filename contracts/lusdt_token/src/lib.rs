//! # LUSDT Token Contract - Security Hardened with RBAC
//! # Contrato de Token LUSDT - Endurecimento de Segurança com RBAC
//!
//! A secure, audited implementation of a cross-chain bridge token for Lunes <-> Solana.
//! Uma implementação segura e auditada de um token de ponte cross-chain para Lunes <-> Solana.
//!
//! ## Security Features / Recursos de Segurança
//! - Role-Based Access Control (RBAC) Multimembers / Controle de Acesso Baseado em Papéis
//! - Emergency Circuit Breaker (pause/unpause) / Disjuntor de Emergência
//! - Safe arithmetic operations / Operações aritméticas seguras
//! - Reentrancy protection / Proteção contra reentrância
//!
//! ## Roles / Papéis
//! - DEFAULT_ADMIN_ROLE (0): Gerencia outros papéis.
//! - PAUSER_ROLE (1): Pode pausar o contrato em emergências.
//! - MINTER_ROLE (2): Pode mintar novos tokens (Bridge).
//! - TAX_MANAGER_ROLE (3): Pode configurar taxas e carteiras.

#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![allow(unexpected_cfgs)]
#![allow(clippy::cast_possible_truncation)]

#[ink::contract]
mod lusdt_token {
    use ink::prelude::string::String;
    use ink::storage::Mapping;

    #[cfg(not(test))]
    use common::{common_types::{FeeType, OperationType}, traits::TaxManager};

    // Role Constants
    pub type Role = u32;
    pub const DEFAULT_ADMIN_ROLE: Role = 0;
    pub const PAUSER_ROLE: Role = 1;
    pub const MINTER_ROLE: Role = 2; // Substitutes BRIDGE_ROLE
    pub const TAX_MANAGER_ROLE: Role = 3;

    /// @title LUSDT Token Storage
    #[ink(storage)]
    pub struct LusdtToken {
        /// Contract version
        version: u16,
        /// Total supply
        total_supply: Balance,
        /// Balances
        balances: Mapping<AccountId, Balance>,
        /// Allowances
        allowances: Mapping<(AccountId, AccountId), Balance>,

        // === SECURITY: Role-Based Access Control (RBAC) ===
        /// Mapping from (Role, Account) to boolean
        roles: Mapping<(Role, AccountId), bool>,
        
        /// Tax manager contract address (External Contract)
        tax_manager_contract: AccountId,

        // === SECURITY: Circuit Breaker ===
        paused: bool,
        pause_reason: Option<String>,
        paused_at: Option<u64>,

        // === SECURITY: Reentrancy Protection ===
        locked: bool,

        // === SECURITY: Rate Limiting ===
        last_mint_time: u64,
        mint_window_amount: Balance,
        mint_window_start: u64,
    }

    /// @title LUSDT Events
    #[ink(event)]
    pub struct Transfer {
        #[ink(topic)]
        from: Option<AccountId>,
        #[ink(topic)]
        to: Option<AccountId>,
        value: Balance,
        block_timestamp: u64,
    }

    #[ink(event)]
    pub struct Approval {
        #[ink(topic)]
        owner: AccountId,
        #[ink(topic)]
        spender: AccountId,
        value: Balance,
    }

    #[ink(event)]
    pub struct RedemptionRequested {
        #[ink(topic)]
        from: AccountId,
        amount: Balance,
        solana_recipient_address: String,
        request_id: u64,
        block_timestamp: u64,
    }

    // === SECURITY EVENTS ===

    #[ink(event)]
    pub struct EmergencyPause {
        #[ink(topic)]
        admin: AccountId,
        reason: String,
        timestamp: u64,
    }

    #[ink(event)]
    pub struct EmergencyUnpause {
        #[ink(topic)]
        admin: AccountId,
        timestamp: u64,
    }

    #[ink(event)]
    pub struct RoleGranted {
        #[ink(topic)]
        role: Role,
        #[ink(topic)]
        account: AccountId,
        #[ink(topic)]
        admin: AccountId,
    }

    #[ink(event)]
    pub struct RoleRevoked {
        #[ink(topic)]
        role: Role,
        #[ink(topic)]
        account: AccountId,
        #[ink(topic)]
        admin: AccountId,
    }

    #[ink(event)]
    pub struct SecurityAlert {
        operation: String,
        message: String,
        timestamp: Timestamp,
    }

    /// @title Error Types
    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        InsufficientBalance,
        InsufficientAllowance,
        InvalidSolanaAddress,
        Unauthorized, // Generic unauthorized
        MissingRole, // Specific for RBAC
        ContractPaused,
        ReentrancyDetected,
        RateLimitExceeded,
        MathOverflow,
        MathUnderflow,
        InvalidRole,
        EmergencyActive,
        InvalidTimestamp,
        SetCodeHashFailed,
    }

    pub type Result<T> = core::result::Result<T, Error>;

    impl LusdtToken {
        /// @notice Initializes the LUSDT token contract with RBAC
        #[ink(constructor)]
        pub fn new(
            tax_manager_contract: AccountId,
            initial_minter: AccountId, // Bridge
            initial_pauser: AccountId, // Emergency Admin
        ) -> Self {
            let caller = Self::env().caller();
            
            let mut instance = Self {
                version: 2, // RBAC Version
                total_supply: 0,
                balances: Mapping::new(),
                allowances: Mapping::new(),
                roles: Mapping::new(),
                tax_manager_contract,
                paused: false,
                pause_reason: None,
                paused_at: None,
                locked: false,
                mint_window_amount: 0,
                mint_window_start: Self::env().block_timestamp(),
                last_mint_time: Self::env().block_timestamp(),
            };

            // Setup Default Roles
            instance._grant_role(DEFAULT_ADMIN_ROLE, caller); // Deployer is Admin
            instance._grant_role(MINTER_ROLE, initial_minter); // Bridge is Minter
            instance._grant_role(PAUSER_ROLE, initial_pauser); // Emergency Admin is Pauser
            instance._grant_role(TAX_MANAGER_ROLE, caller); // Deployer is also Tax Manager initially

            instance
        }

        // === RBAC FUNCTIONS ===

        /// @notice Checks if account has specific role
        #[ink(message)]
        pub fn has_role(&self, role: Role, account: AccountId) -> bool {
            self.roles.get((role, account)).unwrap_or(false)
        }

        /// @notice Grants role to account. Only ADMIN can call.
        #[ink(message)]
        pub fn grant_role(&mut self, role: Role, account: AccountId) -> Result<()> {
            self.ensure_role(DEFAULT_ADMIN_ROLE)?;
            self._grant_role(role, account);
            Ok(())
        }

        /// @notice Revokes role from account. Only ADMIN can call.
        #[ink(message)]
        pub fn revoke_role(&mut self, role: Role, account: AccountId) -> Result<()> {
            self.ensure_role(DEFAULT_ADMIN_ROLE)?;
            self._revoke_role(role, account);
            Ok(())
        }

        /// @notice Internal grant role
        fn _grant_role(&mut self, role: Role, account: AccountId) {
            if !self.has_role(role, account) {
                self.roles.insert((role, account), &true);
                self.env().emit_event(RoleGranted {
                    role,
                    account,
                    admin: self.env().caller(),
                });
            }
        }

        /// @notice Internal revoke role
        fn _revoke_role(&mut self, role: Role, account: AccountId) {
            if self.has_role(role, account) {
                self.roles.remove((role, account));
                self.env().emit_event(RoleRevoked {
                    role,
                    account,
                    admin: self.env().caller(),
                });
            }
        }

        /// @notice Helper to ensure caller has role
        fn ensure_role(&self, role: Role) -> Result<()> {
            if !self.has_role(role, self.env().caller()) {
                return Err(Error::MissingRole);
            }
            Ok(())
        }

        // === UPGRADEABILITY ===

        #[ink(message)]
        pub fn set_code(&mut self, code_hash: Hash) -> Result<()> {
            self.ensure_role(DEFAULT_ADMIN_ROLE)?;
            self.env()
                .set_code_hash(&code_hash)
                .map_err(|_| Error::SetCodeHashFailed)?;
            Ok(())
        }

        // === EMERGENCY CONTROLS (Circuit Breaker) ===

        #[ink(message)]
        pub fn emergency_pause(&mut self, reason: String) -> Result<()> {
            // Checks both PAUSER and ADMIN for redundancy
            if !self.has_role(PAUSER_ROLE, self.env().caller()) && !self.has_role(DEFAULT_ADMIN_ROLE, self.env().caller()) {
                return Err(Error::MissingRole);
            }
            
            self.paused = true;
            self.pause_reason = Some(reason.clone());
            self.paused_at = Some(self.env().block_timestamp());
            
            self.env().emit_event(EmergencyPause {
                admin: self.env().caller(),
                reason,
                timestamp: self.env().block_timestamp(),
            });
            Ok(())
        }

        #[ink(message)]
        pub fn emergency_unpause(&mut self) -> Result<()> {
            self.ensure_role(DEFAULT_ADMIN_ROLE)?; // Only Admin can unpause

            if !self.paused {
                return Ok(());
            }

            self.paused = false;
            self.pause_reason = None;
            self.paused_at = None;

            self.env().emit_event(EmergencyUnpause {
                admin: self.env().caller(),
                timestamp: self.env().block_timestamp(),
            });

            Ok(())
        }

        #[ink(message)]
        pub fn pause_status(&self) -> (bool, Option<String>, Option<u64>) {
            (self.paused, self.pause_reason.clone(), self.paused_at)
        }

        // === RATE LIMITING ===
        
        fn check_mint_rate_limit(&mut self, amount: Balance) -> Result<()> {
            let current_time = self.env().block_timestamp();
            const RATE_LIMIT_WINDOW: u64 = 3600000; // 1 hour
            const MAX_MINT_PER_HOUR: Balance = 1_000_000_000_000; // 1M LUSDT

            if current_time.saturating_sub(self.mint_window_start) >= RATE_LIMIT_WINDOW {
                self.mint_window_start = current_time;
                self.mint_window_amount = 0;
            }

            let new_amount = self.mint_window_amount.checked_add(amount).ok_or(Error::MathOverflow)?;

            if new_amount > MAX_MINT_PER_HOUR {
                return Err(Error::RateLimitExceeded);
            }

            self.mint_window_amount = new_amount;
            Ok(())
        }

        // === CORE TOKEN FUNCTIONS ===

        #[ink(message)]
        pub fn get_version(&self) -> u16 {
            self.version
        }

        #[ink(message)]
        pub fn is_paused(&self) -> bool {
            self.paused
        }

        #[ink(message)]
        pub fn mint(&mut self, to: AccountId, amount: Balance) -> Result<()> {
            self.ensure_not_paused()?;
            self.ensure_not_locked()?;

            // Only MINTER or ADMIN can mint
            if !self.has_role(MINTER_ROLE, self.env().caller()) && !self.has_role(DEFAULT_ADMIN_ROLE, self.env().caller()) {
                return Err(Error::MissingRole);
            }

            let result = (|| {
                self.check_mint_rate_limit(amount)?;

                if amount == 0 { return Ok(()); }

                let new_total_supply = self.total_supply.checked_add(amount).ok_or(Error::MathOverflow)?;
                self.total_supply = new_total_supply;

                let current_balance = self.balances.get(to).unwrap_or(0);
                let new_balance = current_balance.checked_add(amount).ok_or(Error::MathOverflow)?;
                self.balances.insert(to, &new_balance);

                self.env().emit_event(Transfer {
                    from: None,
                    to: Some(to),
                    value: amount,
                    block_timestamp: self.env().block_timestamp(),
                });

                // Interactions with Tax Manager (v3: LUNES burn fee only for mint)
                // USDT fee is deducted by bridge BEFORE minting to maintain 1:1 backing.
                // On-chain we only charge the LUNES deflationary burn fee (0.10%).
                // Fee payer is `to` (the user), not caller (bridge). Soft-fail if user
                // hasn't approved Tax Manager for LUNES or doesn't hold LUNES.
                #[cfg(not(test))]
                {
                    let mut tax_manager: ink::contract_ref!(TaxManager) = self.tax_manager_contract.into();
                    if tax_manager.process_burn_fee_only(OperationType::Mint, to, amount).is_err() {
                         self.env().emit_event(SecurityAlert {
                            operation: "MintTaxProcessing".into(),
                            message: "Failed to process LUNES burn fee for mint.".into(),
                            timestamp: self.env().block_timestamp(),
                        });
                    }
                }
                Ok(())
            })();

            self.unlock();
            result
        }

        #[ink(message)]
        pub fn burn(&mut self, amount: Balance, solana_recipient_address: String) -> Result<()> {
            self.ensure_not_paused()?;
            self.ensure_not_locked()?;

            let result = (|| {
                let caller = self.env().caller();

                if solana_recipient_address.len() < 32 || solana_recipient_address.len() > 44 {
                    return Err(Error::InvalidSolanaAddress);
                }

                if amount == 0 { return Ok(()); }

                let current_balance = self.balances.get(caller).unwrap_or(0);
                if current_balance < amount {
                    return Err(Error::InsufficientBalance);
                }

                let new_balance = current_balance.checked_sub(amount).ok_or(Error::MathUnderflow)?;
                self.balances.insert(caller, &new_balance);

                let new_total_supply = self.total_supply.checked_sub(amount).ok_or(Error::MathUnderflow)?;
                self.total_supply = new_total_supply;

                let request_id = self.env().block_timestamp();

                self.env().emit_event(Transfer {
                    from: Some(caller),
                    to: None,
                    value: amount,
                    block_timestamp: request_id,
                });

                self.env().emit_event(RedemptionRequested {
                    from: caller,
                    amount,
                    solana_recipient_address,
                    request_id,
                    block_timestamp: request_id,
                });

                // Interactions with Tax Manager (v3: dual-fee — LUSDT revenue + LUNES burn)
                #[cfg(not(test))]
                {
                    let mut tax_manager: ink::contract_ref!(TaxManager) = self.tax_manager_contract.into();
                    if tax_manager.process_dual_fee(OperationType::Burn, caller, amount, FeeType::Lusdt).is_err() {
                        self.env().emit_event(SecurityAlert {
                            operation: "BurnTaxProcessing".into(),
                            message: "Failed to process dual fees for burn operation.".into(),
                            timestamp: self.env().block_timestamp(),
                        });
                    }
                }
                Ok(())
            })();

            self.unlock();
            result
        }

        #[ink(message)]
        /// @notice Transfer tokens. No reentrancy lock needed — this function only moves
        /// the caller's own balance and doesn't change total supply. Safe for cross-contract
        /// callbacks (e.g., Tax Manager distributing LUSDT fees during burn).
        pub fn transfer(&mut self, to: AccountId, value: Balance) -> Result<()> {
            self.ensure_not_paused()?;

            let from = self.env().caller();
            let from_balance = self.balances.get(from).unwrap_or(0);
            if from_balance < value {
                return Err(Error::InsufficientBalance);
            }

            let new_from_balance = from_balance.checked_sub(value).ok_or(Error::MathUnderflow)?;
            self.balances.insert(from, &new_from_balance);

            let to_balance = self.balances.get(to).unwrap_or(0);
            let new_to_balance = to_balance.checked_add(value).ok_or(Error::MathOverflow)?;
            self.balances.insert(to, &new_to_balance);

            self.env().emit_event(Transfer {
                from: Some(from),
                to: Some(to),
                value,
                block_timestamp: self.env().block_timestamp(),
            });
            Ok(())
        }

        #[ink(message)]
        pub fn approve(&mut self, spender: AccountId, amount: Balance) -> Result<()> {
            self.ensure_not_locked()?;
            let owner = self.env().caller();
            self.allowances.insert((owner, spender), &amount);
            self.env().emit_event(Approval {
                owner,
                spender,
                value: amount,
            });
            self.unlock();
            Ok(())
        }

        #[ink(message)]
        /// @notice Transfer tokens on behalf of owner (with allowance). No reentrancy lock
        /// needed — only moves pre-approved amounts with atomic allowance decrement, doesn't
        /// change total supply. Safe for cross-contract callbacks (e.g., Tax Manager pulling
        /// LUSDT fees during burn via transfer_from).
        pub fn transfer_from(&mut self, from: AccountId, to: AccountId, amount: Balance) -> Result<()> {
            self.ensure_not_paused()?;

            let caller = self.env().caller();
            let current_allowance = self.allowances.get((from, caller)).unwrap_or(0);
            if current_allowance < amount {
                return Err(Error::InsufficientAllowance);
            }

            let new_allowance = current_allowance.checked_sub(amount).ok_or(Error::MathUnderflow)?;
            self.allowances.insert((from, caller), &new_allowance);

            let from_balance = self.balances.get(from).unwrap_or(0);
            if from_balance < amount {
                return Err(Error::InsufficientBalance);
            }

            let new_from_balance = from_balance.checked_sub(amount).ok_or(Error::MathUnderflow)?;
            self.balances.insert(from, &new_from_balance);

            let to_balance = self.balances.get(to).unwrap_or(0);
            let new_to_balance = to_balance.checked_add(amount).ok_or(Error::MathOverflow)?;
            self.balances.insert(to, &new_to_balance);

            self.env().emit_event(Transfer {
                from: Some(from),
                to: Some(to),
                value: amount,
                block_timestamp: self.env().block_timestamp(),
            });
            Ok(())
        }

        #[ink(message)]
        pub fn total_supply(&self) -> Balance {
            self.total_supply
        }

        #[ink(message)]
        pub fn balance_of(&self, who: AccountId) -> Balance {
            self.balances.get(who).unwrap_or(0)
        }

        #[ink(message)]
        pub fn allowance(&self, owner: AccountId, spender: AccountId) -> Balance {
            self.allowances.get((owner, spender)).unwrap_or(0)
        }

        // === ADMIN FUNCTIONS (Role Protected) ===

        #[ink(message)]
        pub fn set_tax_manager_contract(&mut self, new_tax_manager: AccountId) -> Result<()> {
            // Only TAX_MANAGER or ADMIN can update this
            if !self.has_role(TAX_MANAGER_ROLE, self.env().caller()) && !self.has_role(DEFAULT_ADMIN_ROLE, self.env().caller()) {
                return Err(Error::MissingRole);
            }
            self.tax_manager_contract = new_tax_manager;
            Ok(())
        }

        #[ink(message)]
        pub fn get_tax_manager_contract(&self) -> AccountId {
            self.tax_manager_contract
        }

        // === HELPERS ===
        fn ensure_not_paused(&self) -> Result<()> {
            if self.paused { return Err(Error::ContractPaused); }
            Ok(())
        }

        fn ensure_not_locked(&mut self) -> Result<()> {
            if self.locked { return Err(Error::ReentrancyDetected); }
            self.locked = true;
            Ok(())
        }

        fn unlock(&mut self) {
            self.locked = false;
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use ink::env::{test::set_caller, DefaultEnvironment};

        const OWNER: [u8; 32] = [1; 32];
        const OPERATOR: [u8; 32] = [2; 32];
        const USER: [u8; 32] = [3; 32];
        const TAX_MAN: [u8; 32] = [4; 32];

        fn setup() -> LusdtToken {
            set_caller::<DefaultEnvironment>(OWNER.into());
            LusdtToken::new(TAX_MAN.into(), OPERATOR.into(), OWNER.into())
        }

        #[ink::test]
        fn rbac_initialization() {
            let contract = setup();
            assert!(contract.has_role(DEFAULT_ADMIN_ROLE, OWNER.into()));
            assert!(contract.has_role(MINTER_ROLE, OPERATOR.into()));
            assert!(!contract.has_role(DEFAULT_ADMIN_ROLE, OPERATOR.into()));
        }

        #[ink::test]
        fn grant_revoke_role_works() {
            let mut contract = setup();
            set_caller::<DefaultEnvironment>(OWNER.into());
            
            // Grant PAUSER to OPERATOR
            assert!(contract.grant_role(PAUSER_ROLE, OPERATOR.into()).is_ok());
            assert!(contract.has_role(PAUSER_ROLE, OPERATOR.into()));

            // Revoke PAUSER
            assert!(contract.revoke_role(PAUSER_ROLE, OPERATOR.into()).is_ok());
            assert!(!contract.has_role(PAUSER_ROLE, OPERATOR.into()));
        }

        #[ink::test]
        fn unauthorized_grant_fails() {
            let mut contract = setup();
            set_caller::<DefaultEnvironment>(USER.into());
            assert_eq!(contract.grant_role(MINTER_ROLE, USER.into()), Err(Error::MissingRole));
        }

        #[ink::test]
        fn mint_and_transfer_work() {
            let mut contract = setup();
            // Mint as MINTER (OPERATOR)
            set_caller::<DefaultEnvironment>(OPERATOR.into());
            assert!(contract.mint(USER.into(), 1_000_000).is_ok());
            assert_eq!(contract.balance_of(USER.into()), 1_000_000);
            assert_eq!(contract.total_supply(), 1_000_000);

            // Transfer as USER — no reentrancy lock, should work cleanly
            set_caller::<DefaultEnvironment>(USER.into());
            assert!(contract.transfer(OPERATOR.into(), 100_000).is_ok());
            assert_eq!(contract.balance_of(USER.into()), 900_000);
            assert_eq!(contract.balance_of(OPERATOR.into()), 100_000);
            // Total supply unchanged by transfer
            assert_eq!(contract.total_supply(), 1_000_000);
        }

        #[ink::test]
        fn approve_and_transfer_from_work() {
            let mut contract = setup();
            // Mint to USER
            set_caller::<DefaultEnvironment>(OPERATOR.into());
            assert!(contract.mint(USER.into(), 1_000_000).is_ok());

            // USER approves TAX_MAN (simulating Tax Manager approval)
            set_caller::<DefaultEnvironment>(USER.into());
            assert!(contract.approve(TAX_MAN.into(), 500_000).is_ok());
            assert_eq!(contract.allowance(USER.into(), TAX_MAN.into()), 500_000);

            // TAX_MAN calls transfer_from — no reentrancy lock needed
            // This simulates Tax Manager pulling LUSDT fee during burn
            set_caller::<DefaultEnvironment>(TAX_MAN.into());
            assert!(contract.transfer_from(USER.into(), TAX_MAN.into(), 100_000).is_ok());
            assert_eq!(contract.balance_of(USER.into()), 900_000);
            assert_eq!(contract.balance_of(TAX_MAN.into()), 100_000);
            assert_eq!(contract.allowance(USER.into(), TAX_MAN.into()), 400_000);
            // Total supply unchanged
            assert_eq!(contract.total_supply(), 1_000_000);
        }

        #[ink::test]
        fn transfer_from_fails_without_approval() {
            let mut contract = setup();
            set_caller::<DefaultEnvironment>(OPERATOR.into());
            assert!(contract.mint(USER.into(), 1_000_000).is_ok());

            // TAX_MAN tries transfer_from without approval
            set_caller::<DefaultEnvironment>(TAX_MAN.into());
            assert_eq!(
                contract.transfer_from(USER.into(), TAX_MAN.into(), 100),
                Err(Error::InsufficientAllowance)
            );
        }

        #[ink::test]
        fn transfer_from_fails_exceeding_allowance() {
            let mut contract = setup();
            set_caller::<DefaultEnvironment>(OPERATOR.into());
            assert!(contract.mint(USER.into(), 1_000_000).is_ok());

            set_caller::<DefaultEnvironment>(USER.into());
            assert!(contract.approve(TAX_MAN.into(), 50_000).is_ok());

            // TAX_MAN tries to pull more than approved
            set_caller::<DefaultEnvironment>(TAX_MAN.into());
            assert_eq!(
                contract.transfer_from(USER.into(), TAX_MAN.into(), 100_000),
                Err(Error::InsufficientAllowance)
            );
        }

        #[ink::test]
        fn burn_works_with_sufficient_balance() {
            let mut contract = setup();
            set_caller::<DefaultEnvironment>(OPERATOR.into());
            assert!(contract.mint(USER.into(), 1_000_000).is_ok());

            // USER burns — simulates LUSDT->USDT redemption
            set_caller::<DefaultEnvironment>(USER.into());
            assert!(contract.burn(500_000, "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU".into()).is_ok());
            assert_eq!(contract.balance_of(USER.into()), 500_000);
            assert_eq!(contract.total_supply(), 500_000);
        }

        #[ink::test]
        fn transfer_insufficient_balance_fails() {
            let mut contract = setup();
            set_caller::<DefaultEnvironment>(OPERATOR.into());
            assert!(contract.mint(USER.into(), 100).is_ok());

            set_caller::<DefaultEnvironment>(USER.into());
            assert_eq!(contract.transfer(OPERATOR.into(), 200), Err(Error::InsufficientBalance));
        }

        #[ink::test]
        fn paused_blocks_transfer_and_transfer_from() {
            let mut contract = setup();
            set_caller::<DefaultEnvironment>(OPERATOR.into());
            assert!(contract.mint(USER.into(), 1_000_000).is_ok());

            // Pause contract
            set_caller::<DefaultEnvironment>(OWNER.into());
            assert!(contract.emergency_pause("test".into()).is_ok());

            // Transfer blocked
            set_caller::<DefaultEnvironment>(USER.into());
            assert_eq!(contract.transfer(OPERATOR.into(), 100), Err(Error::ContractPaused));

            // transfer_from also blocked
            set_caller::<DefaultEnvironment>(TAX_MAN.into());
            assert_eq!(
                contract.transfer_from(USER.into(), TAX_MAN.into(), 100),
                Err(Error::ContractPaused)
            );
        }
    }
}
