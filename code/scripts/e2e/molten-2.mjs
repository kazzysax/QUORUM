// Molten Hours, phase 2: runs after the voting window. Executes what passed, settles the escrow
// into wNEAR, credits the vaults, pays a distribution, and burns a settled NFT.
import fs from 'node:fs';
import { call, check, mustFail, mustSucceed, summary, view, balance, F, near, fmt, sleep, waitFor } from './lib.mjs';

const NFT = 'qrmx-molten.testnet', DAO = 'qrmx-molten-dao.testnet', TRE = 'qrmx-molten-tre.testnet', WRAP = 'wrap.testnet';
const alice = `alice.${F}`, bob = `bob.${F}`, carol = `carol.${F}`;
const { ids, unlock } = JSON.parse(fs.readFileSync(new URL('./molten-ids.json', import.meta.url), 'utf8'));
const status = (id) => view(DAO, 'status_of', { proposal_id: id });
const wrapBal = async (acct) => BigInt(await view(WRAP, 'ft_balance_of', { account_id: acct }));
const owner = async (id) => (await view(NFT, 'nft_token', { token_id: String(id) }))?.owner_id;

const wait = unlock - Date.now();
if (wait > 0) { console.log(`waiting ${Math.ceil(wait / 1000)}s for the voting window and timelock...`); await sleep(wait); }
await waitFor('block time past unlock', async () => (await balance(F)) > 0n && Date.now() > unlock);

mustFail('only the DAO can unwrap wNEAR held by the collection', await call(alice, NFT, 'unwrap_wnear', { amount: '1' }), 'Only the DAO');
console.log('== F. outcomes follow the votes');
check('spend passed (yes 6 vs no 1, quorum met)', (await status(ids.spend)) === 'Passed');
check('settle passed', (await status(ids.settle)) === 'Passed');
check('distribute passed', (await status(ids.distribute)) === 'Passed');
check('text failed (no beats yes, abstain only counts for quorum)', (await status(ids.text)) === 'Failed');
mustFail('a failed proposal cannot be executed', await call(carol, DAO, 'execute', { proposal_id: ids.text }), 'has not passed');

console.log('\n== G. execute spend: treasury pays exactly what holders approved');
const treB = BigInt(await view(TRE, 'native_balance')), carolB = await balance(carol);
mustSucceed('anyone (bob) executes the spend', await call(bob, DAO, 'execute', { proposal_id: ids.spend }));
await sleep(8000);
check('treasury paid exactly 0.2 NEAR', treB - BigInt(await view(TRE, 'native_balance')) === near(0.2));
check('recipient received 0.2 NEAR', (await balance(carol)) - carolB === near(0.2));
check('proposal is marked executed', (await status(ids.spend)) === 'Executed');
mustFail('it cannot be executed twice', await call(bob, DAO, 'execute', { proposal_id: ids.spend }), 'already executed');

console.log('\n== H. settlement: the DAO vote converts the escrow into the group asset');
const group0 = (await view(NFT, 'settlement_status'))[0];
check('before settling: Pending, escrow 2 NEAR', group0.phase === 'Pending' && BigInt(group0.total_share) === near(2));
const nftWrapB = await wrapBal(NFT);
mustSucceed('anyone executes the settle proposal', await call(carol, DAO, 'execute', { proposal_id: ids.settle }));
const settled = await waitFor('group Swapped', async () => { const g = (await view(NFT, 'settlement_status'))[0]; return g.phase === 'Swapped' ? g : null; }, { tries: 30 });
check('group is Swapped with out_total = 2 wNEAR', BigInt(settled.out_total) === near(2));
check('the collection now holds that wNEAR', (await wrapBal(NFT)) - nftWrapB === near(2));
mustFail('burn is refused until the vault is credited', await call(alice, NFT, 'burn_and_redeem', { token_id: '1' }, { deposit: 1n }), 'Credit this NFT');
mustFail('credit batches are capped at 3', await call(carol, NFT, 'credit_batch', { group: 0, token_ids: ['1', '2', '3', '4'] }), '1 to 3 tokens');

console.log('\n== I. permissionless crediting pushes each NFT its pro-rata share');
for (const batch of [['1', '2', '3'], ['4', '5', '6'], ['7', '8']]) {
  mustSucceed(`carol credits ${batch.join(',')}`, await call(carol, NFT, 'credit_batch', { group: 0, token_ids: batch }));
}
await sleep(8000);
for (let i = 1; i <= 8; i++) {
  const vi = await view(`v${i}.${NFT}`, 'vault_info');
  const w = vi.balances.find((b) => b[0] === `nep141:${WRAP}`);
  const extra = i === 1 ? near(0.1) : i === 3 ? near(0.1) : 0n; // owner deposits made in phase 1
  const near_ = vi.balances.find((b) => b[0] === 'near');
  check(`vault #${i} holds 0.25 wNEAR${extra ? ' (+0.1 NEAR owner deposit)' : ''}`, w && BigInt(w[1]) === near(0.25) && (!extra || (near_ && BigInt(near_[1]) === extra)), JSON.stringify(vi.balances.map((b) => [b[0], fmt(b[1])])));
}
check('every token is marked credited', (await Promise.all([1,2,3,4,5,6,7,8].map((i) => view(NFT, 'token_state', { token_id: String(i) })))).every((s) => s.credited));
mustFail('crediting twice is refused', await call(carol, NFT, 'credit_batch', { group: 0, token_ids: ['1'] }), 'Already credited');

console.log('\n== J. distribution: equal split via the reward index');
const resB = BigInt(await view(TRE, 'reserved_for', { asset: 'near' }));
mustSucceed('anyone executes the distribution', await call(bob, DAO, 'execute', { proposal_id: ids.distribute }));
await sleep(8000);
const resA = BigInt(await view(TRE, 'reserved_for', { asset: 'near' }));
check('0.4 NEAR is reserved for holders (never spendable)', resA - resB === near(0.4), fmt(resA - resB));
check('each of 8 NFTs is owed 0.05 NEAR', BigInt(await view(TRE, 'owed_to', { token_id: '1', asset: 'near' })) === near(0.05));
mustFail('a non-owner cannot claim for a token', await call(bob, NFT, 'claim_distribution', { token_id: '1', asset: 'near' }), 'Not the owner');
const aB = await balance(alice);
mustSucceed('alice claims #1', await call(alice, NFT, 'claim_distribution', { token_id: '1', asset: 'near' }));
await sleep(6000);
const gain = (await balance(alice)) - aB;
check('alice received 0.05 NEAR (minus gas)', gain > near(0.04) && gain <= near(0.05), fmt(gain));
mustFail('a second claim has nothing to claim', await call(alice, NFT, 'claim_distribution', { token_id: '1', asset: 'near' }), 'Nothing to claim');
check('reserved shrank by exactly the claim', resA - BigInt(await view(TRE, 'reserved_for', { asset: 'near' })) === near(0.05));

console.log('\n== K. burn after settlement: 90% to the holder, 10% to the treasury, unclaimed share in full');
mustSucceed('bob registers on wNEAR so he can be paid', await call(bob, WRAP, 'storage_deposit', { account_id: bob, registration_only: true }, { deposit: near(0.00125) }));
const [bobW, treW, bobN] = [await wrapBal(bob), await wrapBal(TRE), await balance(bob)];
mustSucceed('bob burns #4', await call(bob, NFT, 'burn_and_redeem', { token_id: '4' }, { deposit: 1n }));
await waitFor('vault redeemed', async () => JSON.stringify((await view(`v4.${NFT}`, 'vault_info')).status).includes('Redeemed'));
await sleep(8000);
check('bob received 90% of the vault in wNEAR (0.225)', (await wrapBal(bob)) - bobW === near(0.225), fmt((await wrapBal(bob)) - bobW));
check('treasury received 10% in wNEAR (0.025)', (await wrapBal(TRE)) - treW === near(0.025), fmt((await wrapBal(TRE)) - treW));
check('bob also received his unclaimed 0.05 NEAR distribution in full', (await balance(bob)) - bobN > near(0.04), fmt((await balance(bob)) - bobN));
check('the NFT no longer exists and supply dropped to 7', (await owner(4)) === undefined || (await owner(4)) === null);
check('live supply = 7, minted_total still 8', (await view(NFT, 'live_supply')) === '7' && (await view(NFT, 'minted_total')) === '8');
mustFail('a burned token cannot vote', await call(bob, NFT, 'vote', { proposal_id: ids.text, token_ids: ['4'], choice: 1 }), 'burned');

process.exit(summary() ? 0 : 1);
