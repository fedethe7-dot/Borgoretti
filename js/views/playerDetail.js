/**
 * playerDetail.js — Scheda giocatore: numeri, forma, strisce,
 * miglior partita, andamento e ultime partite.
 */
import { state, save, remove, getPlayer } from '../db.js';
import { esc, icon, avatar, teamDot, flames, confirmDialog, toast } from '../ui.js';
import { playerStats, filterMatches, FILTERS, fmt1, pct, signed, longDate, shortDate, rankScore } from '../stats.js';
import { lineChart, formDots, barList } from '../charts.js';
import { pageHeader, filterBar } from './common.js';
import { openPlayerForm } from './players.js';
import { go, rerender } from '../app.js';

let filter = 'all';
const cur = () => getPlayer(location.hash.split('/')[2]);

export default {
  render(id) {
    const p = getPlayer(id);
    if (!p) return `${pageHeader('Giocatore', { back: true })}<p class="muted">Giocatore non trovato.</p>`;
    const matches = filterMatches(filter);
    const s = playerStats(matches).get(id);
    const w = state.settings.weights;

    const head = `${pageHeader('', { back: true, right: `<button class="icon-btn" data-act="edit" aria-label="Modifica">${icon('edit')}</button><button class="icon-btn" data-act="del" aria-label="Elimina">${icon('trash')}</button>` })}
      <div class="player-hero">${avatar(p, 'xl')}<div class="min0"><h1 class="ph-name">${esc(p.name)}</h1>
        <div class="ph-sub">${s ? `${s.presences} presenze · ${FILTERS.find((f) => f.id === filter).label.toLowerCase()}` : 'Nessuna presenza nel periodo'}</div>
        ${s ? `<div class="ph-form">${flames(s.form.flames)} <span>${s.form.label}</span></div>` : ''}</div></div>
      ${filterBar(filter)}`;

    if (!s) return head + '<div class="card muted center">Nessuna partita giocata nel periodo selezionato.</div>';

    const stat = (label, value, sub = '') => `<div class="stat"><span class="stat-val">${value}</span><span class="stat-label">${label}</span>${sub ? `<span class="stat-sub">${sub}</span>` : ''}</div>`;
    const f = s.form;
    const trend = s.log.map((r) => ({ label: shortDate(r.date), value: r.goals + r.assists }));

    // Rendimento per squadra (con quali squadre vince di più)
    const byTeam = {};
    for (const r of s.log) {
      const k = r.teamName;
      byTeam[k] = byTeam[k] || { label: k, color: r.teamColor, games: 0, w: 0 };
      byTeam[k].games += r.games; byTeam[k].w += r.w;
    }
    const teamRows = Object.values(byTeam).map((t) => ({ label: `${t.label} (${t.games})`, value: t.games ? Math.round((t.w / t.games) * 100) : 0, color: t.color }));

    return `${head}
      <div class="stat-grid big">
        ${stat('Gol', s.goals, `${fmt1(s.avgGoals)} a partita`)}
        ${stat('Assist', s.assists, `${fmt1(s.avgAssists)} a partita`)}
        ${stat('Vittorie', pct(s.winPct), `${s.w}V ${s.d}P ${s.l}S`)}
      </div>

      <div class="card form-card">
        <div class="row between"><b>🔥 Forma · ultime ${f.matches} presenze</b>${formDots(f.results)}</div>
        <div class="form-nums"><span>⚽ <b>${f.goals}</b> gol</span><span>🎯 <b>${f.assists}</b> assist</span><span>🏆 <b>${f.w}</b> vittorie</span><span>❌ <b>${f.l}</b> sconfitte</span></div>
        <div class="hint">Indice forma ${f.score}/100: 60% risultati delle ultime 5 presenze, 40% gol e assist (0,75 per assist).</div>
      </div>

      <h2 class="section-title">Numeri</h2>
      <div class="stat-grid">
        ${stat('Presenze', s.presences)}
        ${stat('Partite giocate', s.games, 'sfide disputate')}
        ${stat('Vittorie', s.w)}
        ${stat('Pareggi', s.d)}
        ${stat('Sconfitte', s.l)}
        ${stat('Gol + assist', s.goals + s.assists)}
        ${stat('Gol squadra', s.gf, 'fatti con lui in campo')}
        ${stat('Gol subiti', s.ga, 'con lui in campo')}
        ${stat('Diff. reti', signed(s.gd))}
        ${stat('Minuti', s.minutesCount ? s.minutes : '—', s.minutesCount ? `${Math.round(s.minutes / s.minutesCount)}' di media` : 'non inseriti')}
        ${stat('Punteggio', rankScore(s), 'classifica')}
        ${stat('Gol/partita', fmt1(s.avgGoals))}
      </div>

      <h2 class="section-title">Strisce</h2>
      <div class="card list">
        ${[['🏆 Vittorie consecutive', s.winStreak], ['🛡️ Imbattuto (sfide)', s.unbeatenStreak], ['⚽ Partite consecutive con gol', s.goalStreak], ['❌ Sconfitte consecutive', s.lossStreak]].map(([l, v]) => `
          <div class="list-row"><span class="grow">${l}</span><span class="streak"><b>${v.cur}</b> attuale</span><span class="streak muted">record ${v.best}</span></div>`).join('')}
      </div>

      ${s.best ? `<h2 class="section-title">⭐ Miglior partita</h2>
      <a class="card best" href="#/match/${s.best.matchId}">
        <div><div class="best-date">${longDate(s.best.date, true)}</div><div class="muted">${teamDot(s.best.teamColor)}${esc(s.best.teamName)} · ${s.best.w ? 'Vittoria' : s.best.l ? 'Sconfitta' : 'Pareggio'}</div></div>
        <div class="best-nums"><span>⚽ ${s.best.goals}</span><span>🎯 ${s.best.assists}</span></div></a>` : ''}

      <h2 class="section-title">Andamento (gol + assist per partita)</h2>
      <div class="card">${lineChart(trend)}</div>

      ${teamRows.length > 1 ? `<h2 class="section-title">% vittorie per squadra</h2><div class="card">${barList(teamRows, { unit: '%', max: 100 })}</div>` : ''}

      <h2 class="section-title">Ultime partite</h2>
      <div class="card list">${[...s.log].reverse().slice(0, 10).map((r) => `
        <a class="list-row" href="#/match/${r.matchId}">
          <span class="res-badge ${r.w > r.l ? 'W' : r.l > r.w ? 'L' : 'D'}">${r.w > r.l ? 'V' : r.l > r.w ? 'S' : 'P'}</span>
          <div class="grow min0"><div class="lr-title">${longDate(r.date)}</div><div class="lr-sub">${teamDot(r.teamColor)}${esc(r.teamName)} · ${r.gf}-${r.ga}${r.games > 1 ? ` in ${r.games} sfide` : ''}</div></div>
          <span class="lr-stats">${r.goals ? `⚽${r.goals}` : ''} ${r.assists ? `🎯${r.assists}` : ''}</span>
        </a>`).join('')}</div>
      <p class="hint center">Punteggio = Gol×${w.goal} + Assist×${w.assist} + Vittorie×${w.win} + Pareggi×${w.draw} + Presenze×${w.presence}</p>
    `;
  },
  actions: {
    filter: (el) => { filter = el.dataset.id; rerender(); },
    edit: () => openPlayerForm(cur(), () => rerender()),
    del: async () => {
      const p = cur();
      const used = state.matches.some((m) => m.teams.some((t) => t.playerIds.includes(p.id)));
      if (!(await confirmDialog(`Eliminare ${p.name}?`, used ? 'Ha già giocato: le partite passate restano, ma comparirà come "Giocatore eliminato" e sparirà dalle classifiche.' : 'Verrà rimosso dalla rosa.', { ok: 'Elimina', danger: true }))) return;
      await remove('players', p.id);
      for (const t of state.teams.filter((x) => x.playerIds.includes(p.id))) await save('teams', { ...t, playerIds: t.playerIds.filter((x) => x !== p.id) });
      go('players');
      toast('Giocatore eliminato');
    },
  },
};
