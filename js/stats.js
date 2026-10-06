/**
 * stats.js — Motore statistiche ("l'Opta del lunedì").
 *
 * Concetti:
 *  - GIORNATA (match): il lunedì. Contiene le squadre del giorno e 1+ SFIDE.
 *  - SFIDA (game): una partita tra due squadre. Con 2 squadre c'è una sola
 *    sfida; con 3-4 squadre la giornata è un mini-torneo di più sfide.
 *  - Presenze = giornate giocate. Partite giocate = sfide disputate.
 *  - Vittorie/pareggi/sconfitte di un giocatore contano per sfida.
 *
 * Tutte le funzioni sono "pure": ricevono dati e restituiscono numeri,
 * quindi sono facili da testare e da riusare.
 */
import { state } from './db.js';

/* ------------------------------------------------------------------ */
/* Sfide e risultati                                                   */
/* ------------------------------------------------------------------ */

/** Punteggio di una sfida: { [teamKey]: gol } (+ gol extra inseriti a mano). */
export function gameScore(game) {
  const s = { [game.a]: 0, [game.b]: 0 };
  for (const e of game.events || []) if (e.type === 'goal' && e.team in s) s[e.team]++;
  return s;
}

/** Esito della sfida per una squadra: 'W' | 'D' | 'L' | null se non gioca. */
export function gameResult(game, key) {
  if (game.a !== key && game.b !== key) return null;
  const s = gameScore(game);
  const other = game.a === key ? game.b : game.a;
  return s[key] > s[other] ? 'W' : s[key] < s[other] ? 'L' : 'D';
}

/** Squadra (key) di un giocatore in una giornata. */
export function teamKeyOf(match, playerId) {
  return match.teams.find((t) => t.playerIds.includes(playerId))?.key ?? null;
}

/** Classifica della giornata (utile con 3-4 squadre). Punti 3/1/0. */
export function dayStandings(match) {
  const rows = Object.fromEntries(match.teams.map((t) => [t.key, { key: t.key, team: t, g: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const g of match.games) {
    if (!g.events.length && g.status !== 'done') continue; // sfida non iniziata
    const s = gameScore(g);
    for (const [k, o] of [[g.a, g.b], [g.b, g.a]]) {
      const r = rows[k]; if (!r) continue;
      r.g++; r.gf += s[k]; r.ga += s[o];
      if (s[k] > s[o]) { r.w++; r.pts += 3; } else if (s[k] === s[o]) { r.d++; r.pts += 1; } else r.l++;
    }
  }
  return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
}

/** Riepilogo leggibile della giornata: vincitore, pareggio, punteggi. */
export function matchSummary(match) {
  if (match.teams.length === 2 && match.games.length === 1) {
    const g = match.games[0];
    const s = gameScore(g);
    const [A, B] = match.teams;
    const draw = s[A.key] === s[B.key];
    const winner = draw ? null : s[A.key] > s[B.key] ? A : B;
    return { type: 'single', teams: match.teams, score: s, draw, winner, loser: draw ? null : winner === A ? B : A };
  }
  const st = dayStandings(match);
  const top = st[0];
  const tie = st[1] && st[1].pts === top.pts && (st[1].gf - st[1].ga) === (top.gf - top.ga) && st[1].gf === top.gf;
  return { type: 'tournament', standings: st, winner: tie ? null : top?.team, draw: tie };
}

/* ------------------------------------------------------------------ */
/* Filtri temporali                                                    */
/* ------------------------------------------------------------------ */
export const FILTERS = [
  { id: 'last5', label: 'Ultime 5' },
  { id: 'last10', label: 'Ultime 10' },
  { id: 'month', label: 'Ultimo mese' },
  { id: '3months', label: 'Ultimi 3 mesi' },
  { id: 'season', label: 'Stagione' },
  { id: 'all', label: 'Tutto lo storico' },
];

/** Giornate concluse, in ordine cronologico crescente. */
export function finishedMatches() {
  return state.matches.filter((m) => m.status === 'done').sort(byDate);
}
export const byDate = (a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0);

export function filterMatches(filter, matches = finishedMatches()) {
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  switch (filter) {
    case 'last5': return matches.slice(-5);
    case 'last10': return matches.slice(-10);
    case 'month': return matches.filter((m) => m.date >= daysAgo(31));
    case '3months': return matches.filter((m) => m.date >= daysAgo(92));
    case 'season': return matches.filter((m) => m.seasonId === state.settings.activeSeasonId);
    default: return matches;
  }
}

/* ------------------------------------------------------------------ */
/* Statistiche giocatori                                               */
/* ------------------------------------------------------------------ */

/**
 * Calcola le statistiche di tutti i giocatori sulle giornate passate.
 * Restituisce una Map playerId -> oggetto statistiche.
 */
export function playerStats(matches = filterMatches('all')) {
  const map = new Map();
  const get = (id) => {
    if (!map.has(id)) map.set(id, {
      id, presences: 0, games: 0, goals: 0, assists: 0, w: 0, d: 0, l: 0,
      minutes: 0, minutesCount: 0, gf: 0, ga: 0, log: [], seq: [],
    });
    return map.get(id);
  };

  for (const m of matches) {
    for (const t of m.teams) {
      for (const pid of t.playerIds) {
        const p = get(pid);
        const rec = { matchId: m.id, date: m.date, teamKey: t.key, teamName: t.name, teamColor: t.color, goals: 0, assists: 0, w: 0, d: 0, l: 0, games: 0, gf: 0, ga: 0 };
        for (const g of m.games) {
          const r = gameResult(g, t.key);
          if (!r) continue;
          if (!g.events.length && g.status !== 'done') continue;
          const s = gameScore(g);
          const other = g.a === t.key ? g.b : g.a;
          rec.games++; rec.gf += s[t.key]; rec.ga += s[other];
          rec[r.toLowerCase()]++;
          p.seq.push(r); // sequenza cronologica delle sfide (per le strisce)
          for (const e of g.events) {
            if (e.scorer === pid) rec.goals++;
            if (e.assist === pid) rec.assists++;
          }
        }
        p.presences++; p.games += rec.games;
        p.goals += rec.goals; p.assists += rec.assists;
        p.w += rec.w; p.d += rec.d; p.l += rec.l; p.gf += rec.gf; p.ga += rec.ga;
        const min = m.minutes?.[pid];
        if (min) { p.minutes += +min; p.minutesCount++; rec.minutes = +min; }
        p.log.push(rec);
      }
    }
  }

  for (const p of map.values()) finalizePlayer(p);
  return map;
}

/** Calcola medie, strisce, forma e miglior partita. */
function finalizePlayer(p) {
  p.avgGoals = p.presences ? p.goals / p.presences : 0;
  p.avgAssists = p.presences ? p.assists / p.presences : 0;
  p.winPct = p.games ? (p.w / p.games) * 100 : 0;
  p.gd = p.gf - p.ga;
  p.points = rankScore(p);

  // Miglior partita: più gol+assist, poi più vittorie
  p.best = p.log.reduce((b, r) => (!b || r.goals + r.assists > b.goals + b.assists || (r.goals + r.assists === b.goals + b.assists && r.w > b.w) ? r : b), null);
  if (p.best && p.best.goals + p.best.assists === 0) p.best = null;

  // Strisce sulle sfide
  const streak = (pred) => {
    let cur = 0, best = 0;
    for (const r of p.seq) { if (pred(r)) { cur++; best = Math.max(best, cur); } else cur = 0; }
    return { cur, best };
  };
  p.winStreak = streak((r) => r === 'W');
  p.lossStreak = streak((r) => r === 'L');
  p.unbeatenStreak = streak((r) => r !== 'L');

  // Giornate consecutive con almeno un gol
  let cur = 0, best = 0;
  for (const r of p.log) { if (r.goals > 0) { cur++; best = Math.max(best, cur); } else cur = 0; }
  p.goalStreak = { cur, best };

  p.form = playerForm(p);
}

/**
 * Forma: ultime 5 giornate.
 * Punteggio 0-100 = 60% risultati (punti ottenuti / punti disponibili)
 *                 + 40% contributo (gol + 0,75 x assist a giornata, pieno da 2 in su).
 * Fiamme = punteggio / 20 arrotondato (0-5).
 */
export function playerForm(p) {
  const last = p.log.slice(-5);
  const sum = (k) => last.reduce((s, r) => s + (r[k] || 0), 0);
  const f = { matches: last.length, goals: sum('goals'), assists: sum('assists'), w: sum('w'), d: sum('d'), l: sum('l'), games: sum('games') };
  if (!last.length) return { ...f, score: 0, flames: 0, label: 'Nessun dato' };
  const res = f.games ? (3 * f.w + f.d) / (3 * f.games) : 0;
  const contrib = Math.min(1, (f.goals + 0.75 * f.assists) / last.length / 2);
  f.score = Math.round(res * 60 + contrib * 40);
  f.flames = Math.round(f.score / 20);
  f.label = f.score >= 80 ? 'Stellare' : f.score >= 60 ? 'In fiamme' : f.score >= 40 ? 'Buona' : f.score >= 20 ? 'Altalenante' : 'Fuori forma';
  f.results = last.map((r) => (r.w > r.l ? 'W' : r.l > r.w ? 'L' : 'D'));
  return f;
}

/** Punteggio classifica: pesi modificabili in Impostazioni, sempre mostrati. */
export function rankScore(p, w = state.settings.weights) {
  return p.goals * w.goal + p.assists * w.assist + p.w * w.win + p.d * w.draw + p.presences * w.presence;
}

/* ------------------------------------------------------------------ */
/* Statistiche squadre                                                 */
/* ------------------------------------------------------------------ */

/**
 * Le squadre si identificano con l'id della squadra salvata.
 * Le squadre temporanee si raggruppano per nome.
 */
export const teamIdentity = (t) => t.teamId || `tmp:${t.name.trim().toLowerCase()}`;

export function teamStats(matches = filterMatches('all')) {
  const map = new Map();
  for (const m of matches) {
    const byKey = Object.fromEntries(m.teams.map((t) => [t.key, t]));
    for (const g of m.games) {
      if (!g.events.length && g.status !== 'done') continue;
      const s = gameScore(g);
      for (const [k, o] of [[g.a, g.b], [g.b, g.a]]) {
        const t = byKey[k]; if (!t) continue;
        const id = teamIdentity(t);
        if (!map.has(id)) {
          const saved = t.teamId && state.teams.find((x) => x.id === t.teamId);
          map.set(id, { id, name: saved?.name || t.name, color: saved?.color || t.color, temporary: !t.teamId, games: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, seq: [], days: new Set() });
        }
        const r = map.get(id);
        r.games++; r.gf += s[k]; r.ga += s[o]; r.days.add(m.id);
        const res = s[k] > s[o] ? 'W' : s[k] < s[o] ? 'L' : 'D';
        r[res.toLowerCase()]++; r.seq.push(res);
      }
    }
  }
  for (const r of map.values()) {
    r.gd = r.gf - r.ga;
    r.winPct = r.games ? (r.w / r.games) * 100 : 0;
    r.avgGf = r.games ? r.gf / r.games : 0;
    r.avgGa = r.games ? r.ga / r.games : 0;
    r.last5 = r.seq.slice(-5);
    r.presences = r.days.size;
  }
  return [...map.values()].sort((a, b) => b.w - a.w || b.gd - a.gd);
}

/** Scontri diretti tra due squadre (per identità). */
export function headToHead(idA, idB, matches = filterMatches('all')) {
  const out = { games: 0, a: 0, b: 0, d: 0, gfA: 0, gfB: 0, list: [] };
  for (const m of matches) {
    const byKey = Object.fromEntries(m.teams.map((t) => [t.key, t]));
    for (const g of m.games) {
      const ta = byKey[g.a], tb = byKey[g.b];
      if (!ta || !tb) continue;
      let A, B;
      if (teamIdentity(ta) === idA && teamIdentity(tb) === idB) { A = g.a; B = g.b; }
      else if (teamIdentity(ta) === idB && teamIdentity(tb) === idA) { A = g.b; B = g.a; }
      else continue;
      const s = gameScore(g);
      out.games++; out.gfA += s[A]; out.gfB += s[B];
      if (s[A] > s[B]) out.a++; else if (s[A] < s[B]) out.b++; else out.d++;
      out.list.push({ date: m.date, matchId: m.id, sa: s[A], sb: s[B] });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Totali e serie temporali                                            */
/* ------------------------------------------------------------------ */
export function totals(matches) {
  let goals = 0, assists = 0, games = 0, players = 0;
  for (const m of matches) {
    players += m.teams.reduce((s, t) => s + t.playerIds.length, 0);
    for (const g of m.games) {
      if (!g.events.length && g.status !== 'done') continue;
      games++;
      for (const e of g.events) { if (e.type === 'goal') goals++; if (e.assist) assists++; }
    }
  }
  return {
    matches: matches.length, games, goals, assists,
    goalsPerGame: games ? goals / games : 0,
    assistsPerGame: games ? assists / games : 0,
    avgPlayers: matches.length ? players / matches.length : 0,
  };
}

/** Gol totali per giornata (per il grafico dell'andamento). */
export function goalsTimeline(matches) {
  return matches.map((m) => ({
    label: shortDate(m.date),
    value: m.games.reduce((s, g) => s + g.events.filter((e) => e.type === 'goal').length, 0),
  }));
}

/* ------------------------------------------------------------------ */
/* Formattazione                                                       */
/* ------------------------------------------------------------------ */
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MONTHS_L = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

export function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
export function shortDate(iso) { const d = parseISO(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; }
export function longDate(iso, withYear = false) {
  const d = parseISO(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_L[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
}
export const fmt1 = (n) => (Math.round(n * 100) / 100).toLocaleString('it-IT', { maximumFractionDigits: 2 });
export const pct = (n) => `${Math.round(n)}%`;
export const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
