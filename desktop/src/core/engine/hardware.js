'use strict';
// İşlemci, bellek ve disk: oyun notları, oyun etiketleri ve sistem kontrolleri.
// Eşiklerin kaynağı:
//  - Boş alan: Windows Gezgini "Bu bilgisayar" görünümünde sürücü çubuğunu boş alan %10'un altına inince kırmızı gösterir; aynı sınır kullanılır.
//  - Bellek: oyunun Steam sayfasındaki en düşük ve önerilen sistem gereksinimi (steamstore.js). Bilinmiyorsa karşılaştırma yapılmaz.
//  - HDD notu: oyunun GPU yükü 3 ve üstü (gamedb y), açık dünya (gamedb ow), Unreal Engine 5 ya da Steam gereksinimi SSD istiyor.
//  - Rekabetçi oyunda işlemci notu: ekran kartı rahat (yük seviyesi 0–1) ve monitör 120 Hz ve üstü (fgPlan'daki yüksek yenileme sınırı).
const LOW_FREE = 0.10;
const GB = 2 ** 30;

// Oyun klasörünün bulunduğu birim: en uzun eşleşen bağlama noktası (Windows'ta sürücü harfi).
function volumeOf(dir, storage) {
  if (!dir || !storage || !storage.volumes) return null;
  const win = /^[A-Za-z]:/.test(dir);
  const sep = win ? '\\' : '/';
  const key = s => { s = win ? s.toUpperCase().replace(/\//g, '\\') : s; return s.endsWith(sep) ? s : s + sep; };
  const d = key(dir);
  let best = null;
  for (const v of storage.volumes) {
    const m = key(v.mount);
    if (d.startsWith(m) && (!best || m.length > key(best.mount).length)) best = v;
  }
  return best;
}
const driveName = v => (v.letter ? v.letter + ':' : v.mount);

// İşlemciye bağlı oyun: veritabanında cpu: 1, ya da strateji/hafif tür (haf), Paradox (Clausewitz/Jomini) ve TaleWorlds motoru.
// Veritabanındaki cpu: 0 oyunu dışarıda tutar.
function cpuBound(g) {
  if (g.cpu != null) return !!g.cpu;
  return g.t === 'haf' || /Jomini|Clausewitz|TaleWorlds/i.test(g.eng || '');
}

// Oyun için donanım notları ve etiketleri. notes: oyunun kendi notları (tekrarı önlemek için).
function gameHardware(g, c, L, need, notes) {
  const t = c.t, sys = c.sys || {};
  const out = { notes: [], tags: [], disk: null, hdd: false };
  const cpu = sys.cpu && (sys.cpu.short || sys.cpu.name);
  const ue5 = /Unreal Engine 5/.test(g.eng || '');

  // İşlemci
  if (cpuBound(g)) {
    out.tags.push({ t: t('eng.tags.cpu'), k: '' });
    if (!need && cpu) out.notes.push(t(/işlemci|processor|\bCPU\b/i.test(notes.join(' ')) ? 'eng.notes.cpuShort' : 'eng.notes.cpu', { cpu }));
  } else if (g.t === 'rek' && L <= 1 && c.hz >= 120 && cpu) out.notes.push(t('eng.notes.cpuRk', { cpu }));

  // Bellek: Steam gereksinimiyle karşılaştırma
  const have = sys.ram && sys.ram.totalGB, req = g.req || {};
  if (have && req.ramMin && have < req.ramMin) out.notes.push(t('eng.notes.ramMin', { have, need: req.ramMin }));
  else if (have && req.ramRec && have < req.ramRec) out.notes.push(t('eng.notes.ramRec', { have, need: req.ramRec }));

  // Disk
  const v = volumeOf(g.dir, sys.storage);
  if (v) {
    out.disk = { mount: v.mount, letter: v.letter, kind: v.kind };
    const why = req.ssd || (ue5 ? 'ue5' : g.ow ? 'ow' : g.y >= 3 ? 'heavy' : null);
    out.hdd = v.kind === 'hdd' && !!why;
    if (out.hdd) out.notes.push(t('eng.notes.hdd.base', { drive: driveName(v) }) + t('eng.notes.hdd.' + why) + t('eng.notes.hdd.move'));
    if (v.kind) out.tags.push({ t: t('eng.tags.disk', { drive: driveName(v), kind: t('eng.disk.' + v.kind) }), k: out.hdd ? 'w' : '' });
  }
  return out;
}

const pct = v => Math.round((v.free / v.size) * 100);
const listOf = (names, t) => (names.length > 4 ? t('changes.more', { list: names.slice(0, 4).join(', '), n: names.length - 4 }) : names.join(', '));

// Disk kontrolleri (Özet ve Genel). games: arayüze giden oyun listesi (installDir ve rec.hdd ile).
function diskChecks(sys, c, games, add) {
  const t = c.t, st = sys.storage;
  if (!st || !st.volumes || !st.volumes.length) return;
  const low = v => v.size > 0 && v.free / v.size < LOW_FREE;
  const byVol = new Map();
  for (const g of games || []) {
    if (g.catalog || !g.installDir) continue;
    const v = volumeOf(g.installDir, st);
    if (v) byVol.set(v, [...(byVol.get(v) || []), g.name]);
  }
  const sysVol = st.volumes.find(v => v.system);
  if (sysVol) {
    const p = { drive: driveName(sysVol), pct: pct(sysVol), free: Math.round(sysVol.free / GB) };
    if (low(sysVol)) add('warn', t('checks.sysDiskLow', p), t('checks.sysDiskLowWhy'), 'disk');
    else add('ok', t('checks.sysDiskOk', p), '', 'disk');
  }
  for (const [v, names] of byVol) {
    if (v.system || !low(v)) continue;
    add('warn', t('checks.gameDiskLow', { drive: driveName(v), pct: pct(v), free: Math.round(v.free / GB) }), t('checks.gameDiskLowWhy', { n: names.length, list: listOf(names, t) }), 'disk');
  }
  const hdd = (games || []).filter(g => !g.catalog && g.rec && g.rec.hdd).map(g => g.name);
  if (hdd.length) add('info', t('checks.hddGames', { n: hdd.length }), t('checks.hddGamesWhy', { list: listOf(hdd, t) }), 'disk');
}

module.exports = { volumeOf, cpuBound, gameHardware, diskChecks, LOW_FREE };
