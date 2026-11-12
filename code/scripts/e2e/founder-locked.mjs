// Upgrades the live collection contracts (code only, state kept) and proves on testnet that the
// founder can no longer pause a mint or change the vault code, while minting still works.
// Usage (from code/): node scripts/e2e/founder-locked.mjs
import fs from 'node:fs';
import { account, view, call, check, mustSucceed, mustFail, summary, balance, near, F, sleep, TGAS } from './lib.mjs';

const NFTS = [`molten.${F}`, `tidewater.${F}`, `feather-protocol.${F}`];
const code = fs.readFileSync('res/quorum_nft_opt.wasm');
if (!process.argv.includes('--no-deploy')) for (const id of NFTS) { await account(id).deployContract(code); console.log('upgraded', id); await sleep(1000); }
await sleep(3000);

for (const nft of NFTS) {
  const name = (await view(nft, 'nft_metadata')).name;
  mustFail(`${name}: founder cannot pause the mint (set_paused no longer exists)`, await call(F, nft, 'set_paused', { paused: true }), 'method is not found');
  mustFail(`${name}: founder cannot change the vault code (set_vault_code_hash no longer exists)`, await call(F, nft, 'set_vault_code_hash', { hash: '11111111111111111111111111111112' }), 'method is not found');
  mustFail(`${name}: founder cannot pause through set_param either`, await call(F, nft, 'set_param', { key: 'paused', value: 'true' }), 'Only the DAO');
  check(`${name}: still not paused`, (await view(nft, 'get_config')).paused === false);
}

// Minting still works after the upgrade (a real public mint on an open collection).
const tide = NFTS[1];
const cfg = await view(tide, 'get_config');
const before = Number(await view(tide, 'nft_total_supply'));
const cost = BigInt(cfg.stages[0].price_near) + BigInt(cfg.mint_storage_cost);
const short = cost + near(0.8) - (await balance(`alice.${F}`));
if (short > 0n) { await account(F).transfer({ receiverId: `alice.${F}`, amount: short }); await sleep(1500); }
mustSucceed('a buyer can still mint Tidewater', await call(`alice.${F}`, tide, 'mint', { stage: 0, proof: null }, { deposit: cost, gas: 300n * TGAS }));
await sleep(3000);
check('Tidewater supply went up by one', Number(await view(tide, 'nft_total_supply')) === before + 1, `${before} -> ${before + 1}`);
process.exit(summary() ? 0 : 1);
