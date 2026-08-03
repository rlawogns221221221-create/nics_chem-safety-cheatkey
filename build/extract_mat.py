"""화학사고 현장대응 물질정보(hwpx) → 물질별 구조화 JSON."""
import json
import re
import sys

import hwpx

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else "materials_raw.json"


def cell(t, r, c):
    return hwpx.blocks_to_text(t["cells"].get((r, c), []))


def row_texts(t, r):
    return [cell(t, r, c) for c in range(t["cols"])]


def all_text(t):
    out = []
    for r in range(t["rows"]):
        for c in range(t["cols"]):
            v = cell(t, r, c)
            if v:
                out.append(v)
    return "\n".join(out)


# 1) 최상위 표를 순서대로 모으고, 표제표(CAS No 포함)를 기준으로 물질별로 자른다
tables = [v for kind, v in hwpx.iter_top_blocks(SRC) if kind == "tbl"]
print(f"표 {len(tables)}개")

groups, cur = [], None
for t in tables:
    head = cell(t, 0, 0)
    if re.search(r"CAS\s*No\s*[:：]", head) and "\n" in head:
        if cur:
            groups.append(cur)
        cur = [t]
    elif cur is not None:
        cur.append(t)
groups.append(cur)
print(f"물질 블록 {len(groups)}개")


def find(group, *keys):
    """제목 셀([0,0])에 keys 중 하나가 들어간 표를 반환"""
    for t in group:
        h = cell(t, 0, 0)
        for k in keys:
            if k in h:
                return t
    return None


def bullets(s):
    """• 로 시작하는 항목들을 리스트로"""
    items = re.split(r"\n?\s*[•◎]\s*", s)
    return [re.sub(r"\s+", " ", x).strip(" \n·") for x in items if x.strip()]


def quad(t):
    """흡입/피부/눈/삼켰을 때 2x2 배치 표 → dict"""
    labels = {"흡입": None, "피부": None, "눈": None, "삼": None}
    out = {}
    grid = [[cell(t, r, c) for c in range(t["cols"])] for r in range(t["rows"])]
    for r, row in enumerate(grid):
        for c, v in enumerate(row):
            if not v:
                continue
            key = None
            if v.startswith("흡입"):
                key = "흡입"
            elif v.startswith("피부"):
                key = "피부"
            elif v.startswith("눈"):
                key = "눈"
            elif v.startswith("삼"):
                key = "섭취"
            if key:
                for rr in range(r + 1, min(r + 4, t["rows"])):
                    val = grid[rr][c]
                    if val and not re.match(r"^(흡입|피부|눈|삼)", val):
                        out[key] = re.sub(r"\s+", " ", val.lstrip("•· ")).strip()
                        break
    return out


mats = []
for g in groups:
    if not g:
        continue
    head = g[0]
    title = cell(head, 0, 0)
    m = re.match(r"(.+?)\s*[\(（]([^)）]*)[\)）]?\s*\n\s*CAS\s*No\s*[:：]\s*(.*)", title)
    if m:
        ko, en, cas = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
    else:
        first = title.split("\n")[0]
        ko, en = first.strip(), ""
        cas = (re.search(r"CAS\s*No\s*[:：]\s*(.*)", title) or re.match("", "")).group(1).strip() \
            if re.search(r"CAS\s*No\s*[:：]", title) else ""

    d = {"물질명": ko, "영문명": en, "cas": cas}

    ht = all_text(head)
    if (mm := re.search(r"국문유사명\s*[:：]\s*([^\n]*)", ht)):
        d["유사명"] = [x.strip() for x in re.split(r"[,，]", mm.group(1).replace("···", "")) if x.strip()]
    if (mm := re.search(r"ERG No\s*\n(.*?)(?=\nUN No|\Z)", ht, re.S)):
        d["erg"] = bullets(mm.group(1))
    if (mm := re.search(r"UN No\s*\n(.*)", ht, re.S)):
        d["un"] = bullets(mm.group(1))

    # 물질 기본정보
    if (t := find(g, "물질 기본정보")):
        rows = [" | ".join(x for x in row_texts(t, r) if x) for r in range(t["rows"])]
        body = "\n".join(rows)
        raw성상 = bullets(rows[1] if len(rows) > 1 else "")
        d["성상"] = [x for x in raw성상 if x]
        # 원문 형식이 "• <냄새> / <외관>" 인 경우가 많아 분리해 둔다 (주민 인지 단서)
        if raw성상 and " / " in raw성상[0]:
            a, b = raw성상[0].split(" / ", 1)
            a, b = a.strip(), b.strip()
            if a and a != "-":
                d["냄새"] = a
            if b:
                d["외관"] = b
        elif raw성상:
            d["외관"] = raw성상[0]
        flat = re.sub(r"\s*\n\s*", " ", body)
        if (mm := re.search(r"(?:비중|밀도)\s*[:：]?\s*(.+?)\s*/\s*증기밀도\s*[:：]?\s*([^|]+?)(?:\s*•|$)", flat)):
            d["비중"], d["증기밀도"] = mm.group(1).strip(), mm.group(2).strip()
        if (mm := re.search(r"인화점\s*[:：]\s*(.+?)\s*/\s*발화점\s*[:：]\s*(.+?)(?:\s*•\s*폭발한계|$)", flat)):
            d["인화점"], d["발화점"] = mm.group(1).strip(), mm.group(2).strip()
        if (mm := re.search(r"폭발한계\(하한/상한\)\s*[:：]\s*([^\n|]*)", body)):
            d["폭발한계"] = mm.group(1).strip()
        if (mm := re.search(r"화재 및 폭발 가능성\s*\n?\s*[:：]?\s*([^\n|]*)", body)):
            d["화재폭발"] = mm.group(1).strip()
        gi = body.find("그림문자")
        if gi >= 0:
            d["ghs"] = [x for x in bullets(body[gi + 4:]) if x and "그림문자" not in x]

    # NFPA
    if (t := find(g, "NFPA")):
        nf = {}
        for line in all_text(t).split("\n"):
            if (mm := re.match(r"(화재|건강|반응)(\d)\s*[:：]?\s*(.*)", line.strip())):
                nf[mm.group(1)] = int(mm.group(2))
            elif (mm := re.match(r"특수\s*[:：]\s*(.*)", line.strip())):
                nf["특수"] = mm.group(1).strip()
        if nf:
            d["nfpa"] = nf

    # 대응 방법 (거리 정보 포함)
    if (t := find(g, "대응 방법", "대응방법")):
        txt = all_text(t)
        d["대응"] = [re.sub(r"\s*\n\s*", " ", x).strip()
                     for x in re.split(r"\n(?=◎)", txt) if x.strip() and "대응 방법" not in x[:12]]
        for label, pat in [
            ("화재대피거리", r"화재동반 운송사고 대피거리[^:：]*[:：]\s*([^\n◎]*)"),
            ("초기이격거리", r"유출 시 초기이격거리[^:：]*[:：]\s*([^\n◎]*)"),
        ]:
            if (mm := re.search(pat, txt)):
                d[label] = re.sub(r"\s+", " ", mm.group(1)).strip()
        if (mm := re.search(r"방호활동거리\)?\s*(.*?)(?=\n◎|\Z)", txt, re.S)):
            d["방호활동거리"] = re.sub(r"\s*\n\s*", " ", mm.group(1)).strip(" •\n")

    if (t := find(g, "인체노출")):
        d["증상"] = quad(t)
    if (t := find(g, "응급조치")):
        d["응급"] = quad(t)

    mats.append(d)

json.dump(mats, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# 커버리지 점검
n = len(mats)
print(f"\n추출 {n}종")
for k in ["물질명", "cas", "성상", "냄새", "외관", "비중", "증기밀도", "화재폭발", "nfpa", "대응",
          "초기이격거리", "화재대피거리", "방호활동거리", "증상", "응급", "erg", "un", "ghs"]:
    c = sum(1 for m in mats if m.get(k))
    print(f"  {k:12s} {c:4d}/{n}  ({c*100//n}%)")
