# -*- coding: utf-8 -*-
"""정리한 표들을 **한 화면에서 훑어볼 수 있는 HTML** 한 장으로 굽는다.

       python3 build/방제자원_보기.py
       → docs/방제자원_정리/한눈에보기.html

   왜 HTML 인가 — 받는 사람이 개발자가 아닙니다. CSV 를 엑셀로 하나씩
   열어 보게 하면 "무엇이 얼마나 있는지"를 파악하는 데만 반나절이 걸립니다.
   파일 하나를 더블클릭하면 표 전부를 오가며 검색까지 되게 합니다.
   인터넷 없이 열려야 하므로 자료를 **파일 안에 그대로 박아** 넣습니다."""
import csv, json, os

여기 = os.path.dirname(os.path.abspath(__file__))
뿌리 = os.path.dirname(여기)
낼곳 = os.path.join(뿌리, 'docs', '방제자원_정리')
표곳 = os.path.join(낼곳, '표')

설명 = {
    '00_원자료_목록.csv': ('원자료 목록', '드라이브에 무엇이 있고 무엇을 읽었는지'),
    '01_지자체_보유방재장비.csv': ('지자체 보유 방재장비', '시·군·구가 직접 가진 차량·보호구·중화제'),
    '02_지자체_보유방재장비_청센터별.csv': ('지자체 보유 방재장비(청센터별)', '위와 같은 자료를 유역청 관할로 묶은 판'),
    '03_지자체_관할_폐기물중장비업체.csv': ('지자체 관할 폐기물·중장비 업체', '사고 때 부를 수 있는 민간 업체'),
    '04_청센터_방제장비함.csv': ('청센터 방제장비함', '산단·고속도로에 실제로 놓여 있는 장비함'),
    '05_사업장_방제물품_화학안전공동체.csv': ('사업장 방제물품', '화학안전공동체 사업장이 자체 보유한 것'),
    '06_독성가스_취급사업장.csv': ('독성가스 취급사업장', '⚠ 자원이 아니라 위험시설 — 사고가 날 수 있는 곳'),
    '07_해경_광역방제지원센터_비축물자.csv': ('해경 비축물자', '항만 3곳의 대량 비축'),
    '08_해경_화학방제정.csv': ('해경 화학방제정', '해상 화학사고에 나가는 선박 25척'),
    '09_수질오염방제센터_보유장비.csv': ('수질오염방제센터 장비', '4개 권역 · Level C 보호구 포함'),
    '10_ERaCV_비상캡슐_보유업체.csv': ('ERaCV 비상캡슐', '누출 봄베를 담아 옮기는 캡슐'),
    '11_중합방지제_판매업체.csv': ('중합방지제 판매업체', '중합 폭주를 막는 약품'),
    '12_지정폐기물_처리업체_유역청별_건수.csv': ('지정폐기물(유역청 건수)', '양식이 달라 건수로만 정리'),
    '13_지정폐기물_대구청.csv': ('지정폐기물 · 대구청', '유역청 회신본 — 대구청만 행 단위'),
    '14_폐기물처리업체_전국취합.csv': ('폐기물처리업체 (전국취합)', '★ 시도·시군구가 나뉜 가장 깔끔한 자료'),
    '15_전남광주_방제약품_판매업체.csv': ('전남·광주 방제약품 판매업체', "⚠ 자료 기준이 '17년"),
    '16_전국_독성가스_회수업체.csv': ('전국 독성가스 회수업체', '자료에 원래 두 곳뿐'),
    '99_개인정보_제거현황.csv': ('개인정보 제거 현황', '공개판에서 걷어낸 것'),
}

표들 = []
for 파일 in sorted(os.listdir(표곳)):
    if not 파일.endswith('.csv'):
        continue
    with open(os.path.join(표곳, 파일), encoding='utf-8-sig') as f:
        r = list(csv.reader(f))
    이름, 한줄 = 설명.get(파일, (파일, ''))
    표들.append({'파일': 파일, '이름': 이름, '설명': 한줄, '머리': r[0], '행': r[1:]})

통계 = json.load(open(os.path.join(낼곳, '통계.json'), encoding='utf-8'))

카드 = [
    ('지도에 찍을 수 있는 지점', '1,947', '주소·전화가 있는 곳 (중복 제외)'),
    ('지금 서비스에 있는 것', '470', '2026-08-11 기준 · 약 4.1배가 됩니다'),
    ('못 읽은 파일', '1', '155MB PDF 한 권 — 나머지는 hwp 까지 전부 읽었습니다'),
    ('걷어낸 개인정보', '7,491', '실명 2,719 · 휴대전화 495 · 사업자번호 4,277'),
]

HTML = u"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>방제자원 원자료 정리</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap">
<style>
  /* 색 이름은 밝은 :root 에 **전부** 두고, 어두운 화면에서는 값만 갈아
     끼웁니다. 한쪽에만 정의하면 다른 모드에서 그 줄이 통째로 버려집니다
     (CLAUDE.md 3절에 적어 둔, 실제로 겪었던 함정). */
  :root{--ink:#12181f;--ink2:#4a5563;--ink3:#78838f;--line:#dfe5eb;--line2:#eef2f6;
    --bg:#f4f6f9;--card:#fff;--blue:#256ef4;--blue-d:#0b50d0;--blue-l:#ecf2fe;
    --red:#de3412;--red-l:#fdeeeb;--amber-l:#fff6e0;--amber:#8a5c00;
    --head1:#2f7cf6;--head2:#0b50d0;--thbg:#f7f9fb}
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --ink:#eef2f6;--ink2:#c3ccd6;--ink3:#98a3ae;--line:#39434e;--line2:#2a323c;
      --bg:#12171d;--card:#1a212a;--blue:#7ba7f8;--blue-d:#a8c4fb;--blue-l:#1d2a3f;
      --red:#ff8b78;--red-l:#3a1f1a;--amber-l:#3a2f16;--amber:#e8c06a;
      --head1:#1d4ea8;--head2:#0a3a90;--thbg:#222b35}
  }
  :root[data-theme="dark"]{
    --ink:#eef2f6;--ink2:#c3ccd6;--ink3:#98a3ae;--line:#39434e;--line2:#2a323c;
    --bg:#12171d;--card:#1a212a;--blue:#7ba7f8;--blue-d:#a8c4fb;--blue-l:#1d2a3f;
    --red:#ff8b78;--red-l:#3a1f1a;--amber-l:#3a2f16;--amber:#e8c06a;
    --head1:#1d4ea8;--head2:#0a3a90;--thbg:#222b35}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);word-break:keep-all;
    font:15px/1.6 "Pretendard GOV",Pretendard,"Noto Sans KR",-apple-system,
    BlinkMacSystemFont,"Malgun Gothic","맑은 고딕",system-ui,sans-serif}
  header{background:linear-gradient(135deg,var(--head1),var(--head2));color:#fff;padding:26px 28px 22px}
  header h1{margin:0 0 4px;font-size:23px;letter-spacing:-.02em}
  header p{margin:0;opacity:.9;font-size:14px}
  .cards{display:flex;gap:12px;flex-wrap:wrap;padding:18px 28px 4px}
  .c{flex:1 1 190px;background:var(--card);border:1px solid var(--line);
    border-radius:10px;padding:14px 16px}
  .c b{display:block;font-size:27px;letter-spacing:-.02em;color:var(--blue-d);line-height:1.15}
  .c .t{font-size:13px;font-weight:700;margin-bottom:2px}
  .c .s{font-size:12px;color:var(--ink3);margin-top:4px;line-height:1.45}
  .wrap{display:flex;gap:18px;padding:18px 28px 40px;align-items:flex-start}
  nav{flex:none;width:270px;position:sticky;top:14px}
  nav button{display:block;width:100%;text-align:left;background:var(--card);
    border:1px solid var(--line);border-radius:8px;padding:9px 11px;margin-bottom:6px;
    cursor:pointer;font:inherit;font-size:13.5px;color:var(--ink)}
  nav button:hover{border-color:var(--blue);background:var(--blue-l)}
  nav button[aria-current=true]{border-color:var(--blue-d);background:var(--blue-l);font-weight:700}
  nav button .n{float:right;color:var(--ink3);font-weight:400;font-size:12.5px}
  nav button.warn{background:var(--red-l);border-color:var(--red)}
  main{flex:1;min-width:0;background:var(--card);border:1px solid var(--line);
    border-radius:12px;padding:18px 20px}
  h2{margin:0 0 3px;font-size:19px;letter-spacing:-.01em}
  .sub{margin:0 0 14px;color:var(--ink2);font-size:13.5px}
  .bar{display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
  input[type=search]{flex:1;min-width:200px;padding:9px 12px;border:1px solid var(--line);
    border-radius:8px;font:inherit;font-size:14px}
  .cnt{font-size:13px;color:var(--ink3)}
  .tw{overflow:auto;max-height:70vh;border:1px solid var(--line2);border-radius:8px}
  table{border-collapse:collapse;font-size:13px;width:100%;font-variant-numeric:tabular-nums}
  th,td{border-bottom:1px solid var(--line2);padding:6px 9px;text-align:left;
    vertical-align:top;white-space:pre-wrap}
  th{position:sticky;top:0;background:var(--thbg);font-weight:700;white-space:nowrap;z-index:1}
  tbody tr:hover{background:var(--blue-l)}
  td{max-width:380px}
  .more{margin-top:10px;text-align:center}
  .more button{padding:8px 16px;border:1px solid var(--line);background:var(--card);
    border-radius:8px;cursor:pointer;font:inherit;font-size:13.5px}
  .note{background:var(--amber-l);border-left:3px solid var(--amber);padding:9px 12px;
    border-radius:0 6px 6px 0;font-size:13px;margin-bottom:12px;color:var(--ink)}
  .note.red{background:var(--red-l);border-left-color:var(--red);color:var(--ink)}
  footer{padding:0 28px 34px;color:var(--ink3);font-size:12.5px}
</style></head><body>

<header>
  <h1>방제자원 원자료 정리</h1>
  <p>구글드라이브 <b>방제자원_전체</b> 폴더 → 표 18개 · 자료 9,226행 ·
     서비스에는 아직 반영하지 않았습니다</p>
</header>

<div class="cards">%(카드)s</div>

<div class="wrap">
  <nav id="nav"></nav>
  <main>
    <h2 id="tName"></h2>
    <p class="sub" id="tDesc"></p>
    <div id="tNote"></div>
    <div class="bar">
      <input type="search" id="q" placeholder="이 표 안에서 찾기 — 업체명·주소·장비 무엇이든">
      <span class="cnt" id="cnt"></span>
    </div>
    <div class="tw"><table><thead><tr id="th"></tr></thead><tbody id="tb"></tbody></table></div>
    <div class="more"><button id="more" hidden>더 보기</button></div>
  </main>
</div>

<footer>
  업무 참고자료 · 개인정보(담당자 실명·휴대전화·사업자등록번호)는 걷어낸 판입니다 ·
  자료 기준일은 기관마다 다릅니다(원자료 목록 참고)
</footer>

<script>
var 표 = %(자료)s;
var 지금 = 0, 보인수 = 0, 한번에 = 300, 걸린 = [];

function 그리기(i, 새로) {
  var t = 표[i];
  document.getElementById('tName').textContent = t.이름;
  document.getElementById('tDesc').textContent = t.설명 + '  ·  ' + t.행.length + '행  ·  ' + t.파일;
  var 경고 = document.getElementById('tNote');
  경고.innerHTML = t.경고 ? '<div class="note' + (t.빨강 ? ' red' : '') + '">' + t.경고 + '</div>' : '';

  var th = document.getElementById('th');
  th.innerHTML = '';
  for (var c = 0; c < t.머리.length; c++) {
    var e = document.createElement('th');
    e.textContent = t.머리[c];
    th.appendChild(e);
  }
  if (새로) { 걸린 = 거르기(t); 보인수 = 0; document.getElementById('tb').innerHTML = ''; }
  더();
}

function 거르기(t) {
  var q = document.getElementById('q').value.trim().toLowerCase();
  if (!q) return t.행;
  var 낸다 = [];
  for (var r = 0; r < t.행.length; r++) {
    if (t.행[r].join(' ').toLowerCase().indexOf(q) >= 0) 낸다.push(t.행[r]);
  }
  return 낸다;
}

function 더() {
  var tb = document.getElementById('tb'), 끝 = Math.min(보인수 + 한번에, 걸린.length);
  for (var r = 보인수; r < 끝; r++) {
    var tr = document.createElement('tr');
    for (var c = 0; c < 걸린[r].length; c++) {
      var td = document.createElement('td');
      td.textContent = 걸린[r][c];
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
  보인수 = 끝;
  document.getElementById('cnt').textContent = 걸린.length + '행 중 ' + 보인수 + '행 보는 중';
  document.getElementById('more').hidden = 보인수 >= 걸린.length;
}

function 고르기(i) {
  지금 = i;
  var bs = document.getElementById('nav').getElementsByTagName('button');
  for (var k = 0; k < bs.length; k++) bs[k].setAttribute('aria-current', k === i ? 'true' : 'false');
  document.getElementById('q').value = '';
  그리기(i, true);
}

(function () {
  var nav = document.getElementById('nav');
  for (var i = 0; i < 표.length; i++) {
    (function (i) {
      var b = document.createElement('button');
      if (표[i].빨강) b.className = 'warn';
      b.innerHTML = '<span class="n">' + 표[i].행.length + '</span>' + 표[i].이름;
      b.onclick = function () { 고르기(i); };
      nav.appendChild(b);
    })(i);
  }
  document.getElementById('q').oninput = function () { 그리기(지금, true); };
  document.getElementById('more').onclick = 더;
  고르기(1);   /* 원자료 목록보다 실제 자원 표를 먼저 보여 준다 */
})();
</script>
</body></html>
"""

경고문 = {
    '06_독성가스_취급사업장.csv': ('이 표는 <b>방제자원이 아닙니다.</b> 사고가 <b>날 수 있는</b> '
                              '사업장 목록입니다. 자원 목록에 섞으면 "여기 가면 도움받는다"로 '
                              '잘못 읽힙니다.', True),
    '12_지정폐기물_처리업체_유역청별_건수.csv': ('유역청 7곳이 서로 다른 양식으로 내서 '
                                     '<b>건수로만</b> 정리했습니다. 대구청만 행 단위 자료를 받아 '
                                     '옆의 <b>13</b>번 표로 따로 있습니다 — 나머지 6곳도 그 모양으로 '
                                     '받으면 바로 넣을 수 있습니다.', False),
    '13_지정폐기물_대구청.csv': ('유역청 회신본 가운데 <b>행 단위로 확보한 유일한 자료</b>입니다. '
                          '대표자 성명 239건은 걷어냈습니다. 소재지 표기가 '
                          '‘경북/대구시/대구/대구광역시’로 섞여 있습니다.', False),
    '14_폐기물처리업체_전국취합.csv': ('<b>지금까지 본 것 중 가장 깔끔한 자료</b>입니다 — '
                              '시·도와 시·군·구가 이미 나뉘어 있고 전화번호가 99.8% 있습니다. '
                              '1,505줄이지만 한 업체가 업종 여러 개로 나뉘어 있어 '
                              '<b>실제 지점은 1,123곳</b>입니다.', False),
    '15_전남광주_방제약품_판매업체.csv': ('⚠ 자료 기준이 <b>2017년</b>입니다 — 9년 지난 자료라 '
                                '연락처와 재고를 반드시 확인해야 합니다. '
                                '방제약품 7곳 + 크레인 4곳.', False),
    '16_전국_독성가스_회수업체.csv': ('지금 서비스의 ‘가스 회수’ 갈래가 2건인 것은 '
                            '<b>자료에 원래 두 곳뿐</b>이기 때문입니다(파일을 못 읽어서가 아님). '
                            '연락처는 원자료에 비어 있습니다.', False),
    '02_지자체_보유방재장비_청센터별.csv': ('앞의 <b>01</b>과 같은 자료를 유역청 관할로 묶은 판입니다. '
                                 '7개 센터만 들어 있어 전국판(01)이 더 완전합니다.', False),
    '99_개인정보_제거현황.csv': ('원자료에 있던 것을 걷어낸 내역입니다. '
                          '원본과 대조할 때 쓰세요.', False),
    '00_원자료_목록.csv': ('<b>못 읽은 파일</b>이 어떤 것인지 여기 적혀 있습니다 — '
                      'hwp·hwpx 6건, 구형식 xls 1건, 155MB PDF 1건.', False),
}

for t in 표들:
    경, 빨 = 경고문.get(t['파일'], ('', False))
    t['경고'] = 경
    t['빨강'] = 빨

카드HTML = ''.join(
    '<div class="c"><div class="t">%s</div><b>%s</b><div class="s">%s</div></div>'
    % (t, v, s) for t, v, s in 카드)

낼 = os.path.join(낼곳, '한눈에보기.html')
# %(…)s 치환을 쓰지 않습니다 — CSS 의 `width:100%` 같은 퍼센트가 형식문자로
# 잘못 읽혀 터집니다. 자리표시자만 바꿔 끼웁니다.
쪽 = (HTML.replace('%(카드)s', 카드HTML)
        .replace('%(자료)s', json.dumps(표들, ensure_ascii=False, separators=(',', ':'))))
with open(낼, 'w', encoding='utf-8') as f:
    f.write(쪽)
print('→ %s  (%.1f MB)' % (낼, os.path.getsize(낼) / 1024 / 1024))
