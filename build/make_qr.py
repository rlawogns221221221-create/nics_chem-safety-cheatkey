"""시범운영 접속용 QR 코드를 만듭니다.

    python3 build/make_qr.py                                 # 기본 주소 둘
    python3 build/make_qr.py https://다른주소/                 # 접속 주소가 바뀌었을 때
    python3 build/make_qr.py https://다른주소/ https://새설문/   # 설문 주소까지 바뀌었을 때

만드는 것 (docs/QR/)
    QR_접속.svg · QR_접속.png   — QR 만 (문서·발표자료에 붙이는 용)
    QR_만족도조사.svg · .png    — 사용자 만족도 조사(네이버 폼 짧은 주소)
                                  휴대전화 사용설명서 첫 장에 접속 QR 과 나란히 들어갑니다
    QR_안내.html                — 안내 한 장의 원본 (서비스 이름 · QR · 주소)
    그다음 `node build/make_qr_card.mjs` 가 안내 한 장을 PNG·PDF 로 굽습니다.

왜 이렇게 했나
    · 주소는 **시범운영 주소 그대로**입니다(docs/링크막기.md — 이미 퍼진 주소라
      바꾸지 않습니다). 깃허브 Pages 는 닫혀 있어(pages.yml SITE_OPEN "no")
      기본값을 Cloudflare 주소로 둡니다.
    · 오류 정정은 Q(약 25%) — 인쇄물이 구겨지거나 일부가 가려져도 읽힙니다.
      주소가 짧아 H 로 올려도 칸이 커지지는 않지만, 칸이 촘촘해질수록 멀리서
      안 읽히므로 Q 에서 멈춥니다.
    · 검은 칸 · 흰 바탕만 씁니다. 색을 넣으면 카메라에 따라 못 읽는 일이 있습니다.
    · 가장자리 여백(quiet zone) 4칸은 QR 규격이 요구하는 값입니다 — 줄이지 마세요.
    · 이 스크립트만 segno(순수 파이썬)를 씁니다. 화면(사이트)과는 상관없습니다.
"""
import html
import pathlib
import sys

try:
    import segno
except ImportError:
    sys.exit("segno 가 필요합니다 — pip install segno")

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "QR"
주소 = sys.argv[1] if len(sys.argv) > 1 else "https://chem-safety-kr.pages.dev/"
# 만족도 조사 — 사용자가 알려 준 주소 그대로(2026-10-27). 짧은 주소라 QR 칸이 작아
# 멀리서도 잘 읽힙니다. 설문을 새로 만들면 이 줄(또는 둘째 인자)을 고치세요.
설문 = sys.argv[2] if len(sys.argv) > 2 else "https://naver.me/FaeWaurT"
서비스이름 = "화학사고 초동대응 지원 서비스"   # 7절 — 공식 이름 그대로

OUT.mkdir(parents=True, exist_ok=True)
qr = segno.make(주소, error="q", boost_error=False)
qr.save(OUT / "QR_접속.svg", scale=10, border=4, dark="#000", light="#fff",
        xmldecl=False, title=서비스이름 + " 접속")
qr.save(OUT / "QR_접속.png", scale=30, border=4, dark="#000", light="#fff")
qr2 = segno.make(설문, error="q", boost_error=False)
qr2.save(OUT / "QR_만족도조사.svg", scale=10, border=4, dark="#000", light="#fff",
         xmldecl=False, title="사용자 만족도 조사")
qr2.save(OUT / "QR_만족도조사.png", scale=30, border=4, dark="#000", light="#fff")

# 안내 한 장 — QR 은 SVG 를 그대로 박아 넣어 어느 크기로 인쇄해도 또렷합니다.
svg = qr.svg_inline(scale=10, border=4, dark="#000", light="#fff")
보이는주소 = 주소.replace("https://", "").rstrip("/")
(OUT / "QR_안내.html").write_text(f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>{html.escape(서비스이름)} — 접속 QR</title>
<style>
@font-face{{font-family:"Pretendard GOV";font-weight:400;
  src:url("../../assets/fonts/PretendardGOV-Regular.subset.woff2") format("woff2")}}
@font-face{{font-family:"Pretendard GOV";font-weight:700;
  src:url("../../assets/fonts/PretendardGOV-Bold.subset.woff2") format("woff2")}}
@page{{size:A4;margin:0}}
html,body{{margin:0;background:#fff}}
body{{font-family:"Pretendard GOV",sans-serif;color:#1d1d1d;
  width:210mm;height:297mm;display:flex;align-items:center;justify-content:center}}
.card{{width:150mm;border:1.2mm solid #256ef4;border-radius:6mm;overflow:hidden;
  text-align:center}}
.band{{background:#256ef4;color:#fff;padding:9mm 8mm 8mm}}
.band b{{display:block;font-size:9.2mm;letter-spacing:-.02em;line-height:1.25}}
.band span{{display:block;margin-top:2.5mm;font-size:4.6mm;opacity:.92}}
.qr{{padding:9mm 0 3mm}}
.qr svg{{width:104mm;height:104mm;display:block;margin:0 auto}}
.how{{margin:0;font-size:5.2mm;font-weight:700}}
.url{{margin:3mm 0 0;padding:0 0 10mm;font-size:5mm;color:#464c53;letter-spacing:.01em}}
</style></head><body>
<div class="card" id="card">
  <div class="band"><b>{html.escape(서비스이름)}</b>
    <span>방제 물품·장비 찾기 · 주민 대피장소 찾기 · 주민대피 문자생성기</span></div>
  <div class="qr">{svg}</div>
  <p class="how">휴대전화 카메라로 비추면 바로 열립니다</p>
  <p class="url">{html.escape(보이는주소)}</p>
</div>
</body></html>
""", encoding="utf-8")

print(f"  주소 {주소}")
print(f"  QR 버전 {qr.version} · 오류 정정 {qr.error} · {qr.symbol_size(border=4)[0]}칸")
print(f"  설문 {설문} · QR 버전 {qr2.version}")
print(f"  → {OUT.relative_to(ROOT)}/QR_접속.svg·png · QR_만족도조사.svg·png · QR_안내.html")
