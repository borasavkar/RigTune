'use strict';
// Veritabanında olmayan oyunlar için Steam mağazasından tür ve önerilen sistem gereksinimi (isteğe bağlı, internet gerekir).
// Gönderilen tek bilgi Steam uygulama numarası ya da oyun adıdır.
const gpudb = require('./gpudb');
const { clamp } = require('./util');

// Önbellekteki mağaza bilgisinin biçim sürümü. 2: bellek ve SSD gereksinimi eklendi; eski kayıtlar yeniden alınır.
const META_V = 2;

async function getJson(url, ms = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { 'Accept-Language': 'en' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

function recGpuScore(html) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ');
  const m = text.match(/(RTX|GTX)\s*\d{3,4}\s*(Ti\s*SUPER|Ti|SUPER)?|RX\s*\d{3,4}\s*(XTX|XT|GRE)?|Arc\s*[AB]\d{3}/gi) || [];
  const scores = m.map(s => gpudb.lookup(s, '', 0)).filter(x => x.known).map(x => x.score);
  return scores.length ? Math.max(...scores) : null;
}

// Sistem gereksinimi metninden bellek (GB) ve SSD şartı. Steam'in şablonunda satırlar "Memory: 16 GB RAM",
// "Storage: 70 GB available space", "Additional Notes: SSD required" biçimindedir.
// ssd: 'req' (SSD şart), 'rec' (SSD öneriliyor) ya da null. Yalnızca açıkça yazılmışsa işaretlenir.
const SSD_REQ = /SSD\s*(is\s*)?(required|mandatory)|requires?\s+(an?\s+)?SSD|SSD\s*\(\s*required\s*\)/i;
const SSD_REC = /SSD\s*(is\s*)?(recommended|preferred|strongly recommended)|recommend(ed)?\s+(an?\s+)?SSD|SSD\s*\(\s*(recommended|preferred)\s*\)/i;
function reqText(html) {
  return String(html || '').replace(/<br\s*\/?>|<\/li>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ');
}
function parseReq(pc) {
  pc = pc && !Array.isArray(pc) ? pc : {};
  const min = reqText(pc.minimum), rec = reqText(pc.recommended);
  const ram = s => { const m = /Memory:\s*([\d.,]+)\s*(GB|MB|G)\b/i.exec(s); if (!m) return null; const v = parseFloat(m[1].replace(',', '.')); return /^M/i.test(m[2]) ? Math.round(v / 1024) : v; };
  // En düşük gereksinimin depolama satırı HDD seçeneği vermeden SSD diyorsa (ör. "70 GB SSD") SSD şarttır.
  const storage = s => ((/^\s*(Storage|Hard Drive|Hard Disk Space):\s*(.*)$/im.exec(s) || [])[2] || '');
  let ssd = null;
  if (SSD_REQ.test(min) || SSD_REQ.test(rec) || (/\bSSD\b/.test(storage(min)) && !/HDD|recommend|prefer/i.test(storage(min)))) ssd = 'req';
  else if (SSD_REC.test(min) || SSD_REC.test(rec) || (/\bSSD\b/.test(storage(rec)) && !/HDD/i.test(storage(rec)))) ssd = 'rec';
  return { ramMin: ram(min), ramRec: ram(rec), ssd };
}

function classify(d) {
  const cats = new Set((d.categories || []).map(c => c.id));
  const gen = new Set((d.genres || []).map(g => +g.id));
  const single = cats.has(2);
  let t = 'aks';
  if ((cats.has(36) || cats.has(49)) && !single) t = 'rek';
  else if (cats.has(20) || gen.has(29)) t = 'koop';
  else if (cats.has(38) && !single) t = 'koop';
  else if (gen.has(9) || gen.has(18)) t = 'yar';
  else if ((gen.has(2) || gen.has(4)) && !gen.has(1)) t = 'haf';
  const year = +((/(\d{4})/.exec((d.release_date && d.release_date.date) || '') || [])[1]) || null;
  const rec = recGpuScore(d.pc_requirements && d.pc_requirements.recommended);
  let y;
  if (rec) {
    // Önerilen gereksinim genelde 1080p/60 FPS içindir; 1440p'de RX 9070 XT sınıfı karta oranla FPS kestirilir.
    const fps = 60 * (100 / rec) / 1.6;
    y = fps > 150 ? 1 : fps > 90 ? 2 : fps > 60 ? 3 : 4;
  } else y = year >= 2024 ? 3 : year >= 2020 ? 2 : 1;
  if (t === 'haf') y = Math.min(y, 2);
  return { name: d.name, t, y: clamp(y, 1, 4), year, genres: (d.genres || []).map(g => g.description), recGpuScore: rec, ...parseReq(d.pc_requirements), v: META_V, at: Date.now() };
}

async function lookup(game) {
  let appid = game.appid;
  if (!appid && game.name) {
    const s = await getJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(game.name)}&l=english&cc=us`);
    const item = (s.items || [])[0];
    if (!item) return { none: true, at: Date.now() };
    appid = String(item.id);
  }
  if (!appid) return { none: true, at: Date.now() };
  const j = await getJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=english&cc=us`);
  const e = j && j[appid];
  if (!e || !e.success || !e.data) return { none: true, at: Date.now() };
  return { ...classify(e.data), appid };
}

module.exports = { lookup, classify, recGpuScore, parseReq, META_V };
