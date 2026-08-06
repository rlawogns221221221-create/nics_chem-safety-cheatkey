#!/usr/bin/env python3
"""CSS·JS·데이터를 모두 인라인한 오프라인 단일 HTML 파일을 만듭니다.

망분리된 행정망 PC 대응용입니다. 생성된 파일 하나만 옮기면
인터넷 연결 없이 브라우저에서 바로 열립니다(file:// 로 열어도 동작).

    python3 build/build_single.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = [
    (ROOT / "sms" / "index.html", ROOT / "dist" / "화학사고_주민대피문자_작성도구.html"),
    (ROOT / "map" / "index.html", ROOT / "dist" / "화학사고_대피장소_지도.html"),
]

BANNER = """<!-- ────────────────────────────────────────────────────────────
     화학사고 주민대피 문자 작성 지원도구 — 오프라인 단일 파일
     · 이 파일 하나만 있으면 인터넷 연결 없이 동작합니다.
     · 외부 서버로 어떤 정보도 전송하지 않습니다.
     · 문안/대피장소 갱신은 소스 저장소에서 재빌드하세요.
       (build/make_data.py → build/build_single.py)
     ──────────────────────────────────────────────────────────── -->
"""


def read(base: pathlib.Path, rel: str) -> str:
    path = (base / rel).resolve()
    if not path.exists():
        sys.exit(f"파일을 찾을 수 없습니다: {path}")
    return path.read_text(encoding="utf-8")


def check_counts() -> None:
    """진입 화면이 적는 대피장소 건수가 실제 데이터와 같은지 본다.

    index.html 은 data/shelters.js 를 불러오지 않습니다(700KB 를 진입 화면에서
    받게 할 이유가 없습니다). 대신 data/version.js 에 적어 둔 건수를 쓰는데,
    데이터만 갱신하고 이 숫자를 안 고치면 화면에 옛 건수가 남습니다.
    빌드할 때마다 대조해 조용히 어긋나는 일을 막습니다.
    """
    meta = (ROOT / "data" / "shelters.js").read_text(encoding="utf-8")[:2000]
    ver = (ROOT / "data" / "version.js").read_text(encoding="utf-8")
    a = re.search(r'"총건수":\s*(\d+)', meta)
    b = re.search(r"대피장소_건수:\s*(\d+)", ver)
    if not a or not b:
        sys.exit("대피장소 건수를 찾지 못했습니다 (shelters.js / version.js 확인)")
    if a.group(1) != b.group(1):
        sys.exit(
            f"대피장소 건수가 다릅니다 — shelters.js {a.group(1)}곳, "
            f"version.js {b.group(1)}곳. data/version.js 의 대피장소_건수 를 고치세요."
        )


def build(page: pathlib.Path, out: pathlib.Path) -> None:
    html = page.read_text(encoding="utf-8")
    base = page.parent

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

    html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + BANNER, 1)
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"{out.relative_to(ROOT)}  ({len(html.encode('utf-8')) / 1024:.0f} KB)")


def main() -> None:
    check_counts()
    for page, out in PAGES:
        build(page, out)
    print("→ 각 파일 하나씩 내부망 PC로 옮겨 브라우저에서 열면 됩니다.")


if __name__ == "__main__":
    main()
