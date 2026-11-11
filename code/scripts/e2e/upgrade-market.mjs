// Upgrades the live market in place: deploy the new code, then run its one-time migration.
import fs from 'node:fs';
import { account, call, view, check, mustSucceed, summary, MARKET, sleep } from './lib.mjs';
const before = { stats: await view(MARKET, 'get_stats', { nft: 'qrmx-molten.testnet' }), sales: (await view(MARKET, 'recent_sales', { nft: null, limit: 100 })).length, listed: (await view(MARKET, 'get_listings', { nft: 'qrmx-molten.testnet', from_index: 0, limit: 100 })).length };
console.log('before:', JSON.stringify(before));
await account(MARKET).deployContract(fs.readFileSync('res/quorum_market_opt.wasm'));
await sleep(2500);
mustSucceed('migrate keeps the existing state', await call(MARKET, MARKET, 'migrate', {}, { gas: 100n * 10n ** 12n }));
await sleep(3000);
const after = { stats: await view(MARKET, 'get_stats', { nft: 'qrmx-molten.testnet' }), sales: (await view(MARKET, 'recent_sales', { nft: null, limit: 100 })).length, listed: (await view(MARKET, 'get_listings', { nft: 'qrmx-molten.testnet', from_index: 0, limit: 100 })).length };
console.log('after: ', JSON.stringify(after));
check('stats, sale history and listings survived', JSON.stringify(before) === JSON.stringify(after));
check('offers view works', Array.isArray(await view(MARKET, 'offers_for_collection', { nft: 'qrmx-molten.testnet', from_index: 0, limit: 10 })));
check('collections stay registered', (await view(MARKET, 'is_collection', { nft: 'qrmx-tide.testnet' })) === true);
process.exit(summary() ? 0 : 1);
