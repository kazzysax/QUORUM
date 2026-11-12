use super::*;
use crate::merkle;
use crate::settle::MAX_CREDIT_BATCH;
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_sdk::json_types::Base64VecU8;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, Gas, PromiseError, PromiseResult};
use quorum_common::swap::Hop;

const NFT: &str = "nft.near";
const TREASURY: &str = "treasury.near";
const DAO: &str = "dao.near";
const WRAP: &str = "wrap.near";
const DEX: &str = "v2.ref-finance.near";
const T0: u64 = 1_000_000; // ms
const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const STORAGE: u128 = NEAR / 100 * 3; // 0.03 NEAR

fn acc(s: &str) -> AccountId { s.parse().unwrap() }

fn ctx(pred: &str, ms: u64) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc(NFT)).predecessor_account_id(acc(pred))
        .block_timestamp(ms * 1_000_000).block_height(100).prepaid_gas(Gas::from_tgas(300));
    b
}

fn with(b: VMContextBuilder, r: Vec<PromiseResult>) {
    testing_env!(b.build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(), r);
}

fn root() -> ([u8; 32], Vec<Vec<Vec<u8>>>) { merkle::root_of(&["alice.near", "bob.near", "carol.near"]) }

/// Plan: usdc x2, wNEAR x1 -> token numbers 1,2 = usdc, 3 = wNEAR, 4,5 = usdc, 6 = wNEAR ...
fn plan() -> Vec<PlanEntry> {
    vec![PlanEntry { token: acc("usdc.near"), weight: 2 }, PlanEntry { token: acc(WRAP), weight: 1 }]
}

fn config() -> Config {
    Config {
        founder: acc("founder.near"), treasury: acc(TREASURY), dao: acc(DAO),
        vault_allowlist: vec![], vault_code_hash: "11111111111111111111111111111111".parse().unwrap(),
        mint_storage_cost: NearToken::from_yoctonear(STORAGE), max_supply: 6,
        stages: vec![
            Stage { name: "OG".into(), kind: StageKind::Presale, price_near: U128(NEAR), start_ms: U64(T0), end_ms: U64(T0 + 1000),
                    per_wallet_limit: 2, merkle_root: Some(Base64VecU8(root().0.to_vec())) },
            Stage { name: "Public".into(), kind: StageKind::Public, price_near: U128(2 * NEAR), start_ms: U64(T0 + 1000), end_ms: U64(T0 + 5000),
                    per_wallet_limit: 3, merkle_root: None },
        ],
        royalty_bps: 500, royalty_recipient: acc("founder.near"),
        metadata_base_url: "https://api.test".into(), media_base_url: "https://media.test".into(),
        paused: false, provenance_hash: None, asset_plan: plan(), dex: acc(DEX), wrap_account: acc(WRAP),
        settle_grace_ms: U64(3_600_000),
    }
}

fn new_contract() -> Contract {
    testing_env!(ctx("founder.near", T0).build());
    Contract::new(InitArgs {
        metadata: NFTContractMetadata { spec: NFT_METADATA_SPEC.to_string(), name: "Quorum".into(), symbol: "QRM".into(), icon: None, base_uri: None, reference: None, reference_hash: None },
        config: config(),
    })
}

fn proof(i: usize) -> Option<Vec<Base64VecU8>> { Some(root().1[i].iter().cloned().map(Base64VecU8).collect()) }

fn pay(who: &str, ms: u64, yocto: u128) -> VMContextBuilder {
    let mut b = ctx(who, ms);
    b.attached_deposit(NearToken::from_yoctonear(yocto));
    b
}

fn created_ok() -> Vec<PromiseResult> { vec![PromiseResult::Successful(vec![])] }

/// Full mint: the call, then the vault-created callback.
fn mint_public(c: &mut Contract, who: &str, ms: u64) -> String {
    testing_env!(pay(who, ms, 2 * NEAR + STORAGE).build());
    let _ = c.mint(1, None);
    let id = c.minted_total.to_string();
    with(ctx(NFT, ms), created_ok());
    c.on_vault_ready(Ok(()), id.clone(), acc(who), 1, U128(2 * NEAR), group_of(&c.config.asset_plan, c.minted_total));
    id
}

fn mint_presale(c: &mut Contract, who: &str, i: usize, ms: u64) -> String {
    testing_env!(pay(who, ms, NEAR + STORAGE).build());
    let _ = c.mint(0, proof(i));
    let id = c.minted_total.to_string();
    with(ctx(NFT, ms), created_ok());
    c.on_vault_ready(Ok(()), id.clone(), acc(who), 0, U128(NEAR), group_of(&c.config.asset_plan, c.minted_total));
    id
}

fn panics<F: FnOnce() + std::panic::UnwindSafe>(f: F) -> String {
    std::panic::catch_unwind(f).err().map(|e| e.downcast_ref::<String>().cloned().or_else(|| e.downcast_ref::<&str>().map(|s| s.to_string())).unwrap_or_default()).unwrap_or_default()
}

const CLOSED: u64 = T0 + 5_000; // mint closed at this time

// ------------------------------------------------------------------ config

#[test]
fn plan_assets_and_near_are_always_depositable() {
    let c = new_contract();
    let al = &c.get_config().vault_allowlist;
    assert!(al.contains(&"near".to_string()) && al.contains(&"nep141:usdc.near".to_string()) && al.contains(&"nep141:wrap.near".to_string()));
}

#[test]
fn round_robin_assignment_follows_the_weights() {
    let p = plan();
    let groups: Vec<u8> = (1..=7).map(|n| group_of(&p, n)).collect();
    assert_eq!(groups, vec![0, 0, 1, 0, 0, 1, 0]);
}

#[test]
fn config_validation() {
    let mut cfg = config();
    cfg.royalty_bps = 9_600;
    assert!(panics(|| validate_config(&cfg)).contains("exceeds 100%"));
    let mut cfg = config();
    cfg.asset_plan = vec![];
    assert!(panics(|| validate_config(&cfg)).contains("plan assets"));
    let mut cfg = config();
    cfg.asset_plan.push(PlanEntry { token: acc("usdc.near"), weight: 1 });
    assert!(panics(|| validate_config(&cfg)).contains("Duplicate"));
    let mut cfg = config();
    cfg.asset_plan[0].weight = 0;
    assert!(panics(|| validate_config(&cfg)).contains("weights"));
    let mut cfg = config();
    cfg.mint_storage_cost = NearToken::from_millinear(10);
    assert!(panics(|| validate_config(&cfg)).contains("Storage cost too small"));
    let mut cfg = config();
    cfg.stages.reverse();
    assert!(panics(|| crate::mint::validate_stages(&cfg.stages)).contains("Public stage must be last"));
}

#[test]
fn merkle_proofs_verify_only_for_members() {
    let (r, proofs) = root();
    assert!(merkle::verify(&r, "alice.near", &proofs[0]));
    assert!(!merkle::verify(&r, "mallory.near", &proofs[0]));
    assert!(!merkle::verify(&r, "alice.near", &proofs[1]));
}

#[test]
fn merkle_root_matches_the_node_tool() {
    let hex: String = root().0.iter().map(|b| format!("{b:02x}")).collect();
    assert_eq!(hex, "6b93eb7e0612a30134952c1d0e4144240753820bc231899afe52dc22b94149b0");
}

// -------------------------------------------------------------------- mint

#[test]
fn presale_mint_assigns_a_group_and_holds_half_in_escrow() {
    let mut c = new_contract();
    let id = mint_presale(&mut c, "alice.near", 0, T0 + 10);
    assert_eq!(id, "1");
    let st = c.token_state(id.clone()).unwrap().clone();
    assert_eq!((st.group, st.share.0, st.credited), (0, NEAR / 2, false));
    assert_eq!(c.nft_token(id.clone()).unwrap().owner_id, acc("alice.near"));
    assert_eq!(c.groups[0].total_share.0, NEAR / 2);
    assert_eq!(c.live_supply().0, 1);
    assert_eq!(c.vault_of(id), acc("v1.nft.near"));
    assert_eq!(c.pending_mints, 0);
}

#[test]
fn odd_prices_give_the_treasury_the_remainder() {
    let mut c = new_contract();
    c.config.stages[1].price_near = U128(101);
    testing_env!(pay("alice.near", T0 + 1_500, 101 + STORAGE).build());
    let _ = c.mint(1, None);
    with(ctx(NFT, T0 + 1_500), created_ok());
    c.on_vault_ready(Ok(()), "1".into(), acc("alice.near"), 1, U128(101), 0);
    assert_eq!(c.token_state("1".into()).unwrap().share.0, 50, "escrow rounds down; treasury gets 51");
}

#[test]
fn mint_rejections_all_refund_by_panicking() {
    let mut c = new_contract();
    testing_env!(pay("alice.near", T0 + 10, NEAR + STORAGE - 1).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.mint(0, proof(0)); })).contains("Attach the stage price"));
    testing_env!(pay("mallory.near", T0 + 10, NEAR + STORAGE).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.mint(0, proof(0)); })).contains("allowlist"));
    testing_env!(pay("alice.near", T0 - 1, NEAR + STORAGE).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.mint(0, proof(0)); })).contains("not active"));
    testing_env!(pay("alice.near", T0 + 1_000, NEAR + STORAGE).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.mint(0, proof(0)); })).contains("not active"), "presale ended");
    testing_env!(pay("alice.near", T0 + 10, NEAR + STORAGE).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.mint(7, None); })).contains("Unknown stage"));
    assert_eq!(c.minted_total, 0, "rejected mints reserve nothing");
}

#[test]
fn paused_collection_rejects_mints() {
    let mut c = new_contract();
    c.config.paused = true;
    testing_env!(pay("alice.near", T0 + 10, NEAR + STORAGE).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.mint(0, proof(0)); })).contains("paused"));
}

#[test]
fn wallet_limit_is_per_stage_and_public_stage_is_additive() {
    let mut c = new_contract();
    mint_presale(&mut c, "alice.near", 0, T0 + 10);
    mint_presale(&mut c, "alice.near", 0, T0 + 20);
    testing_env!(pay("alice.near", T0 + 30, NEAR + STORAGE).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.mint(0, proof(0)); })).contains("Wallet limit"));
    mint_public(&mut c, "alice.near", T0 + 1_500);
    assert_eq!(c.mints_by(0, acc("alice.near")), 2);
    assert_eq!(c.mints_by(1, acc("alice.near")), 1);
}

#[test]
fn sold_out_closes_the_mint() {
    let mut c = new_contract();
    for (i, w) in ["a.near", "b.near", "c.near", "d.near", "e.near", "f.near"].iter().enumerate() {
        mint_public(&mut c, w, T0 + 1_500 + i as u64);
    }
    assert_eq!(c.live_supply().0, 6);
    testing_env!(pay("g.near", T0 + 2_000, 2 * NEAR + STORAGE).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.mint(1, None); })).contains("Sold out"));
    assert!(c.mint_closed(), "closed by selling out, before the last stage ends");
    assert_eq!(c.mint_closed_at_ms().unwrap().0, T0 + 1_505);
}

#[test]
fn failed_vault_creation_releases_the_slot() {
    let mut c = new_contract();
    testing_env!(pay("alice.near", T0 + 10, NEAR + STORAGE).build());
    let _ = c.mint(0, proof(0));
    assert_eq!((c.minted_total, c.pending_mints, c.mints_by(0, acc("alice.near"))), (1, 1, 1));
    with(ctx(NFT, T0 + 10), vec![PromiseResult::Failed]);
    c.on_vault_ready(Err(PromiseError::Failed), "1".into(), acc("alice.near"), 0, U128(NEAR), 0);
    assert_eq!((c.minted_total, c.pending_mints, c.mints_by(0, acc("alice.near"))), (0, 0, 0));
    assert!(c.nft_token("1".into()).is_none());
    assert_eq!(c.groups[0].total_share.0, 0);
}

// ----------------------------------------------------- ownership & transfer

#[test]
fn can_deposit_rules_owner_only_and_allowlisted() {
    let mut c = new_contract();
    let id = mint_public(&mut c, "alice.near", T0 + 1_500);
    assert!(c.can_deposit(id.clone(), acc("alice.near"), "near".into()));
    assert!(c.can_deposit(id.clone(), acc("alice.near"), "nep141:usdc.near".into()));
    assert!(!c.can_deposit(id.clone(), acc("bob.near"), "near".into()), "stranger");
    assert!(!c.can_deposit(id.clone(), acc("alice.near"), "nep141:spam.near".into()), "spam token");
}

#[test]
fn transfer_moves_ownership_and_resets_vote_eligibility() {
    let mut c = new_contract();
    let id = mint_public(&mut c, "alice.near", T0 + 1_500);
    let mut b = ctx("alice.near", T0 + 1_600);
    b.attached_deposit(NearToken::from_yoctonear(1)).block_height(250);
    testing_env!(b.build());
    c.nft_transfer(acc("bob.near"), id.clone(), None, None);
    assert_eq!(c.token_state(id.clone()).unwrap().last_transfer_block.0, 250);
    assert!(c.can_deposit(id.clone(), acc("bob.near"), "near".into()));
    assert!(!c.can_deposit(id, acc("alice.near"), "near".into()), "old owner loses control");
}

#[test]
fn vote_requires_ownership_and_is_capped() {
    let mut c = new_contract();
    let id = mint_public(&mut c, "alice.near", T0 + 1_500);
    testing_env!(ctx("mallory.near", T0 + 1_600).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.vote(1, vec![id.clone()], 1); })).contains("Not the owner"));
    testing_env!(ctx("alice.near", T0 + 1_600).build());
    let _ = c.vote(1, vec![id], 1);
    let many: Vec<String> = (0..16).map(|i| i.to_string()).collect();
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.vote(1, many, 1); })).contains("1 to 15"));
}

#[test]
fn only_holders_or_the_founder_can_propose() {
    let mut c = new_contract();
    testing_env!(ctx("mallory.near", T0).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.propose(near_sdk::serde_json::json!("Text"), "p".into(), U64(1), 1000, 5000, U64(1)); })).contains("Only holders"));
    mint_public(&mut c, "alice.near", T0 + 1_500);
    testing_env!(ctx("alice.near", T0 + 1_600).build());
    let _ = c.propose(near_sdk::serde_json::json!("Text"), "p".into(), U64(1), 1000, 5000, U64(1));
    testing_env!(ctx("founder.near", T0 + 1_600).build());
    let _ = c.propose(near_sdk::serde_json::json!("Text"), "p".into(), U64(1), 1000, 5000, U64(1));
}

// -------------------------------------------------------------- settlement

fn hop(pool: u64, t: &str) -> Hop { Hop { pool_id: pool, token_out: acc(t) } }

/// Two usdc NFTs (shares 0.5 and 1 NEAR) and one wNEAR NFT, mint closed.
fn closed_collection() -> Contract {
    let mut c = new_contract();
    mint_presale(&mut c, "alice.near", 0, T0 + 10); // #1 usdc, share 0.5
    mint_public(&mut c, "bob.near", T0 + 1_500);    // #2 usdc, share 1
    mint_public(&mut c, "carol.near", T0 + 1_600);  // #3 wNEAR, share 1
    c
}

#[test]
fn a_dex_settle_is_dao_only_and_only_after_the_mint_closes() {
    let mut c = closed_collection();
    testing_env!(ctx("founder.near", CLOSED).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.settle_group(0, vec![hop(1, "usdc.near")], U128(1)); })).contains("Only the DAO"));
    testing_env!(ctx(DAO, T0 + 4_000).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.settle_group(0, vec![hop(1, "usdc.near")], U128(1)); })).contains("still open"));
}

#[test]
fn anyone_settles_a_wnear_group_without_a_vote_once_the_mint_closes() {
    let mut c = closed_collection();
    // Not while the mint is open, not even the DAO.
    testing_env!(ctx("stranger.near", T0 + 4_000).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.settle_group(1, vec![], U128(0)); })).contains("still open"));
    // After it closes, any account may wrap the wNEAR group's escrow...
    testing_env!(ctx("stranger.near", CLOSED).build());
    let _ = c.settle_group(1, vec![], U128(0));
    assert_eq!(c.groups[1].phase, Phase::Swapping);
    // ...and the result is still only what really arrived, 1:1.
    with(ctx(NFT, CLOSED), created_ok());
    let _ = c.on_before_wrap(Ok(U128(0)), 1, U128(NEAR));
    c.on_after(Ok(U128(NEAR)), 1, U128(0), U128(NEAR));
    assert_eq!((c.groups[1].phase.clone(), c.groups[1].out_total.0), (Phase::Swapped, NEAR));
    // A DEX group in the same collection still needs the DAO.
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.settle_group(0, vec![hop(1, "usdc.near")], U128(5)); })).contains("Only the DAO"));
}

#[test]
fn settle_validates_the_route_and_the_minimum() {
    let mut c = closed_collection();
    testing_env!(ctx(DAO, CLOSED).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.settle_group(0, vec![hop(1, "eth.near")], U128(5)); })).contains("end in the group's asset"));
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.settle_group(0, vec![hop(1, "usdc.near")], U128(0)); })).contains("minimum output is required"));
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.settle_group(1, vec![hop(1, "wrap.near")], U128(5)); })).contains("needs no route"));
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.settle_group(9, vec![], U128(5)); })).contains("Unknown group"));
    assert_eq!(c.groups[0].phase, Phase::Pending, "rejected calls change nothing");
}

#[test]
fn settle_waits_for_in_flight_mints() {
    let mut c = new_contract();
    mint_presale(&mut c, "alice.near", 0, T0 + 10);
    testing_env!(pay("bob.near", T0 + 1_500, 2 * NEAR + STORAGE).build());
    let _ = c.mint(1, None); // vault still being created
    testing_env!(ctx(DAO, CLOSED).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.settle_group(0, vec![hop(1, "usdc.near")], U128(5)); })).contains("still being created"));
}

#[test]
fn a_swap_moves_the_group_to_swapping_and_a_second_call_is_refused() {
    let mut c = closed_collection();
    testing_env!(ctx(DAO, CLOSED).build());
    let _ = c.settle_group(0, vec![hop(1, "usdc.near")], U128(5));
    assert_eq!(c.groups[0].phase, Phase::Swapping);
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.settle_group(0, vec![hop(1, "usdc.near")], U128(5)); })).contains("not waiting"));
}

#[test]
fn failed_balance_check_or_empty_swap_returns_the_group_to_pending() {
    let mut c = closed_collection();
    testing_env!(ctx(DAO, CLOSED).build());
    let _ = c.settle_group(0, vec![hop(1, "usdc.near")], U128(5));
    with(ctx(NFT, CLOSED), vec![PromiseResult::Failed]);
    let _ = c.on_before(Err(PromiseError::Failed), 0, vec![hop(1, "usdc.near")], U128(5), U128(NEAR * 3 / 2));
    assert_eq!(c.groups[0].phase, Phase::Pending);
    c.groups[0].phase = Phase::Swapping;
    c.on_after(Ok(U128(1_000)), 0, U128(1_000), U128(1)); // balance unchanged: the DEX reverted
    assert_eq!(c.groups[0].phase, Phase::Pending);
    c.groups[0].phase = Phase::Swapping;
    c.on_after(Err(PromiseError::Failed), 0, U128(1_000), U128(1));
    assert_eq!(c.groups[0].phase, Phase::Pending);
}

#[test]
fn a_successful_swap_records_exactly_what_arrived() {
    let mut c = closed_collection();
    c.groups[0].phase = Phase::Swapping;
    with(ctx(NFT, CLOSED), vec![]);
    c.on_after(Ok(U128(5_000_400)), 0, U128(5_000_000), U128(400));
    let g = &c.groups[0];
    assert_eq!((g.phase.clone(), g.out_total.0, g.swap_share.0), (Phase::Swapped, 400, NEAR / 2 + NEAR));
}

#[test]
fn a_wnear_group_settles_by_wrapping_one_to_one() {
    let mut c = closed_collection();
    testing_env!(ctx(DAO, CLOSED).build());
    let _ = c.settle_group(1, vec![], U128(0));
    assert_eq!(c.groups[1].phase, Phase::Swapping);
    with(ctx(NFT, CLOSED), created_ok());
    let _ = c.on_before_wrap(Ok(U128(7)), 1, U128(NEAR));
    c.on_after(Ok(U128(7 + NEAR)), 1, U128(7), U128(NEAR));
    assert_eq!((c.groups[1].phase.clone(), c.groups[1].out_total.0), (Phase::Swapped, NEAR));
}

// ---------------------------------------------------------------- crediting

fn swapped(c: &mut Contract, out: u128) {
    c.groups[0].phase = Phase::Swapping;
    with(ctx(NFT, CLOSED), vec![]);
    c.on_after(Ok(U128(out)), 0, U128(0), U128(1));
}

#[test]
fn crediting_is_pro_rata_by_escrow_share() {
    let mut c = closed_collection();
    swapped(&mut c, 3_000_000); // shares 0.5 : 1 -> 1_000_000 : 2_000_000
    testing_env!(ctx("anyone.near", CLOSED).build());
    let _ = c.credit_batch(0, vec!["1".into(), "2".into()]);
    assert!(c.token_state("1".into()).unwrap().credited && c.token_state("2".into()).unwrap().credited);
    // The vault-credit callbacks report what landed.
    with(ctx(NFT, CLOSED), vec![PromiseResult::Successful(vec![])]);
    c.on_credited(Ok(U128(1_000_000)), "1".into(), U128(1_000_000));
    assert!(c.token_state("1".into()).unwrap().credited);
}

#[test]
fn a_refused_credit_can_be_retried() {
    let mut c = closed_collection();
    swapped(&mut c, 3_000_000);
    testing_env!(ctx("anyone.near", CLOSED).build());
    let _ = c.credit_batch(0, vec!["1".into()]);
    with(ctx(NFT, CLOSED), vec![]);
    c.on_credited(Ok(U128(0)), "1".into(), U128(1_000_000)); // vault gave it all back
    assert!(!c.token_state("1".into()).unwrap().credited);
    c.on_credited(Err(PromiseError::Failed), "1".into(), U128(1_000_000));
    assert!(!c.token_state("1".into()).unwrap().credited);
}

#[test]
fn crediting_rules() {
    let mut c = closed_collection();
    testing_env!(ctx("anyone.near", CLOSED).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.credit_batch(0, vec!["1".into()]); })).contains("not ready"), "not swapped yet");
    swapped(&mut c, 3_000_000);
    testing_env!(ctx("anyone.near", CLOSED).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.credit_batch(0, vec!["3".into()]); })).contains("different group"));
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.credit_batch(0, vec![]); })).contains("1 to 3"));
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.credit_batch(0, (0..4).map(|i| i.to_string()).collect()); })).contains("1 to 3"));
    let _ = c.credit_batch(0, vec!["1".into()]);
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.credit_batch(0, vec!["1".into()]); })).contains("Already credited"));
    assert_eq!(MAX_CREDIT_BATCH, 3);
}

#[test]
fn fallback_needs_the_grace_period_and_then_credits_plain_near() {
    let mut c = closed_collection();
    testing_env!(ctx("anyone.near", CLOSED + 3_599_999).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| c.enable_fallback(0))).contains("grace period"));
    testing_env!(ctx("anyone.near", T0 + 4_000).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| c.enable_fallback(0))).contains("still open"));
    testing_env!(ctx("anyone.near", CLOSED + 3_600_000).build());
    c.enable_fallback(0);
    assert_eq!(c.groups[0].phase, Phase::Fallback);
    let _ = c.credit_batch(0, vec!["1".into(), "2".into()]);
    assert!(c.token_state("2".into()).unwrap().credited);
    assert!(panics(std::panic::AssertUnwindSafe(|| c.enable_fallback(0))).contains("not waiting"));
    // A group that is mid-swap cannot be force-fallen-back.
    c.groups[1].phase = Phase::Swapping;
    assert!(panics(std::panic::AssertUnwindSafe(|| c.enable_fallback(1))).contains("not waiting"));
}

#[test]
fn settlement_status_lists_every_group() {
    let c = closed_collection();
    let s = c.settlement_status();
    assert_eq!(s.len(), 2);
    assert_eq!((s[0].asset.clone(), s[0].total_share.0), (acc("usdc.near"), NEAR / 2 + NEAR));
    assert_eq!(c.asset_for_number(3), acc(WRAP));
}

// --------------------------------------------------------------------- burn

fn burn_ctx(who: &str, ms: u64) { let mut b = ctx(who, ms); b.attached_deposit(NearToken::from_yoctonear(1)); testing_env!(b.build()); }

#[test]
fn burning_before_settlement_refunds_escrow_in_near() {
    let mut c = closed_collection();
    burn_ctx("alice.near", T0 + 2_000);
    let _ = c.burn_and_redeem("1".into());
    assert!(c.nft_token("1".into()).is_none());
    assert_eq!(c.live_supply().0, 2);
    assert_eq!(c.groups[0].total_share.0, NEAR, "the burned share leaves the group's escrow");
    assert!(c.token_state("1".into()).unwrap().burned);
    assert!(c.nft_traits("1".into()).is_none());
    assert!(!c.can_deposit("1".into(), acc("alice.near"), "near".into()));
    assert_eq!(c.nft_supply_for_owner(acc("alice.near")).0, 0);
}

#[test]
fn burn_pays_ninety_percent_to_the_holder_and_ten_to_the_treasury() {
    let (h, p) = quorum_common::redeem_split(NEAR / 2);
    assert_eq!((h, p), (NEAR / 2 / 10 * 9, NEAR / 2 / 10));
    assert_eq!(h + p, NEAR / 2);
}

#[test]
fn burn_waits_while_a_swap_is_in_flight() {
    let mut c = closed_collection();
    c.groups[0].phase = Phase::Swapping;
    burn_ctx("alice.near", CLOSED);
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.burn_and_redeem("1".into()); })).contains("swap is in progress"));
    assert!(c.nft_token("1".into()).is_some(), "a refused burn changes nothing");
}

#[test]
fn after_settlement_burn_needs_the_vault_credited_first() {
    let mut c = closed_collection();
    swapped(&mut c, 3_000_000);
    burn_ctx("alice.near", CLOSED);
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.burn_and_redeem("1".into()); })).contains("Credit this NFT's vault first"));
    c.token_state.get_mut("1").unwrap().credited = true;
    burn_ctx("alice.near", CLOSED);
    let _ = c.burn_and_redeem("1".into()); // now the vault pays out 90/10 per asset
    assert!(c.nft_token("1".into()).is_none());
}

#[test]
fn burn_rules_owner_only_and_once() {
    let mut c = closed_collection();
    burn_ctx("mallory.near", CLOSED);
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.burn_and_redeem("1".into()); })).contains("Only the owner"));
    burn_ctx("alice.near", CLOSED);
    let _ = c.burn_and_redeem("1".into());
    burn_ctx("alice.near", CLOSED);
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.burn_and_redeem("1".into()); })).contains("Unknown token"));
    testing_env!(ctx("alice.near", CLOSED).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.vote(1, vec!["1".into()], 1); })).contains("Token is burned"), "burned tokens cannot vote");
}

// ------------------------------------------------------------------- params

#[test]
fn only_the_dao_sets_params() {
    let mut c = new_contract();
    testing_env!(ctx("founder.near", T0).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| c.set_param("paused".into(), "true".into()))).contains("Only the DAO"));
    testing_env!(ctx(DAO, T0).build());
    c.set_param("paused".into(), "true".into());
    assert!(c.get_config().paused);
    c.set_param("dex".into(), "dex2.near".into());
    assert_eq!(c.get_config().dex, acc("dex2.near"));
    c.set_param("vault_allowlist_add".into(), "nep141:eth.near".into());
    c.set_param("vault_allowlist_remove".into(), "nep141:eth.near".into());
    assert!(panics(std::panic::AssertUnwindSafe(|| c.set_param("vault_allowlist_remove".into(), "nep141:usdc.near".into()))).contains("must stay"));
    assert!(panics(std::panic::AssertUnwindSafe(|| c.set_param("vault_allowlist_remove".into(), "near".into()))).contains("must stay"));
    assert!(panics(std::panic::AssertUnwindSafe(|| c.set_param("royalty_bps".into(), "9600".into()))).contains("exceeds 100%"));
    assert!(panics(std::panic::AssertUnwindSafe(|| c.set_param("asset_plan".into(), "x".into()))).contains("Unknown parameter"));
}

#[test]
fn founder_powers_are_narrow() {
    let mut c = new_contract();
    testing_env!(ctx("founder.near", T0).build());
    c.lower_royalty(100);
    assert!(panics(std::panic::AssertUnwindSafe(|| c.lower_royalty(900))).contains("Can only lower"));
    c.set_paused(true);
    c.set_vault_code_hash("11111111111111111111111111111112".parse().unwrap());
    testing_env!(ctx("mallory.near", T0).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| c.set_paused(false))).contains("founder or the DAO"));
    testing_env!(ctx("founder.near", T0).build());
    c.set_paused(false);
    mint_public(&mut c, "alice.near", T0 + 1_500);
    testing_env!(ctx("founder.near", T0).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| c.set_vault_code_hash("11111111111111111111111111111113".parse().unwrap()))).contains("Locked"));
}

#[test]
fn nobody_can_change_the_asset_plan() {
    let c = new_contract();
    assert_eq!(c.get_config().asset_plan, plan());
}

#[test]

#[test]
fn only_the_dao_can_unwrap_wnear() {
    let mut c = new_contract();
    let mut b = ctx("anyone.near", T0);
    b.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(b.build());
    assert!(panics(std::panic::AssertUnwindSafe(|| { let _ = c.unwrap_wnear(U128(5)); })).contains("Only the DAO"));
    let mut b = ctx(DAO, T0);
    b.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(b.build());
    let _ = c.unwrap_wnear(U128(5));
}

#[test]
fn a_dust_donation_below_min_out_does_not_count_as_a_swap() {
    let mut c = closed_collection();
    c.groups[0].phase = Phase::Swapping;
    with(ctx(NFT, CLOSED), vec![]);
    // 1 unit arrived (a donation), but holders approved at least 400.
    c.on_after(Ok(U128(5_000_001)), 0, U128(5_000_000), U128(400));
    assert_eq!(c.groups[0].phase, Phase::Pending);
    assert_eq!(c.groups[0].out_total.0, 0);
}

#[test]
fn a_stuck_swap_can_be_aborted_only_after_the_timeout() {
    let mut c = closed_collection();
    testing_env!(ctx(DAO, CLOSED).build());
    let _ = c.settle_group(0, vec![hop(1, "usdc.near")], U128(5));
    testing_env!(ctx("anyone.near", CLOSED + 1_000).build());
    assert!(panics(std::panic::AssertUnwindSafe(|| c.abort_swap(0))).contains("may still be in flight"));
    testing_env!(ctx("anyone.near", CLOSED + crate::settle::SWAP_TIMEOUT_MS).build());
    c.abort_swap(0);
    assert_eq!(c.groups[0].phase, Phase::Pending);
    assert!(panics(std::panic::AssertUnwindSafe(|| c.abort_swap(0))).contains("No swap in progress"));
}

#[test]
fn settlement_grace_below_one_hour_is_refused() {
    let mut cfg = config();
    cfg.settle_grace_ms = U64(10_000);
    assert!(panics(std::panic::AssertUnwindSafe(|| validate_config(&cfg))).contains("at least one hour"));
}
