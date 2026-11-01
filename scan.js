'use strict';

/* =========================================================
   Karten-Scanner: Karte im Foto finden, entzerren und auf das
   exakte Kartenformat (85.6 × 54 mm) bringen. Farben bleiben unverändert.
   ========================================================= */

const CARD_RATIO = 85.6 / 54;
const SCAN_W = 1800, SCAN_H = Math.round(SCAN_W / CARD_RATIO);

/** Otsu-Schwelle für Werte 0..255 */
function otsu(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 0;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = i; }
  }
  return thr;
}

function convexHull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const polyArea = (q) => Math.abs(q.reduce((s, p, i) => { const n = q[(i + 1) % q.length]; return s + p[0] * n[1] - n[0] * p[1]; }, 0)) / 2;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function isConvex(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (z === 0) return false;
    if (!sign) sign = Math.sign(z); else if (Math.sign(z) !== sign) return false;
  }
  return true;
}

/** Ecken im Uhrzeigersinn ab oben links; die erste Seite ist eine lange Kartenseite */
function orderQuad(q) {
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  q = q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  let start = 0, best = Infinity;
  q.forEach((p, i) => { if (p[0] + p[1] < best) { best = p[0] + p[1]; start = i; } });
  q = q.slice(start).concat(q.slice(0, start));
  if (dist(q[0], q[1]) + dist(q[2], q[3]) < dist(q[1], q[2]) + dist(q[3], q[0])) q = [q[3], q[0], q[1], q[2]];
  return q;
}

/**
 * Sucht die Karte im Bild. Liefert 4 Eckpunkte (Bildkoordinaten) oder null,
 * wenn kein eindeutiger Hintergrund erkennbar ist (z. B. Bild zeigt nur die Karte).
 */
function detectCard(src) {
  const sc = Math.min(1, 360 / Math.max(src.width, src.height));
  const w = Math.max(8, Math.round(src.width * sc)), h = Math.max(8, Math.round(src.height * sc));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const N = w * h;

  // Hintergrundfarbe = Median der Randpixel
  const R = [], G = [], B = [];
  const take = (x, y) => { const i = (y * w + x) * 4; R.push(px[i]); G.push(px[i + 1]); B.push(px[i + 2]); };
  for (let x = 0; x < w; x++) for (const y of [0, 1, h - 2, h - 1]) take(x, y);
  for (let y = 2; y < h - 2; y++) for (const x of [0, 1, w - 2, w - 1]) take(x, y);
  const med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
  const bg = [med(R), med(G), med(B)];

  // Farbabstand jedes Pixels zum Hintergrund
  const d = new Uint8Array(N), hist = new Uint32Array(256);
  for (let i = 0; i < N; i++) {
    const v = Math.min(255, Math.hypot(px[i * 4] - bg[0], px[i * 4 + 1] - bg[1], px[i * 4 + 2] - bg[2]) * 0.8);
    d[i] = v; hist[v | 0]++;
  }
  // Rand nicht einheitlich -> vermutlich ist bereits nur die Karte im Bild
  let borderFar = 0;
  for (let i = 0; i < R.length; i++) if (Math.hypot(R[i] - bg[0], G[i] - bg[1], B[i] - bg[2]) > 60) borderFar++;
  if (borderFar / R.length > 0.3) return null;

  const thr = Math.max(26, otsu(hist, N));
  let m = new Uint8Array(N);
  for (let i = 0; i < N; i++) m[i] = d[i] > thr ? 1 : 0;

  // Schliessen (Dilatation, dann Erosion), damit Schrift und Logos keine Löcher reissen
  const morph = (a, dil) => {
    const o = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = dil ? 0 : 1;
      for (let dy = -1; dy <= 1 && v !== (dil ? 1 : 0); dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        const s = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : a[yy * w + xx];
        if (dil && s) { v = 1; break; }
        if (!dil && !s) { v = 0; break; }
      }
      o[y * w + x] = v;
    }
    return o;
  };
  m = morph(morph(m, true), true);
  m = morph(morph(m, false), false);

  // Löcher füllen: alles, was vom Rand aus nicht über Hintergrund erreichbar ist, gehört zur Karte
  const reach = new Uint8Array(N), stack = [];
  const push = (i) => { if (!reach[i] && !m[i]) { reach[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }

  // Grösste zusammenhängende Fläche
  const lab = new Int32Array(N);
  let bestLab = 0, bestSize = 0, cur = 0;
  for (let s = 0; s < N; s++) {
    if (reach[s] || lab[s]) continue;
    cur++; let size = 0; stack.push(s); lab[s] = cur;
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0; size++;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) if (j >= 0 && !reach[j] && !lab[j]) { lab[j] = cur; stack.push(j); }
    }
    if (size > bestSize) { bestSize = size; bestLab = cur; }
  }
  if (bestSize < N * 0.08 || bestSize > N * 0.97) return null;

  // Randpunkte -> konvexe Hülle
  const pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (lab[i] !== bestLab) continue;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || lab[i - 1] !== bestLab || lab[i + 1] !== bestLab || lab[i - w] !== bestLab || lab[i + w] !== bestLab) pts.push([x, y]);
  }
  const hull = convexHull(pts);
  if (hull.length < 4) return null;

  // Kleinstes umschliessendes Rechteck (Rotating Calipers)
  let rect = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const len = dist(a, b) || 1;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const u = p[0] * ux + p[1] * uy, v = -p[0] * uy + p[1] * ux;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!rect || area < rect.area) rect = { area, ux, uy, minU, maxU, minV, maxV };
  }
  const P = (u, v) => [u * rect.ux - v * rect.uy, u * rect.uy + v * rect.ux];
  const rectQ = [P(rect.minU, rect.minV), P(rect.maxU, rect.minV), P(rect.maxU, rect.maxV), P(rect.minU, rect.maxV)];

  // Pro Kartenseite die längste Hüllenkante als Gerade nehmen (Ecken sind abgerundet)
  const cu = (rect.minU + rect.maxU) / 2, cvv = (rect.minV + rect.maxV) / 2;
  const side = [null, null, null, null]; // 0: oben(v min) 1: rechts(u max) 2: unten 3: links
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const len = dist(a, b);
    const ex = (b[0] - a[0]) / len, ey = (b[1] - a[1]) / len;
    const along = Math.abs(ex * rect.ux + ey * rect.uy);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const mu = mx * rect.ux + my * rect.uy, mv = -mx * rect.uy + my * rect.ux;
    const k = along > 0.7071 ? (mv < cvv ? 0 : 2) : (mu > cu ? 1 : 3);
    if (!side[k] || len > side[k].len) side[k] = { a, b, len };
  }
  let quad = rectQ;
  if (side.every(Boolean)) {
    const inter = (s1, s2) => {
      const [x1, y1] = s1.a, [x2, y2] = s1.b, [x3, y3] = s2.a, [x4, y4] = s2.b;
      const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(den) < 1e-6) return null;
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
      return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
    };
    const q = [inter(side[3], side[0]), inter(side[0], side[1]), inter(side[1], side[2]), inter(side[2], side[3])];
    const hullA = polyArea(hull);
    if (q.every((p) => p && p[0] > -0.1 * w && p[0] < 1.1 * w && p[1] > -0.1 * h && p[1] < 1.1 * h)
      && isConvex(q) && polyArea(q) > hullA * 0.9 && polyArea(q) < hullA * 1.2) quad = q;
  }
  return orderQuad(quad.map(([x, y]) => [Math.min(src.width, Math.max(0, x / sc)), Math.min(src.height, Math.max(0, y / sc))]));
}

/** Viereck aus dem Bild perspektivisch entzerren (bilineare Abtastung) */
function warpQuad(src, quad, W = SCAN_W, H = SCAN_H) {
  const sctx = src.getContext('2d', { willReadFrequently: true });
  const sw = src.width, sh = src.height;
  const S = sctx.getImageData(0, 0, sw, sh).data;
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  // Einheitsquadrat -> Viereck (Heckbert)
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, hh;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = x1 - x0; b = x3 - x0; c = x0; d = y1 - y0; e = y3 - y0; f = y0; g = 0; hh = 0;
  } else {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det; hh = (dx1 * dy3 - dx3 * dy1) / det;
    a = x1 - x0 + g * x1; b = x3 - x0 + hh * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + hh * y3; f = y0;
  }
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const octx = out.getContext('2d');
  const img = octx.createImageData(W, H), O = img.data;
  for (let j = 0; j < H; j++) {
    const v = (j + 0.5) / H;
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W;
      const z = g * u + hh * v + 1;
      let x = (a * u + b * v + c) / z - 0.5, y = (d * u + e * v + f) / z - 0.5;
      x = Math.max(0, Math.min(sw - 1.001, x)); y = Math.max(0, Math.min(sh - 1.001, y));
      const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
      const p = (yi * sw + xi) * 4, q = p + sw * 4;
      const o = (j * W + i) * 4;
      for (let k = 0; k < 3; k++) {
        const top = S[p + k] + (S[p + 4 + k] - S[p + k]) * fx;
        const bot = S[q + k] + (S[q + 4 + k] - S[q + k]) * fx;
        O[o + k] = top + (bot - top) * fy;
      }
      O[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function rotate180(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d');
  ctx.translate(cv.width, cv.height); ctx.rotate(Math.PI);
  ctx.drawImage(src, 0, 0);
  return cv;
}

/** Hauptfarbe der Karte (häufigste Farbe, ohne fast weisse/graue Flächen wenn möglich) und passende Schriftfarbe */
function dominantColor(cv) {
  const t = document.createElement('canvas');
  t.width = 64; t.height = 40;
  const ctx = t.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(cv, 0, 0, 64, 40);
  const p = ctx.getImageData(0, 0, 64, 40).data;
  const bins = new Map();
  for (let i = 0; i < p.length; i += 4) {
    const key = ((p[i] >> 4) << 8) | ((p[i + 1] >> 4) << 4) | (p[i + 2] >> 4);
    const sat = Math.max(p[i], p[i + 1], p[i + 2]) - Math.min(p[i], p[i + 1], p[i + 2]);
    const e = bins.get(key) || { n: 0, r: 0, g: 0, b: 0, w: 0 };
    e.n++; e.r += p[i]; e.g += p[i + 1]; e.b += p[i + 2]; e.w += 1 + sat / 40;
    bins.set(key, e);
  }
  const best = [...bins.values()].sort((x, y) => y.w - x.w)[0];
  const rgb = [best.r / best.n, best.g / best.n, best.b / best.n].map(Math.round);
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return { color: '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join(''), fg: lum > 0.62 ? '#111111' : '#ffffff' };
}
