#!/bin/bash
set -euo pipefail
source ~/.cargo/env

NET="network-config testnet sign-with-keychain send"
RES="/mnt/c/Users/HP/Downloads/quorum/quorum-everything/code/res"
HASH="DQALgt8fazwvRPFKdz2j5Eek9kacchwFm2vCucLDPCn8"

echo "=== Deploying DAO Contract to dao.qrm1.testnet ==="
near contract deploy dao.qrm1.testnet use-file "$RES/quorum_dao_opt.wasm" with-init-call new json-args '{"nft":"molten.qrm1.testnet","treasury":"tre.qrm1.testnet","bounds":null}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' $NET

echo "=== Deploying Treasury Contract to tre.qrm1.testnet ==="
near contract deploy tre.qrm1.testnet use-file "$RES/quorum_treasury_opt.wasm" with-init-call new json-args '{"dao":"dao.qrm1.testnet","nft":"molten.qrm1.testnet","dex":"v2.ref-finance.testnet","wrap":"wrap.testnet"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' $NET

echo "=== Generating Quorum NFT Init Args ==="
cd /mnt/c/Users/HP/Downloads/quorum/quorum-everything/code
INIT=$(FOUNDER=qrm1.testnet TREASURY=tre.qrm1.testnet DAO=dao.qrm1.testnet VAULT_CODE_HASH="$HASH" ASSET_PLAN="near:1" PUBLIC_NEAR=1 MAX_SUPPLY=20 COLLECTION_NAME="Molten Hours" SYMBOL="MOLT" node scripts/make-init.mjs)
echo "$INIT" > /tmp/nft-init.json
cat /tmp/nft-init.json

echo "=== Deploying Quorum NFT Contract to molten.qrm1.testnet ==="
near contract deploy molten.qrm1.testnet use-file "$RES/quorum_nft_opt.wasm" with-init-call new json-args "$(cat /tmp/nft-init.json)" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' $NET

echo "=== Unpausing Molten Hours Collection ==="
near contract call-function as-transaction molten.qrm1.testnet set_paused json-args '{"paused":false}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as qrm1.testnet $NET

echo "=== Deployment Succeeded! ==="

