# Testing

Two layers. The second one exists because the first one is not enough.

## 1. Unit tests (132)

```bash
cd code && cargo test --workspace
```

Rust tests with a mocked chain, per crate: common 14, dao 22, market 17, nft 41, treasury 21, vault 17.

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
| `dao-standards.mjs` | `list_proposals`, the 30-day voting cap, and the treasury's 25% single-spend cap (the vote passes, execution is refused, funds untouched, the proposal stays retryable). |
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
