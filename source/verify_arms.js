// 무기(mod_arms) 검증 — 스토리 1: node verify_arms.js [dev.html 기준 추가 쿼리]
// 봇 승리(기본 장비 · wep=m134 · wep=rpg7 · wep=k14, 무기별 처치 수) · 수동 규칙(자동 재장전 없음 · 약실 +1 · 교체 시 발밑에 떨어뜨림 · E 로만 줍기 · 빈 칸 줍기는 손의 총 유지)
// RPG-7 신관 5 m · 자기 피해 · 후폭풍 · M134 회전 시간 · 소리 보이스 수 · 로직 프레임 비용 · G.errors
const { chromium } = require('playwright');
const FLAGS = ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--autoplay-policy=no-user-gesture-required'];
const MODS = 'gpu,sky,post,mesh,fx,audio,i18n,people,guns,arms,cabin,fps,village,story2,palace,story3,ruins,story4,story,desktop,touch,en1,en2,en3,en4,enui,enarms';
const STEP = `const dt=.05;G.time+=dt;G.dt=dt;G.frame++;G.lights.length=0;for(const m of G.order)m.update&&m.update(dt);G.mods.people.prepare&&G.mods.people.prepare();`;
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
(async () => {
  const PORT = await require('./srv.js')();
  let bad = 0; const say = (ok, m) => { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + m); };
  const b = await chromium.launch({ args: FLAGS });
  const open = async q => { const p = await b.newPage({ viewport: { width: 960, height: 540 } }), logs = [];
    p.on('console', m => (m.type() === 'error' || m.type() === 'warning') && !/CONTEXT_LOST|404|Failed to load/.test(m.text()) && logs.push(m.text().slice(0, 200))); p.on('pageerror', e => logs.push('pageerror ' + e.message));
    await p.goto(`http://localhost:${PORT}/source/dev.html?step&q=LOW&lang=ko&mods=${MODS}${q}`); await p.waitForFunction(() => window.G && (G.ready || G.dead), null, { timeout: 180000 }); return [p, logs]; };
  const want = k => !only.length || only.includes(k);

  // 1) 봇 승리 — 장비별 (무기별 처치 수 기록, M134 는 혼자 이겨도 됨: 기록만)
  for (const w of ['', 'm134', 'rpg7', 'k14']) {
    if (!want('bot' + w) && !want('bot')) continue;
    const [p, logs] = await open(w ? '&wep=' + w : '');
    const r = await p.evaluate(`(()=>{const t0=performance.now();G.story.start();G.story.go('fight');let i=0,snd=0,peak=0,win=[];const pl=G.sfx.play;G.sfx.play=function(){snd++;return pl.apply(this,arguments)};
      for(;i<30000;i++){if(G.fps.on)G.fps.bot=true;${STEP}win.push(snd);snd=0;if(win.length>20)win.shift();peak=Math.max(peak,win.reduce((a,b)=>a+b,0));if(G.story.S.beat==='end'&&!G.fps.on)break}
      const A=G.arms.D;return {t:i*.05|0,ms:+((performance.now()-t0)/i).toFixed(2),win:G.story.S.win,kills:G.fps.S.kills,kw:A.kw,shots:A.shots,blasts:A.blasts,selfHits:A.selfHits,bb:A.bb,unarmed:A.unarmed,spinUp:A.spinUp,maxRays:A.maxRays,drops:A.drops,sndPerSec:peak,errs:G.errors}})()`);
    say(r.win === true && r.kills >= 50 && !r.errs.length && !logs.length, `bot win${w ? ' wep=' + w : ' (K2C1+K7)'}: ` + JSON.stringify(r) + (logs.length ? ' ' + JSON.stringify(logs.slice(0, 3)) : ''));
    await p.close();
  }

  // 2) 수동 규칙 (god: 적의 총탄 무시) — 봇 입력으로 G.arms 를 직접 조작
  if (want('rules')) {
    const [p, logs] = await open('&god');
    const r = await p.evaluate(`(async()=>{
      G.story.start();G.story.go('fight');const A=G.arms,I=A.inp,pl=G.fps.pl,C=G.cabin,out={};
      const run=(s,f)=>{for(let i=0;i<s/.05;i++){G.fps.bot=false;f&&f(i);${STEP}A.bot=true;}};
      run(.5);A.bot=true;G.fps.bot=false;
      const hold=()=>{I.fire=0;I.ads=0;I.rl=0;I.use=0;I.slot=0;I.mode=0;I.scope=0;};
      const st=()=>A.dbg.state();
      // 자동 재장전 없음
      A.inv.mag.k2c1=0;const p0=A.inv.pool['556'];run(1,()=>{hold();I.fire=1;});
      out.noAuto={mag:A.inv.mag.k2c1,pool:A.inv.pool['556'],rl:st().rl,dry:A.D.dry,prompt:A.prompt,ok:A.inv.mag.k2c1===0&&A.inv.pool['556']===p0&&A.D.dry>0&&A.D.autoRl===0};
      // 1발 남기고 재장전 → 31
      A.inv.mag.k2c1=1;run(.1,()=>{hold();});run(2.6,i=>{hold();I.rl=i<2?1:0;});out.r31={mag:A.inv.mag.k2c1,pool:A.inv.pool['556'],ok:A.inv.mag.k2c1===31};
      // K14 1발 → 6
      A.give('k14');A.inv.mag.k14=1;run(1,()=>hold());run(3.4,i=>{hold();I.rl=i<2?1:0;});out.k14={mag:A.inv.mag.k14,cur:A.cur,ok:A.inv.mag.k14===6};
      // 빈 칸 줍기: 손의 총 그대로 (3번 칸 비우고 K2C1 을 든 채 AUG 줍기)
      A.inv.slot[2]=null;run(.1,i=>{hold();I.slot=i===0?1:0;});run(.6,()=>hold());
      A.drops.clear();const f=[Math.sin(pl.yaw),0,Math.cos(pl.yaw)],fp=[pl.p[0]+f[0]*.9,pl.p[1],pl.p[2]+f[2]*.9];
      A.drops.add('aug',fp,0,30,60);
      // 밟고 지나가도 줍지 않음
      run(1.5,()=>{hold();pl.p[0]=fp[0];pl.p[2]=fp[2];});out.walk={drops:A.drops.list.length,slot:st().slot,ok:A.drops.list.length===1&&!st().slot.includes('aug')};
      run(.1,i=>{hold();I.use=i===0?1:0;});out.free={slot:st().slot,cur:A.cur,drops:A.drops.list.length,ok:st().slot[2]==='aug'&&A.cur==='k2c1'&&A.drops.list.length===0};
      // 교체: 주무기 두 칸이 찬 채 M16 줍기 → 손의 K2C1(장전 17) 이 발밑에
      A.inv.mag.k2c1=17;A.drops.add('m16',[pl.p[0]+f[0]*.7,pl.p[1],pl.p[2]+f[2]*.7],0,30,60);run(.1,i=>{hold();I.use=i===0?1:0;});run(.5,()=>hold());
      const dr=A.dbg.drops();out.swap={slot:st().slot,cur:A.cur,drops:dr,ok:st().slot[0]==='m16'&&A.cur==='m16'&&dr.length===1&&dr[0].id==='k2c1'&&dr[0].loaded===17&&Math.hypot(dr[0].p[0]-pl.p[0],dr[0].p[2]-pl.p[2])<.8};
      // 같은 총: 탄약만
      A.drops.clear();const q0=A.inv.pool['556'];A.drops.add('aug',[pl.p[0]+f[0]*.7,pl.p[1],pl.p[2]+f[2]*.7],0,30,60);run(.1,i=>{hold();I.use=i===0?1:0;});
      out.ammo={pool:[q0,A.inv.pool['556']],ok:A.inv.pool['556']>q0&&A.drops.list.length===0};
      // M134 회전 · 연사 · 소리
      A.give('m134');run(1.2,()=>hold());let snd=0,pk=0,win=[];const pl0=G.sfx.play;G.sfx.play=function(){snd++;return pl0.apply(this,arguments)};
      const s0=A.D.shots;let first=-1;run(3,i=>{hold();I.fire=1;if(first<0&&A.D.shots>s0)first=i*.05;win.push(snd);snd=0;if(win.length>20)win.shift();pk=Math.max(pk,win.reduce((a,b)=>a+b,0));});
      const rps=(A.D.shots-s0)/(3-first);G.sfx.play=pl0;run(1.5,()=>hold());
      out.m134={spinUp:A.D.spinUp,first,rps:+rps.toFixed(1),maxRays:A.D.maxRays,spinAfter:+A.st.spin.toFixed(2),oneShotsPerSec:pk,ok:A.D.spinUp>.45&&A.D.spinUp<.6&&rps>40&&pk<=25&&A.st.spin<.01};
      // RPG: 2 m 앞 벽 → 신관 미작동 · 뒤에 벽 → 후폭풍
      A.give('rpg7');run(1.2,()=>hold());
      const z=-1;pl.p=C.w([-.35,0,z]);const tgt=C.w([1.5,1.2,z]),e=[pl.p[0],pl.p[1]+1.6,pl.p[2]];pl.yaw=Math.atan2(tgt[0]-e[0],tgt[2]-e[2]);pl.pit=0;
      const D0={...A.D};run(1,i=>{hold();I.fire=i===2?1:0;});
      out.rpgNear={unarmed:A.D.unarmed-D0.unarmed,blasts:A.D.blasts-D0.blasts,bb:A.D.bb-D0.bb,ok:A.D.unarmed-D0.unarmed===1&&A.D.blasts===D0.blasts&&A.D.bb-D0.bb===1};
      // 6 m 앞 바닥 → 신관 작동 · 폭발 · 자기 피해 (2.5~7 m)
      run(4.5,i=>{hold();I.rl=i<2?1:0;});const z2=C.l(pl.p)[2];pl.p=C.w([0,0,z2]);const t2=C.w([0,0,z2+6.2]);pl.yaw=Math.atan2(t2[0]-pl.p[0],t2[2]-pl.p[2]);pl.pit=-Math.atan2(1.6,6.2);
      const D1={...A.D};run(1.5,i=>{hold();I.fire=i===2?1:0;});
      out.rpgFar={mag:A.inv.mag.rpg7,blasts:A.D.blasts-D1.blasts,selfHits:A.D.selfHits-D1.selfHits,unarmed:A.D.unarmed-D1.unarmed,ok:A.D.blasts-D1.blasts===1&&A.D.selfHits-D1.selfHits===1};
      // 빈 RPG: 자동 재장전 없음
      run(1,()=>{hold();I.fire=1;});out.rpgEmpty={mag:A.inv.mag.rpg7,pool:A.inv.pool.rkt,prompt:A.prompt,ok:A.inv.mag.rpg7===0};
      return {out,errs:G.errors};})()`);
    for (const k in r.out) say(r.out[k].ok, 'rule ' + k + ': ' + JSON.stringify(r.out[k]));
    say(!r.errs.length && !logs.length, 'rules errors: ' + JSON.stringify(r.errs) + JSON.stringify(logs.slice(0, 3)));
    await p.close();
  }

  // 3) 로직 프레임 비용 (9 생존 + 22 시신 + 바닥 총 7 + 날아가는 로켓, MEDIUM) — 헤드리스 CPU 시간 (렌더 제외)
  if (want('cost')) {
    const [p, logs] = await open('&god&q=MEDIUM&wep=rpg7');
    const r = await p.evaluate(`(()=>{G.story.start();G.story.go('fight');for(let i=0;i<400;i++){G.fps.bot=true;${STEP}}
      const E=G.fps.E(),alive=E.filter(e=>!e.P.dead).length,dead=E.filter(e=>e.P.dead).length;G.fps.bot=false;G.arms.bot=true;
      let t=0,n=0,fly=0;for(let i=0;i<200;i++){if(!G.arms.rocket&&G.arms.inv.mag.rpg7===0)G.arms.inv.mag.rpg7=1;G.arms.inp.fire=i%2;const t0=performance.now();${STEP}t+=performance.now()-t0;n++;G.arms.rocket&&fly++;}
      return {alive,dead,drops:G.arms.drops.list.length,props:(G.people.props||[]).length,rocketFrames:fly,msPerFrame:+(t/n).toFixed(3),errs:G.errors}})()`);
    say(!r.errs.length && !logs.length, 'logic cost MEDIUM: ' + JSON.stringify(r));
    await p.close();
  }
  await b.close();
  console.log(bad ? `=== ${bad} FAILED ===` : '=== ALL PASS ==='); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
