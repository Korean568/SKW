'use strict';
/* STORY 2 — 북한 마을 : 5일전으로 (조선민주주의인민공화국편) · 흐름 · 1인칭 보행 · 선택 · 엔딩 */
{
  const PP=G.people,sin=Math.sin,cos=Math.cos,PI=Math.PI,H=Math.hypot,cl=G.clamp,R=Math.random,mn=Math.min,ab=Math.abs;
  const BEATS=['square','house','search','found','drag','choice','refuse','execute','burn','end'];
  const LAST='남은 배반자들도 다 처리하라우. 마을도 싹다 불태우고.';
  // 대본: [화자,대사,연출?] / '*' 해설 / '#' 장면 제목(괄호 지문) / '!' 연출,대기초 / '?' 조작 관문 / '@' 장면 / '>' 분기
  const SC=[
    ['@','square'],['!','card',4.4],['!','fade',1.6],['#','전쟁이 시작하기 5일 전'],
    ['*','리충성이 국무위원장이 되자마자, 그의 누나 리옥선은 한국과 내통하거나 스파이이거나 무고한데 의심받는 시민들을 처형한다. 당신은 여기서 북한 군인 ‘동무’이다.'],
    ['!','fp',1.4],
    ['리옥선','모든 가주들을 끌어내라우.','haul'],
    ['고혁명','예 알겠습니다 리옥선 동지.'],
    ['고혁명','동무. 저 집에 있는 사람 끌어내라우. 난 이집을 맡겠소.','point'],// (어떤 집을 가르키며) = 연출
    ['!','koB',.2],['동무','예!'],
    ['@','house'],['!','play',0],['?','door'],['!','',.8],
    ['@','search'],['?','search'],
    ['동무','이 집은 빈 것 같습네다.'],// (집을 수색하며) = 조작
    ['고혁명','그럼 나와 함께 이 집을 수색하라우.'],['?','withko'],
    ['@','found'],['!','reveal',.7],['동무','여기 사람 한명있습네다!'],
    ['@','drag'],['?','grab'],['?','wall'],['!','atwall',3.4],
    ['@','choice'],['리옥선','처형하라우.'],['!','choose',0],['?','choice'],['>',()=>S.choice],
    ['@','refuse'],['!','lower',1.4],['리옥선','그럼 배반자와 함께 죽으시오.'],['!','draw',1.8],['!','shotMe',2.6],['리옥선',LAST],['>','burn'],
    ['@','execute'],['!','raise',2.8],['!','shot',3.2],['!','back',1.8],['리옥선',LAST],
    ['@','burn'],['!','burn',14],
    ['@','end'],['!','end',0],
  ];
  const COL={'리옥선':'#ff8b7a','고혁명':'#ffc27a','동무':'#c9d89a'},who={'리옥선':'ok','고혁명':'ko'};
  const S={on:0,beat:'',line:-1,choice:null,sc:0,t:0,i:0,nx:0,cm:'fp',g:null,f:{},walk:0,fix:null,fixF:0,mv:0,spk:null,lineEnd:0,bk:0,bkT:0,bkR:2,ind:0,fireT:0,drag:0,lock:0};
  const me={p:[0,0,0],yaw:0,pit:0,bob:0,bA:0,kick:0,aim:0,aimT:0,st:0,sw:[0,0]};
  const W={crowd:[],guards:[],pairs:[]},wait=[],ui={};
  const later=(s,f)=>wait.push([S.t + s,f]);
  const L=(p,rgb,I,r)=>G.addLight(p,rgb,I*4,r,2*Math.max(G.dt,1e-3));// 한 프레임 점광
  const $=id=>document.getElementById(id);

  /* ── 마을 계약 (없으면 대체값: 광장 둘레 6채) ── */
  const FK=(()=>{
    const houses=[],P=(a,r,y=0)=>[sin(a)*r,y,cos(a)*r];
    for(let i=0;i<6;i++){const a=i/6*2*PI + .5;houses.push({door:P(a,14),yaw:a + PI,inside:P(a,16.5),rooms:[P(a,16.5),P(a + .1,18)],hide:[...P(a - .08,18.4),a + PI]});}
    const ring=(n,r,o)=>Array.from({length:n},(_,i)=>{const a=i/n*2*PI + o;return[...P(a,r),a + PI];});
    return{start:[5,0,-7,-.5],ko:[6.2,0,-6.2,-.6],officer:[-1,0,7,PI],wall:[-9,0,2,-PI/2],line:[-3,0,2,-PI/2],houses,A:1,B:2,
      crowd:ring(10,4,.2),guards:ring(6,7.5,.5),fires:houses.flatMap(h=>[[h.inside[0],4,h.inside[2]],[h.door[0],3,h.door[2]]])};
 })();
  const VL=()=>G.village||{};
  const K=()=>{const k=VL().K;return k&&k.houses&&k.houses.length&&k.start?k:FK;};
  function vc(f,...a){const v=VL();try {return typeof v[f]==='function'?v[f](...a):undefined;} catch (e){G.err('[story2] village.' + f + ' ' + e);}}
  const gnd=(x,z)=>{const y=vc('ground',x,z);return Number.isFinite(y)?y:0;};
  const col=(p,r)=>{const q=vc('collide',p,r);return q&&Number.isFinite(q[0])&&Number.isFinite(q[1])?[q[0],q[1],q[2]]:[p[0],gnd(p[0],p[2]),p[2]];};
  const hs=i=>K().houses[i]||K().houses[0];
  const iA=()=>{const k=K();return (k.A|0) % k.houses.length;};
  const iB=()=>{const k=K(),n=k.houses.length,b=(k.B|0) % n;return b===iA()?(b + 1) % n:b;};
  const fw=y=>[sin(y),0,cos(y)];
  const dxz=(a,b)=>H(a[0] - b[0],a[2] - b[2]);
  const yawTo=(a,b)=>Math.atan2(b[0] - a[0],b[2] - a[2]);
  const wrap=a=>Math.atan2(sin(a),cos(a));
  const out=(h,d)=>[h.door[0] + sin(h.yaw)*d,h.door[1],h.door[2] + cos(h.yaw)*d];// 문 앞(밖) d m · 음수 = 안
  const rooms=h=>h.rooms&&h.rooms.length?h.rooms:[h.inside];
  const tour=h=>rooms(h).flatMap(r=>[h.inside,r]);// 방마다 본채를 거쳐 감 (봇)
  const inside=p=>{const i=vc('inside',p);if(Number.isInteger(i)) return i;const k=K();return k.houses.findIndex(h=>dxz(p,h.inside)<3);};
  const at=(q,dy=0)=>[q[0],gnd(q[0],q[2]) + dy,q[2]];
  const doors=()=>{const s=VL().S;return s&&s.doors;};
  function door(i,anim){const d=doors();if(d&&d[i]) return;if(anim&&VL().breakDoor) vc('breakDoor',i);else if(d) d[i]=1;}
  const line=()=>{// 처형 장소: u = 사수→벽 방향, v = 옆
    const k=K(),w=k.wall,l=k.line,u=[w[0] - l[0],0,w[2] - l[2]],n=H(u[0],u[2])||1;u[0]/=n;u[2]/=n;
    return{w,l,u,v:[u[2],0,-u[0]],y:Math.atan2(u[0],u[2])};
 };
  const off=(p,u,a,v,b)=>[p[0] + u[0]*a + v[0]*b,0,p[2] + u[2]*a + v[2]*b];

  /* ── 인물 ── */
  const add=(k,o)=>PP.add(k,Object.assign({pose:'stand',gun:0},o));
  function walk(P,pts,sp,done,pose){P.wp=pts.map(q=>q.slice());P.sp=sp;P.done=done;P.wpose=pose||'walk';P.pose=P.wpose;P.vis=true;P.stk=0;}
  const centre=()=>{const c=K().crowd;let x=0,z=0;for(const q of c){x+=q[0];z+=q[2];}return[x/c.length,.6,z/c.length];};
  function stage(n){// n = 장면 번호: 그 장면 시작 상태를 누적 배치
    const k=K(),A=iA(),B=iB(),Lx=line(),cc=centre();
    PP.clear();W.crowd=[];W.guards=[];W.pairs=[];wait.length=0;
    const d=doors();if(d) d.fill(0);const vs=VL().S;if(vs) vs.fire=0;S.fireT=0;
    W.ok=add('nkf',{p:at(k.officer),yaw:k.officer[3],seed:71,look:cc});
    const kd=dxz(k.ko,k.start)||1,ks=mn(1,kd)*Math.max(1,2.4/kd);// 고혁명: 플레이어와 2.4 m 이상 (화면을 가리지 않게)
    W.ko=add('nko',{p:at([k.start[0] + (k.ko[0] - k.start[0])*ks,0,k.start[2] + (k.ko[2] - k.start[2])*ks]),yaw:k.ko[3],seed:23});
    k.guards.forEach((q,i)=>W.guards.push(add('nk',{p:at(q),yaw:q[3],gun:'ak',seed:31 + i*3,look:cc})));
    const ph=k.houses.map((h,i)=>i).filter(i=>i!==A&&i!==B).slice(0,4),np=n?0:mn(ph.length,4,k.crowd.length - 2);
    k.crowd.forEach((q,i)=>{
      const P=add('vil',{p:at(q),yaw:q[3],pose:'kneel',seed:101 + i*7});P.look=at(off(q,fw(q[3]),1.4,[0,0,0],0));W.crowd.push(P);
      if(i>=k.crowd.length - np){// 끌려 나올 사람: 집 안에서 대기
        const h=hs(ph[k.crowd.length - 1 - i]),s=add('nk',{p:at(out(h,-.6)),yaw:h.yaw,gun:'ak',seed:61 + i});
        P.p=at(out(h,-.2));P.vis=s.vis=false;P.pose='drag';W.pairs.push({P,s,h:ph[k.crowd.length - 1 - i],q});
     }
   });
    if(n) for(const i of ph) door(i);
    const hb=hs(B),hd=hb.hide||[...hb.inside,hb.yaw + PI];
    W.vic=add('vil',{p:at(hd),yaw:hd[3]||0,pose:'cower',seed:207,vis:n>=3&&n<7});
    if(n>=1){door(B);W.ko.p=at(out(hb,1.4));W.ko.yaw=hb.yaw + .4;}
    if(n>=2) door(A);
    if(n>=3){W.ko.p=at(out(hb,-1.4));W.ko.yaw=yawTo(W.ko.p,hd);W.ko.look=at(hd,.6);}
    if(n>=4) W.vic.look=at(out(hb,0),1.6);
    if(n>=5) atwall(1);
    if(n>=7){PP.remove(W.vic);W.vic=null;}
    // 플레이어
    const nr=rooms(hb).slice().sort((a,b)=>dxz(a,hd) - dxz(b,hd))[0];
    const st=n<1?k.start:n<2?k.start:n<3?[...out(hs(A),-1.1),hs(A).yaw + PI]:n<5?[...nr,yawTo(nr,hd)]:[...Lx.l.slice(0,3),Lx.y];
    me.p=at(st);me.yaw=n===1?yawTo(st,hs(A).door):st[3]||0;me.pit=-.04;me.aim=me.aimT=0;me.kick=0;S.drag=0;
    S.walk=n>=1&&n<=4?1:0;S.lock=0;S.fix=null;S.f={};S.vA={};S.inA=S.inB=0;
    G.people.fp.on=n>=1&&n<8?1:0;
 }
  function haul(){// (가주들을 끌어낸다) — 문을 부수고 병사가 한 명씩 광장으로 끌고 온다
    W.pairs.forEach((r,j)=>later(.4 + j*1.6,()=>{
      door(r.h,1);
      later(1,()=>{
        const h=hs(r.h),P=r.P;P.vis=r.s.vis=true;r.s.fol=P;
        walk(P,[out(h,1.4),r.q],1.05,()=>{P.pose='kneel';P.yaw=r.q[3];r.s.fol=null;
          const g=off(r.q,fw(r.q[3]),-1.7,[0,0,0],0);walk(r.s,[g],1.2,Q=>{Q.yaw=r.q[3];Q.look=centre();});},'drag');
     });
   }));
 }
  function atwall(now){// 처형 장소 배치: 벽을 바라보고 무릎 꿇음 (얼굴은 보이지 않음)
    const x=line(),V=W.vic;
    if(V){V.vis=true;V.wp=null;V.p=at(x.w);V.yaw=x.y;V.pose='kneel';V.look=at(off(x.w,x.u,1.2,x.v,0),.3);}
    me.p=at(x.l);me.yaw=x.y;me.pit=-.12;S.walk=0;S.drag=0;
    const o=at(off(x.l,x.u,1.6,x.v,2.6)),g=at(off(x.l,x.u,.2,x.v,-2.8));
    if(now){W.ok.p=o;W.ok.yaw=yawTo(o,x.l);W.ko.p=g;W.ko.yaw=yawTo(g,x.w);}
    else{walk(W.ok,[o],1.1,P=>P.yaw=yawTo(P.p,x.l));W.ko.wp=null;W.ko.p=at(off(x.l,x.u,-3,x.v,-3));walk(W.ko,[g],1.3,P=>P.yaw=yawTo(P.p,x.w));}
    W.ok.look=me.p;W.ko.look=x.w;
 }

  /* ── 연출 ── */
  function act(a){
    const k=K(),x=line();
    if(a==='card'){S.cm='est';S.bk=S.bkT=1;ui.t.style.opacity=1;later(3.4,()=>ui.t.style.opacity=0);}
    if(a==='fade'){S.bkT=0;S.bkR=.7;}
    if(a==='fp'){S.bk=1;S.bkT=0;S.bkR=1.6;S.cm='fp';G.people.fp.on=1;me.p=at(k.start);me.yaw=k.start[3];me.pit=-.05;}
    if(a==='haul') haul();
    if(a==='point'){// (어떤 집을 가르키며)
      const P=W.ko,d=at(hs(iA()).door,1.4);P.pose='point';P.look=d;
      later(1.2,()=>{S.fix=d;S.fixF=S.t + 3.2;});
   }
    if(a==='koB'){const h=hs(iB());W.ko.look=null;walk(W.ko,[out(h,1.4)],1.5,P=>{door(iB(),1);P.yaw=h.yaw + .4;P.look=me.p;});S.fix=null;}
    if(a==='play'){S.walk=1;ui.h.style.opacity=1;later(9,()=>ui.h.style.opacity=0);}
    if(a==='reveal'){// (집 곳곳을 수색하다가 사람을 발견한다)
      const V=W.vic,h=hs(iB());if(!V) return;
      V.vis=true;V.look=null;const q=V.p,d=dxz(q,me.p)||1,e=[q[0] + (me.p[0] - q[0])/d*mn(1,d - 1.2),0,q[2] + (me.p[2] - q[2])/d*mn(1,d - 1.2)];// 숨은 곳에서 한 걸음 끌려 나옴
      walk(V,[e],.7,P=>{P.pose='cower';P.yaw=yawTo(P.p,me.p);},'cower');S.fix=at(e,.7);S.fixF=S.t + 2.4;
      walk(W.ko,[out(h,0),out(h,-1.4)],1.4,P=>{P.yaw=yawTo(P.p,V.p);P.look=at(V.p,.6);});
   }
    if(a==='atwall'){S.bkT=1;S.bkR=5;later(.35,()=>{atwall(0);S.bkT=0;S.bkR=1.2;S.fix=at(x.w,.8);S.fixF=S.t + 3;});}
    if(a==='choose'){// 선택: 음악을 끄고 바람 소리만 · 천천히
      gate('choice');S.lock=1;S.fix=at(x.w,.75);G.sfx.music('off');G.sfx.loop('sea',1,{gain:.12,rate:.4});
      ui.c.style.display='flex';ui.v.style.opacity=1;showDl(0);document.pointerLockElement&&document.exitPointerLock();
   }
    if(a==='lower'){me.aimT=0;S.fix=W.ok;S.fixF=1e9;}
    if(a==='draw'){const P=W.ok;P.gun='pistol';P.pose='aim';P.aim=G.cam.pos.slice();G.sfx.play('click',{gain:.6,rate:.7});}
    if(a==='shotMe'){// (동무는 총에 맞아 죽는다) — 총성과 함께 암전
      S.bk=S.bkT=1;G.sfx.play('gun',{gain:1.4,rate:1.2});G.sfx.play('pistol');G.people.fp.on=0;S.walk=0;showDl(0);
      G.sfx.loop('sea',1,{gain:.05,rate:.3});
   }
    if(a==='raise'){me.aimT=1;S.fix=at(x.w,.85);S.fixF=1e9;}
    if(a==='shot'){// 총성 순간 암전 — 몸은 보여주지 않는다
      S.bk=S.bkT=1;me.kick=1;G.sfx.play('gun',{gain:1.5});G.sfx.play('rifle');
      later(.6,()=>{if(W.vic){PP.remove(W.vic);W.vic=null;}me.aimT=me.aim=0;});
   }
    if(a==='back'){S.bkT=0;S.bkR=.7;S.fix=W.ok;S.fixF=1e9;W.ok.look=me.p;}
    if(a==='burn'){// 마을이 불탄다
      S.fireT=1;S.lock=0;ui.v.style.opacity=0;G.people.fp.on=0;W.ok.pose='stand';W.ok.gun=0;W.ok.aim=null;
      if(W.vic){PP.remove(W.vic);W.vic=null;}
      if(S.cm==='fp'){S.e0=G.cam.pos.slice();S.t0=G.cam.target.slice();}
      S.cm=S.choice==='refuse'?'out':'pull';S.ct=0;
      S.bkT=0;S.bkR=S.choice==='refuse'?.6:2;G.sfx.loop('sea',1,{gain:.35,rate:.7});G.sfx.music('calm');
      for(const P of W.guards){P.look=centre();}
   }
    if(a==='end') end();
 }
  function end(){
    S.beat='end';S.nx=1e9;showDl(0);gate(null);document.pointerLockElement&&document.exitPointerLock();
    const e=ui.end;if(!e) return;
    e.innerHTML='<h2>스토리 2 — 끝</h2><p class=c>북한 마을 : 5일전으로 · 조선민주주의인민공화국편</p><div><button>처음 화면</button> <button>다시 하기</button></div>';
    const b=e.querySelectorAll('button');
    b[0].onclick=()=>{e.style.display='none';G.story&&G.story.title?G.story.title():(stop(),location.reload());};
    b[1].onclick=()=>{e.style.display='none';start();};
    e.style.display='grid';
 }

  /* ── 조작 관문 (목표 · 표지 · 상호작용) ── */
  const OBJ={door:'저 집 문을 부숴라',search:'집을 수색하라',withko:'고혁명 동무와 함께 저 집을 수색하라',grab:'숨어 있던 사람을 끌어내라',wall:'광장의 처형장으로 끌고 가라'};
  const GT={
    door:()=>S.f.door,
    search:()=>{const r=rooms(hs(iA()));return Object.keys(S.vA).length>=mn(2,r.length)||S.inA>15;},
    withko:()=>{const h=hs(iB()),hd=h.hide||h.inside;return inside(me.p)===iB()&&(dxz(me.p,hd)<2.4||S.inB>14);},
    grab:()=>S.drag,
    wall:()=>{const x=line();return dxz(me.p,x.l)<2.8||dxz(me.p,x.w)<3.6;},
    choice:()=>!!S.choice,
 };
  function gate(g){
    S.g=g;S.gt=S.t;ui.o&&(ui.o.textContent=g&&OBJ[g]?'▸ ' + OBJ[g]:'',ui.o.style.opacity=g&&OBJ[g]?1:0);
    const A=hs(iA()),B=hs(iB()),x=line(),hd=B.hide||B.inside;
    S.path=g==='door'?[out(A,1)]:g==='search'?[out(A,-.4),out(A,-1.4),...tour(A),A.inside]
      :g==='withko'?[A.inside,out(A,-1.2),out(A,0),out(A,1.4),out(B,1.4),out(B,0),out(B,-1.3),...tour(B),hd]
      :g==='grab'&&W.vic?[W.vic.p.slice()]:g==='wall'?[B.inside,out(B,-1.2),out(B,0),out(B,1.6),x.l]:null;
    S.path=S.path&&S.path.map(q=>q.slice());
 }
  function mark(){// 목표 표지 (문 · 사람 · 처형장)
    const g=S.g,A=hs(iA()),B=hs(iB());
    let q=g==='door'?A.door:g==='withko'&&inside(me.p)!==iB()?B.door:g==='grab'&&W.vic&&!S.drag?W.vic.p:g==='wall'?line().w:null;
    const m=ui.m;if(!m) return;
    if(!q||S.bk>.5){m.style.display='none';return;}
    const p=G.project([q[0],(q[1]||gnd(q[0],q[2])) + 1.5,q[2]]);
    if(p[2]<=0){m.style.display='none';return;}
    m.style.display='block';m.style.left=p[0] + 'px';m.style.top=p[1] + 'px';m.lastChild.textContent=Math.round(dxz(me.p,q)) + ' m';
 }
  function interact(){// [E] 상호작용 후보
    if(!S.walk) return null;
    if(S.g==='door'&&dxz(me.p,out(hs(iA()),.9))<1.8) return ['[E] 문 부수기',()=>{door(iA(),1);S.f.door=1;me.kick=1;G.sfx.play('door');}];
    if(S.g==='grab'&&W.vic&&W.vic.vis&&dxz(me.p,W.vic.p)<2.4) return ['[E] 끌고 가기',()=>{S.drag=1;W.vic.pose='drag';W.vic.look=null;S.fix=null;G.sfx.play('hit',{gain:.15,rate:.4});}];
    return null;
 }
  function choose(c){if(S.g!=='choice'||S.choice) return;S.choice=c;ui.c.style.display='none';G.sfx.play('click',{gain:.4,rate:.5});}

  /* ── 1인칭 보행 ── */
  function bot(dt){// 자동 진행(테스트): 경로점을 따라 걷는다
    const w=S.path&&S.path[0];if(!w){if(S.g&&S.g!=='choice'&&(S.rp=(S.rp||0) + dt)>2){S.rp=0;gate(S.g);}return 0;}// 경로가 끝났는데 관문이 남으면 다시 계획
    const d=dxz(me.p,w);if(d<(S.path.length>1?.8:.45)){S.path.shift();if(w[4]!==1) S.sc=0;return 0;}
    const a=wrap(yawTo(me.p,w) - me.yaw);me.yaw+=a*mn(1,dt*7);me.pit+=(-.06 - me.pit)*mn(1,dt*3);
    S.bs=(S.bs||0) + dt;if(S.bs>1.2){if(S.bp&&dxz(me.p,S.bp)<.2){const s=S.sd=-(S.sd||1);if(++S.sc>4){S.sc=0;S.path.shift();}else S.path.unshift([me.p[0] - cos(me.yaw)*1.5*s,0,me.p[2] + sin(me.yaw)*1.5*s,0,1]);}S.bs=0;S.bp=me.p.slice();}// 막히면 옆으로 비켜 감
    return ab(a)<.8?1:.15;
 }
  function stepMe(dt){
    const k=G.keys;let f=0,s=0;
    if(S.bot) f=bot(dt);else {f=(k.KeyW||k.ArrowUp?1:0) - (k.KeyS||k.ArrowDown?1:0);s=(k.KeyD||k.ArrowRight?1:0) - (k.KeyA||k.ArrowLeft?1:0);}
    const n=H(f,s)||1,sp=(S.drag?1.2:k.ShiftLeft&&!S.bot?3.3:1.75)/n,vx=(sin(me.yaw)*f - cos(me.yaw)*s)*sp,vz=(cos(me.yaw)*f + sin(me.yaw)*s)*sp;
    const p0=me.p.slice(),m=Math.ceil(dt/.034),h=dt/m;
    for(let i=0;i<m;i++) me.p=col([me.p[0] + vx*h,me.p[1],me.p[2] + vz*h],.3);
    const v=dt>0?dxz(me.p,p0)/dt:0,b0=Math.floor(me.bob/PI);
    me.bob+=v*dt*4.2;me.bA+=((v>.3?1:0) - me.bA)*mn(1,dt*7);
    if(Math.floor(me.bob/PI)!==b0&&me.bA>.3) G.sfx.play('click',{gain:.55,rate:.18 + R()*.05});// 발소리
    if(S.drag&&W.vic){// 끌려가는 사람: 0.8 m 앞
      const V=W.vic,q=col([me.p[0] + sin(me.yaw)*.8,me.p[1],me.p[2] + cos(me.yaw)*.8],.25);
      V.p=q;V.yaw+=wrap(me.yaw - V.yaw)*mn(1,dt*8);
   }
    // 방 수색 기록
    const A=iA(),B=iB(),wh=inside(me.p);
    if(wh===A){S.inA+=dt;rooms(hs(A)).forEach((r,i)=>{if(dxz(me.p,r)<1.5) S.vA[i]=1;});}
    if(wh===B) S.inB+=dt;
 }
  const E=[0,0,0],T=[0,0,0];
  function camera(dt){
    const c=G.cam,t=G.time,k=K();
    if(S.cm==='est'){// 시작: 광장 위에서 천천히 내려오는 크레인
      S.ct=(S.ct||0) + dt;const u=mn(S.ct/16,1),e=u*u*(3 - 2*u),s=k.start,b=fw(s[3]),cc=centre();
      E[0]=s[0] - b[0]*(14 - 7*e) + b[2]*4;E[2]=s[2] - b[2]*(14 - 7*e) - b[0]*4;E[1]=gnd(E[0],E[2]) + 10 - 7*e;
      c.pos=E.slice();c.target=[cc[0],cc[1] + .4 - 1.5*(1 - e),cc[2]];c.fov=.78;c.near=.3;c.up=[0,1,0];return;
   }
    if(S.cm==='pull'||S.cm==='out'){// 불타는 마을: 뒤로·위로 빠지는 카메라 / 밖에서 본 마을
      S.ct=(S.ct||0) + dt;const u=mn(S.ct/13,1),e=u*u*(3 - 2*u),cc=[0,2.2,0];
      if(S.cm==='pull'){
        const d=[S.e0[0] - cc[0],0,S.e0[2] - cc[2]],n=H(d[0],d[2])||1,r=7,Ex=cc[0] + d[0]/n*r,Ez=cc[2] + d[2]/n*r,tx=cc[0] - d[0]/n*9,tz=cc[2] - d[2]/n*9;// 광장 위로 올라 맞은편 불타는 집들을 봄
        c.pos=[S.e0[0] + (Ex - S.e0[0])*e,S.e0[1] + (gnd(Ex,Ez) + 11 - S.e0[1])*e,S.e0[2] + (Ez - S.e0[2])*e];
        c.target=[S.t0[0] + (tx - S.t0[0])*e,S.t0[1] + (1.5 - S.t0[1])*e,S.t0[2] + (tz - S.t0[2])*e];
     } else {
        let rr=0,ga=0,gm=0;const an=k.houses.map(h=>Math.atan2(h.inside[0],h.inside[2])).sort((a,b)=>a - b);
        for(const h of k.houses) rr=Math.max(rr,H(h.inside[0],h.inside[2]));
        an.forEach((a,i)=>{const b=i + 1<an.length?an[i + 1]:an[0] + 2*PI;if(b - a>gm){gm=b - a;ga=(a + b)/2;}});// 집 사이 가장 넓은 틈으로 들여다봄
        const a=ga + .15 - S.ct*.01,r=rr + 30 - 5*e,x=sin(a)*r,z=cos(a)*r;
        c.pos=[x,gnd(x,z) + 13 - 2*e,z];c.target=[0,2.5,0];
     }
      c.fov=.8;c.near=.3;c.up=[0,1,0];return;
   }
    // 1인칭
    let tg=S.fix&&(S.fix.p?PP.eye(S.fix):S.fix);
    if(!tg&&!S.walk&&S.spk&&W[S.spk]&&W[S.spk].vis!==false) tg=PP.eye(W[S.spk]);
    const ey=[me.p[0] - cos(me.yaw)*sin(me.bob)*.022*me.bA,me.p[1] + 1.62 + (ab(cos(me.bob)) - .7)*.04*me.bA,me.p[2] + sin(me.yaw)*sin(me.bob)*.022*me.bA];
    if(!S.walk) me.bA*=.9;
    if(tg&&(S.lock||S.t<S.fixF||!S.walk&&(S.mv<0||S.bot))){
      const d=[tg[0] - ey[0],tg[1] - ey[1],tg[2] - ey[2]],r=S.lock?.7:1.8;
      me.yaw+=wrap(Math.atan2(d[0],d[2]) - me.yaw)*mn(1,dt*r);me.pit+=(cl(Math.atan2(d[1],H(d[0],d[2])),-1,1) - me.pit)*mn(1,dt*r);
   }
    S.mv-=dt;me.kick=Math.max(0,me.kick - dt*2.2);me.aim+=(me.aimT - me.aim)*mn(1,dt*1.3);
    const kk=me.kick*me.kick,yw=me.yaw + kk*.03*sin(t*31),pt=me.pit + kk*.09 + (S.lock?.004*sin(t*.7):0);
    T[0]=ey[0] + sin(yw)*cos(pt);T[1]=ey[1] + sin(pt);T[2]=ey[2] + cos(yw)*cos(pt);
    c.pos=ey;c.target=T.slice();c.up=[0,1,0];c.near=.08;c.fov=1.12 - .25*me.aim;
    const F=G.people.fp;F.kind='nk';F.gun='ak';F.aim=me.aim;F.kick=me.kick*.6;F.bob=me.bob;
    me.sw[0]*=.9;me.sw[1]*=.9;F.sway=me.sw;
 }
  function npc(dt){// 인물 이동 (경로점 · 따라 걷기) · 말하기 · 시선
    for(const P of PP.list){
      if(P.fol){const T2=P.fol;P.vis=T2.vis;P.p=at([T2.p[0] - sin(T2.yaw)*.62,0,T2.p[2] - cos(T2.yaw)*.62]);P.yaw=T2.yaw;P.pose=T2.wp?'escort':'stand';continue;}
      if(!P.wp) continue;
      const w=P.wp[0],dx=w[0] - P.p[0],dz=w[2] - P.p[2],d=H(dx,dz);
      P.stk+=dt;
      if(d<.08||P.stk>8){P.wp.shift();P.stk=0;if(d>=.08) P.p=at(w);if(!P.wp.length){P.wp=null;P.pose=P.wpose==='drag'?'kneel':'stand';P.done&&P.done(P);}continue;}
      const s=mn(d,P.sp*dt),q=col([P.p[0] + dx/d*s,P.p[1],P.p[2] + dz/d*s],.25);P.p=q;
      P.yaw+=wrap(Math.atan2(dx,dz) - P.yaw)*mn(1,dt*6);
   }
    const talking=S.t<S.lineEnd;
    for(const k of ['ok','ko']) if(W[k]){W[k].talk=talking&&S.spk===k?1:0;}
    if(W.ok&&W.ok.pose!=='aim'&&S.cm==='fp') W.ok.look=S.spk==='ok'||S.beat==='choice'?G.cam.pos:W.ok.look;
    if(W.ko&&W.ko.pose==='point'&&S.t>S.lineEnd + .3&&!W.ko.wp) W.ko.pose='stand';
 }
  function dress(dt){// 환경 · 조명 · 소리
    const t=G.time,fp=S.cm==='fp',wi=fp?inside(me.p):-1,vs=VL().S;
    S.ind+=((wi>=0?.8:0) - S.ind)*mn(1,dt*3);
    G.setEnv({indoor:S.ind,exposure:1.2 + .1*S.ind});for(let i=0;i<3;i++) G.sun.col[i]*=.42;// 흐린 날: 구름에 가린 해 (직사광 약하게, 하늘빛 위주)
    G.shadowFocus=fp?me.p:[0,0,0];G.shadowRange=fp?(wi>=0?14:32):45;
    if(wi>=0){const e=G.cam.pos;L([e[0] + sin(me.yaw)*.6,e[1] + .5,e[2] + cos(me.yaw)*.6],[1,.84,.66],.45,4);}// 실내: 약한 채움광 (주광은 마을 셰이더의 문·창 낮빛)
    if(vs){
      if(S.fireT) vs.fire=mn(1,(vs.fire||0) + dt/7);
      const f=vs.fire||0;
      if(f>.02){// 가까운 불 3곳: 주황 점광
        const c=G.cam.pos,fs=(K().fires||[]).slice().sort((a,b)=>V3.dist(a,c) - V3.dist(b,c));
        for(let i=0;i<mn(3,fs.length);i++) L(fs[i],[1,.46,.16],f*(5 + 1.5*sin(t*11 + i*2) + sin(t*23 + i)),15);
     }
   }
    const bk=ui.bk;if(bk){S.bk+=cl(S.bkT - S.bk,-dt*S.bkR,dt*S.bkR);bk.style.opacity=S.bk;}
    if(G.frame % 6===0&&G.cam.target) G.sfx.listener(G.cam.pos,V3.norm(V3.sub(G.cam.target,G.cam.pos)));
 }

  /* ── 대사 · 자막 (스토리 1과 같은 요소) ── */
  function showDl(v){ui.dl&&(ui.dl.style.opacity=v?1:0);}
  function say(l){
    const [w,s,a]=l,n=s.length;
    if(w==='*'){ui.cap.textContent=s;ui.cap.style.opacity=1;showDl(0);S.nx=S.t + 2.2 + n*.07;later(S.nx - S.t - .6,()=>ui.cap.style.opacity=0);return;}
    if(w==='#'){ui.ttl.textContent=s;ui.ttl.style.opacity=1;later(4.4,()=>ui.ttl.style.opacity=0);S.nx=S.t + 1.4;return;}
    ui.dl.innerHTML=`<b style="color:${COL[w]||'#fff'}">${w}</b>${s}`;showDl(1);
    S.spk=who[w]||(w==='동무'?'me':null);S.lineEnd=S.t + 1.2 + n*.075;S.nx=S.lineEnd + .45;
    if(a) act(a);
 }
  const idx=b=>SC.findIndex(l=>l[0]==='@'&&l[1]===b);
  function run(dt){
    S.t+=dt;
    for(let i=wait.length - 1;i>=0;i--) if(S.t>=wait[i][0]){const f=wait[i][1];wait.splice(i,1);f();}
    for(let guard=0;S.on&&S.i<SC.length&&guard<50;guard++){
      const l=SC[S.i];
      if(l[0]==='?'){if(S.g!==l[1]) gate(l[1]);if(!GT[l[1]]()) break;gate(null);S.i++;continue;}
      if(S.t<S.nx) break;
      S.i++;S.line=S.i - 1;
      if(l[0]==='@'){S.beat=l[1];continue;}
      if(l[0]==='>'){const b=typeof l[1]==='function'?l[1]():l[1];S.i=mn(SC.length,Math.max(0,idx(b)));continue;}
      if(l[0]==='!'){if(l[2]>.5) showDl(0),S.spk=null;act(l[1]);if(S.beat!=='end') S.nx=S.t + l[2];continue;}
      say(l);
   }
 }
  function go(b){// 테스트 훅 · 재시작: 해당 장면 상태로 정확히 점프
    let n=BEATS.indexOf(b);if(n<0) n=0,b='square';
    init2();S.choice=b==='refuse'?'refuse':b==='execute'?'execute':n>=8?(api.botChoice==='refuse'?'refuse':'execute'):null;
    stage(n);S.beat=b;S.i=idx(b);S.nx=0;S.cm=n?'fp':'est';S.bk=S.bkT=0;S.ct=0;
    if(n>=6&&n<8){S.lock=1;S.fix=line().w;}
    if(n>=8){S.cm='x';S.e0=at(line().l,1.62);S.t0=at(W.ok.p,1.5);}
    if(n===9){S.fireT=1;const vs=VL().S;vs&&(vs.fire=1);S.cm=S.choice==='refuse'?'out':'pull';S.ct=20;}
 }
  function init2(){// 공통 시작 상태
    const ov=$('ov');ov&&(ov.style.display='none');
    ui.dl=$('dl');ui.cap=$('cap');ui.ttl=$('ttl');ui.bk=$('bk');ui.end=$('end');ui.sk=$('sk');
    for(const e of [ui.cap,ui.ttl]) e&&(e.style.opacity=0);
    ui.end&&(ui.end.style.display='none');ui.c.style.display='none';ui.v.style.opacity=0;ui.h.style.opacity=0;
    G.cabin&&(G.cabin.on=false);G.village&&(G.village.on=true);
    S.on=1;S.t=0;S.lineEnd=0;S.spk=null;S.mv=0;S.choice=null;S.bkR=2;wait.length=0;gate(null);showDl(0);
    G.setEnv({sunEl:11,sunAz:125,cloud:1.6,haze:.7,cloudBase:800,cloudTop:3200,indoor:0,exposure:1.2});// 잿빛 흐린 늦가을 아침: 낮은 해는 구름에 거의 가림
    G.sfx.init();G.sfx.loop('sea',1,{gain:.22,rate:.45});G.sfx.loop('wind',1,{gain:.4});G.sfx.music('calm');
 }
  function start(){const sc=!S.st&&G.params.get('story')==='2'&&G.params.get('scene');S.st=1;go(sc||'square');}
  function stop(){
    S.on=0;gate(null);showDl(0);wait.length=0;G.people.fp.on=0;G.people.fp.kind='rok';G.people.fp.aim=0;
    G.village&&(G.village.on=false);const vs=VL().S;vs&&(vs.fire=0);
    for(const k of ['c','p','m']) ui[k]&&(ui[k].style.display='none');ui.v&&(ui.v.style.opacity=0);ui.bk&&(ui.bk.style.opacity=0);
    G.sfx.loop('sea',0);G.sfx.loop('wind',0);
 }
  function update(dt){
    if(!S.on) return;
    try {
      const sd=dt*((G.keys.Space||G.keys.Tab)&&!S.walk&&S.g!=='choice'?4:1);// Space: 컷신 빨리 감기
      run(sd);npc(sd);
      if(S.walk&&S.cm==='fp') stepMe(dt);
      const it=S.cm==='fp'&&S.bk<.5?interact():null;
      ui.p.style.display=it&&!S.bot?'block':'none';if(it) ui.p.textContent=it[0];
      if(it&&(S.eq||S.bot)) it[1]();
      S.eq=0;
      if(S.bot&&S.g==='choice'&&S.t - S.gt>1.5) choose(api.botChoice==='refuse'?'refuse':'execute');
      camera(dt);mark();dress(dt);
      ui.sk&&(ui.sk.style.display=S.beat!=='end'&&!S.walk&&S.g!=='choice'?'block':'none');
   } catch (e){G.err('[story2] ' + (e.stack||e));}
 }
  const api=G.story2={S,go,start,stop,choose,botChoice:'execute',get on(){return !!S.on;},get bot(){return !!S.bot;},set bot(v){S.bot=!!v;},me};
  G.register('story2',{
    init(){
      G.css(`#s2o,#s2h,#s2p,#s2m,#s2c,#s2t,#s2v{position:absolute}
#s2o{left:5vw;top:13vh;font:600 2.1vh system-ui;letter-spacing:.06em;color:#f2e6c4;text-shadow:0 1px 5px #000;opacity:0;transition:opacity .6s}
#s2h{left:5vw;top:17vh;font:400 1.6vh system-ui;color:#c8d0d8;text-shadow:0 1px 4px #000;opacity:0;transition:opacity 1s}
#s2p{left:50%;top:60%;transform:translateX(-50%);padding:.35em 1.1em;font:600 2.1vh system-ui;letter-spacing:.08em;color:#fff;background:#000b;border:1px solid #fff5;border-radius:4px;display:none}
#s2m{transform:translate(-50%,-100%);text-align:center;font:600 1.4vh system-ui;color:#f2e6c4cc;text-shadow:0 1px 3px #000;display:none}
#s2m i{display:block;width:.8vh;height:.8vh;margin:0 auto .5vh;border:2px solid #f2e6c4aa;transform:rotate(45deg)}
#s2c{left:50%;bottom:13vh;transform:translateX(-50%);display:none;gap:5vw;pointer-events:auto}
#s2c button{min-width:14vw;padding:.6em 1.8em .5em;font:800 3.6vh system-ui;letter-spacing:.5em;text-indent:.5em;color:#ece6dc;background:#0b0d10d0;border:1px solid #ffffff4d;border-radius:6px;cursor:pointer;transition:background .4s,border-color .4s}
#s2c button:hover{background:#3a0e0ed8;border-color:#ff9a8a99}#s2c small{display:block;font:400 1.4vh system-ui;letter-spacing:.2em;color:#8f989f;margin-top:.4em}
#s2t{inset:0;display:grid;place-content:center;text-align:center;color:#ebe4d8;opacity:0;transition:opacity 1.4s}
#s2t small{font:400 1.9vh system-ui;letter-spacing:.55em;color:#a9a196}#s2t b{display:block;font:800 6.4vh system-ui;letter-spacing:.14em;margin:.4em 0;color:#fff}
#s2v{inset:0;background:radial-gradient(ellipse at 50% 45%,#0000 40%,#000d);opacity:0;transition:opacity 2.5s}
html[lang=en] #s2c button{letter-spacing:.18em;text-indent:.18em}html[lang=en] #s2t small{letter-spacing:.3em}html[lang=en] #s2t b{font-size:min(6.4vh,4vw);letter-spacing:.06em}`);
      ui.v=G.el('div',{id:'s2v'});ui.o=G.el('div',{id:'s2o'});ui.h=G.el('div',{id:'s2h',textContent:'WASD 이동 · 마우스 둘러보기 · Shift 달리기 · E 상호작용'});
      ui.p=G.el('div',{id:'s2p'});ui.m=G.el('div',{id:'s2m',innerHTML:'<i></i><span></span>'});
      ui.c=G.el('div',{id:'s2c',innerHTML:'<button>처형<small>1</small></button><button>거절<small>2</small></button>'});
      ui.t=G.el('div',{id:'s2t',innerHTML:'<small>스토리 2</small><b>북한 마을 : 5일전으로</b><small>조선민주주의인민공화국편</small>'});
      const bs=ui.c.querySelectorAll('button');bs[0].onclick=()=>choose('execute');bs[1].onclick=()=>choose('refuse');
      if(G.params.has('nohud')) for(const k of ['o','h','p','m']) ui[k].style.visibility='hidden';
      addEventListener('keydown',e=>{
        if(!S.on) return;
        if(e.code==='KeyE') S.eq=1;
        if(e.code==='Digit1'||e.code==='Numpad1') choose('execute');
        if(e.code==='Digit2'||e.code==='Numpad2') choose('refuse');
     });
      G.canvas.addEventListener('click',()=>{S.on&&S.beat!=='end'&&S.g!=='choice'&&G.canvas.requestPointerLock&&G.canvas.requestPointerLock();});
      addEventListener('mousemove',e=>{
        if(!S.on||S.cm!=='fp'||!(document.pointerLockElement===G.canvas||e.buttons)) return;
        const k=S.lock?.0009:.0022;me.yaw-=e.movementX*k;me.pit=cl(me.pit - e.movementY*k,-1.3,1.3);S.mv=2.5;
        me.sw[0]=cl(me.sw[0] - e.movementX*.002,-.3,.3);me.sw[1]=cl(me.sw[1] + e.movementY*.002,-.3,.3);
     });
      const sk=$('sk');sk&&sk.addEventListener('click',()=>{if(S.on&&!S.walk){S.nx=Math.min(S.nx,S.t);S.lineEnd=S.t;}});
   },
    update
 },'story');
  G.mode==='story'&&G.order.unshift(G.order.pop());// update 를 앞으로: 인물 · 마을보다 먼저
}
