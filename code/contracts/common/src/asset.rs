use near_sdk::AccountId;

/// Asset identifiers use the same format as the NEAR Intents verifier:
/// `near` for native NEAR, `nep141:<token account>` for fungible tokens.
pub type AssetId = String;

pub const NATIVE_NEAR: &str = "near";

pub fn ft_asset(token: &AccountId) -> AssetId {
    format!("nep141:{token}")
}

/// Returns the token contract for a `nep141:` asset, or `None` for native NEAR.
pub fn ft_contract(asset: &str) -> Option<AccountId> {
    asset
        .strip_prefix("nep141:")
        .map(|a| a.parse().unwrap_or_else(|_| near_sdk::env::panic_str("Invalid asset id")))
}

pub fn is_native(asset: &str) -> bool {
    asset == NATIVE_NEAR
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let usdc: AccountId = "usdc.near".parse().unwrap();
        let id = ft_asset(&usdc);
        assert_eq!(id, "nep141:usdc.near");
        assert_eq!(ft_contract(&id), Some(usdc));
        assert_eq!(ft_contract(NATIVE_NEAR), None);
        assert!(is_native("near"));
    }
}
