'use strict';
// Intel Graphics Software (Arc Control'ün yerini aldı): Grafik > oyun profili.
const { FS, fgPlan, capPlan } = require('./common');

function intel(g, c, L, need) {
  const t = c.t;
  const S = [];
  const add = (id, k, v, cl, why) => S.push({ id, k, v, c: cl, why });
  const rk = g.t === 'rek';
  const F = c.F;
  const mode = L >= 3 ? t('modes.bal') : t('modes.q');
  const on = t('eng.v.on'), off = t('eng.v.off'), Q = t('modes.q'), NATIVE = t('eng.native');

  let up;
  if (g.xs && (need || F.xessXmx)) up = need ? [`XeSS · ${mode}`, 'set', F.xessXmx ? t('intel.up.xmx') : t('intel.up.dp4a')] : rk ? [NATIVE, 'off', t('eng.rkNative')] : [t('eng.ifAvail', { x: 'XeSS Native AA' }), 'set', t('intel.up.nativeAA')];
  else if (['fsr4', 'fsr31', 'fsr31n', 'fsr3', 'fsr2'].includes(g.f) && need) up = [`${g.f === 'fsr4' ? 'FSR' : FS(g.f)} · ${Q}`, 'set', t('intel.up.fsr')];
  else if (g.f === '?' && need) up = [t('eng.ifAvail', { x: `XeSS · ${mode}` }), 'warn', t('intel.up.unknown')];
  else up = [NATIVE, 'off', rk ? t('eng.rkNative') : need ? t('intel.up.none') : t('eng.perfOk')];

  const gameFG = g.xfg ? 'XeSS Frame Generation' : g.fg ? t('eng.fgFsr') : null;
  const fg = fgPlan(g, c, L, need, gameFG, null);
  if (F.xessMFG) {
    const isOn = fg.use === 'game' && g.xfg;
    add('mfg', 'XeSS Multi Frame Generation', isOn ? (c.hz >= 165 ? t('intel.mfg.x3V') : '2X') : off, isOn ? 'on' : 'off',
      isOn ? t('intel.mfg.on') : g.xfg ? fg.why : t('intel.mfg.no'));
  }
  add('xell', t('intel.k.xell'), g.xll ? t('intel.xell.gameV') : on, 'on', g.xll ? t('intel.xell.game') : rk ? t('intel.xell.rk') : t('intel.xell.other'));
  add('sync', t('intel.k.sync'), c.vrr ? t('intel.sync.vrrV') : rk ? 'Smooth Sync' : 'VSync', c.vrr ? 'off' : 'set', c.vrr ? t('intel.sync.vrr') : rk ? t('intel.sync.rk') : t('intel.sync.other'));
  const cap = capPlan(g, c, fg, t('eng.limiter.intel'));
  add('fpsCap', t('intel.k.fpsCap'), cap.v, cap.c, cap.why);
  const upOn = /XeSS|FSR/.test(up[0]);
  add('sharpen', t('intel.k.sharpen'), upOn ? off : t('intel.sharp.lowV'), upOn ? 'off' : 'set', upOn ? t('intel.sharp.up') : t('intel.sharp.other'));
  if (F.igpu) add('endurance', 'Endurance Gaming', t('intel.endurance.v'), 'set', t('intel.endurance.why'));

  const groups = [
    [t('eng.groups.image'), ['sharpen']],
    [t('eng.groups.flow'), ['mfg', 'xell', 'fpsCap', 'endurance']],
    [t('eng.groups.sync'), ['sync']],
  ];
  return {
    app: 'Intel Graphics Software', path: t('intel.path', { game: g.n }), items: S, groups,
    pick: { up, fg, cap, latency: g.xll ? t('intel.latency') : null, gameFGName: gameFG },
  };
}

module.exports = { intel };
