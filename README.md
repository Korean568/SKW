# Second Korean Wars

이 저장소에는 두 게임이 들어 있습니다. 둘 다 외부 엔진·3D 모델·이미지·소리 파일 없이 JavaScript + WebGPU(WGSL) + Web Audio 로 만들었습니다.

| 게임 | 어디서 | 내용 |
|---|---|---|
| **해상대전** (해상 반격 — 훈련 교전 · 동해 차단선) | ▶ **https://korean568.github.io/SKW/** (브라우저에서 바로) | 이지스 구축함을 몰아 대함미사일을 요격하고 적 함대·해안포대를 격파 |
| **제 2차 한국전쟁** (1인칭 스토리 게임) | ▶ **https://whgkwns.itch.io/second-korean-wars** (PC 다운로드판) | 스토리 1~4 · 한국어/English. 스토리 게임은 itch.io 에서만 배포합니다 |

PC · Chrome/Edge 최신 버전 권장 (WebGPU 필요).

## 해상대전 조작법
| 키 | 동작 |
|---|---|
| W S / A D | 추력 / 조타 |
| 드래그 · 휠 | 시점 · 줌 |
| Tab / Q | 다음 표적 / 최우선 위협 선택 |
| Space | 미사일 — 공중 SAM · 수상 SSM |
| F | 함포 — 수상·지상 표적 |
| P / H | 일시정지 / 도움말 |
| F2 | 그래픽 등급 순환 (자동 → Very Low → … → Ultra → 자동) |

## 스토리 게임 조작법 (PC판)
| 장면 | 키 | 동작 |
|---|---|---|
| 컷신 | 마우스 | 둘러보기 (화면을 클릭하면 마우스 고정) |
| 컷신 | Space (누르고 있으면 빨리 감기) / 건너뛰기 버튼 | 대사 넘기기 (대사는 자동으로 넘어감) |
| 전투 | W A S D | 이동 |
| 전투 | 마우스 · 왼쪽 클릭 | 조준 · 사격 |
| 전투 | 오른쪽 클릭 | 정조준 |
| 전투 | R | 재장전 (수동만 — 탄창이 비어도 저절로 갈지 않음. 1발 이상 남기고 갈면 약실 +1 = 31발) |
| 전투 | E | 줍기 — E 로만 (밟아서는 줍지 않음): 바닥의 총, 쓰러진 북한군의 방탄판·탄약·AKM 소총 |
| 전투 | 1 / 2 / 3 / 4 · 휠 | 무기 칸: 1 주무기 · 2 보조(K7 기관단총) · 3 주무기 B · 4 중화기(RPG-7 · M134) / 휠 = 다음 칸 (빈 칸은 건너뜀) |
| 전투 | B / T | 사격 모드 (연사 · 점사 · 단발) / 스코프 달기 (K2 계열 · M16 · AKM. K2C 도트 · AUG · K14 · RPG-7 은 조준경 일체형) |
| 전투 | F | 방탄판 교체 |
| 전투 | Shift / C | 달리기 / 앉기 (K14 로 정조준 중 Shift = 숨 참기 2초, 앉아서 멈추면 양각대) |
| 공통 | F2 | 그래픽 등급 순환 (자동 → Very Low → … → Ultra → 자동) |

**무기 11종** (K2 · K2C1 · K2C · K2A · M16 · AUG A1 · AKM · K14 · K7 · RPG-7 · M134): 스토리 1·2·4 의 바닥에 매번 무작위로 떨어져 있습니다 (▼ 표지 · 반짝임, E 로 줍기). 같은 칸이 차 있으면 손의 총과 바꾸고 원래 총은 발밑에 둡니다. 스토리 1 은 K2C1 + K7 로 시작하고, 중화기(RPG-7 로켓 1+4 · M134 500+300발)는 한 판에 많아야 하나 나옵니다. 스토리 2·4 에서는 총을 줍고 들고 바꾸고 조준할 수 있지만 쏠 수는 없습니다 ("지금은 쏠 수 없다"). 무기는 다음 스토리로 이어지지 않습니다.

**터치 (휴대폰 · 태블릿)**: 왼쪽을 밀어 이동 · 오른쪽을 밀어 둘러보기. 사격 버튼은 누르고 있는 동안 연사(M134 포함), RPG-7 · K14 · 단발은 한 번 누를 때 한 발. **무기** 버튼을 짧게 누르면 다음 무기, 0.45초 누르고 있으면 4칸 고르기(칸 위로 밀어 떼거나 칸을 톡). **모드** = B, 화면 가운데 줍기 안내를 톡 = E. 스토리 2·4 에는 사격 버튼이 없습니다.

대본의 괄호 안 글자(행동)는 대사창에 넣지 않고 화면에서 연출하며, 해설은 대사창이 아닌 별도 자막으로 나옵니다.

## 그래픽 등급 (10단계)
**Very Low · Low · Medium Low · Medium · Medium High · Medium Super · High · Super · Max · Ultra** — 등급 이름은 한국어 화면에서도 영어로 씁니다.
Very Low 는 휴대폰·내장 그래픽용(배율 0.75 · MSAA 없음 · 그림자 맵 없음), Medium 은 예전 MEDIUM, High 는 예전 HIGH, Super 이상은 초표본(렌더 배율 1.15~1.5)과 더 큰 그림자 맵을 씁니다.

- **자동**: 시작할 때 GPU 이름(성능표)과 10프레임 벤치마크로 등급을 고릅니다. 등급 경계는 실제 성능순으로 GTX 1080 · RTX 5050 · 2080 · 5060 · 3090 · 5070 · 5080 · 4090 · 5090 입니다 (예: RTX 2080 = Medium, RTX 5090 = Ultra). 이름을 모르면 벤치마크로 High 까지, 소프트웨어 렌더러는 Very Low.
  프레임이 무거우면 먼저 렌더 해상도를 낮추고(동적 해상도), 그래도 부족하면 한 단계씩 내립니다. 휴대폰·태블릿은 Very Low 로 시작해 여유가 있으면 한 단계씩 Medium 까지만 올려 봅니다.
- **직접 고르기**: 화면 우측 상단의 작은 표시(GPU 이름 · 등급 · FPS)를 누르면 상세(해상도 · GPU 시간)와 자동 + 10단계 버튼이 펼쳐집니다. **F2** 는 자동 → Very Low → … → Ultra → 자동 순환.
  PC판 · 앱의 **설정 › 그래픽** 에도 같은 버튼이 있습니다 ("자동 (Medium)" 처럼 자동이 고를 등급 표시). 고른 등급은 저장되어 다음 실행에도 유지됩니다 (예전 LOW/MEDIUM/HIGH 저장값은 Very Low/Medium/High 로).
  **렌더 배율**(50~100 %)은 등급의 기본 배율에 곱해지며, 옆에 실제 렌더 해상도가 나옵니다.
- 휴대폰에서는 어느 등급이든 화소 예산을 묶습니다 (Very Low ≈ 960×540 · Medium ≈ 1280×720 · Ultra ≈ 2270×1280, 그림자 맵은 4096² 까지).

## 소스와 빌드
`index.html`(웹판 = 해상대전)은 `source/` 폴더의 읽기 쉬운 소스를 압축해 만든 결과물입니다 (직접 고치지 마세요).
스토리 게임은 같은 소스에서 `--story` 로 빌드하며, PC판(`desktop/`)이 빌드할 때 자동으로 만듭니다 — 웹에는 올리지 않습니다.
용량을 줄이려고 minify 한 코드를 gzip 으로 한 번 더 묶어 넣고, 브라우저 내장 기능(`DecompressionStream`)으로 풀어 실행합니다 — 외부 라이브러리는 쓰지 않습니다.

| 파일 | 내용 |
|---|---|
| `source/core.js` | 엔진 코어: WebGPU 초기화, 품질 프리셋, 프레임 구성, 공용 셰이더 |
| `source/mod_gpu.js` | GPU 등급 감지(이름 판별 + 10프레임 벤치마크), 성능 표시 |
| `source/mod_sky.js` · `mod_post.js` | 하늘·구름(구름 위에서 내려다보기 포함)·먼 지상 / 블룸·톤매핑 |
| `source/mod_mesh.js` · `mod_fx.js` | 메시 렌더러·그림자 / GPU 파티클 (불·연기·폭발·예광탄) |
| `source/mod_audio.js` | Web Audio 합성 사운드 |
| `source/mod_people.js` | 사람: 매끈한 스키닝 캐릭터(국군·마스크 대령·북한군·승객), 자세·애니메이션, 1인칭 팔·총 |
| `source/mod_cabin.js` | 여객기 실내·외부, 피격 구멍·산소마스크·랜딩기어, 추락 현장 |
| `source/mod_story.js` | 스토리 1 진행: 타이틀, 대본(`G.STORY`), 대사·해설 자막, 연출, 엔딩 — **대본은 이 파일 위쪽 표** |
| `source/mod_fps.js` | 1인칭 총격전: 조작, 북한군 50명, 분대원, 방탄판·피해, 전투 HUD (무기는 `mod_arms.js`) |
| `source/mod_arms.js` · `mod_guns.js` · `mod_enarms.js` | 무기 11종 공용: 표 · 칸 · 탄약 · 사격 · RPG · M134 · 바닥 드랍 / 총 모델 / 무기 영어 사전 |
| `source/story1.txt` | 원본 대본 |
| `source/mod_ocean.js` · `mod_models.js` · `mod_game.js` | 해상대전 (웹판): 바다, 함정·섬 모델, 임무·HUD |
| `source/mod_i18n.js` · `mod_en*.js` | 스토리 게임 영어 지원: 화면 글자를 사전으로 바꿈, 스토리별 영어 사전 |
| `source/mod_story2~4.js` · `mod_village.js` · `mod_palace.js` · `mod_ruins.js` | 스토리 2~4 진행과 장면 |
| `source/mod_desktop.js` | PC판 전용: 일시정지·설정·진행 저장 |
| `desktop/` | PC판(Electron) 포장 · itch.io 업로드 (`desktop/README-itch.md`) |

고친 뒤 다시 빌드 (Node.js 18 이상):
```
cd source
npm install
npm run build        # index.html = 웹판 해상대전 (자기해제 압축)
npm run build:story  # source/story.html = 스토리 게임 (확인용, 저장소에 올리지 않음)
npm run build:raw    # 압축 없이 minify 만 (코드가 그대로 보임)
```

### 개발용 검증 도구 (선택)
`source/` 에는 헤드리스 Chromium(Playwright)으로 화면과 오류를 확인하는 스크립트도 들어 있습니다. `npm i -D playwright` 후 `source/` 에서 실행합니다.

| 명령 | 내용 |
|---|---|
| `node shot.js "step&mods=all&q=HIGH" out.png` | 소스(`dev.html`)를 바로 띄워 몇 프레임 렌더하고 오류·콘솔 출력 |
| `node shot.js "step&mods=all&q=LOW&scene=board" out.png` | 특정 장면(`scene=cruise·talk·hit·fall·news·crash·board·fight`)으로 바로 이동 |
| `node verify.js source/story.html` | 스토리 게임 빌드 검증 (먼저 `npm run build:story`): 등급 전환, 처음부터 엔딩까지 진행(총격전 자동 플레이), 패배 경로, 실시간 시작, 미지원 안내 |

`stubs.js` 는 일부 모듈만 띄울 때 빈자리를 채우는 대역이고, `CONTRACT.md` 는 모듈 간 약속(API·좌표계·렌더 순서)을 적은 문서입니다.

## 내 컴퓨터에서 실행하기
```
python tools/serve.py
```
그다음 브라우저에서 http://localhost:8123 접속. (주소 뒤에 `?q=ultra` · `?q=4` 처럼 등급 이름이나 번호를 붙이면 그 등급으로 고정 — 예전 `?q=LOW` / `?q=HIGH` 도 됨)
