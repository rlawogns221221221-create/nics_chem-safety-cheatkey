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

⚠ 근거는 **곱셈식으로 적지 않습니다**(2026-10-14 사용자 — "곱셈으로 산정된
갯수잔아 … 업체명 몇개, 연락처 몇개, 장비는 몇종 몇개, 이런식으로 … 지금처럼
나가버리면 사람들이 이해를 할 수가 없어"). 칸마다 **실제로 센 개수**를
「업체명 1,110 · 연락처 1,098 · 장비 1,716(15종)」처럼 늘어놓고, 그 개수의
합이 데이터 항목과 같은지 `assert` 로 맞춰 봅니다. 맨 위에는 전체를 일곱
갈래(업체·기관명 · 주소 · 연락처 …)로 모은 합계를 둡니다.
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
    근거 표를 「업체명 몇 · 연락처 몇」으로 적어야 해서 칸마다 센 개수(칸)도 돌려줍니다."""
    곳={}; 줄=set()
    for r in rows:
        k=tuple(nm(r[c]) for c in key)
        곳.setdefault(k,{})
        for c in 곳칸:
            if ok(r[c],zero=False) and c not in 곳[k]: 곳[k][c]=1
        t=tuple((c,r[c].strip()) for c in 줄칸 if ok(r[c]))
        if t: 줄.add((k,t))
    칸={}
    for v in 곳.values():
        for c in v: 칸[c]=칸.get(c,0)+1
    for _,t in 줄:
        for c,_ in t: 칸[c]=칸.get(c,0)+1
    갑=sum(len(v) for v in 곳.values()); 을=sum(len(t) for _,t in 줄)
    return dict(곳=len(곳), 줄=len(rows), 항목=갑+을, 칸=칸)
def 종(rows,c):
    """장비·가스가 몇 가지인가 — 띄어쓰기만 다른 표기는 같은 것으로 봅니다."""
    return len({re.sub(r'\s','',r[c]) for r in rows if ok(r[c],zero=False)})
f=lambda n:f'{n:,}'

# 전체 합계를 모으는 일곱 갈래 — 읽는 사람이 "업체명 몇, 연락처 몇" 으로 알아듣는 말
명,주,연,지,장,수,기='업체·기관명','주소·위치','연락처','지역·관할','장비·물품','수량·단위','업종·허가·기타'
갈래=[(명,'업체명 · 부서명 · 관리기관'),(주,'주소 · 소재지 · 보관·계류 장소'),(연,'대표전화 · 연락망'),
     (지,'시·도 · 시·군·구 · 관할기관'),(장,'장비 · 물품 · 인력 · 차량 · 선박 · 취급 가스'),
     (수,'보유 수량 · 용량 · 허가량 · 단위'),(기,'허가 업종 · 처리방법 · 시설분류 · 기준일 · 비고')]
def 조각(x, *spec):
    """spec = (이름, [칸들], 갈래, 몇 가지) — 칸들에서 센 개수를 더해 한 조각으로.
    조각들의 합이 데이터 항목과 다르면 멈춥니다(표에 적은 근거가 숫자와 어긋나면 안 됨)."""
    out=[(이름,sum(x['칸'].get(c,0) for c in 칸들),g,가지) for 이름,칸들,g,가지 in spec]
    out=[o for o in out if o[1]]
    assert sum(o[1] for o in out)==x['항목'], (spec[0][0], sum(o[1] for o in out), x['항목'])
    return out

out=[]   # (기관, 자료, 사용자곳, 결과, 조각들, 원표, 덧말)
r=load('01'); eq=[c for c in r[0] if c not in ('연번','구분','시도','시군구','부서','주소','대표전화','보관장소')]
x=세기(r,('시도','시군구','부서'),('구분','시도','시군구','부서','주소','대표전화'),['보관장소']+eq)
out.append(('지자체','지자체 방재장비',221,x,조각(x,
  ('기관(담당 부서)',['부서'],명,0),('주소',['주소'],주,0),('연락처',['대표전화'],연,0),
  ('시·도·시·군·구',['시도','시군구'],지,0),('광역·기초 구분',['구분'],지,0),('보관장소',['보관장소'],주,0),
  ('장비 보유',eq,장,len(eq))),원표(r),''))

r=load('14'); x=세기(r,('업체명','소재지'),('인허가기관','시도','시군구','업체명','소재지','대표전화'),('업종','처리방법'))
out.append(('사업장','폐기물처리업체',1505,x,조각(x,
  ('업체명',['업체명'],명,0),('소재지',['소재지'],주,0),('연락처',['대표전화'],연,0),
  ('시·도·시·군·구',['시도','시군구'],지,0),('인허가기관',['인허가기관'],지,0),
  ('허가 업종',['업종'],기,0),('처리방법',['처리방법'],기,0)),원표(r),''))

r=load('05'); x=세기(r,('업체명','소재지'),('업체명','소재지','대표전화'),('장비·인력','단위','수량'))
out.append(('사업장','화학안전공동체',576,x,조각(x,
  ('업체명',['업체명'],명,0),('소재지',['소재지'],주,0),('연락처',['대표전화'],연,0),
  ('장비·인력',['장비·인력'],장,종(r,'장비·인력')),('수량',['수량'],수,0),('단위',['단위'],수,0)),원표(r),''))

r=load('06'); x=세기(r,('업체명','주소'),('업체명','주소','대표전화','관할지사'),('시설분류','취급가스물질','허가량','법정기준일'))
out.append(('사업장','독성가스 취급업체',1431,x,조각(x,
  ('업체명',['업체명'],명,0),('주소',['주소'],주,0),('연락처',['대표전화'],연,0),('관할지사',['관할지사'],지,0),
  ('취급 가스',['취급가스물질'],장,종(r,'취급가스물질')),('허가량',['허가량'],수,0),
  ('시설분류',['시설분류'],기,0),('기준일',['법정기준일'],기,0)),원표(r),''))

r=load('16'); x=세기(r,('업체명',),[c for c in r[0]],())
out.append(('사업장','독성가스 회수업체',2,x,조각(x,
  ('업체명',['업체명'],명,0),('소재지',['소재지'],주,0),('연락처',['대표전화'],연,0),
  ('처리 가능 물질',['처리가능 물질'],기,0),('보유차량',['보유차량'],장,0),('운영인력',['운영인력'],장,0),
  ('처리용량',['처리용량'],수,0),('작업유형',['작업유형'],기,0),('처리비용·특이사항',['처리비용','특이사항'],기,0)),원표(r),''))

r=load('10'); x=세기(r,('업체명','주소'),('업체명','주소','대표전화'),('장비명','용량','비고'))
out.append(('사업장','ERCV(비상캡슐)',17,x,조각(x,
  ('업체명',['업체명'],명,0),('주소',['주소'],주,0),('연락처',['대표전화'],연,0),
  ('비상캡슐',['장비명'],장,종(r,'장비명')),('용량',['용량'],수,0),('비고',['비고'],기,0)),원표(r),''))

# 정리 표에 없어 드라이브 원본에서 센 값입니다(머리말 참고) — 업체 35곳 · 선박 129척
x=dict(곳=35,줄=129,항목=35*5+129*4)
out.append(('사업장','민간방제선박',35,x,
  [('업체명',35,명,0),('주소',35,주,0),('관할서',35,지,0),('업종·등록번호',70,기,0),
   ('선박',129,장,0),('선종',129,기,0),('총톤수',129,수,0),('계류장소',129,주,0)],x['항목'],
  '해양오염방제업 현황(2025. 9.) 원본에서 셈 · 원본에 전화번호 칸이 없음'))

r=load('04'); 원=원표(r)
# '계' 는 두 칸(컨테이너·간이)의 합이라 두 칸이 있으면 세지 않습니다. 그런데 492줄
# 가운데 401줄은 두 칸이 비고 **'계' 에만 수량이 있습니다** — 그때는 '계' 가 유일한
# 수량이므로 셉니다(처음에 통째로 뺐다가 401건이 빠졌습니다 · 2026-10-13).
for y in r:
    y['계(유일한 수량)']=y['계'] if not (ok(y['컨테이너장비함']) or ok(y['간이방재함'])) else ''
x=세기(r,('설치장소','주소'),('설치장소','산단·고속도로','주소','관리주체','연락망'),('방재장비','단위','컨테이너장비함','간이방재함','계(유일한 수량)'))
out.append(('환경청','방제장비함',33,x,조각(x,
  ('관리기관',['관리주체'],명,0),('설치장소',['설치장소'],주,0),('주소',['주소'],주,0),('연락처',['연락망'],연,0),
  ('산단·고속도로',['산단·고속도로'],지,0),('장비',['방재장비'],장,종(r,'방재장비')),
  ('수량',['컨테이너장비함','간이방재함','계(유일한 수량)'],수,0),('단위',['단위'],수,0)),원,''))

r=load('09'); q=[c for c in r[0] if '(' in c]
x=dict(곳=4,줄=len(r),항목=0)
조=[('장비',sum(1 for y in r if ok(y['장비명'],zero=False)),장,종(r,'장비명')),
   ('권역별 보유 수량',sum(1 for y in r for c in q if ok(y[c])),수,0),
   ('단위',sum(1 for y in r if ok(y['단위'],zero=False)),수,0),
   ('장비 구분',sum(1 for y in r if ok(y['구분'],zero=False)),기,0)]
x['항목']=sum(o[1] for o in 조)
out.append(('환경청','수질오염방제센터',8,x,조,원표(r),
  f'자료가 센터 8곳이 아니라 권역 {len(q)}곳 단위로 묶여 있어 기관별 주소·연락처 칸이 없음'))

x=dict(곳=9,줄=9,항목=9)
out.append(('소방','대응 차량',9,x,[('차량',9,장,0)],9,
  '울산 대용량방사포 2대 · 여수 화학대응차량 7대 — 원본 파일을 받지 못해 차량 수만 셈'))

r=load('08'); x=세기(r,('선명',),('소속','선명','선형','톤급','정박지'),())
out.append(('해경','화학방제정',25,x,조각(x,
  ('소속 해경서',['소속'],명,0),('방제정',['선명'],장,0),('정박지',['정박지'],주,0),
  ('톤급',['톤급'],수,0),('선형',['선형'],기,0)),원표(r),''))

r=load('07'); x=세기(r,('비축기지',),('비축기지','위치','연면적','시설형태'),('방재장비','단위','수량'))
out.append(('해경','방제비축기지',3,x,조각(x,
  ('기지명',['비축기지'],명,0),('위치',['위치'],주,0),('장비',['방재장비'],장,종(r,'방재장비')),
  ('수량',['수량'],수,0),('단위',['단위'],수,0),('연면적',['연면적'],수,0),('시설형태',['시설형태'],기,0)),원표(r),''))

T=dict(사용자=0,줄=0,항목=0,원표=0); G={g:0 for g,_ in 갈래}
print(f"{'자료':14s} {'사용자 곳':>8s} {'겹침없는 곳':>10s} {'줄':>7s} {'항목(보수)':>10s}")
for 기관,name,u,x,조,원,_ in out:
    print(f"{name:14s} {u:>8,} {x['곳']:>10,} {x['줄']:>7,} {x['항목']:>10,}   "+' · '.join(f'{a} {f(n)}' for a,n,_,_ in 조))
    T['사용자']+=u; T['줄']+=x['줄']; T['항목']+=x['항목']; T['원표']+=원
    for _,n,g,_ in 조: G[g]+=n
assert sum(G.values())==T['항목']
print('합', [T['사용자'],T['줄'],T['항목']], '· 참고(원표 칸 그대로)', f(T['원표']))
print('갈래별', ' · '.join(f'{g} {f(n)}' for g,n in G.items()))

# ── 표(HTML) — PDF 는 node build/데이터건수_근거.mjs ──────────────────
독=next(x for _,n,_,x,_,_,_ in out if n=='독성가스 취급업체')
몫=lambda a:round(a*100/T['항목'])
def 조각글(조):
    return ''.join(f'<span class="c"><i>{html.escape(a)}</i><b>{f(n)}</b>'
                   +(f'<s>{가}종</s>' if 가 else '')+'</span>' for a,n,_,가 in 조)
줄들=[]; 앞=None
for 기관,name,u,x,조,_,덧 in out:
    칸=sum(1 for o in out if o[0]==기관)
    g=f'<td class="g" rowspan="{칸}">{기관}</td>' if 기관!=앞 else ''
    앞=기관
    줄들.append(f'<tr>{g}<td class="nm">{html.escape(name)}</td><td class="n">{f(u)}</td>'
      f'<td class="n b">{f(x["항목"])}</td><td class="why">{조각글(조)}'
      +(f'<span class="x">{html.escape(덧)}</span>' if 덧 else '')+'</td></tr>')
갈래칸=''.join(f'<th>{g}</th>' for g,_ in 갈래)
갈래값=''.join(f'<td><b>{f(G[g])}</b></td>' for g,_ in 갈래)
갈래뜻=''.join(f'<td class="d">{d}</td>' for _,d in 갈래)
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
  .k{{flex:1;border:1pt solid var(--line);border-radius:4pt;padding:5pt 8pt;background:var(--blue-l);
    display:flex;align-items:baseline;gap:8pt}}
  .k .t{{font-size:8.4pt;font-weight:700;color:var(--blue-d)}}
  .k b{{font-size:18pt;line-height:1.1;letter-spacing:-.03em}}
  .k .s{{font-size:7.6pt;color:var(--ink2);margin-left:auto}}
  h2{{margin:0 0 3.5pt;font-size:9.8pt;padding-bottom:2pt;border-bottom:1.1pt solid var(--ink)}}
  h2 small{{font-weight:400;font-size:7.6pt;color:var(--ink3);margin-left:4pt}}
  section{{margin-bottom:7pt}}
  ul{{margin:0;padding-left:12pt}} li{{margin-bottom:1.5pt}}
  table{{width:100%;border-collapse:collapse;font-size:7.8pt}}
  th,td{{border:.8pt solid var(--line);padding:2.2pt 4pt;vertical-align:middle;text-align:left}}
  th{{background:#f3f6f9;font-weight:700;text-align:center;line-height:1.25}}
  td.n{{text-align:right;white-space:nowrap}} td.b{{font-weight:700;color:var(--blue-d);font-size:8.6pt}}
  td.g{{text-align:center;font-weight:700;background:#fafbfc}}
  td.nm{{font-weight:700;white-space:nowrap}}
  /* 항목별 개수 — 「업체명 1,110」 한 덩어리가 줄 끝에서 갈라지지 않게 묶습니다 */
  td.why{{line-height:1.6}}
  .c{{display:inline-block;white-space:nowrap;margin-right:7pt}}
  .c i{{font-style:normal;color:var(--ink2)}}
  .c b{{margin-left:2.5pt}}
  .c s{{text-decoration:none;color:var(--blue-d);font-weight:700;margin-left:2pt}}
  .c s::before{{content:"("}} .c s::after{{content:")"}}
  td.why .x{{display:block;color:var(--ink3);font-size:7.2pt;line-height:1.35}}
  tr.sum td{{background:var(--blue-l);font-weight:700}}
  table.cat th{{font-size:7.6pt}}
  table.cat td{{text-align:center}}
  table.cat td b{{font-size:11pt;letter-spacing:-.02em}}
  table.cat td.d{{font-size:6.9pt;color:var(--ink2);line-height:1.3}}
  .note{{background:var(--amber-l);border-left:2.6pt solid var(--amber);border-radius:3pt;padding:5pt 8pt}}
  .note li{{font-size:8pt}}
  .ref{{margin-top:4pt;font-size:7.6pt;color:var(--ink2)}}
  footer{{margin-top:6pt;padding-top:3pt;border-top:.8pt solid var(--line);font-size:7.3pt;color:var(--ink3)}}
</style>
</head>
<body>
<div class="hd"><div><h1>방제자원 원자료 데이터 건수 산정 근거</h1>
<p>기관별로 집계한 원자료 {f(T['사용자'])}곳에 담긴 정보를 항목별로 세었습니다</p></div>
<div class="rt">산정일 2026. 10. 13.</div></div>

<div class="kpi">
<div class="k"><span class="t">원자료</span><b>{f(T['사용자'])}곳</b><span class="s">기관별 집계의 합</span></div>
<div class="k"><span class="t">데이터 항목</span><b>{f(T['항목'])}건</b><span class="s">아래 일곱 갈래의 합</span></div>
</div>

<section><h2>무엇이 몇 건인가 <small>단위: 건</small></h2>
<table class="cat"><tr>{갈래칸}</tr><tr>{갈래값}</tr><tr>{갈래뜻}</tr></table></section>

<section><h2>자료별로 무엇을 몇 건 셌나 <small>단위: 건 · (○종)은 장비·가스가 몇 가지인지</small></h2>
<table>
<colgroup><col style="width:7%"><col style="width:15%"><col style="width:7%"><col style="width:8.5%"><col></colgroup>
<thead><tr><th>기관</th><th>자료</th><th>집계<br>(곳)</th><th>데이터<br>항목</th><th>항목별 개수</th></tr></thead>
<tbody>
{chr(10).join(줄들)}
<tr class="sum"><td colspan="2">합계</td><td class="n">{f(T['사용자'])}</td><td class="n">{f(T['항목'])}</td>
<td></td></tr>
</tbody></table></section>

<section><h2>세는 기준</h2><ul>
<li><b>같은 업체·기관은 한 번만</b> 셌습니다 — 한 업체가 여러 줄에 나와도 업체명·주소·연락처는 1건씩입니다.</li>
<li><b>빈칸 · "-" · 수량 0 · 일련번호 · 똑같이 되풀이된 줄은 세지 않았습니다.</b></li>
<li><b>다른 칸에서 따라 나오는 값은 세지 않았습니다</b> — 가스 이름과 짝인 CAS번호, 두 칸을 더한 '계'.</li>
</ul></section>

<section class="note"><h2 style="border:0;margin-bottom:2pt">숫자를 쓸 때 함께 알아 둘 것</h2><ul>
<li><b>업체명 수가 집계(곳)와 다른 것</b>은 세는 단위가 달라서입니다 — 폐기물처리업체는 허가 1,505건 가운데 업체가 1,110곳,
지자체는 221개 시·군·구의 담당 부서 412곳, 독성가스 취급업체는 주소별 1,579곳입니다.</li>
<li><b>독성가스 취급업체 {f(독['항목'])}건이 전체의 {몫(독['항목'])}%</b>입니다. 원자료로 모아 정리했지만 지금 서비스(방제 물품·장비 찾기)에는 넣지 않은 자료입니다.</li>
<li><b>화학안전공동체</b>는 576곳 가운데 정리 표에 있는 106개 기업(116곳)만 셌습니다. 원본을 받으면 늘어납니다.</li>
<li><b>담당자 실명·휴대전화</b>는 정리 단계에서 지웠으므로 세지 않았습니다.</li>
</ul></section>
<p class="ref">참고 — 원표의 칸을 빈칸만 빼고 모두 세면 {f(T['원표'])}건입니다. 같은 업체 정보가 줄마다 되풀이된 것까지 세는 값이라 위 산정에는 쓰지 않았습니다.</p>
<footer>같은 기준으로 다시 세면 같은 숫자가 나옵니다 — 산정에 쓴 표와 세는 방법을 보관하고 있습니다.</footer>
</body>
</html>
"""
(ROOT/'docs'/'데이터건수_근거.html').write_text(쪽,encoding='utf-8')
print('docs/데이터건수_근거.html 을 썼습니다')

# ── 장비·물품 기록을 '방제물품' 과 '장비·차량' 으로 가르기 ─────────────
# 보고서에 「약 4만 건 중 방제물품 ○건, 장비·차량 ○건」 한 줄을 넣으려고 셉니다
# (2026-10-14 사용자 요청). 위 표의 장비·물품 조각(장비 보유 1,716 · 장비·인력
# 1,291 …)을 ③ 이 쓰는 물품 분류(`방제자원_통합.물품표준`)로 가릅니다.
#   방제물품  = 보호구 · 흡착·중화 · 작업도구
#   장비·차량 = 차량·중장비 · 비상캡슐(ERCV) · 선박(민간방제선박 · 해경 방제정) · 소방 차량
#   어디에도 넣지 않음 = 인력 · 이름으로 못 가른 '기타' · 독성가스 취급 가스(자원이 아님)
# ⚠ 단위는 **보유 기록 건수**입니다(한 곳이 굴착기를 가졌다 = 1건). 실제 대수·개수의
#   합이 아닙니다 — 단위가 제각각이라 더할 수 없습니다.
def 물품장비가르기():
    import collections
    sys_path = str(ROOT / 'build')
    import sys
    if sys_path not in sys.path: sys.path.insert(0, sys_path)
    import 방제자원_통합 as 통
    def 낱줄(rows, key, 줄칸):
        s = set()
        for r in rows:
            t = tuple((c, r[c].strip()) for c in 줄칸 if ok(r[c]))
            if t: s.add((tuple(nm(r[c]) for c in key), t))
        return s
    셈 = collections.Counter()
    r = load('01'); eq = [c for c in r[0] if c not in ('연번','구분','시도','시군구','부서','주소','대표전화','보관장소')]
    for _, t in 낱줄(r, ('시도','시군구','부서'), ['보관장소'] + eq):
        셈.update(통.물품표준(c)[1] for c, _ in t if c in eq)
    for n, key, 줄칸, 이름칸 in (('05', ('업체명','소재지'), ('장비·인력','단위','수량'), '장비·인력'),
                               ('07', ('비축기지',), ('방재장비','단위','수량'), '방재장비')):
        for _, t in 낱줄(load(n), key, 줄칸):
            d = dict(t)
            if 이름칸 in d: 셈[통.물품표준(d[이름칸])[1]] += 1
    r = load('04')
    for y in r:
        y['계(유일한 수량)'] = y['계'] if not (ok(y['컨테이너장비함']) or ok(y['간이방재함'])) else ''
    for _, t in 낱줄(r, ('설치장소','주소'), ('방재장비','단위','컨테이너장비함','간이방재함','계(유일한 수량)')):
        d = dict(t)
        if '방재장비' in d: 셈[통.물품표준(d['방재장비'])[1]] += 1
    셈.update(통.물품표준(y['장비명'])[1] for y in load('09') if ok(y['장비명'], zero=False))
    셈['특수'] += 19; 셈['차량·중장비'] += 2 + 9; 셈['인력'] += 2; 셈['선박'] += 129 + 25
    물품 = 셈['보호구'] + 셈['흡착·중화'] + 셈['작업도구']
    장비 = 셈['차량·중장비'] + 셈['특수'] + 셈['선박']
    print(f"방제물품 {f(물품)}건 (보호구 {f(셈['보호구'])} · 흡착·중화 {f(셈['흡착·중화'])} · 작업도구 {f(셈['작업도구'])})")
    print(f"장비·차량 {f(장비)}건 (차량·중장비 {f(셈['차량·중장비'])} · 비상캡슐 {셈['특수']} · 선박 {셈['선박']})")
    print(f"넣지 않음 — 인력 {셈['인력']} · 기타 {셈['기타']} · 독성가스 취급 가스 {f(독['칸'].get('취급가스물질', 0))}")
    return 물품, 장비

물품장비가르기()
