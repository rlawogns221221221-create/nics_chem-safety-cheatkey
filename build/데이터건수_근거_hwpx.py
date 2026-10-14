#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""「자료별로 무엇을 몇 건 셌나」 표를 한글 파일(hwpx)로 만듭니다.

    python3 build/데이터건수_근거_hwpx.py

  결과물 : docs/방제자원_원자료_데이터건수_근거.hwpx  (한글 2014 이상)

── 왜 따로 만드나 ───────────────────────────────────────────────
사용자가 보고서에 붙여 고쳐 쓸 수 있게 한글 표로 달라고 했습니다(2026-10-14 —
"자료별로 무엇을 몇건 셌나. 항목 한글 파일 표로 만들어 줄래?"). 숫자는
`build/원자료_건수.py` 가 센 값을 **그대로 가져옵니다** — PDF 와 한글 파일이
서로 다른 숫자를 말하면 안 됩니다.

표·문단을 그리는 함수와 글꼴·테두리는 성과요약서(`make_summary_hwpx.py`)의
것을 씁니다(주최 측 양식 hwpx 에서 온 것이라 한글이 실제로 저장한 모양).

⚠ **항목별 개수 칸은 줄을 우리가 나눕니다.** 한글은 빈칸에서 줄을 바꾸므로
   그대로 맡기면 「업체명 / 1,110」 처럼 이름과 숫자가 갈라질 수 있습니다.
   한 줄에 들어갈 만큼만 조각을 담아 **문단 하나 = 한 줄**로 넣습니다.
   폭은 넉넉히(90%) 잡습니다 — `·` 를 반각으로 셌다가 실제로 넓게 그려지면
   줄이 넘칩니다.
⚠ **칸 합치기(기관 · 합계)는 한글이 저장한 모양을 본떴습니다**
   (`source/화학사고_현장대응_물질정보_460종_2026.hwpx`) — 합친 칸은
   cellSpan 에 rowSpan/colSpan 을 적고 높이·폭을 더하며, 아래 행에서는 그 칸을
   **빼고** 적습니다.
⚠ 이 자리에서는 한글로 열어 볼 수 없습니다 — `검사()` 가 구조를 대조합니다.
"""

import contextlib
import io
import re
import runpy
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "build"))
import make_summary_hwpx as 틀          # noqa: E402
from make_summary_hwpx import 문단, 글폭, 표폭, 왼쪽, 가운데, 칸여백  # noqa: E402
from make_hwpx import 글자폭              # noqa: E402

낼파일 = ROOT / "docs" / "방제자원_원자료_데이터건수_근거.hwpx"

# ── 글자모양 — 성과요약서의 58~62 에 표 안 이름용 **9pt 굵게** 하나를 더합니다
굵은본문 = 63
틀.새글자.append((굵은본문, 900, True))
본문, 머리, 잔글, 라벨 = 틀.본문, 틀.머리, 틀.잔글, 틀.라벨
머리칸, 속칸 = 틀.머리칸, 틀.속칸

# ── 숫자는 원자료_건수.py 가 센 값 그대로 ──────────────────────────
with contextlib.redirect_stdout(io.StringIO()):
    셈 = runpy.run_path(str(ROOT / "build" / "원자료_건수.py"))
out, T, G, 갈래 = 셈["out"], 셈["T"], 셈["G"], 셈["갈래"]
f = 셈["f"]

폭들 = [3600, 9400, 4000, 4600]
폭들.append(표폭 - sum(폭들))          # 항목별 개수


def 조각글(a, n, 가지):
    return "%s %s%s" % (a, f(n), " (%d종)" % 가지 if 가지 else "")


def 줄묶기(조각들, 폭, 크기=900):
    """조각을 한 줄에 들어갈 만큼씩 묶습니다 — 조각이 줄 끝에서 갈라지지 않게."""
    한도 = (폭 - 칸여백 * 2) * 0.90
    줄들, 지금 = [], ""
    for c in 조각들:
        이어 = c if not 지금 else 지금 + "  ·  " + c
        if 지금 and 글자폭(이어, 크기) > 한도:
            줄들.append(지금)
            지금 = c
        else:
            지금 = 이어
    줄들.append(지금)
    return 줄들


def 칸설명(글들, charPr=본문, paraPr=왼쪽, 크기=900, 테두리=None, 행=1, 열=1):
    return {"글들": 글들, "charPr": charPr, "paraPr": paraPr, "크기": 크기,
            "테두리": 테두리 or 속칸, "행": 행, "열": 열}


def 합친표(행들):
    """칸 합치기(행·열)를 받는 표. 합쳐져 덮인 자리의 칸은 행에서 빼고 적습니다."""
    열수 = len(폭들)
    덮임 = set()                       # (행, 열) — 위에서 내려온 합친 칸이 차지한 자리
    자리들 = []                        # 행마다 [(열, 칸설명)]
    for r, 행 in enumerate(행들):
        c, 놓임 = 0, []
        for 설명 in 행:
            while (r, c) in 덮임:
                c += 1
            놓임.append((c, 설명))
            for dr in range(설명["행"]):
                for dc in range(설명["열"]):
                    if dr or dc:
                        덮임.add((r + dr, c + dc))
            c += 설명["열"]
        while (r, c) in 덮임:
            c += 1
        assert c == 열수, "행 %d 의 칸 수가 맞지 않습니다" % r
        자리들.append(놓임)

    def 폭(c, 설명):
        return sum(폭들[c:c + 설명["열"]])

    # 행 높이 — 합치지 않은 칸들로 잽니다(합친 칸은 짧은 글만 담습니다)
    높이들 = []
    for r, 놓임 in enumerate(자리들):
        잰 = [틀.칸(설명["글들"], c, r, 폭(c, 설명), 설명["charPr"], 설명["paraPr"],
                   설명["크기"], 설명["테두리"])[1]
              for c, 설명 in 놓임 if 설명["행"] == 1]
        높이들.append(max(잰))
    행XML = []
    for r, 놓임 in enumerate(자리들):
        칸들 = []
        for c, 설명 in 놓임:
            h = sum(높이들[r:r + 설명["행"]])
            x = 틀.칸(설명["글들"], c, r, 폭(c, 설명), 설명["charPr"], 설명["paraPr"],
                     설명["크기"], 설명["테두리"], 높이=h)[0]
            x = x.replace('<hp:cellSpan colSpan="1" rowSpan="1"/>',
                          '<hp:cellSpan colSpan="%d" rowSpan="%d"/>' % (설명["열"], 설명["행"]), 1)
            칸들.append(x)
        행XML.append("<hp:tr>%s</hp:tr>" % "".join(칸들))
    총높이 = sum(높이들)
    tbl = ('<hp:tbl id="%d" zOrder="%d" numberingType="TABLE" textWrap="TOP_AND_BOTTOM"'
           ' textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL"'
           ' repeatHeader="1" rowCnt="%d" colCnt="%d" cellSpacing="0" borderFillIDRef="%d"'
           ' noAdjust="0"><hp:sz width="%d" widthRelTo="ABSOLUTE" height="%d"'
           ' heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0"'
           ' flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA"'
           ' horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0"'
           ' horzOffset="0"/><hp:outMargin left="140" right="140" top="140" bottom="140"/>'
           '<hp:inMargin left="140" right="140" top="140" bottom="140"/>%s</hp:tbl>'
           % (틀.새id(), 틀.새id() % 100, len(행들), 열수, 틀.표테두리,
              sum(폭들), 총높이, "".join(행XML)))
    바깥 = 총높이 + 280
    return ('<hp:p id="0" paraPrIDRef="%d" styleIDRef="0" pageBreak="0" columnBreak="0"'
            ' merged="0"><hp:run charPrIDRef="%d">%s<hp:t/></hp:run><hp:linesegarray>'
            '<hp:lineseg textpos="0" vertpos="0" vertsize="%d" textheight="%d" baseline="%d"'
            ' spacing="480" horzpos="0" horzsize="%d" flags="393216"/></hp:linesegarray>'
            '</hp:p>' % (가운데, 잔글, tbl, 바깥, 바깥, int(round(바깥 * 0.85)), 글폭))


def 줄(t, cp=본문, 크기=900, pp=왼쪽):
    return 문단(t, 글폭, cp, pp, 크기)[0]


def 본문만들기():
    o = [줄("방제자원 원자료 — 자료별로 무엇을 몇 건 셌나", 라벨, 1100),
         줄("원자료 %s곳 · 데이터 항목 %s건   (단위: 건 · (○종)은 장비·가스가 몇 가지인지 · "
           "산정일 2026. 10. 13.)" % (f(T["사용자"]), f(T["항목"])), 잔글, 800)]

    행들 = [[칸설명([h], 머리, 가운데, 1000, 머리칸)
             for h in ("기관", "자료", "집계(곳)", "데이터 항목", "항목별 개수")]]
    앞 = None
    for 기관, 이름, 사용자곳, x, 조, _, _ in out:
        행 = []
        if 기관 != 앞:
            행.append(칸설명([기관], 굵은본문, 가운데,
                             행=sum(1 for o_ in out if o_[0] == 기관)))
            앞 = 기관
        행 += [칸설명([이름], 굵은본문),
              칸설명([f(사용자곳)], 본문, 가운데),
              칸설명([f(x["항목"])], 머리, 가운데, 1000),
              칸설명(줄묶기([조각글(a, n, 가) for a, n, _, 가 in 조], 폭들[4]))]
        행들.append(행)
    행들.append([칸설명(["합계"], 머리, 가운데, 1000, 머리칸, 열=2),
                칸설명([f(T["사용자"])], 머리, 가운데, 1000, 머리칸),
                칸설명([f(T["항목"])], 머리, 가운데, 1000, 머리칸),
                칸설명(줄묶기(["%s %s" % (g, f(G[g])) for g, _ in 갈래], 폭들[4]),
                       굵은본문, 왼쪽, 900, 머리칸)])
    o.append(합친표(행들))

    폐 = next(x for _, n, _, x, _, _, _ in out if n == "폐기물처리업체")
    지 = next(x for _, n, _, x, _, _, _ in out if n == "지자체 방재장비")
    독 = next(x for _, n, _, x, _, _, _ in out if n == "독성가스 취급업체")
    주석 = [
        "※ 세는 기준 — 같은 업체·기관은 한 번만 셌고, 빈칸·\"-\"·수량 0·일련번호·똑같이 "
        "되풀이된 줄과 다른 칸에서 따라 나오는 값(가스의 CAS번호, 두 칸을 더한 '계')은 "
        "세지 않았습니다.",
        "※ 집계(곳)와 업체명 수가 다른 것은 세는 단위가 달라서입니다 — 폐기물처리업체는 "
        "허가 %s건 가운데 업체 %s곳, 지자체는 221개 시·군·구의 담당 부서 %s곳, "
        "독성가스 취급업체는 주소별 %s곳."
        % (f(폐["줄"]), f(폐["곳"]), f(지["곳"]), f(독["곳"])),
        "※ 합계 줄의 일곱 갈래는 위 항목들을 같은 성격끼리 모은 합입니다.",
    ]
    주석 += ["※ %s — %s" % (n, 덧) for _, n, _, _, _, _, 덧 in out if 덧]
    o += [줄(t, 잔글, 800) for t in 주석]
    return "".join(o)


# ══ 파일로 묶기 — 설문지(make_survey_hwpx.py)와 같은 방식 ═══════════
def 만들기():
    본 = 본문만들기()
    with zipfile.ZipFile(틀.양식파일) as z:
        원본 = {n: z.read(n) for n in z.namelist()}

    sec = 원본["Contents/section0.xml"].decode("utf-8")
    머리끝 = sec.index("</hp:ctrl></hp:run>") + len("</hp:ctrl></hp:run>")
    앞 = sec[:머리끝]
    앞 = 앞.replace('paraPrIDRef="26" styleIDRef="53"',
                    'paraPrIDRef="%d" styleIDRef="0"' % 왼쪽, 1)
    앞 = 앞.replace('<hp:run charPrIDRef="17">', '<hp:run charPrIDRef="%d">' % 잔글, 1)
    새sec = 앞 + '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0"' \
        ' vertsize="800" textheight="800" baseline="680" spacing="160" horzpos="0"' \
        ' horzsize="%d" flags="393216"/></hp:linesegarray></hp:p>' % 글폭 + 본 + "</hs:sec>"

    새header = 틀.글자모양넣기(원본["Contents/header.xml"].decode("utf-8"))

    hpf = 원본["Contents/content.hpf"].decode("utf-8")
    hpf = re.sub(r"<opf:title>.*?</opf:title>",
                 "<opf:title>방제자원 원자료 데이터 건수 산정 근거</opf:title>", hpf, flags=re.S)
    # 양식 파일에 남의 이름이 남아 있습니다 — 보내는 파일에 넣지 않습니다
    for 이름 in ("creator", "lastsaveby"):
        hpf = re.sub(r'(<opf:meta name="%s" content="text">).*?(</opf:meta>)' % 이름,
                     r"\1\2", hpf, flags=re.S)

    with zipfile.ZipFile(낼파일, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("mimetype"), 원본["mimetype"],
                   compress_type=zipfile.ZIP_STORED)
        for n in ("version.xml", "settings.xml", "META-INF/container.xml",
                  "META-INF/container.rdf", "META-INF/manifest.xml"):
            z.writestr(n, 원본[n])
        z.writestr("Contents/header.xml", 새header)
        z.writestr("Contents/section0.xml", 새sec)
        z.writestr("Contents/content.hpf", hpf)
        z.writestr("Preview/PrvText.txt", "방제자원 원자료 — 자료별로 무엇을 몇 건 셌나\n")
        z.writestr("Preview/PrvImage.png", 원본["Preview/PrvImage.png"])

    검사(새sec, 새header, hpf)
    print("%s   %.0f KB" % (낼파일.relative_to(ROOT), 낼파일.stat().st_size / 1024))


def 검사(sec, header, hpf):
    """한글로 열어 볼 수 없어 구조를 기계로 대조합니다 — 합친 칸을 펼쳐 셉니다."""
    import xml.dom.minidom
    문제 = []
    for 이름, x in (("section0", sec), ("header", header), ("content.hpf", hpf)):
        try:
            xml.dom.minidom.parseString(x.encode("utf-8"))
        except Exception as e:                      # noqa: BLE001
            문제.append("%s 이 XML 로 안 읽힙니다: %s" % (이름, e))
    for k, m in enumerate(re.finditer(r'<hp:tbl [^>]*rowCnt="(\d+)" colCnt="(\d+)"', sec)):
        r, c = int(m.group(1)), int(m.group(2))
        덩이 = sec[m.start():sec.index("</hp:tbl>", m.start())]
        덮은 = []
        for cc, rr, cs, rs in re.findall(
                r'<hp:cellAddr colAddr="(\d+)" rowAddr="(\d+)"/>'
                r'<hp:cellSpan colSpan="(\d+)" rowSpan="(\d+)"/>', 덩이):
            덮은 += [(int(rr) + i, int(cc) + j) for i in range(int(rs)) for j in range(int(cs))]
        if sorted(덮은) != [(i, j) for i in range(r) for j in range(c)]:
            문제.append("표 %d: 칸이 빠지거나 겹칩니다" % (k + 1))
        if 덩이.count("<hp:tr>") != r:
            문제.append("표 %d: 행 수가 rowCnt 와 다릅니다" % (k + 1))
    if sec.count("<hp:p ") != sec.count("<hp:linesegarray>"):
        문제.append("문단 수와 줄배치 수가 다릅니다")
    for k, m in enumerate(re.finditer(r"<hp:linesegarray>(.*?)</hp:linesegarray>", sec, re.S)):
        세로 = [int(v) for v in re.findall(r'vertpos="(-?\d+)"', m.group(1))]
        if 세로 != sorted(set(세로)):
            문제.append("줄배치 %d: 줄 자리가 겹칩니다 %s" % (k + 1, 세로))
    # 항목별 개수 칸은 문단 하나 = 한 줄이어야 합니다(조각이 갈라지지 않게 우리가 나눴음)
    # (조각 사이는 "  ·  " — 각주의 "·" 와 가르려고 빈칸 두 개를 둡니다)
    for m in re.finditer(r"<hp:t>([^<]*  ·  [^<]*)</hp:t></hp:run><hp:linesegarray>(.*?)</hp:linesegarray>",
                         sec, re.S):
        if m.group(2).count("<hp:lineseg ") > 1:
            문제.append("한 줄로 묶은 조각이 두 줄로 넘칩니다: %s" % m.group(1)[:30])
    if 문제:
        print("\n⚠ 확인해야 할 것")
        for t in 문제:
            print("  - " + t)
        raise SystemExit(1)
    print("  구조 검사 통과 — 표 %d개 · 합친 칸·칸 주소·줄배치 이상 없음" % sec.count("<hp:tbl "))
    print("  ⚠ 한글로 열어 본 것은 아닙니다(이 자리에 한글이 없습니다).")


if __name__ == "__main__":
    만들기()
