// Creates extra funded test users (dave, erin, frank) as sub-accounts of the founder, with fresh keys.
import fs from 'node:fs';
import { KeyPair } from 'near-api-js';
import { account, exists, F, KEY_DIR, near, sleep, balance, fmt } from './lib.mjs';
for (const u of ['dave', 'erin', 'frank']) {
  const id = `${u}.${F}`;
  if (await exists(id)) { console.log(id, 'exists'); continue; }
  const kp = KeyPair.fromRandom('ed25519');
  await account(F).createAccount({ newAccountId: id, publicKey: kp.getPublicKey(), nearToTransfer: near(4) });
  fs.writeFileSync(`${KEY_DIR}/${id}.json`, JSON.stringify({ account_id: id, public_key: kp.getPublicKey().toString(), private_key: kp.toString() }));
  await sleep(1500);
  console.log(id, 'created', fmt(await balance(id)));
}
