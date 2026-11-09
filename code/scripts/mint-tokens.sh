#!/bin/bash
set -euo pipefail
source ~/.cargo/env

NET="network-config testnet sign-with-keychain send"
RECEIVER="malekoala9992.testnet"

echo "=== 1. Minting Token #1 ==="
near contract call-function as-transaction molten.qrm1.testnet mint json-args '{"stage":0}' prepaid-gas '100 Tgas' attached-deposit '1.03 NEAR' sign-as qrm1.testnet $NET

echo "=== 2. Minting Token #2 ==="
near contract call-function as-transaction molten.qrm1.testnet mint json-args '{"stage":0}' prepaid-gas '100 Tgas' attached-deposit '1.03 NEAR' sign-as qrm1.testnet $NET

echo "=== 3. Minting Token #3 ==="
near contract call-function as-transaction molten.qrm1.testnet mint json-args '{"stage":0}' prepaid-gas '100 Tgas' attached-deposit '1.03 NEAR' sign-as qrm1.testnet $NET

echo "=== 4. Transferring Token #1 to $RECEIVER ==="
near contract call-function as-transaction molten.qrm1.testnet nft_transfer json-args "{\"receiver_id\":\"$RECEIVER\",\"token_id\":\"1\"}" prepaid-gas '30 Tgas' attached-deposit '1 yoctoNEAR' sign-as qrm1.testnet $NET

echo "=== 5. Transferring Token #2 to $RECEIVER ==="
near contract call-function as-transaction molten.qrm1.testnet nft_transfer json-args "{\"receiver_id\":\"$RECEIVER\",\"token_id\":\"2\"}" prepaid-gas '30 Tgas' attached-deposit '1 yoctoNEAR' sign-as qrm1.testnet $NET

echo "=== 6. Transferring Token #3 to $RECEIVER ==="
near contract call-function as-transaction molten.qrm1.testnet nft_transfer json-args "{\"receiver_id\":\"$RECEIVER\",\"token_id\":\"3\"}" prepaid-gas '30 Tgas' attached-deposit '1 yoctoNEAR' sign-as qrm1.testnet $NET

echo "=== DONE! Tokens 1, 2, 3 minted and transferred to $RECEIVER ==="

