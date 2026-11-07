import { useState, useEffect } from 'react';
import type { Page, TokenItem, CollectionItem, ProposalItem, UserWallet } from './types';
import {
  INITIAL_COLLECTIONS,
  INITIAL_USER_NFTS,
  INITIAL_MARKET_LISTINGS,
  INITIAL_PROPOSALS,
  INITIAL_SALES_HISTORY,
  INITIAL_OFFERS,
} from './mockData';
import { checkBackendHealth } from './api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { WalletModal } from './components/WalletModal';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';

import { MarketplacePage } from './pages/MarketplacePage';
import { MintPage } from './pages/MintPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { VotingsPage } from './pages/VotingsPage';
import { LaunchPage } from './pages/LaunchPage';
import { SellsPage } from './pages/SellsPage';
import { OffersPage } from './pages/OffersPage';
import { LandingPage } from './pages/LandingPage';

export function App() {
  const [currentPage, setCurrentPage] = useState<Page>('marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const [backendOnline, setBackendOnline] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);

  // App Data State
  const [wallet, setWallet] = useState<UserWallet>({
    connected: true,
    accountId: 'alice.near',
    balanceNear: 125.40,
    network: 'mainnet',
  });

  const [collections, setCollections] = useState<CollectionItem[]>(INITIAL_COLLECTIONS);
  const [userNfts, setUserNfts] = useState<TokenItem[]>(INITIAL_USER_NFTS);
  const [marketListings, setMarketListings] = useState<TokenItem[]>(INITIAL_MARKET_LISTINGS);
  const [proposals, setProposals] = useState<ProposalItem[]>(INITIAL_PROPOSALS);
  const [salesHistory, setSalesHistory] = useState(INITIAL_SALES_HISTORY);
  const [offers] = useState(INITIAL_OFFERS);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Probe local Fastify backend
  useEffect(() => {
    checkBackendHealth().then((res) => {
      setBackendOnline(res.online);
    });
  }, []);

  // Handlers
  const handleMint = (_stage: 'pre' | 'pub', totalNear: number) => {
    if (wallet.balanceNear < totalNear) {
      addToast('error', 'Insufficient NEAR Balance', `You need ${totalNear} NEAR to mint.`);
      return;
    }

    const moltenCol = collections[0];
    const newMintNumber = moltenCol.minted + 1;
    const tokenNumStr = String(newMintNumber).padStart(4, '0');
    const asset = newMintNumber % 3 === 0 ? 'wNEAR' : 'USDC';

    const newToken: TokenItem = {
      id: `molt-${tokenNumStr}`,
      token_id: tokenNumStr,
      owner_id: wallet.accountId,
      collection: moltenCol.name,
      title: `Quorum #${tokenNumStr}`,
      asset,
      backing: asset === 'USDC' ? '4.50 USDC' : '1.00 NEAR',
      backing_status: 'escrow',
      image: '/images/molten-1.jpg',
      votes_cast: 0,
      unclaimed_distribution: '0.00 NEAR',
      vault_account: `v${newMintNumber}.molten.near`,
    };

    setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear - totalNear }));
    setUserNfts((prev) => [newToken, ...prev]);
    setCollections((prev) =>
      prev.map((c) => (c.id === moltenCol.id ? { ...c, minted: c.minted + 1 } : c))
    );

    addToast(
      'success',
      `Minted Quorum #${tokenNumStr}!`,
      `Keyless vault ${newToken.vault_account} created. 50% locked in escrow, 50% sent to DAO.`
    );
  };

  const handleBuyListing = (token: TokenItem) => {
    const priceNum = parseFloat(token.price || '0');
    if (wallet.balanceNear < priceNum) {
      addToast('error', 'Insufficient NEAR', `Required: ${priceNum} NEAR`);
      return;
    }

    setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear - priceNum }));
    setMarketListings((prev) => prev.filter((l) => l.id !== token.id));

    const acquiredToken: TokenItem = {
      ...token,
      owner_id: wallet.accountId,
      price: undefined,
    };
    setUserNfts((prev) => [acquiredToken, ...prev]);

    // Record sale
    const newSale = {
      nft_id: token.title,
      buyer: wallet.accountId,
      price_near: token.price || '0.00',
      to_dao: (priceNum * 0.05).toFixed(3),
      royalty: (priceNum * 0.05).toFixed(3),
      net_seller: (priceNum * 0.9).toFixed(3),
      date: 'Just now',
    };
    setSalesHistory((prev) => [newSale, ...prev]);

    addToast(
      'success',
      `Purchased ${token.title}!`,
      `Vault ${token.vault_account || ''} transferred with backing intact.`
    );
  };

  const handleListNft = (token: TokenItem, priceNear: string) => {
    setUserNfts((prev) =>
      prev.map((t) => (t.id === token.id ? { ...t, price: priceNear } : t))
    );

    const listedToken: TokenItem = { ...token, price: priceNear };
    setMarketListings((prev) => [listedToken, ...prev.filter((l) => l.id !== token.id)]);

    addToast(
      'success',
      `Listed ${token.title} for ${priceNear} NEAR`,
      'Approval given to Quorum Market contract.'
    );
  };

  const handleCancelListing = (token: TokenItem) => {
    setUserNfts((prev) =>
      prev.map((t) => (t.id === token.id ? { ...t, price: undefined } : t))
    );
    setMarketListings((prev) => prev.filter((l) => l.id !== token.id));
    addToast('info', `Listing Cancelled for ${token.title}`);
  };

  const handleClaimSingle = (token: TokenItem) => {
    const owed = parseFloat(token.unclaimed_distribution || '0');
    if (owed <= 0) return;

    setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear + owed }));
    setUserNfts((prev) =>
      prev.map((t) => (t.id === token.id ? { ...t, unclaimed_distribution: '0.00 NEAR' } : t))
    );
    addToast('success', `Claimed ${owed} NEAR`, `Disbursed to ${wallet.accountId}`);
  };

  const handleClaimAll = () => {
    let totalClaimed = 0;
    setUserNfts((prev) =>
      prev.map((t) => {
        totalClaimed += parseFloat(t.unclaimed_distribution || '0');
        return { ...t, unclaimed_distribution: '0.00 NEAR' };
      })
    );
    if (totalClaimed > 0) {
      setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear + totalClaimed }));
      addToast('success', `Claimed ${totalClaimed.toFixed(2)} NEAR`, 'Transferred from DAO dividends.');
    } else {
      addToast('info', 'No unclaimed dividends currently available.');
    }
  };

  const handleBurnToken = (token: TokenItem) => {
    setUserNfts((prev) => prev.filter((t) => t.id !== token.id));
    setMarketListings((prev) => prev.filter((l) => l.id !== token.id));

    const parts = token.backing.split(' ');
    const num = parseFloat(parts[0]) || 0;
    const unit = parts[1] || 'USDC';
    const refund = (num * 0.9).toFixed(3);

    addToast(
      'success',
      `${token.title} Burned & Redeemed!`,
      `90% floor payout of ${refund} ${unit} sent to ${wallet.accountId}.`
    );
  };

  const handleAddToVault = (token: TokenItem, amount: string) => {
    setUserNfts((prev) =>
      prev.map((t) => {
        if (t.id !== token.id) return t;
        const current = parseFloat(t.backing.split(' ')[0]) || 0;
        const added = parseFloat(amount) || 0;
        const newBacking = `${(current + added).toFixed(2)} ${t.asset}`;
        return { ...t, backing: newBacking };
      })
    );
    addToast('success', 'Vault Deposit Successful', `Added ${amount} ${token.asset} to ${token.vault_account}`);
  };

  const handleCastVote = (proposalId: number, choice: 'yes' | 'no' | 'abstain') => {
    const votingPower = userNfts.length;
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== proposalId) return p;
        return {
          ...p,
          votes_yes: choice === 'yes' ? p.votes_yes + votingPower : p.votes_yes,
          votes_no: choice === 'no' ? p.votes_no + votingPower : p.votes_no,
          votes_abstain: choice === 'abstain' ? p.votes_abstain + votingPower : p.votes_abstain,
          voted_choice: choice,
        };
      })
    );
    addToast('success', `Vote Cast: ${choice.toUpperCase()}`, `Cast with ${votingPower} live NFT votes.`);
  };

  const handleCreateProposal = (propData: Partial<ProposalItem>) => {
    const newProp: ProposalItem = {
      id: proposals.length + 1,
      kind: propData.kind || 'Spend',
      title: propData.title || 'Untitled Proposal',
      description: propData.description || '',
      status: 'Voting open',
      time_remaining: '3d 0h',
      votes_yes: userNfts.length,
      votes_no: 0,
      votes_abstain: 0,
      quorum_reached: false,
      quorum_percent: 25,
      ...propData,
    };
    setProposals((prev) => [newProp, ...prev]);
    addToast('success', `Proposal #${newProp.id} Created!`, 'Opened for community voting.');
  };

  const handleCollectionCreated = (col: CollectionItem) => {
    setCollections((prev) => [col, ...prev]);
    addToast('success', `Collection "${col.name}" Launched!`, 'Contracts deployed with keyless DAO & Vault.');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        boxSizing: 'border-box',
        padding: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        alignItems: 'stretch',
        background: '#0A0A0D',
        color: '#F4F4F5',
      }}
    >
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onOpenWallet={() => setIsWalletOpen(true)}
        walletConnected={wallet.connected}
      />

      {/* Main Container */}
      <main style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Bar */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          wallet={wallet}
          backendOnline={backendOnline}
          onOpenWallet={() => setIsWalletOpen(true)}
        />

        {/* Dynamic Route Content */}
        {currentPage === 'marketplace' && (
          <MarketplacePage
            collections={collections}
            listings={marketListings}
            onNavigate={setCurrentPage}
            onBuyListing={handleBuyListing}
          />
        )}

        {currentPage === 'landing' && (
          <LandingPage onNavigate={setCurrentPage} />
        )}

        {currentPage === 'mint' && (
          <MintPage
            collection={collections[0]}
            onNavigate={setCurrentPage}
            onMint={handleMint}
          />
        )}

        {currentPage === 'portfolio' && (
          <PortfolioPage
            nfts={userNfts}
            onNavigate={setCurrentPage}
            onClaimAll={handleClaimAll}
            onClaimSingle={handleClaimSingle}
            onBurnToken={handleBurnToken}
            onAddToVault={handleAddToVault}
          />
        )}

        {currentPage === 'governance' && (
          <VotingsPage
            proposals={proposals}
            userVotingPower={userNfts.length}
            onCastVote={handleCastVote}
            onCreateProposal={handleCreateProposal}
          />
        )}

        {currentPage === 'launch' && (
          <LaunchPage
            onNavigate={setCurrentPage}
            onCollectionCreated={handleCollectionCreated}
          />
        )}

        {currentPage === 'sells' && (
          <SellsPage
            nfts={userNfts}
            salesHistory={salesHistory}
            onListNft={handleListNft}
            onCancelListing={handleCancelListing}
          />
        )}

        {currentPage === 'offers' && (
          <OffersPage offers={offers} onNavigate={setCurrentPage} />
        )}
      </main>

      {/* Wallet Settings Modal */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        wallet={wallet}
        onUpdateWallet={(updated) => setWallet((prev) => ({ ...prev, ...updated }))}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
