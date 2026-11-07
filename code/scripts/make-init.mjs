#!/usr/bin/env node
// Prints the JSON args for `quorum-nft.new`. Reads env. Times are relative to now.
// Required: FOUNDER TREASURY DAO VAULT_CODE_HASH ASSET_PLAN
//   ASSET_PLAN="17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1:2,wrap.near:1"
//     -> token:weight pairs. NFTs are assigned round-robin by weight: with weights 2,1 the 1st and 2nd
//        NFT carry the first token, the 3rd carries the second, and so on. Fixed forever at launch.
//        Using the wNEAR token (wrap.near) means "hold wNEAR": no swap needed for that group.
// Optional: NETWORK=testnet|mainnet  PUBLIC_NEAR=2  PRESALE_NEAR=1  PRESALE_ROOT_B64  MAX_SUPPLY
//   PRESALE_MIN=60 PUBLIC_MIN=180 ROYALTY_BPS=500 PAUSED PROVENANCE_HASH_B64 DEX=v2.ref-finance.near
//   WRAP=wrap.near SETTLE_GRACE_DAYS=14 METADATA_BASE_URL MEDIA_BASE_URL COLLECTION_NAME SYMBOL
const e = process.env;
const need = (k) => { if (!e[k]) { console.error(`Missing ${k}`); process.exit(1); } return e[k]; };
const mainnet = e.NETWORK === "mainnet";
const now = Date.now(), min = 60_000;
const yocto = (near) => { const [w, f = ""] = String(near).split("."); return (BigInt(w) * 10n ** 24n + BigInt((f + "0".repeat(24)).slice(0, 24))).toString(); };

const plan = need("ASSET_PLAN").split(",").map((p) => {
  const [token, weight] = p.trim().split(":");
  if (!token || !(Number(weight) > 0)) { console.error(`Bad ASSET_PLAN entry "${p}" (want token:weight)`); process.exit(1); }
  return { token, weight: Number(weight) };
});

const presaleMin = Number(e.PRESALE_MIN ?? 60), publicMin = Number(e.PUBLIC_MIN ?? 180);
const stages = [];
if (e.PRESALE_ROOT_B64) {
  stages.push({ name: "Presale", kind: "Presale", price_near: yocto(e.PRESALE_NEAR ?? 1), start_ms: String(now + 2 * min),
    end_ms: String(now + presaleMin * min), per_wallet_limit: 2, merkle_root: e.PRESALE_ROOT_B64 });
}
stages.push({ name: "Public", kind: "Public", price_near: yocto(e.PUBLIC_NEAR ?? 2),
  start_ms: String(now + (e.PRESALE_ROOT_B64 ? presaleMin : 2) * min), end_ms: String(now + publicMin * min), per_wallet_limit: 5, merkle_root: null });

console.log(JSON.stringify({
  args: {
    metadata: { spec: "nft-1.0.0", name: e.COLLECTION_NAME ?? "Quorum", symbol: e.SYMBOL ?? "QRM" },
    config: {
      founder: need("FOUNDER"), treasury: need("TREASURY"), dao: need("DAO"),
      vault_allowlist: [],              // NEAR and every plan asset are added by the contract
      vault_code_hash: need("VAULT_CODE_HASH"),
      mint_storage_cost: "30000000000000000000000", // 0.03 NEAR on top of the price
      max_supply: Number(e.MAX_SUPPLY ?? (mainnet ? 10 : 100)), stages,
      royalty_bps: Number(e.ROYALTY_BPS ?? 500), royalty_recipient: need("FOUNDER"),
      metadata_base_url: e.METADATA_BASE_URL ?? "http://localhost:8080",
      media_base_url: e.MEDIA_BASE_URL ?? "http://localhost:8080/media",
      // Mainnet launches paused: unpause only after your own smoke-test mint, settle and burn work.
      paused: e.PAUSED ? e.PAUSED === "true" : mainnet,
      provenance_hash: e.PROVENANCE_HASH_B64 ?? null,
      asset_plan: plan,
      dex: e.DEX ?? "v2.ref-finance.near",
      wrap_account: e.WRAP ?? "wrap.near",
      settle_grace_ms: String(Number(e.SETTLE_GRACE_DAYS ?? 14) * 86_400_000),
    },
  },
}, null, 2));
