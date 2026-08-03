#!/usr/bin/env python3
"""시·군·구 행정경계 TopoJSON → data/boundaries.js (지도 배경선)

원자료: 통계청 센서스용 행정구역경계(2018) 기반 TopoJSON
        source/skorea-municipalities-topo.json

※ 이 경계선은 지도에서 위치를 가늠하기 위한 **배경 표시용**입니다.
  행정구역의 법적 경계를 나타내지 않으며, 정식 배포 전에 원내에서
  국가공간정보포털 등의 정본 데이터로 교체하는 것을 권장합니다.

    python3 build/make_boundary.py
"""
import json
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "source" / "skorea-municipalities-topo.json"
OUT = ROOT / "data" / "boundaries.js"

# 통계청 SGIS 시도 코드 앞 2자리 (구 행정표준코드 체계)
SIDO = {
    "11": "서울특별시", "21": "부산광역시", "22": "대구광역시", "23": "인천광역시",
    "24": "광주광역시", "25": "대전광역시", "26": "울산광역시", "29": "세종특별자치시",
    "31": "경기도", "32": "강원특별자치도", "33": "충청북도", "34": "충청남도",
    "35": "전북특별자치도", "36": "전라남도", "37": "경상북도", "38": "경상남도",
    "39": "제주특별자치도",
}

TOL = 0.0022      # 단순화 허용오차(도). 약 240m — 시군구 윤곽 판독에 충분
MIN_PTS = 6       # 이보다 적게 남는 조각(작은 섬)은 버림
SCALE = 10000     # 좌표를 1/10000도(약 11m) 정수로 저장한 뒤 델타 인코딩


def decode_arcs(topo):
    """TopoJSON 델타 인코딩 → 실좌표 arc 목록"""
    tr = topo.get("transform")
    out = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            if tr:
                pts.append((x * tr["scale"][0] + tr["translate"][0],
                            y * tr["scale"][1] + tr["translate"][1]))
            else:
                pts.append((x, y))
        out.append(pts)
    return out


def ring(arc_ids, arcs):
    """arc 인덱스 목록(음수 = 역방향) → 좌표 링"""
    pts = []
    for i in arc_ids:
        seg = arcs[~i][::-1] if i < 0 else arcs[i]
        pts.extend(seg[1:] if pts else seg)
    return pts


def simplify(pts, tol):
    """Douglas-Peucker (반복 구현 — 재귀 깊이 제한 회피)"""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        s, e = stack.pop()
        if e <= s + 1:
            continue
        ax, ay = pts[s]
        bx, by = pts[e]
        dx, dy = bx - ax, by - ay
        den = math.hypot(dx, dy)
        far, fd = -1, tol
        for i in range(s + 1, e):
            px, py = pts[i]
            d = (abs(dy * px - dx * py + bx * ay - by * ax) / den) if den else math.hypot(px - ax, py - ay)
            if d > fd:
                far, fd = i, d
        if far > 0:
            keep[far] = True
            stack.append((s, far))
            stack.append((far, e))
    return [p for p, k in zip(pts, keep) if k]


def encode(pts):
    """좌표 링 → 델타 인코딩 정수 배열 [x0, y0, dx1, dy1, ...]
    중첩 실수 배열보다 JSON 크기가 절반 수준이다."""
    out, px, py = [], 0, 0
    for i, (x, y) in enumerate(pts):
        ix, iy = round(x * SCALE), round(y * SCALE)
        if i == 0:
            out += [ix, iy]
        else:
            if ix == px and iy == py:
                continue                      # 같은 점 반복 제거
            out += [ix - px, iy - py]
        px, py = ix, iy
    return out


def main():
    if not SRC.exists():
        sys.exit(f"원자료를 찾을 수 없습니다: {SRC}")
    topo = json.loads(SRC.read_text(encoding="utf-8"))
    arcs = decode_arcs(topo)
    obj = next(iter(topo["objects"].values()))

    feats, pts_before, pts_after = [], 0, 0
    for g in obj["geometries"]:
        p = g.get("properties", {})
        code = str(p.get("code", ""))
        name = p.get("name", "")
        sido = SIDO.get(code[:2], "")

        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        rings = []
        for poly in polys:
            for r in poly:                       # 외곽 + 구멍 전부 선으로만 그림
                raw = ring(r, arcs)
                pts_before += len(raw)
                s = simplify(raw, TOL)
                if len(s) >= MIN_PTS:
                    pts_after += len(s)
                    rings.append(encode(s))
        if rings:
            feats.append({"s": sido, "n": name, "r": rings})

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* 시·군·구 행정경계 — 지도 배경 표시용\n")
        f.write("   원자료: 통계청 센서스용 행정구역경계(2018) 기반 TopoJSON\n")
        f.write(f"   단순화 허용오차 약 {int(TOL * 111000)}m\n")
        f.write("   ※ 위치를 가늠하기 위한 배경선이며 법적 행정경계가 아닙니다.\n")
        f.write("     정식 배포 전 원내 정본 데이터로 교체를 권장합니다.\n")
        f.write(f"   구조: BOUNDARIES = [{{s:시도, n:시군구, r:[링, ...]}}, ...]\n")
        f.write(f"         링 = [x0, y0, dx1, dy1, ...] 델타 인코딩 정수. 실좌표 = 누적합 / {SCALE}\n")
        f.write(f"   BOUNDARY_SCALE = {SCALE} */\n")
        f.write(f"var BOUNDARY_SCALE = {SCALE};\n")
        f.write("var BOUNDARIES = "
                + json.dumps(feats, ensure_ascii=False, separators=(",", ":")) + ";\n")

    kb = OUT.stat().st_size / 1024
    print(f"{OUT.name}  {len(feats)}개 시군구 · 점 {pts_before:,} → {pts_after:,} · {kb:.0f} KB")
    return feats


if __name__ == "__main__":
    main()
