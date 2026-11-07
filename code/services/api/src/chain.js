// Minimal NEAR JSON-RPC client. Ownership checks always read FINAL state.
export function chainClient(rpcUrl, collection, fetchImpl = fetch) {
  const rpc = async (method, params) => {
    const r = await fetchImpl(rpcUrl, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "q", method, params }),
    });
    const j = await r.json();
    if (j.error) throw new Error(JSON.stringify(j.error));
    return j.result;
  };
  const view = async (contract, method, args = {}) => {
    const res = await rpc("query", {
      request_type: "call_function", finality: "final", account_id: contract, method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    return JSON.parse(Buffer.from(res.result).toString());
  };
  return {
    view,
    /** True if `publicKey` is an access key of `accountId` (proves the signer controls the account). */
    async hasAccessKey(accountId, publicKey) {
      try {
        await rpc("query", { request_type: "view_access_key", finality: "final", account_id: accountId, public_key: publicKey });
        return true;
      } catch { return false; }
    },
    /** True if `accountId` currently owns at least one live Quorum NFT. */
    async holdsToken(accountId) {
      const n = await view(collection, "nft_supply_for_owner", { account_id: accountId });
      return BigInt(n) > 0n;
    },
  };
}
