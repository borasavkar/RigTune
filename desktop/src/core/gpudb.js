'use strict';
// Ekran kartı veritabanı: model adından mimari, yaklaşık güç sınıfı ve sürücü özelliklerini çıkarır.
// "score": 1440p rasterleştirmede kabaca göreli güç, RX 9070 XT = 100. Ölçüm değil, sınıflandırma içindir.

const ARCH = {
  RDNA4: { vendor: 'amd', label: 'RDNA 4', fsrML: true, fsrMLFG: true, rayRegen: true, afmf: true, antiLag2: true, hyprRx: true, rsr: true, rt: 3 },
  RDNA3: { vendor: 'amd', label: 'RDNA 3', fsrML: 'driver', afmf: true, antiLag2: true, hyprRx: true, rsr: true, rt: 2 },
  RDNA2: { vendor: 'amd', label: 'RDNA 2', afmf: true, antiLag2: true, rsr: true, rt: 1 },
  RDNA1: { vendor: 'amd', label: 'RDNA 1', antiLag2: true, rsr: true, rt: 0 },
  GCN: { vendor: 'amd', label: 'GCN / Vega', rt: 0 },
  Blackwell: { vendor: 'nvidia', label: 'Blackwell (RTX 50)', dlss: true, dlssFG: true, mfg: 6, dynamicMfg: true, smoothMotion: true, reflex: true, rtxHdr: true, fp8: true, rt: 3 },
  Ada: { vendor: 'nvidia', label: 'Ada Lovelace (RTX 40)', dlss: true, dlssFG: true, mfg: 2, smoothMotion: true, reflex: true, rtxHdr: true, fp8: true, rt: 3 },
  Ampere: { vendor: 'nvidia', label: 'Ampere (RTX 30)', dlss: true, reflex: true, rtxHdr: true, rt: 2 },
  Turing: { vendor: 'nvidia', label: 'Turing (RTX 20)', dlss: true, reflex: true, rtxHdr: true, rt: 1 },
  TuringGTX: { vendor: 'nvidia', label: 'Turing (GTX 16)', reflex: true, nis: true, rt: 0 },
  Pascal: { vendor: 'nvidia', label: 'Pascal (GTX 10)', reflex: true, nis: true, rt: 0 },
  Battlemage: { vendor: 'intel', label: 'Xe2 Battlemage', xessXmx: true, xessFG: true, xessMFG: true, xell: true, rt: 2 },
  Alchemist: { vendor: 'intel', label: 'Xe Alchemist', xessXmx: true, xessFG: true, xessMFG: true, xell: true, rt: 1 },
  Xe2iGPU: { vendor: 'intel', label: 'Xe2', xessXmx: true, xessFG: true, xessMFG: true, xell: true, rt: 1, igpu: true },
  XeLPG: { vendor: 'intel', label: 'Xe-LPG', xessFG: true, xessMFG: true, xell: true, rt: 1, igpu: true },
  XeLP: { vendor: 'intel', label: 'Xe-LP', rt: 0, igpu: true },
  Apple: { vendor: 'apple', label: 'Apple Silicon', metalfx: true, rt: 1, igpu: true },
};

// [desen, mimari, puan] — daha özgül desenler önce gelir.
const MODELS = [
  // AMD RDNA 4
  [/RX\s*9070\s*XT/i, 'RDNA4', 100], [/RX\s*9070\s*GRE/i, 'RDNA4', 80], [/RX\s*9070/i, 'RDNA4', 90],
  [/RX\s*9060\s*XT/i, 'RDNA4', 58], [/RX\s*9060/i, 'RDNA4', 48], [/AI\s*PRO\s*R9700/i, 'RDNA4', 92],
  // AMD RDNA 3
  [/RX\s*7900\s*XTX/i, 'RDNA3', 104], [/RX\s*7900\s*XT/i, 'RDNA3', 90], [/RX\s*7900\s*GRE/i, 'RDNA3', 78], [/RX\s*7800\s*XT/i, 'RDNA3', 72],
  [/RX\s*7700\s*XT/i, 'RDNA3', 60], [/RX\s*7700/i, 'RDNA3', 55], [/RX\s*7650\s*GRE/i, 'RDNA3', 42], [/RX\s*7600\s*XT/i, 'RDNA3', 40], [/RX\s*7600/i, 'RDNA3', 37],
  [/Radeon\s*8060S/i, 'RDNA3', 38], [/Radeon\s*8050S/i, 'RDNA3', 30], [/Radeon\s*890M/i, 'RDNA3', 14], [/Radeon\s*880M/i, 'RDNA3', 12], [/Radeon\s*780M/i, 'RDNA3', 11], [/Radeon\s*760M/i, 'RDNA3', 9], [/Radeon\s*740M/i, 'RDNA3', 6],
  // AMD RDNA 2
  [/RX\s*6950\s*XT/i, 'RDNA2', 70], [/RX\s*6900\s*XT/i, 'RDNA2', 66], [/RX\s*6800\s*XT/i, 'RDNA2', 63], [/RX\s*6800/i, 'RDNA2', 55], [/RX\s*6750\s*XT/i, 'RDNA2', 48],
  [/RX\s*6750\s*GRE/i, 'RDNA2', 42], [/RX\s*6700\s*XT/i, 'RDNA2', 45], [/RX\s*6700/i, 'RDNA2', 40], [/RX\s*6650\s*XT/i, 'RDNA2', 37], [/RX\s*6600\s*XT/i, 'RDNA2', 35],
  [/RX\s*6600/i, 'RDNA2', 31], [/RX\s*6500/i, 'RDNA2', 17], [/RX\s*6400/i, 'RDNA2', 13], [/Radeon\s*680M/i, 'RDNA2', 8], [/Radeon\s*660M/i, 'RDNA2', 6],
  // AMD RDNA 1 ve öncesi
  [/RX\s*5700\s*XT/i, 'RDNA1', 36], [/RX\s*5700/i, 'RDNA1', 32], [/RX\s*5600/i, 'RDNA1', 27], [/RX\s*5500/i, 'RDNA1', 18],
  [/Radeon\s*VII/i, 'GCN', 34], [/Vega\s*64/i, 'GCN', 27], [/Vega\s*56/i, 'GCN', 24], [/RX\s*590/i, 'GCN', 18], [/RX\s*580/i, 'GCN', 17], [/RX\s*570/i, 'GCN', 14], [/RX\s*480/i, 'GCN', 16], [/RX\s*470/i, 'GCN', 13],
  // NVIDIA
  [/RTX\s*5090/i, 'Blackwell', 160], [/RTX\s*5080/i, 'Blackwell', 118], [/RTX\s*5070\s*Ti/i, 'Blackwell', 98], [/RTX\s*5070/i, 'Blackwell', 80], [/RTX\s*5060\s*Ti/i, 'Blackwell', 58], [/RTX\s*5060/i, 'Blackwell', 48], [/RTX\s*5050/i, 'Blackwell', 36],
  [/RTX\s*4090/i, 'Ada', 140], [/RTX\s*4080\s*SUPER/i, 'Ada', 106], [/RTX\s*4080/i, 'Ada', 103], [/RTX\s*4070\s*Ti\s*SUPER/i, 'Ada', 90], [/RTX\s*4070\s*Ti/i, 'Ada', 84], [/RTX\s*4070\s*SUPER/i, 'Ada', 78], [/RTX\s*4070/i, 'Ada', 66],
  [/RTX\s*4060\s*Ti/i, 'Ada', 50], [/RTX\s*4060/i, 'Ada', 40], [/RTX\s*4050/i, 'Ada', 30],
  [/RTX\s*3090\s*Ti/i, 'Ampere', 80], [/RTX\s*3090/i, 'Ampere', 72], [/RTX\s*3080\s*Ti/i, 'Ampere', 70], [/RTX\s*3080/i, 'Ampere', 66], [/RTX\s*3070\s*Ti/i, 'Ampere', 54], [/RTX\s*3070/i, 'Ampere', 50],
  [/RTX\s*3060\s*Ti/i, 'Ampere', 45], [/RTX\s*3060/i, 'Ampere', 34], [/RTX\s*3050/i, 'Ampere', 22],
  [/RTX\s*2080\s*Ti/i, 'Turing', 50], [/RTX\s*2080\s*SUPER/i, 'Turing', 43], [/RTX\s*2080/i, 'Turing', 40], [/RTX\s*2070\s*SUPER/i, 'Turing', 37], [/RTX\s*2070/i, 'Turing', 33], [/RTX\s*2060\s*SUPER/i, 'Turing', 31], [/RTX\s*2060/i, 'Turing', 27],
  [/GTX\s*1660\s*(Ti|SUPER)/i, 'TuringGTX', 22], [/GTX\s*1660/i, 'TuringGTX', 20], [/GTX\s*1650\s*SUPER/i, 'TuringGTX', 16], [/GTX\s*1650/i, 'TuringGTX', 13],
  [/GTX\s*1080\s*Ti/i, 'Pascal', 33], [/GTX\s*1080/i, 'Pascal', 26], [/GTX\s*1070\s*Ti/i, 'Pascal', 24], [/GTX\s*1070/i, 'Pascal', 21], [/GTX\s*1060/i, 'Pascal', 15], [/GTX\s*1050/i, 'Pascal', 8],
  // Intel
  [/Arc.*B580/i, 'Battlemage', 42], [/Arc.*B570/i, 'Battlemage', 37], [/Arc.*A770/i, 'Alchemist', 36], [/Arc.*A750/i, 'Alchemist', 33], [/Arc.*A580/i, 'Alchemist', 28], [/Arc.*A380/i, 'Alchemist', 13], [/Arc.*A310/i, 'Alchemist', 9],
  [/Arc.*1[34]0V/i, 'Xe2iGPU', 10], [/Arc.*B3\d0/i, 'Xe2iGPU', 14], [/Intel.*Arc.*Graphics/i, 'XeLPG', 8], [/Iris.*Xe/i, 'XeLP', 4], [/UHD\s*Graphics/i, 'XeLP', 2],
  // Apple
  [/M\d\s*Ultra/i, 'Apple', 50], [/M\d\s*Max/i, 'Apple', 34], [/M\d\s*Pro/i, 'Apple', 18], [/Apple\s*M\d/i, 'Apple', 11],
];

const VENDOR_IDS = { '1002': 'amd', '1022': 'amd', '10de': 'nvidia', '8086': 'intel', '106b': 'apple', '5143': 'qualcomm' };
const VIRTUAL = /Microsoft Basic|Remote Display|Parsec|Virtual|Meta Virtual|Citrix|VMware|Hyper-V|Spacedesk|DisplayLink|IddSampleDriver|Oculus|Luminon/i;

function vendorOf(name, pnp) {
  const m = /VEN_([0-9A-F]{4})/i.exec(pnp || '');
  if (m && VENDOR_IDS[m[1].toLowerCase()]) return VENDOR_IDS[m[1].toLowerCase()];
  if (/AMD|Radeon/i.test(name)) return 'amd';
  if (/NVIDIA|GeForce|RTX|GTX|Quadro/i.test(name)) return 'nvidia';
  if (/Intel|Arc|Iris|UHD/i.test(name)) return 'intel';
  if (/Apple/i.test(name)) return 'apple';
  return 'other';
}

function lookup(name, pnp, vramBytes) {
  const vendor = vendorOf(name, pnp);
  let arch = null, score = null, known = false;
  for (const [re, a, s] of MODELS) {
    if (re.test(name)) { arch = a; score = s; known = true; break; }
  }
  if (known && /Laptop|Mobile|Max-Q/i.test(name) && ARCH[arch].vendor !== 'apple' && !ARCH[arch].igpu) score = Math.round(score * 0.7);
  if (!known) {
    // Bilinmeyen model: üretici ve bellek miktarından kaba tahmin.
    const gb = vramBytes ? vramBytes / 2 ** 30 : 0;
    if (vendor === 'amd') { arch = /Radeon\(TM\)\s*Graphics|Radeon Graphics/i.test(name) ? 'RDNA2' : 'RDNA3'; score = gb >= 1 ? Math.min(60, gb * 4) : 6; }
    else if (vendor === 'nvidia') { arch = /RTX/i.test(name) ? 'Ampere' : 'Pascal'; score = Math.min(60, Math.max(10, gb * 5)); }
    else if (vendor === 'intel') { arch = 'XeLP'; score = 4; }
    else if (vendor === 'apple') { arch = 'Apple'; score = 11; }
  }
  // Etiket dilden bağımsızdır; Intel dahili birimlerine "(dahili)" eki ve bilinmeyen mimari adı arayüze giderken eklenir (core/index.js).
  const a = arch ? ARCH[arch] : { vendor, label: null, rt: 0 };
  return { vendor, archKey: arch, arch: a.label, features: { ...a }, score: score || 20, known, virtual: VIRTUAL.test(name) || vendor === 'other' };
}

module.exports = { lookup, vendorOf, ARCH };
