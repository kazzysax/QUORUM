import React, { useState } from 'react';
import type { UserWallet } from '../types';
import { X, Check, RefreshCw, KeyRound, Globe } from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: UserWallet;
  onUpdateWallet: (updated: Partial<UserWallet>) => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onUpdateWallet,
}) => {
  const [tempId, setTempId] = useState(wallet.accountId);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={onClose}
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
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#F4F4F5' }}>
            NEAR Wallet Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 0,
              color: '#A1A1AA',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Balance Card */}
        <div
          style={{
            padding: '16px',
            background: '#1D1D25',
            border: '1px solid #2A2A33',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Available Balance</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'Space Grotesk' }}>
              {wallet.balanceNear.toFixed(2)} NEAR
            </span>
            <button
              onClick={() => onUpdateWallet({ balanceNear: wallet.balanceNear + 25 })}
              className="gold-badge"
              style={{ cursor: 'pointer', border: '1px solid #F5A524' }}
            >
              + Faucet 25 NEAR
            </button>
          </div>
        </div>

        {/* Switch Account */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <KeyRound size={14} /> Active Account ID
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={tempId}
              onChange={(e) => setTempId(e.target.value)}
              placeholder="e.g. alice.near"
              style={{
                flex: 1,
                minHeight: '44px',
                padding: '0 12px',
                borderRadius: '12px',
                background: '#1D1D25',
                border: '1px solid #2A2A33',
                color: '#F4F4F5',
                fontSize: '14px',
              }}
            />
            <button
              onClick={() => onUpdateWallet({ accountId: tempId, connected: true })}
              className="btn-primary"
              style={{ minHeight: '44px', padding: '0 16px' }}
            >
              <Check size={16} /> Save
            </button>
          </div>
        </div>

        {/* Network Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={14} /> Network
          </span>
          <div style={{ display: 'flex', gap: '8px', background: '#1D1D25', padding: '4px', borderRadius: '12px' }}>
            <button
              type="button"
              onClick={() => onUpdateWallet({ network: 'mainnet' })}
              style={{
                flex: 1,
                minHeight: '38px',
                borderRadius: '10px',
                border: 0,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                background: wallet.network === 'mainnet' ? '#F5A524' : 'transparent',
                color: wallet.network === 'mainnet' ? '#111113' : '#A1A1AA',
              }}
            >
              Mainnet
            </button>
            <button
              type="button"
              onClick={() => onUpdateWallet({ network: 'testnet' })}
              style={{
                flex: 1,
                minHeight: '38px',
                borderRadius: '10px',
                border: 0,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                background: wallet.network === 'testnet' ? '#F5A524' : 'transparent',
                color: wallet.network === 'testnet' ? '#111113' : '#A1A1AA',
              }}
            >
              Testnet
            </button>
          </div>
        </div>

        {/* Quick Swapper */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#71717A' }}>Quick Demo Personas:</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['alice.near (Holder & Voter)', 'creator.near (Artist)', 'whale.near (Collector)'].map((persona) => {
              const account = persona.split(' ')[0];
              return (
                <button
                  key={persona}
                  onClick={() => {
                    setTempId(account);
                    onUpdateWallet({ accountId: account, connected: true });
                  }}
                  className="neutral-badge"
                  style={{ cursor: 'pointer', fontSize: '11px', height: '28px' }}
                >
                  <RefreshCw size={11} style={{ marginRight: '4px' }} />
                  {persona}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => {
            onUpdateWallet({ connected: !wallet.connected });
            onClose();
          }}
          style={{
            minHeight: '44px',
            borderRadius: '14px',
            border: '1px solid #2A2A33',
            background: 'transparent',
            color: wallet.connected ? '#FCA5A5' : '#86EFAC',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '8px',
          }}
        >
          {wallet.connected ? 'Disconnect Wallet' : 'Connect Wallet'}
        </button>
      </div>
    </div>
  );
};
