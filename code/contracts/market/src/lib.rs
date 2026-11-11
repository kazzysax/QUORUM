//! quorum-market: fixed-price sales in NEAR (F8). One shared market.
//!
//! * Sellers keep custody: listing uses a NEP-178 approval, so a listing dies
//!   automatically when the token moves, is burned, or the approval is revoked.
//! * `buy` needs the exact price AND the approval id the buyer saw, which blocks
//!   price-change front-running.
//! * The listing is removed before any outbound call. The token transfers first;
//!   only then are the pool fee (5%), the royalty and the seller paid. If anything
//!   fails the buyer is refunded in full.
//! * The vault travels with the NFT because the vault asks quorum-nft who owns it.

use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json};
use near_sdk::store::{IterableMap, LookupMap, LookupSet};
use near_sdk::{env, ext_contract, near, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseError, PromiseOrValue};
use quorum_common::require;
use quorum_common::events::emit;
use quorum_common::sale_split;

const GAS_TERMS: Gas = Gas::from_tgas(10);
const GAS_TRANSFER: Gas = Gas::from_tgas(40);
const GAS_CB: Gas = Gas::from_tgas(50);
const YOCTO: NearToken = NearToken::from_yoctonear(1);

#[near(serializers = [json])]
#[derive(Clone)]
pub struct SaleTerms {
    pub treasury: AccountId,
    pub royalty_bps: u16,
    pub royalty_recipient: AccountId,
}

#[ext_contract(ext_collection)]
pub trait Collection {
    fn sale_terms(&self) -> SaleTerms;
    fn nft_transfer(&mut self, receiver_id: AccountId, token_id: String, approval_id: Option<u64>, memo: Option<String>);
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Listing {
    pub seller: AccountId,
    pub price: U128,
    pub approval_id: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct SaleStats {
    pub sales: u64,
    /// Sum of completed sale prices in yoctoNEAR.
    pub volume: U128,
}

const MAX_RECENT_SALES: usize = 100;

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct SaleRecord {
    pub nft: AccountId,
    pub token_id: String,
    pub buyer: AccountId,
    pub seller: AccountId,
    pub price: U128,
    pub pool_fee: U128,
    pub royalty: U128,
    pub seller_net: U128,
    pub at_ms: u64,
}

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum Key { Listings, Collections, Stats }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Market {
    listings: IterableMap<String, Listing>,
    /// Per-collection sales counters, so volume shown in the UI is read from chain state.
    stats: LookupMap<AccountId, SaleStats>,
    /// The last `MAX_RECENT_SALES` completed sales across all collections, oldest first.
    recent: Vec<SaleRecord>,
    /// Registers collections only. The owner cannot touch listings, prices or funds.
    owner: AccountId,
    /// Quorum collections allowed to list here. An unknown contract could return
    /// attacker-chosen treasury/royalty accounts from `sale_terms`.
    collections: LookupSet<AccountId>,
}

fn lk(nft: &AccountId, token_id: &str) -> String { format!("{nft}|{token_id}") }

#[near]
impl Market {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self { listings: IterableMap::new(Key::Listings), stats: LookupMap::new(Key::Stats), recent: Vec::new(), owner, collections: LookupSet::new(Key::Collections) }
    }

    pub fn register_collection(&mut self, nft: AccountId) {
        require!(env::predecessor_account_id() == self.owner, "Only the owner");
        self.collections.insert(nft.clone());
        emit("collection_registered", json!({ "nft": nft }));
    }

    pub fn is_collection(&self, nft: AccountId) -> bool { self.collections.contains(&nft) }

    /// NEP-178 callback: `nft_approve(token_id, market, msg = {"price": "..."})`.
    pub fn nft_on_approve(&mut self, token_id: String, owner_id: AccountId, approval_id: u64, msg: String) {
        let nft = env::predecessor_account_id();
        require!(self.collections.contains(&nft), "Collection is not registered on this market");
        #[derive(near_sdk::serde::Deserialize)]
        #[serde(crate = "near_sdk::serde")]
        struct M { price: U128 }
        let m: M = serde_json::from_str(&msg).unwrap_or_else(|_| quorum_common::fail("msg must be {\"price\":\"<yocto>\"}"));
        require!(m.price.0 > 0, "Price must be positive");
        let l = Listing { seller: owner_id, price: m.price, approval_id };
        emit("listed", json!({ "nft": nft, "token_id": token_id, "listing": l }));
        self.listings.insert(lk(&nft, &token_id), l);
    }

    pub fn update_price(&mut self, nft: AccountId, token_id: String, price: U128) {
        require!(price.0 > 0, "Price must be positive");
        let l = self.listings.get_mut(&lk(&nft, &token_id)).unwrap_or_else(|| quorum_common::fail("Not listed"));
        require!(env::predecessor_account_id() == l.seller, "Only the seller");
        l.price = price;
        emit("price_updated", json!({ "nft": nft, "token_id": token_id, "price": price }));
    }

    pub fn cancel(&mut self, nft: AccountId, token_id: String) {
        let k = lk(&nft, &token_id);
        let l = self.listings.get(&k).unwrap_or_else(|| quorum_common::fail("Not listed"));
        require!(env::predecessor_account_id() == l.seller, "Only the seller");
        self.listings.remove(&k);
        emit("cancelled", json!({ "nft": nft, "token_id": token_id }));
    }

    #[payable]
    pub fn buy(&mut self, nft: AccountId, token_id: String, approval_id: u64) -> Promise {
        let buyer = env::predecessor_account_id();
        let paid = env::attached_deposit();
        let k = lk(&nft, &token_id);
        let l = self.listings.get(&k).cloned().unwrap_or_else(|| quorum_common::fail("Not listed"));
        require!(paid.as_yoctonear() == l.price.0, "Attach exactly the listed price");
        require!(approval_id == l.approval_id, "Stale listing: the approval id changed");
        require!(buyer != l.seller, "Cannot buy your own listing");
        self.listings.remove(&k); // state before outbound calls
        ext_collection::ext(nft.clone()).with_static_gas(GAS_TERMS).sale_terms().then(
            Self::ext(env::current_account_id()).with_static_gas(GAS_CB.saturating_add(GAS_TRANSFER).saturating_add(GAS_CB))
                .on_terms(nft, token_id, buyer, l.seller, l.price, approval_id),
        )
    }

    #[private]
    pub fn on_terms(&mut self, #[callback_result] terms: Result<SaleTerms, PromiseError>, nft: AccountId, token_id: String, buyer: AccountId, seller: AccountId, price: U128, approval_id: u64) -> PromiseOrValue<()> {
        let Ok(terms) = terms else { self.refund(buyer, price, "terms unavailable"); return PromiseOrValue::Value(()) };
        // Reject a collection whose terms would take more than the whole price.
        if quorum_common::SALE_POOL_BPS as u32 + terms.royalty_bps as u32 > quorum_common::BPS as u32 {
            self.refund(buyer, price, "royalty too high");
            return PromiseOrValue::Value(());
        }
        PromiseOrValue::Promise(ext_collection::ext(nft.clone()).with_static_gas(GAS_TRANSFER).with_attached_deposit(YOCTO)
            .nft_transfer(buyer.clone(), token_id.clone(), Some(approval_id), Some("quorum sale".into()))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB)
                .on_transferred(nft, token_id, buyer, seller, price, terms)))
    }

    #[private]
    pub fn on_transferred(&mut self, #[callback_result] moved: Result<(), PromiseError>, nft: AccountId, token_id: String, buyer: AccountId, seller: AccountId, price: U128, terms: SaleTerms) {
        if moved.is_err() {
            self.refund(buyer, price, "transfer failed");
            return;
        }
        let (pool, royalty, seller_net) = sale_split(price.0, terms.royalty_bps);
        let mut s = self.stats.get(&nft).cloned().unwrap_or_default();
        s.sales += 1;
        s.volume = U128(s.volume.0 + price.0);
        self.stats.insert(nft.clone(), s);
        self.recent.push(SaleRecord {
            nft: nft.clone(), token_id: token_id.clone(), buyer: buyer.clone(), seller: seller.clone(), price,
            pool_fee: U128(pool), royalty: U128(royalty), seller_net: U128(seller_net), at_ms: env::block_timestamp_ms(),
        });
        if self.recent.len() > MAX_RECENT_SALES { self.recent.remove(0); }
        emit("sale", json!({ "nft": nft, "token_id": token_id, "buyer": buyer, "seller": seller, "price": price, "pool_fee": U128(pool), "royalty": U128(royalty), "seller_net": U128(seller_net) }));
        // Separate transfers: the runtime does not allow a callback to return a joined promise.
        Promise::new(terms.treasury).transfer(NearToken::from_yoctonear(pool)).detach();
        if royalty > 0 {
            Promise::new(terms.royalty_recipient).transfer(NearToken::from_yoctonear(royalty)).detach();
        }
        Promise::new(seller).transfer(NearToken::from_yoctonear(seller_net)).detach();
    }

    pub fn get_listing(&self, nft: AccountId, token_id: String) -> Option<Listing> {
        self.listings.get(&lk(&nft, &token_id)).cloned()
    }

    /// Listings of one collection, as `(token_id, listing)`. A listing can outlive its
    /// approval (the token moved or was burned): `buy` then fails and refunds, and clients
    /// should confirm with `nft_is_approved` on the collection before showing one as live.
    pub fn get_listings(&self, nft: AccountId, from_index: u64, limit: u64) -> Vec<(String, Listing)> {
        let prefix = format!("{nft}|");
        self.listings
            .iter()
            .filter(|(k, _)| k.starts_with(&prefix))
            .skip(from_index as usize)
            .take(limit as usize)
            .map(|(k, l)| (k[prefix.len()..].to_string(), l.clone()))
            .collect()
    }

    pub fn get_stats(&self, nft: AccountId) -> SaleStats { self.stats.get(&nft).cloned().unwrap_or_default() }

    /// Newest first. `nft = None` returns sales of every collection.
    pub fn recent_sales(&self, nft: Option<AccountId>, limit: u64) -> Vec<SaleRecord> {
        self.recent.iter().rev().filter(|s| nft.as_ref().map_or(true, |n| &s.nft == n)).take(limit as usize).cloned().collect()
    }
}

impl Market {
    fn refund(&self, buyer: AccountId, price: U128, why: &str) {
        emit("sale_failed", json!({ "buyer": buyer, "price": price, "reason": why }));
        Promise::new(buyer).transfer(NearToken::from_yoctonear(price.0)).detach();
    }
}

#[cfg(test)]
mod tests;
