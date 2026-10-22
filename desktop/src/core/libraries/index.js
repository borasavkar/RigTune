'use strict';
// Bütün kütüphane tarayıcılarını çalıştırır, aynı oyunun farklı kaynaklardaki kopyalarını birleştirir.
const path = require('path');
const { normLoose } = require('../util');
const { scanSteam } = require('./steam');
const { scanEpic, scanGog, scanUbisoft, scanXbox, scanUninstall, scanHeroic } = require('./stores');
const { scanPlaynite } = require('./playnite');
const { scanFolders } = require('./folders');

const SOURCES = {
  steam: 'Steam', epic: 'Epic Games', gog: 'GOG', ubisoft: 'Ubisoft Connect', xbox: 'Xbox / Microsoft Store', ea: 'EA app',
  battlenet: 'Battle.net', rockstar: 'Rockstar Games', riot: 'Riot Games', playnite: 'Playnite', folder: 'Klasör',
};
const PRIORITY = Object.keys(SOURCES);

async function scanLibraries(hints, sys, settings) {
  const errors = [];
  const safe = (name, fn) => { try { return fn() || []; } catch (e) { errors.push(`${name}: ${e.message}`); return []; } };
  const steam = await scanSteam(hints).catch(e => { errors.push('steam: ' + e.message); return { games: [], libraries: [] }; });
  const folders = safe('folder', () => scanFolders(hints, settings));
  const all = [
    ...steam.games,
    ...safe('epic', () => scanEpic(hints)),
    ...safe('gog', () => scanGog(hints)),
    ...safe('ubisoft', () => scanUbisoft(hints, sys)),
    ...safe('xbox', () => scanXbox(hints)),
    ...safe('launchers', () => scanUninstall(hints, sys)),
    ...safe('heroic', () => scanHeroic()),
    ...safe('playnite', () => scanPlaynite(hints, sys, settings)),
    ...(folders.games || []),
  ];
  const hidden = new Set((settings && settings.hidden) || []);

  all.sort((a, b) => PRIORITY.indexOf(a.source) - PRIORITY.indexOf(b.source));
  const byDir = new Map(), byName = new Map(), out = [];
  for (const g of all) {
    if (hidden.has(g.id)) continue;
    g.sourceName = SOURCES[g.source] || g.source;
    const dk = g.installDir ? path.normalize(g.installDir).toLowerCase().replace(/[\\/]+$/, '') : null;
    const nk = g.name ? normLoose(g.name) : null;
    const prev = (dk && byDir.get(dk)) || (nk && byName.get(nk));
    if (prev) {
      (prev.alsoIn = prev.alsoIn || []).push(g.source);
      if (!prev.installDir && g.installDir) { prev.installDir = g.installDir; prev.accessible = g.accessible; }
      if (!prev.image && g.image) prev.image = g.image;
      if (!prev.lastPlayed && g.lastPlayed) prev.lastPlayed = g.lastPlayed;
      continue;
    }
    if (dk) byDir.set(dk, g);
    if (nk) byName.set(nk, g);
    out.push(g);
  }
  out.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'tr'));
  return { games: out, steamLibraries: steam.libraries, autoFolders: folders.autoFolders || [], errors };
}

module.exports = { scanLibraries, SOURCES };
