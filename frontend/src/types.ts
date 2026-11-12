export type Page = 'marketplace' | 'landing' | 'mints' | 'portfolio' | 'governance' | 'launch' | 'offers' | 'sells';

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
  price_yocto?: string; // exact listed price, for buy transactions
  approval_id?: number;
  nft_contract?: string;
  is_on_chain?: boolean;
}

export interface CollectionStats {
  floorPrice: string;
  floorChange1D: string;
  topOffer: string;
  volume24H: string;
  totalVolume: string;
  listedCount: number;
  listedPercent: number;
  uniqueOwnersCount: number;
  uniqueOwnersPercent: number;
  contractId: string;
  createdDate: string;
  royaltyPercent: number;
}

export interface CollectionTrait {
  name: string;
  category: string;
  rarityPercent: number;
  count: number;
}

export interface CollectionHolder {
  rank: number;
  accountId: string;
  tokensHeld: string[];
  count: number;
  percent: number;
  votingPower: number;
  vaultValueNear: string;
}

export interface CollectionActivity {
  id: string;
  event: 'Mint' | 'Sale' | 'Burn & Redeem' | 'List' | 'Transfer' | 'Offer';
  tokenId: string;
  title: string;
  priceNear?: string;
  from: string;
  to: string;
  date: string;
  txHash: string;
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
  stats?: CollectionStats;
}

export interface ProposalItem {
  id: number;
  collection?: string;
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
  target_account?: string;
  amount_near?: string;
  end_date?: string;
  proposer?: string;
  // Filled from the DAO contract:
  chain_id?: number;
  dao?: string;
  nft_contract?: string;
  executed?: boolean;
  can_execute?: boolean;
  my_tokens?: number;
  my_voted?: number;
  votable_tokens?: string[];
  supply?: number;
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
  seller?: string;
  collection?: string;
  price_near: string;
  to_dao: string;
  royalty: string;
  net_seller: string;
  date: string;
  tx_hash?: string;
}

export interface OfferItem {
  id: string;
  nft_id: string;
  nft_title: string;
  image: string;
  from: string;
  to?: string;
  collection?: string;
  amount_near: string;
  expires_in: string;
  type: 'received' | 'made';
  // Filled from the market contract:
  nft_contract?: string;
  token_id?: string;
  expired?: boolean;
  amount_yocto?: string;
}

export interface UserWallet {
  connected: boolean;
  accountId: string;
  balanceNear: number;
  network: 'mainnet' | 'testnet';
  connector?: string;
}

