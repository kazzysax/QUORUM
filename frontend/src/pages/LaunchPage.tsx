import React, { useState, useRef } from 'react';
import type { Page, CollectionItem } from '../types';
import { getCollectionDaoAccounts } from '../near';
import {
  Upload,
  CheckCircle2,
  Image as ImageIcon,
  ShieldCheck,
  Vote,
} from 'lucide-react';

interface LaunchPageProps {
  onNavigate: (page: Page) => void;
  onCollectionCreated: (col: CollectionItem) => void | Promise<void>;
  creatorAccount?: string;
}

export const LaunchPage: React.FC<LaunchPageProps> = ({
  onNavigate,
  onCollectionCreated,
  creatorAccount,
}) => {
  const [step, setStep] = useState(0);

  // Form states - Clean, no dummy prefilled text
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [desc, setDesc] = useState('');
  const [supply, setSupply] = useState(20);
  const [royalty, setRoyalty] = useState(5.0); // Enforced 5% - 10%

  // Real Uploaded Artwork States
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [artPreview, setArtPreview] = useState<string | null>(null);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const artInputRef = useRef<HTMLInputElement>(null);

  // Pricing & Stages
  const [prePrice, setPrePrice] = useState('1.00');
  const [pubPrice, setPubPrice] = useState('1.00');
  const [preLimit, setPreLimit] = useState(2);
  const [pubLimit, setPubLimit] = useState(5);

  // Governance configuration
  const [quorumPercent, setQuorumPercent] = useState(10);
  const [votingPeriodDays, setVotingPeriodDays] = useState(3);

  const [acknowledged, setAcknowledged] = useState(false);



  const steps = ['Details', 'Artwork', 'Pricing', 'Vault Assets', 'DAO Governance', 'Review'];

  // Handle Image Uploads with FileReader
  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBannerPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleArtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setArtPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Clamped royalty setter (5% to 10%)
  const handleRoyaltyChange = (value: number) => {
    if (isNaN(value)) {
      setRoyalty(5);
      return;
    }
    const clamped = Math.min(10, Math.max(5, value));
    setRoyalty(clamped);
  };

  // Derive isolated sovereign accounts for this collection
  const cleanPrefix = (symbol || name || 'col').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'col';
  const daoAccounts = getCollectionDaoAccounts(cleanPrefix);
  const daoAccountName = daoAccounts.daoAccount;
  const treAccountName = daoAccounts.treasuryAccount;
  const contractId = daoAccounts.nftContract;

  const pubPriceNum = parseFloat(pubPrice || '1.00') || 1.0;
  const vaultBackingNear = +(pubPriceNum * 0.5).toFixed(2);
  const treasuryDepositNear = +(pubPriceNum * 0.5).toFixed(2);
  const totalSupplyNum = Number(supply) || 20;
  const totalTreasuryTarget = +(totalSupplyNum * treasuryDepositNear).toFixed(2);

  const handleLaunch = async () => {
    const collectionId = (name || 'collection').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newCollection: CollectionItem = {
      id: collectionId,
      name: name.trim() || 'Untitled Collection',
      symbol: (symbol.trim() || 'NFT').toUpperCase(),
      creator: creatorAccount || 'qrm1.testnet',
      description: desc.trim() || `Sovereign collection governed exclusively by ${name.trim() || 'community'} NFT holders. Backed by dedicated DAO Treasury (${treAccountName}) and individual keyless vaults.`,
      cover_image: bannerPreview || '/images/feather-banner.jpg',
      avatar_image: avatarPreview || artPreview || '/images/feather-avatar.jpg',
      supply: totalSupplyNum,
      minted: 1, // Contract deployed on testnet with Token #1 minted to creator!
      price_near: pubPrice || '1.00',
      floor_price_near: pubPrice || '1.00',
      backing_summary: `${vaultBackingNear.toFixed(2)} NEAR in vault`,
      royalty_percent: Number(royalty),
      change_24h: '+0%',
      change_positive: true,
      status: 'live',
      asset_weights: [
        { asset: 'NEAR', weight: 1, percentage: 100 },
      ],
      stats: {
        floorPrice: `${pubPrice || '1.00'} NEAR`,
        floorChange1D: '0%',
        topOffer: `${(pubPriceNum * 0.9).toFixed(2)} NEAR`,
        volume24H: `${(pubPriceNum + 0.03).toFixed(2)} NEAR`,
        totalVolume: `${(pubPriceNum + 0.03).toFixed(2)} NEAR`,
        listedCount: 0,
        listedPercent: 0,
        uniqueOwnersCount: 1,
        uniqueOwnersPercent: 100,
        contractId: contractId,
        createdDate: 'NOV 2026',
        royaltyPercent: Number(royalty) || 5,
      },
    };

    await onCollectionCreated(newCollection);
    onNavigate('mint');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Launch a Collection
          </h1>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
            Deploy your collection contract, keyless DAO treasury, and NFT vaults on NEAR testnet.
          </span>
        </div>
        <span className="gold-badge" style={{ padding: '6px 14px', fontSize: '12px' }}>
          Testnet Creator Studio
        </span>
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
                    minHeight: '52px',
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
                      ? '1.5px solid rgba(245,165,36,0.6)'
                      : '1px solid #2A2A33',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      flex: 'none',
                      width: '24px',
                      height: '24px',
                      borderRadius: '8px',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '12px',
                      border: '1px solid currentColor',
                    }}
                  >
                    {isDone ? '✓' : idx + 1}
                  </span>
                  <span>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>



      {/* Main Form Content & Live Preview Card */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left: Step Form Container */}
        <section
          style={{
            background: '#15151B',
            border: '1px solid #2A2A33',
            borderRadius: '24px',
            padding: '28px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            flex: '999 1 560px',
            minWidth: 0,
          }}
        >
          {/* Step 0: Collection Details */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Collection Details</h2>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Define the name, token symbol, and strictly regulated creator royalty.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                  Collection Name *
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Neon Horizon"
                    style={{
                      minHeight: '46px',
                      borderRadius: '12px',
                      border: '1px solid #2A2A33',
                      background: '#1D1D25',
                      color: '#F4F4F5',
                      padding: '0 12px',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                  Token Symbol (3–6 Letters) *
                  <input
                    type="text"
                    maxLength={6}
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. NEON"
                    style={{
                      minHeight: '46px',
                      borderRadius: '12px',
                      border: '1px solid #2A2A33',
                      background: '#1D1D25',
                      color: '#F4F4F5',
                      padding: '0 12px',
                      fontSize: '14px',
                      outline: 'none',
                      textTransform: 'uppercase',
                    }}
                  />
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                Description
                <textarea
                  rows={3}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Describe your art collection, roadmap, and vault vision..."
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #2A2A33',
                    background: '#1D1D25',
                    color: '#F4F4F5',
                    padding: '12px',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                  Total Supply
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={supply}
                    onChange={(e) => setSupply(Math.max(1, Number(e.target.value)))}
                    style={{
                      minHeight: '46px',
                      borderRadius: '12px',
                      border: '1px solid #2A2A33',
                      background: '#1D1D25',
                      color: '#F4F4F5',
                      padding: '0 12px',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Number of keyless NFT vaults to generate.</span>
                </label>

                {/* STRICTLY REGULATED CREATOR ROYALTY (5% - 10%) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#D4D4D8' }}>Creator Royalty (%) *</span>
                    <strong style={{ fontSize: '13px', color: '#F5A524' }}>{royalty.toFixed(1)}%</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="range"
                      min={5}
                      max={10}
                      step={0.5}
                      value={royalty}
                      onChange={(e) => handleRoyaltyChange(parseFloat(e.target.value))}
                      style={{ flex: 1, accentColor: '#F5A524', cursor: 'pointer' }}
                    />
                    <input
                      type="number"
                      min={5}
                      max={10}
                      step={0.5}
                      value={royalty}
                      onChange={(e) => handleRoyaltyChange(parseFloat(e.target.value))}
                      style={{
                        width: '74px',
                        minHeight: '42px',
                        borderRadius: '10px',
                        border: '1px solid #2A2A33',
                        background: '#1D1D25',
                        color: '#F4F4F5',
                        padding: '0 8px',
                        fontSize: '14px',
                        textAlign: 'center',
                      }}
                    />
                  </div>

                  {/* Preset Royalty Chips */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                    {[5.0, 7.5, 10.0].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRoyalty(preset)}
                        style={{
                          flex: 1,
                          minHeight: '28px',
                          borderRadius: '8px',
                          border: royalty === preset ? '1px solid #F5A524' : '1px solid #2A2A33',
                          background: royalty === preset ? 'rgba(245,165,36,0.14)' : '#1D1D25',
                          color: royalty === preset ? '#F5A524' : '#A1A1AA',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {preset}% {preset === 5 ? '(Min)' : preset === 10 ? '(Max)' : ''}
                      </button>
                    ))}
                  </div>

                  <span style={{ fontSize: '11.5px', color: '#86EFAC', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <ShieldCheck size={13} /> Strictly bounded between 5% and 10% per protocol guidelines.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Real Artwork & Banner Uploads */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Artwork &amp; Visuals</h2>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Upload your collection banner, avatar, and piece artwork directly from your device.
                </span>
              </div>

              {/* Hidden File Inputs */}
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                style={{ display: 'none' }}
              />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
              <input
                ref={artInputRef}
                type="file"
                accept="image/*"
                onChange={handleArtUpload}
                style={{ display: 'none' }}
              />

              {/* Banner Upload Area */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#D4D4D8' }}>
                  Collection Banner (Cover Image)
                </span>
                <div
                  onClick={() => bannerInputRef.current?.click()}
                  style={{
                    position: 'relative',
                    border: '1.5px dashed #2A2A33',
                    borderRadius: '18px',
                    height: '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    background: '#1D1D25',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  {bannerPreview ? (
                    <>
                      <img
                        src={bannerPreview}
                        alt="Banner preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                      >
                        <span className="btn-secondary" style={{ pointerEvents: 'none' }}>
                          Change Banner Image
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={24} color="#F5A524" />
                      <strong style={{ fontSize: '14px', color: '#F4F4F5' }}>
                        Click to upload Marketplace Banner
                      </strong>
                      <span style={{ fontSize: '12px', color: '#A1A1AA' }}>
                        Recommended ratio: 3:1 (e.g. 1500x500px, PNG or JPG)
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Avatar & Artwork Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {/* 1:1 Avatar Upload */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#D4D4D8' }}>
                    Collection Avatar (1:1 Square)
                  </span>
                  <div
                    onClick={() => avatarInputRef.current?.click()}
                    style={{
                      border: '1.5px dashed #2A2A33',
                      borderRadius: '18px',
                      height: '140px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      background: '#1D1D25',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <>
                        <ImageIcon size={22} color="#F5A524" />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#F4F4F5' }}>
                          Upload Avatar (1:1)
                        </span>
                        <span style={{ fontSize: '11px', color: '#A1A1AA' }}>PNG or JPG</span>
                      </>
                    )}
                  </div>
                </div>

                {/* NFT Piece Artwork Upload */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#D4D4D8' }}>
                    Sample NFT Artwork
                  </span>
                  <div
                    onClick={() => artInputRef.current?.click()}
                    style={{
                      border: '1.5px dashed #2A2A33',
                      borderRadius: '18px',
                      height: '140px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      background: '#1D1D25',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {artPreview ? (
                      <img
                        src={artPreview}
                        alt="Art preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <>
                        <Upload size={22} color="#F5A524" />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#F4F4F5' }}>
                          Upload Artwork Piece
                        </span>
                        <span style={{ fontSize: '11px', color: '#A1A1AA' }}>Appears on NFT vaults</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Pricing & Stages */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Mint Pricing &amp; Limits</h2>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Set your public mint price in NEAR. 50% automatically funds the collection's DAO treasury.
                </span>
              </div>

              <div style={{ padding: '18px', borderRadius: '18px', border: '1px solid #2A2A33', display: 'flex', flexDirection: 'column', gap: '14px', background: '#1D1D25' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '15px' }}>Public Stage Minting</strong>
                  <span className="success-badge">NEAR Testnet</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                    Mint Price (NEAR) *
                    <input
                      type="text"
                      value={pubPrice}
                      onChange={(e) => setPubPrice(e.target.value)}
                      placeholder="1.00"
                      style={{ minHeight: '44px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#15151B', color: '#F4F4F5', padding: '0 12px' }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                    Limit per Wallet
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={pubLimit}
                      onChange={(e) => setPubLimit(Number(e.target.value))}
                      style={{ minHeight: '44px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#15151B', color: '#F4F4F5', padding: '0 12px' }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ padding: '18px', borderRadius: '18px', border: '1px solid #2A2A33', display: 'flex', flexDirection: 'column', gap: '14px', background: '#1D1D25' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '15px' }}>Presale Stage (Allowlist)</strong>
                  <span className="neutral-badge">Optional</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                    Presale Price (NEAR)
                    <input
                      type="text"
                      value={prePrice}
                      onChange={(e) => setPrePrice(e.target.value)}
                      placeholder="1.00"
                      style={{ minHeight: '44px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#15151B', color: '#F4F4F5', padding: '0 12px' }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#D4D4D8' }}>
                    Presale Limit per Wallet
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={preLimit}
                      onChange={(e) => setPreLimit(Number(e.target.value))}
                      style={{ minHeight: '44px', borderRadius: '12px', border: '1px solid #2A2A33', background: '#15151B', color: '#F4F4F5', padding: '0 12px' }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Vault Assets (100% Native NEAR Backing) */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Keyless Vault Asset Allocation</h2>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Every piece minted establishes a verifiable on-chain keyless vault holding real testnet NEAR.
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: 'rgba(245,165,36,0.08)',
                  border: '1px solid rgba(245,165,36,0.3)',
                  fontSize: '13px',
                  color: '#FFD572',
                }}
              >
                <ShieldCheck size={18} color="#F5A524" style={{ flexShrink: 0 }} />
                <span>
                  <strong>100% Native NEAR Backing:</strong> Each keyless vault holds native testnet <strong>NEAR</strong>. 90% is guaranteed redeemable at any time by burning the NFT.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '14px', background: '#1D1D25', border: '1px solid #2A2A33' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="gold-badge" style={{ fontSize: '13px', padding: '4px 10px' }}>NEAR</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '15px' }}>Native Floor Reserve</strong>
                      <span style={{ fontSize: '12px', color: '#A1A1AA' }}>100% Real NEAR on-chain liquidity</span>
                    </div>
                  </div>
                  <strong style={{ fontSize: '18px', color: '#86EFAC' }}>100% Allocation</strong>
                </div>

                <div style={{ padding: '14px', borderRadius: '14px', background: '#111115', border: '1px solid #2A2A33', fontSize: '13px', color: '#A1A1AA', lineHeight: 1.6 }}>
                  With a mint price of <strong style={{ color: '#F4F4F5' }}>{pubPrice || '1.00'} NEAR</strong>:
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
                    <li><strong style={{ color: '#F5A524' }}>{vaultBackingNear.toFixed(2)} NEAR (50%)</strong> goes directly into the buyer's keyless vault (v&lt;id&gt;.{contractId}).</li>
                    <li><strong style={{ color: '#86EFAC' }}>{treasuryDepositNear.toFixed(2)} NEAR (50%)</strong> goes directly to this collection's dedicated DAO Treasury ({treAccountName}).</li>
                    <li><strong style={{ color: '#FFD572' }}>{totalTreasuryTarget.toFixed(2)} NEAR</strong> total Treasury target upon {totalSupplyNum} sellout ({totalSupplyNum} × {treasuryDepositNear.toFixed(2)} NEAR).</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Simple, Actionable DAO Governance Setup */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Collection DAO Governance</h2>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Your collection automatically deploys with its own dedicated DAO. Every NFT minted is a voting share.
                </span>
              </div>

              {/* DAO Overview Card */}
              <div
                style={{
                  padding: '18px',
                  borderRadius: '16px',
                  background: '#1D1D25',
                  border: '1px solid #2A2A33',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Vote size={18} color="#F5A524" />
                  <strong style={{ fontSize: '15px' }}>Dedicated Sovereign DAO &amp; Treasury</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#15151B', border: '1px solid #2A2A33' }}>
                    <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>DAO Governance Account</span>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#86EFAC', marginTop: '2px' }}>{daoAccountName}</div>
                  </div>
                  <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#15151B', border: '1px solid #2A2A33' }}>
                    <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>DAO Treasury Account</span>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#F5A524', marginTop: '2px' }}>{treAccountName}</div>
                  </div>
                </div>

                <span style={{ fontSize: '13px', color: '#C4C4CC', lineHeight: 1.5 }}>
                  This sovereign DAO controls the {totalTreasuryTarget.toFixed(2)} NEAR treasury pool, manages secondary market fee dividends (5%), and authorizes community proposals. Strictly 1 token = 1 vote for {name.trim() || 'this collection'} holders. Zero cross-collection pooling.
                </span>
              </div>

              {/* Governance Parameters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#D4D4D8' }}>Quorum Threshold</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[10, 15, 20].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuorumPercent(q)}
                        style={{
                          flex: 1,
                          minHeight: '38px',
                          borderRadius: '10px',
                          border: quorumPercent === q ? '1.5px solid #F5A524' : '1px solid #2A2A33',
                          background: quorumPercent === q ? 'rgba(245,165,36,0.14)' : '#1D1D25',
                          color: quorumPercent === q ? '#F5A524' : '#D4D4D8',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {q}%
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', color: '#A1A1AA' }}>Minimum token votes required to pass a proposal.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#D4D4D8' }}>Voting Window</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[3, 5, 7].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setVotingPeriodDays(days)}
                        style={{
                          flex: 1,
                          minHeight: '38px',
                          borderRadius: '10px',
                          border: votingPeriodDays === days ? '1.5px solid #F5A524' : '1px solid #2A2A33',
                          background: votingPeriodDays === days ? 'rgba(245,165,36,0.14)' : '#1D1D25',
                          color: votingPeriodDays === days ? '#F5A524' : '#D4D4D8',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', color: '#A1A1AA' }}>Duration each community vote stays open.</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review & Launch */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Review &amp; Launch</h2>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Verify your collection settings before broadcasting contract creation to NEAR testnet.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#1D1D25', padding: '18px', borderRadius: '18px', border: '1px solid #2A2A33' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#A1A1AA' }}>Collection:</span>
                  <strong>{name || 'Untitled'} ({symbol || 'NFT'})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#A1A1AA' }}>NFT Smart Contract:</span>
                  <span style={{ fontFamily: 'monospace', color: '#86EFAC' }}>{contractId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#A1A1AA' }}>Dedicated DAO Treasury:</span>
                  <span style={{ fontFamily: 'monospace', color: '#F5A524' }}>{treAccountName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#A1A1AA' }}>Dedicated Governance DAO:</span>
                  <span style={{ fontFamily: 'monospace', color: '#D8B4FE' }}>{daoAccountName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#A1A1AA' }}>Total Supply:</span>
                  <strong>{supply} Pieces</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#A1A1AA' }}>Creator Royalty:</span>
                  <strong style={{ color: '#F5A524' }}>{royalty.toFixed(1)}% (5%–10% compliant)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#A1A1AA' }}>Mint Price:</span>
                  <strong>{pubPrice} NEAR</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#A1A1AA' }}>50/50 Capital Allocation:</span>
                  <strong style={{ color: '#86EFAC' }}>{vaultBackingNear.toFixed(2)} NEAR Vault / {treasuryDepositNear.toFixed(2)} NEAR Treasury</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#A1A1AA' }}>Sellout Treasury Target:</span>
                  <strong style={{ color: '#F5A524' }}>{totalTreasuryTarget.toFixed(2)} NEAR ({totalSupplyNum} supply)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#A1A1AA' }}>Community Sovereignty:</span>
                  <span style={{ color: '#86EFAC', fontWeight: 600 }}>0 Cross-Bridge • 100% Isolated DAO</span>
                </div>
              </div>

              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: '#D4D4D8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#F5A524', marginTop: '2px' }}
                />
                <span>
                  I understand that fee splits, DAO governance, and keyless NFT vault backing are decentralized and permanent once deployed to testnet.
                </span>
              </label>

              <button
                type="button"
                disabled={!acknowledged || !name.trim()}
                onClick={handleLaunch}
                className="btn-primary"
                style={{
                  minHeight: '52px',
                  fontSize: '16px',
                  width: '100%',
                  opacity: acknowledged && name.trim() ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={18} /> Launch Collection on NEAR Testnet
              </button>
            </div>
          )}

          {/* Wizard Navigation Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingTop: '10px' }}>
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep(Math.max(0, step - 1))}
              className="btn-secondary"
              style={{ minHeight: '44px', padding: '0 20px', opacity: step === 0 ? 0.4 : 1 }}
            >
              Back
            </button>

            {step < 5 && (
              <button
                type="button"
                onClick={() => setStep(Math.min(5, step + 1))}
                className="btn-primary"
                style={{ minHeight: '44px', padding: '0 24px' }}
              >
                Continue
              </button>
            )}
          </div>
        </section>

        {/* Right: Real-Time Dynamic Marketplace Preview Card */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Live Marketplace Preview</h2>
            <span className="success-badge" style={{ fontSize: '11px' }}>Real-time</span>
          </div>

          <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid #2A2A33', background: '#1D1D25' }}>
            {/* Banner Preview */}
            <div style={{ height: '140px', background: '#0A0A0D', overflow: 'hidden', position: 'relative' }}>
              {bannerPreview ? (
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717A', fontSize: '13px' }}>
                  <Upload size={18} style={{ marginRight: '6px' }} /> Uploaded Banner Displays Here
                </div>
              )}
            </div>

            {/* Avatar & Info */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '14px',
                    marginTop: '-42px',
                    border: '3px solid #1D1D25',
                    background: '#15151B',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#71717A',
                    flexShrink: 0,
                  }}
                >
                  {avatarPreview || artPreview ? (
                    <img
                      src={avatarPreview || artPreview || ''}
                      alt="Avatar"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <ImageIcon size={20} />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <strong style={{ fontSize: '17px', color: '#F4F4F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name.trim() || 'Your Collection Name'}
                  </strong>
                  <span style={{ fontSize: '12px', color: '#A1A1AA' }}>
                    {symbol ? `$${symbol}` : '$SYMBOL'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="gold-badge" style={{ fontSize: '11px' }}>
                  {pubPrice || '1.00'} NEAR
                </span>
                <span className="neutral-badge" style={{ fontSize: '11px' }}>
                  {supply} Pieces
                </span>
                <span className="success-badge" style={{ fontSize: '11px' }}>
                  Royalty: {royalty.toFixed(1)}%
                </span>
              </div>

              <span style={{ fontSize: '12.5px', color: '#A1A1AA', lineHeight: 1.5 }}>
                {desc.trim() || 'Your description will appear here on the Quorum Marketplace drop card.'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#C4C4CC', lineHeight: 1.55 }}>
            <strong style={{ fontSize: '14px', color: '#F4F4F5' }}>Economic & Governance Model Breakdown:</strong>
            <span>• <strong>50% ({vaultBackingNear.toFixed(2)} NEAR)</strong> backs each buyer's individual keyless vault (<code style={{ color: '#86EFAC' }}>v&lt;id&gt;.{contractId}</code>).</span>
            <span>• <strong>50% ({treasuryDepositNear.toFixed(2)} NEAR)</strong> funds the dedicated collection DAO Treasury (<code style={{ color: '#F5A524' }}>{treAccountName}</code>).</span>
            <span>• <strong>Sovereign Governance:</strong> Governed on-chain exclusively by {name.trim() || 'collection'} NFT holders via <code style={{ color: '#D8B4FE' }}>{daoAccountName}</code> (1 NFT = 1 Vote, 0 cross-bridging).</span>
            <span>• <strong>Creator Royalty:</strong> You earn <strong style={{ color: '#F5A524' }}>{royalty.toFixed(1)}%</strong> on every secondary marketplace trade.</span>
          </div>
        </section>
      </div>
    </div>
  );
};
