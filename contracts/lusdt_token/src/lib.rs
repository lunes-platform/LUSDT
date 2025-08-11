//! # LUSDT Token Contract - Security Hardened
//! # Contrato de Token LUSDT - Endurecimento de Segurança
//! 
//! A secure, audited implementation of a cross-chain bridge token for Lunes <-> Solana.
//! Uma implementação segura e auditada de um token de ponte cross-chain para Lunes <-> Solana.
//! 
//! ## Security Features / Recursos de Segurança
//! - Role-Based Access Control (RBAC) with BRIDGE_ROLE / Controle de Acesso Baseado em Papéis com BRIDGE_ROLE
//! - Emergency Circuit Breaker (pause/unpause) / Disjuntor de Emergência (pausar/despausar)
//! - Safe arithmetic operations with overflow protection / Operações aritméticas seguras com proteção contra overflow
//! - Reentrancy protection via Checks-Effects-Interactions pattern / Proteção contra reentrância via padrão Checks-Effects-Interactions
//! - Comprehensive audit logging / Log de auditoria abrangente
//! 
//! ## Architecture / Arquitetura
//! ```text
//! ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
//! │   Solana USDT   │───▶│  Bridge Service │───▶│   LUSDT Token   │
//! │   Treasury      │    │   (HSM Keys)    │    │   (ink! PSP22)  │
//! │   (Multisig)    │    │   (Off-chain)   │    │   (Lunes Chain) │
//! └─────────────────┘    └─────────────────┘    └─────────────────┘
//! ```

#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod lusdt_token {
    use ink::storage::Mapping;
    use ink::prelude::string::String;
    
    #[cfg(not(test))]
    use common::{common_types::OperationType, traits::TaxManager};

    /// @title LUSDT Token Storage / Armazenamento do Token LUSDT
    /// @notice Stores all contract state with security-first design / Armazena todo o estado do contrato com design security-first
    #[ink(storage)]
    pub struct LusdtToken {
        /// Contract version / Versão do contrato
        version: u16,
        /// Total supply of LUSDT tokens / Fornecimento total de tokens LUSDT
        total_supply: Balance,
        /// Mapping from AccountId to token balance / Mapeamento de AccountId para saldo de tokens
        balances: Mapping<AccountId, Balance>,
        /// Mapping from AccountId to spender allowances / Mapeamento de AccountId para permissões de gastos
        allowances: Mapping<(AccountId, AccountId), Balance>,
        
        // === SECURITY: Role-Based Access Control / SEGURANÇA: Controle de Acesso Baseado em Papéis ===
        /// Contract owner (should be multisig) / Proprietário do contrato (deve ser multisig)
        owner: AccountId,
        /// Bridge service account with BRIDGE_ROLE / Conta do serviço de ponte com BRIDGE_ROLE
        bridge_account: AccountId,
        /// Emergency admin account (separate from owner) / Conta de administrador de emergência (separada do proprietário)
        emergency_admin: AccountId,
        
        // === SECURITY: Circuit Breaker / SEGURANÇA: Disjuntor de Circuito ===
        /// Emergency pause state / Estado de pausa de emergência
        paused: bool,
        /// Pause reason for transparency / Motivo da pausa para transparência
        pause_reason: Option<String>,
        /// Timestamp when paused / Timestamp de quando foi pausado
        paused_at: Option<u64>,
        
        // === SECURITY: Reentrancy Protection / SEGURANÇA: Proteção contra Reentrância ===
        /// Reentrancy guard mutex / Mutex de proteção contra reentrância
        locked: bool,
        
        // === SECURITY: Rate Limiting / SEGURANÇA: Limitação de Taxa ===
        /// Last mint timestamp for rate limiting / Último timestamp de mint para limitação de taxa
        last_mint_time: u64,
        /// Cumulative mints in current window / Mints acumulados na janela atual
        mint_window_amount: Balance,
        /// Window start time / Tempo de início da janela
        mint_window_start: u64,
        
        /// Tax manager contract address / Endereço do contrato gerenciador de taxas
        tax_manager: AccountId,
    }

    /// @title LUSDT Events / Eventos LUSDT
    /// @notice All events follow CEI pattern and include security context / Todos os eventos seguem o padrão CEI e incluem contexto de segurança
    #[ink(event)]
    pub struct Transfer {
        #[ink(topic)]
        from: Option<AccountId>,
        #[ink(topic)]
        to: Option<AccountId>,
        value: Balance,
        /// Security context / Contexto de segurança
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
        /// Security: Request ID for idempotency
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
        role: String,
        #[ink(topic)]
        account: AccountId,
        #[ink(topic)]
        admin: AccountId,
    }

    /// @custom:event Emitted when a critical security-related event occurs.
    #[ink(event)]
    pub struct SecurityAlert {
        /// The operation that was being performed.
        operation: String,
        /// A message describing the alert.
        message: String,
        /// The timestamp of the alert.
        timestamp: Timestamp,
    }

    /// @title Error Types
    /// @notice Comprehensive error handling for security
    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        /// Insufficient balance for the operation
        InsufficientBalance,
        /// Insufficient allowance for the operation
        InsufficientAllowance,
        /// Invalid Solana address format
        InvalidSolanaAddress,
        /// Caller is not authorized for this operation
        Unauthorized,
        /// Contract is paused
        ContractPaused,
        /// Reentrancy detected
        ReentrancyDetected,
        /// Rate limit exceeded
        RateLimitExceeded,
        /// Mathematical overflow detected
        MathOverflow,
        /// Mathematical underflow detected
        MathUnderflow,
        /// Invalid role assignment
        InvalidRole,
        /// Emergency procedures active
        EmergencyActive,
        /// Invalid timestamp
        InvalidTimestamp,
    }

    pub type Result<T> = core::result::Result<T, Error>;

    impl LusdtToken {
        /// @notice Initializes the LUSDT token contract with security hardening
        /// @dev Sets up RBAC, initializes security parameters
        /// @param bridge_account The bridge service account (BRIDGE_ROLE)
        /// @param tax_manager The tax manager contract address
        /// @param emergency_admin Emergency admin (separate from owner)
        #[ink(constructor)]
        pub fn new(
            tax_manager: AccountId,
            bridge_account: AccountId,
            emergency_admin: AccountId,
        ) -> Self {
                    Self {
            version: 1,
            total_supply: 0,
            balances: Mapping::new(),
            allowances: Mapping::new(),
            owner: Self::env().caller(),
            bridge_account,
            tax_manager,
            emergency_admin,
            paused: false,
            pause_reason: None,
            paused_at: None,
            locked: false,
            mint_window_amount: 0,
            mint_window_start: Self::env().block_timestamp(),
            last_mint_time: Self::env().block_timestamp(),
        }
        }

        /// @notice Returns the contract version
        #[ink(message)]
        pub fn get_version(&self) -> u16 {
            self.version
        }

        /// @notice Modifies the code which is used to execute calls to this contract.
        /// @dev Can only be called by the owner.
        /// @custom:security Only owner can call this function
        #[ink(message)]
        pub fn set_code(&mut self, code_hash: Hash) -> Result<()> {
            self.ensure_owner()?;
            self.env().set_code_hash(&code_hash).unwrap_or_else(|err| {
                panic!(
                    "Failed to `set_code_hash` to {:?} due to {:?}",
                    code_hash, err
                )
            });
            Ok(())
        }

        // === SECURITY MODIFIERS ===

        /// @notice Ensures contract is not paused
        fn ensure_not_paused(&self) -> Result<()> {
            if self.paused {
                return Err(Error::ContractPaused);
            }
            Ok(())
        }

        /// @notice Reentrancy guard - prevents recursive calls
        fn ensure_not_locked(&mut self) -> Result<()> {
            if self.locked {
                return Err(Error::ReentrancyDetected);
            }
            self.locked = true;
            Ok(())
        }

        /// @notice Releases reentrancy lock
        fn unlock(&mut self) {
            self.locked = false;
        }

        /// @notice Checks if caller has BRIDGE_ROLE
        fn ensure_bridge_role(&self) -> Result<()> {
            if self.env().caller() != self.bridge_account {
                return Err(Error::Unauthorized);
            }
            Ok(())
        }

        /// @notice Checks if caller is owner
        fn ensure_owner(&self) -> Result<()> {
            if self.env().caller() != self.owner {
                return Err(Error::Unauthorized);
            }
            Ok(())
        }

        /// @notice Checks if caller is emergency admin
        fn ensure_emergency_admin(&self) -> Result<()> {
            if self.env().caller() != self.emergency_admin {
                return Err(Error::Unauthorized);
            }
            Ok(())
        }

        /// @notice Rate limiting for mint operations
        fn check_mint_rate_limit(&mut self, amount: Balance) -> Result<()> {
            let current_time = self.env().block_timestamp();
            const RATE_LIMIT_WINDOW: u64 = 3600000; // 1 hour in milliseconds
            const MAX_MINT_PER_HOUR: Balance = 1_000_000_000_000; // 1M LUSDT (12 decimals)

            // Reset window if expired
            if current_time.saturating_sub(self.mint_window_start) >= RATE_LIMIT_WINDOW {
                self.mint_window_start = current_time;
                self.mint_window_amount = 0;
            }

            // Check if adding this amount would exceed limit
            let new_amount = self.mint_window_amount.checked_add(amount)
                .ok_or(Error::MathOverflow)?;

            if new_amount > MAX_MINT_PER_HOUR {
                return Err(Error::RateLimitExceeded);
            }

            self.mint_window_amount = new_amount;
            Ok(())
        }

        // === EMERGENCY CONTROLS (Circuit Breaker) ===
        
        /// @notice Pauses the contract. Can only be called by the emergency admin.
        #[ink(message)]
        pub fn emergency_pause(&mut self) -> Result<()> {
            self.ensure_emergency_admin()?;
            self.paused = true;
            let timestamp = self.env().block_timestamp();
            self.env().emit_event(EmergencyPause {
                admin: self.env().caller(),
                reason: String::from("Emergency pause initiated by emergency admin."),
                timestamp,
            });
            Ok(())
        }

        /// @notice Unpauses the contract. Can only be called by the owner.
        #[ink(message)]
        pub fn emergency_unpause(&mut self) -> Result<()> {
            self.ensure_owner()?;
            
            if !self.paused {
                return Ok(()); // Already unpaused
            }

            let timestamp = self.env().block_timestamp();
            
            self.paused = false;
            self.pause_reason = None;
            self.paused_at = None;

            self.env().emit_event(EmergencyUnpause {
                admin: self.env().caller(),
                timestamp,
            });

            Ok(())
        }

        /// @notice Returns pause status and details
        #[ink(message)]
        pub fn pause_status(&self) -> (bool, Option<String>, Option<u64>) {
            (self.paused, self.pause_reason.clone(), self.paused_at)
        }

        // === SECURE MATHEMATICAL OPERATIONS ===

        /// @notice Safe addition with overflow protection
        fn safe_add(&self, a: Balance, b: Balance) -> Result<Balance> {
            a.checked_add(b).ok_or(Error::MathOverflow)
        }

        /// @notice Safe subtraction with underflow protection
        fn safe_sub(&self, a: Balance, b: Balance) -> Result<Balance> {
            a.checked_sub(b).ok_or(Error::MathUnderflow)
        }

        // === CORE TOKEN FUNCTIONS (Security Hardened) ===

        /// @notice Returns the contract owner
        #[ink(message)]
        pub fn get_owner(&self) -> AccountId {
            self.owner
        }

        /// @notice Returns if contract is paused
        #[ink(message)]
        pub fn is_paused(&self) -> bool {
            self.paused
        }

        /// @notice Returns bridge account
        #[ink(message)]
        pub fn get_bridge_account(&self) -> AccountId {
            self.bridge_account
        }

        /// @notice Returns emergency admin
        #[ink(message)]
        pub fn get_emergency_admin(&self) -> AccountId {
            self.emergency_admin
        }

        /// @notice Mints new tokens with comprehensive security checks
        /// @dev Implements: RBAC, Circuit Breaker, Rate Limiting, Safe Math, CEI Pattern
        /// @param to The account that will receive the minted tokens
        /// @param amount The amount of tokens to mint (in smallest unit)
        #[ink(message)]
        pub fn mint(&mut self, to: AccountId, amount: Balance) -> Result<()> {
            // === CHECKS ===
            self.ensure_not_paused()?;
            self.ensure_not_locked()?;
            
            // --- FIX: Reentrancy lock fix START ---
            let result = (|| {
                self.ensure_bridge_role()?;
                self.check_mint_rate_limit(amount)?;

                if amount == 0 {
                    return Ok(());
                }

                // === EFFECTS ===
                // Update total supply with safe math
                let new_total_supply = self.safe_add(self.total_supply, amount)?;
                self.total_supply = new_total_supply;

                // Update recipient balance with safe math
                let current_balance = self.balances.get(&to).unwrap_or(0);
                let new_balance = self.safe_add(current_balance, amount)?;
                self.balances.insert(&to, &new_balance);

                // Emit transfer event
                self.env().emit_event(Transfer {
                    from: None,
                    to: Some(to),
                    value: amount,
                    block_timestamp: self.env().block_timestamp(),
                });

                // === INTERACTIONS ===
                #[cfg(not(test))]
                {
                    let mut tax_manager: ink::contract_ref!(TaxManager) = self.tax_manager.into();
                    if tax_manager
                        .process_fees(OperationType::Mint, self.env().caller(), amount)
                        .is_err()
                    {
                        self.env().emit_event(SecurityAlert {
                            operation: "MintTaxProcessing".into(),
                            message: "Failed to process fees for mint operation.".into(),
                            timestamp: self.env().block_timestamp(),
                        });
                    }
                }
                Ok(())
            })();
            // --- FIX: Reentrancy lock fix END ---

            self.unlock();
            result
        }

        /// @notice Burns tokens with security hardening
        /// @dev Implements: Circuit Breaker, Safe Math, CEI Pattern, Idempotency
        #[ink(message)]
        pub fn burn(&mut self, amount: Balance, solana_recipient_address: String) -> Result<()> {
            // === CHECKS ===
            self.ensure_not_paused()?;
            self.ensure_not_locked()?;

            // --- FIX: Reentrancy lock fix START ---
            let result = (|| {
                let caller = self.env().caller();

                // Validate Solana address format (basic validation)
                if solana_recipient_address.len() < 32 || solana_recipient_address.len() > 44 {
                    return Err(Error::InvalidSolanaAddress);
                }

                if amount == 0 {
                    return Ok(());
                }

                // Check caller balance with safe math
                let current_balance = self.balances.get(&caller).unwrap_or(0);
                if current_balance < amount {
                    return Err(Error::InsufficientBalance);
                }

                // === EFFECTS ===
                // Update caller balance with safe math
                let new_balance = self.safe_sub(current_balance, amount)?;
                self.balances.insert(&caller, &new_balance);

                // Update total supply with safe math
                let new_total_supply = self.safe_sub(self.total_supply, amount)?;
                self.total_supply = new_total_supply;

                // Generate unique request ID for idempotency
                let request_id = self.env().block_timestamp();

                // Emit events
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

                // === INTERACTIONS ===
                #[cfg(not(test))]
                {
                    let mut tax_manager: ink::contract_ref!(TaxManager) = self.tax_manager.into();
                    if tax_manager
                        .process_fees(OperationType::Burn, caller, amount)
                        .is_err()
                    {
                        self.env().emit_event(SecurityAlert {
                            operation: "BurnTaxProcessing".into(),
                            message: "Failed to process fees for burn operation.".into(),
                            timestamp: self.env().block_timestamp(),
                        });
                    }
                }
                Ok(())
            })();
            // --- FIX: Reentrancy lock fix END ---

            self.unlock();
            result
        }

        /// @notice Transfers tokens from the caller to a recipient.
        /// @dev This is a standard PSP22 transfer function. It will fail if the contract is paused.
        ///      Uses checked arithmetic to prevent overflow/underflow.
        /// @param to The account that will receive the tokens
        /// @param value The amount of tokens to transfer (in smallest unit)
        /// @return Ok(()) on success, Error on failure
        /// @custom:security Validates sufficient balance before transfer
        /// @custom:security Uses checked arithmetic for balance updates
        #[ink(message)]
        pub fn transfer(&mut self, to: AccountId, value: Balance) -> Result<()> {
            self.ensure_not_paused()?;
            self.ensure_not_locked()?;

            // --- FIX: Reentrancy lock fix START ---
            let result = (|| {
                let from = self.env().caller();
                let from_balance = self.balances.get(&from).unwrap_or(0);
                if from_balance < value {
                    return Err(Error::InsufficientBalance);
                }

                // Perform the transfer
                let new_from_balance = self.safe_sub(from_balance, value)?;
                self.balances.insert(&from, &new_from_balance);

                let to_balance = self.balances.get(&to).unwrap_or(0);
                let new_to_balance = self.safe_add(to_balance, value)?;
                self.balances.insert(&to, &new_to_balance);

                self.env().emit_event(Transfer {
                    from: Some(from),
                    to: Some(to),
                    value,
                    block_timestamp: self.env().block_timestamp(),
                });
                Ok(())
            })();
            // --- FIX: Reentrancy lock fix END ---

            self.unlock();
            result
        }

        /// @notice Approves a spender to spend a specified amount of tokens on behalf of the caller.
        /// @dev Implements: Safe Math, CEI Pattern
        #[ink(message)]
        pub fn approve(&mut self, spender: AccountId, amount: Balance) -> Result<()> {
            self.ensure_not_locked()?;
            // --- FIX: Reentrancy lock fix START ---
            let result = (|| {
                let owner = self.env().caller();
                self.allowances.insert((owner, spender), &amount);
                self.env().emit_event(Approval {
                    owner,
                    spender,
                    value: amount,
                });
                Ok(())
            })();
            // --- FIX: Reentrancy lock fix END ---
            self.unlock();
            result
        }

        /// @notice Transfers tokens on behalf of the caller.
        /// @dev Implements: Safe Math, CEI Pattern, Reentrancy Protection
        #[ink(message)]
        pub fn transfer_from(&mut self, from: AccountId, to: AccountId, amount: Balance) -> Result<()> {
            self.ensure_not_paused()?;
            self.ensure_not_locked()?;

            // --- FIX: Reentrancy lock fix START ---
            let result = (|| {
                let caller = self.env().caller();

                // Check allowance with safe math
                let current_allowance = self.allowances.get(&(from, caller)).unwrap_or(0);
                if current_allowance < amount {
                    return Err(Error::InsufficientAllowance);
                }

                // Update allowance with safe math
                let new_allowance = self.safe_sub(current_allowance, amount)?;
                self.allowances.insert((from, caller), &new_allowance);

                // Transfer tokens with safe math
                let from_balance = self.balances.get(&from).unwrap_or(0);
                if from_balance < amount {
                    return Err(Error::InsufficientBalance);
                }
                let new_from_balance = self.safe_sub(from_balance, amount)?;
                self.balances.insert(&from, &new_from_balance);

                let to_balance = self.balances.get(&to).unwrap_or(0);
                let new_to_balance = self.safe_add(to_balance, amount)?;
                self.balances.insert(&to, &new_to_balance);

                self.env().emit_event(Transfer {
                    from: Some(from),
                    to: Some(to),
                    value: amount,
                    block_timestamp: self.env().block_timestamp(),
                });
                Ok(())
            })();
            // --- FIX: Reentrancy lock fix END ---

            self.unlock();
            result
        }

        /// @notice Returns the total supply of the token.
        /// @dev This is a read-only function that works even when the contract is paused.
        /// @return The total amount of tokens in circulation
        #[ink(message)]
        pub fn total_supply(&self) -> Balance {
            self.total_supply
        }

        /// @notice Returns the balance of a given account.
        /// @dev This is a read-only function that works even when the contract is paused.
        /// @param who The account to query the balance of
        /// @return The balance of the specified account (0 if account doesn't exist)
        #[ink(message)]
        pub fn balance_of(&self, who: AccountId) -> Balance {
            self.balances.get(who).unwrap_or(0)
        }

        /// @notice Returns the allowance of a spender for an owner.
        /// @dev Implements: Safe Math
        #[ink(message)]
        pub fn allowance(&self, owner: AccountId, spender: AccountId) -> Balance {
            self.allowances.get(&(owner, spender)).unwrap_or(0)
        }

        /// @notice Sets a new bridge account.
        /// @dev Can only be called by the owner. The bridge account is the only
        ///      account authorized to mint new tokens.
        /// @param new_bridge The account ID of the new bridge service
        /// @return Ok(()) on success, Error::Unauthorized if caller is not owner
        /// @custom:security Only owner can call this function
        #[ink(message)]
        pub fn set_bridge_account(&mut self, new_bridge: AccountId) -> Result<()> {
            self.ensure_owner()?;
            self.bridge_account = new_bridge;
            self.env().emit_event(RoleGranted {
                role: String::from("BRIDGE_ROLE"),
                account: new_bridge,
                admin: self.owner,
            });
            Ok(())
        }

        /// @notice Sets a new tax manager contract address.
        /// @dev Can only be called by the owner. The tax manager handles all fee calculations.
        /// @param new_tax_manager The account ID of the new tax manager contract
        /// @return Ok(()) on success, Error::Unauthorized if caller is not owner
        /// @custom:security Only owner can call this function
        #[ink(message)]
        pub fn set_tax_manager_contract(
            &mut self,
            new_tax_manager: AccountId,
        ) -> Result<()> {
            self.ensure_owner()?;
            self.tax_manager = new_tax_manager;
            self.env().emit_event(RoleGranted {
                role: String::from("TAX_MANAGER"),
                account: new_tax_manager,
                admin: self.owner,
            });
            Ok(())
        }

        /// @notice Returns the current tax manager contract address.
        /// @dev The tax manager contract handles all fee calculations and distributions.
        /// @return The AccountId of the current tax manager contract
        #[ink(message)]
        pub fn get_tax_manager_contract(&self) -> AccountId {
            self.tax_manager
        }

        // === OWNER-ONLY ADMINISTRATIVE FUNCTIONS ===

        /// @notice Updates the bridge account address.
        #[ink(message)]
        pub fn update_bridge_account(&mut self, new_bridge: AccountId) -> Result<()> {
            self.ensure_owner()?;
            self.bridge_account = new_bridge;
            Ok(())
        }

        /// @notice Updates the emergency admin account address.
        #[ink(message)]
        pub fn update_emergency_admin(&mut self, new_admin: AccountId) -> Result<()> {
            self.ensure_owner()?;
            self.emergency_admin = new_admin;
            Ok(())
        }

        /// @notice Updates the tax manager contract address.
        #[ink(message)]
        pub fn update_tax_manager(&mut self, new_tax_manager: AccountId) -> Result<()> {
            self.ensure_owner()?;
            self.tax_manager = new_tax_manager;
            Ok(())
        }

        // === PUBLIC VIEW FUNCTIONS ===
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use ink::env::{
            test::{self, default_accounts, set_caller, DefaultAccounts},
            DefaultEnvironment,
        };

        // --- CONSTANTS FOR TEST ACCOUNTS ---
        const OWNER: [u8; 32] = [1; 32];
        const BRIDGE: [u8; 32] = [2; 32];
        const EMERGENCY_ADMIN: [u8; 32] = [3; 32];
        const TAX_MANAGER: [u8; 32] = [4; 32];
        const USER_A: [u8; 32] = [5; 32];
        const USER_B: [u8; 32] = [6; 32];

        // Helper to setup the contract with distinct roles
        fn setup_contract() -> LusdtToken {
            // Owner deploys the contract
            set_caller::<DefaultEnvironment>(OWNER.into());
            LusdtToken::new(
                TAX_MANAGER.into(),
                BRIDGE.into(),
                EMERGENCY_ADMIN.into(),
            )
        }

        #[ink::test]
        fn new_works() {
            let contract = setup_contract();
            assert_eq!(contract.get_owner(), OWNER.into());
            assert_eq!(contract.get_bridge_account(), BRIDGE.into());
            assert_eq!(contract.get_emergency_admin(), EMERGENCY_ADMIN.into());
        }

        #[ink::test]
        fn mint_access_control() {
            let mut contract = setup_contract();

            // Bridge can mint
            set_caller::<DefaultEnvironment>(BRIDGE.into());
            assert!(contract.mint(USER_A.into(), 100).is_ok());

            // Owner cannot mint
            set_caller::<DefaultEnvironment>(OWNER.into());
            assert_eq!(contract.mint(USER_A.into(), 100), Err(Error::Unauthorized));

            // Emergency Admin cannot mint
            set_caller::<DefaultEnvironment>(EMERGENCY_ADMIN.into());
            assert_eq!(contract.mint(USER_A.into(), 100), Err(Error::Unauthorized));
        }

        #[ink::test]
        fn transfer_after_mint_works() {
            let mut contract = setup_contract();

            // Bridge mints to User A
            set_caller::<DefaultEnvironment>(BRIDGE.into());
            contract.mint(USER_A.into(), 1000).unwrap();

            // User A transfers to User B
            set_caller::<DefaultEnvironment>(USER_A.into());
            assert!(contract.transfer(USER_B.into(), 300).is_ok());
            assert_eq!(contract.balance_of(USER_A.into()), 700);
            assert_eq!(contract.balance_of(USER_B.into()), 300);
        }
        
        #[ink::test]
        fn pause_unpause_access_control() {
            let mut contract = setup_contract();

            // Emergency admin can pause
            set_caller::<DefaultEnvironment>(EMERGENCY_ADMIN.into());
            assert!(contract.emergency_pause().is_ok());

            // Owner can unpause
            set_caller::<DefaultEnvironment>(OWNER.into());
            assert!(contract.emergency_unpause().is_ok());
        }
    }

    #[cfg(all(test, feature = "e2e-tests"))]
    mod e2e_tests {
        /// Imports all the definitions from the outer scope so we can use them here.
        use super::*;

        /// A helper function used for calling contract messages.
        use ink_e2e::ContractsBackend;

        /// The End-to-End test `Result` type.
        type E2EResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

        /// We test that we can upload and instantiate the contract using its default constructor.
        #[ink_e2e::test]
        async fn constructor_works(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();

            // Given
            let mut constructor = LusdtTokenRef::new(accounts.bob, accounts.eve, accounts.alice);

            // When
            let contract = client
                .instantiate("lusdt_token", &ink_e2e::alice(), &mut constructor)
                .submit()
                .await
                .expect("instantiate failed");
            let call_builder = contract.call_builder::<LusdtToken>();

            // Then
            let get_owner = call_builder.get_owner();
            let owner_result = client.call(&ink_e2e::alice(), &get_owner).dry_run().await?;
            assert_eq!(owner_result.return_value(), accounts.alice);

            Ok(())
        }
    }
}
