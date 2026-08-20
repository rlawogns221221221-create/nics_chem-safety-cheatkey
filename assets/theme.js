/* ============================================================
   밝은 화면 · 고대비(어두운) 화면 바꾸기

   KRDS 에는 '다크 모드'라는 이름이 없고 대신 **고대비(high-contrast)** 모드가
   있습니다. 그 모드가 사실상 어두운 화면입니다 — 흰 바탕이 검정으로 바뀝니다.
   그래서 우리가 색을 새로 만들지 않고 KRDS 가 정한 모드를 그대로 켭니다.

     <html data-krds-mode="light">           밝음 (기본)
     <html data-krds-mode="high-contrast">   고대비(어두움)

   ── 왜 필요한가 ─────────────────────────────────────────────
   화학사고는 밤에도 납니다. 야간 근무자가 밝은 화면을 오래 보면 눈이 부시고,
   어두운 사무실에서 화면만 하얗게 빛나면 창밖 상황이 안 보입니다. 저시력
   담당자에게는 고대비가 더 잘 읽히기도 합니다.

   ── 왜 <head> 에서 부르나 ───────────────────────────────────
   화면이 그려지기 **전에** 모드를 정해야 합니다. 나중에 부르면 어두운 모드를
   골라 둔 사람에게 흰 화면이 한 번 번쩍였다가 어두워집니다.
   그래서 이 파일은 부르는 즉시 <html> 에 표시를 달고, 단추는 화면이 준비된
   뒤에 만듭니다.
   ============================================================ */
(function () {
"use strict";

var KEY = "nics.krds.mode";
var LIGHT = "light", HC = "high-contrast";

function saved() {
  try { return localStorage.getItem(KEY); } catch (e) { return null; }
}
function store(v) {
  try { localStorage.setItem(KEY, v); } catch (e) { /* 쓸 수 없으면 이번만 적용 */ }
}

/* 고른 적이 없으면 밝은 화면으로 시작합니다 — 재난 대응 도구의 기본은
   밝고 대비가 높은 화면이고, 어두운 화면은 고르는 사람만 씁니다. */
var mode = saved() === HC ? HC : LIGHT;
document.documentElement.setAttribute("data-krds-mode", mode);

function apply(v) {
  mode = v;
  document.documentElement.setAttribute("data-krds-mode", v);
  store(v);
  draw();
}

/* 해·달 그림 — 지금 화면이 아니라 **누르면 무엇이 되는지**를 보여 줍니다
   (밝은 화면일 때 달을 보여 주어 "누르면 어두워진다"가 되게). */
function icon(next) {
  var moon = '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>';
  var sun = '<circle cx="12" cy="12" r="4.2"/>'
    + '<path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6'
    + 'M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9"/>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + (next === HC ? moon : sun) + "</svg>";
}

var btn = null;
function draw() {
  if (!btn) return;
  var next = mode === HC ? LIGHT : HC;
  var label = next === HC ? "어두운 화면으로" : "밝은 화면으로";
  btn.innerHTML = icon(next) + '<span class="mode-t">' + label + "</span>";
  btn.setAttribute("title", label
    + " (고대비 모드 — 야간·저시력 근무자를 위한 KRDS 표준 화면입니다)");
  btn.setAttribute("aria-pressed", mode === HC ? "true" : "false");
}

function build() {
  /* 도구마다 머리띠 오른쪽에 단추 줄(.act)이 있습니다. 없으면(진입 화면 등)
     둘 자리를 못 찾은 것이므로 아무 것도 만들지 않습니다 — 화면 아무 데나
     떠 있는 단추를 만들면 인쇄·좁은 화면에서 걸립니다. */
  var slot = document.querySelector("[data-mode-slot]")
          || document.querySelector(".top .act");
  if (!slot) return;
  btn = document.createElement("button");
  btn.type = "button";
  btn.className = "modebtn noprint";
  btn.onclick = function () { apply(mode === HC ? LIGHT : HC); };
  slot.insertBefore(btn, slot.firstChild);
  draw();
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", build);
else build();

/* 다른 화면(다른 탭·다른 도구)에서 바꿨으면 따라갑니다 — 세 도구를 오가며
   쓰는데 한쪽만 어두우면 같은 도구로 보이지 않습니다. */
window.addEventListener("storage", function (e) {
  if (e.key === KEY) apply(e.newValue === HC ? HC : LIGHT);
});

})();
