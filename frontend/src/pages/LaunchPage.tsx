import React, { useState } from 'react';
import { Rocket, PenLine, Layers, Sparkles, Copy, Check, ArrowRight } from 'lucide-react';
import type { Page } from '../types';
import type { LiveCollection } from '../chain';

interface LaunchPageProps {
  onNavigate: (page: Page) => void;
  collections: LiveCollection[];
  onOpenCollection?: (collectionId: string) => void;
}

const card: React.CSSProperties = { background: '#15151B', border: '1px solid #2A2A33', borderRadius: 20, padding: 22, boxSizing: 'border-box' };
const label: React.CSSProperties = { fontSize: 12, color: '#A1A1AA', fontWeight: 600, marginBottom: 6, display: 'block' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: 12, padding: '12px 14px', color: '#F4F4F5', fontSize: 15, fontFamily: 'inherit' };

const STEPS = [
  { icon: PenLine, title: 'Design it', text: 'Choose a name, how many pieces, and the price of one mint.' },
  { icon: Layers, title: 'It gets its own home', text: 'Every collection gets its own NFTs, its own DAO and its own treasury. Nothing is shared with other collections.' },
  { icon: Sparkles, title: 'Holders mint and vote', text: 'Half of every mint goes to the collection treasury. The other half backs the piece. One piece, one vote.' },
];

export const LaunchPage: React.FC<LaunchPageProps> = ({ onNavigate, collections, onOpenCollection }) => {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('20');
  const [price, setPrice] = useState('1');
  const [royalty, setRoyalty] = useState('5');
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);

  const supplyN = Math.max(0, Math.floor(Number(supply) || 0));
  const priceN = Math.max(0, Number(price) || 0);
  const raised = supplyN * priceN;
  const valid = name.trim().length > 1 && symbol.trim().length > 1 && supplyN > 0 && priceN > 0;

  const settings = JSON.stringify({
    name: name.trim(),
    symbol: symbol.trim().toUpperCase(),
    supply: supplyN,
    mint_price_near: priceN,
    creator_fee_percent: Number(royalty) || 0,
  }, null, 2);

  const copy = async () => {
    try { await navigator.clipboard.writeText(settings); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard unavailable */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 1000 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Rocket size={24} color="#F5A524" />
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Launch a collection</h1>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.6, color: '#A1A1AA', maxWidth: 640 }}>
          Create an NFT collection where every piece holds real value and every holder gets a vote.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
        {STEPS.map((s, i) => (
          <div key={s.title} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(245,165,36,0.14)', border: '1px solid rgba(245,165,36,0.35)', color: '#F5A524', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>{i + 1}</span>
              <s.icon size={18} color="#A1A1AA" />
            </div>
            <strong style={{ fontSize: 16 }}>{s.title}</strong>
            <span style={{ fontSize: 13, lineHeight: 1.6, color: '#A1A1AA' }}>{s.text}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <form
          style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}
          onSubmit={(e) => { e.preventDefault(); if (valid) setCreated(true); }}
        >
          <strong style={{ fontSize: 18 }}>Your collection</strong>
          <div>
            <label style={label} htmlFor="l-name">Name</label>
            <input id="l-name" style={input} value={name} onChange={(e) => { setName(e.target.value); setCreated(false); }} placeholder="e.g. Amber Tides" maxLength={40} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="l-sym">Short name</label>
              <input id="l-sym" style={input} value={symbol} onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setCreated(false); }} placeholder="AMBER" maxLength={8} />
            </div>
            <div>
              <label style={label} htmlFor="l-sup">How many pieces</label>
              <input id="l-sup" style={input} type="number" min="1" value={supply} onChange={(e) => { setSupply(e.target.value); setCreated(false); }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="l-price">Price of one mint (NEAR)</label>
              <input id="l-price" style={input} type="number" min="0" step="0.1" value={price} onChange={(e) => { setPrice(e.target.value); setCreated(false); }} />
            </div>
            <div>
              <label style={label} htmlFor="l-roy">Your fee on resales (%)</label>
              <input id="l-roy" style={input} type="number" min="0" max="90" step="0.5" value={royalty} onChange={(e) => { setRoyalty(e.target.value); setCreated(false); }} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={!valid} style={{ minHeight: 46, fontSize: 15, fontWeight: 600, opacity: valid ? 1 : 0.5 }}>
            Prepare my launch <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <strong style={{ fontSize: 18 }}>Where the money goes</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
            <Row k="One mint costs" v={`${priceN.toFixed(2)} NEAR`} />
            <Row k="Goes to the treasury (holders vote on it)" v={`${(priceN / 2).toFixed(2)} NEAR`} accent />
            <Row k="Backs the piece in its own vault" v={`${(priceN / 2).toFixed(2)} NEAR`} accent />
            <div style={{ height: 1, background: '#2A2A33' }} />
            <Row k={`If all ${supplyN || 0} pieces mint`} v={`${raised.toFixed(2)} NEAR`} />
            <Row k="Treasury would hold" v={`${(raised / 2).toFixed(2)} NEAR`} />
          </div>
          <span style={{ fontSize: 12, lineHeight: 1.6, color: '#71717A' }}>
            Anyone can burn a piece to get 90% of its vault back, so the value behind every piece is real.
          </span>
        </div>
      </div>

      {created && (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12, borderColor: 'rgba(245,165,36,0.4)' }}>
          <strong style={{ fontSize: 18 }}>Your launch sheet</strong>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: '#A1A1AA' }}>
            A launch creates three contracts from a NEAR account you control, so it can&apos;t be done with one click from this page yet.
            Copy these settings and send them to the Quorum team, or use the launch tool from the project&apos;s repository.
          </span>
          <pre style={{ margin: 0, background: '#0E0E11', border: '1px solid #2A2A33', borderRadius: 12, padding: 14, fontSize: 13, color: '#FCD34D', overflowX: 'auto' }}>{settings}</pre>
          <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-start', minHeight: 40, padding: '0 16px', fontSize: 13 }} onClick={copy}>
            {copied ? <><Check size={14} color="#86EFAC" /> Copied</> : <><Copy size={14} /> Copy settings</>}
          </button>
        </div>
      )}

      {collections.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <strong style={{ fontSize: 18 }}>Already live</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {collections.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onOpenCollection?.(c.id); onNavigate('marketplace'); }}
                style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
              >
                <img src={c.avatar_image} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ fontSize: 15 }}>{c.name}</strong>
                  <span style={{ fontSize: 12, color: '#A1A1AA' }}>{c.minted} of {c.supply} minted</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ k: string; v: string; accent?: boolean }> = ({ k, v, accent }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#A1A1AA' }}>
    <span>{k}</span>
    <strong style={{ color: accent ? '#86EFAC' : '#F4F4F5', whiteSpace: 'nowrap' }}>{v}</strong>
  </div>
);
