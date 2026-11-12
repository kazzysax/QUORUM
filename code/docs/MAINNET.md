# Mainnet launch runbook

This code has **never run on any chain** and is **not audited**. Going straight to mainnet means finding the
first bugs with real money on the table. This runbook keeps that survivable. Do the stages in order.

## What is permanent and what is not

| Thing | Fixable after launch? |
| --- | --- |
| Vault code (a by-hash global contract) | **No.** Every vault runs that exact code forever. |
| Fee splits (50/50 at mint, 90/10 on burn, 5% on sales) | No. Constants. |
| The asset plan (which NFT carries which asset) | **No.** Fixed at init. A wrong token here cannot be corrected for that collection. |
| `quorum-nft`, `-dao`, `-treasury`, `-market` code | Yes while you hold their full-access keys. Removing the keys makes them unfixable too. |
| Stage prices and supply | Fixed at init. |
| Pause, DEX address, royalty (up), allow-list | DAO only, by an executed holder vote. The founder cannot pause or resume a mint and cannot change the vault code; the only founder action is lowering the royalty. |
| When minting opens and closes | Fixed at init by the stage times. A collection cannot launch paused. |

## New risks in this design (read these)

1. **Swap quality.** The DEX enforces the `min_out` in a SETTLE proposal atomically, but the *route* and the minimum are chosen
   by whoever proposes and holders who vote. A careless vote can lock in a poor price. Build routes from Rhea's router and compare.
2. **Liquidity.** Each plan asset needs a Rhea pool route with enough depth for that whole group's escrow. A thin pool means heavy slippage
   or a `min_out` that can't be met. Check depth for **every** plan token before launch; the contract cannot.
3. **Classic pools only.** Swaps use `v2.ref-finance.near`. Rhea's newer concentrated-liquidity pools are not supported. If the classic
   contract has moved, the DEX address is a DAO-changeable parameter, but its interface must still match.
4. **Nothing is checked against the real DEX yet.** The swap message format comes from published docs and SDK output. Registration
   requirements, gas (a swap needs roughly 200+ Tgas) and output delivery have not been run. The smoke test below is how you find out.
5. **Escrow concentration.** Until settlement, half of every mint sits in the collection contract's balance. Keep the contract keys safe
   and settle promptly. If nothing is settled, the fallback after the grace period credits plain NEAR so nothing is stranded.
6. **Price exposure.** Buyers pay NEAR; their NFT then holds whatever asset it was assigned. Two buyers who paid the same end up
   with different value. Tell buyers before they mint.
7. **Crediting is manual.** Each NFT needs a `credit_batch` transaction (3 per call). For a 10-NFT launch that is 4 calls;
   `scripts/credit-commands.mjs` prints them. Big collections need a bot.

## Stage 0: testnet rehearsal (about an hour, strongly recommended)

Deploy to testnet with a wNEAR-only plan (`ASSET_PLAN=wrap.testnet:1`, `WRAP=wrap.testnet`, no swap) and walk through mint, deposit,
transfer, vote, burn, settle (wrap only), credit. It exercises everything except the Rhea swap. Testnet pools exist for Ref (`ref-finance-101.testnet`),
so you can also try one real swap there with `DEX=ref-finance-101.testnet`.

## Stage 1: deploy a throwaway smoke-test collection on mainnet

```
NETWORK=mainnet CONFIRM_MAINNET=yes FOUNDER=you.near PREFIX=smoke1 \
  ASSET_PLAN="<token>:1,wrap.near:1" MAX_SUPPLY=4 PUBLIC_NEAR=0.1 \
  DAO_BOUNDS='[{"min_period_ms":"300000","min_quorum_bps":100,"min_pass_bps":5000,"min_timelock_ms":"60000"},{"min_period_ms":"300000","min_quorum_bps":100,"min_pass_bps":5000,"min_timelock_ms":"60000"},{"min_period_ms":"300000","min_quorum_bps":100,"min_pass_bps":5000,"min_timelock_ms":"60000"},{"min_period_ms":"300000","min_quorum_bps":100,"min_pass_bps":5000,"min_timelock_ms":"60000"}]' \
  ./scripts/deploy.sh
```

Short DAO bounds (5-minute votes) exist **only** on this throwaway so a vote takes minutes, not days. Never use them for the real collection.
Needs about 40 NEAR (4 accounts x 8 NEAR plus the one-time global-contract publish). Minting opens at the first stage start; nobody can pause it.

## Stage 2: smoke test with your own money

1. Mint **2** NFTs from two accounts at 0.1 NEAR. Confirm on an explorer: the NFTs exist; `v1.<collection>` exists, has **no access keys**;
   the treasury received half of each price immediately; the collection contract holds the other half; `GET /nfts/1` matches.
2. Add NEAR to a vault from the owner (works) and from another account (refunded).
3. Transfer an NFT; confirm the old owner can no longer deposit and the new one can.
4. **Burn before settlement** (a third mint): holder gets 90% of its escrow in NEAR, treasury 10%.
5. **Settlement & DEX Routing:** A wNEAR group is settled by anyone once the mint is over (no vote). For a DEX asset, propose and pass a SETTLE proposal with a real Rhea route and a sensible `min_out` for automated multi-token settlement, then `credit_batch`. Confirm the vault now shows the credited assets.
6. `credit_batch` the token group. Confirm vault balances match `out_total` split by escrow share.
7. Burn a credited NFT: holder gets 90% of the asset, treasury 10%.
8. Sign in with the NEP-413 flow; confirm gated pages open for holders and close on the next request after a sale or burn.

If **any** step is wrong: stop, fix, and redeploy. Non-vault contracts can be redeployed while you hold keys; this throwaway collection is never shown to buyers.
If the **vault** is wrong, nothing minted can be repaired: burn what you can, publish a corrected vault, and use a fresh collection.

## Stage 3: the real collection

Deploy with default DAO bounds (3-5 day votes), your real asset plan, a small `MAX_SUPPLY`, `PROVENANCE_HASH_B64`, and `START_IN_MIN`
set to the announced opening time. Nobody can pause or unpause it afterwards. A wNEAR group settles as soon as the mint is over (anyone can
trigger it); a DEX group needs a SETTLE vote, at least ~5 days of voting + timelock; announce that.

## Stage 4: removing keys

Only after a clean smoke test **and** a clean first settlement. Removing full-access keys from the NFT, DAO, treasury and market accounts means a bug
can then never be patched. Keep them and say so publicly, or remove them and say that: both are honest; choose deliberately.

## What this launch does NOT have

No external audit. No on-chain art lock (provenance hash only). Royalties only on `quorum-market` sales. Part 2 (auctions, offers, reveals, factory)
and Part 3 (privacy) are roadmap. No keeper bot for crediting.
