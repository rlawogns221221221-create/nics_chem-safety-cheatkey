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

⚠ **체크 칸은 `□`(U+25A1), 표시는 `√`(U+221A) 입니다.** `☐`(U+2610) 과
   `✓`(U+2713) 은 한글 기본 글꼴(KS X 1001)에 없어 빈 네모나 물음표로 나올 수
   있습니다(검사()가 둘 다 막습니다).
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

회신기한 = "2026. ○. ○.(○)까지"
받는곳 = "(기후에너지환경부 화학물질안전원 김재훈 전문위원, kjh221@korea.kr)"


# ══ 조각 만드는 도구 ═══════════════════════════════════════════
def 줄(t, cp=None, 크기=1000, pp=왼쪽):
    return 문단(t, 글폭, cp or 글, pp, 크기)[0]


def 빈줄():
    return 문단("", 글폭, 잔글, 왼쪽, 800)[0]


def 대목(t):
    """`① 처음 열었을 때` 같은 큰 제목 — 앞에 빈 줄 하나."""
    return 빈줄() + 줄(t, 라벨, 1100)


def 물음(t):
    return 줄(t, 머리, 1000)


def 적는칸(줄수):
    """적어 넣는 빈 상자. 빈 문단 수만큼 높아집니다."""
    return 표([[{"글들": [""] * 줄수, "charPr": 글, "paraPr": 왼쪽, "크기": 1000,
                 "테두리": 속칸}]], [표폭])[0]


def 보기줄(*보기):
    """한 줄에 늘어놓는 짧은 보기."""
    return 줄("   ".join("□ " + b for b in 보기))


def 보기목록(보기들, 기타=True):
    """한 줄에 하나씩 놓는 긴 보기 — 줄이 섞이면 어느 □ 가 어느 글인지 헷갈립니다."""
    o = [줄("□ " + b) for b in 보기들]
    if 기타:
        o.append(줄("기타 (                                                  )"))
    return "".join(o)


# ══ 본문 ═══════════════════════════════════════════════════════
# ⚠ **네 번째 판 — 공문 설문 양식**(2026-10-06 사용자 — "너가 지자체 공무원
#   이라면 저 위에 내용을 이해할 수 있을 것 같아?").
#   · 첫 판: 7대목·약 30문항, 도구마다 5단계 동의 표 → "질문이 너무 구체적"
#   · 둘째 판: 9문항 · 5단계 표 4줄 → "아니야"
#   · 셋째 판: 이야기형 10문항, 「떠올려 볼 것」·새벽 당직 장면 → 공무원이
#     읽기 어려움. 우리 개발 문서의 말투(멈칫한 순간 · 견주어 · 어림값 ·
#     √ 옆에 한 줄)가 그대로 들어가 있었습니다.
#   지금 판은 **지자체가 늘 받는 설문 모양**입니다 — 인사말 · Ⅰ~Ⅴ 대목 ·
#   1~16 번호 · "해당란에 √ 표시" · "(복수 선택)" · "기타 (  )".
#   당장 떠오르지 않을 것들은 **고르는 보기**로 넣었습니다(기능별 불편 사항 ·
#   업무에 쓰기 어려운 점 · 함께 알면 좋을 부서). 자유 기술은 Ⅴ 에 세 칸만.
#   ⚠ 개발 문서 말투(우리끼리 쓰는 낱말)를 설문에 다시 넣지 마세요.
# ⚠ `√`(U+221A)를 씁니다 — `✓`(U+2713) 은 한글 기본 글꼴에 없습니다.
def 본문만들기():
    o = []

    o.append(줄("「화학사고 초동대응 지원 서비스」", 제목, 1500, 가운데))
    o.append(줄("사용자 의견 설문", 제목, 1500, 가운데))
    o.append(빈줄())

    안내 = [
        "안녕하십니까. 화학물질안전원입니다.",
        "「화학사고 초동대응 지원 서비스」를 시범 사용해 주셔서 감사합니다. "
        "서비스 개선을 위해 사용하신 의견을 듣고자 합니다.",
        "",
        "○ 소요 시간 : 약 10분",
        "○ 작성 방법 : 해당란에 √ 표시하거나 직접 작성 "
        "(해당이 없는 문항은 비워 두셔도 됩니다)",
        "○ 회신 : " + 회신기한 + " 작성한 파일을 메일로 회신",
        "          " + 받는곳,
        "○ 응답 내용은 서비스 개선에만 활용하며, 성명은 적지 않으셔도 됩니다.",
    ]
    o.append(표([[{"글들": 안내, "charPr": 글, "paraPr": 왼쪽, "크기": 1000,
                   "테두리": 속칸}]], [표폭])[0])

    # ── Ⅰ
    o.append(대목("Ⅰ. 응답자 일반사항"))
    o.append(물음("1. 소속"))
    o.append(줄("시·도 (              ) / 시·군·구 (              ) / 부서 (              )"))
    o.append(빈줄())
    o.append(물음("2. 화학사고 업무 담당 기간"))
    o.append(보기줄("1년 미만", "1~3년", "3년 이상"))
    o.append(빈줄())
    o.append(물음("3. 주로 사용한 기기 (복수 선택)"))
    o.append(보기줄("사무실 PC", "휴대전화", "태블릿"))

    # ── Ⅱ
    o.append(대목("Ⅱ. 이용 현황"))
    o.append(물음("4. 사용 횟수"))
    o.append(보기줄("1~2회", "3~5회", "6회 이상"))
    o.append(빈줄())
    o.append(물음("5. 사용해 본 기능 (복수 선택)"))
    o.append(보기줄("방제 물품·장비 찾기", "주민 대피장소 찾기", "주민대피 문자생성기"))
    o.append(빈줄())
    o.append(물음("6. 사용한 상황 (복수 선택)"))
    o.append(보기줄("기능 확인(둘러보기)", "교육·훈련", "실제 사고 또는 사고 의심 상황"))
    o.append(줄("□ 기타 (                                        )"))

    # ── Ⅲ
    o.append(대목("Ⅲ. 기능별 불편 사항"))
    o.append(줄("사용해 본 기능만 답해 주십시오. 해당하는 항목에 모두 √ 표시해 주십시오."))
    o.append(빈줄())
    o.append(물음("7. 방제 물품·장비 찾기"))
    o.append(보기목록([
        "찾는 물품·장비나 업체가 목록에 없음",
        "업체·기관 연락처가 실제와 다름",
        "‘업체 섭외’와 ‘방제물품’ 중 무엇을 골라야 할지 헷갈림",
        "보유 수량 등 정보가 부족함",
        "특별히 불편한 점 없음",
    ]))
    o.append(빈줄())
    o.append(물음("8. 주민 대피장소 찾기"))
    o.append(보기목록([
        "관내 대피장소가 빠져 있거나 위치가 다름",
        "표시된 거리·소요시간이 실제와 차이가 큼",
        "화학사고 대피장소와 이재민 임시주거시설의 구분이 헷갈림",
        "휴대전화에서 지도·목록 보기가 불편함",
        "특별히 불편한 점 없음",
    ]))
    o.append(빈줄())
    o.append(물음("9. 주민대피 문자생성기"))
    o.append(보기목록([
        "만들어진 문안을 그대로 쓰기 어려움(우리 기관 문안과 다름)",
        "입력 단계가 많음",
        "사고물질·지역 등 입력 항목을 찾기 어려움",
        "문자 글자 수 때문에 불편함",
        "특별히 불편한 점 없음",
    ]))

    # ── Ⅳ
    o.append(대목("Ⅳ. 업무 활용"))
    o.append(물음("10. 실제 화학사고가 발생하면 이 서비스를 활용하시겠습니까?"))
    o.append(보기줄("적극 활용하겠다", "참고용으로 활용하겠다", "활용하기 어렵다"))
    o.append(빈줄())
    o.append(물음("11. 업무에 활용하는 데 어려운 점이 있다면 (복수 선택)"))
    o.append(보기목록([
        "업무용 PC(행정망)에서 접속이 안 되거나 제한됨",
        "정보가 정확한지 확신하기 어려움",
        "기관 내에서 공식적으로 사용해도 되는지 불분명함",
        "사용 방법 안내·교육이 필요함",
        "기존 업무 방식(엑셀 목록, 기존 문안 등)으로 충분함",
    ]))
    o.append(빈줄())
    o.append(물음("12. 이 서비스를 함께 알면 좋을 부서·기관 (복수 선택)"))
    o.append(보기줄("당직실·재난상황실", "읍·면·동", "소방서", "보건소"))
    o.append(보기줄("인접 시·군·구", "기타 (                    )"))

    # ── Ⅴ
    o.append(대목("Ⅴ. 자유 의견"))
    for t in ("13. 사용하면서 좋았던 점", "14. 개선이 필요한 점",
              "15. 추가되었으면 하는 기능이나 자료"):
        o.append(물음(t))
        o.append(적는칸(3))
        o.append(빈줄())
    # 틀린 번호는 사고 때 담당자를 엉뚱한 곳으로 보냅니다(CLAUDE.md 2절)
    o.append(물음("16. 자료 오류 신고 (있는 경우만)"))
    폭들 = [15000, 16000]
    폭들.append(표폭 - sum(폭들))
    행들 = [[{"글들": [h], "charPr": 머리, "paraPr": 가운데, "크기": 1000,
              "테두리": 머리칸} for h in ("기관·업체·시설명", "잘못된 내용", "올바른 내용")]]
    for _ in range(3):
        행들.append([{"글들": [""], "charPr": 글, "paraPr": 왼쪽, "크기": 1000,
                     "테두리": 속칸} for _ in 폭들])
    o.append(표(행들, 폭들)[0])
    o.append(줄("※ 업체 담당자의 개인 휴대전화번호는 적지 말아 주십시오.", 잔글, 800))
    o.append(빈줄())
    o.append(줄("□ 추가 의견을 전화로 나눌 수 있습니다. "
               "(표시해 주시면 회신 메일로 연락드리겠습니다)"))
    o.append(빈줄())
    o.append(줄("설문에 응답해 주셔서 감사합니다.", 머리, 1000, 가운데))
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
    for 안됨, 대신 in (("☐", "□(U+25A1)"), ("✓", "√(U+221A)")):
        if 안됨 in sec:
            문제.append("%s 가 들어 있습니다 — %s 로 바꾸세요" % (안됨, 대신))
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
