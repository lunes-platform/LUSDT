use ink::primitives::AccountId;

pub type Timestamp = u64;
pub type Balance = u128;

/// Configuration for fee distribution wallets (v3 model: 80% dev / 15% insurance / 5% staking).
#[derive(Debug, Clone, PartialEq, Eq, scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
pub struct DistributionWallets {
    /// Dev wallet for Solana network (receives 80% of USDT fees). Configurable.
    pub dev_solana: AccountId,
    /// Dev wallet for Lunes network (receives 80% of LUSDT fees). Configurable.
    pub dev_lunes: AccountId,
    /// Insurance fund wallet (receives 15% of all fees). Fixed, non-editable.
    pub insurance_fund: AccountId,
    /// Staking rewards pool (receives 5% of all fees). Monthly distribution to stakers ≥100k LUNES.
    pub staking_rewards_pool: AccountId,
}

/// Fee payment type for flexible fee processing.
#[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode, Clone, Copy)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum FeeType {
    /// Pay fees in LUNES tokens
    Lunes,
    /// Pay fees in LUSDT tokens
    Lusdt,
    /// Mark fees for USDT payment via bridge (emit event only)
    Usdt,
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

/// Operation type for fee processing.
#[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode, Clone, Copy, scale_info::TypeInfo)]
pub enum OperationType {
    Mint,
    Burn,
}
