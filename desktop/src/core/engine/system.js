'use strict';
// Bir kez yapılacak ayarlar (sürücü uygulaması genel ayarları) ve sistem kontrolleri (Windows, monitör, bellek, disk).
const { capOk } = require('./common');
const { diskChecks } = require('./hardware');

function cmpVer(a, b) {
  const pa = String(a || '').split(/[^\d]+/).filter(Boolean).map(Number), pb = String(b || '').split(/[^\d]+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x < y ? -1 : 1; }
  return 0;
}

const AMD_MIN = '26.9.2';
const NV_DYN_MFG = '595.97';
const INTEL_MFG = '101.8509';

function vendorGlobal(sys, c) {
  const t = c.t;
  const F = c.F, d = c.display, gpu = c.gpu, apps = sys.apps || {};
  const S = [];
  const add = (id, k, v, cl, why) => S.push({ id, k, v, c: cl, why });
  const on = t('eng.v.on'), off = t('eng.v.off'), K = k => t('global.k.' + k);
  if (c.vendor === 'amd') {
    // Adrenalin'in kayıtlı genel ayarları okunabildiyse satırlara şu anki değer (cur) ve durum (state) eklenir; bkz. engine/amd.js.
    const G = c.amd && c.amd.global;
    const A_ON = t('amd.v.on'), A_OFF = t('amd.v.off'), OTHER = t('amd.cur.other');
    const mark = (now, ok) => {
      if (!G) return;
      const i = S[S.length - 1];
      i.scope = 'global';
      if (now == null) { i.cur = null; i.state = 'unknown'; } else { i.cur = now; i.state = ok ? 'ok' : 'change'; }
    };
    const na = () => { if (G) { S[S.length - 1].state = 'na'; S[S.length - 1].scope = 'global'; } };
    const has = k => G && G[k] !== undefined && G[k] !== null;
    // Açma/kapama değerleri Adrenalin'deki gibi Etkin/Devre dışı yazılır.
    if (d.vrr) add('freesync', 'AMD FreeSync', A_ON, 'on', t('global.amd.freesync', { min: d.vrr.min, max: d.vrr.max }));
    else add('freesync', 'AMD FreeSync', t('eng.v.monNo'), 'off', t('global.amd.freesyncNo'));
    na();
    add('sam', 'Smart Access Memory', A_ON, 'on', t('global.amd.sam') + (gpu.archKey === 'RDNA4' ? t('global.amd.samRdna4') : '.'));
    na();
    if (F.hyprRx) {
      add('hyprRx', 'HYPR-RX', t('global.amd.hyprRxV'), 'off', t('global.amd.hyprRx'));
      const e = G && G.experience;
      if (e === 'PROFILE_CUSTOM') mark(t('global.amd.expCustom'), true); else if (/HYPR/i.test(e || '')) mark('HYPR-RX', false); else mark(null);
    }
    // FPS sınırı (FRTC): Adrenalin'de yalnızca genel ayar; bütün oyunlara uygulanır.
    const capN = d.vrr ? c.hz - 3 : c.hz;
    add('frtc', K('frtc'), t('amd.cap.onV', { n: capN }), 'set', d.vrr ? t('global.amd.frtc', { n: capN }) : t('global.amd.frtcNoVrr', { n: capN }));
    mark(has('frtc') ? (G.frtc.on ? t('amd.cap.onV', { n: G.frtc.fps }) : A_OFF) : null, has('frtc') && capOk(G.frtc, capN));
    add('texFilter', K('texFilter'), t('global.amd.texFilterV'), 'set', t('global.amd.texFilter'));
    mark(has('texFilter') ? t('global.amd.texOpts')[G.texFilter] || OTHER : null, has('texFilter') && G.texFilter === 1);
    add('surfaceFmt', K('surfaceFmt'), A_ON, 'on', t('global.amd.surfaceFmt'));
    mark(has('surfaceFmt') ? (G.surfaceFmt ? A_ON : A_OFF) : null, has('surfaceFmt') && G.surfaceFmt === true);
    add('tess', K('tess'), t('global.amd.tessV'), 'set', t('global.amd.tess'));
    mark(has('tess') ? (G.tess === 0 ? t('global.amd.tessV') : OTHER) : null, has('tess') && G.tess === 0);
    add('aa', K('aa'), t('global.amd.aaV'), 'set', t('global.amd.aa'));
    if (has('aa')) mark((G.aa.mode === 1 ? t('global.amd.aaV') : OTHER) + (G.aa.mlaa ? t('global.amd.mlaaOn') : ''), G.aa.mode === 1 && !G.aa.mlaa); else mark(null);
    add('tenBit', K('tenBit'), A_OFF, 'off', t('global.amd.tenBit'));
    na();
    if (F.fsrML) {
      add('fsrOta', K('fsrOta'), t('global.amd.fsrOtaV'), 'on', t('global.amd.fsrOta'));
      mark(has('fsrOta') ? (G.fsrOta === 1 ? t('global.amd.fsrOtaV') : OTHER) : null, has('fsrOta') && G.fsrOta === 1);
    }
    const ver = apps.amd && apps.amd.version;
    const old = ver && cmpVer(ver, AMD_MIN) < 0;
    const pkg = gpu.driver && gpu.driver.amdPackage ? t('global.amd.driverPkg', { p: gpu.driver.amdPackage }) : '';
    add('driver', K('driver'), t('eng.v.orNewer', { v: AMD_MIN }), old ? 'warn' : 'set',
      (ver ? t('global.amd.driverInstalled', { v: ver, pkg }) : '') + (old ? t('global.amd.driverOld') : '') + t('global.amd.driverNotes'));
    mark(ver || null, !old);
    add('shaderCache', K('shaderCache'), t('global.amd.shaderV'), 'set', t('global.amd.shader'));
    na();
    const n = s => S.filter(i => i.state === s).length;
    return { app: 'AMD Software: Adrenalin Edition', path: t('global.amd.path'), items: S, state: G ? { scope: 'global', change: n('change'), ok: n('ok'), unknown: n('unknown') } : null };
  }
  if (c.vendor === 'nvidia') {
    if (d.vrr) add('gsync', 'G-SYNC', on, 'on', t('global.nvidia.gsync', { fs: /FreeSync|Adaptive/.test(d.vrr.kind || '') ? t('global.nvidia.gsyncFs') : '', min: d.vrr.min, max: d.vrr.max }));
    else add('gsync', 'G-SYNC', t('eng.v.monNo'), 'off', t('global.nvidia.gsyncNo'));
    if (F.dlss) add('dlssOverride', K('dlssOverride'), F.fp8 ? t('global.nvidia.dlssRecV') : t('global.nvidia.dlssKV'), 'on', t('global.nvidia.dlss'));
    add('llm', K('llm'), 'Off', 'off', t('global.nvidia.llm'));
    add('vsync', K('vsync'), d.vrr ? 'On' : 'Use 3D application setting', d.vrr ? 'on' : 'set', d.vrr ? t('global.nvidia.vsyncVrr') : t('global.nvidia.vsync'));
    add('maxFps', K('maxFps'), d.vrr ? t('eng.v.fps', { n: c.hz - 3 }) : 'Off', d.vrr ? 'set' : 'off', d.vrr ? t('global.nvidia.maxVrr') : t('global.nvidia.max'));
    add('shaderCacheSize', 'Shader Cache Size', 'Unlimited', 'set', t('global.nvidia.shaderSize'));
    add('autoShader', 'Auto Shader Compilation (Beta)', t('eng.v.optional'), 'set', t('global.nvidia.autoShader'));
    const hdr = d.hdr && d.hdr.enabled;
    if (F.rtxHdr) add('rtxHdr', K('rtxHdr'), hdr ? t('eng.v.optional') : 'Off', hdr ? 'set' : 'off', hdr ? t('global.nvidia.rtxHdr') : t('global.nvidia.rtxHdrOff'));
    const ver = gpu.driver && gpu.driver.display;
    const needDyn = F.dynamicMfg && ver && cmpVer(ver, NV_DYN_MFG) < 0;
    add('driver', K('driver'), ver ? t('eng.v.installed', { v: ver }) : t('eng.v.unknown'), needDyn ? 'warn' : 'set', needDyn ? t('global.nvidia.driverDyn', { v: NV_DYN_MFG }) : t('global.nvidia.driver'));
    if (sys.nvidiaBar1) {
      const m = /Total\s*:\s*(\d+)\s*MiB/i.exec(sys.nvidiaBar1);
      if (m) add('rebar', 'Resizable BAR', +m[1] > 256 ? on : off, +m[1] > 256 ? 'on' : 'warn', +m[1] > 256 ? t('global.nvidia.rebarOn') : t('global.nvidia.rebarOff'));
    }
    if (!apps.nvidiaApp) add('nvidiaApp', 'NVIDIA App', t('eng.v.notInstalled'), 'warn', t('global.nvidia.app'));
    return { app: 'NVIDIA App', path: t('global.nvidia.path'), items: S };
  }
  if (c.vendor === 'intel') {
    if (d.vrr) add('adaptiveSync', 'Adaptive Sync', on, 'on', t('global.intel.adaptive', { min: d.vrr.min, max: d.vrr.max }));
    if (!F.igpu) add('rebar', 'Resizable BAR', on, 'on', t('global.intel.rebar'));
    add('latency', K('intelLatency'), t('global.intel.latencyV'), 'set', t('global.intel.latency'));
    const ver = gpu.driver && gpu.driver.version;
    const m = /(\d{3}\.\d{4})$/.exec(ver || '');
    const old = F.xessMFG && m && cmpVer(m[1], INTEL_MFG) < 0;
    add('driver', K('driver'), ver ? t('eng.v.installed', { v: ver }) : t('eng.v.unknown'), old ? 'warn' : 'set', old ? t('global.intel.driverOld', { v: INTEL_MFG }) : t('global.intel.driver'));
    if (!apps.intelSoftware && !apps.intelArcControl) add('intelApp', 'Intel Graphics Software', t('eng.v.notInstalled'), 'warn', t('global.intel.app'));
    return { app: 'Intel Graphics Software', path: t('global.intel.path'), items: S };
  }
  return null;
}

// Sistem kontrolleri: level 'ok' | 'info' | 'warn'. games: arayüze giden oyun listesi (disk kontrolleri için).
function systemChecks(sys, c, games = []) {
  const t = c.t;
  const out = [];
  const add = (level, title, detail, area) => out.push({ level, title, detail, area });
  const d = c.display;
  const win = sys.winSettings;
  if (d && d.maxHz && d.current.hz && d.maxHz - d.current.hz >= 5) {
    add('warn', t('checks.hzLow', { name: d.name, cur: Math.round(d.current.hz), max: d.maxHz }), sys.platform === 'win32' ? t('checks.hzLowWin') : t('checks.hzLowOther'), 'monitor');
  } else if (d && d.maxHz) add('ok', t('checks.hzOk', { name: d.name, cur: Math.round(d.current.hz) }), '', 'monitor');
  if (d && d.native && d.native.w && d.current.w && (d.current.w < d.native.w || d.current.h < d.native.h)) add('warn', t('checks.resLow', { w: d.current.w, h: d.current.h }), t('checks.resLowWhy', { w: d.native.w, h: d.native.h }), 'monitor');
  if (d && d.vrr) add('ok', t('checks.vrr', { kind: d.vrr.kind, min: d.vrr.min, max: d.vrr.max }), d.vrr.sure ? t('checks.vrrSure') : t('checks.vrrGuess'), 'monitor');
  else if (d) add('info', t('checks.noVrr'), t('checks.noVrrWhy'), 'monitor');
  if (d && d.hdr && d.hdr.supported) {
    const nits = d.hdr.peakNits;
    if (d.hdr.enabled) add('info', t('checks.hdrOn', { nits: nits ? t('checks.hdrOnNits', { n: nits }) : '' }), nits && nits < 600 ? t('checks.hdrOnLow') : t('checks.hdrOnCal'), 'monitor');
    else add('info', t('checks.hdrOff'), nits && nits < 600 ? t('checks.hdrOffLow', { n: nits }) : t('checks.hdrOffHow'), 'monitor');
  }
  const gpus = sys.gpus.filter(g => !g.virtual);
  const main = c.gpu;
  if (gpus.length > 1 && d && d.adapter && main && d.adapter !== main.name) add('warn', t('checks.adapter', { adapter: d.adapter }), t('checks.adapterWhy', { gpu: main.name, adapter: d.adapter }), 'gpu');
  if (main && main.vendor === 'amd' && sys.platform === 'win32' && !(sys.apps && sys.apps.amd)) add('warn', t('checks.noAdrenalin'), t('checks.noAdrenalinWhy'), 'app');
  if (win) {
    const nv = main && main.vendor === 'nvidia';
    if (win.hags === true) add('ok', t('checks.hagsOn'), '', 'windows');
    else if (win.hags === false) add(nv ? 'warn' : 'info', t('checks.hagsOff'), t('checks.hagsPath') + (nv ? t('checks.hagsNv') : t('checks.hagsOther')), 'windows');
    if (win.gameMode === false) add('warn', t('checks.gameModeOff'), t('checks.gameModeOffWhy'), 'windows');
    else add('ok', t('checks.gameModeOn'), '', 'windows');
    if (win.windowedOptimizations === false || win.windowedOptimizations === null) add('info', t('checks.winOptOff'), t('checks.winOptWhy'), 'windows');
    else add('ok', t('checks.winOptOn'), '', 'windows');
    if (win.backgroundRecording) add('info', t('checks.bgRec'), t('checks.bgRecWhy'), 'windows');
    if (win.powerPlan && /tasarruf|saver/i.test(win.powerPlan)) add('warn', t('checks.power', { plan: win.powerPlan }), t('checks.powerWhy'), 'windows');
  }
  const r = sys.ram || {};
  if (r.rated && r.configured && r.rated - r.configured >= 400) add('warn', t('checks.ramSlow', { cur: r.configured, rated: r.rated }), t('checks.ramSlowWhy', { profile: r.type === 'DDR5' ? 'EXPO/XMP' : 'XMP/DOCP', part: r.part }), 'ram');
  else if (r.configured) add('ok', t('checks.ramOk', { cur: r.configured, rated: r.rated && r.rated === r.configured ? t('checks.ramRated') : '' }), '', 'ram');
  diskChecks(sys, c, games, add);
  return out;
}

module.exports = { vendorGlobal, systemChecks, cmpVer };
