# Second Korean Wars — PC 다운로드판 (itch.io)

웹판(GitHub Pages)과 같은 게임을 **Electron** 으로 감싸 Windows · macOS · Linux 에서 내려받아 실행하는 판입니다.
`source/` 에서 스토리 게임을 빌드해 앱 안에 넣어 묶으므로 **인터넷 없이** 돌아갑니다. PC판에는 스튜디오 오프닝을 넣지 않습니다. (저장소 루트의 `index.html` 은 웹판 해상대전이라 PC판에 쓰지 않습니다.)
PC 판에서는 게임의 데스크톱 모드(일시정지 메뉴 · 게임 끄기 · 전체 화면 F11)가 자동으로 켜집니다.

## 폴더 구성

| 파일 | 내용 |
|---|---|
| `package.json` | 앱 이름 · 버전 두 개(`version` 내부 번호 · `skwLabel` 보이는 번호 — 아래 **버전 번호**) · 빌드 명령 · electron-builder 설정 |
| `main.js` | Electron 메인 프로세스: 창, `app://skw/` 전용 주소, WebGPU 스위치, 외부 링크 → 시스템 브라우저 |
| `preload.js` | 게임에 `window.skwDesktop` (quit · setFullscreen · isFullscreen · openExternal · version · gameVersion · label · platform) 제공 |
| `scripts/dist.js` · `scripts/version.js` | `npm run dist:*` = prepare-app 후 electron-builder (파일 이름에 `skwLabel`) · 두 버전 번호 읽기·검사 |
| `scripts/prepare-app.js` | `../source/build.js --story` 로 스토리 게임을 `app/index.html` 에 빌드하고, 오프닝(`clkky-opening.js`)을 부르는 줄을 뺌 |
| `scripts/publish-update.js` · `update/` | 자동 업데이트: `npm run publish-update` 가 `update/game.gz` · `update/latest.json` 을 만들고, 커밋하면 설치된 앱이 다음 실행 때 받아 감 |
| `scripts/make-icon.js` | 게임 탭 아이콘(SVG)을 `build/icon.png` (512×512) 로 변환 (아이콘을 바꿀 때만) |
| `build/icon.png` | 앱 아이콘 (Windows .ico · macOS .icns 는 빌드 때 자동 생성) |
| `itch/.itch.toml` | itch 앱의 "Play" 실행 설정 (빌드 때 앱 폴더 맨 위에 들어감) |
| `app/`, `dist/`, `node_modules/` | 빌드 때 생기는 폴더 — 커밋하지 않음 (`.gitignore`) |

## 1. 빌드하기

필요한 것: **Node.js 22.12 이상** (https://nodejs.org), 인터넷 (처음 한 번 Electron · 빌드 도구를 내려받음).

```bash
cd desktop
npm install            # 처음 한 번 (또는 package.json 이 바뀌었을 때)
npm start              # 빌드 없이 바로 실행해 보기 (개발자 도구: npx electron . --devtools)

npm run dist:win       # Windows  → dist/SecondKoreanWars-0.13-win-x64.zip
                       #            dist/SecondKoreanWars-0.13-win-x64-portable.exe (설치 없는 단일 exe)
npm run dist:mac       # macOS    → dist/SecondKoreanWars-0.13-mac-x64.zip, dist/SecondKoreanWars-0.13-mac-arm64.zip
npm run dist:linux     # Linux    → dist/SecondKoreanWars-0.13-linux-x86_64.AppImage, dist/SecondKoreanWars-0.13-linux-x64.tar.gz
```

- 각 OS 판은 **그 OS 에서** 빌드하는 것이 가장 확실합니다. `dist:mac` 은 Mac 에서만 됩니다.
  Mac 이 없으면 아래 **GitHub Actions** 로 세 OS 를 한 번에 빌드하세요.
- `dist:*` 명령은 매번 `prepare-app` 을 먼저 돌려 `source/` 의 최신 소스로 스토리 게임을 새로 빌드합니다 (따로 빌드할 필요 없음).
- 버전을 올릴 때는 `package.json` 의 `"version"` 과 `"skwLabel"` 을 함께 올립니다 (아래 **버전 번호**). 파일 이름 · 게임 안 버전 표시 · itch 버전은 `skwLabel` 을 씁니다.
- macOS 판은 Apple 개발자 서명 · 공증을 하지 않은(ad-hoc 서명) 빌드입니다. 처음 열 때
  "확인되지 않은 개발자" 경고가 나오면 앱을 **우클릭 → 열기**, 또는 "손상되었다" 고 나오면 터미널에서
  `xattr -cr "/Applications/Second Korean Wars.app"` 를 한 번 실행하도록 itch 페이지에 적어 두세요.
- Linux 에서 `The SUID sandbox helper binary ...` 오류로 안 켜지면 `--no-sandbox` 를 붙여 실행합니다
  (예: `./SecondKoreanWars-0.13-linux-x86_64.AppImage --no-sandbox`). itch 앱으로 실행하면 `.itch.toml` 이 자동으로 붙입니다.

## 버전 번호 (보이는 번호 0.xx · 내부 번호)

주인 규칙: **게임을 다 만들 때까지 사람에게 보이는 번호는 0.xx**, 다 만들었다고 정하면 **1.00**. `package.json` 에 번호가 두 개 있습니다.

| 칸 | 예 | 어디에 |
|---|---|---|
| `skwLabel` | `0.13` | 사람에게 보이는 번호: 게임 화면(`G.LABEL` · `skwDesktop.label`), 파일 이름, itch.io 버전, Android versionName |
| `version` | `1.3.0` | 내부 번호(semver): PC 자동 업데이트 비교(`latest.json` 의 version), Android versionCode(10300) |

이미 설치된 PC 앱(1.2.0 = 보이는 번호 0.12)은 `version` 이 **커질 때만** 새 게임을 받으므로 내부 번호는 절대 내려가면 안 됩니다.

- 릴리스마다: `skwLabel` 을 0.01 올리고 `version` 의 가운데 수를 1 올림 (0.13 = 1.3.0 → **0.14 = 1.4.0** → 0.15 = 1.5.0 …).
- 같은 보이는 번호로 다시 내보낼 때(급한 고침): `version` 의 끝 수만 올림 (0.13 = 1.3.1).
- **게임 완성 = `skwLabel` "1.00", `version` "2.0.0"**. 그 뒤 1.01 = 2.1.0, 1.02 = 2.2.0 …
- 바꾼 뒤 `npm install --package-lock-only` (package-lock.json 의 version 맞추기) → `npm run publish-update`.

## 자동 업데이트 (1.2.0 부터)

앱은 켜질 때 저장소의 `desktop/update/latest.json` 을 보고, 게임 버전이 지금 것보다 새것이면 `game.gz`(스토리 게임 한 파일, 약 170 KB)를 받아
SHA-256 을 확인한 뒤 사용자 폴더에 저장하고 그 게임을 띄웁니다. **exe 를 다시 내려받을 필요가 없습니다.** 인터넷이 없거나 받기에 실패하면 가진 게임으로 그대로 시작합니다.

게임을 고쳤을 때 내보내는 순서:
1. `package.json` 의 `"version"` · `"skwLabel"` 을 올린다 (예: 1.3.0 · 0.13 → 1.4.0 · 0.14, 위 **버전 번호**).
2. `npm run publish-update` → `update/game.gz` · `update/latest.json` 이 새로 만들어진다.
3. 커밋해서 main 에 푸시한다. 몇 분 뒤부터 설치된 모든 앱(1.2.0 이상)이 다음 실행 때 새 게임을 받는다.
4. (선택) 새로 받는 사람도 처음부터 최신이도록 GitHub Actions 의 Desktop builds 로 itch.io 파일도 갱신한다.

- 1.1.1 이하에는 이 기능이 없어 1.2.0 을 한 번은 새로 받아야 합니다 (itch 앱은 자동).
- `latest.json` 에는 `label`(보이는 번호)도 들어갑니다. 1.3.0 부터의 앱은 그것을 게임에 넘기고, 옛 앱(1.2.0)은 모르는 칸이라 무시합니다 — 게임 자체에도 `G.LABEL` 이 들어 있어 옛 앱에서도 0.xx 로 보입니다.
- `main.js` · `preload.js`(앱 껍데기)를 옛 앱과 안 맞게 바꿨다면 `scripts/publish-update.js` 의 `MIN_SHELL` 을 그 버전으로 올립니다 — 옛 앱은 그 게임을 받지 않고 가진 것으로 계속 돕니다.
- 시험: `electron . --update-base=http://127.0.0.1:8799/` 로 다른 주소에서 받게 하거나 `--no-update` 로 확인을 끕니다.

## 2. itch.io 프로젝트 페이지 만들기 (직접 하셔야 합니다)

1. https://itch.io 에 가입 · 로그인 → 오른쪽 위 메뉴 **Upload new project**.
2. **Title**: `Second Korean Wars` (주소 `https://<사용자이름>.itch.io/second-korean-wars` 가 되도록 Project URL 을 `second-korean-wars` 로).
3. **Kind of project: `Downloadable`** (HTML 이 아님 — 웹 업로드가 아닙니다).
4. **Pricing**: 무료(`$0 or donate`) / 유료(`Paid`, 가격 입력) 중 선택.
5. **Uploads**: butler 를 쓰면 여기서 올릴 필요 없음(3번 참고). 웹에서 직접 올린다면
   - `SecondKoreanWars-0.13-win-x64.zip` → 체크 **Windows**
   - `SecondKoreanWars-0.13-mac-arm64.zip` (Apple Silicon M1~) · `...-mac-x64.zip` (Intel Mac) → 체크 **macOS**, 이름을 "macOS (Apple Silicon)" / "macOS (Intel)" 로
   - `SecondKoreanWars-0.13-linux-x64.tar.gz` 또는 `.AppImage` → 체크 **Linux**
   - (선택) `...-win-x64-portable.exe` → 체크 **Windows** ("설치 없는 단일 실행 파일" 로 표시)
6. **Description**: 줄거리 · 조작법(저장소 `README.md` 의 표) · 아래 **최소 사양** 을 붙여 넣기.
7. **Genre** Action / Shooter, **Tags** `fps`, `story-rich`, `korean`, `singleplayer` 등.
8. **Cover image** (630×500 권장) · **Screenshots** 3~5장 — 직접 게임을 캡처해 올리세요 (전투 · 컷신 · 각 스토리).
9. **Community / Visibility**: 처음엔 `Draft` 또는 `Restricted` 로 저장해 직접 내려받아 확인한 뒤 `Public` 으로.

## 3. butler 로 올리기 (권장)

butler 는 itch.io 공식 업로드 도구입니다. 다음 업데이트부터 바뀐 부분만 올리고, 플레이어의 itch 앱도 패치만 받습니다.

1. 설치: https://itch.io/docs/butler/installing.html (또는 itch 앱에 포함된 butler 사용). `butler -V` 로 확인.
2. 로그인 (한 번만, 브라우저가 열림): `butler login`
3. 올리기 (`<사용자이름>` 을 본인 itch.io 사용자 이름으로; 채널 이름에 windows / mac / linux 가 들어가면 OS 가 자동 표시됩니다):

```bash
cd desktop
butler push dist/SecondKoreanWars-0.13-win-x64.zip     <사용자이름>/second-korean-wars:windows   --userversion 0.13
butler push dist/SecondKoreanWars-0.13-mac-arm64.zip   <사용자이름>/second-korean-wars:mac-arm64 --userversion 0.13
butler push dist/SecondKoreanWars-0.13-mac-x64.zip     <사용자이름>/second-korean-wars:mac-x64   --userversion 0.13
butler push dist/linux-unpacked                         <사용자이름>/second-korean-wars:linux     --userversion 0.13
butler status <사용자이름>/second-korean-wars
```

- Linux 는 Linux PC 에서 빌드한 `dist/linux-unpacked` 폴더를 올리면 실행 권한과 `.itch.toml` 이 그대로 들어갑니다.
  (`.tar.gz` 를 웹으로 올려도 됩니다.)
- 올린 뒤 itch.io 의 **Edit game → Uploads** 에서 각 채널의 OS 표시가 맞는지 확인하세요.

## 4. GitHub Actions 로 세 OS 빌드 (선택)

`.github/workflows/desktop.yml` — 저장소 **Actions** 탭 → **Desktop builds** → **Run workflow** (수동 실행만).

- Windows · macOS · Linux 러너에서 각각 빌드하고, 결과 파일을 실행 기록 아래 **Artifacts** 에 올립니다
  (`second-korean-wars-win` / `-mac` / `-linux`, 내려받으면 zip 안에 위 파일들).
- itch.io 자동 업로드도 원하면 저장소 **Settings → Secrets and variables → Actions** 에서
  - **Secrets** 에 `BUTLER_API_KEY` = https://itch.io/user/settings/api-keys 에서 만든 API 키
  - (선택) **Variables** 에 `ITCH_USER` = itch.io 사용자 이름 (없으면 API 키로 알아냄), `ITCH_GAME` = 프로젝트 주소 이름 (기본 `second-korean-wars`)

  를 넣으면, 빌드가 끝난 뒤 `windows`, `mac-arm64`, `mac-x64`, `linux` 채널로 올립니다.
  시크릿이 없으면 업로드 단계는 건너뜁니다. itch.io 프로젝트 페이지(2번)는 먼저 만들어 두어야 합니다.

## 최소 사양 (itch 페이지에 그대로 적어도 됩니다)

이 게임은 **WebGPU** 로 그립니다. WebGPU 를 지원하는 GPU 와 최신 그래픽 드라이버가 필요합니다.

| OS | 필요 사양 |
|---|---|
| Windows | Windows 10 / 11 64비트, **DirectX 12** 를 지원하는 GPU (NVIDIA GTX 900 이후 · AMD GCN 이후 · Intel 6세대 내장 이후), 최신 드라이버 |
| macOS | **macOS 13 Ventura 이상**, Apple Silicon(M1~) 또는 Metal 지원 Intel Mac |
| Linux | 64비트 배포판, **Vulkan** 을 지원하는 GPU 와 드라이버 (Mesa 최신 · NVIDIA 독점 드라이버) |
| 공통 | RAM 4 GB 이상, 저장 공간 약 400 MB, 키보드 · 마우스 |

그래픽 등급(LOW / MEDIUM / HIGH)은 시작할 때 GPU 에 맞춰 자동으로 고르고, F2 로 바꿀 수 있습니다.
GPU 가 WebGPU 를 지원하지 않으면 게임 화면에 안내 문구가 나옵니다.

## 직접 하셔야 하는 일

- itch.io 계정 만들기, 프로젝트 페이지 만들기 (2번), 가격 정하기, 커버 이미지 · 스크린샷 · 설명 올리기.
- 유료 판매라면 itch.io **Payout settings** (세금 정보 · 정산 계좌) 입력.
- 각 OS 판을 한 번씩 직접 내려받아 실행해 보기 (특히 Mac · Linux).
- (선택) Windows 코드 서명 인증서 · Apple 개발자 계정($99/년)으로 서명 · 공증하면 첫 실행 경고가 사라집니다 — 지금 빌드는 서명하지 않습니다.
- (선택) GitHub Actions 자동 업로드를 쓰려면 `BUTLER_API_KEY` 시크릿과 `ITCH_USER` 변수 등록 (4번).
