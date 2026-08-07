#!/usr/bin/env python3
"""CSS·JS·데이터를 모두 인라인한 오프라인 단일 HTML 파일을 만듭니다.

망분리된 행정망 PC 대응용입니다. 생성된 파일 하나만 옮기면
인터넷 연결 없이 브라우저에서 바로 열립니다(file:// 로 열어도 동작).

    python3 build/build_single.py              공개판 3개
    python3 build/build_single.py --internal   + 방제자원 내부판 (담당자 직통 포함)

── 내부판에 대하여 ────────────────────────────────────────────
③ 방제자원은 업체 담당자 개인 연락처가 필요한데 공개 배포에는 넣을 수
없습니다. 그래서 데이터 파일만 바꿔 두 벌로 만듭니다(build/make_resources.py).

    공개판  data/resources.js            → 화학사고_방제자원_동원.html
    내부판  data/resources.internal.js   → 화학사고_방제자원_동원_내부용.html

내부판은 .gitignore 로 저장소에서 제외되며, 화면 위에 빨간 "내부용 ·
외부 공유 금지" 띠가 자동으로 뜹니다(res/app.js 의 initDataBar).
메일로 돌리지 말고 내부망 공유폴더·업무포털로만 전달하세요.
"""
import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (원본 페이지, 결과 파일, 데이터 치환 규칙 or None)
PAGES = [
    (ROOT / "sms" / "index.html", "화학사고_주민대피문자_작성도구.html", None),
    (ROOT / "map" / "index.html", "화학사고_대피장소_지도.html", None),
    (ROOT / "res" / "index.html", "화학사고_방제자원_동원.html", None),
]
INTERNAL_PAGE = (ROOT / "res" / "index.html", "화학사고_방제자원_동원_내부용.html",
                 ("../data/resources.js", "../data/resources.internal.js"))

BANNER = """<!-- ────────────────────────────────────────────────────────────
     화학사고 지자체 대응 지원도구 — 오프라인 단일 파일
     · 이 파일 하나만 있으면 인터넷 연결 없이 동작합니다.
     · 외부 서버로 어떤 정보도 전송하지 않습니다.
     · 자료 갱신은 소스 저장소에서 재빌드하세요.
       (build/make_data.py · build/make_resources.py → build/build_single.py)
     ──────────────────────────────────────────────────────────── -->
"""

INTERNAL_BANNER = """<!-- ────────────────────────────────────────────────────────────
     ⚠ 내부용 — 업체 담당자 개인 연락처가 들어 있습니다.
     · 외부 공유·게시 금지. 내부망에서만 사용하세요.
     · 공개용이 필요하면 build/build_single.py 를 옵션 없이 다시 돌리세요.
     ──────────────────────────────────────────────────────────── -->
"""


def read(base: pathlib.Path, rel: str) -> str:
    path = (base / rel).resolve()
    if not path.exists():
        sys.exit(f"파일을 찾을 수 없습니다: {path}")
    return path.read_text(encoding="utf-8")


def build(page: pathlib.Path, out: pathlib.Path, swap=None) -> None:
    html = page.read_text(encoding="utf-8")
    base = page.parent

    # 내부판이면 데이터 파일 참조를 먼저 갈아끼운다 (인라인 전에 해야 함)
    if swap:
        if swap[0] not in html:
            sys.exit(f"데이터 참조를 찾지 못했습니다: {swap[0]} in {page.name}")
        html = html.replace(swap[0], swap[1])

    html = re.sub(
        r'[ \t]*<link rel="stylesheet" href="([^"]+)">',
        lambda m: "<style>\n" + read(base, m.group(1)) + "\n</style>",
        html,
    )
    html = re.sub(
        r'[ \t]*<script src="([^"]+)"></script>',
        lambda m: "<script>\n" + read(base, m.group(1)) + "\n</script>",
        html,
    )
    # 다른 도구로 가는 링크는 단일 파일에서 열 수 없으므로 안내로 바꾼다
    html = re.sub(r'<a class="sm btnlink"[^>]*>.*?</a>', "", html, flags=re.S)

    if 'src="' in html or 'href="assets' in html or 'href="../' in html:
        sys.exit(f"인라인되지 않은 외부 참조가 남아 있습니다: {page.name}")

    banner = BANNER + (INTERNAL_BANNER if swap else "")
    html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + banner, 1)
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("%-42s %6.0f KB%s"
          % (out.relative_to(ROOT), len(html.encode("utf-8")) / 1024,
             "   ← 개인정보 포함 · 외부 공유 금지" if swap else ""))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--internal", action="store_true",
                    help="방제자원 내부판(담당자 직통 포함)도 함께 만듭니다")
    args = ap.parse_args()

    for page, name, swap in PAGES:
        build(page, ROOT / "dist" / name, swap)

    if args.internal:
        page, name, swap = INTERNAL_PAGE
        if not (ROOT / "data" / "resources.internal.js").exists():
            sys.exit("data/resources.internal.js 가 없습니다. "
                     "먼저 python3 build/make_resources.py 를 돌리세요.")
        build(page, ROOT / "dist" / name, swap)
        print("\n⚠ 내부판은 담당자 개인 연락처를 담고 있습니다. "
              "내부망 공유폴더로만 전달하고 메일·외부 저장소로 내보내지 마세요.")

    print("→ 각 파일 하나씩 내부망 PC로 옮겨 브라우저에서 열면 됩니다.")


if __name__ == "__main__":
    main()
