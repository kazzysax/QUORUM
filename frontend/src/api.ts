// Quorum API client connecting to local backend at :8080 with robust fallback

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

export async function checkBackendHealth(): Promise<{ online: boolean; cursor?: number }> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return { online: false };
    const data = await res.json();
    return { online: true, cursor: data.cursor };
  } catch {
    return { online: false };
  }
}

export async function fetchNftsFromApi(owner?: string, listed?: boolean) {
  try {
    const params = new URLSearchParams();
    if (owner) params.set('owner', owner);
    if (listed !== undefined) params.set('listed', String(listed));
    const res = await fetch(`${API_BASE}/nfts?${params.toString()}`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchProposalsFromApi() {
  try {
    const res = await fetch(`${API_BASE}/dao/proposals`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchSettlementGroupsFromApi() {
  try {
    const res = await fetch(`${API_BASE}/settlement`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchTreasuryFromApi() {
  try {
    const res = await fetch(`${API_BASE}/treasury`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

