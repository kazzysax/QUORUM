#!/bin/bash
set -e
source ~/.cargo/env 2>/dev/null

NET="network-config testnet sign-with-keychain send"

echo "=========================================================="
echo "=== TEST 2: Listing Token #4 on mkt.qrm1.testnet for 2 NEAR ==="
echo "=========================================================="
near contract call-function as-transaction molten.qrm1.testnet nft_approve json-args '{"token_id":"4","account_id":"mkt.qrm1.testnet","msg":"{\"price\":\"2000000000000000000000000\"}"}' prepaid-gas '50 Tgas' attached-deposit '0.005 NEAR' sign-as qrm1.testnet $NET

echo "=========================================================="
echo "=== TEST 3: Depositing 0.1 NEAR into Keyless Vault v4 ==="
echo "=========================================================="
near contract call-function as-transaction v4.molten.qrm1.testnet deposit_near json-args '{}' prepaid-gas '60 Tgas' attached-deposit '0.1 NEAR' sign-as qrm1.testnet $NET

echo "=== Vault Info After Deposit ==="
near contract call-function as-read-only v4.molten.qrm1.testnet vault_info json-args '{}' network-config testnet now

echo "=========================================================="
echo "=== TEST 4: Burning Token #4 and Redeeming 90% Floor ==="
echo "=========================================================="
near contract call-function as-transaction molten.qrm1.testnet burn_and_redeem json-args '{"token_id":"4"}' prepaid-gas '150 Tgas' attached-deposit '1 yoctoNEAR' sign-as qrm1.testnet $NET

echo "=== Verify Token #4 is burned / null ==="
near contract call-function as-read-only molten.qrm1.testnet nft_token json-args '{"token_id":"4"}' network-config testnet now || true

