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
        .map(|a| a.parse().unwrap_or_else(|_| crate::fail("Invalid asset id")))
}

pub fn is_native(asset: &str) -> bool {
    asset == NATIVE_NEAR
}

/// Panics unless `asset` is exactly `near` or `nep141:<valid account>`. Without this, any
/// other string (say `NEAR`) would be paid as native NEAR yet escape the per-asset
/// reserve for unclaimed distributions.
pub fn assert_asset(asset: &str) {
    if asset == NATIVE_NEAR {
        return;
    }
    let Some(token) = asset.strip_prefix("nep141:") else {
        crate::fail("Asset must be `near` or `nep141:<token>`");
    };
    if token.parse::<AccountId>().is_err() {
        crate::fail("Invalid token account in asset id");
    }
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

#[cfg(test)]
mod assert_asset_tests {
    use super::assert_asset;

    #[test]
    fn accepts_near_and_nep141() {
        assert_asset("near");
        assert_asset("nep141:usdc.near");
    }

    #[test]
    #[should_panic(expected = "Asset must be")]
    fn rejects_other_spellings_of_near() {
        assert_asset("NEAR");
    }

    #[test]
    #[should_panic(expected = "Invalid token account")]
    fn rejects_bad_token_accounts() {
        assert_asset("nep141:NOT VALID");
    }
}
