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

ALL="t2 t8 t9 tok n1 n3 pinch widen mob bug1 car sms2 hand addr res2 tmp2 tmpbig fetchpage pwa"

declare -A WHAT=(
  [t2]="① 문자 도구 — 문안 생성·접기·글자수·모바일"
  [t8]="망분리용 단일 파일(dist) — 세 도구가 파일 하나로 도는가"
  [t9]="접근성·인쇄 — 대비·초점·터치영역·JS 꺼짐"
  [tok]="색·크기 이름 — 밝음·고대비 두 모드에서 값이 다 있는가"
  [n1]="내 위치 — 권한 거부·신호 없음·시간 초과"
  [n3]="길찾기 — 실패해도 직선은 그린다"
  [pinch]="손가락 확대 — 세 지도 모두 실제 두 손가락 터치로"
  [widen]="범위 넓히기 단추 — 주변에 없을 때"
  [mob]="모바일 전체 — 진입+세 도구 · 320~820px · 실제 상태까지"
  [bug1]="지도를 눌러 사고지점을 찍었을 때"
  [car]="차량·도보 소요시간 표시"
  [sms2]="① 발송 구분·하위 분류(도로 우회)"
  [hand]="② 지도 → ① 문자 이어쓰기"
  [addr]="주소·장소 검색"
  [res2]="③ 방제자원 — 시작 화면·조건·목록"
  [tmp2]="② 이재민 임시주거시설 층 (검증용 가짜 자료를 잠깐 넣고 돌립니다)"
  [tmpbig]="② 이재민 임시주거시설이 **실제 규모(만 이천 곳)**로 들어와도 지도가 버티는가"
  [fetchpage]="자료 받는 페이지 — 칸 짝짓기·지역 이름 맞추기"
  [pwa]="바탕화면 웹앱 — 진짜 서버를 띄워 설치·오프라인까지"
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

# ── 이재민 임시주거시설 자료 ──────────────────────────────────
# `tmp2` 는 값을 하나하나 대조하므로 **작은 fixture** 로 돌려야 합니다.
# 나머지 묶음은 **실제로 배포되는 상태**, 즉 진짜 자료가 있는 채로 돌립니다.
#
# ⚠ 예전에는 tmp2 를 뺀 모든 묶음에서 이 파일을 **지웠습니다**(자료가 없던
#   때의 기본 상태를 재현하려고). 자료가 들어온 뒤로는 그것이
#   **진짜 자료를 지워 버리는** 동작이 됩니다 — 되돌릴 백업이 아직 없는
#   첫 묶음에서 `rm` 만 돌기 때문입니다. 그래서 **시작할 때 한 번 백업**하고,
#   묶음마다 fixture 나 진짜 자료를 **복사해 넣는** 방식으로 바꿨습니다.
#
# ⚠⚠ **되돌리는 함수는 몇 번을 불러도 같아야 합니다.** 한 번은 마지막 묶음
#    뒤에서, 한 번은 EXIT 트랩에서 불립니다. 처음에 "백업이 없으면 지운다"로
#    적었더니, 첫 번째 호출이 백업을 치우고 두 번째 호출이 **진짜 자료를
#    지웠습니다**(실제로 그랬습니다 — 통과해 놓고 자료가 사라졌습니다).
#    그래서 **처음에 진짜 자료가 있었는지**를 따로 표시해 두고 그것만 봅니다.
DATA=../data/tempshelters.js
REAL=.out/tempshelters.real.bak
HAD=.out/tempshelters.had
rm -f "$REAL" "$HAD"
if [ -e "$DATA" ]; then cp "$DATA" "$REAL"; : > "$HAD"; fi
use_fixture() { cp fixtures/tempshelters.js "$DATA"; }
use_real() {
  if [ -e "$HAD" ]; then cp "$REAL" "$DATA"; else rm -f "$DATA"; fi
  return 0
}
restore_real() { use_real; }              # 몇 번을 불러도 같습니다
cleanup() { use_real; rm -f "$REAL" "$HAD"; return 0; }
trap cleanup EXIT

TARGETS="${*:-$ALL}"
FAILED=""
echo

for n in $TARGETS; do
  [ -f "$n.mjs" ] || { echo "그런 묶음이 없습니다: $n"; FAILED="$FAILED $n"; continue; }

  case "$n" in
    tmp2) use_fixture ;;                 # 값을 대조하므로 작은 fixture 로
    *)    use_real ;;                    # 나머지는 실제 배포 상태(진짜 자료)로
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

restore_real
echo
if [ -n "$FAILED" ]; then
  echo "실패:$FAILED"
  exit 1
fi
echo "모두 통과"
