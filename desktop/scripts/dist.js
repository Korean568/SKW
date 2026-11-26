/*
 * npm run dist:win | dist:mac | dist:linux   (= node scripts/dist.js --win | --mac | --linux [electron-builder 옵션 더])
 *
 * 1) prepare-app.js 로 스토리 게임을 app/ 에 새로 빌드
 * 2) electron-builder 로 묶기. 파일 이름에는 사람에게 보이는 번호(skwLabel, 예: SecondKoreanWars-0.13-win-x64.zip)를 쓴다
 *    → package.json 의 artifactName 이 ${env.SKW_LABEL} 을 읽으므로 여기서 넣어 준다 (OS 마다 다른 env 문법을 피하려고 node 로 실행)
 *    앱 안 버전(app.getVersion(), 자동 업데이트 비교)은 package.json 의 version (내부 번호) 그대로.
 */
'use strict';
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { version, label } = require('./version')();

const DESK = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'prepare-app.js')], { stdio: 'inherit', cwd: DESK });
console.log(`[dist] Second Korean Wars ${label} (내부 ${version}) 묶는 중…`);
const args = process.argv.slice(2);
if (!args.includes('--publish')) args.push('--publish', 'never');
const r = spawnSync(process.execPath, [require.resolve('electron-builder/cli.js'), ...args], {
  stdio: 'inherit', cwd: DESK, env: { ...process.env, SKW_LABEL: label },
});
process.exit(r.status == null ? 1 : r.status);
