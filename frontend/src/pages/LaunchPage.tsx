import React, { useState } from 'react';
import type { Page, CollectionItem } from '../types';
import { Upload, CheckCircle2 } from 'lucide-react';

interface LaunchPageProps {
  onNavigate: (page: Page) => void;
  onCollectionCreated: (col: CollectionItem) => void;
  creatorAccount?: string;
}

export const LaunchPage: React.FC<LaunchPageProps> = ({
  onNavigate,
  onCollectionCreated,
  creatorAccount,
}) => {
  const [step, setStep] = useState(0);

  // Form states
  const [name, setName] = useState('Molten Hours');
  const [symbol, setSymbol] = useState('MOLT');
  const [desc, setDesc] = useState('Amber currents caught mid-pour. Every piece holds USDC or wNEAR in its own vault and one vote in the DAO.');
  const [supply, setSupply] = useState(500);
  const [royalty, setRoyalty] = useState(5);

  const [prePrice, setPrePrice] = useState('1.00');
  const [pubPrice, setPubPrice] = useState('2.00');
  const [preLimit, setPreLimit] = useState(2);
  const [pubLimit, setPubLimit] = useState(5);

  const [usdcWeight, setUsdcWeight] = useState(2);
  const [wnearWeight, setWnearWeight] = useState(1);
  const [acknowledged, setAcknowledged] = useState(false);

  const steps = ['Details', 'Artwork', 'Stages', 'Asset plan', 'Governance', 'Review'];

  const handleLaunch = () => {
    const totalWeight = usdcWeight + wnearWeight;
    const newCollection: CollectionItem = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      symbol,
      creator: creatorAccount || 'creator.testnet',
      description: desc,
      cover_image: '/images/banner-tidewater.jpg',
      avatar_image: '/images/tidewater-0.jpg',
      supply: Number(supply),
      minted: 0,
      price_near: pubPrice,
      floor_price_near: pubPrice,
      backing_summary: `Backing from ${(parseFloat(pubPrice) / 2).toFixed(2)} NEAR`,
      royalty_percent: Number(royalty),
      change_24h: '0%',
      change_positive: true,
      status: 'live',
      asset_weights: [
        { asset: 'USDC', weight: usdcWeight, percentage: Math.round((usdcWeight / totalWeight) * 100) },
        { asset: 'wNEAR', weight: wnearWeight, percentage: Math.round((wnearWeight / totalWeight) * 100) },
      ],
    };

    onCollectionCreated(newCollection);
    onNavigate('marketplace');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>Launch a collection</h1>
        <span className="gold-badge">For creators</span>
      </div>

      {/* Step Indicators */}
      <nav aria-label="Launch steps">
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {steps.map((label, idx) => {
            const isCurrent = step === idx;
            const isDone = idx < step;
            return (
              <li key={label} style={{ flex: '1 1 110px' }}>
                <button
                  type="button"
                  onClick={() => setStep(idx)}
                  style={{
                    width: '100%',
                    minHeight: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0 12px',
                    borderRadius: '14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: isCurrent
                      ? 'rgba(245,165,36,0.14)'
                      : isDone
                      ? '#1D1D25'
                      : 'transparent',
                    color: isCurrent ? '#F5A524' : isDone ? '#F4F4F5' : '#A1A1AA',
                    border: isCurrent
                      ? '1px solid rgba(245,165,36,0.5)'
                      : '1px solid #2A2A33',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      flex: 'none',
                      width: '26px',
                      height: '26px',
                      borderRadius: '8px',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '13px',
                      border: '1px solid currentColor',
                    }}
                  >
                    {idx + 1}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Form Content & Live Preview */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left: Step Form */}
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
            flex: '999 1 560px',
            minWidth: 0,
          }}
        >
          {/* Step 0: Details */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Collection details</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                  Collection name
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Molten Hours"
                    style={{ minHeight: '46px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#1D1D25', color: '#F4F4F5', padding: '0 12px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                  Symbol
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="e.g. MOLT"
                    style={{ minHeight: '46px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#1D1D25', color: '#F4F4F5', padding: '0 12px' }}
                  />
                  <span style={{ fontSize: '12px', color: '#A1A1AA' }}>3–6 letters, shown in wallets</span>
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                Description
                <textarea
                  rows={4}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="What the art is and who it is for"
                  style={{ borderRadius: '12px', border: '1px solid #2A2A33', background: '#1D1D25', color: '#F4F4F5', padding: '12px' }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                  Max supply
                  <input
                    type="number"
                    value={supply}
                    onChange={(e) => setSupply(Number(e.target.value))}
                    style={{ minHeight: '46px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#1D1D25', color: '#F4F4F5', padding: '0 12px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                  Creator royalty (%)
                  <input
                    type="number"
                    value={royalty}
                    onChange={(e) => setRoyalty(Number(e.target.value))}
                    style={{ minHeight: '46px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#1D1D25', color: '#F4F4F5', padding: '0 12px' }}
                  />
                  <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Paid to you on every market sale.</span>
                </label>
              </div>
            </div>
          )}

          {/* Step 1: Artwork */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Artwork &amp; Provenance</h2>
              <div
                style={{
                  border: '1.5px dashed #2A2A33',
                  borderRadius: '20px',
                  padding: '36px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  textAlign: 'center',
                }}
              >
                <Upload size={32} color="#F5A524" />
                <strong style={{ fontSize: '16px' }}>Drop your art and metadata folder</strong>
                <span style={{ fontSize: '13px', color: '#A1A1AA', maxWidth: '420px' }}>
                  One image and one JSON file per piece. We record a SHA-256 provenance hash of the full set so holders can verify nothing changes after launch.
                </span>
                <button type="button" className="btn-secondary">
                  Choose directory
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                  Cover image (Marketplace banner)
                  <button type="button" className="btn-secondary" style={{ justifyContent: 'flex-start' }}>
                    Upload banner image
                  </button>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                  Collection image (1:1 Avatar)
                  <button type="button" className="btn-secondary" style={{ justifyContent: 'flex-start' }}>
                    Upload square image
                  </button>
                </label>
              </div>
            </div>
          )}

          {/* Step 2: Stages */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Stages and price</h2>
              <div style={{ padding: '18px', borderRadius: '18px', border: '1px solid #2A2A33', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '15px' }}>Presale (Allowlist only)</strong>
                  <span className="neutral-badge">Merkle proof verified</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                    Price (NEAR)
                    <input
                      type="text"
                      value={prePrice}
                      onChange={(e) => setPrePrice(e.target.value)}
                      style={{ minHeight: '44px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#1D1D25', color: '#F4F4F5', padding: '0 12px' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                    Limit per wallet
                    <input
                      type="number"
                      value={preLimit}
                      onChange={(e) => setPreLimit(Number(e.target.value))}
                      style={{ minHeight: '44px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#1D1D25', color: '#F4F4F5', padding: '0 12px' }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ padding: '18px', borderRadius: '18px', border: '1px solid #2A2A33', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '15px' }}>Public Stage</strong>
                  <span className="success-badge">Open to all</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                    Price (NEAR)
                    <input
                      type="text"
                      value={pubPrice}
                      onChange={(e) => setPubPrice(e.target.value)}
                      style={{ minHeight: '44px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#1D1D25', color: '#F4F4F5', padding: '0 12px' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                    Limit per wallet
                    <input
                      type="number"
                      value={pubLimit}
                      onChange={(e) => setPubLimit(Number(e.target.value))}
                      style={{ minHeight: '44px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#1D1D25', color: '#F4F4F5', padding: '0 12px' }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Asset Plan */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Asset plan</h2>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#C4C4CC' }}>
                Choose what your NFTs will hold. Buyers pay NEAR; after mint closes, holders vote to swap each NFT's half into its asset through Rhea.
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '14px', background: '#1D1D25', border: '1px solid #2A2A33' }}>
                  <span className="gold-badge">USDC</span>
                  <span style={{ flex: '1 1 160px', fontSize: '13px', color: '#A1A1AA' }}>Rhea route verified · deep pool</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#D4D4D8' }}>
                    Weight
                    <input
                      type="number"
                      value={usdcWeight}
                      onChange={(e) => setUsdcWeight(Number(e.target.value))}
                      style={{ width: '80px', minHeight: '40px', borderRadius: '10px', border: '1px solid #2A2A33', background: '#15151B', color: '#F4F4F5', padding: '0 10px' }}
                    />
                  </label>
                </li>
                <li style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '14px', background: '#1D1D25', border: '1px solid #2A2A33' }}>
                  <span className="gold-badge">wNEAR</span>
                  <span style={{ flex: '1 1 160px', fontSize: '13px', color: '#A1A1AA' }}>Rhea route verified · deep pool</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#D4D4D8' }}>
                    Weight
                    <input
                      type="number"
                      value={wnearWeight}
                      onChange={(e) => setWnearWeight(Number(e.target.value))}
                      style={{ width: '80px', minHeight: '40px', borderRadius: '10px', border: '1px solid #2A2A33', background: '#15151B', color: '#F4F4F5', padding: '0 10px' }}
                    />
                  </label>
                </li>
              </ul>
            </div>
          )}

          {/* Step 4: Governance */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Governance minimums</h2>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#C4C4CC' }}>
                Holders can always set longer votes and higher thresholds than these, never shorter or lower.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '480px', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#A1A1AA', fontSize: '12px' }}>
                      <th style={{ padding: '8px' }}>Proposal</th>
                      <th style={{ padding: '8px' }}>Vote length</th>
                      <th style={{ padding: '8px' }}>Quorum</th>
                      <th style={{ padding: '8px' }}>Timelock</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>Spend, swap, settle</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>3 days</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>10%</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>2 days</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>Distribute</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>3 days</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>10%</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>1 day</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>Parameter change</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>5 days</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>15%</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>3 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Review and launch</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #2A2A33', fontSize: '14px' }}>
                  <span style={{ color: '#C4C4CC' }}>Collection</span>
                  <strong>{name} ({symbol})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #2A2A33', fontSize: '14px' }}>
                  <span style={{ color: '#C4C4CC' }}>Supply &amp; Royalty</span>
                  <strong>{supply} pieces · {royalty}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #2A2A33', fontSize: '14px' }}>
                  <span style={{ color: '#C4C4CC' }}>Public Price</span>
                  <strong>{pubPrice} NEAR</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #2A2A33', fontSize: '14px' }}>
                  <span style={{ color: '#C4C4CC' }}>Asset plan</span>
                  <strong>USDC (x{usdcWeight}), wNEAR (x{wnearWeight})</strong>
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: '16px', background: '#1D1D25', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <strong style={{ fontSize: '14px' }}>What launching creates</strong>
                <span style={{ fontSize: '13px', lineHeight: 1.6, color: '#C4C4CC' }}>
                  Your collection contract, its keyless DAO, its treasury, and market listing. About ~40 NEAR covers initial NEAR storage staking.
                </span>
              </div>

              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: '#D4D4D8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#F5A524' }}
                />
                I understand the asset plan and fee splits are permanent and keyless once deployed.
              </label>

              <button
                type="button"
                disabled={!acknowledged}
                onClick={handleLaunch}
                className="btn-primary"
                style={{ minHeight: '52px', fontSize: '16px', width: '100%', opacity: acknowledged ? 1 : 0.5 }}
              >
                <CheckCircle2 size={18} /> Launch Collection on NEAR
              </button>
            </div>
          )}

          {/* Wizard Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingTop: '10px' }}>
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep(Math.max(0, step - 1))}
              className="btn-secondary"
            >
              Back
            </button>
            {step < 5 && (
              <button
                type="button"
                onClick={() => setStep(Math.min(5, step + 1))}
                className="btn-primary"
              >
                Continue
              </button>
            )}
          </div>
        </section>

        {/* Right: Live Preview Card */}
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
            flex: '1 1 320px',
            minWidth: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Marketplace Preview</h2>
          <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid #2A2A33', background: '#1D1D25' }}>
            <img
              src="/images/banner-tidewater.jpg"
              alt="Sample cover"
              style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }}
            />
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src="/images/tidewater-0.jpg"
                  alt=""
                  style={{ width: '52px', height: '52px', borderRadius: '14px', objectFit: 'cover', marginTop: '-40px', border: '3px solid #1D1D25' }}
                />
                <strong style={{ fontSize: '18px' }}>{name || '[Collection name]'}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="info-badge">Opens soon</span>
                <span className="neutral-badge">{pubPrice} NEAR</span>
              </div>
              <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                This is how your drop appears on the Quorum Marketplace.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#C4C4CC', lineHeight: 1.55 }}>
            <strong style={{ fontSize: '14px', color: '#F4F4F5' }}>How each mint splits</strong>
            <span>Half of every mint price goes to your collection's DAO treasury straight away. The other half backs the buyer's NFT.</span>
            <span>You earn through your {royalty}% royalty on sales, not from the mint price.</span>
          </div>
        </section>
      </div>
    </div>
  );
};
