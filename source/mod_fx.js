'use strict';
{ /* FX — GPU 파티클(컴퓨트 시뮬 + 볼륨 셰이딩 빌보드)과 전투 효과 */
  const F = 16, R = G.rng(5), Z = [0, 0, 0], UP = [0, 1, 0], ST = [.03, 0, .05, .12, 0, 0, .012],
    E = [0, 0, 0], FR = new Float32Array(448), fp = [0, 0, 0], fv = [0, 0, 0], LC = [1, .5, .2],
    TR = [[6, .05, .9, 1, 1, 0, 0, 900, 2]], TM = [[4, .05, .09, 3, 4.5, 0, 0, 0, .35], [1, 1, 1.6, .6, 3.5, 1.5, .2, 8, .25, .5]], C = [0, 0], W = [0, 0];
  let N = 0, S, die, buf, bg, bgD, bgl, bglD, rp, cp, sm, ms = 0, NS = 0, fi = 0, tn = 0, KN = 1, KL = 1, KS = 1, KA = 1;
  // 종류: 0 불 1 연기 2 불티 3 물보라 4 섬광·광점 5 수면 포말 6 예광탄 (7 CPU 파편, 8 점광)
  const WGSL = /* wgsl */`
struct P { p: vec3f, age: f32, v: vec3f, life: f32, s: vec4f, c: vec4f }; // s: 크기0,크기1,종류,시드 c: 명암(물: 항력),세기,늘림,해쪽
@group(1) @binding(0) var<storage, read_write> ps: array<P>;
@group(1) @binding(1) var dT: texture_depth_2d;
const DRAG = array<f32, 7>(1.6, 0., .8, .9, 0., 0., 0.);
const GRAV = array<f32, 7>(30., 0., -9.8, -9., 0., 0., -1.);
const FADE = array<f32, 7>(1., 1.3, 1., .7, 2., 1.2, .15);
const GAIN = array<f32, 7>(1., 0., 6., 0., 40., 0., 14.);
@compute @workgroup_size(64) fn cs(@builtin(global_invocation_id) id: vec3u) {
  var q = ps[id.x]; if (q.age >= q.life) { return; }
  let dt = g.misc.y; let ty = u32(q.s.z); let w = g.wind.xy * g.wind.z * min(.3 + q.p.y * .012, 1.2); // 바람 전단
  var a = vec3f(0., GRAV[ty], 0.) - q.v * DRAG[ty] * select(1., q.c.x, ty == 3u);
  if (ty == 1u) { a = (vec3f(w.x, (8.4 - 8. * q.c.x) * (.7 + .6 * q.s.w), w.y) - q.v) * .9 + sin(q.p.yzx * .12 + g.cam.w) * 3.; }
  if (ty == 1u && q.c.z > 0.) { // 궤적 조각: v = 축. 바람 + 저주파 난류(티어가 낮으면 약하게: 조각 사이 틈 방지)
    q.p += (vec3f(w.x, .5, w.y) * min(q.age, 1.) + sin(q.p.yzx * .05 + g.cam.w * .3) * (1.5 + 1.5 * g.sun.w) + sin(q.s.w * vec3f(40., 23., 57.)) * .8) * dt;
  } else { q.v += a * dt; q.p += q.v * dt; }
  q.age += dt;
  if ((ty == 2u || ty == 3u) && q.p.y < -1.) { q.age = q.life; }
  ps[id.x] = q;
}
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec3f, @location(1) c: vec4f, @location(2) d: vec4f, @location(3) e: vec4f, @location(4) k: vec4f, @location(5) sl: vec4f, @location(6) up: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f, @location(2) s: vec4f, @location(3) c: vec4f) -> V {
  var o: V; if (a.w >= b.w) { return o; }
  let ty = i32(s.z); let t = max(a.w, 0.) / b.w; let sg = ty == 1 && c.z > 0.; let hz = ty == 5;
  let cv = g.cam.xyz - a.xyz; let dist = length(cv); let f = cv / dist; let px = dist * 1.1 / g.res.y; // px: 픽셀 크기
  var sz = min(mix(s.x, s.y, select(sqrt(t), t, ty == 1)), dist * .3); var len = 1.; var en = 1.;
  var r = normalize(cross(vec3f(0., 1., 0.), f) + 1e-5); var u = cross(f, r);
  if (c.z > 0.) { // 속도 방향 캡슐: 축을 화면에 투영 (시선과 나란한 궤적도 사라지지 않음)
    let sp = length(b.xyz) + .01; let pa = b.xyz / sp - f * dot(b.xyz / sp, f); var hl = sp * c.z * length(pa);
    u = normalize(pa + u * .001); r = cross(u, f);
    if (ty == 2 || ty == 6) { sz = px * select(2., 3., ty == 6); hl = clamp(hl, sz, px * select(6., 22., ty == 6)); en = clamp(150. / dist, .3, 1.); } // 선: 심 + 후광 폭 6px
    else { let w = max(sz, px * 2.); en = max(sz / w, .3); sz = w; if (!sg) { hl = min(hl, sz * select(1., 4., ty == 0)); } } // 최소 4px(부드러운 가장자리), 물보라 늘림 ≤ 2:1
    len = 1. + hl / sz;
  } else {
    let an = s.w * 6.283 + t * (s.w - .5) * 2.; let r0 = r; r = r * cos(an) + u * sin(an); u = u * cos(an) - r0 * sin(an);
  }
  if (hz) { r = vec3f(1., 0., 0.); u = vec3f(0., 0., 1.); }
  if (ty == 4) { let w = max(sz, px * 7.); en = max(sz / w, .5); sz = w; } // 먼 엔진·불꽃도 보이게
  let qd = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2. - 1.;
  var w = a.xyz + (r * qd.x + u * qd.y * len) * sz; let gy = gerstner(select(a.xz, w.xz, hz), g.cam.w).y; if (hz) { w.y = gy + .5; }
  o.uv = vec3f(qd, dot(w, vec3f(.2, 1., .2)) * .0012);
  o.pos = g.viewProj * vec4f(w, 1.);
  if (ty > 3) { o.pos.z *= select(1.3, 1.04, hz); }
  let tr = exp(-dist * g.fog.x * (1. + 2. * g.fog.z));
  let A = c.y * pow(1. - t, FADE[ty]) * en * smoothstep(.5, 2., dist / sz);
  o.k = vec4f(s.zw, w.y - gy, sz); o.d.a = t; o.up.w = len;
  o.c = vec4f(vec3f(1., .6, .3) * GAIN[ty] * tr, A);
  if (ty == 2 || ty == 4 || ty == 6) { return o; }
  let alb = select(select(1., c.x * (.8 + .4 * s.w), ty == 1), .06, ty == 0);
  var pl = vec3f(0.); // 점광은 가까운 곳만: 연기 기둥 밑동의 불빛
  for (var j = 0; j < 4; j++) { let l = g.lights[j * 2]; let q = max(1. - distance(l.xyz, a.xyz) / max(l.w * .2, 1.), 0.); pl += g.lights[j * 2 + 1].rgb * q * q; }
  let sn = g.sunCol.rgb * shadowAt(a.xyz, g.sun.xyz * 3.) * cloudVis(a.xyz) * alb * tr;
  o.c = vec4f(sn * (.6 + .4 * c.w), A * smoothstep(0., .02, t));
  o.d = vec4f(skyBase(vec3f(0., .25, 0.)) * alb * tr, t);
  o.e = vec4f((pl * (.012 + alb * .25) + vec3f(1., .45, .15) * (3. * exp(-a.w * 9.) * f32(sg))) * tr + skyBase(-f) * (alb * c.x * tr * 1.3 * saturate(dist / 500. - .4)) + fogAt(vec3f(0.), a.xyz), tr);
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
  if (ty == 2 || ty == 6) { // 불티·예광탄: HDR 심 + 넓고 옅은 주황 후광, 꼬리로 가늘어짐
    let h = i.uv.y * .5 + .5; let x = i.uv.x * i.uv.x;
    return vec4f(i.c.rgb * A * h * smoothstep(1., .8, h) * (1. - x) * (exp(-x * 30.) * vec3f(1., 1.4, 2.2) + .1 * exp(-x * 4.)), 0.);
  }
  if (ty == 4) { return vec4f(i.c.rgb * A * m * m * (exp(-r2 * 40.) + .04 * exp(-r2 * 8.) + .006), 0.); } // 단조 감쇠, 가장자리에서 0 (고리 없음)
  if (ty == 5) { // 수면 포말: 채운 원반(sl.w) 또는 퍼지는 고리, 잡음으로 침식
    let rr = sqrt(r2); let n = nz(i.uv.xy * .02 + i.k.y).r * .6 + nz(i.uv.xy * .07 + i.k.y).g * .4;
    let a = saturate((smoothstep(1., .8, rr) * mix(smoothstep(.55, .8, rr), .45 + .55 * smoothstep(.2, .8, rr), i.sl.w) * 1.3 - n * (.9 + t)) * 2.5) * min(A, 1.);
    return vec4f((i.c.rgb * .55 + i.d.rgb + i.e.rgb) * a, a);
  }
  var sf = saturate((i.k.z + 1.) / (.5 * i.k.w + 1.));
  if (g.sun.w > 1.5) { sf *= saturate((g.misc.x / max(textureLoad(dT, vec2i(i.pos.xy), 0), 1e-7) - g.misc.x / i.pos.z) / (.5 * i.k.w)); }
  let fl = f32(ty == 0); let sg = ty == 1 && L > 1.;
  var q = vec2f(uv.x, y) * (.006 - .001 * fl) + i.k.y * vec2f(7., 3.) - vec2f(0., t * (.008 + .05 * fl));
  if (sg) { q = vec2f(uv.x * .004 + t * .02, i.uv.z); } // 궤적: 세계 좌표로 이어지는 잡음 (조각 경계·구슬 무늬 없음)
  let n1 = nz(q); let n2 = nz(q * 2.6 + n1.gb * .012).r; let n0 = n1.r * .65 + n2 * .35; let n = mix(.5, n0, nf);
  let d = m - n * select(.45 + .5 * t, .8, ty == 3); let al = smoothstep(0., select(.6, .9, ty == 3), d);
  let N = vec3f(uv, sqrt(m));
  if (ty == 0) { // 불: 방사체. 잡음 불길 × 젊음 → 온도 램프(백황 심 → 주황 → 암적), 반가산 → 겹친 중심이 가장 뜨거움. 식으면 그을음
    let h = smoothstep(0., .5, m) * saturate(1.6 - 2.2 * n - t * 1.5) * min(A, 1.);
    let af = smoothstep(0., .4, h) * .5; let a0 = al * min(A * i.sl.w, 1.) * smoothstep(.2, .7, t) * .5;
    let soot = i.c.rgb * .5 + i.d.rgb + i.e.rgb;
    return vec4f(((vec3f(1., .2, .03) * h * 1.5 + vec3f(1., .55, .1) * h * h * 4. + vec3f(.9, .85, .5) * pow(h, 4.) * 5.) * i.e.a + soot * a0 * (1. - af)) * sf, max(af, a0) * sf);
  }
  if (ty == 3) { // 물보라: 해 쪽은 흰색(역광이면 가장자리가 빛남), 그늘 쪽은 청회색
    let a = al * min(A, 1.) * sf;
    let lw = .4 + dot(N.xy, i.sl.xy) * .25 + (1. - al) * saturate(-i.sl.z);
    return vec4f((i.c.rgb * lw + i.d.rgb * vec3f(.9, 1.1, 1.4) + i.e.rgb) * a, a);
  }
  let ns = nz(q + i.sl.xy * .003).r * .65 + n2 * .35;
  let lit = saturate(dot(N, i.sl.xyz) * .8 + (ns - n0) * 2.5 * nf + .2) + (1.3 - al) * saturate(-i.sl.z) * .5; // 해 쪽 면 + 역광 테두리
  let col = i.c.rgb * lit + i.d.rgb * (.55 + .4 * dot(N, i.up.xyz)) * (1.15 - .5 * n) + i.e.rgb;
  let a2 = al * min(A, .85) * sf * select(1., 1. - smoothstep(0., 1., abs(i.uv.y)), sg); // 궤적 조각은 길이 창으로 겹침
  return vec4f(col * a2, a2);
}`;
  // 행: [종류, 개수|초당, 수명, 크기0, 크기1, 구속도, 반경, 방향속도|상속률(음수 = 궤적 조각), 세기, 명암, 수직 납작]. 궤적의 종류 4 = 호출마다 한 프레임 광점
  const B = {
    explosion: [[1, 30, 9, 4, 24, 9, 6, 48, .9, .05], [0, 30, 2.4, 3, 12, 24, 3, 12, 2, 1], [8, .05, 2.5, 0, 450, 0, 0, 0, 40], [2, 36, 2.2, 0, 0, 60, 2, 16], [4, .05, .2, 60, 80, 0, 0, 0, 1.5], [5, .05, 3, 10, 90, 0, 0, 0, .6], [7, 3, 1.6, 0, 0, 42, 0, 16]],
    flash: [[1, 9, 3.5, 6, 16, 6, 4, 0, .5, .4], [0, 14, .75, 3, 8, 16, 2, 0, 1.4, .8], [2, 34, 1.2, 0, 0, 90, 1], [4, .05, .18, 70, 85, 0, 0, 0, 1.6], [7, 2, 1.5, 0, 0, 45]],
    // 물기둥: 잔 물보라 덩이(빠른 것은 곧게, 느린 것은 넓게) + 날리는 물방울 + 낮은 안개 + 포말
    splash: [[3, 70, 3.6, .7, 1.8, 7, 2, 40, 2, 1], [3, 30, 3, .3, .5, 13, 2, 19, 1.5, .2], [1, 7, 3.5, 4, 11, 11, 3, 0, .22, 1, .1], [5, .05, 5, 4, 11, 0, 0, 0, 1, 1]],
    launch: [[1, 10, 2, 2, 9, 14, 2, -4, .35, .7, .2], [0, 16, .4, 2.5, 5, 5, 1, 60, 2.5], [4, .05, .12, 18, 24], [8, 1, .5, 0, 200, 0, 0, 0, 40]],
    muzzle: [[1, 6, 2, 1.6, 7, 4, .5, 16, .4, .45], [0, 6, .15, 2.5, 5, 8, .3, 70, 2], [4, .05, .08, 10, 12]],
    hit: [[1, 3, 1.2, 1, 3.5, 3, .5, 0, .5, .35], [2, 18, .55, 0, 0, 38, .5, 12], [4, .05, .08, 6, 8, 0, 0, 0, .6]],
    smoke: [[1, 1, 3.2, 5, 14, 2, 2, 3, .6, .13]]
  }, T = {
    missile: [[1, 30, 4.5, 2, 8, 0, .3, -1, .7, .8], [0, 22, .12, 2.2, .8, 2, .3, .9, 1.8], [4, 0, 0, 7, 7, 0, 0, 0, .6]],
    jet: [[1, 12, 1.6, 1.2, 4, 0, .3, -1, .2, 1], [0, 16, .08, 1.3, .6, 1.5, .2, .92, 1.5], [4, 0, 0, 5, 5, 0, 0, 0, .4]],
    fire: [[1, 14, 9, 3.5, 22, 2.5, 3, 0, .9, .05], [0, 40, 1.4, 2.5, 10, 3, 7, 0, 2.2, .35], [2, 6, 1.6, 0, 0, 16, 4, 22], [4, 0, 0, 34, 34, 0, 0, 0, .1], [8, 5, .5, 0, 260, 0, 0, 0, 45]],
    stack: [[1, 5, 2.6, 2.2, 8, 1.2, 1, .5, .12, .34]],
    frag: [[1, 14, .9, .6, 2.2, 0, .2, -1, .4, .3], [4, 0, 0, 1.2, 1.2, 0, 0, 0, .12]]
  };
  // d 방향(궤적: 속도), v 추가 속도, s 크기 배율, td 궤적 dt (버스트 0)
  const run = (rows, p, d, v, s, td) => {
    for (let ri = 0; rows && ri < rows.length; ri++) {
      const r = rows[ri], ty = r[0], life = r[2], vr = r[5] || 0, pr = r[6] || 0, vd = r[7] || 0, q = ty == 2 || ty == 3 ? Math.sqrt(s) : s,
        seg = td && vd < 0 && 1 / (r[1] * KN), lv = seg ? .1 : .3, gw = td && ty == 4, lo = seg && d[1] > 99 && p[1] < 40 ? .4 + p[1] / 70 : 1; // 갑판 근처 발사 연기는 빨리 걷힘
      let n = gw ? 1 : r[1] * (ty > 3 ? 1 : ty == 3 ? Math.sqrt(KN) : KN) * (td || s) + (td ? r[11] || 0 : .99);
      if (td) r[11] = n % 1;
      n |= 0;
      for (let i = 0; i < n && N; i++) {
        const a = R() * 6.283, y = R() * 2 - 1, h = Math.sqrt(1 - y * y), k = pr * s * R(), uf = ty > 3 ? 1 : 1 - (td ? .15 : .8) * R(),
          w = seg ? 0 : vr * q * (.3 + .7 * R()) * (ty == 3 ? 1.7 - 1.5 * uf : 1), u = seg || vd * q * uf, f = gw ? 0 : (i + (seg ? .5 : R())) / n * td,
          l = gw ? td * .5 : life * lo * (td && life > 1.5 ? KL : 1) * (1 - lv + 2 * lv * R()),
          g = s * (ty > 3 ? 1 : KS) * (seg ? .85 + .3 * R() : ty > 3 ? .6 + .8 * R() : .4 + 1.4 * R() * R()); // 크기 편차 ~4.5배
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
        for (let j = 0; j < 3; j++) { S[o + j] = p[j] + E[j] * k - v[j] * f * (seg ? 1 : 1 - u); S[o + 4 + j] = d[j] * u + E[j] * w + (td ? 0 : v[j]); }
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
      [KN, KL, KS, KA] = [[.5, .7, 1.4, 1.3], [1, 1, 1, 1], [2.5, 1.2, .8, 1]][Q.level]; T.stack[0][1] = Q.level ? 5 : 0;
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
