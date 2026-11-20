'use strict';
{ /* FX — GPU 파티클(컴퓨트 시뮬 + 볼륨 셰이딩 빌보드)과 전투 효과 */
  const F = 16, R = G.rng(5), Z = [0, 0, 0], UP = [0, 1, 0], ST = [.03, 0, .05, .12, 0, 0, .012],
    E = [0, 0, 0], FR = new Float32Array(448), fp = [0, 0, 0], fv = [0, 0, 0], LC = [1, .5, .2],
    TR = [[6, .05, .9, 1, 1, 0, 0, 900, 2]], TM = [[4, .05, .09, 3, 4.5, 0, 0, 0, .35], [1, 1, 1.6, .6, 3.5, 1.5, .2, 8, .25, .5]], C = [0, 0], W = [0, 0];
  let N = 0, S, die, buf, bg, bgD, bgl, bglD, rp, cp, sm, ms = 0, NS = 0, fi = 0, tn = 0, KN = 1, KL = 1, KS = 1, KA = 1;
  // 종류: 0 불 1 연기 2 불티 3 물줄기 4 섬광·광점 5 고리 6 예광탄 (7 CPU 파편, 8 점광)
  const WGSL = /* wgsl */`
struct P { p: vec3f, age: f32, v: vec3f, life: f32, s: vec4f, c: vec4f }; // s: 크기0,크기1,종류,시드 c: 명암,세기,늘림,해쪽
@group(1) @binding(0) var<storage, read_write> ps: array<P>;
@group(1) @binding(1) var dT: texture_depth_2d;
const DRAG = array<f32, 7>(1.6, 0., .25, .15, 0., 0., 0.);
const GRAV = array<f32, 7>(30., 0., -9.8, -14., 0., 0., -1.);
const FADE = array<f32, 7>(1., 1.3, 1., .6, 2., 2., .15);
const GAIN = array<f32, 7>(1., 0., 5., 0., 40., 1., 5.);
@compute @workgroup_size(64) fn cs(@builtin(global_invocation_id) id: vec3u) {
  var q = ps[id.x]; if (q.age >= q.life) { return; }
  let dt = g.misc.y; let ty = u32(q.s.z); let w = g.wind.xy * g.wind.z * min(.3 + q.p.y * .012, 1.2); // 바람 전단
  var a = vec3f(0., GRAV[ty], 0.) - q.v * DRAG[ty];
  if (ty == 1u) { a = (vec3f(w.x, (8.4 - 8. * q.c.x) * (.4 + 1.2 * q.s.w), w.y) - q.v) * .9 + sin(q.p.yzx * .12 + g.cam.w) * 5.; }
  if (ty == 1u && q.c.z > 0.) { // 궤적 조각: v = 축. 바람 + 저주파 난류 + 조각별 표류
    q.p += (vec3f(w.x, .5, w.y) * min(q.age, 1.) + sin(q.p.yzx * .025 + g.cam.w * .3) * 3.5 + sin(q.s.w * vec3f(40., 23., 57.)) * 1.3) * dt;
  } else { q.v += a * dt; q.p += q.v * dt; }
  q.age += dt;
  if ((ty == 2u || ty == 3u) && q.p.y < -1.) { q.age = q.life; }
  ps[id.x] = q;
}
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) c: vec4f, @location(2) d: vec4f, @location(3) e: vec4f, @location(4) k: vec4f, @location(5) sl: vec4f, @location(6) up: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f, @location(2) s: vec4f, @location(3) c: vec4f) -> V {
  var o: V; if (a.w >= b.w) { return o; }
  let ty = i32(s.z); let t = max(a.w, 0.) / b.w; let sg = ty == 1 && c.z > 0.; let hz = ty == 5 && a.y < 30.;
  let cv = g.cam.xyz - a.xyz; let dist = length(cv); let f = cv / dist; let px = dist * 1.1 / g.res.y; // px: 픽셀 크기
  var sz = min(mix(s.x, s.y, sqrt(t)), dist * .3); var len = 1.; var en = 1.;
  var r = normalize(cross(vec3f(0., 1., 0.), f) + 1e-5); var u = cross(f, r);
  if (c.z > 0.) { // 속도 방향 캡슐: 축을 화면에 투영 (시선과 나란한 궤적도 사라지지 않음)
    let sp = length(b.xyz) + .01; let pa = b.xyz / sp - f * dot(b.xyz / sp, f); var hl = sp * c.z * length(pa);
    u = normalize(pa + u * .001); r = cross(u, f);
    if (ty == 2 || ty == 6) { sz = px; hl = clamp(hl, sz * 3., px * 13.); en = clamp(150. / dist, .3, 1.); } // 선: 가늘고 길이 제한, 멀수록 옅게
    else { let w = max(sz, px * 2. * f32(sg)); en = max(sz / w, .3); sz = w; if (ty == 3) { hl = clamp(hl, sz * 3., sz * 10.); } } // 먼 연기: 가늘어지는 대신 옅어짐
    len = 1. + hl / sz;
  } else {
    let an = s.w * 6.283 + t * (s.w - .5) * 2.; let r0 = r; r = r * cos(an) + u * sin(an); u = u * cos(an) - r0 * sin(an);
  }
  if (hz) { r = vec3f(1., 0., 0.); u = vec3f(0., 0., 1.); }
  if (ty == 4) { let w = max(sz, px * 7.); en = max(sz / w, .5); sz = w; } // 먼 엔진·불꽃: 7px 후광 + 2px 심
  o.uv = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2. - 1.;
  var w = a.xyz + (r * o.uv.x + u * o.uv.y * len) * sz; if (hz) { w.y = 1.5; }
  o.pos = g.viewProj * vec4f(w, 1.);
  if (ty == 4) { o.pos.z *= 1.3; }
  let tr = exp(-dist * g.fog.x * (1. + 2. * g.fog.z));
  let A = c.y * pow(1. - t, FADE[ty]) * en * smoothstep(.5, 2., dist / sz);
  o.k = vec4f(s.zw, w.y - gerstner(a.xz, g.cam.w).y, sz); o.d.a = t; o.up.w = len;
  o.c = vec4f(vec3f(1., .6, .3) * GAIN[ty] * tr, A);
  if (ty > 1 && ty != 3) { return o; }
  let alb = select(c.x * (.8 + .4 * s.w), .1, ty == 0);
  var pl = vec3f(0.);
  for (var j = 0; j < 4; j++) { let l = g.lights[j * 2]; let q = max(1. - distance(l.xyz, a.xyz) / max(l.w, 1.), 0.); pl += g.lights[j * 2 + 1].rgb * q * q * q * q; }
  let sn = g.sunCol.rgb * shadowAt(a.xyz, g.sun.xyz * 3.) * cloudVis(a.xyz) * alb * tr;
  o.c = vec4f(sn * (.6 + .4 * c.w), A * smoothstep(0., .02, t));
  o.d = vec4f(skyBase(vec3f(0., .25, 0.)) * alb * tr, t);
  o.e = vec4f(pl * (.012 + alb * .25) * tr + sn * .5 * f32(ty == 3) + skyBase(-f) * (alb * c.x * tr * 1.3 * saturate(dist / 500. - .4)) + fogAt(vec3f(0.), a.xyz), tr);
  o.sl = vec4f(dot(g.sun.xyz, r), dot(g.sun.xyz, u), dot(g.sun.xyz, f), c.x);
  o.up = vec4f(r.y, u.y, f.y, len);
  return o;
}
fn nz(p: vec2f) -> vec4f { // 부드러운 값 잡음
  let x = p * 256.; let i = floor(x); let f = x - i;
  return textureSampleLevel(noiseTex, linSamp, (i + f * f * (3. - 2. * f) + .5) / 256., 0.);
}
@fragment fn fs(i: V) -> @location(0) vec4f {
  let nf = saturate(.1 / fwidth(i.uv.x) - .3); // 점묘 방지
  let ty = i32(i.k.x + .5); let L = i.up.w; let A = i.c.a; let t = i.d.a;
  let y = i.uv.y * L; let uv = vec2f(i.uv.x, sign(y) * max(abs(y) - L + 1., 0.)); // 캡슐 좌표
  let r2 = dot(uv, uv); let m = max(1. - r2, 0.);
  if (ty == 2 || ty == 6) { // 불티·예광탄: 가는 선
    let h = i.uv.y * .5 + .5; let w = 1. - abs(i.uv.x);
    return vec4f(i.c.r * A * h * smoothstep(1., .85, h) * (vec3f(1., .4, .1) * w + vec3f(1., .8, .5) * w * w * w * 2.5), 0.);
  }
  if (ty == 4) { return vec4f(i.c.rgb * A * (exp(-r2 * 12.) * m + .1 * m * m * m), 0.); }
  if (ty == 5) { let e = (sqrt(r2) - .8) * 6.; return vec4f(vec3f(i.c.r * A * (exp(-e * e) + .04 * m)), 0.); }
  var sf = saturate((i.k.z + 1.) / (.5 * i.k.w + 1.));
  if (g.sun.w > 1.5) { sf *= saturate((g.misc.x / max(textureLoad(dT, vec2i(i.pos.xy), 0), 1e-7) - g.misc.x / i.pos.z) / (.5 * i.k.w)); }
  let fl = f32(ty == 0);
  let q = vec2f(uv.x, y) * (.006 - .001 * fl) + i.k.y * vec2f(7., 3.) - vec2f(0., t * (.008 + .05 * fl));
  if (ty == 3) { // 물줄기: 속도 방향으로 늘인 잡음, 반투명
    let n = mix(.5, nz(vec2f(q.x, q.y * .15)).r, nf);
    let a = m * m * smoothstep(.1, .7, n + m * .3) * min(A, 1.) * (.25 + .5 * i.k.y) * (.4 + .6 * abs(i.uv.y)) * sf;
    return vec4f((i.c.rgb * (.25 + .75 * saturate(.5 + i.uv.x * i.sl.x) + (1. - m) * saturate(-i.sl.z)) + i.d.rgb * vec3f(.75, .95, 1.2) + i.e.rgb) * a, a);
  }
  let n1 = nz(q); let n2 = nz(q * 2.6 + n1.gb * .012).r; let n0 = n1.r * .65 + n2 * .35; let n = mix(.5, n0, nf);
  let d = m - n * (.4 + .5 * t + .2 * fl); let al = smoothstep(0., .6, d);
  let ns = nz(q + i.sl.xy * .003).r * .65 + n2 * .35;
  let N = vec3f(uv, sqrt(m));
  let lit = saturate((dot(N, i.sl.xyz) + (ns - n0) * 2. * nf + .3) / 1.3) + (1.3 - al) * saturate(-i.sl.z) * .5; // 랩 조명 + 역광 테두리
  let col = i.c.rgb * lit + i.d.rgb * (.55 + .4 * dot(N, i.up.xyz)) * (1.15 - .5 * n) + i.e.rgb;
  if (ty == 0) { // 불: 흑체 램프, 알파로 서로 가림 → 식으며 그을음
    let h = saturate(d * 1.5) * (1. - smoothstep(.05, .95, t + n * .35)) * min(A, 1.);
    let af = smoothstep(0., .45, h); let a0 = al * min(A * i.sl.w, 1.) * smoothstep(.15, .6, t) * .5;
    return vec4f(((vec3f(1., .2, .03) * h * 2. + vec3f(1., .5, .1) * h * h * 4. + vec3f(.9, .9, .7) * pow(h, 4.) * 3.5) * af * i.e.a + col * a0 * (1. - af)) * sf, max(af, a0) * sf);
  }
  let a2 = al * min(A, .85) * sf * select(1., 1. - smoothstep(0., 1., abs(i.uv.y)), ty == 1 && L > 1.); // 궤적 조각은 길이 창으로 겹침
  return vec4f(col * a2, a2);
}`;
  // 행: [종류, 개수|초당, 수명, 크기0, 크기1, 구속도, 반경, 방향속도|상속률(음수 = 궤적 조각), 세기, 명암, 수직 납작]. 궤적의 종류 4 = 호출마다 한 프레임 광점
  const B = {
    explosion: [[1, 30, 9, 5, 20, 9, 6, 64, .9, .1], [0, 26, 2.4, 5, 16, 24, 3, 12, 2, 1], [8, .05, 2.5, 0, 450, 0, 0, 0, 40], [2, 40, 1.6, 0, 0, 75, 2, 14], [4, .05, .3, 60, 80, 0, 0, 0, 1.5], [5, .05, .7, 8, 110, 0, 0, 0, .8], [7, 3, 1.6, 0, 0, 42, 0, 16]],
    flash: [[1, 9, 3.5, 6, 16, 6, 4, 0, .5, .4], [0, 12, .75, 4, 9, 16, 2, 0, 1.4, .8], [2, 34, .8, 0, 0, 110, 1], [5, .05, .55, 6, 80], [4, .05, .18, 70, 85, 0, 0, 0, 1.6], [7, 2, 1.5, 0, 0, 45]],
    splash: [[3, 44, 3.4, .6, 1.6, 4, 2, 26, .9, 1, .5], [3, 30, 3, .12, .25, 8, 2, 20, 1, 1], [1, 7, 3.5, 4, 11, 11, 3, 0, .22, 1, .1], [5, .05, .9, 5, 45, 0, 0, 0, .6]],
    launch: [[1, 20, 3, 3, 14, 18, 2, -4, .6, .9, .2], [0, 16, .4, 2.5, 5, 5, 1, 60, 2.5], [4, .05, .12, 18, 24], [8, 1, .5, 0, 200, 0, 0, 0, 40]],
    muzzle: [[1, 6, 2, 1.6, 7, 4, .5, 16, .4, .45], [0, 6, .15, 2.5, 5, 8, .3, 70, 2], [4, .05, .08, 16, 20]],
    hit: [[1, 3, 1.2, 1, 3.5, 3, .5, 0, .5, .35], [2, 18, .55, 0, 0, 38, .5, 12], [4, .05, .08, 6, 8, 0, 0, 0, .6]],
    smoke: [[1, 1, 3.2, 5, 14, 2, 2, 3, .6, .13]]
  }, T = {
    missile: [[1, 30, 5, 1, 13, 0, .3, -1, .9, .85], [0, 22, .12, 2.2, .8, 2, .3, .9, 1.8], [4, 0, 0, 9, 9, 0, 0, 0, .5]],
    jet: [[1, 12, 1.6, 1.2, 4, 0, .3, -1, .2, 1], [0, 16, .08, 1.3, .6, 1.5, .2, .92, 1.5], [4, 0, 0, 5, 5, 0, 0, 0, .4]],
    fire: [[1, 9, 9, 4, 20, 2.5, 4, 0, .85, .1], [0, 30, 1.8, 5, 12, 3, 7, 0, 2.2, .35], [2, 7, 1.4, 0, 0, 10, 3, 6], [4, 0, 0, 34, 34, 0, 0, 0, .04], [8, 5, .5, 0, 260, 0, 0, 0, 45]],
    stack: [[1, 5, 2.6, 2.2, 8, 1.2, 1, .5, .12, .34]],
    wake: [[3, 24, 1.4, 1.2, 4, 5, 3, .4, .45, .9]],
    frag: [[1, 14, .9, .6, 2.2, 0, .2, -1, .4, .3], [4, 0, 0, 1.2, 1.2, 0, 0, 0, .12]]
  };
  // d 방향(궤적: 속도), v 추가 속도, s 크기 배율, td 궤적 dt (버스트 0)
  const run = (rows, p, d, v, s, td) => {
    for (let ri = 0; rows && ri < rows.length; ri++) {
      const r = rows[ri], ty = r[0], life = r[2], vr = r[5] || 0, pr = r[6] || 0, vd = r[7] || 0, q = ty == 2 || ty == 3 ? Math.sqrt(s) : s,
        seg = td && vd < 0 && 1 / (r[1] * KN), lv = seg ? .1 : .3, gw = td && ty == 4;
      let n = gw ? 1 : r[1] * (ty > 3 ? 1 : KN) * (td || s) + (td ? r[11] || 0 : .99);
      if (td) r[11] = n % 1;
      n |= 0;
      for (let i = 0; i < n && N; i++) {
        const a = R() * 6.283, y = R() * 2 - 1, h = Math.sqrt(1 - y * y), k = pr * s * R(), w = seg ? 0 : vr * q * (.3 + .7 * R()),
          u = seg || vd * q * (ty > 3 ? 1 : 1 - (td ? .5 : .8) * R()), f = gw ? 0 : (i + (seg ? .5 : R())) / n * td,
          l = gw ? td * .5 : life * (td && life > 1.5 ? KL : 1) * (1 - lv + 2 * lv * R()), g = s * (ty > 2 ? 1 : KS) * (.6 + .8 * R());
        const c = +(l >= .5), b = c * NS, m = c ? N - NS : NS; // 단명 입자는 별도 링
        let o = (b + C[c]) * F;
        if (ty > 7) { // 점광: 카메라 쪽으로 당김, 깜박임
          const cp = G.cam.pos, k = 14 / Math.hypot(cp[0] - p[0], cp[1] - p[1], cp[2] - p[2]);
          for (let j = 0; j < 3; j++) E[j] = p[j] + (cp[j] - p[j]) * k;
          E[1] += 6; G.addLight(E, LC, r[8] * s * (.5 + R()), r[4], l); continue;
        }
        E[0] = Math.cos(a) * h; E[1] = y * (r[10] || 1); E[2] = Math.sin(a) * h;
        if (ty > 6) { // 파편 풀
          o = (fi = (fi + 1) % 64) * 7; FR[o + 6] = l;
          for (let j = 0; j < 3; j++) { FR[o + j] = p[j]; FR[o + 3 + j] = E[j] * w + d[j] * u; }
          continue;
        }
        for (let j = 0; j < 3; j++) { S[o + j] = p[j] + E[j] * k - v[j] * f; S[o + 4 + j] = d[j] * u + E[j] * w + (td ? 0 : v[j]); }
        S[o + 3] = gw ? -td : f; S[o + 7] = l; S[o + 8] = r[3] * g; S[o + 9] = r[4] * g; S[o + 10] = ty; S[o + 11] = R(); S[o + 12] = r[9] || 0; S[o + 13] = (r[8] || 1) * KA; S[o + 14] = seg ? 1 : ST[ty];
        S[o + 15] = E[0] * G.sun.dir[0] + E[1] * G.sun.dir[1] + E[2] * G.sun.dir[2];
        die[b + C[c]] = G.time + l; C[c] = (C[c] + 1) % m; W[c]++;
      }
    }
  };
  G.fx = {
    burst(kind, p, o) { run(B[kind], p, o && o.dir || UP, o && o.vel || Z, o && o.size || 1, 0); },
    trail(p, v, kind, dt) { dt > 0 && run(T[kind], p, v, v, 1, dt); },
    tracer(p, d, sp = 900, ld = 0) { // ld: 이미 날아간 시간. 탄마다 출발·밝기를 흩음
      TR[0][7] = sp;
      for (let i = sp > 999 && KN > .3 ? 2 : 1; i--;) {
        const k = sp * (ld + .04 * R()); TR[0][8] = .4 + 3 * R() * R();
        for (let j = 0; j < 3; j++) fp[j] = p[j] + d[j] * k;
        run(TR, fp, d, Z, 1, 0);
      }
      tn++ % 2 || run(TM, p, d, Z, 1, 0);
    },
    get alive() { let n = 0; for (let i = 0; i < N; i++) n += die[i] > G.time; return n; }
  };
  G.register('fx', {
    init() {
      const dev = G.dev; sm = G.shader(WGSL, 'fx');
      bgl = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }] });
      bglD = dev.createBindGroupLayout({ entries: [{ binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } }] });
      cp = dev.createComputePipeline({ layout: G.layout(bgl), compute: { module: sm, entryPoint: 'cs' } });
    },
    onQuality(Q) { // 티어 배율 [개수, 수명, 크기, 세기]
      const dev = G.dev, one = { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' };
      [KN, KL, KS, KA] = [[.35, .7, 1.4, 1.3], [1, 1, 1, 1], [2.5, 1.2, .8, 1]][Q.level]; T.stack[0][1] = Q.level ? 5 : 0;
      if (ms != Q.msaa) rp = dev.createRenderPipeline({
        layout: G.layout(bglD), primitive: { topology: 'triangle-strip' }, depthStencil: { format: G.DEPTH, depthWriteEnabled: false, depthCompare: 'greater' }, multisample: { count: ms = Q.msaa },
        vertex: { module: sm, entryPoint: 'vs', buffers: [{ arrayStride: 64, stepMode: 'instance', attributes: [0, 1, 2, 3].map(i => ({ shaderLocation: i, offset: i * 16, format: 'float32x4' })) }] },
        fragment: { module: sm, entryPoint: 'fs', targets: [{ format: G.HDR, blend: { color: one, alpha: one } }] }
      });
      N = Q.particles; NS = N >> 2; S = new Float32Array(N * F); die = new Float32Array(N); C.fill(0); W.fill(0); FR.fill(0); buf && buf.destroy();
      buf = dev.createBuffer({ size: Math.ceil(N / 64) * 4096, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      bg = dev.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: { buffer: buf } }] });
    },
    onResize() { bgD = G.dev.createBindGroup({ layout: bglD, entries: [{ binding: 1, resource: G.targets.depthCopyView }] }); },
    update(dt) { // 파편: 탄도 + 연기 꼬리
      for (let o = 0; o < 448; o += 7) if (FR[o + 6] > 0 && KN > .3) {
        FR[o + 4] -= 9.8 * dt;
        for (let j = 0; j < 3; j++) { fp[j] = FR[o + j] += FR[o + 3 + j] * dt; fv[j] = FR[o + 3 + j]; }
        FR[o + 6] = fp[1] > 0 ? FR[o + 6] - dt : 0; G.fx.trail(fp, fv, 'frag', dt);
      }
    },
    prepare() { // 새로 쓴 링 구간만 업로드
      for (let c = 0; c < 2; c++) for (let b = c * NS, m = c ? N - NS : NS, a = (C[c] - W[c] % m + m) % m, n; W[c] > 0; W[c] -= n, a = 0)
        G.dev.queue.writeBuffer(buf, (b + a) * 64, S, (b + a) * F, (n = Math.min(W[c], m - a)) * F);
    },
    compute(enc) {
      const p = enc.beginComputePass(); p.setPipeline(cp); p.setBindGroup(0, G.bg0); p.setBindGroup(1, bg); p.dispatchWorkgroups(Math.ceil(N / 64)); p.end();
    },
    transparent(p) { p.setPipeline(rp); p.setBindGroup(1, bgD); p.setVertexBuffer(0, buf); p.draw(4, N); }
  });
}
