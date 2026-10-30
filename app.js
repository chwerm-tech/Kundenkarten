'use strict';

/* =========================================================
   Kundenkarten – Offline-PWA
   Daten: IndexedDB (lokal auf dem Gerät), Bilder als Blob.
   ========================================================= */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

/* ---------- Icons (SF-Symbol-ähnlich) ---------- */
const I = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  arrange: '<path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5"/>',
  star: '<path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.6l6.1-.8z"/>',
  pin: '<path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v8h14v-8"/>',
  import: '<path d="M12 15V3M7.5 10.5 12 15l4.5-4.5M5 12v8h14v-8"/>',
  scan: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  rotate: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  photo: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
};
const ico = (n) => `<svg class="ico" viewBox="0 0 24 24">${I[n]}</svg>`;

/* ---------- Datenbank ---------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('kundenkarten', 2);
      r.onupgradeneeded = () => {
        const names = r.result.objectStoreNames;
        if (!names.contains('cards')) r.result.createObjectStore('cards', { keyPath: 'id' });
        if (!names.contains('sujets')) r.result.createObjectStore('sujets', { keyPath: 'id' });
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  req(mode, fn, store = 'cards') {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, mode);
      const r = fn(tx.objectStore(store));
      tx.oncomplete = () => res(r && r.result);
      tx.onerror = () => rej(tx.error);
    });
  },
  all() { return this.req('readonly', (s) => s.getAll()); },
  put(c) { return this.req('readwrite', (s) => s.put(c)); },
  del(id) { return this.req('readwrite', (s) => s.delete(id)); },
  allSujets() { return this.req('readonly', (s) => s.getAll(), 'sujets'); },
  putSujet(x) { return this.req('readwrite', (s) => s.put(x), 'sujets'); },
  delSujet(id) { return this.req('readwrite', (s) => s.delete(id), 'sujets'); },
};

const state = { cards: [], sujets: {}, q: '', cat: '', arrange: false };
const byId = (id) => state.cards.find((c) => c.id === id);
const profileOf = (c) => PROFILES.find((p) => p.id === c.profileId);

async function saveCard(c) {
  c.updatedAt = Date.now();
  await DB.put(c);
  const i = state.cards.findIndex((x) => x.id === c.id);
  if (i >= 0) state.cards[i] = c; else state.cards.push(c);
}

/* Blob-URLs zwischenspeichern */
const urlCache = new WeakMap();
function blobURL(b) {
  if (!b) return '';
  if (!urlCache.has(b)) urlCache.set(b, URL.createObjectURL(b));
  return urlCache.get(b);
}

/* ---------- Sortierung: fixierte Karten zuerst, dann nach Bewertung ---------- */
function pinnedSorted() {
  return state.cards.filter((c) => c.pinned).sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0));
}
function restSorted() {
  return state.cards.filter((c) => !c.pinned)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name, 'de'));
}
function matches(c) {
  if (state.cat && c.category !== state.cat) return false;
  if (!state.q) return true;
  const hay = norm([c.name, c.number, c.barcodeValue, c.holder, c.category, c.notes, c.ocrText,
    profileOf(c)?.name, ...(c.extras || []).flatMap((e) => [e.k, e.v])].join(' '));
  return norm(state.q).split(/\s+/).every((t) => hay.includes(t));
}

/* ---------- Kleine Darstellungshelfer ---------- */
function initials(name) {
  const w = String(name || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
}
/** 'photo' = eigene Fotos der Karte, 'sujet' = Katalog-Sujet mit persönlichen Angaben */
function lookOf(c) {
  if (c.look === 'photo' && (c.front || c.back)) return 'photo';
  if (c.look === 'sujet') return 'sujet';
  return c.profileId || !c.front ? 'sujet' : 'photo';
}
function sujetURL(profileId, side) {
  return blobURL(state.sujets[profileId]?.[side]);
}
function thumbHTML(c, cls = 'thumb') {
  if (lookOf(c) === 'photo' && c.thumb) return `<span class="${cls}" style="background-image:url(${blobURL(c.thumb)})"></span>`;
  return `<span class="${cls}">${cardSVG(c, 'front', { mini: true, image: sujetURL(c.profileId, 'front') })}</span>`;
}
function miniStars(n) {
  return n ? `<span class="mini-stars">${Array.from({ length: n }, () => ico('star')).join('')}</span>` : '';
}
function fmtNum(s) {
  const d = String(s || '');
  return /^\d{9,}$/.test(d) ? d.replace(/(\d{4})(?=\d)/g, '$1 ') : d;
}

/* =========================================================
   Liste (Tabelle)
   ========================================================= */
function rowHTML(c, arrange, idx, total) {
  const end = arrange
    ? `<button class="move" data-move="-1" data-id="${c.id}" ${idx === 0 ? 'disabled' : ''}>${ico('up')}</button>
       <button class="move" data-move="1" data-id="${c.id}" ${idx === total - 1 ? 'disabled' : ''}>${ico('down')}</button>`
    : `${miniStars(c.rating)}${ico('chev')}`;
  const sub = [fmtNum(c.number || c.barcodeValue), c.holder].filter(Boolean).join(' · ') || c.category || '—';
  return `<div class="row${arrange ? '' : ' press'}" data-open="${c.id}" role="button">
      ${thumbHTML(c)}
      <div class="row-main">
        <div class="row-title">${c.pinned ? `<span class="pin-ico">${ico('pin')}</span>` : ''}${esc(c.name)}</div>
        <div class="row-sub">${esc(sub)}</div>
      </div>
      <div class="row-end">${end}</div>
    </div>`;
}

/* ---------- Startseite: Kartenraster ---------- */
function tileFace(c) {
  if (lookOf(c) === 'photo' && c.front) return `<span class="tile-img" style="background-image:url(${blobURL(c.front)})"></span>`;
  return cardSVG(c, 'front', { image: sujetURL(c.profileId, 'front') });
}
function renderHome() {
  const grid = $('#grid');
  const cards = [...pinnedSorted(), ...restSorted()];
  grid.classList.toggle('is-empty', !cards.length);
  grid.innerHTML = cards.length
    ? cards.map((c) => `<button class="tile press" data-open="${c.id}" aria-label="${esc(c.name)}">${tileFace(c)}</button>`).join('')
    : `<div class="empty"><div class="empty-art"></div><h2>Noch keine Karten</h2>
        <p>Füge deine erste Kundenkarte hinzu. Weitere Funktionen findest du im Menü oben links.</p>
        <button class="pill primary press" data-a="new">${ico('plus')}Karte hinzufügen</button></div>`;
}

/** Alles neu zeichnen, was Karten anzeigt */
function renderList() {
  renderHome();
  manageSheet?.refresh();
}

/* ---------- Menü-Ansicht «Karten bearbeiten» (Tabelle mit Suche) ---------- */
let manageSheet = null;
function openManage(arrange = false) {
  if (manageSheet) { manageSheet.setArrange(arrange); return; }
  state.q = ''; state.cat = ''; state.arrange = arrange;
  const sh = openSheet({
    title: 'Karten bearbeiten',
    left: `<button class="glass round press" data-a="close" aria-label="Schliessen">${ico('close')}</button>`,
    right: `<button class="pill primary press" data-a="new">${ico('plus')}Neu</button>`,
    body: `<label class="search glass"><span class="search-ico">${ico('search')}</span>
        <input class="m-q" type="search" placeholder="Suchen" autocomplete="off" enterkeyhint="search"></label>
      <nav class="chips m-chips"></nav>
      <div class="m-list"></div>`,
    onClose: () => { manageSheet = null; state.arrange = false; },
  });
  manageSheet = sh;

  sh.refresh = () => {
    const cats = [...new Set(state.cards.map((c) => c.category).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'de'));
    if (state.cat && !cats.includes(state.cat)) state.cat = '';
    const chips = $('.m-chips', sh);
    chips.style.display = cats.length > 1 && !state.arrange ? '' : 'none';
    chips.innerHTML = [['', 'Alle'], ...cats.map((c) => [c, c])]
      .map(([v, l]) => `<button class="chip press${state.cat === v ? ' on' : ''}" data-cat="${esc(v)}">${esc(l)}</button>`).join('');
    const list = $('.m-list', sh);
    if (!state.cards.length) {
      list.innerHTML = `<div class="empty"><h2>Noch keine Karten</h2><p>Tippe oben rechts auf <b>Neu</b>.</p></div>`;
      return;
    }
    const pinned = pinnedSorted().filter((c) => state.arrange || matches(c));
    const rest = restSorted().filter(matches);
    let html = '';
    if (pinned.length) {
      html += `<div class="sec-h"><span>Fixiert</span><button class="link press" data-a="arrange">${state.arrange ? 'Fertig' : 'Reihenfolge ändern'}</button></div>
        <div class="group">${pinned.map((c, i) => rowHTML(c, state.arrange, i, pinned.length)).join('')}</div>`;
    }
    if (rest.length && !state.arrange) {
      html += `<div class="sec-h"><span>${pinned.length ? 'Weitere Karten' : 'Alle Karten'}</span><span>nach Bewertung</span></div>
        <div class="group">${rest.map((c) => rowHTML(c, false)).join('')}</div>`;
    }
    if (!pinned.length && !rest.length) html = `<div class="empty"><h2>Keine Treffer</h2><p>Für «${esc(state.q || state.cat)}» wurde nichts gefunden.</p></div>`;
    if (!state.arrange) html += `<p class="hint" style="margin-top:14px">Tippe auf eine Karte, um sie zu bearbeiten oder zu löschen.</p>`;
    list.innerHTML = html;
  };
  sh.setArrange = (v) => {
    if (v && !state.cards.some((c) => c.pinned)) toast('Zuerst eine Karte fixieren (Karte öffnen → Fixieren)');
    state.arrange = v && state.cards.some((c) => c.pinned);
    sh.refresh();
  };

  $('.m-q', sh).addEventListener('input', (e) => { state.q = e.target.value.trim(); sh.refresh(); });
  sh.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (chip) { state.cat = chip.dataset.cat; return sh.refresh(); }
    const mv = e.target.closest('[data-move]');
    if (mv) return movePinned(mv.dataset.id, +mv.dataset.move);
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'close') return sh.close();
    if (a === 'new') return openEditor(null);
    if (a === 'arrange') return sh.setArrange(!state.arrange);
    const row = e.target.closest('[data-open]');
    if (row && !state.arrange) openEditor(byId(row.dataset.open));
  });
  sh.setArrange(arrange);
}

async function movePinned(id, dir) {
  const arr = pinnedSorted();
  const i = arr.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  for (let k = 0; k < arr.length; k++) {
    if (arr[k].pinOrder !== k) { arr[k].pinOrder = k; await saveCard(arr[k]); }
  }
  renderList();
}

async function togglePin(c) {
  c.pinned = !c.pinned;
  if (c.pinned) c.pinOrder = Math.max(-1, ...pinnedSorted().filter((x) => x.id !== c.id).map((x) => x.pinOrder ?? 0)) + 1;
  await saveCard(c);
  renderList();
}

/* =========================================================
   Druck-Effekt (Liquid-Glass-Interaktion)
   ========================================================= */
function setupPress() {
  let cur = null, t0 = 0;
  const release = () => {
    if (!cur) return;
    const el = cur; cur = null;
    setTimeout(() => el.classList.remove('pressed'), Math.max(0, 120 - (Date.now() - t0)));
  };
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.press');
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--px', `${e.clientX - r.left}px`);
    el.style.setProperty('--py', `${e.clientY - r.top}px`);
    el.classList.add('pressed');
    cur = el; t0 = Date.now();
  }, { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const r = cur.getBoundingClientRect();
    cur.style.setProperty('--px', `${e.clientX - r.left}px`);
    cur.style.setProperty('--py', `${e.clientY - r.top}px`);
  }, { passive: true });
  ['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, release, { passive: true }));
  document.addEventListener('scroll', release, { passive: true, capture: true });
}

/* =========================================================
   Sheets, Popover, Dialoge, Toast
   ========================================================= */
function openSheet({ title = '', left = '', right = '', body = '', onClose } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sh = document.createElement('div');
  sh.className = 'sheet';
  const depth = $$('.sheet').length;
  scrim.style.zIndex = 50 + depth * 2;
  sh.style.zIndex = 51 + depth * 2;
  sh.innerHTML = `<div class="grabber"></div>
    <div class="sheet-bar">${left || '<span style="width:40px"></span>'}<div class="sheet-title">${title}</div>${right || '<span style="width:40px"></span>'}</div>
    <div class="sheet-body">${body}</div>`;
  document.body.append(scrim, sh);
  raf2(() => { scrim.classList.add('show'); sh.classList.add('show'); });

  let closed = false;
  sh.close = () => {
    if (closed) return;
    closed = true;
    scrim.classList.remove('show');
    sh.classList.remove('show', 'drag');
    sh.style.transform = '';
    setTimeout(() => { scrim.remove(); sh.remove(); }, 520);
    onClose && onClose();
  };
  scrim.addEventListener('click', () => sh.close());

  // Zum Schliessen nach unten ziehen
  let y0 = null, dy = 0;
  const bar = [$('.grabber', sh), $('.sheet-bar', sh)];
  bar.forEach((b) => b.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    y0 = e.clientY; dy = 0; sh.classList.add('drag');
    b.setPointerCapture(e.pointerId);
  }));
  bar.forEach((b) => b.addEventListener('pointermove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    sh.style.transform = `translateY(${dy}px)`;
  }));
  bar.forEach((b) => b.addEventListener('pointerup', () => {
    if (y0 == null) return;
    y0 = null; sh.classList.remove('drag');
    if (dy > 110) sh.close(); else sh.style.transform = '';
  }));
  return sh;
}

function popover(anchor, html) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.style.zIndex = 59;
  const p = document.createElement('div');
  p.className = 'pop glass';
  p.innerHTML = html;
  const r = anchor.getBoundingClientRect();
  p.style.top = `${r.bottom + 8}px`;
  p.style.right = `${Math.max(12, innerWidth - r.right)}px`;
  document.body.append(scrim, p);
  raf2(() => p.classList.add('show'));
  const close = () => { p.classList.remove('show'); setTimeout(() => { p.remove(); scrim.remove(); }, 300); };
  scrim.addEventListener('click', close);
  p.addEventListener('click', (e) => { if (e.target.closest('button')) close(); });
  return p;
}

function confirmDialog(title, text, okLabel = 'Löschen', danger = true) {
  return new Promise((res) => {
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.style.zIndex = 89;
    const a = document.createElement('div');
    a.className = 'alert glass';
    a.innerHTML = `<h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="btns"><button class="press" data-v="0">Abbrechen</button><button class="press ${danger ? 'danger' : ''}" data-v="1">${esc(okLabel)}</button></div>`;
    document.body.append(scrim, a);
    raf2(() => { scrim.classList.add('show'); a.classList.add('show'); });
    const done = (v) => { a.classList.remove('show'); scrim.classList.remove('show'); setTimeout(() => { a.remove(); scrim.remove(); }, 300); res(v); };
    a.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) done(b.dataset.v === '1'); });
    scrim.addEventListener('click', () => done(false));
  });
}

let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast glass'; document.body.append(t); }
  t.textContent = msg;
  raf2(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* =========================================================
   Barcode / QR erzeugen
   ========================================================= */
const JSB = { EAN_13: 'EAN13', EAN_8: 'EAN8', UPC_A: 'UPC', CODE_128: 'CODE128', CODE_39: 'CODE39', ITF: 'ITF', CODABAR: 'codabar' };
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

function matrixSVG(m) {
  const w = m.getWidth(), h = m.getHeight(), q = 2;
  let d = '';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m.get(x, y)) d += `M${x + q} ${y + q}h1v1h-1z`;
  return `<svg viewBox="0 0 ${w + 2 * q} ${h + 2 * q}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** Liefert { svg, qr (2D-Code?), note } oder null */
function codeSVG(value, format) {
  value = String(value || '').trim();
  if (!value || format === 'NONE') return null;
  try {
    if (format === 'QR_CODE') {
      const q = qrcode(0, 'M');
      q.addData(value);
      q.make();
      return { svg: q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }), qr: true };
    }
    if (format === 'AZTEC') return { svg: matrixSVG(new ZXing.AztecCodeWriter().encode(value, ZXing.BarcodeFormat.AZTEC, 0, 0)), qr: true };
    if (format === 'DATA_MATRIX') return { svg: matrixSVG(new ZXing.DataMatrixWriter().encode(value, ZXing.BarcodeFormat.DATA_MATRIX, 0, 0, null)), qr: true };
  } catch (e) {
    return { svg: '', note: '2D-Code konnte nicht erzeugt werden.' };
  }
  const draw = (fmt) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    let ok = true;
    try {
      JsBarcode(svg, value, { format: fmt, displayValue: false, margin: 12, height: 100, width: 2.4, background: '#ffffff', lineColor: '#000000', valid: (v) => { ok = v; } });
    } catch (e) { ok = false; }
    if (!ok) return null;
    const w = svg.getAttribute('width'), h = svg.getAttribute('height');
    svg.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    return svg.outerHTML;
  };
  const fmt = JSB[format];
  const svg = fmt && draw(fmt);
  if (svg) return { svg };
  const fb = draw('CODE128');
  const label = FORMATS.find((f) => f[0] === format)?.[1] || format;
  return fb ? { svg: fb, note: `«${value}» passt nicht zu ${label} – als Code 128 dargestellt.` } : { svg: '', note: 'Code konnte nicht erzeugt werden.' };
}

/* =========================================================
   Barcode / QR lesen (aus Foto oder Kamera)
   ========================================================= */
const ZX_FORMATS = ['QR_CODE', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'CODE_93', 'ITF', 'CODABAR', 'PDF_417', 'AZTEC', 'DATA_MATRIX'];
let zxReader;
function reader() {
  if (!zxReader) {
    zxReader = new ZXing.MultiFormatReader();
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, ZX_FORMATS.map((f) => ZXing.BarcodeFormat[f]));
    zxReader.setHints(hints);
  }
  return zxReader;
}
function decodeCanvas(cv) {
  const src = new ZXing.HTMLCanvasElementLuminanceSource(cv);
  for (const B of [ZXing.HybridBinarizer, ZXing.GlobalHistogramBinarizer]) {
    try {
      const r = reader().decodeWithState(new ZXing.BinaryBitmap(new B(src)));
      return { text: r.getText(), format: ZXing.BarcodeFormat[r.getBarcodeFormat()] };
    } catch (e) { /* nichts gefunden */ }
  }
  return null;
}
function scaled(source, maxSide) {
  const w = source.width || source.videoWidth, h = source.height || source.videoHeight;
  const s = Math.min(1, maxSide / Math.max(w, h));
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * s); cv.height = Math.round(h * s);
  cv.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0, cv.width, cv.height);
  return cv;
}
async function findBarcode(...sources) {
  for (const src of sources.filter(Boolean)) {
    for (const size of [1400, 900, 2200, 600]) {
      const r = decodeCanvas(scaled(src, size));
      if (r) return r;
      await sleep(0);
    }
  }
  return null;
}

/* =========================================================
   Texterkennung (OCR, offline mit Tesseract)
   ========================================================= */
let ocrWorkerP;
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}
function ocrWorker() {
  if (!ocrWorkerP) {
    ocrWorkerP = (async () => {
      await loadScript('vendor/ocr/tesseract.min.js');
      const base = new URL('vendor/ocr/', location.href).href;
      return Tesseract.createWorker('deu', 1, {
        workerPath: base + 'worker.min.js', corePath: base, langPath: base,
        gzip: true, workerBlobURL: false, cacheMethod: 'none',
      });
    })().catch((e) => { ocrWorkerP = null; throw e; });
  }
  return ocrWorkerP;
}
async function ocr(canvas) {
  const cv = scaled(canvas, 1600);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, cv.width, cv.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  const w = await ocrWorker();
  const { data } = await w.recognize(cv);
  return data.text || '';
}

const STOP = /karte|card|club|member|kunden|plus|family|bonus|punkte|points|www|http|gültig|valid|nummer|number|nr\b|carte/i;
function parseCardText(text) {
  const lines = text.split(/\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const low = norm(text);
  const profile = PROFILES.find((p) => p.kw.some((k) => low.includes(norm(k))));

  const nums = (text.match(/\d[\d \-]{6,32}\d/g) || [])
    .map((s) => s.replace(/\D/g, ''))
    .filter((s) => s.length >= 8 && s.length <= 22);
  nums.sort((a, b) => (b.length === 13) - (a.length === 13) || b.length - a.length);

  let valid = '';
  const m1 = text.match(/(?:gültig|gultig|valable|valid|bis|exp\w*)\D{0,14}(\d{1,2}\s?[./\-]\s?\d{2,4}(?:\s?[./\-]\s?\d{2,4})?)/i)
    || text.match(/\b((?:0[1-9]|1[0-2])\s?\/\s?(?:\d{2}|20\d{2}))\b/);
  if (m1) valid = m1[1].replace(/\s/g, '');

  const nameRe = /^(?:(?:Herr|Frau|Mme|M\.|Mr\.?|Mrs\.?)\s+)?[A-ZÄÖÜÉÈ][A-Za-zÄÖÜäöüéèêàâçß'\-]+(?:\s+[A-ZÄÖÜÉÈ][A-Za-zÄÖÜäöüéèêàâçß'\-]+){1,3}$/;
  const holder = lines.find((l) => l.length <= 40 && nameRe.test(l) && !STOP.test(l)
    && !PROFILES.some((p) => p.kw.some((k) => norm(l).includes(norm(k))))) || '';

  return { profile, number: nums[0] || '', valid, holder: holder.replace(/^(Herr|Frau|Mme|M\.|Mr\.?|Mrs\.?)\s+/, '') };
}

/* =========================================================
   Bilder: laden, zuschneiden, verkleinern
   ========================================================= */
function pickFile(input) {
  return new Promise((res) => {
    input.value = '';
    input.onchange = () => res(input.files[0] || null);
    input.click();
  });
}
function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
function toCanvas(src, sx = 0, sy = 0, sw = src.width, sh = src.height, maxSide = 1600) {
  const s = Math.min(1, maxSide / Math.max(sw, sh));
  const cv = document.createElement('canvas');
  cv.width = Math.round(sw * s); cv.height = Math.round(sh * s);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  return cv;
}
function rotate90(src) {
  const cv = document.createElement('canvas');
  cv.width = src.height; cv.height = src.width;
  const ctx = cv.getContext('2d');
  ctx.translate(cv.width, 0); ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return cv;
}
const toBlob = (cv, q = 0.85) => new Promise((r) => cv.toBlob(r, 'image/jpeg', q));
async function makeThumb(cv) {
  const t = document.createElement('canvas');
  t.width = 256; t.height = 162;
  const ctx = t.getContext('2d');
  const s = Math.max(t.width / cv.width, t.height / cv.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cv, (t.width - cv.width * s) / 2, (t.height - cv.height * s) / 2, cv.width * s, cv.height * s);
  return toBlob(t, 0.8);
}

/** Zuschneide-Ansicht. Liefert { canvas, source } oder null. */
function cropImage(img) {
  return new Promise((resolve) => {
    let src = toCanvas(img, 0, 0, img.naturalWidth, img.naturalHeight, 2600);
    const wrap = document.createElement('div');
    wrap.className = 'crop-wrap';
    wrap.innerHTML = `<div class="crop-tip">Rahmen an die Karte anpassen</div>
      <div class="crop-area"><div class="crop-box"><i class="h tl"></i><i class="h tr"></i><i class="h bl"></i><i class="h br"></i></div></div>
      <div class="crop-bar">
        <button class="pill press" data-a="cancel">Abbrechen</button>
        <button class="pill press" data-a="rot" aria-label="Drehen">${ico('rotate')}</button>
        <button class="pill press" data-a="full">Ganzes Bild</button>
        <button class="pill primary press" data-a="ok">Fertig</button>
      </div>`;
    document.body.append(wrap);
    const area = $('.crop-area', wrap), boxEl = $('.crop-box', wrap);
    let L, box;

    const layout = (resetBox) => {
      $('canvas', area)?.remove();
      const aw = area.clientWidth, ah = area.clientHeight;
      const s = Math.min(aw / src.width, ah / src.height);
      L = { s, dw: src.width * s, dh: src.height * s };
      L.ox = (aw - L.dw) / 2; L.oy = (ah - L.dh) / 2;
      src.style.cssText = `position:absolute;left:${L.ox}px;top:${L.oy}px;width:${L.dw}px;height:${L.dh}px;border-radius:4px`;
      area.prepend(src);
      if (resetBox) {
        let w = L.dw * 0.86, h = w / 1.586;
        if (h > L.dh * 0.86) { h = L.dh * 0.86; w = h * 1.586; }
        box = { x: L.ox + (L.dw - w) / 2, y: L.oy + (L.dh - h) / 2, w, h };
      }
      paint();
    };
    const paint = () => Object.assign(boxEl.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
    const clamp = () => {
      const min = 60;
      box.w = Math.max(min, Math.min(box.w, L.dw)); box.h = Math.max(min, Math.min(box.h, L.dh));
      box.x = Math.max(L.ox, Math.min(box.x, L.ox + L.dw - box.w));
      box.y = Math.max(L.oy, Math.min(box.y, L.oy + L.dh - box.h));
    };

    let drag = null;
    area.addEventListener('pointerdown', (e) => {
      const h = e.target.closest('.h');
      drag = { mode: h ? h.classList[1] : 'move', x: e.clientX, y: e.clientY, b: { ...box } };
      area.setPointerCapture(e.pointerId);
    });
    area.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y, b = drag.b;
      const right = b.x + b.w, bottom = b.y + b.h;
      if (drag.mode === 'move') { box.x = b.x + dx; box.y = b.y + dy; clamp(); }
      else {
        let x1 = b.x, y1 = b.y, x2 = right, y2 = bottom;
        if (drag.mode.includes('l')) x1 = Math.max(L.ox, Math.min(b.x + dx, x2 - 60));
        if (drag.mode.includes('r')) x2 = Math.min(L.ox + L.dw, Math.max(right + dx, x1 + 60));
        if (drag.mode.includes('t')) y1 = Math.max(L.oy, Math.min(b.y + dy, y2 - 60));
        if (drag.mode.includes('b')) y2 = Math.min(L.oy + L.dh, Math.max(bottom + dy, y1 + 60));
        box = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }
      paint();
    });
    area.addEventListener('pointerup', () => { drag = null; });

    const finish = (result) => {
      wrap.classList.remove('show');
      setTimeout(() => wrap.remove(), 300);
      resolve(result);
    };
    wrap.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancel') finish(null);
      if (a === 'rot') { src = rotate90(src); layout(true); }
      if (a === 'full') finish({ canvas: toCanvas(src), source: src });
      if (a === 'ok') {
        const sx = (box.x - L.ox) / L.s, sy = (box.y - L.oy) / L.s;
        finish({ canvas: toCanvas(src, sx, sy, box.w / L.s, box.h / L.s), source: src });
      }
    });
    raf2(() => { wrap.classList.add('show'); layout(true); });
  });
}

/* =========================================================
   Live-Scanner (Kamera)
   ========================================================= */
function liveScan() {
  return new Promise(async (resolve) => {
    if (!navigator.mediaDevices?.getUserMedia) { toast('Kamera nicht verfügbar'); return resolve(null); }
    const wrap = document.createElement('div');
    wrap.className = 'scanner';
    wrap.innerHTML = `<video playsinline muted autoplay></video><div class="scan-frame"></div>
      <div class="scan-ui"><div class="scan-msg">Barcode oder QR-Code in den Rahmen halten</div>
      <button class="pill press">Abbrechen</button></div>`;
    document.body.append(wrap);
    const video = $('video', wrap);
    let stream, done = false;
    const stop = (r) => {
      if (done) return;
      done = true;
      stream?.getTracks().forEach((t) => t.stop());
      wrap.remove();
      resolve(r);
    };
    $('button', wrap).onclick = () => stop(null);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      toast('Kein Kamerazugriff – bitte in den Einstellungen erlauben');
      return stop(null);
    }
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    while (!done) {
      if (video.videoWidth) {
        // Nur den mittleren Bereich auswerten (schneller, genauer)
        const vw = video.videoWidth, vh = video.videoHeight;
        const cw = Math.min(vw, vh * 1.4) * 0.9, ch = Math.min(vh, cw);
        const s = Math.min(1, 1100 / cw);
        cv.width = cw * s; cv.height = ch * s;
        ctx.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, cv.width, cv.height);
        const r = decodeCanvas(cv);
        if (r) { navigator.vibrate?.(40); return stop(r); }
      }
      await sleep(180);
    }
  });
}

/* =========================================================
   Vollbild-Code für die Kasse
   ========================================================= */
async function showFullCode(c) {
  const code = codeSVG(c.barcodeValue || c.number, c.barcodeFormat);
  const el = document.createElement('div');
  el.className = 'full-code' + (code?.qr ? ' qr' : '');
  el.innerHTML = `<button class="fc-close press" aria-label="Schliessen">${ico('close')}</button>
    ${code && !code.qr ? `<button class="fc-rot press" aria-label="Drehen">${ico('rotate')}</button>` : ''}
    <div class="fc-inner"><div class="fc-name">${esc(c.name)}</div>${code?.svg || ''}<div class="code-num">${esc(fmtNum(c.number || c.barcodeValue))}</div></div>`;
  document.body.append(el);
  raf2(() => el.classList.add('show'));
  let lock;
  try { lock = await navigator.wakeLock?.request('screen'); } catch (e) { /* optional */ }
  el.addEventListener('click', (e) => {
    if (e.target.closest('.fc-rot')) { el.classList.toggle('rot'); return; }
    lock?.release?.();
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  });
}

/* =========================================================
   Detailansicht
   ========================================================= */
function faceHTML(c, side) {
  if (lookOf(c) === 'photo' && c[side]) return `<div class="face ${side}" style="background-image:url(${blobURL(c[side])})"></div>`;
  return `<div class="face ${side}">${cardSVG(c, side, { image: sujetURL(c.profileId, side) })}</div>`;
}

function starsHTML(n) {
  return `<div class="stars">${[1, 2, 3, 4, 5].map((i) => `<button class="star${i <= n ? ' on' : ''}" data-star="${i}" aria-label="${i} Sterne">${ico('star')}</button>`).join('')}</div>`;
}

function openDetail(id) {
  const c = byId(id);
  if (!c) return;
  c.uses = (c.uses || 0) + 1;
  c.lastUsed = Date.now();
  DB.put(c);

  const sh = openSheet({
    left: `<button class="glass round press" data-a="close" aria-label="Schliessen">${ico('close')}</button>`,
    right: `<button class="glass pill press" data-a="edit">Bearbeiten</button>`,
  });
  const body = $('.sheet-body', sh);
  let angle = 0;

  sh.refresh = () => {
    const card = byId(id);
    if (!card) return sh.close();
    const code = codeSVG(card.barcodeValue || card.number, card.barcodeFormat);
    const p = profileOf(card);
    const rows = [
      ['Vorlage', p?.name], ['Kategorie', card.category], ['Karteninhaber', card.holder], ['Kartennummer', fmtNum(card.number)],
      ['Gültig bis', card.validUntil], ['Code-Format', card.barcodeFormat !== 'NONE' ? FORMATS.find((f) => f[0] === card.barcodeFormat)?.[1] || card.barcodeFormat : ''],
      ...(card.extras || []).filter((e) => e.k || e.v).map((e) => [e.k || 'Info', e.v]),
    ].filter((r) => r[1]);
    body.innerHTML = `
      <div class="stage"><div class="flip" style="transform:rotateY(${angle}deg)">${faceHTML(card, 'front')}${faceHTML(card, 'back')}</div></div>
      <div class="side-dots"><span class="${Math.round(angle / 180) % 2 === 0 ? 'on' : ''}"></span><span class="${Math.round(angle / 180) % 2 !== 0 ? 'on' : ''}"></span></div>
      <div class="hint">Wischen oder tippen zum Umdrehen</div>
      ${code ? `<button class="code-panel press${code.qr ? ' qr' : ''}" data-a="full" style="display:block;width:100%">${code.svg}
          <div class="code-num">${esc(fmtNum(card.barcodeValue || card.number))}</div>
          <div class="code-hint">${code.note ? esc(code.note) : 'Tippen für Vollbild an der Kasse'}</div></button>`
        : (card.number ? `<div class="code-panel"><div class="code-num" style="font-size:24px">${esc(fmtNum(card.number))}</div><div class="code-hint">Kein Barcode hinterlegt</div></div>` : '')}
      <div class="actions-row">
        <button class="act glass press${card.pinned ? ' on' : ''}" data-a="pin">${ico('pin')}${card.pinned ? 'Fixiert' : 'Fixieren'}</button>
        <button class="act glass press" data-a="copy">${ico('copy')}Kopieren</button>
        <button class="act glass press danger" data-a="delete">${ico('trash')}Löschen</button>
      </div>
      <div class="cap" style="text-align:center">Bewertung</div>
      ${starsHTML(card.rating || 0)}
      ${rows.length ? `<div class="list-card">${rows.map(([k, v]) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>` : ''}
      ${card.notes ? `<div class="cap">Notizen</div><div class="list-card notes">${esc(card.notes)}</div>` : ''}
      <div class="hint" style="margin-top:22px">Erfasst ${new Date(card.createdAt).toLocaleDateString('de-CH')} · ${card.uses || 0}× geöffnet</div>`;
    bindFlip();
  };

  // Wischen zum Umdrehen (Karte folgt dem Finger)
  const bindFlip = () => {
    const stage = $('.stage', body), flip = $('.flip', body);
    let x0 = null, y0 = 0, dx = 0, horiz = null;
    stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; dx = 0; horiz = null; });
    stage.addEventListener('pointermove', (e) => {
      if (x0 == null) return;
      dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (horiz == null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        horiz = Math.abs(dx) > Math.abs(dy);
        if (horiz) { flip.classList.add('drag'); stage.setPointerCapture(e.pointerId); }
      }
      if (horiz) flip.style.transform = `rotateY(${angle + dx * 0.55}deg) scale(.98)`;
    });
    const end = () => {
      if (x0 == null) return;
      x0 = null;
      flip.classList.remove('drag');
      if (horiz === null) angle += 180; // Tippen
      else if (horiz && Math.abs(dx) > 45) angle += dx > 0 ? 180 : -180;
      flip.style.transform = `rotateY(${angle}deg)`;
      const back = Math.abs(Math.round(angle / 180)) % 2 === 1;
      $$('.side-dots span', body).forEach((s, i) => s.classList.toggle('on', back ? i === 1 : i === 0));
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', () => { if (horiz) end(); else x0 = null; });
  };

  sh.addEventListener('click', async (e) => {
    const card = byId(id);
    const star = e.target.closest('[data-star]');
    if (star) {
      const n = +star.dataset.star;
      card.rating = card.rating === n ? n - 1 : n;
      await saveCard(card);
      renderList();
      sh.refresh();
      const s = $(`[data-star="${n}"]`, body);
      s.classList.add('pop'); setTimeout(() => s.classList.remove('pop'), 220);
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'close') sh.close();
    if (a === 'edit') openEditor(card, sh);
    if (a === 'full') showFullCode(card);
    if (a === 'pin') { await togglePin(card); sh.refresh(); toast(card.pinned ? 'Oben fixiert' : 'Fixierung gelöst'); }
    if (a === 'copy') {
      try { await navigator.clipboard.writeText(card.barcodeValue || card.number); toast('Nummer kopiert'); } catch (err) { toast('Kopieren nicht möglich'); }
    }
    if (a === 'delete') deleteCard(card, sh);
  });

  sh.refresh();
}

async function deleteCard(c, ...sheets) {
  if (!(await confirmDialog(`«${c.name}» löschen?`, 'Die Karte und ihre Bilder werden von diesem Gerät entfernt.'))) return;
  await DB.del(c.id);
  state.cards = state.cards.filter((x) => x.id !== c.id);
  sheets.forEach((s) => s?.close());
  renderList();
  toast('Karte gelöscht');
}

/* =========================================================
   Erfassen / Bearbeiten
   ========================================================= */
function newCard() {
  return {
    id: uid(), name: '', profileId: '', number: '', barcodeValue: '', barcodeFormat: 'CODE_128',
    holder: '', validUntil: '', category: '', color: '#3A3A3C', fg: '#ffffff', notes: '', extras: [],
    rating: 0, pinned: false, pinOrder: 0, front: null, back: null, thumb: null, ocrText: '',
    createdAt: Date.now(), updatedAt: Date.now(), uses: 0,
  };
}

function profileChip(p, on) {
  return `<button class="prof press${on ? ' on' : ''}" data-prof="${p.id}"><span class="pc" style="background:${p.color};color:${p.fg}">${esc(initials(p.name))}</span>${esc(p.name)}</button>`;
}

function openEditor(card, detailSheet) {
  const isNew = !card;
  const d = card ? { ...card, extras: (card.extras || []).map((e) => ({ ...e })) } : newCard();
  let busy = '';

  const sh = openSheet({
    title: isNew ? 'Neue Karte' : 'Bearbeiten',
    left: `<button class="glass pill press" data-a="cancel">Abbrechen</button>`,
    right: `<button class="pill primary press" data-a="save">Sichern</button>`,
  });
  const body = $('.sheet-body', sh);
  // OCR im Hintergrund vorwärmen, damit die erste Erkennung schneller ist
  setTimeout(() => ocrWorker().catch(() => {}), 600);

  const field = (f, label, type = 'text', extra = '') =>
    `<div class="field" data-field="${f}"><label>${label}</label><input data-f="${f}" type="${type}" value="${esc(d[f])}" ${extra}></div>`;

  const render = () => {
    const top = PROFILES.slice(0, 10);
    const sel = PROFILES.find((p) => p.id === d.profileId);
    const strip = [...(sel && !top.includes(sel) ? [sel] : []), ...top];
    const fmts = FORMATS.some((f) => f[0] === d.barcodeFormat) ? FORMATS : [...FORMATS, [d.barcodeFormat, d.barcodeFormat]];
    const st = body.scrollTop;
    body.innerHTML = `
      <div class="cap">Vorlage</div>
      <div class="profile-strip">
        <button class="prof press${!d.profileId ? ' on' : ''}" data-prof=""><span class="pc" style="background:${esc(d.profileId ? '#8e8e93' : d.color)};color:#fff">${ico('edit')}</span>Eigene</button>
        ${strip.map((p) => profileChip(p, p.id === d.profileId)).join('')}
        <button class="prof press" data-a="allprof"><span class="pc more">${ico('grid')}</span>Alle ${PROFILES.length}</button>
      </div>

      <div class="cap">Karte scannen</div>
      <div class="shots">
        ${['front', 'back'].map((s) => `<button class="shot press${d[s] ? ' has' : ''}" data-shot="${s}" style="${d[s] ? `background-image:url(${blobURL(d[s])})` : ''}">
          ${ico('camera')}<span>${s === 'front' ? 'Vorderseite' : 'Rückseite'}${d[s] ? ' ändern' : ''}</span></button>`).join('')}
      </div>
      ${busy ? `<div class="busy"><span class="spin"></span>${esc(busy)}</div>` : ''}
      <button class="scan-btn glass press" data-a="live">${ico('scan')}Barcode mit Kamera scannen</button>

      <div class="cap">Darstellung in der App</div>
      <div class="look-prev"></div>
      <div class="seg">
        <button class="${lookOf(d) === 'sujet' ? 'on' : ''}" data-look="sujet">Katalog-Sujet</button>
        <button class="${lookOf(d) === 'photo' ? 'on' : ''}" data-look="photo" ${d.front || d.back ? '' : 'disabled'}>Eigene Fotos</button>
      </div>
      <div class="form-group" style="margin-top:12px">
        <div class="field"><label style="width:auto">Persönliche Angaben auf Sujet</label><span class="toggle"><input type="checkbox" data-f="overlay" ${d.overlay !== false ? 'checked' : ''}><span></span></span></div>
        ${d.profileId ? `<button class="add-row" data-a="sujet">${ico('photo')}Sujet für «${esc(PROFILES.find((p) => p.id === d.profileId)?.name)}» ${state.sujets[d.profileId] ? 'ändern' : 'festlegen (echtes Kartenbild)'}</button>` : ''}
      </div>

      <div class="cap">Angaben</div>
      <div class="form-group">
        ${field('name', 'Name', 'text', 'placeholder="z. B. Migros Cumulus"')}
        ${field('number', 'Nummer', 'text', 'inputmode="numeric" class="mono" placeholder="Kartennummer"')}
        ${field('holder', 'Inhaber', 'text', 'placeholder="Name auf der Karte"')}
        ${field('validUntil', 'Gültig bis', 'text', 'placeholder="MM/JJ"')}
        <div class="field"><label>Kategorie</label><select data-f="category">
          <option value="">Keine</option>${CATEGORIES.map((c) => `<option ${c === d.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label>Farbe</label><span class="color-dot"><input type="color" data-f="color" value="${esc(d.color)}"></span></div>
      </div>

      <div class="cap">Barcode / QR-Code</div>
      <div class="form-group">
        <div class="field"><label>Format</label><select data-f="barcodeFormat">
          ${fmts.map(([v, l]) => `<option value="${v}" ${v === d.barcodeFormat ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        ${field('barcodeValue', 'Inhalt', 'text', 'class="mono" placeholder="leer = Kartennummer"')}
      </div>
      <div class="code-prev-slot"></div>

      <div class="cap">Bewertung & Position</div>
      <div class="form-group">
        <div class="field" style="justify-content:center;padding:6px">${starsHTML(d.rating)}</div>
        <div class="field"><label style="width:auto">Oben fixieren</label><span class="toggle"><input type="checkbox" data-f="pinned" ${d.pinned ? 'checked' : ''}><span></span></span></div>
      </div>

      <div class="cap">Zusatzinformationen</div>
      <div class="form-group">
        ${d.extras.map((e, i) => `<div class="field"><input class="key" data-x="${i}" data-xk="k" value="${esc(e.k)}" placeholder="Bezeichnung">
          <input data-x="${i}" data-xk="v" value="${esc(e.v)}" placeholder="Wert"><button class="x" data-xdel="${i}" aria-label="Entfernen">${ico('close')}</button></div>`).join('')}
        <button class="add-row" data-a="addx">${ico('plus')}Feld hinzufügen (z. B. PIN, Kundennr., Telefon)</button>
      </div>

      <div class="cap">Notizen</div>
      <div class="form-group"><div class="field block"><textarea data-f="notes" placeholder="Rabatte, Ablauf von Punkten, Login …">${esc(d.notes)}</textarea></div></div>

      ${d.ocrText ? `<details style="margin-top:18px;color:var(--text-2);font-size:13px"><summary>Erkannter Text</summary><pre style="white-space:pre-wrap;font-size:12px">${esc(d.ocrText)}</pre></details>` : ''}
      ${!isNew ? `<button class="del-btn press" data-a="delete">Karte löschen</button>` : ''}`;
    body.scrollTop = st;
    renderPreview();
  };

  const renderLook = () => {
    const el = $('.look-prev', body);
    if (!el) return;
    el.innerHTML = lookOf(d) === 'photo' && d.front
      ? `<div class="mini-card" style="background-image:url(${blobURL(d.front)})"></div>`
      : `<div class="mini-card">${cardSVG(d, 'front', { image: sujetURL(d.profileId, 'front') })}</div>`;
  };

  const renderPreview = () => {
    const slot = $('.code-prev-slot', body);
    const code = codeSVG(d.barcodeValue || d.number, d.barcodeFormat);
    slot.innerHTML = code ? `<div class="code-preview${code.qr ? ' qr' : ''}">${code.svg}${code.note ? `<div class="code-err">${esc(code.note)}</div>` : ''}</div>` : '';
    renderLook();
  };

  const setVal = (f, v) => {
    d[f] = v;
    const inp = $(`[data-f="${f}"]`, body);
    if (inp) inp.value = v;
    const row = $(`[data-field="${f}"]`, body);
    if (row) { row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
  };

  const applyProfile = (p, keepName) => {
    const prev = PROFILES.find((x) => x.id === d.profileId);
    d.profileId = p ? p.id : '';
    if (!p) return render();
    if (!keepName && (!d.name || d.name === prev?.name)) d.name = p.name;
    d.color = p.color; d.fg = p.fg;
    if (!d.category) d.category = p.cat;
    if (!d.barcodeValue) d.barcodeFormat = p.format;
    render();
  };

  const applyBarcode = (r) => {
    if (!r) return false;
    setVal('barcodeValue', r.text);
    d.barcodeFormat = r.format;
    if (!d.number && /^[\d \-]{6,}$/.test(r.text)) setVal('number', r.text.replace(/\D/g, ''));
    return true;
  };

  async function capture(side) {
    const file = await pickFile($('#pickImage'));
    if (!file) return;
    const img = await loadImage(file);
    const res = await cropImage(img);
    URL.revokeObjectURL(img.src);
    if (!res) return;
    d[side] = await toBlob(res.canvas);
    // Vorschaubild ist die Vorderseite (oder die Rückseite, solange keine Vorderseite existiert)
    if (side === 'front' || !d.front) d.thumb = await makeThumb(res.canvas);

    busy = 'Suche Barcode …'; render();
    const found = !d.barcodeValue && applyBarcode(await findBarcode(res.canvas, res.source));
    if (found) toast(`${FORMATS.find((f) => f[0] === d.barcodeFormat)?.[1] || 'Code'} erkannt`);

    busy = 'Lese Text auf der Karte …'; render();
    try {
      const text = await ocr(res.canvas);
      d.ocrText = [d.ocrText, text.trim()].filter(Boolean).join('\n—\n');
      const info = parseCardText(text);
      busy = ''; render();
      if (info.profile && !d.profileId) applyProfile(info.profile);
      if (!d.number && info.number) setVal('number', info.number);
      if (!d.holder && info.holder) setVal('holder', info.holder);
      if (!d.validUntil && info.valid) setVal('validUntil', info.valid);
      if (!d.name) setVal('name', info.profile?.name || '');
      renderPreview();
    } catch (err) {
      console.warn(err);
      busy = ''; render();
      toast('Texterkennung nicht verfügbar');
    }
  }

  body.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.f) {
      d[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value;
      if (['barcodeValue', 'number', 'barcodeFormat'].includes(t.dataset.f)) renderPreview();
      else if (['name', 'holder', 'validUntil', 'overlay', 'color'].includes(t.dataset.f)) renderLook();
    }
    if (t.dataset.x != null) d.extras[+t.dataset.x][t.dataset.xk] = t.value;
  });
  body.addEventListener('change', (e) => { if (e.target.dataset.f === 'color') render(); });

  sh.addEventListener('click', async (e) => {
    const star = e.target.closest('[data-star]');
    if (star) { const n = +star.dataset.star; d.rating = d.rating === n ? n - 1 : n; render(); return; }
    const prof = e.target.closest('[data-prof]');
    if (prof) { applyProfile(PROFILES.find((p) => p.id === prof.dataset.prof)); return; }
    const shot = e.target.closest('[data-shot]');
    if (shot) { if (!busy) capture(shot.dataset.shot); return; }
    const xdel = e.target.closest('[data-xdel]');
    if (xdel) { d.extras.splice(+xdel.dataset.xdel, 1); render(); return; }
    const look = e.target.closest('[data-look]');
    if (look) { if (!look.disabled) { d.look = look.dataset.look; render(); } return; }

    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'cancel') sh.close();
    if (a === 'addx') { d.extras.push({ k: '', v: '' }); render(); $$('[data-xk="k"]', body).pop()?.focus(); }
    if (a === 'allprof') pickProfile((p) => applyProfile(p));
    if (a === 'sujet') editSujet(d.profileId, d.front, () => { d.look = 'sujet'; render(); });
    if (a === 'live') {
      const r = await liveScan();
      if (applyBarcode(r)) { render(); toast('Code übernommen'); }
    }
    if (a === 'delete') deleteCard(card, sh, detailSheet);
    if (a === 'save') {
      d.name = d.name.trim() || PROFILES.find((p) => p.id === d.profileId)?.name || 'Karte';
      d.number = d.number.trim();
      d.barcodeValue = d.barcodeValue.trim();
      d.extras = d.extras.filter((x) => x.k.trim() || x.v.trim());
      if (d.pinned && !card?.pinned) d.pinOrder = Math.max(-1, ...pinnedSorted().map((x) => x.pinOrder ?? 0)) + 1;
      await saveCard(d);
      renderList();
      sh.close();
      if (detailSheet) detailSheet.refresh();
      toast(isNew ? 'Karte gespeichert' : 'Änderungen gesichert');
    }
  });

  render();
}

function pickProfile(onPick) {
  const sh = openSheet({
    title: 'Vorlage wählen',
    left: `<button class="glass round press" data-a="close" aria-label="Schliessen">${ico('close')}</button>`,
    body: `<label class="search glass" style="margin-top:4px"><span class="search-ico">${ico('search')}</span><input type="search" placeholder="Geschäft suchen"></label><div class="pg"></div>`,
  });
  const fill = (q) => {
    const groups = {};
    PROFILES.filter((p) => norm(p.name + ' ' + p.cat).includes(norm(q))).forEach((p) => (groups[p.cat] ||= []).push(p));
    $('.pg', sh).innerHTML = Object.entries(groups).map(([cat, ps]) =>
      `<div class="cap">${esc(cat)}</div><div class="prof-grid">${ps.map((p) => profileChip(p, false)).join('')}</div>`).join('')
      || '<div class="empty">Keine Vorlage gefunden – wähle «Eigene».</div>';
  };
  $('input', sh).addEventListener('input', (e) => fill(e.target.value));
  sh.addEventListener('click', (e) => {
    if (e.target.closest('[data-a="close"]')) return sh.close();
    const p = e.target.closest('[data-prof]');
    if (p) { onPick(PROFILES.find((x) => x.id === p.dataset.prof)); sh.close(); }
  });
  fill('');
}

/* =========================================================
   Katalog: eigene Sujets (echte Kartenbilder) pro Vorlage
   ========================================================= */
function actionSheet(title, text, items) {
  return new Promise((res) => {
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.style.zIndex = 89;
    const a = document.createElement('div');
    a.className = 'alert glass';
    a.innerHTML = `<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      <div class="btns col">${items.map((it) => `<button class="press ${it.danger ? 'danger-text' : ''}" data-v="${it.key}">${esc(it.label)}</button>`).join('')}
      <button class="press" data-v="">Abbrechen</button></div>`;
    document.body.append(scrim, a);
    raf2(() => { scrim.classList.add('show'); a.classList.add('show'); });
    const done = (v) => { a.classList.remove('show'); scrim.classList.remove('show'); setTimeout(() => { a.remove(); scrim.remove(); }, 300); res(v || null); };
    a.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) done(b.dataset.v); });
    scrim.addEventListener('click', () => done(null));
  });
}

async function editSujet(profileId, cardPhoto, onDone) {
  const p = PROFILES.find((x) => x.id === profileId);
  if (!p) return;
  const cur = state.sujets[profileId];
  const items = [
    { key: 'front', label: 'Vorderseite aus Fotos wählen' },
    { key: 'back', label: 'Rückseite aus Fotos wählen' },
    ...(cardPhoto ? [{ key: 'card', label: 'Foto dieser Karte verwenden' }] : []),
    ...(cur ? [{ key: 'reset', label: 'Mitgeliefertes Sujet verwenden', danger: true }] : []),
  ];
  const k = await actionSheet(`Sujet «${p.name}»`, 'Ein Bild der Karte ohne persönliche Angaben, z. B. von der Website des Anbieters. Es gilt für alle Karten dieses Anbieters.', items);
  if (!k) return;
  const next = { id: profileId, front: cur?.front || null, back: cur?.back || null };
  if (k === 'reset') {
    await DB.delSujet(profileId);
    delete state.sujets[profileId];
  } else {
    let blob = null;
    if (k === 'card') blob = cardPhoto;
    else {
      const file = await pickFile($('#pickImage'));
      if (!file) return;
      const img = await loadImage(file);
      const res = await cropImage(img);
      URL.revokeObjectURL(img.src);
      if (!res) return;
      blob = await toBlob(toCanvas(res.canvas, 0, 0, res.canvas.width, res.canvas.height, 1400), 0.88);
    }
    next[k === 'back' ? 'back' : 'front'] = blob;
    await DB.putSujet(next);
    state.sujets[profileId] = next;
  }
  renderList();
  toast(k === 'reset' ? 'Mitgeliefertes Sujet aktiv' : 'Sujet gespeichert');
  onDone && onDone();
}

function openCatalog() {
  const sh = openSheet({
    title: 'Katalog & Sujets',
    left: `<button class="glass round press" data-a="close" aria-label="Schliessen">${ico('close')}</button>`,
    body: `<p class="hint" style="text-align:left;margin:4px 4px 0">Tippe auf eine Vorlage, um ein echtes Kartenbild als Sujet zu hinterlegen. Deine persönlichen Angaben werden automatisch darauf angezeigt.</p><div class="cat-list"></div>`,
  });
  const fill = () => {
    const groups = {};
    PROFILES.forEach((p) => (groups[p.cat] ||= []).push(p));
    $('.cat-list', sh).innerHTML = Object.entries(groups).map(([cat, ps]) => `<div class="cap">${esc(cat)}</div><div class="sujet-grid">${ps.map((p) => {
      const demo = { profileId: p.id, name: p.name, color: p.color, fg: p.fg };
      return `<button class="sujet-item press" data-sujet="${p.id}"><span class="mini-card">${cardSVG(demo, 'front', { mini: true, image: sujetURL(p.id, 'front') })}</span>
        <span>${esc(p.name)}${state.sujets[p.id] ? ' <b class="own">eigenes</b>' : ''}</span></button>`;
    }).join('')}</div>`).join('');
  };
  sh.addEventListener('click', (e) => {
    if (e.target.closest('[data-a="close"]')) return sh.close();
    const b = e.target.closest('[data-sujet]');
    if (b) editSujet(b.dataset.sujet, null, fill);
  });
  fill();
}

/* =========================================================
   Backup (Export / Import)
   ========================================================= */
const blobToDataURL = (b) => new Promise((r) => { if (!b) return r(null); const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
const dataURLToBlob = async (u) => (u ? (await fetch(u)).blob() : null);

async function exportBackup() {
  const cards = await Promise.all(state.cards.map(async (c) => ({
    ...c, front: await blobToDataURL(c.front), back: await blobToDataURL(c.back), thumb: await blobToDataURL(c.thumb),
  })));
  const sujets = await Promise.all(Object.values(state.sujets).map(async (x) => ({
    id: x.id, front: await blobToDataURL(x.front), back: await blobToDataURL(x.back),
  })));
  const json = JSON.stringify({ app: 'kundenkarten', version: 2, exported: new Date().toISOString(), cards, sujets });
  const name = `kundenkarten-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Kundenkarten-Backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function importBackup() {
  const file = await pickFile($('#pickImport'));
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { return toast('Datei ist kein gültiges Backup'); }
  if (!Array.isArray(data.cards)) return toast('Datei ist kein gültiges Backup');
  if (!(await confirmDialog(`${data.cards.length} Karten importieren?`, 'Karten mit gleicher ID werden überschrieben, alle anderen bleiben erhalten.', 'Importieren', false))) return;
  for (const c of data.cards) {
    const card = { ...newCard(), ...c, front: await dataURLToBlob(c.front), back: await dataURLToBlob(c.back), thumb: await dataURLToBlob(c.thumb) };
    await saveCard(card);
  }
  for (const x of data.sujets || []) {
    const sj = { id: x.id, front: await dataURLToBlob(x.front), back: await dataURLToBlob(x.back) };
    await DB.putSujet(sj);
    state.sujets[sj.id] = sj;
  }
  renderList();
  toast(`${data.cards.length} Karten importiert`);
}

function openDrawer() {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.style.zIndex = 60;
  const dr = document.createElement('aside');
  dr.className = 'drawer glass';
  dr.innerHTML = `
    <div class="drawer-head"><b>Menü</b><button class="round press" data-m="close" aria-label="Schliessen">${ico('close')}</button></div>
    <button class="press" data-m="new">${ico('plus')}Neue Karte</button>
    <button class="press" data-m="manage">${ico('edit')}Karten bearbeiten</button>
    <button class="press" data-m="arrange">${ico('arrange')}Reihenfolge fixierter Karten</button>
    <button class="press" data-m="catalog">${ico('grid')}Katalog & Sujets</button>
    <hr>
    <button class="press" data-m="export">${ico('share')}Backup exportieren</button>
    <button class="press" data-m="import">${ico('import')}Backup importieren</button>
    <div class="muted drawer-status">${state.cards.length} Karten · lokal auf diesem Gerät</div>
    <div class="drawer-foot">Code by Chwerm-Tech</div>`;
  document.body.append(scrim, dr);
  raf2(() => { scrim.classList.add('show'); dr.classList.add('show'); });
  const close = () => { scrim.classList.remove('show'); dr.classList.remove('show'); setTimeout(() => { dr.remove(); scrim.remove(); }, 450); };
  scrim.addEventListener('click', close);
  // Status nachladen (Offline-Bereitschaft, geschützter Speicher)
  (async () => {
    let offline = false;
    try { offline = !!(await caches.match('vendor/ocr/deu.traineddata.gz')); } catch (e) { /* kein Cache */ }
    const persisted = await navigator.storage?.persisted?.().catch(() => false);
    $('.drawer-status', dr).innerHTML = `${state.cards.length} Karten · lokal auf diesem Gerät<br>
      Offline: ${offline ? 'bereit ✓' : 'wird vorbereitet …'}${persisted ? ' · Speicher geschützt ✓' : ''}<br>
      Tipp: Regelmässig ein Backup in «Dateien» sichern.`;
  })();
  dr.addEventListener('click', (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    if (m === 'import') { close(); return importBackup(); } // Dateiauswahl direkt im Tipp öffnen
    close();
    if (m === 'new') openEditor(null);
    if (m === 'manage') openManage(false);
    if (m === 'arrange') openManage(true);
    if (m === 'catalog') openCatalog();
    if (m === 'export') exportBackup();
  });
}

/* =========================================================
   Start
   ========================================================= */
async function init() {
  $('#btnMenu').innerHTML = ico('menu');
  setupPress();

  await DB.open();
  state.cards = (await DB.all()) || [];
  ((await DB.allSujets()) || []).forEach((x) => { state.sujets[x.id] = x; });
  renderList();

  $('#btnMenu').addEventListener('click', openDrawer);
  $('#grid').addEventListener('click', (e) => {
    if (e.target.closest('[data-a="new"]')) return openEditor(null);
    const tile = e.target.closest('[data-open]');
    if (tile) openDetail(tile.dataset.open);
  });

  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  }
}

init().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<p style="padding:20px;color:#ff3b30">Fehler beim Start: ${esc(e.message)}</p>`);
});
