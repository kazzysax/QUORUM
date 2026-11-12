# Testing

Two layers. The second one exists because the first one is not enough.

## 1. Unit tests (154)

```bash
cd code && cargo test --workspace
```

Rust tests with a mocked chain, per crate: common 14, dao 23, factory 8, market 28, nft 43, treasury 21, vault 17.

## 2. Live testnet end-to-end (`code/scripts/e2e/`)

These send real transactions to the deployed contracts with funded test accounts and assert on the
resulting chain state (balances to the yocto where the contract is exact). Keys live outside the repo
(`~/.quorum-keys`, override with `KEY_DIR`). Helpers are in `lib.mjs`.

| Script | What it proves |
|---|---|
| `molten-1b.mjs` | Every privileged function rejects the wrong caller, with the reason. A market sale moves the NFT and pays exactly 5% pool / 5% royalty / 90% seller. Market stats and the sale log are written on-chain. Proposal floors (period, quorum, pass, timelock, asset, min-out, purpose). A token that changed hands after a proposal opened cannot vote, and a mixed batch counts nothing. Multi-token votes in one call. Double votes refused. |
| `molten-2.mjs`, `molten-3.mjs` | Passed proposals execute, failed ones cannot. A treasury spend pays exactly what holders approved. A SETTLE proposal converts the escrow into wNEAR. Credit is permissionless and pro-rata; double credit is refused; burn is refused until credited. A distribution reserves funds nobody can spend; claims are exact and single-use. Burning after settlement pays 90% to the holder, 10% to the treasury, and the unclaimed distribution in full. |
| `tide.mjs` | Per-collection isolation: each collection's DAO and treasury reject calls from every other NFT contract. Burn **before** settlement with a vault deposit pays both the escrow and the deposit (the case that used to lock funds). A proposal runs start to finish on Tidewater's own DAO and treasury. |
| `feather.mjs` | Permissionless fallback: after the grace period anyone can switch the group to plain NEAR, credit the vaults, and holders can burn for 90%. Needs ~72 minutes. |
| `dao-standards.mjs` | `list_proposals`, the 30-day voting cap, and the treasury's 50% single-spend cap (the vote passes, execution is refused, funds untouched, the proposal stays retryable). |
| `offers.mjs` | On-chain offers: escrow held by the market, replace and withdraw refund the buyer, only the buyer can withdraw, the owner accepts with ONE transaction (`nft_approve` with `accept_offer`) and the sale pays 5% pool / 5% royalty / 90% seller. |
| `settle-open.mjs` | Upgrades the live collection contracts in place, then proves a wNEAR collection settles with no vote: an open mint is refused, a plain holder converts the sold-out Molten Hours escrow 1:1 into wNEAR, anyone fills all 20 vaults, and a second credit is refused. |
| `founder-locked.mjs` | Upgrades the live collection contracts and proves the founder can no longer pause a mint or change the vault code (those methods are gone; `set_param` stays DAO only), while a real public mint still works. |
| `frontend/scripts/ingest-check.ts` | Tests the Launch page's drop-everything reader: a whole folder (images, per-piece metadata, TRAITS.csv, cover, avatar, a preview sheet and notes) is read in one drop and aligned (cover and avatar recognised, unusable files reported); 0-based per-piece JSON matches by file name; one JSON list with an `edition` field matches by number; an object keyed by number and plain-object traits are read; a CSV dropped before the pictures is remembered and lines up when they arrive, in several drops; CSV rows keyed by file name; duplicates, unmatched tokens, invalid JSON and more than 100 pictures are reported, and an entry that names its own token never falls back to its list position. |
| `frontend/scripts/upload-check.mjs`, `frontend/scripts/art-flow-check.ts` | Tests the live art upload used by the Launch page: pictures, metadata, cover and avatar upload and are served publicly with the right type; a picture over 3 MB, a wrong file type, piece 101, an odd path, a reserved name and an already-launched name are all refused; and the page's own code (CSV traits, numbering, uploads) produces the exact links the NFT contract fetches (`<media_base_url>/N` and `<metadata_base_url>/metadata/N.json`). |
| `deploy-factory.mjs`, `factory-check.mjs` | Deploys the collection factory (upgrading the market in place, which keeps every listing and sale) and proves a launch from a plain wallet: the deposit is enforced and refusals cost only gas, one call creates the NFT, DAO and treasury, **all three have zero access keys**, they are bound to each other, the creator is the founder and fee recipient, the DAO has the right votes and the 50% floor, the collection is in the factory registry and can list on the market, and a mint really works (half to its treasury, a keyless vault). |
| `acceptance-1.mjs`, `acceptance-1b.mjs`, `acceptance-2.mjs` | The acceptance test of the relaunched Molten Hours on testnet (run 1, then 1b, then 2 after the voting windows). A market sale pays exactly 5% treasury / 5% royalty / 90% seller; under-payments, stale approvals and self-buys are refused; offers escrow, replace, withdraw and accept in one transaction; only the owner can deposit into a vault; burn before settlement pays 90% / 10%; the DAO refuses low quorum, short periods and bad assets; outcomes follow the votes (85% turnout passes, 15% turnout fails even if all vote yes, a majority of no fails); every tally equals the per-NFT vote records; a spend pays exactly what holders approved; a passed 8 NEAR vote is refused by the 50% spend cap and stays retryable; a distribution splits equally and each claim is single-use; burn after the no-vote settlement pays 90% wNEAR to the holder and 10% to the treasury. 100+ checks, all passing (a few early failures were test wallets running out of NEAR and the free RPC rate-limiting). |
| `relaunch.mjs`, `relaunch-mint.mjs`, `mint-out.mjs` | The 20-piece relaunch: each account created, funded, deployed and initialised in one transaction; real public mints with the 50/50 split checked. |
| `upgrade-market.mjs` | Upgrades the live market in place and runs its migration; listings, stats and sale history survive. |
| `gift-and-list.mjs` | Gives a tester wallet 3 NFTs of each collection and lists the rest on the market. |
| `rotate-keys.mjs`, `mkusers.mjs`, `fund.mjs`, `deploy-code.mjs` | Test-account housekeeping and code redeploys with the rotated keys. |

### Bugs only the live tests found

| Bug | Effect | Fix |
|---|---|---|
| Market `on_transferred` returned a joined promise | The NFT moved but nobody was paid and stats were not written | Independent transfers |
| `vote` and `credit_batch` returned joined promises | Any batch of more than one token failed | One batched DAO call (`record_votes`, all-or-nothing); detached credits |
| Reward index scaled by 10^24 | `amount * scale` overflowed `u128`: every distribution above ~0.0000003 NEAR trapped | Scale 10^9, `mul_div` |
| wNEAR group assumed 1 NEAR = 1 wNEAR | `wrap` takes its registration fee from the first deposit, so the last vault credit was short | Register first, record the measured balance |
| Treasury not registered on the asset token | The 10% burn payout to the treasury failed (retryable, but wrong) | `credit_batch` registers it |
| `env::panic_str` compiles to a bare trap here | Every rejection showed as "unreachable" | `quorum_common::fail` calls the host panic directly |
| Burn before settlement never redeemed the vault | Owner deposits locked forever | Burn redeems on both paths |
| `unwrap_wnear` open to anyone | Could lock a wNEAR group | DAO only |
| Settlement accepted any balance increase | A dust donation could fake a swap | Requires `min_out` |

Known limit: the vault contract (a NEP-591 global contract, immutable by design) still uses the SDK's
`require!`, so its rejections show a bare trap. Republishing it costs ~15 NEAR and changes its hash.

### Running them

```bash
cd code
node scripts/e2e/molten-1b.mjs
```

The scripts assume the deployments in `frontend/src/deployments.ts` and funded accounts named in
`lib.mjs`. They are idempotent where they can be, and print a PASS/FAIL line per check.
