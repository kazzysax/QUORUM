#!/bin/bash
set -e
source ~/.cargo/env 2>/dev/null

NET="network-config testnet sign-with-keychain send"

echo "=== TEST 1: Minting Token #4 on molten.qrm1.testnet ==="
near contract call-function as-transaction molten.qrm1.testnet mint json-args '{"stage":0}' prepaid-gas '120 Tgas' attached-deposit '1.03 NEAR' sign-as qrm1.testnet $NET

echo "=== VERIFY: Token #4 exists and owner is qrm1.testnet ==="
near contract call-function as-read-only molten.qrm1.testnet nft_token json-args '{"token_id":"4"}' network-config testnet now

echo "=== VERIFY: Vault v4.molten.qrm1.testnet was created ==="
near account view-account-summary v4.molten.qrm1.testnet network-config testnet now || true
