// ───────────────────────────────────────────────────────────────
//  ui.js — HUD, 대화창, 자막(무전), 화면 전환, 메뉴
// ───────────────────────────────────────────────────────────────
import { THREE, G } from './core.js';
import { CHARACTERS, TEAMS } from './story.js';

const $ = id => document.getElementById(id);
export { $ };

// ── 화면(메뉴) 전환 ──────────────────────────────────────────
export function show(id) {
  document.querySelectorAll('#screens > section').forEach(s => s.classList.toggle('on', s.id === id));
  $('screens').classList.toggle('on', !!id);
}
export function hud(on) { $('hud').classList.toggle('hidden', !on); }

export function loading(p, label) {
  $('load-fill').style.width = (p * 100).toFixed(1) + '%';
  if (label != null) $('load-label').textContent = label;
}

// ── 화면 페이드 ──────────────────────────────────────────────
export function fade(toBlack, dur = 1) {
  const f = $('fader');
  f.style.transition = `opacity ${dur}s ease`;
  f.style.opacity = toBlack ? 1 : 0;
}
export function letterbox(on) { $('letterbox').classList.toggle('on', on); }
export function flash() {
  const f = $('flash');
  f.style.transition = 'none'; f.style.opacity = 1;
  void f.offsetWidth;
  f.style.transition = 'opacity 1.2s ease'; f.style.opacity = 0;
}
export function blur(px, dur) {
  const c = $('game');
  c.style.transition = `filter ${dur}s ease`;
  c.style.filter = px ? `blur(${px}px)` : '';
}

// ── HUD ──────────────────────────────────────────────────────
export function objective(text, sub = '') {
  $('objective').classList.toggle('hidden', !text);
  if (text && $('obj-text').textContent !== text) {
    $('objective').classList.remove('flash'); void $('objective').offsetWidth; $('objective').classList.add('flash');
  }
  $('obj-text').textContent = text || '';
  $('obj-sub').textContent = sub || '';
}
export function objectiveSub(sub) { $('obj-sub').textContent = sub || ''; }

export function enemyCount() {
  const n = G.units.filter(u => u.kind === 'enemy' && u.alive).length;
  $('enemy-count').textContent = n ? `남은 적: ${n}` : '';
}

const WEAPON_NAMES = { rifle: '소총', knife: '단검', throwknife: '투척단검' };
export function ammo(p) {
  const w = p.weapon || 'rifle';
  const el = $('ammo');
  el.classList.toggle('melee', w === 'knife');
  $('weapon-name').textContent = p.weapons && p.weapons.length > 1
    ? p.weapons.map((k, i) => `${i + 1} ${WEAPON_NAMES[k] || k}`).join('   ·   ') : '';
  $('weapon-name').dataset.cur = WEAPON_NAMES[w] || '';
  if (w === 'rifle') {
    $('ammo-mag').textContent = p.mag; $('ammo-res').textContent = '∞';
    $('ammo-mag').classList.toggle('low', p.mag <= 8);
  } else if (w === 'throwknife') {
    $('ammo-mag').textContent = p.throwCount; $('ammo-res').textContent = p.throwMax;
    $('ammo-mag').classList.toggle('low', p.throwCount <= 2);
  } else {
    $('ammo-mag').textContent = '단검'; $('ammo-res').textContent = '';
    $('ammo-mag').classList.remove('low');
  }
}

let hitT = 0;
export function hitmarker(head, killed) {
  const h = $('hitmarker');
  h.className = 'on' + (head ? ' head' : '') + (killed ? ' kill' : '');
  hitT = killed ? 0.35 : 0.15;
}

let hurtAmt = 0;
export function hurt(from, p) {
  hurtAmt = Math.min(1, hurtAmt + 0.35);
  if (!from) return;
  const ang = Math.atan2(from.x - p.pos.x, from.z - p.pos.z) - p.camYaw;
  const el = document.createElement('i');
  el.style.transform = `rotate(${-ang}rad)`;
  $('dmg-dir').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

export function killFeed(u) {
  const el = document.createElement('div');
  el.innerHTML = `<b>+1</b> ${escapeHTML(u.name)} 사살`;
  $('killfeed').prepend(el);
  setTimeout(() => el.classList.add('out'), 1800);
  setTimeout(() => el.remove(), 2400);
}

export function bossBar(u) {
  const b = $('bossbar');
  if (!u || !u.alive) { b.classList.add('hidden'); return; }
  b.classList.remove('hidden');
  $('boss-name').textContent = u.name;
  $('boss-fill').style.width = Math.max(0, u.hp / u.maxHp * 100) + '%';
}

let toastTimer = 0;
export function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

// 웨이포인트(목적지 표시)
let wp = null;
export function waypoint(pos) { wp = pos ? new THREE.Vector3(pos[0], (pos[2] ?? 0) + 1.2, pos[1]) : null; $('waypoint').classList.toggle('hidden', !wp); }

const _v = new THREE.Vector3();
export function updateHUD(dt) {
  const p = G.player;
  if (p) {
    $('hp-fill').style.width = (p.hp / p.maxHp * 100) + '%';
    $('hp-fill').classList.toggle('low', p.hp < 35);
    const spread = (p.aiming ? 6 : 16) + (p.moving ? 10 : 0) + p.heat * 14;
    $('crosshair').style.setProperty('--gap', spread + 'px');
    $('crosshair').classList.toggle('aim', p.aiming);
    $('crosshair').classList.toggle('hidden', p.sprinting || G.mode !== 'play');
    $('reload-hint').textContent = p.reloadT > 0 ? '재장전 중…' : 'R 재장전';
    $('reload-hint').classList.toggle('on', p.weapon === 'rifle' && (p.reloadT > 0 || p.mag <= 8));
  }
  hurtAmt = Math.max(0, hurtAmt - dt * 0.8);
  const low = p ? Math.max(0, 1 - p.hp / 45) : 0;
  $('dmg-vignette').style.opacity = Math.min(1, hurtAmt * 0.8 + low * 0.7);
  if (hitT > 0) { hitT -= dt; if (hitT <= 0) $('hitmarker').className = ''; }
  // 웨이포인트
  if (wp && p) {
    const el = $('waypoint');
    _v.copy(wp).project(G.camera);
    const behind = _v.z > 1;
    let x = _v.x, y = _v.y;
    if (behind) { x = -x; y = -1; }
    x = Math.max(-0.92, Math.min(0.92, x)); y = Math.max(-0.85, Math.min(0.85, y));
    el.style.transform = `translate(${(x + 1) / 2 * innerWidth}px, ${(1 - y) / 2 * innerHeight}px)`;
    const d = Math.hypot(wp.x - p.pos.x, wp.z - p.pos.z);
    $('wp-dist').textContent = Math.round(d) + 'm';
  }
  updateTyping(dt);
}

// ── 대화창 ───────────────────────────────────────────────────
let dlg = null;
export function speakerInfo(who, nameOverride) {
  const c = CHARACTERS[who];
  if (!c) return { name: nameOverride || who || '', team: null };
  return { name: nameOverride || c.name, team: c.team, rank: c.rank };
}

/** 대사 한 줄 표시. 넘기면 resolve */
export function say({ who, name, text, radio }) {
  const info = speakerInfo(who, name);
  const box = $('dialogue');
  box.classList.remove('hidden');
  box.classList.toggle('radio', !!radio);
  box.classList.toggle('narration', !info.name);
  $('dlg-name').textContent = info.name || '';
  const team = info.team && TEAMS[info.team];
  $('dlg-team').textContent = [info.rank, team && team.name].filter(Boolean).join(' · ');
  box.style.setProperty('--team', team ? team.color : '#9aa4ad');
  $('dlg-text').textContent = '';
  return new Promise(res => {
    dlg = { text: String(text ?? ''), shown: 0, res, done: false };
    if (skipping) finishLine();
  });
}
let skipping = false;
export function beginDialogue() { skipping = false; }
export function endDialogue() { $('dialogue').classList.add('hidden'); dlg = null; skipping = false; }
function finishLine() {
  if (!dlg) return;
  dlg.shown = dlg.text.length;
  $('dlg-text').textContent = dlg.text;
  dlg.done = true;
  if (skipping) { const r = dlg.res; dlg = null; r(); }
}
export function advance() {
  if (!dlg) return;
  if (!dlg.done) { finishLine(); return; }
  const r = dlg.res; dlg = null; r();
}
export function skipDialogue() { skipping = true; if (dlg) { finishLine(); } }
function updateTyping(dt) {
  if (!dlg || dlg.done) return;
  dlg.shown += dt * 38;
  const n = Math.min(dlg.text.length, Math.floor(dlg.shown));
  $('dlg-text').textContent = dlg.text.slice(0, n);
  if (n >= dlg.text.length) dlg.done = true;
}
export const dialogueOpen = () => !!dlg;

// ── 선택지 ───────────────────────────────────────────────────
let choiceRes = null;
/** 버튼을 보여주고 고른 번호(0부터)를 돌려줌 */
export function choice(labels, text) {
  const box = $('choice');
  $('choice-text').textContent = text || '';
  const list = $('choice-list');
  list.innerHTML = '';
  labels.forEach((l, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<kbd>${i + 1}</kbd> ${escapeHTML(l)}`;
    b.onclick = () => pickChoice(i);
    list.appendChild(b);
  });
  box.classList.remove('hidden');
  return new Promise(res => { choiceRes = res; });
}
export function pickChoice(i) {
  if (!choiceRes || i >= $('choice-list').children.length) return;
  const r = choiceRes; choiceRes = null;
  $('choice').classList.add('hidden');
  r(i);
}
export function hideChoice() { choiceRes = null; $('choice').classList.add('hidden'); }

// ── 무전 자막 (게임 진행 중, 자동으로 넘어감) ──────────────────
export async function radio(lines, isCancelled) {
  const box = $('radio');
  for (const l of lines) {
    if (isCancelled()) break;
    const info = speakerInfo(l.who, l.name);
    const team = info.team && TEAMS[info.team];
    box.innerHTML = `<span class="who" style="color:${team ? team.color : '#cfd6dc'}">${escapeHTML(info.name || '')}</span> ${escapeHTML(l.text)}`;
    box.classList.add('on');
    const dur = l.duration || Math.max(2.2, 1 + String(l.text).length * 0.075);
    await new Promise(r => setTimeout(r, dur * 1000));
  }
  box.classList.remove('on');
}
export function clearRadio() { $('radio').classList.remove('on'); }

// ── 챕터 타이틀 카드 ─────────────────────────────────────────
let tcTimer = 0;
export function titleCard(text, sub, dur = 4) {
  const t = $('titlecard');
  $('tc-text').textContent = text || '';
  $('tc-sub').textContent = sub || '';
  t.classList.remove('hidden'); void t.offsetWidth; t.classList.add('on');
  clearTimeout(tcTimer);
  tcTimer = setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.classList.add('hidden'), 900); }, dur * 1000);
}
export function hideTitleCard() { $('titlecard').classList.remove('on'); $('titlecard').classList.add('hidden'); }

export function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function debugText(t) { $('debug').textContent = t; }

// ── 방탄판 상태 표시 ─────────────────────────────────────────
export function plate(p) {
  const box = $('plate');
  const on = p.alive && (p.plateBroken || p.plateT > 0);
  box.classList.toggle('on', on);
  $('vitals').classList.toggle('broken', p.alive && p.plateBroken);
  if (!on) return;
  if (p.plateT > 0) {
    box.classList.add('busy');
    $('plate-text').textContent = '방탄판 교체 중…';
    $('plate-fill').style.width = ((1 - p.plateT / 2.2) * 100) + '%';
  } else {
    box.classList.remove('busy');
    const left = Math.max(0, 2 - p.brokenHits);
    $('plate-text').innerHTML = `방탄판 파손! <kbd>F</kbd> 방탄판 교체 <span class="warn">— 몸 ${left}발 / 머리 1발에 사망</span>`;
    $('plate-fill').style.width = '0%';
  }
}
