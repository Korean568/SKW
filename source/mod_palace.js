'use strict';
/* PALACE — 스토리 3 주석궁 내부 (저녁). 월드 공간, 바닥 y=0. 회의실 중심 = 원점, 출구는 +Z 쪽 */
{
 const PL=G.palace={ on: false,K: null,S: { doors: { meet: 0,office: 0,side: [],auto: 1 },lamps: 2 } },S=PL.S;
 const { sin,cos,abs,hypot,PI,min,max,atan2,floor }=Math,L=G.lerp,cl=G.clamp,sm=(a,b,x)=>{ x=cl((x-a)/(b-a),0,1); return x*x*(3-2*x); };
 const rnd=G.rng(31);
  /* 평면도: 방 [x0,x1,z0,z1,천장] */
 const RM={ meet: [-6.5,6.5,-11,11,7.2],c1: [-12,26,11.4,16,5.4],sp: [14,17.5,16,24,4.6],hall: [4,34,24,44,10],c2: [17,21,44,60,5],office: [12,26,60.4,72,5.2] };
 // 걷는 영역 (문간은 양쪽 방으로 넉넉히 겹침, 마지막 값 = 문이 열려야 통과)
 const WR=[[...RM.meet],[-1.3,1.3,10,12.6,0,'meet'],[...RM.c1],[14,17.5,15,25],[...RM.hall],[17,21,43,60],[18,20,59,61.6,0,'office'],[...RM.office]];
 // 계단 (홀 동쪽): x 26→32 오름, z 30..38, 층계참 x 32..34 높이 4.2
 const ST={ x0: 26,x1: 32,z0: 30,z1: 38,h: 4.2,n: 16 };
 const stairH=(x,z)=>z>ST.z0&&z<ST.z1&&x>ST.x0?(x>=ST.x1?ST.h:min(ST.h,(floor((x-ST.x0)/(ST.x1-ST.x0)*ST.n)+1)*ST.h/ST.n)):0;
 const yawTo=(a,b)=>atan2(b[0]-a[0],b[2]-a[2]);
  /* 계약 키 포인트 */
 const SEATZ=[-5.4,-3.5,-1.6,.3,2.2,4.1],SEATS=[];
 for (const z of SEATZ) SEATS.push([-1.78,.47,z,PI/2],[1.78,.47,z,-PI/2]);
 const KO=[15.75,0,18.6],OFC=[19,0,66];
 PL.K={
  meet: { centre: [0,0,-.5],seats: SEATS,head: [0,.47,-7.95,0],doors: [0,0,11.2,0] },
  path: [[0,0,10.3],[0,0,12.7],[7,0,13.6],[15.75,0,13.8],[15.75,0,18.6],[15.75,0,24.6],[17.4,0,31],[19,0,37.5],[19,0,43.5],[19,0,50],[19,0,57],[19,0,60.2]],
  ko: [...KO,PI],
  spawns: [[25.2,0,13.7,-PI/2],[19,0,12.2,0],[16.9,0,21,-PI/2],[4.8,0,30,PI/2],[4.8,0,38,PI/2],[23.3,0,40.2,PI],[11.7,0,40.2,PI],[33,4.2,34,-PI/2],[8,0,30.2,PI/2],[17.7,0,49,PI/2],[20.3,0,55,-PI/2],[22.6,0,29,-PI/2]],
  office: { door: [19,0,60.2,0],centre: OFC,desk: [19,0,68.5,PI],kneel: [19,0,64.3,0],ok: [19,0,66.5,PI],
   ambush: [[17.1,0,61.1,PI*.75],[20.9,0,61.1,-PI*.75],[24.9,0,62.2,-PI/2],[13.1,0,70.6,PI*.75]] },
  storm: [[-5.7,0,-8.6,PI/2],[5.7,0,-8.6,-PI/2],[-5.7,0,8.2,PI/2],[5.7,0,8.2,-PI/2],[-.8,0,10.3,PI],[.8,0,10.3,PI]],
  lamps: []
 };
  /* 문: 0·1 회의실 양문, 2·3 집무실 양문, 4.. 옆문 (중심, 방 쪽 방향 yaw, 높이) */
 const SD=[[-6.5,-8.6,PI/2],[6.5,-8.6,-PI/2],[-6.5,8.2,PI/2],[6.5,8.2,-PI/2],[-8,11.4,0],[7,11.4,0],[19,11.4,0],[-12,13.7,PI/2],[26,13.7,-PI/2],[17.5,21,-PI/2],[4,30,PI/2],[4,38,PI/2],[34,34,-PI/2,ST.h],[17,49,PI/2],[21,55,-PI/2]];
 const ND=4+SD.length,DA=new Float32Array(24),DT=new Float32Array(24);
 for (let i=0; i<SD.length; i++) S.doors.side[i]=0;
  /* 조명 (자체 유니폼, 16개): [x,y,z,반경, r,g,b] */
 const WARM=[1,.74,.46];
 const LT=[[0,5.25,-4.6,15,2.4],[0,5.25,4.6,15,2.4],[0,4.2,-10.3,7,.5],[-6,3.1,11.8,8,.9],[4,3.1,15.6,8,.9],[11,3.1,11.8,8,.9],[22,3.1,15.6,8,.9],[15.75,4.1,20,8,.8],
  [17,7.2,34,20,3],[4.5,3.4,34,9,.9],[33.5,6.6,34,10,.9],[19,4.6,48,8,.9],[19,4.6,55.5,8,.9],[19,4.7,65,11,1.4],[19.75,1.12,68.25,4.5,.55],[12.4,3,67,7,.6]];
 PL.K.lamps=LT.map(l=>[l[0],l[1],l[2],...WARM,l[4]]);
  /* 충돌 장애물: 상자 [x0,x1,z0,z1,y1] · 원 [x,z,r] */
 const OB=[[-1.25,1.25,-7.2,6.2,.8],[17.35,20.65,67.85,69.15,.8],[12.3,13.45,62.4,66.6,.95],[25.5,26.1,61.6,71.6,2.6],[12,12.55,68.8,71.6,2.6],
  [26.3,34,29.75,30.15,5.2],[26.3,34,37.85,38.25,5.2]];
 const OR=[[23.6,69.3,.42],[13.8,70.9,.3]];
 const PIL=[]; for (const x of [8,12.5,22.5]) for (const z of [29.5,38.5]) { PIL.push([x,z]); OB.push([x-.62,x+.62,z-.62,z+.62,10]); }
 const PLS=[]; // 복도 벽기둥 [x,z,yaw]
 for (const x of [-10,-4,2,9,13,21,25]) { PLS.push([x,11.4,0]); if (x<13.6||x>18) PLS.push([x,16,PI]); }
 for (const z of [47,52.5,57]) PLS.push([17,z,PI/2],[21,z,-PI/2]);
 for (const p of PLS) { const ax=abs(sin(p[2]))>.5; OB.push(ax?[p[0]-.3,p[0]+.3,p[1]-.4,p[1]+.4,5.4]:[p[0]-.4,p[0]+.4,p[1]-.3,p[1]+.3,5.4]); }
 // 광선 전용 상자 (의자·계단 덩어리)
 const RB=[];
 for (const s of SEATS) RB.push([s[0]-.3,s[0]+.3,0,1.3,s[2]-.3,s[2]+.3]);
 for (let k=0; k<4; k++) RB.push([ST.x0+k*1.5,34,0,(k+1)*1.05,ST.z0+.1,ST.z1-.1]);
 const open=w=>!w[5]||S.doors[w[5]]>.5;
 const pushBox=(p,r,b)=>{
  const cx=cl(p[0],b[0],b[1]),cz=cl(p[1],b[2],b[3]),dx=p[0]-cx,dz=p[1]-cz,d=hypot(dx,dz);
  if (d>=r) return;
  if (d>1e-6) { p[0]=cx+dx/d*r; p[1]=cz+dz/d*r; }
  else { const a=[p[0]-b[0],b[1]-p[0],p[1]-b[2],b[3]-p[1]],k=a.indexOf(min(...a)); p[k>>1]+=(k&1?1:-1)*(a[k]+r); }
 };
 const inside=(x,z,r)=>{ // 가장 가까운 걷는 영역 안 점
  let bx=x,bz=z,bd=1e9;
  for (const w of WR) {
   if (!open(w)) continue;
   const qx=cl(x,w[0]+r,w[1]-r),qz=cl(z,w[2]+r,w[3]-r),d=hypot(qx-x,qz-z);
   if (d<bd) { bd=d; bx=qx; bz=qz; if (d===0) break; }
  }
  return [bx,bz];
 };
 PL.ground=(x,z)=>stairH(x,z);
 PL.collide=(p,r=.3)=>{
  let q=inside(p[0],p[2],r);const y=p[1]||0;
  for (const b of OB) if (y<b[4]-.3&&!(b[4]>4.9&&b[0]>26&&q[0]>ST.x0&&q[1]>ST.z0&&q[1]<ST.z1&&false)) pushBox(q,r,b);
  for (const c of OR) { const dx=q[0]-c[0],dz=q[1]-c[1],d=hypot(dx,dz),m=c[2]+r; if (d<m&&d>1e-6) { q[0]=c[0]+dx/d*m; q[1]=c[1]+dz/d*m; } }
  q=inside(q[0],q[1],r);
  return [q[0],stairH(q[0],q[1]),q[1]];
 };
 PL.room=p=>{
  const x=p[0],z=p[2],In=b=>x>=b[0]&&x<=b[1]&&z>=b[2]&&z<=b[3];
  return In(RM.meet)?'meet':In(RM.hall)?'hall':In(RM.office)?'office':In(RM.c1)||In(RM.sp)||In(RM.c2)?'corridor':'';
 };
 const slab=(o,d,b,t)=>{ // 광선-상자 [x0,x1,y0,y1,z0,z1]
  let s0=0,s1=t;
  for (let i=0; i<3&&s0<=s1; i++) { const v=1/(d[i]||1e-9),e=(b[i*2]-o[i])*v,f=(b[i*2+1]-o[i])*v; s0=max(s0,min(e,f)); s1=min(s1,max(e,f)); }
  return s0<=s1&&s0>1e-4?s0:t;
 };
 const SP3=[...Object.values(RM).map(r=>[r[0],r[1],0,r[4],r[2],r[3]]),[-1.3,1.3,0,4.2,10.8,11.6,'meet'],[18,20,0,3.4,59.8,60.6,'office'],[14,17.5,0,4.6,15.8,16.2],[14,17.5,0,4.6,23.8,24.2],[17,21,0,5,43.8,44.2]];
 PL.ray=(o,d,mx=200)=>{
  let t=0;
  for (let it=0; it<14&&t<mx; it++) { // 방 상자 합집합 안에서 나가는 지점
   const p=[o[0]+d[0]*(t+1e-3),o[1]+d[1]*(t+1e-3),o[2]+d[2]*(t+1e-3)];let e=-1;
   for (const b of SP3) {
    if (b[6]&&S.doors[b[6]]<.5) continue;
    if (p[0]<b[0]||p[0]>b[1]||p[1]<b[2]||p[1]>b[3]||p[2]<b[4]||p[2]>b[5]) continue;
    let te=1e9; for (let i=0; i<3; i++) { const v=d[i]; if (v>1e-9) te=min(te,(b[i*2+1]-p[i])/v); else if (v<-1e-9) te=min(te,(b[i*2]-p[i])/v); }
    e=max(e,t+1e-3+te);
   }
   if (e<0) break; t=e;
  }
  t=min(t,mx);
  for (const b of OB) t=min(t,slab(o,d,[b[0],b[1],0,b[4],b[2],b[3]],t));
  for (const b of RB) t=min(t,slab(o,d,b,t));
  for (const c of OR) t=min(t,slab(o,d,[c[0]-c[2]*.8,c[0]+c[2]*.8,0,1.3,c[1]-c[2]*.8,c[1]+c[2]*.8],t));
  return t;
 };
  /* 형상 (마을 모듈과 같은 형식): 정점 10 float / 인스턴스 20 float */
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
 const pill=(c,h,e,col,m,w,nu=12,nv=8)=>surf(nu,nv,(u,v)=>{
  const a=u*2*PI,b=(v-.5)*PI,k=sp(cos(b),e),p=[c[0]+h[0]*k*sp(cos(a),e),c[1]+h[1]*sp(sin(b),e),c[2]+h[2]*k*sp(sin(a),e)];
  return w?w(p):p;
 },col,m,1);
 const blk=(x0,x1,y0,y1,z0,z1,col,m,e=16,nu=16,nv=10,w)=>pill([(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],[(x1-x0)/2,(y1-y0)/2,(z1-z0)/2],e,col,m,w,nu,nv);
 const bx=(x0,x1,y0,y1,z0,z1,col,m)=>blk(x0,x1,y0,y1,z0,z1,col,m,24,8,4); // 저해상 상자 (책 등)
 const lathe=(c,prof,col,m,nu=16,nv=12,w)=>surf(nu,nv,(u,v)=>{ const [r,y]=prof(v),a=u*2*PI,p=[c[0]+r*cos(a),c[1]+y,c[2]+r*sin(a)]; return w?w(p):p; },col,m,1);
 const tube=(f,r,c,m,n=6,nv=5)=>surf(n,nv,(u,v)=>{ const t=V3.norm(V3.sub(f(v+.01),f(v-.01))),a=V3.norm(V3.cross(t,abs(t[1])>.9?[1,0,0]:[0,1,0])),b=V3.cross(t,a),k=u*2*PI,rr=r.call?r(v):r; return V3.add(f(v),V3.add(V3.mul(a,rr*cos(k)),V3.mul(b,rr*sin(k)))); },c,m);
 const quad=(o,ex,ey,c,m,nu=1,nv=1)=>surf(nu,nv,(u,v)=>[o[0]+ex[0]*u+ey[0]*v,o[1]+ex[1]*u+ey[1]*v,o[2]+ex[2]*u+ey[2]*v],c,m);
 const ins=(p,yaw=0,part=3,flag=0,w=0,s=1)=>[...M4.trs(p,yaw,0,0,s),part,rnd(),flag,w];
 const bat=(fn,I,fl=1)=>{ const i0=X.length; fn(); const b={ i0,n: X.length-i0,f: IN.length/20,c: I.length,fl }; for (const q of I) IN.push(...q); B.push(b); return b; };
 const ONE=[ins([0,0,0],0,1)];
 // 색
 const MB=[.8,.77,.7],MD=[.2,.19,.2],WD=[.24,.12,.06],GD=[.85,.62,.28],RED=[.36,.03,.04],LEA=[.13,.07,.045],BRZ=[.06,.05,.04],CRM=[.7,.66,.58],SILK=[.55,.47,.34];
  /* 벽: 축 'x' (z=c 고정) / 'z' (x=c 고정), 구멍 [a,b,윗변] */
 const wall=(ax,c,a0,a1,h,holes,col,m)=>{
  const q=(a,b,y0,y1)=>{ if (b-a<.01||y1-y0<.01) return; surf(1,1,(u,v)=>ax==='x'?[L(a,b,u),L(y0,y1,v),c]:[c,L(y0,y1,v),L(a,b,u)],col,m); };
  let s=a0; for (const [a,b,t] of holes.slice().sort((p,r)=>p[0]-r[0])) { q(s,a,0,h); q(a,b,t,h); s=b; } q(s,a1,0,h);
 };
 // 걸레받이 · 코니스 (벽을 따라 둥근 띠)
 const band=(ax,c,a0,a1,y0,y1,d,dir,col,m,holes=[])=>{
  let s=a0; const seg=(a,b)=>{ if (b-a<.05) return; ax==='x'?blk(a,b,y0,y1,c-d*(dir<0),c+d*(dir>0),col,m,10,12,6):blk(c-d*(dir<0),c+d*(dir>0),y0,y1,a,b,col,m,10,12,6); };
  for (const [a,b,t] of holes.slice().sort((p,r)=>p[0]-r[0])) { if (t>y0) { seg(s,a); s=b; } } seg(s,a1);
 };
 // 문틀 (방 쪽 면에 금테 + 대리석 몰딩). 지역좌표: 원점 = 문 아래 중앙, +Z = 방 쪽
 const frame=(w,h,col=MB,m=1,ped)=>{
  blk(-w/2-.3,-w/2,0,h+.3,-.05,.14,col,m,10); blk(w/2,w/2+.3,0,h+.3,-.05,.14,col,m,10);
  blk(-w/2-.42,w/2+.42,h+.3,h+.55,-.05,.2,col,m,10); blk(-w/2-.34,w/2+.34,h+.55,h+.62,-.05,.26,GD,4,10);
  blk(-w/2-.05,-w/2+.02,0,h,-.05,.16,GD,4,8); blk(w/2-.02,w/2+.05,0,h,-.05,.16,GD,4,8);
  if (ped) { surf(14,2,(u,v)=>{ const x=L(-w/2-.55,w/2+.55,u); return [x,h+.62+v*.0+(1-abs(u*2-1))*.55*(1-v*.0)+.0,.08+v*.14]; },col,m); blk(-w/2-.55,w/2+.55,h+.62,h+.72,-.05,.3,col,m,10); }
 };
 const build=()=>{
  /* ── 방 껍데기: 바닥 · 천장 · 벽 ── */
  bat(()=>{
   const M=RM.meet,C=RM.c1,P=RM.sp,H=RM.hall,D=RM.c2,O=RM.office;
   // 바닥 (대리석: 회의실·복도·홀), 집무실은 쪽모이
   for (const r of [M,C,P,H,D]) quad([r[0],0,r[2]],[r[1]-r[0],0,0],[0,0,r[3]-r[2]],[1,1,1],0,8,8);
   quad([O[0],0,O[2]],[O[1]-O[0],0,0],[0,0,O[3]-O[2]],[1,1,1],19,4,4);
   quad([-1.3,0,11],[2.6,0,0],[0,0,.4],[1,1,1],0); quad([18,0,60],[2,0,0],[0,0,.4],[1,1,1],19);
   // 천장
   for (const r of [M,C,P,H,D,O]) quad([r[0],r[4],r[2]],[r[1]-r[0],0,0],[0,0,r[3]-r[2]],CRM,5,4,4);
   // 회의실 벽 (비단 벽지 + 아래 판벽은 따로)
   wall('x',M[2],M[0],M[1],M[4],[],SILK,18);
   wall('x',M[3],M[0],M[1],M[4],[[-1.3,1.3,4.2]],SILK,18);
   for (const s of [-1,1]) wall('z',s*6.5,M[2],M[3],M[4],[[-9.15,-8.05,2.7],[7.65,8.75,2.7]],SILK,18);
   // 문간 안쪽 면 (두께 0.4)
   for (const x of [-1.3,1.3]) quad([x,0,11],[0,0,.4],[0,4.2,0],MB,1); quad([-1.3,4.2,11],[2.6,0,0],[0,0,.4],MB,1);
   for (const x of [18,20]) quad([x,0,60],[0,0,.4],[0,3.4,0],MB,1); quad([18,3.4,60],[2,0,0],[0,0,.4],MB,1);
   // 복도 1
   wall('x',C[2],C[0],C[1],C[4],[[-8.55,-7.45,2.7],[-1.3,1.3,4.2],[6.45,7.55,2.7],[18.45,19.55,2.7]],MB,1);
   wall('x',C[3],C[0],C[1],C[4],[[14,17.5,4.6]],MB,1);
   wall('z',C[0],C[2],C[3],C[4],[[13.15,14.25,2.7]],MB,1); wall('z',C[1],C[2],C[3],C[4],[[13.15,14.25,2.7]],MB,1);
   // 옆 통로
   wall('z',P[0],P[2],P[3],P[4],[],MB,1); wall('z',P[1],P[2],P[3],P[4],[[20.45,21.55,2.7]],MB,1);
   // 홀
   wall('x',H[2],H[0],H[1],H[4],[[14,17.5,4.6]],MB,1); wall('x',H[3],H[0],H[1],H[4],[[17,21,5]],MB,1);
   wall('z',H[0],H[2],H[3],H[4],[[29.45,30.55,2.7],[37.45,38.55,2.7]],MB,1); wall('z',H[1],H[2],H[3],H[4],[],MB,1);
   // 복도 2
   wall('z',D[0],D[2],D[3],D[4],[[48.45,49.55,2.7]],MB,1); wall('z',D[1],D[2],D[3],D[4],[[54.45,55.55,2.7]],MB,1);
   wall('x',D[3],D[0],D[1],D[4],[[18,20,3.4]],MB,1);
   // 집무실 (판벽)
   wall('x',O[2],O[0],O[1],O[4],[[18,20,3.4]],SILK,18); wall('x',O[3],O[0],O[1],O[4],[],SILK,18);
   wall('z',O[0],O[2],O[3],O[4],[],SILK,18); wall('z',O[1],O[2],O[3],O[4],[],SILK,18);
   // 걸레받이 (어두운 대리석) · 코니스
   const sk=(ax,c,a0,a1,dir,holes,h,col=MD)=>{ band(ax,c,a0,a1,0,.18,.035,dir,col,1,holes); band(ax,c,a0,a1,h-.28,h,.12,dir,CRM,5,[]); band(ax,c,a0,a1,h-.36,h-.3,.05,dir,GD,4,[]); };
   sk('x',C[2],C[0],C[1],1,[[-8.55,-7.45,2.7],[-1.3,1.3,4.2],[6.45,7.55,2.7],[18.45,19.55,2.7]],C[4]); sk('x',C[3],C[0],C[1],-1,[[14,17.5,4.6]],C[4]);
   sk('z',C[0],C[2],C[3],1,[[13.15,14.25,2.7]],C[4]); sk('z',C[1],C[2],C[3],-1,[[13.15,14.25,2.7]],C[4]);
   sk('z',P[0],P[2],P[3],1,[],P[4]); sk('z',P[1],P[2],P[3],-1,[[20.45,21.55,2.7]],P[4]);
   sk('x',H[2],H[0],H[1],1,[[14,17.5,4.6]],H[4]); sk('x',H[3],H[0],H[1],-1,[[17,21,5]],H[4]);
   sk('z',H[0],H[2],H[3],1,[[29.45,30.55,2.7],[37.45,38.55,2.7]],H[4]); sk('z',H[1],H[2],H[3],-1,[[ST.z0,ST.z1,9]],H[4]);
   sk('z',D[0],D[2],D[3],1,[[48.45,49.55,2.7]],D[4]); sk('z',D[1],D[2],D[3],-1,[[54.45,55.55,2.7]],D[4]); sk('x',D[3],D[0],D[1],-1,[[18,20,3.4]],D[4]);
   for (const [ax,c,a0,a1,dir,ho] of [['x',M[2],M[0],M[1],1,[]],['x',M[3],M[0],M[1],-1,[[-1.3,1.3,4.2]]],['z',-6.5,M[2],M[3],1,[]],['z',6.5,M[2],M[3],-1,[]]]) { band(ax,c,a0,a1,M[4]-.45,M[4],.2,dir,CRM,5); band(ax,c,a0,a1,M[4]-.55,M[4]-.45,.08,dir,GD,4); }
   for (const [ax,c,a0,a1,dir,ho] of [['x',O[2],O[0],O[1],1,[[18,20,3.4]]],['x',O[3],O[0],O[1],-1,[]],['z',O[0],O[2],O[3],1,[]],['z',O[1],O[2],O[3],-1,[]]]) { band(ax,c,a0,a1,O[4]-.3,O[4],.14,dir,CRM,5); band(ax,c,a0,a1,0,.16,.03,dir,WD,2,ho); }
   // 회의실 판벽 (호두나무, 1.1 m) + 걸레받이
   for (const [ax,c,a0,a1,dir,ho] of [['x',M[2],M[0],M[1],1,[]],['x',M[3],M[0],M[1],-1,[[-1.3,1.3,4.2]]],['z',-6.5,M[2],M[3],1,[[-9.15,-8.05,2.7],[7.65,8.75,2.7]]],['z',6.5,M[2],M[3],-1,[[-9.15,-8.05,2.7],[7.65,8.75,2.7]]]]) {
    band(ax,c,a0,a1,0,1.15,.05,dir,WD,2,ho); band(ax,c,a0,a1,1.1,1.19,.09,dir,WD,2,ho); band(ax,c,a0,a1,0,.2,.08,dir,[.12,.06,.03],2,ho);
   }
   // 회의실 천장 격자 (우물반자): 들보 + 금띠
   for (let x=-6.5+2.17; x<6.4; x+=2.17) { blk(x-.2,x+.2,6.75,7.2,-11,11,CRM,5,10,8,6); blk(x-.13,x+.13,6.71,6.76,-11,11,GD,4,8,6,4); }
   for (let z=-11+2.2; z<10.9; z+=2.2) { blk(-6.5,6.5,6.75,7.2,z-.2,z+.2,CRM,5,10,8,6); blk(-6.5,6.5,6.71,6.76,z-.13,z+.13,GD,4,8,6,4); }
   // 홀 천장 격자
   for (let x=4+3.75; x<33.9; x+=3.75) blk(x-.3,x+.3,9.4,10,24,44,CRM,5,10,8,6);
   for (let z=24+4; z<43.9; z+=4) blk(4,34,9.4,10,z-.3,z+.3,CRM,5,10,8,6);
  },ONE);
  /* ── 회의실 끝벽: 추상 휘장판 · 빈 초상 액자 · 붉은 기 ── */
  bat(()=>{
   blk(-2.45,2.45,2.05,6.55,0,.08,GD,4,10); blk(-2.3,2.3,2.2,6.4,.05,.12,RED,17,12);
   for (const s of [-1,1]) {
    blk(s*4.3-1.05,s*4.3+1.05,2.55,5.75,0,.12,GD,4,8); blk(s*4.3-.88,s*4.3+.88,2.72,5.58,.08,.14,[.6,.58,.54],14,12);
    // 붉은 기 (천 주름)
    surf(16,10,(u,v)=>[s*(2.85+u*.75),L(6.6,1.4,v),.12+.05*sin(u*PI*5)*(.5+v)],RED,3);
    tube(v=>[s*(2.8+v*.85),6.65,.14],.035,GD,4,6,3);
   }
   // 단 (높은 자리) + 판벽 기둥
   for (const x of [-6,-3.15,3.15,6]) blk(x-.22,x+.22,0,7.2,0,.16,WD,2,10);
  },[ins([0,0,-11],0,3)]);
  /* ── 판벽 기둥 (회의실 긴 벽): 나무 + 금 주두 ── */
  const MP=[]; for (const s of [-1,1]) for (const z of [-10,-6.1,-.35,.35,6.1,9.7]) MP.push(ins([s*6.5,0,z],-s*PI/2,3));
  bat(()=>{ blk(-.25,.25,0,6.75,0,.14,WD,2,10); blk(-.3,.3,0,.3,0,.18,[.12,.06,.03],2,10); blk(-.3,.3,6.2,6.45,0,.2,GD,4,8); },MP);
  /* ── 창: 밤하늘 · 깊은 문설주 · 벨벳 커튼 ── */
  const win=(w,h,y0,cur,col=MB)=>()=>{
   const W2=w/2;
   blk(-W2-.26,-W2,y0-.08,y0+h+.1,-.05,.24,col,1,12); blk(W2,W2+.26,y0-.08,y0+h+.1,-.05,.24,col,1,12);
   blk(-W2-.34,W2+.34,y0-.2,y0,-.05,.3,col,1,12); blk(-W2-.4,W2+.4,y0+h,y0+h+.34,-.05,.28,col,1,12);
   quad([-W2,y0,.02],[w,0,0],[0,h,0],[w,h,y0],9);
   if (!cur) return;
   const yt=y0+h+.55,cw=w*.5+.55;
   for (const s of [-1,1]) surf(30,16,(u,v)=>{ // 묶은 커튼: 위는 넓게, 끈 높이에서 바깥쪽으로 모임, 아래는 퍼짐
    const tie=.66,k=v<tie?L(1,.36,sm(0,tie,v)):L(.36,.6,sm(tie,1,v)),xo=s*(W2+.7),xi=s*(W2+.7-cw*k);
    const y=L(yt,.01,v),f=sin(u*PI*2*6.5+s)*L(.04,.1,v)*(1-.4*sm(.55,.7,v)),z=.42+f+.06*sin(v*PI)*(1-u);
    return [L(xo,xi,u),y,z];
   },RED,3);
   // 휘장 (스웨그) + 금 술
   surf(24,4,(u,v)=>{ const x=L(-W2-.95,W2+.95,u); return [x,yt+.42-v*(.5+.25*sin(u*PI*2)**2),.5+.08*sin(u*PI*16)*v]; },RED,3);
   tube(v=>{ const x=L(-W2-.95,W2+.95,v); return [x,yt-.08-.25*sin(v*PI*2)**2,.54]; },.03,GD,4,6,24);
   for (const s of [-1,1]) pill([s*(W2+.62),yt-.05-.66*(yt-.01),.5],[.06,.06,.06],2,GD,4,0,6,4);
  };
  bat(win(2,4.6,1.4,1),[-3.2,3.2].flatMap(z=>[ins([-6.5,0,z],PI/2),ins([6.5,0,z],-PI/2)]));
  bat(win(1.7,3.3,.9,1),[-9,-4.5,4.5,9,22.5].map(x=>ins([x,0,16],PI)));
  bat(win(2.3,5.8,1.6,1),[[8,44,PI],[12.5,44,PI],[25.5,44,PI],[30,44,PI],[8,24,0],[25.5,24,0]].map(([x,z,y])=>ins([x,0,z],y)));
  bat(win(1.6,3,1.1,1,[.32,.17,.08]),[ins([14.6,0,72],PI),ins([23.4,0,72],PI)]);
  /* ── 회의 탁자 · 의자 · 마이크 · 물잔 ── */
  bat(()=>{
   blk(-1.25,1.25,.72,.8,-7.2,6.2,WD,2,8,24,8); blk(-1.06,1.06,.795,.805,-7.0,6.0,[.08,.2,.12],6,24,8,4);
   blk(-1.15,1.15,.58,.73,-7.1,6.1,WD,2,10);
   for (const z of [-6.6,-.5,5.6]) for (const s of [-1,1]) lathe([s*.95,0,z],v=>[.07+.05*sin(v*PI*3)**2+.04*(v<.1),v*.6],WD,2,10,10);
   for (let z=-5.4; z<5; z+=3.8) { lathe([0,.8,z],v=>[.05+.035*sin(v*PI)-.02*v,v*.26],[.75,.8,.82],12,12,6); lathe([.13,.8,z+.1],v=>[.04,v*.1],[.75,.8,.82],12,8,2); }
  },[ins([0,0,0],0,3)]);
  // 의자 (등받이 높은 가죽 의자), 지역: 좌석 중앙 바닥, +Z = 앉은 사람 정면
  const chair=hb=>()=>{
   blk(-.28,.28,.32,.41,-.27,.27,WD,2,10); pill([0,.45,.0],[.26,.055,.25],4,LEA,7,0,12,8);
   surf(10,14,(u,v)=>{ const x=L(-.25,.25,u),y=L(.5,hb,v),bow=.04*sin(u*PI); return [x,y,-.25-.05*(y-.5)+bow*(1-v*.3)+.015*sin(v*PI*6)*sin(u*PI)]; },LEA,7);
   surf(10,10,(u,v)=>{ const x=L(-.25,.25,u),y=L(.5,hb,v); return [x,y,-.32-.05*(y-.5)]; },LEA,7);
   tube(v=>{ const a=L(-.5,.5,v)*PI; return [sin(a)*.29,hb+.03+.05*cos(a),-.3-.05*(hb-.5)]; },.035,WD,2,6,10);
   for (const s of [-1,1]) { tube(v=>[s*.28,.5+.0*v,L(-.28,.25,v)],.03,WD,2,6,4); tube(v=>[s*.28,L(.5,hb+.03,v),-.29-.05*(L(.5,hb,v)-.5)],.03,WD,2,6,6); pill([s*.29,.66,.02],[.045,.03,.22],3,LEA,7,0,8,4); tube(v=>[s*.29,L(.41,.64,v),.2],.022,WD,2,6,3); }
   for (const [x,z] of [[-.23,-.23],[.23,-.23],[-.23,.22],[.23,.22]]) lathe([x,0,z],v=>[.03-.01*v+.012*sin(v*PI*2)**2,v*.33],WD,2,8,6);
  };
  bat(chair(1.28),SEATS.map(s=>ins([s[0],0,s[2]],s[3])));
  bat(chair(1.55),[ins([0,0,-7.95],0,3,0,0,1.06),ins([19,0,69.9],PI,3,0,0,1.06)]);
  // 자리 소품: 마이크 · 물잔 · 서류철 (의자 지역좌표, 탁자 가장자리 ~0.5m 앞)
  bat(()=>{
   lathe([-.2,.8,.78],v=>[.06*(1-v*v),.03*v],BRZ,13,10,3);
   tube(v=>[-.2+.08*v,.83+.32*sin(v*PI*.5),.78-.24*v*v],.007,BRZ,13,5,10); pill([-.12,1.15,.53],[.02,.02,.06],2,BRZ,13,0,8,5);
   pill([-.12,1.15,.48],[.012,.012,.012],2,[1,.12,.08],11,0,6,4);
   lathe([.26,.8,.72],v=>[.033+.006*v,v*.12],[.7,.8,.82],12,10,3);
   blk(-.17,.17,.8,.815,.6,.9,[.28,.05,.04],7,10,8,4);
  },[...SEATS,[0,0,-7.95,0]].map(s=>ins([s[0],0,s[2]],s[3])));
  /* ── 샹들리에 (지역: 천장 고정점 = 원점, 아래로) ── */
  bat(()=>{
   tube(v=>[0,-v*1.1,0],.025,GD,4,6,3);
   lathe([0,-2.05,0],v=>[.08+.12*sin(v*PI)**2+.05*sin(v*PI*3)**2,v*.95],GD,4,14,12);
   for (const [n,R,y,cr] of [[10,.95,-1.75,.05],[6,.55,-1.25,.04]]) for (let k=0; k<n; k++) {
    const a=k/n*2*PI,c=cos(a),s=sin(a);
    tube(v=>[c*R*v,y+.3*sin(v*PI)-.1*v-.05,s*R*v],.018,GD,4,5,8);
    lathe([c*R,y-.15,s*R],v=>[.04+.02*v,v*.08],GD,4,8,2);
    pill([c*R,y-.01,s*R],[.035,.07,.035],2,[1,.82,.55],11,0,6,6);
    for (let j=0; j<3; j++) pill([c*R*1.05,y-.3-j*.09,s*R*1.05],[cr*.6,cr,cr*.6],2,[.9,.92,1],8,0,6,4);
   }
   for (const [n,R,y] of [[24,1.05,-1.95],[16,.7,-1.5],[10,.35,-2.2]]) for (let k=0; k<n; k++) {
    const a=k/n*2*PI; tube(v=>[cos(a)*R,y-.25*v,sin(a)*R],.004,[.9,.9,.9],8,3,2); pill([cos(a)*R,y-.3,sin(a)*R],[.025,.05,.025],2,[.9,.92,1],8,0,6,4);
   }
   lathe([0,-2.25,0],v=>[.09*sin(v*PI),-v*.35],[.9,.92,1],8,10,6);
  },[ins([0,7.2,-4.6],0,3),ins([0,7.2,4.6],.3,3),ins([17,10,34],0,3,0,0,1.45),ins([19,5.2,65],0,3,0,0,.72)],0);
  /* ── 벽등 (지역: 벽면 = z0, +Z 방 쪽) ── */
  const SC=[[-6,11.4,0],[4,16,PI],[11,11.4,0],[22,16,PI],[14,24,PI/2+PI/2],[17.5,20,-PI/2],[4,34,PI/2],[17,52.5,PI/2],[21,47,-PI/2],[12,67,PI/2],[-6.5,-6.1,PI/2],[6.5,-6.1,-PI/2],[-6.5,6.1,PI/2],[6.5,6.1,-PI/2]];
  bat(()=>{
   pill([0,3,.03],[.09,.2,.03],3,GD,4,0,8,6);
   for (const s of [-1,1]) {
    tube(v=>[s*.22*v,2.95+.18*sin(v*PI*.9),.05+.2*v],.014,GD,4,5,8);
    lathe([s*.22,3.0,.25],v=>[.035,v*.05],GD,4,8,2);
    lathe([s*.22,3.05,.25],v=>[.06+.05*v,v*.16],[1,.86,.62],11,12,3);
   }
  },SC.map(([x,z,y])=>ins([x,.1,z],y,3)),0);
  /* ── 대리석 기둥 (홀) · 벽기둥 (복도) ── */
  const col=h=>()=>{
   blk(-.66,.66,0,.42,-.66,.66,MD,1,10); blk(-.58,.58,.42,.56,-.58,.58,GD,4,10);
   blk(-.5,.5,.56,h-.7,-.5,.5,MB,1,14,12,12);
   blk(-.56,.56,h-.86,h-.76,-.56,.56,GD,4,10); blk(-.6,.6,h-.7,h-.45,-.6,.6,CRM,5,10); blk(-.7,.7,h-.45,h,-.7,.7,CRM,5,10);
  };
  bat(col(10),PIL.map(([x,z])=>ins([x,0,z],0,3)));
  bat(()=>{
   blk(-.42,.42,0,.32,-.1,.32,MD,1,10); blk(-.35,.35,.32,4.6,-.1,.25,[.74,.7,.64],1,14);
   blk(-.38,.38,4.0,4.1,-.1,.28,GD,4,10); blk(-.44,.44,4.6,5.1,-.1,.33,CRM,5,10);
  },PLS.map(([x,z,y])=>ins([x,0,z],y,3)));
  /* ── 붉은 카펫 (c = 중심 가로좌표, 반폭, 축 0=x 방향 1=z 방향) ── */
  bat(()=>{
   const run=(x0,x1,z0,z1,ax)=>blk(x0,x1,-.02,.018,z0,z1,ax?[(x0+x1)/2,(x1-x0)/2,1]:[(z0+z1)/2,(z1-z0)/2,0],10,6,8,4);
   run(-11.6,25.6,12.9,14.5,0); run(14.95,16.55,14.5,23.9,1); run(15,16.5,24,37,1); run(16.8,18.3,37,43.95,1); run(15,18.3,36.2,37.8,0);
   run(18.2,19.8,44,59.9,1); run(-1.1,1.1,7.2,10.95,1);
   // 계단 디딤판 · 디딤판 카펫
   for (let i=0; i<ST.n; i++) {
    const x=ST.x0+i*(ST.x1-ST.x0)/ST.n,y=(i+1)*ST.h/ST.n;
    blk(x,34,0,y,ST.z0+.12,ST.z1-.12,MB,1,14,10,4); blk(x-.03,x+.4,y-.015,y+.02,32.4,35.6,[34,1.6,0],10,6,6,3);
   }
  },ONE);
  // 계단 난간: 손잡이 · 난간동자 · 엄지기둥
  bat(()=>{
   for (const z of [ST.z0-.05,ST.z1+.05]) {
    blk(ST.x0,34,0,0,z-.15,z+.15,MB,1,8); // 측벽 띠
    surf(20,2,(u,v)=>{ const x=L(ST.x0,ST.x1,u); return [x,stairH(x-.01,34)*(1)+.05-.3+v*.3+(u>.999?0:0),z+(v-.5)*.3]; },MB,1);
    tube(v=>{ const x=L(ST.x0+.2,34,v),hh=x<ST.x1?(x-ST.x0)/(ST.x1-ST.x0)*ST.h:ST.h; return [x,hh+1.05,z]; },.06,WD,2,8,20);
    for (let x=ST.x0+.45; x<33.8; x+=.42) { const hh=x<ST.x1?(floor((x-ST.x0)/(ST.x1-ST.x0)*ST.n)+1)*ST.h/ST.n:ST.h; lathe([x,hh,z],v=>[.035+.03*sin(v*PI*1.5)**2,v*(1.0+(x<ST.x1?.15:0))],MB,1,8,6); }
    lathe([ST.x0+.1,0,z],v=>[.14+.05*(v<.15)+.03*sin(v*PI*4)**2,v*1.35],MB,1,12,10); pill([ST.x0+.1,1.45,z],[.11,.12,.11],2,GD,4,0,10,6);
   }
   blk(ST.x0,34,0,.01,ST.z0-.2,ST.z0+.12,MB,1); // 측면 판
   surf(24,1,(u,v)=>{ const x=L(ST.x0,34,u); return [x,v*stairH(x,34),ST.z0-.2]; },MB,1); surf(24,1,(u,v)=>{ const x=L(ST.x0,34,u); return [x,v*stairH(x,34),ST.z1+.2]; },MB,1);
  },ONE);
  /* ── 문짝 (경첩 = 원점, +X 로 폭, 두께 ±z) ── */
  const leaf=(w,h,lux)=>()=>{
   blk(0,w,0,h,-.06,.06,WD,2,14,12,8);
   const ph=lux?[[.35,h*.42],[h*.52,h-.3]]:[[.3,h*.45],[h*.55,h-.25]];
   for (const [y0,y1] of ph) for (const s of [-1,1]) { blk(.14,w-.14,y0,y1,s*.05,s*.085,[.28,.15,.08],2,8,10,6); if (lux) blk(.2,w-.2,y0+.06,y1-.06,s*.08,s*.092,GD,4,8,8,4); }
   for (const s of [-1,1]) { pill([w-.12,h*.47,s*.1],[.02,.16,.02],3,GD,4,0,6,6); pill([w-.12,h*.47,s*.07],[.035,.035,.03],2,GD,4,0,6,4); }
  };
  const L4=[ins([-1.3,0,11.25],0,2,0,-1),ins([1.3,0,11.25],PI,2,1,1)];
  bat(leaf(1.3,4.2,1),L4);
  bat(leaf(1,3.4,1),[ins([18,0,60.3],0,2,2,-1),ins([20,0,60.3],PI,2,3,1)]);
  const SDI=SD.map((d,i)=>{ const y=d[2],xa=[cos(y),0,-sin(y)],c=[d[0]+sin(y)*.04,d[3]||0,d[1]+cos(y)*.04]; return ins(V3.add(c,V3.mul(xa,-.55)),y,2,4+i,1); });
  bat(leaf(1.1,2.7,0),SDI);
  // 문틀 (방 쪽 양면)
  bat(()=>frame(2.6,4.2,MB,1,1),[ins([0,0,11],PI),ins([0,0,11.4],0)]);
  bat(()=>frame(2,3.4,WD,2,1),[ins([19,0,60],PI),ins([19,0,60.4],0)]);
  bat(()=>frame(1.1,2.7,MB,1),SD.map(d=>ins([d[0],d[3]||0,d[1]],d[2])));
  bat(()=>frame(4,5,MB,1,1),[ins([19,0,44],PI),ins([19,0,44],0)]);
  bat(()=>frame(3.5,4.6,MB,1),[ins([15.75,0,16],0),ins([15.75,0,24],PI),ins([15.75,0,24],0)]);
  // 옆문 뒤 어두운 전실 (열리면 보임)
  bat(()=>{ quad([-.8,0,-1.6],[1.6,0,0],[0,2.8,0],[.3,.28,.25],21); quad([-.8,0,-1.6],[0,0,1.6],[0,2.8,0],[.3,.28,.25],21); quad([.8,0,-1.6],[0,0,1.6],[0,2.8,0],[.3,.28,.25],21); quad([-.8,0,-1.6],[1.6,0,0],[0,0,1.6],[.2,.18,.16],21); quad([-.8,2.8,-1.6],[1.6,0,0],[0,0,1.6],[.3,.28,.25],21); },SD.map(d=>ins([d[0],d[3]||0,d[1]],d[2])),0);
  /* ── 집무실: 책상 · 램프 · 전화 · 지구의 · 책장 · 소파 · 카펫 · 빈 초상 ── */
  bat(()=>{
   // 책상 (지역: 책상 중앙 바닥, +Z = 앉는 사람 쪽 반대 → 인스턴스 yaw 0, 월드에 직접)
   blk(17.3,20.7,.74,.81,67.8,69.2,WD,2,8,24,8); blk(17.6,20.4,.805,.815,68.0,69.0,[.06,.17,.09],6,16,8,4);
   for (const x of [17.45,19.85]) { blk(x,x+.7,0,.74,67.9,69.1,WD,2,10); for (let k=0; k<3; k++) { blk(x+.06,x+.64,.08+k*.22,.27+k*.22,67.86,67.9,[.3,.16,.08],2,8,8,4); pill([x+.35,.18+k*.22,67.84],[.04,.012,.012],3,GD,4,0,6,4); } }
   blk(18.15,19.85,.3,.72,67.92,68.0,WD,2,10);
   // 초록 갓 램프
   lathe([19.75,.815,68.25],v=>[.1-.06*v,v*.04],GD,4,12,2); tube(v=>[19.75,.85+v*.32,68.25+.0],.012,GD,4,6,3);
   surf(14,6,(u,v)=>{ const a=L(-.1,1.1,u)*PI; return [19.75+cos(a)*.2*L(1,.9,v),1.17+sin(a)*.09*L(1,.6,v)*(a<0||a>PI?0:1),68.25+L(-.11,.11,v)]; },[.05,.3,.1],20);
   pill([19.75,1.13,68.25],[.18,.015,.08],3,[1,.85,.6],11,0,10,4);
   // 전화 2대
   for (const [x,c] of [[18.2,BRZ],[18.6,[.62,.58,.5]]]) {
    pill([x,.86,68.55],[.11,.05,.13],4,c,13,0,10,6); pill([x,.93,68.55],[.15,.025,.04],3,c,13,0,10,4);
    for (const s of [-1,1]) pill([x+s*.13,.92,68.55],[.035,.035,.05],3,c,13,0,6,4);
    lathe([x,.9,68.45],v=>[.045,v*.01],[.8,.8,.75],12,10,1);
   }
   // 서류 · 펜꽂이 · 명패 없음
   blk(18.9,19.4,.815,.83,68.45,68.8,[.82,.8,.74],21,8,6,3); lathe([20.3,.815,68.6],v=>[.035,v*.11],GD,4,8,2);
   // 지구의
   lathe([23.6,0,69.3],v=>[.22-.15*v+.04*sin(v*PI*3)**2,v*.62],WD,2,12,8); pill([23.6,1.02,69.3],[.3,.3,.3],2,[.2,.35,.42],15,0,20,14);
   tube(v=>{ const a=L(-.6,.6,v)*PI; return [23.6+sin(a)*.34,1.02+cos(a)*.34,69.3]; },.012,GD,4,5,16);
   // 책장 (동벽 · 서벽 일부)
   const shelf=(x0,x1,z0,z1,fx)=>{
    blk(x0,x1,0,2.6,z0,z0+.06,WD,2,10); blk(x0,x1,0,2.6,z1-.06,z1,WD,2,10); blk(x0,x1,2.5,2.66,z0-.05,z1+.05,WD,2,10);
    const back=fx>0?x1:x0; blk(back-.03,back+.03,0,2.6,z0,z1,WD,2,10);
    for (let k=0; k<6; k++) { const y=.1+k*.47; blk(x0,x1,y,y+.035,z0,z1,WD,2,10,8,4);
     if (k===0) continue; let z=z0+.08; while (z<z1-.12) { const w=.03+rnd()*.045,h=.26+rnd()*.13,c=[[.35,.06,.04],[.08,.16,.1],[.1,.1,.22],[.4,.3,.15],[.15,.08,.05]][rnd()*5|0]; const d=.22+rnd()*.06,xf=fx>0?x1-.04-d:x0+.04; bx(xf,xf+d,y+.035,y+.035+h,z,z+w,c,16); z+=w+.004+(rnd()<.08?.12:0); } }
   };
   shelf(25.55,26,61.6,66.5,1); shelf(25.55,26,66.7,71.6,1); shelf(12,12.45,68.8,71.6,-1);
   // 소파 (가죽, 서벽)
   blk(12.35,13.4,.18,.45,62.5,66.5,LEA,7,6); for (const z of [63.2,64.5,65.8]) pill([12.95,.5,z],[.42,.09,.62],4,LEA,7,0,10,6);
   pill([12.42,.82,64.5],[.12,.42,1.95],4,LEA,7,0,10,8); for (const z of [62.6,66.4]) tube(v=>[L(12.4,13.45,v),.62,z],.14,LEA,7,10,6);
   for (const z of [62.6,66.4]) for (const x of [12.45,13.35]) lathe([x,0,z],v=>[.04,v*.18],WD,2,6,2);
   // 탁자 (소파 앞)
   blk(14.1,15.1,.42,.47,63.6,65.4,WD,2,10); for (const z of [63.7,65.3]) for (const x of [14.2,15]) lathe([x,0,z],v=>[.03,v*.42],WD,2,6,2);
   // 카펫 · 빈 초상
   blk(15.6,22.4,-.02,.016,62,69.6,[1,1,1],22,8,10,4);
   blk(17.9,20.1,2.0,4.6,71.86,72,GD,4,8); blk(18.05,19.95,2.15,4.45,71.84,71.9,[.6,.58,.54],14,12);
   // 깃대 (추상 붉은 기)
   for (const x of [17.2,20.8]) { lathe([x,0,71.4],v=>[.12-.08*v,v*.1],GD,4,10,2); tube(v=>[x,v*2.9,71.4],.018,GD,4,6,3); pill([x,2.95,71.4],[.04,.05,.04],2,GD,4,0,6,4); surf(8,10,(u,v)=>[x+(x<19?1:-1)*.03*sin(u*PI*4),L(2.8,1.4,v),71.4-.06+u*.12+.04*sin(v*PI*3+u)],RED,3); }
  },[ins([0,0,0],0,3)]);
 };
  /* ── 셰이더 ── */
 const WGSL=/* wgsl */`
struct U{s:vec4f,d:array<vec4f,6>,l:array<vec4f,32>}; // s: x 시간 y 조명 수 z 품질 / d: 문 열림 각 24개 / l: 조명 16개 (위치·반경, rgb)
@group(1)@binding(0)var<uniform>u:U;
struct I{@location(0)p:vec3f,@location(1)n:vec3f,@location(2)c:vec3f,@location(3)m:f32,@location(4)a:vec4f,@location(5)b:vec4f,@location(6)d:vec4f,@location(7)e:vec4f,@location(8)t:vec4f};
struct V{@builtin(position)p:vec4f,@location(0)w:vec3f,@location(1)n:vec3f,@location(2)c:vec3f,@location(3)@interpolate(flat)m:f32,@location(4)o:vec3f,@location(5)q:vec3f,@location(6)@interpolate(flat)t:vec4f};
fn tf(i:I,vp:mat4x4f)->V{
var p=i.p;var n=i.n;
if(i.t.x==2.){let k=i32(i.t.z);let a=u.d[k/4][k%4]*i.t.w;let c=cos(a);let s=sin(a); // 문짝: 경첩(원점) 기준 회전
p=vec3f(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);n=vec3f(n.x*c+n.z*s,n.y,-n.x*s+n.z*c);}
let M=mat4x4f(i.a,i.b,i.d,i.e);let w=(M*vec4f(p,1.)).xyz;
return V(vp*vec4f(w,1.),w,normalize((M*vec4f(n,0.)).xyz),i.c,i.m,i.p,i.n,i.t);
}
@vertex fn vs(i:I)->V{return tf(i,g.viewProj);}
@vertex fn vsS(i:I)->@builtin(position)vec4f{return tf(i,g.shadowVP).p;}
fn nz(p:vec2f)->f32{return textureSampleLevel(noiseTex,linSamp,p*.0039,0.).x;}
fn fd(s:f32,px:f32)->f32{return clamp(s/px*.35-.5,0.,1.);}
fn ln(x:f32,w:f32,px:f32)->f32{return 1.-smoothstep(w,w+px,abs(x));}
fn vein(q:vec2f,px:f32,k:f32)->f32{ // 대리석 결 (가는 줄, 거리에 따라 흐려짐)
let t=nz(q*.6)*1.6+nz(q*2.1)*.6;let v=abs(sin(dot(q,vec2f(.55,.83))*k+t*4.));
return (1.-smoothstep(0.,.07,v))*fd(.04,px)*.8+(1.-smoothstep(0.,.35,v))*.25;
}
const RMS=array<vec4f,6>(vec4f(-6.5,6.5,-11.,11.),vec4f(-12.,26.,11.4,16.),vec4f(14.,17.5,16.,24.),vec4f(4.,34.,24.,44.),vec4f(17.,21.,44.,60.),vec4f(12.,26.,60.4,72.));
fn wallD(P:vec3f)->f32{ // 방 벽까지 수평 거리 (바닥·천장 구석 어둡게)
var d=9.;
for(var k=0;k<6;k++){let r=RMS[k];if(P.x>=r.x&&P.x<=r.y&&P.z>=r.z&&P.z<=r.w){d=min(d,min(min(P.x-r.x,r.y-P.x),min(P.z-r.z,r.w-P.z)));}}
return d;
}
fn shade(P:vec3f,N:vec3f,E:vec3f,al:vec3f,gl:f32,met:f32,ao:f32)->vec3f{
var dif=vec3f(.03,.026,.021)*(.55+.45*N.y)*ao;var spc=vec3f(0.);
let sp=6.+900.*gl*gl;let n=i32(u.s.y);
for(var i=0;i<16;i++){
if(i>=n){break;}
let a=u.l[i*2];let v=a.xyz-P;let d2=dot(v,v);let r2=a.w*a.w;if(d2>r2){continue;}
let Lv=v*inverseSqrt(d2);let w=1.-d2/r2;let at=w*w/(d2*.6+.5);let c=u.l[i*2+1].rgb*at;
dif+=c*(max(dot(N,Lv),0.)*.8+.2*ao);
let H=normalize(Lv+E);spc+=c*pow(max(dot(N,H),0.),sp)*(sp+8.)*.035;
}
for(var i=0;i<4;i++){ // 총구 섬광 등 공용 점광 (이 모듈이 넣은 등불 복제본 반경 13.37 은 제외)
let l=g.lights[i*2];if(l.w<=0.||abs(l.w-13.37)<.01){continue;}
let v=l.xyz-P;let d=length(v);let a=max(1.-d/l.w,0.);dif+=g.lights[i*2+1].rgb*a*a*max(dot(N,v/max(d,1e-3)),0.);
}
let nv=max(dot(N,E),0.);let fr=mix(.04,1.,pow(1.-nv,5.));let R=reflect(-E,N);
let env=mix(vec3f(.025,.02,.016),vec3f(.16,.12,.08),smoothstep(-.3,.9,R.y))*ao;
let tint=mix(vec3f(1.),al*2.2,met);
return al*dif*(1.-met*.85)+tint*(spc*gl+env*gl*mix(fr,1.,met)*1.2);
}
fn sky(d:vec3f,px:f32)->vec3f{ // 창 밖: 저녁 하늘 · 도시 불빛 (시차 있는 원통 투영)
let a=atan2(d.x,d.z)*30.;let y=d.y;
let sl=.02+.05*nz(vec2f(a*.9,3.))+.04*step(.7,nz(vec2f(a*.35,7.)));
var c=mix(vec3f(.07,.04,.035),vec3f(.004,.008,.022),smoothstep(-.02,.45,y))*2.5;
c+=vec3f(.25,.1,.04)*exp(-max(y,0.)*14.)*.6;
if(y<sl){c=vec3f(.006,.006,.008);let q=vec2f(a*3.,y*90.);let h=hash21(floor(q));c+=vec3f(1.,.72,.4)*step(.83,h)*1.5*fd(.5,px*90.);}
let st=hash21(floor(vec2f(a*4.,y*120.)));c+=vec3f(.8)*step(.997,st)*step(.15,y);
return c;
}
@fragment fn fs(i:V)->@location(0)vec4f{
let P=i.w;let o=i.o;let m=i.m;let px=length(fwidth(P))+1e-4;
let E=normalize(g.cam.xyz-P);var N=normalize(i.n);if(dot(N,E)<0.){N=-N;}
var al=i.c;var gl=.05;var met=0.;var em=vec3f(0.);var ao=1.;
if(m==0.){ // 대리석 바닥: 큰 판석 + 마름모 상감 + 결
let q=P.xz/1.2;let f=fract(q)-.5;let id=floor(q);
al=mix(vec3f(.78,.74,.66),vec3f(.7,.68,.64),hash21(id))*(.92+.1*nz(P.xz*3.));
al=mix(al,vec3f(.42,.38,.33),vein(P.xz+id*3.,px,1.3)*.6);
let dm=abs(f.x)+abs(f.y);let ins=1.-smoothstep(.2,.2+px*.9,abs(dm-.5)+.32);
al=mix(al,vec3f(.12,.1,.1)*(.8+.4*nz(P.xz*5.)),smoothstep(.85,.86,dm)*fd(.1,px));
al*=1.-.4*max(ln(f.x,.006,px/1.2),ln(f.y,.006,px/1.2))*fd(.05,px);
gl=.85;
}
else if(m==1.){ // 대리석 벽·기둥 (c = 기본색)
let q=vec2f(P.x+P.z,P.y);al*=.9+.12*nz(q*2.);al=mix(al,al*.55,vein(q*1.3,px,1.7));gl=.6;
}
else if(m==2.){ // 호두나무 (광택)
let gq=select(vec2f(o.x+o.z,o.y),vec2f(o.y,o.x+o.z),abs(i.q.y)>.5);
let gr=nz(vec2f(gq.x*.8,gq.y*14.))*.6+nz(vec2f(gq.x*3.,gq.y*40.))*.4*fd(.02,px);
al*=.65+.6*gr;gl=.55;
}
else if(m==3.){ // 벨벳: 가장자리 광택 (sheen), 주름 그늘
let nv=max(dot(N,E),0.);al*=.55+.9*pow(1.-nv,2.2);al*=.9+.15*nz(o.xy*9.);gl=.04;
}
else if(m==4.){al*=.85+.2*nz(o.xy*7.+o.z);gl=.7;met=1.;} // 금·놋쇠
else if(m==5.){al*=.95+.08*nz(P.xz*1.5+P.y);gl=.1;} // 회반죽 천장·코니스
else if(m==6.){al*=.85+.25*nz(o.xz*24.)*fd(.01,px);gl=.0;} // 녹색 펠트
else if(m==7.){al*=.85+.2*nz(o.xy*20.+o.z*13.)*fd(.01,px);gl=.42;} // 가죽
else if(m==8.){ // 크리스털: 반짝임
let h=hash21(floor(o.xz*40.+o.y*30.));let tw=pow(max(sin(dot(E,vec3f(13.,7.,11.))+h*40.),0.),16.);
al=vec3f(.15,.15,.17);gl=.95;em=vec3f(1.,.85,.65)*(.6+5.*tw);
}
else if(m==9.){ // 창: 창살 + 밤 풍경 + 유리 반사
let uv=vec2f(o.x/i.c.x+.5,(o.y-i.c.z)/i.c.y);
let mu=max(ln(fract(uv.x*3.)-.5,.475,px/i.c.x*3.),ln(fract(uv.y*6.)-.5,.47,px/i.c.y*6.));
em=sky(-E,px)*mu;al=mix(vec3f(.0),vec3f(.12,.09,.05),1.-mu);gl=mix(.95,.4,1.-mu);met=1.-mu;
}
else if(m==10.){ // 붉은 카펫 + 금 테두리
let ac=select(P.x,P.z,i.c.z<.5)-i.c.x;let al2=select(P.z,P.x,i.c.z<.5);let e=i.c.y-abs(ac);
al=vec3f(.42,.035,.04)*(.85+.2*nz(P.xz*6.));
let bd=smoothstep(.1,.1+px,e)*(1.-smoothstep(.17,.17+px,e));al=mix(al,vec3f(.75,.55,.2),bd*fd(.03,px));
al=mix(al,vec3f(.3,.02,.03),(1.-smoothstep(.05,.05+px,e)));
al*=1.-.12*step(.5,fract(al2*1.5+abs(ac)*1.5))*fd(.3,px)*step(.25,e);
gl=.02;
}
else if(m==11.){al=vec3f(.9);em=i.c*7.;} // 전구·등갓
else if(m==12.){al=vec3f(.03);gl=.95;em=vec3f(.02,.025,.03);} // 유리
else if(m==13.){gl=.55;} // 검은 금속·베이클라이트
else if(m==14.){al*=.92+.08*nz(o.xy*30.)+.04*sin(o.y*3.);gl=.08;} // 빈 캔버스
else if(m==15.){ // 지구의 (추상 대륙)
let dd=normalize(o-vec3f(23.6,1.02,69.3));let q=vec2f(atan2(dd.x,dd.z)*2.,dd.y*3.);
let ld=smoothstep(.55,.6,nz(q*1.7)*.7+nz(q*5.)*.3);al=mix(vec3f(.12,.25,.32),vec3f(.62,.55,.38),ld);gl=.7;
}
else if(m==16.){al*=.8+.3*nz(o.yz*30.);al=mix(al,vec3f(.7,.5,.2),ln(fract(o.y*9.)-.5,.03,px*9.)*.5);gl=.15;} // 책
else if(m==17.){ // 휘장판: 붉은 바탕 + 금 원환 + 햇살 무늬 (추상)
let q=vec2f(o.x,o.y-4.3);let r=length(q);let a=atan2(q.y,q.x);
al=vec3f(.34,.03,.035)*(.85+.25*nz(o.xy*5.));
let ring=max(ln(r-1.25,.05,px),ln(r-1.05,.025,px));let ray=smoothstep(.6,.9,sin(a*16.))*smoothstep(1.,.3,r)*smoothstep(.1,.35,r);
al=mix(al,vec3f(.8,.58,.24),max(ring,ray*.55));gl=.2;met=max(ring,ray*.5);
}
else if(m==18.){ // 비단 벽지: 다마스크 무늬
let q=vec2f(P.x+P.z,P.y)*2.2;let f=fract(q)-.5;let pat=smoothstep(.22,.18,length(f*vec2f(1.,1.6)-vec2f(0.,.06*sin(q.y*6.))));
al*=.92+.1*pat*fd(.2,px)+.05*nz(q*3.);gl=.18;
}
else if(m==19.){ // 쪽모이 바닥 (바구니 짜임)
let c=floor(P.xz/.48);let f=fract(P.xz/.48);let ck=(c.x+c.y)%2.;let s=select(f.y,f.x,abs(ck)>.5);let pl=floor(s*4.);
al=vec3f(.36,.2,.1)*(.75+.45*hash21(c*3.+pl))*(.85+.25*nz(select(vec2f(P.x*40.,P.z*2.),vec2f(P.x*2.,P.z*40.),abs(ck)>.5)));
al*=1.-.4*max(ln(fract(s*4.)-.5,.47,px*8.),max(ln(f.x-.5,.48,px*2.),ln(f.y-.5,.48,px*2.)))*fd(.05,px);gl=.6;
}
else if(m==20.){al=vec3f(.02,.12,.04);gl=.85;em=vec3f(.03,.22,.06)*(.5+.5*smoothstep(.0,-.06,o.y-1.2));} // 초록 램프 갓
else if(m==21.){al*=.5;} // 전실
else if(m==22.){ // 집무실 양탄자: 테두리 · 메달리온
let q=P.xz-vec2f(19.,65.8);let e=min(3.4-abs(q.x),3.8-abs(q.y));let r=length(q*vec2f(1.,.85));
al=vec3f(.3,.05,.05)*(.85+.25*nz(P.xz*7.));
al=mix(al,vec3f(.08,.07,.14),smoothstep(.25,.27,e)*(1.-smoothstep(.55,.57,e)));al=mix(al,vec3f(.7,.55,.3),ln(e-.6,.03,px)+ln(e-.22,.02,px));
al=mix(al,vec3f(.65,.5,.3),ln(r-1.1,.05,px)+smoothstep(.5,.45,r)*.6);al=mix(al,vec3f(.1,.07,.13),smoothstep(1.05,1.,r)*smoothstep(.5,.55,r)*.6);gl=.02;
}
// 접지 AO: 바닥·천장 구석, 수직면 아랫부분
let wd=wallD(P);
if(N.y>.9||N.y<-.9){ao*=mix(.45,1.,smoothstep(0.,1.,wd));}
else{ao*=mix(.6,1.,smoothstep(0.,.7,P.y-select(0.,4.2,P.x>32.)));}
var c=shade(P,N,E,al,gl,met,ao);
if(m==0.||m==19.){ // 바닥 반사: 위쪽 밝은 등의 흐릿한 상
let R=reflect(-E,N);var rf=vec3f(0.);
for(var k=0;k<16;k++){if(k>=i32(u.s.y)){break;}let a=u.l[k*2];let v=a.xyz-P;let d=length(v);if(d>a.w*1.4){continue;}
rf+=u.l[k*2+1].rgb*pow(max(dot(R,v/d),0.),mix(60.,900.,gl))*mix(.6,3.,gl)/(1.+d*.3);}
c+=rf*mix(.04,.5,pow(1.-max(dot(N,E),0.),3.))*gl;
}
return vec4f(fogAt(c+em,P),1.);
}`;
  /* ── GPU ── */
 let mod,bgl,bg,vb,xb,ib,ub,ms,pipe,pipeS;
 const UB=new Float32Array(4+24+64);
 const mkp=(vs,fs,o)=>G.dev.createRenderPipeline({
  layout: G.layout(bgl),vertex: { module: mod,entryPoint: vs,buffers: [
   { arrayStride: 40,attributes: [[0,0,'x3'],[1,12,'x3'],[2,24,'x3'],[3,36,'']].map(([l,o,f])=>({ shaderLocation: l,offset: o,format: 'float32'+f })) },
   { arrayStride: 80,stepMode: 'instance',attributes: [4,5,6,7,8].map((l,i)=>({ shaderLocation: l,offset: i*16,format: 'float32x4' })) }] },
  fragment: fs?{ module: mod,entryPoint: fs,targets: [{ format: G.HDR }] }:undefined,primitive: { cullMode: 'none' },...o });
 const run=(p,pl,sh)=>{
  if (!vb||!pl) return;
  p.setPipeline(pl); p.setBindGroup(1,bg); p.setVertexBuffer(0,vb); p.setVertexBuffer(1,ib); p.setIndexBuffer(xb,'uint32');
  for (const b of B) if (!sh||b.fl&1) p.drawIndexed(b.n,b.c,b.i0,0,b.f);
 };
 for (let i=0; i<16; i++) { const l=LT[i],o=28+i*8; UB.set([l[0],l[1],l[2],l[3],WARM[0]*l[4]*3,WARM[1]*l[4]*3,WARM[2]*l[4]*3,0],o); }
 UB.set([.55*3*.55,.75*3*.55,.45*3*.55],28+14*8+4); // 책상 램프 (초록 갓 아래 따뜻한 빛)
 const near=[];
 G.register('palace',{
  init() {
   const dev=G.dev,U=GPUBufferUsage,buf=(a,usage)=>{ const b=dev.createBuffer({ size: a.byteLength,usage: usage|U.COPY_DST }); dev.queue.writeBuffer(b,0,a); return b; };
   try { build(); } catch (e) { G.err('palace build '+(e.stack||e)); }
   vb=buf(new Float32Array(V),U.VERTEX); xb=buf(new Uint32Array(X),U.INDEX); ib=buf(new Float32Array(IN),U.VERTEX); ub=buf(UB,U.UNIFORM); V=X=IN=0;
   bgl=dev.createBindGroupLayout({ entries: [{ binding: 0,visibility: GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer: {} }] });
   bg=dev.createBindGroup({ layout: bgl,entries: [{ binding: 0,resource: { buffer: ub } }] });
   mod=G.shader(WGSL,'palace');
   pipeS=mkp('vsS',null,{ depthStencil: { format: G.DEPTH,depthWriteEnabled: true,depthCompare: 'less',depthBias: 2,depthBiasSlopeScale: 2 } });
  },
  onQuality({ msaa: n }) {
   if (n==ms) return; ms=n;
   pipe=mkp('vs','fs',{ multisample: { count: n },depthStencil: { format: G.DEPTH,depthWriteEnabled: true,depthCompare: 'greater' } });
  },
  update(dt) {
   if (!PL.on) return;
   try {
    const D=S.doors,k=1-Math.exp(-dt*5);
    // 주 문: 값으로 부드럽게 따라감 (회의실·집무실 모두 바깥 → 안쪽 방향으로 열림)
    DA[0]+=(cl(+D.meet||0,0,1)-DA[0])*k; DA[2]+=(cl(+D.office||0,0,1)-DA[2])*k;
    const pl=G.people&&G.people.list||[];
    for (let i=0; i<SD.length; i++) { // 옆문: 사람이 가까이 오면 자동으로 열림 (S.doors.auto)
     const d=SD[i];let t=+D.side[i]||0;
     if (D.auto) for (const P of pl) { if (P.dead||P.vis===false||P.M) continue; if (hypot(P.p[0]-d[0],P.p[2]-d[1])<1.9&&abs(P.p[1]-(d[3]||0))<1.5) { t=1; break; } }
     DT[i]+=(t-DT[i])*(1-Math.exp(-dt*(t>DT[i]?7:2.5)));
    }
    const ang=[DA[0]*1.75,DA[0]*1.75,DA[2]*1.6,DA[2]*1.6];
    for (let i=0; i<4; i++) UB[4+i]=ang[i];
    for (let i=0; i<SD.length; i++) UB[8+i]=DT[i]*1.45;
    UB[0]=G.time; UB[1]=16; UB[2]=G.Q.level;
    // 사람 조명: 카메라에 가까운 등불 몇 개를 공용 점광으로 (반경 13.37 = 이 모듈 표식 → 자체 셰이더는 무시)
    const n=cl(S.lamps|0,0,3);
    if (n) {
     const c=G.cam.pos; near.length=0;
     for (let i=0; i<LT.length; i++) near.push([i,hypot(LT[i][0]-c[0],LT[i][1]-c[1],LT[i][2]-c[2])/LT[i][4]]);
     near.sort((a,b)=>a[1]-b[1]);
     for (let j=0; j<n; j++) { const l=LT[near[j][0]]; G.addLight([l[0],l[1],l[2]],WARM,min(1.8,.7*l[4]+.5),13.37,max(dt,1/120)*1.5); }
    }
   } catch (e) { G.err('[palace] '+(e.stack||e)); }
  },
  prepare() { PL.on&&ub&&G.dev.queue.writeBuffer(ub,0,UB); },
  shadow(p) { PL.on&&run(p,pipeS,1); },
  opaque(p) { PL.on&&run(p,pipe,0); }
 },'story');
}
