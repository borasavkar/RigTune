#!/usr/bin/env node
'use strict';
// Komut satırı: arayüz açmadan analiz.
// Kullanım: node src/cli.js [--json] [--oyun "ad"] [--hedef kalite|denge|fps] [--dil tr|en] [--yerel] [--veri klasör]
// İngilizce eş adlar: --game, --goal, --lang, --offline, --data. --dil verilmezse uygulamadaki dil ayarı (varsayılan: sistem dili) kullanılır.
const { Analyzer } = require('./core');
const { defaultDataDir, migrateDataDir } = require('./core/util');

const args = process.argv.slice(2);
const opt = (...ks) => { for (const k of ks) { const i = args.indexOf(k); if (i >= 0) return args[i + 1]; } return null; };
const flag = (...ks) => ks.some(k => args.includes(k));

(async () => {
  const dir = opt('--veri', '--data') || defaultDataDir();
  try { migrateDataDir(dir); } catch { /* taşınamazsa varsayılan ayarlarla devam eder */ }
  const a = new Analyzer(dir);
  if (flag('--yerel', '--offline')) a.settings.online = false;
  if (opt('--hedef', '--goal')) a.settings.goal = opt('--hedef', '--goal');
  if (opt('--dil', '--lang')) a.settings.lang = opt('--dil', '--lang');
  const json = flag('--json');
  const t = a.t;
  a.on('progress', p => { if (p && !json) process.stderr.write(`\r${p.stage}${p.total ? ` ${p.done}/${p.total}` : ''}                    `); });
  const r = await a.scan('cli');
  const s = a.state;
  if (json) { console.log(JSON.stringify(s, null, 1)); return; }
  process.stderr.write('\r');
  const gpu = s.system.gpus.find(g => g.id === s.primary.gpuId);
  const d = s.system.displays.find(x => x.id === s.primary.displayId);
  console.log(`\n${t('cli.gpu')} ${gpu ? `${gpu.name} · ${gpu.arch} · ${gpu.vramGB || '?'} GB` : '-'}`);
  console.log(`${t('cli.mon')} ${d ? `${d.name} · ${s.ctx.resLabel} · ${s.ctx.hz} Hz (${t('cli.max', { n: d.maxHz })}) · ${d.vrr ? d.vrr.kind : t('cli.noVrr')}` : '-'}`);
  console.log(`${t('cli.games')} ${s.games.length}`);
  if (r.items.length) { console.log('\n' + t('cli.changes')); for (const i of r.items) console.log('  • ' + i.text); }
  console.log('\n' + t('cli.checks'));
  for (const ch of s.checks) console.log(`  ${ch.level === 'warn' ? '!' : ch.level === 'ok' ? '✓' : 'i'} ${ch.title}`);
  const q = opt('--oyun', '--game');
  const lower = x => String(x).toLocaleLowerCase(s.lang);
  const list = q ? s.games.concat(s.catalog).filter(g => lower(g.name).includes(lower(q))) : s.games;
  // Sürücü uygulamasındaki şu anki değerle karşılaştırma: ! değişecek, ✓ zaten öyle, ? okunamadı, - bilgi
  const mark = { change: '!', ok: '✓', unknown: '?', na: '-' };
  for (const g of list) {
    const st = g.rec.driver && g.rec.driver.state;
    console.log(`\n■ ${g.name} [${g.sourceName}]  ${g.rec.perf}${st && st.change ? `  (${t('cli.toChange', { n: st.change })})` : ''}`);
    if (!q) continue;
    if (g.rec.driver) {
      console.log(`  ${g.rec.driver.app} (${g.rec.driver.path})`);
      for (const i of g.rec.driver.items) {
        const now = i.state === 'change' ? `  ← ${t('cli.now')}: ${i.cur}` : i.state === 'unknown' ? `  (${t('cli.unread')})` : '';
        console.log(`    ${mark[i.state] || '-'} ${i.k}: ${i.v}${now}`);
      }
    }
    console.log('  ' + t('cli.ingame')); for (const i of g.rec.ingame) console.log(`    - ${i.k}: ${i.tip ? i.why : i.v}`);
    for (const n of g.rec.notes) console.log('  ' + t('cli.note') + n);
  }
})().catch(e => { console.error(e); process.exit(1); });
