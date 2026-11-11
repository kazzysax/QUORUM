// Hands 3 NFTs of each collection to a tester wallet and lists the rest on the market for testers.
// Usage: node scripts/e2e/gift-and-list.mjs <wallet> [priceNear]
import { call, check, mustSucceed, summary, view, near, F, MARKET, sleep, waitFor } from './lib.mjs';

const WALLET = process.argv[2] || 'malekoala9992.testnet';
const PRICE = near(process.argv[3] || 1);
const COLLECTIONS = ['qrmx-molten.testnet', 'qrmx-tide.testnet', `feather.${F}`];

for (const nft of COLLECTIONS) {
  console.log(`\n== ${nft}`);
  const tokens = await view(nft, 'nft_tokens', { from_index: '0', limit: 100 });
  const sorted = tokens.sort((a, b) => Number(a.token_id) - Number(b.token_id));
  const gift = sorted.filter((t) => t.owner_id !== WALLET).slice(0, Math.max(0, 3 - sorted.filter((t) => t.owner_id === WALLET).length));
  for (const t of gift) {
    mustSucceed(`#${t.token_id}: ${t.owner_id} -> ${WALLET}`, await call(t.owner_id, nft, 'nft_transfer', { receiver_id: WALLET, token_id: t.token_id, memo: 'tester gift' }, { deposit: 1n }));
  }
  await sleep(4000);
  const now = await view(nft, 'nft_tokens', { from_index: '0', limit: 100 });
  check(`${WALLET} holds at least 3`, now.filter((t) => t.owner_id === WALLET).length >= 3, `${now.filter((t) => t.owner_id === WALLET).map((t) => '#' + t.token_id).join(', ')}`);
  for (const t of now.filter((x) => x.owner_id !== WALLET)) {
    if (t.approved_account_ids?.[MARKET] !== undefined) { console.log(`#${t.token_id} already listed`); continue; }
    mustSucceed(`#${t.token_id} listed by ${t.owner_id} at ${Number(PRICE / 10n ** 20n) / 1e4} NEAR`, await call(t.owner_id, nft, 'nft_approve', { token_id: t.token_id, account_id: MARKET, msg: JSON.stringify({ price: PRICE.toString() }) }, { deposit: near(0.01) }));
  }
  await sleep(4000);
  const listed = await view(MARKET, 'get_listings', { nft, from_index: 0, limit: 100 });
  console.log(`market now lists ${listed.length} token(s) of this collection`);
}
process.exit(summary() ? 0 : 1);
