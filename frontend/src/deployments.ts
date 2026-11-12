// The only static data in the app: WHERE the contracts live. Every number the UI shows is
// read from these contracts over RPC at runtime. Each collection has its own NFT, DAO and
// treasury contract; there is no pooled treasury or shared DAO.

export const NETWORK = 'testnet' as const;
export const EXPLORER = 'https://testnet.nearblocks.io';
// dRPC first: FastNear's free tier rate-limits (and its 429s carry no CORS headers, which browsers report as CORS errors).
export const RPC_ENDPOINTS = [
  'https://near-testnet.drpc.org',
  'https://test.rpc.fastnear.com',
  'https://rpc.testnet.near.org',
];

/** Shared secondary market. Only registered Quorum collections can list here. */
export const MARKET = 'market.qrmx-founder1.testnet';

/**
 * The collection factory. Anyone can launch a collection with one call to it; it creates the NFT, DAO and
 * treasury as keyless accounts and lists the result, which the app reads (see `syncFactoryCollections`).
 */
export const FACTORY = 'launch.qrmx-founder1.testnet';
/** Where launched collections' art lives by default (this site), when the creator gives no links of their own. */
export const SITE = 'https://quorumio.vercel.app';
/** Factory test launches that are not shown in the app. */
export const HIDDEN_SLUGS: string[] = ['launchcheck'];

export interface Deployment {
  id: string;
  slug: string;
  nft: string;
  dao: string;
  treasury: string;
  description: string;
  cover: string;
  avatar: string;
  /** When set, piece N shows `${pieceImageBase}/N` (each piece has its own picture) instead of the collection avatar. */
  pieceImageBase?: string;
}

// Relaunched 12 Nov 2026 with 20 pieces each. The first test editions (qrmx-molten, qrmx-tide,
// feather.qrmx-founder1) stay on chain with their full test history but are not shown in the app.
export const DEPLOYMENTS: Deployment[] = [
  {
    id: 'molten-hours',
    slug: 'molten',
    nft: 'molten.qrmx-founder1.testnet',
    dao: 'molten-dao.qrmx-founder1.testnet',
    treasury: 'molten-tre.qrmx-founder1.testnet',
    description: 'Amber currents caught mid-pour. Every piece holds half of its mint price in its own keyless vault and one vote in the Molten Hours DAO.',
    cover: '/images/banner-molten.jpg',
    avatar: '/images/molten-0.jpg',
  },
  {
    id: 'tidewater',
    slug: 'tide',
    nft: 'tidewater.qrmx-founder1.testnet',
    dao: 'tidewater-dao.qrmx-founder1.testnet',
    treasury: 'tidewater-tre.qrmx-founder1.testnet',
    description: 'Teal tides and gold flecks. Every piece holds half of its mint price in its own keyless vault and one vote in the Tidewater DAO.',
    cover: '/images/banner-tidewater.jpg',
    avatar: '/images/tidewater-0.jpg',
  },
  {
    id: 'feather-protocol',
    slug: 'feather',
    nft: 'feather-protocol.qrmx-founder1.testnet',
    dao: 'feather-protocol-dao.qrmx-founder1.testnet',
    treasury: 'feather-protocol-tre.qrmx-founder1.testnet',
    description: 'Weightless plumage, anchored on-chain. Every piece holds half of its mint price in its own keyless vault and one vote in the Feather Protocol DAO.',
    cover: '/images/feather-banner.jpg',
    avatar: '/images/feather-avatar.jpg',
  },
];
