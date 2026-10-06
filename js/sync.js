/**
 * sync.js — Predisposizione per la sincronizzazione online (non attiva).
 *
 * L'app oggi funziona solo in locale. Per sincronizzare in futuro (Google
 * Sheets via Apps Script, Firebase, Supabase...) basta scrivere un
 * "adapter" con questa forma e registrarlo con `setSyncAdapter()`:
 *
 *   const adapter = {
 *     name: 'Apps Script',
 *     async push(changes) { ... },   // invia { players:[], teams:[], matches:[], seasons:[], deleted:[] }
 *     async pull(since)  { ... },    // restituisce lo stesso formato con i record cambiati dopo `since`
 *   };
 *
 * La strategia di merge è "vince il record con updatedAt più recente":
 * ogni record ha già `id` univoco e `updatedAt`, le cancellazioni sono in `deleted`.
 */
import { state, save, KINDS } from './db.js';

let adapter = null;
let lastSync = 0;

export const setSyncAdapter = (a) => { adapter = a; };
export const hasSync = () => !!adapter;

/** Record modificati dopo un certo istante (ms). */
export function changesSince(ts) {
  const out = {};
  for (const k of KINDS) out[k] = state[k].filter((o) => (o.updatedAt || o.deletedAt || 0) > ts);
  return out;
}

/** Esegue un ciclo push + pull. */
export async function syncNow() {
  if (!adapter) throw new Error('Nessuna sincronizzazione configurata');
  await adapter.push(changesSince(lastSync));
  const remote = await adapter.pull(lastSync);
  for (const k of ['players', 'teams', 'matches', 'seasons']) {
    for (const r of remote[k] || []) {
      const local = state[k].find((o) => o.id === r.id);
      if (!local || (r.updatedAt || 0) > (local.updatedAt || 0)) await save(k, r);
    }
  }
  lastSync = Date.now();
}
