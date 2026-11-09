#!/bin/bash
source ~/.cargo/env
near contract call-function as-read-only mkt.qrm1.testnet get_listing json-args '{"nft":"molten.qrm1.testnet","token_id":"1"}' network-config testnet now
