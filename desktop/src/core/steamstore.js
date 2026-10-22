'use strict';
// Veritabanında olmayan oyunlar için Steam mağazasından tür ve önerilen sistem gereksinimi (isteğe bağlı, internet gerekir).
// Gönderilen tek bilgi Steam uygulama numarası ya da oyun adıdır.
const gpudb = require('./gpudb');
const { clamp } = require('./util');

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
  return { name: d.name, t, y: clamp(y, 1, 4), year, genres: (d.genres || []).map(g => g.description), recGpuScore: rec, at: Date.now() };
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

module.exports = { lookup, classify, recGpuScore };
