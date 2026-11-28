#!/bin/bash
# iOS Simulator 연기 시험 (CI: .github/workflows/ios.yml) — 앱을 설치하고 자동 시험 인자(--skw-selftest, SelfTest.swift)로 다섯 번 켠다.
#
#   bash ios/scripts/smoke.sh <시뮬레이터 UDID> <SecondKoreanWars.app 경로> [결과 폴더 (기본 build/smoke)] [full | quick]
#   (quick: 1) 만 — iPad 처럼 다른 기기에서 켜지는지만 볼 때)
#
#   1) main      게임이 뜨면 페이지 안에서 확인 (보안 출처 · WebGPU · 다리 · 자동 업데이트 · 설정의 버전 줄) + localStorage 에 표시를 씀
#                → 화면 사진 → 다른 앱(설정)으로 넘겨 뒤로 보냄(일시정지 고리) → 앱 끄기
#   2) relaunch  다시 켜서 1) 에서 쓴 localStorage 표시가 남아 있는지
#   3) nogpu     navigator.gpu 를 지운 채로 → 게임의 "WebGPU 를 사용할 수 없습니다" 안내 화면 + 화면 사진
#   4) update    앱 번호를 1.5.0 으로 속여 켬 → 진짜 업데이트 주소(GitHub)에서 지금 게임을 받아(gzip · sha256) 켤 때 바로 적용하고
#                같은 skw://game 출처로 띄우는지 · 1) 에서 쓴 localStorage 가 그대로인지 (업데이트해도 진행이 남는지)
#   5) file      비교용: skw:// 대신 file:// 로 띄웠을 때의 보안 출처 · WebGPU (실패해도 시험은 계속)
# 1) 2) 3) 은 --skw-selftest-bundled: 피드(main)에 이 가지보다 새 게임이 있어도 늘 이 가지에서 빌드해 앱에 넣은 게임을 띄운다
#   (확인 · 받기는 그대로 하므로 check() 는 latest 또는 ready). 받아서 바꾸는 길은 4) 가 본다.
# 결과 JSON 은 앱이 Library/Caches/skw-selftest-<이름>.json 에 쓰고(콘솔에도 SKW-SELFTEST 한 줄), check-selftest.js 가 판정한다.
# 화면 사진은 결과 폴더에 작은 JPEG(480px)로 두고, ios.yml 의 마지막 단계가 base64 로 로그에 찍는다 (로그만 보고도 풀어 볼 수 있게).
set -uo pipefail
UDID=$1
APP=$2
OUT=${3:-build/smoke}
MODE=${4:-full}
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

shot() { # 화면 사진 → 480px JPEG (낮은 화질)
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/$1.png" >/dev/null 2>&1 || { echo "(사진 실패: $1)"; return 0; }
  sips -Z 480 -s format jpeg -s formatOptions 30 "$OUT/$1.png" --out "$OUT/$1.jpg" >/dev/null
  rm -f "$OUT/$1.png"
  echo "화면 사진 $1: $(stat -f%z "$OUT/$1.jpg") B"
}

launch main --skw-selftest-bundled "--skw-selftest-write=$NONCE"
MAIN=$?
sleep 3
shot main
# 뒤로 보내기: 다른 앱(설정)을 앞으로 → sceneWillResignActive → window.__skwIOS.pause() (콘솔에 lifecycle pause), WebKit 이 저장소를 디스크에 씀
xcrun simctl launch "$UDID" com.apple.Preferences >/dev/null 2>&1 || true
sleep 5
stop main
xcrun simctl terminate "$UDID" com.apple.Preferences >/dev/null 2>&1 || true

if [ "$MODE" = quick ]; then
  echo "::group::콘솔 (main)"; grep -v '^SKW-SELFTEST ' "$OUT/console-main.log" 2>/dev/null | tail -n 60; echo "::endgroup::"
  node "$HERE/check-selftest.js" "$OUT" "$NONCE" --quick | tee "$OUT/check.txt"
  exit "${PIPESTATUS[0]}"
fi

launch relaunch --skw-selftest-bundled
stop relaunch

launch nogpu --skw-selftest-bundled --skw-selftest-nogpu
sleep 2
shot nogpu
stop nogpu

# 앞의 실행이 이미 받아 둔 게임(피드가 앱보다 새것일 때)이 있으면 지워서, 이번 실행이 직접 받고 적용하는지 보게 한다
rm -rf "$DATA/Library/Application Support/game" "$DATA/Library/Application Support/update-seen"
launch update --skw-selftest-shell=1.5.0 --skw-selftest-wait=40
stop update

launch file --skw-selftest-file || true
stop file

for n in main relaunch nogpu update file; do
  echo "::group::콘솔 ($n)"
  grep -v '^SKW-SELFTEST ' "$OUT/console-$n.log" 2>/dev/null | tail -n 80
  echo "::endgroup::"
done

[ $MAIN -eq 0 ] || echo "::error::main 자동 시험이 끝나지 않았습니다"
node "$HERE/check-selftest.js" "$OUT" "$NONCE" | tee "$OUT/check.txt"
exit "${PIPESTATUS[0]}"
