import React, { useState, useEffect } from 'react';
import type { UserWallet } from '../types';
import {
  X,
  Check,
  RefreshCw,
  ExternalLink,
  Activity,
  Flame,
  Zap,
  CheckCircle2,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';
import { fetchNearAccountBalance, NEAR_TESTNET_EXPLORER, NEAR_TESTNET_RPC } from '../near';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: UserWallet;
  onUpdateWallet: (updated: Partial<UserWallet>) => void;
  onOpenConnect: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onUpdateWallet,
  onOpenConnect,
}) => {
  const [activeTab, setActiveTab] = useState<'connectors' | 'account'>('connectors');
  const [selectedConnector, setSelectedConnector] = useState<string | null>(
    wallet.connector || 'hot'
  );
  const [tempId, setTempId] = useState(wallet.accountId);
  const [isCheckingRpc, setIsCheckingRpc] = useState(false);
  const [rpcStatus, setRpcStatus] = useState<string | null>(null);
  const [hasMeteorInjected, setHasMeteorInjected] = useState(false);

  // Detect Meteor injected extension on mount / open
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMeteor = !!((window as unknown as { meteorWallet?: unknown }).meteorWallet || (window as unknown as { near?: { isMeteor?: boolean } }).near?.isMeteor);
      setHasMeteorInjected(isMeteor);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSyncWithRpc = async (accountToSync: string, connectorType?: string) => {
    setIsCheckingRpc(true);
    setRpcStatus('Querying NEAR testnet RPC...');
    const balance = await fetchNearAccountBalance(accountToSync);
    setIsCheckingRpc(false);

    const connector = connectorType || selectedConnector || 'meteor';

    if (balance !== null) {
      onUpdateWallet({
        accountId: accountToSync,
        balanceNear: balance,
        connected: true,
        connector,
      });
      setRpcStatus(`Synced on-chain: ${balance.toFixed(2)} test NEAR`);
    } else {
      onUpdateWallet({
        accountId: accountToSync,
        connected: true,
        connector,
      });
      setRpcStatus(`Connected to ${accountToSync} (testnet mode)`);
    }
    setActiveTab('account');
  };

  const handleConnectMeteor = async () => {
    setSelectedConnector('meteor');
    // Check if Meteor injected provider is present
    const win = typeof window !== 'undefined' ? (window as unknown as { meteorWallet?: { requestSignIn?: (opts: unknown) => Promise<unknown>; getAccountId?: () => Promise<string> } }) : null;
    if (win?.meteorWallet?.requestSignIn) {
      try {
        setRpcStatus('Connecting to Meteor Wallet extension...');
        await win.meteorWallet.requestSignIn({ contractId: 'quorum.testnet' });
        if (win.meteorWallet.getAccountId) {
          const accId = await win.meteorWallet.getAccountId();
          if (accId) {
            setTempId(accId);
            await handleSyncWithRpc(accId, 'meteor');
            return;
          }
        }
      } catch (err) {
        console.warn('Meteor sign-in rejected or error:', err);
      }
    }
    // If not injected or running in standard browser, connect with testnet account
    const finalId = tempId.includes('.') ? tempId : `${tempId || 'meteor-user'}.testnet`;
    setTempId(finalId);
    handleSyncWithRpc(finalId, 'meteor');
  };

  const handleConnectHot = async () => {
    setSelectedConnector('hot');
    const finalId = tempId.includes('.') ? tempId : `${tempId || 'hot-user'}.tg`;
    setTempId(finalId);
    handleSyncWithRpc(finalId, 'hot');
  };

  const handleConnectMyNearWallet = async () => {
    setSelectedConnector('mynearwallet');
    const finalId = tempId.includes('.') ? tempId : `${tempId || 'mynear-user'}.testnet`;
    setTempId(finalId);
    handleSyncWithRpc(finalId, 'mynearwallet');
  };

  const handleManualSave = () => {
    const trimmed = tempId.trim();
    if (!trimmed) return;
    const finalId = trimmed.includes('.') ? trimmed : `${trimmed}.testnet`;
    setTempId(finalId);
    handleSyncWithRpc(finalId, selectedConnector || 'custom');
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
          maxWidth: '480px',
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
              NEAR Testnet Connect
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

        {/* Tab Switcher: Connectors vs Account Details */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            gap: '6px',
            background: '#1D1D25',
            padding: '4px',
            borderRadius: '14px',
            border: '1px solid #2A2A33',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'connectors'}
            onClick={() => setActiveTab('connectors')}
            style={{
              flex: 1,
              minHeight: '36px',
              borderRadius: '10px',
              border: 0,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              background: activeTab === 'connectors' ? '#F5A524' : 'transparent',
              color: activeTab === 'connectors' ? '#111113' : '#A1A1AA',
              transition: 'all 0.15s ease',
            }}
          >
            Connectors
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'account'}
            onClick={() => setActiveTab('account')}
            style={{
              flex: 1,
              minHeight: '36px',
              borderRadius: '10px',
              border: 0,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              background: activeTab === 'account' ? '#F5A524' : 'transparent',
              color: activeTab === 'account' ? '#111113' : '#A1A1AA',
              transition: 'all 0.15s ease',
            }}
          >
            Active Account
          </button>
        </div>

        {/* TAB 1: CONNECTORS (Official HOT Connector & Wallets) */}
        {activeTab === 'connectors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 1. PRIMARY: OFFICIAL NEAR ECOSYSTEM SELECTOR (HOT CONNECTOR) */}
            <div
              onClick={() => {
                onClose();
                onOpenConnect();
              }}
              style={{
                background: 'linear-gradient(135deg, rgba(245,165,36,0.18) 0%, rgba(255,87,34,0.12) 100%)',
                border: '1.5px solid #F5A524',
                borderRadius: '18px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 4px 18px rgba(245,165,36,0.2)',
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
                    <strong style={{ fontSize: '15px', color: '#F4F4F5' }}>Official HOT Connector</strong>
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
                      RECOMMENDED
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#D4D4D8' }}>
                    HOT Wallet, Meteor, Intear, Ledger, MyNear, NEAR Mobile, Nightly &amp; WalletConnect
                  </span>
                </div>
              </div>
              <ArrowRight size={20} color="#F5A524" />
            </div>

            <span style={{ fontSize: '12px', color: '#71717A', marginTop: '4px' }}>
              Or connect directly via individual provider:
            </span>

            {/* 2. METEOR WALLET CONNECTOR */}
            <div
              onClick={handleConnectMeteor}
              style={{
                background: wallet.connector === 'meteor' ? 'rgba(245,165,36,0.1)' : '#1D1D25',
                border: wallet.connector === 'meteor' ? '1px solid #F5A524' : '1px solid #2A2A33',
                borderRadius: '18px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #5F45FF 0%, #8E79FF 100%)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 14px rgba(95, 69, 255, 0.35)',
                    flexShrink: 0,
                  }}
                >
                  <Zap size={22} />
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '15px', color: '#F4F4F5' }}>Meteor Wallet</strong>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        background: 'rgba(95, 69, 255, 0.2)',
                        color: '#B4A5FF',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        border: '1px solid rgba(95, 69, 255, 0.4)',
                      }}
                    >
                      {hasMeteorInjected ? 'Installed 🟢' : 'Extension & Web'}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#A1A1AA' }}>
                    {hasMeteorInjected ? 'Extension detected. Click to approve sign-in.' : 'Popular NEAR browser extension & web wallet'}
                  </span>
                </div>
              </div>
              {wallet.connector === 'meteor' && wallet.connected ? (
                <CheckCircle2 size={20} color="#F5A524" />
              ) : (
                <ArrowRight size={18} color="#71717A" />
              )}
            </div>

            {/* 2. HOT CONNECTOR (HOT Wallet / HERE) */}
            <div
              onClick={handleConnectHot}
              style={{
                background: wallet.connector === 'hot' ? 'rgba(245,165,36,0.1)' : '#1D1D25',
                border: wallet.connector === 'hot' ? '1px solid #F5A524' : '1px solid #2A2A33',
                borderRadius: '18px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #FF5722 0%, #FF9800 100%)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 14px rgba(255, 87, 34, 0.35)',
                    flexShrink: 0,
                  }}
                >
                  <Flame size={22} />
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '15px', color: '#F4F4F5' }}>HOT Connector</strong>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        background: 'rgba(255, 87, 34, 0.2)',
                        color: '#FFAB91',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        border: '1px solid rgba(255, 87, 34, 0.4)',
                      }}
                    >
                      Telegram HOT
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#A1A1AA' }}>
                    Connect via Telegram HOT Wallet &amp; HERE Wallet app
                  </span>
                </div>
              </div>
              {wallet.connector === 'hot' && wallet.connected ? (
                <CheckCircle2 size={20} color="#F5A524" />
              ) : (
                <ArrowRight size={18} color="#71717A" />
              )}
            </div>

            {/* 3. MYNEARWALLET CONNECTOR */}
            <div
              onClick={handleConnectMyNearWallet}
              style={{
                background: wallet.connector === 'mynearwallet' ? 'rgba(245,165,36,0.1)' : '#1D1D25',
                border: wallet.connector === 'mynearwallet' ? '1px solid #F5A524' : '1px solid #2A2A33',
                borderRadius: '18px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '14px',
                    background: '#15151B',
                    border: '1px solid #2A2A33',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#F5A524',
                    fontSize: '20px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  Ⓝ
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '15px', color: '#F4F4F5' }}>MyNearWallet</strong>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#A1A1AA',
                        padding: '1px 6px',
                        borderRadius: '999px',
                      }}
                    >
                      Web Wallet
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#A1A1AA' }}>
                    testnet.mynearwallet.com official web wallet
                  </span>
                </div>
              </div>
              {wallet.connector === 'mynearwallet' && wallet.connected ? (
                <CheckCircle2 size={20} color="#F5A524" />
              ) : (
                <ArrowRight size={18} color="#71717A" />
              )}
            </div>

            {/* Quick Web Links for Meteor & HOT */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <a
                href="https://wallet.meteorwallet.app"
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  background: '#1D1D25',
                  border: '1px solid #2A2A33',
                  color: '#A1A1AA',
                  fontSize: '12px',
                  textDecoration: 'none',
                }}
              >
                <Zap size={13} color="#8E79FF" /> Meteor Web App <ExternalLink size={11} />
              </a>
              <a
                href="https://t.me/herewalletbot/app"
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  background: '#1D1D25',
                  border: '1px solid #2A2A33',
                  color: '#A1A1AA',
                  fontSize: '12px',
                  textDecoration: 'none',
                }}
              >
                <Flame size={13} color="#FF5722" /> HOT Telegram <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE ACCOUNT & BALANCE SETTINGS */}
        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Active Connector Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: '#1D1D25',
                border: '1px solid #2A2A33',
                borderRadius: '14px',
              }}
            >
              <span style={{ fontSize: '13px', color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={14} /> Active Connector:
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: wallet.connector === 'hot' ? '#FFAB91' : '#B4A5FF',
                }}
              >
                {wallet.connector === 'hot' ? (
                  <>
                    <Flame size={14} color="#FF5722" /> HOT Connector
                  </>
                ) : wallet.connector === 'meteor' ? (
                  <>
                    <Zap size={14} color="#5F45FF" /> Meteor Wallet
                  </>
                ) : (
                  <>
                    <Shield size={14} /> MyNearWallet
                  </>
                )}
              </span>
            </div>

            {/* Switch via Official HOT Connector */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenConnect();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '44px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #FF5722 0%, #F5A524 100%)',
                border: 0,
                color: '#111113',
                fontWeight: 600,
                fontSize: '13.5px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(245, 165, 36, 0.3)',
              }}
            >
              <Flame size={17} strokeWidth={2.5} /> Open Official Wallet Selector (HOT Connector)
            </button>

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
                  title="Query RPC for live on-chain balance"
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

            {/* Switch Account Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Active Account ID
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={tempId}
                  onChange={(e) => setTempId(e.target.value)}
                  placeholder="e.g. yourname.testnet or name.tg"
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
                  onClick={handleManualSave}
                  className="btn-primary"
                  style={{ minHeight: '44px', padding: '0 16px' }}
                >
                  <Check size={16} /> Save
                </button>
              </div>
            </div>

            {/* Quick Test Accounts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#71717A' }}>Quick Switch Testnet Accounts:</span>
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
          </div>
        )}

        {/* Footer Details: Explorer & Disconnect */}
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
          {wallet.connected ? 'Disconnect Wallet' : 'Connect Selected Connector'}
        </button>
      </div>
    </div>
  );
};
