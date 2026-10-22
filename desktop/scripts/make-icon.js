'use strict';
// Uygulama simgesini (PNG) üretir: koyu cam zemin, renk geçişli gösterge yayı ve ibre. Dış bağımlılık yok.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const N = 512, SS = 4;
const out = Buffer.alloc(N * N * 4);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => lerp(v, c2[i], t));
const RED = [255, 59, 92], VIOLET = [139, 92, 246], CYAN = [34, 211, 238];

function sdRoundRect(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

const cx = N / 2, cy = N * 0.56, R = N * 0.30, TH = N * 0.07;
const a0 = (150 * Math.PI) / 180, sweep = (240 * Math.PI) / 180;
const needleA = a0 + sweep * 0.78;
const nx = cx + Math.cos(needleA) * R * 0.78, ny = cy + Math.sin(needleA) * R * 0.78;

function shade(x, y) {
  let col = [0, 0, 0], a = 0;
  const over = (c, al) => { col = mix(col, c, al / Math.max(1e-6, a + al * (1 - a)) * 1); a = a + al * (1 - a); };
  const dBox = sdRoundRect(x, y, N / 2, N / 2, N * 0.46, N * 0.46, N * 0.11);
  if (dBox > 0) return [0, 0, 0, 0];
  // Zemin: dikey geçiş + üstte cam parıltısı
  const t = y / N;
  col = mix([30, 36, 62], [10, 12, 24], t); a = 1;
  if (dBox > -N * 0.012) col = mix(col, [120, 130, 170], 0.55);
  const gl = Math.max(0, 1 - Math.hypot((x - N * 0.3) / (N * 0.55), (y - N * 0.05) / (N * 0.35)));
  col = mix(col, [90, 100, 160], gl * 0.35);
  // Yay
  const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
  let ang = Math.atan2(dy, dx); if (ang < a0 - 0.0001) ang += Math.PI * 2;
  let along = (ang - a0) / sweep;
  // Yaya uzaklık: yay üzerindeyse yarıçap farkı, dışındaysa en yakın uca uzaklık (yuvarlak uç).
  let dArc;
  if (along >= 0 && along <= 1) dArc = Math.abs(r - R);
  else {
    const e0 = [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], e1 = [cx + Math.cos(a0 + sweep) * R, cy + Math.sin(a0 + sweep) * R];
    const d0 = Math.hypot(x - e0[0], y - e0[1]), d1 = Math.hypot(x - e1[0], y - e1[1]);
    dArc = Math.min(d0, d1);
    along = d0 < d1 ? 0 : 1;
  }
  const arcCol = along < 0.5 ? mix(RED, VIOLET, along * 2) : mix(VIOLET, CYAN, (along - 0.5) * 2);
  if (dArc <= TH / 2) col = mix(col, arcCol, 1);
  else if (dArc <= TH * 1.6) col = mix(col, arcCol, Math.max(0, 1 - (dArc - TH / 2) / (TH * 1.1)) * 0.35);
  // İbre ve göbek
  if (sdSegment(x, y, cx, cy, nx, ny) <= N * 0.022) col = mix(col, [245, 247, 255], 1);
  if (Math.hypot(dx, dy) <= N * 0.045) col = mix(col, [245, 247, 255], 1);
  if (Math.hypot(dx, dy) <= N * 0.02) col = mix(col, [139, 92, 246], 1);
  return [...col, 255];
}

for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  let r = 0, g = 0, b = 0, al = 0;
  for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
    const p = shade(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
    const w = p[3] / 255; r += p[0] * w; g += p[1] * w; b += p[2] * w; al += w;
  }
  const i = (y * N + x) * 4, n = SS * SS;
  out[i] = al ? r / al : 0; out[i + 1] = al ? g / al : 0; out[i + 2] = al ? b / al : 0; out[i + 3] = (al / n) * 255;
}

function png(w, h, rgba) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const dir = path.join(__dirname, '..', 'src', 'renderer', 'assets');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon.png'), png(N, N, out));
console.log('icon.png yazıldı:', path.join(dir, 'icon.png'));
