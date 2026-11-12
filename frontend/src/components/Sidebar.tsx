import React from 'react';
import type { Page } from '../types';
import {
  PieChart,
  Rocket,
  CheckSquare,
  Sparkles,
  Tag,
  ArrowUpRight,
  LayoutGrid,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onOpenWallet: () => void;
  onOpenConnect?: () => void;
  walletConnected: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  onOpenWallet,
  onOpenConnect,
  walletConnected,
  collapsed = false,
  onToggleCollapse,
}) => {
  const navItems = [
    { page: 'marketplace' as Page, label: 'Market', icon: LayoutGrid },
    { page: 'mints' as Page, label: 'Mints', icon: Sparkles },
    { page: 'portfolio' as Page, label: 'Portfolio', icon: PieChart },
    { page: 'launch' as Page, label: 'Launch', icon: Rocket },
    { page: 'governance' as Page, label: 'Votings', icon: CheckSquare },
    { page: 'offers' as Page, label: 'Offers', icon: Tag },
    { page: 'sells' as Page, label: 'Sales', icon: ArrowUpRight },
  ];

  return (
    <aside
      style={{
        position: 'fixed',
        left: '16px',
        top: '16px',
        width: collapsed ? '58px' : '88px',
        height: 'calc(100vh / var(--ui-zoom, 1) - 32px)',
        maxHeight: 'calc(100vh / var(--ui-zoom, 1) - 32px)',
        boxSizing: 'border-box',
        padding: collapsed ? '14px 6px' : '16px 6px',
        background: '#15151B',
        border: '1px solid #2A2A33',
        borderRadius: '22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        zIndex: 100,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1), padding 0.22s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {/* Brand Home Button */}
        <button
          onClick={() => { window.location.href = '/'; }}
          aria-label="Quorum home"
          title={collapsed ? 'Quorum home' : undefined}
          style={{
            position: 'relative',
            width: collapsed ? '40px' : '46px',
            height: collapsed ? '40px' : '46px',
            borderRadius: '14px',
            background: '#1D1D25',
            border: '1px solid #2A2A33',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          {currentPage === 'landing' && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: collapsed ? '-6px' : '-8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '3.5px',
                height: '24px',
                borderRadius: '0 4px 4px 0',
                background: 'linear-gradient(180deg, #FFD572 0%, #F5A524 100%)',
                boxShadow: '0 0 10px rgba(245, 165, 36, 0.85)',
              }}
            />
          )}
          <img src="/logo-96.png" alt="" aria-hidden="true" width={collapsed ? 30 : 36} height={collapsed ? 30 : 36} style={{ display: 'block' }} />
        </button>

        {/* Collapse / Expand Toggle Button */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width: collapsed ? '34px' : '44px',
              height: '22px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid #2A2A33',
              color: '#A1A1AA',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        )}

        {/* Navigation Items - Clean golden line on selection, NO surrounding box */}
        <nav aria-label="App Navigation" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center' }}>
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                title={collapsed ? item.label : undefined}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                style={{
                  position: 'relative',
                  width: collapsed ? '44px' : '76px',
                  minHeight: collapsed ? '44px' : '52px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: collapsed ? '0' : '4px',
                  textDecoration: 'none',
                  fontSize: '11px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isActive ? '#F5A524' : '#A1A1AA',
                  border: 'none',
                  outline: 'none',
                  padding: collapsed ? '8px 2px' : '6px 2px 8px',
                }}
              >
                {/* Active Indicator: Left Vertical Golden Line */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: collapsed ? '-6px' : '-7px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '3.5px',
                      height: collapsed ? '22px' : '26px',
                      borderRadius: '0 4px 4px 0',
                      background: 'linear-gradient(180deg, #FFD572 0%, #F5A524 100%)',
                      boxShadow: '0 0 10px rgba(245, 165, 36, 0.9), 0 0 2px #F5A524',
                    }}
                  />
                )}

                <Icon
                  size={collapsed ? 21 : 20}
                  strokeWidth={isActive ? 2.1 : 1.8}
                  style={{
                    color: isActive ? '#F5A524' : 'currentColor',
                    filter: isActive ? 'drop-shadow(0 0 8px rgba(245,165,36,0.5))' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                />

                {!collapsed && (
                  <span
                    style={{
                      color: isActive ? '#F5A524' : 'currentColor',
                      letterSpacing: '0.01em',
                      whiteSpace: 'nowrap',
                      overflow: 'visible',
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {item.label}
                  </span>
                )}

                {/* Active Indicator: Bottom Horizontal Golden Line */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      width: collapsed ? '16px' : '24px',
                      height: '2px',
                      borderRadius: '999px',
                      background: 'linear-gradient(90deg, transparent, #F5A524, transparent)',
                      boxShadow: '0 0 8px rgba(245, 165, 36, 0.75)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Wallet Trigger Button - Fixed at bottom of sidebar pill */}
      <button
        type="button"
        onClick={walletConnected ? onOpenWallet : (onOpenConnect || onOpenWallet)}
        aria-label="Connect wallet"
        title={walletConnected ? 'Wallet Settings' : 'Connect NEAR Wallet'}
        style={{
          flexShrink: 0,
          width: collapsed ? '42px' : '48px',
          height: collapsed ? '42px' : '48px',
          borderRadius: '14px',
          border: '1px solid #2A2A33',
          background: walletConnected ? '#F5A524' : '#1D1D25',
          color: walletConnected ? '#111113' : '#F5A524',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: walletConnected ? '0 0 16px rgba(245,165,36,0.25)' : 'none',
        }}
      >
        <Wallet size={collapsed ? 18 : 20} strokeWidth={2.2} />
      </button>
    </aside>
  );
};
