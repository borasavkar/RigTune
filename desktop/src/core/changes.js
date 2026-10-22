'use strict';
// Sistem parmak izi ve iki tarama arasındaki farklar (donanım, sürücü, yazılım, monitör, oyunlar).
const { LOCALES } = require('../locales');

function fingerprint(sys, lib) {
  const apps = {};
  for (const k of ['amd', 'nvidiaApp', 'geforceExperience', 'nvidiaDriver', 'intelSoftware', 'intelArcControl', 'intelDriver', 'rtss']) {
    const a = sys.apps && sys.apps[k];
    if (a) apps[a.name] = a.version || '';
  }
  return {
    os: [sys.os.name, sys.os.displayVersion, sys.os.build ? `${sys.os.build}${sys.os.ubr ? '.' + sys.os.ubr : ''}` : sys.os.version].filter(Boolean).join(' '),
    cpu: sys.cpu && sys.cpu.name,
    ram: sys.ram ? `${sys.ram.totalGB} GB${sys.ram.configured ? ' · ' + sys.ram.configured + ' MT/s' : ''}` : null,
    gpus: Object.fromEntries(sys.gpus.filter(g => !g.virtual).map(g => [g.id, { name: g.name, driver: (g.driver && (g.driver.display || g.driver.version)) || '' }])),
    displays: Object.fromEntries(sys.displays.map(d => [d.id, { name: d.name, mode: `${d.current.w}×${d.current.h} @ ${Math.round(d.current.hz)} Hz`, hdr: !!(d.hdr && d.hdr.enabled) }])),
    apps,
    win: sys.winSettings ? { hags: sys.winSettings.hags, gameMode: sys.winSettings.gameMode, windowed: sys.winSettings.windowedOptimizations } : null,
    games: Object.fromEntries(lib.games.map(g => [g.id, { name: g.name || g.id, ver: g.buildId || g.version || '', ok: !!g.accessible }])),
  };
}

// Farklar anahtar + değer olarak saklanır (changes.json); metin gösterilirken seçili dilde üretilir.
// Eski sürümün kayıtlarında yalnızca Türkçe "text" alanı vardır; onlar olduğu gibi gösterilir.
// Yeni kayıtlarda da kayıt anındaki dilde "text" tutulur ki uygulamanın eski sürümü geçmişi okuyabilsin.
const WIN_KEYS = ['hags', 'gameMode', 'windowed'];

function diff(a, b) {
  const out = [];
  const add = (type, key, p, rescan) => out.push({ type, key, p, rescan: !!rescan });
  if (!a || !b) return out;
  if (a.os !== b.os) add('software', 'os', { a: a.os, b: b.os });
  if (a.cpu !== b.cpu) add('hardware', 'cpu', { a: a.cpu, b: b.cpu });
  if (a.ram !== b.ram) add('hardware', 'ram', { a: a.ram, b: b.ram });
  for (const [id, g] of Object.entries(b.gpus)) {
    const p = a.gpus[id];
    if (!p) add('hardware', 'gpuNew', { name: g.name });
    else if (p.driver !== g.driver) add('driver', 'gpuDriver', { name: g.name, a: p.driver, b: g.driver });
  }
  for (const [id, g] of Object.entries(a.gpus)) if (!b.gpus[id]) add('hardware', 'gpuRemoved', { name: g.name });
  for (const [id, d] of Object.entries(b.displays)) {
    const p = a.displays[id];
    if (!p) add('display', 'dispNew', { name: d.name, mode: d.mode });
    else {
      if (p.mode !== d.mode) add('display', 'dispMode', { name: d.name, a: p.mode, b: d.mode });
      if (p.hdr !== d.hdr) add('display', d.hdr ? 'dispHdrOn' : 'dispHdrOff', { name: d.name });
    }
  }
  for (const [id, d] of Object.entries(a.displays)) if (!b.displays[id]) add('display', 'dispRemoved', { name: d.name });
  for (const [n, v] of Object.entries(b.apps)) {
    if (!(n in a.apps)) add('software', v ? 'appNewVer' : 'appNew', { name: n, v });
    else if (a.apps[n] !== v) add('software', 'appVer', { name: n, a: a.apps[n] || '?', b: v || '?' });
  }
  for (const n of Object.keys(a.apps)) if (!(n in b.apps)) add('software', 'appRemoved', { name: n });
  if (a.win && b.win) for (const k of WIN_KEYS) if (a.win[k] !== b.win[k]) add('settings', 'win', { k, a: a.win[k], b: b.win[k] });
  const added = [], removed = [], updated = [];
  for (const [id, g] of Object.entries(b.games)) {
    const p = a.games[id];
    if (!p) added.push(g.name);
    else if (p.ver && g.ver && p.ver !== g.ver) updated.push(g.name);
  }
  for (const [id, g] of Object.entries(a.games)) if (!b.games[id]) removed.push(g.name);
  if (added.length) add('game', 'gamesNew', { list: added });
  if (removed.length) add('game', 'gamesRemoved', { list: removed });
  if (updated.length) add('game', 'gamesUpdated', { list: updated });
  return out;
}

// Bir değişiklik kaydının seçili dildeki metni. t: locales/translator(dil).
function changeText(item, t) {
  if (!item.key) {
    // Eski kayıt: değişken içermeyen "İlk analiz yapıldı." çevrilebilir; diğerleri olduğu gibi gösterilir.
    if (item.text === LOCALES.tr.changes.first) return t('changes.first');
    return item.text || '';
  }
  const p = { ...(item.p || {}) };
  if (item.key === 'win') {
    const oo = v => t('changes.onOff.' + (v === true ? 'on' : v === false ? 'off' : 'unknown'));
    Object.assign(p, { name: t('changes.winNames.' + p.k), a: oo(p.a), b: oo(p.b) });
  }
  if (Array.isArray(p.list)) {
    const arr = p.list;
    p.list = arr.length > 4 ? t('changes.more', { list: arr.slice(0, 4).join(', '), n: arr.length - 4 }) : arr.join(', ');
  }
  return t('changes.' + item.key, p);
}

module.exports = { fingerprint, diff, changeText };
