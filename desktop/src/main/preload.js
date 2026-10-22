'use strict';
// Arayüzün ana süreçle konuştuğu tek kapı. Node erişimi arayüze verilmez.
const { contextBridge, ipcRenderer } = require('electron');

const arg = k => { const a = process.argv.find(x => x.startsWith(`--oar-${k}=`)); return a ? a.split('=')[1] : null; };
const on = ch => cb => { const f = (_e, d) => cb(d); ipcRenderer.on(ch, f); return () => ipcRenderer.removeListener(ch, f); };

contextBridge.exposeInMainWorld('oar', {
  material: arg('material'),
  platform: arg('platform'),
  state: () => ipcRenderer.invoke('state'),
  progress: () => ipcRenderer.invoke('progress'),
  scan: () => ipcRenderer.invoke('scan'),
  settings: patch => ipcRenderer.invoke('settings', patch),
  override: (id, ov) => ipcRenderer.invoke('override', id, ov),
  pickFolder: () => ipcRenderer.invoke('pickFolder'),
  openPath: p => ipcRenderer.invoke('openPath', p),
  openData: () => ipcRenderer.invoke('openData'),
  copy: t => ipcRenderer.invoke('copy', t),
  external: u => ipcRenderer.invoke('external', u),
  info: () => ipcRenderer.invoke('info'),
  i18n: () => ipcRenderer.invoke('i18n'),
  onState: on('state'),
  onProgress: on('progress'),
  onChanges: on('changes'),
  onNavigate: on('navigate'),
  onError: on('error'),
});
