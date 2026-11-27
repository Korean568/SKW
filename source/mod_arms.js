'use strict';
/* ARMS — 스토리 1·2·4 공용 무기 엔진: 11종 표 · 4칸 인벤토리 · 구경별 탄약 · 사격 모드 · 히트스캔 · RPG-7 로켓 · M134 회전 · 조준/배율 겹침 ·
   바닥 드랍(반짝임 · ▼ 표지 · E 줍기 · 교체) · 스토리 잠금(bind/allow/busyE/present) · 테스트 훅(wep · arms=all · drops=all · dbg · D) */
{
  const R=Math.random,{sin,cos,tan,atan,atan2,hypot,min,max,abs,PI,sqrt}=Math,cl=G.clamp;
  const v3=(a,b,s=1)=>[a[0]+b[0]*s,a[1]+b[1]*s,a[2]+b[2]*s],nrm=a=>{const l=hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l];};
  const fwd=(y,p)=>[sin(y)*cos(p),sin(p),cos(y)*cos(p)];
  const PP=()=>G.people||{};

  /* ── 무기 표 (§1b): slot P 주무기 · S 보조 · H 중화기 · md 사격 모드 · sp 비조준 퍼짐 · ad 조준 시 퍼짐 배율 · fv 조준 시야 배율 · zm 광학 배율 · ov 겹침 ·
        sc T 스코프(1 장착 가능 · 2 일체형 · 0 불가) · tr 예광탄 간격 · fl 섬광 · pk 바닥 줍기(장전+예비) · ch 약실 +1 · fb 모델 없을 때 대체 총 ── */
  const W={};
  const def=(id,n,sh,o)=>W[id]=Object.assign({id,n,sh,slot:'P',cal:'556',mag:30,rate:.075,md:['auto','burst','semi'],dmg:40,sp:.013,ad:.3,kick:.02,rl:2,fv:.8,zm:1,ov:'',mv:1,pk:[30,60],sc:1,tr:1,fl:.02,snd:'r556',cls:'rifle',fb:'rifle',ch:1},o);
  def('k2','K2 소총','K2',{rate:.08,sp:.014,kick:.021,rl:2.1});
  def('k2c1','K2C1 소총','K2C1',{kick:.018});
  def('k2c','K2C 카빈','K2C',{rate:.072,dmg:37,sp:.012,ad:.26,kick:.017,rl:1.9,fv:.72,mv:1.03,dot:1,as:1.3,snd:'r556c'});
  def('k2a','K2A 소총','K2A',{sp:.012,kick:.019,rl:1.9});
  def('m16','M16 소총','M16',{rate:.07,md:['burst','semi'],dmg:44,sp:.01,ad:.25,kick:.019,rl:2.2,fv:.74,mv:.97,snd:'r556l'});
  def('aug','AUG A1 소총','AUG',{rate:.085,md:['auto','semi'],sp:.011,ad:.22,kick:.016,rl:2.6,zm:1.5,ov:'ring',sc:2,cls:'bullpup',snd:'r556b'});
  def('akm','AKM 소총','AKM',{cal:'762r',rate:.1,md:['auto','semi'],dmg:46,sp:.016,kick:.024,rl:2.3,mv:.98,snd:'r762',fb:'ak'});
  def('k14','K14 저격소총','K14',{cal:'762n',mag:5,rate:1.25,md:['bolt'],dmg:150,sp:.05,ad:.016,kick:.09,rl:3,zm:6,ov:'scope',sc:2,mv:.9,pk:[5,10],fl:.015,snd:'k14',pen:1});
  def('k7','K7 기관단총','K7',{slot:'S',cal:'9',rate:.06,dmg:26,sp:.011,ad:.45,kick:.012,rl:1.8,fv:.85,mv:1.06,sc:0,tr:0,fl:.008,snd:'smg9s',cls:'smg',fb:'pistol',quiet:1});
  def('k5','K5 권총','K5',{slot:'S',cal:'9',mag:13,rate:.17,md:['semi'],dmg:36,sp:.01,ad:.4,kick:.03,rl:1.4,fv:.85,mv:1.08,sc:0,snd:'pistol',cls:'pistol',fb:'pistol'});
  def('rpg7','RPG-7','RPG-7',{slot:'H',cal:'rkt',mag:1,rate:.6,md:['single'],sp:.006,ad:.5,kick:.12,rl:4,zm:2.7,ov:'pgo',sc:2,mv:.85,pk:[1,4],fl:0,snd:'rpgl',cls:'shoulder',ch:0});
  def('m134','M134 미니건','M134',{slot:'H',cal:'762n',mag:500,rate:.02,md:['spin'],dmg:22,sp:.022,ad:1,kick:.006,rl:6,mv:.55,pk:[500,300],sc:0,tr:3,fl:.03,snd:'',cls:'hip',ch:0,noads:1});
  const CAP={556:240,'762r':240,'762n':300,9:150,rkt:4}; // 예비 탄약 상한 (구경 공용)
  const MODE={auto:'연사',burst:'점사',semi:'단발',bolt:'볼트',single:'단발',spin:'연사'};
  const SLOTS={P:[0,2],S:[1],H:[3]},HEAVY=id=>W[id]&&W[id].slot==='H';
  const ON={free:1,fire:1,ads:1,sw:1,use:1,rl:1},OFF={free:0,fire:0,ads:0,sw:0,use:0,rl:0};
  const ID=Object.keys(W).filter(k=>k!=='k5'); // 바닥에 놓이는 11종
  const OV0={pgo:.3,ring:.45}; // 겹침이 시작되는 조준 정도 (기본 .6)

  /* ── 상태 ── */
  const inv={slot:[null,null,null,null],cur:0,mag:{},pool:{},mode:{},scope:{},last:{P:0,S:1,H:3}};
  const st={cd:0,rl:0,rc:0,rlT:1,sw:0,swT:.45,bn:0,trig:0,cyc:0,spin:0,spa:0,acc:0,ft:0,spr:0,kick:0,ads:0,so:0,shake:0,lf:'',lfT:-9,br:2,brk:0,lt:0,dryT:0,note:'',noteT:0,msg:'',msgT:0,e0:0,k0:{},sT0:0};
  const view={fovK:1,zoom:1,ov:'',ovA:0,kick:0,hide:0,sens:1,mv:1,ads:0,lock:0,scope:0,nosprint:0};
  const inp={fire:0,ads:0,rl:0,use:0,mode:0,scope:0,slot:0,wh:0,breath:0};
  const D={shots:0,hits:0,blasts:0,selfHits:0,blocked:0,bb:0,unarmed:0,dry:0,spinUp:0,maxRays:0,autoRl:0,kw:{},rounds:{},drops:0};
  const rk={on:0,p:[0,0,0],v:[0,0,0],t:0,d:0,prop:null};
  const ms={l:0,r:0,wh:0};
  let A=null,T=0,ui={},pres=null,hudT=0,mkT=0,mkL=[],pz=0;

  const props=()=>Array.isArray(PP().props)?PP().props:(api._props||(api._props=[]));
  const cur=()=>inv.slot[inv.cur];
  const fpOff=()=>{const f=PP().fp;return!!f&&f.on===0&&!f.hide;}; // 1인칭 모델 꺼짐 (컷신) — 스코프로 숨긴 것은 제외
  const mkey=id=>{const gm=G.gunModels;return gm&&gm[id]&&Array.isArray(PP().props)?id:W[id]?W[id].fb:id;}; // 모델 없으면 'ak'/'rifle'/'pistol'
  const addPool=(c,n)=>{const h=inv.pool[c]|0,v=min(CAP[c],h+max(0,n));inv.pool[c]=v;return v-h;};
  const scoped=id=>W[id].sc===1&&inv.scope[id]; // T 로 단 스코프
  const zoomOf=id=>{const w=W[id];return scoped(id)?3.5:w.zm;};
  const ovOf=id=>scoped(id)?'scope':W[id].ov;
  const gain=it=>{const c=W[it.id].cal;return inv.slot.includes(it.id)?max(0,min(it.loaded+it.res,CAP[c]-(inv.pool[c]|0))):-1;}; // 'own' 줍기로 실제 늘 탄약 (-1: 없는 총)
  const say=(t,d=1.5)=>{st.msg=t;st.msgT=T+d;};
  const note=t=>{if(T>st.noteT-.5){st.note=t;st.noteT=T+1.5;}}; // 1.5초 · 연타 제한
  const snd=(n,o)=>n&&G.sfx?G.sfx.play(n,o||{}):null;
  const rlCut=()=>{st.rv&&G.sfx&&G.sfx.stop&&G.sfx.stop(st.rv);st.rv=null;}; // 재장전이 끊기면 그 소리도 (탄띠 5초 · 로켓 3초)

  /* ── 인벤토리 ── */
  function reset(){
    inv.slot=[null,null,null,null];inv.cur=0;inv.mag={};inv.pool={};inv.mode={};inv.scope={};inv.last={P:0,S:1,H:3};
    Object.assign(st,{cd:0,rl:0,rh:0,sw:0,bn:0,trig:0,cyc:0,spin:0,acc:0,ft:0,spr:0,kick:0,ads:0,so:0,shake:0,lf:'',lfT:-9,br:2,brk:0,note:'',noteT:0,msg:'',msgT:0});
    rocketOff();sndOff();rlCut();
  }
  function canTake(id){ // 'own' 탄약만 · 'free' 빈 칸 · 'swap' 교체
    if(inv.slot.includes(id))return'own';
    return SLOTS[W[id].slot].some(i=>!inv.slot[i])?'free':'swap';
  }
  function take(id,loaded,res){ // 줍기 규칙 §3.7: 손에 든 총은 바뀌지 않는다 (교체할 때만)
    const w=W[id];if(!w)return'';
    if(inv.slot.includes(id)){addPool(w.cal,loaded+res);snd('pick');return'own';}
    const ss=SLOTS[w.slot],fr=ss.find(i=>!inv.slot[i]);
    let s=fr,r='free';
    if(fr==null){ // 칸이 차 있음: 손에 든 같은 분류 총, 아니면 마지막에 쓴 총과 교체 → 발밑에 떨어뜨림 (장전 수 유지)
      s=ss.includes(inv.cur)?inv.cur:ss.includes(inv.last[w.slot])?inv.last[w.slot]:ss[0];
      dropGun(inv.slot[s]);r='swap';
      if(s===inv.cur){rlCut();st.sw=st.swT=.4;st.rl=0;st.cd=.4;st.spin=0;st.bn=0;st.cyc=0;st.ft=0;} // 손의 총 상태(노리쇠 · 회전)는 새 총으로 넘어가지 않음
    }
    inv.slot[s]=id;inv.mag[id]=loaded;inv.mode[id]=0;inv.scope[id]=0;addPool(w.cal,res);
    if(r==='free')say(`${w.n} 획득 — [${s+1}] 으로 교체`,2.5);
    snd(r==='swap'?'swap':'pick');return r;
  }
  function dropGun(id){
    if(!id||!A)return;
    const me=A.me(),y=me.yaw||0,p=[me.p[0]-cos(y)*.3+sin(y)*.25,me.p[1],me.p[2]+sin(y)*.3+cos(y)*.25];
    p[1]=A.ground(p[0],p[2],me.p[1]);
    add(id,p,y+1.2+R(),inv.mag[id]|0,0,{pl:1});delete inv.mag[id];
  }
  function give(id,full){ // 테스트: 그 칸에 넣고 손에 든다
    const w=W[id];if(!w)return;
    const ss=SLOTS[w.slot];let s=inv.slot.indexOf(id);
    if(s<0){s=ss.find(i=>!inv.slot[i]);if(s==null)s=ss[ss.length-1];}
    inv.slot[s]=id;inv.mag[id]=w.mag;inv.mode[id]=0;inv.scope[id]=0;addPool(w.cal,full?CAP[w.cal]:w.pk[1]);
    inv.cur=s;inv.last[w.slot]=s;
  }
  function kit(story){ // 스토리 시작 장비 (스토리 사이 이월 없음)
    reset();
    const K={1:[['k2c1',30,120],['k7',30,60]],2:[['akm',30,90]],4:[['k2c1',30,120]]}[story]||[];
    for(const[id,m,r]of K){const s=SLOTS[W[id].slot].find(i=>!inv.slot[i]);inv.slot[s]=id;inv.mag[id]=m;inv.mode[id]=0;inv.scope[id]=0;addPool(W[id].cal,r);}
    inv.cur=max(0,inv.slot.findIndex(Boolean));
    if(G.params.get('arms')==='all'){for(const id of['k2c1','k7','akm','rpg7']){const s=SLOTS[W[id].slot].find(i=>!inv.slot[i]);if(s!=null&&!inv.slot.includes(id)){inv.slot[s]=id;inv.mag[id]=W[id].mag;inv.mode[id]=0;inv.scope[id]=0;}}for(const c in CAP)inv.pool[c]=CAP[c];}
    const wp=G.params.get('wep');W[wp]&&give(wp,0);
    st.msg='';
  }
  function sw(s){ // 1~4 칸 교체 (빈 칸 무시) · 중화기는 .9초
    const id=inv.slot[s];if(!id||s===inv.cur)return;
    const t=HEAVY(id)||HEAVY(cur())?.9:.45;
    rlCut();inv.cur=s;inv.last[W[id].slot]=s;Object.assign(st,{rl:0,cd:t,sw:t,swT:t,bn:0,cyc:0,spin:0,ft:0});snd('swap',{gain:.6});
  }
  function cycle(dir){const n=inv.slot.length;for(let k=1;k<n;k++){const s=(inv.cur+dir*k+n*4)%n;if(inv.slot[s])return sw(s);}}
  function reload(){
    const id=cur();if(!id)return;const w=W[id],m=inv.mag[id]|0,p=inv.pool[w.cal]|0;
    if(st.rl>0||st.sw>0||p<=0||m>=w.mag+(w.ch&&m>0?1:0))return;
    st.rc=w.ch&&m>0?1:0;st.rl=st.rlT=w.rl;st.bn=0;st.cyc=0;st.rv=id==='m134'?snd('rlb'):id==='rpg7'?snd('rlr'):snd('reload',{span:w.rl*1.2}); // 탄창에 남아 있으면 약실 +1 · 탄띠 6초 · 로켓 4초 · 탄창 소리는 재장전 시간에 맞춰 늘림 (마지막 '장전'이 .84 지점)
  }
  function reloadDone(){
    const id=cur(),w=W[id],m=inv.mag[id]|0,n=min(w.mag+(st.rc?1:0)-m,inv.pool[w.cal]|0);
    inv.mag[id]=m+max(0,n);inv.pool[w.cal]-=max(0,n);st.rl=0;st.rv=null;st.rh=1; // R 을 누르고 있어도 다시 장전하지 않음 (떼야 다음)
  }

  /* ── 사격 ── */
  function spread(){
    const id=cur();if(!id||!A)return .02;const w=W[id],me=A.me();
    let s=w.sp*(1+(me.mv||0)*.5+(me.run?2:0)+(me.air?2:0))*(1-(me.cr||0)*.3)+st.spr+(id==='m134'&&st.ft>2?.01:0);
    const k=scoped(id)?min(w.ad,.08):w.ad;
    return s*(1-st.ads*(1-k));
  }
  const ray=(o,d,t)=>A.ray?A.ray(o,d,t):PP().ray?PP().ray(o,d,t):null;
  function muzzle(eye,f,up){
    if(st.so>.3||!PP().muzzle)return v3(v3(eye,f,.5),up,-.08); // 겹침: 시점 아래
    const m=PP().muzzle(PP().fp);return[m[0],m[1],m[2]];
  }
  function recoil(w,id){
    const me=A.me(),bip=id==='k14'&&(me.cr||0)>.5&&(me.mv||0)<.3?.5:1,k=w.kick*(st.ads>.5?(scoped(id)||w.zm>1?.4:.6):1)*bip*(id==='m134'?R()-.4:1),dy=(R()-.5)*w.kick*.7;
    if(A.recoil)A.recoil(k,dy);else{me.pit=min(1.2,(me.pit||0)+k);me.yaw=(me.yaw||0)+dy;}
  }
  function shoot(id,rays=1){ // 한 발 (M134 는 프레임당 광선 4개까지)
    const w=W[id];inv.mag[id]--;st.kick=1;D.shots++;D.rounds[id]=(D.rounds[id]||0)+1;st.lf=id;st.lfT=T;
    const eye=A.eye(),f=A.fwd(),rt=nrm(V3.cross(f,[0,1,0])),up=V3.cross(rt,f);
    st.spr=min(st.spr+w.sp*(id==='m134'?.2:1.4),.07);
    if(id==='rpg7')return launch(eye,f,up);
    recoil(w,id);
    const sp=spread(),a=R()*2*PI,r=sp*sqrt(R()),d=nrm(v3(v3(f,rt,cos(a)*r),up,sin(a)*r));
    const mo=muzzle(eye,f,up);
    if(w.fl&&(id!=='m134'||D.shots%2))G.fx.burst('muzzle',mo,{size:w.fl,dir:d});
    if(id==='m134'){if(T>st.lt){st.lt=T+.05;G.addLight(v3(eye,f,.9),[1,.75,.42],2.6,4,.06);}} // M134: 탄마다가 아니라 빛 하나를 계속 갱신 (R14)
    else{G.addLight(v3(eye,f,.9),[1,.78,.45],w.quiet?.66:2.2,4,.05);snd(w.snd,{gain:w.quiet?.35:1});}
    if(!rays){if(w.tr&&D.shots%w.tr===0)G.fx.tracer(mo,d,380,.01);return;}
    const t=A.solid(eye,d,150);let h=ray(eye,d,t),end=h?h.t:t;
    if(h){
      hitP(id,w,h,eye,d);
      if(w.pen){ // K14: 한 명 관통
        const o2=v3(eye,d,h.t+.35),h2=ray(o2,d,max(0,t-h.t-.35));
        if(h2){h2.t+=h.t+.35;hitP(id,w,h2,eye,d);end=h2.t;}
      }
    }else if(t<150){const hp=v3(eye,d,t);G.fx.burst('hit',hp,{size:.14});G.fx.burst('smoke',hp,{size:.04});}
    if(w.tr&&(id!=='m134'||D.shots%3===0))G.fx.tracer(mo,nrm(V3.sub(v3(eye,d,end),mo)),380,.01);
  }
  function hitP(id,w,h,eye,d){
    const hp=v3(eye,d,h.t);G.fx.burst('hit',hp,{size:.1});D.hits++;
    if(A.hits!=='enemy'||!A.onHit)return;
    const k=A.onHit(h.P,h.part,w.dmg*(w.quiet&&h.t>30?.65:1),hp,d);
    if(k===2)D.kw[id]=(D.kw[id]||0)+1;
  }

  /* ── RPG-7 로켓 (§3.4) ── */
  function launch(eye,f,up){
    const w=W.rpg7,mo=muzzle(eye,f,up);recoil(w,'rpg7');
    Object.assign(rk,{on:1,p:mo,v:V3.mul(f,60),t:0,d:0});
    rk.prop={id:mkey('rpg7')==='rpg7'?'rpg7r':'',M:M4.fromDir(mo,f),vis:!!G.gunModels&&mkey('rpg7')==='rpg7',spin:0,loaded:1,_arms:1};props().push(rk.prop);
    G.fx.burst('launch',mo,{size:.4,dir:f});G.fx.burst('smoke',v3(eye,f,-2),{size:.5});G.addLight(mo,[1,.7,.4],8,6,.12);
    snd('rpgl');st.shake=max(st.shake,.5);
    if(A.solid(eye,V3.mul(f,-1),1.5)<1.5){D.bb++;st.shake=1;A.hurtSelf&&A.hurtSelf(25,0);G.fx.burst('smoke',v3(eye,f,-.8),{size:.6});} // 뒤 1.5 m 벽: 후폭풍
  }
  function rocketOff(){if(rk.prop){const L=props(),i=L.indexOf(rk.prop);i>=0&&L.splice(i,1);}rk.prop=null;rk.on=0;G.sfx&&G.sfx.loop('rocket',0);}
  function rocket(dt){
    if(!rk.on)return;
    const ns=min(6,Math.ceil(dt/.02)),h=dt/ns;
    for(let n=0;n<ns&&rk.on;n++){
      rk.t+=h;const sp=hypot(...rk.v),u=V3.mul(rk.v,1/sp);
      if(rk.t>.12&&sp<150)rk.v=v3(rk.v,u,min(150-sp,237*h)); // 모터 점화 (0.12초) → 0.5초에 150 m/s
      rk.v[1]-=3*h;
      const L=hypot(...rk.v)*h,d=nrm(rk.v),t=A.solid(rk.p,d,L),hp=A.hits==='enemy'?ray(rk.p,d,t):null;
      if(hp)return impact(v3(rk.p,d,hp.t),hp);
      if(t<L)return impact(v3(rk.p,d,t),null);
      rk.p=v3(rk.p,d,L);rk.d+=L;
      if(rk.d>150)return impact(rk.p,null); // 150 m 자폭
    }
    G.fx.trail(rk.p,rk.v,'missile',dt);
    if(rk.prop){const m=M4.fromDir(rk.p,nrm(rk.v));rk.prop.M=m;}
    const c=G.cam.pos,k=cl(1-hypot(rk.p[0]-c[0],rk.p[2]-c[2])/150,0,1);G.sfx&&G.sfx.loop('rocket',1,{gain:max(.1,k),rate:k}); // 가까울수록 밝게
  }
  const blastF=d=>d<3.5?400-d*40:max(30,400*(1-d/7)**2); // 3.5 m 안 즉사권 · 7 m 까지 부상
  function impact(p,h){
    const armed=rk.d>=5;rocketOff();
    if(!armed){ // 5 m 안: 신관 미작동 → 직격 120, 폭발 없음
      D.unarmed++;G.fx.burst('hit',p,{size:.3});G.fx.burst('smoke',p,{size:.3});
      if(h&&A.hits==='enemy'&&A.onHit&&A.onHit(h.P,'body',120,p,[0,0,1])===2)D.kw.rpg7=(D.kw.rpg7||0)+1;
      return;
    }
    D.blasts++;
    G.fx.burst('explosion',p,{size:.6});G.fx.burst('flash',p,{size:.6});G.addLight(p,[1,.55,.25],25,18,.25);
    const q=v3(p,[0,.3,0]);
    if(A.hits==='enemy'&&A.onBlast){const k=A.onBlast(q,7,blastF)|0;if(k)D.kw.rpg7=(D.kw.rpg7||0)+k;}
    const me=A.me(),c=v3(me.p,[0,1,0]),dd=hypot(c[0]-p[0],c[1]-p[1],c[2]-p[2]);
    snd(dd<60?'boom':'boomf',{pos:p});dd<5&&snd('ring',{gain:cl(1.6-dd/4,.4,1)}); // 60 m 밖은 먹먹한 폭음 · 아주 가까우면 귀울림
    st.shake=max(st.shake,cl(1.2-dd/25,0,1.2));
    if(dd<7&&A.hurtSelf){const dv=V3.sub(c,q),L=hypot(...dv);
      if(A.solid(q,nrm(dv),L)>=L-.15){D.selfHits++;dd<2.5?A.hurtSelf(100,1):A.hurtSelf(90-(dd-2.5)/4.5*80,0);}}
  }

  /* ── M134 루프 소리 ── */
  let lpS=0,lpF=0;
  function loops(spin,fire,live){ // 방아쇠가 잠긴 동안(스토리 2/4 · 방탄판 교체 · 전사)은 새로 켜지 않음 (이미 돌던 회전음은 스핀다운)
    if(!G.sfx||!G.sfx.loop)return;
    if(spin>.01&&(lpS||live)){G.sfx.loop('m134s',1,{rate:spin,gain:.55});lpS=1;}else if(lpS){G.sfx.loop('m134s',0);lpS=0;} // rate = 회전 (음높이 · 음량은 지속음 쪽에서)
    if(fire&&(lpF||live)){G.sfx.loop('m134f',1,{gain:.85});lpF=1;}else if(lpF){G.sfx.loop('m134f',0,{fade:.04});lpF=0;} // 사격 끝은 짧게
  }
  function sndOff(){lpS=lpF=0;if(G.sfx&&G.sfx.loop){G.sfx.loop('m134f',0,{fade:.04});G.sfx.loop('m134s',0);G.sfx.loop('rocket',0);}} // 정지 · 해제 · 처음 화면

  /* ── 입력 (장치 → inp; 봇은 inp 를 직접 채운다) ── */
  const kp={};
  const tapK=c=>{const v=!!G.keys[c];const r=v&&!kp[c];kp[c]=v;return r;};
  const edge=(k,v)=>{const r=v&&!st.k0[k];st.k0[k]=v;return r;};
  function readInput(){
    if(api.bot)return;
    const K=G.keys,locked=document.pointerLockElement===G.canvas;
    inp.fire=ms.l&&locked?1:0;inp.ads=ms.r?1:0;inp.rl=K.KeyR?1:0;inp.use=K.KeyE?1:0;inp.mode=K.KeyB?1:0;inp.scope=K.KeyT?1:0;
    inp.breath=K.ShiftLeft||K.ShiftRight?1:0;inp.slot=K.Digit1?1:K.Digit2?2:K.Digit3?3:K.Digit4?4:0;inp.wh=ms.wh;ms.wh=0;
  }

  /* ── 한 프레임 (스토리 update 에서, 플레이어 이동 다음에 호출) ── */
  function step(dt){
    if(!A)return;
    try{
      T+=dt;readInput();
      const al=A.allow()||ON,me=A.me(),id=cur(),w=id&&W[id],dead=!al.free;
      st.cd-=dt;st.sw=max(0,st.sw-dt);st.spr=max(0,st.spr-dt*.09);st.kick=max(0,st.kick-dt*7);st.shake=max(0,st.shake-dt*2.2);
      if(st.cyc>0){const c0=st.cyc;st.cyc=min(1,st.cyc+dt/.95);c0<.155&&st.cyc>=.155&&snd('bolt');st.cyc>=1&&(st.cyc=0);} // K14 노리쇠 소리: 사격 .15초 뒤 (같은 프레임 아님)
      // 교체 · 모드 · 스코프
      const sl=edge('slot',inp.slot)?inp.slot:0;
      if(al.sw&&!dead&&!pres){if(sl)sw(sl-1);if(inp.wh){cycle(inp.wh>0?1:-1);}}
      inp.wh=0;
      if(edge('mode',inp.mode)&&w&&al.sw&&!pres){if(w.md.length>1){inv.mode[id]=((inv.mode[id]|0)+1)%w.md.length;snd('mode');say(MODE[w.md[inv.mode[id]]],1);st.bn=0;}}
      if(edge('scope',inp.scope)&&w&&al.sw&&!pres&&st.rl<=0){
        if(w.sc===1){inv.scope[id]^=1;st.cd=st.sw=st.swT=.45;snd('click',{gain:1.4});}
        else say(w.sc===2?'조준경 일체형':`${w.n}에는 스코프를 달 수 없다`);
      }
      if(!w){pick(al,me);outView(dt,al,me);return;}
      // 재장전 (수동만)
      if(st.rl>0){st.rl-=dt;if(st.rl<=0)reloadDone();}
      if(!inp.rl)st.rh=0;if(inp.rl&&!st.rh&&al.rl&&!pres)reload(); // 교체 중에 누른 R 은 끝난 뒤 장전
      // 조준 (M134: 오른쪽 버튼 = 회전 유지)
      const adsOK=inp.ads&&al.ads&&!me.run&&st.rl<=0&&!w.noads&&!pres&&!fpOff();
      st.ads+=((adsOK?1:0)-st.ads)*min(1,dt*(zoomOf(id)>1?8:11)*(w.as||1));
      if(!al.ads||pres||fpOff())st.ads=0; // 조준 금지 · 1인칭 꺼짐 → 즉시 해제 (겹침도 꺼짐)
      const ov=ovOf(id);st.so=ov&&ov!=='dot'?cl((st.ads-(OV0[ov]??.6))*4,0,1):0; // 일체형 광학(PGO-7 · AUG)은 일찍: 시점이 모델 안으로 들어가기 전에 숨김
      // K14 숨 참기 · 흔들림 (양각대: 웅크리고 멈춤 → 없음)
      if(id==='k14'&&st.so>.5){
        const bip=(me.cr||0)>.5&&(me.mv||0)<.3,hold=inp.breath&&st.br>0&&!st.brk;
        if(hold)st.br-=dt;else{st.br=min(2,st.br+dt*.7);if(st.br<=0)st.brk=1;}
        if(!inp.breath)st.brk=0;
        const k=(bip?0:hold?.12:1)*(G.touch||document.documentElement.classList.contains('touch')?.6:1),
          sx=(sin(T*1.3)*.0045+sin(T*2.9)*.0015)*k,sy=(sin(T*.95+1)*.0035)*k,ds=[sx-(st.swx||0),sy-(st.swy||0)];
        st.swx=sx;st.swy=sy;if(A.recoil)A.recoil(ds[1],ds[0]);else{me.yaw+=ds[0];me.pit+=ds[1];}
      }
      // 방아쇠
      // 방아쇠: 조작 불가(!free: 컷신 · 전사 · 끝)는 소리 · 글자 없음 · 방탄판 교체(fire 0)는 그냥 안 나감 · 안전(스토리 2/4)은 딸깍 + 글자
      const press=edge('fire',inp.fire),safe=A.hits!=='enemy',live=!safe&&al.free&&al.fire&&!pres;
      if(press&&al.free&&(safe||pres)){D.blocked++;D.dry++;snd('dry');note('지금은 쏠 수 없다');}
      const busy=st.rl>0||st.sw>0||st.cyc>0||me.run;
      let firing=0;
      if(id==='m134'){
        const want=(inp.fire||inp.ads)&&live&&st.rl<=0&&st.sw<=0;
        if(want&&st.spin===0)st.sT0=T;
        st.spin=want?min(1,st.spin+dt/.5):max(0,st.spin-dt/1.2);
        if(want&&st.spin>=1&&!D.spinUp)D.spinUp=T-st.sT0;
        st.spa+=st.spin*40*dt;
        if(inp.fire&&live&&st.spin>=1&&st.rl<=0){
          if((inv.mag[id]|0)<=0){if((st.dryT-=dt)<=0){st.dryT=.18;snd('dry',{rate:1.3,gain:.5});D.dry++;}}
          else{st.acc+=dt;let n=0;while(st.acc>=w.rate&&inv.mag[id]>0){st.acc-=w.rate;shoot(id,n<4?1:0);n++;}D.maxRays=max(D.maxRays,min(n,4));firing=1;st.ft+=dt;st.shake=max(st.shake,.25);}
        }else{st.acc=0;st.ft=max(0,st.ft-dt*2);}
        loops(st.spin,firing&&inv.mag[id]>0,live);
      }else{
        loops(0,0);
        const md=w.md[inv.mode[id]|0],m=inv.mag[id]|0;
        if(live&&!busy&&!(id==='rpg7'&&rk.on)){
          if(md==='burst'&&press&&st.cd<=0&&st.bn<=0)st.bn=3;
          const want=md==='auto'?inp.fire:md==='burst'?st.bn>0:press;
          if(want&&st.cd<=0){
            if(m<=0){snd('dry');st.cd=.3;st.bn=0;D.dry++;} // 빈 탄창: 딸깍 (자동 재장전 없음)
            else{
              shoot(id);st.cd=w.rate;firing=1;
              if(md==='burst'){st.bn--;if(st.bn<=0)st.cd=max(w.rate,.3);}
              if(md==='bolt')st.cyc=.001; // 노리쇠 조작 .95초 (사격의 일부) · 소리는 .15초 뒤
            }
          }
        }
        if(!inp.fire&&md!=='burst')st.bn=0;
      }
      rocket(dt);
      pick(al,me);
      outView(dt,al,me,firing);
    }catch(e){G.err('arms: '+(e.stack||e));}
  }

  /* ── 시점 · 1인칭 모델 출력 (§3.2 R10) ── */
  function outView(dt,al,me,firing){
    const id=cur(),fp=PP().fp,base=1.13,shown=pres||id;
    const z=id&&!pres?1+(zoomOf(id)-1)*st.ads:1;
    view.zoom=z;view.ads=st.ads;view.ov=id&&!pres?ovOf(id):'';view.ovA=st.so;view.hide=st.so>.3?1:0;
    view.fovK=z>1.01?2*atan(tan(base/2)/z)/base:1-(1-(id?W[id].fv:1))*st.ads;
    view.sens=z>1.01?1/z:1-st.ads*.4;view.mv=id?W[id].mv:1;view.nosprint=id==='m134'?1:0;
    view.kick=st.kick*.012+(st.shake>0?(R()-.5)*st.shake*.02:0);view.lock=A&&(A.hits!=='enemy'||!al.fire)?1:0;view.scope=id&&scoped(id)?1:0;
    if(!fp||!shown)return;
    const w=W[shown]||W[id];
    fp.gun=mkey(shown);fp.aim=pres?0:st.ads;fp.kick=st.kick;fp.hide=view.hide;fp.scope=!pres&&view.scope?1:0;
    fp.reload=pres?0:st.rl>0?1-st.rl/st.rlT:st.sw>0?1-st.sw/st.swT:0;
    fp.cyc=id==='k14'&&!pres?st.cyc:0;fp.spin=id==='m134'&&!pres?st.spa:0;fp.loaded=shown==='rpg7'?(inv.mag.rpg7|0)>0&&!rk.on||pres?1:0:1;
    fp.bip=id==='k14'&&(me.cr||0)>.5&&(me.mv||0)<.3?1:0;fp.dot=shown==='k2c'&&!view.scope?1:0;fp.fire=firing?1:0;fp.lower=0;
  }

  /* ── 바닥 드랍 (§4.1) ── */
  const drops={list:[],near:null,scatter,add,clear,all:dropAll};
  function dmat(it){
    const L=M4.trs([0,.035,0],it.yaw,0,it.roll),F=it.F?Float32Array.from(it.F):M4.trs(it.p);
    if(it.F){F[12]=it.p[0];F[13]=it.p[1];F[14]=it.p[2];}
    return M4.mul(F,L);
  }
  function add(id,p,yaw,loaded,res,o={}){
    const it={id,p:p.slice(),yaw,roll:o.roll??(R()<.5?1:-1)*PI/2,loaded,res,pl:o.pl?1:0,F:o.F||(A&&A.frame?A.frame(p):null),seen:0};
    it.M=dmat(it);it.prop={id:mkey(id),M:it.M,vis:true,spin:0,loaded:id!=='rpg7'||loaded>0?1:0,bip:0,_arms:1};
    props().push(it.prop);drops.list.push(it);
    if(drops.list.length>24){const o2=drops.list.find(x=>x.pl&&x!==it);o2&&remove(o2);}
    return it;
  }
  function remove(it){const L=props(),i=L.indexOf(it.prop);i>=0&&L.splice(i,1);const j=drops.list.indexOf(it);j>=0&&drops.list.splice(j,1);}
  function clear(){for(const it of drops.list.slice())remove(it);drops.list.length=0;drops.near=null;const L=props();for(let i=L.length-1;i>=0;i--)L[i]._arms&&L.splice(i,1);}
  function pickW(tab,cnt,caps,heavy){
    const ok=Object.keys(tab).filter(k=>W[k]&&tab[k]>0&&(cnt[k]|0)<(caps[k]??99)&&!(HEAVY(k)&&heavy.n>=heavy.cap));
    let s=0;for(const k of ok)s+=tab[k];let r=R()*s;
    for(const k of ok)if((r-=tab[k])<0)return k;return ok[ok.length-1];
  }
  const segD=(p,a,b)=>{const dx=b[0]-a[0],dz=b[2]-a[2],L=dx*dx+dz*dz||1,t=cl(((p[0]-a[0])*dx+(p[2]-a[2])*dz)/L,0,1);return hypot(p[0]-a[0]-dx*t,p[2]-a[2]-dz*t);};
  function okPt(p,o,acc,gap){
    if(!A)return 0;
    const q=A.collide(p.slice(),.3);if(hypot(q[0]-p[0],q[2]-p[2])>.03)return 0;
    for(const[x,z]of[[.3,.3],[-.3,.3],[.3,-.3],[-.3,-.3]])if(abs(A.ground(p[0]+x,p[2]+z,p[1])-p[1])>=.25)return 0;
    for(const a of acc)if(hypot(a.p[0]-p[0],a.p[2]-p[2])<gap)return 0;
    for(const it of drops.list)if(hypot(it.p[0]-p[0],it.p[2]-p[2])<gap)return 0;
    for(const a of o.away||[])if(hypot(a[0]-p[0],a[2]-p[2])<a[3])return 0;
    for(const s of o.path||[])if(segD(p,s[0],s[1])<(s[2]||.8))return 0;
    return !o.ok||o.ok(p);
  }
  function scatter(cands,n,tab,o={}){ // 후보를 섞어 검사를 통과한 자리에 n 개 (표의 가중치 · 상한 · 중화기 1개)
    const c=cands.slice(),acc=[],cnt=o.cnt||{},caps=Object.assign({k14:1},o.caps),heavy=o.hs||{n:0,cap:o.heavy??1},gap=o.gap||2.5; // cnt · hs 를 넘기면 여러 번 뿌려도 상한 공유
    for(let i=c.length-1;i>0;i--){const j=(R()*(i+1))|0;[c[i],c[j]]=[c[j],c[i]];}
    for(const q of c){
      if(acc.length>=n)break;
      const p=[q[0],q[1]??A.ground(q[0],q[2]),q[2]];
      if(!okPt(p,o,acc,gap))continue;
      const id=pickW(tab,cnt,caps,heavy);if(!id)break;
      cnt[id]=(cnt[id]|0)+1;HEAVY(id)&&heavy.n++;
      acc.push(add(id,p,o.yaw?o.yaw(p):R()*2*PI,W[id].pk[0],W[id].pk[1],{F:o.frame?o.frame(p):null})); // o.yaw: 좁은 통로에서는 통로 방향으로
    }
    D.drops=drops.list.length;return acc;
  }
  function dropAll(){ // ?drops=all: 11종을 플레이어 둘레에 하나씩 — 벽 안 · 사람 1.2 m 안은 건너뜀 (자리가 없으면 그 총은 생략)
    if(!A)return;const me=A.me(),L=PP().list||[],away=[...(A.people()||[]),...L.map(P=>P.M?M4.point(P.M,P.p):P.p)].map(q=>[q[0],0,q[2],1.2]);let k=0;
    for(const id of ID){
      let p=null;
      for(let t=0;t<60&&!p;t++){const a=k*.57+t*.9,r=1.4+((k+t)%4)*.55+(t/12|0)*.6,x=me.p[0]+sin(a)*r,z=me.p[2]+cos(a)*r,q=[x,A.ground(x,z,me.p[1]),z];if(okPt(q,{away},[],.5))p=q;}
      p&&add(id,p,R()*2*PI,W[id].pk[0],W[id].pk[1]);k++;
    }
    D.drops=drops.list.length;
  }

  /* ── 줍기 (E 만 · 밟아서 줍지 않음) · 표지 ── */
  function pick(al,me){
    const e0=edge('use',inp.use);
    let near=null,nd=1.8;
    if(!pres&&al.use&&al.free&&!(A.busyE&&A.busyE())){
      const f=A.fwd(),fl=hypot(f[0],f[2])||1;
      for(const it of drops.list){
        const dx=it.p[0]-me.p[0],dz=it.p[2]-me.p[2],d=hypot(dx,dz);
        if(d>=nd||abs(it.p[1]-me.p[1])>1.3)continue;
        if(d>.8&&(dx*f[0]+dz*f[2])/(d*fl)<.82)continue; // 시야 35° 안 (발밑 0.8 m 는 언제나)
        if(!gain(it)||!seen(it,me))continue; // 탄약이 가득 찬 같은 총 · 벽 너머 총은 안내 · 줍기 없음
        nd=d;near=it;
      }
    }
    drops.near=near;
    if(near&&e0){
      const k=gain(near),r=take(near.id,near.loaded,near.res);remove(near);drops.near=null;
      if(r==='own')say(`${W[near.id].n} 탄약 +${k}`,1.5);
    }
  }
  function seen(it,me){ // 눈높이 · 무릎 높이 선이 둘 다 막히면 숨은 총 (벽 · 좌석 등받이 · 잔해 너머) — 낮은 턱 아래 총은 무릎 선으로 보임
    const t=v3(it.p,[0,.1,0]);
    for(const o of[A.eye(),v3(me.p,[0,.3,0])]){const dv=V3.sub(t,o),l=hypot(...dv);if(A.solid(o,nrm(dv),l)>=l-.3)return 1;}
    return 0;
  }
  function promptText(){
    const id=cur(),w=id&&W[id],m=id?inv.mag[id]|0:0,p=w?inv.pool[w.cal]|0:0;
    if(T<st.noteT)return st.note;
    const n=drops.near;
    if(n){const c=canTake(n.id),N=W[n.id].n;return c==='own'?`[E] ${N} 탄약 줍기 (+${gain(n)})`:c==='free'?`[E] ${N} 줍기`:`[E] ${N}(으)로 바꾸기`;}
    if(T<st.msgT)return st.msg;
    if(!w||pres)return'';
    if(st.rl>0)return'재장전 중…';
    if(id==='m134'&&m===0)return p?'탄띠 교체 [R]':'탄약 없음';
    if(id==='rpg7')return m||rk.on?'':p?'[R] 재장전':'로켓 없음';
    if(m===0)return p?'[R] 재장전':'탄약 없음';
    if(m<=w.mag/4&&w.mag>1&&p)return'[R] 재장전';
    if(id==='k14'&&st.so>.5&&st.br>.2&&!inp.breath)return'숨 참기 [Shift]';
    return'';
  }
  function hudHTML(){ // 각 조각은 따로 된 요소 (i18n 은 글자 노드 단위)
    const id=cur();if(!id)return'';
    const w=W[id],m=inv.mag[id]|0,p=inv.pool[w.cal]|0,md=w.md[inv.mode[id]|0];
    let s=`<b>${m}</b> / ${p}<small><span>${w.n}</span>`;
    if(w.md.length>1||md==='bolt')s+=`<span>${MODE[md]}</span>`;
    if(scoped(id))s+=`<span>${G.i18n&&!G.i18n.D.has('스코프 장착')?'스코프':'스코프 장착'}</span>`; // HUD 전용 키 (터치 버튼 '스코프'→'SCOPE' 와 구분) — 영어 사전에 없으면 예전 키
    s+='</small>';
    if(id==='m134')s+=`<em><span>탄띠</span>${st.spin>.05?`<span>회전 중</span> ${'▮'.repeat(1+st.spin*4|0)}`:''}</em>`;
    else if(id==='rpg7')s+=`<em><span>로켓</span> ${m} / ${p}</em>`;
    s+='<u>'+inv.slot.map((k,i)=>`<i${i===inv.cur?' class=on':''}>${i+1} ${k?W[k].sh:'—'}</i>`).join('')+'</u>';
    return s;
  }
  function markers(){ // ▼ 표지: 6 m 안 · 시야 안 · 가려지지 않은 것 3개까지
    const on=A&&!pres&&(A.allow()||ON).free&&!fpOff()&&!drops.near&&!(A.busyE&&A.busyE());let j=0; // E 안내가 떠 있으면 표지 없음 (안내 상자와 겹침)
    if(on){
      const me=A.me(),eye=A.eye(),chk=T>mkT;if(chk)mkT=T+.2;
      const L=drops.list.map(it=>[hypot(it.p[0]-me.p[0],it.p[2]-me.p[2]),it]).filter(a=>a[0]<6).sort((a,b)=>a[0]-b[0]);
      for(const[d,it]of L){
        if(j>=ui.mk.length)break;
        const t=v3(it.p,[0,.1,0]),q=G.project(v3(t,[0,.2,0]));if(!q||q[2]<=0||q[0]<0||q[1]<0||q[0]>innerWidth||q[1]>innerHeight)continue;
        if(chk){const dv=V3.sub(t,eye),l=hypot(...dv);it.seen=A.solid(eye,nrm(dv),l)>=l-.25;}
        if(!it.seen)continue;
        const e=ui.mk[j++];e.style.display='block';e.style.transform=`translate(${q[0]|0}px,${q[1]|0}px)`;e.style.opacity=d<1.8?1:.85;
        if(e._t!==W[it.id].sh){e._t=W[it.id].sh;e.firstChild.textContent=e._t;}
      }
    }
    for(;j<(ui.mk||[]).length;j++)ui.mk[j].style.display='none';
  }
  function glint(){ // 바닥 총 반짝임 (스토리 3 의 단검 별과 같은 방식)
    if(!G.draw||!G.meshes||!G.meshes.wglint||!A)return;
    const c=G.cam.pos,F=innerHeight*.5/tan((G.cam.fov||1.1)*.5);
    for(const it of drops.list){
      const g=max(0,sin(G.time*1.9+it.yaw*5))**20*1.8;if(g<.06)continue;
      const p=M4.point(it.M,[0,.05,.06]),dd=hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2]);if(dd>40)continue;
      G.draw('wglint',M4.trs(p,G.time*3,.4,0,max(.02,5*dd/F)),[g,g,g,0]);
    }
  }
  function glintMesh(){
    const V=[],dia=(a,b)=>[[a,0],[0,b],[-a,0],[0,-b]];
    const tri=(a,b,c)=>{const e=V3.sub(b,a),f=V3.sub(c,a),n=V3.norm(V3.cross(e,f));for(const p of[a,b,c])V.push(p[0],p[1],p[2],n[0],n[1],n[2],1,.97,.9,2);};
    const loft=sc=>{for(let s=0;s<sc.length-1;s++){const[z0,P]=sc[s],[z1,Q]=sc[s+1];for(let i=0;i<4;i++){const j=(i+1)%4,a=[...P[i],z0],b=[...P[j],z0],c=[...Q[j],z1],d=[...Q[i],z1];tri(a,b,c);tri(a,c,d);tri(a,c,b);tri(a,d,c);}}};
    for(const[a,b]of[[1,.12],[.12,1]])loft([[-.12,dia(.0001,.0001)],[0,dia(a,b)],[.12,dia(.0001,.0001)]]);
    loft([[-1,dia(.0001,.0001)],[0,dia(.12,.12)],[1,dia(.0001,.0001)]]);
    return new Float32Array(V);
  }

  /* ── 바인딩 (스토리 어댑터 §3.2) ── */
  const DEF={story:0,eye:()=>G.cam.pos,fwd:()=>nrm(V3.sub(G.cam.target,G.cam.pos)),solid:(o,d,m)=>m,ground:()=>0,collide:p=>p,
    me:()=>({p:G.cam.pos,yaw:0,pit:0,mv:0,cr:0,run:0,air:0}),hits:'safe',onHit:null,onBlast:null,hurtSelf:null,allow:()=>ON,busyE:()=>false,people:()=>[],hud:'lite',ray:null,frame:null};
  function bind(o){clear();rocketOff();A=Object.assign({},DEF,o);pres=null; // 새 시작 = 새 바닥 배치
   st.k0={};for(const k in D)D[k]=typeof D[k]==='object'?{}:0;ui.wa&&(ui.wa.style.display='block');}
  function unbind(){clear();rocketOff();sndOff();rlCut();A=null;pres=null;st.ads=st.so=0;Object.assign(view,{fovK:1,zoom:1,ov:'',ovA:0,kick:0,hide:0,sens:1,mv:1,ads:0,lock:0,scope:0});
    const fp=PP().fp;if(fp){fp.hide=fp.scope=0;fp.cyc=fp.spin=fp.bip=fp.dot=fp.fire=0;fp.loaded=1;}ui.wa&&(ui.wa.style.display='none');}

  const api=G.arms={W,inv,inp,view,D,drops,CAP,MODE,ID,kit,bind,unbind,step,take,canTake,addPool,give,spread,cancel(){st.rl>0&&rlCut();st.rl=0;st.bn=0;},
    present(id){pres=id&&W[id]?id:null;if(pres){st.ads=st.so=0;}},
    hud:hudHTML,get prompt(){return A?promptText():'';},get quiet(){return!!(st.lf&&W[st.lf].quiet&&T-st.lfT<2);},
    get cur(){return cur();},get mag(){const id=cur();return id?inv.mag[id]|0:0;},get pool(){const id=cur();return id?inv.pool[W[id].cal]|0:0;},
    get rocket(){return rk.on?rk.p.slice():null;},get st(){return st;},get bound(){return!!A;},bot:false,
    dbg:{give:id=>give(id,1),state:()=>({slot:inv.slot.slice(),cur:inv.cur,id:cur(),mag:{...inv.mag},pool:{...inv.pool},mode:{...inv.mode},scope:{...inv.scope},rl:st.rl,sw:st.sw,cd:st.cd,spin:st.spin,ads:st.ads,cyc:st.cyc,rocket:!!rk.on,view:{...view}}),
      drops:()=>drops.list.map(i=>({id:i.id,p:i.p.map(v=>+v.toFixed(2)),loaded:i.loaded,res:i.res,pl:i.pl})),
      fire(n=1){const id=cur();let k=0;for(let i=0;i<n&&id&&(inv.mag[id]|0)>0;i++,k++)shoot(id);return k;},
      place(){clear();dropAll();return drops.list.length;},ad:()=>A}};

  G.register('arms',{
    init(){
      G.css(`#wa{position:absolute;inset:0;pointer-events:none;display:none;color:#fff;font-family:system-ui,'Malgun Gothic',sans-serif;text-shadow:0 1px 3px #000c}
#wa .ov{position:absolute;inset:0;opacity:0;z-index:-1}#wa .ov svg{position:absolute;left:50%;top:50%;width:84vmin;height:84vmin;margin:-42vmin}
#wsc{background:radial-gradient(circle,#38605010 0,#0000 22vmin,#0008 37vmin,#000 41vmin)}
#wrg{background:radial-gradient(circle,#0000 30vmin,#0006 46vmin,#000a 70vmin)}
#wpg{background:radial-gradient(circle,#2a2a1808 0,#0000 24vmin,#000a 36vmin,#000 40vmin)}
.wmk{position:absolute;left:-40px;top:-34px;width:80px;text-align:center;font:700 12px system-ui;display:none;color:#fe9;text-shadow:0 0 2px #000,0 1px 3px #000}.wmk:after{content:'▼';display:block;font-size:13px}
#wh{position:absolute;right:4vw;bottom:max(5vh,calc(2vh + 34px));text-align:right;font-size:16px;color:#cde;display:none}
#wh b,#am b{font-weight:700;color:#fff}#wh b{font-size:30px}#wh small,#am small{display:block;font-size:13px;letter-spacing:.12em;color:#9bc}
#wh small span+span:before,#am small span+span:before{content:' · '}#wh em,#am em{display:block;font:600 12px system-ui;color:#fc8;font-style:normal}#wh em span+span:before,#am em span+span:before{content:' · '}
#wh u,#am u{display:flex;gap:7px;justify-content:flex-end;margin-top:4px;text-decoration:none;font:600 12px system-ui;color:#fffc;text-shadow:0 0 2px #000,0 1px 3px #000}#wh u .on,#am u .on{color:#fe9;background:#000a;border-radius:3px;padding:0 3px}#wh u i,#am u i{font-style:normal}
#whp{position:absolute;left:50%;top:62%;transform:translateX(-50%);font-size:18px;color:#fe9;display:none;text-shadow:0 0 2px #000,0 1px 3px #000}`);
      ui.wa=G.el('div',{id:'wa'});
      const svg=b=>`<svg viewBox="-50 -50 100 100" stroke=#000 fill=none>${b}</svg>`;
      ui.sc=G.el('div',{id:'wsc',className:'ov',innerHTML:svg('<path d="M-50 0H50M0-50V50" stroke-width=.22 /><path d="M-25 0H25M0-25V25" stroke-width=1.3 stroke-dasharray="0 5" stroke-linecap=round /><path d="M-50 0H-30M30 0H50M0 30V50" stroke-width=1.4 /><circle r=49.5 stroke-width=1.5 stroke=#0008 />')},ui.wa); // 스코프: 밀도트 조준선
      ui.rg=G.el('div',{id:'wrg',className:'ov',innerHTML:svg('<circle r=7 stroke-width=.5 stroke=#111c /><circle r=.7 fill=#111c stroke=none />')},ui.wa); // AUG 1.5배: 링 · 점
      ui.pg=G.el('div',{id:'wpg',className:'ov',innerHTML:svg('<path d="M0-3V3M-3 0H3" stroke-width=.5 /><path d="M-2 6L0 4L2 6M-2 10L0 8L2 10M-2 14L0 12L2 14M-2 18L0 16L2 18" stroke-width=.5 stroke=#300 /><path d="M-22 0H-6M6 0H22M-18-1V1M-14-1V1M-10-1V1M10-1V1M14-1V1M18-1V1" stroke-width=.4 /><circle r=49.5 stroke-width=1.5 stroke=#0008 />')},ui.wa); // PGO-7: 거리 갈매기표 · 편차 눈금
      ui.mk=[0,1,2].map(()=>{const e=G.el('div',{className:'wmk'},ui.wa);G.el('span',{},e);return e;});
      ui.wh=G.el('div',{id:'wh'},ui.wa);ui.whp=G.el('div',{id:'whp'},ui.wa);ui.whp.dataset.k='KeyE';
      try{G.addMesh&&G.addMesh('wglint',glintMesh());}catch(e){G.err('[arms] glint '+e);}
      addEventListener('mousedown',e=>{if(!A)return;if(e.button===0&&document.pointerLockElement===G.canvas)ms.l=1;if(e.button===2)ms.r=1;}); // 포인터를 잡는 클릭은 방아쇠가 아님 (R24)
      addEventListener('mouseup',e=>{if(e.button===0)ms.l=0;if(e.button===2)ms.r=0;});
      addEventListener('wheel',e=>{if(A&&!api.bot&&document.pointerLockElement===G.canvas)ms.wh=e.deltaY;},{passive:true});
    },
    prepare(){if(G.paused){A&&!pz&&sndOff();pz=1;}else pz=0;}, // 일시정지(메뉴): update 가 멈추므로 M134 · 로켓 지속음을 끔 (풀리면 다음 프레임에 다시 켜짐)
    update(dt){
      if(!A)return;
      try{
        glint();markers();
        const a=view.ovA,ov=view.ov;
        ui.sc.style.opacity=ov==='scope'?a:0;ui.rg.style.opacity=ov==='ring'?a:0;ui.pg.style.opacity=ov==='pgo'?a:0;
        const lite=A.hud==='lite',fp=PP().fp,show=lite&&(A.allow()||ON).free&&!pres&&fp&&!fpOff();
        ui.wh.style.display=show?'block':'none';
        if((hudT-=dt)<=0){hudT=.2;if(show)ui.wh.innerHTML=hudHTML();}
        const pr=show?promptText():'';
        if(ui.whp._t!==pr){ui.whp._t=pr;ui.whp.textContent=pr;ui.whp.style.display=pr?'block':'none';}
      }catch(e){G.err('arms ui: '+(e.stack||e));}
    }
  },'story');
}
