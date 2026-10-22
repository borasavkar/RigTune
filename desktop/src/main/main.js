'use strict';
// Electron ana süreci: pencere, tepsi simgesi, değişiklik izleme, bildirimler, arayüz köprüsü.
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell, clipboard, screen, powerMonitor, Notification, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { Analyzer } = require('../core');
const { migrateDataDir } = require('../core/util');
const { LOCALES } = require('../locales');

const RENDERER = path.join(__dirname, '..', 'renderer');
const ICON = path.join(RENDERER, 'assets', 'icon.png');
const hiddenStart = process.argv.includes('--hidden');

protocol.registerSchemesAsPrivileged([{ scheme: 'oar', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
const APP_ID = 'tr.savkar.rigtune';
app.setAppUserModelId(APP_ID);

let win = null, tray = null, analyzer = null, quitting = false, timer = null, displayPoll = null, lastDisplaySig = '';

// Geliştirme: OAR_SHOT=klasör verilirse her bölümün ekran görüntüsünü alıp kapanır.
const SHOT = process.env.OAR_SHOT || null;
// Başka pencerelerin arkasında kalan pencere Windows'ta çizilmez; görüntü alma modunda bu iyileştirme kapatılır.
if (SHOT) app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

function material() {
  if (SHOT) return null;
  const m = analyzer.settings.material || 'acrylic';
  if (process.platform !== 'win32' || m === 'none') return null;
  const build = parseInt((require('os').release().split('.')[2]) || '0', 10);
  return build >= 22621 ? m : null; // Windows 11 22H2 ve sonrası
}

function createWindow(show) {
  const mat = material();
  win = new BrowserWindow({
    width: 1360, height: 880, minWidth: 1000, minHeight: 660, show: false,
    title: analyzer.t('app.name'), icon: ICON,
    backgroundColor: mat ? '#00000000' : '#0b0d14',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : { color: '#00000000', symbolColor: '#dfe6f3', height: 44 },
    ...(mat ? { backgroundMaterial: mat } : {}),
    ...(process.platform === 'darwin' ? { vibrancy: 'under-window', visualEffectState: 'active' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false,
      additionalArguments: [`--oar-material=${mat || 'none'}`, `--oar-platform=${process.platform}`],
    },
  });
  win.loadURL('oar://app/index.html');
  win.once('ready-to-show', () => { if (show) win.show(); });
  win.on('close', (e) => {
    if (!quitting && analyzer.settings.closeToTray && tray) { e.preventDefault(); win.hide(); }
  });
  win.on('closed', () => { win = null; });
  win.on('focus', () => refreshAmdSoon());
  // Taşınabilir sürüm her açılışta Temp'te rastgele adlı bir klasöre açılır, kapanınca o klasör silinir. Görev çubuğuna
  // sabitlenen simge o geçici yolu gösterirse uygulama kapanınca beyaz kağıt simgesine döner (22 Ekim 2026'da görüldü).
  // Sabitleme, simge ve yeniden açma komutu taşınabilir exe dosyasının kendisini göstersin; electron-builder bu yolu
  // PORTABLE_EXECUTABLE_FILE değişkeninde verir. Kurulumla gelen sürümde bu değişken yoktur ve gerek de yoktur.
  const portableExe = process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_FILE;
  if (portableExe) {
    try { win.setAppDetails({ appId: APP_ID, appIconPath: portableExe, appIconIndex: 0, relaunchCommand: `"${portableExe}"`, relaunchDisplayName: analyzer.t('app.name') }); } catch { /* desteklenmiyor */ }
  }
  // Arayüzden yalnızca uygulama içi adresler açılır; dış bağlantılar tarayıcıya gider.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('oar://')) e.preventDefault(); });
}

function showWindow(page) {
  if (!win) createWindow(true);
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  if (page) win.webContents.send('navigate', page);
}

function buildTray() {
  const img = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  const t = k => analyzer.t(k);
  const menu = () => Menu.buildFromTemplate([
    { label: t('main.open'), click: () => showWindow() },
    { label: t('main.scan'), click: () => analyzer.scan('tray') },
    { type: 'separator' },
    { label: t('main.login'), type: 'checkbox', checked: !!analyzer.settings.openAtLogin, click: (i) => applySettings({ openAtLogin: i.checked }) },
    { label: t('main.watch'), type: 'checkbox', checked: !!analyzer.settings.watch, click: (i) => applySettings({ watch: i.checked }) },
    { type: 'separator' },
    { label: t('main.quit'), click: () => { quitting = true; app.quit(); } },
  ]);
  const refresh = () => { if (!tray) return; tray.setToolTip(t('app.name')); tray.setContextMenu(menu()); };
  refresh();
  tray.on('click', () => showWindow());
  // Dil değişince menü ve ipucu da yeni dille kurulur.
  analyzer.on('state', refresh);
}

function send(ch, data) { if (win && !win.isDestroyed()) win.webContents.send(ch, data); }

function schedule() {
  clearInterval(timer); clearInterval(displayPoll);
  if (!analyzer.settings.watch) return;
  const min = Math.max(5, +analyzer.settings.intervalMin || 15);
  timer = setInterval(() => analyzer.scan('periodic').catch(() => {}), min * 60000);
  // Yenileme hızı değişikliği her zaman ekran olayı üretmez; ekran listesini kısa aralıkla karşılaştırırız.
  // İlk ölçüm yalnızca referans alınır: açılışta Electron yenileme hızını bir an 0 bildirebiliyor.
  lastDisplaySig = '';
  displayPoll = setInterval(() => {
    const s = displaySig();
    if (!lastDisplaySig || /@0:/.test(s)) { lastDisplaySig = s; return; }
    if (s !== lastDisplaySig) { lastDisplaySig = s; debouncedScan('display'); }
  }, 5000);
}

function displaySig() {
  return screen.getAllDisplays().map(d => `${d.id}:${d.size.width}x${d.size.height}@${Math.round(d.displayFrequency || 0)}:${d.scaleFactor}:${d.colorDepth}`).sort().join('|');
}

let debounce = null;
function debouncedScan(reason) {
  if (process.env.OAR_DEBUG) console.log('[izleme]', new Date().toISOString(), reason, displaySig());
  clearTimeout(debounce);
  debounce = setTimeout(() => analyzer.scan(reason).catch(() => {}), 3000);
}

// Adrenalin'de ayar değişince öneriler yeniden karşılaştırılır: ayar dosyaları izlenir, pencereye dönünce de okunur.
// Tam tarama yapılmaz; yalnızca Adrenalin ayarları okunur (Analyzer.refreshAmd).
let amdTimer = null;
function refreshAmdSoon() { clearTimeout(amdTimer); amdTimer = setTimeout(() => analyzer.refreshAmd().catch(() => {}), 1200); }
function watchAmd() {
  if (process.platform !== 'win32') return;
  const { files } = require('../core/detect/amd-settings');
  const f = files();
  for (const p of [f.apl, f.gex]) fs.watchFile(p, { interval: 2000 }, (cur, prev) => { if (cur.mtimeMs !== prev.mtimeMs) refreshAmdSoon(); });
}

function applySettings(patch) {
  if ('openAtLogin' in patch && (app.isPackaged || process.platform !== 'linux')) {
    // Taşınabilir sürümde çalışan exe Temp'teki geçici kopyadır; açılışa taşınabilir dosyanın kendisi yazılır.
    const portableExe = process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_FILE;
    try { app.setLoginItemSettings({ openAtLogin: !!patch.openAtLogin, args: ['--hidden'], ...(portableExe ? { path: portableExe } : {}) }); } catch { /* desteklenmiyor */ }
  }
  const r = analyzer.setSettings(patch);
  if ('watch' in patch || 'intervalMin' in patch) schedule();
  return r;
}

function notifyChanges(items) {
  if (!Notification.isSupported()) return;
  if (win && win.isVisible() && win.isFocused()) return;
  const t = (k, p) => analyzer.t(k, p);
  const n = new Notification({
    title: t('main.notifyTitle'),
    body: items[0].text + (items.length > 1 ? t('main.notifyMore', { n: items.length - 1 }) : '') + t('main.notifyTail'),
    icon: ICON,
  });
  n.on('click', () => showWindow('changes'));
  n.show();
}

function registerProtocol() {
  protocol.handle('oar', async (req) => {
    const u = new URL(req.url);
    if (u.host === 'app') {
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.normalize(path.join(RENDERER, rel));
      if (!file.startsWith(RENDERER)) return new Response('', { status: 403 });
      return net.fetch(pathToFileURL(file).toString());
    }
    if (u.host === 'img') {
      // Yalnızca taranan oyunların kendi resimleri verilir.
      const id = decodeURIComponent(u.pathname.slice(1));
      const g = analyzer.state && analyzer.state.games.find(x => x.id === id);
      if (!g || !g.image || !fs.existsSync(g.image)) return new Response('', { status: 404 });
      return net.fetch(pathToFileURL(g.image).toString());
    }
    return new Response('', { status: 404 });
  });
}

function knownPath(p) {
  if (!p || !analyzer.state) return false;
  const n = path.normalize(p).toLowerCase();
  return analyzer.state.games.some(g => g.installDir && path.normalize(g.installDir).toLowerCase() === n) || n === path.normalize(app.getPath('userData')).toLowerCase();
}

function ipc() {
  ipcMain.handle('state', () => analyzer.state);
  ipcMain.handle('progress', () => analyzer.progress);
  ipcMain.handle('scan', () => analyzer.scan('manual').then(r => ({ items: r.items })).catch(e => ({ error: e.message })));
  // Arayüz metinleri: seçili dilin ui bölümü (+ oyun türü adları).
  ipcMain.handle('i18n', () => { const d = LOCALES[analyzer.lang]; return { lang: analyzer.lang, locale: d.meta.locale, appName: d.app.name, ui: d.ui, types: d.types, sources: d.sources }; });
  ipcMain.handle('settings', (_e, patch) => Promise.resolve(applySettings(patch || {})).then(() => true));
  ipcMain.handle('override', (_e, id, ov) => { analyzer.setOverride(String(id), ov); return true; });
  ipcMain.handle('pickFolder', async () => {
    const r = await dialog.showOpenDialog(win, { title: analyzer.t('main.pickFolder'), properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('openPath', (_e, p) => (knownPath(p) ? shell.openPath(p) : 'izin yok'));
  ipcMain.handle('openData', () => shell.openPath(app.getPath('userData')));
  ipcMain.handle('copy', (_e, text) => { clipboard.writeText(String(text || '')); return true; });
  ipcMain.handle('external', (_e, url) => { if (/^https:\/\/([a-z0-9-]+\.)*(amd\.com|nvidia\.com|intel\.com|microsoft\.com|steampowered\.com)\//i.test(url)) shell.openExternal(url); return true; });
  ipcMain.handle('info', () => ({ version: app.getVersion(), platform: process.platform, material: material(), dataDir: app.getPath('userData'), packaged: app.isPackaged }));
}

app.on('second-instance', () => showWindow());
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !tray) app.quit(); });
app.on('activate', () => showWindow());

app.whenReady().then(() => {
  // Sistem dili: Windows'ta görüntü dili (ör. 'tr-TR'); dil ayarı "Sistem" iken bu kullanılır.
  const sysLangs = typeof app.getPreferredSystemLanguages === 'function' ? app.getPreferredSystemLanguages() : [];
  // Uygulamanın eski adındaki ("Oyun Ayar Rehberi") veri klasöründen ayarlar ve geçmiş bir kez alınır.
  try { migrateDataDir(app.getPath('userData')); } catch { /* taşınamazsa varsayılan ayarlarla açılır */ }
  analyzer = new Analyzer(app.getPath('userData'), { systemLocale: sysLangs[0] || app.getLocale() });
  registerProtocol();
  ipc();
  analyzer.on('state', s => send('state', s));
  analyzer.on('progress', p => send('progress', p));
  analyzer.on('changes', items => { send('changes', items); notifyChanges(items); });
  createWindow(!(hiddenStart && analyzer.settings.watch));
  try { buildTray(); } catch { tray = null; }
  analyzer.scan(hiddenStart ? 'login' : 'startup').catch(e => send('error', e.message));
  if (SHOT) {
    analyzer.once('state', async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      await wait(2500);
      fs.mkdirSync(SHOT, { recursive: true });
      const pages = (process.env.OAR_SHOT_PAGES || 'overview,games,global,changes,settings').split(',');
      for (const p of pages) {
        const [page, extra] = p.split(':');
        win.webContents.send('navigate', page);
        if (extra) await win.webContents.executeJavaScript(`(()=>{const b=document.querySelector('[data-game*=${JSON.stringify(extra)}]')||[...document.querySelectorAll('[data-game]')].find(x=>x.textContent.includes(${JSON.stringify(extra)}));b&&b.click();return !!b})()`);
        await wait(900);
        win.webContents.invalidate();
        await win.webContents.capturePage();
        await wait(400);
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(SHOT, `${p.replace(/[^\w-]+/g, '_')}.png`), img.toPNG());
        // OAR_SHOT_SCROLL=1: katlı listeler açılıp sayfanın alt kısmı da ayrı görüntü olarak alınır.
        if (process.env.OAR_SHOT_SCROLL) {
          await win.webContents.executeJavaScript(`(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);for(const s of ['#gdetail','#main']){const e=document.querySelector(s);if(e)e.scrollTop=e.scrollHeight}})()`);
          await wait(500);
          win.webContents.invalidate();
          const img2 = await win.webContents.capturePage();
          fs.writeFileSync(path.join(SHOT, `${p.replace(/[^\w-]+/g, '_')}_alt.png`), img2.toPNG());
        }
      }
      quitting = true; app.quit();
    });
  }
  for (const ev of ['display-added', 'display-removed']) screen.on(ev, () => debouncedScan('display'));
  screen.on('display-metrics-changed', (_e, _d, changed) => { if (changed.some(m => m !== 'workArea')) debouncedScan('displaySettings'); });
  powerMonitor.on('resume', () => debouncedScan('resume'));
  schedule();
  watchAmd();
});
