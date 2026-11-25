/*
 * window.skwDesktop — 게임의 데스크톱 모드가 쓰는 다리 (CONTRACT: desktop ↔ package)
 *   quit()                 게임 끄기
 *   setFullscreen(bool)    전체 화면 켜기/끄기 → Promise<bool> (바뀐 뒤 상태)
 *   isFullscreen()         → Promise<bool>
 *   openExternal(url)      http/https 주소를 시스템 브라우저로
 *   version                앱(껍데기) 버전 (package.json 의 version)
 *   gameVersion            지금 띄운 게임 버전 (자동 업데이트로 받은 게임이면 그 버전)
 *   platform               'win32' | 'darwin' | 'linux'
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const arg = (process.argv || []).find((a) => a.startsWith('--skw-version='));
const version = arg ? arg.slice('--skw-version='.length) : '';
const garg = (process.argv || []).find((a) => a.startsWith('--skw-game='));
const gameVersion = garg ? garg.slice('--skw-game='.length) : version;

contextBridge.exposeInMainWorld('skwDesktop', {
  quit: () => ipcRenderer.invoke('skw:quit'),
  setFullscreen: (on) => ipcRenderer.invoke('skw:setFullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('skw:isFullscreen'),
  openExternal: (url) => ipcRenderer.invoke('skw:openExternal', String(url)),
  version,
  gameVersion,
  platform: process.platform,
});
