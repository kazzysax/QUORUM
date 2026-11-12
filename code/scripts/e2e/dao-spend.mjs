// Pays out of each collection's treasury through its DAO, following the rules: a holder proposes a
// Spend, holders vote, the vote and timelock must pass, then anyone executes. One spend may not
// exceed 50% of the treasury's free funds.
// Usage: node scripts/e2e/dao-spend.mjs <recipient> [purpose]
import { call, check, mustSucceed, summary, view, balance, F, near, fmt, sleep, waitFor } from './lib.mjs';

const RECIPIENT = process.argv[2];
const PURPOSE = process.argv[3] || 'Return testnet funds to the project owner';
if (!RECIPIENT) throw new Error('recipient required');
const COLS = [
  { n: 'Molten Hours', nft: 'qrmx-molten.testnet', dao: 'qrmx-molten-dao.testnet', tre: 'qrmx-molten-tre.testnet' },
  { n: 'Tidewater', nft: 'qrmx-tide.testnet', dao: `tide-dao.${F}`, tre: `tide-tre.${F}` },
  { n: 'Feather Protocol', nft: `feather.${F}`, dao: `feather-dao.${F}`, tre: `feather-tre.${F}` },
];
const MINE = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'].map((u) => `${u}.${F}`);
const startBalance = await balance(RECIPIENT);
const plans = [];

for (const c of COLS) {
  const spendable = BigInt(await view(c.tre, 'native_balance'));
  const reserved = BigInt(await view(c.tre, 'reserved_for', { asset: 'near' }));
  const free = spendable > reserved ? spendable - reserved : 0n;
  const amount = (free * 49n / 100n / near(0.01)) * near(0.01);   // just under the 50% cap, in 0.01 steps
  if (amount < near(0.05)) { console.log(`${c.n}: only ${fmt(free)} NEAR free, skipping`); continue; }
  const tokens = await view(c.nft, 'nft_tokens', { from_index: '0', limit: 100 });
  const mineTokens = MINE.map((a) => [a, tokens.filter((t) => t.owner_id === a).map((t) => t.token_id)]).filter(([, ids]) => ids.length);
  if (!mineTokens.length) { console.log(`${c.n}: none of my accounts hold a token, skipping`); continue; }
  const proposer = mineTokens[0][0];
  const kind = { Spend: { recipient: RECIPIENT, asset: 'near', amount: amount.toString() } };
  const before = Number(await view(c.dao, 'proposal_count'));
  mustSucceed(`${c.n}: ${proposer.split('.')[0]} proposes paying ${fmt(amount)} NEAR to ${RECIPIENT}`, await call(proposer, c.nft, 'propose', { kind, purpose: PURPOSE, voting_period_ms: '600000', quorum_bps: 1000, pass_bps: 5000, timelock_ms: '60000' }));
  await waitFor('proposal', async () => (await view(c.dao, 'proposal_count')) === before + 1);
  const id = before + 1;
  for (const [acct, ids] of mineTokens) for (let i = 0; i < ids.length; i += 15) {
    mustSucceed(`${c.n}: ${acct.split('.')[0]} votes YES with ${ids.slice(i, i + 15).length} token(s)`, await call(acct, c.nft, 'vote', { proposal_id: id, token_ids: ids.slice(i, i + 15), choice: 1 }));
  }
  const p = await view(c.dao, 'get_proposal', { proposal_id: id });
  plans.push({ ...c, id, amount, unlock: Number(p.voting_end_ms) + 65000 });
}

const wait = Math.max(0, Math.max(...plans.map((p) => p.unlock)) - Date.now());
console.log(`\nvoting closes soon; waiting ${Math.ceil(wait / 1000)}s...`);
await sleep(wait);
for (const p of plans) {
  const treB = BigInt(await view(p.tre, 'native_balance'));
  check(`${p.n}: the proposal passed`, (await view(p.dao, 'status_of', { proposal_id: p.id })) === 'Passed');
  mustSucceed(`${p.n}: execute`, await call(F, p.dao, 'execute', { proposal_id: p.id }));
  await sleep(7000);
  check(`${p.n}: treasury paid exactly ${fmt(p.amount)} NEAR`, treB - BigInt(await view(p.tre, 'native_balance')) === p.amount);
}
const gained = (await balance(RECIPIENT)) - startBalance;
check(`${RECIPIENT} received the money`, gained === plans.reduce((s, p) => s + p.amount, 0n), `+${fmt(gained)} NEAR`);
process.exit(summary() ? 0 : 1);
