#!/usr/bin/env python3
"""진입 화면에 쓰는 사진 만들기 — source/photos/ → assets/img/site/

왜 스크립트로 만드는가
────────────────────────────────────────────────────────────────
카드 세 장은 **비율이 정확히 같아야** 줄이 맞습니다(16:9). 사진마다 원본
비율이 달라서(4:3 · 2:1 · 3:2) 브라우저의 `object-fit:cover` 에만 맡기면
어디가 잘릴지 사진마다 달라집니다 — 사람 얼굴이나 사고지점 핀이 잘려
나가기도 합니다. 그래서 **자리마다 어디를 남길지 여기서 정해** 미리 자릅니다.

크기도 여기서 정합니다. **화면에 보이는 크기보다 넉넉하게** 잡아야 합니다 —
요즘 화면은 같은 자리에 화소를 2~3배로 그려서, 보이는 크기에 딱 맞춰 두면
늘어나 뿌옇게 보입니다. 한 번 작게 잡았다가 "사진이 깨진다"는 말을 들었습니다.
반대로 원본보다 크게 적어도 소용이 없습니다 — 없는 화소는 생기지 않습니다.
더 또렷하게 하려면 **더 큰 원본 사진**을 받아야 합니다.

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
# 가로 픽셀은 **화면에 보이는 크기보다 넉넉하게** 잡습니다. 요즘 화면은 같은
# 자리에 화소를 2~3배로 그리기 때문에(고해상도 화면), 보이는 크기에 딱 맞춰
# 두면 늘어나서 뿌옇게 보입니다. 카드 한 칸은 390px 쯤인데 휴대전화에서 3배로
# 그려지므로 1200px 로 둡니다.
#
# anchor 는 "자를 때 원본의 어디를 가운데로 둘까"(0=위/왼쪽, 1=아래/오른쪽).
# 사진마다 남겨야 하는 것이 달라서 자리마다 따로 정했습니다.
# 머리띠 사진 다섯 장은 **5초마다 바뀝니다**(사용자 요청). 그래서
#   ① 비율이 정확히 같아야 하고(3:1) — 다르면 바뀔 때마다 띠 높이가 들썩입니다.
#   ② **줄이지 않습니다.** 머리띠는 화면 폭을 꽉 채우는 자리라 원본보다 조금만
#      작아도 늘어나서 뿌옇게 보입니다(1500px 로 줄였다가 사용자가 "사진이
#      깨진다"고 했습니다 — 그때 실제로 2배 가까이 늘어나고 있었습니다).
#      아래 width 는 원본(1672~2000px)보다 크므로 사실상 자르기만 하고 크기는
#      건드리지 않습니다. 더 또렷하게 하려면 **더 큰 원본 사진이 필요합니다** —
#      여기 숫자만 올려서는 없는 화소가 생기지 않습니다.
#
#      파일이 커지는 것은 감수합니다. 이 사진들은 사용자 확인용 단일 파일
#      (preview/진입화면_한파일.html)에 base64 로 들어가 그 파일이 1MB 남짓
#      커지지만, 진입 화면은 배포물이 아니라 확인용이고 실제 웹서버판은 사진을
#      따로 내려받으므로 첫 화면이 늦어지지 않습니다.
#      (화질 q 를 낮추면서 크기를 키우는 편이 반대보다 낫습니다 — 같은 용량에
#       화소가 많은 쪽이 늘어났을 때 덜 뭉갭니다.)
HERO = dict(ratio=3.0, width=2400, q=76)

CROP = [
    # 머리띠 ①~⑤ — 5초마다 이 차례로 바뀝니다.
    # **비슷한 사진을 나란히 두지 마세요.** 눈높이 파노라마와 수직 항공사진을
    # 번갈아 놓았습니다. 닮은 두 장이 잇달아 나오면 바뀐 줄 모르고 화면이
    # 잘못된 것처럼 보입니다(원본 순서대로 두었더니 실제로 그랬습니다).
    dict(src="hero-1.webp", out="hero-1.jpg", anchor=(0.5, 0.5), **HERO,
         note="산업단지 파노라마 — 증류탑이 가운데"),
    dict(src="hero-2.webp", out="hero-2.jpg", anchor=(0.5, 0.5), **HERO,
         note="공단 수직 항공 — 배관·탱크가 격자로"),
    dict(src="hero-3.webp", out="hero-3.jpg", anchor=(0.5, 0.5), **HERO,
         note="정유단지 항공 — 저장탱크가 줄지어 선 모습"),
    dict(src="hero-4.webp", out="hero-4.jpg", anchor=(0.5, 0.5), **HERO,
         note="수변 공단 수직 항공"),
    dict(src="hero-5.webp", out="hero-5.jpg", anchor=(0.5, 0.52), **HERO,
         note="해안 정유단지 — 부두와 탱크"),
    # 01 대피장소 지도 — 항공사진. 사고지점 핀과 대피소 표시를 모두 남깁니다.
    dict(src="card-map.webp", out="card-map.jpg",
         ratio=16 / 9, width=1200, anchor=(0.5, 0.46), q=80,
         note="가운데 붉은 핀 + 초록 대피소 표시 세 개가 다 들어와야 함"),
    # 02 주민대피 문자 — 손에 든 휴대전화. 화면 글자가 잘리면 안 됩니다.
    dict(src="card-sms.webp", out="card-sms.jpg",
         ratio=16 / 9, width=1200, anchor=(0.5, 0.5), q=80,
         note="문자 화면 전체가 들어와야 함"),
    # 03 방제자원 — 방제지원차량과 대응인력. 둘 다 남깁니다.
    dict(src="card-res.webp", out="card-res.jpg",
         ratio=16 / 9, width=1200, anchor=(0.5, 0.56), q=80,
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
