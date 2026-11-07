//! Parameter changes (F5): only the DAO can change collection rules, and only by an
//! executed proposal. The founder can pause, lower the royalty, and (before the
//! first mint only) replace the vault code hash.

use crate::*;
use near_sdk::serde_json::json;
use near_sdk::{near, Gas};
use quorum_common::events::emit;

#[near(serializers = [json])]
pub struct SaleTerms {
    pub treasury: AccountId,
    pub royalty_bps: u16,
    pub royalty_recipient: AccountId,
}

#[near]
impl Contract {
    pub fn set_param(&mut self, key: String, value: String) {
        require!(env::predecessor_account_id() == self.config.dao, "Only the DAO");
        match key.as_str() {
            "paused" => self.config.paused = value.parse().unwrap_or_else(|_| env::panic_str("true or false")),
            "royalty_bps" => {
                let v: u16 = value.parse().unwrap_or_else(|_| env::panic_str("Invalid bps"));
                require!(quorum_common::SALE_POOL_BPS as u32 + v as u32 <= quorum_common::BPS as u32, "Pool fee plus royalty exceeds 100%");
                self.config.royalty_bps = v;
            }
            // Where swaps are sent. Changing it needs a vote, so a DEX migration does not need new code.
            "dex" => self.config.dex = value.parse().unwrap_or_else(|_| env::panic_str("Invalid account")),
            "vault_allowlist_add" => {
                if !self.config.vault_allowlist.contains(&value) {
                    require!(self.config.vault_allowlist.len() < MAX_ASSET_TYPES, "Allow-list full");
                    self.config.vault_allowlist.push(value.clone());
                }
            }
            "vault_allowlist_remove" => {
                // Plan assets and NEAR must stay depositable; removal affects new deposits only.
                let protected = value == NATIVE_NEAR || self.config.asset_plan.iter().any(|p| ft_asset(&p.token) == value);
                require!(!protected, "Plan assets and NEAR must stay on the allow-list");
                self.config.vault_allowlist.retain(|a| a != &value);
            }
            _ => env::panic_str("Unknown parameter"),
        }
        emit("param_changed", json!({ "key": key, "value": value }));
    }

    /// Launch-time fix for the vault code. Allowed ONLY before the first mint:
    /// vaults already created keep the code they were made with.
    pub fn set_vault_code_hash(&mut self, hash: near_sdk::json_types::Base58CryptoHash) {
        require!(env::predecessor_account_id() == self.config.founder, "Only the founder");
        require!(self.minted_total == 0, "Locked: a vault has already been minted");
        self.config.vault_code_hash = hash;
        emit("vault_code_hash_set", json!({ "hash": hash }));
    }

    /// Mints can be halted (not funds moved) by the founder or the DAO.
    pub fn set_paused(&mut self, paused: bool) {
        let who = env::predecessor_account_id();
        require!(who == self.config.founder || who == self.config.dao, "Only the founder or the DAO");
        self.config.paused = paused;
        emit("param_changed", json!({ "key": "paused", "value": paused.to_string() }));
    }

    /// The founder can lower the royalty at any time; raising needs a DAO vote.
    pub fn lower_royalty(&mut self, bps: u16) {
        require!(env::predecessor_account_id() == self.config.founder, "Only the founder");
        require!(bps < self.config.royalty_bps, "Can only lower the royalty; raising needs a DAO vote");
        self.config.royalty_bps = bps;
        emit("param_changed", json!({ "key": "royalty_bps", "value": bps.to_string() }));
    }

    pub fn sale_terms(&self) -> SaleTerms {
        SaleTerms {
            treasury: self.config.treasury.clone(),
            royalty_bps: self.config.royalty_bps,
            royalty_recipient: self.config.royalty_recipient.clone(),
        }
    }

    /// Re-registers a token with the treasury if the mint-time call failed.
    pub fn retry_register(&mut self, token_id: String) {
        let (_, _) = self.live_owner(&token_id);
        quorum_common::ext::ext_treasury::ext(self.config.treasury.clone())
            .with_static_gas(Gas::from_tgas(20))
            .register_token(token_id)
            .detach();
    }
}
