//! Research correction C5/C6: the DAO and treasury never read ownership
//! asynchronously. Holders call these methods here; this contract checks
//! ownership and the vote-eligibility rule locally, then forwards a call that
//! the DAO and treasury trust only because it comes from this contract.

use crate::*;
use near_sdk::{ext_contract, near, Gas, Promise};

const GAS_FORWARD: Gas = Gas::from_tgas(60);
/// record_vote is a few storage writes; 15 Tgas each keeps a full batch inside one transaction's 300 Tgas.
const GAS_VOTE: Gas = Gas::from_tgas(15);
pub const MAX_VOTE_BATCH: usize = 15;

#[ext_contract(ext_dao)]
pub trait Dao {
    fn record_vote(&mut self, proposal_id: u64, voter: AccountId, token_id: String, last_transfer_block: U64, choice: u8);
}

#[ext_contract(ext_dao_create)]
pub trait DaoCreate {
    fn create_proposal(&mut self, proposer: AccountId, kind: near_sdk::serde_json::Value, purpose: String, voting_period_ms: U64, quorum_bps: u16, pass_bps: u16, timelock_ms: U64, live_supply: U64);
}

#[ext_contract(ext_pool)]
pub trait Pool {
    fn claim_for(&mut self, token_id: String, owner: AccountId, asset: String);
}

#[near]
impl Contract {
    /// Vote with several tokens in one transaction (one forwarded call each).
    pub fn vote(&mut self, proposal_id: u64, token_ids: Vec<String>, choice: u8) -> Promise {
        require!(!token_ids.is_empty() && token_ids.len() <= MAX_VOTE_BATCH, "1 to 15 tokens per vote");
        let voter = env::predecessor_account_id();
        let mut joined: Option<Promise> = None;
        for id in token_ids {
            let (owner, st) = self.live_owner(&id);
            require!(owner == voter, "Not the owner of this token");
            let p = ext_dao::ext(self.config.dao.clone()).with_static_gas(GAS_VOTE)
                .record_vote(proposal_id, voter.clone(), id, st.last_transfer_block, choice);
            joined = Some(match joined { Some(j) => j.and(p), None => p });
        }
        joined.unwrap()
    }

    /// Holders and the founder can open proposals (F5). The DAO enforces the
    /// founder's minimum bounds; this contract passes its own live supply.
    pub fn propose(&mut self, kind: near_sdk::serde_json::Value, purpose: String, voting_period_ms: U64, quorum_bps: u16, pass_bps: u16, timelock_ms: U64) -> Promise {
        let who = env::predecessor_account_id();
        let holds = self.tokens.tokens_per_owner.as_ref().and_then(|m| m.get(&who)).map(|s| !s.is_empty()).unwrap_or(false);
        require!(holds || who == self.config.founder, "Only holders or the founder can propose");
        ext_dao_create::ext(self.config.dao.clone()).with_static_gas(GAS_FORWARD)
            .create_proposal(who, kind, purpose, voting_period_ms, quorum_bps, pass_bps, timelock_ms, U64(self.live_supply))
    }

    /// Claim a distribution for a live token you own (F7).
    pub fn claim_distribution(&mut self, token_id: String, asset: String) -> Promise {
        let who = env::predecessor_account_id();
        let (owner, _) = self.live_owner(&token_id);
        require!(owner == who, "Not the owner of this token");
        ext_pool::ext(self.config.treasury.clone()).with_static_gas(GAS_FORWARD).claim_for(token_id, who, asset)
    }
}

impl Contract {
    pub(crate) fn live_owner(&self, token_id: &str) -> (AccountId, TokenState) {
        let st = self.token_state.get(token_id).cloned().unwrap_or_else(|| env::panic_str("Unknown token"));
        require!(!st.burned, "Token is burned");
        let owner = self.tokens.owner_by_id.get(&token_id.to_string()).unwrap_or_else(|| env::panic_str("Unknown token"));
        (owner, st)
    }
}
