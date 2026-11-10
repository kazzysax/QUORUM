const { Account, JsonRpcProvider, KeyPairSigner } = require('C:/Users/HP/Downloads/quorum/quorum-everything/code/node_modules/near-api-js');

async function main() {
  const provider = new JsonRpcProvider({ url: 'https://test.rpc.fastnear.com' });
  const qrm1Key = 'ed25519:2nFo5iQgjmhkPuqWPMWKS46ZkuQBwobddaD6e1ihTkMyqWVvHAxdtAVaomzsXCJ39tqRGsn61WVUuFs9k6d6uVGN';
  const qrm1Signer = KeyPairSigner.fromSecretKey(qrm1Key);
  const qrm1Account = new Account('qrm1.testnet', provider, qrm1Signer);

  console.log('Transferring Token #1 to malekoala9992.testnet...');
  const tx = await qrm1Account.callFunction({
    contractId: 'feather.qrm1.testnet',
    methodName: 'nft_transfer',
    args: {
      receiver_id: 'malekoala9992.testnet',
      token_id: '1',
    },
    gas: BigInt('30000000000000'),
    deposit: 1n,
  });
  console.log('TRANSFER_SUCCESS! Tx:', tx);
}

main().catch(console.error);

