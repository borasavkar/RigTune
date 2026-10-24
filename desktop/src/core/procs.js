'use strict';
// Kütüphanedeki hangi oyunların şu an açık olduğunu bulur (yalnızca Windows; macOS ve Linux'ta null döner).
// Süreç listesi tasklist ile alınır (yalnızca ad ve PID). Adı bir oyunun klasöründeki exe dosyalarından biriyle (probe.exes)
// eşleşen yeni süreçlerin tam yolu bir kez sorulur ve oyunun klasörüyle karşılaştırılır; böylece başka bir programın aynı
// adlı exe'si (ör. launcher.exe) oyunla karıştırılmaz. Yol okunamazsa (korumalı süreç) ad yalnızca tek bir oyuna aitse kabul edilir.
const { execFile } = require('child_process');
const path = require('path');

const run = (file, args, timeout = 8000) => new Promise((res) => {
  execFile(file, args, { windowsHide: true, timeout, maxBuffer: 8 << 20 }, (err, out) => res(err ? null : String(out)));
});

// tasklist /fo csv /nh: "ad.exe","PID","Oturum","Oturum#","Bellek"
function parseTasklist(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^"([^"]+)","(\d+)"/.exec(line);
    if (m) out.push({ name: m[1].toLowerCase(), pid: +m[2] });
  }
  return out;
}

async function listProcs() {
  const out = await run('tasklist.exe', ['/fo', 'csv', '/nh']);
  return out == null ? null : parseTasklist(out);
}

async function procPaths(pids) {
  if (!pids.length) return {};
  const cmd = `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id)|$($_.Path)" }`;
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd]);
  const res = {};
  for (const line of String(out || '').split(/\r?\n/)) {
    const m = /^(\d+)\|(.*)$/.exec(line.trim());
    if (m) res[+m[1]] = m[2] || null;
  }
  return res;
}

const norm = p => path.normalize(p).toLowerCase().replace(/[\\/]+$/, '') + path.sep;

// pidCache: PID → oyun kimliği ya da null (oyuna ait değil); çağrılar arasında saklanır, ölen süreçler silinir.
async function runningGames(games, probes, pidCache) {
  if (process.platform !== 'win32') return null;
  const byName = new Map();
  for (const g of games) {
    const p = probes[g.id];
    if (!g.installDir || !p || !p.exes) continue;
    for (const e of p.exes) {
      const n = path.basename(e).toLowerCase();
      if (!byName.has(n)) byName.set(n, new Set());
      byName.get(n).add(g.id);
    }
  }
  const procs = await listProcs();
  if (!procs) return null;
  const alive = new Set(procs.map(p => p.pid));
  for (const pid of [...pidCache.keys()]) if (!alive.has(pid)) pidCache.delete(pid);
  const cand = procs.filter(p => byName.has(p.name));
  const fresh = cand.filter(p => !pidCache.has(p.pid));
  if (fresh.length) {
    const paths = await procPaths(fresh.map(p => p.pid));
    const dirs = games.filter(g => g.installDir).map(g => [norm(g.installDir), g.id]).sort((a, b) => b[0].length - a[0].length);
    for (const p of fresh) {
      const full = paths[p.pid];
      let id = null;
      if (full) { const hit = dirs.find(([d]) => norm(full).startsWith(d)); id = hit ? hit[1] : null; } else {
        const ids = byName.get(p.name);
        id = ids.size === 1 ? [...ids][0] : null;
      }
      pidCache.set(p.pid, id);
    }
  }
  const out = new Set();
  for (const p of cand) { const id = pidCache.get(p.pid); if (id) out.add(id); }
  return out;
}

module.exports = { runningGames, parseTasklist, listProcs };
