/*
 * node ios/scripts/prepare-resources.js
 *
 * iPhone · iPad 앱에 넣을 파일을 만든다 (Android 의 android/scripts/prepare-assets.js 와 같은 일). 결과물은 저장소에 넣지 않는다 (CI 가 매번 만듦).
 *
 *   1) 스토리 게임을 소스에서 빌드 (PC판 · Android 와 같은 desktop/scripts/build-story.js, 스튜디오 오프닝 없음)
 *        → ios/SKW/Game/index.html  (앱이 skw://game/index.html 로 서빙)
 *          ios/SKW/Game/version.json { version, label } — 앱에 든 게임 = 앱(껍데기)의 내부 번호. 받은 게임이 이보다 새것일 때만 쓰고 minShell 과 비교
 *      다리 스크립트(ios/SKW/Web/ios-shim.js)는 HTML 에 끼워 넣지 않는다: 앱이 WKUserScript(문서 시작)로 넣으므로
 *      앱에 든 게임이든 자동 업데이트로 받은 게임(desktop/update/game.gz 그대로)이든 같은 방법으로 들어간다.
 *   2) ios-shim.js 검사: ASCII 만 · 자리 4개(__SKW_VERSION__ · __SKW_LABEL__ · __SKW_SHELL__ · __SKW_UPDATE__)가 꼭 한 번씩
 *   3) 앱 아이콘 1024x1024 (알파 없음) ← desktop/build/icon.png (make-icon.js)
 *   4) ios/Config/Version.xcconfig — 버전 번호 (규칙: desktop/README-itch.md "버전 번호")
 *        MARKETING_VERSION        = skwLabel (보이는 번호, 예 0.16) → CFBundleShortVersionString
 *        CURRENT_PROJECT_VERSION  = 늘 커지는 정수: version 1.6.0 → 10600 (Android versionCode 와 같은 계산).
 *                                   환경 변수 SKW_BUILD_NUMBER 가 있으면 그 값 (같은 버전을 TestFlight 에 다시 올릴 때) → CFBundleVersion
 *        SKW_SHELL_VERSION        = version (내부 번호) → Info.plist SKWShellVersion
 *
 * 빌드에 필요한 esbuild 는 desktop/node_modules 에서 찾는다:  cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
 * require('./prepare-resources.js') 는 빌드하지 않고 { checkShim, buildNumber } 만 내준다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const IOS = path.join(__dirname, '..');
const REPO = path.join(IOS, '..');
const GAME = path.join(IOS, 'SKW', 'Game');
const SHIM = path.join(IOS, 'SKW', 'Web', 'ios-shim.js');
const XCCONFIG = path.join(IOS, 'Config', 'Version.xcconfig');
const SLOTS = ['__SKW_VERSION__', '__SKW_LABEL__', '__SKW_SHELL__', '__SKW_UPDATE__'];

function checkShim(file = SHIM) {
  const src = fs.readFileSync(file, 'utf8');
  if (/[^\x00-\x7f]/.test(src)) throw new Error('ios-shim.js 는 ASCII 만 써야 합니다 (주석 포함 — 파일 그대로 넣음)');
  for (const s of SLOTS) if (src.split(s).length !== 2) throw new Error(`ios-shim.js 에 ${s} 자리가 꼭 하나 있어야 합니다`);
  if (!/platform: 'ios'/.test(src)) throw new Error("ios-shim.js 에 platform: 'ios' 가 없습니다");
  try { new Function(src); } catch (e) { throw new Error('ios-shim.js 문법 오류: ' + e.message); }
  return src;
}

// 1.6.0 → 10600 (major*10000 + minor*100 + patch, Android versionCode 와 같음). override 가 있으면 그 정수
function buildNumber(version, override = process.env.SKW_BUILD_NUMBER) {
  if (override !== undefined && String(override).trim() !== '') {
    const n = String(override).trim();
    if (!/^[1-9]\d{0,8}$/.test(n)) throw new Error(`SKW_BUILD_NUMBER 는 양의 정수여야 합니다: '${n}'`);
    return n;
  }
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m || +m[2] > 99 || +m[3] > 99) throw new Error(`version 은 1.6.0 꼴(부 · 수 번호 99 이하)이어야 합니다: '${version}'`);
  return String(+m[1] * 10000 + +m[2] * 100 + +m[3]);
}

module.exports = { checkShim, buildNumber };

if (require.main === module) {
  const die = (msg) => { console.error('[prepare-resources] 오류: ' + msg); process.exit(1); };
  const hasEsbuild = [path.join(REPO, 'desktop', 'node_modules'), path.join(REPO, 'tools', 'node_modules')]
    .some((d) => fs.existsSync(path.join(d, 'esbuild', 'package.json')));
  if (!hasEsbuild) die('esbuild 가 없습니다. 먼저 실행하세요:\n    cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci');

  // 2) 다리 스크립트 (빌드보다 먼저 — 빨리 실패)
  let shim;
  try { shim = checkShim(); } catch (e) { die(e.message); }

  // 1) 스토리 게임 빌드 (오프닝 <script> 는 build-story 가 뺀다)
  let r;
  try { r = require(path.join(REPO, 'desktop', 'scripts', 'build-story.js'))(); } catch (e) { die(e.message); }
  const { html, version, label } = r;
  if (!/<head[^>]*>/i.test(html)) die('게임 HTML 에 <head> 가 없습니다');
  if (!/<meta\s+name=["']?viewport["']?[^>]*viewport-fit=cover/i.test(html)) die('게임의 viewport 에 viewport-fit=cover 가 없습니다 (source/template.html)');
  let build;
  try { build = buildNumber(version); } catch (e) { die(e.message); }

  fs.rmSync(GAME, { recursive: true, force: true });
  fs.mkdirSync(GAME, { recursive: true });
  fs.writeFileSync(path.join(GAME, 'index.html'), html);
  fs.writeFileSync(path.join(GAME, 'version.json'), JSON.stringify({ version, label }) + '\n');

  // 3) 아이콘
  const { makeIcon, OUT } = require('./make-icon.js');
  let png;
  try { png = makeIcon(); } catch (e) { die('아이콘: ' + e.message); }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, png);

  // 4) 버전
  fs.mkdirSync(path.dirname(XCCONFIG), { recursive: true });
  fs.writeFileSync(XCCONFIG, [
    '// prepare-resources.js 가 만든 파일 (저장소에 없음) — desktop/package.json 의 버전',
    `MARKETING_VERSION = ${label}`,
    `CURRENT_PROJECT_VERSION = ${build}`,
    `SKW_SHELL_VERSION = ${version}`,
    '',
  ].join('\n'));

  console.log(`[prepare-resources] 스토리 게임 ${label} (내부 ${version}) → ios/SKW/Game/index.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB · 오프닝 <script> ${r.openingRemoved}줄 뺌)` +
    ` + version.json · ios-shim.js ${shim.length} B 확인 · 아이콘 1024x1024 (${(png.length / 1024).toFixed(0)} KB)` +
    ` · Version.xcconfig: ${label} (${build}) 앱 ${version}`);
}
