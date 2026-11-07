import test from "node:test";
import assert from "node:assert/strict";
import { block, chainStub, ingest, mintBlock, n171, q, setup, wallet, cfg } from "./helpers.js";
import { signSession, readSession } from "../src/auth.js";
import { signedHash, verifyNep413 } from "../src/nep413.js";

const get = (app, url, headers) => app.inject({ method: "GET", url, headers });
const post = (app, url, payload) => app.inject({ method: "POST", url, payload });

async function populated() {
  const s = await setup();
  ingest(s.db, mintBlock(10, "1", "alice.test"), mintBlock(11, "2", "bob.test"),
    block(12, ["market.nft.test", q("listed", { nft: "nft.test", token_id: "2", listing: { seller: "bob.test", price: "1000", approval_id: 1 } })]),
    block(13, ["v1.nft.test", q("vault_deposit", { token_id: "1", asset: "near", amount: "250", from: "alice.test" })]));
  return s;
}

test("GET /nfts lists live tokens with vault balances and listings, filterable", async () => {
  const { app } = await populated();
  const all = (await get(app, "/nfts")).json();
  assert.equal(all.total, 2);
  assert.equal(all.items[0].vault_balances["near"], "250");
  assert.deepEqual([all.items[0].asset, all.items[0].escrow_share, all.items[0].credited], ["usdc.test", "5000000", false]);
  assert.equal(all.items[1].listing.price, "1000");
  assert.equal((await get(app, "/nfts?owner=alice.test")).json().total, 1);
  assert.equal((await get(app, "/nfts?listed=true")).json().total, 1);
});

test("GET /nfts/:id and 404", async () => {
  const { app } = await populated();
  const t = (await get(app, "/nfts/1")).json();
  assert.equal(t.owner, "alice.test");
  assert.equal(t.vault, "v1.nft.test");
  assert.equal((await get(app, "/nfts/999")).statusCode, 404);
});

test("history shows owners, what it earned and what it paid out", async () => {
  const { app, db } = await populated();
  ingest(db,
    block(20, ["nft.test", n171("nft_transfer", { old_owner_id: "alice.test", new_owner_id: "carol.test", token_ids: ["1"] })]),
    block(21, ["market.nft.test", q("sale", { nft: "nft.test", token_id: "1", buyer: "carol.test", seller: "alice.test", price: "900", pool_fee: "45", royalty: "0", seller_net: "855" })]),
    block(22, ["treasury.nft.test", q("treasury_claim", { token_id: "1", to: "carol.test", asset: "near", amount: "12" })]));
  const h = (await get(app, "/nfts/1/history")).json();
  assert.deepEqual(h.owners.map((o) => o.owner), ["alice.test", "carol.test"]);
  assert.equal(h.earned.length, 1); // the owner's deposit (the mint half is escrow, not a vault deposit)
  assert.deepEqual(h.paid_out.map((p) => p.kind), ["sale", "treasury_claim"]);
});

test("metadata endpoint serves dynamic traits and hides burned tokens", async () => {
  const { app, db } = await populated();
  const m = (await get(app, "/metadata/1.json")).json();
  assert.equal(m.title, "Quorum #1");
  assert.ok(m.attributes.some((a) => a.trait_type === "Vault near" && a.value === "250"));
  ingest(db, block(30, ["nft.test", n171("nft_burn", { owner_id: "alice.test", token_ids: ["1"] })]));
  assert.equal((await get(app, "/metadata/1.json")).statusCode, 404);
  assert.equal((await get(app, "/nfts")).json().total, 1);
});

test("market, dao and treasury endpoints", async () => {
  const { app, db } = await populated();
  const p = { id: 1, kind: "Text", proposer: "a.test", purpose: "Meetup", start_block: "5", voting_end_ms: "9", timelock_ms: "0", quorum_bps: 500, pass_bps: 5000, supply: "2" };
  ingest(db,
    block(40, ["dao.nft.test", q("proposal_created", { id: 1, proposal: p })]),
    block(41, ["dao.nft.test", q("vote", { proposal_id: 1, voter: "a.test", token_id: "1", choice: 1 })]),
    block(42, ["treasury.nft.test", q("treasury_donation", { from: "f.test", asset: "near", amount: "100", memo: null })]));
  assert.equal((await get(app, "/market/listings")).json().total, 1);
  assert.equal((await get(app, "/dao/proposals")).json().items[0].yes, 1);
  assert.equal((await get(app, "/dao/proposals/1")).json().kind, "Text");
  assert.equal((await get(app, "/dao/proposals/1/votes")).json().items.length, 1);
  const t = (await get(app, "/treasury")).json();
  assert.equal(t.inflows_by_source.donation.near, "100");
  assert.equal(t.inflows_by_source.mint["near"], "10000000");
});

// ------------------------------------------------------------------ auth

async function signIn(s, w, account) {
  const ch = (await post(s.app, "/auth/challenge")).json();
  const body = { accountId: account, publicKey: w.publicKey, nonce: ch.nonce,
    signature: w.sign({ message: ch.message, nonce: ch.nonce, recipient: cfg.appRecipient }) };
  return { ch, body, res: await post(s.app, "/auth/verify", body) };
}

test("a holder signs in with NEP-413 and reaches gated pages", async () => {
  const w = wallet();
  const s = await setup(chainStub(new Set(["alice.test"]), new Map([["alice.test", w.publicKey]])));
  ingest(s.db, mintBlock(10, "1", "alice.test"));
  const { res } = await signIn(s, w, "alice.test");
  assert.equal(res.statusCode, 200);
  const auth = { authorization: `Bearer ${res.json().token}` };
  assert.equal((await get(s.app, "/gated/me", auth)).json().tokens.length, 1);
  assert.equal((await get(s.app, "/gated/members", auth)).json().holder_count, 1);
});

test("gated routes reject missing, forged and expired sessions", async () => {
  const s = await setup(chainStub(new Set(["alice.test"])));
  assert.equal((await get(s.app, "/gated/members")).statusCode, 401);
  assert.equal((await get(s.app, "/gated/members", { authorization: "Bearer nope.nope" })).statusCode, 401);
  const forged = signSession("y".repeat(40), "alice.test", s.clock.t + 60_000);
  assert.equal((await get(s.app, "/gated/members", { authorization: `Bearer ${forged}` })).statusCode, 401);
  const good = signSession(cfg.sessionSecret, "alice.test", s.clock.t + 60_000);
  assert.equal((await get(s.app, "/gated/members", { authorization: `Bearer ${good}` })).statusCode, 200);
  s.clock.t += 120_000;
  assert.equal((await get(s.app, "/gated/members", { authorization: `Bearer ${good}` })).statusCode, 401);
});

test("selling or burning the last token revokes access on the very next request", async () => {
  const w = wallet();
  const chain = chainStub(new Set(["alice.test"]), new Map([["alice.test", w.publicKey]]));
  const s = await setup(chain);
  ingest(s.db, mintBlock(10, "1", "alice.test"));
  const { res } = await signIn(s, w, "alice.test");
  const auth = { authorization: `Bearer ${res.json().token}` };
  assert.equal((await get(s.app, "/gated/members", auth)).statusCode, 200);
  chain.holders.delete("alice.test"); // she sold it; final chain state no longer shows a token
  assert.equal((await get(s.app, "/gated/members", auth)).statusCode, 403);
});

test("non-holders cannot sign in, even with a valid signature", async () => {
  const w = wallet();
  const s = await setup(chainStub(new Set(), new Map([["mallory.test", w.publicKey]])));
  const { res } = await signIn(s, w, "mallory.test");
  assert.equal(res.statusCode, 403);
});

test("a signature from a key that is not on the account is rejected", async () => {
  const w = wallet(3), other = wallet(4);
  const s = await setup(chainStub(new Set(["alice.test"]), new Map([["alice.test", other.publicKey]])));
  const { res } = await signIn(s, w, "alice.test");
  assert.equal(res.statusCode, 401);
});

test("challenges are single use and bound to the message", async () => {
  const w = wallet();
  const s = await setup(chainStub(new Set(["alice.test"]), new Map([["alice.test", w.publicKey]])));
  const { body, res } = await signIn(s, w, "alice.test");
  assert.equal(res.statusCode, 200);
  assert.equal((await post(s.app, "/auth/verify", body)).statusCode, 401, "replay");
  const ch = (await post(s.app, "/auth/challenge")).json();
  const wrong = { accountId: "alice.test", publicKey: w.publicKey, nonce: ch.nonce,
    signature: w.sign({ message: "something else", nonce: ch.nonce, recipient: cfg.appRecipient }) };
  assert.equal((await post(s.app, "/auth/verify", wrong)).statusCode, 401, "wrong message");
  const wrongRecipient = { ...wrong, signature: w.sign({ message: ch.message, nonce: ch.nonce, recipient: "evil.site" }) };
  const ch2 = (await post(s.app, "/auth/challenge")).json();
  assert.equal((await post(s.app, "/auth/verify", { ...wrongRecipient, nonce: ch2.nonce })).statusCode, 401, "wrong recipient");
});

test("expired challenges are refused", async () => {
  const w = wallet();
  const s = await setup(chainStub(new Set(["alice.test"]), new Map([["alice.test", w.publicKey]])));
  const ch = (await post(s.app, "/auth/challenge")).json();
  s.clock.t += 6 * 60_000;
  const res = await post(s.app, "/auth/verify", { accountId: "alice.test", publicKey: w.publicKey, nonce: ch.nonce,
    signature: w.sign({ message: ch.message, nonce: ch.nonce, recipient: cfg.appRecipient }) });
  assert.equal(res.statusCode, 401);
});

test("NEP-413 hash layout: tag, borsh strings, no callback", () => {
  const h = signedHash({ message: "hi", nonce: Buffer.alloc(32, 1), recipient: "r", callbackUrl: undefined });
  assert.equal(h.length, 32);
  const w = wallet();
  const nonce = Buffer.alloc(32, 9);
  const sig = w.sign({ message: "hi", nonce: nonce.toString("base64"), recipient: "r" });
  assert.ok(verifyNep413({ message: "hi", nonce, recipient: "r", publicKey: w.publicKey, signature: sig }));
  assert.ok(!verifyNep413({ message: "ho", nonce, recipient: "r", publicKey: w.publicKey, signature: sig }));
});

test("session tokens round-trip and reject tampering", () => {
  const t = signSession("s".repeat(40), "a.test", 5000);
  assert.equal(readSession("s".repeat(40), t, 1000), "a.test");
  assert.equal(readSession("s".repeat(40), t, 6000), null);
  assert.equal(readSession("s".repeat(40), t.replace(/.$/, "x"), 1000), null);
});

test("GET /settlement shows each group's phase and which NFTs still need crediting", async () => {
  const { app, db } = await populated();
  ingest(db,
    block(30, ["nft.test", q("settle_started", { group: 0, asset: "usdc.test", near_in: "10000000", min_out: "9" })]),
    block(31, ["nft.test", q("swap_done", { group: 0, asset: "usdc.test", near_in: "10000000", out: "4000" })]),
    block(32, ["nft.test", q("credited", { token_id: "1", amount: "2000" })]));
  const g = (await get(app, "/settlement")).json().groups[0];
  assert.deepEqual([g.phase, g.tokens, g.uncredited], ["Swapped", 2, ["2"]]);
});

test("GET /mint/proof returns a presale proof only for allowlisted accounts", async () => {
  const fs = await import("node:fs");
  fs.writeFileSync(cfg.allowlistsFile, JSON.stringify({ "0": ["alice.test", "bob.test", "carol.test"] }));
  const { app } = await setup();
  const ok = await get(app, "/mint/proof?stage=0&account=alice.test");
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.json().proof.length >= 1);
  assert.equal((await get(app, "/mint/proof?stage=0&account=mallory.test")).statusCode, 403);
  assert.deepEqual((await get(app, "/mint/proof?stage=1&account=anyone.test")).json().proof, [], "public stages need no proof");
});
