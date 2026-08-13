#!/usr/bin/env python3
"""이재민 임시주거시설 시·도별 현황 → data/tempshelter.js

    python3 build/make_temp_shelters.py

── 왜 넣는가 ────────────────────────────────────────────────────
② 지도에 실린 '화학사고 대피장소'(1,849곳)는 화학사고 대비로 미리 지정해 둔
곳입니다. 그런데 실제로 주민이 그곳까지 가는 큰 화학사고는 아직 없었고,
실제 대피가 일어나면 주민은 **이재민 임시주거시설**로 갑니다(수해·지진 등에
쓰는 그 시설입니다). 화면이 화학사고 대피장소만 보여 주면, 담당자가 "우리
지역 대피처는 이게 전부"라고 오해하게 됩니다.

── 이 자료로 할 수 있는 것과 없는 것 ───────────────────────────
원자료(행정안전부 통계연보)는 **시·도별 집계표**입니다.
    17개 시·도 × 시설구분 3종 = 51줄
    각 줄: 개소 · 면적(㎡) · 수용능력(명)

  할 수 있다 — "이 시·도에 몇 개소, 몇 명을 수용할 수 있는가"
  할 수 없다 — **지도에 점을 찍는 것.** 개별 시설의 이름·주소·좌표가
                자료에 아예 없습니다.

그래서 지도 마커가 아니라 '한 줄 안내'로 넣습니다. 개별 위치까지 지도에
올리려면 공공데이터포털의 표준데이터(시설명·주소·위도·경도 포함)가 따로
필요합니다 — README 의 '이재민 임시주거시설' 항목 참고.
"""
import csv
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "source" / "대피장소" / "이재민_임시주거시설_지정현황_2024.csv"
OUT = ROOT / "data" / "tempshelter.js"

# 원자료의 시설구분 → 화면에 쓸 짧은 이름
KIND = {
    "이재민 임시주거시설": "이재민",
    "지진겸용 임시주거시설": "지진겸용",
    "마을회관": "마을회관",
}


def main():
    if not SRC.exists():
        raise SystemExit(f"원자료가 없습니다: {SRC}")

    rows = list(csv.DictReader(SRC.read_text(encoding="utf-8").splitlines()))
    by_sido, when = {}, ""
    for r in rows:
        sido = (r.get("지역") or "").strip()
        kind = KIND.get((r.get("시설구분") or "").strip())
        if not sido or not kind:
            continue
        when = when or (r.get("자료시점") or "").strip()
        d = by_sido.setdefault(sido, {})
        d[kind] = {
            "n": int(float(r["개소"] or 0)),
            "cap": int(float(r["수용능력"] or 0)),
            "m2": round(float(r["면적(제곱미터)"] or 0)),
        }

    total = {}
    for k in KIND.values():
        total[k] = {
            "n": sum(v.get(k, {}).get("n", 0) for v in by_sido.values()),
            "cap": sum(v.get(k, {}).get("cap", 0) for v in by_sido.values()),
        }

    meta = {
        "기준일": when,
        "출처": "행정안전부 통계연보 — 이재민 임시주거시설 지정 현황",
        "단위": "시·도별 집계 (개별 시설의 이름·주소·좌표는 이 자료에 없습니다)",
        "합계": total,
    }
    head = (
        "/* 이재민 임시주거시설 — 시·도별 현황\n"
        "\n"
        "   ② 지도에 실린 '화학사고 대피장소'는 화학사고 대비로 미리 지정해 둔\n"
        "   곳입니다. 실제로 주민이 그곳까지 가는 큰 화학사고는 아직 없었고,\n"
        "   실제 대피가 일어나면 주민은 이재민 임시주거시설로 갑니다.\n"
        "   화면이 화학사고 대피장소만 보여 주면 '우리 지역 대피처는 이게 전부'\n"
        "   라고 오해하게 되므로, 이 숫자를 한 줄로 함께 적습니다.\n"
        "\n"
        "   ※ 이 자료는 시·도별 집계표입니다. 개별 시설의 이름·주소·좌표가\n"
        "     없어 지도에 점으로 찍을 수 없습니다. 그래서 마커가 아니라\n"
        "     안내 한 줄로만 씁니다.\n"
        "\n"
        "   구조: TEMPSHELTER[시도] = { 이재민:{n,cap,m2}, 지진겸용:{…}, 마을회관:{…} }\n"
        "     n 개소  ·  cap 수용능력(명)  ·  m2 면적(㎡)\n"
        "\n"
        "   ※ 자동 생성 파일입니다. build/make_temp_shelters.py 로 재생성하세요. */\n"
    )
    body = [head]
    body.append("var TEMPSHELTER_META = " + json.dumps(meta, ensure_ascii=False) + ";")
    body.append("var TEMPSHELTER = " + json.dumps(by_sido, ensure_ascii=False) + ";")
    OUT.write_text("\n".join(body) + "\n", encoding="utf-8")

    print(f"{OUT.relative_to(ROOT)}  시·도 {len(by_sido)}곳  "
          f"{OUT.stat().st_size / 1024:.0f}KB")
    for k, v in total.items():
        print(f"   {k:<8} {v['n']:>6,}개소  수용 {v['cap']:>9,}명")
    print("   ※ 개별 시설 좌표가 없어 지도 마커가 아니라 안내 한 줄로 씁니다")


if __name__ == "__main__":
    main()
