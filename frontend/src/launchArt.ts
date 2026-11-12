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

/** 1.png, 2.png, 10.png in the order a person expects (not 1, 10, 2). */
export function naturalSort(files: File[]): File[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

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

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function makePieces(files: File[], startAt: number): Promise<{ pieces: Piece[]; skipped: string[] }> {
  const pieces: Piece[] = [];
  const skipped: string[] = [];
  for (const f of naturalSort(files)) {
    if (!IMAGE_TYPES.includes(f.type)) { skipped.push(`${f.name} (not a PNG, JPG, WEBP or GIF)`); continue; }
    if (startAt + pieces.length >= MAX_PIECES) { skipped.push(`${f.name} (a launch holds at most ${MAX_PIECES} pieces)`); continue; }
    try {
      const fitted = await fitImage(f);
      pieces.push({ key: ++counter, file: fitted, preview: URL.createObjectURL(fitted), name: '', traits: [] });
    } catch (e: any) { skipped.push(String(e?.message || f.name)); }
  }
  return { pieces, skipped };
}

// ------------------------------------------------------------------ traits from a CSV

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

/**
 * Reads a CSV whose first column identifies the piece (token, id, number, piece, # or file/filename/image) and
 * whose other columns are traits. A `name` column renames the piece. Returns how many pieces it matched.
 */
export function applyTraitsCsv(text: string, pieces: Piece[]): { next: Piece[]; matched: number } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('The CSV needs a header row and at least one piece.');
  const header = splitCsvLine(lines[0]);
  const idCol = header.findIndex((h) => /^(token|id|number|piece|#|file|filename|image)$/i.test(h));
  if (idCol < 0) throw new Error('The first column must be called token (or id, number, piece, file).');
  const next = pieces.map((p) => ({ ...p, traits: [...p.traits] }));
  let matched = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const ident = cells[idCol] ?? '';
    const idx = /^\d+$/.test(ident) ? Number(ident) - 1 : next.findIndex((p) => stem(p.file.name).toLowerCase() === stem(ident).toLowerCase());
    if (idx < 0 || idx >= next.length) continue;
    const traits: Trait[] = [];
    header.forEach((h, i) => {
      if (i === idCol || !h) return;
      const v = (cells[i] ?? '').trim();
      if (/^name$/i.test(h)) { if (v) next[idx].name = v; return; }
      if (v) traits.push({ type: h.slice(0, 40), value: v.slice(0, 40) });
    });
    next[idx].traits = traits.slice(0, MAX_TRAITS);
    matched++;
  }
  return { next, matched };
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
