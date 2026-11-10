#!/bin/bash
set -e
source ~/.cargo/env 2>/dev/null

NET="network-config testnet sign-with-keychain send"

echo "=== MINT Token #4 on tide.qrm1.testnet ==="
near contract call-function as-transaction tide.qrm1.testnet mint json-args '{"stage":0}' prepaid-gas '120 Tgas' attached-deposit '1.03 NEAR' sign-as qrm1.testnet $NET

echo "=== BURN Token #4 on tide.qrm1.testnet ==="
near contract call-function as-transaction tide.qrm1.testnet burn_and_redeem json-args '{"token_id":"4"}' prepaid-gas '150 Tgas' attached-deposit '1 yoctoNEAR' sign-as qrm1.testnet $NET

