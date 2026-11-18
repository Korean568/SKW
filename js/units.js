// ───────────────────────────────────────────────────────────────
//  units.js — 캐릭터 모델/애니메이션, 플레이어, 적 AI, 아군 AI, 연출용 배우
// ───────────────────────────────────────────────────────────────
import {
  THREE, SkeletonUtils, G, raycast, lineOfSight, moveWithCollision, applyGravity,
  rand, clamp, angleLerp, angleDiff, yawTo, spawnGround, groundNear,
} from './core.js';
import * as FX from './fx.js';
import * as UI from './ui.js';
import * as VM from './viewmodel.js';

const ANIM_ALIAS = {
  Idle: ['Idle_Rifle', 'Stand'], Idle_Rifle: ['Idle'], Walk: ['Walk_Rifle'], Walk_Rifle: ['Walk'],
  Run: ['Run_Rifle', 'Walk'], Run_Rifle: ['Walk'], Aim: ['Idle'], Fire: ['Aim', 'Idle'], Reload: ['Idle'],
  Prone_Fire: ['Fire', 'Idle'], Stand: ['Idle', 'Idle_Rifle'], Command: ['Salute', 'Idle_Rifle'],
  Wave: ['Salute', 'Idle_Rifle'], Clap: ['Idle_Rifle'], Salute: ['Idle'],
};
const NO_WEAPON_ANIMS = new Set(['Salute', 'Stand']);

// ── 무기 총구 위치(바인드 포즈 기준) 계산: 캐시 ─────────────────
function computeMuzzle(gltf, model) {
  if (gltf.userData.muzzle !== undefined) return gltf.userData.muzzle;
  let best = null;
  const weapon = model.getObjectByName('Weapon');
  if (weapon) {
    weapon.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const pos = o.geometry.attributes.position, si = o.geometry.attributes.skinIndex;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        if (!best || z > best.z) best = { z, i, mesh: o, pos, si };
      }
    });
  }
  if (!best) { gltf.userData.muzzle = null; return null; }
  const { mesh, i, pos, si } = best;
  const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mesh.bindMatrix);
  const boneIdx = si ? si.getX(i) : 0;
  const bone = mesh.skeleton.bones[boneIdx];
  v.applyMatrix4(mesh.skeleton.boneInverses[boneIdx]);
  v.z += 0.04;
  gltf.userData.muzzle = { local: v, bone: bone.name };
  return gltf.userData.muzzle;
}

// ════════════════ Character: 모델 + 애니메이션 ════════════════
export class Character {
  constructor(key, def, gltf) {
    this.key = key;
    this.def = def;
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(gltf.scene);
    this.root.add(this.model);
    this.model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    this.weapon = this.model.getObjectByName('Weapon');
    this.hasRifle = !!this.weapon && gltf.animations.some(a => a.name === 'Fire');
    this.spine = this.model.getObjectByName('spine');
    this.chest = this.model.getObjectByName('chest');
    const mz = computeMuzzle(gltf, this.model);
    this.muzzleLocal = mz ? mz.local : null;
    this.muzzleBone = mz ? this.model.getObjectByName(mz.bone) : null;
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const c of gltf.animations) this.actions[c.name] = this.mixer.clipAction(c);
    this.cur = null; this.curName = '';
    this.fallT = -1;
    this.play(this.hasRifle ? 'Idle_Rifle' : 'Idle', { fade: 0 });
  }
  resolve(name) {
    if (this.actions[name]) return name;
    for (const a of ANIM_ALIAS[name] || []) if (this.actions[a]) return a;
    return Object.keys(this.actions)[0];
  }
  play(name, { fade = 0.2, once = false, speed = 1 } = {}) {
    name = this.resolve(name);
    const a = this.actions[name];
    if (!a) return;
    if (this.cur === a) { a.timeScale = speed; return; }
    if (this.cur) this.cur.fadeOut(fade);
    a.reset();
    a.timeScale = speed;
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.fadeIn(fade).play();
    this.cur = a; this.curName = name;
    if (this.weapon) this.weapon.visible = !NO_WEAPON_ANIMS.has(name);
  }
  update(dt) {
    if (this.fallT >= 0) {
      if (this.fallT < 1) {
        this.fallT = Math.min(1, this.fallT + dt * 2.2);
        const k = this.fallT * this.fallT;
        this.model.rotation.x = -Math.PI / 2 * k;
        this.model.position.y = 0.16 * k;
      }
      return;
    }
    this.mixer.update(dt);
  }
  muzzle(out) {
    if (!this.muzzleBone) return out.copy(this.root.position).y += 1.4;
    this.root.updateMatrixWorld(true);
    return out.copy(this.muzzleLocal).applyMatrix4(this.muzzleBone.matrixWorld);
  }
  fall() { this.fallT = 0; }
  revive() { this.fallT = -1; this.model.rotation.x = 0; this.model.position.y = 0; }
  dispose() { this.root.removeFromParent(); this.mixer.stopAllAction(); }
}

// ── 공통 유닛 헬퍼 ───────────────────────────────────────────
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Vector3();
export function chestOf(u, out = new THREE.Vector3()) { return out.copy(u.pos).setY(u.pos.y + (u.prone ? 0.35 : 1.3)); }
export function eyeOf(u, out = new THREE.Vector3()) { return out.copy(u.pos).setY(u.pos.y + (u.prone ? 0.45 : 1.6)); }

function placeUnit(u, pos2, rotDeg, y) {
  const [x, z] = pos2;
  u.pos.set(x, y != null ? groundNear(x, z, y) : spawnGround(x, z), z);
  u.yaw = (rotDeg || 0) * Math.PI / 180;
  u.char.root.rotation.y = u.yaw;
}

// ════════════════ 플레이어 ════════════════
export class Player {
  constructor(char, opts = {}) {
    this.char = char;
    this.kind = 'player';
    this.name = char.def.name;
    this.pos = char.root.position;
    this.yaw = 0; this.camYaw = 0; this.camPitch = 0;
    this.vy = 0; this.grounded = true;
    this.maxHp = opts.hp || 100; this.hp = this.maxHp;
    this.magSize = opts.mag || 30; this.mag = this.magSize;
    this.reloadT = 0; this.fireCD = 0;
    this.lastHurt = -99; this.lastFire = -99;
    this.aiming = false; this.moving = false; this.sprinting = false;
    this.heat = 0;
    this.plateBroken = false; this.brokenHits = 0; this.plateT = 0;
    this.alive = true;
    G.scene.add(char.root);
  }
  place(pos2, rotDeg, y) {
    placeUnit(this, pos2, rotDeg, y);
    this.camYaw = this.yaw; this.camPitch = -0.05; this.vy = 0;
  }
  /** head: 머리에 맞았는지. 방탄판이 깨진 상태면 몸 2발 / 머리 1발에 사망 */
  damage(dmg, from, head = false) {
    if (!this.alive || G.mode !== 'play') return;
    this.lastHurt = G.time;
    FX.sfxHurt();
    UI.hurt(from, this);
    if (this.plateBroken) {
      this.brokenHits++;
      if (head || this.brokenHits >= PLATE.hitsToKill) this.die();
      UI.plate(this);
      return;
    }
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.plateBroken = true;
      this.brokenHits = 0;
      FX.sfxPlateBreak();
      UI.plate(this);
    }
  }
  die() {
    this.hp = 0; this.alive = false;
    this.plateT = 0;
    this.char.fall();
    UI.plate(this);
    G.onPlayerDeath && G.onPlayerDeath();
  }
  resetPlate() { this.plateBroken = false; this.brokenHits = 0; this.plateT = 0; UI.plate(this); }
}

const SPEED = { walk: 3.4, run: 6.2, aim: 2.2 };
// 방탄판: HP가 0이 되면 깨짐 → F 로 교체(시간 걸림). 깨진 동안 몸 2발 / 머리 1발이면 사망
export const PLATE = { key: 'KeyF', time: 2.2, hitsToKill: 2, enemyHeadChance: 0.2 };
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _dir = new THREE.Vector3();

export function updatePlayer(p, dt, inp) {
  const ch = p.char;
  if (!p.alive) { ch.update(dt); return; }
  const canAct = G.mode === 'play';
  // 시점
  if (canAct) {
    p.camYaw -= inp.dx * 0.0022 * G.settings.sens * (p.aiming ? 0.55 : 1);
    p.camPitch -= inp.dy * 0.0022 * G.settings.sens * (p.aiming ? 0.55 : 1) * (G.settings.invertY ? -1 : 1);
    p.camPitch = clamp(p.camPitch, -1.15, 1.05);
  }
  // 이동 입력
  let mf = 0, mr = 0;
  if (canAct) {
    if (inp.keys.has('KeyW')) mf += 1;
    if (inp.keys.has('KeyS')) mf -= 1;
    if (inp.keys.has('KeyD')) mr += 1;
    if (inp.keys.has('KeyA')) mr -= 1;
  }
  // 방탄판 교체
  if (p.plateT > 0) {
    p.plateT -= dt;
    UI.plate(p);
    if (p.plateT <= 0) { p.plateT = 0; p.hp = p.maxHp; p.plateBroken = false; p.brokenHits = 0; FX.sfxPlateDone(); UI.plate(p); }
  } else if (canAct && p.plateBroken && inp.keys.has(PLATE.key)) {
    p.plateT = PLATE.time;
    p.reloadT = 0;
    FX.sfxPlateStart();
    UI.plate(p);
  }
  const plating = p.plateT > 0;
  p.aiming = canAct && inp.aim && p.reloadT <= 0 && !plating;
  const wantFire = canAct && inp.fire && !plating && !(G.chapter && G.chapter.noFire);
  p.moving = mf !== 0 || mr !== 0;
  p.sprinting = p.moving && canAct && inp.keys.has('ShiftLeft') && mf > 0 && !p.aiming && !wantFire;

  _fwd.set(Math.sin(p.camYaw), 0, Math.cos(p.camYaw));
  _right.set(-Math.cos(p.camYaw), 0, Math.sin(p.camYaw));
  _dir.set(0, 0, 0).addScaledVector(_fwd, mf).addScaledVector(_right, mr);
  if (_dir.lengthSq() > 0) _dir.normalize();
  if (plating) p.sprinting = false;
  const speed = p.sprinting ? SPEED.run : (p.aiming || p.reloadT > 0 || plating) ? SPEED.aim : SPEED.walk;
  moveWithCollision(p.pos, _dir.x * speed * dt, _dir.z * speed * dt, 0.35);
  applyGravity(p, dt);

  // 몸 방향 (1인칭: 항상 보는 방향)
  const combat = p.aiming || wantFire || G.time - p.lastFire < 0.6;
  if (canAct) p.yaw = p.camYaw;
  ch.root.rotation.y = p.yaw;

  // 재장전
  p.fireCD -= dt;
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) { p.mag = p.magSize; UI.ammo(p); }
  } else if (canAct && !plating && inp.keys.has('KeyR') && p.mag < p.magSize) startReload(p);

  // 사격
  p.heat = Math.max(0, p.heat - dt * 2.5);
  p.recoil = Math.max(0, (p.recoil || 0) - dt * 0.25 - (p.recoil || 0) * dt * 8);
  if (wantFire && p.reloadT <= 0 && p.fireCD <= 0) {
    if (p.mag <= 0) { FX.sfxEmpty(); p.fireCD = 0.25; startReload(p); }
    else playerShoot(p);
  }

  // 애니메이션
  if (plating) ch.play('Reload', { once: true, fade: 0.15, speed: 1.1 });
  else if (p.reloadT > 0) ch.play('Reload', { once: true, fade: 0.15 });
  else if (p.sprinting) ch.play('Run_Rifle');
  else if (p.moving) {
    const back = Math.cos(Math.atan2(_dir.x, _dir.z) - p.yaw) < -0.4;
    ch.play('Walk_Rifle', { speed: back ? -1 : (p.aiming ? 0.75 : 1) });
  } else if (combat) ch.play(G.time - p.lastFire < 0.25 ? 'Fire' : 'Aim', { fade: 0.12 });
  else ch.play('Idle_Rifle', { fade: 0.3 });
  ch.update(dt);
  // 상체를 조준 각도에 맞게 기울이기
  if (combat && ch.spine && ch.chest && p.reloadT <= 0) {
    ch.spine.rotateX(-p.camPitch * 0.45);
    ch.chest.rotateX(-p.camPitch * 0.45);
  }

  // 체력 회복
  if (!p.plateBroken && G.time - p.lastHurt > 4.5 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 22 * dt);
}

function startReload(p) {
  if (p.reloadT > 0 || p.mag >= p.magSize) return;
  p.reloadT = 2.2;
  FX.sfxReload();
}

const _cam = new THREE.Vector3(), _cdir = new THREE.Vector3(), _org = new THREE.Vector3(), _end = new THREE.Vector3();
function playerShoot(p) {
  const cam = G.camera;
  p.fireCD = 0.1;
  p.mag--;
  p.lastFire = G.time;
  G.stats.shots++;
  UI.ammo(p);
  const spread = (p.aiming ? 0.0015 : 0.009) + (p.moving ? 0.007 : 0) + p.heat * (p.aiming ? 0.004 : 0.01);
  p.heat = Math.min(1, p.heat + 0.12);
  cam.getWorldPosition(_cam);
  cam.getWorldDirection(_cdir);
  _cdir.x += rand(-spread, spread); _cdir.y += rand(-spread, spread); _cdir.z += rand(-spread, spread);
  _cdir.normalize();
  eyeOf(p, _a);
  const t0 = Math.max(0, _a.sub(_cam).dot(_cdir));
  _org.copy(_cam).addScaledVector(_cdir, t0);
  const mapHit = raycast(_org, _cdir, 300);
  let far = mapHit ? mapHit.distance : 300;
  const uh = hitUnits(_org, _cdir, far, u => u.kind === 'enemy');
  _end.copy(uh ? uh.point : mapHit ? mapHit.point : _org.clone().addScaledVector(_cdir, 300));
  let normal = mapHit ? mapHit.normal : null;
  // 총구 → 목표 사이 장애물 확인
  if (!VM.muzzleWorld(_m)) p.char.muzzle(_m);
  VM.kick();
  _b.subVectors(_end, _m);
  const len = _b.length();
  _b.divideScalar(len);
  const block = len > 0.3 ? raycast(_m, _b, len - 0.15) : null;
  let unitHit = uh;
  if (block) { _end.copy(block.point); normal = block.normal; unitHit = null; }

  FX.muzzleFlash(_m, true);
  FX.tracer(_m, _end);
  FX.sfxShot(0, true);
  if (unitHit) {
    G.stats.hits++;
    const dmg = unitHit.head ? 120 : rand(30, 38);
    FX.impact(_end, null, 'blood');
    const killed = damageUnit(unitHit.unit, dmg, p.pos, true);
    UI.hitmarker(unitHit.head, killed);
    FX.sfxHitmarker(unitHit.head);
  } else if (mapHit || block) FX.impact(_end, normal, 'dust');
  // 반동: 화면이 튀었다가 다시 돌아옴 (조금만 남음)
  p.recoil = Math.min(0.06, (p.recoil || 0) + (p.aiming ? 0.007 : 0.011));
  p.camPitch += p.aiming ? 0.0012 : 0.002;
  p.camYaw += rand(-0.0015, 0.0015);
}

// ── 히트박스(상자) 판정 ──────────────────────────────────────
const _ray = new THREE.Ray(), _box = new THREE.Box3(), _hp = new THREE.Vector3();
export function hitUnits(origin, dir, far, filter) {
  _ray.set(origin, dir);
  let best = null;
  for (const u of G.units) {
    if (!u.alive || !filter(u)) continue;
    const r = 0.3;
    if (u.prone) {
      _box.min.set(u.pos.x - 0.55, u.pos.y, u.pos.z - 0.55);
      _box.max.set(u.pos.x + 0.55, u.pos.y + 0.6, u.pos.z + 0.55);
    } else {
      _box.min.set(u.pos.x - r, u.pos.y, u.pos.z - r);
      _box.max.set(u.pos.x + r, u.pos.y + 1.78, u.pos.z + r);
    }
    if (!_ray.intersectBox(_box, _hp)) continue;
    const d = _hp.distanceTo(origin);
    if (d > far || (best && d > best.distance)) continue;
    const head = !u.prone && _hp.y > u.pos.y + 1.47;
    best = { unit: u, distance: d, point: _hp.clone(), head };
  }
  return best;
}

export function damageUnit(u, dmg, fromPos, byPlayer) {
  if (!u.alive || u.invulnerable) return false;
  u.hp -= dmg;
  if (u.kind === 'enemy' && !u.alert) alertNear(u);
  if (u.boss) UI.bossBar(u);
  if (u.hp <= 0) {
    killUnit(u);
    if (byPlayer) { G.stats.kills++; UI.killFeed(u); }
    return true;
  }
  return false;
}

export function killUnit(u) {
  u.alive = false; u.hp = 0;
  u.deadAt = G.time;
  u.char.fall();
  if (u.boss) UI.bossBar(u);
  UI.enemyCount();
}

// ════════════════ 적/아군/배우 생성 ════════════════
let uidSeq = 0;
export function createUnit(kind, key, def, gltf, spec = {}) {
  const ch = new Character(key, def, gltf);
  const u = {
    kind, key, char: ch, id: spec.id || (kind === 'enemy' ? `${key}#${++uidSeq}` : key),
    name: spec.name || def.name, team: def.team,
    pos: ch.root.position, yaw: 0, vy: 0, grounded: true,
    hp: spec.hp || 100, maxHp: spec.hp || 100, alive: true,
    alert: !!spec.alert, los: false, dist: 99, thinkT: rand(0, 0.3), focus: 0,
    sight: spec.sight || 45, range: spec.range || rand(10, 20),
    ammo: 30, reloadT: 0, shotT: rand(0.5, 1.5), burst: 0,
    strafeT: 0, strafeDir: 0, stuckT: 0, lastPos: new THREE.Vector3(), sideStepT: 0, sideDir: 1,
    prone: !!spec.prone, boss: !!spec.boss, group: spec.group || null,
    accuracy: spec.accuracy || 1,
    invulnerable: kind !== 'enemy' && spec.invulnerable !== false,
    follow: kind === 'ally' ? spec.follow !== false : false,
    slot: 0, moveTarget: null, moveRun: false, onArrive: null,
    anim: spec.anim || null,
    spec,
  };
  placeUnit(u, spec.pos || [0, 0], spec.rot, spec.y);
  if (u.prone) ch.play('Prone_Fire', { fade: 0 });
  else if (u.anim) ch.play(u.anim, { fade: 0 });
  if (spec.para) setupPara(u, spec.para === true ? {} : spec.para);
  if (u.boss) UI.bossBar(u);
  G.scene.add(ch.root);
  G.units.push(u);
  return u;
}

export function removeUnit(u) {
  u.char.dispose();
  const i = G.units.indexOf(u);
  if (i >= 0) G.units.splice(i, 1);
}

export function findUnit(id) { return G.units.find(u => u.id === id) || G.units.find(u => u.key === id && u.alive); }

function alertNear(e) {
  for (const o of G.units) {
    if (o.kind === 'enemy' && o.alive && !o.alert && o.pos.distanceTo(e.pos) < 18) o.alert = true;
  }
  e.alert = true;
}

// ════════════════ 업데이트 ════════════════
const MAX_SHOOTERS = 3;   // 동시에 플레이어를 쏠 수 있는 적 수
export function updateUnits(dt) {
  const active = G.mode === 'play';
  let corpses = 0;
  // 플레이어에게 가까운 적 몇 명만 사격 허가
  if (G.player) {
    const pp = G.player.pos;
    const cand = G.units.filter(u => u.kind === 'enemy' && u.alive && u.alert && u.los && !u.para);
    cand.sort((a, b) => a.pos.distanceToSquared(pp) - b.pos.distanceToSquared(pp));
    G.shooters = new Set(cand.slice(0, MAX_SHOOTERS));
  }
  for (let i = G.units.length - 1; i >= 0; i--) {
    const u = G.units[i];
    if (u.para) { updatePara(u, dt); u.char.update(dt); continue; }
    if (!u.alive) {
      u.char.update(dt);
      if (u.kind === 'enemy' && ++corpses > 14) { removeUnit(u); }
      continue;
    }
    if (u.kind === 'enemy') active ? updateEnemy(u, dt) : idleAnim(u);
    else if (u.kind === 'ally' && active && u.char.hasRifle) updateAlly(u, dt);
    else updateActor(u, dt);
    u.char.root.rotation.y = u.yaw;
    u.char.update(dt);
  }
}

function idleAnim(u) {
  if (u.moveTarget) return;
  if (u.prone) u.char.play('Prone_Fire');
  else if (u.anim) u.char.play(u.anim);
  else u.char.play(u.alert && u.char.hasRifle ? 'Aim' : 'Idle_Rifle');
}

function moveToward(u, tx, tz, speed, dt) {
  const dx = tx - u.pos.x, dz = tz - u.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return d;
  let mx = dx / d, mz = dz / d;
  // 막혔을 때 옆으로 비켜가기
  if (u.sideStepT > 0) {
    u.sideStepT -= dt;
    const sx = -mz * u.sideDir, sz = mx * u.sideDir;
    mx = mx * 0.3 + sx; mz = mz * 0.3 + sz;
    const l = Math.hypot(mx, mz); mx /= l; mz /= l;
  }
  const step = Math.min(d, speed * dt);
  u.lastPos.copy(u.pos);
  moveWithCollision(u.pos, mx * step, mz * step, 0.32);
  const moved = u.pos.distanceTo(u.lastPos);
  if (moved < step * 0.3) {
    u.stuckT += dt;
    if (u.stuckT > 0.35) { u.sideStepT = rand(0.6, 1.2); u.sideDir = Math.random() < 0.5 ? -1 : 1; u.stuckT = 0; }
  } else u.stuckT = Math.max(0, u.stuckT - dt);
  return d;
}

// 연출용 배우 / 따라오지 않는 아군
function updateActor(u, dt) {
  if (u.moveTarget) {
    const sp = u.moveRun ? 5 : 2.6;
    const d = moveToward(u, u.moveTarget[0], u.moveTarget[1], sp, dt);
    u.yaw = angleLerp(u.yaw, yawTo(u.pos, { x: u.moveTarget[0], z: u.moveTarget[1] }), dt * 8);
    u.char.play(u.moveRun ? 'Run_Rifle' : 'Walk_Rifle');
    applyGravity(u, dt);
    if (d < 0.25) {
      u.moveTarget = null;
      if (u.faceYaw != null) u.yaw = u.faceYaw;
      u.onArrive && u.onArrive(); u.onArrive = null;
    }
  } else if (u.kind === 'ally' && u.follow && G.mode === 'play') {
    followPlayer(u, dt);
  } else idleAnim(u);
}

const SLOTS = [[-1.7, -2.0], [1.7, -2.0], [0, -3.4], [-3.2, -0.8], [3.2, -0.8], [-1.5, -4.6], [1.5, -4.6]];
function followPlayer(u, dt, combat) {
  const p = G.player;
  const [ox, oz] = SLOTS[u.slot % SLOTS.length];
  const rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw), fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const tx = p.pos.x + rx * ox + fx * oz, tz = p.pos.z + rz * ox + fz * oz;
  const d = Math.hypot(tx - u.pos.x, tz - u.pos.z);
  if (d > 35) { u.pos.set(tx, spawnGround(tx, tz), tz); return false; }
  if (d > 1.0) {
    const run = d > 4.5 || p.sprinting;
    moveToward(u, tx, tz, run ? 6.4 : 3.4, dt);
    if (!combat) {
      u.yaw = angleLerp(u.yaw, yawTo(u.pos, { x: tx, z: tz }), dt * 8);
      u.char.play(run ? 'Run_Rifle' : 'Walk_Rifle');
    }
    applyGravity(u, dt);
    return true;
  }
  if (!combat) { u.yaw = angleLerp(u.yaw, p.yaw, dt * 3); u.char.play(u.anim || 'Idle_Rifle'); }
  applyGravity(u, dt);
  return false;
}

function nearestEnemy(u, maxD) {
  let best = null, bd = maxD;
  for (const o of G.units) {
    if (o.kind !== 'enemy' || !o.alive) continue;
    const d = o.pos.distanceTo(u.pos);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function updateAlly(u, dt) {
  u.thinkT -= dt;
  if (u.thinkT <= 0) {
    u.thinkT = rand(0.3, 0.5);
    u.target = nearestEnemy(u, 45);
    u.los = u.target ? lineOfSight(eyeOf(u, _a), chestOf(u.target, _b)) : false;
  }
  const t = u.target && u.target.alive && u.los ? u.target : null;
  if (u.moveTarget) { updateActor(u, dt); return; }
  const moving = u.follow ? followPlayer(u, dt, !!t) : (applyGravity(u, dt), false);
  if (u.reloadT > 0) {
    u.reloadT -= dt;
    u.char.play('Reload', { once: true });
    if (u.reloadT <= 0) u.ammo = 30;
    return;
  }
  if (!t) { if (!u.follow) idleAnim(u); return; }
  u.yaw = angleLerp(u.yaw, yawTo(u.pos, t.pos), dt * 8);
  u.char.play(moving ? 'Walk_Rifle' : 'Fire');
  shootLogic(u, t, dt, 0.5);
}

function chooseTarget(e) {
  const p = G.player;
  let best = p && p.alive ? p : null;
  let bd = best ? e.pos.distanceTo(p.pos) * 0.75 : 1e9;
  for (const o of G.units) {
    if (o.kind !== 'ally' || !o.alive || !o.char.hasRifle) continue;
    const d = o.pos.distanceTo(e.pos);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function updateEnemy(e, dt) {
  const ch = e.char;
  const tgt = chooseTarget(e);
  e.thinkT -= dt;
  if (e.thinkT <= 0) {
    e.thinkT = rand(0.2, 0.35);
    if (tgt) {
      e.dist = e.pos.distanceTo(tgt.pos);
      e.los = e.dist < e.sight && lineOfSight(eyeOf(e, _a), chestOf(tgt, _b));
      if (!e.alert && e.los) {
        const facing = Math.abs(angleDiff(e.yaw, yawTo(e.pos, tgt.pos))) < 1.3;
        if (facing || e.dist < 12) alertNear(e);
      }
    } else e.los = false;
  }
  e.focus = e.los ? Math.min(1, e.focus + dt * 0.6) : Math.max(0, e.focus - dt);
  if (e.moveTarget) { updateActor(e, dt); return; }
  if (!e.alert || !tgt) { idleAnim(e); applyGravity(e, dt); return; }
  if (!ch.hasRifle) {
    e.yaw = angleLerp(e.yaw, yawTo(e.pos, tgt.pos), dt * 5);
    ch.play('Command'); applyGravity(e, dt); return;
  }
  if (e.reloadT > 0) {
    e.reloadT -= dt;
    ch.play(e.prone ? 'Prone_Fire' : 'Reload', { once: !e.prone });
    if (e.reloadT <= 0) e.ammo = 30;
    applyGravity(e, dt);
    return;
  }
  const toT = yawTo(e.pos, tgt.pos);
  if (e.prone) {
    e.yaw = angleLerp(e.yaw, toT, dt * 3);
    ch.play('Prone_Fire');
    if (e.los && (tgt !== G.player || G.shooters.has(e))) shootLogic(e, tgt, dt, 0.24 * e.accuracy);
    applyGravity(e, dt);
    return;
  }
  const advance = !e.los || e.dist > e.range * 1.6;
  let anim = null;
  if (advance) {
    const d = moveToward(e, tgt.pos.x, tgt.pos.z, 4.2, dt);
    e.yaw = angleLerp(e.yaw, Math.atan2(e.pos.x - e.lastPos.x, e.pos.z - e.lastPos.z) || toT, dt * 8);
    anim = d > 0.1 ? 'Run_Rifle' : null;
  } else {
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafeDir = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1); e.strafeT = rand(1.2, 2.6); }
    e.yaw = angleLerp(e.yaw, toT, dt * 6);
    if (e.strafeDir) {
      const sx = -Math.cos(toT) * e.strafeDir, sz = Math.sin(toT) * e.strafeDir;
      moveToward(e, e.pos.x + sx, e.pos.z + sz, 1.7, dt);
      anim = 'Walk_Rifle';
    }
  }
  applyGravity(e, dt);
  const firing = !advance && e.los && Math.abs(angleDiff(e.yaw, toT)) < 0.35 && (tgt !== G.player || G.shooters.has(e));
  if (firing) shootLogic(e, tgt, dt, 0.2 * e.accuracy);
  ch.play(anim || (G.time - (e.lastShot || -9) < 0.3 ? 'Fire' : 'Aim'), { fade: 0.15 });
}

function shootLogic(u, tgt, dt, baseAcc) {
  u.shotT -= dt;
  if (u.shotT > 0) return;
  if (u.burst <= 0) {
    u.burst = 2 + Math.floor(Math.random() * 3);
    u.shotT = u.kind === 'enemy' ? rand(1.2, 2.4) : rand(0.6, 1.4);
    return;
  }
  u.burst--;
  u.shotT = 0.12;
  u.ammo--;
  if (u.ammo <= 0) { u.reloadT = 2.4; }
  fireAt(u, tgt, baseAcc);
}

function fireAt(u, tgt, baseAcc) {
  u.lastShot = G.time;
  u.char.muzzle(_m);
  chestOf(tgt, _c);
  const dist = _m.distanceTo(_c);
  let chance = baseAcc * clamp(1.2 - dist / 45, 0.15, 1) * (0.35 + 0.65 * u.focus);
  if (tgt === G.player) {
    if (tgt.moving) chance *= tgt.sprinting ? 0.5 : 0.7;
    if (tgt.aiming && !tgt.moving) chance *= 1.1;
  }
  const hit = Math.random() < chance;
  _b.subVectors(_c, _m).normalize();
  if (!hit) {
    _a.set(rand(-1, 1), rand(-0.6, 0.9), rand(-1, 1)).multiplyScalar(clamp(dist * 0.06, 0.6, 2.2));
    _c.add(_a);
    _b.subVectors(_c, _m).normalize();
  }
  const wall = raycast(_m, _b, hit ? dist - 0.2 : 120);
  const end = wall ? wall.point : (hit ? _c : _m.clone().addScaledVector(_b, 120));
  FX.muzzleFlash(_m, false);
  FX.tracer(_m, end);
  const listener = G.player ? G.player.pos : _m;
  FX.sfxShot(_m.distanceTo(listener), false);
  if (wall) { FX.impact(wall.point, wall.normal, 'dust'); return; }
  if (!hit) return;
  if (tgt === G.player) tgt.damage(rand(5, 8), u.pos, Math.random() < PLATE.enemyHeadChance);
  else if (tgt.kind === 'enemy') { damageUnit(tgt, rand(30, 45), u.pos, false); FX.impact(_c, null, 'blood'); }
}

// 연출: 걸어가기
export function moveUnit(u, to, run, faceDeg) {
  return new Promise(res => {
    u.moveTarget = to;
    u.moveRun = !!run;
    u.faceYaw = faceDeg != null ? faceDeg * Math.PI / 180 : null;
    u.onArrive = res;
  });
}

export function enemiesAlive(group) {
  return G.units.filter(u => u.kind === 'enemy' && u.alive && (!group || u.group === group)).length;
}

// ════════════════ 낙하산 강하 ════════════════
const canopyGeo = new THREE.SphereGeometry(2.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4);
const canopyMat = new THREE.MeshStandardMaterial({ color: 0x5b6142, roughness: 0.9, side: THREE.DoubleSide });
function setupPara(u, opt) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(canopyGeo, canopyMat);
  c.scale.y = 0.55;
  c.position.y = 5.2;
  c.castShadow = true;
  g.add(c);
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 2.0, 5.6, Math.sin(a) * 2.0), new THREE.Vector3(Math.cos(a) * 0.2, 1.55, Math.sin(a) * 0.15));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x222222 })));
  u.char.root.add(g);
  u.para = {
    canopy: g, height: opt.height ?? 26, speed: opt.speed ?? 3.2,
    follow: opt.follow || null, delay: opt.delay ?? 0, state: 'wait', ground: u.pos.y,
  };
  u.char.root.visible = false;
  u.alert = true;
  u.char.play('Idle_Rifle', { fade: 0 });
}
function updatePara(u, dt) {
  const P = u.para;
  if (P.state === 'wait') {
    let go = false;
    if (P.follow) {
      const pr = G.props.get(P.follow);
      go = !pr || Math.abs(pr.root.position.x - u.pos.x) < 2.5;
    } else { P.delay -= dt; go = P.delay <= 0; }
    if (go) {
      P.state = 'fall';
      const pr = P.follow && G.props.get(P.follow);
      P.alt = pr ? Math.max(4, pr.root.position.y - 1.5 - P.ground) : P.height;
      u.char.root.visible = true;
    }
    u.pos.y = P.ground + (P.alt ?? P.height);
    return;
  }
  if (P.state === 'fall') {
    P.alt -= P.speed * dt;
    u.pos.y = P.ground + Math.max(0, P.alt);
    P.canopy.rotation.z = Math.sin(G.time * 1.3 + u.pos.x) * 0.06;
    if (P.alt <= 0) {
      P.state = 'land'; P.t = 0;
      u.char.play('Aim', { fade: 0.3 });
    }
    return;
  }
  // 착지: 낙하산 접기
  P.t += dt;
  P.canopy.scale.setScalar(Math.max(0.01, 1 - P.t * 1.5));
  P.canopy.position.x = P.t * 1.5;
  if (P.t > 0.7) {
    P.canopy.removeFromParent();
    u.para = null;
    if (G.player) u.yaw = yawTo(u.pos, G.player.pos);
  }
}
export const parasInAir = () => G.units.some(u => u.para);

/** 연출용 사망(쓰러짐) — 적이든 아군이든 */
export function scriptedKill(u) {
  if (!u || !u.alive) return;
  u.alive = false;
  u.hp = 0;
  u.deadAt = G.time;
  u.char.fall();
}
