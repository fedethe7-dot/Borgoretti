/**
 * players.js — Elenco giocatori con ricerca, aggiunta e scheda rapida.
 * Contiene anche il form condiviso per creare/modificare un giocatore.
 */
import { state, save, uid } from '../db.js';
import { esc, icon, avatar, flames, openSheet, closeSheet, toast, resizeImage } from '../ui.js';
import { playerStats, filterMatches } from '../stats.js';
import { pageHeader, sortedPlayers, emptyState } from './common.js';
import { rerender, go } from '../app.js';

let query = '';
let sortBy = 'name';

/** Pannello per creare o modificare un giocatore (riusato dalla scheda). */
export function openPlayerForm(player = null, onSaved) {
  const draft = { name: player?.name || '', avatar: player?.avatar || null };
  const body = () => `<h3 class="sheet-title">${player ? 'Modifica giocatore' : 'Nuovo giocatore'}</h3>
    <form data-form="player" class="stack-s">
      <div class="row gap center-v">
        <label class="avatar-pick">${avatar({ name: draft.name || '?', avatar: draft.avatar }, 'lg')}
          <span class="avatar-cam">${icon('camera')}</span>
          <input type="file" accept="image/*" data-change="photo" hidden></label>
        <div class="grow"><label class="field-label" for="pf-name">Nome</label>
        <input class="input" id="pf-name" value="${esc(draft.name)}" placeholder="Es. Federico" autocomplete="off" required></div>
      </div>
      ${draft.avatar ? '<button type="button" class="link-btn" data-act="noPhoto">Rimuovi foto</button>' : '<div class="hint">Tocca il cerchio per aggiungere una foto (opzionale).</div>'}
      <button class="btn primary block lg">${icon('check')} Salva</button>
    </form>`;
  const actions = {
    photo: async (el) => {
      const f = el.files?.[0]; if (!f) return;
      draft.name = document.getElementById('pf-name').value;
      try { draft.avatar = await resizeImage(f); } catch { toast('Immagine non valida'); }
      openSheet(body(), actions);
    },
    noPhoto: () => { draft.name = document.getElementById('pf-name').value; draft.avatar = null; openSheet(body(), actions); },
    'submit:player': async () => {
      const name = document.getElementById('pf-name').value.trim();
      if (!name) return;
      if (state.players.some((p) => p.id !== player?.id && p.name.toLowerCase() === name.toLowerCase())) { toast('Esiste già un giocatore con questo nome'); return; }
      const p = await save('players', { ...(player || { id: uid() }), name, avatar: draft.avatar });
      closeSheet();
      toast(player ? 'Giocatore aggiornato' : `${name} aggiunto alla rosa`);
      onSaved ? onSaved(p) : rerender();
    },
  };
  openSheet(body(), actions);
  if (!player) setTimeout(() => document.getElementById('pf-name')?.focus(), 250);
}

export default {
  render() {
    const stats = playerStats(filterMatches('all'));
    const q = query.toLowerCase();
    let list = sortedPlayers().filter((p) => !q || p.name.toLowerCase().includes(q));
    const st = (p) => stats.get(p.id) || { presences: 0, goals: 0, assists: 0, form: { flames: 0 } };
    if (sortBy !== 'name') list.sort((a, b) => st(b)[sortBy] - st(a)[sortBy]);

    return `
      ${pageHeader('Giocatori', { sub: `${state.players.length} in rosa`, right: `<button class="icon-btn accent" data-act="add" aria-label="Aggiungi giocatore">${icon('plus')}</button>` })}
      <div class="tabs"><a class="tab on" href="#/players">Giocatori</a><a class="tab" href="#/teams">Squadre</a></div>
      <div class="search-box">${icon('search')}<input class="input" id="pl-search" placeholder="Cerca giocatore" value="${esc(query)}" data-input="search" autocomplete="off"></div>
      <div class="chips scroll-x">${[['name', 'A-Z'], ['presences', 'Presenze'], ['goals', 'Gol'], ['assists', 'Assist']].map(([id, l]) => `<button class="chip ${sortBy === id ? 'on' : ''}" data-act="sort" data-id="${id}">${l}</button>`).join('')}</div>
      ${!state.players.length ? emptyState('Rosa vuota', 'Aggiungi i giocatori del lunedì: resteranno salvati per tutte le partite.', `<button class="btn primary mt" data-act="add">${icon('plus')} Aggiungi giocatore</button>`) : ''}
      <div class="card list">${list.map((p) => { const s = st(p); return `
        <a class="list-row" href="#/player/${p.id}">${avatar(p)}
          <div class="grow min0"><div class="lr-title">${esc(p.name)}</div>
          <div class="lr-sub">${s.presences} pres · ${s.goals} gol · ${s.assists} assist</div></div>
          ${s.presences ? flames(s.form.flames) : '<span class="pill sm">nuovo</span>'}
        </a>`; }).join('')}
        ${q && !list.length ? `<button class="list-row" data-act="addNamed">${icon('plus')} Aggiungi "${esc(query)}"</button>` : ''}
      </div>`;
  },
  actions: {
    add: () => openPlayerForm(null, (p) => go(`player/${p.id}`)),
    addNamed: async () => { const p = await save('players', { id: uid(), name: query.trim(), avatar: null }); query = ''; go(`player/${p.id}`); },
    search: (el) => {
      query = el.value; rerender();
      const i = document.getElementById('pl-search'); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
    },
    sort: (el) => { sortBy = el.dataset.id; rerender(); },
  },
};
