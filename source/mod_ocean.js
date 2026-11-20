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
struct V { @builtin(position) pos: vec4f, @location(0) w: vec3f, @location(1) b: vec2f };
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
fn gl(p: vec2f, s: f32, a: f32) -> f32 { // 윤슬 셀: 무작위 점이 로브 세기 a 만큼 반짝임
  let q = p / s; let h = hash33(vec3f(floor(q), s)); let o = fract(q) - .15 - h.xy * .7;
  return smoothstep(0.0, .15, a - abs(fract(h.z + g.cam.w * (.6 + h.x * 1.2)) * 2.0 - 1.0)) * exp(-dot(o, o) * ${q ? 28 : 12}.0) * (.3 + 1.4 * h.y * h.y);
}
@fragment fn fs(i: V) -> @location(0) vec4f {
  let t = g.cam.w; let L = g.sun.xyz; let wd = g.wind.xy; let sea = g.fog.w; let v = g.cam.xyz - i.w; let d = length(v); let vd = v / d;
  let fx = d * g.res.w; let fp = fx * d / max(abs(v.y), 1.0); let up = smoothstep(.3, .8, vd.y); // 픽셀 발자국(m) 가로·세로, 내려다보는 정도
  let lf = fbm(i.b / 1100.0 + wd * (t * .006), 2) * 1.33;
  let gq = sn(i.b / 50.0 + wd * (t * .02)); let gw = sn(i.b / 230.0 - wd * (t * .013)); // 파군 · 타일 반복 깨기
  var sl = vec2f(0.0); var ts = sl; var cr = 0.0; var ct = 0.0; var cd = 0.0; var ht = 0.0; var ro = .005; var fo = 0.0; var ae = 0.0; var oc = 0.0; var ol = 0.0; var sh = 1.0;
  for (var k = 0; k < 6; k++) { // 기본 6파 법선. 짧은 파는 거칠기로, 거품용 마루(e)는 더 멀리까지
    let a = g.waves[k * 2]; let c = g.waves[k * 2 + 1]; let w = select(0.0, gq[k - 2] - .5, k > 1); let th = a.w * dot(a.xy, i.b) - c.x * t + c.z + w * f32(k) * 3.0;
    let f = saturate(2.0 - a.w * fp); let m = a.w * a.z * (1.0 + 1.4 * w); let e = c.y * m * saturate(3.0 - a.w * fp * .5);
    sl += a.xy * (m * f * cos(th)); cr += e * sin(th); ct += e * sin(th + .9); ht += a.z * f * sin(th); ro += .002 - f * .002;
  }
  let s0 = sl;
  for (var k = 0; k < 3; k++) { // 스펙트럼 타일 3스케일 (회전·워프·진폭 변조)
    let e = f32(k); let sz = 173.0 * pow(.28, e); let M = mat2x2f(cos(e * .7), sin(e * .7), -sin(e * .7), cos(e * .7));
    let lod = log2(max(fp / ${q ? 2 << q : 4}.0, fx) * 512.0 / sz); let f = saturate(5.0 - lod) * (.3 + 1.4 * gw[k]);
    let s = textureSample(tile, smp, M * (i.b - wd * (t * sqrt(sz) * ${q > 1 ? 0 : .5})) / sz + e * .37 + gw.zw * .3);
    ts += s.xy * M * f; cd += (.5 - s.w * .5) * f; ro += .005 * clamp(lod, 0.0, 4.0);
  }
  // 거품 잡음: na 6m · nc 1.4m · nb 바람 줄무늬 → ch 휘젓기. lg 랭뮤어 줄무늬
  let nf = saturate(2.0 - fp * .25); let ac = dot(i.b, wd); let ax = i.b.x * wd.y - i.b.y * wd.x;
  let na = sn(i.b / 6.0 + ts * 2.0); let nc = ${q ? 'sn(i.b.yx / 1.4 - ts * 4.0)' : 'na.wzyx'};
  let nb = mix(vec4f(.5), sn(vec2f(ac / 18.0 - t * .77, ax / 4.7) + ts * 1.5), saturate(2.0 - fp * .15));
  let ch = mix(nb.z, na.y * .6 + nc.y * .4, nf);
  let lg = pow(1.0 - abs(2.0 * sn(vec2f(ac / 170.0, ax / 26.0) + gq.xy * .5).x - 1.0), 3.0) * saturate(1.5 - fp * .08) * (.03 + .05 * sea);
  var r0 = reflect(-vd, normalize(vec3f(-sl.x - ts.x, 1.0, -sl.y - ts.y))); r0.y = abs(r0.y) + .02;
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
    let lx = L.x * W.w - L.z * W.z; let ob = bx(o, vec3f(r0.x * W.w - r0.z * W.z, r0.y, dot(r0.xz, W.zw)), B); sh = min(sh, 1.0 - bx(o, vec3f(lx, L.y, dot(L.xz, W.zw)), B));
    if (ob > oc) { oc = ob; ol = saturate(lx * sign(o.x) * 3.0); }
    if (s < 0.0 || l > hb * 4.0 + s * .6) { continue; }
    let am = min(P.x * .13, 1.0); let e = max(s - hl * 2.0, 0.0); let hw = hb * min(sqrt(s / hl), 1.0);
    // 켈빈 V 팔: 발산파 법선 + 깃털 거품
    let q = (l - 1.0 - s * .34) / (hb * .3 + s * .07); let kk = 6.283 / (8.0 + P.x * 1.4); let ph = kk * (l * .57 - s * .82) + nb.z * 5.0;
    let ar = exp(-q * q - s / (hl * 5.0)) * am; let kf = saturate(2.0 - kk * fp);
    sl += (W.zw * .82 + vec2f(W.w, -W.z) * (sign(o.x) * .57)) * (ar * kf * .8 * cos(ph));
    // 거품 밀도: 팔 + 선수 물마루 + 끊기는 현측 거품 + 선미 난류 띠(나이 e 로 감쇠·확산). ae 오래 남는 기포수
    let wh = hb * (.9 + .3 * sqrt(e / hb)); let x2 = l * l / (wh * wh); let st = step(hl * 1.7, s) * am;
    fo += exp(-q * q * 9.0 - s / (hl * 1.5)) * (.4 + gq.y) * am
      + exp(-s / (hl * .3) - pow((l - hw) / (2.5 + s * .2), 2.0)) * (.5 + gq.y) * am
      + exp(-max(l - hw * .8, 0.0) / (1.0 + hb * (.25 * exp(-s / (hl * .4)) + .2 * smoothstep(hl * 1.3, hl * 2.0, s)))) * smoothstep(.5, .75, gq.z) * (.4 + gq.y) * saturate(1.0 - e / hb) * am
      + exp(-x2 * 1.5 - e / (hl * 5.0)) * st * (.4 + .6 * gq.x + .5 * exp(-e / hl));
    ae = max(ae, exp(-x2 * .6 - e / (hl * 14.0)) * st);
  }
  sl += ts * (1.0 - .75 * ae); cd *= 1.0 - .75 * ae;
  let n = normalize(vec3f(-sl.x, max(1.0 - cr - cd, .3), -sl.y)); let nv = max(dot(n, vd), .03); let sg = sqrt(ro);
  let hz = smoothstep(30.0, 1200.0, d); // 먼 바다 프레넬 → 1
  let fr = max(.02 + .98 * pow(saturate(1.0 - nv), 5.0 * exp(-2.69 * sg)) / (1.0 + 22.7 * sg * sqrt(sg) * (1.0 - .85 * hz)), oc * pow(1.0 - vd.y, 5.0) * .8);
  var r = reflect(-vd, n); r = normalize(vec3f(r.x, abs(r.y) + sg * .3 * (1.0 - hz), r.z));
  sh = mix(1.0, sh${q > 1 ? ' * shadowAt(i.w, n)' : ''}, saturate(L.y * 5.0));
  let sw = (cloudVis(i.w + vec3f(22, 0, 9)) + cloudVis(i.w - vec3f(22, 0, 9)) + cloudVis(i.w + vec3f(-9, 0, 22)) + cloudVis(i.w - vec3f(-9, 0, 22))) * .25;
  let amb = skyBase(vec3f(-L.x, .7, -L.z)); let sun = g.sunCol.rgb * (sw * sh); let nl = max(dot(n, L), 0.0);
  // 수체색: 짙은 청색, 마루는 옥빛. 내려다볼 땐 밝게 + 너울 사면 명암 띠
  let sf = saturate(.3 - 1.5 * dot(sl, L.xz)); let hh = saturate(cr * 1.6 + cd + ht * .25 + .25);
  var body = mix(vec3f(.008, .05, .095), vec3f(.01, .09, .1), max((1.0 - nv) * saturate(L.y * 2.5), hh * .4) * (1.0 - .7 * up)) * (amb * 1.4 + sun * (.1 + .8 * nl * nl) * (.4 + 2.0 * sf))
    * (.75 + .2 * lf + .4 * hh * (1.0 - up)) * (1.0 + up * (clamp(1.0 - 2.5 * dot(s0, L.xz), .6, 1.5) * 1.3 - .6))
    + vec3f(.0, .2, .15) * sun * (pow(max(dot(vd, -L), 0.0), 3.0) + .1 + sf * .4) * hh * (.08 + min(L.y, .25)) * (1.0 - .7 * up);
${R ? `  let zw = g.misc.x / i.pos.z; let pu = i.pos.xy * g.res.zw; // 굴절 + 흡수
  let t0 = g.misc.x / max(textureLoad(dpt, vec2i(i.pos.xy), 0), 1e-9) - zw;
  var uv = clamp(pu + n.xz * saturate(t0 * .3) * 2.0 / (zw + 20.0), vec2f(.001), vec2f(.999));
  var th = g.misc.x / max(textureLoad(dpt, vec2i(uv * g.res.xy), 0), 1e-9) - zw;
  if (th < 0.0) { uv = pu; th = t0; }
  th = max(th, 0.0); let bp = i.w - vd * th; // 커스틱
  let ca = pow(saturate(1.3 - textureSampleLevel(tile, smp, (bp.xz - L.xz * (bp.y / max(L.y, .2))).yx / 11.3, clamp(log2(fx * 90.0), 0.0, 4.0)).w), 2.0);
  body = mix(body, textureSampleLevel(scn, linSamp, uv, 0.0).rgb * (1.0 + ca * 4.0 * exp(bp.y * .12)), exp(-th * vec3f(.6, .25, .2)));
  fo += (1.0 - smoothstep(0.0, 2.5, th)) * smoothstep(.3, .7, gq.z);
` : ''}
  // 윤슬: 매끈한 기본 로브 + 발자국에 맞춘 두 스케일 셀의 HDR 반짝임
  let hv = normalize(vd + L); let vh = dot(vd, hv); let n2 = pow(max(dot(normalize(n + vec3f(0, 2, 0)), hv), .01), 2.0); let rb = ro * 2.0 + .03;
  let lb = exp((n2 - 1.0) / (n2 * rb)) * (1.0 - oc); let sb = lb * min((.02 + .98 * pow(1.0 - vh, 5.0)) * .5 / max(vh * vh, .1), 1.3) * min(1.0, sqrt(.08 / rb));
  let gs = log2(${q ? 2.8 : 4} * sqrt(fp * fx) * pow(fp / fx, .15)); let g0 = exp2(floor(gs));
  let sk = mix(gl(i.b, g0, lb * .45), gl(i.b, g0 * 2.0, lb * .45), fract(gs)) * ${q ? 22 : 5}.0 * saturate(2.0 - fp / (fx * 14.0));
  let cl = g.fog.y * smoothstep(.4, .8, sn((i.b - vd.xz * (1500.0 / (vd.y + .2))) / 600.0 + wd * (t * .01)).x);
  var col = mix(body * (.65 + .35 * sh) * (1.0 - .4 * oc), mix(mix(skyBase(r), g.sunCol.rgb * .2 + amb * .5, cl) * (.65 + .35 * sw), amb * .22 + sun * (ol * .1), oc), fr) + sun * (sb + sk);
  // 거품색: 태양(낮엔 흰색) + 하늘빛
  let fc = mix(sun, vec3f(dot(sun, vec3f(.33))), saturate(L.y * 3.0) * .6) * (.3 + .5 * nl) + mix(amb, vec3f(dot(amb, vec3f(.33))), .4) * 1.3;
  col = mix(col, fc * mix(vec3f(.2), vec3f(.13, .36, .34), saturate(L.y * 4.0 - .2)), min(ae * .55 + lg, .6));
  // 백파: 마루 모양의 부드러운 줄 + 꼬리
  let wc = cd * .4 + sea * .45 - .22 + (lf - .5) * .5 + (nb.x - .5) * .3; let w = fp * .1;
  let fw = min(smoothstep(.32 - w, .82 + w, cr + wc) + smoothstep(.27 - w, .82 + w, ct + wc) * nb.y * .6, .8) / (1.0 + fp * .15) * (.3 + .7 * ch) * (1.0 - .4 * up);
  // 항적 밀도 → 넓은 문턱의 레이스
  fo = max(smoothstep(0.0, 1.1, fo * 1.7 - 1.1 + ch * 1.1), fw);
  col = mix(col, fc * (.6 + .4 * mix(nb.w, na.z, nf)) * (1.0 - .35 * nf * nc.z), fo);
  for (var k = 0; k < 4; k++) { // 점광 반사 줄기
    let l = g.lights[k * 2]; let lv = l.xyz - i.w; let ld = length(lv);
    col += g.lights[k * 2 + 1].rgb * pow(max(1.0 - ld / (l.w * 1.3 + 1.0), 0.0), 2.0) * (pow(max(dot(r, lv / ld), 0.0), 40.0) * .3 + .004 + fo * .05);
  }
  // 수평선: 안개 점근색(= 수평선 하늘)으로 수렴
  return vec4f(mix(fogAt(col, g.cam.xyz - v * (1.0 + d / 2000.0)), skyBase(normalize(vec3f(-vd.x, .015, -vd.z))), exp(-vd.y / .034) * saturate(d / 300.0 - .2)), 1.0);
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
  }));
}
