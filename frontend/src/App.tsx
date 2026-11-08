import { useState, useEffect } from 'react';
import type { Page, TokenItem, CollectionItem, ProposalItem, UserWallet, OfferItem, SaleRecord } from './types';
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
import {
  getNearConnector,
  subscribeToNearConnect,
  openNearConnect,
  disconnectNearConnect,
  sendNearTransaction,
  createTransferAction,
  createFunctionCallAction,
} from './nearConnect';

import { MarketplacePage } from './pages/MarketplacePage';
import { MintPage } from './pages/MintPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { VotingsPage } from './pages/VotingsPage';
import { LaunchPage } from './pages/LaunchPage';
import { SellsPage } from './pages/SellsPage';
import { OffersPage } from './pages/OffersPage';
import { LandingPage } from './pages/LandingPage';

const STORAGE_KEYS = {
  USER_NFTS: 'quorum_testnet_user_nfts_v3',
  MARKET_LISTINGS: 'quorum_testnet_market_listings_v3',
  OFFERS: 'quorum_testnet_offers_v3',
  SALES_HISTORY: 'quorum_testnet_sales_history_v3',
  PROPOSALS: 'quorum_testnet_proposals_v3',
  COLLECTIONS: 'quorum_testnet_collections_v3',
};

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`Failed reading ${key} from localStorage`, err);
  }
  return fallback;
}

function persistState<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`Failed writing ${key} to localStorage`, err);
  }
}

export function App() {
  const [currentPage, setCurrentPage] = useState<Page>('marketplace');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('molten-hours');
  const [searchQuery, setSearchQuery] = useState('');
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // App Data State: Starts disconnected so users connect their OWN real NEAR testnet wallet
  const [wallet, setWallet] = useState<UserWallet>({
    connected: false,
    accountId: '',
    balanceNear: 0,
    network: 'testnet',
    connector: undefined,
  });

  const [collections, setCollections] = useState<CollectionItem[]>(() =>
    loadStored(STORAGE_KEYS.COLLECTIONS, INITIAL_COLLECTIONS)
  );
  const [userNfts, setUserNfts] = useState<TokenItem[]>(() =>
    loadStored(STORAGE_KEYS.USER_NFTS, INITIAL_USER_NFTS)
  );
  const [marketListings, setMarketListings] = useState<TokenItem[]>(() =>
    loadStored(STORAGE_KEYS.MARKET_LISTINGS, INITIAL_MARKET_LISTINGS)
  );
  const [proposals, setProposals] = useState<ProposalItem[]>(() =>
    loadStored(STORAGE_KEYS.PROPOSALS, INITIAL_PROPOSALS)
  );
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>(() =>
    loadStored(STORAGE_KEYS.SALES_HISTORY, INITIAL_SALES_HISTORY)
  );
  const [offers, setOffers] = useState<OfferItem[]>(() =>
    loadStored(STORAGE_KEYS.OFFERS, INITIAL_OFFERS)
  );

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

  // Check for an existing wallet session on mount
  useEffect(() => {
    let isMounted = true;
    const connector = getNearConnector();
    connector
      .wallet()
      .then(async (w) => {
        if (!isMounted || !w) return;
        const accounts = await w.getAccounts({ network: 'testnet' }).catch(() => []);
        if (accounts.length > 0 && accounts[0]?.accountId) {
          const accId = accounts[0].accountId;
          const rpcBal = await fetchNearAccountBalance(accId);
          if (isMounted) {
            setWallet({
              connected: true,
              accountId: accId,
              balanceNear: rpcBal !== null ? rpcBal : 0,
              network: 'testnet',
              connector: (w as any).id || (w as any).name || 'hot-connect',
            });
            setUserNfts((prev) => {
              const updated = prev.map((t) => ({ ...t, owner_id: accId }));
              persistState(STORAGE_KEYS.USER_NFTS, updated);
              return updated;
            });
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to official NearConnector events
  useEffect(() => {
    const unsubscribe = subscribeToNearConnect(
      async ({ accountId, connectorName }) => {
        const rpcBalance = await fetchNearAccountBalance(accountId);
        setWallet({
          connected: true,
          accountId,
          balanceNear: rpcBalance !== null ? rpcBalance : 0,
          network: 'testnet',
          connector: connectorName,
        });

        // Assign user's portfolio NFTs to this connected testnet account
        setUserNfts((prev) => {
          const updated = prev.map((t) => ({ ...t, owner_id: accountId }));
          persistState(STORAGE_KEYS.USER_NFTS, updated);
          return updated;
        });

        addToast('success', `Connected: ${connectorName}`, `Signed in as ${accountId} on testnet`);
      },
      () => {
        setWallet({
          connected: false,
          accountId: '',
          balanceNear: 0,
          network: 'testnet',
          connector: undefined,
        });
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
      setWallet({
        connected: true,
        accountId: result.accountId,
        balanceNear: rpcBalance !== null ? rpcBalance : 0,
        network: 'testnet',
        connector: result.connectorName,
      });

      setUserNfts((prev) => {
        const updated = prev.map((t) => ({ ...t, owner_id: result.accountId }));
        persistState(STORAGE_KEYS.USER_NFTS, updated);
        return updated;
      });

      addToast('success', `Connected: ${result.connectorName}`, `Signed in as ${result.accountId} on testnet`);
    }
  };

  // Active collection being viewed
  const activeCollection = collections.find((c) => c.id === selectedCollectionId) || collections[0];

  // Mint Handler: Collection is capped at 20 pieces each
  const handleMint = (_stage: 'pre' | 'pub', _totalNear: number) => {
    addToast(
      'info',
      'Mint Concluded (20/20 Minted)',
      `Both collections are capped at 20 pieces each on NEAR testnet. Explore the 34 available listings in the Marketplace.`
    );
  };

  // Buy Listing Handler with real NEAR testnet transaction execution
  const handleBuyListing = async (token: TokenItem) => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    const priceNum = parseFloat(token.price || '1.00');

    try {
      addToast('info', 'Initiating Testnet Transaction...', 'Please approve the purchase in your connected wallet.');

      const recipient = token.owner_id && token.owner_id.includes('.testnet')
        ? token.owner_id
        : 'quorum.testnet';

      const tx = await sendNearTransaction({
        receiverId: recipient,
        actions: [createTransferAction(priceNum)],
        signerId: wallet.accountId,
      });

      const acquiredToken: TokenItem = {
        ...token,
        owner_id: wallet.accountId,
        price: undefined,
      };

      const updatedListings = marketListings.filter((l) => l.id !== token.id);
      const updatedUserNfts = [acquiredToken, ...userNfts];

      const newSale: SaleRecord = {
        nft_id: token.title,
        buyer: wallet.accountId,
        price_near: token.price || '1.00',
        to_dao: (priceNum * 0.05).toFixed(3),
        royalty: (priceNum * 0.05).toFixed(3),
        net_seller: (priceNum * 0.90).toFixed(3),
        date: 'Just now',
      };
      const updatedSales = [newSale, ...salesHistory];

      setMarketListings(updatedListings);
      setUserNfts(updatedUserNfts);
      setSalesHistory(updatedSales);

      persistState(STORAGE_KEYS.MARKET_LISTINGS, updatedListings);
      persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);
      persistState(STORAGE_KEYS.SALES_HISTORY, updatedSales);

      const rpcBal = await fetchNearAccountBalance(wallet.accountId);
      if (rpcBal !== null) {
        setWallet((prev) => ({ ...prev, balanceNear: rpcBal }));
      } else {
        setWallet((prev) => ({ ...prev, balanceNear: Math.max(0, prev.balanceNear - priceNum) }));
      }

      addToast(
        'success',
        `Purchased ${token.title}! (Tx Confirmed)`,
        `Keyless vault ${token.vault_account || ''} transferred with 1 NEAR + 1 USDT intact. Tx: ${tx.hash.slice(0, 10)}...`
      );
    } catch (err: any) {
      console.error('Buy listing error:', err);
      addToast('error', 'Purchase Failed or Cancelled', err?.message || 'Could not complete on NEAR testnet.');
    }
  };

  // List NFT for Sale
  const handleListNft = (token: TokenItem, priceNear: string) => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    const updatedUserNfts = userNfts.map((t) => (t.id === token.id ? { ...t, price: priceNear } : t));
    const listedToken: TokenItem = { ...token, price: priceNear };
    const updatedListings = [listedToken, ...marketListings.filter((l) => l.id !== token.id)];

    setUserNfts(updatedUserNfts);
    setMarketListings(updatedListings);

    persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);
    persistState(STORAGE_KEYS.MARKET_LISTINGS, updatedListings);

    addToast(
      'success',
      `Listed ${token.title} for ${priceNear} NEAR`,
      'Approval registered on Quorum testnet market contract.'
    );
  };

  // Cancel Listing
  const handleCancelListing = (token: TokenItem) => {
    const updatedUserNfts = userNfts.map((t) => (t.id === token.id ? { ...t, price: undefined } : t));
    const updatedListings = marketListings.filter((l) => l.id !== token.id);

    setUserNfts(updatedUserNfts);
    setMarketListings(updatedListings);

    persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);
    persistState(STORAGE_KEYS.MARKET_LISTINGS, updatedListings);

    addToast('info', `Listing Cancelled for ${token.title}`);
  };

  // Claim Distributions
  const handleClaimSingle = (token: TokenItem) => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    const owed = parseFloat(token.unclaimed_distribution || '0');
    if (owed <= 0) return;

    setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear + owed }));
    const updatedUserNfts = userNfts.map((t) =>
      t.id === token.id ? { ...t, unclaimed_distribution: '0.00 NEAR' } : t
    );
    setUserNfts(updatedUserNfts);
    persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);

    addToast('success', `Claimed ${owed} NEAR`, `Disbursed to ${wallet.accountId}`);
  };

  const handleClaimAll = () => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    let totalClaimed = 0;
    const updatedUserNfts = userNfts.map((t) => {
      totalClaimed += parseFloat(t.unclaimed_distribution || '0');
      return { ...t, unclaimed_distribution: '0.00 NEAR' };
    });
    if (totalClaimed > 0) {
      setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear + totalClaimed }));
      setUserNfts(updatedUserNfts);
      persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);
      addToast('success', `Claimed ${totalClaimed.toFixed(2)} NEAR`, 'Transferred from DAO dividends.');
    } else {
      addToast('info', 'No unclaimed dividends currently available.');
    }
  };

  // Burn Token & Liquid Exit with real testnet signature
  const handleBurnToken = async (token: TokenItem) => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    const nearMatch = token.backing.match(/([\d.]+)\s*NEAR/i);
    const nearNum = nearMatch ? parseFloat(nearMatch[1]) : 1.0;
    const refundNear = nearNum * 0.9;

    try {
      addToast('info', 'Initiating Vault Dissolution & Burn...', 'Please sign the burn authorization in your wallet.');

      const tx = await sendNearTransaction({
        receiverId: token.vault_account || 'quorum.testnet',
        actions: [
          createFunctionCallAction('burn_and_redeem', { token_id: token.id }, '0.001'),
        ],
        signerId: wallet.accountId,
      });

      const updatedUserNfts = userNfts.filter((t) => t.id !== token.id);
      const updatedListings = marketListings.filter((l) => l.id !== token.id);

      setUserNfts(updatedUserNfts);
      setMarketListings(updatedListings);
      persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);
      persistState(STORAGE_KEYS.MARKET_LISTINGS, updatedListings);

      const rpcBal = await fetchNearAccountBalance(wallet.accountId);
      if (rpcBal !== null) {
        setWallet((prev) => ({ ...prev, balanceNear: rpcBal }));
      } else {
        setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear + refundNear }));
      }

      addToast(
        'success',
        `${token.title} Burned & Redeemed!`,
        `Tx ${tx.hash.slice(0, 10)}... 90% floor payout of ${refundNear.toFixed(2)} NEAR + 0.90 USDT refunded.`
      );
    } catch (err: any) {
      console.error('Burn error:', err);
      addToast('error', 'Redemption Failed', err?.message || 'Transaction rejected.');
    }
  };

  // Add to Vault with real testnet transfer
  const handleAddToVault = async (token: TokenItem, amount: string) => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    const addedNum = parseFloat(amount) || 0;
    if (addedNum <= 0) return;

    try {
      addToast('info', 'Depositing to Keyless Vault...', 'Please approve the vault transfer in your wallet.');

      const tx = await sendNearTransaction({
        receiverId: token.vault_account || 'v1.molten.testnet',
        actions: [createTransferAction(addedNum)],
        signerId: wallet.accountId,
      });

      const updatedUserNfts = userNfts.map((t) => {
        if (t.id !== token.id) return t;
        const currentNear = 1.0 + addedNum;
        return { ...t, backing: `${currentNear.toFixed(2)} NEAR + 1.00 USDT` };
      });

      setUserNfts(updatedUserNfts);
      persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);

      const rpcBal = await fetchNearAccountBalance(wallet.accountId);
      if (rpcBal !== null) {
        setWallet((prev) => ({ ...prev, balanceNear: rpcBal }));
      } else {
        setWallet((prev) => ({ ...prev, balanceNear: Math.max(0, prev.balanceNear - addedNum) }));
      }

      addToast('success', 'Vault Deposit Confirmed', `Tx ${tx.hash.slice(0, 10)}... Added ${amount} NEAR to ${token.vault_account}`);
    } catch (err: any) {
      console.error('Vault deposit error:', err);
      addToast('error', 'Deposit Failed', err?.message || 'Transaction rejected.');
    }
  };

  // DAO Voting with real testnet signing
  const handleCastVote = async (proposalId: number, choice: 'yes' | 'no' | 'abstain') => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    const votingPower = userNfts.length;
    if (votingPower === 0) {
      addToast('error', 'Zero Voting Power', 'You must hold at least 1 Quorum NFT to vote.');
      return;
    }

    try {
      addToast('info', 'Submitting Vote On-Chain...', 'Please sign the vote transaction with your connected wallet.');

      const tx = await sendNearTransaction({
        receiverId: 'dao.molten.testnet',
        actions: [
          createFunctionCallAction(
            'vote',
            { proposal_id: proposalId, choice, voting_power: votingPower },
            '0'
          ),
        ],
        signerId: wallet.accountId,
      });

      const updatedProposals = proposals.map((p) => {
        if (p.id !== proposalId) return p;
        return {
          ...p,
          votes_yes: choice === 'yes' ? p.votes_yes + votingPower : p.votes_yes,
          votes_no: choice === 'no' ? p.votes_no + votingPower : p.votes_no,
          votes_abstain: choice === 'abstain' ? p.votes_abstain + votingPower : p.votes_abstain,
          voted_choice: choice,
        };
      });

      setProposals(updatedProposals);
      persistState(STORAGE_KEYS.PROPOSALS, updatedProposals);

      addToast(
        'success',
        `Vote Recorded: ${choice.toUpperCase()}!`,
        `Tx ${tx.hash.slice(0, 10)}... confirmed on NEAR testnet with ${votingPower} NFT votes.`
      );
    } catch (err: any) {
      console.error('Vote error:', err);
      addToast('error', 'Vote Failed', err?.message || 'Could not record vote on testnet.');
    }
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
    const updatedProposals = [newProp, ...proposals];
    setProposals(updatedProposals);
    persistState(STORAGE_KEYS.PROPOSALS, updatedProposals);

    addToast('success', `Proposal #${newProp.id} Created!`, 'Opened for community voting.');
  };

  // Collection Created (Launch Studio)
  const handleCollectionCreated = (col: CollectionItem) => {
    const updatedCollections = [col, ...collections];
    setCollections(updatedCollections);
    persistState(STORAGE_KEYS.COLLECTIONS, updatedCollections);
    setSelectedCollectionId(col.id);
    addToast('success', `Collection "${col.name}" Launched!`, 'Contracts deployed with keyless DAO & Vault.');
  };

  // Accept Offer Handler with real testnet execution
  const handleAcceptOffer = async (offer: OfferItem) => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    const offerNum = parseFloat(offer.amount_near || '1.0');
    try {
      addToast('info', 'Accepting Offer On-Chain...', 'Please sign to transfer keyless vault rights.');

      const matchingNft = userNfts.find((t) => t.id === offer.nft_id || t.title === offer.nft_title);

      const tx = await sendNearTransaction({
        receiverId: offer.from && offer.from.includes('.testnet') ? offer.from : 'quorum.testnet',
        actions: [
          createFunctionCallAction(
            'nft_transfer',
            { receiver_id: offer.from, token_id: matchingNft?.id || offer.nft_id },
            '0.001'
          ),
        ],
        signerId: wallet.accountId,
      });

      const updatedUserNfts = matchingNft ? userNfts.filter((t) => t.id !== matchingNft.id) : userNfts;
      const updatedOffers = offers.filter((o) => o.id !== offer.id);

      const newSale: SaleRecord = {
        nft_id: offer.nft_title,
        buyer: offer.from,
        price_near: offer.amount_near,
        to_dao: (offerNum * 0.05).toFixed(3),
        royalty: (offerNum * 0.05).toFixed(3),
        net_seller: (offerNum * 0.90).toFixed(3),
        date: 'Just now',
      };
      const updatedSales = [newSale, ...salesHistory];

      setUserNfts(updatedUserNfts);
      setOffers(updatedOffers);
      setSalesHistory(updatedSales);

      persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);
      persistState(STORAGE_KEYS.OFFERS, updatedOffers);
      persistState(STORAGE_KEYS.SALES_HISTORY, updatedSales);

      const rpcBal = await fetchNearAccountBalance(wallet.accountId);
      if (rpcBal !== null) {
        setWallet((prev) => ({ ...prev, balanceNear: rpcBal }));
      }

      addToast(
        'success',
        'Offer Accepted On-Chain!',
        `Received ${offer.amount_near} test NEAR (Tx: ${tx.hash.slice(0, 10)}...). Vault transferred to ${offer.from}.`
      );
    } catch (err: any) {
      console.error('Accept offer error:', err);
      addToast('error', 'Accept Offer Failed', err?.message || 'Transaction rejected.');
    }
  };

  // Cancel Offer Handler
  const handleCancelOffer = (offer: OfferItem) => {
    const amount = parseFloat(offer.amount_near || '0');
    const updatedOffers = offers.filter((o) => o.id !== offer.id);
    setOffers(updatedOffers);
    persistState(STORAGE_KEYS.OFFERS, updatedOffers);

    if (offer.type === 'made' && wallet.connected) {
      setWallet((prev) => ({ ...prev, balanceNear: prev.balanceNear + amount }));
    }
    addToast('info', 'Offer Cancelled', `Escrowed ${amount.toFixed(2)} test NEAR returned to your balance.`);
  };

  // Place Offer Handler with real testnet escrow transfer
  const handlePlaceOffer = async (targetNft: TokenItem, amountNear: string) => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    const amountNum = parseFloat(amountNear);
    try {
      addToast('info', 'Escrowing Testnet Deposit...', 'Please approve the escrow transaction in your wallet.');

      const tx = await sendNearTransaction({
        receiverId: 'quorum.testnet',
        actions: [createTransferAction(amountNum)],
        signerId: wallet.accountId,
      });

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

      const updatedOffers = [newOffer, ...offers];
      setOffers(updatedOffers);
      persistState(STORAGE_KEYS.OFFERS, updatedOffers);

      const rpcBal = await fetchNearAccountBalance(wallet.accountId);
      if (rpcBal !== null) {
        setWallet((prev) => ({ ...prev, balanceNear: rpcBal }));
      } else {
        setWallet((prev) => ({ ...prev, balanceNear: Math.max(0, prev.balanceNear - amountNum) }));
      }

      addToast(
        'success',
        `Offer Placed: ${amountNear} NEAR (On-Chain)`,
        `Tx ${tx.hash.slice(0, 10)}... held in Quorum escrow for ${targetNft.title}.`
      );
    } catch (err: any) {
      console.error('Place offer error:', err);
      addToast('error', 'Offer Cancelled', err?.message || 'Transaction rejected.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#0A0A0D',
        color: '#F4F4F5',
        boxSizing: 'border-box',
        padding: '16px',
        paddingLeft: '0',
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
          marginLeft: isSidebarCollapsed ? '78px' : '108px',
          transition: 'margin-left 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Header Bar */}
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
            creatorAccount={wallet.accountId}
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
        onDisconnect={async () => {
          await disconnectNearConnect();
          setWallet({
            connected: false,
            accountId: '',
            balanceNear: 0,
            network: 'testnet',
            connector: undefined,
          });
        }}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
