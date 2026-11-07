//! Builds the instant-swap message for Ref/Rhea classic pools. The contracts
//! build this themselves from structured hops, so nobody can pass a raw message
//! that sends funds somewhere else or sets `min_amount_out` to zero by omission.
//!
//! Wire format (from the Ref SDK / NEAR docs):
//! `{"force":0,"actions":[{"pool_id":N,"token_in":"..","token_out":"..","amount_in":"..","min_amount_out":".."}]}`
//! Only the first action carries `amount_in`; later hops use the previous output.

use near_sdk::serde_json::{json, Value};
use near_sdk::{near, AccountId};

pub const MAX_HOPS: usize = 3;

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Hop {
    pub pool_id: u64,
    pub token_out: AccountId,
}

/// Returns the message for swapping `amount_in` of `token_in` through `hops`,
/// failing atomically (inside the DEX) unless at least `min_out` arrives.
pub fn swap_msg(token_in: &AccountId, amount_in: u128, hops: &[Hop], min_out: u128) -> Result<String, &'static str> {
    if hops.is_empty() || hops.len() > MAX_HOPS { return Err("1 to 3 hops"); }
    if min_out == 0 { return Err("min_out must be positive"); }
    if amount_in == 0 { return Err("amount must be positive"); }
    let mut actions: Vec<Value> = Vec::new();
    let mut from = token_in.clone();
    for (i, h) in hops.iter().enumerate() {
        if h.token_out == from { return Err("a hop must change the token"); }
        let last = i + 1 == hops.len();
        let mut a = json!({
            "pool_id": h.pool_id,
            "token_in": from,
            "token_out": h.token_out,
            "min_amount_out": if last { min_out.to_string() } else { "0".to_string() },
        });
        if i == 0 { a["amount_in"] = json!(amount_in.to_string()); }
        actions.push(a);
        from = h.token_out.clone();
    }
    Ok(json!({ "force": 0, "actions": actions }).to_string())
}

/// The token the route ends in.
pub fn route_output(hops: &[Hop]) -> Option<&AccountId> {
    hops.last().map(|h| &h.token_out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn a(s: &str) -> AccountId { s.parse().unwrap() }

    #[test]
    fn single_hop_matches_the_documented_format() {
        let m = swap_msg(&a("wrap.near"), 1000, &[Hop { pool_id: 79, token_out: a("usdt.tether-token.near") }], 900).unwrap();
        let v: Value = near_sdk::serde_json::from_str(&m).unwrap();
        assert_eq!(v["force"], 0);
        let act = &v["actions"][0];
        assert_eq!(act["pool_id"], 79);
        assert_eq!(act["token_in"], "wrap.near");
        assert_eq!(act["token_out"], "usdt.tether-token.near");
        assert_eq!(act["amount_in"], "1000");
        assert_eq!(act["min_amount_out"], "900");
    }

    #[test]
    fn multi_hop_chains_tokens_and_only_the_last_hop_carries_the_minimum() {
        let hops = [Hop { pool_id: 1, token_out: a("b.near") }, Hop { pool_id: 2, token_out: a("c.near") }];
        let v: Value = near_sdk::serde_json::from_str(&swap_msg(&a("wrap.near"), 50, &hops, 7).unwrap()).unwrap();
        assert_eq!(v["actions"][1]["token_in"], "b.near");
        assert!(v["actions"][1].get("amount_in").is_none());
        assert_eq!(v["actions"][0]["min_amount_out"], "0");
        assert_eq!(v["actions"][1]["min_amount_out"], "7");
        assert_eq!(route_output(&hops), Some(&a("c.near")));
    }

    #[test]
    fn rejects_unsafe_routes() {
        let h = |t: &str| Hop { pool_id: 1, token_out: a(t) };
        assert!(swap_msg(&a("wrap.near"), 1, &[], 1).is_err());
        assert!(swap_msg(&a("wrap.near"), 1, &[h("a.near"), h("b.near"), h("c.near"), h("d.near")], 1).is_err());
        assert!(swap_msg(&a("wrap.near"), 1, &[h("a.near")], 0).is_err(), "zero minimum would accept any price");
        assert!(swap_msg(&a("wrap.near"), 0, &[h("a.near")], 1).is_err());
        assert!(swap_msg(&a("wrap.near"), 1, &[h("wrap.near")], 1).is_err());
    }
}
