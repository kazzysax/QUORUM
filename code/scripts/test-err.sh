#!/bin/bash
source ~/.cargo/env 2>/dev/null
near contract call-function as-transaction molten.qrm1.testnet burn_and_redeem json-args '{"token_id":"1"}' prepaid-gas '150 Tgas' attached-deposit '1 yoctoNEAR' sign-as qrm1.testnet network-config testnet sign-with-keychain send || true
