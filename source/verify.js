// 통합 빌드 검증: node verify.js [서버 루트(한 단계 위 폴더) 기준 경로, 기본 index.html]  → 등급 전환·리사이즈, 시나리오 로직(적극/방치), 실시간 입력, WebGPU 미지원 안내
const { chromium } = require('playwright');
// 렌더 없이 게임 로직만 고속 시뮬레이션 (Space/F 누름 여부 선택) — G.game 훅 사용
const sim = (hold) => `(async()=>{
  const out=[]; G.keys.Space=${hold?1:0}; G.keys.KeyF=${hold?1:0}; const g=G.game; let end='timeout';
  for(let i=0;i<20*60*9;i++){ G.time+=.05; G.dt=.05; G.frame++; for(const m of G.order){ if(m.update) m.update(.05); } G.lights.length=0;
    if(i%600===0) out.push((i*.05|0)+'s hp='+(g.P.hp|0)+' sam='+g.P.sam+' ssm='+g.P.ssm+' gun='+g.P.gun+' kills='+g.S.kills+' step='+g.S.i+' E='+g.E.length);
    const ov=document.getElementById('ov'); if(ov && ov.style.display!=='none' && !ov.hidden && i>40){ end=(ov.querySelector('h1')||ov).textContent.slice(0,40)+' @'+(i*.05|0)+'s hp='+(g.P.hp|0)+' kills='+g.S.kills; break; } }
  out.push('END: '+end, 'errors: '+JSON.stringify(G.errors)); return out.join('\\n'); })()`;
const FLAGS = ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--autoplay-policy=no-user-gesture-required'];
(async () => {
  const PORT = await require('./srv.js')(), U = `http://localhost:${PORT}/${process.argv[2] || 'index.html'}`;
  let bad = 0; const say = (ok, m) => { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + m); };
  const b = await chromium.launch({ args: FLAGS });
  const open = async (q, vp = { width: 960, height: 540 }) => { const p = await b.newPage({ viewport: vp }), logs = []; p.on('console', m => (m.type() === 'error' || m.type() === 'warning') && logs.push(m.text().slice(0, 200))); p.on('pageerror', e => logs.push('pageerror ' + e.message));
    await p.goto(U + q); await p.waitForFunction(() => window.G && (G.ready || G.dead), null, { timeout: 180000 }); return [p, logs]; };
  { // 1. 등급 전환 + 리사이즈
    const [p, logs] = await open('?step&q=HIGH');
    const r = await p.evaluate(async () => { for (const q of ['HIGH', 'LOW', 'MEDIUM', 'HIGH', 'LOW']) { G.setQuality(q, 1); await G.test.run(3); } G.dyn = .7; G.resize(); await G.test.run(2); G.dyn = 1; G.resize(); await G.test.run(2); return G.errors; });
    say(!r.length && !logs.length, 'preset switch + resize: errors ' + JSON.stringify(r) + ' logs ' + JSON.stringify(logs)); await p.close(); }
  for (const q of ['LOW', 'MEDIUM', 'HIGH']) { // 2. 등급별 전투 장면 (발사·피격·폭발) 오류 검사
    const [p, logs] = await open('?step&nohud&q=' + q);
    const r = await p.evaluate(async () => { G.SCENARIO.steps = [['island', 'island0', 2600, 7800, .5], ['obj', 't']]; G.game.start(); const g = G.game;
      g.spawn('ssm', { n: 3, brg: 20, dist: 2500, spread: 20 }); g.spawn('jet', { n: 2, brg: -30, dist: 3000 }); g.spawn('boat', { n: 2, brg: 60, dist: 1500 }); g.spawn('frigate', { brg: 5, dist: 1600 }); G.keys.Space = 1; G.keys.KeyF = 1; G.dyn = .5; G.resize();
      for (let i = 0; i < 70; i++) G.tick(.1); const e = g.E.find(e => e.k === 'ship'); if (e) g.damage(e, 500, e.p); for (let i = 0; i < 20; i++) G.tick(.1); G.dyn = 1; G.resize(); await G.test.run(2, .033);
      return { errors: G.errors, alive: G.fx.alive | 0, E: g.E.length, hp: g.P.hp | 0, kills: g.S.kills }; });
    say(!r.errors.length && !logs.length, `combat ${q}: ${JSON.stringify(r)} logs ${JSON.stringify(logs)}`); await p.close(); }
  for (const hold of [1, 0]) { // 3. 시나리오 처음부터 끝까지 (렌더 없이 로직만)
    const [p] = await open('?step&q=LOW&autostart'); const r = await p.evaluate(sim(hold)); const end = r.split('\n').filter(l => /END|errors/.test(l)).join(' | ');
    say(/errors: \[\]/.test(r) && !/timeout/.test(end), `scenario ${hold ? 'active' : 'passive'}: ${end}`); await p.close(); }
  { // 4. 실시간 루프 + 실제 입력
    let p, logs, lost = 0; // 헤드리스 SwiftShader 는 실시간 첫 프레임에서 가끔 장치를 잃음(환경 문제) → 자동 새로고침 복구를 포함해 안정될 때까지 재시도
    for (let k = 0; k < 6; k++) { [p, logs] = await open('', { width: 1280, height: 720 }); let ok = 0;
      for (let i = 0; i < 25 && !ok; i++) { await p.waitForTimeout(1000); ok = await p.evaluate(() => window.G && G.ready && !G.dead && G.frame > 20).catch(() => 0); }
      if (ok) break; lost++; await p.close(); }
    console.log('     (startup device-loss retries: ' + lost + ')');
    const st = () => p.evaluate(() => ({ q: G.Q.name, hp: G.game.P.hp | 0, sam: G.game.P.sam, yaw: +G.game.P.yaw.toFixed(2), thr: +G.game.P.thr.toFixed(2), step: G.game.S.i, frame: G.frame, fatal: !!document.getElementById('fatal'), errs: G.errors.length }));
    const s0 = await st(); await p.click('#ov button'); await p.waitForTimeout(8000); const s1 = await st();
    await p.keyboard.down('Space'); await p.waitForTimeout(4000); await p.keyboard.up('Space'); const s2 = await st();
    await p.keyboard.down('KeyA'); await p.keyboard.down('KeyW'); await p.waitForTimeout(3000); await p.keyboard.up('KeyA'); await p.keyboard.up('KeyW'); const s3 = await st();
    await p.mouse.move(640, 300); await p.mouse.down(); await p.mouse.move(760, 260, { steps: 5 }); await p.mouse.up(); await p.mouse.wheel(0, 300);
    for (const k of ['Tab', 'KeyQ', 'KeyH', 'KeyH', 'KeyM', 'KeyP']) await p.keyboard.press(k); await p.waitForTimeout(300); await p.keyboard.press('KeyP');
    await p.hover('#perf'); await p.waitForTimeout(300); const qs = [];
    for (const q of ['HIGH', 'MEDIUM', '']) { const sel = `#perf button[data-q="${q}"]`; if (await p.$(sel)) { await p.click(sel); await p.waitForTimeout(900); qs.push((await st()).q); } else qs.push('no button ' + q); }
    await p.keyboard.press('F2'); await p.waitForTimeout(500); await p.setViewportSize({ width: 900, height: 600 }); await p.waitForTimeout(900); const s4 = await st(), errs = await p.evaluate(() => G.errors);
    say(!s0.fatal && s1.step > 0 && s2.sam < s1.sam && s3.thr > s1.thr && s3.yaw !== s1.yaw && qs[0] === 'HIGH' && qs[1] === 'MEDIUM' && s4.frame > s1.frame && !errs.length && !s4.fatal,
      `realtime input: start step ${s1.step}, SAM ${s1.sam}→${s2.sam}, thr ${s1.thr}→${s3.thr}, yaw ${s1.yaw}→${s3.yaw}, presets ${qs}, frames ${s4.frame}, errors ${JSON.stringify(errs)} logs ${JSON.stringify(logs.slice(0, 4))}`); await p.close(); }
  await b.close();
  { // 5. WebGPU 미지원 브라우저 안내
    const b2 = await chromium.launch({ args: ['--disable-gpu', '--disable-features=WebGPU'] }), p = await b2.newPage(); await p.goto(U); await p.waitForTimeout(1500);
    const t = await p.evaluate(() => (document.getElementById('fatal') || {}).innerText || ''); say(/WebGPU/.test(t), 'unsupported message: ' + t.replace(/\s+/g, ' ').slice(0, 90)); await b2.close(); }
  console.log(bad ? `=== ${bad} FAILED ===` : '=== ALL PASS ==='); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
