#!/usr/bin/env python3
"""진입 화면에 쓰는 현장 사진 만들기 — source/photos → assets/img/site

    python3 build/make_photos.py

왜 스크립트로 두는가
  사진마다 비율이 다르고(파노라마 2.17 : 세로 0.75 까지) 원본은 4000px·3~4MB
  입니다. 그대로 쓰면 (1) 진입 화면이 수십 MB 가 되고 (2) 비율이 뒤죽박죽이라
  줄이 안 맞아 눈이 불편합니다. 그래서 **쓸 자리마다 미리 정해 둔 한 가지
  비율로 잘라** 내보냅니다. 화면에서는 다시 자르지 않으므로 어느 브라우저에서나
  같게 보입니다.

  사진을 바꾸거나 자리를 옮기려면 아래 PLAN 만 고치고 다시 돌리세요.

무엇을 하는가
  1. EXIF 회전을 **파일에 굽습니다.** 휴대전화 사진은 "가로로 찍힌 뒤 세로로
     돌려 보라"는 표시(EXIF Orientation)만 붙어 있는 것이 있어, 그 표시를
     안 읽는 브라우저에서는 90° 누워 보입니다(IMG_1632 이 그렇습니다).
  2. 가장자리의 **검은 띠를 떼어냅니다.** 화면을 캡처한 사진에 letterbox 가
     붙어 있는 것이 있습니다(IMG_7451).
  3. EXIF 를 전부 지웁니다 — 촬영 위치(GPS)·기기 정보가 배포판에 섞여 나가지
     않게 합니다.
  4. 자리에 맞는 비율로 가운데(또는 지정한 초점)를 기준으로 자르고 줄입니다.

※ 사진 안에 찍힌 차량번호·사람 얼굴은 이 스크립트가 가리지 않습니다.
   make_release.py 의 개인정보 검사는 **글자만** 봅니다 — 사진은 못 봅니다.
   공개 배포 전에 사람이 눈으로 확인해야 합니다.
"""
import pathlib
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow 가 필요합니다:  pip install Pillow")

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "source" / "photos"
OUT = ROOT / "assets" / "img" / "site"

# ── 어디에 무엇을 쓸까 ──────────────────────────────────────────
#   name   내보낼 파일 이름 (assets/img/site/<name>.jpg)
#   src    원본 파일
#   w,h    내보낼 크기 — 이 비율로 잘립니다
#   focus  자를 때 남길 초점 (0=위/왼쪽, 0.5=가운데, 1=아래/오른쪽)
#          세로 사진을 가로 칸에 넣을 때 하늘만 남지 않게 하려는 것입니다.
PLAN = [
    # 머리 띠 — 파노라마라서 넓은 띠에 딱 맞습니다(자를 것이 거의 없음)
    dict(name="hero-command", src="IMG_7448.jpeg", w=2000, h=900, focus=(0.5, 0.55),
         what="화학사고 현장 지휘차"),

    # 도구 카드 세 장의 머리 사진 — 셋을 같은 비율로 맞춰야 카드 줄이 맞습니다
    dict(name="card-map", src="IMG_7450.jpeg", w=1000, h=520, focus=(0.5, 0.5),
         what="현장으로 이동하는 지휘버스와 차량"),
    dict(name="card-sms", src="IMG_8436.jpeg", w=1000, h=520, focus=(0.5, 0.5),
         what="지휘차 앞에서 대응 준비 중인 사람들"),
    dict(name="card-res", src="IMG_8437.jpeg", w=1000, h=520, focus=(0.5, 0.58),
         what="보호복과 사족보행 관측 로봇"),

    # 현장 사진 모음 — 넷을 같은 4:3 으로 맞춥니다
    dict(name="site-foam", src="IMG_7451.jpeg", w=1000, h=750, focus=(0.5, 0.62),
         what="소방 방수와 보호복"),
    dict(name="site-tank", src="IMG_7454.jpeg", w=1000, h=750, focus=(0.5, 0.5),
         what="저장탱크 주변의 보호복"),
    dict(name="site-robot", src="IMG_7452.jpeg", w=1000, h=750, focus=(0.5, 0.55),
         what="현장에 내린 관측 장비"),
    # 세로 사진(0.75)을 가로 칸에 넣습니다. 해가 화면 위쪽 40% 쯤에 있어
    # 초점을 위로 올려 잡지 않으면 해와 수평선이 함께 잘려 나갑니다.
    dict(name="site-dawn", src="IMG_1632.jpeg", w=1000, h=750, focus=(0.5, 0.42),
         what="새벽 해안"),
]

QUALITY = 76          # 배경·장식용이라 76 으로 충분합니다(눈으로 차이가 안 납니다)

# letterbox 를 가리는 기준 — **어둡기만 보면 안 됩니다.** 처음에 "밝기 46 아래"
# 로만 봤다가, 새벽 해안 사진(IMG_1632)의 어두운 갯벌을 띠로 잘못 알고 288줄을
# 잘라먹었습니다. 진짜 띠는 어두운 **동시에 한 줄이 통째로 같은 색**이고,
# 사진 속 어두운 부분은 밝기가 들쭉날쭉합니다(폭 30~50 대 폭 2~4).
BAR_MEAN = 90         # 이 밝기보다 어둡고
BAR_SPREAD = 12       # 한 줄 안의 밝기 차이가 이보다 작으면 띠로 본다


def trim_bars(im: Image.Image) -> Image.Image:
    """가장자리의 검은 띠(letterbox)를 떼어낸다. 사진 자체가 어두운 경우를
       잘라먹지 않도록, 한 변에서 최대 12% 까지만 본다."""
    g = im.convert("L")
    w, h = g.size
    lim_y, lim_x = int(h * 0.12), int(w * 0.12)

    def is_bar(px):
        return px and (sum(px) / len(px)) < BAR_MEAN and (max(px) - min(px)) <= BAR_SPREAD

    def row(y):
        return is_bar([g.getpixel((x, y)) for x in range(0, w, 40)])

    def col(x):
        return is_bar([g.getpixel((x, y)) for y in range(0, h, 40)])

    top = 0
    while top < lim_y and row(top):
        top += 1
    bot = h - 1
    while bot > h - 1 - lim_y and row(bot):
        bot -= 1
    left = 0
    while left < lim_x and col(left):
        left += 1
    right = w - 1
    while right > w - 1 - lim_x and col(right):
        right -= 1

    if (top, left, right, bot) == (0, 0, w - 1, h - 1):
        return im
    print(f"      검은 띠 떼어냄 — 위 {top} 아래 {h - 1 - bot} 왼쪽 {left} 오른쪽 {w - 1 - right}")
    return im.crop((left, top, right + 1, bot + 1))


def cut(im: Image.Image, tw: int, th: int, focus) -> Image.Image:
    """tw:th 비율로 초점을 남기고 자른 뒤 그 크기로 줄인다."""
    w, h = im.size
    want = tw / th
    have = w / h
    if have > want:                       # 원본이 더 넓다 → 좌우를 자른다
        nw = int(round(h * want))
        x = int(round((w - nw) * focus[0]))
        im = im.crop((max(0, min(x, w - nw)), 0, max(0, min(x, w - nw)) + nw, h))
    elif have < want:                     # 원본이 더 높다 → 위아래를 자른다
        nh = int(round(w / want))
        y = int(round((h - nh) * focus[1]))
        im = im.crop((0, max(0, min(y, h - nh)), w, max(0, min(y, h - nh)) + nh))
    return im.resize((tw, th), Image.LANCZOS)


def main() -> None:
    if not SRC.is_dir():
        sys.exit(f"원본 폴더가 없습니다: {SRC.relative_to(ROOT)}")
    OUT.mkdir(parents=True, exist_ok=True)

    print("진입 화면 사진을 만듭니다\n")
    total = 0
    for p in PLAN:
        f = SRC / p["src"]
        if not f.exists():
            sys.exit(f"원본이 없습니다: {f.relative_to(ROOT)}")

        raw = Image.open(f)
        ori = (raw.getexif() or {}).get(274, 1)
        im = ImageOps.exif_transpose(raw).convert("RGB")   # 회전을 파일에 굽는다
        if ori not in (1, None):
            print(f"  {p['name']}: EXIF 회전({ori}) 을 파일에 구웠습니다")
        im = trim_bars(im)
        im = cut(im, p["w"], p["h"], p["focus"])

        dst = OUT / (p["name"] + ".jpg")
        # exif 를 넘기지 않으므로 GPS·기기 정보가 함께 나가지 않습니다
        im.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        kb = dst.stat().st_size // 1024
        total += kb
        print(f"  {dst.relative_to(ROOT)}   {p['w']}×{p['h']}  {kb}KB   ← {p['src']}  ({p['what']})")

    print(f"\n  모두 {len(PLAN)}장 · {total}KB")
    print("  ※ 사진에 찍힌 차량번호·얼굴은 이 스크립트가 가리지 않습니다 —")
    print("    공개 배포 전에 사람이 눈으로 확인하세요.")


if __name__ == "__main__":
    main()
