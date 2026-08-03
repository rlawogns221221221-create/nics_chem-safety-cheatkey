/* 화학사고 대피장소 지도 — 외부 지도 API 없이 SVG 로 직접 그립니다.
   인터넷 연결·API 키가 필요 없어 망분리 환경에서도 그대로 동작합니다. */
(function () {
"use strict";

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
};

/* 2018년 경계 데이터와 현재 행정구역명이 다른 3곳 */
var ALIAS = { "미추홀구": "남구", "군위군": "군위군", "null": null };

var state = { sido: "", sgg: "", acc: null, radius: null, wind: "", mat: "", sel: -1 };
var view = null;                     // {cx, cy, w}  중심 경도·위도와 가로 폭(경도 단위)
var shown = [];                      // 현재 지도에 그린 대피장소

/* ── 좌표 변환 ────────────────────────────────────────────────
   등장방형 도법 + 위도 보정. 한국 정도 범위에서는 왜곡이 무시할 수준이다. */
var LAT0 = 36.3, KX = Math.cos(LAT0 * Math.PI / 180);
function px(lon) { return lon * KX; }
function pxInv(x) { return x / KX; }

/* 두 지점 직선거리 (m) — 하버사인 */
function dist(a, b, c, d) {
  var R = 6371000, p = Math.PI / 180;
  var dLat = (c - a) * p, dLon = (d - b) * p;
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(a * p) * Math.cos(c * p) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
/* 방위각 (도, 북=0) */
function bearing(a, b, c, d) {
  var p = Math.PI / 180;
  var y = Math.sin((d - b) * p) * Math.cos(c * p);
  var x = Math.cos(a * p) * Math.sin(c * p) - Math.sin(a * p) * Math.cos(c * p) * Math.cos((d - b) * p);
  return (Math.atan2(y, x) / p + 360) % 360;
}
var DIRS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
function dirName(deg) { return DIRS[Math.round(deg / 45) % 8]; }
function fmtDist(m) { return m < 1000 ? m + "m" : (m / 1000).toFixed(m < 10000 ? 2 : 1) + "km"; }

/* ── 데이터 ───────────────────────────────────────────────── */

function currentShelters() {
  var out = [];
  var sidos = state.sido ? [state.sido] : Object.keys(SHELTERS);
  sidos.forEach(function (sd) {
    var sggs = state.sgg ? [state.sgg] : Object.keys(SHELTERS[sd] || {});
    sggs.forEach(function (sg) {
      (SHELTERS[sd] && SHELTERS[sd][sg] || []).forEach(function (r) {
        if (r[5] == null || r[6] == null) return;
        out.push({ sido: sd, sgg: sg, name: r[0], detail: r[1], addr: r[2],
                   cap: r[3], kind: r[4], lat: r[5], lon: r[6], dept: r[7], tel: r[8] });
      });
    });
  });
  return out;
}

function bounds(list) {
  if (!list.length) return { m: 124.5, M: 131.0, n: 33.0, N: 38.7 };
  var m = 999, M = -999, n = 999, N = -999;
  list.forEach(function (s) {
    m = Math.min(m, s.lon); M = Math.max(M, s.lon);
    n = Math.min(n, s.lat); N = Math.max(N, s.lat);
  });
  if (M - m < 0.02) { m -= 0.01; M += 0.01; }
  if (N - n < 0.02) { n -= 0.01; N += 0.01; }
  return { m: m, M: M, n: n, N: N };
}

/* 선택한 시·군·구 경계의 범위 */
function sggBounds() {
  if (!state.sgg) return null;
  var m = 999, M = -999, n = 999, N = -999, any = false;
  BOUNDARIES.forEach(function (f) {
    if (f.s !== state.sido || !matchSgg(f.n, state.sgg)) return;
    f.r.forEach(function (r) {
      var X = 0, Y = 0;
      for (var i = 0; i < r.length; i += 2) {
        if (i === 0) { X = r[0]; Y = r[1]; } else { X += r[i]; Y += r[i + 1]; }
        var lon = X / BOUNDARY_SCALE, lat = Y / BOUNDARY_SCALE;
        m = Math.min(m, lon); M = Math.max(M, lon);
        n = Math.min(n, lat); N = Math.max(N, lat);
        any = true;
      }
    });
  });
  return any ? { m: m, M: M, n: n, N: N } : null;
}

/* 화면에 들어와야 할 것 전부를 담도록 시야를 맞춘다
   — 대피장소 · 선택 시군구 경계 · 사고지점과 반경 원 */
function fit(list) {
  var b = bounds(list);
  var sb = sggBounds();
  if (sb) {
    b.m = Math.min(b.m, sb.m); b.M = Math.max(b.M, sb.M);
    b.n = Math.min(b.n, sb.n); b.N = Math.max(b.N, sb.N);
  }
  if (state.acc) {
    var rd = (state.radius > 0 ? state.radius : 0) / 111320;
    b.m = Math.min(b.m, state.acc.lon - rd / KX); b.M = Math.max(b.M, state.acc.lon + rd / KX);
    b.n = Math.min(b.n, state.acc.lat - rd);      b.N = Math.max(b.N, state.acc.lat + rd);
  }
  var w = (b.M - b.m) * 1.18, h = (b.N - b.n) * 1.18;
  view = { cx: (b.m + b.M) / 2, cy: (b.n + b.N) / 2, w: Math.max(w, h * 1.4, 0.02) };
}

/* ── 지도 그리기 ──────────────────────────────────────────── */

var SVG = null, VB = null;

function svgSize() {
  var r = SVG.getBoundingClientRect();
  return { w: r.width || 640, h: r.height || 460 };
}

function viewBox() {
  var s = svgSize(), asp = s.h / s.w;
  var wx = view.w * KX;                       // 투영 좌표 폭
  var hy = wx * asp;
  return { x: px(view.cx) - wx / 2, y: -view.cy - hy / 2, w: wx, h: hy, sw: s.w, sh: s.h };
}

/* 화면 픽셀 → 위경도 */
function screenToLL(clientX, clientY) {
  var r = SVG.getBoundingClientRect();
  var vb = VB;
  var x = vb.x + (clientX - r.left) / r.width * vb.w;
  var y = vb.y + (clientY - r.top) / r.height * vb.h;
  return { lon: pxInv(x), lat: -y };
}

function boundaryPaths(vb) {
  var pad = vb.w * 0.3;
  var x0 = vb.x - pad, x1 = vb.x + vb.w + pad, y0 = vb.y - pad, y1 = vb.y + vb.h + pad;
  var out = [];
  BOUNDARIES.forEach(function (f) {
    var hit = state.sgg && f.s === state.sido && matchSgg(f.n, state.sgg);
    f.r.forEach(function (ring) {
      var X = 0, Y = 0, d = "", any = false, inside = false;
      for (var i = 0; i < ring.length; i += 2) {
        if (i === 0) { X = ring[0]; Y = ring[1]; } else { X += ring[i]; Y += ring[i + 1]; }
        var lon = X / BOUNDARY_SCALE, lat = Y / BOUNDARY_SCALE;
        var sx = px(lon), sy = -lat;
        if (sx > x0 && sx < x1 && sy > y0 && sy < y1) inside = true;
        d += (any ? "L" : "M") + sx.toFixed(4) + " " + sy.toFixed(4);
        any = true;
      }
      if (inside) out.push('<path d="' + d + '" class="bd' + (hit ? " on" : "") + '"/>');
    });
  });
  return out.join("");
}

function matchSgg(bName, sgg) {
  if (bName === sgg) return true;
  var a = ALIAS[sgg];
  if (a && bName === a) return true;
  return bName.indexOf(sgg) === 0 || sgg.indexOf(bName) === 0;
}

function draw() {
  if (!view) fit(currentShelters());
  VB = viewBox();
  var vb = VB;
  var k = vb.w / vb.sw;                       // 투영단위 / 픽셀
  var r = k * 4.2;                            // 마커 반지름
  var g = [];

  g.push('<rect x="' + vb.x + '" y="' + vb.y + '" width="' + vb.w + '" height="' + vb.h + '" class="sea"/>');
  g.push('<g class="bds" stroke-width="' + (k * 0.9) + '">' + boundaryPaths(vb) + "</g>");

  var acc = state.acc;
  // 반경 원
  if (acc && state.radius > 0) {
    var rd = state.radius / 111320;           // m → 위도 도
    g.push('<circle cx="' + px(acc.lon) + '" cy="' + (-acc.lat) + '" r="' + (rd * KX * 0 + rd)
      + '" class="ring" stroke-width="' + (k * 1.6) + '"/>');
  }
  // 풍향 화살표
  if (acc && state.wind !== "") {
    var deg = +state.wind, L = vb.w * 0.13;
    var to = (deg + 180) % 360, rad = to * Math.PI / 180;
    var ex = px(acc.lon) + Math.sin(rad) * L, ey = -acc.lat - Math.cos(rad) * L;
    g.push('<line x1="' + px(acc.lon) + '" y1="' + (-acc.lat) + '" x2="' + ex + '" y2="' + ey
      + '" class="wind" stroke-width="' + (k * 2) + '"/>');
    g.push('<circle cx="' + ex + '" cy="' + ey + '" r="' + (k * 3.5) + '" class="windhead"/>');
  }

  // 대피장소
  shown.forEach(function (s, i) {
    var cls = "sh" + (s.inRing ? " in" : "") + (i === state.sel ? " sel" : "");
    g.push('<circle cx="' + px(s.lon) + '" cy="' + (-s.lat) + '" r="' + (i === state.sel ? r * 1.7 : r)
      + '" class="' + cls + '" stroke-width="' + (k * 1.1) + '" data-i="' + i + '"/>');
  });
  // 이름 표시 — 겹치지 않을 만큼 여유가 있을 때만. 선택한 곳은 항상 표시한다.
  var cap = vb.sw < 700 ? 8 : (vb.sw < 1000 ? 14 : 20);
  shown.forEach(function (s, i) {
    if (i !== state.sel && shown.length > cap) return;
    g.push('<text x="' + px(s.lon) + '" y="' + (-s.lat - r * 1.9) + '" class="shlbl'
      + (i === state.sel ? " sel" : "") + '" font-size="' + (k * 11) + '">' + esc(s.name) + "</text>");
  });
  if (shown.length > cap)
    g.push('<text x="' + (vb.x + vb.w / 2) + '" y="' + (vb.y + vb.h - k * 12) + '" class="shhint"'
      + ' font-size="' + (k * 10) + '">확대하거나 목록에서 고르면 이름이 표시됩니다</text>');

  // 사고지점
  if (acc) {
    var ax = px(acc.lon), ay = -acc.lat;
    g.push('<line x1="' + (ax - r * 2.2) + '" y1="' + ay + '" x2="' + (ax + r * 2.2) + '" y2="' + ay
      + '" class="acc" stroke-width="' + (k * 2.2) + '"/>');
    g.push('<line x1="' + ax + '" y1="' + (ay - r * 2.2) + '" x2="' + ax + '" y2="' + (ay + r * 2.2)
      + '" class="acc" stroke-width="' + (k * 2.2) + '"/>');
    g.push('<circle cx="' + ax + '" cy="' + ay + '" r="' + (r * 1.15) + '" class="accdot" stroke-width="' + (k * 1.4) + '"/>');
  }

  SVG.setAttribute("viewBox", [vb.x, vb.y, vb.w, vb.h].join(" "));
  SVG.innerHTML = g.join("");

  $$("#map circle.sh").forEach(function (c) {
    c.onclick = function (e) { e.stopPropagation(); select(+c.dataset.i, true); };
  });

  drawScale(vb);
  $("#mapInfo").textContent = shown.length
    ? shown.length + "곳 표시" + (state.acc ? " · 사고지점 기준 정렬" : "")
    : "표시할 대피장소가 없습니다";
}

function drawScale(vb) {
  var mPerUnit = 111320;                       // 투영 1단위(위도 1도) ≈ m
  var target = vb.w / 4 * mPerUnit / KX * KX;  // 화면 1/4 폭에 해당하는 거리(m)
  var nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];
  var pick = nice.reduce(function (a, b) { return Math.abs(b - target) < Math.abs(a - target) ? b : a; });
  var frac = (pick / mPerUnit) / vb.w;
  $("#scaleBar").style.width = Math.max(24, Math.round(frac * vb.sw)) + "px";
  $("#scaleTxt").textContent = pick >= 1000 ? (pick / 1000) + "km" : pick + "m";
}

/* ── 목록 ─────────────────────────────────────────────────── */

function recompute() {
  shown = currentShelters();
  var acc = state.acc;
  shown.forEach(function (s) {
    if (acc) {
      s.d = dist(acc.lat, acc.lon, s.lat, s.lon);
      s.b = bearing(acc.lat, acc.lon, s.lat, s.lon);
      s.inRing = state.radius > 0 && s.d <= state.radius;
      if (state.wind !== "") {
        // 풍향은 '불어오는 쪽'. 바람이 향하는 쪽(풍하) = 풍향 + 180
        var diff = Math.abs(((s.b - ((+state.wind + 180) % 360)) + 540) % 360 - 180);
        s.lee = diff <= 60;                    // 풍하방향 ±60° 안
      } else s.lee = false;
    } else { s.d = null; s.b = null; s.inRing = false; s.lee = false; }
  });
  if (acc) shown.sort(function (a, b) { return a.d - b.d; });
  else shown.sort(function (a, b) { return a.name.localeCompare(b.name, "ko"); });
  state.sel = -1;
}

function renderList() {
  var acc = state.acc;
  $("#listCnt").textContent = shown.length ? shown.length + "곳" : "";
  if (!shown.length) {
    $("#shList").innerHTML = '<p class="empty">선택한 지역에 등록된 대피장소가 없습니다.<br>'
      + "다른 시·군·구를 선택하거나 시·도 전체로 보세요.</p>";
    return;
  }
  var warn = shown.filter(function (s) { return s.inRing; }).length;
  var head = "";
  if (acc && state.radius > 0)
    head = warn
      ? '<div class="alert w" style="margin:10px 12px"><b>확인</b>반경 ' + fmtDist(state.radius)
        + " 안에 대피장소 " + warn + "곳이 있습니다. 영향권일 수 있으니 확인하세요.</div>"
      : '<div class="alert s" style="margin:10px 12px"><b>확인</b>반경 ' + fmtDist(state.radius)
        + " 안에는 등록 대피장소가 없습니다.</div>";
  if (!acc)
    head = '<div class="alert i" style="margin:10px 12px"><b>안내</b>'
      + "지도를 클릭해 사고지점을 잡으면 거리·방위 순으로 정렬됩니다.</div>";

  $("#shList").innerHTML = head + shown.map(function (s, i) {
    var meta = acc
      ? '<b class="d">' + fmtDist(s.d) + "</b> <span>" + dirName(s.b) + "쪽</span>"
        + (s.inRing ? '<span class="tag danger">반경 안</span>' : "")
        + (s.lee ? '<span class="tag lee">풍하방향</span>' : "")
      : "<span>" + esc(s.kind) + "</span>";
    return '<div class="sh' + (i === state.sel ? " sel" : "") + '" data-i="' + i + '">'
      + '<div class="l1"><b>' + esc(s.name) + "</b>"
      + (s.detail ? " <em>" + esc(s.detail) + "</em>" : "") + "</div>"
      + '<div class="l2">' + meta + "</div>"
      + '<div class="l3">' + esc(s.sgg) + " " + esc(s.addr)
      + (s.cap ? " · 수용 " + s.cap.toLocaleString() + "명" : "") + "</div>"
      + (i === state.sel
          ? '<div class="l4">'
            + (s.dept || s.tel ? esc(s.dept) + (s.tel ? " · " + esc(s.tel) : "") + "<br>" : "")
            + '<button class="sm" type="button" data-cp="' + i + '">이름 복사</button> '
            + '<button class="sm" type="button" data-cpa="' + i + '">이름+주소 복사</button>'
            + "</div>" : "")
      + "</div>";
  }).join("");

  $$("#shList .sh").forEach(function (el) {
    el.onclick = function () { select(+el.dataset.i, false); };
  });
  $$("#shList button[data-cp], #shList button[data-cpa]").forEach(function (btn) {
    btn.onclick = function (e) {
      e.stopPropagation();
      var full = btn.hasAttribute("data-cpa");
      var s = shown[+(btn.dataset.cp || btn.dataset.cpa)];
      copyText(full ? s.name + " (" + s.sgg + " " + s.addr + ")" : s.name, btn);
    };
  });
}

function copyText(t, btn) {
  var done = function () {
    var o = btn.textContent; btn.textContent = "복사됨";
    setTimeout(function () { btn.textContent = o; }, 1300);
  };
  if (navigator.clipboard && window.isSecureContext)
    navigator.clipboard.writeText(t).then(done, function () { fallbackCopy(t, done); });
  else fallbackCopy(t, done);
}
function fallbackCopy(t, done) {
  var ta = document.createElement("textarea");
  ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); }
  catch (e) { window.prompt("아래 내용을 복사하세요 (Ctrl+C)", t); }
  document.body.removeChild(ta);
}

function select(i, fromMap) {
  state.sel = (state.sel === i ? -1 : i);
  renderList();
  draw();
  if (!fromMap && state.sel >= 0) {
    var s = shown[state.sel];
    // 선택한 곳이 화면 밖이면 중심 이동
    var vb = VB, sx = px(s.lon), sy = -s.lat;
    if (sx < vb.x || sx > vb.x + vb.w || sy < vb.y || sy > vb.y + vb.h) {
      view.cx = s.lon; view.cy = s.lat; draw();
    }
  }
  if (fromMap && state.sel >= 0) {
    var el = $('#shList .sh[data-i="' + state.sel + '"]');
    if (el) el.scrollIntoView({ block: "nearest" });
  }
}

function refresh() { recompute(); renderList(); draw(); }

/* ── 물질 → 반경 후보 ─────────────────────────────────────── */

function normName(x) { return String(x).replace(/[\s·,()]/g, "").toLowerCase(); }
var MATIDX = null;
function findMaterial(name) {
  if (!MATIDX) {
    MATIDX = {};
    MATERIALS.forEach(function (m) {
      [m.n].concat(m.a || []).concat(m.c ? [m.c] : []).forEach(function (k) {
        var key = normName(k);
        if (key && !MATIDX[key]) MATIDX[key] = m;
      });
    });
  }
  var q = normName(name);
  return MATIDX[q] || MATIDX[q.replace(/\d+(\.\d+)?%?$/, "")] || null;
}

/* "소규모 반경 60m / 대규모 반경 1km 이내" 같은 문장에서 거리 값을 뽑는다 */
function pickDistances(txt) {
  var out = [];
  String(txt).replace(/([\d.]+)\s*(km|m)\b/gi, function (all, n, u) {
    var v = Math.round(parseFloat(n) * (u.toLowerCase() === "km" ? 1000 : 1));
    if (v > 0 && out.indexOf(v) < 0) out.push(v);
    return all;
  });
  return out.sort(function (a, b) { return a - b; });
}

function renderRadHint() {
  var box = $("#radHint");
  var m = state.mat ? findMaterial(state.mat) : null;
  if (!state.mat) { box.innerHTML = ""; return; }
  if (!m) {
    box.innerHTML = '<div class="alert w" style="margin-top:10px"><b>물질정보 없음</b>‘'
      + esc(state.mat) + "’은(는) 460종 목록에 없습니다. 반경을 직접 입력하세요.</div>";
    return;
  }
  var rows = [];
  [["초기이격거리 (전 방향)", m.d1], ["방호활동거리 (풍하방향)", m.d2],
   ["화재 동반 시 대피거리", m.d3]].forEach(function (x) {
    if (!x[1]) return;
    var ds = pickDistances(x[1]);
    rows.push('<div class="radrow"><b>' + esc(x[0]) + "</b><span>" + esc(x[1]) + "</span>"
      + (ds.length ? '<span class="btns">' + ds.map(function (v) {
          return '<button class="sm" type="button" data-r="' + v + '">' + fmtDist(v) + " 적용</button>";
        }).join("") + "</span>" : "") + "</div>");
  });
  box.innerHTML = '<div class="radbox"><div class="hd">' + esc(m.n)
    + (m.s ? ' <em>' + esc(m.s) + "</em>" : "") + "</div>" + rows.join("")
    + '<p class="src">화학물질안전원 「화학사고 현장대응 물질정보」 참고 거리입니다. '
    + "실제 확산 범위가 아니며, 대피 범위 판단은 담당자가 합니다.</p></div>";
  $$("#radHint button[data-r]").forEach(function (b) {
    b.onclick = function () {
      state.radius = +b.dataset.r; $("#mRadius").value = state.radius;
      recompute(); fit(shown); renderList(); draw();
    };
  });
}

/* ── 초기화 ───────────────────────────────────────────────── */

function initSelects() {
  var sido = $("#mSido"), sgg = $("#mSgg");
  sido.innerHTML = '<option value="">전국</option>'
    + Object.keys(SHELTERS).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  var fillSgg = function () {
    var m = SHELTERS[sido.value] || {};
    sgg.innerHTML = '<option value="">' + (sido.value ? "시·도 전체" : "먼저 시·도 선택") + "</option>"
      + Object.keys(m).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  };
  fillSgg();
  sido.onchange = function () {
    state.sido = sido.value; state.sgg = ""; fillSgg();
    recompute(); fit(shown); renderList(); draw();
  };
  sgg.onchange = function () {
    state.sgg = sgg.value;
    recompute(); fit(shown); renderList(); draw();
  };
}

function initMap() {
  SVG = $("#map");

  // 클릭 → 사고지점
  var moved = false;
  SVG.addEventListener("mousedown", function () { moved = false; });
  SVG.addEventListener("click", function (e) {
    if (moved) return;
    var ll = screenToLL(e.clientX, e.clientY);
    setAcc(ll.lat, ll.lon);
  });

  // 드래그 이동
  var drag = null;
  SVG.addEventListener("mousedown", function (e) {
    drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    SVG.classList.add("grab");
  });
  window.addEventListener("mousemove", function (e) {
    if (!drag) return;
    var r = SVG.getBoundingClientRect();
    var dx = (e.clientX - drag.x) / r.width * VB.w;
    var dy = (e.clientY - drag.y) / r.height * VB.h;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) moved = true;
    view.cx = drag.cx - pxInv(dx);
    view.cy = drag.cy + dy;
    draw();
  });
  window.addEventListener("mouseup", function () { drag = null; SVG.classList.remove("grab"); });

  // 휠 확대·축소
  SVG.addEventListener("wheel", function (e) {
    e.preventDefault();
    var ll = screenToLL(e.clientX, e.clientY);
    var f = e.deltaY > 0 ? 1.22 : 1 / 1.22;
    var nw = Math.min(Math.max(view.w * f, 0.004), 9);
    var k = nw / view.w;
    view.cx = ll.lon + (view.cx - ll.lon) * k;
    view.cy = ll.lat + (view.cy - ll.lat) * k;
    view.w = nw;
    draw();
  }, { passive: false });

  var zoom = function (f) {
    view.w = Math.min(Math.max(view.w * f, 0.004), 9); draw();
  };
  $("#zIn").onclick = function () { zoom(1 / 1.4); };
  $("#zOut").onclick = function () { zoom(1.4); };
  $("#zFit").onclick = function () { fit(shown); draw(); };
  window.addEventListener("resize", function () { if (view) draw(); });
}

function setAcc(lat, lon) {
  state.acc = { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 };
  $("#acLat").value = state.acc.lat;
  $("#acLon").value = state.acc.lon;
  refresh();                       // 사고지점 클릭은 시야를 그대로 둔다(클릭한 자리가 유지되도록)
}

function init() {
  // 물질 자동완성
  var dl = document.createElement("datalist");
  dl.id = "matList";
  dl.innerHTML = MATERIALS.map(function (m) {
    return '<option value="' + esc(m.n) + '">' + esc(m.e || "") + "</option>";
  }).join("");
  document.body.appendChild(dl);

  initSelects();
  initMap();

  $("#mMat").oninput = function () { state.mat = this.value.trim(); renderRadHint(); };
  $("#mRadius").oninput = function () {
    var v = parseFloat(String(this.value).replace(/[^\d.]/g, ""));
    state.radius = isFinite(v) && v > 0 ? v : null;
    refresh();
  };
  $("#btnRadClear").onclick = function () { $("#mRadius").value = ""; state.radius = null; refresh(); };
  $("#mWind").onchange = function () { state.wind = this.value; refresh(); };

  var latlon = function () {
    var la = parseFloat($("#acLat").value), lo = parseFloat($("#acLon").value);
    if (isFinite(la) && isFinite(lo) && la > 32 && la < 40 && lo > 123 && lo < 133) {
      state.acc = { lat: la, lon: lo }; refresh();
    }
  };
  $("#acLat").oninput = latlon;
  $("#acLon").oninput = latlon;

  $("#btnPrint").onclick = function () { window.print(); };
  $("#btnClear").onclick = function () {
    state = { sido: "", sgg: "", acc: null, radius: null, wind: "", mat: "", sel: -1 };
    $("#mSido").value = ""; $("#mSido").onchange();
    ["mMat", "mRadius", "acLat", "acLon"].forEach(function (id) { $("#" + id).value = ""; });
    $("#mWind").value = "";
    $("#radHint").innerHTML = "";
    fit(currentShelters()); refresh();
  };

  $("#ver").innerHTML =
    "대피장소 — " + esc(VERSION.대피장소_출처) + " · 기준일 " + esc(VERSION.대피장소_기준일)
    + " (" + SHELTER_META.총건수.toLocaleString() + "곳 · 좌표 포함)<br>"
    + "행정경계 — 통계청 센서스용 행정구역경계(2018) 기반. "
    + "<b>위치를 가늠하기 위한 배경선이며 법적 행정경계가 아닙니다.</b> "
    + "정식 배포 전 원내 정본 데이터로 교체를 권장합니다.<br>"
    + "참고 거리 — " + esc(VERSION.물질정보_출처) + "<br>"
    + "거리 계산 — 지형·도로를 고려하지 않은 직선거리(하버사인)<br>"
    + "지도 — 외부 지도 서비스를 쓰지 않고 좌표를 직접 그립니다. "
    + "도로·건물·지형은 표시되지 않습니다.<br>"
    + "담당자 개인 이름·연락처는 데이터에 포함하지 않았습니다. 관할부서 대표번호만 표시합니다.";

  refresh();
}

document.addEventListener("DOMContentLoaded", init);
})();
