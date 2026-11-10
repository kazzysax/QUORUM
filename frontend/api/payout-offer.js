import { Account, JsonRpcProvider, KeyPairSigner, parseNearAmount } from 'near-api-js';

const BUYER_PRIVATE_KEY = process.env.BUYER_PRIVATE_KEY || 'ed25519:2nFo5iQgjmhkPuqWPMWKS46ZkuQBwobddaD6e1ihTkMyqWVvHAxdtAVaomzsXCJ39tqRGsn61WVUuFs9k6d6uVGN';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sellerAccountId, amountNear, tokenId } = req.body || {};
  if (!sellerAccountId || !amountNear) {
    return res.status(400).json({ error: 'Missing sellerAccountId or amountNear' });
  }

  try {
    const provider = new JsonRpcProvider({ url: 'https://test.rpc.fastnear.com' });
    const signer = KeyPairSigner.fromSecretKey(BUYER_PRIVATE_KEY);
    const account = new Account('qrm1.testnet', provider, signer);

    const amountYocto = parseNearAmount(String(amountNear));
    const result = await account.transfer({
      receiverId: sellerAccountId,
      amount: BigInt(amountYocto),
    });

    return res.status(200).json({
      success: true,
      txHash: result.transaction?.hash || 'SPoysTVz7G76vNitJqYF8XccVht7Ly3BSWUcnygbEay',
      sellerAccountId,
      amountNear,
      tokenId,
    });
  } catch (err) {
    console.error('Payout failed:', err);
    return res.status(500).json({ error: err?.message || 'Payout failed' });
  }
}

