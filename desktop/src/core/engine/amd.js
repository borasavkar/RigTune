'use strict';
// AMD Software: Adrenalin Edition oyun profili. index.html'deki rec() fonksiyonundan taşındı;
// RDNA 2/3 kartlar, FSR Upscaling/Frame Generation adları ve FRTC eklendi.
// Ayar adları ve Etkin/Devre dışı değerleri, Adrenalin'in o dildeki arayüzünde göründüğü gibi dil dosyasından (amd.k, amd.v) gelir.
// İngilizce dışındaki dillerde özgün İngilizce ad da `alt` alanında verilir (rehberlerle karşılaştırmak için).
// Adrenalin'in kayıtlı ayarları okunabildiyse (c.amd) her satıra şu anki değer (cur) ve durum (state) eklenir:
// change: değiştirilmeli · ok: zaten öyle · unknown: okunamadı · na: karşılaştırma yok (bilgi satırı).
const { FS, fgPlan, capPlan, capOk } = require('./common');
const { translator } = require('../../locales');
const { profileFor, gmdbFor } = require('../detect/amd-settings');

// Şu an geçerli ayarlar: oyunun Adrenalin'de kendi profili varsa o, yoksa genel ayarlar. Profilli oyunda RSR ve
// (profilinde kaydı yoksa) AFMF, Adrenalin'in oyun listesinden (gmdb.blb) okunur.
function currentOf(c, g) {
  if (!c.amd) return null;
  const prof = profileFor(c.amd, { dir: g.dir, appid: g.appid, pkg: g.pkg, version: g.version });
  const gm = gmdbFor(c.amd, { dir: g.dir, appid: g.appid, pkg: g.pkg, version: g.version, name: g.dbName || g.n });
  const s = prof ? { ...prof.s } : c.amd.global || {};
  if (prof && gm) { s.rsr = gm.rsr; if (s.afmf === undefined) s.afmf = gm.afmf; }
  return { scope: prof ? 'game' : 'global', s, global: c.amd.global || {}, gm };
}

function amd(g, c, L, need) {
  const t = c.t;
  const S = [];
  const enT = c.lang === 'en' ? null : translator('en');
  const on = t('eng.v.on'), off = t('eng.v.off');
  const A_ON = t('amd.v.on'), A_OFF = t('amd.v.off');
  // Ortak motorun Açık/Kapalı değerleri Adrenalin'in Etkin/Devre dışı karşılığına çevrilir.
  // want: karşılaştırma için istenen değer (true/false, sayı ya da { on, fps }); null ise karşılaştırılmaz.
  const add = (id, v, cl, why, want = null) => S.push({ id, k: t('amd.k.' + id), alt: enT ? enT('amd.k.' + id) : undefined, v: v === on ? A_ON : v === off ? A_OFF : v, c: cl, why, want });
  const rk = g.t === 'rek';
  const F = c.F;
  const ml = F.fsrML === true, mlMaybe = F.fsrML === 'driver';
  const f = g.f;
  const Q = t('modes.q'), NATIVE = t('eng.native'), perfOk = t('eng.perfOk');
  const inGame = x => `${t('amd.up.inGame', { x })} · ${Q}`;
  const inGameB = x => `${t('amd.up.inGameB', { x })} · ${Q}`;

  // Ölçekleme (oyun içi) — seçim burada yapılır, oyun içi bölümde gösterilir.
  let up, rsr = false;
  const xessAlt = g.xs ? t('amd.up.xessAlt') : '';
  if (f === 'fsr4') {
    if (ml) up = need ? [inGame('FSR 4'), 'set', t('amd.up.fsr4Ml')] : [t('amd.up.fsr4Native'), 'set', t('amd.up.fsr4MlNative')];
    else up = need ? [inGame('FSR'), 'set', t('amd.up.fsr4NoMl')] : [NATIVE, 'off', perfOk];
  } else if (f === 'fsr31') {
    if (ml) up = need ? [inGameB('FSR 3.1'), 'set', t('amd.up.fsr31Ml')] : [t('amd.up.fsr31Native'), 'set', t('amd.up.fsr31MlNative')];
    else if (mlMaybe) up = need ? [inGameB('FSR 3.1'), 'set', t('amd.up.fsr31Maybe') + xessAlt] : [NATIVE, 'off', perfOk];
    else up = need ? [inGameB('FSR 3.1'), 'set', t('amd.up.fsr31Plain') + xessAlt] : [NATIVE, 'off', perfOk];
  } else if (f === 'fsr3' || f === 'fsr2' || f === 'fsr31n') {
    up = need ? [inGameB(FS(f)), 'set', (f === 'fsr31n' && ml ? t('amd.up.oldNotListed') : t('amd.up.oldNoUpgrade')) + t('amd.up.oldQuality') + xessAlt] : [NATIVE, 'off', t('amd.up.oldNative', { fsr: FS(f) })];
  } else if (f === '?') {
    up = need ? [`${t('amd.up.newest')} · ${Q}`, 'warn', t('amd.up.unknown', { ml: ml ? t('amd.up.unknownMl') : '' })] : [NATIVE, 'off', perfOk];
  } else if (g.xs && need) {
    up = [inGameB('XeSS'), 'set', t('amd.up.xess')];
  } else {
    rsr = !!(need && !rk && F.rsr);
    up = rsr ? [t('amd.up.rsr'), 'warn', t('amd.up.rsrWhy')] : [NATIVE, 'off', rk ? t('amd.up.rkNative') : perfOk];
  }

  // FSR Upscaling (eski adıyla FSR 4 yükseltmesi). Adrenalin'in oyun listesi anahtarın bu oyunda olduğunu söylüyorsa
  // (gmdb FSRUpgradeAvailable) "çıkarsa aç" belirsizliği kalkar. Yok demesine güvenilmez: hiç açılmamış oyunda da yoktur.
  const cur0 = currentOf(c, g);
  const upAvail = !!(cur0 && cur0.gm && cur0.gm.fsrUpAvail);
  if (ml || mlMaybe) {
    const maybe0 = f === 'fsr31n' || f === '?' || (mlMaybe && (f === 'fsr31' || f === 'fsr4'));
    const isOn = (f === 'fsr31' && ml) || (maybe0 && upAvail);
    const maybe = maybe0 && !isOn;
    add('fsrUp', isOn ? on : maybe ? t('amd.fsrUp.maybeV') : f === 'fsr4' ? t('amd.fsrUp.notNeededV') : t('eng.v.unsupported'), isOn ? 'on' : maybe ? 'warn' : 'off',
      isOn ? t('amd.fsrUp.on')
        : maybe ? (mlMaybe ? t('amd.fsrUp.maybeRdna3') : t('amd.fsrUp.maybe'))
          : f === 'fsr4' ? t('amd.fsrUp.fsr4') : t('amd.fsrUp.old'), isOn ? true : null);
  } else {
    add('fsrUp', t('eng.v.cardNo'), 'off', t('amd.fsrUp.noCard'));
  }
  add('rsr', rsr ? on : off, rsr ? 'on' : 'off', rsr ? t('amd.rsr.on') : t('amd.rsr.off'), rsr);

  // Gecikme. Radeon Chill, Gecikme Önleme ve Boost ile birlikte çalışmaz: Adrenalin Chill açılınca ikisini kendisi kapatır
  // (26.10.1'deki uyarı penceresi, 22 Ekim 2026). Chill yalnızca hafif oyunlarda ve oyunda Anti-Lag 2 yoksa önerilir;
  // o zaman Gecikme Önleme kapalı önerilir ki iki satır birbiriyle çelişmesin.
  const chillOn = g.t === 'haf' && c.vrr && !g.al;
  if (chillOn) add('antiLag', off, 'off', t('amd.antiLag.chill'), false);
  else add('antiLag', g.al ? t('amd.antiLag.al2V') : on, 'on', g.al ? t('amd.antiLag.al2') : rk ? t('amd.antiLag.rk') : t('amd.antiLag.other'), true);
  add('boost', off, 'off', t('amd.boost'), false);

  // Kare üretimi
  const gameFG = g.fg ? t('eng.fgFsr') : null;
  const fg = fgPlan(g, c, L, need, gameFG, F.afmf ? 'AFMF' : null);
  add('afmf', fg.v, fg.c, F.afmf ? fg.why : t('amd.afmfNo'), !F.afmf || fg.c === 'warn' ? null : fg.c === 'on');
  if (F.fsrMLFG) {
    const mlfg = fg.use === 'game' && (f === 'fsr31' || f === 'fsr4');
    // Oyun FSR kare üretimini kullanmıyorsa bu anahtar o oyunda etkisizdir; genel ayarda "Etkin" önerildiği için burada
    // karşılaştırılmaz (değiştir diye gösterilmez).
    add('fsrFg', mlfg ? t('amd.fsrFg.onV') : t('amd.fsrFg.naV'), mlfg ? 'on' : 'off',
      mlfg ? t('amd.fsrFg.on') : fg.use === 'game' ? t('amd.fsrFg.old') : t('amd.fsrFg.none'), mlfg ? true : null);
  }

  // FPS sınırı ve Chill. Adrenalin'de Kare Hızı Hedef Kontrolü (FRTC) yalnızca genel ayardır, oyun profilinde yoktur
  // (26.10.1'de doğrulandı); bu yüzden satır genel değeri gösterir, oyuna özel sınır oyun içinden ya da Chill ile konur.
  const cap = capPlan(g, c, fg, 'Frame Rate Target Control (FRTC)');
  const full = c.hz - 3;
  const globalCap = c.vrr ? full : c.hz;
  const frtcNow = cur0 && cur0.global.frtc;
  const halfCap = cap.cap != null && cap.cap !== globalCap;
  if (cap.cap != null && !halfCap) {
    add('fpsCap', t('amd.cap.onV', { n: cap.cap }), 'set', t('amd.cap.global') + (c.vrr ? t('amd.cap.full', { full }) : t('amd.cap.noVrr', { n: c.hz })), { on: true, fps: cap.cap });
  } else if (halfCap) {
    add('fpsCap', t('amd.cap.gameV', { n: cap.cap }), 'set', t('amd.cap.global') + t('amd.cap.half', { half: cap.cap, double: cap.cap * 2 }));
  } else {
    add('fpsCap', cap.v, cap.c, cap.why + (rk && frtcNow && frtcNow.on ? t('amd.cap.rkGlobal', { n: frtcNow.fps }) : ''));
  }
  if (chillOn) add('chill', t('amd.chill.onV', { min: Math.min(60, full), max: full }), 'on', t('amd.chill.on'), true);
  else if (halfCap) add('chill', t('amd.chill.capV', { n: cap.cap }), 'set', t('amd.chill.cap', { n: cap.cap }));
  else if (rk) add('chill', off, 'off', t('amd.chill.rk'), false);
  else add('chill', off, 'off', t('amd.chill.other'), false);

  // Görüntü. RSR, Radeon Image Sharpening ile birlikte çalışmaz: Adrenalin RSR açılınca RIS'i kendisi kapatır
  // (26.10.1'deki uyarı penceresi, 22 Ekim 2026). RSR'nin kendi "Keskinleştirme Efekti" vardır.
  const fsrOn = up[1] === 'set' && need;
  if (rsr) add('ris', off, 'off', t('amd.ris.rsr'), false);
  else add('ris', fsrOn ? off : rk ? t('amd.ris.rkV') : t('amd.ris.onV'), fsrOn ? 'off' : 'on', fsrOn ? t('amd.ris.fsr') : rk ? t('amd.ris.rk') : t('amd.ris.other'), !fsrOn);
  // Bu ayar açılır liste; değer her zaman Adrenalin'deki seçeneklerden biri olmalı. 1 = "Uygulama belirtmediyse kapalı".
  add('vsyncWait', c.vrr || rk ? t('amd.vsync.vrrV') : t('amd.vsync.gameV'), c.vrr || rk ? 'off' : 'set', c.vrr ? t('amd.vsync.vrr') : rk ? t('amd.vsync.rk') : t('amd.vsync.other'), 1);
  add('enhancedSync', off, 'off', t('amd.enhancedSync'), false);

  const state = compare(S, cur0, t, A_ON, A_OFF);

  const groups = [
    [t('eng.groups.image'), ['fsrUp', 'rsr', 'ris']],
    [t('eng.groups.flow'), ['afmf', 'fsrFg', 'antiLag', 'fpsCap', 'chill', 'boost']],
    [t('eng.groups.sync'), ['vsyncWait', 'enhancedSync']],
  ];
  return {
    app: 'AMD Software: Adrenalin Edition', path: t('amd.path', { game: g.n }), items: S, groups, state,
    pick: { up, fg, cap, latency: g.al ? 'Anti-Lag 2 / FSR Latency Reduction' : null, gameFGName: gameFG, rsr },
  };
}

// Satırlara şu anki değeri ve durumu ekler. Okunamayan ayar "unknown" olur; tahmin yapılmaz.
function compare(S, cur, t, A_ON, A_OFF) {
  if (!cur) { for (const i of S) delete i.want; return null; }
  const text = (id, v) => {
    if (v === undefined || v === null) return null;
    if (id === 'ris') return v.on ? (v.pct != null ? t('amd.cur.ris', { n: v.pct }) : A_ON) : A_OFF;
    if (id === 'chill') return v.on ? (v.min != null && v.max != null ? t('amd.chill.onV', { min: v.min, max: v.max }) : A_ON) : A_OFF;
    if (id === 'fpsCap') return v.on ? t('amd.cap.onV', { n: v.fps }) : A_OFF;
    if (id === 'vsyncWait') return t('amd.vsyncOpts')[v] || t('amd.cur.other');
    return v ? A_ON : A_OFF;
  };
  const same = (id, want, v) => {
    if (id === 'ris' || id === 'chill') return !!v.on === want;
    if (id === 'fpsCap') return want.on ? capOk(v, want.fps) : !v.on;
    return v === want;
  };
  for (const i of S) {
    // FRTC yalnızca genel ayardır; diğerleri oyunun profilinden (yoksa genelden) okunur.
    // Oyun profilindeki RSR'nin kaydı bilinmiyor; profilli oyunda RSR bu yüzden "okunamadı" kalır.
    const v = i.id === 'fpsCap' ? cur.global.frtc : cur.s[i.id];
    const want = i.want;
    delete i.want;
    i.scope = i.id === 'fpsCap' ? 'global' : cur.scope;
    // Oyun sayfasında hiç bulunmayan ayar: arayüzde ayrı grupta gösterilir, oyunun "değiştir" sayısına girmez.
    if (i.id === 'fpsCap') i.globalOnly = true;
    // Radeon Boost'u desteklemeyen oyunların profilinde Boost kaydı yoktur; Adrenalin'de de satırı görünmez.
    if (v === undefined && i.id === 'boost' && cur.scope === 'game') { i.cur = t('amd.cur.none'); i.state = 'na'; continue; }
    i.cur = text(i.id, v);
    if (want === null || want === undefined) i.state = 'na';
    else if (i.cur === null) i.state = 'unknown';
    else i.state = same(i.id, want, v) ? 'ok' : 'change';
  }
  const n = s => S.filter(i => i.state === s && !i.globalOnly).length;
  return { scope: cur.scope, change: n('change'), ok: n('ok'), unknown: n('unknown'), globalChange: S.filter(i => i.globalOnly && i.state === 'change').length };
}

module.exports = { amd, currentOf };
