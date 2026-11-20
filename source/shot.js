// 사용: node shot.js "<dev.html 쿼리 또는 전체 URL>" out.png [--frames 20] [--dt 0.0333] [--w 960] [--h 540] [--wait 1500] [--eval "JS식"] [--nowebgpu] [--click]
// 쿼리에 step 이 있으면 G.test.run(frames, dt) 로 결정적 스텝, 없으면 실시간 루프를 --wait(ms) 동안 돌린 뒤 캡처.
const DIR = require('path').basename(__dirname); // 이 폴더 이름 (서버 루트는 한 단계 위)
const { chromium } = require('playwright');
const a = process.argv.slice(2), opt = k => { const i = a.indexOf('--' + k); return i < 0 ? null : (a[i + 1] ?? ''); };
const has = k => a.includes('--' + k);
(async () => {
  let url = a[0] || ''; const out = a[1] && !a[1].startsWith('--') ? a[1] : null;
  const PORT = await require('./srv.js')(); // 내장 서버 (localhost:8765 로 적힌 URL 도 여기로 돌림)
  url = /^https?:/.test(url) ? url.replace('localhost:8765', 'localhost:' + PORT) : `http://localhost:${PORT}/${DIR}/dev.html?` + url.replace(/^\?/, '');
  const W = +(opt('w') || 960), H = +(opt('h') || 540);
  const b = await chromium.launch({ args: has('nowebgpu') ? [] : ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const logs = [];
  p.on('console', m => { if (m.type() !== 'log' || has('logs')) logs.push(`[${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message)));
  const t0 = Date.now();
  await p.goto(url);
  await p.waitForFunction(() => window.G && (G.ready || G.dead), null, { timeout: 120000 }).catch(() => logs.push('[shot] ready 타임아웃'));
  if (has('click')) { await p.mouse.click(W / 2, H / 2); await p.waitForTimeout(200); }
  const step = /[?&]step\b/.test(url), frames = +(opt('frames') || 20), dt = +(opt('dt') || 1 / 30);
  let ms = 0;
  if (step) { const t1 = Date.now(); await p.evaluate(([n, d]) => G.dead ? 0 : G.test.run(n, d), [frames, dt]).catch(e => logs.push('[shot] run 실패: ' + e.message)); ms = (Date.now() - t1) / frames; }
  else await p.waitForTimeout(+(opt('wait') || 1500));
  const ev = opt('eval'); let evr;
  if (ev) evr = await p.evaluate(ev).catch(e => 'EVAL ERR ' + e.message);
  if (step && ev) await p.evaluate(() => G.dead ? 0 : G.test.run(1, 1e-4)).catch(e => logs.push('[shot] ' + e.message));
  if (out) await p.screenshot({ path: out });
  const info = await p.evaluate(() => window.G ? ({ dead: !!G.dead, q: G.Q && G.Q.name, manual: G.qManual, gpu: G.gpuInfo, fps: +G.fps.toFixed(1), frame: G.frame, time: +G.time.toFixed(2),
    target: G.targets && [G.targets.w, G.targets.h], errors: G.errors, fatal: document.getElementById('fatal')?.innerText.slice(0, 200) }) : 'no G');
  console.log(JSON.stringify(info, null, 1));
  if (step) console.log(`step: ${frames} frames, ${ms.toFixed(1)} ms/frame (SwiftShader CPU 렌더)`);
  if (ev) console.log('eval →', typeof evr === 'string' ? evr : JSON.stringify(evr));
  console.log(logs.length ? logs.join('\n') : '(콘솔 경고/오류 없음)');
  console.log(`총 ${Date.now() - t0} ms` + (out ? ` → ${out}` : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
