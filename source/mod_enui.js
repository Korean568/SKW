'use strict';
/* 영어 사전 (enui) — G.i18n.add({한국어:'English'})
   공용 화면: PC판 일시정지·설정 메뉴(mod_desktop) · 성능 알약(mod_gpu) · 실행 불가 안내 화면(core.js G.fatal) */
{
  if (G.i18n) {
    G.i18n.add({
      /* ── PC판: 일시정지 메뉴 ── */
      '일시 정지': 'PAUSED',
      '계속하기 ·': 'Resume ·', '선택 ·': 'Select ·', '확인': 'Confirm',
      '완료': 'Completed',
      /* ── PC판: 설정 ── */
      '그래픽': 'Graphics', '자동': 'Auto', '렌더 배율': 'Render Scale',
      '전체 화면': 'Fullscreen', '켜기': 'On', '끄기': 'Off',
      '소리 크기': 'Volume', '마우스 감도': 'Mouse Sensitivity',
      '자막 크기': 'Subtitle Size', '작게': 'Small', '보통': 'Medium', '크게': 'Large',
      '언어': 'Language', '돌아가기': 'Back', '돌아가기 ·': 'Back ·',
      /* ── 성능 알약 ── */
      '그래픽 설정 · F2 순환': 'Graphics settings · F2 to cycle',
      '수동': 'Manual', '자동↓': 'Auto↓', '알 수 없는 GPU': 'Unknown GPU',
      /* ── 실행 불가 · 장치 끊김 안내 (core.js G.fatal) ── */
      'WebGPU 를 사용할 수 없습니다': 'WebGPU is not available',
      '사용 가능한 GPU 어댑터가 없습니다': 'No usable GPU adapter found',
      'GPU 장치 연결이 끊어졌습니다': 'Lost connection to the GPU device',
      '초기화 실패': 'Initialization failed',
      '이 게임은': 'This game requires',
      '로 동작합니다. 아래를 확인해 주세요.': 'to run. Please check the following:',
      'Chrome / Edge 113 이상': 'Chrome / Edge 113 or later',
      '최신 버전 (Windows · macOS · ChromeOS)': '(latest version, on Windows · macOS · ChromeOS)',
      'Safari 26 이상, Firefox 141 이상(Windows), Android Chrome 121 이상': 'Safari 26+, Firefox 141+ (Windows), Android Chrome 121+',
      '브라우저 설정에서': 'Turn on',
      '하드웨어 가속': 'hardware acceleration',
      '(그래픽 가속) 켜기 → 브라우저 재시작': ' (graphics acceleration) in your browser settings, then restart the browser',
      '그래픽 드라이버 최신 업데이트, 주소창': 'Update your graphics driver, then type',
      '에서 WebGPU 상태 확인': 'in the address bar to check the WebGPU status',
      'Linux Chrome 은': 'On Linux, Chrome needs',
      '활성화 필요': 'enabled',
      '보안 연결(https 또는 localhost)': 'A secure connection (https or localhost)',
      '에서만 WebGPU 가 켜집니다.': ' is required for WebGPU.',
      '페이지를 새로고침(F5) 해 주세요.': 'Please reload the page (F5).',
    });
    G.i18n.re([
      // 설정: 렌더 배율 출력 "75 % (자동)"
      [/^(\d+) % \(자동\)$/, '$1 % (auto)'],
      // 성능 알약 상세: "이름 판별 LOW · 벤치마크 MEDIUM (0.512ms)" (' · ' 조각마다)
      [/^이름 판별 (\S+)$/, 'Name check $1'],
      [/^벤치마크 (\S+) \((.+)\)$/, 'Benchmark $1 ($2)'],
      [/^(.+) \(소프트웨어\)$/, '$1 (software)'],
    ]);
  }
}
