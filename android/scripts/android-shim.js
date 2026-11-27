/*
 * Android 앱 전용 다리 — prepare-assets.js 가 게임 index.html 의 <head> 맨 앞(게임 코드보다 먼저)에 끼워 넣는다.
 * 앱(MainActivity)이 WebView 에 넣어 둔 window.SkwNative 를 감싸 게임이 쓰는 window.skwDesktop 을 만든다.
 *   약속: quit() · setFullscreen(bool) → Promise<bool> · isFullscreen() → Promise<bool> (Android 는 항상 true)
 *         openExternal(url) · version (앱 내부 번호) · gameVersion (게임 내부 번호 semver, 예 1.6.0) · label (보이는 번호, 예 0.16) · platform 'android'
 *         자리 셋: __SKW_VERSION__ (게임 내부 번호) · __SKW_LABEL__ (게임 보이는 번호) · __SKW_SHELL__ (앱 내부 번호)
 *           - 앱에 든 게임: prepare-assets.js 가 desktop/package.json 의 version · skwLabel 을 넣는다 (셋 다 같은 빌드)
 *           - 자동 업데이트로 받은 게임: MainActivity(Updater.inject)가 서빙할 때 받은 게임의 번호로 채워 똑같이 끼워 넣는다
 *             (그래서 prepare-assets.js 는 자리를 남긴 사본을 assets/android-shim.js 로도 둔다)
 *         (앱의 versionName = label 이라 SkwNative.version() 은 label 을 돌려준다 — 자리를 못 채운 경우의 대체값)
 *   자동 업데이트 skwDesktop.update (PC판 preload 와 같은 약속): status() · check() · apply() · onStatus(cb) — 아래 설명
 * 그리고 앱이 백그라운드로 갈 때 부르는 window.__skwAndroid.pause() / resume() (일시정지 메뉴 · 소리 멈춤).
 * 이 파일은 ASCII 만 쓴다 (주석 제외 — 주석은 넣을 때 지운다). 코드 안에 슬래시-별표 주석 기호와 </ script 를 쓰지 않는다.
 */
(function () {
  'use strict';
  var N = window.SkwNative;
  if (!N || window.skwDesktop) return;

  var V = '__SKW_VERSION__', L = '__SKW_LABEL__', S = '__SKW_SHELL__', nv = '';
  try { nv = String(N.version() || ''); } catch (e) { }
  window.skwDesktop = {
    quit: function () { try { N.quit(); } catch (e) { } return Promise.resolve(); },
    setFullscreen: function () { return Promise.resolve(true); },
    isFullscreen: function () { return Promise.resolve(true); },
    openExternal: function (url) { try { N.openExternal(String(url)); } catch (e) { } return Promise.resolve(); },
    version: S,
    gameVersion: V,
    label: L || nv,
    platform: 'android'
  };

  /* Content auto-update (same contract as the PC preload): window.skwDesktop.update
     status() -> Promise<S> . check() -> Promise<S> (resolves when that check, and its download, has finished)
     apply() -> Promise<bool> (only in state 'ready': the app switches to the new game and reloads the page)
     onStatus(cb) (cb(S) on every change) . log() -> Promise<string> (filesDir/update.log, for diagnosis)
     S = {state: idle|checking|downloading|ready|latest|error, current:{version,label}, latest:{version,label}|null,
          error, at, applied, seq}. The app pushes every change with window.__skwUpd(S) (seq = number of the check). */
  if (typeof N.updStatus === 'function') {
    var subs = [], waits = [];
    var read = function (s) {
      if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
      return s && typeof s === 'object' && typeof s.state === 'string' ? s : null;
    };
    var now = function () {
      var s = null;
      try { s = read(N.updStatus()); } catch (e) { }
      return s || { state: 'error', current: { version: V, label: L }, latest: null, error: 'bridge', at: 0, applied: false, seq: 0 };
    };
    var busy = function (s) { return s.state === 'checking' || s.state === 'downloading'; };
    window.__skwUpd = function (s) {
      s = read(s);
      if (!s) return;
      subs.slice().forEach(function (cb) { try { cb(s); } catch (e) { } });
      if (busy(s)) return;
      var w = waits; waits = [];
      w.forEach(function (x) { if ((s.seq || 0) >= x.id) x.res(s); else waits.push(x); });
    };
    window.skwDesktop.update = {
      status: function () { return Promise.resolve(now()); },
      check: function () {
        return new Promise(function (res) {
          var id = 0;
          try { id = Number(N.updCheck()) || 0; } catch (e) { }
          if (id <= 0) { res(now()); return; }
          var x = { id: id, res: res };
          waits.push(x);
          setTimeout(function () { var i = waits.indexOf(x); if (i >= 0) { waits.splice(i, 1); res(now()); } }, 300000);
        });
      },
      apply: function () {
        var ok = false;
        try { ok = !!N.updApply(); } catch (e) { }
        return Promise.resolve(ok);
      },
      onStatus: function (cb) { if (typeof cb === 'function') subs.push(cb); },
      log: function () {
        var t = '';
        try { t = String(N.updLog() || ''); } catch (e) { }
        return Promise.resolve(t);
      }
    };
  }

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
