#!/usr/bin/env python3
"""광역별 긴급방제지원체계 사업장 현황(엑셀) → 표 18

    python3 build/긴급동원체계_표.py 받은엑셀.xlsx

사용자가 2026-11-18 건넨 「광역별 긴급방제지원체계 사업장 현황(11.3.)」 을
`docs/방제자원_정리/표/18_긴급동원체계_업체.csv` 로 옮깁니다. 그다음
`방제자원_통합.py` → `make_resources2.py` 를 돌리면 ③ 에 들어갑니다.

── 왜 이렇게 옮기나 ─────────────────────────────────────────
· **표의 권역 = 그 업체가 맡기로 한 권역(협의권역)** 입니다. 표 17 과 같은
  뜻입니다 — 선진무역(청주)이 강원권에도 적혀 있고, 세송유화텍(진천)이
  강원권에 있는 것과 같은 방식입니다. 같은 업체가 두 권역에 적혀 있으면
  한 줄로 합치고 권역을 이어 붙입니다.
· **휴대전화(010…)는 넣지 않습니다**(CLAUDE.md 2절 4항). 그 업체는 이름과
  주소만 남기고, 왜 번호가 없는지 `확인못함` 에 적습니다.
· **'미확인' 번호는 비웁니다** — 지어내지 않습니다(2절 3항).
· ㈜그린은 충청권(주소 없음)·경상권("포항")에도 적혀 있고, 표에는 여수
  ㈜그린 번호가 "장비가 같아 동일 업체로 추정" 이라고 붙어 있습니다.
  주소가 따로 없는 줄을 새 자리로 만들면 **어디인지 모르는 곳**을 지도에
  찍게 되므로, 여수 ㈜그린 줄에 **맡는 권역만** 더하고 추정이라고 적습니다.
· 시트에 상세주소가 없다고 표 스스로 적고 근거 칸에 본사 주소를 둔 두 곳
  (에스알 · 알트코리아)은 근거 칸의 주소를 씁니다 — 같은 파일 안의 값입니다.
· '전남광주통합특별시' 주소는 시·군·구로 광주광역시/전라남도를 가릅니다
  (임시주거시설 자료와 같은 규칙 · 6절). 다른 자료가 아직 옛 이름이라서.
"""
import csv
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "방제자원_정리" / "표" / "18_긴급동원체계_업체.csv"
기준 = "광역별 긴급방제지원체계 사업장 현황(2026-11-03 · 전화번호는 2026-11-18 인터넷 공개자료)"

휴대 = re.compile(r"\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b")
광주구 = ("동구", "서구", "남구", "북구", "광산구")
# 시 이름만 적힌 주소 — 이름이 하나뿐인 시라 기계로 풀어도 틀릴 수 없습니다
시만 = {"포항": "경상북도 포항시", "울산광역시": "울산광역시"}
# 시트에 상세주소가 없다고 표 스스로 적은 곳 — 근거 칸의 본사 주소
근거주소 = {
    "에스알": "전라남도 여수시 소라면 덕양삼거리길 5",
    "알트코리아": "울산광역시 남구 테크노산업로55번길 90",
}


# 표 17(허가증)과 이름 끝만 다른 같은 업체 — **주소·번호가 모두 같아**
# 기계로 합칠 수 있는 것만 둡니다. 이름이 비슷해도 주소가 다른 곳
# (㈜에스제이에코 ↔ (주)에스제이에코환경)은 합치지 않습니다 — 같은 곳인지 모릅니다.
같은업체 = {"㈜대성에코에너지": "㈜대성에코에너지센터"}


def 갈래(구분, 분야):
    g = re.sub(r"\s|ᆞ|·", "", 구분 or "")
    f = re.sub(r"\s", "", 분야 or "")
    if "판매" in g:
        return "방제물품 판매"
    if "수집" in g:
        return "수집·운반"
    if "폐수" in g:
        return "폐수 수탁처리"
    if "재활용" in g:
        return "종합재활용"
    if "처분" in g:
        return "최종처분(매립)" if "매립" in f else "중간처분"
    return ""


def 주소고치기(이름, 주소):
    a = re.sub(r"\s+", " ", (주소 or "").replace("\xa0", " ")).strip()
    if 이름 in 근거주소:
        return 근거주소[이름]
    a = 시만.get(a, a)
    a = a.replace("여수신 ", "여수시 ")          # 원표의 오타
    m = re.match(r"전남광주통합특별시\s+(\S+)", a)
    if m:
        a = ("광주광역시 " if m.group(1) in 광주구 else "전라남도 ") + a[len("전남광주통합특별시 "):]
    return a


def 전화(값):
    """공개 번호만 남깁니다. 휴대전화·미확인은 비웁니다."""
    s = str(값 or "").strip()
    if not s or s.startswith("미확인") or s == "-":
        return "", ""
    줄 = [x.strip() for x in s.split("\n") if x.strip()]
    남김 = [x for x in 줄 if not 휴대.search(x)]
    if not 남김:
        return "", "공개된 번호가 휴대전화뿐이라 넣지 않음"
    return " / ".join(남김), ""


def main():
    if len(sys.argv) < 2:
        sys.exit("쓰는 법: python3 build/긴급동원체계_표.py 받은엑셀.xlsx")
    import openpyxl
    ws = openpyxl.load_workbook(sys.argv[1], data_only=True).worksheets[0]
    줄들 = list(ws.iter_rows(values_only=True))
    머리 = [str(c or "").replace("\n", "") for c in 줄들[1]]

    def 칸(r, 앞):
        for i, h in enumerate(머리):
            if h.startswith(앞):
                return str(r[i] or "").strip()
        return ""

    권역 = ""
    모음 = []
    for r in 줄들[2:]:
        if r[0]:
            권역 = str(r[0]).strip()
        이름 = 칸(r, "사업장명")
        이름 = 같은업체.get(이름, 이름)
        if not 이름:
            continue
        g = 갈래(칸(r, "구분"), 칸(r, "전문처리분야"))
        if not g:
            continue
        번호, 왜 = 전화(칸(r, "대표"))
        확실 = 칸(r, "확실도")
        근거 = 칸(r, "근거")
        메모 = []
        if 왜:
            메모.append(왜)
        elif not 번호:
            메모.append("공개된 대표번호를 찾지 못함 — 올바로·지자체 확인 필요")
        elif 확실 in ("가능성 높음", "추측"):
            메모.append("번호 확실도: %s (%s)" % (확실, 근거))
        # 화성 광양처럼 지사 주소가 한 칸에 함께 적힌 곳 — 지사도 한 자리로
        원주소 = 칸(r, "지역")
        주소들 = [re.sub(r"^[^:]*지사\s*:\s*", "", x).strip()
                for x in 원주소.split("\n") if x.strip()] or [""]
        주소들 = [주소고치기(이름, x) for x in 주소들]
        번호들 = 번호.split(" / ") if 번호 else [""]
        for i, a in enumerate(주소들):
            nm = 이름 if i == 0 else 이름 + " 여수지사"
            tel = 번호들[i] if i < len(번호들) else 번호들[0]
            모음.append({
                "업체명": nm, "갈래": g, "협의권역": 권역, "주소": a,
                "대표전화": re.sub(r"\s*\(.*?\)", "", tel).strip(),
                "다른번호": " / ".join(re.sub(r"\s*\(.*?\)", "", x).strip()
                                    for x in 번호들 if x and x != tel)
                            if i == 0 and len(주소들) == 1 else "",
                "전문처리분야": 칸(r, "전문처리분야").replace("\n", " "),
                "처리가능폐기물": 칸(r, "영업대상").replace("\n", " "),
                "처리시설": 칸(r, "처리시설").replace("\n", " "),
                "사고처리이력": 칸(r, "사고처리"),
                "비고": " · ".join([x for x in [칸(r, "비고").replace("\n", " ")] + 메모 if x]),
                "섭외": 칸(r, "섭외"),
                "번호근거": 근거 if 번호 else "",
                "_확실": 확실, "_주소원문": 칸(r, "지역"),
            })

    # 같은 업체·같은 갈래·같은 주소가 여러 권역에 적힌 것 → 한 줄, 권역 이어 붙임
    # 주소가 비었거나 시 이름뿐이고 '추측' 번호인 줄 → 같은 이름의 주소 있는 줄에 권역만
    낸 = []
    for x in 모음:
        짝 = None
        for y in 낸:
            if y["업체명"] != x["업체명"] or y["갈래"] != x["갈래"]:
                continue
            if y["주소"] == x["주소"] or (x["_확실"] == "추측" and len(x["_주소원문"]) <= 3):
                짝 = y
                break
        if 짝 is None and x["_확실"] == "추측":
            # 짝이 뒤에 나오는 경우 — 나중에 다시 붙입니다
            x["_보류"] = True
        if 짝 is not None:
            if x["협의권역"] not in 짝["협의권역"].split("·"):
                짝["협의권역"] += "·" + x["협의권역"]
            if x["_확실"] == "추측":
                메 = "%s 담당으로도 적혀 있음 — 표에 '장비가 같아 동일 업체로 추정'" % x["협의권역"]
                짝["비고"] = " · ".join([v for v in [짝["비고"], 메] if v])
            else:
                # ㈜엔아이티 중간처분은 소각·중화 두 줄입니다 — 한 줄로 합치되
                # **중화(폐산·폐알칼리)를 버리지 않게** 칸마다 이어 붙입니다
                for k in ("전문처리분야", "처리가능폐기물", "처리시설"):
                    if x[k] and x[k] not in 짝[k]:
                        짝[k] = " / ".join([v for v in [짝[k], x[k]] if v])
            continue
        낸.append(x)
    보류 = [x for x in 낸 if x.get("_보류")]
    낸 = [x for x in 낸 if not x.get("_보류")]
    for x in 보류:
        짝 = next((y for y in 낸 if y["업체명"] == x["업체명"] and y["갈래"] == x["갈래"]), None)
        if 짝 is None:
            낸.append(x)
            continue
        if x["협의권역"] not in 짝["협의권역"].split("·"):
            짝["협의권역"] += "·" + x["협의권역"]
        메 = "%s 담당으로도 적혀 있음 — 표에 '장비가 같아 동일 업체로 추정'" % x["협의권역"]
        짝["비고"] = " · ".join([v for v in [짝["비고"], 메] if v])

    열 = ["업체명", "갈래", "협의권역", "주소", "대표전화", "다른번호", "전문처리분야",
         "처리가능폐기물", "처리시설", "사고처리이력", "비고", "섭외", "번호근거"]
    걸림 = [x["업체명"] for x in 낸 for k in 열 if 휴대.search(str(x.get(k) or ""))]
    if 걸림:
        sys.exit("중단: 휴대전화 꼴이 남았습니다 — " + ", ".join(걸림))
    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=열, extrasaction="ignore")
        w.writeheader()
        for x in 낸:
            w.writerow(x)
    print("%s — %d줄 (%s)" % (OUT.relative_to(ROOT), len(낸), 기준))


if __name__ == "__main__":
    main()
