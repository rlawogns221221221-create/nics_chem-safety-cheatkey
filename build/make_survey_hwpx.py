#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""지자체 담당자에게 메일로 보내는 **사용자 의견 설문지**를 한글 파일(hwpx)로 만듭니다.

    python3 build/make_survey_hwpx.py

  결과물 : docs/사용자의견_설문지.hwpx  (한글 2014 이상에서 열림)

── 왜 이렇게 만드나 ────────────────────────────────────────────
받는 분이 **파일에 바로 적어 회신**하는 설문입니다. 지자체 PC 에는 한글이
깔려 있어 hwpx 가 가장 무난합니다.

표·문단을 그리는 함수는 성과요약서(`build/make_summary_hwpx.py`)의 것을
그대로 씁니다 — 글꼴·문단모양·표 테두리가 모두 주최 측 양식 hwpx 에서 온
것이라, 한글이 실제로 저장한 모양을 벗어나지 않습니다.

⚠ **체크 칸은 `□`(U+25A1) 입니다.** `☐`(U+2610) 은 한글 기본 글꼴(KS X 1001)
   에 없어 빈 네모나 물음표로 나올 수 있습니다.
⚠ **개인정보를 받지 않습니다**(CLAUDE.md 2절 4항). 이름·연락처 칸을 두지 않고,
   자료 오류 표에는 "업체 담당자 개인 휴대전화는 적지 마세요" 를 적습니다.
⚠ 설문 문구의 원본은 Claude Docs 문서「화학사고 초동대응 지원 서비스 사용자
   의견 설문」입니다. 문구를 고치면 **두 곳을 함께** 고치세요.
"""

import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "build"))
import make_summary_hwpx as 틀          # noqa: E402  (표·문단 그리는 함수를 함께 씁니다)
from make_summary_hwpx import 문단, 표, 글폭, 표폭, 왼쪽, 가운데  # noqa: E402

낼파일 = ROOT / "docs" / "사용자의견_설문지.hwpx"

# ── 글자모양 — 성과요약서의 것(58~62)에 **10pt 보통** 하나를 더합니다.
#   설문지는 받는 분이 읽고 적는 문서라 9pt 본문은 작습니다.
글 = 63
틀.새글자.append((글, 1000, False))
본문, 머리, 잔글, 제목, 라벨 = 틀.본문, 틀.머리, 틀.잔글, 틀.제목, 틀.라벨
머리칸, 속칸 = 틀.머리칸, 틀.속칸

회신기한 = "2026년 ○월 ○일(○)까지"
받는곳 = "기후에너지환경부 화학물질안전원 김재훈 전문위원 · kjh221@korea.kr"

동의 = ["전혀\n아니다", "아니다", "보통", "그렇다", "매우\n그렇다"]


# ══ 조각 만드는 도구 ═══════════════════════════════════════════
def 줄(t, cp=None, 크기=1000, pp=왼쪽):
    return 문단(t, 글폭, cp or 글, pp, 크기)[0]


def 빈줄():
    return 문단("", 글폭, 잔글, 왼쪽, 800)[0]


def 대목(t):
    """`1. 기본 정보 …` 같은 큰 제목 — 앞에 빈 줄 하나."""
    return 빈줄() + 줄(t, 라벨, 1100)


def 물음(t):
    return 줄(t, 머리, 1000)


def 고르기(보기):
    """보기를 한 줄에 늘어놓습니다 — 줄이 넘치면 한글이 알아서 접습니다."""
    return 줄("   ".join("□ " + b for b in 보기))


def 적는칸(줄수=3, 머리글=None):
    """적어 넣는 빈 상자. 빈 문단 수만큼 높아집니다."""
    행들 = []
    if 머리글:
        행들.append([{"글들": [머리글], "charPr": 머리, "paraPr": 왼쪽, "크기": 1000,
                     "테두리": 머리칸}])
    행들.append([{"글들": [""] * 줄수, "charPr": 글, "paraPr": 왼쪽, "크기": 1000,
                 "테두리": 속칸}])
    return 표(행들, [표폭])[0]


def 동의표(문장들):
    """문장 × 5단계. 받는 분은 칸에 ○ 를 적습니다."""
    앞폭 = 표폭 - 5 * 4600
    폭들 = [앞폭] + [4600] * 5
    머리행 = [{"글들": ["문장"], "charPr": 머리, "paraPr": 가운데, "크기": 1000,
              "테두리": 머리칸}]
    머리행 += [{"글들": d.split("\n"), "charPr": 머리, "paraPr": 가운데, "크기": 1000,
                "테두리": 머리칸} for d in 동의]
    행들 = [머리행]
    for s in 문장들:
        행들.append([{"글들": [s], "charPr": 글, "paraPr": 왼쪽, "크기": 1000,
                     "테두리": 속칸}]
                    + [{"글들": [""], "charPr": 글, "paraPr": 가운데, "크기": 1000,
                        "테두리": 속칸} for _ in 동의])
    return 표(행들, 폭들)[0]


def 칸표(머리글들, 폭들, 줄수, 보기행=None):
    """머리 한 줄 + 빈 줄 여러 개인 표(자료 오류 신고·점수)."""
    행들 = [[{"글들": [h], "charPr": 머리, "paraPr": 가운데, "크기": 1000,
              "테두리": 머리칸} for h in 머리글들]]
    if 보기행:
        행들.append([{"글들": [v], "charPr": 잔글, "paraPr": 왼쪽, "크기": 800,
                     "테두리": 속칸} for v in 보기행])
    for _ in range(줄수):
        행들.append([{"글들": ["", ""], "charPr": 글, "paraPr": 왼쪽, "크기": 1000,
                     "테두리": 속칸} for _ in 머리글들])
    return 표(행들, 폭들)[0]


# ══ 본문 ═══════════════════════════════════════════════════════
# ⚠ **짧게 둡니다**(2026-10-06 사용자 — "질문이 너무 구체적인데, 조금 더
#   간략하게"). 처음 판은 7대목·약 30문항(도구마다 5단계 표)이었고, 지금은
#   4대목·9문항 · 약 5분입니다. 도구별 세부 문항을 다시 늘리려면 먼저 묻습니다.
def 본문만들기():
    o = []

    o.append(줄("화학사고 초동대응 지원 서비스", 제목, 1500, 가운데))
    o.append(줄("사용자 의견 설문", 제목, 1500, 가운데))
    o.append(빈줄())

    안내 = [
        "화학사고 초동대응 지원 서비스를 써 보신 의견을 듣고자 합니다. 약 5분이면 됩니다.",
        "",
        "○ 답하는 법 : 이 파일에 바로 적어 메일로 회신 (□ 는 ■ 나 √ 로, 표는 ○ 로 표시)",
        "○ 회신 기한 : " + 회신기한,
        "○ 보낼 곳 : " + 받는곳,
        "",
        "성함·연락처는 적지 않으셔도 됩니다.",
    ]
    o.append(표([[{"글들": 안내, "charPr": 글, "paraPr": 왼쪽, "크기": 1000,
                   "테두리": 속칸}]], [표폭])[0])

    # ── 1. 사용 경험
    o.append(대목("1. 사용 경험"))
    o.append(표([
        [{"글들": ["1-1. 소속(시·도 / 시·군·구 / 부서)"], "charPr": 머리, "paraPr": 왼쪽,
          "크기": 1000, "테두리": 머리칸},
         {"글들": [""], "charPr": 글, "paraPr": 왼쪽, "크기": 1000, "테두리": 속칸}],
    ], [17000, 표폭 - 17000])[0])
    o.append(빈줄())
    o.append(물음("1-2. 몇 번쯤 열어 보셨나요?"))
    o.append(고르기(["안 열어 봤다", "1~2번", "3번 이상"]))
    o.append(빈줄())
    o.append(물음("1-3. 써 본 도구를 모두 고르세요."))
    o.append(고르기(["방제 물품·장비 찾기", "주민 대피장소 찾기", "주민대피 문자생성기"]))

    # ── 2. 만족도
    o.append(대목("2. 만족도"))
    o.append(줄("해당하는 칸에 ○ 표 해 주세요."))
    o.append(동의표([
        "쓰는 방법이 쉽다",
        "필요한 정보를 빨리 찾을 수 있다",
        "실제 사고 때 쓸 만하다",
        "휴대전화에서도 쓰기 편하다",
    ]))

    # ── 3. 의견
    o.append(대목("3. 의견"))
    for t in ("3-1. 좋았던 점", "3-2. 불편했던 점이나 고쳤으면 하는 점",
              "3-3. 더 있었으면 하는 기능"):
        o.append(물음(t))
        o.append(적는칸(3))
        o.append(빈줄())

    # ── 4. 틀린 자료 — 짧게 줄여도 이것은 남깁니다. 틀린 번호는 사고 때
    #   담당자를 엉뚱한 곳으로 보냅니다(CLAUDE.md 2절).
    o.append(대목("4. 틀린 자료 알려 주기 (있을 때만)"))
    o.append(줄("전화번호·주소가 틀리거나 빠진 곳이 있으면 적어 주세요. 가장 먼저 고칩니다."))
    폭들 = [16000, 16000]
    폭들.append(표폭 - sum(폭들))
    o.append(칸표(["기관·업체·대피장소 이름", "틀린 내용", "맞는 내용"], 폭들, 2))
    o.append(줄("※ 업체 담당자의 개인 휴대전화는 적지 마세요.", 잔글, 800))
    o.append(빈줄())
    o.append(줄("답해 주셔서 고맙습니다.", 머리, 1000, 가운데))
    return "".join(o)


# ══ 파일로 묶기 ════════════════════════════════════════════════
def 만들기():
    본 = 본문만들기()
    with zipfile.ZipFile(틀.양식파일) as z:
        원본 = {n: z.read(n) for n in z.namelist()}

    # 쪽 설정이 든 첫 문단을 그대로 이어 씁니다(성과요약서와 같은 방식)
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
                 "<opf:title>화학사고 초동대응 지원 서비스 사용자 의견 설문</opf:title>",
                 hpf, flags=re.S)
    # 양식 파일에 남의 이름이 남아 있습니다 — 보내는 파일에 넣지 않습니다
    for 이름 in ("creator", "lastsaveby"):
        hpf = re.sub(r'(<opf:meta name="%s" content="text">).*?(</opf:meta>)' % 이름,
                     r"\1\2", hpf, flags=re.S)

    미리 = "화학사고 초동대응 지원 서비스\n사용자 의견 설문\n"

    with zipfile.ZipFile(낼파일, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("mimetype"), 원본["mimetype"],
                   compress_type=zipfile.ZIP_STORED)
        for n in ("version.xml", "settings.xml", "META-INF/container.xml",
                  "META-INF/container.rdf", "META-INF/manifest.xml"):
            z.writestr(n, 원본[n])
        z.writestr("Contents/header.xml", 새header)
        z.writestr("Contents/section0.xml", 새sec)
        z.writestr("Contents/content.hpf", hpf)
        z.writestr("Preview/PrvText.txt", 미리)
        z.writestr("Preview/PrvImage.png", 원본["Preview/PrvImage.png"])

    검사(새sec, 새header, hpf)
    print("%s   %.0f KB" % (낼파일.relative_to(ROOT), 낼파일.stat().st_size / 1024))


def 검사(sec, header, hpf):
    """한글로 열어 볼 수 없어 구조를 기계로 대조합니다(성과요약서와 같은 항목)."""
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
        주소 = set(re.findall(r'<hp:cellAddr colAddr="(\d+)" rowAddr="(\d+)"', 덩이))
        if 주소 != {(str(j), str(i)) for i in range(r) for j in range(c)}:
            문제.append("표 %d: 칸 주소가 어긋납니다" % (k + 1))
    if sec.count("<hp:p ") != sec.count("<hp:linesegarray>"):
        문제.append("문단 수와 줄배치 수가 다릅니다")
    for k, m in enumerate(re.finditer(r"<hp:linesegarray>(.*?)</hp:linesegarray>", sec, re.S)):
        세로 = [int(v) for v in re.findall(r'vertpos="(-?\d+)"', m.group(1))]
        if 세로 != sorted(set(세로)):
            문제.append("줄배치 %d: 줄 자리가 겹칩니다 %s" % (k + 1, 세로))
    # 한글 기본 글꼴에 없는 글자 — 빈 네모로 나옵니다
    if "☐" in sec:
        문제.append("☐(U+2610) 가 들어 있습니다 — □(U+25A1) 로 바꾸세요")
    if 문제:
        print("\n⚠ 확인해야 할 것")
        for t in 문제:
            print("  - " + t)
        raise SystemExit(1)
    print("  구조 검사 통과 — 표 %d개 · 칸 주소·줄배치 이상 없음"
          % sec.count("<hp:tbl "))
    print("  ⚠ 한글로 열어 본 것은 아닙니다(이 자리에 한글이 없습니다).")


if __name__ == "__main__":
    만들기()
