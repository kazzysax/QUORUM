import { account, F, near, balance, fmt, sleep } from './lib.mjs';
const f = account(F);
for (const u of ['alice', 'bob', 'carol']) {
  const id = `${u}.${F}`;
  const have = await balance(id);
  const want = near(6);
  if (have < want) await f.transfer({ receiverId: id, amount: want - have });
}
await sleep(2500);
for (const id of [F, `alice.${F}`, `bob.${F}`, `carol.${F}`]) console.log(id, fmt(await balance(id)));
