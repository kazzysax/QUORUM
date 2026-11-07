import Fastify from "fastify";
import cors from "@fastify/cors";
import fs from "node:fs";
import { createChallenge, login, readSession } from "./auth.js";
import { buildTree, toBase64 } from "./merkle.js";

const page = (q) => ({
  from: Math.max(0, parseInt(q.from ?? "0", 10) || 0),
  limit: Math.min(100, Math.max(1, parseInt(q.limit ?? "24", 10) || 24)),
});

const sumBy = (rows, key = "asset") => {
  const m = {};
  for (const r of rows) m[r[key]] = (BigInt(m[r[key]] ?? "0") + BigInt(r.amount)).toString();
  return m;
};

export async function buildApp({ db, chain, cfg, now = () => Date.now() }) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: cfg.corsOrigin ?? true });
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const one = (sql, ...p) => db.prepare(sql).get(...p);

  const tokenView = (t) => {
    const listing = one("SELECT price, approval_id, seller FROM listings WHERE token_id=?", t.token_id);
    const balances = all("SELECT asset, amount FROM vault_balances WHERE token_id=?", t.token_id);
    return {
      token_id: t.token_id, owner: t.owner, vault: t.vault, burned: t.burned_block !== null,
      minted_block: t.minted_block, last_transfer_block: t.last_transfer_block, mint_price: t.mint_price,
      media: `${cfg.mediaBaseUrl}/${t.token_id}`,
      asset: t.asset ?? null, escrow_share: t.escrow_share ?? null, credited: !!t.credited,
      vault_balances: Object.fromEntries(balances.map((b) => [b.asset, b.amount])),
      listing: listing ?? null,
    };
  };

  app.get("/health", async () => ({ ok: true, cursor: one("SELECT height FROM cursor WHERE id=1")?.height ?? null }));

  // ------------------------------------------------------------------ NFTs
  app.get("/nfts", async (req) => {
    const { from, limit } = page(req.query);
    const where = ["burned_block IS NULL"]; const args = [];
    if (req.query.owner) { where.push("owner=?"); args.push(req.query.owner); }
    if (req.query.listed === "true") where.push("token_id IN (SELECT token_id FROM listings)");
    const total = one(`SELECT COUNT(*) c FROM tokens WHERE ${where.join(" AND ")}`, ...args).c;
    const rows = all(`SELECT * FROM tokens WHERE ${where.join(" AND ")} ORDER BY CAST(token_id AS INTEGER) LIMIT ? OFFSET ?`, ...args, limit, from);
    return { total, items: rows.map(tokenView) };
  });

  app.get("/nfts/:id", async (req, reply) => {
    const t = one("SELECT * FROM tokens WHERE token_id=?", req.params.id);
    if (!t) return reply.code(404).send({ error: "not found" });
    const votes = one("SELECT COUNT(*) c FROM votes WHERE token_id=?", t.token_id).c;
    return { ...tokenView(t), votes_cast: votes };
  });

  // F4 / track brief: what it earned, what it paid out, who held it.
  app.get("/nfts/:id/history", async (req, reply) => {
    const id = req.params.id;
    if (!one("SELECT 1 x FROM tokens WHERE token_id=?", id)) return reply.code(404).send({ error: "not found" });
    const events = all("SELECT block, contract, name, data, receipt_id FROM events WHERE token_id=? ORDER BY block, idx", id)
      .map((e) => ({ block: e.block, event: e.name, contract: e.contract, receipt_id: e.receipt_id, data: JSON.parse(e.data) }));
    const owners = [];
    for (const e of events) {
      if (e.event === "nft_mint") owners.push({ owner: e.data.owner_id, since_block: e.block });
      if (e.event === "nft_transfer") owners.push({ owner: e.data.new_owner_id, since_block: e.block });
    }
    const earned = events.filter((e) => e.event === "vault_deposit").map((e) => ({ block: e.block, asset: e.data.asset, amount: e.data.amount, from: e.data.from }));
    const paidOut = events
      .filter((e) => ["vault_payout", "treasury_claim", "sale"].includes(e.event))
      .map((e) => ({ block: e.block, kind: e.event, data: e.data }));
    return { owners, earned, paid_out: paidOut, events };
  });

  // NEP-177 `reference` target: dynamic traits for wallets and explorers (F4).
  app.get("/metadata/:file", async (req, reply) => {
    const id = req.params.file.replace(/\.json$/, "");
    const t = one("SELECT * FROM tokens WHERE token_id=?", id);
    if (!t || t.burned_block !== null) return reply.code(404).send({ error: "not found" });
    const balances = all("SELECT asset, amount FROM vault_balances WHERE token_id=?", id);
    const dists = one("SELECT COUNT(*) c FROM distributions WHERE block >= ?", t.minted_block).c;
    const votes = one("SELECT COUNT(*) c FROM votes WHERE token_id=?", id).c;
    const deposits = one("SELECT COUNT(*) c FROM events WHERE token_id=? AND name='vault_deposit'", id).c;
    return {
      title: `${cfg.name ?? "Quorum"} #${id}`,
      description: "Art, a vault and a vote.",
      media: `${cfg.mediaBaseUrl}/${id}`,
      attributes: [
        ...balances.map((b) => ({ trait_type: `Vault ${b.asset}`, value: b.amount })),
        { trait_type: "Asset", value: t.asset ?? "" },
        { trait_type: "Escrow (NEAR)", value: t.escrow_share ?? "0" },
        { trait_type: "Settled", value: t.credited ? "yes" : "no" },
        { trait_type: "Vault deposits", value: deposits },
        { trait_type: "Votes cast", value: votes },
        { trait_type: "Distributions received", value: dists },
        { trait_type: "Vault account", value: t.vault ?? "" },
      ],
    };
  });

  // ------------------------------------------------------------ settlement
  // Groups, their phase, and which NFTs still need `credit_batch` (3 per transaction).
  app.get("/settlement", async () => {
    const groups = all("SELECT * FROM settlement_groups ORDER BY idx");
    const out = groups.map((g) => ({
      ...g,
      tokens: one("SELECT COUNT(*) c FROM tokens WHERE asset=? AND burned_block IS NULL", g.asset).c,
      uncredited: all("SELECT token_id FROM tokens WHERE asset=? AND burned_block IS NULL AND credited=0 ORDER BY CAST(token_id AS INTEGER)", g.asset).map((r) => r.token_id),
    }));
    return { groups: out };
  });

  // Presale allowlist proof for the connected account (the contract verifies it).
  const lists = cfg.allowlistsFile && fs.existsSync(cfg.allowlistsFile)
    ? Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(cfg.allowlistsFile, "utf8"))).map(([s, a]) => [s, buildTree(a)])) : {};
  app.get("/mint/proof", async (req, reply) => {
    const { stage, account } = req.query;
    const tree = lists[stage];
    if (!tree) return { proof: [] }; // not a presale stage: no proof needed
    if (!tree.proofs[account]) return reply.code(403).send({ error: "not on the allowlist for this stage" });
    return { proof: tree.proofs[account].map(toBase64) };
  });

  // ---------------------------------------------------------------- market
  app.get("/market/listings", async (req) => {
    const { from, limit } = page(req.query);
    const items = all("SELECT * FROM listings ORDER BY CAST(price AS REAL) LIMIT ? OFFSET ?", limit, from);
    return { total: one("SELECT COUNT(*) c FROM listings").c, items };
  });
  app.get("/market/sales", async (req) => {
    const { from, limit } = page(req.query);
    return { total: one("SELECT COUNT(*) c FROM sales").c, items: all("SELECT * FROM sales ORDER BY block DESC LIMIT ? OFFSET ?", limit, from) };
  });

  // ------------------------------------------------------------------- DAO
  const proposalView = (p) => ({ ...p, kind: JSON.parse(p.kind), raw: undefined, executed: !!p.executed });
  app.get("/dao/proposals", async (req) => {
    const { from, limit } = page(req.query);
    return { total: one("SELECT COUNT(*) c FROM proposals").c, items: all("SELECT * FROM proposals ORDER BY id DESC LIMIT ? OFFSET ?", limit, from).map(proposalView) };
  });
  app.get("/dao/proposals/:id", async (req, reply) => {
    const p = one("SELECT * FROM proposals WHERE id=?", req.params.id);
    return p ? proposalView(p) : reply.code(404).send({ error: "not found" });
  });
  app.get("/dao/proposals/:id/votes", async (req) =>
    ({ items: all("SELECT token_id, voter, choice, block FROM votes WHERE proposal_id=? ORDER BY block", req.params.id) }));

  // -------------------------------------------------------------- treasury
  app.get("/treasury", async () => {
    const flows = all("SELECT * FROM treasury_flows ORDER BY block DESC LIMIT 100");
    const inflows = all("SELECT kind, asset, amount FROM treasury_flows WHERE direction='in'");
    const outflows = all("SELECT asset, amount FROM treasury_flows WHERE direction='out'");
    const byKind = {};
    for (const r of inflows) {
      byKind[r.kind] ??= {};
      byKind[r.kind][r.asset] = (BigInt(byKind[r.kind][r.asset] ?? "0") + BigInt(r.amount)).toString();
    }
    return {
      inflows_by_source: byKind, total_in: sumBy(inflows), total_out: sumBy(outflows),
      distributions: all("SELECT * FROM distributions ORDER BY block DESC LIMIT 50"),
      recent_flows: flows,
    };
  });

  // ------------------------------------------------------------------ auth
  app.post("/auth/challenge", async () => createChallenge(db, now()));
  app.post("/auth/verify", async (req, reply) => {
    const b = req.body ?? {};
    if (!b.accountId || !b.publicKey || !b.signature || !b.nonce) return reply.code(400).send({ error: "accountId, publicKey, signature and nonce are required" });
    let res;
    try { res = await login({ db, chain, cfg, now: now() }, b); }
    catch (e) { return reply.code(502).send({ error: "chain unavailable" }); }
    return res.error ? reply.code(res.status).send({ error: res.error }) : res;
  });

  // ----------------------------------------------------------------- gated
  const holdCache = new Map(); // account -> { holds, at }
  async function stillHolds(account) {
    const hit = holdCache.get(account);
    if (hit && now() - hit.at < (cfg.holdCacheMs ?? 20_000)) return hit.holds;
    const holds = await chain.holdsToken(account);
    holdCache.set(account, { holds, at: now() });
    return holds;
  }
  app.addHook("preHandler", async (req, reply) => {
    if (!req.url.startsWith("/gated")) return;
    const account = readSession(cfg.sessionSecret, (req.headers.authorization ?? "").replace(/^Bearer /, ""), now());
    if (!account) return reply.code(401).send({ error: "sign in first" });
    let holds;
    try { holds = await stillHolds(account); } catch { return reply.code(502).send({ error: "chain unavailable" }); }
    if (!holds) return reply.code(403).send({ error: "no longer a holder" });
    req.account = account;
  });
  app.get("/gated/me", async (req) => ({
    account: req.account, tokens: all("SELECT * FROM tokens WHERE owner=? AND burned_block IS NULL ORDER BY CAST(token_id AS INTEGER)", req.account).map(tokenView),
  }));
  app.get("/gated/members", async (req) => {
    const holders = all("SELECT owner, COUNT(*) tokens FROM tokens WHERE burned_block IS NULL GROUP BY owner ORDER BY tokens DESC");
    return { you: req.account, holder_count: holders.length, holders };
  });
  app.get("/gated/events", async () => ({
    items: all("SELECT id, purpose, voting_end_ms, executed FROM proposals WHERE kind LIKE '%Text%' OR kind='\"Text\"' ORDER BY id DESC").map((p) => ({ ...p, executed: !!p.executed })),
  }));

  return app;
}
