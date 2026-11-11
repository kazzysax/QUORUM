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
    let mut m = market();
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
    let mut m = market();
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

fn market() -> Market {
    testing_env!(ctx("owner.near", 0).build());
    let mut m = Market::new(acc("owner.near"));
    m.register_collection(acc("nft.near"));
    testing_env!(ctx("nft.near", 0).build());
    m
}

#[test]
#[should_panic(expected = "not registered")]
fn an_unregistered_collection_cannot_list() {
    let mut m = market();
    testing_env!(ctx("fake-nft.near", 0).build());
    m.nft_on_approve("1".into(), acc("s.near"), 1, r#"{"price":"5"}"#.into());
}

#[test]
#[should_panic(expected = "Only the owner")]
fn only_the_owner_registers_collections() {
    let mut m = market();
    testing_env!(ctx("mallory.near", 0).build());
    m.register_collection(acc("fake-nft.near"));
}

#[test]
fn get_listings_filters_by_collection_and_stats_count_completed_sales() {
    let mut m = listed();
    let l = m.get_listings(acc("nft.near"), 0, 10);
    assert_eq!(l.len(), 1);
    assert_eq!(l[0].0, "1");
    assert!(m.get_listings(acc("elsewhere.near"), 0, 10).is_empty());
    assert_eq!(m.get_stats(acc("nft.near")).sales, 0);
    testing_env!(ctx("buyer.near", 1000).build());
    let _ = m.buy(acc("nft.near"), "1".into(), 7);
    testing_env!(ctx("market.near", 0).build());
    let _ = m.on_transferred(Ok(()), acc("nft.near"), "1".into(), acc("buyer.near"), acc("seller.near"), U128(1000), terms(500));
    let s = m.get_stats(acc("nft.near"));
    assert_eq!((s.sales, s.volume.0), (1, 1000));
    assert!(m.get_listings(acc("nft.near"), 0, 10).is_empty());
}

#[test]
fn recent_sales_keep_the_split_and_are_newest_first() {
    let mut m = listed();
    testing_env!(ctx("market.near", 0).build());
    let _ = m.on_transferred(Ok(()), acc("nft.near"), "1".into(), acc("buyer.near"), acc("seller.near"), U128(10_000), terms(750));
    let _ = m.on_transferred(Ok(()), acc("nft.near"), "2".into(), acc("buyer.near"), acc("seller.near"), U128(2_000), terms(0));
    let r = m.recent_sales(Some(acc("nft.near")), 10);
    assert_eq!(r.len(), 2);
    assert_eq!(r[0].token_id, "2");
    assert_eq!((r[1].pool_fee.0, r[1].royalty.0, r[1].seller_net.0), (500, 750, 8_750));
    assert!(m.recent_sales(Some(acc("other.near")), 10).is_empty());
}

// ------------------------------------------------------------------ offers

fn with_offer() -> Market {
    let mut m = market();
    testing_env!(ctx("buyer.near", 5_000).block_timestamp(1_000_000_000_000).build());
    m.make_offer(acc("nft.near"), "1".into(), 86_400_000);
    m
}

#[test]
fn an_offer_is_escrowed_and_visible() {
    let m = with_offer();
    let o = m.offers_for_token(acc("nft.near"), "1".into());
    assert_eq!(o.len(), 1);
    assert_eq!((o[0].buyer.clone(), o[0].amount.0), (acc("buyer.near"), 5_000));
    assert_eq!(m.offers_by(acc("buyer.near")).len(), 1);
    assert_eq!(m.offers_for_collection(acc("nft.near"), 0, 10).len(), 1);
}

#[test]
#[should_panic(expected = "between 1 hour and 30 days")]
fn an_offer_must_have_a_sensible_duration() {
    let mut m = market();
    testing_env!(ctx("buyer.near", 5_000).build());
    m.make_offer(acc("nft.near"), "1".into(), 1_000);
}

#[test]
#[should_panic(expected = "not registered")]
fn offers_on_unregistered_collections_are_refused() {
    let mut m = market();
    testing_env!(ctx("buyer.near", 5_000).build());
    m.make_offer(acc("fake.near"), "1".into(), 86_400_000);
}

#[test]
fn a_new_offer_replaces_the_old_one() {
    let mut m = with_offer();
    testing_env!(ctx("buyer.near", 9_000).block_timestamp(1_000_000_000_000).build());
    m.make_offer(acc("nft.near"), "1".into(), 86_400_000);
    let o = m.offers_for_token(acc("nft.near"), "1".into());
    assert_eq!((o.len(), o[0].amount.0), (1, 9_000));
}

#[test]
fn the_buyer_can_cancel_but_nobody_else() {
    let mut m = with_offer();
    testing_env!(ctx("mallory.near", 0).build());
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| m.cancel_offer(acc("nft.near"), "1".into()))).is_err());
    testing_env!(ctx("buyer.near", 0).build());
    m.cancel_offer(acc("nft.near"), "1".into());
    assert!(m.offers_for_token(acc("nft.near"), "1".into()).is_empty());
}

#[test]
#[should_panic(expected = "not expired yet")]
fn an_unexpired_offer_cannot_be_force_refunded() {
    let mut m = with_offer();
    testing_env!(ctx("anyone.near", 0).block_timestamp(1_000_000_000_000).build());
    m.refund_expired(acc("nft.near"), "1".into(), acc("buyer.near"));
}

#[test]
fn an_expired_offer_can_be_refunded_by_anyone() {
    let mut m = with_offer();
    testing_env!(ctx("anyone.near", 0).block_timestamp(1_000_000_000_000 + 90_000 * 1_000_000_000).build());
    m.refund_expired(acc("nft.near"), "1".into(), acc("buyer.near"));
    assert!(m.offers_for_token(acc("nft.near"), "1".into()).is_empty());
}

#[test]
fn the_owner_accepts_an_offer_through_the_approval_callback() {
    let mut m = with_offer();
    testing_env!(ctx("nft.near", 0).block_timestamp(1_000_000_000_000).build());
    let _ = m.nft_on_approve("1".into(), acc("seller.near"), 3, r#"{"accept_offer":"buyer.near"}"#.into());
    assert!(m.offers_for_token(acc("nft.near"), "1".into()).is_empty());
}

#[test]
#[should_panic(expected = "No such offer")]
fn accepting_a_missing_offer_fails() {
    let mut m = market();
    testing_env!(ctx("nft.near", 0).build());
    let _ = m.nft_on_approve("1".into(), acc("seller.near"), 3, r#"{"accept_offer":"buyer.near"}"#.into());
}

#[test]
#[should_panic(expected = "expired")]
fn an_expired_offer_cannot_be_accepted() {
    let mut m = with_offer();
    testing_env!(ctx("nft.near", 0).block_timestamp(1_000_000_000_000 + 90_000 * 1_000_000_000).build());
    let _ = m.nft_on_approve("1".into(), acc("seller.near"), 3, r#"{"accept_offer":"buyer.near"}"#.into());
}
