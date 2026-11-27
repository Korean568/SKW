// 무기(mod_arms) 검증 — 스토리 1: node verify_arms.js [구역…] (구역: bot bot<id> rules drops dropsall voices cost prep — 없으면 cost · prep 빼고 전부)
// 봇 승리(기본 장비 · wep=m134 · wep=rpg7 · wep=k14, 무기별 처치 수) · 수동 규칙(자동 재장전 없음 · 약실 +1 · 교체 시 발밑에 떨어뜨림 · E 로만 줍기 · 빈 칸 줍기는 손의 총 유지)
// RPG-7 신관 5 m · 자기 피해 · 후폭풍 · M134 회전 시간 · 방아쇠 잠금(전사 · 방탄판 교체는 소리 없이) · 소리 이름(mod_audio 표) · 실시간 보이스 ≤ 25
// 바닥 총 통계(스토리 1 · 400회: 7개 · 기내 2~3 · 중화기 ≤ 1 · 약 47%) · drops=all 거리 · 스토리 3 없음 · 로직 프레임 비용 · people.prepare 비용 · G.errors
const { chromium } = require('playwright');
const FLAGS = ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--autoplay-policy=no-user-gesture-required'];
const MODS = 'gpu,sky,post,mesh,fx,audio,i18n,people,guns,arms,cabin,fps,village,story2,palace,story3,ruins,story4,story,desktop,touch,en1,en2,en3,en4,enui,enarms';
const STEP = `const dt=.05;G.time+=dt;G.dt=dt;G.frame++;G.lights.length=0;for(const m of G.order)m.update&&m.update(dt);G.mods.people.prepare&&G.mods.people.prepare();`;
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const AUD = require('fs').readFileSync(__dirname + '/mod_audio.js', 'utf8'); // 소리 이름 표 (SND 원샷 · LOOP 지속음 · 총 id 별칭)
const SNDN = new Set([...AUD.slice(AUD.indexOf('const SND'), AUD.indexOf('const LOOP')).matchAll(/^\s+(\w+):/gm)].map(m => m[1]).concat(['k2', 'k2a', 'k2c1', 'k2c', 'm16', 'aug', 'akm', 'k7', 'rpg7', 'k5']));
const LOOPN = new Set([...AUD.slice(AUD.indexOf('const LOOP'), AUD.indexOf('const belt')).matchAll(/^\s+(\w+)\(d\)/gm)].map(m => m[1]));
// 소리 기록: 프레임 번호와 함께 (L:이름:켜짐 은 지속음)
const SLOG = `const LOG=[];let FR=0;{const p0=G.sfx.play,l0=G.sfx.loop;G.sfx.play=function(n){LOG.push([FR,n]);return p0.apply(this,arguments)};G.sfx.loop=function(n,on){LOG.push([FR,'L:'+n+':'+(on?1:0)]);return l0.apply(this,arguments)};}
  const ARMS=new Set(['dry','click','mode','swap','pick','reload','rlb','rlr','bolt','rpgl','boom','boomf','ring','explosion']); // 무기 조작 소리 (총성 · NPC · 피격 제외)`;
(async () => {
  const PORT = await require('./srv.js')();
  let bad = 0; const say = (ok, m) => { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + m); };
  const b = await chromium.launch({ args: FLAGS });
  const open = async q => { const p = await b.newPage({ viewport: { width: 960, height: 540 } }), logs = [];
    p.on('console', m => (m.type() === 'error' || m.type() === 'warning') && !/CONTEXT_LOST|404|Failed to load/.test(m.text()) && logs.push(m.text().slice(0, 200))); p.on('pageerror', e => logs.push('pageerror ' + e.message));
    await p.goto(`http://localhost:${PORT}/source/dev.html?step&q=LOW&lang=ko&mods=${MODS}${q}`); await p.waitForFunction(() => window.G && (G.ready || G.dead), null, { timeout: 180000 }); return [p, logs]; };
  const want = k => only.length ? only.includes(k) : !['cost', 'prep'].includes(k);

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
      G.story.start();G.story.go('fight');const A=G.arms,I=A.inp,pl=G.fps.pl,C=G.cabin,out={};${SLOG}
      const run=(s,f)=>{for(let i=0;i<s/.05;i++){G.fps.bot=false;f&&f(i);${STEP}A.bot=true;FR++;}};
      const mine=k=>LOG.slice(k).map(x=>x[1]).filter(n=>ARMS.has(n)||n.startsWith('L:m134')||n.startsWith('L:rocket'));
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
      let L0=LOG.length;run(.1,i=>{hold();I.use=i===0?1:0;});out.free={slot:st().slot,cur:A.cur,drops:A.drops.list.length,snd:mine(L0),ok:st().slot[2]==='aug'&&A.cur==='k2c1'&&A.drops.list.length===0&&mine(L0).includes('pick')};
      // 교체: 주무기 두 칸이 찬 채 M16 줍기 → 손의 K2C1(장전 17) 이 발밑에
      A.inv.mag.k2c1=17;A.drops.add('m16',[pl.p[0]+f[0]*.7,pl.p[1],pl.p[2]+f[2]*.7],0,30,60);L0=LOG.length;run(.1,i=>{hold();I.use=i===0?1:0;});run(.5,()=>hold());
      const dr=A.dbg.drops();out.swap={slot:st().slot,cur:A.cur,drops:dr,snd:mine(L0),ok:mine(L0).includes('swap')&&!mine(L0).includes('pick')&&st().slot[0]==='m16'&&A.cur==='m16'&&dr.length===1&&dr[0].id==='k2c1'&&dr[0].loaded===17&&Math.hypot(dr[0].p[0]-pl.p[0],dr[0].p[2]-pl.p[2])<.8};
      // 같은 총: 탄약만
      A.drops.clear();const q0=A.inv.pool['556'];A.drops.add('aug',[pl.p[0]+f[0]*.7,pl.p[1],pl.p[2]+f[2]*.7],0,30,60);L0=LOG.length;run(.1,i=>{hold();I.use=i===0?1:0;});
      out.ammo={pool:[q0,A.inv.pool['556']],snd:mine(L0),ok:A.inv.pool['556']>q0&&A.drops.list.length===0&&mine(L0).includes('pick')};
      // 사격 모드: 'mode' 하나만 (M16: 점사 → 단발)
      L0=LOG.length;run(.2,i=>{hold();I.mode=i===0?1:0;});out.mode={snd:mine(L0),mode:A.inv.mode.m16,ok:mine(L0).join()==='mode'&&A.inv.mode.m16===1};
      // M134 회전 · 연사 · 소리
      A.give('m134');run(1.2,()=>hold());let snd=0,pk=0,win=[];const pl0=G.sfx.play;G.sfx.play=function(){snd++;return pl0.apply(this,arguments)};
      const s0=A.D.shots;let first=-1;run(3,i=>{hold();I.fire=1;if(first<0&&A.D.shots>s0)first=i*.05;win.push(snd);snd=0;if(win.length>20)win.shift();pk=Math.max(pk,win.reduce((a,b)=>a+b,0));});
      const rps=(A.D.shots-s0)/(3-first);G.sfx.play=pl0;const Lf=LOG.length;run(1.5,()=>hold());const lf=LOG.slice(Lf).find(x=>x[1].startsWith('L:m134f:0'));
      out.m134={spinUp:A.D.spinUp,first,rps:+rps.toFixed(1),maxRays:A.D.maxRays,spinAfter:+A.st.spin.toFixed(2),oneShotsPerSec:pk,fOff:!!lf,ok:A.D.spinUp>.45&&A.D.spinUp<.6&&rps>40&&pk<=25&&A.st.spin<.01&&!!lf};
      // 탄띠 교체 소리 'rlb'
      A.inv.mag.m134=0;L0=LOG.length;run(.3,i=>{hold();I.rl=i<2?1:0;});out.rlb={snd:mine(L0),ok:mine(L0).includes('rlb')};run(6.2,()=>hold());
      // RPG: 2 m 앞 벽 → 신관 미작동 · 뒤에 벽 → 후폭풍
      A.give('rpg7');run(1.2,()=>hold());
      const z=-1;pl.p=C.w([-.35,0,z]);const tgt=C.w([1.5,1.2,z]),e=[pl.p[0],pl.p[1]+1.6,pl.p[2]];pl.yaw=Math.atan2(tgt[0]-e[0],tgt[2]-e[2]);pl.pit=0;
      const D0={...A.D};run(1,i=>{hold();I.fire=i===2?1:0;});
      out.rpgNear={unarmed:A.D.unarmed-D0.unarmed,blasts:A.D.blasts-D0.blasts,bb:A.D.bb-D0.bb,ok:A.D.unarmed-D0.unarmed===1&&A.D.blasts===D0.blasts&&A.D.bb-D0.bb===1};
      // 6 m 앞 바닥 → 신관 작동 · 폭발 · 자기 피해 (2.5~7 m)
      L0=LOG.length;run(4.5,i=>{hold();I.rl=i<2?1:0;});out.rlr={snd:mine(L0),mag:A.inv.mag.rpg7,ok:mine(L0).includes('rlr')&&A.inv.mag.rpg7===1};const z2=C.l(pl.p)[2];pl.p=C.w([0,0,z2]);const t2=C.w([0,0,z2+6.2]);pl.yaw=Math.atan2(t2[0]-pl.p[0],t2[2]-pl.p[2]);pl.pit=-Math.atan2(1.6,6.2);
      const D1={...A.D};L0=LOG.length;run(1.5,i=>{hold();I.fire=i===2?1:0;});const rs=mine(L0);
      out.rpgFar={mag:A.inv.mag.rpg7,blasts:A.D.blasts-D1.blasts,selfHits:A.D.selfHits-D1.selfHits,unarmed:A.D.unarmed-D1.unarmed,snd:rs,ok:A.D.blasts-D1.blasts===1&&A.D.selfHits-D1.selfHits===1&&rs.includes('rpgl')&&rs.includes('boom')&&rs.includes('L:rocket:1')&&rs.includes('L:rocket:0')};
      // 빈 RPG: 자동 재장전 없음
      run(1,()=>{hold();I.fire=1;});out.rpgEmpty={mag:A.inv.mag.rpg7,pool:A.inv.pool.rkt,prompt:A.prompt,ok:A.inv.mag.rpg7===0};
      // 일체형 광학(RPG PGO-7 · AUG 링): 모델이 보이는 동안 조준 정도는 시점이 모델에 닿기 전까지만 (RPG < .375 · AUG < .525), 그 위는 겹침으로 숨김
      for(const[g,lim]of[['rpg7',.375],['aug',.525],['k14',.675]]){A.give(g);run(1.2,()=>hold());let mx=0,hid=0,ov=0;const F=G.people.fp;
        run(1.6,i=>{hold();I.ads=i<16?1:0;});for(let i=0;i<32;i++){hold();I.ads=i<16?1:0;run(.05);if(F.on&&!F.hide)mx=Math.max(mx,F.aim);else hid++;ov=Math.max(ov,A.view.ovA);}
        out['ads_'+g]={visMaxAim:+mx.toFixed(3),hiddenFrames:hid,ovMax:ov,ok:mx<lim&&hid>5&&ov===1};}
      // K14: 'bolt' 은 사격 .1~.25초 뒤 (같은 프레임 아님)
      A.give('k14');run(1.5,()=>hold());L0=LOG.length;run(1,i=>{hold();I.fire=i===1?1:0;});
      {const S=LOG.slice(L0),a=S.find(x=>x[1]==='k14'),b=S.find(x=>x[1]==='bolt');out.bolt={shot:a&&a[0],bolt:b&&b[0],ok:!!a&&!!b&&b[0]-a[0]>=2&&b[0]-a[0]<=5};}
      // 조작 불가(전사): 방아쇠는 소리 · 글자 없이 무시 · M134 회전 없음
      A.give('k2c1');run(1,()=>hold());const silent=(nm,set,unset)=>{const D0={...A.D},k=LOG.length;
        run(1.2,i=>{set();hold();I.fire=i%4<2?1:0;I.ads=1;});const r={snd:mine(k),dry:A.D.dry-D0.dry,blocked:A.D.blocked-D0.blocked,shots:A.D.shots-D0.shots,spin:+A.st.spin.toFixed(2),prompt:A.prompt};unset();run(.3,()=>hold());
        r.ok=!r.snd.length&&!r.dry&&!r.blocked&&!r.shots&&!r.spin&&r.prompt!=='지금은 쏠 수 없다';out[nm]=r;};
      silent('deadK2',()=>{pl.dead=1;},()=>{pl.dead=0;});
      // 방탄판 교체 중(F): 쏘지 않을 뿐 글자 · 딸깍 없음
      pl.rp=0;silent('plateK2',()=>{pl.rp=Math.max(pl.rp,.5);},()=>{pl.rp=0;});
      A.give('m134');run(1.2,()=>hold());silent('deadM134',()=>{pl.dead=1;},()=>{pl.dead=0;});silent('plateM134',()=>{pl.rp=Math.max(pl.rp,.5);},()=>{pl.rp=0;});
      // 일시정지(메뉴): 지속음 끔 → 풀면 다음 프레임에 다시
      run(1,()=>{hold();I.fire=1;});G.paused=true;L0=LOG.length;G.mods.arms.prepare();const pz=LOG.slice(L0).map(x=>x[1]);G.paused=false;G.mods.arms.prepare();L0=LOG.length;run(.3,()=>{hold();I.fire=1;});
      {const re=[...new Set(LOG.slice(L0).map(x=>x[1]).filter(n=>n.startsWith('L:m134')))];out.pause={pz,re,ok:pz.includes('L:m134f:0')&&pz.includes('L:m134s:0')&&re.includes('L:m134f:1')&&re.includes('L:m134s:1')};}
      // 멈춤(처음 화면): 회전 · 사격 · 로켓 지속음 모두 끔
      run(1.5,()=>{hold();I.fire=1;});const spun=A.st.spin;L0=LOG.length;G.story.title();const off=LOG.slice(L0).map(x=>x[1]);run(.5);
      const last={};for(const[,n]of LOG)if(n.startsWith('L:'))last[n.slice(2,-2)]=n.slice(-1);
      out.stop={spun,off,last:{m134s:last.m134s,m134f:last.m134f,rocket:last.rocket},bound:A.bound,ok:spun===1&&last.m134s==='0'&&last.m134f==='0'&&last.rocket==='0'&&!A.bound&&off.includes('L:m134f:0')};
      return {out,names:[...new Set(LOG.map(x=>x[1]))],errs:G.errors};})()`);
    for (const k in r.out) say(r.out[k].ok, 'rule ' + k + ': ' + JSON.stringify(r.out[k]));
    const bad1 = r.names.filter(n => n.startsWith('L:') ? !LOOPN.has(n.split(':')[1]) : !SNDN.has(n));
    say(!bad1.length, 'sound names exist in mod_audio: ' + JSON.stringify(r.names) + (bad1.length ? ' MISSING ' + JSON.stringify(bad1) : ''));
    say(!r.errs.length && !logs.length, 'rules errors: ' + JSON.stringify(r.errs) + JSON.stringify(logs.slice(0, 3)));
    await p.close();
  }

  // 3) 스토리 1 바닥 총 통계 (시작 400회, 로직만): 7개 · 기내 2~3 · 중화기 ≤ 1 (약 47%) · K14 ≤ 1 · 벽 안 아님(밀림 < 3 cm) · 사람 · 시작점 · 등장 지점과 거리 — 이어서 스토리 3 은 바닥 총 없음
  if (want('drops')) {
    const [p, logs] = await open('&god');
    const r = await p.evaluate(`(()=>{G.story.start();const A=G.arms,C=G.cabin,N=400,R={n:N,cnt:{},heavyRuns:0,bad:[],ids:{},minPerson:9,minStart:9,minSpawn:99,minGap:99,maxPush:0,inside:{}};
      for(let k=0;k<N;k++){G.story.go('fight');for(let j=0;j<60&&!G.fps.on;j++){${STEP}}const L=A.drops.list,ad=A.dbg.ad(),me=G.fps.pl,ppl=ad.people();
        R.cnt[L.length]=(R.cnt[L.length]||0)+1;let h=0,k14=0,inn=0,mp=0;
        for(const d of L){R.ids[d.id]=(R.ids[d.id]||0)+1;A.W[d.id].slot==='H'&&h++;d.id==='k14'&&k14++;d.F&&inn++;
          const q=ad.collide(d.p.slice(),.3),pu=Math.hypot(q[0]-d.p[0],q[2]-d.p[2]);R.maxPush=Math.max(R.maxPush,pu);mp=Math.max(mp,pu);
          for(const P of ppl)R.minPerson=Math.min(R.minPerson,Math.hypot(P[0]-d.p[0],P[2]-d.p[2]));
          R.minStart=Math.min(R.minStart,Math.hypot(me.p[0]-d.p[0],me.p[2]-d.p[2]));
          for(const s of C.K.spawn)R.minSpawn=Math.min(R.minSpawn,Math.hypot(s[0]-d.p[0],s[2]-d.p[2]));
          for(const e of L)e!==d&&(R.minGap=Math.min(R.minGap,Math.hypot(e.p[0]-d.p[0],e.p[2]-d.p[2])));}
        R.inside[inn]=(R.inside[inn]||0)+1;h&&R.heavyRuns++;(h>1||k14>1||L.length!==7||inn<2||inn>3||mp>.03)&&R.bad.push({k,n:L.length,h,k14,inn});}
      for(const k of ['minPerson','minStart','minSpawn','minGap','maxPush'])R[k]=+R[k].toFixed(3);R.heavyPct=+(100*R.heavyRuns/N).toFixed(1);
      // 스토리 3: 처음 화면 → 스토리 3 시작 · 3초 진행 → 바닥 총 · 무기 소품 없음
      G.story.title();G.story3.start();for(let i=0;i<60;i++){${STEP}}
      R.s3={bound:A.bound,drops:A.drops.list.length,armsProps:(G.people.props||[]).filter(x=>x._arms).length};G.story3.stop&&G.story3.stop();
      R.errs=G.errors;return R;})()`);
    say(!r.bad.length && r.cnt[7] === r.n && r.maxPush <= .03 && r.minPerson >= 1.2 && r.minStart >= 2.5 && r.minSpawn >= 5 && r.minGap >= 2.5, 'S1 drops x' + r.n + ': ' + JSON.stringify({ cnt: r.cnt, inside: r.inside, ids: r.ids, maxPush: r.maxPush, minPerson: r.minPerson, minStart: r.minStart, minSpawn: r.minSpawn, minGap: r.minGap, bad: r.bad.slice(0, 5) }));
    say(r.heavyPct >= 40 && r.heavyPct <= 55, `S1 heavy weapon present in ${r.heavyPct}% of runs (target ≈ 47%, 40–55)`);
    say(!r.s3.bound && !r.s3.drops && !r.s3.armsProps, 'S3 has no floor guns: ' + JSON.stringify(r.s3));
    say(!r.errs.length && !logs.length, 'drops errors: ' + JSON.stringify(r.errs) + JSON.stringify(logs.slice(0, 3)));
    await p.close();
  }

  // 4) drops=all (시험 훅): 11종 · 사람 1.2 m 밖 · 벽 안 아님
  if (want('dropsall')) {
    const [p, logs] = await open('&god&drops=all');
    const r = await p.evaluate(`(()=>{G.story.start();G.story.go('fight');for(let j=0;j<60&&!G.fps.on;j++){${STEP}}const A=G.arms,ad=A.dbg.ad(),ppl=ad.people(),L=A.drops.list.slice(-11);
      const o=L.map(d=>{const q=ad.collide(d.p.slice(),.3);return{id:d.id,push:+Math.hypot(q[0]-d.p[0],q[2]-d.p[2]).toFixed(3),person:+Math.min(...ppl.map(P=>Math.hypot(P[0]-d.p[0],P[2]-d.p[2]))).toFixed(2)};});
      return {n:A.drops.list.length,ids:new Set(L.map(d=>d.id)).size,o,errs:G.errors};})()`);
    say(r.n === 18 && r.ids === 11 && r.o.every(d => d.push < .03 && d.person >= 1.2) && !r.errs.length && !logs.length, 'drops=all: ' + JSON.stringify(r));
    await p.close();
  }

  // 5) 실시간 소리 보이스 (0.05초 단계를 실제 시간에 맞춰): M134 5초 연사 + 로켓 1발 + 교전 NPC 총성 → G.sfx.voices() ≤ 25 (첫 1초는 앞선 빠른 단계의 보이스가 빠지는 시간이라 제외)
  if (want('voices')) {
    const [p, logs] = await open('&god');
    const r = await p.evaluate(`(async()=>{G.story.start();G.story.go('fight');for(let i=0;i<300;i++){G.fps.bot=true;${STEP}}
      const A=G.arms,I=A.inp,pl=G.fps.pl,C=G.cabin;G.fps.bot=false;A.bot=true;A.give('m134');
      const x=pl.p[0]+Math.sin(C.K.site.yaw+1.57)*9,z=pl.p[2]+Math.cos(C.K.site.yaw+1.57)*9;pl.p=[x,C.ground(x,z),z];pl.yaw=C.K.site.yaw+1.57;pl.pit=.06;
      let vmax=0,vs=[],launched=0,rk=0,st=G.sfx.voices();const sl=ms=>new Promise(r=>setTimeout(r,ms));
      for(let i=0;i<110;i++){const t0=performance.now();for(const k in I)I[k]=0;I.fire=i===39?0:1;
        if(i===40){A.inv.slot[3]='rpg7';A.inv.mag.rpg7=1;}if(i===41){A.inv.slot[3]='m134';launched=A.D.blasts+A.D.unarmed+(A.rocket?1:0);}
        ${STEP}A.rocket&&rk++;const v=G.sfx.voices();i>=20&&(vmax=Math.max(vmax,v));i%10||vs.push(v);await sl(Math.max(0,50-(performance.now()-t0)));}
      return {vmax,vs,rocketFrames:rk,launched,shots:A.D.shots,ctx:typeof AudioContext,errs:G.errors};})()`);
    say(r.vmax <= 25 && r.rocketFrames > 3 && r.shots > 100 && !r.errs.length && !logs.length, 'realtime voices (M134 burst + rocket + NPC fire): ' + JSON.stringify(r));
    await p.close();
  }

  // 6) 로직 프레임 비용 (9 생존 + 22 시신 + 바닥 총 7 + 날아가는 로켓, MEDIUM) — 헤드리스 CPU 시간 (렌더 제외)
  if (want('cost')) {
    const [p, logs] = await open('&god&q=MEDIUM&wep=rpg7');
    const r = await p.evaluate(`(()=>{G.story.start();G.story.go('fight');for(let i=0;i<400;i++){G.fps.bot=true;${STEP}}
      const E=G.fps.E(),alive=E.filter(e=>!e.P.dead).length,dead=E.filter(e=>e.P.dead).length;G.fps.bot=false;G.arms.bot=true;
      let t=0,n=0,fly=0;for(let i=0;i<200;i++){if(!G.arms.rocket&&G.arms.inv.mag.rpg7===0)G.arms.inv.mag.rpg7=1;G.arms.inp.fire=i%2;const t0=performance.now();${STEP}t+=performance.now()-t0;n++;G.arms.rocket&&fly++;}
      return {alive,dead,drops:G.arms.drops.list.length,props:(G.people.props||[]).length,rocketFrames:fly,msPerFrame:+(t/n).toFixed(3),errs:G.errors}})()`);
    say(!r.errs.length && !logs.length, 'logic cost MEDIUM: ' + JSON.stringify(r));
    await p.close();
  }
  // 7) people.prepare 비용 (총 모델 포함, MEDIUM · 교전 중 사람 ~40 + 바닥 총 7): 200 프레임 평균 · 중앙값 · 90%
  if (want('prep')) {
    const [p, logs] = await open('&god&q=MEDIUM');
    const r = await p.evaluate(`(()=>{G.story.start();G.story.go('fight');for(let i=0;i<700;i++){G.fps.bot=true;${STEP}}const pr=G.mods.people.prepare,ts=[];
      for(let i=0;i<200;i++){G.fps.bot=true;const dt=.05;G.time+=dt;G.dt=dt;G.frame++;G.lights.length=0;for(const m of G.order)m.update&&m.update(dt);const t0=performance.now();pr();ts.push(performance.now()-t0);}
      ts.sort((a,b)=>a-b);return {people:G.people.list.filter(P=>P.vis!==false).length,props:(G.people.props||[]).length,mean:+(ts.reduce((a,b)=>a+b)/200).toFixed(3),median:+ts[100].toFixed(3),p90:+ts[180].toFixed(3),max:+ts[199].toFixed(2),errs:G.errors}})()`);
    say(!r.errs.length && !logs.length, 'people.prepare ms/frame (with guns): ' + JSON.stringify(r));
    await p.close();
  }
  await b.close();
  console.log(bad ? `=== ${bad} FAILED ===` : '=== ALL PASS ==='); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
