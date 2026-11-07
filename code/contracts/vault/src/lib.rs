//! quorum-vault: the account half of a Quorum NFT.
//!
//! One instance lives on each NFT's sub-account (`v<token_id>.<collection>`), which
//! has no access keys. The code is a by-hash global contract, so it can never
//! be changed. The rules this file enforces (scope F2, F3):
//!
//! * Only the current owner of the NFT can add assets, and only assets on the
//!   collection's allow-list. Ownership is asked of quorum-nft, never stored here,
//!   so control follows the NFT on every transfer automatically.
//! * There is no withdraw, transfer-out or admin method. The only outbound path
//!   is `redeem`, callable only by quorum-nft during a burn.
//! * Only recorded deposits count as backing. Plain NEAR sent to this account is
//!   not counted and is swept to the pool after redemption.

use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{
    env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError,
    PromiseOrValue,
};
use quorum_common::asset::{ft_asset, ft_contract, is_native, NATIVE_NEAR};
use quorum_common::events::emit;
use quorum_common::ext::{ext_ft, ext_quorum_nft};
use quorum_common::{redeem_split, AssetId, MAX_ASSET_TYPES};

const GAS_CHECK: Gas = Gas::from_tgas(5);
const GAS_CALLBACK: Gas = Gas::from_tgas(5);
const GAS_FT_TRANSFER: Gas = Gas::from_tgas(10);
/// Gas one asset needs during redemption: two payouts and two callbacks.
const GAS_PER_REDEEM_ASSET: Gas = Gas::from_tgas(32);
const GAS_RESERVE: Gas = Gas::from_tgas(10);
const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Status {
    /// Accepting deposits; nothing can leave.
    Active,
    /// The NFT was burned. Every recorded asset is paid out to `holder` (90%)
    /// and the treasury (10%). Nothing can be deposited.
    Redeemed { holder: AccountId },
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Payee {
    Holder,
    Pool,
}

/// A payout that failed (for example the holder was not registered on the
/// token). Anyone can retry it; it always goes to the payee recorded at burn.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Pending {
    pub asset: AssetId,
    pub payee: Payee,
    pub amount: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Vault {
    nft: AccountId,
    treasury: AccountId,
    token_id: String,
    /// Recorded backing per asset. Bounded by MAX_ASSET_TYPES.
    balances: Vec<(AssetId, u128)>,
    /// Assets not yet paid out during redemption.
    to_redeem: Vec<(AssetId, u128)>,
    pending: Vec<Pending>,
    status: Status,
}

#[near(serializers = [json])]
pub struct VaultInfo {
    pub nft_contract: AccountId,
    pub treasury: AccountId,
    pub token_id: String,
    pub status: Status,
    pub balances: Vec<(AssetId, U128)>,
    pub awaiting_redeem: Vec<(AssetId, U128)>,
    pub pending: Vec<Pending>,
}

#[near]
impl Vault {
    /// Called by quorum-nft inside the account-creation batch. A vault can only
    /// be initialised by its parent, and only a parent can create a sub-account,
    /// so no one else can make a vault that claims to belong to this collection.
    #[init]
    pub fn new(treasury: AccountId, token_id: String) -> Self {
        let nft = env::predecessor_account_id();
        let me = env::current_account_id();
        require!(
            me.as_str() == format!("v{token_id}.{nft}"),
            "Vault must be the v<token_id> sub-account of its NFT contract"
        );
        Self {
            nft,
            treasury,
            token_id,
            balances: Vec::new(),
            to_redeem: Vec::new(),
            pending: Vec::new(),
            status: Status::Active,
        }
    }

    // ---------------------------------------------------------------- deposits

    /// NEP-141 receiver. The mint share sent by quorum-nft is recorded directly.
    /// Any other sender must be the NFT's current owner and the token must be on
    /// the allow-list; otherwise the full amount is returned to the sender.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        #[allow(unused_variables)] msg: String,
    ) -> PromiseOrValue<U128> {
        let asset = ft_asset(&env::predecessor_account_id());
        if self.status != Status::Active || amount.0 == 0 {
            return PromiseOrValue::Value(amount);
        }
        if sender_id == self.nft {
            // Mint share (F1). quorum-nft only ever sends the settlement asset.
            return PromiseOrValue::Value(U128(self.record(&asset, amount.0, &sender_id)));
        }
        PromiseOrValue::Promise(
            ext_quorum_nft::ext(self.nft.clone())
                .with_static_gas(GAS_CHECK)
                .can_deposit(self.token_id.clone(), sender_id.clone(), asset.clone())
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(GAS_CALLBACK)
                        .on_ft_deposit_checked(asset, amount, sender_id),
                ),
        )
    }

    /// Owner adds native NEAR. Rejected deposits are sent back in full.
    #[payable]
    pub fn deposit_near(&mut self) -> Promise {
        let amount = env::attached_deposit();
        require!(!amount.is_zero(), "Attach NEAR to deposit");
        require!(self.status == Status::Active, "Vault is redeemed");
        let sender = env::predecessor_account_id();
        ext_quorum_nft::ext(self.nft.clone())
            .with_static_gas(GAS_CHECK)
            .can_deposit(self.token_id.clone(), sender.clone(), NATIVE_NEAR.to_string())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_near_deposit_checked(U128(amount.as_yoctonear()), sender),
            )
    }

    /// Returns the unused amount to the token contract (0 = accepted).
    #[private]
    pub fn on_ft_deposit_checked(
        &mut self,
        #[callback_result] allowed: Result<bool, PromiseError>,
        asset: AssetId,
        amount: U128,
        sender: AccountId,
    ) -> U128 {
        if allowed.unwrap_or(false) && self.status == Status::Active {
            U128(self.record(&asset, amount.0, &sender))
        } else {
            amount
        }
    }

    #[private]
    pub fn on_near_deposit_checked(
        &mut self,
        #[callback_result] allowed: Result<bool, PromiseError>,
        amount: U128,
        sender: AccountId,
    ) {
        let refund = if allowed.unwrap_or(false) && self.status == Status::Active {
            self.record(NATIVE_NEAR, amount.0, &sender)
        } else {
            amount.0
        };
        if refund > 0 {
            Promise::new(sender).transfer(NearToken::from_yoctonear(refund)).detach();
        }
    }

    /// Fallback settlement (no swap happened before the deadline): quorum-nft
    /// credits this vault's share of the escrowed NEAR. Callable only by the NFT
    /// contract, so nobody else can add to the ledger without the owner check.
    #[payable]
    pub fn credit_near(&mut self) {
        require!(env::predecessor_account_id() == self.nft, "Only the NFT contract");
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "Attach NEAR");
        require!(self.status == Status::Active, "Vault is redeemed");
        let nft = self.nft.clone();
        self.record(NATIVE_NEAR, amount, &nft);
    }

    // ------------------------------------------------------------------ redeem

    /// F3. Called by quorum-nft after it has marked the token burned. Starts
    /// paying out every recorded asset; if gas runs short, the rest is finished
    /// by `continue_redeem`, which anyone may call.
    pub fn redeem(&mut self, holder: AccountId) {
        require!(env::predecessor_account_id() == self.nft, "Only the NFT contract");
        require!(self.status == Status::Active, "Already redeemed");
        self.status = Status::Redeemed { holder: holder.clone() };
        self.to_redeem = std::mem::take(&mut self.balances);
        emit(
            "vault_redeem_started",
            json!({ "token_id": self.token_id, "holder": holder }),
        );
        self.pay_out_batch();
    }

    /// Pays out assets that did not fit in the gas of the burn call.
    pub fn continue_redeem(&mut self) {
        require!(matches!(self.status, Status::Redeemed { .. }), "Not redeemed");
        require!(!self.to_redeem.is_empty(), "Nothing left to redeem");
        self.pay_out_batch();
    }

    /// Retries every failed payout, always to the payee recorded at burn time.
    pub fn retry_pending(&mut self) {
        require!(!self.pending.is_empty(), "Nothing pending");
        let items = std::mem::take(&mut self.pending);
        for p in items {
            require!(
                env::prepaid_gas().saturating_sub(env::used_gas()) > GAS_PER_REDEEM_ASSET,
                "Attach more gas"
            );
            self.send(&p.asset, p.payee, p.amount.0);
        }
    }

    #[private]
    pub fn on_payout(
        &mut self,
        #[callback_result] result: Result<(), PromiseError>,
        asset: AssetId,
        payee: Payee,
        amount: U128,
    ) {
        if result.is_err() {
            emit(
                "vault_payout_failed",
                json!({ "token_id": self.token_id, "asset": asset, "payee": payee, "amount": amount }),
            );
            self.pending.push(Pending { asset, payee, amount });
        } else {
            emit(
                "vault_payout",
                json!({ "token_id": self.token_id, "asset": asset, "payee": payee, "amount": amount }),
            );
        }
    }

    /// NEAR sent here without `deposit_near` was never counted as backing.
    /// After redemption it is swept to the pool, keeping this account's storage
    /// stake and any NEAR still owed in pending payouts.
    pub fn sweep_stray_near(&mut self) -> Promise {
        require!(matches!(self.status, Status::Redeemed { .. }), "Only after redemption");
        require!(self.to_redeem.is_empty(), "Finish redemption first");
        let storage = env::storage_byte_cost().saturating_mul(env::storage_usage() as u128);
        let owed: u128 = self
            .pending
            .iter()
            .filter(|p| is_native(&p.asset))
            .map(|p| p.amount.0)
            .sum();
        let keep = storage.as_yoctonear() + owed + NearToken::from_millinear(10).as_yoctonear();
        let balance = env::account_balance().as_yoctonear();
        require!(balance > keep, "No stray NEAR");
        let stray = balance - keep;
        emit("vault_stray_swept", json!({ "token_id": self.token_id, "amount": U128(stray) }));
        Promise::new(self.treasury.clone()).transfer(NearToken::from_yoctonear(stray))
    }

    // ------------------------------------------------------------------- views

    pub fn vault_info(&self) -> VaultInfo {
        VaultInfo {
            nft_contract: self.nft.clone(),
            treasury: self.treasury.clone(),
            token_id: self.token_id.clone(),
            status: self.status.clone(),
            balances: self.balances.iter().map(|(a, b)| (a.clone(), U128(*b))).collect(),
            awaiting_redeem: self.to_redeem.iter().map(|(a, b)| (a.clone(), U128(*b))).collect(),
            pending: self.pending.clone(),
        }
    }

    pub fn balances(&self) -> Vec<(AssetId, U128)> {
        self.balances.iter().map(|(a, b)| (a.clone(), U128(*b))).collect()
    }
}

impl Vault {
    /// Adds to recorded backing. Returns the amount to refund (0 or all of it
    /// when the per-vault asset cap would be exceeded).
    fn record(&mut self, asset: &str, amount: u128, from: &AccountId) -> u128 {
        if let Some(entry) = self.balances.iter_mut().find(|(a, _)| a == asset) {
            entry.1 = entry.1.checked_add(amount).expect("balance overflow");
        } else if self.balances.len() < MAX_ASSET_TYPES {
            self.balances.push((asset.to_string(), amount));
        } else {
            return amount;
        }
        emit(
            "vault_deposit",
            json!({ "token_id": self.token_id, "asset": asset, "amount": U128(amount), "from": from }),
        );
        0
    }

    fn pay_out_batch(&mut self) {
        while let Some((asset, amount)) = self.to_redeem.last().cloned() {
            let left = env::prepaid_gas().saturating_sub(env::used_gas());
            if left < GAS_PER_REDEEM_ASSET.saturating_add(GAS_RESERVE) {
                break;
            }
            self.to_redeem.pop();
            let (to_holder, to_pool) = redeem_split(amount);
            self.send(&asset, Payee::Holder, to_holder);
            self.send(&asset, Payee::Pool, to_pool);
        }
    }

    fn send(&self, asset: &str, payee: Payee, amount: u128) {
        if amount == 0 {
            return;
        }
        let to = match (&payee, &self.status) {
            (Payee::Holder, Status::Redeemed { holder }) => holder.clone(),
            (Payee::Pool, _) => self.treasury.clone(),
            (Payee::Holder, Status::Active) => env::panic_str("No holder recorded"),
        };
        let callback = Self::ext(env::current_account_id())
            .with_static_gas(GAS_CALLBACK)
            .on_payout(asset.to_string(), payee, U128(amount));
        match ft_contract(asset) {
            Some(token) => {
                ext_ft::ext(token)
                    .with_static_gas(GAS_FT_TRANSFER)
                    .with_attached_deposit(ONE_YOCTO)
                    .ft_transfer(to, U128(amount), Some("quorum redeem".into()))
                    .then(callback)
                    .detach();
            }
            None => {
                Promise::new(to).transfer(NearToken::from_yoctonear(amount)).then(callback).detach();
            }
        }
    }
}

#[cfg(test)]
mod tests;
