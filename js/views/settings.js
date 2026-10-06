/**
 * settings.js — Tema, stagioni, punteggio classifica, backup,
 * esportazione CSV (apribile con Excel), importazione e reset.
 */
import { state, save, remove, uid, saveSettings, exportAll, importAll, wipeAll, todayISO, backendName, activeSeason, DEFAULT_SETTINGS } from '../db.js';
import { esc, icon, toast, confirmDialog, promptDialog, downloadFile } from '../ui.js';
import { playerStats, teamStats, filterMatches, gameScore, fmt1 } from '../stats.js';
import { pageHeader } from './common.js';
import { rerender } from '../app.js';
import { loadDemo } from '../demo.js';

/* ---------- CSV (separatore ; e BOM per Excel in italiano) ---------- */
const csvCell = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCSV = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
const num = (n) => fmt1(n);

function exportPlayersCSV() {
  const ps = playerStats(filterMatches('all'));
  const rows = [['Giocatore', 'Presenze', 'Partite', 'Gol', 'Assist', 'Vittorie', 'Pareggi', 'Sconfitte', '% Vittorie', 'Media gol', 'Media assist', 'Gol squadra', 'Gol subiti', 'Minuti', 'Punteggio', 'Forma']];
  for (const p of state.players) {
    const s = ps.get(p.id);
    rows.push([p.name, s?.presences || 0, s?.games || 0, s?.goals || 0, s?.assists || 0, s?.w || 0, s?.d || 0, s?.l || 0, s ? Math.round(s.winPct) : 0, s ? num(s.avgGoals) : 0, s ? num(s.avgAssists) : 0, s?.gf || 0, s?.ga || 0, s?.minutes || 0, s?.points || 0, s?.form.score || 0]);
  }
  downloadFile(`borgoretti-giocatori-${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
}

function exportMatchesCSV() {
  const name = (id) => state.players.find((p) => p.id === id)?.name || '';
  const rows = [['Data', 'Stagione', 'Sfida', 'Squadra 1', 'Gol 1', 'Gol 2', 'Squadra 2', 'Marcatore', 'Squadra gol', 'Assist', 'Formazione 1', 'Formazione 2']];
  for (const m of [...state.matches].sort((a, b) => a.date.localeCompare(b.date))) {
    const season = state.seasons.find((s) => s.id === m.seasonId)?.name || '';
    const byKey = Object.fromEntries(m.teams.map((t) => [t.key, t]));
    m.games.forEach((g, i) => {
      const s = gameScore(g);
      const A = byKey[g.a], B = byKey[g.b];
      const base = [m.date, season, i + 1, A.name, s[g.a], s[g.b], B.name];
      const lineup = [A.playerIds.map(name).join(', '), B.playerIds.map(name).join(', ')];
      if (!g.events.length) rows.push([...base, '', '', '', ...lineup]);
      for (const e of g.events) rows.push([...base, name(e.scorer) || '(senza marcatore)', byKey[e.team].name, name(e.assist), ...lineup]);
    });
  }
  downloadFile(`borgoretti-partite-${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
}

function exportTeamsCSV() {
  const rows = [['Squadra', 'Partite', 'Vittorie', 'Pareggi', 'Sconfitte', 'Gol fatti', 'Gol subiti', 'Differenza reti', '% Vittorie']];
  for (const t of teamStats(filterMatches('all'))) rows.push([t.name, t.games, t.w, t.d, t.l, t.gf, t.ga, t.gd, Math.round(t.winPct)]);
  downloadFile(`borgoretti-squadre-${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
}

/**
 * CSV unico con TUTTI i dati, diviso in sezioni separate da una riga vuota:
 * giocatori, squadre, partite, presenze (chi ha giocato con chi) e gol.
 */
function exportEverythingCSV() {
  const name = (id) => state.players.find((p) => p.id === id)?.name || '(eliminato)';
  const seasonName = (id) => state.seasons.find((s) => s.id === id)?.name || '';
  const matches = [...state.matches].filter((m) => m.status === 'done').sort((a, b) => a.date.localeCompare(b.date));
  const rows = [];

  // 1. Giocatori con statistiche complete
  const ps = playerStats(filterMatches('all'));
  rows.push(['GIOCATORI'], ['Giocatore', 'Presenze', 'Partite', 'Gol', 'Assist', 'Vittorie', 'Pareggi', 'Sconfitte', '% Vittorie', 'Media gol', 'Media assist', 'Gol squadra', 'Gol subiti', 'Diff. reti', 'Minuti', 'Punteggio', 'Forma', 'Record vittorie di fila', 'Record partite con gol']);
  for (const p of [...state.players].sort((a, b) => a.name.localeCompare(b.name))) {
    const s = ps.get(p.id);
    rows.push([p.name, s?.presences || 0, s?.games || 0, s?.goals || 0, s?.assists || 0, s?.w || 0, s?.d || 0, s?.l || 0, s ? Math.round(s.winPct) : 0, s ? num(s.avgGoals) : 0, s ? num(s.avgAssists) : 0, s?.gf || 0, s?.ga || 0, s?.gd || 0, s?.minutes || 0, s?.points || 0, s?.form.score || 0, s?.winStreak.best || 0, s?.goalStreak.best || 0]);
  }

  // 2. Squadre
  rows.push([], ['SQUADRE'], ['Squadra', 'Partite', 'Vittorie', 'Pareggi', 'Sconfitte', 'Gol fatti', 'Gol subiti', 'Differenza reti', '% Vittorie', 'Rosa abituale']);
  for (const t of teamStats(filterMatches('all'))) {
    const saved = state.teams.find((x) => x.id === t.id);
    rows.push([t.name, t.games, t.w, t.d, t.l, t.gf, t.ga, t.gd, Math.round(t.winPct), saved ? saved.playerIds.map(name).join(', ') : '(temporanea)']);
  }

  // 3. Partite (una riga per sfida)
  rows.push([], ['PARTITE'], ['Data', 'Stagione', 'Sfida', 'Squadra 1', 'Gol 1', 'Gol 2', 'Squadra 2', 'Risultato']);
  for (const m of matches) {
    const byKey = Object.fromEntries(m.teams.map((t) => [t.key, t]));
    m.games.forEach((g, i) => {
      const s = gameScore(g);
      const A = byKey[g.a], B = byKey[g.b];
      rows.push([m.date, seasonName(m.seasonId), i + 1, A.name, s[g.a], s[g.b], B.name, s[g.a] === s[g.b] ? 'Pareggio' : `Vince ${s[g.a] > s[g.b] ? A.name : B.name}`]);
    });
  }

  // 4. Presenze: chi ha giocato, in che squadra e come è andata
  rows.push([], ['PRESENZE'], ['Data', 'Giocatore', 'Squadra', 'Gol', 'Assist', 'Vittorie', 'Pareggi', 'Sconfitte', 'Minuti']);
  for (const m of matches) {
    for (const t of m.teams) for (const pid of t.playerIds) {
      let g = 0, a = 0, w = 0, d = 0, l = 0;
      for (const game of m.games) {
        if (game.a !== t.key && game.b !== t.key) continue;
        const s = gameScore(game); const o = game.a === t.key ? game.b : game.a;
        if (s[t.key] > s[o]) w++; else if (s[t.key] < s[o]) l++; else d++;
        for (const e of game.events) { if (e.scorer === pid) g++; if (e.assist === pid) a++; }
      }
      rows.push([m.date, name(pid), t.name, g, a, w, d, l, m.minutes?.[pid] ?? '']);
    }
  }

  // 5. Gol uno per uno
  rows.push([], ['GOL'], ['Data', 'Sfida', 'Punteggio', 'Squadra', 'Marcatore', 'Assist']);
  for (const m of matches) {
    const byKey = Object.fromEntries(m.teams.map((t) => [t.key, t]));
    m.games.forEach((game, i) => {
      const run = { [game.a]: 0, [game.b]: 0 };
      for (const e of game.events) {
        run[e.team]++;
        rows.push([m.date, i + 1, `${run[game.a]}-${run[game.b]}`, byKey[e.team].name, e.scorer ? name(e.scorer) : '(senza marcatore)', e.assist ? name(e.assist) : '']);
      }
    });
  }

  downloadFile(`borgoretti-tutti-i-dati-${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
}

export default {
  render() {
    const s = state.settings;
    const w = s.weights;
    const season = activeSeason();
    const seasons = [...state.seasons].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    const count = (id) => state.matches.filter((m) => m.seasonId === id).length;
    const weight = (k, label) => `<div class="weight"><span class="grow">${label}</span>
      <button class="round-btn sm" data-act="w" data-k="${k}" data-d="-1" aria-label="Meno">${icon('minus')}</button><b>${w[k]}</b>
      <button class="round-btn sm" data-act="w" data-k="${k}" data-d="1" aria-label="Più">${icon('plus')}</button></div>`;

    return `
      ${pageHeader('Impostazioni')}

      <h2 class="section-title">Aspetto</h2>
      <div class="card"><div class="seg">${[['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([id, l]) => `<button class="seg-btn ${s.theme === id ? 'on' : ''}" data-act="theme" data-id="${id}">${l}</button>`).join('')}</div></div>

      <h2 class="section-title">Stagioni</h2>
      <div class="card list">
        ${seasons.map((x) => `<button class="list-row" data-act="season" data-id="${x.id}">
          <span class="radio ${x.id === season?.id ? 'on' : ''}"></span>
          <div class="grow"><div class="lr-title">${esc(x.name)}</div><div class="lr-sub">${count(x.id)} partite</div></div>
          ${x.id === season?.id ? '<span class="pill">attiva</span>' : ''}</button>`).join('')}
      </div>
      <div class="row gap wrap mt-s">
        <button class="btn ghost sm" data-act="newSeason">${icon('plus')} Nuova stagione</button>
        <button class="btn ghost sm" data-act="renameSeason">${icon('edit')} Rinomina</button>
        <button class="btn ghost sm danger-text" data-act="resetSeason">${icon('trash')} Reset stagione</button>
      </div>
      <p class="hint">Le nuove partite vanno nella stagione attiva. Il filtro "Stagione" delle statistiche usa la stagione attiva.</p>

      <h2 class="section-title">Punteggio classifica giocatori</h2>
      <div class="card">
        ${weight('goal', '⚽ Punti per gol')}${weight('assist', '🎯 Punti per assist')}${weight('win', '🏆 Punti per vittoria')}${weight('draw', '🤝 Punti per pareggio')}${weight('presence', '👕 Punti per presenza')}
        <button class="link-btn mt-s" data-act="wReset">Ripristina valori predefiniti</button>
      </div>

      <h2 class="section-title">Backup e dati</h2>
      <div class="card stack-s">
        <button class="btn primary block" data-act="backup">${icon('download')} Scarica backup completo (.json)</button>
        <label class="btn ghost block">${icon('upload')} Ripristina da backup
          <input type="file" accept=".json,application/json" data-change="restore" hidden></label>
        <button class="btn ghost block" data-act="csv" data-k="all">${icon('download')} Scarica tutti i dati in CSV (Excel)</button>
        <div class="field-label mt-s">Oppure solo una parte (.csv)</div>
        <div class="row gap wrap">
          <button class="btn ghost sm" data-act="csv" data-k="players">Giocatori</button>
          <button class="btn ghost sm" data-act="csv" data-k="matches">Partite e gol</button>
          <button class="btn ghost sm" data-act="csv" data-k="teams">Squadre</button>
        </div>
        <p class="hint">I dati sono salvati su questo dispositivo (${esc(backendName() || '')}): ${state.players.length} giocatori, ${state.teams.length} squadre, ${state.matches.length} partite. Fai un backup ogni tanto, ad esempio su Google Drive.</p>
      </div>

      <h2 class="section-title">Prova e reset</h2>
      <div class="card stack-s">
        <button class="btn ghost block" data-act="demo">${icon('ball')} Carica dati di esempio</button>
        <button class="btn danger block" data-act="wipe">${icon('trash')} Cancella tutti i dati</button>
      </div>

      <p class="hint center mt">Borgoretti · v1.0 · funziona offline</p>
    `;
  },

  actions: {
    theme: async (el) => { await saveSettings({ theme: el.dataset.id }); rerender(); },
    season: async (el) => { await saveSettings({ activeSeasonId: el.dataset.id }); rerender(); toast('Stagione attiva cambiata'); },
    newSeason: async () => {
      const y = new Date().getFullYear();
      const name = await promptDialog('Nuova stagione', `Stagione ${y}/${String(y + 1).slice(2)}`, { ok: 'Crea e attiva' });
      if (!name) return;
      const se = await save('seasons', { id: uid(), name, startDate: todayISO() });
      await saveSettings({ activeSeasonId: se.id });
      rerender(); toast('Nuova stagione iniziata: giocatori e squadre restano, le statistiche ripartono');
    },
    renameSeason: async () => {
      const se = activeSeason();
      const name = await promptDialog('Rinomina stagione', se.name);
      if (!name) return;
      await save('seasons', { ...se, name }); rerender();
    },
    resetSeason: async () => {
      const se = activeSeason();
      const list = state.matches.filter((m) => m.seasonId === se.id);
      if (!(await confirmDialog(`Reset di "${se.name}"?`, `Verranno eliminate ${list.length} partite di questa stagione. Giocatori e squadre restano. Consiglio: scarica prima un backup.`, { ok: 'Elimina partite', danger: true }))) return;
      for (const m of list) await remove('matches', m.id);
      rerender(); toast('Stagione azzerata');
    },
    w: async (el) => {
      const k = el.dataset.k;
      const weights = { ...state.settings.weights, [k]: Math.max(0, Math.min(10, state.settings.weights[k] + +el.dataset.d)) };
      await saveSettings({ weights }); rerender();
    },
    wReset: async () => { await saveSettings({ weights: { ...DEFAULT_SETTINGS.weights } }); rerender(); },
    backup: () => { downloadFile(`borgoretti-backup-${todayISO()}.json`, JSON.stringify(exportAll(), null, 1)); toast('Backup scaricato'); },
    restore: async (el) => {
      const f = el.files?.[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!(await confirmDialog('Ripristinare il backup?', `Contiene ${data.players?.length || 0} giocatori e ${data.matches?.length || 0} partite. I dati attuali verranno sostituiti.`, { ok: 'Ripristina', danger: true }))) return;
        await importAll(data);
        rerender(); toast('Backup ripristinato');
      } catch (e) { toast(e.message || 'File non valido'); }
      el.value = '';
    },
    csv: (el) => ({ all: exportEverythingCSV, players: exportPlayersCSV, matches: exportMatchesCSV, teams: exportTeamsCSV })[el.dataset.k](),
    demo: async () => {
      if (state.matches.length && !(await confirmDialog('Caricare i dati di esempio?', 'I dati attuali verranno sostituiti da giocatori e partite inventati. Scarica prima un backup se ti servono.', { ok: 'Carica esempio', danger: true }))) return;
      await loadDemo();
      rerender(); toast('Dati di esempio caricati: esplora Statistiche e Classifiche');
    },
    wipe: async () => {
      if (!(await confirmDialog('Cancellare tutto?', 'Giocatori, squadre, partite e stagioni verranno eliminati da questo dispositivo. Non si può annullare.', { ok: 'Cancella tutto', danger: true }))) return;
      await wipeAll(); rerender(); toast('Dati cancellati');
    },
  },
};
