//! quorum-treasury: the DAO pool (F6, F7). No keys, no admin, no upgrade path.
//!
//! * Money moves out only through `spend` and `distribute`, both callable only
//!   by quorum-dao, which calls them only from `execute` on a passed proposal.
//! * Fungible tokens sent with plain `ft_transfer` (mint, sale and burn shares)
//!   give a contract no callback, so FT balances are read from the token
//!   contract at spend time instead of being tracked here.
//! * Even distribution uses a reward index per asset: one write per
//!   distribution, never a loop over holders. Each token owes
//!   `index - checkpoint`; unclaimed amounts stay with the token and are paid
//!   to the burner on burn.

use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::LookupMap;
use near_sdk::{env, ext_contract, near, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseError};
use quorum_common::require;
use quorum_common::asset::ft_contract;
use quorum_common::events::emit;
use quorum_common::ext::{ext_ft, ext_wrap};
use quorum_common::swap::{route_output, swap_msg, Hop};
use quorum_common::MAX_ASSET_TYPES;

/// Fixed-point scale for the reward index. Kept small on purpose: assets have up to 24 decimals, so
/// `amount * SCALE` with a 10^24 scale needs ~10^48 and overflows u128 (max ~3.4e38) for any real
/// distribution. At 10^9 the index holds up to ~340k NEAR per token in total, and rounding dust
/// is at most 1e-9 yocto per token per distribution.
const SCALE: u128 = 1_000_000_000;
const GAS_QUERY: Gas = Gas::from_tgas(10);
const GAS_PAY: Gas = Gas::from_tgas(20);
const GAS_CB: Gas = Gas::from_tgas(30);
const YOCTO: NearToken = NearToken::from_yoctonear(1);
/// NEAR kept for storage so the pool account can never be starved.
const NEAR_RESERVE: NearToken = NearToken::from_near(1);
/// One spend may take at most this share of the treasury's free funds (25%). A captured vote
/// can then never empty the treasury in one transaction.
const SPEND_CAP_BPS: u128 = 2_500;

#[ext_contract(ext_nft_supply)]
pub trait NftSupply {
    fn live_supply(&self) -> near_sdk::json_types::U64;
}

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum Key {
    Checkpoints,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Treasury {
    dao: AccountId,
    nft: AccountId,
    /// Assets that have ever been distributed. Bounded by MAX_ASSET_TYPES.
    assets: Vec<String>,
    /// Reward index per asset, scaled by SCALE.
    index: Vec<u128>,
    /// Distributed but not yet claimed, per asset. Never spendable.
    reserved: Vec<u128>,
    checkpoints: LookupMap<String, u128>,
    /// DEX accounts the DAO has approved for swaps (Rhea/Ref classic pools).
    dexes: Vec<AccountId>,
    wrap: AccountId,
}

#[near]
impl Treasury {
    #[init]
    pub fn new(dao: AccountId, nft: AccountId, dex: AccountId, wrap: AccountId) -> Self {
        Self { dao, nft, assets: vec![], index: vec![], reserved: vec![], checkpoints: LookupMap::new(Key::Checkpoints), dexes: vec![dex], wrap }
    }

    // ------------------------------------------------------------ money in
    #[payable]
    pub fn donate(&mut self, memo: Option<String>) {
        emit("treasury_donation", json!({ "from": env::predecessor_account_id(), "asset": "near", "amount": U128(env::attached_deposit().as_yoctonear()), "memo": memo }));
    }

    /// Donations by `ft_transfer_call`. Everything is kept; shares sent with
    /// plain `ft_transfer` are picked up by reading the token balance later.
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> U128 {
        emit("treasury_donation", json!({ "from": sender_id, "asset": format!("nep141:{}", env::predecessor_account_id()), "amount": amount, "memo": msg }));
        U128(0)
    }

    // ------------------------------------------------- money out (DAO only)

    /// Pays a passed SPEND proposal. Never touches amounts reserved for claims.
    pub fn spend(&mut self, recipient: AccountId, asset: String, amount: U128, purpose: String) -> Promise {
        self.only_dao();
        require!(amount.0 > 0, "Amount must be positive");
        quorum_common::asset::assert_asset(&asset);
        self.available(&asset).then(
            Self::ext(env::current_account_id()).with_static_gas(GAS_CB)
                .on_spend_funds(recipient, asset, amount, purpose),
        )
    }

    #[private]
    pub fn on_spend_funds(&mut self, #[callback_result] bal: Result<U128, PromiseError>, recipient: AccountId, asset: String, amount: U128, purpose: String) -> Promise {
        let have = bal.unwrap_or_else(|_| quorum_common::fail("Balance check failed")).0;
        let free = have.saturating_sub(self.reserved_of(&asset));
        require!(free >= amount.0, "Insufficient unreserved funds");
        require!(amount.0.saturating_mul(10_000) <= free.saturating_mul(SPEND_CAP_BPS), "A single spend may not exceed 25% of the treasury's free funds");
        emit("treasury_spend", json!({ "recipient": recipient, "asset": asset, "amount": amount, "purpose": purpose }));
        self.send(&asset, &recipient, amount.0)
    }

    /// Splits `amount` evenly across all live NFTs by raising the index.
    pub fn distribute(&mut self, asset: String, amount: U128) -> Promise {
        self.only_dao();
        require!(amount.0 > 0, "Amount must be positive");
        quorum_common::asset::assert_asset(&asset);
        if !self.assets.contains(&asset) {
            require!(self.assets.len() < MAX_ASSET_TYPES, "Too many distributed asset types");
        }
        ext_nft_supply::ext(self.nft.clone()).with_static_gas(GAS_QUERY).live_supply().and(self.available(&asset)).then(
            Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_distribute_inputs(asset, amount),
        )
    }

    #[private]
    pub fn on_distribute_inputs(&mut self, asset: String, amount: U128) {
        let supply: near_sdk::json_types::U64 = match env::promise_result_checked(0, 64) {
            Ok(b) => near_sdk::serde_json::from_slice(&b).unwrap_or_else(|_| quorum_common::fail("Bad supply")),
            Err(_) => quorum_common::fail("Supply check failed"),
        };
        let have: U128 = match env::promise_result_checked(1, 64) {
            Ok(b) => near_sdk::serde_json::from_slice(&b).unwrap_or_else(|_| quorum_common::fail("Bad balance")),
            Err(_) => quorum_common::fail("Balance check failed"),
        };
        require!(supply.0 > 0, "No live NFTs");
        let free = have.0.saturating_sub(self.reserved_of(&asset));
        require!(free >= amount.0, "Insufficient unreserved funds");
        let per_token = quorum_common::mul_div(amount.0, SCALE, supply.0 as u128);
        let distributed = quorum_common::mul_div(per_token, supply.0 as u128, SCALE); // dust stays in the pool
        let i = self.slot(&asset);
        self.index[i] += per_token;
        self.reserved[i] += distributed;
        emit("treasury_distribution", json!({ "asset": asset, "amount": amount, "per_token_scaled": U128(per_token), "live_supply": supply, "distributed": U128(distributed) }));
    }

    /// Swaps pool funds into another asset through an approved DEX (Rhea/Ref classic
    /// pools). DAO only, from an executed SWAP proposal. `token_in` is `near`
    /// (wrapped first) or `nep141:<token>`; the route must end in `token_out`.
    /// Amounts reserved for unclaimed distributions are never spent.
    pub fn swap(&mut self, token_in: String, amount: U128, token_out: AccountId, hops: Vec<Hop>, min_out: U128, dex: AccountId) -> Promise {
        self.only_dao();
        require!(self.dexes.contains(&dex), "That DEX has not been approved");
        require!(route_output(&hops) == Some(&token_out), "The route must end in the output token");
        let in_account = self.swap_input_account(&token_in);
        swap_msg(&in_account, amount.0, &hops, min_out.0).unwrap_or_else(|e| quorum_common::fail(e));
        self.available(&token_in).then(
            Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(230))
                .on_swap_funds(token_in, amount, token_out, hops, min_out, dex),
        )
    }

    #[private]
    pub fn on_swap_funds(&mut self, #[callback_result] bal: Result<U128, PromiseError>, token_in: String, amount: U128, token_out: AccountId, hops: Vec<Hop>, min_out: U128, dex: AccountId) -> Promise {
        let have = bal.unwrap_or_else(|_| quorum_common::fail("Balance check failed")).0;
        require!(have.saturating_sub(self.reserved_of(&token_in)) >= amount.0, "Insufficient unreserved funds");
        let in_account = self.swap_input_account(&token_in);
        let msg = swap_msg(&in_account, amount.0, &hops, min_out.0).unwrap_or_else(|e| quorum_common::fail(e));
        emit("treasury_swap_started", json!({ "token_in": token_in, "amount": amount, "token_out": token_out, "min_out": min_out, "dex": dex }));
        let register = ext_ft::ext(token_out.clone()).with_static_gas(Gas::from_tgas(15)).with_attached_deposit(NearToken::from_millinear(5))
            .storage_deposit(Some(env::current_account_id()), Some(true));
        let swap = ext_ft::ext(in_account.clone()).with_static_gas(Gas::from_tgas(150)).with_attached_deposit(YOCTO)
            .ft_transfer_call(dex, amount, Some("quorum treasury swap".into()), msg);
        let cb = Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(15)).on_swap_done(token_in.clone(), token_out, amount);
        if token_in == "near" {
            register
                .then(ext_wrap::ext(self.wrap.clone()).with_static_gas(Gas::from_tgas(15)).with_attached_deposit(NearToken::from_yoctonear(amount.0)).near_deposit())
                .then(swap).then(cb)
        } else {
            register.then(swap).then(cb)
        }
    }

    #[private]
    pub fn on_swap_done(&mut self, #[callback_result] used: Result<U128, PromiseError>, token_in: String, token_out: AccountId, amount: U128) {
        // ft_transfer_call returns the amount the DEX used; anything less was refunded to us.
        let ok = matches!(&used, Ok(u) if u.0 > 0);
        emit("treasury_swap_done", json!({ "token_in": token_in, "token_out": token_out, "amount": amount, "used": used.ok(), "ok": ok }));
    }

    /// DAO-approved parameters. `allow_dex` adds a swap venue.
    pub fn set_param(&mut self, key: String, value: String) {
        self.only_dao();
        match key.as_str() {
            "allow_dex" => {
                let a: AccountId = value.parse().unwrap_or_else(|_| quorum_common::fail("Invalid account"));
                require!(self.dexes.len() < 5, "At most 5 approved DEXes");
                if !self.dexes.contains(&a) { self.dexes.push(a); }
            }
            "revoke_dex" => {
                let a: AccountId = value.parse().unwrap_or_else(|_| quorum_common::fail("Invalid account"));
                self.dexes.retain(|d| d != &a);
            }
            _ => quorum_common::fail("Unknown parameter"),
        }
        emit("treasury_param", json!({ "key": key, "value": value }));
    }

    pub fn approved_dexes(&self) -> Vec<AccountId> { self.dexes.clone() }

    // ------------------------------------------------- claims (NFT only)

    /// Registered by quorum-nft at mint: the token starts owing nothing for
    /// past distributions. Idempotent.
    pub fn register_token(&mut self, token_id: String) {
        self.only_nft();
        for (a, idx) in self.assets.clone().iter().zip(self.index.clone()) {
            let k = ck(&token_id, a);
            if !self.checkpoints.contains_key(&k) {
                self.checkpoints.insert(k, idx);
            }
        }
        self.checkpoints.insert(ck(&token_id, "_registered"), 0);
    }

    pub fn claim_for(&mut self, token_id: String, owner: AccountId, asset: String) -> Promise {
        self.only_nft();
        self.pay_claim(&token_id, &owner, &asset)
    }

    /// F3: unclaimed distributions are paid to the burner in full, no fee.
    pub fn on_token_burned(&mut self, token_id: String, burner: AccountId) {
        self.only_nft();
        for a in self.assets.clone() {
            if self.owed(&token_id, &a) > 0 {
                self.pay_claim(&token_id, &burner, &a).detach();
            }
        }
    }

    #[private]
    pub fn on_claim_paid(&mut self, #[callback_result] r: Result<(), PromiseError>, token_id: String, asset: String, prev: U128, amount: U128) {
        if r.is_err() {
            // Put the claim back so nothing is lost and the owner can retry.
            let i = self.slot_of(&asset).expect("asset");
            self.reserved[i] += amount.0;
            self.checkpoints.insert(ck(&token_id, &asset), prev.0);
            emit("treasury_claim_failed", json!({ "token_id": token_id, "asset": asset, "amount": amount }));
        }
    }

    // ----------------------------------------------------------------- views
    pub fn owed_to(&self, token_id: String, asset: String) -> U128 { U128(self.owed(&token_id, &asset)) }
    pub fn reserved_for(&self, asset: String) -> U128 { U128(self.reserved_of(&asset)) }
    pub fn reward_index(&self, asset: String) -> U128 { U128(self.slot_of(&asset).map(|i| self.index[i]).unwrap_or(0)) }
    pub fn dao_account(&self) -> AccountId { self.dao.clone() }
}

fn ck(token_id: &str, asset: &str) -> String { format!("{token_id}|{asset}") }

impl Treasury {
    fn swap_input_account(&self, token_in: &str) -> AccountId {
        if token_in == "near" { self.wrap.clone() } else { ft_contract(token_in).unwrap_or_else(|| quorum_common::fail("token_in must be near or nep141:<token>")) }
    }
    fn only_dao(&self) { require!(env::predecessor_account_id() == self.dao, "Only the DAO"); }
    fn only_nft(&self) { require!(env::predecessor_account_id() == self.nft, "Only the NFT contract"); }
    fn slot_of(&self, asset: &str) -> Option<usize> { self.assets.iter().position(|a| a == asset) }
    fn reserved_of(&self, asset: &str) -> u128 { self.slot_of(asset).map(|i| self.reserved[i]).unwrap_or(0) }
    fn slot(&mut self, asset: &str) -> usize {
        self.slot_of(asset).unwrap_or_else(|| { self.assets.push(asset.to_string()); self.index.push(0); self.reserved.push(0); self.assets.len() - 1 })
    }

    /// Promise resolving to the pool's balance of `asset`.
    fn available(&self, asset: &str) -> Promise {
        match ft_contract(asset) {
            Some(t) => ext_fb::ext(t).with_static_gas(GAS_QUERY).ft_balance_of(env::current_account_id()),
            None => Promise::new(env::current_account_id()).function_call("native_balance".to_string(), Vec::<u8>::new(), NearToken::from_yoctonear(0), GAS_QUERY),
        }
    }

    fn owed(&self, token_id: &str, asset: &str) -> u128 {
        let Some(i) = self.slot_of(asset) else { return 0 };
        // A token never registered cannot claim: refusing is safer than paying from index 0.
        if !self.checkpoints.contains_key(&ck(token_id, "_registered")) { return 0; }
        let cp = self.checkpoints.get(&ck(token_id, asset)).copied().unwrap_or(0);
        self.index[i].saturating_sub(cp) / SCALE
    }

    fn pay_claim(&mut self, token_id: &str, to: &AccountId, asset: &str) -> Promise {
        let amount = self.owed(token_id, asset);
        require!(amount > 0, "Nothing to claim");
        let i = self.slot_of(asset).unwrap();
        let prev = self.checkpoints.get(&ck(token_id, asset)).copied().unwrap_or(0);
        // State first, payment after (global principle 3).
        self.checkpoints.insert(ck(token_id, asset), self.index[i]);
        self.reserved[i] = self.reserved[i].saturating_sub(amount);
        emit("treasury_claim", json!({ "token_id": token_id, "to": to, "asset": asset, "amount": U128(amount) }));
        self.send(asset, to, amount).then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB)
            .on_claim_paid(token_id.to_string(), asset.to_string(), U128(prev), U128(amount)))
    }

    fn send(&self, asset: &str, to: &AccountId, amount: u128) -> Promise {
        match ft_contract(asset) {
            Some(t) => ext_ft::ext(t).with_static_gas(GAS_PAY).with_attached_deposit(YOCTO).ft_transfer(to.clone(), U128(amount), None),
            None => Promise::new(to.clone()).transfer(NearToken::from_yoctonear(amount)),
        }
    }
}

#[ext_contract(ext_fb)]
pub trait FtBalance {
    fn ft_balance_of(&self, account_id: AccountId) -> U128;
}

#[near]
impl Treasury {
    /// Native NEAR the pool can pay out: balance minus the storage reserve.
    pub fn native_balance(&self) -> U128 {
        U128(env::account_balance().as_yoctonear().saturating_sub(NEAR_RESERVE.as_yoctonear()))
    }
}

#[cfg(test)]
mod tests;
