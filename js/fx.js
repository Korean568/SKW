// ───────────────────────────────────────────────────────────────
//  fx.js — 총구 불꽃, 예광탄, 피격 이펙트, 효과음(WebAudio 합성)
// ───────────────────────────────────────────────────────────────
import { THREE, G, rand } from './core.js';

// ════════════════ 시각 효과 ════════════════
function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let texFlash, texPuff, texBlood, texSpark, texSmoke, texFire;
const pools = { sprite: [], tracer: [] };
const live = [];
let muzzleLight;
const tracerGeo = new THREE.BoxGeometry(0.025, 0.025, 1).translate(0, 0, 0.5);

export function initFX() {
  texFlash = radialTexture('rgba(255,255,230,1)', 'rgba(255,170,40,0.85)');
  texPuff = radialTexture('rgba(200,190,170,0.9)', 'rgba(140,130,115,0.5)');
  texBlood = radialTexture('rgba(150,10,10,1)', 'rgba(110,0,0,0.7)');
  texSpark = radialTexture('rgba(255,240,180,1)', 'rgba(255,150,30,0.8)');
  texSmoke = radialTexture('rgba(70,66,62,0.85)', 'rgba(45,42,40,0.45)');
  texFire = radialTexture('rgba(255,230,150,1)', 'rgba(255,90,20,0.75)');
  muzzleLight = new THREE.PointLight(0xffb050, 0, 9, 2);
  G.scene.add(muzzleLight);
  boomLight = new THREE.PointLight(0xffa040, 0, 40, 1.6);
  G.scene.add(boomLight);
}

export function resetFX() {
  for (const f of live) f.obj.visible = false;
  live.length = 0;
  for (const f of fires) for (const sp of f.sprites) sp.removeFromParent();
  fires.length = 0;
  for (const m of missiles) m.mesh.removeFromParent();
  missiles.length = 0;
  G.shake = 0;
  if (muzzleLight && !muzzleLight.parent) G.scene.add(muzzleLight);
  if (boomLight && !boomLight.parent) G.scene.add(boomLight);
}

function getSprite(tex, additive) {
  let s = pools.sprite.pop();
  if (!s) {
    s = new THREE.Sprite(new THREE.SpriteMaterial({ depthWrite: false, fog: true }));
  }
  s.material.map = tex;
  s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  s.material.opacity = 1;
  s.material.needsUpdate = true;
  s.visible = true;
  if (!s.parent) G.scene.add(s);
  return s;
}
function getTracer() {
  let t = pools.tracer.pop();
  if (!t) {
    t = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({
      color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
  }
  t.visible = true;
  if (!t.parent) G.scene.add(t);
  return t;
}

export function muzzleFlash(pos, isPlayer) {
  const s = getSprite(texFlash, true);
  s.position.copy(pos);
  const k = rand(0.35, 0.6);
  s.scale.set(k, k, k);
  s.material.rotation = rand(0, 6.28);
  live.push({ obj: s, type: 'sprite', t: 0, life: 0.05, fade: false, grow: 0 });
  if (isPlayer || Math.random() < 0.3) {
    muzzleLight.position.copy(pos);
    muzzleLight.intensity = isPlayer ? 6 : 3;
  }
}

export function tracer(from, to) {
  const t = getTracer();
  t.position.copy(from);
  t.lookAt(to);
  const len = from.distanceTo(to);
  t.scale.set(1, 1, len);
  t.material.opacity = 0.85;
  live.push({ obj: t, type: 'tracer', t: 0, life: 0.06 });
}

export function impact(pos, normal, kind = 'dust') {
  const n = kind === 'blood' ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const s = getSprite(kind === 'blood' ? texBlood : (i === 0 ? texSpark : texPuff), kind !== 'blood' && i === 0);
    s.position.copy(pos);
    if (normal) s.position.addScaledVector(normal, 0.05);
    const k = kind === 'blood' ? rand(0.15, 0.3) : (i === 0 ? 0.18 : rand(0.25, 0.4));
    s.scale.set(k, k, k);
    const v = new THREE.Vector3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).multiplyScalar(kind === 'blood' ? 0.8 : 0.5);
    if (normal) v.addScaledVector(normal, 0.8);
    live.push({ obj: s, type: 'sprite', t: 0, life: kind === 'blood' ? 0.45 : (i === 0 ? 0.08 : 0.6), fade: true, grow: kind === 'blood' ? 0.6 : 1.2, v });
  }
}

export function updateFX(dt) {
  if (muzzleLight) muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 120);
  if (boomLight) boomLight.intensity = Math.max(0, boomLight.intensity - dt * 60);
  G.shake = Math.max(0, (G.shake || 0) - dt * 1.2);
  updateFires(dt);
  updateMissiles(dt);
  for (let i = live.length - 1; i >= 0; i--) {
    const f = live[i];
    f.t += dt;
    const p = f.t / f.life;
    if (p >= 1) {
      f.obj.visible = false;
      pools[f.type].push(f.obj);
      live.splice(i, 1);
      continue;
    }
    if (f.type === 'tracer') f.obj.material.opacity = 0.85 * (1 - p);
    else {
      if (f.fade) f.obj.material.opacity = 1 - p;
      if (f.grow) f.obj.scale.multiplyScalar(1 + f.grow * dt);
      if (f.v) f.obj.position.addScaledVector(f.v, dt);
    }
  }
}

// ════════════════ 사운드 (파일 없이 합성) ════════════════
let ac = null, master = null, noiseBuf = null;
let rotor = null, wind = null;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return; }
  master = ac.createGain();
  master.gain.value = G.settings.volume;
  master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolume(v) { if (master) master.gain.value = v; }

function noise(dur, { type = 'lowpass', freq = 2000, q = 0.7, vol = 1, attack = 0.002, decay = dur, when = 0 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = rand(0.9, 1.1);
  const f = ac.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, rand(0, 1)); src.stop(t + dur + 0.05);
}
function tone(freq, dur, { vol = 0.3, type = 'sine', to = null, when = 0 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

/** 총소리: dist=청자와 거리(m) */
export function sfxShot(dist = 0, isPlayer = false) {
  if (!ac) return;
  const v = isPlayer ? 0.9 : Math.max(0.04, 0.7 / (1 + dist * 0.08));
  const far = dist > 25;
  noise(far ? 0.5 : 0.25, { freq: far ? 900 : (isPlayer ? 5000 : 3200), vol: v, decay: far ? 0.45 : 0.18 });
  tone(isPlayer ? 140 : 110, 0.12, { vol: v * 0.8, to: 40, type: 'triangle' });
}
export function sfxReload() {
  noise(0.05, { type: 'highpass', freq: 2500, vol: 0.35, decay: 0.05 });
  noise(0.05, { type: 'highpass', freq: 3000, vol: 0.35, decay: 0.05, when: 0.9 });
  noise(0.06, { type: 'highpass', freq: 2000, vol: 0.45, decay: 0.06, when: 1.9 });
}
export function sfxHitmarker(head) { tone(head ? 1900 : 1400, 0.06, { vol: 0.18, type: 'square' }); }
export function sfxHurt() { tone(90, 0.2, { vol: 0.5, to: 50, type: 'sine' }); noise(0.1, { freq: 600, vol: 0.3 }); }
export function sfxEmpty() { noise(0.03, { type: 'highpass', freq: 4000, vol: 0.3, decay: 0.03 }); }
export function sfxUI() { tone(660, 0.05, { vol: 0.12, type: 'triangle' }); }
export function sfxBlip() { tone(880, 0.08, { vol: 0.12 }); tone(1320, 0.1, { vol: 0.1, when: 0.08 }); }

/** 연속음(헬기 로터/바람) — gain 노드를 돌려줌 */
function loopNoise(freq, lfoHz, lfoDepth) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.value = 0;
  const amp = ac.createGain(); amp.gain.value = 1 - lfoDepth;
  if (lfoHz) {
    const lfo = ac.createOscillator(); lfo.frequency.value = lfoHz;
    const lg = ac.createGain(); lg.gain.value = lfoDepth;
    lfo.connect(lg); lg.connect(amp.gain); lfo.start();
  }
  src.connect(f); f.connect(amp); amp.connect(g); g.connect(master);
  src.start();
  return g;
}
export function setRotorVolume(v) {
  if (!ac) return;
  if (!rotor) rotor = loopNoise(260, 11, 0.7);
  rotor.gain.setTargetAtTime(v, ac.currentTime, 0.2);
}
export function setWind(v) {
  if (!ac) return;
  if (!wind) wind = loopNoise(380, 0.15, 0.4);
  wind.gain.setTargetAtTime(v, ac.currentTime, 0.5);
}

// 멀리서 들리는 교전음
let battleTimer = 0;
export function updateAmbience(dt, battle) {
  if (!ac || !battle) return;
  battleTimer -= dt;
  if (battleTimer <= 0) {
    const n = Math.random() < 0.5 ? 1 : Math.floor(rand(3, 7));
    for (let i = 0; i < n; i++) {
      setTimeout(() => sfxShot(rand(60, 140)), i * rand(90, 140));
    }
    if (Math.random() < 0.12) { noise(1.6, { freq: 220, vol: 0.35, attack: 0.01, decay: 1.5 }); tone(55, 1.2, { vol: 0.3, to: 30 }); }
    battleTimer = rand(1.5, 5);
  }
}

// 배경음악(선택): story.js 의 chapter.bgm 경로
let bgm = null;
export function playBGM(url) {
  stopBGM();
  if (!url) return;
  bgm = new Audio(encodeURI(url));
  bgm.loop = true;
  bgm.volume = 0.45 * G.settings.volume;
  bgm.play().catch(() => {});
}
export function stopBGM() { if (bgm) { bgm.pause(); bgm = null; } }
export function setBGMVolume() { if (bgm) bgm.volume = 0.45 * G.settings.volume; }

// ════════════════ 폭발 / 미사일 / 불 ════════════════
let boomLight = null;
const fires = [];
const missiles = [];

export function explosion(pos, size = 1) {
  if (!boomLight) { boomLight = new THREE.PointLight(0xffa040, 0, 40, 1.6); G.scene.add(boomLight); }
  if (!boomLight.parent) G.scene.add(boomLight);
  boomLight.position.copy(pos).y += 1.5;
  boomLight.intensity = 60 * size;
  for (let i = 0; i < 10; i++) {
    const s = getSprite(texFire, true);
    s.position.copy(pos).add(new THREE.Vector3(rand(-1, 1), rand(0, 1.5), rand(-1, 1)).multiplyScalar(size));
    const k = rand(1.5, 3) * size;
    s.scale.set(k, k, k);
    live.push({ obj: s, type: 'sprite', t: 0, life: rand(0.4, 0.8), fade: true, grow: 1.6, v: new THREE.Vector3(rand(-3, 3), rand(2, 6), rand(-3, 3)).multiplyScalar(size) });
  }
  for (let i = 0; i < 14; i++) {
    const s = getSprite(texSmoke, false);
    s.position.copy(pos).add(new THREE.Vector3(rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1.5, 1.5)).multiplyScalar(size));
    const k = rand(2, 4) * size;
    s.scale.set(k, k, k);
    live.push({ obj: s, type: 'sprite', t: 0, life: rand(3, 6), fade: true, grow: 0.35, v: new THREE.Vector3(rand(-0.6, 0.6), rand(0.8, 2), rand(-0.6, 0.6)) });
  }
  G.shake = Math.min(2, (G.shake || 0) + 1.4 * size);
  sfxBoom();
}

/** 계속 타오르는 불 (챕터가 끝나면 사라짐) */
export function addFire(pos, size = 1) {
  const sprites = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: i < 4 ? texFire : texSmoke, blending: i < 4 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, transparent: true }));
    G.scene.add(s);
    sprites.push(s);
  }
  fires.push({ pos: pos.clone(), size, sprites, t: rand(0, 10) });
}
function updateFires(dt) {
  for (const f of fires) {
    f.t += dt;
    f.sprites.forEach((s, i) => {
      if (i < 4) {
        const ph = (f.t * 1.6 + i / 4) % 1;
        s.position.set(f.pos.x + Math.sin(i * 2.1 + f.t) * 0.4 * f.size, f.pos.y + ph * 1.6 * f.size, f.pos.z + Math.cos(i * 1.7 + f.t) * 0.4 * f.size);
        const k = (1.4 - ph) * f.size * 1.3;
        s.scale.set(k, k, k);
        s.material.opacity = 1 - ph;
      } else {
        const ph = (f.t * 0.25 + (i - 4) / 2) % 1;
        s.position.set(f.pos.x + ph * 1.5, f.pos.y + 1.5 * f.size + ph * 7, f.pos.z + ph * 0.8);
        const k = (1 + ph * 3) * f.size;
        s.scale.set(k, k, k);
        s.material.opacity = 0.7 * (1 - ph);
      }
    });
  }
}

const missileGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.8, 8).rotateX(Math.PI / 2);
/** 미사일: from → to 로 날아가 폭발. 도착하면 resolve */
export function missile(from, to, dur, size = 1) {
  return new Promise(res => {
    const mesh = new THREE.Mesh(missileGeo, new THREE.MeshStandardMaterial({ color: 0x55585a, metalness: 0.5, roughness: 0.5 }));
    mesh.position.copy(from);
    mesh.lookAt(to);
    G.scene.add(mesh);
    missiles.push({ mesh, from: from.clone(), to: to.clone(), t: 0, dur, size, res, trail: 0 });
    sfxWhistle(dur);
  });
}
function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.t += dt;
    const k = Math.min(1, m.t / m.dur);
    m.mesh.position.lerpVectors(m.from, m.to, k * k);
    m.trail -= dt;
    if (m.trail <= 0) {
      m.trail = 0.02;
      const s = getSprite(texSmoke, false);
      s.position.copy(m.mesh.position);
      s.scale.setScalar(0.7);
      live.push({ obj: s, type: 'sprite', t: 0, life: 1.6, fade: true, grow: 1.2 });
      const f = getSprite(texFire, true);
      f.position.copy(m.mesh.position);
      f.scale.setScalar(0.8);
      live.push({ obj: f, type: 'sprite', t: 0, life: 0.08, fade: true });
    }
    if (k >= 1) {
      m.mesh.removeFromParent();
      missiles.splice(i, 1);
      explosion(m.to, m.size);
      m.res();
    }
  }
}

export function sfxBoom() {
  noise(2.5, { freq: 300, vol: 1.0, attack: 0.005, decay: 2.3 });
  noise(0.4, { freq: 2500, vol: 0.6, decay: 0.35 });
  tone(70, 1.6, { vol: 0.8, to: 25, type: 'sine' });
}
export function sfxWhistle(dur) {
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(1800, t);
  o.frequency.exponentialRampToValueAtTime(500, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + dur * 0.8);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
/** 이명 (삐—) */
export function sfxRing(dur = 4) { tone(3600, dur, { vol: 0.12, type: 'sine' }); }
export function sfxEngine(on) {
  if (!ac) return;
  if (!engine) engine = loopNoise(140, 28, 0.5);
  engine.gain.setTargetAtTime(on ? 0.25 : 0, ac.currentTime, 0.4);
}
let engine = null;

// 방탄판 소리
export function sfxPlateBreak() { noise(0.35, { type: 'bandpass', freq: 1800, q: 2, vol: 0.7, decay: 0.3 }); tone(220, 0.25, { vol: 0.3, to: 90, type: 'square' }); }
export function sfxPlateStart() { noise(0.12, { type: 'highpass', freq: 1500, vol: 0.4, decay: 0.12 }); noise(0.2, { freq: 900, vol: 0.3, decay: 0.2, when: 0.5 }); }
export function sfxPlateDone() { noise(0.08, { type: 'highpass', freq: 2500, vol: 0.5, decay: 0.08 }); tone(520, 0.12, { vol: 0.15, type: 'triangle', when: 0.05 }); tone(780, 0.15, { vol: 0.15, type: 'triangle', when: 0.15 }); }

export function sfxKick() {
  tone(70, 0.25, { vol: 0.9, to: 35, type: 'sine' });
  noise(0.3, { freq: 700, vol: 0.8, decay: 0.25 });
  noise(0.5, { type: 'bandpass', freq: 1400, q: 1.5, vol: 0.4, decay: 0.45, when: 0.04 });
}
/** 이름으로 효과음 재생 (story.js 의 sound 단계에서 사용) */
export function playSound(name) {
  if (name === 'kick') sfxKick();
  else if (name === 'gunshot') sfxShot(4, false);
  else if (name === 'boom') sfxBoom();
  else if (name === 'ring') sfxRing(4);
}
