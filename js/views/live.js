/**
 * live.js — Schermata della partita in corso.
 *
 * "+ GOL" apre un pannello rapido in 2 tocchi:
 *   1) chi ha segnato (la squadra si deduce dal giocatore, modificabile)
 *   2) chi ha fatto l'assist (oppure "Nessun assist")
 * Con 3-4 squadre la giornata è composta da più sfide: si chiude una sfida,
 * se ne avvia un'altra e alla fine si termina la giornata.
 */
import { state, save, remove, uid, getMatch, getPlayer } from '../db.js';
import { esc, icon, avatar, teamVars, teamDot, openSheet, updateSheet, closeSheet, toast, celebrate, confirmDialog } from '../ui.js';
import { gameScore, dayStandings, matchSummary, longDate } from '../stats.js';
import { pageHeader, goalLines } from './common.js';
import { go, rerender } from '../app.js';

const teamOf = (m, key) => m.teams.find((t) => t.key === key);
const activeGame = (m) => m.games.find((g) => g.id === m.activeGameId) || m.games[m.games.length - 1];

/* ------------------------------------------------------------------ */
/* Pannello "+ GOL"                                                    */
/* ------------------------------------------------------------------ */
function openGoalSheet(m, presetTeam = null) {
  const g = activeGame(m);
  const sel = { team: presetTeam, scorer: undefined };
  const sides = [teamOf(m, g.a), teamOf(m, g.b)];

  const playerBtn = (p, act, extra = '') => `<button class="pbtn" data-act="${act}" data-id="${p.id}" ${extra}>${avatar(p, 'sm')}<span>${esc(p.name)}</span></button>`;

  const stepScorer = () => `
    <h3 class="sheet-title">⚽ Chi ha segnato?</h3>
    ${sides.filter((t) => !sel.team || t.key === sel.team).map((t) => `
      <div class="sheet-team" style="--c:${esc(t.color)}">
        <div class="st-head">${teamDot(t.color)}${esc(t.name)}</div>
        <div class="pbtn-grid">
          ${t.playerIds.map(getPlayer).filter(Boolean).map((p) => playerBtn(p, 'scorer', `data-team="${t.key}"`)).join('')}
          <button class="pbtn ghost" data-act="scorer" data-id="" data-team="${t.key}"><span class="av av-sm">?</span><span>Senza marcatore</span></button>
        </div>
      </div>`).join('')}
    ${sel.team ? '<button class="link-btn mt" data-act="showAll">Mostra entrambe le squadre</button>' : ''}`;

  const stepAssist = () => {
    const team = teamOf(m, sel.team);
    const other = sides.find((t) => t.key !== sel.team);
    const scorer = getPlayer(sel.scorer);
    const mates = team.playerIds.filter((id) => id !== sel.scorer).map(getPlayer).filter(Boolean);
    return `
      <div class="goal-recap">
        <span class="gr-ball">⚽</span>
        <div class="grow"><div class="gr-name">${scorer ? esc(scorer.name) : 'Senza marcatore'}</div>
        <div class="gr-team">Gol per ${teamDot(team.color)}<b>${esc(team.name)}</b></div></div>
        <button class="chip" data-act="switchTeam" title="Assegna all'altra squadra">${icon('swap')} ${esc(other.name)}</button>
      </div>
      <h3 class="sheet-title">🎯 Chi ha fatto l'assist?</h3>
      <button class="btn primary block lg" data-act="assist" data-id="">Nessun assist</button>
      <div class="pbtn-grid mt">${mates.map((p) => playerBtn(p, 'assist')).join('')}</div>
      <button class="link-btn mt" data-act="backScorer">${icon('back')} Cambia marcatore</button>`;
  };

  const show = (first = false) => (first ? openSheet(stepScorer(), actions, { cls: 'tall' }) : updateSheet(sel.scorer === undefined ? stepScorer() : stepAssist()));

  const actions = {
    scorer: (el) => { sel.scorer = el.dataset.id || null; sel.team = el.dataset.team; show(); },
    showAll: () => { sel.team = null; show(); },
    switchTeam: () => { sel.team = sides.find((t) => t.key !== sel.team).key; show(); },
    backScorer: () => { sel.scorer = undefined; show(); },
    assist: async (el) => {
      const ev = { id: uid(), type: 'goal', team: sel.team, scorer: sel.scorer || null, assist: el.dataset.id || null, t: Date.now() };
      g.events.push(ev);
      await save('matches', m);
      closeSheet();
      rerender();
      document.getElementById(`score-${ev.team}`)?.classList.add('bump');
      const s = gameScore(g);
      const name = getPlayer(ev.scorer)?.name;
      celebrate('goal', { title: 'GOL!', subtitle: `${name || teamOf(m, ev.team).name} · ${s[g.a]}-${s[g.b]}`, color: teamOf(m, ev.team).color });
      toast(`Gol registrato${name ? `: ${name}` : ''}`, { action: 'Annulla', onAction: () => removeEvent(m, g, ev.id) });
    },
  };
  show(true);
}

async function removeEvent(m, g, id) {
  g.events = g.events.filter((e) => e.id !== id);
  await save('matches', m);
  rerender();
  toast('Gol annullato');
}

/* ------------------------------------------------------------------ */
/* Fine partita / giornata                                             */
/* ------------------------------------------------------------------ */
function openEndSheet(m) {
  const g = activeGame(m);
  const multi = m.teams.length > 2;
  const showMinutes = { open: false };

  const content = () => {
    const s = gameScore(g);
    const A = teamOf(m, g.a), B = teamOf(m, g.b);
    if (multi) {
      const st = dayStandings(m);
      return `<h3 class="sheet-title">🏁 Termina la giornata</h3>
        <p class="muted">Classifica della serata (la sfida in corso viene chiusa così com'è: ${esc(A.name)} ${s[A.key]}-${s[B.key]} ${esc(B.name)}).</p>
        ${standingsTable(st)}
        ${minutesBlock()}
        <button class="btn primary block lg mt" data-act="confirmEnd">${icon('check')} Conferma e salva</button>`;
    }
    const side = (t) => `<div class="end-side" style="--c:${esc(t.color)}">
        <div class="end-name">${teamDot(t.color)}${esc(t.name)}</div>
        <div class="end-ctrl"><button class="round-btn" data-act="adj" data-k="${t.key}" data-d="-1" aria-label="Togli gol">${icon('minus')}</button>
        <span class="end-num">${s[t.key]}</span>
        <button class="round-btn" data-act="adj" data-k="${t.key}" data-d="1" aria-label="Aggiungi gol">${icon('plus')}</button></div></div>`;
    const res = s[A.key] === s[B.key] ? 'Pareggio' : `Vince ${s[A.key] > s[B.key] ? A.name : B.name}`;
    return `<h3 class="sheet-title">🏁 Fine partita</h3>
      <p class="muted">Conferma il risultato. Se avete perso il conto, con + / − aggiungi o togli gol senza marcatore.</p>
      <div class="end-score">${side(A)}<span class="end-dash">-</span>${side(B)}</div>
      <div class="end-result">${esc(res)}</div>
      ${minutesBlock()}
      <button class="btn primary block lg mt" data-act="confirmEnd">${icon('check')} Conferma risultato</button>`;
  };

  // Minuti giocati opzionali per ogni giocatore
  const minutesBlock = () => {
    const ids = m.teams.flatMap((t) => t.playerIds);
    if (!showMinutes.open) return `<button class="link-btn mt" data-act="toggleMin">${icon('clock')} Inserisci minuti giocati (opzionale)</button>`;
    return `<div class="minutes card">
      <div class="row gap"><b class="grow">Minuti giocati</b>
        <button class="chip" data-act="minAll" data-v="60">Tutti 60'</button><button class="chip" data-act="minAll" data-v="90">Tutti 90'</button></div>
      ${ids.map((id) => `<label class="min-row"><span class="grow">${esc(getPlayer(id)?.name || '?')}</span>
        <input class="input sm" type="number" inputmode="numeric" min="0" max="300" id="min-${id}" value="${m.minutes?.[id] ?? ''}" data-input="minSet" data-id="${id}" placeholder="—"></label>`).join('')}
    </div>`;
  };

  const actions = {
    adj: async (el) => {
      const k = el.dataset.k;
      if (+el.dataset.d > 0) g.events.push({ id: uid(), type: 'goal', team: k, scorer: null, assist: null, t: Date.now(), manual: true });
      else {
        // toglie prima i gol senza marcatore, poi l'ultimo gol di quella squadra
        const idx = [...g.events].reverse().findIndex((e) => e.team === k && !e.scorer);
        const idx2 = idx >= 0 ? g.events.length - 1 - idx : g.events.map((e) => e.team).lastIndexOf(k);
        if (idx2 < 0) return;
        g.events.splice(idx2, 1);
      }
      await save('matches', m);
      updateSheet(content());
    },
    toggleMin: () => { showMinutes.open = true; updateSheet(content()); },
    minAll: (el) => { m.minutes = Object.fromEntries(m.teams.flatMap((t) => t.playerIds).map((id) => [id, +el.dataset.v])); updateSheet(content()); },
    minSet: (el) => { m.minutes = m.minutes || {}; if (el.value === '') delete m.minutes[el.dataset.id]; else m.minutes[el.dataset.id] = Math.max(0, +el.value); },
    confirmEnd: async () => {
      g.status = 'done';
      m.status = 'done';
      // rimuove eventuali sfide mai iniziate
      m.games = m.games.filter((x) => x.events.length || x.status === 'done');
      if (!m.games.length) m.games = [g];
      await save('matches', m);
      closeSheet();
      const sum = matchSummary(m);
      celebrate('win', sum.winner ? { title: `${sum.winner.name.toUpperCase()} VINCE!`, subtitle: sum.type === 'single' ? `${sum.score[sum.teams[0].key]}-${sum.score[sum.teams[1].key]}` : 'Vincitrice della serata', color: sum.winner.color } : { title: 'PAREGGIO', subtitle: 'Tutti a casa con un punto' });
      go(`match/${m.id}`);
    },
  };
  openSheet(content(), actions, { cls: 'tall' });
}

function standingsTable(st) {
  return `<table class="table"><thead><tr><th>#</th><th class="left">Squadra</th><th>G</th><th>V</th><th>P</th><th>S</th><th>DR</th><th>Pt</th></tr></thead>
    <tbody>${st.map((r, i) => `<tr><td>${i + 1}</td><td class="left">${teamDot(r.team.color)}${esc(r.team.name)}</td><td>${r.g}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>`;
}

/* Multi-squadra: chiude la sfida e propone la successiva */
function openNextGameSheet(m) {
  const g = activeGame(m);
  const s = gameScore(g);
  // Suggerimento: chi vince resta, entra chi ha riposato di più
  const lastPlayed = {};
  m.games.forEach((x, i) => { lastPlayed[x.a] = i; lastPlayed[x.b] = i; });
  const resting = m.teams.filter((t) => t.key !== g.a && t.key !== g.b).sort((a, b) => (lastPlayed[a.key] ?? -1) - (lastPlayed[b.key] ?? -1));
  const stay = s[g.a] > s[g.b] ? g.a : s[g.b] > s[g.a] ? g.b : null;
  const sug = [];
  if (resting[0]) {
    if (stay) sug.push([stay, resting[0].key]);
    sug.push([g.a, resting[0].key], [g.b, resting[0].key]);
    if (resting[1]) sug.push([resting[0].key, resting[1].key]);
  }
  const pairs = [];
  for (let i = 0; i < m.teams.length; i++) for (let j = i + 1; j < m.teams.length; j++) pairs.push([m.teams[i].key, m.teams[j].key]);
  const uniq = [...new Map([...sug, ...pairs].map((p) => [[...p].sort().join(), p])).values()];
  const label = (p) => `${teamDot(teamOf(m, p[0]).color)}${esc(teamOf(m, p[0]).name)} <i>vs</i> ${esc(teamOf(m, p[1]).name)}${teamDot(teamOf(m, p[1]).color)}`;

  openSheet(`<h3 class="sheet-title">Prossima sfida</h3>
    <p class="muted">Sfida chiusa: ${esc(teamOf(m, g.a).name)} ${s[g.a]}-${s[g.b]} ${esc(teamOf(m, g.b).name)}.${stay ? ` ${esc(teamOf(m, stay).name)} resta in campo.` : ''}</p>
    <div class="stack-s">${uniq.map((p, i) => `<button class="btn ${i === 0 ? 'primary' : 'ghost'} block" data-act="startGame" data-a="${p[0]}" data-b="${p[1]}">${label(p)}</button>`).join('')}</div>
    <button class="link-btn mt" data-act="close-sheet">Annulla</button>`, {
    startGame: async (el) => {
      g.status = 'done';
      const ng = { id: uid(), a: el.dataset.a, b: el.dataset.b, events: [], status: 'live' };
      m.games.push(ng); m.activeGameId = ng.id;
      await save('matches', m);
      closeSheet(); rerender();
      toast('Nuova sfida iniziata');
    },
  });
}

/* Cambia squadra a un giocatore o aggiungi un ritardatario */
function openTeamsSheet(m) {
  const content = () => {
    const inMatch = new Set(m.teams.flatMap((t) => t.playerIds));
    const others = state.players.filter((p) => !inMatch.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
    return `<h3 class="sheet-title">${icon('swap')} Squadre di stasera</h3>
      <p class="muted">Sposta un giocatore toccando la lettera della squadra. I gol già segnati restano alla squadra per cui sono stati segnati.</p>
      <div class="card list assign">${m.teams.flatMap((t) => t.playerIds.map((id) => [id, t.key])).map(([id, key]) => `
        <div class="assign-row">${avatar(getPlayer(id), 'sm')}<span class="grow min0 ellipsis">${esc(getPlayer(id)?.name || '?')}</span>
        <span class="assign-btns">${m.teams.map((t) => `<button class="ab ${t.key === key ? 'on' : ''}" style="${teamVars(t.color)}" data-act="move" data-id="${id}" data-k="${t.key}">${t.key}</button>`).join('')}
        <button class="ab out" data-act="move" data-id="${id}" data-k="" aria-label="Togli">${icon('x')}</button></span></div>`).join('')}</div>
      ${others.length ? `<div class="field-label mt">Aggiungi un giocatore</div>
      <div class="card list assign">${others.map((p) => `<div class="assign-row">${avatar(p, 'sm')}<span class="grow min0 ellipsis">${esc(p.name)}</span>
        <span class="assign-btns">${m.teams.map((t) => `<button class="ab" style="${teamVars(t.color)}" data-act="move" data-id="${p.id}" data-k="${t.key}">${t.key}</button>`).join('')}</span></div>`).join('')}</div>` : ''}
      <button class="btn primary block mt" data-act="close-sheet">Fatto</button>`;
  };
  openSheet(content(), {
    move: async (el) => {
      const { id, k } = el.dataset;
      for (const t of m.teams) t.playerIds = t.playerIds.filter((x) => x !== id);
      if (k) teamOf(m, k).playerIds.push(id);
      await save('matches', m);
      updateSheet(content());
      rerender();
    },
  }, { cls: 'tall' });
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */
export default {
  render(id) {
    const m = getMatch(id);
    if (!m) return `${pageHeader('Partita', { back: true })}<p class="muted">Partita non trovata.</p>`;
    if (m.status !== 'live') { setTimeout(() => go(`match/${id}`)); return ''; }
    const g = activeGame(m);
    const s = gameScore(g);
    const A = teamOf(m, g.a), B = teamOf(m, g.b);
    const multi = m.teams.length > 2;
    const lines = goalLines(g, Object.fromEntries(m.teams.map((t) => [t.key, t]))).reverse();

    const sideBlock = (t) => `<button class="sb-side" data-act="goalFor" data-k="${t.key}" style="--c:${esc(t.color)}">
      <span class="sb-shirt">${icon('shirt')}</span>
      <span class="sb-name">${esc(t.name)}</span>
      <span class="sb-score" id="score-${t.key}">${s[t.key]}</span>
      <span class="sb-add">${icon('plus')} gol</span></button>`;

    return `
      ${pageHeader(multi ? `Sfida ${m.games.indexOf(g) + 1}` : 'Partita in corso', {
        back: false, sub: `<span class="pulse"></span> ${longDate(m.date)}`,
        right: `<button class="icon-btn" data-act="teams" aria-label="Squadre">${icon('users')}</button><a class="icon-btn" href="#/home" aria-label="Home">${icon('home')}</a>`,
      })}

      <div class="scoreboard">
        ${sideBlock(A)}
        <span class="sb-vs">-</span>
        ${sideBlock(B)}
      </div>

      <button class="btn goal-btn" data-act="goal">⚽ + GOL</button>

      <div class="row gap">
        ${multi ? `<button class="btn ghost grow" data-act="nextGame">${icon('next')} Chiudi sfida</button>` : ''}
        <button class="btn end-btn grow" data-act="end">${icon('whistle')} ${multi ? 'TERMINA GIORNATA' : 'FINE PARTITA'}</button>
      </div>

      ${multi ? `<h2 class="section-title">Classifica della serata</h2><div class="card pad0 scroll-x">${standingsTable(dayStandings(m))}</div>
        <div class="games-strip">${m.games.map((x, i) => { const sc = gameScore(x); return `<button class="game-pill ${x.id === g.id ? 'on' : ''}" data-act="pickGame" data-id="${x.id}">#${i + 1} ${esc(teamOf(m, x.a).name)} ${sc[x.a]}-${sc[x.b]} ${esc(teamOf(m, x.b).name)}</button>`; }).join('')}</div>` : ''}

      <h2 class="section-title">Cronaca ${lines.length ? `<span class="count">${lines.length}</span>` : ''}</h2>
      ${lines.length ? `<div class="card list timeline">${lines.map((l) => `
        <div class="tl-row" style="--c:${esc(l.team.color)}">
          <span class="tl-score">${l.score}</span>
          <div class="grow min0"><div class="tl-main">⚽ ${l.scorer ? esc(l.scorer.name) : '<span class="muted">Senza marcatore</span>'}</div>
          <div class="tl-sub">${teamDot(l.team.color)}${esc(l.team.name)}${l.assist ? ` · 🎯 ${esc(l.assist.name)}` : ''}</div></div>
          <button class="icon-btn sm" data-act="delEvent" data-id="${l.e.id}" aria-label="Elimina gol">${icon('trash')}</button>
        </div>`).join('')}</div>` : '<div class="card muted center">Nessun gol ancora. Tocca <b>+ GOL</b> quando qualcuno segna.</div>'}

      <h2 class="section-title">Formazioni</h2>
      <div class="lineups">${m.teams.map((t) => `<div class="card lineup" style="--c:${esc(t.color)}"><div class="lu-head">${teamDot(t.color)}${esc(t.name)}</div>
        ${t.playerIds.map((id) => `<div class="lu-p">${esc(getPlayer(id)?.name || '?')}</div>`).join('')}</div>`).join('')}</div>

      <button class="link-btn danger mt" data-act="discard">${icon('trash')} Elimina questa partita</button>
    `;
  },

  actions: {
    goal: (el) => openGoalSheet(cur()),
    goalFor: (el) => openGoalSheet(cur(), el.dataset.k),
    end: () => openEndSheet(cur()),
    nextGame: () => openNextGameSheet(cur()),
    teams: () => openTeamsSheet(cur()),
    pickGame: async (el) => { const m = cur(); m.activeGameId = el.dataset.id; await save('matches', m); rerender(); },
    delEvent: async (el) => {
      const m = cur(); const g = activeGame(m);
      if (await confirmDialog('Eliminare il gol?', 'Il risultato verrà aggiornato.', { ok: 'Elimina', danger: true })) removeEvent(m, g, el.dataset.id);
    },
    discard: async () => {
      if (!(await confirmDialog('Eliminare la partita?', 'Tutti i gol registrati verranno persi.', { ok: 'Elimina', danger: true }))) return;
      await remove('matches', cur().id);
      go('home');
    },
  },
};

const cur = () => getMatch(location.hash.split('/')[2]);
