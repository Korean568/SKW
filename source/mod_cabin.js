'use strict';
/* CABIN — 여객기 안팎·추락 현장. 평면 공간: 원점 바닥 중앙,+Z 기수,+X 좌현 */
{
 const C=G.cabin={ M: M4.ident(),S: { hole: 0,gear: 1,gearDown: 0,power: 1,masks: 0,crash: 0,tv: 0 } },S=C.S;
 const { sin,cos,abs,hypot,PI,min,max,exp }=Math,L=G.lerp,cl=G.clamp,sm=(a,b,x)=>{ x=cl((x-a)/(b-a),0,1); return x*x*(3-2*x); };
 const CY=.6,R=1.98,RI=1.8,PZ=.8,Z1=11.6,WP=8/15,ZW=26*WP,TZ=-6.45,AC=.24,WA=.19,AF=-.34,AB=.6;
 const SX={ A: 1.46,B: .98,C: .5,D: -.5,E: -.98,F: -1.46 };
 const TR=M4.mul(M4.trs([-.5,.85,TZ-1.3],.1,.03,-.16),M4.trs([0,-1,-TZ])),TRI=M4.invert(TR); // 추락 후방 동체 변환
 let IM=M4.ident();
 C.place=(p,yaw=0,pitch=0,roll=0)=>{ C.M.set(M4.trs(p,yaw,pitch,roll)); IM=M4.invert(C.M); };
 C.w=p=>M4.point(C.M,p); C.l=p=>M4.point(IM,p);
 C.seat=(r,c)=>({ p: [SX[c],.5,Z1-(r-1)*PZ],yaw: 0 });
 // 추락 현장 지면(월드): 구릉·언덕·활주 고랑(−Z)·흙더미
 const MD=[[9,9],[-11,3],[13,-9],[-9,-17],[6,-27],[-14,22],[17,20],[-7,30]];
 C.ground=(x,z)=>{
  const d=hypot(x,z),a=(x-6e-4*z*z*(z<0))/3,k=sm(28,14,z)*sm(-190,-110,z);
  let h=sin(x*.031+1)*cos(z*.027)*.8+sm(100,290,d)*(8+5*sin(Math.atan2(x,z)*3+1)+3*sin(x*.05)*sin(z*.06));
  h+=k*(.75*exp(-((abs(a)-1.5) ** 2)*3)*(.6+.4*sin(z*.9+x))-1.3*exp(-a*a));
  for (const m of MD) h+=.9*exp(-((x-m[0]) ** 2+(z-m[1]) ** 2)/3);
  return h;
 };
 const gp=(x,z,y=0)=>[x,C.ground(x,z)+y,z];
 const ENG=[8,-36],WNG=[20,-24];
 C.K={
  hole: [1.8,1,2.8],lavF: [.3,0,13.17],lavA: [.3,0,-13.17],doors: [[1.7,0,14.45],[-1.7,0,14.45],[1.7,0,-14.45],[-1.7,0,-14.45]],aisle: [-14.7,14.7],tail: [0,1,TZ],
  site: { pos: gp(0,0,1.12),yaw: 0,pitch: 0,roll: .1 },// 권장 추락 배치
  spawn: [[16,8],[20,-6],[-17,10],[-18,-12],[11,-22],[-9,-30],[4,34],[-5,36],[28,2],[-27,-3]].map(p=>gp(...p)),
  cover: [...MD.map(m=>[...gp(...m,.3),1.5,.45,1.5]),[...gp(...ENG,1),1.3,1.1,2.5],[...gp(...WNG,.6),7,.7,3.5]]
 };
  /* 충돌·광선 (평면 상자 [x0,x1,y0,y1,z0,z1,통과,후방]) */
 const BX=[],bx=(a,b,z0,z1,h=0,k=0)=>BX.push([min(a,b),max(a,b),0,h,z0,z1,k,+(z1<=TZ)]);
 for (const s of [1,-1]) {
  const a=s*.27,b=s*1.75,c=s*1.62,d=s*2.05;
  bx(a,b,3.92,11.92,1.1); bx(a,b,1.58,3.92,1.1,s>0); bx(a,b,TZ+.03,1.58,1.1); bx(a,b,-12.02,TZ-.03,1.1);
  bx(s*.3,b,12.45,13.9,2.1); bx(s*.3,b,-13.9,-12.45,2.1);
  bx(c,d,TZ,1.75); bx(c,d,1.75,3.85,0,s>0); bx(c,d,3.85,14); bx(c,d,14,14.9,0,2); bx(c,d,14.9,19.5);
  bx(c,d,-14,TZ); bx(c,d,-14.9,-14,0,2); bx(c,d,-21,-14.9);
 }
 bx(-1.62,1.62,15,15.3,2.1); bx(-1.62,1.62,-15.3,-15,2.1);
 const open=b=>(b[6]==1&&S.hole>.5)||(b[6]==2&&S.crash);
 const push=(p,r,af)=>{
  for (const b of BX) {
   if ((S.crash&&b[7]!=af)||open(b)) continue;
   const cx=cl(p[0],b[0],b[1]),cz=cl(p[2],b[4],b[5]),dx=p[0]-cx,dz=p[2]-cz,d=hypot(dx,dz);
   if (d>=r) continue;
   if (d>1e-6) { p[0]=cx+dx/d*r; p[2]=cz+dz/d*r; }
   else if (b[3]&&b[0]*b[1]>0) p[0]=b[0]>0?b[0]-r:b[1]+r; // 좌석: 통로로
   else { const a=[p[0]-b[0],b[1]-p[0],p[2]-b[4],b[5]-p[2]],k=a.indexOf(min(...a)); p[k&2]+=(k&1?1:-1)*(a[k]+r); }
  }
  return p;
 };
 C.collide=(p,r=.25)=>{ r=min(r,.22); const q=push([...p],r,0); return S.crash?M4.point(TR,push(M4.point(TRI,q),r,1)):q; };
 const cast=(o,d,t,af)=>{
  const z0=af?-21:S.crash?TZ:-21,z1=af?TZ:19.5,H=C.K.hole;
  const ok=s=>{
   const x=o[0]+d[0]*s,y=o[1]+d[1]*s,z=o[2]+d[2]*s;
   return s>1e-4&&s<t&&z>z0&&z<z1&&!(S.hole>.5&&!af&&hypot(x-H[0],y-H[1],z-H[2])<1.1)&&!(S.crash&&abs(abs(z)-14.45)<.42&&y<1.9&&abs(x)>1);
  };
  const a=d[0]*d[0]+d[1]*d[1],b=o[0]*d[0]+(o[1]-CY)*d[1],D=b*b-a*(o[0]*o[0]+(o[1]-CY) ** 2-RI*RI);
  if (a>1e-9&&D>0) { const q=Math.sqrt(D); if (ok((-b-q)/a)) t=(-b-q)/a; else if (ok((q-b)/a)) t=(q-b)/a; }
  if (d[1]<0) { const s=-o[1]/d[1]; if (abs(o[0]+d[0]*s)<1.7&&abs(o[2]+d[2]*s)<15&&ok(s)) t=s; }
  for (const b of BX) {
   if (!b[3]||(S.crash&&b[7]!=af)||open(b)) continue;
   let s0=0,s1=t;
   for (let i=0; i<3&&s0<=s1; i++) { const v=1/d[i],e=(b[i*2]-o[i])*v,f=(b[i*2+1]-o[i])*v; s0=max(s0,min(e,f)); s1=min(s1,max(e,f)); }
   if (s0<=s1&&s0>0) t=s0;
  }
  return t;
 };
 C.ray=(o,d,mx)=>{
  if (!S.crash) return cast(o,d,mx,0);
  const q=M4.point(TRI,o);
  return min(cast(o,d,mx,0),cast(q,V3.sub(M4.point(TRI,V3.add(o,d)),q),mx,1));
 };
  /* 형상: 정점 10 float (위치·법선·색·재질) + 색인 */
 let V=[],X=[],IN=[]; const B=[];
 // 격자 곡면 f(u,v),법선 유한 차분
 const surf=(nu,nv,f,c,m,fl)=>{
  const b=V.length/10,e=.002,g=t=>cl(t,.004,.996);
  for (let j=0; j<=nv; j++) for (let i=0; i<=nu; i++) {
   const u=i/nu,v=j/nv,p=f(u,v),n=V3.norm(V3.cross(V3.sub(f(g(u)+e,g(v)),f(g(u)-e,g(v))),V3.sub(f(g(u),g(v)+e),f(g(u),g(v)-e))));
   V.push(...p,...(fl?V3.mul(n,-1):n),...(c.call?c(p,u,v):c),m);
   if (i<nu&&j<nv) { const q=b+j*(nu+1)+i,r=q+nu+1; X.push(q,r,q+1,q+1,r,r+1); }
  }
 };
 // 초타원체: e=2 타원체,클수록 둥근 상자. w 변형
 const sp=(t,e)=>Math.sign(t)*abs(t) ** (2/e);
 const pill=(c,h,e,col,m,w,nu=12,nv=8)=>surf(nu,nv,(u,v)=>{
  const a=u*2*PI,b=(v-.5)*PI,k=sp(cos(b),e),p=[c[0]+h[0]*k*sp(cos(a),e),c[1]+h[1]*sp(sin(b),e),c[2]+h[2]*k*sp(sin(a),e)];
  return w?w(p):p;
 },col,m,1);
 // 동체 띠: f(u)→[z,y,r],각 a0..a1
 const ring=(nu,nv,f,a0,a1,c,m,fl)=>surf(nu,nv,(u,v)=>{ const [z,y,r]=f(u),a=L(a0,a1,v); return [r*cos(a),y+r*sin(a),z]; },c,m,fl);
 const cr=(P,t)=>{
  const n=P.length-1,x=cl(t,0,1)*n,i=min(x|0,n-1),f=x-i,g=k=>P[cl(i+k,0,n)];
  return [0,1].map(d=>{ const a=g(-1)[d],b=g(0)[d],c=g(1)[d],e=g(2)[d]; return b+.5*f*(c-a+f*(2*a-5*b+4*c-e+f*(3*(b-c)+e-a))); });
 };
 // 관: 경로 f(v),반지름 r
 const tube=(f,r,c,m,n=8)=>surf(5,n,(u,v)=>{ const t=V3.norm(V3.sub(f(v+.01),f(v-.01))),a=V3.norm(V3.cross(t,[0,0,1])),b=V3.cross(t,a),k=u*2*PI; return V3.add(f(v),V3.add(V3.mul(a,r*cos(k)),V3.mul(b,r*sin(k)))); },c,m);
 // 익형 날개: A·ca → B·cb,두께비 th,축 ax
 const foil=(A,ca,B,cb,th,ax,col,fl,w)=>surf(24,20,(u,v)=>{
  const p=V3.lerp(A,B,u),ch=L(ca,cb,u),x=(1+cos(v*2*PI))/2;
  p[2]-=x*ch; p[ax]+=(v<.5?5:-5)*th*ch*(.2969*Math.sqrt(x)-x*(.126+x*(.3516-x*(.2843-x*.1015))));
  return w?w(p,u):p;
 },col,6,fl);
 const rnd=G.rng(5);
 const ins=(p,yaw=0,part=0,flag=0,w=0,pitch=0,roll=0,s=1)=>[...M4.trs(p,yaw,pitch,roll,s),part,rnd(),flag,w];
 // 배치: 형상 fn + 인스턴스(또는 공유). fl 1 그림자·2 유리·4 현장
 const bat=(fn,I,fl=1)=>{ const i0=X.length; fn(); const b={ i0,n: X.length-i0,f: I.f??IN.length/20,c: I.c??I.length,fl }; if (I.map) for (const q of I) IN.push(...q); B.push(b); return b; };
 const W=[1,1,1],WG=[.62,.64,.66],LC=[.58,.6,.63],NV=[.03,.045,.1],PG=[.55,.57,.6],DK=[.045,.045,.05],MT=[.5,.5,.52],MC=[.58,.59,.62];
 const rc=p=>{ const y=p[1]-.42,z=p[2]+.24; p[1]=.42+y*.978+z*.208; p[2]=-.24+z*.978-y*.208; return p; }; // 등받이 12° 젖힘
 const SY=rc([0,.9,-.36])[1],SH=rc([0,1.06,-.36])[1]-SY;
 const fus=z=>{ const n=cl((z-15)/4.5,0,1),t=cl((-15-z)/6,0,1),r=R*(1-n ** 2.4) ** .62*L(1,.08,t ** 1.7); return [z,CY-.5*n*n+(R-r)*.8*(t>0),r]; };
 const wp=(z,a,r)=>[r*cos(AC+a),CY+r*sin(AC+a),z];
 const sq=u=>{ const t=u*4 % 4,k=t|0,f=(t-k)*2-1; return [[1,f],[-f,1],[-1,-f],[f,-1]][k]; };
 const plate=(r0,hz,ha,r1,kz,ka,c,m,fl,nv=3)=>surf(32,nv,(u,v)=>{
  const [sx,sy]=sq(u),x=sx*WP/2,y=sy*WA,k=(abs(x/hz) ** 4+abs(y/ha) ** 4) ** -.25,q=kz?(abs(x/kz) ** 4+abs(y/ka) ** 4) ** -.25:1;
  return wp(x*L(k,q,v),y*L(k,q,v),L(r0,r1,v));
 },c,m,fl);
 const build=()=>{
  const inF=p=>{ const d=hypot(p[0],p[1]-CY)/(RI-.02); if (d>1) { p[0]/=d; p[1]=CY+(p[1]-CY)/d; } return p; };
  const sides=[1,-1],lin=p=>V3.mul(LC,L(.6,1,sm(0,.35,p[1])));
    /* 창 칸 (104): 내장·외피·창턱·덮개/유리 */
  const cells=[]; for (let k=0; k<104; k++) cells.push(ins([0,0,(k % 52-25.5)*WP*(k<52?1:-1)],k<52?0:PI,0,0,rnd()<.8?0:.3+rnd()*.7));
  const cb=bat(()=>{
   plate(RI,.15,.11,RI,0,0,lin,0,1); plate(R,.115,.085,R,0,0,W,6);
   plate(RI,.15,.11,R-.01,.115,.085,[.5,.51,.5],0,0,2);
   surf(2,6,(u,v)=>wp(L(-.17,.17,u),L(-.125,.125,v),1.88),[.66,.66,.63],10);
  },cells);
  bat(()=>plate(R-.02,1e-3,1e-3,R-.02,.115,.085,W,8,0,1),cb,2);
    /* 동체: 외피·내장·바닥·선반·격벽·날개·꼬리 */
  const zs=(a,b,r)=>u=>r?[L(a,b,u),CY,r]:fus(L(a,b,u));
  const wing=s=>{
   foil([s*1.5,-.85,3.8],6.4,[s*17.2,.55,-4.2],1.45,.12,1,WG,s>0,(p,u)=>{ const k=max(0,u-.9)*10; p[1]+=k*k*1.9; return p; });
   for (const x of [4.3,8,11.5]) pill([s*x,-1.12+x*.089,.2-x*.33],[.17,.2,1.4],2.2,WG,6);
   pill([s*17.25,2.42,-5.3],[.04,.04,.1],2,s>0?[1,.03,.02]:[.03,1,.1],12,0,6,4);
  };
  bat(()=>{
   ring(26,40,zs(ZW,19.5),0,2*PI,W,6,1); ring(22,40,zs(-21,-ZW),0,2*PI,W,6,1);
   ring(52,20,zs(-ZW,ZW),AC+WA,PI-AC-WA,W,6,1); ring(52,28,zs(-ZW,ZW),PI-AC+WA,2*PI+AC-WA,W,6,1);
   for (const s of sides) {
    const m=(a,b)=>s>0?[a,b]:[PI-b,PI-a];
    ring(56,5,zs(-15,15,RI),...m(AF,AC-WA),lin,0); ring(56,3,zs(-15,15,RI),...m(AC+WA,AB+.05),lin,0);
    for (const e of [ZW,-15]) ring(3,6,zs(e,e+15-ZW,RI),...m(AC-WA,AC+WA),lin,0);
    surf(60,32,(u,v)=>{ const [x,y]=cr([[1.5,1.6],[1.4,1.615],[.8,1.63],[.64,1.66],[.565,1.8],[.56,1.98],[.61,2.09],[.54,2.12],[.4,2.14],[.15,2.17],[0,2.175]],v); return [s*x,y,L(-15,15,u)]; },p=>V3.mul([.62,.63,.66],L(.55,1,sm(1.5,1.3,abs(p[0])))),11,s<0);
    for (const z of [13.17,-13.17]) pill([s*1.02,1.06,z],[.72,1.07,.72],9,MC,14,inF,16,12);
    surf(20,6,(u,v)=>[s*(.29+.16*u),L(.06,2.1,v),12.38+.035*sin(u*30)*(.5+.5*v)],[.05,.07,.13],15);
    foil([s*.5,1.75,-16.4],3.4,[s*6.3,2.25,-19.5],1.2,.1,1,WG,s>0);
   }
   for (const z of [15.03,-15.03]) pill([0,1.05,z],[1.75,1.2,.04],9,MC,14,inF,16,12);
   surf(60,8,(u,v)=>[L(-1.72,1.72,v),0,L(-15,15,u)],[.1,.11,.14],2);
   pill([0,-1.2,.5],[1.9,.6,5],2.5,WG,6);
   wing(-1); foil([0,2.2,-13.4],5.8,[0,8.7,-18.7],2,.1,0,W);
   pill([0,2.9,-21],[.05,.05,.08],2,W,12,0,6,4); pill([0,CY+R,2],[.06,.05,.1],2,[1,.03,.02],12,0,6,4);
  },[ins([0,0,0])]);
  const WM=M4.trs(gp(...WNG,1.6),2.2,.05,.12);
  bat(()=>wing(1),[ins([0,0,0],0,0,6),[...WM,2,.5,5,0]]);
    /* 엔진 (회전체) + 파일런 */
  const NP=[[-.9,0],[-.9,.4],[-.9,.68],[-.3,.72],[0,.84],[-.25,1],[-1.3,1.08],[-2.9,.95],[-4.1,.64],[-4.2,.5],[-4,.42],[-4.9,.1]];
  bat(()=>{
   surf(48,44,(u,v)=>{ const [z,r]=cr(NP,v),a=u*2*PI; return [r*cos(a),r*sin(a),z]; },(p,u,v)=>v<.17?V3.mul([.1,.1,.11],.3+(sin(u*75.4)>0)):v>.8?[.2,.19,.18]:v<.42?MT:WG,6,1);
   pill([0,0,-.8],[.2,.2,.4],2,MT,6); pill([0,1,-2.7],[.13,.47,2],2.6,WG,6);
  },[ins([-5.9,-2,5.6]),ins([5.9,-2,5.6],0,0,6),ins(gp(...ENG,.75),.8,2,5,0,.05,.5)]);
    /* 착륙 장치 (flag 4: 떨어져 나감) */
  bat(()=>{ for (const [x,z,r,l] of [[0,14.2,.36,1.75],[3.3,-1.4,.52,1.6],[-3.3,-1.4,.52,1.6]]) {
   pill([x,-1-l/2,z],[.07,l/2+.3,.07],2.5,MT,6,0,8,4);
   for (const s of sides) pill([x+s*.24,-1.2-l,z],[.13,r,r],2.7,DK,6,0,10,12);
  } },[ins([0,0,0],0,0,4)]);
    /* 좌석 (180) */
  const seats=[];
  for (let r=0; r<30; r++) for (const c in SX) seats.push(ins([SX[c],0,Z1-r*PZ],0,0,+(r>9&&r<13&&SX[c]>.9)));
  bat(()=>{
   const ao=c=>p=>V3.mul(c,L(.3,1,sm(0,.5,p[1])));
   pill([0,.385,.07],[.215,.068,.25],3,ao(NV),1,p=>{ p[1]+=.05*p[2]; return p; },14,8);
   pill([0,.8,-.27],[.21,.37,.05],3.4,ao(NV),1,p=>{ p[2]+=1.1*p[0]*p[0]; return rc(p); },14,10);
   pill([0,1.1,-.25],[.15,.1,.045],3,NV,1,p=>{ p[2]+=2.4*p[0]*p[0]; return rc(p); },14,8);
   pill([0,.76,-.325],[.218,.41,.03],5,PG,9,rc,12,10);
   surf(1,1,(u,v)=>rc([L(.13,-.13,u),L(.9,1.06,v),-.36]),DK,5);
   pill([0,.64,-.355],[.19,.1,.012],6,[.42,.43,.45],9,rc);
   pill([0,.4,-.33],[.18,.09,.024],4,[.025,.025,.03],15,rc,8,6);
   pill([0,.3,.04],[.22,.035,.24],4,DK,9,0,8,6);
   pill([0,.466,0],[.21,.006,.02],4,[.2,.2,.21],15,0,8,4); pill([0,.472,0],[.028,.008,.026],4,MT,3,0,6,4);
   pill([0,.09,.27],[.235,.011,.011],3,MT,3,0,8,4);
   for (const s of sides) {
    pill([s*.24,.63,0],[.024,.022,.2],3,DK,9,0,8,6);
    pill([s*.17,.14,.05],[.016,.14,.16],3,MT,3,0,6,4);
   }
  },seats);
    /* 산소 마스크 (flag 3): PSU 덮개·컵·끈 / 관·백 */
  const mk=[];for(let r=0;r<30;r++) for(const s of sides) mk.push(ins([s*.98,1.625,Z1-r*PZ+.22],0,0,3));
  const cup=k=>{const A=V3.norm([.12*(k-1),-.55,-.84]),T=V3.norm(V3.cross(A,[1,0,0])),Q=V3.cross(T,A),C=[(k-1)*.3,-.47+.03*(k&1),-.04];
   return (v,a,s=1)=>V3.add(C,V3.add(V3.mul(A,.06*v-.06),V3.add(V3.mul(Q,.052*s*cos(a)),V3.mul(T,.06*s*sin(a)))));};
  const mb=bat(()=>{
   pill([0,-.004,0],[.4,.005,.06],6,DK,9,0,8,4);
   surf(1,1,(u,v)=>[L(-.3,.3,u),-.1*v,-.063-.02*v],[.6,.62,.65],9);
   for(let k=0;k<3;k++){const c=cup(k);
    surf(12,4,(u,v)=>c(v,u*2*PI,Math.sqrt(v)),(p,u,v)=>v>.8?[.85,.8,.62]:[.82,.5,.05],9);
    tube(v=>c(1,v*PI,1.08+.6*sin(v*PI)).map((x,i)=>x-(i==1)*.07*sin(v*PI)),.0025,[.92,.92,.9],17,10);
  }},mk,0);
  bat(()=>{for(let k=0;k<3;k++){const c=cup(k),b=c(0,0,0);
   pill(V3.add(b,[0,.075,.012]),[.042,.07,.012],2.2,[.85,.9,.9],19,p=>{p[2]+=.006*sin(p[1]*90+p[0]*60);return p;},8,6);
   tube(v=>[L((k-1)*.12,b[0],v),L(-.01,b[1]+.145,v),L(.02,b[2]+.012,v)+.03*sin(v*PI)],.003,[.55,.7,.82],16);
 }},mb,2);
    /* 구멍 (flag 2): 프레임·외피 립·세로대·단열재·전선·천장판 */
  const H=C.K.hole,aH=Math.atan2(H[1]-CY,H[0]),hs=k=>{k=sin(k*127.1)*43758.5;return k-Math.floor(k);},on=(z,s,r)=>{const a=aH+s/R;return [r*cos(a),CY+r*sin(a),H[2]+z];};
  const bl=p=>{const k=exp(-.9*((p[0]-H[0]) ** 2+(p[1]-H[1]) ** 2+(p[2]-H[2]) ** 2));p[0]+=.55*k;p[1]+=(p[1]-H[1])*.25*k;p[2]+=(p[2]-H[2])*.3*k;return p;};
  bat(()=>{
   for(let k=3;k<9;k++) surf(26,5,(u,v)=>{const a=L(-.5,1.25,u),b=v*2*PI,r=1.89+.05*cos(b);return bl([r*cos(a),CY+r*sin(a),k*WP+.018*sin(b)]);},[.32,.37,.27],3);
   for(let j=0;j<16;j++){const f=(j+.4*hs(j))/16*2*PI,c=cos(f),s=sin(f),t0=.55+.35*hs(j+9),w=.1+.14*hs(j+3),b=.1+.25*hs(j+5);
    surf(3,10,(u,v)=>{const p=L(1.7,t0,v),t=(u-.5)*2*w*((p-t0)/(1.7-t0)+.08)*(.8+.2*sin(p*41+j));return on(p*c-t*s,p*s+t*c,R+.006+b*sm(1.25,t0,p) ** 2);},[.42,.44,.47],20);
  }
   for(let j=0;j<10;j++){const s=(j>>1)*.32-.55,g=j&1?1:-1,e=.45+.5*hs(j+20);
    surf(10,1,(u,v)=>on(g*L(1.8,e,u),s,R-.012-.035*v+.25*sm(1.1,e,L(1.8,e,u)) ** 2),[.34,.38,.3],3);
  }
   for(let j=0;j<12;j++){const a=hs(j+5),c=hs(j+11),z0=1.55+j*.25+.1*a,wd=.1+.22*hs(j+7),ln=.15+.65*c*c,x0=1.48+.16*hs(j),q=(a-.5)*3;
    surf(5,12,(u,v)=>{const t=wd*(u-.5),k=q*v;return [x0+.35*c*v*v+t*sin(k)+.03*sin(u*3)*(1+v),1.62-.06*a-ln*v,z0+t*cos(k)+.05*v*sin(j+v*3)];},(p,u,v)=>[u,v,j*.13],4);
  }
   for(const [x,y,z,l,c] of [[1.56,1.62,2.1,.7,DK],[1.6,1.62,3.3,.55,[.6,.6,.58]],[1.54,1.62,2.6,.4,[.35,.06,.04]],[.15,2.16,2.5,.55,DK]]) tube(v=>[x+.12*v*v*(x>1),y-l*v,z+.06*sin(v*3+z)],.008,c,9);
   for(const [z0,z1,t,q] of [[2.06,2.43,.85,1],[2.47,2.86,.5,0]]) surf(6,4,(u,v)=>{const s=.44*u,a=t+.2*u*v;return [s*cos(a),2.165-s*sin(a),L(z0,z1,v)+.03*sin(u*23)*(q?v:1-v)];},[.62,.63,.65],9);
 },[ins([0,0,0],0,0,2)],0);
    /* 추락 현장: 지면 · 나무 · 짐 */
  bat(()=>surf(128,128,(u,v)=>{ const s=u*2-1,t=v*2-1; return gp(s*abs(s) ** 1.6*320,t*abs(t) ** .3*320); },p=>{
   const e=C.ground(p[0],p[2])-sin(p[0]*.031+1)*cos(p[2]*.027)*.8;
   return [sm(.12,.5,abs(e))*sm(120,90,hypot(p[0],p[2])),1,0];
  },7),[[...M4.ident(),2,.5,0,0]],4);
  const tr=[],lg=[];
  for (let k=0; k<300; k++) { const a=rnd()*6.283,d=75+rnd()*rnd()*220,x=sin(a)*d,z=cos(a)*d; if (abs(x)>16||z>0) tr.push(ins(gp(x,z,-.3),a,2,0,0,0,0,.9+rnd()*.9)); }
  bat(()=>{
   pill([0,1.5,0],[.25,1.7,.25],2,[.09,.065,.045],13,0,6,3);
   for (const [x,y,z,r] of [[0,5.4,0,2.6],[1.3,3.9,.6,1.9],[-1.1,4.1,-.9,2]]) pill([x,y,z],[r,r*1.2,r],2,[.03,.06,.02],13,p=>{ const k=1+.25*sin(p[0]*3.1+p[1]*2)*sin(p[2]*2.7+p[1]); return [p[0]*k,p[1],p[2]*k]; },10,7);
  },tr,5);
  for (let k=0; k<30; k++) { const z=8-rnd()*55,x=(rnd()-.5)*(14+abs(z)*.3); lg.push(ins(gp(x,z,.14),rnd()*6,2,0,0,rnd()*.4,rnd()<.5?0:1.57,.7+rnd()*.6)); }
  bat(()=>pill([0,0,0],[.36,.13,.25],5,[.3,.2,.2],15,0,10,6),lg,5);
 };
  /* 셰이더 */
 const WGSL = /* wgsl */`
struct U{M:mat4x4f,A:mat4x4f,s:vec4f,t:vec4f,h:vec4f}; // s 구멍·전원·마스크·추락 t TV·기어·파단 z h 구멍
@group(1)@binding(0)var<uniform>u:U;
@group(1)@binding(1)var scr:texture_2d<f32>;
struct I{@location(0)p:vec3f,@location(1)n:vec3f,@location(2)c:vec3f,@location(3)m:f32,@location(4)a:vec4f,@location(5)b:vec4f,@location(6)d:vec4f,@location(7)e:vec4f,@location(8)t:vec4f};
 // w 월드 n 법선 l 평면 o 메시 q 평면 법선 k (후방,실내,난수)
struct V{@builtin(position)p:vec4f,@location(0)w:vec3f,@location(1)n:vec3f,@location(2)c:vec3f,@location(3)@interpolate(flat)m:f32,@location(4)l:vec3f,@location(5)o:vec3f,@location(6)q:vec3f,@location(7)k:vec3f};
fn tf(i:I,vp:mat4x4f)->V{
var p=i.p;let f=i.t.z;let cr=u.s.w>.5;let hl=u.s.x>.5;
let z=(f==1.&&hl)||(f==2.&&!hl)||(f==5.&&!cr)||(f==6.&&cr)||(f==4.&&(cr||u.t.y>300.))||(f==3.&&u.s.z<.01);
if(i.m==10.){let a=(1.-i.t.w)*.27;let d=p.xy-vec2f(0.,${CY});p=vec3f(d.x*cos(a)-d.y*sin(a),${CY} +d.x*sin(a)+d.y*cos(a),p.z);}
if(f==3.){p.y=min(p.y+(1.-u.s.z)*.8,0.);let s=p.y*.14*sin(g.cam.w*vec2f(2.1,1.7)+i.t.y*40.+p.x*5.);p=vec3f(p.x+s.x,p.y,p.z+s.y);}
if(i.m==4.){p+=vec3f(.06,0.,.03)*sin(g.cam.w*vec3f(9.,0.,6.)+i.c.z*7.+i.c.y*3.)*i.c.y*i.c.y*(1.-.8*u.s.w);}
let M=mat4x4f(i.a,i.b,i.d,i.e);var l=(M*vec4f(p,1.)).xyz;let q=normalize((M*vec4f(i.n,0.)).xyz);
if(f==4.){l-=vec3f(0.,1.,.7)*u.t.y;}
var w=l;var n=q;var sd=0.;var c=i.c;var o=i.p;
if(i.t.x>1.5){c*=.55+.9*i.t.y;}
else if(l.z<u.t.z){sd=1.;w=(u.A*vec4f(l,1.)).xyz;n=(u.A*vec4f(q,0.)).xyz;}
else{w=(u.M*vec4f(l,1.)).xyz;n=(u.M*vec4f(q,0.)).xyz;}
if(i.m==16.||i.m==17.){let e=max((vp*vec4f(w,1.)).w*1.2/(g.res.y*length(vec3f(vp[0].y,vp[1].y,vp[2].y)))-.003,0.);w+=n*e;o.x=.003/(.003+e);}
return V(select(vp*vec4f(w,1.),vec4f(9.,9.,9.,1.),z),w,n,c,i.m,l,o,q,vec3f(sd,f32(i.t.x<1.5&&i.m!=6.&&i.m!=12.),i.t.y));
}
@vertex fn vs(i:I)->V{return tf(i,g.viewProj);}
@vertex fn vsS(i:I)->V{return tf(i,g.shadowVP);}
fn nz(p:vec2f)->f32{return textureSampleLevel(noiseTex,linSamp,p,0.).x;}
fn cut(i:V)->f32{ // <0 버림,0..1 그을음,2 찢긴 테두리
let m=i.m;let P=i.l;let cr=u.s.w>.5;let c=i.c;
if(cr&&abs(i.k.x-.5)<.499){return-1.;}
if(m==4.){return select(0.,-1.,abs(c.x-.5)>.5-.2*nz(vec2f(c.y*.05,c.z))-.08*nz(vec2f(c.y*.11,c.z+.3))-.08*c.y||c.y>.55+.45*nz(vec2f(c.x*.04+c.z,.5)));}
let fr=m==2.||m==11.;
if(m==11.&&u.s.x>.5&&P.x>0.&&P.x<.44&&abs(P.z-2.46)<.4&&P.y>2.1){return-1.;}
if(!fr&&m!=0.&&m!=6.&&m!=8.&&m!=3.&&m!=10.&&m!=20.){return 0.;}
if(cr){
if(abs(P.z-u.t.z)<.1+.5*nz(vec2f(P.x*.07+P.y*.05,.3))){return-1.;}
if(!fr&&abs(abs(P.z)-14.45)<.42&&abs(P.y-.95)<.95&&abs(P.x)>1.){return-1.;}
}
let v=P-u.h.xyz;let d=length(v);
if(fr||d>2.7||u.s.x<.01){return 0.;}
let e=v.zy/d;let n=nz(e*.04)*.7+abs(nz(e*.13+.5)-.5)*.7;
let r=u.h.w*u.s.x*(.7+.6*n)*select(1.,.7,m==3.);
if(m!=20.&&d<r){return-1.;}
if(d<r+.02&&(m==0.||m==6.)){return 2.;}
if(m==20.){return clamp(1.9-d,0.,.9)*nz(v.zy*.05)*1.6;}
return (1.-smoothstep(r,r+.15+.6*nz(v.zy*vec2f(.04,.1)),d))*u.s.x*(.75+.25*nz(v.zy*.08))*select(1.,.6,m==3.);
}
@fragment fn fsS(i:V){if(cut(i)<0.){discard;}}
fn fd(s:f32,px:f32)->f32{return clamp(s/px*.35-.5,0.,1.);}
fn ln(x:f32,w:f32,px:f32)->f32{return 1.-smoothstep(w,w+px,abs(x));}
@fragment fn fs(i:V)->@location(0)vec4f{
let px=length(fwidth(i.w))+1e-4;let ch=cut(i);if(ch<0.){discard;}
let m=i.m;let P=i.l;let o=i.o;let E=normalize(g.cam.xyz-i.w);let pw=u.s.y;let ax=abs(P.x);
var N=normalize(i.n);var Q=normalize(i.q);let bk=dot(N,E)<0.;if(bk){N=-N;Q=-Q;}
var al=i.c;var gl=.08;var em=vec3f(0.);var ao=1.;
if(m==1.||m==15.){
let wv=sin(o.x*1300.)*sin((o.y+o.z)*1300.);
al*=1.+.4*wv*fd(.005,px)+(nz(o.xy*1.7+o.z)-.5)*.3;
if(m==1.){al=mix(al,al*2.2+.012,ln(o.x,.1,.008)*step(o.y,1.));
if(o.y>1.06){al=vec3f(.6,.61,.6)*(1.+.15*wv*fd(.005,px));}}
}else if(m==2.){
al*=1.+.45*sin((P.x+P.z)*44.)*sin((P.x-P.z)*44.)*fd(.07,px)+(nz(P.xz*3.)-.5)*.5*fd(.01,px);
ao=mix(1.,.3,smoothstep(.25,.5,ax)*step(abs(P.z),12.3));
em=vec3f(.2,1.3,.5)*ln(ax-.262,.008,px)*step(.25,fract(P.z*2.))*(1.-pw)*2.5;
}else if(m==0.){
if(bk){al=vec3f(.33,.34,.33);}else{
al*=1.-.3*ln(fract(P.z/${WP} +.5)-.5,.004,px*2.);
al=mix(al,al*vec3f(.5,.55,.66),step(P.y,.42))*(.55+.45*step(.5,fract(P.y*50.)+step(.16,P.y)));
}
}else if(m==6.){
if(bk){al=vec3f(.14,.18,.1);}else if(i.c.r>.9){gl=.5;
al=mix(al,vec3f(.5,.52,.55),smoothstep(-.6,-1.,P.y));
al=mix(al,vec3f(.01,.05,.22),max(ln(P.y-.3,.07,px),step(P.z-P.y*.8,-15.))*step(P.z,16.5));
al=mix(al,vec3f(.9,.3,.02),max(ln(P.y-.16,.02,px),ln(P.z-P.y*.8+14.7,.16,px))*step(P.z,16.5));
if(P.z>16.3&&abs(P.y-1.9+(P.z-16.3)*.5)<.3&&P.z<17.9){gl=1.;al=mix(vec3f(.008,.01,.015),vec3f(.8),ln(fract(ax*1.7+.5)-.5,.025,px*2.));}
al*=1.-.5*ln(max(abs(abs(P.z)-14.45)-.42,abs(P.y-.95)-.93),.008,px);
}else{gl=.35;}
}else if(m==11.){
let q=vec2f((fract((ax-.75)/.2)-.5)*.2,(fract((P.z-.3)/${PZ} +.5)-.5)*${PZ});let r=length(q);
if(P.y>2.08&&ax>.46&&ax<.6){em=vec3f(1.,.96,.91)*7.*pw;}
else if(P.y<1.67&&ax>.75&&ax<1.35){em=vec3f(1.,.9,.7)*step(r,.02)*pw*3.;al*=1.-.5*ln(r-.032,.004,px);}
else if(P.y<2.08&&ax>.5){let c=fract(P.z/1.0667+.5)-.5;
al*=1.-.5*ln(c,.003,px)-.35*ln(P.y-1.69,.006,px)-.5*step(max(abs(abs(c)-.5)-.04,abs(P.y-1.74)-.012),0.);}
}else if(m==14.&&ax<.32){
let s=vec2f(abs(P.z)-13.17,P.y-1.64);al*=1.-.5*ln(max(abs(s.x)-.33,abs(P.y-.98)-.95),.005,px);
if(max(abs(s.x),abs(s.y))<.06){al=mix(vec3f(.02,.08,.3),vec3f(.9),step(min(length(s-vec2f(0.,.034))-.013,max(abs(s.x)-.016,abs(s.y+.012)-.028)),0.));}
}else if(m==5.){
let uv=vec2f(.5-o.x/.26,1.-(o.y- ${SY.toFixed(4)})/${SH.toFixed(4)});
al=vec3f(.004);gl=.9;em=textureSampleLevel(scr,linSamp,uv,0.).rgb*u.t.x*2.2*step(max(abs(uv.x-.5),abs(uv.y-.5)),.47);
}else if(m==12.){em=al*14.*mix(1.,step(.9,fract(g.cam.w*.9)),step(1.5,al.r+al.g));al=vec3f(0.);
}else if(m==3.||m==20.){gl=.6;
}else if(m==4.){al=select(vec3f(.66,.68,.71)*(.7+.5*nz(o.zy*.12)),vec3f(.86,.72,.4)*(.65+.5*nz(o.zy*vec2f(.3,.04))),bk);gl=select(.9,.05,bk);
}else if(m==7.){
let a=nz(i.w.xz*.004);let b=nz(i.w.xz*.03+a);let d=nz(i.w.xz*.23);
let gr=mix(vec3f(.04,.07,.018),vec3f(.13,.13,.04),b)*(.65+.7*mix(.5,d,fd(.5,px)));
al=mix(gr,vec3f(.1,.07,.042)*(.6+.8*nz(i.w.xz*.08)),smoothstep(.3,.7,i.c.r+(b-.5)*.6));ao=i.c.g;gl=.02;
}else if(m==13.){al*=.6+.9*nz(o.xy*.09+o.z*.07);gl=.02;}
if(ch>1.5){al=vec3f(.55,.57,.6);gl=.9;}
let Ls=g.sun.xyz;let nl=max(dot(N,Ls),0.);let nv=max(dot(N,E),0.);var c:vec3f;
if(i.k.y>.5){ // 실내: 천장 띠 + 창 + 구멍 빛
var e=vec3f(.03);let dc=skyBase(vec3f(0.,.5,.86))*1.6+g.sunCol.rgb*.06;
for(var s=-1.;s<2.;s+=2.){
var v=vec2f(s*.54-P.x,2.1-P.y);var d=length(v);
e+=vec3f(1.,.96,.91)*pw*(max(dot(Q.xy,v/d),0.)*.8+.2)/(d+.3)*.55;
v=vec2f(s*1.8-P.x,1.1-P.y);d=length(v);
e+=dc*(max(dot(Q.xy,v/d),0.)*.85+.15)/(d+.5)*.35;
}
let hv=u.h.xyz-P;let hd=length(hv);e+=dc*u.s.x*4.*(max(dot(Q,hv/hd),0.)+.2)/(1.+hd*hd);
c=al*(e*ao+g.sunCol.rgb*nl*sunAt(i.w-N*.22,N)+ambAt(N)+pointLights(i.w,N))+gl*e*pow(1.-nv,4.)*.3;
}else{ // 실외
let sv=shadowAt(i.w,N)*mix(.35,1.,cloudVis(i.w));let R=reflect(-E,N);let sp=8.+300.*gl*gl;
c=al*(g.sunCol.rgb*nl*sv+ambAt(N)/mix(1.,.12,g.wind.w)*ao+pointLights(i.w,N));
c+=g.sunCol.rgb*sv*pow(max(dot(N,normalize(Ls+E)),0.),sp)*gl*(sp+8.)*.04*min(nl*8.,1.);
c=mix(c,skyBase(vec3f(R.x,abs(R.y),R.z))*mix(.35,1.,smoothstep(-.2,.1,R.y)),gl*(.06+.94*pow(1.-nv,5.))*step(m,6.5));
}
return vec4f(fogAt(mix(c,c*.03,ch*step(ch,1.5))+em,i.w),1.);
}
@fragment fn fsT(i:V)->@location(0)vec4f{ // 창유리·투명 관/백
if(cut(i)<0.){discard;}
let E=normalize(g.cam.xyz-i.w);let N=normalize(i.n);let d=dot(N,E);let F=.04+.96*pow(1.-abs(d),5.);let R=reflect(-E,N*sign(d));
if(i.m>15.){let k=select(1.,i.o.x,i.m<18.);let a=min(select(select(.2,.95,i.m==17.),.08,i.m==19.)+F*.7,1.)*k;return vec4f((i.c*a+F*.5*k)*((.12+.5*u.s.y)+pointLights(i.w,N*sign(d))*.3+ambAt(N)),a);}
return vec4f(select(vec3f(1.,.93,.82)*u.s.y*.5,skyBase(vec3f(R.x,abs(R.y),R.z)),d>0.)*F,F+select(.03,.3,d>0.));
}`;
/*GPU*/
 let mod,bgl,bg,vb,xb,ib,ub,tex,scv,ms,pipe,pipeT,pipeS,h=0,mk=0,gt=0,pg=1;
 const UB=new Float32Array(44);
 const mkp=(vs,fs,targets,o)=>G.dev.createRenderPipeline({
  layout: G.layout(bgl),vertex: { module: mod,entryPoint: vs,buffers: [
   { arrayStride: 40,attributes: [[0,0,'x3'],[1,12,'x3'],[2,24,'x3'],[3,36,'']].map(([l,o,f])=>({ shaderLocation: l,offset: o,format: 'float32'+f })) },
   { arrayStride: 80,stepMode: 'instance',attributes: [4,5,6,7,8].map((l,i)=>({ shaderLocation: l,offset: i*16,format: 'float32x4' })) }] },
  fragment: { module: mod,entryPoint: fs,targets },primitive: { cullMode: 'none' },...o });
 C.screen=cv=>{ scv=cv; if (!tex) return; // 좌석 화면 (복사가 막히면 writeTexture)
 if (!C.sfb) try { G.dev.queue.copyExternalImageToTexture({ source: cv },{ texture: tex },[512,288]); return; } catch (e) { C.sfb=1; }
 try { G.dev.queue.writeTexture({ texture: tex },cv.getContext('2d').getImageData(0,0,512,288).data,{ bytesPerRow: 2048 },[512,288]); } catch (e) { G.err('cabin.screen '+e); } };
 const run=(p,pl,t)=>{ // 0 불투명 1 그림자 2 유리
  if (!vb) return;
  p.setPipeline(pl); p.setBindGroup(1,bg); p.setVertexBuffer(0,vb); p.setVertexBuffer(1,ib); p.setIndexBuffer(xb,'uint32');
  for (const b of B) if ((t==2)==(b.fl==2)&&(t!=1||b.fl&1)&&(b.fl<4||S.crash)) p.drawIndexed(b.n,b.c,b.i0,0,b.f);
 };
 G.register('cabin',{
  init() {
   const dev=G.dev,U=GPUBufferUsage,T=GPUTextureUsage,S2=GPUShaderStage,buf=(a,usage)=>{ const b=dev.createBuffer({ size: a.byteLength,usage: usage|U.COPY_DST }); dev.queue.writeBuffer(b,0,a); return b; };
   try { build(); } catch (e) { G.err('cabin build '+(e.stack||e)); }
   vb=buf(new Float32Array(V),U.VERTEX); xb=buf(new Uint32Array(X),U.INDEX); ib=buf(new Float32Array(IN),U.VERTEX); ub=buf(UB,U.UNIFORM); V=X=IN=0;
   tex=dev.createTexture({ size: [512,288],format: 'rgba8unorm',usage: T.TEXTURE_BINDING|T.COPY_DST|T.RENDER_ATTACHMENT });
   bgl=dev.createBindGroupLayout({ entries: [{ binding: 0,visibility: S2.VERTEX|S2.FRAGMENT,buffer: {} },{ binding: 1,visibility: S2.FRAGMENT,texture: {} }] });
   bg=dev.createBindGroup({ layout: bgl,entries: [{ binding: 0,resource: { buffer: ub } },{ binding: 1,resource: tex.createView() }] });
   mod=G.shader(WGSL,'cabin'); scv&&C.screen(scv);
   pipeS=mkp('vsS','fsS',[],{ depthStencil: { format: G.DEPTH,depthWriteEnabled: true,depthCompare: 'less',depthBias: 2,depthBiasSlopeScale: 2 } });
  },
  onQuality({ msaa: n }) {
   if (n==ms) return; ms=n;
   const ds=w=>({ multisample: { count: n },depthStencil: { format: G.DEPTH,depthWriteEnabled: w,depthCompare: 'greater' } }),one={ srcFactor: 'one',dstFactor: 'one-minus-src-alpha' };
   pipe=mkp('vs','fs',[{ format: G.HDR }],ds(true)); pipeT=mkp('vs','fsT',[{ format: G.HDR,blend: { color: one,alpha: one } }],ds(false));
  },
  update(dt) { // 상태 추종: 구멍·마스크·기어·전원
   const t=G.time;
   h+=cl(S.hole-h,-dt*4,dt*4); mk+=cl(S.masks-mk,-dt*1.5,dt*1.5);
   if (S.gear) gt=0; else if (pg) gt=1e-3; else if (gt) gt+=dt; pg=S.gear;
   UB.set(C.M); UB.set(S.crash?M4.mul(C.M,TR):C.M,16);
   UB.set([h,S.power<1?S.power*(.7+.3*sin(t*43)*sin(t*12.7))*(sin(t*3.1)+sin(t*7.7)>1.4?.15:1):1,mk*mk*(3-2*mk),S.crash,
    S.tv,gt?4.9*gt*gt:S.gear&&S.gearDown?0:1e3,S.crash?TZ:-99,0,...C.K.hole,1.15],32);
  },
  prepare() { ub&&G.dev.queue.writeBuffer(ub,0,UB); },
  shadow(p) { run(p,pipeS,1); },
  opaque(p) { run(p,pipe,0); },
  transparent(p) { run(p,pipeT,2); }
 },'story');
}
