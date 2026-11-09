import React from 'react';
import type { Page } from '../types';
import { ArrowRight, Vault, CheckSquare, Flame, RefreshCw } from 'lucide-react';

interface LandingPageProps {
  onNavigate: (page: Page) => void;
  onSelectCollection?: (colId: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, onSelectCollection }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', background: '#08080A', borderRadius: '24px', overflow: 'hidden' }}>
      {/* Hero Skyline Section */}
      <section
        style={{
          position: 'relative',
          minHeight: '340px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '36px 36px 28px',
          borderBottom: '1px solid #1F1F27',
        }}
      >
        {/* Procedural Moon & Night Skyline SVG */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMax slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
        >
          <defs>
            <linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#050506" />
              <stop offset="0.62" stopColor="#18181B" />
              <stop offset="0.8" stopColor="#3F3F46" />
              <stop offset="1" stopColor="#0B0B0D" />
            </linearGradient>
            <radialGradient id="moonhalo" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.3" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="cityglow" cx="50%" cy="100%" r="70%">
              <stop offset="0" stopColor="#F5C35A" stopOpacity="0.22" />
              <stop offset="1" stopColor="#F5C35A" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1440" height="900" fill="url(#skyg)" />

          {/* Stars */}
          <g>
            {[
              [651, 313, 1], [1231, 106, 1.2], [884, 104, 1], [131, 453, 1.6], [857, 222, 1],
              [1120, 183, 1.2], [122, 367, 1], [1335, 29, 1], [256, 313, 1], [1274, 118, 1],
              [307, 145, 1.2], [653, 537, 1], [228, 352, 1.2], [1037, 39, 0.6], [199, 252, 0.8],
              [749, 376, 1.6], [400, 340, 1.6], [820, 107, 1.2], [1154, 395, 1.6], [512, 358, 1.2]
            ].map(([cx, cy, r], i) => (
              <circle key={i} cx={cx} cy={cy} r={r} fill="#FFFFFF" opacity="0.75" />
            ))}
          </g>

          {/* Moon & Halo */}
          <circle cx="720" cy="118" r="96" fill="url(#moonhalo)" />
          <circle cx="720" cy="118" r="34" fill="#F4F4F5" />
          <circle cx="738" cy="106" r="32" fill="#07070A" />

          {/* Silhouette City & Glow */}
          <path d="M0,900 L0,682 L144,675 L288,651 L432,688 L576,644 L720,647 L864,636 L1008,658 L1152,677 L1296,677 L1440,676 L1440,900 Z" fill="#1C1C21" />
          <rect x="0" y="690" width="1440" height="210" fill="url(#cityglow)" />
          <path d="M0,900 L0,691 L120,694 L240,699 L360,703 L480,691 L600,711 L720,704 L840,707 L960,701 L1080,692 L1200,695 L1320,691 L1440,702 L1440,900 Z" fill="#0E0E11" />
        </svg>

        {/* Hero Copy */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="gold-badge" style={{ fontSize: '11.5px', height: '24px', padding: '0 9px' }}>Built on NEAR Protocol</span>
            <span className="neutral-badge" style={{ fontSize: '11.5px', height: '24px', padding: '0 9px' }}>NEP-171 · Keyless Vaults · DAO</span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(1.85rem, 3.2vw, 2.75rem)',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            Liquid NFTs with voting rights.
          </h1>

          <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.55, color: '#D4D4D8' }}>
            Every piece has a keyless vault, an on-chain floor exit at 90% backing, and exactly one live vote in the collection's DAO.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
            <button
              onClick={() => onNavigate('marketplace')}
              className="btn-primary"
              style={{ minHeight: '42px', padding: '0 20px', fontSize: '14px' }}
            >
              Enter Marketplace <ArrowRight size={16} />
            </button>
            <button
              onClick={() => {
                if (onSelectCollection) onSelectCollection('molten-hours');
                onNavigate('marketplace');
              }}
              className="btn-secondary"
              style={{ minHeight: '42px', padding: '0 18px', fontSize: '14px', background: 'rgba(29,29,37,0.7)' }}
            >
              Explore Molten Hours
            </button>
            <button
              onClick={() => {
                if (onSelectCollection) onSelectCollection('tidewater');
                onNavigate('marketplace');
              }}
              className="btn-secondary"
              style={{ minHeight: '42px', padding: '0 18px', fontSize: '14px', background: 'rgba(29,29,37,0.7)' }}
            >
              Explore Tidewater
            </button>
            <button
              onClick={() => onNavigate('launch')}
              className="btn-secondary"
              style={{ minHeight: '42px', padding: '0 18px', fontSize: '14px', background: 'rgba(29,29,37,0.7)' }}
            >
              Launch Studio
            </button>
          </div>
        </div>
      </section>

      {/* 4 Pillars Section */}
      <section style={{ padding: '0 36px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>The Quorum Architecture</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          <article style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '16px', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #3F3F46', display: 'grid', placeItems: 'center', color: '#F5A524', background: '#1D1D25' }}>
              <Vault size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>A vault in every NFT</h3>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#A1A1AA' }}>
              Each NFT owns a keyless NEAR sub-account (<code>v[id].[collection].testnet</code>). Its owner can add assets to it. Nothing leaves unless the NFT is burned.
            </p>
          </article>

          <article style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '16px', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #3F3F46', display: 'grid', placeItems: 'center', color: '#F5A524', background: '#1D1D25' }}>
              <CheckSquare size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>One NFT, one vote</h3>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#A1A1AA' }}>
              Holders govern the treasury. Spending, distributions, and Rhea DEX rebalancing happen exclusively through timelocked holder votes.
            </p>
          </article>

          <article style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '16px', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #3F3F46', display: 'grid', placeItems: 'center', color: '#F5A524', background: '#1D1D25' }}>
              <Flame size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Liquid by design</h3>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#A1A1AA' }}>
              Burn any NFT at any time to redeem 90% of what its vault holds. The other 10% returns to the collection DAO Treasury pool.
            </p>
          </article>

          <article style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '16px', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #3F3F46', display: 'grid', placeItems: 'center', color: '#F5A524', background: '#1D1D25' }}>
              <RefreshCw size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Settlement through Rhea</h3>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#A1A1AA' }}>
              You mint in NEAR. Once the mint closes, holders vote to execute the DEX swap route for each asset group with enforced minimum output limits.
            </p>
          </article>
        </div>
      </section>

      {/* Where your mint goes */}
      <section style={{ padding: '0 36px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Where your mint goes</h3>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <li style={{ padding: '18px 20px', border: '1px solid #2A2A33', borderRadius: '16px', background: '#15151B', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#F5A524', fontWeight: 700 }}>01</span>
            <strong style={{ fontSize: '16px' }}>You pay in NEAR</strong>
            <span style={{ fontSize: '13px', lineHeight: 1.5, color: '#A1A1AA' }}>
              The stage price, plus a small storage cost that opens your NFT's keyless vault account.
            </span>
          </li>
          <li style={{ padding: '18px 20px', border: '1px solid #2A2A33', borderRadius: '18px', background: '#15151B', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#F5A524', fontWeight: 700 }}>02</span>
            <strong style={{ fontSize: '16px' }}>Half goes to the DAO</strong>
            <span style={{ fontSize: '13px', lineHeight: 1.5, color: '#A1A1AA' }}>
              Straight into the collection treasury, which only holder votes can disburse or swap.
            </span>
          </li>
          <li style={{ padding: '18px 20px', border: '1px solid #2A2A33', borderRadius: '18px', background: '#15151B', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#F5A524', fontWeight: 700 }}>03</span>
            <strong style={{ fontSize: '16px' }}>Half backs your NFT</strong>
            <span style={{ fontSize: '13px', lineHeight: 1.5, color: '#A1A1AA' }}>
              Held in escrow for your NFT, then swapped into its asset and credited to its vault.
            </span>
          </li>
        </ol>
      </section>

      {/* No Admin Keys Callout Banner */}
      <section style={{ padding: '0 36px 36px' }}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '20px',
            border: '1px solid #2A2A33',
            padding: '36px 32px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#15151B',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '560px' }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(1.6rem, 2.5vw, 2.1rem)', fontWeight: 600 }}>
              No admin keys. Just the rules.
            </h2>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.55, color: '#A1A1AA' }}>
              Vaults have no keys and the treasury has no owner. What is written into the smart contracts is what executes on NEAR Protocol.
            </p>
          </div>

          <button
            onClick={() => onNavigate('marketplace')}
            className="btn-primary"
            style={{ minHeight: '44px', padding: '0 24px', fontSize: '14px' }}
          >
            Enter the Marketplace <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
};
