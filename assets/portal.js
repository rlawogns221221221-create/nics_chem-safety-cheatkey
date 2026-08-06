/* ============================================================
   화학사고 대응지원 서비스 — 진입 화면 동작

   자바스크립트가 없어도 세 도구로 들어가는 링크는 그대로 동작합니다.
   여기서 하는 일은 세 가지뿐입니다.
     1) 좁은 화면에서 메뉴 열고 닫기
     2) 공지 띄우기 (아래 공지 설정에서 켤 때만)
     3) 자료 기준·버전 숫자를 data/version.js 한 곳에서 가져다 쓰기
   ============================================================ */
(function () {
"use strict";

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* ── 공지 설정 ────────────────────────────────────────────────
   실제 공지가 있을 때만 표시: 아래 표시 를 true 로 바꾸고 내용을 적으세요.
   공지가 없으면 그 영역 전체가 화면에서 사라집니다.
   긴급 을 true 로 두면 붉은 띠가 되는데, 실제 긴급 상황에만 쓰세요. */
var 공지 = {
  표시: false,
  긴급: false,
  분류: "안내",
  내용: "",                    // 예: "서비스 점검 안내 · 2026년 8월 10일 18:00~20:00"
  링크문구: "",                // 예: "자세히 보기"
  링크: ""
};

function initNotice() {
  var el = $("#notice");
  if (!el || !공지.표시 || !공지.내용) return;      // 없으면 영역째 숨긴 채로 둔다
  el.hidden = false;
  el.classList.toggle("is-urgent", !!공지.긴급);
  $(".p-notice-tag", el).textContent = 공지.긴급 ? "긴급" : (공지.분류 || "안내");
  $(".p-notice p", el).textContent = 공지.내용;
  /* 링크는 실제로 걸 곳이 있을 때만 살린다 — 갈 데 없는 '#' 링크를 두지 않는다 */
  var a = $(".p-notice a", el);
  if (공지.링크 && 공지.링크문구) {
    a.href = 공지.링크; a.textContent = 공지.링크문구; a.hidden = false;
  } else a.remove();
}

/* ── 좁은 화면 메뉴 ───────────────────────────────────────── */
function initMenu() {
  var btn = $("#menuBtn"), nav = $("#nav");
  if (!btn || !nav) return;
  var set = function (open) {
    nav.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
  };
  btn.onclick = function () { set(nav.className.indexOf("is-open") < 0); };
  $$("a", nav).forEach(function (a) { a.onclick = function () { set(false); }; });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.className.indexOf("is-open") >= 0) { set(false); btn.focus(); }
  });
  /* 넓은 화면으로 돌아가면 메뉴 상태를 되돌린다 — 안 그러면 열린 채로 남는다 */
  window.addEventListener("resize", function () {
    if (window.innerWidth > 960) set(false);
  });
}

/* ── 자료 기준·버전 ───────────────────────────────────────────
   화면에 적는 기준일·건수는 data/version.js 한 곳에서만 가져옵니다.
   여기에 숫자를 직접 적으면 데이터를 갱신할 때 화면만 옛 값으로 남습니다.
   (대피장소 건수는 build/build_single.py 가 실제 데이터와 대조합니다) */
function put(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }

function initFacts() {
  if (typeof VERSION === "undefined") return;
  put("fMsg", VERSION.문안근거);
  put("fShelter", VERSION.대피장소_출처 + " · 기준일 " + VERSION.대피장소_기준일
      + " · " + Number(VERSION.대피장소_건수).toLocaleString() + "곳");
  put("fMat", VERSION.물질정보_출처 + " · " + VERSION.물질정보_기준);
  put("fStat", VERSION.통계_출처 + " · " + VERSION.통계_기간);
  put("fMap", VERSION.배경지도);
  put("fVer", "서비스 버전 " + VERSION.도구버전 + " · 최종 갱신 " + VERSION.반영일);
  put("fDept", VERSION.관리부서);
  put("fTel", VERSION.관리자연락처);
}

document.addEventListener("DOMContentLoaded", function () {
  initMenu(); initNotice(); initFacts();
});
})();
