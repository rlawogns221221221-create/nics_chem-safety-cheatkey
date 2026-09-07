# -*- coding: utf-8 -*-
"""
통합 결과를 눌러 보는 검토 페이지 — `통합/한눈에보기.html`

사용자는 CSV 를 열어 1,582행·4,075행을 눈으로 훑을 수 없습니다.
분류안이 원한 두 가지를 **실제로 그렇게 쓸 수 있는지** 여기서 확인합니다.

    ① 업체 섭외 — 갈래·권역을 고르면 그 업체만. 허가·처리가능폐기물·연락처·주소
    ② 방제물품 — **물품 이름을 고르면 그것만.** 개수·보유처·연락처·주소

검토용이므로 배포에 들어가지 않습니다. 서비스 자료(`data/`)도 건드리지
않습니다 — 이 페이지에서 확인한 뒤에 ③ 도구에 넣습니다.

    python3 build/방제자원_통합_보기.py
"""

import csv
import json
import os

뿌리 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
통합 = os.path.join(뿌리, "docs", "방제자원_정리", "통합")


def 읽기(파일):
    길 = os.path.join(통합, 파일)
    if not os.path.exists(길):
        return []
    with open(길, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


권역차례 = ["수도권", "강원권역", "충청권역", "경상권역", "전라권역"]


def main():
    업체 = 읽기("업체.csv")
    물품 = 읽기("물품.csv")
    미분류 = 읽기("물품_미분류이름.csv")
    with open(os.path.join(통합, "통계.json"), encoding="utf-8") as f:
        통계 = json.load(f)

    # 화면으로 넘기는 자료 — 열 이름을 짧게 줄여 파일을 작게 만듭니다
    업체칸 = ["갈래", "업체명", "권역", "시도", "시군구", "주소", "대표전화",
           "허가현황", "처리가능폐기물", "보유장비", "협의권역", "확인못함",
           "자료출처"]
    물품칸 = ["물품명", "분류", "원래이름", "개수", "단위", "보유처", "보유처종류",
           "권역", "시도", "시군구", "주소", "대표전화", "자료출처"]
    자료 = {
        "업체칸": 업체칸,
        "업체": [[r.get(k, "") for k in 업체칸] for r in 업체],
        "물품칸": 물품칸,
        "물품": [[r.get(k, "") for k in 물품칸] for r in 물품],
        "미분류": [[r.get("원래이름", ""), r.get("줄수", "")] for r in 미분류],
        "통계": 통계,
    }

    # ⚠ `%` 로 끼워 넣지 않습니다 — 스타일시트에 `100%` 같은 값이 있어
    #   파이썬 서식 문자열이 그것을 자리표로 잘못 읽습니다.
    html = 틀.replace("/*__자료__*/",
                     json.dumps(자료, ensure_ascii=False, separators=(",", ":")))
    낼길 = os.path.join(통합, "한눈에보기.html")
    with open(낼길, "w", encoding="utf-8") as f:
        f.write(html)
    print("  %s  (%.0f KB)" % (os.path.relpath(낼길, 뿌리),
                              os.path.getsize(낼길) / 1024))
    print("  업체 %d곳 · 물품 %d줄" % (len(업체), len(물품)))


틀 = r"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>방제자원 통합 검토 — 업체 섭외 · 방제물품</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%23256ef4'/><circle cx='32' cy='32' r='9' fill='none' stroke='%23fff' stroke-width='4'/><circle cx='32' cy='32' r='2.5' fill='%23fff'/></svg>">
<style>
 :root{
   color-scheme: light dark;
   --bg:#eef1f5; --surface:#fff; --sunk:#f7f9fb; --line:#d5dce3; --line2:#e8edf1;
   --ink:#12181f; --ink2:#4a5563; --ink3:#78838f;
   --brand:#256ef4; --brand-t:#0b50d0; --brand-l:#ecf2fe;
   --ok:#267337; --ok-l:#eaf6ec; --wait:#8a5c00; --wait-l:#fff3db;
   --err:#bd2c0f; --err-l:#fdefec;
   --on-brand:#fff;
 }
 @media (prefers-color-scheme: dark){ :root:not([data-t="light"]){
   --bg:#0f141a; --surface:#181e26; --sunk:#141a21; --line:#2c343e; --line2:#232a33;
   --ink:#e6ebf1; --ink2:#a3aeba; --ink3:#7c8794;
   --brand:#86aff9; --brand-t:#b1cefb; --brand-l:#052561;
   --ok:#5cbb8d; --ok-l:#12261d; --wait:#d9a253; --wait-l:#2a2013;
   --err:#f48771; --err-l:#2a1310; --on-brand:#0f141a;
 }}
 *{box-sizing:border-box}
 body{margin:0;padding:clamp(16px,4vw,36px);background:var(--bg);color:var(--ink);
   font-family:"Pretendard GOV","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;
   font-size:15px;line-height:1.65;word-break:keep-all}
 .page{max-width:1240px;margin:0 auto}
 h1{margin:0 0 6px;font-size:clamp(21px,3.6vw,27px);line-height:1.3;letter-spacing:-.02em}
 .lede{margin:0 0 18px;color:var(--ink2);font-size:14.5px;max-width:76ch}
 .lede b{color:var(--ink)}

 /* 두 갈래 고르기 */
 .two{display:grid;gap:10px;grid-template-columns:1fr;margin:0 0 18px}
 @media (min-width:680px){ .two{grid-template-columns:1fr 1fr} }
 .two button{display:flex;flex-direction:column;gap:3px;align-items:flex-start;
   padding:14px 16px;border:2px solid var(--line);border-radius:10px;
   background:var(--surface);color:inherit;font:inherit;cursor:pointer;text-align:left;
   transition:border-color .15s,background .15s}
 .two button:hover{border-color:var(--brand)}
 .two button[aria-pressed=true]{border-color:var(--brand);background:var(--brand-l)}
 .two b{font-size:17px}
 .two span{color:var(--ink2);font-size:13px}

 /* 조건 줄 */
 .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}
 .bar input[type=search]{flex:1 1 240px;min-width:0;height:40px;padding:0 12px;
   border:1px solid var(--line);border-radius:6px;background:var(--surface);
   color:inherit;font:inherit;font-size:14px}
 .bar select{height:40px;padding:0 8px;border:1px solid var(--line);border-radius:6px;
   background:var(--surface);color:inherit;font:inherit;font-size:14px}
 .chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
 .chips button{padding:6px 12px;border:1px solid var(--line);border-radius:999px;
   background:var(--surface);color:var(--ink2);font:inherit;font-size:13px;cursor:pointer}
 .chips button:hover{border-color:var(--brand);color:var(--brand-t)}
 .chips button[aria-pressed=true]{background:var(--brand);border-color:var(--brand);
   color:var(--on-brand);font-weight:600}
 .chips button i{font-style:normal;opacity:.7;margin-left:4px}

 .count{margin:0 0 10px;color:var(--ink2);font-size:13.5px}
 .count b{color:var(--ink)}

 /* 목록 */
 .rows{display:flex;flex-direction:column;border:1px solid var(--line);
   border-radius:8px;background:var(--surface);overflow:hidden}
 .row{padding:12px 15px;border-top:1px solid var(--line2)}
 .row:first-child{border-top:0}
 .row .t{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline}
 .row .nm{font-weight:600;font-size:15.5px}
 .row .tag{font-size:11.5px;font-weight:600;padding:1px 8px;border-radius:3px;
   background:var(--brand-l);color:var(--brand-t);white-space:nowrap}
 .row .tag.ok{background:var(--ok-l);color:var(--ok)}
 .row .n{font-family:ui-monospace,monospace;font-size:13px;color:var(--ink2);
   font-variant-numeric:tabular-nums;white-space:nowrap}
 .row .m{margin:3px 0 0;color:var(--ink2);font-size:13.5px}
 .row .waste{margin:5px 0 0;padding:7px 10px;background:var(--sunk);
   border-radius:5px;font-size:13px;line-height:1.55}
 .row .waste b{color:var(--ink)}
 .row .none{color:var(--wait);font-size:12.5px}
 .row a{color:var(--brand-t);text-decoration:none;font-weight:600}
 .row a:hover{text-decoration:underline}
 .row .src{color:var(--ink3);font-size:11.5px;margin-top:4px}
 .more{margin:12px 0 0;text-align:center}
 .more button{height:44px;padding:0 22px;border:1px solid var(--brand);
   border-radius:6px;background:var(--surface);color:var(--brand-t);
   font:inherit;font-weight:600;cursor:pointer}

 /* 알림 */
 .note{border:1px solid var(--line);border-left:3px solid var(--wait);
   border-radius:0 8px 8px 0;background:var(--sunk);padding:13px 16px;
   margin:0 0 18px;font-size:13.5px;color:var(--ink2)}
 .note h2{margin:0 0 6px;font-size:14px;color:var(--ink)}
 .note p{margin:0 0 6px}
 .note p:last-child{margin:0}
 .note code{font-family:ui-monospace,monospace;font-size:12.5px;
   background:var(--surface);border:1px solid var(--line2);border-radius:3px;padding:1px 5px}
 .stat{display:flex;flex-wrap:wrap;gap:5px 16px;margin:0 0 16px;
   font-family:ui-monospace,monospace;font-size:12.5px;color:var(--ink3)}
 .stat b{color:var(--ink2);font-weight:500}
 footer{margin:26px 0 0;padding-top:14px;border-top:1px solid var(--line);
   color:var(--ink3);font-size:12px}
</style>
</head>
<body>
<div class="page">

<h1>방제자원 통합 검토 — 업체 섭외 · 방제물품</h1>
<p class="lede">보내 주신 <b>분류안(PPT)</b> 대로 표 18개를 <b>두 갈래</b>로 다시
 묶은 결과입니다. 여기서 확인하신 뒤에 도구(③)에 넣습니다 —
 <b>서비스 자료는 아직 건드리지 않았습니다.</b>
 <b>물품은 이름을 눌러 그것만</b> 볼 수 있는지, <b>업체는 허가·처리가능
 폐기물·연락처·주소</b>가 한 줄로 보이는지 봐 주세요.</p>

<div class="stat" id="stat"></div>

<div class="two">
  <button id="b업체" aria-pressed="true">
    <b>① 업체 섭외</b><span id="s업체"></span></button>
  <button id="b물품" aria-pressed="false">
    <b>② 방제물품 찾기</b><span id="s물품"></span></button>
</div>

<div id="알림"></div>

<div class="chips" id="갈래"></div>
<div class="bar">
  <input type="search" id="찾기" placeholder="업체명 · 물품 이름 · 주소로 찾기">
  <select id="권역"></select>
  <select id="시도"></select>
</div>
<p class="count" id="셈"></p>
<div class="rows" id="목록"></div>
<div class="more" id="더"></div>

<footer>
  기계 생성 — <code>build/방제자원_통합.py</code> →
  <code>build/방제자원_통합_보기.py</code> · 검토용이라 배포에 들어가지 않습니다.
</footer>
</div>

<script>
var D = /*__자료__*/;
var 업체칸 = D.업체칸, 물품칸 = D.물품칸;
function 칸(칸들, 이름){ return 칸들.indexOf(이름); }

var 지금 = "업체";
var 고른갈래 = "";
var 보인수 = 60;

var 권역차례 = ["수도권","강원권역","충청권역","경상권역","전라권역"];

/* ── 통계 줄 ─────────────────────────────────────────────── */
(function(){
  var s = D.통계;
  document.getElementById("stat").innerHTML =
    "<span><b>업체</b> " + s.업체.전체 + "곳</span>" +
    "<span><b>물품</b> " + s.물품.전체 + "줄 · 이름 " + s.물품.물품명수 + "가지</span>" +
    "<span><b>처리가능 폐기물 있음</b> " + s.업체.처리가능폐기물_있음 + "곳</span>" +
    "<span><b>협의 완료</b> " + s.업체.협의완료 + "줄</span>" +
    "<span><b>연락처 없음</b> 업체 " + s.업체.전화없음 + " · 물품 " + s.물품.전화없음 + "</span>";
  document.getElementById("s업체").textContent =
    "폐기물 5갈래 + 중장비 · " + s.업체.전체 + "곳";
  document.getElementById("s물품").textContent =
    "표준 이름 " + s.물품.물품명수 + "가지 · " + s.물품.전체 + "줄";
})();

/* ── 알림 — 못 채운 것을 숨기지 않습니다 ──────────────────── */
function 알림그리기(){
  var s = D.통계, h = "";
  if (지금 === "업체") {
    h = '<div class="note"><h2>업체 — 무엇이 채워졌고 무엇이 남았나</h2>' +
      '<p><b>보내 주신 허가증 24건을 눈으로 읽어 표로 만들었습니다</b>(협의 완료 ' +
      '업체 19곳 · ' + s.업체.협의완료 + '줄). 스캔 이미지라 글자를 뽑아낼 수 ' +
      '없어 쪽마다 그림으로 확인했습니다. <b>협의 완료</b> 딱지가 붙은 줄이 ' +
      '그것이고, 분류안의 필수 네 항목이 다 채워진 유일한 자료입니다.</p>' +
      '<p><b>‘중간처분(중화)’ 가 확인되었습니다</b> — (주)엔아이티의 ' +
      '<b>지정폐기물 중간처분업(화학적 처분)</b> 허가증에 처리가능 폐기물이 ' +
      '<b>폐산·폐알칼리</b>로 적혀 있습니다. 전국취합 자료만으로는 못 가려내던 ' +
      '갈래였습니다(처리방법 값에 ‘중화’가 없습니다).</p>' +
      '<p><b>독성가스</b>는 말씀대로 <b>업체 섭외의 한 칸</b>으로 올렸습니다.</p>' +
      '<p><b>아직 ' + s.업체.처리가능폐기물_없음_필수갈래 + '줄에 처리가능 ' +
      '폐기물이 없습니다.</b> 그 목록이 들어 있는 자료는 표 03·13·17 뿐이고, ' +
      '가장 넓은 <b>전국취합본(1,511행)에는 그 칸이 아예 없습니다.</b> ' +
      '허가증에도 <b>“붙임 참조”로만 적힌 것이 12건</b> 있어(분량이 최대 39쪽) ' +
      '그 줄은 <b>허가 종류만</b> 적었습니다 — 말씀하신 대로입니다.</p>' +
      '<p><b>폐수 수탁처리 4곳</b>(유니큰 온산공장 · 공공폐수처리시설 3곳)은 ' +
      '폐기물 여섯 갈래에 안 들어갑니다. 물환경보전법 허가인데 <b>폐산·알카리 ' +
      '폐수를 받는 곳</b>이라 빼지 않고 따로 칸을 두었습니다 — 어디에 넣을지 ' +
      '정해 주세요.</p></div>';
  } else {
    h = '<div class="note"><h2>물품 — 이름을 어떻게 묶었나</h2>' +
      '<p>원자료의 물품 이름이 <b>한 표에서만 484가지</b>였습니다. 그대로 두면 ' +
      '“딱 원하는 물품만” 고를 수가 없습니다 — 방독면을 찾는 사람이 ' +
      '전면형마스크·반면형마스크·방독마스크를 따로 눌러야 합니다. ' +
      '<b>표준 이름 ' + s.물품.물품명수 + '가지</b>로 묶고 <b>원래 이름은 각 줄에 ' +
      '함께 남겼습니다</b> — 급할 때 필요한 것은 원문입니다.</p>' +
      '<p><b>못 묶은 이름 ' + s.물품.미분류이름수 + '가지(' +
      D.통계.물품.분류별.기타 + '줄)</b>는 원자료 자체가 뭉뚱그린 것입니다 ' +
      '(“방제장비”·“소형”·“처리능력”·“물 적재량”). <b>기타</b>로 두었습니다.</p>' +
      '<p><b>담당자 연락처는 대표번호·부서번호만</b> 넣었습니다. 개인 휴대전화는 ' +
      '기계가 검사해 하나라도 있으면 파일을 만들지 않습니다. 확인 못 한 곳은 ' +
      '<b>기관·업체명만 적고 번호는 비웠습니다</b>(' + s.물품.전화없음 + '줄).</p>' +
      '<p><b>개수를 모르는 줄이 ' + s.물품.개수모름 + '개</b> 있습니다 — 원자료에 ' +
      '수량 칸이 없던 것이라 “-” 로 둡니다. 표 15(전남·광주 방제약품)는 ' +
      '<b>자료 기준이 2017년</b>입니다.</p></div>';
  }
  document.getElementById("알림").innerHTML = h;
}

/* ── 갈래 칩 ─────────────────────────────────────────────── */
function 갈래목록(){
  var 칸번 = 지금 === "업체" ? 칸(업체칸, "갈래") : 칸(물품칸, "물품명");
  var 줄들 = 지금 === "업체" ? D.업체 : D.물품;
  var 셈 = {}, 차례 = [];
  for (var i = 0; i < 줄들.length; i++) {
    var v = 줄들[i][칸번] || "(빈칸)";
    if (셈[v] === undefined) { 셈[v] = 0; 차례.push(v); }
    셈[v]++;
  }
  if (지금 === "업체") {
    var 정 = ["수집·운반","중간처분(소각)","중간처분(그 외)","종합재활용",
              "최종처분(매립)","중장비","특수처리","기타"];
    차례.sort(function(a,b){ return 정.indexOf(a) - 정.indexOf(b); });
  } else {
    /* 물품은 **분류 → 건수** 차례로. 급할 때 눌러야 하는 것이 위에 옵니다 */
    var 분류칸 = 칸(물품칸, "분류");
    var 분류of = {};
    for (var j = 0; j < D.물품.length; j++) 분류of[D.물품[j][칸번]] = D.물품[j][분류칸];
    var 분정 = ["보호구","흡착·중화","차량·중장비","작업도구","인력","특수","기타"];
    차례.sort(function(a,b){
      var d = 분정.indexOf(분류of[a]) - 분정.indexOf(분류of[b]);
      return d !== 0 ? d : 셈[b] - 셈[a];
    });
  }
  return 차례.map(function(v){ return [v, 셈[v]]; });
}

function 칩그리기(){
  var 목록 = 갈래목록(), h = "";
  h += '<button data-v="" aria-pressed="' + (고른갈래 === "" ? "true" : "false") +
       '">전체<i>' + (지금 === "업체" ? D.업체.length : D.물품.length) + '</i></button>';
  for (var i = 0; i < 목록.length; i++) {
    h += '<button data-v="' + 목록[i][0].replace(/"/g,"&quot;") + '" aria-pressed="' +
         (고른갈래 === 목록[i][0] ? "true" : "false") + '">' +
         목록[i][0] + '<i>' + 목록[i][1] + '</i></button>';
  }
  var 통 = document.getElementById("갈래");
  통.innerHTML = h;
  var bs = 통.getElementsByTagName("button");
  for (var k = 0; k < bs.length; k++) {
    bs[k].onclick = function(){
      고른갈래 = this.getAttribute("data-v"); 보인수 = 60; 칩그리기(); 그리기();
    };
  }
}

/* ── 권역 · 시도 고르기 ──────────────────────────────────── */
function 골라채우기(){
  var 줄들 = 지금 === "업체" ? D.업체 : D.물품;
  var 칸들 = 지금 === "업체" ? 업체칸 : 물품칸;
  var 권칸 = 칸(칸들, "권역"), 시칸 = 칸(칸들, "시도");
  var 권 = document.getElementById("권역"), 시 = document.getElementById("시도");
  var 있는권 = {}, 있는시 = {};
  for (var i = 0; i < 줄들.length; i++) {
    if (줄들[i][권칸]) 있는권[줄들[i][권칸]] = 1;
    if (줄들[i][시칸]) 있는시[줄들[i][시칸]] = 1;
  }
  var h = '<option value="">권역 전체</option>';
  for (var j = 0; j < 권역차례.length; j++)
    if (있는권[권역차례[j]]) h += '<option>' + 권역차례[j] + '</option>';
  권.innerHTML = h;
  var 시목록 = Object.keys(있는시).sort();
  var h2 = '<option value="">시·도 전체</option>';
  for (var k = 0; k < 시목록.length; k++) h2 += '<option>' + 시목록[k] + '</option>';
  시.innerHTML = h2;
}

/* ── 목록 그리기 ─────────────────────────────────────────── */
function 걸러내기(){
  var 줄들 = 지금 === "업체" ? D.업체 : D.물품;
  var 칸들 = 지금 === "업체" ? 업체칸 : 물품칸;
  var 갈칸 = 지금 === "업체" ? 칸(칸들, "갈래") : 칸(칸들, "물품명");
  var 권칸 = 칸(칸들, "권역"), 시칸 = 칸(칸들, "시도");
  var 말 = document.getElementById("찾기").value.trim().toLowerCase();
  var 권 = document.getElementById("권역").value;
  var 시 = document.getElementById("시도").value;
  var 남 = [];
  for (var i = 0; i < 줄들.length; i++) {
    var r = 줄들[i];
    if (고른갈래 && (r[갈칸] || "(빈칸)") !== 고른갈래) continue;
    if (권 && r[권칸] !== 권) continue;
    if (시 && r[시칸] !== 시) continue;
    if (말 && r.join(" ").toLowerCase().indexOf(말) < 0) continue;
    남.push(r);
  }
  return 남;
}

function 전화(v){
  if (!v) return '<span class="none">연락처 확인 못 함 — 기관·업체명만</span>';
  return '<a href="tel:' + v.replace(/[^0-9]/g,"") + '">' + v + '</a>';
}
function 곳(r, 칸들){
  var g = [r[칸(칸들,"권역")], r[칸(칸들,"시도")], r[칸(칸들,"시군구")]];
  var o = [];
  for (var i=0;i<g.length;i++) if (g[i] && o.indexOf(g[i])<0) o.push(g[i]);
  return o.join(" · ") || "지역 확인 못 함";
}

function 그리기(){
  var 남 = 걸러내기();
  var 칸들 = 지금 === "업체" ? 업체칸 : 물품칸;
  document.getElementById("셈").innerHTML =
    "<b>" + 남.length + "</b>" + (지금 === "업체" ? "곳" : "줄") +
    (고른갈래 ? " · " + 고른갈래 : "");
  var h = "", 끝 = Math.min(보인수, 남.length);
  for (var i = 0; i < 끝; i++) {
    var r = 남[i];
    if (지금 === "업체") {
      h += '<div class="row"><div class="t">' +
        '<span class="tag">' + r[칸(칸들,"갈래")] + '</span>' +
        '<span class="nm">' + r[칸(칸들,"업체명")] + '</span>' +
        (r[칸(칸들,"협의권역")] ? '<span class="tag ok">협의 완료 · ' +
          r[칸(칸들,"협의권역")] + '</span>' : "") +
        '<span class="n">' + 전화(r[칸(칸들,"대표전화")]) + '</span></div>' +
        '<p class="m">' + 곳(r, 칸들) + ' · ' +
        (r[칸(칸들,"주소")] || "주소 없음") + '</p>' +
        '<p class="m">허가 — ' + (r[칸(칸들,"허가현황")] || "확인 못 함") + '</p>' +
        (r[칸(칸들,"보유장비")] ?
          '<p class="m">보유 장비 — ' + r[칸(칸들,"보유장비")] + '</p>' : "") +
        (r[칸(칸들,"처리가능폐기물")]
          ? '<p class="waste"><b>처리가능 폐기물</b> — ' +
            r[칸(칸들,"처리가능폐기물")] + '</p>'
          : '<p class="waste"><span class="none">처리가능 지정폐기물 목록 없음 — ' +
            (r[칸(칸들,"확인못함")] || '허가증 자료가 있어야 채웁니다') +
            '</span></p>') +
        '<p class="src">' + r[칸(칸들,"자료출처")] + '</p></div>';
    } else {
      var 개 = r[칸(칸들,"개수")], 단 = r[칸(칸들,"단위")];
      var 원 = r[칸(칸들,"원래이름")], 표 = r[칸(칸들,"물품명")];
      h += '<div class="row"><div class="t">' +
        '<span class="tag">' + r[칸(칸들,"분류")] + '</span>' +
        '<span class="nm">' + 표 + '</span>' +
        '<span class="n">' + (개 !== "" ? 개 + (단 ? " " + 단 : "개") : "개수 모름") +
        '</span></div>' +
        (원 && 원 !== 표 ? '<p class="m">원자료 표기 — ' + 원 + '</p>' : "") +
        '<p class="m">' + (r[칸(칸들,"보유처")] || "보유처 확인 못 함") +
        ' <span class="tag">' + r[칸(칸들,"보유처종류")] + '</span> · ' +
        전화(r[칸(칸들,"대표전화")]) + '</p>' +
        '<p class="m">' + 곳(r, 칸들) +
        (r[칸(칸들,"주소")] ? ' · ' + r[칸(칸들,"주소")] : "") + '</p>' +
        '<p class="src">' + r[칸(칸들,"자료출처")] + '</p></div>';
    }
  }
  document.getElementById("목록").innerHTML =
    h || '<div class="row"><p class="m">고른 조건에 맞는 것이 없습니다.</p></div>';
  document.getElementById("더").innerHTML = 남.length > 끝
    ? '<button id="더보기">' + (남.length - 끝) + '개 더 보기</button>' : "";
  var b = document.getElementById("더보기");
  if (b) b.onclick = function(){ 보인수 += 200; 그리기(); };
}

/* ── 두 갈래 바꾸기 ──────────────────────────────────────── */
function 갈래바꾸기(어느){
  지금 = 어느; 고른갈래 = ""; 보인수 = 60;
  document.getElementById("b업체").setAttribute("aria-pressed", 어느 === "업체");
  document.getElementById("b물품").setAttribute("aria-pressed", 어느 === "물품");
  document.getElementById("찾기").placeholder = 어느 === "업체"
    ? "업체명 · 주소 · 처리가능 폐기물로 찾기"
    : "물품 이름 · 보유처 · 주소로 찾기";
  알림그리기(); 칩그리기(); 골라채우기(); 그리기();
}
document.getElementById("b업체").onclick = function(){ 갈래바꾸기("업체"); };
document.getElementById("b물품").onclick = function(){ 갈래바꾸기("물품"); };
document.getElementById("찾기").oninput = function(){ 보인수 = 60; 그리기(); };
document.getElementById("권역").onchange = function(){ 보인수 = 60; 그리기(); };
document.getElementById("시도").onchange = function(){ 보인수 = 60; 그리기(); };

갈래바꾸기("업체");
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()
