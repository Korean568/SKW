/*
 * npm run publish-update   — 이미 설치된 PC판이 다시 내려받지 않아도 새 게임을 받게 하는 자동 업데이트 파일 만들기
 *
 * 만드는 것 (저장소에 커밋하면 바로 배포됨):
 *   update/game.gz      스토리 게임 HTML (오프닝 없음) 을 gzip 한 것 — 브라우저에서 바로 열리지 않는 형식
 *   update/latest.json  { version, file, sha256, size, minShell, date }
 *
 * 앱(main.js)은 켜질 때 latest.json 을 보고 version 이 지금 것보다 새것이면 game.gz 를 받아
 * sha256 을 확인한 뒤 사용자 폴더에 저장하고 그 게임을 띄운다. 인터넷이 없으면 가진 것으로 시작한다.
 *   version  = package.json 의 version (게임 내용 버전)
 *   minShell = 이 게임을 띄울 수 있는 가장 낮은 앱(껍데기) 버전. main.js / preload.js 를 바꿔 옛 앱과 안 맞게 되면 올린다.
 *
 * 순서: 게임 소스 고침 → package.json version 올림 → npm run publish-update → 커밋·푸시 (→ 필요하면 itch.io 용 빌드도)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const buildStory = require('./build-story');

const DESK = path.join(__dirname, '..');
const OUT = path.join(DESK, 'update');
const MIN_SHELL = '1.2.0'; // 자동 업데이트를 처음 넣은 앱 버전

const pkg = JSON.parse(fs.readFileSync(path.join(DESK, 'package.json'), 'utf8'));
const { html } = buildStory();
const buf = Buffer.from(html, 'utf8');
const gz = zlib.gzipSync(buf, { level: 9 });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'game.gz'), gz);
const meta = {
  version: pkg.version,
  file: 'game.gz',
  sha256: crypto.createHash('sha256').update(buf).digest('hex'),
  size: buf.length,
  minShell: MIN_SHELL,
  date: new Date().toISOString(),
};
fs.writeFileSync(path.join(OUT, 'latest.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`[publish-update] update/game.gz (${(gz.length / 1024).toFixed(0)} KB) · latest.json version ${meta.version} · sha256 ${meta.sha256.slice(0, 12)}…`);
