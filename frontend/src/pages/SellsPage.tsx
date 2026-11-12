import React, { useState } from 'react';
import type { TokenItem, SaleRecord } from '../types';
import { Tag } from 'lucide-react';

interface SellsPageProps {
  nfts: TokenItem[];
  salesHistory: SaleRecord[];
  walletConnected?: boolean;
  walletAccountId?: string;
  onOpenConnect?: () => void;
  onListNft: (token: TokenItem, priceNear: string) => void;
  onCancelListing: (token: TokenItem) => void;
}

export const SellsPage: React.FC<SellsPageProps> = ({
  nfts,
  salesHistory,
  walletConnected = true,
  walletAccountId,
  onOpenConnect,
  onListNft,
  onCancelListing,
}) => {
  const [selectedNftId, setSelectedNftId] = useState<string>(nfts[0]?.id || '');
  const [priceInput, setPriceInput] = useState('2.40');

  const selectedNft = nfts.find((t) => t.id === selectedNftId) || nfts[0];

  const priceNum = parseFloat(priceInput);
  const isValidPrice = isFinite(priceNum) && priceNum > 0;

  const toDao = isValidPrice ? (priceNum * 0.05).toFixed(3) : '0.000';
  const royalty = isValidPrice ? (priceNum * 0.05).toFixed(3) : '0.000';
  const netSeller = isValidPrice ? (priceNum * 0.90).toFixed(3) : '0.000';

  const activeListedTokens = nfts.filter((t) => !!t.price);

  // Personalized sales history strictly for the connected wallet
  const personalSales = walletAccountId
    ? salesHistory.filter((s) => s.seller === walletAccountId || s.buyer === walletAccountId)
    : [];

  const handleListSubmit = () => {
    if (!selectedNft || !isValidPrice) return;
    onListNft(selectedNft, priceNum.toFixed(2));
  };

  if (!walletConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>Your Sales</h1>
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
            Connect your NEAR testnet wallet to view your personalized listings, list your held NFTs, and track your completed sales.
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
      {/* Page Title */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>Your Sales & Listings</h1>
          {walletAccountId && <span className="neutral-badge">{walletAccountId}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left: List an NFT */}
        <section
          style={{
            flex: '1 1 380px',
            minWidth: 0,
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
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>List an NFT</h2>

          {nfts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#A1A1AA', background: '#1D1D25', borderRadius: '16px', border: '1px solid #2A2A33' }}>
              You do not hold any unlisted NFTs in your connected wallet. Acquire pieces from the Marketplace or view your Portfolio.
            </div>
          ) : (
            <>
              {/* NFT Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: '#D4D4D8' }}>Select NFT to list</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                  {nfts.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedNftId(t.id)}
                      style={{
                        padding: '6px',
                        borderRadius: '12px',
                        background: selectedNftId === t.id ? 'rgba(245, 165, 36, 0.15)' : '#1D1D25',
                        border: selectedNftId === t.id ? '2px solid #F5A524' : '1px solid #2A2A33',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <img src={t.image} alt={t.title} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }} />
                      <span style={{ fontSize: '11px', color: '#F4F4F5', fontWeight: 600 }}>#{t.token_id}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedNft && (
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '12px', borderRadius: '14px', background: '#1D1D25', border: '1px solid #2A2A33' }}>
                  <img src={selectedNft.image} alt={selectedNft.title} style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover' }} />
                  <div>
                    <strong style={{ fontSize: '15px' }}>{selectedNft.title}</strong>
                    <span style={{ fontSize: '12px', color: '#A1A1AA', display: 'block' }}>Keyless Vault: {selectedNft.backing}</span>
                  </div>
                </div>
              )}

              {/* Price Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: '#D4D4D8' }}>Listing Price (NEAR)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: '#1D1D25',
                    border: '1px solid #2A2A33',
                    color: '#F4F4F5',
                    fontSize: '16px',
                    fontFamily: 'Space Grotesk',
                  }}
                />
              </div>

              {/* Fee Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', borderRadius: '14px', background: '#1D1D25', border: '1px solid #2A2A33', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#A1A1AA' }}>
                  <span>To {selectedNft?.collection || 'Collection'} DAO Treasury (5%)</span>
                  <span>{toDao} NEAR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#A1A1AA' }}>
                  <span>Creator Royalty (5%)</span>
                  <span>{royalty} NEAR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #2A2A33', paddingTop: '8px', fontWeight: 600 }}>
                  <span>You receive (90%)</span>
                  <span style={{ color: '#86EFAC' }}>{netSeller} NEAR</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleListSubmit}
                disabled={!isValidPrice || !selectedNft}
                className="btn-primary"
                style={{ minHeight: '48px', fontSize: '15px' }}
              >
                <Tag size={16} /> List #{selectedNft?.token_id} for {isValidPrice ? priceNum.toFixed(2) : '0.00'} NEAR
              </button>
              <span style={{ fontSize: '12px', color: '#A1A1AA' }}>
                Non-custodial NEP-178 listing. You retain asset custody until an exact price match executes.
              </span>
            </>
          )}
        </section>

        {/* Right: Active Listings + Personalized Sales History */}
        <div style={{ flex: '999 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Listings */}
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
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Your active listings</h2>
              <span className="gold-badge">{activeListedTokens.length} Listed</span>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '14px',
                background: 'rgba(245,165,36,0.08)',
                border: '1px solid rgba(245,165,36,0.25)',
                fontSize: '13px',
                lineHeight: 1.55,
                color: '#FFD572',
              }}
            >
              💡 <strong>Offers routed to your Offers tab:</strong> In accordance with Quorum protocol rules, offers are accepted only for NFTs actively listed for sale. Once listed here, collector offers on your pieces will automatically route to your <strong>Offers</strong> tab for acceptance.
            </div>

            {activeListedTokens.length === 0 ? (
              <span style={{ fontSize: '14px', color: '#71717A' }}>
                You have no active listings. Select an NFT on the left to list it.
              </span>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeListedTokens.map((item) => (
                  <li
                    key={item.id}
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
                      src={item.image}
                      alt={item.title}
                      style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '12px' }}
                    />
                    <span style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '15px' }}>{item.title}</strong>
                      <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Vault: {item.backing}</span>
                    </span>
                    <strong style={{ fontSize: '16px', color: '#F5A524' }}>{item.price} NEAR</strong>
                    <button
                      type="button"
                      onClick={() => onCancelListing(item)}
                      className="btn-secondary"
                      style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px' }}
                    >
                      Cancel Listing
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Personalized Sales History */}
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
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Your sales history</h2>
              <span className="neutral-badge">{personalSales.length} Completed</span>
            </div>

            {personalSales.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#71717A', fontSize: '14px' }}>
                No completed sales yet for {walletAccountId || 'your wallet'}. When a buyer purchases one of your listings, your settlement and net earnings (90% seller payout) will appear here.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '500px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#A1A1AA', fontSize: '12px' }}>
                      <th style={{ padding: '8px' }}>NFT</th>
                      <th style={{ padding: '8px' }}>Role</th>
                      <th style={{ padding: '8px' }}>Counterparty</th>
                      <th style={{ padding: '8px' }}>Price (NEAR)</th>
                      <th style={{ padding: '8px' }}>To DAO</th>
                      <th style={{ padding: '8px' }}>Royalty</th>
                      <th style={{ padding: '8px' }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personalSales.map((s, idx) => {
                      const isSeller = s.seller === walletAccountId;
                      return (
                        <tr key={idx}>
                          <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>
                            <strong>{s.nft_id}</strong>
                          </td>
                          <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>
                            <span className={isSeller ? 'success-badge' : 'neutral-badge'} style={{ fontSize: '11px' }}>
                              {isSeller ? 'Sold' : 'Bought'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>
                            {isSeller ? s.buyer : s.seller || 'Marketplace'}
                          </td>
                          <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', fontWeight: 600 }}>
                            {s.price_near} NEAR
                          </td>
                          <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>
                            {s.to_dao}
                          </td>
                          <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>
                            {s.royalty}
                          </td>
                          <td
                            style={{
                              padding: '12px 8px',
                              borderTop: '1px solid #2A2A33',
                              fontWeight: 600,
                              color: isSeller ? '#86EFAC' : '#F4F4F5',
                            }}
                          >
                            {isSeller ? `+${s.net_seller} NEAR` : `-${s.price_near} NEAR`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
