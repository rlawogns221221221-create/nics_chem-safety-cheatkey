/* ============================================================
   화학사고 대피장소 지도

   ① 문자 작성 도구 안의 "지도에서 고르기"(assets/shmap.js)와 같은 엔진
   (assets/mapcore.js)을 씁니다. 배경지도·투영·거리 계산이 같으므로 두 화면에서
   같은 사고지점을 찍으면 같은 거리가 나옵니다.

   ── 이 화면이 고르기 창보다 더 하는 일 ─────────────────────
   · 거리 눈금 — 사고지점 둘레에 500m·1km 같은 고리를 그려, 재보지 않아도
     "얼마나 떨어져 있는지"가 바로 보이게 합니다.
   · 찾는 범위 — 사고지점 반경으로 찾으면 행정구역을 넘어갑니다. 사고지점이
     시·군 경계 가까이면 옆 시·군 대피장소가 관내 대피장소보다 가깝습니다.
   · 요약 줄 — 가장 가까운 곳과 거리 구간별 개수를 한 줄로 보여줍니다.
   · 풍하방향 — 바람이 향하는 쪽을 부채꼴로 표시합니다.
   · 연결선 — 고르거나 가리킨 곳까지 선을 긋고 거리·방위를 적습니다.

   ── 판단하지 않는 것 ───────────────────────────────────────
   어느 대피장소가 적절한지, 어디까지 대피시킬지는 이 도구가 정하지 않습니다.
   거리는 지형·도로를 무시한 직선거리이고, 반경 원과 풍하 부채꼴은 물질정보에
   적힌 참고 값을 그린 것이며 확산 모델링 결과가 아닙니다.
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

var LEE_DEG = 60;                  // 풍하방향으로 볼 각도 (풍향 반대쪽 ±60°)

var st = {
  sido: "", sgg: "",
  scope: "",                       // "" = 시·군·구 관내 / 숫자 = 사고지점 반경 (m)
  acc: null,                       // 사고지점 {lat, lon}
  radius: null,                    // 영향 참고 반경 (m)
  wind: "", mat: "",
  q: "", sort: "name",
  rings: true,                     // 거리 눈금 표시
  mode: "pick",                    // "acc" = 다음 클릭이 사고지점
  all: [], show: [],
  sel: -1, hover: -1,
  view: null
};
var SVG = null, VB = null;
/* 모든 시야 이동(확대·축소·전체보기·조건 바뀜)이 이 카메라를 거친다 —
   순간이동 없이 어디로 얼마나 움직였는지 보이게 하려는 것 (assets/mapcore.js) */
var CAM = MC.camera(function () { return st.view; }, function (v) { st.view = v; }, draw);

/* 새 배경지도 타일이 도착하면 다시 그린다 */
MC.tiles.onChange(function () { if (st.view) { draw(); showSrc(); } });

/* ── 표시 대상 고르기 ──────────────────────────────────────────
   범위를 반경으로 잡으면 행정구역을 보지 않고 전국에서 찾습니다.
   사고가 시·군 경계 가까이에서 나면 옆 시·군 대피장소가 관내보다 가깝기
   때문입니다. 목록에는 시·군·구를 함께 적어 어디 소속인지 보이게 합니다. */
function sourceList() {
  if (st.scope && st.acc) {
    var r = +st.scope;
    return MC.shelters("", "").filter(function (s) {
      return distM(st.acc.lat, st.acc.lon, s.lat, s.lon) <= r;
    });
  }
  if (!st.sido && !st.sgg) return [];
  return MC.shelters(st.sido, st.sgg);
}

function recompute() {
  st.all = sourceList();
  var acc = st.acc;
  st.all.forEach(function (s) {
    if (acc) {
      s.d = distM(acc.lat, acc.lon, s.lat, s.lon);
      s.b = bearing(acc.lat, acc.lon, s.lat, s.lon);
      s.inRing = st.radius > 0 && s.d <= st.radius;
      /* 풍향은 '불어오는 쪽' — 바람이 향하는 쪽(풍하) = 풍향 + 180 */
      if (st.wind !== "") {
        var diff = Math.abs(((s.b - ((+st.wind + 180) % 360)) + 540) % 360 - 180);
        s.lee = diff <= LEE_DEG;
      } else s.lee = false;
    } else { s.d = null; s.b = null; s.inRing = false; s.lee = false; }
  });

  var q = st.q.trim().toLowerCase();
  st.show = st.all.filter(function (s) {
    if (!q) return true;
    return (s.name + " " + (s.detail || "") + " " + (s.addr || "") + " "
            + (s.kind || "") + " " + s.sgg).toLowerCase().indexOf(q) >= 0;
  });
  if (st.sort === "dist" && acc) st.show.sort(function (a, b) { return a.d - b.d; });
  else if (st.sort === "cap") st.show.sort(function (a, b) { return (+b.cap || 0) - (+a.cap || 0); });
  else st.show.sort(function (a, b) { return a.name.localeCompare(b.name, "ko"); });

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
        m = Math.min(m, x); M = Math.max(M, x);
        n = Math.min(n, y); N = Math.max(N, y);
        any = true;
      }
    });
  });
  return any ? { m: m, M: M, n: n, N: N } : null;
}

/* 표시 대상·경계·사고지점이 다 들어오는 시야를 계산만 한다(적용은 fit() 이 함) */
function fitTarget() {
  var m = 2, M = -1, n = 2, N = -1, any = false;
  var add = function (x, y) {
    m = Math.min(m, x); M = Math.max(M, x);
    n = Math.min(n, y); N = Math.max(N, y);
    any = true;
  };
  st.show.forEach(function (s) { add(wx(s.lon), wy(s.lat)); });
  /* 반경으로 찾는 중이면 관내 경계는 시야 기준으로 삼지 않는다 */
  if (!st.scope) {
    var b = sggBox();
    if (b) { add(b.m, b.n); add(b.M, b.N); }
  }
  if (st.acc) {
    var far = Math.max(st.radius > 0 ? st.radius : 0, st.scope ? +st.scope : 0);
    var r = far ? mToWorld(far, st.acc.lat) : 0;
    add(wx(st.acc.lon) - r, wy(st.acc.lat) - r);
    add(wx(st.acc.lon) + r, wy(st.acc.lat) + r);
  }
  if (!any) return { cx: wx(127.8), cy: wy(36.3), w: 0.09 };   // 전국
  var w = (M - m) * 1.22, h = (N - n) * 1.22;
  return { cx: (m + M) / 2, cy: (n + N) / 2, w: Math.max(w, h * 1.35, 0.00035) };
}

/* 시야를 다시 잡는다. 처음 여는 화면(아직 볼 시야가 없음)은 그 자리서 바로
   보여 주고, 이미 뭔가 보고 있던 중이면 부드럽게 움직여 어디로 얼마나
   옮겨 가는지 눈으로 좇을 수 있게 한다. */
function fit() {
  var t = fitTarget();
  if (!st.view) { st.view = t; draw(); return; }
  CAM.animateTo(t, 420);
}

/* 고른 곳으로 지도를 옮긴다. 확대는 '너무 멀리 보고 있을 때만' 당깁니다 —
   이미 가까이 보고 있는데 매번 확대가 바뀌면 주변을 비교하는 흐름이 끊깁니다.
   사고지점이 있으면 둘이 한 화면에 들어오게 잡습니다. 거리를 눈으로
   확인하려는 것이므로 한쪽만 크게 보여 주면 소용이 없습니다. */
function moveTo(s) {
  if (!st.view) fit();
  /* 고른 곳은 항상 화면 가운데에 온다 — 예전에는 사고지점이 있으면 둘의
     중간점을 가운데로 잡았는데, 확대는 "이미 가까이 보고 있으면 그대로"
     규칙 때문에 min() 으로 더 넓어지지 못하게 막혀 있어서, 사고지점과 먼
     곳을 고르면 그 중간점 기준으로 고른 곳이 화면 가장자리나 밖으로
     밀려났다(실제로 그랬음). 가운데는 고른 곳으로 고정하고, 사고지점은
     "무리 없이 함께 보일 때만" 시야를 넓혀 포함시킨다. */
  var base = Math.min(st.view.w, mToWorld(1400, s.lat));
  var want = base;
  if (st.acc) {
    var span = Math.max(Math.abs(wx(s.lon) - wx(st.acc.lon)),
                        Math.abs(wy(s.lat) - wy(st.acc.lat)) * 1.35) * 2.6;
    want = Math.min(Math.max(base, span), base * 6);   // 너무 멀면 상한까지만 넓힌다
  }
  CAM.animateTo({ cx: wx(s.lon), cy: wy(s.lat), w: want }, 340);
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

/* ── 거리 눈금 ────────────────────────────────────────────────
   사고지점 둘레에 '떨어지는' 거리로 고리를 그린다. 축척 막대만으로는
   특정 대피장소가 얼마나 떨어졌는지 가늠하려면 눈으로 재야 하는데,
   고리가 있으면 몇 번째 고리 안팎인지로 바로 읽힙니다.
   확대 정도에 따라 간격을 바꿔 항상 2~3개가 보이게 합니다. */
function ringDists(vb) {
  if (!st.acc || !st.rings) return [];
  var latC = wyInv(vb.y + vb.h / 2);
  var fullM = distM(latC, wxInv(vb.x), latC, wxInv(vb.x + vb.w));
  var step = MC.niceDist(fullM / 5);
  var lim = fullM * 0.75;                    // 화면을 크게 넘는 고리는 안 그린다
  var out = [];
  for (var i = 1; i <= 5 && step * i <= lim; i++) out.push(step * i);
  return out;
}

/* ── 그리기 ───────────────────────────────────────────────── */
function draw() {
  if (!st.view) fit();
  VB = viewBox();
  var vb = VB, g = [];
  var R = 5.6;                                  // 마커 반지름 (px)

  g.push('<rect x="0" y="0" width="' + vb.sw + '" height="' + vb.sh + '" class="bg"/>');
  var tl = MC.tiles.layer(vb);
  g.push(tl);
  SVG.classList.toggle("hasbg", !!tl);
  g.push('<g class="bds">' + MC.boundaryPaths(vb, function (f) {
    return !st.scope && f.s === st.sido && MC.matchSgg(f.n, st.sgg);
  }) + "</g>");

  var acc = st.acc, ax = 0, ay = 0;
  if (acc) { ax = pX(acc.lon); ay = pY(acc.lat); }

  /* 풍하방향 부채꼴 — 바람이 향하는 쪽 ±60° */
  if (acc && st.wind !== "") {
    var down = (+st.wind + 180) % 360;
    var L = Math.sqrt(vb.sw * vb.sw + vb.sh * vb.sh);
    var p0 = ray(ax, ay, down - LEE_DEG, L), p1 = ray(ax, ay, down + LEE_DEG, L);
    g.push('<path class="lee" d="M' + ax.toFixed(1) + " " + ay.toFixed(1)
      + "L" + p0.x.toFixed(1) + " " + p0.y.toFixed(1)
      + "A" + L.toFixed(1) + " " + L.toFixed(1) + " 0 0 1 "
      + p1.x.toFixed(1) + " " + p1.y.toFixed(1) + 'Z"/>');
    var lbl = ray(ax, ay, down, Math.min(L * 0.42, vb.sh * 0.42));
    g.push('<text class="leelbl" x="' + lbl.x.toFixed(1) + '" y="' + lbl.y.toFixed(1)
      + '" font-size="12">풍하방향</text>');
  }

  /* 거리 눈금 */
  ringDists(vb).forEach(function (d) {
    var rr = pxLen(d, acc.lat);
    g.push('<circle class="grid" cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1)
      + '" r="' + rr.toFixed(1) + '"/>');
    g.push('<text class="gridlbl" x="' + ax.toFixed(1) + '" y="' + (ay - rr + 13).toFixed(1)
      + '" font-size="11">' + fmtDist(d) + "</text>");
  });

  /* 영향 참고 반경 */
  if (acc && st.radius > 0) {
    var pr = pxLen(st.radius, acc.lat);
    g.push('<circle class="ring" cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1)
      + '" r="' + pr.toFixed(1) + '"/>');
    g.push('<text class="ringlbl" x="' + ax.toFixed(1) + '" y="' + (ay + pr - 6).toFixed(1)
      + '" font-size="11.5">영향 참고 ' + fmtDist(st.radius) + "</text>");
  }

  /* 사고지점 ↔ 고르거나 가리킨 곳 연결선 */
  var focus = st.hover >= 0 ? st.show[st.hover] : (st.sel >= 0 ? st.show[st.sel] : null);
  if (acc && focus) {
    var fx = pX(focus.lon), fy = pY(focus.lat);
    g.push('<line class="link" x1="' + ax.toFixed(1) + '" y1="' + ay.toFixed(1)
      + '" x2="' + fx.toFixed(1) + '" y2="' + fy.toFixed(1) + '"/>');
    g.push('<text class="linklbl" x="' + ((ax + fx) / 2).toFixed(1)
      + '" y="' + ((ay + fy) / 2 - 5).toFixed(1) + '" font-size="12.5">'
      + fmtDist(focus.d) + " " + dirName(focus.b) + "쪽</text>");
  }

  /* 대피장소 */
  st.show.forEach(function (s, i) {
    var on = i === st.sel, hv = i === st.hover;
    g.push('<circle class="mk' + (s.inRing ? " in" : "") + (s.lee ? " lee" : "")
      + (on ? " on" : "") + (hv ? " hv" : "") + '" cx="' + pX(s.lon).toFixed(1)
      + '" cy="' + pY(s.lat).toFixed(1) + '" r="' + (on ? R * 1.6 : R).toFixed(1)
      + '" data-i="' + i + '"/>');
  });
  /* 이름 — 고른 곳·가리킨 곳은 항상, 그 외에는 개수가 적을 때만 */
  var cap = vb.sw < 560 ? 10 : (vb.sw < 900 ? 18 : 26);
  st.show.forEach(function (s, i) {
    if (i !== st.sel && i !== st.hover && st.show.length > cap) return;
    g.push('<text class="mkl' + (i === st.sel ? " on" : "") + '" x="' + pX(s.lon).toFixed(1)
      + '" y="' + (pY(s.lat) - R * 2).toFixed(1) + '" font-size="12">'
      + esc(s.name) + (s.d != null ? " " + fmtDist(s.d) : "") + "</text>");
  });
  if (st.show.length > cap)
    g.push('<text class="mkh" x="' + (vb.sw / 2) + '" y="' + (vb.sh - 10)
      + '" font-size="11">확대하거나 목록에서 가리키면 이름이 보입니다</text>');

  /* 사고지점 — 십자 */
  if (acc) {
    var L2 = 13;
    g.push('<line class="acc" x1="' + (ax - L2).toFixed(1) + '" y1="' + ay.toFixed(1)
      + '" x2="' + (ax + L2).toFixed(1) + '" y2="' + ay.toFixed(1) + '"/>');
    g.push('<line class="acc" x1="' + ax.toFixed(1) + '" y1="' + (ay - L2).toFixed(1)
      + '" x2="' + ax.toFixed(1) + '" y2="' + (ay + L2).toFixed(1) + '"/>');
    g.push('<circle class="accdot" cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="6"/>');
    g.push('<text class="acclbl" x="' + ax.toFixed(1) + '" y="' + (ay - L2 - 5).toFixed(1)
      + '" font-size="12">사고지점</text>');
  }

  SVG.setAttribute("viewBox", "0 0 " + vb.sw + " " + vb.sh);
  SVG.innerHTML = g.join("");
  drawScale(vb);
}

/* 방위각 deg 로 길이 L 만큼 간 화면 좌표 (북=0, 화면 y 는 아래로 증가) */
function ray(x, y, deg, L) {
  var a = deg * Math.PI / 180;
  return { x: x + Math.sin(a) * L, y: y - Math.cos(a) * L };
}

function drawScale(vb) {
  var s = MC.scale(vb);
  $("#scaleBar").style.width = s.px + "px";
  $("#scaleTxt").textContent = s.label;
}

/* 눌린 곳에서 가장 가까운 마커 (없으면 -1)
   마커마다 click 을 걸지 않는 이유: 끌기를 위해 포인터를 캡처하면 그 뒤의
   이벤트가 모두 <svg> 로 향하므로 마커의 click 이 오지 않습니다. */
function hitMarker(clientX, clientY) {
  var rc = SVG.getBoundingClientRect();
  var best = -1, bd = 1e9, TH = 18;
  st.show.forEach(function (s, i) {
    var dx = rc.left + pX(s.lon) - clientX, dy = rc.top + pY(s.lat) - clientY;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < bd) { bd = d; best = i; }
  });
  return bd <= TH ? best : -1;
}

/* ── 요약 줄 ──────────────────────────────────────────────────
   "이 근방에 무엇이 있나"를 한 줄로 답합니다. 목록을 다 훑지 않아도
   가장 가까운 곳과 거리 구간별 개수가 바로 보이게 하려는 것입니다. */
var BANDS = [1000, 2000, 5000];
function renderSummary() {
  var el = $("#mSum");
  if (!st.acc || !st.all.length) {
    el.hidden = !st.acc;
    if (st.acc) el.innerHTML = '<span class="ms-none">사고지점 주변에 표시할 대피장소가 없습니다.'
      + " 찾는 범위를 넓혀 보세요.</span>";
    return;
  }
  el.hidden = false;

  var sorted = st.all.slice().sort(function (a, b) { return a.d - b.d; });
  var near = sorted[0];
  var parts = [];
  parts.push('<span class="ms-near"><b>가장 가까운 곳</b>' + esc(near.name)
    + '<em>' + fmtDist(near.d) + " " + dirName(near.b) + "쪽</em></span>");

  var bands = BANDS.map(function (m) {
    var n = sorted.filter(function (s) { return s.d <= m; }).length;
    return '<span class="ms-b' + (n ? "" : " z") + '">' + fmtDist(m) + " 안 <b>" + n + "</b>곳</span>";
  }).join("");
  parts.push('<span class="ms-bands">' + bands + "</span>");

  if (st.radius > 0) {
    var inR = st.all.filter(function (s) { return s.inRing; }).length;
    parts.push('<span class="ms-warn' + (inR ? " on" : "") + '">영향 참고 반경 '
      + fmtDist(st.radius) + " 안 <b>" + inR + "</b>곳"
      + (inR ? " · 영향권일 수 있으니 확인하세요" : "") + "</span>");
  }
  if (st.wind !== "") {
    var lee = st.all.filter(function (s) { return s.lee; }).length;
    parts.push('<span class="ms-b">풍하방향 <b>' + lee + "</b>곳</span>");
  }

  /* 관내만 보고 있으면, 반경 안에 다른 시·군·구 대피장소가 더 있는지 알려준다.
     경계 근처 사고에서 더 가까운 곳을 놓치지 않게 하려는 것입니다. */
  if (!st.scope) {
    var have = {};
    st.all.forEach(function (s) { have[s.key] = true; });
    var more = MC.shelters("", "").filter(function (s) {
      return !have[s.key] && distM(st.acc.lat, st.acc.lon, s.lat, s.lon) <= 5000;
    }).length;
    if (more)
      parts.push('<button type="button" class="ms-more noprint">반경 5km 안 다른 시·군·구에 '
        + more + "곳 더 있습니다 · 범위 넓히기</button>");
  }

  el.innerHTML = parts.join("");
  var b = $(".ms-more", el);
  if (b) b.onclick = function () {
    st.scope = "5000"; $("#mScope").value = "5000";
    if (st.sort === "name") { st.sort = "dist"; $("#mSort").value = "dist"; }
    refresh(true);
  };
}

/* 어디 소속인지 보이게 시·군·구를 앞에 붙인다 — 반경으로 찾으면 여러 시·군·구가
   섞이기 때문이다. 원자료의 주소는 시·군·구가 빠진 것이 원칙이지만 들어 있는
   행도 있어, 이미 있으면 덧붙이지 않는다("남구 광주 남구 …" 방지). */
function placeOf(s) {
  var addr = String(s.addr || "");
  return addr.indexOf(s.sgg) >= 0 ? addr : (s.sgg + " " + addr).trim();
}

/* ── 목록 ─────────────────────────────────────────────────── */
function renderList() {
  var acc = st.acc;
  $("#listCnt").textContent = st.all.length
    ? (st.q ? st.show.length + " / " + st.all.length + "곳" : st.all.length + "곳") : "";

  if (!st.show.length) {
    $("#shList").innerHTML = '<p class="ms-empty">'
      + (!st.sido && !st.sgg && !st.scope
          ? "시·도와 시·군·구를 고르세요.<br>사고지점을 찍은 뒤 <b>찾는 범위</b>를 반경으로 바꾸면 행정구역과 상관없이 찾습니다."
         : st.q ? "‘" + esc(st.q) + "’ 과(와) 맞는 곳이 없습니다."
         : "선택한 범위에 등록된 대피장소가 없습니다.") + "</p>";
    return;
  }

  /* 거리 막대 — 줄끼리 견주어 보라고 넣습니다. 가장 먼 곳을 100 으로 둡니다 */
  var maxD = 0;
  if (acc) st.show.forEach(function (s) { maxD = Math.max(maxD, s.d); });

  $("#shList").innerHTML = st.show.map(function (s, i) {
    var on = i === st.sel;
    var bar = acc && maxD
      ? '<div class="ms-bar"><i style="width:' + Math.max(2, Math.round(s.d / maxD * 100)) + '%"></i></div>'
      : "";
    return '<div class="ms-it' + (on ? " on" : "") + (s.inRing ? " ring" : "")
      + '" data-i="' + i + '" role="button" tabindex="0" aria-pressed="' + (on ? "true" : "false") + '">'
      + '<div class="l1"><b>' + esc(s.name) + "</b>"
      + (s.detail ? '<span class="dt">' + esc(s.detail) + "</span>" : "")
      + (acc ? '<span class="d">' + fmtDist(s.d) + " " + dirName(s.b) + "</span>" : "")
      + "</div>" + bar
      + '<div class="l2">' + esc(placeOf(s))
      + (s.cap ? " · 수용 " + Number(s.cap).toLocaleString() + "명" : "")
      + (s.kind ? " · " + esc(s.kind) : "") + "</div>"
      + (s.inRing || s.lee
          ? '<div class="l5">'
            + (s.inRing ? '<span class="tag danger">영향 참고 반경 안</span>' : "")
            + (s.lee ? '<span class="tag lee">풍하방향</span>' : "") + "</div>" : "")
      + (s.tel ? '<div class="l3">' + esc(s.dept || "") + " " + esc(s.tel) + "</div>" : "")
      + (on ? '<div class="l4">' + MC.extLinks(s)
              + '<span class="ms-cp noprint">'
              + '<button class="sm" type="button" data-cp="' + i + '">이름 복사</button>'
              + '<button class="sm" type="button" data-cpa="' + i + '">이름+주소 복사</button>'
              + "</span></div>" : "")
      + "</div>";
  }).join("");

  $$("#shList .ms-it").forEach(function (el) {
    var i = +el.dataset.i;
    el.onclick = function (e) {
      if (e.target.tagName === "A" || e.target.tagName === "BUTTON") return;
      select(i, false);
    };
    el.onkeydown = function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i, false); }
    };
    el.onmouseenter = function () { st.hover = i; draw(); showAddr(); };
    el.onmouseleave = function () { if (st.hover === i) { st.hover = -1; draw(); showAddr(); } };
  });
  $$("#shList button[data-cp], #shList button[data-cpa]").forEach(function (btn) {
    btn.onclick = function (e) {
      e.stopPropagation();
      var full = btn.hasAttribute("data-cpa");
      var s = st.show[+(btn.dataset.cp != null ? btn.dataset.cp : btn.dataset.cpa)];
      copyText(full ? s.name + " (" + placeOf(s) + ")" : s.name, btn);
    };
  });
}

function select(i, fromMap) {
  st.sel = (st.sel === i ? -1 : i);
  renderList(); draw(); showAddr();
  if (st.sel >= 0 && !fromMap) moveTo(st.show[st.sel]);
  if (st.sel >= 0 && fromMap) {
    var el = $('#shList .ms-it[data-i="' + st.sel + '"]');
    if (el) el.scrollIntoView({ block: "nearest" });
  }
}

/* 지도 위 주소 표시 — 지금 보고 있는 곳이 어딘지 확인용 */
function showAddr() {
  var el = $("#mAddr");
  var s = st.hover >= 0 ? st.show[st.hover] : (st.sel >= 0 ? st.show[st.sel] : null);
  if (!s) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = "<b>" + esc(s.name) + "</b>"
    + (s.detail ? " <i>" + esc(s.detail) + "</i>" : "")
    + "<span>" + esc(placeOf(s)) + "</span>"
    + (s.cap ? "<em>수용 " + Number(s.cap).toLocaleString() + "명</em>" : "")
    + (s.d != null ? "<em>사고지점에서 " + fmtDist(s.d) + " " + dirName(s.b) + "쪽</em>" : "");
}

function renderLegend() {
  var it = ['<span><i class="dot sh"></i>대피장소</span>'];
  if (st.acc) it.push('<span><i class="dot ac"></i>사고지점</span>');
  if (st.radius > 0) it.push('<span><i class="dot in"></i>영향 참고 반경 안</span>');
  if (st.acc && st.wind !== "") it.push('<span><i class="dot lee"></i>풍하방향</span>');
  if (st.acc && st.rings) it.push('<span><i class="dot gr"></i>거리 눈금</span>');
  $("#mLeg").innerHTML = it.join("");
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
  syncSort(); renderSummary(); renderList(); renderLegend();
  if (refit) fit(); else draw();
  showAddr();
}

function syncSort() {
  $$("#mSort option").forEach(function (o) { if (o.value === "dist") o.disabled = !st.acc; });
  if (!st.acc && st.sort === "dist") { st.sort = "name"; $("#mSort").value = "name"; }
  $$("#mScope option").forEach(function (o) { if (o.value) o.disabled = !st.acc; });
}

/* ── 물질 → 영향 참고 반경 ────────────────────────────────── */
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

function renderRad() {
  var box = $("#mRad");
  var m = st.mat ? findMaterial(st.mat) : null;

  if (!st.mat && st.radius == null) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;

  if (st.mat && !m) {
    box.innerHTML = '<span class="mr-none">‘' + esc(st.mat)
      + "’은(는) 물질정보 460종 목록에 없습니다. 반경을 직접 입력하세요.</span>"
      + radInput();
    bindRad();
    return;
  }

  var rows = [], btns = [];
  if (m) {
    [["초기이격거리 (전 방향)", m.d1], ["방호활동거리 (풍하방향)", m.d2],
     ["화재 동반 시 대피거리", m.d3]].forEach(function (x) {
      if (!x[1]) return;
      rows.push("<dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd>");
      pickDistances(x[1]).forEach(function (v) {
        if (btns.indexOf(v) < 0) btns.push(v);
      });
    });
    btns.sort(function (a, b) { return a - b; });
  }

  box.innerHTML = '<span class="mr-lb">영향 참고 반경</span>'
    + (m ? '<b class="mr-nm">' + esc(m.n) + "</b>" : "")
    + btns.slice(0, 6).map(function (v) {
        return '<button type="button" class="sm" data-r="' + v + '"'
          + (st.radius === v ? ' aria-pressed="true"' : "") + ">" + fmtDist(v) + "</button>";
      }).join("")
    + radInput()
    + (rows.length
        ? '<details class="mr-more noprint"><summary>물질정보 원문</summary>'
          + "<dl>" + rows.join("") + "</dl>"
          + '<p class="src">' + esc(VERSION.물질정보_출처)
          + " 에 적힌 참고 거리입니다. 확산 모델링 결과가 아니며, 대피 범위 판단은 담당자가 합니다.</p>"
          + "</details>"
        : "");
  bindRad();
}
function radInput() {
  return '<input type="text" class="mr-in" id="mRadIn" inputmode="numeric" placeholder="m"'
    + ' value="' + (st.radius || "") + '" aria-label="반경 직접 입력 (m)">'
    + '<button type="button" class="sm" id="mRadX" title="반경 지우기">×</button>';
}
function bindRad() {
  $$("#mRad button[data-r]").forEach(function (b) {
    b.onclick = function () { setRadius(+b.dataset.r); };
  });
  var inp = $("#mRadIn");
  if (inp) inp.oninput = function () {
    var v = parseInt(String(inp.value).replace(/[^\d]/g, ""), 10);
    setRadius(isNaN(v) ? null : v, true);
  };
  var x = $("#mRadX");
  if (x) x.onclick = function () { setRadius(null); };
}
function setRadius(m, keepInput) {
  st.radius = m && m > 0 ? m : null;
  recompute(); renderSummary(); renderList(); renderLegend(); draw();
  if (!keepInput) renderRad();
  else $$("#mRad button[data-r]").forEach(function (b) {
    b.setAttribute("aria-pressed", String(st.radius === +b.dataset.r));
  });
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

/* 사고지점으로 지도를 옮깁니다 — 한 번의 움직임으로 끝내야 "훅 튀어 보이는"
   순간이 없다(예전엔 refresh(true) 가 먼저 전체 시야로 순간이동하고 나서
   이 함수가 다시 근방으로 당겨, 두 단계로 보였다).
   지도를 직접 눌러 찍었을 때(jump=false)는 이미 보이는 자리이므로 너무
   멀리 보고 있을 때만 당깁니다. 주소검색·위도경도 입력처럼 지금 화면 밖일
   수도 있는 경우(jump=true)는 멀든 가깝든 반드시 그리로 움직입니다. */
function moveToAcc(jump) {
  var near = st.all.length
    ? st.all.slice().sort(function (a, b) { return a.d - b.d; }).slice(0, 3)
    : [];
  var reach = Math.max(near.length ? near[near.length - 1].d : 0,
                       st.radius > 0 ? st.radius : 0,
                       st.scope ? +st.scope : 0) || 1200;
  var w = mToWorld(reach * 2.6, st.acc.lat);          // 지름 + 여유

  if (!st.view) { st.view = { cx: wx(st.acc.lon), cy: wy(st.acc.lat), w: w }; draw(); return; }

  var farAway = Math.abs(wx(st.acc.lon) - st.view.cx) > st.view.w
             || Math.abs(wy(st.acc.lat) - st.view.cy) > st.view.w;
  if (!jump && !farAway && w >= st.view.w * 0.85) return;   // 이미 그만큼 가까이 보고 있다
  var tw = farAway ? Math.max(w, st.view.w * 0.5) : Math.min(w, st.view.w);
  CAM.animateTo({ cx: wx(st.acc.lon), cy: wy(st.acc.lat), w: tw }, 420);
}

/* ── 주소·장소 검색 ────────────────────────────────────────────
   인터넷 지도 서비스처럼 임의의 도로명 주소를 다 찾아 주는 것은 아닙니다 —
   이 도구 안에 이미 있는 데이터(등록된 대피장소 주소, 시·군·구, 그 주소에
   적힌 읍·면·동 이름)에서만 찾습니다. 사고지점을 정확히 찍기 전에 대략
   그 언저리로 지도를 옮기는 용도이며, 고른다고 곧바로 사고지점이 찍히지는
   않습니다 — 근사한 위치(읍·면·동 평균 좌표 등)를 사고지점으로 오인하지
   않도록, 옮겨간 자리에서 정확한 곳을 직접 눌러 찍게 합니다. */
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
  var out = [], dong = {};
  var S = window.SHELTERS || {};
  Object.keys(S).forEach(function (sido) {
    Object.keys(S[sido]).forEach(function (sgg) {
      var rows = S[sido][sgg], any = false;
      rows.forEach(function (r) {
        if (r[5] == null || r[6] == null) return;
        any = true;
        out.push({ label: r[0] + " · " + sgg + " " + (r[2] || ""), lat: r[5], lon: r[6],
                   sido: sido, sgg: sgg, kind: "place" });
        /* "개령면 감문로 277(신룡리)" → "개령면", "신룡리" */
        var addr = String(r[2] || "");
        var m1 = /^([가-힣0-9]+(?:읍|면|동))\s/.exec(addr);
        var m2 = /\(([가-힣0-9]+(?:동|리|가))\)/.exec(addr);
        [m1 && m1[1], m2 && m2[1]].forEach(function (nm) {
          if (!nm) return;
          var key = sido + "|" + sgg + "|" + nm;
          var d = dong[key] || (dong[key] = { sido: sido, sgg: sgg, nm: nm, sx: 0, sy: 0, n: 0 });
          d.sx += r[6]; d.sy += r[5]; d.n++;
        });
      });
      if (any) {
        var c = boundaryCenter(sido, sgg);
        out.push({ label: sido + " " + sgg, lat: c ? c.lat : rows[0][5], lon: c ? c.lon : rows[0][6],
                   sido: sido, sgg: sgg, kind: "sgg" });
      }
    });
  });
  Object.keys(dong).forEach(function (key) {
    var d = dong[key];
    out.push({ label: d.sido + " " + d.sgg + " " + d.nm, lat: d.sy / d.n, lon: d.sx / d.n,
               sido: d.sido, sgg: d.sgg, kind: "dong" });
  });
  PLACE_IDX = out;
  return out;
}
var KIND_ORDER = { sgg: 0, dong: 1, place: 2 };
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
var KIND_LABEL = { sgg: "시·군·구", dong: "읍·면·동", place: "대피장소" };
var addrRows = [], addrSel = -1;
function renderAddrPop(q) {
  var pop = $("#addrPop");
  addrRows = searchPlaces(q);
  if (!addrRows.length) {
    pop.innerHTML = q.trim()
      ? '<div class="mpk-none">‘' + esc(q) + "’ 과 맞는 곳이 없습니다.<br>"
        + "등록된 대피장소 주소·시군구·읍면동 이름으로 찾을 수 있습니다.</div>"
      : '<div class="mpk-none">등록된 대피장소 주소·시군구·읍면동 이름으로 찾습니다.</div>';
    addrSel = -1;
  } else {
    pop.innerHTML = '<div class="mpk-list" id="addrList">' + addrRows.map(function (p, i) {
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
/* 고른 곳으로 지도를 옮기고, 사고지점 찍기 모드를 켠다 — 근사 좌표(시군구·
   읍면동 평균)를 그대로 사고지점으로 오인하지 않도록 마지막 클릭은 사용자가 한다 */
function pickAddr(p) {
  closeAddrPop();
  $("#mAddrQ").value = p.label;
  if (p.sido !== st.sido || p.sgg !== st.sgg) {
    $("#mSido").value = p.sido; $("#mSido").onchange();
    $("#mSgg").value = p.sgg; $("#mSgg").onchange();
  }
  if (!st.view) fit();
  var w = mToWorld(900, p.lat);
  var farAway = Math.abs(wx(p.lon) - st.view.cx) > st.view.w
             || Math.abs(wy(p.lat) - st.view.cy) > st.view.w;
  CAM.animateTo({ cx: wx(p.lon), cy: wy(p.lat),
    w: farAway ? Math.max(w, st.view.w * 0.5) : Math.min(w, st.view.w) }, 420);
  setMode("acc");
}
/* 입력칸·풍향 단추 밑에 붙는 작은 창들의 공통 위치 계산 */
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

function clearAcc() {
  st.acc = null; st.scope = "";
  $("#acLat").value = ""; $("#acLon").value = ""; $("#mScope").value = "";
  st.sort = "name"; $("#mSort").value = "name";
  setMode("pick");
  refresh(true);
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

/* ── 풍향 (나침반) ────────────────────────────────────────────
   "풍향(불어오는 쪽)" 이라는 말 자체가 헷갈리기 쉽다 — 실제로 궁금한 것은
   "그래서 어느 쪽으로 퍼지는가"(풍하방향)다. 목록에서 방위 하나를 고르는
   대신, 나침반에서 바람이 불어오는 쪽을 찍으면 반대쪽(풍하방향)으로 화살표가
   함께 보이도록 했다. st.wind 에 담기는 값(도, 북=0)은 이전과 같다. */
var WIND_DIRS = [
  { deg: 0, ko: "북" }, { deg: 45, ko: "북동" }, { deg: 90, ko: "동" }, { deg: 135, ko: "남동" },
  { deg: 180, ko: "남" }, { deg: 225, ko: "남서" }, { deg: 270, ko: "서" }, { deg: 315, ko: "북서" }
];
function windKo(deg) { return WIND_DIRS.filter(function (d) { return d.deg === +deg; })[0].ko; }
function buildWindPop() {
  var btns = WIND_DIRS.map(function (d) {
    var rad = d.deg * Math.PI / 180;
    var x = 50 + Math.sin(rad) * 38, y = 50 - Math.cos(rad) * 38;
    return '<button type="button" class="wr-b" data-deg="' + d.deg + '"'
      + ' style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) + '%"'
      + ' aria-pressed="false" title="' + d.ko + '풍 — ' + d.ko + '쪽에서 불어옴">' + d.ko + "</button>";
  }).join("");
  $("#windPop").innerHTML =
    '<div class="windpop-hd">바람이 <b>불어오는 쪽</b>을 고르세요</div>'
    + '<div class="windrose"><div class="wr-ring"></div>'
      + '<div class="wr-arrow" id="wrArrow" hidden></div>'
      + '<div class="wr-hub"></div>'
      + btns
    + "</div>"
    + '<div class="wr-cap" id="wrCap">방향을 고르면<br>퍼지는 쪽이 함께 보입니다</div>'
    + '<button type="button" class="sm windpop-clear" id="windClear">모름 / 표시 안 함</button>';
  $$("#windPop .wr-b").forEach(function (b) {
    b.onclick = function () { setWind(b.dataset.deg); };
  });
  $("#windClear").onclick = function () { setWind(""); };
}
function updateWindUI() {
  var has = st.wind !== "";
  $("#windBtn").classList.toggle("on", has);
  $("#windBtnTxt").textContent = has ? windKo(st.wind) + "풍" : "설정 안 함";
  $$("#windPop .wr-b").forEach(function (b) {
    b.setAttribute("aria-pressed", String(has && +b.dataset.deg === +st.wind));
  });
  var arrow = $("#wrArrow"), cap = $("#wrCap");
  if (has) {
    var down = (+st.wind + 180) % 360;
    arrow.hidden = false;
    arrow.style.transform = "translateX(-50%) rotate(" + down + "deg)";
    cap.innerHTML = "<b>" + windKo(st.wind) + "풍</b> — " + windKo(down) + "쪽으로 퍼집니다";
  } else {
    arrow.hidden = true;
    cap.innerHTML = "방향을 고르면<br>퍼지는 쪽이 함께 보입니다";
  }
}
function setWind(deg) {
  st.wind = deg;
  updateWindUI();
  recompute(); renderSummary(); renderList(); renderLegend(); draw();
}
function openWindPop() {
  $("#windPop").hidden = false;
  placePopover($("#windPop"), $("#windBtn"));
  $("#windBtn").setAttribute("aria-expanded", "true");
}
function closeWindPop() {
  $("#windPop").hidden = true;
  $("#windBtn").setAttribute("aria-expanded", "false");
}
function bindWind() {
  buildWindPop();
  updateWindUI();
  $("#windBtn").onclick = function () {
    if ($("#windPop").hidden) openWindPop(); else closeWindPop();
  };
  document.addEventListener("mousedown", function (e) {
    var pop = $("#windPop"), btn = $("#windBtn");
    if (!pop.hidden && e.target !== btn && !btn.contains(e.target) && !pop.contains(e.target)) closeWindPop();
  });
  window.addEventListener("resize", function () { if (!$("#windPop").hidden) placePopover($("#windPop"), $("#windBtn")); });
}

/* ── 조작 ─────────────────────────────────────────────────── */
/* 마우스 휠은 계속 이어지는 동작이라(연달아 여러 번 굴러 온다) 매번 트윈을
   새로 걸면 오히려 버벅여 보인다 — 휠·드래그는 지금처럼 그 자리서 바로
   반응하고, "누르는" 동작(버튼)만 애니메이션을 태운다. */
function zoom(f, cx, cy) {
  var v = st.view;
  var nw = Math.max(0.0000015, Math.min(1.2, v.w * f));
  if (cx != null) {
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
/* ＋/－ 단추는 항상 화면 가운데를 기준으로 확대·축소하며, 얼마나 당겨지는지
   보이도록 부드럽게 움직인다 */
function zoomBtn(f) {
  var nw = Math.max(0.0000015, Math.min(1.2, st.view.w * f));
  CAM.animateTo({ cx: st.view.cx, cy: st.view.cy, w: nw }, 260);
}

function bindMap() {
  var drag = null;
  SVG.onpointerdown = function (e) {
    CAM.stop();
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
    if (moved) return;                       // 끌었으면 선택이 아니다
    if (st.mode === "acc") {
      var ll = toLL(e.clientX, e.clientY);
      setAcc(ll.lat, ll.lon);                // 찍은 자리가 유지되도록 시야는 그대로
      return;
    }
    var i = hitMarker(e.clientX, e.clientY);
    if (i >= 0) select(i, true);
  };
  SVG.onpointercancel = function (e) {
    drag = null;
    try { SVG.releasePointerCapture(e.pointerId); } catch (err) {}
  };
  SVG.onwheel = function (e) {
    e.preventDefault();
    CAM.stop();
    zoom(e.deltaY > 0 ? 1.25 : 0.8, e.clientX, e.clientY);
  };
  $("#zIn").onclick = function () { zoomBtn(0.7); };
  $("#zOut").onclick = function () { zoomBtn(1.42); };
  $("#zFit").onclick = function () { fit(); };
  window.addEventListener("resize", function () { if (st.view) draw(); });
}

/* ── 초기화 ───────────────────────────────────────────────── */
function initSelects() {
  var sido = $("#mSido"), sgg = $("#mSgg");
  sido.innerHTML = '<option value="">선택</option>'
    + Object.keys(SHELTERS).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  var fillSgg = function () {
    var m = SHELTERS[sido.value] || {};
    var ks = Object.keys(m).sort();
    sgg.innerHTML = '<option value="">' + (sido.value ? "시·도 전체" : "시·도 먼저") + "</option>"
      + ks.map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  };
  fillSgg();
  sido.onchange = function () {
    st.sido = sido.value; st.sgg = ""; fillSgg(); refresh(true);
  };
  sgg.onchange = function () { st.sgg = sgg.value; refresh(true); };
}

function initSrcModal() {
  $("#ver").innerHTML =
    "<p><b>대피장소</b> — " + esc(VERSION.대피장소_출처) + " · 기준일 "
      + esc(VERSION.대피장소_기준일) + " ("
      + SHELTER_META.총건수.toLocaleString() + "곳 · 좌표 포함)</p>"
    + "<p><b>배경지도</b> — " + esc(VERSION.배경지도) + ". 인터넷이 되는 환경에서만 표시되며, "
      + "안 되면 행정경계선만 그립니다.</p>"
    + "<p><b>행정경계</b> — " + esc(VERSION.경계_출처) + ". "
      + "<b>위치를 가늠하기 위한 배경선이며 법적 행정경계가 아닙니다.</b> "
      + "정식 배포 전 원내 정본 데이터로 교체를 권장합니다.</p>"
    + "<p><b>영향 참고 반경</b> — " + esc(VERSION.물질정보_출처) + ". "
      + "물질정보에 적힌 참고 거리이며 확산 모델링 결과가 아닙니다.</p>"
    + "<p><b>거리·방위</b> — 지형·도로를 고려하지 않은 직선거리(하버사인)입니다. "
      + "실제 이동거리는 이보다 깁니다.</p>"
    + "<p><b>풍하방향</b> — 입력한 풍향의 반대쪽 ±" + LEE_DEG + "° 를 칠한 것입니다. "
      + "지형·풍속·물질 밀도를 반영하지 않습니다.</p>"
    + "<p>담당자 개인 이름·연락처는 데이터에 포함하지 않았습니다. 관할부서 대표번호만 표시합니다.</p>"
    + "<p class=\"src\">도구 버전 " + esc(VERSION.도구버전) + " · 반영일 " + esc(VERSION.반영일) + "</p>";

  var open = function () { $("#srcModal").hidden = false; document.body.style.overflow = "hidden"; };
  var close = function () { $("#srcModal").hidden = true; document.body.style.overflow = ""; };
  $("#btnSrc").onclick = open;
  $("#btnSrcClose").onclick = close;
  $("#srcModal").onclick = function (e) { if (e.target.id === "srcModal") close(); };
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!$("#srcModal").hidden) { close(); return; }
    if (!$("#windPop").hidden) { closeWindPop(); return; }
    if (!$("#addrPop").hidden) { closeAddrPop(); return; }
    if (st.mode === "acc") setMode("pick");
  });
}

function init() {
  SVG = $("#map");
  initSelects();
  initSrcModal();
  bindMap();

  /* 배경지도 고르기 */
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
  $("#mQ").oninput = function () {
    st.q = this.value; recompute(); renderList(); draw();
  };
  $("#mSort").onchange = function () {
    st.sort = this.value; recompute(); renderList(); draw();
  };
  $("#mMat").oninput = function () { st.mat = this.value.trim(); renderRad(); };
  bindWind();
  bindAddrSearch();
  $("#cRings").onchange = function () { st.rings = this.checked; renderLegend(); draw(); };

  $("#btnAcc").onclick = function () { setMode(st.mode === "acc" ? "pick" : "acc"); };
  $("#btnAccClear").onclick = clearAcc;

  var latlon = function () {
    var la = parseFloat($("#acLat").value), lo = parseFloat($("#acLon").value);
    /* 우리나라 범위 밖 값은 오타로 보고 무시한다 */
    if (isFinite(la) && isFinite(lo) && la > 32 && la < 40 && lo > 123 && lo < 133)
      setAcc(la, lo, true);
  };
  $("#acLat").oninput = latlon;
  $("#acLon").oninput = latlon;

  $("#btnPrint").onclick = function () { window.print(); };
  $("#btnClear").onclick = function () {
    st.sido = ""; st.sgg = ""; st.scope = ""; st.acc = null; st.radius = null;
    st.mat = ""; st.q = ""; st.sort = "name"; st.rings = true;
    ["mMat", "mQ", "acLat", "acLon", "mAddrQ"].forEach(function (id) { $("#" + id).value = ""; });
    $("#mSido").value = ""; $("#mSido").onchange();
    $("#mScope").value = ""; $("#mSort").value = "name";
    $("#cRings").checked = true;
    setWind("");
    renderRad();
    setMode("pick");
  };

  setMode("pick");
  showSrc();
  refresh(true);
}

document.addEventListener("DOMContentLoaded", init);
})();
