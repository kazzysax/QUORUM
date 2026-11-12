import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Rocket, PenLine, Layers, Sparkles, ArrowRight, ArrowLeft, Check, Wallet, ImagePlus, FileSpreadsheet, Trash2, X, Plus } from 'lucide-react';
import type { Page } from '../types';
import type { LiveCollection } from '../chain';
import { launchDeposit, nearToYocto, slugTaken } from '../chain';
import { MAX_PIECES, MAX_TRAITS, collectDropped, fromFileList, ingest, uploadArt } from '../launchArt';
import type { Dropped, Piece, Source } from '../launchArt';

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
const small: React.CSSProperties = { ...input, padding: '7px 10px', fontSize: 12, borderRadius: 9 };
const hint: React.CSSProperties = { fontSize: 12, color: '#71717A', marginTop: 6, lineHeight: 1.5 };

const STEPS = [
  { icon: PenLine, title: 'Design it', text: 'Choose a name, add your pictures with their names and traits, and set the price of one mint.' },
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
  const [price, setPrice] = useState('1');
  const [royalty, setRoyalty] = useState('5');
  const [mintDays, setMintDays] = useState('30');
  const [quick, setQuick] = useState(true);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [bulkType, setBulkType] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [report, setReport] = useState<string[]>([]);
  const [warns, setWarns] = useState<string[]>([]);
  const [deposit, setDeposit] = useState<bigint | null>(null);
  const [taken, setTaken] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [reading, setReading] = useState(false);
  const piecesRef = useRef<Piece[]>([]);
  piecesRef.current = pieces;

  const supplyN = pieces.length;
  const priceN = Math.max(0, Number(price) || 0);
  const raised = supplyN * priceN;
  const slugOk = /^[a-z0-9](?:[a-z0-9-]{1,14})[a-z0-9]$/.test(slug) && !slug.includes('--');
  const valid = name.trim().length > 1 && symbol.trim().length > 1 && slugOk && taken === false && supplyN >= 1 && supplyN <= MAX_PIECES && priceN > 0 && Number(royalty) >= 0 && Number(royalty) <= 90 && Number(mintDays) >= 1;

  useEffect(() => { if (!slugEdited) setSlug(toSlug(name)); }, [name, slugEdited]);
  useEffect(() => () => { piecesRef.current.forEach((p) => URL.revokeObjectURL(p.preview)); }, []);

  // What the launch costs: the factory computes it (three accounts' storage plus a little per piece).
  useEffect(() => {
    let alive = true;
    const n = Math.min(Math.max(supplyN, 1), 500);
    launchDeposit(n).then((d) => { if (alive) setDeposit(d); }).catch(() => { if (alive) setDeposit(null); });
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

  /** Whatever was dropped or chosen (pictures, traits files, folders) is read and lined up in one go. */
  const addDropped = async (dropped: Dropped[]) => {
    if (!dropped.length) return;
    setReading(true);
    try {
      const res = await ingest(dropped, pieces, sources);
      setPieces(res.pieces);
      setSources(res.sources);
      if (res.cover) setCover(res.cover);
      if (res.avatar) setAvatar(res.avatar);
      setReport(res.report);
      setWarns(res.warnings);
    } catch (e: any) { setWarns([String(e?.message || e)]); } finally { setReading(false); }
  };
  const removePiece = (key: number) => setPieces((cur) => { const p = cur.find((x) => x.key === key); if (p) URL.revokeObjectURL(p.preview); return cur.filter((x) => x.key !== key); });
  const clearAll = () => { pieces.forEach((p) => URL.revokeObjectURL(p.preview)); setPieces([]); setSources([]); setCover(null); setAvatar(null); setReport([]); setWarns([]); };
  const patch = (key: number, f: (p: Piece) => Piece) => setPieces((cur) => cur.map((p) => (p.key === key ? f(p) : p)));
  const addToAll = () => {
    if (!bulkType.trim() || !bulkValue.trim()) return;
    setPieces((cur) => cur.map((p) => (p.traits.length >= MAX_TRAITS ? p : { ...p, traits: [...p.traits.filter((t) => t.type !== bulkType.trim()), { type: bulkType.trim().slice(0, 40), value: bulkValue.trim().slice(0, 40) }] })));
    setBulkType(''); setBulkValue('');
  };

  const problems = useMemo(() => {
    const out: string[] = [];
    if (!supplyN) out.push('Add at least one picture.');
    if (pieces.some((p) => p.name.length > 60)) out.push('A piece name is longer than 60 characters.');
    return out;
  }, [pieces, supplyN]);

  const launch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!account) { onConnect(); return; }
    if (!valid || deposit === null || problems.length) return;
    setBusy(true);
    try {
      setProgress('Uploading your art…');
      const links = await uploadArt(slug, name, description.trim(), pieces, cover, avatar, (d, t) => setProgress(`Uploading your art ${d} of ${t}…`));
      setProgress('Waiting for your wallet…');
      const ok = await onLaunch({
        name: name.trim(), symbol: symbol.trim().toUpperCase(), slug, description: description.trim(),
        supply: supplyN, price_near: nearToYocto(price), royalty_bps: Math.round((Number(royalty) || 0) * 100),
        mint_days: Math.floor(Number(mintDays)), quick_votes: quick, ...links,
      }, (deposit + 2n * 10n ** 23n).toString()); // a little extra; the factory returns anything above the required amount
      if (!ok) setError('The launch did not complete. Nothing was created; your art is saved, so you can press Launch again.');
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally { setBusy(false); setProgress(null); }
  };

  // ------------------------------------------------------------------ stages
  const [stage, setStage] = useState(1);
  const [reached, setReached] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);
  const royaltyN = Number(royalty), daysN = Number(mintDays);
  const ok1 = name.trim().length > 1 && symbol.trim().length > 1 && slugOk && taken === false;
  const ok2 = supplyN >= 1 && supplyN <= MAX_PIECES && problems.length === 0;
  const ok3 = priceN > 0 && royaltyN >= 0 && royaltyN <= 90 && daysN >= 1 && daysN <= 365;
  const okFor = (n: number) => (n === 1 ? ok1 : n === 2 ? ok2 : n === 3 ? ok3 : valid && deposit !== null && problems.length === 0);
  const why = (n: number): string | null => {
    if (okFor(n)) return null;
    if (n === 1) return name.trim().length < 2 ? 'Give your collection a name.' : symbol.trim().length < 2 ? 'Add a short name (2 to 8 letters).' : !slugOk ? 'Pick an address name: 3 to 16 lowercase letters, digits or hyphens.' : taken === true ? 'That address name is taken, pick another.' : 'Checking that the address name is free…';
    if (n === 2) return !supplyN ? 'Add at least one picture.' : problems[0] ?? null;
    if (n === 3) return priceN <= 0 ? 'Set a mint price above 0.' : royaltyN < 0 || royaltyN > 90 ? 'The resale fee is 0 to 90%.' : 'Mint stays open for 1 to 365 days.';
    return 'Something above needs fixing: go back and check each stage.';
  };
  const go = (n: number) => {
    const target = Math.max(1, Math.min(4, n));
    setStage(target);
    setReached((r) => Math.max(r, target));
  };
  useEffect(() => { topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [stage]);
  const next = () => { if (okFor(stage)) go(stage + 1); };
  const STAGES = [
    { n: 1, title: 'Basics', sub: 'Name and story' },
    { n: 2, title: 'Art', sub: 'Pictures and traits' },
    { n: 3, title: 'Sale', sub: 'Price and rules' },
    { n: 4, title: 'Launch', sub: 'Review and go live' },
  ];
  const stageHint = why(stage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 1000 }}>
      <div ref={topRef} style={{ scrollMarginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Rocket size={24} color="#F5A524" />
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Launch a collection</h1>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.6, color: '#A1A1AA', maxWidth: 680 }}>
          Bring your own art. Four short stages, then one wallet approval, and your collection is live on NEAR testnet for anyone to mint.
        </p>
      </div>

      {/* Progress */}
      <ol className="hscroll hscroll-fill" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {STAGES.map((s) => {
          const done = s.n < stage || (s.n <= reached && s.n !== stage && okFor(s.n)), active = s.n === stage, open = s.n <= reached;
          return (
            <li key={s.n}>
              <button
                type="button"
                disabled={!open || busy}
                onClick={() => go(s.n)}
                aria-current={active ? 'step' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, textAlign: 'left', cursor: open && !busy ? 'pointer' : 'default', color: 'inherit', background: active ? 'rgba(245,165,36,0.10)' : '#15151B', border: `1px solid ${active ? 'rgba(245,165,36,0.55)' : '#2A2A33'}`, opacity: open ? 1 : 0.55 }}
              >
                <span style={{ flex: '0 0 auto', width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, background: done ? '#22C55E' : active ? '#F5A524' : '#2A2A33', color: done || active ? '#0A0A0D' : '#A1A1AA' }}>
                  {done ? <Check size={15} /> : s.n}
                </span>
                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{s.title}</strong>
                  <span style={{ fontSize: 11, color: '#71717A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sub}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <form onSubmit={(e) => { e.preventDefault(); if (stage < 4) next(); else void launch(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ---------------------------------------------------------------- stage 1 */}
        {stage === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <strong style={{ fontSize: 18 }}>Name your collection</strong>
              <div>
                <label style={label} htmlFor="l-name">Name</label>
                <input id="l-name" style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amber Tides" maxLength={40} autoFocus />
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
              <div style={{ ...hint, marginTop: -8, minHeight: 36, color: taken === true ? '#FCA5A5' : taken === false ? '#86EFAC' : '#71717A' }}>
                {!slug ? 'Your collection will live at <address name>.launch.qrmx-founder1.testnet' : !slugOk ? 'Use 3 to 16 lowercase letters, digits or hyphens.' : taken === true ? 'That address name is taken, pick another.' : taken === false ? `Free: ${slug}.launch.qrmx-founder1.testnet` : 'Checking…'}
              </div>
              <div>
                <label style={label} htmlFor="l-desc">What is it about? (shown on the collection page)</label>
                <textarea id="l-desc" style={{ ...input, minHeight: 96, resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short story or description of your collection" maxLength={300} />
                <div style={hint}>{description.length} / 300</div>
              </div>
            </div>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <strong style={{ fontSize: 18 }}>What you get</strong>
              {STEPS.map((t) => (
                <div key={t.title} style={{ display: 'flex', gap: 12 }}>
                  <t.icon size={18} color="#F5A524" style={{ flex: '0 0 auto', marginTop: 2 }} />
                  <div><strong style={{ fontSize: 14 }}>{t.title}</strong><div style={{ fontSize: 13, lineHeight: 1.6, color: '#A1A1AA' }}>{t.text}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- stage 2 */}
        {stage === 2 && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <strong style={{ fontSize: 18 }}>Add your art</strong>
              <span style={{ fontSize: 13, color: '#A1A1AA' }}>{supplyN} {supplyN === 1 ? 'piece' : 'pieces'} (the collection size is the number of pictures, up to {MAX_PIECES})</span>
            </div>

            <label
              htmlFor="l-files"
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); void collectDropped(e.dataTransfer).then(addDropped); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 16px', textAlign: 'center', borderRadius: 16, cursor: 'pointer', border: `2px dashed ${drag ? '#F5A524' : '#3A3A45'}`, background: drag ? 'rgba(245,165,36,0.06)' : '#0E0E11' }}
            >
              <ImagePlus size={26} color="#F5A524" />
              <strong style={{ fontSize: 15 }}>{reading ? 'Reading your files…' : 'Drop everything here: pictures, traits files, or a whole folder'}</strong>
              <span style={{ fontSize: 12, color: '#71717A', lineHeight: 1.6 }}>
                Pictures (PNG, JPG, WEBP, GIF) become numbered pieces in file-name order. A traits file, CSV or JSON (one per piece like 7.json, or one file for all), is matched to its pictures by file name or number. A picture named cover or avatar is used as the cover or avatar. You can drop in any order, and more than once.
              </span>
              <input id="l-files" type="file" accept="image/png,image/jpeg,image/webp,image/gif,.csv,.json,text/csv,application/json" multiple style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.length) void addDropped(fromFileList(e.target.files)); e.target.value = ''; }} />
            </label>
            <label htmlFor="l-folder" style={{ alignSelf: 'flex-start', fontSize: 13, color: '#A1A1AA', cursor: 'pointer', textDecoration: 'underline' }}>
              or choose a whole folder
              <input id="l-folder" type="file" multiple style={{ display: 'none' }} {...({ webkitdirectory: '' } as Record<string, string>)} onChange={(e) => { if (e.target.files?.length) void addDropped(fromFileList(e.target.files)); e.target.value = ''; }} />
            </label>
            {(report.length > 0 || warns.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 14px', background: '#0E0E11', border: '1px solid #2A2A33', borderRadius: 12 }}>
                {report.map((r) => <span key={r} style={{ fontSize: 13, color: '#86EFAC', lineHeight: 1.5 }}>✓ {r}</span>)}
                {warns.map((w) => <span key={w} style={{ fontSize: 13, color: '#FCD34D', lineHeight: 1.5 }}>! {w}</span>)}
              </div>
            )}

            {pieces.length > 0 && (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label className="btn-secondary" htmlFor="l-csv" style={{ minHeight: 38, padding: '0 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <FileSpreadsheet size={14} /> Add a traits file (CSV or JSON)
                    <input id="l-csv" type="file" multiple accept=".csv,.json,text/csv,application/json" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.length) void addDropped(fromFileList(e.target.files)); e.target.value = ''; }} />
                  </label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input style={{ ...small, width: 120 }} value={bulkType} onChange={(e) => setBulkType(e.target.value)} placeholder="Trait (e.g. Mood)" maxLength={40} />
                    <input style={{ ...small, width: 120 }} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="Value (e.g. Calm)" maxLength={40} />
                    <button type="button" className="btn-secondary" style={{ minHeight: 34, padding: '0 12px', fontSize: 12 }} onClick={addToAll}>Add to every piece</button>
                  </div>
                  <button type="button" onClick={clearAll} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#A1A1AA', fontSize: 12, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Trash2 size={13} /> Remove all</button>
                </div>
                <span style={hint}>
                  CSV: a header row, the first column <code>token</code> (the piece number or the picture's file name), an optional <code>name</code> column, and every other column a trait. JSON: one file per piece (like 7.json, with <code>attributes</code>), or one file holding a list or an object of pieces.
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
                  {pieces.map((p, i) => (
                    <div key={p.key} style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ position: 'relative' }}>
                        <img src={p.preview} alt="" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                        <span style={{ position: 'absolute', left: 6, top: 6, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>#{i + 1}</span>
                        <button type="button" aria-label={`Remove piece ${i + 1}`} onClick={() => removePiece(p.key)} style={{ position: 'absolute', right: 6, top: 6, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={13} /></button>
                      </div>
                      <input style={small} value={p.name} onChange={(e) => patch(p.key, (x) => ({ ...x, name: e.target.value.slice(0, 60) }))} placeholder={`${name.trim() || 'Name'} #${i + 1}`} aria-label={`Name of piece ${i + 1}`} />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {p.traits.map((t, ti) => (
                          <span key={ti} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'rgba(245,165,36,0.12)', border: '1px solid rgba(245,165,36,0.3)', color: '#FCD34D', borderRadius: 999, padding: '2px 4px 2px 8px' }}>
                            {t.type}: {t.value}
                            <button type="button" aria-label="Remove trait" onClick={() => patch(p.key, (x) => ({ ...x, traits: x.traits.filter((_, k) => k !== ti) }))} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><X size={11} /></button>
                          </span>
                        ))}
                      </div>
                      <TraitAdder disabled={p.traits.length >= MAX_TRAITS} onAdd={(t) => patch(p.key, (x) => ({ ...x, traits: [...x.traits, t] }))} />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={label} htmlFor="l-cover">Cover picture (wide banner, optional)</label>
                    <input id="l-cover" type="file" accept="image/png,image/jpeg,image/webp" style={{ ...small, padding: 6 }} onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
                    <div style={hint}>{cover ? cover.name : 'Not chosen: your first picture is used.'}</div>
                  </div>
                  <div>
                    <label style={label} htmlFor="l-avatar">Avatar picture (square, optional)</label>
                    <input id="l-avatar" type="file" accept="image/png,image/jpeg,image/webp" style={{ ...small, padding: 6 }} onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
                    <div style={hint}>{avatar ? avatar.name : 'Not chosen: your first picture is used.'}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- stage 3 */}
        {stage === 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <strong style={{ fontSize: 18 }}>Set the sale</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label} htmlFor="l-price">Price of one mint (NEAR)</label>
                  <input id="l-price" style={input} type="number" min="0" step="0.1" value={price} onChange={(e) => setPrice(e.target.value)} autoFocus />
                </div>
                <div>
                  <label style={label} htmlFor="l-roy">Your fee on resales (%)</label>
                  <input id="l-roy" style={input} type="number" min="0" max="90" step="0.5" value={royalty} onChange={(e) => setRoyalty(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={label} htmlFor="l-days">Mint stays open (days)</label>
                <input id="l-days" style={input} type="number" min="1" max="365" value={mintDays} onChange={(e) => setMintDays(e.target.value)} />
              </div>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#A1A1AA', cursor: 'pointer' }}>
                <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} style={{ marginTop: 3 }} />
                <span>Short votes for testing (10 minutes). Untick for the standard 3 to 5 days. Either way, at least half of all pieces must vote for anything to pass.</span>
              </label>
            </div>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                Anyone can burn a piece to get 90% of its vault back, so the value behind every piece is real. You receive the resale fee ({royaltyN || 0}%) on every sale.
              </span>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- stage 4 */}
        {stage === 4 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <strong style={{ fontSize: 18 }}>Review</strong>
              <Review title="Collection" onEdit={() => go(1)} disabled={busy}>
                <Row k="Name" v={name.trim()} />
                <Row k="Short name" v={symbol.trim().toUpperCase()} />
                <Row k="Address" v={`${slug}.launch.qrmx-founder1.testnet`} />
                {description.trim() && <span style={{ fontSize: 13, lineHeight: 1.5, color: '#A1A1AA' }}>{description.trim()}</span>}
              </Review>
              <Review title="Art" onEdit={() => go(2)} disabled={busy}>
                <Row k="Pieces" v={`${supplyN}`} />
                <Row k="With traits" v={`${pieces.filter((p) => p.traits.length).length} of ${supplyN}`} />
                <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
                  {pieces.slice(0, 8).map((p) => <img key={p.key} src={p.preview} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flex: '0 0 auto' }} />)}
                  {pieces.length > 8 && <span style={{ alignSelf: 'center', fontSize: 12, color: '#71717A' }}>+{pieces.length - 8}</span>}
                </div>
              </Review>
              <Review title="Sale" onEdit={() => go(3)} disabled={busy}>
                <Row k="Mint price" v={`${priceN.toFixed(2)} NEAR`} />
                <Row k="Your resale fee" v={`${royaltyN || 0}%`} />
                <Row k="Mint open for" v={`${daysN} days`} />
                <Row k="Votes" v={quick ? '10 minutes (testing)' : '3 to 5 days'} />
              </Review>
            </div>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <strong style={{ fontSize: 18 }}>What it costs you</strong>
              <Row k="Paid now, once" v={deposit === null ? '…' : `${near2(deposit)} NEAR`} accent />
              <span style={{ fontSize: 12, lineHeight: 1.6, color: '#71717A' }}>
                This is NEAR's storage rent for the three accounts that hold your collection (1 NEAR per 100 KB of contract code). They have no keys, so it stays locked inside them. It is not a fee to Quorum. Anything you attach above the amount is returned.
              </span>
              <div style={{ height: 1, background: '#2A2A33' }} />
              <Row k="Launching from" v={account ?? 'no wallet connected yet'} />
              <span style={{ fontSize: 12, lineHeight: 1.6, color: '#71717A' }}>
                Pressing Launch uploads your pictures and metadata to public storage, then asks your wallet to approve ONE transaction. It creates your three contracts (NFTs, DAO, treasury), registers the collection on the market and opens the mint. Once launched, the art for this address name can never be replaced.
              </span>
              {progress && <div style={{ fontSize: 14, color: '#A1A1AA' }}>{progress}</div>}
              {error && <div style={{ fontSize: 13, color: '#FCA5A5', lineHeight: 1.5 }}>{error}</div>}
              <button type="submit" className="btn-primary" disabled={busy || (!!account && !okFor(4))} style={{ minHeight: 50, fontSize: 16, fontWeight: 600, opacity: busy || (!!account && !okFor(4)) ? 0.5 : 1 }}>
                {busy ? (progress ?? 'Launching…') : account ? <>Launch {name.trim() || 'my collection'} <Rocket size={16} /></> : <><Wallet size={16} /> Connect wallet to launch</>}
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {stage > 1 && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => go(stage - 1)} style={{ minHeight: 44, padding: '0 18px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <span style={{ flex: 1, minWidth: 160, fontSize: 13, color: stageHint ? '#FCD34D' : '#71717A', minHeight: 20 }}>{stageHint ?? (stage < 4 ? 'Looks good. Continue when you are ready.' : '')}</span>
          {stage < 4 && (
            <button type="button" className="btn-primary" disabled={!okFor(stage)} onClick={next} style={{ minHeight: 44, padding: '0 22px', fontSize: 15, fontWeight: 600, opacity: okFor(stage) ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Next: {STAGES[stage].title} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </form>

      {stage === 1 && collections.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <strong style={{ fontSize: 18 }}>Already live</strong>
          <div className="hscroll-cards hscroll-cards-sm">
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

const Review: React.FC<{ title: string; onEdit: () => void; disabled?: boolean; children: React.ReactNode }> = ({ title, onEdit, disabled, children }) => (
  <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <strong style={{ fontSize: 14 }}>{title}</strong>
      <button type="button" disabled={disabled} onClick={onEdit} style={{ background: 'none', border: 'none', color: '#F5A524', fontSize: 12, cursor: disabled ? 'default' : 'pointer' }}>Edit</button>
    </div>
    {children}
  </div>
);
const TraitAdder: React.FC<{ disabled: boolean; onAdd: (t: { type: string; value: string }) => void }> = ({ disabled, onAdd }) => {
  const [t, setT] = useState('');
  const [v, setV] = useState('');
  const add = () => { if (t.trim() && v.trim()) { onAdd({ type: t.trim().slice(0, 40), value: v.trim().slice(0, 40) }); setT(''); setV(''); } };
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <input style={{ ...small, minWidth: 0, flex: 1 }} value={t} onChange={(e) => setT(e.target.value)} placeholder="Trait" disabled={disabled} aria-label="Trait name" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
      <input style={{ ...small, minWidth: 0, flex: 1 }} value={v} onChange={(e) => setV(e.target.value)} placeholder="Value" disabled={disabled} aria-label="Trait value" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
      <button type="button" aria-label="Add trait" onClick={add} disabled={disabled} className="btn-secondary" style={{ minHeight: 0, padding: '0 8px', borderRadius: 9 }}><Plus size={13} /></button>
    </div>
  );
};

const Row: React.FC<{ k: string; v: string; accent?: boolean }> = ({ k, v, accent }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#A1A1AA' }}>
    <span>{k}</span>
    <strong style={{ color: accent ? '#86EFAC' : '#F4F4F5', whiteSpace: 'nowrap' }}>{v}</strong>
  </div>
);
