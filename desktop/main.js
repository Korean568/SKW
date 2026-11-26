/*
 * Second Korean Wars — PC 다운로드판 (Electron 메인 프로세스)
 *
 * 하는 일
 *  - app/ 폴더(빌드된 스토리 게임 index.html, 오프닝 없음)를
 *    app://skw/ 라는 전용 주소로 띄운다. 인터넷이 없어도 앱에 든 게임으로 동작한다.
 *  - 자동 업데이트: 켜질 때 저장소의 desktop/update/latest.json 을 보고 게임이 더 새것이면
 *    game.gz 를 받아(sha256 확인) 사용자 폴더(userData/game/)에 두고 그 게임을 띄운다 → exe 를 다시 받을 필요 없음.
 *    앱(껍데기)이 옛것이라 새 게임과 안 맞으면(minShell) 받지 않는다. 받기 실패·오프라인이면 가진 것으로 시작.
 *    버전 번호 둘: version (내부 semver — 비교는 이것만) · label (사람에게 보이는 0.xx — 게임에 --skw-label 로 넘겨 표시용).
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
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const SCHEME = 'app';
const HOST = 'skw';
const ORIGIN = `${SCHEME}://${HOST}`;
const START_URL = `${ORIGIN}/index.html`;
const APP_DIR = path.join(__dirname, 'app');
const DEVTOOLS = process.argv.includes('--devtools');

// ── 게임 자동 업데이트 (게임 = index.html 한 파일, 앱 껍데기는 그대로) ──────────────────
const UPDATE_ARG = process.argv.find((a) => a.startsWith('--update-base=')); // 시험용: 다른 주소에서 업데이트 받기
const UPDATE_BASES = UPDATE_ARG ? [UPDATE_ARG.slice('--update-base='.length)] : [
  'https://raw.githubusercontent.com/Korean568/SKW/main/desktop/update/',
  'https://korean568.github.io/SKW/desktop/update/',
];
const vnum = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0);
const newer = (a, b) => { // a 가 b 보다 새 버전인가
  const x = vnum(a), y = vnum(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
// 사람에게 보이는 번호(0.xx): 앱에 든 게임은 package.json 의 skwLabel, 받은 게임은 latest.json 의 label. 이상한 글자는 버린다
const cleanLabel = (v) => (typeof v === 'string' && /^[0-9A-Za-z.+-]{1,24}$/.test(v) ? v : '');
let pkgLabel = '';
try { pkgLabel = cleanLabel(require('./package.json').skwLabel); } catch (e) { /* 없음 */ }
let game = { version: app.getVersion(), label: pkgLabel, file: path.join(APP_DIR, 'index.html') }; // 지금 띄울 게임
const gameDir = () => path.join(app.getPath('userData'), 'game');
const useCached = () => { // 전에 받아 둔 게임이 앱에 든 것보다 새것이면 그걸 쓴다
  try {
    const m = JSON.parse(fs.readFileSync(path.join(gameDir(), 'version.json'), 'utf8'));
    const f = path.join(gameDir(), 'index.html');
    if (newer(m.version, game.version) && !newer(m.minShell, app.getVersion()) && fs.existsSync(f)) game = { version: m.version, label: cleanLabel(m.label), file: f };
  } catch (e) { /* 받아 둔 게임 없음 */ }
};
const fetchBuf = async (url, ms) => {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await net.fetch(url + '?t=' + Date.now(), { signal: c.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  } finally { clearTimeout(t); }
};
const checkUpdate = async () => { // 새 게임이 있으면 받아서 game 을 바꾼다 (실패하면 조용히 넘어감)
  for (const base of UPDATE_BASES) {
    try {
      const m = JSON.parse((await fetchBuf(base + 'latest.json', 3000)).toString('utf8'));
      if (!m.version || !newer(m.version, game.version) || newer(m.minShell, app.getVersion())) return;
      const raw = await fetchBuf(base + (m.file || 'game.gz'), 15000);
      let html; try { html = zlib.gunzipSync(raw); } catch (e) { html = raw; } // 서버가 이미 풀어서 준 경우도 받아들임 (아래 sha256 으로 검증)
      if (crypto.createHash('sha256').update(html).digest('hex') !== m.sha256) throw new Error('sha256 불일치');
      const dir = gameDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html.tmp'), html);
      fs.renameSync(path.join(dir, 'index.html.tmp'), path.join(dir, 'index.html'));
      const label = cleanLabel(m.label);
      fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ version: m.version, label, minShell: m.minShell || '0' }));
      game = { version: m.version, label, file: path.join(dir, 'index.html') };
      console.log('[update] 게임 ' + m.version + (label ? ' (' + label + ')' : '') + ' 받음');
      return;
    } catch (e) { console.log('[update] ' + base + ' 실패: ' + e.message); }
  }
};

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
      if (rel === '/index.html') return await net.fetch(pathToFileURL(game.file).toString()); // 받아 둔 새 게임 또는 앱에 든 게임
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
        additionalArguments: [`--skw-version=${app.getVersion()}`, `--skw-game=${game.version}`, `--skw-label=${game.label}`],
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

  app.whenReady().then(async () => {
    // macOS 는 메뉴가 없으면 Cmd+Q 같은 기본 단축키도 사라지므로 최소 메뉴를 둔다
    if (process.platform === 'darwin') {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
    } else {
      Menu.setApplicationMenu(null);
    }

    protocol.handle(SCHEME, serveApp);

    // 게임 업데이트: 받아 둔 것 확인 → 인터넷으로 새 버전 확인 (오프라인이면 바로 넘어감, 오래 걸려도 몇 초)
    useCached();
    if (!process.argv.includes('--no-update')) await checkUpdate();

    // 권한: 포인터 고정 · 전체 화면만 허용, 나머지(카메라·마이크·위치·알림 등)는 거절
    const allowed = new Set(['pointerLock', 'fullscreen', 'clipboard-sanitized-write']);
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(allowed.has(perm)));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => allowed.has(perm));

    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });

  app.on('window-all-closed', () => app.quit());
}
