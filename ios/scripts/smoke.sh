#!/bin/bash
# iOS Simulator 연기 시험 (CI: .github/workflows/ios.yml) — 앱을 설치하고 자동 시험 인자(--skw-selftest, SelfTest.swift)로 네 번 켠다.
#
#   bash ios/scripts/smoke.sh <시뮬레이터 UDID> <SecondKoreanWars.app 경로> [결과 폴더 (기본 build/smoke)]
#
#   1) main      게임이 뜨면 페이지 안에서 확인 (보안 출처 · WebGPU · 다리 · 자동 업데이트 · 설정의 버전 줄) + localStorage 에 표시를 씀
#                → 화면 사진 → 다른 앱(설정)으로 넘겨 뒤로 보냄(일시정지 고리) → 앱 끄기
#   2) relaunch  다시 켜서 1) 에서 쓴 localStorage 표시가 남아 있는지
#   3) nogpu     navigator.gpu 를 지운 채로 → 게임의 "WebGPU 를 사용할 수 없습니다" 안내 화면 + 화면 사진
#   4) file      비교용: skw:// 대신 file:// 로 띄웠을 때의 보안 출처 · WebGPU (실패해도 시험은 계속)
# 결과 JSON 은 앱이 Library/Caches/skw-selftest-<이름>.json 에 쓰고(콘솔에도 SKW-SELFTEST 한 줄), check-selftest.js 가 판정한다.
# 화면 사진은 작은 JPEG 를 base64 로 로그에 찍는다 (SKW-SCREENSHOT-BEGIN … END 사이) — 로그만 보고도 풀어 볼 수 있게.
set -uo pipefail
UDID=$1
APP=$2
OUT=${3:-build/smoke}
BID=com.secondkoreanwars.game
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"

xcrun simctl install "$UDID" "$APP" || { echo "::error::앱 설치 실패"; exit 1; }
DATA=$(xcrun simctl get_app_container "$UDID" "$BID" data)
CACHES="$DATA/Library/Caches"
NONCE="skw$(date +%s)$RANDOM"
echo "앱 데이터 폴더: $DATA · localStorage 표시: $NONCE"

launch() { # 이름, 인자… → 결과 파일이 생길 때까지 (최대 300초)
  local name=$1; shift
  rm -f "$CACHES/skw-selftest-$name.json"
  xcrun simctl terminate "$UDID" "$BID" >/dev/null 2>&1 || true
  xcrun simctl launch --console-pty --terminate-running-process "$UDID" "$BID" --skw-selftest "--skw-selftest-out=$name" "$@" \
    > "$OUT/console-$name.log" 2>&1 &
  echo $! > "$OUT/pid-$name"
  local t=0
  while [ ! -s "$CACHES/skw-selftest-$name.json" ]; do
    sleep 2; t=$((t + 2))
    if [ $t -ge 300 ]; then
      echo "::warning::self-test $name: ${t}초 안에 결과가 없음"
      tail -n 60 "$OUT/console-$name.log"
      return 1
    fi
  done
  sleep 1
  cp "$CACHES/skw-selftest-$name.json" "$OUT/$name.json"
  echo "self-test $name: ${t}초 만에 결과"
}

stop() {
  xcrun simctl terminate "$UDID" "$BID" >/dev/null 2>&1 || true
  sleep 1
  kill "$(cat "$OUT/pid-$1" 2>/dev/null)" >/dev/null 2>&1 || true
}

shot() { # 화면 사진 → 480px JPEG → base64 (로그)
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/$1.png" >/dev/null 2>&1 || { echo "(사진 실패: $1)"; return 0; }
  sips -Z 480 -s format jpeg -s formatOptions 40 "$OUT/$1.png" --out "$OUT/$1.jpg" >/dev/null
  echo "SKW-SCREENSHOT-BEGIN $1 $(stat -f%z "$OUT/$1.jpg") bytes"
  base64 -i "$OUT/$1.jpg" | fold -w 200
  echo "SKW-SCREENSHOT-END $1"
}

launch main "--skw-selftest-write=$NONCE"
MAIN=$?
sleep 3
shot main
# 뒤로 보내기: 다른 앱(설정)을 앞으로 → sceneWillResignActive → window.__skwIOS.pause() (콘솔에 lifecycle pause), WebKit 이 저장소를 디스크에 씀
xcrun simctl launch "$UDID" com.apple.Preferences >/dev/null 2>&1 || true
sleep 5
stop main
xcrun simctl terminate "$UDID" com.apple.Preferences >/dev/null 2>&1 || true

launch relaunch
stop relaunch

launch nogpu --skw-selftest-nogpu
sleep 2
shot nogpu
stop nogpu

launch file --skw-selftest-file || true
stop file

for n in main relaunch nogpu file; do
  echo "::group::콘솔 ($n)"
  grep -v '^SKW-SELFTEST ' "$OUT/console-$n.log" 2>/dev/null | tail -n 80
  echo "::endgroup::"
done

[ $MAIN -eq 0 ] || echo "::error::main 자동 시험이 끝나지 않았습니다"
node "$HERE/check-selftest.js" "$OUT" "$NONCE"
