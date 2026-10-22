'use strict';
// NVIDIA App: Grafik > Program Ayarları > oyun > Sürücü Ayarları. Ayar adları NVIDIA App 11.0.x arayüzündeki İngilizce adlardır.
const { FS, fgPlan, capPlan } = require('./common');

function nvidia(g, c, L, need) {
  const t = c.t;
  const S = [];
  const add = (id, k, v, cl, why) => S.push({ id, k, v, c: cl, why });
  const rk = g.t === 'rek';
  const F = c.F;
  const mode = L >= 3 ? (c.is4k ? t('modes.perf') : t('modes.bal')) : t('modes.q');
  const on = t('eng.v.on'), off = t('eng.v.off'), Q = t('modes.q'), NATIVE = t('eng.native');

  let up;
  if (F.dlss && g.dl) up = need ? [`DLSS · ${mode}`, 'set', t('nvidia.up.dlss')] : rk ? [NATIVE, 'off', t('eng.rkNative')] : ['DLAA', 'set', t('nvidia.up.dlaa')];
  else if (g.xs && need) up = [`XeSS · ${Q}`, 'set', t('nvidia.up.xess')];
  else if (['fsr4', 'fsr31', 'fsr31n', 'fsr3', 'fsr2'].includes(g.f) && need) up = [`${g.f === 'fsr4' ? 'FSR' : FS(g.f)} · ${Q}`, 'set', t('nvidia.up.fsr')];
  else if (g.f === '?' && need) up = [t('eng.ifAvail', { x: `DLSS · ${mode}` }), 'warn', t('nvidia.up.unknown')];
  else if (need && !rk) up = [t('nvidia.up.nisV'), 'warn', t('nvidia.up.nis')];
  else up = [NATIVE, 'off', rk ? t('eng.rkNative') : t('eng.perfOk')];

  if (F.dlss) {
    if (g.dl) add('dlssModel', 'DLSS Override – Model Presets', F.fp8 ? 'Recommended' : 'Preset K', 'set', F.fp8 ? t('nvidia.model.fp8') : t('nvidia.model.noFp8'));
    else add('dlssModel', 'DLSS Override – Model Presets', t('nvidia.model.naV'), 'off', g.probed ? t('nvidia.model.noFiles') : t('nvidia.model.unknown'));
    if (g.rr) add('dlssRR', 'DLSS Override – Ray Reconstruction', t('nvidia.rr.v'), 'set', t('nvidia.rr.why'));
  } else {
    add('dlss', 'DLSS', t('eng.v.cardNo'), 'off', t('nvidia.dlssNo'));
  }

  const gameFG = F.dlssFG && g.dfg ? 'DLSS Frame Generation' : g.fg ? t('eng.fgFsr') : null;
  const fg = fgPlan(g, c, L, need, gameFG, F.smoothMotion ? 'Smooth Motion' : null);
  const dlssFG = fg.use === 'game' && gameFG === 'DLSS Frame Generation';
  const dyn = dlssFG && F.dynamicMfg;
  if (F.dlssFG) {
    if (dyn) add('fgMode', 'DLSS Override – Frame Generation Mode', 'Dynamic · Max refresh rate', 'on', t('nvidia.fgMode.dyn', { hz: c.hz }));
    else if (dlssFG) add('fgMode', 'DLSS Override – Frame Generation Mode', 'Use 3D app setting (2X)', 'on', t('nvidia.fgMode.x2'));
    else add('fgMode', 'DLSS Override – Frame Generation Mode', off, 'off', g.dfg ? fg.why : t('nvidia.fgMode.none'));
  }
  if (F.smoothMotion) {
    const isOn = fg.use === 'driver';
    add('smoothMotion', 'NVIDIA Smooth Motion', isOn ? on : fg.c === 'warn' ? fg.v : off, isOn ? 'on' : fg.c === 'warn' ? 'warn' : 'off', isOn ? fg.why + t('nvidia.smooth') : fg.why);
  }

  if (g.rx) add('lowLatency', 'Low Latency Mode', t('nvidia.llm.reflexV'), 'off', rk ? t('nvidia.llm.reflexRk') : t('nvidia.llm.reflex'));
  else add('lowLatency', 'Low Latency Mode', rk ? 'Ultra' : 'On', 'on', rk ? t('nvidia.llm.ultra') : t('nvidia.llm.on'));

  let cap;
  if (dyn) {
    add('vsync', 'Vertical sync', 'Off', 'off', t('nvidia.vs.dyn'));
    add('maxFps', 'Max Frame Rate', 'Off', 'off', t('nvidia.max.dyn'));
    cap = { v: t('eng.v.unlimited'), c: 'off', cap: null, why: t('nvidia.max.dynCap') };
  } else if (rk) {
    add('vsync', 'Vertical sync', 'Off', 'off', t('nvidia.vs.rk'));
    cap = capPlan(g, c, fg, 'Max Frame Rate');
    add('maxFps', 'Max Frame Rate', 'Off', 'off', cap.why);
  } else if (c.vrr) {
    add('vsync', 'Vertical sync', 'On', 'on', t('nvidia.vs.vrr'));
    cap = capPlan(g, c, fg, 'Max Frame Rate');
    if (g.rx) add('maxFps', 'Max Frame Rate', t('nvidia.max.reflexV'), 'off', t('nvidia.max.reflex'));
    else add('maxFps', 'Max Frame Rate', cap.v, cap.c, cap.why);
  } else {
    add('vsync', 'Vertical sync', 'On', 'set', t('nvidia.vs.noVrr'));
    add('maxFps', 'Max Frame Rate', 'Off', 'off', t('nvidia.max.noVrr'));
    cap = capPlan(g, c, fg, 'Max Frame Rate');
  }

  const dlssOn = /^DLSS|^DLAA/.test(up[0]);
  add('sharpen', 'Image Sharpening', dlssOn ? 'Off' : rk ? t('nvidia.sharp.rkV') : 'Off', dlssOn || !rk ? 'off' : 'on', dlssOn ? t('nvidia.sharp.dlss') : rk ? t('nvidia.sharp.rk') : t('nvidia.sharp.off'));
  if (F.rtxHdr) {
    const hdr = c.display.hdr && c.display.hdr.enabled;
    add('rtxHdr', 'RTX HDR', hdr ? t('nvidia.hdr.onV') : 'Off', hdr ? 'set' : 'off', hdr ? t('nvidia.hdr.on') : t('nvidia.hdr.off'));
  }

  const groups = [
    ['DLSS', ['dlssModel', 'dlssRR', 'dlss', 'sharpen', 'rtxHdr']],
    [t('eng.groups.flow'), ['fgMode', 'smoothMotion', 'lowLatency', 'maxFps']],
    [t('eng.groups.sync'), ['vsync']],
  ];
  return {
    app: 'NVIDIA App', path: t('nvidia.path', { game: g.n }), items: S, groups,
    pick: { up, fg, cap, latency: g.rx ? (rk ? 'NVIDIA Reflex · On + Boost' : 'NVIDIA Reflex · On') : null, gameFGName: gameFG, driverVsync: c.vrr && !dyn && !rk },
  };
}

module.exports = { nvidia };
