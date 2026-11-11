import React, { useState, useEffect } from 'react';
import type { ProposalItem, TokenItem, CollectionItem } from '../types';
import { Check, X, Minus, CheckCircle2, Vote, Clock } from 'lucide-react';
import { getCollectionDaoAccounts, fetchLiveDaoBalances, type DaoBalances } from '../near';

interface VotingsPageProps {
  proposals: ProposalItem[];
  userNfts: TokenItem[];
  collections: CollectionItem[];
  onCastVote: (proposalId: number, choice: 'yes' | 'no' | 'abstain') => void;
  onCreateProposal?: (prop: Partial<ProposalItem> & { recipient?: string; group?: number }) => void;
  onExecute?: (proposalId: number) => void;
}

export const VotingsPage: React.FC<VotingsPageProps> = ({
  proposals,
  userNfts,
  collections,
  onCastVote,
  onCreateProposal,
  onExecute,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [votingOnId, setVotingOnId] = useState<number | null>(null);
  const [colBalances, setColBalances] = useState<Record<string, DaoBalances>>({});
  const [creatingForCol, setCreatingForCol] = useState<string | null>(null);
  const [newPropTitle, setNewPropTitle] = useState('');
  const [newPropDesc, setNewPropDesc] = useState('');
  const [newPropAmount, setNewPropAmount] = useState('1.00');
  const [newPropKind, setNewPropKind] = useState<'Spend' | 'Distribute' | 'Settle' | 'Text'>('Spend');
  const [newPropRecipient, setNewPropRecipient] = useState('');
  const [newPropGroup, setNewPropGroup] = useState('0');
  const [balError, setBalError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      const results = await Promise.all(
        collections.map(async (c) => {
          const bal = await fetchLiveDaoBalances(c.id || c.name).catch((e) => { if (mounted) setBalError(String(e?.message || e)); return null; });
          return { name: c.name, bal };
        })
      );
      if (!mounted) return;
      const map: Record<string, DaoBalances> = {};
      results.forEach((r) => {
        if (r.bal) map[r.name] = r.bal;
      });
      setColBalances(map);
    };
    fetchAll();
    return () => {
      mounted = false;
    };
  }, [collections]);

  // Group user's NFTs by collection to calculate voting power per collection
  const userNftsByCollection = userNfts.reduce((acc, nft) => {
    acc[nft.collection] = (acc[nft.collection] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Determine active collections that have proposals or are held
  const activeCollectionNames = Array.from(
    new Set([
      ...collections.map((c) => c.name),
      ...proposals.map((p) => p.collection).filter((n): n is string => !!n),
    ])
  );

  const handleQuickVote = async (proposalId: number, choice: 'yes' | 'no' | 'abstain') => {
    setVotingOnId(proposalId);
    try {
      await onCastVote(proposalId, choice);
    } finally {
      setVotingOnId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '1080px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Vote size={22} color="#F5A524" />
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Collection Votings
            </h1>
          </div>
          <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
            Each collection is an independent sovereign DAO. Only holders of that collection govern its treasury.
          </span>
        </div>

        {/* Sovereign DAO Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '999px',
            background: 'rgba(245,165,36,0.1)',
            border: '1px solid rgba(245,165,36,0.3)',
            fontSize: '13px',
            fontWeight: 600,
            color: '#FFD572',
          }}
        >
          <CheckCircle2 size={16} color="#F5A524" />
          <span>Sovereign Collection DAOs · Holder-Only Governance · 0 Cross-Bridge</span>
        </div>
      </div>

      {/* Collection Switcher Filter Tabs */}
      <div
        role="tablist"
        aria-label="Filter collection"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedFilter('all')}
          style={{
            minHeight: '38px',
            padding: '0 18px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: selectedFilter === 'all' ? '#F5A524' : '#1D1D25',
            color: selectedFilter === 'all' ? '#111113' : '#D4D4D8',
            border: selectedFilter === 'all' ? '1px solid #F5A524' : '1px solid #2A2A33',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          All Sovereign DAOs ({proposals.length})
        </button>

        {activeCollectionNames.map((colName) => {
          const power = userNftsByCollection[colName] || 0;
          const count = proposals.filter((p) => p.collection === colName).length;
          const isSelected = selectedFilter === colName;

          return (
            <button
              key={colName}
              type="button"
              onClick={() => setSelectedFilter(colName)}
              style={{
                minHeight: '38px',
                padding: '0 18px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: isSelected ? '#F5A524' : '#1D1D25',
                color: isSelected ? '#111113' : '#D4D4D8',
                border: isSelected ? '1px solid #F5A524' : '1px solid #2A2A33',
                transition: 'all 0.15s ease',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>{colName}</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: isSelected ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.08)',
                  color: isSelected ? '#111113' : '#A1A1AA',
                }}
              >
                {power > 0 ? `${power} votes held · ${count} props` : `${count} props`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ongoing Votes Grouped by Collection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {activeCollectionNames
          .filter((colName) => selectedFilter === 'all' || selectedFilter === colName)
          .map((colName) => {
            const colProposals = proposals.filter(
              (p) => p.collection === colName
            );

            const colMeta = collections.find((c) => c.name === colName);
            const userVotesInCol = userNftsByCollection[colName] || 0;
            const accounts = getCollectionDaoAccounts(colName);
            const liveBal = colBalances[colName];
            const treasuryDisplay = liveBal ? `${liveBal.treasuryBalance.toFixed(2)} NEAR Treasury` : balError ? 'treasury unavailable' : 'loading treasury…';

            return (
              <section
                key={colName}
                style={{
                  background: '#15151B',
                  border: '1px solid #2A2A33',
                  borderRadius: '24px',
                  padding: '24px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                }}
              >
                {/* Collection DAO Header */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    paddingBottom: '18px',
                    borderBottom: '1px solid #2A2A33',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {colMeta?.avatar_image && (
                      <img
                        src={colMeta.avatar_image}
                        alt=""
                        style={{ width: '48px', height: '48px', borderRadius: '14px', objectFit: 'cover' }}
                      />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#F4F4F5' }}>
                          {colName} DAO
                        </h2>
                        <span className="gold-badge" style={{ fontSize: '11px', padding: '2px 8px' }}>
                          {treasuryDisplay}
                        </span>
                        <span className="neutral-badge" style={{ fontSize: '11px', padding: '2px 8px' }}>
                          {accounts.treasuryAccount}
                        </span>
                        <span className="neutral-badge" style={{ fontSize: '11px', padding: '2px 8px' }}>
                          {accounts.daoAccount} (Gov)
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                        {colMeta?.description || `Independent community DAO backed by keyless NFT vaults on ${accounts.nftContract}.`}
                      </span>
                    </div>
                  </div>

                  {/* User's Voting Power in this specific collection */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717A' }}>
                      Your {colName} Voting Power
                    </span>
                    <strong style={{ fontSize: '18px', color: userVotesInCol > 0 ? '#F5A524' : '#71717A' }}>
                      {userVotesInCol} {userVotesInCol === 1 ? 'Vote' : 'Votes'} ({userVotesInCol} {colName} NFTs held)
                    </strong>
                    {userVotesInCol > 0 && onCreateProposal && (
                      <button
                        type="button"
                        onClick={() => setCreatingForCol(creatingForCol === colName ? null : colName)}
                        className="btn-primary"
                        style={{
                          marginTop: '4px',
                          padding: '4px 12px',
                          fontSize: '12px',
                          borderRadius: '8px',
                          minHeight: '28px',
                        }}
                      >
                        {creatingForCol === colName ? '✕ Cancel' : '+ New Proposal'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Proposal Creation Form */}
                {creatingForCol === colName && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newPropTitle.trim()) return;
                      onCreateProposal?.({
                        title: newPropTitle.trim(),
                        description: newPropDesc.trim(),
                        kind: newPropKind,
                        amount_near: `${newPropAmount || '1.00'} NEAR`,
                        collection: colName,
                        target_account: newPropRecipient || undefined,
                        recipient: newPropRecipient || undefined,
                        group: Number(newPropGroup) || 0,
                      });
                      setNewPropRecipient('');
                      setCreatingForCol(null);
                      setNewPropTitle('');
                      setNewPropDesc('');
                      setNewPropAmount('1.00');
                    }}
                    style={{
                      background: '#1D1D25',
                      border: '1px solid rgba(245,165,36,0.5)',
                      borderRadius: '16px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '15px', color: '#F4F4F5' }}>
                        Create Governance Proposal for {colName} DAO
                      </strong>
                      <span className="gold-badge" style={{ fontSize: '11px' }}>
                        DAO Treasury: {accounts.treasuryAccount}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px', gap: '10px' }}>
                      <input
                        type="text"
                        placeholder="Proposal Title (e.g. Fund Ecosystem Grant)"
                        value={newPropTitle}
                        onChange={(e) => setNewPropTitle(e.target.value)}
                        required
                        style={{
                          background: '#15151B',
                          border: '1px solid #2A2A33',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          color: '#F4F4F5',
                          fontSize: '13px',
                        }}
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Amount (NEAR)"
                        value={newPropAmount}
                        onChange={(e) => setNewPropAmount(e.target.value)}
                        style={{
                          background: '#15151B',
                          border: '1px solid #2A2A33',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          color: '#F4F4F5',
                          fontSize: '13px',
                        }}
                      />
                      <select
                        value={newPropKind}
                        onChange={(e) => setNewPropKind(e.target.value as any)}
                        style={{
                          background: '#15151B',
                          border: '1px solid #2A2A33',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          color: '#F4F4F5',
                          fontSize: '13px',
                        }}
                      >
                        <option value="Spend">Spend</option>
                        <option value="Distribute">Distribute</option>
                        <option value="Settle">Settle group</option>
                        <option value="Text">Text (signal)</option>
                      </select>
                    </div>

                    {newPropKind === 'Spend' && (
                      <input type="text" placeholder="Recipient account (e.g. alice.testnet)" value={newPropRecipient} onChange={(e) => setNewPropRecipient(e.target.value)} required
                        style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '10px', padding: '10px 12px', color: '#F4F4F5', fontSize: '13px' }} />
                    )}
                    {newPropKind === 'Settle' && (
                      <input type="number" min="0" placeholder="Asset group index" value={newPropGroup} onChange={(e) => setNewPropGroup(e.target.value)}
                        style={{ background: '#15151B', border: '1px solid #2A2A33', borderRadius: '10px', padding: '10px 12px', color: '#F4F4F5', fontSize: '13px' }} />
                    )}
                    <textarea
                      placeholder="Detailed proposal rationale and execution plan for holders to vote on..."
                      value={newPropDesc}
                      onChange={(e) => setNewPropDesc(e.target.value)}
                      rows={2}
                      style={{
                        background: '#15151B',
                        border: '1px solid #2A2A33',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        color: '#F4F4F5',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setCreatingForCol(null)}
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '13px' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newPropTitle.trim()}
                        className="btn-primary"
                        style={{ padding: '6px 18px', fontSize: '13px' }}
                      >
                        Submit to {accounts.daoAccount}
                      </button>
                    </div>
                  </form>
                )}

                {/* Proposals List for this collection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {colProposals.length === 0 ? (
                    <div
                      style={{
                        padding: '28px 20px',
                        borderRadius: '16px',
                        background: '#1D1D25',
                        border: '1px dashed #2A2A33',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#A1A1AA',
                      }}
                    >
                      <span style={{ fontSize: '15px', color: '#F4F4F5', fontWeight: 600 }}>
                        No Active Proposals in {colName} DAO
                      </span>
                      <span style={{ fontSize: '13px', maxWidth: '440px', lineHeight: 1.5 }}>
                        This sovereign DAO is ready. As a verified {colName} NFT holder, you can create the first governance proposal for {accounts.treasuryAccount}.
                      </span>
                      {userVotesInCol > 0 && creatingForCol !== colName && onCreateProposal && (
                        <button
                          type="button"
                          onClick={() => setCreatingForCol(colName)}
                          className="btn-primary"
                          style={{ marginTop: '8px', padding: '6px 16px', fontSize: '13px' }}
                        >
                          + Create First Proposal
                        </button>
                      )}
                    </div>
                  ) : (
                    (showAll[colName] ? colProposals : colProposals.slice(0, 4)).map((prop) => {
                    const totalVotes = prop.votes_yes + prop.votes_no + prop.votes_abstain;
                    const yesPercent = totalVotes > 0 ? Math.round((prop.votes_yes / totalVotes) * 100) : 0;
                    const noPercent = totalVotes > 0 ? Math.round((prop.votes_no / totalVotes) * 100) : 0;
                    const votable = prop.votable_tokens ?? [];
                    const hasVoted = prop.status !== 'Voting open' || votable.length === 0;
                    const voteNote = prop.status !== 'Voting open'
                      ? (prop.status === 'Passed' ? (prop.time_remaining === 'executed' ? 'Passed and carried out' : prop.time_remaining.startsWith('ready') ? 'Passed: ready to carry out' : 'Passed: waiting out its safety delay') : 'Voting closed')
                      : (prop.my_voted ?? 0) > 0
                        ? `Your vote is recorded on-chain (${prop.my_voted} of ${prop.my_tokens} tokens voted)`
                        : 'None of your tokens can vote here: a token must be held before the proposal opens.';
                    const isVoting = votingOnId === prop.id;

                    return (
                      <div
                        key={prop.id}
                        style={{
                          background: '#1D1D25',
                          border: '1px solid #2A2A33',
                          borderRadius: '18px',
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          transition: 'border-color 0.15s ease',
                        }}
                      >
                        {/* Proposal Meta Row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="neutral-badge" style={{ fontSize: '11px', fontWeight: 600 }}>
                              #{prop.id} · {prop.kind}
                            </span>
                            <span
                              className={prop.status === 'Voting open' ? 'success-badge' : 'gold-badge'}
                              style={{ fontSize: '11px' }}
                            >
                              ● {prop.status}
                            </span>
                          </div>

                          <span style={{ fontSize: '12px', color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={13} /> {prop.status === 'Voting open' ? `Closes in ${prop.time_remaining}` : prop.time_remaining === 'executed' ? 'Carried out' : prop.time_remaining}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#F4F4F5' }}>
                            {prop.title}
                          </h3>
                          <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5, color: '#C4C4CC' }}>
                            {prop.description}
                          </p>
                        </div>

                        {/* Swap route details if available */}
                        {prop.route && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '12px',
                              padding: '10px 14px',
                              borderRadius: '12px',
                              background: '#15151B',
                              border: '1px solid #2A2A33',
                              fontSize: '12.5px',
                              color: '#D4D4D8',
                            }}
                          >
                            <span><strong>In:</strong> {prop.near_in}</span>
                            <span><strong>Route:</strong> {prop.route}</span>
                            <span><strong>Out:</strong> {prop.quote_out}</span>
                            <span style={{ color: '#86EFAC' }}><strong>Min:</strong> {prop.min_out}</span>
                          </div>
                        )}

                        {/* Vote Results Progress Bar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#A1A1AA' }}>
                            <span style={{ color: '#F5A524' }}>
                              Yes: {prop.votes_yes} votes ({yesPercent}%)
                            </span>
                            <span style={{ color: '#93C5FD' }}>
                              No: {prop.votes_no} votes ({noPercent}%)
                            </span>
                            <span>
                              Abstain: {prop.votes_abstain}
                            </span>
                            <span style={{ color: prop.quorum_reached ? '#86EFAC' : '#A1A1AA', fontWeight: 500 }}>
                              Quorum {prop.quorum_percent}% {prop.quorum_reached ? '✓ Reached' : ''}
                            </span>
                          </div>

                          {/* Dual progress bar */}
                          <div style={{ height: '7px', borderRadius: '999px', background: '#15151B', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${yesPercent}%`, background: '#F5A524', transition: 'width 0.3s ease' }} />
                            <div style={{ width: `${noPercent}%`, background: '#93C5FD', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>

                        {prop.can_execute && onExecute && (
                          <button type="button" className="btn-primary" style={{ alignSelf: 'flex-start', padding: '8px 18px', fontSize: '13px' }} onClick={() => onExecute(prop.id)}>
                            Execute on-chain (anyone can)
                          </button>
                        )}
                        {/* Quick On-Chain Cast Vote Buttons */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '4px' }}>
                          {hasVoted ? (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 14px',
                                borderRadius: '12px',
                                background: 'rgba(74,222,128,0.1)',
                                border: '1px solid rgba(74,222,128,0.3)',
                                fontSize: '13px',
                                color: '#86EFAC',
                                fontWeight: 600,
                              }}
                            >
                              <CheckCircle2 size={16} color="#4ADE80" />
                              <span>
                                {voteNote}
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
                              <button
                                type="button"
                                disabled={isVoting || userVotesInCol === 0}
                                onClick={() => handleQuickVote(prop.id, 'yes')}
                                className="btn-primary"
                                style={{
                                  flex: '1 1 120px',
                                  minHeight: '40px',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  opacity: userVotesInCol === 0 ? 0.4 : 1,
                                  cursor: userVotesInCol === 0 ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <Check size={16} strokeWidth={2.5} />
                                {isVoting ? 'Signing on ' + accounts.daoAccount + '...' : `Vote YES (+${userVotesInCol})`}
                              </button>

                              <button
                                type="button"
                                disabled={isVoting || userVotesInCol === 0}
                                onClick={() => handleQuickVote(prop.id, 'no')}
                                className="btn-secondary"
                                style={{
                                  flex: '1 1 120px',
                                  minHeight: '40px',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  opacity: userVotesInCol === 0 ? 0.4 : 1,
                                  cursor: userVotesInCol === 0 ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <X size={16} strokeWidth={2.5} />
                                Vote NO (+${userVotesInCol})
                              </button>

                              <button
                                type="button"
                                disabled={isVoting || userVotesInCol === 0}
                                onClick={() => handleQuickVote(prop.id, 'abstain')}
                                className="btn-secondary"
                                style={{
                                  flex: '0 1 100px',
                                  minHeight: '40px',
                                  fontSize: '13px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  opacity: userVotesInCol === 0 ? 0.4 : 1,
                                  cursor: userVotesInCol === 0 ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <Minus size={15} /> Abstain
                              </button>
                            </div>
                          )}

                          {userVotesInCol === 0 ? (
                            <span style={{ fontSize: '12px', color: '#F87171' }}>
                              Hold at least 1 {colName} NFT to cast votes in this DAO. Cross-collection voting is prohibited.
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#86EFAC' }}>
                              Holder Verified: You hold {userVotesInCol} {colName} NFT{userVotesInCol === 1 ? '' : 's'} on NEAR testnet (Voting Power: {userVotesInCol} vote{userVotesInCol === 1 ? '' : 's'}).
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }))}
                  {colProposals.length > 4 && (
                    <button type="button" className="btn-secondary" style={{ alignSelf: 'center', padding: '8px 18px', fontSize: '13px' }} onClick={() => setShowAll((s) => ({ ...s, [colName]: !s[colName] }))}>
                      {showAll[colName] ? 'Show fewer' : `Show ${colProposals.length - 4} older proposals`}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
};
