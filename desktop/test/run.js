'use strict';
// Bağımlılıksız test: node test/run.js
// Ayrıştırıcılar, ekran kartı veritabanı, değişiklik farkı, üç üreticinin öneri yolları (sahte sistemlerle) ve dil desteği.
// Öneri beklentileri Türkçe metinle yazılıdır (varsayılan dil 'tr'); İngilizce çıktı "Dil desteği" bölümünde denetlenir.
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { parseEdid } = require('../src/core/detect/edid');
const { parseVdf } = require('../src/core/libraries/steam');
const gpudb = require('../src/core/gpudb');
const { nvidiaDriver, ramInfo, cpuInfo, storageFromWin } = require('../src/core/detect');
const cpudb = require('../src/core/cpudb');
const hw = require('../src/core/engine/hardware');
const { fingerprint } = require('../src/core/changes');
const { diff, changeText } = require('../src/core/changes');
const { LOCALES, resolveLang, translator } = require('../src/locales');
const E = require('../src/core/engine');
const gamedb = require('../src/core/gamedb');
const { cmpVer } = require('../src/core/engine/system');
const { classify, parseReq } = require('../src/core/steamstore');
const amdS = require('../src/core/detect/amd-settings');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('Ayrıştırıcılar');
t('EDID: AOC CU34G2XP (seri numarası silinmiş)', () => {
  const e = parseEdid(fs.readFileSync(path.join(__dirname, 'fixtures', 'aoc-cu34g2xp.edid.hex'), 'utf8'));
  assert.strictEqual(e.manufacturer, 'AOC');
  assert.strictEqual(e.name, 'CU34G2XP');
  assert.deepStrictEqual(e.native, { w: 3440, h: 1440 });
  assert.strictEqual(e.maxHzTimings, 180);
  assert.deepStrictEqual([e.vrr.kind, e.vrr.min, e.vrr.max], ['FreeSync', 48, 180]);
  assert.ok(e.hdr.pq);
  assert.strictEqual(e.interface, 'DisplayPort');
});
t('EDID: bozuk veri null döner', () => { assert.strictEqual(parseEdid('00ff'), null); });
t('VDF: kaçış karakterleri ve iç içe bloklar', () => {
  const v = parseVdf('"libraryfolders"\n{\n "0"\n {\n  "path"  "C:\\\\Program Files (x86)\\\\Steam"\n  "apps" { "730" "123" }\n }\n}');
  assert.strictEqual(v.libraryfolders['0'].path, 'C:\\Program Files (x86)\\Steam');
  assert.strictEqual(v.libraryfolders['0'].apps['730'], '123');
});
t('NVIDIA sürücü sürümü çevirisi', () => { assert.strictEqual(nvidiaDriver('32.0.15.8129'), '581.29'); assert.strictEqual(nvidiaDriver('32.0.15.9597'), '595.97'); });
t('Sürüm karşılaştırma', () => { assert.strictEqual(cmpVer('26.8.1', '26.9.2'), -1); assert.strictEqual(cmpVer('26.10.1', '26.9.2'), 1); assert.strictEqual(cmpVer('595.97', '595.97'), 0); });
t('Bellek etiket hızı tahmini', () => {
  assert.strictEqual(ramInfo([{ size: 16e9, configured: 4800, part: 'F5-6000J3038F16G' }]).rated, 6000);
  assert.strictEqual(ramInfo([{ size: 16e9, configured: 4800, part: 'KF560C30-16' }]).rated, 6000);
  assert.strictEqual(ramInfo([{ size: 16e9, configured: 6000, part: 'CMK32GX5M2B6000C36' }]).rated, 6000);
});

console.log('Ekran kartı veritabanı');
t('Model eşleşmeleri', () => {
  const x = n => { const r = gpudb.lookup(n, '', 0); return [r.vendor, r.archKey, r.score]; };
  assert.deepStrictEqual(x('AMD Radeon RX 9070 XT'), ['amd', 'RDNA4', 100]);
  assert.deepStrictEqual(x('AMD Radeon RX 9070'), ['amd', 'RDNA4', 90]);
  assert.deepStrictEqual(x('AMD Radeon RX 7900 XTX'), ['amd', 'RDNA3', 104]);
  assert.deepStrictEqual(x('AMD Radeon RX 7900 XT'), ['amd', 'RDNA3', 90]);
  assert.deepStrictEqual(x('NVIDIA GeForce RTX 4070 Ti SUPER'), ['nvidia', 'Ada', 90]);
  assert.deepStrictEqual(x('NVIDIA GeForce RTX 5080'), ['nvidia', 'Blackwell', 118]);
  assert.deepStrictEqual(x('NVIDIA GeForce GTX 1660 SUPER'), ['nvidia', 'TuringGTX', 22]);
  assert.deepStrictEqual(x('Intel(R) Arc(TM) B580 Graphics'), ['intel', 'Battlemage', 42]);
  assert.ok(gpudb.lookup('Microsoft Basic Display Adapter', 'PCI\\VEN_1414', 0).virtual);
});
t('Dizüstü kartı puanı düşürülür', () => { assert.strictEqual(gpudb.lookup('NVIDIA GeForce RTX 4070 Laptop GPU', '', 0).score, Math.round(66 * 0.7)); });

console.log('Değişiklik farkı');
t('Sürücü, monitör ve oyun değişiklikleri', () => {
  const a = { os: 'W 1', cpu: 'C', ram: '32 GB', gpus: { g: { name: 'RX', driver: '1' } }, displays: { d: { name: 'M', mode: '1×1 @ 144 Hz', hdr: false } }, apps: { 'AMD Software': '26.8.1' }, win: { hags: true, gameMode: true, windowed: true }, games: { a: { name: 'A', ver: '1', ok: true }, b: { name: 'B', ver: '', ok: true } } };
  const b = JSON.parse(JSON.stringify(a));
  b.gpus.g.driver = '2'; b.displays.d.mode = '1×1 @ 180 Hz'; b.apps['AMD Software'] = '26.9.2'; b.games.a.ver = '2'; delete b.games.b; b.games.c = { name: 'C', ver: '', ok: true };
  const types = diff(a, b).map(x => x.type);
  assert.deepStrictEqual(types, ['driver', 'display', 'software', 'game', 'game', 'game']);
});

// Sahte sistem kurucu
function fakeSys(gpuName, vram, display, extra = {}) {
  const info = gpudb.lookup(gpuName, '', vram * 2 ** 30);
  const gpu = { id: 'g', name: gpuName, vendor: info.vendor, arch: info.arch, archKey: info.archKey, score: info.score, features: info.features, vramGB: vram, driver: { version: extra.driver || '1', display: extra.driver || '1' }, virtual: false };
  return { platform: 'win32', gpus: [gpu], displays: [display], apps: extra.apps || {}, winSettings: { hags: true, gameMode: true, windowedOptimizations: true }, ram: {}, os: {}, cpu: {} };
}
const mon = (w, h, hz, vrr, hdr) => ({ id: 'm', name: 'Test', current: { w, h, hz }, native: { w, h }, maxHz: hz, vrr: vrr ? { kind: 'FreeSync', min: 48, max: hz, sure: true } : null, hdr: { supported: !!hdr, enabled: !!hdr, peakNits: hdr || null } });
function recFor(sys, gameName, probe, goal = 'denge', lang = 'tr') {
  const c = E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { goal, lang });
  const g = { id: 'x', name: gameName, source: 'steam' };
  const p = E.buildProfile(g, gamedb.match(g), probe || null, null, null, lang);
  return { r: E.recommend(p, c), c, p };
}
const item = (list, k) => { const i = list.find(x => x.k === k); assert.ok(i, `"${k}" yok`); return i; };

console.log('AMD (taşınan kurallar)');
t('RX 9070 XT · 1440p 165 Hz · Cyberpunk: FSR Upscaling açık, oyun içi kare üretimi', () => {
  const { r } = recFor(fakeSys('AMD Radeon RX 9070 XT', 16, mon(2560, 1440, 165, true)), 'Cyberpunk 2077');
  assert.strictEqual(item(r.driver.items, 'AMD FSR Yükseltme').v, 'Etkin');
  assert.strictEqual(item(r.ingame, 'Kare üretimi (oyun içi)').c, 'on');
  assert.strictEqual(item(r.driver.items, 'AMD Fluid Motion Frames 2.1').v, 'Devre dışı');
});
t('Elden Ring: 60 kilidi → AFMF açık', () => {
  const { r } = recFor(fakeSys('AMD Radeon RX 9070 XT', 16, mon(2560, 1440, 165, true)), 'Elden Ring');
  assert.strictEqual(item(r.driver.items, 'AMD Fluid Motion Frames 2.1').v, 'Etkin');
  assert.strictEqual(item(r.driver.items, 'Kare Hızı Hedef Kontrolü').v, 'Oyunun 60 kilidi');
});
t('CS2: rekabetçi → FPS sınırsız, AFMF kapalı, keskinlik %50', () => {
  const { r } = recFor(fakeSys('AMD Radeon RX 9070 XT', 16, mon(1920, 1080, 240, true)), 'Counter-Strike 2');
  assert.strictEqual(item(r.driver.items, 'Kare Hızı Hedef Kontrolü').v, 'Sınırsız');
  assert.strictEqual(item(r.driver.items, 'AMD Fluid Motion Frames 2.1').v, 'Devre dışı');
  assert.strictEqual(item(r.driver.items, 'Radeon Image Sharpening 2').v, 'Etkin · Netlik %50');
});
t('RX 6700 XT: FSR Upscaling desteklenmez, AFMF var, ML kare üretimi satırı yok', () => {
  const { r } = recFor(fakeSys('AMD Radeon RX 6700 XT', 12, mon(2560, 1440, 144, true)), 'Cyberpunk 2077');
  assert.strictEqual(item(r.driver.items, 'AMD FSR Yükseltme').v, 'Kartın desteklemiyor');
  assert.ok(!r.driver.items.some(i => i.id === 'fsrFg'));
  assert.ok(r.L >= 3, 'zayıf kartta yük seviyesi yükselmeli');
});
t('VRR olmayan 60 Hz monitör: FPS = 60 + VSync', () => {
  const { r } = recFor(fakeSys('AMD Radeon RX 9070 XT', 16, mon(1920, 1080, 60, false)), "Baldur's Gate 3");
  assert.strictEqual(item(r.driver.items, 'Kare Hızı Hedef Kontrolü').v, 'Etkin · Maks FPS 60');
  assert.strictEqual(item(r.ingame, 'VSync (oyun içi)').v, 'Açık');
});

t('Witcher 3 · RX 9070 XT Türkçe: adlar ve değerler Adrenalin Türkçe arayüzündeki gibi', () => {
  const { r } = recFor(fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 144, true, 418)), 'The Witcher 3: Wild Hunt');
  const al = item(r.driver.items, 'Radeon Gecikme Önleme');
  assert.strictEqual(al.v, 'Etkin (Anti-Lag 2)');
  assert.strictEqual(al.alt, 'Radeon Anti-Lag');
  assert.strictEqual(item(r.driver.items, 'AMD FSR Kare Üretimi').v, 'Etkin (oyunda FSR kare üretimi açıkken)');
  assert.strictEqual(item(r.driver.items, 'Dikey Yenileme İçin Bekle').v, 'Uygulama belirtmediyse kapalı');
  assert.strictEqual(item(r.driver.items, 'Radeon Geliştirilmiş Senkronizasyon').v, 'Devre dışı');
  // FRTC'nin Türkçe adı; Adrenalin'de yalnızca genel ayarda var.
  assert.strictEqual(item(r.driver.items, 'Kare Hızı Hedef Kontrolü').v, 'Etkin · Maks FPS 141');
  assert.strictEqual(item(r.driver.items, 'Kare Hızı Hedef Kontrolü').alt, 'Frame Rate Target Control');
  // Açık/Kapalı ortak motorun sözcükleri; Adrenalin satırlarında görünmemeli.
  for (const sys of [fakeSys('AMD Radeon RX 9070 XT', 16, mon(2560, 1440, 165, true)), fakeSys('AMD Radeon RX 6700 XT', 12, mon(1920, 1080, 60, false))])
    for (const x of gamedb.G) for (const i of recFor(sys, x.n).r.driver.items) assert.ok(!/^(Açık|Kapalı)/.test(i.v), `${x.n}: ${i.k} = ${i.v}`);
});

console.log('Adrenalin ayarlarını okuma');
// Fikstür: gerçek User.blb (Adrenalin 26.10.1); kişisel oyun klasörü yolları aynı uzunlukta sahte yollarla değiştirildi.
const apl = amdS.parseApl(fs.readFileSync(path.join(__dirname, 'fixtures', 'amd-user.blb')));
const amdProfiles = apl.map(p => ({ exe: p.exe, appid: p.appid, dir: p.dir, s: amdS.fromProfile(p.props) }));
const amdGlobal = { antiLag: true, boost: false, chill: { on: false, min: null, max: null }, frtc: { on: true, fps: 140 }, fsrUp: false, fsrFg: false, enhancedSync: false, vsyncWait: 1, texFilter: 0, surfaceFmt: true, tess: 0, aa: { mode: 1, mlaa: false }, fsrOta: 1, experience: 'PROFILE_CUSTOM', ris: { on: true, pct: 20 } };
const withAmd = sys => Object.assign(sys, { amdSettings: { ok: true, at: 0, profiles: amdProfiles, global: amdGlobal } });
t('User.blb: profiller ve değerler Adrenalin arayüzündekiyle aynı', () => {
  assert.strictEqual(apl.length, 7);
  const w = apl.find(p => p.exe === 'witcher3.exe');
  assert.ok(/The Witcher 3\\bin\\x64_dx12$/.test(w.dir), w.dir);
  const s = amdS.fromProfile(w.props);
  assert.deepStrictEqual([s.antiLag, s.boost, s.chill.on, s.ris.on, s.afmf, s.fsrUp, s.fsrFg, s.enhancedSync, s.vsyncWait], [true, false, false, false, false, false, false, false, 1]);
  const rdr = amdS.fromProfile(apl.find(p => p.exe === 'RDR2.exe').props);
  assert.deepStrictEqual(rdr.ris, { on: true, pct: 30 });
  assert.strictEqual(rdr.boost, undefined, 'RDR2 profilinde Boost kaydı olmamalı');
  assert.ok(apl.some(p => p.appid === '292030'));
  assert.throws(() => amdS.parseApl(Buffer.from('XXXX')));
});
t('GExDb ve kayıt defteri: genel ayarlar', () => {
  const gex = amdS.parseGex(Buffer.from(JSON.stringify({ '': { Profiles: [{ ProfileName: 'Default', GPUS: [{ GPUBDF: 768 }] }, { ProfileName: 'Custom', GPUS: [{ GPUBDF: 768, GraphicsFeatures: [{ FeatureID: 27, FeatureValue: '1' }, { FeatureID: 28, FeatureValue: '20' }] }] }] }, ReleaseVersion: '26.10.41.01' })));
  const kmd = amdS.parseRegQuery('\r\nHKEY_LOCAL_MACHINE\\X\r\n    KMD_DeLagEnabled    REG_DWORD    0x1\r\n    Gmx_FRTCEnabled    REG_DWORD    0x1\r\n    Gmx_FRTCFrameRateTarget    REG_DWORD    0x8c\r\n    KMD_ChillEnabled    REG_DWORD    0x0\r\n    AnisoType    REG_BINARY    30000000\r\n');
  assert.deepStrictEqual([kmd.KMD_DeLagEnabled, kmd.Gmx_FRTCFrameRateTarget, kmd.AnisoType], [1, 140, '0']);
  const umd = amdS.parseRegQuery('    TurboSync    REG_SZ    0\r\n    VSyncControl    REG_SZ    1\r\n    TFQ    REG_SZ    0\r\n    FsrOverride    REG_SZ    0\r\n');
  const g = amdS.fromGlobal(kmd, umd, { LastSavedExpID: 'PROFILE_CUSTOM' }, gex);
  assert.deepStrictEqual([g.antiLag, g.chill.on, g.frtc.fps, g.enhancedSync, g.vsyncWait, g.texFilter, g.fsrUp, g.ris.pct], [true, false, 140, false, 1, 0, false, 20]);
  // Başka bir Oyun Deneyimi seçiliyken GExDb'deki "Özel" profil geçerli olmayabilir; RIS okunmaz.
  assert.strictEqual(amdS.fromGlobal(kmd, umd, { LastSavedExpID: 'PROFILE_HYPRRX' }, gex).ris, undefined);
  // RSR ve AFMF (22 Ekim 2026'da Adrenalin'de açılıp kapatılarak bulundu): Gmx_RSREnabled 3 açık, 1 ya da 0 kapalı;
  // DrvFrameGenEnabled "1" açık, "0" ya da kayıt yoksa kapalı. RIS kapatılınca GExDb'deki 27 numaralı kayıt silinir.
  const g2 = rsr => amdS.fromGlobal({ ...kmd, Gmx_RSREnabled: rsr }, umd, { LastSavedExpID: 'PROFILE_CUSTOM' }, gex);
  assert.deepStrictEqual([g2(1).rsr, g2(0).rsr, g2(3).rsr], [false, false, true]);
  assert.strictEqual(g.afmf, false, 'kayıt yoksa AFMF kapalı');
  assert.strictEqual(amdS.fromGlobal(kmd, { ...umd, DrvFrameGenEnabled: '1' }, {}, gex).afmf, true);
  assert.strictEqual(amdS.fromGlobal(kmd, null, {}, gex).afmf, undefined, 'UMD okunamadıysa bilinmiyor');
  const noRis = amdS.parseGex(Buffer.from(JSON.stringify({ '': { Profiles: [{ ProfileName: 'Custom', GPUS: [{ GraphicsFeatures: [{ FeatureID: 28, FeatureValue: '20' }] }] }] } })));
  assert.strictEqual(amdS.fromGlobal(kmd, umd, { LastSavedExpID: 'PROFILE_CUSTOM' }, noRis).ris.on, false);
});
t('Witcher 3: öneriler Adrenalin\'deki değerle karşılaştırılır', () => {
  const sys = withAmd(fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 144, true, 418)));
  const c = E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { lang: 'tr' });
  const rec = g => E.recommend(E.buildProfile(g, gamedb.match(g), null, null, null, 'tr'), c);
  const r = rec({ id: 'x', name: 'The Witcher 3: Wild Hunt', source: 'steam', appid: '292030', installDir: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\The Witcher 3' });
  const it = k => item(r.driver.items, k);
  assert.strictEqual(r.driver.state.scope, 'game');
  assert.deepStrictEqual([it('AMD FSR Kare Üretimi').state, it('AMD FSR Kare Üretimi').cur], ['change', 'Devre dışı']);
  assert.strictEqual(it('Radeon Gecikme Önleme').state, 'ok');
  assert.strictEqual(it('Radeon Image Sharpening 2').state, 'ok');
  // Genel FRTC 140, öneri 141: hedefin birkaç FPS altı uygun sayılır.
  assert.deepStrictEqual([it('Kare Hızı Hedef Kontrolü').state, it('Kare Hızı Hedef Kontrolü').scope, it('Kare Hızı Hedef Kontrolü').cur], ['ok', 'global', 'Etkin · Maks FPS 140']);
  assert.strictEqual(it('Radeon Super Resolution').state, 'unknown');
  assert.strictEqual(it('Dikey Yenileme İçin Bekle').cur, 'Uygulama belirtmediyse kapalı');
  assert.ok(!r.driver.items.some(i => 'want' in i), 'iç alan arayüze gitmemeli');
  // Profili olmayan oyun genel ayarları kullanır.
  assert.strictEqual(rec({ id: 'y', name: 'NBA 2K26', source: 'steam', appid: '3472040', installDir: 'C:\\Games\\NBA 2K26' }).driver.state.scope, 'global');
  // Ayarlar okunamadıysa karşılaştırma yapılmaz.
  assert.strictEqual(recFor(fakeSys('AMD Radeon RX 9070 XT', 16, mon(2560, 1440, 165, true)), 'Cyberpunk 2077').r.driver.state, null);
});
t('Genel ayarlar: Kare Hızı Hedef Kontrolü ve doku filtreleme karşılaştırması', () => {
  const sys = withAmd(fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 144, true, 418)));
  const c = E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { lang: 'tr' });
  const g = E.vendorGlobal(sys, c);
  assert.deepStrictEqual([item(g.items, 'Kare Hızı Hedef Kontrolü').v, item(g.items, 'Kare Hızı Hedef Kontrolü').cur, item(g.items, 'Kare Hızı Hedef Kontrolü').state], ['Etkin · Maks FPS 141', 'Etkin · Maks FPS 140', 'ok']);
  assert.deepStrictEqual([item(g.items, 'Doku Filtreleme Kalitesi').cur, item(g.items, 'Doku Filtreleme Kalitesi').state], ['Yüksek', 'change']);
  assert.strictEqual(item(g.items, 'Yüzey Biçim Optimizasyonu').state, 'ok');
  assert.strictEqual(item(g.items, 'HYPR-RX').state, 'ok');
  // Grafik Seçenekleri de genel sayfada önerilir ve karşılaştırılır (profili olmayan oyunlar bunları kullanır).
  assert.deepStrictEqual([item(g.items, 'AMD FSR Yükseltme').v, item(g.items, 'AMD FSR Yükseltme').state], ['Etkin', 'change']);
  assert.strictEqual(item(g.items, 'Radeon Gecikme Önleme').state, 'ok');
  assert.strictEqual(item(g.items, 'Radeon Image Sharpening 2').cur, 'Etkin · Netlik %20');
  assert.strictEqual(item(g.items, 'Radeon Super Resolution').state, 'unknown', 'test verisinde RSR yok');
  assert.strictEqual(g.state.change, 3, 'doku filtreleme, FSR Yükseltme, FSR Kare Üretimi');
  // Monitör 180 Hz'e alınınca 140 artık uygun değil.
  const s180 = withAmd(fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 180, true)));
  assert.strictEqual(item(E.vendorGlobal(s180, E.context(s180, { gpu: s180.gpus[0], display: s180.displays[0] }, { lang: 'tr' })).items, 'Kare Hızı Hedef Kontrolü').state, 'change');
});

t('Radeon Chill ile Gecikme Önleme birlikte önerilmez (Adrenalin ikisini birlikte çalıştırmaz)', () => {
  const sys = fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 144, true, 418));
  const aoe = recFor(sys, 'Age of Empires IV').r.driver.items;
  assert.strictEqual(item(aoe, 'Radeon Chill').c, 'on');
  assert.strictEqual(item(aoe, 'Radeon Gecikme Önleme').v, 'Devre dışı');
  for (const s of [sys, fakeSys('AMD Radeon RX 9070 XT', 16, mon(2560, 1440, 165, true)), fakeSys('AMD Radeon RX 6700 XT', 12, mon(1920, 1080, 144, true))])
    for (const x of gamedb.G) {
      const it = recFor(s, x.n).r.driver.items;
      const chill = it.find(i => i.id === 'chill'), al = it.find(i => i.id === 'antiLag');
      assert.ok(!(chill.c === 'on' && al.c === 'on'), `${x.n}: Chill ve Gecikme Önleme birlikte açık öneriliyor`);
      // RSR, Radeon Image Sharpening ile birlikte çalışmaz.
      const rsr = it.find(i => i.id === 'rsr'), ris = it.find(i => i.id === 'ris');
      assert.ok(!(rsr.c === 'on' && ris.c === 'on'), `${x.n}: RSR ve netleştirme birlikte açık öneriliyor`);
    }
});
t('Adrenalin ölçümü: kare süreleri, kare üretimi ve ölçüme göre öneri', () => {
  const steady = amdS.parseGpa(Array.from({ length: 400 }, (_, i) => 7000 + (i % 3) * 10).join(' '));
  const alt = amdS.parseGpa(Array.from({ length: 400 }, (_, i) => (i % 2 ? 2500 : 11400)).join(' '));
  assert.ok(Math.abs(steady.fps - 142.7) < 0.5, String(steady.fps));
  assert.deepStrictEqual([steady.fg, alt.fg], [false, true]);
  assert.strictEqual(amdS.parseGpa('1 2 3'), null, 'çok az kare');
  const verdict = (fps, fg) => {
    const sys = withAmd(fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 144, true)));
    sys.amdSettings.perf = { byExe: { 'game.exe': { fps, p95: 9, fg, frames: 500, at: Date.UTC(2026, 9, 19) } }, games: [{ exePath: 'C:\\Games\\Test\\game.exe', title: 'Test', appid: '99' }] };
    const c = E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { lang: 'tr' });
    const r = E.recommend(E.buildProfile({ id: 'x', name: 'Test', source: 'steam', appid: '99', installDir: 'C:\\Games\\Test' }, null, null, null, null, 'tr'), c);
    return r.measured && r.measured.verdict;
  };
  assert.strictEqual(verdict(141, false), 'headroom', 'sınıra dayanıyor');
  assert.strictEqual(verdict(141, true), 'ok', 'kare üretimiyle sınırda: temel FPS 70');
  assert.strictEqual(verdict(100, false), 'ok');
  assert.strictEqual(verdict(40, false), 'low', 'FreeSync aralığının (48) altında');
  assert.strictEqual(verdict(160, false), 'over', '144 Hz üstü: FreeSync aralığından çıkılmış');
});
t('gmdb.blb: oyuna özel RSR, AFMF ve Adrenalin\'in ölçtüğü FPS', () => {
  const gm = amdS.parseGmdb(Buffer.from(JSON.stringify({ games: [{
    guid: '{5d1f57e0}', title: 'The Witcher 3: Wild Hunt — Remastered', steam_id: 292030,
    exe_path: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\The Witcher 3\\bin\\x64_dx12\\witcher3.exe',
    upscaling_enabled: 'TRUE', upscaling_use_borderless: 'FALSE', framegen_enabled: 0, FSRUpgradeAvailable: 'TRUE', MlfiAvailable: 'TRUE',
    userprofiletype: 4, averageFPS: 116.98909723583368, percentile95_msec: 10, lastperformancereporttime: 'Mon Oct 19 03:10:07 2026',
  }] })));
  assert.deepStrictEqual([gm[0].rsr, gm[0].afmf, gm[0].fps, gm[0].p95, gm[0].profileType, gm[0].fsrUpAvail], [true, false, 117, 10, 4, true]);
  const sys = withAmd(fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 144, true, 418)));
  sys.amdSettings.gm = gm;
  const c = E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { lang: 'tr' });
  const g = { id: 'x', name: 'The Witcher 3: Wild Hunt', source: 'steam', appid: '292030', installDir: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\The Witcher 3' };
  const r = E.recommend(E.buildProfile(g, gamedb.match(g), null, null, null, 'tr'), c);
  // Profilli oyunda RSR artık okunur (önceden "okunamadı" idi).
  assert.deepStrictEqual([item(r.driver.items, 'Radeon Super Resolution').state, item(r.driver.items, 'Radeon Super Resolution').cur], ['change', 'Etkin']);
  assert.strictEqual(r.measured.fps, 117, 'gmdb ölçümü');
});
t('Klasör tarama: büyük alt klasör tarama sınırını bitirse de ana dizindeki exe bulunur', () => {
  const { findExes } = require('../src/core/libraries/folders');
  const root = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rigtune-exe-'));
  try {
    fs.mkdirSync(path.join(root, 'AAA_Shaders'));
    for (let i = 0; i < 20; i++) fs.writeFileSync(path.join(root, 'AAA_Shaders', `s${i}.bin`), '');
    fs.writeFileSync(path.join(root, 'Game.exe'), 'x');
    assert.ok(findExes(root, 3, [], { n: 8 }).some(e => /Game\.exe$/.test(e.path)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
t('Yalnızca genel ayarda olan satır oyunun değişiklik sayısına girmez', () => {
  const sys = withAmd(fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 180, true)));
  const c = E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { lang: 'tr' });
  const g = { id: 'x', name: 'The Witcher 3: Wild Hunt', source: 'steam', appid: '292030', installDir: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\The Witcher 3' };
  const r = E.recommend(E.buildProfile(g, gamedb.match(g), null, null, null, 'tr'), c);
  const cap = item(r.driver.items, 'Kare Hızı Hedef Kontrolü');
  assert.deepStrictEqual([cap.globalOnly, cap.state], [true, 'change'], '180 Hz için 140 uygun değil');
  assert.strictEqual(r.driver.state.globalChange, 1);
  assert.strictEqual(r.driver.state.change, r.driver.items.filter(i => i.state === 'change' && !i.globalOnly).length);
});

console.log('NVIDIA');
const probeCP = { dlss: true, dlssFG: true, dlssRR: true, reflex: true, xess: true, fsr: 'fsr31', antiCheat: [], engine: null };
t('RTX 5080 · 4K 240 Hz · Cyberpunk: DLSS, Dynamic MFG, Reflex, VSync kapalı', () => {
  const { r } = recFor(fakeSys('NVIDIA GeForce RTX 5080', 16, mon(3840, 2160, 240, true), { driver: '596.10' }), 'Cyberpunk 2077', probeCP);
  assert.strictEqual(r.driver.app, 'NVIDIA App');
  assert.ok(/^DLSS/.test(item(r.ingame, 'Ölçekleyici').v));
  assert.strictEqual(item(r.driver.items, 'DLSS Override – Model Presets').v, 'Recommended');
  assert.ok(/Dynamic/.test(item(r.driver.items, 'DLSS Override – Frame Generation Mode').v));
  assert.strictEqual(item(r.driver.items, 'Vertical sync').v, 'Off');
  assert.ok(/Reflex/.test(item(r.ingame, 'Düşük gecikme').v));
  assert.ok(r.driver.items.some(i => i.k === 'DLSS Override – Ray Reconstruction'));
});
t('RTX 4070 · 1440p 165 Hz · Elden Ring: Smooth Motion açık', () => {
  const { r } = recFor(fakeSys('NVIDIA GeForce RTX 4070', 12, mon(2560, 1440, 165, true)), 'Elden Ring');
  assert.strictEqual(item(r.driver.items, 'NVIDIA Smooth Motion').v, 'Açık');
});
t('RTX 3070 · Cyberpunk: Preset K, kare üretimi satırı yok, G-SYNC ile sürücü VSync', () => {
  const { r } = recFor(fakeSys('NVIDIA GeForce RTX 3070', 8, mon(2560, 1440, 144, true)), 'Cyberpunk 2077', probeCP);
  assert.strictEqual(item(r.driver.items, 'DLSS Override – Model Presets').v, 'Preset K');
  assert.ok(!r.driver.items.some(i => i.k === 'NVIDIA Smooth Motion'));
  assert.strictEqual(item(r.ingame, 'Doku kalitesi').c, 'warn');
});
t('GTX 1660 SUPER · DLSS yok → FSR ya da XeSS', () => {
  const { r } = recFor(fakeSys('NVIDIA GeForce GTX 1660 SUPER', 6, mon(1920, 1080, 144, true)), 'Cyberpunk 2077', probeCP);
  assert.strictEqual(item(r.driver.items, 'DLSS').v, 'Kartın desteklemiyor');
  assert.ok(/XeSS|FSR/.test(item(r.ingame, 'Ölçekleyici').v));
  assert.strictEqual(item(r.ingame, 'Işın izleme (varsa)').v, 'Kapalı');
});
t('NVIDIA genel ayarlar: eski sürücüde Dinamik MFG uyarısı', () => {
  const sys = fakeSys('NVIDIA GeForce RTX 5070', 12, mon(2560, 1440, 165, true), { driver: '581.29' });
  const c = E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, {});
  const g = E.vendorGlobal(sys, c);
  assert.strictEqual(item(g.items, 'Sürücü sürümü').c, 'warn');
  assert.strictEqual(item(g.items, 'NVIDIA App').c, 'warn');
});

console.log('Intel');
t('Arc B580 · XeSS 2 kare üretimli oyun: XeSS, MFG override, XeLL', () => {
  const probe = { xess: true, xessFG: true, xell: true, xessMajor: 2, fsr: null, antiCheat: [], engine: null };
  const { r } = recFor(fakeSys('Intel(R) Arc(TM) B580 Graphics', 12, mon(2560, 1440, 165, true)), 'Bilinmeyen Oyun', probe);
  assert.strictEqual(r.driver.app, 'Intel Graphics Software');
  assert.ok(/^XeSS/.test(item(r.ingame, 'Ölçekleyici').v));
  assert.strictEqual(item(r.driver.items, 'Düşük gecikme (XeLL)').v, 'Oyunda XeLL açık');
});
t('Intel genel: Resizable BAR uyarısı ve eski sürücü', () => {
  const sys = fakeSys('Intel(R) Arc(TM) A770 Graphics', 16, mon(2560, 1440, 144, true), { driver: '32.0.101.6913' });
  const c = E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, {});
  const g = E.vendorGlobal(sys, c);
  assert.ok(g.items.some(i => i.k === 'Resizable BAR'));
  assert.strictEqual(item(g.items, 'Sürücü sürümü').c, 'warn');
});

console.log('Diğer');
t('Apple Silicon: sürücü bölümü yok, oyun içi öneri var', () => {
  const sys = fakeSys('Apple M3 Pro', 0, mon(3024, 1964, 120, true));
  sys.platform = 'darwin';
  const { r } = recFor(sys, 'Baldur\'s Gate 3');
  assert.strictEqual(r.driver, null);
  assert.ok(r.ingame.length > 5);
});
t('Hedef: Yüksek FPS ölçekleyiciyi daha erken önerir', () => {
  const sys = fakeSys('AMD Radeon RX 9070 XT', 16, mon(2560, 1440, 165, true));
  assert.strictEqual(recFor(sys, 'Ghost of Tsushima', null, 'denge').r.need, false);
  assert.strictEqual(recFor(sys, 'Ghost of Tsushima', null, 'fps').r.need, true);
});
t('Steam mağaza sınıflandırması', () => {
  assert.strictEqual(classify({ name: 'X', categories: [{ id: 1 }, { id: 36 }], genres: [{ id: '1' }] }).t, 'rek');
  assert.strictEqual(classify({ name: 'Y', categories: [{ id: 2 }], genres: [{ id: '2' }] }).t, 'haf');
  assert.strictEqual(classify({ name: 'Z', categories: [{ id: 2 }], genres: [{ id: '9' }] }).t, 'yar');
  assert.strictEqual(classify({ name: 'W', categories: [{ id: 2 }], genres: [{ id: '1' }], pc_requirements: { recommended: '<li>Graphics: NVIDIA GeForce RTX 3070 or AMD Radeon RX 6800</li>' } }).y, 3);
});
t('Ad değişikliği: eski veri klasörü bir kez taşınır, Playnite listesi daha yeni olandan okunur', () => {
  const { migrateDataDir } = require('../src/core/util');
  const { exportFile } = require('../src/core/libraries/playnite');
  const root = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rigtune-test-'));
  try {
    const old = path.join(root, 'Oyun Ayar Rehberi'), now = path.join(root, 'RigTune');
    fs.mkdirSync(old);
    fs.writeFileSync(path.join(old, 'settings.json'), '{"goal":"fps"}');
    fs.writeFileSync(path.join(old, 'lockfile'), '');
    assert.strictEqual(migrateDataDir(path.join(root, 'deneme')), false, 'başka adlı klasöre taşınmaz');
    assert.strictEqual(migrateDataDir(now), true);
    assert.strictEqual(fs.readFileSync(path.join(now, 'settings.json'), 'utf8'), '{"goal":"fps"}');
    assert.ok(!fs.existsSync(path.join(now, 'lockfile')), 'yalnızca uygulamanın kendi dosyaları kopyalanır');
    assert.ok(fs.existsSync(path.join(old, 'settings.json')), 'eski klasör silinmez');
    assert.strictEqual(migrateDataDir(now), false, 'ikinci kez taşınmaz');
    // Playnite eklentisinin eski sürümü listeyi eski klasöre yazar.
    fs.writeFileSync(path.join(old, 'playnite-games.json'), '{}');
    assert.strictEqual(exportFile({ appData: root }), path.join(old, 'playnite-games.json'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
t('Veritabanı eşleşmesi: Steam numarası ve ad', () => {
  assert.strictEqual(gamedb.match({ appid: '292030', name: 'The Witcher 3: Wild Hunt' }).n, 'The Witcher 3: Wild Hunt — Remastered');
  assert.strictEqual(gamedb.match({ name: "Tom Clancy's Rainbow Six Siege" }).n, 'Rainbow Six Siege X');
  assert.strictEqual(gamedb.match({ name: 'Bilinmeyen' }), null);
});

console.log('İşlemci, bellek ve disk');
t('İşlemci veritabanı: mimari, yıl, 3D V-Cache ve kısa ad', () => {
  const x = n => { const r = cpudb.lookup(n); return [r.arch, r.year, r.x3d]; };
  assert.deepStrictEqual(x('AMD Ryzen 5 9600X 6-Core Processor'), ['Zen 5', 2024, false]);
  assert.deepStrictEqual(x('AMD Ryzen 7 9800X3D 8-Core Processor'), ['Zen 5', 2024, true]);
  assert.deepStrictEqual(x('AMD Ryzen 7 7800X3D 8-Core Processor'), ['Zen 4', 2022, true]);
  assert.deepStrictEqual(x('AMD Ryzen 9 7950X 16-Core Processor'), ['Zen 4', 2022, false]);
  assert.deepStrictEqual(x('AMD Ryzen 7 PRO 7840U w/ Radeon 780M Graphics'), ['Zen 4', 2022, false]);
  assert.strictEqual(x('AMD Ryzen 5 7535HS with Radeon Graphics')[0], 'Zen 3');
  assert.strictEqual(x('AMD Ryzen 5 7520U with Radeon Graphics')[0], 'Zen 2');
  assert.strictEqual(x('AMD Ryzen 7 5800U with Radeon Graphics')[0], 'Zen 3');
  assert.strictEqual(x('AMD Ryzen 7 5700U with Radeon Graphics')[0], 'Zen 2');
  assert.deepStrictEqual(x('AMD Ryzen 7 5800X3D 8-Core Processor'), ['Zen 3', 2020, true]);
  assert.strictEqual(x('AMD Ryzen 5 3600 6-Core Processor')[0], 'Zen 2');
  assert.strictEqual(x('AMD Ryzen 5 3400G with Radeon Vega Graphics')[0], 'Zen+');
  assert.strictEqual(x('AMD Ryzen AI 9 HX 370 w/ Radeon 890M')[0], 'Zen 5');
  assert.strictEqual(x('13th Gen Intel(R) Core(TM) i5-13600K')[0], 'Raptor Lake');
  assert.strictEqual(x('Intel(R) Core(TM) i7-14700K')[0], 'Raptor Lake Refresh');
  assert.strictEqual(x('Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz')[0], 'Coffee Lake Refresh');
  assert.strictEqual(x('11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz')[0], 'Rocket Lake / Tiger Lake');
  assert.strictEqual(x('Intel(R) Core(TM) Ultra 7 265K')[0], 'Arrow Lake');
  assert.strictEqual(x('Intel(R) Core(TM) Ultra 7 258V')[0], 'Lunar Lake');
  assert.deepStrictEqual(x('Apple M3 Pro'), ['Apple M3', 2023, false]);
  assert.strictEqual(cpudb.lookup('Bilinmeyen İşlemci').known, false);
  assert.strictEqual(cpudb.shortName('AMD Ryzen 5 9600X 6-Core Processor'), 'Ryzen 5 9600X');
  assert.strictEqual(cpudb.shortName('13th Gen Intel(R) Core(TM) i5-13600K'), 'Core i5-13600K');
  assert.strictEqual(cpuInfo({ name: 'AMD Ryzen 5 9600X 6-Core Processor', l3KB: 32768 }).l3MB, 32);
});

// Ham disk bilgisi (windows-system.ps1 çıktısının biçimi). MediaType 3 HDD, 4 SSD; BusType 11 SATA, 17 NVMe, 7 USB.
const rawStorage = {
  systemDrive: 'C:',
  disks: [{ n: 0, name: 'NVMe Disk', bus: 17, media: 4, size: 2e12 }, { n: 1, name: 'SATA HDD', bus: 11, media: 3, size: 2e12 }, { n: 2, name: 'SATA SSD', bus: 11, media: 4, size: 5e11 }, { n: 3, name: 'USB Bellek', bus: 7, media: 0, size: 3.2e10 }],
  partitions: [{ disk: 0, letter: 'C' }, { disk: 1, letter: 'E' }, { disk: 2, letter: 'D' }, { disk: 3, letter: 'U' }],
  volumes: [{ letter: 'C', label: '', type: 3, size: 1000 * 2 ** 30, free: 50 * 2 ** 30 }, { letter: 'E', label: 'Oyun', type: 3, size: 1800 * 2 ** 30, free: 100 * 2 ** 30 },
    { letter: 'D', label: '', type: 3, size: 465 * 2 ** 30, free: 300 * 2 ** 30 }, { letter: 'U', label: 'USB', type: 2, size: 30 * 2 ** 30, free: 29 * 2 ** 30 }, { letter: 'Z', label: 'DVD', type: 5, size: 0, free: 0 }],
};
const storage = storageFromWin(rawStorage);
t('Diskler: tür, bağlantı, sistem diski ve sürücü harfi eşlemesi', () => {
  assert.deepStrictEqual(storage.volumes.map(v => [v.letter, v.kind, v.bus, v.system, v.removable]), [['C', 'nvme', 'NVMe', true, false], ['D', 'ssd', 'SATA', false, false], ['E', 'hdd', 'SATA', false, false], ['U', null, 'USB', false, true]]);
  assert.strictEqual(hw.volumeOf('e:\\SteamLibrary\\steamapps\\common\\Oyun', storage).letter, 'E');
  assert.strictEqual(hw.volumeOf('C:/Games/Oyun', storage).letter, 'C');
  assert.strictEqual(hw.volumeOf('\\\\nas\\oyunlar', storage), null);
  const linux = { volumes: [{ mount: '/' }, { mount: '/home' }, { mount: '/mnt/oyun' }] };
  assert.strictEqual(hw.volumeOf('/home/u/Games/x', linux).mount, '/home');
  assert.strictEqual(hw.volumeOf('/homework/x', linux).mount, '/');
  assert.strictEqual(hw.volumeOf('/mnt/oyun', linux).mount, '/mnt/oyun');
});
t('Steam gereksinimi: bellek ve SSD şartı', () => {
  const li = (k, v) => `<li><strong>${k}:</strong> ${v}<br></li>`;
  const req = (min, rec) => parseReq({ minimum: `<strong>Minimum:</strong><br><ul class="bb_ul">${min}</ul>`, recommended: rec ? `<strong>Recommended:</strong><br><ul class="bb_ul">${rec}</ul>` : undefined });
  assert.deepStrictEqual(req(li('Memory', '12 GB RAM') + li('Storage', '70 GB available space') + li('Additional Notes', 'SSD required'), li('Memory', '16 GB RAM')), { ramMin: 12, ramRec: 16, ssd: 'req' });
  assert.deepStrictEqual(req(li('Memory', '8192 MB RAM') + li('Storage', '150 GB SSD')), { ramMin: 8, ramRec: null, ssd: 'req' });
  assert.strictEqual(req(li('Storage', '50 GB available space (SSD recommended)')).ssd, 'rec');
  assert.strictEqual(req(li('Storage', '50 GB HDD/SSD')).ssd, null);
  assert.deepStrictEqual(parseReq([]), { ramMin: null, ramRec: null, ssd: null });
  assert.strictEqual(classify({ name: 'X', categories: [{ id: 2 }], genres: [], pc_requirements: { minimum: li('Memory', '16 GB RAM') } }).ramMin, 16);
});

// Donanımlı sahte sistem: Ryzen 5 9600X, 16 GB bellek ve yukarıdaki diskler.
const hwSys = (display, ram = 16) => Object.assign(fakeSys('AMD Radeon RX 9070 XT', 16, display), { cpu: cpuInfo({ name: 'AMD Ryzen 5 9600X 6-Core Processor', cores: 6, threads: 12 }), ram: { totalGB: ram }, storage });
function hwRec(sys, game, extra = {}, lang = 'tr') {
  const c = E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { lang });
  const g = { id: 'x', source: 'steam', ...game };
  return E.recommend(E.buildProfile(g, extra.db === undefined ? gamedb.match(g) : extra.db, extra.probe || null, extra.meta || null, null, lang), c);
}
const on = (r, re) => r.notes.some(n => re.test(n));
t('HDD: ağır, açık dünya ve UE5 oyunlarında not; hafif oyunda yok', () => {
  const sys = hwSys(mon(3440, 1440, 144, true));
  const cp = hwRec(sys, { name: 'Cyberpunk 2077', installDir: 'E:\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077' });
  assert.ok(cp.hdd && on(cp, /sabit diskte \(HDD, E:\)/) && on(cp, /SSD'ye taşı/), cp.notes.join(' | '));
  assert.deepStrictEqual(cp.disk, { mount: 'E:\\', letter: 'E', kind: 'hdd' });
  assert.deepStrictEqual(cp.tags.find(x => x.t === 'E: · HDD'), { t: 'E: · HDD', k: 'w' });
  // Açık dünya ama GPU yükü 2: ow alanı yüzünden not verilir.
  assert.ok(on(hwRec(sys, { name: 'Ghost of Tsushima', installDir: 'E:\\Games\\Ghost' }), /Açık dünya/));
  // Hafif oyun HDD'de: not yok, etiket var.
  const hades = hwRec(sys, { name: 'Hades II', installDir: 'E:\\Games\\Hades II' });
  assert.ok(!hades.hdd && !on(hades, /HDD/));
  assert.deepStrictEqual(hades.tags.find(x => /HDD/.test(x.t)).k, '');
  // Veritabanında olmayan Unreal Engine 5 oyunu
  assert.ok(on(hwRec(sys, { name: 'Bilinmeyen UE5', installDir: 'E:\\Games\\UE5' }, { db: null, probe: { engine: 'Unreal Engine 5.4', antiCheat: [] } }), /Unreal Engine 5 oyunları oyun sırasında/));
  // Steam gereksinimi SSD istiyor (hafif oyun bile olsa)
  const st = hwRec(sys, { name: 'Bilinmeyen', installDir: 'E:\\Games\\B' }, { db: null, meta: { t: 'aks', y: 1, ssd: 'req' } });
  assert.ok(st.hdd && on(st, /sistem gereksinimi SSD istiyor/));
  // SSD'deki ağır oyun: not yok
  const ssd = hwRec(sys, { name: 'Cyberpunk 2077', installDir: 'C:\\Games\\Cyberpunk 2077' });
  assert.ok(!ssd.hdd && !on(ssd, /HDD/));
  assert.deepStrictEqual(ssd.tags.find(x => /C:/.test(x.t)), { t: 'C: · NVMe SSD', k: '' });
});
t('İşlemci: strateji ve işlemciye bağlı oyunlarda ölçekleyici notu; rekabetçide yüksek Hz notu', () => {
  const sys = hwSys(mon(3440, 1440, 144, true));
  // Kendi notu işlemciden söz eden oyunda kısa not
  const bl = hwRec(sys, { name: 'Mount & Blade II: Bannerlord' });
  assert.ok(on(bl, /^Sınır işlemcide \(Ryzen 5 9600X\); ölçekleyici bu oyunda FPS'i artırmaz\.$/), bl.notes.join(' | '));
  assert.ok(bl.tags.some(x => x.t === 'İşlemciye bağlı'));
  // Notu olmayan strateji oyununda uzun not
  assert.ok(on(hwRec(sys, { name: 'Age of Empires II: Definitive Edition' }), /^Bu oyunda FPS'i çoğunlukla işlemci \(Ryzen 5 9600X\) belirler/));
  // Paradox motoru, veritabanında olmayan oyun
  assert.ok(on(hwRec(sys, { name: 'Bilinmeyen Paradox' }, { db: null, probe: { engine: 'Clausewitz / Jomini', antiCheat: [] } }), /işlemci/));
  // cpu: 0 ile dışarıda tutulan oyun ve ağır oyun
  assert.ok(!on(hwRec(sys, { name: 'Hades II' }), /işlemci/));
  assert.ok(!on(hwRec(sys, { name: 'Cyberpunk 2077' }), /işlemci/));
  // Rekabetçi oyun: 144 Hz'de not var, 60 Hz'de yok
  assert.ok(on(hwRec(sys, { name: 'Counter-Strike 2' }), /FPS sınırsızken kare hızını çoğunlukla işlemci/));
  assert.ok(!on(hwRec(hwSys(mon(1920, 1080, 60, false)), { name: 'Counter-Strike 2' }), /işlemci/));
});
t('Bellek: Steam gereksinimiyle karşılaştırma', () => {
  const sys = hwSys(mon(2560, 1440, 165, true), 16);
  const r = meta => hwRec(sys, { name: 'Bilinmeyen' }, { db: null, meta: { t: 'aks', y: 2, ...meta } });
  assert.ok(on(r({ ramMin: 12, ramRec: 32 }), /önerilen bellek 32 GB/));
  assert.ok(on(r({ ramMin: 24, ramRec: 32 }), /en düşük sistem gereksinimi 24 GB/));
  assert.ok(!on(r({ ramMin: 8, ramRec: 16 }), /bellek/i));
  assert.ok(!on(hwRec(hwSys(mon(2560, 1440, 165, true), 32), { name: 'Bilinmeyen' }, { db: null, meta: { t: 'aks', y: 2, ramRec: 32 } }), /bellek/i));
});
t('Disk kontrolleri: sistem diski ve oyun diskinde %10 altı, HDD\'deki oyunlar', () => {
  const sys = hwSys(mon(3440, 1440, 144, true));
  const c = E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { lang: 'tr' });
  const games = [
    { name: 'Cyberpunk 2077', installDir: 'E:\\Games\\Cyberpunk 2077', rec: { hdd: true } },
    { name: 'Hades II', installDir: 'E:\\Games\\Hades II', rec: { hdd: false } },
    { name: 'Witcher', installDir: 'D:\\Games\\Witcher', rec: { hdd: false } },
    { name: 'Hazır liste', installDir: null, catalog: true, rec: { hdd: true } },
  ];
  const ch = E.systemChecks(sys, c, games).filter(x => x.area === 'disk');
  // C: %5 boş (50/1000), E: %5,6 boş (100/1800), D: %65 boş
  assert.deepStrictEqual(ch.map(x => [x.level, x.title]), [
    ['warn', 'Sistem diskinde (C:) yer azaldı: %5 boş (50 GB)'],
    ['warn', 'Oyun diskinde (E:) yer azaldı: %6 boş (100 GB)'],
    ['info', "Sabit diskte (HDD) yüklü ve SSD'den fayda görecek oyunlar: 1"],
  ]);
  assert.ok(/Cyberpunk 2077, Hades II/.test(ch[1].detail));
  assert.ok(ch[2].detail.startsWith('Cyberpunk 2077.'));
  // Yeterli boş alan: "ok" kontrolü; disk bilgisi yoksa kontrol yok
  const roomy = { ...sys, storage: storageFromWin({ ...rawStorage, volumes: rawStorage.volumes.map(v => ({ ...v, free: v.size / 2 })) }) };
  assert.deepStrictEqual(E.systemChecks(roomy, c, []).filter(x => x.area === 'disk').map(x => [x.level, x.title]), [['ok', 'Sistem diskinde (C:) yeterli boş alan var (%50)']]);
  assert.strictEqual(E.systemChecks({ ...sys, storage: null }, c, games).filter(x => x.area === 'disk').length, 0);
});
t('Değişiklik geçmişi: disk takılıp çıkarılması; USB ve eski kayıtlar sayılmaz', () => {
  const base = { os: {}, cpu: {}, ram: null, gpus: [], displays: [], apps: {}, winSettings: null };
  const fp = disks => fingerprint({ ...base, storage: { disks, volumes: [] } }, { games: [] });
  const a = fp([{ name: 'A', bus: 'NVMe' }, { name: 'U', bus: 'USB' }]);
  const b = fp([{ name: 'A', bus: 'NVMe' }, { name: 'A', bus: 'NVMe' }, { name: 'B', bus: 'SATA' }]);
  assert.deepStrictEqual(a.disks, { A: 1 });
  assert.deepStrictEqual(diff(a, b).map(x => [x.key, x.p.name]), [['diskNew', 'A'], ['diskNew', 'B']]);
  assert.deepStrictEqual(diff(b, a).map(x => [x.key, x.p.name]), [['diskRemoved', 'A'], ['diskRemoved', 'B']]);
  assert.deepStrictEqual(diff({ ...b, disks: undefined }, b), []);
  assert.strictEqual(changeText(diff(a, b)[0], translator('en')), 'New disk: A');
});

console.log('Dil desteği');
t('Dil dosyaları: tr ve en aynı anahtarları ve yer tutucuları taşır', () => {
  const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(',');
  const walk = (a, b, p) => {
    if (typeof a === 'string') { assert.strictEqual(typeof b, 'string', `${p}: en'de metin değil`); assert.strictEqual(ph(b), ph(a), `${p}: yer tutucular farklı`); return; }
    if (Array.isArray(a)) { assert.ok(Array.isArray(b) && b.length === a.length, `${p}: dizi uzunluğu farklı`); a.forEach((x, i) => walk(x, b[i], `${p}.${i}`)); return; }
    assert.deepStrictEqual(Object.keys(b || {}).sort(), Object.keys(a).sort(), `${p || 'kök'}: anahtarlar farklı`);
    for (const k of Object.keys(a)) walk(a[k], b[k], p ? `${p}.${k}` : k);
  };
  walk(LOCALES.tr, LOCALES.en, '');
});
t('Sistem dili: Türkçe sistemde tr, diğerlerinde en; elle seçim önceliklidir', () => {
  assert.strictEqual(resolveLang('system', 'tr-TR'), 'tr');
  assert.strictEqual(resolveLang('system', 'en-US'), 'en');
  assert.strictEqual(resolveLang('system', 'de-DE'), 'en');
  assert.strictEqual(resolveLang(undefined, 'tr'), 'tr');
  assert.strictEqual(resolveLang('en', 'tr-TR'), 'en');
  assert.strictEqual(resolveLang('tr', 'en-US'), 'tr');
});
t('Oyun notlarının hepsinin İngilizcesi var', () => {
  for (const g of gamedb.G) for (const k of ['no', 'noAmd', 'tips']) {
    if (g[k] == null) continue;
    assert.ok(g.en && g.en[k] != null, `${g.n}: en.${k} eksik`);
    if (k === 'tips') assert.strictEqual(g.en.tips.length, g.tips.length, `${g.n}: ipucu sayısı farklı`);
  }
});
t('Witcher 3 · RX 9070 XT İngilizce: sürücü adları özgün, Adrenalin\'in İngilizce adları', () => {
  const sys = fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 144, true, 418));
  const { r } = recFor(sys, 'The Witcher 3: Wild Hunt', null, 'denge', 'en');
  assert.strictEqual(r.driver.path, 'Gaming > Games > The Witcher 3: Wild Hunt > profile');
  assert.strictEqual(item(r.driver.items, 'AMD FSR Upscaling').v, 'Not needed');
  assert.strictEqual(item(r.driver.items, 'AMD FSR Frame Generation').c, 'on');
  assert.strictEqual(item(r.driver.items, 'Frame Rate Target Control').v, 'Enabled · Max FPS 141');
  assert.strictEqual(item(r.driver.items, 'Wait for Vertical Refresh').v, 'Off, unless application specifies');
  assert.strictEqual(item(r.ingame, 'Upscaler').v, 'In-game FSR 4 · Quality');
  assert.ok(r.notes[0].startsWith('The 29 September 2026 remaster'));
});
t('İngilizce öneriler: Türkçe metin kalmaz, kararlar dilden bağımsız', () => {
  const systems = [
    fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 144, true, 418)),
    withAmd(fakeSys('AMD Radeon RX 9070 XT', 16, mon(2560, 1440, 165, true))),
    fakeSys('AMD Radeon RX 7900 XTX', 24, mon(3840, 2160, 120, true)),
    fakeSys('AMD Radeon RX 6700 XT', 12, mon(1920, 1080, 60, false)),
    fakeSys('NVIDIA GeForce RTX 5080', 16, mon(3840, 2160, 240, true, 1000), { driver: '581.29' }),
    fakeSys('NVIDIA GeForce GTX 1660 SUPER', 6, mon(1920, 1080, 144, true)),
    fakeSys('Intel(R) Arc(TM) B580 Graphics', 12, mon(2560, 1440, 165, true)),
    Object.assign(fakeSys('Apple M3 Pro', 0, mon(3024, 1964, 120, true)), { platform: 'darwin' }),
    hwSys(mon(3440, 1440, 144, true)),
  ];
  const hwGames = [{ name: 'A', installDir: 'E:\\Games\\A', rec: { hdd: true } }];
  const names = gamedb.G.map(x => x.n);
  const bad = new Set();
  const collect = v => { if (typeof v === 'string') { if (/[çğıöşüÇĞİÖŞÜ]/.test(v) && !names.some(n => v.includes(n))) bad.add(v); } else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
  const shape = r => JSON.stringify([r.L, r.need, r.driver && r.driver.items.map(i => [i.id, i.c]), r.ingame.map(i => [i.id, i.c]), r.notes.length, r.hdd]);
  for (const sys of systems) {
    for (const goal of ['kalite', 'denge', 'fps']) {
      const ctx = lang => E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { goal, lang });
      const ce = ctx('en'), ct = ctx('tr');
      collect(E.vendorGlobal(sys, ce)); collect(E.systemChecks(sys, ce, hwGames));
      for (const x of gamedb.G) {
        for (const probe of [null, probeCP, { engine: 'Unreal Engine 5', antiCheat: ['EAC'] }]) {
          // Klasör HDD'de (E:); mağaza bilgisi bellek ve SSD notlarını da üretir.
          const db = probe ? null : x, g = { id: 'x', name: x.n, source: 'steam', installDir: 'E:\\Games\\' + x.n };
          const meta = probe ? { t: 'aks', y: 2, ramMin: 24, ramRec: 32, ssd: 'req' } : null;
          const re = E.recommend(E.buildProfile(g, db, probe, meta, null, 'en'), ce);
          collect(re);
          assert.strictEqual(shape(re), shape(E.recommend(E.buildProfile(g, db, probe, meta, null, 'tr'), ct)), `${x.n}: tr ve en kararları farklı`);
        }
      }
    }
  }
  assert.deepStrictEqual([...bad].slice(0, 5), []);
});
t('Değişiklik metinleri iki dilde; eski kayıtlar olduğu gibi kalır', () => {
  const snap = (os, hdr, hags, games) => ({ os, cpu: 'C', ram: 'R', gpus: {}, displays: { d: { name: 'M', mode: 'x', hdr } }, apps: {}, win: { hags }, games });
  const items = diff(snap('A', false, true, {}), snap('B', true, false, Object.fromEntries('ABCDE'.split('').map(n => [n, { name: n }]))));
  const tx = lang => items.map(i => changeText(i, translator(lang)));
  assert.deepStrictEqual(tx('tr'), ['İşletim sistemi güncellendi: A → B', 'M: HDR açıldı', 'Donanım hızlandırmalı GPU zamanlaması: açık → kapalı', 'Yeni oyun: A, B, C, D ve 1 oyun daha']);
  assert.deepStrictEqual(tx('en'), ['Operating system updated: A → B', 'M: HDR turned on', 'Hardware-accelerated GPU scheduling: on → off', 'New game: A, B, C, D and 1 more']);
  assert.strictEqual(changeText({ type: 'game', text: 'Yeni oyun: X' }, translator('en')), 'Yeni oyun: X');
  assert.strictEqual(changeText({ type: 'info', text: 'İlk analiz yapıldı.' }, translator('en')), 'First analysis done.');
});

console.log('Oyun ayar dosyaları');
const gamecfg = require('../src/core/gamecfg');
// Sahte Witcher 3 ayar dosyası (gerçek dosyanın biçimi; değerler denemeye göre seçildi).
const W3 = ['[Viewport]', 'VSync=true', 'Resolution="2560x1440"', 'FullScreenMode=2', 'AMDAntiLag=0', '[PostProcess]', 'AAMode=5', 'FSR2Quality=2', 'FSRFramegen=1', '[Visuals]', 'HdrEnabled=true', '[Engine]', 'LimitFPS=60'].join('\r\n');
const W3G = { id: 'x', name: 'The Witcher 3: Wild Hunt', source: 'steam', appid: '292030', installDir: 'C:\\Games\\The Witcher 3' };
t('Witcher 3: anlamı kesin değerler çözülür, sayısal kodlar dosyadaki hâliyle kalır', () => {
  const r = gamecfg.parseWitcher3(W3);
  assert.deepStrictEqual(r.v, { res: { w: 2560, h: 1440 }, vsync: true, latency: false, fg: true, hdr: true, cap: 60 });
  assert.deepStrictEqual(r.raw, { display: 'FullScreenMode=2', up: 'AAMode=5 · FSR2Quality=2' });
});
t('RDR2: system.xml', () => {
  const r = gamecfg.parseRdr2('<x>\n<screenWidth value="3440" />\n<screenHeight value="1440" />\n<windowed value="2" />\n<vSync value="0" />\n<hdr value="false" />\n<fsr2Index value="1" />\n<dlssIndex value="0" />\n</x>');
  assert.deepStrictEqual(r.v, { res: { w: 3440, h: 1440 }, display: 'borderless', vsync: false, hdr: false, fg: false, up: { kind: 'fsr', gen: '2', mode: 'q', src: 'fsr2Index=1' } });
  assert.deepStrictEqual(r.raw, {});
  // Doğrulanmamış değerler dosyadaki hâliyle kalır.
  const u = gamecfg.parseRdr2('<windowed value="1" />\n<fsr2Index value="3" />');
  assert.deepStrictEqual(u.raw, { display: 'windowed=1', up: 'fsr2Index=3' });
});
t('Unreal Engine: GameUserSettings.ini; ölçekleyici yalnızca adı kendini anlatıyorsa çözülür', () => {
  const a = gamecfg.parseUnreal('[/Script/Game.Settings]\nUpscaleMode=AMD_FSR2_Quality\nUpscaleSoftness=0.200000\nFrameGeneration=(Mode=Off,NumFramesInterpolated=0,LocStr="Off")\nResolutionSizeX=3440\nResolutionSizeY=1440\nFullscreenMode=1\nFrameRateLimit=180.000000\nbUseHDRDisplayOutput=True\n');
  assert.deepStrictEqual(a.v, { res: { w: 3440, h: 1440 }, display: 'borderless', cap: 180, hdr: true, up: { kind: 'fsr', gen: '2', mode: 'q', src: 'UpscaleMode=AMD_FSR2_Quality' }, fg: false });
  const b = gamecfg.parseUnreal('[/Script/G.S]\nUpscalingMethod=1\nUpscalingQualityDLSS=2\nUpscalingQualityFSR=2\nFrameGenerationFSREnabled=False\nFrameGenerationDLSS=0\nbUseVSync=False\nFullscreenMode=0\nFrameRateLimit=0.000000\n[/Script/Engine.GameUserSettings]\n');
  assert.deepStrictEqual(b.v, { display: 'fullscreen', vsync: false, cap: 0, fg: false });
  assert.deepStrictEqual(b.raw, { up: 'UpscalingMethod=1 · UpscalingQualityFSR=2' });
  assert.deepStrictEqual(gamecfg.upscalerText('XeSS_UltraPerformance'), { kind: 'xess', gen: undefined, mode: 'up' });
  assert.deepStrictEqual(gamecfg.upscalerText('Off'), { kind: 'off' });
  assert.strictEqual(gamecfg.upscalerText('3'), undefined);
  assert.deepStrictEqual(gamecfg.unrealNames({ exes: ['G1R-Win64-Shipping.exe', 'G1R\\Binaries\\Win64\\G1R-Win64-Shipping.exe'] }), ['G1R']);
  assert.deepStrictEqual(gamecfg.unrealNames({ exes: ['HogwartsLegacy.exe', 'Phoenix\\Binaries\\Win64\\HogwartsLegacy.exe', 'Engine\\Binaries\\Win64\\CrashHelper.exe'] }), ['HogwartsLegacy', 'Phoenix', 'CrashHelper']);
});
t('Ayar dosyası oyunun kendi adlarından bulunur; değişmeyen dosya yeniden çözülmez', () => {
  const root = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rigtune-cfg-'));
  try {
    const e = { documents: path.join(root, 'Docs'), localAppData: path.join(root, 'Local') };
    fs.mkdirSync(path.join(e.documents, 'The Witcher 3'), { recursive: true });
    fs.writeFileSync(path.join(e.documents, 'The Witcher 3', 'dx12user.settings'), W3);
    const w = gamecfg.readGameConfig(W3G, null, e);
    assert.deepStrictEqual([w.kind, path.basename(w.file), w.v.cap], ['witcher3', 'dx12user.settings', 60]);
    assert.strictEqual(gamecfg.readGameConfig(W3G, null, e, w), w, 'dosya değişmediyse önceki sonuç');
    const ue = { id: 'u', name: 'G', source: 'steam', installDir: 'C:\\Games\\G' };
    const probe = { engine: 'Unreal Engine 5.4', exes: ['G1R\\Binaries\\Win64\\G1R-Win64-Shipping.exe'] };
    assert.strictEqual(gamecfg.readGameConfig(ue, probe, e), null, 'dosya yoksa null');
    fs.mkdirSync(path.join(e.localAppData, 'G1R', 'Saved', 'Config', 'Windows'), { recursive: true });
    fs.writeFileSync(path.join(e.localAppData, 'G1R', 'Saved', 'Config', 'Windows', 'GameUserSettings.ini'), '\uFEFF[/Script/Engine.GameUserSettings]\r\nResolutionSizeX=1920\r\nResolutionSizeY=1080\r\n');
    assert.deepStrictEqual(gamecfg.readGameConfig(ue, probe, e).v, { res: { w: 1920, h: 1080 } });
    assert.strictEqual(gamecfg.readGameConfig({ id: 'n', name: 'N', installDir: 'C:\\N' }, { engine: 'Unity 2022.3', exes: ['N.exe'] }, e), null, 'tanınmayan oyun');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
t('Oyun içi öneriler oyunun ayar dosyasıyla karşılaştırılır', () => {
  const sys = withAmd(fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 144, true, 418)));
  const ctx = lang => E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { lang });
  const rec = (cfg, lang = 'tr') => { const p = E.buildProfile(W3G, gamedb.match(W3G), null, null, null, lang); p.cfg = cfg; return E.recommend(p, ctx(lang)); };
  const r = rec(gamecfg.parseWitcher3(W3));
  const it = k => item(r.ingame, k);
  assert.deepStrictEqual([it('Çözünürlük').state, it('Çözünürlük').cur], ['change', '2560×1440']);
  assert.deepStrictEqual([it('VSync (oyun içi)').state, it('VSync (oyun içi)').cur], ['change', 'Açık'], 'FreeSync varken oyunda VSync kapalı');
  assert.strictEqual(it('Düşük gecikme').state, 'change');
  assert.strictEqual(it('Kare üretimi (oyun içi)').state, 'ok');
  assert.strictEqual(it('HDR').state, 'ok', "Windows'ta HDR açık, oyunda da açık");
  assert.deepStrictEqual([it('FPS sınırı (oyun içi)').state, it('FPS sınırı (oyun içi)').cur], ['change', '60 FPS']);
  assert.deepStrictEqual([it('Ekran modu').state, it('Ekran modu').raw], ['unknown', 'FullScreenMode=2']);
  assert.deepStrictEqual([it('Ölçekleyici').state, it('Ölçekleyici').raw], ['unknown', 'AAMode=5 · FSR2Quality=2']);
  assert.strictEqual(it('Grafik ön ayarı').state, 'na', 'ön ayar karşılaştırılmaz');
  assert.deepStrictEqual([r.ingameState.kind, r.ingameState.change, r.ingameState.unknown], ['witcher3', 4, 2]);
  // Oyunda sınır yok ama Adrenalin'deki Kare Hızı Hedef Kontrolü (140) öneriye uygun: değiştir denmez.
  const free = item(rec(gamecfg.parseWitcher3(W3.replace('LimitFPS=60', 'LimitFPS=0'))).ingame, 'FPS sınırı (oyun içi)');
  assert.deepStrictEqual([free.state, free.cur], ['ok', 'Sınırsız']);
  assert.ok(free.why.startsWith("Adrenalin'deki Kare Hızı Hedef Kontrolü (140 FPS)"));
  // Windows'ta HDR kapalıyken oyundaki HDR karşılaştırılmaz.
  const sdr = withAmd(fakeSys('AMD Radeon RX 9070 XT', 16, Object.assign(mon(3440, 1440, 144, true), { hdr: { supported: true, enabled: false } })));
  const p2 = E.buildProfile(W3G, gamedb.match(W3G), null, null, null, 'tr'); p2.cfg = gamecfg.parseWitcher3(W3);
  assert.strictEqual(item(E.recommend(p2, E.context(sdr, { gpu: sdr.gpus[0], display: sdr.displays[0] }, { lang: 'tr' })).ingame, 'HDR').state, 'na');
  // İngilizce: aynı kararlar, Türkçe metin yok.
  const en = rec(gamecfg.parseWitcher3(W3), 'en');
  assert.deepStrictEqual(en.ingame.map(i => i.state), r.ingame.map(i => i.state));
  assert.deepStrictEqual([item(en.ingame, 'VSync (in game)').cur, item(en.ingame, 'Display mode').state], ['On', 'unknown']);
  assert.ok(!/[çğıöşüÇĞİÖŞÜ]/.test(JSON.stringify(en.ingame)), 'İngilizce çıktıda Türkçe metin');
  // Ayar dosyası yoksa karşılaştırma yapılmaz.
  assert.strictEqual(rec(null).ingameState, null);
  assert.ok(!rec(null).ingame.some(i => 'state' in i));
});
t('Unreal oyununda ölçekleyici, ekran modu ve FPS sınırı karşılaştırılır', () => {
  const sys = withAmd(fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 144, true, 418)));
  const c = E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { lang: 'tr' });
  const g = { id: 'h', name: 'Hogwarts Legacy', source: 'steam', installDir: 'C:\\Games\\Hogwarts Legacy' };
  const p = E.buildProfile(g, gamedb.match(g), { engine: 'Unreal Engine 4.27', antiCheat: [], fsr: 'fsr2' }, null, null, 'tr');
  p.cfg = gamecfg.parseUnreal('[S]\nUpscaleMode=AMD_FSR2_Balanced\nResolutionSizeX=3440\nResolutionSizeY=1440\nFullscreenMode=2\nFrameRateLimit=180.000000\nbUseVSync=False\n');
  const r = E.recommend(p, c);
  assert.ok(r.need, 'bu oyunda ölçekleyici öneriliyor');
  assert.deepStrictEqual([item(r.ingame, 'Ölçekleyici').state, item(r.ingame, 'Ölçekleyici').cur], ['change', 'FSR 2 · Dengeli'], 'öneri Kalite');
  assert.deepStrictEqual([item(r.ingame, 'Ekran modu').state, item(r.ingame, 'Ekran modu').cur], ['change', 'Pencere']);
  // AFMF önerildiği için yarım sınır (70) oyun içinden konur; Adrenalin'deki Kare Hızı Hedef Kontrolü bunun yerini tutmaz.
  assert.deepStrictEqual([item(r.ingame, 'FPS sınırı (oyun içi)').state, item(r.ingame, 'FPS sınırı (oyun içi)').v], ['change', '70 FPS']);
  p.cfg = gamecfg.parseUnreal('[S]\nFrameRateLimit=70.000000\n');
  assert.strictEqual(item(E.recommend(p, c).ingame, 'FPS sınırı (oyun içi)').state, 'ok');
  assert.strictEqual(item(r.ingame, 'VSync (oyun içi)').state, 'ok');
  // Dosyadaki FSR sürümü önerilenden farklı: karar verilmez, dosyadaki değer gösterilir.
  const p3 = E.buildProfile(g, gamedb.match(g), { engine: 'Unreal Engine 4.27', antiCheat: [], fsr: 'fsr31' }, null, null, 'tr');
  p3.cfg = gamecfg.parseUnreal('[S]\nUpscaleMode=AMD_FSR2_Quality\n');
  const up3 = item(E.recommend(p3, c).ingame, 'Ölçekleyici');
  assert.deepStrictEqual([up3.state, up3.raw], ['unknown', 'UpscaleMode=AMD_FSR2_Quality']);
  assert.strictEqual(p3.cfg.raw.up, undefined, 'önbellekteki sonuç değişmez');
});
t('RDR2: menüdeki bütün grafik ayarları dosyadan okunur ve önerilerle karşılaştırılır', () => {
  const xml = ['<graphics>', '<textureQuality>kSettingLevel_Ultra</textureQuality>', '<anisotropicFiltering value="4" />', '<msaa value="0" />', '<fsr2Index value="1" />', '</graphics>',
    '<advancedGraphics>', '<API>kSettingAPI_Vulkan</API>', '<locked value="false" />', '<volumetricsRaymarchQuality>kSettingLevel_Ultra</volumetricsRaymarchQuality>',
    '<volumetricsRaymarchResolutionUnclamped value="true" />', '<reflectionMSAA value="2" />', '<scalingMode>kSettingScale_Mode1o1</scalingMode>', '<grassLod value="3.000000" />',
    '<treeTessellationEnabled value="true" />', '<waterReflectionQuality>kSettingLevel_Low</waterReflectionQuality>', '</advancedGraphics>',
    '<video>', '<screenWidth value="3440" />', '<screenHeight value="1440" />', '<windowed value="2" />', '<vSync value="0" />', '<tripleBuffered value="false" />', '</video>'].join('\n');
  const cfg = gamecfg.parseRdr2(xml);
  assert.deepStrictEqual([cfg.all.texture, cfg.all.aniso, cfg.all.msaa, cfg.all.fsr2, cfg.all.api, cfg.all.resScale, cfg.all.reflectionMsaa, cfg.all.grassLod, cfg.all.screenType], ['Ultra', 'X16', 'Off', 'Quality', 'Vulkan', 'Off', 'X4', '3', 'Windowed Borderless']);
  const sys = withAmd(fakeSys('AMD Radeon RX 9070 XT', 16, mon(3440, 1440, 144, true, 418)));
  const rec = lang => { const g = { id: 'r', name: 'Red Dead Redemption 2', source: 'steam', appid: '1174180', installDir: 'C:\\Games\\RDR2' }; const pr = E.buildProfile(g, gamedb.match(g), null, null, null, lang); pr.cfg = cfg; return E.recommend(pr, E.context(sys, { gpu: sys.gpus[0], display: sys.displays[0] }, { lang })); };
  const r = rec('tr'), gs = r.gameSettings;
  const st = id => gs.items.find(i => i.id === id).state;
  assert.deepStrictEqual(['volUnlocked', 'reflectionMsaa', 'treeTess'].map(st), ['change', 'change', 'change']);
  assert.deepStrictEqual(['texture', 'aniso', 'msaa', 'screenType', 'vsync', 'api'].map(st), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
  assert.strictEqual(st('waterReflection'), 'na', 'aralık dışı tercih ayarı değiştir denmez');
  assert.strictEqual(st('lighting'), 'unknown', 'dosyada olmayan ayar');
  assert.strictEqual(gs.change, gs.items.filter(i => i.state === 'change').length);
  assert.deepStrictEqual(gs.groups.map(x => x[0]), ['Display', 'Graphics', 'Advanced Graphics']);
  const en = rec('en').gameSettings;
  assert.deepStrictEqual(en.items.map(i => i.state), gs.items.map(i => i.state));
  assert.ok(!/[çğıöşüÇĞİÖŞÜ]/.test(JSON.stringify(en)), 'İngilizce çıktıda Türkçe metin');
  assert.strictEqual(recFor(sys, 'Cyberpunk 2077').r.gameSettings, null);
});
t('Xbox oyunu: Adrenalin profili WindowsApps yolundan paket adıyla eşleşir, sürümü tutan ya da en yeni seçilir', () => {
  const W = v => 'C:\\Program Files\\WindowsApps\\Microsoft.MSPhoenix_' + v + '_x64__8wekyb3d8bbwe\\Game';
  const amd = { profiles: [{ dir: W('101.103.54800.0'), s: { v: 'eski' } }, { dir: W('101.103.57257.0'), s: { v: 'yeni' } }, { dir: 'C:\\Program Files\\WindowsApps\\Microsoft.Other_1.0.0.0_x64__x', s: { v: 'baska' } }],
    gm: [{ exePath: 'C:\\Program Files\\WindowsApps\\Microsoft.Cardinal_16.3.11308.0_x64__8wekyb3d8bbwe\\\\RelicCardinal.exe', title: 'AoE IV' }] };
  const g = { dir: 'C:\\XboxGames\\Age of Empires II- Definitive Edition\\Content', pkg: 'Microsoft.MSPhoenix' };
  assert.strictEqual(amdS.profileFor(amd, g).s.v, 'yeni');
  assert.strictEqual(amdS.profileFor(amd, { ...g, version: '101.103.54800.0' }).s.v, 'eski');
  assert.strictEqual(amdS.profileFor(amd, { dir: g.dir }), null, 'paket adı yoksa eşleşmez');
  assert.ok(amdS.gmdbFor(amd, { dir: 'G:\\XboxGames\\Age of Empires IV\\Content', pkg: 'Microsoft.Cardinal' }));
});
t('Süreç listesi: tasklist CSV', () => {
  const { parseTasklist } = require('../src/core/procs');
  assert.deepStrictEqual(parseTasklist('"System Idle Process","0","Services","0","8 K"\r\n"witcher3.exe","29688","Console","1","2.342.852 K"\r\n'), [{ name: 'system idle process', pid: 0 }, { name: 'witcher3.exe', pid: 29688 }]);
});
console.log(`\n${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
