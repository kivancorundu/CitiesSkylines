// Oyun sayfasına güvenli masaüstü API'si
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  quit: () => ipcRenderer.send('quit'),
  setFullscreen: (on) => ipcRenderer.send('fullscreen', on),
  isDesktop: true,
});
