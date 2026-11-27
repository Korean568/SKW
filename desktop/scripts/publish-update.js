/*
 * npm run publish-update   — 이미 설치된 PC판이 다시 내려받지 않아도 새 게임을 받게 하는 자동 업데이트 파일 만들기
 *
 * 만드는 것 (저장소에 커밋하면 바로 배포됨):
 *   update/game.gz      스토리 게임 HTML (오프닝 없음) 을 gzip 한 것 — 브라우저에서 바로 열리지 않는 형식
 *   update/latest.json  { version, label, file, sha256, size, minShell, date }
 *
 * 앱(main.js)은 켜질 때 · 켜져 있는 동안 30분마다 · 게임의 "업데이트 확인" 때 latest.json 을 (raw · github.io 둘 다) 보고
 * version 이 지금 것보다 새것이면 game.gz 를 받아 sha256 을 확인한 뒤 사용자 폴더에 저장하고 그 게임을 띄운다 (켜질 때 4초 안에 못 받으면 "지금 적용").
 * 인터넷이 없으면 가진 것으로 그대로 돈다. 옛 앱(1.2.0~1.5.0)은 켜질 때만 확인한다 — 새 게임이 직접 latest.json 을 보고 "앱을 껐다 켜 주세요" 를 알린다.
 *   version  = package.json 의 version (내부 번호, semver). 앱이 비교하는 것은 이것뿐 → 릴리스마다 반드시 올린다
 *   label    = package.json 의 skwLabel (사람에게 보이는 0.xx). 1.3.0 부터의 앱이 게임 화면 표시용으로 넘긴다 (옛 앱은 모르는 칸이라 무시)
 *   minShell = 이 게임을 띄울 수 있는 가장 낮은 앱(껍데기) 버전. main.js / preload.js 를 바꿔 옛 앱과 안 맞게 되면 올린다.
 *
 * 순서: 게임 소스 고침 → package.json 의 version · skwLabel 올림 (README-itch.md "버전 번호") → npm run publish-update → 커밋·푸시
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const buildStory = require('./build-story');
const readVersion = require('./version');

const DESK = path.join(__dirname, '..');
const OUT = path.join(DESK, 'update');
const MIN_SHELL = '1.2.0'; // 자동 업데이트를 처음 넣은 앱 버전

const { version, label } = readVersion();
let prev = null; try { prev = JSON.parse(fs.readFileSync(path.join(OUT, 'latest.json'), 'utf8')); } catch (e) { /* 처음 */ }
const { html } = buildStory();
const buf = Buffer.from(html, 'utf8');
const gz = zlib.gzipSync(buf, { level: 9 });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'game.gz'), gz);
const meta = {
  version,
  label,
  file: 'game.gz',
  sha256: crypto.createHash('sha256').update(buf).digest('hex'),
  size: buf.length,
  minShell: MIN_SHELL,
  date: new Date().toISOString(),
};
fs.writeFileSync(path.join(OUT, 'latest.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`[publish-update] update/game.gz (${(gz.length / 1024).toFixed(0)} KB) · latest.json version ${meta.version} (표시 ${meta.label}) · minShell ${meta.minShell} · sha256 ${meta.sha256.slice(0, 12)}…`);
// 내부 번호를 안 올리고 내용만 바꾸면, 그 번호를 이미 받은 앱은 이 게임을 받지 않는다 → 이미 푸시한 번호라면 version 을 올릴 것
const vn = (v) => String(v || '0').split('.').map((x) => parseInt(x, 10) || 0);
const cmp = (a, b) => { const x = vn(a), y = vn(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
if (prev && prev.version && cmp(version, prev.version) < 0) console.warn(`[publish-update] 경고: version ${version} 이 전 latest.json 의 ${prev.version} 보다 낮습니다 — 설치된 앱이 받지 않습니다`);
else if (prev && prev.version === version && prev.sha256 !== meta.sha256) console.warn(`[publish-update] 알림: 전 latest.json 과 같은 version ${version} 에 내용이 바뀌었습니다 — ${version} 을 이미 푸시했다면 version 을 올리세요 (README-itch.md "버전 번호")`);
