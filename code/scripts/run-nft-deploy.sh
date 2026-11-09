#!/bin/bash
set -euo pipefail
source ~/.cargo/env

NET="network-config testnet sign-with-keychain send"
RES="/mnt/c/Users/HP/Downloads/quorum/quorum-everything/code/res"
INIT_FILE="/mnt/c/Users/HP/Downloads/quorum/quorum-everything/code/scripts/init_utf8.json"

echo "Deploying Quorum NFT to molten.qrm1.testnet..."
near contract deploy molten.qrm1.testnet use-file "$RES/quorum_nft_opt.wasm" with-init-call new json-args "$(cat "$INIT_FILE")" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' $NET

echo "Setting unpaused..."
near contract call-function as-transaction molten.qrm1.testnet set_paused json-args '{"paused":false}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as molten.qrm1.testnet $NET

echo "SUCCESS!"
