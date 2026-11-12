import React, { useState, useEffect } from 'react';
import type { LiveCollection } from '../chain';
import { fmtNear } from '../chain';
import { MintsPanel } from '../components/MintsPanel';
import type { TokenItem, Page, ProposalItem, CollectionHolder, SaleRecord, CollectionActivity, OfferItem } from '../types';
import { fetchLiveDaoBalances, getCollectionDaoAccounts, type DaoBalances } from '../near';
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
  Users,
  Activity,
  Sparkles,
  Landmark,
  Tag,
  CheckSquare,
  Clock,
  Star,
  Globe,
} from 'lucide-react';

interface MarketplacePageProps {
  collections: LiveCollection[];
  listings: TokenItem[];
  selectedCollectionId?: string | null;
  walletAccountId?: string;
  proposals?: ProposalItem[];
  userNfts?: TokenItem[];
  onNavigate: (page: Page) => void;
  onSelectCollection: (collectionId: string | null) => void;
  onBuyListing: (token: TokenItem) => void;
  holders?: Record<string, CollectionHolder[]>;
  pieces?: TokenItem[];
  onPlaceOffer?: (targetNft: TokenItem, amountNear: string) => void;
  onAcceptOffer?: (offer: OfferItem) => void;
  onCancelOffer?: (offer: OfferItem) => void;
  onMint?: (collectionId: string) => void;
  onDonate?: (collectionId: string, amountNear: string) => void;
  onCredit?: (collectionId: string, group: number) => void;
  onEnableFallback?: (collectionId: string, group: number) => void;
  onSettleWnear?: (collectionId: string, group: number) => void;
  onAbortSwap?: (collectionId: string, group: number) => void;
  sales?: SaleRecord[];
  onCastVote?: (proposalId: number, choice: 'yes' | 'no' | 'abstain') => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  collections,
  listings,
  selectedCollectionId,
  walletAccountId,
  proposals,
  userNfts,
  onSelectCollection,
  onBuyListing,
  onCastVote,
  holders: holdersByCollection,
  sales,
  pieces,
  onPlaceOffer,
  onAcceptOffer,
  onCancelOffer,
  onMint,
  onDonate,
  onCredit,
  onEnableFallback,
  onSettleWnear,
  onAbortSwap,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [collectionFilter, setCollectionFilter] = useState<string>('all');

  // Dedicated Collection View State (Items, Offers, Holders, Traits, Activity, Analytics, DAO)
  const [collectionTab, setCollectionTab] = useState<'items' | 'offers' | 'holders' | 'activity' | 'dao'>('items');
  const [copiedContract, setCopiedContract] = useState(false);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  // Cheapest first by default, so the lowest price is always at the top.
  const [itemSort, setItemSort] = useState<'id-asc' | 'id-desc' | 'price-asc' | 'price-desc'>('price-asc');
  const [activityFilter, setActivityFilter] = useState<'all' | 'Sale' | 'Mint' | 'Burn & Redeem' | 'List'>('all');
  const [daoVoteFilter, setDaoVoteFilter] = useState<'active' | 'past'>('active');
  const [daoBalances, setDaoBalances] = useState<DaoBalances | null>(null);

  // Quick Offer Modal State
  const [offerModalToken, setOfferModalToken] = useState<TokenItem | null>(null);
  const [offerInputAmount, setOfferInputAmount] = useState('1.00');
  const [donateAmount, setDonateAmount] = useState('1');


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
    supply: col.supply,
  }));

  const currentHero = featured[activeSlide] || featured[0];

  useEffect(() => {
    let mounted = true;
    const id = activeCollection?.id;
    if (!id) { setDaoBalances(null); return; }   // no collection selected: nothing to read
    const load = () => fetchLiveDaoBalances(id).then((res) => { if (mounted) setDaoBalances(res); }).catch(() => { if (mounted) setDaoBalances(null); });
    load();
    const interval = setInterval(load, 15000);
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

  // What a listed NFT is worth: the listing price covers the art AND the assets in its vault (the vault travels with the NFT).
  const nearIn = (s: string) => [...s.matchAll(/([\d.]+)\s*NEAR/gi)].reduce((a, x) => a + parseFloat(x[1]), 0);
  const worth = (t: TokenItem) => {
    const price = parseFloat(t.price || '0');
    const vault = Math.min(price, nearIn(t.backing));
    return { price, vault, art: Math.max(0, price - vault) };
  };
  const floorPiece = (pieces ?? []).filter((t) => t.price).sort((a, b) => parseFloat(a.price!) - parseFloat(b.price!))[0];
  const floorWorth = floorPiece ? worth(floorPiece) : null;

  // Every NFT of the selected collection (listed or not), filtered and sorted for the Items tab
  // The marketplace shows only what is for sale. A piece that is not listed is not on the market (its owner is
  // still visible under Holders, and it still counts in the collection's totals).
  // Taken from the market's own listings (already loaded, verified on chain), not from the slower full piece list.
  const listedPieces = rawCollectionListings.filter((t) => !!t.price);
  const itemCards = listedPieces
    .filter((token) => {
      if (!itemSearch.trim()) return true;
      const q = itemSearch.toLowerCase();
      return token.title.toLowerCase().includes(q) || token.token_id.includes(q) || token.owner_id.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const idA = parseInt(a.token_id || '0', 10), idB = parseInt(b.token_id || '0', 10);
      if (itemSort === 'id-asc') return idA - idB;
      if (itemSort === 'id-desc') return idB - idA;
      // Pieces that are not for sale always go last, whichever way the prices are sorted. Equal prices keep piece order.
      const forSale = (t: TokenItem) => (t.price ? parseFloat(t.price) : null);
      const pa = forSale(a), pb = forSale(b);
      if (pa === null && pb === null) return idA - idB;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return (itemSort === 'price-asc' ? pa - pb : pb - pa) || idA - idB;
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
      if (itemSort === 'price-asc') return (priceA - priceB) || (idA - idB);
      if (itemSort === 'price-desc') return (priceB - priceA) || (idA - idB);
      return 0;
    });

  // Submit Offer
  const handleQuickOfferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerModalToken || !onPlaceOffer) return;
    const amountNum = parseFloat(offerInputAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    onPlaceOffer(offerModalToken, amountNum.toFixed(2));
    setOfferModalToken(null);
  };

  const offerModal = (
    <>
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
                  <span style={{ fontSize: '12px', color: '#A1A1AA', display: 'block' }}>{offerModalToken.price ? `Listed at ${offerModalToken.price} NEAR` : 'Not listed: your offer is held until the owner accepts'}</span>
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
    </>
  );

  // Copy Contract Address
  const handleCopyContract = (contractId: string) => {
    navigator.clipboard.writeText(contractId);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  // =========================================================================
  // 1. DEDICATED OPENSEA-STYLE COLLECTION VIEW (Molten Hours or Tidewater)
  // =========================================================================
  if (activeCollection) {
    // Every figure comes from the chain (see chain.ts): contract state, the market's sale counters
    // and its recorded sales. Nothing is estimated or defaulted.
    const stats = activeCollection.stats!;
    const holders = holdersByCollection?.[activeCollection.id] ?? [];
    const activities: CollectionActivity[] = (sales || [])
      .filter((x) => x.collection === activeCollection.name)
      .map((x, i) => ({
        id: `sale-${i}`,
        event: 'Sale' as const,
        tokenId: x.nft_id.split('#')[1] || '',
        title: x.nft_id,
        priceNear: `${x.price_near} NEAR`,
        from: x.seller || '',
        to: x.buyer,
        date: x.date,
        txHash: '',
      }))
      .filter((act) => activityFilter === 'all' || act.event === activityFilter);

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
          <div className="hscroll" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
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
              {activeCollection.status === 'live' && onMint && (
                <button
                  type="button"
                  onClick={() => onMint(activeCollection.id)}
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
                  <Sparkles size={15} /> Mint · {activeCollection.mintCostYocto ? fmtNear(activeCollection.mintCostYocto) : activeCollection.price_near} NEAR
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
            <span className="success-badge">{activeCollection.backing_summary.toUpperCase()}</span>
            <span className="gold-badge">{activeCollection.treasuryNear} NEAR DAO TREASURY</span>
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
            {floorWorth && (
              <span style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginTop: '2px' }}>
                {floorWorth.art.toFixed(2)} art + {floorWorth.vault.toFixed(2)} {floorPiece?.backing_status === 'escrow' ? 'in escrow' : 'in vault'}
              </span>
            )}
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>TOP OFFER</span>
            <strong style={{ display: 'block', fontSize: '18px', color: '#F5A524', fontFamily: 'Space Grotesk', marginTop: '2px' }}>
              {stats.topOffer}
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
          className="hscroll"
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
            { id: 'items', label: `For sale (${listedPieces.length})`, icon: Layers },
            { id: 'offers', label: `Offers (${activeCollection.offerItems.length})`, icon: Tag },
            { id: 'holders', label: `Holders (${holders.length})`, icon: Users },
            { id: 'activity', label: 'Activity', icon: Activity },
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
            {itemCards.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#A1A1AA', background: '#1D1D25', borderRadius: '18px', border: '1px solid #2A2A33' }}>
                {listedPieces.length === 0 ? `Nothing in ${activeCollection.name} is for sale right now.` : 'No pieces match your search.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {itemCards.map((token) => (
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
                        {token.backing}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <strong style={{ fontSize: '16px', fontWeight: 600 }}>{token.title}</strong>
                        <span style={{ fontSize: token.price ? '18px' : '13px', fontWeight: 700, color: token.price ? '#F5A524' : '#71717A', fontFamily: 'Space Grotesk' }}>
                          {token.price ? `${token.price} NEAR` : 'Not for sale'}
                        </span>
                      </div>
                      {token.price && (
                        <div style={{ fontSize: '11px', color: '#71717A' }}>
                          {worth(token).art.toFixed(2)} art + {worth(token).vault.toFixed(2)} {token.backing_status === 'escrow' ? 'in escrow' : 'in vault'}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#A1A1AA' }}>
                        {token.owner_id === walletAccountId ? 'Owned by you' : `Owner: ${token.owner_id}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      {token.owner_id !== walletAccountId && token.price && (
                        <button
                          type="button"
                          onClick={() => onBuyListing(token)}
                          className="btn-primary"
                          style={{ flex: 1, minHeight: '40px', fontSize: '13px' }}
                        >
                          Buy for {token.price} NEAR
                        </button>
                      )}
                      {token.owner_id !== walletAccountId && onPlaceOffer && (
                        <button
                          type="button"
                          onClick={() => { setOfferInputAmount(token.price || '1.00'); setOfferModalToken(token); }}
                          className="btn-secondary"
                          style={{ flex: token.price ? '0 0 auto' : 1, minHeight: '40px', padding: '0 16px', fontSize: '13px' }}
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
          <section style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '24px', padding: '24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Offers on {activeCollection.name}</h2>
              <span style={{ fontSize: '13px', color: '#A1A1AA' }}>The offered NEAR is locked until the owner accepts or the buyer takes it back.</span>
            </div>
            {activeCollection.offerItems.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: '#A1A1AA', background: '#1D1D25', borderRadius: '16px', border: '1px solid #2A2A33' }}>
                <Tag size={30} color="#71717A" style={{ marginBottom: '8px' }} />
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#F4F4F5' }}>No offers yet</h3>
                <p style={{ margin: 0, fontSize: '13px' }}>Open an item and press Make offer to place the first one.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '520px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#A1A1AA', fontSize: '12px' }}>
                      <th style={{ padding: '10px 12px' }}>Item</th>
                      <th style={{ padding: '10px 12px' }}>Offer</th>
                      <th style={{ padding: '10px 12px' }}>From</th>
                      <th style={{ padding: '10px 12px' }}>Expires in</th>
                      <th style={{ padding: '10px 12px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCollection.offerItems.map((o) => {
                      const mine = (userNfts ?? []).some((n) => n.nft_contract === o.nft_contract && n.token_id === o.token_id);
                      const mineOffer = o.from === walletAccountId;
                      return (
                        <tr key={o.id}>
                          <td style={{ padding: '12px', borderTop: '1px solid #2A2A33' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <img src={o.image} alt={o.nft_title} style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }} />
                              <strong>{o.nft_title}</strong>
                            </div>
                          </td>
                          <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', fontWeight: 700, color: '#F5A524', fontFamily: 'Space Grotesk' }}>{o.amount_near} NEAR</td>
                          <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>{o.from}</td>
                          <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>{o.expires_in}</td>
                          <td style={{ padding: '12px', borderTop: '1px solid #2A2A33', textAlign: 'right' }}>
                            {mine && onAcceptOffer ? (
                              <button type="button" onClick={() => onAcceptOffer(o)} className="btn-primary" style={{ minHeight: '34px', padding: '0 14px', fontSize: '12px' }}>Accept</button>
                            ) : mineOffer && onCancelOffer ? (
                              <button type="button" onClick={() => onCancelOffer(o)} className="btn-secondary" style={{ minHeight: '34px', padding: '0 14px', fontSize: '12px' }}>Withdraw</button>
                            ) : null}
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
              <div className="hscroll" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
        {collectionTab === 'dao' && (() => {
          const colDaoAccounts = getCollectionDaoAccounts(activeCollection.id);
          const activeTreasuryAccount = daoBalances?.treasuryAccount || colDaoAccounts.treasuryAccount;
          const activeDaoAccount = daoBalances?.daoAccount || colDaoAccounts.daoAccount;
          const treasuryNear = Number(activeCollection.treasuryNear);

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
                    boxShadow: '0 0 70px rgba(245, 165, 36, 0.45), 0 0 140px rgba(245, 165, 36, 0.22)',
                    border: '2px solid rgba(255, 214, 120, 0.55)',
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
                    }}
                  />

                  {/* The NEAR the treasury actually holds, written across the orb */}
                  <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', color: '#3A2606', padding: '0 20px' }}>
                    <div style={{ fontSize: '50px', fontWeight: 800, fontFamily: 'Space Grotesk', lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 2px 16px rgba(255, 240, 190, 0.85)' }}>
                      {treasuryNear.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.2em', marginTop: '6px' }}>NEAR</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '8px', opacity: 0.8 }}>
                      in the {activeCollection.name} treasury
                    </div>
                    {activeCollection.treasuryWrapped > 0n && (
                      <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>+ {fmtNear(activeCollection.treasuryWrapped, 2)} wNEAR</div>
                    )}
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
                      <span className="success-badge">50/50 Protocol Split Enforced</span>
                      <span className="neutral-badge">{activeTreasuryAccount} (Treasury)</span>
                      <span className="neutral-badge">{activeDaoAccount} (Gov)</span>
                    </div>
                    <h2 style={{ margin: '8px 0 4px', fontSize: '26px', fontWeight: 700 }}>
                      {activeCollection.name} DAO Treasury
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#A1A1AA' }}>
                      Quorum enforces an exact <strong>50/50 capital split</strong> at mint: <strong>50% of each mint price</strong> funds this collection's dedicated on-chain Treasury (<code style={{ color: '#F5A524' }}>{activeTreasuryAccount}</code>), and <strong>50% of each mint price</strong> locks into the holder's keyless vault. Both balances are live from NEAR testnet RPC.
                    </p>
                  </div>

                  {/* 4 Stat Boxes */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                    <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '14px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>50% DAO TREASURY</span>
                      <strong style={{ display: 'block', fontSize: '18px', color: '#F5A524', marginTop: '2px' }}>
                        {activeCollection.treasuryNear} NEAR
                      </strong>
                      <span style={{ fontSize: '11px', color: '#A1A1AA' }}>Spendable by holder vote</span>
                    </div>
                    <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '14px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>50% VAULT ESCROW</span>
                      <strong style={{ display: 'block', fontSize: '18px', color: '#86EFAC', marginTop: '2px' }}>
                        {fmtNear(activeCollection.escrowYocto)} NEAR
                      </strong>
                      <span style={{ fontSize: '11px', color: '#A1A1AA' }}>half of each mint price</span>
                    </div>
                    <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '14px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>SPLIT RATIO</span>
                      <strong style={{ display: 'block', fontSize: '18px', color: '#F4F4F5', marginTop: '2px' }}>
                        50% / 50%
                      </strong>
                      <span style={{ fontSize: '11px', color: '#86EFAC' }}>Immutable on-chain</span>
                    </div>
                    <div style={{ background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: '14px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>GOV DAO RESERVE</span>
                      <strong style={{ display: 'block', fontSize: '18px', color: '#D8B4FE', marginTop: '2px' }}>
                        {daoBalances ? daoBalances.daoBalance.toFixed(2) : '…'} NEAR
                      </strong>
                      <span style={{ fontSize: '11px', color: '#A1A1AA' }}>{activeDaoAccount}</span>
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
                              <strong>{activeTreasuryAccount}</strong>
                            </div>
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>
                            {activeCollection.name} Treasury
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', fontWeight: 700, color: '#F5A524', fontFamily: 'Space Grotesk' }}>
                            {activeCollection.treasuryNear} NEAR
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
 testnet NEAR
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
                            <a
                              href={`https://testnet.nearblocks.io/address/${activeTreasuryAccount}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#F5A524', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}
                            >
                              NearBlocks <ExternalLink size={12} />
                            </a>
                          </td>
                        </tr>
                        {activeCollection.treasuryWrapped > 0n && (
                          <tr>
                            <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}><strong>{activeTreasuryAccount}</strong></td>
                            <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>Also holds wrapped NEAR</td>
                            <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', fontWeight: 700, color: '#F5A524', fontFamily: 'Space Grotesk' }}>{fmtNear(activeCollection.treasuryWrapped, 4)} wNEAR</td>
                            <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>1 wNEAR = 1 NEAR</td>
                            <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}></td>
                          </tr>
                        )}
                        <tr>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#000', color: '#D8B4FE', display: 'grid', placeItems: 'center', fontSize: '10px', fontWeight: 800 }}>D</div>
                              <strong>{activeDaoAccount}</strong>
                            </div>
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>
                            Governance DAO
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', fontWeight: 700, color: '#86EFAC', fontFamily: 'Space Grotesk' }}>
                            {daoBalances ? daoBalances.daoBalance.toFixed(4) : '…'} NEAR
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
 testnet NEAR
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33' }}>
                            <a
                              href={`https://testnet.nearblocks.io/address/${activeDaoAccount}`}
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
                            {activeCollection.treasuryNear} NEAR
                          </td>
                          <td style={{ padding: '10px 8px', borderTop: '1px solid #2A2A33', fontWeight: 600 }}>
 testnet NEAR
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
                      onClick={() => handleCopyContract(activeTreasuryAccount)}
                      className="btn-secondary"
                      style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Copy size={14} /> Copy Treasury ({activeTreasuryAccount.split('.')[0]})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyContract(activeDaoAccount)}
                      className="btn-secondary"
                      style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Copy size={14} /> Copy DAO ({activeDaoAccount.split('.')[0]})
                    </button>
                    <a
                      href={`https://testnet.nearblocks.io/address/${activeTreasuryAccount}`}
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

              {onDonate && (
                <section style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '24px', padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ maxWidth: '560px' }}>
                    <strong style={{ fontSize: '16px' }}>Support this DAO</strong>
                    <p style={{ margin: '6px 0 0', fontSize: '13px', lineHeight: 1.6, color: '#A1A1AA' }}>Anyone can add NEAR to the treasury. It shows up in the balance above straight away, and only holder votes can spend it.</p>
                  </div>
                  <form style={{ display: 'flex', gap: '8px' }} onSubmit={(e) => { e.preventDefault(); const n = parseFloat(donateAmount); if (n > 0) onDonate(activeCollection.id, donateAmount); }}>
                    <input type="number" min="0" step="0.1" value={donateAmount} onChange={(e) => setDonateAmount(e.target.value)} style={{ width: 110, background: '#1D1D25', border: '1px solid #2A2A33', borderRadius: 12, padding: '0 12px', color: '#F4F4F5', fontSize: 14, minHeight: 40 }} aria-label="Amount in NEAR" />
                    <button type="submit" className="btn-primary" style={{ minHeight: 40, padding: '0 18px', fontSize: 13 }}>Donate NEAR</button>
                  </form>
                </section>
              )}

              {activeCollection.closed && activeCollection.groups.map((g) => (
                <section key={g.index} style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '24px', padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ maxWidth: '640px' }}>
                    <strong style={{ fontSize: '16px' }}>Settlement</strong>
                    <p style={{ margin: '6px 0 0', fontSize: '13px', lineHeight: 1.6, color: '#A1A1AA' }}>
                      {g.phase === 'Pending' && g.asset === activeCollection.config.wrap_account && 'The mint is over. The escrow converts 1:1 into wNEAR, the asset this collection launched with, so no vote is needed: anyone can convert it, then fill the vaults.'}
                      {g.phase === 'Pending' && g.asset !== activeCollection.config.wrap_account && 'The mint is over and the money raised is waiting in escrow. Holders vote to swap it into the planned asset at a safe minimum price, or once the waiting period ends anyone can switch the payout to plain NEAR.'}
                      {g.phase === 'Swapping' && 'A conversion is running. If it never finishes, anyone can cancel it after an hour.'}
                      {(g.phase === 'Swapped' || g.phase === 'Fallback') && 'The escrow has been settled. Press the button to move each piece\'s share into its own vault (anyone can do this).'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {g.phase === 'Pending' && g.asset === activeCollection.config.wrap_account && onSettleWnear && <button type="button" className="btn-primary" style={{ minHeight: 40, padding: '0 16px', fontSize: 13 }} onClick={() => onSettleWnear(activeCollection.id, g.index)}>Convert to wNEAR</button>}
                    {g.phase === 'Pending' && g.asset !== activeCollection.config.wrap_account && onEnableFallback && <button type="button" className="btn-secondary" style={{ minHeight: 40, padding: '0 16px', fontSize: 13 }} onClick={() => onEnableFallback(activeCollection.id, g.index)}>Switch to NEAR payout</button>}
                    {g.phase === 'Swapping' && onAbortSwap && <button type="button" className="btn-secondary" style={{ minHeight: 40, padding: '0 16px', fontSize: 13 }} onClick={() => onAbortSwap(activeCollection.id, g.index)}>Cancel conversion</button>}
                    {(g.phase === 'Swapped' || g.phase === 'Fallback') && onCredit && <button type="button" className="btn-primary" style={{ minHeight: 40, padding: '0 16px', fontSize: 13 }} onClick={() => onCredit(activeCollection.id, g.index)}>Fill vaults</button>}
                  </div>
                </section>
              ))}
            </div>
          );
        })()}

        {offerModal}
      </div>
    );
  }

  // =========================================================================
  // 2. MAIN MARKETPLACE OVERVIEW (When no specific collection is selected)
  // =========================================================================
  // Nothing is shown until the contracts have answered: no collections means the chain read is
  // still running (or failed, in which case the banner above the page says why).
  if (!currentHero) {
    return (
      <div style={{ padding: '64px 24px', textAlign: 'center', color: '#A1A1AA', border: '1px dashed #2A2A33', borderRadius: '24px' }}>
        <strong style={{ display: 'block', color: '#F4F4F5', fontSize: '18px', marginBottom: '8px' }}>Reading collections from NEAR testnet…</strong>
        If this stays here, the banner above shows what the RPC returned.
      </div>
    );
  }

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
              <span className="neutral-badge">{currentHero.supply} Total Pieces</span>
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
              <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Floor · volume</span>
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
                    <strong style={{ display: 'block', fontSize: '13px', color: '#86EFAC' }}>{col.stats?.totalVolume ?? '—'}</strong>
                    <span style={{ fontSize: '11px', color: '#71717A' }}>{col.supply} pieces</span>
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
            Every piece holds half its mint price in its own keyless vault.
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

        <div className="hscroll-cards">
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
                    <span className="gold-badge">
                      {countForSale > 0
                        ? `${countForSale} for sale`
                        : (col.minted < col.supply)
                          ? `${col.supply - col.minted} to mint`
                          : 'Minted out'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#C4C4CC' }}>
                    {col.description}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderTop: '1px solid #2A2A33', paddingTop: '12px' }}>
                    <span>Backing: <strong style={{ color: '#86EFAC' }}>{col.backing_summary.replace(' in vault', '')}</strong></span>
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

      {/* Live and upcoming mints */}
      <section
        aria-label="Mints"
        style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '24px', padding: '24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Mints</h2>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Open now and opening soon</span>
        </div>
        <MintsPanel compact collections={collections} onMint={onMint} onOpenCollection={(id) => onSelectCollection(id)} />
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
            Each piece holds half its mint price in its keyless sub-account vault
          </span>
        </div>

        {/* Collection Filter Buttons */}
        <div className="hscroll" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
          {/* One button per live collection, so a new collection gets its filter automatically */}
          {collections.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCollectionFilter(c.name)}
              style={{
                minHeight: '34px',
                padding: '0 14px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: collectionFilter === c.name ? '#F5A524' : '#1D1D25',
                color: collectionFilter === c.name ? '#111113' : '#D4D4D8',
                border: collectionFilter === c.name ? '1px solid #F5A524' : '1px solid #2A2A33',
              }}
            >
              {c.name} ({listings.filter((l) => l.collection === c.name).length})
            </button>
          ))}
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
                  {token.backing}
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
                    <ShieldCheck size={11} /> On-chain (market)
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
                  <span>Backing: {token.backing}</span>
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

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                type="button"
                onClick={() => onBuyListing(token)}
                className="btn-primary"
                style={{ width: '100%', minHeight: '40px', fontSize: '13px', marginTop: '4px' }}
              >
                Buy for {token.price} NEAR
              </button>
                {onPlaceOffer && token.owner_id !== walletAccountId && (
                  <button type="button" onClick={() => { setOfferInputAmount(token.price || '1.00'); setOfferModalToken(token); }} className="btn-secondary" style={{ minHeight: '40px', padding: '0 16px', fontSize: '13px' }}>Offer</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      {offerModal}
    </div>
  );
};
