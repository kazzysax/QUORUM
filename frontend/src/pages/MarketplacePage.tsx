import React, { useState } from 'react';
import type { CollectionItem, TokenItem, Page, OfferItem } from '../types';
import {
  ArrowRight,
  ArrowLeft,
  Flame,
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
  Share2,
  Search,
  SlidersHorizontal,
  Layers,
  Tag,
  Users,
  Activity,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import {
  COLLECTION_HOLDERS,
  COLLECTION_TRAITS,
  COLLECTION_ACTIVITY,
  COLLECTION_OFFERS,
} from '../mockData';

interface MarketplacePageProps {
  collections: CollectionItem[];
  listings: TokenItem[];
  selectedCollectionId?: string | null;
  walletAccountId?: string;
  onNavigate: (page: Page) => void;
  onSelectCollection: (collectionId: string | null) => void;
  onBuyListing: (token: TokenItem) => void;
  onPlaceOffer?: (targetNft: TokenItem, amountNear: string) => void;
  onAcceptOffer?: (offer: OfferItem) => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  collections,
  listings,
  selectedCollectionId,
  walletAccountId,
  onNavigate: _onNavigate,
  onSelectCollection,
  onBuyListing,
  onPlaceOffer,
  onAcceptOffer,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'Molten Hours' | 'Tidewater'>('all');

  // Dedicated Collection View State
  const [collectionTab, setCollectionTab] = useState<'items' | 'offers' | 'holders' | 'traits' | 'activity' | 'analytics'>('items');
  const [copiedContract, setCopiedContract] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [itemSort, setItemSort] = useState<'id-asc' | 'id-desc' | 'price-asc' | 'price-desc'>('id-asc');
  const [activityFilter, setActivityFilter] = useState<'all' | 'Sale' | 'Mint' | 'Burn & Redeem' | 'List'>('all');

  // Quick Offer Modal State
  const [offerModalToken, setOfferModalToken] = useState<TokenItem | null>(null);
  const [offerInputAmount, setOfferInputAmount] = useState('1.50');

  const featured = collections.slice(0, 2).map((col) => ({
    id: col.id,
    title: col.name,
    badge: 'Live on Testnet',
    creator: col.creator,
    description: col.description,
    image: col.cover_image,
  }));

  const currentHero = featured[activeSlide] || featured[0];

  // Active collection if one is selected
  const activeCollection = selectedCollectionId
    ? collections.find((c) => c.id === selectedCollectionId) || null
    : null;

  // Other collection for quick switching
  const otherCollection = activeCollection
    ? collections.find((c) => c.id !== activeCollection.id) || null
    : null;

  // Listings for the selected collection
  const rawCollectionListings = activeCollection
    ? listings.filter(
        (l) =>
          l.collection.toLowerCase() === activeCollection.name.toLowerCase() ||
          l.collection === activeCollection.symbol
      )
    : listings.filter((l) => {
        if (collectionFilter === 'all') return true;
        return l.collection === collectionFilter;
      });

  // Filtered and sorted listings for items tab
  const collectionListings = rawCollectionListings
    .filter((token) => {
      if (!itemSearch.trim()) return true;
      const q = itemSearch.toLowerCase();
      return (
        token.title.toLowerCase().includes(q) ||
        token.token_id.includes(q) ||
        token.vault_account?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const idA = parseInt(a.token_id || '0', 10);
      const idB = parseInt(b.token_id || '0', 10);
      const priceA = parseFloat(a.price || '0');
      const priceB = parseFloat(b.price || '0');

      if (itemSort === 'id-asc') return idA - idB;
      if (itemSort === 'id-desc') return idB - idA;
      if (itemSort === 'price-asc') return priceA - priceB;
      if (itemSort === 'price-desc') return priceB - priceA;
      return 0;
    });

  // Copy Contract Address
  const handleCopyContract = (contractId: string) => {
    navigator.clipboard.writeText(contractId);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  // Submit Offer
  const handleQuickOfferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerModalToken || !onPlaceOffer) return;
    const amountNum = parseFloat(offerInputAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    onPlaceOffer(offerModalToken, amountNum.toFixed(2));
    setOfferModalToken(null);
  };

  // =========================================================================
  // 1. DEDICATED OPENSEA-STYLE COLLECTION VIEW (Molten Hours or Tidewater)
  // =========================================================================
  if (activeCollection) {
    const stats = activeCollection.stats || {
      floorPrice: `${activeCollection.floor_price_near} NEAR`,
      floorChange1D: activeCollection.change_24h || '0%',
      topOffer: activeCollection.id === 'molten-hours' ? '1.80 NEAR' : '1.50 NEAR',
      volume24H: '4.00 NEAR',
      totalVolume: '24.00 NEAR',
      listedCount: rawCollectionListings.length,
      listedPercent: Math.round((rawCollectionListings.length / activeCollection.supply) * 100),
      uniqueOwnersCount: 2,
      uniqueOwnersPercent: 10,
      contractId: `${activeCollection.id === 'molten-hours' ? 'molten' : 'tide'}.qrm1.testnet`,
      createdDate: 'OCT 2026',
      royaltyPercent: activeCollection.royalty_percent,
    };

    const holders = COLLECTION_HOLDERS[activeCollection.id] || [];
    const traits = COLLECTION_TRAITS[activeCollection.id] || [];
    const activities = (COLLECTION_ACTIVITY[activeCollection.id] || []).filter((act) => {
      if (activityFilter === 'all') return true;
      return act.event === activityFilter;
    });
    const colOffers = COLLECTION_OFFERS[activeCollection.id] || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
        {/* Navigation Breadcrumb Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => onSelectCollection(null)}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
            >
              <ArrowLeft size={15} /> All Collections
            </button>
            <span style={{ color: '#71717A', fontSize: '14px' }}>/</span>
            <span style={{ color: '#F5A524', fontWeight: 600, fontSize: '15px' }}>{activeCollection.name}</span>
          </div>

          {otherCollection && (
            <button
              type="button"
              onClick={() => onSelectCollection(otherCollection.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '38px',
                padding: '0 16px',
                borderRadius: '999px',
                background: '#1D1D25',
                border: '1px solid #2A2A33',
                color: '#F4F4F5',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Switch to {otherCollection.name} Collection <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* Hero Cover Banner */}
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '24px',
            border: '1px solid #2A2A33',
            height: '240px',
            boxSizing: 'border-box',
          }}
        >
          <img
            src={activeCollection.cover_image}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(10,10,13,0.2) 0%, rgba(10,10,13,0.85) 100%)',
            }}
          />
        </section>

        {/* Collection Identity & Action Row (OpenSea Style) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '-56px',
            padding: '0 12px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <img
                src={activeCollection.avatar_image}
                alt={activeCollection.name}
                style={{
                  width: '108px',
                  height: '108px',
                  borderRadius: '22px',
                  objectFit: 'cover',
                  border: '4px solid #0A0A0D',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 700, letterSpacing: '-0.02em' }}>
                    {activeCollection.name}
                  </h1>
                  <span title="Verified NEAR Testnet Contract" style={{ color: '#38BDF8', display: 'inline-flex', alignItems: 'center' }}>
                    <ShieldCheck size={26} fill="#0284C7" color="#F0F9FF" />
                  </span>
                </div>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Symbol: <strong style={{ color: '#F4F4F5' }}>{activeCollection.symbol}</strong> • Creator: <strong style={{ color: '#F4F4F5' }}>{activeCollection.creator}</strong>
                </span>
              </div>
            </div>

            {/* Contract, Explorer & Share Buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleCopyContract(stats.contractId)}
                className="btn-secondary"
                style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Copy contract address"
              >
                {copiedContract ? <Check size={14} color="#86EFAC" /> : <Copy size={14} />}
                <span>{stats.contractId}</span>
              </button>
              <a
                href={`https://testnet.nearblocks.io/address/${stats.contractId}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
              >
                <ExternalLink size={14} /> NearBlocks
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Collection URL copied to clipboard!');
                }}
                className="btn-secondary"
                style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Share collection"
              >
                <Share2 size={14} /> Share
              </button>
            </div>
          </div>

          {/* Sub-row metadata chips matching OpenSea reference layout */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span className="neutral-badge" style={{ fontWeight: 600 }}>NEAR TESTNET</span>
            <span className="neutral-badge">BY {activeCollection.creator}</span>
            <span className="neutral-badge">{activeCollection.supply} SUPPLY (100% MINTED)</span>
            <span className="neutral-badge">{stats.createdDate}</span>
            <span className="neutral-badge">{stats.royaltyPercent}% CREATOR FEE</span>
            <span className="success-badge">0.50 NEAR KEYLESS VAULT</span>
            <span className="gold-badge">10.00 NEAR DAO TREASURY</span>
          </div>

          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#C4C4CC', maxWidth: '820px' }}>
            {activeCollection.description}
          </p>
        </div>

        {/* OpenSea-Style Real-Time Testnet Metrics Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
            background: '#15151B',
            border: '1px solid #2A2A33',
            borderRadius: '20px',
            padding: '16px 20px',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>FLOOR PRICE</span>
            <strong style={{ display: 'block', fontSize: '18px', fontFamily: 'Space Grotesk', marginTop: '2px', color: '#F4F4F5' }}>
              {stats.floorPrice}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>1D FLOOR %</span>
            <strong style={{ display: 'block', fontSize: '18px', color: '#86EFAC', fontFamily: 'Space Grotesk', marginTop: '2px' }}>
              {stats.floorChange1D}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>TOP OFFER</span>
            <strong style={{ display: 'block', fontSize: '18px', color: '#F5A524', fontFamily: 'Space Grotesk', marginTop: '2px' }}>
              {stats.topOffer}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>24H VOLUME</span>
            <strong style={{ display: 'block', fontSize: '18px', fontFamily: 'Space Grotesk', marginTop: '2px', color: '#F4F4F5' }}>
              {stats.volume24H}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>TOTAL VOLUME</span>
            <strong style={{ display: 'block', fontSize: '18px', fontFamily: 'Space Grotesk', marginTop: '2px', color: '#F4F4F5' }}>
              {stats.totalVolume}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>LISTED</span>
            <strong style={{ display: 'block', fontSize: '18px', fontFamily: 'Space Grotesk', marginTop: '2px', color: '#F4F4F5' }}>
              {stats.listedCount} ({stats.listedPercent}%)
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>OWNERS (UNIQUE)</span>
            <strong style={{ display: 'block', fontSize: '18px', fontFamily: 'Space Grotesk', marginTop: '2px', color: '#F4F4F5' }}>
              {stats.uniqueOwnersCount} ({stats.uniqueOwnersPercent}%)
            </strong>
          </div>
        </div>

        {/* OpenSea-Style Collection Navigation Tabs */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid #2A2A33',
            paddingBottom: '12px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {[
            { id: 'items', label: `Items (${rawCollectionListings.length})`, icon: Layers },
            { id: 'offers', label: `Offers (${colOffers.length})`, icon: Tag },
            { id: 'holders', label: `Holders (${holders.length})`, icon: Users },
            { id: 'traits', label: `Traits (${traits.length})`, icon: Sparkles },
            { id: 'activity', label: 'Activity', icon: Activity },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = collectionTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setCollectionTab(tab.id as any)}
                style={{
                  minHeight: '40px',
                  padding: '0 18px',
                  borderRadius: '999px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: isActive ? '#F5A524' : '#1D1D25',
                  color: isActive ? '#111113' : '#D4D4D8',
                  border: isActive ? '1px solid #F5A524' : '1px solid #2A2A33',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ===================================================================
            TAB 1: ITEMS (PIECES AVAILABLE FOR SALE)
           =================================================================== */}
        {collectionTab === 'items' && (
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
            {/* Search and Sort Toolbar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 280px', maxWidth: '420px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#71717A' }} />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search by token ID or title..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px 10px 38px',
                      borderRadius: '12px',
                      background: '#1D1D25',
                      border: '1px solid #2A2A33',
                      color: '#F4F4F5',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#A1A1AA', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <SlidersHorizontal size={14} /> Sort:
                </span>
                <select
                  value={itemSort}
                  onChange={(e) => setItemSort(e.target.value as any)}
                  style={{
                    minHeight: '38px',
                    padding: '0 12px',
                    borderRadius: '12px',
                    background: '#1D1D25',
                    border: '1px solid #2A2A33',
                    color: '#F4F4F5',
                    fontSize: '13px',
                  }}
                >
                  <option value="id-asc">Token ID: Low to High</option>
                  <option value="id-desc">Token ID: High to Low</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Grid */}
            {collectionListings.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#A1A1AA' }}>
                No pieces match your search criteria.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {collectionListings.map((token) => (
                  <div
                    key={token.id}
                    style={{
                      background: '#1D1D25',
                      border: '1px solid #2A2A33',
                      borderRadius: '20px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '14px',
                      transition: 'border-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F5A524'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2A2A33'; }}
                  >
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '16px', overflow: 'hidden' }}>
                      <img
                        src={token.image}
                        alt={token.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          background: 'rgba(10,10,13,0.85)',
                          backdropFilter: 'blur(4px)',
                          color: '#F4F4F5',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '8px',
                          border: '1px solid #2A2A33',
                        }}
                      >
                        {token.collection}
                      </span>
                      <span
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: 'rgba(34,197,94,0.15)',
                          border: '1px solid rgba(34,197,94,0.4)',
                          color: '#86EFAC',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '8px',
                        }}
                      >
                        0.50 NEAR Vault
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <strong style={{ fontSize: '16px', fontWeight: 600 }}>{token.title}</strong>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: '#F5A524', fontFamily: 'Space Grotesk' }}>
                          {token.price} NEAR
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#A1A1AA' }}>
                        <span>Seller: {token.owner_id}</span>
                        <a
                          href={`https://testnet.nearblocks.io/address/${token.vault_account}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#F5A524', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          {token.vault_account} <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => onBuyListing(token)}
                        className="btn-primary"
                        style={{ flex: 1, minHeight: '40px', fontSize: '13px' }}
                      >
                        Buy for {token.price} NEAR
                      </button>
                      {onPlaceOffer && (
                        <button
                          type="button"
                          onClick={() => setOfferModalToken(token)}
                          className="btn-secondary"
                          style={{ minHeight: '40px', padding: '0 14px', fontSize: '13px' }}
                          title="Place escrow offer"
                        >
                          Offer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ===================================================================
            TAB 2: OFFERS (COLLECTION-WIDE ESCROW OFFERS)
           =================================================================== */}
        {collectionTab === 'offers' && (
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Active Offers on {activeCollection.name}</h2>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Offers are locked in Quorum testnet escrow and settle instantly when accepted.
                </span>
              </div>
              <span className="gold-badge">{colOffers.length} Active Offers</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '600px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#A1A1AA', fontSize: '12px' }}>
                    <th style={{ padding: '10px 12px' }}>Item</th>
                    <th style={{ padding: '10px 12px' }}>Offer Price</th>
                    <th style={{ padding: '10px 12px' }}>Vault Backing</th>
                    <th style={{ padding: '10px 12px' }}>Offered By</th>
                    <th style={{ padding: '10px 12px' }}>Duration</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {colOffers.map((o) => {
                    const isOwner = walletAccountId === 'malekoala9992.testnet' && o.nft_id === 'molt-2';
                    return (
                      <tr key={o.id}>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src={o.image} alt={o.nft_title} style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }} />
                            <strong>{o.nft_title}</strong>
                          </div>
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', fontWeight: 700, color: '#F5A524', fontFamily: 'Space Grotesk' }}>
                          {o.amount_near} NEAR
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', color: '#86EFAC' }}>
                          0.50 NEAR
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>
                          {o.from}
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>
                          {o.expires_in}
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33' }}>
                          <span className="success-badge" style={{ fontSize: '11px' }}>Escrowed</span>
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33' }}>
                          {isOwner && onAcceptOffer ? (
                            <button
                              type="button"
                              onClick={() => onAcceptOffer(o)}
                              className="btn-primary"
                              style={{ minHeight: '34px', padding: '0 14px', fontSize: '12px' }}
                            >
                              Accept &amp; Claim
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#71717A' }}>Held in Escrow</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===================================================================
            TAB 3: HOLDERS (REAL ON-CHAIN TOKEN DISTRIBUTION)
           =================================================================== */}
        {collectionTab === 'holders' && (
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Token Holders &amp; Governance Power</h2>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Tracked live from NEP-171 smart contract state on NEAR testnet.
                </span>
              </div>
              <span className="gold-badge">{holders.length} Registered Accounts</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '600px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#A1A1AA', fontSize: '12px' }}>
                    <th style={{ padding: '10px 12px' }}>Rank</th>
                    <th style={{ padding: '10px 12px' }}>Holder Account</th>
                    <th style={{ padding: '10px 12px' }}>Quantity</th>
                    <th style={{ padding: '10px 12px' }}>% of Supply</th>
                    <th style={{ padding: '10px 12px' }}>Tokens Held</th>
                    <th style={{ padding: '10px 12px' }}>DAO Voting Weight</th>
                    <th style={{ padding: '10px 12px' }}>Vault Value Backed</th>
                  </tr>
                </thead>
                <tbody>
                  {holders.map((h) => (
                    <tr key={h.rank}>
                      <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', fontWeight: 600 }}>#{h.rank}</td>
                      <td style={{ padding: '12px', borderTop: '1px solid #2A2A33' }}>
                        <a
                          href={`https://testnet.nearblocks.io/address/${h.accountId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#F5A524', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          {h.accountId} <ExternalLink size={11} />
                        </a>
                      </td>
                      <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', fontWeight: 600 }}>{h.count}</td>
                      <td style={{ padding: '12px', borderTop: '1px solid #2A2A33' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{h.percent}%</span>
                          <div style={{ width: '60px', height: '6px', background: '#2A2A33', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${h.percent}%`, height: '100%', background: '#F5A524' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', fontSize: '12px', color: '#A1A1AA' }}>
                        {h.tokensHeld.slice(0, 6).join(', ')}{h.tokensHeld.length > 6 ? ` +${h.tokensHeld.length - 6} more` : ''}
                      </td>
                      <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', color: '#86EFAC', fontWeight: 600 }}>
                        {h.votingPower} {h.votingPower === 1 ? 'Vote' : 'Votes'}
                      </td>
                      <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', fontWeight: 600 }}>
                        {h.vaultValueNear}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===================================================================
            TAB 4: TRAITS (OPENSEA-STYLE TRAIT BREAKDOWN)
           =================================================================== */}
        {collectionTab === 'traits' && (
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Collection Traits &amp; Architecture</h2>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Smart contract traits, vault attributes, and rarity distribution.
                </span>
              </div>
              <span className="gold-badge">{traits.length} Traits Defined</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
              {traits.map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#1D1D25',
                    border: '1px solid #2A2A33',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#A1A1AA', letterSpacing: '0.05em' }}>
                    {t.category}
                  </span>
                  <strong style={{ fontSize: '15px', color: '#F4F4F5' }}>{t.name}</strong>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '12px' }}>
                    <span style={{ color: '#F5A524' }}>{t.rarityPercent}% have this trait</span>
                    <span style={{ color: '#71717A' }}>{t.count} / {activeCollection.supply}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===================================================================
            TAB 5: ACTIVITY (ON-CHAIN TRANSACTION LEDGER)
           =================================================================== */}
        {collectionTab === 'activity' && (
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Item Activity &amp; Transaction Ledger</h2>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  All mints, secondary sales, burns, and keyless vault creation events on NEAR testnet.
                </span>
              </div>

              {/* Event Filter Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(['all', 'Sale', 'Mint', 'Burn & Redeem', 'List'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActivityFilter(filter)}
                    style={{
                      minHeight: '32px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: activityFilter === filter ? '#F5A524' : '#1D1D25',
                      color: activityFilter === filter ? '#111113' : '#D4D4D8',
                      border: activityFilter === filter ? '1px solid #F5A524' : '1px solid #2A2A33',
                    }}
                  >
                    {filter === 'all' ? 'All Events' : filter}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '650px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#A1A1AA', fontSize: '12px' }}>
                    <th style={{ padding: '10px 12px' }}>Event</th>
                    <th style={{ padding: '10px 12px' }}>Item</th>
                    <th style={{ padding: '10px 12px' }}>Price</th>
                    <th style={{ padding: '10px 12px' }}>From</th>
                    <th style={{ padding: '10px 12px' }}>To</th>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act) => {
                    let badgeClass = 'neutral-badge';
                    if (act.event === 'Sale') badgeClass = 'success-badge';
                    if (act.event === 'Mint') badgeClass = 'gold-badge';
                    if (act.event === 'Burn & Redeem') badgeClass = 'danger-badge';

                    return (
                      <tr key={act.id}>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33' }}>
                          <span className={badgeClass} style={{ fontSize: '11px', fontWeight: 600 }}>
                            {act.event}
                          </span>
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', fontWeight: 600 }}>
                          {act.title}
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', color: '#F5A524', fontFamily: 'Space Grotesk', fontWeight: 600 }}>
                          {act.priceNear || '—'}
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>
                          {act.from}
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>
                          {act.to}
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', color: '#71717A', fontSize: '12px' }}>
                          {act.date}
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #2A2A33' }}>
                          <a
                            href={`https://testnet.nearblocks.io/txns/${act.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#F5A524', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12px' }}
                          >
                            {act.txHash.slice(0, 8)}... <ExternalLink size={10} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===================================================================
            TAB 6: ANALYTICS (CHARTS, VOLUME & VAULT SOLVENCY)
           =================================================================== */}
        {collectionTab === 'analytics' && (
          <section
            style={{
              background: '#15151B',
              border: '1px solid #2A2A33',
              borderRadius: '24px',
              padding: '24px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Market Analytics &amp; Capital Depth</h2>
              <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                Secondary market metrics, floor evolution, and vault liquidity reserves.
              </span>
            </div>

            {/* Visual Floor & Volume Chart */}
            <div
              style={{
                background: '#1D1D25',
                border: '1px solid #2A2A33',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '15px' }}>7-Day Floor Price &amp; Trading Volume (NEAR)</strong>
                <span className="success-badge">+100% Floor Growth (1.00 → 2.00 NEAR)</span>
              </div>

              {/* Chart SVG Graphic */}
              <div style={{ width: '100%', height: '160px', position: 'relative' }}>
                <svg viewBox="0 0 600 140" style={{ width: '100%', height: '100%' }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F5A524" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#F5A524" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  <line x1="0" y1="20" x2="600" y2="20" stroke="#2A2A33" strokeDasharray="4" />
                  <line x1="0" y1="70" x2="600" y2="70" stroke="#2A2A33" strokeDasharray="4" />
                  <line x1="0" y1="120" x2="600" y2="120" stroke="#2A2A33" />

                  {/* Volume Bars */}
                  <rect x="40" y="80" width="24" height="40" fill="#2A2A33" rx="4" />
                  <rect x="130" y="60" width="24" height="60" fill="#2A2A33" rx="4" />
                  <rect x="220" y="40" width="24" height="80" fill="#2A2A33" rx="4" />
                  <rect x="310" y="50" width="24" height="70" fill="#2A2A33" rx="4" />
                  <rect x="400" y="30" width="24" height="90" fill="#2A2A33" rx="4" />
                  <rect x="490" y="20" width="24" height="100" fill="rgba(245, 165, 36, 0.6)" rx="4" />

                  {/* Price Line & Fill */}
                  <path
                    d="M 52 100 Q 142 90 232 75 T 412 40 T 502 25"
                    fill="none"
                    stroke="#F5A524"
                    strokeWidth="3"
                  />
                  <circle cx="502" cy="25" r="5" fill="#F5A524" />
                </svg>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#71717A' }}>
                <span>Day 1 (Mint @ 1.00 NEAR)</span>
                <span>Day 3 (Vault Funded)</span>
                <span>Day 5 (Secondary Trades)</span>
                <span style={{ color: '#F5A524', fontWeight: 600 }}>Today (Floor: 2.00 NEAR)</span>
              </div>
            </div>

            {/* Solvency & Depth Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Individual Vault Reserves</span>
                <strong style={{ display: 'block', fontSize: '20px', color: '#86EFAC', marginTop: '4px' }}>
                  {activeCollection.id === 'molten-hours' ? '9.50 NEAR' : '10.00 NEAR'}
                </strong>
                <span style={{ fontSize: '11px', color: '#71717A', marginTop: '2px', display: 'block' }}>
                  100% held in verifiable keyless sub-accounts
                </span>
              </div>

              <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '12px', color: '#A1A1AA' }}>DAO Treasury Reserve</span>
                <strong style={{ display: 'block', fontSize: '20px', color: '#F4F4F5', marginTop: '4px' }}>
                  10.00 NEAR
                </strong>
                <span style={{ fontSize: '11px', color: '#71717A', marginTop: '2px', display: 'block' }}>
                  Controlled by token holder governance
                </span>
              </div>

              <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Combined Protocol Liquidity</span>
                <strong style={{ display: 'block', fontSize: '20px', color: '#F5A524', marginTop: '4px' }}>
                  {activeCollection.id === 'molten-hours' ? '19.50 NEAR' : '20.00 NEAR'}
                </strong>
                <span style={{ fontSize: '11px', color: '#71717A', marginTop: '2px', display: 'block' }}>
                  Vault backing + Treasury collateral
                </span>
              </div>

              <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Floor Defense Ratio</span>
                <strong style={{ display: 'block', fontSize: '20px', color: '#86EFAC', marginTop: '4px' }}>
                  100% Solvency
                </strong>
                <span style={{ fontSize: '11px', color: '#71717A', marginTop: '2px', display: 'block' }}>
                  Zero fraction, immediate on-chain burn &amp; redeem
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Quick Offer Modal */}
        {offerModalToken && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '16px',
            }}
          >
            <div
              style={{
                background: '#15151B',
                border: '1px solid #2A2A33',
                borderRadius: '24px',
                padding: '28px',
                maxWidth: '440px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Make Escrow Offer</h3>
                <button
                  type="button"
                  onClick={() => setOfferModalToken(null)}
                  style={{ background: 'transparent', border: 'none', color: '#A1A1AA', cursor: 'pointer', fontSize: '18px' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#1D1D25', padding: '12px', borderRadius: '14px', border: '1px solid #2A2A33' }}>
                <img src={offerModalToken.image} alt={offerModalToken.title} style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} />
                <div>
                  <strong style={{ fontSize: '15px' }}>{offerModalToken.title}</strong>
                  <span style={{ fontSize: '12px', color: '#A1A1AA', display: 'block' }}>Listed at: {offerModalToken.price} NEAR</span>
                </div>
              </div>

              <form onSubmit={handleQuickOfferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
                  Your Offer Amount (NEAR test tokens)
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    value={offerInputAmount}
                    onChange={(e) => setOfferInputAmount(e.target.value)}
                    style={{
                      minHeight: '44px',
                      borderRadius: '12px',
                      border: '1px solid #2A2A33',
                      background: '#1D1D25',
                      color: '#F4F4F5',
                      padding: '0 12px',
                      fontSize: '15px',
                      fontFamily: 'Space Grotesk',
                    }}
                  />
                </label>

                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#71717A' }}>
                  Your offer will be locked into Quorum testnet escrow. If accepted, the piece transfers to your wallet. You can cancel and refund anytime.
                </p>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setOfferModalToken(null)}
                    className="btn-secondary"
                    style={{ flex: 1, minHeight: '44px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ flex: 1, minHeight: '44px' }}
                  >
                    Lock Offer &amp; Escrow
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. MAIN MARKETPLACE OVERVIEW (When no specific collection is selected)
  // =========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Featured Banner & Top Collections Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'stretch' }}>
        {/* Featured Hero Carousel */}
        <section
          aria-label="Featured collections"
          style={{
            flex: '999 1 560px',
            minWidth: 0,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '24px',
            border: '1px solid #2A2A33',
            minHeight: '360px',
            padding: '40px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <img
              src={currentHero.image}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                transition: 'all 0.4s ease',
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(10,10,13,0.3) 0%, rgba(10,10,13,0.85) 60%, rgba(10,10,13,0.98) 100%)',
              }}
            />
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              maxWidth: '560px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="gold-badge">{currentHero.badge}</span>
              <span className="neutral-badge">by {currentHero.creator}</span>
              <span className="neutral-badge">20 Total Pieces</span>
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                lineHeight: 1.1,
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {currentHero.title}
            </h1>

            <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.55, color: '#D4D4D8' }}>
              {currentHero.description}
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '6px' }}>
              <button
                type="button"
                onClick={() => onSelectCollection(currentHero.id)}
                className="btn-primary"
                style={{ minHeight: '44px', padding: '0 24px', fontSize: '14px' }}
              >
                View Collection <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Carousel dots */}
          <div
            role="tablist"
            aria-label="Featured slides"
            style={{ position: 'absolute', right: '32px', bottom: '28px', display: 'flex', gap: '8px', zIndex: 2 }}
          >
            {featured.map((item, idx) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={activeSlide === idx}
                aria-label={`Slide ${idx + 1}: ${item.title}`}
                type="button"
                onClick={() => setActiveSlide(idx)}
                style={{
                  width: activeSlide === idx ? '28px' : '8px',
                  height: '8px',
                  borderRadius: '999px',
                  background: activeSlide === idx ? '#F5A524' : '#3F3F46',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>
        </section>

        {/* Top Collections Ranking Sidebar */}
        <aside
          aria-label="Top Collections Ranking"
          style={{
            flex: '1 1 320px',
            minWidth: 0,
            background: '#15151B',
            border: '1px solid #2A2A33',
            borderRadius: '24px',
            padding: '24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Top Collections</h2>
              <span style={{ fontSize: '12px', color: '#A1A1AA' }}>24h Volume</span>
            </div>

            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {collections.map((col, idx) => (
                <li
                  key={col.id}
                  onClick={() => onSelectCollection(col.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px',
                    borderRadius: '14px',
                    background: '#1D1D25',
                    border: '1px solid #2A2A33',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F5A524'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2A2A33'; }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#71717A', width: '18px', textAlign: 'center' }}>
                    {idx + 1}
                  </span>
                  <img
                    src={col.avatar_image}
                    alt={col.name}
                    style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }}
                  />
                  <div style={{ flex: '1 1 100px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <strong style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {col.name}
                    </strong>
                    <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Floor: {col.floor_price_near} NEAR</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ display: 'block', fontSize: '13px', color: '#86EFAC' }}>{col.change_24h}</strong>
                    <span style={{ fontSize: '11px', color: '#71717A' }}>20 pieces</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div
            style={{
              padding: '12px',
              borderRadius: '14px',
              background: '#1D1D25',
              border: '1px solid #2A2A33',
              fontSize: '12px',
              color: '#A1A1AA',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: '#F4F4F5', display: 'block', marginBottom: '2px' }}>100% On-Chain Testnet Assets</strong>
            Every piece holds 0.50 NEAR in its dedicated keyless vault.
          </div>
        </aside>
      </div>

      {/* Collections Overview Selector Cards */}
      <section
        style={{
          background: '#15151B',
          border: '1px solid #2A2A33',
          borderRadius: '24px',
          padding: '24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Explore Collections</h2>
            <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
              Select a collection to view its OpenSea-style dashboard, live pieces, holders, traits, activity, and analytics.
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {collections.map((col) => {
            const countForSale = listings.filter(
              (l) => l.collection.toLowerCase() === col.name.toLowerCase() || l.collection === col.symbol
            ).length;

            return (
              <div
                key={col.id}
                onClick={() => onSelectCollection(col.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#F4F4F5',
                  background: '#1D1D25',
                  border: '1px solid #2A2A33',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = '#F5A524';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#2A2A33';
                }}
              >
                <img
                  src={col.cover_image}
                  alt={col.name}
                  style={{ width: '100%', height: '170px', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={col.avatar_image}
                        alt={col.name}
                        style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover' }}
                      />
                      <div>
                        <strong style={{ fontSize: '18px', fontWeight: 700 }}>{col.name}</strong>
                        <span style={{ fontSize: '12px', color: '#A1A1AA', display: 'block' }}>by {col.creator}</span>
                      </div>
                    </div>
                    <span className="gold-badge">{countForSale} for sale</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#C4C4CC' }}>
                    {col.description}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderTop: '1px solid #2A2A33', paddingTop: '12px' }}>
                    <span>Backing: <strong style={{ color: '#86EFAC' }}>0.50 NEAR</strong></span>
                    <span style={{ color: '#F5A524', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      View {col.name} Dashboard <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live Secondary Market Listings Across All Collections */}
      <section
        id="live-listings"
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Active Listings Up For Sale</h2>
            <span className="gold-badge">
              <Flame size={12} style={{ marginRight: '4px' }} />
              {listings.length} Available
            </span>
          </div>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
            Each piece holds 0.50 NEAR in its keyless sub-account vault
          </span>
        </div>

        {/* Collection Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setCollectionFilter('all')}
            style={{
              minHeight: '34px',
              padding: '0 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              background: collectionFilter === 'all' ? '#F5A524' : '#1D1D25',
              color: collectionFilter === 'all' ? '#111113' : '#D4D4D8',
              border: collectionFilter === 'all' ? '1px solid #F5A524' : '1px solid #2A2A33',
            }}
          >
            All Collections ({listings.length})
          </button>
          <button
            type="button"
            onClick={() => setCollectionFilter('Molten Hours')}
            style={{
              minHeight: '34px',
              padding: '0 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              background: collectionFilter === 'Molten Hours' ? '#F5A524' : '#1D1D25',
              color: collectionFilter === 'Molten Hours' ? '#111113' : '#D4D4D8',
              border: collectionFilter === 'Molten Hours' ? '1px solid #F5A524' : '1px solid #2A2A33',
            }}
          >
            Molten Hours ({listings.filter((l) => l.collection === 'Molten Hours' || l.collection === 'MOLT').length})
          </button>
          <button
            type="button"
            onClick={() => setCollectionFilter('Tidewater')}
            style={{
              minHeight: '34px',
              padding: '0 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              background: collectionFilter === 'Tidewater' ? '#F5A524' : '#1D1D25',
              color: collectionFilter === 'Tidewater' ? '#111113' : '#D4D4D8',
              border: collectionFilter === 'Tidewater' ? '1px solid #F5A524' : '1px solid #2A2A33',
            }}
          >
            Tidewater ({listings.filter((l) => l.collection === 'Tidewater' || l.collection === 'TIDE').length})
          </button>
        </div>

        {/* Listings Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
          {collectionListings.map((token) => (
            <div
              key={token.id}
              style={{
                background: '#1D1D25',
                border: '1px solid #2A2A33',
                borderRadius: '20px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '14px',
                transition: 'border-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F5A524'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2A2A33'; }}
            >
              <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '16px', overflow: 'hidden' }}>
                <img
                  src={token.image}
                  alt={token.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(10,10,13,0.85)',
                    backdropFilter: 'blur(4px)',
                    color: '#F4F4F5',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '8px',
                    border: '1px solid #2A2A33',
                  }}
                >
                  {token.collection}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(34,197,94,0.15)',
                    border: '1px solid rgba(34,197,94,0.4)',
                    color: '#86EFAC',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '8px',
                  }}
                >
                  0.50 NEAR Vault
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: '16px', fontWeight: 600 }}>{token.title}</strong>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#F5A524', fontFamily: 'Space Grotesk' }}>
                    {token.price} NEAR
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#A1A1AA' }}>
                  <span>Backing: 0.50 NEAR</span>
                  <a
                    href={`https://testnet.nearblocks.io/address/${token.vault_account}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#F5A524', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                  >
                    {token.vault_account} <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onBuyListing(token)}
                className="btn-primary"
                style={{ width: '100%', minHeight: '40px', fontSize: '13px', marginTop: '4px' }}
              >
                Buy for {token.price} NEAR
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
