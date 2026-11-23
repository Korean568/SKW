'use strict';
/* VILLAGE — 스토리 2 북한 협동농장 마을 (늦가을 아침). 월드 공간, 광장 중심 = 원점, 지면 ≈ 0 */
{
 const VL=G.village={ on: false,K: null,S: { doors: [],fire: 0 } },S=VL.S;
 const { sin,cos,abs,hypot,PI,min,max,atan2,sqrt,floor }=Math,L=G.lerp,cl=G.clamp,sm=(a,b,x)=>{ x=cl((x-a)/(b-a),0,1); return x*x*(3-2*x); };
 const rnd=G.rng(23);
  /* 지형: 평평한 광장·마당 → 남쪽 논·밭 → 계단식 구릉 → 먼 산 */
 const terr=(x,z)=>{
  const r=hypot(x,z),a=atan2(x,z),so=max(0,-z/(r+1e-3));
  let h=.1*sin(x*.21+.5)*sin(z*.17)+.06*sin(x*.53+z*.31);
  h+=sm(40,160,r)*(-.5+1.2*sin(x*.013+z*.009));
  const h0=L(70,260,so),hl=sm(h0,h0+380,r)*(26+16*sin(a*3+1)+9*sin(a*7+r*.01)),tr=2.2;
  const q=hl/tr,f=q-floor(q);h+=L(hl,(floor(q)+sm(.75,1,f))*tr,sm(h0+380,h0,r)*.85);
  h+=sm(500,2400,r)*(170+120*sin(a*4+1.3)+70*sin(a*9+.4)+40*sin(a*17))*(1+.5*sin(r*.004+a*2));
  return h;
 };
  /* 집 배치: 광장을 둘러싼 9채 + 관리위원회 건물 */
 const FY=.32,HW=4.2,HD=2.6,WH=2.62;
 const HA=[35,62,118,146,214,242,270,298,326],HR=[21.5,21,21,22,22,21.4,20.5,21,22];
 const H=[];
 const mkH=(a,R,s,yj)=>{ const x=sin(a)*R,z=cos(a)*R,yaw=atan2(-x,-z)+yj; H.push({ c: [x,terr(x,z),z],yaw,s,cs: cos(yaw),sn: sin(yaw) }); };
 HA.forEach((d,i)=>mkH(d*PI/180+(rnd()-.5)*.05,HR[i],1,(rnd()-.5)*.14));
 mkH(0,26,1.3,0); // 관리위원회 (목록 밖, 문 고정)
 const NH=HA.length;
 const hw=(h,p)=>[h.c[0]+(p[0]*h.cs+p[2]*h.sn)*h.s,h.c[1]+p[1]*h.s,h.c[2]+(-p[0]*h.sn+p[2]*h.cs)*h.s]; // 집 → 월드
 const hl=(h,x,z)=>{ const dx=x-h.c[0],dz=z-h.c[2]; return [(dx*h.cs-dz*h.sn)/h.s,(dx*h.sn+dz*h.cs)/h.s]; }; // 월드 → 집 (x,z)
 const gy=(x,z,y=0)=>[x,terr(x,z)+y,z];
 const WALL=[17.2,0,-PI/2];// 처형 벽 (x,z,yaw): 면이 −X(광장) 쪽
 const yawTo=(a,b)=>atan2(b[0]-a[0],b[2]-a[2]);
 const OFF=gy(0,11.5),ST=gy(-11,-2.2),KO=gy(-10.2,-1.1);
 VL.K={
  start: [...ST,yawTo(ST,OFF)],ko: [...KO,yawTo(KO,OFF)],officer: [...OFF,PI],
  wall: [...gy(16.35,0),-PI/2],line: [...gy(10.35,0),PI/2],
  houses: H.slice(0,NH).map(h=>({ door: hw(h,[.6,FY,HD]),yaw: h.yaw,inside: hw(h,[.3,FY,.6]),rooms: [[.3,FY,.6],[-2.8,FY,.2],[3,FY,-1.6]].map(p=>hw(h,p)),hide: [...hw(h,[3.65,FY,-2.1]),h.yaw] })),
  A: 7,B: 6,
  crowd: [],guards: [[-6.6,6,PI/2],[6.6,6,-PI/2],[-6.2,2,PI/2],[6.2,2,-PI/2],[-2.6,12.6,PI],[2.6,12.6,PI],[13.4,-4.5,-PI/2],[13.4,4.5,-PI/2]].map(([x,z,y])=>[...gy(x,z),y]),
  fires: []
 };
 for (const z of [4,5.6]) for (let i=0; i<6; i++) VL.K.crowd.push([...gy(-4+i*1.6+(z>5?.8:0)-.4,z),0]);
 const FL=[[-2,3.45,.4],[2.3,3.25,-.8]];
 H.forEach((h,k)=>FL.forEach(p=>VL.K.fires.push(hw(h,p))));
 for (let i=0; i<NH; i++) S.doors[i]=0;
  /* 충돌 상자 (집 공간 [x0,x1,z0,z1,y0,y1]) */
 const HB=[[-4.33,.15,2.47,2.73,0,WH],[1.05,4.33,2.47,2.73,0,WH],[-4.33,4.33,-2.73,-2.47,0,WH],[-4.33,-4.07,-2.73,2.73,0,WH],[4.07,4.33,-2.73,2.73,0,WH],
  [-1.53,-1.27,-2.6,.2,0,2.4],[-1.53,-1.27,1.1,2.6,0,2.4],[1.67,1.93,-2.6,-.6,0,2.4],[1.8,2.3,-.73,-.47,0,2.4],[3.1,4.2,-.73,-.47,0,2.4],
  [-1.3,.2,-2.47,-1.96,0,2.2],[2.7,4.1,1.4,2.45,0,.9],[.25,.95,-.05,.65,0,.62],[2.35,3.3,-2.4,-1.4,0,1.3],[3.45,4.1,-1.35,-.75,0,.9],[-2.6,-1.8,-2.47,-1.95,0,.8],
  [-4.85,-4.33,-1.6,1.6,0,1.3],[-4.95,4.95,-3.35,3.35,2.62,3.7]];
 const DB=[.15,1.05,2.47,2.73,0,2.2];
 const ROUND=[],RECT=[]; // 원 [x,z,r], 월드 상자 [cx,cz,yaw,hx,hz,h]
 const pushBox=(p,r,b)=>{ // 2D 상자 밀어내기 (p=[x,z])
  const cx=cl(p[0],b[0],b[1]),cz=cl(p[1],b[2],b[3]),dx=p[0]-cx,dz=p[1]-cz,d=hypot(dx,dz);
  if (d>=r) return;
  if (d>1e-6) { p[0]=cx+dx/d*r; p[1]=cz+dz/d*r; }
  else { const a=[p[0]-b[0],b[1]-p[0],p[1]-b[2],b[3]-p[1]],k=a.indexOf(min(...a)); p[k>>1]+=(k&1?1:-1)*(a[k]+r); }
 };
 VL.inside=p=>{ for (let i=0; i<NH; i++) { const q=hl(H[i],p[0],p[2]); if (abs(q[0])<HW-.13&&abs(q[1])<HD-.13) return i; } return -1; };
 VL.ground=(x,z)=>terr(x,z);
 VL.collide=(p,r=.3)=>{
  let x=p[0],z=p[2],y=terr(x,z);
  for (let i=0; i<H.length; i++) {
   const h=H[i],dx=x-h.c[0],dz=z-h.c[2]; if (dx*dx+dz*dz>(8*h.s)**2) continue;
   const q=hl(h,x,z),rr=r/h.s;
   for (let k=0; k<HB.length-1; k++) pushBox(q,rr,HB[k]);
   if (!(i<NH&&S.doors[i])) pushBox(q,rr,DB);
   x=h.c[0]+(q[0]*h.cs+q[1]*h.sn)*h.s; z=h.c[2]+(-q[0]*h.sn+q[1]*h.cs)*h.s;
   if (abs(q[0])<HW&&abs(q[1])<HD) y=h.c[1]+FY*h.s; else if (abs(q[0])<4.45&&abs(q[1])<3.3) y=max(y,h.c[1]+.28*h.s*sm(3.3,2.85,abs(q[1]))*sm(4.45,4.3,abs(q[0])));
  }
  for (const b of RECT) {
   const c=cos(b[2]),s=sin(b[2]),dx=x-b[0],dz=z-b[1],q=[dx*c-dz*s,dx*s+dz*c];
   if (abs(q[0])>b[3]+r+1||abs(q[1])>b[4]+r+1) continue;
   pushBox(q,r,[-b[3],b[3],-b[4],b[4]]); x=b[0]+q[0]*c+q[1]*s; z=b[1]-q[0]*s+q[1]*c;
  }
  for (const c of ROUND) { const dx=x-c[0],dz=z-c[1],d=hypot(dx,dz),m=c[2]+r; if (d<m&&d>1e-6) { x=c[0]+dx/d*m; z=c[1]+dz/d*m; } }
  return [x,y,z];
 };
 const slab=(o,d,b,t)=>{ // 광선-상자 [x0,x1,y0,y1,z0,z1] (축 순서 x,y,z)
  let s0=0,s1=t;
  for (let i=0; i<3&&s0<=s1; i++) { const v=1/(d[i]||1e-9),e=(b[i*2]-o[i])*v,f=(b[i*2+1]-o[i])*v; s0=max(s0,min(e,f)); s1=min(s1,max(e,f)); }
  return s0<=s1&&s0>1e-4?s0:t;
 };
 VL.ray=(o,d,mx=200)=>{
  let t=mx;
  for (let i=0; i<H.length; i++) {
   const h=H[i],q=hl(h,o[0],o[2]),e=[(d[0]*h.cs-d[2]*h.sn)/h.s,d[1]/h.s,(d[0]*h.sn+d[2]*h.cs)/h.s],O=[q[0],(o[1]-h.c[1])/h.s,q[1]];
   const bx=b=>{ t=min(t,slab(O,e,[b[0],b[1],b[4],b[5],b[2],b[3]],t)); };
   HB.forEach(bx); if (!(i<NH&&S.doors[i])) bx(DB);
  }
  for (const b of RECT) {
   const c=cos(b[2]),s=sin(b[2]),dx=o[0]-b[0],dz=o[2]-b[1];
   t=min(t,slab([dx*c-dz*s,o[1]-terr(b[0],b[1]),dx*s+dz*c],[d[0]*c-d[2]*s,d[1],d[0]*s+d[2]*c],[-b[3],b[3],0,b[5],-b[4],b[4]],t));
  }
  // 지면: 거친 행진 + 이분법
  let s=0,prev=o[1]-terr(o[0],o[2]);
  if (prev>0) for (let k=0; k<400&&s<t; k++) {
   const st=max(.25,prev*.5),n=s+st,y=o[1]+d[1]*n-terr(o[0]+d[0]*n,o[2]+d[2]*n);
   if (y<0) { let a=s,b=n; for (let j=0; j<8; j++) { const m=(a+b)/2; (o[1]+d[1]*m-terr(o[0]+d[0]*m,o[2]+d[2]*m)<0)?b=m:a=m; } t=min(t,a); break; }
   s=n; prev=y;
  }
  return t;
 };
  /* 문 부수기 애니메이션 */
 const DA=new Float32Array(16),DT=new Float32Array(16).fill(-1);
 VL.breakDoor=i=>{
  if (!(i>=0&&i<NH)) return; const K=VL.K.houses[i]; S.doors[i]=1; DT[i]=0;
  try {
   const p=V3.add(K.door,[0,1.1,0]);
   G.fx&&(G.fx.burst('hit',p,{ size: .35 }),G.fx.burst('smoke',p,{ size: .18,vel: [0,.3,0] }));
   G.sfx&&G.sfx.play&&(G.sfx.play('crash',{ pos: p,gain: .55,rate: 2.2 }),G.sfx.play('gun',{ pos: p,gain: .5,rate: .45 }));
  } catch (e) { G.err('village.breakDoor '+e); }
 };
  /* 형상: 정점 10 float (위치·법선·색·재질) / 인스턴스 20 float (행렬·부분·난수·집 번호·w) */
 let V=[],X=[],IN=[]; const B=[];
 const surf=(nu,nv,f,c,m,fl)=>{
  const b=V.length/10,e=.002,g=t=>cl(t,.004,.996);
  for (let j=0; j<=nv; j++) for (let i=0; i<=nu; i++) {
   const u=i/nu,v=j/nv,p=f(u,v),n=V3.norm(V3.cross(V3.sub(f(g(u)+e,g(v)),f(g(u)-e,g(v))),V3.sub(f(g(u),g(v)+e),f(g(u),g(v)-e))));
   V.push(...p,...(fl?V3.mul(n,-1):n),...(c.call?c(p,u,v):c),m);
   if (i<nu&&j<nv) { const q=b+j*(nu+1)+i,r=q+nu+1; X.push(q,r,q+1,q+1,r,r+1); }
  }
 };
 const sp=(t,e)=>Math.sign(t)*abs(t)**(2/e);
 // 초타원체 (e 클수록 모서리가 각진 둥근 상자)
 const pill=(c,h,e,col,m,w,nu=12,nv=8)=>surf(nu,nv,(u,v)=>{
  const a=u*2*PI,b=(v-.5)*PI,k=sp(cos(b),e),p=[c[0]+h[0]*k*sp(cos(a),e),c[1]+h[1]*sp(sin(b),e),c[2]+h[2]*k*sp(sin(a),e)];
  return w?w(p):p;
 },col,m,1);
 const blk=(x0,x1,y0,y1,z0,z1,col,m,w,e=22)=>pill([(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],[(x1-x0)/2,(y1-y0)/2,(z1-z0)/2],e,col,m,w,20,12);
 // 회전체: prof(v) → [반지름, 높이]
 const lathe=(c,prof,col,m,nu=16,nv=12,w)=>surf(nu,nv,(u,v)=>{ const [r,y]=prof(v),a=u*2*PI,p=[c[0]+r*cos(a),c[1]+y,c[2]+r*sin(a)]; return w?w(p):p; },col,m,1);
 const tube=(f,r,c,m,n=6,nv=5)=>surf(n,nv,(u,v)=>{ const t=V3.norm(V3.sub(f(v+.01),f(v-.01))),a=V3.norm(V3.cross(t,abs(t[1])>.9?[1,0,0]:[0,1,0])),b=V3.cross(t,a),k=u*2*PI,rr=r.call?r(v):r; return V3.add(f(v),V3.add(V3.mul(a,rr*cos(k)),V3.mul(b,rr*sin(k)))); },c,m);
 const ins=(p,yaw=0,part=0,flag=0,w=0,s=1,pitch=0,roll=0)=>[...M4.trs(p,yaw,pitch,roll,s),part,rnd(),flag,w];
 const bat=(fn,I,fl=1)=>{ const i0=X.length; fn(); const b={ i0,n: X.length-i0,f: IN.length/20,c: I.length,fl }; for (const q of I) IN.push(...q); B.push(b); return b; };
 const wob=(k=.015)=>p=>{ p[0]+=k*sin(p[1]*3.1+p[2]*2.3); p[2]+=k*sin(p[1]*2.7+p[0]*1.9); return p; };
 // 색
 const PL=[.78,.75,.68],WD=[.2,.14,.09],ST2=[.42,.4,.37],JAR=[.32,.17,.08],IRON=[.07,.065,.06];
 const build=()=>{
    /* 집 본체 (10 인스턴스): 기단·벽·창·문틀·지붕·실내 */
  const HI=H.map((h,k)=>ins(h.c,h.yaw,1,k,0,h.s));
  bat(()=>{
   pill([0,.13,.05],[4.5,.16,2.95],8,ST2,4,wob(.03),20,10); // 기단 돌
   pill([.6,.08,3.2],[.5,.1,.3],4,ST2,4); // 디딤돌
   const fw=(x0,x1,y0,y1)=>blk(x0,x1,y0,y1,HD-.13,HD+.13,PL,1,wob());
   const bw=(x0,x1,y0,y1)=>blk(x0,x1,y0,y1,-HD-.13,-HD+.13,PL,1,wob());
   // 앞벽: 창1 [-3.2,-2.4] 문 [.15,1.05] 창2 [2.2,3]
   fw(-4.33,-3.15,.2,WH); fw(-2.45,.2,.2,WH); fw(1.0,2.25,.2,WH); fw(2.95,4.33,.2,WH);
   for (const [a,b] of [[-3.2,-2.4],[2.2,3]]) { fw(a-.05,b+.05,.2,1.12); fw(a-.05,b+.05,1.78,WH); }
   fw(.1,1.1,2.13,WH);
   // 뒷벽: 창3 [-.6,.2] 창4 [-3.1,-2.4]
   bw(-4.33,-3.05,.2,WH); bw(-2.45,-.55,.2,WH); bw(.15,4.33,.2,WH);
   for (const [a,b] of [[-.6,.2],[-3.1,-2.4]]) { bw(a-.05,b+.05,.2,1.22); bw(a-.05,b+.05,1.8,WH); }
   for (const s of [1,-1]) blk(s*HW-.13,s*HW+.13,.2,WH,-HD-.1,HD+.1,PL,1,wob());
   // 내벽
   const iw=(x0,x1,z0,z1,y0=.3,y1=2.42)=>blk(x0,x1,y0,y1,z0,z1,PL,1);
   iw(-1.53,-1.27,-2.5,.2); iw(-1.53,-1.27,1.1,2.5); iw(-1.53,-1.27,.15,1.15,2.1);
   iw(1.67,1.93,-2.5,-.6); iw(1.8,2.3,-.73,-.47); iw(3.1,4.1,-.73,-.47); iw(2.25,3.15,-.73,-.47,2.02);
   // 바닥 · 천장 · 서까래
   surf(16,10,(u,v)=>[L(-4.1,4.1,u),FY,L(2.5,-2.5,v)],[.62,.44,.17],5);
   surf(8,6,(u,v)=>[L(-4.1,4.1,u),2.4,L(-2.5,2.5,v)],[.55,.5,.42],1);
   for (const z of [-1.3,0,1.3]) tube(v=>[L(-4.1,4.1,v),2.34,z+.02*sin(v*9)],.065,WD,2,6,6);
   // 들보 · 기둥 (짙은 나무)
   for (const s of [1,-1]) {
    tube(v=>[L(-4.45,4.45,v),2.6-.03*sin(v*PI),s*(HD+.16)],.1,WD,2,6,8);
    tube(v=>[s*(HW+.16),2.6,L(-2.85,2.85,v)],.1,WD,2,6,6);
    for (const z of [1,-1]) blk(s*HW-.17,s*HW+.17,.2,2.6,z*HD-.17,z*HD+.17,WD,2,wob(.01),6);
   }
   for (const x of [.1,1.1]) blk(x-.07,x+.07,.25,2.2,HD+.02,HD+.2,WD,2,0,6);
   blk(.02,1.18,2.12,2.28,HD+.02,HD+.21,WD,2,0,6);
   // 창: 틀 + 창호지
   const win=(a,b,y0,y1,z)=>{
    const s=Math.sign(z);
    blk(a-.08,b+.08,y0-.08,y0+.02,z-.15,z+.2*s+.02,WD,2,0,6); blk(a-.08,b+.08,y1-.02,y1+.07,z-.15,z+.15,WD,2,0,6);
    for (const x of [a,b]) blk(x-.05,x+.05,y0,y1,z-.15,z+.15,WD,2,0,6);
    surf(1,1,(u,v)=>[L(a,b,u),L(y0,y1,v),z],[.8,.77,.68],7);
   };
   win(-3.2,-2.4,1.12,1.78,HD); win(2.2,3,1.12,1.78,HD); win(-.6,.2,1.22,1.8,-HD); win(-3.1,-2.4,1.22,1.8,-HD);
   // 우진각 지붕: 위·아래 면 + 테두리 (처짐·처마 들림)
   const RX=4.95,RZ=3.35,ry=(x,z)=>{ const a=abs(z)/RZ,b=max(0,(abs(x)-1.6)/(RX-1.6)),q=(a**8+b**8)**.125; return 2.42+(1-q)*1.33-.1*cos(x/RX*PI/2)*(1-q)+.13*q**7-.05*sin(abs(x)/RX*PI)*q**4; };
   const rp=(u,v,d)=>{ const x=L(-RX,RX,u),z=L(-RZ,RZ,v); return [x,ry(x,z)-d,z]; };
   surf(36,20,(u,v)=>rp(u,v,0),[.35,.35,.34],3);
   surf(18,10,(u,v)=>rp(u,v,.13),[.3,.24,.18],2,1);
   const per=u=>{ const t=u*4%4,k=t|0,f=t-k; return [[L(-RX,RX,f),RZ],[RX,L(RZ,-RZ,f)],[L(RX,-RX,f),-RZ],[-RX,L(-RZ,RZ,f)]][k]; };
   surf(64,1,(u,v)=>{ const [x,z]=per(u); return [x,ry(x,z)-.13*v,z]; },[.28,.27,.26],3);
   // 용마루
   tube(v=>{ const x=L(-1.75,1.75,v); return [x,ry(x,0)+.04,0]; },.1,[.3,.3,.3],3,8,8);
   // 서까래 끝 (처마 아래)
   for (let x=-4.4; x<4.5; x+=.55) for (const s of [1,-1]) pill([x,ry(x,s*2.95)-.17,s*2.95],[.05,.05,.4],3,WD,2,0,6,4);
   // 굴뚝 (옆, 흙벽돌)
   lathe([HW+.6,0,-1.6],v=>[.2-.04*v+.03*(v>.95),v*3.6],[.38,.3,.24],4,10,4);
   // 장작 더미 (왼쪽 벽)
   for (let j=0; j<4; j++) for (let i=0; i<11; i++) pill([-HW-.38+(j%2)*.02,.25+j*.16+(i%2)*.02,-1.45+i*.29+(j%2)*.1],[.32,.075,.075],2.4,[.36,.27,.18],9,0,8,5);
   /* 실내 가구 */
   blk(-1.3,.2,FY,2.2,-2.47,-1.97,[.3,.11,.05],2,0,8); // 장롱
   for (const x of [-1.0,-.55,-.1]) pill([x+.15,1.35,-1.95],[.03,.02,.02],2,[.6,.45,.2],12,0,6,4);
   const bed=[[.62,.06,.08],[.12,.22,.45],[.75,.7,.55]];
   for (const [x,c] of [[-.9,bed[0]],[-.2,bed[1]]]) pill([x,2.28,-2.22],[.32,.075,.18],3,c,13,0,10,6); // 장롱 위 이불
   // 초상 액자 2 (빈/추상)
   for (const z of [-1.55,-.85]) { blk(-1.29,-1.25,1.45,2.0,z-.22,z+.22,[.55,.42,.16],12,0,8); blk(-1.25,-1.24,1.5,1.95,z-.17,z+.17,[.6,.63,.66],15,0,8); }
   // 앉은뱅이 상
   lathe([.6,FY,.3],v=>[v<.5?.42:.42-.02*(v-.5),.27+.04*v],[.3,.15,.07],2,20,3);
   for (let k=0; k<4; k++) { const a=k*PI/2+PI/4; pill([.6+cos(a)*.3,FY+.13,.3+sin(a)*.3],[.025,.14,.025],3,[.28,.14,.06],2,0,6,4); }
   // 부뚜막 + 무쇠솥 + 물독
   pill([3.4,.6,1.95],[.72,.3,.52],6,[.45,.36,.28],4,wob(.02),16,10);
   lathe([3.4,.82,1.95],v=>[.38*sin(v*PI*.5+.1),.25*(1-v)],IRON,12,20,8);
   lathe([3.4,1.07,1.95],v=>[.04,v*.06],IRON,12,8,2);
   lathe([2.55,FY,2.1],v=>{ const k=sin(v*PI); return [.08+.24*k**.7+.03*(v>.9),v*.62]; },JAR,11,16,10);
   // 광: 자루 · 독 · 상자
   for (const [x,y,z,s] of [[2.6,.55,-2.15,1],[2.65,.55,-1.65,1],[3.05,.52,-2.05,.95],[2.85,.95,-1.9,.9],[3.1,.5,-1.6,.9]]) pill([x,y,z],[.24*s,.24*s,.3*s],3,[.55,.48,.36],13,p=>{ p[1]+=.03*sin(p[0]*17+p[2]*13); return p; },12,8);
   blk(3,3.35,FY,1.2,-1.35,-.95,[.32,.24,.16],2,0,6);
   for (const [x,z,s] of [[3.75,-1.05,1],[3.85,-.85,.7]]) lathe([x,FY,z],v=>{ const k=sin(v*PI); return [(.1+.22*k**.7)*s,v*.7*s]; },JAR,11,14,8);
   // 작은 방: 개킨 이불 · 궤
   for (let i=0; i<3; i++) pill([-3.55,FY+.07+i*.12,-2.05],[.5,.06,.33],5,bed[(i+1)%3],13,0,10,6);
   blk(-2.6,-1.8,FY,.78,-2.47,-1.95,[.36,.2,.1],2,0,8);
  },HI);
    /* 문 (문틀 왼쪽 경첩 기준, 열림 = 안쪽으로 회전) */
  bat(()=>{
   blk(0,.9,0,1.83,-.03,.03,[.34,.25,.16],6,0,10);
   for (const y of [.35,1.45]) blk(.04,.86,y,y+.1,-.07,-.03,[.28,.2,.13],6,0,6);
   lathe([.75,.95,.04],v=>[.012,v*.05],IRON,12,6,2);
  },H.map((h,k)=>ins(hw(h,[.15,FY,HD]),h.yaw,2,k,0,h.s)));
    /* 처형 벽: 곰보 자국 벽돌·콘크리트 + 받침 */
  const wp=gy(WALL[0],WALL[1]);
  RECT.push([WALL[0],WALL[1],WALL[2],3.2,.2,2.6]);
  bat(()=>{
   blk(-3.2,3.2,-.3,2.6,-.2,.2,[.5,.48,.44],14,p=>{ p[1]+=.05*sin(p[0]*1.7)*(p[1]>2.4); return p; },18);
   blk(-3.35,3.35,-.3,.25,-.34,.34,[.38,.36,.33],4,wob(.02),6);
  },[ins(wp,WALL[2],3)]);
    /* 구호판 (관리위원회 앞 기둥 위) */
  const bp=gy(0,20.2);
  bat(()=>{
   blk(-3.1,3.1,3.35,4.35,-.06,.06,[.5,.05,.04],10,0,10);
   for (const x of [-2.6,2.6]) lathe([x,-.2,-.12],v=>[.09,v*4.6],WD,9,8,3);
  },[ins(bp,PI,3)]);
  RECT.push([0,20.32,0,2.7,.2,4.6]);
    /* 우물: 돌 테두리 · 기둥 · 도르래 · 두레박 */
  const wl=gy(-9.6,9.4);ROUND.push([wl[0],wl[2],.95]);
  bat(()=>{
   lathe([0,0,0],v=>{ const t=v*4,r=t<1?.82:t<2?.82-.18*(t-1):t<3?.64:.64+.18*(t-3); return [r+.03*sin(v*40),t<1?t*.85:t<2?.85:t<3?.85-(t-2)*.85:0]; },ST2,4,24,8,wob(.02));
   for (const s of [1,-1]) blk(s*.95-.07,s*.95+.07,0,2.2,-.07,.07,WD,2,wob(.01),6);
   tube(v=>[L(-1.05,1.05,v),2.15,0],.06,WD,2,6,4);
   pill([0,2.0,0],[.16,.16,.035],3,[.25,.2,.15],2,0,14,6);
   tube(v=>[.02,L(2.1,1.0,v),.0],.008,[.45,.38,.26],16,4,3);
   lathe([.02,.75,0],v=>[.13+.03*v,v*.25],[.32,.24,.14],2,12,4);
  },[ins(wl,.4,3)]);
    /* 전봇대 · 처진 전선 · 확성기 */
  const P1=gy(9.6,10.6),P2=gy(-12.5,12.8),P3=gy(-30,-6),P4=gy(30,4);
  ROUND.push([P1[0],P1[2],.2],[P2[0],P2[2],.2]);
  const pole=[ins(P1,.3,3),ins(P2,-.2,3),ins(P3,1.3,3),ins(P4,-1.2,3)];
  bat(()=>{
   lathe([0,-.2,0],v=>[.14-.05*v,v*7.6],[.28,.22,.16],9,10,4);
   tube(v=>[L(-.8,.8,v),7,0],.05,WD,2,6,3);
   for (const x of [-.6,.6]) pill([x,7.08,0],[.04,.06,.04],2,[.85,.85,.8],12,0,6,4);
  },pole);
  bat(()=>{ // 확성기 (P1)
   const c=[0,6.2,.2];
   surf(16,6,(u,v)=>{ const r=.05+.3*v**2.2,a=u*2*PI; return [c[0]+r*cos(a),c[1]+r*sin(a),c[2]+v*.55]; },[.45,.47,.43],12);
   tube(v=>[0,6.2,L(0,.25,v)],.04,IRON,12,6,2);
  },[ins(P1,PI*1.15,3)]);
  const wire=(a,b,sag)=>tube(v=>[L(a[0],b[0],v),L(a[1],b[1],v)-sag*4*v*(1-v),L(a[2],b[2],v)],.012,[.05,.05,.05],12,4,16);
  bat(()=>{
   for (const o of [-.6,.6]) {
    wire(V3.add(P1,[o,7.08,0]),V3.add(P2,[o,7.08,0]),.9); wire(V3.add(P2,[o,7.08,0]),V3.add(P3,[o,7.08,0]),1.1); wire(V3.add(P1,[o,7.08,0]),V3.add(P4,[o,7.08,0]),1.1);
   }
   wire(V3.add(P1,[.6,7.08,0]),hw(H[9],[3,2.7,2.8]),.6); wire(V3.add(P2,[-.6,7.08,0]),hw(H[8],[2,2.7,2.8]),.5);
  },[ins([0,0,0],0,3,0,0)],0);
    /* 장독대 (집마다 옆에 3~5개) */
  const JI=[];
  H.forEach((h,k)=>{ if (k>=NH) return; const n=3+(rnd()*3|0); for (let i=0; i<n; i++) { const p=hw(h,[HW+.75+(i%2)*.7+rnd()*.1,0,1.4-(i>>1)*.62]); p[1]=terr(p[0],p[2]); JI.push(ins(p,rnd()*6,3,0,0,.7+rnd()*.5)); } });
  for (const q of JI) ROUND.push([q[12],q[14],.33*hypot(q[0],q[2])]);
  bat(()=>{
   lathe([0,0,0],v=>{ const k=sin(v*PI); return [.1+.26*k**.6+.025*(v>.93),v*.78]; },JAR,11,18,12);
   lathe([0,.79,0],v=>[.18*(1-v*v),.05*v],JAR,11,14,3);
  },JI);
    /* 울타리 (집 사이) · 돌담 (뒤쪽) */
  const FI=[],SW=[];
  for (let k=0; k<NH; k++) {
   const a=H[k],b=H[(k+1)%NH];let pa,pb,d=1e9;
   for (const s of [1,-1]) for (const t of [1,-1]) { const A=hw(a,[s*(HW+.6),0,-.5]),Bq=hw(b,[t*(HW+.6),0,-.5]),e=V3.dist(A,Bq); if (e<d) { d=e; pa=A; pb=Bq; } }
   if (d>14||d<1) continue; const n=Math.ceil(d/2),yaw=atan2(pb[0]-pa[0],pb[2]-pa[2])-PI/2;
   for (let i=0; i<n; i++) { const p=V3.lerp(pa,pb,(i+.5)/n); p[1]=terr(p[0],p[2]); FI.push(ins(p,yaw+(rnd()-.5)*.06,3,0,0,1,0,(rnd()-.5)*.06)); }
   RECT.push([(pa[0]+pb[0])/2,(pa[2]+pb[2])/2,yaw,d/2,.12,1.3]);
  }
  bat(()=>{
   for (const x of [-1,1]) lathe([x,-.1,0],v=>[.055,v*1.45],[.3,.24,.17],9,6,2);
   for (const y of [.45,1.05]) tube(v=>[L(-1.05,1.05,v),y+.02*sin(v*7),.04],.025,[.33,.27,.19],9,5,4);
   for (let i=0; i<12; i++) { const x=-.95+i*.173,hh=1.05+.25*sin(i*2.1)**2; pill([x,hh/2,.08],[.035,hh/2,.015],4,[.36,.3,.21],9,0,6,4); }
  },FI);
  for (let a=0; a<2*PI; a+=.075) { const R=27.5+sin(a*5)*1.2,x=sin(a)*R,z=cos(a)*R; if (abs(a-PI)<.36||H.some(h=>hypot(x-h.c[0],z-h.c[2])<6*h.s)) continue; SW.push(ins(gy(x,z),a,3,0,0,1,0,0)); RECT.push([x,z,a,1.05,.3,.75]); }
  bat(()=>{ for (let i=0; i<7; i++) pill([-.9+i*.3,.18+(i%2)*.05,0],[.2,.22,.32],3.5,ST2,4,wob(.04),8,6); for (let i=0; i<6; i++) pill([-.75+i*.3,.55,.02],[.18,.16,.26],3.5,[.44,.42,.38],4,wob(.04),8,6); },SW);
    /* 나무: 잎 진 활엽수 (광장 가·마을 뒤), 감나무 열매 */
  const TI=[];
  for (let k=0; TI.length<18&&k<400; k++) {
   const a=rnd()*6.283,R=k<60?15.5+rnd()*3:25+rnd()*22,x=sin(a)*R,z=cos(a)*R,s=.9+rnd()*.45;
   if (H.some(h=>hypot(x-h.c[0],z-h.c[2])<7.5*h.s)||abs(x-3*sin(z*.02))<4&&z<0||hypot(x-WALL[0],z-WALL[1])<5||hypot(x+9.6,z-9.4)<3||(R<20&&TI.length>4)) continue;
   TI.push(ins(gy(x,z,-.1),rnd()*6,3,0,0,s)); ROUND.push([x,z,.25*s]);
  }
  bat(()=>{
   const br=(p,d,l,r,lv)=>{
    const e=V3.add(p,V3.mul(d,l)),w=rnd()*6;
    tube(v=>{ const q=V3.lerp(p,e,v); q[0]+=.12*l*sin(v*3+w)*v; q[2]+=.1*l*cos(v*2.5+w)*v; return q; },v=>r*(1-.6*v),[.24,.2,.17],9,lv>1?7:4,lv>1?6:3);
    if (lv>0) for (let i=0; i<(lv>1?4:3); i++) { const a=rnd()*6.28,t=.45+rnd()*.5,q=V3.lerp(p,e,t); br(q,V3.norm([d[0]+sin(a)*.9,d[1]+.35,d[2]+cos(a)*.9]),l*(.45+rnd()*.25),r*.55*(1-t*.5),lv-1); }
    else if (rnd()<.5) pill(e,[.05,.045,.05],2,[.95,.38,.05],8,0,6,4);
   };
   br([0,-.2,0],[0,1,0],4.2,.2,2);
  },TI);
    /* 소나무 (구릉) */
  const PI2=[];
  for (let k=0; k<260; k++) { const a=rnd()*6.283,R=90+rnd()**.7*900,x=sin(a)*R,z=cos(a)*R,so=max(0,-z/R); if (R<L(80,260,so)+rnd()*60) continue; PI2.push(ins(gy(x,z,-.3),rnd()*6,4,0,0,(.8+rnd()*.9)*(1+R/900))); }
  bat(()=>{
   lathe([0,0,0],v=>[.22-.15*v,v*6],[.25,.17,.12],9,6,2);
   for (const [x,y,z,r] of [[0,6.4,0,1.5],[.7,5.2,.3,1.4],[-.6,4.4,-.4,1.5],[.2,3.6,.7,1.2],[-.3,7.4,.2,1]]) pill([x,y,z],[r,r*.55,r],2.2,[.06,.1,.05],8,p=>{ const k=1+.22*sin(p[0]*3.1+p[1]*2)*sin(p[2]*2.7+p[1]); return [p[0]*k,p[1],p[2]*k]; },10,6);
  },PI2,0);
    /* 지면 (극좌표 격자, 3 km) */
  bat(()=>surf(160,120,(u,v)=>{ const r=3200*v**2.4,a=u*2*PI; return gy(sin(a)*r,cos(a)*r); },[1,1,1],0),[[...M4.ident(),0,.5,0,0]],0);
 };
  /* 셰이더 */
 const WGSL=/* wgsl */`
struct U{s:vec4f,d:array<vec4f,12>,f:array<vec4f,12>}; // s: x 불(0..1) y 시간 z LOW / d[k]: x 문 열림 y 집 타는 정도 / f[k]: xyz 지붕 불 위치 w 세기
@group(1)@binding(0)var<uniform>u:U;
@group(1)@binding(1)var ban:texture_2d<f32>;
struct I{@location(0)p:vec3f,@location(1)n:vec3f,@location(2)c:vec3f,@location(3)m:f32,@location(4)a:vec4f,@location(5)b:vec4f,@location(6)d:vec4f,@location(7)e:vec4f,@location(8)t:vec4f};
struct V{@builtin(position)p:vec4f,@location(0)w:vec3f,@location(1)n:vec3f,@location(2)c:vec3f,@location(3)@interpolate(flat)m:f32,@location(4)o:vec3f,@location(5)q:vec3f,@location(6)@interpolate(flat)t:vec4f};
fn tf(i:I,vp:mat4x4f)->V{
var p=i.p;var n=i.n;
if(i.t.x==2.){ // 문: 경첩(원점) 기준 안쪽으로 회전 + 쓰러짐
let k=u.d[i32(i.t.z)].x;let a=k*1.45;
p=vec3f(p.x*cos(a)+p.z*sin(a),p.y-k*(.04+p.x*.12),-p.x*sin(a)+p.z*cos(a));n=vec3f(n.x*cos(a)+n.z*sin(a),n.y,-n.x*sin(a)+n.z*cos(a));}
let M=mat4x4f(i.a,i.b,i.d,i.e);let w=(M*vec4f(p,1.)).xyz;
return V(vp*vec4f(w,1.),w,normalize((M*vec4f(n,0.)).xyz),i.c,i.m,i.p,i.n,i.t);
}
@vertex fn vs(i:I)->V{return tf(i,g.viewProj);}
@vertex fn vsS(i:I)->@builtin(position)vec4f{return tf(i,g.shadowVP).p;}
fn nz(p:vec2f)->f32{return textureSampleLevel(noiseTex,linSamp,p*.0039,0.).x;} // 인자 = 칸/m
fn fd(s:f32,px:f32)->f32{return clamp(s/px*.35-.5,0.,1.);}
fn ln(x:f32,w:f32,px:f32)->f32{return 1.-smoothstep(w,w+px,abs(x));}
fn fireL(P:vec3f,N:vec3f)->vec3f{ // 불타는 지붕 주황빛
var c=vec3f(0.);if(u.s.x<.001){return c;}
for(var k=0;k<12;k++){let f=u.f[k];if(f.w<=0.){continue;}
let v=f.xyz-P;let d2=dot(v,v);c+=f.w*(max(dot(N,v*inverseSqrt(d2)),0.)*.75+.25)/(1.+d2*.09);}
return c*vec3f(1.,.4,.12);
}
fn ground(P:vec3f,N:vec3f,px:f32,ao:ptr<function,f32>)->vec3f{
let r=length(P.xz);let a=nz(P.xz*.011);let b=nz(P.xz*.043+a*.3)*.6+nz(P.xz*.13)*.4;let c=nz(P.xz*.41)*.6+nz(P.xz*1.1)*.4;let e=nz(P.xz*2.3)*.5+nz(P.xz*5.7)*.5;
let hf=mix(.5,c,fd(1.,px))*.6+mix(.5,e,fd(.12,px))*.4;
// 흙 광장: 다져진 회갈색 흙 + 바퀴 자국
var dirt=mix(vec3f(.33,.29,.24),vec3f(.43,.37,.3),b)*(.8+.4*hf);
dirt=mix(dirt,vec3f(.25,.21,.17),smoothstep(.62,.8,nz(P.xz*.09+4.))*.7); // 젖은 얼룩
dirt*=1.-.18*smoothstep(.7,.9,nz(P.xz*.8+2.))*fd(.3,px); // 발자국·패임
let rx=P.x-3.*sin(P.z*.02);let rd=smoothstep(3.2,2.2,abs(rx))*smoothstep(-10.,-15.,P.z);
let rut=ln(abs(rx)-.8,.18,px*2.)*rd;dirt*=1.-.25*rut;
// 마른 풀 (마당·둑)
let grass=mix(vec3f(.3,.25,.13),vec3f(.4,.33,.18),c)*(.75+.5*hf);
var al=mix(dirt,grass,smoothstep(.45,.75,b*.6+smoothstep(14.,24.,r)*.6)*(1.-rd));
// 논: 그루터기 줄 + 논둑 격자 (남쪽)
let fz=smoothstep(42.,60.,r)*(1.-smoothstep(260.,420.,r))*(1.-rd);
if(fz>0.){
let q=vec2f(P.x+P.z*.3,P.z-P.x*.3);let cell=fract(q/vec2f(18.,11.));
let bd=max(ln(cell.x-.5,.46,px/18.),ln(cell.y-.5,.45,px/11.));
let rows=.5+.5*sin(q.x*21.)*fd(.3,px);
var fl=mix(vec3f(.36,.29,.17),vec3f(.25,.19,.12),smoothstep(.4,.7,nz(q*.05)))*(.85+.25*rows);
fl=mix(fl,vec3f(.2,.17,.12),smoothstep(.55,.75,nz(q*.02+5.))*.6); // 젖은 흙
al=mix(al,mix(fl,grass*.9,1.-bd),fz);
}
// 구릉·산: 마른 풀 · 바위 · 먼 산 푸른빛
let hz=smoothstep(150.,400.,r);
let rock=smoothstep(.85,.7,N.y);
al=mix(al,mix(mix(vec3f(.27,.22,.13),vec3f(.18,.17,.11),a),vec3f(.3,.29,.27)*(.7+.4*c),rock),hz);
*ao=1.;
return al;
}
@fragment fn fs(i:V)->@location(0)vec4f{
let P=i.w;let o=i.o;let m=i.m;let px=length(fwidth(P))+1e-4;let pt=i.t.x;
let E=normalize(g.cam.xyz-P);var N=normalize(i.n);let bk=dot(N,E)<0.;if(bk){N=-N;}
let hk=i32(i.t.z);let burn=select(0.,u.d[hk].y,pt==1.);
var al=i.c;var gl=.03;var em=vec3f(0.);var ao=1.;
// 실내 판정 (집 공간): 벽 중심선 안쪽 · 천장 아래
let inn=pt==1.&&abs(o.x)<${HW-.07}&&abs(o.z)<${HD-.07}&&o.y<2.41&&o.y>.25;
let tq=vec2f(o.x+o.z*.83,o.y);
if(m==0.){al=ground(P,N,px,&ao);}
else if(m==1.){ // 회벽 / 실내 벽지
let n=nz(tq*.37)*.45+nz(tq*1.3)*.35+nz(tq*4.1)*.2*fd(.25,px);
if(inn){al=vec3f(.66,.6,.47)*(.88+.2*n);al*=1.-.18*smoothstep(.9,.35,o.y);
if(o.y>2.39){al=vec3f(.5,.45,.36);}}
else{
al*=.82+.3*n;
let st=nz(vec2f(tq.x*2.3,tq.y*.1+.3));al*=1.-.3*smoothstep(.45,.9,st)*smoothstep(1.,2.4,o.y);
al=mix(al,vec3f(.27,.2,.14),(1.-smoothstep(.2,.75+.3*n,o.y))*.65);
let pe=smoothstep(.62,.66,nz(tq*.33+7.)*.65+n*.35);al=mix(al,vec3f(.36,.27,.18)*(.75+.35*nz(tq*7.)),pe);
let cr=abs(nz(vec2f(tq.x*.21,tq.y*.09)+3.)-.5)+.06*nz(tq*1.7);al*=1.-.45*ln(cr-.03,.004,px*.5)*fd(.02,px)*step(.55,nz(tq*.13+9.));
al*=1.-.7*burn*smoothstep(1.2,2.6,o.y+.5*nz(tq*.8));
}
}
else if(m==2.||m==6.||m==9.){ // 나무 · 문 · 껍질
let gq=select(vec2f(o.x+o.z,o.y),vec2f(o.y,o.x+o.z),abs(i.q.y)>.5);
let gr=nz(vec2f(gq.x*.6,gq.y*9.))*.6+nz(vec2f(gq.x*2.,gq.y*30.))*.4*fd(.03,px);
al*=.7+.5*gr;
if(m==6.){al*=1.-.45*ln(fract(o.x/.15+.5)-.5,.03,px/.15);al*=.8+.3*nz(o.xy*vec2f(2.,.3));}
if(m==9.){al*=.75+.4*nz(vec2f(atan2(o.x,o.z)*2.,o.y*1.5));}
}
else if(m==3.){ // 지붕: 시멘트 기와 / 녹슨 함석
let fr=abs(i.q.z)>abs(i.q.x);let along=select(o.z,o.x,fr);let sl=select(o.x,o.z,fr);
let n=nz(o.xz*.7);
if(i.t.y<.45){
let rp=sin(along*20.9);al=vec3f(.34,.34,.33)*(.8+.3*n)*(.82+.18*rp*fd(.3,px));
al*=1.-.4*ln(fract(sl/.36)-.08,.05,px/.36)*fd(.36,px);
al=mix(al,vec3f(.24,.26,.16),smoothstep(.6,.8,nz(o.xz*.5+3.))*.6);
}else{
let rp=sin(along*82.);al=mix(vec3f(.36,.2,.11),vec3f(.44,.43,.41),smoothstep(.35,.65,n+nz(o.xz*4.)*.25))*(.85+.2*rp*fd(.076,px));gl=.12;
al*=1.-.4*ln(fract(along/.9)-.5,.01,px/.9);
}
let ch=smoothstep(.0,.6,burn*(1.2+.5*nz(o.xz*.9))-.2);al=mix(al,vec3f(.025,.022,.02),ch);
em+=vec3f(1.,.32,.06)*smoothstep(.5,.8,nz(o.xz*.9+g.cam.w*.4))*ch*(1.+.7*sin(g.cam.w*9.+o.x*3.))*2.2*burn;
}
else if(m==4.){al*=.7+.45*nz(o.xz*1.7+o.y)*nz(o.xy*.9+o.z);al=mix(al,vec3f(.26,.27,.18),smoothstep(.65,.8,nz(o.xz*2.))*.4);}
else if(m==5.){ // 장판: 노란 니스 종이 + 이음매, 광택
let q=o.xz/.9;let c=fract(q+vec2f(.5,0.));
al*=.82+.25*nz(o.xz*1.3);al*=1.-.35*max(ln(c.x-.5,.465,px/.9),ln(c.y-.5,.465,px/.9))*fd(.2,px);
let b=min(${HW}-abs(o.x),${HD}-abs(o.z));al*=.75+.25*smoothstep(0.,.5,b);gl=.35;
if(o.x>1.8&&o.z<-.6){al=vec3f(.24,.19,.14)*(.7+.5*nz(o.xz*3.));gl=.02;}
}
else if(m==7.){ // 창호지 + 살
let c=fract(vec2f(o.x/.2,o.y/.22));
let lat=max(ln(c.x-.5,.44,px/.2),ln(c.y-.5,.43,px/.22));
let rip=step(.88,nz(floor(vec2f(o.x/.2,o.y/.22))*.37+i.t.y*9.));
al=mix(vec3f(.78,.74,.64)*(.85+.2*nz(o.xy*4.)),vec3f(.16,.11,.07),1.-lat);
let day=skyBase(vec3f(0.,.4,1.))*1.1+g.sunCol.rgb*.12;
if(dot(normalize(i.n)*sign(o.z),E)<0.){em=day*(1.-rip)*lat*.55*al;al*=.5;}
if(rip>.5){al=vec3f(.03);}
}
else if(m==8.){al*=.7+.6*nz(o.xz*3.+o.y);}
else if(m==10.){ // 구호판
let uv=vec2f(o.x/6.2+.5,(4.35-o.y));
let t=textureSampleLevel(ban,linSamp,uv,0.);
al=mix(vec3f(.42,.03,.025)*(.8+.3*nz(o.xy*2.)),t.rgb,t.a);if(bk){al=vec3f(.2,.18,.15);}
al*=1.-.3*smoothstep(.6,.85,nz(o.xy*vec2f(1.,.2)));
}
else if(m==11.){al*=.85+.25*nz(vec2f(atan2(o.x,o.z)*3.,o.y*.6));gl=.45;al=mix(al,vec3f(.3,.27,.22),smoothstep(.55,.8,nz(o.xz*4.+o.y))*.5);}
else if(m==12.){gl=.25;al*=.8+.4*nz(o.xy*5.);}
else if(m==13.){al*=.8+.3*nz(o.xz*6.+o.y*3.);al*=.9+.1*sin(o.x*40.)*fd(.025,px);}
else if(m==14.){ // 처형 벽: 콘크리트·벽돌, 총탄 자국
let q=o.xy;let n=nz(q*.8)*.6+nz(q*4.)*.4;
al=mix(vec3f(.5,.48,.44),vec3f(.43,.27,.2),smoothstep(.55,.62,nz(q*.4+2.)));
let br=fract(vec2f(q.x/.24+.5*floor(q.y/.08),q.y/.08));al*=1.-.2*max(ln(br.x-.5,.46,px/.24),ln(br.y-.5,.4,px/.08))*smoothstep(.55,.62,nz(q*.4+2.))*fd(.08,px);
al*=.78+.35*n;
let cl=floor(q/.11);let h=hash21(cl);let f=fract(q/.11)-.5;let band=smoothstep(.5,1.,o.y)*smoothstep(2.2,1.6,o.y);
let pk=step(1.-.35*band,h);let d=length(f+(hash21(cl+7.)-.5)*.4);
al=mix(al,al*1.25,pk*ln(d-.24,.05,px/.11));al*=1.-pk*.75*smoothstep(.2,.05,d);
al*=1.-.35*smoothstep(.5,.85,nz(vec2f(q.x*1.5,q.y*.12)))*smoothstep(.0,.8,o.y);
}
else if(m==15.){al*=.85+.3*nz(o.yz*2.);}
else if(m==16.){gl=.1;}
// 접지 AO: 벽 바닥·처마 밑
if(pt==1.&&!inn){ao=mix(.55,1.,smoothstep(.15,.9,o.y))*select(1.,.6,o.y>2.45&&N.y<-.3);}
if(pt==3.||pt==4.){ao=mix(.6,1.,smoothstep(0.,.5,o.y));}
let Ls=g.sun.xyz;let nl=max(dot(N,Ls),0.);let nv=max(dot(N,E),0.);
let sv=shadowAt(P,N)*mix(.35,1.,cloudVis(P));
var c:vec3f;
if(inn){ // 실내: 창·문으로 드는 낮빛 (집 공간에서 계산)
let Nl=normalize(select(i.q,-i.q,bk));let sb=skyBase(vec3f(0.,.35,1.));let day=mix(sb,vec3f(1.,.82,.6)*dot(sb,vec3f(.33)),.6)*1.5+g.sunCol.rgb*.12;
var e=vec3f(.02)+day*.06;
let dor=.3+.7*u.d[hk].x;
for(var j=0;j<5;j++){
var O=vec3f(.6,1.2,2.75);var A=3.2*dor;
if(j==1){O=vec3f(-2.8,1.45,2.7);A=.9;}if(j==2){O=vec3f(2.6,1.45,2.7);A=.9;}if(j==3){O=vec3f(-.2,1.5,-2.7);A=.9;}if(j==4){O=vec3f(-2.75,1.5,-2.7);A=.9;}
let v=O-o;let d=length(v);let fz=max(sign(O.z)*v.z/d,0.);
e+=day*A*(max(dot(Nl,v/d),0.)*.8+.2)*fz/(d*d+.4);
}
let sI=sv*step(.5,g.sunCol.w);
c=al*(e*ao+g.sunCol.rgb*nl*sI+ambAt(N)/mix(1.,.12,g.wind.w)*.05+pointLights(P,N)+fireL(P,N)*.25)+gl*e*pow(1.-nv,4.)*.6;
}else{
let R=reflect(-E,N);let sp=10.+250.*gl*gl;
c=al*(g.sunCol.rgb*nl*sv+ambAt(N)/mix(1.,.12,g.wind.w)*ao+pointLights(P,N)+fireL(P,N));
c+=g.sunCol.rgb*sv*pow(max(dot(N,normalize(Ls+E)),0.),sp)*gl*(sp+8.)*.03*min(nl*8.,1.);
c=mix(c,skyBase(vec3f(R.x,abs(R.y),R.z))*ao*.7,gl*(.04+.96*pow(1.-nv,5.))*.6);
}
// 연기 낀 대기 (마을이 탈 때)
let sm=u.s.x*(1.-exp(-length(P-g.cam.xyz)*.012));c=mix(c,vec3f(.09,.06,.05),sm*.55);
return vec4f(fogAt(c+em,P),1.);
}`;
  /* GPU */
 let mod,bgl,bg,vb,xb,ib,ub,tex,ms,pipe,pipeS;
 const UB=new Float32Array(100);
 const mkp=(vs,fs,o)=>G.dev.createRenderPipeline({
  layout: G.layout(bgl),vertex: { module: mod,entryPoint: vs,buffers: [
   { arrayStride: 40,attributes: [[0,0,'x3'],[1,12,'x3'],[2,24,'x3'],[3,36,'']].map(([l,o,f])=>({ shaderLocation: l,offset: o,format: 'float32'+f })) },
   { arrayStride: 80,stepMode: 'instance',attributes: [4,5,6,7,8].map((l,i)=>({ shaderLocation: l,offset: i*16,format: 'float32x4' })) }] },
  fragment: fs?{ module: mod,entryPoint: fs,targets: [{ format: G.HDR }] }:undefined,primitive: { cullMode: 'none' },...o });
 const run=(p,pl,sh)=>{
  if (!vb||!pl) return;
  p.setPipeline(pl); p.setBindGroup(1,bg); p.setVertexBuffer(0,vb); p.setVertexBuffer(1,ib); p.setIndexBuffer(xb,'uint32');
  for (const b of B) if (!sh||b.fl&1) p.drawIndexed(b.n,G.Q.level||b.c<200?b.c:b.c>>1,b.i0,0,b.f);
 };
 const banner=()=>{ // 구호판 글자 (가상의 일반 구호)
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=164; const x=cv.getContext('2d');
  x.fillStyle='rgba(0,0,0,0)'; x.clearRect(0,0,1024,164);
  x.strokeStyle='#e8d9a0'; x.lineWidth=6; x.strokeRect(14,14,996,136);
  x.fillStyle='#f3e6b0'; x.textAlign='center'; x.textBaseline='middle';
  x.font='bold 84px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR","NanumGothic",sans-serif';
  x.fillText('위대한 령도자를 따라 앞으로!',512,86,960);
  return x.getImageData(0,0,1024,164).data;
 };
 // 불: 지붕 위치별 fx 'fire' 궤적 (가까운 순 몇 개만) + 셰이더 주황빛 + 점광 1
 const burn=new Float32Array(16),TH=H.map((_,k)=>k<NH?.08+((k*5)%NH)/NH*.55:.5);
 let near=[],nt=0,smk=0;
 G.register('village',{
  init() {
   const dev=G.dev,U=GPUBufferUsage,T=GPUTextureUsage,S2=GPUShaderStage,buf=(a,usage)=>{ const b=dev.createBuffer({ size: a.byteLength,usage: usage|U.COPY_DST }); dev.queue.writeBuffer(b,0,a); return b; };
   try { build(); } catch (e) { G.err('village build '+(e.stack||e)); }
   vb=buf(new Float32Array(V),U.VERTEX); xb=buf(new Uint32Array(X),U.INDEX); ib=buf(new Float32Array(IN),U.VERTEX); ub=buf(UB,U.UNIFORM); V=X=IN=0;
   tex=dev.createTexture({ size: [1024,164],format: 'rgba8unorm',usage: T.TEXTURE_BINDING|T.COPY_DST });
   try { dev.queue.writeTexture({ texture: tex },banner(),{ bytesPerRow: 4096 },[1024,164]); } catch (e) { G.err('village banner '+e); }
   bgl=dev.createBindGroupLayout({ entries: [{ binding: 0,visibility: S2.VERTEX|S2.FRAGMENT,buffer: {} },{ binding: 1,visibility: S2.FRAGMENT,texture: {} }] });
   bg=dev.createBindGroup({ layout: bgl,entries: [{ binding: 0,resource: { buffer: ub } },{ binding: 1,resource: tex.createView() }] });
   mod=G.shader(WGSL,'village');
   pipeS=mkp('vsS',null,{ depthStencil: { format: G.DEPTH,depthWriteEnabled: true,depthCompare: 'less',depthBias: 2,depthBiasSlopeScale: 2 } });
  },
  onQuality({ msaa: n }) {
   if (n==ms) return; ms=n;
   pipe=mkp('vs','fs',{ multisample: { count: n },depthStencil: { format: G.DEPTH,depthWriteEnabled: true,depthCompare: 'greater' } });
  },
  update(dt) {
   if (!VL.on) return;
   try {
    const t=G.time,f=cl(+S.fire||0,0,1);
    // 문
    for (let i=0; i<NH; i++) {
     if (!S.doors[i]) { DA[i]=0; DT[i]=-1; continue; }
     if (DT[i]<0) { DA[i]=1; continue; }
     const u=DT[i]+=dt; DA[i]=u<.16?(u/.16)**2:1+.1*sin((u-.16)*22)*Math.exp(-(u-.16)*7);
    }
    // 불: 집별 타는 정도
    for (let k=0; k<H.length; k++) burn[k]=cl((f-TH[k])*2.2,0,1);
    UB[0]=f; UB[1]=t; UB[2]=G.Q.level;
    for (let k=0; k<12; k++) {
     UB[4+k*4]=DA[k]||0; UB[5+k*4]=burn[k]||0;
     const h=H[k],o=52+k*4;
     if (!h||!burn[k]) { UB[o+3]=0; continue; }
     const p=hw(h,[0,3.6,0]); UB[o]=p[0]; UB[o+1]=p[1]; UB[o+2]=p[2];
     UB[o+3]=burn[k]*(5+1.5*sin(t*11+k)+sin(t*23+k*3));
    }
    if (f>0) {
     if ((nt-=dt)<=0) { nt=.5; const c=G.cam.pos; near=VL.K.fires.map((p,i)=>[i,V3.dist(p,c)]).filter(q=>burn[q[0]>>1]>0).sort((a,b)=>a[1]-b[1]).slice(0,[2,7,12][G.Q.level]).map(q=>q[0]); }
     const n0=G.lights.length;
     for (const i of near) { const b=burn[i>>1]; b>0&&G.fx.trail(VL.K.fires[i],[0,1,0],'fire',dt*b*.55); }
     G.lights.length=n0; // fx 불 점광(반경 수백 m)은 빼고 아래 점광 하나만
     if (near.length) { const p=VL.K.fires[near[0]]; G.addLight([p[0],p[1]+1,p[2]],[1,.45,.15],(4+1.5*sin(t*13))*burn[near[0]>>1],22,dt*1.5); }
    } else if ((smk-=dt)<=0&&G.fx) { // 아침 굴뚝 연기
     smk=.9; const h=H[[1,4,8][(t*7|0)%3]],p=hw(h,[HW+.6,3.7,-1.6]); G.fx.burst('smoke',p,{ size: .16,vel: [.25,.5,.1] });
    }
   } catch (e) { G.err('[village] '+(e.stack||e)); }
  },
  prepare() { VL.on&&ub&&G.dev.queue.writeBuffer(ub,0,UB); },
  shadow(p) { VL.on&&run(p,pipeS,1); },
  opaque(p) { VL.on&&run(p,pipe,0); }
 },'story');
}
