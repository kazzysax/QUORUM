// SQLite store (node:sqlite). Every write is idempotent: events are keyed by
// (receipt id, log index), so replays never double count.
import { DatabaseSync } from "node:sqlite";

export function openDb(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS events (
      receipt_id TEXT NOT NULL, idx INTEGER NOT NULL, block INTEGER NOT NULL,
      contract TEXT NOT NULL, name TEXT NOT NULL, token_id TEXT, data TEXT NOT NULL,
      PRIMARY KEY (receipt_id, idx)
    );
    CREATE INDEX IF NOT EXISTS events_token ON events(token_id, block);
    CREATE INDEX IF NOT EXISTS events_name ON events(name, block);
    CREATE TABLE IF NOT EXISTS tokens (
      token_id TEXT PRIMARY KEY, owner TEXT NOT NULL, vault TEXT,
      minted_block INTEGER, last_transfer_block INTEGER, burned_block INTEGER, mint_price TEXT,
      asset TEXT, escrow_share TEXT, credited INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS tokens_owner ON tokens(owner);
    CREATE TABLE IF NOT EXISTS vault_balances (
      token_id TEXT NOT NULL, asset TEXT NOT NULL, amount TEXT NOT NULL, PRIMARY KEY (token_id, asset)
    );
    CREATE TABLE IF NOT EXISTS listings (
      nft TEXT NOT NULL, token_id TEXT NOT NULL, seller TEXT NOT NULL, price TEXT NOT NULL,
      approval_id INTEGER, block INTEGER, PRIMARY KEY (nft, token_id)
    );
    CREATE TABLE IF NOT EXISTS sales (
      receipt_id TEXT PRIMARY KEY, block INTEGER, token_id TEXT, buyer TEXT, seller TEXT,
      price TEXT, pool_fee TEXT, royalty TEXT, seller_net TEXT
    );
    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY, kind TEXT, proposer TEXT, purpose TEXT, start_block INTEGER,
      voting_end_ms TEXT, timelock_ms TEXT, quorum_bps INTEGER, pass_bps INTEGER, supply TEXT,
      yes INTEGER DEFAULT 0, no INTEGER DEFAULT 0, abstain INTEGER DEFAULT 0, executed INTEGER DEFAULT 0, raw TEXT
    );
    CREATE TABLE IF NOT EXISTS votes (
      proposal_id INTEGER, token_id TEXT, voter TEXT, choice INTEGER, block INTEGER,
      PRIMARY KEY (proposal_id, token_id)
    );
    CREATE TABLE IF NOT EXISTS treasury_flows (
      id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_id TEXT, idx INTEGER, block INTEGER,
      direction TEXT, kind TEXT, asset TEXT, amount TEXT, counterparty TEXT, note TEXT,
      UNIQUE (receipt_id, idx)
    );
    CREATE TABLE IF NOT EXISTS distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_id TEXT, idx INTEGER, block INTEGER, asset TEXT,
      amount TEXT, per_token_e24 TEXT, live_supply TEXT, UNIQUE (receipt_id, idx)
    );
    CREATE TABLE IF NOT EXISTS settlement_groups (
      idx INTEGER PRIMARY KEY, asset TEXT, phase TEXT NOT NULL DEFAULT 'Pending', near_in TEXT, out_total TEXT, block INTEGER
    );
    CREATE TABLE IF NOT EXISTS cursor (id INTEGER PRIMARY KEY CHECK (id = 1), height INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS challenges (nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
  `);
  return db;
}

export const getCursor = (db) => db.prepare("SELECT height FROM cursor WHERE id=1").get()?.height ?? null;
export const setCursor = (db, h) =>
  db.prepare("INSERT INTO cursor(id,height) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET height=excluded.height").run(h);

/** Runs `fn` atomically (one block per transaction). */
export function tx(db, fn) {
  db.exec("BEGIN");
  try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
}

export const big = (a, b) => (BigInt(a || "0") + BigInt(b || "0")).toString();
