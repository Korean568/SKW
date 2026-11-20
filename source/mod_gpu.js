'use strict';
{ /* ═════════ GPU — 이름 판별 + 10프레임 벤치마크 → LOW / MEDIUM / HIGH · 우측 상단 성능 HUD ═════════ */
  const TIERS = ['LOW', 'MEDIUM', 'HIGH'];
  // 이름으로 등급 추정: 0 내장·소프트웨어 / 1 일반 외장 / 2 고성능 외장(RTX 4070·5070 이상급) / -1 모름
  const classify = n => {
    const s = ' ' + n.toLowerCase().replace(/\(r\)|\(tm\)|[®™]/g, '') + ' '; let m;
    if (/swiftshader|llvmpipe|softpipe|software|basic render|warp/.test(s)) return 0;
    const lap = /laptop|mobile|max-q|notebook|\d{3,4}m\b/.test(s);
    if ((m = s.match(/rtx\s*a?(\d{4})(\s*ada)?/))) {                     // RTX 2060…5090 / 워크스테이션 RTX A·Ada
      const num = +m[1], cls = num % 100 - (lap ? 10 : 0), gen = Math.floor(num / 100);
      if (!(num % 100)) return num >= (m[2] ? 4000 : 5000) ? 2 : 1;
      return gen >= 40 ? (cls >= 70 ? 2 : 1) : gen >= 30 ? (cls >= 80 ? 2 : 1) : 1;
    }
    if ((m = s.match(/gtx\s*(\d{3,4})/))) return +m[1] >= 1000 || +m[1] % 100 >= 60 ? 1 : 0;
    if (/\bgt\s*\d{3,4}|\bmx\s*\d{3}|geforce\s*\d{3}m/.test(s)) return 0;
    if ((m = s.match(/\brx\s*(\d{3,4})/))) {                              // Radeon RX
      const num = +m[1], g = Math.floor(num / 1000), hi = g === 9 ? num % 100 >= 70 : g >= 6 && num % 1000 >= 800;
      return num < 1000 ? (num % 100 >= 70 ? 1 : 0) : hi && !lap ? 2 : 1;
    }
    if (/radeon\s*(graphics|vega|r\d|hd|\d{3}m)|vega\s*\d/.test(s)) return 0; // AMD 내장
    if ((m = s.match(/arc\s*[ab](\d{3})/))) return +m[1] >= 380 ? 1 : 0;      // Intel Arc 외장
    if (/intel|iris|uhd|hd graphics/.test(s)) return 0;                      // Intel 내장 (Iris Xe, UHD, Arc 내장)
    if ((m = s.match(/apple\s*m\d\s*(pro|max|ultra)?/))) return !m[1] ? 0 : m[1] === 'pro' ? 1 : 2;
    if (/apple\s*a\d|adreno|mali|powervr|videocore|tegra/.test(s)) return 0; // 모바일
    if (/nvidia|geforce|quadro|radeon|amd/.test(s)) return 1;
    return -1;
  };
  // WebGL 의 UNMASKED_RENDERER 로 실제 제품명 확보 (WebGPU 는 개인정보 보호로 이름을 비워 두는 경우가 많음)
  const glName = () => {
    try {
      const gl = document.createElement('canvas').getContext('webgl'), x = gl.getExtension('WEBGL_debug_renderer_info');
      let r = gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '';
      const m = r.match(/^ANGLE \((?:[^,]+, )?(.+?)(?:,[^,]*)?\)$/); if (m) r = m[1];
      return r.replace(/^ANGLE Metal Renderer: /, '').replace(/\s*\(0x[0-9a-f]+\)/i, '').replace(/\s*(Direct3D|OpenGL|vs_\d|ps_\d).*$/i, '').replace(/, or similar$/, '').trim();
    } catch (e) { return ''; }
  };
  // 벤치마크: 1024² 무거운 프래그먼트 + 26만 원소 컴퓨트를 한 "단위"로, 부하를 보정한 뒤 10프레임의 GPU 처리 시간을 측정
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
    const run = async s => { // s = 부하 배율 (1 미만이면 화면·원소 일부만, 1 이상이면 반복)
      const e = dev.createCommandEncoder(), n = Math.max(1, Math.round(s)), f = Math.min(1, s);
      if (s > 0) {
        const c = e.beginComputePass(); c.setPipeline(cp); c.setBindGroup(0, bg); for (let i = 0; i < n; i++) c.dispatchWorkgroups(Math.ceil(N / 64 * f)); c.end();
        const p = e.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] });
        p.setPipeline(rp); p.setViewport(0, 0, 1024, Math.max(1, 1024 * f), 0, 1); for (let i = 0; i < n; i++) p.draw(3); p.end();
      }
      e.copyBufferToBuffer(sb, 0, rb, 0, 16);
      const t = performance.now(); dev.queue.submit([e.finish()]);
      await rb.mapAsync(GPUMapMode.READ); rb.unmap(); return performance.now() - t; // 읽기 매핑 완료 = GPU 작업 종료
    };
    const med = a => a.sort((x, y) => x - y)[a.length >> 1];
    await run(1 / 16);                                                           // 워밍업
    const floor = med([await run(0), await run(0), await run(0)]);                // 제출·매핑 자체 지연
    const unit0 = Math.max(await run(1 / 16) - floor, .05) * 16;                  // 1단위 예상 시간
    const scale = G.clamp(20 / unit0, 1 / 16, 12), frames = [];                   // 프레임당 ≈20ms 가 되게 보정
    for (let i = 0; i < 10; i++) frames.push(await run(scale));                   // ── 10프레임 측정 ──
    const ms = Math.max(med([...frames]) - floor, .02) / (scale < 1 ? scale : Math.round(scale));
    sb.destroy(); rb.destroy(); tex.destroy();
    return { ms, frames, scale, floor, tier: ms < .9 ? 2 : ms < 4 ? 1 : 0 };      // 단위당 ms → 등급
  }
  const store = v => { try { v === undefined || (v ? localStorage.setItem('skw_q', v) : localStorage.removeItem('skw_q')); return localStorage.getItem('skw_q'); } catch (e) { return null; } };
  let el, low = 0, acc = 0;
  G.gpu = { classify, TIERS };
  G.register('gpu', {
    async detect(adapter, dev) {
      const i = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
      const vendor = (i.vendor || '').toLowerCase(), arch = i.architecture || '', gl = glName();
      const same = !vendor || gl.toLowerCase().includes(vendor) || (vendor === 'amd' && /radeon|ati/i.test(gl)) || (vendor === 'google' && /swiftshader/i.test(gl));
      const name = i.description || (same && gl) || [vendor, arch, i.device].filter(Boolean).join(' ') || gl || '알 수 없는 GPU';
      const soft = i.isFallbackAdapter || adapter.isFallbackAdapter || /swiftshader/.test(arch);
      const nameTier = soft ? 0 : classify(name + ' ' + vendor + ' ' + arch);
      let b = { ms: 0, frames: [], tier: 1 };
      try { b = await bench(dev); } catch (e) { G.err('벤치마크 실패: ' + e.message); }
      // 이름을 알면 이름이 기준(내장=LOW 고정), 벤치마크가 2단계 이상 낮게 나오면 한 단계 내림. 이름을 모르면 벤치마크로 결정.
      const t = nameTier < 0 ? b.tier : nameTier - b.tier >= 2 ? nameTier - 1 : nameTier;
      const info = { name: soft && !/swiftshader|software/i.test(name) ? name + ' (소프트웨어)' : name, vendor, arch, tier: TIERS[t], nameTier: TIERS[nameTier] || '?', benchTier: TIERS[b.tier], benchMs: +b.ms.toFixed(3), benchFrames: b.frames.map(x => +x.toFixed(2)), benchScale: +(b.scale || 0).toFixed(3) };
      console.info('[SKW] GPU 감지', info);
      return info;
    },
    init() {
      G.css(`#perf{position:absolute;right:12px;top:12px;min-width:210px;max-width:300px;padding:8px 10px;background:#06121cc4;border:1px solid #2c5c7a88;border-radius:6px;font:12px/1.55 ui-monospace,Consolas,monospace;color:#bfe6ff;pointer-events:auto}
#perf b{color:#fff}#perf .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#perf .t0{color:#ffb35c}#perf .t1{color:#7fd6ff}#perf .t2{color:#8dff9a}
#perf button{font:inherit;margin:4px 3px 0 0;padding:1px 7px;color:#9fc6dc;background:#0d2231;border:1px solid #2c5c7a;border-radius:4px;cursor:pointer}#perf button.on{color:#04121c;background:#7fd6ff;border-color:#7fd6ff}`);
      el = G.el('div', { id: 'perf' });
      const g = G.gpuInfo;
      el.innerHTML = `<div class="n" title="${g.name} · ${g.vendor} ${g.arch}\n이름 판별 ${g.nameTier} · 벤치마크 ${g.benchTier} (${g.benchMs} ms/단위)">GPU <b>${g.name}</b></div><div></div><div></div>`
        + ['자동', ...TIERS].map((t, k) => `<button data-q="${k ? t : ''}" title="${k ? t + ' 프리셋 고정' : '감지된 등급(' + g.tier + ') 사용'} · F2 순환">${t === 'MEDIUM' ? 'MED' : t}</button>`).join('');
      el.onclick = e => { const q = e.target.dataset && e.target.dataset.q; if (q !== undefined) this.pick(q); };
      addEventListener('keydown', e => { if (e.code === 'F2') { e.preventDefault(); this.pick(G.qManual ? TIERS[G.Q.level + 1] || '' : 'LOW'); } });
      const s = store(); if (!G.params.get('q') && G.PRESETS[s]) G.setQuality(s, true); // 지난번 수동 선택 유지
    },
    pick(q) { store(q || ''); low = 0; G.setQuality(q || G.gpuInfo.tier, !!q); },
    onQuality() { for (const b of el.querySelectorAll('button')) b.className = (G.qManual ? b.dataset.q === G.Q.name : !b.dataset.q) ? 'on' : ''; low = 0; },
    update(dt) {
      // 자동 모드에서 4초 넘게 28fps 미만이면 한 단계 낮춤 (탭이 보일 때만)
      low = !G.qManual && G.Q.level > 0 && G.fps < 28 && document.visibilityState === 'visible' ? low + dt : 0;
      if (low > 4) { low = 0; G.gpuInfo.tier = TIERS[G.Q.level - 1]; G.gpuInfo.auto = '↓'; G.setQuality(G.gpuInfo.tier, false); }
      if ((acc += dt) < .25) return; acc = 0;
      const Q = G.Q, T = G.targets, f = G.fps;
      el.children[1].innerHTML = `등급 <b class="t${Q.level}">${Q.name}</b> ${G.qManual ? '수동' : '자동' + (G.gpuInfo.auto || '')} · <b style="color:${f < 30 ? '#ff6b5c' : f < 50 ? '#ffd66b' : '#8dff9a'}">${f.toFixed(0)}</b> FPS ${(1000 / Math.max(f, 1)).toFixed(1)}ms`;
      el.children[2].textContent = `${T.w}×${T.h} · 파티클 ${G.fx && G.fx.alive | 0}/${Q.particles}`;
    }
  });
}
