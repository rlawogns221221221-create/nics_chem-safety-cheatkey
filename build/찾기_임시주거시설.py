#!/usr/bin/env python3
"""이재민 임시주거시설 **시설 목록**을 주는 오픈API 를 찾습니다.

    python3 build/찾기_임시주거시설.py            (인터넷 되는 자리에서)

── 왜 이런 것이 필요한가 ────────────────────────────────────
지금까지 받아 본 자료는 **시·도별 집계표**였습니다 — 개소·면적·수용능력만
있어서 지도에 점을 찍을 수 없습니다. 필요한 것은 **시설 하나하나가 한 줄인
목록**(시설명·주소·위도·경도)입니다.

개발 자리에서는 `www.data.go.kr` · `api.odcloud.kr` · `www.safetydata.go.kr`
모두 막혀 있어(게이트웨이 403) 어떤 자료가 목록인지 확인할 수 없습니다.
그래서 이 스크립트를 **깃허브 액션 러너**에서 돌려, 후보 자료들의
**칸 이름을 로그에 찍어** 봅니다. 사람이 판단할 수 있게 하는 것이 목적이고,
자료 파일은 만들지 않습니다.

── 찾는 방법 ───────────────────────────────────────────────
1. 후보 자료의 소개 페이지를 받아 `uddi:…` 를 뽑습니다(표준데이터·파일데이터의
   오픈API 주소가 그 꼴입니다).
2. 뽑은 주소를 인증키로 한 쪽(10줄)만 불러 **칸 이름**을 찍습니다.
3. 시설명·위도·경도가 다 있으면 "목록", 개소·수용능력만 있으면 "집계표"로
   적습니다 — 판단 근거를 그대로 남깁니다.

찾은 주소는 `build/fetch_tempshelter.py --url <주소>` 로 그대로 받으면 됩니다.
"""
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import fetch_tempshelter as FT                                  # noqa: E402
import make_tempshelters as MT                                  # noqa: E402

# 후보 — 이름만 보고 고른 것이 아니라, 검색으로 확인한 **전국·시설 단위**
# 후보들입니다. 무엇이 목록인지는 칸 이름을 봐야 압니다.
후보 = [
    ("15072622", "전국지진겸용임시주거시설표준데이터",
     "https://www.data.go.kr/data/15072622/standard.do"),
    ("15077956", "행정안전부_통계연보_이재민 임시주거시설 지정 (집계표로 의심)",
     "https://www.data.go.kr/data/15077956/openapi.do"),
    ("15124965", "예전에 쓰던 자료 (집계표로 확인됨 · 대조용)",
     "https://www.data.go.kr/data/15124965/openapi.do"),
]


# ⚠ 2026-09-07 깃허브 액션에서 돌려 본 결과 — `www.data.go.kr` 은 러너에서
#   **아예 시간초과**였습니다(세 후보 모두). 러너가 미국(Azure)에 있어 막히는
#   것으로 보입니다(그날 러너 IP 172.215.210.49). `safetydata.go.kr` 은 닿지만
#   인증키가 IP 제한이라 `32 UNREGISTERED IP ERROR` 였습니다.
#   → **국내 IP 에서 한 번 받는 것**이 유일한 길입니다. docs/임시주거시설_받는법.md
#   그래서 기다리는 시간을 짧게 둡니다 — 어차피 안 될 때 오래 붙잡을 이유가 없습니다.
def 받기(url: str, 초=12) -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": ("Mozilla/5.0 (compatible; nics-chem-safety/1.0; "
                       "+github actions)"),
        "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko,en;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=초) as r:
        return r.read().decode("utf-8", "replace")


def uddi찾기(html: str) -> list:
    """소개 페이지에서 오픈API 주소를 뽑습니다."""
    out = []
    for m in re.finditer(r"uddi:[0-9a-fA-F-]{8,}", html):
        if m.group(0) not in out:
            out.append(m.group(0))
    for m in re.finditer(r"https?://api\.odcloud\.kr/api/[^\s\"'<>]+", html):
        u = m.group(0)
        if u not in out:
            out.append(u)
    return out


def 칸판정(rows: list) -> str:
    """목록인가 집계표인가 — 칸 이름으로 가릅니다."""
    if not rows:
        return "빈 응답"
    cols = [c for c in rows[0].keys() if c]
    mapping = MT.map_cols(cols)
    있음 = [k for k in ("시설명", "위도", "경도") if mapping.get(k)]
    집계낌새 = [c for c in cols if re.search(r"개소|수용능력|합계|지역별", str(c))]
    print("      칸:", ", ".join(str(c) for c in cols))
    print("      짝지어진 것:", ", ".join(f"{k}←{v}" for k, v in mapping.items()) or "없음")
    if len(있음) == 3:
        return "★ 시설 목록으로 보입니다 (시설명·위도·경도 다 있음)"
    if 집계낌새:
        return "집계표로 보입니다 (" + ", ".join(집계낌새[:4]) + ")"
    return "판단 못 함 — 위 칸 이름을 보고 사람이 정해야 합니다"


def 한번_불러보기(base: str, key: str) -> None:
    url = FT.page_url(base, key, 1, 10)
    보이는주소 = url.replace(key, "***")
    print(f"    불러 봄 — {보이는주소}")
    try:
        d = FT.get(url)
    except urllib.error.HTTPError as e:
        print(f"      HTTP {e.code} — {e.read()[:200].decode('utf-8', 'replace')}")
        return
    except Exception as e:                                      # noqa: BLE001
        print(f"      못 받음 — {e}")
        return
    bad = FT.head_msg(d)
    if bad:
        print(f"      서버 오류 — {bad}")
        print(FT.오류풀이(bad))
        return
    rows = FT.rows_of(d)
    print(f"      받은 줄 {len(rows)} · 총건수 {FT.total_of(d, 0) or '알려주지 않음'}")
    print("      →", 칸판정(rows))


def main() -> None:
    키 = FT.html에서_찾기("keyOd") or FT.html에서_찾기("key")
    print("\n이재민 임시주거시설 — 어떤 오픈API 가 '시설 목록' 인지 찾아봅니다")
    print(f"  공공데이터포털 인증키 …{키[-4:]} ({len(키)}자)\n")

    for pk, 이름, 페이지 in 후보:
        print(f"── {pk} {이름}")
        try:
            html = 받기(페이지)
        except Exception as e:                                  # noqa: BLE001
            print(f"    소개 페이지를 못 받았습니다 — {e}\n")
            continue
        주소들 = uddi찾기(html)
        if not 주소들:
            print("    페이지에서 오픈API 주소(uddi)를 못 찾았습니다"
                  " — 로그인해야 보이는 자료일 수 있습니다\n")
            continue
        for u in 주소들[:3]:
            base = u if u.startswith("http") else f"https://api.odcloud.kr/api/{pk}/v1/{u}"
            한번_불러보기(base, 키)
        print()

    print("찾은 주소로 받으려면:")
    print("  python3 build/fetch_tempshelter.py --url <주소>\n")


if __name__ == "__main__":
    main()
