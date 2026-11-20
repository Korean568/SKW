// 검증용 고정 장면 렌더러 (개발 전용): node poses.js <출력폴더> [--q HIGH,MEDIUM,LOW] [--only p1,p3] [--mods all|gpu,game] [--w 960 --h 540] [--url <빌드된 html>]
// 각 포즈: 준비 프레임은 낮은 해상도(G.dyn=.5)로 빠르게 돌리고 마지막 몇 프레임만 원래 해상도로 렌더 → <포즈>_<등급>.png
const DIR = require('path').basename(__dirname); // 이 폴더 이름 (서버 루트는 한 단계 위)
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i < 0 ? d : a[i + 1]; };
const out = a[0] || 'shots', W = +opt('w', 960), H = +opt('h', 540), mods = opt('mods', 'all'), base0 = opt('url', '');
const QS = opt('q', 'HIGH').split(','), only = opt('only', '') ? opt('only', '').split(',') : null;
const ALL = 'gpu,sky,post,ocean,mesh,models,fx,audio,game';
// 공통 준비: 시나리오를 비우고(섬만 배치) 바로 시작
const PRE = `G.SCENARIO.steps=[['island','island0',2600,7800,.5],['island','island1',-3400,4600,2],['obj','촬영 장면']];G.game.start();const g=G.game,cam=g.cam;`;
const POSES = {
  p1_hero: { env: { sunEl: 16, sunAz: 115, cloud: .4, haze: .3 }, js: `cam.az=2.25;cam.el=.11;cam.d=205;`, frames: 26 },
  p2_dusk: { env: { sunEl: 4.5, sunAz: 40, cloud: .5, haze: .5 }, js: `cam.az=3.84;cam.el=.055;cam.d=250;`, frames: 24 },
  p3_launch: { env: { sunEl: 22, sunAz: 70 }, js: `g.spawn('ssm',{n:4,brg:30,dist:4300,spread:22});G.keys.Space=1;cam.az=2.62;cam.el=.2;cam.d=300;`, frames: 36 },
  p4_ciws: { env: { sunEl: 20, sunAz: 200, cloud: .6 }, js: `g.spawn('ssm',{n:3,brg:-40,dist:1750,spread:14});cam.az=.6;cam.el=.14;cam.d=240;`, frames: 34,
    post: `const m=g.E.find(e=>e.k==='msl'&&e.side);if(m){g.kill(m)}` , tail: 4 },
  p5_burn: { env: { sunEl: 24, sunAz: 300, cloud: .35 }, js: `g.spawn('frigate',{brg:5,dist:1300});const e=g.E[g.E.length-1];window._e=e;`, frames: 6,
    post: `const e=window._e;g.damage(e,70,[e.p[0],12,e.p[2]+10]);g.boom([e.p[0]+60,0,e.p[2]-40],'splash',1.2);cam.free=[[e.p[0]+170,34,e.p[2]-230],[e.p[0],12,e.p[2]]];`, tail: 22 },
  p6_island: { env: { sunEl: 18, sunAz: 150, cloud: .45 }, js: `g.spawn('battery',{isl:0});cam.free=[[1650,95,6500],[2600,70,7800]];`, frames: 8 },
  p7_top: { env: { sunEl: 35, sunAz: 80, cloud: .3 }, js: `g.spawn('boat',{n:2,brg:15,dist:300,spread:70});cam.az=.4;cam.el=1.15;cam.d=620;`, frames: 26 },
  p8_wide: { env: { sunEl: 12, sunAz: 20, cloud: .55, haze: .45 }, js: `g.spawn('boat',{n:3,brg:0,dist:650,spread:50});g.spawn('jet',{n:2,brg:-25,dist:1100,spread:14});cam.az=3.3;cam.el=.16;cam.d=900;`, frames: 30 },
  p9_title: { title: 1, env: { sunEl: 14, sunAz: 60 }, js: ``, frames: 10 },
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const PORT = await require('./srv.js')(), base = base0.replace('localhost:8765', 'localhost:' + PORT);
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const q of QS) for (const [name, P] of Object.entries(POSES)) {
    if (only && !only.some(o => name.startsWith(o))) continue;
    const p = await b.newPage({ viewport: { width: W, height: H } }), logs = [], t0 = Date.now();
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 300)); });
    p.on('pageerror', e => logs.push('pageerror ' + e.message));
    const hud = a.includes('--hud') || P.title ? '' : '&nohud';
    await p.goto(base ? `${base}?step&q=${q}${hud}` : `http://localhost:${PORT}/${DIR}/dev.html?step&q=${q}${hud}&mods=${mods === 'all' ? ALL : mods}`);
    await p.waitForFunction(() => window.G && (G.ready || G.dead), null, { timeout: 180000 });
    const r = await p.evaluate(async ([P, PRE]) => {
      G.setEnv(P.env || {}); if (!P.title) eval(PRE + (P.js || '')); G.setEnv(P.env || {});
      G.dyn = .5; G.resize(); for (let i = 0; i < (P.frames || 20); i++) G.tick(.1);
      if (P.post) eval('const g=G.game,cam=g.cam;' + P.post);
      for (let i = 0; i < (P.tail || 0); i++) G.tick(.1);
      G.dyn = 1; G.resize(); await G.test.run(3, .033);
      return { errors: G.errors, alive: G.fx && G.fx.alive | 0, t: +G.time.toFixed(1) };
    }, [P, PRE]).catch(e => ({ errors: ['EVAL ' + e.message] }));
    const f = path.join(out, `${name}_${q}.png`); await p.screenshot({ path: f });
    console.log(`${name}_${q}: ${((Date.now() - t0) / 1000).toFixed(0)}s ${JSON.stringify(r)}${logs.length ? '\n   ' + [...new Set(logs)].slice(0, 6).join('\n   ') : ''}`);
    await p.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
