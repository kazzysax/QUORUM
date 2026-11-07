#!/usr/bin/env node
// Prints the base58 code hash NEAR uses for a global contract: sha256 of the wasm.
import fs from "node:fs"; import crypto from "node:crypto";
const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const h = crypto.createHash("sha256").update(fs.readFileSync(process.argv[2])).digest();
let n = 0n; for (const b of h) n = (n << 8n) | BigInt(b);
let s = ""; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; }
console.log(s);
