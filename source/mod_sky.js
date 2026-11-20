'use strict';
/* SKY — 대기·태양·구름 (LOW 2탭 새털구름 / MEDIUM 2D 층 / HIGH 볼류메트릭) */
{
  const U = GPUTextureUsage, COMMON = `
fn n2(p: vec2f) -> f32 { // 1탭 값 잡음
  let f = fract(p);
  return textureSampleLevel(noiseTex, linSamp, (floor(p) + f * f * (3.0 - 2.0 * f) + .5) / 256.0, 0.0).r;
}
fn drift() -> vec2f { return g.wind.xy * g.wind.z * g.cam.w * 4.0; }
fn cov() -> f32 { return 1.05 - .85 * pow(g.fog.y, .7); } // 구름량 → 잡음 임계값
fn fade(y: f32, t: f32) -> f32 { // 대기 원근
  return exp(-t * g.fog.x * (1.0 + 2.0 * g.fog.z) * .25) * smoothstep(.03, .09, y);
}
fn sunc() -> vec3f { return g.sunCol.rgb * mix(vec3f(1.0, .72, .5), vec3f(1.0), smoothstep(0.0, .3, g.sun.y)); } // 낮은 태양: 더 붉게
fn amb() -> vec3f { return skyBase(normalize(vec3f(-g.sun.x, .5, -g.sun.z))) * .6 + g.sunCol.rgb * .07; }`;
  const SKY = `
@group(1) @binding(0) var cl: texture_2d<f32>;
fn fb(q: vec2f, oct: i32) -> f32 {
  var p = q; var a = .5; var s = 0.0;
  for (var i = 0; i < oct; i++) { s += a * n2(p); p = mat2x2f(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= .5; }
  return s / (1.0 - 2.0 * a);
}
fn C(uv: vec2f) -> vec4f { return textureSampleLevel(cl, linSamp, uv, 0.0); }
@fragment fn fs(i: FSOut) -> @location(0) vec4f {
  let v = viewRay(i.uv); let s = g.sun.xyz; let mu = max(dot(v, s), 0.0);
  let r = 1.0 - (1.0 - mu) / 5e-5; // 태양 원반 0.57°
  var c = skyBase(normalize(vec3f(v.x, max(v.y, .015), v.z))) // 수평선 아래 = fogAt 색
    + g.sunCol.rgb * (smoothstep(0.0, .3, r) * (4.0 + 10.0 * r) + pow(mu, 2500.0) * 1.5);
  var k = vec4f(0.0);
  if (g.sun.w > 1.5) { // HIGH: 4탭 텐트 업샘플
    let d = .5 / vec2f(textureDimensions(cl)); let e = vec2f(d.x, -d.y); let uv = clamp(i.uv, d * 2.0, 1.0 - d * 2.0);
    k = (C(uv + d) + C(uv - d) + C(uv + e) + C(uv - e)) * .25;
  } else if (v.y > 0.0) { // 1800 m 구름 평면
    let md = g.sun.w > .5; let t = (1800.0 - g.cam.y) / (v.y + .05); let p = (g.cam.xz + v.xz * t + drift()) / 1500.0;
    let th = cov() - .07; let n = fb(p * select(vec2f(.3, .8), vec2f(1.0), md), select(2, 4, md)); // LOW: 2탭 새털구름
    let tk = smoothstep(th, th + .4, n); let f = smoothstep(th, th + select(.4, .12, md), n) * fade(v.y, t);
    var od = tk * 1.2;
    if (md) { od += 1.4 * smoothstep(th - .1, th + .3, fb(p + s.xz * .15, 2)); } // 자기 그림자
    k = vec4f((sunc() * (exp(-od) * (.5 + 2.5 * pow(mu, 8.0)) + .25 - .17 * tk) + amb() * (1.0 - .4 * tk)) * f, f);
  }
  return vec4f(c * (1.0 - k.a) + k.rgb, 1.0);
}`;
  const VOL = `
@group(1) @binding(0) var vol: texture_3d<f32>;
fn V(p: vec3f) -> f32 { return textureSampleLevel(vol, linSamp, p, 0.0).r; }
fn dens(p: vec3f, fine: bool) -> f32 { // 밀도 (슬랩 1500–3200 m)
  let h = (p.y - 1500.0) / 1700.0; let q = p.xz + drift();
  if (h < 0.0 || h > 1.0) { return 0.0; }
  let th = cov() + (.5 - n2(q / 7000.0)) * (.7 + .5 * h) + .15 * h; // 날씨 맵
  var d = V(vec3f(q / 8000.0, h * .22)) - th;
  if (fine && d > -.08) { d += (V(vec3f(q / 1300.0, h)) - .5) * .26; }
  return clamp(d * 5.0, 0.0, 1.0) * smoothstep(0.0, .08, h) * smoothstep(0.0, .15, 1.0 - h);
}
fn hg(mu: f32, k: f32) -> f32 { return (1.0 - k * k) / pow(1.0 + k * k - 2.0 * k * mu, 1.5); }
@fragment fn fs(i: FSOut) -> @location(0) vec4f {
  let rd = viewRay(i.uv);
  if (rd.y < .03 || g.fog.y <= 0.0) { return vec4f(0.0); }
  let s = g.sun.xyz; let mu = dot(rd, s); let ph = mix(hg(mu, -.3), hg(mu, .5), .65); let A = amb(); let S = sunc();
  var dt = 21.4 / rd.y; // 48 스텝, 2%씩 길어짐
  var t = max(1500.0 - g.cam.y, 0.0) / rd.y + dt * fract(dot(i.pos.xy, vec2f(.5, .75))); // 2×2 지터
  var T = 1.0; var L = vec4f(0.0);
  for (var n = 0; n < 48; n++) {
    let p = g.cam.xyz + rd * t; let d = dens(p, true);
    if (d > 0.0) {
      var od = 0.0; // 태양 쪽 광학 두께
      for (var j = 1; j < 5; j++) { od += dens(p + s * f32(j * j) * 35.0, false) * f32(2 * j - 1) * .4; }
      let lt = (ph * exp(-od) + .25 * exp(-od * .15)) * (1.0 - .5 * exp(-d * 8.0 - od * 2.0) * (.5 - .5 * mu)); // Beer–Powder + 다중 산란
      let e = exp(-d * .009 * dt); let f = T * (1.0 - e) * fade(rd.y, t);
      L += vec4f(S * lt + A * (p.y / 2430.0 - .32), 1.0) * f;
      T *= e;
      if (T < .02) { break; }
    }
    t += dt; dt *= 1.02;
  }
  return L;
}`;
  const noise3 = () => { // 타일링 3D 월리 fBm (CPU 생성)
    const N = 64, d = new Uint8Array(N * N * N), r = G.rng(3);
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
  const pipe = (code, label, viewDimension, depthStencil) => {
    const module = G.shader(COMMON + code, label), bgl = G.dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: 2, texture: { viewDimension } }] });
    return G.dev.createRenderPipeline({ layout: G.layout(bgl), vertex: { module, entryPoint: 'vsFull' }, fragment: { module, entryPoint: 'fs', targets: [{ format: G.HDR }] }, depthStencil });
  };
  const bind = (pipe, resource) => G.dev.createBindGroup({ layout: pipe.getBindGroupLayout(1), entries: [{ binding: 0, resource }] });
  G.register('sky', {
    init() { this.ps = pipe(SKY, 'sky', '2d', { format: G.DEPTH, depthWriteEnabled: false, depthCompare: 'equal' }); },
    onResize() { // HIGH 전용 자원
      const T = G.targets;
      this.ct && this.ct.destroy(); this.ct = null;
      if (G.Q.clouds > 1) {
        if (!this.pv) { this.pv = pipe(VOL, 'cloud', '3d'); this.bv = bind(this.pv, noise3()); }
        this.ct = G.dev.createTexture({ size: [T.w >> 1, T.h >> 1], format: G.HDR, usage: U.RENDER_ATTACHMENT | U.TEXTURE_BINDING });
      }
      this.bs = bind(this.ps, this.cv = this.ct ? this.ct.createView() : G.dummyView);
    },
    compute(enc) {
      if (!this.ct) return;
      const p = enc.beginRenderPass({ colorAttachments: [{ view: this.cv, loadOp: 'clear', storeOp: 'store' }] });
      p.setPipeline(this.pv); p.setBindGroup(0, G.bg0); p.setBindGroup(1, this.bv); p.draw(3); p.end();
    },
    sky(p) { p.setPipeline(this.ps); p.setBindGroup(1, this.bs); p.draw(3); }
  });
}
