//! quorum-factory: self-serve collection launches.
//!
//! One call to `create_collection` makes a whole collection: its NFT, DAO and treasury, each a NEAR
//! sub-account of this factory that is created, funded, loaded with the audited contract code and
//! initialised in a single batch. NO access key is ever added, so once created nobody (not the creator,
//! not the factory's deployer) can change those contracts' code or move their funds outside their rules.
//!
//! * The code is embedded in this contract (`include_bytes!`), so a collection can only ever run the real
//!   Quorum contracts, never a lookalike.
//! * The factory has no owner and no admin method. Its settings are fixed when it is created.
//! * The creator pays for the accounts' storage with the NEAR they attach. The collection's founder and
//!   resale-fee recipient is the creator.
//! * After creation the collection is registered on the shared market and added to the public list that
//!   the app reads, so it shows up with no manual step.

use near_sdk::json_types::{Base58CryptoHash, U128, U64};
use near_sdk::serde_json::{json, to_vec, Value};
use near_sdk::store::{LookupSet, Vector};
use near_sdk::{env, ext_contract, near, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseResult};
use quorum_common::events::emit;
use quorum_common::{fail, require};

const NFT_WASM: &[u8] = include_bytes!("../../../res/quorum_nft_opt.wasm");
const DAO_WASM: &[u8] = include_bytes!("../../../res/quorum_dao_opt.wasm");
const TREASURY_WASM: &[u8] = include_bytes!("../../../res/quorum_treasury_opt.wasm");

const GAS_INIT_NFT: Gas = Gas::from_tgas(30);
const GAS_INIT_SMALL: Gas = Gas::from_tgas(20);
const GAS_CALLBACK: Gas = Gas::from_tgas(40);
const GAS_REGISTER: Gas = Gas::from_tgas(15);

/// Storage the three accounts need (their code plus a working buffer), in yoctoNEAR.
const FUND_NFT_BASE: u128 = 4_600_000_000_000_000_000_000_000; // 4.6 NEAR
const FUND_NFT_PER_PIECE: u128 = 10_000_000_000_000_000_000_000; // 0.01 NEAR per piece
const FUND_DAO: u128 = 2_300_000_000_000_000_000_000_000; // 2.3 NEAR
const FUND_TREASURY: u128 = 2_300_000_000_000_000_000_000_000; // 2.3 NEAR
const MAX_SUPPLY: u32 = 500;
const DAY_MS: u64 = 86_400_000;
/// Words that would make a confusing collection address.
const RESERVED: [&str; 6] = ["market", "factory", "launch", "vault", "quorum", "admin"];

#[ext_contract(ext_market)]
pub trait Market {
    fn register_collection(&mut self, nft: AccountId);
}

#[near(serializers = [json])]
pub struct CreateArgs {
    pub name: String,
    pub symbol: String,
    /// Becomes the address: `<slug>.<factory>`, `<slug>-dao.<factory>`, `<slug>-tre.<factory>`.
    pub slug: String,
    pub description: String,
    pub supply: u32,
    /// Price of one mint, in yoctoNEAR.
    pub price_near: U128,
    /// Creator fee on resales, in basis points (500 = 5%).
    pub royalty_bps: u16,
    /// How long minting stays open, starting now.
    pub mint_days: u32,
    /// Where the per-piece metadata files live (`<url>/<number>.json`).
    pub metadata_base_url: String,
    /// Where the per-piece pictures live (`<url>/<number>`).
    pub media_base_url: String,
    pub cover_url: String,
    pub avatar_url: String,
    /// Demo-length votes (10 minutes) instead of the standard 3 to 5 days.
    pub quick_votes: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct CollectionRecord {
    pub slug: String,
    pub name: String,
    pub symbol: String,
    pub description: String,
    pub creator: AccountId,
    pub nft: AccountId,
    pub dao: AccountId,
    pub treasury: AccountId,
    pub metadata_base_url: String,
    pub media_base_url: String,
    pub cover_url: String,
    pub avatar_url: String,
    pub supply: u32,
    pub price_near: U128,
    pub created_ms: U64,
}

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum Key { Collections, Slugs }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Factory {
    market: AccountId,
    vault_code_hash: Base58CryptoHash,
    dex: AccountId,
    wrap: AccountId,
    settle_grace_ms: U64,
    collections: Vector<CollectionRecord>,
    slugs: LookupSet<String>,
}

/// Total NEAR a creator must attach for a collection of `supply` pieces.
pub fn required_deposit_for(supply: u32) -> u128 {
    FUND_NFT_BASE + FUND_NFT_PER_PIECE * supply as u128 + FUND_DAO + FUND_TREASURY
}

fn valid_slug(s: &str) -> bool {
    let b = s.as_bytes();
    (3..=16).contains(&b.len())
        && b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-')
        && b[0] != b'-' && b[b.len() - 1] != b'-' && !s.contains("--")
}

fn short_text(s: &str, min: usize, max: usize) -> bool {
    let n = s.trim().chars().count();
    n >= min && n <= max
}

fn dao_bounds(quick: bool) -> Value {
    if !quick { return Value::Null; } // the DAO's own defaults: 3 to 5 day votes, 50% turnout
    let b = |period: u64, pass: u16, lock: u64| json!({ "min_period_ms": period.to_string(), "min_quorum_bps": 5000, "min_pass_bps": pass, "min_timelock_ms": lock.to_string() });
    json!([b(600_000, 5000, 60_000), b(600_000, 5000, 60_000), b(900_000, 6000, 120_000), b(300_000, 5000, 0)])
}

#[near]
impl Factory {
    #[init]
    pub fn new(market: AccountId, vault_code_hash: Base58CryptoHash, dex: AccountId, wrap: AccountId, settle_grace_ms: U64) -> Self {
        Self { market, vault_code_hash, dex, wrap, settle_grace_ms, collections: Vector::new(Key::Collections), slugs: LookupSet::new(Key::Slugs) }
    }

    /// Creates a collection. Attach `required_deposit(supply)` NEAR; any excess is returned.
    #[payable]
    pub fn create_collection(&mut self, args: CreateArgs) -> Promise {
        let creator = env::predecessor_account_id();
        require!(short_text(&args.name, 2, 40), "Name must be 2 to 40 characters");
        require!(short_text(&args.symbol, 2, 8) && args.symbol.chars().all(|c| c.is_ascii_alphanumeric()), "Short name must be 2 to 8 letters or digits");
        require!(valid_slug(&args.slug), "Address name must be 3 to 16 lowercase letters, digits or hyphens");
        require!(!RESERVED.contains(&args.slug.as_str()), "That address name is reserved");
        require!(args.description.chars().count() <= 300, "Description is at most 300 characters");
        require!(args.supply >= 1 && args.supply <= MAX_SUPPLY, "Supply must be 1 to 500 pieces");
        require!(args.price_near.0 > 0, "The mint price must be above zero");
        require!(args.royalty_bps <= 9_000, "The creator fee is at most 90%");
        require!(args.mint_days >= 1 && args.mint_days <= 365, "Minting stays open for 1 to 365 days");
        for u in [&args.metadata_base_url, &args.media_base_url, &args.cover_url, &args.avatar_url] {
            require!(u.starts_with("https://") && u.len() <= 200, "Links must start with https:// and be at most 200 characters");
        }
        let need = required_deposit_for(args.supply);
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit >= need, "Attach the full launch deposit (see required_deposit)");
        require!(!self.slugs.contains(&args.slug), "That address name is taken");
        self.slugs.insert(args.slug.clone());

        let me = env::current_account_id();
        let acct = |suffix: &str| -> AccountId { format!("{}{}.{}", args.slug, suffix, me).parse().unwrap_or_else(|_| fail("Invalid address name")) };
        let (nft, dao, treasury) = (acct(""), acct("-dao"), acct("-tre"));
        let now = env::block_timestamp_ms();
        let fund_nft = FUND_NFT_BASE + FUND_NFT_PER_PIECE * args.supply as u128;

        let (nft_init, dao_init, tre_init) = self.inits(&args, &creator, &nft, &dao, &treasury, now);

        // Three independent batches: create the account, fund it, load the code, run `new`. No key is added.
        let make = |id: &AccountId, fund: u128, code: &[u8], init: Value, gas: Gas| {
            Promise::new(id.clone()).create_account().transfer(NearToken::from_yoctonear(fund))
                .deploy_contract(code.to_vec())
                .function_call("new".to_string(), to_vec(&init).unwrap(), NearToken::from_yoctonear(0), gas)
        };
        let created = make(&dao, FUND_DAO, DAO_WASM, dao_init, GAS_INIT_SMALL)
            .and(make(&treasury, FUND_TREASURY, TREASURY_WASM, tre_init, GAS_INIT_SMALL))
            .and(make(&nft, fund_nft, NFT_WASM, nft_init, GAS_INIT_NFT));

        let record = CollectionRecord {
            slug: args.slug, name: args.name.trim().to_string(), symbol: args.symbol.trim().to_uppercase(), description: args.description.trim().to_string(),
            creator: creator.clone(), nft, dao, treasury,
            metadata_base_url: args.metadata_base_url, media_base_url: args.media_base_url, cover_url: args.cover_url, avatar_url: args.avatar_url,
            supply: args.supply, price_near: args.price_near, created_ms: U64(now),
        };
        // Anything attached beyond the three accounts' funding goes back to the creator.
        if deposit > need {
            Promise::new(creator.clone()).transfer(NearToken::from_yoctonear(deposit - need)).detach();
        }
        created.then(Self::ext(me).with_static_gas(GAS_CALLBACK).on_created(record, [FUND_DAO, FUND_TREASURY, fund_nft].map(U128).to_vec()))
    }

    #[private]
    pub fn on_created(&mut self, record: CollectionRecord, funds: Vec<U128>) {
        // Results arrive in the order the batches were joined: DAO, treasury, NFT.
        let ok: Vec<bool> = (0..env::promise_results_count()).map(|i| matches!(env::promise_result(i), PromiseResult::Successful(_))).collect();
        if ok.len() == 3 && ok.iter().all(|x| *x) {
            ext_market::ext(self.market.clone()).with_static_gas(GAS_REGISTER).register_collection(record.nft.clone()).detach();
            emit("collection_created", json!({ "slug": record.slug, "creator": record.creator, "nft": record.nft, "dao": record.dao, "treasury": record.treasury }));
            self.collections.push(record);
            return;
        }
        // A batch that failed was rolled back and its funding came back here: return it to the creator.
        let back: u128 = ok.iter().zip(funds.iter()).filter(|(good, _)| !**good).map(|(_, f)| f.0).sum();
        if ok.iter().all(|x| !*x) { self.slugs.remove(&record.slug); } // nothing exists, so the name is free again
        if back > 0 { Promise::new(record.creator.clone()).transfer(NearToken::from_yoctonear(back)).detach(); }
        emit("collection_failed", json!({ "slug": record.slug, "creator": record.creator, "refunded": U128(back) }));
    }

    // ----------------------------------------------------------------- views
    pub fn required_deposit(&self, supply: u32) -> U128 { U128(required_deposit_for(supply)) }
    pub fn collection_count(&self) -> u64 { self.collections.len() as u64 }
    pub fn list_collections(&self, from_index: u64, limit: u64) -> Vec<CollectionRecord> {
        (from_index..(self.collections.len() as u64)).take(limit as usize).filter_map(|i| self.collections.get(i as u32).cloned()).collect()
    }
    pub fn slug_taken(&self, slug: String) -> bool { self.slugs.contains(&slug) }
    pub fn settings(&self) -> Value {
        json!({ "market": self.market, "vault_code_hash": self.vault_code_hash, "dex": self.dex, "wrap": self.wrap, "settle_grace_ms": self.settle_grace_ms })
    }
}

impl Factory {
    /// The `new` arguments of the three contracts, exactly as each one's constructor reads them.
    pub(crate) fn inits(&self, args: &CreateArgs, creator: &AccountId, nft: &AccountId, dao: &AccountId, treasury: &AccountId, now: u64) -> (Value, Value, Value) {
        let nft_init = json!({ "args": {
            "metadata": { "spec": "nft-1.0.0", "name": args.name.trim(), "symbol": args.symbol.trim().to_uppercase(), "icon": null, "base_uri": null, "reference": null, "reference_hash": null },
            "config": {
                "founder": creator, "treasury": treasury, "dao": dao,
                "vault_allowlist": [], "vault_code_hash": self.vault_code_hash,
                "mint_storage_cost": "30000000000000000000000",
                "max_supply": args.supply,
                "stages": [{ "name": "Public", "kind": "Public", "price_near": args.price_near,
                             "start_ms": (now.saturating_sub(60_000)).to_string(), "end_ms": (now + args.mint_days as u64 * DAY_MS).to_string(),
                             "per_wallet_limit": args.supply, "merkle_root": null }],
                "royalty_bps": args.royalty_bps, "royalty_recipient": creator,
                "metadata_base_url": args.metadata_base_url, "media_base_url": args.media_base_url,
                "paused": false, "provenance_hash": null,
                "asset_plan": [{ "token": self.wrap, "weight": 1 }],
                "dex": self.dex, "wrap_account": self.wrap,
                "settle_grace_ms": self.settle_grace_ms,
            } } });
        let dao_init = json!({ "nft": nft, "treasury": treasury, "bounds": dao_bounds(args.quick_votes) });
        let tre_init = json!({ "dao": dao, "nft": nft, "dex": self.dex, "wrap": self.wrap });
        (nft_init, dao_init, tre_init)
    }
}

#[cfg(test)]
mod tests;
