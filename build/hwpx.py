"""HWPX(section0.xml) → 구조 보존 텍스트 추출.

표는 셀 주소(row,col)를 유지한 채 뽑아야 물질정보의 항목-값 대응이 깨지지 않는다.
중첩 표(셀 안의 표)도 재귀 처리한다.
"""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

HP = "{http://www.hancom.co.kr/hwpml/2011/paragraph}"


def para_text(p):
    """<hp:p> 하나의 텍스트. 하위 표는 제외(별도로 처리)."""
    out = []
    for run in p.findall(HP + "run"):
        for node in run:
            tag = node.tag
            if tag == HP + "t":
                out.append("".join(node.itertext()))
            elif tag == HP + "tbl":
                out.append(" TBL ")          # 표 자리표시
            elif tag in (HP + "lineBreak", HP + "br"):
                out.append("\n")
    return "".join(out)


def sublist_blocks(sub):
    """<hp:subList> 또는 셀 안의 문단·표를 순서대로 반환."""
    blocks = []
    for p in sub.findall(HP + "p"):
        txt = para_text(p)
        tbls = [n for run in p.findall(HP + "run") for n in run if n.tag == HP + "tbl"]
        if " TBL " in txt:
            parts = txt.split(" TBL ")
            for i, part in enumerate(parts):
                if part.strip():
                    blocks.append(("p", part.strip()))
                if i < len(tbls):
                    blocks.append(("tbl", parse_table(tbls[i])))
        elif txt.strip():
            blocks.append(("p", txt.strip()))
    return blocks


def parse_table(tbl):
    """표 → {rows: n, cols: n, cells: {(r,c): [blocks]}, span: {(r,c):(rs,cs)}}"""
    cells, span = {}, {}
    for tr in tbl.findall(HP + "tr"):
        for tc in tr.findall(HP + "tc"):
            addr = tc.find(HP + "cellAddr")
            if addr is None:
                continue
            r, c = int(addr.get("rowAddr")), int(addr.get("colAddr"))
            sp = tc.find(HP + "cellSpan")
            if sp is not None:
                span[(r, c)] = (int(sp.get("rowSpan", 1)), int(sp.get("colSpan", 1)))
            sub = tc.find(HP + "subList")
            cells[(r, c)] = sublist_blocks(sub) if sub is not None else []
    return {
        "rows": int(tbl.get("rowCnt", 0)),
        "cols": int(tbl.get("colCnt", 0)),
        "cells": cells,
        "span": span,
    }


def blocks_to_text(blocks, depth=0):
    """셀 내용 → 한 줄 문자열 (중첩 표는 | 로 평탄화)"""
    out = []
    for kind, v in blocks:
        if kind == "p":
            out.append(v)
        else:
            for r in range(v["rows"]):
                row = [blocks_to_text(v["cells"].get((r, c), []), depth + 1)
                       for c in range(v["cols"])]
                row = [x for x in row if x]
                if row:
                    out.append(" | ".join(row))
    return "\n".join(x for x in out if x)


def iter_top_blocks(path):
    with zipfile.ZipFile(path) as z:
        data = z.read("Contents/section0.xml")
    root = ET.fromstring(data)
    for p in root.iter(HP + "p"):
        pass
    # 최상위 문단만 (섹션 직속)
    for p in list(root):
        if p.tag != HP + "p":
            continue
        txt = para_text(p)
        tbls = [n for run in p.findall(HP + "run") for n in run if n.tag == HP + "tbl"]
        if tbls:
            parts = txt.split(" TBL ")
            for i, part in enumerate(parts):
                if part.strip():
                    yield ("p", part.strip())
                if i < len(tbls):
                    yield ("tbl", parse_table(tbls[i]))
        elif txt.strip():
            yield ("p", txt.strip())


if __name__ == "__main__":
    src = sys.argv[1]
    n_p = n_t = 0
    for kind, v in iter_top_blocks(src):
        if kind == "p":
            n_p += 1
            if n_p <= 30:
                print("P:", v[:160])
        else:
            n_t += 1
            print(f"\n=== TABLE #{n_t}  {v['rows']}행 x {v['cols']}열 ===")
            if n_t <= 3:
                for r in range(min(v["rows"], 6)):
                    row = [blocks_to_text(v["cells"].get((r, c), [])).replace("\n", "⏎")[:60]
                           for c in range(v["cols"])]
                    print("  ", " ║ ".join(row))
    print(f"\n최상위 문단 {n_p}개, 표 {n_t}개")
