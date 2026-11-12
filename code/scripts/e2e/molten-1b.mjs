// Molten Hours, phase 1b: re-checks the rules whose messages were lost, proves the market payout
// split and multi-token voting after the joint-promise fixes, and opens a new round of proposals.
import { call, check, mustFail, mustSucceed, summary, view, balance, F, MARKET, near, fmt, sleep, waitFor } from './lib.mjs';

const NFT = 'qrmx-molten.testnet', DAO = 'qrmx-molten-dao.testnet', TRE = 'qrmx-molten-tre.testnet';
const alice = `alice.${F}`, bob = `bob.${F}`, carol = `carol.${F}`;
const owner = async (id) => (await view(NFT, 'nft_token', { token_id: String(id) }))?.owner_id;

console.log('== A. access control (with reasons)');
mustFail('non-NFT account cannot record a vote', await call(alice, DAO, 'record_votes', { proposal_id: 1, voter: alice, tokens: [{ token_id: '1', last_transfer_block: '1' }], choice: 1 }), 'Only the NFT contract');
mustFail('non-NFT account cannot create a proposal directly', await call(alice, DAO, 'create_proposal', { proposer: alice, kind: 'Text', purpose: 'x', voting_period_ms: '600000', quorum_bps: 1000, pass_bps: 5000, timelock_ms: '0', live_supply: '8' }), 'Only the NFT contract');
mustFail('non-DAO account cannot spend from the treasury', await call(alice, TRE, 'spend', { recipient: alice, asset: 'near', amount: '1', purpose: 'steal' }), 'Only the DAO');
mustFail('non-DAO account cannot distribute', await call(alice, TRE, 'distribute', { asset: 'near', amount: '1' }), 'Only the DAO');
mustFail('non-NFT account cannot register treasury tokens', await call(alice, TRE, 'register_token', { token_id: '1' }), 'Only the NFT contract');
mustFail('non-DAO account cannot change treasury params', await call(alice, TRE, 'set_param', { key: 'allow_dex', value: 'evil.testnet' }), 'Only the DAO');
mustFail('non-DAO account cannot change collection parameters', await call(alice, NFT, 'set_param', { key: 'paused', value: 'true' }), 'Only the DAO');
mustFail('non-DAO account cannot settle', await call(alice, NFT, 'settle_group', { group: 0, hops: [], min_out: '1' }), 'Only the DAO');
mustFail('non-DAO account cannot unwrap wNEAR held by the collection', await call(alice, NFT, 'unwrap_wnear', { amount: '1' }), 'Only the DAO');
mustFail('non-founder cannot pause', await call(alice, NFT, 'set_paused', { paused: true }), 'founder or the DAO');
mustFail('non-founder cannot swap the vault code', await call(alice, NFT, 'set_vault_code_hash', { hash: '11111111111111111111111111111112' }), 'Only the founder');
mustFail('non-owner cannot register a collection on the market', await call(alice, MARKET, 'register_collection', { nft: 'evil.testnet' }), 'Only the owner');
mustFail('an unregistered contract cannot list on the market', await call(alice, MARKET, 'nft_on_approve', { token_id: '1', owner_id: alice, approval_id: 1, msg: '{"price":"1"}' }), 'not registered');
mustFail('a non-holder cannot propose', await call('qrmx-tide.testnet', NFT, 'propose', { kind: 'Text', purpose: 'x', voting_period_ms: '600000', quorum_bps: 1000, pass_bps: 5000, timelock_ms: '0' }), 'Only holders or the founder');
mustFail('settle cannot be forced early by anyone: abort_swap needs a swap', await call(alice, NFT, 'abort_swap', { group: 0 }), 'No swap in progress');
mustFail('fallback is refused before the grace period', await call(alice, NFT, 'enable_fallback', { group: 0 }), 'grace period');

console.log('\n== B. mint closed, vaults locked down');
mustFail('a 9th mint is refused (sold out)', await call(alice, NFT, 'mint', { stage: 0, proof: null }, { deposit: near(0.53) }), 'Sold out');
mustFail('nobody can call redeem on a vault directly', await call(alice, `v1.${NFT}`, 'redeem', { holder: alice }));
mustFail('nobody can credit a vault directly', await call(alice, `v1.${NFT}`, 'credit_near', {}, { deposit: near(1) }));
mustFail('alice cannot burn a token she does not own', await call(alice, NFT, 'burn_and_redeem', { token_id: '4' }, { deposit: 1n }), 'Only the owner');
mustFail('credit needs a settled or fallback group', await call(alice, NFT, 'credit_batch', { group: 0, token_ids: ['1'] }), 'not ready for crediting');
check('#3 belongs to bob (earlier transfer)', (await owner(3)) === bob);

console.log('\n== D. a sale: NFT moves, payouts split 5% pool / 5% royalty / 90% seller');
const approve = (who, id, price) => call(who, NFT, 'nft_approve', { token_id: String(id), account_id: MARKET, msg: JSON.stringify({ price: price.toString() }) }, { deposit: near(0.01) });
mustFail('only the owner can list', await approve(alice, 7, near(1)));
mustSucceed('bob lists #7 at 1 NEAR', await approve(bob, 7, near(1)));
const listing = await waitFor('listing', () => view(MARKET, 'get_listing', { nft: NFT, token_id: '7' }));
mustFail('wrong price refused', await call(alice, MARKET, 'buy', { nft: NFT, token_id: '7', approval_id: listing.approval_id }, { deposit: near(0.9) }), 'exactly the listed price');
mustFail('stale approval refused', await call(alice, MARKET, 'buy', { nft: NFT, token_id: '7', approval_id: listing.approval_id + 1 }, { deposit: near(1) }), 'Stale listing');
mustFail('seller cannot buy own listing', await call(bob, MARKET, 'buy', { nft: NFT, token_id: '7', approval_id: listing.approval_id }, { deposit: near(1) }), 'your own listing');
const treB = BigInt(await view(TRE, 'native_balance')), bobB = await balance(bob), founderB = await balance(F);
const statsB = await view(MARKET, 'get_stats', { nft: NFT });
mustSucceed('alice buys #7', await call(alice, MARKET, 'buy', { nft: NFT, token_id: '7', approval_id: listing.approval_id }, { deposit: near(1) }));
await waitFor('ownership', async () => (await owner(7)) === alice);
await sleep(5000);
check('treasury received exactly the 5% pool fee', BigInt(await view(TRE, 'native_balance')) - treB === near(0.05), fmt(BigInt(await view(TRE, 'native_balance')) - treB));
check('creator received exactly the 5% royalty', (await balance(F)) - founderB === near(0.05));
check('seller received 90% (gas refunds from earlier calls may add a few thousandths)', (await balance(bob)) - bobB >= near(0.9) && (await balance(bob)) - bobB < near(0.91), fmt((await balance(bob)) - bobB));
const statsA = await view(MARKET, 'get_stats', { nft: NFT });
check('market stats updated on-chain', statsA.sales === statsB.sales + 1 && BigInt(statsA.volume) - BigInt(statsB.volume) === near(1));
const sale = (await view(MARKET, 'recent_sales', { nft: NFT, limit: 1 }))[0];
check('sale record holds buyer, seller and split', sale.buyer === alice && sale.seller === bob && BigInt(sale.pool_fee) === near(0.05) && BigInt(sale.seller_net) === near(0.9));
check('listing removed', (await view(MARKET, 'get_listing', { nft: NFT, token_id: '7' })) === null);
mustFail('a sold token cannot be bought again', await call(carol, MARKET, 'buy', { nft: NFT, token_id: '7', approval_id: listing.approval_id }, { deposit: near(1) }), 'Not listed');

console.log('\n== E. governance rules');
const sp = (a) => ({ Spend: { recipient: carol, asset: 'near', amount: a.toString() } });
const mk = (kind, purpose, ms = '600000', q = 1000, p = 5000, lock = '60000') => ({ kind, purpose, voting_period_ms: ms, quorum_bps: q, pass_bps: p, timelock_ms: lock });
mustFail('voting period below the floor', await call(alice, NFT, 'propose', mk(sp(near(0.2)), 'short', '300000')), 'Voting period below');
mustFail('quorum below the 50% floor', await call(alice, NFT, 'propose', mk(sp(near(0.2)), 'quorum', '600000', 4000)), 'Quorum below');
mustFail('timelock below the floor', await call(alice, NFT, 'propose', mk(sp(near(0.2)), 'lock', '600000', 1000, 5000, '0')), 'Timelock below');
mustFail('pass threshold below the floor', await call(alice, NFT, 'propose', mk(sp(near(0.2)), 'pass', '600000', 1000, 4000)), 'Pass threshold below');
mustFail('non-canonical asset refused', await call(alice, NFT, 'propose', mk({ Spend: { recipient: carol, asset: 'NEAR', amount: '1' } }, 'asset')), 'Asset must be');
mustFail('settle needs a minimum output', await call(alice, NFT, 'propose', mk({ Settle: { group: 0, hops: [], min_out: '0' } }, 'min')), 'minimum output');
mustFail('a purpose is required', await call(alice, NFT, 'propose', mk(sp(near(0.2)), '   ')), 'purpose is required');

const before = Number(await view(DAO, 'proposal_count'));
const ids = {};
let n = before;
for (const [name, kind, purpose, ms, q, p, lock] of [
  ['spend', sp(near(0.2)), 'Pay carol 0.2 NEAR for a design', '600000', 1000, 5000, '60000'],
  ['settle', { Settle: { group: 0, hops: [], min_out: '1' } }, 'Settle the wNEAR group', '600000', 1000, 5000, '60000'],
  ['distribute', { Distribute: { asset: 'near', amount: near(0.4).toString() } }, 'Distribute 0.4 NEAR to holders', '600000', 1000, 5000, '60000'],
  ['text', 'Text', 'Signal: add a new art drop?', '300000', 500, 5000, '0'],
]) {
  mustSucceed(`alice opens: ${name}`, await call(alice, NFT, 'propose', { kind, purpose, voting_period_ms: ms, quorum_bps: q, pass_bps: p, timelock_ms: lock }));
  n++; await waitFor(`proposal ${n}`, async () => (await view(DAO, 'proposal_count')) === n); ids[name] = n;
}
const first = await view(DAO, 'get_proposal', { proposal_id: ids.spend });
check('proposal stores proposer, supply snapshot and parameters', first.proposer === alice && first.supply === '8' && first.quorum_bps === 1000 && first.pass_bps === 5000);

mustSucceed('bob sends #5 to carol after the proposals opened', await call(bob, NFT, 'nft_transfer', { receiver_id: carol, token_id: '5' }, { deposit: 1n }));
await waitFor('transfer', async () => (await owner(5)) === carol);
mustFail('a token that changed hands after opening cannot vote (#5)', await call(carol, NFT, 'vote', { proposal_id: ids.spend, token_ids: ['5'], choice: 1 }), 'changed hands');
mustFail('a mixed batch with one ineligible token fails whole', await call(carol, NFT, 'vote', { proposal_id: ids.spend, token_ids: ['8', '5'], choice: 0 }), 'changed hands');
check('...and none of that batch was counted', (await view(DAO, 'has_voted', { proposal_id: ids.spend, token_id: '8' })) === false);
mustFail('voting with someone else\'s token is refused', await call(alice, NFT, 'vote', { proposal_id: ids.spend, token_ids: ['4'], choice: 1 }), 'Not the owner');
mustFail('an invalid choice is refused', await call(alice, NFT, 'vote', { proposal_id: ids.spend, token_ids: ['1'], choice: 7 }), 'Choice must be');

const vote = async (who, pid, tokens, choice, label) => mustSucceed(label, await call(who, NFT, 'vote', { proposal_id: pid, token_ids: tokens, choice }));
await vote(alice, ids.spend, ['1', '2', '6', '7'], 1, 'alice YES on spend with 4 tokens in ONE call');
await vote(bob, ids.spend, ['3', '4'], 1, 'bob YES on spend with 2 tokens');
await vote(carol, ids.spend, ['8'], 0, 'carol NO on spend');
for (const k of ['settle', 'distribute']) {
  await vote(alice, ids[k], ['1', '2', '6', '7'], 1, `alice YES on ${k}`);
  await vote(bob, ids[k], ['3', '4'], 1, `bob YES on ${k}`);
  await vote(carol, ids[k], ['8'], 1, `carol YES on ${k}`);
}
await vote(alice, ids.text, ['1', '2', '6', '7'], 0, 'alice NO on text');
await vote(bob, ids.text, ['3', '4'], 0, 'bob NO on text');
await vote(carol, ids.text, ['8'], 2, 'carol ABSTAINS on text');
await sleep(4000);
const t = await view(DAO, 'get_proposal', { proposal_id: ids.spend });
check('spend tally on-chain: yes 6, no 1', t.yes === '6' && t.no === '1', `${t.yes}/${t.no}/${t.abstain}`);
const tt = await view(DAO, 'get_proposal', { proposal_id: ids.text });
check('text tally on-chain: yes 0, no 6, abstain 1', tt.yes === '0' && tt.no === '6' && tt.abstain === '1');
mustFail('a token cannot vote twice', await call(alice, NFT, 'vote', { proposal_id: ids.spend, token_ids: ['1'], choice: 1 }), 'already voted');
mustFail('execution before the vote ends is refused', await call(alice, DAO, 'execute', { proposal_id: ids.spend }), 'has not passed');

const end = Number(t.voting_end_ms);
const unlock = end + 62000;
console.log(`\nPhase 1b done. ids=${JSON.stringify(ids)}  voting ends ${new Date(end).toISOString()}, executable after ${new Date(unlock).toISOString()}`);
import fs from 'node:fs';
fs.writeFileSync(new URL('./molten-ids.json', import.meta.url), JSON.stringify({ ids, unlock }));
process.exit(summary() ? 0 : 1);
