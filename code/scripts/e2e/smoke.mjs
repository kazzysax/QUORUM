import { account, call, check, mustFail, summary, view, balance, F, MARKET, fmt } from './lib.mjs';

const alice = `alice.${F}`;
console.log('alice balance', fmt(await balance(alice)));
check('market is live and has no listings yet', Array.isArray(await view(MARKET, 'get_listings', { nft: 'qrmx-molten.testnet', from_index: 0, limit: 10 })));
mustFail('non-owner cannot register a collection', await call(alice, MARKET, 'register_collection', { nft: 'evil.testnet' }), 'Only the owner');
summary();
