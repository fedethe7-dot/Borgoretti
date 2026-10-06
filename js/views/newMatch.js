/**
 * newMatch.js — Creazione guidata di una nuova partita in 4 passi:
 *   1. Data e quanti giocatori siamo
 *   2. Chi gioca
 *   3. Quante squadre e quali (abituali o temporanee)
 *   4. Composizione delle squadre
 * Alla conferma viene creata la giornata con una COPIA delle squadre
 * (lo storico non cambia se in futuro si modificano le rose abituali).
 */
import { state, save, uid, todayISO, getPlayer } from '../db.js';
import { esc, icon, avatar, teamVars, toast, TEAM_COLORS, teamDot, confirmDialog } from '../ui.js';
import { finishedMatches, playerStats, rankScore, longDate, byDate } from '../stats.js';
import { pageHeader, sortedPlayers } from './common.js';
import { go, rerender } from '../app.js';

const KEYS = ['A', 'B', 'C', 'D'];
let draft = null;

function nextMondayISO() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
  return todayISO(d);
}

/** Bozza iniziale: propone i presenti e le squadre dell'ultima partita. */
function newDraft() {
  const last = [...state.matches].sort(byDate).pop();
  return {
    step: 1,
    date: new Date().getDay() === 1 ? todayISO() : nextMondayISO(),
    target: last ? last.teams.reduce((n, t) => n + t.playerIds.length, 0) : 10,
    playerIds: new Set(),
    nTeams: last?.teams.length || 2,
    slots: [],
    assign: {},
    updateRosters: false,
    search: '',
  };
}

/** Squadre abituali ordinate per utilizzo. */
function savedTeamsByUse() {
  const use = {};
  for (const m of state.matches) for (const t of m.teams) if (t.teamId) use[t.teamId] = (use[t.teamId] || 0) + 1;
  return [...state.teams].sort((a, b) => (use[b.id] || 0) - (use[a.id] || 0) || a.name.localeCompare(b.name));
}

/** Prepara gli slot delle squadre in base al numero scelto. */
function buildSlots() {
  const saved = savedTeamsByUse();
  const used = new Set(draft.slots.map((s) => s.teamId).filter(Boolean));
  const out = [];
  for (let i = 0; i < draft.nTeams; i++) {
    if (draft.slots[i]) { out.push(draft.slots[i]); continue; }
    const t = saved.find((x) => !used.has(x.id));
    if (t) { used.add(t.id); out.push({ key: KEYS[i], teamId: t.id, name: t.name, color: t.color }); }
    else {
      const usedColors = new Set(out.map((s) => s.color));
      const c = TEAM_COLORS.find((x) => !usedColors.has(x.hex));
      out.push({ key: KEYS[i], teamId: null, name: `Squadra ${c.name}`, color: c.hex, saveAsTeam: false });
    }
  }
  draft.slots = out.map((s, i) => ({ ...s, key: KEYS[i] }));
}

/** Assegna i giocatori in base alle rose abituali delle squadre scelte. */
function assignFromRosters() {
  draft.assign = {};
  for (const s of draft.slots) {
    const t = s.teamId && state.teams.find((x) => x.id === s.teamId);
    for (const pid of t?.playerIds || []) if (draft.playerIds.has(pid) && !draft.assign[pid]) draft.assign[pid] = s.key;
  }
}

/** Squadre casuali bilanciate nel numero. */
function assignRandom() {
  const ids = [...draft.playerIds].sort(() => Math.random() - 0.5);
  draft.assign = {};
  ids.forEach((pid, i) => { draft.assign[pid] = KEYS[i % draft.nTeams]; });
}

/**
 * Squadre bilanciate: ordina per punteggio medio a presenza e distribuisce
 * "a serpentina" (A B B A A B...) per equilibrare i valori.
 */
function assignBalanced() {
  const ps = playerStats(finishedMatches());
  const val = (pid) => { const p = ps.get(pid); return p?.presences ? rankScore(p) / p.presences : 0; };
  const ids = [...draft.playerIds].sort((a, b) => val(b) - val(a) || Math.random() - 0.5);
  draft.assign = {};
  ids.forEach((pid, i) => {
    const round = Math.floor(i / draft.nTeams);
    const pos = i % draft.nTeams;
    draft.assign[pid] = KEYS[round % 2 === 0 ? pos : draft.nTeams - 1 - pos];
  });
}

/* ------------------------------------------------------------------ */
/* Render dei passi                                                    */
/* ------------------------------------------------------------------ */
const STEP_TITLES = ['Quando e quanti', 'Chi gioca', 'Le squadre', 'Componi le squadre'];

function stepper() {
  return `<div class="steps">${STEP_TITLES.map((t, i) => `<span class="step ${i + 1 === draft.step ? 'on' : i + 1 < draft.step ? 'done' : ''}"><b>${i + 1}</b></span>`).join('<i class="step-line"></i>')}</div>
  <h2 class="step-title">${STEP_TITLES[draft.step - 1]}</h2>`;
}

function step1() {
  const live = state.matches.find((m) => m.status === 'live');
  return `
    ${live ? `<div class="card warn">C'è già una partita in corso (${longDate(live.date)}). <a href="#/live/${live.id}">Riprendila</a> o chiudila prima di crearne un'altra.</div>` : ''}
    <div class="card">
      <label class="field-label" for="nm-date">${icon('calendar')} Data della partita</label>
      <input type="date" id="nm-date" class="input" value="${draft.date}" data-change="setDate">
      <div class="hint">${longDate(draft.date, true)}</div>
    </div>
    <div class="card">
      <div class="field-label">${icon('users')} Quanti giocatori siamo?</div>
      <div class="stepper-big">
        <button class="round-btn" data-act="target" data-d="-1" aria-label="Meno">${icon('minus')}</button>
        <span class="sb-num">${draft.target}</span>
        <button class="round-btn" data-act="target" data-d="1" aria-label="Più">${icon('plus')}</button>
      </div>
      <div class="chips center">${[8, 10, 12, 14, 15].map((n) => `<button class="chip ${draft.target === n ? 'on' : ''}" data-act="targetSet" data-n="${n}">${n}</button>`).join('')}</div>
    </div>`;
}

function step2() {
  const q = draft.search.toLowerCase();
  const list = sortedPlayers().filter((p) => !q || p.name.toLowerCase().includes(q));
  const n = draft.playerIds.size;
  const last = [...finishedMatches()].pop();
  return `
    <div class="count-bar ${n === draft.target ? 'ok' : ''}">
      <span><b>${n}</b> / ${draft.target} selezionati</span>
      ${last ? '<button class="link-btn" data-act="sameAsLast">Come l\'ultima volta</button>' : ''}
      ${n ? '<button class="link-btn" data-act="clearSel">Azzera</button>' : ''}
    </div>
    <div class="search-box">${icon('search')}<input class="input" id="nm-search" placeholder="Cerca giocatore" value="${esc(draft.search)}" data-input="search" autocomplete="off"></div>
    <div class="pick-grid">${list.map((p) => `
      <button class="pick ${draft.playerIds.has(p.id) ? 'on' : ''}" data-act="togglePlayer" data-id="${p.id}">
        ${avatar(p, 'sm')}<span class="pick-name">${esc(p.name)}</span><span class="pick-check">${icon('check')}</span>
      </button>`).join('')}
    </div>
    ${!list.length && !q ? '<p class="muted center">Nessun giocatore in rosa. Aggiungine uno qui sotto.</p>' : ''}
    <form class="add-inline" data-form="addPlayer">
      <input class="input" id="nm-new" placeholder="Nuovo giocatore (nome)" value="${q && !list.length ? esc(draft.search) : ''}" autocomplete="off">
      <button class="btn primary">${icon('plus')} Aggiungi</button>
    </form>`;
}

function step3() {
  const saved = savedTeamsByUse();
  return `
    <div class="card">
      <div class="field-label">Quante squadre?</div>
      <div class="seg">${[2, 3, 4].map((n) => `<button class="seg-btn ${draft.nTeams === n ? 'on' : ''}" data-act="nTeams" data-n="${n}">${n} squadre</button>`).join('')}</div>
      <div class="hint">${draft.nTeams > 2 ? 'Con più di 2 squadre la serata diventa un mini-torneo di sfide (3 punti vittoria, 1 pareggio).' : 'Una partita secca tra due squadre.'}
      Ogni squadra: circa ${Math.floor(draft.playerIds.size / draft.nTeams)}${draft.playerIds.size % draft.nTeams ? `-${Math.ceil(draft.playerIds.size / draft.nTeams)}` : ''} giocatori.</div>
    </div>
    ${draft.slots.map((s, i) => `
      <div class="card slot" style="${teamVars(s.color)}">
        <div class="slot-head"><span class="slot-key">${s.key}</span>
          <select class="input" data-change="slotTeam" data-i="${i}" id="slot-${i}">
            ${saved.map((t) => `<option value="${t.id}" ${s.teamId === t.id ? 'selected' : ''} ${draft.slots.some((o, j) => j !== i && o.teamId === t.id) ? 'disabled' : ''}>${esc(t.name)}</option>`).join('')}
            <option value="" ${!s.teamId ? 'selected' : ''}>➕ Squadra temporanea</option>
          </select></div>
        ${!s.teamId ? `
          <input class="input mt-s" id="slot-name-${i}" value="${esc(s.name)}" data-input="slotName" data-i="${i}" placeholder="Nome squadra">
          <div class="swatches">${TEAM_COLORS.map((c) => `<button class="swatch ${s.color === c.hex ? 'on' : ''}" style="--c:${c.hex}" data-act="slotColor" data-i="${i}" data-c="${c.hex}" aria-label="${c.name}"></button>`).join('')}</div>
          <label class="check"><input type="checkbox" data-change="slotSave" data-i="${i}" ${s.saveAsTeam ? 'checked' : ''}> Salvala tra le squadre abituali</label>` : ''}
      </div>`).join('')}`;
}

function step4() {
  const counts = Object.fromEntries(draft.slots.map((s) => [s.key, 0]));
  for (const k of Object.values(draft.assign)) if (k in counts) counts[k]++;
  const players = sortedPlayers().filter((p) => draft.playerIds.has(p.id));
  const unassigned = players.filter((p) => !draft.assign[p.id]).length;
  return `
    <div class="team-counts">${draft.slots.map((s) => `<span class="tc" style="--c:${esc(s.color)}">${teamDot(s.color)}<span class="tc-name">${esc(s.name)}</span><b>${counts[s.key]}</b></span>`).join('')}</div>
    <div class="row gap wrap">
      <button class="btn ghost sm" data-act="auto" data-mode="rosters">${icon('shirt')} Rose abituali</button>
      <button class="btn ghost sm" data-act="auto" data-mode="balanced">${icon('scale')} Bilanciate</button>
      <button class="btn ghost sm" data-act="auto" data-mode="random">${icon('shuffle')} Casuali</button>
    </div>
    ${unassigned ? `<div class="hint warn-text">${unassigned} giocatori ancora da assegnare</div>` : ''}
    <div class="card list assign">${players.map((p) => `
      <div class="assign-row">${avatar(p, 'sm')}<span class="grow min0 ellipsis">${esc(p.name)}</span>
        <span class="assign-btns">${draft.slots.map((s) => `<button class="ab ${draft.assign[p.id] === s.key ? 'on' : ''}" style="${teamVars(s.color)}" data-act="assign" data-id="${p.id}" data-k="${s.key}" aria-label="${esc(s.name)}">${s.key}</button>`).join('')}</span>
      </div>`).join('')}</div>
    ${draft.slots.some((s) => s.teamId) ? `<label class="check"><input type="checkbox" data-change="updRosters" ${draft.updateRosters ? 'checked' : ''}> Aggiorna le rose abituali con queste formazioni</label>` : ''}`;
}

export default {
  render() {
    if (!draft) draft = newDraft();
    const body = [step1, step2, step3, step4][draft.step - 1]();
    const nextLabel = draft.step === 4 ? `${icon('whistle')} CALCIO D'INIZIO` : 'Avanti';
    return `
      ${pageHeader('Nuova partita', { back: true, sub: longDate(draft.date) })}
      ${stepper()}
      <div class="stack">${body}</div>
      <div class="wizard-bar">
        ${draft.step > 1 ? `<button class="btn ghost" data-act="prev">${icon('back')} Indietro</button>` : `<button class="btn ghost" data-act="cancel">Annulla</button>`}
        <button class="btn primary grow" data-act="next">${nextLabel}</button>
      </div>`;
  },

  actions: {
    setDate: (el) => { if (el.value) { draft.date = el.value; rerender(); } },
    target: (el) => { draft.target = Math.max(2, Math.min(40, draft.target + +el.dataset.d)); rerender(); },
    targetSet: (el) => { draft.target = +el.dataset.n; rerender(); },
    togglePlayer: (el) => {
      const id = el.dataset.id;
      draft.playerIds.has(id) ? draft.playerIds.delete(id) : draft.playerIds.add(id);
      rerender();
    },
    sameAsLast: () => {
      const last = finishedMatches().pop();
      draft.playerIds = new Set(last.teams.flatMap((t) => t.playerIds).filter((id) => getPlayer(id)));
      rerender();
    },
    clearSel: () => { draft.playerIds.clear(); rerender(); },
    search: (el) => {
      draft.search = el.value;
      rerender();
      const inp = document.getElementById('nm-search');
      inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
    },
    'submit:addPlayer': async () => {
      const name = document.getElementById('nm-new').value.trim();
      if (!name) return;
      if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) { toast('Esiste già un giocatore con questo nome'); return; }
      const p = await save('players', { id: uid(), name, avatar: null });
      draft.playerIds.add(p.id);
      draft.search = '';
      rerender();
      toast(`${name} aggiunto e selezionato`);
    },
    nTeams: (el) => { draft.nTeams = +el.dataset.n; draft.slots = draft.slots.slice(0, draft.nTeams); buildSlots(); draft.assign = {}; rerender(); },
    slotTeam: (el) => {
      const i = +el.dataset.i;
      const t = state.teams.find((x) => x.id === el.value);
      draft.slots[i] = t ? { key: KEYS[i], teamId: t.id, name: t.name, color: t.color }
        : { key: KEYS[i], teamId: null, name: `Squadra ${KEYS[i]}`, color: TEAM_COLORS[(i + 3) % TEAM_COLORS.length].hex, saveAsTeam: false };
      draft.assign = {};
      rerender();
    },
    slotName: (el) => { draft.slots[+el.dataset.i].name = el.value; },
    slotColor: (el) => { draft.slots[+el.dataset.i].color = el.dataset.c; rerender(); },
    slotSave: (el) => { draft.slots[+el.dataset.i].saveAsTeam = el.checked; },
    assign: (el) => {
      const { id, k } = el.dataset;
      draft.assign[id] = draft.assign[id] === k ? undefined : k;
      rerender();
    },
    auto: (el) => {
      const m = el.dataset.mode;
      if (m === 'rosters') assignFromRosters(); else if (m === 'random') assignRandom(); else assignBalanced();
      rerender();
    },
    updRosters: (el) => { draft.updateRosters = el.checked; },
    prev: () => { draft.step--; rerender(); window.scrollTo(0, 0); },
    cancel: async () => { draft = null; go('home'); },

    next: async () => {
      if (draft.step === 1) {
        if (state.matches.some((m) => m.status === 'live')) { toast('Chiudi prima la partita in corso'); return; }
        if (state.matches.some((m) => m.date === draft.date) && !(await confirmDialog('Data già usata', `Esiste già una partita il ${longDate(draft.date)}. Crearne un'altra?`, { ok: 'Sì, crea' }))) return;
      }
      if (draft.step === 2) {
        if (draft.playerIds.size < draft.nTeams) { toast(`Seleziona almeno ${draft.nTeams} giocatori`); return; }
        buildSlots();
      }
      if (draft.step === 3) {
        if (draft.slots.some((s) => !s.name.trim())) { toast('Dai un nome a tutte le squadre'); return; }
        if (!Object.keys(draft.assign).some((k) => draft.assign[k])) assignFromRosters();
      }
      if (draft.step === 4) { await createMatch(); return; }
      draft.step++;
      rerender();
      window.scrollTo(0, 0);
    },
  },
};

/** Salva la giornata e apre la schermata live. */
async function createMatch() {
  const ids = [...draft.playerIds];
  if (ids.some((id) => !draft.assign[id])) { toast('Assegna tutti i giocatori a una squadra'); return; }
  const teams = [];
  for (const s of draft.slots) {
    const playerIds = ids.filter((id) => draft.assign[id] === s.key);
    if (!playerIds.length) { toast(`${s.name} non ha giocatori`); return; }
    let teamId = s.teamId;
    // Squadra temporanea da salvare come abituale
    if (!teamId && s.saveAsTeam) {
      const t = await save('teams', { id: uid(), name: s.name.trim(), color: s.color, playerIds });
      teamId = t.id;
    } else if (teamId && draft.updateRosters) {
      const t = state.teams.find((x) => x.id === teamId);
      await save('teams', { ...t, playerIds });
    }
    teams.push({ key: s.key, teamId, name: s.name.trim(), color: s.color, playerIds }); // copia storica
  }
  const firstGame = { id: uid(), a: 'A', b: 'B', events: [], status: 'live' };
  const match = {
    id: uid(), seasonId: state.settings.activeSeasonId, date: draft.date, status: 'live',
    teams, games: [firstGame], activeGameId: firstGame.id, minutes: {},
  };
  await save('matches', match);
  draft = null;
  go(`live/${match.id}`);
}
