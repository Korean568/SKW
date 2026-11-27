/*
 * node android/scripts/prepare-assets.js
 *
 * 스토리 게임을 소스에서 빌드해 Android 앱의 assets 에 넣는다 (PC판과 같은 빌드: desktop/scripts/build-story.js,
 * 스튜디오 오프닝 없음). 결과물 android/app/src/main/assets/ 는 저장소에 올리지 않는다 (CI 가 매번 만든다).
 *
 *   1) source/build.js --story → HTML 한 파일
 *   2) <head> 맨 앞(<meta charset> 바로 뒤)에 android-shim.js 를 끼워 넣음 → 게임 코드보다 먼저 window.skwDesktop 이 생김
 *      (자리 __SKW_VERSION__ · __SKW_SHELL__ = desktop/package.json 의 version (내부 번호), __SKW_LABEL__ = skwLabel (보이는 번호))
 *   3) viewport 에 viewport-fit=cover 가 없으면 추가 (노치 영역까지 그리고 env(safe-area-inset-*) 를 쓰기 위해)
 *   4) 자동 업데이트용 사본 두 개 (MainActivity · Updater.java 가 읽음)
 *        assets/android-shim.js  주석을 지운 다리 스크립트, 자리 셋을 그대로 둔 것 — 받은 게임(desktop/update/game.gz)을 서빙할 때
 *                                Updater.inject 가 받은 게임의 번호로 채워 2) · 3) 과 똑같이 끼워 넣는다 (아래 inject 와 같아야 함)
 *        assets/version.json     { version, label } — 앱에 든 게임 = 앱(껍데기)의 내부 번호. 받은 게임이 이보다 새것일 때만 쓰고 minShell 과 비교
 *
 * 빌드에 필요한 esbuild 는 desktop/node_modules 에서 찾는다:
 *   cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci      (Electron 실행 파일은 받지 않아도 된다)
 * 없으면 tools/node_modules 의 esbuild 를 쓴다 (source/build.js 의 대체 경로).
 *
 * require('./prepare-assets.js') 는 빌드하지 않고 { loadShim, inject } 만 내준다 (시험에서 Java 쪽과 결과를 비교하려고).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const AND = path.join(__dirname, '..');
const REPO = path.join(AND, '..');
const OUT = path.join(AND, 'app', 'src', 'main', 'assets');
const SLOTS = ['__SKW_VERSION__', '__SKW_LABEL__', '__SKW_SHELL__'];

// 다리 스크립트: 주석을 지우고 한 덩어리로 (자리는 그대로)
function loadShim(file = path.join(__dirname, 'android-shim.js')) {
  const shim = fs.readFileSync(file, 'utf8')
    .replace(/\/\*[^]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  for (const s of SLOTS) if (shim.split(s).length !== 2) throw new Error(`android-shim.js 에 ${s} 자리가 꼭 하나 있어야 합니다`);
  if (/<\/script/i.test(shim)) throw new Error('android-shim.js 안에 </script 가 있으면 안 됩니다');
  if (/[^\x00-\x7f]/.test(shim)) throw new Error('android-shim.js 의 코드는 ASCII 만 써야 합니다');
  return shim;
}

// 게임 HTML 에 다리 스크립트 끼워 넣기 — Updater.java 의 inject 가 똑같이 한다 (바꾸면 둘 다)
function inject(html, shim, { version, label, shell }) {
  const tag = '<script>' + shim.replace('__SKW_VERSION__', () => version).replace('__SKW_LABEL__', () => label).replace('__SKW_SHELL__', () => shell) + '</script>';
  if (SLOTS.some((s) => tag.includes(s)) || !tag.includes(`'${version}'`) || !tag.includes(`'${shell}'`)) throw new Error('다리 스크립트의 자리를 채우지 못했습니다');
  const charset = /<meta\s+charset=["']?utf-8["']?\s*\/?>/i;
  const head = /<head[^>]*>/i;
  if (!head.test(html)) throw new Error('게임 HTML 에 <head> 가 없습니다');
  const headEnd = html.search(/<\/head>/i);
  if (charset.test(html) && html.search(charset) < headEnd) html = html.replace(charset, (m) => m + tag);
  else html = html.replace(head, (m) => m + '<meta charset="utf-8">' + tag);
  // viewport-fit=cover
  const vp = /<meta\s+name=["']?viewport["']?\s+content=(["'])([^"']*)\1\s*\/?>/i;
  let vpNote = 'viewport 태그 없음 → 추가';
  if (vp.test(html)) {
    html = html.replace(vp, (m, q, c) => /viewport-fit\s*=/.test(c) ? m : `<meta name="viewport" content="${c},viewport-fit=cover">`);
    vpNote = html.match(vp)[2];
  } else {
    html = html.replace(tag, () => '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' + tag);
  }
  return { html, tag, vpNote };
}

module.exports = { loadShim, inject };

if (require.main === module) {
  const die = (msg) => { console.error('[prepare-assets] 오류: ' + msg); process.exit(1); };

  // esbuild 가 있는지 먼저 확인 (없으면 빌드 오류 대신 해결 방법을 알려 준다)
  //   build-story.js 는 NODE_PATH 를 desktop/node_modules 로 바꿔 빌드하므로, 밖에서 준 NODE_PATH 의 esbuild 는 쓰이지 않는다
  const hasEsbuild = [path.join(REPO, 'desktop', 'node_modules'), path.join(REPO, 'tools', 'node_modules')]
    .some((d) => fs.existsSync(path.join(d, 'esbuild', 'package.json')));
  if (!hasEsbuild) die('esbuild 가 없습니다. 먼저 실행하세요:\n    cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci');

  // 1) 스토리 게임 빌드 (오프닝 <script> 는 build-story 가 뺀다)
  let r;
  try { r = require(path.join(REPO, 'desktop', 'scripts', 'build-story.js'))(); } catch (e) { die(e.message); }
  const { version, label } = r;

  // 2) · 3) 다리 스크립트 + viewport
  let shim, out;
  try { shim = loadShim(); out = inject(r.html, shim, { version, label, shell: version }); } catch (e) { die(e.message); }
  const { html, tag, vpNote } = out;
  const at = html.indexOf(tag);
  if (at < 0 || /<script\b/i.test(html.slice(0, at))) die('다리 스크립트가 게임의 첫 <script> 보다 앞에 있지 않습니다');
  if (html.indexOf('<meta charset') < 0 || html.indexOf('<meta charset') > 512) die('<meta charset> 이 문서 맨 앞에 없습니다');

  // 4) 저장 (게임 · 다리 스크립트 사본 · 버전)
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  fs.writeFileSync(path.join(OUT, 'android-shim.js'), shim);
  fs.writeFileSync(path.join(OUT, 'version.json'), JSON.stringify({ version, label }) + '\n');
  console.log(`[prepare-assets] 스토리 게임 ${label} (내부 ${version}) → ${path.relative(REPO, path.join(OUT, 'index.html'))} ` +
    `(${(Buffer.byteLength(html) / 1024).toFixed(0)} KB · 오프닝 <script> ${r.openingRemoved}줄 뺌 · 다리 스크립트 ${tag.length} B · viewport: ${vpNote})` +
    ` + android-shim.js (${shim.length} B, 자동 업데이트용) + version.json`);
}
