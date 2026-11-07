import React from 'react';
import type { Page } from '../types';
import { PieChart, Rocket, CheckSquare, Tag, ArrowUpRight, LayoutGrid, Wallet } from 'lucide-react';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onOpenWallet: () => void;
  walletConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  onOpenWallet,
  walletConnected,
}) => {
  const navItems = [
    { page: 'portfolio' as Page, label: 'Portfolio', icon: PieChart },
    { page: 'launch' as Page, label: 'Launch', icon: Rocket },
    { page: 'governance' as Page, label: 'Votings', icon: CheckSquare },
    { page: 'offers' as Page, label: 'Offers', icon: Tag },
    { page: 'sells' as Page, label: 'Sells', icon: ArrowUpRight },
    { page: 'marketplace' as Page, label: 'Marketplace', icon: LayoutGrid },
  ];

  return (
    <aside
      style={{
        position: 'sticky',
        top: '16px',
        alignSelf: 'flex-start',
        flex: '0 0 84px',
        width: '84px',
        maxWidth: '100%',
        boxSizing: 'border-box',
        padding: '16px 8px',
        background: '#15151B',
        border: '1px solid #2A2A33',
        borderRadius: '22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        height: 'calc(100vh - 32px)',
        maxHeight: 'calc(100vh - 32px)',
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {/* Brand Home Button */}
        <button
          onClick={() => onNavigate('landing')}
          aria-label="Quorum home"
          title="Quorum Overview"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: currentPage === 'landing' ? 'rgba(245,165,36,0.18)' : '#1D1D25',
            border: currentPage === 'landing' ? '1px solid #F5A524' : '1px solid #2A2A33',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <svg aria-hidden="true" width="26" height="26" viewBox="0 0 64 64">
            <defs>
              <linearGradient id="dg-side" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0" stopColor="#FFF4D6" />
                <stop offset="0.38" stopColor="#F5C35A" />
                <stop offset="0.72" stopColor="#E08A0B" />
                <stop offset="1" stopColor="#7A3E05" />
              </linearGradient>
              <radialGradient id="dr-side" cx="0.5" cy="0.72" r="0.42">
                <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" />
                <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path d="M32 4C32 4 12 27 12 40a20 20 0 0 0 40 0C52 27 32 4 32 4Z" fill="url(#dg-side)" />
            <path d="M32 4C32 4 12 27 12 40a20 20 0 0 0 40 0C52 27 32 4 32 4Z" fill="url(#dr-side)" />
            <path d="M32 4C32 4 12 27 12 40a20 20 0 0 0 40 0C52 27 32 4 32 4Z" fill="none" stroke="#FFF4D6" strokeOpacity="0.55" strokeWidth="1" />
            <path d="M22 38c0-5 3-11 7-17" fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="3.2" strokeLinecap="round" />
            <ellipse cx="25" cy="46" rx="2.4" ry="1.6" fill="#FFFFFF" fillOpacity="0.6" />
          </svg>
        </button>

        {/* Navigation Items */}
        <nav aria-label="App Navigation" style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                style={{
                  width: '66px',
                  minHeight: '56px',
                  boxSizing: 'border-box',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  textDecoration: 'none',
                  fontSize: '10.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: isActive ? 'rgba(245,165,36,0.14)' : 'transparent',
                  color: isActive ? '#F5A524' : '#A1A1AA',
                  border: isActive ? '1px solid rgba(245,165,36,0.45)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                  padding: '6px 2px',
                }}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Wallet Trigger Button */}
      <button
        type="button"
        onClick={onOpenWallet}
        aria-label="Connect wallet"
        title={walletConnected ? 'Wallet Settings' : 'Connect NEAR Wallet'}
        style={{
          flexShrink: 0,
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          border: '1px solid #2A2A33',
          background: walletConnected ? '#F5A524' : '#1D1D25',
          color: walletConnected ? '#111113' : '#F5A524',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Wallet size={20} strokeWidth={1.8} />
      </button>
    </aside>
  );
};
