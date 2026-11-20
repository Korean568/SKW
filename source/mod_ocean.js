'use strict';
/* ═════════ OCEAN — 방사형 수면 메시 · 거스트너 + 스펙트럼 타일 · 항적 · 거품 · 굴절 ═════════ */
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
fn sn(p: vec2f) -> vec4f { let f = fract(p); return textureSampleLevel(noiseTex, linSamp, (floor(p) + f * f * (3.0 - 2.0 * f) + .5) / 256.0, 0.0); } // 매끈한 값 잡음
@fragment fn fs(i: V) -> @location(0) vec4f {
  let t = g.cam.w; let L = g.sun.xyz; let wd = g.wind.xy; let sea = g.fog.w; let v = g.cam.xyz - i.w; let d = length(v); let vd = v / d;
  let fp = d * d * g.res.w / max(abs(v.y), 1.0); // 픽셀 발자국(m) → 디테일 LOD
  let lf = fbm(i.b / 1100.0 + wd * (t * .006), 2) * 1.33; // 저주파 얼룩 0..1: 돌풍 무늬 · 큰 색 변화
  let gq = sn(i.b / 50.0 + wd * (t * .02)); // 파군: 짧은 파의 진폭·위상을 덩어리지게 흔듦 → 격자 무늬 없음
  var sl = vec2f(0.0); var ts = sl; var cr = 0.0; var ct = 0.0; var cd = 0.0; var ht = 0.0; var ro = .005; var fo = 0.0; var ae = 0.0; var oc = 0.0; var ol = 0.0; var pr = 0.0; var ao = 0.0;
  for (var k = 0; k < 6; k++) { // 기본 6파 해석 법선 (함정이 타는 파와 동일). 발자국보다 짧은 파는 거칠기로 넘김
    let a = g.waves[k * 2]; let c = g.waves[k * 2 + 1]; let w = select(0.0, gq[k - 2] - .5, k > 1); let th = a.w * dot(a.xy, i.b) - c.x * t + c.z + w * f32(k) * 3.0;
    let f = saturate(2.0 - a.w * fp); let m = a.w * a.z * f * (1.0 + 1.4 * w);
    sl += a.xy * (m * cos(th)); cr += c.y * m * sin(th); ct += c.y * m * sin(th + .9); ht += a.z * f * sin(th); ro += .002 - f * .002;
  }
  for (var k = 0; k < 3; k++) { // 스펙트럼 타일 3스케일 (스케일마다 회전). 밉으로 걸러진 기울기 분산은 거칠기로
    let e = f32(k); let sz = 173.0 * pow(.28, e); let M = mat2x2f(cos(e * .7), sin(e * .7), -sin(e * .7), cos(e * .7));
    let lod = log2(max(fp / ${q ? 2 << q : 4}.0, d * g.res.w) * 512.0 / sz); let f = saturate(5.0 - lod) * (.7 + .6 * lf);
    let s = textureSample(tile, smp, M * (i.b - wd * (t * sqrt(sz) * ${q > 1 ? 0 : .5})) / sz + e * .37);
    ts += s.xy * M * f; cd += (.5 - s.w * .5) * f; ro += .005 * clamp(lod, 0.0, 4.0);
  }
  // 거품 침식 잡음: na 5m · nc 1.2m 셀, nb 바람 방향 줄무늬
  let nf = saturate(2.0 - fp * .6);
  let na = sn(i.b / 5.0 + ts * 2.0); let nc = ${q ? 'sn(i.b.yx / 1.2 - ts * 4.0)' : 'na.wzyx'};
  let nb = mix(vec4f(.5), sn(vec2f(dot(i.b, wd) / 18.0 - t * .77, (i.b.x * wd.y - i.b.y * wd.x) / 4.7) + ts * 1.5), saturate(2.0 - fp * .15));
  for (var k = 0; k < 8; k++) {
    let R = u.rp[k]; let rv = i.b - R.xy; let x = length(rv) / max(R.z, .1);
    if (x < 2.0) { // 착탄 파문: 퍼지는 고리(법선 + 거품)와 안쪽 거품
      let e = exp(-pow((x - 1.0) * 4.0, 2.0)) * R.w;
      sl += rv * (e * sin((x - 1.0) * 9.0) * .9 / max(x * R.z, 1.0)); fo += e + .6 * R.w * max(1.0 - x, 0.0);
    }
    // 항적 (선체 좌표에서 해석적으로): s 선수로부터 뒤쪽 거리, l 중심선에서 옆 거리. 폭·수명은 함 크기(P.y)에 비례
    let W = u.wk[k * 2]; let P = u.wk[k * 2 + 1]; let p = i.b - W.xy; let hl = P.y * 1.3; let hb = P.y * .18;
    let s = hl - dot(p, W.zw); let lt = p.x * W.w - p.y * W.z; let l = abs(lt);
    if (P.y < 1.0) { continue; }
    pr = max(pr, 1.5 - length(p) / (P.y * 2.5)); // 선체 근접도 → 수면 그림자 세기
    if (s < 0.0 || l > hb * 4.0 + s * .5) { continue; }
    let am = min(P.x * .13, 1.0); let e = max(s - hl * 2.0, 0.0);
    let hw = hb * min(sqrt(s / hl), 1.0); let wh = hw + e * hb * .006; // 선체 반폭 (선수는 뾰족) · 뒤로 갈수록 넓어지는 난류 띠 반폭
    // 켈빈 V: 19.5° 팔을 따라 이어지는 부드러운 줄기 (톱니 없음). 법선은 발산파
    let q = (l - hb * .4 - s * .34) / (hb * .5 + s * .12); let ar = exp(-q * q) * am; let kk = 6.283 / (8.0 + P.x * 1.4);
    sl += (W.zw * .82 + vec2f(W.w, -W.z) * (sign(lt) * .57)) * (ar * exp(-s / (P.x * 35.0 + 1.0)) * saturate(2.0 - kk * fp) * .5 * cos(kk * (l * .57 - s * .82) + nb.z * 5.0));
    // 선미 난류 띠: 나이 들수록 넓고 옅게 조각남
    let tb = (1.0 - smoothstep(.2, 1.2, l / wh + nb.y - .5)) * step(hl * 1.5, s) * am;
    fo += ar * (.7 + .4 * cos(q * 4.0 + gq.x * 9.0)) * (.5 + gq.y) * (1.2 * exp(-s / hl) + .3 * exp(-s / (hl * 4.0))) // 선수에서 밀려나는 거품
      + (1.0 - smoothstep(hw, hw + 1.5 + s * .04, l)) * saturate(1.0 - e / hb) * am // 현측 세류
      + tb * (.5 + nb.w) * (1.6 * exp(-e / (hl * .5)) + .45 * exp(-e / (hl * 3.0)));
    ae = max(ae, tb * (.3 + nb.x) * exp(-e / (hl * 3.0)));
    // 선체 반사 (거울 반사선이 현측에 닿는 높이로 판정) · ol 햇빛 받는 현측 · ao 흘수선 그늘
    let ta = (l - hw) / max((vd.x * W.w - vd.z * W.z) * sign(lt), .03); let sh = s + dot(vd.xz, W.zw) * ta; let g0 = exp(-max(l - hw, 0.0) / hb);
    let o = (1.0 - smoothstep(P.y * .08, P.y * .3, (vd.y - 2.0 * dot(ts, vd.xz)) * ta)) * smoothstep(0.0, hb, sh) * smoothstep(hl * 2.0, hl * 2.0 - hb, sh) * sqrt(g0);
    oc = max(oc, o); ol += o * max((L.x * W.w - L.z * W.z) * sign(lt), 0.0); ao = max(ao, g0 * g0 * saturate(s / hb) * saturate((hl * 2.0 - s) / hb));
  }
  sl += ts * (1.0 - .75 * ae); cd *= 1.0 - .75 * ae; // 항적 안쪽은 잔물결이 눌려 매끈
  let n = normalize(vec3f(-sl.x, max(1.0 - cr - cd, .3), -sl.y)); let nv = max(dot(n, vd), .03); let sg = sqrt(ro);
  let hz = smoothstep(30.0, 1200.0, d); // 먼 바다: 스치는 각에서 프레넬 → 1, 밝은 수평선 하늘을 반사
  let fr = .02 + .98 * pow(saturate(1.0 - nv), 5.0 * exp(-2.69 * sg)) / (1.0 + 22.7 * sg * sqrt(sg) * (1.0 - .85 * hz)); // 거친 수면 프레넬
  var r = reflect(-vd, n); r = normalize(vec3f(r.x, abs(r.y) + sg * .3 * (1.0 - hz), r.z));
  let cs = 1.0 - (.2 + .4 * g.fog.y) * smoothstep(.6, .35, lf); // 돌풍 무늬의 큰 명암
  // 구름 그림자 (4탭 블러) × 함정 그림자 (태양이 낮거나 선체에서 멀면 옅게)
  let sw = (cloudVis(i.w + vec3f(22, 0, 9)) + cloudVis(i.w - vec3f(22, 0, 9)) + cloudVis(i.w + vec3f(-9, 0, 22)) + cloudVis(i.w - vec3f(-9, 0, 22))) * .25
    ${q > 1 ? '* mix(1.0, shadowAt(i.w, n), saturate(L.y * 4.0) * saturate(.4 + pr))' : ''};
  let amb = skyBase(vec3f(-L.x, .7, -L.z)); let sun = g.sunCol.rgb * (cs * sw); let nl = max(dot(n, L), 0.0);
  // 수체색: 짙은 청록, 마루는 옥빛. 태양 쪽 사면(sf)은 밝게 + 마루의 전방 산란
  let sf = saturate(.3 - 1.5 * dot(sl, L.xz)); let hh = saturate(cr * 1.6 + cd + ht * .25 + .25);
  var body = mix(vec3f(.007, .044, .078), vec3f(.01, .085, .09), max((1.0 - nv) * saturate(L.y * 2.5), hh * .6)) * (amb * 1.4 + sun * (.1 + .8 * nl * nl) * (.4 + 2.0 * sf)) * (.6 + .5 * lf + .4 * hh)
    + vec3f(.0, .2, .15) * sun * (pow(max(dot(vd, -L), 0.0), 3.0) + .1 + sf * .4) * hh * (.08 + min(L.y, .25));
${R ? `  let zw = g.misc.x / i.pos.z; let pu = i.pos.xy * g.res.zw; // 굴절: 불투명 장면을 법선으로 왜곡, 물 두께로 흡수
  let t0 = g.misc.x / max(textureLoad(dpt, vec2i(i.pos.xy), 0), 1e-9) - zw;
  var uv = clamp(pu + n.xz * saturate(t0 * .3) * 2.0 / (zw + 20.0), vec2f(.001), vec2f(.999));
  var th = g.misc.x / max(textureLoad(dpt, vec2i(uv * g.res.xy), 0), 1e-9) - zw;
  if (th < 0.0) { uv = pu; th = t0; }
  th = max(th, 0.0); let bp = i.w - vd * th; // 물속에 보이는 점 → 태양 방향으로 수면에 투영해 커스틱(타일 야코비안) 조회
  let ca = pow(saturate(1.3 - textureSampleLevel(tile, smp, (bp.xz - L.xz * (bp.y / max(L.y, .2))).yx / 11.3, clamp(log2(d * g.res.w * 90.0), 0.0, 4.0)).w), 2.0);
  body = mix(body, textureSampleLevel(scn, linSamp, uv, 0.0).rgb * (1.0 + ca * 4.0 * exp(bp.y * .12)), exp(-th * vec3f(.6, .25, .2)));
  fo += 1.0 - smoothstep(0.0, 2.5, th);
` : ''}
  let hv = normalize(vd + L); let vh = dot(vd, hv); let n2 = pow(max(dot(n, hv), .01), 2.0);
  let sp = exp((n2 - 1.0) / (n2 * ro)) / (ro * n2 * n2) * (.02 + .98 * pow(1.0 - vh, 5.0)) * .015 / max(vh * vh, .1) * (1.0 - oc);
  // 반사: 하늘 + 저주파 구름 + 선체. 따뜻한 태양 윤슬은 3배에서 부드럽게 포화
  let cl = g.fog.y * smoothstep(.4, .8, sn((i.b - vd.xz * (1500.0 / (vd.y + .2))) / 600.0 + wd * (t * .01)).x);
  var col = mix(body * (1.0 - .4 * oc), mix(mix(skyBase(r) * (.95 + .3 * lf), g.sunCol.rgb * .2 + amb * .5, cl), amb * .3, oc) * (.6 + .4 * sw) + sun * (ol * .3), fr) + sun * vec3f(1.2, 1.0, .75) * sp / (1.0 + sp * .3);
  // 거품: 중성 흰색 × (태양 + 채도를 뺀 하늘빛)
  let fc = (sun * (.25 + .5 * nl) + mix(amb, vec3f(dot(amb, vec3f(.4))), .7) * .9 + g.sunCol.rgb * .04) * .85;
  col = mix(col, fc * mix(vec3f(.17), vec3f(.1, .3, .28), saturate(L.y * 4.0 - .2)), min(fo * .3 + ae * .5, .6)); // 기포 섞인 옥빛 물 (낮은 태양에선 중성)
  // 백파: 부서지는 마루 + 바람 줄무늬. 발자국이 커지면 문턱이 넓어져 부드럽게 사라짐
  let wc = cd * .4 + sea * .45 - .17 + (lf - .5) * .5 + (nb.x - .5) * .5; let w = fp * .2;
  fo += min(smoothstep(.32 - w, .82 + w, cr + wc) + smoothstep(.27 - w, .82 + w, ct + wc) * nb.y, .7) / (1.0 + fp * .2);
  // 침식: 세 스케일 값 잡음 + 넓은 문턱 → 부드러운 덩어리와 구멍 (실선 없음)
  fo = smoothstep(0.0, .6 + fp * .1, fo * 1.2 - (nb.y * .5 + .25 + (na.x - .5) * .7 * nf + (nc.x - .5) * .4 * saturate(1.5 - fp * 1.5)) / (1.0 + fp * .1)) * .92;
  col = mix(col, fc * (1.0 - .3 * nf * nc.z), fo) * (1.0 - .3 * ao) + pointLights(i.w, r) * (.02 + fr * .06 + fo * .15);
  return vec4f(fogAt(col, g.cam.xyz - v * (1.0 + d / 2000.0)), 1.0); // 먼 바다는 안개를 더 얹어 수평선에서 하늘과 이어지게
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
