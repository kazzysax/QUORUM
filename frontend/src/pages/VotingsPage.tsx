import React, { useState } from 'react';
import type { ProposalItem, TokenItem, CollectionItem } from '../types';
import { Check, X, Minus, Vote, Clock, Plus, ChevronDown, ChevronUp } from 'lucide-react';

interface VotingsPageProps {
  proposals: ProposalItem[];
  userNfts: TokenItem[];
  collections: CollectionItem[];
  onCastVote: (proposalId: number, choice: 'yes' | 'no' | 'abstain') => void;
  onCreateProposal?: (prop: Partial<ProposalItem> & { recipient?: string; group?: number }) => void;
  onExecute?: (proposalId: number) => void;
}

type Kind = 'Spend' | 'Distribute' | 'Settle' | 'Text';

const panel: React.CSSProperties = { background: '#15151B', border: '1px solid #2A2A33', borderRadius: 22, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 };
const field: React.CSSProperties = { background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: 10, padding: '10px 12px', color: '#F4F4F5', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

/** Plain-language outcome for a proposal that is no longer open. */
function outcome(p: ProposalItem): { label: string; color: string } {
  if (p.executed) return { label: 'Passed · carried out', color: '#86EFAC' };
  if (p.status === 'Timelock') return { label: 'Passed · in safety delay', color: '#FCD34D' };
  if (p.status === 'Passed') return { label: 'Passed · ready to carry out', color: '#86EFAC' };
  if (p.time_remaining.startsWith('expired')) return { label: 'Expired', color: '#71717A' };
  return { label: 'Did not pass', color: '#FCA5A5' };
}

export const VotingsPage: React.FC<VotingsPageProps> = ({ proposals, userNfts, collections, onCastVote, onCreateProposal, onExecute }) => {
  const [filter, setFilter] = useState<string>('all');
  const [votingOn, setVotingOn] = useState<number | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [showPast, setShowPast] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<{ title: string; kind: Kind; amount: string; recipient: string; group: string }>({ title: '', kind: 'Spend', amount: '1', recipient: '', group: '0' });

  const heldIn = (name: string) => userNfts.filter((n) => n.collection === name).length;
  const shown = collections.filter((c) => filter === 'all' || c.name === filter);

  const vote = async (id: number, choice: 'yes' | 'no' | 'abstain') => {
    setVotingOn(id);
    try { await onCastVote(id, choice); } finally { setVotingOn(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, width: '100%', maxWidth: 1000 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Vote size={24} color="#F5A524" />
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Votings</h1>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: '#A1A1AA', maxWidth: 680 }}>
          Every collection runs its own DAO. A vote counts only if at least half of that collection&apos;s NFTs take part, and it passes when more than half of the votes say yes.
        </p>
      </div>

      <div role="tablist" aria-label="Collections" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {['all', ...collections.map((c) => c.name)].map((name) => {
          const open = proposals.filter((p) => (name === 'all' || p.collection === name) && p.status === 'Voting open').length;
          const active = filter === name;
          return (
            <button
              key={name}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setFilter(name)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 38, padding: '0 16px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: active ? '#F5A524' : '#1D1D25', color: active ? '#111113' : '#D4D4D8', border: active ? '1px solid #F5A524' : '1px solid #2A2A33' }}
            >
              {name === 'all' ? 'All DAOs' : name}
              {open > 0 && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, background: active ? 'rgba(0,0,0,0.15)' : 'rgba(245,165,36,0.15)', color: active ? '#111113' : '#F5A524' }}>{open} open</span>}
            </button>
          );
        })}
      </div>

      {shown.map((col) => {
        const mine = heldIn(col.name);
        const list = proposals.filter((p) => p.collection === col.name);
        const open = list.filter((p) => p.status === 'Voting open');
        const past = list.filter((p) => p.status !== 'Voting open');
        const treasury = (col as CollectionItem & { treasuryNear?: string }).treasuryNear;
        return (
          <section key={col.id} style={panel}>
            {/* collection header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={col.avatar_image} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
                <div>
                  <strong style={{ fontSize: 18 }}>{col.name} DAO</strong>
                  <div style={{ fontSize: 12, color: '#A1A1AA', marginTop: 2 }}>
                    {treasury ? `${treasury} NEAR in the treasury` : 'Treasury loading…'} · {mine > 0 ? `you hold ${mine} vote${mine === 1 ? '' : 's'}` : 'you hold no votes here'}
                  </div>
                </div>
              </div>
              {mine > 0 && onCreateProposal && (
                <button type="button" className={creatingFor === col.name ? 'btn-secondary' : 'btn-primary'} style={{ minHeight: 38, padding: '0 16px', fontSize: 13 }} onClick={() => setCreatingFor(creatingFor === col.name ? null : col.name)}>
                  {creatingFor === col.name ? <><X size={14} /> Cancel</> : <><Plus size={14} /> New proposal</>}
                </button>
              )}
            </div>

            {/* new proposal */}
            {creatingFor === col.name && onCreateProposal && (
              <form
                style={{ background: '#1D1D25', border: '1px solid rgba(245,165,36,0.35)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!form.title.trim()) return;
                  onCreateProposal({ title: form.title.trim(), kind: form.kind, amount_near: `${form.amount} NEAR`, collection: col.name, target_account: form.recipient || undefined, recipient: form.recipient || undefined, group: Number(form.group) || 0 });
                  setCreatingFor(null);
                  setForm({ title: '', kind: 'Spend', amount: '1', recipient: '', group: '0' });
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 170px', gap: 10 }}>
                  <input style={field} placeholder="What should the DAO do?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                  <select style={field} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
                    <option value="Spend">Pay someone</option>
                    <option value="Distribute">Share with holders</option>
                    <option value="Settle">Settle the escrow</option>
                    <option value="Text">Opinion poll</option>
                  </select>
                </div>
                {(form.kind === 'Spend' || form.kind === 'Distribute') && (
                  <div style={{ display: 'grid', gridTemplateColumns: form.kind === 'Spend' ? '140px minmax(0, 1fr)' : '140px', gap: 10 }}>
                    <input style={field} type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} aria-label="Amount in NEAR" />
                    {form.kind === 'Spend' && <input style={field} placeholder="Pay to (account, e.g. alice.testnet)" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} required />}
                  </div>
                )}
                {form.kind === 'Settle' && <input style={{ ...field, width: 160 }} type="number" min="0" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} aria-label="Asset group" />}
                <span style={{ fontSize: 12, color: '#71717A' }}>
                  {form.kind === 'Spend' ? 'One payment can use at most half of the treasury. ' : ''}It passes only if half of all NFTs vote and most of them say yes.
                </span>
                <button type="submit" className="btn-primary" disabled={!form.title.trim()} style={{ alignSelf: 'flex-start', minHeight: 38, padding: '0 18px', fontSize: 13 }}>Submit proposal</button>
              </form>
            )}

            {/* open votes */}
            {open.length === 0 ? (
              <div style={{ fontSize: 13, color: '#71717A', padding: '6px 2px' }}>No open votes right now.</div>
            ) : (
              open.map((p) => {
                const total = p.votes_yes + p.votes_no + p.votes_abstain;
                const supply = p.supply || Math.max(total, 1);
                const pct = (n: number) => `${Math.round((n / supply) * 100)}%`;
                const turnout = Math.round((total / supply) * 100);
                const needed = Math.ceil(supply * (p.quorum_percent / 100));
                const votable = p.votable_tokens ?? [];
                const busy = votingOn === p.id;
                return (
                  <article key={p.id} style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span className="neutral-badge" style={{ height: 22, fontSize: 11 }}>#{p.chain_id ?? p.id} · {p.kind}</span>
                        <strong style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</strong>
                      </div>
                      <span className="gold-badge" style={{ height: 24, fontSize: 11, gap: 4 }}><Clock size={12} /> {p.time_remaining} left</span>
                    </div>
                    {p.description && <span style={{ fontSize: 13, color: '#A1A1AA' }}>{p.description}</span>}

                    {/* tally drawn against the whole supply, so turnout is visible at a glance */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ height: 8, borderRadius: 999, background: '#15151B', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: pct(p.votes_yes), background: '#86EFAC' }} />
                        <div style={{ width: pct(p.votes_no), background: '#FCA5A5' }} />
                        <div style={{ width: pct(p.votes_abstain), background: '#71717A' }} />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#A1A1AA' }}>
                        <span><span style={{ color: '#86EFAC' }}>Yes {p.votes_yes}</span> · <span style={{ color: '#FCA5A5' }}>No {p.votes_no}</span> · Abstain {p.votes_abstain}</span>
                        <span style={{ color: p.quorum_reached ? '#86EFAC' : '#A1A1AA' }}>
                          {total} of {supply} NFTs voted ({turnout}%) · needs {needed}{p.quorum_reached ? ' ✓' : ''}
                        </span>
                      </div>
                    </div>

                    {votable.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button type="button" className="btn-primary" disabled={busy} onClick={() => vote(p.id, 'yes')} style={{ minHeight: 36, padding: '0 16px', fontSize: 13 }}><Check size={14} /> Yes</button>
                        <button type="button" className="btn-secondary" disabled={busy} onClick={() => vote(p.id, 'no')} style={{ minHeight: 36, padding: '0 16px', fontSize: 13 }}><X size={14} /> No</button>
                        <button type="button" className="btn-secondary" disabled={busy} onClick={() => vote(p.id, 'abstain')} style={{ minHeight: 36, padding: '0 16px', fontSize: 13 }}><Minus size={14} /> Abstain</button>
                        <span style={{ alignSelf: 'center', fontSize: 12, color: '#71717A' }}>with {votable.length} vote{votable.length === 1 ? '' : 's'}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#71717A' }}>
                        {(p.my_voted ?? 0) > 0 ? 'Your vote is recorded.' : mine > 0 ? 'Your NFTs were not held when this vote opened, so they cannot vote on it.' : `Hold a ${col.name} NFT to vote in this DAO.`}
                      </span>
                    )}
                  </article>
                );
              })
            )}

            {/* past votes, folded */}
            {past.length > 0 && (
              <div style={{ borderTop: '1px solid #2A2A33', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button type="button" onClick={() => setShowPast({ ...showPast, [col.name]: !showPast[col.name] })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'transparent', border: 0, color: '#A1A1AA', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  {showPast[col.name] ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Past votes ({past.length})
                </button>
                {showPast[col.name] && past.map((p) => {
                  const o = outcome(p);
                  return (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: '#1D1D25', fontSize: 13 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ color: '#71717A' }}>#{p.chain_id ?? p.id}</span> {p.title}</span>
                      <span style={{ color: '#A1A1AA', whiteSpace: 'nowrap' }}>{p.votes_yes} yes · {p.votes_no} no</span>
                      {p.can_execute && onExecute ? (
                        <button type="button" className="btn-primary" style={{ minHeight: 30, padding: '0 12px', fontSize: 12 }} onClick={() => onExecute(p.id)}>Carry out</button>
                      ) : (
                        <span style={{ color: o.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{o.label}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
