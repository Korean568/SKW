'use strict';
/* STORY 4 — 폐허가 된 서강 : 고혁명의 배신 (대한민국편) · 흐름 · 대치 · 무전 */
{
  const PP=G.people,sin=Math.sin,cos=Math.cos,PI=Math.PI,H=Math.hypot,cl=G.clamp,R=Math.random,mn=Math.min,mx=Math.max,ab=Math.abs;
  const BEATS=['intro','land','approach','talk','radio','end'];
  const NARR='고혁명은 리충성이 죽는 것을 지켜본 후, 리옥선을 죽여야된다고 생각하고 자신을 진심으로 존경하는 부하들과 함께 항복하려고 헬리콥터를 타고 대한민국 서강으로 간다.';
  // 대본: [화자,대사,연출?] / '*' 해설 / '#' 장소 / '!' 연출,대기초 / '?' 관문 / '@' 장면 — 괄호 지문은 연출로만 보여 준다
  const SC=[
    ['@','intro'],['!','card',4.2],['*',NARR],['!','fp',2.4],['#','서강시 · 폐허 — 새벽'],
    ['@','land'],['!','land',2.4],// (헬기가 착륙한다)
    ['김민철','어? 뭐야 북한군의 헬기잖아?','heli'],
    ['마스크 대령','경계하라!','raise'],
    ['?','landed'],['!','door',2.4],
    ['박창원','누가 내립니다!','out'],
    ['@','approach'],['!','walk',0],['?','arrived'],// (고혁명이 특전사들한테 다가온다)
    ['@','talk'],['!','aimko',1.5],// (총을 겨누며)
    ['마스크 대령','당신은 누구요?'],
    ['고혁명','나는 고혁명이라는 조선의 장교요.','calm'],
    ['고혁명','남조선에 항복하러 왔소.'],
    ['고혁명','앞으로 남조선을 적극 지원하겠소.'],
    ['@','radio'],['!','call',2.8],// (리옥선이 무전기로 고혁명에게 연락한다)
    ['리옥선','고혁명 동무, 어디갔소?'],
    ['리옥선','분명 남조선 ㅅㄲ들을 처리하러간다고 하지않았소?'],
    ['고혁명','지금 찾고 있습네다.'],
    ['리옥선','이게 어딜 날 속이려고!'],
    ['리옥선','난 동무가 남조선에 항복한것을 다 안다!'],
    ['고혁명','저는 인민들을 리옥선 동지한테서 구출하기 위해 항복했습네다.'],
    ['리옥선','그렇다면 동무는 특별히 나중에 두개골을 으스러주겠소!'],
    ['고혁명','리옥선 동지, 동무는 남조선을 이길 수 없습네다.'],
    ['리옥선','어디 두고 보라지!'],
    ['!','throw',3.2],// (리옥선이 무전기를 집어던진다)
    ['!','quiet',3.4],
    ['@','end'],['!','end',0],
  ];
  const COL={'김민철':'#8fd0ff','마스크 대령':'#ffb46e','박창원':'#9be38f','고혁명':'#ffc27a','리옥선':'#ff8b7a'};
  const who={'김민철':'me','마스크 대령':'col','박창원':'park','고혁명':'ko','리옥선':'ko'};
  const S={on:0,beat:'',i:0,t:0,nx:0,cm:'fp',ct:0,bk:0,bkT:0,bkR:2,g:null,gt:0,spk:null,lineEnd:0,mv:0,wk:0,fix:null,fixF:0,
    hT:0,hR:0,rotT:1,doorT:0,radio:0,gunT:3,smT:0,cut:null};
  const me={p:[0,0,0],o:[0,0,0],yaw:0,pit:0,bob:0,bA:0,aim:0,aimT:0,sw:[0,0]};
  const W={sq:[],crew:[]},wait=[],ui={};
  const later=(s,f)=>wait.push([S.t + s,f]);
  const $=id=>document.getElementById(id);
  const ss=(a,b,x)=>{x=cl((x - a)/(b - a),0,1);return x*x*(3 - 2*x);};
  const fw=y=>[sin(y),0,cos(y)];
  const dxz=(a,b)=>H(a[0] - b[0],a[2] - b[2]);
  const yawTo=(a,b)=>Math.atan2(b[0] - a[0],b[2] - a[2]);
  const wrap=a=>Math.atan2(sin(a),cos(a));
  const mix=(a,b,k)=>[a[0] + (b[0] - a[0])*k,a[1] + (b[1] - a[1])*k,a[2] + (b[2] - a[2])*k];

  /* ── 폐허 계약 (없으면 대체값) ── */
  const FK={start:[0,0,0,0],squad:[[-1.7,0,.7,0],[1.6,0,.5,0],[-3.1,0,-.5,.2],[3,0,-.4,-.2],[.3,0,-1.7,0]],lz:[0,0,26],meet:[0,0,6.5],
    crew:[[-4,0,23,PI],[4,0,23,PI],[-3.5,0,29,PI],[3.5,0,29,PI]]};
  const FS={heli:0,rotor:1,door:0};
  const RU=()=>G.ruins||{};
  const K=()=>{const k=RU().K;return k&&k.start&&k.lz&&k.meet&&k.squad&&k.squad.length?k:FK;};
  const RS=()=>{const s=RU().S;return s&&typeof s==='object'?s:FS;};
  function rc(f,...a){const v=RU();try {return typeof v[f]==='function'?v[f](...a):undefined;} catch (e){G.err('[story4] ruins.' + f + ' ' + e);}}
  const gnd=(x,z)=>{const y=rc('ground',x,z);return Number.isFinite(y)?y:0;};
  const col=(p,r)=>{const q=rc('collide',p,r);return q&&Number.isFinite(q[0])&&Number.isFinite(q[2])?[q[0],Number.isFinite(q[1])?q[1]:gnd(q[0],q[2]),q[2]]:[p[0],gnd(p[0],p[2]),p[2]];};
  const at=(q,dy=0)=>[q[0],gnd(q[0],q[2]) + dy,q[2]];
  const U=()=>{const k=K(),d=[k.lz[0] - k.start[0],0,k.lz[2] - k.start[2]],n=H(d[0],d[2])||1;return[d[0]/n,0,d[2]/n];};// 분대 → 착륙장 방향
  function hp(){// 헬기 현재 위치 (없으면 대체 궤적: 멀리 상공 → 착륙장)
    const q=rc('heliPos');if(q&&Number.isFinite(q[0])&&Number.isFinite(q[1])) return q;
    const k=K(),u=U(),h=RS().heli||0,e=1 - (1 - h)**2,l=k.lz;
    const a=[l[0] + u[0]*420 + u[2]*160,gnd(l[0],l[2]) + 150,l[2] + u[2]*420 - u[0]*160],b=[l[0] + u[0]*60,gnd(l[0],l[2]) + 30,l[2] + u[2]*60],c=at(l,2);
    return mix(mix(a,b,e),mix(b,c,e),e);
 }
  function door(){// 헬기 문 안쪽 · 내린 뒤 서는 곳 — 착륙한 헬기 행렬이 있으면 왼쪽 앞 문 (Mi-8)
    const k=K(),l=k.lz,m=k.meet,M=RS().heli>=.999&&rc('heliM');
    if(M&&M.length===16&&H(M[12] - l[0],M[14] - l[2])<1.5) return S.dr=[at(M4.point(M,[.8,0,4.25])),at(M4.point(M,[3.2,0,4.6]))];
    if(S.dr) return S.dr;
    const d=[m[0] - l[0],0,m[2] - l[2]],n=H(d[0],d[2])||1;
    return[at([l[0] + d[0]/n*1.8,0,l[2] + d[2]/n*1.8]),at([l[0] + d[0]/n*4.2,0,l[2] + d[2]/n*4.2])];
 }

  /* ── 인물 ── */
  const add=(k,o)=>PP.add(k,Object.assign({pose:'stand',gun:0},o));
  function walk(P,pts,sp,done,pose){P.wp=pts.map(q=>q.slice());P.sp=sp;P.done=done;P.wpose=pose||'walk';P.pose=P.wpose;P.vis=true;P.stk=0;P.face=null;}
  const chest=P=>{const e=PP.eye(P);return[e[0],e[1] - .3,e[2]];};
  function aimAt(P,T,crouch){P.pose=crouch?'crouch':'aim';P.tgt=T;P.face=T;}
  function low(P){P.pose='stand';P.tgt=null;P.aim=null;}
  function stage(n){// n = 장면 번호: 그 장면 시작 상태를 누적 배치
    const k=K(),rs=RS(),[d0,d1]=door();
    PP.clear();W.sq=[];W.crew=[];wait.length=0;S.fix=null;S.fixF=0;S.radio=0;S.cut=null;
    const nm=['col','park','lee','shin','jb'],kd=['mask','rok','rok','rok','rok'],sd=[3,5,9,11,7],lz=at(k.lz);
    k.squad.slice(0,5).forEach((q,i)=>{const P=add(kd[i],{p:at(q),yaw:q[3]||0,gun:'rifle',seed:sd[i],look:at(k.lz,3)});P.home=q;W[nm[i]]=P;W.sq.push(P);});
    W.ko=add('nko',{p:d0,yaw:yawTo(d0,k.meet),seed:23,vis:false});
    (k.crew||[]).slice(0,4).forEach((q,i)=>{const P=add('nk',{p:at(q),yaw:q[3]||yawTo(q,k.meet),gun:'ak',seed:41 + i*5,vis:n>=2,look:at(k.meet,1.5)});P.home=q;W.crew.push(P);});
    rs.heli=n<1?0:n<2?.3:1;rs.rotor=n<2?1:.45;rs.door=n<2?0:1;S.hT=rs.heli;S.hR=0;S.rotT=rs.rotor;S.doorT=rs.door;
    if(n>=1) W.sq.forEach((P,i)=>{P.look=null;});
    if(n>=2){
      W.sq.forEach((P,i)=>aimAt(P,i===0||i===1?W.ko:W.crew[i % mx(1,W.crew.length)]||W.ko,i===1||i===3));
      W.ko.vis=true;W.ko.p=d1;W.ko.yaw=yawTo(d1,k.meet);W.ko.pose='handsup';W.ko.look=at(k.start,1.6);
    }
    if(n>=3){W.ko.p=at(k.meet);W.ko.yaw=yawTo(k.meet,k.start);}
    if(n>=4){const C=W.col,f=fw(yawTo(C.p,W.ko.p));C.p=col([C.p[0] + f[0]*1.1,0,C.p[2] + f[2]*1.1],.3);aimAt(C,W.ko);W.ko.pose='stand';W.ko.look=PP.eye(C);}
    // 플레이어: 엄폐물 뒤
    me.o=at(k.start);me.p=me.o.slice();me.yaw=k.start[3]!=null?k.start[3]:yawTo(k.start,k.lz);me.pit=-.03;me.aim=me.aimT=0;
    G.people.fp.on=n>=1?1:0;
 }

  /* ── 연출 ── */
  function act(a){
    const k=K(),rs=RS(),[d0,d1]=door();
    if(a==='card'){S.cm='est';S.ct=0;S.bk=S.bkT=1;ui.t.style.opacity=1;later(3.2,()=>{ui.t.style.opacity=0;S.bkT=0;S.bkR=.5;});S.hT=.3;S.hR=.3/16;}
    if(a==='fp'){S.bkT=1;S.bkR=2.5;later(.45,()=>{S.cm='fp';G.people.fp.on=1;stageFp();S.bkT=0;S.bkR=1.4;ui.h.style.opacity=1;later(8,()=>ui.h.style.opacity=0);});}
    if(a==='land'){S.hT=1;S.hR=.07;S.fix='heli';S.fixF=S.t + 5;W.sq.forEach(P=>P.look=hp());}
    if(a==='heli'){S.fix='heli';S.fixF=S.t + 4;}
    if(a==='raise'){// 경계하라! — 분대가 헬기를 겨눔 (둘은 무릎쏴)
      W.sq.forEach((P,i)=>later(.15 + i*.22,()=>{aimAt(P,'heli',i===1||i===3);G.sfx.play('click',{gain:.35,rate:.6 + R()*.2});}));
   }
    if(a==='door'){S.doorT=1;S.rotT=.45;S.fix=d0;S.fixF=S.t + 4;}
    if(a==='out'){// 고혁명이 내린다 · 부하들은 소총을 내린 채 헬기 옆으로
      const P=W.ko;P.vis=true;P.p=d0.slice();P.look=at(k.start,1.6);
      walk(P,[d1],.9,Q=>{Q.pose='handsup';Q.yaw=yawTo(Q.p,k.start);});P.free=1;
      W.sq.forEach((Q,i)=>Q.tgt=i<2?W.ko:Q.tgt);
      W.crew.forEach((C,i)=>later(.9 + i*.6,()=>{C.p=d0.slice();walk(C,[d1,C.home],1.1,Q=>{Q.yaw=Q.home[3]!=null?Q.home[3]:yawTo(Q.p,k.meet);Q.look=at(k.meet,1.5);});C.free=1;}));
      later(2.6,()=>W.sq.forEach((Q,i)=>{if(i>1&&W.crew.length) Q.tgt=Q.face=W.crew[i % W.crew.length];}));
   }
    if(a==='walk'){// (고혁명이 특전사들한테 다가온다) — 손을 보인 채 천천히
      const P=W.ko;P.look=at(k.start,1.6);S.fix=P;S.fixF=S.t + 3;
      later(1.2,()=>walk(P,[at(k.meet)],1.15,Q=>{Q.pose='handsup';Q.yaw=yawTo(Q.p,k.start);}));
   }
    if(a==='aimko'){// (총을 겨누며) — 대령이 한 걸음 나서며 고혁명을 겨눈다
      const C=W.col,f=fw(yawTo(C.p,W.ko.p));low(C);
      walk(C,[col([C.p[0] + f[0]*1.1,0,C.p[2] + f[2]*1.1],.3)],1,Q=>{aimAt(Q,W.ko);G.sfx.play('click',{gain:.5,rate:.55});});
      S.fix=W.ko;S.fixF=S.t + 3;
   }
    if(a==='calm'){W.ko.pose='stand';W.ko.look=PP.eye(W.col);}
    if(a==='call'){// 무전: 잡음과 함께 고혁명이 무전기를 귀에 댄다
      S.radio=1;G.sfx.play('click',{gain:.8,rate:1.4});radioFx(.5,.35);
      later(.7,()=>{const P=W.ko,f=fw(P.yaw);P.gun='radio';P.pose='stand';P.look=at([P.p[0] + f[0]*3 + f[2]*1.5,0,P.p[2] + f[2]*3 - f[0]*1.5],.4);});// 고개를 숙이고 듣는다
      S.fix=W.ko;S.fixF=S.t + 3;W.sq.forEach(P=>P.look=PP.eye(W.ko));
   }
    if(a==='throw'){// (리옥선이 무전기를 집어던진다) — 주석궁 집무실 짧은 컷 · 아니면 고혁명의 무전기에서 잡음 폭발
      if(!cut(1)){radioFx(.9,.5);later(.5,()=>{S.radio=0;});later(1,()=>{W.ko.gun=0;W.ko.look=PP.eye(W.col);});}
   }
    if(a==='quiet'){S.radio=0;W.ko.gun=0;W.ko.look=PP.eye(W.col);S.fix=W.ko;S.fixF=S.t + 3;}
    if(a==='end') end();
 }
  function radioFx(g,d){S.rb=S.t + d;S.rg=g;}// 무전 잡음 폭발 (세기, 길이)
  function cut(on){// 리옥선 컷 (G.palace 가 있을 때만)
    const pa=G.palace,o=pa&&pa.K&&pa.K.office,q=o&&o.ok;
    if(on){
      if(!q||!Array.isArray(q)) return false;
      S.cut={ru:G.ruins?G.ruins.on:false,t:S.t};G.ruins&&(G.ruins.on=false);pa.on=true;
      for(const P of PP.list){P.v4=P.vis;P.vis=false;}
      W.okc=add('nkf',{p:[q[0],q[1]||0,q[2]],yaw:q[3]||0,gun:'radio',seed:71});W.okc.look=null;
      S.cm='cut';S.ct=0;G.people.fp.on=0;S.bk=0;
      later(.35,()=>{W.okc&&(W.okc.pose='throw');});
      later(.9,()=>G.sfx.play('hit',{gain:.5,rate:.35}));
      later(1.9,()=>cut(0));
      return true;
   }
    if(!S.cut) return;
    const c=S.cut;S.cut=null;W.okc&&PP.remove(W.okc);W.okc=null;
    pa&&(pa.on=false);G.ruins&&(G.ruins.on=c.ru||true);
    for(const P of PP.list) if(P.v4!=null){P.vis=P.v4;P.v4=null;}
    S.cm='fp';G.people.fp.on=1;radioFx(.9,.45);later(.45,()=>S.radio=0);later(.9,()=>{W.ko.gun=0;});
 }
  function end(){
    S.beat='end';S.nx=1e9;showDl(0);S.radio=0;document.pointerLockElement&&document.exitPointerLock();
    const e=ui.end;if(!e) return;
    e.innerHTML='<h2>스토리 4 — 끝</h2><p class=c>폐허가 된 서강 : 고혁명의 배신 · 대한민국편</p><div><button>처음 화면</button> <button>다시 하기</button></div>';
    const b=e.querySelectorAll('button');
    b[0].onclick=()=>{e.style.display='none';G.story&&G.story.title?G.story.title():(stop(),location.reload());};
    b[1].onclick=()=>{e.style.display='none';start();};
    e.style.display='grid';
 }
  function stageFp(){const k=K();me.p=me.o.slice();me.yaw=yawTo(k.start,k.lz) - .25;me.pit=-.02;S.fix=W.col;S.fixF=S.t + 1.6;}

  /* ── 1인칭 보행 (엄폐물 뒤 몇 m) ── */
  function stepMe(dt){
    const k=G.keys;let f=(k.KeyW||k.ArrowUp?1:0) - (k.KeyS||k.ArrowDown?1:0),s=(k.KeyD||k.ArrowRight?1:0) - (k.KeyA||k.ArrowLeft?1:0);
    if(S.bot){const u=S.t % 12;f=u<1.2?.6:u>6&&u<7.2?-.6:0;}// 봇: 한 걸음 나갔다 돌아옴
    if(f||s) S.wk=1.5;
    const n=H(f,s)||1,sp=(k.ShiftLeft?2.6:1.5)*(1 - .4*me.aim)/n,vx=(sin(me.yaw)*f - cos(me.yaw)*s)*sp,vz=(cos(me.yaw)*f + sin(me.yaw)*s)*sp;
    const p0=me.p.slice(),m=Math.ceil(dt/.034),h=dt/m;
    for(let i=0;i<m;i++){
      let q=col([me.p[0] + vx*h,me.p[1],me.p[2] + vz*h],.3);const d=dxz(q,me.o);
      if(d>4.5) q=col([me.o[0] + (q[0] - me.o[0])*4.5/d,q[1],me.o[2] + (q[2] - me.o[2])*4.5/d],.3);// 엄폐 구역 밖으로는 나가지 않음
      me.p=q;
   }
    const v=dt>0?dxz(me.p,p0)/dt:0,b0=Math.floor(me.bob/PI);
    me.bob+=v*dt*4.2;me.bA+=((v>.3?1:0) - me.bA)*mn(1,dt*7);
    if(Math.floor(me.bob/PI)!==b0&&me.bA>.3) G.sfx.play('click',{gain:.5,rate:.16 + R()*.05});// 발소리 (자갈)
 }
  const E=[0,0,0],T=[0,0,0];
  function camera(dt){
    const c=G.cam,t=G.time,k=K();S.ct+=dt;
    if(S.cm==='est'){// 시작: 폐허 너머로 다가오는 헬기 (분대 뒤에서 망원으로)
      const u=U(),sd=[u[2],0,-u[0]],e=ss(0,18,S.ct),s=k.start,h=hp();
      let p=[s[0] - u[0]*(9 - 3*e) + sd[0]*(4.5 - 1.5*e),0,s[2] - u[2]*(9 - 3*e) + sd[2]*(4.5 - 1.5*e)];p=col(p,.4);p[1]+=2.4 - .6*e + .03*sin(t*.7);
      const d=V3.dist(p,h),tg=mix(h,at(k.lz,5),.05);
      c.pos=p;c.target=tg;c.up=[0,1,0];c.near=.2;c.fov=cl(2*Math.atan(26/d),.17,.95);return;
   }
    if(S.cm==='cut'&&W.okc){// 집무실: 리옥선이 무전기를 내던진다
      const P=W.okc,f=fw(P.yaw),sd=[f[2],0,-f[0]],e=PP.eye(P),w=ss(0,1.9,S.ct);
      c.pos=[P.p[0] + f[0]*2.9 + sd[0]*(.8 - .3*w),P.p[1] + 1.4,P.p[2] + f[2]*2.9 + sd[2]*(.8 - .3*w)];
      c.target=[e[0],e[1] - .25,e[2]];c.up=[0,1,0];c.near=.08;c.fov=.85;return;
   }
    // 1인칭
    let tg=S.fix==='heli'?hp():S.fix&&(S.fix.p?S.fix.vis!==false&&PP.eye(S.fix):S.fix);
    if(!tg&&S.spk&&W[S.spk]&&W[S.spk].vis!==false) tg=PP.eye(W[S.spk]);
    if(!tg&&S.beat==='land') tg=W.ko&&W.ko.vis?PP.eye(W.ko):hp();
    if(!tg&&S.beat==='approach'&&W.ko) tg=PP.eye(W.ko);
    const ey=[me.p[0] - cos(me.yaw)*sin(me.bob)*.022*me.bA,me.p[1] + 1.6 + (ab(cos(me.bob)) - .7)*.04*me.bA,me.p[2] + sin(me.yaw)*sin(me.bob)*.022*me.bA];
    if(tg&&(S.bot||S.mv<0&&S.wk<0||S.t<S.fixF&&S.mv<0)){
      const d=[tg[0] - ey[0],tg[1] - ey[1],tg[2] - ey[2]],r=S.t<S.fixF?1.6:1.1;
      me.yaw+=wrap(Math.atan2(d[0],d[2]) - me.yaw)*mn(1,dt*r);me.pit+=(cl(Math.atan2(d[1],H(d[0],d[2])),-1,1) - me.pit)*mn(1,dt*r);
   }
    S.mv-=dt;S.wk-=dt;me.aim+=(me.aimT - me.aim)*mn(1,dt*5);
    const hv=RS().heli>.5&&RS().heli<1?(1 - ab(RS().heli - .9)*4)*.004:0,sh=mx(0,hv)*sin(t*37);// 하강풍 진동
    const yw=me.yaw + sh*.5,pt=me.pit + sh;
    T[0]=ey[0] + sin(yw)*cos(pt);T[1]=ey[1] + sin(pt);T[2]=ey[2] + cos(yw)*cos(pt);
    c.pos=ey;c.target=T.slice();c.up=[0,1,0];c.near=.08;c.fov=1.08 - .3*me.aim;
    const F=G.people.fp;F.kind='rok';F.gun='rifle';F.aim=me.aim;F.kick=0;F.reload=0;F.bob=me.bob;
    me.sw[0]*=.9;me.sw[1]*=.9;F.sway=me.sw;
 }
  function npc(dt){// 인물 이동 · 조준 · 말하기 · 시선
    const h=hp();
    for(const P of PP.list){
      if(P.tgt){const q=P.tgt==='heli'?h:P.tgt.p?chest(P.tgt):P.tgt;P.aim=q;P.face=q;}
      if(P.face&&!P.wp){const y=yawTo(P.p,P.face);P.yaw+=wrap(y - P.yaw)*mn(1,dt*2.5);}// 몸을 겨눈 쪽으로 천천히
      if(!P.wp) continue;
      const w=P.wp[0],dx=w[0] - P.p[0],dz=w[2] - P.p[2],d=H(dx,dz);
      if(d<.08||P.stk>3){if(d>=.08) P.p=at(w);P.wp.shift();P.stk=0;if(!P.wp.length){P.wp=null;P.free=0;P.pose='stand';P.done&&P.done(P);}continue;}// 3 s 막히면 경유점으로
      const s=mn(d,P.sp*dt),q=P.free?at([P.p[0] + dx/d*s,0,P.p[2] + dz/d*s]):col([P.p[0] + dx/d*s,P.p[1],P.p[2] + dz/d*s],.25);
      P.stk=dxz(q,P.p)<s*.3?P.stk + dt:0;P.p=q;
      P.yaw+=wrap(Math.atan2(dx,dz) - P.yaw)*mn(1,dt*5);
   }
    const talking=S.t<S.lineEnd;
    for(const k of ['col','park','ko']) if(W[k]) W[k].talk=talking&&S.spk===k&&S.line!=='리옥선'?1:0;
 }

  /* ── 환경 · 소리 ── */
  function dress(dt){
    const t=G.time,rs=RS(),k=K();
    // 헬기: 진행 · 로터 · 문
    if(S.hR>0&&rs.heli<S.hT) rs.heli=mn(S.hT,rs.heli + dt*S.hR*(1 - .65*ss(.8,1,rs.heli)));
    rs.rotor=(rs.rotor==null?1:rs.rotor) + cl(S.rotT - rs.rotor,-dt*.12,dt*.12);
    rs.door=(rs.door||0) + cl(S.doorT - (rs.door||0),-dt/1.3,dt/1.3);
    if(S.cut) G.setEnv({indoor:.85});else G.setEnv({indoor:0});
    G.shadowFocus=S.cut&&W.okc?W.okc.p:mix(at(k.start),at(k.lz),.35);G.shadowRange=S.cut?12:30;
    // 먼 연기 기둥
    if(!G.ruins&&G.fx&&G.fx.burst&&!S.cut&&(S.smT-=dt)<0){
      S.smT=.22;const u=U(),l=k.lz;
      for(const [a,b] of [[90,-55],[150,35],[120,95]]) G.fx.burst('smoke',[l[0] + u[0]*a + u[2]*b,gnd(l[0],l[2]) + 2,l[2] + u[2]*a - u[0]*b],{vel:[.9,4,.4],size:1.1});
   }
    // 소리
    if(G.frame % 2===0){
      const h=hp(),d=V3.dist(h,G.cam.pos),near=1/(1 + d/45),r=rs.rotor||0,f=3.6*r*2*PI,on=rs.heli<1||r>.05;
      const chop=.55 + .45*mx(0,sin(t*f))**2;
      G.sfx.loop('engine',on?1:0,{gain:mn(1,(.25 + 1.6*near)*r*chop*(S.cut?.25:1)),rate:.9 + .9*r});
      G.sfx.loop('sea',on?1:0,{gain:mn(.8,2.2*near*near*r*(rs.heli>.8?1:.3)*(S.cut?.2:1)),rate:1.5});// 하강풍
      const rb=S.rb>S.t,rg=rb?S.rg:S.radio&&S.spk==='ko'&&S.line==='리옥선'&&S.t<S.lineEnd?.07:S.radio?.022:0;
      G.sfx.loop('missile',rg>0?1:0,{gain:rg,rate:rb?7:5});// 무전 잡음
   }
    if(!S.cut&&(S.gunT-=dt)<0){// 먼 총성
      S.gunT=3 + R()*7;const a=R()*2*PI,r=260 + R()*400,p=[me.o[0] + sin(a)*r,8,me.o[2] + cos(a)*r],n=1 + (R()*4|0);
      for(let i=0;i<n;i++) later(i*(.09 + R()*.05),()=>G.sfx.play('rifle',{pos:p,gain:.5}));
   }
    const bk=ui.bk;if(bk){S.bk+=cl(S.bkT - S.bk,-dt*S.bkR,dt*S.bkR);bk.style.opacity=S.bk;}
    if(G.frame % 6===0&&G.cam.target) G.sfx.listener(G.cam.pos,V3.norm(V3.sub(G.cam.target,G.cam.pos)));
 }

  /* ── 대사 · 자막 ── */
  function showDl(v){ui.dl&&(ui.dl.style.opacity=v?1:0);}
  function say(l){
    const [w,s,a]=l,n=s.length;
    if(w==='*'){ui.cap.textContent=s;ui.cap.style.opacity=1;showDl(0);S.nx=S.t + 2.4 + n*.072;later(S.nx - S.t - .4,()=>ui.cap.style.opacity=0);return;}
    if(w==='#'){ui.ttl.textContent=s;ui.ttl.style.opacity=1;later(4.4,()=>ui.ttl.style.opacity=0);S.nx=S.t + .8;return;}
    const rd=w==='리옥선';// 무전 목소리: 이름 칸에 무전 표시, 글자는 지직거리는 무전 문체
    ui.dl.innerHTML=`<b style="color:${COL[w]||'#fff'}">${w}${rd?'<i class=s4r>무전</i>':''}</b>${rd?'<span class=s4q>' + s + '</span>':s}`;showDl(1);
    S.spk=who[w]||null;S.line=w;S.lineEnd=S.t + 1.3 + n*.078;S.nx=S.lineEnd + .5;
    if(rd){G.sfx.play('click',{gain:.7,rate:1.5});radioFx(.18,.12);}
    if(a) act(a);
 }
  const idx=b=>SC.findIndex(l=>l[0]==='@'&&l[1]===b);
  const GT={
    landed:()=>RS().heli>=.999||S.t - S.gt>25,
    arrived:()=>W.ko&&!W.ko.wp&&dxz(W.ko.p,K().meet)<.6&&S.t - S.gt>1.5||S.t - S.gt>40,
 };
  function run(dt){
    S.t+=dt;
    for(let i=wait.length - 1;i>=0;i--) if(S.t>=wait[i][0]){const f=wait[i][1];wait.splice(i,1);f();}
    for(let guard=0;S.on&&S.i<SC.length&&guard<50;guard++){
      const l=SC[S.i];
      if(l[0]==='?'){if(S.g!==l[1]){S.g=l[1];S.gt=S.t;}if(!GT[l[1]]()) break;S.g=null;S.i++;continue;}
      if(S.t<S.nx) break;
      S.i++;
      if(l[0]==='@'){S.beat=l[1];continue;}
      if(l[0]==='!'){if(l[2]>.5) showDl(0),S.spk=null;act(l[1]);if(S.beat!=='end') S.nx=S.t + l[2];continue;}
      say(l);
   }
 }
  function go(b){// 테스트 훅 · 재시작: 해당 장면 상태로 정확히 점프
    let n=BEATS.indexOf(b);if(n<0) n=0,b='intro';
    init4();if(S.cut) cut(0);
    if(b==='end'){stage(4);S.cm='fp';S.beat='end';end();return;}
    stage(n);S.beat=b;S.i=idx(b);S.nx=0;S.cm=n?'fp':'est';S.bk=S.bkT=n?0:1;S.ct=0;
    if(n) stageFp(),S.fixF=0;
    if(n===1) S.hT=.3;
 }
  function init4(){// 공통 시작 상태
    const ov=$('ov');ov&&(ov.style.display='none');
    ui.dl=$('dl');ui.cap=$('cap');ui.ttl=$('ttl');ui.bk=$('bk');ui.end=$('end');ui.sk=$('sk');
    for(const e of [ui.cap,ui.ttl]) e&&(e.style.opacity=0);
    ui.end&&(ui.end.style.display='none');ui.t.style.opacity=0;ui.h.style.opacity=0;
    G.cabin&&(G.cabin.on=false);G.village&&(G.village.on=false);G.palace&&(G.palace.on=false);G.ruins&&(G.ruins.on=true);
    S.on=1;S.t=0;S.dr=null;S.lineEnd=0;S.spk=null;S.line='';S.mv=0;S.wk=0;S.bkR=2;S.g=null;S.rb=0;S.radio=0;S.gunT=3;wait.length=0;showDl(0);
    const u=U(),az=Math.atan2(u[0],u[2])*180/PI + 48;// 낮은 해: 헬기 쪽 비스듬히 뒤
    G.setEnv(Object.assign({sunEl:8,sunAz:az,cloud:.8,haze:.6,cloudBase:1400,cloudTop:3200,indoor:0,exposure:1.1},RU().ENV));// 폐허 모듈이 정한 새벽이 우선
    G.sfx.init();G.sfx.loop('wind',1,{gain:.35,rate:.55});G.sfx.music('calm');
 }
  function start(){const sc=!S.st&&G.params.get('story')==='4'&&G.params.get('scene');S.st=1;go(sc||'intro');}
  function stop(){
    if(S.cut) cut(0);
    S.on=0;showDl(0);wait.length=0;G.people.fp.on=0;G.people.fp.kind='rok';G.people.fp.aim=0;
    G.ruins&&(G.ruins.on=false);ui.bk&&(ui.bk.style.opacity=0);ui.t&&(ui.t.style.opacity=0);ui.h&&(ui.h.style.opacity=0);
    for(const l of ['wind','engine','sea','missile']) G.sfx.loop(l,0);
 }
  function update(dt){
    if(!S.on) return;
    try {
      const sd=dt*(G.keys.Tab&&S.beat!=='end'?4:1);// Tab: 빨리 감기
      run(sd);npc(sd);
      if(S.cm==='fp'&&S.bk<.6) stepMe(dt);
      camera(dt);dress(sd);
      ui.sk&&(ui.sk.style.display=S.beat!=='end'?'block':'none');
   } catch (e){G.err('[story4] ' + (e.stack||e));}
 }
  const api=G.story4={S,go,start,stop,me,get on(){return !!S.on;},get bot(){return !!S.bot;},set bot(v){S.bot=!!v;}};
  G.register('story4',{
    init(){
      G.css(`#s4t,#s4h{position:absolute}
#s4t{inset:0;display:grid;place-content:center;text-align:center;color:#ebe4d8;opacity:0;transition:opacity 1.4s}
#s4t small{font:400 1.9vh system-ui;letter-spacing:.55em;color:#a9a196}#s4t b{display:block;font:800 6.4vh system-ui;letter-spacing:.14em;margin:.4em 0;color:#fff}
#s4h{left:5vw;top:17vh;font:400 1.6vh system-ui;color:#c8d0d8;text-shadow:0 1px 4px #000;opacity:0;transition:opacity 1s}
#dl .s4r{display:inline-block;margin-left:.6em;padding:0 .45em;font:700 .8em system-ui;font-style:normal;letter-spacing:.1em;color:#0b0f14;background:#ff8b7acc;border-radius:3px;vertical-align:.1em}
#dl .s4q{color:#ffe2db;letter-spacing:.02em;text-shadow:0 0 6px #ff8b7a55}`);
      ui.t=G.el('div',{id:'s4t',innerHTML:'<small>스토리 4</small><b>폐허가 된 서강 : 고혁명의 배신</b><small>대한민국편</small>'});
      ui.h=G.el('div',{id:'s4h',textContent:'WASD 이동 · 마우스 둘러보기 · 오른쪽 클릭 조준 · Tab 빨리 감기'});
      if(G.params.has('nohud')) ui.h.style.visibility='hidden';
      G.canvas.addEventListener('click',()=>{S.on&&S.beat!=='end'&&G.canvas.requestPointerLock&&G.canvas.requestPointerLock();});
      addEventListener('mousedown',e=>{if(S.on&&e.button===2) me.aimT=1;});
      addEventListener('mouseup',e=>{if(e.button===2) me.aimT=0;});
      addEventListener('contextmenu',e=>S.on&&e.preventDefault());
      addEventListener('mousemove',e=>{
        if(!S.on||S.cm!=='fp'||!(document.pointerLockElement===G.canvas||e.buttons)) return;
        const k=.0022*(1 - .5*me.aim);me.yaw-=e.movementX*k;me.pit=cl(me.pit - e.movementY*k,-1.3,1.3);S.mv=2.5;
        me.sw[0]=cl(me.sw[0] - e.movementX*.002,-.3,.3);me.sw[1]=cl(me.sw[1] + e.movementY*.002,-.3,.3);
     });
      const sk=$('sk');sk&&sk.addEventListener('click',()=>{if(S.on){S.nx=mn(S.nx,S.t);S.lineEnd=S.t;}});
   },
    update
 },'story');
  G.mode==='story'&&G.order.unshift(G.order.pop());// update 를 앞으로: 인물 · 폐허보다 먼저
}
