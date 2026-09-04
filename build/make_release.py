#!/usr/bin/env python3
"""배포용 폴더를 만듭니다 — 완성물만, 개발용 파일 없이.

    python3 build/make_release.py

화학물질안전원 누리집에 올리거나 다른 기관에 넘길 때, 저장소를 통째로
건네면 받는 쪽이 무엇을 올려야 할지 알 수 없습니다. 화면이 실제로 쓰는
것만 골라 폴더 하나와 압축파일 하나로 만듭니다.

── 무엇을 빼는가 ────────────────────────────────────────────
    source/   원자료 26MB — 대피장소 목록·실제발송사례·물질정보 원본.
              화면은 이미 data/*.js 로 변환된 것을 쓰므로 필요 없고,
              누리집에 올려 둘 자료도 아닙니다.
    build/    이 스크립트를 포함한 생성 도구. 자료를 다시 만들 때만 씁니다.
    docs/     분석·변경점 기록. 개발 과정 문서입니다.
    .github/  배포 자동화 설정.
    README.md 개발자용 문서. 받는 쪽에는 전달안내.md 를 따로 만들어 줍니다.

── 무엇을 검사하는가 ────────────────────────────────────────
    ① 개인정보 — 방제업체 담당자 연락처가 섞이면 만들지 않고 멈춥니다.
    ② 깨진 참조 — HTML 이 부르는 파일이 폴더 안에 실제로 있는지 봅니다.
       예전에 index.html 만 따로 옮겼다가 화면이 깨진 적이 있어,
       넘기기 전에 기계가 확인하게 해 둡니다.
"""
import pathlib
import re
import shutil
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "release"
SITE_NAME = "화학사고_초동대응_지원_서비스"
OFFLINE_NAME = "망분리PC용_단일파일"

# 화면이 실제로 부르는 것만
#
# manifest.webmanifest 는 **사이트 뿌리에 있어야** 합니다 —
# start_url·scope 가 자기 위치를 기준으로 잡히기 때문입니다.
#
# sw.js 는 지금 **아무 일도 하지 않고 스스로를 지우는** 파일입니다.
# 예전 판(인터넷 끊겨도 열리게 하던 것)이 실제 배포에서 하위 화면 진입을
# 끊어 버려서 뺐는데, 이미 예전 판을 열어 본 사람의 브라우저에는 그것이
# 남아 있습니다. 이 파일이 그 사람들을 고쳐 주므로 **빼지 마세요.**
SITE_ITEMS = ["index.html", "manifest.webmanifest", "sw.js",
              "assets", "data", "sms", "map", "res"]


def fail(msg: str) -> None:
    sys.exit("\n중단: " + msg + "\n")


# ── ① 개인정보 ──────────────────────────────────────────────
# 내부판(담당자 개인 연락처)은 만든 사람 PC에는 있는 것이 정상입니다.
# 그래서 "있으면 중단"이 아니라 "복사할 때 빼고, 결과물에 없는지 확인"합니다.
# 확인 대상은 소스 폴더가 아니라 실제로 넘길 폴더여야 의미가 있습니다.

def skip_internal(directory, names):
    """copytree 가 내부판·개인정보 파일을 건너뛰게 한다."""
    return [n for n in names if "internal" in n or "내부용" in n]


def check_source() -> None:
    """공개판 자료 자체에 담당자가 섞여 있으면 그건 만들기 전에 고쳐야 한다."""
    pub = (ROOT / "data" / "resources.js").read_text(encoding="utf-8")
    if '"p":{' in pub:
        fail("data/resources.js 에 담당자(p) 항목이 있습니다.\n"
             "      python3 build/make_resources.py 로 공개판을 다시 만드세요.")


def check_output(out: pathlib.Path) -> None:
    """넘길 폴더를 통째로 훑어 개인정보가 남았는지 본다."""
    bad = []
    for p in out.rglob("*"):
        if not p.is_file():
            continue
        if "internal" in p.name or "내부용" in p.name:
            bad.append(f"{p.relative_to(out)} — 내부용 파일")
            continue
        if p.suffix in (".js", ".html"):
            text = p.read_text(encoding="utf-8", errors="ignore")
            if '"p":{' in text:
                bad.append(f"{p.relative_to(out)} — 담당자(p) 항목")
            elif re.search(r"01[016-9]-\d{3,4}-\d{4}", text):
                bad.append(f"{p.relative_to(out)} — 휴대전화 번호")
    if bad:
        shutil.rmtree(out)
        fail("배포용 폴더에 개인정보가 있어 만들지 않았습니다:\n      "
             + "\n      ".join(bad))
    print("  개인정보 검사 통과 — 담당자 연락처·휴대전화 없음")


# ── ② 깨진 참조 검사 ─────────────────────────────────────────
# 있으면 쓰고 없으면 화면이 그냥 넘어가는 파일
#   resources.geo.js  — build/geocode.html 로 만듭니다 (방제자원 정확 좌표)
#   tempshelters.js   — build/fetch_tempshelter.html 로 만듭니다 (이재민 임시주거시설)
OPTIONAL = {"resources.geo.js", "tempshelters.js"}


def check_links(site: pathlib.Path) -> None:
    """HTML 이 부르는 파일이 폴더 안에 실제로 있는지 본다."""
    missing = []
    checked = 0
    for html in site.rglob("*.html"):
        text = html.read_text(encoding="utf-8")
        for ref in re.findall(r'(?:src|href)="([^"]+)"', text):
            if ref.startswith(("http://", "https://", "#", "mailto:", "tel:", "data:")):
                continue
            checked += 1
            if ref.rsplit("/", 1)[-1] in OPTIONAL:
                continue          # 있으면 쓰고 없으면 넘어가는 파일
            if not (html.parent / ref).resolve().exists():
                missing.append(f"{html.relative_to(site)} → {ref}")
    if missing:
        fail("화면이 부르는 파일이 없습니다:\n      " + "\n      ".join(missing))
    print(f"  참조 검사 통과 — {checked}개 경로 모두 폴더 안에 있음")


# ── 전달안내 ────────────────────────────────────────────────
def handover(site: pathlib.Path) -> str:
    ver = (ROOT / "data" / "version.js").read_text(encoding="utf-8")
    def pick(key, default="—"):
        m = re.search(key + r'\s*:\s*"([^"]*)"', ver)
        return m.group(1) if m else default

    meta = (ROOT / "data" / "resources.js").read_text(encoding="utf-8")
    is_sample = '"예시자료": true' in meta

    n_files = sum(1 for p in site.rglob("*") if p.is_file())
    size_mb = sum(p.stat().st_size for p in site.rglob("*") if p.is_file()) / 1024 / 1024

    return f"""# 화학사고 초동대응 지원 서비스 — 전달 안내

화학사고가 났을 때 지자체 담당자가 쓰는 업무도구 3종과, 그 셋을 고르는
첫 화면입니다. 웹브라우저만 있으면 되고 별도 프로그램 설치가 필요 없습니다.

    ① 방제 물품·장비 찾기 — 지금 필요한 물품·장비를 고르면 사고지점 주변에서 찾아 연락합니다
    ② 주민 대피장소 찾기  — 사고지점 주변 대피장소를 거리·도보시간과 함께 찾습니다
    ③ 주민대피 문자생성기 — 사고정보를 넣으면 재난문자 표준문안이 만들어집니다

## 어떻게 올리나요

`{SITE_NAME}` 폴더를 **통째로** 웹서버에 올리고, 그 안의 `index.html` 이
첫 화면이 되게 하면 됩니다. 서버 프로그램(PHP·Node 등)은 필요 없습니다.
정적 파일만 있으면 동작합니다.

폴더 안의 파일들은 서로를 상대경로로 부릅니다. **파일 하나만 따로 옮기면
화면이 깨집니다.** 폴더 구조를 그대로 유지해 주세요.

## 올리기 전에 반드시 확인할 것 두 가지

### 1. https 로 서비스해야 합니다

`http://` 로 올리면 브라우저가 **‘내 위치 찾기’ 기능을 막습니다.**
현장에 나간 담당자가 휴대전화로 자기 위치를 찍는 기능이라 실제로 쓰입니다.

### 2. 브이월드 인증키의 활용 도메인을 등록해야 합니다

배경지도(도로·건물)는 국토교통부 브이월드에서 받아옵니다.
`{SITE_NAME}/data/basemap.js` 의 `인증키` 값을 **실제 서비스 도메인으로
새로 발급받은 키**로 바꾸고, 발급 시 활용 도메인에 그 주소를 등록해 주세요.

등록 전에도 화면은 정상 동작합니다 — 브이월드가 응답하지 않으면 자동으로
OpenStreetMap 배경으로 바뀝니다. 다만 국내 지명 표기는 브이월드가 낫습니다.

## 지금 자료 상태

| 자료 | 출처 | 기준일 |
|---|---|---|
| 대피장소 | {pick('대피장소_출처')} | {pick('대피장소_기준일')} |
| 물질정보 | {pick('물질정보_출처')} | {pick('물질정보_기준')} |
| 사고통계 | {pick('통계_출처')} | {pick('통계_기간')} |
| 문안 | {pick('문안근거')} | 반영 {pick('반영일')} |
{"| **방제자원** | **예시 자료 — 실제 업체가 아닙니다** | **교체 필요** |" if is_sample else ""}
{'''
> **③ 방제자원은 아직 예시 자료입니다.** 화면 확인용으로 만든 가짜 업체이며
> 전화번호도 실제 번호가 아닙니다. 화면 위에 그 사실을 알리는 띠가 떠 있습니다.
> **실제 자료로 바꾼 뒤 다시 만들어 올려야 합니다.**
''' if is_sample else ""}
## 바탕화면 아이콘으로 쓸 수 있습니다 (웹앱)

올린 주소를 열면, 담당자가 **바탕화면 아이콘으로 놓고** 쓸 수 있습니다.
설치할 프로그램은 없고 브라우저가 하는 일입니다.

- **안드로이드 휴대전화** — 크롬으로 열고 오른쪽 위 **⋮ → 홈 화면에 추가**
- **아이폰·아이패드** — **사파리**로 열고 아래쪽 공유 단추(□↑) →
  **‘홈 화면에 추가’** (크롬이 아니라 사파리여야 합니다)
- **업무용 PC** — 크롬 **⋮ → 저장 및 공유 → 바로가기 만들기**
  (엣지는 **··· → 앱 → 이 사이트를 앱으로 설치**)

화면 아래쪽에 ‘바탕화면에 추가’ 단추가 보이면 그것을 눌러도 됩니다 —
브라우저·기종에 따라 안 보일 수 있어 위의 메뉴 방법을 먼저 적었습니다.

아이콘으로 열어도 **인터넷은 필요합니다.** "인터넷이 끊겨도 열리게" 하는
기능은 넣었다가 뺐습니다 — 실제 배포 주소에서 하위 화면 진입을 끊어 버려
네 번 고쳐도 해결되지 않았습니다. 인터넷이 안 되는 자리에서는 함께 드리는
`{OFFLINE_NAME}` 폴더(파일 하나로 도는 판)를 쓰세요.

자료를 고쳐 다시 올리면 담당자가 **다음에 열 때** 반영됩니다.

> `manifest.webmanifest` 와 `sw.js` 는 **폴더 맨 위(index.html 옆)에**
> 두세요. `sw.js` 는 지금 아무 일도 하지 않지만, 예전 판을 열어 본
> 담당자의 브라우저에 남은 것을 지워 주는 구실을 합니다.

## 개인정보

방제업체 **담당자 개인 이름·연락처는 들어 있지 않습니다.** 사업장 대표번호만
담았습니다. 대피장소도 관할부서·대표전화만 있고 담당자 개인정보는 없습니다.

이 폴더를 만들 때 담당자 정보가 섞였는지 기계로 검사했고, 하나라도 걸리면
폴더가 만들어지지 않습니다.

## 이 도구가 하지 않는 것

판단은 사람이 합니다. 도구는 자료를 모아 보여줄 뿐입니다.

- 어느 대피장소·방제자원이 적절한지 **판단하지 않습니다**
- 지도의 반경 원은 물질정보에 적힌 참고 거리이며 **확산 모델링이 아닙니다**
- 거리는 **직선거리**이고, 도보·차량 소요시간은 그것을 도로 사정에 맞춰
  늘려 잡은 **어림값**입니다. 실제 경로를 계산한 값이 아닙니다
- 업체는 폐업하고 담당자는 바뀝니다. **연락 전 가동 여부를 확인해야 합니다**

## 함께 넣은 설명서 두 가지 (PDF)

**`…_한장요약.pdf` (A4 1쪽)** — 인쇄해 책상·상황실에 붙여 두는 것입니다.
주소, 도구 세 가지의 화면과 걸음, 바탕화면에 놓는 법, 꼭 기억할 것,
안 될 때가 한 장에 들어 있습니다. 급할 때는 이 한 장이면 됩니다.

**`…_사용설명서.pdf` (A4 7쪽)** — **거의 그림입니다.** 실제 화면 사진에
①②③ 을 박아 어디를 누르는지 표시했고, 글은 낱말만 답니다. 접속 방법
(PC·안드로이드·아이폰), 바탕화면 아이콘 만들기, 도구 세 가지 사용법,
꼭 알아 두기, 안 될 때가 들어 있습니다.

공문에 붙이거나 인쇄해 상황실에 두시면 됩니다. 웹서버에 올릴 필요는
없습니다(올리고 싶으면 사이트 폴더로 옮기면 됩니다).

## 함께 넣은 `{OFFLINE_NAME}` 폴더

인터넷이 차단된 망분리 PC 용입니다. HTML 파일 하나에 화면·자료가 모두 들어
있어, 그 파일 하나만 옮기면 브라우저에서 바로 열립니다.

**누리집에 올릴 필요는 없습니다.** 망분리 환경에서 쓸 담당자에게 따로 나눠
주거나, 누리집에 내려받기 링크로 걸어 두는 용도입니다.

---

이 폴더: 파일 {n_files}개 · {size_mb:.1f}MB
"""


def main() -> None:
    print("배포용 폴더를 만듭니다\n")

    check_source()

    if OUT.exists():
        shutil.rmtree(OUT)
    site = OUT / SITE_NAME
    site.mkdir(parents=True)

    # ── 지자체 담당자용 사용설명서 ──
    # 사이트 폴더가 아니라 **그 옆**에 둡니다. 웹서버에 올리는 것이 아니라
    # 공문에 붙여 보내는 파일이기 때문입니다(올리고 싶으면 사이트 폴더로
    # 옮기면 됩니다).
    for name in ("화학사고_초동대응_지원_서비스_사용설명서.pdf",
                 "화학사고_초동대응_지원_서비스_한장요약.pdf"):
        g = ROOT / "docs" / name
        if g.exists():
            shutil.copy2(g, OUT / name)

    # ── 화면 파일 ──
    for name in SITE_ITEMS:
        src = ROOT / name
        if not src.exists():
            fail(f"{name} 이 없습니다.")
        if src.is_dir():
            shutil.copytree(src, site / name, ignore=skip_internal)
        else:
            shutil.copy2(src, site / name)

    check_links(site)

    # ── 망분리용 단일 파일 ──
    off = OUT / OFFLINE_NAME
    off.mkdir()
    singles = sorted(p for p in (ROOT / "dist").glob("*.html") if "내부용" not in p.name)
    if not singles:
        fail("dist 에 단일 파일이 없습니다. python3 build/build_single.py 를 먼저 돌리세요.")
    for p in singles:
        shutil.copy2(p, off / p.name)

    # ── 넘길 폴더를 통째로 다시 검사 ──
    check_output(OUT)

    # ── 전달안내 ──
    (OUT / "전달안내.md").write_text(handover(site), encoding="utf-8")

    # ── 압축 ──
    zip_path = ROOT / f"{SITE_NAME}_배포용.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(OUT.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(OUT))

    # ── 요약 ──
    n = sum(1 for p in site.rglob("*") if p.is_file())
    mb = sum(p.stat().st_size for p in site.rglob("*") if p.is_file()) / 1024 / 1024
    print(f"\n  {OUT.relative_to(ROOT)}/")
    print(f"    {SITE_NAME}/        파일 {n}개 · {mb:.1f}MB   ← 웹서버에 통째로 올리세요")
    for p in singles:
        print(f"    {OFFLINE_NAME}/{p.name}"[:64]
              + f"  {p.stat().st_size / 1024:.0f}KB")
    print(f"    전달안내.md")
    print(f"\n  {zip_path.name}  {zip_path.stat().st_size / 1024 / 1024:.1f}MB"
          "   ← 이 파일 하나만 보내면 됩니다")
    print("\n  뺀 것: source(원자료) · build(생성도구) · docs(개발기록) · .github(배포설정)")


if __name__ == "__main__":
    main()
