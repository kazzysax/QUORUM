import { lazy, Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Page, TokenItem, ProposalItem, UserWallet, SaleRecord, CollectionHolder, OfferItem } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { WalletModal } from './components/WalletModal';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { DEPLOYMENTS, EXPLORER, MARKET } from './deployments';
import {
  GAS,
  assertTxSucceeded,
  fn,
  loadBounds,
  loadCollection,
  holdersOf,
  loadMarketListings,
  loadOffers,
  loadOwnedTokens,
  loadPendingPayouts,
  unregisteredTokens,
  loadPieces,
  loadProposals,
  loadSales,
  nearToYocto,
  uncreditedTokens,
  view,
} from './chain';
import type { LiveCollection, LiveProposal, PendingPayout } from './chain';
import { fetchNearAccountBalance } from './near';
import {
  getNearConnector,
  subscribeToNearConnect,
  openNearConnect,
  disconnectNearConnect,
  sendNearTransaction,
} from './nearConnect';

import { MarketplacePage } from './pages/MarketplacePage';
// The home (market) page loads with the app; every other page is fetched only when opened.
const MintsPage = lazy(() => import('./pages/MintsPage').then((m) => ({ default: m.MintsPage })));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage').then((m) => ({ default: m.PortfolioPage })));
const VotingsPage = lazy(() => import('./pages/VotingsPage').then((m) => ({ default: m.VotingsPage })));
const LaunchPage = lazy(() => import('./pages/LaunchPage').then((m) => ({ default: m.LaunchPage })));
const SellsPage = lazy(() => import('./pages/SellsPage').then((m) => ({ default: m.SellsPage })));
const OffersPage = lazy(() => import('./pages/OffersPage').then((m) => ({ default: m.OffersPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));

const REFRESH_MS = 30000;
const NO_WALLET: UserWallet = { connected: false, accountId: '', balanceNear: 0, network: 'testnet', connector: undefined };

/**
 * Every list and figure below is read from the NEAR testnet contracts in deployments.ts.
 * There is no mock data and no localStorage state: a reload shows exactly what the chain says.
 */
export function App() {
  const [currentPage, setCurrentPage] = useState<Page>('marketplace');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [wallet, setWallet] = useState<UserWallet>(NO_WALLET);

  const [collections, setCollections] = useState<LiveCollection[]>([]);
  const [marketListings, setMarketListings] = useState<TokenItem[]>([]);
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [userNfts, setUserNfts] = useState<TokenItem[]>([]);
  const [proposals, setProposals] = useState<LiveProposal[]>([]);
  const [holders, setHolders] = useState<Record<string, CollectionHolder[]>>({});
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [pieces, setPieces] = useState<TokenItem[]>([]);
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [sync, setSync] = useState<{ loading: boolean; error: string | null; at: number | null }>({ loading: true, error: null, at: null });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const busy = useRef(false);
  const rerun = useRef(false);

  const addToast = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 7000);
  };
  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // ---------------------------------------------------------------- chain sync
  const accountRef = useRef('');
  accountRef.current = wallet.accountId;
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedCollectionId;

  const pageRef = useRef<Page>('marketplace');
  pageRef.current = currentPage;

  /**
   * Loads in stages so the screen fills in quickly:
   *  1. each collection appears the moment its own contract reads finish;
   *  2. then only the data the current screen needs, in parallel, each piece shown as it arrives
   *     (proposals only for Votings or a collection page, payouts only for Portfolio, and so on).
   */
  const refresh = useCallback(async () => {
    // A request for fresh data that arrives mid-refresh (e.g. picking a collection) is run right after, not dropped.
    if (busy.current) { rerun.current = true; return; }
    busy.current = true;
    try {
      const loaded: (LiveCollection | undefined)[] = DEPLOYMENTS.map(() => undefined);
      await Promise.all(DEPLOYMENTS.map(async (d, i) => {
        loaded[i] = await loadCollection(d);
        setCollections(loaded.filter((x): x is LiveCollection => !!x));
        setHolders(Object.fromEntries(loaded.filter((x): x is LiveCollection => !!x).map((x) => [x.id, holdersOf(x)])));
        setSync({ loading: false, error: null, at: Date.now() });
      }));
      const cols = loaded as LiveCollection[];
      const account = accountRef.current;
      const page = pageRef.current;
      const selected = cols.find((x) => x.id === selectedRef.current);

      const owned = account ? loadOwnedTokens(account, cols) : Promise.resolve([] as TokenItem[]);
      const jobs: Promise<unknown>[] = [
        loadMarketListings(cols).then(setMarketListings),
        loadSales(cols).then(setSalesHistory),
        owned.then(setUserNfts),
      ];
      if (selected) jobs.push(loadPieces(selected).then(setPieces));
      if (page === 'governance' || selected) {
        jobs.push(owned.then((o) => Promise.all(cols.map((x) =>
          loadProposals(x.dep, x.name, o.filter((t) => t.nft_contract === x.dep.nft).map((t) => t.token_id))))).then((p) => setProposals(p.flat())));
      }
      if (account && (page === 'offers' || selected)) jobs.push(loadOffers(cols, account).then(setOffers));
      if (account && page === 'portfolio') jobs.push(loadPendingPayouts(cols, account).then(setPayouts));
      if (account) jobs.push(fetchNearAccountBalance(account).then((bal) => setWallet((w) => (w.accountId === account ? { ...w, balanceNear: bal } : w))));
      const results = await Promise.allSettled(jobs);
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      setSync({ loading: false, error: failed ? String(failed.reason?.message || failed.reason) : null, at: Date.now() });
    } catch (e: any) {
      setSync((s) => ({ ...s, loading: false, error: e?.message || String(e) }));
    } finally {
      busy.current = false;
      if (rerun.current) { rerun.current = false; refresh(); }
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => { refresh(); }, [wallet.accountId, selectedCollectionId, currentPage, refresh]);

  // ----------------------------------------------------------------- wallet
  useEffect(() => {
    let alive = true;
    getNearConnector()
      .wallet()
      .then(async (w) => {
        if (!alive || !w) return;
        const accounts = await w.getAccounts({ network: 'testnet' }).catch(() => []);
        const accountId = accounts?.[0]?.accountId;
        if (accountId && alive) {
          setWallet({ connected: true, accountId, balanceNear: 0, network: 'testnet', connector: (w as any).id || (w as any).name || 'hot-connect' });
        }
      })
      .catch(() => { });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNearConnect(
      async ({ accountId, connectorName }) => {
        setWallet({ connected: true, accountId, balanceNear: 0, network: 'testnet', connector: connectorName });
        addToast('success', `Connected: ${connectorName}`, `Signed in as ${accountId} on testnet`);
      },
      () => {
        setWallet(NO_WALLET);
        setUserNfts([]);
        addToast('info', 'Disconnected', 'Wallet has been signed out.');
      }
    );
    return () => unsubscribe();
  }, []);

  const handleOpenOfficialConnect = async () => {
    await openNearConnect();
  };

  const requireWallet = (): string | null => {
    if (!wallet.connected || !wallet.accountId) {
      addToast('info', 'Connect Wallet', 'Please connect your NEAR testnet wallet first.');
      handleOpenOfficialConnect();
      return null;
    }
    return wallet.accountId;
  };

  /** Signs, submits, then checks the chain: a hash alone is not success (cross-contract receipts can fail). */
  const run = async (title: string, receiverId: string, actions: any[]): Promise<string | null> => {
    const signer = requireWallet();
    if (!signer) return null;
    try {
      addToast('info', title, 'Approve the transaction in your wallet…');
      const tx = await sendNearTransaction({ receiverId, actions, signerId: signer });
      addToast('info', 'Submitted', `Verifying ${tx.hash.slice(0, 10)}… on-chain`);
      await assertTxSucceeded(tx.hash, signer);
      addToast('success', `${title}: confirmed`, `${EXPLORER}/txns/${tx.hash}`);
      await refresh();
      return tx.hash;
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/is not registered/.test(msg)) {
        addToast('info', `${title}: done, payout waiting`, 'Your NFT was burned but the payout is waiting because your wallet is not set up to receive that token. Open Portfolio, then Payouts waiting, and press Claim.');
        await refresh();
      } else {
        addToast('error', `${title} failed`, msg);
      }
      return null;
    }
  };

  const depFor = (token: TokenItem) => {
    const d = DEPLOYMENTS.find((x) => x.nft === token.nft_contract);
    if (!d) throw new Error(`Unknown collection contract ${token.nft_contract}`);
    return d;
  };

  // -------------------------------------------------------------- marketplace
  const handleBuyListing = async (token: TokenItem) => {
    if (!token.price_yocto || token.approval_id === undefined) {
      addToast('error', 'Not a live listing', 'This token has no verified on-chain listing.');
      return;
    }
    await run(`Buy ${token.title}`, MARKET, [
      fn('buy', { nft: token.nft_contract, token_id: token.token_id, approval_id: token.approval_id }, token.price_yocto, GAS.buy),
    ]);
  };

  const handleListNft = async (token: TokenItem, priceNear: string) => {
    const dep = depFor(token);
    await run(`List ${token.title}`, dep.nft, [
      fn('nft_approve', { token_id: token.token_id, account_id: MARKET, msg: JSON.stringify({ price: nearToYocto(priceNear) }) }, '10000000000000000000000', GAS.approve),
    ]);
  };

  const handleCancelListing = async (token: TokenItem) => {
    const dep = depFor(token);
    await run(`Cancel listing ${token.title}`, MARKET, [fn('cancel', { nft: dep.nft, token_id: token.token_id }, '0', GAS.call)]);
  };

  // -------------------------------------------------------------------- mint
  const handleMint = async (collectionId: string) => {
    const col = collections.find((c) => c.id === collectionId);
    if (!col) { addToast('error', 'Nothing to mint', 'No collection is open for minting.'); return; }
    if (col.activeStage === null || !col.mintCostYocto) { addToast('error', 'Mint closed', `${col.name} has no active mint stage.`); return; }
    await run(`Mint ${col.name}`, col.dep.nft, [fn('mint', { stage: col.activeStage, proof: null }, col.mintCostYocto, GAS.mint)]);
  };

  // ------------------------------------------------------------------ offers
  const handlePlaceOffer = async (token: TokenItem, amountNear: string) => {
    const dep = depFor(token);
    await run(`Offer ${amountNear} NEAR on ${token.title}`, MARKET, [
      fn('make_offer', { nft: dep.nft, token_id: token.token_id, expires_in_ms: 7 * 86400000 }, nearToYocto(amountNear), GAS.call),
    ]);
  };

  const handleCancelOffer = async (offer: OfferItem) => {
    await run('Withdraw offer', MARKET, [fn('cancel_offer', { nft: offer.nft_contract, token_id: offer.token_id }, '0', GAS.call)]);
  };

  /** The owner accepts by approving the market with an accept_offer message: one transaction sells the NFT. */
  const handleAcceptOffer = async (offer: OfferItem) => {
    await run(`Accept ${offer.amount_near} NEAR for ${offer.nft_title}`, offer.nft_contract!, [
      fn('nft_approve', { token_id: offer.token_id, account_id: MARKET, msg: JSON.stringify({ accept_offer: offer.from }) }, '10000000000000000000000', GAS.buy),
    ]);
  };

  // --------------------------------------------------------------- portfolio
  const handleClaimSingle = async (token: TokenItem) => {
    const dep = depFor(token);
    await run(`Claim distribution ${token.title}`, dep.nft, [fn('claim_distribution', { token_id: token.token_id, asset: 'near' }, '0', GAS.claim)]);
  };

  const handleClaimAll = async () => {
    for (const dep of DEPLOYMENTS) {
      const owing = userNfts.filter((t) => t.nft_contract === dep.nft && parseFloat(t.unclaimed_distribution || '0') > 0);
      if (!owing.length) continue;
      await run(`Claim ${owing.length} distribution(s)`, dep.nft,
        owing.map((t) => fn('claim_distribution', { token_id: t.token_id, asset: 'near' }, '0', GAS.claim)));
    }
  };

  /** Registers the signed-in wallet on a token it must be able to receive (one small refundable-style storage fee). */
  const ensureRegistered = async (assets: string[]): Promise<boolean> => {
    const me = wallet.accountId;
    const need = await unregisteredTokens(assets, me);
    for (const n of need) {
      const ok = await run(`Set up your wallet for ${n.token}`, n.token, [fn('storage_deposit', { account_id: me, registration_only: true }, n.deposit, GAS.call)]);
      if (!ok) return false;
    }
    return true;
  };

  const handleBurnToken = async (token: TokenItem) => {
    const dep = depFor(token);
    if (!requireWallet()) return;
    try {
      // The payout is paid from the vault; if it holds a token (not plain NEAR) the wallet must be registered on it first.
      const vault = await view<{ balances: [string, string][] }>(token.vault_account!, 'vault_info');
      const traits = await view<{ asset: string; credited: boolean } | null>(dep.nft, 'nft_traits', { token_id: token.token_id });
      const assets = [...vault.balances.map((b) => b[0]), ...(traits && traits.credited ? [] : [])];
      if (!(await ensureRegistered(assets))) return;
    } catch (e: any) {
      addToast('error', 'Could not prepare the burn', e?.message || String(e));
      return;
    }
    await run(`Burn ${token.title}`, dep.nft, [fn('burn_and_redeem', { token_id: token.token_id }, '1', GAS.burn)]);
  };

  /** Claims a payout parked in a vault: register on the token if needed, then retry (anyone may; it can only go to the holder). */
  const handleClaimPayout = async (p: PendingPayout) => {
    if (!requireWallet()) return;
    if (!(await ensureRegistered(p.items.map((i) => i.asset)))) return;
    await run(`Claim payout from ${p.collection} #${p.tokenId}`, p.vault, [fn('retry_pending', {}, '0', GAS.execute)]);
  };

  const handleAddToVault = async (token: TokenItem, amount: string) => {
    if (!token.vault_account) { addToast('error', 'No vault', 'This token has no vault account.'); return; }
    await run(`Add ${amount} NEAR to vault`, token.vault_account, [fn('deposit_near', {}, nearToYocto(amount), GAS.call)]);
  };

  /** Credits every uncredited vault of a settled (or fallback) group, 3 per transaction. */
  const handleCredit = async (collectionId: string, group: number) => {
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return;
    const ids = await uncreditedTokens(col.dep, group);
    if (!ids.length) { addToast('info', 'Nothing to credit', 'Every vault in this group is already credited.'); return; }
    for (let i = 0; i < ids.length; i += 3) {
      const ok = await run(`Credit vaults ${ids.slice(i, i + 3).join(', ')}`, col.dep.nft, [fn('credit_batch', { group, token_ids: ids.slice(i, i + 3) }, '0', GAS.execute)]);
      if (!ok) return;
    }
  };

  /** A wNEAR group settles without a vote: anyone wraps the escrow 1:1 once the mint is over. */
  const handleSettleWnear = async (collectionId: string, group: number) => {
    const col = collections.find((c) => c.id === collectionId);
    if (col) await run('Convert the escrow to wNEAR', col.dep.nft, [fn('settle_group', { group, hops: [], min_out: '0' }, '0', GAS.execute)]);
  };

  const handleEnableFallback = async (collectionId: string, group: number) => {
    const col = collections.find((c) => c.id === collectionId);
    if (col) await run('Enable NEAR fallback settlement', col.dep.nft, [fn('enable_fallback', { group }, '0', GAS.call)]);
  };

  const handleAbortSwap = async (collectionId: string, group: number) => {
    const col = collections.find((c) => c.id === collectionId);
    if (col) await run('Abort stuck swap', col.dep.nft, [fn('abort_swap', { group }, '0', GAS.call)]);
  };

  /** Anyone can add NEAR to a collection's treasury; the DAO's holders decide how it is spent. */
  const handleDonate = async (collectionId: string, amountNear: string) => {
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return;
    await run(`Donate ${amountNear} NEAR to the ${col.name} DAO`, col.dep.treasury, [fn('donate', { memo: null }, nearToYocto(amountNear), GAS.call)]);
  };

  // -------------------------------------------------------------- governance
  const findProposal = (id: number): LiveProposal | undefined => proposals.find((p) => p.id === id);

  const handleCastVote = async (proposalId: number, choice: 'yes' | 'no' | 'abstain') => {
    const p = findProposal(proposalId);
    if (!p) { addToast('error', 'Unknown proposal', 'Reload and try again.'); return; }
    const tokens = p.votable_tokens ?? [];
    if (!tokens.length) {
      addToast('error', 'No eligible votes', 'You need an NFT of this collection that you held before the proposal opened and have not yet voted with.');
      return;
    }
    const code = choice === 'no' ? 0 : choice === 'yes' ? 1 : 2;
    for (let i = 0; i < tokens.length; i += 15) {
      const ok = await run(`Vote ${choice.toUpperCase()} on #${p.chain_id}`, p.nft_contract!, [
        fn('vote', { proposal_id: p.chain_id, token_ids: tokens.slice(i, i + 15), choice: code }, '0', GAS.vote),
      ]);
      if (!ok) return;
    }
  };

  const handleCreateProposal = async (propData: Partial<ProposalItem> & { recipient?: string; group?: number }) => {
    const col = collections.find((c) => c.name === propData.collection);
    if (!col) { addToast('error', 'Pick a collection', 'Proposals belong to one collection DAO.'); return; }
    const amount = (propData.amount_near || '').replace(/[^\d.]/g, '');
    let kind: unknown;
    let slot: number;
    switch (propData.kind) {
      case 'Spend':
        if (!propData.recipient) { addToast('error', 'Recipient required', 'A spend proposal needs a recipient account.'); return; }
        kind = { Spend: { recipient: propData.recipient, asset: 'near', amount: nearToYocto(amount || '1') } }; slot = 0; break;
      case 'Distribute':
        kind = { Distribute: { asset: 'near', amount: nearToYocto(amount || '1') } }; slot = 1; break;
      case 'Settle':
        kind = { Settle: { group: propData.group ?? 0, hops: [], min_out: '1' } }; slot = 0; break;
      default:
        kind = 'Text'; slot = 3;
    }
    const b = (await loadBounds(col.dep))[slot];
    await run(`Propose on ${col.name}`, col.dep.nft, [
      fn('propose', {
        kind,
        purpose: propData.title || 'Untitled proposal',
        voting_period_ms: b.min_period_ms,
        quorum_bps: Math.max(b.min_quorum_bps, 5000), // the DAO requires at least half of all NFTs to vote
        pass_bps: b.min_pass_bps,
        timelock_ms: b.min_timelock_ms,
      }, '0', GAS.propose),
    ]);
  };

  const handleExecute = async (proposalId: number) => {
    const p = findProposal(proposalId);
    if (!p) return;
    await run(`Execute proposal #${p.chain_id}`, p.dao!, [fn('execute', { proposal_id: p.chain_id }, '0', GAS.execute)]);
  };

  // ----------------------------------------------------------------- derived
  const displayedUserNfts = useMemo(
    () => (wallet.connected ? userNfts.filter((t) => t.owner_id === wallet.accountId) : []),
    [wallet.connected, wallet.accountId, userNfts]
  );

  const handleNavigate = (page: Page) => setCurrentPage(page);

  const syncBanner = sync.error ? (
    <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5', padding: '10px 14px', borderRadius: 12, fontSize: 13 }}>
      Could not reach the NEAR testnet right now. Retrying automatically…
    </div>
  ) : null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0A0D', color: '#F4F4F5', boxSizing: 'border-box', padding: '16px', paddingLeft: '0' }}>
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenWallet={() => setIsWalletOpen(true)}
        onOpenConnect={handleOpenOfficialConnect}
        walletConnected={wallet.connected}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <main
        style={{
          flex: 1, minWidth: 0, marginLeft: isSidebarCollapsed ? '78px' : '108px',
          transition: 'margin-left 0.22s cubic-bezier(0.16, 1, 0.3, 1)', display: 'flex', flexDirection: 'column', gap: '16px',
        }}
      >
        <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        {syncBanner}

        <Suspense fallback={<div style={{ padding: '40px 8px', color: '#71717A', fontSize: 14 }}>Loading…</div>}>
        <div key={currentPage} className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {currentPage === 'marketplace' && (
          <MarketplacePage
            collections={collections}
            listings={marketListings}
            selectedCollectionId={selectedCollectionId}
            walletAccountId={wallet.accountId}
            proposals={proposals}
            userNfts={displayedUserNfts}
            holders={holders}
            sales={salesHistory}
            pieces={pieces}
            onPlaceOffer={handlePlaceOffer}
            onAcceptOffer={handleAcceptOffer}
            onCancelOffer={handleCancelOffer}
            onMint={handleMint}
            onDonate={handleDonate}
            onCredit={handleCredit}
            onEnableFallback={handleEnableFallback}
            onSettleWnear={handleSettleWnear}
            onAbortSwap={handleAbortSwap}
            onNavigate={setCurrentPage}
            onSelectCollection={(colId) => setSelectedCollectionId(colId)}
            onBuyListing={handleBuyListing}
            onCastVote={handleCastVote}
          />
        )}

        {currentPage === 'landing' && (
          <LandingPage
            onNavigate={setCurrentPage}
            onSelectCollection={(colId) => { setSelectedCollectionId(colId); setCurrentPage('marketplace'); }}
          />
        )}

        {currentPage === 'mints' && (
          <MintsPage
            collections={collections}
            onMint={handleMint}
            onOpenCollection={(id) => { setSelectedCollectionId(id); setCurrentPage('marketplace'); }}
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
            payouts={payouts}
            onClaimPayout={handleClaimPayout}
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
            onExecute={handleExecute}
          />
        )}

        {currentPage === 'launch' && <LaunchPage onNavigate={setCurrentPage} collections={collections} onOpenCollection={setSelectedCollectionId} />}

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
        </div>
        </Suspense>
      </main>

      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        wallet={wallet}
        onUpdateWallet={(updated) => setWallet((prev) => ({ ...prev, ...updated }))}
        onOpenConnect={handleOpenOfficialConnect}
        onDisconnect={async () => { await disconnectNearConnect(); setWallet(NO_WALLET); }}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;

// Re-exported for tests and tooling that want to read contract state the same way the UI does.
export { view };
