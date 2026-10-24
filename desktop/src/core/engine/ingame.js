'use strict';
const { rdr2Settings } = require('./games/rdr2');
// Oyun içi ayar önerileri: ekran modu, ön ayar, doku, ışın izleme, ölçekleyici, kare üretimi, gecikme, senkronizasyon, HDR.
// Oyunun kendi ayar dosyası okunabildiyse (g.cfg, core/gamecfg.js) satırlara şu anki değer ve durum eklenir (compare).

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
  // Oyuna özel bütün ayarlar (şimdilik Red Dead Redemption 2)
  const game = g.cfg && !g.cfg.error && g.cfg.kind === 'rdr2' && g.cfg.all ? rdr2Settings(g.cfg, c, L, need) : null;
  return { items: S, state: compare(S, g, c, need, pick), game };
}

// Satırlara oyunun ayar dosyasındaki değeri (cur) ve durumu (state) ekler; engine/amd.js'deki compare ile aynı anlamlar:
// change: değiştirilmeli · ok: zaten öyle · unknown: dosyada yok ya da anlamı doğrulanmamış (raw: dosyadaki hâli) ·
// na: karşılaştırılmaz (ön ayar, doku ve ışın izleme gibi oyundan oyuna adı değişen kademeler).
function compare(S, g, c, need, pick) {
  const cfg = g.cfg;
  if (!cfg || cfg.error) return null;
  const t = c.t, v = cfg.v || {}, raw = { ...cfg.raw };
  const on = t('eng.v.on'), off = t('eng.v.off');
  const yn = b => (b ? on : off);
  const d = c.display;
  const native = d.native && d.native.w ? d.native : null;
  const frtc = c.amd && c.amd.global ? c.amd.global.frtc : null;
  const upText = u => (u.kind === 'off' ? off : `${t('ingame.cur.kind.' + u.kind)}${u.gen ? ' ' + u.gen : ''}${u.mode ? ' · ' + t('ingame.cur.mode.' + u.mode) : ''}`);
  for (const i of S) {
    if (i.tip) continue;
    // r: [şu anki değer, uygun mu]; uygun mu: true/false, null = karşılaştırılmaz, undefined = okunamadı.
    let r;
    switch (i.id) {
      case 'display':
        r = v.display ? [t('ingame.cur.display.' + v.display), pick.rsr ? v.display === 'fullscreen' : v.display !== 'windowed'] : [null, undefined];
        break;
      case 'res':
        // RSR'de oyun düşük çözünürlükte çalıştırılır; doğal çözünürlükle karşılaştırılmaz.
        r = v.res ? [`${v.res.w}×${v.res.h}`, pick.rsr || !native ? null : v.res.w === native.w && v.res.h === native.h] : [null, undefined];
        break;
      case 'up': {
        const u = v.up;
        if (!u) { r = [null, undefined]; break; }
        const wantOn = need && !pick.rsr && pick.up[0] !== t('eng.native');
        const naa = u.mode === 'naa';
        // Dosyadaki FSR sürümü önerilenden farklıysa (ör. AMD_FSR2_Quality, öneri FSR 3.1) karar verilmez: oyunun iç adı
        // güncellemeden sonra eski kalmış olabilir; oyunun menüsünde kontrol edilir.
        const recGen = { fsr4: '4', fsr31: '3', fsr31n: '3', fsr3: '3', fsr2: '2', fsr1: '1' }[g.f];
        if (wantOn && u.kind === 'fsr' && u.gen && recGen && u.gen !== recGen) { r = [null, undefined]; raw.up = u.src; break; }
        r = [upText(u), wantOn ? u.kind !== 'off' && !naa && (!u.mode || u.mode === 'q' || u.mode === 'uq') : u.kind === 'off' || naa];
        break;
      }
      case 'fg':
        r = v.fg === undefined ? [null, undefined] : [yn(v.fg), pick.fg.use === 'game' ? v.fg : pick.fg.optionalGame ? null : !v.fg];
        break;
      case 'latency':
        r = v.latency === undefined ? [null, undefined] : [yn(v.latency), v.latency];
        break;
      case 'vsync':
        r = v.vsync === undefined ? [null, undefined] : [yn(v.vsync), v.vsync === (i.v === on)];
        break;
      case 'fpsCap': {
        if (v.cap === undefined) { r = [null, undefined]; break; }
        const cur = v.cap === 0 ? t('eng.v.unlimited') : t('eng.v.fps', { n: v.cap });
        const n = pick.cap.cap;
        if (n == null) { r = [cur, null]; break; }
        const inTol = v.cap > 0 && v.cap <= n && v.cap >= n - 4;
        // Oyunda sınır yoksa (ya da öneriden yüksekse) Adrenalin'deki Kare Hızı Hedef Kontrolü (FRTC) öneriye uygunsa yeter.
        // Sürücü kare üretiminde (AFMF) yarım sınır oyun içinden konur; FRTC bunun yerini tutmaz.
        const byDriver = c.vrr && pick.fg.use !== 'driver' && frtc && frtc.on && frtc.fps != null && frtc.fps <= n && frtc.fps >= n - 4 && (v.cap === 0 || v.cap > n);
        if (byDriver) i.why = t('ingame.capDriver', { n: frtc.fps }) + i.why;
        r = [cur, inTol || byDriver || (!c.vrr && (v.cap === 0 || v.cap >= n - 4))];
        break;
      }
      case 'hdr':
        // Windows'ta HDR kapalıyken oyundaki HDR ayarı çoğu oyunda etkisizdir; karşılaştırılmaz.
        r = v.hdr === undefined ? [null, undefined] : [yn(v.hdr), d.hdr && d.hdr.enabled ? v.hdr : null];
        break;
      default:
        r = [null, null];
    }
    i.cur = r[0];
    if (r[1] === undefined) { i.state = 'unknown'; if (raw[i.id]) i.raw = raw[i.id]; } else i.state = r[1] === null ? 'na' : r[1] ? 'ok' : 'change';
  }
  const n = s => S.filter(i => i.state === s).length;
  return { kind: cfg.kind, file: cfg.file, at: cfg.at, change: n('change'), ok: n('ok'), unknown: n('unknown') };
}

module.exports = { ingame };
