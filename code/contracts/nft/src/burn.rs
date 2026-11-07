//! F3: burn-to-redeem. Instant, with no cooldown after a transfer.
//! Order matters: the token is marked burned and removed BEFORE any payment,
//! so it can never vote, be listed or be redeemed twice.
//!
//! Three situations, depending on where the NFT's money is:
//! * Before settlement the money is NEAR escrow in this contract: the holder gets
//!   90% in NEAR, the treasury 10%.
//! * While a swap is in flight, burning waits (the escrow is mid-conversion).
//! * After settlement the money must first be credited to the vault (anyone can do
//!   that); then the vault pays out 90/10 per asset as before.

use crate::*;
use near_contract_standards::non_fungible_token::events::NftBurn;
use near_sdk::serde_json::json;
use near_sdk::{near, Gas, NearToken, Promise};
use quorum_common::events::emit;
use quorum_common::ext::{ext_treasury, ext_vault};
use quorum_common::redeem_split;

const GAS_REDEEM: Gas = Gas::from_tgas(150);
const GAS_TREASURY: Gas = Gas::from_tgas(20);

#[near]
impl Contract {
    #[payable]
    pub fn burn_and_redeem(&mut self, token_id: String) -> Promise {
        near_sdk::assert_one_yocto();
        let burner = env::predecessor_account_id();
        // Ownership comes from contract state, never from caller input.
        let owner = self.tokens.owner_by_id.get(&token_id).unwrap_or_else(|| env::panic_str("Unknown token"));
        require!(owner == burner, "Only the owner can burn");
        let st = self.token_state.get(&token_id).cloned().unwrap_or_else(|| env::panic_str("Unknown token"));
        require!(!st.burned, "Already burned");
        let gi = st.group as usize;
        let phase = self.groups[gi].phase.clone();
        let from_escrow = match (&phase, st.credited) {
            (Phase::Swapping, _) => env::panic_str("A swap is in progress: try again once it settles"),
            (Phase::Swapped | Phase::Fallback, false) => env::panic_str("Credit this NFT's vault first: anyone can call credit_batch"),
            (Phase::Pending, _) => true,
            (_, true) => false,
        };

        self.token_state.get_mut(&token_id).unwrap().burned = true;
        self.live_supply -= 1;
        self.remove_token(&token_id, &burner);
        NftBurn { owner_id: &burner, token_ids: &[&token_id], authorized_id: None, memo: None }.emit();
        emit("burn", json!({ "token_id": token_id, "holder": burner, "live_supply": U64(self.live_supply), "from_escrow": from_escrow }));

        ext_treasury::ext(self.config.treasury.clone()).with_static_gas(GAS_TREASURY).on_token_burned(token_id.clone(), burner.clone()).detach();

        if from_escrow {
            let share = st.share.0;
            let g = &mut self.groups[gi];
            g.total_share = U128(g.total_share.0 - share);
            let (to_holder, to_pool) = redeem_split(share);
            emit("escrow_refund", json!({ "token_id": token_id, "holder": burner, "to_holder": U128(to_holder), "to_pool": U128(to_pool) }));
            Promise::new(self.config.treasury.clone()).transfer(NearToken::from_yoctonear(to_pool)).detach();
            return Promise::new(burner).transfer(NearToken::from_yoctonear(to_holder));
        }
        ext_vault::ext(vault_account(&token_id)).with_static_gas(GAS_REDEEM).redeem(burner)
    }
}

impl Contract {
    fn remove_token(&mut self, token_id: &str, owner: &AccountId) {
        let id = token_id.to_string();
        self.tokens.owner_by_id.remove(&id);
        if let Some(m) = self.tokens.token_metadata_by_id.as_mut() { m.remove(&id); }
        if let Some(a) = self.tokens.approvals_by_id.as_mut() { a.remove(&id); }
        if let Some(a) = self.tokens.next_approval_id_by_id.as_mut() { a.remove(&id); }
        if let Some(per_owner) = self.tokens.tokens_per_owner.as_mut() {
            if let Some(mut set) = per_owner.get(owner) {
                set.remove(&id);
                if set.is_empty() { per_owner.remove(owner); } else { per_owner.insert(owner, &set); }
            }
        }
    }
}
