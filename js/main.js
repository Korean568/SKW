// ───────────────────────────────────────────────────────────────
//  main.js — 시작, 입력, 카메라, 게임 루프, 챕터 흐름
// ───────────────────────────────────────────────────────────────
import { THREE, G, initRenderer, applyQuality, loadAll, loadSettings, saveSettings, raycast, DEG, clamp } from './core.js';
import { GAME, CHARACTERS, MAPS, PROPS, CHAPTERS } from './story.js';
import * as FX from './fx.js';
import * as UI from './ui.js';
import { $ } from './ui.js';
import { Character, Player, updatePlayer, updateUnits, removeUnit, killUnit, createUnit, clearKnives } from './units.js';
import { initWorld, setMap, updateWorld, updateProps, clearProps, getGLTF } from './world.js';
import { runChapter, tickRunner, cancelRunner, skipWait } from './runner.js';
import * as VM from './viewmodel.js';
import * as GFX from './gfx.js';

const clock = new THREE.Clock();
const input = { keys: new Set(), fire: false, aim: false, dx: 0, dy: 0, wheel: 0 };
let locked = false;
let freeMouse = false;   // 포인터 잠금이 안 되는 환경(임베드 등)에서는 마우스 이동만으로 조준

// ════════════════ 시작 ════════════════
async function boot() {
  loadSettings();
  G.debug = new URLSearchParams(location.search).has('debug');
  if (G.debug) { window.G = G; window.GAME_INPUT = input; }
  initRenderer($('game'));
  initWorld();
  FX.initFX();
  VM.initViewmodel();
  GFX.initGfx();
  G.onQuality = GFX.applyGfx;
  bindUI();
  bindInput();
  document.title = GAME.title;
  $('menu-title').textContent = GAME.title;
  $('menu-sub').textContent = GAME.subtitle;
  requestAnimationFrame(frame);
  UI.show('scr-loading');
  UI.loading(0, '메인 화면 불러오는 중…');
  try {
    const mk = GAME.menuMap in MAPS ? GAME.menuMap : Object.keys(MAPS)[0];
    await loadAll([MAPS[mk].file], p => UI.loading(p));
    await setMap(mk);
  } catch (e) { showError(e); return; }
  goMenu();
  // ?ch=2 처럼 주소에 붙이면 그 챕터로 바로 시작 (테스트용)
  const chParam = +new URLSearchParams(location.search).get('ch');
  if (G.debug && chParam >= 1 && chParam <= CHAPTERS.length) setTimeout(() => startChapter(chParam - 1), 400);
  // 첫 챕터 에셋은 미리 받아두기
  loadAll(chapterAssets(CHAPTERS[0])).catch(() => {});
}

function showError(e) {
  console.error(e);
  UI.loading(0, '오류: ' + e.message + '  (README의 "실행 방법"을 확인하세요)');
}

// ════════════════ 메뉴 ════════════════
function goMenu() {
  cancelRunner();
  clearWorld();
  FX.stopBGM();
  FX.setRotorVolume(0);
  const mk = GAME.menuMap in MAPS ? GAME.menuMap : Object.keys(MAPS)[0];
  setMap(mk).then(() => {
    G.mode = 'menu';
    G.paused = false;
    UI.hud(false);
    UI.letterbox(false);
    UI.fade(false, 0.6);
    UI.show('scr-menu');
  });
  document.exitPointerLock && document.exitPointerLock();
}

let settingsBack = 'scr-menu';
function bindUI() {
  document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', e => {
    FX.initAudio(); FX.sfxUI();
    const act = b.dataset.act;
    if (act === 'start') startChapter(0);
    else if (act === 'controls') UI.show('scr-controls');
    else if (act === 'settings') { settingsBack = G.mode === 'menu' ? 'scr-menu' : 'scr-pause'; syncSettingsUI(); UI.show('scr-settings'); }
    else if (act === 'back') UI.show(G.mode === 'menu' ? 'scr-menu' : 'scr-pause');
    else if (act === 'settings-back') { saveSettings(); UI.show(settingsBack); }
    else if (act === 'resume') resume();
    else if (act === 'checkpoint') restartCheckpoint();
    else if (act === 'restart') startChapter(G.chapterIndex);
    else if (act === 'menu') goMenu();
    else if (act === 'next') {
      if (G.chapterIndex + 1 < CHAPTERS.length) startChapter(G.chapterIndex + 1);
      else showCredits();
    }
  }));
  $('set-sens').addEventListener('input', e => { G.settings.sens = +e.target.value; $('set-sens-v').textContent = (+e.target.value).toFixed(1); });
  $('set-vol').addEventListener('input', e => {
    G.settings.volume = +e.target.value; $('set-vol-v').textContent = Math.round(e.target.value * 100) + '%';
    FX.setVolume(G.settings.volume); FX.setBGMVolume();
  });
  $('set-quality').addEventListener('change', e => { G.settings.quality = e.target.value; applyQuality(); });
  $('set-invert').addEventListener('change', e => { G.settings.invertY = e.target.checked; });
}
function syncSettingsUI() {
  $('set-sens').value = G.settings.sens; $('set-sens-v').textContent = (+G.settings.sens).toFixed(1);
  $('set-vol').value = G.settings.volume; $('set-vol-v').textContent = Math.round(G.settings.volume * 100) + '%';
  $('set-quality').value = G.settings.quality;
  $('set-invert').checked = G.settings.invertY;
}
// ════════════════ 챕터 ════════════════
function chapterAssets(ch) {
  const chars = new Set([ch.player || GAME.player]);
  const props = new Set();
  const visit = s => {
    if (!s || typeof s !== 'object') return;
    if (Array.isArray(s)) { s.forEach(visit); return; }
    if (s.who && CHARACTERS[s.who]) chars.add(s.who);
    if (s.type === 'prop' && PROPS[s.model] && PROPS[s.model].file) props.add(s.model);
    if (s.type === 'map' && MAPS[s.id]) props.add('map:' + s.id);
    if (s.enemies) for (const e of s.enemies) chars.add(e.who || 'nk_soldier');
    for (const k of ['steps', 'lines', 'enemies', 'waves']) if (s[k]) visit(s[k]);
  };
  visit(ch.steps);
  return [MAPS[ch.map].file, ...[...chars].map(k => CHARACTERS[k].file),
    ...[...props].map(k => k.startsWith('map:') ? MAPS[k.slice(4)].file : PROPS[k].file)];
}

function clearWorld() {
  for (const u of [...G.units]) removeUnit(u);
  if (G.player) { G.player.char.dispose(); G.player = null; }
  clearProps();
  clearKnives();
  FX.resetFX();
  UI.objective(''); UI.waypoint(null); UI.bossBar(null); UI.clearRadio(); UI.hideTitleCard();
  UI.blur(0, 0);
  G.cine = null;
}

let loadingChapter = false;
async function startChapter(idx) {
  if (loadingChapter) return;
  loadingChapter = true;
  cancelRunner();
  FX.initAudio();
  const ch = CHAPTERS[idx];
  G.mode = 'loading'; G.paused = false;
  G.chapter = ch; G.chapterIndex = idx;
  UI.hud(false); UI.letterbox(false); UI.fade(false, 0);
  UI.show('scr-loading');
  UI.loading(0, `${ch.title || ''} ${ch.name || ''} 불러오는 중…`);
  try {
    await loadAll(chapterAssets(ch), p => UI.loading(p * 0.95));
    UI.loading(0.97, '맵 준비 중…');
    await new Promise(r => setTimeout(r, 30));
    clearWorld();
    await setMap(ch.map);
    const pk = ch.player || GAME.player;
    const gltf = await getGLTF(pk);
    G.player = new Player(new Character(pk, CHARACTERS[pk], gltf), { weapons: ch.weapons });
    if (ch.playerNoWeapon) G.player.char.setNoWeapon(true);
    VM.buildViewmodel(gltf);
    VM.setWeapon(G.player.weapon);
    const st = ch.start || { pos: [0, 0], rot: 0 };
    G.player.place(st.pos, st.rot || 0);
    G.time = 0;
    G.stats = { kills: 0, shots: 0, hits: 0, startTime: 0 };
    G.checkpoint = { index: 0, pos: st.pos, rot: st.rot || 0 };
    UI.ammo(G.player); UI.enemyCount(); UI.plate(G.player);
    $('pname').textContent = G.player.name;
    UI.loading(1);
  } catch (e) { loadingChapter = false; showError(e); return; }
  loadingChapter = false;
  UI.show(null);
  UI.hud(true);
  G.mode = 'play';
  FX.playBGM(ch.bgm);
  FX.setWind(0.12);
  lockPointer();
  runChapter(ch, 0, onChapterComplete);
}

function restartCheckpoint() {
  const cp = G.checkpoint;
  if (!cp || cp.index === 0) { startChapter(G.chapterIndex); return; }
  cancelRunner();
  for (const u of [...G.units]) if (u.kind === 'enemy') removeUnit(u);
  for (const e of cp.enemies || []) getGLTF(e.who).then(g => { createUnit('enemy', e.who, CHARACTERS[e.who], g, e); UI.enemyCount(); });
  const p = G.player;
  p.alive = true; p.hp = p.maxHp; p.mag = p.magSize; p.reloadT = 0; p.lastHurt = -99;
  p.resetPlate();
  p.throwCount = p.throwMax;
  p.char.pose = null;
  clearKnives();
  p.char.revive();
  p.hidden = false;
  UI.blur(0, 0);
  p.place(cp.pos, cp.rot);
  for (const u of G.units) { u.moveTarget = null; if (u.kind === 'ally' && u.follow) u.pos.set(cp.pos[0] + Math.random() * 2 - 1, p.pos.y, cp.pos[1] + Math.random() * 2 - 1); }
  UI.objective(''); UI.waypoint(null); UI.bossBar(null); UI.clearRadio(); UI.ammo(p); UI.enemyCount();
  UI.letterbox(false); UI.fade(false, 0.5);
  G.cine = null; G.paused = false;
  UI.show(null); UI.hud(true);
  G.mode = 'play';
  lockPointer();
  runChapter(G.chapter, cp.index, onChapterComplete);
}

G.onPlayerDeath = () => {
  G.mode = 'dead';
  UI.hud(false);
  setTimeout(() => {
    if (G.mode !== 'dead') return;
    document.exitPointerLock && document.exitPointerLock();
    UI.show('scr-dead');
  }, 2200);
};

function onChapterComplete() {
  G.mode = 'complete';
  UI.hud(false);
  document.exitPointerLock && document.exitPointerLock();
  const s = G.stats;
  const t = Math.floor(G.time);
  $('stat-time').textContent = `${Math.floor(t / 60)}분 ${t % 60}초`;
  $('stat-kills').textContent = s.kills;
  $('stat-acc').textContent = s.shots ? Math.round(s.hits / s.shots * 100) + '%' : '-';
  $('complete-title').textContent = `${G.chapter.title || ''} 끝`.trim();
  $('complete-sub').textContent = G.chapter.name || '';
  document.querySelector('#scr-complete .stats').style.display = s.shots ? '' : 'none';
  $('btn-next').textContent = G.chapterIndex + 1 < CHAPTERS.length ? '다음 챕터 ▶' : '엔딩 보기 ▶';
  UI.fade(false, 0.3);
  UI.show('scr-complete');
}

function showCredits() {
  cancelRunner();
  G.mode = 'menu';
  const box = $('credits-roll');
  box.innerHTML = GAME.credits.map(l => `<p>${UI.escapeHTML(l) || '&nbsp;'}</p>`).join('');
  box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
  UI.show('scr-credits');
}

// ════════════════ 일시정지 ════════════════
function pause() {
  if (G.paused || !['play', 'dialogue', 'cutscene'].includes(G.mode)) return;
  G.paused = true;
  input.keys.clear(); input.fire = input.aim = false;
  UI.show('scr-pause');
}
function resume() {
  G.paused = false;
  UI.show(null);
  lockPointer();
}

// ════════════════ 입력 ════════════════
function lockPointer() {
  const c = G.renderer.domElement;
  if (document.pointerLockElement === c || !c.requestPointerLock) return;
  try {
    const r = c.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch (e) {}
}

function bindInput() {
  addEventListener('keydown', e => {
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.repeat) { input.keys.add(e.code); return; }
    input.keys.add(e.code);
    FX.initAudio();
    if (G.mode === 'choice' && !G.paused && /^Digit[1-9]$/.test(e.code)) UI.pickChoice(+e.code.slice(5) - 1);
    if (G.mode === 'dialogue' && !G.paused) {
      if (e.code === 'Space' || e.code === 'Enter') UI.advance();
      if (e.code === 'Tab') UI.skipDialogue();
    }
    if (e.code === 'Escape' && !locked) {
      if (G.paused) resume(); else pause();
    }
    if (e.code === 'F2') { e.preventDefault(); G.debug = !G.debug; }
    if (G.debug && !G.paused && G.mode !== 'menu') {
      if (e.code === 'KeyN') skipWait();
    }
  });
  addEventListener('keyup', e => input.keys.delete(e.code));
  addEventListener('blur', () => { input.keys.clear(); input.fire = input.aim = false; });
  document.addEventListener('mousedown', e => {
    if (e.target.closest && (e.target.closest('#screens') || e.target.closest('#choice'))) return;
    FX.initAudio();
    if (G.paused) return;
    if (G.mode === 'dialogue' && e.button === 0) UI.advance();
    if (['play', 'dialogue', 'cutscene'].includes(G.mode) && !locked && !freeMouse) { lockPointer(); return; }
    if (e.button === 0) input.fire = true;
    if (e.button === 2) input.aim = true;
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 0) input.fire = false;
    if (e.button === 2) input.aim = false;
  });
  document.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', e => { if (G.mode === 'play') input.wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockerror', () => { freeMouse = true; });
  document.addEventListener('mousemove', e => {
    if (!locked && !(freeMouse && G.mode === 'play' && !G.paused)) return;
    input.dx += e.movementX || 0;
    input.dy += e.movementY || 0;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === G.renderer.domElement;
    if (!locked) { input.fire = input.aim = false; if (G.mode === 'play') pause(); }
  });
}

// ════════════════ 카메라 ════════════════
const cam = { fp: false, bobT: 0, bob: 0, dist: 3, fov: 70, pos: new THREE.Vector3(), look: new THREE.Vector3(), menuT: 0, deadT: 0 };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();

const _cd = new THREE.Vector3();
function collideCam(from, to, pad = 0.22) {
  _cd.subVectors(to, from);
  const len = _cd.length();
  if (len < 0.01) return to;
  _cd.divideScalar(len);
  const h = raycast(from, _cd, len + pad);
  if (h) to.copy(from).addScaledVector(_cd, Math.max(0.05, h.distance - pad));
  return to;
}

function updateCamera(dt) {
  const camera = G.camera;
  const p = G.player;
  let fov = 70;
  cam.fp = false;
  if (G.cine && G.cine.speaker && (G.mode === 'dialogue')) {
    const sp = G.cine.speaker;
    const y = sp.prone ? 0.5 : 1.55;
    _a.copy(sp.pos).setY(sp.pos.y + y);
    const fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw);
    _b.set(_a.x + fx * 2.1 - fz * 0.6, _a.y + 0.08, _a.z + fz * 2.1 + fx * 0.6);
    collideCam(_a, _b);
    const k = Math.min(1, dt * 4);
    cam.pos.lerp(_b, k); cam.look.lerp(_a, k);
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    fov = 45;
  } else if (G.cine && G.cine.from) {
    const c = G.cine;
    let k = clamp((G.time - c.t0) / c.dur, 0, 1);
    k = k * k * (3 - 2 * k);
    cam.pos.lerpVectors(c.from, c.to, k);
    if (c.look) cam.look.lerpVectors(c.look, c.lookTo || c.look, k);
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    fov = 55;
  } else if (G.cine && G.cine.follow) {
    const c = G.cine;
    _b.copy(c.offset); c.follow.localToWorld(_b);
    _a.copy(c.lookOffset); c.follow.localToWorld(_a);
    if (!c.started) { cam.pos.copy(_b); cam.look.copy(_a); c.started = true; }
    cam.pos.lerp(_b, Math.min(1, dt * 5)); cam.look.lerp(_a, Math.min(1, dt * 5));
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    fov = 55;
  } else if (p && G.mode === 'dead') {
    cam.deadT += dt;
    _a.copy(p.pos).setY(p.pos.y + 0.4);
    _b.set(p.pos.x + Math.sin(cam.deadT * 0.3) * 4, p.pos.y + 3.5 + cam.deadT * 0.3, p.pos.z + Math.cos(cam.deadT * 0.3) * 4);
    collideCam(_a, _b);
    cam.pos.lerp(_b, Math.min(1, dt * 2));
    camera.position.copy(cam.pos); camera.lookAt(_a);
  } else if (p) {
    // ── 1인칭 ──
    cam.deadT = 0;
    cam.fp = true;
    const yaw = p.camYaw, pitch = p.camPitch + (p.recoil || 0);
    _d.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    if (p.moving && G.mode === 'play') cam.bobT += dt * (p.sprinting ? 13 : 8.5);
    cam.bob += ((p.moving && G.mode === 'play' ? 1 : 0) - cam.bob) * Math.min(1, dt * 6);
    const bob = Math.abs(Math.sin(cam.bobT)) * 0.045 * cam.bob * (p.aiming ? 0.3 : 1);
    _a.set(p.pos.x + Math.sin(yaw) * 0.08, p.pos.y + 1.6 + bob, p.pos.z + Math.cos(yaw) * 0.08);
    camera.position.copy(_a);
    camera.lookAt(_b.copy(_a).add(_d));
    cam.pos.copy(_a); cam.look.copy(_b);
    fov = p.aiming ? 50 : (p.sprinting ? 80 : 74);
  }
  if (G.shake > 0) {
    const k = G.shake * 0.12;
    camera.position.x += (Math.random() - 0.5) * k;
    camera.position.y += (Math.random() - 0.5) * k;
    camera.position.z += (Math.random() - 0.5) * k;
  }
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 10);
  if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}

function updateMenuCamera(dt) {
  cam.menuT += dt;
  const t = cam.menuT * 0.06;
  const camera = G.camera;
  camera.position.set(-26 + (1 - Math.cos(t)) * 22, 3.2 + Math.sin(t * 1.7) * 0.6, -2 + Math.sin(t * 0.8) * 2);
  camera.lookAt(camera.position.x + 14, 2.2, Math.sin(t * 1.3) * 3);
  if (camera.fov !== 60) { camera.fov = cam.fov = 60; camera.updateProjectionMatrix(); }
}

// ════════════════ 루프 ════════════════
let fpsT = 0, fpsN = 0, fps = 0;
function frame() {
  requestAnimationFrame(frame);
  step(Math.min(clock.getDelta(), 0.05));
}
// 디버그: 창이 가려져도 로직만 진행 (window.__advance(초))
if (new URLSearchParams(location.search).has('debug')) {
  window.__advance = (sec, dt = 1 / 30) => { for (let t = 0; t < sec; t += dt) step(dt); return { step: G.stepIndex, mode: G.mode }; };
}
function step(dt) {
  if (G.mode === 'menu') {
    updateMenuCamera(dt);
    updateProps(dt);
  } else if (!G.paused && G.mode !== 'loading') {
    G.time += dt;
    if (G.player) updatePlayer(G.player, dt, input);
    updateUnits(dt);
    tickRunner();
    updateProps(dt);
    FX.updateFX(dt);
    FX.updateAmbience(dt, G.mapDef && G.mapDef.battle && G.mode === 'play');
    updateCamera(dt);
    UI.updateHUD(dt);
  }
  $('clickhint').classList.toggle('on', G.mode === 'play' && !G.paused && !locked && !freeMouse);
  $('hud').classList.toggle('cine', G.mode !== 'play' && G.mode !== 'dead');
  $('hud').classList.toggle('nofire', !!(G.chapter && G.chapter.noFire));
  if (G.mode === 'menu' && G.debug) $('debug').classList.add('hidden');
  updateWorld();
  const fpPlay = cam.fp && G.mode === 'play' && G.player && G.player.alive;
  if (G.player) G.player.char.root.visible = !G.player.hidden && !cam.fp;
  if (fpPlay && !G.paused) VM.update(dt, G.player, input);
  GFX.render(dt);
  if (fpPlay) VM.render(G.renderer);
  input.dx = input.dy = 0;
  input.wheel = 0;
  // 디버그 표시
  fpsN++; fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
  $('debug').classList.toggle('hidden', !G.debug || G.mode === 'menu');
  if (G.debug && G.mode !== 'menu') {
    const p = G.player;
    const r = v => (Math.round(v * 10) / 10).toFixed(1);
    const deg = a => Math.round((((a / DEG) + 180) % 360 + 360) % 360 - 180);
    UI.debugText(
      `FPS ${fps}  |  mode ${G.mode}  |  step ${G.stepIndex ?? '-'}\n` +
      (p ? `pos: [${r(p.pos.x)}, ${r(p.pos.z)}]   y ${r(p.pos.y)}\n몸 rot: ${deg(p.yaw)}   카메라 rot: ${deg(p.camYaw)}\n` : '') +
      `N 단계 건너뛰기 · F2 닫기`);
  }
}

boot();
