// Acceptance, part 2: runs after the voting windows. Outcomes follow the votes, the DAO rules hold
// when executing, distributions are exact, and a burn after settlement pays 90/10.
// Usage (from code/): node scripts/e2e/acceptance-2.mjs
import fs from 'node:fs';
import { call, check, mustFail, mustSucceed, summary, view, balance, F, near, fmt, sleep, waitFor } from './lib.mjs';

const M = `molten.${F}`, DAO = `molten-dao.${F}`, TRE = `molten-tre.${F}`, WRAP = 'wrap.testnet';
const U = (n) => `${n}.${F}`;
const [alice, bob, carol, frank] = ['alice', 'bob', 'carol', 'frank'].map(U);
const { ids, depTok, depOwner, unlock } = JSON.parse(fs.readFileSync(new URL('./acceptance-ids.json', import.meta.url), 'utf8'));
const status = (id) => view(DAO, 'status_of', { proposal_id: id });
const treNear = async () => BigInt(await view(TRE, 'native_balance'));
const wrapBal = async (a) => BigInt(await view(WRAP, 'ft_balance_of', { account_id: a }));
const ownerOf = async (id) => (await view(M, 'nft_token', { token_id: String(id) }))?.owner_id;

const wait = unlock - Date.now();
if (wait > 0) { console.log(`waiting ${Math.ceil(wait / 1000)}s for the voting windows and timelocks...`); await sleep(wait); }
await waitFor('all windows closed', async () => (await status(ids.text2)) !== 'Voting' && (await status(ids.spend)) !== 'Voting');

console.log('== outcomes follow the votes');
check('pay carol 1 NEAR: 85% turnout, all yes -> Passed', (await status(ids.spend)) === 'Passed');
check('distribute 1 NEAR: Passed', (await status(ids.distribute)) === 'Passed');
check('spend 8 NEAR: the vote passes (the cap is enforced at execution)', (await status(ids.overcap)) === 'Passed');
check('text signal with 15% turnout -> Failed (quorum not met)', (await status(ids.text)) === 'Failed');
check('text signal with 70% turnout, every vote no -> Failed (majority against)', (await status(ids.text2)) === 'Failed');
check('spend with only 15% turnout -> Failed even though every vote was yes', (await status(ids.lowturn)) === 'Failed');
for (const [name, id] of [['low-turnout text', ids.text], ['voted-down text', ids.text2], ['low-turnout spend', ids.lowturn]]) {
  mustFail(`a failed proposal cannot be executed (${name})`, await call(carol, DAO, 'execute', { proposal_id: id }), 'has not passed');
}

console.log('\n== votes are verifiable: every tally equals the per-NFT vote records');
for (const [name, id] of Object.entries(ids)) {
  const p = await view(DAO, 'get_proposal', { proposal_id: id });
  let recorded = 0;
  for (let t = 1; t <= 20; t++) if (await view(DAO, 'has_voted', { proposal_id: id, token_id: String(t) })) recorded++;
  check(`${name} (#${id}): yes+no+abstain = NFTs recorded as voted`, Number(p.yes) + Number(p.no) + Number(p.abstain) === recorded, `${p.yes}+${p.no}+${p.abstain} = ${recorded}`);
}

console.log('\n== execute the spend: the treasury pays exactly what holders approved');
const [treB, carolB] = [await treNear(), await balance(carol)];
mustSucceed('anyone (bob) executes the spend', await call(bob, DAO, 'execute', { proposal_id: ids.spend }));
await sleep(9000);
check('the treasury paid exactly 1 NEAR', treB - (await treNear()) === near(1), fmt(treB - (await treNear())));
check('the recipient received exactly 1 NEAR', (await balance(carol)) - carolB === near(1), fmt((await balance(carol)) - carolB));
check('the proposal is marked executed', (await status(ids.spend)) === 'Executed');
mustFail('it cannot be executed twice', await call(bob, DAO, 'execute', { proposal_id: ids.spend }), 'has not passed');

console.log('\n== the 50% spend cap: a passed vote for 8 NEAR cannot drain the treasury');
const treC = await treNear();
mustSucceed('someone executes the 8 NEAR spend (the transaction itself goes through)', await call(bob, DAO, 'execute', { proposal_id: ids.overcap }));
await sleep(9000);
check('the treasury balance did not move (the cap refused the payment)', (await treNear()) === treC, `${fmt(treC)} NEAR before and after`);
check('the proposal stays Passed and can be retried, nothing is lost', (await status(ids.overcap)) === 'Passed');

console.log('\n== distribution: an equal split by the reward index, reserved from spending');
const resB = BigInt(await view(TRE, 'reserved_for', { asset: 'near' }));
mustSucceed('anyone executes the distribution', await call(bob, DAO, 'execute', { proposal_id: ids.distribute }));
await sleep(9000);
const resA = BigInt(await view(TRE, 'reserved_for', { asset: 'near' }));
check('1 NEAR is reserved for holders', resA - resB === near(1), fmt(resA - resB));
const live = Number(await view(M, 'live_supply'));
const aliceTok = (await view(M, 'nft_tokens_for_owner', { account_id: alice, from_index: '0', limit: 10 }))[0].token_id;
check(`each of the ${live} live NFTs is owed an equal share`, BigInt(await view(TRE, 'owed_to', { token_id: aliceTok, asset: 'near' })) === near(1) / BigInt(live), fmt(await view(TRE, 'owed_to', { token_id: aliceTok, asset: 'near' })));
mustFail('a non-owner cannot claim for a token', await call(bob, M, 'claim_distribution', { token_id: aliceTok, asset: 'near' }), 'Not the owner');
const aB = await balance(alice);
mustSucceed('the owner claims', await call(alice, M, 'claim_distribution', { token_id: aliceTok, asset: 'near' }));
await sleep(7000);
check('alice received her share (minus gas)', (await balance(alice)) - aB > near(1) / BigInt(live) - near(0.01), fmt((await balance(alice)) - aB));
mustFail('a second claim has nothing to claim', await call(alice, M, 'claim_distribution', { token_id: aliceTok, asset: 'near' }), 'Nothing to claim');
check('the treasury cannot spend what is reserved for holders', BigInt(await view(TRE, 'reserved_for', { asset: 'near' })) > 0n);

console.log('\n== burn after settlement: 90% of the vault to the holder, 10% to the treasury');
check(`vault #${depTok} was credited with wNEAR by the no-vote settlement`, (await view(M, 'token_state', { token_id: depTok })).credited === true);
const frankHoldsIt = (await ownerOf(depTok)) === depOwner;
check(`${depOwner.split('.')[0]} still owns #${depTok}`, frankHoldsIt);
await call(depOwner, WRAP, 'storage_deposit', { account_id: depOwner, registration_only: true }, { deposit: near(0.00125) });
const [fW, tW, fN] = [await wrapBal(depOwner), await wrapBal(TRE), await balance(depOwner)];
mustSucceed(`${depOwner.split('.')[0]} burns #${depTok}`, await call(depOwner, M, 'burn_and_redeem', { token_id: depTok }, { deposit: 1n }));
await waitFor('vault redeemed', async () => JSON.stringify((await view(`v${depTok}.${M}`, 'vault_info')).status).includes('Redeemed'));
await sleep(8000);
check('the holder received 90% of the vault in wNEAR (0.45)', (await wrapBal(depOwner)) - fW === near(0.45), fmt((await wrapBal(depOwner)) - fW));
check('the treasury received 10% in wNEAR (0.05)', (await wrapBal(TRE)) - tW === near(0.05), fmt((await wrapBal(TRE)) - tW));
console.log(`      NEAR the holder also received (his own 0.1 NEAR vault deposit, minus the 10% treasury share, plus his distribution): ${fmt((await balance(depOwner)) - fN)}`);
check('the NFT no longer exists; live supply 19, minted_total still 20', (await ownerOf(depTok)) == null && (await view(M, 'live_supply')) === '19' && (await view(M, 'minted_total')) === '20');
mustFail('a burned token cannot vote', await call(depOwner, M, 'vote', { proposal_id: ids.overcap, token_ids: [depTok], choice: 1 }), 'burned');
process.exit(summary() ? 0 : 1);
