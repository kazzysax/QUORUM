#!/usr/bin/env node
// After a swap (or fallback), every NFT's vault must be credited, 3 NFTs per transaction.
// Anyone can run these. This prints the near-cli commands for everything still uncredited.
//   API=http://localhost:8080 NFT=quorum1.you.near NETWORK=mainnet SIGNER=you.near node scripts/credit-commands.mjs
const { API = "http://localhost:8080", NFT, NETWORK = "testnet", SIGNER } = process.env;
if (!NFT || !SIGNER) { console.error("Set NFT and SIGNER"); process.exit(1); }
const { groups } = await (await fetch(`${API}/settlement`)).json();
let n = 0;
for (const g of groups) {
  if (!["Swapped", "Fallback"].includes(g.phase)) { console.error(`group ${g.idx} (${g.asset}): ${g.phase}, nothing to credit yet`); continue; }
  for (let i = 0; i < g.uncredited.length; i += 3) {
    const ids = g.uncredited.slice(i, i + 3);
    console.log(`near contract call-function as-transaction ${NFT} credit_batch json-args '${JSON.stringify({ group: g.idx, token_ids: ids })}' prepaid-gas '300 Tgas' attached-deposit '0 NEAR' sign-as ${SIGNER} network-config ${NETWORK} sign-with-keychain send`);
    n++;
  }
}
console.error(`${n} transaction(s) to run`);
