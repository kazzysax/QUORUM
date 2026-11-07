# Quorum: what the UI talks to

Two things: the **REST API** (reads, history, allowlist proofs, holder sign-in) and the **contracts** (every write).
There is no quote service and no payment token: minting is a plain payable NEAR call.

Amounts are strings in yoctoNEAR unless a token is named. Assets are `near` or `nep141:<token account>`.
Wallet calls use `@hot-labs/near-connect` (`wallet.signAndSendTransaction`); sign-in uses `wallet.signMessage` (NEP-413).

## How an NFT's money works (show this to users)

1. **At mint** you pay the stage price + a small storage cost (0.03 NEAR). Half the price goes to the DAO treasury **immediately**.
   The other half stays in the collection contract as **your NFT's escrow** (in NEAR).
2. **Each NFT is assigned an asset at launch** (USDC, wNEAR, ...), round-robin by token number from a public plan. Nobody can change it.
3. **When the mint closes**, holders vote to swap each asset group's escrow through Rhea into that asset. Anyone then credits each NFT's vault.
4. **Until then** your NFT's backing is NEAR escrow: burning refunds 90% in NEAR. **After** settlement the vault holds the asset: burning pays 90% of it.
5. **If nobody swaps within the grace period** (default 14 days after the mint closes), anyone can switch the group to plain NEAR and credit that instead. Funds can't get stuck.

What an NFT is worth afterwards moves with its asset's price, so NFTs diverge after equal payments. Say this on the mint page.

---

## 1. REST API (`services/api`, default `:8080`)

Lists take `?from=0&limit=24` (limit max 100).

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/health` | `{ok, cursor}`: last indexed block; show "syncing" if it lags |
| GET | `/nfts?owner=&listed=true` | `{total, items:[Token]}` live tokens only |
| GET | `/nfts/:id` | `Token` + `votes_cast` |
| GET | `/nfts/:id/history` | `{owners[], earned[], paid_out[], events[]}` |
| GET | `/metadata/:id.json` | NEP-177 style traits; 404 once burned |
| GET | `/settlement` | `{groups:[{idx, asset, phase, near_in, out_total, tokens, uncredited:[ids]}]}` |
| GET | `/mint/proof?stage=&account=` | `{proof:[base64...]}` for presale stages (`403` if not allowlisted; `[]` for public stages) |
| GET | `/market/listings`, `/market/sales` | `{total, items}` |
| GET | `/dao/proposals`, `/dao/proposals/:id`, `/dao/proposals/:id/votes` | proposals with live tallies |
| GET | `/treasury` | `{inflows_by_source, total_in, total_out, distributions, recent_flows}` |
| POST | `/auth/challenge`, `/auth/verify` | holder sign-in (below) |
| GET | `/gated/me`, `/gated/members`, `/gated/events` | holder-only; `Authorization: Bearer <token>` |

`Token` = `{token_id, owner, vault, burned, minted_block, last_transfer_block, mint_price, media, asset, escrow_share, credited, vault_balances:{asset:amount}, listing}`.
`phase` is `Pending` (escrow held), `Swapping`, `Swapped`, or `Fallback`.

### Holder sign-in
1. `POST /auth/challenge` -> `{message, nonce}`.
2. `wallet.signMessage({message, recipient: <APP_RECIPIENT>, nonce: Buffer.from(nonce,"base64")})` -> `{accountId, publicKey, signature}`.
3. `POST /auth/verify` `{accountId, publicKey, signature, nonce}` -> `{token}` (15 minutes).
4. Send `Authorization: Bearer <token>`. `403` on a gated route means "you no longer hold a Quorum NFT": it takes effect on the very next request after a sale or burn.

---

## 2. Contract calls

`NFT` = the collection account. Gas is a recommended attach, not a measured figure.

### Mint (one call)
`NFT.mint({stage, proof})`, deposit `NFT.mint_cost(stage)` (price + storage; excess is refunded), gas `100 Tgas`.
- `proof`: from `/mint/proof` for presale stages, otherwise omit.
- Any rejection (stage closed, not allowlisted, wallet limit, sold out, paused, underpaid) **refunds the whole deposit**: show the contract's error message.
- Mint form data: `NFT.get_config().stages`, `NFT.active_stage()`, `NFT.mints_by(stage, me)`, `NFT.asset_for_number(minted_total + 1)` (the asset the next NFT will carry, before the buyer pays), `NFT.get_config().paused`.

### Vault
- **Add NEAR:** `<vault>.deposit_near()`, attach NEAR. `<vault>` = `NFT.vault_of(token_id)`.
- **Add a token:** `<token>.storage_deposit({account_id: <vault>, registration_only: true})` the first time, then `<token>.ft_transfer_call({receiver_id: <vault>, amount, msg: ""})`. Only the owner and only allow-listed tokens (`get_config().vault_allowlist`) are accepted; anything else is refunded in full.

### Settlement
- **Status:** `NFT.settlement_status()` or `GET /settlement`. `NFT.mint_closed()` and `NFT.mint_closed_at_ms()` tell the UI when it begins.
- **Credit vaults (anyone):** `NFT.credit_batch({group, token_ids:[up to 3]})`, gas `300 Tgas`. Show a "Credit my NFTs" button for the holder's uncredited NFTs, and a bulk helper (`scripts/credit-commands.mjs` prints the commands).
- **Fallback (anyone):** `NFT.enable_fallback({group})` once the grace period has passed and the group is still `Pending`.
- A burn is refused while a swap is in flight, and after a swap until that NFT is credited. Show the contract's message and a "credit it first" action.

### Burn
`NFT.burn_and_redeem({token_id})`, deposit `1` yocto, gas `300 Tgas`. Preview: holder 90%, treasury 10%. Before settlement it pays NEAR from escrow; after settlement the vault pays each asset.
The holder must be registered on each token in the vault to receive it; otherwise that payout is parked and anyone can call `<vault>.retry_pending()` after they register.

### Governance
- **Vote:** `NFT.vote({proposal_id, token_ids:[<=15], choice})`, 0 no / 1 yes / 2 abstain, gas `300 Tgas`. Only tokens that last changed hands **before** the proposal opened can vote (compare `last_transfer_block` with `proposal.start_block`).
- **Propose:** `NFT.propose({kind, purpose, voting_period_ms, quorum_bps, pass_bps, timelock_ms})`, holders and the founder. Prefill from `DAO.get_bounds()` (order: spend, distribute, parameter change, text). `kind` is one of:
  - `"Text"`
  - `{"Spend":{"recipient","asset","amount"}}`
  - `{"Distribute":{"asset","amount"}}`
  - `{"ParameterChange":{"key","value"}}`; keys starting with `treasury:` go to the treasury (`treasury:allow_dex`)
  - `{"Settle":{"group","hops":[{"pool_id","token_out"}],"min_out"}}`: swap that group's escrow. `hops` is the Rhea route (ends in the group's asset); `min_out` is the least the vote accepts. **Build the route from Rhea's router and show holders the expected output and the minimum.**
  - `{"Swap":{"token_in":"near"|"nep141:..","amount","token_out","hops","min_out","dex"}}`: swap treasury funds into another asset.
- **Execute:** `DAO.execute({proposal_id})`, anyone, gas `300 Tgas`, once `DAO.status_of(id)` is `Passed` and the timelock has elapsed.
- **Claim a distribution:** `NFT.claim_distribution({token_id, asset})`, gas `100 Tgas`; show `Treasury.owed_to({token_id, asset})` first.
- **Donate:** `Treasury.donate({memo})` with NEAR attached.

### Market
- **List:** `NFT.nft_approve({token_id, account_id: MARKET, msg: JSON.stringify({price})})`, deposit about `0.01 NEAR`.
- Show the seller what they net: `price x 5%` to the pool, `price x royalty_bps/10000` to the founder (`NFT.sale_terms()`), the rest to them. Warn if `price` is below the NFT's backing.
- **Buy:** `MARKET.buy({nft, token_id, approval_id})`, deposit exactly `price`, gas `300 Tgas`; take `approval_id` from `/market/listings`.
- **Reprice / cancel:** `MARKET.update_price`, `MARKET.cancel`.

---

## 3. Known gaps the UI must work around

- Roadmap, not built (do not build screens): auctions, offers, reveals, collection factory (Part 2); sealed bids, private sales (Part 3).
- Swaps use Rhea's **classic pools** (`v2.ref-finance.near`). Rhea's newer concentrated-liquidity pools use a different interface and are not supported.
- The route and `min_out` for a swap come from off-chain pricing. The contract enforces the minimum atomically, but a bad *route choice* can still get a poor price: that is what the vote is for.
- The indexer lags the chain by a few seconds: poll after a write instead of assuming instant updates.
- Nothing has run against a live chain yet: follow `docs/MAINNET.md`.
