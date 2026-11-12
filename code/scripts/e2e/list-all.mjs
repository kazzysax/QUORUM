// Lists every NFT held by the test wallets on the market, each wallet and each piece at a different price,
// so the market shows real pieces to buy and every collection has a floor price. Then places a few offers
// so the collections show a top offer. Usage (from code/): node scripts/e2e/list-all.mjs
import { account, call, check, mustSucceed, summary, view, balance, F, MARKET, near, fmt, sleep } from './lib.mjs';

const WALLETS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'].map((n) => `${n}.${F}`);
const NFTS = [`molten.${F}`, `tidewater.${F}`, `feather-protocol.${F}`];
const toks = async (nft) => (await view(nft, 'nft_tokens', { from_index: '0', limit: 100 })).sort((a, b) => Number(a.token_id) - Number(b.token_id));

// Each wallet has its own price level, each piece nudges it, each collection shifts it a little: 1.05 to ~5 NEAR.
const priceFor = (walletIdx, tokenId, colIdx) => {
  const p = 1.05 + walletIdx * 0.45 + ((Number(tokenId) * 37) % 11) * 0.13 + colIdx * 0.07;
  return Math.round(p * 20) / 20;
};

for (const u of WALLETS) {
  const b = await balance(u);
  if (b < near(1.2)) { await account(F).transfer({ receiverId: u, amount: near(1.5) - b }); await sleep(900); console.log(`topped up ${u.split('.')[0]}`); }
}

for (const [ci, nft] of NFTS.entries()) {
  const name = (await view(nft, 'nft_metadata')).name;
  console.log(`\n== ${name}`);
  let listed = 0;
  for (const t of await toks(nft)) {
    const wi = WALLETS.indexOf(t.owner_id);
    if (wi < 0) continue;                                   // only our own test wallets
    if (t.approved_account_ids?.[MARKET] !== undefined) continue; // already for sale
    const price = near(priceFor(wi, t.token_id, ci));
    mustSucceed(`${t.owner_id.split('.')[0]} lists ${name} #${t.token_id} at ${fmt(price)} NEAR`, await call(t.owner_id, nft, 'nft_approve', { token_id: t.token_id, account_id: MARKET, msg: JSON.stringify({ price: price.toString() }) }, { deposit: near(0.01) }));
    listed++;
    await sleep(500);
  }
  await sleep(3000);
  const ls = await view(MARKET, 'get_listings', { nft, from_index: 0, limit: 100 });
  const prices = ls.map(([, l]) => Number(BigInt(l.price) / 10n ** 20n) / 1e4).sort((a, b) => a - b);
  check(`${name}: ${ls.length} on the market, floor ${prices[0]} NEAR`, ls.length >= listed && prices.length > 0, `lowest ${prices[0]}, highest ${prices[prices.length - 1]}, ${new Set(prices).size} different prices`);
}

if (process.argv.includes('--no-offers')) process.exit(summary() ? 0 : 1); // a retry of failed listings only

console.log('\n== offers, so each collection shows a top offer');
const offerPlan = [
  [NFTS[1], 'carol', 1.2], [NFTS[1], 'dave', 0.9],
  [NFTS[2], 'erin', 1.4], [NFTS[2], 'frank', 1.0],
  [NFTS[0], 'bob', 1.1],
];
for (const [nft, who, amount] of offerPlan) {
  const me = `${who}.${F}`;
  const target = (await toks(nft)).find((t) => t.owner_id !== me && WALLETS.includes(t.owner_id));
  mustSucceed(`${who} offers ${amount} NEAR on #${target.token_id}`, await call(me, MARKET, 'make_offer', { nft, token_id: target.token_id, expires_in_ms: 7 * 86_400_000 }, { deposit: near(amount) }));
  await sleep(600);
}
await sleep(3000);
for (const nft of NFTS) {
  const o = await view(MARKET, 'offers_for_collection', { nft, from_index: 0, limit: 100 });
  check(`${(await view(nft, 'nft_metadata')).name}: has offers`, o.length > 0, `top ${fmt(o.map((x) => BigInt(x.amount)).sort((a, b) => (a < b ? 1 : -1))[0])} NEAR of ${o.length}`);
}
process.exit(summary() ? 0 : 1);
