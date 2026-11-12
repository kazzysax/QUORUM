// Runs the Launch page's real art code (traits CSV -> uploads -> links) against the live upload endpoint with three of
// the OEN pictures, and checks the result is exactly what the NFT contract will fetch. Usage (from frontend/):
//   node --env-file=.env.local scripts/art-flow-check.ts
import fs from 'node:fs';
import { list, del } from '@vercel/blob';
import { ingest, uploadArt } from '../src/launchArt.ts';

const OEN = 'C:/Users/HP/Desktop/OEN-Collection';
const SLUG = 'zz-art-test';
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') => { (ok ? pass++ : fail++); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

const dropped = [1, 2, 3].map((n) => ({ path: `${n}.png`, file: new File([fs.readFileSync(`${OEN}/images/${n}.png`)], `${n}.png`, { type: 'image/png' }) }));
dropped.push({ path: 'TRAITS.csv', file: new File([fs.readFileSync(`${OEN}/TRAITS.csv`)], 'TRAITS.csv', { type: 'text/csv' }) });
const got = await ingest(dropped, [], []);
const next = got.pieces;
check('the dropped pictures and the traits CSV line up by number', next.length === 3 && next[0].traits.length === 6, `${next.length} pieces, ${next[0].traits.length} traits on #1`);
next[1].name = 'Magenta world';

let last = '';
const links = await uploadArt(SLUG, 'OEN', 'Small worlds', next, got.cover, got.avatar, (d, t) => { last = `${d}/${t}`; });
check('every file uploaded (3 pictures + 3 metadata + cover + avatar)', last === '8/8', last);
check('links are on public https storage', Object.values(links).every((u) => u.startsWith('https://')), links.metadata_base_url);

// exactly what the NFT contract builds: <media_base_url>/<id> and <metadata_base_url>/metadata/<id>.json
const img = await fetch(`${links.media_base_url}/2`);
check('piece 2 picture is at <media_base_url>/2 and is an image', img.ok && /^image\//.test(img.headers.get('content-type') ?? ''), img.headers.get('content-type') ?? '');
const meta = await (await fetch(`${links.metadata_base_url}/metadata/1.json`)).json();
check('piece 1 metadata is at <metadata_base_url>/metadata/1.json with its traits', meta.name === 'OEN #1' && meta.attributes.length === 6 && meta.attributes[0].trait_type === 'Palette', `${meta.name}, ${meta.attributes.map((a: any) => a.value).join('/')}`);
check('its image link points at its picture', meta.image === `${links.media_base_url}/1`);
const m2 = await (await fetch(`${links.metadata_base_url}/metadata/2.json`)).json();
check('a custom piece name is kept', m2.name === 'Magenta world');
check('cover and avatar are served', (await fetch(links.cover_url)).ok && (await fetch(links.avatar_url)).ok);

const { blobs } = await list({ prefix: `launches/${SLUG}` });
await del(blobs.map((b) => b.url));
console.log(`cleaned up ${blobs.length} test files\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
