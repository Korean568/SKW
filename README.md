# Second Korean Wars — 스토리 1 · 서강시 : 전쟁의 시작 (대한민국편)

브라우저에서 돌아가는 1인칭 스토리 게임입니다. 플레이어는 **김민철 하사**.
휴가 중 탄 여객기가 북한 미사일에 맞아 추락하고, 비상착륙한 여객기 안팎에서 분대원들과 함께 북한군 50명과 싸웁니다.
`index.html` **한 파일**로 동작합니다 — 외부 엔진·3D 모델·이미지 없이 JavaScript + WebGPU(WGSL) + Web Audio 로 만들었고,
소리 파일은 사용자가 제공한 지상 접근 경보음(`source/snd_pullup.mp3`) 하나만 빌드 때 파일 안에 넣습니다.

▶ **플레이: https://korean568.github.io/SKW/**  (PC · Chrome/Edge 최신 버전 권장)

## 조작법
| 장면 | 키 | 동작 |
|---|---|---|
| 컷신 | 마우스 | 둘러보기 (화면을 클릭하면 마우스 고정) |
| 컷신 | Tab 누르고 있기 / 건너뛰기 | 대사 빨리 넘기기 (대사는 자동으로 넘어감) |
| 전투 | W A S D | 이동 |
| 전투 | 마우스 · 왼쪽 클릭 | 조준 · 사격 |
| 전투 | 오른쪽 클릭 | 정조준 |
| 전투 | R / E | 재장전 / 줍기 (쓰러진 북한군의 AK 소총·탄약) |
| 전투 | Shift / C | 달리기 / 앉기 |
| 공통 | F2 | 그래픽 프리셋 순환 (자동 → LOW → MEDIUM → HIGH) |

대본의 괄호 안 글자(행동)는 대사창에 넣지 않고 화면에서 연출하며, 해설은 대사창이 아닌 별도 자막으로 나옵니다.

## 그래픽 등급 자동 감지
시작할 때 GPU 이름과 10프레임 벤치마크로 **LOW / MEDIUM / HIGH** 를 자동 선택합니다.
화면 우측 상단의 작은 표시(GPU 이름 · 등급 · FPS)를 누르면 해상도 · GPU 시간과 프리셋 버튼이 펼쳐집니다 (F2 로도 전환).
프레임이 무거우면 먼저 렌더 해상도를 스스로 낮추고(동적 해상도), 그래도 부족하면 자동 모드에서 등급을 한 단계 내립니다.

## 소스와 빌드
`index.html` 은 `source/` 폴더의 읽기 쉬운 소스를 압축해 만든 결과물입니다 (직접 고치지 마세요).
용량을 줄이려고 minify 한 코드를 gzip 으로 한 번 더 묶어 넣고, 브라우저 내장 기능(`DecompressionStream`)으로 풀어 실행합니다 — 외부 라이브러리는 쓰지 않습니다.

| 파일 | 내용 |
|---|---|
| `source/core.js` | 엔진 코어: WebGPU 초기화, 품질 프리셋, 프레임 구성, 공용 셰이더 |
| `source/mod_gpu.js` | GPU 등급 감지(이름 판별 + 10프레임 벤치마크), 성능 표시 |
| `source/mod_sky.js` · `mod_post.js` | 하늘·구름(구름 위에서 내려다보기 포함)·먼 지상 / 블룸·톤매핑 |
| `source/mod_mesh.js` · `mod_fx.js` | 메시 렌더러·그림자 / GPU 파티클 (불·연기·폭발·예광탄) |
| `source/mod_audio.js` · `snd_pullup.mp3` | Web Audio 합성 사운드 · 지상 접근 경보 녹음 |
| `source/mod_people.js` | 사람: 매끈한 스키닝 캐릭터(국군·마스크 대령·북한군·승객), 자세·애니메이션, 1인칭 팔·총 |
| `source/mod_cabin.js` | 여객기 실내·외부, 피격 구멍·산소마스크·랜딩기어, 추락 현장 |
| `source/mod_story.js` | 스토리 1 진행: 타이틀, 대본(`G.STORY`), 대사·해설 자막, 연출, 엔딩 — **대본은 이 파일 위쪽 표** |
| `source/mod_fps.js` | 1인칭 총격전: 조작, 무기, 북한군 50명, 분대원, 전투 HUD |
| `source/story1.txt` | 원본 대본 |
| `source/mod_ocean.js` · `mod_models.js` · `mod_game.js` | 이전 해상 반격 임무 (`node build.js --naval` 로만 포함, `?mode=naval`) |

고친 뒤 다시 빌드 (Node.js 18 이상):
```
cd source
npm install
npm run build        # index.html (자기해제 압축)
npm run build:raw    # 압축 없이 minify 만 (코드가 그대로 보임)
```

### 개발용 검증 도구 (선택)
`source/` 에는 헤드리스 Chromium(Playwright)으로 화면과 오류를 확인하는 스크립트도 들어 있습니다. `npm i -D playwright` 후 `source/` 에서 실행합니다.

| 명령 | 내용 |
|---|---|
| `node shot.js "step&mods=all&q=HIGH" out.png` | 소스(`dev.html`)를 바로 띄워 몇 프레임 렌더하고 오류·콘솔 출력 |
| `node shot.js "step&mods=all&q=LOW&scene=board" out.png` | 특정 장면(`scene=cruise·talk·hit·fall·news·crash·board·fight`)으로 바로 이동 |
| `node verify.js index.html` | 빌드 결과 검증: 등급 전환, 처음부터 엔딩까지 진행(총격전 자동 플레이), 패배 경로, 실시간 시작, 미지원 안내 |

`stubs.js` 는 일부 모듈만 띄울 때 빈자리를 채우는 대역이고, `CONTRACT.md` 는 모듈 간 약속(API·좌표계·렌더 순서)을 적은 문서입니다.

## 내 컴퓨터에서 실행하기
```
python tools/serve.py
```
그다음 브라우저에서 http://localhost:8123 접속. (주소 뒤에 `?q=LOW` / `?q=HIGH` 를 붙이면 등급 고정)
