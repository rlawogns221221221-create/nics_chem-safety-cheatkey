/* ============================================================
   화학사고 방제자원 동원

   흩어져 있는 방제자원 네 가지(폐기물 처리업체 · 방제장비 판매업체 ·
   중장비 업체 · 비상캡슐 보유기관)를 한 화면에 모아, 사고지점에서 가까운
   순으로 찾아 바로 연락할 수 있게 합니다.

   ①②(assets/shmap.js, map/app.js)와 같은 엔진(assets/mapcore.js)을 씁니다.
   조작 방법도 ②와 같게 두어 새로 배울 것이 없게 했습니다 —
   사고지점 찍기 → 거리순 목록 → 누르면 지도 가운데.

   ── ②와 다른 점 ────────────────────────────────────────────
   · 자원 종류 — 필요한 자원(무엇을 시킬 것인가)으로 먼저 좁힙니다.
   · 바로 전화 — 목록에서 번호를 누르면 걸립니다(tel:).
   · 동원 목록 — 여러 곳을 담아 업체명·연락처·거리를 한 번에 복사합니다.
     상황실 보고나 무전으로 부를 때 씁니다.

   ── 개인정보 ────────────────────────────────────────────────
   담당자 이름·직통번호는 공개판 데이터(data/resources.js)에 들어 있지
   않습니다. 내부판(data/resources.internal.js)으로 빌드했을 때만 표시되며,
   그 경우 화면 위에 "내부용 · 외부 공유 금지" 띠가 자동으로 뜹니다.

   ── 판단하지 않는 것 ────────────────────────────────────────
   어느 자원을 동원할지, 처리 방법이 적절한지는 정하지 않습니다.
   거리는 직선거리라 실제 도착 시간과 다르고, 업체의 현재 가동 여부·보유
   상태는 담아 둔 자료의 기준일 시점 값이라 연락해서 확인해야 합니다.
   ============================================================ */
(function () {
"use strict";

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
};

var MC = window.MAPCORE;
var wx = MC.wx, wy = MC.wy, wxInv = MC.wxInv, wyInv = MC.wyInv;
var mToWorld = MC.mToWorld;
var distM = MC.distM, bearing = MC.bearing, dirName = MC.dirName, fmtDist = MC.fmtDist;

var KINDS = window.RESOURCE_KINDS || [];
var KIND_NAME = {};
KINDS.forEach(function (k) { KIND_NAME[k.id] = k.이름; });

var st = {
  sido: "", sgg: "",
  scope: "",                        // "" = 시·군·구 관내 / 숫자 = 사고지점 반경 (m)
  acc: null,                        // 사고지점 {lat, lon}
  kinds: {},                        // 켜 둔 자원 종류 (기본 전부)
  q: "", sort: "dist",
  rings: true,
  mode: "pick",                     // "acc" = 다음 클릭이 사고지점
  me: null,                         // 내 위치 {lat, lon, acc} — 사고지점과 별개
  all: [], show: [],
  sel: -1, hover: -1,
  mob: {},                          // 동원 목록에 담은 것 (key → 자원)
  view: null
};
KINDS.forEach(function (k) { st.kinds[k.id] = true; });

var SVG = null, VB = null;
var CAM = MC.camera(function () { return st.view; }, function (v) { st.view = v; }, draw);

MC.tiles.onChange(function () { if (st.view) { draw(); showSrc(); } });

function keyOf(r) { return r.t + "|" + r.n + "|" + r.la + "," + r.lo; }

/* 어디 소속인지 보이게 시·군·구를 앞에 붙인다 — 반경으로 찾으면 여러 시·군·구가
   섞이기 때문이다. 원자료의 주소는 시·군·구가 빠진 것이 원칙이지만 들어 있는
   행도 있어, 이미 있으면 덧붙이지 않는다("여수시 여수시 …" 방지). */
function placeOf(r) {
  var addr = String(r.a || "");
  return addr.indexOf(r.sg) >= 0 ? addr : (r.sg + " " + addr).trim();
}

/* ── 표시 대상 고르기 ────────────────────────────────────────
   방제자원은 대피장소와 달리 관내에 없을 수 있습니다(비상캡슐은 시·군에
   한 곳도 없는 경우가 흔합니다). 그래서 반경으로 찾는 범위를 ②보다 넓게
   (10~100km) 두었습니다 — 옆 시·도에서 불러야 하는 상황이 실제로 생깁니다. */
function sourceList() {
  var ALL = window.RESOURCES || [];
  var rows;
  if (st.scope && st.acc) {
    var r = +st.scope;
    rows = ALL.filter(function (s) {
      return distM(st.acc.lat, st.acc.lon, s.la, s.lo) <= r;
    });
  } else if (st.sido || st.sgg) {
    rows = ALL.filter(function (s) {
      return (!st.sido || s.sd === st.sido) && (!st.sgg || s.sg === st.sgg);
    });
  } else {
    rows = [];
  }
  return rows.filter(function (s) { return st.kinds[s.t]; });
}

function recompute() {
  st.all = sourceList();
  var acc = st.acc;
  st.all.forEach(function (s) {
    if (acc) {
      s.d = distM(acc.lat, acc.lon, s.la, s.lo);
      s.b = bearing(acc.lat, acc.lon, s.la, s.lo);
    } else { s.d = null; s.b = null; }
  });

  var q = st.q.trim().toLowerCase();
  st.show = st.all.filter(function (s) {
    if (!q) return true;
    return (s.n + " " + (s.a || "") + " " + (s.c || "") + " " + s.sg + " "
            + (KIND_NAME[s.t] || "")).toLowerCase().indexOf(q) >= 0;
  });

  if (st.sort === "dist" && acc) st.show.sort(function (a, b) { return a.d - b.d; });
  else st.show.sort(function (a, b) { return a.n.localeCompare(b.n, "ko"); });

  st.sel = -1; st.hover = -1;
}

/* ── 시야 ─────────────────────────────────────────────────── */
function sggBox() {
  if (!st.sgg || typeof window.BOUNDARIES === "undefined") return null;
  var m = 2, M = -1, n = 2, N = -1, any = false;
  window.BOUNDARIES.forEach(function (f) {
    if (f.s !== st.sido || !MC.matchSgg(f.n, st.sgg)) return;
    f.r.forEach(function (ring) {
      var X = 0, Y = 0;
      for (var i = 0; i < ring.length; i += 2) {
        if (i === 0) { X = ring[0]; Y = ring[1]; } else { X += ring[i]; Y += ring[i + 1]; }
        var x = wx(X / window.BOUNDARY_SCALE), y = wy(Y / window.BOUNDARY_SCALE);
        m = Math.min(m, x); M = Math.max(M, x); n = Math.min(n, y); N = Math.max(N, y); any = true;
      }
    });
  });
  return any ? { m: m, M: M, n: n, N: N } : null;
}

function fitTarget() {
  var m = 2, M = -1, n = 2, N = -1, any = false;
  var add = function (x, y) {
    m = Math.min(m, x); M = Math.max(M, x);
    n = Math.min(n, y); N = Math.max(N, y);
    any = true;
  };
  st.show.forEach(function (s) { add(wx(s.lo), wy(s.la)); });
  if (!st.scope) {
    var b = sggBox();
    if (b) { add(b.m, b.n); add(b.M, b.N); }
  }
  if (st.acc) {
    var far = st.scope ? +st.scope : 0;
    var r = far ? mToWorld(far, st.acc.lat) : 0;
    add(wx(st.acc.lon) - r, wy(st.acc.lat) - r);
    add(wx(st.acc.lon) + r, wy(st.acc.lat) + r);
  }
  if (!any) return { cx: wx(127.8), cy: wy(36.3), w: 0.09 };      // 전국
  var w = (M - m) * 1.22, h = (N - n) * 1.22;
  return { cx: (m + M) / 2, cy: (n + N) / 2, w: Math.max(w, h * 1.35, 0.00035) };
}

function fit() {
  var t = fitTarget();
  if (!st.view) { st.view = t; draw(); return; }
  CAM.animateTo(t, 420);
}

/* 고른 자원은 항상 화면 가운데로 옮깁니다. 사고지점은 무리 없이 함께 보일
   때만 시야를 넓혀 포함시키고, 그보다 멀면 억지로 끼워 맞추지 않습니다 —
   연결선이 화면 밖으로 이어지는 건 괜찮지만 고른 곳이 안 보이면 안 됩니다. */
function moveTo(s) {
  if (!st.view) fit();
  var base = Math.min(st.view.w, mToWorld(1600, s.la));
  var want = base;
  if (st.acc) {
    var span = Math.max(Math.abs(wx(s.lo) - wx(st.acc.lon)),
                        Math.abs(wy(s.la) - wy(st.acc.lat)) * 1.35) * 2.6;
    want = Math.min(Math.max(base, span), base * 6);
  }
  CAM.animateTo({ cx: wx(s.lo), cy: wy(s.la), w: want }, 340);
}

/* ── 좌표 변환 ────────────────────────────────────────────── */
function svgSize() {
  var r = SVG.getBoundingClientRect();
  return { w: r.width || 720, h: r.height || 520 };
}
function viewBox() {
  var s = svgSize();
  var w = st.view.w, h = w * (s.h / s.w);
  return { x: st.view.cx - w / 2, y: st.view.cy - h / 2, w: w, h: h, sw: s.w, sh: s.h };
}
function pX(lon) { return (wx(lon) - VB.x) / VB.w * VB.sw; }
function pY(lat) { return (wy(lat) - VB.y) / VB.h * VB.sh; }
function pxLen(m, lat) { return mToWorld(m, lat) / VB.w * VB.sw; }
function toLL(clientX, clientY) {
  var r = SVG.getBoundingClientRect();
  var x = VB.x + (clientX - r.left) / r.width * VB.w;
  var y = VB.y + (clientY - r.top) / r.height * VB.h;
  return { lon: wxInv(x), lat: wyInv(y) };
}

/* ── 거리 눈금 ────────────────────────────────────────────── */
function ringDists(vb) {
  if (!st.acc || !st.rings) return [];
  var latC = wyInv(vb.y + vb.h / 2);
  var fullM = distM(latC, wxInv(vb.x), latC, wxInv(vb.x + vb.w));
  var step = MC.niceDist(fullM / 5);
  var lim = fullM * 0.75;
  var out = [];
  for (var i = 1; i <= 5 && step * i <= lim; i++) out.push(step * i);
  return out;
}

/* ── 마커 모양 ────────────────────────────────────────────────
   색만으로 구분하면 배경지도 위에서 헷갈리고 색각 이상이 있는 사람은
   구분하지 못합니다. 그래서 종류마다 모양을 다르게 그립니다.
     폐기물 ● 원   장비 ■ 사각   중장비 ▲ 삼각   비상캡슐 ◆ 마름모 */
function markerShape(kind, x, y, r, cls, extra) {
  var a = ' class="' + cls + '"' + (extra || "");
  var f = function (v) { return v.toFixed(1); };
  if (kind === "equip")
    return '<rect x="' + f(x - r) + '" y="' + f(y - r) + '" width="' + f(r * 2)
         + '" height="' + f(r * 2) + '" rx="1.5"' + a + "/>";
  if (kind === "heavy")
    return '<path d="M' + f(x) + " " + f(y - r * 1.15) + "L" + f(x + r * 1.1) + " " + f(y + r * 0.8)
         + "L" + f(x - r * 1.1) + " " + f(y + r * 0.8) + 'Z"' + a + "/>";
  if (kind === "capsule")
    return '<path d="M' + f(x) + " " + f(y - r * 1.25) + "L" + f(x + r * 1.25) + " " + f(y)
         + "L" + f(x) + " " + f(y + r * 1.25) + "L" + f(x - r * 1.25) + " " + f(y) + 'Z"' + a + "/>";
  return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '"' + a + "/>";
}

/* ── 그리기 ───────────────────────────────────────────────── */
function draw() {
  if (!st.view) fit();
  VB = viewBox();
  var vb = VB, g = [];
  var R = 6;

  g.push('<rect x="0" y="0" width="' + vb.sw + '" height="' + vb.sh + '" class="bg"/>');
  var tl = MC.tiles.layer(vb);
  g.push(tl);
  SVG.classList.toggle("hasbg", !!tl);
  g.push('<g class="bds">' + MC.boundaryPaths(vb, function (f) {
    return !st.scope && f.s === st.sido && MC.matchSgg(f.n, st.sgg);
  }) + "</g>");

  var acc = st.acc, ax = 0, ay = 0;
  if (acc) { ax = pX(acc.lon); ay = pY(acc.lat); }

  ringDists(vb).forEach(function (d) {
    var rr = pxLen(d, acc.lat);
    g.push('<circle class="grid" cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1)
      + '" r="' + rr.toFixed(1) + '"/>');
    g.push('<text class="gridlbl" x="' + ax.toFixed(1) + '" y="' + (ay - rr + 13).toFixed(1)
      + '" font-size="11">' + fmtDist(d) + "</text>");
  });

  /* 사고지점 ↔ 고르거나 가리킨 곳 경로선. 방제자원은 장비를 싣고 차로
     움직이므로 도보가 아니라 차량 기준 도착시간을 함께 적습니다. */
  var focus = st.hover >= 0 ? st.show[st.hover] : (st.sel >= 0 ? st.show[st.sel] : null);
  if (acc && focus) {
    var fx = pX(focus.lo), fy = pY(focus.la);
    g.push(MC.routePath(ax, ay, fx, fy));
    g.push('<text class="linklbl" x="' + ((ax + fx) / 2).toFixed(1)
      + '" y="' + ((ay + fy) / 2 - 9).toFixed(1) + '" font-size="12.5">'
      + fmtDist(focus.d) + " " + dirName(focus.b) + "쪽 · "
      + MC.trip(focus.d, "car").label + "</text>");
  }

  /* 자원 마커 — 담아 둔 것은 테두리를 굵게 해서 한눈에 보이게 한다 */
  st.show.forEach(function (s, i) {
    var on = i === st.sel, hv = i === st.hover, inMob = !!st.mob[keyOf(s)];
    var cls = "rk rk-" + s.t + (on ? " on" : "") + (hv ? " hv" : "")
            + (inMob ? " mob" : "") + (s.ap === false ? " approx" : "");
    g.push(markerShape(s.t, pX(s.lo), pY(s.la), on ? R * 1.5 : R, cls, ' data-i="' + i + '"'));
  });

  var cap = vb.sw < 560 ? 8 : (vb.sw < 900 ? 14 : 22);
  st.show.forEach(function (s, i) {
    if (i !== st.sel && i !== st.hover && !st.mob[keyOf(s)] && st.show.length > cap) return;
    g.push('<text class="mkl' + (i === st.sel ? " on" : "") + '" x="' + pX(s.lo).toFixed(1)
      + '" y="' + (pY(s.la) - R * 2).toFixed(1) + '" font-size="12">'
      + esc(s.n) + (s.d != null ? " " + fmtDist(s.d) : "") + "</text>");
  });
  if (st.show.length > cap)
    g.push('<text class="mkh" x="' + (vb.sw / 2) + '" y="' + (vb.sh - 10)
      + '" font-size="11">확대하거나 목록에서 가리키면 이름이 보입니다</text>');

  /* 내 위치가 사고지점과 사실상 같은 자리인가 — 내 위치 단추로 찍은 직후가
     늘 그렇습니다. 마커와 라벨을 겹쳐 그리지 않고 십자 하나로 합칩니다. */
  var meIsAcc = !!(st.me && acc
    && distM(acc.lat, acc.lon, st.me.lat, st.me.lon) <= Math.max(st.me.acc || 0, 25));

  if (acc) {
    var L2 = 13;
    g.push('<line class="acc" x1="' + (ax - L2).toFixed(1) + '" y1="' + ay.toFixed(1)
      + '" x2="' + (ax + L2).toFixed(1) + '" y2="' + ay.toFixed(1) + '"/>');
    g.push('<line class="acc" x1="' + ax.toFixed(1) + '" y1="' + (ay - L2).toFixed(1)
      + '" x2="' + ax.toFixed(1) + '" y2="' + (ay + L2).toFixed(1) + '"/>');
    g.push('<circle class="accdot" cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="6"/>');
    g.push('<text class="acclbl" x="' + ax.toFixed(1) + '" y="' + (ay - L2 - 5).toFixed(1)
      + '" font-size="12">사고지점' + (meIsAcc ? " · 내 위치" : "") + "</text>");
  }

  /* 내 위치 — 맨 나중에 그려 무엇에도 가리지 않게 한다 (②와 같은 방식) */
  if (st.me) {
    var mx = pX(st.me.lon), my = pY(st.me.lat);
    if (st.me.acc > 0) {
      var ar = pxLen(st.me.acc, st.me.lat);
      if (ar > 6) g.push('<circle class="meacc" cx="' + mx.toFixed(1) + '" cy="'
        + my.toFixed(1) + '" r="' + Math.min(ar, vb.sw).toFixed(1) + '"/>');
    }
    if (!meIsAcc) {
      g.push('<circle class="mepulse" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="19"/>');
      g.push('<circle class="me" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="6.6"/>');
      g.push('<text class="melbl" x="' + mx.toFixed(1) + '" y="' + (my + 21).toFixed(1)
        + '" font-size="11.5">내 위치</text>');
    }
  }

  SVG.setAttribute("viewBox", "0 0 " + vb.sw + " " + vb.sh);
  SVG.innerHTML = g.join("");
  drawScale(vb);
}

function drawScale(vb) {
  var s = MC.scale(vb);
  $("#scaleBar").style.width = s.px + "px";
  $("#scaleTxt").textContent = s.label;
}

function hitMarker(clientX, clientY) {
  var rc = SVG.getBoundingClientRect();
  var best = -1, bd = 1e9, TH = 18;
  st.show.forEach(function (s, i) {
    var dx = rc.left + pX(s.lo) - clientX, dy = rc.top + pY(s.la) - clientY;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < bd) { bd = d; best = i; }
  });
  return bd <= TH ? best : -1;
}

/* ── 요약 줄 — 종류별로 가장 가까운 곳 ──────────────────────────
   ②는 "가장 가까운 대피장소 하나"가 답이지만, 방제자원은 종류마다 하나씩
   필요합니다(폐기물 처리업체를 열 곳 아는 것보다, 네 종류를 하나씩 아는 게
   쓸모 있습니다). 그래서 종류별 최근접을 한 줄로 보여주고, 누르면 그 자원이
   바로 선택됩니다. */
function renderSummary() {
  var el = $("#mSum");
  if (!st.acc) { el.hidden = true; return; }
  el.hidden = false;

  var parts = [];
  KINDS.forEach(function (k) {
    var pool = (window.RESOURCES || []).filter(function (s) { return s.t === k.id; });
    if (!pool.length) return;
    var near = null, nd = Infinity;
    pool.forEach(function (s) {
      var d = distM(st.acc.lat, st.acc.lon, s.la, s.lo);
      if (d < nd) { nd = d; near = s; }
    });
    if (!near) return;
    var off = !st.kinds[k.id];
    parts.push('<button type="button" class="ms-k' + (off ? " z" : "") + '" data-k="'
      + esc(k.id) + '" data-key="' + esc(keyOf(near)) + '" title="'
      + esc(near.n) + " — " + esc(k.쓰임) + '">'
      + '<i class="rkdot rk-' + k.id + '"></i>' + esc(k.이름.replace(/ (업체|판매업체|보유기관|처리업체)$/, ""))
      + " <em>" + fmtDist(nd) + " · " + MC.trip(nd, "car").label + "</em></button>");
  });

  el.innerHTML = '<span class="ms-near"><b>가장 가까운 곳</b></span>'
    + '<span class="ms-bands">' + parts.join("") + "</span>"
    + '<span class="ms-note">직선거리로 어림한 값 · 연락 전 가동 여부를 확인하세요</span>';

  $$(".ms-k", el).forEach(function (b) {
    b.onclick = function () { jumpToKey(b.dataset.k, b.dataset.key); };
  });
}

/* 요약 줄에서 종류를 누르면 — 꺼져 있던 종류면 켜고, 그 자원을 골라 보여준다 */
function jumpToKey(kind, key) {
  if (!st.kinds[kind]) { st.kinds[kind] = true; renderChips(); }
  if (!st.scope) {                       // 관내에 없을 수 있으므로 반경으로 넓힌다
    var t = window.RESOURCES.filter(function (s) { return keyOf(s) === key; })[0];
    if (t) {
      var d = distM(st.acc.lat, st.acc.lon, t.la, t.lo);
      var pick = ["10000", "20000", "50000", "100000"].filter(function (v) { return +v >= d; })[0];
      if (pick) { st.scope = pick; $("#mScope").value = pick; }
    }
  }
  if (st.sort !== "dist") { st.sort = "dist"; $("#mSort").value = "dist"; }
  recompute(); renderList(); renderLegend();
  var i = -1;
  st.show.forEach(function (s, k) { if (keyOf(s) === key) i = k; });
  if (i >= 0) select(i, false);
  else { draw(); }
}

/* ── 종류 칩 ──────────────────────────────────────────────── */
function renderChips() {
  $("#rKinds").innerHTML = KINDS.map(function (k) {
    return '<button type="button" class="rk-chip" data-k="' + esc(k.id) + '"'
      + ' aria-pressed="' + (st.kinds[k.id] ? "true" : "false") + '"'
      + ' title="' + esc(k.쓰임) + '">'
      + '<i class="rkdot rk-' + k.id + '"></i>' + esc(k.이름) + "</button>";
  }).join("");
  $$("#rKinds .rk-chip").forEach(function (b) {
    b.onclick = function () {
      st.kinds[b.dataset.k] = !st.kinds[b.dataset.k];
      /* 전부 꺼 두면 화면이 비어 당황하게 되므로 최소 하나는 남긴다 */
      if (!KINDS.some(function (k) { return st.kinds[k.id]; })) st.kinds[b.dataset.k] = true;
      renderChips(); refresh(false);
    };
  });
}

/* ── 목록 ─────────────────────────────────────────────────── */
function telLink(num, cls) {
  var t = String(num || "").trim();
  if (!t) return "";
  return '<a class="' + cls + '" href="tel:' + esc(t.replace(/[^0-9+]/g, "")) + '">'
    + esc(t) + "</a>";
}

function renderList() {
  var acc = st.acc;
  $("#listCnt").textContent = st.all.length
    ? (st.q ? st.show.length + " / " + st.all.length + "곳" : st.all.length + "곳") : "";

  if (!st.show.length) {
    $("#resList").innerHTML = '<p class="ms-empty">'
      + (!st.sido && !st.sgg && !st.scope
          ? "시·도와 시·군·구를 고르세요.<br>사고지점을 찍은 뒤 <b>찾는 범위</b>를 반경으로 바꾸면 행정구역과 상관없이 찾습니다."
         : st.q ? "‘" + esc(st.q) + "’ 과(와) 맞는 곳이 없습니다."
         : "선택한 범위에 등록된 방제자원이 없습니다.<br>범위를 넓히거나 자원 종류를 더 켜 보세요.")
      + "</p>";
    return;
  }

  var maxD = 0;
  if (acc) st.show.forEach(function (s) { maxD = Math.max(maxD, s.d); });

  $("#resList").innerHTML = st.show.map(function (s, i) {
    var on = i === st.sel, inMob = !!st.mob[keyOf(s)];
    var bar = acc && maxD
      ? '<div class="ms-bar"><i style="width:' + Math.max(2, Math.round(s.d / maxD * 100)) + '%"></i></div>'
      : "";
    return '<div class="ms-it rs-it' + (on ? " on" : "") + (inMob ? " inmob" : "")
      + '" data-i="' + i + '" role="button" tabindex="0" aria-pressed="' + (on ? "true" : "false") + '">'
      + '<div class="l1"><i class="rkdot rk-' + s.t + '"></i><b>' + esc(s.n) + "</b>"
      + (acc ? '<span class="d">' + fmtDist(s.d) + " " + dirName(s.b) + "</span>" : "")
      + "</div>" + bar
      + (acc ? '<div class="l6"><em>' + MC.trip(s.d, "car").label
               + "</em> · 장비 상·하차 시간은 빠져 있습니다</div>" : "")
      + '<div class="rs-cap">' + esc(s.c || "") + "</div>"
      + '<div class="l2">' + esc(placeOf(s))
      + (s.ap === false ? ' <span class="rs-approx">대략 위치</span>' : "") + "</div>"
      + '<div class="rs-tel">'
        + '<span class="rs-t1">대표</span>' + telLink(s.tel, "rs-num")
        + (s.p ? '<span class="rs-t1 rs-in">담당 ' + esc(s.p.n) + "</span>"
                 + telLink(s.p.t, "rs-num rs-num-in") : "")
      + "</div>"
      + (on ? '<div class="l4 noprint">'
              + '<button class="sm ' + (inMob ? "" : "p ") + 'rs-mob" type="button" data-mob="' + i + '">'
              + (inMob ? "동원 목록에서 빼기" : "동원 목록에 담기") + "</button>"
              + '<button class="sm" type="button" data-cp="' + i + '">정보 복사</button>'
              + "</div>" : "")
      + "</div>";
  }).join("");

  $$("#resList .ms-it").forEach(function (el) {
    var i = +el.dataset.i;
    el.onclick = function (e) {
      if (e.target.tagName === "A" || e.target.tagName === "BUTTON") return;
      select(i, false);
    };
    el.onkeydown = function (e) {
      if (e.target.tagName === "A") return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i, false); }
    };
    el.onmouseenter = function () { st.hover = i; draw(); showAddr(); };
    el.onmouseleave = function () { if (st.hover === i) { st.hover = -1; draw(); showAddr(); } };
  });
  $$("#resList button[data-mob]").forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); toggleMob(st.show[+b.dataset.mob]); };
  });
  $$("#resList button[data-cp]").forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); copyText(oneLine(st.show[+b.dataset.cp]), b); };
  });
}

function select(i, fromMap) {
  st.sel = (st.sel === i ? -1 : i);
  renderList(); draw(); showAddr();
  if (st.sel >= 0 && !fromMap) moveTo(st.show[st.sel]);
  if (st.sel >= 0 && fromMap) {
    var el = $('#resList .ms-it[data-i="' + st.sel + '"]');
    if (el) el.scrollIntoView({ block: "nearest" });
  }
}

function showAddr() {
  var el = $("#mAddr");
  var s = st.hover >= 0 ? st.show[st.hover] : (st.sel >= 0 ? st.show[st.sel] : null);
  if (!s) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = "<b>" + esc(s.n) + "</b>"
    + " <i>" + esc(KIND_NAME[s.t] || "") + "</i>"
    + "<span>" + esc(placeOf(s)) + "</span>"
    + (s.c ? "<span>" + esc(s.c) + "</span>" : "")
    + (s.d != null ? "<em>사고지점에서 " + fmtDist(s.d) + " " + dirName(s.b) + "쪽</em>" : "");
}

/* 종류 이름을 앞머리와 꼬리로 나눠 둔다("폐기물" + " 처리업체").
   좁은 화면에서는 CSS 가 꼬리를 감춰 범례가 한 줄에 들어간다 — 네 종류를
   전부 풀어 쓰면 세 줄(83px)이 되어 작은 지도의 22%를 덮었다.
   긴 이름은 오른쪽 목록의 종류 칩에 그대로 남아 있다. */
function legendName(name) {
  var m = /^(.*?)( (?:판매업체|처리업체|보유기관|업체))$/.exec(name);
  if (!m) return esc(name);
  return esc(m[1]) + '<i class="lg-t">' + esc(m[2]) + "</i>";
}

function renderLegend() {
  var it = KINDS.filter(function (k) { return st.kinds[k.id]; }).map(function (k) {
    return '<span><i class="rkdot rk-' + k.id + '"></i>' + legendName(k.이름) + "</span>";
  });
  if (st.acc) it.push('<span><i class="dot ac"></i>사고지점</span>');
  if (st.me) it.push('<span><i class="dot me"></i>내 위치</span>');
  if (st.acc && st.rings) it.push('<span><i class="dot gr"></i>거리 눈금</span>');
  $("#mLeg").innerHTML = it.join("");
}

/* ── 동원 목록 ────────────────────────────────────────────────
   여러 곳을 담아 한 번에 복사합니다. 상황실 보고나 무전으로 부를 때
   업체명·연락처·거리를 하나씩 옮겨 적는 수고를 덜기 위한 것입니다. */
function toggleMob(s) {
  var k = keyOf(s);
  if (st.mob[k]) delete st.mob[k]; else st.mob[k] = s;
  renderList(); renderMob(); draw();
}

function mobList() {
  return Object.keys(st.mob).map(function (k) { return st.mob[k]; })
    .sort(function (a, b) { return (a.d || 0) - (b.d || 0); });
}

function renderMob() {
  var el = $("#mobBar"), n = Object.keys(st.mob).length;
  el.hidden = !n;
  if (!n) return;
  el.innerHTML = '<span class="mob-n">동원 목록 <b>' + n + "</b>곳</span>"
    + '<button type="button" class="sm p" id="mobCopy">전체 복사</button>'
    + '<button type="button" class="sm" id="mobClear">비우기</button>';
  $("#mobCopy").onclick = function () { copyText(mobText(), $("#mobCopy")); };
  $("#mobClear").onclick = function () { st.mob = {}; renderList(); renderMob(); draw(); };
}

function oneLine(s) {
  return s.n + " (" + (KIND_NAME[s.t] || "") + ") · " + placeOf(s)
    + " · 대표 " + (s.tel || "-")
    + (s.p ? " · 담당 " + s.p.n + " " + s.p.t : "")
    + (s.d != null ? " · 사고지점에서 " + fmtDist(s.d) + " " + dirName(s.b) + "쪽"
                     + " (" + MC.trip(s.d, "car").label + ")" : "")
    + (s.c ? "\n  " + s.c : "");
}

function mobText() {
  var now = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
  var ts = now.getFullYear() + "-" + p(now.getMonth() + 1) + "-" + p(now.getDate())
         + " " + p(now.getHours()) + ":" + p(now.getMinutes());
  var L = ["화학사고 방제자원 동원 목록", "작성일시: " + ts];
  if (st.acc) L.push("사고지점: " + st.acc.lat + ", " + st.acc.lon);
  L.push("");
  mobList().forEach(function (s, i) { L.push((i + 1) + ". " + oneLine(s)); });
  L.push("", "※ 거리는 직선거리이고, 소요시간은 그것을 도로 사정에 맞춰 늘려 잡은"
    + " 어림값입니다. 장비 상·하차와 통제 상황은 빠져 있으므로 실제 도착은 더 걸립니다."
    + " 연락 전 가동 여부·보유 상태를 확인하세요.");
  if (RESOURCE_META && RESOURCE_META.예시자료)
    L.push("※ 예시 자료로 만든 목록입니다 — 실제 업체가 아닙니다.");
  return L.join("\n");
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

function refresh(refit) {
  recompute();
  syncSort(); renderSummary(); renderList(); renderLegend(); renderMob();
  if (refit) fit(); else draw();
  showAddr();
}

function syncSort() {
  $$("#mSort option").forEach(function (o) { if (o.value === "dist") o.disabled = !st.acc; });
  if (!st.acc && st.sort === "dist") { st.sort = "name"; $("#mSort").value = "name"; }
  $$("#mScope option").forEach(function (o) { if (o.value) o.disabled = !st.acc; });
}

/* ── 사고지점 ─────────────────────────────────────────────── */
function setMode(m) {
  st.mode = m;
  var b = $("#btnAcc");
  b.setAttribute("aria-pressed", String(m === "acc"));
  b.textContent = m === "acc" ? "지도를 누르세요" : (st.acc ? "사고지점 다시 찍기" : "사고지점 찍기");
  SVG.classList.toggle("crosshair", m === "acc");
}

function setAcc(lat, lon, jump) {
  st.acc = { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 };
  $("#acLat").value = st.acc.lat;
  $("#acLon").value = st.acc.lon;
  if (st.sort === "name") { st.sort = "dist"; $("#mSort").value = "dist"; }
  setMode("pick");
  recompute();
  syncSort(); renderSummary(); renderList(); renderLegend(); showAddr();
  moveToAcc(!!jump);
}

function moveToAcc(jump) {
  var near = st.all.length
    ? st.all.slice().sort(function (a, b) { return a.d - b.d; }).slice(0, 3) : [];
  var reach = Math.max(near.length ? near[near.length - 1].d : 0,
                       st.scope ? +st.scope : 0) || 3000;
  var w = mToWorld(reach * 2.6, st.acc.lat);
  if (!st.view) { st.view = { cx: wx(st.acc.lon), cy: wy(st.acc.lat), w: w }; draw(); return; }
  var farAway = Math.abs(wx(st.acc.lon) - st.view.cx) > st.view.w
             || Math.abs(wy(st.acc.lat) - st.view.cy) > st.view.w;
  if (!jump && !farAway && w >= st.view.w * 0.85) { draw(); return; }
  var tw = farAway ? Math.max(w, st.view.w * 0.5) : Math.min(w, st.view.w);
  CAM.animateTo({ cx: wx(st.acc.lon), cy: wy(st.acc.lat), w: tw }, 420);
}

function clearAcc() {
  st.acc = null; st.scope = "";
  $("#acLat").value = ""; $("#acLon").value = ""; $("#mScope").value = "";
  st.sort = "name"; $("#mSort").value = "name";
  setMode("pick");
  refresh(true);
}

/* ── 내 위치 ──────────────────────────────────────────────────
   ②(map/app.js)와 같은 방식입니다. 다만 여기서 잡는 기본 반경은 훨씬
   넓습니다 — 방제자원은 관내에 아예 없는 경우가 흔해, 5km로 잡으면
   빈 목록이 나오기 때문입니다. */
var toastTimer = null;
function toast(msg, isErr) {
  var el = $("#mToast");
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  if (!msg) { el.hidden = true; return; }
  el.hidden = false;
  el.className = "mtoast noprint" + (isErr ? " err" : "");
  el.innerHTML = msg;
  toastTimer = setTimeout(function () { el.hidden = true; toastTimer = null; },
                          isErr ? 11000 : 5000);
}

function locateMe() {
  var b = $("#btnMe");
  b.setAttribute("aria-busy", "true");
  toast("위치를 찾고 있습니다…");
  MC.locate(function (r) {
    b.removeAttribute("aria-busy");
    if (r.err) { st.me = null; toast("<b>내 위치를 찾지 못했습니다.</b> " + r.err, true); draw(); return; }
    st.me = r;
    var rough = r.acc > 300;
    if (!st.acc) {
      var wide = !st.scope && !st.sido && !st.sgg;
      if (wide) st.scope = "20000";            // 방제자원은 관내에 없기 일쑤다
      setAcc(r.lat, r.lon, true);
      if (wide) $("#mScope").value = "20000";
      toast("<b>내 위치를 사고지점으로 찍었습니다.</b> 오차 약 ±" + fmtDist(r.acc)
        + (rough ? " — 실내라 넓게 잡혔습니다. 지도를 눌러 정확한 자리로 고쳐 주세요." : "")
        + " 자리가 다르면 지도를 눌러 다시 찍으면 됩니다.", rough);
    } else {
      var d = distM(st.acc.lat, st.acc.lon, r.lat, r.lon);
      toast("<b>내 위치를 표시했습니다.</b> 사고지점에서 " + fmtDist(d) + " · "
        + MC.trip(d, "car").label + " 거리입니다. 사고지점은 그대로 두었습니다.");
      moveToMe();
    }
    renderLegend(); draw();
  });
}

function moveToMe() {
  if (!st.me) return;
  var w = mToWorld(Math.max(st.me.acc * 6, 900), st.me.lat);
  if (!st.view) { st.view = { cx: wx(st.me.lon), cy: wy(st.me.lat), w: w }; draw(); return; }
  CAM.animateTo({ cx: wx(st.me.lon), cy: wy(st.me.lat), w: Math.min(w, st.view.w) }, 420);
}

/* ── 주소·장소 검색 ────────────────────────────────────────────
   ②와 같은 방식이되 찾는 대상이 대피장소가 아니라 방제자원입니다.
   임의의 도로명 주소를 다 찾아 주는 것이 아니라, 이 도구가 담고 있는
   자료 안에서만 찾습니다(오프라인). */
var PLACE_IDX = null;
function boundaryCenter(sido, sgg) {
  if (typeof window.BOUNDARIES === "undefined") return null;
  var m = 2, M = -1, n = 2, N = -1, any = false;
  window.BOUNDARIES.forEach(function (f) {
    if (f.s !== sido || !MC.matchSgg(f.n, sgg)) return;
    f.r.forEach(function (ring) {
      var X = 0, Y = 0;
      for (var i = 0; i < ring.length; i += 2) {
        if (i === 0) { X = ring[0]; Y = ring[1]; } else { X += ring[i]; Y += ring[i + 1]; }
        var x = wx(X / window.BOUNDARY_SCALE), y = wy(Y / window.BOUNDARY_SCALE);
        m = Math.min(m, x); M = Math.max(M, x); n = Math.min(n, y); N = Math.max(N, y); any = true;
      }
    });
  });
  return any ? { lat: wyInv((n + N) / 2), lon: wxInv((m + M) / 2) } : null;
}
function placeIndex() {
  if (PLACE_IDX) return PLACE_IDX;
  var out = [], seen = {};
  (window.RESOURCES || []).forEach(function (r) {
    out.push({ label: r.n + " · " + placeOf(r), lat: r.la, lon: r.lo,
               sido: r.sd, sgg: r.sg, kind: "place" });
    var key = r.sd + "|" + r.sg;
    if (!seen[key]) {
      seen[key] = true;
      var c = boundaryCenter(r.sd, r.sg);
      out.push({ label: r.sd + " " + r.sg, lat: c ? c.lat : r.la, lon: c ? c.lon : r.lo,
                 sido: r.sd, sgg: r.sg, kind: "sgg" });
    }
  });
  PLACE_IDX = out;
  return out;
}
var KIND_ORDER = { sgg: 0, place: 1 };
function searchPlaces(q) {
  var nq = String(q || "").trim().replace(/\s+/g, "");
  if (nq.length < 1) return [];
  var rows = placeIndex().filter(function (p) {
    return p.label.replace(/\s+/g, "").indexOf(nq) >= 0;
  });
  rows.sort(function (a, b) {
    var an = a.label.replace(/\s+/g, ""), bn = b.label.replace(/\s+/g, "");
    var ra = an.indexOf(nq) === 0 ? 0 : 1, rb = bn.indexOf(nq) === 0 ? 0 : 1;
    return ra - rb || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || an.length - bn.length;
  });
  return rows.slice(0, 30);
}
var KIND_LABEL = { sgg: "시·군·구", place: "방제자원" };
var addrRows = [], addrSel = -1;
function renderAddrPop(q) {
  var pop = $("#addrPop");
  addrRows = searchPlaces(q);
  if (!addrRows.length) {
    pop.innerHTML = q.trim()
      ? '<div class="mpk-none">‘' + esc(q) + "’ 과 맞는 곳이 없습니다.<br>"
        + "등록된 방제자원 이름·주소·시군구로 찾을 수 있습니다.</div>"
      : '<div class="mpk-none">등록된 방제자원 이름·주소·시군구로 찾습니다.</div>';
    addrSel = -1;
  } else {
    pop.innerHTML = '<div class="mpk-list">' + addrRows.map(function (p, i) {
      return '<div class="mpk-row" role="option" data-i="' + i + '">'
        + '<span class="nm">' + esc(p.label) + "</span>"
        + '<span class="en">' + esc(KIND_LABEL[p.kind]) + "</span></div>";
    }).join("") + "</div>"
    + '<div class="mpk-ft">고르면 그 언저리로 이동합니다 · 정확한 사고지점은 지도를 눌러 찍으세요</div>';
    addrSel = -1;
    $$(".mpk-row", pop).forEach(function (el) {
      el.onclick = function () { pickAddr(addrRows[+el.dataset.i]); };
    });
  }
  pop.hidden = false;
  placePopover(pop, $("#mAddrQ"), true);
}
function markAddr(i) {
  var els = $$(".mpk-row", $("#addrPop"));
  if (addrSel >= 0 && els[addrSel]) els[addrSel].classList.remove("on");
  addrSel = i;
  if (addrSel >= 0 && els[addrSel]) {
    els[addrSel].classList.add("on");
    els[addrSel].scrollIntoView({ block: "nearest" });
  }
}
function closeAddrPop() { $("#addrPop").hidden = true; addrSel = -1; }
function pickAddr(p) {
  closeAddrPop();
  $("#mAddrQ").value = p.label;
  if (p.sido !== st.sido || p.sgg !== st.sgg) {
    $("#mSido").value = p.sido; $("#mSido").onchange();
    $("#mSgg").value = p.sgg; $("#mSgg").onchange();
  }
  if (!st.view) fit();
  var w = mToWorld(2500, p.lat);
  var farAway = Math.abs(wx(p.lon) - st.view.cx) > st.view.w
             || Math.abs(wy(p.lat) - st.view.cy) > st.view.w;
  CAM.animateTo({ cx: wx(p.lon), cy: wy(p.lat),
    w: farAway ? Math.max(w, st.view.w * 0.5) : Math.min(w, st.view.w) }, 420);
  setMode("acc");
}
function placePopover(pop, anchor, growWidth) {
  var r = anchor.getBoundingClientRect();
  var w = growWidth ? Math.max(r.width, 300) : pop.offsetWidth;
  pop.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - w - 8))) + "px";
  pop.style.top = Math.round(r.bottom + 6) + "px";
  if (growWidth) pop.style.width = w + "px";
}
function bindAddrSearch() {
  var input = $("#mAddrQ"), pop = $("#addrPop");
  input.oninput = function () { renderAddrPop(input.value); };
  input.onfocus = function () { if (input.value.trim()) renderAddrPop(input.value); };
  input.onkeydown = function (e) {
    if (pop.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); markAddr(Math.min(addrSel + 1, addrRows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); markAddr(Math.max(addrSel - 1, 0)); }
    else if (e.key === "Enter") { if (addrSel >= 0) { e.preventDefault(); pickAddr(addrRows[addrSel]); } }
    else if (e.key === "Escape") { closeAddrPop(); }
  };
  document.addEventListener("mousedown", function (e) {
    if (!pop.hidden && e.target !== input && !pop.contains(e.target)) closeAddrPop();
  });
  window.addEventListener("resize", function () { if (!pop.hidden) placePopover(pop, input, true); });
}

/* ── 배경지도 ─────────────────────────────────────────────── */
function showSrc() {
  var s = MC.tiles.status();
  $$("#mLyr button").forEach(function (b) {
    b.setAttribute("aria-pressed", String(!!s.src && b.dataset.s === s.src.id));
    b.disabled = MC.tiles.isDead(b.dataset.s);
    b.title = MC.tiles.isDead(b.dataset.s) ? "불러오지 못했습니다" : (s.src ? s.src.저작권 || "" : "");
  });
  var w = $("#mWarn");
  w.hidden = !s.warn;
  w.innerHTML = s.warn;
}

/* ── 조작 ─────────────────────────────────────────────────── */
function zoomBtn(f) {
  var nw = Math.max(0.0000015, Math.min(1.2, st.view.w * f));
  CAM.animateTo({ cx: st.view.cx, cy: st.view.cy, w: nw }, 260);
}

/* 끌기·손가락 확대·휠은 세 지도가 같아야 하므로 assets/mapcore.js 에 있다 */
function bindMap() {
  MC.panzoom(SVG, {
    view: function () { return st.view; },
    vb: function () { return VB; },
    draw: draw,
    camStop: CAM.stop,
    onTap: function (x, y) {
      if (st.mode === "acc") {
        var ll = toLL(x, y);
        setAcc(ll.lat, ll.lon);
        return;
      }
      var i = hitMarker(x, y);
      if (i >= 0) select(i, true);
    }
  });
  $("#zIn").onclick = function () { zoomBtn(0.7); };
  $("#zOut").onclick = function () { zoomBtn(1.42); };
  $("#zFit").onclick = function () { fit(); };
  window.addEventListener("resize", function () { if (st.view) draw(); });
}

/* ── 초기화 ───────────────────────────────────────────────── */
function initSelects() {
  var sido = $("#mSido"), sgg = $("#mSgg");
  var byS = {};
  (window.RESOURCES || []).forEach(function (r) {
    (byS[r.sd] = byS[r.sd] || {})[r.sg] = true;
  });
  sido.innerHTML = '<option value="">선택</option>'
    + Object.keys(byS).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  var fillSgg = function () {
    var m = byS[sido.value] || {};
    var ks = Object.keys(m).sort();
    sgg.innerHTML = '<option value="">' + (sido.value ? "시·도 전체" : "시·도 먼저") + "</option>"
      + ks.map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  };
  fillSgg();
  sido.onchange = function () { st.sido = sido.value; st.sgg = ""; fillSgg(); refresh(true); };
  sgg.onchange = function () { st.sgg = sgg.value; refresh(true); };
}

/* 예시 자료 / 내부용 — 무엇을 보고 있는지 화면에서 바로 알 수 있어야 합니다.
   특히 내부판은 개인 연락처가 들어 있어 실수로 외부에 공유되면 안 됩니다. */
function initDataBar() {
  var meta = window.RESOURCE_META || {};
  var bar = $("#dataBar"), msg = [];
  if (meta.담당자포함)
    msg.push('<span class="db-in"><b>내부용</b> 업체 담당자 개인 연락처가 들어 있습니다 · '
      + "외부 공유 금지</span>");
  if (meta.예시자료)
    msg.push('<span class="db-ex"><b>예시 자료</b> 화면 확인용으로 만든 가짜 자료입니다 · '
      + "실제 업체가 아니며 전화번호도 실제 번호가 아닙니다</span>");
  bar.hidden = !msg.length;
  bar.className = "databar noprint" + (meta.담당자포함 ? " is-internal" : " is-example");
  bar.innerHTML = msg.join("");
}

function initSrcModal() {
  var meta = window.RESOURCE_META || {};
  var kinds = KINDS.map(function (k) {
    return "<li><b>" + esc(k.이름) + "</b> — " + esc(k.쓰임) + "</li>";
  }).join("");
  $("#ver").innerHTML =
    "<p><b>방제자원</b> — " + esc(meta.출처 || "-") + " · 기준일 " + esc(meta.기준일 || "-")
      + " (" + (meta.총건수 || 0).toLocaleString() + "곳)</p>"
    + "<p>담고 있는 자원은 네 가지입니다.</p><ul>" + kinds + "</ul>"
    + (meta.예시자료
        ? '<p class="alert w" style="padding:8px 11px"><b>예시 자료</b> 지금 보고 계신 것은 '
          + "화면을 확인하려고 만든 가짜 자료입니다. 실제 업체·연락처가 아닙니다.</p>"
        : "")
    + "<p><b>개인정보</b> — 공개판에는 업체 담당자의 이름·직통번호를 넣지 않고 "
      + "사업장 대표번호만 표시합니다. 담당자 직통이 필요한 경우 내부용으로 따로 배포되며, "
      + "그때는 화면 위에 <b>내부용</b> 띠가 표시됩니다."
      + (meta.담당자포함 ? " <b>지금 보고 계신 것은 내부용입니다.</b>" : "") + "</p>"
    + "<p><b>좌표</b> — 원자료에 위경도가 없어 주소를 좌표로 변환해 넣었습니다. "
      + "변환에 실패한 곳은 시·군·구 중심 좌표를 쓰고 목록에 <b>대략 위치</b>로 표시합니다.</p>"
    + "<p><b>배경지도</b> — " + esc(VERSION.배경지도) + ". 인터넷이 되는 환경에서만 표시되며, "
      + "안 되면 행정경계선만 그립니다.</p>"
    + "<p><b>행정경계</b> — " + esc(VERSION.경계_출처) + ". "
      + "<b>위치를 가늠하기 위한 배경선이며 법적 행정경계가 아닙니다.</b></p>"
    + "<p><b>거리</b> — 지형·도로를 고려하지 않은 직선거리(하버사인)입니다. "
      + "실제 이동거리·도착 시간은 이보다 깁니다.</p>"
    + "<p><b>반드시 확인하세요</b> — 업체는 폐업하고 담당자는 바뀝니다. 보유 장비도 "
      + "다른 현장에 나가 있을 수 있습니다. 이 도구의 값은 기준일 시점의 것이므로, "
      + "동원 전 전화로 가동 여부와 보유 상태를 확인해야 합니다.</p>"
    + '<p class="src">도구 버전 ' + esc(VERSION.도구버전) + " · 반영일 " + esc(VERSION.반영일) + "</p>";

  var open = function () { $("#srcModal").hidden = false; document.body.style.overflow = "hidden"; };
  var close = function () { $("#srcModal").hidden = true; document.body.style.overflow = ""; };
  $("#btnSrc").onclick = open;
  $("#btnSrcClose").onclick = close;
  $("#srcModal").onclick = function (e) { if (e.target.id === "srcModal") close(); };
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!$("#srcModal").hidden) { close(); return; }
    if (!$("#addrPop").hidden) { closeAddrPop(); return; }
    if (st.mode === "acc") setMode("pick");
  });
}

function init() {
  SVG = $("#map");
  MC.foldBar();            // 좁은 화면에서 조건 줄 접기
  initDataBar();
  initSelects();
  initSrcModal();
  renderChips();
  bindMap();
  bindAddrSearch();

  $("#mLyr").innerHTML = MC.tiles.sources().map(function (s) {
    return '<button type="button" data-s="' + esc(s.id) + '">' + esc(s.이름) + "</button>";
  }).join("");
  $$("#mLyr button").forEach(function (b) {
    b.onclick = function () {
      MC.tiles.revive(b.dataset.s); MC.tiles.use(b.dataset.s);
      draw(); showSrc();
    };
  });

  $("#mScope").onchange = function () { st.scope = this.value; refresh(true); };
  $("#mQ").oninput = function () { st.q = this.value; recompute(); renderList(); draw(); };
  $("#mSort").onchange = function () { st.sort = this.value; recompute(); renderList(); draw(); };
  $("#cRings").onchange = function () { st.rings = this.checked; renderLegend(); draw(); };

  $("#btnAcc").onclick = function () { setMode(st.mode === "acc" ? "pick" : "acc"); };
  $("#btnAccClear").onclick = clearAcc;
  $("#btnMe").onclick = locateMe;

  var latlon = function () {
    var la = parseFloat($("#acLat").value), lo = parseFloat($("#acLon").value);
    if (isFinite(la) && isFinite(lo) && la > 32 && la < 40 && lo > 123 && lo < 133)
      setAcc(la, lo, true);
  };
  $("#acLat").oninput = latlon;
  $("#acLon").oninput = latlon;

  $("#btnPrint").onclick = function () { window.print(); };
  $("#btnClear").onclick = function () {
    st.sido = ""; st.sgg = ""; st.scope = ""; st.acc = null;
    st.q = ""; st.sort = "name"; st.rings = true; st.mob = {}; st.me = null;
    KINDS.forEach(function (k) { st.kinds[k.id] = true; });
    toast("");
    ["mQ", "acLat", "acLon", "mAddrQ"].forEach(function (id) { $("#" + id).value = ""; });
    $("#mSido").value = ""; $("#mSido").onchange();
    $("#mScope").value = ""; $("#mSort").value = "name";
    $("#cRings").checked = true;
    renderChips();
    setMode("pick");
  };

  setMode("pick");
  showSrc();
  refresh(true);
}

document.addEventListener("DOMContentLoaded", init);
})();
