#!/usr/bin/env python3
"""한글(hwpx) 양식 도구 — 읽기 · 점검 · 줄맞춤 · 검사.

    python3 hwpx_tool.py 읽기  문서.hwpx              # 문단 글자를 차례대로(칸 안 줄바꿈 뒤 글자까지)
    python3 hwpx_tool.py 점검  문서.hwpx              # 한글이 저장해 둔 줄 꺾임으로 「낱말 가운데 끊김」·「짧은 끝줄」 찾기
    python3 hwpx_tool.py 맞춤  문서.hwpx -o 새.hwpx   # 어절 단위로 바꾸고, 자간을 문단마다 자동으로 조정
    python3 hwpx_tool.py 검사  원본.hwpx 새.hwpx      # 고친 뒤 구조가 그대로인지(글자·표·그림 수, zip 차례)

맞춤이 자간을 바꾸는 자리 — **줄이기만** 합니다(2026-11-11 사용자 — "자간을 줄여서만 맞추는게 좋아 …
애매하게 둘·세 개 단어로 인해 두 줄로 늘어난 경우에도 자간을 줄여서 한 줄로 … 사각형의 모양을 갖추도록").
문단 하나씩, 가장 적게 줄인 값을 씁니다. 글자 모양의 자간이 바닥(기본 −12%) 아래로는 내려가지 않습니다.
머리(「  ○ 」「   - 」)는 그대로 두고 몸글만 줄입니다(run 을 나눔) — 사용자가 손으로 맞춘 예시가 그렇습니다.
얼마나 줄일지는 한글이 저장해 둔 그 문단의 줄 꺾임으로 문단마다 잽니다(배율구간).
  ⓪ 좁은 칸에 한 낱말이 안 들어가 글자로 꺾일 곳(「화학물질안|전원」) — 한 줄에 넣음
  ㉠ 끝줄이 남는 문단 — 끝줄을 윗줄로 올려 줄을 하나 줄임(두세 낱말 꼬리를 없애 사각형으로)
  ㉡ 양쪽 정렬에서 다음 낱말이 못 올라와 빈칸이 줄 폭의 10% 넘게 벌어질 줄 — 그 낱말을 끌어올림
  고를 때는 줄인 자간이 빈칸에 안 먹는다고 비관적으로 보고, 줄 수·낱말 가운데 꺾임이 늘면 쓰지 않습니다.
  자간을 넓히지는 않습니다 — 넓혀서 끝줄을 채우면 글자가 성겨 보입니다.

표준 라이브러리만 씁니다. 한글 프로그램이 없는 곳(리눅스)에서 돕니다 — 마지막 확인은 한글에서 여는 것.

━━ 이 도구가 근거로 삼는 사실 (2026-11-11 · 한글이 직접 저장한 원본 다섯 개의 줄 꺾임 8천여 곳으로 확인) ━━
   원본 = 주최 측 양식 2 · 기관 원자료 2 · 팀원이 한글에서 저장한 파일 1. 우리 스크립트가 만든 파일은
   줄배치 캐시를 우리가 적었으므로(같은 어림으로) 근거에서 뺐습니다 — 넣으면 제 답을 제가 맞히는 셈입니다.
① 문단 모양의 「줄 나눔 기준 — 한글 단위」는 header.xml 의 breakNonLatinWord 입니다.
   **이름과 반대로** BREAK_WORD = 어절 단위(빈칸에서만 꺾음), KEEP_WORD = 글자 단위(「화학사/고」).
   빈칸이 있는 줄에서 BREAK_WORD 문단은 4,568번 꺾어 낱말 가운데 끊김 0, KEEP_WORD 문단은 3,408번 가운데 681.
   한글의 기본값이 글자 단위라 양식 대부분이 KEEP_WORD 입니다.
② 자간은 글자 모양(charPr)의 <hh:spacing hangul=… latin=…> — 글자 크기에 대한 % (−50~50).
   장평은 <hh:ratio>. 한 문단만 자간을 바꾸려면 글자 모양을 복제해 새 번호를 붙이고 그 문단 run 만 바꿉니다.
③ 줄배치 캐시(<hp:linesegarray>)는 한글이 저장할 때 적어 둔 「몇 번째 글자부터 · 세로 어디」입니다.
   글을 바꿔 줄이 늘었는데 캐시가 모자라면 한글이 줄을 겹쳐 그립니다(이 저장소에서 실제로 겪음).
   **캐시를 아예 지우면 한글이 열 때 다시 계산합니다**(공개 hwpx 스킬 Canine89/hwpxskill 의 규칙 —
   「치환 후 hp:linesegarray 를 제거해 한글이 줄바꿈을 재계산하게 한다」). 그래서 맞춤은 기본으로 지웁니다.
   지우기가 안 맞는 한글 판이면 --캐시다시쓰기: 줄 수를 넉넉히(폭 3% 줄여) 세어 다시 쓰고 뒤 문단을 내립니다.
④ 내어쓰기(hc:intent < 0) 문단은 둘째 줄부터 |intent| 만큼 좁습니다 — 캐시의 horzsize 는 그대로라
   따로 빼야 합니다. intent 는 <hp:switch> 의 case 값(HWPUNIT)을 씁니다(default 는 그 두 배).
⑤ 글자 폭 모형(맑은 고딕 기준 한글 0.98em · 빈칸 0.47em · 숫자 0.5em · 고정폭 빈칸 0.15em)은 원본의 어절 단위
   줄 4,738개 가운데 87.0% 의 꺾는 자리를 정확히 맞히고, 어긋나도 대개 ±3% 안입니다. 그래서 자간 판단에
   3% 여유를 두고, 폭을 ±3% 바꿔 봐도 나빠지지 않을 때만 바꿉니다.
   문서에 한글이 저장한 줄이 넉넉하면(글꼴마다 200줄 이상) 그 문서로 다시 맞춥니다 — 적으면 흔들려서
   (61줄로 맞췄더니 빈칸 0.59em 처럼 동떨어진 값이 나옴) 기본값을 씁니다.
"""
import argparse
import re
import sys
import unicodedata
import zipfile

어절, 글자 = "BREAK_WORD", "KEEP_WORD"          # ① 이름과 반대 — 바꾸지 마세요
# 어절 단위에서 한글이 줄을 꺾는 빈칸 — 보통 빈칸과 고정폭 빈칸(fwSpace · 한글이 저장한 줄 161곳이 그 뒤에서 꺾임).
# 묶음 빈칸(nbSpace · U+00A0)은 한글 도움말대로 「두 낱말을 떼어 놓지 않는」 빈칸이라 넣지 않습니다
# (이 저장소 문서에는 묶음 빈칸이 하나도 없어 실제 꺾임으로는 확인 못 함).
꺾는빈칸 = " \u3000"

기본폭 = {                                        # ⑤ 글꼴별 em 비율(K 한글 · S 빈칸 · D 숫자)
    "맑은 고딕": {"K": 0.98, "S": 0.47, "D": 0.50},
    "함초롬바탕": {"K": 0.97, "S": 0.50, "D": 0.60},
    # 휴먼명조는 사용자가 한글에서 손으로 맞춘 예시(2026-11-11)로 맞춤 — 자간을 1%씩 줄여 한 줄에 들어간 값
    # −11·−5·−2·−6·−12 와 저장된 줄 꺾임 26개 가운데 22개가 맞고, 다섯 값을 ±1 안에서 다시 냅니다.
    # 기본값(*)으로는 −8·−3·0·−2·−8 로 덜 줄여 셋이 두 줄로 남았습니다. 자료가 적어 더 받으면 다시 맞추세요.
    "휴먼명조": {"K": 0.98, "S": 0.60, "D": 0.55},
    "*": {"K": 0.98, "S": 0.50, "D": 0.55},
}
# F 고정폭 빈칸은 어절 단위 문단에서 한글이 저장한 줄 994개로 맞춘 값(0.15em 에서 86.6% · 0.5em 이면 70.9%)
공통폭 = {"F": 0.15, "L": 0.50, "U": 0.62, "p": 0.30, "b": 0.33, "h": 0.38, "m": 0.36, "o": 0.55}


def 갈래(ch):
    o = ord(ch)
    if ch == "\u3000":                      # 고정폭 빈칸(fwSpace) — 양쪽 정렬에서도 폭이 그대로
        return "F"
    if 0xAC00 <= o <= 0xD7A3 or 0x3130 <= o <= 0x318F or 0x1100 <= o <= 0x11FF:
        return "K"
    if ch in "  ":
        return "S"
    if ch.isdigit():
        return "D"
    if ch.isascii() and ch.isalpha():
        return "U" if ch.isupper() else "L"
    if ch in ".,:;!'\"`":
        return "p"
    if ch in "()[]{}":
        return "b"
    if ch in "-/~":
        return "h"
    if ch in "·・":
        return "m"
    if unicodedata.east_asian_width(ch) in ("W", "F", "A"):
        return "W"
    return "o"


# ══ 파일 ════════════════════════════════════════════════════════════
class 문서:
    """hwpx(zip) 한 개. 저장할 때 파일 차례·압축 방식을 그대로 둡니다(mimetype 이 맨 앞 · 압축 없음이어야 한글이 엶)."""

    def __init__(self, 경로):
        with zipfile.ZipFile(경로) as z:
            self.목록 = z.infolist()
            self.속 = {i.filename: z.read(i.filename) for i in self.목록}
        self.header = self.속["Contents/header.xml"].decode("utf-8")
        self.구역들 = sorted((n for n in self.속 if re.match(r"Contents/section\d+\.xml$", n)),
                          key=lambda n: int(re.search(r"(\d+)", n.split("/")[-1]).group(1)))
        self.구역 = {n: self.속[n].decode("utf-8") for n in self.구역들}
        self._표읽기()

    def _표읽기(self):
        h = self.header
        m = re.search(r'<hh:fontface lang="HANGUL"[^>]*>(.*?)</hh:fontface>', h, re.S)
        글꼴 = {f.group(1): f.group(2) for f in re.finditer(r'<hh:font id="(\d+)" face="([^"]+)"', m.group(1))} if m else {}
        self.글자모양 = {}
        for c in re.finditer(r'<hh:charPr id="(\d+)"([^>]*)>(.*?)</hh:charPr>', h, re.S):
            g = c.group(3)
            fr = re.search(r'<hh:fontRef hangul="(\d+)"', g)
            rt = re.search(r'<hh:ratio hangul="(-?\d+)"', g)
            sp = re.search(r'<hh:spacing hangul="(-?\d+)"', g)
            self.글자모양[c.group(1)] = {
                "글꼴": 글꼴.get(fr.group(1), "?") if fr else "?",
                "크기": int(re.search(r'height="(\d+)"', c.group(2)).group(1)),
                "장평": int(rt.group(1)) if rt else 100,
                "자간": int(sp.group(1)) if sp else 0,
            }
        self.문단모양 = {}
        for p in re.finditer(r'<hh:paraPr id="(\d+)"([^>]*)>(.*?)</hh:paraPr>', h, re.S):
            g = p.group(3)
            b = re.search(r'breakNonLatinWord="(\w+)"', g)
            it = re.search(r'<hc:intent value="(-?\d+)"', g)             # 첫 값 = hp:case(HWPUNIT)
            al = re.search(r'<hh:align horizontal="(\w+)"', g)
            cd = re.search(r'condense="(\d+)"', p.group(2))
            self.문단모양[p.group(1)] = {
                "줄나눔": b.group(1) if b else 글자,
                "들여": int(it.group(1)) if it else 0,
                "정렬": al.group(1) if al else "JUSTIFY",
                "공백최소": int(cd.group(1)) if cd else 0,
            }

    def 저장(self, 경로):
        self.속["Contents/header.xml"] = self.header.encode("utf-8")
        for n in self.구역들:
            self.속[n] = self.구역[n].encode("utf-8")
        with zipfile.ZipFile(경로, "w") as z:
            for i in self.목록:
                z.writestr(i, self.속[i.filename], compress_type=i.compress_type)


# ══ 문단 ════════════════════════════════════════════════════════════
def 문단들(구역):
    """가장 안쪽 문단(안에 다른 <hp:p> 가 없는 것)의 (시작, 끝, 담는칸) — 담는칸은 감싼 <hp:subList> 자리(없으면 -1)."""
    나온, 열린, 칸 = [], [], []
    for m in re.finditer(r"<hp:p\b|</hp:p>|<hp:subList\b|</hp:subList>", 구역):
        t = m.group(0)
        if t == "<hp:p":
            열린.append([m.start(), False])
        elif t == "</hp:p>":
            a, 자식 = 열린.pop()
            if 열린:
                열린[-1][1] = True
            if not 자식:
                나온.append((a, m.end(), 칸[-1] if 칸 else -1))
        elif t == "<hp:subList":
            칸.append(m.start())
        else:
            칸.pop()
    return 나온


복잡 = re.compile(r"<hp:(tbl|pic|ctrl|tab|fieldBegin|fieldEnd|equation|rect|ellipse|line|container|ole|textart|footNote|endNote)\b")


틀문단 = re.compile(r"<hp:(tbl|pic|ole|equation|rect|ellipse|line|container|textart|ctrl|polygon|curve|arc|connectLine)\b")


def 글자열(문단):
    """[(글자, charPr번호)] — 칸 안 줄바꿈(<hp:lineBreak/>)은 '\\n' 한 글자(한글의 textpos 도 한 글자로 셈).
    글자 수를 셀 수 없는 것(표·그림·탭·필드)이 있으면 None."""
    if 복잡.search(문단):
        return None
    나온 = []
    for r in re.finditer(r"<hp:run\b([^>]*?)(?:/>|>(.*?)</hp:run>)", 문단, re.S):
        cp = re.search(r'charPrIDRef="(\d+)"', r.group(1)).group(1)
        for t in re.finditer(r"<hp:t>(.*?)</hp:t>|<hp:t/>", r.group(2) or "", re.S):
            s = t.group(1) or ""
            s = re.sub(r"<hp:lineBreak/>", "\n", s)
            s = re.sub(r"<hp:nbSpace/>", " ", s)
            s = re.sub(r"<hp:fwSpace/>", "　", s)
            s = re.sub(r"<hp:hyphen/>", "-", s)
            if "<" in s:
                return None
            s = s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").replace("&amp;", "&")
            나온 += [(ch, cp) for ch in s]
    return 나온


def 줄배치(문단):
    """[dict] — 캐시의 줄마다 textpos·vertpos·vertsize·spacing·horzpos·horzsize·flags."""
    나온 = []
    for g in re.finditer(r"<hp:lineseg\b([^>]*)/>", 문단):
        d = {k: int(v) for k, v in re.findall(r'(\w+)="(-?\d+)"', g.group(1))}
        나온.append(d)
    return 나온


def 문단모양번호(문단):
    m = re.match(r"<hp:p\b[^>]*paraPrIDRef=\"(\d+)\"", 문단)
    return m.group(1) if m else None


# ══ 폭과 줄 나누기 ══════════════════════════════════════════════════
def 폭(글, 모양, 표, 더할자간=0, 공백최소=0):
    """HWPUNIT. 자간은 글자 크기에 대한 % 를 글자마다 더합니다."""
    w = 0.0
    for ch, cp in 글:
        g = 모양[cp]
        q = 표.get(g["글꼴"]) or 표["*"]
        k = 갈래(ch)
        b = q.get(k, q["K"] if k == "W" else 공통폭.get(k, 0.55))
        cw = (b * g["장평"] / 100 + (g["자간"] + 더할자간) / 100) * g["크기"]
        if k == "S":
            cw *= 1 - 공백최소 / 100
        w += max(cw, 0)
    return w


def 줄폭(줄들, 번째, 들여):
    """캐시의 horzsize 에서 들여쓰기·내어쓰기(④)를 뺀 실제 쓸 폭."""
    d = 줄들[min(번째, len(줄들) - 1)]
    w = d.get("horzsize", 0)
    return w - (max(0, 들여) if 번째 == 0 else max(0, -들여))


def 줄나누기(글, 모양, 표, 줄들, 들여, 어절단위=True, 더할자간=0, 배율=1.0, 공백최소=0):
    """줄마다 시작 글자 자리. 어절 단위면 빈칸에서만 꺾고, 한 어절이 한 줄보다 길 때만 글자로 꺾습니다.
    줄 끝 빈칸은 폭에 넣지 않습니다(한글처럼)."""
    시작들, i, n = [0], 0, len(글)
    줄시작 = 0

    def W():
        return 줄폭(줄들, len(시작들) - 1, 들여) * 배율

    while i < n:
        if 글[i][0] == "\n":
            i += 1
            시작들.append(i)
            줄시작 = i
            continue
        if 어절단위:
            j = i
            while j < n and 글[j][0] not in 꺾는빈칸 + "\n":
                j += 1
            낱말 = 글[줄시작:j]
            if 폭(낱말, 모양, 표, 더할자간, 공백최소) <= W() or i == 줄시작:
                if i == 줄시작 and 폭(낱말, 모양, 표, 더할자간, 공백최소) > W():
                    # 한 어절이 줄보다 김 — 글자로 꺾음
                    k = i
                    while k < j and 폭(글[줄시작:k + 1], 모양, 표, 더할자간, 공백최소) <= W():
                        k += 1
                    k = max(k, i + 1)
                    if k < j:
                        시작들.append(k)
                        줄시작 = i = k
                        continue
                i = j
                while i < n and 글[i][0] in 꺾는빈칸:
                    i += 1
            else:
                시작들.append(i)
                줄시작 = i
        else:
            if 폭(글[줄시작:i + 1], 모양, 표, 더할자간, 공백최소) <= W() or i == 줄시작:
                i += 1
            else:
                시작들.append(i)
                줄시작 = i
    return [s for s in 시작들 if s < n] or [0]


# ══ 문서로 폭 맞추기 ════════════════════════════════════════════════
def 줄제약(문서들):
    """한글이 저장한 줄 꺾임에서 (꺾이기 전까지 글, 다음 단위까지 글, 쓸 폭, 공백최소, 모양)."""
    나온 = []
    for d in 문서들:
        for n in d.구역들:
            s = d.구역[n]
            for a, b, _ in 문단들(s):
                p = s[a:b]
                글 = 글자열(p)
                줄들 = 줄배치(p)
                pid = 문단모양번호(p)
                if not 글 or len(줄들) < 2 or pid not in d.문단모양 or any(c in "\u3000\u00a0" for c, _ in 글):
                    continue
                pp = d.문단모양[pid]
                어절단위 = pp["줄나눔"] == 어절
                for i in range(len(줄들) - 1):
                    s0, s1 = 줄들[i].get("textpos", 0), 줄들[i + 1].get("textpos", 0)
                    if s1 <= s0 or s1 >= len(글) or 글[s1 - 1][0] == "\n":
                        continue
                    줄 = 글[s0:s1]
                    들어 = 줄[:]
                    while 들어 and 들어[-1][0] == " ":
                        들어.pop()
                    if not 들어:
                        continue
                    남은 = 글[s1:]
                    if 어절단위 and 줄[-1][0] == " ":
                        다음 = []
                        for x in 남은:
                            if x[0] in " \n":
                                break
                            다음.append(x)
                        넘침 = 들어 + [(" ", 줄[-1][1])] + 다음
                    elif 줄[-1][0] == " ":
                        넘침 = 들어 + [(" ", 줄[-1][1])] + 남은[:1]
                    else:
                        넘침 = 들어 + 남은[:1]
                    Wd = 줄폭(줄들, i, pp["들여"])
                    나온.append((들어, 넘침, Wd, pp["공백최소"], d.글자모양))
    return 나온


def 폭맞추기(문서, 최소줄=200):
    """글꼴마다 한글이 저장한 줄이 넉넉하면 K(한글)·S(빈칸)를 그 문서로 다시 맞춥니다. (표, 보고)"""
    표 = {k: dict(v) for k, v in 기본폭.items()}
    보고 = []
    제약 = 줄제약([문서])
    글꼴별 = {}
    for c in 제약:
        글꼴별.setdefault(c[4][c[0][0][1]]["글꼴"], []).append(c)
    for f, cc in 글꼴별.items():
        if len(cc) < 최소줄:
            continue
        cc = cc[:: max(1, len(cc) // 800)]
        기준 = dict(표.get(f) or 표["*"])
        기본점수 = sum(1 for a, o, Wd, cd, m in cc if 폭(a, m, 표, 0, cd) <= Wd < 폭(o, m, 표, 0, cd))
        best = None
        for K in [x / 100 for x in range(93, 104)]:
            for S in [x / 100 for x in range(35, 61, 3)]:
                시험 = {f: dict(기준, K=K, S=S), "*": 표["*"]}
                ok = sum(1 for a, o, Wd, cd, m in cc if 폭(a, m, 시험, 0, cd) <= Wd < 폭(o, m, 시험, 0, cd))
                if best is None or ok > best[0]:
                    best = (ok, K, S)
        # 기본값(5,489줄로 맞춘 것)보다 3%p 이상 나을 때만 바꿉니다 — 문서 하나로 맞춘 값은 흔들립니다
        if best[0] - 기본점수 >= 0.03 * len(cc):
            표[f] = dict(기준, K=best[1], S=best[2])
            보고.append(f"{f}: 이 문서의 줄 {len(cc)}개로 다시 맞춤 — 한글 {best[1]}em · 빈칸 {best[2]}em · "
                      f"맞은 비율 {100 * 기본점수 / len(cc):.0f}% → {100 * best[0] / len(cc):.0f}%")
        else:
            보고.append(f"{f}: 기본값 그대로 — 이 문서의 줄 {len(cc)}개 가운데 {100 * 기본점수 / len(cc):.0f}% 가 맞음")
    return 표, 보고


# ══ 점검 — 한글이 저장한 줄 꺾임 그대로 ═══════════════════════════════
def 점검(문서, 끝줄어절=3):
    """낱말 가운데 끊김과 짧은 끝줄(마지막 줄이 끝줄어절 이하 — 사각형이 깨지는 곳). 한글이 실제로 그린 줄이라 정확합니다."""
    끊김, 외톨이 = [], []
    for n in 문서.구역들:
        s = 문서.구역[n]
        for a, b, _ in 문단들(s):
            p = s[a:b]
            글 = 글자열(p)
            줄들 = 줄배치(p)
            if not 글 or len(줄들) < 2:
                continue
            t = "".join(c for c, _ in 글)
            자리 = [d.get("textpos", 0) for d in 줄들]
            for i, s1 in enumerate(자리[1:], 1):
                if 0 < s1 < len(t) and t[s1 - 1] not in 꺾는빈칸 + "\n" and t[s1] not in 꺾는빈칸 + "\n" \
                        and any(c in 꺾는빈칸 for c in t[자리[i - 1]:s1].strip()):
                    끊김.append(f"{t[max(자리[i - 1], s1 - 14):s1]}|{t[s1:s1 + 8]}")
            끝 = t[자리[-1]:].strip()
            본문줄 = 줄들[0].get("horzsize", 0) >= 15 * 문서.글자모양.get(글[0][1], {"크기": 1000})["크기"]  # 좁은 표 칸은 뺌(맞춤과 같게)
            if 본문줄 and 자리[-1] > 0 and t[자리[-1] - 1] != "\n" and 0 < len(끝.split()) <= 끝줄어절:
                외톨이.append(f"{t[max(0, 자리[-1] - 16):자리[-1]]}|{끝}")
    return 끊김, 외톨이


# ══ 맞춤 ════════════════════════════════════════════════════════════
머리꼴 = re.compile(r"^[ 　\t]*(?:[□■○●◦◎◇◆▪▫▶▷►※\-–·•ㆍ]|[①-⑳]|\(?[0-9]{1,2}[.)]|\(?[가-하][.)])?[ 　\t]*")


def 머리길이(t):
    """문단 앞의 머리(빈칸 + □ ○ - ① 1. 가) 같은 기호 + 빈칸) 글자 수. 기호가 없으면 앞 빈칸만."""
    return len(머리꼴.match(t).group(0))


def 가상모양(문서, cp, 더할):
    """폭을 어림할 때만 쓰는 「자간을 더할 만큼 바꾼 글자 모양」. 열쇠가 숫자가 아니라 header 에는 안 들어갑니다."""
    열쇠 = f"{cp}~{더할}"
    if 열쇠 not in 문서.글자모양:
        g = dict(문서.글자모양[cp])
        g["자간"] = max(-50, min(50, g["자간"] + 더할))
        문서.글자모양[열쇠] = g
    return 열쇠


def 몸글자간(문서, p, k, 더할):
    """문단 p 의 k 번째 글자부터 자간을 더할 만큼 바꾼 글자 모양으로 — 그 앞(머리)은 그대로.
    k 가 run 한가운데면 그 run 을 둘로 나눕니다(사용자가 한글에서 블록을 잡고 자간을 줄인 것과 같은 모양)."""
    토막꼴 = re.compile(r"&[#\w]+;|<hp:(?:lineBreak|nbSpace|fwSpace|hyphen)/>|.", re.S)
    나온, 끝, 센 = [], 0, 0
    for r in re.finditer(r'<hp:run\b([^>]*?)charPrIDRef="(\d+)"([^>]*?)(?:/>|>(.*?)</hp:run>)', p, re.S):
        나온.append(p[끝:r.start()])
        끝 = r.end()
        앞속, cp, 뒤속, 몸 = r.group(1), r.group(2), r.group(3), r.group(4)
        글들 = re.findall(r"<hp:t>(.*?)</hp:t>|<hp:t/>", 몸 or "", re.S)
        길이 = sum(len(토막꼴.findall(x or "")) for x in 글들)
        새 = 자간복제(문서, cp, 더할)
        if 센 >= k:
            나온.append(r.group(0).replace(f'charPrIDRef="{cp}"', f'charPrIDRef="{새}"', 1))
        elif 센 + 길이 <= k or 몸 is None:
            나온.append(r.group(0))
        else:
            # k 가 이 run 안 — <hp:t> 가 하나뿐일 때만 나눕니다(머리는 늘 첫 run 의 맨 앞이라 실제로 그렇습니다)
            if len(글들) == 1 and 몸.strip().startswith("<hp:t>") and 몸.strip().endswith("</hp:t>"):
                토막 = 토막꼴.findall(글들[0])
                앞글, 뒤글 = "".join(토막[:k - 센]), "".join(토막[k - 센:])
                나온.append(f'<hp:run{앞속}charPrIDRef="{cp}"{뒤속}><hp:t>{앞글}</hp:t></hp:run>'
                          f'<hp:run{앞속}charPrIDRef="{새}"{뒤속}><hp:t>{뒤글}</hp:t></hp:run>')
            else:
                나온.append(r.group(0).replace(f'charPrIDRef="{cp}"', f'charPrIDRef="{새}"', 1))
        센 += 길이
    나온.append(p[끝:])
    return "".join(나온)


def 자간복제(문서, cp, 더할):
    """글자 모양 cp 를 자간만 더할 만큼 바꿔 복제하고 새 번호를 돌려줍니다(같은 것은 한 번만)."""
    열쇠 = (cp, 더할)
    문서._복제 = getattr(문서, "_복제", {})
    if 열쇠 in 문서._복제:
        return 문서._복제[열쇠]
    h = 문서.header
    m = re.search(r'<hh:charPr id="%s"[^>]*>.*?</hh:charPr>' % cp, h, re.S)
    새번호 = str(max(int(k) for k in 문서.글자모양 if k.isdigit()) + 1)

    def 바꿈(sp):
        return re.sub(r'="(-?\d+)"', lambda v: '="%d"' % max(-50, min(50, int(v.group(1)) + 더할)), sp.group(0))
    새 = re.sub(r"<hh:spacing\b[^>]*/>", 바꿈, m.group(0), count=1)
    새 = re.sub(r'^<hh:charPr id="\d+"', '<hh:charPr id="%s"' % 새번호, 새)
    끝 = h.index("</hh:charProperties>")
    h = h[:끝] + 새 + h[끝:]
    h = re.sub(r'(<hh:charProperties itemCnt=")(\d+)"', lambda v: v.group(1) + str(int(v.group(2)) + 1) + '"', h, count=1)
    문서.header = h
    g = dict(문서.글자모양[cp])
    g["자간"] = max(-50, min(50, g["자간"] + 더할))
    문서.글자모양[새번호] = g
    문서._복제[열쇠] = 새번호
    return 새번호


def 줄배치새로(문단, 줄수, 시작들, 밀기):
    """캐시를 줄수만큼 다시 씁니다. 세로 자리는 원래 첫 줄 + 밀기, 줄 간격은 원래 값."""
    m = re.search(r"<hp:linesegarray>(.*?)</hp:linesegarray>", 문단, re.S)
    if not m:
        return 문단
    원래 = re.findall(r"<hp:lineseg\b[^>]*/>", m.group(1))
    if not 원래:
        return 문단
    줄들 = 줄배치(문단)
    간격 = (줄들[1]["vertpos"] - 줄들[0]["vertpos"]) if len(줄들) > 1 and 줄들[1]["vertpos"] > 줄들[0]["vertpos"] \
        else 줄들[0].get("vertsize", 1000) + 줄들[0].get("spacing", 0)
    조각 = []
    for i in range(줄수):
        틀 = 원래[min(i, len(원래) - 1)] if i < len(원래) else (원래[1] if len(원래) > 1 else 원래[0])
        tp = 시작들[i] if i < len(시작들) else (시작들[-1] + 1 if 시작들 else 0)
        vp = 줄들[0]["vertpos"] + 밀기 + i * 간격
        틀 = re.sub(r'textpos="\d+"', 'textpos="%d"' % tp, 틀)
        틀 = re.sub(r'vertpos="-?\d+"', 'vertpos="%d"' % vp, 틀)
        if i > 0 and len(원래) == 1:
            틀 = re.sub(r'flags="\d+"', 'flags="1441792"', 틀)          # 둘째 줄부터의 표시(양식이 쓰는 값)
        조각.append(틀)
    return 문단[:m.start(1)] + "".join(조각) + 문단[m.end(1):]


def 배율구간(글, 줄들, 들여, cd, 모양, 표, 어절단위):
    """한글이 저장한 줄 꺾임으로 이 문단 글의 「실제 폭 ÷ 어림 폭」(f) 이 들 수 있는 구간 (lo, hi].
    줄마다 — 그 줄 글은 들어갔으니 f ≤ 폭/어림, 다음 글자(어절 단위면 다음 낱말)까지는 안 들어갔으니 f > 폭/어림.
    캐시가 글과 안 맞으면(우리가 글을 바꾸고 캐시를 둔 파일 등) None."""
    자리 = [z.get("textpos", 0) for z in 줄들]
    if not 글 or 자리[0] != 0 or 자리 != sorted(자리) or len(set(자리)) != len(자리) or 자리[-1] >= len(글):
        return None
    lo, hi = 0.0, float("inf")
    for i, s0 in enumerate(자리):
        s1 = 자리[i + 1] if i + 1 < len(자리) else len(글)
        줄 = 글[s0:s1]
        들어 = list(줄)
        while 들어 and 들어[-1][0] in 꺾는빈칸 + "\n":
            들어.pop()
        if not 들어:
            continue
        W = 줄폭(줄들, i, 들여)
        m = 폭(들어, 모양, 표, 0, cd)
        if m > 0:
            hi = min(hi, W / m)
        if i + 1 < len(자리) and 줄[-1][0] != "\n":
            남은 = 글[s1:]
            if 줄[-1][0] in 꺾는빈칸:
                다음 = []
                for x in 남은:
                    if x[0] in 꺾는빈칸 + "\n" or (다음 and not 어절단위):
                        break
                    다음.append(x)
                넘침 = 들어 + [(" ", 줄[-1][1])] + 다음
            else:
                넘침 = 들어 + 남은[:1]
            mo = 폭(넘침, 모양, 표, 0, cd)
            if mo > 0:
                lo = max(lo, W / mo)
    if lo > hi or hi < 0.8 or lo > 1.25:
        return None
    return lo, hi


def 맞춤(문서, 표, 자간바닥=-12, 여유=2, 끝줄어절=3, 캐시=False, 빈칸한도=10):
    """① 모든 문단 모양을 어절 단위로(빈칸에서만 꺾음).
    ② 자간은 **줄이기만** 합니다(사용자 — "자간을 줄여서만 맞추는게 좋아"). 문단마다 가장 적게 줄여서
       ⓪ 좁은 칸의 긴 낱말이 글자로 꺾이지 않게 → ㉠ 끝줄을 윗줄로 올려 줄을 하나 줄이게(사각형 모양) →
       ㉡ 양쪽 정렬로 빈칸이 빈칸한도% 넘게 벌어지는 줄을 메우게. 글자 모양의 자간이 자간바닥(%) 아래로는
       내려가지 않습니다(원래 −5 인 글자는 −7 만 더 줄임). 머리(「  ○ 」)는 그대로, 몸글만.
    ③ 글이 든 문단의 줄배치 캐시를 지움(한글이 다시 계산) — 캐시=True 면 넉넉히 다시 씀."""
    보고 = {"어절로": 0, "줄임": [], "긴고침": [], "빈칸": [], "짧은끝": [], "빈칸남음": [], "긴낱말": [],
          "줄늘림": 0, "캐시지움": 0}
    # ① 어절 단위
    def 어절로(m):
        if 'breakNonLatinWord="%s"' % 글자 in m.group(0):
            보고["어절로"] += 1
            return m.group(0).replace('breakNonLatinWord="%s"' % 글자, 'breakNonLatinWord="%s"' % 어절)
        return m.group(0)
    문서.header = re.sub(r"<hh:breakSetting\b[^>]*/>", 어절로, 문서.header)
    원래나눔 = {k: v["줄나눔"] for k, v in 문서.문단모양.items()}
    for v in 문서.문단모양.values():
        v["줄나눔"] = 어절
    for n in 문서.구역들:
        s = 문서.구역[n]
        조각, 끝 = [], 0
        밀기 = {}                      # 담는칸 → 누적 세로 밀기
        앞끝 = {}                      # 담는칸 → 앞 문단의 원래 마지막 vertpos (쪽 넘김 알아채기)
        for a, b, 칸 in 문단들(s):
            p = s[a:b]
            조각.append(s[끝:a])
            끝 = b
            줄들 = 줄배치(p)
            글 = 글자열(p)
            pid = 문단모양번호(p)
            if 줄들:
                if 칸 in 앞끝 and 줄들[0].get("vertpos", 0) < 앞끝[칸]:
                    밀기[칸] = 0                                        # 쪽이 넘어가 세로 자리가 다시 시작됨
                앞끝[칸] = 줄들[-1].get("vertpos", 0)
            if not 글 or not 줄들 or pid not in 문서.문단모양 or not "".join(c for c, _ in 글).strip():
                if 캐시:
                    if 줄들 and 밀기.get(칸):
                        p = 줄배치새로(p, len(줄들), [d.get("textpos", 0) for d in 줄들], 밀기[칸])
                elif 줄들 and not 틀문단.search(p):
                    # 탭·필드가 든 글 문단도 줄 나눔이 바뀌었으니 캐시를 지움(표·그림·도형이 든 문단은 그대로)
                    p, k = re.subn(r"<hp:linesegarray>.*?</hp:linesegarray>", "", p, flags=re.S)
                    보고["캐시지움"] += k
                조각.append(p)
                continue
            pp = 문서.문단모양[pid]
            들여, cd = pp["들여"], pp["공백최소"]
            # 머리(「  ○ 」「   - 」 같은 앞 빈칸 + 기호 + 빈칸)는 자간을 그대로 둡니다. 사용자가 손으로 맞춘 예시가
            # 그렇습니다 — 머리까지 줄이면 기호 뒤 글이 시작하는 자리가 문단마다 달라져 오와 열이 어긋납니다.
            k머리 = 머리길이("".join(c for c, _ in 글))

            def 가르기(더함=0, 배율=1.0, 빈칸도=True):
                """빈칸도=False 면 줄인 자간이 빈칸에는 안 먹는다고 봅니다 — 비관적으로 볼 때. 한글이 빈칸에도
                자간을 먹이는지 확실하지 않습니다(저장된 줄 2,399개는 먹인다 쪽 78% · 안 먹인다 쪽 72%,
                사용자 예시 다섯은 안 먹인다 쪽만 다 맞음). 덜 줄여 두 줄로 남으면 사람이 다시 손봐야 하니
                고를 때는 안 먹는다고 보고, 1~2% 더 줄어드는 쪽을 택합니다."""
                if not 더함:
                    return 줄나누기(글, 문서.글자모양, 표, 줄들, 들여, True, 0, 배율, cd)
                return 줄나누기(글[:k머리] + [(c, cp if (not 빈칸도 and c in 꺾는빈칸) else 가상모양(문서, cp, 더함))
                                           for c, cp in 글[k머리:]],
                              문서.글자모양, 표, 줄들, 들여, True, 0, 배율, cd)
            # 글자가 어림보다 얼마나 넓을 수 있나(f). 한글이 저장한 이 문단의 줄 꺾임이 있으면 그것으로 좁힙니다 —
            # 한 줄로 저장된 문단은 지금 들어간다는 뜻이라 손대지 않게 되고(사용자 예시의 「건물, 수송…」),
            # 두 줄 넘게 저장된 문단은 어디서 꺾였는지로 이 글의 실제 폭을 한 글자 안쪽까지 압니다.
            구간 = 배율구간(글, 줄들, 들여, cd, 문서.글자모양, 표, 원래나눔.get(pid) == 어절)
            lo, hi = 구간 if 구간 else (0.0, float("inf"))
            if lo > 0 and hi < float("inf"):
                # 두 줄 넘게 저장된 문단 — 실제 폭이 이 구간 안에 있습니다(글자 단위면 한 글자 폭 안쪽). 가운데를 씁니다.
                # 사용자 예시 다섯에서 가운데 + 「빈칸엔 자간 안 먹음」이 손으로 맞춘 값과 가장 가까웠습니다
                # (−9·−6·−2·−7·−14 ↔ −11·−5·−2·−6·−12).
                f비관 = (lo + hi) / 2
            else:
                f비관 = min(hi * (1 - 1e-6), max(lo, 1.0) * (1 + 여유 / 100))  # hi 는 「딱 들어감」의 경계라 조금 안쪽
            f가운데 = min(max(1.0, lo), hi) if hi < float("inf") else max(1.0, lo)
            f낙관 = max(lo, f가운데 * (1 - 여유 / 100))
            비관 = 1 / f비관
            기본 = 가르기(0, 비관)
            고른 = 0
            t = "".join(c for c, _ in 글)
            # 자간을 줄일 수 있는 만큼 — 이 문단 글자 모양 가운데 가장 빽빽한 것이 바닥에 닿을 때까지
            한계 = 자간바닥 - min(문서.글자모양[cp]["자간"] for _, cp in (글[k머리:] or 글))
            줄임들 = range(-1, 한계 - 1, -1) if 한계 < 0 else range(0)
            글자수폭 = 줄폭(줄들, 0, 들여) / max(1, 문서.글자모양[글[0][1]]["크기"])
            본문줄 = 글자수폭 >= 15        # 한 줄에 한글 15자 넘게 — 좁은 표 칸은 줄 수를 줄이지 않습니다
            if 글자수폭 < 5:
                줄임들 = range(0)          # 「Ⅰ / 개 / 요」처럼 일부러 한 글자씩 세운 칸 — 손대지 않음

            def 가운데(r):
                """낱말 가운데서 꺾이는 줄 시작. 어절 단위여도 한 낱말이 줄(칸)보다 길면 한글이 글자로 꺾습니다."""
                return [x for x in r[1:] if t[x - 1] not in 꺾는빈칸 + "\n" and t[x] not in 꺾는빈칸 + "\n"]

            def 끝줄(r):
                return t[r[-1]:].strip()

            # ⓪·㉠ 낱말 가운데 꺾임이 먼저(「화학사/고」가 가장 나쁨), 그다음 줄 수 — 둘 다 어림을 비관적으로
            #   잡아(폭 여유% 좁힘) 그래도 되는 가장 적은 줄임을 고릅니다. 한 줄을 줄이면 끝줄의 두세 낱말이
            #   윗줄로 올라가 문단이 사각형이 됩니다.
            앞점 = (len(가운데(기본)), len(기본))
            아슬 = False
            for d in 줄임들:
                r = 가르기(d, 비관, False)
                점 = (len(가운데(r)), len(r))
                if 점 < 앞점 and 점[1] <= 앞점[1] and (본문줄 or 점[0] < 앞점[0]):
                    고른 = d
                    break
            if not 고른 and 본문줄 and 줄임들 and len(기본) >= 2:
                # 비관적으로는 바닥을 넘어야 하지만, 빈칸에도 자간이 먹는다고 보면 바닥 안에서 줄이 줄어드는 문단 —
                # 바닥까지 줄이고 「한글에서 봐 주세요」로 알립니다(사용자 예시 「부족분 …」은 −12 에서 한 줄이 됨).
                바닥값 = 줄임들[-1]
                r = 가르기(바닥값, 비관, True)
                if len(r) < len(기본) and len(가운데(r)) <= 앞점[0]:
                    고른, 아슬 = 바닥값, True
            if 고른:
                r = 가르기(고른, 비관, 아슬)
                if len(r) < len(기본):
                    보고["줄임"].append((f"{고른:+d}%  {len(기본)}줄 → {len(r)}줄  「{t[:26].strip()}…」"
                                       + ("  ← 바닥까지 줄임 · 한글에서 한 줄인지 봐 주세요" if 아슬 else "")).replace("\n", " ⏎ "))
                else:
                    x = 가운데(기본)[0]
                    보고["긴고침"].append(f"{고른:+d}%  {t[max(0, x - 14):x]}|{t[x:x + 8]}".replace("\n", " "))
            else:
                if 글자수폭 >= 5 and 가운데(가르기(0, 1.0)):              # 세로로 세운 칸(「Ⅰ/개/요」)은 일부러 그런 것
                    x = 가운데(가르기(0, 1.0))[0]
                    보고["긴낱말"].append(f"{t[max(0, x - 14):x]}|{t[x:x + 8]}".replace("\n", " "))
                if 본문줄 and len(기본) >= 2 and t[기본[-1] - 1] in 꺾는빈칸 \
                        and 0 < len(끝줄(기본).split()) <= 끝줄어절:
                    보고["짧은끝"].append(f"…{t[max(0, 기본[-1] - 18):기본[-1]]}|{끝줄(기본)}".replace("\n", " ⏎ "))
            if not 고른 and 빈칸한도 and 본문줄 and pp["정렬"] == "JUSTIFY":
                # ㉡ 양쪽 정렬에서 다음 낱말이 못 올라온 줄은 한글이 빈칸을 벌려 줄 끝을 맞춥니다 — 사람이
                #   손으로 자간을 줄여 그 낱말을 끌어올리던 자리. 어림이 ±여유% 틀려도(세 가지 폭으로 봄)
                #   줄 수·가운데 꺾임이 늘지 않고 넓은 줄이 줄어들 때만, 가장 적게 줄인 값을 씁니다.
                def 넓은줄(더함, 배율):
                    """(줄 수, 넓은 줄 글들, 가운데 꺾임 수)"""
                    r = 가르기(더함, 배율)
                    넓 = []
                    for i in range(len(r) - 1):
                        x, y = r[i], r[i + 1]
                        if t[y - 1] == "\n":
                            continue                                     # 사람이 넣은 줄바꿈 — 벌리지 않음
                        줄 = 글[x:y]
                        while 줄 and 줄[-1][0] in 꺾는빈칸:
                            줄 = 줄[:-1]
                        W = 줄폭(줄들, i, 들여) * 배율
                        if W > 0 and 1 - 폭(줄, 문서.글자모양, 표, 더함, cd) / W >= 빈칸한도 / 100:
                            넓.append(t[x:y].strip())
                    return len(r), 넓, len(가운데(r))
                배율들 = (비관, 1 / f가운데, 1 / f낙관)
                앞 = [넓은줄(0, k) for k in 배율들]
                if 앞[1][1]:
                    for d in 줄임들:
                        뒤 = [넓은줄(d, k) for k in 배율들]
                        if len(뒤[1][1]) < len(앞[1][1]) and all(
                                b[0] <= a[0] and len(b[1]) <= len(a[1]) and b[2] <= a[2] for a, b in zip(앞, 뒤)):
                            고른 = d
                            break
                    보기 = 앞[1][1][0][-24:]
                    if 고른:
                        보고["빈칸"].append(f"{고른:+d}%  …{보기} |넓은 줄 {len(앞[1][1])} → {len(뒤[1][1])}")
                    else:
                        보고["빈칸남음"].append(f"…{보기}")
            if 고른:
                # 이 문단의 run 만 자간을 바꾼 글자 모양으로(다른 문단은 그대로)
                p = 몸글자간(문서, p, k머리, 고른)
            # ③ 캐시 — 기본은 지움: 한글이 열 때 줄을 다시 계산합니다(남은 캐시가 모자라면 글자가 겹침).
            #   다시쓰기를 고르면 넉넉히(폭 3% 줄여) 센 줄 수로 쓰고 뒤 문단을 그만큼 내립니다.
            넉넉 = 가르기(고른, 0.97)
            줄수 = max(len(넉넉), len(줄들))
            if 캐시:
                if 줄수 > len(줄들):
                    보고["줄늘림"] += 1
                p = 줄배치새로(p, 줄수, 넉넉, 밀기.get(칸, 0))
                간격 = (줄들[1]["vertpos"] - 줄들[0]["vertpos"]) if len(줄들) > 1 and 줄들[1]["vertpos"] > 줄들[0]["vertpos"] \
                    else 줄들[0].get("vertsize", 1000) + 줄들[0].get("spacing", 0)
                밀기[칸] = 밀기.get(칸, 0) + (줄수 - len(줄들)) * 간격
            else:
                p, k = re.subn(r"<hp:linesegarray>.*?</hp:linesegarray>", "", p, flags=re.S)
                보고["캐시지움"] += k
            조각.append(p)
        조각.append(s[끝:])
        문서.구역[n] = "".join(조각)
    return 보고


# ══ 검사 ════════════════════════════════════════════════════════════
def 검사(앞경로, 뒤경로):
    """고친 파일이 깨지지 않았는지 — XML 짜임 · zip 차례(mimetype 맨 앞, 압축 없음) · 글자 · 표·그림·문단 수."""
    from xml.etree import ElementTree as ET
    문제 = []
    A, B = 문서(앞경로), 문서(뒤경로)
    with zipfile.ZipFile(뒤경로) as z:
        첫 = z.infolist()[0]
        if 첫.filename != "mimetype" or 첫.compress_type != zipfile.ZIP_STORED:
            문제.append("mimetype 이 맨 앞·압축 없음이 아님 — 한글이 못 엽니다")
        for n in z.namelist():
            if n.endswith(".xml"):
                try:
                    ET.fromstring(z.read(n))
                except ET.ParseError as e:
                    문제.append(f"{n}: XML 짜임 오류 {e}")
    for n in A.구역들:
        a, b = A.구역[n], B.구역.get(n, "")
        for 꼴 in ("<hp:tbl ", "<hp:tr>", "<hp:tc ", "<hp:p ", "<hp:pic ", "<hp:lineBreak/>"):
            if a.count(꼴) != b.count(꼴):
                문제.append(f"{n}: {꼴} 수가 다름 {a.count(꼴)} → {b.count(꼴)}")
        글 = lambda x: re.sub(r"<[^>]+>", "", x)
        if 글(a) != 글(b):
            문제.append(f"{n}: 글자가 달라짐")
    return 문제


# ══ 명령 ════════════════════════════════════════════════════════════
def main():
    if hasattr(__import__("signal"), "SIGPIPE"):                       # | head 로 잘라 볼 때 오류 없이
        import signal
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)
    ap = argparse.ArgumentParser(description="한글(hwpx) 양식 도구")
    sub = ap.add_subparsers(dest="명령", required=True)
    r = sub.add_parser("읽기"); r.add_argument("파일")
    c = sub.add_parser("점검"); c.add_argument("파일"); c.add_argument("--끝줄", type=int, default=3)
    m = sub.add_parser("맞춤"); m.add_argument("파일"); m.add_argument("-o", "--출력", required=True)
    m.add_argument("--바닥", type=int, default=-12,
                   help="자간을 줄여도 글자 모양의 자간이 이 값(%%) 아래로는 내려가지 않음(기본 -12). 자간은 줄이기만 함")
    m.add_argument("--여유", type=float, default=2, help="폭 어림의 여유(%%, 기본 2 — 글자가 어림보다 이만큼 넓어도 들어가게)")
    m.add_argument("--끝줄", type=int, default=3, help="못 맞춘 끝줄이 이 어절 수 이하면 「짧은 끝줄」로 알림(기본 3)")
    m.add_argument("--빈칸", type=float, default=10,
                   help="양쪽 정렬에서 빈칸이 줄 폭의 이 %%보다 벌어지면 자간을 줄여 맞춤(기본 10 · 0 이면 안 함)")
    m.add_argument("--전부", action="store_true", help="고친 곳·못 고친 곳 목록을 앞 15개만이 아니라 다")
    m.add_argument("--캐시다시쓰기", action="store_true",
                   help="줄배치 캐시를 지우지 않고 넉넉히 다시 씀(기본은 지움 — 한글이 열 때 다시 계산)")
    k = sub.add_parser("검사"); k.add_argument("앞"); k.add_argument("뒤")
    a = ap.parse_args()

    if a.명령 == "읽기":
        d = 문서(a.파일)
        for n in d.구역들:
            s = d.구역[n]
            for x, y, _ in 문단들(s):
                g = 글자열(s[x:y])
                t = "".join(ch for ch, _ in g) if g is not None else re.sub(r"<[^>]+>", "", s[x:y])
                if t.strip():
                    print(t.replace("\n", " ⏎ "))
    elif a.명령 == "점검":
        d = 문서(a.파일)
        끊김, 외톨이 = 점검(d, a.끝줄)
        모양 = {}
        for v in d.문단모양.values():
            모양[v["줄나눔"]] = 모양.get(v["줄나눔"], 0) + 1
        print(f"문단 모양 — 어절 단위 {모양.get(어절, 0)} · 글자 단위 {모양.get(글자, 0)}")
        print(f"낱말 가운데 끊김 {len(끊김)}곳 (한글이 저장한 줄 그대로)")
        for x in 끊김:
            print("  ", x)
        print(f"짧은 끝줄(끝줄 {a.끝줄}어절 이하 — 사각형이 깨지는 곳) {len(외톨이)}곳")
        for x in 외톨이:
            print("  ", x)
    elif a.명령 == "맞춤":
        d = 문서(a.파일)
        표, 폭보고 = 폭맞추기(d)
        보고 = 맞춤(d, 표, a.바닥, a.여유, a.끝줄, a.캐시다시쓰기, a.빈칸)
        d.저장(a.출력)

        def 목록(줄들, 앞=""):
            # 물질정보 460종 같은 큰 문서는 천 줄이 넘습니다 — 앞 15개만 보이고 --전부 로 다 봅니다
            보일 = 줄들 if a.전부 else 줄들[:15]
            for x in 보일:
                print("     ", 앞 + x)
            if len(줄들) > len(보일):
                print(f"      … 외 {len(줄들) - len(보일)}개 (전부 보려면 --전부)")
        for x in 폭보고:
            print("  폭 —", x)
        print(f"  어절 단위로 바꾼 문단 모양 {보고['어절로']}개 — 이제 한글이 빈칸에서만 줄을 꺾습니다")
        print(f"  자간을 줄여 끝줄을 윗줄로 올린 문단 {len(보고['줄임'])}개 (자간 바닥 {a.바닥}%)")
        목록(보고["줄임"])
        if 보고["긴고침"]:
            print(f"  자간을 줄여 좁은 칸의 긴 낱말을 한 줄에 넣은 곳 {len(보고['긴고침'])}개")
            목록(보고["긴고침"])
        if 보고["빈칸"]:
            print(f"  자간을 줄여 양쪽 정렬로 벌어진 빈칸을 메운 문단 {len(보고['빈칸'])}개")
            목록(보고["빈칸"])
        if 보고["짧은끝"]:
            print(f"  자간 바닥까지 줄여도 못 올린 짧은 끝줄(끝줄 {a.끝줄}어절 이하) {len(보고['짧은끝'])}개 — 글을 다듬어야 합니다")
            목록(보고["짧은끝"])
        if 보고["긴낱말"]:
            print(f"  ⚠ 칸이 좁아 한 낱말이 한 줄에 안 들어가는 곳 {len(보고['긴낱말'])}개 — 어절 단위여도 한글이 글자로 꺾습니다."
                  " 칸 폭·글자 크기·글을 사람이 정해야 합니다")
            목록(보고["긴낱말"])
        if 보고["빈칸남음"]:
            print(f"  양쪽 정렬로 빈칸이 넓게 벌어진 채 남은 문단 {len(보고['빈칸남음'])}개")
            목록(보고["빈칸남음"], "그대로 ")
        if a.캐시다시쓰기:
            print(f"  줄이 늘 것으로 보여 캐시를 늘린 문단 {보고['줄늘림']}개")
        else:
            print(f"  줄배치 캐시를 지운 문단 {보고['캐시지움']}개 — 한글이 열 때 줄을 다시 계산합니다")
        문제 = 검사(a.파일, a.출력)
        print("  검사 —", "이상 없음" if not 문제 else "; ".join(문제))
        print(f"결과: {a.출력}  ← 한글에서 열어 확인하세요(마지막 확인은 한글)")
        if 문제:
            sys.exit(1)
    elif a.명령 == "검사":
        문제 = 검사(a.앞, a.뒤)
        print("이상 없음" if not 문제 else "\n".join(문제))
        sys.exit(1 if 문제 else 0)


if __name__ == "__main__":
    main()
