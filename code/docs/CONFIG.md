# quorum-nft `new` arguments

Generate with `scripts/make-init.mjs` (it takes env vars and prints this JSON).

```json
{
  "metadata": { "spec": "nft-1.0.0", "name": "Quorum", "symbol": "QRM" },
  "config": {
    "founder": "you.near",
    "treasury": "treasury.quorum1.you.near",
    "dao": "dao.quorum1.you.near",
    "vault_allowlist": [],
    "vault_code_hash": "<base58 sha256 of quorum_vault.wasm>",
    "mint_storage_cost": "30000000000000000000000",
    "max_supply": 10,
    "stages": [
      { "name": "Public", "kind": "Public", "price_near": "2000000000000000000000000",
        "start_ms": "0", "end_ms": "0", "per_wallet_limit": 5, "merkle_root": null }
    ],
    "royalty_bps": 500,
    "royalty_recipient": "you.near",
    "metadata_base_url": "https://api.example.com",
    "media_base_url": "https://media.example.com",
    "paused": true,
    "provenance_hash": null,
    "asset_plan": [
      { "token": "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", "weight": 2 },
      { "token": "wrap.near", "weight": 1 }
    ],
    "dex": "v2.ref-finance.near",
    "wrap_account": "wrap.near",
    "settle_grace_ms": "1209600000"
  }
}
```

* **Prices are in yoctoNEAR.** `mint_storage_cost` is paid on top and funds the NFT's vault account.
* **`asset_plan`** assigns assets round-robin by weight: weights 2,1 mean NFT #1 and #2 carry the first token, #3 the second, #4 and #5 the first, and so on. It is fixed forever. A group whose token is the `wrap_account` simply holds wNEAR (no swap).
* **Every plan token must have a Rhea pool** from wNEAR (or a route through one) with enough liquidity for that group's escrow. Check this before launch: the contract cannot.
* NEAR and every plan asset are added to the vault allow-list automatically.
* `dex` is the Rhea/Ref classic-pool contract swaps are sent to; the DAO can change it later.
* Allowlist leaves are `sha256(account_id)`; the API builds the tree from `ALLOWLISTS_FILE` (see `services/api/src/merkle.js`).
