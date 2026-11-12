#!/bin/sh
# Deploys one Quorum collection. NETWORK=testnet (default) or NETWORK=mainnet.
# MAINNET SPENDS REAL NEAR AND PUBLISHES AN IMMUTABLE VAULT: read docs/MAINNET.md first.
#
#   testnet: FOUNDER=you.testnet PREFIX=quorum1 ASSET_PLAN=<token>:<weight>,... ./scripts/deploy.sh
#   mainnet: NETWORK=mainnet CONFIRM_MAINNET=yes FOUNDER=you.near PREFIX=quorum1 ASSET_PLAN=<token>:<weight>,... ./scripts/deploy.sh
#
# The near-cli-rs syntax below comes from its docs and has not been run by the authors:
# if a line errors, `near <command> --help` shows the current form.
set -eu
NETWORK=${NETWORK:-testnet}
: "${FOUNDER:?}"; : "${PREFIX:?}"
if [ "$NETWORK" = "mainnet" ]; then
  [ "${CONFIRM_MAINNET:-}" = "yes" ] || { echo "Refusing: mainnet needs CONFIRM_MAINNET=yes (and docs/MAINNET.md read)"; exit 1; }
fi
: "${ASSET_PLAN:?set ASSET_PLAN, e.g. ASSET_PLAN=usdc.token.near:2,wrap.near:1 (token:weight; see scripts/make-init.mjs)}"
DEX=${DEX:-v2.ref-finance.near}; WRAP=${WRAP:-wrap.near}
# DAO_BOUNDS: JSON array of 4 {min_period_ms,min_quorum_bps,min_pass_bps,min_timelock_ms} (spend, distribute, parameter change, text).
# Leave unset for the safe defaults (3-5 day votes). Use short bounds ONLY on a throwaway smoke-test collection.
BOUNDS=${DAO_BOUNDS:-null}
export NETWORK ASSET_PLAN
NET="network-config $NETWORK sign-with-keychain send"
W=target/wasm32-unknown-unknown/release
NFT=$PREFIX.$FOUNDER; DAO=dao.$PREFIX.$FOUNDER; TRE=treasury.$PREFIX.$FOUNDER; MKT=market.$PREFIX.$FOUNDER

cargo test --workspace -q
cargo build --workspace --target wasm32-unknown-unknown --release
HASH=$(node scripts/code-hash.mjs $W/quorum_vault.wasm)
echo "vault code hash: $HASH   (sha256 of the wasm; every vault will run exactly this code, forever)"
[ "$NETWORK" = "mainnet" ] && { printf "Publish the vault globally on MAINNET? Type the first 8 characters of the hash to continue: "; read ans; [ "$ans" = "$(echo $HASH | cut -c1-8)" ] || { echo aborted; exit 1; }; }

echo "== 1. publish the vault once as an immutable global contract =="
near contract deploy-as-global use-file $W/quorum_vault.wasm as-global-hash $FOUNDER $NET

echo "== 2. create accounts =="
for a in $NFT $DAO $TRE $MKT; do
  near account create-account fund-myself $a '8 NEAR' autogenerate-new-keypair save-to-keychain sign-as $FOUNDER $NET
done

echo "== 3. deploy and initialise dao, treasury, market =="
near contract deploy $DAO use-file $W/quorum_dao.wasm with-init-call new json-args "{\"nft\":\"$NFT\",\"treasury\":\"$TRE\",\"bounds\":$BOUNDS}" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' $NET
near contract deploy $TRE use-file $W/quorum_treasury.wasm with-init-call new json-args "{\"dao\":\"$DAO\",\"nft\":\"$NFT\",\"dex\":\"$DEX\",\"wrap\":\"$WRAP\"}" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' $NET
near contract deploy $MKT use-file $W/quorum_market.wasm with-init-call new json-args "{\"owner\":\"$FOUNDER\"}" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' $NET

echo "== 4. initialise the collection (minting opens at the first stage start; set START_IN_MIN to delay it) =="
INIT=$(FOUNDER=$FOUNDER TREASURY=$TRE DAO=$DAO VAULT_CODE_HASH=$HASH node scripts/make-init.mjs)
near contract deploy $NFT use-file $W/quorum_nft.wasm with-init-call new json-args "$INIT" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' $NET

echo "== 5. register the collection on the market so it can list =="
near contract call-function as-transaction $MKT register_collection json-args "{\"nft\":\"$NFT\"}" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as $FOUNDER $NET

cat <<MSG

Deployed to $NETWORK. Contracts: $NFT  $DAO  $TRE  $MKT
Next, in order (docs/MAINNET.md has the full staged plan):
  a. Fill services/api/.env (COLLECTION=$NFT DAO=$DAO TREASURY=$TRE MARKET=$MKT), then: docker compose up --build
  b. Nobody can pause or unpause this mint: it opens and closes on its stage times. Smoke-test on a
     throwaway collection first (docs/MAINNET.md stage 1), not on this one.
  c. After the mint closes, a wNEAR group can be settled by anyone (no vote); a DEX group needs a SETTLE
     proposal with a minimum output; see docs/MAINNET.md.
  d. Keep the full-access keys until the smoke test and the first week are clean.
MSG
