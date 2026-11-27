'use strict';
/* 영어 사전 (en1) — G.i18n.add({한국어:'English'}) — 스토리 1 · 처음 화면 · 총격전 HUD (mod_story.js · mod_fps.js) */
if(G.i18n){
  G.i18n.add({
    /* ── 처음 화면: 챕터 목록 · 조작 안내 ── */
    '플레이어: 김민철 하사':'Player: Staff Sgt. Kim Min-cheol',
    '플레이어: 북한 군인(동무) · AKM 소총':'Player: KPA soldier (Comrade) · AKM rifle',
    '플레이어: 리충성 · 투척단검 · 단검':'Player: Ri Chung-seong · Throwing knives · Dagger',
    '플레이어: 김민철 하사 · K2C1 소총':'Player: Staff Sgt. Kim Min-cheol · K2C1 rifle',
    '컷신':'Cutscenes','전투':'Combat',
    '마우스: 둘러보기 · Space: 건너뛰기 (누르고 있으면 빨리 감기)':'Mouse: look around · Space: skip (hold to fast-forward)',
    'WASD 이동 · 마우스 조준 · 왼쪽 클릭 사격 · 오른쪽 클릭 정조준 · R 재장전 · E 줍기 · Shift 달리기 · C 앉기':
      'WASD move · Mouse aim · Left click fire · Right click aim down sights · R reload · E pick up · Shift run · C crouch',
    '그래픽 설정 · Enter 시작':'Graphics settings · Enter to start',

    /* ── 스토리 1 대본: 해설 · 장면 제목 ── */
    '주인공 김민철 하사는 마스크 대령과 박창원 중위, 이자용 병장, 신영호 상병, 김전부 이병과 함께 휴가를 내고 비행기를 탄다.':
      'Staff Sgt. Kim Min-cheol boards a flight home on leave with Colonel Mask, 1st Lt. Park Chang-won, Sgt. Lee Ja-yong, Cpl. Shin Yeong-ho and Pvt. Kim Jeon-bu.',
    '이륙 15분 후':'15 minutes after takeoff',

    /* ── 스토리 1 대본: 대사 ── */
    '아 드디어 휴가다!!':'Leave! Finally!!',
    '그게 그렇게 좋냐?':'That happy about it, huh?',
    '뼈가 으스러지게 훈련하는 것보단 낫죠.':'Beats training till your bones crack, sir.',
    '야 그런데 그러고 보니 김전부는 오자마자 휴가냐':'Hey, come to think of it, Kim Jeon-bu, you just got here and you’re already on leave?',
    '아닙니다! 전 군대에 온지 7개월이나 지났단 말입니다!':'No, sir! I’ve been in for seven whole months!',
    '하하하 그래.':'Ha ha ha. Fair enough.',
    '맞는말이긴 하지.':'Can’t argue with that.',
    '전 화장실 좀 다녀올게요.':'I’m going to hit the restroom.',
    '난 좀 자야겠군.':'I’m going to catch some sleep.',
    '저는 뉴스나 볼게요.':'I’ll just watch the news.',
    '무슨일입니까?':'What’s going on?!',
    '나도 몰라!':'I don’t know!',
    '아니 이게 무슨..':'What the hell is this...',
    '추락한다!':'We’re going down!',
    '이제 어떻게합니까?':'What do we do now?!',
    '몰라!':'How should I know!',
    '이런 젠장 환장하겠네 시X!':'Damn it, this is insane! Sh*t!',
    '야 그래도 이륙한지 20분 밖에 안 지났으니 괜찮을 거야!':'Hey, we’re only twenty minutes out. We’ll be fine!',
    '이게 무슨 소리야?':'What was that noise?',
    '모르겠습니다!':'No idea, sir!',
    '아 tlqkf 환장하겠네!!':'Ah, f*ck! I’m losing my mind!!',
    '이런 젠장!':'Damn it!',
    '속보입니다. 일주일전, 리충성이라는 인민군이 김준호 국무위원장을 살해했습니다. 이것으로 인해 대한민국 공격이 우려되며...':
      'Breaking news. One week ago, a KPA soldier named Ri Chung-seong assassinated Chairman Kim Jun-ho. Fears are now growing of an attack on the Republic of Korea...',
    '야 김민철!':'Hey, Kim Min-cheol!',
    '옙!':'Sir!',
    '김전부는?':'Where’s Kim Jeon-bu?',
    '전사했습니다..':'He’s gone, sir... KIA.',
    '이런 tlqkf! 벌써 뒤졌어?':'F*ck! He’s dead already?',
    '저기 북한ㅅㄲ들이다!':'There! North Korean b*stards!',
    '저 🐶ㅅㄲ들!! 복수할거다!!':'You 🐶 b*stards!! I’ll make you pay!!',
    '돌격!!':'Charge!!',
    '죽어라!!':'Die!!',
    '돌격하라!!':'All of you, charge!!',
    '저 tlqkf놈들의 두개골을 박살내주마!!!':'I’ll smash those f*ckers’ skulls in!!!',
    '뒤져라 이 🐶씹ㅅㄲ들아!!':'Drop dead, you 🐶 motherf*ckers!!',
    '뒤져!!!':'Die!!!',

    /* ── 좌석 화면 뉴스 (캔버스, G.tr) ── */
    '속보':'BREAKING',
    '인민군 리충성, 김준호 국무위원장 살해':'KPA’s Ri Chung-seong kills Chairman Kim Jun-ho',
    '대한민국 공격 우려 · 대북 경계태세 격상 · 국방부 긴급회의 ·':'Attack on South Korea feared · Alert raised against the North · Defense Ministry in emergency session ·',
    'SKW 뉴스':'SKW NEWS',

    /* ── 끝 카드 ── */
    '사살한 북한군':'KPA killed',

    /* ── 총격전 HUD (mod_fps.js) ── */
    'K2C1 소총':'K2C1 Rifle','K7 권총':'K7 SMG','AK 소총':'AK Rifle',
    'K2C1 소총 + 스코프':'K2C1 Rifle + Scope','AK 소총 + 스코프':'AK Rifle + Scope','K7 권총 + 스코프':'K7 SMG + Scope',
    '방탄판':'Armor',
    '북한군':'KPA','북한군을 제압하라':'Neutralize the KPA',
    '방탄판 교체 중…':'Swapping plate…',
    '방탄판 교체 [F]':'Swap plate [F]','무방비 — 방탄판 교체 [F]':'Exposed — Swap plate [F]',
    '예비 방탄판 없음':'No spare plates','무방비 — 예비 방탄판 없음':'Exposed — No spare plates',
    '김민철 하사가 쓰러졌다':'Staff Sgt. Kim Min-cheol is down',
    '부활 · 3초간 무적':'Revived · Invulnerable for 3s',
    'AK 소총 획득 — [3] 으로 교체':'Got an AK rifle — [3] to switch',
    '방탄판 +1':'Armor plate +1','탄창 획득!':'Got a magazine!',
    '권총에는 스코프를 달 수 없다':'Can’t mount a scope on a pistol',
    '[E] 방탄판 줍기':'[E] Pick up armor plate','[E] 탄창 줍기':'[E] Pick up magazine','[E] AK 소총·탄창 줍기':'[E] Pick up AK rifle & ammo',
    '재장전 중…':'Reloading…','[R] 재장전':'[R] Reload','탄약 없음':'Out of ammo',
    '화면을 클릭하면 조준이 시작됩니다':'Click the screen to take aim',
    'WASD 이동 · Shift 달리기 · C 앉기 · 좌클릭 사격 · 우클릭 조준 · R 재장전 · E 줍기 · F 방탄판 교체 · T 스코프 · 1 K2C1 · 2 K7 · 3 AK · 휠 무기 교체':
      'WASD move · Shift run · C crouch · Left click fire · Right click aim · R reload · E pick up · F swap plate · T scope · 1 K2C1 · 2 K7 · 3 AK · Wheel switch weapon',
    // 도움말 줄 (#lk) — 무기 11종 (mod_arms): 1–4 칸 · B 사격 모드 · T 스코프. 무기 이름 · 모드 · 줍기 안내는 mod_enarms.js
    'WASD 이동 · Shift 달리기 · C 앉기 · 좌클릭 사격 · 우클릭 조준 · R 재장전 · E 줍기 · F 방탄판 교체 · T 스코프 · B 사격 모드 · 1–4 무기 · 휠 무기 교체':
      'WASD move · Shift run · C crouch · Left click fire · Right click aim · R reload · E pick up · F swap plate · T scope · B fire mode · 1–4 weapons · Wheel switch weapon',
    '북한군 제압 완료':'KPA Neutralized',
    '추락 현장을 지켜냈다':'The crash site is secured',
  });
  G.i18n.re([
    [/^무방비 · 피격 (\d)\/2$/,'Exposed · hits $1/2'],
  ]);
  /* 영어일 때만: 긴 영어 글자가 넘치지 않게 (한국어 화면은 그대로) */
  G.css(`html[lang=en] #fd b{font-size:clamp(30px,5.4vw,70px);letter-spacing:.16em;margin-right:-.16em}
html[lang=en] #fd button{letter-spacing:.22em}html[lang=en] #fd button.t{letter-spacing:.12em}`);
}
