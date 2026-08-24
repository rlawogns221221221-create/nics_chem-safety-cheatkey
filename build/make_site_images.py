#!/usr/bin/env python3
"""진입 화면에 쓰는 사진 만들기 — source/photos/ → assets/img/site/

왜 스크립트로 만드는가
────────────────────────────────────────────────────────────────
카드 세 장은 **비율이 정확히 같아야** 줄이 맞습니다(16:9). 사진마다 원본
비율이 달라서(4:3 · 2:1 · 3:2) 브라우저의 `object-fit:cover` 에만 맡기면
어디가 잘릴지 사진마다 달라집니다 — 사람 얼굴이나 사고지점 핀이 잘려
나가기도 합니다. 그래서 **자리마다 어디를 남길지 여기서 정해** 미리 자릅니다.

크기도 여기서 줄입니다. 원본 그대로 두면 망분리 PC용 단일 파일(사진을
base64 로 파일 안에 넣습니다)이 너무 커집니다.

사진을 새로 받으면
────────────────────────────────────────────────────────────────
`source/photos/` 에 같은 이름으로 넣고 이 스크립트를 다시 돌리세요.
비율이 달라도 됩니다 — 아래 `CROP` 의 `anchor` 만 손보면 됩니다.
그다음 `python3 build/build_single.py` 로 단일 파일도 다시 만드세요.

    python3 build/make_site_images.py
"""
import pathlib
import sys

try:
    from PIL import Image
except ImportError:                                   # pragma: no cover
    sys.exit("Pillow 가 필요합니다 —  pip install pillow")

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "source" / "photos"
OUT = ROOT / "assets" / "img" / "site"

# 자리마다: 원본 파일 · 내보낼 이름 · 목표 비율 · 가로 픽셀 · 남길 자리
#
# anchor 는 "자를 때 원본의 어디를 가운데로 둘까"(0=위/왼쪽, 1=아래/오른쪽).
# 사진마다 남겨야 하는 것이 달라서 자리마다 따로 정했습니다.
CROP = [
    # 머리띠 — 산업단지 파노라마. 왼쪽 하늘은 제목이 앉는 자리라 살려 둡니다.
    dict(src="hero-plant.webp", out="hero-plant.jpg",
         ratio=3.0, width=1800, anchor=(0.5, 0.5), q=78,
         note="증류탑이 가운데, 왼쪽은 제목이 앉을 옅은 하늘"),
    # 01 대피장소 지도 — 항공사진. 사고지점 핀과 대피소 표시를 모두 남깁니다.
    dict(src="card-map.webp", out="card-map.jpg",
         ratio=16 / 9, width=880, anchor=(0.5, 0.46), q=80,
         note="가운데 붉은 핀 + 초록 대피소 표시 세 개가 다 들어와야 함"),
    # 02 주민대피 문자 — 손에 든 휴대전화. 화면 글자가 잘리면 안 됩니다.
    dict(src="card-sms.webp", out="card-sms.jpg",
         ratio=16 / 9, width=880, anchor=(0.5, 0.5), q=80,
         note="문자 화면 전체가 들어와야 함"),
    # 03 방제자원 — 방제지원차량과 대응인력. 둘 다 남깁니다.
    dict(src="card-res.webp", out="card-res.jpg",
         ratio=16 / 9, width=880, anchor=(0.5, 0.56), q=80,
         note="차량 + 노란 보호복 인력이 함께 보여야 함"),
]


def crop_ratio(im: Image.Image, ratio: float, anchor):
    """가운데가 아니라 anchor 를 기준으로 목표 비율만큼 자릅니다."""
    w, h = im.size
    if w / h > ratio:                       # 원본이 더 넓다 → 좌우를 자른다
        nw, nh = int(round(h * ratio)), h
    else:                                   # 원본이 더 높다 → 위아래를 자른다
        nw, nh = w, int(round(w / ratio))
    x = int(round((w - nw) * anchor[0]))
    y = int(round((h - nh) * anchor[1]))
    return im.crop((x, y, x + nw, y + nh))


def main():
    if not SRC.is_dir():
        sys.exit(f"원본 사진 폴더가 없습니다: {SRC}")
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for job in CROP:
        p = SRC / job["src"]
        if not p.exists():
            sys.exit(f"원본이 없습니다: {p}")
        im = Image.open(p).convert("RGB")
        before = im.size
        im = crop_ratio(im, job["ratio"], job["anchor"])
        if im.size[0] > job["width"]:
            im = im.resize((job["width"], int(round(job["width"] / job["ratio"]))),
                           Image.LANCZOS)
        dst = OUT / job["out"]
        # progressive: 느린 회선에서 위에서부터 서서히 또렷해집니다
        im.save(dst, "JPEG", quality=job["q"], optimize=True, progressive=True)
        kb = dst.stat().st_size / 1024
        total += kb
        print(f"  {job['out']:<16} {before[0]}×{before[1]} → {im.size[0]}×{im.size[1]}"
              f"  {kb:6.0f} KB   {job['note']}")
    print(f"\n  합계 {total:.0f} KB → {OUT.relative_to(ROOT)}/")
    print("  ※ 화면을 고쳤으면 python3 build/build_single.py 도 다시 돌리세요.")


if __name__ == "__main__":
    main()
