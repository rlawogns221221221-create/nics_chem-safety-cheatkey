#!/usr/bin/env python3
"""원자료(source/*.xlsx) → 도구 데이터 파일(data/*.js) 재생성.

대피장소 목록이 갱신되면 source/ 의 엑셀을 교체하고 이 스크립트를 실행한 뒤,
data/version.js 의 대피장소_기준일 을 함께 수정하세요.

    pip install openpyxl
    python3 build/make_data.py
"""
import collections
import json
import pathlib
import sys

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "source"
OUT = ROOT / "data"

SHELTER_XLSX = SRC / "화학사고대피장소_목록_2026-05-19.xlsx"
CASE_XLSX = SRC / "화학사고_재난문자_실제발송사례.xlsx"
SHELTER_BASE_DATE = "2026-05-19"


def build_shelters() -> int:
    ws = openpyxl.load_workbook(SHELTER_XLSX, data_only=True)["전체 대피장소 목록"]
    tree: dict = collections.OrderedDict()

    for row in ws.iter_rows(min_row=2, values_only=True):
        sido, sgg, kind = row[1], row[2], row[4]
        name, detail, addr, cap, deleted = row[5], row[6], row[7], row[11], row[19]
        if deleted == "Y":
            continue
        addr = (addr or "").strip()
        for prefix in (f"{sido} {sgg} ", f"{sido} "):   # 시도·시군구는 키로 이미 알고 있음
            if addr.startswith(prefix):
                addr = addr[len(prefix):]
                break
        tree.setdefault(sido, collections.OrderedDict()).setdefault(sgg, []).append(
            [name or "", (detail or "").strip(), addr, int(cap or 0), kind or ""]
        )

    for sgg_map in tree.values():
        for items in sgg_map.values():
            items.sort(key=lambda x: x[0])

    total = sum(len(v) for m in tree.values() for v in m.values())
    meta = {
        "기준일자": SHELTER_BASE_DATE,
        "총건수": total,
        "시도수": len(tree),
        "시군구수": sum(len(m) for m in tree.values()),
        "출처": "화학물질안전원 화학사고 대피장소 목록",
        "필드": ["대피장소명", "상세시설명", "도로명주소(시도·시군구 제외)", "수용인원", "시설구분"],
    }

    with open(OUT / "shelters.js", "w", encoding="utf-8") as f:
        f.write(f"/* 화학사고 대피장소 — 원자료: {meta['출처']}(기준일 {SHELTER_BASE_DATE})\n")
        f.write("   구조: SHELTERS[시도][시군구] = [[장소명, 상세시설명, 도로명주소, 수용인원, 시설구분], ...]\n")
        f.write("   ※ 자동 생성 파일입니다. build/make_data.py 로 재생성하세요. */\n")
        f.write("var SHELTER_META = " + json.dumps(meta, ensure_ascii=False) + ";\n")
        f.write("var SHELTERS = " + json.dumps(tree, ensure_ascii=False, separators=(",", ":")) + ";\n")
    return total


MATERIALS = ["황산", "염산", "암모니아", "불소", "염화수소", "염소", "질산",
             "이산화황", "질소", "유독가스", "화학물질"]

END_WORDS = ["상황종료", "수습", "대응 완료", "대응완료", "조치 완료", "조치완료", "복귀",
             "불검출", "미검출", "안심", "종료", "우려없음", "없음을 알려"]
EVAC_WORDS = ["대피명령", "대피하여", "대피 하시", "대피바람", "대피하시", "으로 대피",
              "대피요망", "신속히 대피"]
INDOOR_WORDS = ["창문", "실내 대기", "실내대피", "외출", "접근"]


def classify(msg: str) -> str:
    if any(w in msg for w in END_WORDS):
        return "상황종료·경과"
    if any(w in msg for w in EVAC_WORDS):
        return "주민소산(대피)"
    if any(w in msg for w in INDOOR_WORDS):
        return "실내대피"
    if "우회" in msg:
        return "차량우회"
    return "기타"


def build_cases() -> int:
    ws = openpyxl.load_workbook(CASE_XLSX, data_only=True)["Sheet1"]
    msgs = [r[0].strip() for r in ws.iter_rows(min_row=2, values_only=True) if r[0]]
    cases = [{
        "물질": next((m for m in MATERIALS if m in t), "기타"),
        "단계": classify(t),
        "글자수": len(t),
        "본문": t,
    } for t in msgs]

    with open(OUT / "cases.js", "w", encoding="utf-8") as f:
        f.write("/* 화학사고 재난문자 실제 발송 사례 — 참고용(비승인 자료).\n")
        f.write("   ※ 실제 발송된 원문이며 표준(안)과 다르거나 오탈자가 포함될 수 있습니다. */\n")
        f.write("var CASES = " + json.dumps(cases, ensure_ascii=False, indent=0) + ";\n")
    return len(cases)


if __name__ == "__main__":
    for path in (SHELTER_XLSX, CASE_XLSX):
        if not path.exists():
            sys.exit(f"원자료를 찾을 수 없습니다: {path}")
    print(f"shelters.js  대피장소 {build_shelters():,}건")
    print(f"cases.js     발송사례 {build_cases()}건")
    print("완료. data/version.js 의 기준일도 함께 확인하세요.")
