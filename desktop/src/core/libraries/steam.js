'use strict';
// Steam: libraryfolders.vdf → her kütüphanedeki appmanifest_*.acf dosyaları.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exists, isDir, readText } = require('../util');

// Valve KeyValues (metin) çözücü. Anahtarlar küçük harfe çevrilir.
function parseVdf(text) {
  let i = 0;
  const n = text.length;
  const ws = c => c === ' ' || c === '\t' || c === '\r' || c === '\n';
  function skip() {
    for (;;) {
      while (i < n && ws(text[i])) i++;
      if (text[i] === '/' && text[i + 1] === '/') { while (i < n && text[i] !== '\n') i++; continue; }
      if (text[i] === '[') { while (i < n && text[i] !== ']') i++; i++; continue; } // [$WIN32] gibi koşullar
      break;
    }
  }
  function str() {
    if (text[i] === '"') {
      i++;
      let s = '';
      while (i < n && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < n) { const e = text[i + 1]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e; i += 2; }
        else s += text[i++];
      }
      i++;
      return s;
    }
    let s = '';
    while (i < n && !ws(text[i]) && text[i] !== '{' && text[i] !== '}' && text[i] !== '"') s += text[i++];
    return s;
  }
  function obj() {
    const o = {};
    for (;;) {
      skip();
      if (i >= n) return o;
      if (text[i] === '}') { i++; return o; }
      const k = str().toLowerCase();
      skip();
      if (text[i] === '{') { i++; o[k] = obj(); } else o[k] = str();
    }
  }
  return obj();
}

const TOOL_IDS = new Set(['228980', '250820', '1070560', '1391110', '1628350', '1493710', '1826330', '2180100', '2348590', '2805730', '1161040', '1887720', '3658110']);
const TOOL_NAME = /^(Proton\b|Steam Linux Runtime|Steamworks Common|SteamVR|Steam Audio|Steamworks SDK)|Dedicated Server$|Soundtrack$|\bOST$/i;

function steamRoots(hints) {
  const home = os.homedir();
  const c = [];
  if (hints && hints.steamPath) c.push(path.normalize(hints.steamPath));
  if (process.platform === 'win32') c.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam');
  else if (process.platform === 'darwin') c.push(path.join(home, 'Library/Application Support/Steam'));
  else c.push(path.join(home, '.steam/steam'), path.join(home, '.local/share/Steam'), path.join(home, '.var/app/com.valvesoftware.Steam/.local/share/Steam'), path.join(home, 'snap/steam/common/.local/share/Steam'));
  const seen = new Set();
  return c.filter(p => { const k = p.toLowerCase(); if (seen.has(k) || !isDir(path.join(p, 'steamapps'))) return false; seen.add(k); return true; });
}

function findImage(root, appid) {
  const lc = path.join(root, 'appcache', 'librarycache');
  const direct = [path.join(lc, `${appid}_header.jpg`), path.join(lc, String(appid), 'header.jpg'), path.join(lc, `${appid}_library_600x900.jpg`), path.join(lc, String(appid), 'library_600x900.jpg')];
  for (const f of direct) if (exists(f)) return f;
  // 2024 sonrası düzen: librarycache/<appid>/<karma>/header.jpg
  try {
    for (const d of fs.readdirSync(path.join(lc, String(appid)), { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      for (const nm of ['header.jpg', 'library_600x900.jpg']) { const f = path.join(lc, String(appid), d.name, nm); if (exists(f)) return f; }
    }
  } catch { /* klasör yok */ }
  return null;
}

async function scanSteam(hints) {
  const games = [], libraries = [], notes = [];
  for (const root of steamRoots(hints)) {
    const vdfText = readText(path.join(root, 'steamapps', 'libraryfolders.vdf')) || readText(path.join(root, 'config', 'libraryfolders.vdf'));
    const lf = vdfText ? (parseVdf(vdfText).libraryfolders || {}) : {};
    const libs = Object.values(lf).filter(v => v && typeof v === 'object' && v.path).map(v => ({ path: path.normalize(v.path), apps: Object.keys(v.apps || {}) }));
    if (!libs.some(l => l.path.toLowerCase() === root.toLowerCase())) libs.unshift({ path: root, apps: [] });
    for (const lib of libs) {
      const sa = path.join(lib.path, 'steamapps');
      const online = isDir(sa);
      libraries.push({ path: lib.path, online, apps: lib.apps.length });
      if (!online) {
        // Sürücü takılı değil: Steam'in kaydındaki uygulama numaralarını erişilemez olarak listele.
        for (const appid of lib.apps) {
          if (TOOL_IDS.has(appid)) continue;
          games.push({ id: `steam:${appid}`, source: 'steam', appid, name: null, installDir: null, accessible: false, library: lib.path, image: findImage(root, appid) });
        }
        continue;
      }
      let files = [];
      try { files = fs.readdirSync(sa).filter(f => /^appmanifest_\d+\.acf$/i.test(f)); } catch { notes.push(`${sa} okunamadı`); }
      for (const f of files) {
        const t = readText(path.join(sa, f));
        if (!t) continue;
        const st = parseVdf(t).appstate;
        if (!st || !st.appid) continue;
        if (TOOL_IDS.has(st.appid) || TOOL_NAME.test(st.name || '')) continue;
        const flags = +st.stateflags || 0;
        const dir = path.join(sa, 'common', st.installdir || '');
        games.push({
          id: `steam:${st.appid}`, source: 'steam', appid: st.appid, name: st.name, installDir: dir,
          accessible: isDir(dir), installed: !!(flags & 4), updating: !!(flags & 2 && !(flags & 4)),
          lastPlayed: (+st.lastplayed || 0) * 1000 || null, buildId: st.buildid || null, sizeBytes: +st.sizeondisk || null,
          library: lib.path, image: findImage(root, st.appid),
        });
      }
    }
  }
  return { games, libraries, notes };
}

module.exports = { scanSteam, parseVdf };
