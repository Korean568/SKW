// ───────────────────────────────────────────────────────────────
//  core.js — 렌더러/씬/카메라, 에셋 로딩, 충돌(BVH) 공통 모듈
// ───────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export { THREE, SkeletonUtils };

// ── 전역 게임 상태 ────────────────────────────────────────────
export const G = {
  renderer: null, scene: null, camera: null,
  time: 0,              // 게임 시간(일시정지 중엔 멈춤)
  mode: 'menu',         // menu | loading | play | dialogue | cutscene | dead | complete
  paused: false,
  colliders: [],        // 충돌 메쉬(벽/바닥/총알)
  groundColliders: [],  // 스폰 위치 계산용(지붕 제외)
  bounds: null,         // {minX,maxX,minZ,maxZ}
  player: null,
  units: [],            // 플레이어 제외 모든 캐릭터(적/아군/배우)
  shooters: new Set(),
  props: new Map(),
  chapter: null, chapterIndex: 0,
  stats: { kills: 0, shots: 0, hits: 0, startTime: 0 },
  settings: { sens: 1, volume: 0.8, quality: 'ultra', invertY: false },
  debug: false,
};

// ── 설정 저장/불러오기 ─────────────────────────────────────────
export function loadSettings() {
  try { Object.assign(G.settings, JSON.parse(localStorage.getItem('skw_settings') || '{}')); } catch (e) {}
}
export function saveSettings() {
  try { localStorage.setItem('skw_settings', JSON.stringify(G.settings)); } catch (e) {}
}

// ── 렌더러 ───────────────────────────────────────────────────
export function initRenderer(canvasParent) {
  const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasParent.appendChild(r.domElement);
  G.renderer = r;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 900);
  applyQuality();
  addEventListener('resize', onResize);
  onResize();
  return r;
}
export function applyQuality() {
  const q = G.settings.quality;
  if (!['ultra', 'high', 'low'].includes(q)) G.settings.quality = 'ultra';
  G.renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'low' ? 1 : 2));
  G.renderer.shadowMap.enabled = q !== 'low';
  G.onQuality && G.onQuality();
  G.scene && G.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
}
function onResize() {
  G.renderer.setSize(innerWidth, innerHeight);
  G.camera.aspect = innerWidth / innerHeight;
  G.camera.updateProjectionMatrix();
}

// ── 에셋 로딩 (캐시) ─────────────────────────────────────────
const loader = new GLTFLoader();
const cache = new Map();
export function loadGLB(url, onProgress) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((res, rej) => {
      // 아티팩트 버전은 .glb 대신 같은 내용의 .gltf.json 을 씀
      const real = window.SKW_JSON_ASSETS ? url.replace(/\.glb$/, '.gltf.json') : url;
      loader.load(encodeURI(real), res, e => onProgress && onProgress(e.loaded, e.total), err => {
        cache.delete(url);
        rej(new Error('파일을 불러오지 못했습니다: ' + url));
      });
    }));
  } else if (onProgress) {
    cache.get(url).then(() => onProgress(1, 1));
  }
  return cache.get(url);
}

/** 여러 파일을 불러오며 진행률(0~1)을 알려줌 */
export async function loadAll(urls, onProgress) {
  const prog = new Map(urls.map(u => [u, [0, 1]]));
  const report = () => {
    let a = 0, b = 0;
    for (const [l, t] of prog.values()) { a += Math.min(l, t); b += t || 1; }
    onProgress && onProgress(b ? a / b : 1);
  };
  const out = await Promise.all(urls.map(u => loadGLB(u, (l, t) => { prog.set(u, [l, t || l || 1]); report(); })));
  onProgress && onProgress(1);
  return out;
}

// ── 충돌 ─────────────────────────────────────────────────────
const colMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });

/** 렌더 메쉬 → 양면 충돌 메쉬(같은 지오메트리, BVH 공유) */
export function makeCollider(mesh) {
  const g = mesh.geometry;
  if (!g.boundsTree) g.computeBoundsTree();
  const c = new THREE.Mesh(g, colMat);
  c.matrixAutoUpdate = false;
  c.userData.source = mesh;
  mesh.updateWorldMatrix(true, false);
  c.matrixWorld.copy(mesh.matrixWorld);
  return c;
}
export function syncCollider(c) {
  c.userData.source.updateWorldMatrix(true, false);
  c.matrixWorld.copy(c.userData.source.matrixWorld);
}

const _ray = new THREE.Raycaster();
_ray.firstHitOnly = true;
const _n = new THREE.Vector3();

/** 첫 충돌 지점 반환 {point, distance, normal(world)} 또는 null */
export function raycast(origin, dir, far, list = G.colliders) {
  _ray.set(origin, dir);
  _ray.near = 0; _ray.far = far;
  const hits = _ray.intersectObjects(list, false);
  if (!hits.length) return null;
  const h = hits[0];
  if (h.face) {
    _n.copy(h.face.normal).transformDirection(h.object.matrixWorld);
    h.normal = _n.clone();
  } else h.normal = new THREE.Vector3(0, 1, 0);
  return h;
}

const _down = new THREE.Vector3(0, -1, 0);
const _o = new THREE.Vector3();
/** (x,z)에서 fromY 아래로 바닥 높이 */
export function groundAt(x, z, fromY, far = 80, list = G.colliders) {
  _o.set(x, fromY, z);
  const h = raycast(_o, _down, far, list);
  return h ? h.point.y : null;
}

/** 스폰용 바닥: 지붕(Ceiling) 빼고 위에서 아래로 */
export function spawnGround(x, z) {
  let y = groundAt(x, z, 2.0, 30, G.groundColliders);   // 실내 천장에 걸리지 않게 낮은 곳에서
  if (y == null) y = groundAt(x, z, 30, 60, G.groundColliders);
  return y == null ? 0 : y;
}

/** 높이 y 근처의 바닥 (지하 실내 등) */
export function groundNear(x, z, y) {
  const g = groundAt(x, z, y + 1.5, 6);
  return g == null ? y : g;
}

/** 시야 확인: a→b 사이 막힘 없으면 true */
const _d = new THREE.Vector3();
export function lineOfSight(a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  if (len < 0.01) return true;
  _d.divideScalar(len);
  const h = raycast(a, _d, len - 0.05);
  return !h;
}

// ── 캐릭터 이동 + 벽 충돌(슬라이드) ───────────────────────────
const H_RAYS = [0.55, 1.05, 1.55];
const _dir = new THREE.Vector3();
const _org = new THREE.Vector3();
const _hn = new THREE.Vector3();
const PUSH_DIRS = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.sin(i * Math.PI / 4), 0, Math.cos(i * Math.PI / 4)));

export function moveWithCollision(pos, dx, dz, R = 0.35) {
  let len = Math.hypot(dx, dz);
  if (len > 1e-6) {
    _dir.set(dx / len, 0, dz / len);
    for (let iter = 0; iter < 3 && len > 1e-5; iter++) {
      let best = null;
      for (const h of H_RAYS) {
        _org.set(pos.x, pos.y + h, pos.z);
        const hit = raycast(_org, _dir, len + R);
        if (hit && Math.abs(hit.normal.y) < 0.7 && (!best || hit.distance < best.distance)) best = hit;
      }
      if (!best) { pos.x += _dir.x * len; pos.z += _dir.z * len; break; }
      const allowed = Math.max(0, Math.min(len, best.distance - R));
      pos.x += _dir.x * allowed; pos.z += _dir.z * allowed;
      const rem = len - allowed;
      _hn.set(best.normal.x, 0, best.normal.z);
      if (_hn.lengthSq() < 1e-6) break;
      _hn.normalize();
      if (_hn.dot(_dir) > 0) _hn.negate();
      const sx = _dir.x * rem, sz = _dir.z * rem;
      const d = sx * _hn.x + sz * _hn.z;
      const nx = sx - _hn.x * d, nz = sz - _hn.z * d;
      len = Math.hypot(nx, nz);
      if (len < 1e-5) break;
      _dir.set(nx / len, 0, nz / len);
    }
  }
  // 벽에 파묻히지 않게 밀어내기
  _org.set(pos.x, pos.y + 1.0, pos.z);
  for (const d of PUSH_DIRS) {
    const hit = raycast(_org, d, R);
    if (hit && Math.abs(hit.normal.y) < 0.7) {
      const push = R - hit.distance;
      pos.x -= d.x * push; pos.z -= d.z * push;
      _org.set(pos.x, pos.y + 1.0, pos.z);
    }
  }
  clampBounds(pos);
}

export function clampBounds(pos) {
  const b = G.bounds;
  if (!b) return;
  pos.x = Math.min(b.maxX, Math.max(b.minX, pos.x));
  pos.z = Math.min(b.maxZ, Math.max(b.minZ, pos.z));
}

/** 중력/계단 처리. unit = {pos, vy} */
export function applyGravity(u, dt, step = 0.6) {
  const g = groundAt(u.pos.x, u.pos.z, u.pos.y + step, 60);
  const gy = g == null ? -50 : g;
  if (u.pos.y <= gy + 0.02 && u.vy <= 0) { u.pos.y = gy; u.vy = 0; u.grounded = true; }
  else {
    u.vy -= 22 * dt;
    u.pos.y += u.vy * dt;
    if (u.pos.y < gy) { u.pos.y = gy; u.vy = 0; u.grounded = true; } else u.grounded = false;
  }
  if (u.pos.y < -200) u.pos.y = 0;
}

// ── 유틸 ─────────────────────────────────────────────────────
export const DEG = Math.PI / 180;
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * Math.min(1, t);
}
export function angleDiff(a, b) {
  return ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}
export function yawTo(from, to) { return Math.atan2(to.x - from.x, to.z - from.z); }
