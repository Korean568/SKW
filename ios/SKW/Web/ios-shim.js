/*
 * iPhone / iPad app bridge (ASCII only - this whole file is injected as it is).
 *
 * GameViewController.swift adds this file as a WKUserScript at document start, main frame only, so it runs
 * before the game code. It builds window.skwDesktop (the contract of desktop/preload.js and
 * android/scripts/android-shim.js) on top of the native message handler window.webkit.messageHandlers.skw
 * (WKScriptMessageHandlerWithReply: postMessage({op, arg}) returns a Promise with the native reply).
 *
 * Four slots in the code below (each written once as double underscore + SKW_<NAME> + double underscore) are filled
 * by the app before every page load (values are checked by the app, so they never need escaping):
 *   SKW_VERSION  internal semver of the game that is being served (e.g. 1.6.0)
 *   SKW_LABEL    shown number of that game (e.g. 0.16)
 *   SKW_SHELL    internal semver of the app itself (the shell, compared with minShell)
 *   SKW_UPDATE   '1' when content auto-update is on (Info.plist SKWAutoUpdate), else '0'
 *
 * Contract:
 *   quit()                  no-op: an iOS app must not quit itself (the game hides its quit item for 'ios')
 *   setFullscreen(bool)     -> Promise<true> (the app is always full screen)
 *   isFullscreen()          -> Promise<true>
 *   openExternal(url)       http/https only, opened in Safari by the app (UIApplication.open)
 *   version . gameVersion . label . platform 'ios'
 *   update                  same as Android / PC: status() . check() . apply() . onStatus(cb) . log()
 *     S = {state: idle|checking|downloading|ready|latest|error, current:{version,label}, latest:{version,label}|null,
 *          error, at, applied, seq, shell}. The app pushes every change with window.__skwUpd(S).
 *     check() resolves when that check (and its download) has finished: native replies with the check number,
 *     the promise waits for a pushed S with seq >= that number that is no longer checking/downloading.
 *     apply() only works in state 'ready'; the app then reloads into the new game.
 *   window.__skwIOS.pause() / resume()   called by the app on sceneWillResignActive / sceneDidBecomeActive
 *     (same job as window.__skwAndroid: pause menu + silence Web Audio, then resume the contexts it stopped)
 */
(function () {
  'use strict';
  var W = window.webkit, H = W && W.messageHandlers && W.messageHandlers.skw;
  if (!H || window.skwDesktop) return;

  var V = '__SKW_VERSION__', L = '__SKW_LABEL__', S = '__SKW_SHELL__', UPD = '__SKW_UPDATE__' === '1';
  var call = function (op, arg) {
    try { return Promise.resolve(H.postMessage({ op: op, arg: arg === undefined ? null : arg })); } catch (e) { return Promise.reject(e); }
  };
  var D = window.skwDesktop = {
    quit: function () { return Promise.resolve(); },
    setFullscreen: function () { return Promise.resolve(true); },
    isFullscreen: function () { return Promise.resolve(true); },
    openExternal: function (url) { return call('open', String(url)).then(function () { }, function () { }); },
    version: S,
    gameVersion: V,
    label: L,
    platform: 'ios'
  };

  if (UPD) {
    var subs = [], waits = [], last = null;
    var read = function (s) {
      if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
      return s && typeof s === 'object' && typeof s.state === 'string' ? s : null;
    };
    var fallback = function () {
      return last || { state: 'error', current: { version: V, label: L }, latest: null, error: 'bridge', at: 0, applied: false, seq: 0 };
    };
    var busy = function (s) { return s.state === 'checking' || s.state === 'downloading'; };
    var status = function () {
      return call('updStatus').then(function (s) { s = read(s); if (s) last = s; return s || fallback(); }, fallback);
    };
    window.__skwUpd = function (s) {
      s = read(s);
      if (!s) return;
      last = s;
      subs.slice().forEach(function (cb) { try { cb(s); } catch (e) { } });
      if (busy(s)) return;
      var w = waits; waits = [];
      w.forEach(function (x) { if ((s.seq || 0) >= x.id) x.res(s); else waits.push(x); });
    };
    D.update = {
      status: status,
      check: function () {
        return call('updCheck').then(function (id) {
          id = Number(id) || 0;
          return new Promise(function (res) {
            if (id <= 0) { status().then(res); return; }
            if (last && (last.seq || 0) >= id && !busy(last)) { res(last); return; }
            var x = { id: id, res: res };
            waits.push(x);
            setTimeout(function () { var i = waits.indexOf(x); if (i >= 0) { waits.splice(i, 1); status().then(res); } }, 300000);
          });
        }, fallback);
      },
      apply: function () { return call('updApply').then(function (ok) { return !!ok; }, function () { return false; }); },
      onStatus: function (cb) { if (typeof cb === 'function') subs.push(cb); },
      log: function () { return call('updLog').then(function (t) { return String(t || ''); }, function () { return ''; }); }
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
  window.__skwIOS = {
    pause: function () {
      try { var G = window.G; if (G && G.desktop && G.desktop.pause) G.desktop.pause(); } catch (e) { }
      ctxs.forEach(function (c) {
        if (c.state === 'running' && held.indexOf(c) < 0) held.push(c);
        try { if (c.state === 'running') c.suspend(); } catch (e) { }
      });
      return held.length;
    },
    resume: function () {
      var n = held.length;
      held.forEach(function (c) { try { if (c.state !== 'closed') c.resume(); } catch (e) { } });
      held = [];
      return n;
    },
    audio: function () { return ctxs.map(function (c) { return c.state; }); }
  };

  /* WebGPU check: tell the app (for its log) when this WebView cannot run the game. The game shows its own notice. */
  var report = function (s) { call('gpu', s).then(function () { }, function () { }); };
  try {
    if (!navigator.gpu) report('none');
    else navigator.gpu.requestAdapter().then(function (a) { report(a ? 'ok' : 'noadapter'); }, function () { report('noadapter'); });
  } catch (e) { report('noadapter'); }
})();
