//! Settlement: turning each asset group's escrowed NEAR into the asset its NFTs carry.
//!
//! * `settle_group` is callable only by the DAO (an executed SETTLE proposal that
//!   carries the route and the minimum output holders approved). The contract builds
//!   the Rhea/Ref swap message itself, so the minimum cannot be dropped.
//! * Group phases: Pending -> Swapping -> Swapped, or Pending -> Fallback.
//! * `credit_batch` is permissionless: it pushes each NFT's pro-rata share into its
//!   vault. Shares are by escrow amount, so NFTs minted at different prices are
//!   treated fairly.
//! * `enable_fallback` (permissionless, after the grace period) lets anyone credit
//!   plain NEAR instead, so a missing or captured DAO can never strand funds.
//!
//! The DEX call is atomic about price: Rhea reverts the swap unless `min_out` arrives.
//! This contract measures the token balance before and after, so it credits only what
//! really arrived.

use crate::*;
use near_sdk::json_types::{U128, U64};
use near_sdk::serde_json::json;
use near_sdk::{near, Gas, NearToken, Promise, PromiseError, PromiseOrValue};
use quorum_common::events::emit;
use quorum_common::ext::{ext_balance, ext_ft, ext_vault_credit, ext_wrap};
use quorum_common::swap::{route_output, swap_msg, Hop};

const GAS_BALANCE: Gas = Gas::from_tgas(10);
const GAS_ON_BEFORE: Gas = Gas::from_tgas(30);
const GAS_REGISTER: Gas = Gas::from_tgas(15);
const GAS_WRAP: Gas = Gas::from_tgas(15);
const GAS_SWAP: Gas = Gas::from_tgas(150);
const GAS_ON_AFTER: Gas = Gas::from_tgas(20);
const GAS_CREDIT_FT: Gas = Gas::from_tgas(60);
const GAS_CREDIT_CB: Gas = Gas::from_tgas(12);
const YOCTO: NearToken = NearToken::from_yoctonear(1);
/// Credits per transaction: each needs a registration, a transfer and a callback.
pub const MAX_CREDIT_BATCH: usize = 3;
/// A swap still `Swapping` after this long is treated as dead and can be aborted by anyone.
pub const SWAP_TIMEOUT_MS: u64 = 3_600_000;

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Default)]
pub enum Phase {
    /// Escrow is held; no swap yet.
    #[default]
    Pending,
    /// A swap is in flight. Burning is blocked until it resolves.
    Swapping,
    /// Swapped: `out_total` of the asset is held here, to be credited to vaults.
    Swapped,
    /// No swap happened in time: plain NEAR is credited to vaults instead.
    Fallback,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct Group {
    pub phase: Phase,
    /// NEAR escrow of this group's live tokens, in yoctoNEAR.
    pub total_share: U128,
    /// Asset received from the swap (set when Swapped).
    pub out_total: U128,
    /// `total_share` frozen at swap time; each token gets `out_total * share / swap_share`.
    pub swap_share: U128,
    /// When the in-flight swap started (ms). Lets anyone un-stick a swap whose callbacks never landed.
    pub swap_started_ms: U64,
}

#[near(serializers = [json])]
pub struct GroupView {
    pub index: u8,
    pub asset: AccountId,
    pub weight: u16,
    pub phase: Phase,
    pub total_share: U128,
    pub out_total: U128,
}

#[near]
impl Contract {
    /// DAO only. Swaps the group's entire NEAR escrow into its asset through Rhea.
    pub fn settle_group(&mut self, group: u8, hops: Vec<Hop>, min_out: U128) -> PromiseOrValue<()> {
        require!(env::predecessor_account_id() == self.config.dao, "Only the DAO");
        require!(self.mint_closed(), "The mint is still open");
        require!(self.pending_mints == 0, "Mints are still being created");
        let idx = group as usize;
        require!(idx < self.groups.len(), "Unknown group");
        let g = &self.groups[idx];
        require!(g.phase == Phase::Pending, "This group is not waiting for a swap");
        require!(g.total_share.0 > 0, "Nothing to settle");
        let token = self.config.asset_plan[idx].token.clone();
        let amount = g.total_share.0;
        let is_wnear = token == self.config.wrap_account;

        if is_wnear {
            require!(hops.is_empty(), "A wNEAR group needs no route");
        } else {
            require!(route_output(&hops) == Some(&token), "The route must end in the group's asset");
            require!(min_out.0 > 0, "A minimum output is required");
            swap_msg(&self.config.wrap_account, amount, &hops, min_out.0).unwrap_or_else(|e| quorum_common::fail(e));
        }
        self.groups[idx].phase = Phase::Swapping;
        self.groups[idx].swap_started_ms = U64(env::block_timestamp_ms());
        emit("settle_started", json!({ "group": group, "asset": token, "near_in": U128(amount), "min_out": min_out }));

        if is_wnear {
            // Register first (wrap.near otherwise charges its storage fee out of the first deposit, which
            // would leave us holding less than the escrow), then wrap, then record what we really hold.
            return PromiseOrValue::Promise(
                ext_balance::ext(token).with_static_gas(GAS_BALANCE).ft_balance_of(env::current_account_id())
                    .then(Self::ext(env::current_account_id())
                        .with_static_gas(GAS_ON_BEFORE.saturating_add(GAS_REGISTER).saturating_add(GAS_WRAP).saturating_add(GAS_BALANCE).saturating_add(GAS_ON_AFTER))
                        .on_before_wrap(group, U128(amount))),
            );
        }
        PromiseOrValue::Promise(
            ext_balance::ext(token).with_static_gas(GAS_BALANCE).ft_balance_of(env::current_account_id())
                .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_BEFORE.saturating_add(GAS_REGISTER).saturating_add(GAS_WRAP).saturating_add(GAS_SWAP).saturating_add(GAS_BALANCE).saturating_add(GAS_ON_AFTER))
                    .on_before(group, hops, min_out, U128(amount))),
        )
    }

    #[private]
    pub fn on_before(&mut self, #[callback_result] before: Result<U128, PromiseError>, group: u8, hops: Vec<Hop>, min_out: U128, amount: U128) -> PromiseOrValue<()> {
        let idx = group as usize;
        let Ok(before) = before else {
            self.groups[idx].phase = Phase::Pending;
            emit("swap_failed", json!({ "group": group, "reason": "balance check failed" }));
            return PromiseOrValue::Value(());
        };
        let token = self.config.asset_plan[idx].token.clone();
        let msg = swap_msg(&self.config.wrap_account, amount.0, &hops, min_out.0).unwrap_or_else(|e| quorum_common::fail(e));
        // 1. register this contract on the asset, 2. wrap NEAR, 3. swap, 4. read the balance again.
        // Any step failing leaves the balance unchanged, which `on_after` treats as a failed swap.
        PromiseOrValue::Promise(
            ext_ft::ext(token.clone()).with_static_gas(GAS_REGISTER).with_attached_deposit(REGISTRATION_RESERVE)
                .storage_deposit(Some(env::current_account_id()), Some(true))
                .then(ext_wrap::ext(self.config.wrap_account.clone()).with_static_gas(GAS_WRAP).with_attached_deposit(NearToken::from_yoctonear(amount.0)).near_deposit())
                .then(ext_ft::ext(self.config.wrap_account.clone()).with_static_gas(GAS_SWAP).with_attached_deposit(YOCTO)
                    .ft_transfer_call(self.config.dex.clone(), amount, Some("quorum settlement".into()), msg))
                .then(ext_balance::ext(token).with_static_gas(GAS_BALANCE).ft_balance_of(env::current_account_id()))
                .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_AFTER).on_after(group, before, min_out)),
        )
    }

    #[private]
    pub fn on_after(&mut self, #[callback_result] after: Result<U128, PromiseError>, group: u8, before: U128, min_out: U128) {
        let idx = group as usize;
        let delta = after.map(|a| a.0.saturating_sub(before.0)).unwrap_or(0);
        // Holders approved `min_out`. Less than that (including a dust donation sent
        // mid-swap to fake a result) means the swap did not happen.
        if delta == 0 || delta < min_out.0 {
            // Nothing (or too little) arrived: the DEX reverted (price moved past the minimum, no liquidity, ...).
            // Any wNEAR left over can be unwrapped with `unwrap_wnear`; the escrow records are untouched.
            self.groups[idx].phase = Phase::Pending;
            emit("swap_failed", json!({ "group": group, "reason": "no output received" }));
            return;
        }
        let g = &mut self.groups[idx];
        g.phase = Phase::Swapped;
        g.out_total = U128(delta);
        g.swap_share = g.total_share;
        emit("swap_done", json!({ "group": group, "asset": self.config.asset_plan[idx].token, "near_in": g.total_share, "out": U128(delta) }));
    }

    #[private]
    pub fn on_before_wrap(&mut self, #[callback_result] before: Result<U128, PromiseError>, group: u8, amount: U128) -> PromiseOrValue<()> {
        let idx = group as usize;
        let Ok(before) = before else {
            self.groups[idx].phase = Phase::Pending;
            emit("swap_failed", json!({ "group": group, "reason": "balance check failed" }));
            return PromiseOrValue::Value(());
        };
        let wrap = self.config.wrap_account.clone();
        PromiseOrValue::Promise(
            ext_ft::ext(wrap.clone()).with_static_gas(GAS_REGISTER).with_attached_deposit(REGISTRATION_RESERVE)
                .storage_deposit(Some(env::current_account_id()), Some(true))
                .then(ext_wrap::ext(wrap.clone()).with_static_gas(GAS_WRAP).with_attached_deposit(NearToken::from_yoctonear(amount.0)).near_deposit())
                .then(ext_balance::ext(wrap).with_static_gas(GAS_BALANCE).ft_balance_of(env::current_account_id()))
                // wrapping is 1:1, so the minimum is the whole amount
                .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_AFTER).on_after(group, before, amount)),
        )
    }

    /// A wNEAR group: wrapping is the whole settlement (1 NEAR = 1 wNEAR).
    #[private]
    pub fn on_wrapped(&mut self, #[callback_result] r: Result<(), PromiseError>, group: u8, amount: U128) {
        let g = &mut self.groups[group as usize];
        if r.is_err() {
            g.phase = Phase::Pending;
            emit("swap_failed", json!({ "group": group, "reason": "wrap failed" }));
            return;
        }
        g.phase = Phase::Swapped;
        g.out_total = amount;
        g.swap_share = g.total_share;
        emit("swap_done", json!({ "group": group, "asset": self.config.wrap_account, "near_in": amount, "out": amount }));
    }

    /// Permissionless: a swap whose callbacks never landed would block burns and crediting
    /// forever. After the timeout the group returns to `Pending` (escrow records are untouched).
    pub fn abort_swap(&mut self, group: u8) {
        let g = self.groups.get_mut(group as usize).unwrap_or_else(|| quorum_common::fail("Unknown group"));
        require!(g.phase == Phase::Swapping, "No swap in progress");
        require!(env::block_timestamp_ms() >= g.swap_started_ms.0 + SWAP_TIMEOUT_MS, "The swap may still be in flight");
        g.phase = Phase::Pending;
        emit("swap_aborted", json!({ "group": group }));
    }

    /// Permissionless: if nobody settled within the grace period, credit plain NEAR.
    pub fn enable_fallback(&mut self, group: u8) {
        let closed_at = self.mint_closed_at_ms().unwrap_or_else(|| quorum_common::fail("The mint is still open")).0;
        require!(env::block_timestamp_ms() >= closed_at + self.config.settle_grace_ms.0, "The grace period has not passed");
        require!(self.pending_mints == 0, "Mints are still being created");
        let g = self.groups.get_mut(group as usize).unwrap_or_else(|| quorum_common::fail("Unknown group"));
        require!(g.phase == Phase::Pending, "This group is not waiting for a swap");
        g.phase = Phase::Fallback;
        emit("fallback_enabled", json!({ "group": group }));
    }

    /// Permissionless: pushes each listed NFT's share into its vault. Up to 3 per call.
    pub fn credit_batch(&mut self, group: u8, token_ids: Vec<String>) {
        require!(!token_ids.is_empty() && token_ids.len() <= MAX_CREDIT_BATCH, "1 to 3 tokens per call");
        let idx = group as usize;
        require!(idx < self.groups.len(), "Unknown group");
        let phase = self.groups[idx].phase.clone();
        require!(phase == Phase::Swapped || phase == Phase::Fallback, "This group is not ready for crediting");
        let asset = self.config.asset_plan[idx].token.clone();
        let (out_total, swap_share) = (self.groups[idx].out_total.0, self.groups[idx].swap_share.0);
        if phase == Phase::Swapped {
            // Burns pay 10% of every vault asset to the treasury with a plain ft_transfer, which fails if
            // the treasury is not registered on that token. Registering it is cheap and idempotent.
            ext_ft::ext(asset.clone()).with_static_gas(GAS_REGISTER).with_attached_deposit(REGISTRATION_RESERVE)
                .storage_deposit(Some(self.config.treasury.clone()), Some(true)).detach();
        }
        for id in token_ids {
            let st = self.token_state.get_mut(&id).unwrap_or_else(|| quorum_common::fail("Unknown token"));
            require!(!st.burned, "Token is burned");
            require!(st.group == group, "Token belongs to a different group");
            require!(!st.credited, "Already credited");
            st.credited = true; // state first, payment after
            let share = st.share.0;
            let vault = vault_account(&id);
            let p = if phase == Phase::Fallback {
                ext_vault_credit::ext(vault).with_static_gas(GAS_CREDIT_CB).with_attached_deposit(NearToken::from_yoctonear(share)).credit_near()
                    .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CREDIT_CB).on_credited_near(id, U128(share)))
            } else {
                let amount = quorum_common::mul_div(out_total, share, swap_share.max(1));
                if amount == 0 {
                    continue; // dust: nothing to push; the token is simply marked credited
                }
                ext_ft::ext(asset.clone()).with_static_gas(GAS_REGISTER).with_attached_deposit(REGISTRATION_RESERVE)
                    .storage_deposit(Some(vault.clone()), Some(true))
                    .then(ext_ft::ext(asset.clone()).with_static_gas(GAS_CREDIT_FT).with_attached_deposit(YOCTO)
                        .ft_transfer_call(vault, U128(amount), Some("quorum credit".into()), String::new()))
                    .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CREDIT_CB).on_credited(id, U128(amount)))
            };
            // Independent promises (a callback may not return a joined one); each has its own
            // callback that restores that token if its credit fails.
            p.detach();
        }
    }

    #[private]
    pub fn on_credited(&mut self, #[callback_result] used: Result<U128, PromiseError>, token_id: String, amount: U128) {
        let ok = matches!(&used, Ok(u) if u.0 == amount.0);
        self.finish_credit(token_id, amount, ok);
    }

    #[private]
    pub fn on_credited_near(&mut self, #[callback_result] r: Result<(), PromiseError>, token_id: String, amount: U128) {
        self.finish_credit(token_id, amount, r.is_ok());
    }

    /// DAO only: unwraps wNEAR left over from a failed or partial swap back into NEAR.
    /// Open to anyone, it could unwrap the wNEAR backing a wNEAR group before crediting.
    pub fn unwrap_wnear(&mut self, amount: U128) -> Promise {
        require!(env::predecessor_account_id() == self.config.dao, "Only the DAO");
        ext_wrap::ext(self.config.wrap_account.clone()).with_static_gas(Gas::from_tgas(20)).with_attached_deposit(YOCTO).near_withdraw(amount)
    }

    pub fn settlement_status(&self) -> Vec<GroupView> {
        self.groups.iter().enumerate().map(|(i, g)| GroupView {
            index: i as u8,
            asset: self.config.asset_plan[i].token.clone(),
            weight: self.config.asset_plan[i].weight,
            phase: g.phase.clone(),
            total_share: g.total_share,
            out_total: g.out_total,
        }).collect()
    }
}

impl Contract {
    fn finish_credit(&mut self, token_id: String, amount: U128, ok: bool) {
        if ok {
            emit("credited", json!({ "token_id": token_id, "amount": amount }));
        } else {
            // The transfer did not land (vault refused or call failed): allow a retry.
            if let Some(st) = self.token_state.get_mut(&token_id) { st.credited = false; }
            emit("credit_failed", json!({ "token_id": token_id, "amount": amount }));
        }
    }
}
