use crate::common_types::{FeeType, OperationType};
use ink::primitives::AccountId;

/// The `TaxManager` trait defines the public interface for the tax management contract.
/// It ensures that any contract implementing this trait will provide the necessary
/// functionalities for fee processing in the LUSDT ecosystem.
#[ink::trait_definition]
pub trait TaxManager {
    /// @notice Processes fees for a given LUSDT operation (mint or burn).
    /// @dev Legacy entry point — defaults to FeeType::Lunes.
    #[ink(message)]
    fn process_fees(
        &mut self,
        operation: OperationType,
        user: AccountId,
        lusdt_amount: u128,
    ) -> Result<(), ink::LangError>;

    /// @notice Processes fees with explicit fee type selection.
    /// @dev v2 entry point for single-currency fees.
    /// @param fee_type Determines payment method: Usdt (bridge event), Lusdt (token transfer), Lunes (legacy).
    #[ink(message)]
    fn process_fees_flexible(
        &mut self,
        operation: OperationType,
        user: AccountId,
        lusdt_amount: u128,
        fee_type: FeeType,
    ) -> Result<(), ink::LangError>;

    /// @notice v3 Dual-fee model: charges stablecoin fee (revenue) + LUNES fee (burn).
    /// @dev Mint: USDT fee + LUNES burn. Burn: LUSDT fee + LUNES burn.
    /// @param operation Mint or Burn.
    /// @param user The user paying the fees.
    /// @param lusdt_amount The LUSDT amount of the swap (used to calculate fee %).
    /// @param stablecoin_fee_type Usdt for mint, Lusdt for burn.
    #[ink(message)]
    fn process_dual_fee(
        &mut self,
        operation: OperationType,
        user: AccountId,
        lusdt_amount: u128,
        stablecoin_fee_type: FeeType,
    ) -> Result<(), ink::LangError>;

    /// @notice Charges only the LUNES deflationary burn fee (0.10%) and sends to BurnEngine.
    /// @dev Used by mint — the stablecoin (USDT) fee is handled by the bridge BEFORE minting.
    /// @param operation The operation type (Mint or Burn).
    /// @param user The user paying the LUNES burn fee.
    /// @param lusdt_amount The LUSDT amount of the swap (used to calculate the burn fee).
    #[ink(message)]
    fn process_burn_fee_only(
        &mut self,
        operation: OperationType,
        user: AccountId,
        lusdt_amount: u128,
    ) -> Result<(), ink::LangError>;
}

/// The `StakingManager` trait defines the public interface for the staking contract.
/// Manages LUNES staking and proportional LUSDT reward distribution on-chain.
/// All fund custody and distribution is trustless — no admin can divert funds.
#[ink::trait_definition]
pub trait StakingManager {
    /// @notice Deposit LUSDT rewards into the staking pool.
    /// @dev Called by Tax Manager or bridge after fee collection. Updates reward accounting.
    /// The caller must have already approved this contract to spend `amount` LUSDT.
    #[ink(message)]
    fn deposit_rewards(&mut self, amount: u128) -> Result<(), ink::LangError>;

    /// @notice Notify the contract that LUSDT rewards were transferred directly (no transfer_from).
    /// @dev Only callable by owner or authorized address. Used when Tax Manager transfers directly.
    #[ink(message)]
    fn notify_reward_amount(&mut self, amount: u128) -> Result<(), ink::LangError>;
}

/// A minimal PSP22 trait for token interaction.
/// Defines the `transfer_from` function needed for fee collection.
#[ink::trait_definition]
pub trait PSP22 {
    /// @notice Transfers `value` amount of tokens from `from` to `to`.
    /// @dev This function requires that the `from` account has approved the caller
    /// to spend on its behalf.
    #[ink(message)]
    fn transfer_from(
        &mut self,
        from: AccountId,
        to: AccountId,
        value: u128,
    ) -> Result<(), ink::LangError>;

    /// @notice Transfers `value` amount of tokens from the caller's account to `to`.
    #[ink(message)]
    fn transfer(&mut self, to: AccountId, value: u128) -> Result<(), ink::LangError>;
}
