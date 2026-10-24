'use strict';
// Sistem algılama: platforma göre ham veriyi toplar, ortak bir biçime çevirir.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec, runPowerShell, readText, isDir } = require('../util');
const { parseEdid } = require('./edid');
const { readAmdSettings } = require('./amd-settings');
const gpudb = require('../gpudb');
const cpudb = require('../cpudb');

const TECH ={ 0: 'VGA', 4: 'DVI', 5: 'HDMI', 6: 'LVDS', 10: 'DisplayPort', 11: 'eDP', 13: 'UDI', 15: 'Miracast', 16: 'wireless', 2147483648: 'internal' }; // eDP, UDI, wireless, internal arayüzde çevrilir

// ---------- Windows ----------
async function rawWindows() {
  const dir = __dirname.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
  const [sys, hints] = await Promise.all([
    runPowerShell(path.join(dir, 'windows-system.ps1'), { timeout: 90000 }),
    runPowerShell(path.join(dir, 'windows-libs.ps1'), { timeout: 90000 }).catch(() => ({})),
  ]);
  return { sys, hints };
}

function nvidiaDriver(v) {
  // 32.0.15.8129 → 581.29
  const d = String(v || '').replace(/\./g, '');
  if (d.length < 5) return null;
  const t = d.slice(-5);
  return `${t.slice(0, 3)}.${t.slice(3)}`;
}

function appsFromUninstall(un) {
  const find = re => { const e = (un || []).find(u => re.test(u.n || '')); return e ? { name: e.n, version: e.v || null } : null; };
  return {
    amd: find(/^AMD Software/i),
    nvidiaApp: find(/^NVIDIA App\b/i),
    geforceExperience: find(/GeForce Experience/i),
    nvidiaDriver: find(/^NVIDIA Graphics Driver/i),
    intelSoftware: find(/Intel.*Graphics Software/i),
    intelArcControl: find(/Intel.*Arc Control/i),
    intelDriver: find(/^Intel.*Graphics Driver/i),
    rtss: find(/RivaTuner Statistics Server/i),
    afterburner: find(/MSI Afterburner/i),
    launchers: ['Steam', 'Epic Games Launcher', 'Ubisoft Connect', 'EA app', 'Battle.net', 'GOG GALAXY', 'Playnite', 'Rockstar Games Launcher', 'Xbox']
      .map(n => find(new RegExp('^' + n.replace(/\./g, '\\.'), 'i'))).filter(Boolean),
  };
}

function ramInfo(mods) {
  mods = mods || [];
  const total = mods.reduce((s, m) => s + (+m.size || 0), 0);
  const configured = Math.min(...mods.map(m => +m.configured || +m.speed || 0).filter(Boolean)) || null;
  // Parça numarasından etiket hızı (EXPO/XMP) tahmini: F5-6000J..., KF560C30, CMK32GX5M2B6000C36, AX5U6000C30...
  let rated = null;
  for (const m of mods) {
    const p = m.part || '';
    let r = null;
    const k = /KF5(\d{2})C/i.exec(p);
    if (k) r = +k[1] * 100;
    else { const all = p.match(/(?<!\d)(4[48]00|5[0-9]00|6[0-9]00|7[0-9]00|8[0-4]00)(?!\d)/g); if (all) r = Math.max(...all.map(Number)); }
    if (r) rated = Math.max(rated || 0, r);
  }
  const type = mods[0] && mods[0].type === 34 ? 'DDR5' : mods[0] && mods[0].type === 26 ? 'DDR4' : null;
  return { totalGB: Math.round(total / 2 ** 30), configured, rated, type, modules: mods.length, maker: mods[0] && mods[0].maker, part: mods[0] && mods[0].part };
}

// İşlemci: algılanan ham bilgi + veritabanındaki mimari sınıfı (cpudb.js).
function cpuInfo(raw) {
  raw = raw || {};
  const info = cpudb.lookup(raw.name);
  return { ...raw, l3MB: raw.l3KB ? Math.round(raw.l3KB / 1024) : null, short: info.short, vendor: info.vendor, arch: info.arch, archKey: info.archKey, year: info.year, x3d: info.x3d, known: info.known };
}

// Disklerin ortak biçimi: { disks: [{ name, bus, kind, size }], volumes: [{ mount, letter, label, size, free, system, removable, disk, kind, bus }] }
// kind: 'nvme' | 'ssd' | 'hdd' | null (bilinmiyor). Boyutlar bayt.
const BUS = { 1: 'SCSI', 3: 'ATA', 6: 'Fibre Channel', 7: 'USB', 8: 'RAID', 9: 'iSCSI', 10: 'SAS', 11: 'SATA', 12: 'SD', 13: 'MMC', 14: 'Virtual', 15: 'Virtual', 16: 'Storage Spaces', 17: 'NVMe', 18: 'SCM', 19: 'UFS' };
// NVMe bağlantılı disk SSD'dir; diğerlerinde Windows'un bildirdiği MediaType (3 HDD, 4 SSD, 5 SCM) kullanılır.
function diskKind(media, bus) {
  if (bus === 17) return 'nvme';
  if (media === 4 || media === 5) return 'ssd';
  if (media === 3) return 'hdd';
  return null;
}

function storageFromWin(st) {
  if (!st) return null;
  const disks = (st.disks || []).map(d => ({ n: d.n, name: d.name || null, bus: BUS[d.bus] || null, kind: diskKind(d.media, d.bus), size: d.size || null }));
  const sys = String(st.systemDrive || 'C:').charAt(0).toUpperCase();
  // MSFT_Volume.DriveType: 2 çıkarılabilir, 3 sabit, 4 ağ, 5 CD/DVD. Optik sürücüler ve boyutu olmayan birimler atlanır.
  const volumes = (st.volumes || []).filter(v => v.letter && v.size > 0 && v.type !== 5).map(v => {
    const nums = (st.partitions || []).filter(p => p.letter === v.letter).map(p => p.disk);
    const own = disks.filter(d => nums.includes(d.n));
    const d = own.length === 1 ? own[0] : null; // birden çok diske yayılan birimde disk türü belirsiz
    return { mount: v.letter + ':\\', letter: v.letter, label: v.label || '', size: v.size, free: v.free, system: v.letter === sys, removable: v.type === 2, disk: d && d.name, kind: d ? d.kind : null, bus: d ? d.bus : null };
  }).sort((a, b) => a.letter.localeCompare(b.letter));
  return { disks: disks.map(({ n, ...d }) => d), volumes };
}

// macOS ve Linux: bağlama noktaları ve boş alan. Linux'ta disk türü /sys/class/block/<aygıt>/queue/rotational dosyasından
// (1 dönen disk); macOS'ta tür okunmaz. Bu iki platformda denenmedi.
function storageGeneric() {
  if (typeof fs.statfsSync !== 'function') return null;
  const mounts = [];
  if (process.platform === 'linux') {
    for (const line of (readText('/proc/mounts') || '').split('\n')) {
      const [dev, mnt] = line.split(' ');
      if (!dev || !dev.startsWith('/dev/') || dev.startsWith('/dev/loop') || !mnt || /^\/(boot|snap)(\/|$)/.test(mnt)) continue;
      mounts.push({ dev, mount: mnt.replace(/\\040/g, ' ') });
    }
  } else {
    mounts.push({ mount: '/' });
    try { for (const n of fs.readdirSync('/Volumes')) mounts.push({ mount: path.join('/Volumes', n) }); } catch { /* yok */ }
  }
  const rotational = dev => {
    try {
      const name = path.basename(fs.realpathSync(dev));
      let dir = fs.realpathSync(path.join('/sys/class/block', name));
      const slaves = path.join(dir, 'slaves');
      if (isDir(slaves)) { const s = fs.readdirSync(slaves)[0]; if (s) dir = fs.realpathSync(path.join(slaves, s)); }
      const r = readText(path.join(dir, 'queue', 'rotational')) || readText(path.join(path.dirname(dir), 'queue', 'rotational'));
      if (r == null) return null;
      return r.trim() === '1' ? 'hdd' : /nvme/.test(dir) ? 'nvme' : 'ssd';
    } catch { return null; }
  };
  const seen = new Set(), volumes = [];
  for (const m of mounts) {
    let real = m.mount;
    try { real = fs.realpathSync(m.mount); } catch { continue; }
    if (seen.has(real) || (m.dev && seen.has(m.dev))) continue;
    seen.add(real); if (m.dev) seen.add(m.dev);
    let s;
    try { s = fs.statfsSync(m.mount); } catch { continue; }
    const kind = m.dev ? rotational(m.dev) : null;
    volumes.push({ mount: m.mount, letter: null, label: m.mount === '/' ? '/' : path.basename(m.mount), size: s.blocks * s.bsize, free: s.bavail * s.bsize, system: m.mount === '/', removable: false, disk: m.dev ? path.basename(m.dev) : null, kind, bus: kind === 'nvme' ? 'NVMe' : null });
  }
  return { disks: [], volumes: volumes.filter(v => v.size > 0) };
}

function displayFromWin(d) {
  const e = parseEdid(d.edid);
  const modes = (d.modes || []).map(s => { const m = /^(\d+)x(\d+)@(\d+)$/.exec(s); return m ? { w: +m[1], h: +m[2], hz: +m[3] } : null; }).filter(Boolean);
  const native = (e && e.native) || (d.maxW ? { w: d.maxW, h: d.maxH } : { w: d.w, h: d.h });
  const atNative = modes.filter(m => m.w === native.w && m.h === native.h).map(m => m.hz);
  const maxHz = Math.max(atNative.length ? Math.max(...atNative) : 0, d.maxHzAtCurrent || 0) || d.curHz;
  const id = e ? `${e.manufacturerId}${e.productCode}-${e.serialText || e.serialNumber}` : (d.instance || d.gdi);
  return {
    id,
    name: (e && e.name) || d.friendly || 'Monitör',
    manufacturer: e ? e.manufacturer : null,
    year: e ? e.year : null,
    sizeInch: e && e.sizeCm ? Math.round(Math.hypot(e.sizeCm.w, e.sizeCm.h) / 2.54) : null,
    connection: TECH[d.tech] || (e && e.interface) || null,
    adapter: d.adapter || null,
    gdi: d.gdi,
    primary: !!d.primary,
    current: { w: d.w, h: d.h, hz: d.hz ? Math.round(d.hz * 100) / 100 : d.curHz },
    native,
    maxHz,
    vrr: e ? e.vrr : null,
    hdr: { supported: !!d.hdrSupported || !!(e && e.hdr && e.hdr.pq), enabled: !!d.hdrEnabled, peakNits: e && e.hdr ? e.hdr.maxNits : null, osReported: d.hdrApi > 0 },
    bitDepth: d.bpc || (e && e.bitDepth) || null,
    edid: !!e,
  };
}

async function detectWindows() {
  const { sys, hints } = await rawWindows();
  const gpus = (sys.gpus || []).map(g => {
    const info = gpudb.lookup(g.name || '', g.pnp, g.vram || g.adapterRam);
    let driverDisplay = g.driverVersion;
    if (info.vendor === 'nvidia') driverDisplay = nvidiaDriver(g.driverVersion) || g.driverVersion;
    return {
      id: (g.pnp || g.name || '').split('\\').slice(0, 2).join('\\'),
      name: g.name, vendor: info.vendor, arch: info.arch, archKey: info.archKey, score: info.score, known: info.known, features: info.features, virtual: info.virtual,
      vramGB: g.vram ? Math.round(g.vram / 2 ** 30) : (g.adapterRam && g.adapterRam > 0 ? Math.round(g.adapterRam / 2 ** 30) : null),
      driver: { version: g.driverVersion, display: driverDisplay, date: g.driverDate, amdPackage: g.amdSoftwareVersion || null, amdRelease: g.amdRelease || null },
      current: g.curW ? { w: g.curW, h: g.curH, hz: g.curHz } : null,
      classKey: g.classKey || null,
    };
  });
  // AMD kartı varsa Adrenalin'in kayıtlı ayarları (yalnızca okuma)
  const amdGpu = gpus.filter(g => g.vendor === 'amd' && !g.virtual).sort((a, b) => b.score - a.score)[0];
  const amdSettings = amdGpu ? await readAmdSettings(amdGpu.classKey).catch(e => ({ ok: false, errors: [e.message] })) : null;
  const ws = sys.winSettings || {};
  const dx = String(ws.dxUser || '');
  const dxv = k => { const m = new RegExp(k + '=(\\d)').exec(dx); return m ? m[1] === '1' : null; };
  return {
    platform: 'win32',
    os: sys.os ? { name: sys.os.name, version: sys.os.version, build: sys.os.build, ubr: sys.os.ubr, displayVersion: sys.os.displayVersion, computer: sys.os.computer } : { name: 'Windows' },
    cpu: cpuInfo(sys.cpu || { name: os.cpus()[0] && os.cpus()[0].model }),
    ram: ramInfo(sys.ram && sys.ram.modules),
    storage: storageFromWin(sys.storage),
    gpus,
    displays: (sys.displays || []).map(displayFromWin),
    apps: appsFromUninstall(sys.uninstall),
    winSettings: {
      hags: ws.hags == null ? null : ws.hags === 2,
      gameMode: ws.gameMode == null ? true : ws.gameMode === 1,
      windowedOptimizations: dxv('SwapEffectUpgradeEnable'),
      vrrOptimizations: dxv('VRROptimizeEnable'),
      autoHdr: dxv('AutoHDREnable'),
      backgroundRecording: ws.historicalCapture === 1,
      gameBarCapture: ws.appCapture === 1,
      powerPlan: ws.powerPlan || null,
    },
    nvidiaSmi: sys.nvidiaSmi || null,
    amdSettings,
    errors: sys.errors || [],
    _uninstall: sys.uninstall || [],
    _hints: hints || {},
    // Oyunların ayar dosyaları için Belgeler ve Yerel Uygulama Verileri klasörleri (core/gamecfg.js)
    _paths: sys.paths || {},
  };
}

// ---------- macOS ----------
async function detectMac() {
  const r = await exec('system_profiler', ['SPDisplaysDataType', 'SPHardwareDataType', 'SPSoftwareDataType', '-json'], { timeout: 60000 });
  let j = {};
  try { j = JSON.parse(r.stdout); } catch { /* boş */ }
  const hw = (j.SPHardwareDataType || [])[0] || {};
  const sw = (j.SPSoftwareDataType || [])[0] || {};
  const gpus = [], displays = [];
  for (const g of j.SPDisplaysDataType || []) {
    const name = g.sppci_model || g._name || 'GPU';
    const info = gpudb.lookup(name, '', null);
    gpus.push({ id: name, name, vendor: info.vendor, arch: info.arch, archKey: info.archKey, score: info.score, known: info.known, features: info.features, virtual: false, vramGB: null, driver: { version: sw.os_version || null, display: 'macOS' } });
    for (const d of g.spdisplays_ndrvs || []) {
      const res = /(\d+)\s*x\s*(\d+)(?:.*?@\s*([\d.]+)\s*Hz)?/i.exec(d._spdisplays_resolution || d.spdisplays_resolution || '') || [];
      const px = /(\d+)\s*x\s*(\d+)/.exec(d._spdisplays_pixels || '') || res;
      const hz = res[3] ? Math.round(+res[3]) : 60;
      displays.push({
        id: d._name + (d._spdisplays_display_serial_number || ''), name: d._name, manufacturer: null, connection: /internal/i.test(d.spdisplays_connection_type || '') ? 'internal' : null,
        adapter: name, primary: d.spdisplays_main === 'spdisplays_yes', current: { w: +px[1] || 0, h: +px[2] || 0, hz }, native: { w: +px[1] || 0, h: +px[2] || 0 }, maxHz: hz,
        vrr: /ProMotion/i.test(JSON.stringify(d)) ? { kind: 'ProMotion', min: 24, max: 120, sure: true } : null,
        hdr: { supported: /XDR|HDR/i.test(JSON.stringify(d)), enabled: false, peakNits: null }, edid: false,
      });
    }
  }
  return {
    platform: 'darwin', os: { name: sw.os_version || 'macOS' }, cpu: cpuInfo({ name: hw.chip_type || hw.cpu_type || (os.cpus()[0] || {}).model, threads: os.cpus().length }),
    ram: { totalGB: Math.round(os.totalmem() / 2 ** 30) }, storage: storageGeneric(), gpus, displays, apps: {}, winSettings: null, errors: [], _uninstall: [], _hints: {},
  };
}

// ---------- Linux ----------
async function detectLinux() {
  const gpus = [], displays = [];
  const drm = '/sys/class/drm';
  let cards = [];
  try { cards = fs.readdirSync(drm).filter(n => /^card\d+$/.test(n)); } catch { /* yok */ }
  for (const c of cards) {
    const dev = path.join(drm, c, 'device');
    const vendor = (readText(path.join(dev, 'vendor')) || '').trim().replace('0x', '');
    let driver = null;
    try { driver = path.basename(fs.realpathSync(path.join(dev, 'driver'))); } catch { /* yok */ }
    let slot = null;
    try { slot = path.basename(fs.realpathSync(dev)); } catch { /* yok */ }
    let name = null;
    if (slot) { const l = await exec('lspci', ['-mm', '-s', slot]); const m = l.stdout.match(/"([^"]*)"/g); if (m && m.length >= 3) name = `${m[1].replace(/"/g, '')} ${m[2].replace(/"/g, '')}`; }
    const vram = +(readText(path.join(dev, 'mem_info_vram_total')) || 0);
    let drvVer = null;
    if (driver === 'nvidia') drvVer = ((readText('/proc/driver/nvidia/version') || '').match(/Kernel Module\s+([\d.]+)/) || [])[1] || null;
    else { const g = await exec('glxinfo', ['-B']); drvVer = (g.stdout.match(/Mesa\s+([\d.]+)/) || [])[1] ? 'Mesa ' + g.stdout.match(/Mesa\s+([\d.]+)/)[1] : null; }
    const info = gpudb.lookup(name || '', `VEN_${vendor}`, vram);
    gpus.push({ id: slot || c, name: name || `${info.vendor.toUpperCase()} GPU`, vendor: info.vendor, arch: info.arch, archKey: info.archKey, score: info.score, known: info.known, features: info.features, virtual: false, vramGB: vram ? Math.round(vram / 2 ** 30) : null, driver: { version: drvVer, display: [driver, drvVer].filter(Boolean).join(' · ') } });
  }
  let xr = '';
  if (process.env.DISPLAY) xr = (await exec('xrandr', ['--current'])).stdout;
  try {
    for (const n of fs.readdirSync(drm).filter(x => /^card\d+-/.test(x))) {
      if ((readText(path.join(drm, n, 'status')) || '').trim() !== 'connected') continue;
      let e = null;
      try { e = parseEdid(fs.readFileSync(path.join(drm, n, 'edid'))); } catch { /* yok */ }
      const conn = n.replace(/^card\d+-/, '');
      const re = new RegExp('^' + conn.replace(/-/g, '-?') + '\\s+connected(\\s+primary)?\\s+(\\d+)x(\\d+)', 'm');
      const m = re.exec(xr);
      const curHz = m ? (() => { const block = xr.slice(m.index).split('\n').slice(1).find(l => l.includes('*')); const h = block && block.match(/([\d.]+)\*/); return h ? Math.round(+h[1]) : null; })() : null;
      displays.push({
        id: e ? `${e.manufacturerId}${e.productCode}-${e.serialText || e.serialNumber}` : n, name: (e && e.name) || conn, manufacturer: e && e.manufacturer, connection: conn.split('-')[0], adapter: gpus[0] && gpus[0].name,
        primary: m ? !!m[1] : displays.length === 0, current: m ? { w: +m[2], h: +m[3], hz: curHz || (e && e.maxHzTimings) || 60 } : { w: e && e.native ? e.native.w : 0, h: e && e.native ? e.native.h : 0, hz: (e && e.maxHzTimings) || 60 },
        native: (e && e.native) || null, maxHz: Math.max((e && e.maxHzTimings) || 0, (e && e.vrr && e.vrr.max) || 0) || 60, vrr: e && e.vrr, hdr: { supported: !!(e && e.hdr && e.hdr.pq), enabled: false, peakNits: e && e.hdr ? e.hdr.maxNits : null }, edid: !!e,
      });
    }
  } catch { /* yok */ }
  const osr = readText('/etc/os-release') || '';
  return {
    platform: 'linux', os: { name: ((osr.match(/^PRETTY_NAME="?([^"\n]*)/m) || [])[1]) || 'Linux', version: os.release() }, cpu: cpuInfo({ name: (os.cpus()[0] || {}).model, threads: os.cpus().length }),
    ram: { totalGB: Math.round(os.totalmem() / 2 ** 30) }, storage: storageGeneric(), gpus, displays, apps: {}, winSettings: null, errors: [], _uninstall: [], _hints: {},
  };
}

async function detectSystem() {
  if (process.platform === 'win32') return detectWindows();
  if (process.platform === 'darwin') return detectMac();
  return detectLinux();
}

// Oyun için kullanılacak ekran kartı ve monitör: ayarda seçilmişse o, yoksa en güçlü kart ve en hızlı monitör.
function pickPrimary(sys, settings) {
  const real = sys.gpus.filter(g => !g.virtual);
  const gpu = real.find(g => settings && g.id === settings.gpuId) || real.slice().sort((a, b) => b.score - a.score)[0] || sys.gpus[0] || null;
  const ds = sys.displays.slice();
  const display = ds.find(d => settings && d.id === settings.displayId)
    || ds.filter(d => !gpu || !d.adapter || d.adapter === gpu.name).sort((a, b) => (b.maxHz - a.maxHz) || (b.primary - a.primary) || (b.native ? b.native.w * b.native.h : 0) - (a.native ? a.native.w * a.native.h : 0))[0]
    || ds[0] || null;
  return { gpu, display };
}

module.exports = { detectSystem, pickPrimary, nvidiaDriver, ramInfo, cpuInfo, storageFromWin, readAmdSettings };
