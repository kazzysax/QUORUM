//! Shared building blocks for the Quorum contracts.
//!
//! Everything that two or more contracts must agree on lives here, so the
//! fee math and the asset naming can never drift between contracts.

pub mod asset;
pub mod events;
pub mod ext;
pub mod math;
pub mod swap;

pub use asset::AssetId;
pub use math::*;

/// Basis points in 100%.
pub const BPS: u16 = 10_000;
/// Share of every mint that goes into the NFT's vault (F1). Fixed by protocol.
pub const MINT_VAULT_BPS: u16 = 5_000;
/// Share of every market sale that goes to the DAO pool (F8). Fixed by protocol.
pub const SALE_POOL_BPS: u16 = 500;
/// Share of every vault asset that goes to the DAO pool on burn (F3). Fixed by protocol.
pub const REDEEM_POOL_BPS: u16 = 1_000;
/// Maximum asset types one vault or the pool may hold: NEAR plus 8 fungible tokens.
pub const MAX_ASSET_TYPES: usize = 9;

/// Aborts the call with `msg` kept in the failure text. In these builds `env::panic_str` compiles to a
/// bare trap (users only see "unreachable"); the host `panic_utf8` call keeps the reason visible.
#[allow(deprecated)]
pub fn fail(msg: &str) -> ! {
    near_sdk::env::panic(msg.as_bytes())
}

/// Like `near_sdk::require!` but the message survives in release builds.
#[macro_export]
macro_rules! require {
    ($cond:expr, $msg:expr $(,)?) => {
        if !$cond {
            $crate::fail($msg)
        }
    };
}
