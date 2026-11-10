const fs = require('fs');
const path = require('path');
const { Account, JsonRpcProvider, KeyPairSigner } = require('C:/Users/HP/Downloads/quorum/quorum-everything/code/node_modules/near-api-js');

async function main() {
  const provider = new JsonRpcProvider({ url: 'https://test.rpc.fastnear.com' });
  const featherPrivateKey = 'ed25519:2Ng7ezUqb31UCrryPwNwV2dkirgYMFwuFTC9XQ8bfT2P1N23DoWqz3j3tT9uy71ndURugE1wTLZM5PLU3jZq8tUY';
  const featherSigner = KeyPairSigner.fromSecretKey(featherPrivateKey);
  const featherAccount = new Account('feather.qrm1.testnet', provider, featherSigner);

  // Save key to WSL credentials & code/scripts
  const creds = {
    account_id: 'feather.qrm1.testnet',
    public_key: 'ed25519:CSpRN7C4Eb2PsNCCMQctWvwfCW4mePfTrX9Rcoaa4qma',
    private_key: featherPrivateKey,
  };
  fs.writeFileSync(path.join(__dirname, 'feather-credentials.json'), JSON.stringify(creds, null, 2));

  console.log('--- Calling new() on feather.qrm1.testnet ---');
  const initPayload = {
    args: {
      metadata: {
        spec: 'nft-1.0.0',
        name: 'Feather Protocol',
        symbol: 'FEATH',
      },
      config: {
        founder: 'qrm1.testnet',
        treasury: 'tre.qrm1.testnet',
        dao: 'dao.qrm1.testnet',
        vault_allowlist: [],
        vault_code_hash: 'DQALgt8fazwvRPFKdz2j5Eek9kacchwFm2vCucLDPCn8',
        mint_storage_cost: '30000000000000000000000',
        max_supply: 20,
        stages: [
          {
            name: 'Public',
            kind: 'Public',
            price_near: '1000000000000000000000000',
            start_ms: String(Date.now() - 3600000),
            end_ms: String(Date.now() + 315360000000),
            per_wallet_limit: 20,
            merkle_root: null,
          },
        ],
        royalty_bps: 500,
        royalty_recipient: 'qrm1.testnet',
        metadata_base_url: 'https://quorumio.vercel.app/api/metadata',
        media_base_url: 'https://quorumio.vercel.app/images',
        paused: false,
        provenance_hash: null,
        asset_plan: [
          {
            token: 'wrap.testnet',
            weight: 1,
          },
        ],
        dex: 'v2.ref-finance.testnet',
        wrap_account: 'wrap.testnet',
        settle_grace_ms: '1209600000',
      },
    },
  };

  const initRes = await featherAccount.callFunction({
    contractId: 'feather.qrm1.testnet',
    methodName: 'new',
    args: initPayload,
    gas: BigInt('100000000000000'),
    deposit: 0n,
  });
  console.log('INIT_SUCCESS! Tx Hash:', initRes.transaction?.hash);

  console.log('--- Querying nft_metadata ---');
  const metadata = await provider.callFunction({
    account_id: 'feather.qrm1.testnet',
    method_name: 'nft_metadata',
    args_base64: Buffer.from('{}').toString('base64'),
    finality: 'final',
  });
  const decoded = JSON.parse(Buffer.from(metadata.result).toString('utf8'));
  console.log('Verified Live NFT Metadata on NEAR Testnet:', decoded);
}

main().catch(console.error);
