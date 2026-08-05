/* ============================================================
   대피장소 지도 선택 — 지도를 눌러서 대피장소를 고르는 창

   두 도구가 함께 씁니다.
     SHMAP.open({ 시도, 시군구, 칸목록, 기본칸, 값, onPick })

   좌표계는 웹 메르카토르(EPSG:3857)입니다. 배경지도 타일이 이 좌표계를
   쓰므로 타일과 경계선·마커가 정확히 겹칩니다.
   (지도 도구 map/app.js 는 등장방형 도법을 쓰지만 배경 타일이 없어
    문제가 없습니다. 두 곳의 좌표 변환을 섞어 쓰지 않도록 주의하세요.)

   배경지도가 없어도 시·군·구 경계선 + 대피장소 점만으로 고를 수 있습니다.
   data/basemap.js 의 사용: false 이거나 타일 서버에 닿지 못하면 그렇게 됩니다.
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

/* 2018년 경계 데이터와 현재 행정구역명이 다른 곳 */
var ALIAS = { "미추홀구": "남구" };

/* ── 웹 메르카토르 (0~1 정규화 세계좌표) ───────────────────── */
var TAU = Math.PI * 2;
function wx(lon) { return (+lon + 180) / 360; }
function wy(lat) {
  var l = Math.max(-85.05112878, Math.min(85.05112878, +lat));
  var s = Math.sin(l * Math.PI / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (2 * TAU);
}
function wxInv(x) { return x * 360 - 180; }
function wyInv(y) { return Math.atan(Math.sinh((0.5 - y) * TAU)) * 180 / Math.PI; }

/* 직선거리 (m) — 하버사인 */
function distM(a, b, c, d) {
  var R = 6371000, p = Math.PI / 180;
  var dLat = (c - a) * p, dLon = (d - b) * p;
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(a * p) * Math.cos(c * p) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/* ── 상태 ─────────────────────────────────────────────────── */
var box = null;                 // 창 DOM
var opt = null;                 // open() 으로 받은 설정
var st = { sido: "", sgg: "", list: [], sel: {}, view: null, hover: -1 };
var tiles = { 가능: false, 확인중: false };   // 배경지도 사용 가능 여부
var SVG = null, VB = null;

/* ── 배경지도 타일 확인 ────────────────────────────────────────
   설정이 켜져 있어도 실제로 타일이 내려오는지 한 장으로 미리 확인합니다.
   확인 전까지는 경계선만 그리고, 성공하면 배경을 덧그립니다.
   (인증키 미등록 도메인·오프라인·차단 환경에서 조용히 경계선만 남습니다) */
function tileUrl(z, x, y) {
  var cfg = window.BASEMAP;
  return String(cfg.주소).replace("{키}", encodeURIComponent(cfg.인증키))
    .replace("{z}", z).replace("{x}", x).replace("{y}", y);
}
function probeTiles(done) {
  var cfg = window.BASEMAP;
  if (!cfg || !cfg.사용 || !String(cfg.인증키).trim()) { tiles.가능 = false; return done(); }
  if (tiles.확인중) return;
  tiles.확인중 = true;
  var img = new Image(), fin = false;
  var end = function (ok) {
    if (fin) return; fin = true;
    tiles.가능 = ok; tiles.확인중 = false; done();
  };
  img.onload = function () { end(img.naturalWidth > 1); };
  img.onerror = function () { end(false); };
  setTimeout(function () { end(false); }, cfg.대기시간 || 4000);
  img.src = tileUrl(8, 218, 100);          // 한반도 중부가 들어가는 타일 한 장
}

/* ── 데이터 ───────────────────────────────────────────────── */
function shelters(sido, sgg) {
  var out = [];
  var S = window.SHELTERS || {};
  var sds = sido ? [sido] : Object.keys(S);
  sds.forEach(function (sd) {
    var sgs = sgg ? [sgg] : Object.keys(S[sd] || {});
    sgs.forEach(function (sg) {
      ((S[sd] || {})[sg] || []).forEach(function (r) {
        if (r[5] == null || r[6] == null) return;
        out.push({ sido: sd, sgg: sg, name: r[0], detail: r[1], addr: r[2],
                   cap: r[3], kind: r[4], lat: r[5], lon: r[6], dept: r[7], tel: r[8] });
      });
    });
  });
  return out;
}

function matchSgg(bName, sgg) {
  if (!sgg) return false;
  if (bName === sgg) return true;
  if (ALIAS[sgg] && bName === ALIAS[sgg]) return true;
  return bName.indexOf(sgg) === 0 || sgg.indexOf(bName) === 0;
}

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

function fit() {
  var m = 2, M = -1, n = 2, N = -1, any = false;
  st.list.forEach(function (s) {
    var x = wx(s.lon), y = wy(s.lat);
    m = Math.min(m, x); M = Math.max(M, x);
    n = Math.min(n, y); N = Math.max(N, y);
    any = true;
  });
  var b = sggBox();
  if (b) {
    m = Math.min(m, b.m); M = Math.max(M, b.M);
    n = Math.min(n, b.n); N = Math.max(N, b.N);
    any = true;
  }
  if (!any) { st.view = { cx: wx(127.8), cy: wy(36.3), w: 0.035 }; return; }
  var w = (M - m) * 1.25, h = (N - n) * 1.25;
  st.view = { cx: (m + M) / 2, cy: (n + N) / 2, w: Math.max(w, h * 1.35, 0.00035) };
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
function toLL(clientX, clientY) {
  var r = SVG.getBoundingClientRect();
  var x = VB.x + (clientX - r.left) / r.width * VB.w;
  var y = VB.y + (clientY - r.top) / r.height * VB.h;
  return { lon: wxInv(x), lat: wyInv(y) };
}

function tileLayer(vb) {
  if (!tiles.가능) return "";
  var cfg = window.BASEMAP;
  var z = Math.round(Math.log(vb.sw / vb.w / 256) / Math.LN2);
  z = Math.max(cfg.최소확대 || 6, Math.min(cfg.최대확대 || 18, z));
  var n = Math.pow(2, z), sz = 1 / n;
  var x0 = Math.floor(vb.x * n), x1 = Math.floor((vb.x + vb.w) * n);
  var y0 = Math.floor(vb.y * n), y1 = Math.floor((vb.y + vb.h) * n);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 120) return "";     // 안전장치
  var out = [];
  for (var X = x0; X <= x1; X++) {
    for (var Y = y0; Y <= y1; Y++) {
      if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
      out.push('<image href="' + esc(tileUrl(z, X, Y)) + '" x="' + (X * sz) + '" y="' + (Y * sz)
        + '" width="' + sz + '" height="' + sz + '" preserveAspectRatio="none"/>');
    }
  }
  return '<g class="tl">' + out.join("") + "</g>";
}

function boundaryPaths(vb) {
  if (typeof window.BOUNDARIES === "undefined") return "";
  var pad = vb.w * 0.35;
  var x0 = vb.x - pad, x1 = vb.x + vb.w + pad, y0 = vb.y - pad, y1 = vb.y + vb.h + pad;
  var out = [];
  BOUNDARIES.forEach(function (f) {
    var on = f.s === st.sido && matchSgg(f.n, st.sgg);
    f.r.forEach(function (ring) {
      var X = 0, Y = 0, d = "", any = false, inside = false;
      for (var i = 0; i < ring.length; i += 2) {
        if (i === 0) { X = ring[0]; Y = ring[1]; } else { X += ring[i]; Y += ring[i + 1]; }
        var sx = wx(X / BOUNDARY_SCALE), sy = wy(Y / BOUNDARY_SCALE);
        if (sx > x0 && sx < x1 && sy > y0 && sy < y1) inside = true;
        d += (any ? "L" : "M") + sx.toFixed(7) + " " + sy.toFixed(7);
        any = true;
      }
      if (inside) out.push('<path d="' + d + '" class="bd' + (on ? " on" : "") + '"/>');
    });
  });
  return out.join("");
}

function draw() {
  if (!st.view) fit();
  VB = viewBox();
  var vb = VB, k = vb.w / vb.sw;              // 세계단위 / 화면픽셀
  var r = k * 5.2;                            // 마커 반지름
  var g = [];

  g.push('<rect x="' + vb.x + '" y="' + vb.y + '" width="' + vb.w + '" height="' + vb.h
    + '" class="bg"/>');
  g.push(tileLayer(vb));
  g.push('<g class="bds" stroke-width="' + (k * 1.1) + '">' + boundaryPaths(vb) + "</g>");

  st.list.forEach(function (s, i) {
    var on = !!st.sel[i];
    g.push('<circle cx="' + wx(s.lon) + '" cy="' + wy(s.lat) + '" r="' + (on ? r * 1.6 : r)
      + '" class="mk' + (on ? " on" : "") + (i === st.hover ? " hv" : "")
      + '" stroke-width="' + (k * 1.3) + '" data-i="' + i + '"/>');
  });
  // 이름 — 고른 곳과 가리킨 곳은 항상, 그 외에는 개수가 적을 때만
  var cap = vb.sw < 520 ? 10 : 22;
  st.list.forEach(function (s, i) {
    if (!st.sel[i] && i !== st.hover && st.list.length > cap) return;
    g.push('<text x="' + wx(s.lon) + '" y="' + (wy(s.lat) - r * 2) + '" class="mkl'
      + (st.sel[i] ? " on" : "") + '" font-size="' + (k * 12) + '">' + esc(s.name) + "</text>");
  });
  if (st.list.length > cap)
    g.push('<text x="' + (vb.x + vb.w / 2) + '" y="' + (vb.y + vb.h - k * 10) + '" class="mkh'
      + '" font-size="' + (k * 11) + '">확대하거나 목록에서 가리키면 이름이 보입니다</text>');

  SVG.setAttribute("viewBox", [vb.x, vb.y, vb.w, vb.h].join(" "));
  SVG.innerHTML = g.join("");
  drawScale(vb);
}

/* 누른 곳에서 가장 가까운 마커 (없으면 -1)
   마커마다 click 을 걸지 않는 이유: 끌기(pan)를 위해 포인터를 캡처하면
   그 뒤의 이벤트가 모두 <svg> 로 향하므로 마커의 click 이 오지 않습니다.
   가까운 곳을 찾아주는 편이 작은 점을 정확히 누르는 것보다 쓰기도 쉽습니다. */
function hitMarker(clientX, clientY) {
  var r = SVG.getBoundingClientRect();
  var best = -1, bd = 1e9, TH = 18;          // 허용 반경 (화면 픽셀)
  st.list.forEach(function (s, i) {
    var sx = r.left + (wx(s.lon) - VB.x) / VB.w * r.width;
    var sy = r.top + (wy(s.lat) - VB.y) / VB.h * r.height;
    var dx = sx - clientX, dy = sy - clientY;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < bd) { bd = d; best = i; }
  });
  return bd <= TH ? best : -1;
}

function drawScale(vb) {
  // 화면 중앙 위도에서 가로 1/4 폭에 해당하는 실거리
  var latC = wyInv(vb.y + vb.h / 2);
  var lonA = wxInv(vb.x), lonB = wxInv(vb.x + vb.w);
  var full = distM(latC, lonA, latC, lonB);
  var target = full / 4;
  var nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];
  var pick = nice.reduce(function (a, b) {
    return Math.abs(b - target) < Math.abs(a - target) ? b : a;
  });
  $(".shmap-scale i", box).style.width =
    Math.max(22, Math.round(pick / full * vb.sw)) + "px";
  $(".shmap-scale b", box).textContent = pick >= 1000 ? (pick / 1000) + "km" : pick + "m";
}

/* ── 목록·선택 ────────────────────────────────────────────── */
function selNames() {
  return st.list.filter(function (s, i) { return st.sel[i]; }).map(function (s) { return s.name; });
}

function toggle(i) {
  if (st.sel[i]) delete st.sel[i]; else st.sel[i] = true;
  renderList(); draw(); renderFoot();
}

/* 외부 지도 확인 링크 — 인증키 없이 동작하는 공개 주소만 씁니다.
   도로·건물을 보면서 위치를 최종 확인하는 용도이며, 인터넷이 있을 때만
   열립니다. 새 창으로 열리므로 작성 중인 내용은 그대로 남습니다. */
function extLinks(s) {
  var q = encodeURIComponent(s.name + " " + (s.sgg || "") + " " + (s.addr || ""));
  var kakao = "https://map.kakao.com/link/map/" + encodeURIComponent(s.name)
            + "," + s.lat + "," + s.lon;
  var naver = "https://map.naver.com/p/search/" + q;
  return '<span class="shmap-ext">'
    + '<a href="' + kakao + '" target="_blank" rel="noopener noreferrer">카카오맵</a>'
    + '<a href="' + naver + '" target="_blank" rel="noopener noreferrer">네이버지도</a>'
    + "</span>";
}

function renderList() {
  var wrap = $(".shmap-list", box);
  if (!st.list.length) {
    wrap.innerHTML = '<div class="shmap-none">'
      + (st.sgg ? "등록된 대피장소가 없습니다." : "시·도와 시·군·구를 고르세요.") + "</div>";
    $(".shmap-cnt", box).textContent = "";
    return;
  }
  $(".shmap-cnt", box).textContent = st.list.length + "곳";
  wrap.innerHTML = st.list.map(function (s, i) {
    return '<div class="shmap-it' + (st.sel[i] ? " on" : "") + '" data-i="' + i + '"'
      + ' role="button" tabindex="0" aria-pressed="' + (st.sel[i] ? "true" : "false") + '">'
      + '<div class="l1"><input type="checkbox" tabindex="-1" aria-hidden="true"'
      + (st.sel[i] ? " checked" : "") + '><b>' + esc(s.name) + "</b>"
      + (s.detail ? '<span class="dt">' + esc(s.detail) + "</span>" : "") + "</div>"
      + '<div class="l2">' + esc(s.addr || "")
      + (s.cap ? " · 수용 " + Number(s.cap).toLocaleString() + "명" : "")
      + (s.kind ? " · " + esc(s.kind) : "") + "</div>"
      + (s.tel ? '<div class="l3">' + esc(s.dept || "") + " " + esc(s.tel) + "</div>" : "")
      + '<div class="l4">' + extLinks(s) + "</div></div>";
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
    el.onmouseenter = function () { st.hover = i; draw(); };
    el.onmouseleave = function () { if (st.hover === i) { st.hover = -1; draw(); } };
  });
  var first = $(".shmap-it.on", wrap);
  if (first) first.scrollIntoView({ block: "nearest" });
}

function renderFoot() {
  var n = selNames().length;
  var b = $(".shmap-ok", box);
  b.disabled = !n;
  b.textContent = n ? "선택한 " + n + "곳 넣기" : "대피장소를 고르세요";
  b.classList.toggle("p", !!n);
}

/* ── 조건 선택 ────────────────────────────────────────────── */
function reload(refit) {
  st.list = st.sgg ? shelters(st.sido, st.sgg) : [];
  st.sel = {}; st.hover = -1;
  if (refit) { st.view = null; }
  renderList(); renderFoot(); draw();
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
function zoom(f, cx, cy) {
  var v = st.view;
  var nw = Math.max(0.00008, Math.min(1.2, v.w * f));
  if (cx != null) {              // 커서 위치를 고정한 확대축소
    var ll = toLL(cx, cy);
    var px = wx(ll.lon), py = wy(ll.lat);
    var rx = (px - VB.x) / VB.w, ry = (py - VB.y) / VB.h;
    var nh = nw * (VB.sh / VB.sw);
    v.cx = px - (rx - 0.5) * nw;
    v.cy = py - (ry - 0.5) * nh;
  }
  v.w = nw;
  draw();
}

function bindMap() {
  var drag = null;
  SVG.onpointerdown = function (e) {
    drag = { x: e.clientX, y: e.clientY, cx: st.view.cx, cy: st.view.cy, moved: false };
    try { SVG.setPointerCapture(e.pointerId); } catch (err) {}
  };
  SVG.onpointermove = function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    st.view.cx = drag.cx - dx / VB.sw * VB.w;
    st.view.cy = drag.cy - dy / VB.sh * VB.h;
    draw();
  };
  SVG.onpointerup = function (e) {
    var moved = drag && drag.moved;
    drag = null;
    try { SVG.releasePointerCapture(e.pointerId); } catch (err) {}
    if (moved) return;                        // 끌었으면 선택이 아니다
    var i = hitMarker(e.clientX, e.clientY);
    if (i >= 0) toggle(i);
  };
  SVG.onpointercancel = function (e) {
    drag = null;
    try { SVG.releasePointerCapture(e.pointerId); } catch (err) {}
  };
  SVG.onwheel = function (e) {
    e.preventDefault();
    zoom(e.deltaY > 0 ? 1.25 : 0.8, e.clientX, e.clientY);
  };
  $(".shmap-zi", box).onclick = function () { zoom(0.7); };
  $(".shmap-zo", box).onclick = function () { zoom(1.42); };
  $(".shmap-zf", box).onclick = function () { fit(); draw(); };
}

/* ── 창 만들기 ────────────────────────────────────────────── */
function buildBox() {
  box = document.createElement("div");
  box.className = "shmap-back";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "대피장소 지도에서 고르기");
  box.innerHTML =
    '<div class="shmap">'
    + '<header><b>대피장소 지도에서 고르기</b>'
      + '<span class="shmap-src"></span>'
      + '<button type="button" class="shmap-x" aria-label="닫기">✕</button></header>'
    + '<div class="shmap-bar">'
      + '<label>시·도<select class="shmap-sido"></select></label>'
      + '<label>시·군·구<select class="shmap-sgg"></select></label>'
      + '<span class="shmap-hint">지도의 점이나 오른쪽 목록을 눌러 고르세요 · 여러 곳도 됩니다</span>'
    + "</div>"
    + '<div class="shmap-body">'
      + '<div class="shmap-mapwrap">'
        + '<svg class="shmap-svg" role="img" aria-label="대피장소 지도"></svg>'
        + '<div class="shmap-ctl">'
          + '<button type="button" class="shmap-zi" title="확대">＋</button>'
          + '<button type="button" class="shmap-zo" title="축소">−</button>'
          + '<button type="button" class="shmap-zf" title="전체 보기">⤢</button>'
        + "</div>"
        + '<div class="shmap-scale"><i></i><b></b></div>'
      + "</div>"
      + '<div class="shmap-side">'
        + '<div class="shmap-lh">관내 대피장소 <span class="shmap-cnt"></span></div>'
        + '<div class="shmap-list"></div>'
      + "</div>"
    + "</div>"
    + '<footer><label class="shmap-tg">넣을 칸<select class="shmap-target"></select></label>'
      + '<button type="button" class="shmap-ok sm" disabled></button>'
      + '<button type="button" class="shmap-cancel sm">닫기</button></footer>'
    + "</div>";
  document.body.appendChild(box);

  SVG = $(".shmap-svg", box);
  bindMap();

  $(".shmap-sido", box).onchange = function () {
    st.sido = this.value; st.sgg = ""; fillSgg(); reload(true);
  };
  $(".shmap-sgg", box).onchange = function () {
    st.sgg = this.value; reload(true);
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
  if (e.key === "Escape") { e.preventDefault(); close(); }
}

function close() {
  if (!box) return;
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
     지난번에 다른 지역을 보다가 닫았어도 사고 지역으로 되돌립니다
     (남아 있던 시·도 때문에 사고 시·군·구를 못 찾는 일이 있었습니다). */
  if (opt.시군구) {
    st.sgg = opt.시군구;
    var sd = opt.시도 || st.sido;
    if (!sd || !((window.SHELTERS[sd] || {})[st.sgg])) sd = findSido(st.sgg) || "";
    st.sido = sd;
  } else {
    st.sido = opt.시도 || st.sido || "";
  }
  if (st.sido && !window.SHELTERS[st.sido]) { st.sido = ""; st.sgg = ""; }
  fillSido();
  st.sgg = $(".shmap-sgg", box).value;
  reload(true);

  /* 배경지도는 있으면 좋고 없어도 되는 것 — 확인되면 다시 그린다 */
  showSrc();
  probeTiles(function () { showSrc(); draw(); });

  var f = $(".shmap-sgg", box);
  if (f) f.focus();
}

/* 시·군·구 이름만 알 때 시·도 찾기 (동명 시·군·구가 있으면 첫 번째) */
function findSido(sgg) {
  var S = window.SHELTERS || {}, hit = null;
  Object.keys(S).forEach(function (sd) {
    if (!hit && S[sd] && S[sd][sgg]) hit = sd;
  });
  return hit;
}

function showSrc() {
  var cfg = window.BASEMAP || {};
  var el = $(".shmap-src", box);
  if (tiles.가능) el.textContent = "배경지도 " + (cfg.저작권 || "");
  else if (cfg.사용 && String(cfg.인증키).trim())
    el.textContent = "배경지도 없음 (타일 서버에 연결하지 못했습니다) · 경계선만 표시";
  else el.textContent = "행정경계선만 표시 (오프라인 동작)";
}

window.SHMAP = { open: open, close: close };

/* 창 크기가 바뀌면 종횡비가 달라지므로 다시 그린다 */
window.addEventListener("resize", function () {
  if (box && !box.hidden && st.view) draw();
});

})();
