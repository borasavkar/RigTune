'use strict';
// Oyun içi ayar önerileri: ekran modu, ön ayar, doku, ışın izleme, ölçekleyici, kare üretimi, gecikme, senkronizasyon, HDR.

function ingame(g, c, L, need, pick, over) {
  const t = c.t;
  const S = [];
  const add = (id, v, cl, why) => S.push({ id, k: t('ingame.k.' + id), v, c: cl, why });
  const rk = g.t === 'rek';
  const F = c.F;
  const d = c.display;
  const on = t('eng.v.on'), off = t('eng.v.off');

  add('display', pick.rsr ? t('ingame.display.exclusiveV') : t('ingame.display.anyV'), 'set', pick.rsr ? t('ingame.display.rsr') : (c.win && c.win.windowedOptimizations === false ? t('ingame.display.winOpt') : t('ingame.display.modern')));
  const native = d.native && d.native.w ? `${d.native.w}×${d.native.h}` : c.resLabel;
  add('res', native, 'set', (c.resLabel !== native ? t('ingame.res.other', { cur: c.resLabel }) : t('ingame.res.native')) + (c.uw ? t('ingame.res.uw') : ''));

  let preset;
  if (rk) preset = [t('ingame.preset.rkV'), 'set', t('ingame.preset.rk')];
  else if (over) preset = [t('ingame.preset.overV'), 'warn', t('ingame.preset.over')];
  else preset = [t('ingame.preset.v')[L], L >= 3 ? 'warn' : 'set', t('ingame.preset.why')[L]];
  if (c.goal === 'kalite' && !rk && L <= 2) preset[1] = 'set';
  add('preset', preset[0], preset[1], preset[2]);

  const v = c.vram;
  let tex;
  if (!v) tex = [t('ingame.tex.highV'), 'set', t('ingame.tex.unknown')];
  else if (v >= 16) tex = [t('ingame.tex.maxV'), 'on', t('ingame.tex.v16', { v })];
  else if (v >= 12) tex = [g.y >= 3 && (c.is4k || c.uw) ? t('ingame.tex.highV') : t('ingame.tex.highUltraV'), 'set', t('ingame.tex.v12', { v })];
  else if (v >= 8) tex = [g.y >= 3 ? t('ingame.tex.midHighV') : t('ingame.tex.highV'), 'warn', t('ingame.tex.v8', { v })];
  else tex = [t('ingame.tex.lowMidV'), 'warn', t('ingame.tex.low', { v })];
  add('tex', tex[0], tex[1], tex[2]);

  const rt = F.rt || 0;
  let rtv;
  if (g.rt === 'zorunlu') rtv = rt === 0 ? [t('ingame.rt.noCardV'), 'warn', t('ingame.rt.noCard')] : [t('ingame.rt.forcedV'), 'set', t('ingame.rt.forced') + (L >= 2 ? t('ingame.rt.forcedLow') : t('ingame.rt.forcedHigh'))];
  else if (rt === 0) rtv = [off, 'off', t('ingame.rt.none')];
  else if (rk) rtv = [off, 'off', t('ingame.rt.rk')];
  else if (L >= 3) rtv = [t('ingame.rt.offLowV'), 'warn', t('ingame.rt.heavy')];
  else if (rt >= 3) rtv = [L <= 1 ? t('ingame.rt.highV') : t('ingame.rt.midV'), 'on', t('ingame.rt.strong')];
  else if (rt === 2) rtv = [L <= 1 ? t('ingame.rt.midV') : t('ingame.rt.lowV'), 'set', t('ingame.rt.medium')];
  else rtv = [t('ingame.rt.offLowV'), 'off', t('ingame.rt.weak')];
  add('rt', rtv[0], rtv[1], rtv[2]);

  add('up', pick.up[0], pick.up[1], pick.up[2]);
  const fg = pick.fg;
  if (fg.use === 'game') add('fg', t('ingame.fg.onV', { fg: pick.gameFGName }), 'on', t('ingame.fg.on'));
  else if (fg.optionalGame) add('fg', t('eng.v.optional'), 'set', fg.why);
  else add('fg', off, 'off', fg.use === 'driver' ? t('ingame.fg.driver') : fg.why);

  if (pick.latency) add('latency', pick.latency, 'on', t('ingame.latency'));
  if (c.vendor === 'nvidia' && pick.driverVsync) add('vsync', off, 'off', t('ingame.vsync.nv'));
  else if (c.vrr) add('vsync', off, 'off', t('ingame.vsync.vrr'));
  else add('vsync', rk ? off : on, rk ? 'off' : 'set', rk ? t('ingame.vsync.rk') : t('ingame.vsync.on'));
  const cap = pick.cap;
  add('fpsCap', cap.cap ? t('eng.v.fps', { n: cap.cap }) : cap.v, cap.cap ? 'set' : cap.c, cap.cap ? t('ingame.cap') : cap.why);

  const hdr = d.hdr || {};
  if (hdr.enabled) add('hdr', t('ingame.hdr.onV'), 'set', t('ingame.hdr.on', { nits: hdr.peakNits ? t('ingame.hdr.nits', { n: hdr.peakNits }) : '' }));
  else if (hdr.supported) add('hdr', off, 'off', t('ingame.hdr.off'));
  if (rk) add('blur', off, 'off', t('ingame.blur'));
  for (const tip of g.tips || []) S.push({ id: 'tip', k: t('ingame.k.tip'), v: '—', c: 'set', why: tip, tip: true });
  return S;
}

module.exports = { ingame };
