'use strict';
/* FPS — 추락한 여객기 안팎의 1인칭 총격전: 플레이어 이동·사격 · 북한군 지휘(50명) · 아군 4명 · 전투 HUD */
{
  const C=G.cabin,PP=G.people,R=Math.random,{sin,cos,atan2,hypot,min,max,abs,PI}=Math,cl=G.clamp;
  // 추락 시 뒤쪽 동체의 상대 변환 (mod_cabin 과 같은 상수) — 뒤 동체 바닥 높이 계산용
  const TZ=-6.45,TR=M4.mul(M4.trs([-.5,.85,TZ-1.3],.1,.03,-.16),M4.trs([0,-1,-TZ])),TRI=M4.invert(TR);
  const AR=G.arms; // 무기 · 탄약 · 사격 · 바닥 총은 mod_arms (이 모듈은 적 · 아군 · 방탄판 · 피해 · HUD 틀)
  const ONA={free:1,fire:1,ads:1,sw:1,use:1,rl:1},RPA={free:1,fire:0,ads:0,sw:0,use:1,rl:0},OFFA={free:0,fire:0,ads:0,sw:0,use:0,rl:0};
  const DROP1={k2:12,k2c1:4,k2c:10,k2a:10,m16:10,aug:8,akm:6,k7:8,k14:6,rpg7:4,m134:3}; // 바닥 총 가중치 (§4.2 · 중화기 1개 · K14 1개)
  const D={ht:0,mh:100,pk:0,get sh(){return AR.D.shots;}}; // 검증용 통계
  const S={hp:100,ammo:0,mag:0,kills:0,total:50,alive:0,plate:100,spare:3,body:0,dead:0,scope:0}; // hp = 방탄판 HP
  // core 는 G.fps 를 프레임률 숫자로도 쓴다 → 접근자로 두 역할
  const F={on:false,bot:G.params.has('bot'),S,start,stop,revive,die:()=>F.on&&!pl.dead&&die(),rate:+G.fps||60,D,valueOf(){return this.rate;},toFixed(n){return this.rate.toFixed(n);}};
  Object.defineProperty(G,'fps',{get:()=>F,set:v=>{if(typeof v==='number'&&v===v)F.rate=v;},configurable:true});
  const pl={p:[0,0,0],yaw:0,pit:0,vy:0,cr:0,bob:0,bobA:0,ins:1,ads:0,hurt:9,ex:0,sw:[0,0],dead:0,end:0,mv:0,run:0,air:0,rp:0,iv:0,bn:0,bt:0};
  F.pl=pl;F.E=()=>E; // 테스트 훅: 플레이어 상태 · 적 목록
  const inp={f:0,s:0,run:0,cr:0,use:0},mouse={dx:0,dy:0};
  let fires=[],kp={},E=[],A=[],posts=[],routes={},occ={},dir={t:0,n:0},o0={},ui={},hud={t:0,hm:0,dd:0,dA:0},T=0;
  const v3=(a,b,s=1)=>[a[0]+b[0]*s,a[1]+b[1]*s,a[2]+b[2]*s],nrm=a=>{const l=hypot(...a)||1;return[a[0]/l,a[1]/l,a[2]/l];};
  const fwd=(y,p)=>[sin(y)*cos(p),sin(p),cos(y)*cos(p)];
  const wp=P=>P.M?C.w(P.p):P.p; // 인물 발 위치 (월드)

  /* ── 지형: 바닥 높이 · 충돌 · 광선 ── */
  const plane=(M,x,z)=>{const o=M4.point(M,[0,0,0]);return o[1]-(M[4]*(x-o[0])+M[6]*(z-o[2]))/M[5];};
  function floorAt(x,z,y){ // 월드 xz 의 바닥 높이 → [y, 구역: 0 바깥 · 1 앞 객실 · 2 뒤 객실]
    const l=C.l([x,y,z]);
    if(abs(l[0])<1.64&&l[2]>TZ-1.3&&l[2]<14.98)return[plane(C.M,x,z),1];
    const q=M4.point(TRI,l);
    if(abs(q[0])<1.64&&q[2]>-14.98&&q[2]<=TZ)return[plane(M4.mul(C.M,TR),x,z),2];
    return[C.ground(x,z),0];
  }
  const BOX=()=>C.K.cover.slice(8); // 엔진·날개 잔해 (흙더미는 지형이라 넘어감)
  function move(p,dx,dz,r){ // 수평 이동 + 충돌 → p 갱신
    let x=p[0]+dx,z=p[2]+dz;
    const l=C.l([x,p[1],z]);
    if(abs(l[0])<2.6&&l[2]>-23&&l[2]<21){
      const c=C.collide([l[0],0,l[2]],r),q=M4.point(TRI,c);
      if(abs(c[0])<2.06&&c[2]>15.2)c[0]=c[0]<0?-2.07:2.07; // 막힌 기수
      if(abs(q[0])<2.06&&q[2]<-15.2){q[0]=q[0]<0?-2.07:2.07;const b=M4.point(TR,q);c[0]=b[0];c[2]=b[2];} // 막힌 꼬리
      const w=C.w([c[0],l[1],c[2]]);x=w[0];z=w[2];
    }
    for(const b of BOX()){ // 잔해 상자 밀어내기
      const cx=cl(x,b[0]-b[3],b[0]+b[3]),cz=cl(z,b[2]-b[5],b[2]+b[5]),d=hypot(x-cx,z-cz);
      if(d<r&&d>1e-5){x=cx+(x-cx)/d*r;z=cz+(z-cz)/d*r;}
      else if(d<=1e-5)x=b[0]+(x>b[0]?1:-1)*(b[3]+r);
    }
    const e=C.w([-5.9,-1.6,3]),d=hypot(x-e[0],z-e[2]); // 남은 오른쪽 엔진
    if(d<1.6+r){x=e[0]+(x-e[0])/d*(1.6+r);z=e[2]+(z-e[2])/d*(1.6+r);}
    p[0]=x;p[2]=z;
  }
  function cabRay(o,d,mx){const l=C.l(o),e=C.l(v3(o,d));return C.ray(l,[e[0]-l[0],e[1]-l[1],e[2]-l[2]],mx);}
  function boxRay(o,d,t){
    for(const b of BOX()){
      let s0=0,s1=t;
      for(let i=0;i<3&&s0<=s1;i++){const v=1/(d[i]||1e-9),e=(b[i]-b[i+3]-o[i])*v,f=(b[i]+b[i+3]-o[i])*v;s0=max(s0,min(e,f));s1=min(s1,max(e,f));}
      if(s0<=s1&&s0>0)t=s0;
    }
    return t;
  }
  function gndRay(o,d,t){ // 지면 행진 (기내 바닥 아래는 객실 광선이 먼저 막음)
    if(d[1]>.02)return t;
    for(let s=.4,k=0;s<t&&k<90;s+=.5+s*.04,k++){
      const x=o[0]+d[0]*s,z=o[2]+d[2]*s;
      if(o[1]+d[1]*s<C.ground(x,z))return s;
    }
    return t;
  }
  const solid=(o,d,mx)=>gndRay(o,d,boxRay(o,d,cabRay(o,d,mx)));
  function los(a,b){const d=V3.sub(b,a),L=hypot(...d);return solid(a,nrm(d),L)>=L-.1;}

  /* ── 경로: 평면 좌표 [x, z, 멈춤(1 웅크림 · 2 서서)] ── */
  const RT={
    hole:[[5.4,2.7,1],[3.2,2.9],[1.15,2.9,1]],
    fl:[[3.8,16],[3.4,14.45],[.9,14.45],[.05,14.2],[.05,11.2,2],[0,7.6,1]],
    fr:[[-3.8,16],[-3.4,14.45],[-.9,14.45],[-.05,14.2],[-.05,11.2,2],[0,7.6,1]],
    bl:[[4.6,-7.4],[2.6,-7.2],[0,-7.1],[0,-5.4,2],[0,-3,1]],
    br:[[-4.6,-7.4],[-2.8,-7.2],[0,-7.1],[0,-5.4,2],[0,-3,1]]
  };
  function route(sp){
    const l=C.l(sp),k=l[0]>0?(l[2]>12?'fl':l[2]<-5?'bl':R()<.55?'hole':R()<.5?'fl':'bl'):(l[2]>-2&&R()<.7?'fr':'br');
    const pts=RT[k].map(a=>{const w=C.w([a[0],0,a[1]]);return{p:[w[0],0,w[2]],st:a[2]||0,key:k+a[1],ins:abs(a[0])<1.7};});
    if(R()<.65){ // 가는 길의 흙더미 뒤에 먼저 숨는다
      let best=null,bd=9;
      for(const b of C.K.cover.slice(0,8)){
        const d=hypot(b[0]-sp[0],b[2]-sp[2])+hypot(b[0]-pts[0].p[0],b[2]-pts[0].p[2])-hypot(sp[0]-pts[0].p[0],sp[2]-pts[0].p[2]);
        if(d<bd){bd=d;best=b;}
      }
      if(best){const n=nrm([best[0],0,best[2]]);pts.unshift({p:[best[0]+n[0]*1.9,0,best[2]+n[2]*1.9],st:1,key:'m'+best[0],out:1});}
    }
    return pts;
  }

  /* ── 시작 · 종료 ── */
  function start(o={}){
    stop();o0=o;T=0;
    Object.assign(D,{ht:0,mh:100,pk:0});Object.assign(S,{hp:100,plate:100,spare:3,body:0,dead:0,scope:0,kills:0,total:o.total||50,alive:0});
    const s=o.pos||C.w([0,0,2]);
    Object.assign(pl,{p:[s[0],s[1],s[2]],yaw:o.yaw??-PI/2,pit:-.04,vy:0,cr:0,ads:0,hurt:9,ex:0,dead:0,end:0,rp:0,iv:0,bn:0,bt:0,ended:0,bot:null});
    pl.p[1]=floorAt(pl.p[0],pl.p[2],pl.p[1]+1)[0];
    dir={t:0,n:0};occ={};E=[];fires=[];ui.fd.style.display='none';ui.fdK='';hud.msg=o.cp?['체크포인트 — 전투 시작부터 다시',3.5]:null;
    // 아군: 앞 2명 · 뒤 2명 (플레이어가 밀면 비켜 줌)
    posts=[[0,4.9,1,0],[0,3.55,0,0],[0,-.85,1,PI],[0,.5,0,PI]];
    A=(o.allies||[]).slice(0,4).map((P,i)=>{
      if(!P.M){P.p=C.l(P.p);P.M=C.M;}
      if(P.p[1]>.25)P.p[1]=0;
      P.gun=P.gun||'rifle';P.pose='stand';P.dead=false;P.vis=true;
      return{P,post:posts[i%4],t:R(),tg:null,bt:0,bn:0,cd:1+R()};
    });
    F.on=true;ui.fh.style.display=G.params.has('nohud')?'none':'block';ui.fe.style.opacity=0;
    AR.bind(adapter());AR.kit(1);AR.bot=F.bot;drops1(); // 시작 장비 K2C1 + K7 기관단총 · 바닥 총 (다시 하기 = 새 배치)
    G.params.get('drops')==='all'&&AR.drops.all();
    PP.fp.on=1;
    G.sfx.music('combat');G.sfx.loop('wind',1,{gain:.2});
  }
  function stop(){
    if(!F.on)return;
    F.on=false;AR.unbind();PP.fp.on=PP.fp.hide=PP.fp.scope=0;for(const e of E)PP.remove(e.P);E=[];A=[];
    ui.fh&&(ui.fh.style.display='none');G.sfx.loop('wind',0);
    try{document.exitPointerLock&&document.pointerLockElement&&document.exitPointerLock();}catch(e){}
  }
  function finish(){ // 승리만 (전사는 부활로 이어진다)
    if(pl.end)return;pl.end=T+3;
    ui.fe.innerHTML='<b>북한군 제압 완료</b><small>추락 현장을 지켜냈다</small>';ui.fe.style.opacity=1;
  }
  /* ── 방탄판 · 피해 · 전사 · 부활 ── */
  const inF=()=>fires.some(f=>f[3]>G.time&&hypot(f[0]-pl.p[0],f[2]-pl.p[2])<1.25&&pl.p[1]<f[1]+2&&pl.p[1]>f[1]-1.6); // 불 1.25 m 안
  const safe=()=>G.params.has('god')||pl.dead||T<pl.iv;
  function bodyHit(head){S.body++;hud.fl=1;if(head||S.body>=2)die();}
  function hurt(dm){ // 총탄: 방탄판이 받는다 → 0 이면 머리(즉사) 또는 몸(2발 사망)
    if(safe())return;D.ht++;hud.dd=hud.fl=1;G.sfx.play('hit',{gain:.6});
    if(S.plate>0)S.plate=max(0,S.plate-dm);else bodyHit(R()<(pl.cr>.5?.07:.15));
    D.mh=min(D.mh,S.plate);
  }
  function die(){
    pl.dead=T;S.dead=1;S.plate=0;pl.rp=0;G.sfx.play('hit',{gain:1,rate:.5});
    try{document.pointerLockElement&&document.exitPointerLock();}catch(e){}
  }
  function revive(){ // 예비 방탄판 1개를 써서 제자리(기내) 또는 시작 지점(아군 사이)에서 부활 · 3초 무적. 예비가 없으면 체크포인트(전투 시작)부터 다시
    if(!F.on||!pl.dead)return;
    if(S.spare<=0&&S.kills<S.total)return retry();
    if(!pl.ins||inF()){const s=o0.pos||C.w([0,0,2]);pl.p=[s[0],floorAt(s[0],s[2],s[1]+1)[0],s[2]];pl.yaw=o0.yaw??-PI/2;}
    Object.assign(pl,{dead:0,iv:T+3,pit:-.04,vy:0,bn:0});Object.assign(S,{hp:100,plate:100,spare:max(0,S.spare-1),body:0,dead:0});
    ui.fd.style.display='none';hud.msg=['방탄판 1개로 부활 · 3초간 무적',T+3];G.sfx.play('click');
    if(S.kills>=S.total)finish();
  }
  function retry(){ui.fd.style.display='none';G.sfx.play('click');pl.rt=1;} // 체크포인트 = 전투 시작 (다음 프레임 update 에서: 이야기 onRetry 가 장면을 다시 세움 · 없으면 같은 설정으로 다시 시작)
  const card=()=>{ // 전사 카드: 부활(예비 방탄판 1개) 또는 체크포인트부터 다시
    const rt=S.spare<=0&&S.kills<S.total,k=rt+'|'+S.spare;if(ui.fdK===k)return;ui.fdK=k;
    ui.fdB.textContent=rt?'다시 하기':'부활';
    ui.fdN.textContent=rt?'예비 방탄판이 없다 · 체크포인트(전투 시작)부터 다시':S.spare>0?'예비 방탄판 1개를 써서 부활 · 남는 예비 방탄판 '+(S.spare-1)+'개':'';
  };

  /* ── 적 지휘: 살아 있는 적 6~9명 유지, 보이지 않는 곳에서 등장 ── */
  function spawn(){
    const eye=v3(pl.p,[0,1.6,0]),K=C.K.spawn;
    let sp=null;
    for(let k=0;k<12&&!sp;k++){const c=K[(R()*K.length)|0];if(k>9||!los(eye,v3(c,[0,1.5,0])))sp=c;}
    const P=PP.add('nk',{p:[sp[0]+R()*2-1,sp[1],sp[2]+R()*2-1],pose:'run',gun:'ak',seed:100+dir.n*7});
    P.p[1]=C.ground(P.p[0],P.p[2]);
    E.push({P,path:route(P.p),wi:0,st:'go',t:0,tg:null,re:0,bn:0,bt:0,nb:0,hp:100,stuck:0,slot:[0,0],key:''});
    dir.n++;
  }
  function director(dt){
    S.alive=E.filter(e=>!e.P.dead).length;
    if(pl.dead)return; // 죽어 있는 동안에는 새 적이 나오지 않는다
    dir.t-=dt;
    const want=min(9,6+(S.kills/12|0));
    if(dir.n<S.total&&S.alive<want&&dir.t<=0){spawn();dir.t=dir.n<6?.35:1+R();}
  }
  const chest=P=>{const e=PP.eye(P);return[e[0],e[1]-.3,e[2]];};
  const free=e=>{e.rs&&occ[e.key]--;e.rs=0;}; // 잡아 둔 자리 반납 (가다 죽거나 · 막혀 다음 지점으로 가도 — 안 돌려주면 줄이 꼬리 뒤 밖까지 밀려 끝까지 숨어 버림)
  function slotPos(e,w){ // 같은 자리의 여러 명은 플레이어 반대쪽으로 줄을 선다
    free(e);const n=occ[w.key]=(occ[w.key]||0)+1;e.key=w.key;e.rs=1;
    if(n<2)return w.p.slice();
    const l=C.l(w.p),k=n-1;
    if(w.ins){if(abs(l[0])<.3)l[2]+=(l[2]>C.l(pl.p)[2]?1:-1)*k*1.05;else l[2]+=(k%2?.7:-.7)*((k+1)>>1);}
    else l[0]+=(k%2?1.3:-1.3)*((k+1)>>1)*(l[0]<0?-1:1)*.7,l[2]+=(k%2?1.2:-1.2)*((k+1)>>1);
    const p=C.w(l);return[p[0],0,p[2]];
  }
  function enemy(e,dt){
    const P=e.P;if(P.dead)return;
    e.t+=dt;
    const w=e.path[e.wi],fz=floorAt(P.p[0],P.p[2],P.p[1]+.8);
    P.p[1]+=(fz[0]-P.p[1])*min(1,dt*(fz[0]>P.p[1]?7:12));
    if(e.st==='go'){
      const tgt=e.goal||(e.goal=w.st?slotPos(e,w):w.p),d=[tgt[0]-P.p[0],0,tgt[2]-P.p[2]],L=hypot(d[0],d[2]);
      const sp=fz[1]?1.7:3.3;
      P.pose=fz[1]?'walk':'run';P.aim=null;
      if(L<.15||e.t>14){ // 도착 (또는 막힘 → 다음 지점)
        e.goal=null;e.t=0;
        if(w.st&&L<.5){e.st='hold';e.ht=4+R()*5+(e.wi===e.path.length-1?1e9:0);e.cpose=w.st===1?'crouch':'aim';e.bn=0;}
        else{free(e);e.wi=min(e.wi+1,e.path.length-1);}
      }else{
        const ox=P.p[0],oz=P.p[2],s=min(L,sp*dt);
        if(fz[1])move(P.p,d[0]/L*s,d[2]/L*s,.2);else{P.p[0]+=d[0]/L*s;P.p[2]+=d[2]/L*s;}
        P.yaw=atan2(P.p[0]-ox,P.p[2]-oz)||P.yaw;
        P.look=v3(P.p,[sin(P.yaw)*5,1.6,cos(P.yaw)*5]);
      }
      return;
    }
    // hold: 표적 탐색 → 반응 지연 → 점사 → 일정 시간 뒤 자리 이동
    e.ht-=dt;e.bt-=dt;
    const eye=PP.eye(P);
    if((e.scan=(e.scan||0)-dt)<=0){
      e.scan=.3+R()*.2;
      const pe=v3(pl.p,[0,1.55-.55*pl.cr,0]),opts=[];
      if(!pl.dead&&los(eye,pe))opts.push({pl:1,p:pe});
      for(const a of A){const c=chest(a.P);if(hypot(...V3.sub(c,eye))<40&&los(eye,c))opts.push({a,p:c});}
      const pick=opts.length?(opts[0].pl&&R()<(AR.quiet?.35:.65)?opts[0]:opts[(R()*opts.length)|0]):null; // K7 소음기: 덜 눈에 띈다
      if(pick&&(!e.tg||!!e.tg.pl!==!!pick.pl||e.tg.a!==pick.a))e.re=.5+R()*.6; // 반응 지연 0.5~1.1초
      e.tg=pick;
    }
    const tg=e.tg;
    if(tg){
      if(tg.pl)tg.p=v3(pl.p,[0,1.5-.55*pl.cr,0]);
      P.aim=tg.p;P.look=tg.p;P.yaw+=cl(atan2(tg.p[0]-P.p[0],tg.p[2]-P.p[2])-P.yaw+(abs(atan2(tg.p[0]-P.p[0],tg.p[2]-P.p[2])-P.yaw)>PI?(P.yaw>0?2*PI:-2*PI):0),-4*dt,4*dt);
      e.re-=dt;
      if(e.re<=0&&e.bt<=0){
        if(e.nb<=0){e.nb=3+(R()*4|0);}
        shotE(e,tg);e.nb--;e.bt=e.nb>0?.1:(e.bn++,.7+R()*1.3);
      }
    }else{P.aim=null;}
    P.pose=tg&&e.bt>0&&e.nb>0?'fire':e.cpose;
    if(e.ht<=0||(e.bn>=3&&e.wi<e.path.length-1)){free(e);e.st='go';e.t=0;e.wi=min(e.wi+1,e.path.length-1);e.bn=0;}
  }
  function shotE(e,tg){ // 적 사격: 명중은 확률(노출 시간이 길수록 정확), 예광탄은 항상 보인다
    const m=PP.muzzle(e.P),o=[m[0],m[1],m[2]],d=hypot(...V3.sub(tg.p,o));
    let hit=0;
    if(tg.pl){
      const acc=cl(.035+pl.ex*.045,.035,.26)*(pl.cr>.5?.6:1)*(pl.mv>3?.65:1)*(d<7?1.3:d>22?.55:1);
      hit=R()<acc;
      if(hit){hurt(6+R()*6);hud.dA=atan2(o[0]-pl.p[0],o[2]-pl.p[2]);}
    }else if(R()<.12){tg.a.P.pose='hit';hit=1;}
    const miss=hit?.05:.35+d*.03,tp=[tg.p[0]+(R()-.5)*miss*2,tg.p[1]+(R()-.6)*miss,tg.p[2]+(R()-.5)*miss*2];
    const dd=nrm(V3.sub(tp,o));
    G.fx.tracer(o,dd,320,0);G.fx.burst('muzzle',o,{size:.025,dir:dd});
    G.addLight(o,[1,.7,.35],2.5,4,.05);G.sfx.play('r762',{pos:o,gain:.7}); // 북한군 AKM
    if(!hit){const t=solid(o,dd,60);if(t<60)G.fx.burst('hit',v3(o,dd,t),{size:.12});}
  }
  function kill(e,head){
    const P=e.P;P.pose='dead';P.dead=true;P.aim=null;e.ammo=20+(R()*30|0);e.td=T;e.pl=R()<.15;e.gun=1; // 15% 방탄판 · AKM 은 총째로 가져가기 전까지 시신에 남는다
    free(e);S.kills++;
    const dead=E.filter(x=>x.P.dead),cap=G.Q.level?22:9; // 시신 수 제한 (LOW 는 적게)
    if(dead.length>cap){const o=dead[0];PP.remove(o.P);E.splice(E.indexOf(o),1);}
    if(S.kills>=S.total&&!pl.dead)finish(); // 죽어 있는 동안 아군이 끝내도 승리는 부활 뒤에 (전사 화면을 덮지 않게)
  }
  function damage(e,dmg,part){
    if(e.P.dead)return;
    e.hp-=part==='head'?999:part==='limb'?dmg*.6:dmg;
    if(e.hp<=0)kill(e,part==='head');else{e.P.pose='hit';e.re=max(e.re,.3);}
  }

  /* ── 아군: 엄폐 자리에서 보이는 적을 쏜다 (죽지 않음) ── */
  function ally(a,dt){
    const P=a.P,q=a.post,lp=C.l(pl.p);
    // 플레이어가 가까이 오면 옆 좌석 열 사이(다리 공간)로 비켜 선다
    const yield_=abs(lp[2]-q[1])<1&&abs(lp[0])<.6,rz=11.6-Math.round((11.6-q[1])/.8)*.8+.42,tx=yield_?.62:q[0];
    const tz=yield_?rz:q[1],dx=tx-P.p[0],dz=tz-P.p[2];
    if(abs(dz)>.3&&abs(P.p[0])>.15&&!yield_){P.p[0]+=cl(-P.p[0],-2*dt,2*dt);P.pose='walk';return;}
    if(hypot(dx,dz)>.08){const L=hypot(dx,dz),s=min(L,(L>1?2.4:1.5)*dt);P.p[0]+=dx/L*s;P.p[2]+=dz/L*s;if(L>.3){P.pose=L>1?'run':'walk';P.yaw=atan2(dx,dz);P.aim=null;return;}}
    if((a.t-=dt)<=0){ // 표적 고르기
      a.t=.5;const eye=PP.eye(P);let best=null,bd=45;
      for(const e of E){if(e.P.dead||e.P.vis===false)continue;const c=chest(e.P),d=hypot(...V3.sub(c,eye));if(d<bd&&los(eye,c)){bd=d;best=e;}}
      if(best!==a.tg)a.cd=max(a.cd,.4);a.tg=best;
    }
    const e=a.tg&&!a.tg.P.dead?a.tg:null;
    if(e){
      const c=chest(e.P),l=C.l(c);P.aim=c;P.look=c;P.yaw=atan2(l[0]-P.p[0],l[2]-P.p[2]);
      a.cd-=dt;
      if(a.cd<=0){ // 3발 점사
        const m=PP.muzzle(P),o=[m[0],m[1],m[2]],h=R()<.1,tp=h?c:v3(c,[(R()-.5)*1.2,(R()-.4)*.8,(R()-.5)*1.2]),d=nrm(V3.sub(tp,o));
        G.fx.tracer(o,d,340,0);G.fx.burst('muzzle',o,{size:.025,dir:d});G.addLight(o,[1,.75,.4],2,4,.05);G.sfx.play('r556',{pos:o,gain:.6}); // 아군 K2
        if(h){damage(e,40,'body');G.fx.burst('hit',c,{size:.1});}
        a.bn=(a.bn||0)+1;a.cd=a.bn%3?.12:.9+R()*1.2;P.pose='fire';
      }else if(a.cd>.3)P.pose=q[2]?'crouch':'aim';
    }else{P.aim=null;P.look=null;P.pose=q[2]?'crouch':'stand';P.yaw+=((q[3]||0)-P.yaw)*min(1,dt*3);}
  }

  /* ── 플레이어 ── */
  function adapter(){ // mod_arms 스토리 1 어댑터 (§3.2)
    return {story:1,hits:'enemy',hud:'fps',eye:()=>G.cam.pos,fwd:()=>fwd(pl.yaw,pl.pit),solid,me:()=>pl,
      ground:(x,z,y)=>floorAt(x,z,(y??pl.p[1])+.6)[0],
      collide:(p,r)=>{const q=[p[0],p[1],p[2]];move(q,0,0,r);return q;},
      ray:(o,d,t)=>{for(const x of A)x.P.vis=false;const h=PP.ray(o,d,t);for(const x of A)x.P.vis=true;return h;}, // 아군 오사 없음
      onHit:(P,part,dmg)=>{const e=E.find(x=>x.P===P);if(!e)return 0;damage(e,dmg,part);hud.hm=e.P.dead?2:1;if(e.P.dead){D.pk++;return 2;}return 1;},
      onBlast:(p,r,f)=>{let k=0;for(const e of E){if(e.P.dead)continue;const c=chest(e.P),d=hypot(...V3.sub(c,p));if(d<r&&los(p,c)){damage(e,f(d),'body');e.P.dead&&(k++,D.pk++);}}if(k)hud.hm=2;return k;},
      hurtSelf:(dm,body)=>{ // 로켓 폭발 · 후폭풍: 방탄판 피해 (2.5 m 안: 방탄판 0 + 몸 1발)
        if(safe())return;D.ht++;hud.dd=hud.fl=1;G.sfx.play('hit',{gain:.8});
        if(body){S.plate=0;bodyHit(0);}else if(S.plate>0)S.plate=max(0,S.plate-dm);else bodyHit(0);D.mh=min(D.mh,S.plate);},
      allow:()=>pl.dead||pl.end?OFFA:pl.rp>0?RPA:ONA,busyE:()=>!!hud.pkN||hud.eT===T,people:()=>PP.list.map(wp),
      frame:p=>{const z=floorAt(p[0],p[2],p[1]+.6)[1];return z===1?C.M:z===2?M4.mul(C.M,TR):null;}}; // 기내 바닥 기울기를 따른다
  }
  function drops1(){ // 바닥 총 (§4.3): 기내 2~3 · 바깥 나머지 (모두 7) — 엄폐물 · 엔진 · 아군 자리 · 시작점 · 등장 지점 · 사람(1.2 m) 근처 제외
    const c0=C.w([0,0,0]),hz=C.K.hole[2],inn=[],out=[];
    for(let z=-13.5;z<=13;z+=.9){ // 기내: 통로 가운데 (좌석과 .3 m 이상 · 통로 방향으로 눕힘)
      if(z>-7.5&&z<-5)continue;const x=.05+(R()-.5)*.14;if(abs(z-hz)<1.4)continue; // 폭발 구멍 줄 제외
      const w=z<-6.45?C.w(M4.point(TR,[x,0,z])):C.w([x,0,z]);w[1]=floorAt(w[0],w[2],w[1]+.6)[0];inn.push(w);
    }
    for(let i=0;i<60;i++){const a=R()*2*PI,r=5+R()*17,x=c0[0]+sin(a)*r,z=c0[2]+cos(a)*r;if(!floorAt(x,z,C.ground(x,z)+.6)[1])out.push([x,C.ground(x,z),z]);}
    const eg=C.w([-5.9,-1.6,3]),s=o0.pos||C.w([0,0,2]),away=[[eg[0],0,eg[2],2.4],[s[0],0,s[2],2.5],...posts.map(q=>{const w=C.w([q[0],0,q[1]]);return[w[0],0,w[2],1.2];}),...C.K.spawn.map(p=>[p[0],0,p[2],5]),...PP.list.map(P=>{const w=wp(P);return[w[0],0,w[2],1.2];})];
    const ok=p=>!C.K.cover.some(b=>abs(p[0]-b[0])<b[3]+.6&&abs(p[2]-b[2])<b[5]+.6&&p[1]<b[1]+b[4]+.6)&&abs(C.ground(p[0]+.5,p[2])-C.ground(p[0]-.5,p[2]))<.35&&abs(C.ground(p[0],p[2]+.5)-C.ground(p[0],p[2]-.5))<.35;
    const okIn=p=>!C.K.cover.some(b=>abs(p[0]-b[0])<b[3]+.6&&abs(p[2]-b[2])<b[5]+.6&&p[1]<b[1]+b[4]+.6);
    const o={cnt:{},hs:{n:0,cap:1},away,frame:AR.drops&&adapter().frame},k=2+(R()<.5?1:0);
    const a=AR.drops.scatter(inn,k,DROP1,{...o,ok:okIn,yaw:()=>(R()<.5?0:PI)+(R()-.5)*.35});
    AR.drops.scatter(out,7-a.length,DROP1,{...o,ok});
  }
  const has556=()=>AR.inv.slot.some(k=>k&&AR.W[k].cal==='556'),own=k=>AR.inv.slot.includes(k);
  function offer(e){ // 시신이 다음 E 로 줄 것: 'pl' 방탄판 · 'am' 탄약(+빈 칸이면 AKM) · 'sw' AKM 으로 바꾸기
    const P=AR.inv.pool,C2=AR.CAP;
    if(e.pl&&S.spare<3)return'pl';
    if(e.ammo>0&&((P['762r']|0)<C2['762r']||has556()&&(P['556']|0)<C2['556']||own('k7')&&(P['9']|0)<C2['9']||e.gun&&!own('akm')&&AR.canTake('akm')==='free'))return'am';
    if(e.gun&&!own('akm')&&AR.canTake('akm')==='swap')return'sw';
    return'';
  }
  function pickups(use){ // 쓰러진 적의 방탄판 · 탄창 · AKM — E 로만 (밟아서 줍지 않음)
    let near=null,nd=2.4;
    for(const e of E)if(e.P.dead&&T-e.td>.6&&offer(e)){const d=hypot(e.P.p[0]-pl.p[0],e.P.p[2]-pl.p[2]);if(d<nd&&abs(e.P.p[1]-pl.p[1])<1.3){nd=d;near=e;}}
    if(near)near.of=offer(near);
    if(near&&use&&!pl.dead){ // 이 E 는 시신이 씀 → 같은 프레임 바닥 총 줍기 없음 (busyE · 한 번 누름 = 한 가지)
      const of=near.of;hud.eT=T;
      if(of==='pl'||of==='am'){
        const pt=near.pl&&S.spare<3;let tk=0;if(pt){S.spare++;near.pl=0;}
        if(near.ammo>0&&(!pt||offer(near)==='am')){ // 탄약: 7.62×39 · 5.56 총이 있으면 +30 · K7 이 있으면 +15 · 주무기 칸이 비었으면 AKM 째로
          AR.addPool('762r',near.ammo);has556()&&AR.addPool('556',30);own('k7')&&AR.addPool('9',15);near.ammo=0;
          if(near.gun&&!own('akm')&&AR.canTake('akm')==='free'){AR.take('akm',30,0);tk=1;near.gun=0;near.P.gun=0;hud.msg=[AR.st.msg,T+2.5];}
        }
        tk||G.sfx.play('pick');hud.pk=1.2;hud.pkT=pt?'방탄판 +1':'탄창 획득!'; // AKM 을 가져가면 take() 가 소리를 냄
      }else if(of==='sw'){AR.take('akm',30,0);near.gun=0;near.P.gun=0;hud.pk=1.2;hud.pkT='';}
      return null;
    }
    return near;
  }

  function botThink(dt){ // 테스트용 자동 플레이어 (빈 총이면 봇만 다른 총으로 바꿈)
    const b=pl.bot||(pl.bot={t:0,tg:null,idle:0,sh:0}),eye=G.cam.pos,I=AR.inp,id=AR.cur,w=AR.W[id]||{},iv=AR.inv;
    Object.assign(inp,{f:0,s:0,run:0,cr:0,use:0,pf:S.plate<=10&&S.spare>0});
    Object.assign(I,{fire:0,ads:0,rl:0,use:0,mode:0,scope:w.sc===1&&!iv.scope[id]?1:0,slot:0,wh:0,breath:0});
    if(pl.dead){T-pl.dead>2&&revive();return;}
    if((b.t-=dt)<=0){
      b.t=.25;let best=null,bd=60;
      for(const e of E){if(e.P.dead)continue;const c=chest(e.P),d=hypot(...V3.sub(c,eye));if(d<bd&&los(eye,c)){bd=d;best=e;}}
      b.tg=best;b.td=bd;
    }
    const left=k=>k&&(iv.mag[k]|0)+(iv.pool[AR.W[k].cal]|0)>0;
    if(!left(id)){const s=iv.slot.findIndex(left);s>=0&&(I.slot=s+1);}
    else if(id==='rpg7'&&b.tg&&b.td<9&&!AR.rocket){const s=iv.slot.findIndex((k,i)=>i<3&&left(k));s>=0&&(I.slot=s+1);} // 가까운 적에게는 로켓을 쏘지 않는다
    else if(id!=='rpg7'&&iv.slot[3]==='rpg7'&&left('rpg7')&&b.tg&&b.td>14&&AR.st.sw<=0&&AR.st.rl<=0)I.slot=4; // 먼 적에게는 다시 로켓
    const m=AR.mag;
    if(b.tg&&!b.tg.P.dead){
      b.idle=0;const c=chest(b.tg.P),d=V3.sub(c,eye),ty=atan2(d[0],d[2]),tp=atan2(d[1],hypot(d[0],d[2]));
      let dy=ty-pl.yaw;dy-=Math.round(dy/(2*PI))*2*PI;
      pl.yaw+=cl(dy,-5*dt,5*dt);pl.pit+=cl(tp-pl.pit,-4*dt,4*dt);
      I.ads=1;inp.cr=hypot(...d)>8&&id!=='m134'?1:0;
      const err=abs(dy)+abs(tp-pl.pit),md=w.md&&w.md[iv.mode[id]|0];
      if(err<.05+AR.spread()&&(m>0||id==='m134')&&!(id==='rpg7'&&b.td<9)){b.sh-=dt;if(md==='auto'||md==='spin'||b.sh<=0){I.fire=1;b.sh=.22;}}
      if(m===0&&id!=='rpg7'||id==='rpg7'&&m===0&&!AR.rocket)I.rl=1;
    }else{
      b.idle+=dt;if(m<(w.mag||30)*.5)I.rl=1;
      const lp=C.l(pl.p);let goal=null,pd=9;
      for(const e of E)if(e.P.dead&&(e.ammo>0&&(iv.pool['762r']|0)<90||e.pl&&S.spare<3)&&abs(e.P.p[1]-pl.p[1])<1){const d=hypot(e.P.p[0]-pl.p[0],e.P.p[2]-pl.p[2]);if(d<pd){pd=d;goal=e.P.p;inp.use=1;}}
      if(!goal&&b.idle>2.5){ // 가장 가까운 적 쪽으로 통로를 따라 이동
        let ne=null,nd=1e9;for(const e of E)if(!e.P.dead){const d=hypot(e.P.p[0]-pl.p[0],e.P.p[2]-pl.p[2]);if(d<nd){nd=d;ne=e;}}
        if(ne){const l=C.l(ne.P.p);goal=C.w([abs(lp[0])>.4?0:cl(l[0],-.1,.1),0,cl(l[2],-5,13)]);if(abs(goal[2]-pl.p[2])+abs(goal[0]-pl.p[0])<.5)goal=null;}
      }
      if(goal){const d=[goal[0]-pl.p[0],goal[2]-pl.p[2]];pl.yaw+=cl(atan2(d[0],d[1])-pl.yaw,-3*dt,3*dt);pl.pit*=.9;inp.f=1;}
    }
    if(pl.bn>.1)inp.f=-1; // 불에서 물러난다
  }

  function player(dt){
    const K=G.keys,V=AR.view,tap=c=>{const v=K[c]&&!kp[c];kp[c]=K[c];return v;},tF=tap('KeyF'),tN=tap('Enter');
    if(F.bot)AR.bot=true,botThink(dt); // 봇은 G.arms.inp 를 직접 채운다 (테스트는 G.arms.bot 만 켜서 입력을 줄 수 있음)
    else Object.assign(inp,{f:(K.KeyW?1:0)-(K.KeyS?1:0),s:(K.KeyD?1:0)-(K.KeyA?1:0),run:K.ShiftLeft||K.ShiftRight?1:0,cr:K.KeyC||K.ControlLeft?1:0,use:K.KeyE,pf:tF});
    if(pl.dead&&tN&&!F.bot)revive();
    // 시점 (배율만큼 감도 ↓)
    const ms=.0022*V.sens,sk=.0015*(1-V.ovA*.7);
    pl.yaw-=mouse.dx*ms;pl.pit=cl(pl.pit-mouse.dy*ms,-1.35,1.35);pl.sw=[cl(pl.sw[0]*.85-mouse.dx*sk,-.12,.12),cl(pl.sw[1]*.85+mouse.dy*sk,-.12,.12)];mouse.dx=mouse.dy=0;
    // 이동 (총마다 속도 배율 · M134 는 달리기 없음 · 조준 중 Shift 는 숨 참기)
    pl.cr+=((inp.cr?1:0)-pl.cr)*min(1,dt*10);
    const run=inp.run&&inp.f>0&&!AR.inp.ads&&!V.nosprint,spd=(run?5.6:3.1*(1-pl.cr*.5)*(1-V.ads*.35))*V.mv,fx=sin(pl.yaw),fz=cos(pl.yaw);
    pl.run=run?1:0;pl.air=pl.vy?1:0;
    const mx=fx*inp.f-fz*inp.s,mz=fz*inp.f+fx*inp.s; // +X 가 왼쪽: 오른쪽(D) = (-cos, sin)
    const ml=hypot(mx,mz),ox=pl.p[0],oz=pl.p[2];
    if(ml>0&&!pl.dead)move(pl.p,mx/ml*spd*dt,mz/ml*spd*dt,.22);
    for(const a of A){const w=wp(a.P),d=hypot(pl.p[0]-w[0],pl.p[2]-w[2]);if(d<.35&&d>1e-4)move(pl.p,(pl.p[0]-w[0])/d*(.35-d),(pl.p[2]-w[2])/d*(.35-d),.22);} // 아군과 겹치지 않게 (아군이 비켜 줌)
    pl.mv=hypot(pl.p[0]-ox,pl.p[2]-oz)/dt;
    const fz2=floorAt(pl.p[0],pl.p[2],pl.p[1]+.9);pl.ins=fz2[1];
    if(fz2[0]>pl.p[1]){pl.p[1]=min(fz2[0],pl.p[1]+max(.05,(fz2[0]-pl.p[1]))*min(1,dt*9));pl.vy=0;} // 문턱·구멍으로 올라서기
    else{pl.vy-=9.8*dt;pl.p[1]=max(fz2[0],pl.p[1]+pl.vy*dt);if(pl.p[1]<=fz2[0])pl.vy=0;}
    pl.bob+=pl.mv*dt*(run?1.5:1.9);pl.bobA+=((pl.mv>.3?min(1,pl.mv/4):0)-pl.bobA)*min(1,dt*8);
    // 시신 줍기 (E 우선순위: 방탄판 > 시신 > 바닥 총) → 무기 (mod_arms)
    const pk=pickups(inp.use&&!pl.use0);pl.use0=inp.use;hud.pkN=pk;
    AR.step(dt);pl.ads=V.ads;
    // 방탄판: 재생 없음 · F 교체 2초 (사격 불가)
    if(inp.pf&&pl.rp<=0&&!pl.dead&&S.spare>0&&S.plate<100){pl.rp=2;AR.cancel();G.sfx.play('splash',{gain:.4,rate:2});}
    if(pl.rp>0&&(pl.rp-=dt)<=0){pl.rp=0;S.plate=100;S.spare--;S.body=0;G.sfx.play('click',{gain:1.4});}
    // 불: 1.25 m 안 → 방탄판 15/초, 방탄판 0 이면 1.2초마다 몸 피격
    const bz=!pl.dead&&inF()?1:0;
    pl.bn+=(bz-pl.bn)*min(1,dt*6);
    if(bz&&!safe()){
      if(S.plate>0){S.plate=max(0,S.plate-15*dt);D.mh=min(D.mh,S.plate);}else if((pl.bt+=dt)>1.2){pl.bt=0;bodyHit(0);}
      if((pl.bs=(pl.bs||0)-dt)<=0){pl.bs=.5;G.sfx.play('hit',{gain:.4,rate:.45});}
    }
    S.hp=S.plate;S.scope=V.scope;S.mag=AR.mag;S.ammo=AR.pool;
    // 카메라
    const dk=pl.dead?min(1,(T-pl.dead)/1.1):0,eh=1.62-.62*pl.cr-1.1*dk*dk,b=pl.bobA*(1-pl.ads*.8);
    const eye=[pl.p[0]+cos(pl.yaw)*sin(pl.bob)*.025*b,pl.p[1]+eh+abs(cos(pl.bob))*.045*b,pl.p[2]-sin(pl.yaw)*sin(pl.bob)*.025*b];
    const f=fwd(pl.yaw+dk*.5,(pl.pit+V.kick)*(1-dk)+dk*.25);
    G.cam.pos=eye;G.cam.target=v3(eye,f);G.cam.up=dk?nrm([cos(pl.yaw)*dk*.9,1,-sin(pl.yaw)*dk*.9]):[0,1,0];G.cam.near=.08;
    G.cam.fov=(1.13+(run?.06:0))*V.fovK;
    const fp=PP.fp; // 광학 조준경으로 볼 때는 1인칭 모델을 숨긴다 (총 · 조준 · 반동 · 장전은 mod_arms 가 쓴다)
    Object.assign(fp,{on:pl.dead||V.hide?0:1,bob:pl.bob,sway:pl.sw});if(pl.rp>0)fp.reload=1-pl.rp/2;
    // 노출 시간: 적에게 보일수록 명중률 상승
    let seen=0;for(const e of E)if(e.st==='hold'&&e.tg&&e.tg.pl)seen=1;
    pl.ex=seen?min(5,pl.ex+dt*(AR.quiet?.5:1)):max(0,pl.ex-dt*2);
  }

  /* ── 조명 · 환경 ── */
  function env(dt){
    const ins=pl.ins?1:0;
    pl.envK=(pl.envK??ins)+(ins-(pl.envK??ins))*min(1,dt*3);
    G.setEnv({indoor:pl.envK,exposure:1-pl.envK*.38});
    G.shadowFocus=G.cam.pos;G.shadowRange=ins?26:70;
    if(ins){ // 비상등: 카메라 앞뒤 천장 (주로 인물을 비춤)
      const l=C.l(G.cam.pos),fl=.55+.45*(sin(T*19)>-.85);
      G.addLight(C.w([0,1.95,l[2]+2.2]),[1,.9,.76],5*fl,6,.05);
      G.addLight(C.w([0,1.95,l[2]-2.6]),[1,.9,.76],4*fl,6,.05);
    }
    G.sfx.listener(G.cam.pos,fwd(pl.yaw,pl.pit));
  }

  /* ── HUD (텍스트는 5Hz, 조준선·피격 표시는 매 프레임 스타일 한두 개만) ── */
  function hudUp(dt){
    hud.hm=max(0,hud.hm-dt*4);hud.dd=max(0,hud.dd-dt*.9);hud.pk=max(0,(hud.pk||0)-dt);hud.fl=max(0,(hud.fl||0)-dt*2.5);
    const px=AR.spread()/(G.cam.fov/2)*innerHeight/2+4,sp=Math.round(px*2)/2;
    if(sp!==hud.sp){hud.sp=sp;ui.xh.style.setProperty('--s',sp+'px');}
    ui.xh.style.opacity=pl.ads>.6||pl.dead?0:1;
    ui.hm.style.opacity=min(1,hud.hm);ui.hm.style.transform=`rotate(45deg) scale(${hud.hm>1?1.5:1})`;
    ui.dd.style.opacity=hud.dd;ui.dd.style.transform=`rotate(${(pl.yaw-hud.dA)*180/PI}deg)`;
    let pm=null,pd=15;for(const e of E)if(e.pl&&e.P.dead){const d=hypot(e.P.p[0]-pl.p[0],e.P.p[2]-pl.p[2]);if(d<pd){pd=d;pm=e.P.p;}} // 근처 방탄판
    const q=pm&&S.spare<3&&!pl.dead&&G.project(v3(pm,[0,.5,0]));ui.pm.style.display=q&&q[2]>0?'block':'none';q&&(ui.pm.style.transform=`translate(${q[0]|0}px,${q[1]|0}px)`);
    ui.bv.style.opacity=pl.bn*(.8+.2*sin(T*23));ui.vg.style.opacity=max(hud.fl,S.plate>0||pl.dead?0:.5);
    if((hud.t-=dt)>0)return;hud.t=.2;
    ui.am.innerHTML=AR.hud(); // 장전 / 예비 · 이름 · 모드 · 스코프 · 4칸 (mod_arms)
    const lo=S.plate<=10,z=S.plate<=0; // 방탄판 HUD
    ui.hp.className=z?'z':lo?'a':'';
    ui.hp.innerHTML=`<i style="width:${S.plate}%"></i><b>${S.plate+.99|0}</b><u>${'<s></s>'.repeat(S.spare)}${'<s class=e></s>'.repeat(3-S.spare)}</u>${z?`<em>무방비 · 피격 ${S.body}/2</em>`:'<small>방탄판</small>'}`;
    ui.ct.innerHTML=`북한군 <b>${S.kills}</b> / ${S.total}<small>북한군을 제압하라</small>`;
    const pa=pl.dead?'':pl.rp>0?'방탄판 교체 중…':lo?(z?'무방비 — ':'')+(S.spare?'방탄판 교체 [F]':'예비 방탄판 없음'):'';
    ui.pa.textContent=pa;ui.pa.style.display=pa?'block':'none';ui.pa.className=pl.rp>0?'r':S.spare?'':'n';
    pl.dead&&card();ui.fd.style.display=pl.dead&&T-pl.dead>1?'grid':'none';
    const ms=hud.msg&&T<hud.msg[1]?hud.msg[0]:'',np=hud.pkN&&hud.pkN.pl&&S.spare<3;
    const n=hud.pkN,cp=n?(np?'[E] 방탄판 줍기':n.of==='sw'?'[E] AKM 소총(으)로 바꾸기':n.gun&&!own('akm')&&AR.canTake('akm')==='free'?'[E] AKM 소총·탄창 줍기':'[E] 탄창 줍기'):''; // 다음 E 가 할 일
    const pr=pl.dead?'':ms||cp||(hud.pk>0&&hud.pkT)||AR.prompt;
    ui.pr.textContent=pr;
    ui.lk.style.display=F.bot||pl.end||pl.dead||document.pointerLockElement===G.canvas||G.params.has('step')?'none':'block';
  }

  function update(dt){
    if(!F.on)return;
    if(pl.rt){pl.rt=0;try{o0.onRetry?o0.onRetry():start({...o0,cp:1});}catch(e){G.err('fps retry: '+(e.stack||e));}return;}
    try{
      T+=dt;fires=fires.filter(f=>f[3]>G.time);
      if(!pl.end||T<pl.end){
        player(dt);director(dt);
        for(const e of E)enemy(e,dt);
        for(let i=0;i<E.length;i++)for(let j=i+1;j<E.length;j++){ // 서로 겹치지 않게
          const a=E[i].P,b=E[j].P;if(a.dead||b.dead)continue;
          const dx=a.p[0]-b.p[0],dz=a.p[2]-b.p[2],d=hypot(dx,dz);
          if(d<.55&&d>1e-4){const k=(.55-d)/d*.5;if(E[i].st==='go'){a.p[0]+=dx*k;a.p[2]+=dz*k;}if(E[j].st==='go'){b.p[0]-=dx*k;b.p[2]-=dz*k;}}
        }
        for(const a of A)ally(a,dt);
      }else if(pl.end&&!pl.ended){pl.ended=1;const cb=o0.onEnd;cb?(cb(true),F.on&&stop()):0;return;}
      if(pl.end){player(0.0001);}
      env(dt);hudUp(dt);
    }catch(e){G.err('fps: '+(e.stack||e));}
  }

  G.register('fps',{
    init(){
      G.css(`#fh{position:absolute;inset:0;display:none;color:#fff;font-family:system-ui,'Malgun Gothic',sans-serif;text-shadow:0 1px 3px #000c}
#xh{position:absolute;left:50%;top:50%;--s:6px;transition:opacity .1s}#xh i{position:absolute;background:#fffd;box-shadow:0 0 2px #000}
#xh i:nth-child(1),#xh i:nth-child(2){width:2px;height:7px;left:-1px}#xh i:nth-child(1){top:calc(-7px - var(--s))}#xh i:nth-child(2){top:var(--s)}
#xh i:nth-child(3),#xh i:nth-child(4){height:2px;width:7px;top:-1px}#xh i:nth-child(3){left:calc(-7px - var(--s))}#xh i:nth-child(4){left:var(--s)}
#hm{position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px;border:2px solid #fff;border-width:0 2px;transform:rotate(45deg) scaleY(1);opacity:0;clip-path:polygon(0 0,35% 0,35% 100%,0 100%,0 0,100% 0,100% 100%,65% 100%,65% 0)}
#am{position:absolute;right:4vw;bottom:5vh;text-align:right;font-size:22px;color:#cde}#am b{font-size:46px;color:#fff;font-weight:700}#am small{display:block;font-size:14px;letter-spacing:.15em;color:#bcd;text-shadow:0 0 2px #000,0 1px 3px #000}
#hp{position:absolute;left:4vw;bottom:6vh;width:150px;height:8px;background:#0008;border-radius:4px;box-shadow:0 0 0 1px #fff4}#hp i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#aab3bb,#fff);border-radius:4px}#hp b{position:absolute;bottom:12px;left:0;font-size:30px}
#hp small{position:absolute;top:13px;left:0;font-size:12px;letter-spacing:.3em;color:#ccd}#hp u{position:absolute;bottom:14px;right:0;display:flex;gap:5px}#hp s{width:12px;height:16px;border:2px solid #fff;border-radius:2px 2px 6px 6px;background:#fffc}#hp s.e{background:0;opacity:.3}
#hp.a i{background:#fb3}#hp.a b{color:#fb3}#hp.z{box-shadow:0 0 0 2px #fff;animation:pu .5s infinite alternate}#hp em{position:absolute;top:13px;left:0;white-space:nowrap;font:700 15px system-ui;letter-spacing:.1em}
#pa{position:absolute;left:50%;top:30%;transform:translateX(-50%);padding:.3em 1em;border:2px solid #fb3;border-radius:6px;background:#000a;color:#fb3;font:700 24px system-ui;letter-spacing:.12em;display:none;animation:pu .45s infinite alternate}#pa.n{border-color:#fff;color:#fff}#pa.r{animation:none;border-color:#fff8;color:#fff}@keyframes pu{to{opacity:.55}}
#pm{position:absolute;left:-30px;top:-34px;width:60px;text-align:center;font:700 12px system-ui;display:none;text-shadow:0 0 2px #000,0 1px 3px #000}#pm:after{content:'▼';display:block;font-size:14px}
#bv{position:absolute;inset:0;opacity:0;background:radial-gradient(#ff600000 35%,#ff6a0040 70%,#ff3c00b0);box-shadow:inset 0 0 20vmin 5vmin #ff5a00b0}
#fd{position:absolute;inset:0;display:none;place-content:center;justify-items:center;background:radial-gradient(#0006,#000d);pointer-events:auto}#fd b{font-size:clamp(44px,8vw,100px);letter-spacing:.4em;margin-right:-.4em}#fd small{font-size:16px;color:#bbb}#fd small.n{margin-top:1.1em;color:#fc6}#fd button.t{font-size:15px;padding:.4em 1.6em;margin-top:1.6em;background:#0000;color:#ddd;border:1px solid #fff6;box-shadow:none}#fd button{margin:1.2em 0 .6em;padding:.35em 2.4em;font:800 clamp(24px,3.4vw,44px) system-ui;letter-spacing:.5em;color:#111;background:#fff;border:0;border-radius:8px;cursor:pointer;box-shadow:0 0 40px #fff6}
#ct{position:absolute;left:50%;top:3.5vh;transform:translateX(-50%);text-align:center;font-size:19px;letter-spacing:.06em}#ct b{font-size:26px;color:#fc6}#ct small{display:block;font-size:14px;color:#bcd;letter-spacing:.2em}
#pr{position:absolute;left:50%;top:62%;transform:translateX(-50%);font-size:18px;color:#fe9;text-shadow:0 0 2px #000,0 0 2px #000,0 1px 3px #000}
#dd{position:absolute;inset:0;background:radial-gradient(ellipse 34% 22% at 50% 0,#fffa,#fff0);opacity:0}
#vg{position:absolute;inset:0;box-shadow:inset 0 0 18vmin 4vmin #fffa;opacity:0}
#lk{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);padding:.6em 1.4em;background:#000a;border-radius:8px;font-size:17px;text-align:center}#lk small{display:block;color:#abc;font-size:13px;margin-top:.3em}
#fe{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);text-align:center;opacity:0;transition:opacity 1.2s}#fe b{display:block;font-size:clamp(28px,4.5vw,56px);color:#fd7;letter-spacing:.12em}#fe small{font-size:18px;color:#ddd}`);
      ui.fh=G.el('div',{id:'fh'});
      ui.xh=G.el('div',{id:'xh',innerHTML:'<i></i><i></i><i></i><i></i>'},ui.fh);
      for(const k of['bv','pm','hm','am','hp','ct','pr','pa','dd','vg','lk','fe','fd'])ui[k]=G.el('div',{id:k},ui.fh);
      ui.pm.textContent='방탄판';ui.fd.innerHTML='<b>전사</b><small>김민철 하사가 쓰러졌다</small><small class=n></small><button>부활</button><small>Enter</small><button class=t>처음 화면</button>';
      ui.fdB=ui.fd.querySelector('button');ui.fdN=ui.fd.querySelector('.n');
      ui.fdB.onclick=()=>{revive();G.canvas.requestPointerLock&&G.canvas.requestPointerLock();};
      ui.fd.querySelector('.t').onclick=()=>{ui.fd.style.display='none';G.story&&G.story.title&&G.story.title();}; // 처음 화면으로
      if(G.fx){ // 불 위치 수집: trail('fire') 0.3초 · burst('explosion') 1.5초
        const fx=G.fx,tr=fx.trail,bu=fx.burst,rec=(p,t)=>{if(!F.on||!p)return;for(const f of fires)if(hypot(f[0]-p[0],f[1]-p[1],f[2]-p[2])<.4)return f[3]=G.time+t;fires.push([p[0],p[1],p[2],G.time+t]);};
        fx.trail=function(p,v,k){k==='fire'&&rec(p,.3);return tr.apply(this,arguments);};
        fx.burst=function(k,p){k==='explosion'&&rec(p,1.5);return bu.apply(this,arguments);};
      }
      ui.lk.innerHTML='화면을 클릭하면 조준이 시작됩니다<small>WASD 이동 · Shift 달리기 · C 앉기 · 좌클릭 사격 · 우클릭 조준 · R 재장전 · E 줍기 · F 방탄판 교체 · T 스코프 · B 사격 모드 · 1–4 무기 · 휠 무기 교체</small>';
      G.canvas.addEventListener('click',()=>{F.on&&!F.bot&&G.canvas.requestPointerLock&&G.canvas.requestPointerLock();});
      addEventListener('mousemove',e=>{if(F.on&&document.pointerLockElement===G.canvas){mouse.dx+=e.movementX;mouse.dy+=e.movementY;}});
      addEventListener('contextmenu',e=>F.on&&e.preventDefault());
    },
    update
  },'story');
  G.mode==='story'&&G.order.unshift(G.order.pop()); // story 다음, people·cabin 보다 먼저 update
}
