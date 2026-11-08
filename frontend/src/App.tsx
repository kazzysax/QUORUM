import { useState, useEffect } from 'react';
import type { Page, TokenItem, CollectionItem, ProposalItem, UserWallet, OfferItem } from './types';
import {
  INITIAL_COLLECTIONS,
  INITIAL_USER_NFTS,
  INITIAL_MARKET_LISTINGS,
  INITIAL_PROPOSALS,
  INITIAL_SALES_HISTORY,
  INITIAL_OFFERS,
} from './mockData';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { WalletModal } from './components/WalletModal';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { fetchNearAccountBalance } from './near';
import { subscribeToNearConnect, openNearConnect } from './nearConnect';

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
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('molten-hours');
  const [searchQuery, setSearchQuery] = useState('');
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // App Data State
  const [wallet, setWallet] = useState<UserWallet>({
    connected: true,
    accountId: 'alice.testnet',
    balanceNear: 125.40,
    network: 'testnet',
    connector: 'meteor',
  });

  const [collections, setCollections] = useState<CollectionItem[]>(INITIAL_COLLECTIONS);
  const [userNfts, setUserNfts] = useState<TokenItem[]>(INITIAL_USER_NFTS);
  const [marketListings, setMarketListings] = useState<TokenItem[]>(INITIAL_MARKET_LISTINGS);
  const [proposals, setProposals] = useState<ProposalItem[]>(INITIAL_PROPOSALS);
  const [salesHistory, setSalesHistory] = useState(INITIAL_SALES_HISTORY);
  const [offers, setOffers] = useState<OfferItem[]>(INITIAL_OFFERS);

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

  // Listen to official NearConnector events
  useEffect(() => {
    const unsubscribe = subscribeToNearConnect(
      async ({ accountId, connectorName }) => {
        const rpcBalance = await fetchNearAccountBalance(accountId);
        setWallet((prev) => ({
          ...prev,
          connected: true,
          accountId,
          balanceNear: rpcBalance !== null ? rpcBalance : prev.balanceNear,
          connector: connectorName,
        }));
        addToast('success', `Connected: ${connectorName}`, `Signed in as ${accountId}`);
      },
      () => {
        setWallet((prev) => ({ ...prev, connected: false, connector: undefined }));
        addToast('info', 'Disconnected', 'Wallet has been signed out.');
      }
    );
    return () => unsubscribe();
  }, []);

  // Trigger the Official HOT Connector modal directly
  const handleOpenOfficialConnect = async () => {
    setIsWalletOpen(false);
    const result = await openNearConnect();
    if (result) {
      const rpcBalance = await fetchNearAccountBalance(result.accountId);
      setWallet((prev) => ({
        ...prev,
        connected: true,
        accountId: result.accountId,
        balanceNear: rpcBalance !== null ? rpcBalance : prev.balanceNear,
        connector: result.connectorName,
      }));
      addToast('success', `Connected: ${result.connectorName}`, `Signed in as ${result.accountId}`);
    }
  };

  // Active collection being viewed/minted
  const activeCollection = collections.find((c) => c.id === selectedCollectionId) || collections[0];

  // Mint Handler for whatever collection is currently selected
  const handleMint = (_stage: 'pre' | 'pub', totalNear: number) => {
    if (wallet.balanceNear < totalNear) {
      addToast('error', 'Insufficient NEAR Balance', `You need ${totalNear} NEAR to mint.`);
      return;
    }

    const newMintNumber = activeCollection.minted + 1;
    const tokenNumStr = String(newMintNumber).padStart(4, '0');
    const subName = activeCollection.id === 'molten-hours' ? 'molten' : 'tidewater';

    const newToken: TokenItem = {
      id: `${activeCollection.id === 'molten-hours' ? 'molt' : 'tide'}-${tokenNumStr}`,
      token_id: tokenNumStr,
      owner_id: wallet.accountId,
      collection: activeCollection.name,
      title: `${activeCollection.name} #${tokenNumStr}`,
      asset: 'USDT + NEAR',
      backing: '1.00 NEAR + 1.00 USDT',
      backing_status: 'credited',
      image: activeCollection.id === 'molten-hours' ? '/images/molten-0.jpg' : '/images/tidewater-0.jpg',
      votes_cast: 0,
      unclaimed_distribution: '0.00 NEAR',
      vault_account: `v${newMintNumber}.${subName}.testnet`,
    };

    setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear - totalNear }));
    setUserNfts((prev) => [newToken, ...prev]);
    setCollections((prev) =>
      prev.map((c) => (c.id === activeCollection.id ? { ...c, minted: c.minted + 1 } : c))
    );

    addToast(
      'success',
      `Minted ${activeCollection.name} #${tokenNumStr}!`,
      `Keyless vault ${newToken.vault_account} created on testnet. 1 NEAR + 1 USDT backing credited.`
    );
  };

  // Buy Listing Handler
  const handleBuyListing = (token: TokenItem) => {
    const priceNum = parseFloat(token.price || '1.00');
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

    // Record real sale
    const newSale = {
      nft_id: token.title,
      buyer: wallet.accountId,
      price_near: token.price || '1.00',
      to_dao: (priceNum * 0.05).toFixed(3),
      royalty: (priceNum * 0.05).toFixed(3),
      net_seller: (priceNum * 0.90).toFixed(3),
      date: 'Just now',
    };
    setSalesHistory((prev) => [newSale, ...prev]);

    addToast(
      'success',
      `Purchased ${token.title}!`,
      `Keyless vault ${token.vault_account || ''} transferred with 1 NEAR + 1 USDT backing intact.`
    );
  };

  // List NFT for Sale
  const handleListNft = (token: TokenItem, priceNear: string) => {
    setUserNfts((prev) =>
      prev.map((t) => (t.id === token.id ? { ...t, price: priceNear } : t))
    );

    const listedToken: TokenItem = { ...token, price: priceNear };
    setMarketListings((prev) => [listedToken, ...prev.filter((l) => l.id !== token.id)]);

    addToast(
      'success',
      `Listed ${token.title} for ${priceNear} NEAR`,
      'Approval given to Quorum testnet market contract.'
    );
  };

  // Cancel Listing
  const handleCancelListing = (token: TokenItem) => {
    setUserNfts((prev) =>
      prev.map((t) => (t.id === token.id ? { ...t, price: undefined } : t))
    );
    setMarketListings((prev) => prev.filter((l) => l.id !== token.id));
    addToast('info', `Listing Cancelled for ${token.title}`);
  };

  // Claim Distributions
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

  // Burn Token & Liquid Exit
  const handleBurnToken = (token: TokenItem) => {
    const nearMatch = token.backing.match(/([\d.]+)\s*NEAR/i);
    const nearNum = nearMatch ? parseFloat(nearMatch[1]) : 1.0;
    const refundNear = nearNum * 0.9;

    setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear + refundNear }));
    setUserNfts((prev) => prev.filter((t) => t.id !== token.id));
    setMarketListings((prev) => prev.filter((l) => l.id !== token.id));

    addToast(
      'success',
      `${token.title} Burned & Redeemed!`,
      `90% floor payout of ${refundNear.toFixed(2)} NEAR + 0.90 USDT refunded to ${wallet.accountId}.`
    );
  };

  // Add to Vault
  const handleAddToVault = (token: TokenItem, amount: string) => {
    const addedNum = parseFloat(amount) || 0;
    if (wallet.balanceNear < addedNum) {
      addToast('error', 'Insufficient Balance', `You need ${amount} NEAR to deposit.`);
      return;
    }

    setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear - addedNum }));
    setUserNfts((prev) =>
      prev.map((t) => {
        if (t.id !== token.id) return t;
        const currentNear = 1.0 + addedNum;
        return { ...t, backing: `${currentNear.toFixed(2)} NEAR + 1.00 USDT` };
      })
    );
    addToast('success', 'Vault Deposit Successful', `Added ${amount} NEAR to ${token.vault_account}`);
  };

  // DAO Voting
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

  // Create Proposal
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

  // Collection Created (Launch Studio)
  const handleCollectionCreated = (col: CollectionItem) => {
    setCollections((prev) => [col, ...prev]);
    setSelectedCollectionId(col.id);
    addToast('success', `Collection "${col.name}" Launched!`, 'Contracts deployed with keyless DAO & Vault.');
  };

  // Accept Offer Handler
  const handleAcceptOffer = (offer: OfferItem) => {
    const offerNum = parseFloat(offer.amount_near || '1.0');
    const matchingNft = userNfts.find((t) => t.id === offer.nft_id || t.title === offer.nft_title);
    if (matchingNft) {
      setUserNfts((prev) => prev.filter((t) => t.id !== matchingNft.id));
    }
    setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear + offerNum }));
    setOffers((prev) => prev.filter((o) => o.id !== offer.id));

    const newSale = {
      nft_id: offer.nft_title,
      buyer: offer.from,
      price_near: offer.amount_near,
      to_dao: (offerNum * 0.05).toFixed(3),
      royalty: (offerNum * 0.05).toFixed(3),
      net_seller: (offerNum * 0.90).toFixed(3),
      date: 'Just now',
    };
    setSalesHistory((prev) => [newSale, ...prev]);
    addToast(
      'success',
      'Offer Accepted!',
      `Received ${offer.amount_near} test NEAR. Vault transferred to ${offer.from}.`
    );
  };

  // Cancel Offer Handler
  const handleCancelOffer = (offer: OfferItem) => {
    const amount = parseFloat(offer.amount_near || '0');
    if (offer.type === 'made') {
      setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear + amount }));
    }
    setOffers((prev) => prev.filter((o) => o.id !== offer.id));
    addToast('info', 'Offer Cancelled', `Escrowed ${amount.toFixed(2)} test NEAR returned to your balance.`);
  };

  // Place Offer Handler
  const handlePlaceOffer = (targetNft: TokenItem, amountNear: string) => {
    const amountNum = parseFloat(amountNear);
    if (wallet.balanceNear < amountNum) {
      addToast('error', 'Insufficient NEAR', `You need ${amountNear} NEAR to place this offer.`);
      return;
    }
    setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear - amountNum }));
    const newOffer: OfferItem = {
      id: `off-${Date.now()}`,
      nft_id: targetNft.id,
      nft_title: targetNft.title,
      image: targetNft.image,
      from: wallet.accountId,
      amount_near: amountNear,
      expires_in: '7 days',
      type: 'made',
    };
    setOffers((prev) => [newOffer, ...prev]);
    addToast(
      'success',
      `Offer Placed: ${amountNear} NEAR`,
      `Held in Quorum testnet escrow for ${targetNft.title}.`
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        boxSizing: 'border-box',
        padding: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'flex-start',
        background: '#0A0A0D',
        color: '#F4F4F5',
      }}
    >
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onOpenWallet={() => setIsWalletOpen(true)}
        onOpenConnect={handleOpenOfficialConnect}
        walletConnected={wallet.connected}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: isSidebarCollapsed ? '74px' : '100px',
          transition: 'margin-left 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Header Bar: Only Search and Testnet status */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Dynamic Route Content */}
        {currentPage === 'marketplace' && (
          <MarketplacePage
            collections={collections}
            listings={marketListings}
            onNavigate={setCurrentPage}
            onSelectCollection={(colId) => {
              setSelectedCollectionId(colId);
              setCurrentPage('mint');
            }}
            onBuyListing={handleBuyListing}
          />
        )}

        {currentPage === 'landing' && (
          <LandingPage
            onNavigate={setCurrentPage}
            onSelectCollection={(colId) => {
              setSelectedCollectionId(colId);
              setCurrentPage('mint');
            }}
          />
        )}

        {currentPage === 'mint' && (
          <MintPage
            collection={activeCollection}
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
          <OffersPage
            offers={offers}
            userNfts={userNfts}
            marketListings={marketListings}
            userBalance={wallet.balanceNear}
            onNavigate={setCurrentPage}
            onAcceptOffer={handleAcceptOffer}
            onCancelOffer={handleCancelOffer}
            onPlaceOffer={handlePlaceOffer}
          />
        )}
      </main>

      {/* Wallet Settings Modal */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        wallet={wallet}
        onUpdateWallet={(updated) => setWallet((prev) => ({ ...prev, ...updated }))}
        onOpenConnect={handleOpenOfficialConnect}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
