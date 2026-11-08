import React, { useState } from 'react';
import type { Page, TokenItem } from '../types';
import { Flame, ArrowUpRight, Plus, AlertTriangle, X } from 'lucide-react';

interface PortfolioPageProps {
  nfts: TokenItem[];
  onNavigate: (page: Page) => void;
  onClaimAll: () => void;
  onClaimSingle: (token: TokenItem) => void;
  onBurnToken: (token: TokenItem) => void;
  onAddToVault: (token: TokenItem, amount: string) => void;
}

export const PortfolioPage: React.FC<PortfolioPageProps> = ({
  nfts,
  onNavigate,
  onClaimAll,
  onClaimSingle,
  onBurnToken,
  onAddToVault,
}) => {
  const [selectedTokenId, setSelectedTokenId] = useState<string>(nfts[0]?.id || '');
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addAmount, setAddAmount] = useState('10.0');

  const selectedToken = nfts.find((t) => t.id === selectedTokenId) || nfts[0];

  // Calculate stats
  const totalVotes = nfts.length;
  const unclaimedTotal = nfts.reduce((acc, t) => {
    const val = parseFloat(t.unclaimed_distribution || '0');
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Calculate 90% burn value
  const parseBacking = (backingStr: string) => {
    const parts = backingStr.split(' ');
    const num = parseFloat(parts[0]) || 0;
    const unit = parts[1] || 'USDC';
    const youGet = (num * 0.9).toFixed(3);
    const daoGets = (num * 0.1).toFixed(3);
    return { num, unit, youGet, daoGets };
  };

  const burnStats = selectedToken ? parseBacking(selectedToken.backing) : { num: 0, unit: 'USDC', youGet: '0.000', daoGets: '0.000' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Page Title & Claim All Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>Portfolio</h1>
        <button
          onClick={onClaimAll}
          className="btn-primary"
          style={{ minHeight: '44px', padding: '0 24px' }}
        >
          Claim all ({unclaimedTotal.toFixed(2)} NEAR)
        </button>
      </div>

      {/* 4 Stat Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>NFTs held</span>
          <strong style={{ fontSize: '26px', fontWeight: 700 }}>{nfts.length}</strong>
          <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Each one is a vault and a vote</span>
        </div>
        <div style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Total backing</span>
          <strong style={{ fontSize: '24px', fontWeight: 700 }}>13.92 USDC + 1.00 NEAR</strong>
          <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Redeemable at 90% by burning</span>
        </div>
        <div style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Voting power</span>
          <strong style={{ fontSize: '26px', fontWeight: 700 }}>{totalVotes} votes</strong>
          <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Tokens held before a vote opened count</span>
        </div>
        <div style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Unclaimed distributions</span>
          <strong style={{ fontSize: '26px', fontWeight: 700, color: '#F5A524' }}>{unclaimedTotal.toFixed(2)} NEAR</strong>
          <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Travels with the NFT if you sell</span>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left Column: My NFTs List + Unclaimed Table */}
        <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* My NFTs List */}
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
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>My NFTs</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {nfts.map((nft) => {
                const isSelected = nft.id === selectedTokenId;
                return (
                  <li
                    key={nft.id}
                    onClick={() => setSelectedTokenId(nft.id)}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '14px',
                      borderRadius: '18px',
                      background: '#1D1D25',
                      border: isSelected ? '1px solid #F5A524' : '1px solid #2A2A33',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ width: '64px', flex: 'none' }}>
                      <img
                        src={nft.image}
                        alt={nft.title}
                        style={{ display: 'block', width: '64px', height: '64px', objectFit: 'cover', borderRadius: '14px' }}
                      />
                    </span>
                    <span style={{ flex: '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <strong style={{ fontSize: '15px' }}>{nft.title}</strong>
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <span className="neutral-badge">{nft.asset}</span>
                        <span className={nft.backing_status === 'credited' ? 'success-badge' : 'gold-badge'}>
                          {nft.backing_status === 'credited' ? 'Credited' : 'In escrow'}
                        </span>
                      </span>
                    </span>
                    <span style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Backing</span>
                      <strong style={{ fontSize: '15px' }}>{nft.backing}</strong>
                    </span>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        minHeight: '40px',
                        background: isSelected ? '#F5A524' : '#1D1D25',
                        color: isSelected ? '#111113' : '#F4F4F5',
                        borderColor: isSelected ? '#F5A524' : '#2A2A33',
                      }}
                    >
                      {isSelected ? 'Selected' : 'Details'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Unclaimed Distributions Table */}
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
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Unclaimed distributions</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '440px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#A1A1AA', fontSize: '12px' }}>
                    <th style={{ padding: '8px', fontWeight: 500 }}>NFT</th>
                    <th style={{ padding: '8px', fontWeight: 500 }}>Asset</th>
                    <th style={{ padding: '8px', fontWeight: 500 }}>Owed</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {nfts.map((nft) => (
                    <tr key={nft.id}>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>{nft.title}</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>NEAR</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', fontWeight: 600 }}>
                        {nft.unclaimed_distribution || '0.00'}
                      </td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => onClaimSingle(nft)}
                          className="btn-secondary"
                          style={{ minHeight: '36px', padding: '0 14px', fontSize: '13px' }}
                        >
                          Claim
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column: Selected NFT Inspector */}
        {selectedToken && (
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
              flex: '1 1 360px',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <img
                src={selectedToken.image}
                alt={selectedToken.title}
                style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '18px', border: '1px solid #2A2A33' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '22px' }}>{selectedToken.title}</h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className="neutral-badge">{selectedToken.asset}</span>
                  <span className={selectedToken.backing_status === 'credited' ? 'success-badge' : 'gold-badge'}>
                    {selectedToken.backing_status === 'credited' ? 'Credited' : 'In escrow'}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#A1A1AA' }}>
                  Vault: {selectedToken.vault_account || `v${selectedToken.token_id}.molten.testnet`}
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#C4C4CC' }}>
              Its vault holds {selectedToken.asset}. Only you can add to it; nothing leaves unless you burn.
            </p>

            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: '14px', background: '#1D1D25' }}>
                <dt style={{ fontSize: '12px', color: '#A1A1AA' }}>Backing</dt>
                <dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{selectedToken.backing}</dd>
              </div>
              <div style={{ padding: '14px', borderRadius: '14px', background: '#1D1D25' }}>
                <dt style={{ fontSize: '12px', color: '#A1A1AA' }}>Votes cast</dt>
                <dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{selectedToken.votes_cast || 0}</dd>
              </div>
            </dl>

            {/* Liquid Exit Burn Calculation */}
            <div
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: '1px solid rgba(245,165,36,0.4)',
                background: 'rgba(245,165,36,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <strong style={{ fontSize: '14px' }}>If you burn it now</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#C4C4CC' }}>You receive (90%)</span>
                <strong style={{ color: '#86EFAC' }}>{burnStats.youGet} {burnStats.unit}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#C4C4CC' }}>Treasury (10%)</span>
                <span>{burnStats.daoGets} {burnStats.unit}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="btn-primary"
                style={{ flex: '1 1 120px' }}
              >
                <Plus size={16} /> Add to vault
              </button>
              <button
                type="button"
                onClick={() => onNavigate('sells')}
                className="btn-secondary"
                style={{ flex: '1 1 120px' }}
              >
                <ArrowUpRight size={16} /> List for sale
              </button>
              <button
                type="button"
                onClick={() => setShowBurnModal(true)}
                style={{
                  flex: '1 1 100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  minHeight: '44px',
                  padding: '0 20px',
                  borderRadius: '14px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#FCA5A5',
                  border: '1px solid rgba(252,165,165,0.3)',
                }}
              >
                <Flame size={16} /> Burn and redeem floor
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Burn Confirmation Modal */}
      {showBurnModal && selectedToken && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#15151B',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: '24px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={24} color="#EF4444" />
              <h2 style={{ margin: 0, fontSize: '20px', color: '#F4F4F5' }}>
                Burn {selectedToken.title}?
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#C4C4CC' }}>
              Burning permanently destroys the NFT, closes its keyless subaccount, and pays out <strong>90% of the vault backing ({burnStats.youGet} {burnStats.unit})</strong> directly to your wallet. 10% returns to the DAO Treasury pool.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowBurnModal(false)}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onBurnToken(selectedToken);
                  setShowBurnModal(false);
                }}
                style={{
                  flex: 1,
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  border: 0,
                  borderRadius: '14px',
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                Confirm Burn &amp; Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add To Vault Modal */}
      {showAddModal && selectedToken && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#15151B',
              border: '1px solid #2A2A33',
              borderRadius: '24px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Deposit into Vault</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 0, color: '#A1A1AA', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: '#C4C4CC' }}>
              Deposit FT or NEAR directly into keyless vault <code>{selectedToken.vault_account}</code>. It increases your NFT's floor redemption value.
            </p>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
              Amount ({selectedToken.asset})
              <input
                type="text"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                style={{
                  minHeight: '46px',
                  borderRadius: '12px',
                  border: '1px solid #2A2A33',
                  background: '#1D1D25',
                  color: '#F4F4F5',
                  padding: '0 12px',
                  fontSize: '16px',
                }}
              />
            </label>
            <button
              onClick={() => {
                onAddToVault(selectedToken, addAmount);
                setShowAddModal(false);
              }}
              className="btn-primary"
              style={{ minHeight: '46px' }}
            >
              Deposit {addAmount} {selectedToken.asset}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
