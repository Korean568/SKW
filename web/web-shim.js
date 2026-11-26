/*
 * 브라우저(itch.io HTML5) 판 전용 다리 — web/scripts/build-web.js 가 게임 index.html 의 <head> 맨 앞(게임 코드보다 먼저)에 끼워 넣는다.
 * 해상대전 웹판(GitHub Pages) · PC 앱 · Android 앱에는 들어가지 않는다 (그쪽은 preload.js / android-shim.js 가 window.skwDesktop 을 만든다).
 *
 * 게임의 mod_desktop(일시정지 메뉴 · 설정 · 진행 저장)이 쓰는 window.skwDesktop 을 브라우저 기능으로 만든다.
 *   platform 'web'
 *   quit()               브라우저에는 "게임 종료"가 없다 → 아무 일도 하지 않음 (mod_desktop 이 'web' 에서는 종료 항목을 숨김)
 *   setFullscreen(bool)  Fullscreen API (requestFullscreen / webkitRequestFullscreen) → Promise<bool>
 *   isFullscreen()       → Promise<bool>
 *   canFullscreen        이 화면에서 전체 화면이 되는지 (iPhone · 전체 화면을 허락하지 않은 iframe 에서는 false → 설정의 전체 화면 줄을 숨김)
 *   openExternal(url)    새 탭 (window.open(url, '_blank', 'noopener'))
 *   version · gameVersion   desktop/package.json 의 version — 내부 번호 semver (빌드할 때 __SKW_VERSION__ 자리에 들어감)
 *   label                   desktop/package.json 의 skwLabel — 사람에게 보이는 번호, 예 0.13 (__SKW_LABEL__ 자리)
 * 이 파일은 ASCII 만 쓴다 (주석 제외 — 주석은 넣을 때 지운다).
 */
(function () {
  'use strict';
  if (window.skwDesktop) return;
  var d = document, de = d.documentElement, n = navigator, ua = n.userAgent || '';
  var V = '__SKW_VERSION__', L = '__SKW_LABEL__';
  var req = de.requestFullscreen || de.webkitRequestFullscreen;
  var ext = d.exitFullscreen || d.webkitExitFullscreen;
  var iPhone = /iPhone|iPod/.test(ua);
  var canFs = !!(req && ext && (d.fullscreenEnabled || d.webkitFullscreenEnabled)) && !iPhone;
  var fsEl = function () { return d.fullscreenElement || d.webkitFullscreenElement || null; };
  var settle = function (p) { return p && p.then ? p.then(function () { }, function () { }) : Promise.resolve(); };
  window.skwDesktop = {
    quit: function () { return Promise.resolve(); },
    setFullscreen: function (on) {
      if (!canFs) return Promise.resolve(false);
      var p;
      try { p = on ? (fsEl() ? null : req.call(de)) : (fsEl() ? ext.call(d) : null); } catch (e) { p = null; }
      return settle(p).then(function () { return !!fsEl(); });
    },
    isFullscreen: function () { return Promise.resolve(!!fsEl()); },
    canFullscreen: canFs,
    openExternal: function (url) {
      try { window.open(String(url), '_blank', 'noopener'); } catch (e) { }
      return Promise.resolve();
    },
    version: V,
    gameVersion: V,
    label: L,
    platform: 'web'
  };
})();
