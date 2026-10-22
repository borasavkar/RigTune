'use strict';
// Playnite kütüphanesi.
// 1) Tercih edilen yol: integrations/playnite eklentisinin yazdığı %APPDATA%\RigTune\playnite-games.json.
//    Playnite açıkken library/games.db dosyasını kilitlediği için güvenilir yol budur. Eklentinin eski sürümü dosyayı
//    uygulamanın eski adındaki klasöre (%APPDATA%\Oyun Ayar Rehberi) yazar; ikisi de varsa daha yeni olan okunur.
// 2) Yedek yol (deneysel): Playnite kapalıyken library/games.db (LiteDB) içindeki BSON belgelerini arar;
//    tek sayfaya sığan oyun kayıtlarını okur.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exists, isDir, readJson, APP_DIR, LEGACY_DIR } = require('../util');

function exportFile(hints) {
  const appData = (hints && hints.appData) || process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const mtime = p => { try { return fs.statSync(p).mtimeMs; } catch { return -1; } };
  const [now, old] = [APP_DIR, LEGACY_DIR].map(d => path.join(appData, d, 'playnite-games.json'));
  return mtime(old) > mtime(now) ? old : now;
}

function readDoc(b, p) {
  if (p < 0 || p + 5 > b.length) return null;
  const len = b.readInt32LE(p);
  if (len < 5 || len > (1 << 20) || p + len > b.length || b[p + len - 1] !== 0) return null;
  const o = {};
  const stop = p + len - 1;
  let i = p + 4;
  try {
    while (i < stop) {
      const t = b[i++];
      const k0 = i;
      while (i < stop && b[i] !== 0) i++;
      if (i >= stop) return null;
      const key = b.toString('utf8', k0, i);
      i++;
      switch (t) {
        case 0x01: o[key] = b.readDoubleLE(i); i += 8; break;
        case 0x02: { const l = b.readInt32LE(i); if (l < 1 || i + 4 + l > stop + 1) return null; o[key] = b.toString('utf8', i + 4, i + 3 + l); i += 4 + l; break; }
        case 0x03: case 0x04: { const sub = readDoc(b, i); if (!sub) return null; o[key] = sub.obj; i += sub.len; break; }
        case 0x05: { const l = b.readInt32LE(i); if (l < 0) return null; i += 5 + l; break; }
        case 0x07: i += 12; break;
        case 0x08: o[key] = b[i] === 1; i += 1; break;
        case 0x09: case 0x11: case 0x12: i += 8; break;
        case 0x0a: o[key] = null; break;
        case 0x10: o[key] = b.readInt32LE(i); i += 4; break;
        case 0x13: i += 16; break;
        default: return null;
      }
    }
  } catch { return null; }
  return i === stop ? { obj: o, len } : null;
}

function parseGamesDb(file) {
  const b = fs.readFileSync(file);
  const marker = Buffer.from('\x02InstallDirectory\x00', 'latin1');
  const found = new Map();
  let at = b.indexOf(marker);
  while (at >= 0) {
    for (let p = at - 5; p >= Math.max(0, at - 16384); p--) {
      const d = readDoc(b, p);
      if (d && p + d.len > at && d.obj.Name && 'InstallDirectory' in d.obj) {
        if (d.obj.IsInstalled && d.obj.InstallDirectory) found.set(d.obj.Name + '|' + d.obj.InstallDirectory, d.obj);
        break;
      }
    }
    at = b.indexOf(marker, at + marker.length);
  }
  return [...found.values()];
}

function candidates(hints, sys, settings) {
  const c = [];
  if (settings && settings.playniteDir) c.push(settings.playniteDir);
  if (hints && hints.appData) c.push(path.join(hints.appData, 'Playnite'));
  for (const u of (sys && (sys._uninstall || sys.uninstall)) || []) if (/^Playnite/i.test(u.n || '') && u.loc) c.push(u.loc);
  return [...new Set(c)].map(d => path.join(d, 'library', 'games.db')).filter(exists);
}

function scanPlaynite(hints, sys, settings) {
  const exp = readJson(exportFile(hints));
  if (exp && Array.isArray(exp.games)) {
    return exp.games.filter(g => g && g.name && g.installDir && !g.hidden).map(g => ({
      id: `playnite:${g.id}`, source: 'playnite', name: g.name, installDir: g.installDir, accessible: isDir(g.installDir),
      lastPlayed: g.lastActivity || null, playniteSource: g.source || null,
    }));
  }
  const games = [];
  for (const db of candidates(hints, sys, settings)) {
    let docs = [];
    try { docs = parseGamesDb(db); } catch { continue; } // Playnite açıksa dosya kilitlidir (EBUSY)
    for (const g of docs) {
      // Playnite yolları {PlayniteDir} gibi değişkenler içerebilir.
      const dir = String(g.InstallDirectory).replace(/\{PlayniteDir\}/gi, path.dirname(path.dirname(db)));
      games.push({ id: `playnite:${g.GameId || g.Name}`, source: 'playnite', name: g.Name, installDir: dir, accessible: isDir(dir), lastPlayed: null });
    }
  }
  return games;
}

module.exports = { scanPlaynite, parseGamesDb, exportFile };
