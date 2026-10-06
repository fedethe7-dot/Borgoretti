/**
 * stats.js (view) — Statistiche "tipo Opta": totali, confronto squadre,
 * leader per categoria, strisce e grafici, con filtri temporali.
 */
import { state, getPlayer, saveSettings } from '../db.js';
import { esc, teamDot } from '../ui.js';
import { playerStats, teamStats, headToHead, filterMatches, totals, goalsTimeline, FILTERS, fmt1, pct, signed, shortDate } from '../stats.js';
import { lineChart, barList, columnChart, pairChart, splitBar, formDots } from '../charts.js';
import { pageHeader, filterBar, emptyState } from './common.js';
import { rerender } from '../app.js';

let cmp = { a: null, b: null };
let trendPlayer = null;

/** Confronto tra due squadre con evidenza della migliore per ogni voce. */
function teamCompare(ts, f) {
  if (ts.length < 2) return ts.length ? '<div class="card muted">Serve almeno un\'altra squadra per il confronto.</div>' : '';
  const A = ts.find((t) => t.id === cmp.a) || ts[0];
  const B = ts.find((t) => t.id === cmp.b && t.id !== A.id) || ts.find((t) => t.id !== A.id);
  const h2h = headToHead(A.id, B.id, filterMatches(f));

  // [etichetta, valA, valB, più alto è meglio?, formattazione]
  const metrics = [
    ['Partite', A.games, B.games, null],
    ['Vittorie', A.w, B.w, true],
    ['Pareggi', A.d, B.d, null],
    ['Sconfitte', A.l, B.l, false],
    ['% vittorie', A.winPct, B.winPct, true, pct],
    ['Gol fatti', A.gf, B.gf, true],
    ['Gol subiti', A.ga, B.ga, false],
    ['Differenza reti', A.gd, B.gd, true, signed],
    ['Gol fatti a partita', A.avgGf, B.avgGf, true, fmt1],
    ['Gol subiti a partita', A.avgGa, B.avgGa, false, fmt1],
  ];
  const lead = (a, b, hi) => (hi === null || a === b ? 0 : (hi ? a > b : a < b) ? -1 : 1);
  const select = (side, sel) => `<select class="input team-select" data-change="cmp" data-side="${side}" id="cmp-${side}" style="--c:${esc(sel.color)}">
    ${ts.map((t) => `<option value="${esc(t.id)}" ${t.id === sel.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;

  // Badge "chi è meglio" mostrati graficamente
  const badges = [
    ['Vince di più', A.winPct, B.winPct, true],
    ['Più vittorie', A.w, B.w, true],
    ['Segna di più', A.avgGf, B.avgGf, true],
    ['Subisce meno', A.avgGa, B.avgGa, false],
    ['Miglior diff. reti', A.gd, B.gd, true],
  ];

  return `<div class="card compare">
    <div class="cmp-head">${select('a', A)}<span class="vs">VS</span>${select('b', B)}</div>
    <div class="cmp-form"><span>${formDots(A.last5)}</span><span class="muted">ultime 5</span><span>${formDots(B.last5)}</span></div>
    ${metrics.map(([label, a, b, hi, fm = (x) => x]) => { const l = lead(a, b, hi); return `
      <div class="cmp-row">
        <span class="cmp-v ${l === -1 ? 'lead' : ''}">${fm(a)}</span>
        <div class="cmp-mid"><span class="cmp-label">${label}</span>${splitBar(Math.max(0, hi === false ? b : a), Math.max(0, hi === false ? a : b), A.color, B.color)}</div>
        <span class="cmp-v ${l === 1 ? 'lead' : ''}">${fm(b)}</span>
      </div>`; }).join('')}
    <div class="badges">${badges.map(([l, a, b, hi]) => { const r = lead(a, b, hi); const t = r === -1 ? A : r === 1 ? B : null; return `<span class="badge">${l}<b>${t ? `${teamDot(t.color)}${esc(t.name)}` : 'Pari'}</b></span>`; }).join('')}</div>
    ${h2h.games ? `<div class="h2h"><div class="h2h-title">Scontri diretti</div>
      <div class="h2h-nums"><span><b>${h2h.a}</b> ${esc(A.name)}</span><span><b>${h2h.d}</b> pareggi</span><span><b>${h2h.b}</b> ${esc(B.name)}</span></div>
      ${splitBar(h2h.a + h2h.d / 2, h2h.b + h2h.d / 2, A.color, B.color)}
      <div class="hint">Gol negli scontri diretti: ${h2h.gfA} - ${h2h.gfB} · ultimi: ${h2h.list.slice(-3).reverse().map((x) => `${shortDate(x.date)} ${x.sa}-${x.sb}`).join(', ')}</div></div>` : ''}
  </div>`;
}

/** Card leader con podio. */
function leaderCard(title, list, value, unit = '') {
  const top = list.slice(0, 3);
  return `<div class="card leader"><div class="leader-title">${title}</div>
    ${top.length ? top.map((p, i) => `<a class="leader-row ${i === 0 ? 'first' : ''}" href="#/player/${p.id}"><span class="lpos">${i + 1}</span><span class="grow ellipsis">${esc(getPlayer(p.id).name)}</span><b>${value(p)}${unit}</b></a>`).join('') : '<div class="muted">—</div>'}</div>`;
}

export default {
  render() {
    const f = state.settings.statsFilter || 'season';
    const matches = filterMatches(f);
    const tot = totals(matches);
    const ps = [...playerStats(matches).values()].filter((p) => getPlayer(p.id));
    const ts = teamStats(matches);
    const head = `${pageHeader('Statistiche', { sub: `${FILTERS.find((x) => x.id === f).label} · ${tot.matches} partite` })}${filterBar(f)}`;
    if (!matches.length) return head + emptyState('Nessuna partita nel periodo', 'Cambia filtro o gioca la prima partita.');

    const sortBy = (k, minPres = 0) => [...ps].filter((p) => p.presences >= minPres).sort((a, b) => b[k] - a[k] || b.presences - a.presences);
    // Soglia minima di presenze per le medie (evita che 1 partita falsi la classifica)
    const minPres = Math.max(1, Math.ceil(tot.matches * 0.3));
    const draws = ts.reduce((s, t) => s + t.d, 0) / 2;

    if (trendPlayer && !getPlayer(trendPlayer)) trendPlayer = null;
    const tp = trendPlayer || sortBy('goals')[0]?.id;
    const tpStats = ps.find((p) => p.id === tp);

    const tile = (v, l) => `<div class="tile small"><span class="tile-val">${v}</span><span class="tile-label">${l}</span></div>`;
    const streakLeader = (k, label) => {
      const cur = [...ps].sort((a, b) => b[k].cur - a[k].cur)[0];
      const rec = [...ps].sort((a, b) => b[k].best - a[k].best)[0];
      return `<div class="list-row"><span class="grow">${label}</span>
        <span class="streak">${cur?.[k].cur ? `<b>${cur[k].cur}</b> ${esc(getPlayer(cur.id).name)}` : '—'}</span>
        <span class="streak muted">rec. ${rec?.[k].best || 0} ${rec?.[k].best ? esc(getPlayer(rec.id).name) : ''}</span></div>`;
    };

    return `${head}
      <div class="tiles four">
        ${tile(tot.goals, 'Gol totali')}${tile(tot.assists, 'Assist totali')}
        ${tile(fmt1(tot.goalsPerGame), 'Gol a partita')}${tile(fmt1(tot.assistsPerGame), 'Assist a partita')}
        ${tile(tot.matches, 'Giornate')}${tile(tot.games, 'Sfide')}
        ${tile(draws, 'Pareggi')}${tile(Math.round(tot.avgPlayers), 'Presenti in media')}
      </div>

      <h2 class="section-title">🆚 Confronto squadre</h2>
      ${teamCompare(ts, f)}
      ${ts.length ? `<div class="card"><div class="card-title">Vittorie per squadra</div>${columnChart(ts.slice(0, 6).map((t) => ({ label: t.name, value: t.w, color: t.color })))}</div>
      <div class="card"><div class="card-title">Gol fatti e subiti</div>${pairChart(ts.slice(0, 6).map((t) => ({ label: t.name, a: t.gf, b: t.ga, color: t.color })))}</div>` : ''}

      <h2 class="section-title">Leader</h2>
      <div class="leaders">
        ${leaderCard('🥇 Capocannoniere', sortBy('goals'), (p) => p.goals)}
        ${leaderCard('🎯 Top assist', sortBy('assists'), (p) => p.assists)}
        ${leaderCard('🏆 Più vittorie', sortBy('w'), (p) => p.w)}
        ${leaderCard('👟 Presenze', sortBy('presences'), (p) => p.presences)}
        ${leaderCard('🔥 Media gol', sortBy('avgGoals', minPres), (p) => fmt1(p.avgGoals))}
        ${leaderCard('🎯 Media assist', sortBy('avgAssists', minPres), (p) => fmt1(p.avgAssists))}
        ${leaderCard('📈 % vittorie', sortBy('winPct', minPres), (p) => pct(p.winPct))}
        ${leaderCard('➕ Diff. reti', sortBy('gd', minPres), (p) => signed(p.gd))}
      </div>
      <p class="hint">Medie e percentuali: solo chi ha almeno ${minPres} presenze nel periodo.</p>

      <h2 class="section-title">Strisce in corso e record</h2>
      <div class="card list">
        ${streakLeader('winStreak', '🏆 Vittorie di fila')}
        ${streakLeader('unbeatenStreak', '🛡️ Senza perdere')}
        ${streakLeader('goalStreak', '⚽ Partite con gol')}
        ${streakLeader('lossStreak', '❌ Sconfitte di fila')}
      </div>

      <h2 class="section-title">Grafici</h2>
      <div class="card"><div class="card-title">Gol per giornata</div>${lineChart(goalsTimeline(matches))}</div>
      <div class="card"><div class="card-title">Classifica marcatori</div>${barList(sortBy('goals').filter((p) => p.goals).map((p) => ({ label: getPlayer(p.id).name, value: p.goals })))}</div>
      <div class="card"><div class="card-title">Classifica assist</div>${barList(sortBy('assists').filter((p) => p.assists).map((p) => ({ label: getPlayer(p.id).name, value: p.assists, color: 'var(--accent-2)' })))}</div>
      <div class="card"><div class="card-title">Presenze</div>${barList(sortBy('presences').map((p) => ({ label: getPlayer(p.id).name, value: p.presences, color: 'var(--muted-bar)' })), { limit: 30 })}</div>

      <div class="card">
        <div class="row between gap"><div class="card-title">Rendimento di</div>
        <select class="input sm-select" data-change="trend" id="trend-player">${[...ps].sort((a, b) => getPlayer(a.id).name.localeCompare(getPlayer(b.id).name)).map((p) => `<option value="${p.id}" ${p.id === tp ? 'selected' : ''}>${esc(getPlayer(p.id).name)}</option>`).join('')}</select></div>
        ${tpStats ? lineChart(tpStats.log.map((r) => ({ label: shortDate(r.date), value: r.goals + r.assists })), { color: 'var(--accent-2)' }) : ''}
        <div class="hint">Gol + assist per partita</div>
      </div>
    `;
  },
  actions: {
    filter: async (el) => { await saveSettings({ statsFilter: el.dataset.id }); rerender(); },
    cmp: (el) => { cmp[el.dataset.side] = el.value; rerender(); },
    trend: (el) => { trendPlayer = el.value; rerender(); },
  },
};
