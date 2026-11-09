#!/bin/bash
set -e
source ~/.cargo/env

NET="network-config testnet sign-with-keychain send"

echo "=== 1. Mint Token #5 on molten.qrm1.testnet to qrm1.testnet ==="
near contract call-function as-transaction molten.qrm1.testnet mint json-args '{"stage":0}' prepaid-gas '120 Tgas' attached-deposit '1.03 NEAR' sign-as qrm1.testnet $NET

echo "=== 2. Approve mkt.qrm1.testnet for Token #5 ==="
near contract call-function as-transaction molten.qrm1.testnet nft_approve json-args '{"token_id":"5","account_id":"mkt.qrm1.testnet","msg":"{\"price\":\"2000000000000000000000000\"}"}' prepaid-gas '50 Tgas' attached-deposit '0.005 NEAR' sign-as qrm1.testnet $NET

echo "=== 3. Try burning Token #5 while approved ==="
near contract call-function as-transaction molten.qrm1.testnet burn_and_redeem json-args '{"token_id":"5"}' prepaid-gas '150 Tgas' attached-deposit '1 yoctoNEAR' sign-as qrm1.testnet $NET

echo "=== Success! ==="
