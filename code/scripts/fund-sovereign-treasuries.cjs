const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { Account, JsonRpcProvider, KeyPairSigner } = require('../node_modules/near-api-js');

async function main() {
  const provider = new JsonRpcProvider({ url: 'https://rpc.testnet.near.org' });
  const treKey = 'ed25519:3qC2Lap7dezXEsXtfBMZkrejaoTBS7Sjybosrtoq3fFEa2QLp8qvro3b9EotfTF1XRFwzXnrdDLTN2JFAaCrmRWv';
  const treSigner = KeyPairSigner.fromSecretKey(treKey);
  const treAccount = new Account('tre.qrm1.testnet', provider, treSigner);

  console.log('Transferring 8.50 NEAR from tre.qrm1.testnet to tre-molt.qrm1.testnet (Molten DAO Treasury)...');
  const moltTx = await treAccount.transfer({
    receiverId: 'tre-molt.qrm1.testnet',
    amount: 8500000000000000000000000n, // 8.50 NEAR
  });
  console.log('MOLT_TREASURY_FUNDED! Tx:', moltTx.transaction?.hash || moltTx);

  console.log('Transferring 8.50 NEAR from tre.qrm1.testnet to tre-tide.qrm1.testnet (Tidewater DAO Treasury)...');
  const tideTx = await treAccount.transfer({
    receiverId: 'tre-tide.qrm1.testnet',
    amount: 8500000000000000000000000n, // 8.50 NEAR
  });
  console.log('TIDE_TREASURY_FUNDED! Tx:', tideTx.transaction?.hash || tideTx);
}

main().catch(console.error);

