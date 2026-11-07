//! quorum-nft: one Quorum collection (NEAR-only mint, assets assigned per NFT).
//!
//! Money flow:
//! 1. MINT: the buyer attaches NEAR (stage price + a small storage cost). Half the
//!    price goes straight to the DAO treasury. The other half stays in THIS
//!    contract as that NFT's escrow share, recorded per token.
//! 2. Each NFT belongs to an asset group fixed at launch (`asset_plan`, assigned
//!    round-robin by token number, so nobody can steer who gets what).
//! 3. SETTLEMENT (after the mint closes): the DAO votes to swap a group's whole
//!    escrow through Rhea (Ref) into that group's asset. Anyone then credits each
//!    NFT's vault its pro-rata share (`credit_batch`).
//! 4. FALLBACK: if no swap is done within the grace period, anyone can enable
//!    plain-NEAR crediting, so a missing DAO can never strand funds.
//! 5. BURN before settlement refunds 90% of the escrow share in NEAR (10% to the
//!    treasury). After settlement it redeems the vault, as before.

mod burn;
mod governance;
mod merkle;
mod mint;
mod nep171;
mod params;
mod settle;

#[cfg(test)]
mod tests;

use near_contract_standards::non_fungible_token::metadata::{NFTContractMetadata, NFT_METADATA_SPEC};
use near_contract_standards::non_fungible_token::NonFungibleToken;
use near_sdk::json_types::{Base58CryptoHash, Base64VecU8, U128, U64};
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault};
use quorum_common::asset::{ft_asset, NATIVE_NEAR};
use quorum_common::{AssetId, MAX_ASSET_TYPES};

pub use mint::{Stage, StageKind};
pub use settle::{Group, Phase};

/// NEAR kept in this contract per mint to register the NFT's vault on its asset token.
pub const REGISTRATION_RESERVE: NearToken = NearToken::from_millinear(5);

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum Key {
    Owners,
    Metadata,
    Enumeration,
    Approvals,
    TokenState,
    MintCounts,
}

/// One asset group: NFTs numbered by weight get `token` as their backing asset.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct PlanEntry {
    /// NEP-141 token. Using `wrap_account` itself means "hold wNEAR": no swap needed.
    pub token: AccountId,
    pub weight: u16,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Config {
    pub founder: AccountId,
    pub treasury: AccountId,
    /// Only this account may change parameters after launch (F5, principle 4).
    pub dao: AccountId,
    /// Assets owners may add to vaults. Always includes NEAR and every plan asset.
    pub vault_allowlist: Vec<AssetId>,
    /// By-hash global contract the vaults reference. Immutable code.
    pub vault_code_hash: Base58CryptoHash,
    /// Paid on top of the price: funds the vault account and its token registration.
    pub mint_storage_cost: NearToken,
    pub max_supply: u64,
    pub stages: Vec<Stage>,
    pub royalty_bps: u16,
    pub royalty_recipient: AccountId,
    pub metadata_base_url: String,
    pub media_base_url: String,
    pub paused: bool,
    /// sha256 of the complete final art + traits set, committed at launch.
    #[serde(default)]
    pub provenance_hash: Option<Base64VecU8>,
    /// Which asset each NFT carries. Fixed at launch; not changeable by anyone.
    pub asset_plan: Vec<PlanEntry>,
    /// Rhea/Ref classic-pool DEX that swaps are sent to, e.g. `v2.ref-finance.near`.
    pub dex: AccountId,
    /// wNEAR token, e.g. `wrap.near`.
    pub wrap_account: AccountId,
    /// How long after the mint closes before anyone may enable the NEAR fallback.
    pub settle_grace_ms: U64,
}

/// Quorum's per-token state, kept beside the NEP-171 maps.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct TokenState {
    /// A token can vote only on proposals that started after this block (F5).
    pub last_transfer_block: U64,
    pub burned: bool,
    /// This NFT's half of its mint price, held in this contract until settlement.
    pub share: U128,
    /// Index into `asset_plan`.
    pub group: u8,
    /// True once its vault has been credited (settlement done for this token).
    pub credited: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub(crate) tokens: NonFungibleToken,
    pub(crate) metadata: NFTContractMetadata,
    pub(crate) config: Config,
    pub(crate) token_state: LookupMap<String, TokenState>,
    pub(crate) mint_counts: LookupMap<String, u32>,
    pub(crate) groups: Vec<Group>,
    /// Supply slots used, including mints still creating their vault.
    pub(crate) minted_total: u64,
    pub(crate) pending_mints: u64,
    pub(crate) live_supply: u64,
    pub(crate) sold_out_at_ms: Option<u64>,
}

#[near(serializers = [json])]
pub struct InitArgs {
    pub metadata: NFTContractMetadata,
    pub config: Config,
}

#[near]
impl Contract {
    #[init]
    pub fn new(args: InitArgs) -> Self {
        let InitArgs { metadata, mut config } = args;
        metadata.assert_valid();
        require!(metadata.spec == NFT_METADATA_SPEC, "Wrong metadata spec");
        // Plan assets and NEAR are always depositable.
        for a in std::iter::once(NATIVE_NEAR.to_string()).chain(config.asset_plan.iter().map(|p| ft_asset(&p.token))) {
            if !config.vault_allowlist.contains(&a) { config.vault_allowlist.push(a); }
        }
        validate_config(&config);
        let groups = config.asset_plan.iter().map(|_| Group::default()).collect();
        Self {
            tokens: NonFungibleToken::new(
                Key::Owners, env::current_account_id(), Some(Key::Metadata), Some(Key::Enumeration), Some(Key::Approvals),
            ),
            metadata,
            config,
            token_state: LookupMap::new(Key::TokenState),
            mint_counts: LookupMap::new(Key::MintCounts),
            groups,
            minted_total: 0,
            pending_mints: 0,
            live_supply: 0,
            sold_out_at_ms: None,
        }
    }

    // ------------------------------------------------------------------ views

    pub fn get_config(&self) -> &Config { &self.config }
    pub fn nft_metadata(&self) -> &NFTContractMetadata { &self.metadata }
    pub fn token_state(&self, token_id: String) -> Option<&TokenState> { self.token_state.get(&token_id) }
    pub fn live_supply(&self) -> U64 { U64(self.live_supply) }
    pub fn minted_total(&self) -> U64 { U64(self.minted_total) }

    /// The vault account of a token. It exists for every minted token, burned or not.
    pub fn vault_of(&self, token_id: String) -> AccountId { vault_account(&token_id) }

    /// The asset an NFT will carry, known before it is minted (token numbers are sequential).
    pub fn asset_for_number(&self, number: u64) -> AccountId {
        self.config.asset_plan[group_of(&self.config.asset_plan, number) as usize].token.clone()
    }

    pub fn nft_traits(&self, token_id: String) -> Option<near_sdk::serde_json::Value> {
        let state = self.token_state.get(&token_id)?;
        if state.burned { return None; }
        let g = &self.groups[state.group as usize];
        Some(near_sdk::serde_json::json!({
            "token_id": token_id,
            "owner_id": self.tokens.owner_by_id.get(&token_id),
            "vault": vault_account(&token_id),
            "asset": self.config.asset_plan[state.group as usize].token,
            "escrow_share": state.share,
            "settlement": g.phase,
            "credited": state.credited,
            "last_transfer_block": state.last_transfer_block,
            "live_supply": U64(self.live_supply),
        }))
    }

    /// Called by vaults before accepting a deposit (F2).
    pub fn can_deposit(&self, token_id: String, sender: AccountId, asset: String) -> bool {
        let live = self.token_state.get(&token_id).map(|s| !s.burned).unwrap_or(false);
        live && self.tokens.owner_by_id.get(&token_id).as_ref() == Some(&sender)
            && self.config.vault_allowlist.contains(&asset)
    }
}

/// `v<token_id>.<this contract>`: a direct sub-account, the only kind a contract may create.
pub(crate) fn vault_account(token_id: &str) -> AccountId {
    format!("v{token_id}.{}", env::current_account_id())
        .parse()
        .unwrap_or_else(|_| env::panic_str("Invalid vault account"))
}

/// Round-robin by weight: token number n (1-based) -> group index. Public and
/// deterministic, so no one (including the founder) can steer who gets which asset.
pub(crate) fn group_of(plan: &[PlanEntry], number: u64) -> u8 {
    let total: u64 = plan.iter().map(|p| p.weight as u64).sum();
    let mut pos = (number - 1) % total;
    for (i, p) in plan.iter().enumerate() {
        if pos < p.weight as u64 { return i as u8; }
        pos -= p.weight as u64;
    }
    unreachable!()
}

pub(crate) fn validate_config(c: &Config) {
    require!(c.vault_allowlist.len() <= MAX_ASSET_TYPES, "Allow-list too long");
    require!(
        quorum_common::SALE_POOL_BPS as u32 + c.royalty_bps as u32 <= quorum_common::BPS as u32,
        "Pool fee plus royalty exceeds 100%"
    );
    require!(c.max_supply > 0, "Supply must be positive");
    if let Some(h) = &c.provenance_hash { require!(h.0.len() == 32, "Provenance hash must be 32 bytes"); }
    require!(!c.asset_plan.is_empty() && c.asset_plan.len() <= 7, "1 to 7 plan assets");
    for (i, p) in c.asset_plan.iter().enumerate() {
        require!(p.weight > 0, "Plan weights must be positive");
        require!(!c.asset_plan[..i].iter().any(|q| q.token == p.token), "Duplicate plan asset");
    }
    require!(c.mint_storage_cost.as_yoctonear() > REGISTRATION_RESERVE.as_yoctonear() + NearToken::from_millinear(15).as_yoctonear(), "Storage cost too small to fund a vault");
    mint::validate_stages(&c.stages);
}
