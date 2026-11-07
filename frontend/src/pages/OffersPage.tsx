import React, { useState } from 'react';
import type { OfferItem, Page } from '../types';
import { Info, Tag } from 'lucide-react';

interface OffersPageProps {
  offers: OfferItem[];
  onNavigate: (page: Page) => void;
}

export const OffersPage: React.FC<OffersPageProps> = ({ offers, onNavigate }) => {
  const [tab, setTab] = useState<'rec' | 'made'>('rec');

  const filteredOffers = offers.filter((o) => (tab === 'rec' ? o.type === 'received' : o.type === 'made'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Page Title & Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>Offers</h1>
        <div role="group" aria-label="Offer list" style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setTab('rec')}
            style={{
              minHeight: '36px',
              padding: '0 16px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: tab === 'rec' ? '#F5A524' : '#1D1D25',
              color: tab === 'rec' ? '#111113' : '#D4D4D8',
              border: tab === 'rec' ? '1px solid #F5A524' : '1px solid #2A2A33',
            }}
          >
            Received
          </button>
          <button
            type="button"
            onClick={() => setTab('made')}
            style={{
              minHeight: '36px',
              padding: '0 16px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: tab === 'made' ? '#F5A524' : '#1D1D25',
              color: tab === 'made' ? '#111113' : '#D4D4D8',
              border: tab === 'made' ? '1px solid #F5A524' : '1px solid #2A2A33',
            }}
          >
            Made
          </button>
        </div>
      </div>

      {/* Release Notice Banner */}
      <div
        role="status"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          padding: '20px 24px',
          borderRadius: '20px',
          border: '1px solid rgba(96,165,250,0.4)',
          background: 'rgba(96,165,250,0.08)',
        }}
      >
        <span style={{ color: '#93C5FD' }}>
          <Info size={24} />
        </span>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <strong style={{ fontSize: '15px' }}>Offers arrive in an upcoming release</strong>
          <span style={{ fontSize: '14px', lineHeight: 1.55, color: '#C4C4CC' }}>
            This preview illustrates upcoming bilateral offers with NEAR escrow. Until then, buy directly at listed prices on the Marketplace or list your own NFT from Sells.
          </span>
        </div>
        <button
          onClick={() => onNavigate('marketplace')}
          className="btn-secondary"
          style={{ background: '#1D1D25' }}
        >
          Go to Marketplace
        </button>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left: Offers List */}
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
            flex: '999 1 520px',
            minWidth: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>
            {tab === 'rec' ? 'Offers on your NFTs' : 'Offers you made'}
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredOffers.map((o) => (
              <li
                key={o.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px',
                  borderRadius: '16px',
                  background: '#1D1D25',
                  border: '1px solid #2A2A33',
                }}
              >
                <img
                  src={o.image}
                  alt={o.nft_title}
                  style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '12px' }}
                />
                <span style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <strong style={{ fontSize: '15px' }}>{o.nft_title}</strong>
                  <span style={{ fontSize: '12px', color: '#A1A1AA' }}>
                    {tab === 'rec' ? `From ${o.from}` : `To ${o.from}`}
                  </span>
                </span>
                <span style={{ flex: '0 1 120px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Offer</span>
                  <strong style={{ fontSize: '15px', color: '#F5A524' }}>{o.amount_near} NEAR</strong>
                </span>
                <span style={{ flex: '0 1 120px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Expires</span>
                  <span style={{ fontSize: '14px' }}>in {o.expires_in}</span>
                </span>
                <button
                  type="button"
                  disabled
                  className="btn-secondary"
                  style={{ minHeight: '38px', opacity: 0.55, cursor: 'not-allowed' }}
                >
                  {tab === 'rec' ? 'Accept' : 'Cancel'}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Right: Make an Offer Form */}
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
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Make an offer</h2>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
            Offer on
            <select
              disabled
              style={{
                minHeight: '46px',
                borderRadius: '12px',
                border: '1px solid #2A2A33',
                background: '#1D1D25',
                color: '#F4F4F5',
                padding: '0 12px',
              }}
            >
              <option>A specific NFT</option>
              <option>Any NFT in the collection</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
            Amount (NEAR)
            <input
              disabled
              type="text"
              placeholder="0.00"
              style={{
                minHeight: '46px',
                borderRadius: '12px',
                border: '1px solid #2A2A33',
                background: '#1D1D25',
                color: '#F4F4F5',
                padding: '0 12px',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
            Expires after
            <select
              disabled
              style={{
                minHeight: '46px',
                borderRadius: '12px',
                border: '1px solid #2A2A33',
                background: '#1D1D25',
                color: '#F4F4F5',
                padding: '0 12px',
              }}
            >
              <option>7 days</option>
              <option>14 days</option>
              <option>30 days</option>
            </select>
          </label>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#A1A1AA' }}>
            Your NEAR is held by the contract until the offer is accepted, cancelled or expires. Cancelling or expiry returns it in full.
          </p>
          <button
            type="button"
            disabled
            className="btn-primary"
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            <Tag size={16} /> Place offer
          </button>
        </section>
      </div>
    </div>
  );
};
