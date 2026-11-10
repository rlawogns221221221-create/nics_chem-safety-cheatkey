#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""팀원이 고쳐 보낸 구동안내서를 읽어 **무엇이 바뀌었고 README 어디를 맞춰야 하는지** 한 장으로 뽑습니다.

    python3 build/구동안내서_대조.py 받은파일.hwpx            (hwp · pdf 도 됨)
    python3 build/구동안내서_대조.py 받은파일.hwpx --out 보고.md
    python3 build/구동안내서_대조.py 받은파일.hwpx --초안 다른초안.hwpx

── 왜 만들었나 (2026-11-10 · 공모전 마감 전날) ─────────────────────────────
사용자 — "내 팀원이 구동안내서를 수정해서 보내줄거야. 그 팀원이 잡아준 방향성이 우리가
나아가야할 방향이기 때문에 그 자료를 토대로 깃랩 자료를 다시 만들거야." 팀원은 우리가 만든
초안(`docs/공모전/[구동안내서]_*.hwpx`)을 토대로 고칩니다. 그래서 **초안과 견주면 팀원이 정한
방향이 줄 단위로 드러납니다** — 그것을 README 에 그대로 옮기면 됩니다. 메일로 내는 구동안내서와
GitLab README 가 서로 다른 말을 하면 심사위원이 어느 쪽을 믿을지 모릅니다.

── 무엇을 하나 ──────────────────────────────────────────────────────
 ① 양식 [2-1] 의 일곱 칸(실행 환경 … 개발 경위)을 칸마다 읽습니다. hwpx 는 표 칸 그대로,
    hwp·pdf 는 칸 이름 줄로 나눕니다(표 짜임이 글자만 남으므로).
 ② 칸마다 초안 대비 **지운 줄 · 더한 줄 · 고친 줄**.
 ③ 칸마다 README 에서 같은 내용을 다루는 곳(맞출 자리).
 ④ 숫자 대조 — 팀원 판에만 있는 숫자 / README 에만 있는 숫자(어느 한쪽이 틀렸을 수 있음).
 ⑤ 이름 대조 — 서비스·도구 공식 이름과 다르게 쓴 곳, 흐름 개수(사용자 결정: 4개),
    남은 【입력 필요】, 적힌 GitLab 주소.
 판정은 사람이 합니다. 이 스크립트는 고치지 않고 **보여 주기만** 합니다.

⚠ 받은 파일은 저장소에 올리지 마세요 — 이 저장소는 공개입니다. `docs/공모전/받은/` 에 두면
  .gitignore 가 막습니다.
"""
import argparse
import difflib
import re
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "build"))

HP = "{http://www.hancom.co.kr/hwpml/2011/paragraph}"

# 양식 [2-1] 의 칸 — (이 보고에서 쓰는 이름, 칸 이름을 알아보는 열쇠말, README 에서 맞출 자리)
칸들 = [
    ("실행 환경", r"실행\s*환경", "맨 위 표 · §5 다른 기관에서 쓰기 · §8 인터넷이 있을 때만 · 알려진 제약"),
    ("설치·실행 절차", r"설치.*실행|실행\s*절차", "§1 바로 써 보기(가장 쉬운 길 · 이 저장소로 · 업무망 PC)"),
    ("LLM 연결 설정", r"LLM|연결\s*설정", "맨 위 표 「LLM 연결 설정」 · §3 AI를 어떻게 썼나"),
    ("모의데이터 안내", r"모의\s*데이터", "§1 「1분씩 따라 해 보기」(시연 예시) · §9 자료 출처"),
    ("기능 사용 순서", r"기능\s*사용\s*순서", "§1 따라 해 보기 표 · §4 네 가지 기능"),
    ("알려진 제약 사항", r"알려진\s*제약|제약\s*사항", "§3 믿을 수 있게(지키는 원칙) · §8 알려진 제약"),
    ("개발 경위", r"개발\s*경위", "§2 왜 만들었나 · §3 무엇이 다른가 · 시범운영 만족도"),
]

공식이름 = ["화학사고 초동대응 지원 서비스", "주민 대피장소 찾기", "주민대피 문자생성기",
          "방제 물품·장비 찾기", "현장 안전거리 확인"]


def 고르게(s):
    return re.sub(r"\s+", " ", str(s)).strip()


def 칸찾기(글):
    for 이름, 열쇠, _ in 칸들:
        if re.search(열쇠, 글):
            return 이름
    return None


# ── ① 읽기 ─────────────────────────────────────────────────────────
def hwpx_칸(경로):
    """hwpx — 9행 2열 표에서 왼쪽 칸 이름 → 오른쪽 칸 문단들. 개발 경위는 이름 행 아래 행 전체."""
    z = zipfile.ZipFile(경로)
    결과, 남은글 = {}, []
    for 이름 in sorted(n for n in z.namelist() if re.match(r"Contents/section\d+\.xml$", n)):
        뿌리 = ET.fromstring(z.read(이름))
        for 표 in 뿌리.iter(HP + "tbl"):
            행들 = 표.findall(HP + "tr")
            다음행은 = None
            for tr in 행들:
                칸글 = []
                for tc in tr.findall(HP + "tc"):
                    문단 = []
                    for p in tc.iter(HP + "p"):
                        s = "".join(t.text or "" for t in p.iter(HP + "t")).strip()
                        if s:
                            문단.append(고르게(s))
                    칸글.append(문단)
                if 다음행은:                                  # 「개발 경위 요약」 이름 행 바로 아래 행
                    결과[다음행은] = [x for c in 칸글 for x in c]
                    다음행은 = None
                    continue
                if len(칸글) >= 2 and 칸글[0]:
                    k = 칸찾기(칸글[0][0])
                    if k:
                        결과[k] = 칸글[1]
                        continue
                if len(칸글) == 1 and 칸글[0]:
                    k = 칸찾기(칸글[0][0])
                    if k:
                        다음행은 = k
                        if len(칸글[0]) > 1:
                            결과[k] = 칸글[0][1:]
                        continue
                남은글 += [x for c in 칸글 for x in c]
    return 결과


문단머리 = re.compile(r"^(○|-|·|\[흐름|\([가-힣 ]{1,8}\)$|※|\d+\.\s|[①-⑳])")


def 줄로_칸(줄들, 이어붙이기=False):
    """hwp·pdf — 칸 이름만 있는 줄에서 나눕니다(표 짜임이 없으므로).
    pdf 는 한 문단이 화면 줄로 잘려 나오므로(이어붙이기) ○·-·[흐름 … 로 시작하지 않는 줄을
    앞 문단에 잇습니다. 표 아래 양식의 ※ 안내 두 줄은 칸 글이 아니라 뺍니다."""
    결과, 지금 = {}, None
    for 줄 in 줄들:
        s = 고르게(줄)
        if not s or len(s) > 2000:                            # 표 전체를 이어 붙인 줄은 건너뜀
            continue
        if re.match(r"^※\s*(구동|세션|양식|본 양식|작성)", s):   # 양식 자체의 안내 줄
            지금 = None
            continue
        k = 칸찾기(s) if len(s) <= 24 else None
        if k:
            지금 = k
            결과.setdefault(k, [])
            continue
        if not 지금:
            continue
        # 좁은 이름 칸에서 칸 이름이 두 줄로 꺾인 꼬리("모의데이터 안" / "내") — 글이 아님
        if 이어붙이기 and not 결과[지금] and len(s) <= 4 and not 문단머리.match(s):
            continue
        if 이어붙이기 and 결과[지금] and not 문단머리.match(s):
            # 한글 PDF 는 낱말 가운데서도 줄이 꺾여 사이띄개를 알 수 없습니다 — 붙여 잇고,
            # 견줄 때는 띄어쓰기를 보지 않습니다(띄어쓰기무시).
            결과[지금][-1] = 결과[지금][-1] + s
        else:
            결과[지금].append(s)
    return 결과


def pdf_칸(경로):
    """PDF — 표의 왼쪽 칸(이름)과 오른쪽 칸(내용)을 글자 자리로 가릅니다(pdftotext -layout).
    보통 읽기는 칸의 읽는 차례가 섞여(이름 칸이 내용보다 먼저 몰려 나옴) 칸이 어긋났습니다.
    오른쪽 칸이 시작하는 자리는 '앞이 비어 있는 줄들의 가장 흔한 들여쓰기'로 잡습니다.
    한 줄로 이어진 표(개발 경위 아래 행)는 줄 맨 앞부터 내용입니다."""
    글 = subprocess.run(["pdftotext", "-layout", str(경로), "-"], capture_output=True, text=True, check=True).stdout
    줄들 = [l.rstrip() for l in 글.split("\n")]
    from collections import Counter
    들여 = Counter(len(l) - len(l.lstrip()) for l in 줄들 if l.strip() and l[:1] == " " and len(l) - len(l.lstrip()) >= 4)
    칸자리 = 들여.most_common(1)[0][0] if 들여 else 0
    결과, 지금, 이름조각 = {}, None, ""
    for l in 줄들:
        if not l.strip():
            이름조각 = ""
            continue
        if re.match(r"^\s*※\s*(구동|세션|양식|본 양식|작성)", l):
            지금 = None
            continue
        왼, 오 = (l[:칸자리].strip(), l[칸자리:].strip()) if 칸자리 and len(l) > 칸자리 and l[:칸자리].rstrip() != l.rstrip() else (l.strip(), "")
        if 왼 and not 오 and 지금 == "개발 경위" and not 칸찾기(왼):
            오, 왼 = 왼, ""                                   # 개발 경위 아래 행 — 줄 맨 앞부터 내용
        if not 왼:
            이름조각 = ""                                     # 이름은 잇닿은 줄에서만 이어 읽음
        if 왼:
            이름조각 = (이름조각 + 왼) if 이름조각 else 왼
            k = 칸찾기(이름조각.replace(" ", "")) or 칸찾기(이름조각)
            if k and k != 지금:
                지금 = k
                결과.setdefault(k, [])
            elif not k and len(왼) > 24 and 지금:
                오 = (왼 + " " + 오).strip()                  # 이름 칸이 아니라 넓은 글
        if not 오 or not 지금:
            continue
        if 결과[지금] and not 문단머리.match(오):
            결과[지금][-1] = 결과[지금][-1] + 오                # 한글 PDF 는 낱말 가운데서도 꺾임 — 붙여 잇기
        else:
            결과[지금].append(오)
    return 결과


def 읽기(경로, 글줄로=False):
    """글줄로=True — hwpx 도 hwp·pdf 와 같은 방식(칸 이름 줄로 나누기)으로 읽습니다.
    받은 파일이 hwp·pdf 일 때 초안도 같은 방식으로 읽어야 견줄 때 헛차이가 안 납니다."""
    경로 = Path(경로)
    ext = 경로.suffix.lower()
    import importlib
    if ext == ".hwpx":
        if 글줄로:
            return 줄로_칸(importlib.import_module("hwp읽기").hwpx_문단들(str(경로)))
        return hwpx_칸(경로)
    if ext == ".hwp":
        return 줄로_칸(importlib.import_module("hwp읽기").문단들(str(경로)))
    if ext == ".pdf":
        return pdf_칸(경로)
    sys.exit(f"읽을 수 없는 형식입니다: {경로.name} — 한글(.hwpx·.hwp)이나 PDF 로 받아 주세요")


# ── ② 바뀐 줄 ──────────────────────────────────────────────────────
def 바뀐줄(앞, 뒤, 띄어쓰기무시=False):
    """줄 목록 둘을 견주어 (표시, 글) 목록. − 지움 · + 더함 · ~ 고침(앞 → 뒤).
    띄어쓰기무시 — PDF 에서 읽은 글은 줄 꺾인 자리의 사이띄개를 알 수 없어 띄어쓰기만 다른
    줄은 같은 줄로 봅니다(그 대신 PDF 로는 띄어쓰기 고침을 못 잡습니다)."""
    out = []
    열쇠 = (lambda x: re.sub(r"\s+", "", x)) if 띄어쓰기무시 else (lambda x: x)
    sm = difflib.SequenceMatcher(a=[열쇠(x) for x in 앞], b=[열쇠(x) for x in 뒤], autojunk=False)
    for 일, a0, a1, b0, b1 in sm.get_opcodes():
        if 일 == "equal":
            continue
        A, B = 앞[a0:a1], 뒤[b0:b1]
        if 일 == "replace":
            # 비슷한 줄끼리 짝지어 「고침」 으로, 남는 것은 지움·더함으로
            쓴B = set()
            for a in A:
                짝 = max(((difflib.SequenceMatcher(a=열쇠(a), b=열쇠(b)).ratio(), j) for j, b in enumerate(B) if j not in 쓴B),
                        default=(0, None))
                if 짝[0] >= 0.5:
                    쓴B.add(짝[1])
                    out.append(("~", a, B[짝[1]]))
                else:
                    out.append(("−", a, None))
            for j, b in enumerate(B):
                if j not in 쓴B:
                    out.append(("+", b, None))
        elif 일 == "delete":
            out += [("−", a, None) for a in A]
        else:
            out += [("+", b, None) for b in B]
    return out


def 고친곳(a, b):
    """한 줄 안에서 바뀐 토막만 — 「앞 글 → 뒤 글」."""
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    조각 = []
    for 일, a0, a1, b0, b1 in sm.get_opcodes():
        if 일 != "equal":
            조각.append(f"「{a[a0:a1] or '∅'}」→「{b[b0:b1] or '∅'}」")
    return " · ".join(조각[:6]) + (" …" if len(조각) > 6 else "")


# ── ④ 숫자 ─────────────────────────────────────────────────────────
숫자꼴 = re.compile(r"\d[\d,]*(?:\.\d+)?\s*(?:곳|건|종|명|%|개|묶음|항목|줄|가지|쪽|장|분|초|km|m|MB|자|년|월|일|척)")


def 숫자들(글):
    return {re.sub(r"\s+", "", m.group(0)) for m in 숫자꼴.finditer(글)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("받은파일")
    ap.add_argument("--초안", default=None, help="견줄 우리 초안(기본: docs/공모전/[구동안내서]_*.hwpx 가운데 최신)")
    ap.add_argument("--readme", default=str(ROOT / "docs" / "공모전" / "GitLab_README.md"))
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    초안경로 = Path(a.초안) if a.초안 else max((ROOT / "docs" / "공모전").glob("[[]구동안내서[]]_*.hwpx"),
                                           key=lambda p: p.stat().st_mtime, default=None)
    받은 = 읽기(a.받은파일)
    같은방식 = Path(a.받은파일).suffix.lower() != ".hwpx"
    초안 = 읽기(초안경로, 글줄로=같은방식) if 초안경로 and 초안경로.exists() else {}
    readme = Path(a.readme).read_text(encoding="utf-8")
    받은글 = "\n".join(x for v in 받은.values() for x in v)

    줄 = [f"# 구동안내서 대조 — {Path(a.받은파일).name}", "",
         f"초안: `{초안경로.name if 초안경로 else '없음'}` · README: `{Path(a.readme).name}`", ""]

    # 한눈에
    줄 += ["## 한눈에", "", "| 칸 | 팀원 판 줄 | 초안 줄 | 지움 | 더함 | 고침 | README 에서 맞출 자리 |", "|---|---|---|---|---|---|---|"]
    차이들 = {}
    for 이름, _, 자리 in 칸들:
        뒤, 앞 = 받은.get(이름), 초안.get(이름, [])
        if 뒤 is None:
            줄.append(f"| {이름} | **못 찾음** | {len(앞)} | | | | {자리} |")
            continue
        d = 바뀐줄(앞, 뒤, 띄어쓰기무시=Path(a.받은파일).suffix.lower() == ".pdf")
        차이들[이름] = d
        n = {k: sum(1 for x in d if x[0] == k) for k in "−+~"}
        줄.append(f"| {이름} | {len(뒤)} | {len(앞)} | {n['−']} | {n['+']} | {n['~']} | {자리} |")
    줄.append("")

    # 흐름·이름·입력 필요
    흐름 = sorted(set(re.findall(r"\[흐름\s*(\d+)\]", 받은글)))
    줄 += ["## 확인할 것", ""]
    줄.append(f"- **흐름 개수** {len(흐름)}개 ({', '.join(흐름) or '표시 없음'}) — 사용자 결정은 **4개**"
              + ("" if len(흐름) == 4 else " ⚠ README §1 표·§4 와 개수가 다릅니다 — 사용자에게 확인"))
    남은 = re.findall(r"【[^】]*】", 받은글)
    줄.append(f"- **【입력 필요】** {len(남은)}곳" + (f" — {', '.join(sorted(set(남은)))}" if 남은 else ""))
    gitlab = sorted(set(re.findall(r"https?://[^\s)」]*gitlab[^\s)」]*", 받은글)))
    줄.append(f"- **GitLab 주소** {', '.join(gitlab) if gitlab else '없음'}"
              + (" → `docs/공모전/참가정보.json` 의 gitlab 에 넣고 README 에도" if gitlab else ""))
    for 이름 in 공식이름:
        if 이름 not in 받은글:
            비슷 = sorted(set(m.group(0) for m in re.finditer(re.sub(r"[\s·]", r"[\\s·]?", re.escape(이름).replace(r"\ ", " ")), 받은글)))
            줄.append(f"- 공식 이름 「{이름}」 — 그대로 쓴 곳 없음" + (f" · 비슷한 표기: {', '.join('「'+x+'」' for x in 비슷)}" if 비슷 else ""))
    줄.append("")

    # 숫자
    받은수, 읽은수 = 숫자들(받은글), 숫자들(readme)
    줄 += ["## 숫자 대조", "",
           "팀원 판에만 있는 숫자 — README 에 없거나 다르게 적힌 값. **어느 쪽이 맞는지 자료로 확인**(CLAUDE.md 2절 3항):", ""]
    줄.append("- " + (" · ".join(sorted(받은수 - 읽은수)) or "없음"))
    줄 += ["", "README 에만 있는 숫자(참고 — 구동안내서가 다루지 않는 것일 수 있음):", "",
          "- " + (" · ".join(sorted(읽은수 - 받은수)) or "없음"), ""]

    # 칸마다 바뀐 줄
    줄 += ["## 칸마다 팀원이 바꾼 것", ""]
    for 이름, _, 자리 in 칸들:
        d = 차이들.get(이름)
        if d is None:
            continue
        줄 += [f"### {이름}  →  README: {자리}", ""]
        if not d:
            줄 += ["(바뀐 것 없음)", ""]
            continue
        for 표, x, y in d:
            if 표 == "~":
                줄.append(f"- ~ {고친곳(x, y)}")
                줄.append(f"    - 고친 뒤: {y}")
            else:
                줄.append(f"- {표} {x}")
        줄.append("")

    줄 += ["## 다음 차례", "",
          f"1. 화면 이름 대조 — `node build/설명서_화면대조.mjs \"{a.받은파일}\"`",
          "2. 위 「칸마다 팀원이 바꾼 것」을 README 의 맞출 자리에 옮기기(방향은 팀원 판을 따름)",
          "3. README 도 화면 대조 — `node build/설명서_화면대조.mjs docs/공모전/GitLab_README.md`",
          "4. 묶음 — `python3 build/make_contest_package.py` → 묶음 복사본에서 `tests/run.sh`",
          ""]
    보고 = "\n".join(줄)
    if a.out:
        Path(a.out).write_text(보고, encoding="utf-8")
        print("결과:", a.out)
    print(보고)


if __name__ == "__main__":
    main()
