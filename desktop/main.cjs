// Masaüstü (Steam) sürümü: Electron sarmalayıcı
// Oyunu app:// protokolüyle yükler (ES modülleri için güvenli kaynak)
const { app, BrowserWindow, protocol, net, ipcMain } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 640,
    backgroundColor: '#0b1424', title: 'Şehir Kurucu II', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  win.loadURL('app://game/index.html');
  if (process.argv.includes('--fullscreen')) win.setFullScreen(true);
  // duman testi: SK2_SMOKE=çıktı.png → 8 sn sonra ekran görüntüsü al ve kapat
  if (process.env.SK2_SMOKE) {
    win.webContents.on('console-message', (e, level, msg) => { if (level >= 3) console.log('HATA:', msg); });
    win.webContents.on('did-finish-load', () => setTimeout(async () => {
      const img = await win.webContents.capturePage();
      require('fs').writeFileSync(process.env.SK2_SMOKE, img.toPNG());
      console.log('başlık:', win.getTitle(), 'menü:', await win.webContents.executeJavaScript('!!(window.game && game.inMenu)'), 'masaüstü API:', await win.webContents.executeJavaScript('!!window.electronAPI'));
      app.quit();
    }, 9000));
  }
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
    if (!file.startsWith(ROOT)) return new Response('Yasak', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  ipcMain.on('quit', () => app.quit());
  ipcMain.on('fullscreen', (e, on) => BrowserWindow.fromWebContents(e.sender)?.setFullScreen(!!on));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
