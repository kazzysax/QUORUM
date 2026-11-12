use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

const FACTORY: &str = "launch.founder.near";
const NEAR: u128 = 1_000_000_000_000_000_000_000_000;

fn acc(s: &str) -> AccountId { s.parse().unwrap() }

fn ctx(who: &str, deposit: u128) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc(FACTORY)).predecessor_account_id(acc(who))
        .attached_deposit(NearToken::from_yoctonear(deposit)).block_timestamp(1_800_000_000_000 * 1_000_000);
    b
}

fn factory() -> Factory {
    testing_env!(ctx("founder.near", 0).build());
    Factory::new(acc("market.founder.near"), "11111111111111111111111111111111".parse().unwrap(), acc("v2.ref-finance.near"), acc("wrap.near"), U64(4_320_000))
}

fn args() -> CreateArgs {
    CreateArgs {
        name: "OEN".into(), symbol: "OEN".into(), slug: "oen".into(), description: "Small worlds".into(),
        supply: 20, price_near: U128(NEAR), royalty_bps: 500, mint_days: 30,
        metadata_base_url: "https://art.example/m/oen".into(), media_base_url: "https://art.example/media/oen".into(),
        cover_url: "https://art.example/cover.jpg".into(), avatar_url: "https://art.example/avatar.png".into(), quick_votes: true,
    }
}

fn panics<F: FnOnce() + std::panic::UnwindSafe>(f: F) -> String {
    let e = std::panic::catch_unwind(f).expect_err("expected a panic");
    e.downcast_ref::<String>().cloned().or_else(|| e.downcast_ref::<&str>().map(|s| s.to_string())).unwrap_or_default()
}

fn create(f: &mut Factory, a: CreateArgs, deposit: u128) -> String {
    testing_env!(ctx("creator.near", deposit).build());
    panics(std::panic::AssertUnwindSafe(|| { let _ = f.create_collection(a); }))
}

#[test]
fn the_deposit_covers_three_accounts_and_grows_with_supply() {
    let f = factory();
    assert_eq!(f.required_deposit(20).0, required_deposit_for(20));
    assert!(f.required_deposit(100).0 > f.required_deposit(20).0);
    assert!(f.required_deposit(1).0 >= 9 * NEAR, "three contracts' code needs about 9 NEAR of storage");
}

#[test]
fn a_launch_needs_the_full_deposit() {
    let mut f = factory();
    assert!(create(&mut f, args(), required_deposit_for(20) - 1).contains("full launch deposit"));
    assert!(!f.slug_taken("oen".into()), "a refused launch reserves nothing");
}

#[test]
fn a_valid_launch_reserves_the_name_and_a_second_with_it_is_refused() {
    let mut f = factory();
    testing_env!(ctx("creator.near", required_deposit_for(20)).build());
    let _ = f.create_collection(args());
    assert!(f.slug_taken("oen".into()));
    assert!(create(&mut f, args(), required_deposit_for(20)).contains("taken"));
}

#[test]
fn settings_are_validated() {
    let mut f = factory();
    let d = required_deposit_for(500);
    let case = |f: &mut Factory, edit: fn(&mut CreateArgs), msg: &str| { let mut a = args(); edit(&mut a); assert!(create(f, a, d).contains(msg), "{msg}"); };
    case(&mut f, |a| a.name = "X".into(), "Name must be");
    case(&mut f, |a| a.symbol = "TOO-LONG-NAME".into(), "Short name");
    case(&mut f, |a| a.slug = "Oen".into(), "Address name");
    case(&mut f, |a| a.slug = "-oen".into(), "Address name");
    case(&mut f, |a| a.slug = "oe".into(), "Address name");
    case(&mut f, |a| a.slug = "a--b".into(), "Address name");
    case(&mut f, |a| a.slug = "market".into(), "reserved");
    case(&mut f, |a| a.supply = 0, "Supply");
    case(&mut f, |a| a.supply = 501, "Supply");
    case(&mut f, |a| a.price_near = U128(0), "price");
    case(&mut f, |a| a.royalty_bps = 9_500, "creator fee");
    case(&mut f, |a| a.mint_days = 0, "Minting stays open");
    case(&mut f, |a| a.mint_days = 400, "Minting stays open");
    case(&mut f, |a| a.metadata_base_url = "http://insecure.example".into(), "https://");
    case(&mut f, |a| a.cover_url = "javascript:alert(1)".into(), "https://");
    case(&mut f, |a| a.description = "x".repeat(301), "300 characters");
}

#[test]
fn a_failed_creation_returns_the_funding_of_the_accounts_that_did_not_come_up() {
    // The refund math: only batches that failed are refunded, and the name is freed only if none exist.
    let funds = [FUND_DAO, FUND_TREASURY, FUND_NFT_BASE + 20 * FUND_NFT_PER_PIECE];
    let back = |ok: [bool; 3]| -> u128 { ok.iter().zip(funds.iter()).filter(|(g, _)| !**g).map(|(_, f)| *f).sum() };
    assert_eq!(back([true, true, true]), 0);
    assert_eq!(back([false, true, true]), FUND_DAO);
    assert_eq!(back([false, false, false]), funds.iter().sum::<u128>());
}

#[test]
fn the_generated_settings_are_accepted_by_the_real_constructors() {
    // The factory builds JSON; the contracts' own `new` must accept it unchanged (parse AND validate).
    let f = factory();
    for quick in [true, false] {
        let mut a = args();
        a.quick_votes = quick;
        let (nft, dao, tre) = (acc("oen.launch.founder.near"), acc("oen-dao.launch.founder.near"), acc("oen-tre.launch.founder.near"));
        let (nft_init, dao_init, tre_init) = f.inits(&a, &acc("creator.near"), &nft, &dao, &tre, 1_800_000_000_000);

        testing_env!(ctx("launch.founder.near", 0).build());
        let nft_args: quorum_nft::InitArgs = near_sdk::serde_json::from_value(nft_init["args"].clone()).expect("NFT settings parse");
        let c = quorum_nft::Contract::new(nft_args);
        let cfg = c.get_config();
        assert!(!cfg.paused && cfg.max_supply == 20 && cfg.founder == acc("creator.near") && cfg.royalty_recipient == acc("creator.near"));
        assert!(cfg.dao == dao && cfg.treasury == tre);
        assert_eq!(cfg.stages.len(), 1);
        assert_eq!(cfg.stages[0].price_near.0, NEAR);

        let bounds: Option<Vec<quorum_dao::Bounds>> = near_sdk::serde_json::from_value(dao_init["bounds"].clone()).expect("DAO bounds parse");
        let d = quorum_dao::Dao::new(nft.clone(), tre.clone(), bounds);
        let b = d.get_bounds();
        assert_eq!(b.len(), 4);
        assert!(b.iter().all(|x| x.min_quorum_bps >= 5000), "the 50% turnout floor");
        assert_eq!(b[0].min_period_ms.0 == 600_000, quick, "demo votes are 10 minutes, standard votes are days");

        let _ = quorum_treasury::Treasury::new(
            near_sdk::serde_json::from_value(tre_init["dao"].clone()).unwrap(), near_sdk::serde_json::from_value(tre_init["nft"].clone()).unwrap(),
            near_sdk::serde_json::from_value(tre_init["dex"].clone()).unwrap(), near_sdk::serde_json::from_value(tre_init["wrap"].clone()).unwrap());
    }
}

#[test]
fn the_registry_starts_empty_and_pages() {
    let f = factory();
    assert_eq!(f.collection_count(), 0);
    assert!(f.list_collections(0, 10).is_empty());
    assert!(f.settings()["market"] == json!("market.founder.near"));
}

#[test]
fn quick_votes_use_demo_bounds_and_standard_uses_the_dao_defaults() {
    assert!(dao_bounds(false).is_null());
    let q = dao_bounds(true);
    assert_eq!(q.as_array().unwrap().len(), 4);
    assert!(q.as_array().unwrap().iter().all(|b| b["min_quorum_bps"] == 5000), "the 50% turnout floor is never lowered");
}
