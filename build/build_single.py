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


def offline_basemap(text: str) -> str:
    """오프라인 단일 파일에서는 배경지도를 강제로 끕니다.

    망분리 PC 는 타일 서버에 닿을 수 없어 배경지도가 어차피 표시되지 않습니다.
    켠 채로 두면 두 가지가 남습니다.
      · 지도를 열 때마다 외부 서버로 요청이 한 번 나갑니다
        (실패하고 경계선 지도로 돌아오지만, '외부 참조 0건' 이 깨집니다)
      · 인증키가 배포 파일에 박혀 파일과 함께 돌아다닙니다
    둘 다 피하기 위해 빌드 단계에서 끄고 인증키도 비웁니다.

    홈페이지 게시본(저장소를 그대로 올리는 방식)은 data/basemap.js 설정을
    그대로 쓰므로, 켜 두면 켜진 채로 동작합니다.
    """
    # 파일 앞머리 주석에도 같은 문구가 나오므로 설정 블록만 고칩니다
    head, sep, body = text.partition("var BASEMAP")
    if not sep:
        sys.exit("data/basemap.js 구조가 바뀌었습니다 (var BASEMAP 을 찾지 못함)")
    body, n1 = re.subn(r"(\n\s*사용:\s*)true", r"\1false", body, count=1)
    body, n2 = re.subn(r'(\n\s*인증키:\s*")[^"]*(")', r"\1\2", body, count=1)
    if n2 != 1:
        sys.exit("data/basemap.js 의 인증키 항목을 찾지 못했습니다")
    return head + sep + body + (
        "\n/* ※ 오프라인 단일 파일 빌드에서 배경지도를 자동으로 껐습니다.\n"
        "      망분리 PC 는 타일 서버에 닿지 못해 어차피 표시되지 않으며,\n"
        "      인증키를 배포 파일에 넣지 않기 위한 것입니다.\n"
        "      (홈페이지 게시본은 data/basemap.js 설정을 그대로 씁니다) */\n"
    )


def read(base: pathlib.Path, rel: str) -> str:
    path = (base / rel).resolve()
    if not path.exists():
        sys.exit(f"파일을 찾을 수 없습니다: {path}")
    text = path.read_text(encoding="utf-8")
    if path.name == "basemap.js":
        text = offline_basemap(text)
    return text


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

    # 배포 파일에 인증키가 섞여 들어가지 않았는지 확인. 오프라인 파일은 인터넷이
    # 없어 키가 쓸모없고, 파일과 함께 돌아다닐 여지만 남습니다.
    # (설명용 자리표시자 "발급받은 키" 는 한글이라 아래 패턴에 걸리지 않습니다)
    m = re.search(r'인증키:\s*"([A-Za-z0-9][A-Za-z0-9\-_.]{7,})"', html)
    if m:
        sys.exit(f"단일 파일에 인증키가 남아 있습니다: {page.name} ({m.group(1)[:8]}…)")

    html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + BANNER, 1)
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"{out.relative_to(ROOT)}  ({len(html.encode('utf-8')) / 1024:.0f} KB)")


def main() -> None:
    for page, out in PAGES:
        build(page, out)
    print("→ 각 파일 하나씩 내부망 PC로 옮겨 브라우저에서 열면 됩니다.")


if __name__ == "__main__":
    main()
