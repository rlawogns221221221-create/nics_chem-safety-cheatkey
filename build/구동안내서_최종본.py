#!/usr/bin/env python3
"""팀원이 고친 구동안내서(양식 2-1) → 메일로 낼 최종본.

    python3 build/구동안내서_최종본.py                       # 받은 파일 = docs/공모전/받은/팀원_구동안내서.hwpx
    python3 build/구동안내서_최종본.py 받은파일.hwpx
    python3 build/구동안내서_최종본.py --gitlab https://…   # GitLab 주소가 정해지면 【입력 필요】 자리에 넣음

  결과물 : docs/공모전/[구동안내서]_기관명_팀명.hwpx   (한글에서 열어 「PDF로 저장」 → 메일 제출)

왜 이렇게 하나
  2026-11-10 사용자 — "팀원한테 구동안내서 받아왔어. 이거 검토해서 최종본 만들어보자."
  검토 뒤 사용자가 정한 것: **팀원 판을 그대로 따른다**(설문 숫자 58명 · 흐름 3개 · 흐름 3 제목 ·
  자료로 확인 못 한 사실까지 — "팀원이 쓴거 토대로 진행해줘"). 그래서 이 스크립트는
  팀원 파일을 **한 글자도 다시 짓지 않고**, 아래 `고침표` 의 자리만 바꿉니다.
  고친 것은 **틀린 것이 분명한 것**뿐입니다 — 지난 숫자 하나와 띄어쓰기 셋.

  ⚠ 받은 파일(docs/공모전/받은/)은 저장소에 올라가지 않습니다(.gitignore — 저장소가 공개).
     결과물만 커밋합니다. 결과물의 문서 정보에는 작성자 이름이 없습니다(creator "user"·"업무망" 뿐 — 확인함).
  ⚠ 팀원 판의 글이 바뀌면 `고침표` 의 앞 글이 안 맞아 멈춥니다. 그때는 새 판에서 같은 자리를
     다시 찾아 고치세요(이미 고쳐져 있으면 그 줄을 지우면 됩니다).

줄배치 캐시(<hp:linesegarray>)
  한글은 저장할 때 줄마다 "몇 번째 글자부터 · 세로 어디"를 적어 둡니다. 글자가 늘어 줄이 하나 더
  생기면 그 줄의 자리가 없어 **앞줄과 겹쳐 그립니다**(make_hwpx.py 에서 겪은 일). 그래서 고칠 때
  **글이 줄어들거나, 강제 줄바꿈으로 끝나는 줄 안에서만 조금 느는 것**만 허용합니다(`늘어도됨`).
  늘어난 줄은 맑은 고딕 폭으로 어림해 그 줄 폭 안에 드는지 검사합니다 — 안 들면 멈춥니다.
  마지막 확인은 사용자가 한글에서 한 번 여는 것입니다(이 자리에는 한글이 없음).
"""
import argparse
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
기본받은 = ROOT / "docs" / "공모전" / "받은" / "팀원_구동안내서.hwpx"
값 = json.loads((ROOT / "docs" / "공모전" / "참가정보.json").read_text(encoding="utf-8"))
낼파일 = ROOT / "docs" / "공모전" / f"[구동안내서]_{값.get('기관명') or '기관명'}_{값.get('팀명') or '팀명'}.hwpx"

# (앞 글, 뒤 글, 까닭, 늘어도됨). 앞 글은 section0.xml 에 **꼭 한 번** 있어야 합니다.
고침표 = [
    ("886개 항목과 휴대전화 65개 화면을 점검",
     "1,023개 항목과 휴대전화 65개 화면을 점검",
     "886개는 2026-09 AI프렌즈 때(19묶음) 수치. 지금 GitLab 묶음에서 tests/run.sh 를 돌리면 20묶음 1,023개 "
     "— README·검증결과.md 와 같은 숫자여야 심사위원이 돌려 보고 맞다고 봅니다",
     True),
    ("되고 글자수 (90자 기준)가", "되고 글자수(90자 기준)가", "띄어쓰기 — 괄호 앞 빈칸", False),
    ("dist 폴더의 HTML 파일 4개 </hp:t>", "dist 폴더의 HTML 파일 4개</hp:t>", "띄어쓰기 — 괄호 앞 빈칸(뒤 run 이 「(주민대피장소…」)", False),
    ("원내· 유역환경청", "원내·유역환경청", "띄어쓰기 — 가운뎃점 뒤 빈칸", False),
]
# 「【입력 필요】」 자리 — GitLab 주소(참가정보.json 의 gitlab 또는 --gitlab)가 있으면 넣습니다.
입력자리 = "* 공공 GitLab 주소: 【입력 필요】"


# ── 맑은 고딕 11pt 폭 어림(HWPUNIT · 1pt = 100) ─────────────────────────
#   한글 1em · 숫자 .55 · 영문 .52 · 빈칸 .29 · 그 밖 .36. 팀원 파일에서 한글이 실제로 나눈 줄
#   61개로 대 보니 이 값에서 한글 폭은 .93em 이하여야 다 맞았습니다 — 1em 로 잡아 **넓게** 셉니다.
def 폭(글, 크기=1100):
    w = 0.0
    for ch in 글:
        if "가" <= ch <= "힣" or unicodedata.east_asian_width(ch) in ("W", "F"):
            w += 1.0
        elif ch == " ":
            w += 0.29
        elif ch.isdigit():
            w += 0.55
        elif ch.isascii() and ch.isalpha():
            w += 0.52
        else:
            w += 0.36
    return w * 크기


def 문단자리(s, i):
    """s[i] 를 감싼 가장 안쪽 <hp:p>…</hp:p>."""
    a = s.rfind("<hp:p ", 0, i)
    b = s.find("</hp:p>", i) + len("</hp:p>")
    return a, b


def 문단글(p):
    """문단의 글자 — 강제 줄바꿈은 \n 하나(한글의 textpos 도 한 글자로 셉니다)."""
    out = ""
    for t in re.findall(r"<hp:t>(.*?)</hp:t>", p, re.S):
        out += re.sub(r"<hp:lineBreak/>", "\n", t)
    return out.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")


def 줄검사(앞문단, 뒤문단):
    """늘어난 글이 원래 줄 안에 드는지. 강제 줄바꿈으로 끝나는 줄(또는 마지막 줄)만 늘 수 있습니다."""
    앞, 뒤 = 문단글(앞문단), 문단글(뒤문단)
    segs = [(int(a), int(w)) for a, w in re.findall(r'textpos="(\d+)"[^>]*?horzsize="(\d+)"', 앞문단)]
    # 바뀐 자리(앞에서부터 같은 글자 수)
    k = 0
    while k < min(len(앞), len(뒤)) and 앞[k] == 뒤[k]:
        k += 1
    차 = len(뒤) - len(앞)
    줄 = max(i for i, (a, _) in enumerate(segs) if a <= k)
    시작 = segs[줄][0]
    끝 = segs[줄 + 1][0] if 줄 + 1 < len(segs) else len(앞)
    앞줄 = 앞[시작:끝]
    if 줄 + 1 < len(segs) and not 앞줄.endswith("\n"):
        raise SystemExit(f"⚠ 글이 늘어난 줄이 저절로 꺾인 줄입니다 — 뒤 줄이 밀려 겹칠 수 있음: {앞줄!r}")
    새줄 = 뒤[시작:끝 + 차].rstrip("\n")
    w, 한도 = 폭(새줄), segs[줄][1]
    if w > 한도:
        raise SystemExit(f"⚠ 고친 줄이 칸 폭을 넘을 수 있습니다({w:.0f} > {한도}): {새줄!r}")
    return f"줄 {줄 + 1} 폭 어림 {w:.0f} / {한도}"


def 만들기(받은, gitlab):
    with zipfile.ZipFile(받은) as z:
        목록 = z.infolist()
        속 = {i.filename: z.read(i.filename) for i in 목록}
    s = 속["Contents/section0.xml"].decode("utf-8")
    원래 = s
    for 앞, 뒤, 까닭, 늘어도 in 고침표:
        n = s.count(앞)
        if n != 1:
            raise SystemExit(f"⚠ 고칠 글이 {n}번 있습니다(1번이어야 함): {앞!r}\n   팀원 판이 바뀌었으면 고침표를 새 판에 맞추세요.")
        i = s.index(앞)
        a, b = 문단자리(s, i)
        앞문단 = s[a:b]
        뒤문단 = 앞문단.replace(앞, 뒤)
        if len(뒤) > len(앞):
            if not 늘어도:
                raise SystemExit(f"⚠ 늘면 안 되는 고침인데 글이 늡니다: {앞!r}")
            판정 = 줄검사(앞문단, 뒤문단)
        else:
            판정 = "글이 줄거나 같음 — 줄 수가 늘지 않음"
        s = s[:a] + 뒤문단 + s[b:]
        print(f"  고침 · {앞.replace('</hp:t>', '')!r} → {뒤.replace('</hp:t>', '')!r}\n         {까닭} ({판정})")
    if gitlab:
        if s.count(입력자리) != 1:
            raise SystemExit("⚠ 【입력 필요】 자리를 못 찾았습니다")
        a, b = 문단자리(s, s.index(입력자리))
        앞문단 = s[a:b]
        뒤문단 = 앞문단.replace("【입력 필요】", gitlab.replace("&", "&amp;"))
        판정 = 줄검사(앞문단, 뒤문단)
        s = s[:a] + 뒤문단 + s[b:]
        print(f"  넣음 · GitLab 주소 {gitlab} ({판정})")
    else:
        print("  ※ GitLab 주소가 아직 없어 【입력 필요】 그대로 — 정해지면 --gitlab 주소 로 다시 돌리세요")

    검사(원래, s, gitlab)
    속["Contents/section0.xml"] = s.encode("utf-8")
    낼파일.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(낼파일, "w") as z:
        for i in 목록:                       # 차례·압축 방식 그대로(mimetype 은 맨 앞 · 압축 없음)
            z.writestr(i, 속[i.filename], compress_type=i.compress_type)
    print(f"결과: {낼파일.relative_to(ROOT)}")


def 검사(원래, 새, gitlab=""):
    """XML 짜임 · 표·문단·그림 수가 그대로인지 · 고친 자리 말고 글이 그대로인지."""
    ET.fromstring(새.encode("utf-8"))
    for 꼴 in ("<hp:tbl ", "<hp:tr>", "<hp:tc ", "<hp:p ", "<hp:lineseg ", "<hp:pic ", "<hp:lineBreak/>"):
        if 원래.count(꼴) != 새.count(꼴):
            raise SystemExit(f"⚠ {꼴} 수가 달라졌습니다")
    글 = lambda x: re.sub(r"<[^>]+>", "", x)
    앞, 뒤 = 글(원래), 글(새)
    for a, b, *_ in 고침표:
        앞 = 앞.replace(글(a), 글(b))
    if gitlab:
        앞 = 앞.replace("【입력 필요】", gitlab.replace("&", "&amp;"))
    if 앞 != 뒤:
        raise SystemExit("⚠ 고침표 밖의 글이 달라졌습니다")
    print("  검사 · XML 짜임 · 표·행·칸·문단·줄배치·그림 수 그대로 · 고친 자리 밖 글 그대로")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("받은", nargs="?", default=str(기본받은))
    ap.add_argument("--gitlab", default=(값.get("gitlab") or "").strip())
    a = ap.parse_args()
    if not Path(a.받은).exists():
        sys.exit(f"받은 파일이 없습니다: {a.받은}\n  팀원 파일을 docs/공모전/받은/ 에 두세요(저장소에 올라가지 않음).")
    만들기(a.받은, a.gitlab)
