/**
 * common.js — Pezzi di interfaccia condivisi tra le schermate.
 */
import { state, getPlayer } from '../db.js';
import { esc, icon, teamDot } from '../ui.js';
import { FILTERS, matchSummary, gameScore, longDate } from '../stats.js';

/** Intestazione di pagina con titolo e azioni opzionali. */
export function pageHeader(title, { back = false, sub = '', right = '' } = {}) {
  return `<header class="page-head">
    ${back ? `<button class="icon-btn" data-act="back" aria-label="Indietro">${icon('back')}</button>` : ''}
    <div class="grow min0"><h1 class="page-title">${esc(title)}</h1>${sub ? `<div class="page-sub">${sub}</div>` : ''}</div>
    ${right}
  </header>`;
}

/** Barra dei filtri temporali (chip scorrevoli). */
export function filterBar(currentId, act = 'filter') {
  return `<div class="chips scroll-x" role="tablist">${FILTERS.map((f) => `
    <button class="chip ${f.id === currentId ? 'on' : ''}" data-act="${act}" data-id="${f.id}">${f.label}</button>`).join('')}</div>`;
}

/** Tab interne (segmented control). */
export function tabs(items, currentId, act = 'tab') {
  return `<div class="tabs scroll-x">${items.map((t) => `
    <button class="tab ${t.id === currentId ? 'on' : ''}" data-act="${act}" data-id="${t.id}">${t.label}</button>`).join('')}</div>`;
}

/** Riga risultato di una giornata (usata in Home e Partite). */
export function resultLine(m, { big = false } = {}) {
  const s = matchSummary(m);
  if (s.type === 'single') {
    const [A, B] = s.teams;
    const w = (t) => (s.winner === t ? 'win' : s.draw ? 'draw' : 'lose');
    return `<div class="result ${big ? 'big' : ''}">
      <span class="r-team ${w(A)}">${teamDot(A.color)}<span class="r-name">${esc(A.name)}</span></span>
      <span class="r-score">${s.score[A.key]}<i>-</i>${s.score[B.key]}</span>
      <span class="r-team right ${w(B)}"><span class="r-name">${esc(B.name)}</span>${teamDot(B.color)}</span>
    </div>`;
  }
  const top = s.standings.slice(0, 4);
  return `<div class="result multi ${big ? 'big' : ''}">${top.map((r, i) => `
    <span class="r-mini ${i === 0 && !s.draw ? 'win' : ''}"><span>${teamDot(r.team.color)}${esc(r.team.name)}</span> <b>${r.pts} pt</b></span>`).join('')}</div>`;
}

/** Card cliccabile di una giornata. */
export function matchCard(m) {
  const goals = m.games.reduce((n, g) => n + g.events.length, 0);
  const nPlayers = m.teams.reduce((n, t) => n + t.playerIds.length, 0);
  return `<button class="card match-card" data-href="${m.status === 'live' ? 'live' : 'match'}/${m.id}">
    <div class="mc-top"><span class="mc-date">${longDate(m.date)}</span>
      ${m.status === 'live' ? '<span class="pill live">IN CORSO</span>' : `<span class="mc-meta">${nPlayers} giocatori · ${goals} gol${m.teams.length > 2 ? ` · ${m.teams.length} squadre` : ''}</span>`}</div>
    ${resultLine(m)}
  </button>`;
}

/** Marcatori di una giornata: [{player, goals, assists}] ordinati. */
export function matchScorers(m) {
  const map = new Map();
  for (const g of m.games) for (const e of g.events) {
    if (e.scorer) { const r = map.get(e.scorer) || { id: e.scorer, goals: 0, assists: 0 }; r.goals++; map.set(e.scorer, r); }
    if (e.assist) { const r = map.get(e.assist) || { id: e.assist, goals: 0, assists: 0 }; r.assists++; map.set(e.assist, r); }
  }
  return [...map.values()].map((r) => ({ ...r, player: getPlayer(r.id) }));
}

/** Testo di un evento gol con il punteggio progressivo. */
export function goalLines(game, teamsByKey) {
  const run = { [game.a]: 0, [game.b]: 0 };
  return game.events.map((e) => {
    run[e.team]++;
    return { e, score: `${run[game.a]}-${run[game.b]}`, team: teamsByKey[e.team], scorer: getPlayer(e.scorer), assist: getPlayer(e.assist) };
  });
}

export const playerName = (id) => getPlayer(id)?.name || 'Giocatore eliminato';

/** Giocatori attivi ordinati per nome. */
export const sortedPlayers = () => [...state.players].sort((a, b) => a.name.localeCompare(b.name, 'it'));

/** Stato vuoto con invito all'azione. */
export const emptyState = (title, text, btn = '') => `<div class="empty card"><div class="empty-ic">${icon('ball')}</div><h3>${esc(title)}</h3><p class="muted">${esc(text)}</p>${btn}</div>`;

export { gameScore };
