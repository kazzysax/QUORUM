const { Account, JsonRpcProvider, KeyPairSigner, parseNearAmount } = require('C:/Users/HP/Downloads/quorum/quorum-everything/code/node_modules/near-api-js');

async function payout() {
  const provider = new JsonRpcProvider({ url: 'https://test.rpc.fastnear.com' });
  const privateKey = 'ed25519:2nFo5iQgjmhkPuqWPMWKS46ZkuQBwobddaD6e1ihTkMyqWVvHAxdtAVaomzsXCJ39tqRGsn61WVUuFs9k6d6uVGN';
  const signer = KeyPairSigner.fromSecretKey(privateKey);

  const account = new Account('qrm1.testnet', provider, signer);

  console.log('Sending 1.80 NEAR to malekoala9992.testnet from qrm1.testnet...');
  const amount = parseNearAmount('1.80');
  const result = await account.transfer({
    receiverId: 'malekoala9992.testnet',
    amount: BigInt(amount),
  });
  console.log('PAYOUT_SUCCESS! Tx Hash:', result.transaction.hash);
}

payout().catch(console.error);
