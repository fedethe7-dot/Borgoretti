/**
 * home.js — Dashboard: partita in corso / ultima partita, prossimo lunedì,
 * numeri chiave della stagione e pulsante "+ NUOVA PARTITA".
 */
import { state, activeSeason, todayISO } from '../db.js';
import { esc, icon, avatar, teamDot, flames } from '../ui.js';
import { filterMatches, playerStats, teamStats, totals, longDate, gameScore } from '../stats.js';
import { resultLine, matchScorers, playerName } from './common.js';

/** Prossimo lunedì (oggi se è lunedì). */
function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
  return todayISO(d);
}

function liveCard(m) {
  const g = m.games.find((x) => x.id === m.activeGameId) || m.games[m.games.length - 1];
  const s = gameScore(g);
  const A = m.teams.find((t) => t.key === g.a), B = m.teams.find((t) => t.key === g.b);
  return `<a class="hero live-hero" href="#/live/${m.id}">
    <div class="hero-eyebrow"><span class="pulse"></span>PARTITA IN CORSO · ${longDate(m.date)}</div>
    <div class="hero-score">
      <span class="hs-team">${teamDot(A.color)}${esc(A.name)}</span>
      <span class="hs-num">${s[A.key]}<i>-</i>${s[B.key]}</span>
      <span class="hs-team right">${esc(B.name)}${teamDot(B.color)}</span>
    </div>
    <span class="btn light block">${icon('whistle')} Riprendi la partita</span>
  </a>`;
}

function lastCard(m) {
  const sc = matchScorers(m).filter((r) => r.goals).sort((a, b) => b.goals - a.goals).slice(0, 3);
  return `<a class="hero" href="#/match/${m.id}">
    <div class="hero-eyebrow">ULTIMA PARTITA · ${longDate(m.date)}</div>
    ${resultLine(m, { big: true })}
    ${sc.length ? `<div class="hero-scorers">⚽ ${sc.map((r) => `${esc(playerName(r.id))}${r.goals > 1 ? ` ×${r.goals}` : ''}`).join(' · ')}</div>` : ''}
  </a>`;
}

function welcome() {
  return `<div class="hero">
    <div class="hero-eyebrow">BENVENUTO</div>
    <h2 class="hero-h">Il tuo Opta del lunedì</h2>
    <p class="hero-p">Crea la prima partita: scegli chi gioca, fai le squadre e registra i gol. Le statistiche si calcolano da sole.</p>
    <a class="hero-link" href="#/settings">Vuoi provare con dati di esempio? Vai in Impostazioni ›</a>
  </div>`;
}

export default {
  render() {
    const live = state.matches.find((m) => m.status === 'live');
    const season = filterMatches('season');
    const all = filterMatches('all');
    const last = all[all.length - 1];
    const tot = totals(season);
    const ps = [...playerStats(season).values()];
    const top = (k) => [...ps].sort((a, b) => b[k] - a[k] || a.presences - b.presences)[0];
    const scorer = top('goals'), assist = top('assists');
    const team = teamStats(season)[0];
    const hot = ps.filter((p) => p.form.matches >= 2).sort((a, b) => b.form.score - a.form.score).slice(0, 3);
    const nm = nextMonday();
    const alreadyPlanned = state.matches.some((m) => m.date === nm);

    const tile = (ic, label, value, sub = '', href = '') => `
      <${href ? `a href="#/${href}"` : 'div'} class="tile">
        <span class="tile-ic">${ic}</span>
        <span class="tile-val">${value}</span>
        <span class="tile-label">${label}</span>
        ${sub ? `<span class="tile-sub">${sub}</span>` : ''}
      </${href ? 'a' : 'div'}>`;

    return `
      <header class="brand-head">
        <div class="brand"><span class="brand-badge">${icon('ball')}</span><div><div class="brand-name">Borgoretti</div>
        <div class="brand-sub">${esc(activeSeason()?.name || '')}</div></div></div>
        <a class="icon-btn" href="#/settings" aria-label="Impostazioni">${icon('gear')}</a>
      </header>

      ${live ? liveCard(live) : last ? lastCard(last) : welcome()}

      ${!live ? `<div class="next-row">
        <span class="next-ic">${icon('calendar')}</span>
        <div class="grow"><div class="next-label">PROSSIMA PARTITA</div><div class="next-date">${longDate(nm)}${nm === todayISO() ? ' · stasera' : ''}</div></div>
        ${alreadyPlanned ? '<span class="pill">già creata</span>' : ''}
      </div>
      <button class="btn primary xl block" data-act="go" data-href="new">${icon('plus')} NUOVA PARTITA</button>` : ''}

      <h2 class="section-title">Stagione in numeri</h2>
      <div class="tiles">
        ${tile('⚽', 'Gol totali', tot.goals, tot.games ? `${(tot.goalsPerGame).toFixed(1).replace('.', ',')} a partita` : '', 'stats')}
        ${tile('🏟️', 'Partite giocate', tot.matches, tot.games > tot.matches ? `${tot.games} sfide` : '', 'matches')}
        ${tile('👥', 'Presenti in media', tot.avgPlayers ? Math.round(tot.avgPlayers) : 0, `${state.players.length} in rosa`, 'players')}
        ${tile('🥇', 'Capocannoniere', scorer?.goals ? esc(playerName(scorer.id)) : '—', scorer?.goals ? `${scorer.goals} gol` : '', 'rankings')}
        ${tile('🎯', 'Top assist', assist?.assists ? esc(playerName(assist.id)) : '—', assist?.assists ? `${assist.assists} assist` : '', 'rankings')}
        ${tile('🏆', 'Squadra più vincente', team ? `${teamDot(team.color)}${esc(team.name)}` : '—', team ? `${team.w} vittorie` : '', 'stats')}
      </div>

      ${hot.length ? `<h2 class="section-title">Chi è in forma</h2>
      <div class="card list">${hot.map((p) => `
        <a class="list-row" href="#/player/${p.id}">${avatar(state.players.find((x) => x.id === p.id))}
          <div class="grow min0"><div class="lr-title">${esc(playerName(p.id))}</div>
          <div class="lr-sub">Ultime ${p.form.matches}: ${p.form.goals} gol · ${p.form.assists} assist · ${p.form.w} V</div></div>
          ${flames(p.form.flames)}</a>`).join('')}</div>` : ''}
    `;
  },
  actions: {},
};
