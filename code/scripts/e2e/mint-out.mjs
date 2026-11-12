// Mints every remaining piece of a collection through the normal public `mint`, spread across the
// test wallets, and checks the escrow / treasury split.
// Usage (from code/): node scripts/e2e/mint-out.mjs <nft contract>
import { account, view, call, check, mustSucceed, summary, balance, near, fmt, F, sleep, TGAS } from './lib.mjs';

const NFT = process.argv[2];
if (!NFT) { console.error('usage: mint-out.mjs <nft contract>'); process.exit(1); }
const USERS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'].map((u) => `${u}.${F}`);
const cfg = await view(NFT, 'get_config');
const cost = BigInt(cfg.stages[0].price_near) + BigInt(cfg.mint_storage_cost);
const left = cfg.max_supply - Number(await view(NFT, 'nft_total_supply'));
const plan = Array.from({ length: left }, (_, i) => USERS[i % USERS.length]);
console.log(`${left} left to mint at ${fmt(cost)} NEAR each`);

for (const u of new Set(plan)) {
  const need = cost * BigInt(plan.filter((x) => x === u).length) + near(0.8);
  const b = await balance(u);
  if (b < need) { await account(F).transfer({ receiverId: u, amount: need - b }); console.log(`topped up ${u.split('.')[0]} by ${fmt(need - b)}`); await sleep(800); }
}

const nftBefore = await balance(NFT), treBefore = await balance(cfg.treasury);
for (const u of plan) mustSucceed(`${u.split('.')[0]} mints`, await call(u, NFT, 'mint', { stage: 0, proof: null }, { deposit: cost, gas: 300n * TGAS }));
await sleep(3000);
const supply = Number(await view(NFT, 'nft_total_supply'));
check('sold out', supply === cfg.max_supply, `${supply} / ${cfg.max_supply}`);
check('a further mint is refused', !(await call(USERS[0], NFT, 'mint', { stage: 0, proof: null }, { deposit: cost })).ok);
console.log(`treasury +${fmt((await balance(cfg.treasury)) - treBefore)} NEAR, collection escrow +${fmt((await balance(NFT)) - nftBefore)} NEAR`);
process.exit(summary() ? 0 : 1);
