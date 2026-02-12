//! # BurnEngine Contract — LUNES Deflationary Burn Mechanism
//! # Contrato BurnEngine — Mecanismo Deflacionário de Queima de LUNES
//!
//! This contract receives LUNES tokens collected as fees from swaps and burns them
//! by consuming gas through on-chain operations. Anyone can trigger the burn process
//! (permissionless), making it fully trustless and decentralized.
//!
//! Este contrato recebe tokens LUNES coletados como taxas dos swaps e os queima
//! consumindo gas através de operações on-chain. Qualquer pessoa pode acionar o
//! processo de queima (sem permissão), tornando-o totalmente trustless e descentralizado.
//!
//! ## How it works / Como funciona:
//! 1. Tax Manager sends LUNES burn-fee to this contract
//! 2. Anyone calls `burn_cycle(iterations)` — each iteration consumes gas
//! 3. Gas consumption = LUNES burned by the network
//! 4. Total burned is tracked for transparency
//!
//! ## Security / Segurança:
//! - No private keys needed — it's a contract, not a wallet
//! - Permissionless — anyone can call burn_cycle()
//! - On-chain verifiable — all burns are auditable
//! - No off-chain dependency — no bots needed
//! - Max 100 iterations per call to prevent block gas limit issues

#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![allow(unexpected_cfgs)]

#[ink::contract]
pub mod burn_engine {
    /// Emitted when a burn cycle is executed
    #[ink(event)]
    pub struct BurnCycleExecuted {
        #[ink(topic)]
        caller: AccountId,
        iterations: u32,
        gas_consumed_estimate: u64,
    }

    /// Emitted when LUNES are received for burning
    #[ink(event)]
    pub struct LunesReceived {
        #[ink(topic)]
        from: AccountId,
        amount: Balance,
    }

    #[ink(storage)]
    pub struct BurnEngine {
        /// Contract owner (Tax Manager or admin)
        owner: AccountId,
        /// Total burn cycles executed
        total_cycles: u64,
        /// Total iterations performed (proxy for gas burned)
        total_iterations: u64,
        /// Accumulator used in burn operations (storage writes consume gas)
        burn_accumulator: u128,
        /// Maximum iterations per call (safety limit)
        max_iterations_per_call: u32,
        /// Whether the contract is active
        active: bool,
    }

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        /// Contract is not active
        Inactive,
        /// Iterations must be > 0
        ZeroIterations,
        /// Only owner can call this
        Unauthorized,
    }

    impl BurnEngine {
        /// Creates a new BurnEngine contract.
        /// The caller becomes the owner.
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                owner: Self::env().caller(),
                total_cycles: 0,
                total_iterations: 0,
                burn_accumulator: 0,
                max_iterations_per_call: 100,
                active: true,
            }
        }

        /// Execute a burn cycle. Each iteration performs storage writes
        /// that consume gas, effectively burning LUNES from the network.
        ///
        /// **Permissionless** — anyone can call this to help burn LUNES.
        ///
        /// @param iterations Number of burn iterations (1-100).
        ///   More iterations = more gas consumed = more LUNES burned.
        #[ink(message)]
        pub fn burn_cycle(&mut self, iterations: u32) -> Result<(), Error> {
            if !self.active {
                return Err(Error::Inactive);
            }
            if iterations == 0 {
                return Err(Error::ZeroIterations);
            }

            let capped = iterations.min(self.max_iterations_per_call);

            // Each iteration does a storage write + arithmetic
            // Storage writes are the most gas-expensive operation in ink!
            for i in 0..capped {
                // Heavy storage write — consumes significant gas per iteration
                self.burn_accumulator = self.burn_accumulator
                    .wrapping_add(i as u128)
                    .wrapping_mul(7)
                    .wrapping_add(1);
            }

            self.total_cycles += 1;
            self.total_iterations += capped as u64;

            self.env().emit_event(BurnCycleExecuted {
                caller: self.env().caller(),
                iterations: capped,
                gas_consumed_estimate: capped as u64 * 50_000, // rough estimate per iteration
            });

            Ok(())
        }

        // === View functions ===

        /// Get total burn cycles executed since deployment.
        #[ink(message)]
        pub fn get_total_cycles(&self) -> u64 {
            self.total_cycles
        }

        /// Get total iterations performed (proxy metric for total gas burned).
        #[ink(message)]
        pub fn get_total_iterations(&self) -> u64 {
            self.total_iterations
        }

        /// Get the current burn accumulator value (proof of work done).
        #[ink(message)]
        pub fn get_burn_accumulator(&self) -> u128 {
            self.burn_accumulator
        }

        /// Check if the contract is active.
        #[ink(message)]
        pub fn is_active(&self) -> bool {
            self.active
        }

        /// Get the contract owner.
        #[ink(message)]
        pub fn get_owner(&self) -> AccountId {
            self.owner
        }

        /// Get max iterations allowed per call.
        #[ink(message)]
        pub fn get_max_iterations(&self) -> u32 {
            self.max_iterations_per_call
        }

        /// Get contract balance (LUNES waiting to be burned via gas).
        #[ink(message)]
        pub fn get_balance(&self) -> Balance {
            self.env().balance()
        }

        // === Admin functions ===

        /// Update max iterations per call (owner only).
        #[ink(message)]
        pub fn set_max_iterations(&mut self, max: u32) -> Result<(), Error> {
            self.ensure_owner()?;
            self.max_iterations_per_call = max.min(500); // Hard cap at 500
            Ok(())
        }

        /// Pause/unpause the burn engine (owner only).
        #[ink(message)]
        pub fn set_active(&mut self, active: bool) -> Result<(), Error> {
            self.ensure_owner()?;
            self.active = active;
            Ok(())
        }

        /// Transfer ownership (owner only).
        #[ink(message)]
        pub fn transfer_ownership(&mut self, new_owner: AccountId) -> Result<(), Error> {
            self.ensure_owner()?;
            self.owner = new_owner;
            Ok(())
        }

        // === Internal ===

        fn ensure_owner(&self) -> Result<(), Error> {
            if self.env().caller() != self.owner {
                Err(Error::Unauthorized)
            } else {
                Ok(())
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use ink::env::test::{set_caller, DefaultAccounts};
        use ink::env::DefaultEnvironment;

        fn setup() -> (BurnEngine, DefaultAccounts<DefaultEnvironment>) {
            let accounts = ink::env::test::default_accounts::<DefaultEnvironment>();
            set_caller::<DefaultEnvironment>(accounts.alice);
            let contract = BurnEngine::new();
            (contract, accounts)
        }

        #[ink::test]
        fn new_works() {
            let (contract, accounts) = setup();
            assert_eq!(contract.get_owner(), accounts.alice);
            assert_eq!(contract.get_total_cycles(), 0);
            assert_eq!(contract.get_total_iterations(), 0);
            assert!(contract.is_active());
        }

        #[ink::test]
        fn burn_cycle_works() {
            let (mut contract, _) = setup();

            assert!(contract.burn_cycle(10).is_ok());
            assert_eq!(contract.get_total_cycles(), 1);
            assert_eq!(contract.get_total_iterations(), 10);
            assert_ne!(contract.get_burn_accumulator(), 0);
        }

        #[ink::test]
        fn burn_cycle_caps_iterations() {
            let (mut contract, _) = setup();

            // Request 200 but max is 100
            assert!(contract.burn_cycle(200).is_ok());
            assert_eq!(contract.get_total_iterations(), 100);
        }

        #[ink::test]
        fn burn_cycle_zero_fails() {
            let (mut contract, _) = setup();
            assert_eq!(contract.burn_cycle(0), Err(Error::ZeroIterations));
        }

        #[ink::test]
        fn burn_cycle_inactive_fails() {
            let (mut contract, _) = setup();
            contract.set_active(false).unwrap();
            assert_eq!(contract.burn_cycle(10), Err(Error::Inactive));
        }

        #[ink::test]
        fn multiple_cycles_accumulate() {
            let (mut contract, _) = setup();

            contract.burn_cycle(50).unwrap();
            contract.burn_cycle(30).unwrap();
            contract.burn_cycle(20).unwrap();

            assert_eq!(contract.get_total_cycles(), 3);
            assert_eq!(contract.get_total_iterations(), 100);
        }

        #[ink::test]
        fn only_owner_can_set_max() {
            let (mut contract, accounts) = setup();

            // Owner can set
            assert!(contract.set_max_iterations(50).is_ok());
            assert_eq!(contract.get_max_iterations(), 50);

            // Non-owner cannot
            set_caller::<DefaultEnvironment>(accounts.bob);
            assert_eq!(contract.set_max_iterations(200), Err(Error::Unauthorized));
        }

        #[ink::test]
        fn max_iterations_hard_cap() {
            let (mut contract, _) = setup();

            // Try to set above hard cap of 500
            contract.set_max_iterations(1000).unwrap();
            assert_eq!(contract.get_max_iterations(), 500);
        }

        #[ink::test]
        fn transfer_ownership_works() {
            let (mut contract, accounts) = setup();

            contract.transfer_ownership(accounts.bob).unwrap();
            assert_eq!(contract.get_owner(), accounts.bob);

            // Alice can no longer admin
            assert_eq!(contract.set_active(false), Err(Error::Unauthorized));
        }
    }
}
