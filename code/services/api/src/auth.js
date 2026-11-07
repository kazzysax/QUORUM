// Challenge -> NEP-413 signature -> on-chain checks -> short-lived session.
// Holder access is re-checked on every gated request, so a seller or burner
// loses access as soon as final state shows they no longer hold a token.
import crypto from "node:crypto";
import { verifyNep413 } from "./nep413.js";

export const SESSION_MS = 15 * 60 * 1000;
const CHALLENGE_MS = 5 * 60 * 1000;
export const LOGIN_MESSAGE = "Sign in to Quorum. This proves you control this account and sends no transaction.";

export function createChallenge(db, now = Date.now()) {
  const nonce = crypto.randomBytes(32);
  db.prepare("DELETE FROM challenges WHERE expires_at < ?").run(now);
  db.prepare("INSERT INTO challenges(nonce, expires_at) VALUES (?, ?)").run(nonce.toString("base64"), now + CHALLENGE_MS);
  return { message: LOGIN_MESSAGE, nonce: nonce.toString("base64") };
}

/** Single use: a nonce is deleted the first time it is presented. */
function consumeChallenge(db, nonceB64, now) {
  const row = db.prepare("SELECT expires_at FROM challenges WHERE nonce=?").get(nonceB64);
  if (!row) return false;
  db.prepare("DELETE FROM challenges WHERE nonce=?").run(nonceB64);
  return row.expires_at >= now;
}

export async function login({ db, chain, cfg, now = Date.now() }, { accountId, publicKey, signature, nonce }) {
  if (!consumeChallenge(db, nonce, now)) return { error: "challenge expired or already used", status: 401 };
  const ok = verifyNep413({
    message: LOGIN_MESSAGE, nonce: Buffer.from(nonce, "base64"), recipient: cfg.appRecipient, publicKey, signature,
  });
  if (!ok) return { error: "bad signature", status: 401 };
  if (!(await chain.hasAccessKey(accountId, publicKey))) return { error: "key does not belong to this account", status: 401 };
  if (!(await chain.holdsToken(accountId))) return { error: "no Quorum NFT held by this account", status: 403 };
  return { token: signSession(cfg.sessionSecret, accountId, now + SESSION_MS), accountId, expiresAt: now + SESSION_MS };
}

const b64u = (b) => Buffer.from(b).toString("base64url");

export function signSession(secret, accountId, exp) {
  const body = b64u(JSON.stringify({ a: accountId, e: exp }));
  const mac = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function readSession(secret, token, now = Date.now()) {
  const [body, mac] = String(token || "").split(".");
  if (!body || !mac) return null;
  const want = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(mac), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString());
    return s.e >= now ? s.a : null;
  } catch { return null; }
}
