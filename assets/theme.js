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
  shortPh();
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
  more(slot);
}

/* ── 좁은 화면의 짧은 안내문(placeholder) ─────────────────────
   검색칸 안내문 "예) 강릉시 옥계면, 개령서부초등학교" 가 휴대전화에서는
   칸 끝에서 **글자 중간이 잘려** 보였습니다. 칸 위 이름표도 화면에서 비켜
   두었으므로(shell.css) 그 자리에서는 안내문이 곧 이름입니다 — data-ph-s 의
   짧은 말로 바꿔 끼웁니다. 화면을 돌려 넓어지면 원래 안내문으로 돌아옵니다. */
function shortPh() {
  var els = document.querySelectorAll("[data-ph-s]");
  if (!els.length || !window.matchMedia) return;
  var mq = window.matchMedia("(max-width:560px)");
  function set() {
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (!e.hasAttribute("data-ph-l")) e.setAttribute("data-ph-l", e.getAttribute("placeholder") || "");
      e.setAttribute("placeholder", e.getAttribute(mq.matches ? "data-ph-s" : "data-ph-l"));
    }
  }
  set();
  if (mq.addEventListener) mq.addEventListener("change", set);
  else if (mq.addListener) mq.addListener(set);
}

/* ── 휴대전화에서 머리띠를 한 줄로 — '메뉴' 단추 ───────────────
   도구 화면 머리띠는 제목 + 단추 넷(고대비·자료 출처·인쇄·초기화)이라
   휴대전화에서는 **두 줄 110px** 을 먹었습니다. 지도·문안이 그만큼 밀려
   내려가고, 첫 화면이 단추로 시작했습니다(2026-10-27 만족도 조사 뒤
   사용자 지시 — "모바일 버전을 최대한 깔끔하게").
   그래서 고대비 단추만 밖에 두고 나머지를 '메뉴' 하나에 접습니다.
   · **넓은 화면에서는 아무것도 바뀌지 않습니다** — 접는 것은 CSS 가
     560px 아래에서만 합니다. 이 함수는 단추를 한 상자에 담기만 합니다.
   · 단추의 id·동작은 그대로입니다(각 app.js 가 id 로 찾습니다).
   · 이 파일에 두는 까닭 — 세 도구가 모두 head 에서 부르는 공용 파일이 이것
     하나라, 파일을 새로 늘리지 않고 망분리용 단일 파일에도 그대로 들어갑니다.
   · 접을 것이 하나뿐이면(진입 화면의 누리집 링크) 아무것도 하지 않습니다. */
function more(slot) {
  var kids = [], i, c = slot.children;
  for (i = 0; i < c.length; i++) if (c[i] !== btn) kids.push(c[i]);
  if (kids.length < 2) return;
  var box = document.createElement("div");
  box.className = "act-more";
  box.id = "actMore";
  for (i = 0; i < kids.length; i++) box.appendChild(kids[i]);
  var t = document.createElement("button");
  t.type = "button";
  t.className = "morebtn noprint";
  t.setAttribute("aria-expanded", "false");
  t.setAttribute("aria-controls", "actMore");
  t.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    + '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/>'
    + '<circle cx="19" cy="12" r="2"/></svg><span>메뉴</span>';
  slot.appendChild(t);
  slot.appendChild(box);
  function set(open) {
    slot.className = slot.className.replace(/\s*\bopen\b/g, "") + (open ? " open" : "");
    t.setAttribute("aria-expanded", open ? "true" : "false");
  }
  t.onclick = function () { set(t.getAttribute("aria-expanded") !== "true"); };
  /* 메뉴 밖을 누르거나 메뉴 안 단추를 누르면 닫습니다 — 열어 둔 채로 두면
     아래 지도·입력칸을 덮습니다. */
  document.addEventListener("click", function (e) {
    var n = e.target, inSlot = false, onBtn = false;
    for (; n && n !== document; n = n.parentNode) {
      if (n === slot) { inSlot = true; break; }
      if (n.tagName === "BUTTON" && n !== t) onBtn = true;
    }
    if (!inSlot || (onBtn && box.contains(e.target))) set(false);
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Escape" || e.keyCode === 27) && t.getAttribute("aria-expanded") === "true") {
      set(false);
      t.focus();
    }
  });
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
