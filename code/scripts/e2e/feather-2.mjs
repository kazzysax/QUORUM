// Feather Protocol, second half: the permissionless fallback after the grace period (mint was done by feather.mjs).
import { call, check, mustFail, mustSucceed, summary, view, balance, F, near, fmt, sleep, waitFor } from './lib.mjs';
const NFT = `feather.${F}`, TRE = `feather-tre.${F}`;
const dave = `dave.${F}`, erin = `erin.${F}`, frank = `frank.${F}`;

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
