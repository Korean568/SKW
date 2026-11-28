'use strict';
/* 영어 사전 (enui) — G.i18n.add({한국어:'English'})
   공용 화면: PC판 일시정지·설정 메뉴 · 게임 업데이트 표시(mod_desktop) · 성능 알약(mod_gpu) · 실행 불가 안내 화면(core.js G.fatal) */
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
      /* ── 터치 조작 (mod_touch: 휴대폰 · 안드로이드 앱) ── */
      '시점 감도': 'Look Sensitivity',
      '사격': 'FIRE', '조준': 'AIM', '장전': 'RELOAD', '앉기': 'CROUCH', '방탄': 'PLATE', '줍기': 'GRAB', '무기': 'WEAPON', '스코프': 'SCOPE', '사용': 'USE', '단검': 'STAB', '투척': 'THROW',
      '조작': 'Controls', '화면 왼쪽을 밀어 이동 · 오른쪽을 밀어 둘러보기': 'Drag the left side to move · drag the right side to look',
      '오른쪽 버튼으로 사격 · 조준 · 줍기': 'Buttons on the right: fire · aim · pick up',
      /* ── 브라우저판(itch.io) · 휴대폰을 세로로 들었을 때 (mod_touch) ── */
      '휴대폰을 가로로 돌려 주세요': 'Rotate your phone to landscape', '태블릿을 가로로 돌려 주세요': 'Rotate your tablet to landscape',
      '화면이 돌아가지 않으면 세로 화면 고정(자동 회전) 설정을 확인해 주세요': 'If the screen does not turn, check the rotation lock (auto-rotate) setting',
      '자막 크기': 'Subtitle Size', '작게': 'Small', '보통': 'Medium', '크게': 'Large',
      '언어': 'Language', '돌아가기': 'Back', '돌아가기 ·': 'Back ·',
      /* ── 게임 업데이트 (mod_desktop: 설정의 버전 줄 · 처음 화면 알림 — PC · Android · iPhone/iPad 앱) ── */
      '버전': 'Version', '업데이트 확인': 'Check for Updates', '지금 적용': 'Apply Now', '그래도 적용': 'Apply Anyway', '닫기': 'Close',
      '확인 중…': 'Checking…', '최신 버전입니다': 'You have the latest version',
      '확인 실패 — 인터넷 연결을 확인하세요': 'Check failed — please check your internet connection',
      '지금 적용하면 처음 화면으로 돌아갑니다': 'Applying now returns to the title screen',
      '그래도 안 바뀌면 itch.io 에서 새로 받아 주세요': 'If it still does not change, download it again from itch.io',
      /* ── 성능 알약 ── */
      '그래픽 설정 · F2 순환': 'Graphics settings · F2 to cycle', '그래픽 등급 · F2 순환': 'Graphics tier · F2 to cycle',
      '자동 감지': 'Auto-detect', // 알약의 '자동' 버튼 설명 (등급 이름 Very Low … Ultra 는 두 언어 모두 영어)
      '수동': 'Manual', '자동↓': 'Auto↓', '자동↑': 'Auto↑', '알 수 없는 GPU': 'Unknown GPU',
      /* ── 실행 불가 · 장치 끊김 안내 (core.js G.fatal) ── */
      'WebGPU 를 사용할 수 없습니다': 'WebGPU is not available',
      '사용 가능한 GPU 어댑터가 없습니다': 'No usable GPU adapter found',
      'GPU 장치 연결이 끊어졌습니다': 'Lost connection to the GPU device',
      '초기화 실패': 'Initialization failed',
      '이 게임은': 'This game requires',
      '로 동작합니다. 아래를 확인해 주세요.': 'to run. Please check the following:',
      'Chrome / Edge 113 이상': 'Chrome / Edge 113 or later',
      '최신 버전 (Windows · macOS · ChromeOS)': '— latest version (Windows · macOS · ChromeOS)',
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
      // 게임 업데이트: "새 버전 0.16 …" (번호는 0.xx 또는 내부 번호)
      [/^새 버전 (\S+) 받는 중…$/, 'Downloading version $1…'],
      [/^새 버전 (\S+) 준비됨$/, 'Version $1 is ready'],
      [/^새 버전 (\S+) 으로 업데이트했습니다$/, 'Updated to version $1'],
      [/^새 버전 (\S+) 은 앱을 새로 받아야 합니다$/, 'Version $1 needs a new app — get it from itch.io'],
      [/^새 버전 (\S+) 은 App Store 에서 앱을 업데이트해야 합니다$/, 'Version $1 needs an app update — please update the app from the App Store'],
      [/^새 버전 (\S+) 이 나왔습니다 — 앱을 껐다 켜 주세요$/, 'Version $1 is out — please restart the app'],
      [/^새 버전 (\S+) 이 나왔습니다 — 새 APK 를 받아 주세요$/, 'Version $1 is out — please download the new APK'],
      [/^새 버전 (\S+) 이 나왔습니다 — itch\.io 에서 새 앱을 받아 주세요$/, 'Version $1 is out — please download the new app from itch.io'],
      // 성능 알약 상세: "이름 판별 Medium High (13.5) · 벤치마크 Very Low (0.512ms)" (' · ' 조각마다 — 등급 이름에 빈칸이 있음)
      [/^이름 판별 (.+)$/, 'Name check $1'],
      [/^벤치마크 (.+)$/, 'Benchmark $1'],
      // 알약 상태 줄 "4/10 · 자동 · 1280×720 · MSAA4" 는 ' · ' 조각마다 ('자동' · '자동↓' · '자동↑' · '수동')
      [/^(.+) \(소프트웨어\)$/, '$1 (software)'],
    ]);
  }
}
