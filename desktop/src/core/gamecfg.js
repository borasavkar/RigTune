'use strict';
// Oyunların kendi ayar dosyalarını okur (yalnızca okur, hiçbir şey yazmaz). Şu an tanınanlar:
//   The Witcher 3 (Belgeler\The Witcher 3\dx12user.settings ya da user.settings),
//   Red Dead Redemption 2 (Belgeler\Rockstar Games\Red Dead Redemption 2\Settings\system.xml),
//   Unreal Engine oyunları (Saved\Config\<platform>\GameUserSettings.ini).
// Yalnızca anlamı kesin olan değerler çözülür (adı kendini anlatan açık/kapalı değerler, çözünürlük, Unreal'in belgelenmiş
// EWindowMode sırası). Anlamı doğrulanmamış sayısal kodlar (ör. Witcher 3 AAMode=5) çözülmez, dosyadaki hâliyle `raw`
// alanında verilir; tahmin yapılmaz.
// Oyunun klasörleri adla aranmaz: yalnızca kütüphanede bulunan oyunun kendi dosya adlarından türeyen yollara bakılır.
const fs = require('fs');
const os = require('os');
const path = require('path');
const rdr2 = require('./engine/games/rdr2');

// Sonuç biçimi:
// { kind, file, at (dosyanın kayıt zamanı), v: { res: {w,h}, display: 'fullscreen'|'borderless'|'windowed', vsync, cap
//   (0 = sınırsız), hdr, fg, latency, up: { kind: 'fsr'|'dlss'|'xess'|'tsr'|'off', gen, mode, src: 'Anahtar=değer' } },
//   raw: { id: 'Anahtar=değer' } }

function iniParse(text) {
  const out = {};
  let sec = '';
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s[0] === ';' || s[0] === '#') continue;
    const m = /^\[(.*)\]$/.exec(s);
    if (m) { sec = m[1]; continue; }
    const i = s.indexOf('=');
    if (i < 1) continue;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if (v.length > 1 && v[0] === '"' && v[v.length - 1] === '"') v = v.slice(1, -1);
    if (!(sec in out)) out[sec] = {};
    if (!(k in out[sec])) out[sec][k] = v;
  }
  return out;
}
// Bütün bölümlerde ilk bulunan değer.
function iniFlat(ini) {
  const out = {};
  for (const sec of Object.values(ini)) for (const [k, v] of Object.entries(sec)) if (!(k in out)) out[k] = v;
  return out;
}

const bool = v => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
};
const resOf = (w, h) => (w > 0 && h > 0 ? { w: Math.round(w), h: Math.round(h) } : undefined);
const num = v => (v === undefined || v === null || v === '' || isNaN(+v) ? undefined : +v);
const rawOf = (o, keys) => { const s = keys.filter(k => o[k] !== undefined).map(k => `${k}=${o[k]}`).join(' · '); return s || undefined; };
function clean(r) {
  for (const k of Object.keys(r.v)) if (r.v[k] === undefined) delete r.v[k];
  for (const k of Object.keys(r.raw)) if (r.raw[k] === undefined || k in r.v) delete r.raw[k];
  return r;
}

// Adı kendini anlatan ölçekleyici değeri: "AMD_FSR2_Quality", "DLSS_Balanced", "XeSS Performance", "TSR", "Off".
const MODES = [['ultraperformance', 'up'], ['ultraquality', 'uq'], ['nativeaa', 'naa'], ['dlaa', 'naa'], ['quality', 'q'], ['balanced', 'b'], ['performance', 'p']];
function upscalerText(v) {
  if (v === undefined || /^-?\d+(\.\d+)?$/.test(String(v).trim())) return undefined;
  const s = String(v).toLowerCase().replace(/[\s_-]+/g, '');
  if (/^(off|none|disabled|native|taa)$/.test(s)) return { kind: 'off' };
  const k = /fsr(\d)?/.exec(s) ? 'fsr' : /dlss/.test(s) ? 'dlss' : /xess/.test(s) ? 'xess' : /tsr/.test(s) ? 'tsr' : null;
  if (!k) return undefined;
  const gen = k === 'fsr' ? (/fsr(\d)/.exec(s) || [])[1] : undefined;
  const mode = (MODES.find(([w]) => s.includes(w)) || [])[1];
  return { kind: k, gen, mode };
}

// ---------- The Witcher 3 ----------
// [Viewport] Resolution="3440x1440", VSync=true|false, AMDAntiLag=0|1, FullScreenMode (sayı; anlamı doğrulanmadı)
// [PostProcess] FSRFramegen=0|1, AAMode ve FSR2Quality (sayı; anlamı doğrulanmadı) · [Visuals] HdrEnabled · [Engine] LimitFPS
function parseWitcher3(text) {
  const ini = iniParse(text);
  const vp = ini.Viewport || {}, pp = ini.PostProcess || {}, vis = ini.Visuals || {}, eng = ini.Engine || {};
  const m = /^(\d+)\s*x\s*(\d+)$/.exec(vp.Resolution || '');
  const lim = num(eng.LimitFPS);
  return clean({
    kind: 'witcher3',
    v: {
      res: m ? resOf(+m[1], +m[2]) : undefined,
      vsync: bool(vp.VSync),
      latency: bool(vp.AMDAntiLag),
      fg: bool(pp.FSRFramegen),
      hdr: bool(vis.HdrEnabled),
      cap: lim !== undefined && lim >= 0 ? lim : undefined,
    },
    raw: { display: rawOf(vp, ['FullScreenMode']), up: rawOf(pp, ['AAMode', 'FSR2Quality']) },
  });
}

// ---------- Red Dead Redemption 2 ----------
// <screenWidth value="3440" />, <vSync value="0" /> (0 = kapalı), <hdr value="true" />; windowed ve fsr2Index sayıları
// doğrulanmadı. Oyunun kendi FPS sınırlayıcısı dosyada yok.
function parseRdr2(text) {
  const x = {};
  for (const m of text.matchAll(/<(\w+)\s+value="([^"]*)"\s*\/>/g)) if (!(m[1] in x)) x[m[1]] = m[2];
  const vs = num(x.vSync);
  // Oyunun menüsüyle doğrulananlar (Bora'nın ekran görüntüleri, 24 Ekim 2026): windowed=2 "Windowed Borderless",
  // fsr2Index=1 "AMD FSR 2: Quality" (dlssIndex=0). Diğer değerler doğrulanmadı; dosyadaki hâliyle kalır.
  const win = num(x.windowed), fsr = num(x.fsr2Index);
  return clean({
    kind: 'rdr2',
    // Menüdeki bütün grafik ayarları (engine/games/rdr2.js)
    all: rdr2.readAll(text),
    v: {
      res: resOf(num(x.screenWidth), num(x.screenHeight)),
      display: win === 2 ? 'borderless' : undefined,
      vsync: vs === undefined ? undefined : vs !== 0,
      hdr: bool(x.hdr),
      // Oyunun menüsünde kare üretimi seçeneği yok.
      fg: false,
      up: fsr === 1 ? { kind: 'fsr', gen: '2', mode: 'q', src: 'fsr2Index=1' } : undefined,
    },
    raw: { display: rawOf(x, ['windowed']), up: rawOf(x, ['fsr2Index', 'dlssIndex']) },
  });
}

// ---------- Unreal Engine ----------
// Motorun UGameUserSettings alanları: ResolutionSizeX/Y, FullscreenMode (EWindowMode: 0 Fullscreen, 1 WindowedFullscreen,
// 2 Windowed), bUseVSync, FrameRateLimit (0 = sınırsız), bUseHDRDisplayOutput. Ölçekleyici ve kare üretimi oyuna özel
// anahtarlardadır; yalnızca değeri kendini anlatanlar (UpscaleMode=AMD_FSR2_Quality, FrameGenerationFSREnabled=False) çözülür.
const UE_MODE = ['fullscreen', 'borderless', 'windowed'];
function parseUnreal(text) {
  const o = iniFlat(iniParse(text));
  const fm = num(o.FullscreenMode);
  const lim = num(o.FrameRateLimit);
  // Ölçekleyici: Upscale/Upscaling/Upscaler ile başlayan anahtar (kalite, yumuşaklık ve keskinlik anahtarları hariç).
  const upKeys = Object.keys(o).filter(k => /^upscal/i.test(k) && !/(modified|softness|sharp|quality)/i.test(k));
  let up;
  for (const k of upKeys) { up = upscalerText(o[k]); if (up) { up.src = `${k}=${o[k]}`; break; } }
  const upRaw = up ? undefined : rawOf(o, Object.keys(o).filter(k => /^upscal/i.test(k) && !/(modified|softness|sharp)/i.test(k) && /(mode|method|type|fsr)$/i.test(k)));
  // Kare üretimi: FrameGeneration…Enabled=True/False ya da FrameGeneration=(Mode=Off,…). DLSS/XeSS anahtarları AMD'de etkisizdir
  // ama hangisi açıksa kare üretimi açıktır.
  let fg;
  for (const [k, v] of Object.entries(o)) {
    if (!/framegen/i.test(k) || /(num|count|interp|frames)/i.test(k)) continue;
    let b = bool(v);
    const mm = /\bMode=([^,)]+)/i.exec(v);
    if (b === undefined && mm) b = !/^"?(off|none|disabled)"?$/i.test(mm[1].trim());
    if (b === undefined && /^\d+$/.test(v)) b = +v !== 0 ? undefined : false;
    if (b === true) { fg = true; break; }
    if (b === false && fg === undefined) fg = false;
  }
  let latency;
  for (const [k, v] of Object.entries(o)) if (/antilag/i.test(k)) { const b = bool(v); if (b !== undefined) { latency = b; break; } }
  return clean({
    kind: 'unreal',
    v: {
      res: resOf(num(o.ResolutionSizeX), num(o.ResolutionSizeY)),
      display: fm !== undefined ? UE_MODE[fm] : undefined,
      vsync: bool(o.bUseVSync),
      cap: lim !== undefined && lim >= 0 ? Math.round(lim) : undefined,
      hdr: bool(o.bUseHDRDisplayOutput),
      up, fg, latency,
    },
    raw: { up: upRaw },
  });
}

// ---------- Oyun → dosya ----------
function env(paths = {}) {
  const home = os.homedir();
  return {
    documents: paths.documents || path.join(home, 'Documents'),
    localAppData: paths.localAppData || process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'),
  };
}
const exeNames = probe => (probe && probe.exes ? probe.exes.map(e => path.basename(e).toLowerCase()) : []);
function newest(files) {
  let best = null;
  for (const f of files) { try { const st = fs.statSync(f); if (st.isFile() && (!best || st.mtimeMs > best.at)) best = { file: f, at: st.mtimeMs }; } catch { /* yok */ } }
  return best;
}

// Unreal oyununun ayar klasörü adı: oyunun exe adı (…-Win64-Shipping olmadan) ya da Binaries klasörünün üstündeki proje klasörü.
function unrealNames(probe) {
  const out = new Set();
  for (const rel of (probe && probe.exes) || []) {
    const parts = rel.split(/[\\/]/);
    const base = parts[parts.length - 1].replace(/\.exe$/i, '');
    const bi = parts.findIndex(p => /^binaries$/i.test(p));
    if (/-(win64|wingdk)-shipping$/i.test(base)) out.add(base.replace(/-(win64|wingdk)-shipping$/i, ''));
    else if (bi >= 0) out.add(base);
    if (bi > 0 && !/^engine$/i.test(parts[bi - 1])) out.add(parts[bi - 1]);
  }
  return [...out].filter(n => n && !/[\\/:*?"<>|]/.test(n)).slice(0, 6);
}

// Oyunun ayar dosyasını bulur: { kind, file, at } ya da null.
function locate(game, probe, e) {
  const exes = exeNames(probe);
  const appid = String(game.appid || '');
  if (appid === '292030' || exes.includes('witcher3.exe')) {
    const d = path.join(e.documents, 'The Witcher 3');
    const f = newest([path.join(d, 'dx12user.settings'), path.join(d, 'user.settings')]);
    return f && { kind: 'witcher3', ...f };
  }
  if (appid === '1174180' || exes.includes('rdr2.exe')) {
    const f = newest([path.join(e.documents, 'Rockstar Games', 'Red Dead Redemption 2', 'Settings', 'system.xml')]);
    return f && { kind: 'rdr2', ...f };
  }
  const isUe = (probe && /unreal/i.test(probe.engine || '')) || exes.some(x => /-(win64|wingdk)-shipping\.exe$/.test(x));
  if (isUe) {
    const files = [];
    for (const n of unrealNames(probe)) {
      for (const root of [e.localAppData, path.join(e.documents, 'My Games')]) {
        for (const plat of ['Windows', 'WindowsNoEditor', 'WinGDK']) files.push(path.join(root, n, 'Saved', 'Config', plat, 'GameUserSettings.ini'));
      }
    }
    const f = newest(files);
    return f && { kind: 'unreal', ...f };
  }
  return null;
}

const PARSERS = { witcher3: parseWitcher3, rdr2: parseRdr2, unreal: parseUnreal };

// Tek oyun. prev: önceki sonuç; dosya değişmediyse yeniden çözülmez.
function readGameConfig(game, probe, e, prev) {
  if (process.platform !== 'win32' && !e.force) return null;
  const loc = locate(game, probe, e);
  if (!loc) return null;
  if (prev && prev.file === loc.file && prev.at === loc.at) return prev;
  try {
    const text = fs.readFileSync(loc.file, 'utf8').replace(/^﻿/, '');
    const r = PARSERS[loc.kind](text);
    return { ...r, file: loc.file, at: loc.at };
  } catch (err) {
    return { kind: loc.kind, file: loc.file, at: loc.at, error: err.message, v: {}, raw: {} };
  }
}

// Bütün oyunlar: { oyunId: sonuç }.
function readAll(games, probes, paths, prev = {}) {
  const e = env(paths);
  const out = {};
  for (const g of games) {
    if (!g.installDir) continue;
    const r = readGameConfig(g, probes[g.id], e, prev[g.id]);
    if (r) out[g.id] = r;
  }
  return out;
}

module.exports = { readAll, readGameConfig, locate, env, unrealNames, upscalerText, parseWitcher3, parseRdr2, parseUnreal, iniParse };
