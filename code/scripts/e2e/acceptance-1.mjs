// Acceptance test of the relaunched collections, part 1 (runs now): market sales, offers, listings,
// vault deposits, burn before settlement, then it opens DAO proposals and votes.
// Part 2 (acceptance-2.mjs) runs after the voting window. Usage (from code/): node scripts/e2e/acceptance-1.mjs
import fs from 'node:fs';
import { call, check, mustFail, mustSucceed, summary, view, balance, F, MARKET, near, fmt, sleep } from './lib.mjs';

const WALLET = 'malekoala9992.testnet'; // the user's wallet: never touched by this test
const M = `molten.${F}`, DAO = `molten-dao.${F}`, TRE = `molten-tre.${F}`;
const T = `tidewater.${F}`, TTRE = `tidewater-tre.${F}`;
const U = (n) => `${n}.${F}`;
const [alice, bob, carol, dave, erin, frank] = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'].map(U);
const tokens = async (nft) => (await view(nft, 'nft_tokens', { from_index: '0', limit: 100 })).sort((a, b) => Number(a.token_id) - Number(b.token_id));
const ownerOf = async (nft, id) => (await view(nft, 'nft_token', { token_id: String(id) }))?.owner_id;
const listings = async (nft) => view(MARKET, 'get_listings', { nft, from_index: 0, limit: 100 });
const treNear = async (tre) => BigInt(await view(tre, 'native_balance'));

console.log('== A. buy a listed Molten Hours NFT: 5% to the DAO treasury, 5% royalty, 90% to the seller');
const ls = await listings(M);
check('Molten Hours has listings on the market', ls.length >= 1, `${ls.length}`);
const [lid, listing] = ls[0];
const price = BigInt(listing.price);
const treA = await treNear(TRE), sellerA = await balance(listing.seller);
const salesA = (await view(MARKET, 'get_stats', { nft: M })).sales;
mustFail('a seller cannot buy their own listing', await call(listing.seller, MARKET, 'buy', { nft: M, token_id: lid, approval_id: listing.approval_id }, { deposit: price }));
mustFail('an under-payment is refused', await call(bob, MARKET, 'buy', { nft: M, token_id: lid, approval_id: listing.approval_id }, { deposit: price - 1n }));
mustFail('a stale approval id is refused', await call(bob, MARKET, 'buy', { nft: M, token_id: lid, approval_id: listing.approval_id + 1 }, { deposit: price }));
mustSucceed(`bob buys #${lid} for ${fmt(price)} NEAR`, await call(bob, MARKET, 'buy', { nft: M, token_id: lid, approval_id: listing.approval_id }, { deposit: price }));
await sleep(6000);
check('the NFT moved to the buyer', (await ownerOf(M, lid)) === bob);
check('the seller received exactly 90%', (await balance(listing.seller)) - sellerA === price * 90n / 100n, fmt((await balance(listing.seller)) - sellerA));
check('the DAO treasury received exactly 5%', (await treNear(TRE)) - treA === price * 5n / 100n, fmt((await treNear(TRE)) - treA));
check('the listing is gone', !(await listings(M)).some(([id]) => id === lid));
const sale = (await view(MARKET, 'recent_sales', { nft: M, limit: 5 })).find((s) => s.token_id === lid);
check('the sale is recorded on-chain (price, pool fee, royalty, seller net)', sale && BigInt(sale.pool_fee) === price / 20n && BigInt(sale.royalty) === price / 20n && BigInt(sale.seller_net) === price * 9n / 10n);
check('collection sales count went up by one', (await view(MARKET, 'get_stats', { nft: M })).sales === salesA + 1);

console.log('\n== B. offers: escrow, replace, withdraw, one-transaction accept');
const aliceTok = (await tokens(M)).find((t) => t.owner_id === carol && !t.approved_account_ids?.[MARKET]);
const tid = aliceTok.token_id;
const offers = async () => view(MARKET, 'offers_for_token', { nft: M, token_id: tid });
const aliceB0 = await balance(alice);
mustSucceed(`alice offers 0.8 NEAR on carol's #${tid}`, await call(alice, MARKET, 'make_offer', { nft: M, token_id: tid, expires_in_ms: 86_400_000 }, { deposit: near(0.8) }));
check('the offer is on-chain', (await offers()).some((o) => o.buyer === alice && BigInt(o.amount) === near(0.8)));
mustSucceed('alice replaces it with 1.0 NEAR (old escrow refunded)', await call(alice, MARKET, 'make_offer', { nft: M, token_id: tid, expires_in_ms: 86_400_000 }, { deposit: near(1) }));
mustFail('only the buyer can withdraw an offer', await call(dave, MARKET, 'cancel_offer', { nft: M, token_id: tid }));
mustSucceed('alice withdraws it', await call(alice, MARKET, 'cancel_offer', { nft: M, token_id: tid }));
await sleep(4000);
check('the escrow came back (only gas lost)', aliceB0 - (await balance(alice)) < near(0.05), fmt(aliceB0 - (await balance(alice))));
mustSucceed('alice offers 1.0 NEAR again', await call(alice, MARKET, 'make_offer', { nft: M, token_id: tid, expires_in_ms: 86_400_000 }, { deposit: near(1) }));
mustFail('a non-owner cannot accept', await call(dave, M, 'nft_approve', { token_id: tid, account_id: MARKET, msg: JSON.stringify({ accept_offer: alice }) }, { deposit: near(0.01) }));
const carolB = await balance(carol), treB = await treNear(TRE);
mustSucceed('carol accepts with ONE transaction', await call(carol, M, 'nft_approve', { token_id: tid, account_id: MARKET, msg: JSON.stringify({ accept_offer: alice }) }, { deposit: near(0.01) }));
await sleep(6000);
check('the NFT moved to the offerer', (await ownerOf(M, tid)) === alice);
check('treasury got 5% of the offer', (await treNear(TRE)) - treB === near(0.05));
check('seller got 90% (minus gas and the approval deposit)', (await balance(carol)) - carolB > near(0.85), fmt((await balance(carol)) - carolB));

console.log('\n== C. list and cancel');
const eTok = (await tokens(M)).find((t) => t.owner_id === erin && !t.approved_account_ids?.[MARKET]);
mustSucceed(`erin lists #${eTok.token_id} at 2 NEAR`, await call(erin, M, 'nft_approve', { token_id: eTok.token_id, account_id: MARKET, msg: JSON.stringify({ price: near(2).toString() }) }, { deposit: near(0.01) }));
await sleep(3000);
check('it shows in the market listings', (await listings(M)).some(([id]) => id === eTok.token_id));
mustFail('only the seller can cancel', await call(dave, MARKET, 'cancel', { nft: M, token_id: eTok.token_id }));
mustSucceed('erin cancels', await call(erin, MARKET, 'cancel', { nft: M, token_id: eTok.token_id }));
await sleep(3000);
check('it is gone from the listings', !(await listings(M)).some(([id]) => id === eTok.token_id));

console.log('\n== D. vault deposits: only the owner can add to their NFT\'s vault');
const depTok = (await tokens(M)).find((t) => t.owner_id === frank);
const vault = `v${depTok.token_id}.${M}`;
const nearIn = async (v) => BigInt((await view(v, 'vault_info')).balances.find((b) => b[0] === 'near')?.[1] ?? '0');
const v0 = await nearIn(vault);
mustSucceed('the owner adds 0.1 NEAR to the vault', await call(frank, vault, 'deposit_near', {}, { deposit: near(0.1) }));
await sleep(3000);
check('the vault holds 0.1 NEAR more', (await nearIn(vault)) - v0 === near(0.1));
const dB = await balance(dave);
await call(dave, vault, 'deposit_near', {}, { deposit: near(0.1) });
await sleep(4000);
check('a stranger\'s deposit is refunded and not counted', (await nearIn(vault)) - v0 === near(0.1) && dB - (await balance(dave)) < near(0.05));

console.log('\n== E. burn BEFORE settlement (Tidewater #13, mint still open): 90% of the escrow in NEAR, 10% to the treasury');
const burnTok = '13';
const bOwner = await ownerOf(T, burnTok);
const share = BigInt((await view(T, 'token_state', { token_id: burnTok })).share);
const [bA, tA] = [await balance(bOwner), await treNear(TTRE)];
mustSucceed(`${bOwner.split('.')[0]} burns Tidewater #${burnTok}`, await call(bOwner, T, 'burn_and_redeem', { token_id: burnTok }, { deposit: 1n }));
await sleep(9000);
check('the holder received 90% of the escrow', (await balance(bOwner)) - bA > share * 9n / 10n - near(0.02), fmt((await balance(bOwner)) - bA));
check('the treasury received 10%', (await treNear(TTRE)) - tA === share / 10n, fmt((await treNear(TTRE)) - tA));
check('the NFT is gone, live supply is 12, minted_total still 13', (await ownerOf(T, burnTok)) == null && (await view(T, 'live_supply')) === '12' && (await view(T, 'minted_total')) === '13');
mustFail('a burned token cannot be burned again', await call(bOwner, T, 'burn_and_redeem', { token_id: burnTok }, { deposit: 1n }));

console.log('\n== F. DAO rules refuse bad proposals');
const sp = (amt, to = carol) => ({ Spend: { recipient: to, asset: 'near', amount: amt.toString() } });
const mk = (kind, purpose, ms = '600000', q = 5000, p = 5000, lock = '60000') => ({ kind, purpose, voting_period_ms: ms, quorum_bps: q, pass_bps: p, timelock_ms: lock });
mustFail('a non-holder cannot propose', await call(T, M, 'propose', mk('Text', 'x')), 'Only holders or the founder');
mustFail('quorum below 50% is refused', await call(alice, M, 'propose', mk(sp(near(1)), 'low quorum', '600000', 4000)), 'Quorum below');
mustFail('a voting period below the floor is refused', await call(alice, M, 'propose', mk(sp(near(1)), 'short', '300000')), 'Voting period below');
mustFail('a non-canonical asset is refused', await call(alice, M, 'propose', mk({ Spend: { recipient: carol, asset: 'NEAR', amount: '1' } }, 'asset')), 'Asset must be');

console.log('\n== G. open five proposals, then vote');
const open = async (name, kind, purpose, ms, q, p, lock) => {
  const before = Number(await view(DAO, 'proposal_count'));
  mustSucceed(`alice opens: ${name}`, await call(alice, M, 'propose', mk(kind, purpose, ms, q, p, lock)));
  await sleep(3500);
  return before + 1;
};
const ids = {};
ids.spend = await open('pay carol 1 NEAR', sp(near(1)), 'Acceptance: pay carol 1 NEAR');
ids.distribute = await open('distribute 1 NEAR to holders', { Distribute: { asset: 'near', amount: near(1).toString() } }, 'Acceptance: distribute 1 NEAR');
ids.overcap = await open('spend 8 NEAR (over the 50% cap)', sp(near(8)), 'Acceptance: over the 50% cap');
ids.text = await open('text signal (will be voted down)', 'Text', 'Acceptance: signal that gets voted down', '300000', 5000, 5000, '0');
ids.lowturn = await open('spend 0.1 NEAR (too few will vote)', sp(near(0.1)), 'Acceptance: low turnout');
const supply = Number((await view(DAO, 'get_proposal', { proposal_id: ids.spend })).supply);
check('the proposal snapshots the live supply (20)', supply === 20, `${supply}`);

const all = await tokens(M);
const by = new Map();
for (const t of all) if (t.owner_id !== WALLET) by.set(t.owner_id, [...(by.get(t.owner_id) ?? []), t.token_id]);
const vote = async (pid, who, toks, choice, label) => {
  for (let i = 0; i < toks.length; i += 15) mustSucceed(`${label} (${who.split('.')[0]}, ${toks.slice(i, i + 15).length} NFT)`, await call(who, M, 'vote', { proposal_id: pid, token_ids: toks.slice(i, i + 15), choice }));
};
const voters = [...by.entries()];
const power = voters.reduce((s, [, t]) => s + t.length, 0);
check('the test wallets hold at least 50% of all NFTs', power * 2 >= supply, `${power} of ${supply}`);
mustFail('someone else\'s NFT cannot vote', await call(alice, M, 'vote', { proposal_id: ids.spend, token_ids: [by.get(bob)[0]], choice: 1 }), 'Not the owner');
for (const [who, toks] of voters) await vote(ids.spend, who, toks, 1, 'yes on pay carol');
for (const [who, toks] of voters) await vote(ids.distribute, who, toks, 1, 'yes on distribute');
for (const [who, toks] of voters) await vote(ids.overcap, who, toks, 1, 'yes on the 8 NEAR spend');
for (const [who, toks] of voters) await vote(ids.text, who, toks, 0, 'no on the text signal');
await vote(ids.lowturn, alice, by.get(alice), 1, 'yes on low turnout (only alice)');
mustFail('a token cannot vote twice', await call(alice, M, 'vote', { proposal_id: ids.spend, token_ids: [by.get(alice)[0]], choice: 1 }), 'already voted');
const p1 = await view(DAO, 'get_proposal', { proposal_id: ids.spend });
check('the tally on-chain matches the votes cast', Number(p1.yes) === power && Number(p1.no) === 0, `yes ${p1.yes} of ${supply}`);

fs.writeFileSync(new URL('./acceptance-ids.json', import.meta.url), JSON.stringify({ ids, depTok: depTok.token_id, depOwner: frank, unlock: Date.now() + 11.5 * 60_000 }));
console.log('\nproposals', ids, '\nrun acceptance-2.mjs after the voting window (about 12 minutes)');
process.exit(summary() ? 0 : 1);
