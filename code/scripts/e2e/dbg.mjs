import { balance, fmt, view, F } from './lib.mjs';
for (const id of [F, `alice.${F}`, `bob.${F}`, `carol.${F}`, `dave.${F}`, `erin.${F}`, `frank.${F}`]) console.log(id.padEnd(30), fmt(await balance(id)), 'NEAR');
for (const [n, t] of [['molten', 'qrmx-molten-tre.testnet'], ['tide', `tide-tre.${F}`], ['feather', `feather-tre.${F}`]]) console.log(`${n} treasury spendable`.padEnd(30), fmt(BigInt(await view(t, 'native_balance'))), 'NEAR');
