// Checks the live upload endpoint the way the Launch page uses it: allowed files go through and are served with the
// right type; everything else is refused. Usage (from frontend/): node scripts/upload-check.mjs [site]
import { upload } from '@vercel/blob/client';

const SITE = process.argv[2] || 'https://quorumio.vercel.app';
const handleUploadUrl = `${SITE}/api/blob`;
const SLUG = 'zz-upload-test';
// a valid 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { (ok ? pass++ : fail++); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const tryUpload = async (path, body, contentType) => { try { return { ok: true, url: (await upload(path, body, { access: 'public', handleUploadUrl, contentType })).url }; } catch (e) { return { ok: false, err: String(e.message || e) }; } };

const img = await tryUpload(`launches/${SLUG}/media/1`, new Blob([PNG], { type: 'image/png' }), 'image/png');
check('a picture uploads', img.ok, img.url);
if (img.ok) { const r = await fetch(img.url); check('it is served publicly with the right type', r.ok && r.headers.get('content-type') === 'image/png', r.headers.get('content-type')); }
const meta = await tryUpload(`launches/${SLUG}/metadata/1.json`, new Blob([JSON.stringify({ name: 'x' })], { type: 'application/json' }), 'application/json');
check('a metadata file uploads', meta.ok);
if (meta.ok) check('it is served as JSON', (await (await fetch(meta.url)).json()).name === 'x');
check('cover and avatar paths are allowed', (await tryUpload(`launches/${SLUG}/cover`, new Blob([PNG], { type: 'image/png' }), 'image/png')).ok && (await tryUpload(`launches/${SLUG}/avatar`, new Blob([PNG], { type: 'image/png' }), 'image/png')).ok);

const bad = async (name, path, body, type) => { const r = await tryUpload(path, body, type); check(name, !r.ok, r.ok ? 'UNEXPECTEDLY ALLOWED' : r.err.slice(0, 90)); };
await bad('a path outside launches/ is refused', 'other/x.png', new Blob([PNG], { type: 'image/png' }), 'image/png');
await bad('an odd file location is refused', `launches/${SLUG}/evil.html`, new Blob(['<script>'], { type: 'text/html' }), 'text/html');
await bad('a script cannot pose as a picture', `launches/${SLUG}/media/2`, new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'text/html');
await bad('piece 101 is refused (100 pieces at most)', `launches/${SLUG}/media/101`, new Blob([PNG], { type: 'image/png' }), 'image/png');
await bad('a picture over 3 MB is refused', `launches/${SLUG}/media/3`, new Blob([Buffer.alloc(3 * 1024 * 1024 + 10)], { type: 'image/png' }), 'image/png');
await bad('a collection name that is already launched is closed (launchcheck)', 'launches/launchcheck/media/1', new Blob([PNG], { type: 'image/png' }), 'image/png');
await bad('a collection that exists is closed (molten)', 'launches/molten/metadata/1.json', new Blob(['{}'], { type: 'application/json' }), 'application/json');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
