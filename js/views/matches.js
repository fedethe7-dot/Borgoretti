/**
 * matches.js — Storico delle partite, raggruppate per mese.
 */
import { state } from '../db.js';
import { icon } from '../ui.js';
import { byDate, parseISO } from '../stats.js';
import { pageHeader, matchCard, emptyState, tabs } from './common.js';
import { rerender } from '../app.js';

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
let order = 'desc';
let scope = 'season';

export default {
  render() {
    let list = [...state.matches].sort(byDate);
    if (scope === 'season') list = list.filter((m) => m.seasonId === state.settings.activeSeasonId);
    if (order === 'desc') list.reverse();

    // Raggruppa per mese
    const groups = [];
    for (const m of list) {
      const d = parseISO(m.date);
      const k = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (groups[groups.length - 1]?.k !== k) groups.push({ k, items: [] });
      groups[groups.length - 1].items.push(m);
    }

    return `
      ${pageHeader('Partite', { sub: `${list.length} giornate`, right: `<button class="icon-btn" data-act="go" data-href="new" aria-label="Nuova partita">${icon('plus')}</button>` })}
      <div class="row gap between">
        ${tabs([{ id: 'season', label: 'Stagione' }, { id: 'all', label: 'Tutto' }], scope, 'scope')}
        <button class="chip" data-act="order">${order === 'desc' ? '↓ Più recenti' : '↑ Più vecchie'}</button>
      </div>
      ${!list.length ? emptyState('Nessuna partita', 'Crea la prima partita del lunedì.', `<button class="btn primary mt" data-act="go" data-href="new">${icon('plus')} Nuova partita</button>`) : ''}
      ${groups.map((g) => `<h2 class="section-title">${g.k}</h2><div class="stack-s">${g.items.map(matchCard).join('')}</div>`).join('')}
    `;
  },
  actions: {
    order: () => { order = order === 'desc' ? 'asc' : 'desc'; rerender(); },
    scope: (el) => { scope = el.dataset.id; rerender(); },
  },
};
