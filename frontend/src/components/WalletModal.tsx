import React, { useState } from 'react';
import type { UserWallet } from '../types';
import { X, Check, RefreshCw, KeyRound, Globe, ExternalLink, Activity } from 'lucide-react';
import { fetchNearAccountBalance, NEAR_TESTNET_EXPLORER, NEAR_TESTNET_RPC } from '../near';

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
  const [isCheckingRpc, setIsCheckingRpc] = useState(false);
  const [rpcStatus, setRpcStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSyncWithRpc = async (accountToSync: string) => {
    setIsCheckingRpc(true);
    setRpcStatus('Querying NEAR testnet RPC...');
    const balance = await fetchNearAccountBalance(accountToSync);
    setIsCheckingRpc(false);

    if (balance !== null) {
      onUpdateWallet({ accountId: accountToSync, balanceNear: balance, connected: true });
      setRpcStatus(`Synced on-chain: ${balance.toFixed(2)} test NEAR`);
    } else {
      onUpdateWallet({ accountId: accountToSync, connected: true });
      setRpcStatus(`Connected to ${accountToSync} (testnet mode)`);
    }
  };

  const handleSaveAccount = () => {
    const trimmed = tempId.trim();
    if (!trimmed) return;
    const finalId = trimmed.includes('.') ? trimmed : `${trimmed}.testnet`;
    setTempId(finalId);
    handleSyncWithRpc(finalId);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#F4F4F5' }}>
              NEAR Testnet Wallet
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#4ADE80',
                background: 'rgba(74, 222, 128, 0.1)',
                padding: '2px 8px',
                borderRadius: '999px',
                border: '1px solid rgba(74, 222, 128, 0.25)',
              }}
            >
              Testnet
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Available Testnet Balance</span>
            <button
              type="button"
              onClick={() => handleSyncWithRpc(wallet.accountId)}
              disabled={isCheckingRpc}
              title="Query RPC for live balance"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: 'none',
                color: '#A1A1AA',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              <RefreshCw size={12} className={isCheckingRpc ? 'animate-spin' : ''} />
              Sync RPC
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'Space Grotesk' }}>
              {wallet.balanceNear.toFixed(2)} NEAR
            </span>
            <button
              onClick={() => onUpdateWallet({ balanceNear: wallet.balanceNear + 25 })}
              className="gold-badge"
              style={{ cursor: 'pointer', border: '1px solid #F5A524', padding: '6px 12px', fontSize: '12px' }}
            >
              + Faucet 25 Test NEAR
            </button>
          </div>
          {rpcStatus && (
            <span style={{ fontSize: '11px', color: '#86EFAC', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Activity size={12} /> {rpcStatus}
            </span>
          )}
        </div>

        {/* Switch Account */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <KeyRound size={14} /> Active Testnet Account
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={tempId}
              onChange={(e) => setTempId(e.target.value)}
              placeholder="e.g. yourname.testnet"
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
              onClick={handleSaveAccount}
              className="btn-primary"
              style={{ minHeight: '44px', padding: '0 16px' }}
            >
              <Check size={16} /> Save
            </button>
          </div>
        </div>

        {/* Quick Testnet Switch Accounts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#71717A' }}>Test Accounts:</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['alice.testnet', 'bob.testnet', 'aurora.testnet', 'oceanic.testnet'].map((account) => (
              <button
                key={account}
                onClick={() => {
                  setTempId(account);
                  handleSyncWithRpc(account);
                }}
                className="neutral-badge"
                style={{ cursor: 'pointer', fontSize: '11px', height: '28px' }}
              >
                {account}
              </button>
            ))}
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
              NEAR Testnet (Active)
            </button>
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
          </div>
        </div>

        {/* Testnet Explorer & RPC Details */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#71717A',
            paddingTop: '4px',
          }}
        >
          <span>RPC: {NEAR_TESTNET_RPC.replace('https://', '')}</span>
          <a
            href={`${NEAR_TESTNET_EXPLORER}/address/${wallet.accountId}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#F5A524', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
          >
            Explorer <ExternalLink size={12} />
          </a>
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
          }}
        >
          {wallet.connected ? 'Disconnect Wallet' : 'Connect Testnet Wallet'}
        </button>
      </div>
    </div>
  );
};
