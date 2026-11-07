import nacl from "tweetnacl";
import { openDb } from "../src/db.js";
import { buildApp } from "../src/app.js";
import { applyEvent, eventsFromBlock } from "../src/events.js";
import { signedHash } from "../src/nep413.js";

export const cfg = {
  collection: "nft.test", dao: "dao.nft.test", treasury: "treasury.nft.test", market: "market.nft.test",
  sessionSecret: "x".repeat(40), appRecipient: "quorum.test", mediaBaseUrl: "https://media.test", holdCacheMs: 0, allowlistsFile: "/tmp/quorum-allowlists-test.json",
};
export const watch = (a) => ["nft.test", "dao.nft.test", "treasury.nft.test", "market.nft.test"].includes(a) || a.endsWith(".nft.test");

/** Builds a neardata-shaped block holding the given logs from one receiver. */
export function block(height, ...outcomes) {
  return {
    block: { header: { height } },
    shards: [{ receipt_execution_outcomes: outcomes.map(([receiver, logs, status], i) => ({
      receipt: { receiver_id: receiver, receipt_id: `r${height}-${i}` },
      execution_outcome: { id: `r${height}-${i}`, outcome: { logs: [].concat(logs).map((l) => (typeof l === "string" ? l : "EVENT_JSON:" + JSON.stringify(l))), status: status ?? { SuccessValue: "" } } },
    })) }],
  };
}
export const q = (event, data) => ({ standard: "quorum", version: "1.0.0", event, data: [data] });
export const n171 = (event, data) => ({ standard: "nep171", version: "1.2.0", event, data: [data] });

export function ingest(db, ...blocks) {
  for (const b of blocks) for (const e of eventsFromBlock(b, watch)) applyEvent(db, e);
}

export function chainStub(holders = new Set(), keys = new Map()) {
  return {
    holders, keys,
    holdsToken: async (a) => holders.has(a),
    hasAccessKey: async (a, k) => keys.get(a) === k,
  };
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58(bytes) {
  let n = 0n; for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = ""; while (n > 0n) { s = ALPHABET[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = "1" + s; else break; }
  return s;
}

export function wallet(seedByte = 3) {
  const kp = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(seedByte));
  return {
    publicKey: "ed25519:" + b58(kp.publicKey),
    sign: ({ message, nonce, recipient }) =>
      Buffer.from(nacl.sign.detached(signedHash({ message, nonce: Buffer.from(nonce, "base64"), recipient }), kp.secretKey)).toString("base64"),
  };
}

export async function setup(chain = chainStub(), clock = { t: 1_000_000 }) {
  const db = openDb(":memory:");
  const app = await buildApp({ db, chain, cfg, now: () => clock.t });
  return { db, app, chain, clock };
}

/** Mints token `id` like the contract does: half to the treasury now, half held as escrow. */
export function mintBlock(height, id, owner, price = "10000000", asset = "usdc.test") {
  const escrow = String(BigInt(price) / 2n), pool = String(BigInt(price) - BigInt(price) / 2n);
  return block(height,
    ["nft.test", [n171("nft_mint", { owner_id: owner, token_ids: [id] }),
      q("mint", { token_id: id, buyer: owner, price, escrow_share: escrow, pool_share: pool, vault: `v${id}.nft.test`, asset })]]);
}
