'use strict';
/* MESH — 불투명 메시(인스턴싱·컬링) · 태양 그림자 · 절차 지형 */
{
  const M = { cap: 0, P: {} }, H3 = Math.hypot;
  let D = new Float32Array(2560);
  G.meshes = {};
  G.addMesh = (name, verts, meta = {}) => {
    G.meshes[name]?.vb?.destroy();
    let r = 0; for (let i = 0; i < verts.length; i += 10) r = Math.max(r, H3(verts[i], verts[i + 1], verts[i + 2]));
    G.meshes[name] = { verts, count: verts.length / 10, lod: meta.lod || verts.length / 10, q: new Float32Array(80), n: 0, r, c: [0, 0], f: [0, 0] };
    G.modelData[name] = { verts, ...meta };
  };
  G.draw = (name, mat, t) => {
    const m = G.meshes[name]; if (!m) return;
    const o = m.n++ * 20;
    if (o >= m.q.length) { const q = new Float32Array(o * 2); q.set(m.q); m.q = q; }
    m.q.set(mat, o); for (let i = 0; i < 4; i++) m.q[o + 16 + i] = t ? t[i] || 0 : +(i < 3);
  };

  const WGSL = /* wgsl */`
struct I { @location(0) p: vec3f, @location(1) n: vec3f, @location(2) c: vec3f, @location(3) m: f32,
@location(4) a: vec4f, @location(5) b: vec4f, @location(6) d: vec4f, @location(7) e: vec4f, @location(8) t: vec4f };
struct V { @builtin(position) p: vec4f, @location(0) w: vec3f, @location(1) n: vec3f, @location(2) c: vec3f, @location(3) m: vec2f,
@location(4) a: vec3f, @location(5) o: vec4f };
@vertex fn vs(i: I) -> V {
let M = mat4x4f(i.a, i.b, i.d, i.e); let w = M * vec4f(i.p, 1.0); let N = normalize((M * vec4f(i.n, 0.0)).xyz);
// 환경광: 하늘 반구 + 바다 반사광 + 바닥값
let u = N.y * .5 + .5; let L = g.sun.xyz;
var k = min(skyBase(normalize(vec3f(N.x - L.x * .3, .4, N.z - L.z * .3))), vec3f(1.2));
k = mix(k, dot(k, vec3f(.33)) * vec3f(.8, 1.0, 1.25), .5);
let a = k * (.2 + .9 * u * u) * (.6 + .4 * smoothstep(.05, .3, L.y)) + (g.sunCol.rgb * max(L.y, 0.0) + k) * vec3f(.02, .09, .11) * (1.0 - u) * (1.0 + 2.0 * exp(-max(w.y, 0.0) * .15)) + dot(g.sunCol.rgb, vec3f(.006)) * vec3f(.8, .9, 1.1);
return V(g.viewProj * w, w.xyz, N, i.c * i.t.rgb, vec2f(i.m, i.t.a), a, vec4f(i.p, i.n.y));
}
@vertex fn vsS(i: I) -> @builtin(position) vec4f { // 접지 그림자용 바이어스 보정
var p = g.shadowVP * mat4x4f(i.a, i.b, i.d, i.e) * vec4f(i.p, 1.0); p.z -= .0006; return p;
}
fn nz(u: vec2f) -> vec4f { return textureSampleLevel(noiseTex, linSamp, u, 0.0); }
fn fd(s: f32, px: f32) -> f32 { return clamp(s / px * .35 - .5, 0.0, 1.0); } // 작은 무늬 페이드
fn th(P: vec3f) -> vec2f { return 1.0 - abs(vec2f(nz((P.xz + P.y * vec2f(1.2, -.9)) * .00016).x, nz((P.xz - P.y * vec2f(.7, 1.1)) * .0005).y) * 2.0 - 1.0); } // 지형 능선 잡음 (24 m · 8 m, 높이로 비틂)
@fragment fn fs(i: V) -> @location(0) vec4f {
let hq = g.sun.w > .5; let P = i.o.xyz; let mt = i.m.x; let L = g.sun.xyz; let E = normalize(g.cam.xyz - i.w);
let px = length(fwidth(i.w)) * .7 + 1e-4;
var N = normalize(i.n);
var c = i.c * (mt - 1.0) * (3.0 - 2.0 * smoothstep(.05, .4, L.y)); var fk = 1.0; // 발광 · 안개 거리 배율
if (mt < 2.0) {
var al = i.c; var gl = clamp(mt, 0.0, 1.0); var ao = 1.0; var ww = 1.2; var sf = 1.0; var S = g.sunCol.rgb;
var y = i.w.y; if (y < 6.0) { y -= gerstner(i.w.xz, g.cam.w).y; }
if (mt >= 0.0) { let sd = 1.0 - abs(i.o.w);
S = mix(S, vec3f(dot(S, vec3f(.3, .5, .2))), .45); // 주광 화이트밸런스 (회색 도장)
if (P.y < -.3) { ww = 3.0; } // 선저 도료
N.y += sd * .4 * sin(clamp(P.y, 0.0, 7.0) * .67 - 1.57); // 현측 곡률 → 햇빛 띠
gl += .25 * (1.0 - smoothstep(.5, 4.5, y)); // 물보라에 젖은 아랫부분
if (hq) { // 강판: 판별 명도 · 뒤틀림(광택 얼룩) · 녹물 · 소금기
let u = vec2f(P.z + P.x * .37, P.y + P.x * .71);
let a = nz(u * .001); let d = nz(u * .0065 + a.xy * .004); let b = nz(vec2f(u.x * .0035, u.y * .0003) + a.zw * .004);
let w = nz(u * .00022); let pv = nz((floor(u / vec2f(5.2, 2.6)) + .5) / 256.0).x;
let fa = fd(3.9, px); let fe = fd(.6, px); let fw = fd(1.1, px) * sd;
N += ((w.xyz - .5) * .3 + (a.xyz - .5) * .12) * fa;
al *= 1.0 + (a.x - .5) * .3 * fa + (d.x - .5) * .14 * fe + (pv - .5) * .14 * fd(2.6, px);
al = mix(al, al * vec3f(.6, .54, .48), smoothstep(.5, .85, b.x) * fw * (.3 + .7 * a.z) * .8);
al = mix(al, vec3f(dot(al, vec3f(.4)) + .04), (1.0 - smoothstep(1.0, 4.0 + 4.0 * a.y, y)) * sd * a.x * .5);
gl *= .5 + mix(.5, w.w * .6 + a.w * .5, fa);
} else if (i.o.w > .9) { // LOW: 1px 미만 갑판 띠는 옆면처럼 (점선 방지)
let t = smoothstep(1.2, 2.4, px); N = mix(N, E, t * .8); al *= 1.0 + t * clamp(.22 / dot(al, vec3f(.33)) - 1.0, 0.0, 1.5); }
N = normalize(N);
} else if (mt > -1.5) { // 지형 (색 r = 상대 고도 · g = 베이크한 골짜기 차폐)
let q = P.xz + P.y * vec2f(2.0, -1.5);
let a = nz(P.xz * .00007); let b = nz(q * .0005 + a.xy * .02); let d = nz(q * .0041 + b.zw * .01);
let s = nz(vec2f((P.y + q.x * .12) * .0006 + a.z * .02, .3)).x; // 지층
let fb = fd(9.0, px); let fc = fd(1.6, px); let f = vec2f(6.0 * fd(28.0, px), 2.5 * fb); let W = P + (a.xyz - .5) * 90.0;
let t = th(W); let gr = vec3f(dot(th(W + vec3f(3.0, 0.0, 0.0)) - t, f), dot(th(W + vec3f(0.0, 3.0, 0.0)) - t, f), dot(th(W + vec3f(0.0, 0.0, 3.0)) - t, f)) / 3.0;
let fl = i.o.w + ((b.w - .5) * .3 + (t.x - .5) * .3) * fb; let hh = i.c.r + (a.w - .5) * .25;
// 자기 그림자 (등진 사면 · 낮은 해의 골짜기) → 능선 잡음 기울기로 범프
sf = smoothstep(-.1, .15, dot(N, L)) * smoothstep(-.1, .1, L.y - 1.2 * (1.05 - i.c.g));
N = normalize(N - gr + N * dot(gr, N));
al = mix(vec3f(.06, .058, .055), vec3f(.34, .31, .26), smoothstep(.25, .75, mix(.5, s * .5 + t.x * .3 + b.y * .2, fb))) * (.75 + .5 * mix(.5, d.x, fc)); // 암석
let vg = mix(mix(vec3f(.01, .026, .008), vec3f(.05, .085, .022), smoothstep(.2, .8, mix(.5, t.y * .6 + t.x * .4, fb))), vec3f(.17, .16, .07), smoothstep(.6, .85, a.y) * b.z); // 숲 · 풀 · 마른 풀
al = mix(al, vg * (.7 + .6 * mix(.5, d.y, fc)), smoothstep(.5, .7, fl) * (1.0 - smoothstep(.55, .85, hh)));
al = mix(al, vec3f(.4, .35, .25) * (.8 + .4 * b.y), (1.0 - smoothstep(1.0 + 7.0 * a.z, 3.0 + 20.0 * a.z, P.y)) * smoothstep(.35, .7, fl) * smoothstep(.3, .5, a.z) * smoothstep(.3, .6, b.w)); // 해변 (조각)
ao = i.c.g; gl = .03; ww = 2.0 + 6.0 * b.x;
fk += 3.0 * (1.0 - smoothstep(0.0, 90.0, P.y)) * smoothstep(500.0, 2500.0, distance(i.w, g.cam.xyz)); // 먼 섬: 수면부터 연무
}
let wt = 1.0 - smoothstep(.1, ww + px * 2.0, y); al = mix(al, mix(al * .4, vec3f(dot(al, vec3f(.1))), step(0.0, mt)), wt); gl = max(gl, wt * .5); // 흘수선: 젖어 어두운 띠
let sh = shadowAt(i.w, N) * mix(.35, 1.0, cloudVis(i.w)) * sf; let nl = max(dot(N, L), 0.0); let nv = max(dot(N, E), 0.0);
let Hv = normalize(L + E); let nh = max(dot(N, Hv), 0.0); let R = reflect(-E, N); let sp = 6.0 + 420.0 * gl * gl; S *= sh;
c = al * (S * nl + i.a * (.8 + .2 * sh) * ao + pointLights(i.w, N));
// 정반사 (스치는 역광에도 남게 nl 조기 포화) + 넓은 광택
c += S * min(nl * 6.0, 1.0) * ((.04 + .96 * pow(1.0 - max(dot(Hv, E), 0.0), 5.0)) * (sp + 2.0) * .125 * pow(nh, sp) * (.4 + 2.0 * gl) + pow(nh, 5.0) * gl * .8);
c += pointLights(i.w, R) * gl * .6;
c += g.sunCol.rgb * (al + .03) * pow(1.0 - nv, 3.0) * pow(max(-dot(E, L), 0.0), 2.0) * (1.0 - L.y) * (.3 + .7 * sh) * .8; // 역광
if (hq) { let k = skyBase(vec3f(R.x, abs(R.y), R.z)); // 하늘 반사 (수평선 아래는 어두운 무채색 바다)
c = mix(c, mix(vec3f(dot(k, vec3f(.09))), k, smoothstep(-.3, .1, R.y)), gl * (.15 + .85 * pow(1.0 - nv, 5.0))); }
}
var h = i.m.y; if (h > 0.0) { h *= .5 + nz(P.zy * .003 + vec2f(P.x * .002, g.cam.w * .015)).x; }
c += h * (vec3f(5.0, 1.2, .2) + h * h * vec3f(6.0, 6.0, 4.0));
return vec4f(fogAt(c, mix(g.cam.xyz, i.w, fk)), 1.0);
}`;

  // 지형: fbm 높이장 + 나무 · 등대
  const isle = (name, R, H, N, seed, lh) => {
    const r = G.rng(seed), T = Float32Array.from({ length: 4096 }, r), L = G.lerp, o = [], P = [];
    const sm = (a, b, x) => { x = G.clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
    const nz = (x, z) => {
      const i = Math.floor(x), j = Math.floor(z), u = sm(0, 1, x - i), v = sm(0, 1, z - j), t = (a, b) => T[(a & 63) + (b & 63) * 64];
      return L(L(t(i, j), t(i + 1, j), u), L(t(i, j + 1), t(i + 1, j + 1), u), v);
    };
    const fb = (x, z, rg) => {
      let s = 0, a = .5;
      for (let o = 0; o < 4; o++, x = x * 2.1 + 7, z = z * 2.1 + 3, a *= .5) { const n = nz(x, z); s += a * (rg ? 1 - Math.abs(n * 2 - 1) : n); }
      return s;
    };
    let k = 1, t = 1;
    const hgt = (x, z) => { // 해안 마스크 × 휘어진 능선 + 절벽 단. 일부 해안은 완만(해변)
      const f = 2 / R, m = Math.min(1, (.9 - H3(x, z * 1.25) / R) * 3 + (fb(x * f, z * f) - .47) * 2.4);
      if (m <= 0) return Math.max(-15, m * 90);
      const q = fb(z * f * 2, x * f * 2) * .8, e = fb(x * f * 1.2 + 5 + q, z * f * 1.2 + fb(x * f * 2 + 9, z * f * 2) * .8, 1) ** 2;
      return k * m ** (.4 + sm(.42, .55, q / .8)) * (.05 + .3 * m + (e + .2 * sm(.22, .34, e)) * (.6 + m));
    };
    for (let i = 0; i < 4096; i++) t = Math.max(t, hgt((i % 64 - 32) * R / 30, ((i >> 6) - 32) * R / 30));
    k = H / t;
    for (t = R; t > 0 && hgt(-.83 * t, -.55 * t) < 30; t -= 4); // 포대 부지 평탄화
    const sx = -.83 * t, sz = -.55 * t, hs = Math.max(24, hgt(sx, sz)), S = R * 2.1 / N;
    const Y = (x, z) => L(hgt(x, z), hs, sm(45, 18, H3(x - sx, z - sz)));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { // mat -1 = 지형
      const x = (i - N / 2 + r() * .4 - .2) * S, z = (j - N / 2 + r() * .4 - .2) * S, y = Y(x, z);
      const a = Y(x - S, z), b = Y(x + S, z), c = Y(x, z - S), d = Y(x, z + S), e = 3 * S; // g = 골짜기 차폐 (주변이 높을수록 어둡게)
      P.push([x, y, z, ...V3.norm([a - b, 2 * S, c - d]), y / H, G.clamp(1.05 - ((Y(x - e, z) + Y(x + e, z) + Y(x, z - e) + Y(x, z + e)) / 4 - y) / e, .4, 1.2), 1, -1]);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const q = j * (N + 1) + i, a = P[q], b = P[q + 1], c = P[q + N + 1], d = P[q + N + 2];
      if (Math.max(a[1], b[1], c[1], d[1]) < -14.9) continue;
      o.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
    const cone = (x, y, z, r0, r1, h, c, m, n = 8) => { // mat -2 = 소품
      for (let i = 0; i < n; i++) {
        const p = (t, q, u) => [x + Math.sin(t * 6.283 / n) * q, y + u, z + Math.cos(t * 6.283 / n) * q];
        const A = p(i, r0, 0), B = p(i + 1, r0, 0), C = p(i + 1, r1, h), D = p(i, r1, h), nn = V3.norm(V3.cross(V3.sub(B, A), V3.sub(D, A)));
        for (const v of r1 ? [A, B, C, A, C, D] : [A, B, C]) o.push(...v, ...nn, ...c, m);
      }
    };
    for (let i = 0; i < R * 3; i++) { // 나무
      const x = (r() - .5) * 1.7 * R, z = (r() - .5) * 1.7 * R, y = Y(x, z), s = 1.8 + r() * 2.5;
      if (y > 8 && y < H * .55 && Math.abs(Y(x + 6, z) - y) + Math.abs(Y(x, z + 6) - y) < 5 && H3(x - sx, z - sz) > 50)
        cone(x, y - 1, z, s, 0, s * (2 + r()), [.025, .045 + r() * .03, .018], -2, 4);
    }
    for (let i = 0; i < R * 20; i++) { // 갯바위 (곧은 해안선을 깸)
      const x = (r() - .5) * 2.1 * R, z = (r() - .5) * 2.1 * R, y = Y(x, z), s = 3 + r() * r() * 14, c = .08 + r() * .2;
      if (y < -1 && y > -8 && nz(x * 14 / R, z * 14 / R) > .5) cone(x, -3, z, s, 0, 3 + s * (.25 + r() * .5), [c, c * .93, c * .8], -2, 5);
    }
    if (lh) { // 등대
      for (t = R; t > 0 && Y(.75 * t, .66 * t) < 14; t -= 3);
      const x = .75 * t, z = .66 * t, y = Y(x, z) - 3;
      cone(x, y, z, 3.4, 2.3, 23, [.75, .75, .72], -2); cone(x, y + 23, z, 3.3, 3.3, 1.2, [.08, .08, .09], -2);
      cone(x, y + 24.2, z, 1.9, 1.9, 3, [1, .8, .45], 7); cone(x, y + 27.2, z, 2.8, 0, 2.6, [.3, .06, .05], -2);
    }
    G.addMesh(name, new Float32Array(o), { radius: R, hp: { site: [sx, hs, sz] } });
  };

  const run = (p, pipe, s) => { // s: 0 본 패스 · 1 그림자
    if (!M.ib) return;
    p.setPipeline(pipe); p.setVertexBuffer(1, M.ib);
    for (const k in G.meshes) { const m = G.meshes[k]; if (m.c[s]) { p.setVertexBuffer(0, m.vb); p.draw(s ? m.count : m.k, m.c[s], 0, m.f[s]); } }
  };
  G.register('mesh', Object.assign(M, {
    mk(vs, cullMode, ds, fragment, count = 1) {
      const at = (l, o, f) => ({ shaderLocation: l, offset: o, format: 'float32' + f });
      return G.dev.createRenderPipeline({ layout: G.layout(), vertex: { module: M.sm, entryPoint: vs, buffers: [
        { arrayStride: 40, attributes: [at(0, 0, 'x3'), at(1, 12, 'x3'), at(2, 24, 'x3'), at(3, 36, '')] },
        { arrayStride: 80, stepMode: 'instance', attributes: [4, 5, 6, 7, 8].map((l, i) => at(l, i * 16, 'x4')) }] }, fragment,
        primitive: { cullMode }, multisample: { count }, depthStencil: { format: G.DEPTH, depthWriteEnabled: true, ...ds } });
    },
    init() {
      M.sm = G.shader(WGSL, 'mesh');
      M.spipe = M.mk('vsS', 'none', { depthCompare: 'less', depthBiasSlopeScale: 2.5, depthBiasClamp: .004 });
      isle('island0', 600, 185, 120, 11); isle('island1', 250, 70, 72, 5, 1);
    },
    onQuality({ msaa: n }) { // MSAA 샘플 수별 캐시
      M.pipe = M.P[n] || (M.P[n] = M.mk('vs', 'back', { depthCompare: 'greater' }, { module: M.sm, entryPoint: 'fs', targets: [{ format: G.HDR }] }, n));
    },
    prepare() { // 경계 구 컬링 → 인스턴스 버퍼
      const dev = G.dev, U = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST; let n = 0;
      for (let s = 0; s < 2; s++) for (const k in G.meshes) {
        const m = G.meshes[k], q = m.q, c = s ? G.Q.shadows && G.shadowVP : G.cam.viewProj; let wm = 1e9; m.f[s] = n;
        for (let o = 0; c && o < m.n * 20; o += 20) {
          const x = q[o + 12], y = q[o + 13], z = q[o + 14], r = m.r * H3(q[o], q[o + 1], q[o + 2]), w = c[3] * x + c[7] * y + c[11] * z + c[15];
          if (Math.abs(c[0] * x + c[4] * y + c[8] * z + c[12]) > w + r * H3(c[0] + c[3], c[4] + c[7], c[8] + c[11]) ||
            Math.abs(c[1] * x + c[5] * y + c[9] * z + c[13]) > w + r * H3(c[1] + c[3], c[5] + c[7], c[9] + c[11])) continue;
          if (n * 20 + 20 > D.length) { const t = new Float32Array(n * 40 + 20); t.set(D); D = t; }
          for (let j = 0; j < 20; j++) D[n * 20 + j] = q[o + j];
          n++; wm = Math.min(wm, w);
        }
        if (!s) m.k = G.Q.msaa < 2 && wm * 2 / (G.cam.proj[5] * G.targets.h) > .3 ? m.lod : m.count;
        if ((m.c[s] = n - m.f[s]) && !m.vb) { m.vb = dev.createBuffer({ size: m.verts.byteLength, usage: U }); dev.queue.writeBuffer(m.vb, 0, m.verts); }
        if (s) m.n = 0;
      }
      if (n > M.cap) { M.ib && M.ib.destroy(); M.ib = dev.createBuffer({ size: (M.cap = n * 2 + 64) * 80, usage: U }); }
      n && dev.queue.writeBuffer(M.ib, 0, D, 0, n * 20);
    },
    opaque(p) { run(p, M.pipe, 0); },
    shadow(p) { run(p, M.spipe, 1); }
  }));
}
