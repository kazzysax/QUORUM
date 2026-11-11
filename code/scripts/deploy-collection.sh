#!/bin/bash
# Deploys ONE Quorum collection onto three pre-created testnet accounts (NFT, DAO, treasury),
# each collection with its OWN DAO and treasury. Run from code/.
#
#   FOUNDER=qrmx-founder1.testnet NFT=qrmx-molten.testnet DAO=qrmx-molten-dao.testnet TRE=qrmx-molten-tre.testnet \
#   NAME="Molten Hours" SYMBOL=MOLT SLUG=molten MAX_SUPPLY=8 PUBLIC_NEAR=0.5 ./scripts/deploy-collection.sh
#
# Required accounts must already exist with full-access keys in ~/.near-credentials.
# DAO voting periods here are minutes so judges can watch a proposal go from creation to
# execution; production collections should keep the default 3-5 day bounds (DAO_BOUNDS unset).
set -euo pipefail
source ~/.cargo/env 2>/dev/null || true
: "${FOUNDER:?}"; : "${NFT:?}"; : "${DAO:?}"; : "${TRE:?}"; : "${NAME:?}"; : "${SYMBOL:?}"; : "${SLUG:?}"
MAX_SUPPLY=${MAX_SUPPLY:-8}; PUBLIC_NEAR=${PUBLIC_NEAR:-0.5}
SITE=${SITE:-https://quorumio.vercel.app}
DEX=${DEX:-v2.ref-finance.testnet}; WRAP=${WRAP:-wrap.testnet}
ASSET_PLAN=${ASSET_PLAN:-$WRAP:1}
SETTLE_GRACE_DAYS=${SETTLE_GRACE_DAYS:-0.05}   # ~72 min, the contract minimum is 60 min
BOUNDS=${DAO_BOUNDS:-'[{"min_period_ms":"600000","min_quorum_bps":1000,"min_pass_bps":5000,"min_timelock_ms":"60000"},{"min_period_ms":"600000","min_quorum_bps":1000,"min_pass_bps":5000,"min_timelock_ms":"60000"},{"min_period_ms":"900000","min_quorum_bps":1500,"min_pass_bps":6000,"min_timelock_ms":"120000"},{"min_period_ms":"300000","min_quorum_bps":500,"min_pass_bps":5000,"min_timelock_ms":"0"}]'}
R=res
HASH=${HASH:?precompute with node scripts/code-hash.mjs res/quorum_vault_opt.wasm (node is not in WSL)}
SIGN="network-config testnet sign-with-legacy-keychain send"

echo "== DAO $DAO =="
near contract deploy $DAO use-file $R/quorum_dao_opt.wasm with-init-call new json-args "{\"nft\":\"$NFT\",\"treasury\":\"$TRE\",\"bounds\":$BOUNDS}" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' $SIGN
echo "== Treasury $TRE =="
near contract deploy $TRE use-file $R/quorum_treasury_opt.wasm with-init-call new json-args "{\"dao\":\"$DAO\",\"nft\":\"$NFT\",\"dex\":\"$DEX\",\"wrap\":\"$WRAP\"}" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' $SIGN
echo "== NFT $NFT =="
INIT=$(cat "${INIT_FILE:?generate with scripts/make-init.mjs and pass INIT_FILE}")
near contract deploy $NFT use-file $R/quorum_nft_opt.wasm with-init-call new json-args "$INIT" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' $SIGN
echo "DEPLOYED $NAME: nft=$NFT dao=$DAO treasury=$TRE vault_hash=$HASH"
