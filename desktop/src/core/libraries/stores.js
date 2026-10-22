'use strict';
// Epic, GOG, Ubisoft, Xbox (Microsoft Store/Game Pass), EA, Battle.net, Rockstar, Riot, Heroic/Legendary.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exists, isDir, readText, readJson } = require('../util');

const xmlAttr = (xml, tag, attr) => { const m = new RegExp(`<${tag}\\b[^>]*\\b${attr}="([^"]*)"`, 'i').exec(xml); return m ? decodeXml(m[1]) : null; };
const decodeXml = s => s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// ---------- Epic ----------
function scanEpic(hints) {
  const games = [];
  const dirs = [];
  if (process.platform === 'win32') {
    const base = (hints && hints.epicAppData) || path.join((hints && hints.programData) || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data');
    dirs.push(path.join(base, 'Manifests'));
  } else if (process.platform === 'darwin') dirs.push(path.join(os.homedir(), 'Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests'));
  for (const d of dirs) {
    let files = [];
    try { files = fs.readdirSync(d).filter(f => f.toLowerCase().endsWith('.item')); } catch { continue; }
    for (const f of files) {
      const j = readJson(path.join(d, f));
      if (!j || j.bIsIncompleteInstall) continue;
      const cats = (j.AppCategories || []).map(String);
      if (cats.length && !cats.includes('games')) continue;
      if (j.MainGameAppName && j.AppName && j.MainGameAppName !== j.AppName) continue; // DLC
      const dir = j.InstallLocation ? path.normalize(j.InstallLocation) : null;
      games.push({ id: `epic:${j.AppName || j.CatalogItemId}`, source: 'epic', name: j.DisplayName, installDir: dir, accessible: !!dir && isDir(dir), version: j.AppVersionString || null, exe: j.LaunchExecutable ? path.join(dir || '', j.LaunchExecutable) : null });
    }
  }
  return games;
}

// ---------- GOG ----------
function scanGog(hints) {
  return ((hints && hints.gog) || []).filter(g => g.path && !g.dependsOn).map(g => ({
    id: `gog:${g.id}`, source: 'gog', name: g.name, installDir: path.normalize(g.path), accessible: isDir(g.path), exe: g.exe || null,
  }));
}

// ---------- Ubisoft ----------
function scanUbisoft(hints, sys) {
  const games = [];
  const seen = new Set();
  const names = {};
  for (const u of (sys && (sys._uninstall || sys.uninstall)) || []) { const m = /^Uplay Install (\d+)$/i.exec(u.key || ''); if (m) names[m[1]] = u.n; }
  for (const u of (hints && hints.ubisoft) || []) {
    if (!u.dir) continue;
    const dir = path.normalize(u.dir);
    seen.add(dir.toLowerCase());
    games.push({ id: `ubisoft:${u.id}`, source: 'ubisoft', name: names[u.id] || path.basename(dir), installDir: dir, accessible: isDir(dir) });
  }
  // Kayıt defterinde olmayan ama Ubisoft oyun klasöründe duran oyunlar
  const folders = new Set();
  const local = (hints && hints.localAppData) || (process.env.LOCALAPPDATA || '');
  const yaml = readText(path.join(local, 'Ubisoft Game Launcher', 'settings.yaml'));
  const m = yaml && /game_installation_path:\s*(.+)/.exec(yaml);
  if (m) folders.add(path.normalize(m[1].trim().replace(/^["']|["']$/g, '')));
  if (hints && hints.ubisoftLauncher) folders.add(path.join(hints.ubisoftLauncher, 'games'));
  for (const d of (hints && hints.drives) || []) {
    folders.add(path.join(d.root, 'Ubisoft', 'Ubisoft Game Launcher', 'games'));
    folders.add(path.join(d.root, 'Program Files (x86)', 'Ubisoft', 'Ubisoft Game Launcher', 'games'));
  }
  for (const f of folders) {
    let subs = [];
    try { subs = fs.readdirSync(f, { withFileTypes: true }).filter(x => x.isDirectory()); } catch { continue; }
    for (const s of subs) {
      const dir = path.join(f, s.name);
      if (seen.has(dir.toLowerCase())) continue;
      seen.add(dir.toLowerCase());
      // Kaldırılmış oyunlardan kalan boş klasörler atlanır.
      if (!require('./folders').findExes(dir, 2).length) continue;
      games.push({ id: `ubisoft:dir:${s.name.toLowerCase()}`, source: 'ubisoft', name: s.name, installDir: dir, accessible: true });
    }
  }
  return games;
}

// ---------- Xbox / Microsoft Store (GDK) ----------
function readGameConfig(cfgPath) {
  const xml = readText(cfgPath);
  if (!xml) return null;
  const hasExe = /<Executable\b/i.test(xml);
  // Ana oyunlar da TargetDeviceFamilyForDLC içerebilir; ek içeriği ayıran şey çalıştırılabilir dosyanın olmamasıdır.
  const dlc = !hasExe && /<TargetDeviceFamilyForDLC>|<MainPackageDependency\b/i.test(xml);
  let name = xmlAttr(xml, 'ShellVisuals', 'DefaultDisplayName');
  if (name && /^ms-resource:/i.test(name)) name = null;
  return { identity: xmlAttr(xml, 'Identity', 'Name'), name, hasExe, dlc, logo: xmlAttr(xml, 'ShellVisuals', 'Square150x150Logo') || xmlAttr(xml, 'ShellVisuals', 'StoreLogo'), version: xmlAttr(xml, 'Identity', 'Version') };
}

function scanXbox(hints) {
  const byId = new Map();
  const add = (cfgPath, dir, extra) => {
    const c = readGameConfig(cfgPath);
    if (!c || !c.hasExe || c.dlc) return;
    const key = (c.identity || dir).toLowerCase();
    const prev = byId.get(key);
    // XboxGames klasöründeki kopya okunabilir olduğu için WindowsApps yoluna tercih edilir.
    if (prev && !extra.preferred) return;
    const logo = c.logo ? path.join(dir, c.logo) : null;
    byId.set(key, { id: `xbox:${c.identity || path.basename(dir)}`, source: 'xbox', name: c.name || (extra.fallbackName || c.identity), installDir: dir, accessible: isDir(dir), version: c.version, image: logo && exists(logo) ? logo : null });
  };
  for (const p of (hints && hints.xbox) || []) add(p.cfg, p.loc, { fallbackName: p.name });
  for (const d of (hints && hints.drives) || []) {
    const root = path.join(d.root, d.gamingRoot || 'XboxGames');
    let subs = [];
    try { subs = fs.readdirSync(root, { withFileTypes: true }).filter(x => x.isDirectory()); } catch { continue; }
    for (const s of subs) {
      const content = path.join(root, s.name, 'Content');
      const cfg = path.join(content, 'MicrosoftGame.config');
      if (exists(cfg)) add(cfg, content, { preferred: true, fallbackName: s.name });
    }
  }
  return [...byId.values()];
}

// ---------- Kaldırma kayıtlarından başlatıcı oyunları ----------
function scanUninstall(hints, sys) {
  const games = [];
  // detect/index.js listeyi _uninstall alanında verir; ham PowerShell çıktısında alan adı uninstall'dır.
  const un = (sys && (sys._uninstall || sys.uninstall)) || [];
  for (const u of un) {
    const s = u.un || '', n = u.n || '';
    let source = null;
    if (/Battle\.net/i.test(s) && !/^Battle\.net$/i.test(n)) source = 'battlenet';
    else if (/RiotClientServices/i.test(s) && !/^Riot Client$/i.test(n)) source = 'riot';
    else if (/Rockstar Games/i.test(u.p || '') && !/Launcher|SDK|Social Club/i.test(n)) source = 'rockstar';
    else if (/EAInstaller|EA Desktop|\\__Installer\\|Touchup\.exe/i.test(s) || (/Electronic Arts/i.test(u.p || '') && !/^EA( app)?$/i.test(n))) source = 'ea';
    if (!source) continue;
    const dir = u.loc ? path.normalize(u.loc) : null;
    games.push({ id: `${source}:${u.key || n}`, source, name: n, installDir: dir, accessible: !!dir && isDir(dir), version: u.v || null });
  }
  for (const e of (hints && hints.ea) || []) {
    const dir = path.normalize(e.dir);
    if (games.some(g => g.installDir && g.installDir.toLowerCase() === dir.toLowerCase())) continue;
    games.push({ id: `ea:${e.name}`, source: 'ea', name: e.display || e.name, installDir: dir, accessible: isDir(dir) });
  }
  return games;
}

// ---------- Linux / macOS: Heroic ve Legendary ----------
function scanHeroic() {
  if (process.platform === 'win32') return [];
  const home = os.homedir();
  const games = [];
  const cfg = process.platform === 'darwin' ? path.join(home, 'Library/Application Support') : path.join(home, '.config');
  for (const f of [path.join(cfg, 'legendary/installed.json'), path.join(cfg, 'heroic/legendaryConfig/legendary/installed.json')]) {
    const j = readJson(f);
    if (!j) continue;
    for (const [k, v] of Object.entries(j)) {
      if (!v || v.is_dlc) continue;
      games.push({ id: `epic:${k}`, source: 'epic', name: v.title || k, installDir: v.install_path, accessible: isDir(v.install_path || '') });
    }
  }
  const gog = readJson(path.join(cfg, 'heroic/gog_store/installed.json'));
  for (const v of (gog && gog.installed) || []) {
    if (!v.install_path) continue;
    games.push({ id: `gog:${v.appName}`, source: 'gog', name: path.basename(v.install_path), installDir: v.install_path, accessible: isDir(v.install_path) });
  }
  return games;
}

module.exports = { scanEpic, scanGog, scanUbisoft, scanXbox, scanUninstall, scanHeroic, readGameConfig };
