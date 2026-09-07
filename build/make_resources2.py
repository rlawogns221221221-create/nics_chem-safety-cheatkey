#!/usr/bin/env python3
"""방제자원 두 갈래(업체 섭외 · 방제물품) → data/resources2.js

    python3 build/make_resources2.py

── 이것은 무엇인가 ──────────────────────────────────────────
`docs/방제자원_정리/통합/업체.csv`(1,717줄)·`물품.csv`(4,075줄) 를 화면이 읽는
자료로 옮깁니다. 그 두 파일은 사용자 분류안(PPT)대로 묶어 둔 **검토용**이고,
이 스크립트가 만드는 `data/resources2.js` 가 **③ 도구가 실제로 읽는 것**입니다.

── 좌표 ────────────────────────────────────────────────────
원자료에는 주소만 있고 좌표가 없습니다. 이 자리에서는 주소검색 서버에 닿지
않으므로 `build/geo_anchor.py` 로 **가진 자료만으로 낼 수 있는 가장 좁은
범위**를 잡습니다(도로명 → 읍·면·동 → 시·군·구 → 시·도). 정확도를 각 줄의
`ap` 에 실어 화면이 「대략」이라고 적습니다 — 어림값을 정확한 좌표처럼
보이게 하면 담당자가 그 자리로 사람을 보냅니다.

정확한 좌표는 `build/geocode.html` 을 인터넷 되는 PC에서 한 번 돌려
`data/resources2.geo.js` 를 만들면 화면이 그쪽을 먼저 씁니다.

── 자리(PLACE)를 따로 둔 이유 ───────────────────────────────
물품 4,075줄이 실제로는 **한 곳에 여러 물품**입니다(여수시청 한 곳에 흡착포·
보호복·굴착기…). 줄마다 주소·전화·좌표를 되풀이하면 파일이 세 배가 되고,
지도도 같은 자리에 마커를 여러 개 찍습니다. 그래서 자리는 `RES2_PLACE` 에
한 번만 두고 각 줄이 그 번호(`p`)를 가리킵니다.

── 개인정보 ────────────────────────────────────────────────
담당자 이름·휴대전화는 넣지 않습니다. 만들어진 파일에 `010-…` 꼴이 하나라도
있으면 **파일을 쓰지 않고 멈춥니다**(make_resources.py 와 같은 규칙).
"""
import csv
import json
import pathlib
import re
import sys
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from geo_anchor import Anchor                                  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "방제자원_정리" / "통합"
OUT = ROOT / "data" / "resources2.js"

# 갈래 차례 — 분류안(PPT)의 차례. 급할 때 눈이 가는 순서라 바꾸지 마세요.
# 중간처분은 소각·중화를 나누지 않고 하나입니다(2026-09-07 사용자 결정) —
# 담당자가 고르는 것은 "처분을 맡길 곳" 하나이고, 소각인지 중화인지는
# 각 줄의 허가현황에 원문이 그대로 남습니다.
# id 는 화면이 CSS 갈래(.r2-carry …)와 거르개 열쇠로 쓰는 이름입니다 —
# 한글 이름에 '·' 나 괄호가 들어 있어 그대로 쓸 수 없습니다.
갈래표 = [
    ("carry", "수집·운반", "car", "사고현장의 폐기물·폐액을 실어 나갈 곳입니다. 가장 먼저 부릅니다"),
    ("mid", "중간처분", "burn", "소각·중화 등으로 처분합니다. 허가현황에 소각인지 중화인지 적혀 있습니다"),
    ("recy", "종합재활용", "recycle", "회수한 것을 재활용으로 처리합니다"),
    ("land", "최종처분(매립)", "bury", "재활용·소각이 안 되는 것을 매립합니다"),
    ("heavy", "중장비", "dig", "굴착기·크레인 등 중장비를 부릅니다"),
    ("toxgas", "독성가스", "gas", "누출된 독성가스를 회수·처리합니다"),
    ("wwater", "폐수 수탁처리", "water", "폐산·중금속 폐수 등을 받아 처리합니다(물환경보전법 허가)"),
]
# 물품 분류 차례와 그림 — 27가지 이름이 이 일곱 묶음에 들어갑니다
분류표 = [
    ("gear", "보호구", "gear"),
    ("chem", "흡착·중화", "chem"),
    ("car", "차량·중장비", "car"),
    ("tool", "작업도구", "tool"),
    ("people", "인력", "people"),
    ("caps", "특수", "capsule"),
    ("etc", "기타", "stock"),
]
권역차례 = ["수도권", "강원권역", "충청권역", "경상권역", "전라권역"]

# 물품을 가진 곳의 종류 — 물품 갈래에서 **지도 마커의 색**이 됩니다.
# "무엇이 있는가"는 목록이 말하고, 지도는 "누가 가지고 있는가"를 말합니다.
# 지자체에 전화하는 일과 사업장에 협조를 구하는 일은 절차가 다르므로,
# 급할 때 그 구분이 색으로 보이는 것이 도움이 됩니다.
보유처표 = [
    ("gov", "지자체", "local"),
    ("plant", "사업장", "burn"),
    ("envbox", "환경청·센터 장비함", "stock"),
    ("nat", "국가기관 비축", "marine"),
    ("shop", "판매업체", "car"),
]

휴대전화 = re.compile(r"\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b")


def fail(msg):
    sys.exit("\n중단: " + msg + "\n")


def read(name):
    with (SRC / name).open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def 시도뽑기(주소):
    m = re.match(r"\s*([가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도))", str(주소 or ""))
    return m.group(1) if m else ""


def 주소줄이기(주소, 시도, 시군구):
    """목록에 적을 주소 — 앞의 시·도·시군구는 이미 옆 칸에 있어 떼어 냅니다."""
    a = re.sub(r"\s+", " ", str(주소 or "")).strip()
    for p in (시도, 시군구):
        if p and a.startswith(p):
            a = a[len(p):].strip()
    # "전북특별자치도" 처럼 줄임말로 적힌 경우도 떼어 낸다
    a = re.sub(r"^(전북|전남|경북|경남|충북|충남|강원|경기|제주)(특별자치도|도)?\s+", "", a)
    return a


def 권역쪼개기(값):
    out = []
    for x in re.split(r"[·,/]", str(값 or "")):
        x = x.strip()
        if x and x not in out:
            out.append(x)
    return sorted(out, key=lambda x: 권역차례.index(x) if x in 권역차례 else 99)


def 숫자(v):
    s = str(v or "").replace(",", "").strip()
    if not s:
        return ""
    try:
        n = float(s)
    except ValueError:
        return ""
    return int(n) if n == int(n) else round(n, 2)


class 자리표:
    """같은 곳을 한 번만 싣습니다 — 줄마다 주소·좌표를 되풀이하지 않게."""

    def __init__(self, anchor):
        self.a = anchor
        self.rows = []
        self.idx = {}

    def 넣기(self, 이름, 시도, 주소, 전화, 권역, 종류="", 시군구칸=""):
        시도 = (시도 or "").strip() or 시도뽑기(주소)
        # 시·군·구 칸을 먼저 씁니다 — 통합 자료는 이 칸을 원자료에서 확인해
        # 채워 두었습니다. 주소에서 다시 뽑으려 하면 "전남 여수시 …" 처럼
        # 시·도가 줄임말로 적힌 줄에서 실패해 시·도 대표점(오차 수십 km)으로
        # 떨어집니다(처음에 그렇게 만들었다가 1,374곳이 그리 되었습니다).
        시군구 = self.a.sgg_name(시도, (시군구칸 or "").strip(), 주소) if 시도 else ""
        la, lo, ap = self.a.find(시도, 시군구, 주소) if 시도 else (None, None, "")
        키 = (이름, 시도, 시군구, re.sub(r"\s+", "", str(주소 or "")), 전화)
        if 키 in self.idx:
            i = self.idx[키]
            # 권역은 자료마다 한쪽만 적혀 있을 수 있어 합칩니다
            있는것 = self.rows[i]["rg"]
            for g in 권역:
                if g not in 있는것:
                    있는것.append(g)
            return i
        row = {
            "n": 이름, "sd": 시도, "sg": 시군구,
            "a": 주소줄이기(주소, 시도, 시군구),
            "tel": (전화 or "").strip(),
            "rg": list(권역),
        }
        if 종류:
            row["ht"] = 종류
        if la is not None:
            row["la"], row["lo"], row["ap"] = la, lo, ap
        self.rows.append(row)
        self.idx[키] = len(self.rows) - 1
        return len(self.rows) - 1


def main():
    for f in ("업체.csv", "물품.csv"):
        if not (SRC / f).exists():
            fail(f"{SRC / f} 가 없습니다. python3 build/방제자원_통합.py 를 먼저 돌리세요.")

    anchor = Anchor()
    자리 = 자리표(anchor)
    갈래id = {이름: i for i, 이름, _, _ in 갈래표}
    분류id = {이름: i for i, 이름, _ in 분류표}
    보유처id = {이름: i for i, 이름, _ in 보유처표}

    # ── 업체 섭외 ────────────────────────────────────────────
    업체 = []
    for r in read("업체.csv"):
        갈래 = (r.get("갈래") or "").strip()
        이름 = (r.get("업체명") or "").strip()
        if not 이름:
            continue
        p = 자리.넣기(이름, r.get("시도"), r.get("주소"), r.get("대표전화"),
                    권역쪼개기(r.get("찾을권역") or r.get("권역")),
                    시군구칸=r.get("시군구"))
        row = {"p": p, "k": 갈래id.get(갈래, 갈래)}
        # 미리 협의된 곳 — 화면에서 갈래마다 맨 위에 옵니다.
        # '협의 완료' 라는 말은 담당자가 모르므로 화면에는 쓰지 않습니다
        # (2026-09-07 사용자). 자료에는 표시만 두고 문구는 화면이 정합니다.
        if (r.get("협의권역") or "").strip():
            row["f"] = 1
            row["fg"] = 권역쪼개기(r.get("협의권역"))
        for 칸, 열쇠 in (("허가현황", "lic"), ("처리가능폐기물", "wst"),
                        ("보유장비", "eq"), ("확인못함", "nc")):
            v = re.sub(r"\s+", " ", str(r.get(칸) or "")).strip()
            if v:
                row[열쇠] = v
        업체.append(row)

    # ── 방제물품 ─────────────────────────────────────────────
    물품이름 = []
    이름번호 = {}
    물품 = []
    for r in read("물품.csv"):
        이름 = (r.get("물품명") or "").strip()
        보유처 = (r.get("보유처") or "").strip()
        if not (이름 and 보유처):
            continue
        if 이름 not in 이름번호:
            이름번호[이름] = len(물품이름)
            분류 = (r.get("분류") or "").strip()
            물품이름.append({"이름": 이름, "분류": 분류,
                             "cl": 분류id.get(분류, "etc"), "n": 0})
        물품이름[이름번호[이름]]["n"] += 1
        p = 자리.넣기(보유처, r.get("시도"), r.get("주소"), r.get("대표전화"),
                    권역쪼개기(r.get("권역")),
                    보유처id.get((r.get("보유처종류") or "").strip(), "etc"),
                    시군구칸=r.get("시군구"))
        row = {"p": p, "i": 이름번호[이름]}
        q = 숫자(r.get("개수"))
        if q != "":
            row["q"] = q
        for 칸, 열쇠 in (("단위", "u"), ("원래이름", "o")):
            v = (r.get(칸) or "").strip()
            if v:
                row[열쇠] = v
        물품.append(row)

    # 이름 차례 — 분류 차례를 먼저 따르고, 같은 분류 안에서는 많은 것부터.
    # 급할 때 고르는 칩이라 자주 쓰는 것이 앞에 와야 합니다.
    분류순 = {이름: n for n, (_, 이름, _) in enumerate(분류표)}
    차례 = sorted(range(len(물품이름)),
                key=lambda i: (분류순.get(물품이름[i]["분류"], 99), -물품이름[i]["n"]))
    새번호 = {old: new for new, old in enumerate(차례)}
    물품이름 = [물품이름[i] for i in 차례]
    for row in 물품:
        row["i"] = 새번호[row["i"]]

    # ── 검사 ─────────────────────────────────────────────────
    글 = json.dumps([자리.rows, 업체, 물품], ensure_ascii=False)
    if 휴대전화.search(글):
        fail("개인 휴대전화 꼴의 번호가 들어 있습니다. 원자료를 확인하세요.\n"
             f"      {휴대전화.search(글).group(0)}")

    좌표없음 = sum(1 for p in 자리.rows if "la" not in p)
    갈래건수 = {}
    for row in 업체:
        갈래건수[row["k"]] = 갈래건수.get(row["k"], 0) + 1
    모르는갈래 = [k for k in 갈래건수 if k not in [g[0] for g in 갈래표]]
    if 모르는갈래:
        fail("갈래표에 없는 갈래가 있습니다: " + ", ".join(모르는갈래)
             + "\n      build/make_resources2.py 의 갈래표에 넣거나 통합 자료를 고치세요.")

    보유처건수 = {}
    for row in 물품:
        h = 자리.rows[row["p"]].get("ht", "etc")
        보유처건수[h] = 보유처건수.get(h, 0) + 1
    모르는보유처 = [h for h in 보유처건수 if h not in [x[0] for x in 보유처표]]
    if 모르는보유처:
        fail("보유처표에 없는 보유처종류가 있습니다: " + ", ".join(모르는보유처)
             + "\n      build/make_resources2.py 의 보유처표에 넣으세요.")

    오늘 = date.today().isoformat()
    meta = {
        "기준일": 오늘,
        "업체건수": len(업체), "물품건수": len(물품), "자리건수": len(자리.rows),
        "좌표": "주소로 잡은 어림값 — 정확도는 각 자리의 ap 값 참고",
        "좌표없음": 좌표없음,
        "출처": "docs/방제자원_정리/통합 (업체.csv · 물품.csv) — 원자료 표 19개",
        "갈래별": 갈래건수,
        "협의된곳": sum(1 for r in 업체 if r.get("f")),
    }

    머리 = (
        "/* 방제자원 — 두 갈래(업체 섭외 · 방제물품)\n"
        "   담당자 개인 이름·휴대전화·이메일은 들어 있지 않습니다.\n"
        "   사업장·기관 대표번호(유선)만 싣습니다.\n"
        "\n"
        "   구조\n"
        "     RES2_PLACE  자리 = [{n 이름, sd 시도, sg 시군구, a 주소, tel 대표번호,\n"
        "                          rg [권역…], ht 보유처종류, la, lo, ap 좌표정확도}, …]\n"
        "     RES2_BIZ    업체 = [{p 자리번호, k 갈래, f 1이면 미리 협의된 곳,\n"
        "                          fg [협의권역…], lic 허가현황, wst 처리가능폐기물,\n"
        "                          eq 보유장비, nc 확인못함}, …]\n"
        "     RES2_ITEM   물품 = [{p 자리번호, i 물품이름번호, q 개수, u 단위,\n"
        "                          o 원래이름}, …]\n"
        "     RES2_CATS   갈래 7가지  ·  RES2_NAMES 물품 이름 27가지\n"
        "\n"
        "   ※ 같은 곳에 여러 물품이 있어 자리를 따로 두었습니다 — 줄마다 주소를\n"
        "     되풀이하지 않고, 지도에도 한 자리에 마커 하나만 찍습니다.\n"
        "   ※ 좌표는 주소로 잡은 어림값입니다. 화면이 「대략」이라고 적습니다.\n"
        "     정확한 좌표는 build/geocode.html → data/resources2.geo.js.\n"
        "   ※ 자동 생성 파일입니다. build/make_resources2.py 로 다시 만드세요.\n"
        f"   만든 날: {오늘} · 업체 {len(업체):,}줄 · 물품 {len(물품):,}줄 · 자리 {len(자리.rows):,}곳 */\n"
    )

    def js(name, val):
        return "var " + name + " = " + json.dumps(val, ensure_ascii=False) + ";\n"

    OUT.write_text(
        머리
        + js("RES2_META", meta)
        + js("RES2_REGIONS", 권역차례)
        + js("RES2_CATS", [{"id": i, "이름": nm, "ic": ic, "쓰임": u,
                            "n": 갈래건수.get(i, 0)} for i, nm, ic, u in 갈래표])
        + js("RES2_CLASSES", [{"id": i, "이름": nm, "ic": ic} for i, nm, ic in 분류표])
        + js("RES2_HOLDERS", [{"id": i, "이름": nm, "ic": ic,
                               "쓰임": "이 곳들이 가진 물품입니다",
                               "n": 보유처건수.get(i, 0)} for i, nm, ic in 보유처표])
        + js("RES2_NAMES", 물품이름)
        + js("RES2_PLACE", 자리.rows)
        + js("RES2_BIZ", 업체)
        + js("RES2_ITEM", 물품),
        encoding="utf-8")

    print(f"\n  업체 {len(업체):,}줄 · 물품 {len(물품):,}줄 · 자리 {len(자리.rows):,}곳")
    print("  갈래별 —", " · ".join(f"{nm} {갈래건수.get(i, 0):,}"
                                     for i, nm, _, _ in 갈래표))
    print("  좌표 정확도 —", " · ".join(f"{k} {v:,}" for k, v in anchor.stat.items() if v))
    print(f"  좌표를 못 잡은 자리 {좌표없음:,}곳 (지도에 찍지 않습니다)")
    print(f"  미리 협의된 곳 {meta['협의된곳']}줄")
    print(f"\n  {OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.0f} KB\n")


if __name__ == "__main__":
    main()
