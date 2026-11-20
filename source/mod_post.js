'use strict';
/* POST — 노출·블룸·ACES 톤맵·감마 (LOW 1패스 / MEDIUM 5단 / HIGH 6단 + 비네트·그레인) */
{
  const U = new Float32Array(4); let fl = 0;
  G.post = { flash(v) { fl = Math.max(fl, v); } }; // 노출 킥 (~0.25초 감쇠)
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
@group(1) @binding(3) var<uniform> u: vec4f; // x 노출, y 블룸
fn S(uv: vec2f) -> vec3f { return min(textureSampleLevel(src, smp, uv, 0.0).rgb, vec3f(64.0)); } // NaN·Inf 차단
fn box(uv: vec2f, t: vec2f) -> vec3f { let e = vec2f(t.x, -t.y); return (S(uv + t) + S(uv - t) + S(uv + e) + S(uv - e)) * .25; }
@fragment fn fd(i: FSOut) -> @location(0) vec4f { // 13탭 다운샘플
  let d = vec2f(textureDimensions(src)); let t = 1.0 / d; let k = f32(d.x == g.res.x); // k=1: 첫 단계
  var s = vec3f(0.0); var ws = 0.0;
  for (var n = 0; n < 5; n++) {
    let c = box(i.uv + select(vec2f(f32(n & 1), f32(n >> 1u)) * 2.0 - 1.0, vec2f(0.0), n == 4) * t, t);
    let w = select(.125, .5, n == 4) / (1.0 + k * max(c.r, max(c.g, c.b))); // Karis 평균
    s += c * w; ws += w;
  }
  s /= ws; let b = max(s.r, max(s.g, s.b)); let q = clamp(b - 2.2, 0.0, 2.0);
  return vec4f(s * mix(1.0, max(q * q * .25, b - 3.2) / max(b, 1e-4), k), 1.0); // 소프트 니
}
@fragment fn fu(i: FSOut) -> @location(0) vec4f { // 텐트 업샘플. HIGH: 넓은 글로우
  return vec4f(box(i.uv, .75 / vec2f(textureDimensions(src))) * (.7 + .3 * g.sun.w), 1.0);
}
@fragment fn fc(i: FSOut) -> @location(0) vec4f { // 합성·노출·비네트·ACES·감마·디더
  var c = S(i.uv); let q = i.uv - .5; let hi = step(1.5, g.sun.w);
  if (u.y > 0.0) { c += textureSampleLevel(blm, smp, i.uv, 0.0).rgb * u.y; }
  c *= u.x * (1.0 - hi * .4 * dot(q, q));
  c = clamp(c * (2.51 * c + .03) / (c * (2.43 * c + .59) + .14), vec3f(0.0), vec3f(1.0));
  ${G.fmt.endsWith('srgb') ? '' : 'c = pow(c, vec3f(1.0 / 2.2));'}
  let n = fract(52.9829 * fract(dot(i.pos.xy + hi * (g.misc.z % 64.0) * 5.3, vec2f(.06711, .00584)))) - .5;
  return vec4f(c + n * (1.0 + 2.0 * hi) / 255.0, 1.0);
}`, 'post'), tx = binding => ({ binding, visibility: 2, texture: {} }), add = { srcFactor: 'one', dstFactor: 'one' };
      this.bgl = dev.createBindGroupLayout({ entries: [tx(0), tx(1), { binding: 2, visibility: 2, sampler: {} }, { binding: 3, visibility: 2, buffer: {} }] });
      const pipe = (entryPoint, format, blend) => dev.createRenderPipeline({ layout: G.layout(this.bgl), vertex: { module: m, entryPoint: 'vsFull' }, fragment: { module: m, entryPoint, targets: [{ format, blend }] } });
      this.pd = pipe('fd', G.HDR); this.pu = pipe('fu', G.HDR, { color: add, alpha: add }); this.pc = pipe('fc', G.fmt);
      this.ub = dev.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    },
    onResize() { // 블룸 밉 체인 재생성 (LOW 는 없음)
      const dev = G.dev, T = G.targets, n = G.Q.bloom && Math.min(4 + G.Q.level, Math.log2(T.w) | 0), V = this.v = [T.hdrView];
      const bg = (a, b = a) => dev.createBindGroup({ layout: this.bgl, entries: [{ binding: 0, resource: a }, { binding: 1, resource: b }, { binding: 2, resource: G.clampSamp }, { binding: 3, resource: { buffer: this.ub } }] });
      this.t && this.t.destroy();
      this.t = n && dev.createTexture({ size: [T.w >> 1, T.h >> 1], mipLevelCount: n, format: G.HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      for (let i = 0; i < n; i++) V.push(this.t.createView({ baseMipLevel: i, mipLevelCount: 1 }));
      this.b = V.map(v => bg(v)); this.bc = bg(V[0], V[n && 1]);
    },
    run(enc, dst) {
      const V = this.v, B = this.b, n = V.length - 1;
      fl *= Math.exp(-G.dt * 12);
      U[0] = G.env.exposure * .28 * (1 + 2 * fl); U[1] = n && .2;
      G.dev.queue.writeBuffer(this.ub, 0, U);
      for (let i = 0; i < n; i++) pass(enc, V[i + 1], this.pd, B[i]);
      for (let i = n - 1; i > 0; i--) pass(enc, V[i], this.pu, B[i + 1], 'load');
      pass(enc, dst, this.pc, this.bc);
    }
  });
}
