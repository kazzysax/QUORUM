// Redeploys contract code (no re-init, state is kept) using the rotated keys.
import fs from 'node:fs';
import { account, F, sleep } from './lib.mjs';
const targets = [
  ['nft', ['qrmx-molten.testnet', 'qrmx-tide.testnet', `feather.${F}`]],
  ['dao', ['qrmx-molten-dao.testnet', `tide-dao.${F}`, `feather-dao.${F}`]],
  ['treasury', ['qrmx-molten-tre.testnet', `tide-tre.${F}`, `feather-tre.${F}`]],
  ['market', [`market.${F}`]],
];
for (const [kind, ids] of targets) {
  const code = fs.readFileSync(`res/quorum_${kind}_opt.wasm`);
  for (const id of ids) { await account(id).deployContract(code); console.log('deployed', kind, 'to', id); await sleep(800); }
}
