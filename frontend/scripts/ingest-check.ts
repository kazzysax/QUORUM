// Tests the Launch page's "drop everything" reader on the shapes of data people really have: a whole folder, per-piece
// JSON (0- or 1-based), one JSON list or object, a CSV, traits dropped before the pictures, and messy input.
// Usage (from frontend/): node scripts/ingest-check.ts
import fs from 'node:fs';
import path from 'node:path';
import { ingest } from '../src/launchArt.ts';
import type { Dropped, Piece, Source } from '../src/launchArt.ts';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') => { (ok ? pass++ : fail++); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const type = (n: string) => ({ png: 'image/png', jpg: 'image/jpeg', json: 'application/json', csv: 'text/csv' } as Record<string, string>)[n.split('.').pop()!] ?? 'text/plain';
const mem = (p: string, data: Buffer | string): Dropped => ({ path: p, file: new File([data], path.basename(p), { type: type(p) }) });
const img = (p: string) => mem(p, PNG);
const json = (p: string, o: unknown) => mem(p, JSON.stringify(o));
const attrs = (v: Record<string, string | number>) => Object.entries(v).map(([trait_type, value]) => ({ trait_type, value }));
const tv = (p: Piece, t: string) => p.traits.find((x) => x.type === t)?.value;

function walkDir(dir: string, prefix = ''): Dropped[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walkDir(path.join(dir, e.name), `${prefix}${e.name}/`) : [{ path: prefix + e.name, file: new File([fs.readFileSync(path.join(dir, e.name))], e.name, { type: type(e.name) }) }]);
}

// ---------------------------------------------------------------- 1. the whole OEN folder, dropped as it is
console.log('== 1. a whole folder (images, metadata/, collection/, TRAITS.csv, PREVIEW, BRIEF.txt) dropped at once');
const folder = walkDir('C:/Users/HP/Desktop/OEN-Collection', 'OEN-Collection/');
const r1 = await ingest(folder, [], []);
check('20 pieces, in order, from images/ only', r1.pieces.length === 20 && r1.pieces[0].file.name === '1.png' && r1.pieces[19].file.name === '20.png', `${r1.pieces.length} pieces`);
check('cover.jpg and avatar.png are recognised, not made into pieces', r1.cover?.name === 'cover.jpg' && r1.avatar?.name === 'avatar.png');
check('the preview sheet, BRIEF.txt and collection.json are ignored, and said so', r1.warnings.some((w) => /PREVIEW-all-20\.png/.test(w) && /BRIEF\.txt/.test(w) && /collection\.json/.test(w)), r1.warnings.find((w) => w.startsWith('Not used')) ?? '');
check('every piece got its 6 traits (CSV and the per-piece JSON agree)', r1.pieces.every((p) => p.traits.length === 6), `${r1.pieces.filter((p) => p.traits.length === 6).length}/20`);
check('piece 11 is the one-of-one Aurora', tv(r1.pieces[10], 'Palette') === 'Aurora');
check('piece names come from the metadata ("OEN #11")', r1.pieces[10].name === 'OEN #11');
check('no warnings about missing traits', !r1.warnings.some((w) => /No traits found/.test(w)));
console.log('      report:', r1.report.join(' | '));

// ---------------------------------------------------------------- 2. 0-based per-piece JSON (typical generator output)
console.log('\n== 2. 0-based pictures 0..4.png with 0..4.json (OpenSea style attributes)');
const r2 = await ingest([...[4, 2, 0, 3, 1].map((n) => img(`${n}.png`)), ...[0, 1, 2, 3, 4].map((n) => json(`${n}.json`, { name: `Hero ${n}`, attributes: attrs({ Level: n, Mood: `m${n}` }) }))], [], []);
check('pieces ordered 0,1,2,3,4 and each got its own JSON (matched by file name)', r2.pieces.map((p) => `${p.file.name}:${tv(p, 'Level')}:${p.name}`).join(' ') === '0.png:0:Hero 0 1.png:1:Hero 1 2.png:2:Hero 2 3.png:3:Hero 3 4.png:4:Hero 4');
check('numbers from JSON become text values', tv(r2.pieces[3], 'Level') === '3');

// ---------------------------------------------------------------- 3. one JSON list with an `edition` field, pictures named cat_001...
console.log('\n== 3. one JSON list with "edition" and pictures cat_001.png ... cat_003.png');
const r3 = await ingest([img('cat_003.png'), img('cat_001.png'), img('cat_002.png'), json('metadata.json', [{ edition: 3, attributes: attrs({ Fur: 'Black' }) }, { edition: 1, attributes: attrs({ Fur: 'White' }) }, { edition: 2, attributes: attrs({ Fur: 'Grey' }) }])], [], []);
check('edition 1 -> cat_001, 2 -> cat_002, 3 -> cat_003 (matched by number)', r3.pieces.map((p) => tv(p, 'Fur')).join(',') === 'White,Grey,Black');

// ---------------------------------------------------------------- 4. an object keyed by piece number, traits as a plain object
console.log('\n== 4. one JSON object keyed by number, traits as {"Color":"Red"}');
const r4 = await ingest([img('1.png'), img('2.png'), json('all.json', { 1: { name: 'One', traits: { Color: 'Red', Size: 3 } }, 2: { traits: { Color: 'Blue' } } })], [], []);
check('keys line up with 1.png and 2.png, plain-object traits read', tv(r4.pieces[0], 'Color') === 'Red' && tv(r4.pieces[0], 'Size') === '3' && tv(r4.pieces[1], 'Color') === 'Blue' && r4.pieces[0].name === 'One');

// ---------------------------------------------------------------- 5. traits first, pictures later, then more pictures
console.log('\n== 5. the CSV is dropped BEFORE the pictures, which arrive in two drops');
const csv = 'token,name,Hat,Eyes\n1,Alpha,Cap,Green\n2,Beta,Crown,Blue\n3,Gamma,None,Red\n';
const a = await ingest([mem('traits.csv', csv)], [], []);
check('nothing to match yet; the file is remembered and says so', a.pieces.length === 0 && a.sources.length === 1 && a.report.some((r) => /line up when the pictures are added/.test(r)));
const b = await ingest([img('1.png'), img('2.png')], a.pieces, a.sources);
check('pictures 1 and 2 pick up their traits and names from the remembered CSV', tv(b.pieces[0], 'Hat') === 'Cap' && b.pieces[1].name === 'Beta' && tv(b.pieces[1], 'Eyes') === 'Blue');
const c = await ingest([img('3.png')], b.pieces, b.sources);
check('a later picture 3 also picks up its row, earlier pieces are untouched', c.pieces.length === 3 && tv(c.pieces[2], 'Eyes') === 'Red' && tv(c.pieces[0], 'Hat') === 'Cap');

// ---------------------------------------------------------------- 6. CSV keyed by file name
console.log('\n== 6. CSV whose first column is the file name');
const r6 = await ingest([img('sun.png'), img('moon.png'), mem('t.csv', 'file,Kind\nmoon.png,Night\nsun.png,Day\n')], [], []);
check('rows follow the file names, not the row order', tv(r6.pieces.find((p) => p.file.name === 'sun.png')!, 'Kind') === 'Day' && tv(r6.pieces.find((p) => p.file.name === 'moon.png')!, 'Kind') === 'Night');

// ---------------------------------------------------------------- 7. messy input is reported, never silently dropped
console.log('\n== 7. mismatches, duplicates, bad files');
const r7 = await ingest([img('a/1.png'), img('b/1.png'), img('2.png'), json('x.json', [{ token: 9, attributes: attrs({ A: 'b' }) }, { token: 1, attributes: attrs({ A: 'one' }) }]), mem('broken.json', '{not json'), mem('notes.txt', 'hello'), mem('data.csv', 'a,b\n1,2\n')], [], []);
check('a duplicate picture name is skipped with a warning', r7.pieces.length === 2 && r7.warnings.some((w) => /same name/.test(w)));
check('an entry for token 9 that matches no picture is reported', r7.warnings.some((w) => /matched no picture \(9\)/.test(w)));
check('a piece with no traits is reported by number', r7.warnings.some((w) => /No traits found for 1 piece: #2/.test(w)), r7.warnings.find((w) => /No traits/.test(w)) ?? '');
check('invalid JSON, a text file and a CSV without a token column are reported', r7.warnings.some((w) => /broken\.json is not valid JSON/.test(w)) && r7.warnings.some((w) => /notes\.txt/.test(w)) && r7.warnings.some((w) => /data\.csv: the first column must be called token/.test(w)));
const many = await ingest(Array.from({ length: 105 }, (_, i) => img(`${i + 1}.png`)), [], []);
check('more than 100 pictures: the first 100 are kept and the rest reported', many.pieces.length === 100 && many.warnings.some((w) => /at most 100/.test(w)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
