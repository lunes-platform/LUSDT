use ink::primitives::AccountId;

pub type Timestamp = u64;
pub type Balance = u128;

/// Configuration for fee distribution wallets.
#[derive(Debug, Clone, PartialEq, Eq, scale::Encode, scale::Decode, ink::storage::traits::StorageLayout)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
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
#[derive(Debug, Clone, PartialEq, Eq, scale::Encode, scale::Decode, ink::storage::traits::StorageLayout)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
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

/// Operation type for fee processing.
#[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode, Clone, Copy)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum OperationType {
    Mint,
    Burn,
}
