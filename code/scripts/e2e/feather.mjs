// Feather Protocol end-to-end: mint, then the permissionless FALLBACK settlement path. No DAO vote
// settles this collection, so after the grace period anyone can switch the group to plain NEAR
// crediting, and holders can burn for 90%. Runs on its own users (dave, erin, frank).
import { call, check, mustFail, mustSucceed, summary, view, balance, F, near, fmt, sleep, waitFor } from './lib.mjs';

const NFT = `feather.${F}`, TRE = `feather-tre.${F}`;
const dave = `dave.${F}`, erin = `erin.${F}`, frank = `frank.${F}`;
const PRICE = near(0.5), cost = near(0.53);
const owner = async (id) => (await view(NFT, 'nft_token', { token_id: String(id) }))?.owner_id;

console.log('== mint');
const plan = [dave, dave, erin, erin, frank, frank];
for (let id = 1; id <= 6; id++) {
  const u = plan[id - 1];
  const treB = BigInt(await view(TRE, 'native_balance'));
  mustSucceed(`${u.split('.')[0]} mints #${id}`, await call(u, NFT, 'mint', { stage: 0, proof: null }, { deposit: cost }));
  await waitFor(`token ${id}`, async () => (await owner(id)) === u);
  await sleep(4000);
  check(`treasury +0.25 for #${id}`, BigInt(await view(TRE, 'native_balance')) - treB === PRICE / 2n);
}
check('sold out, mint closed', (await view(NFT, 'mint_closed')) === true);
const closedAt = Number(await view(NFT, 'mint_closed_at_ms'));
const cfg = await view(NFT, 'get_config');
const unlock = closedAt + Number(cfg.settle_grace_ms);
console.log(`mint closed ${new Date(closedAt).toISOString()}, grace ${Number(cfg.settle_grace_ms) / 60000} min, fallback opens ${new Date(unlock).toISOString()}`);

console.log('\n== before the grace period nobody can force a fallback or credit');
mustFail('fallback refused early', await call(erin, NFT, 'enable_fallback', { group: 0 }), 'grace period');
mustFail('credit refused while Pending', await call(erin, NFT, 'credit_batch', { group: 0, token_ids: ['1'] }), 'not ready for crediting');
mustFail('only the DAO can settle', await call(erin, NFT, 'settle_group', { group: 0, hops: [], min_out: '1' }), 'Only the DAO');

const wait = unlock - Date.now() + 5000;
if (wait > 0) { console.log(`waiting ${Math.ceil(wait / 60000)} min for the grace period...`); await sleep(wait); }

console.log('\n== after the grace period: anyone can enable the NEAR fallback');
mustSucceed('erin enables the fallback', await call(erin, NFT, 'enable_fallback', { group: 0 }));
await waitFor('phase Fallback', async () => (await view(NFT, 'settlement_status'))[0].phase === 'Fallback');
check('group is in Fallback', true);
mustFail('fallback cannot be enabled twice', await call(erin, NFT, 'enable_fallback', { group: 0 }), 'not waiting for a swap');
for (const batch of [['1', '2', '3'], ['4', '5', '6']]) mustSucceed(`erin credits ${batch.join(',')}`, await call(erin, NFT, 'credit_batch', { group: 0, token_ids: batch }));
await sleep(8000);
for (let i = 1; i <= 6; i++) {
  const b = (await view(`v${i}.${NFT}`, 'vault_info')).balances.find((x) => x[0] === 'near');
  check(`vault #${i} holds 0.25 NEAR`, b && BigInt(b[1]) === near(0.25), b ? fmt(b[1]) : 'none');
}
console.log('\n== burn after fallback: 90% to the holder, 10% to the treasury');
const treB = BigInt(await view(TRE, 'native_balance')), dB = await balance(dave);
mustSucceed('dave burns #1', await call(dave, NFT, 'burn_and_redeem', { token_id: '1' }, { deposit: 1n }));
await waitFor('redeemed', async () => JSON.stringify((await view(`v1.${NFT}`, 'vault_info')).status).includes('Redeemed'));
await sleep(8000);
const gain = (await balance(dave)) - dB;
check('dave received 0.225 NEAR (minus gas)', gain > near(0.21) && gain <= near(0.225), fmt(gain));
check('treasury received 0.025 NEAR', BigInt(await view(TRE, 'native_balance')) - treB === near(0.025), fmt(BigInt(await view(TRE, 'native_balance')) - treB));
check('live supply = 5', (await view(NFT, 'live_supply')) === '5');
process.exit(summary() ? 0 : 1);
