#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![allow(unexpected_cfgs)]

#[ink::contract]
pub mod mock_lunes_token {
    use common::traits::PSP22;
    use ink::storage::Mapping;

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        ArithmeticOverflow,
        InsufficientBalance,
        InsufficientAllowance,
    }

    #[ink(event)]
    pub struct Transfer {
        #[ink(topic)]
        from: Option<AccountId>,
        #[ink(topic)]
        to: Option<AccountId>,
        value: Balance,
    }

    #[ink(event)]
    pub struct Approval {
        #[ink(topic)]
        owner: AccountId,
        #[ink(topic)]
        spender: AccountId,
        value: Balance,
    }

    #[ink(storage)]
    pub struct MockLunesToken {
        total_supply: Balance,
        balances: Mapping<AccountId, Balance>,
        allowances: Mapping<(AccountId, AccountId), Balance>,
    }

    impl PSP22 for MockLunesToken {
        #[ink(message)]
        fn transfer(&mut self, to: AccountId, value: Balance) -> Result<(), ink::LangError> {
            let from = self.env().caller();
            self.transfer_from_to(from, to, value)
                .map_err(|_| ink::LangError::CouldNotReadInput)
        }

        #[ink(message)]
        fn transfer_from(
            &mut self,
            from: AccountId,
            to: AccountId,
            value: Balance,
        ) -> Result<(), ink::LangError> {
            let caller = self.env().caller();
            if from != caller {
                let allowance = self.allowances.get((from, caller)).unwrap_or(0);
                if allowance < value {
                    return Err(ink::LangError::CouldNotReadInput);
                }
                let new_allowance = allowance
                    .checked_sub(value)
                    .ok_or(ink::LangError::CouldNotReadInput)?;
                self.allowances.insert((from, caller), &new_allowance);
            }
            self.transfer_from_to(from, to, value)
                .map_err(|_| ink::LangError::CouldNotReadInput)
        }
    }

    impl MockLunesToken {
        #[ink(constructor)]
        pub fn new(initial_supply: Balance) -> Self {
            let caller = Self::env().caller();
            let mut balances = Mapping::new();
            balances.insert(caller, &initial_supply);

            Self::env().emit_event(Transfer {
                from: None,
                to: Some(caller),
                value: initial_supply,
            });

            Self {
                total_supply: initial_supply,
                balances,
                allowances: Mapping::new(),
            }
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

        #[ink(message)]
        pub fn approve(&mut self, spender: AccountId, value: Balance) -> Result<(), Error> {
            let owner = self.env().caller();
            self.allowances.insert((owner, spender), &value);
            self.env().emit_event(Approval {
                owner,
                spender,
                value,
            });
            Ok(())
        }

        fn transfer_from_to(
            &mut self,
            from: AccountId,
            to: AccountId,
            value: Balance,
        ) -> Result<(), Error> {
            let from_balance = self.balance_of(from);
            if from_balance < value {
                return Err(Error::InsufficientBalance);
            }

            let new_from_balance = from_balance
                .checked_sub(value)
                .ok_or(Error::ArithmeticOverflow)?;
            self.balances.insert(from, &new_from_balance);

            let to_balance = self.balance_of(to);
            let new_to_balance = to_balance
                .checked_add(value)
                .ok_or(Error::ArithmeticOverflow)?;
            self.balances.insert(to, &new_to_balance);

            self.env().emit_event(Transfer {
                from: Some(from),
                to: Some(to),
                value,
            });
            Ok(())
        }
    }
}
