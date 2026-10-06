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
def 본문만들기():
    o = []

    o.append(줄("화학사고 초동대응 지원 서비스", 제목, 1500, 가운데))
    o.append(줄("사용자 의견 설문", 제목, 1500, 가운데))
    o.append(빈줄())

    # ── 안내 — 상자 하나에 담습니다
    안내 = [
        "화학사고 초동대응 지원 서비스를 써 보신 의견을 듣고자 합니다. "
        "답해 주신 내용은 도구를 고치는 데에만 씁니다.",
        "",
        "○ 걸리는 시간 : 약 10분",
        "○ 답하는 법 : 이 파일에 바로 적어 주세요. □ 는 ■ 로 바꾸거나 √ 표시를, "
        "점수 칸에는 ○ 표시를 해 주시면 됩니다.",
        "○ 회신 기한 : " + 회신기한,
        "○ 보낼 곳 : " + 받는곳 + " (이 파일을 메일에 첨부해 회신)",
        "",
        "써 보지 않은 도구의 문항은 건너뛰셔도 됩니다. 좋았던 점보다 불편했던 점이 "
        "더 큰 도움이 됩니다. 성함과 연락처는 적지 않으셔도 되며, 결과는 기관·개인을 "
        "밝히지 않고 묶어서 정리합니다.",
    ]
    o.append(표([[{"글들": 안내, "charPr": 글, "paraPr": 왼쪽, "크기": 1000,
                   "테두리": 속칸}]], [표폭])[0])

    # ── 1. 기본 정보와 사용 경험
    o.append(대목("1. 기본 정보와 사용 경험"))
    o.append(표([
        [{"글들": ["소속(시·도 / 시·군·구 / 부서)"], "charPr": 머리, "paraPr": 왼쪽,
          "크기": 1000, "테두리": 머리칸},
         {"글들": [""], "charPr": 글, "paraPr": 왼쪽, "크기": 1000, "테두리": 속칸}],
        [{"글들": ["화학사고 업무를 맡은 기간"], "charPr": 머리, "paraPr": 왼쪽,
          "크기": 1000, "테두리": 머리칸},
         {"글들": ["□ 1년 미만   □ 1~3년   □ 3년 이상"], "charPr": 글,
          "paraPr": 왼쪽, "크기": 1000, "테두리": 속칸}],
    ], [15000, 표폭 - 15000])[0])
    o.append(빈줄())
    o.append(물음("1-1. 링크를 받은 뒤 몇 번쯤 열어 보셨나요?"))
    o.append(고르기(["한 번도 안 열었다", "1~2번", "3~5번", "6번 이상"]))
    o.append(빈줄())
    o.append(물음("1-2. (안 열어 보셨다면) 그 이유는 무엇인가요? "
                  "— 이 문항만 답하고 5번으로 가셔도 됩니다."))
    o.append(고르기(["시간이 없었다", "링크가 열리지 않았다",
                     "업무에 필요하지 않다고 봤다", "기타(              )"]))
    o.append(빈줄())
    o.append(물음("1-3. 주로 어디서 여셨나요? (모두 고르기)"))
    o.append(고르기(["사무실 PC(인터넷망)", "망분리 PC(파일로 열기)", "휴대전화", "태블릿"]))
    o.append(빈줄())
    o.append(물음("1-4. 어떤 상황에서 여셨나요? (모두 고르기)"))
    o.append(고르기(["어떤 도구인지 둘러보려고", "훈련·교육 때",
                     "실제 사고나 사고 의심 상황에서", "기타(              )"]))
    o.append(빈줄())
    o.append(물음("1-5. 훈련이나 실제 상황에서 쓰셨다면, 그때 어떻게 쓰셨는지 "
                  "자유롭게 적어 주세요."))
    o.append(적는칸(4, "어떤 상황이었고, 어떤 도구를 어떻게 썼는지 · 도움이 됐던 점 · 막혔던 점"))
    o.append(빈줄())
    o.append(물음("1-6. 써 본 도구를 모두 고르세요. 고른 도구의 문항(2~4번)만 답하시면 됩니다."))
    o.append(고르기(["01 방제 물품·장비 찾기", "02 주민 대피장소 찾기",
                     "03 주민대피 문자생성기"]))

    # ── 2. 방제 물품·장비 찾기
    o.append(대목("2. 01 방제 물품·장비 찾기"))
    o.append(물음("2-1. 아래 문장에 얼마나 동의하시나요? 해당하는 칸에 ○ 표 해 주세요."))
    o.append(동의표([
        "처음에 고르는 두 갈래(업체 섭외 / 방제물품)가 바로 이해됐다",
        "찾던 물품이나 업체를 목록에서 찾을 수 있었다",
        "목록을 눌렀을 때 뜨는 창에서 전화번호·보유 수량을 바로 찾을 수 있었다",
        "‘먼저 연락 · 미리 협의된 곳’ 표시의 뜻이 이해됐다",
    ]))
    o.append(빈줄())
    o.append(물음("2-2. 찾으려 했는데 목록에 없던 물품·장비·업체가 있었다면 적어 주세요."))
    o.append(적는칸(2))
    o.append(빈줄())
    o.append(물음("2-3. 관내에서 아시는 업체·기관의 전화번호와 보유 물품이 맞았나요?"))
    o.append(고르기(["대부분 맞았다", "일부 틀렸다(7번 표에 적어 주세요)",
                     "확인해 보지 않았다"]))
    o.append(빈줄())
    o.append(물음("2-4. 그 밖에 불편했거나 바라는 점"))
    o.append(적는칸(3))

    # ── 3. 주민 대피장소 찾기
    o.append(대목("3. 02 주민 대피장소 찾기"))
    o.append(물음("3-1. 아래 문장에 얼마나 동의하시나요? 해당하는 칸에 ○ 표 해 주세요."))
    o.append(동의표([
        "사고지점을 넣는 방법(검색·지도 누르기)이 쉬웠다",
        "관내 대피장소가 빠짐없이, 맞는 자리에 나왔다",
        "화학사고 대피장소와 이재민 임시주거시설을 구분해 볼 수 있었다",
        "거리·도보시간이 ‘어림값’이라는 표시가 눈에 들어왔다",
        "휴대전화에서도 지도와 목록을 보기 편했다",
    ]))
    o.append(빈줄())
    o.append(물음("3-2. 관내에 빠진 대피장소나 자리가 틀린 곳이 있었나요?"))
    o.append(고르기(["없었다", "있었다(7번 표에 적어 주세요)", "확인해 보지 않았다"]))
    o.append(빈줄())
    o.append(물음("3-3. 그 밖에 불편했거나 바라는 점"))
    o.append(적는칸(3))

    # ── 4. 주민대피 문자생성기
    o.append(대목("4. 03 주민대피 문자생성기"))
    o.append(물음("4-1. 아래 문장에 얼마나 동의하시나요? 해당하는 칸에 ○ 표 해 주세요."))
    o.append(동의표([
        "한 화면에 한 가지씩 묻는 방식(6~7걸음)이 급할 때에도 적당하다",
        "나온 문안을 크게 고치지 않고 발송할 수 있겠다",
        "글자수 표시가 발송 준비에 도움이 됐다",
        "지금 문자를 작성하는 방식보다 빠르다",
    ]))
    o.append(빈줄())
    o.append(물음("4-2. 문안을 고친다면 어느 부분을, 왜 고치시나요?"))
    o.append(적는칸(3))
    o.append(빈줄())
    o.append(물음("4-3. 지금은 사고 때 문자를 어떻게 작성하시나요?"))
    o.append(고르기(["미리 만든 문안을 고쳐 씁니다", "그때그때 새로 씁니다",
                     "다른 부서가 맡습니다", "기타(              )"]))
    o.append(빈줄())
    o.append(물음("4-4. 그 밖에 불편했거나 바라는 점"))
    o.append(적는칸(3))

    # ── 5. 전체 의견
    o.append(대목("5. 전체 의견"))
    o.append(물음("5-1. 화학사고가 나면 이 도구를 실제로 열 것 같으세요?"))
    o.append(고르기(["꼭 열 것이다", "열 것 같다", "잘 모르겠다", "열지 않을 것 같다"]))
    o.append(줄("→ ‘잘 모르겠다’ 나 ‘열지 않을 것 같다’ 라면 그 이유를 적어 주세요. "
               "(                                        )"))
    o.append(빈줄())
    o.append(물음("5-2. 동료 담당자에게 이 도구를 권하고 싶은 정도를 0~10점으로 "
                  "매겨 주세요. (0점 = 전혀 권하지 않음, 10점 = 꼭 권함)"))
    o.append(칸표(["점수", "그 점수를 주신 까닭"], [8000, 표폭 - 8000], 1))
    o.append(빈줄())
    o.append(물음("5-3. 딱 하나만 고친다면 무엇을 고치고 싶으세요?"))
    o.append(적는칸(2))
    o.append(빈줄())
    o.append(물음("5-4. 세 도구 말고도 사고 초기에 꼭 필요한데 없는 것이 있나요?"))
    o.append(적는칸(2))

    # ── 6. 검토 중인 기능
    o.append(대목("6. 검토 중인 기능에 대한 의견"))
    o.append(줄("아직 정하지 않은 것들입니다. 답해 주신 내용을 보고 넣을지 정합니다."))
    o.append(빈줄())
    o.append(물음("6-1. ‘대피장소 찾기’와 ‘문자생성기’에도, 방제 도구처럼 처음에 "
                  "한 가지만 묻는 시작 화면이 있으면 좋겠나요?"))
    o.append(고르기(["있으면 좋겠다", "지금대로가 좋다", "잘 모르겠다"]))
    o.append(빈줄())
    o.append(물음("6-2. 사고 물질을 고르면, 그 물질에 쓸 수 있는 방제 물품(중화제 등)과 "
                  "업체를 추려 주는 기능이 필요하신가요?"))
    o.append(고르기(["꼭 필요하다", "있으면 좋다", "필요하지 않다"]))
    o.append(빈줄())
    o.append(물음("6-3. 첫 화면의 도구 차례(01 방제 물품·장비 → 02 대피장소 → 03 문자)가 "
                  "실제 업무 순서와 맞나요?"))
    o.append(고르기(["맞다", "다르다 → 실제 순서: (                              )"]))

    # ── 7. 틀린 자료
    o.append(대목("7. 틀린 자료 알려 주기"))
    o.append(줄("틀린 전화번호나 없는 대피장소는 사고 때 담당자를 엉뚱한 곳으로 보냅니다. "
               "발견하신 것이 있으면 기관 이름과 주소까지 적어 주세요. 가장 먼저 "
               "고칩니다. 줄이 모자라면 늘려 적으셔도 됩니다."))
    o.append(빈줄())
    폭들 = [5200, 10200, 11000, 10500]
    폭들.append(표폭 - sum(폭들))
    o.append(칸표(["도구 번호", "기관·업체·대피장소 이름", "주소",
                  "틀린 내용", "맞는 내용"], 폭들, 4,
                 보기행=["(예) 01", "○○시 환경과", "○○시 ○○로 1", "전화번호가 다름",
                         "대표번호 ○○○-○○○-○○○○"]))
    o.append(줄("※ 업체 담당자의 개인 휴대전화는 적지 마세요. 이 도구에는 "
               "대표번호·부서번호만 싣습니다.", 잔글, 800))
    o.append(빈줄())
    o.append(줄("끝까지 답해 주셔서 고맙습니다.", 머리, 1000, 가운데))
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
