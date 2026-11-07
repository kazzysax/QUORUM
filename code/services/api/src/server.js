import { openDb } from "./db.js";
import { buildApp } from "./app.js";
import { chainClient } from "./chain.js";
import { runIndexer } from "./indexer.js";

const need = (k) => { if (!process.env[k]) throw new Error(`Missing env var ${k} (see .env.example)`); return process.env[k]; };

const cfg = {
  collection: need("COLLECTION"), dao: need("DAO"), treasury: need("TREASURY"), market: need("MARKET"),
  rpcUrl: process.env.RPC_URL ?? "https://rpc.testnet.near.org",
  neardataUrl: process.env.NEARDATA_URL ?? "https://testnet.neardata.xyz",
  sessionSecret: need("SESSION_SECRET"),
  appRecipient: process.env.APP_RECIPIENT ?? "quorum.app",
  mediaBaseUrl: process.env.MEDIA_BASE_URL ?? "http://localhost:8080/media",
  corsOrigin: process.env.CORS_ORIGIN ?? true,
  startHeight: process.env.START_HEIGHT ? Number(process.env.START_HEIGHT) : undefined,
  name: process.env.COLLECTION_NAME ?? "Quorum",
  allowlistsFile: process.env.ALLOWLISTS_FILE,
};
if (cfg.sessionSecret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");

const db = openDb(process.env.DB_PATH ?? "quorum.db");
const app = await buildApp({ db, chain: chainClient(cfg.rpcUrl, cfg.collection), cfg });
await app.listen({ port: Number(process.env.PORT ?? 8080), host: "0.0.0.0" });
console.log(`API on :${process.env.PORT ?? 8080}`);
runIndexer(db, cfg);
