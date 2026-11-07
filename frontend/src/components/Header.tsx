import React from 'react';
import { Search } from 'lucide-react';
import type { UserWallet } from '../types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  wallet: UserWallet;
  backendOnline?: boolean;
  onOpenWallet: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  wallet,
  onOpenWallet,
}) => {
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
          height: '52px',
          boxSizing: 'border-box',
          padding: '0 18px',
          background: '#15151B',
          border: '1px solid #2A2A33',
          borderRadius: '16px',
          color: '#A1A1AA',
        }}
      >
        <Search size={20} strokeWidth={1.8} />
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
            fontSize: '15px',
          }}
        />
      </label>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Account & Network Pill */}
        <button
          onClick={onOpenWallet}
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '52px',
            boxSizing: 'border-box',
            padding: '0 8px 0 16px',
            background: '#15151B',
            border: '1px solid #2A2A33',
            borderRadius: '16px',
            cursor: 'pointer',
            color: '#F4F4F5',
            font: 'inherit',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: wallet.network === 'mainnet' ? '#4ADE80' : '#F5A524',
                boxShadow: `0 0 8px ${wallet.network === 'mainnet' ? '#4ADE80' : '#F5A524'}`,
              }}
            />
            NEAR {wallet.network}
          </span>
          <span style={{ width: '1px', height: '24px', background: '#2A2A33' }} />
          <span style={{ fontSize: '15px', fontWeight: 500 }}>
            {wallet.connected ? `Hi, ${wallet.accountId}` : 'Connect Wallet'}
          </span>
          <span
            aria-hidden="true"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
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
