use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

fn acc(s: &str) -> AccountId { s.parse().unwrap() }

fn ctx(pred: &str, deposit: u128) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc("market.near")).predecessor_account_id(acc(pred))
        .attached_deposit(NearToken::from_yoctonear(deposit)).prepaid_gas(Gas::from_tgas(300));
    b
}

fn listed() -> Market {
    testing_env!(ctx("nft.near", 0).build());
    let mut m = Market::new();
    m.nft_on_approve("1".into(), acc("seller.near"), 7, r#"{"price":"1000"}"#.into());
    m
}

fn terms(royalty_bps: u16) -> SaleTerms {
    SaleTerms { treasury: acc("treasury.near"), royalty_bps, royalty_recipient: acc("founder.near") }
}

#[test]
fn listing_is_created_from_the_approval_callback() {
    let m = listed();
    let l = m.get_listing(acc("nft.near"), "1".into()).unwrap();
    assert_eq!((l.seller, l.price.0, l.approval_id), (acc("seller.near"), 1000, 7));
}

#[test]
#[should_panic(expected = "msg must be")]
fn bad_approval_msg_is_rejected() {
    testing_env!(ctx("nft.near", 0).build());
    let mut m = Market::new();
    m.nft_on_approve("1".into(), acc("s.near"), 1, "nope".into());
}

#[test]
#[should_panic(expected = "exactly the listed price")]
fn wrong_amount_rejected() {
    let mut m = listed();
    testing_env!(ctx("buyer.near", 999).build());
    let _ = m.buy(acc("nft.near"), "1".into(), 7);
}

#[test]
#[should_panic(expected = "Stale listing")]
fn stale_approval_id_rejected() {
    let mut m = listed();
    testing_env!(ctx("buyer.near", 1000).build());
    let _ = m.buy(acc("nft.near"), "1".into(), 8);
}

#[test]
#[should_panic(expected = "your own listing")]
fn seller_cannot_buy_own_listing() {
    let mut m = listed();
    testing_env!(ctx("seller.near", 1000).build());
    let _ = m.buy(acc("nft.near"), "1".into(), 7);
}

#[test]
fn buy_removes_the_listing_before_any_outbound_call() {
    let mut m = listed();
    testing_env!(ctx("buyer.near", 1000).build());
    let _ = m.buy(acc("nft.near"), "1".into(), 7);
    assert!(m.get_listing(acc("nft.near"), "1".into()).is_none());
}

#[test]
#[should_panic(expected = "Not listed")]
fn cannot_buy_twice() {
    let mut m = listed();
    testing_env!(ctx("buyer.near", 1000).build());
    let _ = m.buy(acc("nft.near"), "1".into(), 7);
    let _ = m.buy(acc("nft.near"), "1".into(), 7);
}

#[test]
#[should_panic(expected = "Only the seller")]
fn only_seller_can_cancel() {
    let mut m = listed();
    testing_env!(ctx("mallory.near", 0).build());
    m.cancel(acc("nft.near"), "1".into());
}

#[test]
fn seller_can_cancel_and_reprice() {
    let mut m = listed();
    testing_env!(ctx("seller.near", 0).build());
    m.update_price(acc("nft.near"), "1".into(), U128(2000));
    assert_eq!(m.get_listing(acc("nft.near"), "1".into()).unwrap().price.0, 2000);
    m.cancel(acc("nft.near"), "1".into());
    assert!(m.get_listing(acc("nft.near"), "1".into()).is_none());
}

#[test]
fn missing_terms_refund_the_buyer() {
    let mut m = listed();
    testing_env!(ctx("market.near", 0).build());
    let _ = m.on_terms(Err(PromiseError::Failed), acc("nft.near"), "1".into(), acc("buyer.near"), acc("seller.near"), U128(1000), 7);
}

#[test]
fn collection_with_overflowing_royalty_is_refused() {
    let mut m = listed();
    testing_env!(ctx("market.near", 0).build());
    let _ = m.on_terms(Ok(terms(9_600)), acc("nft.near"), "1".into(), acc("buyer.near"), acc("seller.near"), U128(1000), 7);
}

#[test]
fn failed_transfer_refunds_and_pays_nobody() {
    let mut m = listed();
    testing_env!(ctx("market.near", 0).build());
    let _ = m.on_transferred(Err(PromiseError::Failed), acc("nft.near"), "1".into(), acc("buyer.near"), acc("seller.near"), U128(1000), terms(500));
    assert!(near_sdk::test_utils::get_logs().iter().any(|l| l.contains("sale_failed")));
}

#[test]
fn successful_sale_pays_pool_royalty_and_seller() {
    let mut m = listed();
    testing_env!(ctx("market.near", 0).build());
    let _ = m.on_transferred(Ok(()), acc("nft.near"), "1".into(), acc("buyer.near"), acc("seller.near"), U128(10_000), terms(750));
    let log = near_sdk::test_utils::get_logs().join("\n");
    assert!(log.contains(r#""pool_fee":"500""#), "{log}");
    assert!(log.contains(r#""royalty":"750""#), "{log}");
    assert!(log.contains(r#""seller_net":"8750""#), "{log}");
}
