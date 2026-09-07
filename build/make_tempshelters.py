#!/usr/bin/env python3
"""내려받은 이재민 임시주거시설 목록 파일 → data/tempshelters.js

    python3 build/make_tempshelters.py source/대피장소/이재민임시주거시설.csv
    python3 build/make_tempshelters.py 어떤파일.xlsx --sheet 1
    python3 build/make_tempshelters.py 오픈API로받은것.json

── 이것은 무엇인가 ──────────────────────────────────────────
공공데이터포털에서 자료를 **파일로 내려받았을 때** 쓰는 길입니다.
오픈API 로 받을 때는 build/fetch_tempshelter.html 을 쓰세요 — 둘은 같은 규칙으로
같은 결과를 만듭니다. 개발 자리에서는 포털 서버에 닿지 않아, 파일을 건네받는
이 길이 더 확실합니다.

── 어떤 파일이라야 하나 ─────────────────────────────────────
**시설 하나하나가 한 줄인 목록**이어야 합니다. 다음 칸이 있어야 합니다.

    시설명 · 주소(도로명 또는 지번) · 위도 · 경도

시·도별 개소·수용능력만 있는 **집계표로는 지도를 만들 수 없습니다.** 그런 표에는
시설의 이름도 주소도 좌표도 없어서, 어디에 점을 찍을지 알 수 없습니다.
없는 좌표를 지어내면 담당자가 그 자리로 사람을 보내게 되므로 만들지 않습니다.

── 칸 이름 ─────────────────────────────────────────────────
자료마다 칸 이름이 조금씩 다릅니다(시설명/명칭, 도로명주소/소재지도로명주소 …).
정해진 이름을 찾는 대신 규칙으로 고르고, **무엇을 무엇으로 읽었는지 화면에
그대로 찍습니다.** 잘못 짝지어졌으면 눈에 보여야 고칠 수 있습니다.
"""
import argparse
import csv
import json
import pathlib
import re
import sys
from datetime import date

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "tempshelters.js"

# (넣을 자리, 칸 이름을 찾는 규칙) — 위에서부터 먼저 맞는 칸을 가져갑니다
#
# safetydata.go.kr 의 오픈API 는 칸 이름이 영문 약어(FCLT_NM · RONA_DADDR · LAT · LOT
# …)입니다. 개발 자리에서 그 서버로 나갈 수 없어 실제 칸 이름을 확인하지 못했으므로,
# 흔한 약어까지 규칙에 넣어 두고 무엇을 무엇으로 읽었는지 화면에 그대로 찍습니다.
RULES = [
    ("시설명", r"시설명|명칭|장소명|건물명|(FCLT|SHLT|SHUNT|BLDG|PLC|FCLTY).*(NM|NAME)|^(NM|NAME)$"),
    ("시도", r"^(시도|시도명|광역시도|시\.도)$|^(CTPV|CTPRVN|SIDO|CTPV_NM|SIDO_NM)$"),
    ("시군구", r"^(시군구|시군구명|시\.군\.구)$|^(SGG|SGG_NM|SIGNGU|SIGNGU_NM|SIG_NM)$"),
    ("도로명", r"도로명|RONA|ROAD_?N?M?_?ADDR|RN_ADDR"),
    ("지번", r"지번|소재지지번|^주소$|소재지주소|LNM_ADDR|ADDR|ADRES|DADDR"),
    ("위도", r"위도|^lat|^(la|y|ycord|y_?crd)$|LATITUDE"),
    ("경도", r"경도|^(lon|lng)|^(lot|lo|x|xcord|x_?crd)$|LONGITUDE"),
    ("수용인원", r"수용|수용가능|최대수용|CPCTY|CAPA|ACPT_?PSN"),
    ("시설구분", r"시설구분|시설유형|시설종류|^구분$|^유형$|(FCLT|SHLT).*(SE|TY|KND|GBN|CD_NM)"),
    ("면적", r"면적|(^|_)AR(_|$)|AREA|TOT_?AR"),
    ("관리기관", r"관리기관|관리주체|기관명|담당기관|운영기관|(MNG|MNGT|OPER|INST|DEPT|CHRG).*(NM|NAME)"),
    ("전화", r"전화|연락처|번호|TELNO|^TEL|PHONE"),
]

# 코드 칸(SIG_CD 처럼 숫자만 든 칸)을 이름 자리에 넣으면 화면에 "41135" 가 찍힙니다.
# 이름을 찾는 자리에서는 처음부터 뺍니다.
CODE_COL = re.compile(r"(^|_)(CD|CODE|SN|ID|SEQ)$", re.I)
NO_CODE = {"시설명", "시도", "시군구", "시설구분", "관리기관"}

SIDO_FIX = {
    "서울": "서울특별시", "서울시": "서울특별시",
    "부산": "부산광역시", "대구": "대구광역시", "인천": "인천광역시",
    "광주": "광주광역시", "대전": "대전광역시", "울산": "울산광역시",
    "세종": "세종특별자치시", "세종시": "세종특별자치시", "세종특별시": "세종특별자치시",
    "경기": "경기도",
    "강원": "강원특별자치도", "강원도": "강원특별자치도",
    "충북": "충청북도", "충남": "충청남도",
    "전북": "전북특별자치도", "전라북도": "전북특별자치도",
    "전남": "전라남도", "경북": "경상북도", "경남": "경상남도",
    "제주": "제주특별자치도", "제주도": "제주특별자치도",
}


def fail(msg: str) -> None:
    sys.exit("\n중단: " + msg + "\n")


def shelters() -> dict:
    """화학사고 대피장소 자료의 지역 이름 — 여기에 맞춰야 같은 시·군·구로 묶인다."""
    text = (ROOT / "data" / "shelters.js").read_text(encoding="utf-8")
    m = re.search(r"var SHELTERS = (\{.*?\});\s*$", text, re.S)
    if not m:
        fail("data/shelters.js 를 읽지 못했습니다.")
    return json.loads(m.group(1))


# ── 파일 읽기 ────────────────────────────────────────────────
def rows_of_json(d):
    """오픈API 응답에서 줄이 담긴 자리를 찾는다 — 기관마다 다르다.
    safetydata.go.kr 는 body, 공공데이터포털은 data 에 담아 보낸다."""
    if isinstance(d, list):
        return d
    if not isinstance(d, dict):
        return []
    for key in ("body", "data"):
        v = d.get(key)
        if isinstance(v, list):
            return v
        if isinstance(v, dict) and isinstance(v.get("items"), list):
            return v["items"]
    body = (d.get("response") or {}).get("body") or {}
    items = body.get("items")
    if isinstance(items, list):
        return items
    if isinstance(items, dict):
        it = items.get("item")
        if isinstance(it, list):
            return it
        if isinstance(it, dict):
            return [it]
    return []


def read_rows(path: pathlib.Path, sheet: int) -> list:
    if path.suffix.lower() == ".json":
        d = json.loads(path.read_text(encoding="utf-8"))
        # 서버가 200 으로 답하면서 몸통에 오류를 담아 보내는 경우가 많다
        # (인증키 미승인·한도 초과). 그것을 "0줄"로 넘기면 왜 빈지 알 수 없다.
        head = (d.get("header") if isinstance(d, dict) else None) \
            or ((d.get("response") or {}).get("header") if isinstance(d, dict) else None) or {}
        code = str(head.get("resultCode", "")).strip()
        msg = str(head.get("resultMsg") or head.get("errorMsg") or "").strip()
        if code and code not in ("00", "0") and not re.match(r"^정상|NORMAL", msg, re.I):
            fail(f"서버가 오류를 돌려준 응답입니다 — {code} {msg}")
        rows = rows_of_json(d)
        if not rows:
            fail("줄이 담긴 자리를 찾지 못했습니다.\n"
                 f"      파일 첫머리: {json.dumps(d, ensure_ascii=False)[:300]}")
        return [r for r in rows if isinstance(r, dict)]

    if path.suffix.lower() in (".xlsx", ".xlsm"):
        try:
            import openpyxl
        except ImportError:
            fail("xlsx 를 읽으려면 openpyxl 이 필요합니다:  pip install openpyxl")
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.worksheets[sheet]
        rows = list(ws.values)
        if not rows:
            fail("빈 시트입니다.")
        head = [str(c).strip() if c is not None else "" for c in rows[0]]
        return [dict(zip(head, r)) for r in rows[1:]]

    # csv — 포털 파일은 대개 euc-kr(cp949) 입니다
    for enc in ("utf-8-sig", "cp949", "utf-8"):
        try:
            with path.open(encoding=enc, newline="") as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    fail("글자 인코딩을 알 수 없습니다 (utf-8·cp949 로 열어 봤습니다).")


def map_cols(cols: list) -> dict:
    got, used = {}, set()
    for name, pat in RULES:
        rx = re.compile(pat, re.I)
        for c in cols:
            if not c or c in used:
                continue
            if name in NO_CODE and CODE_COL.search(c):
                continue
            if rx.search(c):
                got[name] = c
                used.add(c)
                break
    return got


def val(row: dict, mapping: dict, name: str) -> str:
    c = mapping.get(name)
    v = row.get(c) if c else ""
    return "" if v is None else str(v).strip()


def fix_sido(x: str, S: dict) -> str:
    s = (x or "").strip()
    if s in S:
        return s
    if s in SIDO_FIX:
        return SIDO_FIX[s]
    head = s.split()[0] if s.split() else ""
    return head if head in S else SIDO_FIX.get(head, head)


def fix_sgg(sido: str, cand: str, addr: str, S: dict) -> str:
    pool = S.get(sido, {})
    toks = (addr or "").split()
    tries = [cand.strip()] if cand else []
    for i in range(min(len(toks), 4)):
        tries.append(toks[i])
        if i + 1 < len(toks):
            tries.append(toks[i] + " " + toks[i + 1])
    for t in tries:
        if t in pool:
            return t
    # 세종은 대피장소 자료의 시·군·구 칸이 비어 있어 열쇠가 "null" 이다
    if sido == "세종특별자치시":
        return "null" if "null" in pool else sido
    for t in tries:
        if t and t != sido and t not in SIDO_FIX and t not in S \
           and len(t) >= 2 and t[-1] in "시군구":
            return t
    return cand or ""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("파일", help="내려받은 목록 파일 (csv · xlsx · 오픈API json)")
    ap.add_argument("--sheet", type=int, default=0, help="xlsx 시트 번호 (0부터)")
    args = ap.parse_args()

    path = pathlib.Path(args.파일)
    if not path.exists():
        fail(f"파일이 없습니다: {path}")

    rows = read_rows(path, args.sheet)
    if not rows:
        fail("줄이 하나도 없습니다.")
    cols = [c for c in rows[0].keys() if c]
    mapping = map_cols(cols)

    print(f"\n{path.name} — {len(rows):,}줄\n")
    print("  칸 짝짓기")
    for name, _ in RULES:
        print(f"    {name:8} ← {mapping.get(name) or '원자료에 없음'}")
    rest = [c for c in cols if c not in mapping.values()]
    print(f"    {'안 쓴 칸':8} ← {', '.join(rest) or '없음'}\n")

    if not mapping.get("시설명") or not mapping.get("위도") or not mapping.get("경도"):
        fail("시설명·위도·경도 칸을 찾지 못했습니다.\n"
             "      시설 하나하나가 한 줄인 목록 자료라야 합니다.\n"
             f"      이 파일의 칸: {', '.join(cols)}")

    S = shelters()
    out, n, no_xy, no_name = {}, 0, 0, 0
    for r in rows:
        name = val(r, mapping, "시설명")
        if not name:
            no_name += 1
            continue
        addr = val(r, mapping, "도로명") or val(r, mapping, "지번")
        try:
            la, lo = float(val(r, mapping, "위도")), float(val(r, mapping, "경도"))
        except ValueError:
            no_xy += 1
            continue
        if not (32 < la < 40 and 123 < lo < 133):
            no_xy += 1
            continue
        sido = fix_sido(val(r, mapping, "시도") or addr, S)
        if not sido:
            no_xy += 1
            continue
        sgg = fix_sgg(sido, val(r, mapping, "시군구"), addr, S)
        cap = re.sub(r"[^0-9]", "", val(r, mapping, "수용인원"))
        area = val(r, mapping, "면적")
        out.setdefault(sido, {}).setdefault(sgg, []).append([
            name,
            area + "㎡" if area else "",
            addr,
            int(cap) if cap else "",
            val(r, mapping, "시설구분"),
            round(la, 5), round(lo, 5),
            val(r, mapping, "관리기관"),
            val(r, mapping, "전화"),
        ])
        n += 1

    if not n:
        fail("지도에 찍을 수 있는 줄이 하나도 없습니다 (좌표가 모두 비어 있습니다).")

    for sd in out:
        for sg in out[sd]:
            out[sd][sg].sort(key=lambda x: str(x[0]))

    today = date.today().isoformat()
    meta = {
        "받은날": today, "총건수": n, "원자료건수": len(rows),
        "출처": "행정안전부 이재민 임시주거시설",
        "원본파일": path.name,
        "필드": ["시설명", "면적", "주소", "최대수용인원", "시설구분",
                 "위도", "경도", "관리기관", "전화"],
    }
    head = (
        "/* 이재민 임시주거시설 — 원자료: 행정안전부 이재민 임시주거시설\n"
        f"     내려받은 파일: {path.name}\n"
        "   구조: TEMPSHELTERS[시도][시군구] =\n"
        "     [[시설명, 면적, 주소, 최대수용인원, 시설구분, 위도, 경도, 관리기관, 전화], ...]\n"
        "   화학사고 대피장소(data/shelters.js)와 같은 줄 구조라 같은 화면에서 함께 씁니다.\n"
        "   ※ 좌표가 없는 줄은 지도에 찍을 수 없어 뺐습니다.\n"
        "   ※ 자동 생성 파일입니다. build/make_tempshelters.py 로 다시 만드세요.\n"
        f"   만든 날: {today}  ·  실은 줄 {n:,} / 받은 줄 {len(rows):,} */\n"
    )
    OUT.write_text(
        head
        + "var TEMPSHELTER_META = " + json.dumps(meta, ensure_ascii=False) + ";\n"
        + "var TEMPSHELTERS = " + json.dumps(out, ensure_ascii=False) + ";\n",
        encoding="utf-8")

    print(f"  실은 줄 {n:,} / 받은 줄 {len(rows):,}"
          + (f" · 좌표 없어 뺀 줄 {no_xy:,}" if no_xy else "")
          + (f" · 이름 없어 뺀 줄 {no_name:,}" if no_name else ""))
    print("  시·도별 —", " · ".join(
        f"{sd} {sum(len(v) for v in out[sd].values()):,}" for sd in sorted(out)))
    print(f"\n  {OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.0f} KB")
    print("  → python3 build/build_single.py 로 단일 파일도 다시 만드세요.\n")


if __name__ == "__main__":
    main()
