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
@fragment fn fs(i: V) -> @location(0) vec4f {
  let t = g.cam.w; let L = g.sun.xyz; let wd = g.wind.xy; let sea = g.fog.w; let v = g.cam.xyz - i.w; let d = length(v); let vd = v / d;
  let fp = d * d * g.res.w / max(abs(v.y), 1.0); // 픽셀 발자국(m) → 디테일 LOD
  let lf = fbm(i.b / 1100.0 + wd * (t * .006), 2) * 1.33; // 저주파 얼룩 0..1: 구름 그림자 · 돌풍 무늬
  var sl = vec2f(0.0); var ts = sl; var cr = 0.0; var ct = 0.0; var cd = 0.0; var ro = .003; var fo = 0.0; var er = .5; var ae = 0.0;
  for (var k = 0; k < 6; k++) { // 기본 6파 해석 법선 (함정이 타는 파와 동일). 발자국보다 짧은 파는 거칠기로 넘김
    let a = g.waves[k * 2]; let c = g.waves[k * 2 + 1]; let th = a.w * dot(a.xy, i.b) - c.x * t + c.z;
    let f = saturate(2.0 - a.w * fp); let m = a.w * a.z * f;
    sl += a.xy * (m * cos(th)); cr += c.y * m * sin(th); ct += c.y * m * sin(th + .9); ro += .002 - f * .002;
  }
  for (var k = 0; k < ${q ? 3 : 2}; k++) { // 스펙트럼 타일 다중 스케일 (LOW·MEDIUM 은 구운 타일을 바람 따라 흘림). 밉 4 너머는 페이드
    let e = f32(k); let sz = 173.0 * pow(.28, e);
    let lod = log2(max(fp / ${2 << q}.0, d * g.res.w) * 512.0 / sz); let f = saturate(5.0 - lod) * (.7 + .6 * lf);
    let s = textureSample(tile, smp, (i.b - wd * (t * sqrt(sz) * ${q > 1 ? 0 : .5})) / sz + e * .37);
    ts += s.xy * f; cd += (.5 - s.w * .5) * f; ro += .005 * clamp(lod, 0.0, 4.0); er -= s.z * f * (5.0 + e * 30.0);
  }
  // 바람 방향으로 늘인 거품 줄무늬 (타일을 90° 돌려 마루가 바람과 나란하게)
  let st = ${q ? `saturate(.5 + textureSample(tile, smp, (wd * (i.b.x * wd.y - i.b.y * wd.x) + vec2f(wd.y, -wd.x) * dot(i.b, wd) * .2) / 37.0).z * 14.0)` : '.6'};
  for (var k = 0; k < 8; k++) {
    let R = u.rp[k]; let rv = i.b - R.xy; let x = length(rv) / max(R.z, .1);
    if (x < 2.0) { // 착탄 파문: 퍼지는 고리(법선 + 거품)와 안쪽 거품
      let e = exp(-pow((x - 1.0) * 4.0, 2.0)) * R.w;
      sl += rv * (e * sin((x - 1.0) * 9.0) * .9 / max(x * R.z, 1.0)); fo += e + .6 * R.w * max(1.0 - x, 0.0);
    }
    // 항적 (선체 좌표에서 해석적으로): s 선수로부터 뒤쪽 거리, l 중심선에서 옆 거리
    let W = u.wk[k * 2]; let P = u.wk[k * 2 + 1]; let p = i.b - W.xy; let hl = P.y * 1.3; let hb = P.y * .18;
    let s = hl - dot(p, W.zw); let lt = p.x * W.w - p.y * W.z; let l = abs(lt);
    if (P.x < .5 || s < 0.0 || l > hb * 2.0 + s * .5) { continue; }
    let am = min(P.x * .13, 1.0); let e = max(s - hl * 2.0, 0.0);
    // 켈빈 V 선수파: 19.5° 팔을 따라 늘어선 발산파 마루 (법선 + 마루 거품)
    let ar = exp(-pow((l - hb * .4 - s * .34) / (3.0 + s * .1), 2.0)) * am; let kk = 6.283 / (8.0 + P.x * 1.4); let ph = kk * (l * .57 - s * .82);
    sl += (W.zw * .82 + vec2f(W.w, -W.z) * (sign(lt) * .57)) * (ar * exp(-s / (P.x * 35.0)) * saturate(2.0 - kk * fp) * .5 * cos(ph));
    let hw = hb * min(sqrt(s / hl), 1.0); let wh = hw + e * .045; // 선체 반폭 (선수는 뾰족) · 뒤로 갈수록 넓어지는 난류 띠 반폭
    let nz = mix(.5, vnoise(vec2f(s * .06, lt * .4)), saturate(1.5 - fp * .25)); // 항적 방향으로 늘어진 난류 무늬
    let tb = (1.0 - smoothstep(wh * .2, wh, l + (nz - .5) * wh)) * step(hl * 1.5, s) * am;
    fo += ar * (1.0 + .35 * sin(ph)) * (1.8 * exp(-s / (hl * 1.5)) + .15 * exp(-s / (hl * 4.0))) // 선수에서 밀려나는 거품
      + (1.0 - smoothstep(hw, hw + 2.0 + s * .05, l)) * saturate(1.0 - e / hl) * am * 1.3 // 현측 세류
      + tb * (.4 + 1.2 * nz) * (1.4 * exp(-e / (hl * 1.5)) + .6 * exp(-e / (hl * 6.0)));
    ae = max(ae, tb * exp(-e / (hl * 10.0)));
  }
  sl += ts * (1.0 - .75 * ae); cd *= 1.0 - .75 * ae; // 항적 안쪽은 잔물결이 눌려 매끈
  let n = normalize(vec3f(-sl.x, max(1.0 - cr - cd, .3), -sl.y)); let nv = max(dot(n, vd), .03); let sg = sqrt(ro);
  let fr = .02 + .98 * pow(1.0 - nv, 5.0 * exp(-2.69 * sg)) / (1.0 + 22.7 * sg * sqrt(sg)); // 거친 수면 프레넬
  var r = reflect(-vd, n); r = normalize(vec3f(r.x, abs(r.y) + sg * .3, r.z));
  let cs = 1.0 - (.2 + .4 * g.fog.y) * smoothstep(.6, .35, lf); // 구름 그림자 같은 큰 명암
  let amb = skyBase(vec3f(-L.x, .7, -L.z)); let sun = g.sunCol.rgb * (cs * ${q > 1 ? 'shadowAt(i.w, n)' : '1.0'}); let nl = max(dot(n, L), 0.0);
  // 수체색: 내려다보면 남색, 비껴 보면 청록 + 태양 쪽 얇은 마루의 전방 산란
  var body = mix(vec3f(.005, .031, .062), vec3f(.009, .066, .076), (1.0 - nv) * saturate(L.y * 2.5)) * (amb * 1.4 + sun * (.15 + .5 * nl))
    + vec3f(.0, .2, .15) * sun * (pow(max(dot(vd, -L), 0.0), 3.0) + .1) * saturate(cr * 1.6 + cd + i.w.y * .25 + .25) * (.08 + min(L.y, .25));
${R ? `  let zw = g.misc.x / i.pos.z; let pu = i.pos.xy * g.res.zw; // 굴절: 불투명 장면을 법선으로 왜곡, 물 두께로 흡수
  let t0 = g.misc.x / max(textureLoad(dpt, vec2i(i.pos.xy), 0), 1e-9) - zw;
  var uv = clamp(pu + n.xz * saturate(t0 * .3) * 2.0 / (zw + 20.0), vec2f(.001), vec2f(.999));
  var th = g.misc.x / max(textureLoad(dpt, vec2i(uv * g.res.xy), 0), 1e-9) - zw;
  if (th < 0.0) { uv = pu; th = t0; }
  th = max(th, 0.0); let bp = i.w - vd * th; // 물속에 보이는 점 → 태양 방향으로 수면에 투영해 커스틱(타일 야코비안) 조회
  let ca = pow(saturate(1.3 - textureSampleLevel(tile, smp, (bp.xz - L.xz * (bp.y / max(L.y, .2))).yx / 11.3, clamp(log2(d * g.res.w * 90.0), 0.0, 4.0)).w), 2.0);
  body = mix(body, textureSampleLevel(scn, linSamp, uv, 0.0).rgb * (1.0 + ca * 4.0 * exp(bp.y * .12)), exp(-th * vec3f(.6, .25, .2)));
  fo += 1.2 - 1.2 * smoothstep(0.0, 2.5, th);
` : ''}
  let hv = normalize(vd + L); let vh = dot(vd, hv); let n2 = pow(max(dot(n, hv), .01), 2.0);
  let sp = exp((n2 - 1.0) / (n2 * ro)) / (ro * n2 * n2) * (.02 + .98 * pow(1.0 - vh, 5.0)) * .02 / max(vh * vh, .1);
${q ? `  // 윤슬: 카메라 중심 극좌표 셀(약 2픽셀)이 제각기 깜박임 (화면 난수가 아니어서 프레임 간 안정)
  let gq = vec2f(atan2(v.x, v.z) * g.res.x * .36, g.cam.y * g.res.y * .55 / length(v.xz)); let gh = hash21(floor(gq)); let gf = fract(gq) - .5 - (vec2f(gh, fract(gh * 7.3)) - .5) * .33;
  let gl = mix(1.0, pow(.5 + .5 * sin(t * (4.0 + 9.0 * gh) + gh * 70.0), 8.0) * saturate(1.0 - 9.0 * dot(gf, gf)) * 29.0, .65);
` : 'let gl = 1.0;'}
  var col = mix(body, skyBase(r) * (.8 + .3 * lf), fr) + sun * min(sp * gl, 8.0);
  let fc = sun * (.2 + .4 * nl) + amb; col = mix(col, fc * vec3f(.3, .62, .6), min(fo * .3 + ae * .4, .6)); // 기포 섞인 옥빛 물
  // 백파: 부서지는 마루 + 뒤에 남아 바람 따라 늘어지는 거품
  let wc = cd * .8 + sea * .45 - .17 + (lf - .5) * .3;
  fo += smoothstep(.3, .7, cr + wc) + smoothstep(.2, .65, ct + wc) * st * .8;
  fo = smoothstep(0.0, 1.0, (fo - saturate(er) * .8) * .9);
  col = mix(col, fc * (.8 + .2 * st), fo) + pointLights(i.w, r) * (.02 + fr * .06 + fo * .15);
  return vec4f(fogAt(col, g.cam.xyz - v * (1.0 + d / 8000.0)), 1.0); // 먼 바다는 안개를 더 얹어 수평선에서 하늘과 이어지게
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
      O.smp = d.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: 2 << q });
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
