/*
 * desktop/package.json 의 두 버전 번호 (PC판 · Android · 브라우저판 · 자동 업데이트 공용) — 규칙은 README-itch.md "버전 번호"
 *   version   내부 번호 (semver). 자동 업데이트 비교 · Android versionCode 에 쓴다. 릴리스마다 반드시 올라간다 (0.13 = 1.3.0)
 *   skwLabel  사람에게 보이는 번호 (0.xx, 게임을 다 만들면 1.00). 파일 이름 · itch.io 버전 · 게임 화면 표시
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PKG = path.join(__dirname, '..', 'package.json');

module.exports = function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  const version = String(pkg.version || ''), label = String(pkg.skwLabel || '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`desktop/package.json 의 version 은 1.3.0 꼴이어야 합니다: '${version}'`);
  if (!/^\d+\.\d\d$/.test(label)) throw new Error(`desktop/package.json 의 skwLabel 은 0.13 · 1.00 꼴이어야 합니다: '${label}'`);
  return { version, label };
};

if (require.main === module) { const v = module.exports(); console.log(v.label + ' ' + v.version); } // node scripts/version.js → "0.13 1.3.0"
