/*
 * Second Korean Wars — PC 다운로드판 (Electron 메인 프로세스)
 *
 * 하는 일
 *  - app/ 폴더(빌드된 index.html, 오프닝 없음)를
 *    app://skw/ 라는 전용 주소로 띄운다. 인터넷에서는 아무것도 받지 않는다(오프라인 동작).
 *    file:// 대신 표준·보안 스킴을 쓰는 까닭: WebGPU(보안 컨텍스트 필요), localStorage,
 *    오프닝 iframe(srcdoc) 이 모두 일반 웹사이트처럼 동작하게 하려고.
 *  - 창 하나, 전체 화면으로 시작, 메뉴 막대 없음.
 *  - 게임 쪽 데스크톱 모드가 쓰는 window.skwDesktop (preload.js) 의 IPC 를 받는다.
 *  - 밖으로 나가는 링크는 시스템 브라우저로 열고, 앱 창은 다른 주소로 이동하지 못하게 막는다.
 *
 * 디버깅: 실행할 때 --devtools 를 붙이면 개발자 도구가 열린다.
 */
'use strict';
const { app, BrowserWindow, Menu, ipcMain, protocol, net, shell, session } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const SCHEME = 'app';
const HOST = 'skw';
const ORIGIN = `${SCHEME}://${HOST}`;
const START_URL = `${ORIGIN}/index.html`;
const APP_DIR = path.join(__dirname, 'app');
const DEVTOOLS = process.argv.includes('--devtools');

// ── GPU / WebGPU 스위치 (app ready 전에 넣어야 한다) ─────────────────────────────
// Windows(D3D12) · macOS(Metal) 는 Chromium 에서 WebGPU 가 기본으로 켜져 있지만,
// 차단 목록에 걸린 GPU·드라이버에서도 돌도록 아래 둘을 모든 OS 에 넣는다.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
// Linux 의 WebGPU 는 Vulkan 백엔드가 필요하다.
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-features', 'Vulkan');
// 게임이므로 창이 가려져도 오디오·타이머가 느려지지 않게 한다.
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// app:// 을 일반 https 사이트처럼 취급하게 등록 (app ready 전에 한 번만)
protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true },
}]);

// ── 하나만 실행 ──────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  // 외부 링크는 http/https/mailto 만 시스템 브라우저로 연다
  const openOutside = (url) => {
    try {
      const u = new URL(String(url));
      if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
        shell.openExternal(u.toString());
        return true;
      }
    } catch (e) { /* 잘못된 주소는 무시 */ }
    return false;
  };

  // app://skw/<경로> → app/<경로> 파일. app/ 밖으로 나가는 경로는 404.
  const serveApp = async (request) => {
    try {
      const u = new URL(request.url);
      if (u.host !== HOST) return new Response('Not found', { status: 404 });
      let rel = decodeURIComponent(u.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const file = path.normalize(path.join(APP_DIR, rel));
      if (file !== APP_DIR && !file.startsWith(APP_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
      return await net.fetch(pathToFileURL(file).toString());
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  };

  const createWindow = () => {
    win = new BrowserWindow({
      title: 'Second Korean Wars',
      width: 1280,
      height: 720,
      minWidth: 960,
      minHeight: 540,
      fullscreen: true,
      fullscreenable: true,
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      show: false,
      icon: path.join(__dirname, 'app', 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: false,
        spellcheck: false,
        autoplayPolicy: 'no-user-gesture-required',
        additionalArguments: [`--skw-version=${app.getVersion()}`],
      },
    });
    win.setMenuBarVisibility(false);

    win.once('ready-to-show', () => { win.show(); win.focus(); });

    const wc = win.webContents;
    // 새 창(target=_blank, window.open) → 시스템 브라우저
    wc.setWindowOpenHandler(({ url }) => { openOutside(url); return { action: 'deny' }; });
    // 앱 밖으로 이동 금지 (외부 주소면 시스템 브라우저로)
    wc.on('will-navigate', (e, url) => {
      if (url.startsWith(ORIGIN + '/')) return;
      e.preventDefault();
      openOutside(url);
    });
    wc.on('will-redirect', (e, url) => { if (!url.startsWith(ORIGIN + '/')) e.preventDefault(); });
    wc.on('will-attach-webview', (e) => e.preventDefault());
    // 렌더러가 죽으면 한 번 다시 띄운다
    let reloads = 0;
    wc.on('render-process-gone', (_e, d) => {
      if (d.reason !== 'clean-exit' && reloads++ < 2 && !win.isDestroyed()) win.loadURL(START_URL);
    });
    // F12 / Ctrl+Shift+I 개발자 도구는 --devtools 로 실행했을 때만
    if (DEVTOOLS) wc.openDevTools({ mode: 'detach' });

    win.on('closed', () => { win = null; });
    win.loadURL(START_URL);
  };

  // ── window.skwDesktop 의 IPC ─────────────────────────────────────────────────
  const fromApp = (e) => !!e.senderFrame && String(e.senderFrame.url || '').startsWith(ORIGIN + '/');
  ipcMain.handle('skw:quit', (e) => { if (fromApp(e)) app.quit(); });
  ipcMain.handle('skw:setFullscreen', (e, on) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w && fromApp(e)) w.setFullScreen(!!on);
    return w ? w.isFullScreen() : false;
  });
  ipcMain.handle('skw:isFullscreen', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    return w ? w.isFullScreen() : false;
  });
  ipcMain.handle('skw:openExternal', (e, url) => (fromApp(e) ? openOutside(url) : false));

  app.whenReady().then(() => {
    // macOS 는 메뉴가 없으면 Cmd+Q 같은 기본 단축키도 사라지므로 최소 메뉴를 둔다
    if (process.platform === 'darwin') {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
    } else {
      Menu.setApplicationMenu(null);
    }

    protocol.handle(SCHEME, serveApp);

    // 권한: 포인터 고정 · 전체 화면만 허용, 나머지(카메라·마이크·위치·알림 등)는 거절
    const allowed = new Set(['pointerLock', 'fullscreen', 'clipboard-sanitized-write']);
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(allowed.has(perm)));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => allowed.has(perm));

    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });

  app.on('window-all-closed', () => app.quit());
}
