'use strict';
{ /* FX — GPU 파티클(컴퓨트 시뮬 + 인스턴스 빌보드)과 전투 효과 레시피 */
  const F = 16, R = G.rng(5), Z = [0, 0, 0], frags = [], ST = [.03, 0, .05, .15, 0, 0, .012]; // ST: 종류별 속도 늘림(초)
  let N = 0, S, die, buf, bg, bgl, rp, cp, cur = 0, cnt = 0, KN = 1, KL = 1, KS = 1, KA = 1;
  // 종류: 0 불 1 연기 2 불티 3 물 4 섬광 5 충격파 6 예광탄 (7 = CPU 파편)
  const WGSL = /* wgsl */`
struct P { p: vec3f, age: f32, v: vec3f, life: f32, s: vec4f, c: vec4f }; // s: 크기0,크기1,종류,시드  c: 명암(불은 그을음),세기,늘림
@group(1) @binding(0) var<storage, read_write> ps: array<P>;
const DRAG = array<f32, 7>(1.6, 0., .25, .15, 0., 0., 0.);
const GRAV = array<f32, 7>(7., 0., -9.8, -30., 0., 0., -1.);
const FADE = array<f32, 7>(1.3, .5, 1., .5, 2., 1.4, .15);
const GAIN = array<f32, 7>(1., 0., 14., 0., 40., 4., 10.);
@compute @workgroup_size(64) fn cs(@builtin(global_invocation_id) id: vec3u) {
  var q = ps[id.x]; if (q.age >= q.life) { return; }
  let dt = g.misc.y; let ty = u32(q.s.z);
  var a = vec3f(0., GRAV[ty], 0.) - q.v * DRAG[ty];
  if (ty == 1u) { // 연기: 바람·부력(어두울수록 큼)으로 수렴 + 난류, 궤적 연기는 천천히
    let w = g.wind.xy * g.wind.z * .6;
    a = (vec3f(w.x, 8.4 - 8. * q.c.x, w.y) - q.v) * select(.9, .35, q.c.z > 0.) + sin(q.p.yzx * .15 + q.s.w * 40. + g.cam.w) * 2.5;
  }
  q.v += a * dt; q.p += q.v * dt; q.age += dt;
  if ((ty == 2u || ty == 3u) && q.p.y < -1.) { q.age = q.life; } // 수면 아래 소멸
  ps[id.x] = q;
}
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) c: vec4f, @location(2) d: vec4f, @location(3) k: vec2f, @location(4) sl: vec3f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f, @location(2) s: vec4f, @location(3) c: vec4f) -> V {
  var o: V; if (a.w >= b.w) { return o; } // 죽은 입자 = 퇴화 쿼드
  let ty = i32(s.z); let t = a.w / b.w; let fd = pow(1. - t, FADE[ty]);
  let cv = g.cam.xyz - a.xyz; let dist = length(cv); let f = cv / dist;
  var sz = mix(s.x, s.y, sqrt(t)); var len = 1.;
  var r = normalize(cross(vec3f(0., 1., 0.), f) + 1e-5); var u = cross(f, r);
  if (c.z > 0.) { // 속도 방향 줄기: 추가 길이 = 속도·c.z, 최소 폭 약 1.2 픽셀
    let sp = length(b.xyz) + .01; u = b.xyz / sp; r = normalize(cross(u, f) + 1e-5);
    sz = max(sz, dist * 1.1 / g.res.y); len = 1. + sp * c.z / sz;
  } else { // 시드별 회전 + 느린 자전
    let an = s.w * 6.283 + t * (s.w - .5) * 2.; let r0 = r; r = r * cos(an) + u * sin(an); u = u * cos(an) - r0 * sin(an);
  }
  o.uv = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2. - 1.; o.k = s.zw;
  o.pos = g.viewProj * vec4f(a.xyz + (r * o.uv.x + u * o.uv.y * len) * sz, 1.);
  if (ty == 4) { o.pos.z *= 1.3; } // 섬광은 주변 선체보다 앞에
  let tr = exp(-dist * g.fog.x * (1. + 2. * g.fog.z));
  o.c = vec4f(vec3f(1., .6, .3) * GAIN[ty] * tr, c.y * fd); o.d = vec4f(c.x, 0., 0., t);
  if (ty == 1 || ty == 3) { // 연기·물보라: 햇빛 쪽·그늘 쪽 색 (안개 포함)
    let alb = c.x * (.7 + .6 * s.w); let amb = skyBase(vec3f(0., .25, 0.)); let fg = fogAt(vec3f(0.), a.xyz);
    o.c = vec4f((g.sunCol.rgb * .85 + amb) * alb * tr + fg, c.y * fd * smoothstep(0., .08, t));
    o.d = vec4f((g.sunCol.rgb * .22 + amb) * alb * tr + fg, t);
    o.sl = vec3f(dot(g.sun.xyz, r), dot(g.sun.xyz, u), dot(g.sun.xyz, f));
  }
  return o;
}
@fragment fn fs(i: V) -> @location(0) vec4f {
  let ty = i32(i.k.x + .5); let uv = i.uv; let r2 = dot(uv, uv); let m = max(1. - r2, 0.); let A = i.c.a; let t = i.d.w;
  if (ty == 2 || ty == 6) { let w = 1. - abs(uv.x); return vec4f(i.c.rgb * vec3f(1., .7, .5) * A * w * w * (1. - uv.y * uv.y), 0.); }
  if (ty == 4) { return vec4f(i.c.rgb * A * (exp(-r2 * 9.) * m + .08 * m * m * m), 0.); }
  if (ty == 5) { let e = (sqrt(r2) - .8) * 12.; return vec4f(i.c.rgb * A * exp(-e * e), 0.); }
  // 뭉게 모양: 원 − 잡음 침식 (나이 들수록 더 깎임)
  let q = uv * .008 + i.k.y * vec2f(7., 3.);
  let n = textureSampleLevel(noiseTex, linSamp, q, 0.).r * .6 + textureSampleLevel(noiseTex, linSamp, q * 3.3, 0.).g * .4;
  let al = smoothstep(0., .4, m - n * (.6 + .7 * t));
  if (ty == 0) { // 불: 흑체 램프 + 식으며 그을음이 뒤를 가림
    let h = al * A; return vec4f(i.c.rgb * (vec3f(1., .5, .2) * h * 3. + h * h * h * 14.), al * min(t * 2., 1. - t) * i.d.x);
  }
  let nl = saturate(dot(vec3f(uv, sqrt(m)), i.sl) * .5 + n); let a2 = min(al * A, 1.);
  return vec4f(mix(i.d.rgb, i.c.rgb, nl) * a2, a2);
}`;
  // 행: [종류, 개수(궤적은 초당), 수명, 크기0, 크기1, 구속도, 위치반경, 방향속도(궤적은 상속률), 세기, 명암, 수직 납작]
  const B = {
    explosion: [[1, 28, 5, 6, 19, 9, 6, 10, 1, .02], [0, 40, .9, 6, 13, 28, 4, 2, 1, 1.2], [2, 36, 1.3, .3, .3, 70, 2, 12], [4, .2, .2, 50, 60], [7, 4, 2.2, 0, 0, 40, 0, 14]],
    flash: [[1, 8, 3.5, 6, 16, 6, 4, 0, .7, .45], [0, 10, .4, 4, 8, 14, 2], [2, 30, .7, .3, .3, 110, 1], [5, .2, .6, 6, 75], [4, .2, .16, 70, 80, 0, 0, 0, 1.6], [7, 4, 2, 0, 0, 45]],
    splash: [[1, 16, 3, 5, 14, 13, 3, 0, .5, .8, .15], [3, 26, 2.6, 3.5, 8, 10, 4, 24, .8, .55, .4], [3, 40, 3.4, 3, 7.5, 3, 2, 52, .9, .55]],
    launch: [[1, 40, 4.5, 4, 14, 13, 3, -3, .7, .8, .35], [0, 20, .45, 3, 6, 5, 1, 70, 2.5], [4, .2, .12, 20, 26]],
    muzzle: [[1, 6, 2, 1.6, 7, 4, .5, 16, .6, .55], [0, 6, .15, 2.5, 5, 8, .3, 70, 2], [4, .2, .08, 16, 20]],
    hit: [[2, 18, .55, .2, .2, 38, .5, 12], [4, .2, .08, 6, 8, 0, 0, 0, .6]],
    smoke: [[1, 1, 3.2, 5, 14, 2, 2, 3, 1, .02]]
  }, T = {
    missile: [[1, 40, 3.6, 1.8, 7, 1.6, .6, .05, .75, .85], [0, 24, .1, 1.8, .8, 2, .3, .9, 1.4]],
    jet: [[1, 40, 1, 2, 4.5, .8, .4, .03, .12, 1], [0, 22, .07, 1.3, .6, 1.5, .2, .92]],
    fire: [[1, 11, 6, 5, 17, 2.5, 4, 0, 1, .02], [0, 16, .8, 4.5, 8, 3, 5, 0, .8, 1.2]],
    stack: [[1, 5, 2.6, 2.2, 8, 1.2, 1, .5, .2, .12]],
    frag: [[1, 14, 1.6, 1.5, 4.5, .8, .3, .1, .6, .08], [0, 14, .25, 2.5, 1, 1, .2, .8]]
  };
  // 레시피 실행: d = 방향(궤적은 발사체 속도), v = 추가 속도, s = 크기 배율, td = 궤적 dt (버스트는 0)
  const run = (rows, p, d, v, s, td) => {
    for (const r of rows) {
      const [ty, n0, life, s0, s1, vr = 0, pr = 0, vd = 0, al = 1, sh = 0, fy = 1] = r, q = ty == 2 || ty == 3 ? Math.sqrt(s) : s,
        st = ty == 1 ? td && vd && 1 / (n0 * KN * vd) : ST[ty]; // 궤적 연기는 입자 간격만큼 늘려 끊김 방지
      let n = n0 * (ty > 6 || life < .3 ? 1 : KN) * (td || 1) + (td ? r[11] || 0 : .99); // 버스트는 올림, 짧은 불꽃·파편은 티어 무관
      if (td) r[11] = n % 1; // 궤적: 소수 나머지 이월
      n |= 0;
      for (let i = 0; i < n && N; i++) {
        const a = R() * 6.283, y = R() * 2 - 1, h = Math.sqrt(1 - y * y), e = [Math.cos(a) * h, y * fy, Math.sin(a) * h], k = pr * s * R(), w = vr * q * (.3 + .7 * R()),
          u = vd * q * (ty == 6 ? 1 : .5 + .5 * R()), f = (i + R()) / n * td, l = life * (life > 1.5 ? KL : 1) * (.7 + .6 * R()), g = s * KS * (.75 + .5 * R()), o = cur * F;
        if (ty > 6) { frags.push({ p: [...p], v: e.map((x, j) => x * w + d[j] * u), t: l }); continue; }
        for (let j = 0; j < 3; j++) { S[o + j] = p[j] + e[j] * k - v[j] * f; S[o + 4 + j] = d[j] * u + e[j] * w + (td ? 0 : v[j]); } // 궤적은 이동 구간에 분산
        S[o + 3] = f; S[o + 7] = l; S[o + 8] = s0 * g; S[o + 9] = s1 * g; S[o + 10] = ty; S[o + 11] = R(); S[o + 12] = sh; S[o + 13] = al * KA; S[o + 14] = st;
        die[cur] = G.time + l; cur = (cur + 1) % N; cnt++;
      }
    }
  };
  G.fx = {
    burst(kind, p, o = {}) { run(B[kind] || [], p, o.dir || [0, 1, 0], o.vel || Z, o.size || 1, 0); },
    trail(p, v, kind, dt) { dt > 0 && run(T[kind] || [], p, v, v, 1, dt); },
    tracer(p, d, sp = 900) { run([[6, .2, .6, .3, .3, 0, 0, sp]], p, d, Z, 1, 0); },
    get alive() { let n = 0; for (let i = 0; i < N; i++) n += die[i] > G.time; return n; }
  };
  G.register('fx', {
    init() {
      const dev = G.dev, m = G.shader(WGSL, 'fx'), one = { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' };
      bgl = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }] });
      cp = dev.createComputePipeline({ layout: G.layout(bgl), compute: { module: m, entryPoint: 'cs' } });
      rp = dev.createRenderPipeline({
        layout: G.layout(), primitive: { topology: 'triangle-strip' }, depthStencil: { format: G.DEPTH, depthWriteEnabled: false, depthCompare: 'greater' },
        vertex: { module: m, entryPoint: 'vs', buffers: [{ arrayStride: 64, stepMode: 'instance', attributes: [0, 1, 2, 3].map(i => ({ shaderLocation: i, offset: i * 16, format: 'float32x4' })) }] },
        fragment: { module: m, entryPoint: 'fs', targets: [{ format: G.HDR, blend: { color: one, alpha: one } }] } // 프리멀티플라이드 (가산 = 알파 0)
      });
    },
    onQuality(Q) { // 티어별 [개수, 수명, 크기, 세기] 배율 + 버퍼 재생성 (64 입자 단위)
      [KN, KL, KS, KA] = [[.3, .55, 1.5, 1.5], [1, 1, 1, 1], [3.5, 1.15, .75, .8]][Q.level];
      N = Q.particles; S = new Float32Array(N * F); die = new Float32Array(N); cur = cnt = 0; buf && buf.destroy();
      buf = G.dev.createBuffer({ size: Math.ceil(N / 64) * 4096, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      bg = G.dev.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: { buffer: buf } }] });
    },
    update(dt) { // 불타는 파편: CPU 탄도 + 연기 꼬리
      for (let i = frags.length; i--;) {
        const f = frags[i]; f.v[1] -= 9.8 * dt;
        for (let j = 0; j < 3; j++) f.p[j] += f.v[j] * dt;
        G.fx.trail(f.p, f.v, 'frag', dt);
        if ((f.t -= dt) < 0 || f.p[1] < 0) frags.splice(i, 1);
      }
    },
    prepare() { // 이번 프레임에 쓴 링 구간만 업로드 (끝을 넘으면 두 조각)
      for (let a = (cur - cnt % N + N) % N, n; cnt > 0; cnt -= n, a = 0) G.dev.queue.writeBuffer(buf, a * 64, S, a * F, (n = Math.min(cnt, N - a)) * F);
    },
    compute(enc) {
      const p = enc.beginComputePass(); p.setPipeline(cp); p.setBindGroup(0, G.bg0); p.setBindGroup(1, bg); p.dispatchWorkgroups(Math.ceil(N / 64)); p.end();
    },
    transparent(p) { p.setPipeline(rp); p.setVertexBuffer(0, buf); p.draw(4, N); }
  });
}
