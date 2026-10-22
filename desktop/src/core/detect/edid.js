'use strict';
// EDID çözücü: monitörün kendi bildirdiği adı, doğal çözünürlüğü, yenileme aralığını,
// değişken yenileme (FreeSync / HDMI VRR / Adaptive-Sync) ve HDR yeteneğini çıkarır.
// Kaynak biçimler: VESA E-EDID 1.4, CTA-861 uzantısı, DisplayID 1.3/2.0 uzantısı.

const PNP = {
  AOC: 'AOC', AUS: 'ASUS', ACI: 'ASUS', ACR: 'Acer', BNQ: 'BenQ', DEL: 'Dell', GSM: 'LG', LGD: 'LG Display', SAM: 'Samsung',
  SNY: 'Sony', HWP: 'HP', HPN: 'HP', LEN: 'Lenovo', MSI: 'MSI', MST: 'MSI', GBT: 'Gigabyte', GGT: 'Gigabyte', PHL: 'Philips',
  VSC: 'ViewSonic', IVM: 'iiyama', XMI: 'Xiaomi', AUO: 'AU Optronics', BOE: 'BOE', CMN: 'Innolux', SHP: 'Sharp', APP: 'Apple',
  NEC: 'NEC', EIZ: 'EIZO', ENC: 'EIZO', HKC: 'HKC', KTC: 'KTC', AOU: 'AOC', ASU: 'ASUS', CPT: 'Chunghwa', SDC: 'Samsung Display',
  VIZ: 'Vizio', TCL: 'TCL', HIS: 'Hisense', HSD: 'HannStar', HSP: 'HannStar', PNP: 'Generic', RTK: 'Realtek', MEI: 'Panasonic',
  TSB: 'Toshiba', FUS: 'Fujitsu', NOK: 'Nokia', ZOW: 'ZOWIE', CRS: 'Corsair', AOR: 'Aorus', PXL: 'Pixio', MZI: 'Monoprice',
};

function u16(b, i) { return b[i] | (b[i + 1] << 8); }

function parseDTD(b, i, src) {
  const clock = u16(b, i) * 10000; // Hz
  if (!clock) return null;
  const hA = b[i + 2] | ((b[i + 4] & 0xf0) << 4);
  const hB = b[i + 3] | ((b[i + 4] & 0x0f) << 8);
  const vA = b[i + 5] | ((b[i + 7] & 0xf0) << 4);
  const vB = b[i + 6] | ((b[i + 7] & 0x0f) << 8);
  if (!hA || !vA) return null;
  const hz = clock / ((hA + hB) * (vA + vB));
  return { w: hA, h: vA, hz: Math.round(hz * 100) / 100, interlaced: !!(b[i + 17] & 0x80), src };
}

function parseBase(b, out) {
  const m = ((b[8] << 8) | b[9]);
  out.manufacturerId = String.fromCharCode(((m >> 10) & 31) + 64, ((m >> 5) & 31) + 64, (m & 31) + 64);
  out.manufacturer = PNP[out.manufacturerId] || out.manufacturerId;
  out.productCode = u16(b, 10).toString(16).toUpperCase().padStart(4, '0');
  out.serialNumber = (b[12] | (b[13] << 8) | (b[14] << 16) | (b[15] << 24)) >>> 0;
  out.week = b[16];
  out.year = b[17] ? 1990 + b[17] : null;
  out.version = `${b[18]}.${b[19]}`;
  const input = b[20];
  out.digital = !!(input & 0x80);
  if (out.digital && b[18] === 1 && b[19] >= 4) {
    out.bitDepth = [null, 6, 8, 10, 12, 14, 16, null][(input >> 4) & 7];
    out.interface = [null, 'DVI', 'HDMI', 'HDMI', 'MDDI', 'DisplayPort'][input & 15] || null;
  }
  if (b[21] && b[22]) out.sizeCm = { w: b[21], h: b[22] };
  for (let d = 0; d < 4; d++) {
    const i = 54 + d * 18;
    if (b[i] || b[i + 1]) {
      const t = parseDTD(b, i, 'base');
      if (t) { out.timings.push(t); if (d === 0) out.preferred = t; }
      continue;
    }
    const tag = b[i + 3];
    const text = () => Buffer.from(b.slice(i + 5, i + 18)).toString('latin1').split('\n')[0].trim();
    if (tag === 0xfc) out.name = (out.name ? out.name + ' ' : '') + text();
    else if (tag === 0xff) out.serialText = text();
    else if (tag === 0xfd) {
      const f = b[i + 4];
      out.range = {
        vMin: b[i + 5] + ((f & 3) === 3 ? 255 : 0),
        vMax: b[i + 6] + ((f & 2) ? 255 : 0),
        hMinKHz: b[i + 7] + ((f & 12) === 12 ? 255 : 0),
        hMaxKHz: b[i + 8] + ((f & 8) ? 255 : 0),
        maxClockMHz: b[i + 9] * 10,
      };
    }
  }
}

function parseCTA(x, out) {
  const d = x[2];
  out.cta = true;
  let i = 4;
  while (i < d && i < 127) {
    const hdr = x[i], tag = hdr >> 5, len = hdr & 31;
    const p = x.slice(i + 1, i + 1 + len);
    if (tag === 3 && len >= 3) {
      const oui = p[0] | (p[1] << 8) | (p[2] << 16);
      const y = p.slice(3);
      if (oui === 0x000c03) out.hdmi = true;
      else if (oui === 0x00001a && y.length >= 4) {
        // AMD VSDB (FreeSync). Alan sırası edid-decode'daki tersine mühendislikten alınmıştır.
        out.freesync = { version: `${y[0]}.${y[1]}`, min: y[2], max: y[3] };
      } else if (oui === 0xc45dd8 && y.length >= 2) {
        const hf = { maxTmdsMHz: y[1] * 5 };
        if (y.length >= 6) hf.allm = !!(y[5] & 0x02);
        if (y.length >= 8) {
          const vmin = y[6] & 0x3f, vmax = ((y[6] & 0xc0) << 2) | y[7];
          if (vmin && vmax) hf.vrr = { min: vmin, max: vmax };
        }
        out.hdmiForum = hf;
      }
    } else if (tag === 7 && len >= 1) {
      const ext = p[0];
      if (ext === 0x06 && len >= 3) {
        const e = p[1];
        const hdr = { sdr: !!(e & 1), hdrTrad: !!(e & 2), pq: !!(e & 4), hlg: !!(e & 8) };
        if (len >= 4 && p[3]) hdr.maxNits = Math.round(50 * Math.pow(2, p[3] / 32));
        if (len >= 5 && p[4]) hdr.maxFallNits = Math.round(50 * Math.pow(2, p[4] / 32));
        if (len >= 6 && hdr.maxNits) hdr.minNits = Math.round(hdr.maxNits * Math.pow(p[5] / 255, 2) / 100 * 1000) / 1000;
        out.hdrMeta = hdr;
      } else if (ext === 0x05 && len >= 2) {
        out.colorimetry = { bt2020rgb: !!(p[1] & 0x80), bt2020ycc: !!(p[1] & 0x40), dciP3: len >= 3 ? !!(p[2] & 0x80) : false };
      }
    }
    i += 1 + len;
  }
  for (let j = d; j + 18 <= 127 && d >= 4; j += 18) {
    const t = parseDTD(x, j, 'cta');
    if (t) out.timings.push(t); else break;
  }
}

function parseDisplayIdTiming(p, kHz, out) {
  for (let j = 0; j + 20 <= p.length; j += 20) {
    const clock = ((p[j] | (p[j + 1] << 8) | (p[j + 2] << 16)) + 1) * (kHz ? 1000 : 10000);
    const hA = (p[j + 4] | (p[j + 5] << 8)) + 1, hB = (p[j + 6] | (p[j + 7] << 8)) + 1;
    const vA = (p[j + 12] | (p[j + 13] << 8)) + 1, vB = (p[j + 14] | (p[j + 15] << 8)) + 1;
    const hz = clock / ((hA + hB) * (vA + vB));
    if (hA > 0 && vA > 0 && hz > 0) out.timings.push({ w: hA, h: vA, hz: Math.round(hz * 100) / 100, src: 'displayid' });
  }
}

function parseDisplayID(x, out) {
  out.displayId = true;
  const len = x[2];
  let i = 5;
  const end = Math.min(5 + len, 127);
  while (i + 3 <= end) {
    const tag = x[i], rev = x[i + 1], n = x[i + 2];
    if (!tag && !n) break;
    const p = x.slice(i + 3, i + 3 + n);
    if (tag === 0x03) parseDisplayIdTiming(p, false, out); // Type I
    else if (tag === 0x22) parseDisplayIdTiming(p, true, out); // Type VII
    else if (tag === 0x2b) {
      const size = 6 + ((rev >> 4) & 7);
      for (let j = 0; j + size <= p.length; j += size) {
        const min = p[j + 2], max = 1 + (p[j + 3] | ((p[j + 4] & 3) << 8));
        if (min && max > min) (out.adaptiveSync = out.adaptiveSync || []).push({ min, max });
      }
    }
    i += 3 + n;
  }
}

function parseEdid(input) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(String(input || '').replace(/[^0-9a-f]/gi, ''), 'hex');
  if (b.length < 128 || b.readUInt32BE(0) !== 0x00ffffff || b.readUInt32BE(4) !== 0xffffff00) return null;
  const out = { timings: [] };
  parseBase(b, out);
  const blocks = Math.min(b[126], Math.floor(b.length / 128) - 1);
  for (let k = 1; k <= blocks; k++) {
    const x = b.slice(k * 128, k * 128 + 128);
    if (x[0] === 0x02) parseCTA(x, out);
    else if (x[0] === 0x70) parseDisplayID(x, out);
  }
  // Özet alanlar
  const progressive = out.timings.filter(t => !t.interlaced);
  const native = out.preferred || progressive.slice().sort((a, c) => c.w * c.h - a.w * a.h)[0] || null;
  out.native = native ? { w: native.w, h: native.h } : null;
  const atNative = progressive.filter(t => native && t.w === native.w && t.h === native.h).map(t => t.hz);
  out.maxHzTimings = atNative.length ? Math.floor(Math.max(...atNative) + 0.5) : null;
  out.vrr = vrrSummary(out);
  out.hdr = out.hdrMeta ? { pq: out.hdrMeta.pq, hlg: out.hdrMeta.hlg, maxNits: out.hdrMeta.maxNits || null } : null;
  return out;
}

function vrrSummary(e) {
  if (e.freesync && e.freesync.max > e.freesync.min) return { kind: 'FreeSync', min: e.freesync.min, max: e.freesync.max, sure: true };
  if (e.adaptiveSync && e.adaptiveSync.length) {
    const a = e.adaptiveSync.reduce((m, r) => (r.max > m.max ? r : m));
    return { kind: 'Adaptive-Sync', min: a.min, max: a.max, sure: true };
  }
  if (e.hdmiForum && e.hdmiForum.vrr) return { kind: 'HDMI VRR', min: e.hdmiForum.vrr.min, max: e.hdmiForum.vrr.max, sure: true };
  // DisplayPort Adaptive-Sync çoğu zaman yalnızca aralık tanımlayıcısıyla bildirilir; bu durumda "muhtemel".
  if (e.range && e.range.vMax - e.range.vMin >= 40 && e.range.vMax >= 100) return { kind: 'Adaptive-Sync', min: e.range.vMin, max: e.range.vMax, sure: false };
  return null;
}

module.exports = { parseEdid, PNP };
