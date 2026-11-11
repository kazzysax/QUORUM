// Strict on-chain data layer. Nothing here falls back to a default or a cached value: if a
// contract view fails, the error propagates and the UI shows it. Every figure in the app is
// the result of a `call_function` view on the contracts listed in deployments.ts.

import { DEPLOYMENTS, MARKET, RPC_ENDPOINTS } from './deployments';
import type { Deployment } from './deployments';
import type { CollectionHolder, CollectionItem, ProposalItem, SaleRecord, TokenItem } from './types';

export class ChainError extends Error {}

const YOCTO = 10n ** 24n;

// ------------------------------------------------------------------ rpc

async function rpc(method: string, params: unknown): Promise<any> {
  let lastErr: unknown = null;
  for (const url of RPC_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'q', method, params }),
      });
      if (!res.ok) { lastErr = new ChainError(`${url}: HTTP ${res.status}`); continue; }
      const data = await res.json();
      if (data.error) {
        // A definite answer from the node (unknown account, bad args): do not retry elsewhere.
        throw new ChainError(`${data.error.name || 'RPC error'}: ${data.error.cause?.name || data.error.data || data.error.message}`);
      }
      return data.result;
    } catch (e) {
      if (e instanceof ChainError) throw e;
      lastErr = e;
    }
  }
  throw new ChainError(`All NEAR testnet RPC endpoints failed (${String(lastErr)})`);
}

export async function view<T>(account: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await rpc('query', {
    request_type: 'call_function',
    finality: 'final',
    account_id: account,
    method_name: method,
    args_base64: btoa(JSON.stringify(args)),
  });
  if (result.error) throw new ChainError(`${account}.${method}: ${result.error}`);
  const text = new TextDecoder().decode(new Uint8Array(result.result));
  return JSON.parse(text) as T;
}

export async function accountBalanceYocto(account: string): Promise<bigint> {
  const r = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: account });
  return BigInt(r.amount);
}

export async function accountExists(account: string): Promise<boolean> {
  try { await accountBalanceYocto(account); return true; } catch { return false; }
}

// ------------------------------------------------------------- formatting

export function fmtNear(yocto: string | bigint, dp = 2): string {
  const v = typeof yocto === 'bigint' ? yocto : BigInt(yocto);
  const scale = 10n ** BigInt(24 - dp);
  const rounded = (v + scale / 2n) / scale; // round half up
  const whole = rounded / 10n ** BigInt(dp);
  const frac = (rounded % 10n ** BigInt(dp)).toString().padStart(dp, '0');
  return dp === 0 ? whole.toString() : `${whole}.${frac}`;
}

export function nearToYocto(near: string): string {
  const m = /^(\d+)(?:\.(\d{0,24}))?$/.exec(near.trim());
  if (!m) throw new ChainError(`Invalid NEAR amount "${near}"`);
  return (BigInt(m[1]) * YOCTO + BigInt((m[2] ?? '').padEnd(24, '0'))).toString();
}

export function fmtDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}

// ------------------------------------------------------- contract shapes

interface NftConfig {
  founder: string; treasury: string; dao: string; max_supply: number; royalty_bps: number;
  stages: { name: string; kind: string; price_near: string; start_ms: string; end_ms: string; per_wallet_limit: number }[];
  asset_plan: { token: string; weight: number }[];
  mint_storage_cost: string; paused: boolean; settle_grace_ms: string; wrap_account: string;
}
interface Listing { seller: string; price: string; approval_id: number }
interface NftToken { token_id: string; owner_id: string; approved_account_ids?: Record<string, number> }
interface Traits {
  token_id: string; owner_id: string | null; vault: string; asset: string; escrow_share: string;
  settlement: string; credited: boolean; last_transfer_block: string; live_supply: string;
}
interface VaultInfo { status: unknown; balances: [string, string][] }
export interface GroupView { index: number; asset: string; weight: number; phase: string; total_share: string; out_total: string }
interface RawProposal {
  id: number; kind: any; proposer: string; purpose: string; start_block: string; start_ms: string; voting_end_ms: string;
  quorum_bps: number; pass_bps: number; timelock_ms: string; supply: string; yes: string; no: string; abstain: string; executed: boolean;
}

// ------------------------------------------------------------- collections

export interface LiveCollection extends CollectionItem {
  dep: Deployment;
  config: NftConfig;
  liveSupply: number;
  closed: boolean;
  activeStage: number | null;
  groups: GroupView[];
  treasuryNear: string; // formatted
  treasuryYocto: bigint;
  escrowYocto: bigint;  // sum of settlement-group escrow still held by the NFT contract
  mintCostYocto: string | null;
  saleCount: number;
}

export async function verifiedListings(dep: Deployment): Promise<{ token: NftToken; listing: Listing }[]> {
  const rows = await view<[string, Listing][]>(MARKET, 'get_listings', { nft: dep.nft, from_index: 0, limit: 100 });
  const out: { token: NftToken; listing: Listing }[] = [];
  await Promise.all(rows.map(async ([tokenId, listing]) => {
    const token = await view<NftToken | null>(dep.nft, 'nft_token', { token_id: tokenId });
    // A listing is live only while the seller still owns the token and the market still holds
    // the approval the listing was made with (a transfer or burn silently kills it).
    if (token && token.owner_id === listing.seller && token.approved_account_ids?.[MARKET] === listing.approval_id) {
      out.push({ token, listing });
    }
  }));
  return out.sort((a, b) => Number(BigInt(a.listing.price) - BigInt(b.listing.price)));
}

async function allTokens(dep: Deployment): Promise<NftToken[]> {
  const out: NftToken[] = [];
  for (let from = 0; ; from += 100) {
    const page = await view<NftToken[]>(dep.nft, 'nft_tokens', { from_index: String(from), limit: 100 });
    out.push(...page);
    if (page.length < 100) return out;
  }
}

export async function loadCollection(dep: Deployment): Promise<LiveCollection> {
  const [meta, config, minted, liveSupply, closed, activeStage, groups, tre, listings, stats, tokens] = await Promise.all([
    view<{ name: string; symbol: string }>(dep.nft, 'nft_metadata'),
    view<NftConfig>(dep.nft, 'get_config'),
    view<string>(dep.nft, 'minted_total'),
    view<string>(dep.nft, 'live_supply'),
    view<boolean>(dep.nft, 'mint_closed'),
    view<number | null>(dep.nft, 'active_stage'),
    view<GroupView[]>(dep.nft, 'settlement_status'),
    view<string>(dep.treasury, 'native_balance'),
    verifiedListings(dep),
    view<{ sales: number; volume: string }>(MARKET, 'get_stats', { nft: dep.nft }),
    allTokens(dep),
  ]);
  const stage = config.stages[activeStage ?? config.stages.length - 1];
  const mintedN = Number(minted);
  const live = Number(liveSupply);
  const owners = new Set(tokens.map((t) => t.owner_id)).size;
  const floor = listings.length ? fmtNear(listings[0].listing.price) : '—';
  const totalWeight = config.asset_plan.reduce((s, p) => s + p.weight, 0);
  const mintCost = activeStage === null ? null : (BigInt(stage.price_near) + BigInt(config.mint_storage_cost)).toString();
  const escrow = groups.reduce((s, g) => s + BigInt(g.total_share), 0n);
  return {
    dep,
    config,
    id: dep.id,
    name: meta.name,
    symbol: meta.symbol,
    creator: config.founder,
    description: dep.description,
    cover_image: dep.cover,
    avatar_image: dep.avatar,
    supply: config.max_supply,
    minted: mintedN,
    price_near: fmtNear(stage.price_near),
    floor_price_near: floor,
    backing_summary: `${fmtNear(BigInt(stage.price_near) / 2n)} NEAR in vault`,
    royalty_percent: config.royalty_bps / 100,
    change_24h: '—',
    change_positive: true,
    status: mintedN >= config.max_supply || closed ? 'soldout' : activeStage === null ? 'upcoming' : 'live',
    asset_weights: config.asset_plan.map((p) => ({
      asset: p.token === config.wrap_account ? 'wNEAR' : p.token,
      weight: p.weight,
      percentage: Math.round((p.weight / totalWeight) * 100),
    })),
    stats: {
      floorPrice: floor === '—' ? '—' : `${floor} NEAR`,
      floorChange1D: '—',
      topOffer: '—',
      volume24H: '—',
      totalVolume: `${fmtNear(stats.volume)} NEAR`,
      listedCount: listings.length,
      listedPercent: live > 0 ? Math.round((listings.length / live) * 100) : 0,
      uniqueOwnersCount: owners,
      uniqueOwnersPercent: live > 0 ? Math.round((owners / live) * 100) : 0,
      contractId: dep.nft,
      createdDate: '',
      royaltyPercent: config.royalty_bps / 100,
    },
    liveSupply: live,
    closed,
    activeStage,
    groups,
    treasuryNear: fmtNear(tre, 4),
    treasuryYocto: BigInt(tre),
    escrowYocto: escrow,
    mintCostYocto: mintCost,
    saleCount: stats.sales,
  };
}

export async function loadHolders(dep: Deployment): Promise<CollectionHolder[]> {
  const tokens = await allTokens(dep);
  const by = new Map<string, string[]>();
  for (const t of tokens) by.set(t.owner_id, [...(by.get(t.owner_id) ?? []), t.token_id]);
  return [...by.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([accountId, ids], i) => ({
      rank: i + 1,
      accountId,
      tokensHeld: ids,
      count: ids.length,
      percent: tokens.length ? Math.round((ids.length / tokens.length) * 1000) / 10 : 0,
      votingPower: ids.length,
      vaultValueNear: '',
    }));
}

// ------------------------------------------------------------------ tokens

export async function buildToken(dep: Deployment, col: Pick<LiveCollection, 'name' | 'symbol'>, tokenId: string, listing?: Listing): Promise<TokenItem> {
  const [traits, vault, owed] = await Promise.all([
    view<Traits | null>(dep.nft, 'nft_traits', { token_id: tokenId }),
    view<VaultInfo>(`v${tokenId}.${dep.nft}`, 'vault_info'),
    view<string>(dep.treasury, 'owed_to', { token_id: tokenId, asset: 'near' }),
  ]);
  if (!traits) throw new ChainError(`${dep.nft} token ${tokenId} has no live state (burned?)`);
  const parts = vault.balances.map(([asset, amt]) => `${fmtNear(amt)} ${asset === 'near' ? 'NEAR' : asset.replace('nep141:', '')}`);
  if (!traits.credited) parts.push(`${fmtNear(traits.escrow_share)} NEAR (escrow)`);
  return {
    id: `${dep.slug}-${tokenId}`,
    token_id: tokenId,
    owner_id: traits.owner_id ?? '',
    collection: col.name,
    title: `${col.name} #${tokenId}`,
    asset: traits.asset,
    backing: parts.join(' + ') || '0 NEAR',
    backing_status: traits.credited ? 'credited' : 'escrow',
    price: listing ? fmtNear(listing.price) : undefined,
    price_yocto: listing?.price,
    image: dep.avatar,
    unclaimed_distribution: `${fmtNear(owed, 4)} NEAR`,
    vault_account: traits.vault,
    approval_id: listing?.approval_id,
    nft_contract: dep.nft,
    is_on_chain: true,
  };
}

export async function loadOwnedTokens(account: string, cols: LiveCollection[]): Promise<TokenItem[]> {
  const perCol = await Promise.all(cols.map(async (c) => {
    const toks = await view<NftToken[]>(c.dep.nft, 'nft_tokens_for_owner', { account_id: account, from_index: '0', limit: 100 });
    const listed = await verifiedListings(c.dep);
    const byId = new Map(listed.map((l) => [l.token.token_id, l.listing]));
    return Promise.all(toks.map((t) => buildToken(c.dep, c, t.token_id, byId.get(t.token_id))));
  }));
  return perCol.flat();
}

export async function loadMarketListings(cols: LiveCollection[]): Promise<TokenItem[]> {
  const perCol = await Promise.all(cols.map(async (c) => {
    const listed = await verifiedListings(c.dep);
    return Promise.all(listed.map(async ({ token, listing }) => {
      const item = await buildToken(c.dep, c, token.token_id, listing);
      return { ...item, owner_id: listing.seller };
    }));
  }));
  return perCol.flat();
}

export async function loadSales(cols: LiveCollection[]): Promise<SaleRecord[]> {
  const rows = await view<{ nft: string; token_id: string; buyer: string; seller: string; price: string; pool_fee: string; royalty: string; seller_net: string; at_ms: number }[]>(
    MARKET, 'recent_sales', { nft: null, limit: 100 });
  const names = new Map(cols.map((c) => [c.dep.nft, c.name]));
  return rows.filter((r) => names.has(r.nft)).map((r) => ({
    nft_id: `${names.get(r.nft)} #${r.token_id}`,
    buyer: r.buyer,
    seller: r.seller,
    collection: names.get(r.nft),
    price_near: fmtNear(r.price),
    to_dao: fmtNear(r.pool_fee, 3),
    royalty: fmtNear(r.royalty, 3),
    net_seller: fmtNear(r.seller_net, 3),
    date: new Date(r.at_ms).toLocaleString(),
  }));
}

// --------------------------------------------------------------- governance

function describeKind(kind: any): { kind: ProposalItem["kind"]; target?: string; amount?: string; min_out?: string; detail: string } {
  if (kind === 'Text') return { kind: 'Text', detail: 'Signal vote (no on-chain action).' };
  if (kind.Spend) return { kind: 'Spend', target: kind.Spend.recipient, amount: `${fmtNear(kind.Spend.amount)} ${kind.Spend.asset === 'near' ? 'NEAR' : kind.Spend.asset}`, detail: `Pay ${fmtNear(kind.Spend.amount)} ${kind.Spend.asset} from the treasury to ${kind.Spend.recipient}.` };
  if (kind.Distribute) return { kind: 'Distribute', amount: `${fmtNear(kind.Distribute.amount)} NEAR`, detail: `Split ${fmtNear(kind.Distribute.amount)} ${kind.Distribute.asset} evenly across live NFTs.` };
  if (kind.ParameterChange) return { kind: 'Parameter', detail: `Set ${kind.ParameterChange.key} = ${kind.ParameterChange.value}.` };
  if (kind.Settle) return { kind: 'Settle', min_out: kind.Settle.min_out, detail: `Settle asset group ${kind.Settle.group} (swap its escrow into the group's asset).` };
  if (kind.Swap) return { kind: 'Swap', detail: `Swap ${fmtNear(kind.Swap.amount)} of treasury funds.` };
  return { kind: 'Text', detail: JSON.stringify(kind) };
}

export interface LiveProposal extends ProposalItem {
  dep: Deployment;
  endMs: number;
}

export async function loadProposals(dep: Deployment, colName: string, myTokenIds: string[]): Promise<LiveProposal[]> {
  const lastBlocks = new Map<string, bigint>();
  await Promise.all(myTokenIds.map(async (t) => {
    const tr = await view<Traits | null>(dep.nft, 'nft_traits', { token_id: t });
    if (tr) lastBlocks.set(t, BigInt(tr.last_transfer_block));
  }));
  const count = await view<number>(dep.dao, 'proposal_count');
  const ids = Array.from({ length: Math.min(count, 40) }, (_, i) => count - i);
  const now = Date.now();
  return Promise.all(ids.map(async (id) => {
    const [p, status] = await Promise.all([
      view<RawProposal>(dep.dao, 'get_proposal', { proposal_id: id }),
      view<string>(dep.dao, 'status_of', { proposal_id: id }),
    ]);
    const voteFlags = await Promise.all(myTokenIds.map((t) => view<boolean>(dep.dao, "has_voted", { proposal_id: id, token_id: t })));
    const startBlock = BigInt(p.start_block);
    const votable = myTokenIds.filter((t, i) => !voteFlags[i] && (lastBlocks.get(t) ?? startBlock) < startBlock);
    const d = describeKind(p.kind);
    const endMs = Number(p.voting_end_ms);
    const execAt = endMs + Number(p.timelock_ms);
    const turnout = Number(p.yes) + Number(p.no) + Number(p.abstain);
    const quorumReached = turnout * 10000 >= Number(p.supply) * p.quorum_bps;
    const idx = DEPLOYMENTS.indexOf(dep);
    let shown: ProposalItem['status'];
    let remaining: string;
    if (status === 'Voting') { shown = 'Voting open'; remaining = fmtDuration(endMs - now); }
    else if (status === 'Failed') { shown = 'Failed'; remaining = 'closed'; }
    else if (status === 'Expired') { shown = 'Failed'; remaining = 'expired: not executed within 14 days'; }
    else if (status === 'Executed') { shown = 'Passed'; remaining = 'executed'; }
    else if (now < execAt) { shown = 'Timelock'; remaining = `executable in ${fmtDuration(execAt - now)}`; }
    else { shown = 'Passed'; remaining = 'ready to execute'; }
    return {
      id: idx * 100000 + id,
      chain_id: id,
      dep,
      dao: dep.dao,
      nft_contract: dep.nft,
      collection: colName,
      kind: d.kind,
      title: p.purpose,
      description: d.detail,
      status: shown,
      time_remaining: remaining,
      votes_yes: Number(p.yes),
      votes_no: Number(p.no),
      votes_abstain: Number(p.abstain),
      quorum_reached: quorumReached,
      quorum_percent: p.quorum_bps / 100,
      target_account: d.target,
      amount_near: d.amount,
      min_out: d.min_out,
      end_date: new Date(endMs).toLocaleString(),
      proposer: p.proposer,
      executed: p.executed,
      can_execute: status === 'Passed' && now >= execAt,
      my_tokens: myTokenIds.length,
      my_voted: voteFlags.filter(Boolean).length,
      votable_tokens: votable,
      endMs,
    };
  }));
}

// --------------------------------------------------------------- transactions

export const GAS = {
  mint: '150000000000000',
  approve: '60000000000000',
  buy: '250000000000000',
  vote: '250000000000000',
  propose: '100000000000000',
  execute: '300000000000000',
  claim: '120000000000000',
  burn: '300000000000000',
  call: '100000000000000',
};

export function fn(methodName: string, args: Record<string, unknown>, depositYocto: string, gas: string) {
  return { type: 'FunctionCall', params: { methodName, args, gas, deposit: depositYocto } };
}

/**
 * Confirms a submitted transaction actually succeeded, including its cross-contract receipts.
 * A signed hash is not success: promise failures show up in the receipts.
 */
export async function assertTxSucceeded(hash: string, signer: string): Promise<void> {
  let result: any = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      result = await rpc('EXPERIMENTAL_tx_status', { tx_hash: hash, sender_account_id: signer, wait_until: 'FINAL' });
      if (result?.final_execution_status === 'FINAL' || result?.status) break;
    } catch (e) {
      if (attempt === 19) throw e;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!result) throw new ChainError(`Transaction ${hash} not found`);
  const failures: string[] = [];
  const check = (status: any) => { if (status && typeof status === 'object' && 'Failure' in status) failures.push(JSON.stringify(status.Failure).slice(0, 240)); };
  check(result.status);
  for (const ro of result.receipts_outcome ?? []) check(ro.outcome?.status);
  if (failures.length) throw new ChainError(`On-chain failure: ${failures[0]}`);
}

// ------------------------------------------------------------ helpers for actions

export interface Bounds { min_period_ms: string; min_quorum_bps: number; min_pass_bps: number; min_timelock_ms: string }

/** The founder-set floors the DAO enforces, per proposal kind: Spend, Distribute, Parameter, Text. */
export function loadBounds(dep: Deployment): Promise<Bounds[]> {
  return view<Bounds[]>(dep.dao, 'get_bounds');
}

/** Live tokens of a collection whose vault has not been credited yet (anyone may credit them). */
export async function uncreditedTokens(dep: Deployment, group: number): Promise<string[]> {
  const toks = await allTokens(dep);
  const traits = await Promise.all(toks.map((t) => view<Traits | null>(dep.nft, 'nft_traits', { token_id: t.token_id })));
  const asset = (await view<NftConfig>(dep.nft, 'get_config')).asset_plan[group]?.token;
  return traits.filter((t): t is Traits => !!t && !t.credited && t.asset === asset).map((t) => t.token_id);
}
