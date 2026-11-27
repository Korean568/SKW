/*
 * Second Korean Wars — PC 다운로드판 (Electron 메인 프로세스)
 *
 * 하는 일
 *  - app/ 폴더(빌드된 스토리 게임 index.html, 오프닝 없음)를
 *    app://skw/ 라는 전용 주소로 띄운다. 인터넷이 없어도 앱에 든 게임으로 동작한다.
 *  - 자동 업데이트: 저장소의 desktop/update/latest.json (raw · github.io 둘 다) 을 보고 게임이 더 새것이면
 *    game.gz 를 받아(sha256 확인) 사용자 폴더(userData/game/)에 두고 그 게임을 띄운다 → exe 를 다시 받을 필요 없음.
 *    켜질 때(최대 4초 기다림, 늦으면 뒤에서 받고 "지금 적용") · 켜져 있는 동안 30분마다 · 게임 설정의 "업데이트 확인".
 *    앱(껍데기)이 옛것이라 새 게임과 안 맞으면(minShell) 받지 않는다. 받기 실패·오프라인이면 가진 것으로 그대로.
 *    기록: userData/update.log · 게임에는 window.skwDesktop.update (preload.js) 로 상태를 알려 준다.
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
//  1) 켜질 때: 전에 받아 둔 게임이 앱에 든 것보다 새것이고 minShell 이 맞으면 그것을 띄운다 (파일 sha256 도 확인)
//  2) latest.json 을 모든 주소(raw · github.io)에서 함께 보고 가장 높은 버전을 고른다 — 한 곳이 막히거나 옛것을 줘도 다른 곳으로
//  3) 새것이면 game.gz 를 받아 sha256 확인 → 임시 파일에 다 쓴 뒤 이름 바꾸기 (반쯤 받은 것이 좋은 게임을 덮지 않게) · 버전은 내려가지 않음
//  4) 시작 때는 최대 4초만 기다린다: 그 안에 끝나면 새 게임으로 바로 시작(applied), 아니면 지금 게임으로 창을 띄우고
//     뒤에서 계속 받아 'ready' → 게임 화면의 "지금 적용" (또는 다음 실행 때 자동)
//  5) 켜져 있는 동안 30분마다, 그리고 게임의 "업데이트 확인" 버튼으로 다시 확인 (한 번에 하나만)
//  6) userData/update.log 에 시간 · 주소 · 결과를 남긴다 (200줄까지) — 주인 PC 에서 왜 안 되는지 볼 수 있게
//  오프라인 · 막힌 네트워크여도 게임은 멈추지 않는다 (실패는 상태 'error' 로만 알림)
//  시험용: --update-base=<주소>[,<주소>…] (여러 번 가능) · --no-update · --update-every=<초> · --user-data=<폴더>
const argv = process.argv;
const opt = (k) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
if (opt('user-data')) app.setPath('userData', path.resolve(opt('user-data'))); // 시험용: 버리는 사용자 폴더 (진짜 프로필을 건드리지 않게)
const UPDATE_ARGS = argv.filter((a) => a.startsWith('--update-base=')).flatMap((a) => a.slice(14).split(',')).filter(Boolean).map((b) => (b.endsWith('/') ? b : b + '/'));
const UPDATE_BASES = UPDATE_ARGS.length ? UPDATE_ARGS : [
  'https://raw.githubusercontent.com/Korean568/SKW/main/desktop/update/',
  'https://korean568.github.io/SKW/desktop/update/',
];
const UPDATE_OFF = argv.includes('--no-update');
const EVERY = Math.max(1, parseFloat(opt('update-every')) || 1800) * 1000; // 다시 확인 간격 (기본 30분)
const START_WAIT = 4000, T_JSON = 10000, T_GAME = 90000, RETRY = 1500, LOG_MAX = 200;
const SHELL = app.getVersion();
const vnum = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0);
const newer = (a, b) => { // a 가 b 보다 새 버전인가
  const x = vnum(a), y = vnum(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
const desc = (a, b) => (newer(a.version, b.version) ? -1 : newer(b.version, a.version) ? 1 : 0);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 사람에게 보이는 번호(0.xx): 앱에 든 게임은 package.json 의 skwLabel, 받은 게임은 latest.json 의 label. 이상한 글자는 버린다
const cleanLabel = (v) => (typeof v === 'string' && /^[0-9A-Za-z.+-]{1,24}$/.test(v) ? v : '');
let pkgLabel = '';
try { pkgLabel = cleanLabel(require('./package.json').skwLabel); } catch (e) { /* 없음 */ }
let game = { version: SHELL, label: pkgLabel, file: path.join(APP_DIR, 'index.html'), buf: null }; // 지금 띄우는 게임 (buf: 받은 게임은 메모리에서 — 디스크 파일이 바뀌어도 적용 전까지 그대로)
let ready = null, started = false, busy = null, T0 = Date.now(); // ready = 받아 두고 아직 안 띄운 새 게임 · started = 창을 띄웠나
const gameDir = () => path.join(app.getPath('userData'), 'game');
// 상태 (preload 의 skwDesktop.update 와 같은 모양): state 'idle'|'checking'|'downloading'|'ready'|'latest'|'error'
const S = { state: 'idle', latest: null, error: null, at: 0, applied: false };
const status = () => ({ state: S.state, current: { version: game.version, label: game.label }, latest: S.latest && { ...S.latest }, error: S.error, at: S.at, applied: S.applied });
const setS = (o) => { Object.assign(S, o); const s = status(); for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('skw:update', s); };

// update.log: 한 줄에 시간 · 내용. LOG_MAX 줄이 넘으면 뒤쪽만 남긴다
let logBuf = null;
const ulog = (msg) => {
  console.log('[update] ' + msg);
  try {
    const f = path.join(app.getPath('userData'), 'update.log'), line = new Date().toISOString() + ' ' + String(msg).replace(/\s+/g, ' ').slice(0, 300);
    if (!logBuf) { try { logBuf = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); } catch (e) { logBuf = []; fs.mkdirSync(path.dirname(f), { recursive: true }); } }
    logBuf.push(line);
    if (logBuf.length > LOG_MAX) { logBuf = logBuf.slice(-LOG_MAX); fs.writeFileSync(f, logBuf.join('\n') + '\n'); } else fs.appendFileSync(f, line + '\n');
  } catch (e) { /* 기록 실패는 무시 */ }
};
// 실패 이유를 짧게: 'timeout' · 'HTTP 404' · 'sha256' · 'offline' · 'ERR_CONNECTION_REFUSED' …
const reason = (e) => {
  const m = String((e && e.message) || e);
  return /ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NAME_RESOLUTION_FAILED|ERR_ADDRESS_UNREACHABLE|ERR_NETWORK_CHANGED|ERR_NETWORK_ACCESS_DENIED/.test(m) ? 'offline' : m.replace(/^net::/, '').slice(0, 60);
};
const fetchBuf = async (url, ms) => {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await net.fetch(url + '?t=' + Date.now(), { signal: c.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  } catch (e) { throw c.signal.aborted ? new Error('timeout') : e; } finally { clearTimeout(t); }
};
const get = async (url, ms) => { // 실패하면 잠깐 쉬고 한 번 더 (404 같은 4xx 는 다시 해도 같으므로 바로 실패)
  try { return await fetchBuf(url, ms); } catch (e) {
    if (/^HTTP 4/.test(e.message)) throw e;
    await sleep(RETRY);
    return fetchBuf(url, ms);
  }
};
const manifest = async (base) => {
  const t0 = Date.now(); let m;
  try { m = JSON.parse((await get(base + 'latest.json', T_JSON)).toString('utf8')); } catch (e) { throw e instanceof SyntaxError ? new Error('bad json') : e; }
  if (!m || !/^\d+\.\d+\.\d+$/.test(String(m.version)) || !/^[0-9a-f]{64}$/.test(String(m.sha256))) throw new Error('bad latest.json');
  ulog(`${base}latest.json → ${m.version}${m.label ? ' (' + cleanLabel(m.label) + ')' : ''} minShell ${m.minShell || '-'} · ${Date.now() - t0}ms`);
  return m;
};
const have = () => (ready && newer(ready.version, game.version) ? ready.version : game.version); // 가진 것 중 가장 새 버전
const usable = (m) => newer(m.version, have()) && !newer(m.minShell, SHELL);
const markUsed = () => { // 받아 둔 게임을 한 번 띄웠다고 표시 (다음 실행 때 "업데이트했습니다" 를 또 알리지 않게)
  try {
    const f = path.join(gameDir(), 'version.json'), m = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (m.fresh && m.version === game.version) { delete m.fresh; fs.writeFileSync(f + '.tmp', JSON.stringify(m)); fs.renameSync(f + '.tmp', f); }
  } catch (e) { /* 없음 */ }
};
const useCached = () => { // 전에 받아 둔 게임이 앱에 든 것보다 새것이면 그걸 쓴다
  try {
    const dir = gameDir(), m = JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf8'));
    if (!newer(m.version, game.version)) return;
    if (newer(m.minShell, SHELL)) return ulog(`받아 둔 게임 ${m.version} 은 앱 ${m.minShell} 이상이 필요해 안 씀`);
    const f = path.join(dir, 'index.html'), buf = fs.readFileSync(f);
    if (m.sha256 && sha(buf) !== m.sha256) return ulog(`받아 둔 게임 ${m.version} 파일이 맞지 않아 안 씀 (sha256)`);
    game = { version: m.version, label: cleanLabel(m.label), file: f, buf };
    if (m.fresh) { S.applied = true; markUsed(); } // 지난번에 받아 두고 아직 한 번도 안 띄운 게임
    ulog(`받아 둔 게임 ${m.version}${game.label ? ' (' + game.label + ')' : ''} 으로 시작`);
  } catch (e) { /* 받아 둔 게임 없음 */ }
};
const download = async ({ base, m }) => {
  const label = cleanLabel(m.label), file = /^[\w.-]{1,64}$/.test(String(m.file || '')) ? m.file : 'game.gz', t0 = Date.now();
  setS({ state: 'downloading', latest: { version: m.version, label } });
  const raw = await get(base + file, T_GAME);
  let html; try { html = zlib.gunzipSync(raw); } catch (e) { html = raw; } // 서버가 이미 풀어서 준 경우도 받아들임 (아래 sha256 으로 검증)
  if (sha(html) !== m.sha256) throw new Error('sha256');
  if (!newer(m.version, have())) return; // 받는 동안 같은 것 이상을 이미 가졌으면 버림 (버전은 내려가지 않음)
  const dir = gameDir(), f = path.join(dir, 'index.html');
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(f + '.tmp', html);
    fs.writeFileSync(path.join(dir, 'version.json.tmp'), JSON.stringify({ version: m.version, label, minShell: m.minShell || '0', sha256: m.sha256, date: m.date || '', fresh: started }));
    fs.renameSync(f + '.tmp', f);
    fs.renameSync(path.join(dir, 'version.json.tmp'), path.join(dir, 'version.json'));
  } catch (e) { ulog('저장 실패 (이번 실행에서만 씀): ' + e.message); }
  ulog(`${base}${file} → 게임 ${m.version}${label ? ' (' + label + ')' : ''} 받음 · ${(raw.length / 1024).toFixed(0)} KB · ${Date.now() - t0}ms`);
  const g = { version: m.version, label, file: f, buf: html };
  if (!started) { game = g; S.applied = true; } else ready = g; // 창을 띄우기 전이면 바로 새 게임으로 시작
};
const run = async (src) => {
  const t0 = Date.now(), got = [], errs = [], tried = new Set();
  setS({ state: 'checking', error: null });
  ulog(`확인 (${src}) · 앱 ${SHELL} · 게임 ${game.version}${ready ? ' · 준비됨 ' + ready.version : ''}`);
  let hit, settled = false, dlErr = null;
  const found = new Promise((r) => { hit = r; });
  const all = Promise.all(UPDATE_BASES.map((base) => manifest(base).then(
    (m) => { got.push({ base, m }); if (usable(m)) hit(); },
    (e) => { errs.push(reason(e)); ulog(`${base}latest.json ✗ ${reason(e)}`); }))).then(() => { settled = true; });
  await Promise.race([all, found.then(() => sleep(1000))]); // 새 버전을 알려 준 곳이 있으면 다른 곳은 1초만 더 기다리고 받기 시작 (늦게 온 더 높은 버전도 아래에서 받음)
  for (;;) { // 가장 높은 쓸 수 있는 버전부터 — 받기에 실패하면 같은·다음 버전을 가진 다른 주소로
    const c = got.filter((g) => !tried.has(g) && usable(g.m)).sort((a, b) => desc(a.m, b.m))[0];
    if (!c) { if (settled) break; await all; continue; }
    tried.add(c);
    try { await download(c); dlErr = null; } catch (e) { dlErr = reason(e); ulog(`${c.base}${c.m.file || 'game.gz'} ✗ ${dlErr} (게임 ${c.m.version})`); }
  }
  const top = got.map((g) => g.m).sort(desc)[0] || null;
  const latest = ready ? { version: ready.version, label: ready.label } : top ? { version: top.version, label: cleanLabel(top.label) } : S.latest;
  const blocked = top && newer(top.version, have()) && newer(top.minShell, SHELL); // 새 게임이 있지만 이 앱이 너무 옛것 → 앱을 새로 받아야 함
  const [state, error] = ready ? ['ready', dlErr] : dlErr ? ['error', dlErr] : !got.length ? ['error', errs[0] || 'offline'] : blocked ? ['error', 'minShell ' + top.minShell] : ['latest', null];
  setS({ state, error, latest, at: Date.now() });
  ulog(`결과 ${state}${error ? ' (' + error + ')' : ''} · 최신 ${latest ? latest.version : '-'} · ${Date.now() - t0}ms`);
};
const check = (src) => { // 한 번에 하나만: 확인 중에 또 부르면 진행 중인 확인을 같이 기다린다
  if (UPDATE_OFF) return Promise.resolve(status());
  if (busy) ulog(`확인 (${src}) — 이미 확인 중이라 그것을 기다림`);
  else busy = run(src).catch((e) => { ulog('오류 ' + reason(e)); setS({ state: ready ? 'ready' : 'error', error: reason(e), at: Date.now() }); }).then(() => { busy = null; });
  return busy.then(status);
};
const apply = () => { // 받아 둔 새 게임으로 바꾼다 (창은 다시 불러오기 — serveApp 이 새 게임을 준다)
  if (!ready) return false;
  game = ready; ready = null; S.applied = true; markUsed();
  ulog(`적용: 게임 ${game.version}${game.label ? ' (' + game.label + ')' : ''} 으로 다시 띄움`);
  setS(busy ? {} : { state: 'latest', error: null, latest: { version: game.version, label: game.label } });
  return true;
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
      if (rel === '/index.html') { // 받아 둔 새 게임(메모리) 또는 앱에 든 게임 — apply() 뒤에는 새 game 을 준다
        if (game.buf) return new Response(game.buf, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
        return await net.fetch(pathToFileURL(game.file).toString());
      }
      const file = path.normalize(path.join(APP_DIR, rel));
      if (file !== APP_DIR && !file.startsWith(APP_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
      return await net.fetch(pathToFileURL(file).toString());
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  };

  const createWindow = () => {
    started = true; // 이 뒤에 받은 게임은 바로 바꾸지 않고 'ready' (지금 적용 · 다음 실행)
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

    win.once('ready-to-show', () => { win.show(); win.focus(); UPDATE_OFF || ulog(`창 보임 +${Date.now() - T0}ms · 게임 ${game.version}`); });

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
  // 지금 띄운 게임 정보 (preload 가 페이지마다 동기로 물음 — "지금 적용" 으로 다시 불러온 뒤에도 맞게)
  ipcMain.on('skw:info', (e) => { e.returnValue = { version: SHELL, gameVersion: game.version, label: game.label }; });
  // skwDesktop.update — status · check · apply, 상태가 바뀔 때마다 'skw:update' 로 알림 (setS)
  ipcMain.handle('skw:update:status', () => status());
  ipcMain.handle('skw:update:check', (e) => (fromApp(e) ? check('user') : status()));
  ipcMain.handle('skw:update:apply', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w || !fromApp(e) || !apply()) return false;
    setTimeout(() => { if (!w.isDestroyed()) w.loadURL(START_URL); }, 50); // 답을 먼저 보내고 다시 불러오기 → 새 게임의 처음 화면
    return true;
  });

  app.whenReady().then(async () => {
    // macOS 는 메뉴가 없으면 Cmd+Q 같은 기본 단축키도 사라지므로 최소 메뉴를 둔다
    if (process.platform === 'darwin') {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
    } else {
      Menu.setApplicationMenu(null);
    }

    protocol.handle(SCHEME, serveApp);

    // 게임 업데이트: 받아 둔 것 확인 → 인터넷으로 새 버전 확인. 창은 최대 START_WAIT(4초)만 기다렸다 띄우고, 늦으면 뒤에서 계속 받는다
    T0 = Date.now();
    useCached();
    if (!UPDATE_OFF) {
      ulog(`시작 · 앱 ${SHELL} · 게임 ${game.version}${game.buf ? ' (받아 둔 것)' : ''} · 주소 ${UPDATE_BASES.join(' ')}`);
      await Promise.race([check('start'), sleep(START_WAIT)]);
      ulog(`창 띄움 +${Date.now() - T0}ms · 게임 ${game.version}${S.applied ? ' (새로 받은 것)' : ''} · 상태 ${S.state}`);
      setInterval(() => check('timer'), EVERY);
    }

    // 권한: 포인터 고정 · 전체 화면만 허용, 나머지(카메라·마이크·위치·알림 등)는 거절
    const allowed = new Set(['pointerLock', 'fullscreen', 'clipboard-sanitized-write']);
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(allowed.has(perm)));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => allowed.has(perm));

    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });

  app.on('window-all-closed', () => app.quit());
}
