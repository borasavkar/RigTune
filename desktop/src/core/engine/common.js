'use strict';
// Öneri motorunun üreticiden bağımsız kısmı: oyun profili, yük seviyesi, ölçekleme ihtiyacı, kare üretimi ve FPS sınırı planı.
// Metinler src/locales içinde; c.t(anahtar, parametre) seçili dilde metin döndürür.
const { clamp } = require('../util');
const { translator } = require('../../locales');

// FSR sürüm adları (dilden bağımsız). fsr31n: FSR 3.1 ama AMD'nin FSR 4 listesinde değil.
const FSN = { fsr31: 'FSR 3.1', fsr31n: 'FSR 3.1', fsr3: 'FSR 3.0', fsr2: 'FSR 2.x', fsr1: 'FSR 1' };
const FS = f => FSN[f];
const FSR_RANK = { yok: 0, fsr1: 1, fsr2: 2, fsr3: 3, fsr31n: 4, fsr31: 4, fsr4: 5 };

// Oyun notları: veritabanında seçili dilin karşılığı (db.en gibi) varsa o, yoksa Türkçe asıl.
function notesOf(db, lang) {
  if (!db) return { no: null, noAmd: null, tips: [] };
  const l = lang && lang !== 'tr' ? db[lang] : null;
  const pick = k => (l && l[k] != null ? l[k] : db[k]);
  return { no: pick('no') || null, noAmd: pick('noAmd') || null, tips: pick('tips') || [] };
}

// Veritabanı + dosya incelemesi + mağaza bilgisi + kullanıcı düzeltmesi → tek profil.
function buildProfile(game, db, probe, meta, ov, lang = 'tr') {
  ov = ov || {};
  probe = probe && !probe.error ? probe : null;
  const est = {};
  let t = ov.t || (db && db.t) || (meta && meta.t);
  if (!t) { t = probe && probe.antiCheat && probe.antiCheat.length ? 'koop' : 'aks'; est.t = true; }
  else if (!ov.t && !(db && db.t)) est.t = 'mağaza';
  let y = ov.y || (db && db.y) || (meta && meta.y);
  if (!y) {
    est.y = true;
    const e = (probe && probe.engine) || '';
    y = /Jomini|Clausewitz|TaleWorlds/i.test(e) ? 1 : (probe && (probe.dlssRR || probe.dlssFG)) || /Unreal Engine 5/.test(e) ? 3 : 2;
  } else if (!ov.y && !(db && db.y)) est.y = 'mağaza';
  // FSR: dosyalarda veritabanındakinden yeni sürüm varsa (oyun güncellenmiş) dosya kazanır.
  let f = db && db.f;
  const pf = probe ? (probe.ffxSdk2 ? 'fsr4' : probe.fsr) : null;
  if (pf && (!f || FSR_RANK[pf] > FSR_RANK[f])) f = pf;
  if (ov.f) f = ov.f;
  if (!f) f = '?';
  const ac = ov.ac != null ? ov.ac : (db && db.ac) || (probe && probe.antiCheat.length ? probe.antiCheat.join(' + ') : '');
  return {
    id: game.id, n: (db && game.source !== 'folder' ? game.name : null) || (db && db.n) || game.name || (meta && meta.name) || translator(lang)('eng.steamApp', { id: game.appid }),
    dbName: db ? db.n : null,
    // Sürücü uygulamasındaki oyun profilini bulmak için (klasör ve Steam numarası)
    dir: game.installDir || null, appid: game.appid || (db && db.ids && db.ids.steam) || null,
    t, y: clamp(+y, 1, 4), f,
    fg: (db && db.fg) || (probe && probe.fsrFG) ? 1 : 0,
    al: db && db.al ? 1 : 0,
    c60: (ov.c60 != null ? ov.c60 : db && db.c60) ? 1 : 0,
    ac,
    dl: !!((db && db.dl) || (probe && probe.dlss)), dlVer: probe ? probe.dlssVersion : null,
    dfg: !!((db && db.dfg) || (probe && probe.dlssFG)), rr: !!(probe && probe.dlssRR),
    rx: !!((db && db.rx) || (probe && probe.reflex)),
    xs: !!((db && db.xs) || (probe && probe.xess)), xsMajor: probe ? probe.xessMajor : null, xfg: !!(probe && probe.xessFG), xll: !!(probe && probe.xell),
    eng: probe ? probe.engine : null, rt: db && db.rt,
    // İşlemciye bağlı oyun (1) ya da değil (0); boşsa türden ve motordan çıkarılır (engine/hardware.js). ow: açık dünya.
    cpu: db && db.cpu != null ? db.cpu : null, ow: db && db.ow ? 1 : 0,
    // Steam mağazasındaki sistem gereksinimi: bellek (GB) ve SSD şartı
    req: meta && (meta.ramMin || meta.ramRec || meta.ssd) ? { ramMin: meta.ramMin || null, ramRec: meta.ramRec || null, ssd: meta.ssd || null } : null,
    ...notesOf(db, lang),
    est, inDb: !!db, probed: !!probe, ov,
  };
}

// Sistem bağlamı: seçili ekran kartı ve monitörden türetilen değerler.
function context(sys, primary, prefs) {
  const t = translator((prefs && prefs.lang) || 'tr');
  const gpu = primary.gpu || { name: t('detect.unknownGpu'), vendor: 'other', score: 40, features: { rt: 0 }, vramGB: null };
  const d = primary.display || { name: t('detect.monitor'), current: { w: 1920, h: 1080, hz: 60 }, native: { w: 1920, h: 1080 }, maxHz: 60, vrr: null, hdr: {} };
  const w = d.current.w || (d.native && d.native.w) || 1920, h = d.current.h || (d.native && d.native.h) || 1080;
  const hz = Math.round(d.current.hz || 60);
  const vrr = !!(d.vrr && d.vrr.max >= Math.min(hz, d.vrr.max) && d.vrr.min < hz);
  return {
    gpu, F: gpu.features || {}, vendor: gpu.vendor, vram: gpu.vramGB, display: d, w, h, hz, vrr,
    resLabel: `${w}×${h}`, uw: w / h > 2.1, is4k: w * h >= 7.5e6,
    resShift: Math.log2((w * h) / 3686400), gpuShift: Math.log2(100 / (gpu.score || 40)),
    goal: (prefs && prefs.goal) || 'denge', win: sys.winSettings, sys, t, lang: t.lang,
    // Adrenalin'de şu an kayıtlı ayarlar (detect/amd-settings.js); okunamadıysa null.
    amd: gpu.vendor === 'amd' && sys.amdSettings && sys.amdSettings.ok ? sys.amdSettings : null,
  };
}

function level(g, c) {
  const raw = g.y - 1 + c.resShift + c.gpuShift;
  return { L: clamp(Math.round(raw), 0, 3), over: raw > 3.6 };
}

// Ölçekleyici gerekiyor mu? Denge: mevcut uygulamadaki eşik. Kalite: bir kademe geç, Yüksek FPS: bir kademe erken.
function needUpscale(g, c, L) {
  const rk = g.t === 'rek';
  const th = { denge: 2, kalite: 3, fps: 1 }[c.goal] || 2;
  return L >= th || (c.is4k && L >= th - 1 && !rk);
}

// Kare üretimi planı. gameFG: oyunun kendi kare üretimi (ad) ya da null; driverFG: sürücü kare üretiminin adı ya da null.
function fgPlan(g, c, L, need, gameFG, driverFG) {
  const t = c.t;
  const rk = g.t === 'rek';
  const base = L <= 1 ? 'hi' : L === 2 ? 'mid' : 'lo';
  const on = t('eng.v.on'), off = t('eng.v.off');
  if (rk) return { use: null, c: 'off', v: off, why: t('eng.fg.rk') };
  if (gameFG && need) return { use: 'game', c: 'off', v: off, why: t('eng.fg.game', { fg: gameFG }) };
  if (gameFG && !need) return { use: null, c: 'off', v: off, why: t('eng.fg.gameOpt', { fg: gameFG }), optionalGame: true };
  if (!driverFG) return { use: null, c: 'off', v: t('eng.v.unsupported'), why: t('eng.fg.noDriver') };
  if (g.c60) return { use: 'driver', c: 'on', v: on, why: t('eng.fg.c60', { fg: driverFG }) };
  if (c.hz < 120) return { use: null, c: 'off', v: off, why: t('eng.fg.lowHz') };
  if (base === 'mid' || (c.goal === 'fps' && base === 'hi' && c.hz >= 165)) return { use: 'driver', c: 'on', v: on, why: t('eng.fg.mid', { hz: c.hz, fg: driverFG }) };
  if (base === 'lo') return { use: null, c: 'warn', v: t('eng.v.upFirst'), why: t('eng.fg.lo', { fg: driverFG }) };
  return { use: null, c: 'off', v: off, why: t('eng.fg.hi') };
}

// FPS sınırı planı (değer + gerekçe). driverFG açıksa temel FPS yarıya sınırlanır. limiter: sınırlayıcının adı (seçili dilde).
function capPlan(g, c, fg, limiter) {
  const t = c.t;
  const rk = g.t === 'rek';
  const full = c.hz - 3, half = Math.floor((c.hz - 3) / 2);
  if (rk) return { v: t('eng.v.unlimited'), c: 'off', cap: null, why: t('eng.cap.rk', { full }) };
  if (g.c60) return { v: t('eng.v.lock60'), c: 'off', cap: null, why: t('eng.cap.c60') };
  if (!c.vrr) return { v: t('eng.v.fpsVsync', { n: c.hz }), c: 'set', cap: c.hz, why: t('eng.cap.noVrr') };
  if (fg.use === 'driver') return { v: t('eng.v.fps', { n: half }), c: 'set', cap: half, why: t('eng.cap.fg', { half, double: half * 2, limiter }) };
  return { v: t('eng.v.fps', { n: full }), c: 'set', cap: full, why: t('eng.cap.full', { full, limiter }) };
}

// Sürücüdeki FPS sınırı öneriye uygun mu: hedefin (yenileme hızı − 3) en çok 4 altı da kabul edilir (144 Hz'de 137–141).
// Sınırın amacı yenileme hızının biraz altında kalmak; birkaç FPS'lik fark "değiştir" diye gösterilmez.
const capOk = (v, n) => !!(v && v.on && v.fps != null && v.fps <= n && v.fps >= n - 4);

module.exports = { FS, FSR_RANK, buildProfile, context, level, needUpscale, fgPlan, capPlan, capOk };
