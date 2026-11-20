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
  let lf = fbm(i.b / 1100.0 + wd * (t * .006), 2) * 1.33; // 저주파 얼룩 0..1: 돌풍 무늬 · 큰 색 변화
  var sl = vec2f(0.0); var ts = sl; var cr = 0.0; var ct = 0.0; var cd = 0.0; var ro = ${q ? .004 : .01}; var fo = 0.0; var ae = 0.0; var oc = 0.0;
  for (var k = 0; k < 6; k++) { // 기본 6파 해석 법선 (함정이 타는 파와 동일). 발자국보다 짧은 파는 거칠기로 넘김
    let a = g.waves[k * 2]; let c = g.waves[k * 2 + 1]; let th = a.w * dot(a.xy, i.b) - c.x * t + c.z;
    let f = saturate(2.0 - a.w * fp); let m = a.w * a.z * f;
    sl += a.xy * (m * cos(th)); cr += c.y * m * sin(th); ct += c.y * m * sin(th + .9); ro += .002 - f * .002;
  }
  for (var k = 0; k < 3; k++) { // 스펙트럼 타일 3스케일 (LOW·MEDIUM 은 구운 타일을 바람 따라 흘림). 밉으로 걸러진 기울기 분산은 거칠기로 → 먼 윤슬은 매끈한 기둥
    let e = f32(k); let sz = 173.0 * pow(.28, e);
    let lod = log2(max(fp / ${q ? 2 << q : 4}.0, d * g.res.w) * 512.0 / sz); let f = saturate(5.0 - lod) * (.7 + .6 * lf);
    let s = textureSample(tile, smp, (i.b - wd * (t * sqrt(sz) * ${q > 1 ? 0 : .5})) / sz + e * .37);
    ts += s.xy * f; cd += (.5 - s.w * .5) * f; ro += .005 * clamp(lod, 0.0, 4.0);
  }
  // 매끈한 값 잡음 (백색 잡음 텍스처의 쌍선형 확대, 기울기로 워프): na 2m 셀, nb 바람 방향으로 늘인 줄무늬. 발자국이 셀을 넘으면 평균값
  let nf = saturate(1.3 - fp * .8);
  let na = textureSampleLevel(noiseTex, linSamp, (i.b + i.b.yx * vec2f(.4, -.4)) / 560.0 + ts * .012, 0.0);
  let nb = mix(vec4f(.5), textureSampleLevel(noiseTex, linSamp, vec2f(dot(i.b, wd) / 4600.0 - t * .003, (i.b.x * wd.y - i.b.y * wd.x) / 1200.0) + ts * .006, 0.0), saturate(2.0 - fp * .15));
  let lc = mix(.16, abs(na.x - na.y), nf); // 거품 레이스: 0 = 실, 클수록 구멍
  for (var k = 0; k < 8; k++) {
    let R = u.rp[k]; let rv = i.b - R.xy; let x = length(rv) / max(R.z, .1);
    if (x < 2.0) { // 착탄 파문: 퍼지는 고리(법선 + 거품)와 안쪽 거품
      let e = exp(-pow((x - 1.0) * 4.0, 2.0)) * R.w;
      sl += rv * (e * sin((x - 1.0) * 9.0) * .9 / max(x * R.z, 1.0)); fo += e + .6 * R.w * max(1.0 - x, 0.0);
    }
    // 항적 (선체 좌표에서 해석적으로): s 선수로부터 뒤쪽 거리, l 중심선에서 옆 거리
    let W = u.wk[k * 2]; let P = u.wk[k * 2 + 1]; let p = i.b - W.xy; let hl = P.y * 1.3; let hb = P.y * .18;
    let s = hl - dot(p, W.zw); let lt = p.x * W.w - p.y * W.z; let l = abs(lt);
    if (P.x < .5 || s < 0.0 || l > hb * 4.0 + s * .5) { continue; }
    let am = min(P.x * .13, 1.0); let e = max(s - hl * 2.0, 0.0);
    let hw = hb * min(sqrt(s / hl), 1.0); let wh = hw + e * .05; // 선체 반폭 (선수는 뾰족) · 뒤로 갈수록 넓어지는 난류 띠 반폭
    // 켈빈 V: 19.5° 팔을 따라 깃털처럼 퍼지는 띠. 법선은 위상을 잡음으로 흩뜨린 발산파, 거품은 연속 잡음으로만 끊김 (주기 무늬 없음)
    let ar = exp(-pow((l - hb * .4 - s * .34) / (3.0 + s * .12), 2.0)) * am; let kk = 6.283 / (8.0 + P.x * 1.4);
    sl += (W.zw * .82 + vec2f(W.w, -W.z) * (sign(lt) * .57)) * (ar * exp(-s / (P.x * 35.0)) * saturate(2.0 - kk * fp) * .5 * cos(kk * (l * .57 - s * .82) + nb.z * 5.0));
    // 선미 난류 띠: 가장자리는 잡음으로 침식, 선미에서 가장 밝고 나이 들수록 넓고 옅게
    let tb = (1.0 - smoothstep(wh * .3, wh * 1.2, l + (nb.y - .5) * wh)) * step(hl * 1.5, s) * am;
    fo += ar * (.3 + 1.4 * nb.x) * (1.6 * exp(-s / (hl * 1.2)) + .12 * exp(-s / (hl * 4.0))) // 선수에서 밀려나는 거품
      + (1.0 - smoothstep(hw, hw + 2.0 + s * .07 * nb.w, l)) * saturate(1.0 - e / hb) * am // 현측 세류 (선미 뒤로는 난류 띠가 이어받음)
      + tb * (.2 + 1.2 * nb.w) * (exp(-e / (hl * .8)) + .5 * exp(-e / (hl * 3.0)));
    ae = max(ae, tb * exp(-e / (hl * 7.0)));
    // 선체가 하늘 반사를 가리는 어두운 얼룩: 거울 반사선(기울기로 흔들림)이 현측에 닿는 높이로 판정
    let ta = (l - hw) / max((vd.x * W.w - vd.z * W.z) * sign(lt), .03); let sh = s + dot(vd.xz, W.zw) * ta;
    oc = max(oc, (1.0 - smoothstep(P.y * .08, P.y * .3, (vd.y - 2.0 * dot(ts, vd.xz)) * ta)) * smoothstep(0.0, hb, sh) * smoothstep(hl * 2.0, hl * 2.0 - hb, sh) * exp(-max(l - hw, 0.0) / (hb * 2.0)));
  }
  sl += ts * (1.0 - .75 * ae); cd *= 1.0 - .75 * ae; // 항적 안쪽은 잔물결이 눌려 매끈
  let n = normalize(vec3f(-sl.x, max(1.0 - cr - cd, .3), -sl.y)); let nv = max(dot(n, vd), .03); let sg = sqrt(ro);
  let hz = smoothstep(100.0, 3000.0, d); // 먼 바다: 스치는 각에서 프레넬 → 1, 밝은 수평선 하늘을 반사
  let fr = .02 + .98 * pow(saturate(1.0 - nv), 5.0 * exp(-2.69 * sg)) / (1.0 + 22.7 * sg * sqrt(sg) * (1.0 - .85 * hz)); // 거친 수면 프레넬
  var r = reflect(-vd, n); r = normalize(vec3f(r.x, abs(r.y) + sg * .3 * (1.0 - hz), r.z));
  let cs = 1.0 - (.2 + .4 * g.fog.y) * smoothstep(.6, .35, lf); // 돌풍 무늬의 큰 명암
  let sw = ${q > 1 ? 'shadowAt(i.w, n)' : '1.0'} * cloudVis(i.w); // 함정 그림자 · 구름 그림자
  let amb = skyBase(vec3f(-L.x, .7, -L.z)); let sun = g.sunCol.rgb * (cs * sw); let nl = max(dot(n, L), 0.0);
  // 수체색: 내려다보면 남색, 비껴 보거나 마루에서는 청록 + 너울 명암 · 저주파 색 변화 + 태양 쪽 얇은 마루의 전방 산란
  let hh = saturate(cr * 1.6 + cd + i.w.y * .25 + .25);
  var body = mix(vec3f(.005, .031, .062), vec3f(.009, .066, .076), max((1.0 - nv) * saturate(L.y * 2.5), hh * .5)) * (amb * 1.4 + sun * (.1 + .8 * nl * nl)) * (.6 + .5 * lf + .4 * hh)
    + vec3f(.0, .2, .15) * sun * (pow(max(dot(vd, -L), 0.0), 3.0) + .1) * hh * (.08 + min(L.y, .25));
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
  let sp = exp((n2 - 1.0) / (n2 * ro)) / (ro * n2 * n2) * (.02 + .98 * pow(1.0 - vh, 5.0)) * .02 / max(vh * vh, .1) * (1.0 - oc);
  // 반사: 하늘(선체에 가리면 어둡게, 그림자 속은 약하게) + 부드럽게 눌러 담은 태양 윤슬 (블룸으로 번짐)
  var col = mix(body * (1.0 - .4 * oc), mix(skyBase(r) * (.8 + .3 * lf), amb * .15, oc) * (.7 + .3 * sw), fr) + sun * sp / (1.0 + sp * ${q ? .1 : .7});
  // 거품: 중성 흰색(알베도 .85) × (태양 + 채도를 뺀 하늘빛) → 그늘에서도 물보다 파랗지 않고 해 질 녘엔 따뜻함
  let fc = (sun * (.25 + .5 * nl) + mix(amb, vec3f(dot(amb, vec3f(.4))), .7) * .9 + g.sunCol.rgb * .04) * .85;
  col = mix(col, fc * vec3f(.1, .3, .28), min(fo * .3 + ae * .5, .6)); // 기포 섞인 옥빛 물
  // 백파: 부서지는 마루 + 바람 따라 늘어지는 줄무늬. 발자국이 커지면 사라져 먼 바다에서 점으로 깜박이지 않음
  let wc = cd * .4 + sea * .45 - .17 + (lf - .5) * .5 + (nb.x - .5) * .5;
  fo += min(smoothstep(.32, .82, cr + wc) + smoothstep(.27, .82, ct + wc) * nb.y, .7) * saturate(1.5 - fp * .4);
  fo = saturate((fo - lc * 2.0) * (1.2 + 1.3 * nf)) * .9; // 레이스 침식: 짙은 곳은 흰 덩어리, 옅은 곳은 실 모양. 멀면 부드럽게
  col = mix(col, fc, fo) + pointLights(i.w, r) * (.02 + fr * .06 + fo * .15);
  return vec4f(fogAt(col, g.cam.xyz - v * (1.0 + d / 4000.0)), 1.0); // 먼 바다는 안개를 더 얹어 수평선에서 하늘과 이어지게
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
