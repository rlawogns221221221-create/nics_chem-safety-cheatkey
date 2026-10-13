#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""사용자가 집계한 원자료 3,865곳이 **데이터로 몇 건인지** 셉니다(보고서용).

    python3 build/원자료_건수.py

── 왜 따로 세나 (2026-10-13 사용자 요청) ─────────────────────────
사용자는 기관별 원자료를 "곳" 으로 셌습니다(합 3,865). 보고서에는 그 자료가
데이터로 몇 건인지가 필요합니다. 원본 표의 칸을 그대로 세면 약 6.6만 건이지만,
업체명·주소·전화가 **줄마다 되풀이되어** 그때마다 1건이 됩니다(가스 72종을
다루는 판매업체 한 곳이 75줄). 사용자가 **보수적인 숫자**를 골랐으므로 이렇게
셉니다 —
  · 업체·기관 정보(이름·주소·전화·관할 등)는 **곳마다 한 번**
  · 같은 곳 안에서 똑같은 줄은 한 번
  · 빈칸 · "-" · 수량 0 · 일련번호는 세지 않음
  · 다른 칸에서 따라 나오는 값은 세지 않음 — 독성가스의 CAS번호(물질 이름과
    짝), 방제장비함의 '계'(두 칸의 합 · 단 두 칸이 비어 '계' 만 있는 줄은 셈)

⚠ 표에 없는 둘은 숫자를 직접 적었습니다.
  · 민간방제선박 — 드라이브 `6. 민간 방제 선박/(사업장) 민간 방제 선박.xlsx`
    (해양오염방제업 현황 2025.9). 업체 35곳 × 5칸(관할서·업종·등록번호·업체명·
    주소) + 선박 129척 × 4칸(선명·선종·총톤수·계류장소). 처음엔 손으로 셌고
    2026-10-13 원본 글자를 기계로 다시 세어 35·129 가 맞는 것을 확인했습니다.
    등록번호가 둘(방제·유창)인 업체도 한 칸으로 셉니다.
  · 소방 9대 — 원본 파일을 받지 못해 차량 수만 1건씩 셉니다.
⚠ 화학안전공동체는 우리 표에 106곳(116자리)만 있습니다. 576곳 원본을 받으면
  이 숫자가 늘어납니다. 담당자 실명·휴대전화는 정리본에서 지웠으므로 세지
  않습니다(개인정보라 셀 대상도 아닙니다).

── 표와 PDF ───────────────────────────────────────────────────────
돌리면 `docs/데이터건수_근거.html` 도 함께 씁니다(사용자 요청 — "표 정리해서
pdf 다운 가능하게"). PDF 는 `node build/데이터건수_근거.mjs`.
**표의 숫자를 HTML 에서 손으로 고치지 마세요** — 여기서 센 값을 그대로 박습니다.
"""
import csv,glob,re,html
import pathlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
D=str(ROOT/'docs'/'방제자원_정리'/'표')+'/'
def load(n): return list(csv.DictReader(open(glob.glob(D+n+'_*.csv')[0],encoding='utf-8-sig')))
def ok(v,zero=True):
    v=(v or '').strip()
    if not v or v in ('-','–','—'): return False
    if zero and re.fullmatch(r'0+(\.0+)?',v): return False
    return True
def nm(s): return re.sub(r'\s|㈜|\(주\)|주식회사','',s or '')
def 원표(rows):
    """참고용 — 원표의 칸을 빈칸만 빼고 모두 센 값(연번 제외). 보고서 숫자로 쓰지 않습니다."""
    return sum(1 for x in rows for c,v in x.items() if c!='연번' and (v or '').strip() not in ('','-'))
def 세기(rows, key, 곳칸, 줄칸):
    """곳칸 = 업체·기관 정보(곳마다 한 번) · 줄칸 = 줄마다 다른 사실(같은 곳 안에서 같은 줄은 한 번)
    표에 '무엇을 빼고 셌는지' 를 적어야 해서 뺀 것(수량 0 · 겹친 줄)도 함께 셉니다."""
    곳={}; 줄=set(); 영=0; 줄있음=0
    for r in rows:
        k=tuple(nm(r[c]) for c in key)
        곳.setdefault(k,{})
        for c in 곳칸:
            if ok(r[c],zero=False) and c not in 곳[k]: 곳[k][c]=1
        영+=sum(1 for c in 줄칸 if ok(r[c],zero=False) and not ok(r[c]))
        t=tuple((c,r[c].strip()) for c in 줄칸 if ok(r[c]))
        if t: 줄있음+=1; 줄.add((k,t))
    갑=sum(len(v) for v in 곳.values()); 을=sum(len(t) for _,t in 줄)
    return dict(곳=len(곳), 줄=len(rows), 갑=갑, 을=을, 항목=갑+을, 낱줄=len(줄), 겹친줄=줄있음-len(줄), 영=영,
                빈줄=len(rows)-줄있음 if 줄칸 else 0)
f=lambda n:f'{n:,}'
out=[]   # (기관, 자료, 사용자곳, 결과, 근거, 원표)
def 뺌(x, 더=()):
    a=list(더)
    if x.get('영'): a.append(f'수량 0 {f(x["영"])}칸')
    if x.get('겹친줄'): a.append(f'똑같은 줄 {f(x["겹친줄"])}줄')
    if x.get('빈줄'): a.append(f'내역이 비거나 0뿐인 줄 {f(x["빈줄"])}줄')
    return ('<span class="x">빼고 셈: '+' · '.join(a)+'</span>') if a else ''

r=load('01'); eq=[c for c in r[0] if c not in ('연번','구분','시도','시군구','부서','주소','대표전화','보관장소')]
x=세기(r,('시도','시군구','부서'),('구분','시도','시군구','부서','주소','대표전화'),['보관장소']+eq)
out.append(('지자체','지자체 방재장비',221,x,
  f'담당 부서 {f(x["곳"])}곳 × 구분·시도·시군구·부서·주소·대표전화 = {f(x["갑"])}<br>'
  f'보관장소 + 장비 {len(eq)}종 수량 = {f(x["을"])}'+뺌(x),원표(r)))

r=load('14'); x=세기(r,('업체명','소재지'),('인허가기관','시도','시군구','업체명','소재지','대표전화'),('업종','처리방법'))
out.append(('사업장','폐기물처리업체',1505,x,
  f'업체 {f(x["곳"])}곳 × 인허가기관·시도·시군구·업체명·소재지·대표전화 = {f(x["갑"])}<br>'
  f'허가 {f(x["낱줄"])}줄 × 업종·처리방법 = {f(x["을"])}'+뺌(x),원표(r)))

r=load('05'); x=세기(r,('업체명','소재지'),('업체명','소재지','대표전화'),('장비·인력','단위','수량'))
out.append(('사업장','화학안전공동체',576,x,
  f'사업장 {f(x["곳"])}곳 × 업체명·소재지·대표전화 = {f(x["갑"])}<br>'
  f'장비·인력 {f(x["낱줄"])}줄 × 이름·단위·수량 = {f(x["을"])}'+뺌(x),원표(r)))

r=load('06'); x=세기(r,('업체명','주소'),('업체명','주소','대표전화','관할지사'),('시설분류','취급가스물질','허가량','법정기준일'))
out.append(('사업장','독성가스 취급업체',1431,x,
  f'업체 {f(x["곳"])}곳 × 업체명·주소·대표전화·관할지사 = {f(x["갑"])}<br>'
  f'취급 내역 {f(x["낱줄"])}줄 × 시설분류·가스 이름·허가량·기준일 = {f(x["을"])}'+뺌(x,['CAS번호(가스 이름과 짝)']),원표(r)))

r=load('16'); x=세기(r,('업체명',),[c for c in r[0]],())
out.append(('사업장','독성가스 회수업체',2,x,
  f'업체 {f(x["곳"])}곳 × 채워진 칸 {x["갑"]//max(x["곳"],1)}개(업체명·소재지·작업유형·처리 가능 물질 등) = {f(x["갑"])}',원표(r)))

r=load('10'); x=세기(r,('업체명','주소'),('업체명','주소','대표전화'),('장비명','용량','비고'))
out.append(('사업장','ERCV(비상캡슐)',17,x,
  f'업체 {f(x["곳"])}곳 × 업체명·주소·대표전화 = {f(x["갑"])}<br>'
  f'비상캡슐 {f(x["낱줄"])}줄 × 장비명·용량·비고(적힌 것만) = {f(x["을"])}',원표(r)))

x=dict(곳=35,줄=129,갑=35*5,을=129*4,항목=35*5+129*4)
out.append(('사업장','민간방제선박',35,x,
  '업체 35곳 × 관할서·업종·등록번호·업체명·주소 = 175<br>'
  '선박 129척 × 선명·선종·총톤수·계류장소 = 516'
  '<span class="x">해양오염방제업 현황(2025. 9.) 원본에서 셈</span>',x['항목']))

r=load('04'); 원=원표(r)
# '계' 는 두 칸(컨테이너·간이)의 합이라 두 칸이 있으면 세지 않습니다. 그런데 492줄
# 가운데 401줄은 두 칸이 비고 **'계' 에만 수량이 있습니다** — 그때는 '계' 가 유일한
# 수량이므로 셉니다(처음에 통째로 뺐다가 401건이 빠졌습니다 · 2026-10-13).
for y in r:
    y['계(유일한 수량)']=y['계'] if not (ok(y['컨테이너장비함']) or ok(y['간이방재함'])) else ''
x=세기(r,('설치장소','주소'),('설치장소','산단·고속도로','주소','관리주체','연락망'),('방재장비','단위','컨테이너장비함','간이방재함','계(유일한 수량)'))
수=[sum(1 for y in r if ok(y[c])) for c in ('컨테이너장비함','간이방재함','계(유일한 수량)')]
out.append(('환경청','방제장비함',33,x,
  f'설치장소 {f(x["곳"])}곳 × 설치장소·산단/고속도로·주소·관리주체·연락망 = {f(x["갑"])}<br>'
  f'장비 {f(x["낱줄"])}줄 × 장비명·단위 + 수량(컨테이너 {수[0]} · 간이 {수[1]} · \'계\'만 적힌 줄 {수[2]}) = {f(x["을"])}'
  +뺌(x,["두 칸이 있는 줄의 '계'(합계)"]),원))

r=load('09'); q=[c for c in r[0] if '(' in c]
가=sum(1 for y in r for c in ('구분','장비명','단위') if ok(y[c],zero=False)); 나=sum(1 for y in r for c in q if ok(y[c]))
x=dict(곳=4,줄=len(r),갑=0,을=가+나,항목=가+나)
out.append(('환경청','수질오염방제센터',8,x,
  f'장비 {len(r)}종 × 구분·장비명·단위 = {f(가)}<br>권역 {len(q)}곳별 보유 수량 = {f(나)}'
  '<span class="x">자료가 센터 8곳이 아니라 권역 4곳 단위라 기관 정보 칸이 없습니다</span>',원표(r)))

x=dict(곳=9,줄=9,갑=9,을=0,항목=9)
out.append(('소방','대응 차량',9,x,
  '차량 9대 × 1건(울산 대용량방사포 2 · 여수 화학대응차량 7)'
  '<span class="x">원본 파일을 받지 못해 차량 수만 셈</span>',9))

r=load('08'); x=세기(r,('선명',),('소속','선명','선형','톤급','정박지'),())
out.append(('해경','화학방제정',25,x,
  f'방제정 {f(x["곳"])}척 × 소속·선명·선형·톤급·정박지 = {f(x["갑"])}',원표(r)))

r=load('07'); x=세기(r,('비축기지',),('비축기지','위치','연면적','시설형태'),('방재장비','단위','수량'))
out.append(('해경','방제비축기지',3,x,
  f'기지 {f(x["곳"])}곳 × 이름·위치·연면적·시설형태 = {f(x["갑"])}<br>'
  f'장비 {f(x["낱줄"])}줄 × 장비명·단위·수량 = {f(x["을"])}',원표(r)))

T=dict(사용자=0,줄=0,갑=0,을=0,항목=0,원표=0)
print(f"{'자료':14s} {'사용자 곳':>8s} {'겹침없는 곳':>10s} {'줄':>7s} {'항목(보수)':>10s}")
for 기관,name,u,x,_,원 in out:
    print(f"{name:14s} {u:>8,} {x['곳']:>10,} {x['줄']:>7,} {x['항목']:>10,}")
    T['사용자']+=u; T['줄']+=x['줄']; T['갑']+=x['갑']; T['을']+=x['을']; T['항목']+=x['항목']; T['원표']+=원
print('합', [T['사용자'],T['줄'],T['항목']], '· 참고(원표 칸 그대로)', f(T['원표']))

# ── 표(HTML) — PDF 는 node build/데이터건수_근거.mjs ──────────────────
독=next(x for _,n,_,x,_,_ in out if n=='독성가스 취급업체')
몫=lambda a:round(a*100/T['항목'])
줄들=[]; 앞=None
for 기관,name,u,x,근거,_ in out:
    칸=sum(1 for o in out if o[0]==기관)
    g=f'<td class="g" rowspan="{칸}">{기관}</td>' if 기관!=앞 else ''
    앞=기관
    줄들.append(f'<tr>{g}<td class="nm">{html.escape(name)}</td><td class="n">{f(u)}</td>'
      f'<td class="n">{f(x["줄"])}</td><td class="n">{f(x["갑"]) if x["갑"] else "—"}</td>'
      f'<td class="n">{f(x["을"]) if x["을"] else "—"}</td><td class="n b">{f(x["항목"])}</td>'
      f'<td class="why">{근거}</td></tr>')
쪽=f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>방제자원 원자료 데이터 건수 산정 근거</title>
<!-- ⚠ build/원자료_건수.py 가 만듭니다 — 손으로 고치지 마세요. 숫자는 그 스크립트가
     docs/방제자원_정리/표/*.csv 를 세어 박은 값입니다. PDF: node build/데이터건수_근거.mjs -->
<style>
  @font-face{{font-family:"Pretendard GOV";font-weight:400;font-display:block;
    src:url("../assets/fonts/PretendardGOV-Regular.subset.woff2") format("woff2")}}
  @font-face{{font-family:"Pretendard GOV";font-weight:700;font-display:block;
    src:url("../assets/fonts/PretendardGOV-Bold.subset.woff2") format("woff2")}}
  @page{{size:A4}}
  :root{{--ink:#12181f;--ink2:#4a5563;--ink3:#78838f;--line:#d5dce3;--line2:#eaeef2;
    --blue:#256ef4;--blue-d:#0b50d0;--blue-l:#eef4fe;--amber:#8a5c00;--amber-l:#fff5e0}}
  *{{box-sizing:border-box}}
  body{{margin:0;font-family:"Pretendard GOV",system-ui,sans-serif;font-size:8.6pt;line-height:1.42;
    color:var(--ink);word-break:keep-all;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  .hd{{background:linear-gradient(135deg,#2f7cf6,#0b50d0);color:#fff;border-radius:5pt;
    padding:8pt 11pt;margin-bottom:7pt;display:flex;align-items:flex-end;gap:10pt}}
  .hd h1{{margin:0 0 2pt;font-size:15pt;letter-spacing:-.02em;line-height:1.2}}
  .hd p{{margin:0;font-size:8.5pt;opacity:.93}}
  .hd .rt{{margin-left:auto;font-size:8pt;opacity:.9;white-space:nowrap}}
  .kpi{{display:flex;gap:5pt;margin-bottom:7pt}}
  .k{{flex:1;border:1pt solid var(--line);border-radius:4pt;padding:5pt 8pt;background:var(--blue-l)}}
  .k .t{{font-size:7.8pt;font-weight:700;color:var(--blue-d)}}
  .k b{{display:block;font-size:17pt;line-height:1.1;letter-spacing:-.03em}}
  .k .s{{font-size:7.3pt;color:var(--ink2)}}
  h2{{margin:0 0 3.5pt;font-size:9.8pt;padding-bottom:2pt;border-bottom:1.1pt solid var(--ink)}}
  section{{margin-bottom:7pt}}
  ol,ul{{margin:0;padding-left:13pt}} li{{margin-bottom:1.5pt}}
  table{{width:100%;border-collapse:collapse;font-size:7.7pt}}
  th,td{{border:.8pt solid var(--line);padding:2.4pt 4pt;vertical-align:middle;text-align:left}}
  th{{background:#f3f6f9;font-weight:700;text-align:center;line-height:1.25}}
  td.n{{text-align:right;white-space:nowrap}} td.b{{font-weight:700;color:var(--blue-d)}}
  td.g{{text-align:center;font-weight:700;background:#fafbfc}}
  td.nm{{font-weight:700;white-space:nowrap}}
  td.why{{font-size:7.2pt;line-height:1.4;color:var(--ink2)}}
  td.why .x{{display:block;color:var(--ink3)}}
  tr.sum td{{background:var(--blue-l);font-weight:700}}
  .note{{background:var(--amber-l);border-left:2.6pt solid var(--amber);border-radius:3pt;padding:5pt 8pt}}
  .note li{{font-size:8pt}}
  .ref{{margin-top:4pt;font-size:7.6pt;color:var(--ink2)}}
  footer{{margin-top:6pt;padding-top:3pt;border-top:.8pt solid var(--line);font-size:7.3pt;color:var(--ink3)}}
</style>
</head>
<body>
<div class="hd"><div><h1>방제자원 원자료 데이터 건수 산정 근거</h1>
<p>기관별로 집계한 원자료 {f(T['사용자'])}곳을 데이터 항목 단위로 다시 셌습니다 (보수적 산정)</p></div>
<div class="rt">산정일 2026. 10. 13.</div></div>

<div class="kpi">
<div class="k"><div class="t">원자료</div><b>{f(T['사용자'])}곳</b><div class="s">기관별 집계의 합</div></div>
<div class="k"><div class="t">원자료 표의 줄</div><b>{f(T['줄'])}줄</b><div class="s">자료 표의 행 수</div></div>
<div class="k"><div class="t">데이터 항목</div><b>{f(T['항목'])}건</b><div class="s">업체·기관 정보 {f(T['갑'])} + 장비·내역 정보 {f(T['을'])}</div></div>
</div>

<section><h2>세는 기준</h2><ol>
<li><b>업체·기관 정보는 한 곳에 한 번만</b> 셉니다 — 업체명·주소·전화가 줄마다 되풀이돼도 1건입니다.</li>
<li><b>같은 곳 안에서 똑같은 줄은 한 번만</b> 셉니다.</li>
<li><b>빈칸 · "-" · 수량 0 · 일련번호는 세지 않습니다.</b> 그래서 「곳 × 칸 수」보다 작을 수 있습니다.</li>
<li><b>다른 칸에서 따라 나오는 값은 세지 않습니다</b> — 가스 이름과 짝인 CAS번호, 두 칸의 합인 '계'.</li>
</ol></section>

<section><h2>자료별 산정 내역</h2>
<table>
<colgroup><col style="width:7%"><col style="width:15%"><col style="width:7%"><col style="width:7%">
<col style="width:8%"><col style="width:8%"><col style="width:8%"><col></colgroup>
<thead><tr><th>기관</th><th>자료</th><th>집계<br>(곳)</th><th>원자료<br>줄</th><th>① 업체·<br>기관 정보</th>
<th>② 장비·<br>내역 정보</th><th>데이터<br>항목</th><th>산정 근거</th></tr></thead>
<tbody>
{chr(10).join(줄들)}
<tr class="sum"><td colspan="2">합계</td><td class="n">{f(T['사용자'])}</td><td class="n">{f(T['줄'])}</td>
<td class="n">{f(T['갑'])}</td><td class="n">{f(T['을'])}</td><td class="n">{f(T['항목'])}</td><td></td></tr>
</tbody></table></section>

<section class="note"><h2 style="border:0;margin-bottom:2pt">숫자를 쓸 때 함께 알아 둘 것</h2><ul>
<li><b>독성가스 취급업체 {f(독['항목'])}건이 전체의 {몫(독['항목'])}%</b>입니다. 원자료로 모아 정리했지만 지금 서비스(방제 물품·장비 찾기)에는 넣지 않은 자료입니다.</li>
<li><b>곳 수가 집계와 다른 자료</b>는 세는 단위가 다르기 때문입니다 — 지자체 221(시·군·구) ↔ 412(담당 부서),
독성가스 1,431 ↔ {f(독['곳'])}(주소별), 방제장비함 33 ↔ 48(설치장소), ERCV 17 ↔ 19, 수질오염방제센터 8 ↔ 4(권역).
데이터 항목은 표에 실제로 있는 단위로 셌습니다.</li>
<li><b>화학안전공동체</b>는 576곳 가운데 정리 표에 있는 106개 기업(116곳)만 셌습니다. 원본을 받으면 늘어납니다.</li>
<li><b>소방 9대</b>는 원본 파일을 받지 못해 차량 1대를 1건으로만 셌습니다.</li>
<li><b>담당자 실명·휴대전화</b>는 정리 단계에서 지웠으므로 세지 않았습니다.</li>
</ul></section>
<p class="ref">참고 — 원표의 칸을 빈칸만 빼고 모두 세면 {f(T['원표'])}건입니다. 업체 정보가 줄마다 되풀이된 것까지 세는 값이라 위 산정에는 쓰지 않았습니다.</p>
<footer>같은 기준으로 다시 세면 같은 숫자가 나옵니다 — 산정에 쓴 표와 세는 방법을 보관하고 있습니다.</footer>
</body>
</html>
"""
(ROOT/'docs'/'데이터건수_근거.html').write_text(쪽,encoding='utf-8')
print('docs/데이터건수_근거.html 을 썼습니다')
