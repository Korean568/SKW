'use strict';
/* SKY — 대기·태양·별·권운·볼륨 적운(LOW ¼ 14스텝 / MEDIUM ⅓ 22 / HIGH ½ 48)·구름 그림자 맵 */
{
  const COMMON = `
@group(1) @binding(0) var cl: texture_2d<f32>;
@group(1) @binding(1) var vol: texture_3d<f32>;
fn V(p: vec3f) -> f32 { return textureSampleLevel(vol, linSamp, p, 0.0).r; }
fn n2(p: vec2f) -> f32 { // 1탭 값 잡음
  let f = fract(p);
  return textureSampleLevel(noiseTex, linSamp, (floor(p) + f * f * (3.0 - 2.0 * f) + .5) / 256.0, 0.0).r;
}
fn drift() -> vec2f { return g.wind.xy * g.wind.z * g.cam.w * 4.0; }
fn cov() -> f32 { return 1.05 - .85 * pow(g.fog.y, .7); } // 구름량 → 잡음 임계값
fn fade(y: f32, t: f32) -> f32 { // 대기 원근
  return exp(-t * g.fog.x * (1.0 + 2.0 * g.fog.z) * .25) * smoothstep(.03, .1, y);
}
fn low() -> f32 { return 1.0 - smoothstep(0.0, .3, g.sun.y); } // 낮은 태양
fn sunc() -> vec3f { return g.sunCol.rgb * mix(vec3f(1.0), vec3f(1.0, .78, .55), low()); }
fn amb() -> vec3f { return skyBase(normalize(vec3f(-g.sun.x, .6, -g.sun.z))) * .75 + g.sunCol.rgb * .05; }`;
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
  var c = skyBase(normalize(vec3f(v.x, max(v.y, .015), v.z))); // 수평선 = fogAt 수렴색
  let ni = 1.0 - smoothstep(-.14, .02, s.y);
  if (ni > 0.0) { // 밤: 별 (최소 1px → 깜빡임 없음)
    let h = hash33(floor(sp)); let d = length(fract(sp) - .5 - (h - .5) * .6);
    c += vec3f(.7, .85, 1.0) * ni * step(.98, h.x) * h.y * (1.0 - smoothstep(0.0, sw, d)) * .06 / (sw * sw) * smoothstep(0.0, .25, v.y);
  }
  // 광륜 (수평선에서 0 = 안개색)
  c += S * (pow(mu, 5000.0) * 4.0 + pow(mu, 700.0) * (1.0 + .6 * lo) + pow(mu, 70.0) * (.12 + .15 * lo)) * smoothstep(0.0, .05, v.y);
  if (g.sun.w > .5 && v.y > 0.0) { // 권운 (9 km, 얇고 길게)
    let t = 9000.0 / (v.y + .08); let p = (g.cam.xz + v.xz * t + drift() * 2.0) / 9000.0;
    let a = smoothstep(.5, .95, fb(p * vec2f(.6, 2.6) + fb(p * 1.3, 2) * 1.2, 3)) * (.2 + .4 * g.fog.y) * exp(-t * 2e-5) * smoothstep(.02, .22, v.y);
    c = mix(c, S * (.28 + 1.6 * pow(mu, 5.0)) + amb(), a);
  }
  // 적운: 4탭 텐트(지터 상쇄) → 풀해상도 침식(또렷한 윤곽)
  let d = .5 / vec2f(textureDimensions(cl)); let e = vec2f(d.x, -d.y); let uv = clamp(i.uv, d * 2.0, 1.0 - d * 2.0);
  let k = (C(uv + d) + C(uv - d) + C(uv + e) + C(uv - e)) * .25; let D = drift();
  let q = (g.cam.xyz + v * 9000.0 + vec3f(D.x, 0.0, D.y)) / 1500.0;
  let n = mix(V(q), V(q * 3.1), .3);
  let a = smoothstep(n * .7 - .15, n * .7 + .25, k.a) * fade(v.y, (2200.0 - g.cam.y) / max(v.y, .03));
  let T = 1.0 - a;
  c += S * smoothstep(0.0, ew, r) * (3.0 + 9.0 * sqrt(max(r, 0.0))) * smoothstep(-.03, .03, v.y) * T * T;
  return vec4f(c * T + k.rgb / max(k.a, 1e-3) * (.7 + .6 * n) * a, 1.0);
}`;
  const VOL = `
fn dens(p: vec3f, fine: bool) -> f32 { // 밀도 (슬랩 1500–3500 m)
  let h = (p.y - 1500.0) / 2000.0; let q = p.xz + drift();
  if (h < 0.0 || h > 1.0) { return 0.0; }
  let w = n2(q / 7000.0); let hh = h / (.3 + .7 * w);
  var d = V(vec3f(q / 8000.0, h * .26)) - cov() - (.5 - w) * .75 - .2 * hh * hh;
  if (fine && d > -.1) { d += (V(vec3f(q / 1300.0, h * 1.5)) - .5) * .3; }
  return clamp(d * 6.0, 0.0, 1.0) * smoothstep(0.0, .05, h) * (1.0 - smoothstep(.75, 1.0, hh));
}
fn hg(mu: f32, k: f32) -> f32 { return (1.0 - k * k) / pow(1.0 + k * k - 2.0 * k * mu, 1.5); }
@fragment fn fs(i: FSOut) -> @location(0) vec4f { // rgb = 색×불투명도
  let rd = viewRay(i.uv);
  if (rd.y < .03 || g.fog.y <= 0.0) { return vec4f(0.0); }
  let s = g.sun.xyz; let mu = dot(rd, s); let A = amb(); let S = sunc(); let lo = low(); let hi = g.sun.w > 1.5;
  let ph = mix(hg(mu, -.3), hg(mu, .5), .65) + hg(mu, .85) * (.04 + .05 * lo); // + 역광 은빛 테두리
  let N = i32(14.0 + 8.5 * g.sun.w * g.sun.w); let dt = 2000.0 / rd.y / f32(N); // 14 / 22 / 48 스텝
  var t = max(1500.0 - g.cam.y, 0.0) / rd.y + dt * fract(dot(i.pos.xy, vec2f(.5, .75))); // 정적 2×2 지터
  var T = 1.0; var L = vec3f(0.0);
  for (var n = 0; n < N; n++) {
    let p = g.cam.xyz + rd * t; let d = dens(p, g.sun.w > .5);
    if (d > 0.0) {
      var od = 0.0; // 태양 쪽 광학 두께
      for (var j = 1; j < select(3, 5, hi); j++) { od += dens(p + s * f32(j * j) * select(80.0, 35.0, hi), false) * f32(2 * j - 1) * select(1.0, .45, hi); }
      let h = (p.y - 1500.0) / 2000.0;
      let lt = (ph * exp(-od) + .22 * exp(-od * .2) + .05 * exp(-od * .04)) // 다중 산란
        * (1.0 - .7 * exp(-d * 6.0 - od * 2.0) * (.5 - .5 * mu)); // 파우더
      let e = exp(-d * .009 * dt);
      // 어두운 밑면 · 낮은 태양: 주황 밑면
      L += (S * (lt + vec3f(.3, .13, .1) * lo * (1.0 - h)) + A * (.25 + 1.1 * h) * (1.0 - .5 * d)) * T * (1.0 - e);
      T *= e;
      if (T < .02) { break; }
    }
    t += dt;
  }
  return vec4f(L, 1.0 - T);
}
@fragment fn fm(i: FSOut) -> @location(0) vec4f { // 그림자 맵: 지표점 → 태양 쪽 8탭
  let s = normalize(vec3f(g.sun.x, max(g.sun.y, .15), g.sun.z)); var od = 0.0;
  let P = vec3f(g.cmap.x, 0.0, g.cmap.y) + vec3f(i.uv.x - .5, 0.0, i.uv.y - .5) / g.cmap.z;
  for (var j = 0; j < 8; j++) { od += dens(P + s * (1625.0 + 250.0 * f32(j)) / s.y, false); }
  return vec4f(mix(.22, 1.0, exp(-od * .8)));
}`;
  const noise3 = () => { // 타일링 3D 월리 fBm (CPU 생성)
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
  let bgl;
  const pipe = (module, entryPoint, depthStencil, count = 1) => G.dev.createRenderPipeline({
    layout: G.layout(bgl), vertex: { module, entryPoint: 'vsFull' }, fragment: { module, entryPoint, targets: [{ format: G.HDR }] }, depthStencil, multisample: { count } });
  const bind = (a, b) => G.dev.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: a }, { binding: 1, resource: b }] });
  const tex = (w, h) => G.dev.createTexture({ size: [w, h], format: G.HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
  const draw = (enc, view, pl, b0, b1) => {
    const p = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] });
    p.setPipeline(pl); p.setBindGroup(0, b0); p.setBindGroup(1, b1); p.draw(3); p.end();
  };
  G.register('sky', {
    init() {
      const m = G.shader(COMMON + VOL, 'cloud');
      bgl = G.dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: 2, texture: {} }, { binding: 1, visibility: 2, texture: { viewDimension: '3d' } }] });
      this.nv = noise3(); this.pv = pipe(m, 'fs'); this.pm = pipe(m, 'fm'); this.bv = bind(G.dummyView, this.nv);
      // 그림자 맵 패스용 그룹 0 (맵 미바인딩)
      this.b0 = G.dev.createBindGroup({ layout: G.bgl0, entries: [{ buffer: G.globalsBuf }, G.dummyDepthView, G.shadowSamp, G.noiseView, G.linSamp, G.dummyView].map((resource, binding) => ({ binding, resource })) });
    },
    onQuality(Q) { // 그림자 맵 256²/512² (LOW 없음)
      if (this.ms !== Q.msaa) this.ps = pipe(G.shader(COMMON + SKY, 'sky'), 'fs', { format: G.DEPTH, depthWriteEnabled: false, depthCompare: 'equal' }, this.ms = Q.msaa);
      const o = this.mt, n = this.mn = 256 * Q.level;
      this.mt = n ? tex(n, n) : null;
      G.setCloudMap(this.mv = n ? this.mt.createView() : null);
      o && o.destroy();
    },
    onResize() {
      const T = G.targets, d = 4 - G.Q.level;
      this.ct && this.ct.destroy();
      this.ct = tex(Math.ceil(T.w / d), Math.ceil(T.h / d));
      this.bs = bind(this.cv = this.ct.createView(), this.nv);
    },
    update() { // 맵 중심: 카메라 (텍셀 스냅)
      const m = G.cloudMap, t = m.size / (this.mn || 1), c = G.cam.pos;
      m.x = Math.round(c[0] / t) * t; m.z = Math.round(c[2] / t) * t;
    },
    compute(enc) {
      draw(enc, this.cv, this.pv, G.bg0, this.bv);
      if (this.mv) draw(enc, this.mv, this.pm, this.b0, this.bv);
    },
    sky(p) { p.setPipeline(this.ps); p.setBindGroup(1, this.bs); p.draw(3); }
  });
}
