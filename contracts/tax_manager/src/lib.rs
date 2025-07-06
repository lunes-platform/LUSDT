#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod tax_manager {
    use common::{
        common_types::{DistributionWallets, FeeConfig, OperationType},
        traits::{TaxManager as TaxManagerTrait, PSP22},
    };

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        Unauthorized,
        ArithmeticOverflow,
        InvalidFeeConfig,
        InsufficientLunesBalance,
        LunesTransferFailed,
    }

    #[ink(storage)]
    pub struct TaxManager {
        owner: AccountId,
        lunes_token_address: AccountId,
        distribution_wallets: DistributionWallets,
        fee_config: FeeConfig,
        monthly_volume_usd: u128,
        last_volume_reset_timestamp: u64,
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
                owner: Self::env().caller(),
                lunes_token_address,
                distribution_wallets,
                fee_config,
                monthly_volume_usd: 0,
                last_volume_reset_timestamp: Self::env().block_timestamp(),
            }
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
            Ok(())
        }

        #[ink(message)]
        pub fn update_distribution_wallets(
            &mut self,
            new_wallets: DistributionWallets,
        ) -> Result<(), Error> {
            self.ensure_owner()?;
            self.distribution_wallets = new_wallets;
            Ok(())
        }

        fn _process_fees(
            &mut self,
            operation: OperationType,
            user: AccountId,
            lusdt_amount: Balance,
        ) -> Result<(), Error> {
            let fee_bps = self.get_current_fee_bps();
            let lunes_price_usd = 500_000; // Placeholder for oracle price
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

                    distributions.push((self.distribution_wallets.dev, dev_amount));
                    distributions.push((self.distribution_wallets.backing_fund, backing_amount));
                    distributions.push((self.distribution_wallets.dao, dao_amount));
                    distributions.push((self.distribution_wallets.rewards_fund, rewards_amount));
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

                    distributions.push((self.distribution_wallets.dev, dev_amount));
                    distributions.push((self.distribution_wallets.dao, dao_amount));
                    distributions.push((self.distribution_wallets.burn_address, burn_amount));
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
                return Err(Error::InvalidFeeConfig);
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
}
