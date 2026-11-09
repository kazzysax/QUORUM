#!/bin/bash
set -e
source ~/.cargo/env 2>/dev/null

echo "================ PROTOCOL ACCOUNTS SUMMARY ================"
for acc in qrm1.testnet molten.qrm1.testnet tide.qrm1.testnet dao.qrm1.testnet tre.qrm1.testnet mkt.qrm1.testnet; do
  echo "--- $acc ---"
  near account view-account-summary "$acc" network-config testnet now || true
done

echo "================ VAULTS SUMMARY ================"
for v in v1.molten.qrm1.testnet v2.molten.qrm1.testnet v3.molten.qrm1.testnet v1.tide.qrm1.testnet v2.tide.qrm1.testnet v3.tide.qrm1.testnet; do
  echo "--- $v ---"
  near account view-account-summary "$v" network-config testnet now || true
done

