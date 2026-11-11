//! F1 + section 16: staged mint paid in plain NEAR.
//!
//! The buyer attaches NEAR: the stage price plus `mint_storage_cost`. Panicking
//! here refunds the whole deposit automatically, so every rejected mint is safe.
//! Accepted mints reserve a supply slot, then create the NFT's keyless vault
//! account. Only after the vault exists is the token minted:
//!   * half the price (the remainder after flooring the escrow half) goes to the
//!     treasury at once;
//!   * the other half stays here as the token's escrow share until settlement.
//! If vault creation fails, nothing is minted and price + storage are refunded.

use crate::*;
use near_contract_standards::non_fungible_token::metadata::TokenMetadata;
use near_sdk::json_types::{Base64VecU8, U128, U64};
use near_sdk::serde_json::{self, json};
use near_sdk::{near, Gas, NearToken, Promise, PromiseError};
use quorum_common::events::emit;
use quorum_common::mint_split;

const GAS_VAULT_NEW: Gas = Gas::from_tgas(15);
const GAS_CALLBACK: Gas = Gas::from_tgas(30);

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum StageKind {
    Presale,
    Public,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Stage {
    pub name: String,
    pub kind: StageKind,
    /// Price in yoctoNEAR.
    pub price_near: U128,
    pub start_ms: U64,
    pub end_ms: U64,
    pub per_wallet_limit: u32,
    /// sha256 Merkle root of allowed accounts (presale only).
    pub merkle_root: Option<Base64VecU8>,
}

pub fn validate_stages(stages: &[Stage]) {
    require!(!stages.is_empty(), "At least one stage");
    for (i, s) in stages.iter().enumerate() {
        require!(s.start_ms.0 < s.end_ms.0, "Stage must end after it starts");
        require!(s.price_near.0 > 0, "Stage price must be positive");
        require!(s.per_wallet_limit > 0, "Per-wallet limit must be positive");
        match s.kind {
            StageKind::Presale => {
                let root = s.merkle_root.as_ref().unwrap_or_else(|| quorum_common::fail("Presale needs an allowlist root"));
                require!(root.0.len() == 32, "Merkle root must be 32 bytes");
                require!(i + 1 < stages.len(), "Public stage must be last");
            }
            StageKind::Public => require!(i + 1 == stages.len(), "Public stage must be last"),
        }
    }
}

pub(crate) fn count_key(stage: u32, account: &AccountId) -> String {
    format!("{stage}:{account}")
}

#[near]
impl Contract {
    /// Mint one NFT. Attach `stage price + mint_storage_cost` (any excess is returned).
    #[payable]
    pub fn mint(&mut self, stage: u32, proof: Option<Vec<Base64VecU8>>) -> Promise {
        let buyer = env::predecessor_account_id();
        let cfg = self.config.clone();
        require!(!cfg.paused, "Minting is paused");
        let st = cfg.stages.get(stage as usize).unwrap_or_else(|| quorum_common::fail("Unknown stage")).clone();
        let now = env::block_timestamp_ms();
        require!(now >= st.start_ms.0 && now < st.end_ms.0, "Stage is not active");
        if st.kind == StageKind::Presale {
            let root: [u8; 32] = st.merkle_root.as_ref().unwrap().0.as_slice().try_into().unwrap();
            let proof: Vec<Vec<u8>> = proof.unwrap_or_default().into_iter().map(|p| p.0).collect();
            require!(crate::merkle::verify(&root, buyer.as_str(), &proof), "Not on the allowlist");
        }
        let ck = count_key(stage, &buyer);
        let minted = self.mint_counts.get(&ck).copied().unwrap_or(0);
        require!(minted < st.per_wallet_limit, "Wallet limit reached");
        require!(self.minted_total < cfg.max_supply, "Sold out");

        let price = st.price_near.0;
        let storage = cfg.mint_storage_cost.as_yoctonear();
        let required = price + storage;
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit >= required, "Attach the stage price plus the storage cost");

        // Reserve everything before any outbound call.
        self.mint_counts.insert(ck, minted + 1);
        self.minted_total += 1;
        self.pending_mints += 1;
        if self.minted_total == cfg.max_supply { self.sold_out_at_ms = Some(now); }
        let number = self.minted_total;
        let token_id = number.to_string();
        let group = group_of(&cfg.asset_plan, number);

        if deposit > required {
            Promise::new(buyer.clone()).transfer(NearToken::from_yoctonear(deposit - required)).detach();
        }
        let vault = vault_account(&token_id);
        let vault_funds = storage - REGISTRATION_RESERVE.as_yoctonear();
        Promise::new(vault)
            .create_account()
            .transfer(NearToken::from_yoctonear(vault_funds))
            .use_global_contract(<[u8; 32]>::from(cfg.vault_code_hash))
            .function_call(
                "new".to_string(),
                serde_json::to_vec(&json!({ "treasury": cfg.treasury, "token_id": token_id })).unwrap(),
                NearToken::from_yoctonear(0),
                GAS_VAULT_NEW,
            )
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CALLBACK).on_vault_ready(token_id, buyer, stage, U128(price), group))
    }

    #[private]
    pub fn on_vault_ready(&mut self, #[callback_result] created: Result<(), PromiseError>, token_id: String, buyer: AccountId, stage: u32, price: U128, group: u8) {
        self.pending_mints -= 1;
        let storage = self.config.mint_storage_cost.as_yoctonear();
        if created.is_err() {
            // Nothing minted: release the slot and refund price + storage.
            self.minted_total -= 1;
            if self.minted_total < self.config.max_supply { self.sold_out_at_ms = None; }
            let ck = count_key(stage, &buyer);
            let c = self.mint_counts.get(&ck).copied().unwrap_or(1);
            self.mint_counts.insert(ck, c.saturating_sub(1));
            emit("mint_failed", json!({ "token_id": token_id, "buyer": buyer }));
            Promise::new(buyer).transfer(NearToken::from_yoctonear(price.0 + storage)).detach();
            return;
        }
        let (escrow, to_treasury) = mint_split(price.0);
        let metadata = TokenMetadata {
            title: Some(format!("{} #{}", self.metadata.name, token_id)),
            description: None,
            media: Some(format!("{}/{}", self.config.media_base_url, token_id)),
            media_hash: None,
            copies: None,
            issued_at: Some(env::block_timestamp_ms().to_string()),
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: None,
            reference: Some(format!("{}/metadata/{}.json", self.config.metadata_base_url, token_id)),
            reference_hash: None,
        };
        self.tokens.internal_mint_with_refund(token_id.clone(), buyer.clone(), Some(metadata), None);
        self.token_state.insert(token_id.clone(), TokenState {
            last_transfer_block: U64(env::block_height()), burned: false, share: U128(escrow), group, credited: false,
        });
        self.live_supply += 1;
        let g = &mut self.groups[group as usize];
        g.total_share = U128(g.total_share.0 + escrow);
        near_contract_standards::non_fungible_token::events::NftMint { owner_id: &buyer, token_ids: &[&token_id], memo: None }.emit();

        // The treasury's half moves now, one mint at a time.
        Promise::new(self.config.treasury.clone()).transfer(NearToken::from_yoctonear(to_treasury)).detach();
        quorum_common::ext::ext_treasury::ext(self.config.treasury.clone())
            .with_static_gas(Gas::from_tgas(20))
            .register_token(token_id.clone())
            .detach();
        emit("mint", json!({
            "token_id": token_id, "buyer": buyer, "price": price, "escrow_share": U128(escrow),
            "pool_share": U128(to_treasury), "vault": vault_account(&token_id),
            "asset": self.config.asset_plan[group as usize].token,
        }));
    }

    pub fn active_stage(&self) -> Option<u32> {
        let now = env::block_timestamp_ms();
        self.config.stages.iter().position(|s| s.start_ms.0 <= now && now < s.end_ms.0).map(|i| i as u32)
    }

    pub fn mints_by(&self, stage: u32, account_id: AccountId) -> u32 {
        self.mint_counts.get(&count_key(stage, &account_id)).copied().unwrap_or(0)
    }

    /// True once the last stage ended or the collection sold out.
    pub fn mint_closed(&self) -> bool {
        self.sold_out_at_ms.is_some() || env::block_timestamp_ms() >= self.last_stage_end()
    }

    /// When the mint closed (earlier of sell-out and the last stage's end), once it has.
    pub fn mint_closed_at_ms(&self) -> Option<U64> {
        if !self.mint_closed() { return None; }
        Some(U64(self.sold_out_at_ms.map(|s| s.min(self.last_stage_end())).unwrap_or(self.last_stage_end())))
    }

    /// What a buyer must attach for `stage`: price plus the storage cost.
    pub fn mint_cost(&self, stage: u32) -> Option<U128> {
        self.config.stages.get(stage as usize).map(|s| U128(s.price_near.0 + self.config.mint_storage_cost.as_yoctonear()))
    }
}

impl Contract {
    pub(crate) fn last_stage_end(&self) -> u64 {
        self.config.stages.last().map(|s| s.end_ms.0).unwrap_or(0)
    }
}
