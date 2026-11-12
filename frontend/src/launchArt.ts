// Everything a creator does with their art on the Launch page: order the pictures, name them, give them traits
// (typed in or imported from a CSV), and upload pictures + metadata files to public storage before launching.
import { upload } from '@vercel/blob/client';

export const MAX_PIECES = 100;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_TRAITS = 12;

export interface Trait { type: string; value: string }
export interface Piece {
  key: number;
  file: File;
  preview: string;
  name: string;
  traits: Trait[];
}

let counter = 0;
const stem = (n: string) => n.replace(/\.[^.]+$/, '');

/** A picture over the size limit is scaled down in the browser (JPEG) instead of being refused. */
async function fitImage(file: File): Promise<File> {
  if (file.size <= MAX_IMAGE_BYTES) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} is too large even after shrinking (limit 3 MB).`);
  return new File([blob], stem(file.name) + '.jpg', { type: 'image/jpeg' });
}

const IMAGE_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const ext = (n: string) => (n.split('.').pop() ?? '').toLowerCase();
const base = (p: string) => p.split(/[\\/]/).pop() ?? p;
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const trailing = (s: string) => { const m = /(\d+)$/.exec(s); return m ? Number(m[1]) : null; };

// ------------------------------------------------------------------ reading whatever is dropped

/** One dropped file with where it came from ("OEN/images/1.png" when a folder was dropped, else just its name). */
export interface Dropped { file: File; path: string }

/** Files from a file picker (a folder pick carries each file's path). */
export function fromFileList(list: FileList | File[]): Dropped[] {
  return Array.from(list).map((f) => ({ file: f, path: (f as any).webkitRelativePath || f.name }));
}

async function walk(entry: any, prefix: string, out: Dropped[]): Promise<void> {
  if (entry.isFile) {
    const file: File = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ file, path: prefix + entry.name });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let batch: any[];
    do {
      batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      for (const child of batch) await walk(child, `${prefix}${entry.name}/`, out);
    } while (batch.length);
  }
}

/** Everything inside a drop, including the contents of any folders dropped. */
export async function collectDropped(dt: DataTransfer): Promise<Dropped[]> {
  // The entries must be taken now: the drop's items are gone once this function first waits.
  const entries = Array.from(dt.items ?? []).map((i: any) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return fromFileList(dt.files);
  const out: Dropped[] = [];
  for (const e of entries) await walk(e, '', out);
  return out;
}

// ------------------------------------------------------------------ traits from CSV and JSON

/** A traits row or JSON entry, and the names it may be known by (file name, token number). */
interface Rec { idents: string[]; name?: string; traits: Trait[] }
/** A traits file that has been read. Kept, so traits dropped before the pictures still line up when the pictures arrive. */
export interface Source { label: string; records: Rec[] }

const ID_COLUMN = /^(token|token_id|tokenid|id|number|piece|edition|#|file|filename|image)$/i;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text: string): Rec[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('needs a header row and at least one piece');
  const header = splitCsvLine(lines[0]);
  const idCol = header.findIndex((h) => ID_COLUMN.test(h));
  if (idCol < 0) throw new Error('the first column must be called token (or id, number, piece, file)');
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const rec: Rec = { idents: [cells[idCol] ?? ''], traits: [] };
    header.forEach((h, i) => {
      if (i === idCol || !h) return;
      const v = (cells[i] ?? '').trim();
      if (/^name$/i.test(h)) { if (v) rec.name = v.slice(0, 60); return; }
      if (v) rec.traits.push({ type: h.slice(0, 40), value: v.slice(0, 40) });
    });
    rec.traits = rec.traits.slice(0, MAX_TRAITS);
    return rec;
  });
}

const prim = (v: unknown) => (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') ? String(v).trim() : '';

/** Traits from the shapes people have: OpenSea attributes, a traits/properties object, or a list of either. */
function traitsOf(o: any): Trait[] {
  const out: Trait[] = [];
  const list = Array.isArray(o.attributes) ? o.attributes : Array.isArray(o.traits) ? o.traits : null;
  if (list) {
    for (const a of list) {
      const type = prim(a?.trait_type ?? a?.type ?? a?.name ?? a?.key), value = prim(a?.value);
      if (type && value) out.push({ type: type.slice(0, 40), value: value.slice(0, 40) });
    }
  } else {
    const obj = o.traits && typeof o.traits === 'object' ? o.traits : o.properties && typeof o.properties === 'object' ? o.properties : null;
    if (obj) for (const [k, v] of Object.entries(obj)) { const value = prim(v); if (k && value) out.push({ type: k.slice(0, 40), value: value.slice(0, 40) }); }
  }
  return out.slice(0, MAX_TRAITS);
}

const isPieceObject = (o: any) => o && typeof o === 'object' && !Array.isArray(o) && (Array.isArray(o.attributes) || Array.isArray(o.traits) || (o.traits && typeof o.traits === 'object') || (o.properties && typeof o.properties === 'object'));

function identsOf(o: any): string[] {
  const out = [o.token, o.token_id, o.tokenId, o.id, o.edition, o.number, o.file, o.filename]
    .filter((v) => v !== undefined && v !== null).map(String);
  if (typeof o.image === 'string') out.push(base(o.image));
  return out;
}

/** One piece, a list of pieces, or an object keyed by piece number or file name. Anything else is not a traits file. */
function parseJson(text: string, fileName: string): Rec[] | null {
  const data = JSON.parse(text);
  const rec = (o: any, idents: string[]): Rec => ({ idents, name: prim(o.name).slice(0, 60) || undefined, traits: traitsOf(o) });
  if (Array.isArray(data)) {
    // An entry that names its own token never falls back to its position in the list (it would hit the wrong piece).
    const recs = data.filter(isPieceObject).map((o, i) => { const own = identsOf(o); return rec(o, own.length ? own : [String(i + 1)]); });
    return recs.length ? recs : null;
  }
  if (isPieceObject(data)) return [rec(data, [stem(fileName), ...identsOf(data)])];
  if (data && typeof data === 'object') {
    const recs = Object.entries(data).filter(([, v]) => isPieceObject(v)).map(([k, v]) => rec(v, [k, ...identsOf(v)]));
    return recs.length ? recs : null;
  }
  return null;
}

/**
 * Which picture does this entry belong to? First the same file name (7.json goes with 7.png, cat-007.csv rows with
 * cat-007.png), then the same number (so 0-based and 1-based files both line up), then, only if no picture carries a
 * number at all, its position in the list.
 */
function matchPiece(idents: string[], pieces: Piece[]): number {
  for (const raw of idents) {
    const id = stem(base(String(raw).trim())).toLowerCase();
    if (!id) continue;
    const byStem = pieces.findIndex((p) => stem(p.file.name).toLowerCase() === id);
    if (byStem >= 0) return byStem;
    if (/^\d+$/.test(id)) {
      const n = Number(id);
      const byNumber = pieces.map((p, i) => [trailing(stem(p.file.name)), i] as const).filter(([t]) => t === n);
      if (byNumber.length === 1) return byNumber[0][1];
      if (byNumber.length === 0 && pieces.every((p) => trailing(stem(p.file.name)) === null) && n >= 1 && n <= pieces.length) return n - 1;
    }
  }
  return -1;
}

function applySource(src: Source, pieces: Piece[], only: Set<number> | null): { matched: Set<number>; unmatched: string[] } {
  const matched = new Set<number>(), unmatched: string[] = [];
  for (const r of src.records) {
    const i = matchPiece(r.idents, pieces);
    if (i < 0) { unmatched.push(r.idents[0] ?? '?'); continue; }
    if (only && !only.has(pieces[i].key)) continue;
    pieces[i].traits = r.traits;
    if (r.name) pieces[i].name = r.name;
    matched.add(pieces[i].key);
  }
  return { matched, unmatched };
}

export interface IngestResult {
  pieces: Piece[];
  sources: Source[];
  cover: File | null;
  avatar: File | null;
  report: string[];
  warnings: string[];
}

/**
 * Takes whatever was dropped (pictures, a CSV, JSON files, a whole folder, in any order or in several drops) and
 * lines it up: pictures become numbered pieces in file-name order, cover/avatar pictures are recognised by name, and
 * every traits file is matched to its pictures. Files it does not understand are reported, never silently dropped.
 */
export async function ingest(dropped: Dropped[], existing: Piece[], oldSources: Source[]): Promise<IngestResult> {
  const report: string[] = [], warnings: string[] = [], ignored: string[] = [];
  const newSources: Source[] = [];
  let cover: File | null = null, avatar: File | null = null;
  const imageFiles: Dropped[] = [];

  for (const d of dropped) {
    const name = d.file.name, e = ext(name), st = stem(name).toLowerCase();
    if (IMAGE_EXT[e]) {
      if (/^(cover|banner|header)([-_ ]?\d+)?$/.test(st)) cover = d.file;
      else if (/^(avatar|logo|icon|profile|pfp)$/.test(st)) avatar = d.file;
      else if (/^(preview|contact|sheet|thumb|thumbnail)/.test(st) || /\/(preview|previews|thumbs|thumbnails)\//i.test(d.path)) ignored.push(name);
      else imageFiles.push(d);
    } else if (e === 'csv') {
      try { newSources.push({ label: name, records: parseCsv(await d.file.text()) }); } catch (err: any) { warnings.push(`${name}: ${err.message}`); }
    } else if (e === 'json') {
      try {
        const recs = parseJson(await d.file.text(), name);
        if (recs) newSources.push({ label: name, records: recs }); else ignored.push(name);
      } catch { warnings.push(`${name} is not valid JSON, skipped.`); }
    } else ignored.push(name);
  }

  // Pictures -> pieces, in file-name order.
  imageFiles.sort((a, b) => natural(a.file.name, b.file.name));
  const fresh: Piece[] = [];
  const seen = new Set(existing.map((p) => stem(p.file.name).toLowerCase()));
  for (const d of imageFiles) {
    const s = stem(d.file.name).toLowerCase();
    if (seen.has(s)) { warnings.push(`${d.file.name}: another picture has the same name, skipped.`); continue; }
    if (existing.length + fresh.length >= MAX_PIECES) { warnings.push(`${d.file.name}: a launch holds at most ${MAX_PIECES} pieces, skipped.`); continue; }
    try {
      const fitted = await fitImage(d.file);
      seen.add(s);
      fresh.push({ key: ++counter, file: fitted, preview: URL.createObjectURL(fitted), name: '', traits: [] });
    } catch (err: any) { warnings.push(String(err?.message || d.file.name)); }
  }
  if (fresh.length) report.push(`Added ${fresh.length} ${fresh.length === 1 ? 'picture' : 'pictures'}.`);

  // Traits: new files go to every piece, files read earlier go to the pictures that just arrived.
  const pieces = [...existing.map((p) => ({ ...p, traits: [...p.traits] })), ...fresh];
  const freshKeys = new Set(fresh.map((p) => p.key));
  const sources = [...oldSources, ...newSources];
  const everMatched = new Set<number>(existing.filter((p) => p.traits.length).map((p) => p.key));
  if (fresh.length && oldSources.length) {
    const hit = new Set<number>();
    for (const s of oldSources) applySource(s, pieces, freshKeys).matched.forEach((k) => { everMatched.add(k); hit.add(k); });
    report.push(`Traits files you dropped earlier matched ${hit.size} of the ${fresh.length} new pieces.`);
  }
  // One file per piece (7.json, 8.json ...) is reported as one group, not one line per file.
  const single = (s: Source) => s.records.length === 1 && /\.json$/i.test(s.label);
  const groups: { label: string; list: Source[] }[] = [];
  const singles = newSources.filter(single);
  if (singles.length > 1) groups.push({ label: `${singles.length} metadata files`, list: singles });
  for (const s of newSources) if (singles.length <= 1 || !single(s)) groups.push({ label: s.label, list: [s] });
  for (const g of groups) {
    const matched = new Set<number>(), unmatched: string[] = [];
    for (const s of g.list) { const r = applySource(s, pieces, null); r.matched.forEach((k) => matched.add(k)); unmatched.push(...r.unmatched); }
    matched.forEach((k) => everMatched.add(k));
    const entries = g.list.reduce((n, s) => n + s.records.length, 0);
    if (pieces.length) report.push(`${g.label}: traits matched to ${matched.size} of ${pieces.length} pieces.`);
    else report.push(`${g.label}: read ${entries} ${entries === 1 ? 'entry' : 'entries'}; they will line up when the pictures are added.`);
    if (pieces.length && unmatched.length) warnings.push(`${g.label}: ${unmatched.length} ${unmatched.length === 1 ? 'entry' : 'entries'} matched no picture (${unmatched.slice(0, 4).join(', ')}${unmatched.length > 4 ? ', …' : ''}).`);
  }
  if (sources.length && pieces.length) {
    const bare = pieces.map((p, i) => [p, i] as const).filter(([p]) => !everMatched.has(p.key) && !p.traits.length).map(([, i]) => `#${i + 1}`);
    if (bare.length) warnings.push(`No traits found for ${bare.length} ${bare.length === 1 ? 'piece' : 'pieces'}: ${bare.slice(0, 8).join(', ')}${bare.length > 8 ? ', …' : ''}.`);
  }
  if (cover) report.push(`Cover picture: ${cover.name}.`);
  if (avatar) report.push(`Avatar picture: ${avatar.name}.`);
  if (ignored.length) warnings.push(`Not used: ${ignored.slice(0, 5).join(', ')}${ignored.length > 5 ? ` and ${ignored.length - 5} more` : ''}.`);
  return { pieces, sources, cover, avatar, report, warnings };
}
// ------------------------------------------------------------------ upload

export interface ArtLinks { metadata_base_url: string; media_base_url: string; cover_url: string; avatar_url: string }

// In the browser the endpoint is on the same site; outside a browser (the upload test) it needs the full address.
const HANDLER = `${typeof location === 'undefined' ? 'https://quorumio.vercel.app' : ''}/api/blob`;

async function put(pathname: string, body: Blob | File, contentType: string): Promise<string> {
  const r = await upload(pathname, body, { access: 'public', handleUploadUrl: HANDLER, contentType });
  return r.url;
}

/** Runs `jobs` with a few at a time. */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i]); }
  }));
}

/**
 * Uploads every picture and its metadata file, plus the cover and avatar, and returns the folders to give the
 * factory. Piece N's picture is `<media_base_url>/N` and its metadata `<metadata_base_url>/metadata/N.json`.
 */
export async function uploadArt(
  slug: string, collectionName: string, description: string, pieces: Piece[], cover: File | null, avatar: File | null,
  onProgress: (done: number, total: number) => void,
): Promise<ArtLinks> {
  const total = pieces.length * 2 + 2;
  let done = 0;
  const tick = () => onProgress(++done, total);
  const base = `launches/${slug}`;
  let mediaBase = '';

  await pool(pieces.map((p, i) => ({ p, n: i + 1 })), 4, async ({ p, n }) => {
    const url = await put(`${base}/media/${n}`, p.file, p.file.type);
    if (n === 1) mediaBase = url.replace(/\/1$/, '');
    tick();
  });
  if (!mediaBase) throw new Error('The pictures did not upload.');
  const origin = mediaBase.replace(/\/launches\/.*$/, '');
  const metaBase = `${origin}/${base}`;

  await pool(pieces.map((p, i) => ({ p, n: i + 1 })), 4, async ({ p, n }) => {
    const meta = {
      name: p.name.trim() || `${collectionName.trim() || 'Piece'} #${n}`,
      description,
      image: `${mediaBase}/${n}`,
      attributes: p.traits.filter((t) => t.type.trim() && t.value.trim()).map((t) => ({ trait_type: t.type.trim(), value: t.value.trim() })),
    };
    await put(`${base}/metadata/${n}.json`, new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' }), 'application/json');
    tick();
  });

  const coverFile = cover ?? pieces[0].file, avatarFile = avatar ?? pieces[0].file;
  const coverUrl = await put(`${base}/cover`, coverFile, coverFile.type); tick();
  const avatarUrl = await put(`${base}/avatar`, avatarFile, avatarFile.type); tick();
  return { metadata_base_url: metaBase, media_base_url: mediaBase, cover_url: coverUrl, avatar_url: avatarUrl };
}
