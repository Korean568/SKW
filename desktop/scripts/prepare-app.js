/*
 * npm run prepare-app
 *
 * 스토리 게임을 소스에서 바로 빌드해 desktop/app/ 에 넣는다. PC판에는 스튜디오 오프닝을 넣지 않는다.
 *   ../source/build.js --story → app/index.html  (오프닝 <script> 한 줄은 빼고 저장 · scripts/build-story.js)
 *   build/icon.png             → app/icon.png    (Linux 창 아이콘)
 *
 * 저장소 루트의 index.html 은 웹판(GitHub Pages)의 해상대전이라 PC판에 쓰지 않는다. 스토리 게임은 itch.io 에서만 배포.
 * 빌드에 필요한 esbuild 는 이 폴더의 devDependency (npm install 로 설치).
 * 앱이 켜질 때 받는 자동 업데이트(update/)는 scripts/publish-update.js 로 만든다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const buildStory = require('./build-story');

const DESK = path.join(__dirname, '..');
const APP = path.join(DESK, 'app');

const die = (msg) => { console.error('[prepare-app] 오류: ' + msg); process.exit(1); };

// 1) app/ 비우고 다시 만들기
fs.rmSync(APP, { recursive: true, force: true });
fs.mkdirSync(APP, { recursive: true });

// 2) 스토리 게임 빌드 → index.html (오프닝 빼기)
let r;
try { r = buildStory(); } catch (e) { die(e.message); }
fs.writeFileSync(path.join(APP, 'index.html'), r.html);
console.log(`[prepare-app] 스토리 게임 빌드 완료, 오프닝 <script> ${r.openingRemoved}줄을 뺐습니다 (PC판은 오프닝 없이 바로 시작)`);

// 3) 창 아이콘
const icon = path.join(DESK, 'build', 'icon.png');
if (fs.existsSync(icon)) fs.copyFileSync(icon, path.join(APP, 'icon.png'));

const size = (f) => (fs.statSync(path.join(APP, f)).size / 1024).toFixed(0) + ' KB';
console.log('[prepare-app] app/ 준비 완료:',
  ['index.html', 'icon.png'].filter((f) => fs.existsSync(path.join(APP, f))).map((f) => `${f} (${size(f)})`).join(', '));
