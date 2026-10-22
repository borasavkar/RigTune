'use strict';
// Ortak yardımcılar: komut çalıştırma, PowerShell betiği, JSON kalıcı depo, ad normalleştirme.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function exec(cmd, args, { timeout = 30000, maxBuffer = 64 * 1024 * 1024 } = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, maxBuffer, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '', error: err || null });
    });
  });
}

// Betik paketlenmiş (asar) bir yerde olabilir; içeriği geçici dosyaya yazıp oradan çalıştırırız.
async function runPowerShell(scriptPath, { timeout = 60000 } = {}) {
  const body = fs.readFileSync(scriptPath, 'utf8');
  const tmp = path.join(os.tmpdir(), `oar-${process.pid}-${crypto.randomBytes(4).toString('hex')}.ps1`);
  // PowerShell 5.1, BOM olmadan UTF-8 dosyayı ANSI okur; BOM ekliyoruz.
  fs.writeFileSync(tmp, '﻿' + body, 'utf8');
  try {
    const r = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmp], { timeout });
    const s = r.stdout;
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('PowerShell çıktısı okunamadı: ' + (r.stderr || (r.error && r.error.message) || s.slice(0, 300)));
    return JSON.parse(s.slice(a, b + 1));
  } finally {
    fs.rm(tmp, { force: true }, () => {});
  }
}

// Veri klasörü uygulamanın adını taşır (Electron'un userData klasörüyle aynı). 22 Ekim 2026'da ad "Oyun Ayar Rehberi"nden "RigTune"a değişti.
const APP_DIR = 'RigTune', LEGACY_DIR = 'Oyun Ayar Rehberi';
function defaultDataDir(name = APP_DIR) {
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), name);
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', name);
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), name);
}

// Eski addaki veri klasöründen ayarları, geçmişi ve önbellekleri bir kez kopyalar. Yeni klasörde ayar dosyası varsa
// ya da klasör uygulamanın kendi klasörü değilse (ör. --user-data-dir ile verilen deneme klasörü) hiçbir şey yapmaz.
// Eski klasör silinmez.
const DATA_FILES = ['settings', 'snapshot', 'changes', 'cache-probe', 'cache-meta', 'playnite-games'].map(n => n + '.json');
function migrateDataDir(dir) {
  if (path.basename(dir) !== APP_DIR || exists(path.join(dir, 'settings.json'))) return false;
  const old = path.join(path.dirname(dir), LEGACY_DIR);
  if (!isDir(old)) return false;
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const f of DATA_FILES) {
    const src = path.join(old, f);
    if (exists(src) && !exists(path.join(dir, f))) { fs.copyFileSync(src, path.join(dir, f)); n++; }
  }
  return n > 0;
}

class Store {
  constructor(dir) { this.dir = dir; fs.mkdirSync(dir, { recursive: true }); }
  file(name) { return path.join(this.dir, name + '.json'); }
  read(name, def) {
    try { return JSON.parse(fs.readFileSync(this.file(name), 'utf8')); } catch { return def; }
  }
  write(name, data) {
    const f = this.file(name), tmp = f + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1), 'utf8');
    fs.renameSync(tmp, f);
  }
}

// Oyun adlarını eşleştirmek için: küçük harf, aksan ve işaretler atılır, sık kullanılan ekler kırpılır.
const SUFFIX = /\b(definitive|remastered|enhanced|complete|deluxe|ultimate|gold|premium|standard|game of the year|goty|anniversary|directors cut|director s cut|edition|pc)\b/g;
function norm(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function normLoose(s) { return norm(s).replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim(); }

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); } catch { return null; } }
function hash(obj) { return crypto.createHash('sha1').update(typeof obj === 'string' ? obj : JSON.stringify(obj)).digest('hex').slice(0, 16); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

module.exports = { exec, runPowerShell, defaultDataDir, migrateDataDir, APP_DIR, LEGACY_DIR, Store, norm, normLoose, exists, isDir, readText, readJson, hash, clamp };
