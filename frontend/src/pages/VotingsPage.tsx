import React, { useState } from 'react';
import type { ProposalItem } from '../types';
import { Check, X } from 'lucide-react';

interface VotingsPageProps {
  proposals: ProposalItem[];
  userVotingPower: number;
  onCastVote: (proposalId: number, choice: 'yes' | 'no' | 'abstain') => void;
  onCreateProposal: (prop: Partial<ProposalItem>) => void;
}

export const VotingsPage: React.FC<VotingsPageProps> = ({
  proposals,
  userVotingPower,
  onCastVote,
  onCreateProposal,
}) => {
  const [filter, setFilter] = useState<'Active' | 'Passed' | 'All'>('Active');
  const [selectedVoteChoice, setSelectedVoteChoice] = useState<'yes' | 'no' | 'abstain'>('yes');
  const [showProposeModal, setShowProposeModal] = useState(false);

  // New proposal form state
  const [newKind, setNewKind] = useState<ProposalItem['kind']>('Spend');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const featuredProp = proposals[0];

  const filteredProposals = proposals.filter((p) => {
    if (filter === 'Active') return p.status === 'Voting open' || p.status === 'Timelock';
    if (filter === 'Passed') return p.status === 'Passed';
    return true;
  });

  const handleVoteSubmit = () => {
    if (!featuredProp) return;
    onCastVote(featuredProp.id, selectedVoteChoice);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateProposal({
      kind: newKind,
      title: newTitle,
      description: newDesc || 'Community proposal submitted by token holder.',
      status: 'Voting open',
      time_remaining: '3d 0h',
      votes_yes: userVotingPower,
      votes_no: 0,
      votes_abstain: 0,
      quorum_reached: false,
      quorum_percent: 25,
    });
    setNewTitle('');
    setNewDesc('');
    setShowProposeModal(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Title & Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>Votings</h1>
        <div role="group" aria-label="Filter proposals" style={{ display: 'flex', gap: '8px' }}>
          {(['Active', 'Passed', 'All'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              style={{
                minHeight: '36px',
                padding: '0 16px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: filter === tab ? '#F5A524' : '#1D1D25',
                color: filter === tab ? '#111113' : '#D4D4D8',
                border: filter === tab ? '1px solid #F5A524' : '1px solid #2A2A33',
                transition: 'all 0.15s ease',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left Column: Highlighted Proposal + Other Proposals */}
        <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Rhea Swap Proposal Highlight */}
          {featuredProp && (
            <section
              style={{
                background: '#15151B',
                border: '1px solid #2A2A33',
                borderRadius: '24px',
                padding: '24px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="gold-badge">{featuredProp.kind}</span>
                  <span className="success-badge">{featuredProp.status}</span>
                </div>
                <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                  Proposal #{featuredProp.id} · closes in {featuredProp.time_remaining}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '26px', lineHeight: 1.2 }}>{featuredProp.title}</h2>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#C4C4CC' }}>
                  {featuredProp.description}
                </p>
              </div>

              {featuredProp.near_in && (
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '14px', borderRadius: '14px', background: '#1D1D25' }}>
                    <dt style={{ fontSize: '12px', color: '#A1A1AA' }}>NEAR in</dt>
                    <dd style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '14px' }}>{featuredProp.near_in}</dd>
                  </div>
                  <div style={{ padding: '14px', borderRadius: '14px', background: '#1D1D25' }}>
                    <dt style={{ fontSize: '12px', color: '#A1A1AA' }}>Route</dt>
                    <dd style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '14px' }}>{featuredProp.route}</dd>
                  </div>
                  <div style={{ padding: '14px', borderRadius: '14px', background: '#1D1D25' }}>
                    <dt style={{ fontSize: '12px', color: '#A1A1AA' }}>Expected out</dt>
                    <dd style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '14px' }}>{featuredProp.quote_out}</dd>
                  </div>
                  <div style={{ padding: '14px', borderRadius: '14px', background: '#1D1D25' }}>
                    <dt style={{ fontSize: '12px', color: '#A1A1AA' }}>Minimum accepted</dt>
                    <dd style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '14px' }}>{featuredProp.min_out}</dd>
                  </div>
                </dl>
              )}

              {/* Vote Meter Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#C4C4CC' }}>Yes</span>
                    <span style={{ fontWeight: 600 }}>{featuredProp.votes_yes} votes</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#1D1D25', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, featuredProp.votes_yes)}%`, height: '100%', background: '#F5A524' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#C4C4CC' }}>No</span>
                    <span style={{ fontWeight: 600 }}>{featuredProp.votes_no} votes</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#1D1D25', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, featuredProp.votes_no)}%`, height: '100%', background: '#93C5FD' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#C4C4CC' }}>Abstain</span>
                    <span style={{ fontWeight: 600 }}>{featuredProp.votes_abstain} votes</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#1D1D25', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, featuredProp.votes_abstain)}%`, height: '100%', background: '#71717A' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#C4C4CC' }}>Quorum (10% of live supply)</span>
                    <span style={{ fontWeight: 600, color: '#86EFAC' }}>reached</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#1D1D25', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: '#86EFAC' }} />
                  </div>
                </div>
              </div>

              {/* Voter Interaction Widget */}
              <div style={{ padding: '16px', borderRadius: '16px', border: '1px solid #2A2A33', display: 'flex', flexDirection: 'column', gap: '14px', background: '#181820' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px' }}>
                  <strong style={{ fontSize: '15px' }}>Your vote</strong>
                  <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                    {userVotingPower} of your NFTs can vote · #0088 changed hands after this opened
                  </span>
                </div>
                <div role="group" aria-label="Your vote" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(['yes', 'no', 'abstain'] as const).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setSelectedVoteChoice(choice)}
                      style={{
                        flex: '1 1 100px',
                        minHeight: '48px',
                        borderRadius: '14px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: selectedVoteChoice === choice ? '#F5A524' : '#1D1D25',
                        color: selectedVoteChoice === choice ? '#111113' : '#D4D4D8',
                        border: selectedVoteChoice === choice ? '1px solid #F5A524' : '1px solid #2A2A33',
                        textTransform: 'capitalize',
                      }}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleVoteSubmit}
                  className="btn-primary"
                  style={{ minHeight: '48px', fontSize: '15px' }}
                >
                  Vote {selectedVoteChoice.toUpperCase()} with {userVotingPower} votes
                </button>
              </div>
            </section>
          )}

          {/* Other Proposals List */}
          <section
            style={{
              background: '#15151B',
              border: '1px solid #2A2A33',
              borderRadius: '24px',
              padding: '24px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Other proposals</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredProposals.slice(1).map((prop) => (
                <li
                  key={prop.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '16px',
                    borderRadius: '16px',
                    background: '#1D1D25',
                    border: '1px solid #2A2A33',
                  }}
                >
                  <span className="neutral-badge">{prop.kind}</span>
                  <strong style={{ flex: '1 1 240px', minWidth: 0, fontSize: '15px', fontWeight: 500 }}>
                    {prop.title}
                  </strong>
                  <span
                    className={
                      prop.status === 'Voting open'
                        ? 'success-badge'
                        : prop.status === 'Timelock'
                        ? 'info-badge'
                        : 'neutral-badge'
                    }
                  >
                    {prop.status} · {prop.time_remaining}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCastVote(prop.id, 'yes')}
                    className="btn-secondary"
                    style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
                  >
                    Vote
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right Column: Propose Drawer Card */}
        <section
          style={{
            background: '#15151B',
            border: '1px solid #2A2A33',
            borderRadius: '24px',
            padding: '24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            flex: '1 1 320px',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Propose</h2>
          </div>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#C4C4CC' }}>
            Any holder can open a proposal. The founder sets minimum voting periods, quorum and timelocks; you can only go above them.
          </p>
          <button
            type="button"
            onClick={() => setShowProposeModal(true)}
            className="btn-primary"
            style={{ width: '100%' }}
          >
            New proposal
          </button>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { title: 'Spend', desc: 'Pay an account from the treasury, with a stated purpose.' },
              { title: 'Distribute', desc: 'Split an amount evenly across every live NFT.' },
              { title: 'Settle', desc: "Swap one asset group's mint escrow into its asset." },
              { title: 'Swap', desc: 'Move treasury funds into another asset through Rhea.' },
              { title: 'Parameter', desc: 'Pause minting, change the DEX, raise the royalty.' },
              { title: 'Text', desc: 'A signal vote or an event, with no money attached.' },
            ].map((item) => (
              <li key={item.title} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <strong style={{ fontSize: '14px', color: '#F5A524' }}>{item.title}</strong>
                <span style={{ fontSize: '13px', lineHeight: 1.5, color: '#A1A1AA' }}>{item.desc}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Propose Modal */}
      {showProposeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '20px',
          }}
        >
          <form
            onSubmit={handleCreateSubmit}
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#15151B',
              border: '1px solid #2A2A33',
              borderRadius: '24px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Create DAO Proposal</h2>
              <button type="button" onClick={() => setShowProposeModal(false)} style={{ background: 'transparent', border: 0, color: '#A1A1AA', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
              Proposal Type
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as ProposalItem['kind'])}
                style={{
                  minHeight: '46px',
                  borderRadius: '12px',
                  border: '1px solid #2A2A33',
                  background: '#1D1D25',
                  color: '#F4F4F5',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              >
                <option value="Spend">Spend (Treasury Outflow)</option>
                <option value="Distribute">Distribute (Even NFT Dividend)</option>
                <option value="Settle">Settle (Rhea Escrow Swap)</option>
                <option value="Swap">Swap (DEX Rebalance)</option>
                <option value="Parameter">Parameter Change</option>
                <option value="Text">Text (Community Signaling)</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
              Proposal Title
              <input
                type="text"
                required
                placeholder="e.g. Disburse 20 NEAR for Community Marketing"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{
                  minHeight: '46px',
                  borderRadius: '12px',
                  border: '1px solid #2A2A33',
                  background: '#1D1D25',
                  color: '#F4F4F5',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#A1A1AA' }}>
              Description &amp; Specifications
              <textarea
                rows={3}
                placeholder="Details of the proposal, execution payload, receiver account..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid #2A2A33',
                  background: '#1D1D25',
                  color: '#F4F4F5',
                  fontSize: '14px',
                }}
              />
            </label>

            <button type="submit" className="btn-primary" style={{ minHeight: '46px' }}>
              <Check size={16} /> Submit Proposal
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
