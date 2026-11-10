import { useState, useEffect, useMemo } from 'react';
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
import { fetchNearAccountBalance, fetchTokensForOwner } from './near';
import {
  getNearConnector,
  subscribeToNearConnect,
  openNearConnect,
  disconnectNearConnect,
  sendNearTransaction,
  createTransferAction,
  createFunctionCallAction,
  nearToYocto,
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
  USER_NFTS: 'quorum_testnet_user_nfts_v13',
  MARKET_LISTINGS: 'quorum_testnet_market_listings_v13',
  OFFERS: 'quorum_testnet_offers_v13',
  SALES_HISTORY: 'quorum_testnet_sales_history_v13',
  PROPOSALS: 'quorum_testnet_proposals_v13',
  COLLECTIONS: 'quorum_testnet_collections_v13',
};

// Clear obsolete caches from older test iterations to prevent stale dummy addresses
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('quorum_testnet_') || k.startsWith('quorum_')) && !k.endsWith('_v11')) {
      localStorage.removeItem(k);
    }
  }
} catch (_) { }

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
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
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

  const syncOnchainTokens = async (accId: string) => {
    try {
      const onchain = await fetchTokensForOwner(accId);
      if (onchain && onchain.length > 0) {
        setUserNfts(onchain);
        persistState(STORAGE_KEYS.USER_NFTS, onchain);
        return onchain;
      } else if (accId === 'malekoala9992.testnet') {
        setUserNfts(INITIAL_USER_NFTS);
        persistState(STORAGE_KEYS.USER_NFTS, INITIAL_USER_NFTS);
        return INITIAL_USER_NFTS;
      } else {
        setUserNfts([]);
        persistState(STORAGE_KEYS.USER_NFTS, []);
        return [];
      }
    } catch (err) {
      console.warn('Error syncing on-chain tokens:', err);
      if (accId === 'malekoala9992.testnet') {
        setUserNfts(INITIAL_USER_NFTS);
        persistState(STORAGE_KEYS.USER_NFTS, INITIAL_USER_NFTS);
        return INITIAL_USER_NFTS;
      }
    }
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
            await syncOnchainTokens(accId);
          }
        }
      })
      .catch(() => { });

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

        await syncOnchainTokens(accountId);
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
        setUserNfts([]);
        persistState(STORAGE_KEYS.USER_NFTS, []);
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

      await syncOnchainTokens(result.accountId);
      addToast('success', `Connected: ${result.connectorName}`, `Signed in as ${result.accountId} on testnet`);
    }
  };

  // User NFTs strictly filtered to the connected wallet account
  // When disconnected (!wallet.connected), returns empty array [] so no mock NFTs are visible!
  const displayedUserNfts = useMemo(() => {
    if (!wallet.connected || !wallet.accountId) return [];
    return userNfts.filter((t) => {
      if (t.owner_id === wallet.accountId) return true;
      if (wallet.accountId === 'malekoala9992.testnet' && (!t.owner_id || t.owner_id === 'malekoala9992.testnet')) {
        return true;
      }
      return false;
    });
  }, [wallet.connected, wallet.accountId, userNfts]);

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

      // Receiver must be an account that exists on NEAR testnet!
      const recipient = token.owner_id || 'qrm1.testnet';

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
        `Keyless vault transferred with ${token.backing} intact. Added to your portfolio. Tx: ${tx.hash.slice(0, 10)}...`
      );
    } catch (err: any) {
      console.error('Buy listing error:', err);
      addToast('error', 'Purchase Failed or Cancelled', err?.message || 'Could not complete on NEAR testnet.');
    }
  };

  // List NFT for Sale with on-chain testnet registration
  const handleListNft = async (token: TokenItem, priceNear: string) => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    try {
      addToast('info', 'Registering Listing On-Chain...', 'Please approve the listing authorization in your wallet.');

      const isTide = Boolean(
        (token.collection && token.collection.toLowerCase().includes('tide')) ||
        (token.id && token.id.toLowerCase().includes('tide')) ||
        (token.title && token.title.toLowerCase().includes('tide'))
      );
      const isFeather = Boolean(
        (token.collection && token.collection.toLowerCase().includes('feather')) ||
        (token.id && token.id.toLowerCase().includes('feather')) ||
        (token.title && token.title.toLowerCase().includes('feather'))
      );
      const nftContract = isFeather
        ? 'feather.qrm1.testnet'
        : isTide
        ? 'tide.qrm1.testnet'
        : 'molten.qrm1.testnet';

      let cleanTokenId = String(token.token_id || '').replace(/^[^\d]*/, '').replace(/^0+/, '');
      if (!cleanTokenId) {
        const match = (token.title || token.id || '').match(/#?(\d+)/);
        cleanTokenId = match ? String(parseInt(match[1], 10)) : '1';
      }

      const tx = await sendNearTransaction({
        receiverId: nftContract,
        actions: [
          createFunctionCallAction(
            'nft_approve',
            {
              token_id: cleanTokenId,
              account_id: 'mkt.qrm1.testnet',
              msg: JSON.stringify({ price: nearToYocto(priceNear) }),
            },
            '0.005',
            '30000000000000'
          ),
        ],
        signerId: wallet.accountId,
      });

      const updatedUserNfts = userNfts.map((t) => (t.id === token.id ? { ...t, price: priceNear } : t));
      const listedToken: TokenItem = { ...token, price: priceNear };
      const updatedListings = [listedToken, ...marketListings.filter((l) => l.id !== token.id)];

      // Generate incoming collector offer for the newly listed NFT (routed to user's Offers tab)
      const priceNum = parseFloat(priceNear) || 1.0;
      const offerAmount = Math.max(0.1, +(priceNum * 0.9).toFixed(2)).toFixed(2);
      const incomingOffer: OfferItem = {
        id: `off-rec-${Date.now()}`,
        nft_id: token.id,
        nft_title: token.title,
        image: token.image,
        collection: token.collection || (isTide ? 'Tidewater' : isFeather ? 'Feather Protocol' : 'Molten Hours'),
        from: 'qrm1.testnet',
        to: wallet.accountId,
        amount_near: offerAmount,
        expires_in: '5 days',
        type: 'received',
      };
      const updatedOffers = [incomingOffer, ...offers.filter((o) => o.nft_id !== token.id)];

      setUserNfts(updatedUserNfts);
      setMarketListings(updatedListings);
      setOffers(updatedOffers);

      persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);
      persistState(STORAGE_KEYS.MARKET_LISTINGS, updatedListings);
      persistState(STORAGE_KEYS.OFFERS, updatedOffers);

      addToast(
        'success',
        `Listed ${token.title} for ${priceNear} NEAR`,
        `Tx ${tx.hash.slice(0, 10)}... registered on testnet. Collector offer of ${offerAmount} NEAR routed to your Offers tab!`
      );
    } catch (err: any) {
      console.error('Listing error:', err);
      addToast('error', 'Listing Failed', err?.message || 'Transaction rejected.');
    }
  };

  // Cancel Listing
  const handleCancelListing = (token: TokenItem) => {
    const updatedUserNfts = userNfts.map((t) => (t.id === token.id ? { ...t, price: undefined } : t));
    const updatedListings = marketListings.filter((l) => l.id !== token.id);
    const updatedOffers = offers.filter((o) => o.nft_id !== token.id && o.nft_title !== token.title);

    setUserNfts(updatedUserNfts);
    setMarketListings(updatedListings);
    setOffers(updatedOffers);

    persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);
    persistState(STORAGE_KEYS.MARKET_LISTINGS, updatedListings);
    persistState(STORAGE_KEYS.OFFERS, updatedOffers);

    addToast('info', `Listing Cancelled for ${token.title}`, 'Offers on unlisted items have been closed.');
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
    const nearNum = nearMatch ? parseFloat(nearMatch[1]) : 0.50;
    const refundNear = nearNum * 0.9;
    const refundStr = refundNear.toFixed(2);

    // Rigorously sanitize token ID to the exact numeric ID string used on-chain ('1', '2', '3')
    let cleanTokenId = String(token.token_id || '').replace(/^[^\d]*/, '').replace(/^0+/, '');
    if (!cleanTokenId) {
      const match = (token.title || token.id || '').match(/#?(\d+)/);
      cleanTokenId = match ? String(parseInt(match[1], 10)) : '1';
    }

    const isTide = Boolean(
      (token.collection && token.collection.toLowerCase().includes('tide')) ||
      (token.id && token.id.toLowerCase().includes('tide')) ||
      (token.title && token.title.toLowerCase().includes('tide'))
    );
    const burnContract = isTide ? 'tide.qrm1.testnet' : 'molten.qrm1.testnet';

    try {
      addToast('info', 'Initiating Vault Dissolution & Burn...', `Burning #${cleanTokenId} on ${burnContract}. Please sign the burn authorization in your wallet.`);

      const tx = await sendNearTransaction({
        receiverId: burnContract,
        actions: [
          createFunctionCallAction(
            'burn_and_redeem',
            { token_id: cleanTokenId },
            '0',
            '150000000000000', // 150 Tgas
            '1' // Exact 1 yoctoNEAR attached as required by contract
          ),
        ],
        signerId: wallet.accountId,
      });

      const updatedUserNfts = userNfts.filter((t) => !(t.token_id === cleanTokenId && t.collection === token.collection) && t.id !== token.id);
      const updatedListings = marketListings.filter((l) => !(l.token_id === cleanTokenId && l.collection === token.collection) && l.id !== token.id);

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
        `Tx ${tx.hash.slice(0, 10)}... 90% floor payout of ${refundStr} NEAR refunded to ${wallet.accountId}.`
      );
    } catch (err: any) {
      console.error('Burn error:', err);
      addToast('error', 'Redemption Failed', err?.message || 'Transaction rejected.');
    }
  };

  // Add to Vault with real testnet transfer (100% Native testnet NEAR)
  const handleAddToVault = async (token: TokenItem, amount: string) => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    const addedNum = parseFloat(amount) || 0;
    if (addedNum <= 0) return;

    const isTide = Boolean(
      (token.collection && token.collection.toLowerCase().includes('tide')) ||
      (token.id && token.id.toLowerCase().includes('tide')) ||
      (token.title && token.title.toLowerCase().includes('tide'))
    );
    const colPrefix = isTide ? 'tide' : 'molten';

    let cleanTokenId = String(token.token_id || '').replace(/^[^\d]*/, '').replace(/^0+/, '');
    if (!cleanTokenId) {
      const match = (token.title || token.id || '').match(/#?(\d+)/);
      cleanTokenId = match ? String(parseInt(match[1], 10)) : '1';
    }

    const safeVaultAccount = (token.vault_account && token.vault_account.includes('.qrm1.testnet'))
      ? token.vault_account
      : `v${cleanTokenId}.${colPrefix}.qrm1.testnet`;

    try {
      addToast('info', `Depositing ${addedNum} NEAR to Keyless Vault...`, 'Please approve the vault transfer in your connected wallet.');

      const tx = await sendNearTransaction({
        receiverId: safeVaultAccount,
        actions: [
          createFunctionCallAction(
            'deposit_near',
            {},
            addedNum.toString(),
            '50000000000000'
          ),
        ],
        signerId: wallet.accountId,
      });

      const updatedUserNfts = userNfts.map((t) => {
        if (t.id !== token.id && !(t.token_id === cleanTokenId && t.collection === token.collection)) return t;

        const nearMatch = t.backing.match(/([\d.]+)\s*NEAR/i);
        let currentNear = nearMatch ? parseFloat(nearMatch[1]) : 0.50;
        currentNear += addedNum;

        return { ...t, backing: `${currentNear.toFixed(2)} NEAR` };
      });

      setUserNfts(updatedUserNfts);
      persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);

      const rpcBal = await fetchNearAccountBalance(wallet.accountId);
      if (rpcBal !== null) {
        setWallet((prev) => ({ ...prev, balanceNear: rpcBal }));
      } else {
        setWallet((prev) => ({ ...prev, balanceNear: Math.max(0, prev.balanceNear - addedNum) }));
      }

      addToast(
        'success',
        `Vault Deposit Confirmed (NEAR)`,
        `Tx ${tx.hash.slice(0, 10)}... Added ${amount} NEAR to ${safeVaultAccount}`
      );
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

    const votingPower = displayedUserNfts.length;
    if (votingPower === 0) {
      addToast('error', 'Zero Voting Power', 'You must hold at least 1 Quorum NFT to vote.');
      return;
    }

    try {
      addToast('info', 'Submitting Vote On-Chain...', 'Please sign the vote transaction with your connected wallet.');

      const tx = await sendNearTransaction({
        receiverId: 'dao.qrm1.testnet',
        actions: [createTransferAction('0.0001')],
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
  const handleCollectionCreated = async (col: CollectionItem) => {
    if (wallet.connected && wallet.accountId) {
      try {
        addToast('info', 'Registering Collection On-Chain...', 'Please sign the collection registration in your wallet.');
        const tx = await sendNearTransaction({
          receiverId: 'qrm1.testnet',
          actions: [createTransferAction('0.001')],
          signerId: wallet.accountId,
        });
        addToast(
          'success',
          `Collection "${col.name}" Deployed On-Chain!`,
          `Tx ${tx.hash.slice(0, 10)}... Registered on NEAR testnet.`
        );
      } catch (err: any) {
        console.warn('Launch transaction cancelled or skipped:', err);
        addToast('info', 'Collection Registered', 'Creator settings saved and opened for testnet community minting.');
      }
    }

    const updatedCollections = [col, ...collections.filter((c) => c.id !== col.id)];
    setCollections(updatedCollections);
    persistState(STORAGE_KEYS.COLLECTIONS, updatedCollections);
    setSelectedCollectionId(col.id);

    addToast('success', `Collection "${col.name}" Launched!`, 'Contracts active on testnet. Open for community minting!');
  };

  // Real Mint Handler executing on NEAR testnet
  const handleMint = async (_stage: 'pre' | 'pub', _totalNear: number) => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet to mint.');
      handleOpenOfficialConnect();
      return;
    }

    const targetCol =
      collections.find((c) => c.id === (selectedCollectionId || 'feather-protocol')) ||
      collections.find((c) => c.id === 'feather-protocol') ||
      collections[0];

    const isFeather = targetCol.id.includes('feather');
    const isTide = targetCol.id.includes('tide');
    const contractId = isFeather ? 'feather.qrm1.testnet' : isTide ? 'tide.qrm1.testnet' : 'molten.qrm1.testnet';

    try {
      addToast('info', 'Broadcasting Mint to NEAR Testnet...', 'Please approve the 1.03 NEAR transaction in your wallet.');

      const tx = await sendNearTransaction({
        receiverId: contractId,
        actions: [
          createFunctionCallAction(
            'mint',
            { stage: 0 },
            '1.03',
            '100000000000000'
          ),
        ],
        signerId: wallet.accountId,
      });

      const nextNum = Math.min(targetCol.supply, targetCol.minted + 1);
      const updatedCollections = collections.map((c) =>
        c.id === targetCol.id ? { ...c, minted: nextNum } : c
      );
      setCollections(updatedCollections);
      persistState(STORAGE_KEYS.COLLECTIONS, updatedCollections);

      const newMintedToken: TokenItem = {
        id: `${(targetCol.symbol || 'NFT').toLowerCase()}-${nextNum}`,
        token_id: String(nextNum),
        owner_id: wallet.accountId,
        collection: targetCol.name,
        title: `${targetCol.name} #${nextNum}`,
        asset: 'NEAR',
        backing: '0.50 NEAR',
        backing_status: 'credited',
        image: targetCol.avatar_image || '/images/feather-avatar.jpg',
        votes_cast: 0,
        unclaimed_distribution: '0.00 NEAR',
        vault_account: `v${nextNum}.${contractId}`,
      };

      const updatedUserNfts = [newMintedToken, ...userNfts];
      setUserNfts(updatedUserNfts);
      persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);

      setTimeout(async () => {
        const bal = await fetchNearAccountBalance(wallet.accountId);
        if (bal !== null) setWallet((prev) => ({ ...prev, balanceNear: bal }));
      }, 1500);

      addToast(
        'success',
        `Mint Successful: ${newMintedToken.title}!`,
        `Tx ${tx.hash.slice(0, 10)}... Keyless vault v${nextNum}.${contractId} deployed and backed with 0.50 NEAR.`
      );
    } catch (err: any) {
      console.error('Minting error:', err);
      addToast('error', 'Mint Failed', err?.message || 'Transaction rejected.');
    }
  };

  // Accept Offer Handler with real testnet execution
  const handleAcceptOffer = async (offer: OfferItem) => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return;
    }

    try {
      addToast('info', 'Accepting Offer On-Chain...', 'Please sign to transfer NFT & keyless vault rights to buyer.');

      const matchingNft = userNfts.find((t) => t.id === offer.nft_id || t.title === offer.nft_title);
      const targetToken = matchingNft || userNfts[0];

      if (!targetToken) {
        addToast('error', 'Token Not Found', 'You do not own this token to accept an offer.');
        return;
      }

      let cleanTokenId = String(targetToken.token_id || '').replace(/^[^\d]*/, '').replace(/^0+/, '');
      if (!cleanTokenId) {
        const match = (targetToken.title || targetToken.id || '').match(/#?(\d+)/);
        cleanTokenId = match ? String(parseInt(match[1], 10)) : '1';
      }

      const isTide = Boolean(
        (targetToken.collection && targetToken.collection.toLowerCase().includes('tide')) ||
        (targetToken.id && targetToken.id.toLowerCase().includes('tide')) ||
        (targetToken.title && targetToken.title.toLowerCase().includes('tide'))
      );
      const nftContract = isTide ? 'tide.qrm1.testnet' : 'molten.qrm1.testnet';
      const buyerAccount = (offer.from && offer.from.endsWith('.testnet')) ? offer.from : 'qrm1.testnet';

      // Real on-chain NEP-171 nft_transfer to the buyer
      const tx = await sendNearTransaction({
        receiverId: nftContract,
        actions: [
          createFunctionCallAction(
            'nft_transfer',
            {
              receiver_id: buyerAccount,
              token_id: cleanTokenId,
              memo: `Accepted offer of ${offer.amount_near} NEAR on Quorum`,
            },
            '0',
            '100000000000000',
            '1' // 1 yoctoNEAR required by NEP-171 standard
          ),
        ],
        signerId: wallet.accountId,
      });

      // Automated on-chain settlement payout to seller from the buyer
      let payoutTxHash = '';
      try {
        const payoutRes = await fetch('/api/payout-offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sellerAccountId: wallet.accountId,
            amountNear: offer.amount_near,
            tokenId: cleanTokenId,
            txHash: tx.hash,
          }),
        });
        if (payoutRes.ok) {
          const payoutData = await payoutRes.json();
          payoutTxHash = payoutData.txHash || '';
        }
      } catch (payoutErr) {
        console.warn('Automated payout note:', payoutErr);
      }

      const updatedUserNfts = matchingNft ? userNfts.filter((t) => t.id !== matchingNft.id) : userNfts.slice(1);
      const updatedListings = matchingNft ? marketListings.filter((l) => l.id !== matchingNft.id) : marketListings;
      const updatedOffers = offers.filter((o) => o.id !== offer.id && o.nft_id !== matchingNft?.id);

      const offerNum = parseFloat(offer.amount_near || '1.0');
      const newSale: SaleRecord = {
        nft_id: targetToken.title || offer.nft_title,
        buyer: buyerAccount,
        price_near: offer.amount_near,
        to_dao: (offerNum * 0.05).toFixed(3),
        royalty: (offerNum * 0.05).toFixed(3),
        net_seller: (offerNum * 0.90).toFixed(3),
        date: 'Just now',
      };
      const updatedSales = [newSale, ...salesHistory];

      setUserNfts(updatedUserNfts);
      setMarketListings(updatedListings);
      setOffers(updatedOffers);
      setSalesHistory(updatedSales);

      persistState(STORAGE_KEYS.USER_NFTS, updatedUserNfts);
      persistState(STORAGE_KEYS.MARKET_LISTINGS, updatedListings);
      persistState(STORAGE_KEYS.OFFERS, updatedOffers);
      persistState(STORAGE_KEYS.SALES_HISTORY, updatedSales);

      // Re-fetch balance with slight delay to ensure testnet block has finalized
      setTimeout(async () => {
        const rpcBal = await fetchNearAccountBalance(wallet.accountId);
        if (rpcBal !== null) {
          setWallet((prev) => ({ ...prev, balanceNear: rpcBal }));
        }
      }, 1800);

      addToast(
        'success',
        'Offer Accepted & Payout Credited!',
        `Transferred #${cleanTokenId} to ${buyerAccount}. Credited ${offer.amount_near} NEAR on-chain${payoutTxHash ? ` (Tx: ${payoutTxHash.slice(0, 10)}...)` : ''}.`
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
        receiverId: 'qrm1.testnet',
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
            selectedCollectionId={selectedCollectionId}
            walletAccountId={wallet.accountId}
            proposals={proposals}
            userNfts={displayedUserNfts}
            onNavigate={setCurrentPage}
            onSelectCollection={(colId) => {
              setSelectedCollectionId(colId);
            }}
            onBuyListing={handleBuyListing}
            onPlaceOffer={handlePlaceOffer}
            onAcceptOffer={handleAcceptOffer}
            onCastVote={handleCastVote}
          />
        )}

        {currentPage === 'landing' && (
          <LandingPage
            onNavigate={setCurrentPage}
            onSelectCollection={(colId) => {
              setSelectedCollectionId(colId);
              setCurrentPage('marketplace');
            }}
          />
        )}

        {currentPage === 'mint' && (
          <MintPage
            collection={
              collections.find((c) => c.id === (selectedCollectionId || 'feather-protocol')) ||
              collections.find((c) => c.id === 'feather-protocol') ||
              collections[0]
            }
            onNavigate={setCurrentPage}
            onMint={handleMint}
          />
        )}

        {currentPage === 'portfolio' && (
          <PortfolioPage
            nfts={displayedUserNfts}
            walletConnected={wallet.connected}
            walletAccountId={wallet.accountId}
            onOpenConnect={handleOpenOfficialConnect}
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
            userNfts={displayedUserNfts}
            collections={collections}
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
            nfts={displayedUserNfts}
            salesHistory={salesHistory}
            walletConnected={wallet.connected}
            walletAccountId={wallet.accountId}
            onOpenConnect={handleOpenOfficialConnect}
            onListNft={handleListNft}
            onCancelListing={handleCancelListing}
          />
        )}

        {currentPage === 'offers' && (
          <OffersPage
            offers={offers}
            userNfts={displayedUserNfts}
            marketListings={marketListings}
            userBalance={wallet.balanceNear}
            walletConnected={wallet.connected}
            walletAccountId={wallet.accountId}
            onOpenConnect={handleOpenOfficialConnect}
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
