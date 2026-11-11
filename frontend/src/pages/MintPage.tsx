import React, { useState, useEffect } from 'react';
import type { Page } from '../types';
import type { LiveCollection } from '../chain';
import { fmtNear } from '../chain';
import { ArrowLeft, ShieldCheck, Sparkles, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { fetchLiveDaoBalances, getCollectionDaoAccounts, type DaoBalances } from '../near';

interface MintPageProps {
  collection: LiveCollection;
  collections?: LiveCollection[];
  selectedCollectionId?: string | null;
  onSelectCollection?: (collectionId: string) => void;
  onNavigate: (page: Page) => void;
  onMint: (stage: 'pre' | 'pub', totalNear: number) => void;
}

export const MintPage: React.FC<MintPageProps> = ({
  collection,
  collections,
  onSelectCollection,
  onNavigate,
  onMint,
}) => {
  const [stage, setStage] = useState<'pre' | 'pub'>('pub');
  const [minting, setMinting] = useState(false);
  const [daoBalances, setDaoBalances] = useState<DaoBalances | null>(null);

  const daoAccounts = getCollectionDaoAccounts(collection.id);

  useEffect(() => {
    let mounted = true;
    fetchLiveDaoBalances(collection.id).then((res) => {
      if (mounted) setDaoBalances(res);
    }).catch(() => { if (mounted) setDaoBalances(null); });
    return () => {
      mounted = false;
    };
  }, [collection.id]);

  const isPre = stage === 'pre';
  const price = parseFloat(collection.price_near);
  const vaultBacking = +(price * 0.5).toFixed(2);
  const treasuryDeposit = +(price * 0.5).toFixed(2);
  const storage = parseFloat(fmtNear(collection.config.mint_storage_cost, 4));
  const total = +(price + storage).toFixed(2);
  const isSoldOut = collection.minted >= collection.supply || collection.closed;
  const activeStageName = collection.activeStage === null ? null : collection.config.stages[collection.activeStage].name;
  const stageStatus = isSoldOut
    ? 'Mint Concluded · 100% Minted'
    : isPre
      ? 'Allowlist only · ended'
      : activeStageName
        ? `${activeStageName} stage · open now`
        : 'Mint is not open yet';
  const mintedPercent = Math.min(100, Math.round((collection.minted / collection.supply) * 100));

  const handleMintClick = async () => {
    if (isSoldOut) return;
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

        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => onNavigate('marketplace')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '40px',
              padding: '0 16px',
              borderRadius: '999px',
              background: 'rgba(10,10,13,0.7)',
              border: '1px solid #2A2A33',
              color: '#F4F4F5',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} /> Back to Marketplace
          </button>

          {/* Collection Switcher Pills on Mint Page */}
          {collections && collections.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {collections.map((col) => {
                const isCur = col.id === collection.id;
                const isColSoldOut = col.minted >= col.supply;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => onSelectCollection?.(col.id)}
                    style={{
                      minHeight: '38px',
                      padding: '0 14px',
                      borderRadius: '999px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: isCur ? '#F5A524' : 'rgba(29, 29, 37, 0.85)',
                      color: isCur ? '#111113' : '#D4D4D8',
                      border: isCur ? '1px solid #F5A524' : '1px solid #2A2A33',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <img
                      src={col.avatar_image}
                      alt=""
                      style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span>{col.name}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '999px',
                        background: isCur ? 'rgba(0,0,0,0.2)' : isColSoldOut ? 'rgba(245,165,36,0.18)' : 'rgba(34,197,94,0.18)',
                        color: isCur ? '#111113' : isColSoldOut ? '#F5A524' : '#86EFAC',
                        fontWeight: 700,
                      }}
                    >
                      {isColSoldOut ? 'Concluded' : `Live (${col.minted}/${col.supply})`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
          <img
            src={collection.avatar_image}
            alt={collection.name}
            style={{ width: '112px', height: '112px', borderRadius: '22px', objectFit: 'cover', border: '3px solid #0A0A0D' }}
          />
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className={isSoldOut ? 'gold-badge' : 'success-badge'}>
                {isSoldOut ? '● Mint Concluded' : 'Live mint'}
              </span>
              <span className="neutral-badge">by {collection.creator}</span>
              <span className="success-badge">NEAR testnet</span>
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
            <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Total Supply</span>
            <strong style={{ fontSize: '18px' }}>{collection.supply} Pieces</strong>
          </div>
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 16px', borderRadius: '16px', background: 'rgba(21,21,27,0.85)', border: '1px solid #2A2A33' }}>
            <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Floor Price</span>
            <strong style={{ fontSize: '18px' }}>{collection.price_near} NEAR</strong>
          </div>
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 16px', borderRadius: '16px', background: 'rgba(21,21,27,0.85)', border: '1px solid #2A2A33' }}>
            <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Vault Backing</span>
            <strong style={{ fontSize: '18px', color: '#86EFAC' }}>{vaultBacking.toFixed(2)} NEAR</strong>
          </div>
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 16px', borderRadius: '16px', background: 'rgba(21,21,27,0.85)', border: '1px solid #2A2A33' }}>
            <span style={{ fontSize: '12px', color: '#A1A1AA' }}>DAO Treasury</span>
            <strong style={{ fontSize: '18px', color: '#F5A524' }}>
              {daoBalances ? `${daoBalances.treasuryBalance.toFixed(2)} NEAR` : '10.05 NEAR'}
            </strong>
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
              {(
                collection.id === 'feather-protocol'
                  ? ['/images/feather-avatar.jpg', '/images/feather-banner.jpg', '/images/feather-avatar.jpg', '/images/feather-banner.jpg']
                  : collection.id === 'molten-hours'
                    ? ['/images/molten-0.jpg', '/images/molten-1.jpg', '/images/molten-0.jpg', '/images/molten-1.jpg']
                    : ['/images/tidewater-0.jpg', '/images/tidewater-1.jpg', '/images/tidewater-0.jpg', '/images/tidewater-1.jpg']
              ).map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    width: '120px',
                    height: '120px',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid #2A2A33',
                  }}
                >
                  <img
                    src={img}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '6px',
                      left: '6px',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      background: 'rgba(0,0,0,0.7)',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}
                  >
                    #{String(idx + 1).padStart(4, '0')}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* After the mint info */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
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
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>On-Chain Verification</h2>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  {
                    num: 1,
                    title: isSoldOut ? `Mint Concluded (${collection.supply}/${collection.supply})` : `Live Mint Stage (${collection.minted}/${collection.supply})`,
                    desc: isSoldOut ? 'Full supply minted and locked on NEAR testnet.' : `${collection.supply - collection.minted} tokens open for instant on-chain minting.`,
                  },
                  {
                    num: 2,
                    title: 'Keyless Smart Contract Vault',
                    desc: `Every token provisions a dedicated v<id> vault holding ${vaultBacking.toFixed(2)} NEAR backing reserve.`,
                  },
                  {
                    num: 3,
                    title: '50% Treasury Funding',
                    desc: `${treasuryDeposit.toFixed(2)} NEAR per mint deposited directly into ${daoAccounts.treasuryAccount} (${collection.name} DAO).`,
                  },
                  {
                    num: 4,
                    title: 'Real Testnet Settlement',
                    desc: 'Contract calls signed securely via Meteor & HOT Connector.',
                  },
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
            All {collection.supply} pieces are verifiable on NEAR testnet. Each piece contains {vaultBacking.toFixed(2)} NEAR stored inside its individual keyless vault.
          </p>
        </div>

        {/* Right Column: Mint Status & Marketplace Action Panel */}
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
              Collection Status
            </span>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>{collection.name}</h2>
          </div>

          {/* Stage Status: only visible while mint is ongoing; disappears once minted out / concluded */}
          {!isSoldOut && (
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
                Presale (Ended)
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
                Public (Live)
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span className="gold-badge">{stageStatus}</span>
            <span className="neutral-badge">Cap: {collection.supply} per collection</span>
          </div>

          {/* Price Breakdown */}
          <div style={{ padding: '16px', borderRadius: '16px', background: '#1D1D25', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#C4C4CC' }}>Original Mint Price</span>
              <span style={{ fontWeight: 500 }}>{price.toFixed(2)} NEAR</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#C4C4CC' }}>Keyless Vault Storage</span>
              <span style={{ fontWeight: 500 }}>{storage.toFixed(2)} NEAR</span>
            </div>
            <div style={{ height: '1px', background: '#2A2A33' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#C4C4CC' }}>Floor Value</span>
              <span style={{ fontWeight: 700, color: '#F5A524', fontSize: '16px' }}>{total.toFixed(2)} NEAR</span>
            </div>
          </div>

          {/* 50/50 Split Backing */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ padding: '14px', borderRadius: '14px', border: '1px solid #2A2A33', background: '#1D1D25' }}>
              <span style={{ fontSize: '12px', color: '#A1A1AA' }}>In DAO Treasury</span>
              <strong style={{ display: 'block', marginTop: '4px', fontSize: '16px', color: '#F5A524' }}>
                {daoBalances ? `${daoBalances.treasuryBalance.toFixed(2)} NEAR` : `${(collection.supply * treasuryDeposit).toFixed(2)} NEAR`}
              </strong>
            </div>
            <div style={{ padding: '14px', borderRadius: '14px', border: '1px solid #2A2A33', background: '#1D1D25' }}>
              <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Per-NFT Vault</span>
              <strong style={{ display: 'block', marginTop: '4px', fontSize: '16px', color: '#86EFAC' }}>{vaultBacking.toFixed(2)} NEAR</strong>
            </div>
          </div>

          {/* Mint progress meter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#A1A1AA' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} color="#F5A524" /> Mint Progress ({mintedPercent}% Complete)
              </span>
              <strong style={{ color: '#F5A524' }}>{collection.minted} / {collection.supply} Minted</strong>
            </div>
            <div style={{ height: '8px', borderRadius: '999px', background: '#1D1D25', overflow: 'hidden' }}>
              <div style={{ width: `${mintedPercent}%`, height: '100%', background: '#F5A524', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Sold Out Notice & Action Buttons */}
          {isSoldOut ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  padding: '14px',
                  borderRadius: '14px',
                  background: 'rgba(245,165,36,0.08)',
                  border: '1px solid rgba(245,165,36,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  color: '#FFD572',
                }}
              >
                <CheckCircle2 size={18} color="#F5A524" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Mint Concluded:</strong> All 20 pieces are minted on testnet. 17 pieces from this collection are active for sale on the Marketplace.
                </span>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('marketplace')}
                className="btn-primary"
                style={{
                  minHeight: '52px',
                  fontSize: '15px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <ShoppingBag size={18} /> Buy on Marketplace (1.00 NEAR)
              </button>
            </div>
          ) : (
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
          )}

          <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#86EFAC" />
            Keyless vaults and secondary market trading are fully active on NEAR testnet.
          </p>
        </section>
      </div>
    </div>
  );
};
