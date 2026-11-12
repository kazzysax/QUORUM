// Upload endpoint for launch art. The browser uploads straight to Vercel Blob; this function only decides
// WHETHER a given upload may happen (and hands out a one-file token). It holds no keys of its own beyond the
// Blob token that Vercel injects, and it never sees the files.
//
// Allowed, and nothing else:
//   launches/<name>/media/<n>        a picture of piece n   (png, jpeg, webp, gif; up to 3 MB; n up to 100)
//   launches/<name>/metadata/<n>.json  the metadata of piece n (json; up to 20 KB)
//   launches/<name>/cover            the collection's cover picture
//   launches/<name>/avatar           the collection's avatar picture
// A collection name that has already been launched is closed: its art can never be replaced.
import { handleUpload } from '@vercel/blob/client';

const FACTORY = 'launch.qrmx-founder1.testnet';
const RPC = ['https://near-testnet.drpc.org', 'https://test.rpc.fastnear.com', 'https://rpc.testnet.near.org'];
const PATH = /^launches\/([a-z0-9][a-z0-9-]{1,14}[a-z0-9])\/(media\/(\d{1,3})|metadata\/(\d{1,3})\.json|cover|avatar)$/;
const IMAGES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
/** The built-in collections and words that would make a confusing address. Their names are never open for uploads. */
const RESERVED = new Set(['molten', 'molten-hours', 'tidewater', 'feather', 'feather-protocol', 'market', 'factory', 'launch', 'vault', 'quorum', 'admin']);

/** Has this address name already been launched? Fails closed: if the chain cannot be read, no upload. */
async function slugTaken(slug) {
  const body = { jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: FACTORY, method_name: 'slug_taken', args_base64: Buffer.from(JSON.stringify({ slug })).toString('base64') } };
  for (const url of RPC) {
    try {
      const r = await (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
      if (r.result?.result) return JSON.parse(Buffer.from(r.result.result).toString()) === true;
    } catch { /* try the next endpoint */ }
  }
  throw new Error('Could not check the collection name on chain. Try again in a moment.');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const m = PATH.exec(pathname);
        if (!m) throw new Error('That file location is not allowed.');
        const piece = Number(m[3] ?? m[4] ?? 1);
        if (piece < 1 || piece > 100) throw new Error('A launch can have 1 to 100 pieces.');
        if (RESERVED.has(m[1])) throw new Error('That collection name is reserved.');
        if (await slugTaken(m[1])) throw new Error('That collection name is already launched, its art is closed.');
        const isJson = m[2].startsWith('metadata/');
        return {
          allowedContentTypes: isJson ? ['application/json'] : IMAGES,
          maximumSizeInBytes: isJson ? 20 * 1024 : 3 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: true, // the creator may re-upload while preparing; closed for good once launched
          cacheControlMaxAge: 60,
        };
      },
      onUploadCompleted: async () => { /* nothing to record: the chain is the record */ },
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
