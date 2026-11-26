# 브라우저판 (itch.io 에서 바로 플레이 · iPhone 포함)

iPhone 은 itch.io 에서 앱을 설치할 수 없습니다. 그래서 **같은 itch.io 게임 페이지(whgkwns.itch.io/second-korean-wars)** 에
"브라우저에서 플레이" 판을 하나 더 올립니다. 게임 내용은 PC판 · Android 앱과 똑같은 스토리 게임(스토리 1~4, 한국어/English)이고,
iPhone · iPad 의 Safari, Android 의 Chrome, PC 의 Chrome · Edge · Safari 에서 설치 없이 바로 실행됩니다.
지금 있는 PC 다운로드 파일과 Android APK 는 그대로 두고 함께 제공합니다.

- 휴대폰 · 태블릿: 화면 터치 조작 (왼쪽을 밀어 이동 · 오른쪽을 밀어 둘러보기 · 오른쪽 버튼으로 사격 · 조준 · 줍기). 왼쪽 위 ‖ 버튼 = 일시정지
- PC 브라우저: PC판과 같은 마우스 + 키보드 조작 (화면을 클릭하면 마우스 고정, Esc = 일시정지 메뉴)
- 휴대폰을 세로로 들면 "휴대폰을 가로로 돌려 주세요" 화면이 나오고 게임이 멈춥니다. 가로로 돌리면 그 자리에서 이어집니다.
- 일시정지 메뉴 · 설정(그래픽 · 소리 · 자막 크기 · 언어 등)은 PC판과 같습니다. 브라우저에는 "게임 종료"가 없고, 전체 화면 설정은 되는 기기(PC · 일부 Android)에서만 보입니다.

## 만들기와 올리기

GitHub 의 **Actions 탭 → "Web build (itch.io HTML5)" → Run workflow** 를 누르면 됩니다.

1. 스토리 게임을 빌드해 `index.html` 한 파일과 그것을 담은 zip 을 만듭니다 (Actions 실행 결과의 `second-korean-wars-web` 에서 내려받을 수 있음).
2. 저장소 시크릿 `BUTLER_API_KEY` 가 있으면(PC판 · Android 판과 같은 키) itch.io 의 **`html5` 채널**에 자동으로 올립니다.
   버전 번호는 `desktop/package.json` 의 version 을 씁니다.

직접 만들려면 (개발자용): `cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 후 저장소 맨 위에서 `node web/scripts/build-web.js`
→ `web/dist/index.html` 과 `web/dist/second-korean-wars-web.zip` (zip 은 itch.io 에 손으로 올릴 때 씀).

## itch.io 대시보드에서 한 번만 해야 하는 일 (중요)

자동 업로드는 파일만 올립니다. **"브라우저에서 플레이"로 보이게 하는 설정은 처음 한 번 직접 해야 합니다.**

> 주의: 이 안내를 쓸 때 itch.io 에 접속할 수 없어서, 아래 메뉴 이름(영어)이 지금 화면과 조금 다를 수 있습니다.
> 비슷한 이름의 항목을 찾아 주세요.

1. itch.io 로그인 → 오른쪽 위 이름 옆 ▾ → **Dashboard** → "Second Korean Wars" 의 **Edit game**.
2. **Kind of project** 를 **HTML** 로 바꿉니다.
   (HTML 로 바꿔도 PC · Android 다운로드 파일은 그대로 다운로드 목록에 남습니다.)
3. **Uploads** 목록에서 이름에 `html5` 가 들어간 파일(자동 업로드가 만든 것)을 찾아
   **"This file will be played in the browser"** 에 체크합니다.
   - 다른 파일(Windows · macOS · Linux · Android)은 이 체크를 하지 **않습니다** (그대로 다운로드용).
4. 바로 아래 **Embed options** (또는 "Frame options"):
   - **Embed in page** → 크기 **Viewport dimensions: 1280 × 720**
   - **Click to launch in fullscreen** 체크 (휴대폰에서 화면 전체로 실행됨)
   - **Mobile friendly** 체크 → **Orientation: Landscape** (가로)
   - **Fullscreen button** 체크 (PC · iPad 에서 전체 화면 버튼)
   - "Automatically start on page load" 는 끄는 것을 권장 (게임이 무거워 페이지가 느려짐)
5. 맨 아래 **Save**. 게임 페이지를 열어 "Run game" 버튼이 보이는지, 다운로드 버튼도 여전히 있는지 확인합니다.
6. (휴대폰 확인) iPhone 의 Safari 로 게임 페이지를 열어 실행 → 처음 화면 → 시작.

## 필요한 것 (플레이어에게 안내할 내용)

| 기기 | 필요 조건 |
|---|---|
| iPhone · iPad | **iOS / iPadOS 26 이상**의 Safari (iPhone 의 Chrome 등 다른 브라우저도 Safari 엔진이라 조건이 같음) |
| Android | **Android 12 이상** + 최신 Chrome |
| PC | 최신 Chrome · Edge, 또는 Safari 26 이상 (macOS) |

WebGPU 를 쓰는 게임이라 위보다 오래된 기기 · 브라우저에서는 실행되지 않고, 그 경우 게임이 무엇이 필요한지 화면에 안내합니다.

## 알아 둘 한계

- **iPhone 에는 앱 설치가 없습니다.** itch.io 에서는 브라우저판만 됩니다 (App Store 판이 아님).
- **화면 방향을 고정할 수 없습니다** (웹 페이지는 iPhone 에서 가로 고정이 안 됨). 세로로 들면 "가로로 돌려 주세요" 화면이 나옵니다.
  화면이 돌아가지 않으면 제어 센터의 "세로 화면 방향 고정"을 꺼야 합니다.
- **진행 기록 · 설정이 지워질 수 있습니다.** Safari 는 itch.io 안에서 실행되는 게임의 저장 공간을 따로 관리하고, 한동안 들어오지 않으면 지울 수 있습니다.
  (모든 스토리는 처음 화면에서 언제든 고를 수 있으므로 진행이 지워져도 다시 플레이할 수 있습니다.)
- **저전력 모드에서는 느려집니다** (iPhone 이 화면을 초당 30번으로 제한). 게임이 스스로 해상도 · 그래픽을 맞춥니다.
- iPhone 에는 Safari 의 전체 화면 기능이 없어서 설정에 "전체 화면" 줄이 보이지 않습니다 (itch.io 의 "Click to launch in fullscreen" 이 대신함).
- 소리는 첫 터치 뒤에 나옵니다 (Safari 규칙). 무음 스위치를 켜 둬도 게임 소리는 납니다.
- 우리 팀은 iPhone 이 없어 실제 iPhone 으로는 확인하지 못했습니다. PC 의 Chrome 에서 iPhone 화면 · 터치를 흉내 내어 확인했습니다.
  처음 올린 뒤 iPhone 사용자의 오류 화면 캡처(게임이 오류 내용을 화면에 보여 줌)를 받으면 고치기 쉽습니다.
