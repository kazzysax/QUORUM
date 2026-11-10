const { Account, JsonRpcProvider, KeyPairSigner, parseNearAmount } = require('C:/Users/HP/Downloads/quorum/quorum-everything/code/node_modules/near-api-js');

async function main() {
  const provider = new JsonRpcProvider({ url: 'https://test.rpc.fastnear.com' });
  const qrm1Key = 'ed25519:2nFo5iQgjmhkPuqWPMWKS46ZkuQBwobddaD6e1ihTkMyqWVvHAxdtAVaomzsXCJ39tqRGsn61WVUuFs9k6d6uVGN';
  const qrm1Signer = KeyPairSigner.fromSecretKey(qrm1Key);
  const qrm1Account = new Account('qrm1.testnet', provider, qrm1Signer);

  console.log('Testing mint on feather.qrm1.testnet from qrm1.testnet...');
  const tx = await qrm1Account.callFunction({
    contractId: 'feather.qrm1.testnet',
    methodName: 'mint',
    args: { stage: 0 },
    gas: BigInt('100000000000000'),
    deposit: BigInt(parseNearAmount('1.03')),
  });
  console.log('MINT_RESULT:', tx);
}

main().catch(console.error);

