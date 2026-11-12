import React, { useState } from 'react';
import type { OfferItem, Page, TokenItem } from '../types';
import { Tag, Check, X, Shield, ArrowRight } from 'lucide-react';

interface OffersPageProps {
  offers: OfferItem[];
  userNfts?: TokenItem[];
  marketListings: TokenItem[];
  userBalance: number;
  walletConnected?: boolean;
  walletAccountId?: string;
  onOpenConnect?: () => void;
  onNavigate: (page: Page) => void;
  onAcceptOffer: (offer: OfferItem) => void;
  onCancelOffer: (offer: OfferItem) => void;
  onPlaceOffer: (targetNft: TokenItem, amountNear: string) => void;
}

export const OffersPage: React.FC<OffersPageProps> = ({
  offers,
  marketListings,
  userBalance,
  walletConnected = true,
  walletAccountId,
  onOpenConnect,
  onNavigate,
  onAcceptOffer,
  onCancelOffer,
  onPlaceOffer,
}) => {
  const [tab, setTab] = useState<'rec' | 'made'>('rec');

  // Place offer form state
  const [selectedListingId, setSelectedListingId] = useState<string>(marketListings[0]?.id || '');
  const [offerAmount, setOfferAmount] = useState('1.00');
  const [expiresInDays, setExpiresInDays] = useState('7');

  // Both lists come straight from the market contract: offers on NFTs you own, and offers you made.
  const receivedOffers = offers.filter((o) => o.type === 'received' && !o.expired);
  const madeOffers = offers.filter((o) => o.type === 'made');

  const filteredOffers = tab === 'rec' ? receivedOffers : madeOffers;
  const selectedListing = marketListings.find((l) => l.id === selectedListingId) || marketListings[0];

  const handlePlaceOfferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;
    const amountNum = parseFloat(offerAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    onPlaceOffer(selectedListing, amountNum.toFixed(2));
  };

  if (!walletConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>Your Offers</h1>
        </div>
        <div
          style={{
            background: '#15151B',
            border: '1px solid #2A2A33',
            borderRadius: '24px',
            padding: '56px 32px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '18px',
            maxWidth: '640px',
            margin: '30px auto',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'rgba(245, 165, 36, 0.1)',
              border: '1px solid rgba(245, 165, 36, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F5A524',
            }}
          >
            <Tag size={34} />
          </div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Wallet Disconnected</h2>
          <p style={{ margin: 0, color: '#A1A1AA', fontSize: '15px', lineHeight: 1.6, maxWidth: '500px' }}>
            Connect your NEAR testnet wallet to view incoming bids on your Keyless Vault NFTs and manage your active escrowed offers.
          </p>
          <button
            type="button"
            onClick={onOpenConnect}
            className="btn-primary"
            style={{ minHeight: '46px', padding: '0 30px', fontSize: '15px', fontWeight: 600, marginTop: '8px' }}
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Page Title & Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>Your Offers</h1>
          {walletAccountId && <span className="neutral-badge">{walletAccountId}</span>}
          <span className="gold-badge">On-chain Escrow</span>
        </div>
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
            Received ({receivedOffers.length})
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
            Made ({madeOffers.length})
          </button>
        </div>
      </div>

      {/* Escrow Status Banner */}
      <div
        role="status"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid #2A2A33',
          background: '#15151B',
        }}
      >
        <span style={{ color: '#F5A524' }}>
          <Shield size={20} />
        </span>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <strong style={{ fontSize: '14px', color: '#F4F4F5' }}>Live Testnet Escrow Settlement</strong>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
            Accepted offers disburse test NEAR directly to your connected wallet and transfer the keyless vault with backing intact.
          </span>
        </div>
        <button
          onClick={() => onNavigate('marketplace')}
          className="btn-secondary"
          style={{ background: '#1D1D25', fontSize: '12px', minHeight: '36px' }}
        >
          Marketplace <ArrowRight size={13} style={{ marginLeft: '4px' }} />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
              {tab === 'rec' ? 'Offers Received for Your Pieces' : 'Offers You Placed'}
            </h2>
            <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
              {filteredOffers.length} {filteredOffers.length === 1 ? 'offer' : 'offers'}
            </span>
          </div>

          {filteredOffers.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#A1A1AA', fontSize: '14px', background: '#1D1D25', borderRadius: '16px', border: '1px solid #2A2A33', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              {tab === 'rec' ? (
                <>
                  <Tag size={28} color="#F5A524" />
                  <strong style={{ fontSize: '16px', color: '#F4F4F5' }}>No Active Offers on Listed NFTs</strong>
                  <span style={{ maxWidth: '440px', lineHeight: 1.6 }}>
                    Offers are strictly received for pieces you have actively listed for sale. List one of your held NFTs on your Sales page to receive collector offers.
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('sells')}
                    className="btn-primary"
                    style={{ minHeight: '38px', padding: '0 20px', fontSize: '13px', marginTop: '4px' }}
                  >
                    Go to Your Sales <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                  </button>
                </>
              ) : (
                <>
                  <Tag size={28} color="#A1A1AA" />
                  <strong style={{ fontSize: '16px', color: '#F4F4F5' }}>No Offers Placed</strong>
                  <span style={{ maxWidth: '440px', lineHeight: 1.6 }}>
                    You have not placed any offers yet. Submit an offer using the form on the right.
                  </span>
                </>
              )}
            </div>
          ) : (
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
                      {tab === 'rec' ? `From ${o.from}` : `Placed by you`}
                    </span>
                  </span>
                  <span style={{ flex: '0 1 120px', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Offer Amount</span>
                    <strong style={{ fontSize: '16px', color: '#F5A524', fontFamily: 'Space Grotesk' }}>
                      {o.amount_near} NEAR
                    </strong>
                  </span>
                  <span style={{ flex: '0 1 100px', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Expires</span>
                    <span style={{ fontSize: '13px' }}>{o.expires_in}</span>
                  </span>

                  {/* Action Buttons: Accept / Cancel */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {tab === 'rec' ? (
                      <button
                        type="button"
                        onClick={() => onAcceptOffer(o)}
                        className="btn-primary"
                        style={{ minHeight: '38px', padding: '0 18px', fontSize: '13px' }}
                      >
                        <Check size={14} style={{ marginRight: '4px' }} /> Accept &amp; Claim
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onCancelOffer(o)}
                        className="btn-secondary"
                        style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px', color: '#FCA5A5' }}
                      >
                        <X size={14} style={{ marginRight: '4px' }} /> Cancel &amp; Refund
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Right: Place an Offer Form */}
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
            flex: '1 1 320px',
            minWidth: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Place an Offer</h2>

          <form onSubmit={handlePlaceOfferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
              Target NFT (from Marketplace)
              <select
                value={selectedListingId}
                onChange={(e) => setSelectedListingId(e.target.value)}
                style={{
                  minHeight: '44px',
                  borderRadius: '12px',
                  border: '1px solid #2A2A33',
                  background: '#1D1D25',
                  color: '#F4F4F5',
                  padding: '0 12px',
                  fontSize: '13px',
                }}
              >
                {marketListings.slice(0, 15).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} (Listed at {l.price} NEAR)
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
              Offer Amount (NEAR test tokens)
              <input
                type="number"
                step="0.05"
                min="0.1"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                style={{
                  minHeight: '44px',
                  borderRadius: '12px',
                  border: '1px solid #2A2A33',
                  background: '#1D1D25',
                  color: '#F4F4F5',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#A1A1AA' }}>
              <span>Available balance:</span>
              <strong style={{ color: '#F4F4F5' }}>{userBalance.toFixed(2)} NEAR</strong>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
              Duration
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                style={{
                  minHeight: '44px',
                  borderRadius: '12px',
                  border: '1px solid #2A2A33',
                  background: '#1D1D25',
                  color: '#F4F4F5',
                  padding: '0 12px',
                  fontSize: '13px',
                }}
              >
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
              </select>
            </label>

            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#71717A' }}>
              Your test NEAR is held by the Quorum escrow contract until the seller accepts or you cancel.
            </p>

            <button
              type="submit"
              className="btn-primary"
              style={{ minHeight: '44px', fontSize: '14px', width: '100%' }}
            >
              <Tag size={16} /> Submit Offer
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
