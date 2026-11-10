const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { Account, JsonRpcProvider, KeyPairSigner } = require('../node_modules/near-api-js');

async function main() {
  const provider = new JsonRpcProvider({ url: 'https://rpc.testnet.near.org' });

  // 1. Transfer 6.40 NEAR from tre.qrm1.testnet to tre-tide.qrm1.testnet
  const treKey = 'ed25519:3qC2Lap7dezXEsXtfBMZkrejaoTBS7Sjybosrtoq3fFEa2QLp8qvro3b9EotfTF1XRFwzXnrdDLTN2JFAaCrmRWv';
  const treSigner = KeyPairSigner.fromSecretKey(treKey);
  const treAccount = new Account('tre.qrm1.testnet', provider, treSigner);

  console.log('Transferring 6.40 NEAR from tre.qrm1.testnet to tre-tide.qrm1.testnet...');
  const tx1 = await treAccount.transfer({
    receiverId: 'tre-tide.qrm1.testnet',
    amount: 6400000000000000000000000n, // 6.40 NEAR
  });
  console.log('TX1 SUCCESS:', tx1.transaction?.hash || tx1);

  // 2. Transfer 2.10 NEAR from tide.qrm1.testnet to tre-tide.qrm1.testnet
  const tideKey = 'ed25519:mVZeVf5WLvb1zd7eekc63JFYe8GzApStDhdXNB7eR2TJ4iTVJYZwyrEB5ofUFfYPf85zoZD4kEAWD6H8f4NX5sJ';
  const tideSigner = KeyPairSigner.fromSecretKey(tideKey);
  const tideAccount = new Account('tide.qrm1.testnet', provider, tideSigner);

  console.log('Transferring 2.10 NEAR from tide.qrm1.testnet to tre-tide.qrm1.testnet...');
  const tx2 = await tideAccount.transfer({
    receiverId: 'tre-tide.qrm1.testnet',
    amount: 2100000000000000000000000n, // 2.10 NEAR
  });
  console.log('TX2 SUCCESS:', tx2.transaction?.hash || tx2);
}

main().catch(console.error);

