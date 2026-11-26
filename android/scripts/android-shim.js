/*
 * Android 앱 전용 다리 — prepare-assets.js 가 게임 index.html 의 <head> 맨 앞(게임 코드보다 먼저)에 끼워 넣는다.
 * 앱(MainActivity)이 WebView 에 넣어 둔 window.SkwNative 를 감싸 게임이 쓰는 window.skwDesktop 을 만든다.
 *   약속: quit() · setFullscreen(bool) → Promise<bool> · isFullscreen() → Promise<bool> (Android 는 항상 true)
 *         openExternal(url) · version · gameVersion (내부 번호 semver, 예 1.3.0) · label (보이는 번호, 예 0.13) · platform 'android'
 *         version · label 은 prepare-assets.js 가 __SKW_VERSION__ · __SKW_LABEL__ 자리에 desktop/package.json 의 값을 넣는다
 *         (앱의 versionName = label 이라 SkwNative.version() 은 label 을 돌려준다 — 자리를 못 채운 경우의 대체값)
 * 그리고 앱이 백그라운드로 갈 때 부르는 window.__skwAndroid.pause() / resume() (일시정지 메뉴 · 소리 멈춤).
 * 이 파일은 ASCII 만 쓴다 (주석 제외 — 주석은 넣을 때 지운다).
 */
(function () {
  'use strict';
  var N = window.SkwNative;
  if (!N || window.skwDesktop) return;

  var V = '__SKW_VERSION__', L = '__SKW_LABEL__', nv = '';
  try { nv = String(N.version() || ''); } catch (e) { }
  window.skwDesktop = {
    quit: function () { try { N.quit(); } catch (e) { } return Promise.resolve(); },
    setFullscreen: function () { return Promise.resolve(true); },
    isFullscreen: function () { return Promise.resolve(true); },
    openExternal: function (url) { try { N.openExternal(String(url)); } catch (e) { } return Promise.resolve(); },
    version: V,
    gameVersion: V,
    label: L || nv,
    platform: 'android'
  };

  /* Web Audio: remember every AudioContext the game creates so the app can silence it in the background */
  var ctxs = [], held = [];
  var AC = window.AudioContext;
  if (AC) {
    window.AudioContext = class AudioContext extends AC {
      constructor() { super(...arguments); ctxs.push(this); }
    };
  }
  window.__skwAndroid = {
    pause: function () {
      try { var G = window.G; if (G && G.desktop && G.desktop.pause) G.desktop.pause(); } catch (e) { }
      ctxs.forEach(function (c) {
        if (c.state === 'running' && held.indexOf(c) < 0) held.push(c);
        try { if (c.state === 'running') c.suspend(); } catch (e) { }
      });
    },
    resume: function () {
      held.forEach(function (c) { try { if (c.state !== 'closed') c.resume(); } catch (e) { } });
      held = [];
    }
  };

  /* WebGPU check: tell the app when this WebView cannot run the game, it then shows a native notice */
  var report = function (s) { try { N.gpuStatus(s); } catch (e) { } };
  try {
    if (!navigator.gpu) report('none');
    else navigator.gpu.requestAdapter().then(function (a) { if (!a) report('noadapter'); }, function () { report('noadapter'); });
  } catch (e) { report('noadapter'); }
})();
