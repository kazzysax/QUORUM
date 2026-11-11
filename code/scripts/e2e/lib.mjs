// Shared helpers for the testnet end-to-end tests. Everything goes through real NEAR testnet
// transactions and RPC views; nothing is simulated. Credentials are read from the near-cli
// legacy credentials directory (set CRED_DIR to override).
import fs from 'node:fs';
import os from 'node:os';
import { Account, JsonRpcProvider, KeyPairSigner } from 'near-api-js';

export const RPC = process.env.RPC || 'https://test.rpc.fastnear.com';
const CRED_DIR = process.env.CRED_DIR || '//wsl.localhost/Ubuntu/home/dallos/.near-credentials/testnet';
export const provider = new JsonRpcProvider({ url: RPC });
export const F = 'qrmx-founder1.testnet';
export const MARKET = `market.${F}`;
export const NEAR = 10n ** 24n;
export const TGAS = 10n ** 12n;

export const KEY_DIR = process.env.KEY_DIR || `${os.homedir()}/.quorum-keys`;
const cache = new Map();
export function account(id) {
  if (!cache.has(id)) {
    // Rotated keys live in KEY_DIR; CRED_DIR is the near-cli legacy folder (old keys, kept only as a fallback).
    const file = fs.existsSync(`${KEY_DIR}/${id}.json`) ? `${KEY_DIR}/${id}.json` : `${CRED_DIR}/${id}.json`;
    const key = JSON.parse(fs.readFileSync(file, 'utf8'));
    cache.set(id, new Account(id, provider, KeyPairSigner.fromSecretKey(key.private_key)));
  }
  return cache.get(id);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const near = (s) => BigInt(Math.round(Number(s) * 1e6)) * 10n ** 18n; // up to 6 dp
export const fmt = (y) => (Number(BigInt(y) / 10n ** 18n) / 1e6).toFixed(4);

const FALLBACK_RPCS = [RPC, 'https://near-testnet.drpc.org', 'https://rpc.testnet.near.org'];
async function rpc(method, params) {
  let last;
  for (let i = 0; i < 8; i++) {
    const url = FALLBACK_RPCS[i % FALLBACK_RPCS.length];
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      const j = await res.json();
      if (!j.error) return j.result;
      last = new Error(JSON.stringify(j.error).slice(0, 300));
      if (!/UNKNOWN|DOES_NOT_EXIST/.test(JSON.stringify(j.error))) throw last;
    } catch (e) { last = e; if (e === last && /^{|RPC|HANDLER/.test(String(e.message)) && !/UNKNOWN/.test(String(e.message))) throw e; }
    await sleep(1500 * (1 + (i >> 1)));
  }
  throw last;
}

export async function view(contract, method, args = {}) {
  const r = await rpc('query', { request_type: 'call_function', finality: 'final', account_id: contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
  if (r.error) throw new Error(`${contract}.${method}: ${r.error}`);
  return JSON.parse(Buffer.from(r.result).toString());
}

export async function balance(id) {
  const r = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: id });
  return BigInt(r.amount);
}

export async function exists(id) {
  try { await balance(id); return true; } catch { return false; }
}

/** All failures in a final outcome: the top-level status and every receipt it spawned. */
function failures(outcome) {
  const out = [];
  const chk = (s, where) => { if (s && typeof s === 'object' && 'Failure' in s) out.push(`${where}: ${JSON.stringify(s.Failure).slice(0, 260)}`); };
  chk(outcome.status, 'tx');
  for (const ro of outcome.receipts_outcome || []) chk(ro.outcome?.status, `receipt ${ro.outcome?.executor_id}`);
  return out;
}

/** Sends a function call and waits for FINAL. Returns { ok, failures, hash }. Never throws on contract failure. */
export async function call(accountId, contract, method, args = {}, { deposit = 0n, gas = 300n * TGAS } = {}) {
  const acc = account(accountId);
  try {
    const outcome = await acc.callFunctionRaw({ contractId: contract, methodName: method, args, gas, deposit });
    const full = outcome?.receipts_outcome ? outcome : await provider.viewTransactionStatus({ txHash: outcome.transaction.hash, accountId, waitUntil: 'FINAL' });
    const f = failures(full);
    return { ok: f.length === 0, failures: f, hash: full.transaction?.hash || outcome.transaction?.hash, outcome: full };
  } catch (e) {
    return { ok: false, failures: [String(e.message || e).slice(0, 300)], hash: null };
  }
}

// -------------------------------------------------------------- test reporting
let pass = 0, fail = 0;
const log = [];
export function check(name, cond, detail = '') {
  if (cond) { pass++; log.push(`PASS  ${name}${detail ? '  ' + detail : ''}`); }
  else { fail++; log.push(`FAIL  ${name}${detail ? '  ' + detail : ''}`); }
  console.log(log[log.length - 1]);
  return cond;
}
export const mustSucceed = (name, r) => check(name, r.ok, r.ok ? `tx ${r.hash}` : r.failures[0]);
/** The call must be rejected; `needle` (if given) must appear in the failure text. */
export const mustFail = (name, r, needle) =>
  check(name, !r.ok && (!needle || r.failures.join(' ').includes(needle)), r.ok ? 'UNEXPECTEDLY SUCCEEDED' : `rejected: ${r.failures[0].slice(0, 110)}`);
export function summary() {
  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0;
}

export async function waitFor(name, fn, { tries = 40, every = 3000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try { const v = await fn(); if (v) return v; } catch { /* retry */ }
    await sleep(every);
  }
  throw new Error(`timed out waiting for: ${name}`);
}
