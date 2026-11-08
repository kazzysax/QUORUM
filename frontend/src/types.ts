export type Page = 'marketplace' | 'landing' | 'mint' | 'portfolio' | 'governance' | 'launch' | 'sells' | 'offers';

export interface TokenItem {
  id: string;
  token_id: string;
  owner_id: string;
  collection: string;
  title: string;
  asset: string;
  backing: string; // e.g. "4.12 USDC" or "1.00 NEAR"
  backing_status: 'credited' | 'escrow';
  price?: string; // listed price in NEAR if listed
  image: string;
  votes_cast?: number;
  unclaimed_distribution?: string;
  vault_account?: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  symbol: string;
  creator: string;
  description: string;
  cover_image: string;
  avatar_image: string;
  supply: number;
  minted: number;
  price_near: string;
  floor_price_near: string;
  backing_summary: string;
  royalty_percent: number;
  change_24h: string;
  change_positive: boolean;
  status: 'live' | 'upcoming' | 'soldout';
  opens_in?: string;
  asset_weights: { asset: string; weight: number; percentage: number }[];
}

export interface ProposalItem {
  id: number;
  kind: 'Spend' | 'Distribute' | 'Settle' | 'Swap' | 'Parameter' | 'Text';
  title: string;
  description: string;
  status: 'Voting open' | 'Timelock' | 'Passed' | 'Failed';
  time_remaining: string;
  near_in?: string;
  route?: string;
  quote_out?: string;
  min_out?: string;
  votes_yes: number;
  votes_no: number;
  votes_abstain: number;
  quorum_reached: boolean;
  quorum_percent: number;
  voted_choice?: 'yes' | 'no' | 'abstain' | null;
}

export interface ActiveListing {
  nft_id: string;
  token_id: string;
  title: string;
  image: string;
  listed_date: string;
  price_near: string;
}

export interface SaleRecord {
  nft_id: string;
  buyer: string;
  price_near: string;
  to_dao: string;
  royalty: string;
  net_seller: string;
  date: string;
}

export interface OfferItem {
  id: string;
  nft_id: string;
  nft_title: string;
  image: string;
  from: string;
  amount_near: string;
  expires_in: string;
  type: 'received' | 'made';
}

export interface UserWallet {
  connected: boolean;
  accountId: string;
  balanceNear: number;
  network: 'mainnet' | 'testnet';
  connector?: string;
}

