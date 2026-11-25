'use strict';
/* 영어 사전 (해상대전) — G.i18n.add({한국어:'English'})
   해상 반격 임무(mod_game.js): 처음 화면 · HUD 패널 · 캔버스 꼬리표(G.tr) · 승조원 대사 · 도움말 · 결과 화면.
   사전은 naval 모드에서만 넣는다 (스토리 게임의 사전·패턴과 섞이지 않게). */
{
  if (G.i18n && G.mode === 'naval') {
    // 표적 이름: N = 패널·대사용 / C = 캔버스 꼬리표용(짧게)
    const N = { '대함미사일': 'Anti-ship missile', '대공미사일': 'SAM', '전투기': 'Fighter', '고속정': 'Missile boat', '호위함': 'Frigate', '해안포대': 'Coastal battery', '본함': 'Own ship' };
    const C = Object.assign({}, N, { '대함미사일': 'Missile' });
    const cap = s => s[0].toUpperCase() + s.slice(1);
    G.i18n.add(N);
    G.i18n.add({
      /* ── 처음 화면 ── */
      '훈련 교전 · 동해 차단선': 'Training Engagement · East Sea Interdiction Line',
      '날아오는 대함미사일을 요격하고 적 함대와 해안포대를 격파하라.': 'Intercept incoming anti-ship missiles, then destroy the enemy fleet and coastal battery.',
      '출 격': 'DEPLOY', '다시 출격': 'Redeploy',
      '그래픽 설정': 'Graphics settings',
      /* ── 조작 안내 (처음 화면 · H 도움말) ── */
      '기동': 'Maneuver', '교전': 'Combat',
      '추력': 'Throttle', '조타': 'Rudder', '드래그': 'Drag', '시점': 'Camera', '휠': 'Wheel', '줌': 'Zoom',
      '일시정지': 'Pause', '도움말': 'Help', '음소거': 'Mute',
      '다음 표적': 'Next target', '최우선 위협 선택': 'Select priority threat',
      '미사일 — 공중 SAM · 수상 SSM': 'Missile — SAM vs air · SSM vs surface',
      '함포 — 수상·지상 표적': 'Gun — surface & land targets',
      /* ── 임무 패널 ── */
      '임무': 'Mission', '격파': 'Kills', '· 잔여 위협': '· Threats',
      '전투 배치 — 대기': 'Battle stations — stand by',
      '대함미사일을 요격하라 — Tab 표적 선택 · Space 발사': 'Intercept the anti-ship missiles — Tab select target · Space fire',
      '적 전투기를 격추하라': 'Shoot down the enemy fighters',
      '적 고속정·호위함을 격침하라 — Space 대함미사일 · F 함포': 'Sink the enemy missile boats and frigate — Space SSM · F gun',
      '섬의 해안포대를 제압하라': 'Neutralize the coastal battery on the island',
      /* ── 승조원 대사 ── */
      '전투정보실': 'CIC', '함장': 'Captain',
      '함장님, 북동쪽에서 대함미사일 3발 탐지. 본함으로 접근 중입니다.': 'Captain, three anti-ship missiles detected to the northeast. Inbound on us.',
      '전탄 요격. 이어서 적 전투기 편대가 접근합니다.': 'All missiles intercepted. Enemy fighter flight now inbound.',
      '이제 우리가 칠 차례다. 적 수상 전투단을 격침하라.': 'Now it’s our turn to strike. Sink the enemy surface group.',
      '섬의 해안 미사일 포대가 본함을 조준하고 있습니다.': 'The island’s coastal missile battery is targeting us.',
      '적기 격추.': 'Enemy aircraft down.', '적기 이탈.': 'Enemy aircraft withdrawing.',
      /* ── 함 상태 · 무장 카드 (카드 너비가 한국어 기준이라 짧게: 잔탄 단위 '발' 은 숫자만) ── */
      '선체': 'Hull', '속력': 'SPD', '침로': 'CRS', // 추력 = Throttle (조작 안내와 같은 글자)
      '대공 SAM': 'Anti-air SAM', '대함 SSM': 'Anti-ship SSM', '함포': 'Gun', '함포 ·': 'Gun ·', '1.5km 방어': '1.5km range',
      '발': '', '발사 가능': 'READY', '사거리 밖': 'Out of range', '공중 표적용': 'Air only', '수상 표적용': 'Surface only', '소진': 'Empty',
      /* ── 표적 카드 · 미사일 경보 ── */
      '표적': 'Target', '없음': 'None', '없음 ·': 'None ·',
      '· 충돌': '· impact', '· 방위': '· brg',
      '⚠ 대함미사일': '⚠ Inbound missiles:', '발 접근 ·': ' ·',
      '최우선으로 전환': 'Switch to priority',
      /* ── 캔버스 꼬리표 (mod_game.js 가 G.tr 로 감싼 글자) ── */
      '최우선 · 선택': 'PRIORITY · LOCKED', '최우선 [Q]': 'PRIORITY [Q]', '선택': 'LOCKED', '섬': 'ISL',
      /* ── 결과 화면 ── */
      '작전 해역 확보 — 임무 완료': 'Area Secured — Mission Complete',
      '함 침몰 — 작전 실패': 'Ship Sunk — Mission Failed',
    });
    G.i18n.re([
      // 처음 화면 부제: "해상 반격 — <시나리오 제목>" · 그래픽 안내: "수동: LOW" / "자동 감지: HIGH"
      [/^해상 반격 — (.+)$/, (m, t) => 'Naval Counterattack — ' + G.i18n.tr(t)],
      [/^수동: (\S+)$/, 'Manual: $1'], [/^자동 감지: (\S+)$/, 'Auto-detect: $1'],
      // 임무 패널 · 결과 화면
      [/^작전 진행 (\d+)%$/, 'Progress $1%'],
      [/^격파 (\d+)$/, 'Kills $1'], [/^선체 (\d+)%$/, 'Hull $1%'],
      // 승조원 대사: "<이름> 격침." / "<이름> 파괴."
      [/^(\S+) 격침\.$/, (m, n) => cap(N[n] || n) + ' sunk.'],
      [/^(\S+) 파괴\.$/, (m, n) => cap(N[n] || n) + ' destroyed.'],
      // 무장 카드: "장전 1.2초" · 충돌까지 "34초"
      [/^장전 ([\d.]+)초$/, 'Reload $1s'], [/^(\d+)초$/, '$1s'],
      // Space 가 하는 일 (경보 밑 줄 · 표적 카드, 뒤에 ' ·' 가 붙기도 함)
      [/^◎ 선택 표적 (요격|교전) 중 — (SAM|SSM) 비행 중( ·)?$/, (m, a, w, d) => '◎ ' + (a === '요격' ? 'Intercepting' : 'Engaging') + ' — ' + w + ' in flight' + (d || '')],
      [/^선택 표적에 (SAM|SSM) 발사( ·)?$/, 'Fire $1 at target$2'],
      // 캔버스 꼬리표: "[이름 ]5.2km[ 34초]" · 명중 표시 "명중 −12%" / "<이름> 격파"
      [/^(?:(\S+) )?([\d.]+km)(?: (\d+)초)?$/, (m, n, km, s) => (n ? (C[n] || n) + ' ' : '') + km + (s ? ' ' + s + 's' : '')],
      [/^명중 −(\d+)%$/, 'HIT −$1%'],
      [/^(\S+) 격파$/, (m, n) => (C[n] || n) + ' destroyed'],
    ]);

    /* 영어일 때만 (한국어 배치는 그대로): 상태·무장 카드 꼬리표의 자간을 없애 한국어와 같은 너비에 담는다 · 좁은 창(카드 5.6em)에서는 영어 꼬리표가 넘치므로 카드만 조금 넓힌다
       · 결과 화면 제목은 영어가 더 길어 한 줄에 들어가게 조금 작게 (그래도 넘치면 두 줄을 고르게) */
    G.css('html[lang=en] .w label,html[lang=en] #st .rw label{letter-spacing:0}@media(max-width:1100px){html[lang=en] .w{width:6.6em}}html[lang=en] #ov:not(.t) h1{font-size:3.2em;text-wrap:balance}');

    /* 한국어 | English 버튼: mod_i18n 이 #ov 에 한 번만 넣는데, 결과 화면이 #ov.innerHTML 을 새로 쓰면 사라진다 → 그때마다 다시 넣는다 (두 언어 모두) */
    const lng = ov => {
      if (ov.querySelector('.lng')) return;
      const b = document.createElement('div'); b.className = 'lng'; b.setAttribute('data-i18n-skip', '');
      b.innerHTML = '<span data-l=ko>한국어</span><span data-l=en>English</span>';
      for (const s of b.children) s.classList.toggle('on', s.dataset.l === G.i18n.lang);
      b.onclick = e => { e.stopPropagation(); const l = e.target.dataset && e.target.dataset.l; l && G.i18n.set(l); };
      ov.appendChild(b);
    };
    G.register('ennav', { init() {
      const go = () => { const ov = document.getElementById('ov'); if (!ov) return setTimeout(go, 80); lng(ov); new MutationObserver(() => lng(ov)).observe(ov, { childList: true }); };
      go();
    } }, 'naval');
  }
}
