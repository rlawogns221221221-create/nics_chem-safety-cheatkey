#!/usr/bin/env python3
"""CSS·JS·데이터를 모두 인라인한 오프라인 단일 HTML 파일을 만듭니다.

망분리된 행정망 PC 대응용입니다. 생성된 파일 하나만 옮기면
인터넷 연결 없이 브라우저에서 바로 열립니다(file:// 로 열어도 동작).

    python3 build/build_single.py              공개판 3개
    python3 build/build_single.py --internal   + 방제자원 내부판 (담당자 직통 포함)

── 내부판에 대하여 ────────────────────────────────────────────
③ 방제자원 자료(data/resources.js)에는 담당자 개인정보를 아예 싣지 않으므로
공개판 하나로 충분합니다. 나중에 담당자 직통번호를 담은 자료를 따로 만들
일이 생기면 data/resources.internal.js 를 두고 --internal 로 만드세요.
그 파일은 .gitignore 로 저장소에서 제외되며, 메일로 돌리지 말고 내부망
공유폴더·업무포털로만 전달해야 합니다.

── 있으면 넣고 없으면 넘어가는 파일 ───────────────────────────
data/resources.geo.js  — build/geocode.html 로 만드는 정확 좌표 파일입니다.
                         없으면 주소로 잡은 어림 좌표를 씁니다.
data/tempshelters.js   — build/fetch_tempshelter.html 로 받는 이재민
                         임시주거시설 자료입니다. 없으면 ② 지도에 그 층이
                         아예 나오지 않습니다(화면은 예전 그대로).
둘 다 없으면 그 <script> 줄을 빼고 만듭니다.
"""
import argparse
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (원본 페이지, 결과 파일, 데이터 치환 규칙 or None)
PAGES = [
    (ROOT / "sms" / "index.html", "화학사고_주민대피문자_생성기.html", None),
    (ROOT / "map" / "index.html", "화학사고_주민대피장소_찾기.html", None),
    (ROOT / "res" / "index.html", "화학사고_방제물품장비_찾기.html", None),
]
INTERNAL_PAGE = (ROOT / "res" / "index.html", "화학사고_방제물품장비_찾기_내부용.html",
                 ("../data/resources.js", "../data/resources.internal.js"))

# 있으면 넣고 없으면 넘어가는 자료 파일
OPTIONAL = ["resources.geo.js", "tempshelters.js"]

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



# ── 서체 심기 ────────────────────────────────────────────────
# shell.css 의 @font-face 는 assets/fonts/ 를 상대경로로 부릅니다. 한 파일로
# 합치면 그 경로가 깨지므로, 글꼴 파일을 data: 로 바꿔 심습니다. 안 심으면
# 조용히 맑은 고딕으로 대체되어 KRDS 표준 서체가 아닌 화면이 나갑니다.
# 두 굵기 합쳐 약 530KB → base64 약 700KB 만큼 파일이 커집니다.
FONT_URL = re.compile(r'url\("(fonts/[^"]+\.woff2)"\)')


def inline_fonts(html: str) -> str:
    def one(m):
        path = ROOT / "assets" / m.group(1)
        if not path.exists():
            sys.exit(f"글꼴 파일이 없습니다: {path}")
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        return f'url("data:font/woff2;base64,{b64}")'
    return FONT_URL.sub(one, html)


# ── 사진 심기 ────────────────────────────────────────────────
# 진입 화면에는 현장 사진 8장과 기관 로고가 들어갑니다. 한 파일로 합칠 때
# 그 경로가 깨지므로 data: 로 바꿔 심습니다. 8장 약 1.1MB → base64 약 1.5MB.
IMG_SRC = re.compile(r'src="((?:\./)?assets/img/[^"]+)"')
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".svg": "image/svg+xml"}


def inline_images(html: str, base: pathlib.Path) -> str:
    def one(m):
        rel = m.group(1)
        path = (base / rel).resolve()
        if not path.exists():
            sys.exit(f"사진 파일이 없습니다: {path}\n"
                     f"  python3 build/make_photos.py 를 먼저 돌리세요.")
        mime = MIME.get(path.suffix.lower())
        if not mime:
            sys.exit(f"어떤 형식인지 모르는 사진입니다: {path}")
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        return f'src="data:{mime};base64,{b64}"'
    return IMG_SRC.sub(one, html)


def read(base: pathlib.Path, rel: str) -> str:
    path = (base / rel).resolve()
    if not path.exists():
        sys.exit(f"파일을 찾을 수 없습니다: {path}")
    return path.read_text(encoding="utf-8")


# 웹앱(바탕화면 설치)용 줄들 — 단일 파일에서는 빼야 하는 것
#
# 이 파일은 망분리 PC 로 옮겨 file:// 로 여는 한 덩어리입니다. 옆에 파일이
# 없으므로 매니페스트·아이콘 파일을 부르면 그냥 404 가 납니다. 서비스워커도
# file:// 에서는 브라우저가 아예 막습니다. 그래서 아예 빼고 만듭니다.
#
# ⚠ 탭 아이콘(<link rel="icon" href="data:…>)은 **빼지 않습니다.**
#   그림이 주소 안에 그대로 들어 있어 파일을 더 부르지 않고, 단일 파일에서도
#   탭에 아이콘이 보입니다.
PWA_TAGS = [
    r'[ \t]*<link rel="manifest"[^>]*>\n?',
    r'[ \t]*<link rel="apple-touch-icon"[^>]*>\n?',
    r'[ \t]*<meta name="apple-mobile-web-app-[^>]*>\n?',
    r'[ \t]*<script src="[^"]*assets/pwa\.js"></script>\n?',
]


def strip_pwa(html: str) -> str:
    for pat in PWA_TAGS:
        html = re.sub(pat, "", html)
    return html


def build(page: pathlib.Path, out: pathlib.Path, swap=None) -> None:
    html = page.read_text(encoding="utf-8")
    base = page.parent
    html = strip_pwa(html)

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
    html = inline_fonts(html)
    # 있으면 넣고 없으면 그 줄을 빼는 파일 — 정확 좌표(build/geocode.html 로 만듦)
    for opt in OPTIONAL:
        tag = f'<script src="../data/{opt}"></script>'
        if tag in html and not (ROOT / "data" / opt).exists():
            html = re.sub(r"[ \t]*" + re.escape(tag) + r"\n?", "", html)

    # 인터넷이 있어야 되는 기능(장소 검색·도보 경로)은 단일 파일판에 넣지
    # 않습니다. 이 파일은 망분리 PC용이라 바깥으로 나가는 코드가 아예 없어야
    # 하고, 있어도 어차피 닿지 않습니다. 화면은 그대로 돕니다 —
    # app.js 들이 window.ONLINE 이 없으면 도구 안 자료로만 찾습니다.
    html = re.sub(r'[ \t]*<script src="[^"]*assets/online\.js"></script>\n?', "", html)
    html = re.sub(
        r'[ \t]*<script src="([^"]+)"></script>',
        lambda m: "<script>\n" + read(base, m.group(1)) + "\n</script>",
        html,
    )
    # 다른 도구로 가는 링크는 단일 파일에서 열 수 없으므로 안내로 바꾼다
    html = re.sub(r'<a class="sm btnlink"[^>]*>.*?</a>', "", html, flags=re.S)
    # ② → ① 이어쓰기 단추도 마찬가지 — 옆 파일이 없으므로 아예 뺍니다
    # (map/app.js 의 renderToSms 는 단추가 없으면 그냥 넘어갑니다)
    html = re.sub(r'[ \t]*<button[^>]*id="btnToSms"[^>]*>.*?</button>\n?', "",
                  html, flags=re.S)
    # 인터넷 기능이 빠졌으므로 '도보 경로' 켜고 끄기도 뺍니다 (눌러도 할 일이 없음)
    html = re.sub(r'[ \t]*<label class="mapchk" title="고른 (?:대피장소까지|자원이)[^>]*>.*?</label>\n?',
                  "", html, flags=re.S)

    if 'src="' in html or 'href="assets' in html or 'href="../' in html:
        sys.exit(f"인라인되지 않은 외부 참조가 남아 있습니다: {page.name}")

    banner = BANNER + (INTERNAL_BANNER if swap else "")
    html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + banner, 1)
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("%-42s %6.0f KB%s"
          % (out.relative_to(ROOT), len(html.encode("utf-8")) / 1024,
             "   ← 개인정보 포함 · 외부 공유 금지" if swap else ""))


# ── 진입 화면 한 파일로 (사용자 확인용) ──────────────────────────
# 왜 필요한가 — 진입 화면은 index.html + portal.css + 사진 9장으로 되어 있어
# Artifact(한 파일만 올라감)로는 보여 줄 수 없었습니다. 그래서 사용자가
# **새로 꾸민 진입 화면을 눌러 볼 방법이 없었습니다.** 이것으로 만듭니다.
#
# 이 파일은 배포물이 아닙니다(release/ · dist/ 에 들어가지 않습니다).
# 망분리 PC 에는 도구 3개를 따로 넣으므로 진입 화면이 할 일이 없습니다.
#
# 도구로 가는 링크는 파일 안에서는 열 수 없으므로 Artifact 주소로 바꿉니다.
# 주소는 CLAUDE.md 5절의 표와 같아야 합니다 — 링크를 새로 올리면 여기도 고치세요.
PORTAL_LINKS = {
    "map/index.html": "https://claude.ai/code/artifact/c10d00e5-8ad9-454e-9caf-b4f010f00ef8",
    "sms/index.html": "https://claude.ai/code/artifact/a42de0d3-9c73-4d67-b048-b4bf9c9c2c53",
    "res/index.html": "https://claude.ai/code/artifact/26c97527-e8ce-4629-8c12-0790afdceb87",
}
PORTAL_BANNER = """<!-- ────────────────────────────────────────────────────────────
     진입 화면 — 사용자 확인용 한 파일 (build/build_single.py 가 만듦)
     · 실제 진입 화면은 저장소 뿌리의 index.html 입니다. 이 파일은 배포에
       들어가지 않습니다 — 눌러 볼 수 있게 한 덩어리로 합친 사본입니다.
     · 도구로 가는 링크는 Artifact 주소로 바꿔 두었습니다.
     ──────────────────────────────────────────────────────────── -->
"""


def build_portal(out: pathlib.Path) -> None:
    page = ROOT / "index.html"
    html = page.read_text(encoding="utf-8")
    html = strip_pwa(html)
    html = re.sub(
        r'[ \t]*<link rel="stylesheet" href="([^"]+)">',
        lambda m: "<style>\n" + read(page.parent, m.group(1)) + "\n</style>",
        html,
    )
    html = re.sub(
        r'[ \t]*<script src="([^"]+)"></script>',
        lambda m: "<script>\n" + read(page.parent, m.group(1)) + "\n</script>",
        html,
    )
    html = inline_fonts(html)
    html = inline_images(html, page.parent)
    for rel, url in PORTAL_LINKS.items():
        if f'href="{rel}"' not in html:
            sys.exit(f"진입 화면에서 도구 링크를 찾지 못했습니다: {rel}")
        html = html.replace(f'href="{rel}"',
                            f'href="{url}" target="_blank" rel="noopener noreferrer"')
    left = re.findall(r'(?:src|href)="(?!https?:|#|data:|mailto:|tel:)([^"]+)"', html)
    if left:
        sys.exit(f"인라인되지 않은 외부 참조가 남아 있습니다: {left}")
    html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + PORTAL_BANNER, 1)
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("%-42s %6.0f KB   ← 사용자 확인용 (배포 아님)"
          % (out.relative_to(ROOT), len(html.encode("utf-8")) / 1024))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--internal", action="store_true",
                    help="방제자원 내부판(담당자 직통 포함)도 함께 만듭니다")
    args = ap.parse_args()

    for page, name, swap in PAGES:
        build(page, ROOT / "dist" / name, swap)
    build_portal(ROOT / "preview" / "진입화면_한파일.html")

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
