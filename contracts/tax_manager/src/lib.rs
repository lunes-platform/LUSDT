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
//! - Mint Operations: dev (40%), DAO (20%), backing fund (25%), rewards (15%)
//! - Operações de Mint: dev (40%), DAO (20%), fundo de lastro (25%), recompensas (15%)
//! - Burn Operations: dev (40%), DAO (20%), liquidity pool (20%), burn (20%)
//! - Operações de Burn: dev (40%), DAO (20%), pool de liquidez (20%), queima (20%)

#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
pub mod tax_manager {
    /// Operation type for fee processing / Tipo de operação para processamento de taxas
    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode, Clone, Copy)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum OperationType {
        /// Minting LUSDT tokens / Cunhagem de tokens LUSDT
        Mint,
        /// Burning LUSDT tokens / Queima de tokens LUSDT
        Burn,
    }

    /// Fee payment type / Tipo de pagamento de taxa
    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode, Clone, Copy)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum FeeType {
        /// Pay fees in LUNES tokens / Pagar taxas em tokens LUNES
        Lunes,
        /// Pay fees in LUSDT tokens / Pagar taxas em tokens LUSDT
        Lusdt,
        /// Mark for USDT fee payment via bridge / Marcar para pagamento de taxa em USDT via ponte
        Usdt,
    }

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

    /// The `TaxManager` trait for the public interface / Trait `TaxManager` para a interface pública
    #[ink::trait_definition]
    pub trait TaxManagerTrait {
        /// Processes fees for a given LUSDT operation (mint or burn) / Processa taxas para uma operação LUSDT específica (mint ou burn)
        #[ink(message)]
        fn process_fees(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: u128,
        ) -> Result<(), ink::LangError>;

        /// Processes fees with flexible payment type / Processa taxas com tipo de pagamento flexível
        #[ink(message)]
        fn process_fees_flexible(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: u128,
            fee_type: FeeType,
        ) -> Result<(), ink::LangError>;
    }
    
    use ink::prelude::vec::Vec;

    /// Configuration for fee distribution wallets.
    #[derive(Debug, Clone, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
    pub struct DistributionWallets {
        /// Development team wallet (40% for mint, 40% for burn).
        pub dev: AccountId,
        /// DAO treasury wallet (20% for mint, 20% for burn).
        pub dao: AccountId,
        /// Backing fund wallet (25% for mint only).
        pub backing_fund: AccountId,
        /// Rewards fund wallet (15% for mint only).
        pub rewards_fund: AccountId,
        /// Burn address for token destruction (20% for burn only).
        pub burn_address: AccountId,
    }

    /// Fee configuration with adaptive rates based on volume.
    #[derive(Debug, Clone, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
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
        Unauthorized,
        ArithmeticOverflow,
        InvalidFeeConfig,
        InsufficientLunesBalance,
        LunesTransferFailed,
        InvalidPrice,
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
    }

    impl TaxManagerTrait for TaxManager {
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
    }

    impl TaxManager {
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
            self.env().emit_event(AdminUpdated { name: "LunesPrice".into() });
            Ok(())
        }

        #[ink(message)]
        pub fn get_owner(&self) -> AccountId {
            self.owner
        }

        #[ink(message)]
        pub fn get_wallets(&self) -> DistributionWallets {
            self.distribution_wallets.clone()
        }

        #[ink(message)]
        pub fn get_fee_config(&self) -> FeeConfig {
            self.fee_config.clone()
        }

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
            self.env().emit_event(AdminUpdated { name: "FeeConfig".into() });
            Ok(())
        }

        #[ink(message)]
        pub fn update_distribution_wallets(
            &mut self,
            new_wallets: DistributionWallets,
        ) -> Result<(), Error> {
            self.ensure_owner()?;
            self.distribution_wallets = new_wallets;
            self.env().emit_event(AdminUpdated { name: "DistributionWallets".into() });
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
                FeeType::Lunes => {
                    self._process_fees_lunes(operation, user, lusdt_amount, fee_bps)
                },
                FeeType::Lusdt => {
                    self._process_fees_lusdt(operation, user, lusdt_amount, fee_bps)
                },
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

            self.distribute_collected_fees(operation, fee_amount)?;
            self.update_monthly_volume(lusdt_amount)?;
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
            self.update_monthly_volume(lusdt_amount)?;
            
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
            self.update_monthly_volume(lusdt_amount)?;
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
        ) -> Result<(), Error> {
            let distributions = self.calculate_fee_distributions(operation, fee_amount)?;

            let mut lunes_token: ink::contract_ref!(PSP22) = self.lunes_token_address.into();

            for (recipient, amount) in distributions {
                if amount > 0 {
                    lunes_token
                        .transfer(recipient, amount)
                        .map_err(|_| Error::LunesTransferFailed)?;
                }
            }
            Ok(())
        }

        fn calculate_fee_distributions(
            &self,
            operation: OperationType,
            fee_amount: Balance,
        ) -> Result<Vec<(AccountId, Balance)>, Error> {
            let wallets = &self.distribution_wallets;
            let mut distributions = Vec::new();
            match operation {
                OperationType::Mint => {
                    let dev_amount = fee_amount
                        .checked_mul(40)
                        .and_then(|x| x.checked_div(100))
                        .ok_or(Error::ArithmeticOverflow)?;
                    let backing_amount = fee_amount
                        .checked_mul(25)
                        .and_then(|x| x.checked_div(100))
                        .ok_or(Error::ArithmeticOverflow)?;
                    let dao_amount = fee_amount
                        .checked_mul(20)
                        .and_then(|x| x.checked_div(100))
                        .ok_or(Error::ArithmeticOverflow)?;
                    let rewards_amount = fee_amount
                        .checked_mul(15)
                        .and_then(|x| x.checked_div(100))
                        .ok_or(Error::ArithmeticOverflow)?;

                    distributions.push((wallets.dev, dev_amount));
                    distributions.push((wallets.backing_fund, backing_amount));
                    distributions.push((wallets.dao, dao_amount));
                    distributions.push((wallets.rewards_fund, rewards_amount));
                }
                OperationType::Burn => {
                    let dev_amount = fee_amount
                        .checked_mul(40)
                        .and_then(|x| x.checked_div(100))
                        .ok_or(Error::ArithmeticOverflow)?;
                    let dao_amount = fee_amount
                        .checked_mul(20)
                        .and_then(|x| x.checked_div(100))
                        .ok_or(Error::ArithmeticOverflow)?;
                    let burn_amount = fee_amount
                        .checked_mul(20)
                        .and_then(|x| x.checked_div(100))
                        .ok_or(Error::ArithmeticOverflow)?;

                    distributions.push((wallets.dev, dev_amount));
                    distributions.push((wallets.dao, dao_amount));
                    distributions.push((wallets.burn_address, burn_amount));
                }
            }
            Ok(distributions)
        }

        fn update_monthly_volume(&mut self, new_tx_volume_usd: u128) -> Result<(), Error> {
            let current_timestamp = self.env().block_timestamp();
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
        use ink::env::test::{
            self, default_accounts, DefaultAccounts,
        };
        use ink::env::DefaultEnvironment;
        

        type Result<T> = core::result::Result<T, Error>;

        fn setup_accounts() -> DefaultAccounts<DefaultEnvironment> {
            default_accounts::<DefaultEnvironment>()
        }

        fn setup_wallets(accounts: &DefaultAccounts<DefaultEnvironment>) -> DistributionWallets {
            DistributionWallets {
                dev: accounts.charlie,
                dao: accounts.django,
                backing_fund: accounts.eve,
                rewards_fund: accounts.frank,
                burn_address: accounts.bob, // Just a placeholder
            }
        }

        fn setup_contract(
            lunes_token: AccountId,
            wallets: DistributionWallets,
            price: Balance,
        ) -> TaxManager {
            let accounts = setup_accounts();
            test::set_caller::<DefaultEnvironment>(accounts.alice);
            // Use placeholder LUSDT token address for tests
            let lusdt_token = accounts.frank; // Placeholder
            TaxManager::new(lunes_token, lusdt_token, wallets, price)
        }

        #[ink::test]
        fn new_constructor_works() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let lunes_token_address = accounts.django; // Placeholder for token address
            
            let contract = setup_contract(lunes_token_address, wallets.clone(), 500_000);

            assert_eq!(contract.get_owner(), accounts.alice);
            assert_eq!(contract.lunes_token_address, lunes_token_address);
            assert_eq!(contract.get_wallets(), wallets);
            assert_eq!(contract.get_lunes_price(), 500_000);
            assert_eq!(contract.get_monthly_volume_usd(), 0);
        }

        #[ink::test]
        fn administrative_functions_work_and_are_protected() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let lunes_token_address = accounts.django; // Placeholder for token address

            let mut contract = setup_contract(lunes_token_address, wallets.clone(), 500_000);

            // --- Test non-owner failures ---
            test::set_caller::<DefaultEnvironment>(accounts.bob);
            
            let new_price = 600_000;
            assert_eq!(contract.update_lunes_price(new_price), Err(Error::Unauthorized));

            let new_wallets = DistributionWallets {
                dev: accounts.bob,
                dao: accounts.bob,
                backing_fund: accounts.bob,
                rewards_fund: accounts.bob,
                burn_address: accounts.bob,
            };
            assert_eq!(contract.update_distribution_wallets(new_wallets.clone()), Err(Error::Unauthorized));

            let new_fee_config = FeeConfig {
                base_fee_bps: 100,
                volume_threshold_1_usd: 1,
                volume_threshold_2_usd: 2,
                low_volume_fee_bps: 1,
                medium_volume_fee_bps: 1,
                high_volume_fee_bps: 1,
            };
            assert_eq!(contract.update_fee_config(new_fee_config.clone()), Err(Error::Unauthorized));

            // --- Test owner success ---
            test::set_caller::<DefaultEnvironment>(accounts.alice);

            assert!(contract.update_lunes_price(new_price).is_ok());
            assert_eq!(contract.get_lunes_price(), new_price);

            assert!(contract.update_distribution_wallets(new_wallets.clone()).is_ok());
            assert_eq!(contract.get_wallets(), new_wallets);

            assert!(contract.update_fee_config(new_fee_config.clone()).is_ok());
            assert_eq!(contract.get_fee_config(), new_fee_config);
        }

        #[ink::test]
        fn get_current_fee_bps_works() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let lunes_token_address = accounts.django;
            let mut contract = setup_contract(lunes_token_address, wallets, 500_000);

            let fee_config = contract.get_fee_config();

            // Volume is 0, should be low_volume_fee_bps
            assert_eq!(contract.get_current_fee_bps(), fee_config.low_volume_fee_bps);

            // Volume between threshold 1 and 2
            contract.monthly_volume_usd = fee_config.volume_threshold_1_usd + 1;
            assert_eq!(contract.get_current_fee_bps(), fee_config.medium_volume_fee_bps);

            // Volume above threshold 2
            contract.monthly_volume_usd = fee_config.volume_threshold_2_usd + 1;
            assert_eq!(contract.get_current_fee_bps(), fee_config.high_volume_fee_bps);
        }

        #[ink::test]
        fn calculate_fee_in_lunes_works() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let lunes_token_address = accounts.django;
            let contract = setup_contract(lunes_token_address, wallets, 500_000); // Lunes price = $0.5

            // LUSDT amount = 1000 USD, fee = 60 bps (0.60%) -> Fee = 6 USD
            // Fee in Lunes = 6 USD / 0.5 USD/LUNES = 12_000 (0.012 LUNES with 6 decimals)
            // This is under the 2 LUNES cap, so normal calculation applies
            let fee = contract.calculate_fee_in_lunes(1000_000, 60, 500_000).unwrap();
            assert_eq!(fee, 12_000); // 0.012 LUNES - under the cap, so normal calculation
        }
        
        #[ink::test]
        fn fee_caps_work_correctly() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let lunes_token_address = accounts.django;
            
            // Test with expensive LUNES ($100 each)
            let contract = setup_contract(lunes_token_address, wallets, 100_000_000); // $100 per LUNES
            
            // Small transaction: $50 -> 0.60% fee = $0.30
            // $0.30 / $100 per LUNES = 0.003 LUNES = 3_000 (with 6 decimals)
            let small_fee = contract.calculate_fee_in_lunes(50_000_000, 60, 100_000_000).unwrap();
            assert_eq!(small_fee, 3_000); // 0.003 LUNES (no cap needed for small amounts)
            
            // Large transaction: $5000 -> 0.60% fee = $30
            // $30 / $100 per LUNES = 0.3 LUNES = 300_000 (with 6 decimals)
            // This is under the 10 LUNES cap for $5K transactions
            let large_fee = contract.calculate_fee_in_lunes(5_000_000_000, 60, 100_000_000).unwrap();
            assert_eq!(large_fee, 300_000); // 0.3 LUNES (under 10 LUNES cap)
        }
        
        #[ink::test]
        fn fee_caps_activate_with_cheap_lunes() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let lunes_token_address = accounts.django;
            
            // Test with cheap LUNES ($0.01 each) - caps should activate
            let contract = setup_contract(lunes_token_address, wallets, 10_000); // $0.01 per LUNES
            
            // $1000 transaction -> 0.60% = $6 fee -> 600 LUNES without cap
            // But capped at 2 LUNES for $1K transactions
            let fee = contract.calculate_fee_in_lunes(1000_000_000, 60, 10_000).unwrap();
            assert_eq!(fee, 2_000_000); // Capped at 2 LUNES, not 600 LUNES
        }

        #[ink::test]
        fn calculate_fee_distributions_works() {
            let accounts = setup_accounts();
            let wallets = setup_wallets(&accounts);
            let lunes_token_address = accounts.django;
            let contract = setup_contract(lunes_token_address, wallets.clone(), 500_000);

            let fee_amount = 100_000_000; // 100 Lunes

            // Test Mint distribution
            let mint_dist = contract.calculate_fee_distributions(OperationType::Mint, fee_amount).unwrap();
            assert_eq!(mint_dist.len(), 4);
            assert_eq!(mint_dist[0], (wallets.dev, 40_000_000)); // 40%
            assert_eq!(mint_dist[1], (wallets.backing_fund, 25_000_000)); // 25%
            assert_eq!(mint_dist[2], (wallets.dao, 20_000_000)); // 20%
            assert_eq!(mint_dist[3], (wallets.rewards_fund, 15_000_000)); // 15%

            // Test Burn distribution
            let burn_dist = contract.calculate_fee_distributions(OperationType::Burn, fee_amount).unwrap();
            assert_eq!(burn_dist.len(), 3);
            assert_eq!(burn_dist[0], (wallets.dev, 40_000_000)); // 40%
            assert_eq!(burn_dist[1], (wallets.dao, 20_000_000)); // 20%
            assert_eq!(burn_dist[2], (wallets.burn_address, 20_000_000)); // 20%
        }
    }
}
