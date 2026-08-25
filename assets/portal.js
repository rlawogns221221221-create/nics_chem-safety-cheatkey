/* ============================================================
   진입 화면에서만 쓰는 자바스크립트

   화면을 만드는 일은 이 파일이 하지 않습니다. 사진 넘김도, 문구 바뀜도
   전부 CSS(assets/portal.css)가 합니다 — 자바스크립트가 꺼져 있어도,
   망분리 PC의 단일 파일에서도 그대로 돌아가야 하기 때문입니다.

   이 파일이 하는 일은 딱 두 가지입니다.
     ① 머리띠 사진 넘김을 **멈추는 단추**를 만들어 답니다.
     ② iOS 사파리에서 :active(눌린 느낌)가 켜지게 합니다.

   ── ① 왜 멈춤 단추가 있어야 하나 ────────────────────────────
   KRDS 접근성 지침과 WCAG 2.2.2 는 **5초를 넘겨 저절로 움직이는 것에는
   멈출 방법을 주라**고 합니다. 머리띠는 5초마다 사진과 문구가 바뀌므로
   여기에 해당합니다. 글을 천천히 읽는 사람, 화면 확대해 쓰는 사람에게는
   저절로 바뀌는 문구가 방해가 됩니다.

   멈춤은 <html> 에 표시(data-hero="stop")를 다는 것으로 합니다 — 실제로
   멈추는 것은 CSS 의 animation-play-state 입니다. 고른 값은 저장해 두어
   도구를 다녀와도 그대로입니다(theme.js 와 같은 방식).

   모션을 줄이는 설정(prefers-reduced-motion)이 켜져 있으면 애초에 사진이
   넘어가지 않으므로 **단추를 만들지 않습니다** — 아무 일도 하지 않는 단추를
   두면 눌러 보고 고장인 줄 압니다.
   ============================================================ */
(function () {
"use strict";

var KEY = "nics.hero.motion";
var STOP = "stop", PLAY = "play";

function saved() {
  try { return localStorage.getItem(KEY); } catch (e) { return null; }
}
function store(v) {
  try { localStorage.setItem(KEY, v); } catch (e) { /* 못 쓰면 이번만 적용 */ }
}

/* 모션을 줄이는 설정이면 CSS 가 이미 멈춰 둡니다. matchMedia 가 없는
   낡은 브라우저에서는 "설정이 없다"로 봅니다(그쪽에서는 넘어갑니다). */
function reduced() {
  return !!(window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

var state = saved() === STOP ? STOP : PLAY;
var btn = null;

function apply(v) {
  state = v;
  /* CSS 가 보는 것은 이 표시 하나입니다 */
  document.documentElement.setAttribute("data-hero", v);
  store(v);
  draw();
}

function icon(stopped) {
  var play = '<path d="M8 5.2 18 12 8 18.8z" fill="currentColor" stroke="none"/>';
  var pause = '<path d="M9.2 5.5v13M14.8 5.5v13"/>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"'
    + ' stroke-linecap="round" aria-hidden="true">'
    + (stopped ? play : pause) + "</svg>";
}

function draw() {
  if (!btn) return;
  var stopped = state === STOP;
  /* 그림도 글자도 **누르면 무엇이 되는지**를 보여 줍니다 */
  var label = stopped ? "사진 넘김 다시 시작" : "사진 넘김 멈춤";
  btn.innerHTML = icon(stopped) + '<span class="hero-ctl-t">'
    + (stopped ? "재생" : "멈춤") + "</span>";
  btn.setAttribute("aria-label", label);
  btn.setAttribute("title", label);
  btn.setAttribute("aria-pressed", stopped ? "true" : "false");
}

function build() {
  var slot = document.querySelector("[data-hero-ctl]");
  if (!slot) return;                 /* 둘 자리가 없으면 만들지 않습니다 */
  if (reduced()) return;             /* 이미 멈춰 있으면 단추가 할 일이 없습니다 */
  btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hero-btn noprint";
  btn.onclick = function () { apply(state === STOP ? PLAY : STOP); };
  slot.insertBefore(btn, slot.firstChild);
  draw();
}

/* 저장해 둔 값은 단추가 생기기 전에 바로 적용합니다 — 멈춰 두고 나갔던
   사람에게 사진이 한 번 넘어갔다가 멈추면 안 됩니다. */
if (state === STOP) document.documentElement.setAttribute("data-hero", STOP);

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", build);
else build();

/* ── ② iOS 사파리의 :active ────────────────────────────────
   아무 일도 하지 않는 touchstart 듣는 이를 하나 달아 두면 :active 가
   켜집니다(널리 쓰는 방법). 좁은 화면에서 카드를 누르면 사진이 살짝
   커지고 판이 짙어지는 것이 그 :active 입니다. */
document.addEventListener("touchstart", function () {}, { passive: true });

})();
