// Thin helpers over the strict on-chain layer in chain.ts. There are no default or
// fallback figures: an unknown collection or a failed RPC call throws.

import { DEPLOYMENTS, EXPLORER } from './deployments';
import type { Deployment } from './deployments';
import { accountBalanceYocto, view } from './chain';

export const NEAR_TESTNET_EXPLORER = EXPLORER;

export function findDeployment(idOrNameOrContract?: string): Deployment | undefined {
  const k = (idOrNameOrContract || '').toLowerCase().trim();
  if (!k) return undefined;
  return DEPLOYMENTS.find((d) =>
    d.id === k || d.slug === k || d.nft === k || d.dao === k || d.treasury === k ||
    k.replace(/\s+/g, '-') === d.id || k.includes(d.slug));
}

export function getCollectionDaoAccounts(collectionIdOrName?: string): {
  treasuryAccount: string;
  daoAccount: string;
  nftContract: string;
} {
  const d = findDeployment(collectionIdOrName);
  if (!d) throw new Error(`"${collectionIdOrName}" is not a deployed Quorum collection`);
  return { treasuryAccount: d.treasury, daoAccount: d.dao, nftContract: d.nft };
}

export async function fetchNearAccountBalance(accountId: string): Promise<number> {
  const y = await accountBalanceYocto(accountId.trim());
  return Number(y / 10n ** 20n) / 10000;
}

export interface DaoBalances {
  treasuryAccount: string;
  treasuryBalance: number;
  daoAccount: string;
  daoBalance: number;
  totalBalance: number;
}

/** Treasury figure = what the treasury contract itself reports as spendable (balance minus its storage reserve). */
export async function fetchLiveDaoBalances(collectionId?: string): Promise<DaoBalances> {
  const { treasuryAccount, daoAccount } = getCollectionDaoAccounts(collectionId);
  const [spendable, dao] = await Promise.all([
    view<string>(treasuryAccount, 'native_balance'),
    accountBalanceYocto(daoAccount),
  ]);
  const treasuryBalance = Number(BigInt(spendable) / 10n ** 20n) / 10000;
  const daoBalance = Number(dao / 10n ** 20n) / 10000;
  return { treasuryAccount, treasuryBalance, daoAccount, daoBalance, totalBalance: treasuryBalance };
}
