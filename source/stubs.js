'use strict';
/* 개발 전용 스텁 — 아직 없는 모듈을 최소 구현으로 대체 (최종 빌드에는 포함되지 않음) */
{
  const has = n => !!G.mods[n];
  if (!has('gpu')) G.register('gpu', { detect: async () => ({ name: 'stub GPU', vendor: 'stub', tier: 'MEDIUM' }) });

  if (!has('sky')) G.register('sky', {
    onQuality() {
      const m = G.shader(`@fragment fn fs(i: FSOut) -> @location(0) vec4f {
        let rd = viewRay(i.uv); var c = skyBase(rd);
        c += g.sunCol.rgb * smoothstep(.9995, .9999, dot(rd, g.sun.xyz)) * 12.0;
        return vec4f(c, 1.0); }`, 'stub-sky');
      this.pipe = G.dev.createRenderPipeline({ layout: G.layout(), vertex: { module: m, entryPoint: 'vsFull' }, fragment: { module: m, entryPoint: 'fs', targets: [{ format: G.HDR }] },
        multisample: { count: G.Q.msaa }, depthStencil: { format: G.DEPTH, depthWriteEnabled: false, depthCompare: 'equal' } });
    },
    sky(p) { p.setPipeline(this.pipe); p.draw(3); }
  });

  if (!has('post')) G.register('post', {
    init() {
      const m = G.shader(`@group(0) @binding(0) var src: texture_2d<f32>; @group(0) @binding(1) var smp: sampler;
        struct O { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
        @vertex fn vs(@builtin(vertex_index) i: u32) -> O { let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)); return O(vec4f(p * 2.0 - 1.0, 0.0, 1.0), vec2f(p.x, 1.0 - p.y)); }
        @fragment fn fs(i: O) -> @location(0) vec4f {
          let x = textureSampleLevel(src, smp, i.uv, 0.0).rgb;
          let c = clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), vec3f(0.0), vec3f(1.0));
          return vec4f(pow(c, vec3f(1.0 / 2.2)), 1.0); }`, 'stub-post', false);
      this.pipe = G.dev.createRenderPipeline({ layout: 'auto', vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint: 'fs', targets: [{ format: G.fmt }] } });
    },
    onResize() { this.bg = G.dev.createBindGroup({ layout: this.pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: G.targets.hdrView }, { binding: 1, resource: G.clampSamp }] }); },
    run(enc, dst) {
      const p = enc.beginRenderPass({ colorAttachments: [{ view: dst, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
      p.setPipeline(this.pipe); p.setBindGroup(0, this.bg); p.draw(3); p.end();
    }
  });

  if (!G.ocean) G.ocean = { wake() { }, ripple() { } };
  const nav = G.mode === 'naval'; // 해상 전용 스텁(바다·함정 상자·데모 장면)은 naval 모드에서만
  if (nav && !has('ocean')) {
    G.register('ocean', {
      init() {
        const N = 96, v = new Float32Array(N * N * 12); let o = 0;
        const q = (i, j) => { const u = i / N * 2 - 1, w = j / N * 2 - 1; v[o++] = Math.sign(u) * Math.abs(u) ** 2.6; v[o++] = Math.sign(w) * Math.abs(w) ** 2.6; };
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { q(i, j); q(i, j + 1); q(i + 1, j); q(i + 1, j); q(i, j + 1); q(i + 1, j + 1); }
        this.n = N * N * 6; this.vb = G.dev.createBuffer({ size: v.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }); G.dev.queue.writeBuffer(this.vb, 0, v);
      },
      onQuality() {
        const m = G.shader(`struct V { @builtin(position) pos: vec4f, @location(0) w: vec3f, @location(1) b: vec2f };
          @vertex fn vs(@location(0) a: vec2f) -> V {
            let b = floor(g.cam.xz / 20.0) * 20.0 + a * 9000.0; let d = gerstner(b, g.cam.w) * exp(-length(b - g.cam.xz) / 1800.0);
            let w = vec3f(b.x + d.x, d.y, b.y + d.z); return V(g.viewProj * vec4f(w, 1.0), w, b); }
          @fragment fn fs(i: V) -> @location(0) vec4f {
            let e = 1.5; let t = g.cam.w; let f = exp(-length(i.b - g.cam.xz) / 1800.0);
            let p0 = gerstner(i.b, t); let px = gerstner(i.b + vec2f(e, 0), t); let pz = gerstner(i.b + vec2f(0, e), t);
            let n = normalize(mix(vec3f(0, 1, 0), cross(vec3f(0, pz.y - p0.y, e) + vec3f(pz.x - p0.x, 0, pz.z - p0.z), vec3f(e, px.y - p0.y, 0) + vec3f(px.x - p0.x, 0, px.z - p0.z)), f));
            let vd = normalize(g.cam.xyz - i.w); let fr = .02 + .98 * pow(1.0 - max(dot(n, vd), 0.0), 5.0);
            var r = reflect(-vd, n); r.y = abs(r.y);
            var c = mix(vec3f(.01, .05, .09), skyBase(r), fr) + g.sunCol.rgb * pow(max(dot(r, g.sun.xyz), 0.0), 300.0) * 2.0 + pointLights(i.w, n) * .2;
            return vec4f(fogAt(c, i.w), 1.0); }`, 'stub-ocean');
        this.pipe = G.dev.createRenderPipeline({ layout: G.layout(), vertex: { module: m, entryPoint: 'vs', buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] }] },
          fragment: { module: m, entryPoint: 'fs', targets: [{ format: G.HDR }] }, multisample: { count: G.Q.msaa }, depthStencil: { format: G.DEPTH, depthWriteEnabled: true, depthCompare: 'greater' } });
      },
      water(p) { p.setPipeline(this.pipe); p.setVertexBuffer(0, this.vb); p.draw(this.n); }
    });
  }

  const box = (sx, sy, sz, ox, oy, oz, col, mat = .2, out = []) => { // 중심 (ox,oy,oz), 크기 (sx,sy,sz)
    const F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const n of F) {
      const u = [n[1], n[2], n[0]], w = V3.cross(n, u);
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]])
        out.push((n[0] + u[0] * a + w[0] * b) * sx / 2 + ox, (n[1] + u[1] * a + w[1] * b) * sy / 2 + oy, (n[2] + u[2] * a + w[2] * b) * sz / 2 + oz, ...n, ...col, mat);
    }
    return out;
  };
  if (!has('mesh')) {
    const M = { meshes: {}, q: {}, cap: 0 };
    G.meshes = M.meshes;
    G.addMesh = (name, verts, meta = {}) => {
      const vb = G.dev.createBuffer({ size: verts.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      G.dev.queue.writeBuffer(vb, 0, verts); G.meshes[name] = { vb, count: verts.length / 10 }; G.modelData[name] = { verts, ...meta };
    };
    G.draw = (name, mat, tint) => { (M.q[name] || (M.q[name] = [])).push(mat, tint || [1, 1, 1, 0]); };
    G.register('mesh', Object.assign(M, {
      onQuality() {
        const m = G.shader(`struct V { @builtin(position) pos: vec4f, @location(0) w: vec3f, @location(1) n: vec3f, @location(2) c: vec3f, @location(3) m: f32, @location(4) t: vec4f };
          @vertex fn vs(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) c: vec3f, @location(3) m: f32,
            @location(4) m0: vec4f, @location(5) m1: vec4f, @location(6) m2: vec4f, @location(7) m3: vec4f, @location(8) t: vec4f) -> V {
            let M = mat4x4f(m0, m1, m2, m3); let w = M * vec4f(p, 1.0);
            return V(g.viewProj * w, w.xyz, normalize((M * vec4f(n, 0.0)).xyz), c * t.rgb, m, t); }
          @fragment fn fs(i: V) -> @location(0) vec4f {
            let n = normalize(i.n); if (i.m >= 2.0) { return vec4f(i.c * (i.m - 1.0), 1.0); }
            let c = i.c * (g.sunCol.rgb * max(dot(n, g.sun.xyz), 0.0) * shadowAt(i.w, n) + skyBase(vec3f(n.x, abs(n.y) * .5 + .5, n.z)) * .7 + pointLights(i.w, n)) + vec3f(i.t.a * 3.0);
            return vec4f(fogAt(c, i.w), 1.0); }`, 'stub-mesh');
        const at = (l, o, f) => ({ shaderLocation: l, offset: o, format: f });
        this.pipe = G.dev.createRenderPipeline({ layout: G.layout(), vertex: { module: m, entryPoint: 'vs', buffers: [
          { arrayStride: 40, attributes: [at(0, 0, 'float32x3'), at(1, 12, 'float32x3'), at(2, 24, 'float32x3'), at(3, 36, 'float32')] },
          { arrayStride: 80, stepMode: 'instance', attributes: [at(4, 0, 'float32x4'), at(5, 16, 'float32x4'), at(6, 32, 'float32x4'), at(7, 48, 'float32x4'), at(8, 64, 'float32x4')] }] },
          fragment: { module: m, entryPoint: 'fs', targets: [{ format: G.HDR }] }, multisample: { count: G.Q.msaa }, depthStencil: { format: G.DEPTH, depthWriteEnabled: true, depthCompare: 'greater' }, primitive: { cullMode: 'none' } });
      },
      prepare() {
        let n = 0; for (const k in this.q) n += this.q[k].length / 2;
        if (n > this.cap) { this.cap = n + 64; this.ib && this.ib.destroy(); this.ib = G.dev.createBuffer({ size: this.cap * 80, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }); }
        const d = new Float32Array(n * 80 / 4); let o = 0; this.list = [];
        for (const k in this.q) { const a = this.q[k]; if (!a.length || !G.meshes[k]) { a.length = 0; continue; } this.list.push([G.meshes[k], o / 20, a.length / 2]); for (let i = 0; i < a.length; i += 2) { d.set(a[i], o); d.set(a[i + 1], o + 16); o += 20; } a.length = 0; }
        if (o) G.dev.queue.writeBuffer(this.ib, 0, d, 0, o);
      },
      opaque(p) { if (!this.list.length) return; p.setPipeline(this.pipe); p.setVertexBuffer(1, this.ib); for (const [m, first, cnt] of this.list) { p.setVertexBuffer(0, m.vb); p.draw(m.count, cnt, 0, first); } }
    }));
  }
  // 모델 스텁: 규격 크기의 상자 (원점 규약은 CONTRACT.md 와 동일)
  if (nav) G.register('stubmodels', {
    init() {
      const B = (name, parts, meta) => { if (!G.meshes[name]) { const o = []; for (const p of parts) box(...p, .2, o); G.addMesh(name, new Float32Array(o), meta); } };
      const gy = [.5, .53, .56], rd = [.5, .32, .3], dk = [.25, .27, .3];
      B('aegis', [[21, 13, 166, 0, 1.5, 0, gy], [16, 14, 34, 0, 15, 22, gy], [12, 10, 26, 0, 13, -30, gy], [2, 16, 2, 0, 30, 18, dk]],
        { radius: 85, hp: { gun: [0, 8.2, 56], ciws: [[0, 19.5, 38], [0, 16.5, -44]], vlsF: [0, 8.4, 44], vlsA: [0, 9, -52], ssm: [0, 10, -6], bridge: [0, 20, 30], stack: [[0, 24, 2], [0, 24, -22]], stern: [0, 0, -80] } });
      B('gun', [[4, 3, 5, 0, 1.5, 0, dk], [.6, .6, 8, 0, 2, 6, dk]], { radius: 8, hp: { muzzle: [0, 2, 10] } });
      B('ciws', [[2, 4, 2, 0, 2, 0, [.9, .9, .9]], [.4, .4, 3, 0, 3, 2, dk]], { radius: 4, hp: { muzzle: [0, 3, 3.5] } });
      B('frigate', [[14, 9, 102, 0, 1, 0, rd], [10, 9, 30, 0, 10, 8, rd]], { radius: 55, hp: { gun: [0, 6, 36], ssm: [0, 8, -10], stack: [[0, 16, -6]], stern: [0, 0, -50] } });
      B('boat', [[8, 5, 44, 0, .8, 0, rd], [5, 4, 10, 0, 5, 2, rd]], { radius: 24, hp: { ssm: [0, 5, -10], stack: [[0, 7, -4]], stern: [0, 0, -21] } });
      B('jet', [[2, 2, 17, 0, 0, 0, dk], [11, .3, 6, 0, 0, -2, dk], [.3, 3, 3, 0, 1.5, -7, dk]], { radius: 9, hp: { nozzle: [0, 0, -8.5] } });
      B('sam', [[.5, .5, 6.5, 0, 0, 0, [.9, .9, .9]]], { radius: 3.5, hp: { nozzle: [0, 0, -3.3] } });
      B('ssm', [[.6, .6, 5.2, 0, 0, 0, [.8, .8, .75]], [2, .1, .8, 0, 0, 0, dk]], { radius: 3, hp: { nozzle: [0, 0, -2.6] } });
      B('battery', [[9, 3, 12, 0, 1.5, 0, [.35, .4, .3]], [3, 2, 8, 0, 4.5, 0, dk]], { radius: 9, hp: { ssm: [0, 5, 3] } });
      B('island0', [[900, 60, 700, 0, 25, 0, [.3, .36, .24]], [300, 120, 300, 80, 70, 40, [.4, .38, .33]]], { radius: 600, hp: { site: [-300, 55, -200] } });
    }
  });
  if (!has('fx')) { G.fx = { burst() { }, trail() { }, tracer() { }, emit() { } }; }
  if (!has('audio')) { G.sfx = { init() { }, play() { }, loop() { }, music() { }, listener() { }, volume() { } }; }

  // 데모 장면: 모듈 단독 확인용. ?cam=방위,고도,거리,목표높이  (예: cam=35,12,260,12)
  if (nav && !has('game')) G.register('game', {
    init() { const c = (G.params.get('cam') || '').split(',').map(Number); this.cam = c.length >= 3 && !c.some(isNaN) ? c : null; G.time = +(G.params.get('t0') || 0); this.acc = 0; this.k = 0; },
    update(dt) {
      const show = G.params.get('show'); // ?show=모델이름 → 그 모델만 원점에 (함정·섬은 수면, 나머지는 고도 30m)
      if (show) {
        const md = G.modelData[show] || { radius: 10 }, sea = /aegis|frigate|boat|island|battery/.test(show), y = sea ? 0 : 30, c = this.cam || [35, 14, md.radius * 2.6];
        const az = c[0] * Math.PI / 180, el = c[1] * Math.PI / 180; G.cam.target = [0, c[3] ?? y + (sea ? md.radius * .12 : 0), 0];
        G.cam.pos = [Math.sin(az) * Math.cos(el) * c[2], G.cam.target[1] + Math.sin(el) * c[2], Math.cos(az) * Math.cos(el) * c[2]]; G.shadowFocus = [0, 0, 0];
        G.draw(show, M4.trs([0, y, 0])); return;
      }
      const t = G.time, c = this.cam || [35 + t * 4, 12, 260, 12], az = c[0] * Math.PI / 180, el = c[1] * Math.PI / 180, D = c[2];
      G.cam.target = [0, c[3] ?? 12, 0]; G.cam.pos = [Math.sin(az) * Math.cos(el) * D, Math.max(2, Math.sin(el) * D + (c[3] ?? 12)), Math.cos(az) * Math.cos(el) * D];
      G.shadowFocus = [0, 0, 0];
      const ship = (name, x, z, yaw, len) => {
        const fx = Math.sin(yaw), fz = Math.cos(yaw), h = G.waveAt(x, z) * .5;
        const pitch = Math.atan2(G.waveAt(x + fx * len, z + fz * len) - G.waveAt(x - fx * len, z - fz * len), len * 2) * .5;
        const roll = Math.atan2(G.waveAt(x - fz * 8, z + fx * 8) - G.waveAt(x + fz * 8, z - fx * 8), 16) * .6;
        const m = M4.trs([x, h, z], yaw, pitch, roll); G.draw(name, m); G.ocean.wake(x, z, yaw, 12, len); return m;
      };
      const A = ship('aegis', 0, 0, 0, 60), hp = G.modelData.aegis.hp;
      G.draw('gun', M4.mul(A, M4.trs(hp.gun, Math.sin(t * .4))));
      hp.ciws.forEach((p, i) => G.draw('ciws', M4.mul(A, M4.trs(p, t * (i ? -.9 : .7), .3))));
      ship('frigate', -240, 380, 2.2, 40); ship('boat', 210, 260, -1.1, 18);
      G.draw('island0', M4.trs([-1100, 0, 2200], .4));
      G.draw('battery', M4.mul(M4.trs([-1100, 0, 2200], .4), M4.trs(G.modelData.island0.hp.site)));
      const ja = t * .35, jp = [Math.sin(ja) * 320, 110 + Math.sin(t * .5) * 20, Math.cos(ja) * 320], jv = [Math.cos(ja) * 112, Math.cos(t * .5) * 10, -Math.sin(ja) * 112];
      G.draw('jet', M4.fromDir(jp, jv, .5)); G.fx.trail(jp, jv, 'jet', dt);
      const u = (t % 6) / 6, sp = [-40 + u * 260, 12 + u * 420 - u * u * 180, 44 + u * 380], sv = [260 / 6, (420 - 360 * u) / 6, 380 / 6];
      G.draw('sam', M4.fromDir(sp, sv)); G.fx.trail(sp, sv, 'missile', dt);
      const w = ((t + 2) % 8) / 8, ep = [520 - w * 480, 7 + G.waveAt(520 - w * 480, 640 - w * 600) * .4, 640 - w * 600], ev = [-60, 0, -75];
      G.draw('ssm', M4.fromDir(ep, ev)); G.fx.trail(ep, ev, 'missile', dt);
      this.acc += dt;
      if (this.acc > 1.6) {
        this.acc = 0; const k = this.k++ % 5;
        if (k === 0) { G.fx.burst('explosion', [70, 30, 150], { size: 1 }); G.addLight([70, 30, 150], [1, .6, .3], 40, 500, .5); G.sfx.play('explosion', { pos: [70, 30, 150] }); }
        if (k === 1) { G.fx.burst('flash', [-90, 95, 210], { size: 1 }); G.addLight([-90, 95, 210], [1, .9, .7], 60, 700, .35); G.sfx.play('intercept', { pos: [-90, 95, 210] }); }
        if (k === 2) { G.fx.burst('splash', [95, 0, 70], { size: 1 }); G.ocean.ripple(95, 70, 30); G.sfx.play('splash', { pos: [95, 0, 70] }); }
        if (k === 3) { G.fx.burst('launch', M4.point(A, hp.vlsF), { dir: [0, 1, 0] }); G.sfx.play('launch', { pos: [0, 10, 44] }); }
        if (k === 4) { G.fx.burst('hit', [-240, 12, 380], { size: 1 }); G.fx.burst('smoke', [-240, 14, 380], { size: 1 }); }
      }
      const cm = M4.mul(A, M4.trs(hp.ciws[0], t * .7, .3)), mz = M4.point(cm, [0, 3, 3.5]);
      if (t % 4 < 1.5 && G.frame % 2 === 0) G.fx.tracer(mz, V3.norm(V3.sub(M4.point(cm, [0, 3, 30]), mz)), 900);
    }
  });
}
