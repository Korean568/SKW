// 빌드 검증 (스토리 게임): node verify.js [서버 루트(이 폴더의 한 단계 위) 기준 경로 — 먼저 npm run build:story 로 source/story.html 을 만들고 source/story.html 을 넘김]
// 등급 전환·리사이즈 · 처음부터 끝까지 진행(총격전은 자동 플레이) · 패배 경로 · 실시간 루프와 시작 버튼 · WebGPU 미지원 안내
const { chromium } = require('playwright');
const FLAGS = ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--autoplay-policy=no-user-gesture-required'];
const STEP = `const dt=.05;G.time+=dt;G.dt=dt;G.frame++;G.lights.length=0;for(const m of G.order)m.update&&m.update(dt);G.mods.people.prepare&&G.mods.people.prepare();`;
(async () => {
  const PORT = await require('./srv.js')(), U = `http://localhost:${PORT}/${process.argv[2] || 'index.html'}`;
  let bad = 0; const say = (ok, m) => { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + m); };
  const b = await chromium.launch({ args: FLAGS });
  const open = async (q, vp = { width: 960, height: 540 }) => { const p = await b.newPage({ viewport: vp }), logs = []; p.on('console', m => (m.type() === 'error' || m.type() === 'warning') && !/CONTEXT_LOST/.test(m.text()) && logs.push(m.text().slice(0, 200))); p.on('pageerror', e => logs.push('pageerror ' + e.message));
    await p.goto(U + (q || '?') + (/lang=/.test(q) ? '' : (q ? '&' : '') + 'lang=ko')); await p.waitForFunction(() => window.G && (G.ready || G.dead), null, { timeout: 180000 }); return [p, logs]; };
  { const [p, logs] = await open('?step&q=HIGH');
    const r = await p.evaluate(async () => { for (const q of ['HIGH', 'LOW', 'MEDIUM', 'HIGH']) { G.setQuality(q, 1); await G.test.run(2); } G.dyn = .7; G.resize(); await G.test.run(2); G.dyn = 1; G.resize(); await G.test.run(2); return G.errors; });
    say(!r.length && !logs.length, 'preset switch + resize: ' + JSON.stringify(r) + ' ' + JSON.stringify(logs)); await p.close(); }
  { const [p, logs] = await open('?step&q=LOW'); // 전체 진행 (로직만, 0.05초 단계)
    const r = await p.evaluate(`(()=>{const beats=[];let last='',i=0;G.story.start();for(;i<30000;i++){if(G.fps.on)G.fps.bot=true;${STEP}const b=G.story.S.beat;if(b!==last){beats.push(b+'@'+(i*.05|0));last=b}if(b==='end'&&!G.fps.on)break}return {beats,win:G.story.S.win,S:G.fps.S,errs:G.errors}})()`);
    say(r.win === true && r.S.kills === r.S.total && !r.errs.length && !logs.length, 'full story + bot fight: ' + JSON.stringify(r)); await p.close(); }
  { const [p, logs] = await open('?step&q=LOW'); // 가만히 있으면 전사 → '전사' 카드 (패배 엔딩 없음: 부활 · 처음 화면) → 부활하면 새 방탄판으로 계속
    const r = await p.evaluate(`(()=>{let i=0,card=false;G.story.start();G.story.go('fight');for(;i<12000&&!card;i++){G.fps.bot=false;${STEP}card=/전사/.test(document.body.innerText)}const t=i*.05|0,on=G.fps.on;G.fps.revive();${STEP}return {t,card,on,revived:!G.fps.S.dead&&G.fps.S.plate===100,cardAfter:/전사/.test(document.body.innerText),errs:G.errors}})()`);
    say(r.card && r.on && r.revived && !r.cardAfter && !r.errs.length && !logs.length, 'defeat path (death card + revive): ' + JSON.stringify(r)); await p.close(); }
  { let p, logs, lost = 0; // 실시간 루프 + 시작 버튼 (헤드리스 SwiftShader 는 가끔 첫 프레임에 장치를 잃음 → 재시도)
    for (let k = 0; k < 6; k++) { [p, logs] = await open('', { width: 1280, height: 720 }); let ok = 0;
      for (let i = 0; i < 25 && !ok; i++) { await p.waitForTimeout(1000); ok = await p.evaluate(() => window.G && G.ready && !G.dead && G.frame > 20).catch(() => 0); }
      if (ok) break; lost++; await p.close(); }
    const f0 = await p.evaluate(() => G.frame); await p.keyboard.press('Enter'); await p.waitForTimeout(6000);
    const s = await p.evaluate(() => ({ frame: G.frame, beat: G.story.S.beat, on: !!G.story.S.on, dead: !!G.dead, errs: G.errors }));
    say(s.frame > f0 && s.on && !s.dead && !s.errs.length, `realtime start (device-loss retries ${lost}): ` + JSON.stringify(s) + ' ' + JSON.stringify(logs.slice(0, 3))); await p.close(); }
  await b.close();
  { const b2 = await chromium.launch({ args: ['--disable-gpu', '--disable-features=WebGPU'] }), p = await b2.newPage(); await p.goto(U); await p.waitForTimeout(2000);
    const t = await p.evaluate(() => (document.getElementById('fatal') || {}).innerText || ''); say(/WebGPU/.test(t), 'unsupported message: ' + t.replace(/\s+/g, ' ').slice(0, 80)); await b2.close(); }
  console.log(bad ? `=== ${bad} FAILED ===` : '=== ALL PASS ==='); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
