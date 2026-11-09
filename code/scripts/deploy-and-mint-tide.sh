#!/bin/bash
set -euo pipefail
source ~/.cargo/env

NET="network-config testnet sign-with-keychain send"
RES="/mnt/c/Users/HP/Downloads/quorum/quorum-everything/code/res"
INIT_FILE="/mnt/c/Users/HP/Downloads/quorum/quorum-everything/code/scripts/tide_utf8.json"
RECEIVER="malekoala9992.testnet"

echo "=== 1. Creating account tide.qrm1.testnet ==="
near account create-account fund-myself tide.qrm1.testnet '4.5 NEAR' autogenerate-new-keypair save-to-keychain sign-as qrm1.testnet $NET

echo "=== 2. Deploying Quorum NFT to tide.qrm1.testnet ==="
near contract deploy tide.qrm1.testnet use-file "$RES/quorum_nft_opt.wasm" with-init-call new json-args "$(cat "$INIT_FILE")" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' $NET

echo "=== 3. Minting Tidewater Token #1 ==="
near contract call-function as-transaction tide.qrm1.testnet mint json-args '{"stage":0}' prepaid-gas '100 Tgas' attached-deposit '1.03 NEAR' sign-as qrm1.testnet $NET

echo "=== 4. Minting Tidewater Token #2 ==="
near contract call-function as-transaction tide.qrm1.testnet mint json-args '{"stage":0}' prepaid-gas '100 Tgas' attached-deposit '1.03 NEAR' sign-as qrm1.testnet $NET

echo "=== 5. Minting Tidewater Token #3 ==="
near contract call-function as-transaction tide.qrm1.testnet mint json-args '{"stage":0}' prepaid-gas '100 Tgas' attached-deposit '1.03 NEAR' sign-as qrm1.testnet $NET

echo "=== 6. Transferring Tidewater Token #1 to $RECEIVER ==="
near contract call-function as-transaction tide.qrm1.testnet nft_transfer json-args "{\"receiver_id\":\"$RECEIVER\",\"token_id\":\"1\"}" prepaid-gas '30 Tgas' attached-deposit '1 yoctoNEAR' sign-as qrm1.testnet $NET

echo "=== 7. Transferring Tidewater Token #2 to $RECEIVER ==="
near contract call-function as-transaction tide.qrm1.testnet nft_transfer json-args "{\"receiver_id\":\"$RECEIVER\",\"token_id\":\"2\"}" prepaid-gas '30 Tgas' attached-deposit '1 yoctoNEAR' sign-as qrm1.testnet $NET

echo "=== 8. Transferring Tidewater Token #3 to $RECEIVER ==="
near contract call-function as-transaction tide.qrm1.testnet nft_transfer json-args "{\"receiver_id\":\"$RECEIVER\",\"token_id\":\"3\"}" prepaid-gas '30 Tgas' attached-deposit '1 yoctoNEAR' sign-as qrm1.testnet $NET

echo "=== ALL TIDEWATER NFTS MINTED & TRANSFERRED TO $RECEIVER ==="

