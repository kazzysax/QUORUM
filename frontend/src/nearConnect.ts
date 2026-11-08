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
        contractId: 'quorum.testnet',
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
    // Explicitly enforce testnet on the connector
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
