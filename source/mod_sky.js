'use strict';
/* SKY — 대기·태양·별·구름 (LOW 2탭 / MEDIUM 3겹 평면+권운 / HIGH 볼류메트릭+권운) */
{
  const COMMON = `
fn n2(p: vec2f) -> f32 { // 1탭 값 잡음
  let f = fract(p);
  return textureSampleLevel(noiseTex, linSamp, (floor(p) + f * f * (3.0 - 2.0 * f) + .5) / 256.0, 0.0).r;
}
fn drift() -> vec2f { return g.wind.xy * g.wind.z * g.cam.w * 4.0; }
fn cov() -> f32 { return 1.05 - .85 * pow(g.fog.y, .7); } // 구름량 → 잡음 임계값
fn fade(y: f32, t: f32) -> f32 { // 대기 원근
  return exp(-t * g.fog.x * (1.0 + 2.0 * g.fog.z) * .25) * smoothstep(.03, .1, y);
}
fn sunc() -> vec3f { return g.sunCol.rgb * mix(vec3f(1.0, .78, .55), vec3f(1.0), smoothstep(0.0, .3, g.sun.y)); } // 낮은 태양: 더 붉게
fn amb() -> vec3f { return skyBase(normalize(vec3f(-g.sun.x, .6, -g.sun.z))) * .75 + g.sunCol.rgb * .05; }`;
  const SKY = `
@group(1) @binding(0) var cl: texture_2d<f32>;
fn fb(q: vec2f, oct: i32) -> f32 {
  var p = q; var a = .5; var s = 0.0;
  for (var i = 0; i < oct; i++) { s += a * n2(p); p = mat2x2f(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= .5; }
  return s / (1.0 - 2.0 * a);
}
fn C(uv: vec2f) -> vec4f { return textureSampleLevel(cl, linSamp, uv, 0.0); }
fn lay(v: vec3f, y: f32, h: f32, md: bool) -> vec4f { // 구름 평면 1겹
  let t = (y - g.cam.y) / (v.y + .05); let p = (g.cam.xz + v.xz * t + drift()) / 1500.0; let mu = max(dot(v, g.sun.xyz), 0.0);
  let th = cov() - .07 + .13 * h; let n = fb(p * select(vec2f(.3, .8), vec2f(1.0), md), select(2, 4, md)); // LOW: 2탭
  let tk = smoothstep(th, th + .4, n); let f = smoothstep(th, th + select(.4, .12, md), n) * fade(v.y, t);
  var od = tk * 1.3;
  if (md) { od += 1.6 * smoothstep(th - .1, th + .3, fb(p + g.sun.xz * .15, 2)); } // 자기 그림자
  return vec4f((sunc() * (exp(-od) * (.45 + 3.0 * pow(mu, 8.0)) + .06 + .2 * h) + amb() * (.55 + .45 * h - .3 * tk)) * f, f);
}
@fragment fn fs(i: FSOut) -> @location(0) vec4f {
  let v = viewRay(i.uv); let s = g.sun.xyz; let mu = max(dot(v, s), 0.0); let S = sunc();
  let r = 1.0 - (1.0 - mu) / 5e-5; let ew = max(fwidth(r) * 1.5, .12); // 태양 원반 (AA)
  let sp = v * 140.0; let sw = max(length(fwidth(sp)), .09);
  var c = skyBase(normalize(vec3f(v.x, max(v.y, .015), v.z))); // 수평선 아래 = fogAt 색
  let ni = 1.0 - smoothstep(-.14, .02, s.y);
  if (ni > 0.0) { // 밤: 별 (최소 1px → 깜빡임 없음)
    let h = hash33(floor(sp)); let d = length(fract(sp) - .5 - (h - .5) * .6);
    c += vec3f(.7, .85, 1.0) * ni * step(.98, h.x) * h.y * (1.0 - smoothstep(0.0, sw, d)) * .06 / (sw * sw) * smoothstep(0.0, .25, v.y);
  }
  // 원반(주연 감광) + 글로우
  c += S * (smoothstep(0.0, ew, r) * (3.0 + 9.0 * sqrt(max(r, 0.0))) + pow(mu, 2500.0) * 1.5 + pow(mu, 150.0) * .2) * smoothstep(-.03, .03, v.y);
  let md = g.sun.w > .5;
  if (md && v.y > 0.0) { // 권운 (9 km, 얇고 길게)
    let t = 9000.0 / (v.y + .08); let p = (g.cam.xz + v.xz * t + drift() * 2.0) / 9000.0;
    let a = smoothstep(.5, .95, fb(p * vec2f(.6, 2.6) + fb(p * 1.3, 2) * 1.2, 3)) * (.2 + .4 * g.fog.y) * exp(-t * 2e-5) * smoothstep(.02, .22, v.y);
    c = mix(c, S * (.28 + 1.6 * pow(mu, 5.0)) + amb(), a);
  }
  var k = vec4f(0.0);
  if (g.sun.w > 1.5) { // HIGH: 반해상도 → 4탭 텐트 (2×2 지터 상쇄)
    let d = .5 / vec2f(textureDimensions(cl)); let e = vec2f(d.x, -d.y); let uv = clamp(i.uv, d * 2.0, 1.0 - d * 2.0);
    k = (C(uv + d) + C(uv - d) + C(uv + e) + C(uv - e)) * .25;
  } else if (v.y > 0.0) {
    k = lay(v, 1700.0, 0.0, md);
    if (md) { k += (1.0 - k.a) * lay(v, 1880.0, .5, md); k += (1.0 - k.a) * lay(v, 2060.0, 1.0, md); } // 옆면·시차
  }
  return vec4f(c * (1.0 - k.a) + k.rgb, 1.0);
}`;
  const VOL = `
@group(1) @binding(0) var vol: texture_3d<f32>;
fn V(p: vec3f) -> f32 { return textureSampleLevel(vol, linSamp, p, 0.0).r; }
fn dens(p: vec3f, fine: bool) -> f32 { // 밀도 (슬랩 1500–3500 m)
  let h = (p.y - 1500.0) / 2000.0; let q = p.xz + drift();
  if (h < 0.0 || h > 1.0) { return 0.0; }
  let w = n2(q / 7000.0); let hh = h / (.3 + .7 * w); // 날씨 맵 → 적운 높이
  var d = V(vec3f(q / 8000.0, h * .26)) - cov() - (.5 - w) * .75 - .2 * hh * hh;
  if (fine && d > -.1) { d += (V(vec3f(q / 1300.0, h * 1.5)) - .5) * .3; }
  return clamp(d * 5.0, 0.0, 1.0) * smoothstep(0.0, .05, h) * (1.0 - smoothstep(.75, 1.0, hh));
}
fn hg(mu: f32, k: f32) -> f32 { return (1.0 - k * k) / pow(1.0 + k * k - 2.0 * k * mu, 1.5); }
@fragment fn fs(i: FSOut) -> @location(0) vec4f {
  let rd = viewRay(i.uv);
  if (rd.y < .03 || g.fog.y <= 0.0) { return vec4f(0.0); }
  let s = g.sun.xyz; let mu = dot(rd, s); let A = amb(); let S = sunc();
  let ph = mix(hg(mu, -.3), hg(mu, .5), .65) + hg(mu, .8) * .06; // + 은빛 테두리
  var dt = 25.2 / rd.y; // 48 스텝, 2%씩 길어짐
  var t = max(1500.0 - g.cam.y, 0.0) / rd.y + dt * fract(dot(i.pos.xy, vec2f(.5, .75))); // 정적 2×2 지터
  var T = 1.0; var L = vec4f(0.0);
  for (var n = 0; n < 48; n++) {
    let p = g.cam.xyz + rd * t; let d = dens(p, true);
    if (d > 0.0) {
      var od = 0.0; // 태양 쪽 광학 두께
      for (var j = 1; j < 5; j++) { od += dens(p + s * f32(j * j) * 35.0, false) * f32(2 * j - 1) * .45; }
      let h = (p.y - 1500.0) / 2000.0;
      let lt = (ph * exp(-od) + .22 * exp(-od * .2) + .05 * exp(-od * .04)) // 다중 산란
        * (1.0 - .7 * exp(-d * 6.0 - od * 2.0) * (.5 - .5 * mu)); // 파우더
      let e = exp(-d * .009 * dt); let f = T * (1.0 - e) * fade(rd.y, t);
      L += vec4f(S * lt + A * (.25 + 1.1 * h) * (1.0 - .5 * d), 1.0) * f; // 어두운 밑면
      T *= e;
      if (T < .02) { break; }
    }
    t += dt; dt *= 1.02;
  }
  return L;
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
  const pipe = (code, label, viewDimension, depthStencil, count = 1) => {
    const module = G.shader(COMMON + code, label), bgl = G.dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: 2, texture: { viewDimension } }] });
    return G.dev.createRenderPipeline({ layout: G.layout(bgl), vertex: { module, entryPoint: 'vsFull' }, fragment: { module, entryPoint: 'fs', targets: [{ format: G.HDR }] }, depthStencil, multisample: { count } });
  };
  const bind = (pipe, resource) => G.dev.createBindGroup({ layout: pipe.getBindGroupLayout(1), entries: [{ binding: 0, resource }] });
  G.register('sky', {
    onQuality(Q) { // MSAA 수 변경 시 재생성
      if (this.ms !== Q.msaa) this.ps = pipe(SKY, 'sky', '2d', { format: G.DEPTH, depthWriteEnabled: false, depthCompare: 'equal' }, this.ms = Q.msaa);
    },
    onResize() { // HIGH: 반해상도 구름 타깃
      const T = G.targets, U = GPUTextureUsage;
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
