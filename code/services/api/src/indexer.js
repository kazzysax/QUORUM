// Reads FINAL blocks from a neardata-compatible endpoint, one block per
// transaction, with a resumable cursor. NEAR Lake was retired on 2026-03-24;
// neardata is its documented replacement.
import { applyEvent, eventsFromBlock } from "./events.js";
import { getCursor, setCursor, tx } from "./db.js";

export function makeWatch(cfg) {
  const fixed = new Set([cfg.collection, cfg.dao, cfg.treasury, cfg.market].filter(Boolean));
  // Vault accounts are `v<token_id>.<collection>`.
  return (account) => fixed.has(account) || account.endsWith(`.${cfg.collection}`);
}

/** Indexes heights (from, to] using `fetchBlock(height) -> block | null`. Returns blocks with events. */
export async function indexRange(db, fetchBlock, from, to, watch) {
  let withEvents = 0;
  for (let h = from + 1; h <= to; h++) {
    const block = await fetchBlock(h); // null = skipped height
    tx(db, () => {
      if (block) {
        const events = eventsFromBlock(block, watch);
        for (const e of events) applyEvent(db, e);
        if (events.length) withEvents++;
      }
      setCursor(db, h);
    });
  }
  return withEvents;
}

export function neardataClient(baseUrl, fetchImpl = fetch) {
  const get = async (path) => {
    const r = await fetchImpl(baseUrl + path, { redirect: "follow" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`neardata ${path}: ${r.status}`);
    return r.json();
  };
  return {
    block: (h) => get(`/v0/block/${h}`),
    async finalHeight() {
      const b = await get("/v0/last_block/final");
      return b?.block?.header?.height ?? null;
    },
  };
}

export async function runIndexer(db, cfg, client = neardataClient(cfg.neardataUrl), log = console.log) {
  const watch = makeWatch(cfg);
  let cursor = getCursor(db);
  if (cursor === null) {
    cursor = cfg.startHeight ?? (await client.finalHeight()) - 1;
    setCursor(db, cursor);
  }
  for (;;) {
    try {
      const tip = await client.finalHeight();
      if (tip && tip > cursor) {
        const to = Math.min(tip, cursor + 200);
        const n = await indexRange(db, client.block, cursor, to, watch);
        cursor = to;
        if (n) log(`indexed to ${to} (${n} blocks with events)`);
        if (to < tip) continue;
      }
    } catch (e) {
      log("indexer error, retrying:", e.message);
    }
    await new Promise((r) => setTimeout(r, cfg.pollMs ?? 1000));
  }
}
