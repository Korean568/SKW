# 제 2차 한국전쟁 — iPhone · iPad 앱 · App Store 안내

스토리 게임(PC판 · Android 앱과 같은 게임)을 iPhone · iPad 앱으로 포장한 것입니다. 이 문서는 **개발자가 아닌 분**을 위해 썼습니다.

- 앱 이름: **Second Korean Wars** (기기 언어가 한국어면 홈 화면에 **제 2차 한국전쟁**)
- 번들 ID(앱의 고유 주소): `com.secondkoreanwars.game` — Android 패키지 이름과 같습니다. **App Store Connect 에 한 번 등록하면 바꿀 수 없습니다**
- iPhone · iPad 모두 · 가로 화면 전용 · 전체 화면 (상태 막대 숨김, 홈 표시줄 자동 숨김) · 게임 중 화면이 꺼지지 않음
- **iOS · iPadOS 26 이상** — 게임 화면을 그리는 기술(WebGPU)이 iOS 26 부터 들어 있습니다
- 인터넷은 **게임 자동 업데이트**에만 씁니다 (Android 와 같은 파일 · 같은 규칙, 아래 5번). 설치할 때나 실행 중에 묻는 권한이 없습니다

> **꼭 알아 두세요.**
> - 이 앱은 아직 **실제 iPhone 에서 시험해 보지 못했습니다.** 만드는 컴퓨터(Linux)에는 Mac · Xcode 가 없어서, GitHub 의 Mac 컴퓨터(Actions)에서 **빌드 · 자동 시험 · iPhone Simulator(가상 아이폰) 시험**까지만 했습니다 (아래 2번에 결과).
> - **Apple Developer Program(연 99달러)에 가입하기 전에는 iPhone 에 설치할 방법이 거의 없습니다.** Android 의 APK 처럼 파일을 받아 설치하는 방식이 iPhone 에는 없습니다. (Mac 이 있으면 무료 Apple ID 로 내 iPhone 에 7일짜리 시험 설치는 됩니다 — 3번)
> - 그동안 iPhone 에서는 **브라우저판**을 Safari 로 할 수 있습니다: https://korean568.github.io/SKW/play/ (iOS 26 이상).

## 1. 필요한 기기

| 항목 | 조건 |
|---|---|
| iOS · iPadOS | **26 이상** (설정 › 일반 › 소프트웨어 업데이트) |
| 기기 | iOS 26 이 설치되는 iPhone · iPad. 오래된 기기는 켜져도 느릴 수 있습니다 (그래픽 등급은 자동으로 Very Low 부터 시작해 맞춥니다) |
| 주의 | 저전력 모드에서는 느려질 수 있고, 차단 모드(Lockdown Mode)에서는 WebGPU 가 꺼집니다 |

조건이 안 맞으면 게임이 멈추지 않고 "WebGPU 를 사용할 수 없습니다" 안내 화면을 보여 줍니다 (Simulator 에서 확인함 — 2번).

## 2. 이미 자동으로 되는 것 (제가 해 둔 것)

GitHub 저장소 → **Actions** → 왼쪽 **iOS build**. `ios/` 를 고쳐 `claude/…` 가지에 올리면 저절로 돌고, **Run workflow** 로 직접 돌릴 수도 있습니다. Mac 컴퓨터(`macos-26`)에서:

1. 게임을 소스에서 빌드해 앱에 넣고 (`ios/scripts/prepare-resources.js` — PC판 · Android 와 똑같은 게임 파일), 앱 아이콘 · 버전 번호를 만들고, XcodeGen 으로 Xcode 프로젝트를 만듭니다.
2. **자동 업데이트 단위 시험** (XCTest, 가짜 서버): 새 버전 → 받아서 준비됨 · 가장 높은 버전을 고름 · 막히거나 실패하거나 옛것을 주는 주소가 있어도 늦어지지 않음 · sha256 이 틀리면 아무것도 저장하지 않음 · 앱이 너무 옛것(minShell)이면 받지 않음 · 낮은 버전으로 내려가지 않음 · 확인은 한 번에 하나 · 기록 200줄 · 버전 비교(1.10.0 > 1.9.0) · Node 가 만든 gzip 과 저장소의 진짜 `desktop/update/game.gz` 풀기.
3. **Simulator 연기 시험** (`ios/scripts/smoke.sh`): 가상 iPhone 17 Pro 에 설치해 다섯 번 켜 보고(`--skw-selftest` — 보통 실행에서는 아무 일도 안 함), 가상 iPad Pro 13형에서도 한 번 켜서 결과를 판정합니다 (`ios/scripts/check-selftest.js`) — 아래 표. 화면 사진은 실행 기록 맨 끝에 작은 JPEG(base64)로 찍히고, 요약(단위 시험 · 판정 · WebGPU 진단)이 그 뒤에 나옵니다.
4. **실제 기기용(iphoneos) 빌드** — 서명 없이 컴파일만 (서명이 없어서 설치는 안 됩니다).

결과 파일: 실행 기록 맨 아래 **Artifacts → second-korean-wars-ios** (서명 없는 앱 zip · 시험 결과 JSON · 화면 사진 · 콘솔 기록).

### Simulator 에서 확인한 것

CI 실행 기록에서 확인한 결과입니다 (iPhone 17 Pro · iPad Pro 13형 · iOS/iPadOS 26.5 Simulator, 2026-11-28, Actions 실행 46090179923 · 46091252363 · 46094143941, `ios/scripts/check-selftest.js` 의 판정 — 모두 통과).

| 확인한 것 | 결과 |
|---|---|
| 게임 주소 · 보안 출처 | `skw://game/index.html` 로 뜨고 `isSecureContext = true` (WebGPU 가 켜지는 조건) · `crypto.subtle` · `DecompressionStream` 있음 |
| WebGPU | `navigator.gpu` 는 **있음**. 하지만 `requestAdapter()` 가 **null** → 게임이 스스로 "사용 가능한 GPU 어댑터가 없습니다" 안내 화면을 보여 줌 (멈추지 않음). 원인은 아래 7번: GitHub 의 Mac 은 가상 머신이라 GPU 가 WebGPU 를 못 씀 |
| WebGPU 가 아예 없는 기기 | `navigator.gpu` 를 지운 채로 켜면 "WebGPU 를 사용할 수 없습니다" 안내 화면 · 다리(skwDesktop)는 그대로 |
| 다리 | `skwDesktop.platform = 'ios'` · 앱(껍데기) 1.6.0 · 게임 번호와 보이는 번호가 띄운 게임과 같음 (앱에 든 1.6.0/0.16, 받은 1.7.0/0.17) · `window.__skwIOS` 있음 |
| 자동 업데이트 | `update.status()` 가 약속한 모양(S) · `update.check()` 가 실제 GitHub 두 주소에 물어 **latest** 로 끝난 뒤 돌아옴 (seq 2) |
| 진짜 업데이트 받기 · 적용 | 앱 번호를 1.5.0 으로 속여 켜면(`--skw-selftest-shell`) GitHub 의 **진짜 피드**에서 게임을 받아 gzip 풀기 · sha256 확인 · 저장 뒤 **켤 때 바로 적용** (`S.applied = true`). 받은 게임도 같은 `skw://game` 출처라 **localStorage 가 그대로**이고, 다시 확인하면 latest. 또 시험 도중 실제로 0.17 이 피드에 올라오자(2026-11-28 01:32), 그 뒤에 켠 iPad 시험의 앱(0.16 이 든 앱)이 **0.17 을 받아 켤 때 바로 바꿔** 띄웠습니다 |
| localStorage | 쓰고 → 다른 앱(설정)으로 보내고 → 앱을 끄고 → 다시 켜도 **그대로** |
| 일시정지 고리 | 다른 앱으로 넘어갈 때 앱이 `window.__skwIOS.pause()` 를 부름 (콘솔 `[SKW] lifecycle pause: 0`) |
| 앱 설정 | 오디오 세션 `.ambient` · 화면 꺼짐 막음(앞에 있을 때) · 상태 막대 숨김 · 홈 표시줄 자동 숨김 · 가로 (874x402, 안전 영역 좌우 62 · 아래 20) · 번들 ID · 버전 0.16 (빌드 10600) |
| iPad | iPad Pro 13형 Simulator 에서도 같은 시험 통과 (1376x1032 가로) |
| JS 오류 | 안내 화면의 `[SKW fatal]` 기록 말고는 없음 |
| 화면 사진 | 가로 · 전체 화면(상태 막대 없음), 왼쪽에 Dynamic Island, 게임의 "WebGPU is not available" 안내 상자가 안전 영역 안 가운데에 — 앱이 원하는 대로 그려짐. (그 실행은 피드에서 받은 0.17 을 띄워서, 이 가지에서 고친 '다른 앱 안에서 열었다면 Safari 로' 줄이 아직 보였음 — 이 가지가 배포되면 앱 안에서는 사라짐) |
| 단위 시험 | XCTest 18개 모두 통과 (가짜 서버 · Node 의 gzip · 저장소의 진짜 `game.gz`) |
| 기기용 빌드 | `iphoneos` Release arm64 컴파일 성공 (서명 없음) · 최소 iOS 26.0 · 앱 크기 약 0.9 MB |

### 버전 번호

PC판 · Android 와 같은 `desktop/package.json` 을 씁니다 (규칙은 `desktop/README-itch.md` 의 **버전 번호**).

| Apple 의 이름 | 값 | 예 (0.16) |
|---|---|---|
| 버전 (CFBundleShortVersionString, App Store 에 보이는 번호) | `skwLabel` | 0.16 |
| 빌드 (CFBundleVersion, 올릴 때마다 커져야 함) | 내부 번호 `version` 에서 계산 (Android versionCode 와 같음) | 1.6.0 → 10600 |
| 앱(껍데기) 내부 번호 (Info.plist `SKWShellVersion`, 자동 업데이트의 minShell 과 비교) | `version` | 1.6.0 |

같은 버전을 TestFlight 에 다시 올려야 하면 **Run workflow** 의 `build_number` 칸에 더 큰 숫자(예: 10601)를 넣습니다.

## 3. 내 iPhone 에 시험 설치하기 (Mac 이 있을 때 · 무료)

Apple Developer Program 없이도 **Mac + 무료 Apple ID** 로 내 iPhone 에 설치할 수 있습니다 (7일 뒤 다시 설치해야 함 · 다른 사람에게 줄 수는 없음).

1. Mac 에 **Xcode**(App Store, 무료)와 [Homebrew](https://brew.sh) 를 설치하고, 터미널에서:
   ```
   brew install xcodegen node
   git clone https://github.com/Korean568/SKW.git && cd SKW
   (cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci)
   node ios/scripts/prepare-resources.js
   cd ios && xcodegen generate && open SecondKoreanWars.xcodeproj
   ```
2. Xcode 왼쪽 **SecondKoreanWars** → **Signing & Capabilities** → **Team** 에서 내 Apple ID(**Personal Team**)를 고릅니다. "번들 ID 를 쓸 수 없다" 고 나오면 `com.secondkoreanwars.game` 끝에 `.test` 처럼 붙여 바꿉니다 (시험용일 때만).
3. iPhone 을 USB 로 연결 → iPhone 의 **설정 › 개인정보 보호 및 보안 › 개발자 모드** 켜기 → Xcode 위쪽에서 내 iPhone 을 고르고 ▶ (Run).
4. 처음 켤 때 "신뢰하지 않는 개발자" 가 나오면 iPhone 의 **설정 › 일반 › VPN 및 기기 관리** 에서 내 Apple ID 를 신뢰합니다.

## 4. 소유자만 할 수 있는 일 — TestFlight · App Store 에 올리기

결제 · 본인 확인 · 법적 동의가 필요해서 대신 해 드릴 수 없는 부분입니다. 순서대로 하시면 됩니다.

> 아래의 메뉴 이름과 순서는 Apple 화면을 직접 보며 쓴 것이 아니라 기억에 따라 적은 것이고, Apple 이 화면을 자주 바꿉니다. 이름이 다르면 비슷한 메뉴를 찾아보시고, 막히면 화면을 캡처해 보내 주세요. 심사 기간 · 결과도 Apple 이 정하므로 약속드릴 수 없습니다.

### 4-1. Apple Developer Program 가입 (해마다)

1. https://developer.apple.com/programs/ → **Enroll**. Apple ID 는 **이중 인증**이 켜져 있어야 합니다.
2. 유형 **개인(Individual)**. 가입비 **연 99달러** (해마다 갱신 — 끊기면 App Store 에서 앱이 내려갑니다).
3. **가입자는 만 18세 이상의 성인이어야 합니다.** 미성년자라면 **보호자 이름 · 보호자 Apple ID 로 가입**해야 하고, App Store 에 판매자 이름으로 **보호자의 실명**이 보입니다.
4. 승인까지 며칠 걸릴 수 있습니다.

### 4-2. 번들 ID 와 앱 등록 (한 번만)

1. https://developer.apple.com/account → **Certificates, Identifiers & Profiles** → **Identifiers** → **+** → **App IDs** → **App** → Bundle ID **Explicit** 에 `com.secondkoreanwars.game` → 기능(Capabilities)은 아무것도 켜지 않음 → **Register**.
2. https://appstoreconnect.apple.com → **앱** → **+** → **신규 앱**: 플랫폼 **iOS**, 이름 `제 2차 한국전쟁` (App Store 전체에서 겹치지 않아야 함 — 이미 있으면 `Second Korean Wars` 등), 기본 언어 **한국어**, 번들 ID `com.secondkoreanwars.game`, SKU `skw-ios` (아무 글자), 사용자 액세스 **전체 액세스**.

### 4-3. App Store Connect API 키 → GitHub 시크릿 네 개 (한 번만)

GitHub 의 Mac 이 대신 서명하고 올리려면 열쇠가 필요합니다.

1. App Store Connect → **사용자 및 액세스** → **통합(Integrations)** → **App Store Connect API** → **팀 키** → **+** (처음이면 "API 액세스 요청" 먼저).
   이름 `GitHub`, 액세스 **관리자(Admin)** — 자동 서명이 인증서 · 프로비저닝 프로파일을 만들려면 필요합니다.
2. **API 키 다운로드**로 `AuthKey_XXXXXXXXXX.p8` 를 받습니다. **한 번만 받을 수 있으니** 안전한 곳에 보관하세요 (저장소에는 절대 올리지 않습니다).
   같은 화면의 **키 ID**(10글자)와 위쪽의 **Issuer ID**(긴 글자)를 적어 둡니다.
3. **팀 ID**: https://developer.apple.com/account → **Membership details** 의 Team ID (10글자).
4. `.p8` 파일을 글자로 바꿉니다:
   - Mac: 터미널에서 `base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy` (복사됨)
   - Windows: PowerShell 에서 `[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXXXXXX.p8")) | Set-Clipboard`
5. GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** 으로 네 개:

| 시크릿 이름 | 넣을 것 |
|---|---|
| `APPSTORE_KEY_ID` | 키 ID |
| `APPSTORE_ISSUER_ID` | Issuer ID |
| `APPSTORE_KEY_P8_BASE64` | 4번에서 복사한 긴 글자 |
| `APPLE_TEAM_ID` | 팀 ID |

### 4-4. TestFlight 로 시험하기

1. GitHub → **Actions** → **iOS build** → **Run workflow** (`testflight` 체크 그대로) → 실행.
   시크릿 네 개가 다 있으면 `testflight` 단계가 앱을 **자동 서명**해 보관(archive)하고 **TestFlight 에 올립니다**. 시크릿이 없으면 그 단계는 건너뜁니다.
   **이 단계는 계정이 없어 아직 한 번도 돌려 보지 못했습니다.** 첫 실행이 실패하면 실행 기록을 보내 주세요.
2. App Store Connect → 앱 → **TestFlight**: 처리(수 분~수십 분)가 끝나면 빌드가 보입니다. 수출 규정(암호화) 질문은 앱에 "비면제 암호화 없음"(`ITSAppUsesNonExemptEncryption = NO`, HTTPS 만 씀)이 들어 있어 묻지 않습니다.
3. **내부 테스터**(App Store Connect 사용자, 100명까지)는 바로 시험할 수 있습니다. **외부 테스터**(이메일 · 공개 링크, 10,000명까지)는 첫 빌드에 **베타 앱 심사**가 필요합니다. 테스터는 App Store 의 **TestFlight** 앱으로 설치합니다. TestFlight 빌드는 90일 뒤 만료됩니다.

### 4-5. App Store 심사 제출

App Store Connect → 앱 → **iOS 앱 › 버전** 화면:

| 항목 | 답 |
|---|---|
| 스크린샷 | 가로 화면 스크린샷 — **iPhone 6.9형** 과 **iPad 13형** 크기가 필요합니다. 말씀해 주시면 게임 화면을 렌더해 만들어 드립니다 |
| 이름 · 부제 · 설명 · 키워드 | `ios/store/ko/` (한국어) · `ios/store/en/` (영어, **현지화** 에서 English 추가) |
| 지원 URL | `https://whgkwns.itch.io/second-korean-wars` |
| 개인정보 처리방침 URL | `https://korean568.github.io/SKW/privacy.html` (iPhone 앱 내용 포함) |
| **앱 개인정보 보호** | **데이터를 수집하지 않음** (계정 · 광고 · 분석 없음. 자동 업데이트는 GitHub 의 공개 파일을 받기만 함) |
| **연령 등급** | 설문에 **사실대로**: 전쟁 배경의 **사실적 폭력**(총격전 · 사망 · 처형 장면) 잦음/강함, **가려서 표기한 비속어** 드묾. 성적 내용 · 도박 · 약물 · 이용자 간 대화 · 구매 없음. 높은 연령 등급(16+ 또는 18+)이 나올 것으로 예상합니다 |
| 카테고리 | **게임 › 액션** (보조: 게임 › 롤플레잉 또는 비워 둠) |
| 가격 | 무료 |
| 수출 규정 | 앱에 이미 "아니요"(비면제 암호화 없음)로 들어 있음 |
| 앱 심사 정보 › 메모 | `ios/store/review-notes.txt` 의 영어 글을 그대로 붙여 넣기 (로그인 없음 · 오프라인 동작 · 자동 업데이트 설명) |

> **한국 등급 주의.** 한국 App Store 에 게임을 내려면 등급분류가 필요합니다. App Store Connect 의 연령 등급 설문과 한국 등급(게임물관리위원회) 사이의 관계는 제가 확인하지 못했습니다. 등급 화면의 안내를 따르시고, 막히면 캡처해 보내 주세요.

### 4-6. 심사에서 걸릴 수 있는 것 (미리 알아 두기)

| 가이드라인 | 걱정 | 대비 |
|---|---|---|
| **2.5.2** 앱은 스스로 완결되어야 하고, 기능을 바꾸는 코드를 받아 실행하면 안 됨 | 자동 업데이트가 게임(HTML · JavaScript)을 받는다 | 규칙에 "WebKit(WKWebView) 이 실행하는 코드는 앱의 주된 목적을 바꾸지 않으면 허용" 이라는 예외가 있고, 이 앱은 그 경우입니다(같은 게임의 새 버전만, sha256 확인). 심사에서 문제 삼으면 **`ios/SKW/Info.plist` 의 `SKWAutoUpdate` 를 `<false/>` 로 바꿔** 다시 올리면 코드 수정 없이 자동 업데이트가 꺼집니다 (그때는 게임 내용도 App Store 업데이트로만 바뀝니다) |
| **4.2** 최소 기능 (웹사이트를 감싼 것뿐인 앱) | 화면이 WKWebView 하나 | 웹사이트를 띄우는 것이 아니라 게임 전체가 앱 안에 들어 있고 인터넷 없이 동작, 가로 고정 · 전체 화면 · 백그라운드 일시정지 · 화면 꺼짐 방지 · 자체 업데이트 등 앱 기능이 있습니다. 그래도 심사자의 판단이라 반려될 수 있습니다 |
| **1.1** 불쾌한 콘텐츠 — 게임 속 '적' 이 실제 국가 · 정부만을 겨냥하면 안 된다는 조항 | 적이 북한군 | 이야기는 남과 북 양쪽 시점이고 플레이어가 북한군 병사로도 진행합니다 (심사 메모에 적어 둠). 그래도 반려되면 사유를 보내 주세요 |
| 연령 등급 | 처형 장면 · 사실적 폭력 | 설문에 사실대로 답하면 높은 등급이 나오고, 그것으로 괜찮습니다 |

## 5. 게임 자동 업데이트

PC판 · Android 와 **같은 업데이트 파일**(`desktop/update/latest.json` + `game.gz`, `cd desktop && npm run publish-update`)과 **같은 규칙**입니다. 새 버전을 낼 때 iPhone 을 위해 따로 할 일은 없습니다.

- **언제 확인하나**: 앱을 켤 때 · 앞에 켜 둔 동안 30분마다(다른 앱을 보는 동안은 쉬고, 돌아왔을 때 30분이 지났으면 바로) · 설정의 **업데이트 확인** 을 누를 때.
- **어디서 받나**: `raw.githubusercontent.com` 과 `korean568.github.io` 두 곳에 동시에 묻고 **더 높은 버전**을 고릅니다. 한 곳이 이 앱에 맞는 새 버전을 알려 주면 다른 곳은 1초만 더 기다립니다. 시간 제한 latest.json 10초 · game.gz 90초, 실패하면 1.5초 쉬고 한 번 더 (404 같은 4xx 는 다시 하지 않음). 캐시를 피하려고 주소에 `?t=` 를 붙입니다.
- **켤 때**: 최대 4초 기다려 새 게임을 다 받으면 바로 새 게임으로 시작하고 "새 버전 0.xx 으로 업데이트했습니다" 를 보여 줍니다. 늦으면 지금 게임으로 시작하고 뒤에서 받아 "새 버전 0.xx 준비됨 · 지금 적용" (안 누르면 다음에 켤 때 새 게임).
- **안전**: 풀어서(gzip) sha256 이 맞을 때만 저장하고(임시 파일 → 이름 바꾸기), 켤 때도 다시 확인합니다. 낮은 버전으로는 바꾸지 않습니다. 인터넷이 없어도 게임은 그대로 켜집니다.
- **앱과 안 맞는 새 게임**: `latest.json` 의 `minShell` 이 이 앱의 내부 번호보다 높으면 받지 않고 설정에 "새 버전 0.xx 은 App Store 에서 앱을 업데이트해야 합니다" 를 보여 줍니다. iOS 쪽 다리(`GameViewController` · `ios-shim.js`)를 옛 앱과 안 맞게 바꾸면 `minShell` 을 올리세요.
  App Store 에 앱이 올라가면 `source/mod_desktop.js` 의 `APP_STORE` 에 앱 주소(`https://apps.apple.com/app/id…`)를 넣어 주세요 — 그러면 그 안내 옆에 **App Store ↗** 버튼이 생깁니다 (지금은 비어 있어 버튼을 숨김).
- **새 앱을 설치하면**: 앱에 든 게임이 받아 둔 것보다 같거나 새것이면 앱의 게임을 쓰고 받아 둔 파일은 지웁니다.
- **저장 위치**: 앱 전용 `Library/Application Support/game/` (iCloud · 기기 백업에서 뺌). 진행 · 설정(localStorage)은 `skw://game` 이라는 고정 주소에 묶여 있어 **업데이트해도 그대로** 남습니다.
- **기록**: `Library/Application Support/update.log` (200줄). 게임 안에서는 `skwDesktop.update.log()`, Simulator 에서는 `xcrun simctl get_app_container booted com.secondkoreanwars.game data` 폴더 아래에서 볼 수 있습니다.
- **끄기**: `ios/SKW/Info.plist` 의 `SKWAutoUpdate` 를 `<false/>` 로 (4-6).

## 6. 폴더 안내 (개발 메모)

| 경로 | 내용 |
|---|---|
| `project.yml` | XcodeGen 설정 — Xcode 프로젝트(`SecondKoreanWars.xcodeproj`)는 저장소에 없고 이것으로 만듭니다 |
| `SKW/App/GameViewController.swift` | 앱 본체: 전체 화면 WKWebView, `skw://` 서빙(WKURLSchemeHandler), 게임 ↔ 앱 다리(WKScriptMessageHandlerWithReply), 일시정지 · 다시 시작, 링크는 Safari 로, 불러오기 실패 · 반복 충돌 안내 |
| `SKW/App/Updater.swift` | 게임 자동 업데이트 (5번) — Android `Updater.java` 를 옮긴 것 |
| `SKW/App/AppDelegate.swift` | 앱 시작 · 오디오 세션(.ambient) · 창 · 화면 꺼짐 방지 |
| `SKW/App/SelfTest.swift` | CI 의 Simulator 자동 시험 (Debug 빌드에서 실행 인자 `--skw-selftest` 가 있을 때만 — Release · App Store 빌드는 무시) |
| `SKW/Web/ios-shim.js` | 게임이 쓰는 `window.skwDesktop` (platform `ios`, 자동 업데이트 `skwDesktop.update` 포함) — 앱이 문서 시작 때 끼워 넣음 |
| `SKW/Info.plist` · `SKW/Resources/` | 앱 설정(가로 · 전체 화면 · `SKWAutoUpdate`), 이름(영어 · 한국어), 안내 글, 아이콘 · 시작 화면 색 |
| `SKW/Game/` · 아이콘 PNG · `Config/Version.xcconfig` | 저장소에 없음 — `scripts/prepare-resources.js` 가 빌드할 때 만듭니다 |
| `SKWTests/UpdaterTests.swift` | 자동 업데이트 단위 시험 (가짜 서버) |
| `scripts/prepare-resources.js` · `make-icon.js` | 게임 빌드(PC판 · Android 와 같은 `desktop/scripts/build-story.js`) · 아이콘 1024x1024(알파 없음) · 버전 |
| `scripts/smoke.sh` · `check-selftest.js` | Simulator 연기 시험과 판정 |
| `store/` | App Store 설명 글(한국어 · 영어) · 심사 메모 |
| `../.github/workflows/ios.yml` | 자동 빌드 · 시험 · (선택) TestFlight |
| `../privacy.html` | 개인정보처리방침 (iPhone 앱 포함) |

## 7. 기술 메모 (확인한 것 · 한계)

- **러너**: `macos-26` (macOS 26.7 · Apple M1 가상 머신 · Xcode 26.6 기본 · iOS 26.5 SDK · Simulator 런타임 iOS 26.2 · 26.4 · 26.5). `macos-15` 러너에도 Xcode 26 과 iOS 26.0~26.2 Simulator 가 있지만 더 새로운 `macos-26` 을 씁니다. 최소 iOS 를 26.0 으로 둔 까닭은 WebGPU.
- **게임을 띄우는 방법 — `skw://` (WKURLSchemeHandler) 를 고름.** Simulator 에서 `file://`(loadFileURL)도 `isSecureContext = true` 였지만(비교 시험 `file`), `file://` 은 앱에 든 게임(앱 묶음 안)과 받은 게임(Application Support)의 주소가 달라지고 출처가 `file://` 하나로 뭉뚱그려집니다. `skw://game` 은 어느 게임을 띄우든 같은 출처라 **업데이트해도 진행 · 설정(localStorage)이 남습니다** (시험 `update` 에서 확인).
- **WebGPU 는 GitHub 러너에서 확인할 수 없습니다 (증거).** 러너 Mac 의 Metal 장치는 `Apple Paravirtual device` 이고 `apple7=false · apple9=false · metal3=false` 입니다. 같은 러너의 **macOS WKWebView 에서도** `navigator.gpu` 는 있지만 `requestAdapter()` 가 null 입니다 (`ios/scripts/webgpu-host-probe.swift`, CI 의 "WebGPU on the runner itself" 단계). 그래서 Simulator 의 null 어댑터는 앱 문제가 아니라 가상 GPU 의 한계입니다. 실제 iPhone(iOS 26)에서 WebGPU 어댑터가 나오는지 · 처음 화면 · 설정의 버전 줄은 실제 기기에서만 볼 수 있고, 같은 화면은 PC 의 헤드리스 Chromium 에서 진짜 `ios-shim.js` 로 시험했습니다 (한국어 · 영어, 버전 줄 · 게임 종료 없음 · 전체 화면 줄 없음 · App Store 안내 · `G.i18n.miss` 비어 있음).
- **WKWebView 의 사용자 에이전트**는 iOS 26.5 에서도 `iPhone OS 18_7` 로 나옵니다 (WebKit 이 번호를 묶어 둠). 게임은 기기 판별에 `iPhone|iPad` 만 보므로 상관없습니다.
- **소리**: 오디오 세션 `.ambient` — 무음 스위치를 켜면 소리가 안 나고, 듣던 음악과 섞입니다. 게임 소리를 무음 스위치와 관계없이 내고 싶으면 `AppDelegate.swift` 에서 `.playback` 으로 바꾸면 됩니다.
- **iPadOS 26**: `UIRequiresFullScreen`(iPad 전체 화면 고정)은 iPadOS 26 에서 "앞으로 무시될 예정" 경고가 납니다. 지금은 넣어 두었고, 창 크기가 바뀌어도 게임은 크기에 맞춰 다시 그립니다.
- **WKWebView 설정**: `mediaTypesRequiringUserActionForPlayback = []` (터치 없이 소리), 스크롤 · 확대 · 링크 미리보기 끔, 안전 영역까지 그림(`contentInsetAdjustmentBehavior = .never`, 게임이 `env(safe-area-inset-*)` 사용), 앱 밖 주소로 이동 금지(사용자가 누른 http/https 만 Safari 로), 웹 프로세스가 죽으면 다시 불러옴(30초 안에 3번이면 안내).

직접 빌드 (Mac · Xcode 26 · Node.js 22 · `brew install xcodegen`):

```
cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci && cd ..   # 게임 빌드 도구(esbuild)
node ios/scripts/prepare-resources.js                            # 게임 · 아이콘 · 버전 → ios/SKW/Game · Config/Version.xcconfig
cd ios && xcodegen generate                                      # SecondKoreanWars.xcodeproj
xcodebuild test -project SecondKoreanWars.xcodeproj -scheme SecondKoreanWars -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```
