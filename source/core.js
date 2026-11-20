'use strict';
/* ═════════ CORE — 수학 · WebGPU 초기화 · 품질 프리셋 · 프레임 그래프 ═════════ */
const G = { mods: {}, order: [], errors: [], params: new URLSearchParams(location.search), time: 0, dt: 0, frame: 0, fps: 60, keys: {}, lights: [], modelData: {} };
window.G = G;
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
};
const M4 = { // 열 우선(column-major) Float32Array(16) — WGSL mat4x4f 와 동일
  ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  },
  persp(fovy, aspect, near) { // reversed-Z · 무한 원평면: ndc.z = near/거리 (가까울수록 1)
    const f = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = f / aspect; o[5] = f; o[11] = -1; o[14] = near; return o;
  },
  ortho(l, r, b, t, n, f) { // 표준 z 0..1 (그림자 맵용)
    const o = new Float32Array(16);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -1 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -n / (f - n); o[15] = 1; return o;
  },
  lookAt(e, t, up) {
    const z = V3.norm(V3.sub(e, t)), x = V3.norm(V3.cross(up, z)), y = V3.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V3.dot(x, e), -V3.dot(y, e), -V3.dot(z, e), 1]);
  },
  invert(m) {
    const o = new Float32Array(16), a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
      a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15],
      b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32,
      d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
    return o;
  },
  // 모델 행렬 = T·Ry(yaw)·Rx(-pitch)·Rz(roll)·S.  모델 규약: 전방 +Z, 위 +Y, 좌현 +X.
  // 전방 벡터 = (sin yaw·cos pitch, sin pitch, cos yaw·cos pitch), roll>0 이면 우현으로 기울어짐.
  trs(p, yaw = 0, pitch = 0, roll = 0, s = 1) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    return new Float32Array([
      (cr * cy - sr * sp * sy) * s, sr * cp * s, (-cr * sy - sr * sp * cy) * s, 0,
      (-sr * cy - cr * sp * sy) * s, cr * cp * s, (sr * sy - cr * sp * cy) * s, 0,
      cp * sy * s, sp * s, cp * cy * s, 0, p[0], p[1], p[2], 1]);
  },
  fromDir(p, d, roll = 0, s = 1) { return M4.trs(p, Math.atan2(d[0], d[2]), Math.atan2(d[1], Math.hypot(d[0], d[2])), roll, s); },
  point: (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]],
};
G.clamp = (x, a, b) => Math.min(b, Math.max(a, x));
G.lerp = (a, b, t) => a + (b - a) * t;
G.rng = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
G.err = m => { m = String(m); if (G.errors.length < 40 && !G.errors.includes(m)) { G.errors.push(m); console.error('[SKW]', m); } };
G.register = (name, mod) => { G.mods[name] = mod; G.order.push(mod); return mod; };
G.ui = document.getElementById('ui');
G.el = (tag, props = {}, parent = G.ui) => { const e = document.createElement(tag); Object.assign(e, props); parent.appendChild(e); return e; };
G.css = t => { G.el('style', { textContent: t }, document.head); };
G.fatal = (title, html) => {
  G.dead = true; console.error('[SKW fatal]', title);
  (document.getElementById('fatal') || G.el('div', { id: 'fatal' }, document.body)).innerHTML = `<div><h1>${title}</h1>${html}</div>`;
};

/* ───────── 품질 프리셋 ───────── */
G.HDR = 'rgba16float'; G.DEPTH = 'depth32float';
G.PRESETS = {
  LOW: { name: 'LOW', level: 0, scale: .75, dprCap: 1, maxPx: 1.4e6, particles: 500, ocean: 0, clouds: 0, shadows: 0, bloom: 0, refract: 0, shadowRes: 0, msaa: 1 },
  MEDIUM: { name: 'MEDIUM', level: 1, scale: 1, dprCap: 1.5, maxPx: 2.4e6, particles: 3000, ocean: 1, clouds: 1, shadows: 0, bloom: 1, refract: 0, shadowRes: 0, msaa: 4 },
  HIGH: { name: 'HIGH', level: 2, scale: 1, dprCap: 2, maxPx: 4.2e6, particles: 12000, ocean: 2, clouds: 2, shadows: 1, bloom: 1, refract: 1, shadowRes: 4096, msaa: 4 },
};
/* ───────── 환경(태양·바람·파도) ───────── */
G.env = { sunAz: 40, sunEl: 26, cloud: .45, haze: .35, sea: .55, windDir: .6, windSpd: 9, fogDen: 1 / 9000, exposure: 1 };
G.sun = { dir: [0, 1, 0], col: [3, 3, 3] };
G.waves = new Float32Array(48); // 6개 거스트너 파: [dirx,dirz,진폭,k, ω,가파름Q,위상,0]
G.setEnv = (o = {}) => {
  const e = Object.assign(G.env, o), az = e.sunAz * Math.PI / 180, el = e.sunEl * Math.PI / 180, k = G.clamp(e.sunEl / 35, 0, 1), up = G.clamp(e.sunEl / 4 + .5, 0, 1);
  G.sun.dir = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  G.sun.col = [G.lerp(2.4, 3.3, k) * up, G.lerp(1.25, 3.1, k) * up, G.lerp(.55, 2.8, k) * up];
  const L = [150, 97, 61, 37, 23, 13], sp = [0, .38, -.45, .8, -.95, 1.35];
  for (let i = 0; i < 6; i++) {
    const kk = 2 * Math.PI / L[i], amp = e.sea * L[i] * .011 * (i < 2 ? 1 : .8), d = e.windDir + sp[i];
    G.waves.set([Math.sin(d), Math.cos(d), amp, kk, Math.sqrt(9.81 * kk), amp > 0 ? .62 / (kk * amp * 6) : 0, i * 1.7, 0], i * 8);
  }
};
G.waveAt = (x, z, t = G.time) => { // 월드 (x,z) 의 수면 높이 (셰이더 gerstner 와 일치, 수평 변위 1회 보정)
  let px = x, pz = z, h = 0; const w = G.waves;
  for (let it = 0; it < 2; it++) {
    let dx = 0, dz = 0; h = 0;
    for (let o = 0; o < 48; o += 8) {
      const th = w[o + 3] * (w[o] * px + w[o + 1] * pz) - w[o + 4] * t + w[o + 6], c = Math.cos(th) * w[o + 5] * w[o + 2];
      dx += w[o] * c; dz += w[o + 1] * c; h += w[o + 2] * Math.sin(th);
    }
    px = x - dx; pz = z - dz;
  }
  return h;
};
// 구름 그림자 맵 등록 (sky 모듈): view = 텍스처 뷰(없애려면 null), (x,z) = 맵 중심, size = 한 변 길이(m). 뷰가 바뀔 때만 호출, 중심 이동은 G.cloudMap.x/z 를 직접 갱신
G.cloudMap = { view: null, x: 0, z: 0, size: 16000 };
G.setCloudMap = (view, size = 16000) => { G.cloudMap.view = view; G.cloudMap.size = size; G.bindGlobals && G.bindGlobals(); };
G.addLight = (pos, rgb, intensity = 30, radius = 400, life = .4) => { G.lights.push({ pos: [...pos], rgb, intensity, radius, life, max: life }); };

/* ───────── 공용 WGSL (모든 씬 셰이더 앞에 붙음) ───────── */
G.WGSL = /* wgsl */`
struct Globals {
  viewProj: mat4x4f,     // 월드→클립 (reversed-Z, 무한 원평면)
  invViewProj: mat4x4f,  // 클립→(카메라 기준 상대 월드). worldAt()/viewRay() 로만 사용
  shadowVP: mat4x4f,     // 월드→그림자 맵 클립 (표준 z 0..1)
  cam: vec4f,            // xyz 카메라 위치, w 시간(초)
  sun: vec4f,            // xyz 태양 방향(지표→태양, 단위), w 품질 0 LOW·1 MEDIUM·2 HIGH
  sunCol: vec4f,         // rgb 태양광(HDR), w 그림자 사용 0/1
  res: vec4f,            // 렌더 타깃 w,h,1/w,1/h
  fog: vec4f,            // x 안개 밀도(/m), y 구름량 0..1, z 연무 0..1, w 해상 상태 0..1
  wind: vec4f,           // xy 바람 방향(xz 평면, 단위), z 풍속 m/s
  misc: vec4f,           // x near, y dt, z 프레임, w 노출
  waves: array<vec4f, 12>, // 파 i: [2i]=(dirx,dirz,진폭,k) [2i+1]=(ω,Q,위상,0)
  lights: array<vec4f, 8>, // 점광 i: [2i]=(pos,반경) [2i+1]=(rgb*세기,0)
  cmap: vec4f,           // 구름 그림자 맵: xy 중심(월드 xz), z 1/한 변 길이(m), w 사용 0/1
};
@group(0) @binding(0) var<uniform> g: Globals;
@group(0) @binding(1) var shadowTex: texture_depth_2d;
@group(0) @binding(2) var shadowSamp: sampler_comparison;
@group(0) @binding(3) var noiseTex: texture_2d<f32>;   // 256² RGBA 백색 잡음 (반복)
@group(0) @binding(4) var linSamp: sampler;            // linear · repeat
@group(0) @binding(5) var cloudTex: texture_2d<f32>;   // 구름 그림자 맵 (r = 지표에 닿는 햇빛 비율). sky 모듈이 G.setCloudMap 으로 등록
const PI = 3.14159265;
struct FSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vsFull(@builtin(vertex_index) i: u32) -> FSOut { // 전체 화면 삼각형 (z=0 → 원평면)
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return FSOut(vec4f(p * 2.0 - 1.0, 0.0, 1.0), vec2f(p.x, 1.0 - p.y));
}
fn hash21(p: vec2f) -> f32 { var q = fract(p * vec2f(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }
fn hash33(p: vec3f) -> vec3f { var q = fract(p * vec3f(.1031, .1030, .0973)); q += dot(q, q.yxz + 33.33); return fract((q.xxy + q.yxx) * q.zyx); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2f(1, 0)), u.x), mix(hash21(i + vec2f(0, 1)), hash21(i + vec2f(1, 1)), u.x), u.y);
}
fn fbm(p0: vec2f, oct: i32) -> f32 {
  var p = p0; var a = .5; var s = 0.0;
  for (var i = 0; i < oct; i++) { s += a * vnoise(p); p = mat2x2f(1.6, 1.2, -1.2, 1.6) * p; a *= .5; }
  return s;
}
fn worldAt(uv: vec2f, depth: f32) -> vec3f { // uv 0..1(y 아래), depth = reversed-Z 깊이(>0)
  let q = g.invViewProj * vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, depth, 1.0);
  return g.cam.xyz + q.xyz / q.w;
}
fn viewRay(uv: vec2f) -> vec3f { // 카메라→픽셀 방향(단위)
  let q = g.invViewProj * vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 1.0, 1.0);
  return normalize(q.xyz / q.w);
}
fn skyBase(rd: vec3f) -> vec3f { // 구름·태양 원반 없는 대기 색 (HDR 선형). 반사·환경광·안개 공용
  let s = g.sun.xyz; let mu = max(dot(rd, s), 0.0); let h = max(rd.y, 0.0);
  let day = smoothstep(-.12, .25, s.y); let gold = smoothstep(.0, .42, s.y);
  let zen = mix(vec3f(.012, .02, .05), vec3f(.07, .2, .52), day);
  let hor = mix(vec3f(.62, .3, .14), vec3f(.5, .64, .8), gold) * mix(.2, 1.0, day);
  var c = mix(hor, zen, pow(h, .42));
  let warm = mix(vec3f(1.0, .42, .13), vec3f(1.0, .86, .68), gold);
  c += warm * (pow(mu, 6.0) * .22 + pow(mu, 48.0) * .5 + pow(mu, 400.0) * 1.5) * (.25 + .75 * day);
  return mix(c, hor * 1.04, g.fog.z * exp(-h * 7.0));
}
fn fogAt(col: vec3f, P: vec3f) -> vec3f { // 대기 원근: 채널별 소광(파랑이 먼저 사라짐) + 높이 감쇠. 모든 불투명·수면 셰이더의 마지막 단계
  let v = P - g.cam.xyz; let d = length(v); let rd = v / max(d, 1e-3);
  let dy = rd.y * d / 1200.0; // 대기 규모 높이 1200m
  let hf = exp(-max(g.cam.y, 0.0) / 1200.0) * select((1.0 - exp(-dy)) / dy, 1.0 - dy * .5, abs(dy) < 1e-3);
  let T = exp(-g.fog.x * (1.0 + 2.0 * g.fog.z) * d * hf * vec3f(.8, 1.0, 1.3));
  return min(col * T + skyBase(normalize(vec3f(rd.x, abs(rd.y) * .25 + .015, rd.z))) * (1.0 - T), vec3f(40.0));
}
fn shadowAt(P: vec3f, N: vec3f) -> f32 { // 1 = 햇빛, 0 = 그림자 (3x3 PCF, 깊이 범위 900m)
  if (g.sunCol.w < .5) { return 1.0; }
  let q = g.shadowVP * vec4f(P + N * .3, 1.0);
  let uv = q.xy * vec2f(.5, -.5) + .5;
  let e = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
  if (e <= 0.0 || q.z > 1.0) { return 1.0; }
  let ts = 1.4 / f32(textureDimensions(shadowTex).x); var s = 0.0;
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    s += textureSampleCompareLevel(shadowTex, shadowSamp, uv + vec2f(f32(x), f32(y)) * ts, q.z - .0005);
  } }
  return mix(1.0, s / 9.0, smoothstep(0.0, .06, e)); // 맵 가장자리에서 서서히 사라짐
}
fn cloudVis(P: vec3f) -> f32 { // 구름 그림자: 1 = 햇빛, 0 = 완전 그늘 (맵이 없으면 1)
  if (g.cmap.w < .5) { return 1.0; }
  // 태양이 낮으면 그림자가 수 km 로 늘어져 흐려짐 → 구름량에 따른 평균 밝기로 수렴 (해 질 녘 윤슬이 조각나지 않게)
  return mix(1.0 - .45 * g.fog.y, textureSampleLevel(cloudTex, linSamp, (P.xz - g.cmap.xy) * g.cmap.z + .5, 0.0).r, saturate(g.sun.y * 6.0 - .4));
}
fn gerstner(p: vec2f, t: f32) -> vec3f { // 기준 수면 변위 (JS G.waveAt 과 동일한 6파)
  var d = vec3f(0.0);
  for (var i = 0; i < 6; i++) {
    let a = g.waves[i * 2]; let b = g.waves[i * 2 + 1];
    let th = a.w * dot(a.xy, p) - b.x * t + b.z; let c = cos(th) * b.y * a.z;
    d += vec3f(a.x * c, a.z * sin(th), a.y * c);
  }
  return d;
}
fn pointLights(P: vec3f, N: vec3f) -> vec3f { // 폭발 섬광 등 동적 점광 4개
  var c = vec3f(0.0);
  for (var i = 0; i < 4; i++) {
    let l = g.lights[i * 2]; if (l.w <= 0.0) { continue; }
    let v = l.xyz - P; let d = length(v); let a = max(1.0 - d / l.w, 0.0);
    c += g.lights[i * 2 + 1].rgb * a * a * max(dot(N, v / max(d, 1e-3)), 0.0);
  }
  return c;
}
`;
G.WGSL_LINES = G.WGSL.split('\n').length - 1;
G.shader = (code, label = 'shader', common = true) => {
  const m = G.dev.createShaderModule({ label, code: (common ? G.WGSL : '') + code });
  m.getCompilationInfo().then(i => { for (const x of i.messages) if (x.type === 'error') G.err(`[WGSL ${label}] L${x.lineNum - (common ? G.WGSL_LINES : 0)}: ${x.message}`); }, () => { });
  return m;
};
G.layout = (...bgls) => G.dev.createPipelineLayout({ bindGroupLayouts: [G.bgl0, ...bgls] });

/* ───────── 렌더 타깃 / 품질 전환 ───────── */
G.targets = {};
const hook = (h, ...a) => { for (const m of G.order) if (m[h]) m[h](...a); };
G.dyn = 1; // 동적 해상도 배율 (gpu 모듈이 GPU 시간에 맞춰 0.5~1 로 조절)
G.resize = quiet => {
  const dev = G.dev, Q = G.Q, T = G.targets, cv = G.canvas, dpr = Math.min(devicePixelRatio || 1, Q.dprCap);
  const cw = Math.max(16, Math.round(innerWidth * dpr)), ch = Math.max(16, Math.round(innerHeight * dpr));
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  const s = Math.min(Q.scale, Math.sqrt(Q.maxPx / (cw * ch))) * G.dyn;
  const w = Math.max(16, Math.round(cw * s) & ~1), h = Math.max(16, Math.round(ch * s) & ~1);
  for (const k of ['hdr', 'depth', 'hdrCopy', 'depthCopy', 'ms', 'msDepth']) { T[k] && T[k].destroy(); T[k] = null; }
  const U = GPUTextureUsage, RT = U.RENDER_ATTACHMENT | U.TEXTURE_BINDING, mk = (format, usage, sampleCount = 1) => dev.createTexture({ size: [w, h], format, usage, sampleCount });
  T.w = w; T.h = h; T.cw = cw; T.ch = ch;
  // hdr/depth: 단일 샘플 최종 장면(색·깊이) — 후처리가 읽음. MSAA 프리셋에서는 ms/msDepth 에 그린 뒤 여기로 리졸브.
  T.hdr = mk(G.HDR, RT | U.COPY_SRC); T.hdrView = T.hdr.createView();
  T.depth = mk(G.DEPTH, RT | U.COPY_SRC); T.depthView = T.depth.createView();
  T.sceneView = T.hdrView; T.sceneDepthView = T.depthView;
  if (Q.msaa > 1) {
    T.ms = mk(G.HDR, U.RENDER_ATTACHMENT, Q.msaa); T.sceneView = T.ms.createView();
    T.msDepth = mk(G.DEPTH, RT, Q.msaa); T.sceneDepthView = T.msDepth.createView();
    G.bgDR = dev.createBindGroup({ layout: G.pipeDR.getBindGroupLayout(0), entries: [{ binding: 0, resource: T.sceneDepthView }] });
  }
  T.hdrCopyView = G.dummyView; T.depthCopyView = G.dummyDepthView;
  if (Q.refract) { // HIGH: 불투명 패스 결과 사본 (수면 굴절·깊이 기반 효과용)
    T.hdrCopy = mk(G.HDR, RT | U.COPY_DST); T.hdrCopyView = T.hdrCopy.createView();
    T.depthCopy = mk(G.DEPTH, RT | U.COPY_DST); T.depthCopyView = T.depthCopy.createView();
  }
  if (G.params.has('step')) { G.test.tex && G.test.tex.destroy(); G.test.tex = dev.createTexture({ size: [cw, ch], format: G.fmt, usage: U.RENDER_ATTACHMENT | U.COPY_SRC }); }
  if (G.ready && !quiet) hook('onResize');
};
G.setQuality = (name, manual) => {
  const dev = G.dev, Q = G.Q = G.PRESETS[name] || G.PRESETS.MEDIUM; G.qManual = !!manual;
  G.shadowTex && G.shadowTex.destroy(); G.shadowTex = null;
  if (Q.shadows) G.shadowTex = dev.createTexture({ size: [Q.shadowRes, Q.shadowRes], format: G.DEPTH, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
  G.shadowView = G.shadowTex ? G.shadowTex.createView() : null;
  G.bindGlobals = () => {
  const bg = sv => dev.createBindGroup({ layout: G.bgl0, entries: [{ binding: 0, resource: { buffer: G.globalsBuf } }, { binding: 1, resource: sv }, { binding: 2, resource: G.shadowSamp }, { binding: 3, resource: G.noiseView }, { binding: 4, resource: G.linSamp }, { binding: 5, resource: G.cloudMap.view || G.dummyView }] });
  G.bg0 = bg(G.shadowView || G.dummyDepthView); // 일반 패스용
  G.bg0s = bg(G.dummyDepthView);                // 그림자 패스용 (그림자 맵 미바인딩)
  }; G.bindGlobals();
  G.resize(1);
  if (G.ready) { hook('onQuality', Q); hook('onResize'); }
};

/* ───────── 카메라 / 전역 유니폼 ───────── */
G.cam = { pos: [0, 40, -200], target: [0, 10, 0], up: [0, 1, 0], fov: 50 * Math.PI / 180, near: 1 };
G.shadowFocus = [0, 0, 0]; G.shadowRange = 240;
const GF = new Float32Array(160);
function writeGlobals() {
  const c = G.cam, T = G.targets, Q = G.Q, e = G.env;
  c.view = M4.lookAt(c.pos, c.target, c.up); c.proj = M4.persp(c.fov, T.w / T.h, c.near);
  c.viewProj = M4.mul(c.proj, c.view);
  const vr = new Float32Array(c.view); vr[12] = vr[13] = vr[14] = 0;
  GF.set(c.viewProj, 0); GF.set(M4.invert(M4.mul(c.proj, vr)), 16);
  if (Q.shadows) { // 태양 방향 직교 투영, 텍셀 단위 스냅으로 떨림 방지
    const sd = G.sun.dir, R = G.shadowRange, up = Math.abs(sd[1]) > .98 ? [0, 0, 1] : [0, 1, 0];
    const lz = V3.norm(sd), lx = V3.norm(V3.cross(up, lz)), ly = V3.cross(lz, lx), tx = 2 * R / Q.shadowRes;
    const fx = Math.round(V3.dot(G.shadowFocus, lx) / tx) * tx, fy = Math.round(V3.dot(G.shadowFocus, ly) / tx) * tx, fz = V3.dot(G.shadowFocus, lz);
    const f = V3.add(V3.add(V3.mul(lx, fx), V3.mul(ly, fy)), V3.mul(lz, fz));
    G.shadowVP = M4.mul(M4.ortho(-R, R, -R, R, 1, 900), M4.lookAt(V3.add(f, V3.mul(lz, 450)), f, up));
    GF.set(G.shadowVP, 32);
  }
  GF.set([c.pos[0], c.pos[1], c.pos[2], G.time, ...G.sun.dir, Q.level, ...G.sun.col, Q.shadows, T.w, T.h, 1 / T.w, 1 / T.h,
    e.fogDen, e.cloud, e.haze, e.sea, Math.sin(e.windDir), Math.cos(e.windDir), e.windSpd, 0, c.near, G.dt, G.frame, e.exposure], 48);
  GF.set(G.waves, 76);
  G.lights = G.lights.filter(l => (l.life -= G.dt) > 0);
  G.lights.sort((a, b) => b.intensity * b.life / b.max - a.intensity * a.life / a.max);
  for (let i = 0; i < 4; i++) {
    const l = G.lights[i], o = 124 + i * 8;
    if (!l) { GF.fill(0, o, o + 8); continue; }
    const k = l.intensity * (l.life / l.max) ** 2;
    GF.set([l.pos[0], l.pos[1], l.pos[2], l.radius, l.rgb[0] * k, l.rgb[1] * k, l.rgb[2] * k, 0], o);
  }
  const cm = G.cloudMap; GF[156] = cm.x; GF[157] = cm.z; GF[158] = 1 / cm.size; GF[159] = cm.view ? 1 : 0;
  G.dev.queue.writeBuffer(G.globalsBuf, 0, GF);
}
G.project = p => { // 월드 → 화면(CSS px). 반환 [x, y, w]; w<=0 이면 카메라 뒤
  const m = G.cam.viewProj; if (!m) return [0, 0, -1];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [((m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w * .5 + .5) * innerWidth, (.5 - (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w * .5) * innerHeight, w];
};

/* ───────── 프레임 ───────── */
const depthResolve = (enc, view) => { // MSAA 깊이 → 단일 샘플 깊이 (샘플 0)
  const p = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' } });
  p.setPipeline(G.pipeDR); p.setBindGroup(0, G.bgDR); p.draw(3); p.end();
};
let tsBusy = 0;
G.gpuMs = 0; // GPU 프레임 시간(ms, 평활) — timestamp-query 지원 시에만 갱신
G.tick = dt => {
  if (G.dead) return;
  const dev = G.dev, T = G.targets, Q = G.Q, ms = Q.msaa > 1, ts = G.ts;
  G.dt = dt; G.time += dt; G.frame++;
  hook('update', dt); writeGlobals(); hook('prepare');
  const enc = dev.createCommandEncoder();
  if (ts) enc.beginComputePass({ timestampWrites: { querySet: ts.qs, beginningOfPassWriteIndex: 0 } }).end();
  hook('compute', enc);
  if (Q.shadows) {
    const p = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: G.shadowView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    p.setBindGroup(0, G.bg0s); hook('shadow', p); p.end();
  }
  let p = enc.beginRenderPass({ // A: 불투명 + 하늘
    colorAttachments: [{ view: T.sceneView, resolveTarget: ms && Q.refract ? T.hdrCopyView : undefined, clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' }],
    depthStencilAttachment: { view: T.sceneDepthView, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' }
  });
  p.setBindGroup(0, G.bg0); hook('opaque', p); hook('sky', p); p.end();
  if (Q.refract) {
    if (ms) depthResolve(enc, T.depthCopyView);
    else { enc.copyTextureToTexture({ texture: T.hdr }, { texture: T.hdrCopy }, [T.w, T.h]); enc.copyTextureToTexture({ texture: T.depth }, { texture: T.depthCopy }, [T.w, T.h]); }
  }
  p = enc.beginRenderPass({ // B: 수면 + 반투명(파티클)
    colorAttachments: [{ view: T.sceneView, resolveTarget: ms ? T.hdrView : undefined, loadOp: 'load', storeOp: 'store' }],
    depthStencilAttachment: { view: T.sceneDepthView, depthLoadOp: 'load', depthStoreOp: 'store' }
  });
  p.setBindGroup(0, G.bg0); hook('water', p); hook('transparent', p); p.end();
  if (ms) depthResolve(enc, T.depthView);
  G.mods.post.run(enc, G.test.tex ? G.test.tex.createView() : G.ctx.getCurrentTexture().createView());
  if (ts) {
    enc.beginComputePass({ timestampWrites: { querySet: ts.qs, endOfPassWriteIndex: 1 } }).end();
    if (!tsBusy) { enc.resolveQuerySet(ts.qs, 0, 2, ts.buf, 0); enc.copyBufferToBuffer(ts.buf, 0, ts.rb, 0, 16); }
  }
  dev.queue.submit([enc.finish()]);
  if (ts && !tsBusy) {
    tsBusy = 1;
    ts.rb.mapAsync(GPUMapMode.READ).then(() => {
      const a = new BigInt64Array(ts.rb.getMappedRange()), m = Number(a[1] - a[0]) / 1e6; ts.rb.unmap(); tsBusy = 0;
      if (m > 0 && m < 500) G.gpuMs += (m - G.gpuMs) * (G.gpuMs ? .1 : 1);
    }, () => { tsBusy = 0; });
  }
};
/* 검증용(?step): 루프 대신 G.test.run(n, dt) 로 결정적 스텝 → 오프스크린 결과를 읽어 2D 캔버스에 표시(헤드리스 캡처 가능) */
G.test = {
  async run(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) G.tick(dt); await G.test.snap(); return G.errors; },
  async snap() {
    const dev = G.dev, w = G.targets.cw, h = G.targets.ch, bpr = Math.ceil(w * 4 / 256) * 256;
    const buf = dev.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), enc = dev.createCommandEncoder();
    enc.copyTextureToBuffer({ texture: G.test.tex }, { buffer: buf, bytesPerRow: bpr }, [w, h]); dev.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const src = new Uint8Array(buf.getMappedRange()), cv = G.test.cv || (G.test.cv = document.body.insertBefore(Object.assign(document.createElement('canvas'), { id: 'snap' }), G.ui));
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%'; cv.width = w; cv.height = h;
    const x = cv.getContext('2d'), im = x.createImageData(w, h), d = im.data, bgr = G.fmt.startsWith('bgra');
    for (let y = 0; y < h; y++) for (let i = 0, o = y * bpr, q = y * w * 4; i < w * 4; i += 4) { d[q + i] = src[o + i + (bgr ? 2 : 0)]; d[q + i + 1] = src[o + i + 1]; d[q + i + 2] = src[o + i + (bgr ? 0 : 2)]; d[q + i + 3] = 255; }
    x.putImageData(im, 0, 0); buf.unmap(); buf.destroy();
  }
};

/* ───────── 부트 ───────── */
G.boot = async () => {
  const tip = `<p>이 게임은 <b>WebGPU</b> 로 동작합니다. 아래를 확인해 주세요.</p><ul>
<li>PC: <b>Chrome / Edge 113 이상</b> 최신 버전 (Windows · macOS · ChromeOS)</li><li>Safari 26 이상, Firefox 141 이상(Windows), Android Chrome 121 이상</li>
<li>브라우저 설정에서 <b>하드웨어 가속</b>(그래픽 가속) 켜기 → 브라우저 재시작</li><li>그래픽 드라이버 최신 업데이트, 주소창 <code>chrome://gpu</code> 에서 WebGPU 상태 확인</li>
<li>Linux Chrome 은 <code>chrome://flags/#enable-unsafe-webgpu</code> 활성화 필요</li></ul>`;
  try {
    if (!navigator.gpu || G.params.has('nogpu'))
      return G.fatal('WebGPU 를 사용할 수 없습니다', (isSecureContext ? '' : '<p><b>보안 연결(https 또는 localhost)</b>에서만 WebGPU 가 켜집니다.</p>') + tip);
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }) || await navigator.gpu.requestAdapter();
    if (!adapter) return G.fatal('사용 가능한 GPU 어댑터가 없습니다', tip);
    const hasTS = adapter.features.has('timestamp-query');
    const dev = G.dev = await adapter.requestDevice({ requiredFeatures: hasTS ? ['timestamp-query'] : [] }); G.adapter = adapter;
    dev.addEventListener('uncapturederror', e => G.err('[GPU] ' + e.error.message));
    dev.lost.then(i => { // 드라이버 재시작·절전 복귀 등으로 장치를 잃으면 한 번은 자동으로 새로고침 (30초 안에 또 끊기면 안내만 표시)
      if (i.reason === 'destroyed') return;
      G.fatal('GPU 장치 연결이 끊어졌습니다', `<p>${i.message || ''}</p><p>페이지를 새로고침(F5) 해 주세요.</p>`);
      const t = Date.now(), go = () => { if (!document.hidden) { sessionStorage.skw_r = t; location.reload(); } };
      try { if (!(t - sessionStorage.skw_r < 3e4)) { go(); addEventListener('visibilitychange', go); } } catch (e) { }
    });
    const cv = G.canvas = document.getElementById('c'); G.ctx = cv.getContext('webgpu'); G.fmt = navigator.gpu.getPreferredCanvasFormat();
    G.ctx.configure({ device: dev, format: G.fmt, alphaMode: 'opaque' });
    const U = GPUTextureUsage, S = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE;
    G.globalsBuf = dev.createBuffer({ size: GF.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    G.bgl0 = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: S, buffer: {} }, { binding: 1, visibility: S, texture: { sampleType: 'depth' } },
      { binding: 2, visibility: S, sampler: { type: 'comparison' } }, { binding: 3, visibility: S, texture: {} }, { binding: 4, visibility: S, sampler: {} }, { binding: 5, visibility: S, texture: {} }] });
    G.shadowSamp = dev.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });
    G.linSamp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat' });
    G.clampSamp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    const nz = new Uint8Array(256 * 256 * 4), r = G.rng(7); for (let i = 0; i < nz.length; i++) nz[i] = r() * 256;
    const nt = dev.createTexture({ size: [256, 256], format: 'rgba8unorm', usage: U.TEXTURE_BINDING | U.COPY_DST });
    dev.queue.writeTexture({ texture: nt }, nz, { bytesPerRow: 1024 }, [256, 256]); G.noiseView = nt.createView();
    G.dummyView = dev.createTexture({ size: [1, 1], format: G.HDR, usage: U.TEXTURE_BINDING }).createView();
    G.dummyDepthView = dev.createTexture({ size: [1, 1], format: G.DEPTH, usage: U.TEXTURE_BINDING | U.RENDER_ATTACHMENT }).createView();
    addEventListener('keydown', e => { G.keys[e.code] = 1; if (e.code === 'Tab' || e.code === 'Space') e.preventDefault(); });
    addEventListener('keyup', e => { G.keys[e.code] = 0; });
    addEventListener('blur', () => { G.keys = {}; });
    G.setEnv();
    const mDR = dev.createShaderModule({ code: `@group(0) @binding(0) var d: texture_depth_multisampled_2d;
      @vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f { return vec4f(f32((i << 1u) & 2u) * 2.0 - 1.0, f32(i & 2u) * 2.0 - 1.0, 0.0, 1.0); }
      @fragment fn fs(@builtin(position) p: vec4f) -> @builtin(frag_depth) f32 { return textureLoad(d, vec2i(p.xy), 0); }` });
    G.pipeDR = dev.createRenderPipeline({ layout: 'auto', vertex: { module: mDR, entryPoint: 'vs' }, fragment: { module: mDR, entryPoint: 'fs', targets: [] }, depthStencil: { format: G.DEPTH, depthWriteEnabled: true, depthCompare: 'always' } });
    if (hasTS && !G.params.has('step')) G.ts = { qs: dev.createQuerySet({ type: 'timestamp', count: 2 }), buf: dev.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }), rb: dev.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }) };
    G.gpuInfo = await G.mods.gpu.detect(adapter, dev); // {name, vendor, tier, ...}
    const q = (G.params.get('q') || '').toUpperCase();
    G.setQuality(G.PRESETS[q] ? q : G.gpuInfo.tier, !!G.PRESETS[q]);
    for (const m of G.order) m.init && await m.init();
    G.ready = true; hook('onQuality', G.Q); hook('onResize');
    addEventListener('resize', () => { G.dead || G.resize(); });
    await new Promise(r => setTimeout(r, 0));
    if (G.params.has('step')) return;
    let last = performance.now();
    const loop = t => {
      if (G.dead) return; requestAnimationFrame(loop);
      const raw = (t - last) / 1000; last = t; if (raw <= 0) return;
      G.fps += (1 / raw - G.fps) * .06;
      try { G.tick(Math.min(raw, .05)); } catch (e) { G.err(e.stack || e); }
    };
    requestAnimationFrame(loop);
  } catch (e) { console.error(e); G.fatal('초기화 실패', `<p><code>${e.message || e}</code></p>` + tip); }
};
