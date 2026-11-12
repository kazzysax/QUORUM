// Cross-checks every proposal's tally against the DAO contract's own per-NFT vote records.
import { view, F } from './lib.mjs';
let bad = 0, total = 0;
for (const [n, nft, dao] of [['Molten Hours', 'qrmx-molten.testnet', 'qrmx-molten-dao.testnet'], ['Tidewater', 'qrmx-tide.testnet', `tide-dao.${F}`], ['Feather Protocol', `feather.${F}`, `feather-dao.${F}`]]) {
  const minted = Number(await view(nft, 'minted_total'));
  const count = Number(await view(dao, 'proposal_count'));
  const all = await view(dao, 'list_proposals', { from_id: 1, limit: 100 });
  console.log(`\n${n} DAO (${dao}): ${count} proposals`);
  for (const p of all) {
    const voted = (await Promise.all(Array.from({ length: minted }, (_, i) => view(dao, 'has_voted', { proposal_id: p.id, token_id: String(i + 1) })))).filter(Boolean).length;
    const tally = Number(p.yes) + Number(p.no) + Number(p.abstain);
    const status = await view(dao, 'status_of', { proposal_id: p.id });
    const ok = voted === tally;
    total++; if (!ok) bad++;
    console.log(`  #${String(p.id).padEnd(2)} ${status.padEnd(9)} yes ${p.yes} / no ${p.no} / abstain ${p.abstain}  | per-NFT vote records: ${voted}  ${ok ? 'MATCH' : 'MISMATCH'}  | "${p.purpose.slice(0, 38)}"`);
  }
}
console.log(`\n${total - bad}/${total} proposals: stored tally equals the number of NFTs recorded as voted`);
process.exit(bad ? 1 : 0);
