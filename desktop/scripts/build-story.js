/*
 * 스토리 게임 한 파일 빌드 (PC판 공용): source/build.js --story 로 빌드하고 오프닝 <script> 한 줄을 뺀 HTML 을 돌려준다.
 *   prepare-app.js  → 앱 안에 넣을 app/index.html
 *   publish-update.js → 자동 업데이트용 update/game.gz
 * 둘이 같은 함수를 써서 앱에 든 게임과 업데이트로 받는 게임이 바이트 단위로 같다.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const DESK = path.join(__dirname, '..');
const REPO = path.join(DESK, '..');
const OPENING = /<script\b[^>]*\bsrc=["']?clkky-opening\.js["']?[^>]*>\s*<\/script>/gi;

module.exports = function buildStory() {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'skw-')), 'story.html');
  let log;
  try {
    log = execFileSync(process.execPath, [path.join(REPO, 'source', 'build.js'), tmp, '--story'], {
      stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, NODE_PATH: path.join(DESK, 'node_modules') },
    }).toString();
  } catch (e) { throw new Error('스토리 게임 빌드 실패 (source/build.js --story): ' + e.message); }
  if (!log.includes('스토리 게임 (PC판)')) throw new Error('빌드 결과가 스토리 게임이 아닙니다:\n' + log);
  let html = fs.readFileSync(tmp, 'utf8');
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  const n = (html.match(OPENING) || []).length;
  html = html.replace(OPENING, '');
  if (/clkky-opening\.js/.test(html)) throw new Error('clkky-opening.js 를 부르는 곳이 남아 있습니다');
  return { html, openingRemoved: n };
};
