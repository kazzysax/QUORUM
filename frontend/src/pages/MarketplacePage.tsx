import React, { useState } from 'react';
import type { CollectionItem, TokenItem, Page } from '../types';
import { ArrowRight, Flame } from 'lucide-react';

interface MarketplacePageProps {
  collections: CollectionItem[];
  listings: TokenItem[];
  onNavigate: (page: Page) => void;
  onBuyListing: (token: TokenItem) => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  collections,
  listings,
  onNavigate,
  onBuyListing,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);

  const featured = collections.slice(0, 2).map((col) => ({
    title: col.name,
    badge: col.status === 'live' ? 'Live mint' : `Mint opens in ${col.opens_in || '2 days'}`,
    creator: col.creator,
    description: col.description,
    image: col.cover_image,
    mintTarget: 'mint',
  }));

  const currentHero = featured[activeSlide] || featured[0];

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
              Welcome to Quorum · Featured
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
            </div>
            <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.6, color: '#E4E4E7' }}>
              {currentHero.description}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
              <button
                onClick={() => onNavigate('mint')}
                className="btn-primary"
                style={{ textDecoration: 'none' }}
              >
                View the drop
              </button>
              <a
                href="#live-listings"
                className="btn-secondary"
                style={{ background: 'rgba(29,29,37,0.85)' }}
              >
                Explore Listings
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
              gap: '6px',
              zIndex: 2,
            }}
          >
            {featured.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlide(idx)}
                aria-label={`Show ${featured[idx].title}`}
                style={{
                  width: idx === activeSlide ? '28px' : '10px',
                  height: '6px',
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
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Top collections</h2>
            <button
              onClick={() => onNavigate('marketplace')}
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
              View all <ArrowRight size={14} />
            </button>
          </div>

          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {collections.slice(0, 4).map((col, index) => (
              <li key={col.id}>
                <button
                  onClick={() => onNavigate('mint')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#F4F4F5',
                    padding: '8px',
                    borderRadius: '14px',
                    background: 'transparent',
                    border: '1px solid transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1D1D25')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ width: '18px', fontSize: '13px', color: '#A1A1AA', fontWeight: 600 }}>
                    {index + 1}
                  </span>
                  <img
                    src={col.avatar_image}
                    alt={col.name}
                    style={{ width: '44px', height: '44px', borderRadius: '12px', objectFit: 'cover' }}
                  />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ fontSize: '14px', fontWeight: 600 }}>{col.name}</strong>
                    <span style={{ fontSize: '12px', color: '#A1A1AA' }}>{col.backing_summary}</span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <strong style={{ fontSize: '14px' }}>{col.floor_price_near} NEAR</strong>
                    <span style={{ fontSize: '12px', color: col.change_positive ? '#86EFAC' : '#FCA5A5' }}>
                      {col.change_24h}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Upcoming & Live Drops Cards */}
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
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Upcoming &amp; live drops</h2>
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
            Launch your own <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {collections.slice(0, 3).map((col) => {
            const isLive = col.status === 'live';
            return (
              <div
                key={col.id}
                onClick={() => onNavigate('mint')}
                style={{
                  flex: '1 1 260px',
                  minWidth: 0,
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
                  style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <strong style={{ fontSize: '18px', fontWeight: 700 }}>{col.name}</strong>
                    <span className={isLive ? 'success-badge' : 'info-badge'}>
                      {isLive ? 'Live now' : `Opens in ${col.opens_in || 'soon'}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#A1A1AA' }}>
                    <span>{col.price_near} NEAR · {col.supply} pieces</span>
                    <span style={{ color: '#F5A524', fontWeight: 600 }}>View drop →</span>
                  </div>
                </div>
              </div>
            );
          })}
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
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Active Listings</h2>
            <span className="gold-badge">
              <Flame size={12} style={{ marginRight: '4px' }} />
              {listings.length} Available
            </span>
          </div>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
            5% DAO Treasury Pool · Keyless Vault Included Automatically
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {listings.map((token) => (
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
                    background: 'rgba(10,10,13,0.75)',
                    backdropFilter: 'blur(4px)',
                    color: '#F4F4F5',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '8px',
                    border: '1px solid #2A2A33',
                  }}
                >
                  {token.asset} Backed
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: '16px', fontWeight: 600 }}>{token.title}</strong>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#F5A524', fontFamily: 'Space Grotesk' }}>
                    {token.price} NEAR
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#A1A1AA' }}>
                  <span>Backing: {token.backing}</span>
                  <span>Vault: {token.vault_account || `v${token.token_id}.molten.testnet`}</span>
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
