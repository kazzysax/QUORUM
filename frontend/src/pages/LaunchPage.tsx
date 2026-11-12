import React, { useEffect, useMemo, useState } from 'react';
import { Rocket, PenLine, Layers, Sparkles, ArrowRight, Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import type { Page } from '../types';
import type { LiveCollection } from '../chain';
import { launchDeposit, nearToYocto, slugTaken } from '../chain';
import { SITE } from '../deployments';

interface LaunchPageProps {
  onNavigate: (page: Page) => void;
  collections: LiveCollection[];
  onOpenCollection?: (collectionId: string) => void;
  /** The connected wallet, if any. */
  account: string | null;
  onConnect: () => void;
  /** Sends the launch transaction. Resolves true when the collection exists on chain. */
  onLaunch: (args: Record<string, unknown>, depositYocto: string) => Promise<boolean>;
}

const card: React.CSSProperties = { background: '#15151B', border: '1px solid #2A2A33', borderRadius: 20, padding: 22, boxSizing: 'border-box' };
const label: React.CSSProperties = { fontSize: 12, color: '#A1A1AA', fontWeight: 600, marginBottom: 6, display: 'block' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: 12, padding: '12px 14px', color: '#F4F4F5', fontSize: 15, fontFamily: 'inherit' };
const hint: React.CSSProperties = { fontSize: 12, color: '#71717A', marginTop: 6, lineHeight: 1.5 };

const STEPS = [
  { icon: PenLine, title: 'Design it', text: 'Choose a name, how many pieces, and the price of one mint.' },
  { icon: Layers, title: 'It gets its own home', text: 'Every collection gets its own NFTs, its own DAO and its own treasury. Nothing is shared with other collections, and none of them has an admin key.' },
  { icon: Sparkles, title: 'Holders mint and vote', text: 'Half of every mint goes to the collection treasury. The other half backs the piece. One piece, one vote.' },
];

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 16).replace(/-+$/g, '');
const near2 = (y: bigint) => (Number(y / 10n ** 20n) / 10000).toFixed(2);

export const LaunchPage: React.FC<LaunchPageProps> = ({ onNavigate, collections, onOpenCollection, account, onConnect, onLaunch }) => {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [supply, setSupply] = useState('20');
  const [price, setPrice] = useState('1');
  const [royalty, setRoyalty] = useState('5');
  const [mintDays, setMintDays] = useState('30');
  const [quick, setQuick] = useState(true);
  const [showArt, setShowArt] = useState(false);
  const [metaUrl, setMetaUrl] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [deposit, setDeposit] = useState<bigint | null>(null);
  const [taken, setTaken] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplyN = Math.max(0, Math.floor(Number(supply) || 0));
  const priceN = Math.max(0, Number(price) || 0);
  const raised = supplyN * priceN;
  const slugOk = /^[a-z0-9](?:[a-z0-9-]{1,14})[a-z0-9]$/.test(slug) && !slug.includes('--');
  const valid = name.trim().length > 1 && symbol.trim().length > 1 && slugOk && taken === false && supplyN > 0 && supplyN <= 500 && priceN > 0 && Number(royalty) >= 0 && Number(royalty) <= 90 && Number(mintDays) >= 1;

  // Art links default to this site, under the collection's address name (that is where the OEN test art lives).
  const links = useMemo(() => ({
    metadata_base_url: metaUrl.trim() || `${SITE}/m/${slug}`,
    media_base_url: mediaUrl.trim() || `${SITE}/media/${slug}`,
    cover_url: coverUrl.trim() || `${SITE}/images/${slug}-cover.jpg`,
    avatar_url: avatarUrl.trim() || `${SITE}/images/${slug}-avatar.png`,
  }), [metaUrl, mediaUrl, coverUrl, avatarUrl, slug]);

  useEffect(() => { if (!slugEdited) setSlug(toSlug(name)); }, [name, slugEdited]);

  // What the launch costs: the factory computes it (three accounts' storage plus a little per piece).
  useEffect(() => {
    let alive = true;
    if (supplyN < 1 || supplyN > 500) { setDeposit(null); return; }
    launchDeposit(supplyN).then((d) => { if (alive) setDeposit(d); }).catch(() => { if (alive) setDeposit(null); });
    return () => { alive = false; };
  }, [supplyN]);

  // Is the address name free?
  useEffect(() => {
    let alive = true;
    setTaken(null);
    if (!slugOk) return;
    const t = setTimeout(() => { slugTaken(slug).then((v) => { if (alive) setTaken(v); }).catch(() => { if (alive) setTaken(null); }); }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [slug, slugOk]);

  const launch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!account) { onConnect(); return; }
    if (!valid || deposit === null) return;
    setBusy(true);
    try {
      const ok = await onLaunch({
        name: name.trim(), symbol: symbol.trim().toUpperCase(), slug, description: description.trim(),
        supply: supplyN, price_near: nearToYocto(price), royalty_bps: Math.round((Number(royalty) || 0) * 100),
        mint_days: Math.floor(Number(mintDays)), quick_votes: quick, ...links,
      }, (deposit + 2n * 10n ** 23n).toString()); // a little extra; the factory returns anything above the required amount
      if (!ok) setError('The launch did not complete. Nothing was created; check the message above and try again.');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 1000 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Rocket size={24} color="#F5A524" />
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Launch a collection</h1>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.6, color: '#A1A1AA', maxWidth: 680 }}>
          Create an NFT collection where every piece holds real value and every holder gets a vote. Fill the form, press Launch, approve one transaction in your wallet, and your collection is live.
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
        <form style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={launch}>
          <strong style={{ fontSize: 18 }}>Your collection</strong>
          <div>
            <label style={label} htmlFor="l-name">Name</label>
            <input id="l-name" style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amber Tides" maxLength={40} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="l-sym">Short name</label>
              <input id="l-sym" style={input} value={symbol} onChange={(e) => setSymbol(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())} placeholder="AMBER" maxLength={8} />
            </div>
            <div>
              <label style={label} htmlFor="l-slug">Address name</label>
              <input id="l-slug" style={input} value={slug} onChange={(e) => { setSlugEdited(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }} placeholder="amber-tides" maxLength={16} />
            </div>
          </div>
          <div style={{ ...hint, marginTop: -8 }}>
            {!slug ? 'Your collection lives at <address name>.launch.qrmx-founder1.testnet' : !slugOk ? 'Use 3 to 16 lowercase letters, digits or hyphens.' : taken === true ? 'That address name is taken, pick another.' : taken === false ? `Free: ${slug}.launch.qrmx-founder1.testnet` : 'Checking…'}
          </div>
          <div>
            <label style={label} htmlFor="l-desc">What is it about? (shown on the collection page)</label>
            <textarea id="l-desc" style={{ ...input, minHeight: 78, resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short story or description of your collection" maxLength={300} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="l-sup">How many pieces</label>
              <input id="l-sup" style={input} type="number" min="1" max="500" value={supply} onChange={(e) => setSupply(e.target.value)} />
            </div>
            <div>
              <label style={label} htmlFor="l-price">Price of one mint (NEAR)</label>
              <input id="l-price" style={input} type="number" min="0" step="0.1" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="l-roy">Your fee on resales (%)</label>
              <input id="l-roy" style={input} type="number" min="0" max="90" step="0.5" value={royalty} onChange={(e) => setRoyalty(e.target.value)} />
            </div>
            <div>
              <label style={label} htmlFor="l-days">Mint stays open (days)</label>
              <input id="l-days" style={input} type="number" min="1" max="365" value={mintDays} onChange={(e) => setMintDays(e.target.value)} />
            </div>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#A1A1AA', cursor: 'pointer' }}>
            <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Short votes for testing (10 minutes). Untick for the standard 3 to 5 days. Either way, at least half of all pieces must vote for anything to pass.</span>
          </label>

          <button type="button" onClick={() => setShowArt((v) => !v)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#A1A1AA', fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer', padding: 0 }}>
            Where is your art? {showArt ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showArt && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, background: '#0E0E11', border: '1px solid #2A2A33', borderRadius: 14 }}>
              <span style={{ fontSize: 12, lineHeight: 1.6, color: '#A1A1AA' }}>
                Leave these empty if your art is on this site under your address name (that is where the OEN test art is). Otherwise paste links (https only) to where your files are hosted.
              </span>
              <div><label style={label} htmlFor="l-m">Metadata folder (holds metadata/1.json, 2.json ...)</label><input id="l-m" style={input} value={metaUrl} onChange={(e) => setMetaUrl(e.target.value)} placeholder={links.metadata_base_url} /></div>
              <div><label style={label} htmlFor="l-i">Pictures folder (piece N is at .../N)</label><input id="l-i" style={input} value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder={links.media_base_url} /></div>
              <div><label style={label} htmlFor="l-c">Cover picture link</label><input id="l-c" style={input} value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder={links.cover_url} /></div>
              <div><label style={label} htmlFor="l-a">Avatar picture link</label><input id="l-a" style={input} value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder={links.avatar_url} /></div>
            </div>
          )}

          {error && <div style={{ fontSize: 13, color: '#FCA5A5', lineHeight: 1.5 }}>{error}</div>}
          <button type="submit" className="btn-primary" disabled={busy || (!!account && !valid)} style={{ minHeight: 48, fontSize: 15, fontWeight: 600, opacity: busy || (!!account && !valid) ? 0.5 : 1 }}>
            {busy ? 'Launching… approve it in your wallet' : account ? <>Launch {name.trim() || 'my collection'} <ArrowRight size={16} /></> : <><Wallet size={16} /> Connect wallet to launch</>}
          </button>
          <span style={hint}>
            One transaction creates your three contracts (NFTs, DAO, treasury), registers the collection on the market and opens the mint. It pays for their storage with the amount shown on the right.
          </span>
        </form>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <strong style={{ fontSize: 18 }}>What it costs you</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
            <Row k="Paid now, once" v={deposit === null ? '…' : `${near2(deposit)} NEAR`} accent />
            <span style={{ fontSize: 12, lineHeight: 1.6, color: '#71717A' }}>
              This pays for the three accounts that will hold your collection (they cannot be deleted or changed by anyone). It stays inside them. Anything you attach above the amount is returned.
            </span>
          </div>
          <div style={{ height: 1, background: '#2A2A33' }} />
          <strong style={{ fontSize: 18 }}>Where each mint goes</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
            <Row k="One mint costs" v={`${priceN.toFixed(2)} NEAR`} />
            <Row k="Goes to the treasury (holders vote on it)" v={`${(priceN / 2).toFixed(2)} NEAR`} accent />
            <Row k="Backs the piece in its own vault" v={`${(priceN / 2).toFixed(2)} NEAR`} accent />
            <div style={{ height: 1, background: '#2A2A33' }} />
            <Row k={`If all ${supplyN || 0} pieces mint`} v={`${raised.toFixed(2)} NEAR`} />
            <Row k="Treasury would hold" v={`${(raised / 2).toFixed(2)} NEAR`} />
          </div>
          <span style={{ fontSize: 12, lineHeight: 1.6, color: '#71717A' }}>
            Anyone can burn a piece to get 90% of its vault back, so the value behind every piece is real. You receive the resale fee ({Number(royalty) || 0}%) on every sale.
          </span>
        </div>
      </div>

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
