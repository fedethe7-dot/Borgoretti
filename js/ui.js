/**
 * ui.js — Componenti di interfaccia riutilizzabili:
 * escape HTML, icone, avatar, bottom-sheet, conferme, toast, animazioni.
 */

/** Escape del testo inserito dall'utente (evita HTML indesiderato). */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------------ */
/* Icone (SVG inline, tratto 2px, ereditano il colore del testo)        */
/* ------------------------------------------------------------------ */
const P = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/><path d="M12 7V3.5M16 10l3.5-1.5M14.5 14.5l2 3.5M9.5 14.5l-2 3.5M8 10L4.5 8.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H4.5a3 3 0 003.6 4M16 6h3.5a3 3 0 01-3.6 4"/><path d="M12 13v4M8.5 20h7M9.5 17h5v3h-5z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  whistle: '<path d="M3 13a5 5 0 1010 0v-2h8V7H8a5 5 0 00-5 6z"/><circle cx="8" cy="13" r="1.5"/>',
  shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  shirt: '<path d="M8 3L3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 01-8 0z"/>',
  fire: '<path d="M12 21c4 0 7-2.7 7-6.8 0-3.7-2.6-6-4-8.2-.6 2.2-1.8 3.4-3 4C12.5 7 11 4.5 9 3c.3 3.5-4 6.5-4 11.2C5 18.3 8 21 12 21z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
};
export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;

/* ------------------------------------------------------------------ */
/* Avatar e badge                                                      */
/* ------------------------------------------------------------------ */
const AV_COLORS = ['#1f9d55', '#0e7490', '#7c3aed', '#c2410c', '#be185d', '#4d7c0f', '#1d4ed8', '#b45309'];
export function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}
export function avatar(p, size = 'md') {
  if (!p) return `<span class="av av-${size}">?</span>`;
  if (p.avatar) return `<span class="av av-${size}"><img src="${esc(p.avatar)}" alt=""></span>`;
  let h = 0; for (const c of p.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="av av-${size}" style="--av:${AV_COLORS[h % AV_COLORS.length]}">${esc(initials(p.name))}</span>`;
}
/** Colore del testo leggibile sopra il colore della squadra (bianco o scuro). */
export function inkFor(hex = '#888') {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#0c2116' : '#ffffff';
}
/** Variabili CSS di una squadra: --c colore, --ink testo sopra il colore. */
export const teamVars = (color) => `--c:${esc(color)};--ink:${inkFor(color)}`;
export const teamDot = (color) => `<i class="team-dot" style="--c:${esc(color)}"></i>`;
export const teamChip = (t) => `<span class="team-chip" style="--c:${esc(t.color)}">${teamDot(t.color)}${esc(t.name)}</span>`;

/** Colori disponibili per le squadre. */
export const TEAM_COLORS = [
  { name: 'Verde', hex: '#16a34a' }, { name: 'Bianco', hex: '#f8fafc' }, { name: 'Nero', hex: '#1f2937' },
  { name: 'Rosso', hex: '#dc2626' }, { name: 'Blu', hex: '#2563eb' }, { name: 'Giallo', hex: '#facc15' },
  { name: 'Arancio', hex: '#ea580c' }, { name: 'Azzurro', hex: '#38bdf8' }, { name: 'Viola', hex: '#7c3aed' },
  { name: 'Rosa', hex: '#ec4899' },
];

/* ------------------------------------------------------------------ */
/* Bottom sheet / modale                                               */
/* ------------------------------------------------------------------ */
let sheetActions = {};
let sheetCloseCb = null;

/**
 * Apre un pannello dal basso.
 * @param {string|Function} content HTML o funzione che restituisce HTML (per ri-render)
 * @param {object} actions mappa data-act -> handler(el, event)
 */
export function openSheet(content, actions = {}, { onClose, cls = '' } = {}) {
  const root = document.getElementById('sheet-root');
  sheetActions = actions;
  sheetCloseCb = onClose || null;
  root.innerHTML = `<div class="sheet-backdrop" data-sheet-close></div>
    <div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="sheet-grip"></div><div class="sheet-body">${typeof content === 'function' ? content() : content}</div></div>`;
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('open'));
  document.body.classList.add('no-scroll');
}
/** Aggiorna il contenuto del pannello aperto. */
export function updateSheet(html) {
  const body = document.querySelector('#sheet-root .sheet-body');
  if (body) body.innerHTML = html;
}
export function closeSheet() {
  const root = document.getElementById('sheet-root');
  if (root.hidden) return;
  root.classList.remove('open');
  document.body.classList.remove('no-scroll');
  const cb = sheetCloseCb; sheetCloseCb = null;
  setTimeout(() => { root.hidden = true; root.innerHTML = ''; }, 220);
  cb?.();
}
export const getSheetActions = () => sheetActions;

/** Conferma personalizzata (sostituisce confirm() del browser). */
export function confirmDialog(title, text, { ok = 'Conferma', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; closeSheet(); resolve(v); } };
    openSheet(`<h3 class="sheet-title">${esc(title)}</h3><p class="muted">${esc(text)}</p>
      <div class="row gap mt"><button class="btn ghost grow" data-act="no">Annulla</button>
      <button class="btn ${danger ? 'danger' : 'primary'} grow" data-act="yes">${esc(ok)}</button></div>`,
    { yes: () => finish(true), no: () => finish(false) }, { onClose: () => { if (!done) { done = true; resolve(false); } } });
  });
}

/** Richiesta di testo (sostituisce prompt()). */
export function promptDialog(title, value = '', { placeholder = '', ok = 'Salva' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; closeSheet(); resolve(v); } };
    openSheet(`<h3 class="sheet-title">${esc(title)}</h3>
      <form data-form="prompt"><input class="input" id="prompt-input" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">
      <div class="row gap mt"><button type="button" class="btn ghost grow" data-act="no">Annulla</button>
      <button class="btn primary grow">${esc(ok)}</button></div></form>`,
    { no: () => finish(null), 'submit:prompt': () => finish(document.getElementById('prompt-input').value.trim()) },
    { onClose: () => { if (!done) { done = true; resolve(null); } } });
    setTimeout(() => document.getElementById('prompt-input')?.focus(), 250);
  });
}

/* ------------------------------------------------------------------ */
/* Toast e animazioni                                                  */
/* ------------------------------------------------------------------ */
export function toast(msg, { action, onAction, ms = 2600 } = {}) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-btn">${esc(action)}</button>` : ''}`;
  el.classList.add('show');
  clearTimeout(el._t);
  if (action) el.querySelector('.toast-btn').onclick = () => { el.classList.remove('show'); onAction?.(); };
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Animazione celebrativa.
 * kind: 'goal' (pallone + scritta GOL), 'win' (coppa + coriandoli)
 */
export function celebrate(kind, { title, subtitle, color } = {}) {
  const fx = document.getElementById('fx');
  const big = kind === 'win' ? '🏆' : '⚽';
  const t = title || (kind === 'win' ? 'VITTORIA!' : 'GOL!');
  const confetti = reduced() ? '' : Array.from({ length: kind === 'win' ? 36 : 18 }, (_, i) => {
    const cols = ['#22c55e', '#facc15', '#ffffff', color || '#16a34a', '#86efac'];
    return `<i class="confetto" style="--x:${(Math.random() * 2 - 1) * 46}vw;--y:${-(30 + Math.random() * 45)}vh;--r:${Math.random() * 720 - 360}deg;--d:${0.9 + Math.random() * 0.8}s;background:${cols[i % cols.length]}"></i>`;
  }).join('');
  fx.innerHTML = `<div class="fx-card fx-${kind}"><div class="fx-big">${big}</div><div class="fx-title">${esc(t)}</div>${subtitle ? `<div class="fx-sub">${esc(subtitle)}</div>` : ''}</div>${confetti}`;
  fx.hidden = false;
  fx.classList.remove('play'); void fx.offsetWidth; fx.classList.add('play');
  try { navigator.vibrate?.(kind === 'win' ? [60, 40, 120] : 40); } catch { /* ignora */ }
  clearTimeout(fx._t);
  fx._t = setTimeout(() => { fx.hidden = true; fx.innerHTML = ''; }, kind === 'win' ? 2200 : 1300);
}

/* ------------------------------------------------------------------ */
/* File: download e lettura                                            */
/* ------------------------------------------------------------------ */
export function downloadFile(name, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

/** Ridimensiona una foto a 160px (avatar leggero da salvare nel database). */
export function resizeImage(file, size = 160) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const s = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Condivide testo (Web Share) o lo copia negli appunti. */
export async function shareText(title, text) {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Copiato negli appunti: incollalo su WhatsApp'); }
  catch { openSheet(`<h3 class="sheet-title">Copia il testo</h3><textarea class="input" rows="12" readonly>${esc(text)}</textarea>`); }
}

/** Fiamme della forma (0-5). */
export const flames = (n) => `<span class="flames" title="Forma ${n}/5">${'🔥'.repeat(n)}<span class="flames-off">${'🔥'.repeat(5 - n)}</span></span>`;
