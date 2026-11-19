// ───────────────────────────────────────────────────────────────
//  viewmodel.js — 1인칭 무기 (소총 / 단검 / 투척단검)
//   소총: 주인공 캐릭터 glb 의 총 모델을 그대로 씀
//   단검·투척단검: 코드로 만든 칼
// ───────────────────────────────────────────────────────────────
import { THREE, G } from './core.js';

let vmScene, vmCam;
const groups = {};          // rifle / knife / throwknife
let cur = null, curName = '';
let tip = null;             // 소총 총구
const st = { kick: 0, bobT: 0, bob: 0, ads: 0, low: 0, sprint: 0, swing: 0, swingKind: '', hide: 0, sway: new THREE.Vector2() };
const POS = {
  rifle: { hip: new THREE.Vector3(0.16, -0.17, -0.38), ads: new THREE.Vector3(0.0, -0.13, -0.3) },
  knife: { hip: new THREE.Vector3(0.2, -0.2, -0.36), ads: new THREE.Vector3(0.2, -0.2, -0.36) },
  throwknife: { hip: new THREE.Vector3(0.21, -0.17, -0.34), ads: new THREE.Vector3(0.21, -0.17, -0.34) },
};

export function initViewmodel() {
  vmScene = new THREE.Scene();
  vmCam = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
  vmScene.add(new THREE.HemisphereLight(0xe8eef5, 0x5a5650, 2.4));
  const d = new THREE.DirectionalLight(0xffffff, 1.8);
  d.position.set(1, 2, 1.5);
  vmScene.add(d);
  // 칼 두 종류 (한 번만 만듦)
  addGroup('knife', buildKnifeMesh(1.25));
  addGroup('throwknife', buildKnifeMesh(0.8, true));
}

/** 칼 모양 (날 = +Z 방향). big: 크기 배율, slim: 투척용 */
export function buildKnifeMesh(scale = 1, slim = false) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9cfd4, metalness: 0.95, roughness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: slim ? 0x2a2a2a : 0x3a2a1e, roughness: 0.7 });
  const guard = new THREE.MeshStandardMaterial({ color: 0x55585c, metalness: 0.8, roughness: 0.35 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.006, 0.17), steel);
  blade.position.z = 0.085;
  const tipG = new THREE.ConeGeometry(0.0145, 0.05, 4).rotateX(Math.PI / 2).scale(1, 0.25, 1);
  const point = new THREE.Mesh(tipG, steel);
  point.position.z = 0.195;
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.014), guard);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, slim ? 0.08 : 0.11), dark);
  handle.position.z = slim ? -0.045 : -0.06;
  g.add(blade, point, hilt, handle);
  g.scale.setScalar(scale);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function addGroup(name, obj) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  g.add(obj);
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI;   // 무기의 +Z(앞)가 카메라 앞(-Z)을 향하게
  pivot.add(g);
  pivot.visible = false;
  vmScene.add(pivot);
  g.userData.pivot = pivot;
  if (groups[name]) groups[name].userData.pivot.removeFromParent();
  groups[name] = g;
  if (curName === name) setWeapon(name);
  return g;
}

/** 캐릭터 glb 의 Weapon 메쉬로 1인칭 소총 만들기 */
export function buildViewmodel(gltf) {
  tip = null;
  const weapon = gltf.scene.getObjectByName('Weapon');
  if (!weapon) { if (groups.rifle) { groups.rifle.userData.pivot.removeFromParent(); delete groups.rifle; } return; }
  const inner = new THREE.Group();
  const pts = [];
  weapon.traverse(o => {
    if (!o.isMesh) return;
    inner.add(new THREE.Mesh(o.geometry, o.material));
    const pos = o.geometry.attributes.position;
    for (let k = 0; k < pos.count; k++) pts.push(new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)));
  });
  // 총의 긴 축(PCA) = 총열 방향
  const mu = new THREE.Vector3();
  for (const v of pts) mu.add(v);
  mu.divideScalar(pts.length);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const v of pts) {
    const d = [v.x - mu.x, v.y - mu.y, v.z - mu.z];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b];
  }
  let ax = [0, 0, 1];
  for (let it = 0; it < 60; it++) {
    const w = [0, 1, 2].map(a => C[a][0] * ax[0] + C[a][1] * ax[1] + C[a][2] * ax[2]);
    const l = Math.hypot(...w); ax = w.map(x => x / l);
  }
  const axis = new THREE.Vector3(...ax);
  if (axis.z < 0) axis.negate();             // 총구 쪽(+Z)으로
  let tipV = pts[0], best = -1e9;
  for (const v of pts) { const t = v.clone().sub(mu).dot(axis); if (t > best) { best = t; tipV = v; } }
  inner.position.copy(mu).negate();
  const aligned = new THREE.Group();
  aligned.quaternion.setFromUnitVectors(axis, new THREE.Vector3(0, 0, 1));
  aligned.add(inner);
  tip = new THREE.Object3D();
  tip.position.copy(tipV).addScaledVector(axis, 0.03);
  inner.add(tip);
  addGroup('rifle', aligned);
}

/** 들고 있는 무기 바꾸기 */
export function setWeapon(name) {
  for (const k in groups) groups[k].userData.pivot.visible = false;
  curName = name;
  cur = groups[name] || null;
  if (cur) cur.userData.pivot.visible = true;
  st.swing = 0;
  st.hide = 0.6;            // 바꿀 때 아래에서 올라오는 연출
}

export function kick() { st.kick = Math.min(1.4, st.kick + 1); }
/** 단검 찌르기('stab') / 투척('throw') 연출 */
export function swing(kind) { st.swing = 1; st.swingKind = kind; }

const _t = new THREE.Vector3();
export function update(dt, p, inp) {
  if (!cur) return;
  const plating = p.plateT > 0;
  const P = POS[curName] || POS.rifle;
  st.ads += ((p.aiming ? 1 : 0) - st.ads) * Math.min(1, dt * 14);
  st.low += (((p.reloadT > 0 || plating) ? 1 : 0) - st.low) * Math.min(1, dt * 8);
  st.sprint += ((p.sprinting ? 1 : 0) - st.sprint) * Math.min(1, dt * 8);
  st.kick = Math.max(0, st.kick - dt * 9);
  st.swing = Math.max(0, st.swing - dt * (st.swingKind === 'throw' ? 2.6 : 3.6));
  st.hide = Math.max(0, st.hide - dt * 3);
  if (p.moving) st.bobT += dt * (p.sprinting ? 13 : 8.5);
  st.bob += ((p.moving ? 1 : 0) - st.bob) * Math.min(1, dt * 6);
  st.sway.x += ((-inp.dx * 0.0006) - st.sway.x) * Math.min(1, dt * 10);
  st.sway.y += ((inp.dy * 0.0006) - st.sway.y) * Math.min(1, dt * 10);
  const bobAmt = (1 - st.ads * 0.8) * st.bob;
  _t.lerpVectors(P.hip, P.ads, st.ads);
  _t.x += Math.sin(st.bobT) * 0.012 * bobAmt + st.sway.x + st.sprint * 0.05;
  _t.y += Math.abs(Math.cos(st.bobT)) * 0.012 * bobAmt - st.low * 0.16 + st.sway.y - st.sprint * 0.05 - st.hide * 0.25;
  _t.z += st.kick * 0.045;
  // 휘두르기: 0→1→0 곡선
  const s = st.swing > 0 ? Math.sin((1 - st.swing) * Math.PI) : 0;
  let rx = -st.kick * 0.06 + st.low * 0.7, ry = -st.sprint * 0.6, rz = st.low * 0.35 + st.sprint * 0.3;
  if (curName === 'knife') {
    rx += -0.35; rz += 0.25;                     // 칼날이 살짝 위·안쪽을 향하게
    _t.z -= s * 0.32; _t.x -= s * 0.1; _t.y += s * 0.05;
    rx += s * 0.5; ry += s * 0.35;
  } else if (curName === 'throwknife') {
    rx += -0.9; rz += 0.15;                      // 손끝으로 쥔 모양
    _t.z -= s * 0.25; _t.y += s * 0.12;
    rx += s * 1.3;
    cur.visible = (p.throwCount ?? 1) > 0 && st.swing < 0.55;
  }
  // pivot 이 180° 돌아가 있으니 x, z 부호 반대
  cur.position.set(-_t.x, _t.y, -_t.z);
  cur.rotation.set(rx, ry, rz);
  vmCam.fov = G.camera.fov;
  vmCam.aspect = G.camera.aspect;
  vmCam.updateProjectionMatrix();
}

/** 총구 위치(월드 좌표) — 소총일 때만 */
export function muzzleWorld(out) {
  if (!tip || curName !== 'rifle') return null;
  groups.rifle.userData.pivot.updateMatrixWorld(true);
  tip.getWorldPosition(out);            // vmScene 기준(카메라 = 원점)
  return out.applyMatrix4(G.camera.matrixWorld);
}

export function render(renderer) {
  if (!cur) return;
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(vmScene, vmCam);
  renderer.autoClear = true;
}
export const ready = () => !!cur;
