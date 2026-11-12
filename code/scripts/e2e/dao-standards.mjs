// Live checks for the DAO standards: list_proposals, voting-period cap, per-spend treasury cap.
import { call, check, mustFail, mustSucceed, summary, view, near, F, sleep, waitFor, balance, fmt } from './lib.mjs';
const NFT = `qrmx-tide.testnet`, DAO = `tide-dao.${F}`, TRE = `tide-tre.${F}`;
const bob = `bob.${F}`, carol = `carol.${F}`, alice = `alice.${F}`;

const list = await view(DAO, 'list_proposals', { from_id: 1, limit: 50 });
check('list_proposals returns the whole history in one call', list.length === Number(await view(DAO, 'proposal_count')) && list.length >= 2, `${list.length} proposals`);
const mk = (kind, purpose, ms, q = 1000, p = 5000, lock = '60000') => ({ kind, purpose, voting_period_ms: ms, quorum_bps: q, pass_bps: p, timelock_ms: lock });
const sp = (a) => ({ Spend: { recipient: carol, asset: 'near', amount: a.toString() } });
mustFail('a voting period over 30 days is refused', await call(bob, NFT, 'propose', mk(sp(near(0.1)), 'too long', String(31 * 86400000))), 'longer than 30 days');

// A spend bigger than 50% of the treasury's free funds can pass a vote but cannot execute.
const free = BigInt(await view(TRE, 'native_balance'));
const big = free * 3n / 4n;
console.log(`treasury free ${fmt(free)}; proposing a spend of ${fmt(big)} (75%)`);
const n0 = Number(await view(DAO, 'proposal_count'));
mustSucceed('bob proposes a 75% spend', await call(bob, NFT, 'propose', mk(sp(big), 'Oversized spend (should be capped)', '600000')));
await waitFor('proposal', async () => (await view(DAO, 'proposal_count')) === n0 + 1);
const id = n0 + 1;
mustSucceed('bob votes yes', await call(bob, NFT, 'vote', { proposal_id: id, token_ids: ['3', '4'], choice: 1 }));
mustSucceed('carol votes yes', await call(carol, NFT, 'vote', { proposal_id: id, token_ids: ['5'], choice: 1 }));
const p = await view(DAO, 'get_proposal', { proposal_id: id });
const unlock = Number(p.voting_end_ms) + 62000;
console.log(`waiting ${Math.ceil((unlock - Date.now()) / 1000)}s for the vote + timelock...`);
await sleep(Math.max(0, unlock - Date.now()));
check('the oversized spend PASSED the vote', (await view(DAO, 'status_of', { proposal_id: id })) === 'Passed');
const treB = BigInt(await view(TRE, 'native_balance'));
const r = await call(alice, DAO, 'execute', { proposal_id: id });
await sleep(6000);
check('executing it fails on the treasury spend cap (50%)', !r.ok && r.failures.join(' ').includes('50%'), r.failures[0]?.slice(0, 140));
check('treasury funds are untouched', BigInt(await view(TRE, 'native_balance')) === treB);
check('the proposal is retryable (not marked executed)', (await view(DAO, 'status_of', { proposal_id: id })) === 'Passed');
process.exit(summary() ? 0 : 1);
