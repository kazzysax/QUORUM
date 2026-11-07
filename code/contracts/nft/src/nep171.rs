//! NEP-171 with Quorum's rule on top: every transfer resets
//! `last_transfer_block`, so a token that changes hands cannot vote on a
//! proposal that was already open (F5). Approvals and enumeration come from
//! the standard library macros.

use crate::*;
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_contract_standards::non_fungible_token::{Token, TokenId};
use near_contract_standards::{impl_non_fungible_token_approval, impl_non_fungible_token_enumeration};
use near_sdk::{near, Promise, PromiseOrValue};

impl Contract {
    fn touch(&mut self, token_id: &str) {
        let st = self.token_state.get_mut(token_id).unwrap_or_else(|| env::panic_str("Unknown token"));
        require!(!st.burned, "Token is burned");
        st.last_transfer_block = U64(env::block_height());
    }
}

#[near]
impl NonFungibleTokenCore for Contract {
    #[payable]
    fn nft_transfer(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>) {
        self.tokens.nft_transfer(receiver_id, token_id.clone(), approval_id, memo);
        self.touch(&token_id);
    }

    #[payable]
    fn nft_transfer_call(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>, msg: String) -> PromiseOrValue<bool> {
        let out = self.tokens.nft_transfer_call(receiver_id, token_id.clone(), approval_id, memo, msg);
        self.touch(&token_id);
        out
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

impl_non_fungible_token_approval!(Contract, tokens);
impl_non_fungible_token_enumeration!(Contract, tokens);
