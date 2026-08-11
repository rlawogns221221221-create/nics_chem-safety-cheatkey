#!/usr/bin/env python3
"""주소 → 좌표를 인터넷 없이 최대한 좁혀 잡습니다.

── 왜 이런 것이 필요한가 ────────────────────────────────────────
방제자원 원자료(지자체 보유 방재장비 등)에는 주소만 있고 좌표가 없습니다.
좌표를 얻으려면 주소검색 서비스(브이월드 등)를 불러야 하는데, 자료를 만드는
이 자리에서는 그 서버에 닿지 않습니다. 그렇다고 좌표 없이 두면 지도에
찍을 수 없으므로, **가진 자료만으로 낼 수 있는 가장 좁은 범위**를 씁니다.

    1. 도로명   같은 시·군·구 안에 같은 도로명을 쓰는 대피장소가 있으면
                그 좌표 (오차 수백 m)                      → 정확도 "road"
    2. 읍·면·동 같은 읍·면·동에 있는 대피장소들의 평균 좌표
                (오차 1~3km)                               → 정확도 "emd"
    3. 시·군·구 행정경계 안쪽의 대표점 (오차 시·군 크기)   → 정확도 "sgg"

정확도는 자료에 그대로 실어 화면에서 구분해 표시합니다. 어림값을 정확한
좌표처럼 보이게 하면, 담당자가 "여기서 5km"라고 믿고 판단하게 됩니다.

── 더 정확하게 만들려면 ────────────────────────────────────────
인터넷이 되는 PC에서 build/geocode.html 을 열면 주소검색으로 전부 정확한
좌표를 받아 data/resources.geo.js 를 만들어 줍니다. 그 파일이 있으면
화면이 그쪽 좌표를 먼저 씁니다(정확도 "exact").
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent


def _load(name, var):
    txt = (ROOT / "data" / name).read_text(encoding="utf-8")
    m = re.search(r"var %s = (\[.*?\]|\{.*?\});" % var, txt, re.S)
    if not m:
        raise SystemExit(f"{name} 에서 {var} 를 찾지 못했습니다")
    return json.loads(m.group(1))


def _scale():
    txt = (ROOT / "data" / "boundaries.js").read_text(encoding="utf-8")
    return int(re.search(r"var BOUNDARY_SCALE = (\d+)", txt).group(1))


def _rings(feat, scale):
    """델타 인코딩을 풀어 [(경도, 위도), ...] 고리 목록으로."""
    out = []
    for ring in feat["r"]:
        pts, x, y = [], 0, 0
        for i in range(0, len(ring), 2):
            if i == 0:
                x, y = ring[0], ring[1]
            else:
                x += ring[i]
                y += ring[i + 1]
            pts.append((x / scale, y / scale))
        out.append(pts)
    return out


def _inside(pts, x, y):
    inside = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def _rep_point(pts):
    """고리 안쪽의 대표점.

    무게중심은 'ㄷ' 자 모양(예: 여수시)에서 바다 위로 나가 버립니다. 그래서
    무게중심이 안쪽이면 그대로 쓰고, 밖이면 격자를 훑어 경계에서 가장 먼
    안쪽 점을 고릅니다 — 눈으로 봤을 때 "이 시·군 한가운데"로 읽히는 자리."""
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    if _inside(pts, cx, cy):
        return cx, cy

    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    best, bestd = (cx, cy), -1.0
    N = 24
    for i in range(1, N):
        for j in range(1, N):
            x = x0 + (x1 - x0) * i / N
            y = y0 + (y1 - y0) * j / N
            if not _inside(pts, x, y):
                continue
            d = min((x - px) ** 2 + (y - py) ** 2 for px, py in pts)
            if d > bestd:
                bestd, best = d, (x, y)
    return best


def sgg_points():
    """{(시도, 시군구): (위도, 경도)} — 행정경계 안쪽 대표점.

    이름이 딱 맞지 않는 경우를 두 가지 더 받아 줍니다.
      · 구가 있는 시 — 경계자료는 "포항시남구"·"포항시북구"로 나뉘어 있는데
        원자료는 "포항시"라고만 적습니다. 그런 시는 구들의 가운데를 씁니다.
      · 관할이 바뀐 군 — 경계자료(2018년)의 시·도와 지금 시·도가 다릅니다
        (예: 군위군 경상북도 → 대구광역시). 이름만으로도 찾게 둡니다.
    """
    scale = _scale()
    out, by_name, prefix = {}, {}, {}
    for f in _load("boundaries.js", "BOUNDARIES"):
        big = max(_rings(f, scale), key=len)      # 섬이 딸린 시·군은 본토 고리
        x, y = _rep_point(big)
        pt = (round(y, 5), round(x, 5))
        out[(f["s"], f["n"])] = pt
        by_name.setdefault(f["n"], []).append(pt)
        m = re.match(r"(.+시)[가-힣]+구$", f["n"])
        if m:
            prefix.setdefault((f["s"], m.group(1)), []).append(pt)

    for key, pts in prefix.items():
        out.setdefault(key, (round(sum(p[0] for p in pts) / len(pts), 5),
                             round(sum(p[1] for p in pts) / len(pts), 5)))
    for name, pts in by_name.items():
        if len(pts) == 1:
            out.setdefault(("", name), pts[0])    # 시·도가 달라졌을 때의 대비

    # 경계자료를 뜬 뒤 이름이 바뀐 곳
    for sido, now, before in RENAMED:
        if (sido, before) in out:
            out.setdefault((sido, now), out[(sido, before)])
    return out


RENAMED = [
    ("인천광역시", "미추홀구", "남구"),          # 2018.7 개칭
]


ROAD = re.compile(r"[가-힣A-Za-z0-9]+(?:대로|로|길)")
EMD = re.compile(r"[가-힣0-9]{1,10}(?:읍|면|동|리)")


def _keys(addr):
    a = re.sub(r"\(.*?\)", " ", str(addr or ""))
    b = str(addr or "")
    return set(ROAD.findall(a)), set(EMD.findall(b))


def shelter_index():
    """대피장소 주소를 도로명·읍면동 색인으로. 값은 좌표 목록."""
    road, emd = {}, {}
    for sd, sgs in _load("shelters.js", "SHELTERS").items():
        for sg, rows in sgs.items():
            for r in rows:
                if r[5] is None or r[6] is None:
                    continue
                rs, es = _keys(r[2])
                for k in rs:
                    road.setdefault((sd, sg, k), []).append((r[5], r[6]))
                for k in es:
                    emd.setdefault((sd, sg, k), []).append((r[5], r[6]))
    return road, emd


SGG_IN_ADDR = re.compile(
    r"([가-힣]{2,10}(?:시|군))\s*([가-힣]{2,6}구)?|([가-힣]{2,6}구)")


class Anchor:
    """주소를 좌표로. 못 찾으면 (None, None, '')."""

    def __init__(self):
        self.sgg = sgg_points()
        self.road, self.emd = shelter_index()
        self.sido = self._sido_points()
        # 띄어쓰기·괄호를 지운 이름으로도 찾게 (원자료마다 표기가 다르다)
        self.loose = {}
        for (sd, sg), pt in self.sgg.items():
            self.loose.setdefault((sd, self._tight(sg)), pt)
        self.stat = {"road": 0, "emd": 0, "sgg": 0, "sido": 0, "none": 0}

    @staticmethod
    def _tight(s):
        return re.sub(r"[\s()（）]|\(.*?\)", "", str(s or ""))

    def _sido_points(self):
        """시·도 대표점 — 그 시·도 시·군·구 대표점들의 가운데.
        도청·시청 본청 부서처럼 시·군·구가 없는 자료에 씁니다."""
        by = {}
        for (sd, _), pt in self.sgg.items():
            if sd:
                by.setdefault(sd, []).append(pt)
        return {sd: (round(sum(p[0] for p in v) / len(v), 5),
                     round(sum(p[1] for p in v) / len(v), 5))
                for sd, v in by.items()}

    def _avg(self, pts):
        return (round(sum(p[0] for p in pts) / len(pts), 5),
                round(sum(p[1] for p in pts) / len(pts), 5))

    def _sgg_pt(self, sido, sgg):
        if not sgg:
            return None
        t = self._tight(sgg)
        return (self.sgg.get((sido, sgg)) or self.loose.get((sido, t))
                or self.sgg.get(("", sgg)) or self.loose.get(("", t)))

    def _from_addr(self, sido, addr):
        """주소 안에서 시·군·구 이름을 찾아 본다.

        원자료의 시·군·구 칸은 믿기 어렵습니다 — 시·도 이름이 그대로 들어
        있거나('충청남도/충청남도'), 기관 이름이 들어 있거나('안동시시설관리
        공단'), 비어 있습니다. 주소는 모든 줄에 제대로 적혀 있으므로 거기서
        다시 찾습니다. """
        a = re.sub(r"^\s*[가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도)\s*", "",
                   str(addr or ""))
        m = re.match(r"\s*([가-힣]{2,10}(?:시|군))\s+([가-힣]{2,6}구)\b", a)
        if m:
            hit = self._sgg_pt(sido, m.group(1) + m.group(2))
            if hit:
                return hit, m.group(1) + " " + m.group(2)
        m = re.match(r"\s*([가-힣]{2,10}(?:시|군|구))\b", a)
        if m:
            hit = self._sgg_pt(sido, m.group(1))
            if hit:
                return hit, m.group(1)
        return None, ""

    def find(self, sido, sgg, addr):
        """(위도, 경도, 정확도). 정확도가 낮을수록 넓은 범위를 뜻합니다."""
        # 시·군·구를 확정한다 — 칸에 있는 값 → 주소에서 뽑은 값 순
        key = sgg if self._sgg_pt(sido, sgg) else ""
        if not key:
            _, key = self._from_addr(sido, addr)

        rs, es = _keys(addr)
        if key:
            for k in sorted(rs, key=len, reverse=True):
                hit = self.road.get((sido, key, k))
                if hit:
                    self.stat["road"] += 1
                    la, lo = self._avg(hit)
                    return la, lo, "road"
            for k in sorted(es, key=len, reverse=True):
                hit = self.emd.get((sido, key, k))
                if hit:
                    self.stat["emd"] += 1
                    la, lo = self._avg(hit)
                    return la, lo, "emd"
            hit = self._sgg_pt(sido, key)
            if hit:
                self.stat["sgg"] += 1
                return hit[0], hit[1], "sgg"

        hit = self.sido.get(sido)
        if hit:
            self.stat["sido"] += 1
            return hit[0], hit[1], "sido"
        self.stat["none"] += 1
        return None, None, ""

    def sgg_name(self, sido, sgg, addr):
        """자료에 실을 시·군·구 이름 — 칸이 엉뚱하면 주소에서 뽑은 것으로."""
        if self._sgg_pt(sido, sgg) and sgg != sido:
            return sgg
        _, k = self._from_addr(sido, addr)
        return k


if __name__ == "__main__":
    a = Anchor()
    print("시·군·구 대표점", len(a.sgg), "곳")
    for k in [("경상북도", "김천시"), ("전라남도", "여수시"), ("서울특별시", "중구")]:
        print("  ", k, a.sgg.get(k))
