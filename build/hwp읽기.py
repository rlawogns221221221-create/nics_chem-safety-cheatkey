# -*- coding: utf-8 -*-
"""hwp · hwpx 에서 글자를 뽑는다 — 원자료를 한 번 꺼낼 때 쓰는 도구.

       python3 build/hwp읽기.py 어떤파일.hwp
       python3 build/hwp읽기.py 어떤파일.hwpx

   ⚠ **정기 빌드에는 들어가지 않습니다.** 드라이브의 hwp 원자료에서 표를
     한 번 꺼내 CSV 로 옮길 때 썼습니다. 꺼낸 결과는
     `build/방제자원_정리.py` 안에 표로 적어 두었으므로, 정리본을 다시
     만들 때 이 파일이 없어도 됩니다.

   ⚠ hwp(5.0)는 OLE 복합문서라 `olefile` 이 필요합니다
     (`pip install olefile`). hwpx 는 XML 을 담은 zip 이라 표준
     라이브러리만으로 읽힙니다.

   ── 왜 필요했나 ────────────────────────────────────────────────
   구글드라이브 도구는 hwp 를 "지원하지 않는 형식"으로 거절합니다. 그래서
   한동안 여섯 개 파일을 못 읽는 것으로 두었는데, 파일을 base64 로 내려받아
   여기서 풀면 그대로 읽힙니다. 실제로 이 길로
   **전국 독성가스 회수업체(2곳)** 와 **전남·광주 방제약품 판매업체(11곳)** 을
   건졌습니다.
"""
import re, struct, zipfile
from xml.etree import ElementTree as ET

TAG_PARA_TEXT = 67                 # HWPTAG_BEGIN(16) + 51
넓은 = {1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23}   # 16바이트짜리 제어문자


# ══ hwpx — XML 을 담은 zip ═══════════════════════════════════════
def hwpx_문단들(경로):
    z = zipfile.ZipFile(경로)
    낸다 = []
    for 이름 in sorted(n for n in z.namelist()
                     if re.match(r'Contents/section\d+\.xml$', n)):
        for p in ET.fromstring(z.read(이름)).iter():
            if p.tag.endswith('}p') or p.tag == 'p':
                글 = ''.join(t.text or '' for t in p.iter()
                            if t.tag.endswith('}t') or t.tag == 't').strip()
                if 글:
                    낸다.append(글)
    return 낸다


# ══ hwp 5.0 — OLE 복합문서 안의 zlib 압축 레코드 ══════════════════
def hwp_문단들(경로):
    import olefile                    # 이 함수에서만 필요합니다
    import zlib
    o = olefile.OleFileIO(경로)
    압축 = bool(struct.unpack('<I', o.openstream('FileHeader').read()[36:40])[0] & 1)
    낸다 = []
    for 이름 in sorted('/'.join(s) for s in o.listdir() if s[0] == 'BodyText'):
        raw = o.openstream(이름).read()
        buf = zlib.decompress(raw, -15) if 압축 else raw
        for 태그, d in _레코드들(buf):
            if 태그 == TAG_PARA_TEXT:
                글 = _문단글자(d).strip()
                if 글:
                    낸다.append(글)
    return 낸다


def _레코드들(buf):
    """레코드 머리 4바이트 = 태그(10) + 수준(10) + 크기(12).
       크기가 0xFFF 면 다음 4바이트가 진짜 크기입니다."""
    i = 0
    while i + 4 <= len(buf):
        (h,) = struct.unpack('<I', buf[i:i + 4])
        태그, 크기 = h & 0x3FF, (h >> 20) & 0xFFF
        i += 4
        if 크기 == 0xFFF:
            (크기,) = struct.unpack('<I', buf[i:i + 4])
            i += 4
        yield 태그, buf[i:i + 크기]
        i += 크기


def _문단글자(data):
    """UTF-16LE. 32 미만은 제어문자인데, 그중 일부는 **16바이트**를 차지합니다."""
    낸다, i = [], 0
    while i + 2 <= len(data):
        (c,) = struct.unpack('<H', data[i:i + 2])
        if c in (10, 13):
            낸다.append(' ')
            i += 2
        elif c < 32:
            i += 16 if c in 넓은 else 2
        else:
            낸다.append(chr(c))
            i += 2
    return ''.join(낸다)


def 문단들(경로):
    return hwpx_문단들(경로) if 경로.lower().endswith('.hwpx') else hwp_문단들(경로)


if __name__ == '__main__':
    import sys
    for i, p in enumerate(문단들(sys.argv[1])):
        print('%4d| %s' % (i, p))
