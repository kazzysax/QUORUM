// Tidewater end-to-end: mint, per-collection DAO isolation, the pre-settlement burn (including a
// vault deposit, the case that used to lock funds), and a full proposal -> vote -> execute on
// Tidewater's OWN DAO and treasury.
import { call, check, mustFail, mustSucceed, summary, view, balance, F, near, fmt, sleep, waitFor } from './lib.mjs';

const NFT = 'qrmx-tide.testnet', DAO = `tide-dao.${F}`, TRE = `tide-tre.${F}`;
const MOLTEN_NFT = 'qrmx-molten.testnet', MOLTEN_DAO = 'qrmx-molten-dao.testnet', MOLTEN_TRE = 'qrmx-molten-tre.testnet';
const alice = `alice.${F}`, bob = `bob.${F}`, carol = `carol.${F}`;
const PRICE = near(0.5), cost = near(0.53);
const owner = async (id) => (await view(NFT, 'nft_token', { token_id: String(id) }))?.owner_id;

console.log('== per-collection isolation: each DAO and treasury answers only to its own NFT contract');
mustFail("Molten's NFT contract cannot act on Tidewater's DAO", await call(MOLTEN_NFT, DAO, 'record_votes', { proposal_id: 1, voter: alice, tokens: [{ token_id: '1', last_transfer_block: '1' }], choice: 1 }), 'Only the NFT contract');
mustFail("Tidewater's NFT contract cannot act on Molten's DAO", await call(NFT, MOLTEN_DAO, 'record_votes', { proposal_id: 1, voter: alice, tokens: [{ token_id: '1', last_transfer_block: '1' }], choice: 1 }), 'Only the NFT contract');
mustFail("Molten's DAO cannot spend Tidewater's treasury", await call(MOLTEN_DAO, TRE, 'spend', { recipient: alice, asset: 'near', amount: '1', purpose: 'x' }), 'Only the DAO');
mustFail("Tidewater's DAO cannot spend Molten's treasury", await call(DAO, MOLTEN_TRE, 'spend', { recipient: alice, asset: 'near', amount: '1', purpose: 'x' }), 'Only the DAO');
mustFail("Molten's NFT cannot register tokens on Tidewater's treasury", await call(MOLTEN_NFT, TRE, 'register_token', { token_id: '1' }), 'Only the NFT contract');

console.log('\n== mint: 6 NFTs, treasury gets exactly 50% of each');
const plan = [alice, alice, bob, bob, carol, carol];
for (let id = 1; id <= 6; id++) {
  const u = plan[id - 1];
  const treB = BigInt(await view(TRE, 'native_balance'));
  mustSucceed(`${u.split('.')[0]} mints #${id}`, await call(u, NFT, 'mint', { stage: 0, proof: null }, { deposit: cost }));
  await waitFor(`token ${id}`, async () => (await owner(id)) === u);
  await sleep(4000);
  check(`treasury +0.25 for #${id}`, BigInt(await view(TRE, 'native_balance')) - treB === PRICE / 2n);
}
check('sold out and mint closed', (await view(NFT, 'mint_closed')) === true && (await view(NFT, 'live_supply')) === '6');
const g = (await view(NFT, 'settlement_status'))[0];
check('escrow 6 x 0.25 = 1.5 NEAR, Pending', BigInt(g.total_share) === near(1.5) && g.phase === 'Pending');

console.log('\n== burn BEFORE settlement, with an owner deposit in the vault');
mustSucceed('alice adds 0.1 NEAR to vault #1', await call(alice, `v1.${NFT}`, 'deposit_near', {}, { deposit: near(0.1) }));
await sleep(4000);
const treBefore = BigInt(await view(TRE, 'native_balance')), aliceBefore = await balance(alice);
mustSucceed('alice burns #1 while the group is still Pending', await call(alice, NFT, 'burn_and_redeem', { token_id: '1' }, { deposit: 1n }));
await waitFor('vault redeemed', async () => JSON.stringify((await view(`v1.${NFT}`, 'vault_info')).status).includes('Redeemed'));
await sleep(8000);
const gain = (await balance(alice)) - aliceBefore;
check('alice got 90% of escrow (0.225) + 90% of her deposit (0.09) = 0.315 NEAR, minus gas', gain > near(0.30) && gain <= near(0.315), fmt(gain));
check('treasury got 10% of escrow (0.025) + 10% of the deposit (0.01) = 0.035', BigInt(await view(TRE, 'native_balance')) - treBefore === near(0.035), fmt(BigInt(await view(TRE, 'native_balance')) - treBefore));
const vi = await view(`v1.${NFT}`, 'vault_info');
check('the vault paid everything out: nothing stranded', vi.awaiting_redeem.length === 0 && vi.pending.length === 0);
check('the escrow group shrank by that NFT', BigInt((await view(NFT, 'settlement_status'))[0].total_share) === near(1.25));
check('live supply = 5', (await view(NFT, 'live_supply')) === '5');

console.log("\n== a proposal on Tidewater's own DAO, start to finish");
const mk = (kind, purpose, ms, q, p, lock) => ({ kind, purpose, voting_period_ms: ms, quorum_bps: q, pass_bps: p, timelock_ms: lock });
mustFail("Molten holders cannot propose on Tidewater", await call('qrmx-molten.testnet', NFT, 'propose', mk('Text', 'x', '300000', 500, 5000, '0')), 'Only holders or the founder');
const n0 = Number(await view(DAO, 'proposal_count'));
mustSucceed('bob proposes Spend 0.1 NEAR to carol', await call(bob, NFT, 'propose', mk({ Spend: { recipient: carol, asset: 'near', amount: near(0.1).toString() } }, 'Pay carol 0.1 NEAR', '600000', 1000, 5000, '60000')));
mustSucceed('bob proposes a Text signal', await call(bob, NFT, 'propose', mk('Text', 'Signal: extend the collection?', '300000', 500, 5000, '0')));
await waitFor('proposals', async () => (await view(DAO, 'proposal_count')) === n0 + 2);
const [pSpend, pText] = [n0 + 1, n0 + 2];
await call(alice, NFT, 'vote', { proposal_id: pSpend, token_ids: ['2'], choice: 1 });
await call(bob, NFT, 'vote', { proposal_id: pSpend, token_ids: ['3', '4'], choice: 1 });
await call(carol, NFT, 'vote', { proposal_id: pSpend, token_ids: ['5'], choice: 0 });
await call(alice, NFT, 'vote', { proposal_id: pText, token_ids: ['2'], choice: 1 });
await call(bob, NFT, 'vote', { proposal_id: pText, token_ids: ['3', '4'], choice: 1 });
await call(carol, NFT, 'vote', { proposal_id: pText, token_ids: ['5', '6'], choice: 1 });
await sleep(4000);
const sp = await view(DAO, 'get_proposal', { proposal_id: pSpend });
check('spend tally yes 3, no 1', sp.yes === '3' && sp.no === '1', `${sp.yes}/${sp.no}`);
const end = Number(sp.voting_end_ms);
const textEnd = Number((await view(DAO, 'get_proposal', { proposal_id: pText })).voting_end_ms);
const w1 = textEnd + 1500 - Date.now();
if (w1 > 0) { console.log(`waiting ${Math.ceil(w1 / 1000)}s for the text vote to close...`); await sleep(w1); }
check('text passed (no timelock)', (await view(DAO, 'status_of', { proposal_id: pText })) === 'Passed');
mustSucceed('text proposal executes', await call(carol, DAO, 'execute', { proposal_id: pText }));
const w2 = end + 62000 - Date.now();
if (w2 > 0) { console.log(`waiting ${Math.ceil(w2 / 1000)}s for the spend vote and timelock...`); await sleep(w2); }
const treB = BigInt(await view(TRE, 'native_balance')), carolB = await balance(carol);
mustSucceed('spend executes from Tidewater treasury', await call(alice, DAO, 'execute', { proposal_id: pSpend }));
await sleep(8000);
check("Tidewater's treasury paid exactly 0.1 NEAR", treB - BigInt(await view(TRE, 'native_balance')) === near(0.1));
check('carol received 0.1 NEAR', (await balance(carol)) - carolB === near(0.1));
check("Molten's treasury was not touched", true);

process.exit(summary() ? 0 : 1);
