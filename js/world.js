// ───────────────────────────────────────────────────────────────
//  world.js — 맵/하늘/조명/소품(헬기) 관리, 연출 카메라 상태
// ───────────────────────────────────────────────────────────────
import { THREE, G, loadGLB, makeCollider, syncCollider, DEG, clamp } from './core.js';
import { CHARACTERS, MAPS, PROPS } from './story.js';
import * as FX from './fx.js';
import * as GFX from './gfx.js';

export const getGLTF = key => {
  const c = CHARACTERS[key];
  if (!c) throw new Error(`story.js 의 CHARACTERS 에 '${key}' 가 없습니다`);
  return loadGLB(c.file);
};

// ── 하늘 프리셋 ──────────────────────────────────────────────
const SKIES = {
  day:      { top: 0x4f8fd0, bottom: 0xd8e4ee, fog: 0xc9d4dc, fogNear: 45, fogFar: 190, sun: 0xfff1dc, sunI: 2.8, hemiS: 0xd4e6ff, hemiG: 0x6b5f4e, hemiI: 1.1, dir: [0.45, 1, 0.35], exposure: 1.0, ground: 0x6d6a64, grade: { contrast: 1.08, saturation: 1.1, vignette: 0.28, tint: [1.02, 1.0, 0.97] } },
  dusk:     { top: 0x2c2238, bottom: 0xd97a45, fog: 0x8c6252, fogNear: 25, fogFar: 140, sun: 0xffa060, sunI: 2.2, hemiS: 0xffc29a, hemiG: 0x3a2a24, hemiI: 0.9, dir: [-0.8, 0.45, 0.2], exposure: 1.05, ground: 0x4a403a, grade: { contrast: 1.12, saturation: 1.05, vignette: 0.4, tint: [1.06, 0.97, 0.9] } },
  overcast: { top: 0x737c86, bottom: 0xb9c0c6, fog: 0xa9b0b6, fogNear: 50, fogFar: 230, sun: 0xeef2f6, sunI: 1.6, hemiS: 0xdfe6ee, hemiG: 0x5b5953, hemiI: 1.5, dir: [0.35, 0.8, 0.5], exposure: 1.0, ground: 0x7a7a74, grade: { contrast: 1.1, saturation: 0.85, vignette: 0.38, tint: [0.97, 0.99, 1.03] } },
  night:    { top: 0x05070d, bottom: 0x1c2333, fog: 0x161b26, fogNear: 15, fogFar: 110, sun: 0x9fb5ff, sunI: 0.6, hemiS: 0x5a6a90, hemiG: 0x15151a, hemiI: 0.6, dir: [0.3, 1, -0.4], exposure: 1.2, ground: 0x1d1f24, grade: { contrast: 1.12, saturation: 0.8, vignette: 0.45, tint: [0.9, 0.95, 1.1] } },
};

let sky, sun, hemi, ground, mapRoot = null;

export function initWorld() {
  const geo = new THREE.SphereGeometry(600, 32, 16);
  sky = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vp; void main(){ float h = clamp(vp.y*1.6+0.08,0.,1.); gl_FragColor = vec4(mix(bottom, top, pow(h,0.7)),1.);\n#include <colorspace_fragment>\n}',
  }));
  sky.renderOrder = -1;
  G.scene.add(sky);
  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  G.scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -34; sc.right = sc.top = 34; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  G.scene.add(sun, sun.target);
  ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x666666 }));
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  G.scene.add(ground);
  G.scene.fog = new THREE.Fog(0xcccccc, 40, 200);
}

export function setSky(name) {
  const s = SKIES[name] || SKIES.day;
  sky.material.uniforms.top.value.setHex(s.top);
  sky.material.uniforms.bottom.value.setHex(s.bottom);
  G.scene.fog.color.setHex(s.fog);
  G.scene.fog.near = s.fogNear; G.scene.fog.far = s.fogFar;
  sun.color.setHex(s.sun); sun.intensity = s.sunI;
  hemi.color.setHex(s.hemiS); hemi.groundColor.setHex(s.hemiG); hemi.intensity = s.hemiI;
  G.sunDir = new THREE.Vector3(...s.dir).normalize();
  G.renderer.toneMappingExposure = s.exposure;
  ground.material.color.setHex(s.ground);
  if (G.settings.quality !== 'low') hemi.intensity = s.hemiI * 0.7;
  GFX.setGrade(s.grade || {});
}

/** 맵 교체 */
export async function setMap(key, onProgress) {
  const def = MAPS[key];
  if (!def) throw new Error(`story.js 의 MAPS 에 '${key}' 가 없습니다`);
  const gltf = await loadGLB(def.file, onProgress);
  if (mapRoot) mapRoot.removeFromParent();
  mapRoot = gltf.scene;
  if (!gltf.userData.prepared) {
    gltf.userData.prepared = true;
    gltf.userData.colliders = [];
    gltf.userData.ground = [];
    mapRoot.updateMatrixWorld(true);
    mapRoot.traverse(o => {
      if (!o.isMesh) return;
      o.receiveShadow = true;
      o.castShadow = true;
      tweakMaterial(o.material);
      const c = makeCollider(o);
      gltf.userData.colliders.push(c);
      let inCeil = false;
      o.traverseAncestors(a => { if (a.name === 'Ceiling') inCeil = true; });
      if (!inCeil) gltf.userData.ground.push(c);
    });
  }
  if (!gltf.userData.sharp) { GFX.sharpen(mapRoot); gltf.userData.sharp = true; }
  G.scene.add(mapRoot);
  G.mapColliders = gltf.userData.colliders;
  G.colliders = [...gltf.userData.colliders];
  G.groundColliders = gltf.userData.ground;
  const b = def.bounds;
  G.bounds = b ? { minX: b[0], maxX: b[1], minZ: b[2], maxZ: b[3] } : null;
  G.mapDef = def;
  setSky(def.sky);
  return def;
}

// 불/조명/화면 재질은 스스로 빛나게
function tweakMaterial(m) {
  const list = Array.isArray(m) ? m : [m];
  for (const mat of list) {
    const n = (mat.name || '').toLowerCase();
    if (!mat.emissive) continue;
    if (n.startsWith('fire')) { mat.emissive.setHex(0xff6a1a); mat.emissiveIntensity = 2.2; mat.userData.flicker = true; flickers.push(mat); }
    else if (n === 'redl') { mat.emissive.setHex(0xff2020); mat.emissiveIntensity = 1.5; }
    else if (n === 'chand') { mat.emissive.setHex(0xffd28a); mat.emissiveIntensity = 0.8; }
    else if (n.startsWith('scr')) { mat.emissive.copy(mat.color); mat.emissiveIntensity = 0.9; }
  }
}
const flickers = [];

// ── 소품(헬기 등) ─────────────────────────────────────────────
function splitRotor(gltf, cfg) {
  if (gltf.userData.rotor !== undefined) return gltf.userData.rotor;
  let target = null;
  const node = gltf.scene.getObjectByName(cfg.node);
  node && node.traverse(o => { if (o.isMesh && o.material && o.material.name === cfg.material) target = o; });
  if (!target) { gltf.userData.rotor = null; return null; }
  const g = target.geometry, pos = g.attributes.position, idx = g.index;
  const keep = [], rot = [];
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    if (pos.getY(a) > cfg.minY && pos.getY(b) > cfg.minY && pos.getY(c) > cfg.minY) rot.push(a, b, c);
    else keep.push(a, b, c);
  }
  if (!rot.length) { gltf.userData.rotor = null; return null; }
  const gKeep = g.clone(); gKeep.setIndex(keep);
  const gRot = g.clone(); gRot.setIndex(rot);
  gRot.computeBoundingBox();
  const c = new THREE.Vector3(); gRot.boundingBox.getCenter(c);
  gRot.translate(-c.x, 0, -c.z);
  gRot.computeBoundingSphere();
  gltf.userData.rotor = { orig: g, keep: gKeep, rot: gRot, center: new THREE.Vector3(c.x, 0, c.z) };
  return gltf.userData.rotor;
}

// ── 코드로 만드는 소품: 승합차, TV ──────────────────────────
function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...o }); }
function buildVan() {
  const g = new THREE.Group();
  const body = std(0xeef0f0), dark = std(0x22272b), glass = std(0x1d2a33, { roughness: 0.15, metalness: 0.4 }), tire = std(0x151515, { roughness: 0.9 });
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  // 앞쪽 = +Z
  box(1.95, 1.55, 4.9, body, 0, 1.25, 0);            // 몸통
  box(1.9, 0.35, 5.0, dark, 0, 0.45, 0);             // 하부
  box(1.97, 0.55, 3.6, glass, 0, 1.62, -0.45);       // 옆 유리
  box(1.7, 0.6, 0.06, glass, 0, 1.55, 2.47);         // 앞 유리
  box(1.7, 0.5, 0.06, glass, 0, 1.6, -2.46);         // 뒤 유리
  box(0.35, 0.16, 0.05, std(0xfff3c4, { emissive: 0xfff0b0, emissiveIntensity: 0.8 }), -0.7, 0.95, 2.47);
  box(0.35, 0.16, 0.05, std(0xfff3c4, { emissive: 0xfff0b0, emissiveIntensity: 0.8 }), 0.7, 0.95, 2.47);
  box(0.3, 0.14, 0.05, std(0xaa1111, { emissive: 0x880000 }), -0.75, 0.95, -2.47);
  box(0.3, 0.14, 0.05, std(0xaa1111, { emissive: 0x880000 }), 0.75, 0.95, -2.47);
  const wheels = [];
  const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16).rotateZ(Math.PI / 2);
  for (const [x, z] of [[-0.88, 1.55], [0.88, 1.55], [-0.88, -1.55], [0.88, -1.55]]) {
    const w = new THREE.Mesh(wg, tire); w.position.set(x, 0.36, z); w.castShadow = true; g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}
function newsTexture(lines) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 288;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 0, 288);
  grd.addColorStop(0, '#173b6e'); grd.addColorStop(1, '#0b1d38');
  x.fillStyle = grd; x.fillRect(0, 0, 512, 288);
  // 앵커 실루엣
  x.fillStyle = '#2d4f80'; x.beginPath(); x.arc(380, 120, 42, 0, 7); x.fill();
  x.fillRect(318, 165, 124, 80);
  x.fillStyle = '#c62828'; x.fillRect(0, 196, 512, 40);
  x.fillStyle = '#fff'; x.font = 'bold 26px "Noto Sans KR", sans-serif';
  x.fillText('속보', 14, 226);
  x.fillStyle = '#fff'; x.fillRect(84, 200, 3, 32);
  x.font = 'bold 21px "Noto Sans KR", sans-serif';
  x.fillText(lines[0] || '', 98, 225);
  x.fillStyle = '#0a0f17'; x.fillRect(0, 236, 512, 52);
  x.fillStyle = '#ffd54f'; x.font = '18px "Noto Sans KR", sans-serif';
  x.fillText(lines[1] || '', 14, 268);
  x.fillStyle = 'rgba(255,255,255,.85)'; x.font = 'bold 18px sans-serif'; x.fillText('NEWS 24', 16, 32);
  x.fillStyle = '#e53935'; x.beginPath(); x.arc(118, 26, 6, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.font = '14px sans-serif'; x.fillText('LIVE', 128, 31);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function buildTV(s) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.8, 0.07), std(0x111111));
  g.add(frame);
  const lines = Array.isArray(s.text) ? s.text : [s.text || ''];
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.72), new THREE.MeshBasicMaterial({ map: newsTexture(lines), toneMapped: false }));
  scr.position.z = 0.04;
  g.add(scr);
  // 텍스트는 폰트가 늦게 로드될 수 있어 한 번 더 그림
  document.fonts && document.fonts.ready.then(() => { scr.material.map = newsTexture(lines); scr.material.needsUpdate = true; });
  return g;
}

/** 북한 시골집 방 내부 (앞 = +Z 쪽에 문) — 폭 7m, 깊이 4.5m */
function buildRoom(s) {
  const g = new THREE.Group();
  const W = 7, D = 4.5, H = 2.5;
  const wall = std(0xe6dfcc, { roughness: 0.95 }), floor = std(0xc8913e, { roughness: 0.45 }), wood = std(0x5a3a22, { roughness: 0.7 }),
    dark = std(0x3b2616, { roughness: 0.6 }), brass = std(0xc9a54a, { metalness: 0.8, roughness: 0.3 }), ceil = std(0xd8d0bb, { roughness: 1 });
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  box(W, 0.1, D, floor, 0, -0.05, 0);                       // 장판
  box(W, 0.1, D, ceil, 0, H + 0.05, 0);                     // 천장
  box(W, H, 0.12, wall, 0, H / 2, -D / 2);                  // 뒷벽
  box(0.12, H, D, wall, -W / 2, H / 2, 0);                  // 왼벽
  box(0.12, H, D, wall, W / 2, H / 2, 0);                   // 오른벽
  const gap = 1.0, side = (W - gap) / 2;
  box(side, H, 0.12, wall, -(gap / 2 + side / 2), H / 2, D / 2);   // 앞벽(문 양쪽)
  box(side, H, 0.12, wall, gap / 2 + side / 2, H / 2, D / 2);
  box(gap, H - 2.0, 0.12, wall, 0, 2.0 + (H - 2.0) / 2, D / 2);    // 문 위
  box(0.08, 2.0, 0.16, wood, -gap / 2 - 0.04, 1.0, D / 2);         // 문틀
  box(0.08, 2.0, 0.16, wood, gap / 2 + 0.04, 1.0, D / 2);
  // 문 밖 = 밝은 햇빛 (이 판이 문을 막아서 밖으로 못 나감)
  const day = new THREE.Mesh(new THREE.BoxGeometry(gap + 0.1, 2.05, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff6e2 }));
  day.position.set(0, 1.0, D / 2 + 0.12);
  g.add(day);
  // 부서진 문짝
  const door = box(0.9, 1.9, 0.05, wood, 0.55, 0.06, D / 2 - 0.6); door.rotation.x = -Math.PI / 2 + 0.08; door.position.y = 0.08;
  for (const x of [-2.2, 0, 2.2]) box(0.16, 0.14, D, wood, x, H - 0.07, 0);   // 서까래
  box(W, 0.12, 0.06, wood, 0, 0.06, -D / 2 + 0.07);         // 걸레받이
  // 창문 (밖의 빛)
  box(1.3, 0.85, 0.05, std(0xf4f1e6, { emissive: 0xfff6dc, emissiveIntensity: 1.4 }), -1.6, 1.45, -D / 2 + 0.07);
  box(0.05, 0.85, 0.07, wood, -1.6, 1.45, -D / 2 + 0.09); box(1.3, 0.05, 0.07, wood, -1.6, 1.45, -D / 2 + 0.09);
  // 장롱
  box(1.7, 1.95, 0.6, dark, W / 2 - 1.0, 0.975, -D / 2 + 0.38);
  box(0.03, 1.8, 0.02, wood, W / 2 - 1.0, 0.98, -D / 2 + 0.69);
  for (const dx of [-0.08, 0.08]) box(0.04, 0.2, 0.03, brass, W / 2 - 1.0 + dx, 1.0, -D / 2 + 0.7);
  // 이불 더미
  const quilt = [0xb23a48, 0x2f6f8f, 0xd9b44a, 0x7a9a4a];
  quilt.forEach((c, i) => box(1.2, 0.16, 0.7, std(c, { roughness: 1 }), -W / 2 + 0.75, 0.08 + i * 0.16, -D / 2 + 0.45));
  // 밥상
  box(0.9, 0.05, 0.6, wood, -0.6, 0.33, 0.2);
  for (const [lx, lz] of [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25], [0.4, 0.25]]) box(0.05, 0.3, 0.05, wood, -0.6 + lx, 0.15, 0.2 + lz);
  box(0.16, 0.08, 0.16, std(0xeeeeee), -0.75, 0.39, 0.15); box(0.16, 0.08, 0.16, std(0xeeeeee), -0.4, 0.39, 0.3);
  // 액자 두 개
  for (const x of [0.6, 1.6]) { box(0.55, 0.7, 0.04, std(0x2b2b2b), x, 1.85, -D / 2 + 0.08); box(0.45, 0.6, 0.02, std(0x8d8577), x, 1.85, -D / 2 + 0.1); }
  // 전구
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), std(0xfff2c8, { emissive: 0xffd88a, emissiveIntensity: 3 }));
  bulb.position.set(0, H - 0.35, 0);
  g.add(bulb);
  box(0.01, 0.28, 0.01, std(0x111111), 0, H - 0.15, 0);
  return g;
}

export async function createProp(model, s) {
  const def = PROPS[model];
  if (!def) throw new Error(`story.js 의 PROPS 에 '${model}' 가 없습니다`);
  if (def.procedural) {
    const root = new THREE.Group();
    const inner = def.procedural === 'van' ? buildVan() : def.procedural === 'room' ? buildRoom(s) : buildTV(s);
    root.add(inner);
    const p = s.pos || [0, 0, 0];
    root.position.set(p[0], p[1] ?? 0, p[2] ?? 0);
    root.rotation.y = (s.rot || 0) * DEG;
    G.scene.add(root);
    root.updateMatrixWorld(true);
    const colliders = [];
    if (s.collide !== false && (def.procedural === 'van' || def.procedural === 'room')) {
      inner.traverse(o => { if (o.isMesh) colliders.push(makeCollider(o)); });
      G.colliders.push(...colliders);
    }
    return { root, inner, colliders, rotor: null, rotorOn: false, rotorSpeed: 0, tween: null, wheels: inner.userData.wheels || null, last: root.position.clone() };
  }
  const gltf = await loadGLB(def.file);
  const rs = def.rotor ? splitRotor(gltf, def.rotor) : null;
  const root = new THREE.Group();
  const inner = gltf.scene.clone(true);
  inner.position.y = def.lift || 0;
  root.add(inner);
  const pr = { root, colliders: [], rotor: null, rotorOn: !!s.rotor, rotorSpeed: s.rotor ? 1 : 0, tween: null };
  inner.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (rs && o.geometry === rs.orig) {
      o.geometry = rs.keep;
      const pivot = new THREE.Group();
      pivot.position.copy(rs.center);
      const blades = new THREE.Mesh(rs.rot, o.material);
      blades.castShadow = true;
      pivot.add(blades);
      o.add(pivot);
      pr.rotor = pivot;
    }
  });
  const p = s.pos || [0, 0, 0];
  root.position.set(p[0], p[1] ?? 0, p[2] ?? 0);
  root.rotation.y = (s.rot || 0) * DEG;
  G.scene.add(root);
  root.updateMatrixWorld(true);
  if (s.collide !== false) {
    inner.traverse(o => { if (o.isMesh && o.parent !== pr.rotor) pr.colliders.push(makeCollider(o)); });
    G.colliders.push(...pr.colliders);
  }
  return pr;
}

const _ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export function updateProps(dt) {
  let rotorVol = 0;
  const lp = G.camera.position;
  for (const pr of G.props.values()) {
    if (pr.tween) {
      const tw = pr.tween;
      const k = clamp((G.time - tw.t0) / tw.dur, 0, 1);
      const e = _ease(k);
      pr.root.position.lerpVectors(tw.from, tw.to, e);
      pr.root.rotation.y = tw.r0 + (tw.r1 - tw.r0) * e;
      pr.root.updateMatrixWorld(true);
      for (const c of pr.colliders) syncCollider(c);
      if (k >= 1) pr.tween = null;
    }
    if (pr.wheels) {
      const moved = pr.root.position.distanceTo(pr.last);
      pr.last.copy(pr.root.position);
      for (const w of pr.wheels) w.rotation.x += moved / 0.36;
      FX.sfxEngine(moved > 0.001 && !pr.burnt);
    }
    pr.rotorSpeed += ((pr.rotorOn ? 1 : 0) - pr.rotorSpeed) * Math.min(1, dt * 0.6);
    if (pr.rotor) pr.rotor.rotation.y += pr.rotorSpeed * 28 * dt;
    if (pr.rotorSpeed > 0.02) rotorVol += pr.rotorSpeed * 0.9 / (1 + pr.root.position.distanceTo(lp) * 0.06);
  }
  FX.setRotorVolume(Math.min(1, rotorVol));
  // 불 깜빡임
  for (const m of flickers) m.emissiveIntensity = 1.8 + Math.sin(G.time * 13 + m.id) * 0.4 + Math.random() * 0.3;
}

export function clearProps() {
  for (const pr of G.props.values()) pr.root.removeFromParent();
  G.props.clear();
  FX.sfxEngine(false);
}

/** 폭발로 탄 소품: 검게 그을리고 기울어짐 */
export function burnProp(pr) {
  pr.burnt = true;
  pr.tween = null;
  pr.root.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.color && o.material.color.multiplyScalar(0.12);
    if (o.material.emissive) o.material.emissive.setHex(0x000000);
  });
  pr.root.rotation.z = 0.12;
  pr.root.rotation.x = -0.05;
  pr.root.position.y += 0.05;
  const c = new THREE.Vector3(); new THREE.Box3().setFromObject(pr.root).getCenter(c);
  FX.addFire(c.setY(c.y + 0.3), 1.1);
  FX.sfxEngine(false);
}

// ── 하늘/그림자는 카메라·플레이어를 따라감 ─────────────────────
export function updateWorld() {
  sky.position.copy(G.camera.position);
  const focus = G.player ? G.player.pos : G.camera.position;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(G.sunDir || new THREE.Vector3(0, 1, 0), 90);
  const q = G.settings.quality;
  sun.castShadow = q !== 'low';
  const size = q === 'ultra' ? 4096 : 2048;
  if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
}

// ── 연출 카메라 상태 ─────────────────────────────────────────
export function setCine(c) { G.cine = c; }
export function propById(id) { return G.props.get(id); }
