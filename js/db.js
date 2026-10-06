/**
 * db.js — Persistenza dei dati di Borgoretti.
 *
 * Tutti i dati vivono in IndexedDB (database del browser, funziona offline).
 * All'avvio vengono caricati interamente in memoria (`state`): i volumi di
 * un calcetto settimanale sono piccoli, quindi le statistiche si calcolano
 * al volo senza query complicate.
 *
 * Ogni scrittura passa da `save()` / `remove()`, che:
 *   1. aggiornano lo stato in memoria
 *   2. scrivono il singolo record su IndexedDB
 *   3. impostano `updatedAt` e registrano le cancellazioni (tombstone)
 * I punti 3 servono a una futura sincronizzazione online (vedi sync.js).
 *
 * Se IndexedDB non è disponibile si usa localStorage come ripiego.
 */

const DB_NAME = 'lunedi-fc';
const DB_VERSION = 1;
/** Collezioni salvate. `deleted` contiene le tombstone per la sync. */
export const KINDS = ['players', 'teams', 'matches', 'seasons', 'deleted'];

/** Impostazioni predefinite (salvate nella collezione `meta`). */
export const DEFAULT_SETTINGS = {
  theme: 'auto',              // 'auto' | 'light' | 'dark'
  activeSeasonId: null,
  weights: { goal: 3, assist: 2, win: 3, draw: 1, presence: 1 }, // punteggio classifica
  statsFilter: 'season',
};

/** Stato in memoria: la "fonte di verità" per l'interfaccia. */
export const state = {
  players: [], teams: [], matches: [], seasons: [], deleted: [],
  settings: structuredClone(DEFAULT_SETTINGS),
};

/** Genera un id univoco (adatto anche alla sync tra dispositivi). */
export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------------------------------ */
/* Backend IndexedDB                                                    */
/* ------------------------------------------------------------------ */
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const k of KINDS) if (!db.objectStoreNames.contains(k)) db.createObjectStore(k, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbBackend(db) {
  const tx = (store, mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
  });
  return {
    name: 'IndexedDB',
    getAll: (store) => tx(store, 'readonly', (s) => s.getAll()),
    put: (store, obj) => tx(store, 'readwrite', (s) => s.put(obj)),
    del: (store, id) => tx(store, 'readwrite', (s) => s.delete(id)),
    clear: (store) => tx(store, 'readwrite', (s) => s.clear()),
  };
}

/* Ripiego localStorage: una chiave JSON per collezione. */
function lsBackend() {
  const key = (s) => `${DB_NAME}:${s}`;
  const read = (s) => { try { return JSON.parse(localStorage.getItem(key(s)) || '[]'); } catch { return []; } };
  const write = (s, arr) => { try { localStorage.setItem(key(s), JSON.stringify(arr)); } catch (e) { console.warn(e); } };
  const idOf = (s, o) => (s === 'meta' ? o.key : o.id);
  return {
    name: 'localStorage',
    getAll: async (s) => read(s),
    put: async (s, obj) => { const a = read(s).filter((o) => idOf(s, o) !== idOf(s, obj)); a.push(obj); write(s, a); },
    del: async (s, id) => write(s, read(s).filter((o) => idOf(s, o) !== id)),
    clear: async (s) => write(s, []),
  };
}

/* Ripiego estremo (es. anteprima senza storage): solo memoria. */
function memoryBackend() {
  return { name: 'memoria', getAll: async () => [], put: async () => {}, del: async () => {}, clear: async () => {} };
}

let backend = null;
export const backendName = () => backend?.name;

/* Avvisa l'interfaccia quando i dati cambiano. */
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = (kind) => listeners.forEach((fn) => fn(kind));

/** Apre il database e carica tutto in memoria. */
export async function initDB() {
  try {
    backend = idbBackend(await openIDB());
  } catch (e) {
    console.warn('IndexedDB non disponibile, uso localStorage', e);
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); backend = lsBackend(); }
    catch { backend = memoryBackend(); }
  }
  for (const k of KINDS) state[k] = (await backend.getAll(k)) || [];
  const meta = (await backend.getAll('meta')) || [];
  const s = meta.find((m) => m.key === 'settings');
  state.settings = { ...structuredClone(DEFAULT_SETTINGS), ...(s?.value || {}) };
  state.settings.weights = { ...DEFAULT_SETTINGS.weights, ...(s?.value?.weights || {}) };

  // Chiede al browser di non cancellare i dati in caso di poco spazio.
  try { await navigator.storage?.persist?.(); } catch { /* ignora */ }

  await ensureSeason();
}

/** Garantisce che esista almeno una stagione attiva. */
async function ensureSeason() {
  if (!state.seasons.length) {
    const y = new Date().getFullYear();
    const m = new Date().getMonth();
    // stagione "sportiva": da settembre a giugno
    const name = m >= 7 ? `${y}/${String(y + 1).slice(2)}` : `${y - 1}/${String(y).slice(2)}`;
    const season = { id: uid(), name: `Stagione ${name}`, startDate: todayISO(), createdAt: Date.now() };
    await save('seasons', season);
  }
  if (!state.seasons.find((s) => s.id === state.settings.activeSeasonId)) {
    const latest = [...state.seasons].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))[0];
    await saveSettings({ activeSeasonId: latest.id });
  }
}

/** Inserisce o aggiorna un record. */
export async function save(kind, obj) {
  obj.updatedAt = Date.now();
  if (!obj.createdAt) obj.createdAt = obj.updatedAt;
  const arr = state[kind];
  const i = arr.findIndex((o) => o.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
  await backend.put(kind, structuredClone(obj));
  emit(kind);
  return obj;
}

/** Elimina un record e lascia una tombstone per la sync futura. */
export async function remove(kind, id) {
  state[kind] = state[kind].filter((o) => o.id !== id);
  await backend.del(kind, id);
  const tomb = { id: `${kind}:${id}`, kind, refId: id, deletedAt: Date.now() };
  state.deleted.push(tomb);
  await backend.put('deleted', tomb);
  emit(kind);
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await backend.put('meta', { key: 'settings', value: structuredClone(state.settings) });
  emit('settings');
}

/* Utility di lettura */
export const getPlayer = (id) => state.players.find((p) => p.id === id);
export const getTeam = (id) => state.teams.find((t) => t.id === id);
export const getMatch = (id) => state.matches.find((m) => m.id === id);
export const activeSeason = () => state.seasons.find((s) => s.id === state.settings.activeSeasonId);

export function todayISO(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/* ------------------------------------------------------------------ */
/* Backup / ripristino                                                 */
/* ------------------------------------------------------------------ */
export function exportAll() {
  return {
    app: 'lunedi-fc', version: 1, exportedAt: new Date().toISOString(),
    players: state.players, teams: state.teams, matches: state.matches,
    seasons: state.seasons, settings: state.settings,
  };
}

/** Sostituisce tutti i dati con quelli del backup. */
export async function importAll(data) {
  if (!data || data.app !== 'lunedi-fc') throw new Error('File non valido: non è un backup di Borgoretti');
  for (const k of KINDS) { await backend.clear(k); state[k] = []; }
  for (const k of ['players', 'teams', 'matches', 'seasons']) {
    for (const o of data[k] || []) { state[k].push(o); await backend.put(k, o); }
  }
  if (data.settings) await saveSettings(data.settings);
  await ensureSeason();
  emit('all');
}

/** Cancella tutto (usato da "Reset totale"). */
export async function wipeAll() {
  for (const k of KINDS) { await backend.clear(k); state[k] = []; }
  await backend.clear('meta');
  state.settings = structuredClone(DEFAULT_SETTINGS);
  await ensureSeason();
  emit('all');
}
