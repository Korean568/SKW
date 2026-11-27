/*
 * window.skwDesktop — 게임의 데스크톱 모드가 쓰는 다리 (CONTRACT: desktop ↔ package)
 *   quit()                 게임 끄기
 *   setFullscreen(bool)    전체 화면 켜기/끄기 → Promise<bool> (바뀐 뒤 상태)
 *   isFullscreen()         → Promise<bool>
 *   openExternal(url)      http/https 주소를 시스템 브라우저로
 *   version                앱(껍데기) 버전 (package.json 의 version)
 *   gameVersion            지금 띄운 게임 버전 (자동 업데이트로 받은 게임이면 그 버전) — 내부 semver
 *   label                  지금 띄운 게임의 사람에게 보이는 번호 (예: '0.13', 다 만들면 '1.00'). 모르면 ''
 *                          (게임 자체에도 G.LABEL 로 들어 있다 — 옛 앱(1.2.0)이 받은 새 게임도 스스로 표시할 수 있게)
 *   platform               'win32' | 'darwin' | 'linux'
 *   update                 게임 자동 업데이트 (1.6.0 부터 · Android 앱과 같은 약속 — 옛 앱 · 웹판에는 없음)
 *     status() → Promise<S> · check() → Promise<S> (지금 확인, 받기까지 끝나면) · apply() → Promise<bool> (S.state 'ready' 일 때 새 게임으로 다시 불러오기)
 *     onStatus(cb)  상태가 바뀔 때마다 cb(S)
 *     S = { state: 'idle'|'checking'|'downloading'|'ready'|'latest'|'error', current: {version, label}, latest: {version, label}|null,
 *           error: 짧은 이유|null, at: 마지막 확인이 끝난 시각(ms, 없으면 0), applied: 이번 실행에서 새로 받은 게임으로 바꿨나 }
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const argOf = (k) => { const a = (process.argv || []).find((x) => x.startsWith(k)); return a ? a.slice(k.length) : null; };
let info = null; // 지금 띄운 게임 (메인 프로세스에 물음 — "지금 적용" 으로 다시 불러온 뒤에도 맞게). 실패하면 창을 만들 때 받은 값
try { info = ipcRenderer.sendSync('skw:info'); } catch (e) { /* 옛 방식 */ }
const version = (info && info.version) || argOf('--skw-version=') || '';
const gameVersion = (info && info.gameVersion) || argOf('--skw-game=') || version;
const label = info ? info.label || '' : argOf('--skw-label=') || '';

const subs = [];
ipcRenderer.on('skw:update', (_e, s) => { for (const f of subs) try { f(s); } catch (e) { /* 게임 쪽 오류는 무시 */ } });

contextBridge.exposeInMainWorld('skwDesktop', {
  quit: () => ipcRenderer.invoke('skw:quit'),
  setFullscreen: (on) => ipcRenderer.invoke('skw:setFullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('skw:isFullscreen'),
  openExternal: (url) => ipcRenderer.invoke('skw:openExternal', String(url)),
  version,
  gameVersion,
  label,
  platform: process.platform,
  update: {
    status: () => ipcRenderer.invoke('skw:update:status'),
    check: () => ipcRenderer.invoke('skw:update:check'),
    apply: () => ipcRenderer.invoke('skw:update:apply'),
    onStatus: (cb) => { if (typeof cb === 'function') subs.push(cb); },
  },
});
