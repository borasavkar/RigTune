'use strict';
// Red Dead Redemption 2: oyun menüsündeki bütün grafik ayarları, system.xml'deki şu anki değerleri ve önerileri.
// Ayar adları ve değerleri oyunun (İngilizce) menüsündeki gibi yazılır. Dosyadaki değerlerin menüdeki karşılıkları Bora'nın
// oyun menüsü ekran görüntüleriyle karşılaştırılarak doğrulandı (24 Ekim 2026): kSettingLevel_X → X, true/false → On/Off,
// windowed 2 → Windowed Borderless, anisotropicFiltering 4 → X16, msaa 0 → Off, reflectionMSAA 2 → X4,
// fsr2Index 1 → Quality, scalingMode Mode1o1 → Off, locked false → Unlocked. Doğrulanmayan sayılar olduğu gibi gösterilir.
//
// Öneri türleri:
//   hard: değer önerilenlerden biri değilse "değiştir".
//   soft: önerilen aralıktaysa "doğru", değilse karşılaştırılmaz (FPS ile görüntü arasında kişisel tercih).
//   pref: karşılaştırılmaz (tercih ya da oyunun kendisinin kilitlediği ayar).

const LEVEL = s => (s ? String(s).replace(/^kSetting(Level|API|Scale)_/, '').replace(/^Mode1o1$/, 'Off') : undefined);
const ONOFF = v => (v === 'true' ? 'On' : v === 'false' ? 'Off' : v);
const KNOWN = {
  windowed: { 2: 'Windowed Borderless' },
  anisotropicFiltering: { 4: 'X16' },
  msaa: { 0: 'Off' },
  reflectionMSAA: { 0: 'Off', 2: 'X4' },
  fsr2Index: { 1: 'Quality' },
};
const NUM = v => (v === undefined ? undefined : String(+v === Math.round(+v) ? +v : +(+v).toFixed(2)));

// [grup, kimlik, menüdeki ad, dosyadaki anahtar, çözücü]
const ROWS = [
  ['video', 'screenType', 'Screen Type', 'windowed', 'known'],
  ['video', 'vsync', 'VSync', 'vSync', v => (v === '0' ? 'Off' : v)],
  ['video', 'tripleBuffering', 'Triple Buffering', 'tripleBuffered', 'onoff'],
  ['graphics', 'texture', 'Texture Quality', 'textureQuality', 'level'],
  ['graphics', 'aniso', 'Anisotropic Filtering', 'anisotropicFiltering', 'known'],
  ['graphics', 'lighting', 'Lighting Quality', 'lightingQuality', 'level'],
  ['graphics', 'gi', 'Global Illumination Quality', 'ambientLightingQuality', 'level'],
  ['graphics', 'shadow', 'Shadow Quality', 'shadowQuality', 'level'],
  ['graphics', 'farShadow', 'Far Shadow Quality', 'farShadowQuality', 'level'],
  ['graphics', 'ssao', 'Screen Space Ambient Occlusion', 'ssao', 'level'],
  ['graphics', 'reflection', 'Reflection Quality', 'reflectionQuality', 'level'],
  ['graphics', 'mirror', 'Mirror Quality', 'mirrorQuality', 'level'],
  ['graphics', 'water', 'Water Quality', 'waterQuality', 'level'],
  ['graphics', 'volumetrics', 'Volumetrics Quality', 'volumetricsQuality', 'level'],
  ['graphics', 'particle', 'Particle Quality', 'particleQuality', 'level'],
  ['graphics', 'tessellation', 'Tessellation Quality', 'tessellation', 'level'],
  ['graphics', 'fsr2', 'AMD FSR 2', 'fsr2Index', 'known'],
  ['graphics', 'fsr2Sharpen', 'AMD FSR 2 Sharpening', 'fsr2Sharpen', 'num'],
  ['graphics', 'taa', 'TAA', 'taa', 'level'],
  ['graphics', 'fxaa', 'FXAA', 'fxaaEnabled', 'onoff'],
  ['graphics', 'msaa', 'MSAA', 'msaa', 'known'],
  ['advanced', 'api', 'Graphics API', 'API', 'level'],
  ['advanced', 'nearVol', 'Near Volumetric Resolution', 'scatteringVolumeQuality', 'level'],
  ['advanced', 'farVol', 'Far Volumetric Resolution', 'volumetricsRaymarchQuality', 'level'],
  ['advanced', 'volLight', 'Volumetric Lighting Quality', 'volumetricsLightingQuality', 'level'],
  ['advanced', 'volUnlocked', 'Unlocked Volumetric Raymarch Resolution', 'volumetricsRaymarchResolutionUnclamped', 'onoff'],
  ['advanced', 'particleLight', 'Particle Lighting Quality', 'particleLightingQuality', 'level'],
  ['advanced', 'softShadows', 'Soft Shadows', 'shadowSoftShadows', 'level'],
  ['advanced', 'grassShadows', 'Grass Shadows', 'shadowGrassShadows', 'level'],
  ['advanced', 'longShadows', 'Long Shadows', 'shadowLongShadows', 'onoff'],
  ['advanced', 'fullSsao', 'Full Resolution Screen Space Ambient Occlusion', 'ssaoFullScreenEnabled', 'onoff'],
  ['advanced', 'waterRefraction', 'Water Refraction Quality', 'waterRefractionQuality', 'level'],
  ['advanced', 'waterReflection', 'Water Reflection Quality', 'waterReflectionQuality', 'level'],
  ['advanced', 'waterPhysics', 'Water Physics Quality', 'waterSimulationQuality', 'num'],
  ['advanced', 'resScale', 'Resolution Scale', 'scalingMode', 'level'],
  ['advanced', 'taaSharpen', 'TAA Sharpening', 'sharpenIntensity', 'num'],
  ['advanced', 'motionBlur', 'Motion Blur', 'motionBlur', 'onoff'],
  ['advanced', 'reflectionMsaa', 'Reflection MSAA', 'reflectionMSAA', 'known'],
  ['advanced', 'geometryLod', 'Geometry Level of Detail', 'lodScale', 'num'],
  ['advanced', 'grassLod', 'Grass Level of Detail', 'grassLod', 'num'],
  ['advanced', 'treeQuality', 'Tree Quality', 'treeQuality', 'level'],
  ['advanced', 'pom', 'Parallax Occlusion Mapping Quality', 'POMQuality', 'level'],
  ['advanced', 'decal', 'Decal Quality', 'decalQuality', 'level'],
  ['advanced', 'fur', 'Fur Quality', 'furDisplayQuality', 'level'],
  ['advanced', 'treeTess', 'Tree Tessellation', 'treeTessellationEnabled', 'onoff'],
];

// system.xml → { kimlik: menüdeki değer }
function readAll(text) {
  const x = {};
  for (const m of text.matchAll(/<(\w+)\s+value="([^"]*)"\s*\/>/g)) if (!(m[1] in x)) x[m[1]] = m[2];
  for (const m of text.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) if (!(m[1] in x)) x[m[1]] = m[2];
  const out = {};
  for (const [, id, , key, how] of ROWS) {
    const v = x[key];
    if (v === undefined) continue;
    out[id] = how === 'level' ? LEVEL(v) : how === 'onoff' ? ONOFF(v) : how === 'num' ? NUM(v) : how === 'known' ? (KNOWN[key][v] || `${key}=${v}`) : how(v);
  }
  if (x.locked !== undefined) out.advancedLocked = x.locked === 'false' ? 'Unlocked' : 'Locked';
  return out;
}

const HQ = ['High', 'Ultra'], MHQ = ['Medium', 'High', 'Ultra'], MH = ['Medium', 'High'];

// Öneriler. c: bağlam (VRAM, FreeSync), L: oyunun bu sistemdeki yük seviyesi (0–3), need: ölçekleyici gerekiyor mu.
function plan(c, L, need) {
  const tex = c.vram && c.vram < 12 ? 'High' : 'Ultra';
  const heavy = L >= 2; // kart zorlanıyorsa pahalı hacimsel ayarlar bir kademe düşürülür
  return {
    screenType: ['hard', 'Fullscreen / Windowed Borderless', ['Fullscreen', 'Windowed Borderless']],
    vsync: c.vrr ? ['hard', 'Off', ['Off']] : ['pref', 'On'],
    tripleBuffering: ['hard', 'Off', ['Off']],
    texture: ['hard', tex, tex === 'Ultra' ? ['Ultra'] : ['High', 'Ultra']],
    aniso: ['hard', 'X16', ['X16']],
    lighting: ['soft', 'High–Ultra', HQ],
    gi: ['soft', 'High–Ultra', HQ],
    shadow: ['soft', 'High–Ultra', HQ],
    farShadow: ['soft', 'High–Ultra', HQ],
    ssao: ['soft', 'High–Ultra', HQ],
    reflection: ['soft', 'Medium–Ultra', MHQ],
    mirror: ['soft', 'Medium–Ultra', MHQ],
    water: ['soft', 'Medium–Ultra', MHQ],
    volumetrics: ['pref', 'Custom'],
    particle: ['soft', 'High–Ultra', HQ],
    tessellation: ['soft', 'High–Ultra', HQ],
    fsr2: need ? ['hard', 'Quality', ['Quality']] : ['pref', 'Off'],
    fsr2Sharpen: ['pref', '—'],
    taa: ['pref', 'High'],
    fxaa: ['hard', 'Off', ['Off']],
    msaa: ['hard', 'Off', ['Off']],
    api: ['soft', 'Vulkan', ['Vulkan']],
    nearVol: ['soft', 'Low–Medium', ['Low', 'Medium']],
    farVol: heavy ? ['hard', 'Medium–High', MH] : ['soft', 'High–Ultra', HQ],
    volLight: heavy ? ['hard', 'Medium–High', MH] : ['soft', 'High–Ultra', HQ],
    volUnlocked: ['hard', 'Off', ['Off']],
    particleLight: ['soft', 'Medium–High', MHQ],
    softShadows: ['soft', 'High–Ultra', HQ],
    grassShadows: ['soft', 'Medium–High', MHQ],
    longShadows: ['soft', 'On', ['On']],
    fullSsao: ['hard', 'Off', ['Off']],
    waterRefraction: ['soft', 'Medium–High', MHQ],
    waterReflection: ['soft', 'Medium–High', MHQ],
    waterPhysics: ['pref', '—'],
    resScale: need ? ['hard', 'Off', ['Off']] : ['pref', 'Off'],
    taaSharpen: ['pref', '—'],
    motionBlur: ['pref', 'Off'],
    reflectionMsaa: ['hard', 'Off', ['Off']],
    geometryLod: ['pref', '—'],
    grassLod: ['pref', '—'],
    treeQuality: ['soft', 'High–Ultra', HQ],
    pom: ['soft', 'High–Ultra', HQ],
    decal: ['soft', 'High–Ultra', HQ],
    fur: ['soft', 'Medium–High', MHQ],
    treeTess: ['hard', 'Off', ['Off']],
  };
}

// Satırlar: arayüzdeki stateRow ile aynı biçim (k, v, c, why, cur, state). group: video | graphics | advanced.
function rdr2Settings(cfg, c, L, need) {
  const cur = cfg.all || {};
  const P = plan(c, L, need);
  const t = c.t;
  const items = [];
  for (const [group, id, k] of ROWS) {
    const [kind, v, okSet] = P[id];
    const now = cur[id];
    let state;
    if (now === undefined) state = kind === 'pref' ? 'na' : 'unknown';
    else if (kind === 'pref') state = 'na';
    else if (okSet.includes(now)) state = 'ok';
    else state = kind === 'hard' ? 'change' : 'na';
    // Doğrulanmamış sayısal değer (anahtar=değer biçiminde) karşılaştırılmaz.
    if (now && /=/.test(now)) state = 'unknown';
    const extra = id === 'farVol' || id === 'volLight' ? (L >= 2 ? t('rdr2.heavy') : t('rdr2.light')) : '';
    // Önerisi olmayan tercih ayarında (—) değer olarak şu anki değer gösterilir.
    items.push({ id, group, k, v: v === '—' && now !== undefined && !/=/.test(now) ? now : v, c: state === 'change' ? 'warn' : kind === 'pref' ? 'set' : 'on', why: t('rdr2.why.' + id) + extra, cur: now === undefined || /=/.test(now) ? null : now, raw: now && /=/.test(now) ? now : undefined, state });
  }
  const n = s => items.filter(i => i.state === s).length;
  // Başlık ve grup adları da burada çevrilir (arayüz yalnızca ui metinlerini bilir).
  const groups = ['video', 'graphics', 'advanced'].map(gid => [t('rdr2.groups.' + gid), items.filter(i => i.group === gid)]);
  return { game: 'rdr2', title: t('rdr2.title'), lead: t('rdr2.lead'), groups, items, change: n('change'), ok: n('ok'), unknown: n('unknown') };
}

module.exports = { rdr2Settings, readAll, ROWS };
