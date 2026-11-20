'use strict';
/* ═════════ OCEAN — 방사형 수면 메시 · 거스트너 + 잡음/스펙트럼 타일 · 항적 · 거품 · 굴절 ═════════ */
{
  const O = { W: [], R: [], u: new Float32Array(96), pc: {} };
  G.ocean = {
    wake(x, z, yaw, sp, len) { O.W.length < 64 && O.W.push(x, z, Math.sin(yaw), Math.cos(yaw), sp, len, 0, 0); },
    ripple(x, z, size = 20) { O.R.length > 7 && O.R.shift(); O.R.push([x, z, size, 0]); }
  };
  // 바람에 정렬된 거스트너 40파를 512² 타일로 합성 → (기울기 xz, 높이, 야코비안)
  const CS = `@group(1) @binding(0) var o: texture_storage_2d<rgba16float, write>;
@compute @workgroup_size(8, 8) fn cs(@builtin(global_invocation_id) id: vec3u) {
  let n = f32(textureDimensions(o).x); let p0 = (vec2f(id.xy) + .5) / n; var p = p0; var s = p; var j = vec3f(0.0); var h = 0.0;
  for (var it = 0; it < 2; it++) { // 2회째는 역변위 좌표에서 평가 → 뾰족한 마루
    var X = vec2f(0.0); s = X; j = vec3f(0.0); h = 0.0;
    for (var i = 0.0; i < 13.0 * log(n / 24.0); i += 1.0) { // 밉마다 나이퀴스트 이하 파만 합성
      let a = hash21(vec2f(i, 7.3)) * 2.4 - 1.2; let c = cos(a); let e = sin(a);
      let m = round(vec2f(g.wind.x * c + g.wind.y * e, g.wind.y * c - g.wind.x * e) * 3.0 * pow(1.08, i)); // 정수 파수 = 타일링
      let k = length(m) * 6.2832; let D = m / length(m); let A = (.045 + .09 * g.fog.w) * pow(k, -1.15);
      let th = dot(m, p) * 6.2832 - sqrt(k) * g.cam.w * .35 + i * 2.4; let C = A * cos(th); let S = 1.2 * A * k * sin(th);
      X += D * C * 1.2; s += D * (k * C); h += A * sin(th); j += vec3f(D.x * D.x, D.y * D.y, D.x * D.y) * S;
    }
    p = p0 - X;
  }
  let J = (1.0 - j.x) * (1.0 - j.y) - j.z * j.z;
  textureStore(o, id.xy, vec4f(vec2f(s.x * (1.0 - j.y) + s.y * j.z, s.x * j.z + s.y * (1.0 - j.x)) / max(J, .3), h, J));
}`;
  // q 0 LOW · 1 MEDIUM · 2 HIGH, R 굴절, NS×NR 메시 분할, AN 비등방 필터 배수
  const FS = (q, R, NS, NR, AN) => `struct U { wk: array<vec4f, 16>, rp: array<vec4f, 8> };
@group(1) @binding(0) var<uniform> u: U;
@group(1) @binding(1) var tile: texture_2d<f32>;
@group(1) @binding(2) var scn: texture_2d<f32>;
@group(1) @binding(3) var dpt: texture_depth_2d;
@group(1) @binding(4) var smp: sampler;
struct V { @builtin(position) pos: vec4f, @location(0) w: vec3f, @location(1) b: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> V { // 카메라 중심 링: 가까이 조밀, 마지막 링은 수평선 너머
  let c = vi / 6u; let k = vi % 6u;
  let ij = vec2f(vec2u((c + ((50u >> k) & 1u)) % ${NS}u, c / ${NS}u + ((44u >> k) & 1u))) / vec2f(${NS}, ${NR});
  let a = ij.x * 6.2831853; let r = 800.0 * ij.y * ij.y / (1.00001 - ij.y); let b = g.cam.xz + vec2f(sin(a), cos(a)) * r;
  let d = gerstner(b, g.cam.w) * (1.0 - smoothstep(1500.0, 5000.0, r)); var w = vec3f(b.x + d.x, d.y, b.y + d.z);
${q > 1 ? `  w.y += textureSampleLevel(tile, smp, b / 46.71 + .37, 0.0).z * 46.71 * (1.0 - smoothstep(60.0, 220.0, r)); // 근거리 잔파 변위` : ''}
  return V(g.viewProj * vec4f(w, 1.0), w, b);
}
@fragment fn fs(i: V) -> @location(0) vec4f {
  let t = g.cam.w; let L = g.sun.xyz; let wd = g.wind.xy; let v = g.cam.xyz - i.w; let d = length(v); let vd = v / d;
  let fp = d * d * g.res.w / max(abs(v.y), 1.0); // 픽셀 발자국(m) → 디테일 LOD
  var sl = vec2f(0.0); var cr = 0.0; var cd = 0.0; var ro = .004; var fo = 0.0; var er = .5;
  for (var k = 0; k < 6; k++) { // 기본 6파 해석 법선 (함정이 타는 파와 동일)
    let a = g.waves[k * 2]; let c = g.waves[k * 2 + 1]; let th = a.w * dot(a.xy, i.b) - c.x * t + c.z;
    let f = clamp(2.0 - a.w * fp, 0.0, 1.0); let m = a.w * a.z * f;
    sl += a.xy * (m * cos(th)); cr += c.y * m * sin(th); ro += .002 - f * .002;
  }
  for (var k = 0; k < ${[2, 4, 3][q]}; k++) { // 스펙트럼 타일 다중 스케일 (LOW·MEDIUM 은 구운 타일을 바람 따라 흘림)
    let e = f32(k); let sz = ${[131, 173, 173][q]}.0 * pow(${[.28, .35, .27][q]}, e);
    let lod = log2(max(fp / ${AN}.0, d * g.res.w) * 512.0 / sz); let f = clamp(5.0 - lod, 0.0, 1.0); // 밉 4 너머는 페이드
    let s = textureSample(tile, smp, (i.b - (wd + vec2f(wd.y, -wd.x) * sin(e * 2.4) * .4) * (t * sqrt(sz) * ${q > 1 ? 0 : .5})) / sz + e * .37);
    sl += s.xy * f; cd += (.5 - s.w * .5) * f; ro += .005 * clamp(lod, 0.0, 4.0); er -= s.z * f * (3.0 + e * 16.0);
  }
  for (var k = 0; k < 8; k++) { // 착탄 파문 고리 · 항적(선체 좌표에서 해석적으로): 켈빈 V 파 + 선미 난류 띠
    let R = u.rp[k]; let x = length(i.b - R.xy) / max(R.z, .1); fo += R.w * (exp(-pow((x - 1.0) * 4.0, 2.0)) + .6 * max(1.0 - x, 0.0));
    let W = u.wk[k * 2]; let P = u.wk[k * 2 + 1]; let p = i.b - W.xy;
    let s = P.y - dot(p, W.zw); let lt = p.x * W.w - p.y * W.z; let l = abs(lt); let hb = P.y * .14;
    if (P.x < .5 || s < 0.0 || l > hb * 2.0 + s * .5) { continue; }
    let e = max(s - P.y * 2.0, 0.0); let lw = P.x * 16.0; let am = min(P.x * .1, 1.0);
    let ar = exp(-pow((l - s * .34) / (1.5 + s * .06), 2.0)) * am; let ph = (l * .82 - s * .57) * .3;
    sl += (W.zw * .57 + vec2f(W.w, -W.z) * sign(lt) * .82) * (pow(ar, .08) * exp(-s / lw) * .5 * cos(ph) * clamp(2.0 - fp * .3, 0.0, 1.0));
    fo += ar * exp(-s / (P.y * 1.5 + lw * .2)) * 2.0 + (1.0 - smoothstep(hb * .3, hb * 1.5 + e * .06, l)) * (.7 + exp(-e / lw * 3.0)) * exp(-e / lw * .25) * am;
  }
  let n = normalize(vec3f(-sl.x, max(1.0 - cr - cd, .3), -sl.y)); let nv = max(dot(n, vd), .03); let sg = sqrt(ro);
  let fr = .02 + .98 * pow(1.0 - nv, 5.0 * exp(-2.69 * sg)) / (1.0 + 22.7 * sg * sqrt(sg)); // 거친 수면 프레넬
  var r = reflect(-vd, n); r = normalize(vec3f(r.x, abs(r.y) + sg * .3, r.z));
  let amb = skyBase(vec3f(-L.x, .7, -L.z)); let sun = g.sunCol.rgb * ${q > 1 ? 'shadowAt(i.w, n)' : '1.0'};
  var body = vec3f(.008, .045, .075) * (amb * 1.5 + sun * (.15 + .5 * max(dot(n, L), 0.0))) // 수체색 + 역광 마루 산란
    + vec3f(.0, .2, .16) * sun * pow(max(dot(vd, -L), 0.0), 3.0) * clamp(cr * 1.6 + cd + i.w.y * .25 + .25, 0.0, 1.0) * min(L.y, .3);
${R ? `  let zw = g.misc.x / i.pos.z; let pu = i.pos.xy * g.res.zw; // 굴절: 불투명 장면을 법선으로 왜곡, 물 두께로 흡수
  let t0 = g.misc.x / max(textureLoad(dpt, vec2i(i.pos.xy), 0), 1e-9) - zw;
  var uv = clamp(pu + n.xz * clamp(t0 * .3, 0.0, 1.0) * 2.0 / (zw + 20.0), vec2f(.001), vec2f(.999));
  var th = g.misc.x / max(textureLoad(dpt, vec2i(uv * g.res.xy), 0), 1e-9) - zw;
  if (th < 0.0) { uv = pu; th = t0; }
  th = max(th, 0.0); body = mix(body, textureSampleLevel(scn, linSamp, uv, 0.0).rgb, exp(-th * vec3f(.6, .25, .2)));
  fo += 1.0 - smoothstep(0.0, 1.6, th);` : ''}
  let hv = normalize(vd + L); let vh = dot(vd, hv); let nh = max(dot(n, hv), .01); let n2 = nh * nh;
  let sp = exp((n2 - 1.0) / (n2 * ro)) / (ro * n2 * n2) * (.02 + .98 * pow(1.0 - vh, 5.0)) * .02 / max(vh * vh, .1)
    * mix(1.0, pow(hash21(i.pos.xy + floor(t * 15.0)), 8.0) * 2.0, min(fp * 2.0, 1.0)); // 원거리 윤슬은 픽셀 난수로 반짝임
  var col = mix(body, skyBase(r), fr) + sun * min(sp, 20.0);
${q ? `  fo += smoothstep(.42, .62, cr + cd * .8 + g.fog.w * .3 - .1); // 백파` : ''}
  let fc = sun * (.2 + .35 * max(dot(n, L), 0.0)) + amb; col = mix(col, fc * vec3f(.3, .6, .6), min(fo * .4, .5)); // 기포 섞인 옥빛 물
  fo = clamp((fo - clamp(er, 0.0, 1.0) * .8) * 2.0, 0.0, 1.0);
  col = mix(col, fc, fo) + pointLights(i.w, r) * (.3 + fo);
  return vec4f(fogAt(col, i.w), 1.0);
}`;
  G.register('ocean', Object.assign(O, {
    init() {
      const d = G.dev, F = GPUShaderStage.FRAGMENT, FV = F | GPUShaderStage.VERTEX, T = GPUTextureUsage;
      O.ub = d.createBuffer({ size: 384, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      O.bgl = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: F, buffer: {} }, { binding: 1, visibility: FV, texture: {} },
        { binding: 2, visibility: F, texture: {} }, { binding: 3, visibility: F, texture: { sampleType: 'depth' } }, { binding: 4, visibility: FV, sampler: {} }] });
      const l = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: G.HDR } }] });
      const tx = d.createTexture({ size: [512, 512], mipLevelCount: 5, format: G.HDR, usage: T.STORAGE_BINDING | T.TEXTURE_BINDING });
      O.tv = tx.createView(); O.cp = d.createComputePipeline({ layout: G.layout(l), compute: { module: G.shader(CS, 'ocean-tile'), entryPoint: 'cs' } });
      O.cbg = [0, 1, 2, 3, 4].map(m => d.createBindGroup({ layout: l, entries: [{ binding: 0, resource: tx.createView({ baseMipLevel: m, mipLevelCount: 1 }) }] }));
    },
    onQuality(Q) {
      const d = G.dev, q = Q.ocean, R = q > 1 && Q.refract ? 1 : 0, key = q * 2 + R, NS = q ? 256 : 192, NR = q ? 256 : 160, AN = [1, 4, 8][q];
      if (!O.pc[key]) {
        const m = G.shader(FS(q, R, NS, NR, AN), 'ocean' + key);
        O.pc[key] = d.createRenderPipeline({ layout: G.layout(O.bgl), vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint: 'fs', targets: [{ format: G.HDR }] },
          depthStencil: { format: G.DEPTH, depthWriteEnabled: true, depthCompare: 'greater' } });
      }
      O.pipe = O.pc[key]; O.n = NS * NR * 6; O.hi = q > 1;
      O.smp = d.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: AN });
    },
    onResize() { // 굴절용 사본 뷰가 바뀌므로 다시 묶음
      const T = G.targets;
      O.bg = G.dev.createBindGroup({ layout: O.bgl, entries: [{ binding: 0, resource: { buffer: O.ub } }, { binding: 1, resource: O.tv },
        { binding: 2, resource: T.hdrCopyView }, { binding: 3, resource: T.depthCopyView }, { binding: 4, resource: O.smp }] });
    },
    update(dt) { for (const r of O.R) r[3] += dt; while (O.R.length && O.R[0][3] > 5) O.R.shift(); },
    prepare() {
      const u = O.u; for (let i = 0; i < 64; i++) u[i] = O.W[i] || 0;
      u.fill(0, 64); O.R.forEach((r, i) => { const a = r[3] / 5; u.set([r[0], r[1], r[2] * (.3 + a * 2), (1 - a) ** 2], 64 + i * 4); });
      G.dev.queue.writeBuffer(O.ub, 0, u); O.W.length = 0;
    },
    compute(enc) { // HIGH: 매 프레임 합성 · 그 외: 바람/해상 상태가 바뀔 때만 다시 구움
      const k = G.env.windDir + G.env.sea * 9; if (!O.hi && O.k === k) return; O.k = k;
      const p = enc.beginComputePass(); p.setPipeline(O.cp); p.setBindGroup(0, G.bg0); O.cbg.forEach((b, m) => { p.setBindGroup(1, b); p.dispatchWorkgroups(64 >> m, 64 >> m); }); p.end();
    },
    water(p) { p.setPipeline(O.pipe); p.setBindGroup(1, O.bg); p.draw(O.n); }
  }));
}
