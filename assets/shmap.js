/* ============================================================
   주민 대피장소 찾기에서 고르기

     SHMAP.open({
       시군구,          사고 시·군·구 (있으면 그 관내를 먼저 보여준다)
       사고지점,        {lat, lon, 어림, 근거} — 열자마자 이 자리를 사고지점으로
                        찍고 가까운 순으로 정렬한다. 어림값이면 창 위에 무엇으로
                        어림잡았는지 적고 다시 찍으라고 알린다.
       칸목록,          고른 곳을 넣을 수 있는 입력칸 [{k, label}, ...]
       기본칸,          처음 고를 칸
       값들,            칸별 현재 입력값 {대피소:"가나초, 다라중", ...}
                        → 이미 들어 있는 곳은 체크된 상태로 시작한다
       반경후보,        물질정보에서 뽑은 영향 참고 거리 [{label, m}, ...]
       물질,            반경후보의 근거 물질명 (표시용)
       onPick(이름들, 칸)
     })

   투영·거리·배경지도 타일은 assets/mapcore.js 를 씁니다 (② 주민 대피장소 찾기와 공용).
   좌표계는 웹 메르카토르(EPSG:3857)이므로 타일·행정경계선·마커가 정확히 겹칩니다.

   이 창은 어느 대피장소가 적절한지 판단하지 않습니다. 거리·방위·반경은
   물질정보에 적힌 참고 값을 그려 보여주는 것이며 확산 모델링이 아닙니다.
   ============================================================ */
(function () {
"use strict";

var esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
};
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* 투영·거리·타일은 assets/mapcore.js 에 모아 두었습니다 — ② 주민 대피장소 찾기와
   같은 코드를 써야 두 지도가 어긋나지 않습니다. */
var MC = window.MAPCORE;
var wx = MC.wx, wy = MC.wy, wxInv = MC.wxInv, wyInv = MC.wyInv;
var mToWorld = MC.mToWorld;
var distM = MC.distM, bearing = MC.bearing, dirName = MC.dirName, fmtDist = MC.fmtDist;
var matchSgg = MC.matchSgg;

/* ── 상태 ─────────────────────────────────────────────────── */
var box = null;                 // 창 DOM
var opt = null;                 // open() 으로 받은 설정
var st = {
  sido: "", sgg: "",
  all: [],                      // 관내 대피장소 전부
  show: [],                     // 검색·정렬을 거친 표시 목록
  sel: {},                      // 고른 곳 — 정렬해도 흐트러지지 않게 key 로 담는다
  view: null, hover: -1,
  touched: false,               // 사용자가 선택을 손댔는가 (넣을 칸을 바꿀 때 판단용)
  acc: null,                    // 사고지점 {lat, lon}
  accGuess: null,               // 어림잡은 자리라면 그 근거 (문자열) · 직접 찍으면 null
  radius: null,                 // 영향 참고 반경 (m)
  mode: "pick",                 // "pick" 대피장소 고르기 / "acc" 사고지점 찍기
  sort: "name", q: ""
};
var SVG = null, VB = null;
/* 모든 시야 이동이 이 카메라를 거친다 — ② 주민 대피장소 찾기(map/app.js)와 같은
   공용 헬퍼(assets/mapcore.js)라서 두 지도가 똑같이 부드럽게 움직인다 */
var CAM = MC.camera(function () { return st.view; }, function (v) { st.view = v; }, draw);

/* 배경지도 타일은 mapcore 가 받아 둡니다. 새 타일이 도착하면 다시 그립니다. */
MC.tiles.onChange(function () {
  if (box && !box.hidden && st.view) { draw(); showSrc(); }
});

/* ── 데이터 ───────────────────────────────────────────────── */

/* 선택 시·군·구 경계의 범위 (세계좌표) */
function sggBox() {
  if (!st.sgg || typeof window.BOUNDARIES === "undefined") return null;
  var m = 2, M = -1, n = 2, N = -1, any = false;
  BOUNDARIES.forEach(function (f) {
    if (f.s !== st.sido || !matchSgg(f.n, st.sgg)) return;
    f.r.forEach(function (ring) {
      var X = 0, Y = 0;
      for (var i = 0; i < ring.length; i += 2) {
        if (i === 0) { X = ring[0]; Y = ring[1]; } else { X += ring[i]; Y += ring[i + 1]; }
        var x = wx(X / BOUNDARY_SCALE), y = wy(Y / BOUNDARY_SCALE);
        m = Math.min(m, x); M = Math.max(M, x);
        n = Math.min(n, y); N = Math.max(N, y);
        any = true;
      }
    });
  });
  return any ? { m: m, M: M, n: n, N: N } : null;
}

/* 사고지점 기준 거리·방위·반경 안 여부를 다시 계산하고 표시 목록을 만든다 */
function recompute() {
  st.all.forEach(function (s) {
    if (st.acc) {
      s.d = distM(st.acc.lat, st.acc.lon, s.lat, s.lon);
      s.b = bearing(st.acc.lat, st.acc.lon, s.lat, s.lon);
      s.inRing = st.radius > 0 && s.d <= st.radius;
    } else { s.d = null; s.b = null; s.inRing = false; }
  });

  var q = st.q.trim().toLowerCase();
  st.show = st.all.filter(function (s) {
    if (!q) return true;
    return (s.name + " " + (s.detail || "") + " " + (s.addr || "") + " " + (s.kind || ""))
      .toLowerCase().indexOf(q) >= 0;
  });
  if (st.sort === "dist" && st.acc) {
    st.show.sort(function (a, b) { return a.d - b.d; });
  } else if (st.sort === "cap") {
    st.show.sort(function (a, b) { return (+b.cap || 0) - (+a.cap || 0); });
  } else {
    st.show.sort(function (a, b) { return a.name.localeCompare(b.name, "ko"); });
  }
  st.hover = -1;
}

var FIT_NEAR = 6;               // 사고지점이 있을 때 화면에 담을 가까운 곳 수

/* near=true 면 사고지점 주변만, false 면 목록에 있는 곳을 전부 담는다.
   창을 처음 열 때는 주변만(어느 대피장소가 가까운지 봐야 한다), '전체 보기'
   단추는 말 그대로 전부 — 두 가지를 한 함수로 묶었다가 전체 보기가 주변만
   보여 주는 일이 있었다. */
function fitTarget(near) {
  var m = 2, M = -1, n = 2, N = -1, any = false;
  var add = function (x, y) {
    m = Math.min(m, x); M = Math.max(M, x);
    n = Math.min(n, y); N = Math.max(N, y);
    any = true;
  };

  if (near && st.acc) {
    /* 사고지점이 있으면 **그 주변만** 담는다. 시·군·구 전체를 담으면 사고지점이
       화면 가운데 점 하나로 작아져 어느 대피장소가 가까운지 눈으로 알 수 없다.
       반경을 정해 두면 그 원이 들어갈 만큼, 아니면 가까운 몇 곳이 보일 만큼. */
    var r = st.radius > 0 ? mToWorld(st.radius, st.acc.lat) : 0;
    add(wx(st.acc.lon) - r, wy(st.acc.lat) - r);
    add(wx(st.acc.lon) + r, wy(st.acc.lat) + r);
    st.show.filter(function (s) { return s.d != null; })
      .sort(function (a, b) { return a.d - b.d; })
      .slice(0, FIT_NEAR)
      .forEach(function (s) { add(wx(s.lon), wy(s.lat)); });
  } else {
    st.show.forEach(function (s) { add(wx(s.lon), wy(s.lat)); });
    var b = sggBox();
    if (b) { add(b.m, b.n); add(b.M, b.N); }
  }

  if (!any) return { cx: wx(127.8), cy: wy(36.3), w: 0.035 };
  /* 최소 폭 — 사고지점이 있으면 그 동네가 보일 만큼(약 1.2km)까지 당깁니다.
     시·군·구 전체를 담을 때 쓰는 최소 폭(약 11km)을 그대로 쓰면 가까운
     대피장소들이 한 점에 뭉쳐 어디가 어딘지 알 수 없습니다. */
  var min = (near && st.acc) ? mToWorld(1200, st.acc.lat) : 0.00035;
  var w = (M - m) * 1.25, h = (N - n) * 1.25;
  return { cx: (m + M) / 2, cy: (n + N) / 2, w: Math.max(w, h * 1.35, min) };
}

/* 처음 여는 창은 바로 그 시야로, 이미 뭔가 보고 있던 중이면 부드럽게 옮겨
   어디로 얼마나 움직이는지 눈으로 좇을 수 있게 한다. */
function fit(near) {
  var t = fitTarget(near);
  if (!st.view) { st.view = t; draw(); return; }
  CAM.animateTo(t, 420);
}

/* 고른 대피장소로 지도를 옮긴다.
   확대는 '너무 멀리 보고 있을 때만' 당깁니다. 이미 가까이 보고 있는데
   매번 확대를 바꾸면 주변을 비교하며 고르는 흐름이 끊깁니다. */
var NEAR_M = 1400;              // 이동 후 화면 가로에 담을 대략 거리
function moveTo(s) {
  if (!st.view) fit();
  var want = mToWorld(NEAR_M, s.lat);
  CAM.animateTo({ cx: wx(s.lon), cy: wy(s.lat), w: Math.min(st.view.w, want) }, 340);
}

/* ── 그리기 ───────────────────────────────────────────────── */
function svgSize() {
  var r = SVG.getBoundingClientRect();
  return { w: r.width || 560, h: r.height || 420 };
}
function viewBox() {
  var s = svgSize();
  var w = st.view.w, h = w * (s.h / s.w);
  return { x: st.view.cx - w / 2, y: st.view.cy - h / 2, w: w, h: h, sw: s.w, sh: s.h };
}

/* ── 세계좌표 → 화면 픽셀 ─────────────────────────────────────
   viewBox 에 세계좌표(0~1)를 그대로 넣지 않는 이유:
   SVG 렌더링은 내부적으로 float32 를 쓰므로 유효자리가 7자리 정도입니다.
   0.85 근처의 좌표를 폭 1e-5 짜리 viewBox 로 보면 1e-12 수준의 분해능이
   필요해 도형이 사라지거나 떨립니다(실제로 확대하면 마커가 없어졌습니다).
   그래서 viewBox 는 화면 픽셀로 두고, 투영은 배정도(float64)인 여기서 합니다.
   글자 크기·선 굵기·반지름도 전부 픽셀 값이 되어 다루기 쉬워집니다. */
function pxX(worldX) { return (worldX - VB.x) / VB.w * VB.sw; }
function pxY(worldY) { return (worldY - VB.y) / VB.h * VB.sh; }
function pX(lon) { return pxX(wx(lon)); }
function pY(lat) { return pxY(wy(lat)); }
/* 미터 → 화면 픽셀 */
function pxLen(m, lat) { return mToWorld(m, lat) / VB.w * VB.sw; }

function toLL(clientX, clientY) {
  var r = SVG.getBoundingClientRect();
  var x = VB.x + (clientX - r.left) / r.width * VB.w;
  var y = VB.y + (clientY - r.top) / r.height * VB.h;
  return { lon: wxInv(x), lat: wyInv(y) };
}

function draw() {
  if (!st.view) fit();
  VB = viewBox();
  var vb = VB;
  var r = 5.4;                                // 마커 반지름 (px)
  var g = [];

  g.push('<rect x="0" y="0" width="' + vb.sw + '" height="' + vb.sh + '" class="bg"/>');
  var tl = MC.tiles.layer(vb);
  g.push(tl);
  /* 배경지도가 깔렸는지에 따라 경계선·마커 대비를 바꾼다.
     배경 위에서는 옅은 회색 선이 묻히고, 흰 배경에서는 진한 선이 과하다. */
  SVG.classList.toggle("hasbg", !!tl);
  g.push('<g class="bds">' + MC.boundaryPaths(vb, function (f) {
    return f.s === st.sido && matchSgg(f.n, st.sgg);
  }) + "</g>");

  /* 영향 참고 반경 */
  if (st.acc && st.radius > 0) {
    g.push('<circle cx="' + pX(st.acc.lon).toFixed(1) + '" cy="' + pY(st.acc.lat).toFixed(1)
      + '" r="' + pxLen(st.radius, st.acc.lat).toFixed(1) + '" class="ring"/>');
  }

  /* 대피장소 */
  st.show.forEach(function (s, i) {
    var on = !!st.sel[s.key];
    g.push('<circle cx="' + pX(s.lon).toFixed(1) + '" cy="' + pY(s.lat).toFixed(1)
      + '" r="' + (on ? r * 1.6 : r) + '" class="mk' + (on ? " on" : "")
      + (s.inRing ? " in" : "") + (i === st.hover ? " hv" : "")
      + '" data-i="' + i + '" data-lat="' + s.lat + '" data-lon="' + s.lon + '"/>');
  });
  // 이름 — 고른 곳과 가리킨 곳은 항상, 그 외에는 개수가 적을 때만
  var cap = vb.sw < 520 ? 10 : 22;
  st.show.forEach(function (s, i) {
    if (!st.sel[s.key] && i !== st.hover && st.show.length > cap) return;
    g.push('<text x="' + pX(s.lon).toFixed(1) + '" y="' + (pY(s.lat) - r * 2).toFixed(1)
      + '" class="mkl' + (st.sel[s.key] ? " on" : "") + '" font-size="12">'
      + esc(s.name) + (s.d != null ? " " + fmtDist(s.d) : "") + "</text>");
  });
  if (st.show.length > cap)
    g.push('<text x="' + (vb.sw / 2) + '" y="' + (vb.sh - 10) + '" class="mkh"'
      + ' font-size="11">확대하거나 목록에서 가리키면 이름이 보입니다</text>');

  /* 사고지점 — 십자 표시 */
  if (st.acc) {
    var ax = pX(st.acc.lon), ay = pY(st.acc.lat), L = 13;
    g.push('<line x1="' + (ax - L).toFixed(1) + '" y1="' + ay.toFixed(1)
      + '" x2="' + (ax + L).toFixed(1) + '" y2="' + ay.toFixed(1) + '" class="acc"/>');
    g.push('<line x1="' + ax.toFixed(1) + '" y1="' + (ay - L).toFixed(1)
      + '" x2="' + ax.toFixed(1) + '" y2="' + (ay + L).toFixed(1) + '" class="acc"/>');
    g.push('<circle cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1)
      + '" r="6" class="accdot"/>');
    g.push('<text x="' + ax.toFixed(1) + '" y="' + (ay - L - 5).toFixed(1)
      + '" class="acclbl" font-size="12">사고지점</text>');
  }

  SVG.setAttribute("viewBox", "0 0 " + vb.sw + " " + vb.sh);
  SVG.innerHTML = g.join("");
  drawScale(vb);
}

/* 누른 곳에서 가장 가까운 마커 (없으면 -1)
   마커마다 click 을 걸지 않는 이유: 끌기(pan)를 위해 포인터를 캡처하면
   그 뒤의 이벤트가 모두 <svg> 로 향하므로 마커의 click 이 오지 않습니다.
   가까운 곳을 찾아주는 편이 작은 점을 정확히 누르는 것보다 쓰기도 쉽습니다. */
function hitMarker(clientX, clientY) {
  var rc = SVG.getBoundingClientRect();
  var best = -1, bd = 1e9, TH = 18;          // 허용 반경 (화면 픽셀)
  st.show.forEach(function (s, i) {
    var dx = rc.left + pX(s.lon) - clientX, dy = rc.top + pY(s.lat) - clientY;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < bd) { bd = d; best = i; }
  });
  return bd <= TH ? best : -1;
}

function drawScale(vb) {
  var s = MC.scale(vb);
  $(".shmap-scale i", box).style.width = s.px + "px";
  $(".shmap-scale b", box).textContent = s.label;
}

/* ── 선택 ─────────────────────────────────────────────────── */
function selected() {
  return st.all.filter(function (s) { return st.sel[s.key]; });
}
function selNames() {
  return selected().map(function (s) { return s.name; });
}

function toggle(i) {
  var s = st.show[i];
  if (!s) return;
  st.touched = true;
  if (st.sel[s.key]) delete st.sel[s.key];
  else { st.sel[s.key] = true; moveTo(s); }    // 고르면 그 자리로 지도를 옮긴다
  renderList(); draw(); renderFoot(); showAddr();
}

function renderList() {
  var wrap = $(".shmap-list", box);
  $(".shmap-cnt", box).textContent = st.all.length
    ? (st.q ? st.show.length + " / " + st.all.length + "곳" : st.all.length + "곳") : "";

  if (!st.show.length) {
    wrap.innerHTML = '<div class="shmap-none">'
      + (!st.sgg ? "시·도와 시·군·구를 고르세요."
         : st.q ? "‘" + esc(st.q) + "’ 과 맞는 곳이 없습니다."
         : "등록된 대피장소가 없습니다.") + "</div>";
    return;
  }

  wrap.innerHTML = st.show.map(function (s, i) {
    return '<div class="shmap-it' + (st.sel[s.key] ? " on" : "") + (s.inRing ? " ring" : "")
      + '" data-i="' + i + '" role="button" tabindex="0"'
      + ' aria-pressed="' + (st.sel[s.key] ? "true" : "false") + '">'
      + '<div class="l1"><input type="checkbox" tabindex="-1" aria-hidden="true"'
      + (st.sel[s.key] ? " checked" : "") + '><b>' + esc(s.name) + "</b>"
      + (s.detail ? '<span class="dt">' + esc(s.detail) + "</span>" : "")
      + (s.d != null ? '<span class="d">' + fmtDist(s.d) + " " + dirName(s.b) + "</span>" : "")
      + "</div>"
      + '<div class="l2">' + esc(s.addr || "")
      + (s.cap ? " · 수용 " + Number(s.cap).toLocaleString() + "명" : "")
      + (s.kind ? " · " + esc(s.kind) : "") + "</div>"
      + (s.inRing ? '<div class="l5">영향 참고 반경 '
          + fmtDist(st.radius) + " 안입니다 · 확산방향을 확인하세요</div>" : "")
      + (s.tel ? '<div class="l3">' + esc(s.dept || "") + " " + esc(s.tel) + "</div>" : "")
      + '<div class="l4">' + MC.extLinks(s) + "</div></div>";
  }).join("");

  $$(".shmap-it", wrap).forEach(function (el) {
    var i = +el.dataset.i;
    el.onclick = function (e) {
      if (e.target.tagName === "A") return;      // 외부 지도 링크는 그대로 열리게
      toggle(i);
    };
    el.onkeydown = function (e) {
      if (e.target.tagName === "A") return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(i); }
    };
    el.onmouseenter = function () { st.hover = i; draw(); showAddr(); };
    el.onmouseleave = function () {
      if (st.hover === i) { st.hover = -1; draw(); showAddr(); }
    };
  });
  var first = $(".shmap-it.on", wrap);
  if (first) first.scrollIntoView({ block: "nearest" });
}

function renderFoot() {
  var sel = selected(), n = sel.length;
  var b = $(".shmap-ok", box);
  b.disabled = !n;
  b.textContent = n ? "선택한 " + n + "곳 넣기" : "대피장소를 고르세요";
  b.classList.toggle("p", !!n);

  /* 고른 곳 수용인원 합계 — 대피 인원과 견주어 볼 수 있게 */
  var sum = sel.reduce(function (a, s) { return a + (+s.cap || 0); }, 0);
  var el = $(".shmap-sum", box);
  el.hidden = !n;
  el.textContent = n ? "수용인원 합계 " + sum.toLocaleString() + "명" : "";
}

/* 지도 아래 선택/가리킨 대피장소의 주소를 적는다 — 여기가 어딘지 확인용 */
function showAddr() {
  var el = $(".shmap-addr", box);
  var s = st.hover >= 0 ? st.show[st.hover] : selected()[selected().length - 1];
  if (!s) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = "<b>" + esc(s.name) + "</b>"
    + (s.detail ? " <i>" + esc(s.detail) + "</i>" : "")
    + '<span>' + esc((s.sgg || "") + " " + (s.addr || "")) + "</span>"
    + (s.cap ? '<em>수용 ' + Number(s.cap).toLocaleString() + "명</em>" : "")
    + (s.d != null ? '<em>사고지점에서 ' + fmtDist(s.d) + " " + dirName(s.b) + "</em>" : "");
}

/* ── 배경지도 상태 표시 ────────────────────────────────────── */
function showSrc() {
  var s = MC.tiles.status();
  $(".shmap-src", box).textContent = s.label;

  /* 배경 고르기 단추 상태 — 지금 쓰는 것에 표시, 못 쓰는 것은 비활성 */
  $$(".shmap-lyr button", box).forEach(function (b) {
    b.setAttribute("aria-pressed", String(!!s.src && b.dataset.s === s.src.id));
    b.disabled = MC.tiles.isDead(b.dataset.s);
    b.title = MC.tiles.isDead(b.dataset.s) ? "불러오지 못했습니다" : "";
  });

  var warn = $(".shmap-warn", box);
  warn.hidden = !s.warn;
  warn.innerHTML = s.warn;
}

/* ── 사고지점·반경 ────────────────────────────────────────── */
function setMode(m) {
  st.mode = m;
  var b = $(".shmap-accbtn", box);
  b.setAttribute("aria-pressed", String(m === "acc"));
  b.textContent = m === "acc" ? "지도를 누르세요" : (st.acc ? "사고지점 다시 찍기" : "사고지점 찍기");
  SVG.classList.toggle("crosshair", m === "acc");
}

function renderRad() {
  var wrap = $(".shmap-rad", box);
  var cands = (opt && opt.반경후보) || [];
  wrap.hidden = !st.acc;
  if (!st.acc) return;
  wrap.innerHTML = '<span class="lb">영향 참고 반경</span>'
    + cands.map(function (c) {
        return '<button type="button" class="sm" data-r="' + c.m + '"'
          + (st.radius === c.m ? ' aria-pressed="true"' : "")
          + ' title="' + esc(c.label) + '">' + esc(c.짧은 || fmtDist(c.m)) + "</button>";
      }).join("")
    + '<input type="text" class="shmap-radin" inputmode="numeric" placeholder="m"'
    + ' value="' + (st.radius || "") + '" aria-label="반경 직접 입력 (m)">'
    + '<button type="button" class="sm shmap-radx" title="반경 지우기">×</button>'
    + (cands.length && opt.물질
        ? '<span class="src">' + esc(opt.물질) + " 물질정보 기준 · 확산 모델링 아님</span>"
        : "");

  $$(".shmap-rad button[data-r]", box).forEach(function (b) {
    b.onclick = function () { setRadius(+b.dataset.r); };
  });
  var inp = $(".shmap-radin", box);
  inp.oninput = function () {
    var v = parseInt(String(inp.value).replace(/[^\d]/g, ""), 10);
    setRadius(isNaN(v) ? null : v, true);
  };
  $(".shmap-radx", box).onclick = function () { setRadius(null); };
}

function setRadius(m, keepInput) {
  st.radius = m && m > 0 ? m : null;
  recompute(); renderList(); renderFoot(); draw();
  if (!keepInput) renderRad();
  else $$(".shmap-rad button[data-r]", box).forEach(function (b) {
    b.setAttribute("aria-pressed", String(st.radius === +b.dataset.r));
  });
}

function setAcc(ll, 근거) {
  st.acc = ll;
  st.accGuess = ll ? (근거 || null) : null;
  if (st.sort === "name") st.sort = "dist";     // 사고지점을 찍으면 가까운 순이 유용하다
  $(".shmap-sort", box).value = st.sort;
  syncSort();
  recompute(); renderList(); renderFoot(); renderRad(); renderGuess(); draw(); showAddr();
  setMode("pick");
}

/* 어림잡은 사고지점임을 알리는 줄 — 무엇으로 잡았는지와 어떻게 고치는지까지
   적습니다. "대략"이라는 말만 있으면 얼마나 틀릴 수 있는지 알 수 없습니다. */
function renderGuess() {
  var el = $(".shmap-guess", box);
  if (!el) return;
  el.hidden = !st.accGuess;
  if (!st.accGuess) return;
  el.innerHTML = "<b>사고지점은 입력한 주소로 어림잡은 자리입니다</b> — "
    + esc(st.accGuess) + "로 잡았습니다. 읍·면·동 경계 자료가 없어 몇백 미터 틀릴 수 "
    + "있습니다. 자리가 다르면 <b>사고지점 다시 찍기</b>로 지도를 눌러 고치세요.";
}

function syncSort() {
  var sel = $(".shmap-sort", box);
  $$("option", sel).forEach(function (o) {
    if (o.value === "dist") o.disabled = !st.acc;
  });
  if (!st.acc && st.sort === "dist") { st.sort = "name"; sel.value = "name"; }
}

/* ── 조건 선택 ────────────────────────────────────────────── */
function reload(refit) {
  st.all = st.sgg ? MC.shelters(st.sido, st.sgg) : [];
  st.sel = {}; st.q = ""; st.touched = false;
  var qi = $(".shmap-q", box);
  if (qi) qi.value = "";
  prefill();
  recompute();
  syncSort(); renderList(); renderFoot();
  /* 사고지점을 알고 열었으면 그 동네부터 보여 준다 — '전체 보기' 단추는
     따로 있고, 그것은 관내 전부를 담는다(fitTarget 의 near 참고) */
  if (refit) fit(true); else draw();
  showAddr();
}

/* 이미 입력칸에 들어 있는 곳은 체크된 상태로 시작한다.
   다시 열어 한 곳을 더 보태려는데 처음부터 다시 골라야 하면 번거롭습니다. */
function prefill() {
  var target = $(".shmap-target", box);
  var cur = String(((opt && opt.값들) || {})[target ? target.value : ""] || "");
  if (!cur.trim()) return;
  var names = cur.split(/\s*,\s*/).filter(Boolean);
  st.all.forEach(function (s) {
    if (names.indexOf(s.name) >= 0) st.sel[s.key] = true;
  });
}

function fillSido() {
  var S = window.SHELTERS || {};
  var sel = $(".shmap-sido", box);
  sel.innerHTML = '<option value="">선택</option>'
    + Object.keys(S).sort().map(function (s) {
        return '<option' + (s === st.sido ? " selected" : "") + ">" + esc(s) + "</option>";
      }).join("");
  fillSgg();
}
function fillSgg() {
  var m = (window.SHELTERS || {})[st.sido] || {};
  var sel = $(".shmap-sgg", box);
  var ks = Object.keys(m).sort();
  if (!ks.length) { sel.innerHTML = '<option value="">시·도 먼저</option>'; return; }
  if (ks.indexOf(st.sgg) < 0) st.sgg = "";
  sel.innerHTML = '<option value="">선택</option>'
    + ks.map(function (s) {
        return '<option' + (s === st.sgg ? " selected" : "") + ">" + esc(s) + "</option>";
      }).join("");
}

/* ── 지도 조작 ────────────────────────────────────────────── */
/* ＋/－ 단추는 화면 가운데 기준으로, 얼마나 당겨지는지 보이게 부드럽게 움직인다.
   끌기·손가락 확대·휠은 그 자리서 바로 반응해야 하므로 트윈을 쓰지 않는다
   (assets/mapcore.js 의 panzoom).
   최대 확대 한계는 배경지도 타일의 z19 에 맞춘 화면 가로 약 50m 다. */
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
      if (st.mode === "acc") { setAcc(toLL(x, y)); return; }
      var i = hitMarker(x, y);
      if (i >= 0) toggle(i);
    }
  });
  $(".shmap-zi", box).onclick = function () { zoomBtn(0.7); };
  $(".shmap-zo", box).onclick = function () { zoomBtn(1.42); };
  $(".shmap-zf", box).onclick = function () { fit(); };
}

/* ── 창 만들기 ────────────────────────────────────────────── */
function buildBox() {
  box = document.createElement("div");
  box.className = "shmap-back";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "주민 대피장소 찾기에서 고르기");
  box.innerHTML =
    '<div class="shmap">'
    + '<header><b>주민 대피장소 찾기에서 고르기</b>'
      + '<span class="shmap-src"></span>'
      + '<button type="button" class="shmap-x" aria-label="닫기">✕</button></header>'
    + '<div class="shmap-bar">'
      + '<label>시·도<select class="shmap-sido"></select></label>'
      + '<label>시·군·구<select class="shmap-sgg"></select></label>'
      + '<div class="shmap-lyr" role="group" aria-label="배경지도 선택"></div>'
      + '<button type="button" class="shmap-accbtn sm">사고지점 찍기</button>'
      + '<span class="shmap-hint">지도의 점이나 오른쪽 목록을 눌러 고르세요 · 여러 곳도 됩니다</span>'
    + "</div>"
    + '<div class="shmap-warn" hidden></div>'
    /* 사고지점을 입력한 주소로 어림잡았을 때 그 사실을 적는 줄 — 어림값을
       실제로 잰 값과 눈으로 구분하지 못하면 안 됩니다. */
    + '<div class="shmap-guess" hidden></div>'
    + '<div class="shmap-rad" hidden></div>'
    + '<div class="shmap-body">'
      + '<div class="shmap-mapwrap">'
        + '<svg class="shmap-svg" role="img" aria-label="주민 대피장소 찾기"></svg>'
        + '<div class="shmap-ctl">'
          + '<button type="button" class="shmap-zi" title="확대">＋</button>'
          + '<button type="button" class="shmap-zo" title="축소">−</button>'
          + '<button type="button" class="shmap-zf" title="전체 보기">⤢</button>'
        + "</div>"
        + '<div class="shmap-scale"><i></i><b></b></div>'
        + '<div class="shmap-addr" hidden></div>'
      + "</div>"
      + '<div class="shmap-side">'
        + '<div class="shmap-lh">관내 대피장소 <span class="shmap-cnt"></span></div>'
        + '<div class="shmap-tools">'
          + '<input type="text" class="shmap-q" placeholder="이름·주소로 찾기" '
            + 'aria-label="대피장소 검색" autocomplete="off">'
          + '<select class="shmap-sort" aria-label="정렬">'
            + '<option value="name">이름순</option>'
            + '<option value="dist">사고지점 가까운 순</option>'
            + '<option value="cap">수용인원 많은 순</option>'
          + "</select>"
        + "</div>"
        + '<div class="shmap-list"></div>'
      + "</div>"
    + "</div>"
    + '<footer><label class="shmap-tg">넣을 칸<select class="shmap-target"></select></label>'
      + '<span class="shmap-sum" hidden></span>'
      + '<button type="button" class="shmap-ok sm" disabled></button>'
      + '<button type="button" class="shmap-cancel sm">닫기</button></footer>'
    + "</div>";
  document.body.appendChild(box);

  SVG = $(".shmap-svg", box);
  bindMap();

  /* 배경지도 고르기 — 일반지도 / 위성+도로명 / OpenStreetMap */
  $(".shmap-lyr", box).innerHTML = MC.tiles.sources().map(function (s) {
    return '<button type="button" data-s="' + esc(s.id) + '">' + esc(s.이름) + "</button>";
  }).join("");
  $$(".shmap-lyr button", box).forEach(function (b) {
    b.onclick = function () {
      MC.tiles.revive(b.dataset.s);       // 다시 시도해 볼 기회를 준다
      MC.tiles.use(b.dataset.s);
      draw(); showSrc();
    };
  });

  $(".shmap-sido", box).onchange = function () {
    st.sido = this.value; st.sgg = ""; fillSgg(); reload(true);
  };
  $(".shmap-sgg", box).onchange = function () {
    st.sgg = this.value; reload(true);
  };
  $(".shmap-q", box).oninput = function () {
    st.q = this.value; recompute(); renderList(); draw();
  };
  $(".shmap-sort", box).onchange = function () {
    st.sort = this.value; recompute(); renderList(); draw();
  };
  $(".shmap-accbtn", box).onclick = function () {
    setMode(st.mode === "acc" ? "pick" : "acc");
  };
  /* 넣을 칸을 바꿀 때 — 이미 고른 것이 있으면 그대로 두고 넣을 곳만 바꾼다.
     고른 것을 지워 버리면 다시 다 골라야 합니다.
     아직 손대지 않았다면 바꾼 칸에 들어 있는 값으로 다시 표시합니다. */
  $(".shmap-target", box).onchange = function () {
    if (st.touched) return;
    st.sel = {}; prefill(); renderList(); renderFoot(); draw(); showAddr();
  };
  $(".shmap-x", box).onclick = $(".shmap-cancel", box).onclick = close;
  box.onclick = function (e) { if (e.target === box) close(); };
  $(".shmap-ok", box).onclick = function () {
    var names = selNames();
    if (!names.length) return;
    var target = $(".shmap-target", box).value;
    if (opt && opt.onPick) opt.onPick(names, target);
    close();
  };
  document.addEventListener("keydown", onKey);
}

function onKey(e) {
  if (!box || box.hidden) return;
  if (e.key === "Escape") {
    e.preventDefault();
    if (st.mode === "acc") setMode("pick"); else close();
  }
}

function close() {
  if (!box) return;
  CAM.stop();
  box.hidden = true;
  document.body.style.overflow = "";
  if (opt && opt.onClose) opt.onClose();
}

/* ── 열기 ─────────────────────────────────────────────────── */
function open(o) {
  opt = o || {};
  if (typeof window.SHELTERS === "undefined") {
    alert("대피장소 데이터를 불러오지 못했습니다.");
    return;
  }
  if (!box) buildBox();
  box.hidden = false;
  document.body.style.overflow = "hidden";

  /* 넣을 칸 목록 */
  var tg = $(".shmap-target", box);
  var cols = opt.칸목록 || [{ k: "대피소", label: "대피소" }];
  tg.innerHTML = cols.map(function (c) {
    return '<option value="' + esc(c.k) + '"'
      + (c.k === opt.기본칸 ? " selected" : "") + ">" + esc(c.label) + "</option>";
  }).join("");
  $(".shmap-tg", box).hidden = cols.length < 2;

  /* 사고 시·군·구를 알고 있으면 그 관내를 먼저 보여준다.
     지난번에 다른 지역을 보다가 닫았어도 사고 지역으로 되돌립니다. */
  if (opt.시군구) {
    st.sgg = opt.시군구;
    var sd = opt.시도 || st.sido;
    if (!sd || !((window.SHELTERS[sd] || {})[st.sgg])) sd = MC.findSido(st.sgg) || "";
    st.sido = sd;
  } else {
    st.sido = opt.시도 || st.sido || "";
  }
  if (st.sido && !window.SHELTERS[st.sido]) { st.sido = ""; st.sgg = ""; }
  fillSido();
  st.sgg = $(".shmap-sgg", box).value;

  /* 사고지점 — 부르는 쪽이 알고 있으면 열자마자 찍는다. ① 문자 도구는 앞
     걸음에서 받은 시·군·구·읍·면·동으로 자리를 어림잡아 넘깁니다. 그러면
     창이 열리는 순간 그 동네가 보이고 목록도 가까운 순으로 나옵니다 —
     시·군·구를 다시 고르고 지도를 끌어 찾아갈 일이 없습니다. */
  var a = opt.사고지점;
  st.acc = (a && a.lat != null && a.lon != null) ? { lat: +a.lat, lon: +a.lon } : null;
  st.accGuess = st.acc && a.어림 ? (a.근거 || "입력한 주소") : null;
  st.radius = null;
  st.sort = st.acc ? "dist" : "name";
  $(".shmap-sort", box).value = st.sort;
  syncSort();
  setMode("pick");
  st.view = null;     // 새로 열 때는 지난번 보던 자리에서 옮겨 오지 않고 바로 잡는다
  reload(true);
  renderRad();
  renderGuess();

  /* 배경지도는 바로 그린다. 안 되는 원본이면 대체순서에 따라 자동 전환된다 */
  showSrc();

  var f = $(".shmap-q", box);
  if (f) f.focus();
}

/* 시야 상태 — 확인·시험용으로만 읽습니다 */
function debug() {
  var s = MC.tiles.status();
  return { view: st.view && { cx: st.view.cx, cy: st.view.cy, w: st.view.w },
           src: (s.src || {}).id || null,
           dead: MC.tiles.sources().filter(function (x) { return MC.tiles.isDead(x.id); })
                   .map(function (x) { return x.id; }),
           acc: st.acc, radius: st.radius, shown: st.show.length, sel: selNames() };
}

window.SHMAP = { open: open, close: close, debug: debug };

/* 창 크기가 바뀌면 종횡비가 달라지므로 다시 그린다 */
window.addEventListener("resize", function () {
  if (box && !box.hidden && st.view) draw();
});

})();
