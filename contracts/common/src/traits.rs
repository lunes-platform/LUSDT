
use crate::common_types::OperationType;
use ink::primitives::AccountId;

/// The `TaxManager` trait defines the public interface for the tax management contract.
/// It ensures that any contract implementing this trait will provide the necessary
/// functionalities for fee processing in the LUSDT ecosystem.
#[ink::trait_definition]
pub trait TaxManager {
    /// @notice Processes fees for a given LUSDT operation (mint or burn).
    /// @dev This is the main entry point for fee logic, callable by other contracts (e.g., LUSDT Token).
    /// @param operation The type of operation (`Mint` or `Burn`).
    /// @param user The user performing the operation and paying the fee.
    /// @param lusdt_amount The amount of LUSDT being minted or burned, used for fee calculation.
    #[ink(message)]
    fn process_fees(
        &mut self,
        operation: OperationType,
        user: AccountId,
        lusdt_amount: u128,
    ) -> Result<(), ink::LangError>;
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
