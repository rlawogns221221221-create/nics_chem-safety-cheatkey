#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 화면 검증 — 실제 브라우저(Chromium)를 띄워 화면을 눌러 보고 확인합니다.
#
#     tests/run.sh              모두 (10분쯤 걸립니다)
#     tests/run.sh t2 addr      고른 것만
#     tests/run.sh -l           묶음 목록만 보기
#
# 화면을 고칠 때마다 관련 묶음을 돌리고, 커밋 전에는 모두 돌립니다.
# 실패가 하나라도 있으면 0이 아닌 값으로 끝납니다.
# ─────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")"
HERE=$(pwd)

ALL="t2 t8 t9 n1 n3 pinch widen mob bug1 car sms2 hand addr res2 tmp2 fetchpage"

declare -A WHAT=(
  [t2]="① 문자 도구 — 문안 생성·접기·글자수·모바일"
  [t8]="망분리용 단일 파일(dist) — 세 도구가 파일 하나로 도는가"
  [t9]="접근성·인쇄 — 대비·초점·터치영역·JS 꺼짐"
  [n1]="내 위치 — 권한 거부·신호 없음·시간 초과"
  [n3]="길찾기 — 실패해도 직선은 그린다"
  [pinch]="손가락 확대 — 세 지도 모두 실제 두 손가락 터치로"
  [widen]="범위 넓히기 단추 — 주변에 없을 때"
  [mob]="모바일 전체 — 세 도구 · 여러 화면폭"
  [bug1]="지도를 눌러 사고지점을 찍었을 때"
  [car]="차량·도보 소요시간 표시"
  [sms2]="① 발송 구분·하위 분류(도로 우회)"
  [hand]="② 지도 → ① 문자 이어쓰기"
  [addr]="주소·장소 검색"
  [res2]="③ 방제자원 — 시작 화면·조건·목록"
  [tmp2]="② 이재민 임시주거시설 층 (검증용 가짜 자료를 잠깐 넣고 돌립니다)"
  [fetchpage]="자료 받는 페이지 — 칸 짝짓기·지역 이름 맞추기"
)

if [ "${1:-}" = "-l" ]; then
  for n in $ALL; do printf "  %-10s %s\n" "$n" "${WHAT[$n]}"; done
  exit 0
fi

# ── 준비물 ───────────────────────────────────────────────────
# 이 저장소는 npm 을 쓰지 않습니다. 검증에만 playwright 가 필요해서,
# 이미지에 깔려 있는 것을 링크로 가져다 씁니다(없으면 그때 받습니다).
if [ ! -e node_modules/playwright ]; then
  mkdir -p node_modules
  G=$(npm root -g 2>/dev/null)
  if [ -n "$G" ] && [ -d "$G/playwright" ]; then
    ln -sfn "$G/playwright" node_modules/playwright
    echo "playwright — 이미 깔린 것을 가져다 씁니다 ($G)"
  else
    echo "playwright 를 받습니다…"
    npm i --silent playwright || { echo "playwright 설치 실패"; exit 2; }
  fi
fi
BROWSER=/opt/pw-browsers/chromium
[ -e "$BROWSER" ] || echo "※ $BROWSER 가 없습니다 — 스크립트의 executablePath 를 고쳐야 할 수 있습니다"

# 스크린샷·임시파일이 저장소를 어지럽히지 않게 여기서 돌립니다
mkdir -p .out

# ── 이재민 임시주거시설 자료가 필요한 묶음 ────────────────────
# 진짜 자료가 있으면 잠시 치워 두었다가 끝나고 그대로 되돌립니다.
DATA=../data/tempshelters.js
BAK=.out/tempshelters.real.bak
put_fixture() {
  [ -e "$DATA" ] && [ ! -L "$DATA" ] && cp "$DATA" "$BAK"
  cp fixtures/tempshelters.js "$DATA"
}
drop_fixture() {
  rm -f "$DATA"
  [ -e "$BAK" ] && mv "$BAK" "$DATA"
  return 0
}
trap drop_fixture EXIT

TARGETS="${*:-$ALL}"
FAILED=""
echo

for n in $TARGETS; do
  [ -f "$n.mjs" ] || { echo "그런 묶음이 없습니다: $n"; FAILED="$FAILED $n"; continue; }

  case "$n" in
    tmp2) put_fixture ;;                 # 자료가 있어야 층이 나온다
    *)    drop_fixture ;;                # 나머지는 자료 없는 상태(기본)에서
  esac

  OUT=$(cd .out && timeout 300 node "$HERE/$n.mjs" 2>&1 \
        | grep -v "ERR_TUNNEL_CONNECTION_FAILED\|ERR_CERT_AUTHORITY_INVALID\|net::ERR_")
  SUM=$(echo "$OUT" | grep -E "^(PASS|통과|화면 )" | head -1)
  BAD=$(echo "$OUT" | grep -E "^  (FAIL|✗)")
  printf "%-10s %s\n" "$n" "${SUM:-— 요약이 없습니다(스크립트 오류일 수 있음)}"
  if [ -n "$BAD" ] || [ -z "$SUM" ]; then
    echo "$OUT" | tail -25 | sed 's/^/    /'
    FAILED="$FAILED $n"
  fi
done

drop_fixture
echo
if [ -n "$FAILED" ]; then
  echo "실패:$FAILED"
  exit 1
fi
echo "모두 통과"
