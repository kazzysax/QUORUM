// Phase 1 of the Molten Hours end-to-end test (real NEAR testnet transactions).
// Covers: access control, mint, 50/50 split, vault keylessness, vault deposits and transfers,
// listing, buying (fee/royalty split), and opening proposals. Phase 2 runs after the voting window.
import { account, call, check, mustFail, mustSucceed, summary, view, balance, exists, F, MARKET, near, NEAR, fmt, sleep, waitFor, provider } from './lib.mjs';

const NFT = 'qrmx-molten.testnet', DAO = 'qrmx-molten-dao.testnet', TRE = 'qrmx-molten-tre.testnet';
const alice = `alice.${F}`, bob = `bob.${F}`, carol = `carol.${F}`;
const PRICE = near(0.5), STORAGE = near(0.03);

console.log('== A. access control: nobody but the right contract/role can do privileged things');
mustFail('non-NFT account cannot record a vote', await call(alice, DAO, 'record_vote', { proposal_id: 1, voter: alice, token_id: '1', last_transfer_block: '1', choice: 1 }), 'Only the NFT contract');
mustFail('non-NFT account cannot create a proposal directly', await call(alice, DAO, 'create_proposal', { proposer: alice, kind: 'Text', purpose: 'x', voting_period_ms: '600000', quorum_bps: 1000, pass_bps: 5000, timelock_ms: '0', live_supply: '8' }), 'Only the NFT contract');
mustFail('non-DAO account cannot spend from the treasury', await call(alice, TRE, 'spend', { recipient: alice, asset: 'near', amount: '1', purpose: 'steal' }), 'Only the DAO');
mustFail('non-DAO account cannot distribute', await call(alice, TRE, 'distribute', { asset: 'near', amount: '1' }), 'Only the DAO');
mustFail('non-NFT account cannot register treasury tokens', await call(alice, TRE, 'register_token', { token_id: '1' }), 'Only the NFT contract');
mustFail('non-DAO account cannot change collection parameters', await call(alice, NFT, 'set_param', { key: 'paused', value: 'true' }), 'Only the DAO');
mustFail('non-DAO account cannot settle', await call(alice, NFT, 'settle_group', { group: 0, hops: [], min_out: '1' }), 'Only the DAO');
mustFail('non-DAO account cannot unwrap wNEAR held by the collection', await call(alice, NFT, 'unwrap_wnear', { amount: '1' }), 'Only the DAO');
mustFail('non-founder cannot pause', await call(alice, NFT, 'set_paused', { paused: true }), 'founder or the DAO');
mustFail('non-owner cannot register a collection on the market', await call(alice, MARKET, 'register_collection', { nft: 'evil.testnet' }), 'Only the owner');
mustFail('an unregistered contract cannot list on the market', await call(alice, MARKET, 'nft_on_approve', { token_id: '1', owner_id: alice, approval_id: 1, msg: '{"price":"1"}' }), 'not registered');
mustFail('non-holder cannot propose', await call(alice, NFT, 'propose', { kind: 'Text', purpose: 'x', voting_period_ms: '600000', quorum_bps: 1000, pass_bps: 5000, timelock_ms: '0' }), 'Only holders or the founder');

console.log('\n== B. mint: 50/50 split, escrow, keyless vaults, limits');
check('collection starts empty', (await view(NFT, 'minted_total')) === '0');
mustFail('mint refuses an under-payment', await call(alice, NFT, 'mint', { stage: 0, proof: null }, { deposit: PRICE }), 'Attach the stage price');
const cost = BigInt(await view(NFT, 'mint_cost', { stage: 0 }));
check('mint cost = price + storage', cost === PRICE + STORAGE, fmt(cost));

async function mintAs(user, expectId) {
  const treBefore = BigInt(await view(TRE, 'native_balance'));
  const r = await call(user, NFT, 'mint', { stage: 0, proof: null }, { deposit: cost });
  mustSucceed(`${user.split('.')[0]} mints #${expectId}`, r);
  const tok = await waitFor(`token ${expectId}`, () => view(NFT, 'nft_token', { token_id: String(expectId) }));
  check(`token #${expectId} is owned by the minter`, tok.owner_id === user);
  await sleep(3500);
  const treAfter = BigInt(await view(TRE, 'native_balance'));
  check(`treasury received exactly 50% of the price for #${expectId}`, treAfter - treBefore === PRICE / 2n, `+${fmt(treAfter - treBefore)} NEAR`);
  const st = await view(NFT, 'token_state', { token_id: String(expectId) });
  check(`escrow share for #${expectId} is the other 50%`, BigInt(st.share) === PRICE / 2n && st.credited === false);
}
const owners = { 1: alice, 2: alice, 3: alice, 4: bob, 5: bob, 6: bob, 7: carol, 8: carol };
for (let id = 1; id <= 8; id++) await mintAs(owners[id], id);

check('minted_total = 8 and live supply = 8', (await view(NFT, 'minted_total')) === '8' && (await view(NFT, 'live_supply')) === '8');
check('mint closed once sold out', (await view(NFT, 'mint_closed')) === true);
mustFail('a 9th mint is refused (sold out)', await call(alice, NFT, 'mint', { stage: 0, proof: null }, { deposit: cost }), 'Sold out');
const grp = (await view(NFT, 'settlement_status'))[0];
check('group escrow = 8 x 0.25 NEAR', BigInt(grp.total_share) === 8n * (PRICE / 2n) && grp.phase === 'Pending', fmt(grp.total_share));

const v1 = `v1.${NFT}`;
check('vault account exists', await exists(v1));
const keys = (await provider.query({ request_type: 'view_access_key_list', finality: 'final', account_id: v1 })).keys;
check('vault has NO access keys (keyless)', keys.length === 0);
const vi = await view(v1, 'vault_info');
check('vault is bound to its collection and treasury', vi.nft_contract === NFT && vi.treasury === TRE && vi.status === 'Active');
mustFail('nobody can call redeem on a vault directly', await call(alice, v1, 'redeem', { holder: alice }), 'Only the NFT contract');
mustFail('nobody can credit a vault directly', await call(alice, v1, 'credit_near', {}, { deposit: near(1) }), 'Only the NFT contract');

console.log('\n== C. vault deposits follow ownership; transfers move control');
mustSucceed('owner alice deposits 0.1 NEAR into vault #1', await call(alice, v1, 'deposit_near', {}, { deposit: near(0.1) }));
await sleep(3000);
let bal1 = (await view(v1, 'vault_info')).balances.find((b) => b[0] === 'near');
check('vault #1 recorded the deposit', bal1 && BigInt(bal1[1]) === near(0.1));
const bobBefore = await balance(bob);
await call(bob, v1, 'deposit_near', {}, { deposit: near(0.1) });
await sleep(5000);
const bobAfter = await balance(bob);
bal1 = (await view(v1, 'vault_info')).balances.find((b) => b[0] === 'near');
check('a non-owner deposit is refunded and not recorded', BigInt(bal1[1]) === near(0.1) && bobBefore - bobAfter < near(0.02), `net cost ${fmt(bobBefore - bobAfter)} NEAR (gas only)`);

mustFail('alice cannot burn a token she does not own', await call(alice, NFT, 'burn_and_redeem', { token_id: '4' }, { deposit: 1n }), 'Only the owner');
mustSucceed('alice transfers #3 to bob', await call(alice, NFT, 'nft_transfer', { receiver_id: bob, token_id: '3' }, { deposit: 1n }));
check('#3 now belongs to bob', (await view(NFT, 'nft_token', { token_id: '3' })).owner_id === bob);
const v3 = `v3.${NFT}`;
const aliceBefore = await balance(alice);
await call(alice, v3, 'deposit_near', {}, { deposit: near(0.1) });
await sleep(5000);
check('previous owner can no longer deposit into #3 (refunded)', (await view(v3, 'vault_info')).balances.length === 0 && aliceBefore - (await balance(alice)) < near(0.02));
mustSucceed('new owner bob deposits into #3', await call(bob, v3, 'deposit_near', {}, { deposit: near(0.1) }));

console.log('\n== D. secondary market: list, price rules, buy, fee + royalty split');
mustFail('nobody but the owner can list a token', await call(bob, NFT, 'nft_approve', { token_id: '7', account_id: MARKET, msg: JSON.stringify({ price: near(1).toString() }) }, { deposit: near(0.01) }));
mustSucceed('carol lists #7 at 1 NEAR', await call(carol, NFT, 'nft_approve', { token_id: '7', account_id: MARKET, msg: JSON.stringify({ price: near(1).toString() }) }, { deposit: near(0.01) }));
const listing = await waitFor('listing', () => view(MARKET, 'get_listing', { nft: NFT, token_id: '7' }));
check('listing is on-chain with seller, price and approval id', listing.seller === carol && BigInt(listing.price) === near(1), JSON.stringify(listing));
check('get_listings enumerates it', (await view(MARKET, 'get_listings', { nft: NFT, from_index: 0, limit: 10 })).length === 1);
mustFail('buy with the wrong price is refused', await call(bob, MARKET, 'buy', { nft: NFT, token_id: '7', approval_id: listing.approval_id }, { deposit: near(0.9) }), 'exactly the listed price');
mustFail('buy with a stale approval id is refused', await call(bob, MARKET, 'buy', { nft: NFT, token_id: '7', approval_id: listing.approval_id + 1 }, { deposit: near(1) }), 'Stale listing');
mustFail('seller cannot buy their own listing', await call(carol, MARKET, 'buy', { nft: NFT, token_id: '7', approval_id: listing.approval_id }, { deposit: near(1) }), 'your own listing');
const [treB, carolB, founderB] = [BigInt(await view(TRE, 'native_balance')), await balance(carol), await balance(F)];
mustSucceed('bob buys #7', await call(bob, MARKET, 'buy', { nft: NFT, token_id: '7', approval_id: listing.approval_id }, { deposit: near(1) }));
await waitFor('ownership change', async () => (await view(NFT, 'nft_token', { token_id: '7' })).owner_id === bob);
await sleep(4000);
check('NFT moved to the buyer', (await view(NFT, 'nft_token', { token_id: '7' })).owner_id === bob);
check('treasury got the 5% pool fee', BigInt(await view(TRE, 'native_balance')) - treB === near(0.05));
check('creator got the 5% royalty', (await balance(F)) - founderB === near(0.05));
check('seller got 90%', (await balance(carol)) - carolB === near(0.9));
check('listing is gone', (await view(MARKET, 'get_listing', { nft: NFT, token_id: '7' })) === null);
const stats = await view(MARKET, 'get_stats', { nft: NFT });
check('market stats count the sale and its volume', stats.sales === 1 && BigInt(stats.volume) === near(1));
const sale = (await view(MARKET, 'recent_sales', { nft: NFT, limit: 5 }))[0];
check('sale is recorded on-chain with the split', sale && sale.buyer === bob && sale.seller === carol && BigInt(sale.pool_fee) === near(0.05));
mustFail('a sold token cannot be bought again', await call(alice, MARKET, 'buy', { nft: NFT, token_id: '7', approval_id: listing.approval_id }, { deposit: near(1) }), 'Not listed');

mustSucceed('bob lists #3 at 2 NEAR', await call(bob, NFT, 'nft_approve', { token_id: '3', account_id: MARKET, msg: JSON.stringify({ price: near(2).toString() }) }, { deposit: near(0.01) }));
await waitFor('listing 3', () => view(MARKET, 'get_listing', { nft: NFT, token_id: '3' }));
mustFail('only the seller can reprice', await call(alice, MARKET, 'update_price', { nft: NFT, token_id: '3', price: near(1).toString() }), 'Only the seller');
mustSucceed('seller reprices to 2.5', await call(bob, MARKET, 'update_price', { nft: NFT, token_id: '3', price: near(2.5).toString() }));
mustFail('only the seller can cancel', await call(alice, MARKET, 'cancel', { nft: NFT, token_id: '3' }), 'Only the seller');
mustSucceed('seller cancels', await call(bob, MARKET, 'cancel', { nft: NFT, token_id: '3' }));
check('listing removed', (await view(MARKET, 'get_listing', { nft: NFT, token_id: '3' })) === null);

console.log('\n== E. governance: bounds are enforced; proposals open');
const bounds = await view(DAO, 'get_bounds');
check('DAO bounds are the configured demo floors (10 min / 10% / 50% / 1 min for spend)', bounds[0].min_period_ms === '600000' && bounds[0].min_quorum_bps === 1000);
const mk = (kind, purpose, ms = '600000', q = 1000, p = 5000, lock = '60000') => ({ kind, purpose, voting_period_ms: ms, quorum_bps: q, pass_bps: p, timelock_ms: lock });
mustFail('voting period below the floor is refused', await call(alice, NFT, 'propose', mk({ Spend: { recipient: carol, asset: 'near', amount: near(0.2).toString() } }, 'too short', '300000')), 'Voting period below');
mustFail('quorum below the floor is refused', await call(alice, NFT, 'propose', mk({ Spend: { recipient: carol, asset: 'near', amount: near(0.2).toString() } }, 'low quorum', '600000', 500)), 'Quorum below');
mustFail('timelock below the floor is refused', await call(alice, NFT, 'propose', mk({ Spend: { recipient: carol, asset: 'near', amount: near(0.2).toString() } }, 'no timelock', '600000', 1000, 5000, '0')), 'Timelock below');
mustFail('non-canonical asset ("NEAR") is refused', await call(alice, NFT, 'propose', mk({ Spend: { recipient: carol, asset: 'NEAR', amount: near(0.2).toString() } }, 'bad asset')), 'Asset must be');
mustFail('a Settle proposal needs a minimum output', await call(alice, NFT, 'propose', mk({ Settle: { group: 0, hops: [], min_out: '0' } }, 'no min', '600000')), 'minimum output');

const opened = {};
for (const [name, kind, purpose, bnd] of [
  ['spend', { Spend: { recipient: carol, asset: 'near', amount: near(0.2).toString() } }, 'Pay carol 0.2 NEAR for a design', mk(null, '', '600000')],
  ['settle', { Settle: { group: 0, hops: [], min_out: '1' } }, 'Settle the wNEAR group', mk(null, '', '600000')],
  ['distribute', { Distribute: { asset: 'near', amount: near(0.4).toString() } }, 'Distribute 0.4 NEAR to holders', mk(null, '', '600000')],
  ['text', 'Text', 'Signal: should we add a new art drop?', mk(null, '', '300000', 500, 5000, '0')],
]) {
  const r = await call(alice, NFT, 'propose', { kind, purpose, voting_period_ms: bnd.voting_period_ms, quorum_bps: bnd.quorum_bps, pass_bps: bnd.pass_bps, timelock_ms: bnd.timelock_ms });
  mustSucceed(`alice opens proposal: ${name}`, r);
  opened[name] = Number(await view(DAO, 'proposal_count'));
}
check('four proposals exist on this collection DAO', (await view(DAO, 'proposal_count')) === 4);
// A token that changes hands AFTER a proposal opened must not vote on it.
mustSucceed('bob sends #6 to alice after the proposals opened', await call(bob, NFT, 'nft_transfer', { receiver_id: alice, token_id: '6' }, { deposit: 1n }));
mustFail('the late transfer cannot vote (#6)', await call(alice, NFT, 'vote', { proposal_id: opened.spend, token_ids: ['6'], choice: 1 }), 'changed hands');
mustFail('a non-owner cannot vote with someone else\'s token', await call(alice, NFT, 'vote', { proposal_id: opened.spend, token_ids: ['4'], choice: 1 }), 'Not the owner');

// votes: spend (yes wins), settle (yes), distribute (yes), text (no wins)
const V = async (who, pid, ids, choice, label) => mustSucceed(label, await call(who, NFT, 'vote', { proposal_id: pid, token_ids: ids, choice }));
await V(alice, opened.spend, ['1', '2'], 1, 'alice votes YES on spend with #1,#2');
await V(bob, opened.spend, ['3', '4', '5', '7'], 1, 'bob votes YES on spend with #3,#4,#5,#7');
await V(carol, opened.spend, ['8'], 0, 'carol votes NO on spend with #8');
for (const pid of [opened.settle, opened.distribute]) {
  await V(alice, pid, ['1', '2'], 1, `alice YES on #${pid}`);
  await V(bob, pid, ['3', '4', '5', '7'], 1, `bob YES on #${pid}`);
  await V(carol, pid, ['8'], 1, `carol YES on #${pid}`);
}
await V(alice, opened.text, ['1', '2'], 0, 'alice NO on text');
await V(bob, opened.text, ['3', '4'], 0, 'bob NO on text');
const sp = await view(DAO, 'get_proposal', { proposal_id: opened.spend });
check('spend tally on-chain = yes 6, no 1', sp.yes === '6' && sp.no === '1', `${sp.yes}/${sp.no}/${sp.abstain}`);
mustFail('a token cannot vote twice', await call(alice, NFT, 'vote', { proposal_id: opened.spend, token_ids: ['1'], choice: 1 }), 'already voted');
check('has_voted reports it', (await view(DAO, 'has_voted', { proposal_id: opened.spend, token_id: '1' })) === true);
mustFail('execution before the vote ends is refused', await call(alice, DAO, 'execute', { proposal_id: opened.spend }), 'not passed');

const end = Number((await view(DAO, 'get_proposal', { proposal_id: opened.spend })).voting_end_ms);
console.log(`\nPhase 1 done. Spend/settle/distribute vote ends ${new Date(end).toISOString()}; run molten-2.mjs after ${new Date(end + 70000).toISOString()}`);
console.log('proposals:', JSON.stringify(opened));
const ok = summary();
process.exit(ok ? 0 : 1);
