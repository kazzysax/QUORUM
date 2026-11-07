// Turns contract logs into rows. Every contract in this repo emits
// `EVENT_JSON:{standard, event, data:[...]}` (NEP-297); this file is the only
// place that knows what each event means.
import { big } from "./db.js";

const PREFIX = "EVENT_JSON:";

/** Extracts NEP-297 events from one neardata block, for the watched contracts. */
export function eventsFromBlock(block, watch) {
  const height = block?.block?.header?.height;
  const out = [];
  for (const shard of block?.shards ?? []) {
    for (const o of shard.receipt_execution_outcomes ?? []) {
      const status = o.execution_outcome?.outcome?.status;
      if (status && typeof status === "object" && "Failure" in status) continue; // failed receipts change nothing
      const contract = o.receipt?.receiver_id;
      if (!contract || !watch(contract)) continue;
      const receiptId = o.receipt?.receipt_id || o.execution_outcome?.id;
      (o.execution_outcome?.outcome?.logs ?? []).forEach((log, i) => {
        if (!log.startsWith(PREFIX)) return;
        let parsed;
        try { parsed = JSON.parse(log.slice(PREFIX.length)); } catch { return; }
        for (const d of parsed.data ?? []) {
          out.push({ receiptId, idx: i, block: height, contract, standard: parsed.standard, name: parsed.event, data: d });
        }
      });
    }
  }
  return out;
}

const tokenIdOf = (e) => e.data.token_id ?? (e.data.token_ids?.length === 1 ? e.data.token_ids[0] : null) ?? null;

/** Applies one event. Returns false if it was already applied. */
export function applyEvent(db, e) {
  const ins = db.prepare("INSERT OR IGNORE INTO events(receipt_id,idx,block,contract,name,token_id,data) VALUES (?,?,?,?,?,?,?)")
    .run(e.receiptId, e.idx, e.block, e.contract, e.name, tokenIdOf(e), JSON.stringify(e.data));
  if (ins.changes === 0) return false;
  const d = e.data;
  const nep171 = e.standard === "nep171";

  if (nep171 && e.name === "nft_mint") {
    for (const id of d.token_ids) {
      db.prepare("INSERT OR IGNORE INTO tokens(token_id,owner,minted_block,last_transfer_block) VALUES (?,?,?,?)").run(id, d.owner_id, e.block, e.block);
    }
  } else if (nep171 && e.name === "nft_transfer") {
    for (const id of d.token_ids) {
      db.prepare("UPDATE tokens SET owner=?, last_transfer_block=? WHERE token_id=? AND burned_block IS NULL").run(d.new_owner_id, e.block, id);
    }
  } else if (nep171 && e.name === "nft_burn") {
    for (const id of d.token_ids) db.prepare("UPDATE tokens SET burned_block=? WHERE token_id=?").run(e.block, id);
  } else if (e.name === "mint") {
    db.prepare("UPDATE tokens SET vault=?, mint_price=?, asset=?, escrow_share=? WHERE token_id=?").run(d.vault, d.price, d.asset, d.escrow_share, d.token_id);
    // The treasury's half arrives in NEAR at mint; the other half is escrow until settlement.
    flow(db, e, "in", "mint", "near", d.pool_share, d.buyer, `token ${d.token_id}`);
    const g = db.prepare("SELECT idx FROM settlement_groups WHERE asset=?").get(d.asset);
    if (!g) db.prepare("INSERT INTO settlement_groups(idx, asset) VALUES ((SELECT COUNT(*) FROM settlement_groups), ?)").run(d.asset);
  } else if (e.name === "vault_deposit") {
    const cur = db.prepare("SELECT amount FROM vault_balances WHERE token_id=? AND asset=?").get(d.token_id, d.asset);
    db.prepare("INSERT INTO vault_balances(token_id,asset,amount) VALUES (?,?,?) ON CONFLICT(token_id,asset) DO UPDATE SET amount=excluded.amount")
      .run(d.token_id, d.asset, big(cur?.amount, d.amount));
  } else if (e.name === "vault_redeem_started") {
    db.prepare("DELETE FROM vault_balances WHERE token_id=?").run(d.token_id);
  } else if (e.name === "burn") {
    db.prepare("UPDATE tokens SET burned_block=? WHERE token_id=?").run(e.block, d.token_id);
  } else if (e.name === "escrow_refund") {
    flow(db, e, "in", "redemption", "near", d.to_pool, d.token_id, "10% of an escrow burn");
  } else if (e.name === "settle_started") {
    db.prepare("INSERT INTO settlement_groups(idx, asset, phase, near_in, block) VALUES (?,?,'Swapping',?,?) ON CONFLICT(idx) DO UPDATE SET phase='Swapping', near_in=excluded.near_in, block=excluded.block")
      .run(d.group, d.asset, d.near_in, e.block);
  } else if (e.name === "swap_failed") {
    db.prepare("UPDATE settlement_groups SET phase='Pending' WHERE idx=?").run(d.group);
  } else if (e.name === "swap_done") {
    db.prepare("UPDATE settlement_groups SET phase='Swapped', out_total=?, near_in=?, block=? WHERE idx=?").run(d.out, d.near_in, e.block, d.group);
  } else if (e.name === "fallback_enabled") {
    db.prepare("UPDATE settlement_groups SET phase='Fallback', block=? WHERE idx=?").run(e.block, d.group);
  } else if (e.name === "credited") {
    db.prepare("UPDATE tokens SET credited=1 WHERE token_id=?").run(d.token_id);
  } else if (e.name === "credit_failed") {
    db.prepare("UPDATE tokens SET credited=0 WHERE token_id=?").run(d.token_id);
  } else if (e.name === "treasury_swap_started" || e.name === "treasury_swap_done") {
    // recorded in the events table; the treasury's live balances are read from the chain
  } else if (e.name === "vault_payout" && d.payee === "Pool") {
    flow(db, e, "in", "redemption", d.asset, d.amount, d.token_id, "10% of burn");
  } else if (e.name === "listed") {
    db.prepare("INSERT INTO listings(nft,token_id,seller,price,approval_id,block) VALUES (?,?,?,?,?,?) ON CONFLICT(nft,token_id) DO UPDATE SET seller=excluded.seller, price=excluded.price, approval_id=excluded.approval_id, block=excluded.block")
      .run(d.nft, d.token_id, d.listing.seller, d.listing.price, d.listing.approval_id, e.block);
  } else if (e.name === "price_updated") {
    db.prepare("UPDATE listings SET price=? WHERE nft=? AND token_id=?").run(d.price, d.nft, d.token_id);
  } else if (e.name === "cancelled") {
    db.prepare("DELETE FROM listings WHERE nft=? AND token_id=?").run(d.nft, d.token_id);
  } else if (e.name === "sale") {
    db.prepare("DELETE FROM listings WHERE nft=? AND token_id=?").run(d.nft, d.token_id);
    db.prepare("INSERT OR IGNORE INTO sales VALUES (?,?,?,?,?,?,?,?,?)").run(e.receiptId, e.block, d.token_id, d.buyer, d.seller, d.price, d.pool_fee, d.royalty, d.seller_net);
    flow(db, e, "in", "sale_fee", "near", d.pool_fee, d.seller, `token ${d.token_id}`);
  } else if (e.name === "proposal_created") {
    const p = d.proposal;
    db.prepare("INSERT OR IGNORE INTO proposals(id,kind,proposer,purpose,start_block,voting_end_ms,timelock_ms,quorum_bps,pass_bps,supply,raw) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .run(p.id, JSON.stringify(p.kind), p.proposer, p.purpose, Number(p.start_block), p.voting_end_ms, p.timelock_ms, p.quorum_bps, p.pass_bps, p.supply, JSON.stringify(p));
  } else if (e.name === "vote") {
    const r = db.prepare("INSERT OR IGNORE INTO votes VALUES (?,?,?,?,?)").run(d.proposal_id, d.token_id, d.voter, d.choice, e.block);
    if (r.changes) {
      const col = d.choice === 1 ? "yes" : d.choice === 0 ? "no" : "abstain";
      db.prepare(`UPDATE proposals SET ${col}=${col}+1 WHERE id=?`).run(d.proposal_id);
    }
  } else if (e.name === "proposal_executed") {
    db.prepare("UPDATE proposals SET executed=1 WHERE id=?").run(d.id);
  } else if (e.name === "proposal_execution_failed") {
    db.prepare("UPDATE proposals SET executed=0 WHERE id=?").run(d.id);
  } else if (e.name === "treasury_donation") {
    flow(db, e, "in", "donation", d.asset, d.amount, d.from, d.memo);
  } else if (e.name === "treasury_spend") {
    flow(db, e, "out", "spend", d.asset, d.amount, d.recipient, d.purpose);
  } else if (e.name === "treasury_distribution") {
    db.prepare("INSERT OR IGNORE INTO distributions(receipt_id,idx,block,asset,amount,per_token_e24,live_supply) VALUES (?,?,?,?,?,?,?)")
      .run(e.receiptId, e.idx, e.block, d.asset, d.amount, d.per_token_e24, d.live_supply);
  } else if (e.name === "treasury_claim") {
    flow(db, e, "out", "claim", d.asset, d.amount, d.to, `token ${d.token_id}`);
  }
  return true;
}

function flow(db, e, direction, kind, asset, amount, counterparty, note) {
  db.prepare("INSERT OR IGNORE INTO treasury_flows(receipt_id,idx,block,direction,kind,asset,amount,counterparty,note) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(e.receiptId, e.idx, e.block, direction, kind, asset, String(amount ?? "0"), counterparty ?? null, note ?? null);
}
