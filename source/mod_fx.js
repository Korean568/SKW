'use strict';
{ /* FX — GPU 파티클(컴퓨트 시뮬 + 세계 공간 잡음으로 침식한 볼륨 빌보드)과 전투 효과 */
  const F = 16, R = G.rng(5), Z = [0, 0, 0], UP = [0, 1, 0], ST = [.03, 0, .05, .12, 0, 0, .012],
    E = [0, 0, 0], FR = new Float32Array(448), fp = [0, 0, 0], fv = [0, 0, 0], LC = [1, .5, .2],
    TR = [[6, .05, .9, 1, 1, 0, 0, 900, 2]], TM = [[4, .05, .09, 3, 4.5, 0, 0, 0, .35], [1, 1, 1.6, .6, 3.5, 1.5, .2, 8, .25, .5]], C = [0, 0], W = [0, 0], AC = new Float32Array(96);
  let N = 0, S, die, buf, bg, bgD, bgl, bglD, rp, cp, sm, ms = 0, NS = 0, fi = 0, tn = 0, ci = 0, fr = 0, KN = 1, KL = 1, KS = 1, KA = 1;
  // 종류: 0 불 1 연기 2 불티 3 물보라 4 섬광·광점 5 수면 포말 6 예광탄 (7 CPU 파편, 8 점광)
  const WGSL = /* wgsl */`
struct P { p: vec3f, age: f32, v: vec3f, life: f32, s: vec4f, c: vec4f }; // s: 크기0,크기1,종류,시드 c: 명암(물: 항력),세기,늘림,해쪽
@group(1) @binding(0) var<storage, read_write> ps: array<P>;
@group(1) @binding(1) var dT: texture_depth_2d;
const DRAG = array<f32, 7>(1.6, 0., .8, .9, 0., 0., 0.);
const GRAV = array<f32, 7>(30., 0., -9.8, -9., 0., 0., -1.);
const FADE = array<f32, 7>(1., 1.3, 1., .7, 2., 1.2, .15);
const GAIN = array<f32, 7>(1., 0., 2.5, 0., 40., 0., 14.);
// 세계 공간 잡음: 종류별 주파수(물보라·불은 세로 줄무늬), w 상승 속도
const FQ = array<vec4f, 4>(vec4f(.22, .1, .22, 14.), vec4f(.1, .1, .1, 4.), vec4f(0.), vec4f(.3, .06, .3, -2.));
@compute @workgroup_size(64) fn cs(@builtin(global_invocation_id) id: vec3u) {
  var q = ps[id.x]; if (q.age >= q.life) { return; }
  let dt = g.misc.y; let ty = u32(q.s.z); let w = g.wind.xy * g.wind.z * min(.15 + q.p.y * .02, 1.4); // 바람 전단 → 기둥이 눕는다
  var a = vec3f(0., GRAV[ty], 0.) - q.v * DRAG[ty] * select(1., q.c.x, ty == 3u);
  if (ty == 3u) { a += vec3f(q.v.x, 0., q.v.z) * (2.4 * exp(-abs(q.v.y) * .2) * saturate(q.p.y * .06 - .3)); } // 물기둥 꼭대기: 왕관
  if (ty == 1u) { a = (vec3f(w.x, (8.4 - 8. * q.c.x) * (.7 + .6 * q.s.w) * (1.15 - q.age / q.life), w.y) - q.v) * vec3f(2., .9, 2.) + sin(q.p.yzx * .12 + g.cam.w) * 2.; }
  if (ty == 1u && q.c.z > 0.) { // 궤적 조각: v = 축. 바람 + 공간적으로 이어지는 난류
    q.p += (vec3f(w.x, .5, w.y) * min(q.age, 1.) + sin(q.p.yzx * .05 + g.cam.w * .3) * 3.5 + sin(q.p.zxy * .019 + q.p.yzx * .011) * 3.) * dt;
  } else { q.v += a * dt; q.p += q.v * dt; }
  q.age += dt;
  if ((ty == 2u || ty == 3u) && q.p.y < -1.) { q.age = q.life; }
  ps[id.x] = q;
}
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) c: vec4f, @location(2) d: vec4f, @location(3) e: vec4f, @location(4) k: vec4f, @location(5) sl: vec4f, @location(6) up: vec4f, @location(7) wp: vec3f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f, @location(2) s: vec4f, @location(3) c: vec4f) -> V {
  var o: V; if (a.w >= b.w) { return o; }
  let ty = i32(s.z); let t = max(a.w, 0.) / b.w; let sg = ty == 1 && c.z > 0.; let hz = ty == 5; let ln = ty == 2 || ty == 6;
  let cv = g.cam.xyz - a.xyz; let dist = length(cv); let f = cv / dist;
  let px = 2. * max((g.viewProj * vec4f(a.xyz, 1.)).w, .1) / (g.res.y * length(vec3f(g.viewProj[0].y, g.viewProj[1].y, g.viewProj[2].y))); // 픽셀 크기(m)
  var sz = min(mix(s.x, s.y, select(sqrt(t), t, sg)), dist * .3); var len = 1.; var en = 1.;
  var r = normalize(cross(vec3f(0., 1., 0.), f) + 1e-5); var u = cross(f, r);
  if (c.z > 0.) { // 속도 방향 캡슐: 축을 화면에 투영
    let ax = select(b.xyz, vec3f(0., 99., 0.), ty == 3); // 물보라는 늘 세로 줄기
    let sp = length(ax) + .01; let pa = ax / sp - f * dot(ax / sp, f); var hl = sp * c.z * length(pa);
    u = normalize(pa + u * .001); r = cross(u, f);
    if (ln) { sz = px * select(2.5, 4., ty == 6); hl = min(hl, px * select(3., 14., ty == 6)); en = clamp(150. / dist, .3, 1.); } // 선: 길이 상한 36px·11px
    else { let w = max(sz, px * 2.); en = max(sz / w, .3); sz = w; if (!sg) { hl = min(hl, sz * select(3., clamp(a.y * .15, 0., 3.), ty == 3)); } }
    len = 1. + hl / sz;
  }
  if (hz) { r = vec3f(1., 0., 0.); u = vec3f(0., 0., 1.); }
  if (ty == 4) { let w = max(sz, px * 7.); en = max(sz / w, .5); sz = w; }
  let qd = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2. - 1.;
  var w = a.xyz + (r * qd.x + u * qd.y * len) * sz; let gy = gerstner(select(a.xz, w.xz, hz), g.cam.w).y; if (hz) { w.y = gy + .5; }
  o.uv = qd; o.wp = w;
  o.pos = g.viewProj * vec4f(w, 1.);
  if (ty > 3) { o.pos.z *= select(1.3, 1.04, hz); }
  let tr = exp(-dist * g.fog.x * (1. + 2. * g.fog.z));
  let A = c.y * pow(1. - t, FADE[ty]) * en * smoothstep(.5, 2., dist / sz);
  o.k = vec4f(s.zw, w.y - gy, sz); o.d.a = t; o.up.w = len;
  o.c = vec4f(select(vec3f(1., .3, .06), vec3f(1., .6, .3), ty > 3) * GAIN[ty] * tr, A);
  if (ln || ty == 4) { return o; }
  let alb = select(select(1., c.x * (.8 + .4 * s.w), ty == 1), .06, ty == 0);
  var pl = vec3f(0.); // 가까운 점광: 연기 밑동의 불빛
  for (var j = 0; j < 4; j++) { let l = g.lights[j * 2]; let q = max(1. - distance(l.xyz, a.xyz) / max(l.w * .2, 1.), 0.); pl += g.lights[j * 2 + 1].rgb * q * q; }
  let sn = g.sunCol.rgb * shadowAt(a.xyz, g.sun.xyz * 3.) * cloudVis(a.xyz) * tr;
  o.c = vec4f(sn * max(alb, .11) * (.7 + .3 * c.w), A * smoothstep(0., select(.08, .004, sg), t));
  o.d = vec4f(skyBase(vec3f(0., .25, 0.)) * alb * tr, t);
  o.e = vec4f((pl * (.035 + alb * .25) + vec3f(1., .45, .15) * (3. * exp(-a.w * 5.) * f32(sg))) * tr + skyBase(-f) * (alb * c.x * tr * 1.3 * saturate(dist / 500. - .4)) + fogAt(vec3f(0.), a.xyz), tr);
  o.sl = vec4f(dot(g.sun.xyz, r), dot(g.sun.xyz, u), dot(g.sun.xyz, f), c.x);
  o.up = vec4f(r.y, u.y, f.y, len);
  return o;
}
fn nz(p: vec2f) -> f32 { // 부드러운 값 잡음 (텍셀 단위)
  let i = floor(p); let f = p - i;
  return textureSampleLevel(noiseTex, linSamp, (i + f * f * (3. - 2. * f) + .5) / 256., 0.).r;
}
fn n3(p: vec3f) -> f32 { // 3D 잡음: 두 층 보간
  let z = floor(p.z); let f = p.z - z; let q = p.xy + z * vec2f(37., 17.);
  return mix(nz(q), nz(q + vec2f(37., 17.)), f * f * (3. - 2. * f));
}
@fragment fn fs(i: V) -> @location(0) vec4f {
  let fw = fwidth(i.uv.x); let ty = i32(i.k.x + .5); let L = i.up.w; let A = i.c.a; let t = i.d.a; let sp = ty == 3; let sg = ty == 1 && L > 1.;
  let y = i.uv.y * L; let uv = vec2f(i.uv.x, select(sign(y) * max(abs(y) - L + 1., 0.), 0., sg)); // 캡슐 좌표 (궤적 조각은 단면만)
  let r2 = dot(uv, uv); let m = max(1. - r2, 0.);
  if (ty == 2 || ty == 6) { // 불티·예광탄: 눈물방울(밝은 머리 → 가늘어지는 꼬리). 예광탄은 백열 심 + 주황 후광
    let h = i.uv.y * .5 + .5; let x = i.uv.x / (.2 + .8 * h); let x2 = x * x;
    return vec4f(i.c.rgb * A * h * h * smoothstep(1., .75, h) * max(1. - x2, 0.) * select(vec3f(exp(-x2 * 5.)), exp(-x2 * 16.) * vec3f(1., 1.4, 2.2) + .15 * exp(-x2 * 3.), ty == 6), 0.);
  }
  if (ty == 4) { return vec4f(i.c.rgb * A * m * m * (exp(-r2 * 40.) + .04 * exp(-r2 * 8.) + .006), 0.); } // 고리 없는 단조 감쇠
  if (ty == 5) { // 수면 포말: 원반(sl.w) 또는 고리
    let rr = sqrt(r2); let n = nz(i.uv * 5. + i.k.y * 99.) * .6 + nz(i.uv * 18. + i.k.y * 55.) * .4;
    let a = saturate((smoothstep(1., .8, rr) * mix(smoothstep(.55, .8, rr), .45 + .55 * smoothstep(.2, .8, rr), i.sl.w) * 1.3 - n * (.9 + t)) * 2.5) * min(A, 1.);
    return vec4f((i.c.rgb * .55 + i.d.rgb + i.e.rgb) * a, a);
  }
  var sf = saturate((i.k.z + 1.) / (.5 * i.k.w + 1.));
  if (g.sun.w > 1.5) { sf *= saturate((g.misc.x / max(textureLoad(dT, vec2i(i.pos.xy), 0), 1e-7) - g.misc.x / i.pos.z) / (.5 * i.k.w)); }
  // 볼륨: 모양은 세계 공간 잡음장이 만든다. 부드러운 마스크 × 같은 잡음 → 겹친 스프라이트가 한 덩어리로 침식
  var fq = FQ[ty]; if (sg) { fq = vec4f(.2, .2, .2, 0.); }
  let wd = g.wind.xy * (g.wind.z * .6 * f32(ty == 1));
  let Pw = (i.wp - vec3f(wd.x, fq.w, wd.y) * g.cam.w) * fq.xyz;
  let ro = fw * i.k.w * fq.x; // 픽셀당 잡음 칸 수: 잔 옥타브부터 걷어냄
  let n1 = n3(Pw); let n = saturate((mix(.5, n1, saturate(1.5 - ro * 2.)) * .5 + mix(.5, n3(Pw * 2.7 + 9.), saturate(1.5 - ro * 5.4)) * .5) * 1.7 - .35);
  let al = smoothstep(0., select(.22, .8, sp), m * m - n * select((.55 + .55 * t) * select(1., .6, sg), .6 + .5 * t, sp));
  if (ty == 0) { // 불: 잡음 불길 × 젊음 → 온도 램프, 반가산. 식으면 그을음
    let h = smoothstep(0., .5, m) * saturate(1.16 - 1.3 * n - t * 1.5) * min(A, 1.);
    let af = smoothstep(0., .4, h) * .5; let a0 = al * min(A * i.sl.w, 1.) * smoothstep(.2, .7, t) * .5;
    let soot = i.c.rgb * .5 + i.d.rgb + i.e.rgb;
    return vec4f(((vec3f(1., .2, .03) * h * 1.5 + vec3f(1., .55, .1) * h * h * 4. + vec3f(.9, .85, .5) * pow(h, 4.) * 5.) * i.e.a + soot * a0 * (1. - af)) * sf, max(af, a0) * sf);
  }
  let sd = dot(uv, i.sl.xy);
  if (sp) { // 물보라: 겹친 중심이 흰 심, 세로 줄무늬, 그늘 쪽 청회색
    let a = (1. - exp(-al * A * .8)) * sf;
    return vec4f((i.c.rgb * (.85 + sd * .3 - n * .5 + (1. - al) * saturate(-i.sl.z) * .4) + i.d.rgb * vec3f(1., 1.05, 1.15) + i.e.rgb) * a, a);
  }
  var gs = 0.; if (g.sun.w > .5) { gs = (n3(Pw + g.sun.xyz * .3) - n1) * 5.; } // 밀도 기울기 → 덩어리 단위 명암
  let lit = saturate(.3 + select(sd, uv.x * i.sl.x * 1.4, sg) * .55 + gs) + (1.2 - al) * saturate(-i.sl.z) * .4; // 해 쪽 면 + 역광 테두리
  let col = i.c.rgb * lit + i.d.rgb * (.6 + .4 * dot(uv, i.up.xy)) * (1.2 - .5 * n) + i.e.rgb * (1.5 - n);
  // 광학 두께 합성: 조각의 길이 창은 이웃과 합이 1 → 이음매 없음
  let a2 = (1. - exp(-al * min(A, 1.) * select(1.1, 2.2 * (1. - smoothstep(0., 1., abs(y) / max(L - 1., .01))), sg))) * sf;
  return vec4f(col * a2, a2);
}`;
  // 행: [종류, 개수|초당, 수명, 크기0, 크기1, 구속도, 반경, 방향속도|상속률(음수 = 궤적 조각), 세기, 명암, 수직 납작]. 궤적의 종류 4 = 호출마다 한 프레임 광점
  const B = {
    explosion: [[1, 34, 9, 4, 24, 5, 4, 40, .9, .05], [0, 30, 2.4, 3, 12, 24, 3, 12, 2, 1], [8, .05, 2.5, 0, 450, 0, 0, 0, 40], [2, 24, 1.5, 0, 0, 45, 2, 14], [4, .05, .2, 60, 80, 0, 0, 0, 1.5], [5, .05, 3, 10, 90, 0, 0, 0, .6], [7, 3, 1.6, 0, 0, 42, 0, 16]],
    flash: [[1, 9, 3.5, 6, 16, 6, 4, 0, .5, .4], [0, 14, .75, 3, 8, 16, 2, 0, 1.4, .8], [2, 34, 1.2, 0, 0, 90, 1], [4, .05, .18, 70, 85, 0, 0, 0, 1.6], [7, 2, 1.5, 0, 0, 45]],
    // 물기둥: 줄무늬 심 + 벌어졌다 떨어지는 물방울 장막 + 낮은 안개 + 포말
    splash: [[3, 100, 3.4, 1.1, 2.8, 3, 1.5, 42, 2, 1], [3, 40, 3.2, .5, 1.5, 7, 2, 26, .7, .35], [1, 7, 3.5, 4, 11, 11, 3, 0, .22, 1, .1], [5, .05, 5, 4, 11, 0, 0, 0, 1, 1]],
    launch: [[1, 10, 2, 2, 9, 14, 2, -4, .35, .7, .2], [0, 16, .4, 2.5, 5, 5, 1, 60, 2.5], [4, .05, .12, 18, 24], [8, 1, .5, 0, 200, 0, 0, 0, 40]],
    muzzle: [[1, 6, 2, 1.6, 7, 4, .5, 16, .4, .45], [0, 6, .15, 2.5, 5, 8, .3, 70, 2], [4, .05, .08, 10, 12]],
    hit: [[1, 3, 1.2, 1, 3.5, 3, .5, 0, .5, .35], [2, 18, .55, 0, 0, 38, .5, 12], [4, .05, .08, 6, 8, 0, 0, 0, .6]],
    smoke: [[1, 1, 3.2, 5, 14, 2, 2, 3, .6, .13]]
  }, T = {
    missile: [[1, 18, 4.5, .6, 18, 0, .3, -1, .7, .8], [0, 22, .12, 2.2, .8, 2, .3, .9, 1.8], [4, 0, 0, 7, 7, 0, 0, 0, .6]],
    jet: [[1, 12, 1.6, 1.2, 4, 0, .3, -1, .2, 1], [0, 16, .08, 1.3, .6, 1.5, .2, .92, 1.5], [4, 0, 0, 5, 5, 0, 0, 0, .4]],
    fire: [[1, 16, 9, 3.5, 22, 1.5, 3, 0, .9, .05], [0, 40, 1.4, 2.5, 10, 3, 7, 0, 2.2, .35], [2, 4, 1.4, 0, 0, 14, 4, 2.5], [4, 0, 0, 34, 34, 0, 0, 0, .1], [8, 5, .5, 0, 260, 0, 0, 0, 45]],
    stack: [[1, 5, 2.6, 2.2, 8, 1.2, 1, .5, .12, .34]],
    frag: [[1, 14, .9, .6, 2.2, 0, .2, -1, .4, .3], [4, 0, 0, 1.2, 1.2, 0, 0, 0, .12]]
  };
  // d 방향(궤적: 속도), v 추가 속도, s 크기 배율, td 궤적 dt (버스트 0)
  const run = (rows, p, d, v, s, td) => {
    for (let ri = 0; rows && ri < rows.length; ri++) {
      const r = rows[ri], ty = r[0], life = r[2], vr = r[5] || 0, pr = r[6] || 0, vd = r[7] || 0, q = ty == 2 || ty == 3 ? Math.sqrt(s) : s,
        seg = td && vd < 0, lv = seg ? .1 : .3, gw = td && ty == 4, lo = seg && d[1] > 99 && p[1] < 40 ? .4 + p[1] / 70 : 1; // 갑판 근처 발사 연기는 빨리 걷힘
      let n = gw ? 1 : r[1] * (ty > 3 ? 1 : KN) * (td || s) + (td ? r[11] || 0 : .99), sl = 0;
      if (seg) { // 궤적 조각: 방출기(호출 순번)별로 모은 시간을 빈틈없이 덮는다
        n = (AC[ci] += td) * r[1] * KN;
        if (n >= 1) { sl = AC[ci] / (n | 0); AC[ci] = 0; }
      } else if (td) r[11] = n % 1;
      n |= 0;
      for (let i = 0; i < n && N; i++) {
        const a = R() * 6.283, y = R() * 2 - 1, h = Math.sqrt(1 - y * y), k = pr * s * R(), uf = ty > 3 ? 1 : 1 - (td ? .15 : .8) * R(),
          w = seg ? 0 : vr * q * (.3 + .7 * R()) * (ty == 3 ? 1.7 - 1.5 * uf : 1), u = seg ? sl : vd * q * uf, f = gw ? 0 : seg ? (i + .5) * sl : (i + R()) / n * td,
          l = gw ? td * .5 : life * lo * (td && life > 1.5 ? KL : 1) * (1 - lv + 2 * lv * R()),
          g = s * (ty > 3 ? 1 : KS) * (seg ? .9 + .2 * R() : ty > 3 ? .6 + .8 * R() : .5 + R()); // 크기 편차 3배
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
        S[o + 3] = gw ? -td : f; S[o + 7] = l; S[o + 8] = r[3] * g; S[o + 9] = r[4] * g; S[o + 10] = ty; S[o + 11] = R(); S[o + 12] = r[9] || 0; S[o + 13] = (r[8] || 1) * KA * (ty == 1 && !td ? 1.5 - uf : 1); S[o + 14] = seg ? 1 : ST[ty];
        S[o + 15] = E[0] * G.sun.dir[0] + E[1] * G.sun.dir[1] + E[2] * G.sun.dir[2];
        die[b + C[c]] = G.time + l; C[c] = (C[c] + 1) % m; W[c]++;
      }
    }
  };
  G.fx = {
    burst(kind, p, o) { run(B[kind], p, o && o.dir || UP, o && o.vel || Z, o && o.size || 1, 0); },
    trail(p, v, kind, dt) { if (fr != G.frame) { fr = G.frame; ci = 0; } ci = (ci + 1) % 32; dt > 0 && run(T[kind], p, v, v, 1, dt); },
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
        FR[o + 6] = fp[1] > 0 ? FR[o + 6] - dt : 0; ci = 32 + o / 7; run(T.frag, fp, fv, fv, 1, dt);
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
