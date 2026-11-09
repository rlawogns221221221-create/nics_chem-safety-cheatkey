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
var refocus = false;     // choose() 가 칸에 포커스를 되돌릴 때 '새로 찾기' 로 비우지 않게

/* ── 다시 누르면 새로 찾기 (2026-11-09 사용자 댓글) ──────────────────
   "물질을 검색했다가 다시 클릭하면 이전 내용을 직접 지우고 다시 눌러야 하는데,
   클릭하면 새롭게 물질을 검색할 수 있게". 그래서 값이 있는 칸을 누르면
   · 칸을 비우고 전체 목록(사고 많은 순)을 엽니다 — 바로 새 이름을 칠 수 있습니다.
   · 지금 고른 물질은 칸 안에 흐린 글씨(placeholder)로 남겨 무엇이 골라져 있는지 보입니다.
   · **아무것도 치거나 고르지 않고 나가면 원래 물질로 되돌립니다.** 칸만 비우고
     input 이벤트를 내지 않으므로, 그동안 화면(구역·문안)은 원래 물질 그대로입니다.
   · 쳤거나 골랐으면 그 값이 남습니다(지운 채로 나가면 빈 칸 — 사람이 지운 것). */
var fresh = null;        // { el, prev, ph, typed }
function startFresh(el) {
  if (!el.value) return;
  fresh = { el: el, prev: el.value, ph: el.getAttribute("placeholder"), typed: false };
  el.value = "";
  el.setAttribute("placeholder", fresh.prev);
}
function endFresh() {
  var f = fresh;
  fresh = null;
  if (!f) return;
  if (f.ph == null) f.el.removeAttribute("placeholder"); else f.el.setAttribute("placeholder", f.ph);
  if (!f.typed && !f.el.value) f.el.value = f.prev;
}

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

/* ── 목록 높이 ────────────────────────────────────────────────
   ⚠ 휴대전화에서 **자판이 올라오면** 실제로 보이는 높이는 절반으로 줄어드는데
   `window.innerHeight` 는 그대로입니다(iOS 는 자판이 떠도 안 줄어듭니다).
   그래서 예전에는 목록이 340px 까지 자라 **보이는 자리의 7할**을 덮었습니다
   (2026-09-08 사용자 지적 — "물질 클릭시 화면이 꽉차서 불편함이 느껴짐").
   보이는 높이는 `visualViewport` 가 알려 줍니다 — 그 높이의 45% 를 넘지
   않게 하고, 없는 브라우저에서는 예전처럼 innerHeight 로 셉니다. */
function 보이는높이() {
  var vv = window.visualViewport;
  return vv && vv.height ? vv.height : window.innerHeight;
}
function place() {
  if (!input || pop.hidden) return;
  var r = input.getBoundingClientRect();
  var vv = window.visualViewport;
  var vTop = vv ? vv.offsetTop : 0, vH = 보이는높이();
  var below = (vTop + vH) - r.bottom, above = r.top - vTop;
  /* 바닥값(예전 180px)도 **보이는 자리 안에서만** 지킵니다 — 자리가 120px
     뿐인데 180px 을 고집하면 목록이 화면 밖으로 삐져나갑니다. */
  var 한계 = Math.min(340, Math.round(vH * 0.45));
  var 칸 = (below > 220 ? below : above) - 16;
  var maxH = Math.max(Math.min(120, 칸), Math.min(한계, 칸));
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
  if (fresh) fresh.typed = true;                    // 골랐으니 되돌리지 않습니다
  silent = true;
  try { el.dispatchEvent(new Event("input", { bubbles: true })); } finally { silent = false; }
  close();
  refocus = true;
  try { el.focus(); } catch (e) {} finally { refocus = false; }
}

/* isNew — 사람이 칸을 누른 것(포커스·클릭)이면 '새로 찾기' 로 비웁니다.
   치는 도중에 목록을 다시 여는 것(input)은 그대로 둡니다. */
function open(el, isNew) {
  build();
  if (!data().length) return;                       // 물질 데이터가 없는 페이지
  if (isNew && !(fresh && fresh.el === el)) { endFresh(); startFresh(el); }
  input = el;
  pop.hidden = false;
  render(el.value);
  place();
}

function close() {
  if (pop && !pop.hidden) { pop.hidden = true; sel = -1; }
  input = null;
  endFresh();
}

build();

document.addEventListener("focusin", function (e) {
  var t = e.target;
  if (isTarget(t)) { if (!refocus) open(t, true); }
  else if (pop && !pop.hidden && !pop.contains(t)) close();
});

function isTarget(t) {
  return !!(t && t.getAttribute && t.getAttribute("data-matpicker") !== null);
}

document.addEventListener("input", function (e) {
  if (silent || !isTarget(e.target)) return;
  if (fresh && fresh.el === e.target) fresh.typed = true;
  if (pop.hidden || input !== e.target) open(e.target);      // 닫혀 있어도 입력하면 다시 열기
  else { render(input.value); place(); }
});

/* 이미 포커스가 있는 칸을 다시 눌렀을 때도 열리도록 (focusin 이 안 오는 경우) */
document.addEventListener("click", function (e) {
  if (isTarget(e.target) && pop.hidden) open(e.target, true);
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
/* 자판이 올라오거나 내려가면 보이는 높이가 바뀝니다 — `resize` 로는 안 옵니다.
   (없는 브라우저에서는 그냥 아무 일도 하지 않습니다) */
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", function () { if (input) place(); });
  window.visualViewport.addEventListener("scroll", function () { if (input) place(); });
}

/* ── 물질정보 글을 읽기 좋게 나눠 보이기 ─────────────────────────────
   2026-11-09 사용자 댓글 — "줄바꿈이 안 되어 있네. 이런 거 다 찾아내서 고쳐야 해".
   원문(화학물질안전원 「현장대응 물질정보」)은 항목을 「•」 로만 이어 적어,
   화면에서 "…밤: 4.5km 이내 •소규모 유출시 …" 처럼 한 줄로 흘렀습니다.
   **글자는 한 자도 고치지 않고**, 원문에 이미 있는 나눔 표시에서만 줄을 바꿉니다.
   · 「•」          항목 — 줄을 바꾸고 앞에 점을 둡니다
   · 「 / 」        소규모 / 대규모 · 육지 / 수계 (빗금 앞이 띄어진 것만) —
                    「•」 로 나뉜 글이면 그 항목의 아랫줄, 아니면 그 자체로 항목.
                    "입/인두/식도" 처럼 붙여 쓴 빗금은 낱말 안이라 나누지 않습니다.
   · 「[대량 유출]」 꺾쇠 머리 · 「(소규모)」「(대규모)」 괄호 머리 — 그 앞에서
                    나눔(빗금과 같은 규칙). 괄호는 규모 낱말일 때만 — "(※…)" 나
                    "(입/인두)" 같은 덧붙임은 나누지 않습니다.
   · 「 ※…」「 *…」 덧말 — 그 앞에서 나눔. "(※풍속·운반용기에 따름)" 처럼 괄호
                    안이거나 "KMARK-1*" 처럼 붙은 것은 그대로 둡니다.
   덧말도 같은 크기·같은 색입니다 — "※ 조직이 얼지 않은 경우: 물로 15분간 세척"
   같은 응급조치가 덧말 자리에 있어 흐리게 두면 안 됩니다.
   나눌 것이 없으면 원문 그대로(이스케이프만) 돌려줍니다. 줄바꿈 문자는 넣지
   않습니다 — ① 의 물질정보 칸은 white-space:pre-line 이라 빈 줄이 생깁니다. */
function textHtml(s) {
  /* 쉼표 뒤 띄어쓰기만 화면에서 채웁니다 — 원문의 "신선한공기,산소공급,인공호흡" 은
     쉼표 뒤가 붙어 있어 줄을 꺾을 자리가 없고 읽기도 어렵습니다. 낱말은 그대로이고
     "1,000" 같은 숫자 안 쉼표는 건드리지 않습니다. */
  s = String(s == null ? "" : s).replace(/\s+/g, " ").replace(/,(?=[^\s\d])/g, ", ").trim();
  if (!s) return "";
  var bul = s.split(/\s*•\s*/).filter(function (x) { return x; });
  var hasBul = bul.length > 1;
  var items = [];
  bul.forEach(function (b) {
    var parts = b.split(/\s+(?=[※*])/);
    var notes = parts.slice(1);
    var pieces = parts[0].split(/\s+\/\s*|\s+(?=\[)|\s+(?=\((?:소규모|대규모|소량|대량)[^)]*\))/)
      .filter(function (x) { return x; });
    if (hasBul || pieces.length < 2) {
      items.push({ t: pieces[0] || "", subs: pieces.slice(1), notes: notes });
    } else {
      pieces.forEach(function (p, i) {
        items.push({ t: p, subs: [], notes: i === pieces.length - 1 ? notes : [] });
      });
    }
  });
  /* 「밤: 4.5km 이내」 같은 거리 한 토막은 한 줄에 — 좁은 화면에서 "밤: / 4.5km"
     로 갈라져 어느 숫자가 낮·밤인지 읽기 어려웠습니다(글자는 그대로, 묶기만) */
  var e = function (x) {
    return esc(x).replace(/(?:(?:낮|밤|반경|육지|수계)\s*:?\s*)?\d[\d.]*\s*k?m\+?(?:\s*(?:이내|이상))?/g,
      function (k) { return '<span class="mtx-k">' + k + "</span>"; });
  };
  var inner = function (it) {
    return e(it.t)
      + it.subs.map(function (x) { return '<span class="mtx-s">' + e(x) + "</span>"; }).join("")
      + it.notes.map(function (x) { return '<span class="mtx-n">' + e(x) + "</span>"; }).join("");
  };
  /* 원문에 띄어쓰기가 없는 긴 토막("대규모유출시풍하방향으로육지낮1.0km,…")은
     낱말 단위 줄바꿈(keep-all)으로는 꺾을 자리가 없어 좁은 화면 밖으로 넘칩니다 —
     그래서 늘 .mtx/.mtx1 로 감싸 넘칠 때만 아무 자리에서나 꺾게 합니다(CSS). */
  if (items.length === 1) return '<span class="mtx1">' + inner(items[0]) + "</span>";
  return '<ul class="mtx">' + items.map(function (it) { return "<li>" + inner(it) + "</li>"; }).join("") + "</ul>";
}

window.MatPicker = { close: close, refresh: function () { READY = false; ALL = []; }, textHtml: textHtml };
})();
