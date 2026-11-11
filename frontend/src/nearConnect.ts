import { NearConnector } from '@hot-labs/near-connect';
import nearManifest from './nearManifest.json';

let connectorInstance: NearConnector | null = null;

export function getNearConnector(): NearConnector {
  if (!connectorInstance) {
    connectorInstance = new NearConnector({
      autoConnect: false,
      network: 'testnet',
      manifest: nearManifest as unknown as {
        wallets: any[];
        version: string;
      },
      signIn: {
        contractId: 'market.qrmx-founder1.testnet',
      },
    });
  }
  return connectorInstance;
}

export interface ConnectedAccountData {
  accountId: string;
  connectorName: string;
}

export function subscribeToNearConnect(
  onSignIn: (data: ConnectedAccountData) => void,
  onSignOut?: () => void
): () => void {
  const connector = getNearConnector();

  const handleSignIn = async (payload: { accounts?: Array<{ accountId: string }> }) => {
    try {
      const accountId = payload?.accounts?.[0]?.accountId;
      if (!accountId) return;

      const wallet = await connector.wallet().catch(() => null);
      const connectorName = wallet?.manifest?.name || 'HOT Connector';

      onSignIn({ accountId, connectorName });
    } catch (err) {
      console.warn('Error handling wallet:signIn event:', err);
    }
  };

  const handleSignOut = () => {
    if (onSignOut) onSignOut();
  };

  connector.on('wallet:signIn', handleSignIn);
  if (onSignOut) {
    connector.on('wallet:signOut', handleSignOut);
  }

  return () => {
    connector.off('wallet:signIn', handleSignIn);
    if (onSignOut) {
      connector.off('wallet:signOut', handleSignOut);
    }
  };
}

export async function openNearConnect(): Promise<ConnectedAccountData | null> {
  const connector = getNearConnector();
  try {
    connector.network = 'testnet';
    const wallet = await connector.connect();
    if (!wallet) return null;

    const accounts = await wallet.getAccounts({ network: 'testnet' }).catch(() => []);
    const accountId = accounts?.[0]?.accountId;
    const connectorName = wallet.manifest?.name || 'HOT Connector';

    if (accountId) {
      return { accountId, connectorName };
    }
    return null;
  } catch (err) {
    console.log('HOT Connector modal dismissed or cancelled:', err);
    return null;
  }
}

export async function disconnectNearConnect(): Promise<void> {
  const connector = getNearConnector();
  try {
    await connector.disconnect();
  } catch (err) {
    console.warn('Error disconnecting NearConnector:', err);
  }
}

/**
 * Converts a NEAR amount (e.g. "1.00", 0.05) to yoctoNEAR (10^24) string.
 */
export function nearToYocto(nearAmount: string | number): string {
  const str = String(nearAmount).trim();
  if (str === '1yocto' || str === '1y') return '1';
  if (/^\d+$/.test(str) && str.length > 20) return str;
  const parts = str.split('.');
  const whole = parts[0] || '0';
  const fraction = (parts[1] || '').padEnd(24, '0').slice(0, 24);
  const combined = `${whole}${fraction}`.replace(/^0+/, '');
  return combined || '0';
}

/**
 * Creates a standard NEAR Transfer action object for @hot-labs/near-connect.
 */
export function createTransferAction(nearAmount: string | number) {
  return {
    type: 'Transfer',
    params: {
      deposit: nearToYocto(nearAmount),
    },
  };
}

/**
 * Creates a standard NEAR FunctionCall action object for @hot-labs/near-connect.
 */
export function createFunctionCallAction(
  methodName: string,
  args: Record<string, any> = {},
  nearDeposit: string | number = '0',
  gas: string = '30000000000000',
  exactDepositYocto?: string
) {
  return {
    type: 'FunctionCall',
    params: {
      methodName,
      args,
      gas,
      deposit: exactDepositYocto !== undefined ? exactDepositYocto : nearToYocto(nearDeposit),
    },
  };
}

/**
 * Executes an on-chain transaction through the connected wallet via HOT Connector.
 * Triggers the connected wallet's signing interface (e.g. Meteor / HOT Wallet popup).
 */
export async function sendNearTransaction(params: {
  receiverId: string;
  actions: any[];
  signerId?: string;
}): Promise<{ hash: string; success: boolean }> {
  const connector = getNearConnector();
  connector.network = 'testnet';

  let wallet: any = null;
  try {
    wallet = await connector.wallet();
  } catch {
    // If wallet is not connected, open HOT connector to let user connect first
    const connectResult = await openNearConnect();
    if (!connectResult) {
      throw new Error('Please connect your NEAR wallet to authorize this transaction.');
    }
    wallet = await connector.wallet();
  }

  if (!wallet) {
    throw new Error('No active wallet found. Please reconnect.');
  }

  const accounts = await wallet.getAccounts({ network: 'testnet' }).catch(() => []);
  const signerId = params.signerId || accounts?.[0]?.accountId;

  // Initiate real on-chain transaction approval popup
  const outcome = await wallet.signAndSendTransaction({
    receiverId: params.receiverId,
    actions: params.actions,
    signerId,
    network: 'testnet',
  });

  const txHash = outcome?.transaction?.hash || outcome?.transaction_outcome?.id;
  if (!txHash) {
    // Never invent a hash: without one nothing can be verified on-chain.
    throw new Error('The wallet did not return a transaction hash, so the result cannot be verified on-chain.');
  }

  return { hash: txHash, success: true };
}
