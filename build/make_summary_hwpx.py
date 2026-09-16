#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""[참고 1] 성과요약서 + [참고 2] 이미지 양식을 **한글 파일(hwpx)** 로 만듭니다.

    python3 build/make_summary_hwpx.py

  결과물 : docs/화학안전치트키_성과요약서.hwpx
           (1쪽 = 참고 1 · 2~3쪽 = 참고 2 · 한글 2014 이상에서 열림)

── 왜 새로 짜서 만드나 ─────────────────────────────────────────
결과보고서(`build/make_hwpx.py`)는 주최 측이 준 **hwpx 양식의 빈칸만**
채웁니다. 그런데 참고 1·2 의 양식은 계획 문서(**.hwp** 바이너리) 안에만
있습니다. hwp 는 압축 레코드 묶음이라 우리가 표를 열어 고칠 수 없습니다
(`build/hwp읽기.py` 로 **글자만** 뽑힙니다 — 그것으로 칸 이름을 확인했습니다).

그래서 **표를 우리가 그립니다.** 다만 아무것도 새로 지어내지 않습니다 —
글꼴·문단모양·표 테두리·쪽 여백은 모두 `source/AI프렌즈_결과보고서_양식.hwpx`
안에 이미 있는 것을 **그대로 가져다 씁니다**(header.xml 통째로 재사용).
표·그림의 XML 도 한글이 실제로 저장해 둔 것을 본떴습니다 —
  · 표      : 양식의 4행 2열 표(분야/팀명/팀원/멘토)
  · 그림    : `source/화학사고_현장대응_물질정보_460종_2026.hwpx` 의
              글자처럼 놓인 그림(treatAsChar="1")

⚠ **줄배치 캐시(`<hp:linesegarray>`)를 줄 수만큼 만듭니다.** 그 값은 "몇 번째
   줄이 세로 어디서 시작하는가" 이고, 모자라면 한글이 **한 자리에 모든 줄을
   겹쳐 그립니다**(2026-09-14 에 실제로 겪은 일). 줄 나누기는 결과보고서와
   같은 함수(`make_hwpx.줄나누기`)를 씁니다.

⚠ **이 자리에서는 한글로 열어 확인할 수 없습니다.** 리눅스에 한글이 없습니다.
   그래서 만든 뒤 `검사()` 가 구조를 기계로 대조합니다(칸 주소가 빠짐없는지 ·
   그림이 manifest 에 있는지 · 줄배치가 모자라지 않은지). 그래도 **사용자가
   한 번 열어 봐야** 확실합니다.

── 사진 ────────────────────────────────────────────────────────
`docs/성과이미지/축소/*.jpg` 를 넣습니다(`node build/사진줄이기.mjs`).
원본 PNG 는 넣지 않습니다 — 9.3MB 라 메일 첨부가 무거워지고, 고화질 원본은
양식 요구대로 **따로** 제출합니다.
"""

import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "build"))
from make_hwpx import 줄나누기            # noqa: E402  (줄 나누기 규칙을 함께 씁니다)

양식파일 = ROOT / "source" / "AI프렌즈_결과보고서_양식.hwpx"
사진폴더 = ROOT / "docs" / "성과이미지" / "축소"
낼파일 = ROOT / "docs" / "화학안전치트키_성과요약서.hwpx"

# ── 쪽 크기(양식의 secPr 그대로) ────────────────────────────────
쪽폭, 쪽높이 = 59528, 84188          # A4 세로
여백좌, 여백우 = 5669, 5669
여백상, 여백하 = 5500, 4252
글폭 = 쪽폭 - 여백좌 - 여백우        # 48190
글높이 = 쪽높이 - 여백상 - 여백하    # 74436

표폭 = 47900                          # 밖여백 140×2 을 더해도 글폭 안
칸여백 = 141                          # 양식 표의 cellMargin

# ── 새로 만드는 글자모양(charPr) ────────────────────────────────
# 양식의 charPr 29(휴먼명조·비율 100·자간 0)를 본떠 크기만 바꿉니다.
# ⚠ 비율 100·자간 0 인 것을 본뜨는 이유 — 줄 나누기를 글자크기 그대로
#   계산할 수 있습니다. charPr 25 는 비율 95·자간 -7 이라 폭이 어긋납니다.
본문 = 58        # 9pt
머리 = 59        # 10pt 굵게
잔글 = 60        # 8pt
제목 = 61        # 15pt 굵게
라벨 = 62        # 11pt 굵게
새글자 = [(본문, 900, False), (머리, 1000, True), (잔글, 800, False),
          (제목, 1500, True), (라벨, 1100, True)]

# ── 쓰는 문단모양(paraPr) — 양식에 이미 있는 것 ─────────────────
왼쪽 = 25        # LEFT · 줄간 120%
가운데 = 19      # CENTER · 줄간 160%
줄간 = {왼쪽: 120, 가운데: 160}

# ── 표 테두리(borderFill) — 양식의 4행 2열 표가 쓰는 것 ─────────
표테두리, 머리칸, 속칸 = 16, 17, 18


# ══ 참고 1 · 성과요약서 ═════════════════════════════════════════
# ⚠ 수치는 전부 자료·코드에서 센 값입니다. 재 보지 않은 것에는 `추정` 을
#   답니다 — 성과를 부풀리지 않는 것이 이 문서의 조건입니다(CLAUDE.md 2절).
# ⚠ 문체는 개조식입니다(결과보고서 한글판과 같게). 명사로 끝내고
#   말머리에 `(현황)`·`(문제)` 같은 괄호 라벨을 답니다.
성과요약서 = [
    ("팀명\n(팀원)", [
        "화학안전치트키 (팀장 정성경 · 팀원 허선화 · 김재훈 / 멘토 현중균)",
        "기후에너지환경부 화학물질안전원",
    ]),
    ("과제명", [
        "화학사고 초동대응 지원 서비스 — 지자체 담당자용 업무도구 3종",
        "(주민 대피장소 찾기 · 주민대피 문자생성기 · 방제 물품·장비 찾기)",
    ]),
    ("한 줄 소개", [
        "사고지점만 넣으면 «대피장소 · 재난문자 문안 · 방제자원»이 가까운 순으로 "
        "나오는, 설치·회원가입 없이 주소만 열면 쓰는 지자체 담당자용 업무도구",
    ]),
    ("추진 배경", [
        "○ (현황) 화학사고 발생 시 초기 30분 내 ①주민 대피장소 ②재난문자 "
        "표준문안 ③방제자원(폐기물·중장비 처리) 동시 확인 필요",
        "○ (문제) 3종 자료가 엑셀 목록·공문 붙임 한글파일·기관별 표 19종으로 "
        "분산 — 파일 3~4개를 각각 열어 시·군·구 수기 검색, 거리 육안 판단",
        "○ (필요성) 자료 탐색 시간을 없애고 담당자가 판단·지시에 집중할 수 있는 "
        "단일 창구 필요",
    ]),
    ("주요 내용", [
        "○ (주민 대피장소 찾기) 사고지점(주소·사업장명·지도·내 위치·좌표) 입력 시 "
        "대피 후보지 17,754곳을 근거리순 표출",
        "  - 화학사고 대피장소 1,849곳 + 이재민 임시주거시설 15,905곳을 별도 층으로 "
        "구분, 직선거리·도보시간·수용인원·관할부서 전화 병기",
        "○ (주민대피 문자생성기) 발송 구분 선택 후 1단계 1묶음 질의, 승인 표준문안 "
        "12건을 조립 없이 원문 출력(글자수 병기)",
        "  - 필수 항목 미입력 시 문안 미생성 — 시각 등이 빈 미완성 문안의 복사·발송 "
        "차단, 상황종료 문안 동시 생성",
        "○ (방제 물품·장비 찾기) 업체 섭외 / 방제물품 2갈래 분기 후 허가 7종 또는 "
        "물품 표준 27종 선택, 사고지점 주변 보유처 표출",
        "  - 목록 선택 시 전화번호·보유 물품·수량 창 표출, 동원 목록 일괄 복사, "
        "사전 협의 업체 23곳은 갈래별 상단 배치",
        "○ (자료 통합) 기관별 표 19종을 정비해 방제자원 470 → 5,792건, 개인정보 "
        "전량 제거 후 사업장 대표번호만 수록",
    ]),
    ("결과물\n확인방법", [
        "○ (접속) https://chem-safety-kr.pages.dev — 설치·회원가입 없음 · "
        "PC·휴대전화 공용 · 주소가 짧아 별도 단축 불요",
        "○ (이용) 주소 접속 → 도구 선택 → 사고지점 입력 → 결과 확인 → 전화·복사",
        "○ (망분리 PC) 단일 HTML 파일 3종(1.9·2.9·3.8MB)을 옮겨 더블클릭 — "
        "인터넷 없이 동일 기능 수행",
    ]),
    ("주요 성과", [
        "○ (초동 자료 확인) 파일 3~4개·20~30분(추정) → 주소 1개·3단계·3분 이내",
        "○ (재난문자 작성) 수기 편집 15분(추정) → 2분 이내 · 12건 동시 생성",
        "○ (검색 가능 방제자원) 470건 → 5,792건 (+1,132%)",
        "○ (대피 후보지) 1,849곳 → 17,754곳 (+760%)",
        "○ (화면 자동 검증) 수기 점검 0항목 → 886항목·19묶음 (1회 12분)",
        "○ (개인정보 노출) 원자료 실명 2,719·휴대전화 495건 → 0건 (검출 시 빌드 중단)",
    ]),
    ("활용\nAI·도구", [
        "○ (개발) Claude Code — 화면·자료 변환·검증 코드 전 과정 작성, 자연어 "
        "지시를 코드·문서로 전환",
        "○ (자료 변환) Python·Node 스크립트로 엑셀·한글·구형 xls·오픈API JSON 일괄 "
        "변환, 물품 표기 674종을 표준 27종으로 통합",
        "○ (품질 검증) Playwright 자동 검증 — 실제 브라우저로 886항목 · "
        "모바일 65화면 점검",
        "○ (문서화) 설명서 PDF·한글 보고서·시연 영상을 스크립트로 생성 — 화면이 "
        "바뀌면 문서도 다시 만들어 서로 어긋나지 않음",
    ]),
    ("활용 방안", [
        "○ (지속 활용) 화학물질안전원이 자료를 갱신하면 스크립트 재실행만으로 반영 "
        "— 화면 수정 없이 최신 자료 유지",
        "○ (타 업무·부서) 합동방재센터·유역환경청·소방 상황실 등 같은 자료를 쓰는 "
        "기관에 그대로 확대 적용 가능",
        "○ (대내 연계) ’26.11 원내 사고상황공유앱 방제자원 DB 와 자료 구조를 표준에 "
        "맞춰 두어 교체 시 화면 수정 불요",
        "○ (대외 확산) 전국 지자체(시·도 17, 시·군·구 229)에 링크 1개로 배포, "
        "망분리 환경은 단일 파일로 동일 제공 — 예산·설치 없이 확산",
    ]),
]

# ══ 참고 2 · 이미지 양식 ════════════════════════════════════════
# 차례는 진입 화면의 카드 차례(01 대피장소 → 02 문자 → 03 방제)와 같습니다.
대표사진 = ("01-대표-진입화면.jpg", [
    "«사고지점 하나로 세 가지를 찾는다»는 서비스 전체를 한 화면에 보여 주는 진입 "
    "화면. 주소만 열면 설치·회원가입 없이 바로 쓰며, ① 주민 대피장소 찾기 · "
    "② 주민대피 문자생성기 · ③ 방제 물품·장비 찾기 세 도구로 나뉨",
    "파일 : 01-대표-진입화면.png · 2,880×1,800px",
])

추가사진 = [
    ("02-대피장소-결과.jpg", [
        "① 주민 대피장소 찾기. 사고지점을 사업장 이름으로 넣으면 대피 후보지 "
        "17,754곳 중 주변을 가까운 순으로 표출 — 직선거리·도보시간·수용인원·"
        "관할부서 전화를 함께 보여 줌",
        "파일 : 02-대피장소-결과.png",
    ]),
    ("04-문자-문안.jpg", [
        "② 주민대피 문자생성기. 한 걸음에 한 묶음씩 물어 값을 채우면 승인 "
        "표준문안이 조립 없이 원문 그대로 생성되고 글자수가 함께 표시 — 복사해 "
        "발송시스템에 붙여 사용",
        "파일 : 04-문자-문안.png  ※ 화면의 사고 내용은 기능 설명을 위한 가상 상황",
    ]),
    ("03-방제-세부창.jpg", [
        "③ 방제 물품·장비 찾기. 필요한 물품을 고르고 사고지점을 넣으면 보유처가 "
        "가까운 순으로 나오고, 줄을 누르면 전화번호가 가장 큰 글자로 뜨는 세부사항 "
        "창에서 보유 물품·수량을 바로 확인",
        "파일 : 03-방제-세부창.png",
    ]),
    ("05-휴대전화-진입화면.jpg", [
        "현장에서 쓰는 휴대전화 화면. 같은 주소를 휴대전화로 열면 세 도구가 한 "
        "화면에 들어오도록 자동 조정 — 현장 출동 담당자가 앱 설치 없이 그대로 사용",
        "파일 : 05-휴대전화-진입화면.png",
    ]),
]

맺음 = [
    "※ 제출 파일 — 위 이미지의 원본 PNG 5장을 고화질 그대로 함께 제출합니다"
    "(이 문서 안의 그림은 A4 폭에 맞춰 줄인 것입니다).",
    "※ 촬영 조건 — 실제 동작 화면을 그대로 찍은 것이며, 화면에 없는 설명·표시를 "
    "덧그리지 않았습니다.",
]


# ══ 도구 ═══════════════════════════════════════════════════════
def 이스케이프(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


_다음id = [1000]


def 새id():
    _다음id[0] += 7
    return _다음id[0]


def png크기(길):
    """PNG·JPEG 의 가로·세로 화소를 헤더에서 읽습니다(외부 라이브러리 없이).
       그림의 원래 크기(orgSz)를 여기서 냅니다 — 틀리면 한글이 그림을
       늘여 그립니다."""
    b = Path(길).read_bytes()
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(b[16:20], "big"), int.from_bytes(b[20:24], "big")
    if b[:2] == b"\xff\xd8":                      # JPEG — SOF 마커를 찾습니다
        i = 2
        while i < len(b) - 9:
            if b[i] != 0xFF:
                i += 1
                continue
            m = b[i + 1]
            if m in (0xD8, 0xD9) or 0xD0 <= m <= 0xD7:
                i += 2
                continue
            n = int.from_bytes(b[i + 2:i + 4], "big")
            if 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):
                return (int.from_bytes(b[i + 7:i + 9], "big"),
                        int.from_bytes(b[i + 5:i + 7], "big"))
            i += 2 + n
    raise SystemExit("그림 크기를 못 읽었습니다: %s" % 길)


def 문단(글, 폭, charPr, paraPr=왼쪽, 크기=900, 페이지나눔=0, 속=None):
    """문단 하나를 만들고 (XML, 높이) 를 돌려줍니다.

       `속` 에 그림 XML 을 넘기면 글자 대신 그 그림이 들어갑니다(글자처럼
       놓인 그림). 그때 줄 높이는 그림 높이입니다."""
    간 = int(round(크기 * (줄간[paraPr] - 100) / 100.0))
    베이스 = int(round(크기 * 0.85))
    if 속 is not None:
        run = '<hp:run charPrIDRef="%d">%s<hp:t/></hp:run>' % (charPr, 속[0])
        자리, 높이 = [0], 속[1]
        베이스 = int(round(높이 * 0.85))
    elif 글:
        run = '<hp:run charPrIDRef="%d"><hp:t>%s</hp:t></hp:run>' % (charPr, 이스케이프(글))
        자리, 높이 = 줄나누기(글, 폭, 크기), 크기
    else:
        run = '<hp:run charPrIDRef="%d"/>' % charPr
        자리, 높이 = [0], 크기
    칸 = 높이 + 간
    segs = "".join(
        '<hp:lineseg textpos="%d" vertpos="%d" vertsize="%d" textheight="%d"'
        ' baseline="%d" spacing="%d" horzpos="0" horzsize="%d" flags="393216"/>'
        % (p, i * 칸, 높이, 높이, 베이스, 간, 폭)
        for i, p in enumerate(자리))
    xml = ('<hp:p id="0" paraPrIDRef="%d" styleIDRef="0" pageBreak="%d"'
           ' columnBreak="0" merged="0">%s<hp:linesegarray>%s</hp:linesegarray></hp:p>'
           % (paraPr, 페이지나눔, run, segs))
    return xml, len(자리) * 칸


def 칸(글들, col, row, 폭, charPr, paraPr, 크기, 테두리, 그림속=None, 높이=None):
    """표의 칸 하나. 안에 문단을 여러 개 담을 수 있습니다."""
    글폭안 = 폭 - 칸여백 * 2
    속들, 잰높이 = [], 0
    if 그림속 is not None:
        x, h = 문단("", 글폭안, charPr, paraPr, 크기, 속=그림속)
        속들.append(x)
        잰높이 += h
    # 그림만 든 칸에는 빈 문단을 덧붙이지 않습니다 — 그만큼 칸이 높아집니다
    for g in (글들 if (글들 or 그림속 is not None) else [""]):
        x, h = 문단(g, 글폭안, charPr, paraPr, 크기)
        속들.append(x)
        잰높이 += h
    h = 높이 if 높이 is not None else 잰높이 + 칸여백 * 2
    return ('<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0"'
            ' dirty="0" borderFillIDRef="%d"><hp:subList id="" textDirection="HORIZONTAL"'
            ' lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0"'
            ' textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">%s</hp:subList>'
            '<hp:cellAddr colAddr="%d" rowAddr="%d"/><hp:cellSpan colSpan="1" rowSpan="1"/>'
            '<hp:cellSz width="%d" height="%d"/>'
            '<hp:cellMargin left="%d" right="%d" top="%d" bottom="%d"/></hp:tc>'
            % (테두리, "".join(속들), col, row, 폭, h,
               칸여백, 칸여백, 칸여백, 칸여백)), h


def 표(행들, 폭들, 페이지나눔=0):
    """행들 = [[칸설명, …], …] · 칸설명 = dict(글들·charPr·paraPr·크기·테두리·그림속)

       한 행 안의 칸은 **높이가 같아야** 합니다 — 가장 높은 칸에 맞춥니다.
       (한글이 열 때 다시 재지만, 캐시가 어긋나면 첫 그리기가 틀어집니다)"""
    행XML, 총높이 = [], 0
    for r, 행 in enumerate(행들):
        잰 = [칸(c.get("글들"), i, r, 폭들[i], c["charPr"], c["paraPr"], c["크기"],
                c["테두리"], c.get("그림속"))[1] for i, c in enumerate(행)]
        h = max(잰)
        칸들 = [칸(c.get("글들"), i, r, 폭들[i], c["charPr"], c["paraPr"], c["크기"],
                  c["테두리"], c.get("그림속"), 높이=h)[0] for i, c in enumerate(행)]
        행XML.append("<hp:tr>%s</hp:tr>" % "".join(칸들))
        총높이 += h
    tbl = ('<hp:tbl id="%d" zOrder="%d" numberingType="TABLE" textWrap="TOP_AND_BOTTOM"'
           ' textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL"'
           ' repeatHeader="1" rowCnt="%d" colCnt="%d" cellSpacing="0" borderFillIDRef="%d"'
           ' noAdjust="0"><hp:sz width="%d" widthRelTo="ABSOLUTE" height="%d"'
           ' heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0"'
           ' flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA"'
           ' horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0"'
           ' horzOffset="0"/><hp:outMargin left="140" right="140" top="140" bottom="140"/>'
           '<hp:inMargin left="140" right="140" top="140" bottom="140"/>%s</hp:tbl>'
           % (새id(), 새id() % 100, len(행들), len(폭들), 표테두리,
              sum(폭들), 총높이, "".join(행XML)))
    바깥높이 = 총높이 + 280
    베이스 = int(round(바깥높이 * 0.85))
    xml = ('<hp:p id="0" paraPrIDRef="%d" styleIDRef="0" pageBreak="%d" columnBreak="0"'
           ' merged="0"><hp:run charPrIDRef="%d">%s<hp:t/></hp:run><hp:linesegarray>'
           '<hp:lineseg textpos="0" vertpos="0" vertsize="%d" textheight="%d" baseline="%d"'
           ' spacing="480" horzpos="0" horzsize="%d" flags="393216"/></hp:linesegarray>'
           '</hp:p>' % (가운데, 페이지나눔, 잔글, tbl, 바깥높이, 바깥높이, 베이스, 글폭))
    return xml, 바깥높이


def 그림(파일, binID, 목표폭, 최대높이):
    """글자처럼 놓인 그림(treatAsChar="1") XML 과 높이를 돌려줍니다.
       한글이 저장해 둔 그림(물질정보 hwpx 의 GHS 그림문자)을 본떴습니다 —
       요소 차례가 스키마에 정해져 있어 마음대로 바꾸면 파일이 안 열립니다."""
    px, py = png크기(사진폴더 / 파일)
    원폭, 원높이 = px * 75, py * 75            # 96dpi 기준 1화소 = 75 HWPUNIT
    폭, 높 = 목표폭, int(round(목표폭 * py / px))
    if 높 > 최대높이:
        높, 폭 = 최대높이, int(round(최대높이 * px / py))
    xml = (
        '<hp:pic id="%d" zOrder="%d" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM"'
        ' textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0"'
        ' instid="%d" reverse="0"><hp:offset x="0" y="0"/>'
        '<hp:orgSz width="%d" height="%d"/><hp:curSz width="%d" height="%d"/>'
        '<hp:flip horizontal="0" vertical="0"/>'
        '<hp:rotationInfo angle="0" centerX="0" centerY="0" rotateimage="0"/>'
        '<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
        '<hc:scaMatrix e1="%.6f" e2="0" e3="0" e4="0" e5="%.6f" e6="0"/>'
        '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>'
        '<hc:img binaryItemIDRef="%s" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>'
        '<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="%d" y="0"/><hc:pt2 x="%d" y="%d"/>'
        '<hc:pt3 x="0" y="%d"/></hp:imgRect>'
        '<hp:imgClip left="0" right="%d" top="0" bottom="%d"/>'
        '<hp:inMargin left="0" right="0" top="0" bottom="0"/>'
        '<hp:imgDim dimwidth="%d" dimheight="%d"/><hp:effects/>'
        '<hp:sz width="%d" widthRelTo="ABSOLUTE" height="%d" heightRelTo="ABSOLUTE"'
        ' protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1"'
        ' allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA"'
        ' vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
        '<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
        '<hp:shapeComment>그림입니다.&#10;원본 그림의 이름: %s&#10;'
        '원본 그림의 크기: 가로 %dpixel, 세로 %dpixel</hp:shapeComment></hp:pic>'
        % (새id(), 새id() % 100, 새id(), 원폭, 원높이, 폭, 높,
           폭 / 원폭, 높 / 원높이, binID,
           원폭, 원폭, 원높이, 원높이, 원폭, 원높이, 원폭, 원높이,
           폭, 높, 이스케이프(파일), px, py))
    return xml, 높


# ══ 본문 만들기 ════════════════════════════════════════════════
def 쪽머리(번호, 제목글, 페이지나눔):
    """`참고 N` 라벨과 제목 두 줄."""
    out, h = [], 0
    for 글, cp, pp, 크기, pb in (("참고 %d" % 번호, 라벨, 왼쪽, 1100, 페이지나눔),
                                (제목글, 제목, 가운데, 1500, 0)):
        x, dh = 문단(글, 글폭, cp, pp, 크기, 페이지나눔=pb)
        out.append(x)
        h += dh
    x, dh = 문단("", 글폭, 잔글, 왼쪽, 800)      # 제목과 표 사이 한 줄
    out.append(x)
    return "".join(out), h + dh


def 본문만들기():
    사진들 = []          # (binID, 파일이름) — manifest·BinData 에 함께 씁니다

    def 사진번호(파일):
        """⚠ 파일 안에서는 `image1.jpg` 처럼 부릅니다 — 한글이 스스로 저장할 때
           쓰는 이름입니다. 한국어 파일이름을 zip 안에 넣어 두면 만에 하나
           글자 인코딩으로 어긋날 수 있어, 그 위험을 아예 없앱니다.
           원래 이름은 그림의 설명(shapeComment)에 남습니다."""
        n = len(사진들) + 1
        binID = "image%d" % n
        사진들.append((binID, "image%d.jpg" % n, 파일))
        return binID

    조각, 높이 = [], 0

    # ── 참고 1 ────────────────────────────────────────────────
    x, h = 쪽머리(1, "「기후 AI프렌즈」 성과요약서", 0)
    조각.append(x)
    높이 += h
    행들 = [[
        {"글들": 이름.split("\n"), "charPr": 머리, "paraPr": 가운데, "크기": 1000,
         "테두리": 머리칸},
        {"글들": 줄들, "charPr": 본문, "paraPr": 왼쪽, "크기": 900, "테두리": 속칸},
    ] for 이름, 줄들 in 성과요약서]
    x, h = 표(행들, [7000, 표폭 - 7000])
    조각.append(x)
    높이 += h

    # ── 참고 2 ────────────────────────────────────────────────
    x, h = 쪽머리(2, "이미지(사진) 양식", 1)
    조각.append(x)

    파일, 설명 = 대표사진
    그XML, 그높이 = 그림(파일, 사진번호(파일), 표폭 - 5600 - 칸여백 * 2 - 400, 30000)
    x, _ = 표([
        [{"글들": ["대표", "이미지"], "charPr": 머리, "paraPr": 가운데, "크기": 1000,
          "테두리": 머리칸},
         {"글들": [], "charPr": 잔글, "paraPr": 가운데, "크기": 800, "테두리": 속칸,
          "그림속": (그XML, 그높이)}],
        [{"글들": ["설명"], "charPr": 머리, "paraPr": 가운데, "크기": 1000,
          "테두리": 머리칸},
         {"글들": 설명, "charPr": 본문, "paraPr": 왼쪽, "크기": 900, "테두리": 속칸}],
    ], [5600, 표폭 - 5600])
    조각.append(x)

    x, _ = 문단("", 글폭, 잔글, 왼쪽, 800)
    조각.append(x)

    # 추가 이미지 — 양식 그대로 두 장씩 나란히([이미지][이미지] / [설명][설명])
    반폭 = 표폭 // 2
    그림폭 = 반폭 - 칸여백 * 2 - 400
    for 둘 in (추가사진[:2], 추가사진[2:]):
        머리행, 그림행, 설명머리, 설명행 = [], [], [], []
        for 파일, 설명 in 둘:
            gx, gh = 그림(파일, 사진번호(파일), 그림폭, 26000)
            머리행.append({"글들": ["이미지"], "charPr": 머리, "paraPr": 가운데,
                          "크기": 1000, "테두리": 머리칸})
            그림행.append({"글들": [], "charPr": 잔글, "paraPr": 가운데, "크기": 800,
                          "테두리": 속칸, "그림속": (gx, gh)})
            설명머리.append({"글들": ["설명"], "charPr": 머리, "paraPr": 가운데,
                           "크기": 1000, "테두리": 머리칸})
            설명행.append({"글들": 설명, "charPr": 본문, "paraPr": 왼쪽, "크기": 900,
                          "테두리": 속칸})
        x, _ = 표([머리행, 그림행, 설명머리, 설명행], [반폭, 표폭 - 반폭])
        조각.append(x)
        x, _ = 문단("", 글폭, 잔글, 왼쪽, 800)
        조각.append(x)

    for 글 in 맺음:
        x, _ = 문단(글, 글폭, 잔글, 왼쪽, 800)
        조각.append(x)

    return "".join(조각), 사진들, 높이


# ══ 파일로 묶기 ════════════════════════════════════════════════
def 글자모양넣기(header):
    """새 글자모양을 header.xml 에 더합니다 — charPr 29 를 본떠 크기만 바꿉니다."""
    m = re.search(r'<hh:charPr id="29"[^>]*>.*?</hh:charPr>', header, re.S)
    본 = m.group(0)
    더할 = []
    for cid, 높이, 굵게 in 새글자:
        t = 본.replace('id="29"', 'id="%d"' % cid).replace('height="500"',
                                                           'height="%d"' % 높이)
        if 굵게:
            t = t.replace("<hh:underline", "<hh:bold/><hh:underline", 1)
        더할.append(t)
    header = header.replace(m.group(0), m.group(0) + "".join(더할), 1)
    cnt = int(re.search(r'<hh:charProperties itemCnt="(\d+)"', header).group(1))
    return header.replace('<hh:charProperties itemCnt="%d"' % cnt,
                          '<hh:charProperties itemCnt="%d"' % (cnt + len(새글자)), 1)


def 만들기():
    본문, 사진들, 참고1높이 = 본문만들기()

    with zipfile.ZipFile(양식파일) as z:
        원본 = {n: z.read(n) for n in z.namelist()}

    # ── section0.xml — 양식의 첫 문단(쪽 설정 secPr)을 그대로 이어 씁니다
    sec = 원본["Contents/section0.xml"].decode("utf-8")
    머리끝 = sec.index("</hp:ctrl></hp:run>") + len("</hp:ctrl></hp:run>")
    앞 = sec[:머리끝]
    # 쪽 설정이 든 첫 문단은 **빈 줄 하나**로 남습니다. 양식에서는 15pt·줄간
    # 170% 라 그 한 줄이 25pt 를 먹습니다 — 성과요약서가 한 쪽이어야 하므로
    # 8pt·줄간 120% 로 낮춥니다(문단·글자 모양 모두 양식에 있는 것).
    앞 = 앞.replace('paraPrIDRef="26" styleIDRef="53"',
                    'paraPrIDRef="%d" styleIDRef="0"' % 왼쪽, 1)
    앞 = 앞.replace('<hp:run charPrIDRef="17">', '<hp:run charPrIDRef="%d">' % 잔글, 1)
    새sec = 앞 + '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0"' \
        ' vertsize="800" textheight="800" baseline="680" spacing="160" horzpos="0"' \
        ' horzsize="%d" flags="393216"/></hp:linesegarray></hp:p>' % 글폭 + 본문 + "</hs:sec>"

    # ── header.xml — 글자모양만 더합니다(글꼴·문단모양·테두리는 양식 그대로)
    새header = 글자모양넣기(원본["Contents/header.xml"].decode("utf-8"))

    # ── content.hpf — 그림을 목록에 넣고, 남의 이름(작성자)은 지웁니다
    hpf = 원본["Contents/content.hpf"].decode("utf-8")
    항목 = "".join(
        '<opf:item id="%s" href="BinData/%s" media-type="image/jpg" isEmbeded="1"/>'
        % (bid, 안이름) for bid, 안이름, _ in 사진들)
    hpf = hpf.replace('<opf:item id="section0"', 항목 + '<opf:item id="section0"', 1)
    hpf = re.sub(r"<opf:title>.*?</opf:title>",
                 "<opf:title>「기후 AI프렌즈」 성과요약서 · 이미지 양식 — 화학안전치트키</opf:title>",
                 hpf, flags=re.S)
    # ⚠ 양식 파일에 남의 이름이 남아 있습니다 — 제출본에 넣지 않습니다.
    for 이름 in ("creator", "lastsaveby"):
        hpf = re.sub(r'(<opf:meta name="%s" content="text">).*?(</opf:meta>)' % 이름,
                     r"\1\2", hpf, flags=re.S)

    # ── 미리보기 글자(파일 탐색기·한글 열기 창에 보이는 것)
    미리 = "「기후 AI프렌즈」 성과요약서\n화학안전치트키 — 화학사고 초동대응 지원 서비스\n"

    낼파일.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(낼파일, "w", zipfile.ZIP_DEFLATED) as z:
        # mimetype 은 압축하지 않고 맨 앞에 둡니다(zip 규약)
        z.writestr(zipfile.ZipInfo("mimetype"), 원본["mimetype"],
                   compress_type=zipfile.ZIP_STORED)
        z.writestr("version.xml", 원본["version.xml"])
        z.writestr("settings.xml", 원본["settings.xml"])
        z.writestr("META-INF/container.xml", 원본["META-INF/container.xml"])
        z.writestr("META-INF/container.rdf", 원본["META-INF/container.rdf"])
        z.writestr("META-INF/manifest.xml", 원본["META-INF/manifest.xml"])
        z.writestr("Contents/header.xml", 새header)
        z.writestr("Contents/section0.xml", 새sec)
        z.writestr("Contents/content.hpf", hpf)
        z.writestr("Preview/PrvText.txt", 미리)
        z.writestr("Preview/PrvImage.png", 원본["Preview/PrvImage.png"])
        for _, 안이름, 파일 in 사진들:
            z.writestr("BinData/%s" % 안이름, (사진폴더 / 파일).read_bytes())

    검사(새sec, 새header, hpf, 사진들, 참고1높이)
    print("%s   %.0f KB" % (낼파일.relative_to(ROOT), 낼파일.stat().st_size / 1024))


def 검사(sec, header, hpf, 사진들, 참고1높이):
    """한글로 열어 볼 수 없으므로 **구조를 기계로** 대조합니다.
       (이 자리에는 한글이 없습니다 — 마지막 확인은 사용자가 합니다)"""
    import xml.dom.minidom
    문제 = []
    for 이름, x in (("section0", sec), ("header", header), ("content.hpf", hpf)):
        try:
            xml.dom.minidom.parseString(x.encode("utf-8"))
        except Exception as e:                      # noqa: BLE001
            문제.append("%s 이 XML 로 안 읽힙니다: %s" % (이름, e))

    # 표마다 칸 주소가 빠짐없이 채워졌는지 — 하나라도 비면 한글이 표를 못 그립니다
    for k, m in enumerate(re.finditer(r"<hp:tbl [^>]*rowCnt=\"(\d+)\" colCnt=\"(\d+)\"", sec)):
        r, c = int(m.group(1)), int(m.group(2))
        끝 = sec.index("</hp:tbl>", m.start())
        덩이 = sec[m.start():끝]
        주소 = set(re.findall(r'<hp:cellAddr colAddr="(\d+)" rowAddr="(\d+)"', 덩이))
        있어야 = {(str(j), str(i)) for i in range(r) for j in range(c)}
        if 주소 != 있어야:
            문제.append("표 %d: 칸 주소가 어긋납니다(%d개 있어야 하는데 %d개)"
                        % (k + 1, len(있어야), len(주소)))

    # 그림이 목록(content.hpf)에 다 있는지
    for bid, 안이름, 파일 in 사진들:
        if 'id="%s"' % bid not in hpf or 'href="BinData/%s"' % 안이름 not in hpf:
            문제.append("그림 %s(%s) 가 content.hpf 목록에 없습니다" % (bid, 파일))
    쓴것 = set(re.findall(r'binaryItemIDRef="([^"]+)"', sec))
    if 쓴것 != {b for b, _, _ in 사진들}:
        문제.append("본문이 부르는 그림과 넣은 그림이 다릅니다: %s" % (쓴것,))

    # ⚠ 줄배치 캐시 — 2026-09-14 에 글자가 겹쳐 나온 바로 그 자리입니다.
    #   ① 문단마다 하나씩 있어야 하고
    #   ② 한 문단 안의 vertpos 는 **줄마다 커져야** 합니다(같으면 겹쳐 그립니다)
    문단수 = sec.count("<hp:p ")
    배치수 = sec.count("<hp:linesegarray>")
    if 문단수 != 배치수:
        문제.append("문단 %d개인데 줄배치는 %d개입니다" % (문단수, 배치수))
    for k, m in enumerate(re.finditer(r"<hp:linesegarray>(.*?)</hp:linesegarray>", sec, re.S)):
        세로 = [int(v) for v in re.findall(r'vertpos="(-?\d+)"', m.group(1))]
        if 세로 != sorted(set(세로)):
            문제.append("줄배치 %d: 줄 자리가 겹치거나 거꾸로입니다 %s" % (k + 1, 세로))

    # 참고 1 이 한 쪽을 넘기지 않는지 — 양식이 "성과요약서(1page)" 라고 못 박았습니다
    print("  참고 1 높이 %d / 한 쪽 %d HWPUNIT (%.0f%%)"
          % (참고1높이, 글높이, 참고1높이 * 100.0 / 글높이))
    if 참고1높이 > 글높이:
        문제.append("참고 1 이 한 쪽을 넘깁니다 — 줄을 줄이세요(%d > %d)"
                    % (참고1높이, 글높이))

    if 문제:
        print("\n⚠ 확인해야 할 것")
        for t in 문제:
            print("  - " + t)
        raise SystemExit(1)
    print("  구조 검사 통과 — 표 칸·그림 목록·줄배치 이상 없음")
    print("  ⚠ 한글로 열어 본 것은 아닙니다(이 자리에 한글이 없습니다).")


if __name__ == "__main__":
    만들기()
