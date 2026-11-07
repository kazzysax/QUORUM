import test from "node:test";
import assert from "node:assert/strict";
import { openDb, getCursor } from "../src/db.js";
import { indexRange } from "../src/indexer.js";
import { applyEvent, eventsFromBlock } from "../src/events.js";
import { block, ingest, mintBlock, n171, q, watch } from "./helpers.js";

const one = (db, sql, ...p) => db.prepare(sql).get(...p);

test("mint creates the token with its asset and escrow; the treasury half is recorded in NEAR", () => {
  const db = openDb();
  ingest(db, mintBlock(10, "1", "alice.test"));
  const t = one(db, "SELECT * FROM tokens WHERE token_id='1'");
  assert.equal(t.owner, "alice.test");
  assert.equal(t.vault, "v1.nft.test");
  assert.deepEqual([t.asset, t.escrow_share, t.credited], ["usdc.test", "5000000", 0]);
  assert.equal(one(db, "SELECT COUNT(*) c FROM vault_balances").c, 0, "the vault is empty until settlement");
  const f = one(db, "SELECT asset, amount FROM treasury_flows WHERE kind='mint'");
  assert.deepEqual([f.asset, f.amount], ["near", "5000000"]);
});

test("replaying the same block changes nothing (idempotent)", () => {
  const db = openDb();
  const b = mintBlock(10, "1", "alice.test");
  ingest(db, b); ingest(db, b); ingest(db, b);
  assert.equal(one(db, "SELECT COUNT(*) c FROM tokens").c, 1);
  assert.equal(one(db, "SELECT COUNT(*) c FROM treasury_flows").c, 1);
  assert.equal(one(db, "SELECT COUNT(*) c FROM settlement_groups").c, 1);
});

test("failed receipts and unwatched contracts are ignored", () => {
  const db = openDb();
  ingest(db,
    block(11, ["nft.test", n171("nft_mint", { owner_id: "x.test", token_ids: ["9"] }), { Failure: {} }]),
    block(12, ["evil.test", n171("nft_mint", { owner_id: "x.test", token_ids: ["8"] })]));
  assert.equal(one(db, "SELECT COUNT(*) c FROM tokens").c, 0);
});

test("transfer moves the owner and records the block; burn removes it", () => {
  const db = openDb();
  ingest(db, mintBlock(10, "1", "alice.test"),
    block(20, ["nft.test", n171("nft_transfer", { old_owner_id: "alice.test", new_owner_id: "bob.test", token_ids: ["1"] })]));
  let t = one(db, "SELECT * FROM tokens WHERE token_id='1'");
  assert.deepEqual([t.owner, t.last_transfer_block], ["bob.test", 20]);
  ingest(db, block(30,
    ["nft.test", [n171("nft_burn", { owner_id: "bob.test", token_ids: ["1"] }), q("burn", { token_id: "1", holder: "bob.test", live_supply: "0" })]],
    ["v1.nft.test", q("vault_redeem_started", { token_id: "1", holder: "bob.test" })],
    ["v1.nft.test", q("vault_payout", { token_id: "1", asset: "nep141:usdc.test", payee: "Pool", amount: "500000" })]));
  t = one(db, "SELECT * FROM tokens WHERE token_id='1'");
  assert.equal(t.burned_block, 30);
  assert.equal(one(db, "SELECT COUNT(*) c FROM vault_balances").c, 0);
  assert.equal(one(db, "SELECT amount FROM treasury_flows WHERE kind='redemption'").amount, "500000");
});

test("deposits accumulate per asset", () => {
  const db = openDb();
  ingest(db, mintBlock(10, "1", "alice.test"),
    block(11, ["v1.nft.test", q("vault_deposit", { token_id: "1", asset: "nep141:usdc.test", amount: "100", from: "nft.test" })]),
    block(12, ["v1.nft.test", q("vault_deposit", { token_id: "1", asset: "nep141:usdc.test", amount: "50", from: "alice.test" })]),
    block(13, ["v1.nft.test", q("vault_deposit", { token_id: "1", asset: "near", amount: "7", from: "alice.test" })]));
  const rows = db.prepare("SELECT asset, amount FROM vault_balances ORDER BY asset").all();
  assert.deepEqual(rows.map((r) => [r.asset, r.amount]), [["near", "7"], ["nep141:usdc.test", "150"]]);
});

test("settlement lifecycle: swap, credit, and a failed swap returning to Pending", () => {
  const db = openDb();
  ingest(db, mintBlock(10, "1", "alice.test"), mintBlock(11, "2", "bob.test"),
    block(20, ["nft.test", q("settle_started", { group: 0, asset: "usdc.test", near_in: "10000000", min_out: "9" })]));
  assert.equal(one(db, "SELECT phase FROM settlement_groups WHERE idx=0").phase, "Swapping");
  ingest(db, block(21, ["nft.test", q("swap_failed", { group: 0, reason: "no output received" })]));
  assert.equal(one(db, "SELECT phase FROM settlement_groups WHERE idx=0").phase, "Pending");
  ingest(db,
    block(30, ["nft.test", q("settle_started", { group: 0, asset: "usdc.test", near_in: "10000000", min_out: "9" })]),
    block(31, ["nft.test", q("swap_done", { group: 0, asset: "usdc.test", near_in: "10000000", out: "4000" })]),
    block(32, ["nft.test", q("credited", { token_id: "1", amount: "2000" })]));
  const g = one(db, "SELECT * FROM settlement_groups WHERE idx=0");
  assert.deepEqual([g.phase, g.out_total], ["Swapped", "4000"]);
  assert.equal(one(db, "SELECT credited FROM tokens WHERE token_id='1'").credited, 1);
  assert.equal(one(db, "SELECT credited FROM tokens WHERE token_id='2'").credited, 0);
  ingest(db, block(33, ["nft.test", q("credit_failed", { token_id: "1", amount: "2000" })]));
  assert.equal(one(db, "SELECT credited FROM tokens WHERE token_id='1'").credited, 0, "a refused credit becomes retryable");
});

test("fallback and an escrow burn (10% to the treasury in NEAR)", () => {
  const db = openDb();
  ingest(db, mintBlock(10, "1", "alice.test"),
    block(40, ["nft.test", q("fallback_enabled", { group: 0 })]));
  assert.equal(one(db, "SELECT phase FROM settlement_groups WHERE idx=0").phase, "Fallback");
  const db2 = openDb();
  ingest(db2, mintBlock(10, "1", "alice.test"),
    block(50, ["nft.test", [n171("nft_burn", { owner_id: "alice.test", token_ids: ["1"] }),
      q("burn", { token_id: "1", holder: "alice.test", live_supply: "0", from_escrow: true }),
      q("escrow_refund", { token_id: "1", holder: "alice.test", to_holder: "4500000", to_pool: "500000" })]]));
  assert.equal(one(db2, "SELECT burned_block FROM tokens WHERE token_id='1'").burned_block, 50);
  assert.equal(one(db2, "SELECT amount FROM treasury_flows WHERE kind='redemption'").amount, "500000");
});

test("listing, reprice, sale (with fee flow) and cancel", () => {
  const db = openDb();
  ingest(db, mintBlock(10, "1", "alice.test"),
    block(11, ["market.nft.test", q("listed", { nft: "nft.test", token_id: "1", listing: { seller: "alice.test", price: "1000", approval_id: 4 } })]),
    block(12, ["market.nft.test", q("price_updated", { nft: "nft.test", token_id: "1", price: "900" })]));
  assert.equal(one(db, "SELECT price FROM listings").price, "900");
  ingest(db, block(13, ["market.nft.test", q("sale", { nft: "nft.test", token_id: "1", buyer: "bob.test", seller: "alice.test", price: "900", pool_fee: "45", royalty: "0", seller_net: "855" })]));
  assert.equal(one(db, "SELECT COUNT(*) c FROM listings").c, 0);
  assert.equal(one(db, "SELECT seller_net FROM sales").seller_net, "855");
  assert.equal(one(db, "SELECT amount FROM treasury_flows WHERE kind='sale_fee'").amount, "45");
});

test("proposal, votes and execution tally correctly; duplicate votes are ignored", () => {
  const db = openDb();
  const p = { id: 1, kind: { Spend: { recipient: "v.test", asset: "near", amount: "5" } }, proposer: "alice.test", purpose: "Venue", start_block: "50", voting_end_ms: "99", timelock_ms: "1", quorum_bps: 1000, pass_bps: 5000, supply: "10" };
  ingest(db,
    block(50, ["dao.nft.test", q("proposal_created", { id: 1, proposal: p })]),
    block(51, ["dao.nft.test", q("vote", { proposal_id: 1, voter: "a.test", token_id: "1", choice: 1 })]),
    block(52, ["dao.nft.test", q("vote", { proposal_id: 1, voter: "a.test", token_id: "2", choice: 0 })]),
    block(53, ["dao.nft.test", q("vote", { proposal_id: 1, voter: "b.test", token_id: "3", choice: 2 })]),
    block(54, ["dao.nft.test", q("vote", { proposal_id: 1, voter: "a.test", token_id: "1", choice: 0 })]),
    block(60, ["dao.nft.test", q("proposal_executed", { id: 1 })]));
  const r = one(db, "SELECT * FROM proposals WHERE id=1");
  assert.deepEqual([r.yes, r.no, r.abstain, r.executed], [1, 1, 1, 1]);
});

test("treasury donations, spends, distributions and claims are recorded", () => {
  const db = openDb();
  ingest(db,
    block(5, ["treasury.nft.test", q("treasury_donation", { from: "fan.test", asset: "near", amount: "100", memo: "gm" })]),
    block(6, ["treasury.nft.test", q("treasury_spend", { recipient: "venue.test", asset: "near", amount: "40", purpose: "Venue" })]),
    block(7, ["treasury.nft.test", q("treasury_distribution", { asset: "near", amount: "30", per_token_e24: "1", live_supply: "3", distributed: "30" })]),
    block(8, ["treasury.nft.test", q("treasury_claim", { token_id: "1", to: "alice.test", asset: "near", amount: "10" })]));
  assert.equal(one(db, "SELECT COUNT(*) c FROM distributions").c, 1);
  assert.equal(one(db, "SELECT SUM(CAST(amount AS INTEGER)) s FROM treasury_flows WHERE direction='out'").s, 50);
});

test("indexRange stores a cursor, skips empty heights and resumes", async () => {
  const db = openDb();
  const blocks = { 11: mintBlock(11, "1", "alice.test"), 13: mintBlock(13, "2", "bob.test") };
  const fetchBlock = async (h) => blocks[h] ?? null;
  const n = await indexRange(db, fetchBlock, 10, 14, watch);
  assert.equal(n, 2);
  assert.equal(getCursor(db), 14);
  assert.equal(one(db, "SELECT COUNT(*) c FROM tokens").c, 2);
  await indexRange(db, fetchBlock, 10, 14, watch); // re-run after a crash: nothing doubles
  assert.equal(one(db, "SELECT COUNT(*) c FROM treasury_flows").c, 2);
});

test("a block that throws rolls back and leaves the cursor untouched", async () => {
  const db = openDb();
  await indexRange(db, async () => null, 0, 5, watch);
  const bad = { block: { header: { height: 6 } }, shards: [{ receipt_execution_outcomes: [{ receipt: { receiver_id: "nft.test", receipt_id: "x" },
    execution_outcome: { outcome: { logs: ["EVENT_JSON:" + JSON.stringify(q("listed", { nft: "n", token_id: "1" }))] } } }] }] };
  await assert.rejects(indexRange(db, async () => bad, 5, 6, watch));
  assert.equal(getCursor(db), 5);
});
