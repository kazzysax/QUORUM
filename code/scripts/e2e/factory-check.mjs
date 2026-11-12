// Live test of the collection factory: a plain wallet launches a small collection with ONE call, and we verify
// that every piece exists, is keyless, is bound to its own DAO and treasury, is registered on the market,
// and that the collection really mints and lists. Usage (from code/): node scripts/e2e/factory-check.mjs
import { account, view, call, check, mustFail, mustSucceed, summary, balance, near, fmt, F, MARKET, sleep, TGAS, waitFor } from './lib.mjs';

const FACTORY = `launch.${F}`;
const CREATOR = `dave.${F}`;
const SLUG = 'launchcheck';
const SITE = 'https://quorumio.vercel.app';
const keys = async (id) => (await (await fetch('https://near-testnet.drpc.org', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_access_key_list', finality: 'final', account_id: id } }) })).json()).result?.keys?.length;
const args = (over = {}) => ({ name: 'Launch Check', symbol: 'LCHK', slug: SLUG, description: 'A small collection created by the factory to prove self-serve launches work.', supply: 3, price_near: near(0.1).toString(), royalty_bps: 500, mint_days: 7,
  metadata_base_url: `${SITE}/m/molten`, media_base_url: `${SITE}/media/molten`, cover_url: `${SITE}/images/banner-molten.jpg`, avatar_url: `${SITE}/images/molten-0.jpg`, quick_votes: true, ...over });

// the creator needs the launch deposit: pool the other test wallets into it
const need = BigInt(await view(FACTORY, 'required_deposit', { supply: 3 }));
console.log('launch deposit for 3 pieces:', fmt(need), 'NEAR');
for (const u of ['carol', 'erin', 'frank', 'alice', 'bob']) {
  const id = `${u}.${F}`, b = await balance(id);
  if (b > near(0.6)) { await account(id).transfer({ receiverId: CREATOR, amount: b - near(0.45) }); await sleep(700); }
}
console.log('creator balance', fmt(await balance(CREATOR)), 'NEAR');

console.log('\n== refusals cost nothing');
const b0 = await balance(CREATOR);
mustFail('a launch without the full deposit is refused', await call(CREATOR, FACTORY, 'create_collection', { args: args() }, { deposit: need - 1n }), 'full launch deposit');
mustFail('a bad address name is refused', await call(CREATOR, FACTORY, 'create_collection', { args: args({ slug: 'Bad Name' }) }, { deposit: need }), 'Address name');
mustFail('a non-https art link is refused', await call(CREATOR, FACTORY, 'create_collection', { args: args({ media_base_url: 'http://x.example' }) }, { deposit: need }), 'https://');
await sleep(2000);
check('the refused attempts only cost gas', b0 - (await balance(CREATOR)) < near(0.05), fmt(b0 - (await balance(CREATOR))));

console.log('\n== the launch: ONE call from an ordinary wallet');
const start = await balance(CREATOR);
const r = await call(CREATOR, FACTORY, 'create_collection', { args: args() }, { deposit: need + near(0.2), gas: 300n * TGAS });
mustSucceed('create_collection', r);
const nft = `${SLUG}.${FACTORY}`, dao = `${SLUG}-dao.${FACTORY}`, tre = `${SLUG}-tre.${FACTORY}`;
const rec = await waitFor('registry entry', async () => (await view(FACTORY, 'list_collections', { from_index: 0, limit: 50 })).find((c) => c.slug === SLUG), { tries: 25, every: 3000 });
check('the collection is in the factory registry', rec && rec.nft === nft && rec.dao === dao && rec.treasury === tre && rec.creator === CREATOR);
check('the excess deposit came back to the creator (paid ~ the required amount)', start - (await balance(CREATOR)) < need + near(0.1) && start - (await balance(CREATOR)) > need - near(0.1), `paid ${fmt(start - (await balance(CREATOR)))} NEAR`);
for (const [what, id] of [['NFT', nft], ['DAO', dao], ['treasury', tre]]) check(`${what} account ${id} has NO access keys`, (await keys(id)) === 0);
const cfg = await view(nft, 'get_config');
check('NFT bound to its own DAO and treasury, creator is the founder and fee recipient', cfg.dao === dao && cfg.treasury === tre && cfg.founder === CREATOR && cfg.royalty_recipient === CREATOR && cfg.max_supply === 3 && !cfg.paused);
check('the mint is open at 0.1 NEAR', BigInt(cfg.stages[0].price_near) === near(0.1) && (await view(nft, 'active_stage')) === 0);
const bounds = await view(dao, 'get_bounds');
check('the DAO has 10-minute demo votes and the 50% turnout floor', bounds.every((x) => x.min_quorum_bps >= 5000) && bounds[0].min_period_ms === '600000');
check('the address name is reserved (a second launch with it is refused)', (await view(FACTORY, 'slug_taken', { slug: SLUG })) === true);
mustFail('the DAO rejects calls from any other NFT contract', await call(CREATOR, dao, 'record_votes', { proposal_id: 1, voter: CREATOR, tokens: [], choice: 1 }), 'Only the NFT contract');

console.log('\n== the new collection really works: mint, list on the market');
const cost = BigInt(await view(nft, 'mint_cost', { stage: 0 }));
mustSucceed('creator mints piece 1', await call(CREATOR, nft, 'mint', { stage: 0, proof: null }, { deposit: cost, gas: 300n * TGAS }));
await sleep(4000);
check('minted: supply 1, owner is the creator', (await view(nft, 'nft_total_supply')) === '1' && (await view(nft, 'nft_token', { token_id: '1' })).owner_id === CREATOR);
check('half of the price reached the new treasury (on top of its 2.3 NEAR opening funds); the vault has no keys', BigInt(await view(tre, 'native_balance')) === near(2.3) + near(0.05) && (await keys(`v1.${nft}`)) === 0);
mustSucceed('creator lists it on the shared market (so it is registered there)', await call(CREATOR, nft, 'nft_approve', { token_id: '1', account_id: MARKET, msg: JSON.stringify({ price: near(0.3).toString() }) }, { deposit: near(0.01) }));
await sleep(3000);
check('the listing is on the market', (await view(MARKET, 'get_listings', { nft, from_index: 0, limit: 10 })).length === 1);
console.log('\ncreator balance', fmt(await balance(CREATOR)), 'NEAR; factory', fmt(await balance(FACTORY)), 'NEAR');
process.exit(summary() ? 0 : 1);
