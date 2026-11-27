'use strict';
/* ENARMS — 무기(11종) 공용 영어 사전 (스토리 1·2·4 · mod_arms.js · mod_fps.js 의 무기 글자 · 터치 버튼 '모드')
   이름 · 모드 · 칸 · 안내는 세 스토리가 함께 쓰므로 en1/en2/en4 에 나누지 않고 여기 한 곳에 둔다 (스토리 1 도움말 줄만 en1).
   {n}(총 이름) · {k}(숫자) 가 들어간 글자는 G.i18n.re 패턴. 터치(mod_touch)는 [E] 같은 키 표시를 지운 글자를 다시 찾으므로
   패턴은 키 표시가 있어도 없어도 맞게 쓴다. */
if (G.i18n) {
  const N = { // 총 이름 (G.arms.W[id].n) — 'RPG-7' 은 한글이 없어 그대로
    'K2 소총': 'K2 Rifle', 'K2C1 소총': 'K2C1 Rifle', 'K2C 카빈': 'K2C Carbine', 'K2A 소총': 'K2A Rifle', 'M16 소총': 'M16 Rifle',
    'AUG A1 소총': 'AUG A1 Rifle', 'AKM 소총': 'AKM Rifle', 'K14 저격소총': 'K14 Sniper Rifle', 'K7 기관단총': 'K7 SMG', 'K5 권총': 'K5 Pistol',
    'M134 미니건': 'M134 Minigun',
  };
  const n = s => { s = s.trim(); return N[s] || G.i18n.D.get(s) || s; }; // 패턴 안의 총 이름
  G.i18n.add(N);
  G.i18n.add({
    // 사격 모드 (B) · 칸 · HUD 조각 (각각 따로 된 글자 노드)
    '연사': 'Auto', '점사': 'Burst', '단발': 'Single', '볼트': 'Bolt',
    '주무기': 'Primary', '보조': 'Secondary', '중화기': 'Heavy',
    '탄띠': 'Belt', '회전 중': 'Spinning', '로켓': 'Rockets', '양각대': 'Bipod',
    // 안내 · 알림
    '지금은 쏠 수 없다': 'You can’t fire now', '사람이 있는 쪽으로는 쏠 수 없다': 'Not toward people',
    '조준경 일체형': 'Built-in optic', '탄띠 교체 [R]': 'Change belt [R]', '로켓 없음': 'No rockets',
    '숨 참기 [Shift]': 'Hold breath [Shift]', '재장전 중…': 'Reloading…', '[R] 재장전': '[R] Reload', '탄약 없음': 'Out of ammo',
    'AKM 소총 획득 — [3] 으로 교체': 'Got an AKM — [3] to switch',
    // 스토리 1 시신 (mod_fps) — 다음 E 가 할 일
    '[E] AKM 소총·탄창 줍기': '[E] Pick up AKM rifle & ammo', '[E] AKM 소총(으)로 바꾸기': '[E] Swap to AKM Rifle',
    // 예전 표기 (K7 은 기관단총) — 남아 있는 글자도 바뀌게 옛 키 유지
    'K7 권총': 'K7 SMG', 'K7 권총 + 스코프': 'K7 SMG + Scope',
    // 터치 버튼 (mod_touch): 사격 모드 · 무기 고르기
    '모드': 'MODE', '무기 고르기': 'Choose weapon', '빈 칸': 'Empty',
  });
  // 총 이름만 받는 패턴 (다른 스토리의 '… 줍기' 같은 글자가 사전에 빠졌을 때 한국어가 섞인 채 넘어가지 않게)
  const A = '(' + Object.keys(N).concat('RPG-7').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')';
  const R = s => new RegExp('^' + s.replace('{n}', A) + '$');
  G.i18n.re([
    [R('(\\[E\\] )?{n} 탄약 줍기 \\(\\+(\\d+)\\)'), (m, e, a, k) => (e || '') + 'Take ' + n(a) + ' ammo (+' + k + ')'],
    [R('(\\[E\\] )?{n}\\(으\\)로 바꾸기'), (m, e, a) => (e || '') + 'Swap to ' + n(a)],
    [R('(\\[E\\] )?{n} 줍기'), (m, e, a) => (e || '') + 'Pick up ' + n(a)],
    [R('{n} 획득 — \\[(\\d)\\] 으로 교체'), (m, a, k) => 'Got the ' + n(a) + ' — [' + k + '] to switch'],
    [R('{n}에는 스코프를 달 수 없다'), (m, a) => 'Can’t mount a scope on the ' + n(a)],
    [R('{n} 탄약 \\+(\\d+)'), (m, a, k) => n(a) + ' ammo +' + k],
  ]);
}
