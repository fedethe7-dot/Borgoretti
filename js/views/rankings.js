/**
 * rankings.js — Classifiche: giocatori (punteggio), marcatori, assist,
 * presenze, forma e squadre. Il punteggio è sempre spiegato.
 */
import { state, getPlayer } from '../db.js';
import { esc, icon, avatar, teamDot, flames, shareText } from '../ui.js';
import { playerStats, teamStats, filterMatches, FILTERS, fmt1, pct, signed } from '../stats.js';
import { formDots } from '../charts.js';
import { pageHeader, filterBar, tabs, emptyState } from './common.js';
import { rerender } from '../app.js';

let tab = 'overall';
let filter = null;

const TABS = [
  { id: 'overall', label: '🏆 Giocatori' },
  { id: 'goals', label: '⚽ Marcatori' },
  { id: 'assists', label: '🎯 Assist' },
  { id: 'presences', label: '👕 Presenze' },
  { id: 'form', label: '🔥 Forma' },
  { id: 'teams', label: '🏟️ Squadre' },
];

const medal = (i) => (i < 3 ? ['🥇', '🥈', '🥉'][i] : `<span class="pos">${i + 1}</span>`);

/** Righe ordinate per la tab corrente. */
function rows(f) {
  const list = [...playerStats(filterMatches(f)).values()].filter((p) => getPlayer(p.id));
  const by = {
    overall: (a, b) => b.points - a.points || b.goals - a.goals,
    goals: (a, b) => b.goals - a.goals || a.presences - b.presences || b.assists - a.assists,
    assists: (a, b) => b.assists - a.assists || a.presences - b.presences || b.goals - a.goals,
    presences: (a, b) => b.presences - a.presences || b.games - a.games,
    form: (a, b) => b.form.score - a.form.score || b.form.goals - a.form.goals,
  }[tab];
  return list.sort(by);
}

export default {
  render() {
    const f = filter || state.settings.statsFilter || 'season';
    const w = state.settings.weights;
    let body = '';

    if (tab === 'teams') {
      const ts = teamStats(filterMatches(f));
      body = ts.length ? `<div class="card pad0 scroll-x"><table class="table rank"><thead><tr><th></th><th class="left">Squadra</th><th>G</th><th>V</th><th>P</th><th>S</th><th>GF</th><th>GS</th><th>DR</th><th>%V</th></tr></thead><tbody>
        ${ts.map((t, i) => `<tr><td>${medal(i)}</td><td class="left nowrap">${teamDot(t.color)}${esc(t.name)}${t.temporary ? ' <span class="pill sm">temp.</span>' : ''}</td><td>${t.games}</td><td><b>${t.w}</b></td><td>${t.d}</td><td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td><td>${signed(t.gd)}</td><td>${pct(t.winPct)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="card list mt">${ts.map((t) => `<div class="list-row">${teamDot(t.color)}<span class="grow">${esc(t.name)}</span>${formDots(t.last5)}</div>`).join('')}</div>`
        : emptyState('Nessun dato', 'Gioca qualche partita per vedere la classifica delle squadre.');
    } else {
      const list = rows(f);
      const val = {
        overall: (p) => `<b class="big-num">${p.points}</b><small>pt</small>`,
        goals: (p) => `<b class="big-num">${p.goals}</b><small>${fmt1(p.avgGoals)}/p</small>`,
        assists: (p) => `<b class="big-num">${p.assists}</b><small>${fmt1(p.avgAssists)}/p</small>`,
        presences: (p) => `<b class="big-num">${p.presences}</b><small>${p.games} sfide</small>`,
        form: (p) => `${flames(p.form.flames)}<small>${p.form.score}/100</small>`,
      }[tab];
      const sub = {
        overall: (p) => `⚽${p.goals} · 🎯${p.assists} · ${p.w}V ${p.d}P ${p.l}S · ${p.presences} pres`,
        goals: (p) => `${p.presences} presenze · ${p.assists} assist`,
        assists: (p) => `${p.presences} presenze · ${p.goals} gol`,
        presences: (p) => `${pct(p.winPct)} vittorie · ${p.goals} gol`,
        form: (p) => `Ultime ${p.form.matches}: ⚽${p.form.goals} 🎯${p.form.assists} · ${p.form.w}V ${p.form.l}S`,
      }[tab];
      body = list.length ? `<div class="card list">${list.map((p, i) => `
        <a class="list-row rank-row ${i < 3 ? 'top' : ''}" href="#/player/${p.id}">
          <span class="medal">${medal(i)}</span>${avatar(getPlayer(p.id), 'sm')}
          <div class="grow min0"><div class="lr-title">${esc(getPlayer(p.id).name)}</div><div class="lr-sub">${sub(p)}</div></div>
          <span class="rank-val">${val(p)}</span></a>`).join('')}</div>
        ${tab === 'overall' ? `<div class="card formula"><b>Come si calcola il punteggio</b>
          <div>Gol × ${w.goal} + Assist × ${w.assist} + Vittorie × ${w.win} + Pareggi × ${w.draw} + Presenze × ${w.presence}</div>
          <div class="hint">I pesi si cambiano in Impostazioni. I dati reali sono sempre visibili sotto ogni nome.</div></div>` : ''}
        ${tab === 'form' ? '<div class="card formula"><b>Indice forma</b><div>Ultime 5 presenze: 60% risultati (punti fatti/punti possibili) + 40% contributo (gol + 0,75×assist a partita, pieno da 2 in su). 🔥 = 20 punti.</div></div>' : ''}`
        : emptyState('Nessun dato', 'Nessuna partita nel periodo selezionato.');
    }

    return `
      ${pageHeader('Classifiche', { sub: FILTERS.find((x) => x.id === f).label, right: `<button class="icon-btn" data-act="share" aria-label="Condividi classifica">${icon('share')}</button>` })}
      ${tabs(TABS, tab)}
      ${filterBar(f)}
      ${body}`;
  },
  actions: {
    tab: (el) => { tab = el.dataset.id; rerender(); },
    filter: (el) => { filter = el.dataset.id; rerender(); },
    share: () => {
      const f = filter || state.settings.statsFilter || 'season';
      const label = TABS.find((t) => t.id === tab).label;
      let lines;
      if (tab === 'teams') lines = teamStats(filterMatches(f)).map((t, i) => `${i + 1}. ${t.name} — ${t.w}V ${t.d}P ${t.l}S (DR ${signed(t.gd)})`);
      else {
        const v = { overall: (p) => `${p.points} pt`, goals: (p) => `${p.goals} gol`, assists: (p) => `${p.assists} assist`, presences: (p) => `${p.presences} presenze`, form: (p) => `${'🔥'.repeat(p.form.flames)} (${p.form.score})` }[tab];
        lines = rows(f).slice(0, 15).map((p, i) => `${i + 1}. ${getPlayer(p.id).name} — ${v(p)}`);
      }
      shareText('Classifica Borgoretti', [`Borgoretti · ${label}`, `(${FILTERS.find((x) => x.id === f).label})`, '', ...lines].join('\n'));
    },
  },
};
