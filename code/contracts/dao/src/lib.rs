//! quorum-dao: proposals and one-NFT-one-vote governance (F5).
//!
//! * Votes arrive only from quorum-nft, which has already checked ownership in
//!   the same receipt. The DAO enforces the rest: window, one vote per token,
//!   and `last_transfer_block < start_block` (a token that changed hands after
//!   a proposal opened cannot vote on it).
//! * Quorum is a share of the live supply recorded when the proposal opened,
//!   so burning during a vote cannot swing it.
//! * Anyone can execute a passed proposal after its timelock. `executed` is set
//!   BEFORE the outbound call; a failed call clears it so the proposal can be
//!   retried (F6).

use near_sdk::json_types::{U128, U64};
use near_sdk::serde_json::json;
use near_sdk::store::{LookupMap, LookupSet};
use near_sdk::{env, ext_contract, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseError};
use quorum_common::events::emit;
use quorum_common::swap::Hop;

const GAS_EXEC: Gas = Gas::from_tgas(100);
/// A swap chain (register, wrap, DEX call, balance check, callbacks) needs far more.
const GAS_SWAP_EXEC: Gas = Gas::from_tgas(250);
const GAS_CB: Gas = Gas::from_tgas(20);
const DAY_MS: u64 = 86_400_000;

#[ext_contract(ext_treasury_dao)]
pub trait TreasuryDao {
    fn spend(&mut self, recipient: AccountId, asset: String, amount: U128, purpose: String);
    fn distribute(&mut self, asset: String, amount: U128);
}

#[ext_contract(ext_nft_param)]
pub trait NftParam {
    fn set_param(&mut self, key: String, value: String);
    fn settle_group(&mut self, group: u8, hops: Vec<Hop>, min_out: U128);
}

#[ext_contract(ext_treasury_ops)]
pub trait TreasuryOps {
    fn swap(&mut self, token_in: String, amount: U128, token_out: AccountId, hops: Vec<Hop>, min_out: U128, dex: AccountId);
    fn set_param(&mut self, key: String, value: String);
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Kind {
    Spend { recipient: AccountId, asset: String, amount: U128 },
    Distribute { asset: String, amount: U128 },
    ParameterChange { key: String, value: String },
    /// Swap one asset group's escrowed NEAR into its asset through Rhea. Carries the
    /// route and the minimum output holders approve.
    Settle { group: u8, hops: Vec<Hop>, min_out: U128 },
    /// Swap treasury funds into another asset (`token_in` is `near` or `nep141:<token>`).
    Swap { token_in: String, amount: U128, token_out: AccountId, hops: Vec<Hop>, min_out: U128, dex: AccountId },
    Text,
}

impl Kind {
    fn slot(&self) -> usize {
        match self { Kind::Spend { .. } | Kind::Swap { .. } | Kind::Settle { .. } => 0, Kind::Distribute { .. } => 1, Kind::ParameterChange { .. } => 2, Kind::Text => 3 }
    }
}

/// Founder-set floor a proposer must respect, per proposal kind (F5).
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Bounds {
    pub min_period_ms: U64,
    pub min_quorum_bps: u16,
    pub min_pass_bps: u16,
    pub min_timelock_ms: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub kind: Kind,
    pub proposer: AccountId,
    pub purpose: String,
    pub start_block: U64,
    pub start_ms: U64,
    pub voting_end_ms: U64,
    pub quorum_bps: u16,
    pub pass_bps: u16,
    pub timelock_ms: U64,
    /// Live supply when the proposal opened.
    pub supply: U64,
    pub yes: U64,
    pub no: U64,
    pub abstain: U64,
    pub executed: bool,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Status { Voting, Passed, Failed, Executed }

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum Key { Proposals, Votes }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Dao {
    nft: AccountId,
    treasury: AccountId,
    bounds: Vec<Bounds>,
    next_id: u64,
    proposals: LookupMap<u64, Proposal>,
    votes: LookupSet<String>,
}

pub fn default_bounds() -> Vec<Bounds> {
    let b = |days: u64, quorum: u16, pass: u16, lock_days: u64| Bounds {
        min_period_ms: U64(days * DAY_MS), min_quorum_bps: quorum, min_pass_bps: pass, min_timelock_ms: U64(lock_days * DAY_MS),
    };
    // Order matches Kind::slot: spend, distribute, parameter change, text.
    vec![b(3, 1000, 5000, 2), b(3, 1000, 5000, 1), b(5, 1500, 6000, 3), b(2, 500, 5000, 0)]
}

#[near]
impl Dao {
    #[init]
    pub fn new(nft: AccountId, treasury: AccountId, bounds: Option<Vec<Bounds>>) -> Self {
        let bounds = bounds.unwrap_or_else(default_bounds);
        require!(bounds.len() == 4, "Need bounds for 4 proposal kinds");
        Self { nft, treasury, bounds, next_id: 1, proposals: LookupMap::new(Key::Proposals), votes: LookupSet::new(Key::Votes) }
    }

    /// Called by quorum-nft after it checked the proposer is a holder or the
    /// founder, passing its own live supply.
    pub fn create_proposal(&mut self, proposer: AccountId, kind: Kind, purpose: String, voting_period_ms: U64, quorum_bps: u16, pass_bps: u16, timelock_ms: U64, live_supply: U64) -> u64 {
        require!(env::predecessor_account_id() == self.nft, "Only the NFT contract");
        require!(live_supply.0 > 0, "No live NFTs");
        require!(!purpose.trim().is_empty(), "A purpose is required");
        if let Kind::Spend { amount, .. } | Kind::Distribute { amount, .. } | Kind::Swap { amount, .. } = &kind {
            require!(amount.0 > 0, "Amount must be positive");
        }
        if let Kind::Settle { min_out, .. } | Kind::Swap { min_out, .. } = &kind {
            require!(min_out.0 > 0, "A minimum output is required");
        }
        let b = &self.bounds[kind.slot()];
        require!(voting_period_ms.0 >= b.min_period_ms.0, "Voting period below the founder minimum");
        require!(quorum_bps >= b.min_quorum_bps && quorum_bps <= 10_000, "Quorum below the founder minimum");
        require!(pass_bps >= b.min_pass_bps && pass_bps < 10_000, "Pass threshold below the founder minimum");
        require!(timelock_ms.0 >= b.min_timelock_ms.0, "Timelock below the founder minimum");
        let now = env::block_timestamp_ms();
        let id = self.next_id;
        self.next_id += 1;
        let p = Proposal {
            id, kind, proposer, purpose, start_block: U64(env::block_height()), start_ms: U64(now),
            voting_end_ms: U64(now + voting_period_ms.0), quorum_bps, pass_bps, timelock_ms, supply: live_supply,
            yes: U64(0), no: U64(0), abstain: U64(0), executed: false,
        };
        emit("proposal_created", json!({ "id": id, "proposal": p }));
        self.proposals.insert(id, p);
        id
    }

    /// choice: 0 = no, 1 = yes, 2 = abstain.
    pub fn record_vote(&mut self, proposal_id: u64, voter: AccountId, token_id: String, last_transfer_block: U64, choice: u8) {
        require!(env::predecessor_account_id() == self.nft, "Only the NFT contract");
        let now = env::block_timestamp_ms();
        let p = self.proposals.get_mut(&proposal_id).unwrap_or_else(|| env::panic_str("No such proposal"));
        require!(now >= p.start_ms.0 && now < p.voting_end_ms.0, "Outside the voting window");
        require!(last_transfer_block.0 < p.start_block.0, "Token changed hands after this proposal opened");
        let key = format!("{proposal_id}:{token_id}");
        require!(!self.votes.contains(&key), "This token already voted");
        self.votes.insert(key);
        let p = self.proposals.get_mut(&proposal_id).unwrap();
        match choice {
            0 => p.no = U64(p.no.0 + 1),
            1 => p.yes = U64(p.yes.0 + 1),
            2 => p.abstain = U64(p.abstain.0 + 1),
            _ => env::panic_str("Choice must be 0, 1 or 2"),
        }
        emit("vote", json!({ "proposal_id": proposal_id, "voter": voter, "token_id": token_id, "choice": choice }));
    }

    /// Anyone can execute once the proposal passed and its timelock elapsed.
    pub fn execute(&mut self, proposal_id: u64) -> Promise {
        let status = self.status_of(proposal_id);
        require!(status == Status::Passed, "Proposal has not passed or was already executed");
        let p = self.proposals.get_mut(&proposal_id).unwrap();
        require!(env::block_timestamp_ms() >= p.voting_end_ms.0 + p.timelock_ms.0, "Timelock has not elapsed");
        p.executed = true; // before the outbound call
        let (kind, purpose) = (p.kind.clone(), p.purpose.clone());
        emit("proposal_executed", json!({ "id": proposal_id }));
        let call = match kind {
            Kind::Spend { recipient, asset, amount } => ext_treasury_dao::ext(self.treasury.clone()).with_static_gas(GAS_EXEC).spend(recipient, asset, amount, purpose),
            Kind::Distribute { asset, amount } => ext_treasury_dao::ext(self.treasury.clone()).with_static_gas(GAS_EXEC).distribute(asset, amount),
            // Keys starting with `treasury:` configure the treasury (for example `treasury:allow_dex`).
            Kind::ParameterChange { key, value } => match key.strip_prefix("treasury:") {
                Some(k) => ext_treasury_ops::ext(self.treasury.clone()).with_static_gas(GAS_EXEC).set_param(k.to_string(), value),
                None => ext_nft_param::ext(self.nft.clone()).with_static_gas(GAS_EXEC).set_param(key, value),
            },
            Kind::Settle { group, hops, min_out } => ext_nft_param::ext(self.nft.clone()).with_static_gas(GAS_SWAP_EXEC).settle_group(group, hops, min_out),
            Kind::Swap { token_in, amount, token_out, hops, min_out, dex } => ext_treasury_ops::ext(self.treasury.clone()).with_static_gas(GAS_SWAP_EXEC).swap(token_in, amount, token_out, hops, min_out, dex),
            Kind::Text => Promise::new(env::current_account_id()).transfer(NearToken::from_yoctonear(0)),
        };
        call.then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_executed(proposal_id))
    }

    #[private]
    pub fn on_executed(&mut self, #[callback_result] r: Result<(), PromiseError>, proposal_id: u64) {
        if r.is_err() {
            if let Some(p) = self.proposals.get_mut(&proposal_id) { p.executed = false; }
            emit("proposal_execution_failed", json!({ "id": proposal_id }));
        }
    }

    // ----------------------------------------------------------------- views
    pub fn get_proposal(&self, proposal_id: u64) -> Option<&Proposal> { self.proposals.get(&proposal_id) }
    pub fn proposal_count(&self) -> u64 { self.next_id - 1 }
    pub fn get_bounds(&self) -> &Vec<Bounds> { &self.bounds }
    pub fn has_voted(&self, proposal_id: u64, token_id: String) -> bool { self.votes.contains(&format!("{proposal_id}:{token_id}")) }

    pub fn status_of(&self, proposal_id: u64) -> Status {
        let p = self.proposals.get(&proposal_id).unwrap_or_else(|| env::panic_str("No such proposal"));
        if p.executed { return Status::Executed; }
        if env::block_timestamp_ms() < p.voting_end_ms.0 { return Status::Voting; }
        let turnout = (p.yes.0 + p.no.0 + p.abstain.0) as u128 * 10_000;
        let quorum_met = turnout >= p.supply.0 as u128 * p.quorum_bps as u128;
        // Strictly more than the threshold: ties fail. Abstain counts for quorum only.
        let passed = p.yes.0 as u128 * 10_000 > (p.yes.0 + p.no.0) as u128 * p.pass_bps as u128;
        if quorum_met && passed { Status::Passed } else { Status::Failed }
    }
}

#[cfg(test)]
mod tests;
