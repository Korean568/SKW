'use strict';
{ /* ═══ GPU — 이름 판별(성능표) + 10프레임 벤치마크 → 10단계 등급 (Very Low … Ultra) · 우측 상단 그래픽 알약 ═══ */
  const TIERS = G.TIER_NAMES; // ['Very Low', 'Low', 'Medium Low', 'Medium', 'Medium High', 'Medium Super', 'High', 'Super', 'Max', 'Ultra']
  const LEGACY = ['LOW', 'MEDIUM', 'HIGH']; // 예전 3단계 이름 (gpuInfo.nameTier / benchTier 는 이 굵은 이름을 유지: 휴대폰 모듈 호환)
  /* 상대 성능 = 3DMark Time Spy Graphics 점수 ÷ 1000 (리뷰 · UL · Notebookcheck 자료의 대표값, 근사).
     등급 경계 = 기준 카드 9종을 실제 성능순으로 정렬한 값: GTX 1080 7.5 < RTX 5050 10.3 < RTX 2080 11.0 < RTX 5060 13.1 < RTX 3090 21.0
     < RTX 5070 22.5 < RTX 5080 32.7 < RTX 4090 35.7 < RTX 5090 46.0 — 점수가 경계 이상이면 그 등급 (예: 2080 = Medium) */
  const BOUNDS = [['GTX 1080', 7.5], ['RTX 5050', 10.3], ['RTX 2080', 11], ['RTX 5060', 13.1], ['RTX 3090', 21], ['RTX 5070', 22.5], ['RTX 5080', 32.7], ['RTX 4090', 35.7], ['RTX 5090', 46]];
  const tierOfScore = x => x < 0 ? -1 : 1 + BOUNDS.filter(b => x >= b[1]).length;
  const tab = t => Object.fromEntries(t.split(',').map(e => e.trim().split(' ')).map(([k, v]) => [k, +v]));
  const NV = tab(`950 2.3,960 2.6,970 3.6,980 4.4,980ti 5.6,1030 1,1050 1.8,1050ti 2.3,1060 4,1070 5.9,1070ti 6.7,1080 7.5,1080ti 9.8,
    1630 1.9,1650 3.6,1650super 5,1660 5.4,1660super 6.1,1660ti 6.2,2060 7.6,2060super 9,2070 9.2,2070super 10.3,2080 11,2080super 11.7,2080ti 14,
    3050 6.2,3060 8.7,3060ti 11.7,3070 13.5,3070ti 14.5,3080 17.5,3080ti 19.6,3090 21,3090ti 22,4060 10.6,4060ti 13.5,4070 17.8,4070super 20.5,
    4070ti 22.7,4070tisuper 24.5,4080 28,4080super 28.6,4090 35.7,5050 10.3,5060 13.1,5060ti 15,5070 22.5,5070ti 27.5,5080 32.7,5090 46,
    a2000 7,a4000 11,a4500 13,a5000 15.5,a6000 20,2000ada 9.5,4000ada 15.5,4500ada 19,5000ada 26,6000ada 36,pro4000 22,pro4500 28,pro5000 35,pro6000 48`);
  const NVL = tab(`960 1.6,965 1.9,970 2.6,980 3.4,1050 1.6,1050ti 2.1,1060 3.7,1070 5.4,1080 6.8,1650 3.3,1650ti 3.6,1660ti 5.4,2050 3.4,2060 6.3,
    2070 7.8,2070super 8.2,2080 9.2,2080super 9.8,3050 4.9,3050ti 5.3,3060 8.4,3070 10.2,3070ti 11,3080 11.5,3080ti 12.8,4050 8.5,4060 10.4,4070 11.8,
    4080 17.5,4090 20.5,5050 9.2,5060 11,5070 12.5,5070ti 15.5,5080 19.5,5090 22.5`); // 노트북 (Laptop GPU · 전력 한도 대표값; Max-Q ×0.85)
  const AMD = tab(`470 3.8,480 4.2,570 3.9,580 4.4,590 4.9,5500xt 4.5,5600xt 7.3,5700 8.2,5700xt 9.1,6400 3.6,6500xt 4.5,6600 8.6,6600xt 9.6,6650xt 10,
    6700 10.8,6700xt 11.9,6750xt 12.6,6800 15.8,6800xt 18.5,6900xt 20.2,6950xt 21.5,7600 10.8,7600xt 11.2,7700 15.5,7700xt 17,7800xt 19.5,7900gre 21.5,
    7900xt 26.5,7900xtx 30.5,9060xt 15,9070gre 21.5,9070 25,9070xt 29.5`);
  const AMDM = tab(`5500m 3.8,5600m 6.3,5700m 7.2,6500m 3.6,6550m 4,6600m 8.5,6650m 8.8,6700m 9.4,6800m 11.5,6850mxt 12,6600s 7,6700s 7.5,6800s 8.5,
    7600m 8.6,7600mxt 9.6,7600s 8,7700s 9,7800m 13,7900m 18`); // 노트북 Radeon RX …M/S
  const AMDI = tab(`610m .7,660m 1.6,680m 2.4,740m 1.5,760m 2.3,780m 2.8,880m 3.2,890m 3.6,8040s 6,8050s 7.5,8060s 10`); // 내장 Radeon (Ryzen AI Max 8060S 포함)
  const ARC = tab(`a310 2.9,a380 4.3,a580 9.3,a750 11.5,a770 13.5,b570 12.5,b580 14.5,a350m 2.6,a370m 3.6,a550m 5.5,a570m 6.5,a730m 7.5,a770m 9.5,
    130v 3.5,140v 4.2,130t 3.3,140t 4,b370 5.5,b390 6.5`); // Intel Arc 외장 · 노트북 · 내장(Lunar/Arrow/Panther Lake)
  const APPLE = tab(`m1 2.6,m1pro 5.2,m1max 9,m1ultra 14,m2 3.3,m2pro 6,m2max 10.5,m2ultra 17,m3 3.8,m3pro 6.5,m3max 13,m3ultra 21,m4 4.2,m4pro 8,m4max 15,m5 5.5`);
  // 이름 → 상대 성능 점수 (모르면 -1 → 벤치마크로 결정)
  const score = n => {
    const s = ' ' + n.toLowerCase().replace(/\(r\)|\(tm\)|[®™]/g, '').replace(/\s+/g, ' ') + ' '; let m;
    if (/swiftshader|llvmpipe|softpipe|software|basic render|warp/.test(s)) return 0;
    const lap = /laptop|mobile|max-q|notebook/.test(s), mq = /max-q/.test(s) ? .85 : 1;
    if (/apple\s*a\d|adreno|mali|immortalis|powervr|xclipse|maleoon|videocore|tegra|imagination|img-tec|\barm\b|valhall|bifrost|midgard/.test(s)) return 1; // 휴대폰 · 태블릿 (Snapdragon X 노트북 포함; Android Chrome 의 Mali 는 이름 대신 'arm valhall') → Very Low
    if ((m = s.match(/rtx\s*pro\s*(\d{4})/)) && NV['pro' + m[1]]) return NV['pro' + m[1]];
    if ((m = s.match(/rtx\s*a(\d{4})/)) && NV['a' + m[1]]) return NV['a' + m[1]];
    if ((m = s.match(/rtx\s*(\d{4})\s*ada/)) && NV[m[1] + 'ada']) return NV[m[1] + 'ada'];
    if (/quadro|titan/.test(s)) return -1;
    if ((m = s.match(/\b(rtx|gtx|gt)\s*(\d{3,4})(m)?\s*(ti\s*super|ti|super)?/))) { // GeForce
      const k = m[2] + (m[4] || '').replace(/\s/g, ''), l = lap || !!m[3], old = m[1] === 'gt' || (m[1] === 'gtx' && +m[2] < 950) ? 1 : -1;
      if (l) return NVL[k] ? NVL[k] * mq : NV[k] ? NV[k] * .7 * mq : old;
      return NV[k] || old;
    }
    if (/\bmx\s*\d{3}|geforce\s*\d{3}m?\b/.test(s)) return 1; // MX · 옛 GeForce 저가형
    if ((m = s.match(/\brx\s*(\d{3,4})(?:\s*(m|s)\b|(?=\D|$))\s*(xtx|xt|gre)?/))) { // Radeon RX
      const k = m[1] + (m[2] || '') + (m[3] || '');
      if (m[2] || lap) return AMDM[k] || (AMD[m[1] + (m[3] || '')] || -1) * .75;
      return AMD[k] || -1;
    }
    if (/radeon\s*vii/.test(s)) return 8.7;
    if ((m = s.match(/vega\s*(56|64)/))) return m[1] === '56' ? 6.3 : 7.2;
    if ((m = s.match(/radeon\s*(\d{3,4}[ms])\b/))) return AMDI[m[1]] || 2;
    if (/radeon|vega|ati\b/.test(s)) return /pro\s*w\d|radeon pro/.test(s) ? -1 : 1.5; // 'AMD Radeon Graphics' = 내장
    if ((m = s.match(/\barc\s*(?:pro\s*)?([ab]\d{3}m?|\d{3}[vt])\b/))) return ARC[m[1]] || -1;
    if (/\barc\b/.test(s)) return 3.3; // Meteor Lake 'Intel Arc Graphics'
    if (/iris\s*xe/.test(s)) return 1.6;
    if (/intel|iris|uhd|hd graphics/.test(s)) return .8; // Intel 내장
    if ((m = s.match(/apple\s*(m\d)\s*(pro|max|ultra)?/))) return APPLE[m[1] + (m[2] || '')] || -1;
    return -1; // 'nvidia' · 'amd' 처럼 이름만 있는 경우 포함 → 벤치마크
  };
  const classify = n => tierOfScore(score(n)); // 이름 → 등급 1..10 (모르면 -1)
  // WebGL 로 실제 제품명 확보. Firefox 는 실제 이름 대신 세대별 대표 이름 + ', or similar' 를 줌 (RTX 4090 도 'GeForce GTX 980, or similar') → glSim = 1: 이름으로 판별하지 않음
  let glSim = 0;
  const glName = () => {
    try {
      const gl = document.createElement('canvas').getContext('webgl'), x = gl.getExtension('WEBGL_debug_renderer_info');
      let r = gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '';
      const lc = gl.getExtension('WEBGL_lose_context'); lc && lc.loseContext(); // 이름만 읽고 바로 반납
      glSim = /,?\s*or similar\s*$/i.test(r) ? 1 : 0; r = r.replace(/,?\s*or similar\s*$/i, '');
      const m = r.match(/^ANGLE \((?:[^,]+, )?(.+?)(?:,[^,]*)?\)$/); if (m) r = m[1];
      return r.replace(/^ANGLE Metal Renderer: /, '').replace(/\s*\(0x[0-9a-f]+\)/i, '').replace(/\s*(Direct3D|OpenGL|vs_\d|ps_\d).*$/i, '').trim();
    } catch (e) { return ''; }
  };
  // 벤치마크: 1024² 프래그먼트 + 26만 원소 컴퓨트 = 1단위, 부하 보정 뒤 10프레임 측정
  async function bench(dev) {
    const m = dev.createShaderModule({ code: `
      @group(0) @binding(0) var<storage, read_write> d: array<vec4f>;
      @compute @workgroup_size(64) fn cs(@builtin(global_invocation_id) id: vec3u) {
        var p = d[id.x]; for (var i = 0; i < 24; i++) { p = vec4f(sin(p.yzx * 1.7 + p.w) * .5 + p.xyz * .5, p.w + .01); } d[id.x] = p; }
      @vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f { let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)); return vec4f(p * 2.0 - 1.0, 0.0, 1.0); }
      @fragment fn fs(@builtin(position) q: vec4f) -> @location(0) vec4f {
        var p = q.xy * .004; var a = 0.0;
        for (var i = 0; i < 40; i++) { p = vec2f(sin(p.y * 1.9 + a) + p.x * .6, cos(p.x * 1.7 - a) + p.y * .6); a += length(p) * .05; }
        return vec4f(a, p, 1.0); }` });
    const N = 262144, U = GPUBufferUsage;
    const sb = dev.createBuffer({ size: N * 16, usage: U.STORAGE | U.COPY_SRC }), rb = dev.createBuffer({ size: 16, usage: U.COPY_DST | U.MAP_READ });
    const tex = dev.createTexture({ size: [1024, 1024], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT }), view = tex.createView();
    const cp = await dev.createComputePipelineAsync({ layout: 'auto', compute: { module: m, entryPoint: 'cs' } });
    const rp = await dev.createRenderPipelineAsync({ layout: 'auto', vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] } });
    const bg = dev.createBindGroup({ layout: cp.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: sb } }] });
    const run = async s => { // s = 부하 배율 (<1 일부만, ≥1 반복)
      const e = dev.createCommandEncoder(), n = Math.max(1, Math.round(s)), f = Math.min(1, s);
      if (s > 0) {
        const c = e.beginComputePass(); c.setPipeline(cp); c.setBindGroup(0, bg); for (let i = 0; i < n; i++) c.dispatchWorkgroups(Math.ceil(N / 64 * f)); c.end();
        const p = e.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] });
        p.setPipeline(rp); p.setViewport(0, 0, 1024, Math.max(1, 1024 * f), 0, 1); for (let i = 0; i < n; i++) p.draw(3); p.end();
      }
      e.copyBufferToBuffer(sb, 0, rb, 0, 16);
      const t = performance.now(); dev.queue.submit([e.finish()]);
      await rb.mapAsync(GPUMapMode.READ); rb.unmap(); return performance.now() - t; // 매핑 완료 = GPU 작업 끝
    };
    const med = a => a.sort((x, y) => x - y)[a.length >> 1];
    await run(1 / 16);
    const floor = med([await run(0), await run(0), await run(0)]); // 제출·매핑 자체 지연
    const unit0 = Math.max(await run(1 / 16) - floor, .05) * 16;
    const scale = G.clamp(20 / unit0, 1 / 16, 12), frames = []; // 프레임당 ≈20ms 로 보정
    for (let i = 0; i < 10; i++) frames.push(await run(scale));
    const ms = Math.max(med([...frames]) - floor, .02) / (scale < 1 ? scale : Math.round(scale));
    sb.destroy(); rb.destroy(); tex.destroy();
    // 점수 환산: 예전 기준(0.9ms 미만 = RTX 4070 급 · 4ms 이상 = 내장 그래픽)에 맞춰 Time Spy/1000 ≈ 16 / ms (보정 자료가 적어 대략값 — 교차 확인용)
    const sc = 16 / ms;
    return { ms, frames, scale, floor, score: sc, tier: tierOfScore(sc) };
  }
  const store = v => { try { v === undefined || (v ? localStorage.setItem('skw_q', v) : localStorage.removeItem('skw_q')); return localStorage.getItem('skw_q'); } catch (e) { return null; } };
  let el, low = 0, acc = 0, win = 0, cool = 0, probe = 0;
  // FPS 방식 동적 해상도: tgt = 목표 FPS (60, 프레임 상한이 확인되면 그 값), last = 방금 낮춘 시험 {f: 그때 FPS, d: 그때 배율}, hold = 다시 낮추지 않을 초, tsBad = 타이머 이상 연속 횟수
  // nores = 낮춰 봐도 FPS 가 안 오르는데 26fps 미만 (상한이 아니라 해상도와 무관한 부하: 그림자 · 정점 · CPU) → 자동 모드면 등급을 내림
  // pa = 마지막 올려 보기 뒤 지난 초, pw = 상한 아래 올려 보기 간격 (올리자마자 다시 느려지면 두 배로: 4→8→…→64초, 해상도가 계속 오르내리지 않게)
  let tgt = 60, last = null, hold = 0, tsBad = 0, nores = 0, pa = 99, pw = 4;
  /* 다른 모듈 · UI 용 API (G.TIERS / G.TIER_NAMES / G.tierOf / G.setQuality / G.tierCap 은 core.js)
     G.gpu.TIERS 등급 이름 10개 · score(name) 상대 성능(Time Spy/1000, 모르면 -1) · classify(name) 등급 1..10 (-1) · tierOfScore(x) · BOUNDS [카드, 점수] 9개
     G.gpu.pick(q) 사용자 선택 ('' = 자동, 이름·번호·예전 이름) — 저장(localStorage skw_q)하고 적용 · auto = 자동 모드 여부 · tier 현재 등급 번호
     detected 감지 등급 번호 (자동 모드는 이보다 위로 올리지 않음) · fpsTarget 동적 해상도 목표 FPS */
  G.gpu = { classify, score, tierOfScore, TIERS, BOUNDS, LEGACY, get fpsTarget() { return tgt; },
    pick: q => G.mods.gpu.pick(q), get auto() { return !G.qManual; }, get tier() { return G.Q ? G.Q.tier : 0; }, get detected() { return G.gpuInfo ? G.gpuInfo.detN : 0; } };
  G.register('gpu', {
    async detect(adapter, dev) {
      const i = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
      const vendor = (i.vendor || '').toLowerCase(), arch = i.architecture || '', gl = glName();
      const same = !vendor || gl.toLowerCase().includes(vendor) || (vendor === 'amd' && /radeon|ati/i.test(gl)) || (vendor === 'google' && /swiftshader/i.test(gl));
      // Safari 는 vendor·architecture·device·description 이 모두 'apple' (Metal 장치 이름 첫 단어) → description 이 vendor 와 같으면 정보가 없는 것
      const desc = i.description && i.description.toLowerCase() !== vendor ? i.description : '';
      const name = desc || (same && gl) || [vendor, arch, i.device].filter(Boolean).join(' ') || gl || '알 수 없는 GPU';
      const soft = i.isFallbackAdapter || adapter.isFallbackAdapter || /swiftshader/.test(arch);
      let sc = soft ? 0 : score(name + ' ' + vendor + ' ' + arch);
      if (glSim && name === gl && sc > 1) sc = -1; // Firefox 의 대표 이름: 휴대폰 · 내장(1 이하)만 믿고 나머지는 벤치마크로
      // 이름으로 모르는 Apple GPU (Safari 는 'apple' 만 알려 줌): iPhone·iPad (터치 · WebKit) 는 Very Low 로 시작, Mac 은 벤치마크로 고르되 Medium 까지 (보수적으로)
      const apple = sc < 0 && (vendor === 'apple' || /^apple gpu$/i.test(gl) || (glSim && /^apple/i.test(gl))), mobile = apple && (G.os === 'ios' || navigator.maxTouchPoints > 1);
      if (mobile) sc = 1;
      const nameT = tierOfScore(sc);
      let b = { ms: 0, frames: [], score: 0, tier: 4 };
      try { b = await bench(dev); } catch (e) { G.err('벤치마크 실패: ' + e.message); }
      /* 이름을 알면 성능표 기준. 벤치마크가 이름보다 확실히 약하면 (점수 1/4 미만: 노트북 전력 한도 · 절전 · 소프트웨어 렌더링) 두 점수의 기하평균 등급으로 낮춰 시작.
         모르면 벤치마크 등급 (보정이 대략적이라 High 까지). 소프트웨어 렌더러는 항상 Very Low. */
      let t = nameT < 0 ? Math.min(b.tier, 7) : b.score > 0 && b.score * 4 < sc ? Math.min(nameT, tierOfScore(Math.sqrt(sc * b.score))) : nameT;
      if (apple && !mobile) t = Math.min(t, 4);
      if (soft) t = 1;
      t = G.clamp(t, 1, 10);
      const lg = k => k > 0 ? LEGACY[G.TIERS[k - 1].level] : '?';
      const info = { name: soft && !/swiftshader|software/i.test(name) ? name + ' (소프트웨어)' : name, vendor, arch, tier: TIERS[t - 1], tierN: t, detN: t,
        nameTier: lg(nameT), benchTier: lg(b.tier), nameTierN: nameT, benchTierN: b.tier, nameScore: +sc.toFixed(2), benchScore: +(b.score || 0).toFixed(2),
        benchMs: +b.ms.toFixed(3), benchFrames: b.frames.map(x => +x.toFixed(2)), benchScale: +(b.scale || 0).toFixed(3) };
      if (apple) info.apple = 1; if (mobile) info.mobile = 1;
      console.info('[SKW] GPU 감지', info);
      return info;
    },
    init() {
      // 알약(GPU 이름 · 등급 · FPS) → 누르면 상세 + 프리셋
      G.css(`#perf{position:absolute;right:12px;top:12px;max-width:300px;text-align:right;font:11px/1.6 ui-monospace,monospace;color:#9cd;pointer-events:auto}
#perf>*{display:inline-block;padding:2px 11px;background:#012b;border:1px solid #3577;border-radius:12px}#perf .d{display:none;margin-top:5px;padding:8px 10px;border-radius:8px;text-align:left;overflow-wrap:anywhere}#perf:hover .d,#perf.op .d{display:block}
#perf>div:first-child{white-space:nowrap}#perf i{display:inline-block;max-width:13em;margin-right:.7em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;font-style:normal;opacity:.75}@media(max-width:1100px){#perf i{display:none}}
#perf b{color:#fff}#perf .t0{color:#dde}#perf .t1{color:#8df}#perf .t2{color:#8f9}#perf .bt{display:grid;grid-template-columns:repeat(4,auto);gap:4px;margin-top:5px}
#perf button{font:inherit;margin:0;padding:1px 6px;color:#9cd;background:#123;border:1px solid #357;border-radius:4px;cursor:pointer}#perf button.on{color:#012;background:#8df;border-color:#8df}`);
      el = G.el('div', { id: 'perf' });
      const g = G.gpuInfo;
      const tn = k => k > 0 ? TIERS[k - 1] : '?';
      el.innerHTML = `<div title="그래픽 등급 · F2 순환"></div><div class="d"><b>${g.name}</b><div>이름 판별 ${tn(g.nameTierN)}${g.nameScore >= 0 ? ' (' + g.nameScore + ')' : ''} · 벤치마크 ${tn(g.benchTierN)} (${g.benchMs}ms)</div><div></div><div class="bt">`
        + ['자동', ...TIERS].map((t, k) => `<button data-q="${k ? t : ''}" title="${k ? k + ' · ' + t : '자동 감지'}">${k ? t.replace('Medium', 'Med') : t}</button>`).join('') + '</div></div>';
      el.onclick = e => { const q = e.target.dataset.q; q !== undefined ? this.pick(q) : el.classList.toggle('op'); };
      // F2: 자동 → Very Low → Low → … → Ultra → 자동
      addEventListener('keydown', e => { if (e.code === 'F2') { e.preventDefault(); this.pick(G.qManual ? TIERS[G.Q.tier] || '' : TIERS[0]); } });
      // 감지 등급 = detect 뒤 다른 모듈이 고친 값까지 반영 (휴대폰 모듈은 모바일·이름 모르는 기기를 gpuInfo.tier = 'LOW' 로 바꿈) → '자동' 을 눌러도 그보다 위로 가지 않음
      const d0 = G.tierOf(g.tier); if (d0) g.detN = g.tierN = d0.tier;
      const s = store(), sq = G.tierOf(s); if (!G.params.get('q') && sq) G.setQuality(sq.name, true); // 지난번 수동 선택 유지 (예전 LOW/MEDIUM/HIGH 저장값도)
    },
    pick(q) { // q = '' (자동: 감지 등급으로 돌아감) | 등급 이름 · 번호 · 예전 이름
      const p = q ? G.tierOf(q) : null; q = p ? p.name : '';
      store(q); low = 0; last = null; hold = 0; nores = 0; G.dyn = 1;
      if (!q) { G.gpuInfo.tier = TIERS[G.gpuInfo.detN - 1] || G.gpuInfo.tier; G.gpuInfo.auto = ''; }
      G.setQuality(q || G.gpuInfo.tier, !!q);
    },
    onQuality() { for (const b of el.querySelectorAll('button')) b.className = (G.qManual ? b.dataset.q === G.Q.name : !b.dataset.q) ? 'on' : ''; low = 0; },
    update(dt) {
      const vis = document.visibilityState === 'visible', f = +G.fps;
      // 동적 해상도: 1초마다 GPU 시간(없으면 FPS)으로 배율 0.5~1 조절 (?dyn=0 끔) · 자동 모드: 그래도 4초 넘게 목표의 47% (60fps 기준 28) 미만이면 한 단계 낮춤
      if ((win += dt) >= 1 && vis && !G.params.has('step') && G.params.get('dyn') !== '0') {
        win = 0; let k = 1; const g = G.gpuMs;
        tgt = f > tgt * 1.15 ? 60 : Math.min(60, Math.max(tgt, f)); // 상한(30fps 등)이 풀리면 (목표보다 15% 넘게 빠름) 다시 60 목표로 — 낮은 상한은 아래 시험이 다시 찾음
        if (tgt >= 55) pw = 4; pa++;
        if (g > 0) { // 타이머 값이 프레임 간격과 안 맞으면 (간격의 2.5배 초과 · 느린데 간격의 5% 미만) 5초 연속이면 버리고 FPS 방식으로
          const fi = 1000 / Math.max(f, 1);
          tsBad = g > fi * 2.5 + 2 || (f < 40 && g < Math.min(fi * .05, .5)) ? tsBad + 1 : 0; // (상한·CPU 병목인 빠른 GPU 는 1ms 안팎도 정상 → 0.5ms 미만만)
          if (tsBad >= 5) { tsBad = 0; G.tsOff && G.tsOff(`gpu ${g.toFixed(2)}ms @ ${f.toFixed(0)}fps`); }
        }
        if (cool > 0) cool--;
        else if (G.gpuMs > 0) { if (g > 13.6 || g < 9.8) k = G.clamp(Math.sqrt(11.7 / g), .75, 1.15); }
        else {
          // FPS 방식: 낮춘 뒤 FPS 가 8% 이상 오르지 않았으면 GPU 부하가 아니라 프레임 상한(Safari 저전력·iframe 30fps, 30Hz 화면 등)이나 CPU 병목
          // → 배율을 되돌리고 그 FPS 를 목표로 삼아 10초 쉼. 목표 근처면 상한 아래에서도 4초마다 배율을 올려 봄 (60fps 목표는 예전처럼 20초)
          const t = last; last = null;
          if (t && G.dyn < t.d && f < t.f * 1.08) { tgt = Math.max(t.f, f); hold = 10; G.dyn = t.d; G.resize(); cool = 2; nores = f < 26; }
          else if (hold > 0) hold--;
          else if (f < tgt * .87) { last = { f, d: G.dyn }; k = .9; if (pa < 6) pw = Math.min(pw * 2, 64); }
          else if (++probe > (tgt < 55 && f >= tgt * .95 ? pw : 20)) { probe = 0; k = 1.08; pa = 0; }
        }
        const d = G.clamp(G.dyn * k, .5, 1);
        if (Math.abs(d - G.dyn) > .03) { G.dyn = d; G.resize(); cool = 2; } else if (k < 1) last = null; // 더 못 낮추면 시험할 것도 없음
      }
      // 자동 모드 하향: 해상도를 다 낮춰도(또는 해상도와 무관하게) 4초 넘게 느리면 한 등급씩 내림 (자동으로 올리지는 않음 — 감지 등급이 상한)
      low = !G.qManual && G.Q.tier > 1 && vis && (G.dyn < .56 ? f < tgt * .47 : nores && f < 26) ? low + dt : 0;
      // 내린 뒤 목표 FPS 는 60 으로 되돌림: 해상도와 무관한 느림(nores)을 '상한' 으로 기억한 채면 (tgt = 그 FPS) 다시 시험하지 않아 한 단계만 내리고 멈춤. 진짜 상한(30 등)은 다음 시험이 다시 찾음
      if (low > 4) { low = 0; last = null; nores = 0; tgt = 60; G.dyn = 1; G.gpuInfo.tier = TIERS[G.Q.tier - 2]; G.gpuInfo.auto = '↓'; G.setQuality(G.gpuInfo.tier, false); }
      if ((acc += dt) < .25) return; acc = 0;
      const Q = G.Q, T = G.targets;
      el.firstChild.innerHTML = `<i>${G.gpuInfo.name}</i><b class="t${Q.level}">${Q.name}</b> · ${f.toFixed(0)} FPS`;
      el.lastChild.children[2].textContent = `${Q.tier}/10 · ${G.qManual ? '수동' : '자동' + (G.gpuInfo.auto || '')} · ${T.w}×${T.h}${G.dyn < .99 ? ' (' + (G.dyn * 100 | 0) + '%)' : ''}${Q.msaa > 1 ? ' · MSAA' + Q.msaa : ''}${G.gpuMs ? ' · GPU ' + G.gpuMs.toFixed(1) + 'ms' : ''}${tgt < 55 ? ' · ≤' + tgt.toFixed(0) + 'fps' : ''}`;
    }
  });
}
