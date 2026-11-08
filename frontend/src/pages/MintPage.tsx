import React, { useState } from 'react';
import type { Page, CollectionItem } from '../types';
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';

interface MintPageProps {
  collection: CollectionItem;
  onNavigate: (page: Page) => void;
  onMint: (stage: 'pre' | 'pub', totalNear: number) => void;
}

export const MintPage: React.FC<MintPageProps> = ({
  collection,
  onNavigate,
  onMint,
}) => {
  const [stage, setStage] = useState<'pre' | 'pub'>('pub');
  const [minting, setMinting] = useState(false);

  const isPre = stage === 'pre';
  const price = 1.00;
  const storage = 0.03;
  const total = price + storage;
  const half = (price / 2).toFixed(2);
  const limit = isPre ? 2 : 5;
  const stageStatus = isPre ? 'Allowlist only · ended' : 'Open to everyone · Live';
  const nextTokenNum = collection.minted + 1;
  const mintedPercent = Math.round((collection.minted / collection.supply) * 100);

  const handleMintClick = async () => {
    setMinting(true);
    setTimeout(() => {
      onMint(stage, total);
      setMinting(false);
    }, 700);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Hero Header Section */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '24px',
          border: '1px solid #2A2A33',
          minHeight: '340px',
          padding: '32px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        <img
          src={collection.cover_image}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(10,10,13,0.35) 0%, rgba(10,10,13,0.92) 100%)',
          }}
        />

        <button
          onClick={() => onNavigate('marketplace')}
          style={{
            position: 'relative',
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            minHeight: '40px',
            padding: '0 14px',
            borderRadius: '999px',
            background: 'rgba(10,10,13,0.7)',
            border: '1px solid #2A2A33',
            color: '#F4F4F5',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} /> Marketplace
        </button>

        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
          <img
            src={collection.avatar_image}
            alt={collection.name}
            style={{ width: '112px', height: '112px', borderRadius: '22px', objectFit: 'cover', border: '3px solid #0A0A0D' }}
          />
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="success-badge">Live mint</span>
              <span className="neutral-badge">by {collection.creator}</span>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {collection.name}
            </h1>
            <p style={{ margin: 0, maxWidth: '560px', fontSize: '15px', lineHeight: 1.6, color: '#E4E4E7' }}>
              {collection.description}
            </p>
          </div>
        </div>

        {/* Collection Quick Stats Bar */}
        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 16px', borderRadius: '16px', background: 'rgba(21,21,27,0.85)', border: '1px solid #2A2A33' }}>
            <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Supply</span>
            <strong style={{ fontSize: '18px' }}>{collection.supply}</strong>
          </div>
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 16px', borderRadius: '16px', background: 'rgba(21,21,27,0.85)', border: '1px solid #2A2A33' }}>
            <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Price</span>
            <strong style={{ fontSize: '18px' }}>{collection.price_near} NEAR</strong>
          </div>
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 16px', borderRadius: '16px', background: 'rgba(21,21,27,0.85)', border: '1px solid #2A2A33' }}>
            <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Royalty</span>
            <strong style={{ fontSize: '18px' }}>{collection.royalty_percent}%</strong>
          </div>
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 16px', borderRadius: '16px', background: 'rgba(21,21,27,0.85)', border: '1px solid #2A2A33' }}>
            <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Holders</span>
            <strong style={{ fontSize: '18px' }}>{collection.minted > 0 ? collection.minted - 24 : 0}</strong>
          </div>
        </div>
      </section>

      {/* Main Content: Info & Mint Box */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left Column: Previews, Plan, Roadmap */}
        <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Piece Previews */}
          <section
            style={{
              background: '#15151B',
              border: '1px solid #2A2A33',
              borderRadius: '24px',
              padding: '24px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>From the collection</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {[
                '/images/molten-0.jpg',
                '/images/molten-1.jpg',
                '/images/tidewater-0.jpg',
                '/images/tidewater-1.jpg',
                '/images/currents-0.jpg',
                '/images/orchard-0.jpg',
              ].map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`Preview piece ${i + 1}`}
                  style={{
                    flex: '1 1 120px',
                    minWidth: 0,
                    aspectRatio: '1',
                    objectFit: 'cover',
                    borderRadius: '16px',
                    border: '1px solid #2A2A33',
                  }}
                />
              ))}
            </div>
          </section>

          {/* Asset Plan & After Mint Grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            {/* Asset Plan */}
            <section
              style={{
                background: '#15151B',
                border: '1px solid #2A2A33',
                borderRadius: '24px',
                padding: '24px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                flex: '1 1 280px',
                minWidth: 0,
              }}
            >
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Asset plan</h2>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#C4C4CC' }}>
                Every piece holds 1.00 NEAR + 1.00 USDT directly in its keyless sub-account vault, with voting governance in the 20 NEAR DAO.
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <li style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="gold-badge">1.00 USDT</span>
                      <span style={{ color: '#A1A1AA' }}>Vault Backing</span>
                    </span>
                    <strong>50% weight</strong>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#1D1D25', overflow: 'hidden' }}>
                    <div style={{ width: '50%', height: '100%', background: '#F5A524' }} />
                  </div>
                </li>
                <li style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="gold-badge">1.00 NEAR</span>
                      <span style={{ color: '#A1A1AA' }}>Vault Backing</span>
                    </span>
                    <strong>50% weight</strong>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#1D1D25', overflow: 'hidden' }}>
                    <div style={{ width: '50%', height: '100%', background: '#F5A524' }} />
                  </div>
                </li>
              </ul>
            </section>

            {/* After the Mint */}
            <section
              style={{
                background: '#15151B',
                border: '1px solid #2A2A33',
                borderRadius: '24px',
                padding: '24px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                flex: '1 1 280px',
                minWidth: 0,
              }}
            >
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>After the mint</h2>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { num: 1, title: 'Mint closes', desc: 'When the last stage ends or it sells out.' },
                  { num: 2, title: 'Holders vote to swap', desc: 'Per asset group, with the Rhea route and a minimum output.' },
                  { num: 3, title: 'Vaults are credited', desc: 'Anyone can credit vaults, three NFTs per transaction.' },
                  { num: 4, title: 'Fallback', desc: 'If nobody swaps in time, plain NEAR is credited instead.' },
                ].map((step) => (
                  <li key={step.num} style={{ display: 'flex', gap: '14px' }}>
                    <span
                      style={{
                        flex: 'none',
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        border: '1px solid #2A2A33',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '14px',
                        color: '#F5A524',
                        fontWeight: 600,
                      }}
                    >
                      {step.num}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ fontSize: '15px' }}>{step.title}</strong>
                      <span style={{ fontSize: '13px', lineHeight: 1.55, color: '#A1A1AA' }}>{step.desc}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <p
            style={{
              margin: 0,
              padding: '16px 20px',
              borderRadius: '16px',
              border: '1px solid #2A2A33',
              fontSize: '13px',
              lineHeight: 1.6,
              color: '#C4C4CC',
            }}
          >
            Everyone pays the same NEAR, but each NFT ends up holding its assigned asset, so values move apart after settlement. Contracts are not audited.
          </p>
        </div>

        {/* Right Column: Mint Control Panel */}
        <section
          style={{
            background: '#15151B',
            border: '1px solid #2A2A33',
            borderRadius: '24px',
            padding: '24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            flex: '1 1 360px',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F5A524', fontWeight: 600 }}>
              Mint
            </span>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>{collection.name}</h2>
          </div>

          {/* Stage Toggle */}
          <div
            role="group"
            aria-label="Stage"
            style={{ display: 'flex', gap: '6px', padding: '4px', background: '#1D1D25', borderRadius: '14px' }}
          >
            <button
              type="button"
              onClick={() => setStage('pre')}
              style={{
                flex: 1,
                minHeight: '44px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                background: isPre ? '#F5A524' : 'transparent',
                color: isPre ? '#111113' : '#D4D4D8',
                border: 0,
                transition: 'all 0.15s ease',
              }}
            >
              Presale
            </button>
            <button
              type="button"
              onClick={() => setStage('pub')}
              style={{
                flex: 1,
                minHeight: '44px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                background: !isPre ? '#F5A524' : 'transparent',
                color: !isPre ? '#111113' : '#D4D4D8',
                border: 0,
                transition: 'all 0.15s ease',
              }}
            >
              Public
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span className={isPre ? 'neutral-badge' : 'success-badge'}>{stageStatus}</span>
            <span className="neutral-badge">Limit {limit} per wallet</span>
          </div>

          {/* Price Breakdown */}
          <div style={{ padding: '16px', borderRadius: '16px', background: '#1D1D25', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#C4C4CC' }}>Price</span>
              <span style={{ fontWeight: 500 }}>{price.toFixed(2)} NEAR</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#C4C4CC' }}>Vault storage</span>
              <span style={{ fontWeight: 500 }}>{storage.toFixed(2)} NEAR</span>
            </div>
            <div style={{ height: '1px', background: '#2A2A33' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#C4C4CC' }}>You pay</span>
              <span style={{ fontWeight: 700, color: '#F5A524', fontSize: '16px' }}>{total.toFixed(2)} NEAR</span>
            </div>
          </div>

          {/* 50/50 Transparent Split */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ padding: '14px', borderRadius: '14px', border: '1px solid #2A2A33', background: '#1D1D25' }}>
              <span style={{ fontSize: '12px', color: '#A1A1AA' }}>To the DAO now</span>
              <strong style={{ display: 'block', marginTop: '4px', fontSize: '16px' }}>{half} NEAR</strong>
            </div>
            <div style={{ padding: '14px', borderRadius: '14px', border: '1px solid #2A2A33', background: '#1D1D25' }}>
              <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Backs your NFT</span>
              <strong style={{ display: 'block', marginTop: '4px', fontSize: '16px' }}>{half} NEAR</strong>
            </div>
          </div>

          {/* Token Assignment Preview */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px',
              borderRadius: '14px',
              border: '1px solid rgba(245,165,36,0.4)',
              background: 'rgba(245,165,36,0.06)',
            }}
          >
            <span style={{ fontSize: '14px', color: '#C4C4CC' }}>Your NFT will carry</span>
            <span className="gold-badge">USDC</span>
            <span style={{ fontSize: '12px', color: '#A1A1AA', marginLeft: 'auto' }}>
              #{String(nextTokenNum).padStart(4, '0')}
            </span>
          </div>

          {/* Mint progress meter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#A1A1AA' }}>
              <span>Minted</span>
              <span>{collection.minted} / {collection.supply}</span>
            </div>
            <div style={{ height: '8px', borderRadius: '999px', background: '#1D1D25', overflow: 'hidden' }}>
              <div style={{ width: `${mintedPercent}%`, height: '100%', background: '#F5A524', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Mint Action Button */}
          <button
            type="button"
            disabled={minting}
            onClick={handleMintClick}
            className="btn-primary"
            style={{ minHeight: '52px', fontSize: '16px', width: '100%' }}
          >
            {minting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} /> Processing on NEAR...
              </span>
            ) : (
              `Mint for ${total.toFixed(2)} NEAR`
            )}
          </button>

          <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#86EFAC" />
            If a mint is rejected (stage closed, not on allowlist, sold out), your whole deposit comes back.
          </p>
        </section>
      </div>
    </div>
  );
};
