// Relaunches the three collections with 20 pieces each, on fresh accounts, each with its own DAO and
// treasury. Every account is created, funded, keyed, deployed and initialised in ONE transaction,
// so nothing can sit half-configured and nobody can call `new` before us.
// Usage (from code/): node scripts/e2e/relaunch.mjs [--dry]
import fs from 'node:fs';
import { KeyPair, actions } from 'near-api-js';
import { account, view, call, check, mustSucceed, summary, near, F, MARKET, KEY_DIR, sleep, TGAS } from './lib.mjs';

const DRY = process.argv.includes('--dry');
const HASH = 'DQALgt8fazwvRPFKdz2j5Eek9kacchwFm2vCucLDPCn8'; // published NEP-591 vault code
const SITE = 'https://quorumio.vercel.app';
const PRICE = near(1);
const MAX_SUPPLY = 20;
const MINT_DAYS = 30;
const BOUNDS = [
  { min_period_ms: '600000', min_quorum_bps: 5000, min_pass_bps: 5000, min_timelock_ms: '60000' },
  { min_period_ms: '600000', min_quorum_bps: 5000, min_pass_bps: 5000, min_timelock_ms: '60000' },
  { min_period_ms: '900000', min_quorum_bps: 5000, min_pass_bps: 6000, min_timelock_ms: '120000' },
  { min_period_ms: '300000', min_quorum_bps: 5000, min_pass_bps: 5000, min_timelock_ms: '0' },
];
// [new account base, old NFT contract to copy name/symbol/media from, metadata slug]
const COLLECTIONS = [
  ['molten', 'qrmx-molten.testnet', 'molten'],
  ['tidewater', 'qrmx-tide.testnet', 'tide'],
  ['feather-protocol', `feather.${F}`, 'feather'],
];
const FUND = { nft: near(4.7), dao: near(2.5), tre: near(2.5) };
const code = (k) => fs.readFileSync(`res/quorum_${k}_opt.wasm`);

/** One direct query: lib's `exists` retries "unknown account" (meant for accounts that were just created). */
async function exists(id) {
  for (const url of ['https://near-testnet.drpc.org', 'https://rpc.testnet.near.org']) {
    try {
      const j = await (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: id } }) })).json();
      if (j.result) return true;
      if (/UNKNOWN_ACCOUNT/.test(JSON.stringify(j.error))) return false;
    } catch { /* next endpoint */ }
  }
  throw new Error(`could not check ${id}`);
}

async function createDeployInit(id, wasm, initArgs, fund, gas) {
  if (await exists(id)) { console.log(`${id} already exists, skipping`); return { ok: true, skipped: true }; }
  const kp = KeyPair.fromRandom('ed25519');
  if (DRY) { console.log(`[dry] would create ${id} with ${Number(fund / 10n ** 21n) / 1000} NEAR, init`, JSON.stringify(initArgs).slice(0, 200)); return { ok: true }; }
  fs.writeFileSync(`${KEY_DIR}/${id}.json`, JSON.stringify({ account_id: id, public_key: kp.getPublicKey().toString(), private_key: kp.toString() }));
  try {
    const out = await account(F).signAndSendTransaction({
      receiverId: id,
      actions: [
        actions.createAccount(),
        actions.transfer(fund),
        actions.addFullAccessKey(kp.getPublicKey()),
        actions.deployContract(wasm),
        actions.functionCall('new', initArgs, gas, 0n),
      ],
      waitUntil: 'FINAL',
    });
    return { ok: true, hash: out.transaction?.hash };
  } catch (e) {
    return { ok: false, failures: [String(e.message || e).slice(0, 300)] };
  }
}

const made = [];
for (const [base, old, slug] of COLLECTIONS) {
  const nft = `${base}.${F}`, dao = `${base}-dao.${F}`, tre = `${base}-tre.${F}`;
  const meta = await view(old, 'nft_metadata');
  const oldCfg = await view(old, 'get_config');
  console.log(`\n== ${meta.name}: ${nft}`);
  const now = Date.now();
  const config = {
    founder: F, treasury: tre, dao,
    vault_allowlist: [],
    vault_code_hash: HASH,
    mint_storage_cost: oldCfg.mint_storage_cost,
    max_supply: MAX_SUPPLY,
    stages: [{ name: 'Public', kind: 'Public', price_near: PRICE.toString(), start_ms: String(now - 60_000), end_ms: String(now + MINT_DAYS * 86_400_000), per_wallet_limit: 20, merkle_root: null }],
    royalty_bps: oldCfg.royalty_bps, royalty_recipient: F,
    metadata_base_url: `${SITE}/m/${slug}`, media_base_url: `${SITE}/media/${slug}`,
    paused: false, provenance_hash: oldCfg.provenance_hash,
    asset_plan: oldCfg.asset_plan, dex: oldCfg.dex, wrap_account: oldCfg.wrap_account,
    settle_grace_ms: oldCfg.settle_grace_ms,
  };
  const { name, symbol, spec, icon, base_uri } = meta;
  mustSucceed(`DAO ${dao}`, await createDeployInit(dao, code('dao'), { nft, treasury: tre, bounds: BOUNDS }, FUND.dao, 30n * TGAS));
  mustSucceed(`Treasury ${tre}`, await createDeployInit(tre, code('treasury'), { dao, nft, dex: oldCfg.dex, wrap: oldCfg.wrap_account }, FUND.tre, 30n * TGAS));
  mustSucceed(`NFT ${nft}`, await createDeployInit(nft, code('nft'), { args: { metadata: { spec, name, symbol, icon, base_uri }, config } }, FUND.nft, 100n * TGAS));
  if (!DRY) {
    mustSucceed(`market registers ${nft}`, await call(F, MARKET, 'register_collection', { nft }, { gas: 30n * TGAS }));
    await sleep(2000);
    const c = await view(nft, 'get_config');
    check(`${name}: config bound to its own DAO and treasury`, c.dao === dao && c.treasury === tre && c.max_supply === MAX_SUPPLY, `supply ${c.max_supply}, price ${Number(BigInt(c.stages[0].price_near) / 10n ** 21n) / 1000} NEAR`);
    check(`${name}: vault allowlist set by the contract`, c.vault_allowlist.includes('near'), c.vault_allowlist.join(', '));
  }
  made.push({ name: meta.name, slug, nft, dao, treasury: tre });
}
console.log('\n' + JSON.stringify(made, null, 2));
process.exit(summary() ? 0 : 1);
