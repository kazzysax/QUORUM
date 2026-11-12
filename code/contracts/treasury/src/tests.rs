use super::*;
use near_sdk::json_types::U64;
use quorum_common::swap::Hop;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, PromiseResult};

const USDC: &str = "nep141:usdc.near";

fn acc(s: &str) -> AccountId { s.parse().unwrap() }

fn ctx(pred: &str) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc("treasury.near")).predecessor_account_id(acc(pred)).prepaid_gas(Gas::from_tgas(300));
    b
}

fn with_results(pred: &str, r: Vec<PromiseResult>) {
    testing_env!(ctx(pred).build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(), r);
}

fn treasury() -> Treasury {
    testing_env!(ctx("dao.near").build());
    Treasury::new(acc("dao.near"), acc("nft.near"), acc("v2.ref-finance.near"), acc("wrap.near"))
}

fn json_ok<T: near_sdk::serde::Serialize>(v: T) -> PromiseResult {
    PromiseResult::Successful(near_sdk::serde_json::to_vec(&v).unwrap())
}

/// Runs a distribution of `amount` over `supply` live NFTs with a pool balance of `balance`.
fn distribute(t: &mut Treasury, amount: u128, supply: u64, balance: u128) {
    with_results("treasury.near", vec![json_ok(U64(supply)), json_ok(U128(balance))]);
    t.on_distribute_inputs(USDC.into(), U128(amount));
}

#[test]
#[should_panic(expected = "Only the DAO")]
fn stranger_cannot_spend() {
    let mut t = treasury();
    testing_env!(ctx("holder.near").build());
    let _ = t.spend(acc("x.near"), USDC.into(), U128(1), "x".into());
}

#[test]
#[should_panic(expected = "Only the DAO")]
fn founder_cannot_distribute() {
    let mut t = treasury();
    testing_env!(ctx("founder.near").build());
    let _ = t.distribute(USDC.into(), U128(1));
}

#[test]
#[should_panic(expected = "Only the NFT contract")]
fn stranger_cannot_claim_for_a_token() {
    let mut t = treasury();
    testing_env!(ctx("thief.near").build());
    let _ = t.claim_for("1".into(), acc("thief.near"), USDC.into());
}

#[test]
fn donations_are_open_to_everyone() {
    let mut t = treasury();
    let mut b = ctx("stranger.near");
    b.attached_deposit(NearToken::from_near(1));
    testing_env!(b.build());
    t.donate(Some("thanks".into()));
    testing_env!(ctx("usdc.near").build());
    assert_eq!(t.ft_on_transfer(acc("stranger.near"), U128(5), "".into()).0, 0);
}

#[test]
fn distribution_splits_evenly_and_leaves_dust() {
    let mut t = treasury();
    testing_env!(ctx("nft.near").build());
    t.register_token("1".into());
    t.register_token("2".into());
    t.register_token("3".into());
    distribute(&mut t, 100, 3, 1_000);
    for id in ["1", "2", "3"] {
        assert_eq!(t.owed_to(id.into(), USDC.into()).0, 33);
    }
    // 3 * 33 = 99 reserved; the remaining 1 stays spendable dust.
    assert_eq!(t.reserved_for(USDC.into()).0, 99);
}

#[test]
fn new_tokens_get_nothing_from_past_distributions() {
    let mut t = treasury();
    testing_env!(ctx("nft.near").build());
    t.register_token("1".into());
    distribute(&mut t, 100, 1, 1_000);
    testing_env!(ctx("nft.near").build());
    t.register_token("2".into()); // minted after
    assert_eq!(t.owed_to("1".into(), USDC.into()).0, 100);
    assert_eq!(t.owed_to("2".into(), USDC.into()).0, 0);
}

#[test]
fn burned_supply_is_excluded_from_later_distributions() {
    let mut t = treasury();
    testing_env!(ctx("nft.near").build());
    t.register_token("1".into());
    t.register_token("2".into());
    distribute(&mut t, 100, 2, 1_000); // 50 each
    distribute(&mut t, 90, 1, 1_000); // token 2 burned: supply is 1
    assert_eq!(t.owed_to("1".into(), USDC.into()).0, 50 + 90);
}

#[test]
fn unregistered_token_cannot_claim() {
    let mut t = treasury();
    distribute(&mut t, 100, 1, 1_000);
    assert_eq!(t.owed_to("ghost".into(), USDC.into()).0, 0);
}

#[test]
fn claim_updates_state_before_paying_and_is_one_shot() {
    let mut t = treasury();
    testing_env!(ctx("nft.near").build());
    t.register_token("1".into());
    distribute(&mut t, 100, 1, 1_000);
    testing_env!(ctx("nft.near").build());
    let _ = t.claim_for("1".into(), acc("alice.near"), USDC.into());
    assert_eq!(t.owed_to("1".into(), USDC.into()).0, 0);
    assert_eq!(t.reserved_for(USDC.into()).0, 0);
}

#[test]
fn failed_claim_payment_restores_the_claim() {
    let mut t = treasury();
    testing_env!(ctx("nft.near").build());
    t.register_token("1".into());
    distribute(&mut t, 100, 1, 1_000);
    testing_env!(ctx("nft.near").build());
    let _ = t.claim_for("1".into(), acc("alice.near"), USDC.into());
    with_results("treasury.near", vec![PromiseResult::Failed]);
    t.on_claim_paid(Err(PromiseError::Failed), "1".into(), USDC.into(), U128(0), U128(100));
    assert_eq!(t.owed_to("1".into(), USDC.into()).0, 100);
    assert_eq!(t.reserved_for(USDC.into()).0, 100);
}

#[test]
fn spend_cannot_touch_reserved_funds() {
    let mut t = treasury();
    testing_env!(ctx("nft.near").build());
    t.register_token("1".into());
    distribute(&mut t, 600, 1, 1_000);
    // Pool holds 1000, 600 reserved -> only 400 free.
    with_results("treasury.near", vec![json_ok(U128(1_000))]);
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        t.on_spend_funds(Ok(U128(1_000)), acc("x.near"), USDC.into(), U128(401), "too much".into())
    }));
    assert!(r.is_err());
    with_results("treasury.near", vec![json_ok(U128(1_000))]);
    let _ = t.on_spend_funds(Ok(U128(1_000)), acc("x.near"), USDC.into(), U128(100), "ok".into());
}

#[test]
#[should_panic(expected = "50%")]
fn one_spend_cannot_exceed_half_of_the_free_funds() {
    let mut t = treasury();
    with_results("treasury.near", vec![json_ok(U128(1_000))]);
    // 1000 free: 500 is the most one spend may take.
    let _ = t.on_spend_funds(Ok(U128(1_000)), acc("x.near"), USDC.into(), U128(501), "too big".into());
}

#[test]
fn half_of_the_free_funds_is_allowed() {
    let mut t = treasury();
    with_results("treasury.near", vec![json_ok(U128(1_000))]);
    let _ = t.on_spend_funds(Ok(U128(1_000)), acc("x.near"), USDC.into(), U128(500), "limit".into());
}

#[test]
fn burn_pays_unclaimed_distribution_to_the_burner() {
    let mut t = treasury();
    testing_env!(ctx("nft.near").build());
    t.register_token("1".into());
    distribute(&mut t, 100, 1, 1_000);
    testing_env!(ctx("nft.near").build());
    t.on_token_burned("1".into(), acc("burner.near"));
    assert_eq!(t.owed_to("1".into(), USDC.into()).0, 0);
}

#[test]
#[should_panic(expected = "Too many distributed asset types")]
fn asset_type_cap_applies_to_the_pool() {
    let mut t = treasury();
    for i in 0..MAX_ASSET_TYPES {
        t.slot(&format!("nep141:t{i}.near"));
    }
    testing_env!(ctx("dao.near").build());
    let _ = t.distribute("nep141:one-too-many.near".into(), U128(1));
}


// -------------------------------------------------------------------- swaps

fn route() -> Vec<Hop> { vec![Hop { pool_id: 79, token_out: acc("usdc.near") }] }

#[test]
fn only_the_dao_can_swap() {
    let mut t = treasury();
    testing_env!(ctx("holder.near").build());
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { let _ = t.swap("near".into(), U128(10), acc("usdc.near"), route(), U128(5), acc("v2.ref-finance.near")); }));
    assert!(format!("{:?}", r.err().and_then(|e| e.downcast_ref::<String>().cloned())).contains("Only the DAO"));
}

#[test]
fn swaps_only_go_to_approved_dexes_and_routes_that_end_in_the_output() {
    let mut t = treasury();
    testing_env!(ctx("dao.near").build());
    let bad_dex = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { let _ = t.swap("near".into(), U128(10), acc("usdc.near"), route(), U128(5), acc("evil.near")); }));
    assert!(format!("{:?}", bad_dex.err().and_then(|e| e.downcast_ref::<String>().cloned())).contains("not been approved"));
    let bad_route = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { let _ = t.swap("near".into(), U128(10), acc("eth.near"), route(), U128(5), acc("v2.ref-finance.near")); }));
    assert!(format!("{:?}", bad_route.err().and_then(|e| e.downcast_ref::<String>().cloned())).contains("end in the output"));
    let zero_min = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { let _ = t.swap("near".into(), U128(10), acc("usdc.near"), route(), U128(0), acc("v2.ref-finance.near")); }));
    assert!(zero_min.is_err(), "a zero minimum must be refused");
    let _ = t.swap("near".into(), U128(10), acc("usdc.near"), route(), U128(5), acc("v2.ref-finance.near"));
}

#[test]
fn swap_cannot_spend_amounts_reserved_for_claims() {
    let mut t = treasury();
    testing_env!(ctx("nft.near").build());
    t.register_token("1".into());
    distribute(&mut t, 600, 1, 1_000);
    with_results("treasury.near", vec![json_ok(U128(1_000))]);
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = t.on_swap_funds(Ok(U128(1_000)), USDC.into(), U128(401), acc("eth.near"), vec![Hop { pool_id: 1, token_out: acc("eth.near") }], U128(1), acc("v2.ref-finance.near"));
    }));
    assert!(format!("{:?}", r.err().and_then(|e| e.downcast_ref::<String>().cloned())).contains("Insufficient unreserved"));
    with_results("treasury.near", vec![json_ok(U128(1_000))]);
    let _ = t.on_swap_funds(Ok(U128(1_000)), USDC.into(), U128(400), acc("eth.near"), vec![Hop { pool_id: 1, token_out: acc("eth.near") }], U128(1), acc("v2.ref-finance.near"));
}

#[test]
fn the_dao_can_approve_and_revoke_dexes_nobody_else_can() {
    let mut t = treasury();
    testing_env!(ctx("founder.near").build());
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| t.set_param("allow_dex".into(), "d2.near".into()))).is_err());
    testing_env!(ctx("dao.near").build());
    t.set_param("allow_dex".into(), "d2.near".into());
    assert_eq!(t.approved_dexes().len(), 2);
    t.set_param("revoke_dex".into(), "d2.near".into());
    assert_eq!(t.approved_dexes(), vec![acc("v2.ref-finance.near")]);
}

#[test]
fn a_distribution_of_real_near_amounts_does_not_overflow() {
    // 0.4 NEAR over 8 NFTs: the case that overflowed with a 10^24 index scale.
    let mut t = treasury();
    testing_env!(ctx("nft.near").build());
    for i in 1..=8 { t.register_token(i.to_string()); }
    let amount: u128 = 400_000_000_000_000_000_000_000;
    distribute(&mut t, amount, 8, amount * 5);
    assert_eq!(t.owed_to("1".into(), USDC.into()).0, amount / 8);
    assert_eq!(t.reserved_for(USDC.into()).0, amount);
}

#[test]
fn a_huge_distribution_still_fits() {
    // 100,000 NEAR over 3 NFTs.
    let mut t = treasury();
    testing_env!(ctx("nft.near").build());
    for i in 1..=3 { t.register_token(i.to_string()); }
    let amount: u128 = 100_000 * 1_000_000_000_000_000_000_000_000;
    distribute(&mut t, amount, 3, amount * 2);
    let owed = t.owed_to("1".into(), USDC.into()).0;
    assert!(owed <= amount / 3 && amount / 3 - owed < 3);
}
