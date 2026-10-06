/**
 * matchDetail.js — Dettaglio di una giornata: risultato, cronaca dei gol,
 * formazioni del giorno, marcatori e assistman.
 */
import { save, remove, getMatch, getPlayer } from '../db.js';
import { esc, icon, avatar, teamDot, confirmDialog, openSheet, closeSheet, shareText, toast } from '../ui.js';
import { gameScore, dayStandings, matchSummary, longDate } from '../stats.js';
import { pageHeader, resultLine, goalLines, matchScorers, playerName } from './common.js';
import { go, rerender } from '../app.js';

const cur = () => getMatch(location.hash.split('/')[2]);

/** Testo del resoconto da condividere (WhatsApp ecc.). */
function matchText(m) {
  const sum = matchSummary(m);
  const lines = [`⚽ Borgoretti — ${longDate(m.date, true)}`, ''];
  for (const g of m.games) {
    const s = gameScore(g);
    const A = m.teams.find((t) => t.key === g.a), B = m.teams.find((t) => t.key === g.b);
    lines.push(`${A.name} ${s[g.a]} - ${s[g.b]} ${B.name}`);
  }
  if (sum.type === 'tournament') lines.push('', sum.winner ? `🏆 Vince la serata: ${sum.winner.name}` : '🤝 Serata in parità');
  const sc = matchScorers(m);
  const g = sc.filter((r) => r.goals).sort((a, b) => b.goals - a.goals);
  const a = sc.filter((r) => r.assists).sort((x, y) => y.assists - x.assists);
  if (g.length) lines.push('', '⚽ Marcatori: ' + g.map((r) => `${playerName(r.id)}${r.goals > 1 ? ` ${r.goals}` : ''}`).join(', '));
  if (a.length) lines.push('🎯 Assist: ' + a.map((r) => `${playerName(r.id)}${r.assists > 1 ? ` ${r.assists}` : ''}`).join(', '));
  return lines.join('\n');
}

export default {
  render(id) {
    const m = getMatch(id);
    if (!m) return `${pageHeader('Partita', { back: true })}<p class="muted">Partita non trovata.</p>`;
    const byKey = Object.fromEntries(m.teams.map((t) => [t.key, t]));
    const sc = matchScorers(m);
    const scorers = sc.filter((r) => r.goals).sort((a, b) => b.goals - a.goals || b.assists - a.assists);
    const assisters = sc.filter((r) => r.assists).sort((a, b) => b.assists - a.assists);
    const per = Object.fromEntries(sc.map((r) => [r.id, r]));
    const sum = matchSummary(m);
    const multi = m.teams.length > 2;
    const nPlayers = m.teams.reduce((n, t) => n + t.playerIds.length, 0);

    return `
      ${pageHeader(longDate(m.date), {
        back: true, sub: `${nPlayers} giocatori · ${m.teams.length} squadre`,
        right: `<button class="icon-btn" data-act="share" aria-label="Condividi">${icon('share')}</button><button class="icon-btn" data-act="menu" aria-label="Modifica">${icon('edit')}</button>`,
      })}

      <div class="hero compact">
        ${resultLine(m, { big: true })}
        <div class="hero-result">${sum.draw ? '🤝 Pareggio' : `🏆 Vince ${esc(sum.winner.name)}`}</div>
      </div>

      ${multi ? `<h2 class="section-title">Classifica della serata</h2><div class="card pad0 scroll-x"><table class="table"><thead><tr><th>#</th><th class="left">Squadra</th><th>G</th><th>V</th><th>P</th><th>S</th><th>GF</th><th>GS</th><th>Pt</th></tr></thead><tbody>
        ${dayStandings(m).map((r, i) => `<tr><td>${i + 1}</td><td class="left">${teamDot(r.team.color)}${esc(r.team.name)}</td><td>${r.g}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div>` : ''}

      <h2 class="section-title">Cronaca</h2>
      ${m.games.map((g, i) => {
        const s = gameScore(g);
        const lines = goalLines(g, byKey);
        return `<div class="card">
          ${multi ? `<div class="game-head">Sfida ${i + 1}: ${teamDot(byKey[g.a].color)}${esc(byKey[g.a].name)} <b>${s[g.a]}-${s[g.b]}</b> ${esc(byKey[g.b].name)}${teamDot(byKey[g.b].color)}</div>` : ''}
          ${lines.length ? `<div class="list timeline">${lines.map((l) => `
            <div class="tl-row" style="--c:${esc(l.team.color)}"><span class="tl-score">${l.score}</span>
              <div class="grow min0"><div class="tl-main">⚽ ${l.scorer ? esc(l.scorer.name) : '<span class="muted">Senza marcatore</span>'}</div>
              <div class="tl-sub">${teamDot(l.team.color)}${esc(l.team.name)} · ${l.assist ? `🎯 ${esc(l.assist.name)}` : 'Assist: nessuno'}</div></div></div>`).join('')}</div>` : '<p class="muted">Nessun gol registrato.</p>'}
        </div>`;
      }).join('')}

      <div class="two-col">
        <div><h2 class="section-title">⚽ Marcatori</h2><div class="card list">${scorers.length ? scorers.map((r) => `
          <a class="list-row" href="#/player/${r.id}">${avatar(r.player, 'sm')}<span class="grow">${esc(playerName(r.id))}</span><b class="big-num">${r.goals}</b></a>`).join('') : '<p class="muted">—</p>'}</div></div>
        <div><h2 class="section-title">🎯 Assistman</h2><div class="card list">${assisters.length ? assisters.map((r) => `
          <a class="list-row" href="#/player/${r.id}">${avatar(r.player, 'sm')}<span class="grow">${esc(playerName(r.id))}</span><b class="big-num">${r.assists}</b></a>`).join('') : '<p class="muted">—</p>'}</div></div>
      </div>

      <h2 class="section-title">Squadre e presenti</h2>
      <div class="lineups">${m.teams.map((t) => `<div class="card lineup" style="--c:${esc(t.color)}">
        <div class="lu-head">${teamDot(t.color)}${esc(t.name)}${t.teamId ? '' : ' <span class="pill sm">temp.</span>'}</div>
        ${t.playerIds.map((pid) => { const r = per[pid]; return `<a class="lu-p" href="#/player/${pid}">${esc(playerName(pid))}
          <span class="lu-stats">${r?.goals ? `⚽${r.goals > 1 ? r.goals : ''}` : ''}${r?.assists ? ` 🎯${r.assists > 1 ? r.assists : ''}` : ''}${m.minutes?.[pid] ? ` <span class="muted">${m.minutes[pid]}'</span>` : ''}</span></a>`; }).join('')}
      </div>`).join('')}</div>
    `;
  },

  actions: {
    share: () => shareText('Borgoretti', matchText(cur())),
    menu: () => {
      const m = cur();
      openSheet(`<h3 class="sheet-title">Modifica partita</h3>
        <div class="stack-s">
          <button class="btn ghost block" data-act="reopen">${icon('whistle')} Riapri per modificare gol e squadre</button>
          <label class="field-label" for="md-date">${icon('calendar')} Cambia data</label>
          <input type="date" class="input" id="md-date" value="${m.date}" data-change="setDate">
          <button class="btn danger block mt" data-act="del">${icon('trash')} Elimina partita</button>
        </div>`, {
        reopen: async () => { m.status = 'live'; const g = m.games[m.games.length - 1]; g.status = 'live'; m.activeGameId = g.id; await save('matches', m); closeSheet(); go(`live/${m.id}`); },
        setDate: async (el) => { if (!el.value) return; m.date = el.value; await save('matches', m); closeSheet(); rerender(); toast('Data aggiornata'); },
        del: async () => {
          if (!(await confirmDialog('Eliminare la partita?', 'Gol, assist e risultato di questa giornata verranno rimossi dalle statistiche.', { ok: 'Elimina', danger: true }))) return;
          await remove('matches', m.id);
          go('matches');
          toast('Partita eliminata');
        },
      });
    },
  },
};
