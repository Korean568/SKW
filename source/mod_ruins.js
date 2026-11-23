'use strict';
/* RUINS — 스토리 4 폐허가 된 서강 (회색 새벽, 전투 직후) + 북한군 Mi-8 급 수송 헬기. 월드 공간 m, 분대 엄폐 = 원점, +Z = 대로 앞쪽 */
{
 const RU=G.ruins={ on: false,K: null,S: { heli: 0,rotor: 1,door: 0 } },S=RU.S;
 const { sin,cos,abs,hypot,PI,min,max,atan2,sqrt,floor,exp,sign }=Math,L=G.lerp,cl=G.clamp,sm=(a,b,x)=>{ x=cl((x-a)/(b-a),0,1); return x*x*(3-2*x); };
 const rnd=G.rng(41);
 // 지면: 차도 0, 보도 +0.15 (|x|>13)
 const terr=(x,z)=>.15*sm(12.92,13.08,abs(x));
 const LZ=[0,0,26],HY=PI/2;// 착륙 지점 · 착륙 방향 (기수 +X, 왼쪽 문이 분대를 봄)
 RU.K={
  start: [.7,0,-.45,0],
  squad: [[-1.5,0,-.3,.06],[2.6,0,-.4,-.08],[-3.6,0,.05,.12],[4.5,0,-.1,-.12],[-5.7,0,-.5,.18]],
  lz: LZ.slice(),meet: [.6,0,5.4],
  crew: [[2.2,0,22.4,PI],[6.6,0,22.7,PI+.15],[-.4,0,22.9,PI-.2],[8.4,0,23.5,PI+.3]]
 };
 RU.ground=(x,z)=>terr(x,z);
  /* 충돌: 회전 상자 [cx,cz,yaw,hx,hz,h] · 원 [x,z,r] */
 const RECT=[],ROUND=[];
 const pushBox=(p,r,b)=>{
  const cx=cl(p[0],b[0],b[1]),cz=cl(p[1],b[2],b[3]),dx=p[0]-cx,dz=p[1]-cz,d=hypot(dx,dz);
  if (d>=r) return;
  if (d>1e-6) { p[0]=cx+dx/d*r; p[1]=cz+dz/d*r; }
  else { const a=[p[0]-b[0],b[1]-p[0],p[1]-b[2],b[3]-p[1]],k=a.indexOf(min(...a)); p[k>>1]+=(k&1?1:-1)*(a[k]+r); }
 };
 const HB={ on: 0,x: 0,z: 0,yaw: 0 };// 착륙한 헬기 동체 상자
 const rects=()=>HB.on?[...RECT,[HB.x+sin(HB.yaw)*1.7,HB.z+cos(HB.yaw)*1.7,HB.yaw,2.1,7,3.1,.3]]:RECT;
 RU.collide=(p,r=.3)=>{
  let x=p[0],z=p[2];
  for (const b of rects()) {
   const c=cos(b[2]),s=sin(b[2]),dx=x-b[0],dz=z-b[1],q=[dx*c-dz*s,dx*s+dz*c];
   if (abs(q[0])>b[3]+r+1||abs(q[1])>b[4]+r+1) continue;
   pushBox(q,r,[-b[3],b[3],-b[4],b[4]]); x=b[0]+q[0]*c+q[1]*s; z=b[1]-q[0]*s+q[1]*c;
  }
  for (const o of ROUND) { const dx=x-o[0],dz=z-o[1],d=hypot(dx,dz),m=o[2]+r; if (d<m&&d>1e-6) { x=o[0]+dx/d*m; z=o[1]+dz/d*m; } }
  return [x,terr(x,z),z];
 };
 const slab=(o,d,b,t)=>{ // 광선-상자 [x0,x1,y0,y1,z0,z1]
  let s0=0,s1=t;
  for (let i=0; i<3&&s0<=s1; i++) { const v=1/(d[i]||1e-9),e=(b[i*2]-o[i])*v,f=(b[i*2+1]-o[i])*v; s0=max(s0,min(e,f)); s1=min(s1,max(e,f)); }
  return s0<=s1&&s0>1e-4?s0:t;
 };
 RU.ray=(o,d,mx=200)=>{
  let t=mx;
  for (const b of rects()) {
   const c=cos(b[2]),s=sin(b[2]),dx=o[0]-b[0],dz=o[2]-b[1];
   t=min(t,slab([dx*c-dz*s,o[1],dx*s+dz*c],[d[0]*c-d[2]*s,d[1],d[0]*s+d[2]*c],[-b[3],b[3],b.length>6?b[6]:0,b[5],-b[4],b[4]],t));
  }
  for (const c of ROUND) { // 원기둥 (높이 2)
   const ox=o[0]-c[0],oz=o[2]-c[1],a=d[0]*d[0]+d[2]*d[2],bb=ox*d[0]+oz*d[2],cc=ox*ox+oz*oz-c[2]*c[2],D=bb*bb-a*cc;
   if (a>1e-9&&D>0) { const s=(-bb-sqrt(D))/a; if (s>1e-4&&s<t&&o[1]+d[1]*s<c[3]) t=s; }
  }
  if (d[1]<-1e-6) { let s=(o[1]-terr(o[0],o[2]))/-d[1]; s=(o[1]-terr(o[0]+d[0]*s,o[2]+d[2]*s))/-d[1]; if (s>0) t=min(t,s); }
  return t;
 };
  /* 형상 도구: 정점 10 float (위치·법선·색·재질) / 인스턴스 20 float (행렬·부분·난수·플래그·w) */
 let V=[],X=[],IN=[]; const B=[];
 const surf=(nu,nv,f,c,m,fl)=>{
  const b=V.length/10,e=.002,g=t=>cl(t,.004,.996);
  for (let j=0; j<=nv; j++) for (let i=0; i<=nu; i++) {
   const u=i/nu,v=j/nv,p=f(u,v),n=V3.norm(V3.cross(V3.sub(f(g(u)+e,g(v)),f(g(u)-e,g(v))),V3.sub(f(g(u),g(v)+e),f(g(u),g(v)-e))));
   V.push(...p,...(fl?V3.mul(n,-1):n),...(c.call?c(p,u,v):c),m);
   if (i<nu&&j<nv) { const q=b+j*(nu+1)+i,r=q+nu+1; X.push(q,r,q+1,q+1,r,r+1); }
  }
 };
 const sp=(t,e)=>sign(t)*abs(t)**(2/e);
 const pill=(c,h,e,col,m,w,nu=12,nv=8)=>surf(nu,nv,(u,v)=>{
  const a=u*2*PI,b=(v-.5)*PI,k=sp(cos(b),e),p=[c[0]+h[0]*k*sp(cos(a),e),c[1]+h[1]*sp(sin(b),e),c[2]+h[2]*k*sp(sin(a),e)];
  return w?w(p):p;
 },col,m,1);
 const blk=(x0,x1,y0,y1,z0,z1,col,m,w,e=10,nu=12,nv=8)=>pill([(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],[(x1-x0)/2,(y1-y0)/2,(z1-z0)/2],e,col,m,w,nu,nv);
 // 로프트: 축 Z, 단면 sec(v) → [반폭, 아래 y, 위 y, 지수, z, 중심 x]
 const loft=(nu,nv,sec,col,m,w)=>surf(nu,nv,(u,v)=>{
  const [hw,y0,y1,e,z,cx=0]=sec(v),a=u*2*PI;
  const p=[cx+hw*sp(cos(a),e),(y0+y1)/2+(y1-y0)/2*sp(sin(a),e),z]; return w?w(p):p;
 },col,m);
 const lathe=(c,prof,col,m,nu=14,nv=6,w)=>surf(nu,nv,(u,v)=>{ const [r,y]=prof(v),a=u*2*PI,p=[c[0]+r*cos(a),c[1]+y,c[2]+r*sin(a)]; return w?w(p):p; },col,m,1);
 const tube=(f,r,c,m,n=6,nv=5)=>surf(n,nv,(u,v)=>{ const t=V3.norm(V3.sub(f(v+.01),f(v-.01))),a=V3.norm(V3.cross(t,abs(t[1])>.9?[1,0,0]:[0,1,0])),b=V3.cross(t,a),k=u*2*PI,rr=r.call?r(v):r; return V3.add(f(v),V3.add(V3.mul(a,rr*cos(k)),V3.mul(b,rr*sin(k)))); },c,m);
 // 축이 X 인 바퀴/원판 (중심 c, 반지름 r, 폭 w)
 const wheel=(c,r,w,col,m,nu=16)=>surf(nu,8,(u,v)=>{ const a=u*2*PI,b=v*2*PI,R=r-w*.5; return [c[0]+w*.5*sin(b),c[1]+(R+w*.5*cos(b)*(cos(b)>0?1:.4))*cos(a),c[2]+(R+w*.5*cos(b)*(cos(b)>0?1:.4))*sin(a)]; },col,m);
 const trsS=(p,yaw,sx,sy,sz,pitch=0,roll=0)=>{ const m=M4.trs(p,yaw,pitch,roll,1); for (let i=0; i<3; i++) { m[i]*=sx; m[4+i]*=sy; m[8+i]*=sz; } return m; };
 const ins=(p,yaw=0,part=0,w=0,s=1,pitch=0,roll=0)=>[...M4.trs(p,yaw,pitch,roll,s),part,rnd(),0,w];
 const insM=(m,part=0,w=0)=>[...m,part,rnd(),0,w];
 // fl: 1 그림자 · 2 헬기(동적 인스턴스) · 4 LOW 생략 · 8 LOW 절반
 const bat=(fn,I,fl=1)=>{ const i0=X.length; fn(); const b={ i0,n: X.length-i0,f: IN.length/20,c: I.length,fl }; if (!(fl&2)) for (const q of I) IN.push(...q); B.push(b); return b; };
 const noi=(p,k,s)=>sin(p[0]*k*1.3+s)*sin(p[1]*k*1.7+s*2.1)*sin(p[2]*k*1.1+s*.7)+.5*sin(p[0]*k*2.9+p[2]*k*2.3+s*3.3);
 const rough=(a,k,s)=>p=>{ const n=noi(p,k,s); return [p[0]+a*n,p[1]+a*noi(p,k,s+5),p[2]+a*noi(p,k,s+9)]; };
 // 색
 const CR=[.7,.67,.6],SL=[.55,.54,.51],INN=[.42,.4,.37],RB=[.2,.11,.06],DK=[.05,.05,.05],OD=[.25,.27,.16];
 /* ── 건물: 정면 x=±20, 칸(BW×SH) 인스턴스. s=+1 → 정면이 −X 를 보고 칸이 +Z 로 진행 ── */
 const BW=3.4,SH=2.9,DEP=6.6,WT=.24,FY=.15;
 const BLD=[
  { s: 1,z: -64,n: 8,f: 9,dm: .25 },{ s: 1,z: -30,n: 8,f: 8,dm: .35,cf: [8,8,8,8,8,6,4,3] },
  { s: 1,z: 3,n: 9,f: 12,dm: .4,cf: [12,12,12,11,10,7,5,3,2] },{ s: 1,z: 40,n: 7,f: 4,dm: .55,cf: [4,4,3,2,4,4,3] },{ s: 1,z: 64.5,n: 3,f: 6,dm: .3 },
  { s: -1,z: -66,n: 9,f: 10,dm: .25 },{ s: -1,z: -30,n: 11,f: 10,dm: .3,cf: [9,10,10,10,10,10,10,10,10,9,8] },
  { s: -1,z: 13,n: 5,f: 6,dm: .8,cf: [3,2,1,1,2] },{ s: -1,z: 36,n: 8,f: 14,dm: .3,cf: [14,14,13,12,14,14,11,9] },{ s: -1,z: 64.5,n: 3,f: 5,dm: .4 }
 ];
 const SIGN=['행복슈퍼마켓','서강약국','미소분식','한빛부동산','새마을식당','24시 편의점','서강안경원','우리세탁소','서강시청 2km','중앙치킨'];
 const build=()=>{
  const bays=[[],[],[]],shop=[],tops=[],hang=[],side=[],heaps=[],chunks=[],signs=[],shut=[],rebar=[];
  for (const b of BLD) {
   const s=b.s,x0=s*20,yaw=-s*PI/2,cf=i=>b.cf?b.cf[i]:b.f,col=floor(rnd()*4);
   const at=(i,y,d=0)=>[x0+s*d,FY+y,s>0?b.z+i*BW:b.z+(b.n-i)*BW];// 칸 i 의 원점 (외벽면)
   for (let i=0; i<b.n; i++) {
    const c=cf(i);
    for (let j=0; j<c; j++) {
     const r=rnd(),ty=r<b.dm*.35?2:r<b.dm?1:0;
     if (j==0) { shop.push(ins(at(i,0),yaw,1,col)); const k=floor(rnd()*SIGN.length);
      if (rnd()<.75) signs.push(rnd()<.2?insM(trsS(V3.add(at(i,0),[-s*(1.2+rnd()),.05,s*.3]),yaw+(rnd()-.5)*.4,BW*.86,.62,1,-PI/2+.15,(rnd()-.5)*.2),7,k):insM(trsS(at(i+.07,2.42),yaw,BW*.86,.62,1,0,rnd()<.25?-.12:0),7,k));
      if (rnd()<.7) shut.push(insM(trsS(at(i,2.4),yaw,1,.4+rnd()*1.8,1),1,0));
      continue; }
     bays[ty].push(ins(at(i,j*SH),yaw,1,col));
    }
    tops.push(ins(at(i,c*SH),yaw,1,c<b.f?-1:col));
    if (c<b.f) { // 붕괴: 매달린 슬래브 · 잔해 더미
     hang.push(ins(at(i+.5,c*SH,DEP*.55),yaw,1,0,1,-.3-rnd()*.45,(rnd()-.5)*.2));
     // 옆 칸이 더 높으면 그 슬래브가 옆으로 처져 매달림
     for (const [nb,e] of [[i-1,0],[i+1,1]]) if (nb>=0&&nb<b.n&&cf(nb)>c+1&&rnd()<.8) { const y=(c+1+floor(rnd()*(cf(nb)-c-1)))*SH; hang.push(ins(at(i+e,y,DEP*.5),(s>0)==!e?0:PI,1,0,1,-.5-rnd()*.6,(rnd()-.5)*.3)); }
     const hp=at(i+.5,0,-1.5-rnd());hp[1]=0;heaps.push(insM(trsS(hp,yaw+rnd(),2.6+rnd(),.9+(b.f-c)*.25,2.4+rnd()),1,0));
     ROUND.push([hp[0],hp[2],2,1]);
     for (let k=0; k<5; k++) chunks.push(ins([hp[0]-s*(rnd()*4-.5),.1,hp[2]+(rnd()-.5)*5],rnd()*6,1,floor(rnd()*3),.25+rnd()*.5,rnd()*3,rnd()*3));
    }
   }
   // 옆벽·뒷벽 (월드 상자)
   const zA=b.z,zB=b.z+b.n*BW,hA=cf(s>0?0:b.n-1)*SH,hB=cf(s>0?b.n-1:0)*SH,xi=x0+s*(DEP+.3);
   side.push([x0,xi,zA,hA],[x0,xi,zB,hB]);
   RECT.push([(x0+xi)/2,(zA+zB)/2,0,DEP/2+.4,(zB-zA)/2+.2,b.f*SH]);
  }
  // 칸: 기둥 · 창 아래 벽 · 인방 · 슬래브 띠 · 바닥 · 안벽 · 칸막이
  const room=()=>{
   surf(2,4,(u,v)=>[L(0,BW,u),.16,L(-WT,-DEP,v)],INN,2);
   surf(2,2,(u,v)=>[L(0,BW,u),L(.16,SH-.1,v),-DEP],INN,2);
   surf(4,2,(u,v)=>[0,L(.16,SH-.1,v),L(-WT,-DEP,u)],INN,2);
  };
  const band=()=>blk(-.02,BW+.02,-.1,.17,-WT-.04,.09,SL,3,0,12,8,4);
  bat(()=>{ blk(-.03,.52,0,SH,-WT,0,CR,1); blk(.5,BW,0,.92,-WT,0,CR,1); blk(.5,BW,2.3,SH,-WT,0,CR,1); band(); room();
   for (const x of [.6,BW-.08]) blk(x-.03,x+.03,.92,2.3,-.12,-.06,[.5,.5,.48],8,0,6,4,3); // 섀시 잔여
  },bays[0]);
  bat(()=>{ // 파손 칸: 창 아래 벽 부서짐 · 인방 일부 · 철근
   const j=rough(.05,6,1.3);
   blk(-.03,.52,0,SH,-WT,0,CR,1,j); blk(.5,1.7,0,.82,-WT,0,CR,1,j); blk(1.6,2.4,0,.45,-WT,0,CR,1,j); blk(.5,1.4,2.3,SH,-WT,0,CR,1,j); blk(2.4,BW,2.45,SH,-WT,0,CR,1,j); band(); room();
   for (let k=0; k<5; k++) { const x=1.7+k*.16; tube(v=>[x+.05*v,.5+.45*v*(1+k%2*.4),-.12+.12*v*v],.012,RB,4,4,3); }
   for (let k=0; k<4; k++) { const x=1.45+k*.25; tube(v=>[x,2.3-.35*v,-.1+.1*v*v*(k%2?1:-1)],.012,RB,4,4,3); }
   pill([1.3,.3,-1],[.4,.14,.3],2.5,SL,3,rough(.06,5,2)); pill([2.3,.25,-1.6],[.3,.1,.25],2.5,SL,3,rough(.05,5,4));
  },bays[1]);
  bat(()=>{ // 벽이 날아간 칸: 기둥 · 슬래브 · 그을린 방 · 바닥 잔해
   blk(-.03,.52,0,SH,-WT,0,CR,1,rough(.06,5,7)); band(); room();
   for (let k=0; k<6; k++) pill([.7+k*.45,.24,-.4-rnd()*1.5],[.25,.1+.06*(k%2),.2],2.4,SL,3,rough(.06,5,k),8,5);
   for (let k=0; k<6; k++) { const x=.7+k*.4; tube(v=>[x,2.85-.4*v,.0-.15*v*v],.012,RB,4,4,3); tube(v=>[x+.1,.17+.25*v,-.05+.1*v],.012,RB,4,4,3); }
  },bays[2]);
  bat(()=>{ // 1층 상가: 기둥 · 간판 띠 · 어두운 가게 안
   blk(-.03,.42,0,SH,-WT,0,CR,1); blk(.4,BW,2.4,SH,-WT,0,CR,1); room();
   blk(.4,BW,0,.12,-.1,.05,[.4,.4,.38],3,0,8,6,3);
   for (let k=0; k<3; k++) pill([1+k*.9,.35,-2-k*1.2],[.4,.35,.3],6,[.25,.2,.16],13,rough(.04,4,k),8,5); // 진열대
  },shop);
  bat(()=>{ band(); surf(2,4,(u,v)=>[L(0,BW,u),.16,L(-WT,-DEP,v)],SL,3); blk(-.03,BW+.03,.17,1.05,-WT,0,CR,1,rough(.02,4,3)); },tops.filter(q=>q[19]>=0)); // 옥상 + 난간
  bat(()=>{ band(); surf(3,4,(u,v)=>[L(0,BW,u),.16+.08*sin(u*9)*v,L(-WT,-DEP,v)],SL,3,rough(.04,3,2)); },tops.filter(q=>q[19]<0)); // 부서진 꼭대기
  bat(()=>{ // 매달린 슬래브 (경첩 = 원점, +Z 로 뻗음) + 철근
   blk(-BW/2,BW/2,-.1,.12,0,DEP*.85,SL,3,rough(.06,2.2,1),10,10,6);
   for (let k=0; k<9; k++) { const x=-1.5+k*.37; tube(v=>[x+.05*sin(v*7+k),-.02-.3*v*v,-.6*v],.014,RB,4,4,4); }
  },hang);
  bat(()=>{ // 셔터 (위에서 내려옴, 골판)
   surf(2,10,(u,v)=>[L(.45,BW-.05,u),-v,-.06+.012*sin(v*40*PI)],[.42,.42,.4],13);
  },shut);
  bat(()=>surf(1,1,(u,v)=>[u,v,.15],[1,1,1],7),signs); // 간판 (아틀라스)
  bat(()=>{ // 잔해 더미 (단위 크기, 비정형)
   surf(32,12,(u,v)=>{ const a=u*2*PI,r=(1-v**1.6*.92)*(1+.18*sin(a*3+1)+.1*sin(a*7)),p=[r*cos(a),v**.8,r*sin(a)]; const n=noi([p[0]*3,p[1]*3,p[2]*3],1.3,2)+.5*noi([p[0]*9,p[1]*9,p[2]*9],1.1,5); return [p[0]*(1+.12*n),p[1]+.1*n*(1-v*.5),p[2]*(1+.12*n)]; },[.5,.46,.4],9,0);
  },heaps);
  side.forEach(([xa,xb,z,h])=>{ RECT.push([(xa+xb)/2,z,0,abs(xb-xa)/2,.3,h]); });
  bat(()=>{ for (const [xa,xb,z,h] of side) blk(min(xa,xb)-.1,max(xa,xb)+.1,FY-.1,FY+h+.1,z-.2,z+.2,CR,16,rough(.04,.8,z),8,10,8); },[ins([0,0,0],0,0)]);
  /* 콘크리트 덩어리 3 종 (거리 전체에 흩어짐) */
  for (let k=0; k<150; k++) { const x=(rnd()<.5?-1:1)*(6+rnd()**.6*14),z=-40+rnd()*110; if (abs(z-LZ[2])<16&&abs(x)<15||abs(z)<5&&abs(x)<9) continue; chunks.push(ins([x,terr(x,z),z],rnd()*6,1,floor(rnd()*3),.15+rnd()**2*.6,rnd()*3,rnd()*3)); }
  for (let v=0; v<3; v++) bat(()=>{ pill([0,0,0],[.6,.4,.5],3+v,v==1?[.3,.29,.27]:SL,v==1?9:3,rough(.12,2.5,v*3),10,7); if (v==2) for (let k=0; k<4; k++) tube(t=>[-.3+k*.2,.1+.6*t,.1*sin(t*3+k)],.015,RB,4,4,3); },chunks.filter(q=>q[19]==v),9);
  /* 땅: 가까운 격자 (연석 정렬) + 먼 극좌표 */
  bat(()=>{
   const xs=[],zs=[]; for (let x=-60; x<=60; x+=x<-15||x>14?3:1) { xs.push(x); if (x==-14) xs.push(-13.08,-12.92); if (x==12) xs.push(12.92,13.08); }
   xs.sort((a,b)=>a-b); for (let z=-150; z<=320; z+=2) zs.push(z);
   const b0=V.length/10; for (const z of zs) for (const x of xs) V.push(x,terr(x,z),z,0,1,0,1,1,1,0);
   for (let j=0; j<zs.length-1; j++) for (let i=0; i<xs.length-1; i++) { const q=b0+j*xs.length+i,r=q+xs.length; X.push(q,r,q+1,q+1,r,r+1); }
   surf(120,60,(u,v)=>{ const r=60+3800*v**2,a=u*2*PI,x=sin(a)*r,z=cos(a)*r; return [x,-.4-.3*sin(x*.01)*sin(z*.013),z]; },[1,1,1],0);
   for (const s of [1,-1]) blk(s*13-.1,s*13+.1,-.04,.17,-150,320,[.58,.57,.53],15,0,6,4,2);
  },[ins([0,0,0],0,0)],0);
  /* 모래주머니 진지 (z≈1.1) + 콘크리트 방호벽 */
  const SB=[];
  for (let c=0; c<6; c++) for (let x=-7+(c%2)*.3; x<6.1; x+=.6) { const zz=1.1+.04*sin(x*.4)+.012*x; for (const dz of c<3?[-.18,.18]:[0]) SB.push(ins([x+(rnd()-.5)*.06,.08+c*.148,zz+dz+(rnd()-.5)*.04],(rnd()-.5)*.14,1,0,1,(rnd()-.5)*.06,(rnd()-.5)*.08)); }
  RECT.push([-.5,1.15,0,6.7,.42,1]);
  bat(()=>pill([0,0,0],[.28,.078,.165],4.2,[.37,.35,.26],6,p=>{ const ax=abs(p[0])/.28,k=1+.05*sin(p[0]*23)*sin(p[2]*17); return [p[0]*(1-.06*abs(p[1])/.078),p[1]*k*(1-.35*ax**3)-.02*ax*ax,p[2]*(1-.12*ax**4)*(1+.04*sin(p[0]*11))]; },14,8),SB);
  const JB=[[-8.6,.6,.35],[-10.7,.1,.2],[-12.6,-.9,.5],[8.9,-2.2,-1.1]];
  JB.forEach(q=>RECT.push([q[0],q[1],q[2],1,.32,.82]));
  bat(()=>loft(12,10,v=>{ const z=L(-1,1,v),k=(1-abs(z)**12)**.1; return [.32*k,0,.82,4,z]; },[.62,.6,.55],14,p=>[p[2],p[1],p[0]*(1-.6*sm(.2,.75,p[1]))]),JB.map(q=>ins([q[0],0,q[1]],q[2],1,0)));
  /* 불탄 차 5 + 버스 (차체 로프트 · 빈 창 · 바퀴 테만) */
  const car=(len,wid,top,belt,isBus)=>{
   loft(14,26,v=>{ const t=v,z=L(-len/2,len/2,t),k=(1-abs(2*t-1)**(isBus?14:5))**.25,y1=top(t);
    return [wid*k*(isBus?1:1-.06*sm(belt,y1,y1)),.28,.28+(y1-.28)*k**(isBus?.3:.5),isBus?6:3.4,z]; },(p,u,v)=>{
    const win=p[1]>belt+.05&&p[1]<top(v)-.1&&(isBus?(fract(p[2]/1.2+.1)>.12):abs(p[2]-(len*.08))>.12);
    return win?[.02,.018,.016]:[.3,.14,.07]; },5);
   for (const z of [-1,1]) for (const x of [-1,1]) wheel([x*(wid-.12),.3,z*(len/2-(isBus?2:.85))],.34,.22,[.05,.045,.04],12,12);
  };
  const fract=x=>x-floor(x);
  const CARS=[[9,-6,.3,0],[-10.5,9,1.8,1],[11,40,-.4,0],[-6.5,46,2.6,0],[-11.4,-12,.1,0],[9.5,3.5,-1.25,0]],BUS=[[-9.6,56,.25]];
  bat(()=>car(4.5,.88,t=>.95+.48*sm(.25,.4,t)*(1-sm(.66,.82,t))-.18*sm(.85,1,t),.95,0),CARS.map(c=>ins([c[0],-.05,c[1]],c[2],1,c[3],1,(rnd()-.5)*.03,(rnd()-.5)*.05)));
  CARS.forEach(c=>RECT.push([c[0],c[1],c[2]+PI/2,2.2,.9,1.4]));
  bat(()=>car(11,1.25,t=>3.05,1.35,1),BUS.map(c=>ins([c[0],-.02,c[1]],c[2],1,0,1,0,.04)));
  BUS.forEach(c=>RECT.push([c[0],c[1],c[2]+PI/2,5.5,1.3,3]));
  /* 전신주 (콘크리트) · 전선 · 쓰러진 기둥 */
  const POLE=[[14.6,-46],[14.6,-16],[14.6,62],[-14.6,-40],[-14.6,-8],[-14.6,24],[-14.6,52]],FALL=[14.6,36];
  POLE.forEach(p=>ROUND.push([p[0],p[1],.22,9]));
  const pole=()=>{ lathe([0,0,0],v=>[.17-.06*v,v*10],[.55,.54,.5],15,10,3); blk(-1,1,8.9,9.05,-.07,.07,[.5,.5,.48],15,0,8,4,2); for (const x of [-.8,-.3,.3,.8]) pill([x,9.12,0],[.035,.06,.035],2,[.8,.8,.75],8,0,6,4); lathe([.32,7.6,0],v=>[.22,v*.8],[.35,.36,.35],8,10,2); };
  bat(pole,[...POLE.map(p=>ins([p[0],FY,p[1]],0,1)),ins([FALL[0]-.2,.3,FALL[1]],.12,1,0,1,0,1.42)]);
  const wire=(a,b,sag)=>tube(v=>[L(a[0],b[0],v),L(a[1],b[1],v)-sag*4*v*(1-v),L(a[2],b[2],v)],.014,DK,8,4,14);
  bat(()=>{
   const top=(p,o)=>[p[0]+o,9.12,p[1]];
   for (const o of [-.8,-.3,.3,.8]) { wire(top(POLE[0],o),top(POLE[1],o),.8); wire(top(POLE[3],o),top(POLE[4],o),.8); wire(top(POLE[4],o),top(POLE[5],o),.9); wire(top(POLE[5],o),top(POLE[6],o),.9); }
   const ft=[FALL[0]-9.9,.45,FALL[1]+1.2];// 쓰러진 기둥 끝 → 엉킨 전선이 바닥으로
   for (let k=0; k<4; k++) { const a=top(POLE[2],k*.5-.75),c=[ft[0]+k*.3,.3,ft[2]+k*.5]; tube(v=>{ const p=V3.lerp(a,c,v); p[1]=L(a[1],c[1],v**.6)-1.5*sin(v*PI)*(1-v)+.25*sin(v*17+k)*v; p[2]+=.4*sin(v*9+k)*v; return p; },.014,DK,8,4,24); }
   for (let k=0; k<3; k++) tube(v=>[ft[0]-1-v*3.5+.3*sin(v*13+k),.04+.06*abs(sin(v*9+k)),ft[2]+.8*sin(v*5+k*2)],.014,DK,8,4,18);
  },[ins([0,0,0],0,1)],0);
  /* 고가도로 (z≈84): 상판 · 난간 · 교각, 오른쪽 경간 붕괴 */
  const deck=(len)=>{ blk(0,len,-1,0,-8,8,[.6,.58,.54],11,rough(.03,.3,len),14,8,6); for (const s of [1,-1]) blk(0,len,0,1,s*7.85-.15,s*7.85+.15,[.6,.58,.54],11,0,14,8,4); blk(.5,len-.5,-1.6,-1,-5,5,[.5,.49,.46],11,0,10,6,4); };
  const OZ=84,OY=8.2;
  bat(()=>deck(31),[ins([-15.5,OY,OZ],0,1),ins([-46.5,OY,OZ],0,1),ins([-108.5,OY,OZ],0,1),ins([-139.5,OY,OZ],0,1),ins([48,.35,OZ],0,1,0,1,0,atan2(OY-.35,31)),ins([79,OY,OZ],0,1),ins([110,OY,OZ],0,1)]);
  bat(()=>deck(32),[ins([-77.5,OY,OZ],0,1),ins([15.5,OY,OZ],0,1,0,1,0,-atan2(OY-.4,30))]);
  bat(()=>{ blk(-1,1,0,OY-1.6,-1.3,1.3,[.56,.55,.52],11,0,10,8,6); blk(-1.2,1.2,OY-2,OY-1,-6,6,[.56,.55,.52],11,0,10,6,4); },[[-15.5],[15.5],[-46.5],[-77.5],[-108.5],[79],[110]].map(([x])=>ins([x,0,OZ],0,1)));
  [[-15.5],[15.5],[-46.5]].forEach(([x])=>RECT.push([x,OZ,0,1.2,1.5,OY]));
  heaps.push(insM(trsS([46,0,OZ],.3,4,1.6,7),1,0));
  /* 먼 스카이라인: 고층 건물 (부서진 꼭대기) */
  const TW=[[],[]];
  for (let k=0; k<46; k++) {
   const a=(rnd()-.5)*2.4,r=180+rnd()**.7*650,x=sin(a)*r*1.2,z=cos(a)*r+70; if (abs(x)<40&&z<260) continue;
   const h=30+rnd()**1.6*130*(z>300?1:.5);TW[rnd()<.45?1:0].push(insM(trsS([x,-.3,z],rnd()*.6-.3,18+rnd()*22,h,14+rnd()*12),2,rnd()));
  }
  for (let k=0; k<14; k++) { const s=k%2?1:-1,z=100+floor(k/2)*24; TW[k%3?0:1].push(insM(trsS([s*(30+rnd()*6),-.3,z],0,18+rnd()*4,10+rnd()*28,20),2,rnd())); }
  for (let v=0; v<2; v++) bat(()=>surf(24,12,(u,w)=>{ // 단위 타워: 4 면 + 지붕 (v=1: 붕괴한 꼭대기)
   const t=u*4,f=floor(t)%4,q=t-floor(t),pr=[[q-.5,-.5],[.5,q-.5],[.5-q,.5],[-.5,.5-q]][f];
   const lip=w>.92,k=lip?(1-w)/.08:1,top=v?1-.28*(.5+.5*sin(pr[0]*7+pr[1]*5))*sm(-.2,.5,pr[0]+pr[1]):1;
   return [pr[0]*k,lip?top:w/.92*top,pr[1]*k];
  },[.5,.5,.5],10),TW[v],0);
 };
  /* ── 헬기 (Mi-8/17 급): 모델 공간 원점 = 주 로터 축 아래 지면, +Z 기수, +X 좌현(문 쪽) ── */
 const HUB=[0,4.58,.15],TR=[.42,4.3,-14.45];
 const fus=v=>{ // 동체 단면 [반폭, 아래 y, 위 y, 지수, z]
  const z=L(-14.1,8.65,v);
  if (z>6) { const t=(z-6)/2.65,k=sqrt(max(0,1-t**2.3)); return [1.25*k**.85,1.55-.8*k**.75,1.55+(3-1.55)*k*(1-.42*t),3.2-1.1*t,z]; }
  if (z>-2.6) return [1.25,.75,3,3.2,z];
  if (z>-5.4) { const t=(-2.6-z)/2.8; return [1.25-.8*t**1.2,.75+1.27*t**1.4,3-.08*t,3.2-1.2*t,z]; }
  const t=(-5.4-z)/8.7,r=L(.45,.27,t)*(t>.96?sqrt(max(0,1-((t-.96)/.04)**2)):1),c=L(2.47,2.8,t);
  return [r,c-r,c+r,2,z];
 };
 const buildHeli=()=>{
  const MT=[.12,.12,.11],GL=[.04,.05,.06];
  bat(()=>{
   loft(30,96,fus,OD,20);
   // 엔진 덮개 · 흡입구 · 배기관
   loft(20,24,v=>{ const z=L(-5.8,5.05,v),t=v,k=sqrt(max(0,1-((t-.5)/.5)**8)),bk=sm(.45,0,t); return [.98*k*(1-.55*bk),2.75,L(3.98,3.05,bk)*k+2.75*(1-k),3,z]; },OD,20);
   for (const s of [1,-1]) {
    surf(14,6,(u,v)=>{ const a=u*2*PI,r=v<.8?.36+.04*v:.36*sqrt(max(0,1-((v-.8)/.2)**2))+.02; return [s*.52+r*cos(a),3.42+r*sin(a),L(4.3,5.35,v)]; },OD,20);
    pill([s*.52,3.42,5.36],[.2,.2,.08],2,[.08,.08,.08],22,0,10,5);
    tube(v=>[s*(.82+.55*v*v),3.38-.12*v,-.9-1.1*v],v=>.2+.05*v,[.2,.17,.14],26,10,8);
   }
   lathe([HUB[0],3.85,HUB[2]],v=>[.17-.03*v,v*.65],MT,22,10,2);
   // 연료 탱크 · 수평 안정판 · 꼬리 파일론 · 꼬리 끝
   for (const s of [1,-1]) {
    loft(16,14,v=>{ const k=sqrt(max(0,1-(2*v-1)**6)); return [.47*k,1.18-.47*k,1.18+.47*k,2,L(-.1,2.95,v),s*1.74]; },OD,20);
    for (const z of [.4,2.4]) tube(v=>[s*(1.15+.55*v),1.62-.1*v,z],.04,MT,22,5,2);
   }
   surf(16,6,(u,v)=>{ const a=u*2*PI,c=L(.75,.5,abs(v*2-1)); return [L(-1.75,1.75,v),2.55+.04*sin(a)*(1-.5*cos(a)),-12.45+c*.5*cos(a)]; },OD,20);
   surf(16,10,(u,v)=>{ const a=u*2*PI,ch=L(1.35,.75,v),c=[0,L(2.55,4.75,v),L(-13.75,-14.55,v)-(v>.85?.0:0)]; return [.11*(1-.3*v)*sin(a)*(1-.4*cos(a)),c[1],c[2]+ch*.5*cos(a)]; },OD,20);
   pill([.2,TR[1],TR[2]],[.25,.16,.16],3,OD,20,0,10,6);
   // 바퀴: 앞 2 · 주 2, 지지대
   for (const s of [1,-1]) wheel([s*.21,.31,6.45],.31,.18,[.06,.06,.06],23);
   tube(v=>[0,L(1.05,.31,v),L(6.25,6.45,v)],.06,MT,22,6,3); tube(v=>[L(-.25,.25,v),.31,6.45],.04,MT,22,5,2);
   for (const s of [1,-1]) {
    const w=[s*2.08,.5,-.9]; wheel(w,.5,.3,[.06,.06,.06],23,18); pill(w,[.12,.24,.24],2.5,MT,22,0,10,6);
    for (const q of [[s*1.05,.95,-.2],[s*1.05,.95,-1.6],[s*1.45,2.05,-.85]]) tube(v=>V3.lerp(q,[w[0]-s*.18,.52,-.9],v),q[1]>1.5?.09:.06,MT,22,6,3);
   }
   // 항법등 (좌 적 · 우 녹 · 꼬리 백) · 충돌 방지등 (깜박)
   pill([1.76,2.55,-12.45],[.05,.05,.07],2,[3,.1,.05],27,0,6,4); pill([-1.76,2.55,-12.45],[.05,.05,.07],2,[.1,2.6,.6],27,0,6,4);
   pill([0,2.82,-14.12],[.05,.05,.05],2,[2,2,1.8],27,0,6,4);
   pill([0,3.12,-6.6],[.07,.07,.07],2,[4,.15,.05],28,0,6,4); pill([0,.74,1.6],[.07,.06,.07],2,[4,.15,.05],28,0,6,4);
   // 기수 피토관 · 안테나
   for (const s of [1,-1]) tube(v=>[s*.55,1.75,L(7.8,8.9,v)],.02,MT,22,4,2);
   tube(v=>[0,L(2.9,3.6,v),L(-8,-8.6,v)],.015,MT,22,4,2);
  },[1],3);
  // 미닫이 문 (좌현, 열리면 뒤로 미끄러짐)
  bat(()=>{ surf(6,10,(u,v)=>{ const z=L(3.55,4.95,u),y=L(.8,2.62,v),q=abs((y-1.875)/1.125); return [1.25*max(0,1-q**3.2)**(1/3.2)+.035,y,z]; },OD,20); },[1],3);
  // 로터 허브 (회전)
  bat(()=>{ lathe([0,-.12,0],v=>[.5-.15*v,v*.28],MT,22,16,3); for (let k=0; k<5; k++) { const a=k*2*PI/5; tube(v=>[cos(a)*L(.3,.85,v),.06,-sin(a)*L(.3,.85,v)],.08,MT,22,6,2); } lathe([0,.16,0],v=>[.25*(1-v*v),v*.3],MT,22,10,3); },[1],3);
  // 주 로터 깃 (하나, 5 인스턴스) — 셰이더에서 처짐/원추
  bat(()=>surf(10,24,(u,v)=>{ const a=u*2*PI,r=L(.8,10.65,v),ch=.53*(v>.985?.6:1),tw=-.12*v; const cz=ch*.5*cos(a),cy=.035*sin(a)*(1+.4*cos(a)); return [r,cy*cos(tw)+cz*sin(tw),cz*cos(tw)-cy*sin(tw)]; },[.13,.13,.13],24),[1,1,1,1,1],3);
  // 꼬리 로터 (3 깃 + 허브, 축 X)
  bat(()=>{ for (let k=0; k<3; k++) { const b=k*2*PI/3; surf(8,10,(u,v)=>{ const a=u*2*PI,r=L(.18,1.95,v),cz=.13*cos(a),cy=.025*sin(a); return [cy,r*cos(b)-cz*sin(b),r*sin(b)+cz*cos(b)]; },[.15,.15,.14],24); } pill([0,0,0],[.12,.14,.14],2,MT,22,0,8,5); },[1],3);
 };
   /* 셰이더 */
 const WGSL=/* wgsl */`
struct U{s:vec4f,h:vec4f,k:vec4f}; // s: x 시간 y 로터 속도 z 문 w 품질 / h: x 깜박 / k: 헬기 x, 고도, z, 방위
@group(1)@binding(0)var<uniform>u:U;
@group(1)@binding(1)var sgt:texture_2d<f32>;
struct I{@location(0)p:vec3f,@location(1)n:vec3f,@location(2)c:vec3f,@location(3)m:f32,@location(4)a:vec4f,@location(5)b:vec4f,@location(6)d:vec4f,@location(7)e:vec4f,@location(8)t:vec4f};
struct V{@builtin(position)p:vec4f,@location(0)w:vec3f,@location(1)n:vec3f,@location(2)c:vec3f,@location(3)@interpolate(flat)m:f32,@location(4)o:vec3f,@location(5)@interpolate(flat)t:vec4f,@location(6)q:vec3f};
fn tf(i:I,vp:mat4x4f)->V{
var p=i.p;
if(i.m==24.&&p.x>1.){let r=(p.x-.8)/9.85;p.y+=mix(-.5,.18,u.s.y)*r*r;} // 깃 처짐 (정지) → 원추 (회전)
let M=mat4x4f(i.a,i.b,i.d,i.e);let w=(M*vec4f(p,1.)).xyz;
let s2=vec3f(dot(i.a.xyz,i.a.xyz),dot(i.b.xyz,i.b.xyz),dot(i.d.xyz,i.d.xyz))+1e-6;
let n=mat3x3f(i.a.xyz,i.b.xyz,i.d.xyz)*(i.n/s2);
return V(vp*vec4f(w,1.),w,n,i.c,i.m,p,i.t,i.n);
}
@vertex fn vs(i:I)->V{return tf(i,g.viewProj);}
@vertex fn vsS(i:I)->@builtin(position)vec4f{return tf(i,g.shadowVP).p;}
fn nz(p:vec2f)->f32{return textureSampleLevel(noiseTex,linSamp,p*.0039,0.).x;}
fn fd(s:f32,px:f32)->f32{return clamp(s/px*.35-.5,0.,1.);}
fn ln(x:f32,w:f32,px:f32)->f32{return 1.-smoothstep(w,w+px,abs(x));}
fn star(p0:vec2f,r:f32,rf:f32)->f32{ // 오각별 SDF
let k1=vec2f(.809017,-.587785);let k2=vec2f(-k1.x,k1.y);var p=vec2f(abs(p0.x),p0.y);
p-=2.*max(dot(k1,p),0.)*k1;p-=2.*max(dot(k2,p),0.)*k2;p.x=abs(p.x);p.y-=r;
let ba=rf*vec2f(-k1.y,k1.x)-vec2f(0.,1.);let h=clamp(dot(p,ba)/dot(ba,ba),0.,r);
return length(p-ba*h)*sign(p.y*ba.x-p.x*ba.y);
}
fn crack(q:vec2f,px:f32)->f32{let c=abs(nz(q)-.5)+.03*nz(q*7.);return ln(c-.012,.006,px*.4)*smoothstep(.45,.6,nz(q*.37+3.));}
fn ground(P:vec3f,px:f32)->vec3f{
let ax=abs(P.x);let a=nz(P.xz*.05);let b=nz(P.xz*.31)*.6+nz(P.xz*1.3)*.4;let e=mix(.5,nz(P.xz*4.1),fd(.1,px));
// 아스팔트: 바랜 회색 + 땜질 + 균열
var c=mix(vec3f(.19,.19,.185),vec3f(.29,.28,.265),a*.7+b*.3)*(.85+.3*e);
c=mix(c,vec3f(.11,.11,.11),smoothstep(.62,.66,nz(P.xz*.07+5.))*.8);
c*=1.-.6*crack(P.xz*.18,px);
// 차선: 중앙 황색 2줄 · 흰 점선 · 가장자리
let wear=smoothstep(.25,.6,nz(P.xz*.6+2.)*.6+e*.4);
var mk=max(ln(ax-.22,.07,px),0.);let mky=mk;
mk=max(mk,max(ln(ax-4.3,.07,px),ln(ax-8.6,.07,px))*step(fract(P.z/9.),.42));
mk=max(mk,ln(ax-12.4,.07,px));
c=mix(c,select(vec3f(.8,.78,.72),vec3f(.75,.58,.14),mky>0.),mk*wear*.85*step(ax,12.8));
// 횡단보도 (z 36~41)
let cw=step(36.,P.z)*step(P.z,41.)*step(fract(P.x/1.1),.55)*step(ax,12.5);c=mix(c,vec3f(.78,.77,.72),cw*wear*.8);
// 보도: 블록 포장 + 연석
if(ax>13.05){let q=fract(vec2f(P.x/.3,P.z/.3+.5*floor(P.x/.3)));c=mix(vec3f(.42,.36,.33),vec3f(.5,.48,.45),step(.5,nz(floor(P.xz/vec2f(.3))*.71)))*(.8+.3*b);
c*=1.-.35*max(ln(q.x-.5,.46,px/.3),ln(q.y-.5,.46,px/.3))*fd(.3,px);}
// 먼지·잔해 가루 (건물 쪽·더미 주변), 폭발 그을음
let du=smoothstep(.3,.8,nz(P.xz*.09)*.7+nz(P.xz*.4)*.3+smoothstep(10.,19.,ax)*.5);c=mix(c,vec3f(.44,.41,.37)*(.8+.4*b),du*.75);
var CT=array<vec3f,4>(vec3f(-5.,17.,3.2),vec3f(7.,47.,2.6),vec3f(-3.,-14.,2.4),vec3f(10.,62.,3.));
for(var k=0;k<4;k++){let o=CT[k];
let d=length(P.xz-o.xy)/o.z;let rad=.5+.5*sin(atan2(P.z-o.y,P.x-o.x)*9.+nz(P.xz*2.)*3.);
c*=1.-.85*smoothstep(1.3,.3,d+rad*.25);c=mix(c,vec3f(.03),smoothstep(.55,.2,d));}
// 먼 땅: 잔해 흙
let far=smoothstep(60.,90.,max(ax,abs(P.z-80.)-200.));c=mix(c,mix(vec3f(.3,.28,.25),vec3f(.2,.19,.17),a),far);
return c;
}
@fragment fn fs(i:V)->@location(0)vec4f{
let P=i.w;let o=i.o;let m=i.m;let px=length(fwidth(P))+1e-4;
let E=normalize(g.cam.xyz-P);var N=normalize(i.n);if(dot(N,E)<0.){N=-N;}
var al=i.c;var gl=.03;var em=vec3f(0.);var ao=1.;var sunk=1.;
if(m==0.){al=ground(P,px);
// 헬기 접지 그늘 (동체 · 바퀴)
let hd=P.xz-u.k.xz;let cy=cos(u.k.w);let sy=sin(u.k.w);let lx=hd.x*cy-hd.y*sy;let lz=hd.x*sy+hd.y*cy;let alt=max(u.k.y,0.);
let q=vec2f(max(abs(lx)-1.,0.),max(abs(lz-1.5)-6.,0.));ao*=1.-.6*smoothstep(2.4+alt*.6,0.,length(q))*smoothstep(7.,.3,alt);
let wq=min(min(length(vec2f(abs(lx)-2.08,lz+.9)),length(vec2f(lx,lz-6.45))),length(vec2f(lx*.5,(lz+14.)*.3)));ao*=1.-.6*smoothstep(.75,.12,wq)*smoothstep(.6,.05,alt);}
else if(m==1.||m==16.){ // 칠한 콘크리트 외벽: 색 4 종 · 물때 · 그을음 · 총탄 자국 · 벗겨짐
let pv=i32(i.t.w);var PC=array<vec3f,4>(vec3f(.74,.7,.62),vec3f(.62,.62,.6),vec3f(.72,.62,.53),vec3f(.56,.6,.63));var pc=PC[clamp(pv,0,3)];
if(m==16.){pc=vec3f(.6,.58,.54);}
let q=vec2f(P.x+P.z,P.y);let n=nz(q*.9)*.5+nz(q*3.7)*.3+nz(q*11.)*.2*fd(.1,px);
al=pc*(.84+.24*n);
al*=1.-.28*smoothstep(.4,.9,nz(vec2f(q.x*2.1,q.y*.09)))*smoothstep(.2,.9,nz(q*.13)); // 빗물 줄
let pe=smoothstep(.6,.64,nz(q*.5+7.)*.6+n*.4);al=mix(al,vec3f(.45,.44,.41)*(.8+.3*nz(q*6.)),pe);
let so=smoothstep(.5,.85,nz(vec2f(q.x*.11,q.y*.05-.3)+i.t.y*3.)*.7+nz(q*.4)*.3);al=mix(al,vec3f(.035,.03,.028),so*.92); // 화재 그을음
let cl=floor(q/.16);let h=hash21(cl);let f=fract(q/.16)-.5;let pk=step(.93,h);let d=length(f);
al=mix(al,al*.35,pk*smoothstep(.22,.05,d)*fd(.04,px));
}
else if(m==2.){ // 실내: 깊을수록 어둡고 그을림
let dp=-o.z;al=mix(vec3f(.4,.37,.33),vec3f(.06,.05,.045),smoothstep(.45,.75,nz(P.xz*.5+P.y)))*(.8+.3*nz(P.xy*3.+P.zz));
ao=mix(.18,1.,exp(-dp*.5));sunk=smoothstep(2.2,.3,dp);
}
else if(m==3.||m==9.){ // 생 콘크리트 · 잔해
let q=P.xz+P.yy*.7;al*=.7+.45*nz(q*2.3)*nz(q*.8+P.y);al=mix(al,vec3f(.34,.32,.3),smoothstep(.6,.8,nz(q*5.))*.5);
if(m==9.){al=mix(al,vec3f(.29,.27,.25),smoothstep(.4,.7,nz(q*1.3)));al*=.85+.3*step(.7,nz(q*9.));}
}
else if(m==4.){al=mix(vec3f(.22,.1,.05),vec3f(.12,.08,.06),nz(P.xy*30.));gl=.1;}
else if(m==5.){ // 불탄 차: 녹 · 숯 · 남은 도색
let q=o.xz*2.+o.yy;let n=nz(q*3.);al=mix(i.c,vec3f(.06,.05,.045),smoothstep(.4,.7,nz(q)+(1.-o.y)*.2));
al=mix(al,vec3f(.36,.17,.08)*(.7+.5*n),smoothstep(.55,.7,nz(q*1.7+4.))*.7);
if(i.t.w>.5&&o.y<.9){al=mix(al,vec3f(.55,.56,.57),smoothstep(.5,.6,nz(q*.8+1.))*.6);}
if(i.c.r<.05){al=i.c;ao=.4;}gl=.05;
}
else if(m==6.){ // 모래주머니 천
let q=o.xz*40.;al*=(.85+.2*sin(q.x)*sin(q.y*1.1)*fd(.02,px))*(.8+.35*nz(P.xz*3.+P.yy*5.));al*=.85+.3*i.t.y;
al=mix(al,vec3f(.3,.27,.2),smoothstep(.5,.8,nz(P.xz*2.))*.4);
}
else if(m==7.){ // 간판 (아틀라스 10 칸: 2 열 × 5 행)
let k=f32(i32(i.t.w));let cell=vec2f(k%2.,floor(k/2.));let uv=(cell+vec2f(clamp(o.x,.01,.99),1.-clamp(o.y,.02,.98)))/vec2f(2.,5.);
al=textureSampleLevel(sgt,linSamp,uv,0.).rgb;if(dot(i.n,E)<0.){al=vec3f(.25,.24,.22);}
let so=smoothstep(.45,.8,nz(o.xy*vec2f(3.,1.)+i.t.y*7.));al=mix(al,vec3f(.04,.035,.03),so*.85);al*=.75+.3*nz(o.xy*9.);gl=.15;
}
else if(m==8.){al*=.8+.3*nz(P.xy*4.);gl=.15;}
else if(m==10.){ // 먼 고층: 창 격자 (대부분 어둡게 깨짐), 그을음
let q=vec2f(P.x+P.z,P.y);let w=fract(vec2f(q.x/3.2,q.y/3.));let wi=step(.18,w.x)*step(w.x,.82)*step(.3,w.y)*step(w.y,.85)*fd(3.,px);
let cl=floor(vec2f(q.x/3.2,q.y/3.));al=vec3f(.5,.49,.47)*(.75+.35*nz(cl*.3+i.t.y*9.));
al=mix(al,vec3f(.06,.06,.065)*(.7+.6*hash21(cl)),wi*.9);
al=mix(al,vec3f(.04,.035,.03),smoothstep(.5,.85,nz(q*.03+i.t.y*5.))*.85);
}
else if(m==11.||m==14.||m==15.){let q=P.xz+P.yy;al*=.78+.3*nz(q*1.5)+.1*nz(q*7.);al*=1.-.3*smoothstep(.5,.9,nz(vec2f(q.x*3.,P.y*.3)));if(m==11.){al*=1.-.5*crack(q*.4,px);}}
else if(m==12.){al=vec3f(.035,.032,.03)*(.8+.4*nz(P.xy*20.));gl=.1;}
else if(m==13.){al*=.75+.35*nz(P.xy*2.+P.zz);gl=.12;let so=smoothstep(.4,.8,nz(P.xy*.6+P.zz*.4));al=mix(al,vec3f(.05,.04,.035),so*.7);if(i.c.r<.3){ao=.35;}}
// ── 헬기 재질 (모델 공간 o) ──
else if(m==20.){ // 올리브색 도장: 패널선 · 리벳 띠 · 그을음 · 창 · 문 · 붉은 별
al=vec3f(.27,.29,.17)*(.88+.2*nz(o.xz*3.+o.yy*2.));gl=.12;let pc2=floor(vec2f(o.z/1.05,o.y/.62));al*=.92+.12*hash21(pc2+i.t.x*7.);
let ps=max(max(ln(fract(o.z/1.05)-.5,.007,px*.6),ln(o.y-1.3,.006,px*.6)),ln(fract(o.y/.62)-.5,.004,px*.6)*.6)*fd(.05,px);al*=1.-.45*ps;
let rv=max(ln(fract(o.z/1.05)-.47,.006,px),ln(fract(o.z/1.05)-.53,.006,px))*smoothstep(.35,.2,abs(fract(o.y/.09)-.5))*fd(.02,px);al*=1.-.25*rv;
al=mix(al,vec3f(.17,.15,.1),smoothstep(1.2,.75,o.y)*.5*step(abs(o.x),1.4)); // 아랫배 흙먼지
al=mix(al,vec3f(.04,.035,.03),smoothstep(-1.,-2.6,o.z)*smoothstep(2.9,3.6,o.y)*smoothstep(.3,.9,abs(o.x))*(.6+.4*nz(o.xz*4.))); // 배기 그을음
let ax=abs(o.x);var glass=0.;
if(o.z>5.85&&o.z<7.15&&o.y>2.08&&o.y<2.86&&ax>.72){glass=1.-ln(o.z-6.5,.03,px);} // 조종석 옆창
if(o.z>6.45&&o.y>2.25&&ax<1.05&&o.z<7.7){glass=max(glass,(1.-ln(o.x,.05,px))*(1.-ln(o.z-6.45,.04,px)));} // 앞유리
if(o.z>7.6&&o.y>1.1&&o.y<2.25){let fr=max(ln(fract(o.z/.42)-.5,.04,px),ln(fract(o.x/.5)-.5,.03,px));glass=max(glass,1.-fr);} // 유리 기수
if(o.z>-2.3&&o.z<5.6&&ax>1.&&o.y>1.7&&o.y<2.6){ // 둥근 객실 창
let zc=round((o.z-.25)/1.08)*1.08+.25;let d=length(vec2f(o.z-zc,o.y-2.15));
let door=o.x>0.&&o.z>3.3&&o.z<5.1;
if(!door&&zc<5.5){glass=max(glass,smoothstep(.215,.2,d));al*=1.-.4*ln(d-.23,.015,px);}
}
if(glass>.01){al=mix(al,vec3f(.025,.03,.035),glass);gl=mix(gl,1.,glass);}
// 좌현 문 개구부: 문이 열리면 어두운 객실
if(o.x>.5&&o.z>3.55&&o.z<4.95&&o.y>.8&&o.y<2.62&&i.t.x<.5){let fr=1.-ln(o.z-4.25,.69,px)*ln(o.y-1.71,.9,px);al=mix(vec3f(.02,.02,.018)*(1.+o.y),al*.6,fr);gl=.02;ao=.6;}
if(i.t.x==1.){ // 문 판: 둥근 창 1 · 테두리
let d=length(vec2f(o.z-4.25,o.y-2.15));al=mix(al,vec3f(.025,.03,.035),smoothstep(.215,.2,d));gl=mix(gl,1.,smoothstep(.215,.2,d));
al*=1.-.4*max(ln(o.z-3.57,.02,px),ln(o.z-4.93,.02,px));}
// 꼬리 붐 붉은 별 (흰 원 + 붉은 테)
if(o.z<-6.5&&o.z>-10.5&&ax>.15){let q=vec2f((o.z+8.5)*sign(o.x),o.y-2.62);let d=length(q);
let rs=step(d,.56)*step(.47,d);let wh=step(d,.47);let st=smoothstep(.01,-.01,star(q,.42,.42));
al=mix(al,vec3f(.75,.73,.68),wh);al=mix(al,vec3f(.55,.04,.03),max(rs,st));}
// 꼬리 붐 번호 대신 흰 띠
}
else if(m==21.){al=vec3f(.03);gl=1.;}
else if(m==22.){al=vec3f(.1,.1,.095)*(.8+.3*nz(o.xz*9.));gl=.25;}
else if(m==23.){al=vec3f(.035,.035,.033);gl=.06;}
else if(m==24.){al=vec3f(.12,.12,.115);gl=.2;if(o.x>9.9){al=vec3f(.55,.45,.1);} if(abs(o.y)>.3){al=vec3f(.12);}}
else if(m==26.){al=mix(vec3f(.22,.17,.13),vec3f(.05,.045,.04),smoothstep(-1.,-2.,o.z));gl=.2;}
else if(m==27.||m==28.){let bl=select(1.,u.h.x,m==28.);em=i.c*(.25+bl*3.);al=vec3f(.2);}
// 지면 접지 AO (건물·차·잔해)
if(m==1.||m==3.||m==5.||m==9.||m==14.||m==15.||m==16.){ao*=mix(.55,1.,smoothstep(0.,.9,P.y));}
let Ls=g.sun.xyz;let nl=max(dot(N,Ls),0.);let nv=max(dot(N,E),0.);
let sv=shadowAt(P,N)*mix(.35,1.,cloudVis(P))*sunk;
let R=reflect(-E,N);let spw=10.+250.*gl*gl;
let am=ambAt(N);var c=al*(g.sunCol.rgb*nl*sv+mix(am,vec3f(dot(am,vec3f(.3,.4,.3))),.55)*1.25*ao+pointLights(P,N));
c+=g.sunCol.rgb*sv*pow(max(dot(N,normalize(Ls+E)),0.),spw)*gl*(spw+8.)*.03*min(nl*8.,1.);
c=mix(c,skyBase(vec3f(R.x,abs(R.y),R.z))*ao*.8,gl*(.04+.96*pow(1.-nv,5.))*.7);
// 먼지 낀 공기 (전투 직후)
let dd=length(P-g.cam.xyz);let hz=skyBase(normalize(vec3f(-E.x,.06,-E.z)));c=mix(c,mix(hz,vec3f(dot(hz,vec3f(.33))),.6)*vec3f(.72,.66,.6),(1.-exp(-dd*.006))*.55*exp(-max(P.y,0.)*.004));
return vec4f(fogAt(c+em,P),1.);
}
// ── 반투명: 연기 기둥 (상태 없는 퍼프: 인스턴스 번호 + 시간) · 로터 원판 ──
struct PU{p:array<vec4f,6>,q:array<vec4f,6>}; // p: 바닥 xyz, 높이 / q: 폭, 개수, 주기(s), 불빛
@group(1)@binding(2)var<uniform>pu:PU;
struct PV{@builtin(position)p:vec4f,@location(0)uv:vec2f,@location(1)w:vec3f,@location(2)@interpolate(flat)b:vec4f,@location(3)r:vec3f,@location(4)up:vec3f};
@vertex fn vp(@builtin(vertex_index)vi:u32,@builtin(instance_index)ii:u32)->PV{
let k=ii/256u;let j=f32(ii%256u);let P=pu.p[k];let Q=pu.q[k];
let h=hash33(vec3f(j,f32(k),3.7));let ph=fract(j/Q.y+g.cam.w/Q.z+h.x*.3/Q.y);
let y=P.w*pow(ph,.7);let wd=Q.x*(.25+1.3*pow(ph,.8));
let c=P.xyz+vec3f(y*.35*ph+(h.y-.5)*wd*.8,y,(h.z-.5)*wd*.6+y*.12*ph);
let sz=Q.x*(.45+1.1*pow(ph,.7))*(.8+.4*h.y);
let f=normalize(g.cam.xyz-c);let r=normalize(cross(vec3f(0.,1.,0.),f));let up=cross(f,r);
let q0=vec2f(f32(vi&1u),f32((vi>>1u)&1u))*2.-1.;let a=h.z*6.28+g.cam.w*.03*(h.x-.5);let q=vec2f(q0.x*cos(a)-q0.y*sin(a),q0.x*sin(a)+q0.y*cos(a));
let w=c+(r*q.x+up*q.y)*sz;
let al=smoothstep(0.,.05,ph)*(1.-smoothstep(.45,1.,ph));
return PV(g.viewProj*vec4f(w,1.),q0,w,vec4f(al,ph,h.x,Q.w),r,up);
}
@fragment fn fp(v:PV)->@location(0)vec4f{
let d=length(v.uv);if(d>1.){discard;}
let n=fbm(v.uv*1.6+v.b.z*17.,4);
let a=smoothstep(1.,.25,d+(n-.5)*.8)*v.b.x*.85;if(a<.004){discard;}
let Nn=normalize(v.r*v.uv.x+v.up*v.uv.y+normalize(g.cam.xyz-v.w)*sqrt(max(1.-d*d,0.)));
let shade=mix(.035,.16,smoothstep(.0,.8,v.b.y))*(.7+.5*n);
var c=vec3f(shade)*(ambAt(Nn)*1.6+g.sunCol.rgb*(.25+.75*max(dot(Nn,g.sun.xyz),0.))*.55);
let fl=smoothstep(v.b.w,v.b.w*.2,v.b.y)*step(.001,v.b.w);c=mix(c,vec3f(1.,.34,.07)*(1.+n*1.5)*(4.-3.*v.b.y/max(v.b.w,.01)),fl);
return vec4f(fogAt(c,v.w)*a,a);
}
struct DI{@location(0)a:vec4f,@location(1)b:vec4f,@location(2)d:vec4f,@location(3)e:vec4f,@location(4)t:vec4f}; // 행렬 + (불투명도, 깃 수, 각, -)
struct DV{@builtin(position)p:vec4f,@location(0)uv:vec2f,@location(1)w:vec3f,@location(2)@interpolate(flat)t:vec4f,@location(3)n:vec3f};
@vertex fn vd(@builtin(vertex_index)vi:u32,i:DI)->DV{
let q=vec2f(f32(vi&1u),f32((vi>>1u)&1u))*2.-1.;let M=mat4x4f(i.a,i.b,i.d,i.e);let w=(M*vec4f(q.x,0.,q.y,1.)).xyz;
return DV(g.viewProj*vec4f(w,1.),q,w,i.t,normalize(i.b.xyz));
}
@fragment fn fdsk(v:DV)->@location(0)vec4f{
let r=length(v.uv);if(r>1.||r<.07){discard;}
let th=atan2(v.uv.y,v.uv.x);let x=fract((th-v.t.z)*v.t.y/6.2832);
let st=exp(-x*5.)+exp(-(1.-x)*40.)*.5;
var a=v.t.x*(.3+.7*st)*smoothstep(1.,.96,r)*smoothstep(.07,.2,r)*(.6+.4*r)*.6;
let tip=smoothstep(.93,.97,r)*smoothstep(1.,.98,r);
var N=v.n;if(dot(N,g.cam.xyz-v.w)<0.){N=-N;}
var c=vec3f(.1)*(ambAt(N)+g.sunCol.rgb*max(dot(N,g.sun.xyz),0.)*.4);
c=mix(c,vec3f(.4,.33,.1)*(ambAt(N)+g.sunCol.rgb*.3),tip*.8);a=max(a,tip*v.t.x*.45);
return vec4f(fogAt(c,v.w)*a,a);
}`;
  /* GPU */
 let mod,bgl,bg,vb,xb,ib,hb,db,ub,pb,tex,ms,pipe,pipeS,pipeP,pipeD;
 const UB=new Float32Array(12),HBUF=new Float32Array(9*20),DBUF=new Float32Array(2*20),PB=new Float32Array(48);
 const PLUME=[[-150,0,560,560,70,64,70,.06],[240,0,380,300,40,40,55,.06],[-26,5,21,130,9,40,26,.03],[30,6,-42,90,7,28,22,0],[-9.6,.9,57,7,1.1,26,3.2,.45],[-10.5,.6,9,5,.6,16,3.6,0]];
 const mkp=(vs,fs,o)=>G.dev.createRenderPipeline({
  layout: G.layout(bgl),vertex: { module: mod,entryPoint: vs,buffers: [
   { arrayStride: 40,attributes: [[0,0,'x3'],[1,12,'x3'],[2,24,'x3'],[3,36,'']].map(([l,o,f])=>({ shaderLocation: l,offset: o,format: 'float32'+f })) },
   { arrayStride: 80,stepMode: 'instance',attributes: [4,5,6,7,8].map((l,i)=>({ shaderLocation: l,offset: i*16,format: 'float32x4' })) }] },
  fragment: fs?{ module: mod,entryPoint: fs,targets: [{ format: G.HDR }] }:undefined,primitive: { cullMode: 'none' },...o });
 const pre={ color: { srcFactor: 'one',dstFactor: 'one-minus-src-alpha' },alpha: { srcFactor: 'one',dstFactor: 'one-minus-src-alpha' } };
 const run=(p,pl,sh)=>{
  if (!vb||!pl) return;
  p.setPipeline(pl); p.setBindGroup(1,bg); p.setVertexBuffer(0,vb); p.setIndexBuffer(xb,'uint32');
  const lo=!G.Q.level;let cur=null;
  for (const b of B) {
   if (sh&&!(b.fl&1)||lo&&b.fl&4) continue;
   const hv=b.fl&2; if (hv&&!H.vis) continue;
   const vbI=hv?hb:ib; if (vbI!==cur) { p.setVertexBuffer(1,vbI); cur=vbI; }
   p.drawIndexed(b.n,hv?b.c:lo&&b.fl&8?b.c>>1:b.c,b.i0,0,hv?b.f2:b.f);
  }
 };
 const atlas=()=>{ // 간판 10 종 (일반 상호, 실존 상표 없음)
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=640; const x=cv.getContext('2d');
  const BG=['#1d4f9c','#2f8a3c','#d8d2c0','#b22a22','#e2b51c','#f4f4f0','#25255a','#2a7fae','#1f6d3a','#c4501c'],FG=['#fff','#fff','#c12','#fff','#222','#1d4f9c','#f6d36a','#fff','#fff','#fff'];
  SIGN.forEach((t,k)=>{ const ox=(k%2)*512,oy=floor(k/2)*128;
   x.fillStyle=BG[k]; x.fillRect(ox,oy,512,128); x.strokeStyle='#0005'; x.lineWidth=8; x.strokeRect(ox+4,oy+4,504,120);
   x.fillStyle=FG[k]; x.textAlign='center'; x.textBaseline='middle'; x.font='bold 74px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR","NanumGothic",sans-serif';
   x.fillText(t,ox+256,oy+68,470); });
  return x.getImageData(0,0,1024,640).data;
 };
  /* 헬기 상태 · 경로 (S.heli 0..1): 먼 하늘 → 대로 위 접근 → 감속·기수 들기 → 제자리 회전 → 착지 */
 const HP=[[-190,200,574],[-95,128,294],[-14,58,114],[0,22,30],[0,8.5,5],[0,4.2,.1],[0,0,0]],HS=[0,.2,.42,.62,.78,.9,1];
 const HT=HP.map((p,i)=>{ if (i==HP.length-1) return [0,-12,0]; const a=HP[max(i-1,0)],b=HP[i+1],ds=HS[i+1]-HS[max(i-1,0)]; return V3.mul(V3.sub(b,a),1/ds); });
 const path=s=>{
  s=cl(s,0,1); let i=0; while (i<HS.length-2&&s>HS[i+1]) i++;
  const h=HS[i+1]-HS[i],t=(s-HS[i])/h,t2=t*t,t3=t2*t,a=2*t3-3*t2+1,b=t3-2*t2+t,c=-2*t3+3*t2,d=t3-t2,P0=HP[i],P1=HP[i+1],M0=HT[i],M1=HT[i+1];
  return [0,1,2].map(k=>a*P0[k]+b*h*M0[k]+c*P1[k]+d*h*M1[k]+LZ[k]);
 };
 const wrapA=a=>atan2(sin(a),cos(a));
 const H={ vis: 0,pos: [0,0,0],yaw: 0,pitch: 0,roll: 0,M: M4.ident(),ang: 0,tang: 0,rs: 1,land: 0,dust: 0,was: 0,door: 0 };
 RU.heliPos=()=>H.pos.slice();
 RU.heliM=()=>H.M;
 const poseHeli=(dt)=>{
  const s=cl(+S.heli||0,0,1),p=path(s),e=.004,pa=path(s-e),pb=path(s+e),T=22;
  const vx=pb[0]-pa[0],vz=pb[2]-pa[2],sp=hypot(vx,vz)/(2*e)/T;
  const yv=hypot(vx,vz)>1e-4?atan2(vx,vz):PI,pa2=path(s-2*e),pb2=path(s+2*e),y1=atan2(pa[0]-pa2[0],pa[2]-pa2[2]),y2=atan2(pb2[0]-pb[0],pb2[2]-pb[2]);
  const ys=PI-(PI-HY)*sm(.78,.93,s),wy=sm(.5,.7,s);
  H.yaw=wrapA(yv+wrapA(ys-yv)*wy);
  const yr=wrapA(y2-y1)/(3*e)/T;
  H.roll=cl(-atan2(yr*sp,9.8),-.45,.45)*(1-sm(.55,.7,s));
  H.pitch=-.09*(1-sm(.45,.6,s))+.2*sm(.55,.68,s)*(1-sm(.72,.86,s))+.03*sm(.86,.95,s)*(1-sm(.96,1,s));
  // 착지: 서스펜션 반동 · 제자리 비행 흔들림
  if (s>=.999) { if (!H.land) H.land=G.time; } else H.land=0;
  const tl=H.land?G.time-H.land:0,bo=H.land?-.1*exp(-tl*3.2)*sin(tl*9):0,hv=(sm(.7,.8,s)*(1-sm(.95,1,s)))*S.rotor;
  const tt=G.time;
  p[0]+=hv*.25*sin(tt*.7); p[1]+=hv*.18*sin(tt*1.1+1)+bo; p[2]+=hv*.2*sin(tt*.53+2);
  H.roll+=hv*.025*sin(tt*.9); H.pitch+=hv*.015*sin(tt*.77+1)+(H.land?.012*exp(-tl*3)*sin(tl*8+1):0);
  H.pos=p; H.M=M4.trs(p,H.yaw,H.pitch,H.roll,1);
  HB.on=s>.97?1:0; HB.x=p[0]; HB.z=p[2]; HB.yaw=H.yaw;
  // 로터: 속도 완만히 추종, 각 적분
  H.rs+=(cl(+S.rotor,0,1.2)-H.rs)*min(1,dt*.5); H.ang+=dt*20.5*H.rs; H.tang+=dt*105*H.rs;
  H.door+=(cl(+S.door||0,0,1)-H.door)*min(1,dt*2.5);
  H.vis=1;
  const M=H.M,put=(k,m)=>HBUF.set(m,k*20),hub=M4.mul(M,M4.trs(HUB,H.ang));
  put(0,M); HBUF[16]=0;
  put(1,M4.mul(M,M4.trs([0,0,-1.45*H.door],0))); HBUF[36]=1;
  put(2,hub);
  const bv=1-sm(.5,.8,H.rs);
  for (let k=0; k<5; k++) { const m=M4.mul(M,M4.trs(HUB,H.ang+k*2*PI/5)); if (bv<.02) m.fill(0); put(3+k,m); }
  const tm=M4.mul(M,M4.trs(TR,0,H.tang)); if (bv<.02) tm.fill(0); put(8,tm);
  for (let k=1; k<9; k++) HBUF[k*20+16]=k==1?1:2;
  UB[1]=H.rs; UB[2]=H.door; UB[8]=p[0]; UB[10]=p[2]; UB[11]=H.yaw;
  // 회전 원판: 메인 · 꼬리
  const da=sm(.3,.75,H.rs);
  DBUF.set(M4.mul(M,M4.trs(HUB,H.ang,0,0,10.65)),0); DBUF[16]=da*.8; DBUF[17]=5; DBUF[18]=H.ang;
  DBUF.set(M4.mul(M,M4.trs(TR,0,0,PI/2,1.95)),20); DBUF[36]=da*.7; DBUF[37]=3; DBUF[38]=H.tang;
  // 하강 기류 먼지
  const gy=terr(p[0],p[2]),alt=p[1]-gy; UB[9]=alt; const k=(1-sm(3,24,alt))*sm(.35,.8,H.rs)*(H.land?max(.3,exp(-(G.time-H.land)*.15)):1);
  if (G.fx&&k>0) {
   H.dust+=dt*k*[5,10,16][G.Q.level];
   while (H.dust>1) { H.dust--; const a=rnd()*6.283,r=3+rnd()*7,v=5+rnd()*6;
    G.fx.burst('smoke',[p[0]+cos(a)*r,gy+.6,p[2]+sin(a)*r],{ size: .22+rnd()*.25,vel: [cos(a)*v,.8+rnd(),sin(a)*v] }); }
  }
 };
  /* 불 · 연기 (불탄 버스·차·건물) */
 const FIRES=[[30,5,-42,.5],[-24,7,22,.6]];
 let smk=0,was=0;
 RU.ENV={ sunEl: 8,sunAz: 32,cloud: .85,haze: .8,fogDen: 1/1100,cloudBase: 900,cloudTop: 2600,indoor: 0,exposure: 1.15 };
 G.register('ruins',{
  init() {
   const dev=G.dev,U=GPUBufferUsage,T=GPUTextureUsage,S2=GPUShaderStage,buf=(a,usage)=>{ const b=dev.createBuffer({ size: a.byteLength,usage: usage|U.COPY_DST }); dev.queue.writeBuffer(b,0,a); return b; };
   try { build(); const h0=B.length; buildHeli(); let k=0; for (let i=h0; i<B.length; i++) { B[i].f2=k; k+=B[i].c; } } catch (e) { G.err('ruins build '+(e.stack||e)); }
   vb=buf(new Float32Array(V),U.VERTEX); xb=buf(new Uint32Array(X),U.INDEX); ib=buf(new Float32Array(IN),U.VERTEX); V=X=IN=0;
   hb=buf(HBUF,U.VERTEX); db=buf(DBUF,U.VERTEX); ub=buf(UB,U.UNIFORM); pb=buf(PB,U.UNIFORM);
   tex=dev.createTexture({ size: [1024,640],format: 'rgba8unorm',usage: T.TEXTURE_BINDING|T.COPY_DST });
   try { dev.queue.writeTexture({ texture: tex },atlas(),{ bytesPerRow: 4096 },[1024,640]); } catch (e) { G.err('ruins atlas '+e); }
   bgl=dev.createBindGroupLayout({ entries: [{ binding: 0,visibility: S2.VERTEX|S2.FRAGMENT,buffer: {} },{ binding: 1,visibility: S2.FRAGMENT,texture: {} },{ binding: 2,visibility: S2.VERTEX,buffer: {} }] });
   bg=dev.createBindGroup({ layout: bgl,entries: [{ binding: 0,resource: { buffer: ub } },{ binding: 1,resource: tex.createView() },{ binding: 2,resource: { buffer: pb } }] });
   mod=G.shader(WGSL,'ruins');
   pipeS=mkp('vsS',null,{ depthStencil: { format: G.DEPTH,depthWriteEnabled: true,depthCompare: 'less',depthBias: 2,depthBiasSlopeScale: 2 } });
  },
  onQuality({ msaa: n }) {
   if (n==ms) return; ms=n;
   pipe=mkp('vs','fs',{ multisample: { count: n },depthStencil: { format: G.DEPTH,depthWriteEnabled: true,depthCompare: 'greater' } });
   const tr={ depthStencil: { format: G.DEPTH,depthWriteEnabled: false,depthCompare: 'greater' },multisample: { count: n },primitive: { topology: 'triangle-strip',cullMode: 'none' } };
   pipeP=G.dev.createRenderPipeline({ layout: G.layout(bgl),vertex: { module: mod,entryPoint: 'vp' },fragment: { module: mod,entryPoint: 'fp',targets: [{ format: G.HDR,blend: pre }] },...tr });
   pipeD=G.dev.createRenderPipeline({ layout: G.layout(bgl),vertex: { module: mod,entryPoint: 'vd',buffers: [{ arrayStride: 80,stepMode: 'instance',attributes: [0,1,2,3,4].map(l=>({ shaderLocation: l,offset: l*16,format: 'float32x4' })) }] },
    fragment: { module: mod,entryPoint: 'fdsk',targets: [{ format: G.HDR,blend: pre }] },...tr });
  },
  update(dt) {
   if (!RU.on) { was=0; return; }
   try {
    if (!was) { was=1; G.setEnv(RU.ENV); H.rs=cl(+S.rotor,0,1.2); H.door=cl(+S.door||0,0,1); }
    const t=G.time; UB[0]=t; UB[3]=G.Q.level; UB[4]=(t*1.1%1)<.12?1:0;
    poseHeli(dt);
    PLUME.forEach((q,k)=>{ PB.set(q.slice(0,4),k*4); PB.set([q[4],min(q[5],[q[5]*.45,q[5]*.7,q[5]][G.Q.level]|0),q[6],q[7]],24+k*4); });
    // 불: fx 궤적 (fx 의 넓은 점광은 빼고 작은 점광 하나)
    if (G.fx) {
     const n0=G.lights.length;
     for (const f of FIRES) G.fx.trail([f[0],f[1],f[2]],[0,1,0],'fire',dt*.22*f[3]);
     G.lights.length=n0;
     G.addLight([-9.6,2.5,57],[1,.45,.15],5+2*sin(t*13)+sin(t*29),24,dt*1.5);
     if ((smk-=dt)<=0) { smk=[1.4,.8,.5][G.Q.level]; const k=floor(rnd()*4),f=[[-14,1,30],[22,1.5,24],[-17,.5,-6],[8,3,-12]][k]; G.fx.burst('smoke',f,{ size: .35,vel: [.6,1,.2] }); }
    }
   } catch (e) { G.err('[ruins] '+(e.stack||e)); }
  },
  prepare() {
   if (!RU.on||!ub) return; const q=G.dev.queue;
   q.writeBuffer(ub,0,UB); q.writeBuffer(hb,0,HBUF); q.writeBuffer(db,0,DBUF); q.writeBuffer(pb,0,PB);
  },
  shadow(p) { RU.on&&run(p,pipeS,1); },
  opaque(p) { RU.on&&run(p,pipe,0); },
  transparent(p) {
   if (!RU.on||!pipeP) return;
   p.setPipeline(pipeD); p.setBindGroup(1,bg); p.setVertexBuffer(0,db); if (H.vis&&DBUF[16]>.002) p.draw(4,2,0,0);
   p.setPipeline(pipeP); p.setBindGroup(1,bg);
   for (let k=0; k<6; k++) { const n=PB[25+k*4]|0; n>0&&p.draw(4,n,0,k*256); }
  }
 },'story');
}
