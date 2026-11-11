import React from 'react';
import type { Page } from '../types';
import type { LiveCollection } from '../chain';
import { EXPLORER, MARKET } from '../deployments';

interface LaunchPageProps {
  onNavigate: (page: Page) => void;
  collections: LiveCollection[];
}

const card: React.CSSProperties = { background: '#15151B', border: '1px solid #2A2A33', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 };
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, color: '#FFD572', wordBreak: 'break-all' };

/**
 * A collection is three contracts (NFT, DAO, treasury) that are bound to each other at
 * initialisation, so launching one is a deployment, not a form submission. This page shows what
 * is deployed and how to deploy another one. Nothing here pretends to launch anything.
 */
export const LaunchPage: React.FC<LaunchPageProps> = ({ onNavigate, collections }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 1080 }}>
    <div>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Launch a collection</h1>
      <p style={{ color: '#A1A1AA', fontSize: 14, lineHeight: 1.6, maxWidth: 720 }}>
        Every Quorum collection is its own NFT contract, its own DAO and its own treasury. They are bound to each other when they are
        initialised and cannot be re-pointed, so no collection can touch another's funds or votes. Launching is done with the deploy script
        in the repository (<span style={mono}>code/scripts/deploy-collection.sh</span>), then the market owner registers the collection so it can list.
      </p>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
      {collections.map((c) => (
        <div key={c.id} style={card}>
          <strong style={{ fontSize: 16 }}>{c.name} <span style={{ color: '#A1A1AA', fontWeight: 400 }}>({c.symbol})</span></strong>
          {([['NFT contract', c.dep.nft], ['DAO', c.dep.dao], ['Treasury', c.dep.treasury]] as const).map(([label, acct]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: '#A1A1AA' }}>
              <span>{label}</span>
              <a href={`${EXPLORER}/address/${acct}`} target="_blank" rel="noreferrer" style={mono}>{acct}</a>
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#A1A1AA' }}>
            {c.minted}/{c.supply} minted · {c.liveSupply} live · treasury {c.treasuryNear} NEAR
          </div>
        </div>
      ))}
      <div style={card}>
        <strong style={{ fontSize: 16 }}>Shared market</strong>
        <a href={`${EXPLORER}/address/${MARKET}`} target="_blank" rel="noreferrer" style={mono}>{MARKET}</a>
        <span style={{ fontSize: 12, color: '#A1A1AA' }}>Only collections registered by the market owner can list. The owner cannot move funds or change listings.</span>
      </div>
    </div>

    <div style={card}>
      <strong>Deploy another collection</strong>
      <pre style={{ ...mono, margin: 0, whiteSpace: 'pre-wrap' }}>{`cd code
HASH=$(node scripts/code-hash.mjs res/quorum_vault_opt.wasm)
INIT_FILE=init.json HASH=$HASH FOUNDER=you.testnet \\
NFT=mycol.testnet DAO=mycol-dao.testnet TRE=mycol-tre.testnet \\
NAME="My Collection" SYMBOL=MYC SLUG=mycol ./scripts/deploy-collection.sh`}</pre>
      <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-start', padding: '8px 16px' }} onClick={() => onNavigate('marketplace')}>
        Back to market
      </button>
    </div>
  </div>
);
