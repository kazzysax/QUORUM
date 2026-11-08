// NEAR Protocol Testnet RPC Helpers

export const NEAR_TESTNET_RPC = 'https://rpc.testnet.near.org';
export const NEAR_TESTNET_EXPLORER = 'https://testnet.nearblocks.io';

export async function fetchNearAccountBalance(accountId: string): Promise<number | null> {
  try {
    const res = await fetch(NEAR_TESTNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'quorum-balance-check',
        method: 'query',
        params: {
          request_type: 'view_account',
          finality: 'final',
          account_id: accountId.trim(),
        },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.result && data.result.amount) {
      // Amount is in yoctoNEAR (10^24)
      const yoctoStr = String(data.result.amount);
      if (yoctoStr.length <= 24) {
        const padded = yoctoStr.padStart(25, '0');
        const whole = padded.slice(0, padded.length - 24) || '0';
        const frac = padded.slice(padded.length - 24, padded.length - 22);
        return parseFloat(`${whole}.${frac}`);
      }
      const whole = yoctoStr.slice(0, yoctoStr.length - 24);
      const frac = yoctoStr.slice(yoctoStr.length - 24, yoctoStr.length - 22);
      return parseFloat(`${whole}.${frac}`);
    }
    return null;
  } catch {
    return null;
  }
}

