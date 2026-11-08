import React, { useState } from 'react';
import type { UserWallet } from '../types';
import {
  X,
  RefreshCw,
  ExternalLink,
  Activity,
  Flame,
  ArrowRight,
  Wallet,
  CheckCircle2,
} from 'lucide-react';
import { fetchNearAccountBalance, NEAR_TESTNET_EXPLORER, NEAR_TESTNET_RPC } from '../near';
import { disconnectNearConnect } from '../nearConnect';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: UserWallet;
  onUpdateWallet: (updated: Partial<UserWallet>) => void;
  onOpenConnect: () => void;
  onDisconnect?: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onUpdateWallet,
  onOpenConnect,
  onDisconnect,
}) => {
  const [isCheckingRpc, setIsCheckingRpc] = useState(false);
  const [rpcStatus, setRpcStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSyncWithRpc = async () => {
    if (!wallet.accountId) return;
    setIsCheckingRpc(true);
    setRpcStatus('Querying NEAR testnet RPC...');
    const balance = await fetchNearAccountBalance(wallet.accountId);
    setIsCheckingRpc(false);

    if (balance !== null) {
      onUpdateWallet({
        balanceNear: balance,
      });
      setRpcStatus(`Synced on-chain: ${balance.toFixed(2)} test NEAR`);
    } else {
      setRpcStatus(`Connected to ${wallet.accountId}`);
    }
  };

  const handleTriggerHotConnector = () => {
    onClose();
    onOpenConnect();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
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
          padding: '26px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#F4F4F5' }}>
              NEAR Wallet
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
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* STANDARD HOT CONNECTOR TRIGGER */}
        <div
          onClick={handleTriggerHotConnector}
          style={{
            background: 'linear-gradient(135deg, rgba(245,165,36,0.18) 0%, rgba(255,87,34,0.12) 100%)',
            border: '1.5px solid #F5A524',
            borderRadius: '18px',
            padding: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 6px 20px rgba(245,165,36,0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #FF5722 0%, #F5A524 100%)',
                display: 'grid',
                placeItems: 'center',
                color: '#111113',
                boxShadow: '0 4px 14px rgba(255, 87, 34, 0.4)',
                flexShrink: 0,
              }}
            >
              <Flame size={24} strokeWidth={2.5} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '15.5px', color: '#F4F4F5' }}>HOT Connector</strong>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    background: '#F5A524',
                    color: '#111113',
                    padding: '1px 7px',
                    borderRadius: '999px',
                  }}
                >
                  STANDARD
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#D4D4D8' }}>
                {wallet.connected ? 'Click to switch or reconnect wallet' : 'Select from HOT Wallet, Meteor, Intear & more'}
              </span>
            </div>
          </div>
          <ArrowRight size={20} color="#F5A524" />
        </div>

        {/* ACTIVE ACCOUNT & BALANCE (When connected) */}
        {wallet.connected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Account Card */}
            <div
              style={{
                padding: '16px',
                background: '#1D1D25',
                border: '1px solid #2A2A33',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} color="#4ADE80" />
                  <span style={{ fontSize: '13px', color: '#A1A1AA' }}>Connected Account</span>
                </div>
                <button
                  type="button"
                  onClick={handleSyncWithRpc}
                  disabled={isCheckingRpc}
                  title="Query testnet RPC for live balance"
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

              <div style={{ fontSize: '16px', fontWeight: 600, color: '#F4F4F5', fontFamily: 'monospace' }}>
                {wallet.accountId}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', paddingTop: '4px', borderTop: '1px solid #2A2A33' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#71717A', display: 'block' }}>Balance</span>
                  <span style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'Space Grotesk', color: '#F5A524' }}>
                    {wallet.balanceNear.toFixed(2)} NEAR
                  </span>
                </div>
                <a
                  href="https://near-faucet.io"
                  target="_blank"
                  rel="noreferrer"
                  className="gold-badge"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', border: '1px solid #F5A524', padding: '6px 12px', fontSize: '12px' }}
                >
                  Get Testnet NEAR <ExternalLink size={12} />
                </a>
              </div>

              {rpcStatus && (
                <span style={{ fontSize: '11px', color: '#86EFAC', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Activity size={12} /> {rpcStatus}
                </span>
              )}
            </div>

            {/* Disconnect Button */}
            <button
              onClick={async () => {
                await disconnectNearConnect();
                onUpdateWallet({ connected: false, accountId: '', balanceNear: 0, connector: undefined });
                if (onDisconnect) onDisconnect();
                onClose();
              }}
              style={{
                minHeight: '42px',
                borderRadius: '12px',
                border: '1px solid #2A2A33',
                background: 'transparent',
                color: '#FCA5A5',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Disconnect Wallet
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              background: '#1D1D25',
              border: '1px solid #2A2A33',
              borderRadius: '16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Wallet size={32} color="#71717A" />
            <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
              Connect your NEAR wallet to manage your portfolio, place offers, and cast DAO votes on testnet.
            </span>
          </div>
        )}

        {/* Footer Explorer Link */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#71717A',
            paddingTop: '6px',
            borderTop: '1px solid #2A2A33',
          }}
        >
          <span>RPC: {NEAR_TESTNET_RPC.replace('https://', '')}</span>
          {wallet.connected && (
            <a
              href={`${NEAR_TESTNET_EXPLORER}/address/${wallet.accountId}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#F5A524', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
            >
              Explorer <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
