// Real public mints on the relaunched collections: 12 of 20 per collection, minted by six test wallets
// exactly as any buyer would (stage price + storage, through `mint`). 8 per collection stay open.
// Then 3 of each collection go to the tester wallet and 2 per collection are listed on the market.
// Usage (from code/): node scripts/e2e/relaunch-mint.mjs [wallet]
import { account, view, call, check, mustSucceed, summary, balance, near, fmt, F, MARKET, sleep, TGAS } from './lib.mjs';

const WALLET = process.argv[2] || 'malekoala9992.testnet';
const NFTS = [`molten.${F}`, `tidewater.${F}`, `feather-protocol.${F}`];
const USERS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'].map((u) => `${u}.${F}`);
const PER_USER = 2;
const LIST_PRICE = near(1.5);

// --- top up each minter so it can pay for 6 mints (1.03 NEAR each) plus gas
const cost = BigInt((await view(NFTS[0], 'get_config')).stages[0].price_near) + BigInt((await view(NFTS[0], 'get_config')).mint_storage_cost);
const needEach = cost * BigInt(PER_USER * NFTS.length) + near(0.4);
for (const u of USERS) {
  const b = await balance(u);
  if (b < needEach) {
    const r = await account(F).transfer({ receiverId: u, amount: needEach - b });
    console.log(`topped up ${u} by ${fmt(needEach - b)} NEAR`, r?.transaction?.hash || '');
    await sleep(800);
  }
}

// --- mint, interleaving wallets so ownership is spread
for (const nft of NFTS) {
  const name = (await view(nft, 'nft_metadata')).name;
  console.log(`\n== ${name}`);
  const treBefore = await balance((await view(nft, 'get_config')).treasury);
  for (let round = 0; round < PER_USER; round++) {
    for (const u of USERS) {
      mustSucceed(`${u.split('.')[0]} mints a ${name}`, await call(u, nft, 'mint', { stage: 0, proof: null }, { deposit: cost, gas: 300n * TGAS }));
    }
  }
  await sleep(3000);
  const supply = Number(await view(nft, 'nft_total_supply'));
  check(`${name}: 12 minted, 8 still open`, supply === 12, `supply ${supply} / 20`);
  const tre = (await view(nft, 'get_config')).treasury;
  const gained = (await balance(tre)) - treBefore;
  check(`${name}: treasury received half of every mint`, gained >= near(5.99), `+${fmt(gained)} NEAR`);
  const vault = `v1.${nft}`;
  check(`${name}: vault #1 holds its half`, (await balance(vault)) >= near(0.5), `${vault} ${fmt(await balance(vault))} NEAR`);
}

// --- 3 of each collection to the tester wallet, 2 per collection listed for sale
for (const nft of NFTS) {
  const name = (await view(nft, 'nft_metadata')).name;
  const toks = (await view(nft, 'nft_tokens', { from_index: '0', limit: 100 })).sort((a, b) => Number(a.token_id) - Number(b.token_id));
  for (const owner of USERS.slice(0, 3)) {
    const t = toks.find((x) => x.owner_id === owner);
    mustSucceed(`${name} #${t.token_id}: ${owner.split('.')[0]} -> ${WALLET}`, await call(owner, nft, 'nft_transfer', { receiver_id: WALLET, token_id: t.token_id, memo: 'tester allocation' }, { deposit: 1n }));
  }
  for (const owner of USERS.slice(3, 5)) {
    const t = toks.find((x) => x.owner_id === owner);
    mustSucceed(`${name} #${t.token_id} listed by ${owner.split('.')[0]} at 1.5 NEAR`, await call(owner, nft, 'nft_approve', { token_id: t.token_id, account_id: MARKET, msg: JSON.stringify({ price: LIST_PRICE.toString() }) }, { deposit: near(0.01) }));
  }
  await sleep(3000);
  const mine = (await view(nft, 'nft_tokens_for_owner', { account_id: WALLET, from_index: '0', limit: 50 })).length;
  check(`${WALLET} holds 3 ${name}`, mine === 3, `${mine}`);
  const listed = (await view(MARKET, 'get_listings', { nft, from_index: 0, limit: 100 })).length;
  check(`${name}: 2 listings on the market`, listed === 2, `${listed}`);
}
console.log('\nfounder balance now', fmt(await balance(F)), 'NEAR');
process.exit(summary() ? 0 : 1);
