// Dompet — état, sauvegarde locale et synchronisation avec un fichier data.json sur GitHub.
import { emptyData, mergeData, normalize, uid } from './engine.js';

const K_DATA = 'dompet:data', K_SYNC = 'dompet:sync', K_META = 'dompet:meta';

const ls = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
};

const listeners = new Set();
export const store = {
  data: null,
  meta: ls.get(K_META, { sha: null, dirty: false, lastSync: null }),
  sync: ls.get(K_SYNC, { owner: '', repo: '', branch: 'main', path: 'data.json', token: '' }),
  status: 'local', // local | syncing | synced | pending | error | offline | demo
  error: '',
};

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => fn(store)); }

export function hasData() { return !!ls.get(K_DATA, null); }
export function syncConfigured() { const s = store.sync; return !!(s.owner && s.repo && s.token); }

export function init() {
  const saved = ls.get(K_DATA, null);
  store.data = normalize(saved || emptyData());
  store.status = store.data.demo ? 'demo' : syncConfigured() ? (store.meta.dirty ? 'pending' : 'synced') : 'local';
  return store.data;
}

function persist() {
  ls.set(K_DATA, store.data);
  ls.set(K_META, store.meta);
}

// --- mutations ---
const now = () => new Date().toISOString();
export function commit(mutator, { silent = false } = {}) {
  mutator(store.data);
  store.data.updatedAt = now();
  store.meta.dirty = true;
  persist();
  if (!silent) emit();
  schedulePush();
}

export function upsert(col, item) {
  const it = { ...item, id: item.id || uid(), updatedAt: now() };
  if (!it.createdAt) it.createdAt = it.updatedAt;
  commit(d => {
    const i = d[col].findIndex(x => x.id === it.id);
    if (i >= 0) d[col][i] = it; else d[col].push(it);
  });
  return it;
}
export function remove(col, id) {
  commit(d => { d[col] = d[col].filter(x => x.id !== id); d.deleted[id] = now(); });
}
export function setSettings(patch) {
  commit(d => { d.settings = { ...d.settings, ...patch, updatedAt: now() }; });
}
export function replaceAll(newData, { demo = false } = {}) {
  store.data = normalize(newData);
  if (demo) store.data.demo = true; else delete store.data.demo;
  store.meta = { sha: store.meta.sha, dirty: !demo, lastSync: store.meta.lastSync };
  persist();
  store.status = demo ? 'demo' : syncConfigured() ? 'pending' : 'local';
  emit();
  if (!demo) schedulePush();
}
export function wipe() {
  ls.del(K_DATA); ls.del(K_META);
  store.meta = { sha: null, dirty: false, lastSync: null };
  store.data = normalize(emptyData());
  store.status = syncConfigured() ? 'synced' : 'local';
  emit();
}

export function saveSyncConfig(cfg) {
  store.sync = { ...store.sync, ...cfg };
  ls.set(K_SYNC, store.sync);
  store.meta.sha = null;
  persist();
}
export function forgetSync() {
  ls.del(K_SYNC);
  store.sync = { owner: '', repo: '', branch: 'main', path: 'data.json', token: '' };
  store.status = 'local';
  emit();
}

// --- GitHub ---
const b64enc = str => { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const b64dec = b64 => { const bin = atob(b64.replace(/\s/g, '')); const bytes = Uint8Array.from(bin, c => c.charCodeAt(0)); return new TextDecoder().decode(bytes); };

function api(path, opts = {}) {
  const s = store.sync;
  return fetch(`https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${s.path.split('/').map(encodeURIComponent).join('/')}${path}`, {
    cache: 'no-store',
    ...opts,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${s.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
  });
}

async function fetchRemote() {
  const res = await api(`?ref=${encodeURIComponent(store.sync.branch || 'main')}&t=${Date.now()}`);
  if (res.status === 404) return { data: null, sha: null };
  if (res.status === 401) throw new Error('Clé GitHub refusée (401). Vérifie ou recrée la clé dans les réglages.');
  if (res.status === 403) throw new Error('Accès refusé (403). La clé doit avoir « Contents : Read and write » sur ce dépôt.');
  if (!res.ok) throw new Error(`GitHub a répondu ${res.status}.`);
  const j = await res.json();
  let text = j.content ? b64dec(j.content) : null;
  if (!text && j.download_url) text = await (await fetch(j.download_url, { cache: 'no-store' })).text();
  return { data: text ? normalize(JSON.parse(text)) : null, sha: j.sha };
}

let pushTimer = null, busy = false;
function schedulePush() {
  if (!syncConfigured() || store.data.demo) { store.status = store.data.demo ? 'demo' : 'local'; return; }
  store.status = 'pending'; emit();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => syncNow(), 1200);
}

// Récupère la version GitHub, fusionne avec les changements locaux, renvoie le résultat.
export async function syncNow({ quiet = false } = {}) {
  if (!syncConfigured() || store.data.demo || busy) return;
  if (!navigator.onLine) { store.status = 'offline'; emit(); return; }
  busy = true; store.status = 'syncing'; if (!quiet) emit();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await fetchRemote();
      const merged = remote.data ? mergeData(store.data, remote.data) : store.data;
      const changed = !remote.data || JSON.stringify(stripMeta(merged)) !== JSON.stringify(stripMeta(remote.data));
      store.data = merged;
      if (!changed) { store.meta.sha = remote.sha; break; }
      if (!store.meta.dirty && remote.data) { store.meta.sha = remote.sha; break; } // rien à envoyer de notre côté
      const body = { message: `Dompet : mise à jour depuis le site (${new Date().toLocaleString('fr-FR')})`, content: b64enc(JSON.stringify(merged, null, 1)), branch: store.sync.branch || 'main' };
      if (remote.sha) body.sha = remote.sha;
      const res = await api('', { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
      if (res.status === 409 || res.status === 422) continue; // quelqu'un (Claude) a écrit entre-temps → on refusionne
      if (!res.ok) throw new Error(`Envoi refusé par GitHub (${res.status}).`);
      store.meta.sha = (await res.json()).content.sha;
      break;
    }
    store.meta.dirty = false; store.meta.lastSync = new Date().toISOString();
    store.status = 'synced'; store.error = '';
  } catch (e) {
    store.status = navigator.onLine ? 'error' : 'offline';
    store.error = e.message || String(e);
  } finally {
    busy = false; persist(); emit();
  }
}

function stripMeta(d) { const { updatedAt, ...rest } = d; return rest; }

export async function testConnection(cfg) {
  const prev = store.sync; store.sync = { ...prev, ...cfg };
  try { const r = await fetchRemote(); return { ok: true, exists: !!r.data, count: r.data ? r.data.expenses.length : 0 }; }
  catch (e) { return { ok: false, error: e.message }; }
  finally { store.sync = prev; }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow({ quiet: true }); });
}
