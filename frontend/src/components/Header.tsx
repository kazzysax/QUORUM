import React from 'react';
import { Search } from 'lucide-react';
import type { UserWallet } from '../types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  wallet: UserWallet;
  onOpenWallet: () => void;
  onOpenConnect?: () => void;
}

const getConnectorBadge = (conn: string) => {
  const lower = conn.toLowerCase();
  if (lower.includes('hot')) return { label: '🔥 HOT', bg: 'rgba(255, 87, 34, 0.15)', color: '#FFAB91', border: 'rgba(255, 87, 34, 0.3)' };
  if (lower.includes('meteor')) return { label: '☄️ Meteor', bg: 'rgba(95, 69, 255, 0.15)', color: '#B4A5FF', border: 'rgba(95, 69, 255, 0.3)' };
  if (lower.includes('intear')) return { label: '💧 Intear', bg: 'rgba(56, 189, 248, 0.15)', color: '#7DD3FC', border: 'rgba(56, 189, 248, 0.3)' };
  if (lower.includes('mynear')) return { label: 'Ⓝ MyNear', bg: 'rgba(74, 222, 128, 0.15)', color: '#86EFAC', border: 'rgba(74, 222, 128, 0.3)' };
  if (lower.includes('ledger')) return { label: '🛡️ Ledger', bg: 'rgba(244, 244, 245, 0.15)', color: '#E4E4E7', border: 'rgba(244, 244, 245, 0.3)' };
  if (lower.includes('nightly')) return { label: '🦊 Nightly', bg: 'rgba(249, 115, 22, 0.15)', color: '#FDBA74', border: 'rgba(249, 115, 22, 0.3)' };
  return { label: `⚡ ${conn}`, bg: 'rgba(245, 165, 36, 0.15)', color: '#FCD34D', border: 'rgba(245, 165, 36, 0.3)' };
};

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  wallet,
  onOpenWallet,
  onOpenConnect,
}) => {
  const isTestnet = wallet.network === 'testnet';
  const badge = wallet.connector ? getConnectorBadge(wallet.connector) : null;

  return (
    <header
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
      }}
    >
      {/* Search Input */}
      <label
        style={{
          flex: '1 1 320px',
          maxWidth: '560px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          height: '46px',
          boxSizing: 'border-box',
          padding: '0 16px',
          background: '#15151B',
          border: '1px solid #2A2A33',
          borderRadius: '14px',
          color: '#A1A1AA',
        }}
      >
        <Search size={18} strokeWidth={1.8} />
        <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          Search
        </span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search NFTs, collections or accounts"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 0,
            outline: 'none',
            color: '#F4F4F5',
            font: 'inherit',
            fontSize: '14px',
          }}
        />
      </label>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Account & Network Pill */}
        <button
          onClick={wallet.connected ? onOpenWallet : (onOpenConnect || onOpenWallet)}
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            height: '46px',
            boxSizing: 'border-box',
            padding: '0 8px 0 14px',
            background: '#15151B',
            border: '1px solid #2A2A33',
            borderRadius: '14px',
            cursor: 'pointer',
            color: '#F4F4F5',
            font: 'inherit',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#A1A1AA' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isTestnet ? '#4ADE80' : '#F5A524',
                boxShadow: `0 0 8px ${isTestnet ? '#4ADE80' : '#F5A524'}`,
              }}
            />
            NEAR {wallet.network}
          </span>
          <span style={{ width: '1px', height: '20px', background: '#2A2A33' }} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>
            {wallet.connected ? `Hi, ${wallet.accountId}` : 'Connect Wallet'}
          </span>
          {wallet.connected && badge && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '999px',
                background: badge.bg,
                color: badge.color,
                border: `1px solid ${badge.border}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              {badge.label}
            </span>
          )}
          <span
            aria-hidden="true"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: '#1D1D25',
              border: '1px solid #2A2A33',
              display: 'grid',
              placeItems: 'center',
              fontSize: '14px',
              fontWeight: 600,
              color: '#F5A524',
            }}
          >
            {wallet.accountId.charAt(0).toUpperCase()}
          </span>
        </button>
      </div>
    </header>
  );
};
