// NEP-413 off-chain message signing: verify what a wallet's signMessage returns.
import crypto from "node:crypto";
import nacl from "tweetnacl";

const TAG = 2147484061; // 2^31 + 413

const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const str = (s) => { const b = Buffer.from(s, "utf8"); return Buffer.concat([u32(b.length), b]); };

/** The exact bytes a wallet signs: sha256(borsh(tag) ++ borsh(payload)). */
export function signedHash({ message, nonce, recipient, callbackUrl }) {
  if (nonce.length !== 32) throw new Error("nonce must be 32 bytes");
  const payload = Buffer.concat([
    str(message), Buffer.from(nonce), str(recipient),
    callbackUrl ? Buffer.concat([Buffer.from([1]), str(callbackUrl)]) : Buffer.from([0]),
  ]);
  return crypto.createHash("sha256").update(Buffer.concat([u32(TAG), payload])).digest();
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58decode(s) {
  let n = 0n;
  for (const c of s) { const i = ALPHABET.indexOf(c); if (i < 0) throw new Error("bad base58"); n = n * 58n + BigInt(i); }
  let hex = n.toString(16); if (hex.length % 2) hex = "0" + hex;
  const bytes = Buffer.from(hex === "00" ? "" : hex, "hex");
  const zeros = [...s].findIndex((c) => c !== "1");
  return Buffer.concat([Buffer.alloc(zeros === -1 ? s.length : zeros), bytes]);
}

export function parsePublicKey(pk) {
  const m = /^ed25519:(.+)$/.exec(pk);
  if (!m) throw new Error("only ed25519 keys are supported");
  const key = base58decode(m[1]);
  if (key.length !== 32) throw new Error("bad public key length");
  return key;
}

export function verifyNep413({ message, nonce, recipient, callbackUrl, publicKey, signature }) {
  try {
    const hash = signedHash({ message, nonce, recipient, callbackUrl });
    return nacl.sign.detached.verify(hash, Buffer.from(signature, "base64"), parsePublicKey(publicKey));
  } catch { return false; }
}
