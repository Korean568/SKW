# Second Korean Wars — 해상 반격 (WebGPU)

브라우저에서 돌아가는 3D 해상·공중 반격 슈팅/전술 게임 프로토타입입니다.
`index.html` **한 파일**로 동작합니다 — 외부 엔진·3D 모델·이미지·사운드 파일 없이 순수 JavaScript + WebGPU(WGSL) + Web Audio 만 사용합니다.

▶ **플레이: https://korean568.github.io/SKW/**  (PC · Chrome/Edge 최신 버전 권장)

## 조작법
| 키 | 동작 |
|---|---|
| W / S | 추력 올림 / 내림 |
| A / D | 조타 (좌 / 우) |
| 마우스 드래그 / 휠 | 시점 회전 / 줌 |
| Tab (또는 E) | 다음 표적 |
| Q | 가장 위협적인 표적 |
| Space | 미사일 발사 — 공중 표적은 대공(SAM), 수상·지상 표적은 대함(SSM) |
| F | 함포 사격 (수상·지상 표적) |
| P / Esc | 일시정지 |
| M | 음소거 |
| F2 | 그래픽 프리셋 순환 (자동 → LOW → MEDIUM → HIGH) |

CIWS(근접 방어)는 자동으로 작동합니다.

## 그래픽 등급 자동 감지
시작할 때 GPU 이름과 10프레임 벤치마크로 **LOW / MEDIUM / HIGH** 를 자동 선택합니다.
화면 우측 상단에 GPU 이름 · 등급 · FPS 가 표시되고, 버튼(또는 F2)으로 직접 바꿀 수 있습니다.
자동 모드에서 FPS 가 계속 낮으면 한 단계씩 스스로 낮춥니다.

## 소스와 빌드
`index.html` 은 `source/` 폴더의 읽기 쉬운 소스를 압축해 만든 결과물입니다 (직접 고치지 마세요).

| 파일 | 내용 |
|---|---|
| `source/core.js` | 엔진 코어: WebGPU 초기화, 품질 프리셋, 프레임 구성, 공용 셰이더 |
| `source/mod_gpu.js` | GPU 등급 감지(이름 판별 + 10프레임 벤치마크), 성능 표시 |
| `source/mod_sky.js` · `mod_post.js` | 하늘·구름 / 블룸·톤매핑 |
| `source/mod_ocean.js` | 바다 (파도·반사·거품·굴절·항적) |
| `source/mod_mesh.js` · `mod_models.js` | 메시 렌더러·그림자·섬 지형 / 함정·전투기·미사일 모델 |
| `source/mod_fx.js` | GPU 파티클 (화염·연기·물기둥·섬광·예광탄) |
| `source/mod_audio.js` | Web Audio 합성 사운드 |
| `source/mod_game.js` | 게임 진행·무장·적 AI·HUD — **시나리오는 맨 위 `G.SCENARIO` 표** |

고친 뒤 다시 빌드 (Node.js 18 이상):
```
cd source
npm install
npm run build
```

## 내 컴퓨터에서 실행하기
```
python tools/serve.py
```
그다음 브라우저에서 http://localhost:8123 접속. (주소 뒤에 `?q=LOW` / `?q=HIGH` 를 붙이면 등급 고정)
