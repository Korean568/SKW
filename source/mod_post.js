'use strict';
/* POST — 빛줄기·블룸·톤맵·그레이드·디더 (LOW 1패스 / 그 외 ¼ 빛줄기 + 5·6단 블룸 + 샤픈) */
{
  const U = new Float32Array(4); let fl = 0;
  G.post = { flash(v) { fl = Math.max(fl, v); } }; // 노출 킥
  const pass = (enc, view, pipe, bg, loadOp = 'clear') => {
    const p = enc.beginRenderPass({ colorAttachments: [{ view, loadOp, storeOp: 'store' }] });
    p.setPipeline(pipe); p.setBindGroup(0, G.bg0); p.setBindGroup(1, bg); p.draw(3); p.end();
  };
  G.register('post', {
    init() {
      const dev = G.dev, m = G.shader(`
@group(1) @binding(0) var src: texture_2d<f32>;
@group(1) @binding(1) var blm: texture_2d<f32>;
@group(1) @binding(2) var smp: sampler;
@group(1) @binding(3) var<uniform> u: vec4f; // 노출, 블룸, 빛줄기, 업스케일
@group(1) @binding(4) var dep: texture_depth_2d;
@group(1) @binding(5) var shf: texture_2d<f32>;
fn S(uv: vec2f) -> vec3f { return min(textureSampleLevel(src, smp, uv, 0.0).rgb, vec3f(64.0)); } // NaN·Inf 차단
fn box(uv: vec2f, t: vec2f) -> vec3f { let e = vec2f(t.x, -t.y); return (S(uv + t) + S(uv - t) + S(uv + e) + S(uv - e)) * .25; }
fn ign(p: vec2f) -> f32 { return fract(52.9829189 * fract(dot(p, vec2f(.06711056, .00583715)))); }
fn mx(c: vec3f) -> f32 { return max(c.r, max(c.g, c.b)); }
fn X(uv: vec2f) -> vec3f { return textureSampleLevel(shf, smp, uv, 0.0).rgb; }
@fragment fn fm(i: FSOut) -> @location(0) vec4f { // 빛줄기 마스크: 밝은 하늘만
  let R = vec2f(textureDimensions(dep)); var c = vec3f(0.0);
  for (var n = 0; n < 4; n++) {
    let uv = i.uv + (vec2f(f32(n & 1), f32(n >> 1u)) - .5) * 2.0 / R;
    c += min(S(uv), vec3f(8.0)) * step(textureLoad(dep, vec2i(uv * R), 0), 0.0);
  }
  c *= .25;
  let p = g.viewProj * vec4f(g.sun.xyz, 0.0); let e = abs(p.xy) / max(p.w, 1e-3);
  let k = smoothstep(0.0, .3, p.w) * (1.0 - smoothstep(1.0, 2.4, max(e.x, e.y)));
  return vec4f(c * smoothstep(1.4, 5.0, mx(c)) * pow(max(dot(viewRay(i.uv), g.sun.xyz), 0.0), 4.0) * k, 1.0);
}
fn rad(i: FSOut, k: f32, n: i32, fall: f32) -> vec4f { // 태양 쪽 방사형 적분
  let p = g.viewProj * vec4f(g.sun.xyz, 0.0); // 지터 없음: 2패스 = n×8 표본, 마스크는 블룸 ⅛ 단(미리 흐림)
  let d = (p.xy / max(p.w, 1e-3) * vec2f(.5, -.5) + .5 - i.uv) * k / f32(n); var uv = i.uv; var c = vec3f(0.0);
  for (var j = 0; j < n; j++) {
    c += S(uv) * (1.0 - fall * f32(j) / f32(n)) * f32(all(abs(uv - .5) < vec2f(.5)));
    uv += d;
  }
  return vec4f(c / f32(n), 1.0);
}
@fragment fn fr(i: FSOut) -> @location(0) vec4f { return rad(i, .92, i32(4.0 + 12.0 * g.sun.w), 1.0); }
@fragment fn fq(i: FSOut) -> @location(0) vec4f { return rad(i, .92 / (4.0 + 12.0 * g.sun.w), 8, 0.0); }
@fragment fn fd(i: FSOut) -> @location(0) vec4f { // 다운샘플 (첫 단 Karis)
  let d = vec2f(textureDimensions(src)); let t = 1.0 / d; let k = f32(d.x == g.res.x);
  var s = vec3f(0.0); var ws = 0.0;
  for (var n = 0; n < 5; n++) {
    let c = box(i.uv + select(vec2f(f32(n & 1), f32(n >> 1u)) * 2.0 - 1.0, vec2f(0.0), n == 4) * t, t);
    let w = select(.125, .5, n == 4) / (1.0 + k * mx(c));
    s += c * w; ws += w;
  }
  return vec4f(s / ws, 1.0);
}
@fragment fn fu(i: FSOut) -> @location(0) vec4f { // 텐트 업샘플 · 알파 혼합
  return vec4f(box(i.uv, .75 / vec2f(textureDimensions(src))), .62 + .04 * g.sun.w);
}
fn cr(uv: vec2f) -> vec3f { // Catmull-Rom 5탭 + 링잉 방지
  let R = vec2f(textureDimensions(src)); let p = uv * R - .5; let f = fract(p); let b = (floor(p) + .5) / R;
  let w0 = f * (-.5 + f * (1.0 - .5 * f)); let w2 = f * (.5 + f * (2.0 - 1.5 * f)); let w3 = f * f * (.5 * f - .5); let w = 1.0 - w0 - w3;
  let m = b + w2 / w / R; let lo = b - 1.0 / R; let hi = b + 2.0 / R;
  let C = S(m); let a = S(vec2f(m.x, lo.y)); let d = S(vec2f(lo.x, m.y)); let e = S(vec2f(hi.x, m.y)); let h = S(vec2f(m.x, hi.y));
  let s = (C * w.x * w.y + a * w.x * w0.y + d * w0.x * w.y + e * w3.x * w.y + h * w.x * w3.y) / (w.x * w.y + w.x * (w0.y + w3.y) + w.y * (w0.x + w3.x));
  let x = mx(abs(e - d)); let y = mx(abs(h - a)); // 윤곽을 따라 혼합 (추가 탭 없는 AA)
  return mix(clamp(s, min(C, min(min(a, d), min(e, h))), max(C, max(max(a, d), max(e, h)))),
    mix(a + h, d + e, y / (x + y + 1e-4)) * .5, .6 * smoothstep(.1, .4, max(x, y) / (mx(a + h + d + e) + .05)));
}
@fragment fn fc(i: FSOut) -> @location(0) vec4f { // 합성·톤맵·그레이드·디더
  let t = 1.0 / vec2f(textureDimensions(src)); let q = i.uv - .5; let W = vec3f(.2126, .7152, .0722);
  var c = S(i.uv);
  if (u.w > 0.0) { c = cr(i.uv); }
  else if (g.sun.w > .5) { // 샤픈
    let a = S(i.uv + vec2f(t.x, 0.0)); let b = S(i.uv - vec2f(t.x, 0.0)); let d = S(i.uv + vec2f(0.0, t.y)); let e = S(i.uv - vec2f(0.0, t.y));
    c = clamp(c + (c * 4.0 - a - b - d - e) * .22, min(c, min(min(a, b), min(d, e))), max(c, max(max(a, b), max(d, e))));
  }
  if (u.y > 0.0) {
    let h = 1.5 / vec2f(textureDimensions(shf)); let k = vec2f(h.x, -h.y); // 빛줄기 = 산란광: 가까운 표면 앞은 0
    let s = (X(i.uv + h) + X(i.uv - h) + X(i.uv + k) + X(i.uv - k)) * u.z
      * (1.0 - exp(-g.misc.x / max(textureLoad(dep, vec2i(i.uv * vec2f(textureDimensions(dep))), 0), 1e-6) / 2500.0));
    c += s / (1.0 + .5 * mx(s));
    let b = textureSampleLevel(blm, smp, i.uv, 0.0).rgb; // 베일 + 광원
    c = mix(c, b, .04) + b * smoothstep(2.5, 9.0, mx(b)) * .2;
  }
  c *= u.x * (1.0 - .28 * dot(q, q));
  var l = dot(c, W); c = mix(c, vec3f(l), .4 * smoothstep(.6, 5.0, l)); // 고휘도 탈색
  c = clamp(c * (2.51 * c + .03) / (c * (2.43 * c + .59) + .14), vec3f(0.0), vec3f(1.0)); // ACES 근사
  l = dot(c, W);
  c = mix(vec3f(l), c, 1.08) * mix(vec3f(.93, 1.0, 1.07), vec3f(1.07, 1.0, .92), smoothstep(0.0, .5, l)); // 찬 그림자 · 따뜻한 하이라이트
  c = max(mix(c, c * c * (3.0 - 2.0 * c), .22), vec3f(0.0));
  ${G.fmt.endsWith('srgb') ? '' : 'c = pow(c, vec3f(1.0 / 2.2));'}
  return vec4f(c + (ign(i.pos.xy) + ign(i.pos.yx + 47.0) - 1.0) / 255.0, 1.0); // TPDF 디더
}`, 'post'), tx = (binding, sampleType) => ({ binding, visibility: 2, texture: { sampleType } });
      this.bgl = dev.createBindGroupLayout({ entries: [tx(0), tx(1), { binding: 2, visibility: 2, sampler: {} }, { binding: 3, visibility: 2, buffer: {} }, tx(4, 'depth'), tx(5)] });
      const pipe = (entryPoint, format = G.HDR, blend) => dev.createRenderPipeline({ layout: G.layout(this.bgl), vertex: { module: m, entryPoint: 'vsFull' }, fragment: { module: m, entryPoint, targets: [{ format, blend }] } });
      const mixB = { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' };
      this.pc = pipe('fc', G.fmt); this.pd = pipe('fd'); this.pu = pipe('fu', G.HDR, { color: mixB, alpha: mixB });
      this.pm = pipe('fm'); this.pr = pipe('fr'); this.pq = pipe('fq');
      this.ub = dev.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); this.tx = [];
    },
    onResize() {
      const dev = G.dev, T = G.targets, n = G.Q.bloom && Math.min(4 + G.Q.level, Math.log2(T.h) | 0), V = this.v = [T.hdrView];
      const bg = (a, b = a, c = a) => dev.createBindGroup({ layout: this.bgl, entries: [{ binding: 0, resource: a }, { binding: 1, resource: b }, { binding: 2, resource: G.clampSamp }, { binding: 3, resource: { buffer: this.ub } }, { binding: 4, resource: T.depthView }, { binding: 5, resource: c }] });
      const tex = (s, mipLevelCount = 1) => this.tx[this.tx.push(dev.createTexture({ size: [T.w >> s, T.h >> s], mipLevelCount, format: G.HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING })) - 1];
      for (const t of this.tx) t.destroy();
      this.tx = [];
      if (n) {
        const t = tex(1, n); for (let i = 0; i < n; i++) V.push(t.createView({ baseMipLevel: i, mipLevelCount: 1 }));
        this.sv = [tex(2).createView(), tex(2).createView()]; this.sb = this.sv.map(v => bg(v));
      }
      this.b = V.map(v => bg(v)); this.bc = bg(V[0], V[n && 1], n ? this.sv[0] : V[0]);
    },
    run(enc, dst) {
      const V = this.v, B = this.b, n = V.length - 1, T = G.targets, e = G.env, sv = this.sv, sb = this.sb, lo = 1 - G.clamp(e.sunEl / 22, 0, 1), v = G.cam.view, s = G.sun.dir;
      const f = Math.max(-v[2] * s[0] - v[6] * s[1] - v[10] * s[2], 0) ** 4; // 역광: 노출 ↓
      fl *= Math.exp(-G.dt * 12);
      U[0] = e.exposure * .345 * (1 + 2 * fl) * (1 + .6 * lo * lo) * (1 - .2 * f); // 낮 +0.3 EV, 해 질 녘 그대로
      U[1] = n && 1; U[2] = .6 + .9 * e.haze; U[3] = T.w < T.cw;
      G.dev.queue.writeBuffer(this.ub, 0, U);
      for (let i = 0; i < n; i++) pass(enc, V[i + 1], this.pd, B[i]);
      if (n) { pass(enc, sv[0], this.pm, B[Math.min(3, n)]); pass(enc, sv[1], this.pr, sb[0]); pass(enc, sv[0], this.pq, sb[1]); }
      for (let i = n - 1; i > 0; i--) pass(enc, V[i], this.pu, B[i + 1], 'load');
      pass(enc, dst, this.pc, this.bc);
    }
  });
}
