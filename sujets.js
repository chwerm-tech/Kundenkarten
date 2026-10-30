'use strict';

/* =========================================================
   Karten-Sujets: Kartenbild (mitgeliefert oder eigenes) +
   persönliche Angaben, gezeichnet als SVG im Kartenformat 85.6 × 54 mm.
   ========================================================= */

const CARD_W = 856, CARD_H = 540;
let svgSeq = 0;

function hexRGB(hex) {
  let h = String(hex || '#888').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Farbe aufhellen (amt > 0) oder abdunkeln (amt < 0) */
function shade(hex, amt) {
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  return '#' + hexRGB(hex).map((v) => Math.round((t - v) * p + v).toString(16).padStart(2, '0')).join('');
}
const svgEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FONT = `-apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif`;
const MONO = `ui-monospace, 'SF Mono', Menlo, monospace`;

/* Muster der mitgelieferten Sujets */
function artLayer(art, fg) {
  const w = (o) => `fill="#fff" fill-opacity="${o}"`;
  const k = (o) => `fill="#000" fill-opacity="${o}"`;
  switch (art) {
    case 'arc': return `<circle cx="760" cy="-40" r="380" ${w(0.14)}/><circle cx="820" cy="600" r="250" ${k(0.12)}/><circle cx="760" cy="-40" r="250" ${w(0.1)}/>`;
    case 'stripes': return `<path d="M470 0h110L290 540H180z" ${w(0.16)}/><path d="M620 0h70L400 540h-70z" ${w(0.12)}/><path d="M730 0h130v540H440z" ${k(0.1)}/>`;
    case 'rings': return [440, 360, 280, 200, 120].map((r, i) => `<circle cx="820" cy="470" r="${r}" fill="none" stroke="#fff" stroke-opacity="${0.08 + i * 0.03}" stroke-width="26"/>`).join('');
    case 'diag': return `<path d="M0 540L856 120v420z" ${k(0.14)}/><path d="M0 540L856 260v280z" ${w(0.08)}/>`;
    case 'wave': return `<path d="M0 360C180 300 300 440 480 390S760 260 856 300V540H0z" ${w(0.14)}/><path d="M0 430C200 380 340 500 520 460S760 380 856 410V540H0z" ${k(0.12)}/>`;
    case 'split': return `<path d="M560 0h296v540H420z" ${k(0.16)}/><rect x="0" y="470" width="856" height="10" ${w(0.25)}/>`;
    case 'grid': {
      let s = '';
      for (let x = 476; x < 856; x += 38) s += `<path d="M${x} 0v540" stroke="#fff" stroke-opacity=".09" stroke-width="2"/>`;
      for (let y = 18; y < 540; y += 38) s += `<path d="M476 ${y}h380" stroke="#fff" stroke-opacity=".09" stroke-width="2"/>`;
      return s + `<rect x="476" width="380" height="540" ${k(0.08)}/>`;
    }
    case 'dots': {
      let s = '';
      for (let y = 40; y < 540; y += 46) for (let x = 520 + ((y / 46) % 2) * 23; x < 856; x += 46) s += `<circle cx="${x}" cy="${y}" r="${4 + (x - 500) / 60}" ${w(0.13)}/>`;
      return s;
    }
    default: return `<circle cx="700" cy="100" r="300" ${w(0.1)}/>`;
  }
}

/** Schriftgrösse so wählen, dass der Text in die Breite passt */
const fit = (text, max, width) => Math.min(max, Math.floor(width / (Math.max(1, String(text).length) * 0.62)));

/** Anderes SVG (Barcode) in das Karten-SVG einsetzen */
function nestSVG(svg, x, y, w, h) {
  return String(svg).replace(/^<svg([^>]*)>/, (m, attrs) =>
    `<svg${attrs.replace(/\s(width|height|x|y|style)="[^"]*"/g, '')} x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet">`);
}

/** Vorlage einer Karte bestimmen (auch für «Eigene» Karten) */
function cardLook(c) {
  const p = PROFILES.find((x) => x.id === c.profileId);
  const words = String(c.name || 'Karte').trim().split(/\s+/);
  return {
    color: c.color || p?.color || '#3A3A3C',
    fg: c.fg || p?.fg || '#fff',
    mark: p?.mark || words[0],
    label: p ? p.label : words.slice(1).join(' '),
    art: p?.art || 'default',
  };
}

/**
 * Karte als SVG.
 * side: 'front' | 'back'
 * opts.image: Blob-URL eines eigenen Sujets (sonst mitgeliefertes Sujet)
 * opts.mini: nur Sujet ohne persönliche Angaben (für Vorschaubilder)
 */
function cardSVG(c, side, opts = {}) {
  const L = cardLook(c);
  const id = 'k' + (++svgSeq);
  const personal = !opts.mini && c.overlay !== false;
  const num = fmtNum(c.number || c.barcodeValue);
  let s = `<svg viewBox="0 0 ${CARD_W} ${CARD_H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block" font-family="${FONT}">
    <defs>
      <clipPath id="${id}c"><rect width="${CARD_W}" height="${CARD_H}" rx="34"/></clipPath>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(L.color, 0.12)}"/><stop offset="1" stop-color="${shade(L.color, -0.22)}"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></linearGradient>
    </defs><g clip-path="url(#${id}c)">`;

  if (side === 'front') {
    if (opts.image) {
      s += `<rect width="${CARD_W}" height="${CARD_H}" fill="${L.color}"/><image href="${opts.image}" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid slice"/>`;
      if (personal && (num || c.holder || c.validUntil)) s += `<rect width="${CARD_W}" height="${CARD_H}" fill="url(#${id}s)"/>`;
    } else {
      s += `<rect width="${CARD_W}" height="${CARD_H}" fill="url(#${id}g)"/>${artLayer(L.art, L.fg)}
        <text x="56" y="${56 + fit(L.mark, 92, 560) * 0.82}" font-size="${fit(L.mark, 92, 560)}" font-weight="800" letter-spacing="-1" fill="${L.fg}">${svgEsc(L.mark)}</text>
        ${L.label ? `<text x="58" y="${86 + fit(L.mark, 92, 560) * 0.82 + 34}" font-size="40" font-weight="500" fill="${L.fg}" fill-opacity=".88">${svgEsc(L.label)}</text>` : ''}`;
    }
    if (personal) {
      const tc = opts.image ? '#fff' : L.fg;
      if (num) s += `<text x="56" y="438" font-family="${MONO}" font-size="${fit(num, 46, 740)}" font-weight="600" letter-spacing="3" fill="${tc}">${svgEsc(num)}</text>`;
      if (c.holder) s += `<text x="58" y="496" font-size="30" font-weight="600" letter-spacing="2.5" fill="${tc}" fill-opacity=".92">${svgEsc(String(c.holder).toUpperCase())}</text>`;
      if (c.validUntil) {
        s += `<text x="800" y="466" text-anchor="end" font-size="17" font-weight="600" letter-spacing="1.5" fill="${tc}" fill-opacity=".75">GÜLTIG BIS</text>
          <text x="800" y="496" text-anchor="end" font-family="${MONO}" font-size="28" font-weight="600" fill="${tc}">${svgEsc(c.validUntil)}</text>`;
      }
    }
  } else {
    // Rückseite: helles Sujet mit Farbband (oder eigenes Bild) + Barcode-Feld
    if (opts.image) s += `<rect width="${CARD_W}" height="${CARD_H}" fill="#eee"/><image href="${opts.image}" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid slice"/>`;
    else {
      s += `<rect width="${CARD_W}" height="${CARD_H}" fill="#f5f5f7"/><rect width="${CARD_W}" height="104" fill="url(#${id}g)"/>
        <g opacity=".6">${artLayer(L.art, L.fg).replace(/<g[^>]*>|<\/g>/g, '')}</g>
        <rect y="104" width="${CARD_W}" height="${CARD_H}" fill="#f5f5f7"/>
        <text x="48" y="70" font-size="${fit(L.mark, 46, 420)}" font-weight="800" fill="${L.fg}">${svgEsc(L.mark)}</text>
        ${L.label ? `<text x="808" y="68" text-anchor="end" font-size="28" font-weight="500" fill="${L.fg}" fill-opacity=".9">${svgEsc(L.label)}</text>` : ''}`;
    }
    if (!opts.mini) {
      const code = codeSVG(c.barcodeValue || c.number, c.barcodeFormat);
      const top = opts.image ? 120 : 140;
      s += `<rect x="56" y="${top}" width="744" height="${code ? 270 : 150}" rx="22" fill="#fff" stroke="#000" stroke-opacity=".06"/>`;
      if (code?.svg) {
        const sz = code.qr ? 200 : 0;
        s += code.qr
          ? nestSVG(code.svg, 428 - sz / 2, top + 16, sz, sz)
          : nestSVG(code.svg, 90, top + 22, 676, 180);
        s += `<text x="428" y="${top + 252}" text-anchor="middle" font-family="${MONO}" font-size="${fit(num, 32, 640)}" font-weight="600" letter-spacing="3" fill="#111">${svgEsc(num)}</text>`;
      } else if (num) {
        s += `<text x="428" y="${top + 92}" text-anchor="middle" font-family="${MONO}" font-size="${fit(num, 48, 680)}" font-weight="600" letter-spacing="3" fill="#111">${svgEsc(num)}</text>`;
      }
      if (c.overlay !== false && !opts.image) {
        if (c.holder) s += `<text x="58" y="468" font-size="18" font-weight="600" letter-spacing="1.5" fill="#8e8e93">KARTENINHABER</text><text x="58" y="500" font-size="28" font-weight="600" fill="#111">${svgEsc(c.holder)}</text>`;
        if (c.validUntil) s += `<text x="798" y="468" text-anchor="end" font-size="18" font-weight="600" letter-spacing="1.5" fill="#8e8e93">GÜLTIG BIS</text><text x="798" y="500" text-anchor="end" font-family="${MONO}" font-size="28" font-weight="600" fill="#111">${svgEsc(c.validUntil)}</text>`;
        if (!c.holder && !c.validUntil) s += `<text x="428" y="490" text-anchor="middle" font-size="20" fill="#8e8e93">Persönliche Kundenkarte</text>`;
      }
    }
  }
  return s + '</g></svg>';
}
