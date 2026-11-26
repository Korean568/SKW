/*
 * node android/scripts/prepare-assets.js
 *
 * 스토리 게임을 소스에서 빌드해 Android 앱의 assets 에 넣는다 (PC판과 같은 빌드: desktop/scripts/build-story.js,
 * 스튜디오 오프닝 없음). 결과물 android/app/src/main/assets/ 는 저장소에 올리지 않는다 (CI 가 매번 만든다).
 *
 *   1) source/build.js --story → HTML 한 파일
 *   2) <head> 맨 앞(<meta charset> 바로 뒤)에 android-shim.js 를 끼워 넣음 → 게임 코드보다 먼저 window.skwDesktop 이 생김
 *   3) viewport 에 viewport-fit=cover 가 없으면 추가 (노치 영역까지 그리고 env(safe-area-inset-*) 를 쓰기 위해)
 *
 * 빌드에 필요한 esbuild 는 desktop/node_modules 에서 찾는다:
 *   cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci      (Electron 실행 파일은 받지 않아도 된다)
 * 없으면 tools/node_modules 의 esbuild 를 쓴다 (source/build.js 의 대체 경로).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const AND = path.join(__dirname, '..');
const REPO = path.join(AND, '..');
const OUT = path.join(AND, 'app', 'src', 'main', 'assets');

const die = (msg) => { console.error('[prepare-assets] 오류: ' + msg); process.exit(1); };

// esbuild 가 있는지 먼저 확인 (없으면 빌드 오류 대신 해결 방법을 알려 준다)
//   build-story.js 는 NODE_PATH 를 desktop/node_modules 로 바꿔 빌드하므로, 밖에서 준 NODE_PATH 의 esbuild 는 쓰이지 않는다
const hasEsbuild = [path.join(REPO, 'desktop', 'node_modules'), path.join(REPO, 'tools', 'node_modules')]
  .some((d) => fs.existsSync(path.join(d, 'esbuild', 'package.json')));
if (!hasEsbuild) die('esbuild 가 없습니다. 먼저 실행하세요:\n    cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci');

// 1) 스토리 게임 빌드 (오프닝 <script> 는 build-story 가 뺀다)
let r;
try { r = require(path.join(REPO, 'desktop', 'scripts', 'build-story.js'))(); } catch (e) { die(e.message); }
let html = r.html;

// 2) 다리 스크립트 끼워 넣기 (주석을 지우고 한 덩어리로)
const shim = fs.readFileSync(path.join(__dirname, 'android-shim.js'), 'utf8')
  .replace(/\/\*[^]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
if (/<\/script/i.test(shim)) die('android-shim.js 안에 </script 가 있으면 안 됩니다');
if (/[^\x00-\x7f]/.test(shim)) die('android-shim.js 의 코드는 ASCII 만 써야 합니다');
const tag = '<script>' + shim + '</script>';
const charset = /<meta\s+charset=["']?utf-8["']?\s*\/?>/i;
const head = /<head[^>]*>/i;
if (!head.test(html)) die('게임 HTML 에 <head> 가 없습니다');
const headEnd = html.search(/<\/head>/i);
const firstScript = html.search(/<script\b/i);
if (charset.test(html) && html.search(charset) < headEnd) html = html.replace(charset, (m) => m + tag);
else html = html.replace(head, (m) => m + '<meta charset="utf-8">' + tag);
const at = html.indexOf(tag);
if (at < 0 || (firstScript >= 0 && at > firstScript)) die('다리 스크립트가 게임의 첫 <script> 보다 앞에 있지 않습니다');
if (html.indexOf('<meta charset') < 0 || html.indexOf('<meta charset') > 512) die('<meta charset> 이 문서 맨 앞에 없습니다');

// 3) viewport-fit=cover
const vp = /<meta\s+name=["']?viewport["']?\s+content=(["'])([^"']*)\1\s*\/?>/i;
let vpNote = 'viewport 태그 없음 → 추가';
if (vp.test(html)) {
  html = html.replace(vp, (m, q, c) => /viewport-fit\s*=/.test(c) ? m : `<meta name="viewport" content="${c},viewport-fit=cover">`);
  vpNote = html.match(vp)[2];
} else {
  html = html.replace(tag, () => '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' + tag);
}

// 4) 저장
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
const version = require(path.join(REPO, 'desktop', 'package.json')).version;
console.log(`[prepare-assets] 스토리 게임 ${version} → ${path.relative(REPO, path.join(OUT, 'index.html'))} ` +
  `(${(Buffer.byteLength(html) / 1024).toFixed(0)} KB · 오프닝 <script> ${r.openingRemoved}줄 뺌 · 다리 스크립트 ${tag.length} B · viewport: ${vpNote})`);
