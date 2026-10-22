'use strict';
// Başlatıcıya bağlı olmayan oyunlar: kullanıcının eklediği klasörler ve sürücü kökündeki "Games" gibi klasörler.
const fs = require('fs');
const path = require('path');
const { exists, isDir, readText, readJson } = require('../util');
const { readGameConfig } = require('./stores');

const SKIP_EXE = /^(unins\d*|setup|install(er)?|vc_?redist.*|dxsetup|dxwebsetup|crashreport.*|crashreportclient|unitycrashhandler(32|64)?|ue[45]prereqsetup.*|uninstall.*|crashpad_handler|easyanticheat.*|be(service|launcher).*(_x64)?|quicksfv|language\.changer|notification_helper|gamingrepair|.*(redist|helper|updater|patcher|reporter|launcherhelper)\w*)\.exe$/i;
const SKIP_DIR = /^(_commonredist|redist|redistributables?|__installer|directx|vcredist|support|_redist|installers?|prereq(uisites)?|easyanticheat|battleye|gamingrepair)$/i;

// Önce klasörün kendi dosyaları, sonra alt klasörler: büyük doku/gölgelendirici klasörleri (ör. King Arthur: Legion IX'teki
// BinaryShaders) tarama bütçesini bitirmeden ana dizindeki exe bulunur (22 Ekim 2026'da bu yüzden kaçırılan oyun vardı).
function findExes(dir, depth, acc = [], budget = { n: 4000 }) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    if (--budget.n <= 0) return acc;
    if (e.isFile() && /\.exe$/i.test(e.name) && !SKIP_EXE.test(e.name)) {
      const p = path.join(dir, e.name);
      let size = 0; try { size = fs.statSync(p).size; } catch { /* yok */ }
      acc.push({ path: p, size, depth });
    }
  }
  if (depth > 0) {
    for (const e of ents) {
      if (budget.n <= 0) break;
      if (e.isDirectory() && !SKIP_DIR.test(e.name)) findExes(path.join(dir, e.name), depth - 1, acc, budget);
    }
  }
  return acc;
}

function describeFolder(dir) {
  const exes = findExes(dir, 3);
  if (!exes.length) return null;
  // Ana çalıştırılabilir: en sığ derinlikteki en büyük dosya; Unreal oyunlarında *-Shipping.exe öne alınır.
  exes.sort((a, b) => (/-shipping\.exe$/i.test(b.path) - /-shipping\.exe$/i.test(a.path)) || (b.depth - a.depth) || (b.size - a.size));
  const g = { name: path.basename(dir), exe: exes[0].path };
  const cfg = ['MicrosoftGame.config', 'MicrosoftGame.Config'].map(f => path.join(dir, f)).find(exists);
  if (cfg) { const c = readGameConfig(cfg); if (c && c.name) g.name = c.name; }
  try {
    const info = fs.readdirSync(dir).find(f => /^goggame-\d+\.info$/i.test(f));
    if (info) { const j = readJson(path.join(dir, info)); if (j && j.name) { g.name = j.name; g.gogId = j.gameId; } }
  } catch { /* yok */ }
  const appid = readText(path.join(dir, 'steam_appid.txt'));
  if (appid && /^\d+$/.test(appid.trim())) g.appid = appid.trim();
  return g;
}

// Bir klasör ya doğrudan oyundur (içinde çalıştırılabilir var) ya da oyun klasörlerinin üst klasörüdür.
function scanFolder(root) {
  const games = [];
  if (!isDir(root)) return games;
  let top = [];
  try { top = fs.readdirSync(root, { withFileTypes: true }); } catch { return games; }
  const directExe = top.some(e => e.isFile() && /\.exe$/i.test(e.name) && !SKIP_EXE.test(e.name));
  const markers = top.some(e => /^(MicrosoftGame\.config|steam_appid\.txt|goggame-\d+\.info)$/i.test(e.name) || (e.isDirectory() && /^(Engine|Binaries)$/i.test(e.name)));
  if (directExe || markers) {
    const d = describeFolder(root);
    if (d) games.push({ ...d, installDir: root });
    return games;
  }
  for (const e of top) {
    if (!e.isDirectory() || SKIP_DIR.test(e.name) || e.name.startsWith('.') || e.name.startsWith('$')) continue;
    const dir = path.join(root, e.name);
    const d = describeFolder(dir);
    if (d) games.push({ ...d, installDir: dir });
  }
  return games;
}

function autoFolders(hints) {
  const out = [];
  for (const d of (hints && hints.drives) || []) for (const n of ['Games', 'Oyunlar', 'GOG Games']) {
    const p = path.join(d.root, n);
    if (isDir(p)) out.push(p);
  }
  return out;
}

function scanFolders(hints, settings) {
  const user = ((settings && settings.folders) || []).filter(Boolean);
  const auto = settings && settings.autoFolders === false ? [] : autoFolders(hints);
  const games = [];
  const seen = new Set();
  for (const root of [...user, ...auto]) {
    for (const g of scanFolder(root)) {
      const key = g.installDir.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      games.push({ id: `folder:${key}`, source: 'folder', name: g.name, installDir: g.installDir, exe: g.exe, appid: g.appid || null, accessible: true, folderRoot: root, auto: !user.includes(root) });
    }
  }
  return { games, autoFolders: auto };
}

module.exports = { scanFolders, scanFolder, findExes };
