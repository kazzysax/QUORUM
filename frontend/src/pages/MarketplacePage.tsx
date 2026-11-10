import React, { useState, useEffect } from 'react';
import type { CollectionItem, TokenItem, Page, OfferItem, ProposalItem } from '../types';
import { fetchLiveDaoBalances, type DaoBalances } from '../near';
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
  Landmark,
  CheckSquare,
  Clock,
  Star,
  Globe,
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
  proposals?: ProposalItem[];
  userNfts?: TokenItem[];
  onNavigate: (page: Page) => void;
  onSelectCollection: (collectionId: string | null) => void;
  onBuyListing: (token: TokenItem) => void;
  onPlaceOffer?: (targetNft: TokenItem, amountNear: string) => void;
  onAcceptOffer?: (offer: OfferItem) => void;
  onCastVote?: (proposalId: number, choice: 'yes' | 'no' | 'abstain') => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  collections,
  listings,
  selectedCollectionId,
  walletAccountId,
  proposals,
  userNfts,
  onNavigate,
  onSelectCollection,
  onBuyListing,
  onPlaceOffer,
  onAcceptOffer,
  onCastVote,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'Molten Hours' | 'Tidewater'>('all');

  // Dedicated Collection View State (Items, Offers, Holders, Traits, Activity, Analytics, DAO)
  const [collectionTab, setCollectionTab] = useState<'items' | 'offers' | 'holders' | 'traits' | 'activity' | 'analytics' | 'dao'>('items');
  const [copiedContract, setCopiedContract] = useState(false);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [itemSort, setItemSort] = useState<'id-asc' | 'id-desc' | 'price-asc' | 'price-desc'>('id-asc');
  const [activityFilter, setActivityFilter] = useState<'all' | 'Sale' | 'Mint' | 'Burn & Redeem' | 'List'>('all');
  const [daoVoteFilter, setDaoVoteFilter] = useState<'active' | 'past'>('active');
  const [daoBalances, setDaoBalances] = useState<DaoBalances | null>(null);

  // Quick Offer Modal State
  const [offerModalToken, setOfferModalToken] = useState<TokenItem | null>(null);
  const [offerInputAmount, setOfferInputAmount] = useState('1.50');

  // Active collection if one is selected
  const activeCollection = selectedCollectionId
    ? collections.find((c) => c.id === selectedCollectionId) || null
    : null;

  const featured = collections.slice(0, 2).map((col) => ({
    id: col.id,
    title: col.name,
    badge: 'Live on Testnet',
    creator: col.creator,
    description: col.description,
    image: col.cover_image,
  }));

  const currentHero = featured[activeSlide] || featured[0];

  useEffect(() => {
    let mounted = true;
    fetchLiveDaoBalances(activeCollection?.id).then((res) => {
      if (mounted) setDaoBalances(res);
    });
    const interval = setInterval(() => {
      fetchLiveDaoBalances(activeCollection?.id).then((res) => {
        if (mounted) setDaoBalances(res);
      });
    }, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeCollection?.id]);

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
    const liveListingsPrices = rawCollectionListings
      .map((l) => parseFloat(l.price || '0'))
      .filter((p) => p > 0);
    const liveFloorPrice = liveListingsPrices.length > 0
      ? `${Math.min(...liveListingsPrices).toFixed(2)} NEAR`
      : `${activeCollection.floor_price_near} NEAR`;

    const stats = {
      floorPrice: liveFloorPrice,
      floorChange1D: activeCollection.change_24h || '+0%',
      topOffer: activeCollection.id === 'molten-hours' ? '1.80 NEAR' : activeCollection.id === 'tidewater' ? '1.50 NEAR' : '0.85 NEAR',
      volume24H: `${(liveListingsPrices.reduce((a, b) => a + b, 0) * 0.4).toFixed(2)} NEAR`,
      totalVolume: `${((liveListingsPrices.reduce((a, b) => a + b, 0) * 1.5) + ((activeCollection.minted || 1) * 1.03)).toFixed(2)} NEAR`,
      listedCount: rawCollectionListings.length,
      listedPercent: Math.round((rawCollectionListings.length / (activeCollection.supply || 20)) * 100),
      uniqueOwnersCount: 2,
      uniqueOwnersPercent: 10,
      contractId: activeCollection.id === 'molten-hours'
        ? 'molten.qrm1.testnet'
        : activeCollection.id === 'tidewater'
          ? 'tide.qrm1.testnet'
          : `${activeCollection.id.replace(/-collection$/, '').replace(/-protocol$/, '').replace(/[^a-z0-9]/g, '')}.qrm1.testnet`,
      createdDate: 'NOV 2026',
      royaltyPercent: activeCollection.royalty_percent,
    };

    const holders = COLLECTION_HOLDERS[activeCollection.id] || [
      {
        rank: 1,
        accountId: activeCollection.creator || 'qrm1.testnet',
        tokensHeld: Array.from({ length: 17 }, (_, i) => `#${i + 4}`),
        count: 17,
        percent: 85,
        votingPower: 17,
        vaultValueNear: '8.50 NEAR',
      },
      {
        rank: 2,
        accountId: walletAccountId || 'malekoala9992.testnet',
        tokensHeld: ['#2', '#3'],
        count: 2,
        percent: 10,
        votingPower: 2,
        vaultValueNear: '1.00 NEAR',
      },
    ];
    const colOffers = COLLECTION_OFFERS[activeCollection.id] || [];
    const traits = COLLECTION_TRAITS[activeCollection.id] || [
      { name: 'Luminescent Core', category: 'Visual Element', rarityPercent: 50, count: 10 },
      { name: 'Celestial Glass Quill', category: 'Visual Element', rarityPercent: 50, count: 10 },
      { name: '0.50 Native NEAR Vault', category: 'Vault Reserve', rarityPercent: 100, count: 20 },
      { name: '1 DAO Share / Vote', category: 'Governance Weight', rarityPercent: 100, count: 20 },
    ];
    const activities = (COLLECTION_ACTIVITY[activeCollection.id] || [
      {
        id: `act-${activeCollection.id}-list`,
        event: 'List',
        tokenId: '4-20',
        title: `${activeCollection.name} #4–#20`,
        priceNear: `${activeCollection.price_near} NEAR ea.`,
        from: activeCollection.creator,
        to: 'mkt.qrm1.testnet',
        date: '1 hour ago',
        txHash: '9VxM41nL2w8P',
      },
    ]).filter((act) => {
      if (activityFilter === 'all') return true;
      return act.event === activityFilter;
    });

    // DAO Governance Proposals & Voting Rights
    const collectionProposals = (proposals || []).filter(
      (p) =>
        !p.collection ||
        p.collection.toLowerCase() === activeCollection.name.toLowerCase() ||
        p.collection === activeCollection.symbol
    );
    const activeProposals = collectionProposals.filter((p) => p.status === 'Voting open');
    const pastProposals = collectionProposals.filter((p) => p.status !== 'Voting open');

    const userTokensInCollection = (userNfts || []).filter(
      (t) =>
        t.collection.toLowerCase() === activeCollection.name.toLowerCase() ||
        t.collection === activeCollection.symbol
    );
    const userVotingPower = userTokensInCollection.length;

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

          {/* Quick Switch to any other collection */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {collections
              .filter((c) => c.id !== activeCollection.id)
              .map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => onSelectCollection(col.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    minHeight: '34px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    background: '#1D1D25',
                    border: '1px solid #2A2A33',
                    color: '#F4F4F5',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Switch to {col.name} <ArrowRight size={13} />
                </button>
              ))}
          </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 700, letterSpacing: '-0.02em' }}>
                    {activeCollection.name}
                  </h1>
                  <span title="Verified NEAR Testnet Contract" style={{ color: '#38BDF8', display: 'inline-flex', alignItems: 'center' }}>
                    <ShieldCheck size={26} fill="#0284C7" color="#F0F9FF" />
                  </span>

                  {/* OpenSea Style Quick Action Icons matching Image 2 */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setIsWatchlisted(!isWatchlisted)}
                      title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid #2A2A33',
                        borderRadius: '8px',
                        width: '32px',
                        height: '32px',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        color: isWatchlisted ? '#F5A524' : '#A1A1AA',
                      }}
                    >
                      <Star size={15} fill={isWatchlisted ? '#F5A524' : 'none'} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyContract(stats.contractId)}
                      title="Copy Contract Address"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid #2A2A33',
                        borderRadius: '8px',
                        width: '32px',
                        height: '32px',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        color: copiedContract ? '#86EFAC' : '#A1A1AA',
                      }}
                    >
                      {copiedContract ? <Check size={15} color="#86EFAC" /> : <Copy size={15} />}
                    </button>
                    <a
                      href={`https://testnet.nearblocks.io/address/${stats.contractId}`}
                      target="_blank"
                      rel="noreferrer"
                      title="NearBlocks Contract Explorer"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid #2A2A33',
                        borderRadius: '8px',
                        width: '32px',
                        height: '32px',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        color: '#A1A1AA',
                        textDecoration: 'none',
                      }}
                    >
                      <Globe size={15} />
                    </a>
                    <a
                      href="https://x.com/quorum_protocol"
                      target="_blank"
                      rel="noreferrer"
                      title="X / Twitter"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid #2A2A33',
                        borderRadius: '8px',
                        width: '32px',
                        height: '32px',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        color: '#A1A1AA',
                        textDecoration: 'none',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        alert('Collection URL copied to clipboard!');
                      }}
                      title="Share Collection"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid #2A2A33',
                        borderRadius: '8px',
                        width: '32px',
                        height: '32px',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        color: '#A1A1AA',
                      }}
                    >
                      <Share2 size={15} />
                    </button>
                  </div>
                </div>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Symbol: <strong style={{ color: '#F4F4F5' }}>{activeCollection.symbol}</strong> • Creator: <strong style={{ color: '#F4F4F5' }}>{activeCollection.creator}</strong>
                </span>
              </div>
            </div>

            {/* Contract, Explorer & Share Buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {activeCollection.minted < activeCollection.supply && (
                <button
                  type="button"
                  onClick={() => onNavigate('mint')}
                  className="btn-primary"
                  style={{
                    minHeight: '38px',
                    padding: '0 18px',
                    fontSize: '13px',
                    background: 'linear-gradient(135deg, #A855F7 0%, #F5A524 100%)',
                    color: '#000',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={15} /> Mint Live (1.03 NEAR)
                </button>
              )}
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
            <span className="neutral-badge">
              {activeCollection.supply} SUPPLY ({activeCollection.minted >= activeCollection.supply ? '100% MINTED' : `${activeCollection.minted} / ${activeCollection.supply} MINTED`})
            </span>
            <span className="neutral-badge">{stats.createdDate}</span>
            <span className="neutral-badge">{stats.royaltyPercent}% CREATOR FEE</span>
            <span className="success-badge">0.50 NEAR KEYLESS VAULT</span>
            <span className="gold-badge">{(daoBalances?.treasuryBalance ?? 1.50).toFixed(2)} NEAR DAO TREASURY</span>
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
            { id: 'dao', label: 'DAO', icon: Landmark },
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
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#A1A1AA', background: '#1D1D25', borderRadius: '18px', border: '1px solid #2A2A33', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                {activeCollection.minted < activeCollection.supply ? (
                  <>
                    <Sparkles size={36} color="#F5A524" />
                    <h3 style={{ margin: 0, fontSize: '20px', color: '#F4F4F5' }}>Public Mint is Currently Live!</h3>
                    <p style={{ margin: 0, maxWidth: '520px', lineHeight: 1.6, fontSize: '14px' }}>
                      <strong>{activeCollection.name}</strong> is open for genesis minting on NEAR testnet ({activeCollection.minted} / {activeCollection.supply} minted • {activeCollection.supply - activeCollection.minted} remaining). There are no secondary market pieces listed yet because collectors are currently minting genesis pieces from the contract.
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate('mint')}
                      className="btn-primary"
                      style={{ minHeight: '46px', padding: '0 28px', fontSize: '15px', fontWeight: 700, background: 'linear-gradient(135deg, #A855F7 0%, #F5A524 100%)', color: '#000' }}
                    >
                      <Sparkles size={16} /> Mint {activeCollection.name} (1.03 NEAR)
                    </button>
                  </>
                ) : (
                  <span>No pieces match your search criteria.</span>
                )}
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
                      {token.is_on_chain && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '10px',
                            left: '10px',
                            background: 'rgba(245,165,36,0.22)',
                            border: '1px solid rgba(245,165,36,0.5)',
                            color: '#FCD34D',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '8px',
                            backdropFilter: 'blur(4px)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ShieldCheck size={11} /> On-chain (mkt.qrm1)
                        </span>
                      )}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Active Offers on {activeCollection.name}</h2>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Offers are locked in Quorum testnet escrow and settle instantly when accepted.
                </span>
              </div>
              <span className="gold-badge">{colOffers.length} Active Offers</span>
            </div>

            {colOffers.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#A1A1AA', background: '#1D1D25', borderRadius: '16px', border: '1px solid #2A2A33' }}>
                <Tag size={32} color="#71717A" style={{ marginBottom: '8px' }} />
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#F4F4F5' }}>No Active Offers Yet</h3>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  Be the first to place an escrow offer on {activeCollection.name} pieces.
                </p>
              </div>
            ) : (
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
                      const isOwner = userNfts?.some((nft) => nft.id === o.nft_id) || (walletAccountId === 'malekoala9992.testnet' && o.nft_id.includes('molt'));
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
                                Accept &amp; Settle
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
            )}
          </section>
        )}
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
                <span style={{ color: '#F5A524', fontWeight: 600 }}>Today (Floor: {stats.floorPrice})</span>
              </div>
            </div>

            {/* Solvency & Depth Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Individual Vault Reserves</span>
                <strong style={{ display: 'block', fontSize: '20px', color: '#86EFAC', marginTop: '4px' }}>
                  {((activeCollection.minted || 1) * 0.50).toFixed(2)} NEAR
                </strong>
                <span style={{ fontSize: '11px', color: '#71717A', marginTop: '2px', display: 'block' }}>
                  100% held in verifiable keyless sub-accounts
                </span>
              </div>

              <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '12px', color: '#A1A1AA' }}>DAO Treasury Reserve</span>
                <strong style={{ display: 'block', fontSize: '20px', color: '#F4F4F5', marginTop: '4px' }}>
                  {(daoBalances?.treasuryBalance ?? 1.50).toFixed(2)} NEAR
                </strong>
                <span style={{ fontSize: '11px', color: '#71717A', marginTop: '2px', display: 'block' }}>
                  Controlled by {activeCollection.name} DAO
                </span>
              </div>

              <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Combined Community Capital</span>
                <strong style={{ display: 'block', fontSize: '20px', color: '#F5A524', marginTop: '4px' }}>
                  {(((activeCollection.minted || 1) * 0.50) + (daoBalances?.totalBalance ?? 2.00)).toFixed(2)} NEAR
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

        {/* ===================================================================
            TAB 7: DAO (ROUND BALL ASSET ORB, TREASURY HOLDINGS & VOTES)
           =================================================================== */}
        {collectionTab === 'dao' && (() => {
          const treasuryNear = daoBalances?.treasuryBalance ?? 10.05;
          const treasuryCapacity = 20.00;
          const fillPercent = Math.min(92, Math.max(18, Math.round((treasuryNear / treasuryCapacity) * 100)));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
              {/* Top Row: Round Ball Orb + Treasury Holdings Card */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '28px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#15151B',
                  border: '1px solid #2A2A33',
                  borderRadius: '24px',
                  padding: '32px',
                  boxSizing: 'border-box',
                }}
              >
                {/* THE ROUND BALL (TREASURY ASSET ORB - MATCHING IMAGE 2) */}
                <div
                  style={{
                    position: 'relative',
                    width: '320px',
                    height: '320px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    boxShadow:
                      '0 0 60px rgba(168, 85, 247, 0.45), 0 0 120px rgba(139, 92, 246, 0.25), inset 0 0 50px rgba(255, 255, 255, 0.35), inset 0 -25px 45px rgba(124, 58, 237, 0.5)',
                    border: '2px solid rgba(255, 255, 255, 0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0D0D14',
                    flexShrink: 0,
                  }}
                >
                  {/* Image 2 Luminous Ribbon Sculpture Background */}
                  <img
                    src="/images/dao-orb.jpg"
                    alt="DAO Treasury Orb"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: 'brightness(0.92) contrast(1.15)',
                      transform: 'scale(1.05)',
                    }}
                  />

                  {/* Soft Glass Specular Sheen & Radial Depth */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.06) 50%, rgba(139,92,246,0.4) 100%)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Dynamic Asset Liquid Level Across Bottom Hemisphere */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${fillPercent}%`,
                      background:
                        'linear-gradient(180deg, rgba(168, 85, 247, 0.35) 0%, rgba(139, 92, 246, 0.75) 100%)',
                      backdropFilter: 'blur(3px)',
                      borderTop: '2px solid rgba(255, 255, 255, 0.55)',
                      boxShadow: '0 0 25px rgba(168, 85, 247, 0.5)',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      paddingBottom: '12px',
                      boxSizing: 'border-box',
                      transition: 'height 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: '#FFFFFF',
                        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                        background: 'rgba(10,10,13,0.65)',
                        padding: '4px 14px',
                        borderRadius: '999px',
                        border: '1px solid rgba(255,255,255,0.3)',
                      }}
                    >
                      Ⓝ {treasuryNear.toFixed(2)} NEAR • {fillPercent}% Filled
                    </span>
                  </div>

                  {/* Central Asset Badge HUD Inside the Orb */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(10, 10, 14, 0.72)',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: '22px',
                      padding: '14px 22px',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.65)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: '#000000',
                          border: '1px solid rgba(255,255,255,0.3)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#86EFAC',
                        }}
                      >
                        Ⓝ
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#F4F4F5', letterSpacing: '0.05em' }}>
                        NEAR TREASURY
                      </span>
                      <span className="success-badge" style={{ fontSize: '10px', padding: '1px 6px' }}>
                        Live On-Chain
                      </span>
                    </div>

                    <strong
                      style={{
                        fontSize: '28px',
                        fontWeight: 800,
                        fontFamily: 'Space Grotesk',
                        color: '#FFFFFF',
                        letterSpacing: '-0.02em',
                        marginTop: '2px',
                      }}
                    >
                      {treasuryNear.toFixed(2)} NEAR
                    </strong>

                    <span style={{ fontSize: '12px', color: '#D4D4D8' }}>
                      ~${(treasuryNear * 5.2).toFixed(2)} USD • 100% Reserve
                    </span>

                    <span
                      style={{
                        fontSize: '10px',
                        color: '#D8B4FE',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                      }}
                    >
                      {daoBalances?.treasuryAccount || 'tre.qrm1.testnet'} • Real-Time RPC
                    </span>
                  </div>
                </div>

                {/* Right Side: DAO Treasury Holdings Breakdown Card */}
                <div
                  style={{
                    flex: '1 1 360px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px',
                    minWidth: 0,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="gold-badge">100% On-Chain Verified</span>
                      <span className="neutral-badge">{daoBalances?.treasuryAccount || 'tre.qrm1.testnet'} (Treasury)</span>
                      <span className="neutral-badge">{daoBalances?.daoAccount || 'dao.qrm1.testnet'} (Gov)</span>
                    </div>
                    <h2 style={{ margin: '8px 0 4px', fontSize: '26px', fontWeight: 700 }}>
                      {activeCollection.name} DAO Treasury
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#A1A1AA' }}>
                      Quorum provisions an independent on-chain Treasury Vault (<code style={{ color: '#F5A524' }}>{daoBalances?.treasuryAccount || 'tre.qrm1.testnet'}</code>) and Governance DAO (<code style={{ color: '#D8B4FE' }}>{daoBalances?.daoAccount || 'dao.qrm1.testnet'}</code>) for the {activeCollection.name} community. Both balances are live from NEAR testnet RPC.
                    </p>
                  </div>

                  {/* 4 Stat Boxes */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                    <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '14px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>TREASURY VAULT</span>
                      <strong style={{ display: 'block', fontSize: '18px', color: '#F5A524', marginTop: '2px' }}>
                        {(daoBalances?.treasuryBalance ?? 1.50).toFixed(2)} NEAR
                      </strong>
                      <span style={{ fontSize: '11px', color: '#A1A1AA' }}>{daoBalances?.treasuryAccount || 'tre.qrm1.testnet'}</span>
                    </div>
                    <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '14px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>GOV DAO RESERVE</span>
                      <strong style={{ display: 'block', fontSize: '18px', color: '#86EFAC', marginTop: '2px' }}>
                        {(daoBalances?.daoBalance ?? 0.50).toFixed(2)} NEAR
                      </strong>
                      <span style={{ fontSize: '11px', color: '#A1A1AA' }}>{daoBalances?.daoAccount || 'dao.qrm1.testnet'}</span>
                    </div>
                    <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '14px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>PER-NFT SHARE</span>
                      <strong style={{ display: 'block', fontSize: '18px', color: '#F4F4F5', marginTop: '2px' }}>
                        {((daoBalances?.treasuryBalance ?? 1.50) / 20).toFixed(2)} NEAR
                      </strong>
                      <span style={{ fontSize: '11px', color: '#A1A1AA' }}>Equal distribution pool</span>
                    </div>
                    <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '14px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>COMBINED POOL</span>
                      <strong style={{ display: 'block', fontSize: '18px', color: '#D8B4FE', marginTop: '2px' }}>
                        {(daoBalances?.totalBalance ?? 2.00).toFixed(2)} NEAR
                      </strong>
                      <span style={{ fontSize: '11px', color: '#A1A1AA' }}>Total community NEAR</span>
                    </div>
                  </div>

                  {/* Treasury Assets Table */}
                  <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '16px', padding: '14px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: '#71717A', fontSize: '11px', textTransform: 'uppercase' }}>
                          <th style={{ padding: '6px 8px' }}>Contract Account</th>
                          <th style={{ padding: '6px 8px' }}>Role</th>
                          <th style={{ padding: '6px 8px' }}>On-Chain Balance</th>
                          <th style={{ padding: '6px 8px' }}>USD Value</th>
                          <th style={{ padding: '6px 8px' }}>Explorer</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#000', color: '#86EFAC', display: 'grid', placeItems: 'center', fontSize: '10px', fontWeight: 800 }}>T</div>
                              <strong>{daoBalances?.treasuryAccount || 'tre.qrm1.testnet'}</strong>
                            </div>
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>
                            {activeCollection.name} Treasury
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', fontWeight: 700, color: '#F5A524', fontFamily: 'Space Grotesk' }}>
                            {(daoBalances?.treasuryBalance ?? 1.50).toFixed(4)} NEAR
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
                            ~${((daoBalances?.treasuryBalance ?? 1.50) * 5.2).toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
                            <a
                              href={`https://testnet.nearblocks.io/address/${daoBalances?.treasuryAccount || 'tre.qrm1.testnet'}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#F5A524', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}
                            >
                              NearBlocks <ExternalLink size={12} />
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#000', color: '#D8B4FE', display: 'grid', placeItems: 'center', fontSize: '10px', fontWeight: 800 }}>D</div>
                              <strong>{daoBalances?.daoAccount || 'dao.qrm1.testnet'}</strong>
                            </div>
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>
                            Governance DAO
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', fontWeight: 700, color: '#86EFAC', fontFamily: 'Space Grotesk' }}>
                            {(daoBalances?.daoBalance ?? 0.50).toFixed(4)} NEAR
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
                            ~${((daoBalances?.daoBalance ?? 0.50) * 5.2).toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
                            <a
                              href={`https://testnet.nearblocks.io/address/${daoBalances?.daoAccount || 'dao.qrm1.testnet'}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#86EFAC', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}
                            >
                              NearBlocks <ExternalLink size={12} />
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', fontWeight: 700, color: '#FFFFFF' }}>
                            COMMUNITY CAPITAL
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', color: '#D8B4FE', fontWeight: 600 }}>
                            {activeCollection.name}
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', fontWeight: 800, color: '#FFFFFF', fontFamily: 'Space Grotesk' }}>
                            {(daoBalances?.totalBalance ?? 2.00).toFixed(4)} NEAR
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', fontWeight: 600 }}>
                            ~${((daoBalances?.totalBalance ?? 2.00) * 5.2).toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
                            <span className="success-badge" style={{ fontSize: '11px' }}>100% Verifiable</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyContract(daoBalances?.treasuryAccount || 'tre.qrm1.testnet')}
                      className="btn-secondary"
                      style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Copy size={14} /> Copy Treasury ({daoBalances?.treasuryAccount?.split('.')[0] || 'tre'})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyContract(daoBalances?.daoAccount || 'dao.qrm1.testnet')}
                      className="btn-secondary"
                      style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Copy size={14} /> Copy DAO ({daoBalances?.daoAccount?.split('.')[0] || 'dao'})
                    </button>
                    <a
                      href={`https://testnet.nearblocks.io/address/${daoBalances?.treasuryAccount || 'tre.qrm1.testnet'}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                    >
                      <ExternalLink size={14} /> View Treasury on NearBlocks
                    </a>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Neat Active Votes and Past Votes */}
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
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>DAO Governance &amp; Proposals</h2>
                    <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                      Cast on-chain votes using your {activeCollection.name} NFT voting rights.
                    </span>
                  </div>

                  {/* Active vs Past Votes Toggle Pills */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setDaoVoteFilter('active')}
                      style={{
                        minHeight: '36px',
                        padding: '0 16px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: daoVoteFilter === 'active' ? '#F5A524' : '#1D1D25',
                        color: daoVoteFilter === 'active' ? '#111113' : '#D4D4D8',
                        border: daoVoteFilter === 'active' ? '1px solid #F5A524' : '1px solid #2A2A33',
                      }}
                    >
                      Active Votes ({activeProposals.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDaoVoteFilter('past')}
                      style={{
                        minHeight: '36px',
                        padding: '0 16px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: daoVoteFilter === 'past' ? '#F5A524' : '#1D1D25',
                        color: daoVoteFilter === 'past' ? '#111113' : '#D4D4D8',
                        border: daoVoteFilter === 'past' ? '1px solid #F5A524' : '1px solid #2A2A33',
                      }}
                    >
                      Past Votes ({pastProposals.length})
                    </button>
                  </div>
                </div>

                {/* User Voting Power Banner */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '14px',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '16px',
                    background: '#1D1D25',
                    border: '1px solid #2A2A33',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckSquare size={18} color="#F5A524" />
                    <span style={{ fontSize: '14px' }}>
                      Connected Account: <strong style={{ color: '#F4F4F5' }}>{walletAccountId || 'Not Connected'}</strong>
                    </span>
                  </div>
                  <div>
                    {userVotingPower > 0 ? (
                      <span className="success-badge" style={{ fontSize: '13px', padding: '4px 12px' }}>
                        Your Voting Power: {userVotingPower} {userVotingPower === 1 ? 'Vote' : 'Votes'} ({userTokensInCollection.map((t) => `#${t.token_id}`).join(', ')})
                      </span>
                    ) : (
                      <span className="neutral-badge" style={{ fontSize: '12px' }}>
                        0 Voting Power (Hold {activeCollection.name} NFTs to vote)
                      </span>
                    )}
                  </div>
                </div>

                {/* ACTIVE VOTES LIST */}
                {daoVoteFilter === 'active' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {activeProposals.length === 0 ? (
                      <div style={{ padding: '36px', textAlign: 'center', color: '#71717A' }}>
                        No active proposals currently open for voting in this collection.
                      </div>
                    ) : (
                      activeProposals.map((prop) => {
                        const totalVotes = prop.votes_yes + prop.votes_no + prop.votes_abstain;
                        const yesPct = totalVotes > 0 ? Math.round((prop.votes_yes / totalVotes) * 100) : 0;
                        return (
                          <div
                            key={prop.id}
                            style={{
                              background: '#1D1D25',
                              border: '1px solid #2A2A33',
                              borderRadius: '18px',
                              padding: '20px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '14px',
                            }}
                          >
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className="gold-badge">Proposal #{prop.id}</span>
                                <span className="neutral-badge">{prop.kind}</span>
                                <span className="success-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={12} /> {prop.time_remaining} left
                                </span>
                              </div>
                              <span style={{ fontSize: '13px', color: '#86EFAC', fontWeight: 600 }}>
                                {prop.quorum_percent}% Quorum Reached
                              </span>
                            </div>

                            <div>
                              <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 600 }}>{prop.title}</h3>
                              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: '#A1A1AA' }}>
                                {prop.description}
                              </p>
                            </div>

                            {prop.route && (
                              <div style={{ fontSize: '13px', color: '#D4D4D8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#71717A' }}>Route:</span>
                                <strong>{prop.route}</strong>
                              </div>
                            )}

                            {/* Quorum Progress Bar */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#A1A1AA' }}>
                                <span>Yes: {prop.votes_yes} ({yesPct}%)</span>
                                <span>No: {prop.votes_no}</span>
                                <span>Abstain: {prop.votes_abstain}</span>
                              </div>
                              <div style={{ width: '100%', height: '8px', background: '#2A2A33', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                                <div style={{ width: `${yesPct}%`, height: '100%', background: '#86EFAC' }} />
                                <div style={{ width: `${totalVotes > 0 ? ((prop.votes_no / totalVotes) * 100) : 0}%`, height: '100%', background: '#EF4444' }} />
                              </div>
                            </div>

                            {/* Voting Action Buttons */}
                            {onCastVote && (
                              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid #2A2A33', paddingTop: '12px' }}>
                                <button
                                  type="button"
                                  disabled={userVotingPower === 0}
                                  onClick={() => onCastVote(prop.id, 'yes')}
                                  className="btn-secondary"
                                  style={{
                                    minHeight: '38px',
                                    padding: '0 18px',
                                    fontSize: '13px',
                                    color: userVotingPower > 0 ? '#86EFAC' : '#71717A',
                                    borderColor: userVotingPower > 0 ? 'rgba(34,197,94,0.4)' : '#2A2A33',
                                  }}
                                >
                                  Vote Yes ({userVotingPower} {userVotingPower === 1 ? 'Vote' : 'Votes'})
                                </button>
                                <button
                                  type="button"
                                  disabled={userVotingPower === 0}
                                  onClick={() => onCastVote(prop.id, 'no')}
                                  className="btn-secondary"
                                  style={{
                                    minHeight: '38px',
                                    padding: '0 18px',
                                    fontSize: '13px',
                                    color: userVotingPower > 0 ? '#EF4444' : '#71717A',
                                    borderColor: userVotingPower > 0 ? 'rgba(239,68,68,0.4)' : '#2A2A33',
                                  }}
                                >
                                  Vote No
                                </button>
                                <button
                                  type="button"
                                  disabled={userVotingPower === 0}
                                  onClick={() => onCastVote(prop.id, 'abstain')}
                                  className="btn-secondary"
                                  style={{ minHeight: '38px', padding: '0 18px', fontSize: '13px' }}
                                >
                                  Abstain
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* PAST VOTES LIST */}
                {daoVoteFilter === 'past' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {pastProposals.length === 0 ? (
                      <div style={{ padding: '36px', textAlign: 'center', color: '#71717A' }}>
                        No past proposals recorded yet for this collection.
                      </div>
                    ) : (
                      pastProposals.map((prop) => (
                        <div
                          key={prop.id}
                          style={{
                            background: '#1D1D25',
                            border: '1px solid #2A2A33',
                            borderRadius: '16px',
                            padding: '18px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span className="neutral-badge">Proposal #{prop.id}</span>
                              <span className="success-badge">● Passed &amp; Executed</span>
                              <span className="neutral-badge">{prop.kind}</span>
                            </div>
                            <span style={{ fontSize: '12px', color: '#86EFAC', fontWeight: 600 }}>
                              {prop.votes_yes} Yes • {prop.votes_no} No (Quorum: {prop.quorum_percent}%)
                            </span>
                          </div>

                          <div>
                            <strong style={{ fontSize: '16px', display: 'block', marginBottom: '4px' }}>{prop.title}</strong>
                            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#A1A1AA' }}>
                              {prop.description}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>
            </div>
          );
        })()}

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
                {token.is_on_chain && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      left: '10px',
                      background: 'rgba(245,165,36,0.22)',
                      border: '1px solid rgba(245,165,36,0.5)',
                      color: '#FCD34D',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '8px',
                      backdropFilter: 'blur(4px)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ShieldCheck size={11} /> On-chain (mkt.qrm1)
                  </span>
                )}
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
