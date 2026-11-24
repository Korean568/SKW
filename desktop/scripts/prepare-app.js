/*
 * npm run prepare-app
 *
 * 저장소 루트의 빌드된 게임을 desktop/app/ 으로 복사하고, 인터넷 없이 돌게 만든다.
 *   ../index.html        → app/index.html          (그대로)
 *   ../clkky-opening.js  → app/clkky-opening.js    (복사본에서만 three.js 주소를 vendor/ 로 바꿈)
 *   three@0.128.0 (npm devDependency 로 npm 레지스트리에서 받음) build/three.min.js
 *                        → app/vendor/three.min.js
 *   build/icon.png       → app/icon.png            (Linux 창 아이콘)
 *
 * 저장소의 clkky-opening.js 원본은 절대 고치지 않는다 (다른 팀이 만드는 파일).
 * 게임 소스를 고쳤다면 먼저 저장소 루트에서 cd source && node build.js 로 index.html 을 다시 만든다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DESK = path.join(__dirname, '..');
const REPO = path.join(DESK, '..');
const APP = path.join(DESK, 'app');
const CDN_THREE = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const LOCAL_THREE = 'vendor/three.min.js';

const die = (msg) => { console.error('[prepare-app] 오류: ' + msg); process.exit(1); };

// 1) app/ 비우고 다시 만들기
fs.rmSync(APP, { recursive: true, force: true });
fs.mkdirSync(path.join(APP, 'vendor'), { recursive: true });

// 2) index.html
const indexSrc = path.join(REPO, 'index.html');
if (!fs.existsSync(indexSrc)) die('../index.html 이 없습니다 (cd source && node build.js 로 먼저 빌드하세요)');
const html = fs.readFileSync(indexSrc, 'utf8');
if (!html.includes('clkky-opening.js')) console.warn('[prepare-app] 경고: index.html 이 clkky-opening.js 를 불러오지 않습니다');
fs.writeFileSync(path.join(APP, 'index.html'), html);

// 3) clkky-opening.js (복사본만 오프라인용으로 고침)
const openSrc = path.join(REPO, 'clkky-opening.js');
if (fs.existsSync(openSrc)) {
  let js = fs.readFileSync(openSrc, 'utf8');
  const n = js.split(CDN_THREE).length - 1;
  if (!n) die('clkky-opening.js 안에서 three.js CDN 주소를 찾지 못했습니다:\n  ' + CDN_THREE + '\n  (오프닝이 바뀌었으면 이 스크립트의 CDN_THREE 를 맞추세요)');
  js = js.split(CDN_THREE).join(LOCAL_THREE);
  // 남은 외부 스크립트 주소가 있으면 알려 준다 (오프라인에서 안 받아짐)
  const left = (js.match(/src=\\?"https?:\/\/[^"\\]+/g) || []);
  if (left.length) console.warn('[prepare-app] 경고: 오프닝에 아직 외부 스크립트가 있습니다:', left);
  fs.writeFileSync(path.join(APP, 'clkky-opening.js'), js);
  console.log(`[prepare-app] clkky-opening.js: three.js CDN 주소 ${n}곳 → ${LOCAL_THREE}`);
} else {
  console.warn('[prepare-app] 경고: ../clkky-opening.js 가 없어 오프닝 없이 묶습니다');
}

// 4) three.js r128 (npm 레지스트리의 three@0.128.0)
let threeDir;
try { threeDir = path.dirname(require.resolve('three/package.json', { paths: [DESK] })); } catch (e) {
  die('three@0.128.0 이 설치되지 않았습니다 (desktop 폴더에서 npm install)');
}
const threeVer = JSON.parse(fs.readFileSync(path.join(threeDir, 'package.json'), 'utf8')).version;
if (threeVer !== '0.128.0') die('three 버전이 0.128.0 이 아닙니다: ' + threeVer);
fs.copyFileSync(path.join(threeDir, 'build', 'three.min.js'), path.join(APP, 'vendor', 'three.min.js'));

// 5) 창 아이콘
const icon = path.join(DESK, 'build', 'icon.png');
if (fs.existsSync(icon)) fs.copyFileSync(icon, path.join(APP, 'icon.png'));

const size = (f) => (fs.statSync(path.join(APP, f)).size / 1024).toFixed(0) + ' KB';
console.log('[prepare-app] app/ 준비 완료:',
  ['index.html', 'clkky-opening.js', 'vendor/three.min.js', 'icon.png']
    .filter((f) => fs.existsSync(path.join(APP, f))).map((f) => `${f} (${size(f)})`).join(', '));
