'use strict';
/* ═════════ MESH — 불투명 메시(인스턴싱) · 태양 그림자 패스 · 절차 지형 ═════════ */
{
  const M = { n: 0, cap: 0 };
  G.meshes = {};
  G.addMesh = (name, verts, meta = {}) => { // 정점 10 float: pos3 normal3 rgb3 mat1 (GPU 버퍼는 첫 사용 때 생성)
    const o = G.meshes[name]; o && o.vb && o.vb.destroy();
    G.meshes[name] = { verts, count: verts.length / 10, vb: null, q: new Float32Array(80), n: 0, cnt: 0, first: 0 };
    G.modelData[name] = { verts, ...meta };
  };
  G.draw = (name, mat, t) => { // 이번 프레임 인스턴스 큐 (mat4 + tint4 = 20 float)
    const m = G.meshes[name]; if (!m) return;
    const o = m.n++ * 20;
    if (o >= m.q.length) { const q = new Float32Array(o * 2); q.set(m.q); m.q = q; }
    m.q.set(mat, o); m.q[o + 16] = t ? t[0] : 1; m.q[o + 17] = t ? t[1] : 1; m.q[o + 18] = t ? t[2] : 1; m.q[o + 19] = t && t[3] || 0;
  };

  const WGSL = /* wgsl */`
struct I { @location(0) p: vec3f, @location(1) n: vec3f, @location(2) c: vec3f, @location(3) m: f32,
  @location(4) a: vec4f, @location(5) b: vec4f, @location(6) d: vec4f, @location(7) e: vec4f, @location(8) t: vec4f };
struct V { @builtin(position) p: vec4f, @location(0) w: vec3f, @location(1) n: vec3f, @location(2) c: vec3f, @location(3) m: vec2f, @location(4) a: vec3f };
@vertex fn vs(i: I) -> V {
  let M = mat4x4f(i.a, i.b, i.d, i.e); let w = M * vec4f(i.p, 1.0); let N = normalize((M * vec4f(i.n, 0.0)).xyz);
  // 반구 환경광(면 단위): 위쪽 = 법선 방향 하늘색, 아래쪽 = 어두운 바다 반사광
  var sk = min(skyBase(normalize(vec3f(N.x, abs(N.y) + .5, N.z))), vec3f(1.0));
  sk = mix(sk, vec3f(dot(sk, vec3f(.33))), .5) * mix(vec3f(.3, .4, .45), vec3f(1.0), N.y * .5 + .5) + g.sunCol.rgb * .06;
  return V(g.viewProj * w, w.xyz, N, i.c * i.t.rgb, vec2f(i.m, i.t.a), sk);
}
@vertex fn vsS(i: I) -> @builtin(position) vec4f { return g.shadowVP * mat4x4f(i.a, i.b, i.d, i.e) * vec4f(i.p, 1.0); }
@fragment fn fs(i: V) -> @location(0) vec4f {
  var c = i.c * (i.m.x - 1.0); // mat ≥ 2: 발광(무조명)
  if (i.m.x < 2.0) {
    let q = g.sun.w; let N = normalize(i.n); let L = g.sun.xyz; let E = normalize(g.cam.xyz - i.w); // q: LOW 0 · MEDIUM 1 +반사 · HIGH 2 +그림자
    var y = i.w.y; if (q > .5 && y < 6.0) { y -= gerstner(i.w.xz, g.cam.w).y; } // 파도를 따라가는 흘수선
    let dry = smoothstep(.2, 1.6, y); // 수면 근처는 젖어서 어둡고 번들거림 (+ 위로 옅은 물보라 띠)
    let gl = max(clamp(i.m.x, 0.0, 1.0), .7 - .7 * dry); let al = i.c * (.4 + .45 * dry + .15 * smoothstep(0.0, 6.0, y));
    let sh = shadowAt(i.w, N); let R = reflect(-E, N);
    c = al * (g.sunCol.rgb * max(dot(N, L), 0.0) * sh + i.a * (.65 + .35 * sh) + pointLights(i.w, N));
    c += g.sunCol.rgb * sh * gl * (.25 + 4.0 * gl * gl) * pow(max(dot(R, L), 0.0), 6.0 + 250.0 * gl * gl); // 태양 하이라이트
    if (q > .5) { c = mix(c, skyBase(vec3f(R.x, abs(R.y), R.z)), gl * (.15 + .8 * pow(1.0 - max(dot(N, E), 0.0), 5.0))); } // 하늘 반사
  }
  let h = i.m.y; c += h * (vec3f(5.0, 1.2, .2) + h * h * vec3f(6.0, 6.0, 4.0)); // 피격·화재 열기 (주황 → 백열)
  return vec4f(fogAt(c, i.w), 1.0);
}`;

  // ── 절차 지형: 방사 감쇠 × 능선 fbm 높이장 → 면 단위 법선·색의 저폴리 섬 ──
  const isle = (name, R, H, N, seed) => {
    const r = G.rng(seed), T = Float32Array.from({ length: 4096 }, r), L = G.lerp;
    const sm = (a, b, x) => { x = G.clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
    const nz = (x, z) => { // 값 잡음 (64² 난수표)
      const i = Math.floor(x), j = Math.floor(z), u = sm(0, 1, x - i), v = sm(0, 1, z - j), t = (a, b) => T[(a & 63) + (b & 63) * 64];
      return L(L(t(i, j), t(i + 1, j), u), L(t(i, j + 1), t(i + 1, j + 1), u), v);
    };
    const fb = (x, z, rg) => { // fbm (rg: 능선형)
      let s = 0, a = .5;
      for (let o = 0; o < 4; o++, x = x * 2.1 + 7, z = z * 2.1 + 3, a *= .5) { const n = nz(x, z); s += a * (rg ? 1 - Math.abs(n * 2 - 1) : n); }
      return s;
    };
    let k = 1, t = R;
    const raw = (x, z) => { // 들쭉날쭉한 해안 마스크 × 능선. 바다 밑은 -15 m 까지
      const f = 2 / R, m = Math.min(1, (.9 - Math.hypot(x, z * 1.25) / R) * 3 + (fb(x * f, z * f) - .47) * 2.4);
      return m <= 0 ? Math.max(-15, m * 90) : m ** .4 * (.05 + .3 * m + fb(x * f * 1.2 + 5, z * f * 1.2, 1) ** 2 * (.6 + m));
    };
    const hgt = (x, z) => { const h = raw(x, z); return h > 0 ? h * k : h; };
    for (let i = 0; i < 4096; i++) k = Math.max(k, raw((i % 64 - 32) * R / 30, ((i >> 6) - 32) * R / 30));
    k = H / k;
    // 포대 부지: 바다 쪽에서 들어오다 처음 30 m 고도에 닿는 곳을 평탄화
    for (; t > 0 && hgt(-.83 * t, -.55 * t) < 30; t -= 4);
    const sx = -.83 * t, sz = -.55 * t, hs = Math.max(24, hgt(sx, sz)), S = R * 2.1 / N, P = [], o = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { // 흐트러뜨린 격자
      const x = (i - N / 2 + r() * .44 - .22) * S, z = (j - N / 2 + r() * .44 - .22) * S;
      P.push([x, L(hgt(x, z), hs, sm(45, 18, Math.hypot(x - sx, z - sz))), z]);
    }
    const tri = (a, b, c) => { // 높이·경사로 색: 모래 바닥 / 젖은 바위 / 자갈 해변 / 절벽 / 풀·관목 / 암반
      const n = V3.norm(V3.cross(V3.sub(b, a), V3.sub(c, a))), y = (a[1] + b[1] + c[1]) / 3 * (.8 + r() * .4), v = .85 + r() * .3;
      const g = sm(.66, .8, n[1]), rock = [.13, .13, .14], sand = [.3, .27, .2], u = sm(.35, .6, fb(a[0] / 40, a[2] / 40)); // u: 풀 ↔ 마른 관목
      const col = y < -2 ? sand : y < 1.5 ? [.05, .05, .06] : y < 6 ? r() < g ? sand : rock : n[1] < .6 ? [.2, .2, .2] : r() < g * sm(H * .85, H * .5, y) ? [.055 + .05 * u, .1, .03 + .02 * u] : rock;
      for (const p of [a, b, c]) o.push(...p, ...n, col[0] * v, col[1] * v, col[2] * v, .04);
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const q = j * (N + 1) + i, a = P[q], b = P[q + 1], c = P[q + N + 1], d = P[q + N + 2];
      if (Math.max(a[1], b[1], c[1], d[1]) < -14.9) continue; // 깊은 바다 밑은 생략
      if ((i + j) & 1) { tri(a, c, b); tri(b, c, d); } else { tri(a, c, d); tri(a, d, b); }
    }
    G.addMesh(name, new Float32Array(o), { radius: R, hp: { site: [sx, hs, sz] } });
  };

  const run = (p, pipe) => { // 메시당 인스턴스 드로 1회
    if (!M.n) return;
    p.setPipeline(pipe); p.setVertexBuffer(1, M.ib);
    for (const k in G.meshes) { const m = G.meshes[k]; if (m.cnt) { p.setVertexBuffer(0, m.vb); p.draw(m.count, m.cnt, 0, m.first); } }
  };
  G.register('mesh', Object.assign(M, {
    init() {
      const dev = G.dev, m = G.shader(WGSL, 'mesh'), at = (l, o, f) => ({ shaderLocation: l, offset: o, format: 'float32' + f });
      const buffers = [{ arrayStride: 40, attributes: [at(0, 0, 'x3'), at(1, 12, 'x3'), at(2, 24, 'x3'), at(3, 36, '')] },
        { arrayStride: 80, stepMode: 'instance', attributes: [4, 5, 6, 7, 8].map((l, i) => at(l, i * 16, 'x4')) }];
      const mk = (vs, cullMode, ds, fragment) => dev.createRenderPipeline({ layout: G.layout(), vertex: { module: m, entryPoint: vs, buffers }, fragment,
        primitive: { cullMode }, depthStencil: { format: G.DEPTH, depthWriteEnabled: true, ...ds } });
      this.pipe = mk('vs', 'back', { depthCompare: 'greater' }, { module: m, entryPoint: 'fs', targets: [{ format: G.HDR }] });
      this.spipe = mk('vsS', 'none', { depthCompare: 'less', depthBiasSlopeScale: 1.5, depthBiasClamp: .004 });
      isle('island0', 600, 185, 106, 11); isle('island1', 250, 70, 72, 5);
    },
    prepare() { // 큐 → 인스턴스 버퍼 (부족하면 2배로 확장)
      const dev = G.dev, U = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST; let n = 0;
      for (const k in G.meshes) { const m = G.meshes[k]; m.first = n; n += m.cnt = m.n; m.n = 0; }
      this.n = n;
      if (n > this.cap) { this.ib && this.ib.destroy(); this.ib = dev.createBuffer({ size: (this.cap = n * 2 + 64) * 80, usage: U }); }
      for (const k in G.meshes) {
        const m = G.meshes[k]; if (!m.cnt) continue;
        if (!m.vb) { m.vb = dev.createBuffer({ size: m.verts.byteLength, usage: U }); dev.queue.writeBuffer(m.vb, 0, m.verts); }
        dev.queue.writeBuffer(this.ib, m.first * 80, m.q, 0, m.cnt * 20);
      }
    },
    opaque(p) { run(p, this.pipe); },
    shadow(p) { run(p, this.spipe); }
  }));
}
