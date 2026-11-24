'use strict';
/* 언어 (한국어 / English)
   게임 데이터·대본·흐름은 한국어 그대로 두고, 화면에 보이는 글자만 사전으로 바꾼다.
   - DOM 글자(텍스트 노드, title/placeholder/aria-label 속성): MutationObserver 가 자동으로 바꾼다 (그리기 전에 처리됨).
   - 캔버스 글자 등 DOM 밖: G.tr('한국어') 로 감싼다.
   사전: G.i18n.add({'한국어':'English'}) — 키는 텍스트 노드 하나의 글자(앞뒤 공백 제외) 그대로.
   패턴: G.i18n.re([[/^정규식$/, '바꿀 글자 $1' 또는 함수]]).  ' · ' 로 이은 글자는 조각마다 찾아 본다.
   빠진 글자: G.i18n.miss (영어일 때 화면에 나왔는데 사전에 없던 한국어).  data-i18n-skip 이 붙은 요소 안은 그대로 둔다.
   언어 고르기: ?lang=en|ko > localStorage 'skw-lang' > 브라우저 언어(한국어가 아니면 영어). 처음 화면 오른쪽 위 버튼으로 바꾼다. */
{
  const D=new Map(),RE=[],SEEN=new WeakMap(),miss=new Set(),subs=[],ATTR=['title','placeholder','aria-label'];
  const KO=/[가-힣ㄱ-ㆎ]/;
  const pick=()=>{
    const q=G.params.get('lang');if(q==='en'||q==='ko') return q;
    try{const s=localStorage.getItem('skw-lang');if(s==='en'||s==='ko') return s;}catch(e){}
    const L=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'ko'];
    return L.some(l=>/^ko/i.test(l))?'ko':'en';
  };
  let lang=pick(),live=false;
  const look=k=>{
    let v=D.get(k);if(v!=null) return v;
    for(const [r,f] of RE) if(r.test(k)) return k.replace(r,f);
    if(k.includes(' · ')){const p=k.split(' · ').map(x=>KO.test(x)?look(x.trim()):x);if(p.every(x=>x!=null)) return p.join(' · ');}
    return null;
  };
  const tr=s=>{
    if(lang!=='en'||typeof s!=='string'||!KO.test(s)) return s;
    const k=s.trim(),v=look(k);if(v==null){miss.add(k);return s;}
    const i=s.indexOf(k);return s.slice(0,i) + v + s.slice(i + k.length);
  };
  const skip=e=>!e||!e.closest||!!e.closest('head,style,script,[data-i18n-skip]');
  const txt=n=>{const t=n.nodeValue;if(!t||!KO.test(t)) return;const v=tr(t);if(v!==t){SEEN.set(n,[t,v]);n.nodeValue=v;}};
  const attrs=e=>{for(const a of ATTR){const t=e.getAttribute(a);if(t&&KO.test(t)){const v=tr(t);if(v!==t){(e._i18n||(e._i18n={}))[a]=[t,v];e.setAttribute(a,v);}}}};
  const F={acceptNode:n=>n.nodeType===1&&(/^(STYLE|SCRIPT)$/.test(n.tagName)||n.hasAttribute('data-i18n-skip'))?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT};
  const walk=r=>{
    if(r.nodeType===3){if(!skip(r.parentNode)) txt(r);return;}
    if(r.nodeType!==1||skip(r)) return;
    attrs(r);const w=document.createTreeWalker(r,5,F);// 5 = SHOW_ELEMENT|SHOW_TEXT
    while(w.nextNode()){const n=w.currentNode;n.nodeType===3?txt(n):attrs(n);}
  };
  const restore=r=>{
    const w=document.createTreeWalker(r,5);
    while(w.nextNode()){const n=w.currentNode;
      if(n.nodeType===3){const s=SEEN.get(n);if(s&&n.nodeValue===s[1]) n.nodeValue=s[0];}
      else if(n._i18n){for(const a in n._i18n){const [k,v]=n._i18n[a];if(n.getAttribute(a)===v) n.setAttribute(a,k);}n._i18n=null;}}
  };
  const mo=new MutationObserver(rs=>{
    if(lang!=='en') return;
    for(const r of rs){
      if(r.type==='characterData'){if(!skip(r.target.parentNode)) txt(r.target);}
      else if(r.type==='attributes'){if(!skip(r.target)) attrs(r.target);}
      else for(const n of r.addedNodes) walk(n);
    }
  });
  const on=()=>{if(live) return;live=true;mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTR});document.body&&walk(document.body);};
  const off=()=>{if(!live) return;mo.takeRecords();mo.disconnect();live=false;document.body&&restore(document.body);};
  const sync=()=>{document.documentElement.lang=lang;document.querySelectorAll('.lng span').forEach(s=>s.classList.toggle('on',s.dataset.l===lang));};
  const set=l=>{
    l=l==='en'?'en':'ko';if(l===lang) return;lang=l;
    try{localStorage.setItem('skw-lang',l);}catch(e){}
    l==='en'?on():off();sync();
    for(const f of subs) try{f(l);}catch(e){console.error(e);}
  };
  const add=o=>{for(const k in o) D.set(k.trim(),o[k]);};
  G.i18n={add,re:a=>{for(const x of a) RE.push(x);},set,tr,miss,D,onChange:f=>subs.push(f),get lang(){return lang;}};
  G.tr=tr;
  Object.defineProperty(G,'lang',{get:()=>lang,configurable:true});
  if(lang==='en') on();
  document.documentElement.lang=lang;

  /* 공통 용어 — 이름·계급·이야기 제목·버튼 (스토리별 사전 모듈 mod_en*.js 가 같은 표기를 쓴다) */
  add({
    // 인물
    '김민철':'Kim Min-cheol','김민철 하사':'Staff Sgt. Kim Min-cheol','마스크 대령':'Colonel Mask','박창원':'Park Chang-won','박창원 중위':'1st Lt. Park Chang-won',
    '이자용':'Lee Ja-yong','이자용 병장':'Sgt. Lee Ja-yong','신영호':'Shin Yeong-ho','신영호 상병':'Cpl. Shin Yeong-ho','김전부':'Kim Jeon-bu','김전부 이병':'Pvt. Kim Jeon-bu',
    '뉴스 앵커':'News Anchor','리옥선':'Ri Ok-seon','고혁명':'Ko Hyeok-myeong','동무':'Comrade','리충성':'Ri Chung-seong','김준호':'Kim Jun-ho',
    '고위간부들':'Senior Officials','무전':'RADIO',
    // 이야기 제목 (처음 화면 · 장면 카드 · 끝 카드)
    '스토리 1':'Story 1','스토리 2':'Story 2','스토리 3':'Story 3','스토리 4':'Story 4',
    '서강시 : 전쟁의 시작':'Seogang City: The War Begins','북한 마을 : 5일전으로':'A North Korean Village: Five Days Earlier',
    '북한 주석궁 : 다시 지금 북한으로':'The Presidential Palace: Back to the Present','폐허가 된 서강 : 고혁명의 배신':"Seogang in Ruins: Ko Hyeok-myeong's Betrayal",
    '대한민국편':'Republic of Korea','조선민주주의인민공화국편':"Democratic People's Republic of Korea",
    '스토리 1 — 끝':'Story 1 — The End','스토리 2 — 끝':'Story 2 — The End','스토리 3 — 끝':'Story 3 — The End','스토리 4 — 끝':'Story 4 — The End',
    // 버튼 · 공통 화면
    '시 작':'START','처음 화면':'Title Screen','처음 화면으로':'Back to Title','처음부터':'Play Again','다시 하기':'Try Again','다시 싸우기':'Fight Again',
    '부활':'Revive','전사':'Killed in Action','건너뛰기 ▸':'Skip ▸','계속하기':'Resume','설정':'Settings','게임 종료':'Quit Game',
    '다음 이야기에서 계속…':'To be continued…',
  });
  G.i18n.re([
    [/^고위간부 (\d+)$/,'Senior Official $1'],
    [/^스토리 (\d) — (.+)$/,(m,n,t)=>'Story ' + n + ' — ' + (look(t.trim())||t)],
  ]);

  /* 처음 화면 오른쪽 위: 한국어 | English */
  G.register('i18n',{init(){
    G.css(`#ov .lng{position:absolute;top:2.4vh;right:2vw;display:flex;gap:.35em;font:600 max(11px,.85vw) system-ui;letter-spacing:.12em}#ov .lng span{padding:.3em .9em .35em;border:1px solid #fff4;border-radius:999px;color:#9fb1c4;background:#0006;cursor:pointer;pointer-events:auto}#ov .lng span:hover{color:#fff;border-color:#fff}#ov .lng span.on{color:#0b0f14;background:#fff;border-color:#fff}`);
    const put=()=>{const ov=document.getElementById('ov');if(!ov) return setTimeout(put,80);if(ov.querySelector('.lng')) return;
      const b=G.el('div',{className:'lng',innerHTML:'<span data-l=ko>한국어</span><span data-l=en>English</span>'},ov);
      b.setAttribute('data-i18n-skip','');
      b.onclick=e=>{e.stopPropagation();const l=e.target.dataset&&e.target.dataset.l;l&&set(l);};sync();};
    put();
  }});
}
