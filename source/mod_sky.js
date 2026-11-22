'use strict';
/* SKY — 대기·태양·별·권운·볼륨 적운·먼 지표·구름 그림자 맵 */
{
  const COMMON = `
@group(1) @binding(0) var cl: texture_2d<f32>;
@group(1) @binding(1) var vol: texture_3d<f32>;
@group(1) @binding(2) var<uniform> cu: vec4f; // 구름층 밑면(m)·두께(m)·스토리 0/1
fn V(p: vec3f) -> f32 { return textureSampleLevel(vol, linSamp, p, 0.0).r; }
fn n2(p: vec2f) -> f32 { // 1탭 값 잡음
  let f = fract(p);
  return textureSampleLevel(noiseTex, linSamp, (floor(p) + f * f * (3.0 - 2.0 * f) + .5) / 256.0, 0.0).r;
}
fn drift() -> vec2f { return g.wind.xy * g.wind.z * g.cam.w * 4.0; }
fn dens(p: vec3f, fine: bool) -> f32 { // 밀도
  let h = (p.y - cu.x) / cu.y; let q = p.xz + drift();
  if (h < 0.0 || h > 1.0) { return 0.0; }
  let w = n2(q / 7000.0); let hh = h / (.3 + .7 * w);
  var d = V(vec3f(q / 8000.0, h * .26)) - 1.05 + .85 * pow(g.fog.y, .7) - (.5 - w) * 1.05 - .2 * hh * hh;
  if (fine && d > 0.0) { // 세부: 요철 · 가장자리 침식
    let e = V(vec3f(q / 1300.0, h * 1.5)); d += (e - .6) * .35 * min(d * 8.0, 1.0) - (1.0 - e) * .17 * max(1.0 - d * 5.0, 0.0);
  }
  d = clamp(d * 5.5, 0.0, 1.0);
  return d * d * smoothstep(0.0, .05, h) * (1.0 - smoothstep(.75, 1.0, hh));
}
fn above() -> f32 { return smoothstep(-400.0, 0.0, g.cam.y - cu.x); } // 0 구름 아래 → 1 층 안·위
fn low() -> f32 { return 1.0 - smoothstep(0.0, .3, g.sun.y); } // 낮은 태양
fn sunc() -> vec3f { let c = g.sunCol.rgb; // 낮: 흰빛 · 낮은 태양: 금빛
  return mix(mix(c, vec3f(dot(c, vec3f(.3, .6, .1))), .8), c * vec3f(1.0, .78, .55), low()); }
fn amb() -> vec3f { let l = low(); // 해 질 녘: 보랏빛
  return skyBase(normalize(vec3f(-g.sun.x, .6, -g.sun.z))) * (.75 + .6 * l) + g.sunCol.rgb * .05 * (1.0 - l); }`;
  const SKY = `
fn fb(q: vec2f, oct: i32) -> f32 {
  var p = q; var a = .5; var s = 0.0;
  for (var i = 0; i < oct; i++) { s += a * n2(p); p = mat2x2f(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= .5; }
  return s / (1.0 - 2.0 * a);
}
fn C(uv: vec2f) -> vec4f { return textureSampleLevel(cl, linSamp, uv, 0.0); }
@fragment fn fs(i: FSOut) -> @location(0) vec4f {
  let v = viewRay(i.uv); let s = g.sun.xyz; let mu = max(dot(v, s), 0.0); let S = sunc(); let lo = low();
  let r = 1.0 - (1.0 - mu) / 5e-5; let ew = max(fwidth(r) * 1.5, .12); // 태양 원반 (AA)
  let sp = v * 140.0; let sw = max(length(fwidth(sp)), .09);
  let y = max(v.y, 0.0); let m4 = mu * mu * mu * mu;
  var c = skyBase(normalize(vec3f(v.x, max(v.y, abs(v.y) * (.25 - .25 * cu.z) + .015), v.z))); // 수평선 아래 = fogAt 수렴색
  // 연무 띠: 낮엔 푸르게 · 해 질 녘엔 장미빛
  c *= mix(vec3f(1.0), mix(vec3f(.64, .81, 1.0), vec3f(1.2, .78, 1.22), lo),
    (1.0 - exp(-y * 25.0)) * exp(-y * 4.0) * mix(1.0 - smoothstep(.3, .5, g.fog.z), 1.0 - .8 * m4, lo));
  if (v.y < 0.0 && cu.z > 0.0) { // 스토리: 먼 지표 (바다·들·숲)
    let hg = max(g.cam.y, 60.0); let t = min(hg / -v.y, 4e5);
    let P = g.cam.xyz + vec3f(v.x * t, -hg, v.z * t); let p = P.xz / 4000.0;
    let q = vec3f(p * .4, .2); let hl = V(q); // 구릉
    let e = n2(p * .22 + 5.0) + hl * .6; let f = n2(p * 50.0 + hl * 20.0); // 고도 · 논밭 얼룩
    let al = mix(vec3f(.02, .06, .1), mix(vec3f(.13, .2, .07) + vec3f(.14, .05, .02) * f, vec3f(.04, .08, .03), smoothstep(.72, .86, e + f * .05)), smoothstep(0.0, .012, e - .54));
    // 기울기 음영 × 구름 그림자, fogAt 투과율
    c = mix(c, al * (S * max(s.y, 0.0) * max(1.0 + (V(q + vec3f(s.xz * .025, 0.0)) - hl) * 8.0, .2) * (1.0 - .7 * dens(P + s / max(s.y, .15) * (cu.x + .3 * cu.y - P.y), false)) + amb()),
      fogAt(vec3f(1.0), P) - fogAt(vec3f(0.0), P));
  }
  let ni = 1.0 - smoothstep(-.14, .02, s.y);
  if (ni > 0.0) { // 밤: 별 (최소 1px)
    let h = hash33(floor(sp)); let d = length(fract(sp) - .5 - (h - .5) * .6);
    c += vec3f(.7, .85, 1.0) * ni * step(.98, h.x) * h.y * (1.0 - smoothstep(0.0, sw, d)) * .06 / (sw * sw) * smoothstep(0.0, .25, v.y);
  }
  c += S * (pow(mu, 5000.0) * 4.0 + pow(mu, 700.0) * (1.0 + .6 * lo) + pow(mu, 70.0) * (.12 + .15 * lo)) * smoothstep(0.0, .05, v.y);
  if (v.y > 0.0) { // 권운 (9 km)
    let t = 9000.0 / (v.y + .08); let p = (g.cam.xz + v.xz * t + drift() * 2.0) / 9000.0;
    let a = smoothstep(.5, .95, fb(p * vec2f(.6, 2.6) + fb(p * 1.3, 2) * 1.2, 3)) * (.2 + .4 * g.fog.y) * exp(-t * 2e-5) * smoothstep(0.0, .15, v.y);
    c = mix(c, S * (.28 + 1.6 * pow(mu, 5.0)) + amb(), a);
  }
  // 적운: 4탭 텐트 → 풀해상도 침식
  let d = .5 / vec2f(textureDimensions(cl)); let e = vec2f(d.x, -d.y); let uv = clamp(i.uv, d * 2.0, 1.0 - d * 2.0);
  let k = (C(uv + d) + C(uv - d) + C(uv + e) + C(uv - e)) * .25; let D = drift();
  let q = (g.cam.xyz + v * 9000.0 + vec3f(D.x, 0.0, D.y)) / 1500.0;
  let n = mix(V(q), V(q * 3.1), .3);
  let a = smoothstep(n * .3 - .1, n * .3 + .6, k.a) * mix(exp((g.cam.y - cu.x - .35 * cu.y) / max(v.y, .03) * g.fog.x * (.08 + 1.5 * g.fog.z * g.fog.z)) * smoothstep(.03, .08, v.y), 1.0, above()); // 아래에서: 대기 원근
  let T = 1.0 - a;
  c += S * smoothstep(0.0, ew, r) * (3.0 + 9.0 * sqrt(max(r, 0.0))) * smoothstep(-.03, .03, v.y) * T * T;
  return vec4f(c * T + k.rgb / max(k.a, 1e-3) * (.7 + .6 * n) * a, 1.0);
}`;
  const VOL = `
fn hg(mu: f32, k: f32) -> f32 { return (1.0 - k * k) / pow(1.0 + k * k - 2.0 * k * mu, 1.5); }
@fragment fn fs(i: FSOut) -> @location(0) vec4f { // rgb = 색×불투명도
  let rd = viewRay(i.uv); let ab = above(); let ry = select(rd.y, 1e-4, abs(rd.y) < 1e-4);
  let ya = (cu.x - g.cam.y) / ry; let yb = ya + cu.y / ry; // 광선-슬랩 교차
  let ki = ab * saturate((cu.x + cu.y - g.cam.y) / 400.0 + .5); // 층 안: 가시거리 짧게
  let ta = max(min(ya, yb), 0.0); let tb = min(max(ya, yb), ta + 6e4 - 3.8e4 * ki);
  if (tb <= ta || g.fog.y <= 0.0 || (ab <= 0.0 && rd.y < .03)) { return vec4f(0.0); }
  let HZ = skyBase(normalize(vec3f(rd.x, .015, rd.z))); let kf = g.fog.x * (.3 + 1.5 * g.fog.z * g.fog.z) * ab;
  let s = g.sun.xyz; let mu = dot(rd, s); let A = amb(); let lo = low(); let S = sunc() * mix(vec3f(1.0), vec3f(1.0, .74, .8), lo); let hi = g.sun.w > 1.5;
  var ph = mix(hg(mu, -.3), hg(mu, .5), .5) + hg(mu, .85) * (.04 + .05 * lo); ph *= 1.5 / (1.0 + .22 * ph); // 무릎
  ph = mix(ph, 7.0 * pow(max(mu, 0.0), 24.0) + .3, lo); // 낮은 태양: 전방 산란 좁게
  let N = i32(14.0 + 8.5 * g.sun.w * g.sun.w); let fN = f32(N); // 14 / 22 / 48 스텝
  let c = ta + 300.0; let gk = pow((tb + c) / (ta + c), 1.0 / fN) - 1.0; // 아래: 균등 · 안/위: 거리 비례
  var dt = mix((tb - ta) / fN, (ta + c) * gk, ab);
  var t = ta + dt * fract(dot(i.pos.xy, vec2f(.5, .75))); // 정적 2×2 지터
  var T = 1.0; var L = vec3f(0.0); var al = 0.0;
  for (var n = 0; n < N; n++) {
    let p = g.cam.xyz + rd * t; let d = dens(p, true);
    if (d > 0.0) {
      var od = 0.0; // 태양 쪽 광학 두께
      for (var j = 1; j < select(3, 5, hi); j++) { od += dens(p + s * f32(j * j) * select(90.0, 45.0, hi) * (1.0 + 3.0 * lo), false) * f32(2 * j - 1) * select(1.0, .4, hi); }
      od *= 1.0 + 3.5 * lo; // 낮은 태양: 긴 경로
      let h = (p.y - cu.x) / cu.y;
      let lt = (ph * exp(-od) + (1.0 - .7 * lo) * (.22 * exp(-od * .2) + .05 * exp(-od * .04))) // 다중 산란
        * (1.0 - .5 * exp(-d * 6.0 - od * 2.0) * (.5 - .5 * mu)); // 파우더
      let e = exp(-d * .009 * dt); let w = T * (1.0 - e) * exp(-t * ki * 1.4e-4); al += w;
      // 밝은 꼭대기 · 어두운 밑면
      L += mix(HZ, S * (lt * (.6 + .5 * lo + (.6 - lo) * h) + vec3f(.1, .045, .08) * lo * (1.0 - h) * exp(-od * .3)) + A * (.25 + 1.1 * h) * (1.0 - .5 * d), exp(-t * kf)) * w;
      T *= e;
      if (T < .02) { break; }
    }
    t += dt; dt = mix(dt, (t + c) * gk, ab);
  }
  // 은빛 테두리 (낮에만)
  return vec4f(L + S * hg(mu, .75) * (.5 + lo) * (1.0 - smoothstep(.4, .9, lo)) * .35 * T * (1.0 - T), al);
}
@fragment fn fm(i: FSOut) -> @location(0) vec4f { // 그림자 맵
  let s = normalize(vec3f(g.sun.x, max(g.sun.y, .15), g.sun.z)); var od = 0.0;
  let y0 = select(0.0, g.cam.y, g.cam.y > cu.x * .5); // 수광면: 지표 / 카메라 고도
  let P = vec3f(g.cmap.x, y0, g.cmap.y) + vec3f(i.uv.x - .5, 0.0, i.uv.y - .5) / g.cmap.z;
  for (var j = 0; j < 8; j++) { let h = cu.x + cu.y * (f32(j) + .5) / 8.0; od += dens(P + s * (h - y0) / s.y, false) * step(y0, h); }
  return vec4f(mix(.22, 1.0, exp(-od * .8)));
}`;
  const noise3 = () => { // 타일링 3D 월리 fBm
    const N = 64, d = new Uint8Array(N * N * N), r = G.rng(3), U = GPUTextureUsage;
    for (let f = 4, A = 153; f < 32; f *= 2, A *= .46) {
      const p = Float32Array.from({ length: f * f * f * 3 }, r), w = v => (v + f) % f;
      for (let z = 0, o = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const X = x * f / N, Y = y * f / N, Z = z * f / N; let m = 1;
        for (let k = (Z | 0) - 1; k < Z + 1; k++) for (let j = (Y | 0) - 1; j < Y + 1; j++) for (let i = (X | 0) - 1; i < X + 1; i++) {
          const q = ((w(k) * f + w(j)) * f + w(i)) * 3, a = i + p[q] - X, b = j + p[q + 1] - Y, c = k + p[q + 2] - Z;
          m = Math.min(m, a * a + b * b + c * c);
        }
        d[o++] += A * (1 - Math.sqrt(m));
      }
    }
    const t = G.dev.createTexture({ size: [N, N, N], dimension: '3d', format: 'r8unorm', usage: U.TEXTURE_BINDING | U.COPY_DST });
    G.dev.queue.writeTexture({ texture: t }, d, { bytesPerRow: N, rowsPerImage: N }, [N, N, N]);
    return t.createView();
  };
  let bgl, ub; const cu = new Float32Array(4);
  const pipe = (module, entryPoint, depthStencil, count = 1) => G.dev.createRenderPipeline({
    layout: G.layout(bgl), vertex: { module, entryPoint: 'vsFull' }, fragment: { module, entryPoint, targets: [{ format: G.HDR }] }, depthStencil, multisample: { count } });
  const bind = (a, b) => G.dev.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: a }, { binding: 1, resource: b }, { binding: 2, resource: { buffer: ub } }] });
  const tex = (w, h) => G.dev.createTexture({ size: [w, h], format: G.HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
  const draw = (enc, view, pl, b0, b1) => {
    const p = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] });
    p.setPipeline(pl); p.setBindGroup(0, b0); p.setBindGroup(1, b1); p.draw(3); p.end();
  };
  G.register('sky', {
    init() {
      const m = G.shader(COMMON + VOL, 'cloud');
      bgl = G.dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: 2, texture: {} }, { binding: 1, visibility: 2, texture: { viewDimension: '3d' } }, { binding: 2, visibility: 2, buffer: {} }] });
      ub = G.dev.createBuffer({ size: 16, usage: 72 });
      this.nv = noise3(); this.pv = pipe(m, 'fs'); this.pm = pipe(m, 'fm'); this.bv = bind(G.dummyView, this.nv);
      this.b0 = G.dev.createBindGroup({ layout: G.bgl0, entries: [{ buffer: G.globalsBuf }, G.dummyDepthView, G.shadowSamp, G.noiseView, G.linSamp, G.dummyView].map((resource, binding) => ({ binding, resource })) });
    },
    onQuality(Q) { // 그림자 맵 256²/512²
      if (this.ms !== Q.msaa) this.ps = pipe(G.shader(COMMON + SKY, 'sky'), 'fs', { format: G.DEPTH, depthWriteEnabled: false, depthCompare: 'equal' }, this.ms = Q.msaa);
      const o = this.mt, n = this.mn = 256 * Q.level;
      this.mt = n ? tex(n, n) : null;
      G.setCloudMap(this.mv = n ? this.mt.createView() : null);
      o && o.destroy();
    },
    onResize() {
      const T = G.targets, d = G.Q.level > 1 ? 2 : 3;
      this.ct && this.ct.destroy();
      this.ct = tex(Math.ceil(T.w / d), Math.ceil(T.h / d));
      this.bs = bind(this.cv = this.ct.createView(), this.nv);
    },
    update() { // 맵 중심: 카메라 (텍셀 스냅)
      const m = G.cloudMap, t = m.size / (this.mn || 1), c = G.cam.pos, e = G.env, st = G.mode == 'story';
      cu[0] = e.cloudBase ?? (st ? 1000 : 1500); cu[1] = Math.max((e.cloudTop ?? cu[0] + 2000) - cu[0], 100); cu[2] = +st; // env.cloudBase/cloudTop
      G.dev.queue.writeBuffer(ub, 0, cu);
      m.x = Math.round(c[0] / t) * t; m.z = Math.round(c[2] / t) * t;
    },
    compute(enc) {
      draw(enc, this.cv, this.pv, G.bg0, this.bv);
      if (this.mv) draw(enc, this.mv, this.pm, this.b0, this.bv);
    },
    sky(p) { p.setPipeline(this.ps); p.setBindGroup(1, this.bs); p.draw(3); }
  });
}
