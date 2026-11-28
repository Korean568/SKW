/*
 * node ios/scripts/check-selftest.js <결과 폴더> <localStorage 표시>
 *
 * smoke.sh 가 모은 앱 자동 시험 결과(main · relaunch · nogpu · file .json — SelfTest.swift 가 씀)를 판정한다.
 * 꼭 맞아야 하는 것이 하나라도 틀리면 종료 코드 1. WebGPU 가 Simulator(가상 머신)에서 되는지는 환경 문제라 판정하지 않고 알려만 주며,
 * 그 대신 WebGPU 결과와 화면이 서로 맞는지(어댑터가 있으면 처음 화면, 없으면 게임의 안내 화면)를 본다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const [dir = 'build/smoke', nonce = ''] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const quick = process.argv.includes('--quick'); // main 만 (다른 기기에서 켜지는지)
const read = (n) => { try { return JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8')); } catch (e) { return null; } };
const R = { main: read('main'), relaunch: read('relaunch'), nogpu: read('nogpu'), file: read('file') };
let bad = 0;
const say = (ok, what, detail) => {
  if (ok === null) console.log('INFO ' + what + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
  else { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + what + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
};

for (const [k, v] of Object.entries(R)) if (v) console.log(`SKW-SMOKE-JSON ${k} ${JSON.stringify(v)}`);

const m = R.main;
say(!!m && !m.probeError, 'main: 앱이 게임을 띄우고 자동 시험이 끝남', m && (m.probeError || `${m.seconds}s`));
if (m) {
  const n = m.native || {};
  say(m.origin === 'skw://game' && /^skw:\/\/game\/index\.html/.test(m.href), 'main: skw://game/index.html 로 서빙', m.href);
  say(m.isSecureContext === true, 'main: isSecureContext (WebGPU 에 필요)', m.isSecureContext);
  say(m.cryptoSubtle === true && m.decompressionStream === 'function', 'main: 보안 출처 전용 API (crypto.subtle · DecompressionStream)', [m.cryptoSubtle, m.decompressionStream]);
  say(null, 'main: WebGPU (Simulator 환경)', { gpu: m.gpuType, adapter: m.adapter, info: m.adapterInfo, err: m.adapterError, tier: m.tier, gpuName: m.gpuName });
  const gpuOK = m.adapter === true;
  if (gpuOK) say(m.screen === 'title' && m.ready && !m.dead, 'main: 어댑터 있음 → 처음 화면 (G.ready)', { screen: m.screen, ready: m.ready, dead: m.dead, frame: m.frame });
  else say(m.screen === 'unsupported' && /WebGPU|GPU/.test(m.fatal || ''), 'main: 어댑터 없음 → 게임의 안내 화면', { screen: m.screen, fatal: m.fatal });
  say(m.platform === 'ios', "main: skwDesktop.platform 'ios'", m.platform);
  say(m.shell === n.shellVersion && m.gameVersion === m.gVersion && m.label === m.gLabel && !!m.label, 'main: 다리의 번호 (앱 · 게임 · 보이는 번호)', { shell: m.shell, game: m.gameVersion, label: m.label, G: [m.gVersion, m.gLabel] });
  say(m.pauseHook === true, 'main: window.__skwIOS (일시정지 고리)', m.audio);
  const us = m.updateStatus || {}, uc = m.updateCheck || {};
  say(m.hasUpdate && typeof us.state === 'string' && us.current && us.current.version === m.gameVersion && 'seq' in us && 'at' in us && 'applied' in us,
    'main: skwDesktop.update.status() 모양 (S)', us);
  say(['latest', 'ready'].includes(uc.state) && uc.seq >= 1 && uc.at > 0, 'main: skwDesktop.update.check() 가 끝난 뒤 돌아옴 (실제 GitHub 주소)', uc);
  if (gpuOK) {
    const vr = m.versionRow || {};
    say(vr.shown && vr.version === m.label && vr.buttons && vr.buttons.some((b) => /업데이트 확인|Check for Updates/.test(b)), '설정: 버전 줄 (업데이트 확인)', vr);
    say(m.pauseQuitItem === false && Array.isArray(m.titleButtons) && !m.titleButtons.some((b) => /게임 종료|Quit|Exit/i.test(b)), "설정 · 처음 화면: '게임 종료' 없음", m.titleButtons);
    say(m.fullscreenRowShown === false, '설정: 전체 화면 줄 숨김', m.fullscreenRowShown);
    say(m.menuClosed === true && !m.settingsError, '설정: 열고 닫기', m.settingsError);
  } else {
    say(null, '설정 화면 시험은 건너뜀 (WebGPU 가 없어 게임이 안내 화면에서 멈춤 — 같은 시험을 PC 의 Playwright 로 함)');
  }
  const errs = (m.errors || []).filter((e) => gpuOK || !/SKW fatal/.test(e));
  say(errs.length === 0 && (!gpuOK || !(m.gErrors || []).length), 'main: JS 오류 없음', { errors: m.errors, G: m.gErrors });
  say(m.lsWritten === nonce && (m.lsKeys || []).includes('skw-selftest-nonce'), 'main: localStorage 에 씀', m.lsKeys);
  say(n.autoUpdate === true && n.served && n.served.version === m.gameVersion, '앱: 자동 업데이트 켜짐 · 띄운 게임', n.served);
  say(n.audioCategory === 'AVAudioSessionCategoryAmbient', '앱: 오디오 세션 .ambient', n.audioCategory);
  say(n.idleTimerDisabled === true, '앱: 앞에 있는 동안 화면 꺼짐 막음', n.idleTimerDisabled);
  say(n.statusBarHidden === true && n.homeIndicatorAutoHidden === true && n.landscape === true, '앱: 상태 막대 숨김 · 홈 표시줄 자동 숨김 · 가로', { screen: n.screen, safeArea: n.safeArea });
  say(n.bundleId === 'com.secondkoreanwars.game' && n.shortVersion === m.label && /^\d+$/.test(String(n.build)), '앱: 번들 ID · 버전', { id: n.bundleId, name: n.displayName, v: n.shortVersion, build: n.build, shell: n.shellVersion });
  say(null, '기기', { model: n.model, system: n.system, ua: m.ua, viewport: m.viewport, langs: n.preferredLanguages });
  // 뒤로 보냈을 때(sceneWillResignActive) 앱이 부른 window.__skwIOS.pause() 의 답 (콘솔: "[SKW] lifecycle pause: <멈춘 소리 수>")
  let con = '';
  try { con = fs.readFileSync(path.join(dir, 'console-main.log'), 'utf8'); } catch (e) { /* 없음 */ }
  const lp = /\[SKW\] lifecycle pause: (\S+)/.exec(con);
  if (/\[SKW\]/.test(con)) say(!!lp && /^\d+$/.test(lp[1]), '앱: 뒤로 갈 때 일시정지 고리를 부름 (sceneWillResignActive → __skwIOS.pause())', lp && lp[0]);
  else say(null, '콘솔 기록이 없어 일시정지 고리 확인을 건너뜀');
}

if (quick) {
  console.log(bad ? `=== iOS smoke (quick): ${bad} FAILED ===` : '=== iOS smoke (quick): ALL PASS ===');
  process.exit(bad ? 1 : 0);
}

const r = R.relaunch;
say(!!r && r.lsBefore === nonce && !!nonce, 'relaunch: 앱을 껐다 켜도 localStorage 가 남음', r && { before: r.lsBefore, want: nonce });

const g = R.nogpu;
say(!!g && g.gpuType === 'undefined' && g.screen === 'unsupported' && /WebGPU/.test(g.fatal || '') && g.isSecureContext === true,
  'nogpu: WebGPU 가 없는 기기 → 게임의 "WebGPU 를 사용할 수 없습니다" 안내', g && { screen: g.screen, fatal: g.fatal });
say(!!g && g.platform === 'ios' && g.hasUpdate === true, 'nogpu: 안내 화면에서도 다리는 그대로', g && g.platform);

const f = R.file;
say(null, 'file (비교용 file://)', f && { href: f.href, origin: f.origin, isSecureContext: f.isSecureContext, gpu: f.gpuType, adapter: f.adapter, screen: f.screen, err: f.probeError });

console.log(bad ? `=== iOS smoke: ${bad} FAILED ===` : '=== iOS smoke: ALL PASS ===');
process.exit(bad ? 1 : 0);
