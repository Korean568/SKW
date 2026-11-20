'use strict';
{ /* FX — GPU 파티클(컴퓨트 시뮬 + 볼륨 셰이딩 빌보드)과 전투 효과 */
  const F = 16, R = G.rng(5), Z = [0, 0, 0], UP = [0, 1, 0], ST = [.03, 0, .05, .12, 0, 0, .012], // ST: 종류별 속도 늘림(초)
    E = [0, 0, 0], FR = new Float32Array(448), fp = [0, 0, 0], fv = [0, 0, 0], LC = [1, .5, .2], // FR: 파편 풀 64×7
    TR = [[6, .05, .6, 1, 1, 0, 0, 900]], TM = [[4, .05, .05, 3, 4, 0, 0, 0, .3], [1, 1, 1.4, .6, 3, 1.5, .2, 8, .22, .5]]; // 예광탄 · 포구 섬광+포연
  let N = 0, S, die, buf, bg, bgD, bgl, bglD, rp, cp, sm, ms = 0, cur = 0, cnt = 0, fi = 0, tn = 0, KN = 1, KL = 1, KS = 1, KA = 1;
  // 종류: 0 불 1 연기 2 불티 3 물 4 섬광 5 충격파 6 예광탄 (7 = CPU 파편, 8 = 점광)
  const WGSL = /* wgsl */`
struct P { p: vec3f, age: f32, v: vec3f, life: f32, s: vec4f, c: vec4f }; // s: 크기0,크기1,종류,시드  c: 명암(불: 그을음),세기,늘림(연기: 궤적 조각),해쪽
@group(1) @binding(0) var<storage, read_write> ps: array<P>;
@group(1) @binding(1) var dT: texture_depth_2d; // 불투명 깊이 (HIGH 소프트 파티클)
const DRAG = array<f32, 7>(1.6, 0., .25, .15, 0., 0., 0.);
const GRAV = array<f32, 7>(12., 0., -9.8, -30., 0., 0., -1.);
const FADE = array<f32, 7>(1., .9, 1., .6, 2., 2., .15);
const GAIN = array<f32, 7>(1., 0., 5., 0., 40., .5, 7.);
@compute @workgroup_size(64) fn cs(@builtin(global_invocation_id) id: vec3u) {
  var q = ps[id.x]; if (q.age >= q.life) { return; }
  let dt = g.misc.y; let ty = u32(q.s.z); let w = g.wind.xy * g.wind.z * .6;
  var a = vec3f(0., GRAV[ty], 0.) - q.v * DRAG[ty];
  if (ty == 1u) { a = (vec3f(w.x, 8.4 - 8. * q.c.x, w.y) - q.v) * .9 + sin(q.p.yzx * .12 + g.cam.w) * 5.; }
  if (ty == 1u && q.c.z > 0.) { // 궤적 조각: v = 축(반길이) 고정, 바람에 실려 천천히 표류
    q.p += (vec3f(w.x, 1., w.y) * min(q.age, 1.) + sin(q.p.yzx * .02 + g.cam.w * .3) * 1.5) * dt;
  } else { q.v += a * dt; q.p += q.v * dt; }
  q.age += dt;
  if ((ty == 2u || ty == 3u) && q.p.y < -1.) { q.age = q.life; } // 수면 아래 소멸
  ps[id.x] = q;
}
// c: 양지색+알파, d: 환경색+나이, e: 점광·밑불빛·안개+투과, k: 종류,시드,수면 위 높이,크기, sl: 스프라이트 기준 해 방향+그을음, up: 위 방향+길이비
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) c: vec4f, @location(2) d: vec4f, @location(3) e: vec4f, @location(4) k: vec4f, @location(5) sl: vec4f, @location(6) up: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f, @location(2) s: vec4f, @location(3) c: vec4f) -> V {
  var o: V; if (a.w >= b.w) { return o; } // 죽은 입자 = 퇴화 쿼드
  let ty = i32(s.z); let t = a.w / b.w;
  let cv = g.cam.xyz - a.xyz; let dist = length(cv); let f = cv / dist; let px = dist * 1.1 / g.res.y; // px: 1픽셀의 월드 크기
  var sz = min(mix(s.x, s.y, sqrt(t)), dist * .3); var len = 1.; var en = 1.; // 화면 크기 상한
  var r = normalize(cross(vec3f(0., 1., 0.), f) + 1e-5); var u = cross(f, r);
  if (c.z > 0.) { // 속도(축) 방향 캡슐. 불티·예광탄은 최소 폭 3px + 밝기 보정
    let sp = length(b.xyz) + .01; u = b.xyz / sp; r = normalize(cross(u, f) + 1e-5);
    let w = max(sz, px * 3. * f32(ty == 2 || ty == 6)); en = max(sz / w, .3); sz = w; len = 1. + sp * c.z / sz;
  } else { // 시드 회전 + 느린 자전
    let an = s.w * 6.283 + t * (s.w - .5) * 2.; let r0 = r; r = r * cos(an) + u * sin(an); u = u * cos(an) - r0 * sin(an);
  }
  if (ty == 4) { let w = max(sz, px * 4.5); en = max(sz / w, .5); sz = w; } // 먼 분사 불꽃도 밝은 점으로
  o.uv = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2. - 1.;
  let w = a.xyz + (r * o.uv.x + u * o.uv.y * len) * sz;
  o.pos = g.viewProj * vec4f(w, 1.);
  if (ty == 4) { o.pos.z *= 1.3; } // 섬광은 선체 앞에
  let tr = exp(-dist * g.fog.x * (1. + 2. * g.fog.z));
  let A = c.y * pow(1. - t, FADE[ty]) * en * smoothstep(.5, 2., dist / sz) * select(1., smoothstep(20., 110., dist), ty == 6); // 렌즈 앞 페이드
  o.k = vec4f(s.zw, w.y - gerstner(a.xz, g.cam.w).y, sz); o.d.a = t; o.up.w = len;
  o.c = vec4f(vec3f(1., .6, .3) * GAIN[ty] * tr, A);
  if (ty > 1 && ty != 3) { return o; }
  // 볼륨(불·연기·물): 입자 단위 조명 — 해(그림자)·하늘·점광·안개
  let alb = select(c.x * (.8 + .4 * s.w), .1, ty == 0);
  var pl = vec3f(0.);
  for (var j = 0; j < 4; j++) { let l = g.lights[j * 2]; let q = max(1. - distance(l.xyz, a.xyz) / max(l.w, 1.), 0.); pl += g.lights[j * 2 + 1].rgb * q * q; }
  let gl = vec3f(1., .33, .07) * max(1. - c.x * 3., 0.) * exp(-t * 10.) * f32(ty == 1) * 2.5; // 어린 검은 연기: 불빛에 달아오른 밑동
  o.c = vec4f(g.sunCol.rgb * shadowAt(a.xyz, g.sun.xyz * 3.) * cloudVis(a.xyz) * (.6 + .4 * c.w) * alb * tr, A * smoothstep(0., .02, t));
  o.d = vec4f(skyBase(vec3f(0., .25, 0.)) * alb * tr, t);
  o.e = vec4f((pl * alb * .3 + gl) * tr + fogAt(vec3f(0.), a.xyz), tr);
  o.sl = vec4f(dot(g.sun.xyz, r), dot(g.sun.xyz, u), dot(g.sun.xyz, f), c.x);
  o.up = vec4f(r.y, u.y, f.y, len);
  return o;
}
fn nz(p: vec2f) -> vec4f { // 부드러운 값 잡음 (백색 잡음 + 스무스 보간)
  let x = p * 256.; let i = floor(x); let f = x - i;
  return textureSampleLevel(noiseTex, linSamp, (i + f * f * (3. - 2. * f) + .5) / 256., 0.);
}
@fragment fn fs(i: V) -> @location(0) vec4f {
  let ty = i32(i.k.x + .5); let L = i.up.w; let A = i.c.a; let t = i.d.a;
  let y = i.uv.y * L; let uv = vec2f(i.uv.x, sign(y) * max(abs(y) - L + 1., 0.)); // 캡슐 좌표 (끝은 반구)
  let r2 = dot(uv, uv); let m = max(1. - r2, 0.);
  if (ty == 2 || ty == 6) { // 불티·예광탄: 백열 심 + 주황 후광, 꼬리로 가늘어지며 감쇠
    let h = i.uv.y * .5 + .5; let w = saturate(1. - abs(uv.x) / (.3 + .7 * h));
    return vec4f(i.c.r * A * h * h * smoothstep(1., .9, h) * (vec3f(1., .45, .12) * w * w + vec3f(1., .85, .6) * pow(w, 6.) * 4.), 0.);
  }
  if (ty == 4) { return vec4f(i.c.rgb * A * (exp(-r2 * 9.) * m + .08 * m * m * m), 0.); }
  if (ty == 5) { let e = (sqrt(r2) - .85) * 14.; return vec4f(vec3f(i.c.r * A * (exp(-e * e) + .04 * m)), 0.); }
  // 볼륨 퍼프: 부드러운 방사 알파를 저주파 잡음으로 완만히 침식 + 해 쪽 표본으로 자기 그림자
  let fl = f32(ty == 0);
  let q = vec2f(uv.x, y) * (.011 - .003 * fl) + i.k.y * vec2f(7., 3.) - vec2f(0., t * (.008 + .05 * fl));
  let n1 = nz(q); let n2 = nz(q * 2.9 + n1.gb * .012).r; let n = n1.r * .65 + n2 * .35;
  let d = m - n * (.3 + .5 * t); let al = smoothstep(0., .6, d);
  let ns = nz(q + i.sl.xy * .003).r * .65 + n2 * .35;
  let N = vec3f(uv, sqrt(m));
  let lit = saturate((dot(N, i.sl.xyz) + (ns - n) * 2. + .6) / 1.6) + (1. - al) * saturate(-i.sl.z) * .5; // 랩 조명 + 역광 테두리
  var sf = saturate((i.k.z + 1.) / (.5 * i.k.w + 1.)); // 수면 근처 페이드
  if (g.sun.w > 1.5) { sf *= saturate((g.misc.x / max(textureLoad(dT, vec2i(i.pos.xy), 0), 1e-7) - g.misc.x / i.pos.z) / (.5 * i.k.w)); }
  let col = i.c.rgb * lit + i.d.rgb * (.65 + .35 * dot(N, i.up.xyz)) * (1.15 - .5 * n) + i.e.rgb;
  if (ty == 0) { // 불: 흑체 램프(백열 심) → 얼룩지게 식으며 그을음 연기로
    let h = saturate(d * 1.6) * (1. - smoothstep(.15, .9, t + n * .3));
    let a0 = al * min(A * i.sl.w, 1.) * smoothstep(.15, .6, t) * .7;
    return vec4f(((vec3f(1., .25, .04) * h * 3. + vec3f(1., .6, .2) * h * h * 9. + vec3f(.8, .8, .6) * pow(h, 4.) * 24.) * min(A, 3.) * i.e.a + col * a0) * sf, a0 * sf);
  }
  let a2 = al * min(A, .85) * sf * select( // 궤적 조각: 길이 방향 창으로 겹침
   1., 1. - smoothstep(0., 1., abs(i.uv.y)), ty == 1 && L > 1.);
  return vec4f(col * a2, a2);
}`;
  // 행: [종류, 개수|초당, 수명, 크기0, 크기1, 구속도, 반경, 방향속도|상속률(궤적 연기 음수 = 조각), 세기, 명암, 수직 납작]
  const B = {
    explosion: [[1, 24, 6, 5, 15, 10, 6, 7, .9, .12], [0, 22, 1.3, 4, 12, 24, 3, 3, 1.6, 1], [2, 40, 1.6, .3, .3, 75, 2, 14], [4, .05, .25, 50, 65], [5, .05, .4, 8, 90, 0, 0, 0, .6], [7, 5, 2.4, 0, 0, 42, 0, 16]],
    flash: [[1, 9, 3.5, 6, 16, 6, 4, 0, .5, .4], [0, 12, .75, 4, 9, 16, 2, 0, 1.4, .8], [2, 34, .8, .3, .3, 110, 1], [5, .05, .55, 6, 80], [4, .05, .18, 70, 85, 0, 0, 0, 1.6], [7, 4, 2, 0, 0, 45]],
    splash: [[1, 12, 4, 5, 15, 9, 3, 0, .22, .9, .15], [3, 26, 2.6, 3, 8, 10, 4, 24, .6, .95, .4], [3, 40, 3.2, 2.5, 6, 3, 2, 52, .7, 1], [3, 30, 2.2, .5, 1.2, 14, 2, 46, .9, 1]],
    launch: [[1, 10, 2, 3, 9, 8, 2, -3, .25, .85, .3], [0, 16, .4, 2.5, 5, 5, 1, 60, 2.5], [4, .05, .12, 18, 24], [8, 1, .3, 0, 160, 0, 0, 0, 14]],
    muzzle: [[1, 6, 2, 1.6, 7, 4, .5, 16, .4, .45], [0, 6, .15, 2.5, 5, 8, .3, 70, 2], [4, .05, .08, 16, 20]],
    hit: [[1, 3, 1.2, 1, 3.5, 3, .5, 0, .5, .35], [2, 18, .55, .2, .2, 38, .5, 12], [4, .05, .08, 6, 8, 0, 0, 0, .6]],
    smoke: [[1, 1, 3.2, 5, 14, 2, 2, 3, .6, .13]]
  }, T = {
    missile: [[1, 30, 5, 1.4, 5.5, 0, .3, -1, .55, .8], [0, 24, .1, 1.8, .8, 2, .3, .9, 1.6], [4, 30, .07, 6, 6, 0, 0, 1, .22]],
    jet: [[1, 14, 1.4, 1.2, 3, 0, .3, -1, .1, 1], [0, 22, .07, 1.3, .6, 1.5, .2, .92, 1.5], [4, 30, .07, 3.5, 3.5, 0, 0, 1, .2]],
    fire: [[1, 9, 6, 4, 15, 2.5, 4, 0, .8, .12], [0, 26, .8, 2.5, 6, 3, 5, 0, 2.2, .35], [4, 10, .28, 26, 30, 0, 0, 0, .02], [8, 5, .4, 0, 220, 0, 0, 0, 6]],
    stack: [[1, 5, 2.6, 2.2, 8, 1.2, 1, .5, .12, .34]],
    wake: [[3, 24, 1.4, 1.2, 4, 5, 3, .4, .45, .9]],
    frag: [[1, 22, 1.8, 1.4, 4, .8, .3, .1, .35, .15], [0, 14, .25, 2.5, 1, 1, .2, .8]]
  };
  // d 방향(궤적: 속도), v 추가 속도, s 크기 배율, td 궤적 dt (버스트 0). 할당 없음
  const run = (rows, p, d, v, s, td) => {
    for (let ri = 0; rows && ri < rows.length; ri++) {
      const r = rows[ri], ty = r[0], life = r[2], vr = r[5] || 0, pr = r[6] || 0, vd = r[7] || 0, q = ty == 2 || ty == 3 ? Math.sqrt(s) : s,
        seg = td && vd < 0 && 1 / (r[1] * KN), lv = seg ? .1 : .3; // 궤적 조각: 축 = 속도 × 방출 간격
      let n = r[1] * (ty > 6 || life < .3 ? 1 : KN) * (td || s) + (td ? r[11] || 0 : .99); // 짧은 불꽃·파편·점광은 티어 무관
      if (td) r[11] = n % 1; // 나머지 이월
      n |= 0;
      for (let i = 0; i < n && N; i++) {
        const a = R() * 6.283, y = R() * 2 - 1, h = Math.sqrt(1 - y * y), k = pr * s * R(), w = seg ? 0 : vr * q * (.3 + .7 * R()),
          u = seg || vd * q * (ty > 3 ? 1 : .5 + .5 * R()), f = (i + (seg ? .5 : R())) / n * td, l = life * (td && life > 1.5 ? KL : 1) * (1 - lv + 2 * lv * R()), g = s * (ty > 3 ? 1 : KS) * (.75 + .5 * R());
        let o = cur * F;
        if (ty > 7) { E[0] = p[0]; E[1] = p[1] + 6; E[2] = p[2]; G.addLight(E, LC, r[8] * s, r[4], l); continue; }
        E[0] = Math.cos(a) * h; E[1] = y * (r[10] || 1); E[2] = Math.sin(a) * h;
        if (ty > 6) { // 파편 풀
          o = (fi = (fi + 1) % 64) * 7; FR[o + 6] = l;
          for (let j = 0; j < 3; j++) { FR[o + j] = p[j]; FR[o + 3 + j] = E[j] * w + d[j] * u; }
          continue;
        }
        for (let j = 0; j < 3; j++) { S[o + j] = p[j] + E[j] * k - v[j] * f; S[o + 4 + j] = d[j] * u + E[j] * w + (td ? 0 : v[j]); } // 구간 분산
        S[o + 3] = f; S[o + 7] = l; S[o + 8] = r[3] * g; S[o + 9] = r[4] * g; S[o + 10] = ty; S[o + 11] = R(); S[o + 12] = r[9] || 0; S[o + 13] = (r[8] || 1) * KA; S[o + 14] = seg ? 1 : ST[ty];
        S[o + 15] = E[0] * G.sun.dir[0] + E[1] * G.sun.dir[1] + E[2] * G.sun.dir[2];
        die[cur] = G.time + l; cur = (cur + 1) % N; cnt++;
      }
    }
  };
  G.fx = {
    burst(kind, p, o) { run(B[kind], p, o && o.dir || UP, o && o.vel || Z, o && o.size || 1, 0); },
    trail(p, v, kind, dt) { dt > 0 && run(T[kind], p, v, v, 1, dt); }, // 추가 종류: 'wake' (함수 물보라)
    tracer(p, d, sp = 900) { TR[0][7] = sp; run(TR, p, d, Z, 1, 0); tn++ % 3 || run(TM, p, d, Z, 1, 0); },
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
