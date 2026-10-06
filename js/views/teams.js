/**
 * teams.js — Squadre abituali: nome, colore e rosa predefinita.
 * Modificare una squadra NON cambia le partite passate (che conservano
 * la propria copia della formazione).
 */
import { state, save, remove, uid, getPlayer } from '../db.js';
import { esc, icon, avatar, teamDot, TEAM_COLORS, openSheet, closeSheet, toast, confirmDialog } from '../ui.js';
import { teamStats, filterMatches, pct, signed } from '../stats.js';
import { formDots } from '../charts.js';
import { pageHeader, sortedPlayers, emptyState } from './common.js';
import { rerender } from '../app.js';

function openTeamForm(team = null) {
  const d = { name: team?.name || '', color: team?.color || TEAM_COLORS[state.teams.length % TEAM_COLORS.length].hex, playerIds: new Set(team?.playerIds || []) };
  const body = () => `<h3 class="sheet-title">${team ? 'Modifica squadra' : 'Nuova squadra'}</h3>
    <form data-form="team" class="stack-s">
      <label class="field-label" for="tf-name">Nome</label>
      <input class="input" id="tf-name" value="${esc(d.name)}" placeholder="Es. Verde" data-input="name" autocomplete="off" required>
      <div class="field-label">Colore</div>
      <div class="swatches">${TEAM_COLORS.map((c) => `<button type="button" class="swatch ${d.color === c.hex ? 'on' : ''}" style="--c:${c.hex}" data-act="color" data-c="${c.hex}" aria-label="${c.name}"></button>`).join('')}</div>
      <div class="field-label">Rosa abituale <span class="muted">(${d.playerIds.size})</span></div>
      <div class="hint">Serve a comporre in automatico le squadre quando crei una partita. Puoi sempre cambiarle partita per partita.</div>
      <div class="pick-grid compact">${sortedPlayers().map((p) => `<button type="button" class="pick ${d.playerIds.has(p.id) ? 'on' : ''}" data-act="toggle" data-id="${p.id}">${avatar(p, 'sm')}<span class="pick-name">${esc(p.name)}</span><span class="pick-check">${icon('check')}</span></button>`).join('')}</div>
      <button class="btn primary block lg">${icon('check')} Salva squadra</button>
      ${team ? `<button type="button" class="link-btn danger" data-act="del">${icon('trash')} Elimina squadra</button>` : ''}
    </form>`;
  const refresh = () => { d.name = document.getElementById('tf-name').value; openSheet(body(), actions, { cls: 'tall' }); };
  const actions = {
    name: (el) => { d.name = el.value; },
    color: (el) => { d.color = el.dataset.c; refresh(); },
    toggle: (el) => { const id = el.dataset.id; d.playerIds.has(id) ? d.playerIds.delete(id) : d.playerIds.add(id); refresh(); },
    'submit:team': async () => {
      const name = document.getElementById('tf-name').value.trim();
      if (!name) return;
      await save('teams', { ...(team || { id: uid() }), name, color: d.color, playerIds: [...d.playerIds] });
      closeSheet(); rerender(); toast('Squadra salvata');
    },
    del: async () => {
      if (!(await confirmDialog(`Eliminare ${team.name}?`, 'Le partite passate restano invariate. Le sue statistiche resteranno visibili come squadra storica.', { ok: 'Elimina', danger: true }))) return;
      await remove('teams', team.id); rerender(); toast('Squadra eliminata');
    },
  };
  openSheet(body(), actions, { cls: 'tall' });
}

export default {
  render() {
    const st = new Map(teamStats(filterMatches('all')).map((t) => [t.id, t]));
    return `
      ${pageHeader('Squadre', { sub: 'Squadre abituali riutilizzabili', right: `<button class="icon-btn accent" data-act="add" aria-label="Nuova squadra">${icon('plus')}</button>` })}
      <div class="tabs"><a class="tab" href="#/players">Giocatori</a><a class="tab on" href="#/teams">Squadre</a></div>
      ${!state.teams.length ? emptyState('Nessuna squadra abituale', 'Crea le squadre che usate di solito (es. Verde e Bianca) per ritrovarle ogni lunedì.', `<button class="btn primary mt" data-act="add">${icon('plus')} Crea squadra</button>`) : ''}
      <div class="stack-s">${state.teams.map((t) => { const s = st.get(t.id); return `
        <button class="card team-card" data-act="edit" data-id="${t.id}" style="--c:${esc(t.color)}">
          <div class="row between"><span class="tm-name">${teamDot(t.color)}${esc(t.name)}</span>${s ? formDots(s.last5) : '<span class="pill sm">nessuna partita</span>'}</div>
          ${s ? `<div class="tm-rec"><span><b>${s.games}</b> partite</span><span><b>${s.w}</b>V <b>${s.d}</b>P <b>${s.l}</b>S</span><span><b>${pct(s.winPct)}</b> vitt.</span><span>DR <b>${signed(s.gd)}</b></span></div>` : ''}
          <div class="tm-roster">${t.playerIds.map((id) => getPlayer(id)).filter(Boolean).map((p) => esc(p.name)).join(' · ') || '<span class="muted">Nessun giocatore abituale</span>'}</div>
        </button>`; }).join('')}</div>
      <p class="hint center mt">Per il confronto completo tra squadre vai in <a href="#/stats">Statistiche</a>.</p>`;
  },
  actions: {
    add: () => openTeamForm(),
    edit: (el) => openTeamForm(state.teams.find((t) => t.id === el.dataset.id)),
  },
};
