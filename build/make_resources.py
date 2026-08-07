#!/usr/bin/env python3
"""방제자원 데이터 생성 — data/resources.js (공개판) · data/resources.internal.js (내부판)

    python3 build/make_resources.py            예시 자료로 두 파일 생성
    python3 build/make_resources.py --real     source/ 의 실제 엑셀에서 생성 (아직 미구현)

── 왜 두 벌인가 ──────────────────────────────────────────────
방제자원은 대부분 민간업체라 대표번호는 야간·휴일에 연결이 안 됩니다.
실제로 쓰이는 것은 담당자 직통인데, 그건 개인정보라 공개 배포에 넣을 수 없습니다.
그래서 "넣느냐 빼느냐"가 아니라 "누구에게 주느냐"로 나눴습니다.

    data/resources.js            업체명·주소·좌표·보유자원·대표번호   → 저장소에 올림
    data/resources.internal.js   + 담당자 이름·직통번호               → .gitignore, 내부망에만

화면·기능은 완전히 같고 데이터 파일만 다릅니다. 내부판으로 빌드하면
화면 상단에 "내부용 · 외부 공유 금지" 띠가 자동으로 뜹니다(res/app.js).

── 실제 자료로 바꿀 때 ────────────────────────────────────────
아래 SAMPLE_* 를 만드는 부분만 원본 엑셀 읽기로 바꾸면 됩니다.
출력 형식(RESOURCES 구조)은 그대로 두세요 — 화면 코드가 그 형식을 씁니다.

※ 좌표: 원본 자료에 위경도가 없고 주소만 있으므로, 인터넷이 되는 PC에서
  한 번 주소→좌표 변환(도로명주소 API·브이월드 지오코더 등)을 돌려
  결과를 데이터에 박아 넣어야 합니다. 변환에 실패한 건은 시·군·구 중심
  좌표로 대체하고 ap:false 로 표시하면 화면에 "대략 위치"라고 나옵니다.
"""
import argparse
import datetime
import json
import pathlib
import random
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_PUBLIC = ROOT / "data" / "resources.js"
OUT_INTERNAL = ROOT / "data" / "resources.internal.js"

# ── 자원 종류 ────────────────────────────────────────────────
# 코드는 화면(res/app.js)과 맞춰야 합니다.
KINDS = [
    ("waste",   "폐기물 처리업체",   "회수한 오염물·폐기물을 처리"),
    ("equip",   "방제장비 판매업체", "흡착재·중화제·보호구 조달"),
    ("heavy",   "중장비 업체",       "용기 이송·견인·굴착"),
    ("capsule", "비상캡슐 보유기관", "누출 봄베 밀봉·회수"),
]

# ── 예시 자료 재료 ───────────────────────────────────────────
# 실제 업체가 아님이 한눈에 보이도록 이름 앞에 (예시) 를 붙이고,
# 전화번호는 0000 형태로 둡니다. 실수로 진짜 자료처럼 쓰이면 안 됩니다.
SAMPLE_NAMES = {
    "waste": ["한빛환경", "대성환경산업", "정도환경", "그린사이클", "동방환경",
              "세아이엔씨", "청우환경", "미래에코", "삼주환경", "우리환경개발"],
    "equip": ["안전방재상사", "대한방재", "케미가드", "세이프텍", "한국방재산업",
              "동성안전", "프로텍코리아", "신우안전"],
    "heavy": ["대명중기", "성진크레인", "한강중장비", "우성기계", "삼호중기",
              "태영건설기계", "동아크레인", "제일중기"],
    "capsule": ["소방서", "시청 환경과", "군청 안전총괄과", "화학재난합동방재센터"],
}

SAMPLE_CAP = {
    "waste": [
        "지정폐기물 소각 · 일 50t · 폐유·폐산·폐알칼리",
        "지정폐기물 매립 · 일 120t · 폐석면 제외",
        "폐유 재활용 · 일 30t · 정제유 생산",
        "폐산·폐알칼리 중화 처리 · 일 40t",
        "일반+지정폐기물 수집운반 · 탱크로리 6대",
        "지정폐기물 소각 · 일 80t · 액상 전용 라인 보유",
    ],
    "equip": [
        "흡착포·흡착붐·중화제 · 24시간 출고",
        "레벨A 보호복·SCBA·방독면 · 재고 상시 보유",
        "오일펜스·유흡착재·방제펌프",
        "중화제(소석회·중탄산나트륨)·살수장비",
        "방폭 이송펌프·드럼·IBC 용기",
    ],
    "heavy": [
        "굴착기 5대 · 크레인 25t 2대 · 덤프 8대",
        "카고크레인 5t 3대 · 지게차 3t 4대",
        "견인차(대형) 2대 · 로우베드 트레일러 1대",
        "크레인 50t 1대 · 25t 2대 · 야간 출동 가능",
        "굴착기 3대 · 스키드로더 2대 · 살수차 1대",
    ],
    "capsule": [
        "비상캡슐 47L급 2기 · 100L급 1기",
        "비상캡슐 47L급 4기",
        "비상캡슐 47L급 3기 · 이송 트레일러 1대",
        "비상캡슐 100L급 2기 · 24시간 출동",
    ],
}

SAMPLE_SRC = {
    "waste": "폐기물처리업 허가대장",
    "equip": "방제장비 취급업체 현황",
    "heavy": "지자체 보유 중장비 업체 현황",
    "capsule": "가스 봄베 회수용 비상캡슐 보유현황",
}

# 담당자 — 내부판에만 들어갑니다. 예시라 실제 이름이 아닙니다.
SAMPLE_STAFF = ["김OO", "이OO", "박OO", "최OO", "정OO", "강OO", "조OO", "윤OO"]

# 예시 자료를 뿌릴 지역 — 화학사고가 잦은 산업단지 소재 시·군·구 위주
SAMPLE_REGIONS = [
    ("경기도", "안산시"), ("경기도", "화성시"), ("경기도", "평택시"),
    ("충청남도", "서산시"), ("충청남도", "당진시"), ("충청남도", "천안시"),
    ("울산광역시", "남구"), ("울산광역시", "울주군"),
    ("전라남도", "여수시"), ("전라남도", "광양시"),
    ("경상북도", "구미시"), ("경상북도", "포항시"),
    ("경상남도", "김해시"), ("인천광역시", "서구"),
]


def load_shelter_coords():
    """SHELTERS 에서 시·군·구별 실제 좌표를 빌려 온다.

    예시 자료도 지도에 그럴듯하게 찍혀야 거리 계산·정렬을 실제로 시험할 수
    있습니다. 좌표를 지어내면 바다 한가운데 찍히거나 거리가 엉뚱해집니다.
    """
    src = (ROOT / "data" / "shelters.js").read_text(encoding="utf-8")
    m = re.search(r"var SHELTERS\s*=\s*(\{.*?\});\s*$", src, re.S)
    if not m:
        sys.exit("data/shelters.js 에서 SHELTERS 를 찾지 못했습니다.")
    shelters = json.loads(m.group(1))

    out = {}
    for sido, sggs in shelters.items():
        for sgg, rows in sggs.items():
            pts = [(r[5], r[6]) for r in rows if r[5] is not None and r[6] is not None]
            if pts:
                out[(sido, sgg)] = pts
    return out


def make_sample():
    """예시 자료 생성 — 실제 자료로 바꿀 때는 이 함수만 갈아끼우면 됩니다."""
    rnd = random.Random(20260807)          # 돌릴 때마다 같은 결과가 나오도록 고정
    coords = load_shelter_coords()
    rows = []

    for sido, sgg in SAMPLE_REGIONS:
        pts = coords.get((sido, sgg))
        if not pts:
            continue
        for kind, _label, _why in KINDS:
            # 비상캡슐은 보유기관이라 시·군·구당 1곳, 나머지는 1~3곳
            n = 1 if kind == "capsule" else rnd.randint(1, 3)
            for i in range(n):
                lat, lon = rnd.choice(pts)
                # 대피장소 좌표 그대로 쓰면 겹치므로 반경 2km 안으로 흩뿌린다
                lat += rnd.uniform(-0.018, 0.018)
                lon += rnd.uniform(-0.022, 0.022)

                base = rnd.choice(SAMPLE_NAMES[kind])
                if kind == "capsule":
                    name = "(예시) %s %s" % (sgg, base)
                else:
                    name = "(예시) %s%s" % (base, "" if i == 0 else " %d공장" % (i + 1))

                # 일부러 일부는 좌표 변환 실패로 두어, 화면의 "대략 위치" 표시를
                # 실제로 시험할 수 있게 한다 (실제 자료에서도 반드시 생깁니다)
                approx = rnd.random() < 0.12

                rows.append({
                    "t": kind,
                    # 주소는 시·군·구를 뺀 나머지만 담습니다(SHELTERS 와 같은 규칙).
                    # 화면에서 "여수시 여수시 …" 처럼 겹쳐 나오지 않게 하려는 것입니다.
                    "n": name,
                    "a": "%s %s길 %d" % (rnd.choice(["산단로", "공단", "동", "읍", "면"]),
                                         rnd.choice("가나다라마바사"), rnd.randint(1, 300)),
                    "sd": sido,
                    "sg": sgg,
                    "la": round(lat, 5),
                    "lo": round(lon, 5),
                    "ap": not approx,
                    "c": rnd.choice(SAMPLE_CAP[kind]),
                    "tel": "%s-000-0000" % rnd.choice(["031", "041", "052", "061", "054", "055", "032"]),
                    "src": SAMPLE_SRC[kind],
                    # 담당자는 여기서 붙여 두고, 공개판을 쓸 때 떼어 냅니다
                    "_p": {"n": rnd.choice(SAMPLE_STAFF),
                           "t": "010-0000-%04d" % rnd.randint(0, 9999)},
                })

    rows.sort(key=lambda r: (r["sd"], r["sg"], r["t"], r["n"]))
    return rows


HEADER = """/* 화학사고 방제자원 — %(scope)s
   %(warn)s
   구조: RESOURCES = [{t, n, a, sd, sg, la, lo, ap, c, tel, src%(pfield)s}, ...]
     t   종류 — waste 폐기물처리 / equip 방제장비 / heavy 중장비 / capsule 비상캡슐
     n   업체·기관명          a  주소(시·군·구 제외)
     sd  시도                 sg 시군구
     la  위도                 lo 경도
     ap  좌표 정확 여부 — false 면 시·군·구 중심 좌표(화면에 "대략 위치"로 표시)
     c   보유·처리 능력 (원본 표기 그대로 · 검색 대상)
     tel 사업장 대표번호      src 출처 자료명%(pdesc)s
   ※ 자동 생성 파일입니다. build/make_resources.py 로 재생성하세요. */
"""

P_FIELD = ", p"
P_DESC = """
     p   담당자 {n:이름, t:직통번호} — 개인정보. 내부판에만 들어갑니다."""


def write(path, rows, internal, meta):
    body = []
    for r in rows:
        o = {k: v for k, v in r.items() if k != "_p"}
        if internal:
            o["p"] = r["_p"]
        body.append(json.dumps(o, ensure_ascii=False, separators=(",", ":")))

    head = HEADER % {
        "scope": "내부용 (담당자 직통 포함)" if internal else "공개용",
        "warn": ("※ 이 파일은 담당자 개인 연락처를 담고 있습니다. 저장소에 올리거나\n"
                 "      외부로 전달하지 마세요 (.gitignore 에 등록되어 있습니다)."
                 if internal else
                 "담당자 개인 이름·연락처는 넣지 않습니다. 사업장 대표번호만 표시합니다."),
        "pfield": P_FIELD if internal else "",
        "pdesc": P_DESC if internal else "",
    }

    meta = dict(meta, 담당자포함=internal)
    txt = (head
           + "var RESOURCE_META = " + json.dumps(meta, ensure_ascii=False) + ";\n"
           + "var RESOURCE_KINDS = " + json.dumps(
               [{"id": k, "이름": l, "쓰임": w} for k, l, w in KINDS], ensure_ascii=False) + ";\n"
           + "var RESOURCES = [\n" + ",\n".join(body) + "\n];\n")
    path.write_text(txt, encoding="utf-8")
    kb = len(txt.encode("utf-8")) / 1024
    print("%-34s %5d건  %6.0f KB%s"
          % (path.relative_to(ROOT), len(rows), kb, "  ← 개인정보 포함" if internal else ""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--real", action="store_true",
                    help="source/ 의 실제 엑셀에서 생성 (미구현 — 자료 확보 후 작성)")
    args = ap.parse_args()

    if args.real:
        sys.exit("실제 자료 변환은 아직 구현하지 않았습니다.\n"
                 "원본 엑셀을 source/ 에 두고 make_sample() 자리에 읽기 코드를 넣으세요.")

    rows = make_sample()
    meta = {
        "기준일": datetime.date.today().isoformat(),
        "예시자료": True,
        "총건수": len(rows),
        "출처": "예시 자료 — 실제 업체가 아닙니다",
    }
    write(OUT_PUBLIC, rows, False, meta)
    write(OUT_INTERNAL, rows, True, meta)
    print("→ 공개판은 저장소에 올라가고, 내부판(.internal.js)은 .gitignore 로 제외됩니다.")


if __name__ == "__main__":
    main()
