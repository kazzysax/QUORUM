use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::testing_env;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

const NFT: &str = "nft.near";
const VAULT: &str = "v1.nft.near";
const TREASURY: &str = "treasury.near";
const USDC: &str = "usdc.near";

fn ctx(predecessor: &str) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc(VAULT))
        .predecessor_account_id(acc(predecessor))
        .prepaid_gas(Gas::from_tgas(300));
    b
}

fn new_vault() -> Vault {
    testing_env!(ctx(NFT).build());
    Vault::new(acc(TREASURY), "1".into())
}

fn usdc() -> AssetId {
    ft_asset(&acc(USDC))
}

#[test]
fn init_by_parent_nft() {
    let v = new_vault();
    let info = v.vault_info();
    assert_eq!(info.nft_contract, acc(NFT));
    assert_eq!(info.status, Status::Active);
    assert!(info.balances.is_empty());
}

#[test]
#[should_panic(expected = "v<token_id> sub-account")]
fn init_by_stranger_is_rejected() {
    testing_env!(ctx("attacker.near").build());
    Vault::new(acc(TREASURY), "1".into());
}

#[test]
#[should_panic(expected = "v<token_id> sub-account")]
fn init_with_wrong_token_id_is_rejected() {
    testing_env!(ctx(NFT).build());
    Vault::new(acc(TREASURY), "2".into());
}

#[test]
fn mint_share_from_nft_is_recorded_without_owner_check() {
    let mut v = new_vault();
    testing_env!(ctx(USDC).build());
    match v.ft_on_transfer(acc(NFT), U128(500), "".into()) {
        PromiseOrValue::Value(refund) => assert_eq!(refund.0, 0),
        _ => panic!("mint share must be recorded synchronously"),
    }
    assert_eq!(v.balances(), vec![(usdc(), U128(500))]);
    assert!(get_logs().iter().any(|l| l.contains("vault_deposit")));
}

#[test]
fn owner_deposit_accepted_after_check() {
    let mut v = new_vault();
    testing_env!(ctx(VAULT).build());
    let refund = v.on_ft_deposit_checked(Ok(true), usdc(), U128(70), acc("owner.near"));
    assert_eq!(refund.0, 0);
    assert_eq!(v.balances(), vec![(usdc(), U128(70))]);
}

#[test]
fn stranger_deposit_refunded_in_full() {
    let mut v = new_vault();
    testing_env!(ctx(VAULT).build());
    let refund = v.on_ft_deposit_checked(Ok(false), usdc(), U128(70), acc("stranger.near"));
    assert_eq!(refund.0, 70);
    assert!(v.balances().is_empty());
}

#[test]
fn failed_ownership_check_refunds() {
    let mut v = new_vault();
    testing_env!(ctx(VAULT).build());
    let refund = v.on_ft_deposit_checked(Err(PromiseError::Failed), usdc(), U128(9), acc("o.near"));
    assert_eq!(refund.0, 9);
}

#[test]
fn asset_cap_refunds_the_tenth_asset_type() {
    let mut v = new_vault();
    testing_env!(ctx(VAULT).build());
    for i in 0..MAX_ASSET_TYPES {
        let a = format!("nep141:t{i}.near");
        assert_eq!(v.on_ft_deposit_checked(Ok(true), a, U128(1), acc("o.near")).0, 0);
    }
    let refund = v.on_ft_deposit_checked(Ok(true), "nep141:extra.near".into(), U128(5), acc("o.near"));
    assert_eq!(refund.0, 5);
    // An asset already held can still be topped up.
    assert_eq!(v.on_ft_deposit_checked(Ok(true), "nep141:t0.near".into(), U128(1), acc("o.near")).0, 0);
}

#[test]
#[should_panic(expected = "Only the NFT contract")]
fn owner_cannot_redeem_directly() {
    let mut v = new_vault();
    testing_env!(ctx("owner.near").build());
    v.redeem(acc("owner.near"));
}

#[test]
fn redeem_moves_backing_out_and_blocks_deposits() {
    let mut v = new_vault();
    testing_env!(ctx(VAULT).build());
    v.on_ft_deposit_checked(Ok(true), usdc(), U128(1_000), acc("o.near"));
    testing_env!(ctx(NFT).build());
    v.redeem(acc("o.near"));
    let info = v.vault_info();
    assert_eq!(info.status, Status::Redeemed { holder: acc("o.near") });
    assert!(info.balances.is_empty());
    assert!(info.awaiting_redeem.is_empty(), "one asset fits in 300 Tgas");

    // Deposits after burn are refunded.
    testing_env!(ctx(VAULT).build());
    assert_eq!(v.on_ft_deposit_checked(Ok(true), usdc(), U128(3), acc("o.near")).0, 3);
    testing_env!(ctx(USDC).build());
    match v.ft_on_transfer(acc(NFT), U128(3), "".into()) {
        PromiseOrValue::Value(r) => assert_eq!(r.0, 3),
        _ => panic!(),
    }
}

#[test]
#[should_panic(expected = "Already redeemed")]
fn double_redeem_fails() {
    let mut v = new_vault();
    testing_env!(ctx(NFT).build());
    v.redeem(acc("o.near"));
    v.redeem(acc("o.near"));
}

#[test]
fn low_gas_redeem_leaves_rest_for_continue_redeem() {
    let mut v = new_vault();
    testing_env!(ctx(VAULT).build());
    for i in 0..5 {
        v.on_ft_deposit_checked(Ok(true), format!("nep141:t{i}.near"), U128(10), acc("o.near"));
    }
    let mut c = ctx(NFT);
    c.prepaid_gas(Gas::from_tgas(80));
    testing_env!(c.build());
    v.redeem(acc("o.near"));
    let left = v.vault_info().awaiting_redeem.len();
    assert!(left > 0 && left < 5, "partial batch, got {left} left");

    testing_env!(ctx("anyone.near").build());
    v.continue_redeem();
    assert!(v.vault_info().awaiting_redeem.is_empty());
}

#[test]
fn failed_payout_becomes_pending_for_recorded_payee() {
    let mut v = new_vault();
    testing_env!(ctx(NFT).build());
    v.redeem(acc("seller.near"));
    testing_env!(ctx(VAULT).build());
    v.on_payout(Err(PromiseError::Failed), usdc(), Payee::Holder, U128(900));
    let p = v.vault_info().pending;
    assert_eq!(p, vec![Pending { asset: usdc(), payee: Payee::Holder, amount: U128(900) }]);

    // Anyone can retry; the payee stays the holder recorded at burn.
    testing_env!(ctx("anyone.near").build());
    v.retry_pending();
    assert!(v.vault_info().pending.is_empty());
}

#[test]
#[should_panic(expected = "Only after redemption")]
fn stray_near_cannot_be_swept_while_active() {
    let mut v = new_vault();
    testing_env!(ctx("anyone.near").build());
    let _ = v.sweep_stray_near();
}

#[test]
fn nft_contract_can_credit_native_near_and_it_counts_as_backing() {
    let mut v = new_vault();
    let mut c = ctx(NFT);
    c.attached_deposit(NearToken::from_near(2));
    testing_env!(c.build());
    v.credit_near();
    assert_eq!(v.balances(), vec![(NATIVE_NEAR.to_string(), U128(2_000_000_000_000_000_000_000_000))]);
}

#[test]
#[should_panic(expected = "Only the NFT contract")]
fn nobody_else_can_credit_the_vault() {
    let mut v = new_vault();
    let mut c = ctx("owner.near");
    c.attached_deposit(NearToken::from_near(1));
    testing_env!(c.build());
    v.credit_near();
}

#[test]
#[should_panic(expected = "Vault is redeemed")]
fn redeemed_vault_refuses_credit() {
    let mut v = new_vault();
    testing_env!(ctx(NFT).build());
    v.redeem(acc("o.near"));
    let mut c = ctx(NFT);
    c.attached_deposit(NearToken::from_near(1));
    testing_env!(c.build());
    v.credit_near();
}
