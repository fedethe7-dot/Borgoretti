/**
 * app.js — Avvio dell'app, router e gestione degli eventi.
 *
 * Router a "hash": #/home, #/matches, #/match/<id>, #/live/<id>, #/new,
 * #/players, #/player/<id>, #/teams, #/rankings, #/stats, #/settings.
 *
 * Ogni schermata (views/*.js) esporta:
 *   render(params) -> stringa HTML
 *   actions        -> { nomeAzione(el, event) } collegate a data-act="nomeAzione"
 *   mount?(root)   -> eventuale logica dopo il render
 */
import { initDB, state, onChange } from './db.js';
import { getSheetActions, closeSheet, icon } from './ui.js';

import home from './views/home.js';
import matches from './views/matches.js';
import matchDetail from './views/matchDetail.js';
import live from './views/live.js';
import newMatch from './views/newMatch.js';
import players from './views/players.js';
import playerDetail from './views/playerDetail.js';
import teams from './views/teams.js';
import rankings from './views/rankings.js';
import stats from './views/stats.js';
import settings from './views/settings.js';

const ROUTES = {
  home, matches, match: matchDetail, live, new: newMatch,
  players, player: playerDetail, teams, rankings, stats, settings,
};

/** Voci della barra di navigazione (route -> sezione evidenziata). */
const NAV = [
  { id: 'home', label: 'Home', icon: 'home', match: ['home', 'live', 'new'] },
  { id: 'matches', label: 'Partite', icon: 'ball', match: ['matches', 'match'] },
  { id: 'players', label: 'Giocatori', icon: 'users', match: ['players', 'player', 'teams'] },
  { id: 'rankings', label: 'Classifiche', icon: 'trophy', match: ['rankings'] },
  { id: 'stats', label: 'Statistiche', icon: 'chart', match: ['stats'] },
  { id: 'settings', label: 'Impost.', icon: 'gear', match: ['settings'] },
];

let current = { name: null, view: null, params: [] };

function parseHash() {
  const [name = 'home', ...params] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  return { name: ROUTES[name] ? name : 'home', params: params.map(decodeURIComponent) };
}

/** Naviga verso una schermata. */
export function go(path) {
  const target = '#/' + path.replace(/^#?\/?/, '');
  if (location.hash === target) render();
  else location.hash = target;
}

/** Disegna la schermata corrente. keepScroll = true per gli aggiornamenti. */
export function render(keepScroll = false) {
  const { name, params } = parseHash();
  const view = ROUTES[name];
  const changed = current.name !== name || current.params.join('/') !== params.join('/');
  current = { name, view, params };
  const root = document.getElementById('view');
  const y = window.scrollY;
  root.innerHTML = view.render(...params);
  root.className = `view view-${name}`;
  view.mount?.(root, ...params);
  renderNav(name);
  if (changed && !keepScroll) { window.scrollTo(0, 0); root.classList.add('enter'); setTimeout(() => root.classList.remove('enter'), 300); }
  else window.scrollTo(0, y);
}
export const rerender = () => render(true);

function renderNav(active) {
  document.getElementById('nav').innerHTML = NAV.map((n) => `
    <a href="#/${n.id}" class="nav-item ${n.match.includes(active) ? 'active' : ''}" aria-label="${n.label}">
      ${icon(n.icon)}<span>${n.label}</span></a>`).join('');
}

/** Applica il tema scelto (auto segue il sistema). */
export function applyTheme() {
  const t = state.settings.theme;
  const rootEl = document.documentElement;
  if (t === 'auto') rootEl.removeAttribute('data-theme'); else rootEl.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#06140c' : '#0f5c32');
}

/* ------------------------------------------------------------------ */
/* Delega degli eventi: un solo listener per click, submit, change     */
/* ------------------------------------------------------------------ */
function actionsFor(el) {
  return el.closest('#sheet-root') ? getSheetActions() : current.view?.actions || {};
}

document.addEventListener('click', (ev) => {
  if (ev.target.closest('[data-sheet-close]')) { closeSheet(); return; }
  const el = ev.target.closest('[data-act]');
  if (!el) {
    const link = ev.target.closest('[data-href]');
    if (link) go(link.dataset.href);
    return;
  }
  const name = el.dataset.act;
  if (name === 'go') { go(el.dataset.href); return; }
  if (name === 'back') { history.length > 1 ? history.back() : go('home'); return; }
  if (name === 'close-sheet') { closeSheet(); return; }
  const fn = actionsFor(el)[name];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  actionsFor(form)['submit:' + form.dataset.form]?.(form, ev);
});

for (const type of ['change', 'input']) {
  document.addEventListener(type, (ev) => {
    const el = ev.target.closest(`[data-${type}]`);
    if (!el) return;
    actionsFor(el)[el.dataset[type]]?.(el, ev);
  });
}

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeSheet(); });
window.addEventListener('hashchange', () => { closeSheet(); render(); });

/* ------------------------------------------------------------------ */
/* Avvio                                                               */
/* ------------------------------------------------------------------ */
async function start() {
  await initDB();
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  onChange((kind) => { if (kind === 'settings') applyTheme(); });
  render();
  document.getElementById('splash')?.remove();

  // Service worker per l'uso offline (solo se pubblicata su http/https)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.__NO_SW__) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* anteprima o ambiente senza SW */ });
  }
}

start().catch((e) => {
  console.error(e);
  document.getElementById('view').innerHTML = `<div class="card mt"><h3>Errore di avvio</h3><p class="muted">${String(e.message || e)}</p></div>`;
});
