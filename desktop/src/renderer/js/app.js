// RigTune — arayüz. Durum ana süreçten gelir; burada yalnızca gösterilir ve kullanıcı seçimleri geri gönderilir.
// Metinler src/locales içindeki dil dosyalarının ui bölümünden gelir (api.i18n); t('anahtar', { parametre }) ile okunur.
import { I } from './icons.js';

const api = window.oar;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let L = { lang: 'tr', locale: 'tr-TR', appName: '', ui: {}, types: {}, sources: {} };
function t(key, p) {
  let s = L.ui;
  for (const k of key.split('.')) s = s == null ? undefined : s[k];
  if (s == null) return key;
  return typeof s === 'string' && p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] != null ? p[k] : m)) : s;
}
async function loadI18n() {
  L = await api.i18n();
  document.documentElement.lang = L.lang;
  document.title = L.appName;
  $('.brand').textContent = L.appName;
  $('#rail').setAttribute('aria-label', t('nav.label'));
  $('#scanBtn').title = t('scanTitle');
}
const VENDOR = { amd: 'AMD', nvidia: 'NVIDIA', intel: 'Intel', apple: 'Apple', other: 'GPU' };
const SHORT_APP = { 'AMD Software: Adrenalin Edition': 'Adrenalin', 'NVIDIA App': 'NVIDIA App', 'Intel Graphics Software': 'Intel Graphics' };
const NAV = [['overview', I.gauge], ['games', I.games], ['global', I.sliders], ['changes', I.history], ['settings', I.settings]];
const CH_ICON = { hardware: I.cpu, driver: I.package, software: I.app, display: I.monitor, game: I.games, settings: I.windows, info: I.info };

const mem = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* yok */ } } };
const UI = { page: mem.get('page', 'overview'), gameId: mem.get('game', null), q: '', filter: 'hepsi', tab: 'driver', editing: false, progress: null, okOpen: false };
let S = null;

// ---------- yardımcılar ----------
function timeAgo(ts) {
  if (!ts) return '—';
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return t('time.now');
  if (d < 3600) return t('time.min', { n: Math.floor(d / 60) });
  if (d < 86400) return t('time.hour', { n: Math.floor(d / 3600) });
  return new Date(ts).toLocaleString(L.locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}
const fmtDate = ts => new Date(ts).toLocaleString(L.locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const lower = s => String(s).toLocaleLowerCase(L.lang);
const gpuOf = () => S && S.system.gpus.find(g => g.id === S.primary.gpuId);
const dispOf = () => S && S.system.displays.find(d => d.id === S.primary.displayId);
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const initials = n => String(n || '?').replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
function imgUrl(g) {
  if (g.hasImage) return `oar://img/${encodeURIComponent(g.id)}`;
  if (g.appid && S.settings.online) return `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`;
  return null;
}
function thumb(g) {
  const u = imgUrl(g);
  return `<div class="thumb" style="background:linear-gradient(135deg,hsl(${hue(g.name)} 55% 32%),hsl(${(hue(g.name) + 60) % 360} 55% 20%))">${esc(initials(g.name))}${u ? `<img src="${esc(u)}" alt="" style="position:absolute;width:76px;height:36px;object-fit:cover;border-radius:9px">` : ''}</div>`;
}
// Yüklenemeyen resimler gizlenir (CSP satır içi olay işleyicisine izin vermez).
document.addEventListener('error', e => { if (e.target && e.target.tagName === 'IMG') e.target.hidden = true; }, true);

function toast(title, text, icon = I.info) {
  const el = document.createElement('div');
  el.className = 'glass toast';
  el.innerHTML = `${icon}<div><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 6500);
}
const pill = (v, c) => `<span class="pill ${esc(c)}">${esc(v)}</span>`;
function rows(items) {
  return `<div class="rows">${items.map(i => i.tip
    ? `<div class="row tip">${I.spark}<div>${esc(i.why)}</div></div>`
    : `<div class="row"><div class="k">${esc(i.k)}${i.alt && i.alt !== i.k ? `<span class="alt">${esc(i.alt)}</span>` : ''}</div>${pill(i.v, i.c)}<div class="why">${esc(i.why)}</div></div>`).join('')}</div>`;
}

// Sürücü uygulamasındaki şu anki değerle karşılaştırılmış satırlar (state: change | unknown | na | ok).
// Değişecekler en üstte ve belirgin; okunamayanlar ayrı; zaten doğru olanlar katlı listede.
function stateRow(i, showScope) {
  const name = `${esc(i.k)}${i.alt && i.alt !== i.k ? `<span class="alt">${esc(i.alt)}</span>` : ''}${showScope && i.scope === 'global' ? `<span class="chip sm">${I.globe}${esc(t('drv.globalTag'))}</span>` : ''}`;
  const now = i.state === 'unknown' ? `<span class="now unread">${esc(t('drv.unread'))}</span>${I.arrow}`
    : i.state === 'change' ? `<span class="now" title="${esc(t('drv.now'))}">${esc(i.cur)}</span>${I.arrow}` : '';
  // Bilgi satırlarında ve öneriyle tam aynı yazılmayan doğru satırlarda (ör. netlik %20, öneri %30–40) şu anki değer de yazılır.
  const info = (i.state === 'na' || i.state === 'ok') && i.cur != null && i.cur !== i.v ? `<b>${esc(t('drv.now'))}:</b> ${esc(i.cur)}. ` : '';
  return `<div class="row st-${esc(i.state)}"><div class="k">${name}</div><div class="vals">${now}${pill(i.v, i.state === 'change' ? 'go' : i.c)}</div><div class="why">${info}${esc(i.why)}</div></div>`;
}
function stateView(d, kind) {
  const by = s => d.items.filter(i => i.state === s);
  const ch = by('change'), un = by('unknown'), na = by('na'), ok = by('ok');
  const g = kind === 'global' ? 'Global' : '';
  const lines = [];
  if (kind === 'game') lines.push(t(d.state.scope === 'game' ? 'drv.scopeGame' : 'drv.scopeGlobal'));
  if (un.length) lines.push(t('drv.sumUnknown', { n: un.length }));
  lines.push(t('drv.read', { t: timeAgo(S.system.amdSettings && S.system.amdSettings.at) }));
  const showScope = kind === 'game';
  const grp = (title, list) => (list.length ? `<div class="group-t">${esc(title)}</div><div class="rows">${list.map(i => stateRow(i, showScope)).join('')}</div>` : '');
  return `<div class="drvsum ${ch.length ? 'has' : 'ok'}"><div class="ic">${ch.length ? I.alert : I.check}</div><div><b>${esc(ch.length ? t('drv.sumChange' + g, { n: ch.length }) : t('drv.sumOk' + g))}</b>${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div></div>`
    + grp(t('drv.change'), ch) + grp(t('drv.unknown'), un) + grp(t('drv.info'), na)
    + (ok.length ? `<details class="okgrp"${UI.okOpen ? ' open' : ''}><summary class="group-t">${I.check}${esc(t('drv.ok', { n: ok.length }))}</summary><div class="rows">${ok.map(i => stateRow(i, showScope)).join('')}</div></details>` : '');
}
const changeCount = g => (g.rec.driver && g.rec.driver.state ? g.rec.driver.state.change : 0);

// ---------- iskelet ----------
function renderRail() {
  const warn = S ? S.checks.filter(c => c.level === 'warn').length : 0;
  const unseen = S && S.changes[0] && S.changes[0].at > mem.get('seenChanges', 0) && !S.changes[0].first;
  $('#rail').innerHTML = NAV.map(([id, icon]) => [id, t('nav.' + id), icon]).map(([id, label, icon]) => `<button class="tile" data-nav="${id}" aria-current="${UI.page === id ? 'page' : 'false'}" title="${label}">${icon}<span>${label}</span>${(id === 'overview' && warn) || (id === 'changes' && unseen) ? '<i class="dot"></i>' : ''}</button>`).join('');
}

function renderTitle() {
  const g = gpuOf(), d = dispOf();
  const chips = [];
  if (g) chips.push(`<span class="chip a">${I.gpu}${esc(g.name.replace(/^(AMD|NVIDIA)\s+/i, ''))}</span>`);
  if (d) chips.push(`<span class="chip">${I.monitor}${esc(d.name)} · ${esc(S.ctx.resLabel)} · ${S.ctx.hz} Hz</span>`);
  $('#sysline').innerHTML = chips.join('');
  const p = UI.progress;
  $('#scanstate').textContent = p ? `${p.stage}${p.total ? ` · ${p.done}/${p.total}` : ''}…` : S && S.lastScan ? t('lastScan', { t: timeAgo(S.lastScan) }) : '';
  const b = $('#scanBtn');
  b.innerHTML = `${I.refresh}<span>${esc(t('scan'))}</span>`;
  b.classList.toggle('spin', !!p);
  b.disabled = !!p;
  let bar = $('.progress');
  if (p && !bar) { bar = document.createElement('div'); bar.className = 'progress'; bar.innerHTML = '<i></i>'; document.body.appendChild(bar); }
  if (!p && bar) bar.remove();
}

function render() {
  if (!S) { $('#main').innerHTML = `<div class="loading"><div class="ring"></div><div>${esc(UI.progress ? UI.progress.stage : t('analyzing'))}…</div></div>`; renderRail(); return; }
  document.body.dataset.vendor = S.ctx.vendor || 'other';
  renderRail();
  renderTitle();
  const page = { overview, games, global: globalPage, changes, settings }[UI.page] || overview;
  const main = $('#main');
  const keep = UI.page === UI.lastPage ? main.scrollTop : 0;
  main.innerHTML = page();
  main.scrollTop = keep;
  UI.lastPage = UI.page;
  if (UI.page === 'games') { renderList(); renderDetail(); }
  if (UI.page === 'changes' && S.changes[0]) mem.set('seenChanges', S.changes[0].at);
}

function go(page) { UI.page = page; mem.set('page', page); UI.editing = false; render(); $('#main').focus({ preventScroll: true }); }

// ---------- Özet ----------
function gauge(cur, max) {
  const C = 2 * Math.PI * 50, arc = C * 0.75, r = Math.max(0, Math.min(1, cur / (max || cur || 1)));
  return `<div class="gauge"><svg viewBox="0 0 120 120"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="var(--acc-lo)"/><stop offset="1" stop-color="var(--acc-hi)"/></linearGradient></defs>
    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${arc} ${C}"/>
    <circle cx="60" cy="60" r="50" fill="none" stroke="url(#gg)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${arc * r} ${C}" style="filter:drop-shadow(0 0 6px var(--acc-glow))"/></svg>
    <div class="val"><b>${Math.round(cur)}</b><small>/ ${max} Hz</small></div></div>`;
}

function checkCard(c) {
  const ic = c.level === 'warn' ? I.alert : c.level === 'ok' ? I.check : I.info;
  return `<div class="glass flat check ${c.level}"><div class="ic">${ic}</div><div><b>${esc(c.title)}</b>${c.detail ? `<p>${esc(c.detail)}</p>` : ''}</div></div>`;
}

function changeCard(e) {
  return `<article class="glass tl"><div class="when"><span>${esc(fmtDate(e.at))}</span><span>${esc(e.reason || '')}</span></div><ul>${e.items.map(i => `<li class="t-${esc(i.type)}"><span class="ic">${CH_ICON[i.type] || I.info}</span><span>${esc(i.text)}</span></li>`).join('')}</ul></article>`;
}

function overview() {
  const g = gpuOf(), d = dispOf(), sys = S.system;
  const apps = sys.apps || {};
  const appLine = g && g.vendor === 'amd' ? (apps.amd ? t('ov.amdApp', { v: apps.amd.version || '' }) : t('ov.noAdrenalin'))
    : g && g.vendor === 'nvidia' ? (apps.nvidiaApp ? t('ov.nvApp', { v: apps.nvidiaApp.version || '' }) : t('ov.noNvApp'))
      : g && g.vendor === 'intel' ? (apps.intelSoftware ? t('ov.intelApp', { v: apps.intelSoftware.version || '' }) : apps.intelArcControl ? 'Arc Control' : t('ov.noIntelApp')) : '—';
  const sources = {};
  for (const x of S.games) sources[x.sourceName] = (sources[x.sourceName] || 0) + 1;
  const warn = S.checks.filter(c => c.level === 'warn'), info = S.checks.filter(c => c.level === 'info'), ok = S.checks.filter(c => c.level === 'ok');
  const others = sys.displays.filter(x => !d || x.id !== d.id);
  return `
  <div class="phead"><div><h1>${esc(t('ov.title'))}</h1><p>${esc(t('ov.lead', { t: timeAgo(S.lastScan), n: S.games.length, src: Object.entries(sources).map(([k, v]) => `${k} ${v}`).join(' · ') || t('ov.none') }))}</p></div>
    <div class="actions"><button class="btn primary" data-act="scan">${I.refresh}${esc(t('scanNow'))}</button></div></div>
  <div class="grid ov-top">
    <section class="glass card gpu-card"><div class="glow"></div>
      <div class="vendor">${esc(VENDOR[g ? g.vendor : 'other'])}</div>
      <h3>${esc(g ? g.name : t('ov.noGpu'))}</h3>
      <div class="sub">${esc(g ? [g.arch, g.vramGB ? t('ov.vram', { n: g.vramGB }) : null].filter(Boolean).join(' · ') : '')}</div>
      <div class="stats">
        <div class="stat"><small>${esc(t('ov.driver'))}</small><b>${esc(g && g.driver ? g.driver.display || g.driver.version || '—' : '—')}</b></div>
        <div class="stat"><small>${esc(t('ov.driverDate'))}</small><b>${esc(g && g.driver && g.driver.date ? g.driver.date : '—')}</b></div>
        <div class="stat"><small>${esc(t('ov.app'))}</small><b>${esc(appLine)}</b></div>
        ${g && g.driver && g.driver.amdPackage ? `<div class="stat"><small>${esc(t('ov.pkg'))}</small><b>${esc(g.driver.amdPackage)}</b></div>` : ''}
      </div>
      ${g ? `<div class="power"><small>${esc(t('ov.power'))}<b>${g.score}</b>${g.known ? '' : esc(t('ov.powerGuess'))}</small><div class="bar"><i style="width:${Math.min(100, g.score / 1.6)}%"></i></div></div>` : ''}
    </section>
    <section class="glass card">
      ${d ? `<div class="mon-card">${gauge(d.current.hz, d.maxHz)}
        <div><h3>${esc([d.manufacturer, d.name].filter(Boolean).join(' '))}</h3>
          <div class="sub">${esc(`${d.current.w}×${d.current.h}`)}${d.sizeInch ? ` · ${d.sizeInch}"` : ''}${d.connection ? ` · ${esc(d.connection)}` : ''}${d.year ? ` · ${d.year}` : ''}</div>
          <div class="tags">${d.vrr ? `<span class="chip ok">${I.bolt}${esc(d.vrr.kind)}</span>` : `<span class="chip">${esc(t('ov.noVrr'))}</span>`}
            ${d.hdr && d.hdr.supported ? `<span class="chip ${d.hdr.enabled ? 'a' : ''}">${I.hdr}${esc(t(d.hdr.enabled ? 'ov.hdrOn' : 'ov.hdrOff'))}${d.hdr.peakNits ? esc(t('ov.nits', { n: d.hdr.peakNits })) : ''}</span>` : ''}
            ${d.bitDepth ? `<span class="chip">${esc(t('ov.bit', { n: d.bitDepth }))}</span>` : ''}</div>
          ${d.vrr ? `<div class="vrr"><div class="track"><span class="range" style="left:${d.vrr.min / d.maxHz * 100}%;right:${Math.max(0, 100 - d.vrr.max / d.maxHz * 100)}%"></span><span class="mark" style="left:calc(${Math.min(100, d.current.hz / d.maxHz * 100)}% - 2px)"></span></div><div class="lbl"><span>${d.vrr.min} Hz</span><span>${esc(t('ov.nowHz', { n: Math.round(d.current.hz) }))}</span><span>${d.vrr.max} Hz</span></div></div>` : ''}
        </div></div>` : `<div class="empty">${esc(t('ov.noMon'))}</div>`}
      ${others.length ? `<div class="mini-mons">${others.map(o => `<span class="chip">${I.monitor}${esc(o.name)} · ${o.current.w}×${o.current.h} · ${Math.round(o.current.hz)} Hz</span>`).join('')}</div>` : ''}
    </section>
  </div>
  <div class="grid three" style="margin-top:16px">
    <section class="glass card"><div class="mini-h">${I.cpu}${esc(t('ov.cpu'))}</div><b class="mini-b">${esc(sys.cpu && sys.cpu.name)}</b><span class="mini-s">${esc(sys.cpu && sys.cpu.cores ? t('ov.cores', { c: sys.cpu.cores, t: sys.cpu.threads }) : '')}</span></section>
    <section class="glass card"><div class="mini-h">${I.ram}${esc(t('ov.ram'))}</div><b class="mini-b">${esc(sys.ram ? `${sys.ram.totalGB} GB ${sys.ram.type || ''}` : '—')}</b><span class="mini-s">${esc(sys.ram && sys.ram.configured ? t('ov.modules', { s: sys.ram.configured, n: sys.ram.modules }) : '')}</span></section>
    <section class="glass card"><div class="mini-h">${I.windows}${esc(t('ov.os'))}</div><b class="mini-b">${esc(sys.os && sys.os.name)}</b><span class="mini-s">${esc(sys.os ? [sys.os.displayVersion, sys.os.build ? t('ov.build', { b: `${sys.os.build}${sys.os.ubr ? '.' + sys.os.ubr : ''}` }) : sys.os.version].filter(Boolean).join(' · ') : '')}</span></section>
  </div>
  <h2 class="sec">${esc(t('ov.checks'))}</h2>
  <div class="checks">${[...warn, ...info].map(checkCard).join('') || ''}</div>
  ${ok.length ? `<div class="ok-row" style="margin-top:12px">${ok.map(c => `<span class="chip ok">${I.check}${esc(c.title)}</span>`).join('')}</div>` : ''}
  ${S.changes.length ? `<h2 class="sec">${esc(t('ov.recent'))}</h2><div class="timeline">${S.changes.slice(0, 2).map(changeCard).join('')}</div>` : ''}`;
}

// ---------- Oyunlar ----------
function games() {
  const app = S.global ? SHORT_APP[S.global.app] || S.global.app : t('games.driverApp');
  return `
  <div class="phead"><div><h1>${esc(t('games.title'))}</h1><p>${esc(t('games.lead', { n: S.games.length, app }))}</p></div>
    <div class="actions"><button class="btn" data-act="addFolder">${I.folder}${esc(t('games.addFolder'))}</button></div></div>
  <div class="games">
    <aside class="glass glist">
      <div class="top"><label class="search">${I.search}<input id="q" type="text" placeholder="${esc(t('games.search'))}" autocomplete="off" value="${esc(UI.q)}"></label><div class="fchips" id="fchips"></div></div>
      <div class="scroll" id="glist"></div>
    </aside>
    <section class="glass gdetail" id="gdetail"></section>
  </div>`;
}

function allGames() { return S.games.concat(S.catalog || []); }

function renderList() {
  const box = $('#glist');
  if (!box) return;
  const srcs = [...new Set(S.games.map(g => g.sourceName))];
  const catalogName = L.sources.catalog;
  const opts = [['hepsi', t('games.all')], ...srcs.map(s => [s, s]), ['katalog', catalogName]];
  $('#fchips').innerHTML = opts.map(([k, v]) => `<button class="fchip" data-filter="${esc(k)}" aria-pressed="${UI.filter === k}">${esc(v)}</button>`).join('');
  const q = lower(UI.q.trim());
  const match = g => !q || lower(g.name).includes(q);
  let list;
  if (UI.filter === 'katalog') list = (S.catalog || []).filter(match);
  else list = S.games.filter(g => (UI.filter === 'hepsi' || g.sourceName === UI.filter) && match(g));
  if (q && UI.filter === 'hepsi') list = list.concat((S.catalog || []).filter(match));
  const item = g => { const n = changeCount(g); return `<button class="gitem" data-game="${esc(g.id)}" aria-current="${g.id === UI.gameId}">${thumb(g)}<div style="min-width:0"><div class="nm">${esc(g.name)}</div>
    <div class="mt"><i class="lv lv${g.rec.L}"></i><span>${esc(t('levels')[g.rec.L])}</span><span>·</span><span>${esc(g.sourceName)}</span>${g.accessible === false && !g.catalog ? `<span>· ${esc(t('games.unreachable'))}</span>` : ''}</div></div>${n ? `<span class="badge" title="${esc(t('drv.badge', { n }))}">${n}</span>` : '<span></span>'}</button>`; };
  const recent = list.filter(g => g.lastPlayed), rest = list.filter(g => !g.lastPlayed);
  box.innerHTML = list.length
    ? (recent.length ? `<div class="grp">${esc(t('games.recent'))}</div>${recent.map(item).join('')}` : '') + (rest.length ? `<div class="grp">${esc(UI.filter === 'katalog' ? catalogName : recent.length ? t('games.others') : t('games.games'))} · ${rest.length}</div>${rest.map(item).join('')}` : '')
    : `<div class="empty">${esc(t('games.noMatch'))}</div>`;
}

function copyText(g) {
  const r = g.rec;
  const lines = [`${g.name} · ${S.ctx.resLabel} ${S.ctx.hz} Hz`];
  if (r.driver) { lines.push(`[${r.driver.app}]`); for (const i of r.driver.items) lines.push(`${i.state === 'change' ? '!' : '-'} ${i.k}${i.alt && i.alt !== i.k ? ` (${i.alt})` : ''}: ${i.v}${i.state === 'change' ? ` (${t('drv.now')}: ${i.cur})` : ''}`); }
  lines.push(`[${t('games.tabIngame')}]`);
  for (const i of r.ingame) lines.push(i.tip ? `- ${i.why}` : `- ${i.k}: ${i.v}`);
  return lines.join('\n');
}

function editForm(g) {
  const ov = g.profile.ov || {};
  const sel = (id, opts, val) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(val ?? '') === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  return `<div class="glass flat edit">
    <label>${esc(t('edit.type'))}${sel('e_t', [['', t('edit.autoX', { x: L.types[g.profile.t] })], ...Object.entries(L.types)], ov.t)}</label>
    <label>${esc(t('edit.load'))}${sel('e_y', [['', t('edit.autoX', { x: g.profile.y })], ...t('edit.loads').map((x, i) => [String(i + 1), x])], ov.y)}</label>
    <label>${esc(t('edit.fsr'))}${sel('e_f', [['', t('edit.auto')], ...Object.entries(t('edit.fsrOpts'))], ov.f)}</label>
    <label>${esc(t('edit.lock'))}${sel('e_c', [['', t('edit.auto')], ['1', t('edit.yes')], ['0', t('edit.no')]], ov.c60)}</label>
    <div class="full"><button class="btn primary sm" data-act="saveOv">${esc(t('edit.save'))}</button><button class="btn sm" data-act="resetOv">${esc(t('edit.reset'))}</button><button class="btn sm" data-act="cancelOv">${esc(t('edit.cancel'))}</button></div>
  </div>`;
}

function renderDetail() {
  const box = $('#gdetail');
  if (!box) return;
  const list = allGames();
  let g = list.find(x => x.id === UI.gameId);
  if (!g) { g = S.games[0] || list[0]; UI.gameId = g && g.id; }
  if (!g) { box.innerHTML = `<div class="empty">${esc(t('games.none'))}</div>`; return; }
  const r = g.rec, u = imgUrl(g);
  const tabs = [];
  if (r.driver) tabs.push(['driver', SHORT_APP[r.driver.app] || r.driver.app, I.app, changeCount(g)]);
  tabs.push(['ingame', t('games.tabIngame'), I.ingame]);
  if (g.probe) tabs.push(['files', t('games.tabFiles'), I.file]);
  if (!tabs.some(t => t[0] === UI.tab)) UI.tab = tabs[0][0];
  let body = '';
  if (UI.tab === 'driver' && r.driver) {
    const noRead = S.ctx.vendor === 'amd' && S.platform === 'win32' && !r.driver.state ? `<p class="muted-note">${esc(t('drv.noRead'))}</p>` : '';
    body = `<div class="apppath">${I.app}<span>${esc(r.driver.app)}</span><code>${esc(r.driver.path)}</code></div>` + (r.driver.state ? stateView(r.driver, 'game') : noRead +
      r.driver.groups.map(([title, keys]) => { const it = r.driver.items.filter(i => keys.includes(i.id)); return it.length ? `<div class="group-t">${esc(title)}</div>${rows(it)}` : ''; }).join(''));
  } else if (UI.tab === 'ingame') {
    body = `<div class="apppath">${I.ingame}<span>${esc(t('games.ingamePath'))}</span></div><div class="group-t">${esc(t('games.ingameGroup'))}</div>${rows(r.ingame)}`;
  } else if (UI.tab === 'files' && g.probe) {
    const p = g.probe;
    body = `<div class="apppath">${I.file}<span>${esc(t('games.filesHead', { n: p.scanned, cut: p.truncated ? t('games.filesCut') : '' }))}</span></div>
      <div class="rows">${[[t('games.dlssVer'), p.dlssVersion], [t('games.xessVer'), p.xessVersion], [t('games.fsrVer'), p.fsrFileVersion]].filter(x => x[1]).map(([k, v]) => `<div class="row"><div class="k">${esc(k)}</div>${pill(v, 'set')}</div>`).join('')}
      <div class="files">${p.files && p.files.length ? esc(p.files.join('\n')) : esc(t('games.filesNone'))}</div></div>`;
  }
  box.innerHTML = `
    <div class="ghero">${u ? `<div class="bgimg" style="background-image:url('${esc(u)}')"></div>` : ''}
      <div class="src">${esc(g.catalog ? t('games.catalogSrc') : g.sourceName)}${g.alsoIn && g.alsoIn.length ? esc(t('games.alsoIn', { list: g.alsoIn.join(', ') })) : ''}${g.accessible === false && !g.catalog ? ` · <span class="chip w">${esc(t('games.noAccess'))}</span>` : ''}</div>
      <h2>${esc(g.name)}</h2>
      <div class="tags">${r.tags.map(t => `<span class="chip ${esc(t.k)}">${esc(t.t)}</span>`).join('')}</div>
      <div class="perf"><div class="meter">${[0, 1, 2, 3].map(i => `<i class="${i <= r.L ? 'f' + r.L : ''}"></i>`).join('')}</div><span>${esc(t('games.perf', { res: S.ctx.resLabel, hz: S.ctx.hz }))}<b>${esc(r.perf)}</b></span></div>
    </div>
    <div class="gbody">
      ${r.notes.length ? `<div class="notes">${r.notes.map(n => `<div class="note">${esc(n)}</div>`).join('')}</div>` : ''}
      <div class="tabbar"><div class="seg" role="tablist">${tabs.map(([id, label, icon, n]) => `<button role="tab" data-tab="${id}" aria-pressed="${UI.tab === id}">${icon}${esc(label)}${n ? `<i class="cnt" title="${esc(t('drv.badge', { n }))}">${n}</i>` : ''}</button>`).join('')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm" data-act="copy" title="${esc(t('games.copyTitle'))}">${I.copy}${esc(t('games.copy'))}</button>
          <button class="btn sm" data-act="edit" title="${esc(t('games.editTitle'))}">${I.edit}${esc(t('games.edit'))}</button>
          ${g.installDir && g.accessible ? `<button class="btn sm icon" data-act="openDir" title="${esc(t('games.openDir'))}">${I.folder}</button>` : ''}
          ${!g.catalog ? `<button class="btn sm icon" data-act="hide" title="${esc(t('games.hide'))}">${I.eyeoff}</button>` : ''}
        </div></div>
      ${UI.editing ? editForm(g) : ''}
      ${body}
      <p style="color:var(--faint);font-size:12px;margin-top:18px">${esc(t('games.disclaimer'))}</p>
    </div>`;
}

// ---------- Genel ayarlar ----------
function globalPage() {
  const G = S.global;
  const sysChecks = S.checks.filter(c => c.area !== 'monitor');
  const monChecks = S.checks.filter(c => c.area === 'monitor');
  return `
  <div class="phead"><div><h1>${esc(t('global.title'))}</h1><p>${esc(t('global.lead'))}</p></div></div>
  ${G ? `<section class="glass card"><div class="apppath" style="margin-top:0">${I.app}<span>${esc(G.app)}</span><code>${esc(G.path)}</code></div>${G.state ? stateView(G, 'global') : `<div style="margin-top:14px">${rows(G.items)}</div>`}</section>` : `<section class="glass card"><p style="margin:0;color:var(--muted)">${esc(t('global.noApp'))}</p></section>`}
  <h2 class="sec">${esc(t('global.monitor'))}</h2><div class="checks">${monChecks.map(checkCard).join('')}</div>
  <h2 class="sec">${esc(S.platform === 'win32' ? t('global.winSys') : t('global.sys'))}</h2><div class="checks">${sysChecks.map(checkCard).join('') || `<div class="empty">${esc(t('global.none'))}</div>`}</div>`;
}

// ---------- Değişiklikler ----------
function changes() {
  const s = S.settings;
  return `
  <div class="phead"><div><h1>${esc(t('changes.title'))}</h1><p>${esc(t('changes.lead') + (s.watch ? t('changes.watchOn', { n: s.intervalMin }) : t('changes.watchOff')))}</p></div>
    <div class="actions"><button class="btn primary" data-act="scan">${I.refresh}${esc(t('scanNow'))}</button></div></div>
  <div class="timeline">${S.changes.length ? S.changes.map(changeCard).join('') : `<div class="empty">${esc(t('changes.empty'))}</div>`}</div>`;
}

// ---------- Ayarlar ----------
function sw(key, val) { return `<button class="switch" role="switch" aria-checked="${!!val}" data-switch="${key}"></button>`; }
function settings() {
  const s = S.settings, sys = S.system;
  const realGpus = sys.gpus.filter(g => !g.virtual);
  const goal = [['kalite', I.spark], ['denge', I.sliders], ['fps', I.bolt]];
  const theme = s.theme || 'dark';
  const mat = s.material || 'acrylic';
  const sysLang = (S.langs || []).find(x => x.id === S.systemLang);
  const langs = [['system', t('settings.langSystem', { x: sysLang ? sysLang.name : '' })], ...(S.langs || []).map(x => [x.id, x.name])];
  const langPref = s.lang || 'system';
  return `
  <div class="phead"><div><h1>${esc(t('settings.title'))}</h1><p>${esc(t('settings.lead'))}</p></div></div>
  <div class="settings">
    <section class="glass">
      <div class="srow"><div><b>${esc(t('settings.lang'))}</b><p>${esc(t('settings.langWhy'))}</p></div>
        <div class="seg">${langs.map(([k, label]) => `<button data-lang="${esc(k)}" aria-pressed="${langPref === k}">${esc(label)}</button>`).join('')}</div></div>
      <div class="srow"><div><b>${esc(t('settings.goal'))}</b><p>${esc(t('settings.goalWhy'))}</p></div>
        <div class="seg">${goal.map(([k, ic]) => `<button data-goal="${k}" aria-pressed="${s.goal === k}">${ic}${esc(t('settings.goals.' + k))}</button>`).join('')}</div></div>
      <div class="srow"><div><b>${esc(t('settings.gpu'))}</b><p>${esc(t('settings.gpuWhy'))}</p></div>
        <select data-setting="gpuId"><option value="">${esc(t('settings.gpuAuto'))}</option>${realGpus.map(g => `<option value="${esc(g.id)}" ${s.gpuId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></div>
      <div class="srow"><div><b>${esc(t('settings.mon'))}</b><p>${esc(t('settings.monWhy'))}</p></div>
        <select data-setting="displayId"><option value="">${esc(t('settings.monAuto'))}</option>${sys.displays.map(d => `<option value="${esc(d.id)}" ${s.displayId === d.id ? 'selected' : ''}>${esc(d.name)} · ${d.current.w}×${d.current.h} · ${Math.round(d.current.hz)} Hz</option>`).join('')}</select></div>
    </section>
    <section class="glass">
      <div class="srow"><div><b>${esc(t('settings.folders'))}</b><p>${esc(t('settings.foldersWhy'))}</p>
        <div class="folders">${(s.folders || []).map(f => `<div class="folder">${I.folder}<span title="${esc(f)}">${esc(f)}</span><button class="btn sm icon" data-rmfolder="${esc(f)}" title="${esc(t('settings.remove'))}">${I.x}</button></div>`).join('') || ''}
        ${(S.libraries.autoFolders || []).filter(f => !(s.folders || []).includes(f)).map(f => `<div class="folder" style="opacity:.75">${I.folder}<span>${esc(f)}</span><span class="chip" style="flex:none">${esc(t('settings.auto'))}</span></div>`).join('')}</div></div>
        <button class="btn" data-act="addFolder">${I.plus}${esc(t('settings.addFolder'))}</button></div>
      <div class="srow"><div><b>${esc(t('settings.autoFolders'))}</b><p>${esc(t('settings.autoFoldersWhy'))}</p></div>${sw('autoFolders', s.autoFolders !== false)}</div>
      ${(s.hidden || []).length ? `<div class="srow"><div><b>${esc(t('settings.hidden'))}</b><p>${esc(s.hidden.join(', '))}</p></div><button class="btn sm" data-act="unhideAll">${esc(t('settings.unhide'))}</button></div>` : ''}
      <div class="srow"><div><b>${esc(t('settings.online'))}</b><p>${esc(t('settings.onlineWhy'))}</p></div>${sw('online', s.online)}</div>
    </section>
    <section class="glass">
      <div class="srow"><div><b>${esc(t('settings.watch'))}</b><p>${esc(t('settings.watchWhy'))}</p></div>${sw('watch', s.watch)}</div>
      <div class="srow"><div><b>${esc(t('settings.interval'))}</b><p>${esc(t('settings.intervalWhy'))}</p></div>
        <select data-setting="intervalMin">${[5, 15, 30, 60].map(m => `<option value="${m}" ${+s.intervalMin === m ? 'selected' : ''}>${esc(t('settings.minutes', { n: m }))}</option>`).join('')}</select></div>
      <div class="srow"><div><b>${esc(S.platform === 'darwin' ? t('settings.loginMac') : t('settings.loginWin'))}</b><p>${esc(t('settings.loginWhy'))}</p></div>${sw('openAtLogin', s.openAtLogin)}</div>
      <div class="srow"><div><b>${esc(t('settings.tray'))}</b><p>${esc(t('settings.trayWhy'))}</p></div>${sw('closeToTray', s.closeToTray)}</div>
    </section>
    <section class="glass">
      <div class="srow"><div><b>${esc(t('settings.theme'))}</b></div><div class="seg">${['dark', 'light'].map(k => `<button data-theme-set="${k}" aria-pressed="${theme === k}">${esc(t('settings.themes.' + k))}</button>`).join('')}</div></div>
      ${S.platform === 'win32' ? `<div class="srow"><div><b>${esc(t('settings.material'))}</b><p>${esc(t('settings.materialWhy'))}</p></div><div class="seg">${['acrylic', 'mica', 'none'].map(k => `<button data-material="${k}" aria-pressed="${mat === k}">${esc(t('settings.materials.' + k))}</button>`).join('')}</div></div>` : ''}
      <div class="srow"><div><b>${esc(t('settings.data'))}</b><p>${esc(t('settings.dataWhy'))}</p></div><button class="btn sm" data-act="openData">${I.open}${esc(t('settings.open'))}</button></div>
    </section>
  </div>`;
}

// ---------- olaylar ----------
async function setSettings(patch) { await api.settings(patch); }

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-nav],[data-act],[data-game],[data-filter],[data-tab],[data-switch],[data-goal],[data-lang],[data-theme-set],[data-material],[data-rmfolder]');
  if (!el) return;
  const g = allGames().find(x => x.id === UI.gameId);
  if (el.dataset.nav) return go(el.dataset.nav);
  if (el.dataset.game) { UI.gameId = el.dataset.game; mem.set('game', UI.gameId); UI.editing = false; renderList(); renderDetail(); $('#gdetail').scrollTop = 0; return; }
  if (el.dataset.filter) { UI.filter = el.dataset.filter; renderList(); return; }
  if (el.dataset.tab) { UI.tab = el.dataset.tab; renderDetail(); return; }
  if (el.dataset.switch) { const k = el.dataset.switch; const v = el.getAttribute('aria-checked') !== 'true'; el.setAttribute('aria-checked', v); return setSettings({ [k]: v }); }
  if (el.dataset.goal) return setSettings({ goal: el.dataset.goal });
  if (el.dataset.lang) return setSettings({ lang: el.dataset.lang });
  if (el.dataset.themeSet) { document.documentElement.dataset.theme = el.dataset.themeSet; return setSettings({ theme: el.dataset.themeSet }); }
  if (el.dataset.material) { await setSettings({ material: el.dataset.material }); toast(t('toast.material'), t('toast.materialWhy')); return; }
  if (el.dataset.rmfolder) return setSettings({ folders: (S.settings.folders || []).filter(f => f !== el.dataset.rmfolder) });
  switch (el.dataset.act) {
    case 'scan': return api.scan();
    case 'addFolder': { const p = await api.pickFolder(); if (p && !(S.settings.folders || []).includes(p)) { toast(t('toast.folder'), p, I.folder); await setSettings({ folders: [...(S.settings.folders || []), p] }); } return; }
    case 'copy': if (g) { await api.copy(copyText(g)); toast(t('toast.copied'), t('toast.copiedWhy'), I.copy); } return;
    case 'edit': UI.editing = !UI.editing; renderDetail(); return;
    case 'cancelOv': UI.editing = false; renderDetail(); return;
    case 'resetOv': UI.editing = false; return api.override(UI.gameId, null);
    case 'saveOv': {
      const v = id => $('#' + id).value;
      const ov = { t: v('e_t') || null, y: v('e_y') ? +v('e_y') : null, f: v('e_f') || null, c60: v('e_c') === '' ? null : +v('e_c') };
      UI.editing = false;
      return api.override(UI.gameId, ov);
    }
    case 'openDir': if (g && g.installDir) api.openPath(g.installDir); return;
    case 'hide': if (g && !g.catalog) { toast(t('toast.hidden'), t('toast.hiddenWhy', { name: g.name }), I.eyeoff); UI.gameId = null; return setSettings({ hidden: [...(S.settings.hidden || []), g.id] }); } return;
    case 'unhideAll': return setSettings({ hidden: [] });
    case 'openData': return api.openData();
  }
});

// "Zaten doğru" listesi açık/kapalı durumu yeniden çizimlerde korunur (toggle olayı kabarcıklanmaz; yakalama aşamasında dinlenir).
document.addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('okgrp')) UI.okOpen = e.target.open; }, true);
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { UI.q = e.target.value; renderList(); }
});
document.addEventListener('change', (e) => {
  const k = e.target.dataset && e.target.dataset.setting;
  if (!k) return;
  const v = e.target.value;
  setSettings({ [k]: k === 'intervalMin' ? +v : v || null });
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); if (UI.page !== 'games') go('games'); setTimeout(() => $('#q') && $('#q').focus(), 0); }
  if (e.key === 'F5') { e.preventDefault(); api.scan(); }
});
$('#scanBtn').addEventListener('click', () => api.scan());

// ---------- başlangıç ----------
(async () => {
  document.documentElement.classList.add('platform-' + (api.platform || 'win32'));
  if (api.material && api.material !== 'none') document.body.classList.add('mat');
  await loadI18n();
  api.onProgress(p => { UI.progress = p; if (S) renderTitle(); else render(); });
  api.onState(async s => {
    S = s;
    document.documentElement.dataset.theme = s.settings.theme || 'dark';
    // Dil değiştiyse önce yeni dilin arayüz metinleri alınır; bu sırada daha yeni bir durum geldiyse onu o çizer.
    if (s.lang && s.lang !== L.lang) { await loadI18n(); if (S !== s) return; }
    // Arama kutusuna yazarken odak kaybolmasın: oyunlar sayfasında yalnızca liste ve ayrıntı yenilenir.
    if (UI.page === 'games' && $('#glist') && document.activeElement && document.activeElement.id === 'q') { renderTitle(); renderRail(); renderList(); renderDetail(); }
    else render();
  });
  api.onChanges(items => toast(t('toast.change'), items.map(i => i.text).slice(0, 3).join(' · ') + (items.length > 3 ? ` (+${items.length - 3})` : ''), I.history));
  api.onNavigate(p => go(p));
  api.onError(m => toast(t('toast.scanError'), m, I.alert));
  UI.progress = await api.progress();
  S = await api.state();
  if (S && S.lang && S.lang !== L.lang) await loadI18n();
  if (S) document.documentElement.dataset.theme = S.settings.theme || 'dark';
  render();
  setInterval(() => { if (S && !UI.progress) renderTitle(); }, 30000);
})();
