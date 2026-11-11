// Replaces every full-access key on the listed accounts with a fresh one and stores the new
// keys in KEY_DIR (default: ~/.quorum-keys, outside the repo and outside ~/.near-credentials).
// Anything that copied the old keys loses access.
import fs from 'node:fs';
import os from 'node:os';
import { KeyPair, KeyPairSigner, Account } from 'near-api-js';
import { account, provider, F, sleep, KEY_DIR as KD } from './lib.mjs';

const KEY_DIR = process.env.KEY_DIR || `${os.homedir()}/.quorum-keys`;
fs.mkdirSync(KEY_DIR, { recursive: true });

const ids = [
  F, 'qrmx-molten.testnet', 'qrmx-molten-dao.testnet', 'qrmx-molten-tre.testnet', 'qrmx-tide.testnet',
  `tide-dao.${F}`, `tide-tre.${F}`, `feather.${F}`, `feather-dao.${F}`, `feather-tre.${F}`,
  `market.${F}`, `alice.${F}`, `bob.${F}`, `carol.${F}`,
];

for (const id of ids) {
  if (fs.existsSync(`${KD}/${id}.json`)) { console.log(`${id}: already rotated`); continue; }
  const old = account(id); // signs with the current (old) key
  const before = (await old.getAccessKeyList()).keys.map((k) => k.public_key);
  const kp = KeyPair.fromRandom('ed25519');
  await old.addFullAccessKey(kp.getPublicKey());
  await sleep(2500);
  const fresh = new Account(id, provider, new KeyPairSigner(kp));
  for (const pk of before) await fresh.deleteKey(pk);
  await sleep(1500);
  const after = (await fresh.getAccessKeyList()).keys.map((k) => k.public_key);
  fs.writeFileSync(`${KEY_DIR}/${id}.json`, JSON.stringify({ account_id: id, public_key: kp.getPublicKey().toString(), private_key: kp.toString() }));
  console.log(`${id}: removed ${before.length} old key(s); keys now ${after.length} (${after[0] === kp.getPublicKey().toString() ? 'new key only' : 'CHECK'})`);
}
