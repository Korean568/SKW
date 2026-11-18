// ───────────────────────────────────────────────────────────────
//  viewmodel.js — 1인칭 총 (주인공 캐릭터의 총 모델을 화면 앞에 그림)
// ───────────────────────────────────────────────────────────────
import { THREE, G } from './core.js';

let vmScene, vmCam, gun = null, tip = null;
const st = { kick: 0, bobT: 0, bob: 0, ads: 0, low: 0, sprint: 0, sway: new THREE.Vector2() };
const HIP = new THREE.Vector3(0.16, -0.17, -0.38);
const ADS = new THREE.Vector3(0.0, -0.13, -0.3);

export function initViewmodel() {
  vmScene = new THREE.Scene();
  vmCam = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
  vmScene.add(new THREE.HemisphereLight(0xe8eef5, 0x5a5650, 2.4));
  const d = new THREE.DirectionalLight(0xffffff, 1.8);
  d.position.set(1, 2, 1.5);
  vmScene.add(d);
}

/** 캐릭터 glb 의 Weapon 메쉬로 1인칭 총 만들기 */
export function buildViewmodel(gltf) {
  if (gun) { gun.userData.pivot.removeFromParent(); gun = null; tip = null; }
  const weapon = gltf.scene.getObjectByName('Weapon');
  if (!weapon) return;
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
  // 총구 = 축 방향으로 가장 먼 점
  let tipV = pts[0], best = -1e9;
  for (const v of pts) { const t = v.clone().sub(mu).dot(axis); if (t > best) { best = t; tipV = v; } }
  inner.position.copy(mu).negate();
  const aligned = new THREE.Group();
  aligned.quaternion.setFromUnitVectors(axis, new THREE.Vector3(0, 0, 1));
  aligned.add(inner);
  gun = new THREE.Group();
  gun.add(aligned);
  gun.rotation.order = 'YXZ';
  tip = new THREE.Object3D();
  tip.position.copy(tipV).addScaledVector(axis, 0.03);
  inner.add(tip);
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI;   // 총구(+Z)가 카메라 앞(-Z)을 향하게
  pivot.add(gun);
  vmScene.add(pivot);
  gun.userData.pivot = pivot;
}

export function kick() { st.kick = Math.min(1.4, st.kick + 1); }

const _t = new THREE.Vector3();
export function update(dt, p, inp) {
  if (!gun) return;
  const plating = p.plateT > 0;
  st.ads += ((p.aiming ? 1 : 0) - st.ads) * Math.min(1, dt * 14);
  st.low += (((p.reloadT > 0 || plating) ? 1 : 0) - st.low) * Math.min(1, dt * 8);
  st.sprint += ((p.sprinting ? 1 : 0) - st.sprint) * Math.min(1, dt * 8);
  st.kick = Math.max(0, st.kick - dt * 9);
  if (p.moving) st.bobT += dt * (p.sprinting ? 13 : 8.5);
  st.bob += ((p.moving ? 1 : 0) - st.bob) * Math.min(1, dt * 6);
  st.sway.x += ((-inp.dx * 0.0006) - st.sway.x) * Math.min(1, dt * 10);
  st.sway.y += ((inp.dy * 0.0006) - st.sway.y) * Math.min(1, dt * 10);
  const bobAmt = (1 - st.ads * 0.8) * st.bob;
  _t.lerpVectors(HIP, ADS, st.ads);
  _t.x += Math.sin(st.bobT) * 0.012 * bobAmt + st.sway.x + st.sprint * 0.05;
  _t.y += Math.abs(Math.cos(st.bobT)) * 0.012 * bobAmt - st.low * 0.16 + st.sway.y - st.sprint * 0.05;
  _t.z += st.kick * 0.045;
  // pivot 이 180° 돌아가 있으니 x, z 부호 반대
  gun.position.set(-_t.x, _t.y, -_t.z);
  gun.rotation.x = -st.kick * 0.06 + st.low * 0.7;
  gun.rotation.y = -st.sprint * 0.6;
  gun.rotation.z = st.low * 0.35 + st.sprint * 0.3;
  vmCam.fov = G.camera.fov;
  vmCam.aspect = G.camera.aspect;
  vmCam.updateProjectionMatrix();
}

/** 총구 위치(월드 좌표) */
export function muzzleWorld(out) {
  if (!tip) return null;
  gun.userData.pivot.updateMatrixWorld(true);
  tip.getWorldPosition(out);            // vmScene 기준(카메라 = 원점)
  return out.applyMatrix4(G.camera.matrixWorld);
}

export function render(renderer) {
  if (!gun) return;
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(vmScene, vmCam);
  renderer.autoClear = true;
}
export const ready = () => !!gun;
