'use strict';
/* PEOPLE — 절차 생성 스키닝 인체: 링 로프트 메시 · 2가중치 LBS · 분석적 포즈 + 2뼈 IK · 1인칭 뷰모델 */
{
 const NB=19,MAXP=96,PI=Math.PI,sin=Math.sin,cos=Math.cos,H=Math.hypot,cl=G.clamp,L=G.lerp,abs=Math.abs;
 const ss=(a,b,x)=>{x=cl((x-a)/(b-a),0,1);return x*x*(3-2*x);};
 // 관절(바인드 자세, m): 0 골반 1 허리 2 가슴 3 목 4 머리 5-7 왼팔 8-10 오른팔 11-13 왼다리 14-16 오른다리 17 무기
 const J=[0,.93,0,0,1.05,0,0,1.24,0,0,1.49,0,0,1.57,.005,.172,1.42,0,.172,1.13,0,.172,.87,0,-.172,1.42,0,-.172,1.13,0,-.172,.87,0,
  .09,.93,0,.09,.5,0,.09,.09,0,-.09,.93,0,-.09,.5,0,-.09,.09,0,0,0,0];
 const KIND={rok:0,mask:1,nk:2,civ:3},GUN={ak:1,rifle:2,pistol:3},SIT={sit:1,sleep:1,brace:1};

 /* ───── 메시: 링 [y, rx, rz, dx, dz] 을 Y 축으로 이어 붙인 로프트 (양 끝은 반지름 0 링으로 막음) ───── */
 let V,I;
 // jt = [[관절 y, 위 뼈, 아래 뼈, 블렌드 폭]..] → 높이로 2가중치 자동 배정. mt(y) = 재질. mir 좌우 반전, rot = Y→Z (총기), fn 정점 변형, aw 각도 왜곡(앞쪽 촘촘)
 const loft=(R,n,x0,z0,jt,mt,mir,rot,fn,aw=1)=>{
  const b=V.length/10,m=mir?-1:1,e=R[R.length-1];
  R=[[R[0][0],0,0,R[0][3],R[0][4]],...R,[e[0],0,0,e[3],e[4]]];
  for(const[y,rx,rz=rx,dx=0,dz=0]of R){
   let j=jt[0];for(const q of jt)if(abs(y-q[0])<abs(y-j[0]))j=q;
   for(let i=0;i<n;i++){
    const t=i/n*2-1,a=PI*Math.sign(t)*abs(t)**aw,s=sin(a),c=cos(a);
    let p=[x0+m*(dx+rx*Math.sign(s)*abs(s)**.85),y,z0+dz+rz*Math.sign(c)*abs(c)**.85];
    if(fn)fn(p);
    if(rot)p=[p[0],-p[2],p[1]];
    V.push(...p,0,0,0,j[1],j[2],ss(j[0]+j[3],j[0]-j[3],y),mt(y));
   }
  }
  const f=!!mir!==(R[0][0]<e[0]); // 감는 방향 (위→아래 기준, 반전·역순이면 뒤집음)
  for(let k=0;k<R.length-1;k++)for(let i=0;i<n;i++){
   const a=b+k*n+i,c=b+k*n+(i+1)%n,d=a+n,g=c+n;
   f?I.push(a,c,d,c,g,d):I.push(a,d,c,c,d,g);
  }
 };
 const YC=1.635,HB=[[9,4,4,1]],g2=(a,b)=>Math.exp(-a*a-b*b);
 const face=p=>{ // 머리: 앞(얼굴)·뒤(후두) 깊이가 다른 단면 + 코·눈썹뼈·눈두덩·광대·입·턱·귀
  const x=p[0],y=p[1]-YC,c=p[2]-.012,ax=abs(x),s=Math.max(-y/.118,0),q=Math.max(1-(y/.116)**2,0);
  let z=c>0?c*(y>0?.094*q**.375:.094-.006*s):c*(y>0?.097*q**.3:L(.097,.03,ss(-.01,-.105,y)));
  if(c>0)z+=ss(.2,.6,c)*(.024*g2(x/L(.0135,.007,ss(-.035,.02,y)),0)*(y>-.034?ss(.03,-.034,y)**1.3:ss(-.05,-.034,y))
   + .004*g2((y-.022)/.01,x/.07)-.007*g2((ax-.031)/.014,(y-.005)/.009)+.003*g2((ax-.031)/.008,(y-.004)/.005)
   + .004*g2((ax-.04)/.02,(y+.03)/.022)+.004*g2(x/.024,(y+.067)/.012)+.005*g2(x/.022,(y+.103)/.014));
  p[2]=.012+z;p[0]+=Math.sign(x)*.015*g2((z+.008)/.012,(y+.004)/.027);
 };
 const body=lo=>{
  const n=lo?10:16;
  // 상의: 목 → 깃 → 어깨 → 가슴 → 허리띠 위 블라우징 → 밑단
  loft([[1.56,.05,.054],[1.503,.052,.056],[1.5,.066,.068],[1.475,.08,.074],[1.455,.135,.086],[1.43,.19,.098],[1.395,.186,.108],[1.35,.172,.118],[1.32,.172,.122,0,.01],[1.22,.164,.116,0,.005],
   [1.1,.158,.113],[1.06,.148,.106],[1.02,.156,.11],[.93,.172,.122],[.885,.176,.124],[.88,.166,.118],[.83,.16,.112],[.8,.12,.09]],n,0,0,[[1.05,1,0,.06],[1.24,2,1,.06],[1.49,3,2,.03],[1.6,4,3,.03]],y=>y>1.51?1:y>.882?2:3);
  for(const s of[1,-1]){
   const o=s<0?3:0,A=[[1.42,2,5+o,.05],[1.13,5+o,6+o,.05],[.87,6+o,7+o,.025]];
   // 다리: 허벅지(건빵 주머니) → 무릎 → 종아리 → 바짓단을 군화에 넣음 → 군화·밑창
   loft([[.97,.05,.06],[.9,.088,.096],[.78,.086,.092],[.68,.084,.086,.004],[.56,.067,.07],[.5,.06,.064,0,.006],[.42,.058,.064,0,-.008],[.31,.054,.058],[.268,.057,.061],
    [.25,.046,.05],[.12,.04,.046],[.07,.044,.085,0,.035],[.035,.048,.125,0,.066],[.012,.05,.13,0,.068],[0,.047,.127,0,.068]],
    n-2,s*.09,0,[[.92,0,11+o,.06],[.5,11+o,12+o,.06],[.1,12+o,13+o,.035]],y=>y>.26?3:4,s<0);
   // 팔: 어깨(삼각근) → 팔꿈치 → 소매 끝동 → 손목 → 손바닥 → 모아 쥔 손가락 / 엄지
   loft([[1.44,.012],[1.432,.034],[1.41,.05],[1.36,.051],[1.25,.046],[1.16,.042],[1.13,.041,.041,0,-.006],[1.08,.043,.043,0,.004],[.98,.038],[.905,.033],[.895,.034],
    [.893,.025,.03],[.87,.021,.029],[.83,.019,.044,0,.004],[.78,.018,.046,0,.006],[.74,.015,.043,-.006,.006],[.705,.012,.037,-.016,.005],[.69,.008,.028,-.024,.004]],
    n-4,s*.172,0,A,y=>y>.894?2:1,s<0);
   loft([[.865,.011,.013,-.003,.028],[.835,.012,.013,-.008,.048],[.805,.01,.011,-.013,.06],[.785,.006,.007,-.016,.065]],6,s*.172,0,A,()=>1,s<0);
  }
  const nh=lo?14:24,hr=[];
  for(let k=0;k<nh;k++){const y=.105-k*.223/(nh-1),s=-y/.118;hr.push([YC+y,y>0?.0765*(1-(y/.116)**2)**.45:.0765*(1-.46*s**1.3-.24*ss(.8,1,s)),1]);}
  loft(hr,lo?20:32,0,.012,HB,()=>0,0,0,face,1.3);
  // 머리쓰개: 6 전투모 · 7 철모 · 8 정모 · 9 머리카락 (인스턴스마다 하나만 보임)
  const hg=(m,R,z0=.008)=>loft(R.map(r=>[YC+r[0],r[1],r[2]]),n,0,z0,HB,()=>m);
  for(const m of[6,8])hg(m,[[.04,.062,.04],[.034,.07,.048],[.028,.062,.04]],.118); // 챙
  hg(6,[[.133,.05,.062],[.126,.078,.095],[.1,.083,.101],[.037,.081,.099],[.03,.078,.096]]);
  hg(7,[[.146,.03,.036],[.134,.062,.075],[.108,.083,.1],[.075,.092,.111],[.042,.095,.114],[.034,.101,.12],[.03,.1,.119]]);
  hg(8,[[.13,.09,.104],[.118,.106,.122],[.1,.105,.12],[.078,.083,.1],[.036,.081,.099],[.03,.078,.096]]);
  hg(9,[[.122,.03,.036],[.112,.058,.07],[.085,.076,.093],[.05,.081,.099],[.01,.08,.098],[-.03,.07,.085],[-.045,.05,.06]],-.006);
 };
 const gun=k=>{ // 0 AK(목재) · 1 K2(수지) · 2 권총. 원점 = 오른손 손잡이, 총열 +Z
  const W=[[9,17,17,1]],w=k?12:11,z=(R,f)=>loft(R,8,0,0,W,f,0,1),y=(R,m)=>loft(R,8,0,0,W,()=>m);
  if(k>1){z([[.16,.011,.013,0,-.045],[.15,.013,.016,0,-.045],[-.04,.013,.016,0,-.045],[-.05,.011,.013,0,-.045]],()=>10);y([[.03,.012,.018],[-.085,.013,.02,0,-.03]],12);return;}
  z([[.6,.007,.007,0,-.05],[.42,.008,.008,0,-.05],[.415,.02,.024,0,-.045],[.2,.021,.026,0,-.042],[.19,.017,.03,0,-.04],[-.06,.017,.03,0,-.04],[-.09,.015,.026,0,-.03],[-.33,.016,.05,0,-.005]],
   q=>q>.417||q<.195&&q>-.07?10:w);
  z([[.57,.004,.02,0,-.068],[.55,.004,.02,0,-.068]],()=>10);z([[.54,.006,.006,0,-.07],[.2+k*.2,.006,.006,0,-.07]],()=>10); // 가늠쇠 · 가스관
  y([[0,.011,.028,0,.1],[-.1,.011,.028,0,.11+.005*!k],[-.19+k*.04,.011,.027,0,k?.115:.15]],10);y([[.01,.012,.017],[-.09,.013,.019,0,-.03]],w); // 탄창 · 손잡이
 };

 const WGSL=/*wgsl*/`
struct VI{@location(0)p:vec3f,@location(1)n:vec3f,@location(2)b:vec4f,@location(3)i:u32};
struct VO{@builtin(position)c:vec4f,@location(0)w:vec3f,@location(1)n:vec3f,@location(2)b:vec3f,@location(3)@interpolate(flat)m:vec4f,@location(4)@interpolate(flat)q:vec4f};
@group(1)@binding(0)var<storage,read>pal:array<mat4x4f>; // 사람마다 19칸: 뼈 18 + 파라미터
fn wp(i:VI)->vec4f{ // 스키닝한 월드 위치 (w = 보임 여부)
let o=i.i*19u;let X=pal[o+18u];let m=i.b.w;var p=i.p;let mx=max(i.b.x,i.b.y);
if(m<.5){p.x*=X[2].z;p.y-=X[1].w*.012*ss(1.6,1.565,p.y)*ss(.04,.09,p.z);} // 얼굴 폭 · 말할 때 턱
else if(m<3.5){p+=normalize(i.n)*X[2].y;} // 체격
if(m>.5&&m<1.5&&p.y<.79){ // 손가락 말아 쥠 (총을 잡으면 주먹)
let k=sign(p.x);let a=-k*X[2].w*(.79-p.y)*26.0;let d=p.xy-vec2f(k*.172,.79);
p=vec3f(k*.172+d.x*cos(a)-d.y*sin(a),.79+d.x*sin(a)+d.y*cos(a),p.z);}
let hd=(m>5.5&&m<9.5&&abs(m-X[0].w)>.5)||(X[2].x>.5&&(mx<4.5||(mx>10.5&&mx<16.5)));
let w=mix(pal[o+u32(i.b.x)]*vec4f(p,1.0),pal[o+u32(i.b.y)]*vec4f(p,1.0),i.b.z);
return vec4f(w.xyz,select(1.0,0.0,hd));
}
@vertex fn vs(i:VI)->VO{
let o=i.i*19u;let X=pal[o+18u];let w=wp(i);
let n=normalize(mix(pal[o+u32(i.b.x)]*vec4f(i.n,0.0),pal[o+u32(i.b.y)]*vec4f(i.n,0.0),i.b.z).xyz);
var c=g.viewProj*vec4f(w.xyz,1.0);
if(X[2].x>.5){c.z=c.w*.9+c.z*.1;} // 1인칭: 깊이를 카메라 쪽으로 압축 → 벽에 파묻히지 않음
if(w.w<.5){c=vec4f(0.0,0.0,2.0,1.0);}
return VO(c,w.xyz,n,i.p,vec4f(i.b.w,X[0].xyz),X[1]);
}
@vertex fn vsS(i:VI)->@builtin(position)vec4f{let w=wp(i);var c=g.shadowVP*vec4f(w.xyz,1.0);if(w.w<.5){c=vec4f(0.0,0.0,2.0,1.0);}return c;}
fn ss(a:f32,b:f32,x:f32)->f32{let t=clamp((x-a)/(b-a),0.0,1.0);return t*t*(3.0-2.0*t);}
fn gs(a:f32,b:f32)->f32{return exp(-a*a-b*b);}
fn n3(p:vec3f)->f32{ // 3D 값 잡음 (잡음 텍스처 2탭)
let z=floor(p.z);let u=(p.xy+.5)/256.0;let o=vec2f(.141,.273);
return mix(textureSampleLevel(noiseTex,linSamp,u+z*o,0.0).r,textureSampleLevel(noiseTex,linSamp,u+(z+1.0)*o,0.0).r,fract(p.z));
}
@fragment fn fs(i:VO)->@location(0)vec4f{
let m=i.m.x;let kd=i.m.y;let sd=i.m.z;let b=i.b;let h=b-vec3f(0.0,${YC},.012);let ax=abs(h.x);
var N=normalize(i.n);let E=normalize(g.cam.xyz-i.w);let Ls=g.sun.xyz;let px=length(fwidth(b));
var al=vec3f(.03);var gl=.5;var sk=0.0;var ao=1.0;var hi=0.0;var cf=0.0;
let hc=vec3f(.022,.018,.016);
if(m<1.5){ // 피부
al=mix(vec3f(.5,.36,.28),vec3f(.38,.25,.18),i.m.w);sk=1.0;gl=.3;
if(m>.5){ao=mix(1.0,.6,ss(1.4,1.52,b.y));al*=1.0-.5*ss(.8,.77,b.y)*(1.0-ss(0.0,.003+px,abs(fract((b.z+.017)/.022+.5)-.5)*.022));}else{
let fr=ss(.03,.06,h.z);let aa=px*.7+.0002;
al=mix(al,al*vec3f(1.08,.86,.84),fr*gs((ax-.04)/.02,(h.y+.035)/.02)); // 볼
al=mix(al,al*vec3f(.74,.78,.84),.3*fr*ss(-.04,-.075,h.y)*f32(kd!=3.0||sd>.5)); // 수염 자국
// 짧은 머리: 이마선 위 · 귀 위 · 뒤통수
let hl=mix(mix(-.05,.012,ss(-.05,-.025,h.z)),.074,ss(.02,.075,h.z));
let hr=ss(-.003,.004,h.y-hl);al=mix(al,hc,hr*.88);gl=mix(gl,.15,hr);
ao*=1.0-.3*ss(.01,.035,h.y)*fr-.22*fr*gs((ax-.031)/.02,(h.y-.012)/.012)-.4*fr*gs((ax-.008)/.005,(h.y+.046)/.004);
// 눈: 아몬드 눈매 · 어두운 홍채 · 작은 하이라이트 · 속눈썹 선
let ex=(ax-.031)/.0145;let e2=max(1.0-ex*ex,0.0);let ey=h.y-.005-ex*.0012;let op=1.0-i.q.x;
let up=.0058*op*e2+.0004-ey;let ie=ss(0.0,aa,min(up,ey+.004*op*e2+.0004))*fr*step(abs(ex),1.0);
let ir=vec2f(h.x-sign(h.x)*.031-i.q.y*.004,ey-i.q.z*.002-.0008);
al=mix(al,mix(vec3f(.5,.46,.42),vec3f(.03,.018,.012),ss(.0066,.0056,length(ir)))*(.4+.6*ss(0.0,.004,up)),ie);
hi=ie*ss(.0012,.0005,length(ir-vec2f(.0019,.0017)));sk*=1.0-ie;gl=mix(gl,.8,ie);
al=mix(al,hc,ss(aa+.0012,0.0,abs(up))*fr*step(abs(ex),1.05)*.9);
// 눈썹 · 입술
let bx=(ax-.032)/.02;let by=h.y-.0225-.0045*(1.0-bx*bx);
al=mix(al,hc,ss(.0034,.0012,abs(by))*ss(.053,.044,ax)*ss(.008,.014,ax)*fr*.85);
let ly=h.y+.067+i.q.w*.004;let lw=ss(.027,.018,ax)*fr;
al=mix(al,al*vec3f(.8,.5,.52),ss(.0095,.004,abs(ly))*lw*.85);al*=1.0-.65*ss(.0013+i.q.w*.004+aa,0.0,abs(ly))*lw;
if(kd==1.0){let mk=ss(-.008,-.013,h.y-ax*.12)*ss(-.03,-.012,h.z);al=mix(al,vec3f(.012),mk);sk*=1.0-mk;cf=mk;gl=mix(gl,.1,mk);} // 검은 마스크
}}else if(m<3.5||m==6.0||m==8.0){ // 천
cf=1.0;gl=.08;let up=m<2.5;
if(kd<1.5){ // ROK 디지털 무늬: 직사각 픽셀 4색 (멀면 픽셀 격자를 풂)
let s=b*vec3f(160.0,210.0,160.0);let q=mix(s,floor(s)+.5,clamp(1.5-px*350.0,0.0,1.0));
let a=n3(q*.075);let c=n3(q*.19+31.7);
al=vec3f(.29,.25,.17);if(a>.5){al=vec3f(.12,.14,.07);}if(c>.6){al=vec3f(.04,.055,.032);}if(a+c<.8){al=vec3f(.07,.047,.03);}
}else if(kd<2.5){ // KPA 카키: 가죽 허리띠 · 멜빵 · 탄입대 · 깃 표지
al=vec3f(.125,.12,.068);
if(up){
let bt=step(abs(b.y-1.045),.024);let st=step(abs(b.x*.8+(b.y-1.25)*.6-.02),.016)*step(1.07,b.y)*step(b.y,1.44);
let po=step(abs(abs(b.x)-.1),.045)*step(abs(b.y-1.03),.06)*step(.05,b.z);
al=mix(al,vec3f(.085,.08,.05),po);al=mix(al,vec3f(.09,.042,.02),max(bt,st));gl=mix(gl,.45,max(bt,st));cf=1.0-max(bt,st);
al=mix(al,vec3f(.5,.38,.12),bt*step(abs(b.x),.022)*step(0.0,b.z)); // 버클
al=mix(al,vec3f(.25,.02,.02),step(1.478,b.y)*step(.03,b.z)*step(.012,abs(b.x)));
}else if(m==8.0){al=mix(al,vec3f(.22,.02,.02),step(h.y,.066));if(h.z>.1&&h.y<.055){al=vec3f(.015);gl=.7;cf=0.0;}}
}else{ // 민간인: 시드별 셔츠 · 바지
let k=fract(sd*7.0);
al=select(mix(vec3f(.03,.035,.05),vec3f(.12,.1,.08),fract(sd*13.0)),mix(mix(vec3f(.45,.47,.5),vec3f(.1,.16,.3),k),vec3f(.35,.12,.1),step(.75,k)*.8),up);
}
if(m<3.5&&kd<2.5){ // 주머니 재봉선
let pk=select(vec2f(abs(b.x)-.1,b.y-.7),vec2f(abs(b.x)-.09,b.y-1.31),up);let e=max(abs(pk.x)-.045,abs(pk.y+.01)-.055);
al*=1.0-.3*ss(.004+px,0.0,min(abs(e),abs(pk.y-.02)+step(0.0,e)))*step(.02,b.z+f32(!up));
}
}else if(m<4.5){al=vec3f(.018);gl=.55;} // 군화
else if(m==7.0){al=vec3f(.07,.085,.045);gl=.4;} // 철모
else if(m==9.0){al=hc;gl=.35;}
else if(m==10.0){al=vec3f(.035,.036,.04);gl=.65;} // 총: 강철 · 목재 · 수지
else if(m==11.0){al=vec3f(.2,.085,.035)*(.7+.5*n3(b*vec3f(300.0,300.0,30.0)));gl=.4;}
else{al=vec3f(.02);gl=.3;}
if(cf>0.0&&g.sun.w>.5){ // 천: 잔주름 + 직조
N=normalize(N+(vec3f(n3(b*70.0),n3(b*70.0+9.0),n3(b*70.0+17.0))-.5)*.5*cf);
al*=1.0+.14*cf*sin(b.x*2400.0+b.y*1300.0)*sin(b.y*2400.0-b.z*2400.0)*clamp(1.0-px*1500.0,0.0,1.0);
}
// 조명: 랩 확산(피부는 넓게 + 붉은 산란) · 환경광 · 점광 · 정반사 · 천 광택
let nl=dot(N,Ls);let S=g.sunCol.rgb*sunAt(i.w,N);let wr=mix(.15,.45,sk);let nv=max(dot(N,E),0.0);
let df=S*clamp((nl+wr)/(1.0+wr),0.0,1.0)*mix(vec3f(1.0),vec3f(1.0,.5,.35),sk*ss(.35,-.25,nl));
let pl=pointLights(i.w,N)+pointLights(i.w,-N)*.25*sk;let am=ambAt(N)*ao;
var c=al*(df*(.5+.5*ao)+am+pl);
let sp=8.0+200.0*gl*gl;
c+=(S*step(0.0,nl)*pow(max(dot(N,normalize(Ls+E)),0.0),sp)*(sp+2.0)*.04+pointLights(i.w,reflect(-E,N))*.3)*gl*gl*ao;
c+=(am+df*.6+pl*.6)*pow(1.0-nv,3.0)*(al*.6+.03)*mix(.5,1.6,cf);
c+=hi*(S*.25+ambAt(vec3f(0.0,1.0,0.0))*2.0+pl);
return vec4f(fogAt(c,i.w),1.0);
}`;

 /* ───── 뼈대 풀이 (모델 공간 4x4, 할당 없음) ───── */
 const B=new Float32Array(18*16),T=new Float32Array(16),PAL=new Float32Array(MAXP*NB*16),TA=new Float32Array(32),IB=new Uint32Array(MAXP*2),GL=[0,1,2,3].map(()=>[]);
 for(let i=15;i<288;i+=16)B[i]=1;
 const mm=(O,o,A,a,C,c)=>{ // O[o] = A[a]·C[c]
  for(let k=0;k<16;k+=4){const x=C[c+k],y=C[c+k+1],z=C[c+k+2],w=C[c+k+3];for(let r=0;r<4;r++)O[o+k+r]=A[a+r]*x+A[a+4+r]*y+A[a+8+r]*z+A[a+12+r]*w;}
 };
 const rot=(A,o,tx,ty,tz,p,y,r)=>{ // 이동·Ry(yaw)·Rx(pitch: 앞으로 숙임 +)·Rz(roll)
  const cx=cos(p),sx=sin(p),cy=cos(y),sy=sin(y),cz=cos(r),sz=sin(r);
  A[o]=cz*cy+sz*sx*sy;A[o+1]=sz*cx;A[o+2]=sz*sx*cy-cz*sy;A[o+4]=cz*sx*sy-sz*cy;A[o+5]=cz*cx;A[o+6]=sz*sy+cz*sx*cy;
  A[o+8]=cx*sy;A[o+9]=-sx;A[o+10]=cx*cy;A[o+12]=tx;A[o+13]=ty;A[o+14]=tz;A[o+3]=A[o+7]=A[o+11]=0;A[o+15]=1;
 };
 const fk=(i,q,p,y,r)=>{rot(T,0,J[i*3]-J[q*3],J[i*3+1]-J[q*3+1],J[i*3+2]-J[q*3+2],p,y,r);mm(B,i*16,B,q*16,T,0);};
 const axes=(i,ax,ay,az,bx,by,bz,xx,xy,xz)=>{ // 뼈 i: 원점 a, −Y 가 b 를 향함, X = 경첩축
  const o=i*16,l=H(ax-bx,ay-by,az-bz)||1,yx=(ax-bx)/l,yy=(ay-by)/l,yz=(az-bz)/l;
  B[o]=xx;B[o+1]=xy;B[o+2]=xz;B[o+4]=yx;B[o+5]=yy;B[o+6]=yz;
  B[o+8]=xy*yz-xz*yy;B[o+9]=xz*yx-xx*yz;B[o+10]=xx*yy-xy*yx;B[o+12]=ax;B[o+13]=ay;B[o+14]=az;
 };
 // 2뼈 IK: 뿌리 a → 목표 c, 길이 l1·l2, 중간 관절은 극 벡터 p 쪽으로. s = +1 팔(팔꿈치 뒤) / −1 다리(무릎 앞)
 const ik=(i,ax,ay,az,cx,cy,cz,l1,l2,px,py,pz,s)=>{
  let dx=cx-ax,dy=cy-ay,dz=cz-az,d=H(dx,dy,dz)||1e-4;dx/=d;dy/=d;dz/=d;
  d=cl(d,abs(l1-l2)+.02,l1+l2-.003);
  const ca=(l1*l1+d*d-l2*l2)/(2*l1*d),sa=Math.sqrt(Math.max(1-ca*ca,0))*l1;
  let k=px*dx+py*dy+pz*dz;px-=dx*k;py-=dy*k;pz-=dz*k;k=H(px,py,pz)||1;px/=k;py/=k;pz/=k;
  const ex=ax+dx*ca*l1+px*sa,ey=ay+dy*ca*l1+py*sa,ez=az+dz*ca*l1+pz*sa;
  const xx=s*(dy*pz-dz*py),xy=s*(dz*px-dx*pz),xz=s*(dx*py-dy*px);
  axes(i,ax,ay,az,ex,ey,ez,xx,xy,xz);axes(i+1,ex,ey,ez,ax+dx*d,ay+dy*d,az+dz*d,xx,xy,xz);
 };
 const S3=(a,i,x,y,z)=>{a[i]=x;a[i+1]=y;a[i+2]=z;};
 const wm=P=>{if(P._W)return P._W;const m=M4.trs(P.p,P.yaw,0,0,P._sc);return P.M?M4.mul(P.M,m):m;};
 const toL=(P,q)=>{ // 월드 → 모델 공간
  if(P.M)q=M4.point(M4.invert(P.M),q);
  const x=q[0]-P.p[0],z=q[2]-P.p[2],c=cos(P.yaw),s=sin(P.yaw),k=P._sc;
  return[(x*c-z*s)/k,(q[1]-P.p[1])/k,(x*s+z*c)/k];
 };

 /* 포즈 벡터 a[32]: 0 골반 위치 · 3 골반 회전(숙임,요,롤) · 6 척추 · 9 머리 · 12 왼손 · 15 오른손(어깨 기준 주먹 목표) · 18 왼발 · 21 오른발(발바닥, 모델 공간)
  · 24 무기 방향 · 27 양손 파지 · 28,29 손목 꺾임 · 30 눈 감김 · 31 입 벌림 */
 const tgt=(P,a,t,dt)=>{
  const ps=P._cp,u=t-P._t0,sd=P._r,sg=sd>.5?1:-1,g=P.gun,pst=g==='pistol',br=sin(t*1.4+sd*9),sw=sin(t*.45+sd*6),sit=P._sit;
  const fy=(P.p[1]>.3&&P.p[1]<.62?-P.p[1]:-.47)/P._sc,live=ps!=='dead'&&ps!=='sleep';
  a.fill(0);
  if(sit){ // 좌석: 엉덩이 = 원점, 등받이 12°, 허벅지 수평, 발은 바닥, 손은 무릎 위
   a[3]=-.21;a[6]=.1+.012*br;a[9]=.1+.01*sw;a[28]=a[29]=-.35;
   S3(a,12,-.07,-.39,.33);S3(a,15,.07,-.39,.33);S3(a,18,.1,fy,.41+.06*sd);S3(a,21,-.1,fy,.47-.06*sd);
  }else{ // 서기: 호흡 · 체중 이동, 발은 제자리
   S3(a,0,.012*sw,.915,0);a[5]=-.02*sw;a[6]=.03+.01*br;
   S3(a,12,.05,-.61,.05);S3(a,15,-.05,-.61,.05);a[18]=.1;a[21]=-.1;
  }
  S3(a,24,0,-.92,.38);
  if(g&&!pst&&!sit){S3(a,15,.08,-.33,.16);S3(a,24,.5,-.42,.76);a[27]=1;} // 소총: 앞에총
  if(ps==='sleep'){a[3]=-.3;a[6]=.12+.02*sin(t*.9+sd*9);a[9]=.22;a[10]=sg*.25;a[11]=sg*.28;a[30]=1;}
  else if(ps==='brace'){ // 충격 방지 자세: 숙이고 손으로 머리를 감쌈, 떨림
   const j=.02*sin(t*27+sd*9);a[3]=.45+j;a[6]=.7;a[9]=.35;a[28]=a[29]=0;a[30]=.85;
   S3(a,12,-.1,.16+j,.2);S3(a,15,.1,.16-j,.2);
  }else if(ps==='walk'||ps==='run'){ // 보행: 실제 속도로 보폭·주기 결정 (디딤발은 미끄러지지 않음)
   const rn=ps==='run',v=P._v,c=rn?.38:.6,A=c/2*v/(.9+.2*v),k=Math.min(1,v/.7),ph=P._ph,cs=cos(ph);
   for(let j=0;j<2;j++){
    const q=(ph/2/PI+j*.5)%1,w=(q-c)/(1-c),o=18+j*3;
    a[o]=j?-.085:.085;a[o+1]=q<c?0:(rn?.2:.08)*k*sin(PI*w);a[o+2]=q<c?A*(1-2*q/c):-A*cos(PI*w);
   }
   S3(a,0,.015*k*sin(ph),.915-.025*k*(rn?2:1)+.018*k*cos(2*ph),0);
   a[4]=-.1*k*cs;a[7]=.2*k*cs;a[3]=rn?.12:.03;a[6]=rn?.22:.06;
   if(!a[27]){const y=rn?-.36:-.6,z=rn?.2:.05;S3(a,12,.04,y,z-.2*k*cs);S3(a,15,-.04,y,z+.2*k*cs);}
  }else if(ps==='stumble'){ // 앞으로 넘어져 손·무릎으로 버틴 뒤 일어남
   const k=ss(0,.55,u)*(1-ss(1.5,2.4,u)),y=L(-.61,-.5,k);
   S3(a,0,0,L(.915,.47,k),.36*k);a[3]=1.3*k;a[6]=.2*k;a[9]=-.5*k;a[19]=a[22]=.11*k;a[27]=0;
   S3(a,12,.03,y,.05+.05*k);S3(a,15,-.03,y,.05+.05*k);
  }else if(ps==='dead'){
   a[30]=1;a[27]=0;
   if(sit){ // 좌석에서 축 늘어짐
    const q=ss(0,1.3,u);a[3]+=.3*q;a[6]+=.55*q;a[8]=sg*.3*q;a[9]=.7*q;a[11]=sg*.35*q;
    for(const o of[12,15]){a[o+1]=L(a[o+1],-.58,q);a[o+2]=L(a[o+2],.1,q);}
   }else{ // 쓰러짐: 중력 가속으로 주저앉으며 뒤(또는 앞)로 눕고, 팔다리는 조금 늦게 가라앉음
    const k=Math.min(u/.9,1)**2.2,fw=sd*7%1>.5?1:-1,ka=ss(.2,1.3,u),y=L(-.61,-.1,k);
    S3(a,0,sg*.1*k,L(.915,.12,k),fw*.4*k);S3(a,3,fw*1.5*k,(sd-.5)*k,0);a[6]=.1*fw*k;a[10]=sg*.8*k;
    S3(a,12,L(.05,.3,ka),y,(fw>0?.3:.1)*ka);S3(a,15,-L(.05,.26,ka),y,(fw>0?.2:-.08)*ka);
    S3(a,18,.16,0,-fw*.42*k);S3(a,21,-.13,0,-fw*.4*k);S3(a,24,.6,-.05,.7);
   }
  }
  const am=ps==='aim'||ps==='fire'||ps==='crouch';
  if(am){
   if(ps==='crouch'){S3(a,0,0,.47,-.03);a[3]=.05;a[6]=.15;S3(a,18,.11,0,.3);S3(a,21,-.12,.11,-.36);} // 무릎쏴
   else{a[1]=.89;a[3]=.08;a[20]=.15;a[23]=-.17;}
   if(g){ // 조준: 몸을 비껴 서고 총을 어깨에 붙여 aim 을 향함
    let dx=0,dy=0,dz=1;const kk=ps==='fire'?Math.exp(-(t*9%1)*5):0;
    if(P.aim){const q=toL(P,P.aim);dx=q[0]+.15;dy=q[1]-a[1]-.5;dz=q[2];const l=H(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;}
    const hz=H(dx,dz)||1,e=pst?[.5,.15,.04]:[.36-.03*kk,.05,-.07];
    a[4]=-.35;a[7]=cl(Math.atan2(dx,dz),-1.3,1.3)-.15;a[6]-=dy*.4+.03*kk;a[11]=.1;a[27]=1;
    S3(a,15,dx*e[0]+dz/hz*e[1],dy*e[0]+e[2],dz*e[0]-dx/hz*e[1]);S3(a,24,dx,dy+.04*kk,dz);
   }
  }
  // 시선: 머리가 부드럽게 따라가고 눈이 먼저 감
  const lk=am&&P.aim||P.look;let ly=0,lp=0;
  if(lk&&live){const q=toL(P,lk);ly=cl(Math.atan2(q[0],q[2])-a[4]-a[7],-1.2,1.2);lp=cl(-Math.atan2(q[1]-a[1]-.7,H(q[0],q[2]))-a[3]-a[6],-.6,.6);}
  const k=Math.min(1,dt*7);P._ly+=(ly-P._ly)*k;P._lp+=(lp-P._lp)*k;
  a[10]+=P._ly;a[9]+=P._lp;P._g[0]=cl((ly-P._ly)*2.5,-1,1);P._g[1]=cl((P._lp-lp)*3,-1,1);
  const tk=P.talk||0;
  if(tk&&live){ // 말하기: 고개 · 턱 · 오른손 손짓
   a[9]+=tk*.05*sin(t*5.3+sd);a[10]+=tk*.06*sin(t*2.1+sd*5);a[31]=tk*(.5+.5*sin(t*13)*sin(t*7.3+sd));
   if(!a[27]){a[16]+=tk*(.1+.04*sin(t*3.1));a[17]+=tk*.06;}
  }
  const hh=(t-P._ht)/.4;
  if(hh<1){const e=sin(PI*hh);a[2]-=.05*e;a[6]-=.3*e;a[7]+=sg*.25*e;a[9]-=.2*e;} // 피격 움찔
  if(live&&(t*.27+sd*7)%1>.965)a[30]=1; // 눈 깜박임
 };
 const F={on:0,gun:'pistol',aim:0,kick:0,reload:0,bob:0,sway:[0,0]};
 const fpose=a=>{ // 1인칭: 모델 공간 = 카메라 공간(+Z 전방). 어깨는 화면 아래, 주먹 목표는 허리 사격 ↔ 조준
  const ad=F.aim||0,rl=F.reload?sin(PI*F.reload):0,ps=F.gun==='pistol',kk=F.kick||0,bb=F.bob||0,sw=F.sway||[0,0];
  a.fill(0);a[1]=-.63;a[2]=.12;
  S3(a,15,L(ps?.072:.042,.172,ad)+cos(bb*.5)*.004+.03*rl,L(ps?.01:-.015,ps?.072:.048,ad)+sin(bb)*.006-.07*rl+.01*kk,L(ps?.34:.25,ps?.3:.26,ad)-.045*kk);
  S3(a,24,sw[0]*.4+.22*rl,sw[1]*.4+.05*kk+.3*rl,1);a[27]=1-rl;S3(a,12,-.2,-.2,.3);
 };
 const solve=(P,a,sl)=>{
  const pst=P.gun==='pistol',yw=a[4]+a[7],cy=cos(yw),sy=sin(yw);
  rot(B,0,a[0],a[1],a[2],a[3],a[4],a[5]);
  fk(1,0,a[6]*.5,a[7]*.5,a[8]*.5);fk(2,1,a[6]*.5,a[7]*.5,a[8]*.5);fk(3,2,a[9]*.4,a[10]*.4,a[11]*.4);fk(4,3,a[9]*.6,a[10]*.6,a[11]*.6);
  for(let k=0;k<2;k++){ // 다리 IK + 발(정강이가 많이 누우면 발끝이 따라감)
   const i=11+k*3,s=k?-.09:.09,o=18+k*3,n=(i+1)*16,f=a[4]+s*1.4,sf=sin(f),cf=cos(f);
   ik(i,B[12]+B[0]*s,B[13]+B[1]*s,B[14]+B[2]*s,a[o],a[o+1]+.09,a[o+2],.43,.41,s*1.5+sin(a[4]),.1,cos(a[4]),-1);
   const g=Math.atan2(-B[n+4]*sf-B[n+6]*cf,B[n+5]);
   rot(B,n+16,B[n+12]-B[n+4]*.41,B[n+13]-B[n+5]*.41,B[n+14]-B[n+6]*.41,-Math.sign(g)*cl((abs(g)-.6)*1.6,0,1.5),f,0);
  }
  for(let k=1;k>=0;k--){ // 팔 IK (오른팔 먼저: 무기가 오른 주먹에 붙고 왼손이 총을 받침)
   const i=5+k*3,s=k?-.172:.172,o=12+k*3,n=(i+2)*16,sx=B[44]+B[32]*s+B[36]*.18,sy2=B[45]+B[33]*s+B[37]*.18,sz=B[46]+B[34]*s+B[38]*.18;
   let fx=sx+a[o],fy=sy2+a[o+1],fz=sz+a[o+2];
   if(!k){const w=a[27],q=pst?.02:.24,e=pst?-.02:-.035;fx=L(fx,B[284]+B[280]*q+B[276]*e+.03*pst,w);fy=L(fy,B[285]+B[281]*q+B[277]*e,w);fz=L(fz,B[286]+B[282]*q+B[278]*e,w);}
   let tx=fx,ty=fy,tz=fz;
   for(let it=0;it<2;it++){ // 주먹 중심이 목표에 오도록 한 번 보정
    ik(i,sx,sy2,sz,tx,ty,tz,.29,.26,s*2.5*cy-.6*sy,-.75,-.6*cy-s*2.5*sy,1);fk(i+2,i+1,a[28+k],0,0);
    tx+=fx-B[n+12]+B[n+4]*.075;ty+=fy-B[n+13]+B[n+5]*.075;tz+=fz-B[n+14]+B[n+6]*.075;
   }
   if(k){ // 무기 뼈: 원점 = 오른 주먹, Z = 포즈가 정한 방향
    let zx=a[24],zy=a[25],zz=a[26],l=H(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;l=H(zx,zz)||1;
    const xx=zz/l,xz=-zx/l;
    S3(B,272,xx,0,xz);S3(B,276,zy*xz,zz*xx-zx*xz,-zy*xx);S3(B,280,zx,zy,zz);
    S3(B,284,B[n+12]-B[n+4]*.075,B[n+13]-B[n+5]*.075,B[n+14]-B[n+6]*.075);
    const q=pst?.16:.6;S3(P._mz,0,B[284]+B[276]*.05+zx*q,B[285]+B[277]*.05+zy*q,B[286]+B[278]*.05+zz*q);S3(P._mz,3,zx,zy,zz);
   }
  }
  S3(P._e,0,B[76]+B[68]*.07+B[72]*.095,B[77]+B[69]*.07+B[73]*.095,B[78]+B[70]*.07+B[74]*.095);
  const W=wm(P),j=P._j,K=P._k;
  for(let i=0;i<18;i++){ // 월드 스킨 행렬 = W·뼈·T(−관절)
   const o=(sl*NB+i)*16,x=J[i*3],y=J[i*3+1],z=J[i*3+2];mm(PAL,o,W,0,B,i*16);
   for(let k=0;k<3;k++){j[i*3+k]=PAL[o+12+k];PAL[o+12+k]-=PAL[o+k]*x+PAL[o+4+k]*y+PAL[o+8+k]*z;}
  }
  const o=(sl*NB+4)*16;for(let k=0;k<3;k++)j[51+k]=PAL[o+k]*0+PAL[o+4+k]*YC+PAL[o+8+k]*.012+PAL[o+12+k]; // 머리 중심 (피격 판정)
  const kd=KIND[P.kind]||0;P._ok=1;
  PAL.set([kd,P._r,K[0],kd<2?6:kd>2?9:K[3]>.35?7:8,a[30],P._g[0],P._g[1],a[31],+!!P._W,(K[1]-.4)*.012,.96+K[2]*.09,P.gun?1:.2],(sl*NB+18)*16);
 };
 const mk=(kind,o)=>{
  const P=Object.assign({kind,p:[0,0,0],yaw:0,pose:'stand',look:null,aim:null,talk:0,gun:0,seed:1,hp:100,dead:false,M:null,vis:true},o),r=G.rng(P.seed*7919+131);
  P._r=r();P._k=[r(),r(),r(),r()];P._sc=.96+r()*.08;P._a=new Float32Array(32);P._s=new Float32Array(32);P._j=new Float32Array(54);
  P._g=[0,0];P._lp0=[...P.p];P._e=[0,SIT[P.pose]?.66:1.6,.09];P._mz=[0,1.3,.5,0,0,1];P._bt=1;P._t0=P._v=P._ph=P._ly=P._lp=0;P._ht=-9;
  return P;
 };
 const step=(P,t,dt)=>{ // 상태 전이 · 속도 · 포즈 블렌드(0.3 s 크로스페이드)
  let ps=P.dead?'dead':P.pose;
  if(ps==='hit'){P._ht=t;ps=P.pose=P._cp&&P._cp!=='dead'?P._cp:'stand';}
  if(ps!==P._cp){if(P._cp){P._s.set(P._a);P._bt=0;}P._sit=SIT[ps==='dead'?P._cp||P.pose:ps];P._cp=ps;P._t0=t;}
  if(ps==='stumble'&&t-P._t0>2.5)P.pose='stand';
  const q=P._lp0,d=H(P.p[0]-q[0],P.p[2]-q[2]);q[0]=P.p[0];q[2]=P.p[2];
  if(dt>0)P._v+=(cl(d/dt,0,7)-P._v)*Math.min(1,dt*8);
  P._ph+=dt*(.9+.2*P._v)*2*PI;
  tgt(P,TA,t,dt);P._bt=Math.min(1,P._bt+dt/.3);
  const k=ss(0,1,P._bt);for(let i=0;i<32;i++)P._a[i]=L(P._s[i],TA[i],k);
 };
 const list=[],FP=mk('rok',{seed:3});
 // 광선–캡슐: 광선과 선분의 최근접 거리 ≤ r 이면 진입 거리(근사)
 const CAP=[0,3,.19,17,17,.12,5,6,.06,6,7,.05,8,9,.06,9,10,.05,11,12,.09,12,13,.07,14,15,.09,15,16,.07];
 const rc=(o,d,A,i,j,r)=>{
  const ux=A[j]-A[i],uy=A[j+1]-A[i+1],uz=A[j+2]-A[i+2],wx=o[0]-A[i],wy=o[1]-A[i+1],wz=o[2]-A[i+2];
  const a=ux*ux+uy*uy+uz*uz,b=ux*d[0]+uy*d[1]+uz*d[2],e=d[0]*wx+d[1]*wy+d[2]*wz,n=a-b*b;
  const s=n>1e-9?cl((ux*wx+uy*wy+uz*wz-b*e)/n,0,1):0,t=b*s-e,q=r*r-H(wx+d[0]*t-ux*s,wy+d[1]*t-uy*s,wz+d[2]*t-uz*s)**2;
  return t>0&&q>0?Math.max(t-Math.sqrt(q),0):-1;
 };
 G.people={
  list,fp:F,
  add(kind,o){const P=mk(kind,o);list.push(P);return P;},
  remove(P){const i=list.indexOf(P);i>=0&&list.splice(i,1);},
  clear(){list.length=0;},
  eye:P=>M4.point(wm(P),P._e),
  muzzle(P){if(P===F)P=FP;const W=wm(P),m=P._mz,p=M4.point(W,m),d=V3.norm(V3.sub(M4.point(W,[m[0]+m[3],m[1]+m[4],m[2]+m[5]]),p));return[...p,...d];},
  ray(o,d,max=1e9){
   let R=null;
   for(const P of list){
    if(P.dead||P.pose==='dead'||P.vis===false||!P._ok)continue;
    for(let c=0;c<30;c+=3){const t=rc(o,d,P._j,CAP[c]*3,CAP[c+1]*3,CAP[c+2]);if(t>=0&&t<max){max=t;R={P,t,part:c?c>3?'limb':'head':'body'};}}
   }
   return R;
  }
 };

 let sm,bgl,bg,pb,ib,vb,xb,pipe,spipe,lod=-1,n=0,fpn=0;const PP={},MR=[],off=[0,0,0,0];
 const mkp=(vs,ds,fragment,count=1)=>G.dev.createRenderPipeline({
  layout:G.layout(bgl),vertex:{module:sm,entryPoint:vs,buffers:[
   {arrayStride:40,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x4'}]},
   {arrayStride:4,stepMode:'instance',attributes:[{shaderLocation:3,offset:0,format:'uint32'}]}]},
  fragment,primitive:{cullMode:'back'},multisample:{count},depthStencil:{format:G.DEPTH,depthWriteEnabled:true,...ds}});
 const draw=(p,pl,s)=>{ // s = 1: 그림자 (1인칭 팔·총 제외)
  if(!n||!pl)return;
  p.setPipeline(pl);p.setBindGroup(1,bg);p.setVertexBuffer(0,vb);p.setVertexBuffer(1,ib);p.setIndexBuffer(xb,'uint16');
  for(let k=0;k<4;k++){const c=GL[k].length-(s&&fpn&&(!k||k===fpn-1)?1:0);if(c>0)p.drawIndexed(MR[k][1],c,MR[k][0],0,off[k]);}
 };
 G.register('people',{
  init(){
   const d=G.dev,U=GPUBufferUsage;
   sm=G.shader(WGSL,'people');
   bgl=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:'read-only-storage'}}]});
   pb=d.createBuffer({size:PAL.byteLength,usage:U.STORAGE|U.COPY_DST});ib=d.createBuffer({size:IB.byteLength,usage:U.VERTEX|U.COPY_DST});
   bg=d.createBindGroup({layout:bgl,entries:[{binding:0,resource:{buffer:pb}}]});
   spipe=mkp('vsS',{depthCompare:'less',depthBias:2,depthBiasSlopeScale:2});
  },
  onQuality(Q){
   const d=G.dev,U=GPUBufferUsage,lo=+(Q.level<1);
   pipe=PP[Q.msaa]||(PP[Q.msaa]=mkp('vs',{depthCompare:'greater'},{module:sm,entryPoint:'fs',targets:[{format:G.HDR}]},Q.msaa));
   if(lo===lod)return;lod=lo;V=[];I=[];
   [()=>body(lo),()=>gun(0),()=>gun(1),()=>gun(2)].forEach((f,k)=>{const s=I.length;f();MR[k]=[s,I.length-s];});
   for(let t=0;t<I.length;t+=3){ // 면 법선을 정점에 누적 → 매끈한 법선
    const a=I[t]*10,b=I[t+1]*10,c=I[t+2]*10,e=[0,1,2].map(k=>V[b+k]-V[a+k]),f=[0,1,2].map(k=>V[c+k]-V[a+k]),nn=V3.cross(e,f);
    for(const q of[a,b,c])for(let k=0;k<3;k++)V[q+3+k]+=nn[k];
   }
   vb&&vb.destroy();xb&&xb.destroy();
   const v=new Float32Array(V),x=new Uint16Array(I.length+1&~1);x.set(I);
   vb=d.createBuffer({size:v.byteLength,usage:U.VERTEX|U.COPY_DST});d.queue.writeBuffer(vb,0,v);
   xb=d.createBuffer({size:x.byteLength,usage:U.INDEX|U.COPY_DST});d.queue.writeBuffer(xb,0,x);
  },
  prepare(){
   try{
    const t=G.time,dt=G.dt,c=G.cam;n=0;for(const g of GL)g.length=0;
    for(let i=0;i<=list.length;i++){
     const P=list[i]||(i===list.length&&F.on?FP:0);if(!P||P.vis===false||n>=MAXP)continue;
     if(P===FP){ // 카메라 기준 좌표계
      const z=V3.norm(V3.sub(c.target,c.pos)),x=V3.norm(V3.cross(c.up,z)),y=V3.cross(z,x);
      P._W=new Float32Array([...x,0,...y,0,...z,0,...c.pos,1]);P.gun=F.gun;fpose(P._a);
     }else step(P,t,dt);
     solve(P,P._a,n);GL[0].push(n);if(GUN[P.gun])GL[GUN[P.gun]].push(n);n++;
    }
    fpn=F.on&&n?(GUN[F.gun]||0)+1:0;
    if(!n)return;
    let o=0;GL.forEach((g,k)=>{off[k]=o;IB.set(g,o);o+=g.length;});
    G.dev.queue.writeBuffer(pb,0,PAL,0,n*NB*16);G.dev.queue.writeBuffer(ib,0,IB,0,o);
   }catch(e){G.err('people: ' +(e.stack||e));n=0;}
  },
  opaque(p){draw(p,pipe,0);},
  shadow(p){draw(p,spipe,1);}
 },'story');
}
