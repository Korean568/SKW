'use strict';
/* STORY — 스토리 1: 타이틀 · 컷신 · 자동 대사 · 전투 인계 · 엔딩 */
{
  const C=G.cabin,PP=G.people,sin=Math.sin,cos=Math.cos,PI=Math.PI,cl=G.clamp,R=Math.random;
  // [화자,대사] / '*' 해설 / '#' 장면 제목 / '!' 연출(글자 없음),대기초 / '@' 장면
  G.STORY=[
    ['@','cruise'],['!','ext',1.2],
    ['*','주인공 김민철 하사는 마스크 대령과 박창원 중위, 이자용 병장, 신영호 상병, 김전부 이병과 함께 휴가를 내고 비행기를 탄다.'],
    ['!','seat',.4],['#','이륙 15분 후'],
    ['@','talk'],
    ['김민철','아 드디어 휴가다!!'],['마스크 대령','그게 그렇게 좋냐?'],['김민철','뼈가 으스러지게 훈련하는 것보단 낫죠.'],
    ['마스크 대령','야 그런데 그러고 보니 김전부는 오자마자 휴가냐'],['김전부','아닙니다! 전 군대에 온지 7개월이나 지났단 말입니다!'],
    ['마스크 대령','하하하 그래.'],['마스크 대령','맞는말이긴 하지.'],
    ['박창원','전 화장실 좀 다녀올게요.'],['!','lav',2.6],
    ['마스크 대령','난 좀 자야겠군.'],['!','sleep',1.6],
    ['김전부','저는 뉴스나 볼게요.'],['!','tv',3],
    ['@','hit'],['!','missile',3.6],['!','boom',3],
    ['@','fall'],['!','fall',1.1],
    ['박창원','무슨일입니까?'],['마스크 대령','나도 몰라!'],['김민철','아니 이게 무슨..'],['신영호','추락한다!'],
    ['김민철','이제 어떻게합니까?'],['박창원','몰라!'],['김민철','이런 젠장 환장하겠네 시X!'],
    ['마스크 대령','야 그래도 이륙한지 20분 밖에 안 지났으니 괜찮을 거야!'],
    ['!','gear',5.5],['!','seat',.5],
    ['마스크 대령','이게 무슨 소리야?'],['이자용','모르겠습니다!'],['박창원','아 tlqkf 환장하겠네!!'],['마스크 대령','이런 젠장!'],
    ['@','news'],['!','news',1.6],
    ['뉴스 앵커','속보입니다. 일주일전, 리충성이라는 인민군이 김준호 국무위원장을 살해했습니다. 이것으로 인해 대한민국 공격이 우려되며...'],
    ['!','seat',.4],['박창원','야 김민철!'],['김민철','옙!'],['박창원','김전부는?'],['!','glance',0],['김민철','전사했습니다..'],['박창원','이런 tlqkf! 벌써 뒤졌어?'],
    ['@','crash'],['!','approach',4.6],['!','impact',3.4],['!','wake',3.2],
    ['@','board'],['!','storm',2.6],['마스크 대령','저기 북한ㅅㄲ들이다!'],['박창원','저 🐶ㅅㄲ들!! 복수할거다!!'],['!','level',2.2],
    ['@','fight'],['!','fight',.3],
    ['박창원','돌격!!'],['김민철','죽어라!!'],['마스크 대령','돌격하라!!'],['김민철','저 tlqkf놈들의 두개골을 박살내주마!!!'],['박창원','뒤져라 이 🐶씹ㅅㄲ들아!!'],['신영호','뒤져!!!'],
    ['!','hold',0],
  ];
  const BEATS=['cruise','talk','hit','fall','news','crash','board','fight','end'];
  const who={'마스크 대령':'col','박창원':'park','김전부':'jb','이자용':'lee','신영호':'shin','김민철':'me'};
  const COL={'김민철':'#8fd0ff','마스크 대령':'#ffb46e','박창원':'#9be38f','김전부':'#f3dd72','이자용':'#d6a6ff','신영호':'#ff9191','뉴스 앵커':'#d8dde6'};
  // cm 카메라: title·ext·seat·scr(모니터)·stand·fps / fm 비행: 0 순항·1 강하·2 접근·3 현장
  const S={on:0,beat:'title',line:-1,t:0,i:0,nx:0,cm:'title',ex:'title',et:0,fm:0,ft:0,y:3200,z:0,sh:0,yaw:.3,pit:-.05,mv:0,spk:null,fix:null,kills:0,fb:0,blk:0,veil:0};
  const W={},ui={},EN=[],wait=[];
  const seatP=(r,c)=>C.seat(r,c).p;
  const sit=(k,r,c,seed,pose='sit')=>PP.add(k,{p:seatP(r,c).slice(),yaw:0,pose,M:C.M,seed});
  const later=(s,f)=>wait.push([S.t + s,f]);
  const fpsOK=()=>G.fps&&typeof G.fps.start==='function';
  const L=(p,rgb,I,r)=>G.addLight(p,rgb,I*4,r,2*Math.max(G.dt,1e-3));// 한 프레임 유지 점광 (수명 감쇠 보정 ×4)
  function walk(P,pts,sp,done){P.wp=pts;P.sp=sp;P.done=done;P.pose=sp>2?'run':'walk';P.vis=true;}

  /* ── 뉴스 화면 (512×288 캔버스 → 좌석 모니터) ── */
  const cv=document.createElement('canvas');cv.width=512;cv.height=288;const x=cv.getContext('2d',{willReadFrequently:true});// CPU 캔버스: 좌석 화면 업로드가 어느 경로든 안정적
  const F=(c,a,b,w,h)=>{x.fillStyle=c;x.fillRect(a,b,w,h)};
  function news(){
    const t=S.t,g=x.createLinearGradient(0,0,512,288);
    g.addColorStop(0,'#0a1a36');g.addColorStop(1,'#173a6a');x.fillStyle=g;x.fillRect(0,0,512,288);
    x.strokeStyle='#2f5d9a55';x.lineWidth=1;for(let i=0;i<9;i++){x.beginPath();x.arc(400,120,18 + i*16,0,7);x.stroke();}
    F('#0c2347',300,40,190,120);F('#1d4c86',306,46,178,108);
    x.fillStyle='#5f8fc4';x.beginPath();x.moveTo(380,54);x.bezierCurveTo(420,60,410,92,430,110);x.bezierCurveTo(424,140,392,150,378,146);x.bezierCurveTo(390,120,366,100,372,80);x.fill();
    x.fillStyle=`rgba(255,40,40,${.6 + .4 * sin(t * 6)})`;x.beginPath();x.arc(384,86,5,0,7);x.fill();
    x.fillStyle='#121a26';x.beginPath();x.ellipse(150,250,105,70,0,PI,0);x.fill();
    x.fillStyle='#e9e9ee';x.beginPath();x.moveTo(135,182);x.lineTo(165,182);x.lineTo(150,230);x.fill();F('#a01c1c',146,186,8,34);
    F('#c99a7c',138,150,24,36);x.beginPath();x.ellipse(150,128,30,38,0,0,7);x.fill();
    x.fillStyle='#1b1414';x.beginPath();x.ellipse(150,104,32,22,0,PI*.95,PI*2.05);x.fill();
    F('#c4161c',0,196,98,44);x.fillStyle='#fff';x.font='900 30px sans-serif';x.fillText('속보',14,229);
    F('#f4f4f4',98,196,414,44);x.fillStyle='#111';x.font='800 21px sans-serif';x.fillText('인민군 리충성, 김준호 국무위원장 살해',110,226);
    F('#081226',0,240,512,48);x.fillStyle='#ffd34a';x.font='700 17px sans-serif';
    x.fillText('대한민국 공격 우려 · 대북 경계태세 격상 · 국방부 긴급회의 · ',512 - (t*60 % 1100),270);
    F('#c4161c',14,14,58,24);x.fillStyle='#fff';x.font='800 15px sans-serif';x.fillText('LIVE',24,32);
    x.fillStyle='#cfe0ff';x.fillText('SKW 뉴스',82,32);
    C.screen(cv);
 }

  /* ── 배치 ── */
  function stage(){// 좌석: 김민철 13D · 대령 13C · 박창원 12C · 김전부 12A(왼쪽 창가 = 피격 벽) · 이자용 14C · 신영호 14D
    PP.clear();EN.length=0;wait.length=0;
    Object.assign(C.S,{hole:0,masks:0,power:1,crash:0,tv:0,gear:1,gearDown:0});
    W.col=sit('mask',13,'C',3);W.park=sit('rok',12,'C',5);W.jb=sit('rok',12,'A',7);W.lee=sit('rok',14,'C',9);W.shin=sit('rok',14,'D',11);
    W.civ=[[9,'B',2],[9,'E',4],[7,'A',6],[6,'D',8],[16,'F',10],[17,'B',12],[10,'F',14],[20,'E',16],[4,'C',18],[15,'A',20],[11,'E',22]].map(([r,c,s])=>sit('civ',r,c,s));
    Object.assign(S,{fm:0,y:3200,sh:0,fix:null,fb:0,blk:0,veil:0,spk:null});G.setEnv({cloud:.7,cloudBase:1000,cloudTop:3000,haze:.3,indoor:1});
    news();
 }
  function prep(b){// 장면 시작 상태를 누적 적용 (go() 용)
    const n=BEATS.indexOf(b);stage();
    if(n>=2){act('lav');W.park.vis=false;W.park.wp=null;W.col.pose='sleep';C.S.tv=1;}
    if(n>=3){boomState();S.fm=1;S.ft=0;S.y=3150;for(const k of ['col','lee','shin']) W[k].pose='sit';}
    if(n>=4){C.S.gear=0;S.y=900;seatPark();}
    if(n>=6){crashState();S.blk=0;squadUp(1);}
    if(n>=7){storm();level();}
 }
  function seatPark(){const P=W.park;P.wp=null;P.vis=true;P.p=seatP(12,'C').slice();P.yaw=0;P.pose='sit';}
  function boomState(){
    Object.assign(C.S,{hole:1,masks:1,power:.45,tv:1});W.jb.vis=false;S.sh=.5;
    W.civ.forEach((P,i)=>P.pose=i % 3?'brace':'sit');
 }
  function crashState(){
    const s=C.K.site;S.fm=3;C.place(s.pos,s.yaw,s.pitch,s.roll);Object.assign(C.S,{crash:1,hole:1,masks:1,power:.25,tv:0,gear:0});
    G.setEnv({cloud:.55,cloudBase:1500,cloudTop:3500,haze:.45});
    W.civ.forEach((P,i)=>{if(i>6) PP.remove(P);else P.pose=i % 2?'dead':'brace';});W.civ.length=7;
 }
  const SQ={col:[.5,3.3,2.4],park:[0,4.9,2.9],lee:[0,.4,2.2],shin:[-.05,-.6,2]};// 추락 후 분대 위치 (통로)
  function squadUp(now){
    for(const k in SQ){const P=W[k],q=SQ[k];if(!now){later(.4 + R()*1.2,()=>squadUp1(P,q));continue;} squadUp1(P,q);}
 }
  function squadUp1(P,q){P.vis=true;P.wp=null;P.p=[q[0],0,q[1]];P.yaw=q[2] - PI + .3;P.pose='stand';P.gun='pistol';}
  function storm(){// 북한군: 구멍 밖 · 앞문 · 꼬리 절단부 · 창밖 들판
    for(const P of EN) PP.remove(P);EN.length=0;
    const n=G.Q.level?18:12,M=C.M;
    for(let i=0;i<n;i++){
      let p,k=i % 4;
      if(k===0) p=C.w([3.2 + (i % 3)*1.1,0,1.4 + (i*.9) % 3.2]);
      else if(k===1) p=C.w([(i % 2?1.1:-1.1)*(i<8?1:.2),0,13.6 - (i % 3)*.4]);
      else if(k===2) p=C.w([(i % 3 - 1)*.6,0,-5.4 - (i % 2)*.7]);
      else p=C.w([7 + (i*2.3) % 11,0,-4 + (i*3.7) % 16]);
      if(k===0||k===3) p[1]=C.ground(p[0],p[2]);
      const P=PP.add('nk',{p,yaw:0,pose:'stand',gun:'ak',seed:40 + i});P.vis=false;P.k=k;EN.push(P);
      later(.15*i,()=>P.vis=true);
   }
    S.fix=[2.4,1.2,3.4];
 }
  function level(){// (북한군 50명이 총을 겨눈다) · 분대도 무기를 든다
    for(const P of EN){P.vis=true;P.pose='aim';P.aim=C.w([0,1.4,1.55]);}
    for(const k in SQ){const P=W[k];P.pose='aim';P.aim=EN.length?PP.eye(EN[(k.length*3) % EN.length]):null;}
 }

  /* ── 연출 ── */
  function act(a,arg){
    const P=W.park;
    if(a==='ext'){S.cm='ext';S.ex='cruise';S.et=0;}
    if(a==='seat'){S.cm='seat';S.fix=null;}
    if(a==='lav'){// (화장실로 간다) — 일어나 통로를 따라 뒤쪽 화장실로
      P.pose='stand';P.p=[.14,0,2.95];P.yaw=-.8;
      later(.7,()=>walk(P,[[0,2.3],[0,-12.4],[.3,-12.95]],1.15,Q=>Q.vis=false));
   }
    if(a==='sleep'){W.col.pose='sleep';}
    if(a==='tv'){C.S.tv=1;W.jb.look=null;}
    if(a==='missile'){S.cm='ext';S.ex='missile';S.et=0;G.sfx.play('missile');G.sfx.loop('missile',1,{gain:.5});}
    if(a==='boom'){// (큰 폭발 · 김전부 자리 벽이 터진다)
      G.sfx.loop('missile',0);S.cm='seat';S.yaw=.95;S.pit=0;S.mv=0;
      boomState();S.sh=1.4;S.fix=C.K.hole;P.vis=false;P.wp=null;
      const h=C.w(C.K.hole);G.fx.burst('explosion',h,{size:1.4});G.fx.burst('flash',h,{size:1});G.post.flash(2.2);S.bt=G.time;
      G.sfx.play('explosion',{gain:1.6});G.sfx.play('crash');G.sfx.loop('wind',1,{gain:.7});G.sfx.loop('siren',1,{gain:.2});
      for(const k of ['col','lee','shin']) W[k].pose='brace';
      S.fm=1;S.ft=0;S.boomT=S.t;
   }
    if(a==='fall'){// (화장실에서 나와 자리로 오다 흔들림에 넘어진다)
      S.fix=null;for(const k of ['col','lee','shin']) W[k].pose='sit';
      P.vis=true;P.p=[.1,0,1.3];P.yaw=0;walk(P,[[.1,2.4]],1.6,Q=>{Q.pose='stumble';S.sh=1.1;G.sfx.play('hit');later(3,()=>walk(Q,[[.1,2.9]],.8,seatPark));});
   }
    if(a==='gear'){// (랜딩기어가 떨어져 나간다)
      S.cm='ext';S.ex='gear';S.et=0;C.S.gearDown=1;
      later(1.6,()=>{C.S.gear=0;S.sh=1.6;G.sfx.play('explosion',{gain:1.2});G.fx.burst('hit',C.w([0,-2.6,2]),{size:3});});
   }
    if(a==='news'){S.cm='scr';C.S.tv=1;}
    if(a==='glance') S.fix=C.K.hole;
    if(a==='approach'){S.cm='seat';S.fm=2;S.ft=0;S.yaw=1.05;S.pit=-.12;S.fix=[6,-1.5,5];S.spk=null;for(const k of ['col','lee','shin','park']) W[k].pose='brace';}
    if(a==='impact'){// 충돌 → 섬광 → 암전 · 이명
      G.post.flash(3);G.sfx.play('crash',{gain:1.5});G.sfx.play('explosion',{gain:1.5});G.sfx.play('ring');
      for(const k of ['engine','wind','siren','cabin']) G.sfx.loop(k,0);
      S.blk=1;S.sh=2;later(.35,()=>{crashState();S.cm='seat';S.yaw=.7;S.pit=-.05;});
   }
    if(a==='wake'){S.blkT=1;squadUp(0);G.sfx.music('off');}
    if(a==='storm'){S.cm='stand';S.yaw=.55;S.pit=-.02;storm();G.sfx.play('alert');}
    if(a==='level'){level();G.sfx.play('click');}
    if(a==='fight') fight();
    if(a==='hold') S.nx=1e9;
 }
  function fight(){
    S.cm='fps';S.fix=null;G.sfx.music('combat');
    const allies=['col','park','lee','shin'].map(k=>W[k]);
    if(fpsOK()){
      for(const P of EN) PP.remove(P);EN.length=0;
      try {G.fps.start({pos:C.w([0,0,1.6]),eye:C.w([0,1.62,1.6]),yaw:C.K.site.yaw,allies,total:50,onEnd:end});}
      catch (e){G.err('[story] fps.start ' + e);S.fb=1;S.cm='stand';}
   } else {S.fb=1;S.cm='stand';} // 전투 모듈이 없을 때: 분대가 자동으로 소탕 → 승리
 }
  function fallback(dt){
    S.fbt=(S.fbt||0) + dt;
    const live=EN.filter(P=>!P.dead);
    for(const k in SQ){const P=W[k];if(live.length){P.pose='fire';P.aim=PP.eye(live[0]);} else P.pose='stand';}
    if(S.fbt>.7&&live.length){S.fbt=0;const P=live[0];P.dead=true;P.pose='dead';S.kills++;G.sfx.play('pistol');G.sfx.play('gun');G.fx.burst('muzzle',PP.muzzle(W.park),{size:.5});}
    if(!live.length&&S.fbt>2) end(true);
 }
  function end(win){
    if(S.beat==='end') return;
    S.beat='end';S.win=win;S.cm=S.cm==='fps'?'stand':S.cm;S.fb=0;S.nx=1e9;showDl(0);
    try {fpsOK()&&G.fps.on&&G.fps.stop&&G.fps.stop();} catch (e){G.err('[story] fps.stop ' + e);}
    const k=(fpsOK()&&G.fps.S&&G.fps.S.kills)||S.kills;
    document.pointerLockElement&&document.exitPointerLock();
    ui.end.innerHTML=win?`<h2>스토리 1 — 끝</h2><p>사살한 북한군 <b>${k}</b> / 50</p><p class=c>다음 이야기에서 계속…</p><button>처음부터</button>`
     :`<h2 class=r>전사</h2><p>사살한 북한군 <b>${k}</b> / 50</p><button>다시 싸우기</button>`;
    ui.end.querySelector('button').onclick=()=>{ui.end.style.display='none';win?go('cruise'):go('board');};
    ui.end.style.display='grid';G.sfx.music(win?'calm':'off');
 }

  /* ── 대사 · 자막 ── */
  function showDl(v){ui.dl.style.opacity=v?1:0;}
  function say(l){
    const [w,s]=l,n=s.length;
    if(w==='*'){ui.cap.textContent=s;ui.cap.style.opacity=1;showDl(0);S.nx=S.t + 2.2 + n*.07;later(S.nx - S.t - .6,()=>ui.cap.style.opacity=0);return;}
    if(w==='#'){ui.ttl.textContent=s;ui.ttl.style.opacity=1;later(3.4,()=>ui.ttl.style.opacity=0);S.nx=S.t + 1;return;}
    ui.dl.innerHTML=`<b style="color:${COL[w] || '#fff'}">${w}</b>${s}`;showDl(1);
    S.spk=who[w]||(w==='뉴스 앵커'?'tv':null);S.lineEnd=S.t + 1.2 + n*.075;S.nx=S.lineEnd + .45;
    if(S.fix&&w!=='김민철') S.fix=null;
 }
  function go(name){// 테스트 훅 · 재시작: 해당 장면 상태로 정확히 점프
    const i=G.STORY.findIndex(l=>l[0]==='@'&&l[1]===name);
    try {if(fpsOK()&&G.fps.on) G.fps.stop();} catch (e){G.err('[story] ' + e);}
    ui.end&&(ui.end.style.display='none');ui.ov&&(ui.ov.style.display='none');ui.cap&&(ui.cap.style.opacity=0);
    S.on=1;S.t=0;wait.length=0;S.kills=0;
    if(name==='end'){prep('fight');S.cm='stand';S.beat='fight';end(true);return;}
    prep(name);S.beat=name;S.i=i<0?0:i;S.nx=0;
    S.cm={cruise:'ext',talk:'seat',hit:'ext',fall:'seat',news:'scr',crash:'seat',board:'stand',fight:'stand'}[name]||'seat';
    S.yaw=name==='board'?.55:.3;S.pit=-.05;showDl(0);
 }
  let sel=1;// 챕터 선택 (1 = 스토리 1)
  function pick(n){sel=n;ui.ov&&ui.ov.querySelectorAll('.ch>div').forEach((e,i)=>e.className=i + 1===n?'on':'');}
  function begin(n){
    if(n!==2) return start();
    ui.ov.style.display='none';ui.end.style.display='none';C.on=false;G.village&&(G.village.on=true);PP.clear();
    G.story2&&G.story2.start&&G.story2.start();
 }
  function title(){// 스토리 2 → 처음 화면
    try {G.story2&&G.story2.stop&&G.story2.stop();} catch (e){G.err('[story] ' + e);}
    C.on=true;G.village&&(G.village.on=false);S.on=0;S.beat='title';S.cm='title';S.blk=0;wait.length=0;stage();
    G.setEnv({sunEl:34,sunAz:65,indoor:0,exposure:1});ui.end.style.display='none';ui.ov.style.display='grid';G.sfx.music('calm');
 }
  function start(){G.sfx.init();G.sfx.loop('engine',1,{gain:.3,rate:1.6});G.sfx.loop('cabin',1,{gain:.4});G.sfx.music('calm');go(G.params.get('story')!=='2'&&G.params.get('scene')||'cruise');}

  /* ── 매 프레임 ── */
  function fly(dt){
    const t=G.time;
    if(S.fm===3) return;// 추락 현장 (crashState 가 배치)
    let pitch=0,roll=.012*sin(t*.4),yaw=0,pos;
    if(S.fm<2){
      S.z+=225*dt;
      if(S.fm===1){S.ft+=dt;S.y=Math.max(700,S.y - dt*(S.y>1000?95:25)*Math.min(1,S.ft/3));pitch=-.1 - .04*sin(t*.6);roll=.14*sin(t*.45) + .05*sin(t*1.3);}
      pos=[0,S.y,S.z];
   } else {// 접근: 들판 위로 낮게 미끄러져 활주흔 시작점(z≈-190)에서 충돌
      S.ft+=dt;const u=Math.min(S.ft/4.6,1),s=C.K.site.pos,z=-660 + 470*u;
      pos=[s[0],s[1] + 85*(1 - u) ** 1.7 + .5,z];pitch=.05 - .06*u;roll=.09*sin(t*1.7);
      if(S.ft>1.2&&!C.S.crash) Object.assign(C.S,{crash:1}),G.setEnv({cloudBase:1500,cloudTop:3500});
      S.sh=Math.max(S.sh,.5 + u);
   }
    const k=S.sh*.022;C.place(pos,yaw,pitch + k*sin(t*29),roll + k*sin(t*23 + 1));
 }
  const E=[0,0,0],T=[0,0,0];
  function camera(dt){
    const c=G.cam,t=G.time,sh=S.sh;
    if(S.cm==='fps') return;
    if(S.cm==='title'||S.cm==='ext'){
      S.et+=dt;const m=S.cm==='title'?'title':S.ex,ctr=C.w([0,1,2]);
      let o,look=ctr,f=.75;
      if(m==='title'){const a=t*.05 + 2.2;o=[sin(a)*64,9 + 4*sin(t*.07),cos(a)*64];f=.62;}
      else if(m==='cruise'){o=[-40 + S.et*.8,4 + S.et*.3,72 - S.et*7.5];f=.7;}
      else if(m==='missile'){// 왼쪽 뒤에서 접근하는 미사일 
        const u=Math.min(S.et/3.4,1),k=(1 - u) ** 1.25,h=C.K.hole,mp=C.w([h[0] + 260*k,h[1] - 40*k,h[2] - 520*k]);
        if(u<1){G.fx.trail(mp,V3.mul(V3.norm(V3.sub(C.w(h),mp)),380),'missile',dt);L(mp,[1,.7,.4],30,60);G.fx.burst('flash',mp,{size:.25});}
        o=[-22,13,-66];f=.85;
     } else {// gear: 아래 앞쪽에서 올려다봄 — 불타며 강하하는 기체
        o=[34,-16,52 - S.et*6];f=.66;look=C.w([0,-1.5,0]);
        G.fx.trail(C.w([2.2,1,2.8]),[0,0,0],'fire',dt);L(C.w([3,1,2.8]),[1,.5,.2],40,25);
     }
      E[0]=ctr[0] + o[0];E[1]=ctr[1] + o[1];E[2]=ctr[2] + o[2];
      if(sh>.05){E[0]+=(R() - .5)*sh*.5;E[1]+=(R() - .5)*sh*.5;}
      c.pos=E.slice();c.target=look;c.up=[0,1,0];c.near=.5;c.fov=f;
      G.setEnv({indoor:0,exposure:1});G.shadowFocus=ctr;G.shadowRange=70;
      return;
   }
    // 1인칭 (좌석 · 화면 · 선 자세): 기체 좌표에서 계산 → 월드로
    const stand=S.cm==='stand',st=stand?[0,1.62,1.55]:seatP(13,'D'),eye=stand?st.slice():[st[0],st[1] + .7,st[2] + .04];
    S.mv-=dt;
    let tgt=S.fix?C.w(S.fix):(S.spk&&S.spk!=='me'&&S.spk!=='tv'&&W[S.spk]&&W[S.spk].vis!==false?PP.eye(W[S.spk]):null);
    if(W.park.wp&&W.park.vis!==false&&!S.spk) tgt=PP.eye(W.park);
    if(S.cm==='scr'){S.yaw+=(0 - S.yaw)*Math.min(1,dt*3);S.pit+=(-.5 - S.pit)*Math.min(1,dt*3);}
    else if(S.mv<0&&tgt){
      const q=C.l(tgt),d=[q[0] - eye[0],q[1] - eye[1],q[2] - eye[2]],ty=cl(Math.atan2(d[0],d[2]),-2.4,2.4),tp=cl(Math.atan2(d[1],Math.hypot(d[0],d[2])),-.6,.5);
      S.yaw+=(ty - S.yaw)*Math.min(1,dt*1.6);S.pit+=(tp - S.pit)*Math.min(1,dt*1.6);
   }
    const cp=cos(S.pit),j=sh*.035;
    eye[0]+=j*sin(t*37);eye[1]+=j*sin(t*41 + 2) + (stand?.012*sin(t*1.3):0);
    const yw=S.yaw + j*.6*sin(t*13),pt=S.pit + j*.5*sin(t*17);
    T[0]=eye[0] + sin(yw)*cos(pt);T[1]=eye[1] + sin(pt);T[2]=eye[2] + cos(yw)*cos(pt);
    c.pos=C.w(eye);c.target=C.w(T);const o=C.w([0,0,0]),u=C.w([0,1,0]);c.up=[u[0] - o[0],u[1] - o[1],u[2] - o[2]];
    c.near=.08;c.fov=S.cm==='scr'?.62:stand?1.15:1.12;
    const wr=S.fm===3;G.setEnv({indoor:wr?.7:1,exposure:wr?.9:C.S.power<1?.95:1});G.shadowFocus=C.w([0,1,2]);G.shadowRange=26;
 }
  function dress(dt){// 조명 · 불 · 연기 (점광 4개 예산, 센 것부터: 천장등 · 구멍/절단부 주광 · 불 · 피격 섬광)
    if(S.cm==='title'||S.cm==='ext') return;
    const t=G.time,p=C.S.power,wr=S.fm===3,fl=p<1?p*(.7 + .3*sin(t*43))*(sin(t*3.1) + sin(t*7.7)>1.4?.2:1):1,
      lc=p<1?[.86,.93,1.05]:[1,.93,.84],dl=[.82,.9,1.06],k=p<1?.25 + 1.2*fl:1;// 천장등: 정상 = 중성-따뜻 · 피격 후 = 약간 차가운 비상 전원 / 주광 = 차가운 흰빛
    L(C.w([.15,1.95,3.4]),lc,(wr?1.2:2.2)*k,4.5);
    if(!wr) L(C.w([-.4,1.9,1.4]),lc,1.7*k,5);// 카메라 뒤 위: 인물 얼굴 · 검은 전투복 채움광
    if(C.S.hole>.5){
      L(C.w([2.7,1.4,2.8]),dl,wr?2:2.6,6.5);// 구멍 바깥에 둔 주광 → 구멍 쪽에서 드는 방향성 빛
      const h=C.w([2.1,.6,2.1]);L(C.w([2,.8,2.4]),[1,.42,.12],.7 + .4*sin(t*17)*sin(t*5) + .25*sin(t*31),2.2);// 불: 구멍 2 m 안만 주황
      if(S.cm!=='fps'||G.frame % 2) G.fx.trail(h,C.S.crash?[0,.4,0]:C.w([0,0,-30]).map((v,i)=>v - C.w([0,0,0])[i]),'fire',dt);
      if(!C.S.crash&&R()<dt*6) G.fx.burst('smoke',C.w([1.4,1 + R(),2 + R()]),{size:.5,vel:[0,0,-25]});
   } else L(C.w([1.4,1.1,2.6]),[.8,.88,1],1.4,3.5);
    if(C.S.crash){// 바깥 불 · 먼지
      if(R()<dt*2) G.fx.burst('smoke',C.w([(R() - .5)*2.4,1.2,R()*6 - 1]),{size:.35,vel:[0,.2,0]});
      G.fx.trail(C.w([5,-.4,-2]),[0,1,0],'fire',dt*.6);
   }
    if(wr) L(C.w([0,1.5,-7.4]),dl,2.4,8);// 꼬리 절단부로 드는 주광
    const u=t - S.bt;if(u>=0&&u<.25) L(C.w(C.K.hole),[1,.85,.7],8*(1 - u/.25)**2,7);// 피격 섬광 (짧게)
    if(S.cm!=='fps'||G.env.indoor>.5) G.lights=G.lights.filter(l=>l.radius<50);// fx 불 · 폭발 점광(반경 수백 m, 카메라 쪽으로 당김: 바다용)은 객실을 통째로 주황으로 물들임 → 객실에선 뺀다
 }
  function people(dt){
    for(const P of PP.list) if(P.wp){
      const [tx,tz]=P.wp[0],dx=tx - P.p[0],dz=tz - P.p[2],d=Math.hypot(dx,dz);
      if(d<.04){P.wp.shift();if(!P.wp.length){P.wp=null;P.pose='stand';P.done&&P.done(P);} continue;}
      const s=Math.min(d,P.sp*dt);P.p[0]+=dx/d*s;P.p[2]+=dz/d*s;
      let a=Math.atan2(dx,dz) - P.yaw;a=Math.atan2(sin(a),cos(a));P.yaw+=a*Math.min(1,dt*7);
   }
    const me=G.cam.pos,sp=S.spk,talking=S.t<S.lineEnd;
    for(const k of ['col','park','jb','lee','shin']){
      const P=W[k];if(!P) continue;
      P.talk=talking&&sp===k?1:0;
      if(P.pose==='sleep'||P.pose==='dead'){P.look=null;continue;}
      if(k==='jb'&&C.S.tv){P.look=null;continue;}
      if(P.wp){P.look=null;continue;}
      P.look=S.beat==='board'&&EN.length?PP.eye(EN[0]):sp===k||sp==='me'||!sp||sp==='tv'||!W[sp]||W[sp].vis===false?me:PP.eye(W[sp]);
   }
    if(C.S.hole>.5&&!C.S.crash) for(const P of W.civ) P.look=C.w(C.K.hole);
 }
  function update(dt){
    try {
      if(!S.st){// 첫 프레임: 배치 (다른 모듈 init 이후)
        S.st=1;
        if(!S.on&&!(G.story2&&G.story2.on)){stage();if(G.params.get('story')==='2') begin(2);else if(G.params.has('autostart')||G.params.has('scene')) start();}
     }
      if(G.story2&&G.story2.on) return;// 스토리 2 진행 중: 스토리 1 은 쉼
      const sk=S.on&&G.keys.Tab&&S.cm!=='fps'?4:1,sd=dt*sk;// Tab 누르고 있으면 빨리 감기
      if(S.on){
        S.t+=sd;
        for(let i=wait.length - 1;i>=0;i--) if(S.t>=wait[i][0]){const f=wait[i][1];wait.splice(i,1);f();}
        while (S.on&&S.t>=S.nx&&S.i<G.STORY.length){
          const l=G.STORY[S.i++];S.line=S.i - 1;
          if(l[0]==='@'){S.beat=l[1];continue;}
          if(l[0]==='!'){if(l[2]>.5) showDl(0),S.spk=null;act(l[1]);if(l[1]!=='hold') S.nx=S.t + l[2];} else say(l);
       }
        if(S.fb&&S.beat!=='end') fallback(sd);
        if(S.blkT){S.blk=Math.max(0,S.blk - dt*.45);if(!S.blk) S.blkT=0;}
     }
      S.sh=Math.max(C.S.hole>.5&&S.fm<3?.3:0,S.sh - dt*.5);
      if(S.fm===1&&C.S.power<1) C.S.power=.35 + .2*(sin(G.time*5)>0);
      if(S.on) fly(sd),people(sd),dress(dt);else C.place([0,3200,S.z+=225*dt],0,0,.012*sin(G.time*.4));
      camera(dt);
      if(C.S.tv&&G.frame % 6===0) news();
      // 구름층 통과 (1000~3000 m): 창 · 구멍으로 하얀 장막
      S.veil+=((S.fm===1&&S.y<3050&&S.y>1000?.22 + .12*sin(G.time*2.3):0) - S.veil)*Math.min(1,dt*2);
      ui.vl&&(ui.vl.style.opacity=S.cm==='ext'?0:S.veil);ui.bk&&(ui.bk.style.opacity=S.blk);
      ui.sk&&(ui.sk.style.display=S.on&&S.cm!=='fps'&&S.beat!=='end'?'block':'none');
      if(G.frame % 6===0&&G.cam.target) G.sfx.listener(G.cam.pos,V3.norm(V3.sub(G.cam.target,G.cam.pos)));
   } catch (e){G.err('[story] ' + (e.stack||e));}
 }
  G.story={S,go,start,news,title,begin,pick};
  G.register('story',{
    init(){
      G.css(`#ov,#dl,#cap,#ttl,#vl,#bk,#sk,#end{position:absolute}
#ov{inset:0;display:grid;align-content:center;justify-items:start;padding:0 7vw;background:linear-gradient(90deg,#000d,#0007 45%,#0000 78%);pointer-events:auto;color:#dfe8f2}
#ov .tb{margin:0 0 1.1em;padding:.25em .9em .3em;font:600 max(11px,.95vw) system-ui;letter-spacing:.28em;color:#dfe8f2;text-decoration:none;border:1px solid #fff5;border-radius:999px;background:#0006}#ov .tb b{color:#fff}#ov .tb:hover{color:#fff;border-color:#fff}
#ov h1{margin:0;font:800 6.2vw/.95 system-ui;letter-spacing:.05em;color:#fff}#ov h1 i{display:block;font-style:normal;color:#fff}
#ov p{margin:.35em 0;font-size:1.6vw}
#ov .ch{margin-top:.4em}#ov .ch>div{margin:.5em 0;padding:.1em 0 .1em 1em;border-left:3px solid #fff3;opacity:.5;cursor:pointer;pointer-events:auto;transition:opacity .3s,border-color .3s}#ov .ch>div.on{opacity:1;border-color:#e03b3b}#ov .ch p{margin:.2em 0;font-size:1.35vw}#ov .ch p+p{font-size:1.05vw;color:#aebccb}#ov .k{font-size:max(11px,1.05vw);color:#9fb1c4;line-height:1.7;margin-top:1.4em}#ov .k b{color:#dfe8f2;font-weight:600}
#ov button,#end button{margin:1.1em 0 .2em;padding:.5em 2.4em;font:700 1.9vw system-ui;letter-spacing:.3em;color:#0b0f14;background:#fff;border:0;border-radius:6px;cursor:pointer;box-shadow:0 6px 30px #fff4;pointer-events:auto}
#dl{left:50%;bottom:6vh;transform:translateX(-50%);width:min(820px,88vw);padding:.7em 1.4em .8em;background:#0a0e14d8;border-radius:8px;font:500 2.4vh/1.45 system-ui;color:#f2f4f7;text-align:center;opacity:0;transition:opacity .35s}
#dl b{display:block;font-size:.66em;letter-spacing:.12em;margin-bottom:.2em}
#cap{left:50%;top:12vh;transform:translateX(-50%);width:min(860px,84vw);text-align:center;font:italic 400 2.5vh/1.7 serif;color:#fff;text-shadow:0 0 14px #000;transition:opacity 1.2s;opacity:0}
#ttl{left:5vw;top:7vh;font:300 2vh system-ui;letter-spacing:.35em;color:#fff;border-left:3px solid #e03b3b;padding:.2em .8em;opacity:0;transition:opacity 1s;text-shadow:0 1px 4px #000}
#vl{inset:0;background:radial-gradient(#fff0 20%,#e8eef4);opacity:0}#bk{inset:0;background:#000;opacity:0}
#sk{right:2vw;bottom:2vh;padding:.3em .9em;font:12px system-ui;color:#cdd6e0;background:#0008;border:1px solid #fff3;border-radius:4px;pointer-events:auto;display:none}
#end{inset:0;display:none;place-content:center;justify-items:center;text-align:center;background:radial-gradient(#000a,#000e);color:#e6ecf2;font:2vh system-ui;pointer-events:auto}
#end h2{margin:0 0 .4em;font:800 5vw system-ui;letter-spacing:.08em}#end h2.r{color:#e03b3b}#end .c{font-style:italic;color:#aab8c6}`);
      const nh=G.params.has('nohud');
      ui.vl=G.el('div',{id:'vl'});ui.bk=G.el('div',{id:'bk'});
      ui.ov=G.el('div',{id:'ov',innerHTML:`<a class=tb href="https://tribe3dgames.vercel.app/" target=_blank rel=noopener>TRIBE <b>3D</b> GAMES ↗</a><h1>SECOND<i>KOREAN WARS</i></h1><div class=ch><div class=on><p>스토리 1 — 서강시 : 전쟁의 시작 · 대한민국편</p><p>플레이어: 김민철 하사</p></div><div><p>스토리 2 — 북한 마을 : 5일전으로 · 조선민주주의인민공화국편</p><p>플레이어: 북한 군인(동무) · AKM 소총</p></div></div><button>시 작</button><div class=k><b>컷신</b> 마우스: 둘러보기 · Tab 누르기: 빨리 감기<br><b>전투</b> WASD 이동 · 마우스 조준 · 왼쪽 클릭 사격 · 오른쪽 클릭 정조준 · R 재장전 · E 줍기 · Shift 달리기 · C 앉기<br><b>F2</b> 그래픽 설정 · Enter 시작</div>`});
      ui.dl=G.el('div',{id:'dl'});ui.cap=G.el('div',{id:'cap'});ui.ttl=G.el('div',{id:'ttl'});
      ui.sk=G.el('div',{id:'sk',textContent:'건너뛰기 ▸'});ui.end=G.el('div',{id:'end'});
      if(nh) for(const k of ['dl','cap','ttl','sk']) ui[k].style.visibility='hidden';
      ui.ov.querySelector('button').onclick=()=>begin(sel);
      ui.ov.querySelectorAll('.ch>div').forEach((e,i)=>{e.onclick=()=>pick(i + 1);e.ondblclick=()=>begin(i + 1);});
      ui.sk.onclick=()=>{S.nx=Math.min(S.nx,S.t);S.lineEnd=S.t;};
      addEventListener('keydown',e=>{
        if(S.on||G.story2&&G.story2.on||ui.ov.style.display==='none') return;
        if(e.code==='Enter') begin(sel);
        if(e.code==='ArrowUp'||e.code==='Digit1') pick(1);
        if(e.code==='ArrowDown'||e.code==='Digit2') pick(2);
     });
      G.canvas.addEventListener('click',()=>{S.on&&S.beat!=='end'&&G.canvas.requestPointerLock&&G.canvas.requestPointerLock();});
      addEventListener('mousemove',e=>{
        if(!S.on||S.cm==='fps'||!(document.pointerLockElement===G.canvas||e.buttons)) return;
        S.yaw=cl(S.yaw - e.movementX*.0025,-2.2,2.2);S.pit=cl(S.pit - e.movementY*.0025,-.8,.6);S.mv=2.5;
     });
      G.setEnv({cloud:.7,sunEl:34,sunAz:65,haze:.3});
   },
    update
 },'story');
  G.mode==='story'&&G.order.unshift(G.order.pop());// 스토리 update 가 맨 앞: 기체 변환이 같은 프레임에 반영
}
