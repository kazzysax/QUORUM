import React, { useState } from 'react';
import type { CollectionItem, TokenItem, Page } from '../types';
import { ArrowRight, Flame } from 'lucide-react';

interface MarketplacePageProps {
  collections: CollectionItem[];
  listings: TokenItem[];
  onNavigate: (page: Page) => void;
  onSelectCollection: (collectionId: string) => void;
  onBuyListing: (token: TokenItem) => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  collections,
  listings,
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

  const filteredListings = listings.filter((l) => {
    if (collectionFilter === 'all') return true;
    return l.collection === collectionFilter;
  });

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
                onClick={() => onSelectCollection(currentHero.id)}
                className="btn-primary"
                style={{ textDecoration: 'none' }}
              >
                View {currentHero.title}
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
                  onClick={() => onSelectCollection(col.id)}
                  title={`Open ${col.name}`}
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
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Collections</h2>
            <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Click to view details and mint</span>
          </div>
          <button
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
          {collections.slice(0, 2).map((col) => (
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
                  <span className="success-badge">20 Pieces</span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#C4C4CC' }}>
                  {col.description}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid #2A2A33', paddingTop: '12px' }}>
                  <span>Backing: <strong style={{ color: '#F4F4F5' }}>1.00 NEAR</strong></span>
                  <span style={{ color: '#F5A524', fontWeight: 600 }}>Open Collection →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live Secondary Market Listings Grid */}
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
            Each piece holds 1.00 NEAR in its keyless sub-account vault
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
          {filteredListings.map((token) => (
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
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: '15px', fontWeight: 600 }}>{token.title}</strong>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#F5A524', fontFamily: 'Space Grotesk' }}>
                    {token.price} NEAR
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#A1A1AA' }}>
                  <span>Backing: 1.00 NEAR</span>
                  <a
                    href={`https://testnet.nearblocks.io/address/${token.vault_account}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#F5A524', textDecoration: 'none' }}
                  >
                    {token.vault_account}
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
