// Deploys the collection factory on testnet and lets it register collections on the shared market.
//   1. upgrades the market code in place (state kept) so it knows "registrars"
//   2. creates launch.<founder> with the factory code and runs its constructor in ONE transaction
//   3. makes the factory a registrar on the market
// Usage (from code/): node scripts/e2e/deploy-factory.mjs
import fs from 'node:fs';
import { KeyPair, actions } from 'near-api-js';
import { account, view, call, check, mustSucceed, summary, balance, near, fmt, F, MARKET, KEY_DIR, sleep, TGAS } from './lib.mjs';

const FACTORY = `launch.${F}`;
const VAULT_HASH = 'DQALgt8fazwvRPFKdz2j5Eek9kacchwFm2vCucLDPCn8';
const rpcAccount = async (id) => { const r = await (await fetch('https://near-testnet.drpc.org', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: id } }) })).json(); return r.result; };

console.log('== 1. market: upgrade in place, keep every listing and sale');
const before = { listings: 0, sales: 0 };
for (const n of ['molten', 'tidewater', 'feather-protocol']) {
  before.listings += (await view(MARKET, 'get_listings', { nft: `${n}.${F}`, from_index: 0, limit: 100 })).length;
  before.sales += (await view(MARKET, 'get_stats', { nft: `${n}.${F}` })).sales;
}
await account(MARKET).deployContract(fs.readFileSync('res/quorum_market_opt.wasm'));
await sleep(4000);
let after = { listings: 0, sales: 0 };
for (const n of ['molten', 'tidewater', 'feather-protocol']) {
  after.listings += (await view(MARKET, 'get_listings', { nft: `${n}.${F}`, from_index: 0, limit: 100 })).length;
  after.sales += (await view(MARKET, 'get_stats', { nft: `${n}.${F}` })).sales;
}
check('every listing and sale survived the market upgrade', before.listings === after.listings && before.sales === after.sales, `${after.listings} listings, ${after.sales} sales`);
check('the market has the registrar list now', (await view(MARKET, 'is_registrar', { account: 'nobody.testnet' })) === false);

console.log('\n== 2. create the factory');
if (await rpcAccount(FACTORY)) { console.log(FACTORY, 'already exists'); }
else {
  const kp = KeyPair.fromRandom('ed25519');
  fs.writeFileSync(`${KEY_DIR}/${FACTORY}.json`, JSON.stringify({ account_id: FACTORY, public_key: kp.getPublicKey().toString(), private_key: kp.toString() }));
  const code = fs.readFileSync('res/quorum_factory_opt.wasm');
  const funding = near(10.6);
  const out = await account(F).signAndSendTransaction({ receiverId: FACTORY, waitUntil: 'FINAL', actions: [
    actions.createAccount(), actions.transfer(funding), actions.addFullAccessKey(kp.getPublicKey()), actions.deployContract(code),
    actions.functionCall('new', { market: MARKET, vault_code_hash: VAULT_HASH, dex: 'v2.ref-finance.testnet', wrap: 'wrap.testnet', settle_grace_ms: '4320000' }, 30n * TGAS, 0n),
  ] });
  console.log('factory created, tx', out.transaction?.hash);
}
await sleep(3000);
const s = await view(FACTORY, 'settings');
check('the factory is initialised with the market, vault code, DEX and wNEAR', s.market === MARKET && s.vault_code_hash === VAULT_HASH && s.wrap === 'wrap.testnet', JSON.stringify(s).slice(0, 120));
check('a 20-piece launch asks for the full deposit', BigInt(await view(FACTORY, 'required_deposit', { supply: 20 })) > near(9), fmt(await view(FACTORY, 'required_deposit', { supply: 20 })) + ' NEAR');

console.log('\n== 3. the factory may register collections on the market');
mustSucceed('the market owner appoints the factory as registrar', await call(F, MARKET, 'add_registrar', { account: FACTORY }, { gas: 30n * TGAS }));
await sleep(3000);
check('the factory is a registrar', (await view(MARKET, 'is_registrar', { account: FACTORY })) === true);
mustSucceed_not(await call(`alice.${F}`, MARKET, 'add_registrar', { account: `alice.${F}` }));
function mustSucceed_not(r) { check('a stranger cannot appoint a registrar', !r.ok && /Only the owner/.test(r.failures.join(' ')), r.failures[0]?.slice(0, 80)); }
console.log('\nfactory balance', fmt(await balance(FACTORY)), 'NEAR; founder', fmt(await balance(F)), 'NEAR');
process.exit(summary() ? 0 : 1);
