'use strict';
// Dil dosyaları ve çevirmen. Değerler düz metindir; {ad} biçimindeki yer tutucular parametreyle doldurulur.
// Bir anahtar seçili dilde yoksa Türkçesi, o da yoksa anahtarın kendisi döner.
const LOCALES = { tr: require('./tr'), en: require('./en') };
const LANGS = Object.keys(LOCALES);
const PREFS = ['system', ...LANGS];

// Ayar ('system' | 'tr' | 'en') + işletim sistemi dili → kullanılacak dil. Türkçe olmayan sistemlerde İngilizce.
function resolveLang(pref, systemLocale) {
  if (LOCALES[pref]) return pref;
  return /^tr\b/i.test(String(systemLocale || '')) ? 'tr' : 'en';
}

function lookup(obj, key) {
  let o = obj;
  for (const p of String(key).split('.')) { if (o == null) return undefined; o = o[p]; }
  return o;
}

const fill = (s, p) => (p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] != null ? p[k] : m)) : s);

const cache = {};
function translator(lang) {
  const L = LOCALES[lang] ? lang : 'tr';
  if (cache[L]) return cache[L];
  const d = LOCALES[L];
  const t = (key, p) => {
    let s = lookup(d, key);
    if (s == null) s = lookup(LOCALES.tr, key);
    if (s == null) return key;
    return typeof s === 'string' ? fill(s, p) : s;
  };
  t.lang = L;
  t.locale = d.meta.locale;
  return (cache[L] = t);
}

module.exports = { LOCALES, LANGS, PREFS, resolveLang, translator, lookup };
