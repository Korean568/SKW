# 제 2차 한국전쟁 — Android 앱 · Play 스토어 안내

스토리 게임(PC판과 같은 게임)을 Android 앱으로 포장한 것입니다. 이 문서는 **개발자가 아닌 분**을 위해 썼습니다.

- 앱 이름: **Second Korean Wars** (휴대폰 언어가 한국어면 **제 2차 한국전쟁**)
- 패키지 이름(앱의 고유 주소): `com.secondkoreanwars.game` — **Play 스토어에 한 번 올리면 영원히 바꿀 수 없습니다**
- 가로 화면 전용 · 전체 화면 · 인터넷은 **게임 자동 업데이트**에만 씀 (INTERNET 권한 하나 — 설치할 때 따로 묻는 권한은 없음)
- **0.16 부터 게임 내용이 저절로 새 버전으로 바뀝니다** (아래 5번). 0.15 이하 APK 에는 이 기능이 없으니 **0.16 APK 를 한 번만 새로 설치**해 주세요.

> **꼭 알아 두세요.** 이 앱은 아직 **실제 휴대폰에서 시험해 보지 못했습니다.** 만드는 컴퓨터에는 Android 기기도, Android 개발 도구(SDK)도 없어서 코드 검사와 PC 브라우저 시험까지만 했습니다. 그래서 **APK 파일이 실제로 만들어지는지도 GitHub 의 첫 자동 빌드(3번)를 돌려 봐야 압니다.** 특히 앱 안에서 게임 화면을 그리는 기술(WebGPU)이 휴대폰마다 켜지는지는 직접 설치해 봐야만 알 수 있습니다. 첫 APK 를 휴대폰에 설치해 보고 결과(켜지는지, 조작이 되는지, 느린지)와 휴대폰 기종을 알려 주시면 그에 맞춰 고칩니다.

## 1. 필요한 휴대폰

| 항목 | 조건 |
|---|---|
| Android 버전 | **Android 12 이상** |
| 그래픽 칩(GPU) | WebGPU 를 지원하는 칩 — 최근의 **Qualcomm Adreno**(스냅드래곤) · **ARM Mali**(엑시노스 · 디멘시티 등) |
| Android 시스템 WebView | 최신 버전 (Play 스토어 → 프로필 사진 → **앱 및 기기 관리** → **업데이트** 에서 "Android 시스템 WebView" 와 "Chrome" 을 업데이트) |

조건이 안 맞으면 앱이 켜지면서 "이 기기에서는 아직 게임을 실행할 수 없습니다" 라는 안내와 **Play 스토어에서 WebView 열기** 버튼을 보여 줍니다. 오래된 보급형 기기는 켜져도 느릴 수 있습니다 (그래픽 등급은 자동으로 LOW 까지 내려갑니다).

## 2. 시험판 APK 를 휴대폰에 설치하기

APK 는 3번의 **Android build** 를 한 번 실행한 뒤에 itch.io 페이지에 올라옵니다 (그 전에는 아래 2번의 파일이 보이지 않습니다).

1. 휴대폰의 Chrome 으로 **https://whgkwns.itch.io/second-korean-wars** 를 엽니다.
2. 아래쪽 **Download** 에서 Android 표시(로봇 그림)가 있는 `SecondKoreanWars-…-android.apk` (시험용은 `…-android-debug.apk`) 를 받습니다.
3. 받은 파일을 누릅니다. "보안상의 이유로 이 출처의 알 수 없는 앱을 설치할 수 없습니다" 가 나오면 **설정** → **이 출처 허용** 을 켜고 뒤로 가서 **설치** 를 누릅니다.
   (삼성: 설정 → 보안 및 개인정보 보호 → 기타 보안 설정 → **출처를 알 수 없는 앱 설치** → Chrome 허용)
4. "Play 프로텍트" 가 처음 보는 앱이라고 물으면 **무시하고 설치** 를 누릅니다 (스토어에 올리기 전의 앱이라 나오는 안내입니다).
5. 홈 화면의 **제 2차 한국전쟁** 아이콘으로 실행합니다.

- **뒤로 버튼**: 게임 중에는 일시정지 메뉴, 메뉴에서는 한 단계 뒤로, 타이틀에서는 "한 번 더 누르면 종료됩니다".
- 새 버전을 설치했는데 **"앱이 설치되지 않았습니다"** 가 나오면 먼저 예전 앱을 삭제하세요. 파일 이름에 `-debug` 가 붙은 시험용 APK 는 빌드할 때마다 서명이 달라서 덮어 설치가 안 됩니다. 아래 4-3 의 업로드 키를 등록한 뒤에는 항상 같은 서명이라 덮어 설치가 됩니다. (앱을 삭제하면 설정과 진행 상황도 지워집니다.)

## 3. 이미 자동으로 되는 것 (제가 해 둔 것)

- GitHub 저장소 → **Actions** → 왼쪽 **Android build** → 오른쪽 **Run workflow** 를 누르면:
  1. 게임을 소스에서 빌드해 앱에 넣고,
  2. **APK**(휴대폰에 바로 설치하는 파일)와 **AAB**(Play 스토어에 올리는 파일)를 만들고,
  3. `BUTLER_API_KEY` 가 있으면 APK 를 itch.io 의 **android** 채널에 올립니다 (PC판과 같은 방식).
- 결과 파일은 실행 기록 맨 아래 **Artifacts → second-korean-wars-android** 에서 받을 수 있습니다.
  - `SecondKoreanWars-<버전>-android.apk` · `SecondKoreanWars-<버전>-android.aab` — 업로드 키로 서명한 정식 파일 (4-3 의 시크릿이 있을 때)
  - `SecondKoreanWars-<버전>-android-debug.apk` — 시크릿이 없을 때 나오는 시험용
- 버전은 PC판과 같은 번호를 씁니다 (`desktop/package.json`, 규칙은 `desktop/README-itch.md` 의 **버전 번호**): `<버전>` · 앱 정보의 버전(versionName) = `skwLabel` (예: 0.13), Play 의 versionCode = 내부 번호 `version` 에서 계산 (1.3.0 → 10300, 0.14 = 1.4.0 → 10400 · 늘 커짐).
- 앱 아이콘, 스토어 아이콘, 스토어 그래픽 이미지, 스토어 설명 글(한국어 · 영어), 개인정보처리방침 페이지를 만들어 두었습니다 (아래 6번 표).

## 4. 소유자만 할 수 있는 일 — Play 스토어에 올리기

Google 계정 · 결제 · 본인 인증이 필요해서 대신 해 드릴 수 없는 부분입니다. 순서대로 하시면 됩니다.

> **Play 스토어에 올리기 전에 먼저 2번(휴대폰 설치 시험)을 해 주세요.** 실제 휴대폰에서 켜지고 조작되는 것을 확인한 뒤에 등록 수수료를 내는 것이 안전합니다.
> 아래의 메뉴 이름과 누르는 순서는 Play Console 화면을 직접 보며 쓴 것이 아니라 기억에 따라 적은 것이고, Google 이 화면을 자주 바꿉니다. 이름이 다르면 비슷한 메뉴를 찾아보시고, 막히면 화면을 캡처해 보내 주세요. 검토 · 심사에 걸리는 기간도 Google 이 정하므로 약속드릴 수 없습니다.

### 4-1. Play Console 개발자 계정 만들기 (한 번만)

1. PC 브라우저에서 **https://play.google.com/console/signup** 접속 → Google 계정으로 로그인.
2. 계정 유형 **본인(개인)** 선택. (사업자가 있으면 **조직** — 조직 계정은 아래 4-4 의 "12명 · 14일" 조건이 없지만 사업자 확인 서류(D-U-N-S 번호)가 필요합니다.)
3. 개발자 이름(스토어에 보이는 이름) · 연락처를 입력하고 **등록 수수료 25달러**(한 번만 내는 돈)를 카드로 결제.
4. **본인 인증**: 신분증 사진과 주소 확인, 이메일 · 전화번호 인증, 그리고 Android 휴대폰에 **Play Console 앱**을 설치해 기기 확인을 합니다. 며칠 걸릴 수 있습니다.
5. **계정 주인은 성인(만 18세 이상)이어야 합니다.** 미성년자라면 보호자 이름으로 계정을 만들어야 합니다.

### 4-2. 앱 만들기

1. Play Console → **모든 앱** → **앱 만들기**.
2. 앱 이름 `제 2차 한국전쟁` (영어 등록정보에는 `Second Korean Wars`), 기본 언어 **한국어**, **게임**, **무료** 선택 → 선언 두 개에 체크 → **앱 만들기**.
3. 패키지 이름은 처음 AAB 를 올릴 때 파일에 든 `com.secondkoreanwars.game` 으로 정해지고, **그 뒤로는 바꿀 수 없습니다.**

### 4-3. 업로드 키 (서명) 등록

Play 스토어는 "이 파일을 올린 사람이 진짜 개발자" 인지 **업로드 키**로 확인합니다.

1. 업로드 키 파일(`*.keystore`)과 비밀번호는 제가 만들어 드립니다. **두 가지를 안전한 곳(예: 비밀번호 관리자, 개인 클라우드)에 꼭 보관하세요.** 저장소에는 올리지 않습니다.
2. GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** 으로 두 개를 등록합니다.
   - `ANDROID_KEYSTORE_BASE64` — 키 파일을 글자로 바꾼 것 (제가 드리는 긴 글자를 그대로 붙여 넣기)
   - `ANDROID_KEYSTORE_PASSWORD` — 키 비밀번호
3. Play Console 에서 첫 버전을 만들 때 나오는 **Play 앱 서명**은 기본값(**Google 이 서명 키를 관리**) 그대로 **계속** 을 누릅니다. 이렇게 해 두면 업로드 키를 잃어버려도 Google 고객센터를 통해 새 키로 바꿀 수 있습니다.

### 4-4. 비공개 테스트 — 새 개인 계정의 필수 관문

**새로 만든 개인 개발자 계정은 바로 정식 출시(프로덕션)를 할 수 없습니다.** Google 규칙:
**테스터 12명 이상이 참여(opt-in)한 상태로 비공개 테스트를 14일 연속 진행**해야 프로덕션 신청 버튼이 열립니다.
(공식 안내: https://support.google.com/googleplay/android-developer/answer/14151465)

1. Play Console → 앱 선택 → 왼쪽 **테스트** → **비공개 테스트** → **트랙 관리** → **새 버전 만들기**.
2. **App Bundle** 칸에 `SecondKoreanWars-<버전>-android.aab` 를 끌어다 놓습니다 (3번의 Artifacts 에서 받은 파일).
3. 출시 노트를 적고 **다음** → **저장 후 검토 요청**. (첫 검토는 며칠 걸릴 수 있습니다.)
4. **테스터** 탭 → **이메일 목록 만들기** → 테스터 **12명 이상**의 Google 계정 이메일을 넣습니다. 넉넉히 15~20명을 권합니다.
5. 같은 화면 아래 **링크 복사**(테스트 참여 링크)를 테스터들에게 보냅니다. 테스터는 링크에서 **테스터 되기** 를 누르고 Play 스토어에서 앱을 설치해야 "참여"로 집계됩니다.
6. 12명 이상이 **14일 동안 빠지지 않고** 참여 상태여야 합니다. 중간에 나가면 날짜가 다시 계산될 수 있으니 15명 이상으로 시작하세요.
7. 14일이 지나면 **대시보드** 에 **프로덕션 액세스 신청** 이 열립니다. 테스트를 어떻게 했는지 묻는 질문에 사실대로 답하고 신청합니다 (심사에 보통 일주일 안쪽).

### 4-5. 스토어에 필요한 정보 채우기 (대시보드의 "앱 설정" 목록)

| 항목 | 답 |
|---|---|
| **개인정보처리방침** | `https://korean568.github.io/SKW/privacy.html` |
| **앱 액세스 권한** | 모든 기능을 제한 없이 이용 가능 (로그인 없음) |
| **광고** | 아니요, 광고 없음 |
| **콘텐츠 등급** | 설문에 **사실대로** 답합니다. 카테고리 **게임**. 이 게임에는 전쟁 배경의 **총격전, 사람이 죽는 장면, 처형 장면**이 있고 **가려서 표기한 욕설**이 있습니다 → 폭력 관련 질문에 "예". 성적 내용 · 도박 · 약물 · 이용자 간 대화 · 위치 공유 · 구매는 없음. **높은 연령 등급(성인 등급)** 이 나올 것으로 예상합니다. |
| **타겟층** | **만 18세 이상** 만 선택 |
| **데이터 보안** | "필수 사용자 데이터 유형을 수집하거나 공유하나요?" → **아니요** (인터넷은 자동 업데이트로 GitHub 의 공개 게임 파일을 **받기만** 하고, 이용자에 대한 정보는 아무것도 보내지 않습니다 — 아래 5번) |
| **정부 앱 / 금융 기능 / 건강** | 모두 해당 없음 |
| **앱 카테고리** | 게임 → **액션** |
| **연락처 세부정보** | 이메일(필수) — 스토어에 공개됩니다. 웹사이트: `https://whgkwns.itch.io/second-korean-wars` |
| **국가 / 지역** | 프로덕션 → **국가/지역** → 출시할 나라 선택 (한국 포함, 원하시면 전체) |
| **가격** | **무료** (무료로 출시한 앱은 나중에 유료로 바꿀 수 없습니다) |

> **한국 등급 주의.** 설문 결과가 **청소년 이용불가**로 나오면 한국에서는 게임물관리위원회(GRAC)의 등급분류를 따로 받아야 할 수 있습니다. 등급 결과 화면에 나오는 Google 의 안내를 따르시고, 그 화면을 캡처해 보내 주시면 같이 확인하겠습니다. (이 부분은 제가 Google 도움말을 직접 확인하지 못했습니다.)

### 4-6. 스토어 등록정보 (보이는 글과 그림)

Play Console → **앱 정보 늘리기** → **스토어 등록정보** → **기본 스토어 등록정보**. 한국어를 먼저 채우고, **번역 관리** 에서 **영어(en-US)** 를 추가해 영어 글을 넣습니다.

| 칸 | 넣을 것 (이 폴더의 `store/` 안) |
|---|---|
| 앱 이름 | `store/ko/title.txt` · `store/en/title.txt` |
| 간단한 설명 (80자) | `store/ko/short.txt` · `store/en/short.txt` |
| 자세한 설명 | `store/ko/full.txt` · `store/en/full.txt` |
| 앱 아이콘 (512x512) | `store/icon-512.png` |
| 그래픽 이미지 (1024x500) | `store/feature-1024x500.png` |
| 휴대전화 스크린샷 | **가로 화면 스크린샷 2장 이상**이 필요합니다. 말씀해 주시면 제가 게임 화면을 렌더해서 만들어 드립니다. |

## 5. 게임 자동 업데이트 (0.16 부터)

PC판과 **같은 업데이트 파일**(`desktop/update/latest.json` + `game.gz`, `cd desktop && npm run publish-update` 로 만듦)을 씁니다. 그래서 새 버전을 낼 때 Android 를 위해 따로 할 일은 없습니다 — PC판 자동 업데이트를 올리면(커밋 · 푸시) 휴대폰 앱도 같은 게임을 받습니다.

- **언제 확인하나**: 앱을 켤 때 · 켜 둔 동안 30분마다(화면이 꺼져 있거나 다른 앱을 보는 동안은 쉬고, 돌아오면 30분이 지났을 때 바로) · 설정의 **업데이트 확인** 을 누를 때.
- **어디서 받나**: `raw.githubusercontent.com` 과 `korean568.github.io` 두 곳에 동시에 묻고 **더 높은 버전**을 고릅니다 (한 곳이 막히거나 옛 파일을 줘도 다른 곳으로 받음). 한 곳이 이 앱에 맞는 새 버전을 알려 주면 다른 곳은 1초만 더 기다리고 바로 받기 시작합니다 (학교 와이파이처럼 한 곳이 말없이 막혀도 늦어지지 않게). 시간 제한 latest.json 10초 · game.gz 90초, 실패하면 잠깐 쉬고 한 번 더.
- **켤 때**: 최대 4초 기다려 새 게임을 다 받으면 바로 새 게임으로 시작하고 "새 버전 0.xx 으로 업데이트했습니다" 를 보여 줍니다. 4초 안에 안 끝나면 지금 게임으로 시작하고 뒤에서 계속 받아, 다 받으면 처음 화면에 "새 버전 0.xx 준비됨 · 지금 적용" 이 뜹니다 (안 누르면 다음에 켤 때 새 게임).
- **안전**: 받은 파일은 sha256 이 맞을 때만 저장하고(임시 파일 → 이름 바꾸기라 반쯤 받은 파일이 멀쩡한 게임을 덮지 않음), 켤 때도 다시 확인합니다. 더 낮은 버전으로는 바꾸지 않습니다. 인터넷이 없거나 막혀 있어도 게임은 그대로 켜집니다.
- **앱(APK)과 안 맞는 새 게임**: `latest.json` 의 `minShell` 이 이 APK 의 내부 버전보다 높으면 받지 않고 설정에 "새 버전 0.xx 은 앱을 새로 받아야 합니다" 를 보여 줍니다. Android 쪽 다리(`MainActivity` · `android-shim.js`)를 옛 APK 와 안 맞게 바꾸면 PC판과 같이 `minShell` 을 올리세요.
- **새 APK 를 설치하면**: APK 에 든 게임이 받아 둔 것보다 같거나 새것이면 APK 의 게임을 쓰고 받아 둔 파일은 지웁니다.
- **기록**: 앱 안의 `files/update.log` (약 200줄) 에 언제 · 어디서 · 무슨 결과였는지 남습니다. 게임 안에서는 `skwDesktop.update.log()` 로 읽을 수 있고, 시험용(`-debug`) APK 는 PC 에 연결해 `adb shell run-as com.secondkoreanwars.game cat files/update.log` 로 볼 수 있습니다. "업데이트가 안 돼요" 라는 말을 들으면 이 기록이 원인(예: `offline` · `timeout` · `HTTP 404` · `sha256`)을 알려 줍니다.
- **Play 정책 메모**: Google Play 는 앱이 Play 밖에서 실행 코드(dex · .so 등)를 받는 것을 막지만, WebView 안에서 도는 JavaScript 는 예외로 둡니다 (Device and Network Abuse 정책). 이 앱이 받는 것은 WebView 가 여는 게임 HTML · JavaScript 뿐입니다. (정책 문구는 기억에 따라 적은 것이라, Play 심사에서 문제가 되면 알려 주세요.)
- 만드는 쪽(개발 메모): `app/src/main/java/.../Updater.java` (네트워크 · 검증 · 저장 · 기록, `android.*` 없이 Java 만 써서 PC 의 JDK 로도 시험함), `MainActivity` 가 `assets/index.html` 요청에 받은 게임(`files/game/game-<버전>.html`)을 돌려주며 다리 스크립트(`assets/android-shim.js`)를 `prepare-assets.js` 와 똑같이 끼워 넣습니다.

## 6. 폴더 안내 (개발 메모)

| 경로 | 내용 |
|---|---|
| `app/src/main/java/.../MainActivity.java` | 앱 본체: 전체 화면 WebView, 뒤로 버튼, 백그라운드에서 멈춤, WebGPU 가 없을 때 안내, 받은 새 게임 서빙 |
| `app/src/main/java/.../Updater.java` | 게임 자동 업데이트 (5번): latest.json 확인 · game.gz 받기 · sha256 · 저장 · `files/update.log` |
| `app/src/main/AndroidManifest.xml` · `res/` | 앱 설정, 이름(영어 · 한국어), 아이콘 |
| `app/src/main/assets/` | 게임 파일(`index.html`) + 자동 업데이트용 `android-shim.js` · `version.json` — 저장소에 없음. `scripts/prepare-assets.js` 가 빌드할 때 만듭니다 |
| `scripts/prepare-assets.js` | 스토리 게임 빌드(PC판과 같은 `desktop/scripts/build-story.js`) + Android 다리 스크립트 끼워 넣기 (끼워 넣는 방법은 `Updater.inject` 와 똑같아야 함) |
| `scripts/android-shim.js` | 게임이 쓰는 `window.skwDesktop` (platform `android`, 자동 업데이트 `skwDesktop.update` 포함) 을 만드는 작은 스크립트 |
| `scripts/make-icons.py` · `make-feature.js` | 아이콘 · 스토어 그래픽 이미지 만들기 (만든 그림은 저장소에 있음) |
| `store/` | 스토어 아이콘 · 그래픽 이미지 · 설명 글 |
| `../.github/workflows/android.yml` | 자동 빌드 (Actions → Android build) |
| `../privacy.html` | 개인정보처리방침 (GitHub Pages 로 공개) |

직접 빌드 (Android SDK · JDK 17 · Node.js 22 가 있는 컴퓨터):

```
cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci && cd ..   # 게임 빌드 도구(esbuild)
node android/scripts/prepare-assets.js                           # 게임 → android/app/src/main/assets
cd android && ./gradlew assembleDebug                            # app/build/outputs/apk/debug/app-debug.apk
```

서명한 release (`bundleRelease assembleRelease`)는 환경 변수 `ANDROID_KEYSTORE_FILE`(키 파일의 절대 경로) · `ANDROID_KEYSTORE_PASSWORD` 가 있을 때만 서명됩니다. 선택: `ANDROID_KEY_ALIAS`(기본 `upload`) · `ANDROID_KEY_PASSWORD`(기본 = 저장소 비밀번호).
버전 덮어쓰기: `./gradlew assembleDebug -PversionName=0.13 -PversionCode=10301` (Play 는 올릴 때마다 versionCode 가 전보다 커야 합니다 → 올리기 전에 `desktop/package.json` 의 `version` · `skwLabel` 을 올리세요).

기술 요약: 최소 Android 12 (API 31), 대상 API 36 (Google Play 가 2026년 8월 31일부터 새 앱에 요구), Android Gradle Plugin 8.13.2 · Gradle 8.14.3 · JDK 17, 의존 라이브러리는 `androidx.webkit` 하나, 권한은 `INTERNET` 하나 (자동 업데이트).
