import React, { useState } from 'react';
import type { ProposalItem, TokenItem, CollectionItem } from '../types';
import { Check, X, Minus, CheckCircle2, Vote, Clock } from 'lucide-react';

interface VotingsPageProps {
  proposals: ProposalItem[];
  userNfts: TokenItem[];
  collections: CollectionItem[];
  onCastVote: (proposalId: number, choice: 'yes' | 'no' | 'abstain') => void;
  onCreateProposal?: (prop: Partial<ProposalItem>) => void;
}

export const VotingsPage: React.FC<VotingsPageProps> = ({
  proposals,
  userNfts,
  collections,
  onCastVote,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [votingOnId, setVotingOnId] = useState<number | null>(null);

  // Group user's NFTs by collection to calculate voting power per collection
  const userNftsByCollection = userNfts.reduce((acc, nft) => {
    acc[nft.collection] = (acc[nft.collection] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Determine active collections that have proposals or are held
  const activeCollectionNames = Array.from(
    new Set([
      ...collections.map((c) => c.name),
      ...proposals.map((p) => p.collection || 'Molten Hours'),
    ])
  );

  const totalUserVotes = userNfts.length;

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
            Ongoing DAO proposals organized by each collection you hold.
          </span>
        </div>

        {/* Global Voting Power Badge */}
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
          <span>Your Total Voting Power: {totalUserVotes} Votes</span>
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
          All Collections ({proposals.length})
        </button>

        {activeCollectionNames.map((colName) => {
          const power = userNftsByCollection[colName] || 0;
          const count = proposals.filter((p) => (p.collection || 'Molten Hours') === colName).length;
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
                {power > 0 ? `${power} votes · ${count} props` : `${count} props`}
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
              (p) => (p.collection || 'Molten Hours') === colName
            );
            if (colProposals.length === 0) return null;

            const colMeta = collections.find((c) => c.name === colName);
            const userVotesInCol = userNftsByCollection[colName] || 0;

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#F4F4F5' }}>
                          {colName} DAO
                        </h2>
                        <span className="gold-badge" style={{ fontSize: '11px', padding: '2px 8px' }}>
                          20.00 NEAR Treasury
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                        {colMeta?.description || 'Community DAO backed by 20 keyless NFT vaults.'}
                      </span>
                    </div>
                  </div>

                  {/* User's Voting Power in this specific collection */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717A' }}>
                      Your Voting Power
                    </span>
                    <strong style={{ fontSize: '18px', color: userVotesInCol > 0 ? '#F5A524' : '#71717A' }}>
                      {userVotesInCol} {userVotesInCol === 1 ? 'Vote' : 'Votes'} ({userVotesInCol} {colName} NFTs held)
                    </strong>
                  </div>
                </div>

                {/* Proposals List for this collection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {colProposals.map((prop) => {
                    const totalVotes = prop.votes_yes + prop.votes_no + prop.votes_abstain;
                    const yesPercent = totalVotes > 0 ? Math.round((prop.votes_yes / totalVotes) * 100) : 0;
                    const noPercent = totalVotes > 0 ? Math.round((prop.votes_no / totalVotes) * 100) : 0;
                    const hasVoted = Boolean(prop.voted_choice);
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
                            <Clock size={13} /> Closes in {prop.time_remaining}
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
                                You voted {prop.voted_choice?.toUpperCase()} with {userVotesInCol} votes on testnet
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
                                  opacity: userVotesInCol === 0 ? 0.5 : 1,
                                }}
                              >
                                <Check size={16} strokeWidth={2.5} />
                                {isVoting ? 'Signing...' : `Vote YES (+${userVotesInCol})`}
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
                                  opacity: userVotesInCol === 0 ? 0.5 : 1,
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
                                  opacity: userVotesInCol === 0 ? 0.5 : 1,
                                }}
                              >
                                <Minus size={15} /> Abstain
                              </button>
                            </div>
                          )}

                          {userVotesInCol === 0 && (
                            <span style={{ fontSize: '12px', color: '#A1A1AA' }}>
                              Hold at least 1 {colName} NFT to cast votes in this DAO.
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
};
