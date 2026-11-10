import React, { useState, useEffect } from 'react';
import type { Page, TokenItem } from '../types';
import { Flame, ArrowUpRight, Plus, AlertTriangle, X, ShieldCheck } from 'lucide-react';

interface PortfolioPageProps {
  nfts: TokenItem[];
  walletConnected?: boolean;
  walletAccountId?: string;
  onOpenConnect?: () => void;
  onNavigate: (page: Page) => void;
  onClaimAll: () => void;
  onClaimSingle: (token: TokenItem) => void;
  onBurnToken: (token: TokenItem) => void;
  onAddToVault: (token: TokenItem, amount: string) => void;
}

export const PortfolioPage: React.FC<PortfolioPageProps> = ({
  nfts,
  walletConnected = true,
  walletAccountId = '',
  onOpenConnect,
  onNavigate,
  onClaimAll,
  onClaimSingle,
  onBurnToken,
  onAddToVault,
}) => {
  const [selectedTokenId, setSelectedTokenId] = useState<string>(nfts[0]?.id || '');
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addAmount, setAddAmount] = useState('1.0');

  useEffect(() => {
    if (nfts.length > 0 && (!selectedTokenId || !nfts.some((t) => t.id === selectedTokenId))) {
      setSelectedTokenId(nfts[0].id);
    }
  }, [nfts, selectedTokenId]);

  const selectedToken = nfts.find((t) => t.id === selectedTokenId) || nfts[0];

  // Calculate stats
  const totalVotes = nfts.length;
  const unclaimedTotal = nfts.reduce((acc, t) => {
    const val = parseFloat(t.unclaimed_distribution || '0');
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Calculate dynamic NEAR backing across all owned NFTs
  const totalNearBacking = nfts.reduce((acc, t) => {
    const m = t.backing.match(/([\d.]+)\s*NEAR/i);
    return acc + (m ? parseFloat(m[1]) : 1.0);
  }, 0);

  // Calculate 90% burn value (Pure NEAR)
  const parseBacking = (backingStr: string) => {
    const nearMatch = backingStr.match(/([\d.]+)\s*NEAR/i);
    const nearNum = nearMatch ? parseFloat(nearMatch[1]) : 1.0;

    const youGetNear = (nearNum * 0.9).toFixed(2);
    const daoNear = (nearNum * 0.1).toFixed(2);

    return {
      youGet: `${youGetNear} NEAR`,
      daoGets: `${daoNear} NEAR`,
    };
  };

  const burnStats = selectedToken ? parseBacking(selectedToken.backing) : { youGet: '0.00 NEAR', daoGets: '0.00 NEAR' };

  // Calculate projected new backing for Add to Vault modal
  const calculateProjectedBacking = () => {
    if (!selectedToken) return '';
    const nearMatch = selectedToken.backing.match(/([\d.]+)\s*NEAR/i);
    let curNear = nearMatch ? parseFloat(nearMatch[1]) : 1.0;
    const added = parseFloat(addAmount) || 0;
    curNear += added;

    return `${curNear.toFixed(2)} NEAR`;
  };

  if (!walletConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
        {/* Page Title */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>Portfolio</h1>
        </div>

        {/* Clean Disconnected State */}
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
            <ShieldCheck size={34} />
          </div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Wallet Disconnected</h2>
          <p style={{ margin: 0, color: '#A1A1AA', fontSize: '15px', lineHeight: 1.6, maxWidth: '500px' }}>
            Please connect your testnet wallet (<strong style={{ color: '#F4F4F5' }}>malekoala9992.testnet</strong>) to view and manage your 6 Keyless Vault NFTs, collect secondary sales dividends, deposit NEAR into vaults, or dissolve for 90% floor payout.
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
          <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Each one is a keyless vault &amp; DAO vote</span>
        </div>
        <div style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Total Backing</span>
          <strong style={{ fontSize: '24px', fontWeight: 700, color: '#F5A524' }}>
            {totalNearBacking.toFixed(2)} NEAR
          </strong>
          <span style={{ fontSize: '12px', color: '#A1A1AA' }}>100% Real testnet NEAR in vaults</span>
        </div>
        <div style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Voting Power</span>
          <strong style={{ fontSize: '26px', fontWeight: 700 }}>{totalVotes} votes</strong>
          <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Active in collection DAOs</span>
        </div>
        <div style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Unclaimed distributions</span>
          <strong style={{ fontSize: '26px', fontWeight: 700, color: '#86EFAC' }}>{unclaimedTotal.toFixed(2)} NEAR</strong>
          <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Disbursed from secondary sales fees</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>My Keyless Vault NFTs</h2>
                {walletAccountId && (
                  <span style={{ fontSize: '12px', color: '#86EFAC', fontFamily: 'monospace' }}>
                    Owner: {walletAccountId}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '13px', color: '#A1A1AA' }}>{nfts.length} Total</span>
            </div>

            {nfts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#A1A1AA' }}>
                <p>No NFTs found in connected wallet {walletAccountId ? `(${walletAccountId})` : ''}.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('marketplace')}
                  className="btn-primary"
                  style={{ marginTop: '12px' }}
                >
                  Explore Marketplace (34 Available)
                </button>
              </div>
            ) : (
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
                        border: isSelected ? '1.5px solid #F5A524' : '1px solid #2A2A33',
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
                          <span className="neutral-badge">{nft.collection}</span>
                          <span className={nft.backing_status === 'credited' ? 'success-badge' : 'gold-badge'}>
                            {nft.backing_status === 'credited' ? 'Vault Active' : 'In escrow'}
                          </span>
                        </span>
                      </span>
                      <span style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '11px', color: '#A1A1AA' }}>Supported Vault Backing</span>
                        <strong style={{ fontSize: '14px', color: '#F5A524' }}>{nft.backing}</strong>
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
                        {isSelected ? 'Managing' : 'Manage'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
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
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Unclaimed Dividends</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '440px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#A1A1AA', fontSize: '12px' }}>
                    <th style={{ padding: '8px', fontWeight: 500 }}>NFT</th>
                    <th style={{ padding: '8px', fontWeight: 500 }}>Vault Account</th>
                    <th style={{ padding: '8px', fontWeight: 500 }}>Owed</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {nfts.map((nft) => (
                    <tr key={nft.id}>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33' }}>{nft.title}</td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', fontFamily: 'monospace', fontSize: '12px' }}>
                        {nft.vault_account}
                      </td>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #2A2A33', fontWeight: 600, color: '#86EFAC' }}>
                        {nft.unclaimed_distribution || '0.00 NEAR'}
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

        {/* Right Column: Selected NFT Inspector & Vault Management */}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F5A524', fontWeight: 600 }}>
                Vault Inspector
              </span>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>{selectedToken.title}</h2>
              <span style={{ fontSize: '12px', color: '#A1A1AA', fontFamily: 'monospace' }}>
                Vault: {selectedToken.vault_account}
              </span>
            </div>

            <div style={{ borderRadius: '18px', overflow: 'hidden', border: '1px solid #2A2A33', background: '#0A0A0D' }}>
              <img
                src={selectedToken.image}
                alt={selectedToken.title}
                style={{ width: '100%', height: '240px', objectFit: 'cover', display: 'block' }}
              />
            </div>

            {/* Backing Summary */}
            <div style={{ padding: '16px', borderRadius: '16px', background: '#1D1D25', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#A1A1AA' }}>Supported Vault Backing</span>
                <strong style={{ color: '#F5A524' }}>{selectedToken.backing}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#A1A1AA' }}>Supported Asset</span>
                <span className="gold-badge" style={{ fontSize: '11px', padding: '1px 6px' }}>100% NEAR</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#A1A1AA' }}>DAO Voting Power</span>
                <strong style={{ color: '#F4F4F5' }}>1 Vote in {selectedToken.collection} DAO</strong>
              </div>
            </div>

            {/* Burn Payout Estimation */}
            <div
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: '1px solid rgba(245,165,36,0.25)',
                background: 'rgba(245,165,36,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <strong style={{ fontSize: '14px' }}>Liquid Exit Valuation (If Burned Now)</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#C4C4CC' }}>You receive (90% floor)</span>
                <strong style={{ color: '#86EFAC' }}>{burnStats.youGet}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#C4C4CC' }}>{selectedToken.collection} Treasury retained (10%)</span>
                <span>{burnStats.daoGets}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setAddAmount('1.0');
                  setShowAddModal(true);
                }}
                className="btn-primary"
                style={{ flex: '1 1 140px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Add to Vault
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
                <Flame size={16} /> Burn &amp; Redeem 90% Floor
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
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '20px',
          }}
          onClick={() => setShowBurnModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
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
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={24} color="#EF4444" />
              <h2 style={{ margin: 0, fontSize: '20px', color: '#F4F4F5' }}>
                Burn {selectedToken.title}?
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#C4C4CC' }}>
              Burning permanently destroys this NFT, closes its keyless subaccount (<code>{selectedToken.vault_account}</code>), and pays out <strong>90% of the vault backing ({burnStats.youGet})</strong> directly to your connected wallet. 10% returns to the {selectedToken.collection} DAO Treasury.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowBurnModal(false)}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
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

      {/* Add To Vault Modal - 100% Native testnet NEAR */}
      {showAddModal && selectedToken && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '20px',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#15151B',
              border: '1px solid #2A2A33',
              borderRadius: '24px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#F4F4F5' }}>
                  Deposit to Keyless Vault
                </h2>
                <span style={{ fontSize: '12px', color: '#A1A1AA', fontFamily: 'monospace' }}>
                  {selectedToken.vault_account}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 0, color: '#A1A1AA', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Native Asset Backing Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '14px',
                background: 'rgba(245,165,36,0.08)',
                border: '1px solid rgba(245,165,36,0.3)',
                fontSize: '12.5px',
                color: '#FFD572',
                lineHeight: 1.5,
              }}
            >
              <ShieldCheck size={18} color="#F5A524" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>100% Native NEAR Asset Backing:</strong> Deposit testnet NEAR directly into this keyless vault. 90% becomes instantly redeemable on burn.
              </div>
            </div>

            {/* Deposit Amount Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#D4D4D8' }}>Amount to Deposit</span>
                <span style={{ color: '#A1A1AA' }}>Asset: NEAR Protocol</span>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="0.0"
                  style={{
                    width: '100%',
                    minHeight: '48px',
                    borderRadius: '14px',
                    border: '1px solid #2A2A33',
                    background: '#1D1D25',
                    color: '#F4F4F5',
                    padding: '0 64px 0 14px',
                    fontSize: '16px',
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#F5A524',
                    pointerEvents: 'none',
                  }}
                >
                  NEAR
                </span>
              </div>

              {/* Quick Chip Presets */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {['0.5', '1.0', '2.0', '5.0'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAddAmount(preset)}
                    style={{
                      flex: 1,
                      minHeight: '30px',
                      borderRadius: '8px',
                      background: addAmount === preset ? '#F5A524' : '#1D1D25',
                      color: addAmount === preset ? '#111113' : '#D4D4D8',
                      border: '1px solid #2A2A33',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Projection Card */}
            <div
              style={{
                padding: '14px',
                borderRadius: '14px',
                background: '#111115',
                border: '1px solid #2A2A33',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#A1A1AA' }}>Current Backing:</span>
                <span style={{ color: '#D4D4D8' }}>{selectedToken.backing}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid #2A2A33' }}>
                <span style={{ color: '#86EFAC', fontWeight: 600 }}>New Vault Backing:</span>
                <strong style={{ color: '#F5A524' }}>{calculateProjectedBacking()}</strong>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={() => {
                onAddToVault(selectedToken, addAmount);
                setShowAddModal(false);
              }}
              className="btn-primary"
              style={{ minHeight: '48px', fontSize: '15px' }}
            >
              Deposit {addAmount} NEAR On-Chain
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
