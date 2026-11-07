//! Cross-contract interfaces used by more than one Quorum contract.

use near_sdk::json_types::U128;
use near_sdk::{ext_contract, AccountId};

/// NEP-141 fungible token plus NEP-145 storage registration.
#[ext_contract(ext_ft)]
pub trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> U128;
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>);
}

/// quorum-vault methods the NFT contract calls.
#[ext_contract(ext_vault)]
pub trait Vault {
    fn redeem(&mut self, holder: AccountId);
}

/// quorum-nft methods vaults call.
#[ext_contract(ext_quorum_nft)]
pub trait QuorumNft {
    /// Returns true if `sender` currently owns live token `token_id` and
    /// `asset` is on the collection's vault allow-list.
    fn can_deposit(&self, token_id: String, sender: AccountId, asset: String) -> bool;
}

/// quorum-treasury methods the NFT contract calls.
#[ext_contract(ext_treasury)]
pub trait Treasury {
    fn register_token(&mut self, token_id: String);
    fn on_token_burned(&mut self, token_id: String, burner: AccountId);
}

/// wNEAR (`wrap.near`): NEAR must be wrapped before it can be swapped on a DEX.
#[ext_contract(ext_wrap)]
pub trait Wrap {
    fn near_deposit(&mut self);
    fn near_withdraw(&mut self, amount: U128);
}

/// Read-only token balance, used to measure what a swap actually delivered.
#[ext_contract(ext_balance)]
pub trait Balance {
    fn ft_balance_of(&self, account_id: AccountId) -> U128;
}

/// quorum-vault: NEAR credited by the NFT contract (fallback settlement).
#[ext_contract(ext_vault_credit)]
pub trait VaultCredit {
    fn credit_near(&mut self);
}
