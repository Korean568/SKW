/*
 * npm run prepare-app
 *
 * 저장소 루트의 빌드된 게임을 desktop/app/ 으로 복사한다. PC판에는 스튜디오 오프닝을 넣지 않는다.
 *   ../index.html  → app/index.html  (복사본에서만 clkky-opening.js 를 불러오는 <script> 한 줄을 뺀다)
 *   build/icon.png → app/icon.png    (Linux 창 아이콘)
 *
 * 저장소의 index.html · clkky-opening.js 원본은 절대 고치지 않는다 (웹판은 오프닝을 그대로 쓴다).
 * 게임 소스를 고쳤다면 먼저 저장소 루트에서 cd source && node build.js 로 index.html 을 다시 만든다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DESK = path.join(__dirname, '..');
const REPO = path.join(DESK, '..');
const APP = path.join(DESK, 'app');

const die = (msg) => { console.error('[prepare-app] 오류: ' + msg); process.exit(1); };

// 1) app/ 비우고 다시 만들기
fs.rmSync(APP, { recursive: true, force: true });
fs.mkdirSync(APP, { recursive: true });

// 2) index.html (오프닝 빼기)
const indexSrc = path.join(REPO, 'index.html');
if (!fs.existsSync(indexSrc)) die('../index.html 이 없습니다 (cd source && node build.js 로 먼저 빌드하세요)');
let html = fs.readFileSync(indexSrc, 'utf8');
const OPENING = /<script\b[^>]*\bsrc=["']?clkky-opening\.js["']?[^>]*>\s*<\/script>/gi;
const n = (html.match(OPENING) || []).length;
html = html.replace(OPENING, '');
if (/clkky-opening\.js/.test(html)) die('index.html 에 clkky-opening.js 를 부르는 곳이 남아 있습니다');
fs.writeFileSync(path.join(APP, 'index.html'), html);
console.log(`[prepare-app] 오프닝 <script> ${n}줄을 뺐습니다 (PC판은 오프닝 없이 바로 시작)`);

// 3) 창 아이콘
const icon = path.join(DESK, 'build', 'icon.png');
if (fs.existsSync(icon)) fs.copyFileSync(icon, path.join(APP, 'icon.png'));

const size = (f) => (fs.statSync(path.join(APP, f)).size / 1024).toFixed(0) + ' KB';
console.log('[prepare-app] app/ 준비 완료:',
  ['index.html', 'icon.png'].filter((f) => fs.existsSync(path.join(APP, f))).map((f) => `${f} (${size(f)})`).join(', '));
