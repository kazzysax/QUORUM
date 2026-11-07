// Allowlist Merkle tree. MUST match contracts/nft/src/merkle.rs exactly:
// leaf = sha256(account id), parents hash the sorted pair, an odd node is promoted.
import crypto from "node:crypto";

const sha = (b) => crypto.createHash("sha256").update(b).digest();
const leaf = (acct) => sha(Buffer.from(acct, "utf8"));
const parent = (a, b) => (Buffer.compare(a, b) <= 0 ? sha(Buffer.concat([a, b])) : sha(Buffer.concat([b, a])));

export function buildTree(accounts) {
  if (!accounts.length) throw new Error("allowlist is empty");
  let level = accounts.map(leaf);
  const proofs = accounts.map(() => []);
  let pos = accounts.map((_, i) => i);
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        pos.forEach((p, k) => {
          if (p === i) proofs[k].push(level[i + 1]);
          if (p === i + 1) proofs[k].push(level[i]);
        });
        next.push(parent(level[i], level[i + 1]));
      } else next.push(level[i]);
    }
    pos = pos.map((p) => Math.floor(p / 2));
    level = next;
  }
  return { root: level[0], proofs: Object.fromEntries(accounts.map((a, i) => [a, proofs[i]])) };
}

export const toBase64 = (b) => b.toString("base64");
export const toHex = (b) => b.toString("hex");
