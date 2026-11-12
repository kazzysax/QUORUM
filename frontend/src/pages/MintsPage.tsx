import React from 'react';
import { Sparkles } from 'lucide-react';
import type { LiveCollection } from '../chain';
import { MintsPanel } from '../components/MintsPanel';

interface MintsPageProps {
  collections: LiveCollection[];
  onMint: (collectionId: string) => void;
  onOpenCollection: (collectionId: string) => void;
}

export const MintsPage: React.FC<MintsPageProps> = ({ collections, onMint, onOpenCollection }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 22, width: '100%', maxWidth: 1000 }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Sparkles size={24} color="#F5A524" />
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Mints</h1>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: '#A1A1AA', maxWidth: 640 }}>
        Mint straight from a collection while its sale is open. Half of every mint goes to that collection&apos;s DAO treasury and half is locked in your NFT&apos;s own vault.
      </p>
    </div>
    <MintsPanel collections={collections} onMint={onMint} onOpenCollection={onOpenCollection} />
  </div>
);
