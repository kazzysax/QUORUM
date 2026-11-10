<p align="center">
  <img src="assets/banner.png" alt="Quorum Banner" width="100%" />
</p>

<p align="center">
  <strong>Liquid NFTs with voting rights, on NEAR Protocol.</strong>
</p>

<p align="center">
  <a href="https://quorum-io-app.vercel.app"><img src="https://img.shields.io/badge/Live%20Demo-Vercel-success?style=for-the-badge&logo=vercel" alt="Live Demo" /></a>
  <a href="https://near.org"><img src="https://img.shields.io/badge/NEAR-Protocol-black?style=for-the-badge&logo=near" alt="NEAR Protocol" /></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-2021-orange?style=for-the-badge&logo=rust" alt="Rust" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22-green?style=for-the-badge&logo=node.js" alt="Node.js" /></a>
  <a href="https://fastify.dev/"><img src="https://img.shields.io/badge/Fastify-5.2-000000?style=for-the-badge&logo=fastify" alt="Fastify" /></a>
  <a href="#test-suite"><img src="https://img.shields.io/badge/Tests-142%20Passed-brightgreen?style=for-the-badge" alt="Tests" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" /></a>
</p>

<p align="center">
  🌐 <strong>Live Web App:</strong> <a href="https://quorum-io-app.vercel.app">https://quorum-io-app.vercel.app</a> &bull; <a href="https://quorumio.vercel.app">https://quorumio.vercel.app</a>
</p>

---

## 📌 Executive Summary

Every Quorum NFT is three things at once:
1. **Art:** A NEP-171 non-fungible token carrying dynamic metadata and high-fidelity visuals.
2. **A Vault:** An independent, keyless NEAR sub-account (`v<id>.<collection>`) holding real backing assets. Holders can withdraw 90% of backing at any time by burning the NFT.
3. **A Vote:** Exactly one live vote per token in the sovereign DAO governing that collection's dedicated on-chain treasury (`tre-<collection>.qrm1.testnet`).

> **Zero Cross-Bridging & 100% Collection Sovereignty:** Each collection is an independent community of its own. There is no general DAO or pooled treasury—every collection deploys its own sovereign DAO, dedicated on-chain treasury, and keyless vaults. Voting rights and treasury value belong exclusively to that collection's holders.

Submitted to the **NEAR Hackathon 2026** (Track: *NFTs That Do Something*).

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                           QUORUM TRI-PRONG                             │
   │                                                                        │
   │       ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
   │       │     ART      │     │    VAULT     │     │     VOTE     │       │
   │       │   NEP-171    │  +  │  Backing FT  │  +  │  1 Token =   │       │
   │       │   Metadata   │     │  Keyless A/C │     │    1 Vote    │       │
   │       └──────────────┘     └──────────────┘     └──────────────┘       │
   └────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 How the Money Moves

| Stage | Mechanism | Details |
|---|---|---|
| **1. Mint** | Staged Allowlist / Public | Buyer attaches stage price in NEAR + 0.03 NEAR storage. **50% transfers to that collection's dedicated DAO Treasury immediately** (`tre-<collection>`). **50% locks as keyless vault backing** (`v<id>.<collection>`). |
| **2. Sovereign DAO** | 1 NFT = 1 Vote | Strictly one vote per token. Only verified holders of that specific collection govern its treasury. Zero cross-collection pooling or voting. |
| **3. Asset Plan** | Deterministic Round-Robin | Fixed at launch (e.g. `wNEAR:1` or `USDC:2, wNEAR:1`). Token #1 and #2 carry USDC, #3 carries wNEAR. Immutable; no party can manipulate assignment. |
| **4. Settlement** | Testnet Native / Mainnet Rhea | Since there is no active DEX liquidity on testnet, settlement on testnet operates with native NEAR backing. On mainnet, holders vote on `SETTLE` proposals routed through Rhea Finance (Ref classic pools) with enforced `min_out` slippage limits. |
| **5. Crediting** | Permissionless Batching | Anyone calls `credit_batch` (up to 3 NFTs per tx) to push pro-rata asset shares into individual vaults. 256-bit arithmetic prevents overflow. |
| **6. Burn to Redeem** | Guaranteed Floor Price | Burn pays **90% of backing to holder** and **10% to the collection's DAO treasury**. Pre-settlement: paid from escrow in NEAR. Post-settlement: paid from vault in FTs. |
| **7. Marketplace** | Non-Custodial Trading | Fixed-price sales via NEP-178 approvals on `mkt.qrm1.testnet`. Sends 5% fee to the collection's DAO treasury, royalty to creator, remainder to seller. Vault custody transitions automatically. |
| **8. Distributions** | $O(1)$ Scalable Dividend | Treasury executes even holder distributions via a global reward index. Gas is constant regardless of total NFT supply. |

---

## 📦 Smart Contracts Specification

All contracts reside in [`code/contracts/`](code/contracts/) and target `near-sdk = "=5.30.1"`.

```
code/contracts/
├── common/         # Shared fee math, 256-bit pro-rata mul_div, events, Rhea message builder
├── vault/          # By-hash global contract (NEP-591) deployed to keyless sub-accounts
├── nft/            # NEP-171/177/178/181 collection, escrow, settlement, burn, vote gate
├── treasury/       # DAO pool, spend/distribution execution, reward index
├── dao/            # Proposals, 1-token-1-vote tally, bounds enforcement, timelock
└── market/         # Fixed-price secondary sales with approval IDs & fee split
```

### 1. `quorum-common`
* **Fee Constants:** `MINT_VAULT_BPS = 5000` (50%), `SALE_POOL_BPS = 500` (5%), `REDEEM_POOL_BPS = 1000` (10%).
* **Pro-Rata Math:** 256-bit `mul_div(a, b, c)` prevents overflow when computing shares of 18-decimal tokens.
* **Swap Engine:** Builds Rhea/Ref-compatible multi-hop swap JSON with mandatory positive `min_amount_out`.

### 2. `quorum-vault`
* **Account:** Keyless sub-account `v<token_id>.<collection>`.
* **Security:** No access keys exist. Accepts deposits only from the verified token owner or collection.
* **Redemption:** Callable exclusively by the collection contract upon verified token burn.

### 3. `quorum-nft`
* **Token Standard:** NEP-171 (Core), NEP-177 (Metadata), NEP-178 (Approvals), NEP-181 (Enumeration), NEP-297 (Events).
* **Minting:** Staged Merkle allowlists + public stages. Enforces wallet quotas and total supply caps.
* **Settlement:** Executes Rhea swaps with pre/post balance assertions.
* **Governance Gate:** Enforces `last_transfer_block < proposal.start_block` to prevent flash-loan vote hijacking.

### 4. `quorum-treasury`
* **Authority:** Keyless, zero admin keys. Disburses funds solely via executed DAO proposals.
* **Distribution Index:** Scaled by $10^{24}$. Incrementing the index divides funds equally across live supply in $O(1)$ operations.
* **Token Registration:** Tokens claim accrued distributions at checkpoint intervals.

### 5. `quorum-dao`
* **Proposals:** `Spend`, `Distribute`, `ParameterChange`, `Settle`, `Swap`, `Text`.
* **Guardrails:** Founder-defined floors for minimum voting duration, quorum, pass thresholds, and timelocks.
* **Execution:** Permissionless after timelock expiration; atomic retry on failure.

### 6. `quorum-market`
* **Escrow-Free:** Sellers retain custody until buyer match via NEP-178 approvals.
* **Front-Running Defense:** Buyers must supply `approval_id`; listing updates invalidate stale purchases.
* **Revenue Distribution:** 5% to Treasury pool, creator royalty to founder, remainder to seller.

---

## 🛠️ NEAR Tools & Technologies (How We Used Them)

Quorum utilizes the official NEAR Protocol stack from low-level smart contract architecture to high-level frontend interfaces:

| NEAR Tool / Standard | Implementation & Role in Quorum |
|---|---|
| **`near-sdk` (Rust 5.30.1)** | Powers all 6 modular on-chain smart contracts (`quorum-nft`, `quorum-vault`, `quorum-treasury`, `quorum-dao`, `quorum-market`, `quorum-common`). Implements re-entrancy safe promises, 256-bit fixed-point math, and gas-metered execution. |
| **Native Keyless Accounts** | Used for individual per-NFT vaults (`v<id>.<collection>`). By deleting/omitting all access keys upon sub-account creation, assets can *never* be extracted by any wallet or backdoor—only via cryptographic token burning executed by the collection contract. |
| **NEP-171 (NFT Core)** | Powers non-fungible token creation, transfers, and burns across all sovereign collections. |
| **NEP-177 (Metadata)** | Dynamically reflects live backing assets, individual vault IDs, and trait parameters in token metadata. |
| **NEP-178 (Approvals)** | Powers non-custodial secondary sales on `mkt.qrm1.testnet`, ensuring sellers retain custody until a buyer matches. |
| **NEP-181 (Enumeration)** | Provides paginated on-chain queries for token supply and holder balances. |
| **NEP-297 (Events)** | Emits standardized event logs (`mint`, `burn`, `transfer`, `treasury_donation`, `treasury_spend`) for real-time indexing. |
| **NEP-413 (Ed25519 Auth)** | Cryptographic wallet challenge-response signing for holder authentication and token-gated community access. |
| **NEP-591 (Code by Hash)** | Deploys `quorum-vault` bytecode once globally, reducing per-vault creation storage costs from ~3 NEAR to ~0.2 NEAR. |
| **`near-cli-rs`** | Automates workspace compilation, account initialization, keyless deployments, and testnet script execution. |
| **NEAR Connect & Wallet Selector** | Multi-wallet integration supporting Meteor Wallet, HOT Connector, NEAR Mobile, and Here Wallet with native testnet signing. |
| **Multi-Provider JSON-RPC** | Resilient failover RPC architecture utilizing **FastNear** (`test.rpc.fastnear.com`) and **dRPC** (`near-testnet.drpc.org`) to bypass legacy RPC rate limits. |

---

## ⚡ Scalability & Sharded Architecture

| Challenge | Quorum Architectural Solution |
|---|---|
| **Storage Cost per Vault** | Deploying unique contract bytecode to every sub-account costs ~3 NEAR each. Quorum deploys `quorum-vault` **once as an immutable global contract** (NEP-591, by code hash). Individual vaults reference this code, dropping cost to ~0.2 NEAR. |
| **Sharded Load Balancing** | Each vault is an isolated NEAR account (`v<id>.<collection>`). Operations (deposits, redemptions) execute across multiple shards concurrently instead of bottlenecking on a single contract. |
| **Constant-Time Distributions** | Traditional token dividends iterate over all holders ($O(N)$ gas). Quorum uses an accumulator index per asset; each NFT calculates its owed share on claim ($O(1)$ gas). |
| **Bounded Block Execution** | Strict execution boundaries: maximum 9 asset types, 15 votes per transaction batch, 3 vault credits per call. Zero unbounded loops. |

---

## 🛡️ Security Model & Invariants

### Trust Boundaries

```
┌───────────┬───────────────────────────────────┬────────────────────────────────────────┐
│ Actor     │ Permitted Capabilities            │ Prohibited Actions                     │
├───────────┼───────────────────────────────────┼────────────────────────────────────────┤
│ Vault     │ Receive assets, execute burn-out  │ Move funds without collection burning  │
│ Treasury  │ Execute passed DAO proposals      │ Move funds without DAO authorization   │
│ Founder   │ Pause, lower royalty, set hash*   │ Alter asset plan, touch vaults/funds   │
│ DAO       │ Parameter updates, spends, swaps  │ Override fee splits or asset plan      │
└───────────┴───────────────────────────────────┴────────────────────────────────────────┘
* Vault code hash may only be altered prior to the very first mint.
```

### 9-Point Transfer Threat Model

1. **Keep a Vault Key:** Impossible. Vault account is spawned keyless in the same batch as `new()`.
2. **Withdraw Before Selling:** Vault exposes zero withdrawal or external transfer methods.
3. **Burn Immediately After Selling:** `burn_and_redeem` evaluates real-time on-chain state, paying the current owner.
4. **Claim Prior Distributions After Sale:** Checkpoint distributions adhere to the token, transferring to the buyer.
5. **Vote After Selling:** Transfer updates `last_transfer_block`; DAO rejects votes from tokens transferred after proposal start.
6. **Deposit Phantom Assets:** Only deposits verified through `can_deposit` ledger are counted as backing.
7. **Mint, Sell, and Collect Escrow:** Escrow belongs to token state, not original minter account.
8. **Double Crediting:** Vault credits set `credited = true` prior to transfer; failures reset state for retry.
9. **Off-Market Secondary Sales:** Accepted behavior. Even on private transfers, the vault travels with the token.

---

## 🧪 Test Suite

The codebase has **142 automated tests** (111 Rust contract unit tests + 31 Node.js indexer/API tests), all passing.

```bash
# 1. Run all 111 Rust Smart Contract Tests
cd code
cargo test --workspace

# 2. Run all 31 Off-Chain Indexer & REST API Tests
cd services/api
npm install
npm test
```

### Coverage Matrix
- `quorum-common`: Pro-rata 256-bit multiplication, fee splits, swap message formats.
- `quorum-vault`: Add-only ledger, permissioned redemption, stray NEAR sweep, failed payout queues.
- `quorum-nft`: Staged allowlist mints, wallet limits, escrow splits, Rhea swap execution, batch crediting, fallback trigger.
- `quorum-treasury`: Spending, $O(1)$ reward distribution index, token claims, approved DEX management.
- `quorum-dao`: Quorum threshold calculations, transfer-block voter filtering, timelock enforcement, retryable execution.
- `quorum-market`: NEP-178 callbacks, approval ID race condition defense, 3-way payout splits.
- `services/api`: Neardata block decoding, NEP-297 event ingestion, NEP-413 Ed25519 authentication, SQLite transaction atomicity.

---

## 🚀 Quickstart & Deployment

### Prerequisites
- [Rust](https://rustup.rs/) (with `wasm32-unknown-unknown` target)
- [Node.js](https://nodejs.org/) (v22+)
- [near-cli-rs](https://github.com/near/near-cli-rs)
- [Docker](https://www.docker.com/) & Docker Compose

### 1. Build Contracts
```bash
cd code
cargo build --workspace --target wasm32-unknown-unknown --release
```

### 2. Deploy to Testnet (Rehearsal)
```bash
cd code
FOUNDER=youraccount.testnet \
PREFIX=quorum1 \
ASSET_PLAN="wrap.testnet:1" \
WRAP=wrap.testnet \
./scripts/deploy.sh
```

### 3. Deploy to Mainnet (Guarded)
```bash
cd code
NETWORK=mainnet \
CONFIRM_MAINNET=yes \
FOUNDER=youraccount.near \
PREFIX=quorum1 \
ASSET_PLAN="17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1:2,wrap.near:1" \
./scripts/deploy.sh
```

### 🚀 Mainnet Moves (Short Deployment Runbook)
Transitioning a sovereign collection to NEAR mainnet follows a clean, guarded progression:
1. **Compile & Optimize Bytecode:** Build Rust contracts targeting `wasm32-unknown-unknown` and optimize vault wasm (`wasm-opt -Oz`).
2. **Fund Founder Account:** Fund the deployer wallet on mainnet (`you.near`).
3. **Deploy Global Vault Hash:** Publish the immutable `quorum-vault` bytecode once globally via NEP-591.
4. **Deploy Sovereign Collection Contracts:** Run `./scripts/deploy.sh` to initialize `<collection>.near`, `dao-<collection>.near`, `tre-<collection>.near`, and `mkt.<collection>.near`.
5. **DEX Liquidity & Rhea Routing:** Since there is no active DEX liquidity on testnet, settlement on testnet operates with native NEAR backing. On mainnet, we use **Rhea Finance (Ref classic pools)** for automated multi-token routing and slippage-protected settlement.
*(Steps 6 and 9 are removed)*
6. **Batch Vault Crediting:** Execute `credit_batch` transactions (up to 3 NFTs per call) to push pro-rata asset shares into individual vaults.
7. **Burn & Redeem Verification:** Confirm that burning an NFT disburses 90% of backing to the holder and 10% to that collection's DAO treasury.
8. **NEP-413 Gated Sign-In:** Verify cryptographic holder portal sign-in before opening public minting.

---

### 💎 Live Testnet Verification (`qrm1.testnet`)

Every collection is an independent sovereign community verified on NEAR testnet with isolated balances and dedicated governance:

| Contract / Account | Role | Live Testnet Status |
|---|---|---|
| `tre-molt.qrm1.testnet` | Molten Hours DAO Treasury | **10.0000 NEAR** (Verified on-chain) |
| `tre-tide.qrm1.testnet` | Tidewater DAO Treasury | **10.0000 NEAR** (Verified on-chain) |
| `tre-feath.qrm1.testnet` | Feather Protocol DAO Treasury | **10.0000 NEAR** (Verified on-chain) |
| `dao-molt.qrm1.testnet` | Molten Hours Governance DAO | **0.5000 NEAR** (1 NFT = 1 Vote) |
| `dao-tide.qrm1.testnet` | Tidewater Governance DAO | **0.5000 NEAR** (1 NFT = 1 Vote) |
| `dao-feath.qrm1.testnet` | Feather Protocol Governance DAO | **0.5000 NEAR** (1 NFT = 1 Vote) |
| `mkt.qrm1.testnet` | Quorum Marketplace Contract | Active secondary listings & non-custodial sales |
| `v<id>.<collection>` | Keyless NFT Vaults | Immutable cryptographic sub-accounts |

---

### 4. Run Web Frontend (Local Development)
```bash
# From workspace root:
npm run dev

# Or directly in frontend folder:
cd frontend
npm install
npm run dev
```
Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser to interact with the full Quorum application (Marketplace, Staged Minting, Keyless Vaults, Governance Votings, Creator Launch Studio, Sells, and Offers).

### 5. Run Off-Chain Indexer & API Service
```bash
cd code/services/api
cp .env.example .env
# Configure COLLECTION, DAO, TREASURY, MARKET addresses in .env
docker compose up --build
```

---

## 🌐 REST API Endpoints

The API runs on port `:8080` by default.

```
GET   /health                          # Indexer sync cursor & health
GET   /nfts                            # Paginated live NFTs (filter by ?owner=, ?listed=true)
GET   /nfts/:id                        # Token metadata, backing vault balances, votes cast
GET   /nfts/:id/history                # Complete audit trail: ownership, yields, payouts
GET   /metadata/:id.json               # Dynamic NEP-177 metadata with live vault attributes
GET   /settlement                      # Group swap phases, total escrow, uncredited token IDs
GET   /mint/proof?stage=0&account=..   # Merkle allowlist proof for presale minting
GET   /market/listings                 # Active marketplace listings
GET   /market/sales                    # Historic sales record
GET   /dao/proposals                   # DAO proposals with real-time voting tallies
GET   /treasury                        # Inflows, outflows, distributions, reserves
POST  /auth/challenge                  # Holder NEP-413 login challenge
POST  /auth/verify                     # Verify Ed25519 signature & issue session token
GET   /gated/me                        # Holder-only account portal (re-checks NFT balance)
GET   /gated/members                   # Token-gated community member directory
```

---

## 🗺️ Roadmap

- [x] **Phase 1: Core Protocol (NEAR Hackathon 2026)**
  - 6 Rust smart contracts (`near-sdk 5.30.1`)
  - Keyless sub-account vaults with NEP-591 global bytecode
  - Rhea Finance DEX settlement integration with fallback safety
  - Neardata indexer & Fastify REST API with NEP-413 gated auth
  - 8 Interactive artboard designs & 6 generative art collections
- [ ] **Phase 2: Self-Serve & Liquidity**
  - Collection factory for self-serve one-click launches
  - Dutch & English auction mechanisms
  - Automated keeper bots for permissionless vault crediting
  - Delayed reveals with cryptographic provenance verification
- [ ] **Phase 3: Privacy & Advanced DEX**
  - Sealed-bid auctions and private OTC transfers
  - Rhea concentrated-liquidity pool support
  - TEE-managed keeper keys via Shade Agents

---

## 📄 License

Licensed under the [MIT License](LICENSE).
Built with ❤️ for the NEAR Protocol Ecosystem.
