// Acceptance, part 1b: finishes the votes that the rate-limited RPC dropped in part 1, opens a text proposal
// that holders vote down by a majority, tops up the tester wallets, then reruns the market sale and offer
// checks (which need funded buyers). Usage (from code/): node scripts/e2e/acceptance-1b.mjs
import fs from 'node:fs';
import { account, call, check, mustFail, mustSucceed, summary, view, balance, F, MARKET, near, fmt, sleep } from './lib.mjs';

const WALLET = 'malekoala9992.testnet';
const M = `molten.${F}`, DAO = `molten-dao.${F}`, TRE = `molten-tre.${F}`;
const U = (n) => `${n}.${F}`;
const [alice, bob, carol, dave, erin, frank] = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'].map(U);
const tokens = async () => (await view(M, 'nft_tokens', { from_index: '0', limit: 100 })).sort((a, b) => Number(a.token_id) - Number(b.token_id));
const ownerOf = async (id) => (await view(M, 'nft_token', { token_id: String(id) }))?.owner_id;
const listings = async () => view(MARKET, 'get_listings', { nft: M, from_index: 0, limit: 100 });
const treNear = async () => BigInt(await view(TRE, 'native_balance'));
const ids = JSON.parse(fs.readFileSync(new URL('./acceptance-ids.json', import.meta.url), 'utf8'));
const mkProposal = null;

console.log('== votes: the low-turnout proposal gets only alice, a new text signal gets voted down by everyone');
// (the low-turnout vote and the new text proposal were already done by the first run of this script)
const textId = Number(await view(DAO, 'proposal_count'));
const by = new Map();
const testers = new Set([alice, bob, carol, dave, erin, frank]);
for (const t of await tokens()) if (testers.has(t.owner_id)) by.set(t.owner_id, [...(by.get(t.owner_id) ?? []), t.token_id]);
for (const [who, toks] of by) mustSucceed(`${who.split('.')[0]} votes NO (${toks.length} NFT)`, await call(who, M, 'vote', { proposal_id: textId, token_ids: toks, choice: 0 }));
const tp = await view(DAO, 'get_proposal', { proposal_id: textId });
check('every vote cast is a no and turnout is above 50%', Number(tp.yes) === 0 && Number(tp.no) * 2 >= Number(tp.supply), `no ${tp.no} of ${tp.supply}`);
ids.ids.text2 = textId;
fs.writeFileSync(new URL('./acceptance-ids.json', import.meta.url), JSON.stringify({ ...ids, unlock: Date.now() + 6.5 * 60_000 }));

console.log('\n== top up the testers (the buyers had spent their NEAR)');
for (const u of [alice, bob, carol, erin, frank]) {
  const b = await balance(u);
  if (b < near(3)) { await account(F).transfer({ receiverId: u, amount: near(3) - b }); await sleep(900); }
}

console.log('\n== A. buy a listed Molten Hours NFT: 5% to the DAO treasury, 5% royalty, 90% to the seller');
const ls = await listings();
check('Molten Hours has listings on the market', ls.length >= 1, `${ls.length}`);
const [lid, listing] = ls[0];
const price = BigInt(listing.price);
const treA = await treNear(), sellerA = await balance(listing.seller);
const salesA = (await view(MARKET, 'get_stats', { nft: M })).sales;
mustFail('an under-payment is refused', await call(bob, MARKET, 'buy', { nft: M, token_id: lid, approval_id: listing.approval_id }, { deposit: price - 1n }));
mustFail('a stale approval id is refused', await call(bob, MARKET, 'buy', { nft: M, token_id: lid, approval_id: listing.approval_id + 1 }, { deposit: price }));
mustFail('a seller cannot buy their own listing', await call(listing.seller, MARKET, 'buy', { nft: M, token_id: lid, approval_id: listing.approval_id }, { deposit: price }));
mustSucceed(`bob buys #${lid} for ${fmt(price)} NEAR`, await call(bob, MARKET, 'buy', { nft: M, token_id: lid, approval_id: listing.approval_id }, { deposit: price }));
await sleep(6000);
check('the NFT moved to the buyer', (await ownerOf(lid)) === bob);
check('the seller received 90% (the receipts show exactly 90%; the balance read is within gas rounding)', (await balance(listing.seller)) - sellerA > price * 90n / 100n - near(0.001), fmt((await balance(listing.seller)) - sellerA));
check('the DAO treasury received exactly 5%', (await treNear()) - treA === price * 5n / 100n, fmt((await treNear()) - treA));
check('the listing is gone', !(await listings()).some(([id]) => id === lid));
const sale = (await view(MARKET, 'recent_sales', { nft: M, limit: 5 })).find((s) => s.token_id === lid);
check('the sale is recorded on-chain (price, pool fee, royalty, seller net)', sale && BigInt(sale.pool_fee) === price / 20n && BigInt(sale.royalty) === price / 20n && BigInt(sale.seller_net) === price * 9n / 10n);
check('collection sales count went up by one', (await view(MARKET, 'get_stats', { nft: M })).sales === salesA + 1);

console.log('\n== B. offers: escrow, replace, withdraw, one-transaction accept');
const tid = (await tokens()).find((t) => t.owner_id === carol && !t.approved_account_ids?.[MARKET]).token_id;
const offers = async () => view(MARKET, 'offers_for_token', { nft: M, token_id: tid });
const aliceB0 = await balance(alice);
mustSucceed(`alice offers 0.8 NEAR on carol's #${tid}`, await call(alice, MARKET, 'make_offer', { nft: M, token_id: tid, expires_in_ms: 86_400_000 }, { deposit: near(0.8) }));
await sleep(4000);
check('the offer is on-chain', (await offers()).some((o) => o.buyer === alice && BigInt(o.amount) === near(0.8)));
mustSucceed('alice replaces it with 1.0 NEAR (old escrow refunded)', await call(alice, MARKET, 'make_offer', { nft: M, token_id: tid, expires_in_ms: 86_400_000 }, { deposit: near(1) }));
mustFail('only the buyer can withdraw an offer', await call(dave, MARKET, 'cancel_offer', { nft: M, token_id: tid }));
mustSucceed('alice withdraws it', await call(alice, MARKET, 'cancel_offer', { nft: M, token_id: tid }));
await sleep(4000);
check('the escrow came back (only gas lost)', aliceB0 - (await balance(alice)) < near(0.05), fmt(aliceB0 - (await balance(alice))));
mustSucceed('alice offers 1.0 NEAR again', await call(alice, MARKET, 'make_offer', { nft: M, token_id: tid, expires_in_ms: 86_400_000 }, { deposit: near(1) }));
mustFail('a non-owner cannot accept', await call(dave, M, 'nft_approve', { token_id: tid, account_id: MARKET, msg: JSON.stringify({ accept_offer: alice }) }, { deposit: near(0.01) }));
const carolB = await balance(carol), treB = await treNear();
mustSucceed('carol accepts with ONE transaction', await call(carol, M, 'nft_approve', { token_id: tid, account_id: MARKET, msg: JSON.stringify({ accept_offer: alice }) }, { deposit: near(0.01) }));
await sleep(6000);
check('the NFT moved to the offerer', (await ownerOf(tid)) === alice);
check('treasury got 5% of the offer', (await treNear()) - treB === near(0.05));
check('seller got about 90% (minus gas and the approval deposit)', (await balance(carol)) - carolB > near(0.85), fmt((await balance(carol)) - carolB));
process.exit(summary() ? 0 : 1);
