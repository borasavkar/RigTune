'use strict';
// Öneri motoru giriş noktası.
const { buildProfile, context, level, needUpscale, fgPlan, capPlan } = require('./common');
const { amd } = require('./amd');
const { nvidia } = require('./nvidia');
const { intel } = require('./intel');
const { ingame } = require('./ingame');
const { vendorGlobal, systemChecks } = require('./system');

// Sürücü paneli olmayan platformlar (macOS, Linux, bilinmeyen kart): yalnızca oyun içi seçimler.
function genericPick(g, c, L, need) {
  const t = c.t;
  const rk = g.t === 'rek';
  const Q = t('modes.q'), NATIVE = t('eng.native');
  let up;
  if (c.vendor === 'apple') up = need ? [`${t('eng.ifAvail', { x: 'MetalFX' })} · ${Q}`, 'set', t('generic.metalfx')] : [NATIVE, 'off', t('generic.perfOk')];
  else if (g.xs && need) up = [`XeSS · ${Q}`, 'set', t('generic.xess')];
  else if (g.f !== 'yok' && g.f !== '?' && g.f !== 'fsr1' && need) up = [`FSR · ${Q}`, 'set', t('generic.fsr')];
  else up = [NATIVE, 'off', rk ? t('generic.rk') : t('eng.perfOk')];
  const gameFG = g.fg ? t('eng.fgFsr') : null;
  const fg = fgPlan(g, c, L, need, gameFG, null);
  return { up, fg, cap: capPlan(g, c, fg, t('eng.limiter.generic')), latency: null, gameFGName: gameFG };
}

function tagsOf(g, c) {
  const t = c.t;
  const out = [];
  out.push({ t: g.est.t ? t('eng.tags.est', { x: t('types.' + g.t) }) : t('types.' + g.t), k: g.est.t ? 'w' : '' });
  if (g.f !== '?') out.push({ t: t('fsr.' + g.f), k: g.f === 'fsr4' || (g.f === 'fsr31' && c.F.fsrML) ? 'a' : '' });
  if (g.dl) out.push({ t: 'DLSS' + (g.dlVer ? ' ' + g.dlVer.split('.').slice(0, 2).join('.') : ''), k: c.vendor === 'nvidia' ? 'a' : '' });
  if (g.xs) out.push({ t: 'XeSS' + (g.xsMajor ? ' ' + g.xsMajor : ''), k: c.vendor === 'intel' ? 'a' : '' });
  if (g.fg || g.dfg || g.xfg) out.push({ t: t('eng.tags.fg', { list: [g.fg && 'FSR', g.dfg && 'DLSS', g.xfg && 'XeSS'].filter(Boolean).join(', ') }), k: '' });
  if (g.rx) out.push({ t: 'Reflex', k: c.vendor === 'nvidia' ? 'a' : '' });
  if (g.al) out.push({ t: 'Anti-Lag 2', k: c.vendor === 'amd' ? 'a' : '' });
  if (g.c60) out.push({ t: t('eng.tags.lock60'), k: 'w' });
  if (g.ac) out.push({ t: t('eng.tags.ac', { ac: g.ac }), k: '' });
  if (g.eng) out.push({ t: g.eng, k: '' });
  return out;
}

function recommend(g, c) {
  const t = c.t;
  const { L, over } = level(g, c);
  const need = needUpscale(g, c, L);
  let driver = null;
  if (c.vendor === 'amd') driver = amd(g, c, L, need);
  else if (c.vendor === 'nvidia') driver = nvidia(g, c, L, need);
  else if (c.vendor === 'intel') driver = intel(g, c, L, need);
  const pick = driver ? driver.pick : genericPick(g, c, L, need);
  const notes = [];
  if (g.no) notes.push(g.no);
  if (c.vendor === 'amd' && g.noAmd) notes.push(g.noAmd);
  if (/Unreal Engine 5/.test(g.eng || '') && !/shader|gölgelendirici/i.test(notes.join(' '))) notes.push(t('eng.notes.ue5'));
  if (g.est.t || g.est.y) {
    const which = g.est.t && g.est.y ? 'ty' : g.est.t ? 't' : 'y';
    const src = g.est.t === 'mağaza' || g.est.y === 'mağaza' ? 'store' : 'guess';
    notes.push(t(`eng.notes.est.${which}.${src}`) + t('eng.notes.fix'));
  }
  return {
    L, over, need, perf: over ? t('levelOver') : t('levels')[L],
    driver: driver && { app: driver.app, path: driver.path, items: driver.items, groups: driver.groups, state: driver.state || null },
    ingame: ingame(g, c, L, need, pick, over),
    notes, tags: tagsOf(g, c),
  };
}

module.exports = { recommend, buildProfile, context, vendorGlobal, systemChecks };
