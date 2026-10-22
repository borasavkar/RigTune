'use strict';
// Adrenalin'in ölçtüğü performansa göre öneri (Adrenalin'in Oyun Danışmanı'nın yaptığına benzer).
// Ölçüm detect/amd-settings.js > readPerf'ten gelir: son oturumun ortalama FPS'i, %95 kare süresi, kare üretimi açık mıydı.
// Karar yalnızca iki açık durumda verilir; arada kalan durumda ölçüm gösterilir, öneri yapılmaz:
//  - FPS sınıra dayanıyor (hedefin en çok 4 altı; FRTC karşılaştırmasıyla aynı tolerans) ve kare üretimi kapalı → kalite artırılabilir.
//  - FPS FreeSync aralığının alt sınırının altında (değişken yenileme yoksa yenileme hızının 4 altından düşük) → ayar düşürülmeli.
//  - FPS yenileme hızının üstünde → FreeSync aralığından çıkılmış; FPS sınırının uygulandığı kontrol edilmeli.
const { perfFor } = require('../detect/amd-settings');

function measured(g, c) {
  const m = perfFor(c.amd, { dir: g.dir, appid: g.appid, exe: g.exe, name: g.dbName || g.n });
  if (!m) return null;
  const t = c.t;
  const cap = c.vrr ? c.hz - 3 : c.hz;
  const base = m.fg ? Math.round(m.fps / 2) : m.fps;
  const date = new Date(m.at).toLocaleDateString(t.locale, { day: 'numeric', month: 'long' });
  let text = t('eng.measured.head', { date, fps: fmt(m.fps, t), p95: fmt(m.p95, t) });
  let verdict = 'ok';
  if (m.fg) text += t('eng.measured.fg', { base });
  const vmin = c.vrr && c.display.vrr ? c.display.vrr.min : null;
  if (c.vrr && vmin && base < vmin) { verdict = 'low'; text += t('eng.measured.low', { min: vmin }); }
  else if (!c.vrr && m.fps < c.hz - 4) { verdict = 'low'; text += t('eng.measured.lowNoVrr', { hz: c.hz }); }
  // Yenileme hızının üstü: FreeSync aralığından çıkılmış, FPS sınırı o sırada uygulanmamış (ölçüm sınırdan önce yapılmış olabilir).
  else if (m.fps > c.hz + 1) { verdict = 'over'; text += t('eng.measured.over', { hz: c.hz, cap }); }
  else if (!m.fg && m.fps >= cap - 4) { verdict = 'headroom'; text += t('eng.measured.headroom', { cap }); }
  else if (c.vrr && vmin) text += t('eng.measured.ok', { min: vmin, max: c.display.vrr.max });
  return { fps: m.fps, p95: m.p95, fg: m.fg, at: m.at, verdict, text, tag: t('eng.measured.tag', { fps: fmt(m.fps, t) }) };
}

const fmt = (n, t) => Number(n).toLocaleString(t.locale, { maximumFractionDigits: 1 });

module.exports = { measured };
