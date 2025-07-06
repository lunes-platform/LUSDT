#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
pub mod tax_manager {
    use common::common_types::{DistributionWallets, FeeConfig, OperationType};
    use common::traits::{PSP22, TaxManager as TaxManagerTrait};
    
    use ink::prelude::vec::Vec;
    
    

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
    }

    impl TaxManager {
        #[ink(constructor)]
        pub fn new(
            lunes_token_address: AccountId,
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
            let fee_bps = self.get_current_fee_bps();
            let lunes_price_usd = self.lunes_price_usd; // Use price from storage
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

        fn calculate_fee_in_lunes(
            &self,
            lusdt_amount: Balance,
            fee_bps: u16,
            lunes_price_usd: Balance,
        ) -> Result<Balance, Error> {
            if lunes_price_usd == 0 {
                return Err(Error::InvalidPrice);
            }
            let fee_usd = lusdt_amount
                .checked_mul(fee_bps as u128)
                .and_then(|v| v.checked_div(10000))
                .ok_or(Error::ArithmeticOverflow)?;
            let precision_factor = 1_000_000;
            let fee_in_lunes = fee_usd
                .checked_mul(precision_factor)
                .and_then(|v| v.checked_div(lunes_price_usd))
                .ok_or(Error::ArithmeticOverflow)?;
            Ok(fee_in_lunes)
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
            TaxManager::new(lunes_token, wallets, price)
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
            // Fee in Lunes = 6 USD / 0.5 USD/LUNES = 12 Lunes (with precision)
            let fee = contract.calculate_fee_in_lunes(1000_000, 60, 500_000).unwrap();
            assert_eq!(fee, 12_000_000); // 12 Lunes with 6 decimals of precision
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
