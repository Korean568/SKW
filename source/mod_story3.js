'use strict';
/* STORY 3 — 북한 주석궁 : 다시 지금 북한으로 (조선민주주의인민공화국편) · 흐름 · 1인칭 · 단검/투척단검 호위전 · 엔딩 */
{
  const PP=G.people,{sin,cos,atan2,hypot:H,min:mn,max:mx,abs:ab,PI}=Math,cl=G.clamp,R=Math.random;
  const BEATS=['meet','leave','storm','call','escort','escort2','office','ambush','shot','end'];
  const ME='리충성 최고령도자';
  // 대본: [화자,대사,연출?] / '*' 해설 / '!' 연출,대기초 / '?' 조작 관문 / '@' 장면. 괄호 지문은 연출로만 (대사칸에 쓰지 않음)
  const SC=[
    ['@','meet'],['!','card',4.6],['!','fade',1.2],
    ['*','리충성은 자신의 누나가 남한을 침략하는 것이 내키지 않는다.'],
    ['*','그래서 리충성은 대회의를 시작한다'],
    ['!','seat',1.6],
    [ME,'동무들, 폭력을 쓰고 싶소 비폭력적으로 해결하고 싶소?'],
    ['고위간부들','당연히 비폭력적아닙네까?'],
    [ME,'그러면 지금 조선이 남조선을 침략하는 것에 어떻게 생각하오?'],
    ['고위간부 4','전쟁을 멈추고 서로 평화적으로 해결해야합네다.'],
    ['고위간부 2','맞는 말이오.'],
    ['고위간부 3','그러려면 리옥선 동지를 막아야 하는데...'],
    ['고위간부 2','흠..'],
    [ME,'그럼 이만 회의를 마치겠소.'],
    ['@','leave'],['!','stand',1.2],['?','leave'],// (리충성이 나간다)
    ['@','storm'],['!','storm',2.8],['!','shots',4.2],['!','',1.4],// (부하들이 들이닥친다) (총소리 여러발 — 화면 밖)
    ['@','call'],['!','danger',1.5],['!','koin',.5],// (리충성도 위험에 처한다) (고혁명이 외친다)
    ['고혁명','리충성 동지! 빨리 이쪽으로 오십시오!'],
    [ME,'알갔소!'],
    ['!','run',0],['?','toko'],// (고혁명한테 뛰어간다)
    ['@','escort'],
    ['고혁명','저를 따라오십시오. 경호해드리겠습네다.'],
    [ME,'알갔소.'],
    ['!','fight1',0],['?','seg'],
    ['@','escort2'],
    ['고혁명','집무실까지 경호해드리겠습네다.'],
    [ME,'고맙소.'],
    ['!','fight2',0],['?','seg'],
    ['@','office'],['!','arrive',0],['?','office'],['!','bye',3],// (집무실 도착, 고혁명은 돌아간다)
    ['@','ambush'],['!','grab',3.4],['!','okin',2.6],// (양쪽 팔이 잡히고 무릎 꿇린다)
    [ME,'누이! 이게 무슨 정신나간 짓이오!'],
    ['리옥선','조선은 강한 독재자가 필요하오.'],
    [ME,'틀렸소! 우린 공화국이 락원이 되길 바래서 반역을 한거잖소?'],
    ['리옥선','이게 바로 락원으로 가는 길이오.'],
    ['@','shot'],['!','raise',1.3],['!','burst',.7],// (고혁명이 나타난다)
    ['고혁명','멈추시오!'],
    ['!','fire',4.2],// (이미 방아쇠를 당겼다) — 총성과 함께 암전
    ['@','end'],['!','end',0],
  ];
  const COL={[ME]:'#f0dfb2','고혁명':'#ffc27a','리옥선':'#ff8b7a'},WHO={'고혁명':'ko','리옥선':'ok','고위간부 2':1,'고위간부 3':2,'고위간부 4':3,'고위간부들':'all'};
  const S={on:0,beat:'',line:-1,t:0,i:0,nx:0,cm:'fp',g:null,gt:0,walk:0,fix:null,fixF:0,fixR:1.8,mv:0,spk:null,lineEnd:0,bk:0,bkT:0,bkR:2,sh:0,lock:0,
    fight:0,seg:0,ki:0,kend:0,waves:{},segDone:0,arm:0,dead:0,dm:0,dmR:.6,dof:0,dofR:.8,kf:0,kfT:0,kills:0,ns:0,held:0,hu:0,hm:0};
  const me={p:[0,0,0],yaw:0,pit:0,bob:0,bA:0,eh:1.62,ehT:1.62,ehR:2,hp:100,ht:-9,sw:[0,0],y0:0};
  const kn={n:6,cd:0,sa:0,ta:0,fly:[],fl:[]};
  const W={o:[],storm:[],amb:[]},E=[],wait=[],ui={};
  const later=(s,f)=>wait.push([S.t + s,f]);
  const L=(p,rgb,I,r)=>G.addLight(p,rgb,I*4,r,2*mx(G.dt,1e-3));// 한 프레임 점광
  const $=id=>document.getElementById(id);
  const sfx=(n,o)=>{try {G.sfx.play(n,o);} catch (e){}};

  /* ── 주석궁 계약 (없으면 대체 배치: 회의실 → 복도 → 집무실) ── */
  const FK=(()=>{
    const seats=[];for(let i=0;i<3;i++) for(const s of [1,-1]) seats.push([s*1.5,.47,-2.2 + i*2.2,s>0?-PI/2:PI/2]);
    return{meet:{centre:[0,0,0],seats,head:[0,.47,-4.4,0],doors:[0,0,6,0]},
      path:[[0,0,7.6],[0,0,12],[0,0,17],[0,0,22],[5,0,24],[11,0,24],[17,0,24],[22,0,26],[24,0,31],[24,0,36],[24,0,40]],
      ko:[3,0,21.5,-PI/2],spawns:[[-3,0,14,PI/2],[3,0,16,-PI/2],[-3,0,26,PI],[8,0,27,PI],[14,0,21,0],[20,0,21,0],[27,0,28,-PI/2],[21,0,33,PI/2],[27,0,37,-PI/2],[0,0,27,PI],[21,0,38,PI/2]],
      office:{door:[24,0,41.5,0],centre:[24,0,45],desk:[24,0,48,PI],kneel:[24,0,44.8,0],ok:[24,0,46.8,PI],ambush:[[21.6,0,43,PI/2],[26.4,0,43,-PI/2],[22.4,0,48,PI]]},
      storm:[[-4,0,-2,PI/2],[4,0,-2,-PI/2],[-4,0,2,PI/2],[4,0,2,-PI/2]]};
 })();
  const PL=()=>G.palace||{};
  const K=()=>{const k=PL().K;return k&&k.meet&&k.meet.head&&k.path&&k.path.length>3&&k.office&&k.office.kneel?k:FK;};
  function pc(f,...a){const v=PL();try {return typeof v[f]==='function'&&v.K?v[f](...a):undefined;} catch (e){G.err('[story3] palace.' + f + ' ' + e);}}
  const gnd=(x,z)=>{const y=pc('ground',x,z);return Number.isFinite(y)?y:0;};
  const col=(p,r)=>{const q=pc('collide',p,r);return q&&Number.isFinite(q[0])&&Number.isFinite(q[2])?[q[0],gnd(q[0],q[2]),q[2]]:[p[0],gnd(p[0],p[2]),p[2]];};
  const wray=(o,d,m)=>{const t=pc('ray',o,d,m);return Number.isFinite(t)?mn(t,m):m;};
  const room=p=>pc('room',p)||'';
  const fw=y=>[sin(y),0,cos(y)];
  const dxz=(a,b)=>H(a[0] - b[0],a[2] - b[2]);
  const yawTo=(a,b)=>atan2(b[0] - a[0],b[2] - a[2]);
  const wrap=a=>atan2(sin(a),cos(a));
  const at=(q,dy=0)=>[q[0],gnd(q[0],q[2]) + dy,q[2]];
  const seat=q=>at(q,q[1]>.2&&q[1]<.8?q[1]:.47);// 의자: 좌판 위 엉덩이 점
  const lerp3=(a,b,u)=>[a[0] + (b[0] - a[0])*u,a[1] + (b[1] - a[1])*u,a[2] + (b[2] - a[2])*u];
  const nrm=v=>{const l=H(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l];};
  const los=(a,b)=>{const d=[b[0] - a[0],b[1] - a[1],b[2] - a[2]],l=H(...d)||1;return wray(a,[d[0]/l,d[1]/l,d[2]/l],l)>=l - .25;};
  const eyeMe=()=>[me.p[0],me.p[1] + me.eh,me.p[2]];
  const look=()=>[sin(me.yaw)*cos(me.pit),sin(me.pit),cos(me.yaw)*cos(me.pit)];
  const eye=P=>{try {return PP.eye(P);} catch (e){return[P.p[0],P.p[1] + 1.6,P.p[2]];}};
  // 문: 바깥 방향 (회의실 중심 → 문) · 집무실 안쪽 방향 (문 → 집무실 중심)
  const dir2=(a,b)=>{const x=b[0] - a[0],z=b[2] - a[2],n=H(x,z)||1;return[x/n,0,z/n];};
  const mOut=()=>dir2(K().meet.centre,K().meet.doors);
  const offAt=(p,d,s,side=0)=>at([p[0] + d[0]*s - d[2]*side,0,p[2] + d[2]*s + d[0]*side]);
  const oIn=()=>dir2(K().office.door,K().office.centre);
  const near=p=>{const P=K().path;let b=0,bd=1e9;P.forEach((q,i)=>{const d=dxz(q,p);if(d<bd){bd=d;b=i;}});return b;};
  function navTo(p,g){// 보이면 곧장, 아니면 경로점을 따라
    if(los([p[0],p[1] + 1.1,p[2]],[g[0],gnd(g[0],g[2]) + 1.1,g[2]])) return g;
    const P=K().path,a=near(p),b=near(g);
    if(dxz(p,P[a])>1) return P[a];
    return P[a + Math.sign(b - a)]||g;
 }
  function doors(){const s=PL().S;return s&&s.doors;}

  /* ── 인물 ── */
  const add=(k,o)=>PP.add(k,Object.assign({pose:'stand',gun:0},o));
  function walk(P,pts,sp,done,pose){P.wp=pts.map(q=>q.slice());P.sp=sp;P.done=done;P.wpose=pose||'walk';P.pose=P.wpose;P.vis=true;P.stk=0;}
  function stage(n){// n = 장면 번호: 그 장면 시작 상태를 배치
    const k=K(),m=k.meet,c=m.centre;
    PP.clear();W.o=[];W.storm=[];W.amb=[];E.length=0;wait.length=0;kn.fly.length=0;kn.fl.length=0;kn.n=6;
    S.dm=n===1||n===2?1:0;S.dof=n===6?1:0;const d=doors();if(d){d.meet=S.dm;d.office=S.dof;}
    if(n<4) m.seats.slice(0,6).forEach((q,i)=>{// 고위간부: 다른 얼굴 · 회의 중엔 의자에 앉음
      const P=add('suit',{p:seat(q),yaw:q[3],pose:'sitchair',seed:11 + i*17,look:at(c,1.1)});
      if(n>=3){P.vis=false;P.dead=true;}W.o.push(P);
   });
    W.me=add('suit',{p:seat(m.head),yaw:m.head[3],pose:'sitchair',seed:5,vis:false});// 시작 장면에서만 보이는 리충성
    const kp=n>=5?k.path[S.mid=mid()]:k.ko;
    W.ko=add('nko',{p:at(kp),yaw:kp[3]||0,gun:'pistol',seed:23,vis:n>=4&&n<7});
    W.ok=add('nkf',{p:at(k.office.ok),yaw:k.office.ok[3],seed:71,vis:n>=8});
    k.office.ambush.slice(0,2).forEach((q,i)=>W.amb.push(add('nk',{p:at(q),yaw:q[3]||0,gun:'ak',seed:41 + i*9,vis:n>=8})));
    // 플레이어
    const o=mOut(),path=k.path;let st,yw;
    if(n<=1){st=offAt(m.head,dir2(m.head,c),.15);yw=yawTo(m.head,c);}
    else if(n<=3){st=offAt(m.doors,o,1.6);yw=atan2(o[0],o[2]);}
    else if(n===4){const q=k.ko,j=near(q);st=offAt(q,dir2(q,path[dxz(q,path[j])>1?j:mx(0,j - 1)]),1.4);yw=yawTo(st,path[mn(near(q) + 1,path.length - 1)]);W.ko.p=at(q);W.ko.yaw=yawTo(q,st);}
    else if(n===5){const a=path[S.mid],b=path[mx(0,S.mid - 1)];const u=dir2(a,b);st=offAt(a,u,2.6);yw=yawTo(st,a);W.ko.yaw=yawTo(b,a);}
    else if(n===6){const N=path.length - 1;W.ko.p=at(path[N - 1]);st=offAt(path[N - 1],dir2(path[N - 1],path[N - 2]),2.5);yw=yawTo(st,path[N]);}
    else if(n===7){st=at(k.office.centre);yw=yawTo(st,k.office.ok);}
    else {st=at(k.office.kneel);yw=yawTo(st,k.office.ok);}
    me.p=st;me.yaw=yw;me.pit=n?-.04:-.12;me.eh=me.ehT=n<=1?1.2:n>=8?1.04:1.62;me.hp=100;me.ht=-9;me.y0=yw;
    S.walk=n>=1&&n<=6&&n!==2?1:0;if(n===1) S.walk=0;
    S.lock=n>=7?1:0;S.held=n>=8?1:0;S.fix=null;S.fight=0;S.arm=n>=4&&n<=6?1:0;S.dead=0;S.segDone=0;S.sh=0;
    if(S.held) held(1);
    PP.fp.on=0;
 }
  const mid=()=>{const k=K(),a=near(k.ko),N=k.path.length - 2;return a + mx(1,Math.round((N - a)*.5));};
  function held(now){// 양팔을 잡은 두 부하: 무릎 꿇은 리충성 양옆
    const f=fw(me.yaw);
    W.amb.forEach((P,i)=>{const s=i?-1:1,q=at([me.p[0] - f[2]*s*.5 - f[0]*.18,0,me.p[2] + f[0]*s*.5 - f[2]*.18]);
      if(now) P.p=q;else P.p=lerp3(P.p,q,mn(1,G.dt*6));P.yaw=me.yaw;P.vis=true;P.wp=null;P.pose='grip';P.gun='ak';
      P.look=[me.p[0] - f[2]*s*.2,me.p[1] + me.eh - .3,me.p[2] + f[0]*s*.2];});
 }

  /* ── 적 · 고혁명 ── */
  function spawnE(q,k){
    const P=add('nk',{p:at(q),yaw:q[3]||0,gun:'ak',seed:300 + (S.ns++)*13 % 997,pose:'run'}),e={P,k,st:0,t:1,ft:0,fb:0,life:0,shots:0};
    E.push(e);return e;
 }
  function wave(i){// 고혁명이 경로점 i 에 이르면: 앞쪽(고혁명 몫) · 옆/뒤(놓친 적, 플레이어 몫)
    const w=S.waves[i];if(!w) return;delete S.waves[i];
    const k=K(),P=k.path,ah=P[mn(i + 2,P.length - 1)],sp=(k.spawns&&k.spawns.length?k.spawns:FK.spawns),used=new Set();
    const pick=(ref,dk,dp,far)=>{let b=null,bd=1e9;for(const q of sp){if(used.has(q)) continue;const d=dxz(q,ref);if(dxz(q,W.ko.p)<dk||dxz(q,me.p)<dp||d>far) continue;if(d<bd){bd=d;b=q;}}b&&used.add(b);return b;};
    for(let j=0;j<w[0];j++){
      let q=pick(ah,5,6,30);if(!q){const a=P[mn(i + 3,P.length - 1)],u=dir2(P[i],a);q=[a[0] - u[2]*(j - .5)*1.6,0,a[2] + u[0]*(j - .5)*1.6,yawTo(a,P[i])];}
      const e=spawnE(q,'ko'),u=dir2(q,ah);e.to=col([q[0] + u[0]*1.3,0,q[2] + u[2]*1.3],.3);
   }
    for(let j=0;j<w[1];j++){const q=pick(me.p,0,4.5,24)||pick(me.p,0,3,1e9);if(q){const e=spawnE(q,'me');e.t=1.2;}}
 }
  function kill(e){const P=e.P;P.hp=0;P.dead=true;P.pose='dead';P.aim=null;P.look=null;S.kills++;}
  function hurt(d,from){
    if(S.dead||S.beat==='end') return;
    me.hp-=d*(S.bot?.35:1);me.ht=S.t;S.hu=1;S.sh=mx(S.sh,.25);
    if(me.hp<=0){me.hp=0;S.dead=1;S.walk=0;ui.fd&&(ui.fd.style.display='grid');document.pointerLockElement&&document.exitPointerLock();sfx('gun',{gain:.6,rate:.6});if(S.bot) later(1.6,retry);}
 }
  function retry(){if(!S.dead) return;ui.fd&&(ui.fd.style.display='none');go(S.seg===2?'escort2':'escort');}
  function shoot(e,T){// 적 사격: 'me' 만 명중 가능
    let m;try {m=PP.muzzle(e.P);} catch (x){m=[...eye(e.P),0,0,1];}
    const o=[m[0],m[1],m[2]],hit=e.k==='me'&&R()<(S.bot?.18:.3);
    let d=nrm([T[0] - o[0],T[1] - .2 - o[1],T[2] - o[2]]);
    if(!hit){const s=e.k==='ko'?.05:.09;d=nrm([d[0] + (R() - .5)*s,d[1] + (R() - .3)*s,d[2] + (R() - .5)*s]);}
    try {G.fx.tracer(o,d,320,0);G.fx.burst('muzzle',o,{size:.025,dir:d});
      if(!hit){const t=wray(o,d,60);if(t<60) G.fx.burst('hit',[o[0] + d[0]*t,o[1] + d[1]*t,o[2] + d[2]*t],{size:.1});}
   } catch (x){}
    L(o,[1,.7,.35],2.4,5);sfx('rifle',{pos:o,gain:.6});
    if(hit) hurt(9 + R()*5);
 }
  function foes(dt){
    for(const e of E){
      const P=e.P;if(P.dead) continue;
      e.life+=dt;
      const mine=e.k!=='ko',T=mine?eyeMe():eye(W.ko),ey=eye(P),see=los(ey,T),d=dxz(P.p,T);
      if(e.st===0){// 접근: 고혁명 몫은 문에서 한 발, 플레이어 몫은 보일 때까지 달려옴
        let g=e.k==='ko'?(e.life>5&&!see?navTo(P.p,W.ko.p):e.to||P.p):see&&d<(e.k==='th'?40:8.5)?null:navTo(P.p,T);
        if(!g||dxz(P.p,g)<.3){if(e.k!=='ko'||see||e.life>9){e.st=1;e.t=e.k==='me'?1.1 + R()*.6:.6 + R()*.6;}else e.to=null;}
        else {const dx=g[0] - P.p[0],dz=g[2] - P.p[2],l=H(dx,dz)||1,s=mn(l,(e.k==='me'?3.1:2.6)*dt);P.p=col([P.p[0] + dx/l*s,P.p[1],P.p[2] + dz/l*s],.28);P.yaw+=wrap(atan2(dx,dz) - P.yaw)*mn(1,dt*8);P.pose='run';P.aim=null;}
        continue;
     }
      P.yaw+=wrap(yawTo(P.p,T) - P.yaw)*mn(1,dt*6);P.aim=[T[0],T[1] - .3,T[2]];e.ft-=dt;P.pose=e.ft>0?'fire':'aim';
      if(e.k==='me'&&(!see||d>11)){e.st=0;continue;}
      e.t-=dt;
      if(e.t<=0&&(see||e.k==='ko')){shoot(e,T);e.ft=.12;if(++e.fb>=3){e.fb=0;e.t=1.2 + R()*1.3;}else e.t=.13;}
   }
 }
  function koShoot(e){// 고혁명 권총: 2~3발이면 쓰러짐
    const P=W.ko;let m;try {m=PP.muzzle(P);} catch (x){m=[...eye(P),0,0,1];}
    const o=[m[0],m[1],m[2]],c=eye(e.P),d=nrm([c[0] - o[0],c[1] - .35 - o[1],c[2] - o[2]]);
    try {G.fx.tracer(o,d,380,0);G.fx.burst('muzzle',o,{size:.02,dir:d});} catch (x){}
    L(o,[1,.78,.45],2.6,5);sfx('pistol',{pos:o,gain:.9});S.kfT=.14;
    if(R()<.5||++e.shots>=3) kill(e);else e.P.pose='hit';
 }
  function koAI(dt){
    const P=W.ko;if(!P||!P.vis) return;
    const tg=S.fight||S.g==='toko';if(!tg) return;
    const ey=eye(P);let b=null,bd=1e9;
    for(const e of E){if(e.P.dead) continue;const d=dxz(P.p,e.P.p);if(e.k==='me'&&e.life<30) continue;if(d<bd&&d<32&&(e.st===1||e.k==='th'||e.life>8)&&(e.life>8||los(ey,eye(e.P)))){bd=d;b=e;}}
    S.kfT-=dt;
    if(b){// 앞의 적: 멈춰 서서 겨누고 쏨
      P.wp=null;P.yaw+=wrap(yawTo(P.p,b.P.p) - P.yaw)*mn(1,dt*8);const c=eye(b.P);P.aim=[c[0],c[1] - .3,c[2]];P.look=c;P.pose=S.kfT>0?'fire':'aim';
      S.kf-=dt;if(S.kf<=0){S.kf=.45 + R()*.4;koShoot(b);}
      return;
   }
    P.aim=null;S.kf=mn(S.kf,.5) + .0;
    if(!S.fight){P.pose='stand';P.look=eyeMe();return;}
    const path=K().path,busy=E.find(e=>!e.P.dead&&e.k==='me'),far=dxz(me.p,P.p)>7;
    if(S.ki>S.kend){P.pose='stand';P.look=eyeMe();if(!busy&&!E.some(e=>!e.P.dead)&&!far) S.segDone=1;return;}
    if(busy||far){P.pose='stand';P.look=busy?eye(busy.P):eyeMe();if(busy) P.yaw+=wrap(yawTo(P.p,busy.P.p) - P.yaw)*mn(1,dt*3);return;}
    const w=path[S.ki],dx=w[0] - P.p[0],dz=w[2] - P.p[2],d=H(dx,dz);
    S.kst=(S.kst||0) + dt;if(S.kst>7) P.p=at(w);
    if(d<.35){wave(S.ki);S.ki++;S.kst=0;return;}
    const s=mn(d,1.9*dt);P.p=col([P.p[0] + dx/d*s,P.p[1],P.p[2] + dz/d*s],.28);P.yaw+=wrap(atan2(dx,dz) - P.yaw)*mn(1,dt*6);P.pose='walk';P.look=null;
 }
  function fight(n){
    const k=K(),N=k.path.length - 2,a=n===1?near(k.ko):mid(),b=n===1?mid():N;
    S.fight=1;S.seg=n;S.arm=1;S.walk=1;S.segDone=0;S.ki=a;S.kend=b;S.waves={};
    const C=n===1?[[2,1],[1,1],[2,1]]:[[2,1],[2,1],[1,2]];
    [0,.45,.82].forEach((u,j)=>{let i=Math.round(a + (b - a)*u);while (S.waves[i]&&i<b) i++;S.waves[i]=C[j];});
    G.sfx.music('combat');ui.f&&(ui.f.style.display='block');S.hintT=S.t + 10;
 }

  /* ── 단검 · 투척단검 ── */
  function stab(){
    if(kn.cd>0) return;kn.cd=.38;kn.sa=1;sfx('click',{gain:.5,rate:.5});
    const e=eyeMe(),f=look();let b=null,bd=1e9;
    for(const x of E){if(x.P.dead) continue;const c=eye(x.P),v=[c[0] - e[0],0,c[2] - e[2]],d=H(v[0],v[2]);if(d>1.75) continue;if((v[0]*f[0] + v[2]*f[2])/(d*(H(f[0],f[2])||1))<.72) continue;if(d<bd){bd=d;b=x;}}
    if(!b) return;
    const P=b.P,u=dir2(P.p,me.p),bk=fw(P.yaw)[0]*u[0] + fw(P.yaw)[2]*u[2]<-.2;
    P.hp-=bk?100:55;mark();sfx('hit',{gain:.5,rate:.42});
    if(P.hp<=0) kill(b);else {P.pose='hit';b.t+=.7;b.st=1;}
 }
  function toss(){
    if(kn.cd>0||kn.n<=0||kn.ta>0) return;kn.n--;kn.cd=.5;kn.ta=.01;kn.pend=1;
 }
  function release(){
    kn.pend=0;const e=eyeMe(),f=look(),r=[-cos(me.yaw),0,sin(me.yaw)];
    kn.fly.push({p:[e[0] + f[0]*.4 + r[0]*.12,e[1] + f[1]*.4 - .04,e[2] + f[2]*.4 + r[2]*.12],v:[f[0]*24,f[1]*24 + .9,f[2]*24],s:0,yaw:me.yaw,t:0});
    sfx('click',{gain:.45,rate:.3});
 }
  function drop(p,y){kn.fl.push({p:at(p,.012),yaw:y??R()*6.3,r:(R() - .5)*.3});}
  function knives(dt){
    kn.cd-=dt;kn.sa=mx(0,kn.sa - dt*3.4);if(kn.ta>0){kn.ta+=dt/.45;if(kn.pend&&kn.ta>=.5) release();if(kn.ta>=1) kn.ta=0;}
    for(let i=kn.fly.length - 1;i>=0;i--){
      const k=kn.fly[i];k.t+=dt;k.v[1]-=7*dt;
      const sp=H(...k.v),d=[k.v[0]/sp,k.v[1]/sp,k.v[2]/sp],l=sp*dt;
      let h=null;try {h=PP.ray(k.p,d,l);} catch (x){}
      const tw=wray(k.p,d,l);
      if(h&&h.t<=tw){
        const e=E.find(x=>x.P===h.P&&!x.P.dead);
        if(e){h.P.hp-=h.part==='limb'?60:100;mark();sfx('hit',{gain:.45,rate:.5});if(h.P.hp<=0) kill(e);else {h.P.pose='hit';e.st=1;}
          drop([h.P.p[0] + d[0]*.4,0,h.P.p[2] + d[2]*.4],k.yaw);}
        else drop([k.p[0] + d[0]*(h.t - .3),0,k.p[2] + d[2]*(h.t - .3)]);
        kn.fly.splice(i,1);continue;
     }
      if(tw<l||k.p[1]<gnd(k.p[0],k.p[2]) + .03||k.t>3){
        const s=mx(0,tw - .15);drop([k.p[0] + d[0]*s,0,k.p[2] + d[2]*s]);sfx('click',{gain:.35,rate:1.7,pos:k.p});kn.fly.splice(i,1);continue;
     }
      for(let j=0;j<3;j++) k.p[j]+=d[j]*l;
      k.s+=dt*24;
   }
    // 줍기: 밟고 지나가거나 E
    let pr=null;
    for(let i=kn.fl.length - 1;i>=0;i--){
      const q=kn.fl[i].p,d=dxz(q,me.p);if(ab(q[1] - me.p[1])>1.2) continue;
      if(kn.n<6&&(d<1.05||d<2.2&&S.eq)){kn.fl.splice(i,1);kn.n++;sfx('click',{gain:.5,rate:1.2});S.eq=0;continue;}
      if(d<2.2&&kn.n<6) pr='[E] 투척단검 줍기';
   }
    ui.p&&(ui.p.style.display=pr&&!S.bot&&S.walk?'block':'none',pr&&(ui.p.textContent=pr));
 }
  function drawKnives(){
    if(!G.draw||!G.meshes||!G.meshes.s3knife) return;
    for(const k of kn.fly) G.draw('s3knife',M4.trs(k.p,k.yaw,-k.s,0,1.3));
    for(const k of kn.fl) G.draw('s3knife',M4.trs(k.p,k.yaw,0,k.r,1));
 }
  function knifeMesh(){// 투척단검: 마름모 단면 칼날 · 가드 · 손잡이 (모델 +Z = 칼끝, 칼날 면은 XZ 평면)
    const V=[];
    const tri=(a,b,c,col,ref)=>{
      const e=[b[0] - a[0],b[1] - a[1],b[2] - a[2]],f=[c[0] - a[0],c[1] - a[1],c[2] - a[2]];let n=nrm([e[1]*f[2] - e[2]*f[1],e[2]*f[0] - e[0]*f[2],e[0]*f[1] - e[1]*f[0]]);
      if(n[0]*ref[0] + n[1]*ref[1] + n[2]*ref[2]<0){[b,c]=[c,b];n=n.map(x=>-x);}
      for(const p of [a,b,c]) V.push(p[0],p[1],p[2],n[0],n[1],n[2],col[0],col[1],col[2],-2);
   };
    const loft=(sc,col)=>{
      for(let s=0;s<sc.length - 1;s++){
        const [z0,A]=sc[s],[z1,B]=sc[s + 1],n=A.length;
        for(let i=0;i<n;i++){const j=(i + 1) % n,a=[...A[i],z0],b=[...A[j],z0],c=[...B[j],z1],d=[...B[i],z1],m=[(a[0] + b[0] + c[0] + d[0])/4,(a[1] + b[1] + c[1] + d[1])/4,0];tri(a,b,c,col,m);tri(a,c,d,col,m);}
     }
      for(const [s,dz] of [[sc[0],-1],[sc[sc.length - 1],1]]){const [z,A]=s;for(let i=0;i<A.length;i++) tri([0,0,z],[...A[i],z],[...A[(i + 1) % A.length],z],col,[0,0,dz]);}
   };
    const dia=(w,t)=>[[w,0],[0,t],[-w,0],[0,-t]];
    const ring=(rx,ry,n=8)=>Array.from({length:n},(_,i)=>[cos(i/n*2*PI)*rx,sin(i/n*2*PI)*ry]);
    loft([0,.03,.07,.1,.125,.145,.16,.17,.176].map(z=>{const w=z<.1?.0135 - z*.012:(.0123)*Math.sqrt(mx(0,1 - (z - .1)/.078)) + .0004;return[z,dia(w,.0006 + w*.2)];}),[.74,.76,.8]);// 칼날
    loft([[-.006,ring(.026,.007)],[.004,ring(.024,.006)]],[.16,.16,.17]);// 가드
    loft([-.11,-.1,-.07,-.04,-.012,-.006].map((z,i)=>[z,ring(i?.0108 + .001*sin(i*1.3):.008,i?.0078:.006)]),[.06,.052,.045]);// 손잡이
    return new Float32Array(V);
 }

  /* ── 연출 ── */
  function act(a){
    const k=K(),m=k.meet,c=m.centre;
    if(a==='card'){S.cm='est';S.ct=0;S.bk=S.bkT=1;ui.t.style.opacity=1;later(3.6,()=>ui.t.style.opacity=0);W.me.vis=true;}
    if(a==='fade'){S.bkT=0;S.bkR=.6;}
    if(a==='seat'){S.bkT=1;S.bkR=4;later(.3,()=>{S.cm='fp';W.me.vis=false;me.p=offAt(m.head,dir2(m.head,c),.15);me.yaw=yawTo(m.head,c);me.pit=-.12;me.eh=me.ehT=1.2;S.bkT=0;S.bkR=1.4;});}
    if(a==='stand'){// (리충성이 나간다): 일어서서 문으로
      me.ehT=1.62;me.ehR=1.6;S.dm=1;S.spk=null;for(const P of W.o) P.look=eyeMe();
      later(.9,()=>{S.walk=1;ui.h.style.opacity=1;later(7,()=>ui.h.style.opacity=0);});
   }
    if(a==='storm'){// (리옥선의 부하들이 들이닥친다): 뒤돌아본 순간 닫히는 문 틈으로
      S.walk=0;S.fix=offAt(m.doors,mOut(),-3,0);S.fix[1]+=1.3;S.fixF=S.t + 3.2;S.fixR=3;
      (k.storm||[]).slice(0,6).forEach((q,i)=>{
        const P=add('nk',{p:at(q),yaw:q[3]||0,gun:'ak',seed:500 + i*7,pose:'run'});W.storm.push(P);
        const tg=W.o[i % mx(1,W.o.length)];walk(P,[lerp3(at(q),tg?tg.p:at(c),.45)],2.6,Q=>{Q.pose='aim';Q.aim=tg?eye(tg):at(c,1);},'run');
     });
      for(const P of W.o) P.look=W.storm[0]?eye(W.storm[0]):null;
      sfx('crash',{gain:.35,rate:1.6,pos:at(c,1)});
      later(.9,()=>{S.dm=0;S.dmR=.55;});
   }
    if(a==='shots'){// (총소리 여러발과 함께 고위간부 전원이 사망한다) — 닫힌 문 너머 소리만
      const p=at(c,1.2);
      for(let i=0;i<16;i++) later(i<6?i*.11:.8 + R()*2.4,()=>{sfx('rifle',{pos:p,gain:.55,rate:.6 + R()*.12});if(R()<.3) sfx('gun',{pos:p,gain:.25,rate:.7});S.sh=mx(S.sh,.12);});
      later(1,()=>{for(const P of W.o){P.dead=true;P.vis=false;}for(const P of W.storm) P.vis=false;});
   }
    if(a==='danger'){// (리충성도 위험에 처한다): 복도에 부하 두셋
      S.walk=1;S.fix=null;const P=k.path,i=near(me.p),ok=q=>dxz(q,me.p)>5&&dxz(q,k.ko)>3.5,sp=(k.spawns||[]).filter(q=>ok(q)&&dxz(q,me.p)<20).sort((a,b)=>dxz(a,me.p) - dxz(b,me.p)).slice(0,2);
      for(let j=i + 1;j<P.length&&sp.length<2;j++) if(ok(P[j])&&dxz(P[j],me.p)<dxz(k.ko,me.p)) sp.push([P[j][0],0,P[j][2],yawTo(P[j],me.p)]);
      sp.forEach((q,j)=>{const e=spawnE(q,'th');e.t=1.6 + j*.4;});
      G.sfx.music('combat');
   }
    if(a==='koin'){const P=W.ko;P.vis=true;P.p=at(k.ko);P.yaw=yawTo(k.ko,me.p);P.look=eyeMe();P.pose='stand';S.fix=P;S.fixF=S.t + 2.2;S.fixR=2.4;}
    if(a==='run'){S.walk=1;}
    if(a==='fight1'){fight(1);}
    if(a==='fight2'){fight(2);}
    if(a==='arrive'){// 집무실 문 앞: 고혁명은 문 옆에 서고 문이 열림
      S.fight=0;S.arm=0;ui.f&&(ui.f.style.display='none');PP.fp.on=0;G.sfx.music('off');S.dof=1;
      const o=k.office.door,u=oIn();walk(W.ko,[offAt(o,u,-1.2,1.2)],1.8,P=>{P.yaw=yawTo(P.p,me.p);P.look=eyeMe();});
   }
    if(a==='bye'){// (고혁명은 돌아간다)
      S.walk=0;const P=W.ko,N=k.path.length - 1;P.look=eyeMe();P.yaw=yawTo(P.p,me.p);S.fix=P;S.fixF=S.t + 2.6;S.fixR=2;
      later(1.1,()=>walk(P,[k.path[N - 1],k.path[mx(0,N - 3)]],1.6,Q=>Q.vis=false));
      later(1.8,()=>{S.dof=0;S.dofR=.5;});
   }
    if(a==='grab'){// 숨어 있던 부하 둘이 양팔을 잡고 무릎 꿇림
      S.walk=0;S.lock=1;S.fix=at(k.office.ok,1.5);S.fixF=S.t + 3;S.fixR=2;
      W.amb.forEach((P,i)=>{const s=i?-1:1,f=fw(me.yaw);P.vis=true;P.gun='ak';walk(P,[at([me.p[0] - f[2]*s*.55,0,me.p[2] + f[0]*s*.55])],3.2,Q=>{Q.pose='grip';Q.yaw=me.yaw;},'run');});
      later(1.1,()=>{S.sh=.7;sfx('hit',{gain:.3,rate:.35});S.held=1;S.ht=S.t;S.k0=me.p.slice();S.y00=me.yaw;});
      later(1.5,()=>{me.ehT=1.04;me.ehR=2.6;sfx('hit',{gain:.25,rate:.25});S.sh=mx(S.sh,.5);});
   }
    if(a==='okin'){
      const o=k.office.ok,am=k.office.ambush[2],P=W.ok,s=am||[o[0] - sin(o[3])*2.4,0,o[2] - cos(o[3])*2.4];
      P.vis=true;P.p=at(s);walk(P,[o],1.15,Q=>{Q.yaw=yawTo(Q.p,me.p);Q.look=eyeMe();});S.fix=P;S.fixF=S.t + 4;S.fixR=1.6;
   }
    if(a==='raise'){const P=W.ok;P.gun='pistol';P.pose='aim';P.aim=eyeMe();P.look=eyeMe();sfx('click',{gain:.7,rate:.7});S.fix=P;S.fixF=S.t + 2;}
    if(a==='burst'){// 문이 벌컥: 고혁명
      S.dof=1;S.dofR=5;sfx('crash',{gain:.4,rate:1.8});const o=k.office.door,u=oIn(),P=W.ko;
      const f=fw(me.yaw),q=at([me.p[0] - f[2]*1.7 + f[0]*.5,0,me.p[2] + f[0]*1.7 + f[2]*.5]);// 문에서 리충성 옆으로 뛰어듦 (곁눈으로 보임)
      P.vis=true;P.wp=null;P.p=offAt(o,u,-.8);P.yaw=atan2(u[0],u[2]);walk(P,[offAt(o,u,1.2),q],3.4,Q=>{Q.pose='aim';Q.aim=eye(W.ok);Q.look=eye(W.ok);},'run');
      later(.6,()=>{S.fix=P;S.fixF=S.t + 3;S.fixR=3;S.lw=1.25;});
   }
    if(a==='fire'){// 이미 방아쇠를 당겼다 — 총성 순간 암전, 몸은 보여주지 않는다
      S.fix=W.ok;S.fixF=S.t + 1;S.fixR=9;S.lw=.6;W.ok.pose='aim';
      later(.4,()=>{S.bk=S.bkT=1;W.ok.pose='fire';sfx('gun',{gain:1.4,rate:1.1});sfx('pistol');showDl(0);later(.25,()=>sfx('ring',{gain:.25}));});
   }
    if(a==='end') end();
 }
  function end(){
    S.beat='end';S.nx=1e9;showDl(0);gate(null);S.walk=0;S.fight=0;document.pointerLockElement&&document.exitPointerLock();
    ui.f&&(ui.f.style.display='none');PP.fp.on=0;S.bk=S.bkT=1;G.sfx.music('off');
    const e=ui.end;if(!e) return;
    e.innerHTML='<h2>스토리 3 — 끝</h2><p class=c>북한 주석궁 : 다시 지금 북한으로 · 조선민주주의인민공화국편</p><div><button>처음 화면</button> <button>다시 하기</button></div>';
    const b=e.querySelectorAll('button');
    b[0].onclick=()=>{e.style.display='none';G.story&&G.story.title?G.story.title():(stop(),location.reload());};
    b[1].onclick=()=>{e.style.display='none';start();};
    e.style.display='grid';
 }

  /* ── 조작 관문 ── */
  const OBJ={leave:'회의실을 나가라',toko:'고혁명에게 달려가라',seg:'고혁명을 따라가라 — 놓친 적은 단검으로',office:'집무실로 들어가라'};
  const out=()=>{const m=K().meet,o=mOut(),v=[me.p[0] - m.doors[0],0,me.p[2] - m.doors[2]];return v[0]*o[0] + v[2]*o[2];};
  const GT={
    leave:()=>out()>1.2||(room(me.p)&&room(me.p)!=='meet'&&out()>.5),
    toko:()=>dxz(me.p,W.ko.p)<2.6&&!E.some(e=>!e.P.dead)||S.t - S.gt>25,
    seg:()=>S.segDone,
    office:()=>room(me.p)==='office'||dxz(me.p,K().office.centre)<2.2,
 };
  function gate(g){
    S.g=g;S.gt=S.t;ui.o&&(ui.o.textContent=g&&OBJ[g]?'▸ ' + OBJ[g]:'',ui.o.style.opacity=g&&OBJ[g]?1:0);
    const k=K(),m=k.meet,c=m.centre,o=mOut();
    if(g==='leave'){// 식탁 옆으로 돌아 문으로
      const ax=dir2(m.head,c),pp=[-ax[2],0,ax[0]],sg=Math.sign((m.doors[0] - c[0])*pp[0] + (m.doors[2] - c[2])*pp[2])||1;
      let w=1;for(const q of m.seats) w=mx(w,ab((q[0] - c[0])*pp[0] + (q[2] - c[2])*pp[2]) + .9);
      const sd=(p,s)=>at([p[0] + pp[0]*w*sg + ax[0]*s,0,p[2] + pp[2]*w*sg + ax[2]*s]);
      const L2=dxz(m.head,c),fe=(m.doors[0] - c[0])*ax[0] + (m.doors[2] - c[2])*ax[2]>L2*.8;
      S.path=[sd(m.head,.4),sd(c,0),...fe?[sd(c,L2)]:[],offAt(m.doors,o,-1.4),offAt(m.doors,o,2.2)];
   } else S.path=g==='toko'?[W.ko.p.slice()]:g==='office'?[offAt(k.office.door,oIn(),-1),offAt(k.office.door,oIn(),1.2),at(k.office.centre)]:null;
 }
  function marker(){// 목표 표지
    const g=S.g,k=K();
    const q=g==='leave'?k.meet.doors:g==='toko'?W.ko.p:g==='office'?k.office.door:g==='seg'&&W.ko&&dxz(me.p,W.ko.p)>7?W.ko.p:null;
    const m=ui.m;if(!m) return;
    if(!q||S.bk>.5||S.dead){m.style.display='none';return;}
    const p=G.project([q[0],(q[1]||gnd(q[0],q[2])) + 2,q[2]]);
    if(!p||p[2]<=0){m.style.display='none';return;}
    m.style.display='block';m.style.left=p[0] + 'px';m.style.top=p[1] + 'px';m.lastChild.textContent=Math.round(dxz(me.p,q)) + ' m';
 }

  /* ── 1인칭 ── */
  function botFight(){// 자동 진행: 놓친 적 → 단검 · 투척, 단검 줍기, 고혁명 따라가기
    const e0=eyeMe();let b=null,bd=1e9;
    for(const e of E){if(e.P.dead||e.k==='ko'&&e.st===0) continue;const d=dxz(e.P.p,me.p);if(e.k!=='ko'&&d<bd||e.k==='ko'&&d<9&&d<bd){bd=d;b=e;}}
    let g=null;
    if(b){
      const c=eye(b.P),see=los(e0,c);
      const tq=[c[0],c[1] - .35 + .5*7*(bd/24)**2,c[2]];// 포물선 보정
      const yy=yawTo(me.p,tq),pp=atan2(tq[1] - e0[1],dxz(tq,e0));me.yaw+=wrap(yy - me.yaw)*mn(1,G.dt*10);me.pit+=(pp - me.pit)*mn(1,G.dt*10);
      const ok=ab(wrap(yy - me.yaw))<.06;
      if(bd<1.5){if(ok) stab();return 0;}
      if(see&&kn.n>0&&bd<18){if(ok&&kn.cd<=0) toss();return 0;}
      g=navTo(me.p,b.P.p);
   } else if(kn.n<6&&kn.fl.length){
      let f=null,fd=1e9;for(const k of kn.fl){const d=dxz(k.p,me.p);if(d<fd){fd=d;f=k;}}
      if(fd<16) g=navTo(me.p,f.p);
   }
    if(!g&&W.ko) {const d=dxz(me.p,W.ko.p);if(d<2.8) return 0;g=navTo(me.p,W.ko.p);}
    if(!g) return 0;
    const a=wrap(yawTo(me.p,g) - me.yaw);me.yaw+=a*mn(1,G.dt*7);me.pit+=(-.05 - me.pit)*mn(1,G.dt*3);
    return ab(a)<.8?1:.2;
 }
  function bot(dt){
    if(S.g==='seg'||S.fight) return botFight();
    const w=S.path&&S.path[0];if(!w){if(S.g&&(S.rp=(S.rp||0) + dt)>2){S.rp=0;gate(S.g);}return 0;}
    const d=dxz(me.p,w);if(d<(S.path.length>1?.7:.45)){S.path.shift();return 0;}
    const a=wrap(yawTo(me.p,w) - me.yaw);me.yaw+=a*mn(1,dt*7);me.pit+=(-.05 - me.pit)*mn(1,dt*3);
    S.bs=(S.bs||0) + dt;if(S.bs>1.2){if(S.bp&&dxz(me.p,S.bp)<.2){const s=S.sd=-(S.sd||1);S.path.unshift(at([me.p[0] - cos(me.yaw)*1.2*s,0,me.p[2] + sin(me.yaw)*1.2*s]));}S.bs=0;S.bp=me.p.slice();}
    return ab(a)<.8?1:.15;
 }
  function stepMe(dt){
    const k=G.keys;let f=0,s=0;
    if(S.bot) f=bot(dt);else {f=(k.KeyW||k.ArrowUp?1:0) - (k.KeyS||k.ArrowDown?1:0);s=(k.KeyD||k.ArrowRight?1:0) - (k.KeyA||k.ArrowLeft?1:0);}
    const run=S.bot?S.fight||S.g==='toko':k.ShiftLeft||k.ShiftRight,n=H(f,s)||1,sp=(run?3.8:1.9)/n;
    const vx=(sin(me.yaw)*f - cos(me.yaw)*s)*sp,vz=(cos(me.yaw)*f + sin(me.yaw)*s)*sp;
    const p0=me.p.slice(),m=Math.ceil(dt/.03),h=dt/m;
    for(let i=0;i<m;i++) me.p=col([me.p[0] + vx*h,me.p[1],me.p[2] + vz*h],.3);
    const v=dt>0?dxz(me.p,p0)/dt:0,b0=Math.floor(me.bob/PI);
    me.bob+=v*dt*4.2;me.bA+=((v>.3?1:0) - me.bA)*mn(1,dt*7);
    if(Math.floor(me.bob/PI)!==b0&&me.bA>.3) sfx('click',{gain:.5,rate:.17 + R()*.05});// 발소리 (대리석)
 }
  const T=[0,0,0];
  function spkP(s){if(s==='all'){const c=K().meet.centre;return[c[0],gnd(c[0],c[2]) + 1.15,c[2]];}return typeof s==='number'?W.o[s]:W[s];}
  function camera(dt){
    const c=G.cam,t=G.time,k=K(),m=k.meet;
    if(S.cm==='est'){// 시작: 식탁 맞은편에서 상석으로 천천히 다가가는 카메라
      S.ct+=dt;const u=mn(S.ct/15,1),e=u*u*(3 - 2*u),h=m.head,ax=dir2(h,m.centre),L2=dxz(h,m.centre)*2,pp=[-ax[2],0,ax[0]];
      const a=[h[0] + ax[0]*L2*.95 + pp[0]*1.2,gnd(h[0],h[2]) + 2.7,h[2] + ax[2]*L2*.95 + pp[2]*1.2],b=[h[0] + ax[0]*L2*.42 + pp[0]*.7,gnd(h[0],h[2]) + 1.9,h[2] + ax[2]*L2*.42 + pp[2]*.7];
      c.pos=lerp3(a,b,e);c.target=at(h,1.05);c.fov=.72;c.near=.1;c.up=[0,1,0];return;
   }
    let tg=S.fix&&(S.fix.p?eye(S.fix):S.fix);
    if(!tg&&S.spk!=null&&S.spk!=='me'){const P=spkP(S.spk);if(P) tg=P.p?(P.vis!==false?eye(P):null):P;}
    if(S.held&&!tg&&W.ok&&W.ok.vis) tg=eye(W.ok);
    me.eh+=(me.ehT - me.eh)*mn(1,dt*me.ehR);
    if(S.held&&S.k0){const u=cl((S.t - S.ht - .4)/1.1,0,1),q=K().office.kneel,e=u*u*(3 - 2*u);me.p=lerp3(S.k0,at(q),e);held(0);}
    const ey=[me.p[0] - cos(me.yaw)*sin(me.bob)*.02*me.bA,me.p[1] + me.eh + (ab(cos(me.bob)) - .7)*.04*me.bA,me.p[2] + sin(me.yaw)*sin(me.bob)*.02*me.bA];
    if(!S.walk) me.bA*=.9;
    if(tg&&(S.t<S.fixF||!S.walk&&(S.mv<0||S.bot))){
      const d=[tg[0] - ey[0],tg[1] - ey[1],tg[2] - ey[2]],r=S.t<S.fixF?S.fixR:S.lock?.9:1.6;
      me.yaw+=wrap(atan2(d[0],d[2]) - me.yaw)*mn(1,dt*r);me.pit+=(cl(atan2(d[1],H(d[0],d[2])),-1,1) - me.pit)*mn(1,dt*r);
   }
    if(S.lock&&W.ok&&W.ok.vis&&!W.ok.wp){const y0=yawTo(me.p,W.ok.p),w=S.lw||.6;me.yaw=y0 + cl(wrap(me.yaw - y0),-w,w);me.pit=cl(me.pit,-.45,.4);}
    S.mv-=dt;S.sh=mx(0,S.sh - dt*1.4);
    const sh=S.sh*S.sh,yw=me.yaw + sh*.05*sin(t*37),pt=me.pit + sh*.04*sin(t*29 + 1) + kn.sa*.012;
    T[0]=ey[0] + sin(yw)*cos(pt);T[1]=ey[1] + sin(pt);T[2]=ey[2] + cos(yw)*cos(pt);
    c.pos=ey;c.target=T.slice();c.up=[0,1,0];c.near=.06;c.fov=1.12;
    const F=PP.fp;F.on=S.arm&&!S.dead&&S.bk<.5?1:0;F.kind='suit';F.gun='knife';F.aim=0;F.kick=kn.sa;F.throw=kn.ta;F.bob=me.bob;F.reload=0;
    me.sw[0]*=.9;me.sw[1]*=.9;F.sway=me.sw;
 }
  function npc(dt){// 경로점 이동 · 말하기 · 시선
    for(const P of PP.list){
      if(!P.wp) continue;
      const w=P.wp[0],dx=w[0] - P.p[0],dz=w[2] - P.p[2],d=H(dx,dz);
      P.stk+=dt;
      if(d<.08||P.stk>9){P.wp.shift();P.stk=0;if(d>=.08) P.p=at(w);if(!P.wp.length){P.wp=null;P.pose='stand';P.done&&P.done(P);}continue;}
      const s=mn(d,P.sp*dt);P.p=col([P.p[0] + dx/d*s,P.p[1],P.p[2] + dz/d*s],.25);
      P.yaw+=wrap(atan2(dx,dz) - P.yaw)*mn(1,dt*6);
   }
    const tk=S.t<S.lineEnd;
    W.o.forEach((P,i)=>{// 말하는 간부는 상석을, 나머지는 말하는 사람을 봄
      P.talk=tk&&(S.spk==='all'?i<5:S.spk===i)?1:0;
      if(S.beat==='meet'&&!P.dead&&tk) P.look=S.spk==='me'||S.spk==='all'||S.spk===i?G.cam.pos:typeof S.spk==='number'&&W.o[S.spk]?eye(W.o[S.spk]):P.look;
   });
    for(const k of ['ko','ok']) if(W[k]) W[k].talk=tk&&S.spk===k?1:0;
    if(W.ok&&W.ok.vis&&S.held&&W.ok.pose!=='aim'&&W.ok.pose!=='fire'&&!W.ok.wp) W.ok.look=G.cam.pos;
    if(W.ok&&(W.ok.pose==='aim'||W.ok.pose==='fire')) W.ok.aim=G.cam.pos;
 }
  function dress(dt){// 환경 · 조명 · 소리
    G.shadowFocus=me.p;G.shadowRange=16;
    if(S.held&&W.ok&&W.ok.vis){const p=W.ok.p;L([p[0] + sin(me.yaw + 2.2)*1.4,p[1] + 2.2,p[2] + cos(me.yaw + 2.2)*1.4],[1,.82,.6],1.2,7);}// 집무실: 얼굴이 보이게 따뜻한 보조광
    const bk=ui.bk;if(bk){S.bk+=cl(S.bkT - S.bk,-dt*S.bkR,dt*S.bkR);bk.style.opacity=S.bk;}
    const d=doors();if(d){d.meet=(d.meet||0) + cl(S.dm - (d.meet||0),-dt*S.dmR,dt*S.dmR);d.office=(d.office||0) + cl(S.dof - (d.office||0),-dt*S.dofR,dt*S.dofR);}
    if(G.frame % 6===0&&G.cam.target) G.sfx.listener(G.cam.pos,V3.norm(V3.sub(G.cam.target,G.cam.pos)));
 }
  function hud(dt){
    if(!ui.f) return;
    const sh=S.arm&&!S.dead&&S.beat!=='end';ui.f.style.display=sh?'block':'none';
    if(!sh) return;
    if(S.t - me.ht>5) me.hp=mn(100,me.hp + 22*dt);
    S.hu=mx(0,S.hu - dt*1.5);S.hm=mx(0,S.hm - dt*4);
    ui.hpi.style.width=me.hp + '%';ui.hpb.textContent=Math.ceil(me.hp);
    ui.bv.style.opacity=mx(S.hu,me.hp<40?(1 - me.hp/40)*.8:0);ui.hm.style.opacity=S.hm;
    ui.ki.forEach((e,i)=>e.className=i<kn.n?'':'e');ui.kb.textContent=kn.n;
    ui.n.style.opacity=S.t<(S.hintT||0)?1:.35;
 }
  function mark(){S.hm=1;}

  /* ── 대사 · 해설 (스토리 1 과 같은 요소) ── */
  function showDl(v){ui.dl&&(ui.dl.style.opacity=v?1:0);}
  function say(l){
    const [w,s,a]=l,n=s.length;
    if(w==='*'){ui.cap.textContent=s;ui.cap.style.opacity=1;showDl(0);S.nx=S.t + 2.4 + n*.075;later(S.nx - S.t - .6,()=>ui.cap.style.opacity=0);return;}
    ui.dl.innerHTML=`<b style="color:${COL[w]||'#c9d2db'}">${w}</b>${s}`;showDl(1);
    S.spk=w===ME?'me':WHO[w]??null;S.lineEnd=S.t + 1.2 + n*.075;S.nx=S.lineEnd + .45;
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
      if(l[0]==='!'){if(l[2]>.5||l[1]==='run'||l[1].startsWith('fight')) showDl(0),S.spk=null;act(l[1]);if(S.beat!=='end') S.nx=S.t + l[2];continue;}
      say(l);
   }
    if(S.t>S.nx + .2&&S.g&&S.spk!=null){showDl(0);S.spk=null;}// 관문 대기 중엔 대사칸을 닫음
 }
  function go(b){// 테스트 훅 · 재시작: 해당 장면 상태로 점프
    let n=BEATS.indexOf(b);if(n<0) n=0,b='meet';
    init3();stage(n);S.beat=b;S.i=idx(b);S.nx=0;S.cm='fp';S.bk=S.bkT=0;S.ct=0;
    if(n===0) W.me.vis=true;
    if(n===4) S.walk=1;
    if(n===6){S.walk=1;}
    if(n===8){W.ok.pose='stand';W.ok.look=eyeMe();S.fix=W.ok;}
    if(n===9){S.bk=S.bkT=1;}
    G.sfx.music(n>=4&&n<=5?'combat':'off');
 }
  function init3(){// 공통 시작 상태
    const ov=$('ov');ov&&(ov.style.display='none');
    ui.dl=$('dl');ui.cap=$('cap');ui.ttl=$('ttl');ui.bk=$('bk');ui.end=$('end');ui.sk=$('sk');
    for(const e of [ui.cap,ui.ttl]) e&&(e.style.opacity=0);
    ui.end&&(ui.end.style.display='none');ui.h&&(ui.h.style.opacity=0);ui.t&&(ui.t.style.opacity=0);ui.f&&(ui.f.style.display='none');ui.fd&&(ui.fd.style.display='none');
    G.cabin&&(G.cabin.on=false);G.palace&&(G.palace.on=true);
    S.on=1;S.t=0;S.lineEnd=0;S.spk=null;S.mv=0;S.bkR=2;S.fixR=1.8;S.dmR=.6;S.dofR=.8;S.kills=0;S.seg=0;S.hu=S.hm=0;S.k0=null;S.lw=.6;wait.length=0;gate(null);showDl(0);
    if(S.sea==null) S.sea=G.env.sea;
    G.setEnv({sunEl:-12,sunAz:210,cloud:.5,haze:.3,indoor:1,exposure:1.35,sea:0});
    G.sfx.init();G.sfx.loop('sea',0);G.sfx.loop('wind',1,{gain:.06,rate:.5});
 }
  function start(){const sc=!S.st&&G.params.get('story')==='3'&&G.params.get('scene');S.st=1;go(sc||'meet');}
  function stop(){
    S.on=0;gate(null);showDl(0);wait.length=0;const F=PP.fp;F.on=0;F.kind='rok';F.gun='pistol';F.throw=0;F.kick=0;
    G.palace&&(G.palace.on=false);S.walk=0;S.fight=0;E.length=0;kn.fly.length=kn.fl.length=0;
    for(const k of ['p','m','f','fd']) ui[k]&&(ui[k].style.display='none');for(const k of ['o','h','t']) ui[k]&&(ui[k].style.opacity=0);ui.bk&&(ui.bk.style.opacity=0);
    G.setEnv({indoor:0,exposure:1,sea:S.sea??.55});S.sea=null;G.sfx.loop('wind',0);G.sfx.music('calm');
 }
  function update(dt){
    if(!S.on) return;
    try {
      const sd=dt*(G.keys.Tab&&!S.walk?4:1);// Tab: 컷신 빨리 감기
      run(sd);npc(sd);
      if(S.fight||S.g==='toko'||S.beat==='call'){foes(dt);koAI(dt);}
      if(S.walk&&S.cm==='fp'&&!S.dead) stepMe(dt);
      if(S.arm&&!S.dead){if(S.ml){S.ml=0;stab();}if(S.mr){S.mr=0;toss();}}
      S.ml=S.mr=0;knives(dt);S.eq=0;drawKnives();
      for(const e of E) if(e.P.dead&&!e.hid&&dxz(e.P.p,me.p)>30){e.P.vis=false;e.hid=1;}// 멀리 남은 시신은 숨김 (인원 예산)
      camera(dt);marker();dress(dt);hud(dt);
      ui.sk&&(ui.sk.style.display=S.beat!=='end'&&!S.walk&&S.g!=='choice'?'block':'none');
   } catch (e){G.err('[story3] ' + (e.stack||e));}
 }
  const api=G.story3={S,go,start,stop,me,kn,E,W,stab,toss,act,SC,get on(){return !!S.on;},get bot(){return !!S.bot;},set bot(v){S.bot=!!v;}};
  G.register('story3',{
    init(){
      try {G.addMesh&&G.addMesh('s3knife',knifeMesh());} catch (e){G.err('[story3] knife ' + e);}
      G.css(`#s3o,#s3h,#s3p,#s3m,#s3t,#s3f,#s3d{position:absolute}
#s3o{left:5vw;top:13vh;font:600 2.1vh system-ui;letter-spacing:.06em;color:#f2e6c4;text-shadow:0 1px 5px #000;opacity:0;transition:opacity .6s}
#s3h{left:5vw;top:17vh;font:400 1.6vh system-ui;color:#c8d0d8;text-shadow:0 1px 4px #000;opacity:0;transition:opacity 1s}
#s3p{left:50%;top:60%;transform:translateX(-50%);padding:.35em 1.1em;font:600 2.1vh system-ui;letter-spacing:.08em;color:#fff;background:#000b;border:1px solid #fff5;border-radius:4px;display:none}
#s3m{transform:translate(-50%,-100%);text-align:center;font:600 1.4vh system-ui;color:#f2e6c4cc;text-shadow:0 1px 3px #000;display:none}
#s3m i{display:block;width:.8vh;height:.8vh;margin:0 auto .5vh;border:2px solid #f2e6c4aa;transform:rotate(45deg)}
#s3t{inset:0;display:grid;place-content:center;text-align:center;color:#ebe4d8;opacity:0;transition:opacity 1.4s}
#s3t small{font:400 1.9vh system-ui;letter-spacing:.55em;color:#a9a196}#s3t b{display:block;font:800 6.4vh system-ui;letter-spacing:.14em;margin:.4em 0;color:#fff}
#s3f{inset:0;display:none;color:#fff;font-family:system-ui,sans-serif;text-shadow:0 1px 3px #000c}
#s3x{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:#fffc;box-shadow:0 0 2px #000}
#s3hm{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px;border:2px solid #fff;border-width:0 2px;transform:rotate(45deg);opacity:0;clip-path:polygon(0 0,35% 0,35% 100%,0 100%,0 0,100% 0,100% 100%,65% 100%,65% 0)}
#s3hp{position:absolute;left:4vw;bottom:6vh;width:150px;height:8px;background:#0008;border-radius:4px;box-shadow:0 0 0 1px #fff4}#s3hp i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#aab3bb,#fff);border-radius:4px}#s3hp b{position:absolute;bottom:12px;left:0;font-size:30px}#s3hp small{position:absolute;top:13px;left:0;font-size:12px;letter-spacing:.3em;color:#ccd}
#s3k{position:absolute;right:4vw;bottom:5vh;text-align:right}#s3k b{font-size:46px;font-weight:700}#s3k small{display:block;font-size:14px;letter-spacing:.15em;color:#9bc}#s3k u{display:flex;gap:6px;justify-content:flex-end;margin-bottom:6px}
#s3k s{width:5px;height:26px;background:linear-gradient(#fff,#cfd6dc 62%,#333 64%,#222);clip-path:polygon(50% 0,100% 22%,100% 100%,0 100%,0 22%)}#s3k s.e{opacity:.2}
#s3n{position:absolute;left:50%;bottom:3vh;transform:translateX(-50%);font-size:14px;letter-spacing:.1em;color:#dde3e8;transition:opacity 1s}
#s3bv{position:absolute;inset:0;opacity:0;background:radial-gradient(#a0000000 40%,#a0000044 70%,#7a0000c0)}
#s3d{inset:0;display:none;place-content:center;justify-items:center;background:radial-gradient(#0006,#000d);pointer-events:auto;color:#fff;font-family:system-ui}#s3d b{font-size:clamp(44px,8vw,100px);letter-spacing:.4em;margin-right:-.4em}#s3d small{font-size:16px;color:#bbb}#s3d button{margin:1.2em 0 .6em;padding:.35em 2.4em;font:800 clamp(22px,3vw,40px) system-ui;letter-spacing:.4em;color:#111;background:#fff;border:0;border-radius:8px;cursor:pointer}`);
      ui.o=G.el('div',{id:'s3o'});ui.h=G.el('div',{id:'s3h',textContent:'WASD 이동 · 마우스 둘러보기 · Shift 달리기'});
      ui.p=G.el('div',{id:'s3p'});ui.m=G.el('div',{id:'s3m',innerHTML:'<i></i><span></span>'});
      ui.t=G.el('div',{id:'s3t',innerHTML:'<small>스토리 3</small><b>북한 주석궁 : 다시 지금 북한으로</b><small>조선민주주의인민공화국편</small>'});
      ui.f=G.el('div',{id:'s3f',innerHTML:'<div id=s3bv></div><div id=s3x></div><div id=s3hm></div><div id=s3hp><i></i><b></b><small>체력</small></div><div id=s3k><u>' + '<s></s>'.repeat(6) + '</u><b></b><small>투척단검</small></div><div id=s3n>좌클릭 단검 · 우클릭/Q 투척단검 · E 줍기 · Shift 달리기</div>'});
      ui.hpi=ui.f.querySelector('#s3hp i');ui.hpb=ui.f.querySelector('#s3hp b');ui.bv=ui.f.querySelector('#s3bv');ui.hm=ui.f.querySelector('#s3hm');
      ui.ki=[...ui.f.querySelectorAll('#s3k s')];ui.kb=ui.f.querySelector('#s3k b');ui.n=ui.f.querySelector('#s3n');
      ui.fd=G.el('div',{id:'s3d',innerHTML:'<b>전사</b><small>리충성이 쓰러졌다</small><button>다시 하기</button><small>Enter</small>'});
      ui.fd.querySelector('button').onclick=()=>{retry();G.canvas.requestPointerLock&&G.canvas.requestPointerLock();};
      if(G.params.has('nohud')) for(const k of ['o','h','p','m','f']) ui[k].style.visibility='hidden';
      addEventListener('keydown',e=>{
        if(!S.on) return;
        if(e.code==='KeyE') S.eq=1;
        if(e.code==='KeyQ') S.mr=1;
        if(e.code==='Enter'&&S.dead) retry();
     });
      addEventListener('mousedown',e=>{if(!S.on||!S.arm||document.pointerLockElement!==G.canvas) return;if(e.button===0) S.ml=1;if(e.button===2) S.mr=1;});
      addEventListener('contextmenu',e=>S.on&&e.preventDefault());
      G.canvas.addEventListener('click',()=>{S.on&&S.beat!=='end'&&!S.dead&&G.canvas.requestPointerLock&&G.canvas.requestPointerLock();});
      addEventListener('mousemove',e=>{
        if(!S.on||S.cm!=='fp'||S.dead||!(document.pointerLockElement===G.canvas||e.buttons)) return;
        const k=S.lock?.0012:.0022;me.yaw-=e.movementX*k;me.pit=cl(me.pit - e.movementY*k,-1.3,1.3);S.mv=2.5;
        me.sw[0]=cl(me.sw[0] - e.movementX*.002,-.3,.3);me.sw[1]=cl(me.sw[1] + e.movementY*.002,-.3,.3);
     });
      const sk=$('sk');sk&&sk.addEventListener('click',()=>{if(S.on&&!S.walk){S.nx=mn(S.nx,S.t);S.lineEnd=S.t;}});
   },
    update
 },'story');
  G.mode==='story'&&G.order.unshift(G.order.pop());// update 를 앞으로: 인물 · 주석궁보다 먼저
}
