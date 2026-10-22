'use strict';
// Çekirdek: tarama, önbellek, değişiklik geçmişi ve arayüze giden durum.
const { EventEmitter } = require('events');
const { Store } = require('./util');
const { detectSystem, pickPrimary, readAmdSettings } = require('./detect');
const { scanLibraries, SOURCES } = require('./libraries');
const { probeAll } = require('./probe');
const gamedb = require('./gamedb');
const engine = require('./engine');
const { fingerprint, diff, changeText } = require('./changes');
const steamstore = require('./steamstore');
const { LOCALES, LANGS, resolveLang, translator } = require('../locales');

const DEFAULTS = {
  lang: 'system', goal: 'denge', gpuId: null, displayId: null, folders: [], autoFolders: true, hidden: [], overrides: {},
  online: true, watch: true, intervalMin: 15, openAtLogin: false, startHidden: false, closeToTray: true, playniteDir: null,
};

const CONN = ['eDP', 'UDI', 'wireless', 'internal'];
function archLabel(g, t) {
  if (!g.arch) return t('detect.unknownArch');
  return g.vendor === 'intel' && g.features && g.features.igpu ? `${g.arch} ${t('detect.integrated')}` : g.arch;
}
// Geçmişteki tarama nedeni: yeni kayıtlarda anahtar (manual …), eski kayıtlarda Türkçe metin ('elle' …).
const LEGACY_REASONS = Object.fromEntries(Object.entries(LOCALES.tr.reasons).map(([k, v]) => [v, k]));
function reasonText(r, t) {
  if (!r) return '';
  const k = LOCALES.tr.reasons[r] ? r : LEGACY_REASONS[r];
  return k ? t('reasons.' + k) : r;
}

class Analyzer extends EventEmitter {
  // systemLocale: işletim sisteminin dili (ör. 'tr-TR'); dil ayarı 'system' iken kullanılır.
  constructor(dataDir, opts = {}) {
    super();
    this.systemLocale = opts.systemLocale || Intl.DateTimeFormat().resolvedOptions().locale;
    this.store = new Store(dataDir);
    this.settings = { ...DEFAULTS, ...this.store.read('settings', {}) };
    this.probeCache = this.store.read('cache-probe', {});
    this.metaCache = this.store.read('cache-meta', {});
    this.snapshot = this.store.read('snapshot', null);
    this.changes = this.store.read('changes', []);
    this.sys = null; this.lib = null; this.probes = {};
    this.state = null; this.busy = null; this.lastScan = null; this.progress = null;
  }

  saveSettings() { this.store.write('settings', this.settings); }

  get lang() { return resolveLang(this.settings.lang, this.systemLocale); }
  get t() { return translator(this.lang); }

  // reason: taramanın nedeni (locales içindeki reasons anahtarı: manual, startup, periodic …).
  async scan(reason = 'manual') {
    if (this.busy) return this.busy;
    this.busy = this._scan(reason).finally(() => { this.busy = null; this.progress = null; this.emit('progress', null); });
    return this.busy;
  }

  async _scan(reason) {
    // stage: o anki dilde metin; key: dilden bağımsız adım adı.
    const step = (key, extra) => { this.progress = { key, stage: this.t('progress.' + key), ...extra }; this.emit('progress', this.progress); };
    step('system');
    const sys = await detectSystem();
    step('libraries');
    const lib = await scanLibraries(sys._hints, sys, this.settings);
    step('files');
    const probes = await probeAll(lib.games, this.probeCache, { onProgress: (d, t, n) => step('files', { done: d, total: t, name: n }) });
    this.probeCache = probes;
    this.store.write('cache-probe', probes);
    this.sys = sys; this.lib = lib; this.probes = probes;

    const snap = fingerprint(sys, lib);
    const items = this.snapshot ? diff(this.snapshot, snap).map(i => ({ ...i, text: changeText(i, this.t) })) : [];
    const first = !this.snapshot;
    if (first) this.changes.unshift({ at: Date.now(), reason, first: true, items: [{ type: 'info', key: 'first', text: this.t('changes.first') }] });
    else if (items.length) this.changes.unshift({ at: Date.now(), reason, items });
    this.changes = this.changes.slice(0, 100);
    this.store.write('changes', this.changes);
    this.snapshot = snap;
    this.store.write('snapshot', snap);
    this.lastScan = Date.now();
    this.build();
    if (items.length) this.emit('changes', items);
    if (this.settings.online) this.fetchMeta().catch(() => {});
    return { items, first };
  }

  // Adrenalin'de ayar değişince (dosya değişikliği ya da pencereye dönüş) yalnızca bu ayarlar yeniden okunur; tam tarama yapılmaz.
  async refreshAmd() {
    if (!this.sys || this.busy || this.refreshingAmd || process.platform !== 'win32') return false;
    const g = this.sys.gpus.filter(x => x.vendor === 'amd' && !x.virtual).sort((a, b) => b.score - a.score)[0];
    if (!g) return false;
    this.refreshingAmd = true;
    try {
      const a = await readAmdSettings(g.classKey);
      const sig = x => JSON.stringify(x ? [x.global, x.profiles] : null);
      if (sig(a) === sig(this.sys.amdSettings)) return false;
      this.sys.amdSettings = a;
      this.build();
      return true;
    } catch { return false; } finally { this.refreshingAmd = false; }
  }

  // Veritabanında olmayan oyunlar için mağaza bilgisi (sırayla, önbellekli).
  async fetchMeta() {
    if (!this.lib || this.fetchingMeta) return;
    this.fetchingMeta = true;
    try {
      const todo = this.lib.games.filter(g => !gamedb.match(g) && !(this.settings.overrides[g.id] && this.settings.overrides[g.id].t) && (!this.metaCache[g.id] || Date.now() - this.metaCache[g.id].at > 30 * 864e5)).slice(0, 25);
      for (const g of todo) {
        try { this.metaCache[g.id] = await steamstore.lookup(g); } catch { break; }
        await new Promise(r => setTimeout(r, 350));
      }
      if (todo.length) { this.store.write('cache-meta', this.metaCache); this.build(); }
    } finally { this.fetchingMeta = false; }
  }

  build() {
    if (!this.sys) return null;
    const sys = this.sys, s = this.settings, lang = this.lang, t = this.t;
    const primary = pickPrimary(sys, s);
    const c = engine.context(sys, primary, { goal: s.goal, lang });
    const srcName = src => (src === 'folder' ? t('sources.folder') : SOURCES[src] || src);
    const games = this.lib.games.map(g => {
      const db = gamedb.match(g);
      const meta = this.metaCache[g.id] && !this.metaCache[g.id].none ? this.metaCache[g.id] : null;
      const probe = this.probes[g.id];
      const p = engine.buildProfile(g, db, probe, meta, s.overrides[g.id], lang);
      if (!g.name && p.n) g.name = p.n;
      return {
        id: g.id, name: p.n, source: g.source, sourceName: srcName(g.source), alsoIn: (g.alsoIn || []).map(srcName), installDir: g.installDir, accessible: g.accessible,
        lastPlayed: g.lastPlayed || null, appid: g.appid || (meta && meta.appid) || null, hasImage: !!g.image, image: g.image || null,
        profile: { t: p.t, y: p.y, f: p.f, c60: p.c60, ac: p.ac, est: p.est, inDb: p.inDb, probed: p.probed, eng: p.eng, ov: p.ov },
        probe: probe && !probe.error ? { files: probe.files, scanned: probe.scanned, truncated: probe.truncated, dlssVersion: probe.dlssVersion, xessVersion: probe.xessVersion, fsrFileVersion: probe.fsrFileVersion } : null,
        rec: engine.recommend(p, c),
      };
    });
    // Kütüphanede olmayan veritabanı oyunları ("hazır liste")
    const have = new Set(games.map(g => g.name));
    const catalog = gamedb.G.filter(x => !have.has(x.n) && !this.lib.games.some(g => gamedb.match(g) === x)).map(x => {
      const p = engine.buildProfile({ id: 'db:' + x.n, name: x.n, source: 'db' }, x, null, null, s.overrides['db:' + x.n], lang);
      return { id: 'db:' + x.n, name: x.n, source: 'db', sourceName: t('sources.catalog'), alsoIn: [], accessible: false, catalog: true, appid: x.ids && x.ids.steam, profile: { t: p.t, y: p.y, f: p.f, c60: p.c60, ac: p.ac, est: p.est, inDb: true, probed: false, ov: p.ov }, rec: engine.recommend(p, c) };
    });
    const pub = { ...sys };
    delete pub._uninstall; delete pub._hints;
    // Algılamadan gelen dilden bağımsız etiketler arayüz için çevrilir.
    pub.gpus = sys.gpus.map(g => ({ ...g, arch: archLabel(g, t) }));
    pub.displays = sys.displays.map(d => ({ ...d, connection: CONN.includes(d.connection) ? t('detect.conn.' + d.connection) : d.connection }));
    this.state = {
      system: pub,
      primary: { gpuId: primary.gpu && primary.gpu.id, displayId: primary.display && primary.display.id },
      ctx: { resLabel: c.resLabel, hz: c.hz, vrr: c.vrr, vendor: c.vendor, goal: c.goal },
      checks: engine.systemChecks(sys, c),
      global: engine.vendorGlobal(sys, c),
      games, catalog,
      libraries: { steam: this.lib.steamLibraries, autoFolders: this.lib.autoFolders, errors: this.lib.errors, sources: SOURCES },
      changes: this.changes.slice(0, 50).map(e => ({ ...e, reason: reasonText(e.reason, t), items: e.items.map(i => ({ type: i.type, text: changeText(i, t) })) })),
      settings: s,
      lang, langs: LANGS.map(id => ({ id, name: LOCALES[id].meta.name })), systemLang: resolveLang('system', this.systemLocale),
      lastScan: this.lastScan,
      platform: process.platform,
    };
    this.emit('state', this.state);
    return this.state;
  }

  setSettings(patch) {
    const rescan = ['folders', 'autoFolders', 'hidden', 'playniteDir'].some(k => k in patch);
    this.settings = { ...this.settings, ...patch };
    this.saveSettings();
    if (rescan) return this.scan('settings');
    return this.build();
  }

  setOverride(id, ov) {
    const o = { ...this.settings.overrides };
    if (ov && Object.keys(ov).some(k => ov[k] != null && ov[k] !== '')) o[id] = ov; else delete o[id];
    this.settings.overrides = o;
    this.saveSettings();
    return this.build();
  }
}

module.exports = { Analyzer, DEFAULTS };
