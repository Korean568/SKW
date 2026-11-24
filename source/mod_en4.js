'use strict';
/* 영어 사전 (en4) — G.i18n.add({한국어:'English'}) — 스토리 4 · 폐허가 된 서강 (mod_story4.js · mod_ruins.js)
   폐허의 간판(SIGN, 캔버스 글자)은 서강 거리의 일부라 한국어 그대로 둔다. */
{
  // 영어일 때만: 제목 카드의 긴 영어 제목이 한 줄에 들어가게
  G.css('html[lang=en] #s4t b{font-size:5vh;letter-spacing:.06em;padding:0 4vw}');
  G.i18n.add({
    // 해설 · 장소
    '고혁명은 리충성이 죽는 것을 지켜본 후, 리옥선을 죽여야된다고 생각하고 자신을 진심으로 존경하는 부하들과 함께 항복하려고 헬리콥터를 타고 대한민국 서강으로 간다.':
      'Having watched Ri Chung-seong die, Ko Hyeok-myeong knows Ri Ok-seon must be killed. With the men who truly respect him, he flies to Seogang in South Korea — to surrender.',
    '서강시 · 폐허 — 새벽':'Seogang City · Ruins — Dawn',
    '서강시':'Seogang City','폐허 — 새벽':'Ruins — Dawn',
    // 조작 안내
    'WASD 이동 · 마우스 둘러보기 · 오른쪽 클릭 조준 · Tab 빨리 감기':'WASD move · Mouse look · Right-click aim · Tab fast-forward',
    // 대사 — 특전사
    '어? 뭐야 북한군의 헬기잖아?':"Huh? Wait — that's a North Korean chopper!",
    '경계하라!':'Weapons up! Stay sharp!',
    '누가 내립니다!':"Someone's getting out!",
    '당신은 누구요?':'Who are you?',
    // 대사 — 고혁명
    '나는 고혁명이라는 조선의 장교요.':"I am Ko Hyeok-myeong, an officer of the Korean People's Army.",
    '남조선에 항복하러 왔소.':'I have come to surrender to the South.',
    '앞으로 남조선을 적극 지원하겠소.':'From this day on, I will give the South my full support.',
    // 무전 — 리옥선 ↔ 고혁명
    '고혁명 동무, 어디갔소?':'Comrade Ko Hyeok-myeong, where have you gone?',
    '분명 남조선 ㅅㄲ들을 처리하러간다고 하지않았소?':'Did you not say you were going to deal with those Southern b*stards?',
    '지금 찾고 있습네다.':'I am searching for them now.',
    '이게 어딜 날 속이려고!':'How dare you try to deceive me!',
    '난 동무가 남조선에 항복한것을 다 안다!':'I know everything, Comrade — you surrendered to the South!',
    '저는 인민들을 리옥선 동지한테서 구출하기 위해 항복했습네다.':'I surrendered to save the people from you, Comrade Ri Ok-seon.',
    '그렇다면 동무는 특별히 나중에 두개골을 으스러주겠소!':'Then I shall save you for later, Comrade — and crush your skull myself!',
    '리옥선 동지, 동무는 남조선을 이길 수 없습네다.':'Comrade Ri Ok-seon, you cannot defeat the South.',
    '어디 두고 보라지!':'We shall see about that!',
  });
}
