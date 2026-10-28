'use strict';
// AMD Software: Adrenalin Edition'da kayıtlı ayarları okur (yalnızca okuma, yalnızca Windows).
// Kaynaklar ve anlamları 22 Ekim 2026'da Adrenalin 26.10.1'in arayüzüyle karşılaştırılarak doğrulandı:
//  - %LOCALAPPDATA%\ATI\ACE\APL\User.blb: oyun profilleri ("BWJE" başlıklı ikili dosya). Profili olmayan oyun genel ayarları kullanır.
//  - %LOCALAPPDATA%\AMD\CN\GExDb.blb: genel "Oyun Deneyimi" profilleri (JSON). Buradan yalnızca Radeon Image Sharpening okunur.
//  - Kayıt defteri: ekran kartının sürücü anahtarı (KMD_*, Gmx_*), onun UMD alt anahtarı ve HKCU\Software\AMD\CN.
//  - %LOCALAPPDATA%\AMD\CN\gmdb.blb: Adrenalin'in oyun listesi (JSON): oyuna özel RSR ve AFMF, ölçülen FPS, anahtarların varlığı.
// Anlamı doğrulanmayan kayıtlar okunmaz; arayüzde "okunamadı" görünür.
const fs = require('fs');
const path = require('path');
const { exec, normLoose } = require('../util');

const CLASS_ROOT = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\';

function files(env = process.env) {
  const local = env.LOCALAPPDATA || '';
  return { apl: path.join(local, 'ATI', 'ACE', 'APL', 'User.blb'), gex: path.join(local, 'AMD', 'CN', 'GExDb.blb') };
}

// ---------- User.blb ----------
// Biçim: 0x60 baytlık başlık; ardından 8 baytlık birimlerle bölümler. Başlıktaki son çift (başlangıç, birim sayısı)
// profil tablosunu verir: her profil 5 birimdir → [ad, exe, yol, ?, işaretçi]. Metin alanları (birim, bayt uzunluğu)
// çiftiyle dosyanın başındaki UTF-16 metin yığınını gösterir. İşaretçi, ayar bloğunun başlangıç birimini tutar.
// Ayar bloğu: 4 birimlik başlık (son çiftin ikinci sayısı kayıt sayısı), sonra her kayıt için
// 16 baytlık ASCII ad + 4 baytlık uzunluk + UTF-16 değer ("0x0300::1;;" biçiminde), 8 bayta tamamlanır.
const BASE = 0x60, U = 8;

function parseApl(buf) {
  if (!buf || buf.length < BASE || buf.toString('latin1', 0, 4) !== 'BWJE') throw new Error('User.blb biçimi tanınmadı');
  const i32 = o => buf.readInt32LE(o);
  const at = u => BASE + u * U;
  const str = (u, len) => (len >= 2 && at(u) + len <= buf.length ? buf.toString('utf16le', at(u), at(u) + len - 2) : '');
  const [tabStart, tabUnits] = [i32(0x58), i32(0x5c)];
  const out = [];
  for (let i = 0; i < Math.floor(tabUnits / 5); i++) {
    const o = at(tabStart + i * 5);
    if (o + 40 > buf.length) break;
    const ref = k => [i32(o + k * 8), i32(o + k * 8 + 4)];
    const exe = str(...ref(1)), dir = str(...ref(2));
    const ptr = i32(at(ref(4)[0]));
    let p = at(ptr);
    if (ptr < 0 || p + 32 > buf.length) continue;
    const n = i32(p + 28);
    p += 32;
    const props = {};
    for (let k = 0; k < n && p + 20 <= buf.length; k++) {
      const name = buf.toString('latin1', p, p + 16).split('\0')[0];
      const len = buf.readUInt32LE(p + 16);
      if (p + 20 + len > buf.length) break;
      const raw = len > 4 ? buf.toString('utf16le', p + 20, p + 20 + len) : '';
      const m = /^0x[0-9a-f]+::(.*);;$/i.exec(raw);
      props[name] = m ? m[1] : raw || null;
      p += 16 + Math.ceil((4 + len) / 8) * 8;
    }
    const steam = /^steamappid:(\d+)$/i.exec(exe);
    out.push({ exe: steam ? null : exe, appid: steam ? steam[1] : null, dir: dir ? dir.replace(/\*$/, '').replace(/[\\/]+$/, '') : null, props });
  }
  return out;
}

// ---------- GExDb.blb ----------
// JSON: { "": { Profiles: [ { ProfileName, GPUS: [ { GraphicsFeatures: [ { FeatureID, FeatureValue } ] } ] } ] }, "{GUID}": {...} }
// "" anahtarı genel ayarlardır. Doğrulanan özellik numaraları: 27 = Radeon Image Sharpening, 28 = Netlik (%),
// 44 = RSR, 58 = AFMF (RSR ve AFMF kayıt defterinden okunur). Özel profil yoksa custom null döner.
function parseGex(buf) {
  const j = JSON.parse(buf.toString('utf8').replace(/^﻿/, '').replace(/\0+$/, ''));
  const g = j[''] || {};
  const custom = (g.Profiles || []).find(p => p.ProfileName === 'Custom');
  const feats = {};
  for (const gpu of (custom && custom.GPUS) || []) for (const f of gpu.GraphicsFeatures || []) feats[f.FeatureID] = f.FeatureValue;
  return { custom: custom ? feats : null, release: j.ReleaseVersion || null };
}

// ---------- kayıt defteri ----------
// reg.exe çıktısı: "    Ad    REG_SZ    değer". DWORD değerleri sayıya, UTF-16 metin taşıyan ikili değerler metne çevrilir.
function parseRegQuery(text) {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^ {4}(.+?) {4}(REG_[A-Z_]+)(?: {4}(.*))?$/.exec(line);
    if (!m) continue;
    const [, name, type, v = ''] = m;
    if (type === 'REG_DWORD' || type === 'REG_QWORD') out[name] = parseInt(v, 16);
    else if (type === 'REG_BINARY') {
      const b = Buffer.from(v.trim(), 'hex');
      const s = b.length && b.length % 2 === 0 ? b.toString('utf16le').replace(/\0+$/, '') : '';
      out[name] = /^[\x20-\x7e]*$/.test(s) && s ? s : v.trim();
    } else out[name] = v.trim();
  }
  return out;
}

async function regQuery(key) {
  const r = await exec('reg.exe', ['query', key], { timeout: 15000 });
  return r.ok ? parseRegQuery(r.stdout) : null;
}

// ---------- ortak biçim ----------
const num = v => (v == null || v === '' ? null : Number(v));
const bool = v => (v == null || v === '' ? undefined : String(v).trim() === '1');
const pct = v => { const n = num(v); return n == null || Number.isNaN(n) ? null : Math.round(n <= 1 ? n * 100 : n); };

// Oyun profili → { antiLag, boost, chill, ris, afmf, fsrUp, fsrFg, enhancedSync, vsyncWait }.
// Profilde olmayan ayar undefined kalır (ör. Radeon Boost'u desteklemeyen oyunlarda Bst_* kayıtları yoktur).
function fromProfile(p) {
  const s = {};
  if ('Dlg_PFEnable' in p) s.antiLag = bool(p.Dlg_PFEnable);
  if ('Bst_PFEnable' in p) s.boost = bool(p.Bst_PFEnable);
  if ('Chil_PFEnable' in p) s.chill = { on: bool(p.Chil_PFEnable), min: num(p.Chil_MinFRate), max: num(p.Chil_MaxFRate) };
  if ('Ris_PFEnable' in p) s.ris = { on: bool(p.Ris_PFEnable), pct: pct(p.Ris_SHDegree) };
  if ('UFG_PFEnabled' in p) s.afmf = bool(p.UFG_PFEnabled);
  if ('FsrOverride' in p) s.fsrUp = bool(p.FsrOverride);
  if ('MlfiOverride' in p) s.fsrFg = bool(p.MlfiOverride);
  if ('TurboSync' in p) s.enhancedSync = bool(p.TurboSync);
  if ('VSyncControl' in p) s.vsyncWait = num(p.VSyncControl);
  return s;
}

// Genel ayarlar. Oyun Deneyimi "Özel" değilse (ör. HYPR-RX) GExDb'deki Özel profil o an geçerli olmayabilir; RIS okunmaz.
// RSR ve AFMF 22 Ekim 2026'da Adrenalin'de bir kez açılıp kapatılarak bulundu (Bora'nın izniyle):
//  - Gmx_RSREnabled: RSR açıkken 3; kapalıyken kurulumdan gelen 1 ya da kapatıldıktan sonra 0. Açık olduğunu 2 biti gösterir.
//  - UMD\DrvFrameGenEnabled: AFMF açıkken "1", kapatıldıktan sonra "0"; hiç açılmadıysa kayıt yoktur (kapalı).
//  - GExDb Özel profil, özellik 27: RIS kapatılınca kayıt silinir; yoksa kapalıdır.
function fromGlobal(kmd, umd, cn, gex) {
  const s = {};
  const umdOk = !!umd;
  kmd = kmd || {}; umd = umd || {}; cn = cn || {};
  if ('Gmx_RSREnabled' in kmd) s.rsr = (kmd.Gmx_RSREnabled & 2) !== 0;
  if (umdOk) s.afmf = bool(umd.DrvFrameGenEnabled) === true;
  if ('KMD_DeLagEnabled' in kmd) s.antiLag = kmd.KMD_DeLagEnabled === 1;
  if ('KMD_RadeonBoostEnabled' in kmd) s.boost = kmd.KMD_RadeonBoostEnabled === 1;
  if ('KMD_ChillEnabled' in kmd) s.chill = { on: kmd.KMD_ChillEnabled === 1, min: null, max: null };
  if ('Gmx_FRTCEnabled' in kmd) s.frtc = { on: kmd.Gmx_FRTCEnabled === 1, fps: kmd.Gmx_FRTCFrameRateTarget || null };
  if ('FsrOverride' in umd) s.fsrUp = bool(umd.FsrOverride);
  if ('MlfiOverride' in umd) s.fsrFg = bool(umd.MlfiOverride);
  if ('TurboSync' in umd) s.enhancedSync = bool(umd.TurboSync);
  if ('VSyncControl' in umd) s.vsyncWait = num(umd.VSyncControl);
  if ('TFQ' in umd) s.texFilter = num(umd.TFQ);
  if ('SurfaceFormatReplacements' in umd) s.surfaceFmt = bool(umd.SurfaceFormatReplacements);
  if ('Tessellation_OPTION' in umd) s.tess = num(umd.Tessellation_OPTION);
  if ('AntiAlias' in umd) s.aa = { mode: num(umd.AntiAlias), mlaa: bool(umd.MLF) };
  // Yönbağımlı Filtreleme (0 = Devre dışı) ve OpenGL Üçlü Arabelleğe Alma; arayüzdeki "Devre dışı" ile karşılaştırıldı.
  if ('AnisoDegree' in umd) s.aniso = num(umd.AnisoDegree);
  if ('EnableTripleBuffering' in umd) s.tripleBuf = bool(umd.EnableTripleBuffering);
  if ('FsrOtaIndex' in umd) s.fsrOta = num(umd.FsrOtaIndex);
  s.experience = cn.LastSavedExpID || null;
  const custom = s.experience === 'PROFILE_CUSTOM';
  if (custom && gex && gex.custom) s.ris = { on: String(gex.custom['27']) === '1', pct: pct(gex.custom['28']) };
  return s;
}

// classKey: ekran kartının sürücü anahtarı, ör. "{4d36e968-e325-11ce-bfc1-08002be10318}\0000".
async function readAmdSettings(classKey, env = process.env) {
  const out = { ok: false, at: Date.now(), global: null, profiles: [], sources: {}, errors: [] };
  if (process.platform !== 'win32') return out;
  const f = files(env);
  const stat = p => { try { return fs.statSync(p).mtimeMs; } catch { return null; } };
  let gex = null;
  try { out.profiles = parseApl(fs.readFileSync(f.apl)).map(p => ({ exe: p.exe, appid: p.appid, dir: p.dir, s: fromProfile(p.props) })); out.sources.apl = stat(f.apl); } catch (e) { out.errors.push('apl: ' + e.message); }
  try { gex = parseGex(fs.readFileSync(f.gex)); out.sources.gex = stat(f.gex); } catch (e) { out.errors.push('gex: ' + e.message); }
  const [kmd, umd, cn] = await Promise.all([
    classKey ? regQuery(CLASS_ROOT + classKey) : null,
    classKey ? regQuery(CLASS_ROOT + classKey + '\\UMD') : null,
    regQuery('HKCU\\Software\\AMD\\CN'),
  ]);
  if (!kmd) out.errors.push('kayıt defteri: sürücü anahtarı');
  out.global = fromGlobal(kmd, umd, cn, gex);
  out.ok = out.sources.apl != null || !!kmd;
  try { out.perf = readPerf(env); } catch (e) { out.errors.push('ölçüm: ' + e.message); }
  try { out.gm = parseGmdb(fs.readFileSync(path.join(env.LOCALAPPDATA || '', 'AMD', 'CN', 'gmdb.blb'))); } catch (e) { out.errors.push('gmdb: ' + e.message); }
  return out;
}

// ---------- gmdb.blb: Adrenalin'in oyun listesi (JSON) ----------
// 22 Ekim 2026'da Witcher 3 profilinde RSR bir kez açılıp kapatılarak doğrulandı (Bora'nın izniyle):
//  upscaling_enabled "TRUE"/"FALSE" = oyuna özel RSR (upscaling_use_borderless: "Etkin - Kenarlıksız Tam Ekran"),
//  framegen_enabled 1/0 = oyuna özel AFMF (RDR2'de User.blb'deki UFG_PFEnabled ile aynı),
//  averageFPS ve percentile95_msec = Adrenalin'in Oyun Danışmanı'nda ve oyun kartında gösterdiği ölçüm,
//  userprofiletype 4 = Özel, 5 = Global Deneyim; FSRUpgradeAvailable / MlfiAvailable = FSR Yükseltme ve FSR Kare Üretimi
//  anahtarı bu oyunda var. Oyunun GUID'i GExDb.blb'deki oyun kaydının anahtarıdır.
function parseGmdb(buf) {
  const j = JSON.parse(buf.toString('utf8').replace(/^﻿/, '').replace(/\0+$/, ''));
  const T = v => String(v).toUpperCase() === 'TRUE';
  return (j.games || []).map(g => ({
    guid: g.guid || null, title: g.title || null, appid: g.steam_id > 0 ? String(g.steam_id) : null, exePath: g.exe_path || null,
    rsr: T(g.upscaling_enabled), rsrBorderless: T(g.upscaling_use_borderless), afmf: Number(g.framegen_enabled) === 1,
    fsrUpAvail: T(g.FSRUpgradeAvailable), mlfiAvail: T(g.MlfiAvailable), profileType: g.userprofiletype,
    fps: g.averageFPS > 0 ? Math.round(g.averageFPS * 10) / 10 : null, p95: g.percentile95_msec > 0 ? g.percentile95_msec : null,
    perfAt: g.lastperformancereporttime ? Date.parse(g.lastperformancereporttime) || null : null,
  }));
}

// Oyunun gmdb kaydı: Steam numarası, exe klasörü ya da ad.
// Xbox / Microsoft Store oyunları: Adrenalin oyunu çalıştığı WindowsApps klasöründen tanır
// (C:\Program Files\WindowsApps\<paket>_<sürüm>_x64__<yayıncı>\…), RigTune ise XboxGames\…\Content kopyasından bulur; yollar
// tutmadığı için eşleşme paket adıyla (MicrosoftGame.config Identity) yapılır. Oyun güncellenince Adrenalin yeni sürüm klasörü
// için yeni kayıt açar, eskisi kalır (28 Ekim 2026: AoE II'nin iki profili); sürümü tutan, yoksa en yeni sürüm seçilir.
const pkgOf = p => { const m = /\\windowsapps\\([^\\_]+)_([\d.]+)_/i.exec(String(p || '').replace(/\//g, '\\')); return m ? { name: m[1].toLowerCase(), ver: m[2] } : null; };
const verCmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
function byPackage(list, pathOf, game) {
  if (!game.pkg) return null;
  const want = String(game.pkg).toLowerCase();
  const hits = list.map(x => ({ x, k: pkgOf(pathOf(x)) })).filter(h => h.k && h.k.name === want);
  if (!hits.length) return null;
  const same = game.version && hits.find(h => h.k.ver === String(game.version));
  return (same || hits.sort((a, b) => verCmp(b.k.ver, a.k.ver))[0]).x;
}

function gmdbFor(amd, game) {
  const list = amd && amd.gm;
  if (!list || !game) return null;
  const n = p => String(p || '').replace(/\//g, '\\').replace(/\\+/g, '\\').replace(/\\$/, '').toLowerCase();
  const dir = n(game.dir), name = game.name ? normLoose(game.name) : '';
  return (game.appid && list.find(x => x.appid === String(game.appid)))
    || (dir && list.find(x => x.exePath && n(x.exePath).startsWith(dir + '\\')))
    || byPackage(list.filter(x => x.exePath), x => x.exePath, game)
    || (name && list.find(x => x.title && normLoose(x.title) === name)) || null;
}

// ---------- Adrenalin'in ölçtüğü performans (Oyun Danışmanı'nın kullandığı veri) ----------
// %LOCALAPPDATA%\AMD\CN\GameReport\<exe>\gpa.bin: oyunun son ölçülen oturumundaki kare süreleri, mikrosaniye, boşlukla ayrılmış.
// Ortalama FPS = 1e6 / ortalama kare süresi; Adrenalin'in gösterdiğiyle karşılaştırıldı (22 Ekim 2026: King Arthur 143,5 / 144,0,
// AoE II 140,5 / 141,7). %LOCALAPPDATA%\AMD\CN\RGStats.db (SQLite) içindeki InstalledGames tablosu exe yolunu ve Steam numarasını verir.
function parseGpa(text) {
  const ft = String(text || '').trim().split(/\s+/).map(Number).filter(x => x > 0 && Number.isFinite(x));
  if (ft.length < 100) return null;
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const avg = mean(ft);
  const sorted = [...ft].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  // Kare üretimi açıkken kareler bir uzun bir kısa gelir (King Arthur'da 11,5 ms / 2,5 ms); açık değilken çift ve tek
  // sıradaki ortalamalar neredeyse aynıdır (incelenen 10 oyunda oran 1,05'in altında). 1,5 sınırı iki durumu açıkça ayırır.
  const ev = mean(ft.filter((_, i) => i % 2 === 0)), od = mean(ft.filter((_, i) => i % 2 === 1));
  const fg = Math.max(ev, od) / Math.min(ev, od) > 1.5;
  return { fps: Math.round(1e7 / avg) / 10, p95: Math.round(p95 / 100) / 10, frames: ft.length, fg };
}

function readPerf(env = process.env) {
  const cn = path.join(env.LOCALAPPDATA || '', 'AMD', 'CN');
  const byExe = {};
  let dirs = [];
  try { dirs = fs.readdirSync(path.join(cn, 'GameReport')); } catch { /* ölçüm yok */ }
  for (const d of dirs) {
    const f = path.join(cn, 'GameReport', d, 'gpa.bin');
    let text, at;
    try { text = fs.readFileSync(f, 'latin1'); at = fs.statSync(f).mtimeMs; } catch { continue; }
    const s = parseGpa(text);
    if (s) byExe[d.toLowerCase()] = { ...s, at };
  }
  // Adrenalin veritabanı açıkken kilitli olabilir; geçici bir kopyası okunur.
  const games = [];
  const db = path.join(cn, 'RGStats.db');
  if (fs.existsSync(db)) {
    const tmp = path.join(require('os').tmpdir(), `rigtune-rgstats-${process.pid}.db`);
    try {
      fs.copyFileSync(db, tmp);
      const { DatabaseSync } = require('node:sqlite');
      const conn = new DatabaseSync(tmp, { readOnly: true });
      try { for (const r of conn.prepare('SELECT ExePath, Title, SteamID FROM InstalledGames').all()) games.push({ exePath: r.ExePath, title: r.Title || null, appid: r.SteamID > 0 ? String(r.SteamID) : null }); } finally { conn.close(); }
    } catch { /* eski Node ya da okunamayan veritabanı: yalnızca exe adıyla eşlenir */ } finally { fs.rm(tmp, { force: true }, () => {}); }
  }
  return { byExe, games };
}

// Oyunun ölçümü: Adrenalin'in oyun listesinde Steam numarası, klasör ya da ad ile eşleşen exe; yoksa klasör taramasının bulduğu exe.
// Ad eşleşmesi Xbox / Microsoft Store oyunları için gerekir: oyun WindowsApps altından çalışır, kurulum klasörü tutmaz.
function perfFor(amd, game) {
  const P = (amd && amd.perf) || { byExe: {}, games: [] };
  if (!amd || !game) return null;
  const n = p => String(p || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
  const dir = n(game.dir);
  const measuredExe = x => P.byExe[path.win32.basename(x.exePath).toLowerCase()];
  const name = game.name ? normLoose(game.name) : '';
  const hit = (game.appid && P.games.find(x => x.appid === String(game.appid) && measuredExe(x)))
    || (dir && P.games.find(x => n(x.exePath).startsWith(dir + '\\') && measuredExe(x)))
    || (name && P.games.find(x => x.title && normLoose(x.title) === name && measuredExe(x)));
  const exe = hit ? path.win32.basename(hit.exePath) : game.exe ? path.win32.basename(game.exe) : null;
  const gpa = (exe && P.byExe[exe.toLowerCase()]) || null;
  // Ortalama FPS ve %95 için Adrenalin'in kendi hesapladığı değer (gmdb) önce gelir; kare üretimi gpa.bin'den anlaşılır.
  const gm = gmdbFor(amd, game);
  if (!gpa && !(gm && gm.fps)) return null;
  return { fps: (gm && gm.fps) || gpa.fps, p95: (gm && gm.p95) || gpa.p95, at: (gm && gm.perfAt) || gpa.at, fg: gpa ? gpa.fg : false };
}

// Oyunun profili: önce klasör eşleşmesi (sürücü exe ve yoluna göre uygular), yoksa Steam numarası.
// Profil yolu oyun klasörünün kendisi ya da alt klasörü olabilir (ör. "The Witcher 3\bin\x64_dx12").
function profileFor(amd, game) {
  if (!amd || !amd.profiles || !game) return null;
  const n = p => String(p || '').replace(/\//g, '\\').replace(/\\+/g, '\\').replace(/\\$/, '').toLowerCase();
  const dir = n(game.dir);
  const byDir = dir && amd.profiles.find(p => p.dir && (n(p.dir) === dir || n(p.dir).startsWith(dir + '\\')));
  if (byDir) return byDir;
  return (game.appid && amd.profiles.find(p => p.appid && p.appid === String(game.appid))) || byPackage(amd.profiles.filter(p => p.dir), p => p.dir, game) || null;
}

module.exports = { readAmdSettings, parseApl, parseGex, parseRegQuery, fromProfile, fromGlobal, profileFor, parseGpa, readPerf, perfFor, parseGmdb, gmdbFor, files };
