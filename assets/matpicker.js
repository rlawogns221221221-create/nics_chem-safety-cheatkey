/* 사고물질 선택 목록 — 460종을 스크롤로 훑어보고 고를 수 있는 입력 보조
   ────────────────────────────────────────────────────────────────
   브라우저 기본 <datalist> 는 표시 항목 수·스크롤·표기 형식을 제어할 수 없어
   직접 만들었습니다. 사용법:

       <input type="text" data-matpicker>

   페이지가 다시 그려져도 동작하도록 document 단위 이벤트 위임으로 처리하고,
   목록은 body 에 하나만 만들어 재사용합니다. (여러 번 붙여도 중복 생성 없음)

   목록에서 고르면 입력칸 값이 바뀌고 input 이벤트가 발생하므로,
   기존 oninput 처리 로직이 그대로 이어집니다. 목록에 없는 물질은 직접 입력해도 됩니다. */
(function () {
"use strict";

if (window.MatPicker) return;                       // 중복 로드 방지

var esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
};
function norm(s) { return String(s).replace(/[\s·,()\[\]{}\-–—/]/g, "").toLowerCase(); }

var ALL = [], READY = false;
function data() {
  if (READY) return ALL;
  READY = true;
  if (typeof MATERIALS === "undefined" || !MATERIALS.length) return ALL;
  var raw = (typeof STATS !== "undefined" && STATS.물질빈도) ? STATS.물질빈도 : {};
  var freq = {};
  Object.keys(raw).forEach(function (k) { freq[norm(k)] = (raw[k] || {}).n || 0; });

  ALL = MATERIALS.map(function (m) {
    // 목록표는 동의어를 "/" 로 붙여 쓴다 ("염화수소/염산", "플루오르화수소/불산").
    // 정식 이름으로 인정하는 것은 표시명과 이 조각들까지다.
    var names = [m.n].concat(String(m.n).split("/"));
    var nk = [];
    names.forEach(function (x) {
      var v = norm(x);
      if (v && nk.indexOf(v) < 0) nk.push(v);
    });

    // 사고빈도는 정식 이름으로만 대조한다.
    // 별칭까지 쓰면 "황산, 마그네슘 염" 처럼 원자료가 쉼표로 늘어놓은 표기 때문에
    // 황산 마그네슘이 황산의 건수를 가져가는 문제가 생긴다.
    var f = 0;
    nk.forEach(function (v) { f = Math.max(f, freq[v] || 0); });

    return {
      m: m,
      n: m.n, e: m.e || "", c: m.c || "",
      f: f,
      i: m.i || 9999,
      nk: nk,                                                // 정식 이름 (일치·앞글자 판정용)
      ak: (m.a || []).map(norm),                             // 유사명 (검색만)
      k: norm([m.n].concat(m.a || [], [m.e, m.c]).join(" ")) // 전체 검색 대상
    };
  });
  return ALL;
}

var pop = null, listEl = null, cntEl = null, input = null, rows = [], sel = -1;
var silent = false;      // choose() 가 스스로 발생시킨 input 이벤트로 목록이 다시 열리지 않게

function build() {
  if (pop) return;
  pop = document.createElement("div");
  pop.className = "mpk";
  pop.setAttribute("role", "listbox");
  pop.hidden = true;
  pop.innerHTML = '<div class="mpk-hd"><span id="mpkCnt"></span>'
    + '<span class="mpk-hint">↑↓ Enter Esc</span></div>'
    + '<div class="mpk-list" id="mpkList"></div>'
    + '<div class="mpk-ft">목록에 없는 물질은 그대로 입력하세요</div>';
  document.body.appendChild(pop);
  listEl = pop.querySelector("#mpkList");
  cntEl = pop.querySelector("#mpkCnt");

  // 목록 안에서 마우스를 눌러도 입력칸 포커스가 풀리지 않도록
  pop.addEventListener("mousedown", function (e) { e.preventDefault(); });
  listEl.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest(".mpk-row") : null;
    if (el) choose(+el.dataset.i);
  });
}

function place() {
  if (!input || pop.hidden) return;
  var r = input.getBoundingClientRect();
  var below = window.innerHeight - r.bottom, above = r.top;
  var maxH = Math.max(180, Math.min(340, (below > 220 ? below : above) - 16));
  var w = Math.max(r.width, Math.min(360, window.innerWidth - 24));
  pop.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - w - 8))) + "px";
  pop.style.width = Math.round(Math.max(r.width, Math.min(360, window.innerWidth - 24))) + "px";
  listEl.style.maxHeight = maxH + "px";
  if (below > 220 || below > above) {
    pop.style.top = Math.round(r.bottom + 4) + "px";
    pop.style.bottom = "auto";
  } else {
    pop.style.top = "auto";
    pop.style.bottom = Math.round(window.innerHeight - r.top + 4) + "px";
  }
}

function render(q) {
  var all = data();
  var nq = norm(q || "");
  rows = nq
    ? all.filter(function (x) { return x.k.indexOf(nq) >= 0; })
    : all.slice();

  if (nq) {
    var rank = function (x) {
      if (x.nk.indexOf(nq) >= 0) return 0;                   // 이름·별칭이 정확히 일치
      for (var i = 0; i < x.nk.length; i++)
        if (x.nk[i].indexOf(nq) === 0) return 1;             // 이름·별칭이 그 글자로 시작
      for (var j = 0; j < x.nk.length; j++)
        if (x.nk[j].indexOf(nq) >= 0) return 2;              // 이름 안에 포함
      for (var q = 0; q < x.ak.length; q++)
        if (x.ak[q].indexOf(nq) === 0) return 3;             // 유사명이 그 글자로 시작
      return 4;                                              // 유사명 일부·영문명·CAS 에만 있음
    };
    rows.sort(function (a, b) {
      return rank(a) - rank(b) || b.f - a.f || a.i - b.i;
    });
  } else {
    rows.sort(function (a, b) { return b.f - a.f || a.i - b.i; });
  }

  cntEl.textContent = nq
    ? rows.length + "건 / " + all.length + "종"
    : all.length + "종 · 사고 많은 순";

  if (!rows.length) {
    listEl.innerHTML = '<div class="mpk-none">일치하는 물질이 없습니다.<br>'
      + "물질명·영문명·CAS·유사명으로 찾을 수 있습니다.</div>";
    sel = -1;
    return;
  }
  listEl.innerHTML = rows.map(function (x, i) {
    return '<div class="mpk-row" role="option" data-i="' + i + '">'
      + '<span class="nm">' + esc(x.n) + "</span>"
      + (x.e ? '<span class="en">' + esc(x.e) + "</span>" : "")
      + '<span class="cas">' + esc(x.c || "CAS -") + "</span>"
      + (x.f ? '<span class="fq">사고 ' + x.f + "건</span>" : "")
      + "</div>";
  }).join("");
  sel = -1;
}

function mark(i) {
  var els = listEl.children;
  if (sel >= 0 && els[sel]) els[sel].classList.remove("on");
  sel = i;
  if (sel >= 0 && els[sel]) {
    els[sel].classList.add("on");
    var el = els[sel], lb = listEl.getBoundingClientRect(), eb = el.getBoundingClientRect();
    if (eb.top < lb.top) listEl.scrollTop -= lb.top - eb.top;
    else if (eb.bottom > lb.bottom) listEl.scrollTop += eb.bottom - lb.bottom;
  }
}

function choose(i) {
  var el = input;                                   // close() 가 input 을 비우므로 먼저 잡아둔다
  if (!el || !rows[i]) return;
  el.value = rows[i].n;
  silent = true;
  try { el.dispatchEvent(new Event("input", { bubbles: true })); } finally { silent = false; }
  close();
  try { el.focus(); } catch (e) {}
}

function open(el) {
  build();
  if (!data().length) return;                       // 물질 데이터가 없는 페이지
  input = el;
  pop.hidden = false;
  render(el.value);
  place();
}

function close() {
  if (pop && !pop.hidden) { pop.hidden = true; sel = -1; }
  input = null;
}

build();

document.addEventListener("focusin", function (e) {
  var t = e.target;
  if (isTarget(t)) open(t);
  else if (pop && !pop.hidden && !pop.contains(t)) close();
});

function isTarget(t) {
  return !!(t && t.getAttribute && t.getAttribute("data-matpicker") !== null);
}

document.addEventListener("input", function (e) {
  if (silent || !isTarget(e.target)) return;
  if (pop.hidden || input !== e.target) open(e.target);      // 닫혀 있어도 입력하면 다시 열기
  else { render(input.value); place(); }
});

/* 이미 포커스가 있는 칸을 다시 눌렀을 때도 열리도록 (focusin 이 안 오는 경우) */
document.addEventListener("click", function (e) {
  if (isTarget(e.target) && pop.hidden) open(e.target);
});

document.addEventListener("keydown", function (e) {
  if (!input || pop.hidden) return;
  if (e.key === "ArrowDown") { e.preventDefault(); mark(Math.min(sel + 1, rows.length - 1)); }
  else if (e.key === "ArrowUp") { e.preventDefault(); mark(Math.max(sel - 1, 0)); }
  else if (e.key === "Enter") { if (sel >= 0) { e.preventDefault(); choose(sel); } }
  else if (e.key === "Escape") { e.preventDefault(); close(); }
  else if (e.key === "Tab") close();
});

document.addEventListener("mousedown", function (e) {
  if (pop && !pop.hidden && e.target !== input && !pop.contains(e.target)) close();
});

window.addEventListener("resize", place);
window.addEventListener("scroll", function () { if (input) place(); }, true);

window.MatPicker = { close: close, refresh: function () { READY = false; ALL = []; } };
})();
