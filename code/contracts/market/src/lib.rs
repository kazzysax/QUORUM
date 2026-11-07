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
use near_sdk::store::LookupMap;
use near_sdk::{env, ext_contract, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseError};
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

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum Key { Listings }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Market {
    listings: LookupMap<String, Listing>,
}

fn lk(nft: &AccountId, token_id: &str) -> String { format!("{nft}|{token_id}") }

#[near]
impl Market {
    #[init]
    pub fn new() -> Self { Self { listings: LookupMap::new(Key::Listings) } }

    /// NEP-178 callback: `nft_approve(token_id, market, msg = {"price": "..."})`.
    pub fn nft_on_approve(&mut self, token_id: String, owner_id: AccountId, approval_id: u64, msg: String) {
        let nft = env::predecessor_account_id();
        #[derive(near_sdk::serde::Deserialize)]
        #[serde(crate = "near_sdk::serde")]
        struct M { price: U128 }
        let m: M = serde_json::from_str(&msg).unwrap_or_else(|_| env::panic_str("msg must be {\"price\":\"<yocto>\"}"));
        require!(m.price.0 > 0, "Price must be positive");
        let l = Listing { seller: owner_id, price: m.price, approval_id };
        emit("listed", json!({ "nft": nft, "token_id": token_id, "listing": l }));
        self.listings.insert(lk(&nft, &token_id), l);
    }

    pub fn update_price(&mut self, nft: AccountId, token_id: String, price: U128) {
        require!(price.0 > 0, "Price must be positive");
        let l = self.listings.get_mut(&lk(&nft, &token_id)).unwrap_or_else(|| env::panic_str("Not listed"));
        require!(env::predecessor_account_id() == l.seller, "Only the seller");
        l.price = price;
        emit("price_updated", json!({ "nft": nft, "token_id": token_id, "price": price }));
    }

    pub fn cancel(&mut self, nft: AccountId, token_id: String) {
        let k = lk(&nft, &token_id);
        let l = self.listings.get(&k).unwrap_or_else(|| env::panic_str("Not listed"));
        require!(env::predecessor_account_id() == l.seller, "Only the seller");
        self.listings.remove(&k);
        emit("cancelled", json!({ "nft": nft, "token_id": token_id }));
    }

    #[payable]
    pub fn buy(&mut self, nft: AccountId, token_id: String, approval_id: u64) -> Promise {
        let buyer = env::predecessor_account_id();
        let paid = env::attached_deposit();
        let k = lk(&nft, &token_id);
        let l = self.listings.get(&k).cloned().unwrap_or_else(|| env::panic_str("Not listed"));
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
    pub fn on_terms(&mut self, #[callback_result] terms: Result<SaleTerms, PromiseError>, nft: AccountId, token_id: String, buyer: AccountId, seller: AccountId, price: U128, approval_id: u64) -> Promise {
        let Ok(terms) = terms else { return self.refund(buyer, price, "terms unavailable") };
        // Reject a collection whose terms would take more than the whole price.
        if quorum_common::SALE_POOL_BPS as u32 + terms.royalty_bps as u32 > quorum_common::BPS as u32 {
            return self.refund(buyer, price, "royalty too high");
        }
        ext_collection::ext(nft.clone()).with_static_gas(GAS_TRANSFER).with_attached_deposit(YOCTO)
            .nft_transfer(buyer.clone(), token_id.clone(), Some(approval_id), Some("quorum sale".into()))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB)
                .on_transferred(nft, token_id, buyer, seller, price, terms))
    }

    #[private]
    pub fn on_transferred(&mut self, #[callback_result] moved: Result<(), PromiseError>, nft: AccountId, token_id: String, buyer: AccountId, seller: AccountId, price: U128, terms: SaleTerms) -> Promise {
        if moved.is_err() {
            return self.refund(buyer, price, "transfer failed");
        }
        let (pool, royalty, seller_net) = sale_split(price.0, terms.royalty_bps);
        emit("sale", json!({ "nft": nft, "token_id": token_id, "buyer": buyer, "seller": seller, "price": price, "pool_fee": U128(pool), "royalty": U128(royalty), "seller_net": U128(seller_net) }));
        let mut p = Promise::new(terms.treasury).transfer(NearToken::from_yoctonear(pool));
        if royalty > 0 {
            p = p.and(Promise::new(terms.royalty_recipient).transfer(NearToken::from_yoctonear(royalty)));
        }
        p.and(Promise::new(seller).transfer(NearToken::from_yoctonear(seller_net)))
    }

    pub fn get_listing(&self, nft: AccountId, token_id: String) -> Option<Listing> {
        self.listings.get(&lk(&nft, &token_id)).cloned()
    }
}

impl Market {
    fn refund(&self, buyer: AccountId, price: U128, why: &str) -> Promise {
        emit("sale_failed", json!({ "buyer": buyer, "price": price, "reason": why }));
        Promise::new(buyer).transfer(NearToken::from_yoctonear(price.0))
    }
}

#[cfg(test)]
mod tests;
