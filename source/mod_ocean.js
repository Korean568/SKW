'use strict';
/* ═══ OCEAN — 방사형 수면 메시 · 거스트너 + 스펙트럼 타일 · 항적 밀도장 · 윤슬 · 굴절 ═══ */
{
  const u = new Float32Array(96), rp = new Float32Array(32), O = { pc: {}, nw: 0, ri: 0 };
  G.ocean = {
    wake(x, z, yaw, sp, len) { if (O.nw < 8) { const o = O.nw++ * 8; u[o] = x; u[o + 1] = z; u[o + 2] = Math.sin(yaw); u[o + 3] = Math.cos(yaw); u[o + 4] = sp; u[o + 5] = len; } },
    ripple(x, z, size = 20) { const o = (O.ri++ & 7) * 4; rp[o] = x; rp[o + 1] = z; rp[o + 2] = size; rp[o + 3] = 0; }
  };
  // 바람에 정렬된 거스트너 40파를 512² 타일(밉 5단)로 합성 → (기울기 xz, 높이, 야코비안)
  const CS = `@group(1) @binding(0) var o: texture_storage_2d<rgba16float, write>;
@compute @workgroup_size(8, 8) fn cs(@builtin(global_invocation_id) id: vec3u) {
  let n = f32(textureDimensions(o).x); let p0 = (vec2f(id.xy) + .5) / n; var p = p0; var s = p; var j = vec3f(0.0); var h = 0.0;
  for (var it = 0; it < 2; it++) { // 2회째는 역변위 좌표에서 평가 → 뾰족한 마루
    var X = vec2f(0.0); s = X; j = vec3f(0.0); h = 0.0;
    for (var i = 0.0; i < 13.0 * log(n / 24.0); i += 1.0) { // 밉마다 나이퀴스트 이하 파만 합성
      let a = hash21(vec2f(i, 7.3)) * 2.4 - 1.2; let c = cos(a); let e = sin(a);
      let m = round(vec2f(g.wind.x * c + g.wind.y * e, g.wind.y * c - g.wind.x * e) * 3.0 * pow(1.08, i)); // 정수 파수 = 타일링
      let k = length(m) * 6.2832; let D = m / length(m); let A = (.035 + .065 * g.fog.w) * pow(k, -1.15);
      let th = dot(m, p) * 6.2832 - sqrt(k) * g.cam.w * .35 + i * 2.4; let C = A * cos(th); let S = 1.6 * A * k * sin(th);
      X += D * C * 1.6; s += D * (k * C); h += A * sin(th); j += vec3f(D.x * D.x, D.y * D.y, D.x * D.y) * S;
    }
    p = p0 - X;
  }
  let J = (1.0 - j.x) * (1.0 - j.y) - j.z * j.z;
  textureStore(o, id.xy, vec4f(vec2f(s.x * (1.0 - j.y) + s.y * j.z, s.x * j.z + s.y * (1.0 - j.x)) / max(J, .3), h, J));
}`;
  // q 품질 0·1·2, R 굴절, N 메시 분할
  const FS = (q, R, N) => `struct U { wk: array<vec4f, 16>, rp: array<vec4f, 8> };
@group(1) @binding(0) var<uniform> u: U;
@group(1) @binding(1) var tile: texture_2d<f32>;
@group(1) @binding(2) var scn: texture_2d<f32>;
@group(1) @binding(3) var dpt: texture_depth_2d;
@group(1) @binding(4) var smp: sampler;
struct V { @builtin(position) pos: vec4f, @location(0) @interpolate(perspective, centroid) w: vec3f, @location(1) @interpolate(perspective, centroid) b: vec2f }; // centroid: MSAA 수평선 픽셀에서 보간값이 삼각형 밖으로 외삽되지 않게 (수평선 실선 방지)
@vertex fn vs(@builtin(vertex_index) vi: u32) -> V { // 카메라 중심 링: 가까이 조밀, 마지막 링은 수평선 너머
  let c = vi / 6u; let k = vi % 6u;
  let ij = vec2f(vec2u((c + ((50u >> k) & 1u)) % ${N}u, c / ${N}u + ((44u >> k) & 1u))) / ${N}.0;
  let a = ij.x * 6.2831853; let r = 800.0 * ij.y * ij.y / (1.00001 - ij.y); let b = g.cam.xz + vec2f(sin(a), cos(a)) * r;
  let d = gerstner(b, g.cam.w) * saturate(1.43 - r / 3500.0); var w = vec3f(b.x + d.x, d.y, b.y + d.z);
  // HIGH: 근거리 잔파 변위 (밉 = 메시 간격)
  ${q > 1 ? `w.y += textureSampleLevel(tile, smp, b / 48.44 + .37, log2(r + 1.0) * .5 + .5).z * 48.44 * saturate(1.4 - r / 160.0);` : ''}
  return V(g.viewProj * vec4f(w, 1.0), w, b);
}
fn sn(p: vec2f) -> vec4f { let f = fract(p); return textureSampleLevel(noiseTex, linSamp, (floor(p) + f * f * (3.0 - 2.0 * f) + .5) / 256.0, 0.0); }
fn bx(o: vec2f, r: vec3f, b: vec3f) -> f32 { // 선체 상자 × 광선 0..1 (중앙부는 높게)
  let d = r.xz + 1e-4; let a = (-sign(d) * b.xz - o) / d; let c = (sign(d) * b.xz - o) / d; let t = max(max(a.x, a.y), 0.0);
  return saturate((min(c.x, c.y) - t) * .2) * (1.0 - smoothstep(.6, 1.0, r.y * t / (b.y * (1.0 + 1.5 * smoothstep(.55, .3, abs(o.y + d.y * t) / b.z)))));
}
fn gl(p: vec2f, s: f32, a: f32) -> f32 { // 윤슬 셀: 부드러운 가우스 점, 밝기 분포는 넓게(대부분 어둡고 소수만 HDR)
  let q = p / s; let h = hash33(vec3f(floor(q), s)); let o = fract(q) - .3 - h.xy * .4;
  return smoothstep(0.0, .4, a - abs(fract(h.z + g.cam.w * (.5 + h.x)) * 2.0 - 1.0)) * exp(-dot(o, o) * 24.0) * (.05 + 1.6 * pow(h.y, 4.0));
}
@fragment fn fs(i: V) -> @location(0) vec4f {
  let t = g.cam.w; let L = g.sun.xyz; let wd = g.wind.xy; let sea = g.fog.w; let v = g.cam.xyz - i.w; let d = length(v); let vd = v / d;
  let fx = d * g.res.w; let fp = fx * d / max(abs(v.y), 1.0); let up = smoothstep(.3, .8, vd.y); let ud = up * saturate(d / 400.0 - .3); // 픽셀 발자국(m) 가로·세로, 내려다보는 정도, 고공 하향
  let gq = sn(i.b / 50.0 + wd * (t * .02)); let gw = sn(i.b / 230.0 - wd * (t * .013)); // 파군 · 타일 반복 깨기
  let nb = sn(vec2f(dot(i.b, wd) / 14.0 - t * .25, (i.b.x * wd.y - i.b.y * wd.x) / 8.0)); // 백파 조각: 마루 방향으로 긴 잡음
  var sl = vec2f(0.0); var ts = sl; var s0 = sl; var cr = 0.0; var fw = 0.0; var cd = 0.0; var ht = 0.0; var ro = .005; var fo = 0.0; var ae = 0.0; var oc = 0.0; var sh = 1.0;
  for (var k = 0; k < 6; k++) { // 기본 6파 법선: 앞 3파 = 너울 s0. 파군 잡음 w 가 진폭을 끊어 띠가 불규칙. 짧은 파는 고공에서 약하게
    let a = g.waves[k * 2]; let c = g.waves[k * 2 + 1]; let w = select(2.0 * smoothstep(.3, .7, gw[min(k, 3)]), .3 + 1.4 * gq[max(k - 3, 0)], k > 2);
    let th = a.w * dot(a.xy, i.b) - c.x * t + c.z + (gw.y - .5) * f32(k) * 1.2 + gq.w * 1.6; let S = sin(th); let C = cos(th);
    let f = saturate(2.0 - a.w * fp) * select(1.0, 1.0 - .8 * ud, k > 2); let m = a.w * a.z * w; let e = c.y * m * saturate(3.0 - a.w * fp * .5);
    sl += a.xy * (m * f * C); cr += e * S; ht += a.z * f * S; ro += .002 - f * .002;
    if (k == 2) { s0 = sl; }
    // 백파: 마루선을 따르는 가는 줄 + 파 뒤쪽(C>0) 짧은 꼬리, 조각 잡음·파군이 높은 곳만
    let cw = a.w * (1.2 + fp * .2) * (1.0 + 1.5 * saturate(C * 2.0));
    if (k < 3) { fw += exp(-2.0 * (1.0 - S) / (cw * cw)) * smoothstep(.62, .92, nb[k] + w * .08 + sea * .3 - .25); }
  }
  for (var k = 0; k < 3; k++) { // 스펙트럼 타일 3스케일 (회전·워프·진폭 변조)
    let e = f32(k); let sz = 173.0 * pow(.28, e); let M = mat2x2f(cos(e * .7), sin(e * .7), -sin(e * .7), cos(e * .7));
    let lod = log2(max(fp / ${q ? 2 << q : 4}.0, fx) * 512.0 / sz); let f = saturate(5.0 - lod) * (.3 + 1.4 * gw[k]) * (1.0 - .7 * ud);
    let s = textureSample(tile, smp, M * (i.b - wd * (t * sqrt(sz) * ${q > 1 ? 0 : .5})) / sz + e * .37 + gw.zw * .3);
    ts += s.xy * M * f; cd += (.5 - s.w * .5) * f; ro += .005 * clamp(lod, 0.0, 4.0);
  }
  // 거품 잡음(등방): na 6m · nc 1.4m → ch 휘젓기
  let nf = saturate(2.0 - fp * .25); let na = sn(i.b / 6.0 + ts * 2.0); let nc = ${q ? 'sn(i.b.yx / 1.4 - ts * 4.0)' : 'na.wzyx'};
  let ch = mix(.5, na.y * .6 + nc.y * .4, nf);
  var r0 = reflect(-vd, normalize(vec3f(-sl.x - ts.x, 3.0, -sl.y - ts.y))); r0.y = abs(r0.y) + .02;
  for (var k = 0; k < 8; k++) {
    let R = u.rp[k]; let rv = i.b - R.xy; let x = length(rv) / max(R.z, .1);
    if (x < 2.0) { // 착탄 파문
      let e = exp(-pow((x - 1.0) * 4.0, 2.0)) * R.w;
      sl += rv * (e * sin((x - 1.0) * 9.0) * .9 / max(x * R.z, 1.0)); fo += e + .6 * R.w * max(1.0 - x, 0.0);
    }
    // 항적 (선체 좌표 o = 옆·앞): s 선수에서 뒤로, l 옆으로. 폭 최소 3px
    let W = u.wk[k * 2]; let P = u.wk[k * 2 + 1]; if (P.y < 1.0) { continue; }
    let p = i.b - W.xy; let hl = P.y * 1.3; let hb = max(P.y * .18, fp * 1.5); let o = vec2f(p.x * W.w - p.y * W.z, dot(p, W.zw)); let l = abs(o.x); let s = hl - o.y;
    // 반사선이 선체에 닿으면 oc, 태양 광선이 닿으면 그림자 sh
    let B = vec3f(P.y * .11, P.y * .13, hl * .95);
    oc = max(oc, bx(o, vec3f(r0.x * W.w - r0.z * W.z, r0.y, dot(r0.xz, W.zw)), B)); sh = min(sh, 1.0 - bx(o, vec3f(L.x * W.w - L.z * W.z, L.y, dot(L.xz, W.zw)), B));
    if (s < 0.0 || l > hb * 4.0 + s * .6) { continue; }
    let am = min(P.x * .13, 1.0); let e = max(s - hl * 2.0, 0.0); let hw = hb * min(sqrt(s / hl), 1.0); let wl = hl * (hl * .05 + 1.0);
      let hs = .3 * exp(-s / (hl * .4)) + .25 * smoothstep(hl * 1.3, hl * 2.0, s); // 선수 어깨·선미에서 두꺼움
    // 켈빈 V 팔: 발산파 법선 + 깃털 거품
    let q = (l - 1.0 - s * .34) / (hb * .4 + s * .1); let kk = 6.283 / (8.0 + P.x * 1.4); let ph = kk * (l * .57 - s * .82) + gq.z * 4.0;
    let ar = exp(-q * q - s / (hl * 5.0)) * am; let kf = saturate(2.0 - kk * fp) * cos(ph);
    sl += (W.zw * .82 + vec2f(W.w, -W.z) * (sign(o.x) * .57)) * (ar * kf * .5);
    // 거품 밀도: 팔 + 선수 물마루 + 흘러가며 끊기는 현측 거품 + 선미 난류 띠(나이 e 로 감쇠·확산). ae 기포수(멀수록 조각남)
    let wh = hb * (.9 + .3 * sqrt(e / hb)); let x2 = l * l / (wh * wh); let st = step(hl * 1.7, s) * am;
    fo += exp(-q * q * 3.0 - s / (hl * 1.2)) * saturate(kf * 2.0 - .5) * (.6 + gq.y) * am * 1.3
      + exp(-s / (hl * .3) - pow((l - hw) / (2.5 + s * .2), 2.0)) * (.5 + gq.y) * am
      + exp(-max(l - hw * .8, 0.0) / (.4 + hb * hs)) * smoothstep(.45, .7, sn(vec2f((s - P.x * t) * .08, o.x * .3)).x + hs) * (hs * 2.5 + gq.y * .5) * saturate(1.0 - e / hb) * am
      + exp(-x2 * 1.5 - e / wl) * st * (.4 + .6 * gq.x + .5 * exp(-e / hl));
    ae = max(ae, exp(-x2 * .9 - e / (wl * 2.5)) * st * mix(1.0, gq.x * 1.7, saturate(e / wl)));
  }
  sl += ts * (1.0 - .75 * ae); cd *= 1.0 - .75 * ae;
  let n = normalize(vec3f(-sl.x, max(1.0 - cr - cd, .3), -sl.y)); let nv = max(dot(n, vd), .03); let sg = sqrt(ro);
  let hz = smoothstep(30.0, 1200.0, d); // 먼 바다 프레넬 → 1
  // 먼 스침각 gz: 수평선 바로 위 하늘 ah(시선 방위의 노을 포함)를 비춤
  let gz = (1.0 - smoothstep(.015, .11, vd.y)) * saturate(d / 300.0 - .2); let ah = skyBase(normalize(vec3f(-vd.x, .09, -vd.z))); let ls = saturate(1.0 - L.y * 2.5);
  let fr = max(mix(.02 + .98 * pow(saturate(1.0 - nv), 5.0 * exp(-2.69 * sg)) / (1.0 + 22.7 * sg * sqrt(sg) * (1.0 - .85 * hz)), max(.6, .9 * ls), gz), oc * pow(1.0 - vd.y, 5.0) * .8);
  var r = reflect(-vd, n); r = normalize(vec3f(r.x, abs(r.y) + sg * .3 * (1.0 - hz), r.z));
  sh = mix(1.0, sh${q > 1 ? ' * shadowAt(i.w + n * vec3f(9, 0, 9), n)' : ''}, saturate(L.y * 5.0) * .6);
  let sw = (cloudVis(i.w + vec3f(22, 0, 9)) + cloudVis(i.w - vec3f(22, 0, 9)) + cloudVis(i.w + vec3f(-9, 0, 22)) + cloudVis(i.w - vec3f(-9, 0, 22))) * .25;
  let amb = skyBase(vec3f(-L.x, .7, -L.z)); let sun = g.sunCol.rgb * (sw * sh); let nl = max(dot(n, L), 0.0);
  // 수체색: 짙은 청색(낮은 태양에선 탈색). 옥빛은 해석적 너울 마루 hh 에만. 내려다볼 땐 사면 명암
  let sf = saturate(.3 - 1.5 * dot(sl, L.xz)); let hh = saturate(cr * 1.6 + ht * .25);
  var body = (mix(mix(vec3f(.008, .05, .095), vec3f(.03, .042, .06), ls * .6), vec3f(.012, .075, .095), hh * hh * (.6 - .4 * up)) + up * .02)
    * (mix(amb, ah, ls * .5) * (1.4 + 1.2 * saturate(1.0 - L.y * 5.0)) + sun * (.1 + .8 * nl * nl) * (.4 + 2.0 * sf))
    * (1.05 + hh * (.5 - .3 * up)) * (1.0 + up * (clamp(1.0 - 5.0 * dot(s0 * .6 + sl * .4, L.xz), .5, 1.6) * 1.3 - .6))
    + vec3f(.0, .1, .09) * sun * (pow(max(dot(vd, -L), 0.0), 3.0) + .1) * hh * hh * (.08 + min(L.y, .25)) * (1.0 - .7 * up);
${R ? `  let zw = g.misc.x / i.pos.z; let pu = i.pos.xy * g.res.zw; // 굴절 + 흡수
  let t0 = g.misc.x / max(textureLoad(dpt, vec2i(i.pos.xy), 0), 1e-9) - zw;
  var uv = clamp(pu + n.xz * saturate(t0 * .3) * 2.0 / (zw + 20.0), vec2f(.001), vec2f(.999));
  var th = g.misc.x / max(textureLoad(dpt, vec2i(uv * g.res.xy), 0), 1e-9) - zw;
  if (th < 0.0) { uv = pu; th = t0; }
  th = max(th, 0.0); let bp = i.w - vd * th; // 커스틱
  let ca = pow(saturate(1.3 - textureSampleLevel(tile, smp, (bp.xz - L.xz * (bp.y / max(L.y, .2))).yx / 11.3, clamp(log2(fx * 90.0), 0.0, 4.0)).w), 2.0);
  body = mix(body, textureSampleLevel(scn, linSamp, uv, 0.0).rgb * (1.0 + ca * 4.0 * exp(bp.y * .12)), exp(-th * vec3f(.6, .25, .2)));
` : ''}
  // 윤슬: 통계적 기본 로브(너울 기울기 s0 만, 긴 꼬리 lw) × 잔물결 ±25% + 발자국에 맞춘 셀의 HDR 반짝임. 먼 곳(nr→0)은 로브가 대신함
  let hv = normalize(vd + L); let vh = dot(vd, hv); let T = hv.xz / max(hv.y, .05); let x0 = s0 * .5 + T; let xd = sl + T;
  let lw = (1.0 - oc) / (1.0 + dot(x0, x0) / (.03 + ro * .3)); let md = clamp(.3 - dot(xd, xd) * 2.0, -.25, .25); let nr = saturate(1.5 - fp / (fx * 28.0));
  // 기본 광택: 높은 태양·근거리에선 좁고 약하게, 낮은 태양·먼 곳에선 밝은 기둥
  let sb = pow(lw, 2.0 + 2.0 * nr * (1.0 - ls)) * mix(1.3, .08 + .9 * ls, nr) * (1.0 + md) * min((.02 + .98 * pow(1.0 - vh, 5.0)) * .5 / max(vh * vh, .1), .8);
  let gs = log2(${q ? 5 : 3.8} * sqrt(fp * fx) * pow(fp / fx, .25)); let g0 = exp2(floor(gs)); let ga = lw * (.45 + 1.4 * md) * (.55 + .45 * saturate(fp / (fx * 6.0)));
  let sk = mix(gl(i.b, g0, ga), gl(i.b, g0 * 2.0, ga), fract(gs)) * (9.0 + 14.0 * ls) * nr;
  let cl = g.fog.y * smoothstep(.4, .8, sn((i.b - vd.xz * (1500.0 / (vd.y + .2))) / 600.0 + wd * (t * .01)).x);
  var col = mix(body * (1.0 - .4 * oc), mix(mix(mix(skyBase(r), ah, gz), g.sunCol.rgb * .2 + amb * .5, cl) * (.65 + .35 * sw), amb * .22, oc), fr) + sun * (sb + sk);
  // 거품색: 태양(낮엔 흰색) + 하늘빛
  let fc = mix(sun, vec3f(dot(sun, vec3f(.33))), saturate(L.y * 3.0) * .9) * (.3 + .5 * nl) + mix(amb, vec3f(dot(amb, vec3f(.33))), .4) * 1.3;
  col = mix(col, fc * mix(vec3f(.2), vec3f(.13, .36, .34), saturate(L.y * 4.0 - .2)), ae * .55);
  // 항적 밀도 → 넓은 문턱의 레이스. 백파 fw 는 부드럽게, 멀수록 옅게
  fo = max(smoothstep(0.0, 1.1, fo * 1.7 - 1.1 + ch * 1.1), smoothstep(.2, 1.0, min(fw, 1.0) * (.1 + 1.8 * ch)) * (.55 - .2 * up) / (1.0 + fp * .15));
  col = mix(col, fc * (.6 + .4 * mix(.5, na.z, nf)) * (1.0 - .35 * nf * nc.z), fo);
  for (var k = 0; k < 4; k++) { // 점광: 기울기 공간 반사 줄기(광원 아래 좁은 세로 줄기) + 거품 조명
    let l = g.lights[k * 2]; let lv = l.xyz - i.w; let ld = length(lv); let h = normalize(vd + lv / ld); let x = sl + h.xz / max(h.y, .05);
    col += g.lights[k * 2 + 1].rgb * pow(max(1.0 - ld / (l.w * 1.3 + 1.0), 0.0), 3.0) * (exp(-dot(x, x) / (.006 + ro * .5)) + fo * .05);
  }
  // 수평선: 맑으면 하늘보다 조금 어둡고 푸른 선으로, 연무가 짙으면 하늘색에 녹아듦
  let hf = smoothstep(.3, .5, g.fog.z);
  return vec4f(mix(fogAt(col, i.w), skyBase(normalize(vec3f(-vd.x, .015, -vd.z))) * mix(vec3f(.76, .82, .92), vec3f(1.0), hf),
    exp(-vd.y / (.014 + .03 * hf)) * saturate(d / 300.0 - .2)), 1.0);
}`;
  G.register('ocean', Object.assign(O, {
    init() {
      const d = G.dev, S = GPUShaderStage, T = GPUTextureUsage;
      O.ub = d.createBuffer({ size: 384, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      O.bgl = d.createBindGroupLayout({ entries: [{ buffer: {} }, { texture: {} }, { texture: {} }, { texture: { sampleType: 'depth' } }, { sampler: {} }]
        .map((e, i) => ({ binding: i, visibility: S.VERTEX | S.FRAGMENT, ...e })) });
      const l = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: S.COMPUTE, storageTexture: { format: G.HDR } }] });
      const tx = d.createTexture({ size: [512, 512], mipLevelCount: 5, format: G.HDR, usage: T.STORAGE_BINDING | T.TEXTURE_BINDING });
      O.tv = tx.createView(); O.cp = d.createComputePipeline({ layout: G.layout(l), compute: { module: G.shader(CS, 'ocean-tile'), entryPoint: 'cs' } });
      O.cbg = [0, 1, 2, 3, 4].map(m => d.createBindGroup({ layout: l, entries: [{ binding: 0, resource: tx.createView({ baseMipLevel: m, mipLevelCount: 1 }) }] }));
    },
    onQuality(Q) { // 수면 파이프라인은 (품질, 굴절, MSAA 샘플 수) 조합별로 한 번만 생성
      const d = G.dev, q = Q.ocean, R = q > 1 && Q.refract ? 1 : 0, key = q * 2 + R + Q.msaa * 8, N = q ? 256 : 176;
      if (!O.pc[key]) {
        const m = G.shader(FS(q, R, N), 'ocean');
        O.pc[key] = d.createRenderPipeline({ layout: G.layout(O.bgl), vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint: 'fs', targets: [{ format: G.HDR }] },
          multisample: { count: Q.msaa }, depthStencil: { format: G.DEPTH, depthWriteEnabled: true, depthCompare: 'greater' } });
      }
      O.pipe = O.pc[key]; O.n = N * N * 6; O.hi = q > 1;
      O.smp = d.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: q ? 2 << q : 4 });
    },
    onResize() { // 굴절용 사본 뷰가 바뀌므로 바인드 그룹만 다시 묶음
      const T = G.targets;
      O.bg = G.dev.createBindGroup({ layout: O.bgl, entries: [{ buffer: O.ub }, O.tv, T.hdrCopyView, T.depthCopyView, O.smp].map((r, i) => ({ binding: i, resource: r })) });
    },
    update(dt) { for (let i = 3; i < 32; i += 4) rp[i] += dt; },
    prepare() { // 항적 8 + 파문 8 업로드 (할당 없음)
      u.fill(0, O.nw * 8, 96); O.nw = 0;
      for (let o = 0; o < 32; o += 4) {
        const a = rp[o + 3] / 5; if (!rp[o + 2] || a >= 1) continue;
        u[64 + o] = rp[o]; u[65 + o] = rp[o + 1]; u[66 + o] = rp[o + 2] * (.3 + a * 2); u[67 + o] = (1 - a) ** 2;
      }
      G.dev.queue.writeBuffer(O.ub, 0, u);
    },
    compute(enc) { // HIGH: 매 프레임 합성 · 그 외: 바람/해상 상태가 바뀔 때만 다시 구움
      const k = G.env.windDir + G.env.sea * 9; if (!O.hi && O.k === k) return; O.k = k;
      const p = enc.beginComputePass(); p.setPipeline(O.cp); p.setBindGroup(0, G.bg0); O.cbg.forEach((b, m) => { p.setBindGroup(1, b); p.dispatchWorkgroups(64 >> m, 64 >> m); }); p.end();
    },
    water(p) { p.setPipeline(O.pipe); p.setBindGroup(1, O.bg); p.draw(O.n); }
  }), 'naval');
}
