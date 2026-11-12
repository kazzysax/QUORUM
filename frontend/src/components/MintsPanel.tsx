import React from 'react';
import { Sparkles, Clock, CalendarClock } from 'lucide-react';
import type { LiveCollection } from '../chain';
import { fmtDuration, fmtNear } from '../chain';

interface MintsPanelProps {
  collections: LiveCollection[];
  onMint?: (collectionId: string) => void;
  onOpenCollection?: (collectionId: string) => void;
  /** Compact mode is the strip on the Market page; the full mode is the Mints page. */
  compact?: boolean;
}

const card: React.CSSProperties = { background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: 18, padding: 14, display: 'flex', gap: 14, alignItems: 'center', boxSizing: 'border-box' };

function priceOf(c: LiveCollection): string {
  const stage = c.config.stages[c.activeStage ?? c.nextStage ?? 0];
  return fmtNear(stage.price_near);
}

function LiveCard({ c, onMint, onOpenCollection }: { c: LiveCollection } & Pick<MintsPanelProps, 'onMint' | 'onOpenCollection'>) {
  const pct = Math.min(100, Math.round((c.minted / c.supply) * 100));
  const left = c.mintEndMs ? c.mintEndMs - Date.now() : null;
  return (
    <div style={{ ...card, flexWrap: 'wrap' }}>
      <img src={c.avatar_image} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
      <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 16 }}>{c.name}</strong>
          <span className="success-badge" style={{ height: 22, fontSize: 11 }}>Live</span>
          {c.stageName && <span className="neutral-badge" style={{ height: 22, fontSize: 11 }}>{c.stageName}</span>}
        </div>
        <div style={{ height: 6, borderRadius: 999, background: '#15151B', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #F5A524, #FBBF5A)' }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#A1A1AA' }}>
          <span>{c.minted} of {c.supply} minted</span>
          {left !== null && left > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> ends in {fmtDuration(left)}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <strong style={{ fontSize: 18, color: '#F5A524', fontFamily: 'Space Grotesk' }}>{priceOf(c)} NEAR</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          {onOpenCollection && <button type="button" className="btn-secondary" style={{ minHeight: 36, padding: '0 14px', fontSize: 13 }} onClick={() => onOpenCollection(c.id)}>View</button>}
          {onMint && <button type="button" className="btn-primary" style={{ minHeight: 36, padding: '0 16px', fontSize: 13 }} onClick={() => onMint(c.id)}><Sparkles size={14} /> Mint</button>}
        </div>
      </div>
    </div>
  );
}

function UpcomingCard({ c, onOpenCollection }: { c: LiveCollection } & Pick<MintsPanelProps, 'onOpenCollection'>) {
  const until = c.mintStartMs ? c.mintStartMs - Date.now() : null;
  return (
    <div style={{ ...card, flexWrap: 'wrap' }}>
      <img src={c.avatar_image} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', flexShrink: 0, opacity: 0.9 }} />
      <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 16 }}>{c.name}</strong>
          <span className="gold-badge" style={{ height: 22, fontSize: 11 }}>{c.paused ? 'Paused' : 'Upcoming'}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#A1A1AA' }}>
          <span>{c.supply} pieces</span>
          {c.mintStartMs && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CalendarClock size={12} /> {until !== null && until > 0 ? `opens in ${fmtDuration(until)}` : 'opening soon'} · {new Date(c.mintStartMs).toLocaleString()}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <strong style={{ fontSize: 18, color: '#F4F4F5', fontFamily: 'Space Grotesk' }}>{priceOf(c)} NEAR</strong>
        {onOpenCollection && <button type="button" className="btn-secondary" style={{ minHeight: 36, padding: '0 14px', fontSize: 13 }} onClick={() => onOpenCollection(c.id)}>View</button>}
      </div>
    </div>
  );
}

const Empty: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div style={{ padding: '22px 18px', textAlign: 'center', color: '#71717A', background: '#15151B', border: '1px dashed #2A2A33', borderRadius: 16 }}>
    <div style={{ color: '#A1A1AA', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 13 }}>{text}</div>
  </div>
);

/**
 * Live and upcoming mints, straight from each collection contract's stages. A new collection (or a
 * new stage) appears here on its own: nothing is listed by hand.
 */
export const MintsPanel: React.FC<MintsPanelProps> = ({ collections, onMint, onOpenCollection, compact }) => {
  const live = collections.filter((c) => c.status === 'live');
  const upcoming = collections.filter((c) => c.status === 'upcoming');
  const heading = (icon: React.ReactNode, text: string, n: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon}
      <h3 style={{ margin: 0, fontSize: compact ? 16 : 18, fontWeight: 600 }}>{text}</h3>
      <span className="neutral-badge" style={{ height: 22, fontSize: 11 }}>{n}</span>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(340px, 1fr))' : '1fr', gap: compact ? 18 : 26 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {heading(<Sparkles size={18} color="#F5A524" />, 'Live mints', live.length)}
        {live.length === 0
          ? <Empty title="No live mints right now" text="When a collection opens its mint it appears here, ready to mint." />
          : live.map((c) => <LiveCard key={c.id} c={c} onMint={onMint} onOpenCollection={onOpenCollection} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {heading(<CalendarClock size={18} color="#A1A1AA" />, 'Upcoming mints', upcoming.length)}
        {upcoming.length === 0
          ? <Empty title="No upcoming mints yet" text="Collections that have announced a start time show up here until they open." />
          : upcoming.map((c) => <UpcomingCard key={c.id} c={c} onOpenCollection={onOpenCollection} />)}
      </div>
    </div>
  );
};
