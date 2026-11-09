# -*- coding: utf-8 -*-
"""공모전 공공 GitLab 에 올릴 묶음 만들기 (2026 공공 AI 대전환 챌린지 세션 1)

    python3 build/make_contest_package.py

결과   release/공모전_GitLab/화학사고_초동대응_지원_서비스/   ← 이 폴더 안의 것을 통째로 올림
       release/공모전_GitLab.zip                                (같은 것을 한 파일로)

── 왜 저장소를 통째로 올리지 않나 ─────────────────────────────────
· 이 깃허브 저장소에는 원자료(source/)·내부 보고서·설문지·검토 문서까지 들어 있습니다.
  심사에 필요한 것은 "소스 + 실행물 + 실행 방법" 이라 그것만 담습니다.
· `build/fetch_tempshelter.html` 에는 사용자의 오픈API 인증키가 적혀 있습니다
  (CLAUDE.md 6절 — 사용자가 "열면 바로 돌게" 해 달라고 넣은 것). 묶음에서는
  **값을 지웁니다.** 지운 뒤에도 남아 있으면 묶음을 만들지 않습니다.
· build/ 는 **고른 파일만** 담습니다(아래 `빌드_고름`). 보고서·설문지를 굽는
  스크립트에는 심사와 상관없는 내부 문구·연락처가 들어 있을 수 있어서입니다.
· 사이트 부분은 make_release.py 로 먼저 만듭니다 — 그 스크립트가 개인 휴대전화
  번호·담당자 이름을 기계로 검사하고, 걸리면 멈춥니다(CLAUDE.md 2절 4항).
"""
import pathlib
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "release" / "공모전_GitLab"
PKG = OUT / "화학사고_초동대응_지원_서비스"
ZIP = ROOT / "release" / "공모전_GitLab.zip"

빌드_고름 = [
    # 화면·자료를 다시 만드는 것
    "build_single.py", "make_release.py", "make_data.py", "make_resources2.py",
    "make_tempshelters.py", "fetch_tempshelter.py", "fetch_tempshelter.html",
    "make_boundary.py", "make_icons.mjs", "icon.svg", "make_site_images.py",
    "xlsx읽기.py", "hwp읽기.py",
    # 설명서 · 시연영상 · 공모전 서류 · 이 묶음
    "make_mobile_guide.mjs", "make_contest_video.mjs", "영상무대.html",
    "make_contest_docs.mjs", "make_qr.py", "make_contest_package.py",
]
# 사용자 오픈API 인증키처럼 보이는 것(64자리 16진수) — 묶음 어디에도 남으면 안 됩니다
키꼴 = re.compile(r"\b[0-9a-f]{64}\b")
휴대전화꼴 = re.compile(r"\b01[016789]-?\d{3,4}-?\d{4}\b")


def 멈춤(말):
    sys.exit("\n중단: " + 말 + "\n")


def main():
    # ① 사이트 — 개인정보 검사를 거친 배포 폴더를 그대로 씁니다
    r = subprocess.run([sys.executable, str(ROOT / "build" / "make_release.py")],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-2000:], r.stderr[-2000:])
        멈춤("make_release.py 가 멈췄습니다 — 위 내용을 먼저 고치세요")
    site = ROOT / "release" / "화학사고_초동대응_지원_서비스"

    shutil.rmtree(OUT, ignore_errors=True)
    shutil.copytree(site, PKG)

    # ② 실행물 — 업무망 PC용 단일 HTML
    (PKG / "dist").mkdir()
    for f in sorted((ROOT / "dist").glob("*.html")):
        if "내부용" in f.name:
            continue
        shutil.copy2(f, PKG / "dist" / f.name)

    # ③ 소스 — 고른 빌드 스크립트 · 검증
    (PKG / "build").mkdir()
    for n in 빌드_고름:
        src = ROOT / "build" / n
        if not src.exists():
            멈춤(f"build/{n} 이 없습니다")
        글 = src.read_text(encoding="utf-8")
        if n == "fetch_tempshelter.html":
            글, k = 키꼴.subn("", 글)
            print(f"  build/{n}: 인증키 {k}곳을 지웠습니다(받는 사람이 자기 키를 넣습니다)")
        (PKG / "build" / n).write_text(글, encoding="utf-8")
    shutil.copytree(ROOT / "tests", PKG / "tests",
                    ignore=shutil.ignore_patterns("*.png", "__pycache__", "node_modules"))

    # ④ 안내 — 심사위원이 먼저 읽는 것
    shutil.copy2(ROOT / "docs" / "공모전" / "GitLab_README.md", PKG / "README.md")
    안내서 = sorted((ROOT / "docs" / "공모전").glob("[[]구동안내서[]]_*.pdf"))
    if not 안내서:
        멈춤("구동안내서 PDF 가 없습니다 — node build/make_contest_docs.mjs 를 먼저 돌리세요")
    shutil.copy2(안내서[-1], PKG / "구동안내서.pdf")
    shutil.copy2(ROOT / "docs" / "모바일_사용설명서.pdf", PKG / "휴대전화_사용설명서.pdf")

    # ⑤ 마지막 검사 — 인증키·개인 휴대전화가 묶음 어디에도 없어야 합니다
    문제 = []
    for f in PKG.rglob("*"):
        if not f.is_file() or f.suffix.lower() not in {".html", ".js", ".mjs", ".py", ".md", ".json", ".sh", ".css", ".svg"}:
            continue
        t = f.read_text(encoding="utf-8", errors="ignore")
        if 키꼴.search(t):
            문제.append(f"{f.relative_to(PKG)}: 인증키처럼 보이는 64자리 값")
        for m in 휴대전화꼴.finditer(t):
            # 검증 스크립트의 가짜 번호(010-1234-…)는 넘어갑니다
            if re.match(r"010-?1234-?", m.group(0)) or re.match(r"010-?0000-?", m.group(0)):
                continue
            문제.append(f"{f.relative_to(PKG)}: 휴대전화 번호처럼 보이는 값 {m.group(0)}")
    if 문제:
        print("\n".join("  · " + m for m in 문제[:30]))
        멈춤("묶음에 넣으면 안 되는 값이 있습니다")

    # ⑥ 한 파일로
    ZIP.unlink(missing_ok=True)
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(PKG.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(OUT))
    n = sum(1 for f in PKG.rglob("*") if f.is_file())
    mb = sum(f.stat().st_size for f in PKG.rglob("*") if f.is_file()) / 1024 / 1024
    print(f"  release/공모전_GitLab/{PKG.name}/  파일 {n}개 · {mb:.1f}MB")
    print(f"  release/공모전_GitLab.zip  {ZIP.stat().st_size / 1024 / 1024:.1f}MB")


if __name__ == "__main__":
    main()
