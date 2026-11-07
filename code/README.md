# Quorum

NFTs that do something. Every Quorum NFT is **art + a vault + a vote**:

* **Art:** a NEP-171 token.
* **A vault:** its own keyless NEAR account holding the assets that back it. Owners can add; nothing leaves except by burn.
* **A vote:** one live NFT is one vote in the collection's DAO.

Built for the NEAR Hackathon 2026, NFT track ("NFTs That Do Something").

## How the money works

* **Mint:** pay the stage price in NEAR (+0.03 NEAR storage). **Half goes to the DAO treasury immediately.** The other half stays in the collection contract as that NFT's escrow.
* **Each NFT carries an asset** (USDC, wNEAR, ...) assigned at launch, round-robin by token number from a public, immutable plan.
* **When the mint closes,** holders vote (a SETTLE proposal) to swap each asset group's whole escrow through **Rhea** into that group's asset. Anyone then credits each NFT's vault its pro-rata share.
* **The DAO can also vote to swap its own treasury** into other assets (a SWAP proposal).
* **Burn before settlement** refunds 90% of the escrow in NEAR; **after** it, the vault pays 90% of each asset. 10% goes to the treasury either way.
* **If no swap happens** within the grace period, anyone can switch a group to plain NEAR and credit that instead.

## Status: what is built, honestly

| Part | State |
| --- | --- |
| `quorum-common` (fee math, overflow-safe pro-rata, Rhea swap-message builder) | Done |
| `quorum-vault` (add-only; NFT contract can credit it) | Done |
| `quorum-nft` (NEAR mint, escrow, asset plan, settlement, credit, fallback, burn, vote/claim gate, pause) | Done |
| `quorum-treasury` (spend, even distribution, claims, DAO-voted swaps) | Done |
| `quorum-dao` (bounded proposals incl. SETTLE and SWAP, votes, timelock, execute) | Done |
| `quorum-market` (fixed-price NEAR sales, 5% fee, royalty) | Done |
| `services/api` (indexer, REST API, settlement status, allowlist proofs, NEP-413 holder sign-in) | Done |
| Deploy script (testnet/mainnet, guarded), Dockerfile, compose, init generator, credit-commands helper, `docs/MAINNET.md` | Written, never run |
| `docs/API.md` (REST + every contract call for the UI) | Done |
| **Roadmap (later by decision)** | Part 2: auctions, offers, reveals, collection factory. Part 3: sealed bids, private sales, privacy. Also a crediting keeper bot |
| **Removed** | NEAR Intents and the quote service: minting is plain NEAR |
| **Not built** | Frontend (built separately against `docs/API.md`) |
| **Not verified** | Nothing has run on a chain. Contract tests use mocked promises. **The Rhea swap is built from published docs and SDK examples and has never been run against the real DEX.** Gas amounts are estimates. The indexer is tested on block fixtures I shaped from memory of the real format. The NEP-413 check is tested against our own signer, not a real wallet. |

Run everything: `cd code && cargo test --workspace` and `cd services/api && npm test`.

## Going live

**Read `docs/MAINNET.md` first.** The vault is immutable and so is the asset plan.

1. Install near-cli-rs, Rust (+ `wasm32-unknown-unknown`), Node 22, Docker; fund the founder account.
2. Choose your asset plan and **check Rhea has a deep pool route for every token** in it.
3. Rehearse on testnet (`docs/MAINNET.md` stage 0), then deploy a throwaway smoke-test collection on mainnet (stage 1-2).
4. Deploy the real collection (stage 3), start the API (`docker compose up --build`), smoke-mint, unpause.

## How control passes on transfer, and why the old owner cannot keep access

The vault account has **no access keys**, so no person can ever sign for it. Its contract holds no owner field. Before it accepts a deposit it asks `quorum-nft.can_deposit(token_id, sender, asset)`, which reads the owner from the NFT contract's own state. The moment `nft_transfer` (or a market sale) updates that state, the new owner is the only account the vault accepts deposits from, and the only account `burn_and_redeem` pays. Votes and claims are checked inside `quorum-nft` too, in the same receipt that acts on them.

Tests: `transfer_moves_ownership_and_resets_vote_eligibility`, `can_deposit_rules_owner_only_and_allowlisted`, `burn_removes_token_first_and_blocks_everything_after`.

## Threat model for the transfer: every way a seller could keep the money

1. **Keep a key to the vault.** None exists. `quorum-vault::new` runs once, in the same promise batch that creates the account, and no key is added.
2. **Withdraw before selling.** The vault has no withdraw, transfer or admin method. The only outbound path is `redeem`, callable only by `quorum-nft`, only during a burn.
3. **Burn right after selling.** The old owner cannot: `burn_and_redeem` pays only the current owner, read from contract state at call time. The buyer can burn instantly, which is intended (it is the price floor).
4. **Sell and claim a distribution afterwards.** Unclaimed distributions are attached to the token (checkpoint model) and travel with it. The old owner has nothing left to claim.
5. **Sell, then vote with the same token.** Every transfer resets `last_transfer_block`; the DAO rejects votes from tokens that changed hands after a proposal opened. A token that already voted cannot vote twice.
6. **Race a sale against a payout.** The market removes the listing and the token transfers first; the 5% fee, royalty and seller proceeds are paid only after the transfer succeeds. A failed transfer refunds the buyer. Redeem payouts that fail are recorded per asset and always retry to the holder recorded at burn.
7. **Deposit assets, then claim they were never there.** Only recorded deposits count. Stray NEAR sent straight to the vault is not backing and is swept to the pool after a burn.
8. **Mint, then sell, then still collect the escrow.** The escrow share is a record on the token, not on the minter. Burning before settlement refunds the *current* owner; after settlement the share was credited to the vault, which follows the owner. Tests: `burning_before_settlement_refunds_escrow_in_near`, `a_successful_swap_records_exactly_what_arrived`.
9. **Burn while a swap is converting the escrow.** Refused until it resolves, so a burner can never take NEAR that is mid-swap. After a swap the NFT must be credited before it can burn. Tests: `burn_waits_while_a_swap_is_in_flight`, `after_settlement_burn_needs_the_vault_credited_first`.
10. **Get credited twice.** `credited` is set before the transfer; a refused transfer clears it so it can be retried, and a landed one cannot repeat. Test: `crediting_rules`.
11. **Sell off-market to skip the 5% fee.** Not preventable on-chain: a sale cannot be told apart from a transfer. Accepted and documented. The vault still moves with the NFT.

## Layout

```
contracts/common    shared constants, fee math, asset ids, events
contracts/vault     add-only vault (publish once as a by-hash global contract)
contracts/nft       collection: mint, burn, vote/claim gate, params
contracts/treasury  DAO pool: spend, distribute, claims
contracts/dao       proposals and voting
contracts/market    fixed-price sales
services/api        indexer + REST API + allowlist proofs + holder sign-in
scripts             deploy, init-config, code-hash and credit-commands tools
docs/API.md         everything the UI calls
docs/CONFIG.md      quorum-nft init arguments
```

## Known limits (state these in any demo)

* Royalties are paid only on sales through `quorum-market`. NEP-199 payouts are not implemented.
* Vault wasm is about 300 KB unoptimised; it is published once as a global contract. Run `wasm-opt -Oz` before publishing.
* A failed treasury share at mint is recorded and retried by anyone (`retry_pool_credit`); a failed vault share blocks burning that token until `retry_vault_credit` succeeds.
* Per-wallet mint limits can be bypassed with more wallets.
* Buyers pay NEAR but their NFT then holds a different asset, so NFTs diverge in value after equal payments.
* Settlement is a vote, so it takes at least the DAO's voting period + timelock (3 to 5 days by default) after the mint closes.
* Not audited.

License: MIT.
