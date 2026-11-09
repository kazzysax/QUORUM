import React, { useState } from 'react';
import type { CollectionItem, TokenItem, Page } from '../types';
import { ArrowRight, ArrowLeft, Flame, ExternalLink } from 'lucide-react';

interface MarketplacePageProps {
  collections: CollectionItem[];
  listings: TokenItem[];
  selectedCollectionId?: string | null;
  onNavigate: (page: Page) => void;
  onSelectCollection: (collectionId: string | null) => void;
  onBuyListing: (token: TokenItem) => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  collections,
  listings,
  selectedCollectionId,
  onNavigate,
  onSelectCollection,
  onBuyListing,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'Molten Hours' | 'Tidewater'>('all');

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

  // Filtered listings for the selected collection or overview filter
  const collectionListings = activeCollection
    ? listings.filter((l) => l.collection.toLowerCase() === activeCollection.name.toLowerCase() || l.collection === activeCollection.symbol)
    : listings.filter((l) => {
        if (collectionFilter === 'all') return true;
        return l.collection === collectionFilter;
      });

  // =========================================================================
  // 1. DEDICATED COLLECTION VIEW (Molten Hours or Tidewater)
  // =========================================================================
  if (activeCollection) {
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

        {/* Dedicated Collection Hero Banner */}
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '24px',
            border: '1px solid #2A2A33',
            minHeight: '320px',
            padding: '36px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: '20px',
          }}
        >
          <img
            src={activeCollection.cover_image}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(10,10,13,0.4) 0%, rgba(10,10,13,0.85) 60%, rgba(10,10,13,0.98) 100%)',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
            <img
              src={activeCollection.avatar_image}
              alt={activeCollection.name}
              style={{ width: '96px', height: '96px', borderRadius: '20px', objectFit: 'cover', border: '3px solid #0A0A0D' }}
            />
            <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="gold-badge">NEAR Testnet Verified</span>
                <span className="neutral-badge">by {activeCollection.creator}</span>
                <span className="neutral-badge">20 Total Pieces (100% Minted)</span>
                <span className="success-badge">Secondary Market Live</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {activeCollection.name} ({activeCollection.symbol})
              </h1>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#D4D4D8', maxWidth: '720px' }}>
                {activeCollection.description}
              </p>
            </div>
          </div>

          {/* Collection Key Metrics Bar */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ background: 'rgba(29,29,37,0.7)', backdropFilter: 'blur(6px)', padding: '12px 16px', borderRadius: '14px', border: '1px solid #2A2A33' }}>
              <span style={{ fontSize: '11px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Floor Price</span>
              <strong style={{ display: 'block', fontSize: '18px', color: '#F5A524', marginTop: '2px' }}>{activeCollection.floor_price_near} NEAR</strong>
            </div>
            <div style={{ background: 'rgba(29,29,37,0.7)', backdropFilter: 'blur(6px)', padding: '12px 16px', borderRadius: '14px', border: '1px solid #2A2A33' }}>
              <span style={{ fontSize: '11px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vault Backing</span>
              <strong style={{ display: 'block', fontSize: '18px', color: '#86EFAC', marginTop: '2px' }}>0.50 NEAR</strong>
            </div>
            <div style={{ background: 'rgba(29,29,37,0.7)', backdropFilter: 'blur(6px)', padding: '12px 16px', borderRadius: '14px', border: '1px solid #2A2A33' }}>
              <span style={{ fontSize: '11px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>For Sale</span>
              <strong style={{ display: 'block', fontSize: '18px', color: '#F4F4F5', marginTop: '2px' }}>{collectionListings.length} Pieces</strong>
            </div>
            <div style={{ background: 'rgba(29,29,37,0.7)', backdropFilter: 'blur(6px)', padding: '12px 16px', borderRadius: '14px', border: '1px solid #2A2A33' }}>
              <span style={{ fontSize: '11px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DAO Treasury</span>
              <strong style={{ display: 'block', fontSize: '18px', color: '#F4F4F5', marginTop: '2px' }}>10.00 NEAR</strong>
            </div>
          </div>
        </section>

        {/* Available Pieces Grid for this Collection */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Available for Sale in {activeCollection.name}</h2>
              <span className="gold-badge">
                <Flame size={12} style={{ marginRight: '4px' }} />
                {collectionListings.length} Listed
              </span>
            </div>
            <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
              Every piece carries its own independent keyless subaccount holding 0.50 NEAR
            </span>
          </div>

          {collectionListings.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#A1A1AA' }}>
              No pieces currently listed for sale in {activeCollection.name}.
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

                  <button
                    type="button"
                    onClick={() => onBuyListing(token)}
                    className="btn-primary"
                    style={{ width: '100%', minHeight: '42px', fontSize: '14px', marginTop: '4px' }}
                  >
                    Buy for {token.price} NEAR
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
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
          {/* Background image & gradient */}
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
                background: 'linear-gradient(90deg, rgba(10,10,13,0.92) 0%, rgba(10,10,13,0.7) 42%, rgba(10,10,13,0.15) 100%)',
              }}
            />
          </div>

          {/* Hero Content */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '520px' }}>
            <span style={{ fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#F5A524', fontWeight: 600 }}>
              NEAR Testnet Verified · Collection #{activeSlide + 1}
            </span>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(2.2rem, 3.8vw, 3.2rem)',
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
              }}
            >
              {currentHero.title}
            </h1>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="gold-badge">{currentHero.badge}</span>
              <span className="neutral-badge">by {currentHero.creator}</span>
              <span className="neutral-badge">20 pieces · 20 NEAR DAO</span>
            </div>
            <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.6, color: '#E4E4E7' }}>
              {currentHero.description}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => onSelectCollection(currentHero.id)}
                className="btn-primary"
                style={{ textDecoration: 'none' }}
              >
                View {currentHero.title} Collection
              </button>
              <a
                href="#live-listings"
                className="btn-secondary"
                style={{ background: 'rgba(29,29,37,0.85)' }}
              >
                Explore Active Listings ({listings.length})
              </a>
            </div>
          </div>

          {/* Carousel Slide Indicators */}
          <div
            style={{
              position: 'absolute',
              left: '32px',
              bottom: '16px',
              display: 'flex',
              gap: '8px',
              zIndex: 2,
            }}
          >
            {featured.map((col, idx) => (
              <button
                key={col.id}
                type="button"
                onClick={() => setActiveSlide(idx)}
                aria-label={`Show ${col.title}`}
                style={{
                  minWidth: idx === activeSlide ? '36px' : '14px',
                  height: '8px',
                  borderRadius: '999px',
                  border: 0,
                  cursor: 'pointer',
                  background: idx === activeSlide ? '#F5A524' : '#3F3F46',
                  transition: 'all 0.2s ease',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </section>

        {/* Top Collections Ranking Sidebar */}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Testnet Collections</h2>
            <span className="gold-badge">2 Verified</span>
          </div>

          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {collections.slice(0, 2).map((col, index) => (
              <li key={col.id}>
                <button
                  type="button"
                  onClick={() => onSelectCollection(col.id)}
                  title={`Open ${col.name} Collection`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#F4F4F5',
                    padding: '12px',
                    borderRadius: '16px',
                    background: '#1D1D25',
                    border: '1px solid #2A2A33',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#F5A524';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#2A2A33';
                  }}
                >
                  <span style={{ width: '18px', fontSize: '13px', color: '#A1A1AA', fontWeight: 600 }}>
                    #{index + 1}
                  </span>
                  <img
                    src={col.avatar_image}
                    alt={col.name}
                    style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }}
                  />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <strong style={{ fontSize: '15px', fontWeight: 600 }}>{col.name}</strong>
                    <span style={{ fontSize: '12px', color: '#A1A1AA' }}>{col.backing_summary}</span>
                    <span style={{ fontSize: '11px', color: '#71717A' }}>by {col.creator}</span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <strong style={{ fontSize: '14px', color: '#F5A524' }}>{col.floor_price_near} NEAR</strong>
                    <span style={{ fontSize: '11px', color: '#86EFAC' }}>{col.supply} pieces</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Two Distinct Collections Row Cards */}
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
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Browse by Collection</h2>
            <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Select a collection to see all pieces available for sale</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('launch')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '36px',
              padding: '0 14px',
              border: '1px solid #2A2A33',
              borderRadius: '999px',
              color: '#F4F4F5',
              background: 'transparent',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Launch Studio <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {collections.slice(0, 2).map((col) => {
            const countForSale = listings.filter((l) => l.collection.toLowerCase() === col.name.toLowerCase() || l.collection === col.symbol).length;
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
                      View {col.name} Pieces <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live Secondary Market Listings Grid Across All Collections */}
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
              color: collectionFilter === 'all' ? '#111113' : '#A1A1AA',
              border: collectionFilter === 'all' ? '1px solid #F5A524' : '1px solid #2A2A33',
            }}
          >
            All Pieces ({listings.length})
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
              color: collectionFilter === 'Molten Hours' ? '#111113' : '#A1A1AA',
              border: collectionFilter === 'Molten Hours' ? '1px solid #F5A524' : '1px solid #2A2A33',
            }}
          >
            Molten Hours ({listings.filter((l) => l.collection === 'Molten Hours').length})
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
              color: collectionFilter === 'Tidewater' ? '#111113' : '#A1A1AA',
              border: collectionFilter === 'Tidewater' ? '1px solid #F5A524' : '1px solid #2A2A33',
            }}
          >
            Tidewater ({listings.filter((l) => l.collection === 'Tidewater').length})
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
                padding: '12px',
                transition: 'border-color 0.15s ease',
              }}
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
                  <strong style={{ fontSize: '15px', fontWeight: 600 }}>{token.title}</strong>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#F5A524', fontFamily: 'Space Grotesk' }}>
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
                style={{ width: '100%', minHeight: '40px', fontSize: '13px' }}
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
