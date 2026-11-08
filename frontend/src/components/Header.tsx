import React from 'react';
import { Search } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
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

      {/* Right controls: ONLY Testnet status pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            height: '44px',
            boxSizing: 'border-box',
            padding: '0 16px',
            background: '#15151B',
            border: '1px solid #2A2A33',
            borderRadius: '14px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#E4E4E7',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#4ADE80',
              boxShadow: '0 0 10px rgba(74, 222, 128, 0.85)',
            }}
          />
          <span>NEAR testnet</span>
        </div>
      </div>
    </header>
  );
};
