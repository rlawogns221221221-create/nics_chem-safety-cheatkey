#!/usr/bin/env python3
"""이재민 임시주거시설 오픈API → data/tempshelters.js  (인터넷 되는 자리에서)

    python3 build/fetch_tempshelter.py                # 받아서 data/ 에 만들기
    python3 build/fetch_tempshelter.py --peek         # 칸 이름만 보고 끝내기
    python3 build/fetch_tempshelter.py --save-raw 원자료.json

── 왜 파이썬 판이 따로 있나 ─────────────────────────────────
`build/fetch_tempshelter.html` 은 사람이 브라우저에서 한 번 눌러 받는 길입니다.
그런데 **개발 자리에서는 그 서버로 나갈 수 없고**(게이트웨이가 403),
사용자가 휴대전화만 들고 있을 때는 저장소의 HTML 파일을 열 수도 없습니다.

그래서 **깃허브 액션 러너**(인터넷이 되는 자리)에서 돌릴 수 있는 길을
따로 두었습니다 — `.github/workflows/임시주거시설_받기.yml` 이 이 파일을
돌리고, 만들어진 `data/tempshelters.js` 를 저장소에 커밋합니다.

**규칙은 한 곳에만 둡니다.** 칸 짝짓기·지역 이름 맞추기·파일 만들기는
`build/make_tempshelters.py` 의 `만들기()` 를 그대로 부릅니다. 이 파일이 하는
일은 **받아 오는 것과 줄을 찾아내는 것**뿐입니다.

── 두 곳을 다 받습니다 ──────────────────────────────────────
쪽 넘기는 이름과 줄이 담긴 자리가 서로 달라서 주소를 보고 가릅니다.
    safetydata.go.kr : serviceKey · pageNo · numOfRows  → 줄은 body 에
    공공데이터포털   : serviceKey · page   · perPage    → 줄은 data 에

── 칸 이름을 확인하지 못했습니다 ────────────────────────────
그 서버로 나갈 수 없어 한 줄도 못 받아 봤습니다. 영문 약어(FCLT_NM ·
RONA_DADDR · LAT · LOT …)까지 규칙에 넣어 **짐작으로 짝지었고**, 이 스크립트는
**받은 칸 이름과 첫 줄을 로그에 그대로 찍습니다.** 짝이 틀렸으면 그 로그를
보고 `make_tempshelters.py` 의 `RULES` 를 고치면 됩니다.
"""
import argparse
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import make_tempshelters as MT                                  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / "build" / "fetch_tempshelter.html"

기본주소 = "https://www.safetydata.go.kr/V2/api/DSSP-IF-10945"


def fail(msg: str) -> None:
    sys.exit("\n중단: " + msg + "\n")


def html에서_찾기(무엇: str) -> str:
    """인증키·자료 주소를 브라우저용 페이지에서 그대로 가져옵니다.

    두 군데에 따로 적어 두면 한쪽만 고쳤을 때 서로 다른 값으로 받아 옵니다.
    사람이 눌러 쓰는 그 페이지를 정본으로 둡니다."""
    if not HTML.exists():
        return ""
    txt = HTML.read_text(encoding="utf-8")
    m = re.search(r'id="%s"[^>]*value="([^"]+)"' % 무엇, txt)
    return m.group(1).strip() if m else ""


def is_safety(base: str) -> bool:
    return "safetydata.go.kr" in base.lower()


def page_url(base: str, key: str, p: int, per: int) -> str:
    sep = "&" if "?" in base else "?"
    if is_safety(base):
        return (base + sep + "serviceKey=" + urllib.parse.quote(key)
                + "&pageNo=%d&numOfRows=%d&returnType=json" % (p, per))
    return (base + sep + "page=%d&perPage=%d&returnType=JSON&serviceKey=%s"
            % (p, per, urllib.parse.quote(key)))


def rows_of(d):
    """줄이 어디 담겨 오는지 — 기관마다 다릅니다(make_tempshelters 와 같은 규칙)."""
    return MT.rows_of_json(d)


def total_of(d, fallback=0):
    if not isinstance(d, dict):
        return fallback
    body = (d.get("response") or {}).get("body") or {}
    for v in (d.get("totalCount"), d.get("matchCount"), body.get("totalCount")):
        try:
            n = int(str(v))
            if n > 0:
                return n
        except (TypeError, ValueError):
            continue
    return fallback


def head_msg(d):
    """서버가 200 으로 답하면서 몸통에 오류를 담아 보내는 경우가 많습니다
    (인증키 미승인·한도 초과). 그것을 "0건" 으로 넘기면 왜 빈지 알 수 없습니다."""
    if not isinstance(d, dict):
        return ""
    h = d.get("header") or (d.get("response") or {}).get("header") or {}
    code = str(h.get("resultCode", "")).strip()
    msg = str(h.get("resultMsg") or h.get("errorMsg") or "").strip()
    if not code or code in ("00", "0") or re.match(r"^정상|NORMAL", msg, re.I):
        return ""
    return f"{code} {msg}"


def 오류풀이(bad: str) -> str:
    """서버가 준 코드를 **무엇을 하면 되는지**로 바꿔 적습니다.
    "32 UNREGISTERED IP ERROR" 만 보고 무엇을 해야 하는지 아는 사람은 없습니다."""
    if re.search(r"\bUNREGISTERED IP|^32\b", bad, re.I):
        return (
            "      ── 인증키에 **부르는 쪽 IP** 가 등록되어 있지 않습니다 ──────\n"
            "      이 오픈API 는 활용신청 때 적어 둔 IP 에서만 받을 수 있습니다.\n"
            "      1) safetydata.go.kr 로그인 → 마이페이지 → 오픈API 활용신청 현황\n"
            "      2) 이 API 를 열고 **활용 IP(서버 IP)** 에 부를 자리의 IP 를 넣습니다\n"
            "         · 제한 없음으로 둘 수 있으면 그렇게 두어도 됩니다\n"
            "         · 깃허브 액션 러너는 IP 가 매번 달라 등록해 두기 어렵습니다\n"
            "      3) 등록한 그 자리에서 build/fetch_tempshelter.html 을 열거나\n"
            "         이 스크립트를 돌리면 그대로 받아집니다\n"
            "      ── 또는 파일로 받아 넘기는 길 ──────────────────────────\n"
            "      플랫폼 화면에서 목록을 파일로 내려받아\n"
            "        python3 build/make_tempshelters.py 받은것.json\n"
            "      을 돌리면 같은 결과가 됩니다(csv·xlsx 도 됩니다)."
        )
    if re.search(r"SERVICE_?KEY|인증키", bad, re.I):
        return ("      인증키 활용신청이 승인됐는지(신청 직후에는 한 시간쯤 걸립니다),\n"
                "      Decoding 키를 넣었는지 확인하세요.")
    if re.search(r"LIMITED|초과|한도", bad, re.I):
        return "      하루 호출 한도에 걸렸습니다. 내일 다시 받으면 됩니다."
    return "      코드 뜻은 그 플랫폼의 오픈API 안내(오류코드 표)를 보세요."


def get(url: str, 초=25) -> dict:
    req = urllib.request.Request(url, headers={
        "User-Agent": "nics-chem-safety/1.0 (+github actions)",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=초) as r:
        raw = r.read()
    txt = raw.decode("utf-8", "replace")
    try:
        return json.loads(txt)
    except json.JSONDecodeError:
        # XML 로 오는 경우가 있습니다 — returnType 을 안 받는 자료거나 오류쪽입니다
        fail("JSON 이 아닌 것이 왔습니다. 앞부분 500자:\n      " + txt[:500])


def 받기(base: str, key: str, per: int, 최대쪽: int, 쉬기: float) -> list:
    out, page, total = [], 1, 0
    while page <= 최대쪽:
        url = page_url(base, key, page, per)
        보이는주소 = url.replace(key, "***")           # 로그에 인증키를 남기지 않는다
        try:
            d = get(url)
        except urllib.error.HTTPError as e:
            fail(f"서버가 {e.code} 로 답했습니다 — {보이는주소}\n"
                 f"      {e.read()[:300].decode('utf-8', 'replace')}")
        except Exception as e:                          # noqa: BLE001
            fail(f"받지 못했습니다 — {e}\n      {보이는주소}")

        bad = head_msg(d)
        if bad:
            fail("서버가 오류를 돌려주었습니다 — " + bad + "\n" + 오류풀이(bad))

        rows = rows_of(d)
        if page == 1:
            if not rows:
                fail("줄이 담긴 자리를 찾지 못했습니다. 받은 것 앞부분:\n      "
                     + json.dumps(d, ensure_ascii=False)[:600])
            total = total_of(d, 0)
            print(f"  총건수 {total or '알려주지 않음'} · 한 쪽 {per}건")
            칸보기(rows[0])
        out += rows
        print(f"    {page}쪽 — 받은 줄 {len(rows)} (누적 {len(out)})", flush=True)
        if len(rows) < per and not (total and len(out) < total):
            break
        if total and len(out) >= total:
            break
        page += 1
        time.sleep(쉬기)
    return out


def 칸보기(row: dict) -> None:
    """받은 자료의 칸 이름과 첫 줄을 로그에 남깁니다.

    이 자리에서 확인할 수 없었던 것이 바로 이 이름들입니다. 값은 20자까지만
    적습니다 — 공개 저장소의 실행 기록에 자료를 통째로 쌓아 둘 이유가 없습니다."""
    print("\n  ── 받은 자료의 칸 이름 ──────────────────────────")
    for k, v in row.items():
        s = "" if v is None else str(v)
        if len(s) > 20:
            s = s[:20] + "…"
        print(f"    {k:24} = {s}")
    print()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="", help="자료 주소 (기본: build/fetch_tempshelter.html 의 값)")
    ap.add_argument("--key", default="", help="인증키 (기본: 같은 페이지의 값 · 또는 환경변수 TEMPSHELTER_KEY)")
    ap.add_argument("--per", type=int, default=0, help="한 쪽에 몇 줄 (기본: safetydata 100 · 포털 1000)")
    ap.add_argument("--max-pages", type=int, default=400)
    ap.add_argument("--sleep", type=float, default=0.15, help="쪽 사이 쉬는 시간(초)")
    ap.add_argument("--peek", action="store_true", help="한 쪽만 받아 칸 이름만 보고 끝냅니다")
    ap.add_argument("--save-raw", default="", help="받은 것을 이 파일에 그대로 저장")
    args = ap.parse_args()

    import os
    base = args.url or html에서_찾기("url") or 기본주소
    # 두 플랫폼은 인증키가 다릅니다 — 주소를 보고 알맞은 것을 씁니다
    키칸 = "key" if is_safety(base) else "keyOd"
    key = (args.key or os.environ.get("TEMPSHELTER_KEY", "")
           or html에서_찾기(키칸) or html에서_찾기("key"))
    if not key:
        fail("인증키가 없습니다. --key 나 환경변수 TEMPSHELTER_KEY 로 주세요.")
    per = args.per or (100 if is_safety(base) else 1000)

    print(f"\n이재민 임시주거시설 받기\n  주소 {base}\n  인증키 …{key[-4:]} ({len(key)}자)")
    rows = 받기(base, key, per, 1 if args.peek else args.max_pages, args.sleep)
    print(f"  받기 끝 — 모두 {len(rows):,}줄\n")

    if args.save_raw:
        pathlib.Path(args.save_raw).write_text(
            json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        print(f"  원자료를 {args.save_raw} 에 저장했습니다\n")

    if args.peek:
        MT.칸찍기(rows)                    # 짝이 맞는지만 보고 끝냅니다
        print("  --peek 이므로 파일은 만들지 않았습니다.\n")
        return

    출처 = ("행정안전부 이재민 임시주거시설 (재난안전데이터공유플랫폼 safetydata.go.kr)"
            if is_safety(base) else
            "행정안전부 이재민임시주거시설정보 (공공데이터포털)")
    MT.만들기(rows, base, 출처)


if __name__ == "__main__":
    main()
