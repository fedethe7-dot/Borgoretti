/**
 * charts.js — Grafici SVG leggeri, senza librerie (funzionano offline).
 * I colori arrivano dalle variabili CSS, quindi seguono tema chiaro/scuro.
 */
import { esc } from './ui.js';

const niceMax = (v) => {
  if (v <= 5) return Math.max(1, Math.ceil(v));
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

/** Grafico a linee con area. series: [{label, value}] */
export function lineChart(series, { height = 170, unit = '', color = 'var(--accent)' } = {}) {
  if (series.length < 2) return emptyChart('Servono almeno 2 giornate per il grafico');
  const W = 340, H = height, pl = 28, pr = 12, pt = 14, pb = 24;
  const max = niceMax(Math.max(...series.map((s) => s.value), 1));
  const x = (i) => pl + (i * (W - pl - pr)) / (series.length - 1);
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const pts = series.map((s, i) => `${x(i).toFixed(1)},${y(s.value).toFixed(1)}`);
  const ticks = [0, max / 2, max];
  const step = Math.ceil(series.length / 6);
  const last = series.length - 1;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    ${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pl - 6}" y="${y(t) + 3}" class="tick" text-anchor="end">${Math.round(t * 10) / 10}</text>`).join('')}
    <polygon points="${pl},${y(0)} ${pts.join(' ')} ${x(last)},${y(0)}" fill="${color}" opacity=".14"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${series.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.value)}" r="${i === last ? 4.5 : 2.5}" fill="${color}"><title>${esc(s.label)}: ${s.value}${unit}</title></circle>`).join('')}
    <text x="${x(last)}" y="${y(series[last].value) - 9}" text-anchor="end" class="val">${series[last].value}${unit}</text>
    ${series.map((s, i) => (i % step === 0 || i === last) ? `<text x="${x(i)}" y="${H - 6}" class="tick" text-anchor="middle">${esc(s.label)}</text>` : '').join('')}
  </svg>`;
}

/** Barre orizzontali ordinate. items: [{label, value, color?, sub?}] */
export function barList(items, { unit = '', max, limit = 10, decimals = 0 } = {}) {
  const list = items.slice(0, limit);
  if (!list.length) return emptyChart('Nessun dato nel periodo');
  const m = max ?? Math.max(...list.map((i) => i.value), 1);
  return `<div class="bars">${list.map((i, n) => `
    <div class="bar-row">
      <span class="bar-pos">${n + 1}</span>
      <span class="bar-label">${esc(i.label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, (i.value / m) * 100)}%;${i.color ? `--c:${i.color}` : ''}"></span></span>
      <span class="bar-val">${decimals ? i.value.toFixed(decimals).replace('.', ',') : i.value}${unit}</span>
    </div>`).join('')}</div>`;
}

/** Barre verticali (es. vittorie per squadra). items: [{label, value, color}] */
export function columnChart(items, { height = 160 } = {}) {
  if (!items.length) return emptyChart('Nessun dato nel periodo');
  const W = 340, H = height, pb = 26, pt = 18;
  const max = niceMax(Math.max(...items.map((i) => i.value), 1));
  const bw = Math.min(46, (W - 20) / items.length - 14);
  const gap = (W - items.length * bw) / (items.length + 1);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    <line x1="0" x2="${W}" y1="${H - pb}" y2="${H - pb}" class="grid"/>
    ${items.map((it, i) => {
      const h = ((H - pb - pt) * it.value) / max;
      const x = gap + i * (bw + gap);
      return `<rect x="${x}" y="${H - pb - h}" width="${bw}" height="${Math.max(h, 1)}" rx="6" fill="${it.color || 'var(--accent)'}" stroke="var(--line-strong)" stroke-width=".6"/>
        <text x="${x + bw / 2}" y="${H - pb - h - 5}" text-anchor="middle" class="val">${it.value}</text>
        <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="tick">${esc(it.label.slice(0, 10))}</text>`;
    }).join('')}
  </svg>`;
}

/** Barre doppie: gol fatti vs gol subiti. items: [{label, a, b, color}] */
export function pairChart(items, { aLabel = 'Fatti', bLabel = 'Subiti' } = {}) {
  if (!items.length) return emptyChart('Nessun dato nel periodo');
  const max = Math.max(...items.flatMap((i) => [i.a, i.b]), 1);
  return `<div class="legend"><span><i class="dot" style="background:var(--accent)"></i>${aLabel}</span><span><i class="dot" style="background:var(--loss)"></i>${bLabel}</span></div>
  <div class="pairs">${items.map((i) => `
    <div class="pair">
      <div class="pair-name"><i class="team-dot" style="--c:${i.color}"></i>${esc(i.label)}</div>
      <div class="pair-bars">
        <div class="bar-track"><span class="bar-fill" style="width:${(i.a / max) * 100}%"></span></div><b>${i.a}</b>
        <div class="bar-track"><span class="bar-fill loss" style="width:${(i.b / max) * 100}%"></span></div><b>${i.b}</b>
      </div>
    </div>`).join('')}</div>`;
}

/** Confronto testa a testa tra due valori (barra divisa). */
export function splitBar(a, b, colorA, colorB) {
  const tot = a + b || 1;
  return `<div class="split"><span style="width:${(a / tot) * 100}%;--c:${colorA}"></span><span style="width:${(b / tot) * 100}%;--c:${colorB}"></span></div>`;
}

/** Pallini forma: W/D/L */
export function formDots(results = []) {
  return `<span class="form-dots">${results.map((r) => `<i class="fd fd-${r}" title="${r === 'W' ? 'Vittoria' : r === 'L' ? 'Sconfitta' : 'Pareggio'}">${r === 'W' ? 'V' : r === 'L' ? 'S' : 'P'}</i>`).join('')}</span>`;
}

export const emptyChart = (msg) => `<div class="empty-chart">${esc(msg)}</div>`;
