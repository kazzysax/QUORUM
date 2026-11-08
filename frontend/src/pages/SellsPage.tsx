import React, { useState } from 'react';
import type { TokenItem, SaleRecord } from '../types';
import { Tag, AlertCircle } from 'lucide-react';

interface SellsPageProps {
  nfts: TokenItem[];
  salesHistory: SaleRecord[];
  walletConnected?: boolean;
  onOpenConnect?: () => void;
  onListNft: (token: TokenItem, priceNear: string) => void;
  onCancelListing: (token: TokenItem) => void;
}

export const SellsPage: React.FC<SellsPageProps> = ({
  nfts,
  salesHistory,
  walletConnected = true,
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

  const handleListSubmit = () => {
    if (!selectedNft || !isValidPrice) return;
    onListNft(selectedNft, priceNum.toFixed(2));
  };

  if (!walletConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>Sells</h1>
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
            Please connect your testnet wallet (<strong style={{ color: '#F4F4F5' }}>malekoala9992.testnet</strong>) to list your Keyless Vault NFTs for sale on the Quorum marketplace.
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
        <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>Sells</h1>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left: List an NFT Form */}
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
            flex: '1 1 380px',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>List an NFT</h2>
          </div>

          {/* NFT Selection */}
          <div role="group" aria-label="Choose an NFT" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {nfts.map((item) => {
              const isSelected = item.id === selectedNftId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedNftId(item.id)}
                  style={{
                    flex: '1 1 140px',
                    minWidth: 0,
                    padding: '10px',
                    borderRadius: '16px',
                    background: '#1D1D25',
                    border: isSelected ? '1px solid #F5A524' : '1px solid #2A2A33',
                    color: '#F4F4F5',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{item.title}</span>
                  <span style={{ fontSize: '12px', color: '#A1A1AA' }}>{item.asset} · {item.backing}</span>
                </button>
              );
            })}
          </div>

          {/* Price input */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
            Price (NEAR)
            <input
              type="text"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="e.g. 2.40"
              style={{
                minHeight: '50px',
                borderRadius: '14px',
                border: '1px solid #2A2A33',
                background: '#1D1D25',
                color: '#F4F4F5',
                fontSize: '18px',
                fontWeight: 600,
                padding: '0 14px',
              }}
            />
          </label>

          {/* Fee Calculation Breakdown */}
          <div style={{ padding: '16px', borderRadius: '16px', background: '#1D1D25', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#C4C4CC' }}>Sale price</span>
              <span style={{ fontWeight: 500 }}>{isValidPrice ? priceNum.toFixed(2) : '0.00'} NEAR</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#C4C4CC' }}>DAO treasury (5%)</span>
              <span style={{ fontWeight: 500, color: '#A1A1AA' }}>− {toDao} NEAR</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#C4C4CC' }}>Creator royalty (5%)</span>
              <span style={{ fontWeight: 500, color: '#A1A1AA' }}>− {royalty} NEAR</span>
            </div>
            <div style={{ height: '1px', background: '#2A2A33' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: '#C4C4CC' }}>You receive</span>
              <span style={{ fontWeight: 700, fontSize: '16px', color: '#86EFAC' }}>{netSeller} NEAR</span>
            </div>
          </div>

          {/* Vault warning */}
          {selectedNft && (
            <p
              style={{
                margin: 0,
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(245,165,36,0.4)',
                background: 'rgba(245,165,36,0.06)',
                fontSize: '13px',
                lineHeight: 1.55,
                color: '#E4E4E7',
                display: 'flex',
                gap: '8px',
              }}
            >
              <AlertCircle size={18} color="#F5A524" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                Selling #{selectedNft.token_id} also transfers its vault ({selectedNft.backing}). A buyer can burn for 90% of it, so pricing below that gives value away.
              </span>
            </p>
          )}

          <button
            type="button"
            disabled={!isValidPrice || !selectedNft}
            onClick={handleListSubmit}
            className="btn-primary"
            style={{ minHeight: '50px', fontSize: '15px' }}
          >
            <Tag size={16} /> List #{selectedNft?.token_id} for {isValidPrice ? priceNum.toFixed(2) : '0.00'} NEAR
          </button>
          <span style={{ fontSize: '12px', color: '#A1A1AA' }}>
            Non-custodial NEP-178 listing. You retain asset custody until an exact price match executes.
          </span>
        </section>

        {/* Right: Active Listings + Sales History */}
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
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Your active listings</h2>
            {activeListedTokens.length === 0 ? (
              <span style={{ fontSize: '14px', color: '#71717A' }}>No active listings currently. Select an NFT on the left to list.</span>
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
                      <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Listed today</span>
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

          {/* Sales History */}
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
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Sales history</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '500px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#A1A1AA', fontSize: '12px' }}>
                    <th style={{ padding: '8px' }}>NFT</th>
                    <th style={{ padding: '8px' }}>Buyer</th>
                    <th style={{ padding: '8px' }}>Price (NEAR)</th>
                    <th style={{ padding: '8px' }}>To DAO</th>
                    <th style={{ padding: '8px' }}>Royalty</th>
                    <th style={{ padding: '8px' }}>You got</th>
                  </tr>
                </thead>
                <tbody>
                  {salesHistory.map((s, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>{s.nft_id}</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>{s.buyer}</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>{s.price_near}</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>{s.to_dao}</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', color: '#A1A1AA' }}>{s.royalty}</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', fontWeight: 600, color: '#86EFAC' }}>{s.net_seller}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
