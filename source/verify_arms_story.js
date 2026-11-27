// 무기(mod_arms) 검증 — 스토리 2 · 4: node verify_arms_story.js [s2 | s2r7 | s2r6 | s4 | s4m134 ...]
// 방아쇠는 언제나 안전 (Q2) · 대본 인물 무피해 · 선택지(1/2) 도달 · 숫자 반복 무시(R7) · 문 E 우선(R6) · 붙잡은 뒤로 AKM(Q3/R8) · 바닥 총 자리(벽 안 · 인물 아래 없음 · S4 4.5 m 구역) · G.errors
const { chromium } = require('playwright');
const FLAGS = ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--autoplay-policy=no-user-gesture-required'];
const MODS = 'gpu,sky,post,mesh,fx,audio,i18n,people,guns,arms,cabin,fps,village,story2,palace,story3,ruins,story4,story,desktop,touch,en1,en2,en3,en4,enui,enarms';
const STEP = `{const dt=.05;G.time+=dt;G.dt=dt;G.frame++;G.lights.length=0;for(const m of G.order)m.update&&m.update(dt);G.mods.people.prepare&&G.mods.people.prepare();}`;
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const want = k => !only.length || only.includes(k);
// 바닥 총 자리 검사 (페이지 안에서): 벽 안 아님 (collide .3 m 로 3 cm 이상 밀리지 않음) · 대본 인물과 거리
const PLACE = `(st)=>{const L=G.arms.drops.list,col=st===2?G.village.collide:G.ruins.collide,out=[];
  for(const it of L){const q=col(it.p.slice(),.3),mv=Math.hypot(q[0]-it.p[0],q[2]-it.p[2]);let dp=99;for(const P of G.people.list)dp=Math.min(dp,Math.hypot(P.p[0]-it.p[0],P.p[2]-it.p[2]));
    out.push({id:it.id,p:it.p.map(v=>+v.toFixed(2)),wall:+mv.toFixed(3),person:+dp.toFixed(2),inside:st===2?G.village.inside(it.p):undefined,pl:it.pl});}
  return out;}`;
(async () => {
  const PORT = await require('./srv.js')();
  let bad = 0; const say = (ok, m) => { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + m); };
  const b = await chromium.launch({ args: FLAGS });
  const open = async q => { const p = await b.newPage({ viewport: { width: 960, height: 540 } }), logs = [];
    p.on('console', m => (m.type() === 'error' || m.type() === 'warning') && !/CONTEXT_LOST|404|Failed to load/.test(m.text()) && logs.push(m.text().slice(0, 200))); p.on('pageerror', e => logs.push('pageerror ' + e.message));
    await p.goto(`http://localhost:${PORT}/source/dev.html?step&q=LOW&lang=ko&mods=${MODS}${q}`); await p.waitForFunction(() => window.G && (G.ready || G.dead), null, { timeout: 180000 }); return [p, logs]; };

  // 1) 스토리 2 봇 — 처형 · 거절 두 갈래 (drops=all · wep=rpg7)
  for (const ch of ['execute', 'refuse']) {
    if (!want('s2') && !want('s2' + ch)) continue;
    const [p, logs] = await open('&drops=all&wep=rpg7');
    const r = await p.evaluate(`(()=>{const S2=G.story2,S=S2.S,A=G.arms,I=A.inp,F=G.people.fp,me=S2.me;S2.start();S2.bot=true;
      const place0=(${PLACE})(2);const o={beats:[],cur:A.cur,slot:A.inv.slot.slice(),drops:A.drops.list.length,place:place0,freeF:0,fireT:0,blocked0:A.D.blocked,notes:[],adsMin:1,
        scripted:{frames:0,bad:0,guns:{},ovMax:0,aimMax:0},choice:null,choiceAt:-1,keyAt:-1,hp:null};
      let last='',i=0,test=0,kd=0;
      for(;i<16000;i++){
        for(const k in I)I[k]=0;
        const free=S.cm==='fp'&&S.walk&&S.bk<.5&&S.g!=='choice'&&!S.drag&&!S.lock&&!S.pr&&F.on;
        if(free){o.freeF++;
          // 걷는 동안: 군중 쪽을 보고 조준(0.5초) 후 방아쇠 — 언제나 막힘
          if(S.beat==='house'&&test<26){test++;const K=G.village.K;let cx=0,cz=0;for(const q of K.crowd){cx+=q[0];cz+=q[2];}cx/=K.crowd.length;cz/=K.crowd.length;me.yaw=Math.atan2(cx-me.p[0],cz-me.p[2]);me.pit=-.08;I.ads=1;I.fire=test===12||test===24?1:0;
            if(test===14){o.fireT++;o.prompt=document.getElementById('whp').textContent;o.adsMin=Math.min(o.adsMin,A.view.fovK);}}
          else if(i%37===0){I.fire=1;o.fireT++;}
        }
        if(S.pr&&S.beat!=='end'&&S.cm==='fp'){o.scripted.frames++;const g=F.gun;o.scripted.guns[g]=(o.scripted.guns[g]||0)+1;if(g!=='akm'&&g!=='ak')o.scripted.bad++;
          o.scripted.ovMax=Math.max(o.scripted.ovMax,A.view.ovA,A.view.hide);o.scripted.aimMax=Math.max(o.scripted.aimMax,F.aim||0);}
        if(S.g==='choice'&&!S.choice&&S.t-S.gt>1.0&&kd===0){kd=1;o.keyAt=+(S.t-S.gt).toFixed(2);dispatchEvent(new KeyboardEvent('keydown',{code:'${ch === 'execute' ? 'Digit1' : 'Digit2'}'}));dispatchEvent(new KeyboardEvent('keyup',{code:'${ch === 'execute' ? 'Digit1' : 'Digit2'}'}));o.choice=S.choice;}
        ${STEP}
        const b=S.beat;if(b!==last){o.beats.push(b+'@'+(i*.05|0));last=b}
        if(b==='end'&&document.getElementById('end').style.display==='grid')break;
      }
      o.t=i*.05|0;o.final=S.choice;o.shots=A.D.shots;o.hits=A.D.hits;o.blocked=A.D.blocked-o.blocked0;o.blasts=A.D.blasts;o.dead=G.people.list.filter(P=>P.dead).length;
      o.slotEnd=A.inv.slot.slice();o.errs=G.errors;return o;})()`);
    const sc = r.scripted, okPl = r.place.every(d => d.wall < .03);
    say(r.beats.some(x => x.startsWith('choice')) && r.final === ch && r.choice === ch && r.beats.some(x => x.startsWith('end')) && r.shots === 0 && r.hits === 0 && r.blasts === 0 && r.blocked >= 2 && r.dead === 0
      && r.prompt === '지금은 쏠 수 없다' && sc.frames > 50 && sc.bad === 0 && sc.ovMax === 0 && r.cur === 'rpg7' && !r.errs.length && !logs.length,
      `S2 bot ${ch} (Digit${ch === 'execute' ? 1 : 2} at ${r.keyAt}s): ` + JSON.stringify({ beats: r.beats, t: r.t, cur: r.cur, slot: r.slot, drops: r.drops, freeF: r.freeF, fireTries: r.fireT, blocked: r.blocked, shots: r.shots, hits: r.hits, dead: r.dead, prompt: r.prompt, adsFovK: +r.adsMin.toFixed(3), scripted: sc, errs: r.errs }) + (logs.length ? ' ' + JSON.stringify(logs.slice(0, 3)) : ''));
    say(okPl, 'S2 drop placement (drops=all, ' + r.place.length + ' items): ' + JSON.stringify(r.place));
    await p.close();
  }

  // 2) 스토리 2 무작위 배치 (drops=all 없이) 10회: 집 A 1 · 집 B 1 · 길 2 · 인물 1.2 m 밖 · 벽 안 아님 · AKM 위주
  if (want('s2drops')) {
    const [p, logs] = await open('');
    const r = await p.evaluate(`(()=>{const res=[],ids={};for(let k=0;k<10;k++){G.story2.go('house');${STEP}const L=(${PLACE})(2);for(const d of L)ids[d.id]=(ids[d.id]||0)+1;
      const K=G.village.K,iA=(K.A|0)%K.houses.length;let iB=(K.B|0)%K.houses.length;if(iB===iA)iB=(iB+1)%K.houses.length;
      res.push({n:L.length,inA:L.filter(d=>d.inside===iA).length,inB:L.filter(d=>d.inside===iB).length,outd:L.filter(d=>d.inside===-1).length,wall:Math.max(...L.map(d=>d.wall)),person:Math.min(...L.map(d=>d.person)),heavy:L.filter(d=>d.id==='rpg7'||d.id==='m134').length});}
      return {res,ids,errs:G.errors}})()`);
    const ok = r.res.every(x => x.n >= 3 && x.inA <= 1 && x.inB <= 1 && x.wall < .03 && x.person >= 1.2 && x.heavy <= 1);
    say(ok && !r.errs.length && !logs.length, 'S2 random drops x10: ' + JSON.stringify(r));
    await p.close();
  }

  // 3) R7: 누르고 있는 1 (자동 반복) 이 선택지가 뜨는 순간을 지나도 고르지 않음 · .6초 안의 새 입력도 무시 · .6초 뒤 새 입력은 고름
  if (want('s2r7')) {
    const [p, logs] = await open('');
    const r = await p.evaluate(`(()=>{const S2=G.story2,S=S2.S;S2.start();S2.go('choice');S2.bot=false;const o={};let i=0,open=-1;
      const kd=(rep)=>dispatchEvent(new KeyboardEvent('keydown',{code:'Digit1',repeat:rep}));
      kd(false);
      for(;i<400;i++){${STEP}if(S.g==='choice'&&open<0)open=i;
        if(open<0||i-open<24)kd(true); // 1.2초 동안 자동 반복
        if(open>=0&&i-open===6){kd(false);o.early=S.choice;} // .3초: 새로 눌러도 무시
        if(open>=0&&i-open===24){o.held=S.choice;o.tOpen=+(S.t-S.gt).toFixed(2);}
        if(open>=0&&i-open===26){kd(false);dispatchEvent(new KeyboardEvent('keyup',{code:'Digit1'}));o.fresh=S.choice;break;}}
      o.opened=open>=0;o.errs=G.errors;return o;})()`);
    say(r.opened && r.early === null && r.held === null && r.fresh === 'execute' && !r.errs.length && !logs.length, 'S2 R7 held/early Digit1 ignored, fresh press chooses: ' + JSON.stringify(r));
    await p.close();
  }

  // 4) R6: 집 A 문 앞, 1.8 m 안에 바닥 총 — E 는 문을 부수고 줍지 않음 (그다음 E 는 줍는다)
  if (want('s2r6')) {
    const [p, logs] = await open('');
    const r = await p.evaluate(`(()=>{const S2=G.story2,S=S2.S,me=S2.me,A=G.arms;S2.start();S2.go('house');S2.bot=false;
      const run=n=>{for(let i=0;i<n;i++){${STEP}}};run(2);
      const K=G.village.K,h=K.houses[(K.A|0)%K.houses.length],o=d=>[h.door[0]+Math.sin(h.yaw)*d,h.door[1],h.door[2]+Math.cos(h.yaw)*d];
      const q=o(1.25);me.p=G.village.collide([q[0],0,q[2]],.3);me.yaw=Math.atan2(h.door[0]-me.p[0],h.door[2]-me.p[2]);me.pit=-.3;
      A.drops.clear();const g=o(.65);A.drops.add('k2',[g[0],G.village.collide([g[0],0,g[2]],.01)[1],g[2]],0,30,60);run(2);
      const out={gate:S.g,storyPrompt:document.getElementById('s2p').textContent,armsPrompt:A.prompt,near:!!A.drops.near,dist:+Math.hypot(g[0]-me.p[0],g[2]-me.p[2]).toFixed(2)};
      dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));run(1);out.door=S.f.door||0;out.slot1=A.inv.slot.slice();out.drops1=A.drops.list.length;run(10);
      out.drops2=A.drops.list.length;out.slot2=A.inv.slot.slice();dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE'}));
      for(let i=0;i<60&&S.g!=='search';i++)run(1);out.gate2=S.g;run(2);out.armsPrompt2=A.prompt;
      dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));run(2);dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE'}));out.slot3=A.inv.slot.slice();out.cur=A.cur;out.drops3=A.drops.list.length;out.errs=G.errors;return out;})()`);
    say(r.gate === 'door' && r.door === 1 && r.drops1 === 1 && r.drops2 === 1 && !r.slot2.includes('k2') && !r.near && r.slot3[2] === 'k2' && r.cur === 'akm' && r.drops3 === 0 && !r.errs.length && !logs.length,
      'S2 R6 door E wins over floor gun, next E picks up (hand keeps AKM): ' + JSON.stringify(r));
    await p.close();
  }

  // 5) 스토리 4 봇 끝까지 — 방아쇠 언제나 안전 · 바닥 총 4.5 m 구역 안 (분대 쪽) · 줍기 · 집무실 컷에서 바닥 총 숨김
  for (const w of ['', 'm134']) {
    if (!want('s4' + w) && !want('s4')) continue;
    const [p, logs] = await open(w ? '&wep=' + w : '');
    const r = await p.evaluate(`(()=>{const S4=G.story4,S=S4.S,me=S4.me,A=G.arms,I=A.inp,F=G.people.fp;S4.start();S4.bot=true;
      const zone=()=>{const u0=G.ruins.K,lz=u0.lz,st=u0.start,dx=lz[0]-st[0],dz=lz[2]-st[2],n=Math.hypot(dx,dz);return A.drops.list.map(it=>({id:it.id,d:+Math.hypot(it.p[0]-me.o[0],it.p[2]-me.o[2]).toFixed(2),fwd:+(((it.p[0]-me.o[0])*dx+(it.p[2]-me.o[2])*dz)/n).toFixed(2)}));};
      const o={beats:[],cur:A.cur,zone:zone(),place:(${PLACE})(4),freeF:0,fireT:0,spinMax:0,adsFovK:1,cutVis:0,cutF:0,picked:null};let last='',i=0,pk=0;
      for(;i<6000;i++){
        for(const k in I)I[k]=0;
        const free=S.cm==='fp'&&S.bk<.5&&!S.cut&&S.beat!=='end'&&F.on;
        if(free){o.freeF++;I.ads=(i%60)<30?1:0;if(i%23===0){I.fire=1;o.fireT++;}if(i%60===29)o.adsFovK=Math.min(o.adsFovK,A.view.fovK);
          if(S.beat==='talk'&&!pk&&A.drops.list.length){pk=1;const it=A.drops.list[0],a=Math.atan2(it.p[0]-me.p[0],it.p[2]-me.p[2]);me.p=[it.p[0]-Math.sin(a)*.6,it.p[1],it.p[2]-Math.cos(a)*.6];me.yaw=a;
            const before=A.inv.slot.slice(),pool=JSON.stringify(A.inv.pool);I.use=1;${STEP}for(const k in I)I[k]=0;${STEP}o.picked={id:it.id,before,after:A.inv.slot.slice(),cur:A.cur,poolChanged:pool!==JSON.stringify(A.inv.pool),left:A.drops.list.includes(it)};me.p=me.o.slice();}}
        if(S.cut){o.cutF++;o.cutVis+=A.drops.list.filter(it=>it.prop.vis).length+(F.on?1:0);}
        o.spinMax=Math.max(o.spinMax,A.st.spin);
        ${STEP}
        const b=S.beat;if(b!==last){o.beats.push(b+'@'+(i*.05|0));last=b}
        if(b==='end'&&document.getElementById('end').style.display==='grid')break;
      }
      o.t=i*.05|0;o.shots=A.D.shots;o.hits=A.D.hits;o.blocked=A.D.blocked;o.dry=A.D.dry;o.prompt=A.prompt;o.errs=G.errors;return o;})()`);
    const zOK = r.zone.every(z => z.d <= 4.5 && z.fwd <= 1.2) && r.zone.length >= 2 && r.zone.length <= 3;
    const pOK = r.picked && !r.picked.left && (r.picked.after.includes(r.picked.id) || r.picked.poolChanged);
    say(r.beats.some(x => x.startsWith('end')) && r.shots === 0 && r.hits === 0 && r.blocked >= 3 && r.spinMax === 0 && (w === 'm134' ? r.adsFovK === 1 : r.adsFovK < .95) && zOK && pOK && r.cutVis === 0 && r.cur === (w || 'k2c1') && !r.errs.length && !logs.length,
      `S4 bot${w ? ' wep=' + w + ' (no ADS, never spins)' : ''}: ` + JSON.stringify({ beats: r.beats, t: r.t, cur: r.cur, freeF: r.freeF, fireTries: r.fireT, blocked: r.blocked, shots: r.shots, hits: r.hits, spinMax: r.spinMax, adsFovK: +r.adsFovK.toFixed(3), zone: r.zone, picked: r.picked, cutF: r.cutF, cutVis: r.cutVis, errs: r.errs }) + (logs.length ? ' ' + JSON.stringify(logs.slice(0, 3)) : ''));
    say(r.place.every(d => d.wall < .03 && d.person >= 1.1), 'S4 drop placement: ' + JSON.stringify(r.place));
    await p.close();
  }

  // 5b) 스토리 4 무작위 배치 20회: 3개 (모자라면 2) · 4.5 m 구역 · 분대 쪽 · 분대원 1.1 m 밖 · 벽 안 아님 · 중화기 1 이하
  if (want('s4drops')) {
    const [p, logs] = await open('');
    const r = await p.evaluate(`(()=>{const res=[],ids={},me=G.story4.me;for(let k=0;k<20;k++){G.story4.go('talk');${STEP}const L=(${PLACE})(4),u0=G.ruins.K,dx=u0.lz[0]-u0.start[0],dz=u0.lz[2]-u0.start[2],n=Math.hypot(dx,dz);
      for(const d of L)ids[d.id]=(ids[d.id]||0)+1;
      res.push({n:L.length,dMax:+Math.max(...L.map(d=>Math.hypot(d.p[0]-me.o[0],d.p[2]-me.o[2]))).toFixed(2),fMax:+Math.max(...L.map(d=>((d.p[0]-me.o[0])*dx+(d.p[2]-me.o[2])*dz)/n)).toFixed(2),wall:Math.max(...L.map(d=>d.wall)),person:Math.min(...L.map(d=>d.person)),heavy:L.filter(d=>d.id==='rpg7'||d.id==='m134').length});}
      return {res,ids,errs:G.errors}})()`);
    const ok = r.res.every(x => x.n >= 2 && x.n <= 3 && x.dMax <= 4.5 && x.fMax <= .6 && x.wall < .03 && x.person >= 1.1 && x.heavy <= 1);
    say(ok && !r.errs.length && !logs.length, 'S4 random drops x20: ' + JSON.stringify(r));
    await p.close();
  }

  // 6) 다시 하기 = 새 장비 · 새 배치 (S2 · S4), 스토리 끝 → 해제
  if (want('retry')) {
    const [p, logs] = await open('');
    const r = await p.evaluate(`(()=>{const A=G.arms,o={};G.story2.start();${STEP}A.give('m134');o.s2a=A.dbg.drops().map(d=>d.id+d.p.join(','));o.held=A.cur;
      G.story2.start();${STEP}o.s2b=A.dbg.drops().map(d=>d.id+d.p.join(','));o.held2=A.cur;o.slot2=A.inv.slot.slice();o.pool2={...A.inv.pool};
      G.story2.stop();o.bound2=A.bound;G.story4.start();${STEP}o.slot4=A.inv.slot.slice();o.n4=A.drops.list.length;G.story4.stop();o.bound4=A.bound;o.errs=G.errors;return o;})()`);
    say(r.held === 'm134' && r.held2 === 'akm' && r.slot2.join() === 'akm,,,' && r.s2a.join() !== r.s2b.join() && r.slot4.join() === 'k2c1,,,' && r.bound2 === false && r.bound4 === false && !r.errs.length && !logs.length,
      'retry resets kit + new layout, stop unbinds: ' + JSON.stringify(r));
    await p.close();
  }

  await b.close();
  console.log(bad ? `${bad} FAIL` : 'ALL PASS');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
