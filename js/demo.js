/**
 * demo.js — Genera dati di esempio (giocatori e partite inventati)
 * per provare l'app. Usa un generatore pseudo-casuale con seme fisso.
 */
import { state, save, uid, wipeAll, todayISO, saveSettings } from './db.js';

const NAMES = ['Federico', 'Marco', 'Luca', 'Andrea', 'Matteo', 'Paolo', 'Davide', 'Simone', 'Nicola', 'Alessandro', 'Giorgio', 'Stefano', 'Riccardo', 'Tommaso'];
// "talento" relativo: influenza gol e assist
const SKILL = [5, 4.5, 3, 2.5, 3.5, 2, 3, 2.5, 1.5, 3, 2, 1.5, 2.5, 2];

function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

export async function loadDemo() {
  await wipeAll();
  const r = rng(20261005);
  const pick = (arr, w) => { const tot = w.reduce((a, b) => a + b, 0); let x = r() * tot; for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x <= 0) return arr[i]; } return arr[arr.length - 1]; };

  const players = [];
  for (const n of NAMES) players.push(await save('players', { id: uid(), name: n, avatar: null }));
  const skill = Object.fromEntries(players.map((p, i) => [p.id, SKILL[i]]));

  const verde = await save('teams', { id: uid(), name: 'Verde', color: '#16a34a', playerIds: players.slice(0, 5).map((p) => p.id) });
  const bianca = await save('teams', { id: uid(), name: 'Bianca', color: '#f8fafc', playerIds: players.slice(5, 10).map((p) => p.id) });
  const rossi = await save('teams', { id: uid(), name: 'Rossi', color: '#dc2626', playerIds: players.slice(10, 14).map((p) => p.id) });

  // 14 lunedì passati
  const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7);
  const dates = [];
  for (let i = 0; i < 14; i++) { dates.unshift(todayISO(d)); d.setDate(d.getDate() - 7); }

  const seasonId = state.settings.activeSeasonId;
  for (const [i, date] of dates.entries()) {
    const three = i === 6 || i === 11; // due serate a 3 squadre
    const nPlayers = three ? 14 : 10 + (r() > 0.6 ? 0 : 0);
    const present = [...players].sort(() => r() - 0.5).slice(0, nPlayers);
    const base = three ? [verde, bianca, rossi] : [verde, bianca];
    const teams = base.map((t, k) => ({ key: 'ABC'[k], teamId: t.id, name: t.name, color: t.color, playerIds: [] }));
    present.sort((a, b) => skill[b.id] - skill[a.id]).forEach((p, k) => {
      const round = Math.floor(k / teams.length), pos = k % teams.length;
      teams[round % 2 ? teams.length - 1 - pos : pos].playerIds.push(p.id);
    });
    const pairs = three ? [['A', 'B'], ['A', 'C'], ['B', 'C'], ['A', 'B']] : [['A', 'B']];
    const games = pairs.map(([a, b]) => {
      const events = [];
      const n = three ? 2 + Math.floor(r() * 5) : 8 + Math.floor(r() * 12);
      for (let g = 0; g < n; g++) {
        const ta = teams.find((t) => t.key === a), tb = teams.find((t) => t.key === b);
        const str = (t) => t.playerIds.reduce((s, id) => s + skill[id], 0);
        const team = r() < str(ta) / (str(ta) + str(tb)) + (r() - 0.5) * 0.3 ? ta : tb;
        const scorer = r() < 0.05 ? null : pick(team.playerIds, team.playerIds.map((id) => skill[id] ** 1.6));
        const mates = team.playerIds.filter((id) => id !== scorer);
        const assist = r() < 0.62 ? pick(mates, mates.map((id) => skill[id])) : null;
        events.push({ id: uid(), type: 'goal', team: team.key, scorer, assist, t: g });
      }
      return { id: uid(), a, b, events, status: 'done' };
    });
    await save('matches', { id: uid(), seasonId, date, status: 'done', teams, games, activeGameId: games[0].id, minutes: {} });
  }
  await saveSettings({ statsFilter: 'season' });
}
