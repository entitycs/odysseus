// models.ts
import { writable } from 'svelte/store';

export interface ModelItem {
  mid: string;
  display: string;
  epName?: string;
  stale?: boolean;
  staleReason?: string;
}

export const modelItems = writable<ModelItem[]>([]);
export const isLoading = writable(false);

let _lastFetchTime = 0;
let _fetchInflight: Promise<any> | null = null;
let _fetchSeq = 0;

const API_BASE = '';
const _FETCH_CACHE_TTL = 30_000; // 30s

export async function refreshModels(force = false) {
  const now = Date.now();
  const needsFetch =
    force || !_lastFetchTime || now - _lastFetchTime >= _FETCH_CACHE_TTL;

  if (!needsFetch && !force) {
    // Cache is fresh — still re-render UI via store
    return;
  }

  isLoading.set(true);

  try {
    if (force) _fetchInflight = null;

    if (!_fetchInflight) {
      const seq = ++_fetchSeq;
      const url =
        `${API_BASE}/api/models` +
        (force ? '?refresh=true' : '?background=false');

      _fetchInflight = fetch(url, { credentials: 'same-origin' })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          return { data, seq };
        })
        .finally(() => {
          _fetchInflight = null;
        });
    }

    const { data, seq } = await _fetchInflight;
    if (seq < _fetchSeq) return;

    _lastFetchTime = Date.now();
    modelItems.set(data.items || []);
  } catch (err) {
    console.error(err);
    modelItems.set([]);
  } finally {
    isLoading.set(false);
  }
}
