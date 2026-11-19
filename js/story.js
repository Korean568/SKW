// ═══════════════════════════════════════════════════════════════
//   제2차 한국전쟁 — 스토리 / 대사 / 캐릭터 설정 파일
//   ★ 이 파일만 고치면 스토리와 대사를 바꿀 수 있습니다 ★
// ═══════════════════════════════════════════════════════════════
//
//  [좌표 찾는 법]
//   게임 중 F2 를 누르면 왼쪽 위에 현재 위치(x, z)와 바라보는 각도가 나옵니다.
//   그 숫자를 아래 pos: [x, z] 에 그대로 적으면 됩니다.
//   각도(rot)는 도 단위: 0 = +Z 방향, 90 = +X 방향, 180 = -Z, -90 = -X
//
//  [디버그 키 — F2 를 켠 상태에서만]
//   N : 지금 기다리는 단계 건너뛰기
//   주소 뒤에 ?debug 를 붙이면 처음부터 디버그 모드로 시작합니다. (?debug&ch=2 → 2번째 챕터부터)
//
//  [챕터 steps 에서 쓸 수 있는 명령]  (위에서 아래로 순서대로 실행됨)
//   { type:'fade', out:true, duration:1 }        화면 검게(out:true) / 밝게(out:false)
//   { type:'title', text:'제1장', sub:'부제', duration:4 }   큰 제목 표시
//   { type:'dialogue', lines:[ {who:'캐릭터키', text:'대사', anim:'Salute'}, ... ] }
//         → 대화창 (클릭/Space로 넘김, Tab으로 건너뛰기). 게임이 멈춥니다.
//           who 를 빼거나 'narration' 이면 나레이션(이름 없음)
//           name:'다른 이름' 으로 표시 이름만 바꿀 수 있음
//           anim: 말할 때 동작 (아래 [애니메이션] 참고)
//           cam:false 면 카메라를 말하는 사람에게 돌리지 않음
//           radio:true 면 무전 스타일(카메라 이동 없음)
//   { type:'radio', lines:[ {who, text, duration} ] }   게임은 계속 진행되며 아래 자막으로 나옴
//   { type:'camera', from:[x,y,z], to:[x,y,z], lookAt:[x,y,z], lookAtTo:[x,y,z], duration:5 }  연출 카메라
//   { type:'objective', text:'목표 문구' }
//   { type:'spawn', enemies:[ {who:'nk_soldier', pos:[x,z], rot:180, hp:100, prone:false, alert:false, group:'a'} ] }
//         → 적 등장. count:5, area:[x1,z1,x2,z2] 로 범위 안에 여러 명 랜덤 배치도 가능
//           boss:true 면 위에 체력바 표시, name:'표시 이름'
//   { type:'eliminate', text:'적을 모두 제거하라', group:'a' }   (group 생략 시 전체) 다 죽일 때까지 대기
//   { type:'goto', pos:[x,z], radius:3, text:'목표 지점으로 이동' }   그 위치에 도착할 때까지 대기
//   { type:'survive', seconds:60, text:'버텨라', waves:[ {at:10, enemies:[...]}, ... ] }
//   { type:'wait', seconds:2 }
//   { type:'ally',  who:'park_changwon', pos:[x,z], rot:90, follow:true }   아군 (따라오며 같이 싸움, 안 죽음)
//   { type:'actor', who:'kim_junho', pos:[x,z], rot:0, anim:'Command', id:'이름' }  연출용 인물
//   { type:'move', id:'park_changwon', to:[x,z], run:false, face:90, wait:true }   걸어가기
//   { type:'anim', id:'kim_junho', anim:'Wave' }       동작 바꾸기
//   { type:'face', id:'kim_junho', to:'player' }       (또는 to:[x,z] / to:각도)
//   { type:'remove', id:'kim_junho' }
//   { type:'teleport', pos:[x,z], rot:90 }               플레이어 순간이동
//   { type:'prop', id:'heli', model:'helicopter', pos:[x,y,z], rot:0, rotor:true }   소품(헬기) 배치
//   { type:'propMove', id:'heli', to:[x,y,z], rot:0, duration:5, wait:true }        소품 이동
//   { type:'rotor', id:'heli', on:false }                헬기 날개 회전 켜기/끄기
//   { type:'checkpoint' }        죽으면 여기서 다시 시작
//   { type:'player', visible:false, pos:[x,z], rot:90, y:-60, down:true, up:true }   주인공 숨기기/옮기기/쓰러뜨리기
//   { type:'shoot', from:'g1', at:'player', shots:3, wait:true }   정해진 사람이 쏘고 맞은 사람은 쓰러짐
//   { type:'pose', id:'player', pose:'kneel' }     무릎 꿇기 (pose:null 로 풀기)
//   { type:'kill', id:['lee_jayong'] }              그 자리에서 쓰러짐
//   { type:'missile', from:[x,y,z], to:[x,y,z], burn:'van' }     미사일 + 폭발
//   { type:'blackout', seconds:3 }                  기절(번쩍 → 암전 → 이명 → 깨어남)
//   { type:'sound', name:'kick'|'gunshot'|'boom' }
//   { type:'map', id:'seoul_ruins' }                챕터 도중 맵 바꾸기 (화면이 까말 때 쓰면 자연스러움)
//   { type:'wake' }                                  blackout 에 wake:false 를 줬을 때 깨어나기
//
//  [챕터 옵션]
//   player:'dongmu'                  이 챕터 주인공
//   weapons:['knife','throwknife']   무기 (기본 소총). 1·2 키 / 휠로 바꿈
//   playerNoWeapon:true              주인공 몸에 붙은 총 숨기기
//   noFire:true                      사격 금지
//   { type:'end' }               챕터 클리어
//
//  [애니메이션]
//   총 든 캐릭터 : Idle_Rifle, Walk_Rifle, Run_Rifle, Aim, Fire, Reload, Prone_Fire, Salute, Stand
//   지휘관       : Idle, Walk, Wave, Clap, Command, Salute
// ═══════════════════════════════════════════════════════════════

export const GAME = {
  title: 'Second Korean Wars',
  subtitle: '제2차 한국전쟁',
  menuMap: 'seoul_ruins',        // 메인 화면 배경 맵
  player: 'kim_mincheol',        // 기본 주인공 (챕터마다 player: 로 바꿀 수 있음)
  credits: [
    'Second Korean Wars',
    '',
    '기획 · 스토리 — (이름 입력)',
    '캐릭터 · 맵 — (이름 입력)',
    '프로그래밍 — (이름 입력)',
    '',
    '플레이해 주셔서 감사합니다',
  ],
};

export const TEAMS = {
  ROK: { name: '대한민국 국군', color: '#5aa9ff' },
  NK: { name: '조선인민군', color: '#ff5a5a' },
};

// 캐릭터 목록 — name(이름), rank(계급)는 자유롭게 바꾸세요
export const CHARACTERS = {
  // 국군
  kim_mincheol:       { file: 'character/ROK/kim_mincheol.glb',       name: '김민철', rank: '하사', team: 'ROK' },
  park_changwon:      { file: 'character/ROK/park_changwon.glb',      name: '박창원', rank: '중위', team: 'ROK' },
  lee_jayong:         { file: 'character/ROK/lee_jayong.glb',         name: '이자용', rank: '병장', team: 'ROK' },
  colonel_mask:       { file: 'character/ROK/colonel_mask.glb',       name: '마스크 대령', rank: '대령', team: 'ROK' },
  ko_hyeokmyeong_ROK: { file: 'character/ROK/ko_hyeokmyeong_ROK.glb', name: '고혁명', rank: '', team: 'ROK' },
  // 인민군
  nk_soldier:         { file: 'character/NK/nk_soldier.glb',          name: '인민군 병사', rank: '', team: 'NK' },
  ri_chungsong:       { file: 'character/NK/Lee(Ri)_chungsong.glb',   name: '리충성', rank: '최고령도자', team: 'NK' },
  ri_oksun:           { file: 'character/NK/Lee(Ri)_oksun.glb',       name: '리옥선', rank: '', team: 'NK' },
  kim_junho:          { file: 'character/NK/kim_junho.glb',           name: '김준호', rank: '', team: 'NK' },
  // 고위간부 3명 = 김준호 모델에 옷 색만 바꿈 (recolor: { 재질이름: 색 })
  official1:          { file: 'character/NK/kim_junho.glb', name: '고위간부 1', rank: '', team: 'NK', recolor: { camo: 0x2b3446, vest: 0x1e2533 } },
  official2:          { file: 'character/NK/kim_junho.glb', name: '고위간부 2', rank: '', team: 'NK', recolor: { camo: 0x55585c, vest: 0x3f4245, hair: 0x9c9a96 } },
  official3:          { file: 'character/NK/kim_junho.glb', name: '고위간부 3', rank: '', team: 'NK', recolor: { camo: 0x4a4632, vest: 0x36331f } },
  ko_hyeokmyeong_NK:  { file: 'character/NK/ko_hyeokmyeong_NK.glb',   name: '고혁명', rank: '', team: 'NK' },
  dongmu:             { file: 'character/NK/nk_soldier.glb',          name: '동무', rank: '', team: 'NK' },   // 스토리 2 주인공
  nk_civilian_man:    { file: 'character/NK/nk_civilian_man.glb',     name: '주민', rank: '', team: null },
  nk_civilian_woman:  { file: 'character/NK/nk_civilian_woman.glb',   name: '주민', rank: '', team: null },
};

// 맵 — bounds: [최소x, 최대x, 최소z, 최대z] (이 밖으로는 못 나감)
// sky: 'day'(낮) | 'dusk'(노을/연기) | 'overcast'(흐림) | 'night'(밤)
export const MAPS = {
  seoul_street: { file: 'map/map_seoul_street.glb', name: '서울 시가지', bounds: [-31.5, 31.5, -19, 9.5], sky: 'day' },
  seoul_ruins:  { file: 'map/map_seoul_ruins.glb',  name: '서울 폐허',   bounds: [-32.4, 33.6, -11.5, 10.5], sky: 'dusk', battle: true },
  kumsusan:     { file: 'map/map_Kumsusan Palace of the Sun.glb', name: '금수산 태양궁전', bounds: [-55, 55, -56, 44], sky: 'overcast', battle: true },
  nk_village:   { file: 'map/map_nk_village.glb', name: '북한 마을', bounds: [-50, 50, -50, 50], sky: 'overcast' },
};

// 소품
export const PROPS = {
  helicopter: { file: 'object/object_helicopter.glb', lift: 0.75, rotor: { node: 'Ceiling', material: 'hullD', minY: 2.45 } },
  van: { procedural: 'van' },   // 코드로 만든 승합차 (앞 = +Z)
  tv:  { procedural: 'tv' },    // 뉴스 TV — text: ['자막 1줄', '아래 띠 자막']
  room: { procedural: 'room' },  // 시골집 방 내부 (폭 7m, 깊이 4.5m, 문 = +Z 쪽)
};

// ═══════════════════════════════════════════════════════════════
//   챕터
// ═══════════════════════════════════════════════════════════════
export const CHAPTERS = [
  // ───────────────── 스토리 1 - 서울거리 : 전쟁의 시작 ─────────────────
  {
    title: '스토리 1',
    name: '서울거리 : 전쟁의 시작',
    map: 'seoul_street',
    start: { pos: [-5, -7], rot: 180 },
    steps: [
      { type: 'fade', out: true, duration: 0 },
      { type: 'player', visible: false },

      // ── 승합차를 타고 부대로 복귀하는 중 ──
      { type: 'prop', id: 'van', model: 'van', pos: [-31, 0, -5.2], rot: 90 },
      { type: 'camera', follow: 'van', offset: [-3.2, 2.0, -5.5], lookOffset: [0, 1.2, 6] },
      { type: 'propMove', id: 'van', to: [-22.5, 0, -5.2], duration: 9, wait: false },
      { type: 'fade', out: false, duration: 2 },
      { type: 'title', text: '스토리 1 - 서울거리 : 전쟁의 시작', sub: '-대한민국편-', duration: 6 },
      { type: 'wait', seconds: 7.5 },
      { type: 'dialogue', lines: [
        { who: 'kim_mincheol', text: '아 드디어 부대로 돌아간다!!', cam: false },
        { who: 'colonel_mask', text: '그게 그렇게 좋냐?', cam: false },
        { who: 'kim_mincheol', text: '전쟁터에서 죽을 위험을 무릅쓰고 싸우는 것보단 낫죠.', cam: false },
        { who: 'colonel_mask', text: '야 그런데 그러고 보니 이자용은 거의 오자마자 참전이냐', cam: false },
        { who: 'lee_jayong', text: '아닙니다 전 괜찮습니다!', cam: false },
        { who: 'colonel_mask', text: '그래. 모두 고생했다.', cam: false },
        { who: 'colonel_mask', text: '이제 부대로 돌아가자.', cam: false },
        { who: 'park_changwon', text: '대령님, 한빛마트에 지금 들려도 되겠습니까?', cam: false },
        { who: 'colonel_mask', text: '왜? 설마 벌써 배고픈건가?', cam: false },
        { who: 'park_changwon', text: '그게 아니라 신입 비상 식량을 챙겨야 하니까요.', cam: false },
        { who: 'lee_jayong', text: '전 비상 식량 충분한ㄷ...', cam: false },
        { who: 'park_changwon', text: '자 그럼 가시죠!', cam: false },
        { who: 'colonel_mask', text: '그래. 이왕 온김에 김민철이 계산하자', cam: false },
        { who: 'kim_mincheol', text: '아니 제가 왜 계산하는겁니까?', cam: false },
        { who: 'park_changwon', text: '야 네가 가장 엘리트였잖아. 그러니까 계산하는 거지.', cam: false },
        { who: 'kim_mincheol', text: '그런 법이 어딨습니까?', cam: false },
        { who: 'park_changwon', text: '원래 잘한 사람이 자기보다 못한 사람한테 사주는 법이야~', cam: false },
        { who: 'kim_mincheol', text: '.....', cam: false },
        { who: 'park_changwon', text: '그럼 갑시다!', cam: false },
      ] },
      { type: 'propMove', id: 'van', to: [-5.5, 0, -5.2], duration: 7 },

      // ── 4인 다 승합차에서 내려서 한빛마트 24시에 들어간다 ──
      { type: 'camera', from: [3.5, 1.8, -9.2], lookAt: [-6, 1.3, -8.2], duration: 0 },
      { type: 'actor', who: 'colonel_mask', pos: [-4.0, -7.6], rot: 180 },
      { type: 'actor', who: 'park_changwon', pos: [-5.6, -7.7], rot: 180 },
      { type: 'actor', who: 'lee_jayong', pos: [-7.2, -7.5], rot: 180 },
      { type: 'player', visible: true, pos: [-4.8, -6.8], rot: 180 },
      { type: 'wait', seconds: 0.8 },
      { type: 'move', id: 'colonel_mask', to: [-5.2, -10.2] },
      { type: 'move', id: 'park_changwon', to: [-6.0, -10.2] },
      { type: 'move', id: 'lee_jayong', to: [-6.8, -10.2], wait: true },
      { type: 'fade', out: true, duration: 0.8 },

      // ── 편의점 안 ──
      { type: 'prop', id: 'tv', model: 'tv', pos: [-1.65, 2.25, -15.4], rot: -90,
        text: ['리충성, 김준호 국무위원장 총살', '오늘 오전 3시경 · 대한민국 공격 우려'] },
      { type: 'actor', who: 'colonel_mask', pos: [-6.4, -16.2], rot: 0 },
      { type: 'actor', who: 'park_changwon', pos: [-6.4, -13.9], rot: 180 },
      { type: 'actor', who: 'lee_jayong', pos: [-3.3, -16.9], rot: -45 },
      { type: 'player', pos: [-3.6, -14.3], rot: -30 },
      { type: 'camera', from: [-2.6, 1.9, -12.2], lookAt: [-6, 1.3, -16], duration: 0 },
      { type: 'fade', out: false, duration: 0.8 },
      { type: 'dialogue', lines: [
        { who: 'colonel_mask', text: '자 이제 마음껏 사라! 어차피 돈은 김민철이 내는 거니까!', anim: 'Salute' },
        { who: 'lee_jayong', text: '잘 먹겠습니다 하사님!' },
        { who: 'park_changwon', text: '야 고맙다 잘 먹을게 ㅋㅋ' },
        { who: 'colonel_mask', text: '난 그냥 라면이나 사야겠다.' },
      ] },

      // ── 김민철이 스마트폰으로 계산을 한다 → 편의점 TV 뉴스 ──
      { type: 'player', rot: 0 },
      { type: 'camera', from: [-2.4, 1.6, -15.6], lookAt: [-3.6, 1.2, -13.4], duration: 0 },
      { type: 'dialogue', lines: [ { text: '김민철이 스마트폰으로 계산을 한다' } ] },
      { type: 'player', rot: 90 },
      { type: 'camera', from: [-4.6, 1.75, -14.4], to: [-3.5, 1.95, -15.0], lookAt: [-1.6, 2.2, -15.4], duration: 3 },
      { type: 'dialogue', lines: [
        { name: '뉴스 앵커', text: '속보입니다. 오늘 오전 3시경, 리충성이라는 인민군이 김준호 국무위원장을 총살했습니다. 이것으로 인해 대한민국 공격이 우려되며...', radio: true },
      ] },
      { type: 'actor', who: 'park_changwon', pos: [-5.4, -12.2], rot: 160 },
      { type: 'dialogue', lines: [
        { who: 'park_changwon', text: '야 뭐해? 빨리 와.' },
        { who: 'kim_mincheol', text: '옙!' },
      ] },

      // ── 다 같이 편의점을 나간다 → 미사일 ──
      { type: 'fade', out: true, duration: 0.8 },
      { type: 'actor', who: 'colonel_mask', pos: [-4.6, -8.6], rot: 30 },
      { type: 'actor', who: 'park_changwon', pos: [-7.4, -8.4], rot: 20 },
      { type: 'actor', who: 'lee_jayong', pos: [-3.4, -7.0], rot: 40 },
      { type: 'player', pos: [-6.1, -8.9], rot: 15 },
      { type: 'camera', from: [5.5, 2.3, -1.2], lookAt: [-5, 1.1, -7.5], duration: 0 },
      { type: 'move', id: 'lee_jayong', to: [-2.6, -6.6] },
      { type: 'fade', out: false, duration: 0.8 },
      { type: 'wait', seconds: 1.6 },
      { type: 'missile', from: [45, 80, 25], to: [-3.6, 0.6, -5.1], duration: 1.6, size: 1.2, burn: 'van' },
      { type: 'kill', id: ['lee_jayong', 'player'] },
      { type: 'wait', seconds: 1.1 },
      { type: 'blackout', seconds: 3, wake: false },
      { type: 'map', id: 'seoul_ruins' },          // 미사일 후 거리가 폐허로

      // ── 김민철이 기절했다가 일어난다 ──
      { type: 'actor', who: 'park_changwon', pos: [-3.4, -8.0], rot: 30 },
      { type: 'actor', who: 'colonel_mask', pos: [-7.6, -7.6], rot: 60 },
      { type: 'player', visible: false, up: true, rot: 60 },
      { type: 'wake' },
      { type: 'camera', from: [-6.2, 0.3, -9.0], to: [-6.1, 1.5, -9.1], lookAt: [-3.2, 0.6, -7.0], lookAtTo: [-3.3, 1.3, -7.6], duration: 3.5 },
      { type: 'player', visible: true },
      { type: 'dialogue', lines: [
        { who: 'park_changwon', text: '야 이자용!! 이자용!!!', face: 'lee_jayong' },
        { who: 'colonel_mask', text: '이런 젠장 뒤졌어!' },
        { who: 'park_changwon', text: '그 망할놈들!! 복수할거다!!' },
        { who: 'colonel_mask', text: '일단 피해!!', anim: 'Salute' },
      ] },

      // ── 북한군 20명이 헬기에서 낙하산으로 뛰어내린다 ──
      { type: 'prop', id: 'heli_nk', model: 'helicopter', pos: [95, 30, 0.5], rot: 180, rotor: true },
      { type: 'propMove', id: 'heli_nk', to: [-95, 30, 0.5], duration: 19, wait: false },
      { type: 'spawn', enemies: [
        { who: 'nk_soldier', count: 20, area: [6, -7.5, 29, 6.5], rot: -90, para: { follow: 'heli_nk' } },
      ] },
      { type: 'camera', from: [-15, 1.7, 2.5], to: [-13, 2.2, 1], lookAt: [12, 24, 0], lookAtTo: [12, 3, 0], duration: 17 },
      { type: 'waitLanding' },
      { type: 'dialogue', lines: [
        { who: 'park_changwon', text: '잠만 저거 북한 군사잖아?' },
        { who: 'kim_mincheol', text: '이런 젠장.' },
        { who: 'colonel_mask', text: '겁먹지마! 우린 이미 미국에서 소련 중국 연합놈들을 쓸어버렸잖아!!' },
        { who: 'kim_mincheol', text: '그땐 7명이였고요!! 지금은 20명이잖아요!!' },
        { who: 'park_changwon', text: '아 모르겠고 김민철 그냥 싸워!!' },
        { who: 'kim_mincheol', text: '이걸 어떻게 이겨요?' },
        { who: 'kim_mincheol', text: '20 대 3인데!' },
        { who: 'colonel_mask', text: '어떻게든 되겠지!! 돌격하라!!', anim: 'Salute' },
        { who: 'kim_mincheol', text: '아니 무ㅅ..' },
        { who: 'park_changwon', text: '닥치고 그냥 돌격해!!' },
        { who: 'kim_mincheol', text: '옙!!' },
      ] },

      // ── 전투가 시작된다 ──
      { type: 'player', rot: 90 },
      { type: 'ally', who: 'park_changwon', follow: true },
      { type: 'ally', who: 'colonel_mask', follow: true },
      { type: 'checkpoint' },
      { type: 'eliminate', text: '북한군을 물리쳐라' },
      { type: 'end' },
    ],
  },

  // ───────────────── 스토리 2 - 북한 마을 : 잠시 과거로 ─────────────────
  //  집 안은 땅 밑(y: -60)에 따로 만든 방입니다. 집 A = 고혁명이 가리킨 집, 집 B = 고혁명이 맡은 집
  {
    title: '스토리 2',
    name: '북한 마을 : 잠시 과거로',
    map: 'nk_village',
    player: 'dongmu',
    noFire: true,                 // 이 챕터는 사격 없음
    start: { pos: [-6, 1.5], rot: 90 },
    steps: [
      { type: 'fade', out: true, duration: 0 },
      { type: 'prop', id: 'roomA', model: 'room', pos: [-14.6, -60, -12], rot: 0 },
      { type: 'prop', id: 'roomB', model: 'room', pos: [-25.6, -60, -12], rot: 0 },
      { type: 'title', text: '스토리 2 - 북한 마을 : 잠시 과거로', sub: '-조선민주주의인민공화국편-', duration: 5, wait: true },
      { type: 'dialogue', lines: [
        { text: '전쟁이 시작하기 5일 전' },
        { text: '리충성이 국무위원장이 되자마자, 그의 누나 리옥선은 한국과 내통하거나 스파이이거나 무고한데 의심받는 시민들을 처형한다.' },
        { text: '당신은 여기서 북한 군인이다.' },
      ] },

      // ── 마을 ──
      { type: 'actor', who: 'ri_oksun', pos: [-1.5, 1.0], rot: -90 },
      { type: 'actor', who: 'ko_hyeokmyeong_NK', pos: [-4.2, 3.6], rot: 150 },
      { type: 'actor', who: 'nk_civilian_man', id: 'v1', pos: [7.5, -1.5], rot: -90 },
      { type: 'actor', who: 'nk_civilian_woman', id: 'v2', pos: [8.2, 0.2], rot: -100 },
      { type: 'actor', who: 'nk_civilian_man', id: 'v3', pos: [7.8, 2.0], rot: -80 },
      { type: 'actor', who: 'nk_civilian_woman', id: 'v4', pos: [9.6, -0.8], rot: -90 },
      { type: 'actor', who: 'nk_civilian_man', id: 'v5', pos: [9.8, 1.2], rot: -95 },
      { type: 'actor', who: 'nk_civilian_woman', id: 'v6', pos: [11.2, 0.3], rot: -90 },
      { type: 'actor', who: 'nk_soldier', id: 'g1', pos: [5.0, -3.2], rot: 60, anim: 'Aim' },
      { type: 'actor', who: 'nk_soldier', id: 'g2', pos: [5.2, 3.8], rot: 120, anim: 'Aim' },
      { type: 'actor', who: 'nk_civilian_woman', id: 'v7', pos: [-3.6, 8.6], rot: 180 },
      { type: 'actor', who: 'nk_soldier', id: 'g3', pos: [-3.0, 9.6], rot: 160 },
      { type: 'camera', from: [-16, 5, 9], to: [-11, 3.2, 6], lookAt: [3, 1.2, 0], duration: 0.01, wait: false },
      { type: 'fade', out: false, duration: 2 },
      { type: 'move', id: 'v7', to: [6.6, 4.0] },
      { type: 'move', id: 'g3', to: [5.4, 5.6] },
      { type: 'camera', from: [-16, 5, 9], to: [-11, 3.2, 6], lookAt: [3, 1.2, 0], lookAtTo: [-1, 1.4, 1.5], duration: 6 },
      { type: 'dialogue', lines: [
        { who: 'ri_oksun', text: '고혁명 동무, 이 마을의 모든 주민들을 끌어내라우.', anim: 'Command', face: 'ko_hyeokmyeong_NK' },
        { who: 'ko_hyeokmyeong_NK', text: '예 알겠습니다 리옥선 동지.', anim: 'Salute', face: 'ri_oksun' },
        { who: 'ko_hyeokmyeong_NK', text: '동무. 저 집에 있는 사람 끌어내라우. 난 이집을 맡겠소.', anim: 'Command', face: [-14.6, -9.3] },
        { who: 'dongmu', text: '예!' },
      ] },
      { type: 'move', id: 'ko_hyeokmyeong_NK', to: [-25.6, -8.4], face: 90 },

      // ── 집 A: 문을 부수고 들어간다 ──
      { type: 'goto', pos: [-14.6, -8.9], radius: 1.6, text: '고혁명이 가리킨 집으로 가라' },
      { type: 'sound', name: 'kick', shake: 0.6 },
      { type: 'wait', seconds: 0.35 },
      { type: 'sound', name: 'kick', shake: 1.0 },
      { type: 'fade', out: true, duration: 0.5 },
      { type: 'player', pos: [-14.6, -10.6], y: -60, rot: 180 },
      { type: 'fade', out: false, duration: 0.6 },
      { type: 'goto', pos: [-16.4, -12.6], radius: 1.3, text: '집을 수색하라' },
      { type: 'goto', pos: [-12.9, -12.3], radius: 1.3, text: '집을 수색하라' },
      { type: 'dialogue', lines: [ { who: 'dongmu', text: '이 집은 빈 것 같습네다.' } ] },

      // ── 집 B: 고혁명과 함께 ──
      { type: 'fade', out: true, duration: 0.6 },
      { type: 'player', pos: [-14.6, -7.6], rot: -90 },
      { type: 'actor', who: 'ko_hyeokmyeong_NK', pos: [-24.6, -7.8], rot: 90 },
      { type: 'fade', out: false, duration: 0.6 },
      { type: 'dialogue', lines: [ { who: 'ko_hyeokmyeong_NK', text: '그럼 나와 함께 이 집을 수색하라우.', anim: 'Command' } ] },
      { type: 'goto', pos: [-25.6, -8.9], radius: 1.6, text: '고혁명과 함께 집을 수색하라' },
      { type: 'fade', out: true, duration: 0.5 },
      { type: 'actor', who: 'ko_hyeokmyeong_NK', pos: [-24.2, -10.8], y: -60, rot: 200 },
      { type: 'actor', who: 'nk_civilian_man', id: 'target', pos: [-28.5, -13.1], y: -60, rot: 60 },
      { type: 'player', pos: [-25.6, -10.6], y: -60, rot: 180 },
      { type: 'fade', out: false, duration: 0.6 },
      { type: 'goto', pos: [-27.4, -12.4], radius: 1.4, text: '집을 수색하라' },
      { type: 'dialogue', lines: [ { who: 'dongmu', text: '여기 사람 한명있습네다!' } ] },

      // ── 그리고 결국 그 한명을 동무가 직접 처형하게 된다 ──
      { type: 'fade', out: true, duration: 0.8 },
      { type: 'actor', who: 'nk_civilian_man', id: 'target', pos: [-25.6, -5.6], y: null, rot: 0 },
      { type: 'actor', who: 'ri_oksun', pos: [-22.0, -2.6], rot: -115 },
      { type: 'actor', who: 'ko_hyeokmyeong_NK', pos: [-29.2, -2.6], rot: 115 },
      { type: 'actor', who: 'nk_soldier', id: 'g1', pos: [-22.8, 1.2], rot: -150, anim: 'Aim' },
      { type: 'actor', who: 'nk_soldier', id: 'g2', pos: [-28.4, 1.2], rot: 150, anim: 'Aim' },
      { type: 'player', pos: [-25.6, -1.6], rot: 180 },
      { type: 'camera', from: [-19.5, 2.4, 2.5], lookAt: [-25.6, 1.2, -3.6], duration: 0 },
      { type: 'fade', out: false, duration: 1 },
      { type: 'dialogue', lines: [
        { text: '그리고 결국 그 한명을 동무가 직접 처형하게 된다' },
        { who: 'dongmu', text: '못하겠소.' },
        { who: 'ri_oksun', text: '그럼 배반자와 함께 죽으시오.', anim: 'Command' },
      ] },
      { type: 'shoot', from: 'g1', at: 'player', shots: 2, wait: false },
      { type: 'shoot', from: 'g2', at: 'target', shots: 2 },
      { type: 'wait', seconds: 2.5 },
      { type: 'fade', out: true, duration: 2.5 },
      { type: 'end' },
    ],
  },

  // ───────────── 스토리 3 - 북한 주석궁 : 다시 현재 북한으로 ─────────────
  //  맵: 금수산 태양궁전 내부. 대회의실(x 12~23, z -55~-45) → 중앙홀 → 남쪽 상황실 → 집무실(x 24~35, z -55~-45)
  {
    title: '스토리 3',
    name: '북한 주석궁 : 다시 현재 북한으로',
    map: 'kumsusan',
    player: 'ri_chungsong',
    playerNoWeapon: true,
    weapons: ['knife', 'throwknife'],
    start: { pos: [22.7, -49.75], rot: -90 },
    steps: [
      { type: 'fade', out: true, duration: 0 },
      { type: 'title', text: '스토리 3 - 북한 주석궁 : 다시 현재 북한으로', sub: '-조선민주주의인민공화국편-', duration: 5, wait: true },
      { type: 'dialogue', lines: [
        { text: '리충성은 자신의 누나가 남한을 침략하는 것이 내키지 않는다.' },
        { text: '그래서 리충성은 대회의를 시작한다' },
      ] },

      // ── 대회의 ──
      { type: 'actor', who: 'official1', pos: [15.5, -52.3], rot: 0 },
      { type: 'actor', who: 'official2', pos: [19.5, -52.3], rot: 0 },
      { type: 'actor', who: 'official3', pos: [17.5, -46.8], rot: 180 },
      { type: 'camera', from: [13.0, 2.6, -46.2], lookAt: [19.5, 1.2, -50], duration: 0 },
      { type: 'fade', out: false, duration: 1.5 },
      { type: 'dialogue', lines: [
        { who: 'ri_chungsong', text: '동무들, 폭력을 쓰고 싶소 비폭력적으로 해결하고 싶소?' },
        { who: 'official2', name: '고위간부들', text: '당연히 비폭력적아닙네까?' },
        { who: 'ri_chungsong', text: '그러면 지금 조선이 남조선을 침략하는 것에 어떻게 생각하오?' },
        { who: 'official1', text: '전쟁을 멈추고 서로 평화적으로 해결해야합네다.' },
        { who: 'official2', text: '맞는 말이오.' },
        { who: 'official3', text: '그러려면 리옥선 동지를 막아야 하는데...' },
        { who: 'ri_chungsong', text: '그럼 이만 회의를 마치겠소.' },
      ] },

      // ── 리충성이 나간다 ──
      { type: 'goto', pos: [9.0, -49.6], radius: 1.6, text: '회의실에서 나가라' },

      // ── 리옥선의 부하들이 들이닥친다 → 고위간부 전원 사망 ──
      { type: 'actor', who: 'nk_soldier', id: 'k1', pos: [26.5, -49.0], rot: -90, anim: 'Aim' },
      { type: 'actor', who: 'nk_soldier', id: 'k2', pos: [26.5, -50.6], rot: -90, anim: 'Aim' },
      { type: 'actor', who: 'nk_soldier', id: 'k3', pos: [27.6, -49.8], rot: -90, anim: 'Aim' },
      { type: 'camera', from: [12.6, 2.1, -47.0], lookAt: [21.5, 1.3, -50], duration: 0 },
      { type: 'move', id: 'k1', to: [22.3, -48.6], run: true },
      { type: 'move', id: 'k2', to: [22.3, -51.0], run: true },
      { type: 'move', id: 'k3', to: [21.8, -49.8], run: true, wait: true },
      { type: 'shoot', from: 'k1', at: 'official1', shots: 3, wait: false },
      { type: 'shoot', from: 'k2', at: 'official2', shots: 3, wait: false },
      { type: 'shoot', from: 'k3', at: 'official3', shots: 3 },
      { type: 'wait', seconds: 1.2 },

      // ── 회의실에서 나간 리충성도 위험에 처한다 → 고혁명이 외친다 ──
      { type: 'remove', id: 'k1' }, { type: 'remove', id: 'k2' }, { type: 'remove', id: 'k3' },
      { type: 'spawn', enemies: [
        { who: 'nk_soldier', pos: [-6, -52], rot: 90, alert: true, group: 'w1' },
        { who: 'nk_soldier', pos: [-9, -46], rot: 90, alert: true, group: 'w1' },
        { who: 'nk_soldier', pos: [-8, -40], rot: 90, alert: true, group: 'w1' },
        { who: 'nk_soldier', pos: [-4, -35], rot: 90, alert: true, group: 'w1' },
        { who: 'nk_soldier', pos: [-1, -29.5], rot: 180, alert: true, group: 'w1' },
        { who: 'nk_soldier', pos: [-11, -33.5], rot: 60, alert: true, group: 'w1' },
      ] },
      { type: 'actor', who: 'ko_hyeokmyeong_NK', id: 'go', pos: [6.5, -41.5], rot: 160, gun: 'pistol' },
      { type: 'camera', from: [3.2, 2.2, -36.6], lookAt: [7.5, 1.5, -45.5], duration: 0 },
      { type: 'dialogue', lines: [
        { who: 'ko_hyeokmyeong_NK', text: '리충성 동지! 빨리 이쪽으로 오십시오!', anim: 'Wave' },
        { who: 'ri_chungsong', text: '알갔소!' },
      ] },
      { type: 'checkpoint' },
      { type: 'goto', pos: [6.5, -42.8], radius: 2.0, text: '고혁명에게 달려가라' },
      { type: 'ally', who: 'ko_hyeokmyeong_NK', id: 'go', follow: false, accuracy: 1.5, dmg: 55 },
      { type: 'dialogue', lines: [
        { who: 'ko_hyeokmyeong_NK', text: '저를 따라오십시오.' },
        { who: 'ri_chungsong', text: '알갔소.' },
      ] },

      // ── 고혁명이 적을 처리하고, 리충성은 못 잡은 적을 단검으로 ──
      { type: 'eliminate', text: '고혁명이 못 잡은 적을 처리하라', group: 'w1' },
      { type: 'dialogue', lines: [
        { who: 'ko_hyeokmyeong_NK', text: '집무실까지 경호해드리겠습네다.' },
        { who: 'ri_chungsong', text: '고맙소.' },
      ] },
      { type: 'checkpoint' },
      { type: 'move', id: 'go', to: [12.6, -37.6], run: true },
      { type: 'spawn', enemies: [
        { who: 'nk_soldier', pos: [21.5, -35.2], rot: -90, group: 'w2' },
        { who: 'nk_soldier', pos: [14.4, -40.3], rot: 0, group: 'w2' },
        { who: 'nk_soldier', pos: [29.5, -37.5], rot: -90, group: 'w2' },
        { who: 'nk_soldier', pos: [33.5, -37.6], rot: -90, group: 'w2' },
        { who: 'nk_soldier', pos: [29.6, -41.6], rot: -120, group: 'w2' },
      ] },
      { type: 'goto', pos: [10.5, -37.6], radius: 2.0, text: '고혁명을 따라가라' },
      { type: 'move', id: 'go', to: [17.0, -37.6], run: true },
      { type: 'eliminate', text: '고혁명이 못 잡은 적을 처리하라', group: 'w2' },

      // ── 집무실 도착, 고혁명은 남은 적을 처리하러 간다 ──
      { type: 'move', id: 'go', to: [26.5, -37.6], run: true },
      { type: 'goto', pos: [29.75, -42.6], radius: 1.4, text: '집무실로 가라' },
      { type: 'move', id: 'go', to: [12.6, -37.6], run: true },
      { type: 'fade', out: true, duration: 0.8 },
      { type: 'remove', id: 'go' },

      // ── 양쪽 팔이 잡히고 리옥선 앞에 무릎 꿇린다 ──
      { type: 'actor', who: 'ri_oksun', pos: [31.2, -49.75], rot: -90 },
      { type: 'actor', who: 'nk_soldier', id: 'h1', pos: [27.6, -48.9], rot: 90, anim: 'Stand' },
      { type: 'actor', who: 'nk_soldier', id: 'h2', pos: [27.6, -50.6], rot: 90, anim: 'Stand' },
      { type: 'actor', who: 'nk_soldier', id: 'h3', pos: [30.3, -47.4], rot: -130, anim: 'Aim' },
      { type: 'player', pos: [28.1, -49.75], rot: 90 },
      { type: 'pose', id: 'player', pose: 'kneel' },
      { type: 'camera', from: [31.9, 1.75, -48.3], lookAt: [28.1, 0.95, -49.75], duration: 0 },
      { type: 'fade', out: false, duration: 1 },
      { type: 'dialogue', lines: [
        { who: 'ri_chungsong', text: '누이! 이게 무슨 정신나간 짓이오!', cam: false },
        { who: 'ri_oksun', text: '조선은 강한 독재자가 필요하오.' },
        { who: 'ri_chungsong', text: '틀렸소! 우린 공화국이 락원이 되길 바래서 반역을 한거잖소?', cam: false },
        { who: 'ri_oksun', text: '이게 바로 락원으로 가는 길이오. 리.충.성.' },
      ] },

      // ── 리충성이 총을 맞고 사망한다 ──
      { type: 'camera', from: [26.0, 2.0, -53.8], lookAt: [28.6, 0.8, -49.5], duration: 0 },
      { type: 'shoot', from: 'h3', at: 'player', shots: 2 },
      { type: 'wait', seconds: 2.5 },
      { type: 'fade', out: true, duration: 2.5 },
      { type: 'end' },
    ],
  },
];
