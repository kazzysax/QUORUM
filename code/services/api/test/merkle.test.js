import test from "node:test";
import assert from "node:assert/strict";
import { buildTree, toHex } from "../src/merkle.js";

// The same literal is asserted by `merkle_root_matches_the_node_tool` in contracts/nft/src/tests.rs.
test("root matches the Rust contract's root for the same allowlist", () => {
  const { root } = buildTree(["alice.near", "bob.near", "carol.near"]);
  assert.equal(toHex(root), "6b93eb7e0612a30134952c1d0e4144240753820bc231899afe52dc22b94149b0");
});
test("every member gets a proof; the tree handles 1 and 2 members", () => {
  const t = buildTree(["a.near", "b.near", "c.near", "d.near", "e.near"]);
  assert.equal(Object.keys(t.proofs).length, 5);
  assert.equal(buildTree(["solo.near"]).proofs["solo.near"].length, 0);
  assert.equal(buildTree(["x.near", "y.near"]).proofs["x.near"].length, 1);
});
