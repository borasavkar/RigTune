'use strict';
// Oyun klasörü incelemesi: hangi ölçekleyici, kare üretimi ve gecikme kütüphaneleri dosya olarak var,
// hangi motor ve hile koruması kullanılıyor. Dosya sürümleri PE kaynak bölümünden okunur (her platformda çalışır).
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const FILES = {
  'nvngx_dlss.dll': { dlss: true, ver: 'dlss' },
  'nvngx_dlssg.dll': { dlssFG: true, ver: 'dlssFG' },
  'nvngx_dlssd.dll': { dlssRR: true },
  'sl.dlss.dll': { dlss: true, streamline: true },
  'sl.dlss_g.dll': { dlssFG: true, streamline: true },
  'sl.dlss_d.dll': { dlssRR: true },
  'sl.reflex.dll': { reflex: true },
  'sl.pcl.dll': { reflex: true },
  'nvlowlatencyvk.dll': { reflex: true },
  'amd_fidelityfx_dx12.dll': { fsr: 'fsr31', ver: 'fsr' },
  'amd_fidelityfx_vk.dll': { fsr: 'fsr31', ver: 'fsr' },
  'amd_fidelityfx_loader_dx12.dll': { fsr: 'fsr31', ffxSdk2: true, ver: 'fsr' },
  'amd_fidelityfx_upscaler_dx12.dll': { fsr: 'fsr31', ffxSdk2: true },
  'amd_fidelityfx_framegeneration_dx12.dll': { fsrFG: true, ffxSdk2: true },
  'ffx_fsr2_api_x64.dll': { fsr: 'fsr2' },
  'ffx_fsr2_api_dx12_x64.dll': { fsr: 'fsr2' },
  'ffx_fsr2_api_vk_x64.dll': { fsr: 'fsr2' },
  'ffx_fsr2_api_dx11_x64.dll': { fsr: 'fsr2' },
  'ffx_fsr3_x64.dll': { fsr: 'fsr3' },
  'ffx_fsr3upscaler_x64.dll': { fsr: 'fsr3' },
  'ffx_frameinterpolation_x64.dll': { fsr: 'fsr3', fsrFG: true },
  'ffx_opticalflow_x64.dll': { fsrFG: true },
  'libxess.dll': { xess: true, ver: 'xess' },
  'libxess_dx11.dll': { xess: true },
  'libxess_fg.dll': { xessFG: true },
  'libxell.dll': { xell: true },
  'unityplayer.dll': { engine: 'Unity', ver: 'unity' },
  'gameassembly.dll': { engine: 'Unity' },
  'beservice_x64.exe': { ac: 'BattlEye' },
  'beclient_x64.dll': { ac: 'BattlEye' },
  'easyanticheat_x64.dll': { ac: 'Easy Anti-Cheat' },
  'easyanticheat_eos_setup.exe': { ac: 'Easy Anti-Cheat' },
  'eaanticheat.gameservicelauncher.exe': { ac: 'EA Javelin' },
  'mhyprot2.sys': { ac: 'mhyprot' },
  'xigncode.dll': { ac: 'XIGNCODE3' },
  're_chunk_000.pak': { engine: 'RE Engine' },
  'x64a.rpf': { engine: 'RAGE' },
  'common.rpf': { engine: 'RAGE' },
  'talewords.mountandblade.dll': { engine: 'TaleWorlds' },
};
const DIRS = {
  easyanticheat: { ac: 'Easy Anti-Cheat' },
  battleye: { ac: 'BattlEye' },
  gameguard: { ac: 'nProtect GameGuard' },
  jomini: { engine: 'Clausewitz / Jomini' },
  clausewitz: { engine: 'Clausewitz / Jomini' },
};
const EXT = [
  [/\.forge$/i, { engine: 'Anvil' }],
  [/\.vpk$/i, { engine: 'Source' }],
  [/\.ba2$/i, { engine: 'Creation Engine' }],
  [/\.pck$/i, { engine: 'Godot' }],
  [/-win64-shipping\.exe$/i, { engine: 'Unreal Engine', ver: 'unreal' }],
  [/-wingdk-shipping\.exe$/i, { engine: 'Unreal Engine', ver: 'unreal' }],
];
const SKIP = /^(__installer|_commonredist|redist|directx|vcredist|movies|videos|shadercache|crashreport|logs|saves?|screenshots|\$recycle\.bin)$/i;
// Oyunun kendisi olmayan exe dosyaları (kurulum, kaldırma, hata bildirimi, hile koruması servisi). Açık oyunu süreç adından
// tanımak için toplanan exe listesine girmez.
const NOT_GAME_EXE = /^(unins\d*|uninstall\w*|setup\w*|install\w*|vc_?redist\S*|dxsetup|dxwebsetup|crashreport\w*|crashpad_handler|crashsender\w*|unitycrashhandler(32|64)?|easyanticheat\S*|beservice\S*|eaanticheat\S*|ue4prereqsetup\S*|ueprereqsetup\S*|dotnet\S*|touchup|cleanup|quicksfv|cefsharp\S*|unrealcefsubprocess|epiconlineservices\S*)\.exe$/i;
// Önbellekteki eski incelemeler bu sürümden eskiyse oyun yeniden incelenir (2: exe listesi eklendi).
const PROBE_V = 2;

// PE dosyasının kaynak bölümünden VS_FIXEDFILEINFO okur.
async function peVersion(file) {
  let fh;
  try {
    fh = await fsp.open(file, 'r');
    const head = Buffer.alloc(4096);
    await fh.read(head, 0, 4096, 0);
    if (head.readUInt16LE(0) !== 0x5a4d) return null;
    const pe = head.readUInt32LE(0x3c);
    if (pe + 24 > head.length || head.readUInt32LE(pe) !== 0x4550) return null;
    const nsec = head.readUInt16LE(pe + 6), optSize = head.readUInt16LE(pe + 20);
    let sec = pe + 24 + optSize;
    for (let s = 0; s < nsec && sec + 40 <= head.length; s++, sec += 40) {
      const name = head.toString('latin1', sec, sec + 8).replace(/\0+$/, '');
      if (name !== '.rsrc') continue;
      const rawSize = Math.min(head.readUInt32LE(sec + 16), 16 << 20), rawPtr = head.readUInt32LE(sec + 20);
      const buf = Buffer.alloc(rawSize);
      await fh.read(buf, 0, rawSize, rawPtr);
      const i = buf.indexOf(Buffer.from([0xbd, 0x04, 0xef, 0xfe]));
      if (i < 0 || i + 24 > buf.length) return null;
      const f = (ms, ls) => `${ms >>> 16}.${ms & 0xffff}.${ls >>> 16}.${ls & 0xffff}`;
      return { file: f(buf.readUInt32LE(i + 8), buf.readUInt32LE(i + 12)), product: f(buf.readUInt32LE(i + 16), buf.readUInt32LE(i + 20)) };
    }
    return null;
  } catch { return null; } finally { if (fh) await fh.close().catch(() => {}); }
}

function apply(res, sig, full, versions) {
  for (const [k, v] of Object.entries(sig)) {
    if (k === 'ver') { if (!versions[v]) versions[v] = full; continue; }
    if (k === 'ac') { if (!res.antiCheat.includes(v)) res.antiCheat.push(v); continue; }
    if (k === 'engine') { if (!res.engine) res.engine = v; continue; }
    if (k === 'fsr') { const order = ['fsr2', 'fsr3', 'fsr31']; if (!res.fsr || order.indexOf(v) > order.indexOf(res.fsr)) res.fsr = v; continue; }
    res[k] = v;
  }
}

async function probeGame(dir, { maxEntries = 60000, maxDepth = 7 } = {}) {
  const res = { antiCheat: [], engine: null, fsr: null, scanned: 0, truncated: false, files: [], exes: [] };
  const versions = {};
  const stack = [[dir, 0]];
  let unrealMarker = false;
  while (stack.length) {
    const [d, depth] = stack.pop();
    let ents;
    try { ents = await fsp.readdir(d, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      if (++res.scanned > maxEntries) { res.truncated = true; break; }
      const low = e.name.toLowerCase();
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (DIRS[low]) apply(res, DIRS[low], full, versions);
        // Başka motorlarda da "Engine" klasörü olabilir; Unreal için içinde Binaries/Plugins aranır.
        if (low === 'engine' && depth <= 1 && ['Binaries', 'Plugins'].some(s => fs.existsSync(path.join(full, s)))) unrealMarker = true;
        if (low === 'paks' && /content$/i.test(d)) unrealMarker = true;
        if (depth < maxDepth && !SKIP.test(low)) stack.push([full, depth + 1]);
        continue;
      }
      if (low.endsWith('.exe') && depth <= 5 && res.exes.length < 40 && !NOT_GAME_EXE.test(low)) res.exes.push(path.relative(dir, full));
      const sig = FILES[low];
      if (sig) { apply(res, sig, full, versions); res.files.push(path.relative(dir, full)); continue; }
      for (const [re, s] of EXT) if (re.test(low)) { apply(res, s, full, versions); break; }
    }
    if (res.truncated) break;
  }
  if (!res.engine && unrealMarker) res.engine = 'Unreal Engine';
  // Sürümler
  const v = {};
  for (const [k, f] of Object.entries(versions)) { const pv = await peVersion(f); if (pv) v[k] = pv; }
  if (v.dlss) res.dlssVersion = v.dlss.file;
  if (v.dlssFG) res.dlssFGVersion = v.dlssFG.file;
  if (v.xess) res.xessVersion = v.xess.file;
  if (v.fsr) res.fsrFileVersion = v.fsr.file;
  if (v.unity) { const m = /^(\d{4})\.(\d+)/.exec(v.unity.file); if (m) res.engine = `Unity ${m[1]}.${m[2]}`; }
  if (v.unreal) {
    const m = /^([45])\.(\d+)\./.exec(v.unreal.product) || /^([45])\.(\d+)\./.exec(v.unreal.file);
    if (m) res.engine = `Unreal Engine ${m[1]}.${m[2]}`;
  }
  if (res.xessVersion) { const m = /^(\d+)\.(\d+)/.exec(res.xessVersion); if (m) res.xessMajor = +m[1]; }
  if (res.dlssVersion) { const m = /^(\d+)\./.exec(res.dlssVersion); if (m) res.dlssGen = +m[1] >= 310 ? 4 : +m[1]; }
  res.files = res.files.slice(0, 40);
  res.at = Date.now();
  return res;
}

// Birden çok oyunu sınırlı eşzamanlılıkla inceler; sonuçları önbellekten kullanır.
async function probeAll(games, cache, { concurrency = 3, maxAgeMs = 14 * 864e5, onProgress } = {}) {
  const todo = [];
  const out = {};
  for (const g of games) {
    if (!g.accessible || !g.installDir) continue;
    let mtime = 0;
    try { mtime = fs.statSync(g.installDir).mtimeMs; } catch { /* yok */ }
    const key = [g.installDir, g.buildId || g.version || '', Math.round(mtime), PROBE_V].join('|');
    const c = cache[g.id];
    if (c && c.key === key && Date.now() - c.at < maxAgeMs) { out[g.id] = c; continue; }
    todo.push({ g, key });
  }
  let done = 0;
  const worker = async () => {
    while (todo.length) {
      const { g, key } = todo.shift();
      try { out[g.id] = { ...(await probeGame(g.installDir)), key }; } catch (e) { out[g.id] = { error: e.message, key, at: Date.now() }; }
      done++;
      if (onProgress) onProgress(done, done + todo.length, g.name);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

module.exports = { probeGame, probeAll, peVersion };
