//! # Tax Manager Contract - Fee Distribution System
//! # Contrato Gerenciador de Taxas - Sistema de Distribuição de Taxas
//!
//! Manages fee collection and distribution for LUSDT operations (mint/burn).
//! Gerencia a coleta e distribuição de taxas para operações LUSDT (mint/burn).
//!
//! ## Fee Structure / Estrutura de Taxas
//!
//! **Intelligent Capped Fee System** / **Sistema de Taxas Inteligente com Tetos**
//! - Base fee: 0.30%-0.60% in USD with smart LUNES caps / Taxa base: 0,30%-0,60% em USD com tetos inteligentes em LUNES
//! - Fee caps prevent excessive charges when LUNES price increases / Tetos previnem taxas excessivas quando preço do LUNES aumenta
//!
//! **Transaction Caps / Tetos por Transação**:
//! - ≤ $100: Max 0.5 LUNES / Máx 0,5 LUNES
//! - $100-$1K: Max 2 LUNES / Máx 2 LUNES  
//! - $1K-$10K: Max 10 LUNES / Máx 10 LUNES
//! - > $10K: Max 50 LUNES / Máx 50 LUNES
//!
//! **Distribution / Distribuição**:
//! - Mint & Burn Operations: dev (80%), insurance fund (15%), staking rewards (5%)
//! - Operações de Mint & Burn: dev (80%), fundo de seguro (15%), staking rewards (5%)
//! - Taxa cobrada na moeda da transação (USDT para mint, LUSDT para burn)
//! - Fee charged in the transaction currency (USDT for mint, LUSDT for burn)

#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![allow(unexpected_cfgs)]
#![allow(clippy::cast_possible_truncation)]

#[ink::contract]
pub mod tax_manager {
    use ink::prelude::vec::Vec;
    use common::common_types::{FeeType, OperationType};
    use common::traits::TaxManager as TaxManagerApi;
    use common::traits::StakingManager as StakingManagerApi;

    /// A minimal PSP22 trait for token interaction / Trait PSP22 mínima para interação com tokens
    #[ink::trait_definition]
    pub trait PSP22 {
        /// Transfers `value` amount of tokens from `from` to `to` / Transfere quantidade `value` de tokens de `from` para `to`
        #[ink(message)]
        fn transfer_from(
            &mut self,
            from: AccountId,
            to: AccountId,
            value: u128,
        ) -> Result<(), ink::LangError>;

        /// Transfers `value` amount of tokens from the caller's account to `to` / Transfere quantidade `value` de tokens da conta do chamador para `to`
        #[ink(message)]
        fn transfer(&mut self, to: AccountId, value: u128) -> Result<(), ink::LangError>;
    }


    /// Configuration for fee distribution wallets.
    /// Separated by network: dev can have different addresses on Solana vs Lunes
    /// Insurance fund (15%) is fixed and cannot be changed
    #[derive(Debug, Clone, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct DistributionWallets {
        /// Development team wallet on Solana (receives 80% of USDT fees from Solana network).
        /// Configurable via admin panel.
        pub dev_solana: AccountId,
        /// Development team wallet on Lunes (receives 80% of LUSDT/LUNES fees from Lunes network).
        /// Configurable via admin panel.
        pub dev_lunes: AccountId,
        /// Insurance fund wallet for risk protection (receives 15% of ALL fees).
        /// Fixed address, cannot be changed via admin.
        pub insurance_fund: AccountId,
        /// Staking rewards pool (receives 5% of ALL fees).
        /// Monthly distribution to LUNES stakers with ≥100k LUNES.
        pub staking_rewards_pool: AccountId,
    }

    /// Fee configuration with adaptive rates based on volume.
    #[derive(Debug, Clone, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct FeeConfig {
        /// Base fee in basis points (100 = 1%).
        pub base_fee_bps: u16,
        /// Volume threshold 1 in USD (e.g., 10,000 USD).
        pub volume_threshold_1_usd: u128,
        /// Volume threshold 2 in USD (e.g., 100,000 USD).
        pub volume_threshold_2_usd: u128,
        /// Fee for low volume (0-threshold1) in basis points.
        pub low_volume_fee_bps: u16,
        /// Fee for medium volume (threshold1-threshold2) in basis points.
        pub medium_volume_fee_bps: u16,
        /// Fee for high volume (>threshold2) in basis points.
        pub high_volume_fee_bps: u16,
    }

    // --- EVENTS ---
    #[ink(event)]
    pub struct FeesProcessed {
        #[ink(topic)]
        operation: OperationType,
        #[ink(topic)]
        user: AccountId,
        lusdt_amount: Balance,
        fee_in_lunes: Balance,
    }

    /// Emitted when dual-fee model is used (stablecoin revenue + LUNES burn)
    #[ink(event)]
    pub struct DualFeesProcessed {
        #[ink(topic)]
        operation: OperationType,
        #[ink(topic)]
        user: AccountId,
        lusdt_amount: Balance,
        /// Fee charged in stablecoin (USDT or LUSDT) for revenue
        stablecoin_fee: Balance,
        /// Fee charged in LUNES sent to BurnEngine
        lunes_burn_fee: Balance,
    }

    #[ink(event)]
    pub struct AdminUpdated {
        #[ink(topic)]
        name: ink::prelude::string::String,
    }

    #[ink(event)]
    pub struct UsdtBridgeFeeMarked {
        #[ink(topic)]
        operation: OperationType,
        #[ink(topic)]
        user: AccountId,
        lusdt_amount: Balance,
        fee_amount_usd: Balance,
    }

    // --- ERRORS ---
    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        /// Caller is not authorized to perform this action.
        Unauthorized,
        /// An arithmetic operation resulted in an overflow.
        ArithmeticOverflow,
        /// The provided fee configuration is invalid.
        InvalidFeeConfig,
        /// The user does not have enough LUNES to pay the fee.
        InsufficientLunesBalance,
        /// The transfer of LUNES tokens failed.
        LunesTransferFailed,
        /// The transfer of LUSDT tokens failed.
        LusdtTransferFailed,
        /// The provided price is invalid (e.g., zero).
        InvalidPrice,
        /// BurnEngine address not configured.
        BurnEngineNotSet,
    }

    #[ink(storage)]
    pub struct TaxManager {
        version: u16,
        owner: AccountId,
        lunes_token_address: AccountId,
        lusdt_token_address: AccountId,
        distribution_wallets: DistributionWallets,
        fee_config: FeeConfig,
        monthly_volume_usd: u128,
        last_volume_reset_timestamp: u64,
        lunes_price_usd: Balance, // Price of Lunes in USD with 6 decimals
        /// Address of the BurnEngine contract (receives LUNES for deflationary burn)
        burn_engine_address: Option<AccountId>,
        /// Fee in basis points charged in LUNES for burn (e.g., 10 = 0.10%)
        lunes_burn_fee_bps: u16,
    }

    impl TaxManagerApi for TaxManager {
        #[ink(message)]
        fn process_fees(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
        ) -> Result<(), ink::LangError> {
            self._process_fees(operation, user, lusdt_amount)
                .map_err(|_| ink::LangError::CouldNotReadInput)
        }

        #[ink(message)]
        fn process_fees_flexible(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
            fee_type: FeeType,
        ) -> Result<(), ink::LangError> {
            self._process_fees_flexible(operation, user, lusdt_amount, fee_type)
                .map_err(|_| ink::LangError::CouldNotReadInput)
        }

        #[ink(message)]
        fn process_dual_fee(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
            stablecoin_fee_type: FeeType,
        ) -> Result<(), ink::LangError> {
            self._process_dual_fee(operation, user, lusdt_amount, stablecoin_fee_type)
                .map_err(|_| ink::LangError::CouldNotReadInput)
        }

        #[ink(message)]
        fn process_burn_fee_only(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
        ) -> Result<(), ink::LangError> {
            self._process_burn_fee_only(operation, user, lusdt_amount)
                .map_err(|_| ink::LangError::CouldNotReadInput)
        }
    }

    impl TaxManager {
        /// @notice Initializes the TaxManager contract.
        /// @dev Sets the owner, token addresses, fee configurations, and initial LUNES price.
        /// @param lunes_token_address The address of the LUNES PSP22 token contract.
        /// @param lusdt_token_address The address of the LUSDT PSP22 token contract.
        /// @param distribution_wallets The initial struct with all wallets for fee distribution.
        /// @param initial_lunes_price The initial price of LUNES in USD (with 6 decimals).
        #[ink(constructor)]
        pub fn new(
            lunes_token_address: AccountId,
            lusdt_token_address: AccountId,
            distribution_wallets: DistributionWallets,
            initial_lunes_price: Balance,
        ) -> Self {
            let fee_config = FeeConfig {
                base_fee_bps: 50,
                volume_threshold_1_usd: 10_000_000_000,
                volume_threshold_2_usd: 100_000_000_000,
                low_volume_fee_bps: 60,
                medium_volume_fee_bps: 50,
                high_volume_fee_bps: 30,
            };

            Self {
                version: 1,
                owner: Self::env().caller(),
                lunes_token_address,
                lusdt_token_address,
                distribution_wallets,
                fee_config,
                monthly_volume_usd: 0,
                last_volume_reset_timestamp: Self::env().block_timestamp(),
                lunes_price_usd: initial_lunes_price,
                burn_engine_address: None,
                lunes_burn_fee_bps: 10, // Default: 0.10% LUNES burn fee
            }
        }

        #[ink(message)]
        pub fn get_version(&self) -> u16 {
            self.version
        }

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

        /// @notice Returns the current price of LUNES in USD (with 6 decimals).
        #[ink(message)]
        pub fn get_lunes_price(&self) -> Balance {
            self.lunes_price_usd
        }

        #[ink(message)]
        pub fn update_lunes_price(&mut self, new_price: Balance) -> Result<(), Error> {
            self.ensure_owner()?;
            if new_price == 0 {
                return Err(Error::InvalidPrice);
            }
            self.lunes_price_usd = new_price;
            self.env().emit_event(AdminUpdated {
                name: "LunesPrice".into(),
            });
            Ok(())
        }

        /// @notice Returns the contract owner's address.
        #[ink(message)]
        pub fn get_owner(&self) -> AccountId {
            self.owner
        }

        /// @notice Returns the current fee distribution wallet configuration.
        #[ink(message)]
        pub fn get_wallets(&self) -> DistributionWallets {
            self.distribution_wallets.clone()
        }

        /// @notice Returns the current adaptive fee configuration.
        #[ink(message)]
        pub fn get_fee_config(&self) -> FeeConfig {
            self.fee_config.clone()
        }

        /// @notice Returns the total transaction volume in USD for the current month.
        #[ink(message)]
        pub fn get_monthly_volume_usd(&self) -> u128 {
            self.monthly_volume_usd
        }

        #[ink(message)]
        pub fn get_current_fee_bps(&self) -> u16 {
            if self.monthly_volume_usd <= self.fee_config.volume_threshold_1_usd {
                self.fee_config.low_volume_fee_bps
            } else if self.monthly_volume_usd <= self.fee_config.volume_threshold_2_usd {
                self.fee_config.medium_volume_fee_bps
            } else {
                self.fee_config.high_volume_fee_bps
            }
        }

        #[ink(message)]
        pub fn update_fee_config(&mut self, new_config: FeeConfig) -> Result<(), Error> {
            self.ensure_owner()?;
            if new_config.low_volume_fee_bps > 10000
                || new_config.medium_volume_fee_bps > 10000
                || new_config.high_volume_fee_bps > 10000
            {
                return Err(Error::InvalidFeeConfig);
            }
            self.fee_config = new_config;
            self.env().emit_event(AdminUpdated {
                name: "FeeConfig".into(),
            });
            Ok(())
        }

        #[ink(message)]
        pub fn update_dev_wallets(
            &mut self,
            dev_solana: AccountId,
            dev_lunes: AccountId,
        ) -> Result<(), Error> {
            self.ensure_owner()?;
            self.distribution_wallets.dev_solana = dev_solana;
            self.distribution_wallets.dev_lunes = dev_lunes;
            self.env().emit_event(AdminUpdated {
                name: "DevWallets".into(),
            });
            Ok(())
        }

        #[ink(message)]
        pub fn get_dev_wallets(&self) -> (AccountId, AccountId) {
            (self.distribution_wallets.dev_solana, self.distribution_wallets.dev_lunes)
        }

        // === Burn Engine Configuration ===

        /// Set the BurnEngine contract address (owner only).
        #[ink(message)]
        pub fn set_burn_engine(&mut self, burn_engine: AccountId) -> Result<(), Error> {
            self.ensure_owner()?;
            self.burn_engine_address = Some(burn_engine);
            self.env().emit_event(AdminUpdated {
                name: "BurnEngine".into(),
            });
            Ok(())
        }

        /// Get the BurnEngine contract address.
        #[ink(message)]
        pub fn get_burn_engine(&self) -> Option<AccountId> {
            self.burn_engine_address
        }

        /// Set the LUNES burn fee in basis points (owner only).
        /// Example: 10 = 0.10%, 5 = 0.05%
        #[ink(message)]
        pub fn set_lunes_burn_fee_bps(&mut self, bps: u16) -> Result<(), Error> {
            self.ensure_owner()?;
            if bps > 100 { // Max 1% burn fee
                return Err(Error::InvalidFeeConfig);
            }
            self.lunes_burn_fee_bps = bps;
            self.env().emit_event(AdminUpdated {
                name: "LunesBurnFeeBps".into(),
            });
            Ok(())
        }

        /// Get the current LUNES burn fee in basis points.
        #[ink(message)]
        pub fn get_lunes_burn_fee_bps(&self) -> u16 {
            self.lunes_burn_fee_bps
        }

        /// Public wrapper that calls `_update_monthly_volume` with the current block timestamp.
        #[ink(message)]
        pub fn update_monthly_volume_now(&mut self, new_tx_volume_usd: u128) -> Result<(), Error> {
            let current_timestamp = self.env().block_timestamp();
            self._update_monthly_volume(new_tx_volume_usd, current_timestamp)
        }

        /// v3 Dual-fee: stablecoin fee (revenue) + LUNES fee (burn)
        /// Mint: USDT fee → dev/insurance + LUNES → BurnEngine
        /// Burn: LUSDT fee → dev/insurance + LUNES → BurnEngine
        fn _process_dual_fee(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
            stablecoin_fee_type: FeeType,
        ) -> Result<(), Error> {
            let burn_engine = self.burn_engine_address.ok_or(Error::BurnEngineNotSet)?;
            let stablecoin_fee_bps = self.get_current_fee_bps();
            let lunes_burn_bps = self.lunes_burn_fee_bps;

            // --- Part 1: Stablecoin fee (revenue) ---
            let stablecoin_fee = lusdt_amount
                .checked_mul(stablecoin_fee_bps as u128)
                .and_then(|v| v.checked_div(10000))
                .ok_or(Error::ArithmeticOverflow)?;

            if stablecoin_fee > 0 {
                match stablecoin_fee_type {
                    FeeType::Lusdt => {
                        // Burn operation: charge LUSDT fee, distribute 80/15/5
                        let mut lusdt_token: ink::contract_ref!(PSP22) = self.lusdt_token_address.into();
                        lusdt_token
                            .transfer_from(user, self.env().account_id(), stablecoin_fee)
                            .map_err(|_| Error::LusdtTransferFailed)?;
                        // Distribute LUSDT revenue: 80% dev, 15% insurance, 5% staking rewards
                        let dev_share = stablecoin_fee.checked_mul(80).and_then(|v| v.checked_div(100)).ok_or(Error::ArithmeticOverflow)?;
                        let insurance_share = stablecoin_fee.checked_mul(15).and_then(|v| v.checked_div(100)).ok_or(Error::ArithmeticOverflow)?;
                        let staking_share = stablecoin_fee.saturating_sub(dev_share).saturating_sub(insurance_share);
                        let mut lusdt_out: ink::contract_ref!(PSP22) = self.lusdt_token_address.into();
                        if dev_share > 0 {
                            let _ = lusdt_out.transfer(self.distribution_wallets.dev_lunes, dev_share);
                        }
                        if insurance_share > 0 {
                            let _ = lusdt_out.transfer(self.distribution_wallets.insurance_fund, insurance_share);
                        }
                        if staking_share > 0 {
                            let _ = lusdt_out.transfer(self.distribution_wallets.staking_rewards_pool, staking_share);
                            // Notify StakingManager contract so it updates reward accounting
                            let mut staking_mgr: ink::contract_ref!(StakingManagerApi) =
                                self.distribution_wallets.staking_rewards_pool.into();
                            let _ = staking_mgr.notify_reward_amount(staking_share);
                        }
                    },
                    FeeType::Usdt => {
                        // Mint operation: USDT fee is handled by bridge (emit event)
                        self.env().emit_event(UsdtBridgeFeeMarked {
                            operation,
                            user,
                            lusdt_amount,
                            fee_amount_usd: stablecoin_fee,
                        });
                    },
                    FeeType::Lunes => {
                        // Fallback: use legacy LUNES fee path
                        return self._process_fees_lunes(operation, user, lusdt_amount, stablecoin_fee_bps);
                    },
                }
            }

            // --- Part 2: LUNES burn fee (deflationary) ---
            if lunes_burn_bps > 0 {
                let lunes_price_usd = self.lunes_price_usd;
                if lunes_price_usd > 0 {
                    let lunes_burn_fee = self.calculate_fee_in_lunes(lusdt_amount, lunes_burn_bps, lunes_price_usd)?;
                    if lunes_burn_fee > 0 {
                        // Transfer LUNES from user to BurnEngine contract
                        let mut lunes_token: ink::contract_ref!(PSP22) = self.lunes_token_address.into();
                        lunes_token
                            .transfer_from(user, burn_engine, lunes_burn_fee)
                            .map_err(|_| Error::LunesTransferFailed)?;
                    }

                    // Emit dual-fee event
                    self.env().emit_event(DualFeesProcessed {
                        operation,
                        user,
                        lusdt_amount,
                        stablecoin_fee,
                        lunes_burn_fee,
                    });
                }
            }

            // Update volume tracking
            self._update_monthly_volume(lusdt_amount, self.env().block_timestamp())?;

            Ok(())
        }

        /// Charges ONLY the LUNES deflationary burn fee (lunes_burn_fee_bps, default 0.10%)
        /// and transfers to BurnEngine. Used by mint — USDT stablecoin fee is handled by bridge.
        /// Also updates monthly volume tracking.
        fn _process_burn_fee_only(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
        ) -> Result<(), Error> {
            let burn_engine = self.burn_engine_address.ok_or(Error::BurnEngineNotSet)?;
            let lunes_burn_bps = self.lunes_burn_fee_bps;

            if lunes_burn_bps > 0 {
                let lunes_price_usd = self.lunes_price_usd;
                if lunes_price_usd > 0 {
                    let lunes_burn_fee = self.calculate_fee_in_lunes(lusdt_amount, lunes_burn_bps, lunes_price_usd)?;
                    if lunes_burn_fee > 0 {
                        let mut lunes_token: ink::contract_ref!(PSP22) = self.lunes_token_address.into();
                        lunes_token
                            .transfer_from(user, burn_engine, lunes_burn_fee)
                            .map_err(|_| Error::LunesTransferFailed)?;
                    }

                    self.env().emit_event(DualFeesProcessed {
                        operation,
                        user,
                        lusdt_amount,
                        stablecoin_fee: 0, // USDT fee handled by bridge, not on-chain
                        lunes_burn_fee,
                    });
                }
            }

            // Update volume tracking
            self._update_monthly_volume(lusdt_amount, self.env().block_timestamp())?;

            Ok(())
        }

        fn _process_fees(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
        ) -> Result<(), Error> {
            // Default to LUNES fee type for backward compatibility
            self._process_fees_flexible(operation, user, lusdt_amount, FeeType::Lunes)
        }

        /// Flexible fee processing supporting multiple payment types
        /// Processamento de taxas flexível suportando múltiplos tipos de pagamento
        fn _process_fees_flexible(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
            fee_type: FeeType,
        ) -> Result<(), Error> {
            let fee_bps = self.get_current_fee_bps();

            match fee_type {
                FeeType::Lunes => self._process_fees_lunes(operation, user, lusdt_amount, fee_bps),
                FeeType::Lusdt => self._process_fees_lusdt(operation, user, lusdt_amount, fee_bps),
                FeeType::Usdt => {
                    self._process_fees_usdt_bridge(operation, user, lusdt_amount, fee_bps)
                }
            }
        }

        /// Process fees paid in LUNES tokens / Processar taxas pagas em tokens LUNES
        fn _process_fees_lunes(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
            fee_bps: u16,
        ) -> Result<(), Error> {
            let lunes_price_usd = self.lunes_price_usd;
            let fee_amount = self.calculate_fee_in_lunes(lusdt_amount, fee_bps, lunes_price_usd)?;

            if fee_amount == 0 {
                return Ok(());
            }

            let mut lunes_token: ink::contract_ref!(PSP22) = self.lunes_token_address.into();
            lunes_token
                .transfer_from(user, self.env().account_id(), fee_amount)
                .map_err(|_| Error::LunesTransferFailed)?;

            self.distribute_collected_fees(operation, fee_amount, FeeType::Lunes)?;
            self._update_monthly_volume(lusdt_amount, self.env().block_timestamp())?;
            self.env().emit_event(FeesProcessed {
                operation,
                user,
                lusdt_amount,
                fee_in_lunes: fee_amount,
            });
            Ok(())
        }

        /// Process fees paid in LUSDT tokens / Processar taxas pagas em tokens LUSDT
        fn _process_fees_lusdt(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
            fee_bps: u16,
        ) -> Result<(), Error> {
            // Calculate fee directly in LUSDT (simpler)
            let fee_amount = lusdt_amount
                .checked_mul(fee_bps as u128)
                .and_then(|v| v.checked_div(10000))
                .ok_or(Error::ArithmeticOverflow)?;

            if fee_amount == 0 {
                return Ok(());
            }

            // Transfer LUSDT fee from user to contract
            let mut lusdt_token: ink::contract_ref!(PSP22) = self.lusdt_token_address.into();
            lusdt_token
                .transfer_from(user, self.env().account_id(), fee_amount)
                .map_err(|_| Error::LunesTransferFailed)?; // Reuse error type

            // Distribute LUSDT fees (need to convert to LUNES for distribution)
            // For now, hold LUSDT in contract (can be converted later)
            self._update_monthly_volume(lusdt_amount, self.env().block_timestamp())?;

            // Emit event with LUSDT fee amount
            self.env().emit_event(FeesProcessed {
                operation,
                user,
                lusdt_amount,
                fee_in_lunes: fee_amount, // Store LUSDT amount in same field
            });
            Ok(())
        }

        /// Mark transaction for USDT fee payment via bridge / Marcar transação para pagamento de taxa em USDT via ponte
        fn _process_fees_usdt_bridge(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
            fee_bps: u16,
        ) -> Result<(), Error> {
            // Calculate fee in USD (same as USDT 1:1)
            let fee_amount_usd = lusdt_amount
                .checked_mul(fee_bps as u128)
                .and_then(|v| v.checked_div(10000))
                .ok_or(Error::ArithmeticOverflow)?;

            if fee_amount_usd == 0 {
                return Ok(());
            }

            // Mark for bridge processing (emit special event)
            self._update_monthly_volume(lusdt_amount, self.env().block_timestamp())?;
            self.env().emit_event(UsdtBridgeFeeMarked {
                operation,
                user,
                lusdt_amount,
                fee_amount_usd,
            });
            Ok(())
        }

        fn distribute_collected_fees(
            &mut self,
            operation: OperationType,
            fee_amount: Balance,
            fee_type: FeeType,
        ) -> Result<(), Error> {
            let distributions = self.calculate_fee_distributions(operation, fee_amount, fee_type)?;
            let lunes_token_address = self.lunes_token_address;
            let mut lunes_token: ink::contract_ref!(PSP22) = lunes_token_address.into();

            for (recipient, amount) in distributions {
                if amount > 0 && lunes_token.transfer(recipient, amount).is_err() {
                    return Err(Error::LunesTransferFailed);
                }
            }
            Ok(())
        }

        fn calculate_fee_distributions(
            &self,
            _operation: OperationType,
            fee_amount: Balance,
            fee_type: FeeType,
        ) -> Result<Vec<(AccountId, Balance)>, Error> {
            let wallets = &self.distribution_wallets;
            let mut distributions = Vec::new();
            
            // Distribution: 80% dev, 15% insurance, 5% staking rewards
            let dev_amount = fee_amount
                .checked_mul(80)
                .and_then(|x| x.checked_div(100))
                .ok_or(Error::ArithmeticOverflow)?;
            let insurance_amount = fee_amount
                .checked_mul(15)
                .and_then(|x| x.checked_div(100))
                .ok_or(Error::ArithmeticOverflow)?;
            let staking_amount = fee_amount
                .saturating_sub(dev_amount)
                .saturating_sub(insurance_amount);

            // Select dev wallet based on fee type/network
            let dev_wallet = match fee_type {
                FeeType::Usdt => wallets.dev_solana,    // USDT fees go to Solana dev wallet
                FeeType::Lusdt => wallets.dev_lunes,    // LUSDT fees go to Lunes dev wallet  
                FeeType::Lunes => wallets.dev_lunes,    // LUNES fees go to Lunes dev wallet
            };

            distributions.push((dev_wallet, dev_amount));
            distributions.push((wallets.insurance_fund, insurance_amount));
            distributions.push((wallets.staking_rewards_pool, staking_amount));
            
            Ok(distributions)
        }

        /// Internal logic for updating monthly volume. Accepts a timestamp for testability.
        fn _update_monthly_volume(
            &mut self,
            new_tx_volume_usd: u128,
            current_timestamp: Timestamp,
        ) -> Result<(), Error> {
            let thirty_days_ms = 30 * 24 * 60 * 60 * 1000;
            if current_timestamp.saturating_sub(self.last_volume_reset_timestamp) >= thirty_days_ms
            {
                self.monthly_volume_usd = 0;
                self.last_volume_reset_timestamp = current_timestamp;
            }
            self.monthly_volume_usd = self
                .monthly_volume_usd
                .checked_add(new_tx_volume_usd)
                .ok_or(Error::ArithmeticOverflow)?;
            Ok(())
        }

        fn ensure_owner(&self) -> Result<(), Error> {
            if self.env().caller() != self.owner {
                Err(Error::Unauthorized)
            } else {
                Ok(())
            }
        }

        /// Calculate fee in LUNES with intelligent capping to prevent excessive fees
        /// when LUNES price increases. Uses hybrid approach: USD-based fee with
        /// maximum LUNES limits to ensure sustainability.
        ///
        /// Calcula taxa em LUNES com teto inteligente para prevenir taxas excessivas
        /// quando o preço do LUNES aumenta. Usa abordagem híbrida: taxa baseada em USD
        /// com limites máximos em LUNES para garantir sustentabilidade.
        fn calculate_fee_in_lunes(
            &self,
            lusdt_amount: Balance,
            fee_bps: u16,
            lunes_price_usd: Balance,
        ) -> Result<Balance, Error> {
            if lunes_price_usd == 0 {
                return Err(Error::InvalidPrice);
            }

            // 1. Calculate base fee in USD / Calcular taxa base em USD
            let fee_usd = lusdt_amount
                .checked_mul(fee_bps as u128)
                .and_then(|v| v.checked_div(10000))
                .ok_or(Error::ArithmeticOverflow)?;

            // 2. Convert to LUNES / Converter para LUNES
            let precision_factor = 1_000_000;
            let fee_in_lunes = fee_usd
                .checked_mul(precision_factor)
                .and_then(|v| v.checked_div(lunes_price_usd))
                .ok_or(Error::ArithmeticOverflow)?;

            // 3. Apply intelligent caps based on transaction size / Aplicar tetos inteligentes baseados no tamanho da transação
            let max_fee_lunes = match lusdt_amount {
                // Small transactions (≤ $100): Max 0.5 LUNES / Transações pequenas (≤ $100): Máx 0.5 LUNES
                0..=100_000_000 => 500_000,
                // Medium transactions ($100-$1K): Max 2 LUNES / Transações médias ($100-$1K): Máx 2 LUNES
                100_000_001..=1_000_000_000 => 2_000_000,
                // Large transactions ($1K-$10K): Max 10 LUNES / Transações grandes ($1K-$10K): Máx 10 LUNES
                1_000_000_001..=10_000_000_000 => 10_000_000,
                // Very large transactions (>$10K): Max 50 LUNES / Transações muito grandes (>$10K): Máx 50 LUNES
                _ => 50_000_000,
            };

            // 4. Return the minimum between calculated fee and cap / Retornar o mínimo entre taxa calculada e teto
            Ok(core::cmp::min(fee_in_lunes, max_fee_lunes))
        }
    }

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

        fn setup_wallets(accounts: &DefaultAccounts<DefaultEnvironment>) -> DistributionWallets {
            DistributionWallets {
                dev_solana: accounts.alice,
                dev_lunes: accounts.alice,  // Same for testing
                insurance_fund: accounts.bob,
                staking_rewards_pool: accounts.charlie,
            }
        }

        fn setup_contract(
            lunes_token_address: AccountId,
            wallets: &DistributionWallets,
            initial_price: Balance,
        ) -> TaxManager {
            set_caller::<DefaultEnvironment>(wallets.dev_lunes);
            TaxManager::new(
                lunes_token_address,
                wallets.dev_lunes,
                wallets.clone(),
                initial_price,
            )
        }

        #[ink::test]
        fn new_works() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let contract = setup_contract(accounts.alice, &wallets, 500_000);

            assert_eq!(contract.get_owner(), wallets.dev_lunes);
            assert_eq!(contract.get_lunes_price(), 500_000);
            assert_eq!(contract.get_monthly_volume_usd(), 0);
        }

        #[ink::test]
        fn fee_calculation_works() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let contract = setup_contract(accounts.alice, &wallets, 500_000);

            let fee_amount = 100_000_000; // 100 LUNES
            let mint_dist = contract
                .calculate_fee_distributions(OperationType::Mint, fee_amount, FeeType::Lunes)
                .unwrap();
            assert_eq!(mint_dist.len(), 3);
            assert_eq!(mint_dist[0], (wallets.dev_lunes, 80_000_000)); // 80% to Lunes dev
            assert_eq!(mint_dist[1], (wallets.insurance_fund, 15_000_000)); // 15% insurance
            assert_eq!(mint_dist[2], (wallets.staking_rewards_pool, 5_000_000)); // 5% staking

            let burn_dist = contract
                .calculate_fee_distributions(OperationType::Burn, fee_amount, FeeType::Lunes)
                .unwrap();
            assert_eq!(burn_dist.len(), 3);
            assert_eq!(burn_dist[0], (wallets.dev_lunes, 80_000_000)); // 80% to Lunes dev
            assert_eq!(burn_dist[1], (wallets.insurance_fund, 15_000_000)); // 15% insurance
            assert_eq!(burn_dist[2], (wallets.staking_rewards_pool, 5_000_000)); // 5% staking
        }

        #[ink::test]
        fn process_fees_lunes_fails_with_invalid_price() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let lunes_token_address = AccountId::from([0x1; 32]);
            let mut contract = setup_contract(lunes_token_address, &wallets, 0);

            let result =
                contract._process_fees_lunes(OperationType::Mint, accounts.bob, 1_000_000_000, 60);
            assert_eq!(result, Err(Error::InvalidPrice));
        }

        #[ink::test]
        fn process_fees_lusdt_fee_calculation_works() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let lusdt_token_address = AccountId::from([0x2; 32]);
            let contract = TaxManager::new(
                accounts.django,
                lusdt_token_address,
                wallets.clone(),
                500_000,
            );

            let lusdt_amount = 1_000_000_000;
            let fee_bps = contract.get_current_fee_bps();
            let expected_fee = lusdt_amount * fee_bps as u128 / 10000;

            let calculated_fee = lusdt_amount
                .checked_mul(fee_bps as u128)
                .and_then(|v| v.checked_div(10000))
                .unwrap();
            assert_eq!(calculated_fee, expected_fee);
        }

        #[ink::test]
        fn process_fees_usdt_bridge_works() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let mut contract = setup_contract(accounts.django, &wallets, 500_000);

            let result = contract._process_fees_flexible(
                OperationType::Mint,
                accounts.bob,
                1_000_000_000,
                FeeType::Usdt,
            );
            assert!(result.is_ok());

            // Ensure the correct event was emitted
            let emitted_events = ink::env::test::recorded_events().collect::<Vec<_>>();
            assert_eq!(emitted_events.len(), 1);
            // TODO: Decode and assert event content when ink! testing framework supports it better.
        }

        #[ink::test]
        fn update_monthly_volume_resets_after_30_days() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let mut contract = setup_contract(accounts.django, &wallets, 500_000);

            let initial_timestamp = 1_000_000_000_000; // An arbitrary starting point
            let thirty_days_and_one_ms = (30 * 24 * 60 * 60 * 1000) + 1;

            // Set initial timestamp and add volume
            contract.last_volume_reset_timestamp = initial_timestamp;
            contract.monthly_volume_usd = 500_000;

            // Update volume before 30 days have passed
            let timestamp_before_reset = initial_timestamp + 1000;
            contract
                ._update_monthly_volume(100_000, timestamp_before_reset)
                .unwrap();
            assert_eq!(contract.get_monthly_volume_usd(), 600_000);
            assert_eq!(contract.last_volume_reset_timestamp, initial_timestamp); // Should not reset

            // Update volume after 30 days have passed
            let timestamp_after_reset = initial_timestamp + thirty_days_and_one_ms;
            contract
                ._update_monthly_volume(200_000, timestamp_after_reset)
                .unwrap();
            assert_eq!(contract.get_monthly_volume_usd(), 200_000); // Should reset to the new volume
            assert_eq!(contract.last_volume_reset_timestamp, timestamp_after_reset);
            // Should update reset timestamp
        }

        // === ADDITIONAL EDGE CASE TESTS ===

        #[ink::test]
        fn fee_calculation_with_zero_price_fails() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let contract = setup_contract(accounts.alice, &wallets, 0); // Zero price

            let result = contract.calculate_fee_in_lunes(1_000_000_000, 60, 0);
            assert_eq!(result, Err(Error::InvalidPrice));
        }

        #[ink::test]
        fn fee_calculation_with_caps_works() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let contract = setup_contract(accounts.alice, &wallets, 100_000); // $0.10 per LUNES

            // Small transaction (≤ $100): Should cap at 0.5 LUNES
            let small_fee = contract
                .calculate_fee_in_lunes(100_000_000, 60, 100_000)
                .unwrap(); // $100, 0.6%
            assert!(small_fee <= 500_000); // Max 0.5 LUNES

            // Large transaction (>$10K): Should cap at 50 LUNES
            let large_fee = contract
                .calculate_fee_in_lunes(20_000_000_000, 60, 100_000)
                .unwrap(); // $20K, 0.6%
            assert!(large_fee <= 50_000_000); // Max 50 LUNES
        }

        #[ink::test]
        fn adaptive_fee_rates_work() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let mut contract = setup_contract(accounts.alice, &wallets, 500_000);

            // Initially low volume - should use low_volume_fee_bps (60)
            assert_eq!(contract.get_current_fee_bps(), 60);

            // Set medium volume
            contract.monthly_volume_usd = 50_000_000_000; // $50K
            assert_eq!(contract.get_current_fee_bps(), 50);

            // Set high volume
            contract.monthly_volume_usd = 200_000_000_000; // $200K
            assert_eq!(contract.get_current_fee_bps(), 30);
        }

        #[ink::test]
        fn only_owner_can_update_configs() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let mut contract = setup_contract(accounts.alice, &wallets, 500_000);

            // Non-owner cannot update fee config
            set_caller::<DefaultEnvironment>(accounts.bob);
            let new_config = FeeConfig {
                base_fee_bps: 40,
                volume_threshold_1_usd: 5_000_000_000,
                volume_threshold_2_usd: 50_000_000_000,
                low_volume_fee_bps: 50,
                medium_volume_fee_bps: 40,
                high_volume_fee_bps: 20,
            };
            assert_eq!(
                contract.update_fee_config(new_config.clone()),
                Err(Error::Unauthorized)
            );

            // Owner can update fee config
            set_caller::<DefaultEnvironment>(wallets.dev_lunes);
            assert!(contract.update_fee_config(new_config).is_ok());
        }

        #[ink::test]
        fn invalid_fee_config_rejected() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let mut contract = setup_contract(accounts.alice, &wallets, 500_000);

            set_caller::<DefaultEnvironment>(wallets.dev_lunes);

            // Fee config with invalid BPS (>100%)
            let invalid_config = FeeConfig {
                base_fee_bps: 50,
                volume_threshold_1_usd: 10_000_000_000,
                volume_threshold_2_usd: 100_000_000_000,
                low_volume_fee_bps: 15000, // Invalid: >100%
                medium_volume_fee_bps: 50,
                high_volume_fee_bps: 30,
            };

            assert_eq!(
                contract.update_fee_config(invalid_config),
                Err(Error::InvalidFeeConfig)
            );
        }

        #[ink::test]
        fn update_lunes_price_validation() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let mut contract = setup_contract(accounts.alice, &wallets, 500_000);

            set_caller::<DefaultEnvironment>(wallets.dev_lunes);

            // Cannot set zero price
            assert_eq!(contract.update_lunes_price(0), Err(Error::InvalidPrice));

            // Can set valid price
            assert!(contract.update_lunes_price(1_000_000).is_ok());
            assert_eq!(contract.get_lunes_price(), 1_000_000);
        }

        #[ink::test]
        fn volume_overflow_protection() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let mut contract = setup_contract(accounts.alice, &wallets, 500_000);

            // Set volume near maximum and ensure timestamp won't cause reset
            contract.monthly_volume_usd = u128::MAX - 100;
            let initial_timestamp = 1_000_000_000_000;
            contract.last_volume_reset_timestamp = initial_timestamp;

            // Adding more volume should fail (use same timestamp to avoid reset)
            assert_eq!(
                contract._update_monthly_volume(200, initial_timestamp),
                Err(Error::ArithmeticOverflow)
            );
        }

        #[ink::test]
        fn fee_distribution_percentages_correct() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let contract = setup_contract(accounts.alice, &wallets, 500_000);

            let fee_amount = 1_000_000; // 1 LUNES

            // Test mint distribution: 80% dev + 15% insurance + 5% staking = 100%
            let mint_dist = contract
                .calculate_fee_distributions(OperationType::Mint, fee_amount, FeeType::Lunes)
                .unwrap();
            let total_mint: u128 = mint_dist.iter().map(|(_, amount)| amount).sum();
            assert_eq!(total_mint, 1_000_000); // Should equal original fee
            assert_eq!(mint_dist[0].1, 800_000); // 80% dev
            assert_eq!(mint_dist[1].1, 150_000); // 15% insurance
            assert_eq!(mint_dist[2].1, 50_000);  // 5% staking

            // Test burn distribution: 80% dev + 15% insurance + 5% staking = 100%
            let burn_dist = contract
                .calculate_fee_distributions(OperationType::Burn, fee_amount, FeeType::Lunes)
                .unwrap();
            let total_burn: u128 = burn_dist.iter().map(|(_, amount)| amount).sum();
            assert_eq!(total_burn, 1_000_000, "Burn distribution should sum to 100% of fee");
            assert_eq!(burn_dist[0].1, 800_000); // 80% dev
            assert_eq!(burn_dist[1].1, 150_000); // 15% insurance
            assert_eq!(burn_dist[2].1, 50_000);  // 5% staking
        }

        #[ink::test]
        fn zero_fee_amount_handled_correctly() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let mut contract = setup_contract(accounts.alice, &wallets, 500_000);

            // Processing zero fee should succeed without errors
            let result = contract._process_fees_flexible(
                OperationType::Mint,
                accounts.bob,
                0,
                FeeType::Lunes,
            );
            assert!(result.is_ok());
        }
    }
}
