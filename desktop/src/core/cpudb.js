'use strict';
// İşlemci veritabanı: model adından mimari, mimarinin ilk çıktığı yıl ve büyük L3 önbellek (AMD 3D V-Cache) bilgisini çıkarır.
// Puan yok: işlemcilerin oyun performansını karşılaştıran ve kaynağı gösterilebilen bir tablo eklenmedikçe sayı uydurulmaz.
// Sınıf, işlemcinin hangi nesilden olduğunu gösterir; öneri kurallarında eşik olarak kullanılmaz.

const ARCH = {
  Zen5: { vendor: 'amd', label: 'Zen 5', year: 2024 },
  Zen4: { vendor: 'amd', label: 'Zen 4', year: 2022 },
  Zen3: { vendor: 'amd', label: 'Zen 3', year: 2020 },
  Zen2: { vendor: 'amd', label: 'Zen 2', year: 2019 },
  ZenPlus: { vendor: 'amd', label: 'Zen+', year: 2018 },
  Zen1: { vendor: 'amd', label: 'Zen', year: 2017 },
  PantherLake: { vendor: 'intel', label: 'Panther Lake', year: 2026 },
  ArrowLake: { vendor: 'intel', label: 'Arrow Lake', year: 2024 },
  LunarLake: { vendor: 'intel', label: 'Lunar Lake', year: 2024 },
  MeteorLake: { vendor: 'intel', label: 'Meteor Lake', year: 2023 },
  RaptorLakeR: { vendor: 'intel', label: 'Raptor Lake Refresh', year: 2023 },
  RaptorLake: { vendor: 'intel', label: 'Raptor Lake', year: 2022 },
  AlderLake: { vendor: 'intel', label: 'Alder Lake', year: 2021 },
  Gen11: { vendor: 'intel', label: 'Rocket Lake / Tiger Lake', year: 2020 },
  Gen10: { vendor: 'intel', label: 'Comet Lake / Ice Lake', year: 2019 },
  CoffeeLakeR: { vendor: 'intel', label: 'Coffee Lake Refresh', year: 2018 },
  CoffeeLake: { vendor: 'intel', label: 'Coffee Lake', year: 2017 },
  KabyLake: { vendor: 'intel', label: 'Kaby Lake', year: 2017 },
  Skylake: { vendor: 'intel', label: 'Skylake', year: 2015 },
  Oryon: { vendor: 'qualcomm', label: 'Oryon', year: 2024 },
};
const APPLE_YEAR = { 1: 2020, 2: 2022, 3: 2023, 4: 2024, 5: 2025 };
const INTEL_GEN = { 14: 'RaptorLakeR', 13: 'RaptorLake', 12: 'AlderLake', 11: 'Gen11', 10: 'Gen10', 9: 'CoffeeLakeR', 8: 'CoffeeLake', 7: 'KabyLake', 6: 'Skylake' };

// [desen, mimari] — daha özgül desenler önce gelir. Desenler "PRO", "(R)" ve "(TM)" atılmış ada uygulanır.
// Ryzen dizüstü adlarında üçüncü hane mimariyi gösterir (7x20 Zen 2, 7x30/7x35 Zen 3, 7x40/7x45 Zen 4);
// 5000 U serisinde 5300U/5500U/5700U Zen 2, diğerleri Zen 3; 2000 serisinde G ve U modelleri Zen'dir.
const MODELS = [
  [/Ryzen\s*AI\s*(Max\+?\s*)?(\d\s*)?(HX\s*)?[34]\d{2}/i, 'Zen5'],
  [/Ryzen\s*(Threadripper\s*)?\d?\s*9\d{3}/i, 'Zen5'],
  [/Ryzen\s*\d\s*[78]\d[45]\d/i, 'Zen4'],
  [/Ryzen\s*\d\s*7\d3\d/i, 'Zen3'],
  [/Ryzen\s*\d\s*7\d2\d/i, 'Zen2'],
  [/Ryzen\s*\d\s*(7\d{3}|8\d{3})|Threadripper\s*7\d{3}/i, 'Zen4'],
  [/Ryzen\s*\d\s*5[357]00U/i, 'Zen2'],
  [/Ryzen\s*\d\s*5\d{3}|Threadripper\s*5\d{3}/i, 'Zen3'],
  [/Ryzen\s*\d\s*(3[24]00G|3\d{3}[UH])/i, 'ZenPlus'],
  [/Ryzen\s*\d\s*[34]\d{3}|Threadripper\s*3\d{3}/i, 'Zen2'],
  [/Ryzen\s*\d\s*(2[24]00G|2\d{3}U)/i, 'Zen1'],
  [/Ryzen\s*\d\s*2\d{3}|Threadripper\s*2\d{3}/i, 'ZenPlus'],
  [/Ryzen\s*\d\s*1\d{3}|Threadripper\s*1\d{3}/i, 'Zen1'],
  [/Core.*Ultra\s*X?\d\s*3\d{2}/i, 'PantherLake'],
  [/Core.*Ultra\s*\d\s*2\d{2}V/i, 'LunarLake'],
  [/Core.*Ultra\s*\d\s*2\d{2}/i, 'ArrowLake'],
  [/Core.*Ultra\s*\d\s*1\d{2}/i, 'MeteorLake'],
  [/Snapdragon.*X/i, 'Oryon'],
];

function vendorOf(name) {
  if (/AMD|Ryzen|Threadripper|Athlon/i.test(name)) return 'amd';
  if (/Intel|Core|Xeon|Pentium|Celeron/i.test(name)) return 'intel';
  if (/Apple/i.test(name)) return 'apple';
  if (/Snapdragon|Qualcomm/i.test(name)) return 'qualcomm';
  return 'other';
}

// Ad, Windows'taki biçimden kısaltılır: "AMD Ryzen 5 9600X 6-Core Processor" → "Ryzen 5 9600X".
function shortName(name) {
  return String(name || '')
    .replace(/\((R|TM)\)/gi, '')
    .replace(/\b(\d+|Six|Eight|Twelve|Sixteen)-Core Processor\b|\bProcessor\b|\bCPU\b|@\s*[\d.]+\s*GHz/gi, '')
    .replace(/^\d+th Gen\s+/i, '')
    .replace(/^(AMD|Intel|Apple)\s+/i, '')
    .replace(/\s+(with|w\/)\s*Radeon.*$/i, '')
    .replace(/\s+/g, ' ').trim() || String(name || '');
}

// Intel Core iX-NNNN(N): nesil model numarasının başındadır. Masaüstünde i7-9700K → 9, i5-13600K → 13;
// dizüstünde dört haneli ve 1 ile başlayan modellerde ilk iki hane (i7-1165G7 → 11).
function intelGen(num) {
  return num.length === 5 || num[0] === '1' ? +num.slice(0, 2) : +num[0];
}

function lookup(name) {
  name = String(name || '');
  const n = name.replace(/\((R|TM)\)/gi, '').replace(/\bPRO\s+/gi, '');
  const vendor = vendorOf(name);
  let key = null;
  for (const [re, a] of MODELS) if (re.test(n)) { key = a; break; }
  if (!key) {
    const m = /\bi[3579]-(\d{4,5})/i.exec(n);
    if (m) key = INTEL_GEN[intelGen(m[1])] || null;
  }
  let arch = key ? ARCH[key] : null;
  const ap = /Apple\s*M(\d)/i.exec(name);
  if (!arch && ap) arch = { vendor: 'apple', label: `Apple M${ap[1]}`, year: APPLE_YEAR[ap[1]] || null };
  return {
    vendor, archKey: key || (ap ? 'Apple' : null), arch: arch ? arch.label : null, year: arch ? arch.year : null,
    x3d: /X3D/i.test(name), known: !!arch, short: shortName(name),
  };
}

module.exports = { lookup, shortName, ARCH };
