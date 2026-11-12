// Upgrades the live collection contracts (code only, state kept) and proves on testnet that a wNEAR
// collection settles WITHOUT a vote once its mint is over: any account can wrap the escrow, any
// account can credit the vaults, and the vaults then hold their wNEAR backing.
// Usage (from code/): node scripts/e2e/settle-open.mjs
import fs from 'node:fs';
import { account, view, call, check, mustSucceed, mustFail, summary, balance, near, fmt, F, sleep, TGAS, waitFor } from './lib.mjs';

const NFTS = [`molten.${F}`, `tidewater.${F}`, `feather-protocol.${F}`];
const code = fs.readFileSync('res/quorum_nft_opt.wasm');
for (const id of NFTS) { await account(id).deployContract(code); console.log('upgraded', id); await sleep(1000); }
await sleep(3000);
for (const id of NFTS) check(`${id} state kept after upgrade`, Number(await view(id, 'nft_total_supply')) > 0);

const STRANGER = `frank.${F}`; // a holder with no special role; not the DAO, not the founder
const MOLTEN = NFTS[0];
const wrap = (await view(MOLTEN, 'get_config')).wrap_account;

// 1. An open mint cannot be settled, by anyone.
mustFail('Tidewater (mint open) cannot be settled yet', await call(STRANGER, NFTS[1], 'settle_group', { group: 0, hops: [], min_out: '0' }), 'still open');

// 2. Molten is sold out: an ordinary account settles it, no vote.
const escrow = BigInt((await view(MOLTEN, 'settlement_status'))[0].total_share);
mustSucceed(`a plain holder settles Molten Hours (${fmt(escrow)} NEAR escrow -> wNEAR)`, await call(STRANGER, MOLTEN, 'settle_group', { group: 0, hops: [], min_out: '0' }, { gas: 300n * TGAS }));
const g = await waitFor('group swapped', async () => { const x = (await view(MOLTEN, 'settlement_status'))[0]; return x.phase === 'Swapped' ? x : null; });
check('Molten Hours group is Swapped with exactly the escrow in wNEAR', BigInt(g.out_total) === escrow, `${fmt(g.out_total)} wNEAR`);

// 3. Anyone credits the 20 vaults, 3 per transaction.
const ids = (await view(MOLTEN, 'nft_tokens', { from_index: '0', limit: 100 })).map((t) => t.token_id);
for (let i = 0; i < ids.length; i += 3) {
  const batch = ids.slice(i, i + 3);
  mustSucceed(`credit vaults #${batch.join(', #')}`, await call(`erin.${F}`, MOLTEN, 'credit_batch', { group: 0, token_ids: batch }, { gas: 300n * TGAS }));
}
await sleep(4000);
let low = [];
for (const id of ids) {
  const b = BigInt(await view(wrap, 'ft_balance_of', { account_id: `v${id}.${MOLTEN}` }));
  if (b < near(0.5)) low.push(`#${id}=${fmt(b)}`);
}
check('every Molten Hours vault holds its 0.5 wNEAR', low.length === 0, low.join(' ') || `${ids.length} vaults`);
mustFail('a vault cannot be credited twice', await call(STRANGER, MOLTEN, 'credit_batch', { group: 0, token_ids: [ids[0]] }), 'Already credited');
process.exit(summary() ? 0 : 1);
