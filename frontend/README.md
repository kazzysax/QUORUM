# Quorum Frontend Application

<p align="center">
  <strong>Liquid NFTs with voting rights, on NEAR Protocol.</strong>
</p>

A React 19 + TypeScript + Vite web client matching Quorum's dark luxury visual design system and connecting to the Quorum smart contracts and Fastify indexer API.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
The application will launch at [http://127.0.0.1:3000](http://127.0.0.1:3000).

### 3. Production Build & Preview
```bash
npm run build
npm run preview
```

---

## 🧭 Page Features & Architecture

| Route / View | Feature Description | On-Chain / API Operation |
| :--- | :--- | :--- |
| **Marketplace** | Discovery hub, featured drops carousel (`Molten Hours`, `Tidewater`), 24h collection rankings, and live P2P secondary listings. | `GET /market/listings`, `MARKET.buy({nft, token_id})` |
| **Mint Studio** | Staged public/presale minting, Merkle allowlist verification, and 50/50 transparent split visualizer (50% to DAO, 50% backing vault). | `GET /mint/proof`, `NFT.mint({stage, proof})` |
| **Portfolio** | Holder dashboard tracking liquid backing value, token vault accounts (`v[id].[col].near`), dividend claims, and **90% burn-to-redeem exit**. | `NFT.burn_and_redeem()`, `NFT.claim_distribution()` |
| **Governance** | Decentralized proposal tallying, timelock meters, Rhea DEX settlement voting (`min_out` slippage safety), and multi-NFT voting. | `DAO.vote()`, `DAO.propose()`, `DAO.execute()` |
| **Launch Studio** | 6-step collection wizard: provenance hash generator, round-robin asset plan (`token:weight`), stage limits, and governance minimums. | Factory collection & keyless DAO initialization |
| **Sells** | Non-custodial NEP-178 listing calculator with real-time DAO fee (5%) and royalty deduction. | `NFT.nft_approve({account_id: MARKET, msg})` |
| **Offers** | Bilateral P2P escrow offers pipeline with expiration timers. | NEP-178 bilateral offer escrow |
| **Landing** | Procedural SVG night skyline canvas showcasing the Tri-Prong architecture (*Art + Vault + Vote*). | Protocol overview & documentation |

---

## 🔗 Connecting to the Backend API

By default, the frontend seamlessly connects to the local Fastify backend at `http://localhost:8080`.
If the backend daemon is not running, the frontend automatically falls back to an offline reactive mock layer, allowing immediate browser testing with simulated personas (`alice.near`, `creator.near`, `whale.near`).

To run the full stack locally:
```bash
# Terminal 1: Backend Fastify API
npm run api

# Terminal 2: Frontend Web App
npm run dev
```

---

## 🎨 Design Tokens

- **Backgrounds:** Canvas `#0A0A0D`, Panels `#15151B`, Cards `#1D1D25`, Deep `#08080A`
- **Accents:** Amber Gold `#F5A524`, Hover `#FBBF5A`, Glow `rgba(245, 165, 36, 0.14)`
- **Typography:** Headings in *Space Grotesk*, Body in *Inter*
- **Status:** Success `#86EFAC`, Info `#93C5FD`, Alert `#FCA5A5`
