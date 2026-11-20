'use strict';
{ /* FX — GPU 파티클(컴퓨트 시뮬 + 볼륨 셰이딩 빌보드)과 전투 효과 */
  const F = 16, R = G.rng(5), Z = [0, 0, 0], UP = [0, 1, 0], ST = [.03, 0, .05, .15, 0, 0, .012], // ST: 종류별 속도 늘림(초)
    E = [0, 0, 0], FR = new Float32Array(448), fp = [0, 0, 0], fv = [0, 0, 0], TR = [[6, .05, .6, .3, .3, 0, 0, 900]]; // FR: 파편 풀 64×7
  let N = 0, S, die, buf, bg, bgD, bgl, bglD, rp, cp, sm, ms = 0, cur = 0, cnt = 0, fi = 0, KN = 1, KL = 1, KS = 1, KA = 1;
  // 종류: 0 불 1 연기 2 불티 3 물 4 섬광 5 충격파 6 예광탄 (7 = CPU 파편)
  const WGSL = /* wgsl */`
struct P { p: vec3f, age: f32, v: vec3f, life: f32, s: vec4f, c: vec4f }; // s: 크기0,크기1,종류,시드  c: 명암(불: 그을음),세기,늘림,해쪽
@group(1) @binding(0) var<storage, read_write> ps: array<P>;
@group(1) @binding(1) var dT: texture_depth_2d; // 불투명 깊이 (HIGH 소프트 파티클)
const DRAG = array<f32, 7>(1.6, 0., .25, .15, 0., 0., 0.);
const GRAV = array<f32, 7>(7., 0., -9.8, -30., 0., 0., -1.);
const FADE = array<f32, 7>(1., .9, 1., .6, 2., 2., .15);
const GAIN = array<f32, 7>(1., 0., 7., 0., 40., .5, 10.);
@compute @workgroup_size(64) fn cs(@builtin(global_invocation_id) id: vec3u) {
  var q = ps[id.x]; if (q.age >= q.life) { return; }
  let dt = g.misc.y; let ty = u32(q.s.z);
  var a = vec3f(0., GRAV[ty], 0.) - q.v * DRAG[ty];
  if (ty == 1u) { // 연기: 바람·부력·난류 (궤적은 천천히)
    let w = g.wind.xy * g.wind.z * .6;
    a = (vec3f(w.x, 8.4 - 8. * q.c.x, w.y) - q.v) * select(.9, .35, q.c.z > 0.) + sin(q.p.yzx * .12 + g.cam.w) * 5.;
  }
  q.v += a * dt; q.p += q.v * dt; q.age += dt;
  if ((ty == 2u || ty == 3u) && q.p.y < -1.) { q.age = q.life; } // 수면 아래 소멸
  ps[id.x] = q;
}
// c: 양지색+알파, d: 환경색+나이, e: 점광·안개+투과, k: 종류,시드,수면 위 높이,크기, sl: 스프라이트 기준 해 방향+그을음, up: 위 방향
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) c: vec4f, @location(2) d: vec4f, @location(3) e: vec4f, @location(4) k: vec4f, @location(5) sl: vec4f, @location(6) up: vec3f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f, @location(2) s: vec4f, @location(3) c: vec4f) -> V {
  var o: V; if (a.w >= b.w) { return o; } // 죽은 입자 = 퇴화 쿼드
  let ty = i32(s.z); let t = a.w / b.w;
  let cv = g.cam.xyz - a.xyz; let dist = length(cv); let f = cv / dist;
  var sz = min(mix(s.x, s.y, sqrt(t)), dist * .3); var len = 1.; var en = 1.; // 화면 크기 상한
  var r = normalize(cross(vec3f(0., 1., 0.), f) + 1e-5); var u = cross(f, r);
  if (c.z > 0.) { // 속도 방향 줄기: 최소 폭 ~1.2px + 에너지 보정
    let sp = length(b.xyz) + .01; u = b.xyz / sp; r = normalize(cross(u, f) + 1e-5);
    let w = max(sz, dist * 1.1 / g.res.y); en = sz / w; sz = w; len = 1. + sp * c.z / sz * select(1., 1. - t, ty == 1);
  } else { // 시드 회전 + 느린 자전
    let an = s.w * 6.283 + t * (s.w - .5) * 2.; let r0 = r; r = r * cos(an) + u * sin(an); u = u * cos(an) - r0 * sin(an);
  }
  o.uv = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2. - 1.;
  let w = a.xyz + (r * o.uv.x + u * o.uv.y * len) * sz;
  o.pos = g.viewProj * vec4f(w, 1.);
  if (ty == 4) { o.pos.z *= 1.3; } // 섬광은 선체 앞에
  let tr = exp(-dist * g.fog.x * (1. + 2. * g.fog.z));
  let A = c.y * pow(1. - t, FADE[ty]) * en * smoothstep(.5, 2., dist / sz); // 렌즈 앞 페이드
  o.k = vec4f(s.zw, w.y - gerstner(a.xz, g.cam.w).y, sz); o.d.a = t;
  o.c = vec4f(vec3f(1., .6, .3) * GAIN[ty] * tr, A);
  if (ty > 1 && ty != 3) { return o; }
  // 볼륨(불·연기·물): 입자 단위 조명 — 해(그림자)·하늘·점광·안개
  let alb = select(c.x * (.7 + .6 * s.w), .04, ty == 0);
  var pl = vec3f(0.);
  for (var j = 0; j < 4; j++) { let l = g.lights[j * 2]; let q = max(1. - distance(l.xyz, a.xyz) / max(l.w, 1.), 0.); pl += g.lights[j * 2 + 1].rgb * q * q; }
  o.c = vec4f(g.sunCol.rgb * shadowAt(a.xyz, g.sun.xyz * 3.) * (.6 + .4 * c.w) * alb * tr, A * smoothstep(0., .08, t));
  o.d = vec4f(skyBase(vec3f(0., .25, 0.)) * alb * tr, t);
  o.e = vec4f(pl * alb * .5 * tr + fogAt(vec3f(0.), a.xyz), tr);
  o.sl = vec4f(dot(g.sun.xyz, r), dot(g.sun.xyz, u), dot(g.sun.xyz, f), c.x);
  o.up = vec3f(r.y, u.y, f.y);
  return o;
}
fn nz(p: vec2f) -> vec4f { // 부드러운 값 잡음 (백색 잡음 + 스무스 보간)
  let x = p * 256.; let i = floor(x); let f = x - i;
  return textureSampleLevel(noiseTex, linSamp, (i + f * f * (3. - 2. * f) + .5) / 256., 0.);
}
@fragment fn fs(i: V) -> @location(0) vec4f {
  let ty = i32(i.k.x + .5); let uv = i.uv; let r2 = dot(uv, uv); let m = max(1. - r2, 0.); let A = i.c.a; let t = i.d.a;
  if (ty == 2 || ty == 6) { // 불티·예광탄: 흰 심 + 짧은 글로우, 꼬리 감쇠
    let w = 1. - abs(uv.x); let h = uv.y * .5 + .5;
    return vec4f(i.c.rgb * A * h * h * smoothstep(1., .8, h) * (vec3f(1., .7, .5) * w * w + pow(w, 8.) * 2.), 0.);
  }
  if (ty == 4) { return vec4f(i.c.rgb * A * (exp(-r2 * 9.) * m + .08 * m * m * m), 0.); }
  if (ty == 5) { let e = (sqrt(r2) - .85) * 14.; return vec4f(vec3f(i.c.r * A * (exp(-e * e) + .04 * m)), 0.); }
  // 볼륨 퍼프: 나이에 따라 변하는 잡음 침식 + 해 쪽 표본으로 자기 그림자
  let fl = f32(ty == 0); let wt = f32(ty == 3); // 불: 진행 방향으로 핥는 무늬, 물: 잘게 부서짐
  let q = uv * vec2f(.011, .011 - .004 * fl) * (1. + wt) + i.k.y * vec2f(7., 3.) - vec2f(0., t * (.01 + .06 * fl));
  let n1 = nz(q); let n2 = nz(q * 2.9 + n1.gb * .012).r; let n = n1.r * .6 + n2 * .4;
  let d = m - n * (.45 + .65 * t + .3 * wt); let al = smoothstep(0., .2 + .4 * t, d);
  let ns = nz(q + i.sl.xy * .003).r * .6 + n2 * .4;
  let N = vec3f(uv, sqrt(m));
  let lit = saturate((dot(N, i.sl.xyz) + (ns - n) * 5. + .4) / 1.4) + (1. - al) * saturate(-i.sl.z) * .6; // 랩 조명 + 역광 테두리
  var sf = saturate((i.k.z + 1.) / (.5 * i.k.w + 1.)); // 수면 근처 페이드
  if (g.sun.w > 1.5) { sf *= saturate((g.misc.x / max(textureLoad(dT, vec2i(i.pos.xy), 0), 1e-7) - g.misc.x / i.pos.z) / (.5 * i.k.w)); }
  let col = i.c.rgb * lit + i.d.rgb * (.65 + .35 * dot(N, i.up)) * (1.15 - .6 * n) + i.e.rgb;
  if (ty == 0) { // 불: 흑체 램프(백열 심) → 얼룩지게 식으며 그을음 연기로
    let h = saturate(d * 2.) * (1. - smoothstep(0., .7, t + n * .3));
    let a0 = min(al * A * i.sl.w * smoothstep(.1, .5, t), 1.);
    return vec4f(((vec3f(1., .3, .06) * h * 4. + vec3f(.9, .75, .5) * h * h * h * 16.) * A * i.e.a + col * a0) * sf, a0 * sf);
  }
  let a2 = min(al * A, 1.) * sf;
  return vec4f(col * a2, a2);
}`;
  // 행: [종류, 개수|초당, 수명, 크기0, 크기1, 구속도, 반경, 방향속도|상속률, 세기, 명암, 수직 납작]
  const B = {
    explosion: [[1, 22, 6, 6, 18, 11, 6, 8, 1.2, .02], [0, 26, 1.5, 5, 13, 26, 3, 3, 1.6, 1.3], [2, 40, 1.6, .3, .3, 75, 2, 14], [4, .05, .22, 55, 70], [5, .05, .4, 8, 90, 0, 0, 0, .6], [7, 5, 2.4, 0, 0, 42, 0, 16]],
    flash: [[1, 9, 3.5, 6, 16, 6, 4, 0, .7, .4], [0, 12, .75, 4, 9, 16, 2, 0, 1.4, .8], [2, 34, .8, .3, .3, 110, 1], [5, .05, .55, 6, 80], [4, .05, .18, 70, 85, 0, 0, 0, 1.6], [7, 4, 2, 0, 0, 45]],
    splash: [[1, 14, 4.5, 5, 15, 10, 3, 0, .22, .6, .15], [3, 26, 2.6, 3.5, 8, 10, 4, 24, .8, .6, .4], [3, 40, 3.4, 3, 7, 3, 2, 52, .9, .6], [3, 30, 2.2, .5, 1.2, 14, 2, 46, .9, .8]],
    launch: [[1, 40, 4.5, 5, 16, 10, 3, -3, .5, .8, .35], [0, 20, .45, 3, 6, 5, 1, 70, 2.5], [4, .05, .12, 20, 26]],
    muzzle: [[1, 6, 2, 1.6, 7, 4, .5, 16, .6, .45], [0, 6, .15, 2.5, 5, 8, .3, 70, 2], [4, .05, .08, 16, 20]],
    hit: [[1, 3, 1.2, 1, 3.5, 3, .5, 0, .5, .3], [2, 18, .55, .2, .2, 38, .5, 12], [4, .05, .08, 6, 8, 0, 0, 0, .6]],
    smoke: [[1, 1, 3.2, 5, 14, 2, 2, 3, 1, .03]]
  }, T = {
    missile: [[1, 40, 5, 1.8, 7, 1.6, .6, .05, .75, .85], [0, 24, .1, 1.8, .8, 2, .3, .9, 1.4], [4, 30, .06, 5, 5, 0, 0, 1, .12]],
    jet: [[1, 40, 1, 1.5, 3.5, .8, .4, .03, .07, 1], [0, 22, .07, 1.3, .6, 1.5, .2, .92]],
    fire: [[1, 11, 6, 5, 17, 2.5, 4, 0, 1.2, .02], [0, 22, .7, 5, 10, 3, 6, 0, 2.2, .4]],
    stack: [[1, 5, 2.6, 2.2, 8, 1.2, 1, .5, .12, .12]],
    wake: [[3, 24, 1.4, 1.2, 4, 5, 3, .4, .45, .9]],
    frag: [[1, 22, 1.8, 1.4, 4, .8, .3, .1, .35, .15], [0, 14, .25, 2.5, 1, 1, .2, .8]]
  };
  // d 방향(궤적: 속도), v 추가 속도, s 크기 배율, td 궤적 dt (버스트 0). 할당 없음
  const run = (rows, p, d, v, s, td) => {
    for (let ri = 0; rows && ri < rows.length; ri++) {
      const r = rows[ri], ty = r[0], life = r[2], vr = r[5] || 0, pr = r[6] || 0, vd = r[7] || 0, q = ty == 2 || ty == 3 ? Math.sqrt(s) : s,
        st = ty == 1 ? td && vd && 1 / (r[1] * KN * vd) : ST[ty]; // 궤적 연기: 간격만큼 늘림
      let n = r[1] * (ty > 6 || life < .3 ? 1 : KN) * (td || s) + (td ? r[11] || 0 : .99); // 짧은 불꽃·파편은 티어 무관
      if (td) r[11] = n % 1; // 나머지 이월
      n |= 0;
      for (let i = 0; i < n && N; i++) {
        const a = R() * 6.283, y = R() * 2 - 1, h = Math.sqrt(1 - y * y), k = pr * s * R(), w = vr * q * (.3 + .7 * R()),
          u = vd * q * (ty == 6 ? 1 : .5 + .5 * R()), f = (i + R()) / n * td, l = life * (td && life > 1.5 ? KL : 1) * (.7 + .6 * R()), g = s * (ty > 3 ? 1 : KS) * (.75 + .5 * R());
        let o = cur * F;
        E[0] = Math.cos(a) * h; E[1] = y * (r[10] || 1); E[2] = Math.sin(a) * h;
        if (ty > 6) { // 파편 풀
          o = (fi = (fi + 1) % 64) * 7; FR[o + 6] = l;
          for (let j = 0; j < 3; j++) { FR[o + j] = p[j]; FR[o + 3 + j] = E[j] * w + d[j] * u; }
          continue;
        }
        for (let j = 0; j < 3; j++) { S[o + j] = p[j] + E[j] * k - v[j] * f; S[o + 4 + j] = d[j] * u + E[j] * w + (td ? 0 : v[j]); } // 구간 분산
        S[o + 3] = f; S[o + 7] = l; S[o + 8] = r[3] * g; S[o + 9] = r[4] * g; S[o + 10] = ty; S[o + 11] = R(); S[o + 12] = r[9] || 0; S[o + 13] = (r[8] || 1) * KA; S[o + 14] = st;
        S[o + 15] = E[0] * G.sun.dir[0] + E[1] * G.sun.dir[1] + E[2] * G.sun.dir[2];
        die[cur] = G.time + l; cur = (cur + 1) % N; cnt++;
      }
    }
  };
  G.fx = {
    burst(kind, p, o) { run(B[kind], p, o && o.dir || UP, o && o.vel || Z, o && o.size || 1, 0); },
    trail(p, v, kind, dt) { dt > 0 && run(T[kind], p, v, v, 1, dt); }, // 추가 종류: 'wake' (함수 물보라)
    tracer(p, d, sp = 900) { TR[0][7] = sp; run(TR, p, d, Z, 1, 0); },
    get alive() { let n = 0; for (let i = 0; i < N; i++) n += die[i] > G.time; return n; }
  };
  G.register('fx', {
    init() {
      const dev = G.dev; sm = G.shader(WGSL, 'fx');
      bgl = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }] });
      bglD = dev.createBindGroupLayout({ entries: [{ binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } }] });
      cp = dev.createComputePipeline({ layout: G.layout(bgl), compute: { module: sm, entryPoint: 'cs' } });
    },
    onQuality(Q) { // 티어 배율 [개수, 수명, 크기, 세기] + 버퍼. MSAA 샘플 수가 바뀌면 파이프라인 재생성
      const dev = G.dev, one = { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' };
      [KN, KL, KS, KA] = [[.3, .7, 1.5, 1.5], [1, 1, 1, 1], [2.5, 1.2, .8, 1]][Q.level];
      if (ms != Q.msaa) rp = dev.createRenderPipeline({
        layout: G.layout(bglD), primitive: { topology: 'triangle-strip' }, depthStencil: { format: G.DEPTH, depthWriteEnabled: false, depthCompare: 'greater' }, multisample: { count: ms = Q.msaa },
        vertex: { module: sm, entryPoint: 'vs', buffers: [{ arrayStride: 64, stepMode: 'instance', attributes: [0, 1, 2, 3].map(i => ({ shaderLocation: i, offset: i * 16, format: 'float32x4' })) }] },
        fragment: { module: sm, entryPoint: 'fs', targets: [{ format: G.HDR, blend: { color: one, alpha: one } }] } // 가산 = 알파 0
      });
      N = Q.particles; S = new Float32Array(N * F); die = new Float32Array(N); cur = cnt = 0; FR.fill(0); buf && buf.destroy();
      buf = dev.createBuffer({ size: Math.ceil(N / 64) * 4096, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      bg = dev.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: { buffer: buf } }] });
    },
    onResize() { bgD = G.dev.createBindGroup({ layout: bglD, entries: [{ binding: 1, resource: G.targets.depthCopyView }] }); }, // 크기 의존: 깊이 바인딩뿐
    update(dt) { // 파편: 탄도 + 연기 꼬리
      for (let o = 0; o < 448; o += 7) if (FR[o + 6] > 0) {
        FR[o + 4] -= 9.8 * dt;
        for (let j = 0; j < 3; j++) { fp[j] = FR[o + j] += FR[o + 3 + j] * dt; fv[j] = FR[o + 3 + j]; }
        FR[o + 6] = fp[1] > 0 ? FR[o + 6] - dt : 0; G.fx.trail(fp, fv, 'frag', dt);
      }
    },
    prepare() { // 새로 쓴 링 구간만 업로드
      for (let a = (cur - cnt % N + N) % N, n; cnt > 0; cnt -= n, a = 0) G.dev.queue.writeBuffer(buf, a * 64, S, a * F, (n = Math.min(cnt, N - a)) * F);
    },
    compute(enc) {
      const p = enc.beginComputePass(); p.setPipeline(cp); p.setBindGroup(0, G.bg0); p.setBindGroup(1, bg); p.dispatchWorkgroups(Math.ceil(N / 64)); p.end();
    },
    transparent(p) { p.setPipeline(rp); p.setBindGroup(1, bgD); p.setVertexBuffer(0, buf); p.draw(4, N); }
  });
}
