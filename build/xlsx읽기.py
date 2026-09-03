# -*- coding: utf-8 -*-
"""xlsx 를 **표준 라이브러리만으로** 읽는다.

   왜 직접 쓰나 — 이 저장소는 바깥 꾸러미(openpyxl 등)를 두지 않습니다.
   받는 사람의 PC 에서 `python3 build/…` 만으로 돌아야 하기 때문입니다.
   xlsx 는 사실 XML 을 담은 zip 이라 40줄이면 읽힙니다.

   드라이브 도구로 읽는 것보다 이 길이 낫습니다 — 도구는 표를 **줄바꿈
   없는 한 줄**로 돌려주어 행을 되돌려야 하는데, 여기서는 칸이 원래 자리에
   그대로 옵니다. 파일을 받을 수 있으면 언제나 이쪽을 쓰세요.

       from xlsx읽기 import 시트들
       for 이름, 행들 in 시트들('어떤파일.xlsx'):
           ...
"""
import re, zipfile
from xml.etree import ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'


def _글자들(z):
    """sharedStrings.xml — 셀 값이 여기 번호로 들어 있는 경우가 많다."""
    if 'xl/sharedStrings.xml' not in z.namelist():
        return []
    낸다 = []
    for si in ET.fromstring(z.read('xl/sharedStrings.xml')):
        # <si> 안에 <t> 가 여러 개로 쪼개져 있을 수 있다(서식이 섞인 글자)
        낸다.append(''.join(t.text or '' for t in si.iter(NS + 't')))
    return 낸다


def _열번호(주소):
    """'BC12' → 54 (0부터). 빈 칸은 XML 에 아예 없어서 자리를 맞춰야 한다."""
    m = re.match(r'([A-Z]+)', 주소 or '')
    if not m:
        return None
    n = 0
    for ch in m.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def 시트들(경로):
    """[(시트이름, [[칸,…], …]), …] 를 돌려준다."""
    z = zipfile.ZipFile(경로)
    글자 = _글자들(z)

    # 시트 이름 ↔ 파일 짝짓기 (workbook.xml 의 r:id → workbook.xml.rels)
    rels = {}
    if 'xl/_rels/workbook.xml.rels' in z.namelist():
        for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels')):
            rels[r.get('Id')] = r.get('Target').lstrip('/')
    낸다 = []
    for sh in ET.fromstring(z.read('xl/workbook.xml')).iter(NS + 'sheet'):
        대상 = rels.get(sh.get(REL + 'id'), '')
        경로2 = 대상 if 대상.startswith('xl/') else 'xl/' + 대상
        if 경로2 not in z.namelist():
            continue
        낸다.append((sh.get('name'), _행들(z.read(경로2), 글자)))
    return 낸다


def _행들(xml, 글자):
    행 = []
    for r in ET.fromstring(xml).iter(NS + 'row'):
        칸 = []
        for c in r.iter(NS + 'c'):
            i = _열번호(c.get('r'))
            if i is not None:
                while len(칸) < i:
                    칸.append('')            # 비어 있는 칸은 XML 에 없다
            v = c.find(NS + 'v')
            t = c.get('t')
            if t == 's' and v is not None and v.text is not None:
                값 = 글자[int(v.text)] if int(v.text) < len(글자) else ''
            elif t == 'inlineStr':
                값 = ''.join(x.text or '' for x in c.iter(NS + 't'))
            else:
                값 = (v.text if v is not None and v.text is not None else '')
            칸.append(값.strip() if isinstance(값, str) else 값)
        행.append(칸)
    return 행


def 다듬기(행들):
    """뒤쪽 빈 칸과 통째로 빈 행을 걷어낸다."""
    낸다 = []
    for r in 행들:
        while r and not str(r[-1]).strip():
            r.pop()
        if any(str(x).strip() for x in r):
            낸다.append(r)
    return 낸다
