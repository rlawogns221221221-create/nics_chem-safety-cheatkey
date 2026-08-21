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
  me: null,                        // 내 위치 {lat, lon, acc} — 사고지점과 별개
  /* 가까운 3곳 카드를 접어 두었는가.
     휴대전화에서는 이 카드가 지도 한가운데를 덮어(작은 화면에서 지도의 4분의 1
     ~ 5분의 2) 그 자리를 손가락으로 만질 수 없게 됩니다. 좁은 화면에서는 머리표만
     남기고 접은 채로 시작하고, 필요할 때 눌러 폅니다. 가장 가까운 한 곳은
     지도 위쪽 요약 띠(.msum)에 늘 적혀 있으므로 접혀 있어도 놓치지 않습니다. */
  nearFold: matchMedia("(max-width: 860px)").matches,
  /* 지도에 어느 자료를 올려 둘까 (둘 다 켤 수 있습니다)
       chem 화학사고 대피장소 — 화학사고에 대비해 미리 지정해 둔 곳
       temp 이재민 임시주거시설 — 재난 때 이재민을 수용하는 곳 (행정안전부)
     자료 파일(data/tempshelters.js)이 없으면 temp 쪽은 아예 나오지 않습니다. */
  layers: { chem: true, temp: true },
  walk: true,                      // 도보 경로를 길찾기로 받아올까 (인터넷 필요)
  route: null,                     // 받아 온 경로 {key, path, dist}
  routeBusy: false, routeErr: null,
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
   때문입니다. 목록에는 시·군·구를 함께 적어 어디 소속인지 보이게 합니다.

   자료는 두 가지(화학사고 대피장소·이재민 임시주거시설)이고, 켜 둔 것만
   모아 한 목록으로 만듭니다. 아래로는 자료 종류를 구분하지 않고 다룹니다 —
   거리·정렬·경로·문자 넘기기가 두 자료에서 똑같이 동작해야 하기 때문입니다. */

/* 켜 둔 자료 전국 전체 — 범위를 넓히면 몇 곳이 더 있는지 셀 때처럼
   범위와 상관없이 훑어야 할 때 씁니다. */
function allRows() {
  var out = [];
  if (st.layers.chem) out = out.concat(MC.shelters("", ""));
  if (st.layers.temp && MC.hasTemp()) out = out.concat(MC.tempShelters("", ""));
  return out;
}

/* 자료 한 종류를 지금 범위(관내 또는 사고지점 반경)로 잘라 온다.
   켜고 끄기와 무관하게 "이 범위에 몇 곳 있는지"를 세는 데도 쓴다. */
function scopeRows(src) {
  var get = src === "temp" ? MC.tempShelters : MC.shelters;
  if (st.scope && st.acc) {
    var r = +st.scope;
    return get("", "").filter(function (s) {
      return distM(st.acc.lat, st.acc.lon, s.lat, s.lon) <= r;
    });
  }
  if (!st.sido && !st.sgg) return [];
  return get(st.sido, st.sgg);
}

function sourceList() {
  var out = [];
  if (st.layers.chem) out = out.concat(scopeRows("chem"));
  if (st.layers.temp && MC.hasTemp()) out = out.concat(scopeRows("temp"));
  return out;
}

/* ── 두 가지 대피처 고르기 ──────────────────────────────────────
   화학사고 대피장소는 화학사고에 대비해 시·군·구가 미리 지정해 둔 곳이고,
   이재민 임시주거시설은 재난 때 이재민을 수용하려고 지정해 둔 곳입니다.
   지정한 목적도 관리하는 곳도 달라 목록이 겹치지 않습니다. 어느 한쪽만
   보면 근처에 있는 다른 쪽을 놓치므로, 함께 켜 두고 색으로 구분합니다.

   data/tempshelters.js 가 없으면(자료를 아직 안 받아 왔으면) 이 줄은 아예
   나오지 않고 화면은 예전 그대로입니다. */
var SRC_LABEL = { chem: "화학사고 대피장소", temp: "이재민 임시주거시설" };
var SRC_SHORT = { chem: "화학사고", temp: "이재민" };

function renderSrcBar() {
  var el = $("#mLayers");
  if (!el) return;
  if (!MC.hasTemp()) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = ["chem", "temp"].map(function (k) {
    var n = scopeRows(k).length;
    return '<button type="button" class="ms-lyr ' + k + (st.layers[k] ? " on" : "")
      + '" data-k="' + k + '" aria-pressed="' + (st.layers[k] ? "true" : "false") + '">'
      + '<i class="dot ' + (k === "temp" ? "tmp" : "sh") + '"></i>'
      + SRC_LABEL[k] + "<b>" + n.toLocaleString() + "</b></button>";
  }).join("");
  $$(".ms-lyr", el).forEach(function (b) {
    b.onclick = function () { toggleSrc(b.dataset.k); };
  });
}

function toggleSrc(k) {
  var other = k === "chem" ? "temp" : "chem";
  /* 마지막 하나까지 꺼서 빈 지도가 되는 일은 막습니다 — 급할 때 잘못 눌러
     아무것도 안 보이면 도구가 고장난 것으로 보입니다. */
  if (st.layers[k] && !st.layers[other]) {
    toast("두 가지 중 적어도 하나는 켜 두어야 합니다");
    return;
  }
  st.layers[k] = !st.layers[k];
  renderSrcBar();
  refresh(false);
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
  /* 사고지점이나 조건이 바뀌면 받아 둔 경로는 더 이상 맞지 않는다.
     지우지 않으면 옮긴 사고지점 기준의 목록에 예전 '실제 도로' 값이 남는다. */
  st.route = null; st.routeErr = null; st.routeBusy = false;
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

  /* 사고지점 ↔ 고르거나 가리킨 곳 경로선 — 거리와 함께 "걸어서 몇 분"을
     같이 적습니다. 대피 안내에 실제로 쓰는 값은 미터가 아니라 분입니다.

     길찾기로 실제 도로 경로를 받아 왔으면 그 길을 그대로 그립니다. 그때는
     거리도 도로를 따라 잰 값이라 우회계수를 곱하지 않습니다. */
  var focus = st.hover >= 0 ? st.show[st.hover] : (st.sel >= 0 ? st.show[st.sel] : null);
  if (acc && focus) {
    var fx = pX(focus.lon), fy = pY(focus.lat);
    var rt = st.route && st.route.key === focus.key ? st.route : null;
    var lx, ly, txt;
    if (rt && rt.path.length > 1) {
      var d = "";
      for (var pi = 0; pi < rt.path.length; pi++)
        d += (pi ? "L" : "M") + pX(rt.path[pi].lon).toFixed(1)
           + " " + pY(rt.path[pi].lat).toFixed(1);
      g.push('<path class="route-cas" d="' + d + '"/>');
      g.push('<path class="route real" d="' + d + '"/>');
      var mid = rt.path[Math.floor(rt.path.length / 2)];
      lx = pX(mid.lon); ly = pY(mid.lat) - 11;
      txt = "도로 " + fmtDist(rt.dist) + " · " + MC.tripPair(rt.dist, true).label;
    } else {
      g.push(MC.routePath(ax, ay, fx, fy));
      lx = (ax + fx) / 2; ly = (ay + fy) / 2 - 9;
      txt = fmtDist(focus.d) + " " + dirName(focus.b) + "쪽 · " + MC.tripPair(focus.d).label
          + (st.routeBusy && focus.key === (st.show[st.sel] || {}).key ? " · 길 찾는 중…" : "");
    }
    g.push('<text class="linklbl" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1)
      + '" font-size="12.5">' + esc(txt) + "</text>");
  }

  /* 대피장소 — 두 자료를 섞어 찍으므로 색으로 구분한다(tmp = 이재민 임시주거시설) */
  st.show.forEach(function (s, i) {
    var on = i === st.sel, hv = i === st.hover;
    g.push('<circle class="mk' + (s.src === "temp" ? " tmp" : "")
      + (s.inRing ? " in" : "") + (s.lee ? " lee" : "")
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

  /* 내 위치가 사고지점과 사실상 같은 자리인가 — 내 위치 단추로 찍은 직후가
     늘 그렇습니다. 이때 십자와 파란 점, 라벨 두 개를 겹쳐 그리면 무엇이
     무엇인지 알아볼 수 없게 됩니다. 십자 하나로 합치고 라벨에 둘 다 적습니다. */
  var meIsAcc = !!(st.me && acc
    && distM(acc.lat, acc.lon, st.me.lat, st.me.lon) <= Math.max(st.me.acc || 0, 25));

  /* 사고지점 — 십자 */
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

  /* 내 위치 — 맨 나중에 그려 무엇에도 가리지 않게 한다.
     단말이 알려 준 오차 범위를 옅은 원으로 함께 그린다. 실내에서는 이 원이
     수백 미터로 커지는데, 그게 보여야 좌표를 곧이곧대로 믿지 않는다. */
  if (st.me) {
    var mx = pX(st.me.lon), my = pY(st.me.lat);
    if (st.me.acc > 0) {
      var ar = pxLen(st.me.acc, st.me.lat);
      if (ar > 6) g.push('<circle class="meacc" cx="' + mx.toFixed(1) + '" cy="'
        + my.toFixed(1) + '" r="' + Math.min(ar, vb.sw).toFixed(1) + '"/>');
    }
    /* 사고지점과 같은 자리면 십자에 맡기고 점·라벨은 그리지 않는다 */
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

/* 지금보다 한 칸 넓은 반경. 관내만 보고 있으면(범위 미지정) 5km 부터.
   더 넓힐 곳이 없으면 "" 를 돌려준다. */
var SCOPES = ["2000", "5000", "10000", "20000"];
function nextScope() {
  if (!st.scope) return "5000";
  var i = SCOPES.indexOf(st.scope);
  return i >= 0 && i + 1 < SCOPES.length ? SCOPES[i + 1] : "";
}
function setScope(v) {
  st.scope = v;
  $("#mScope").value = v;
  if (st.sort === "name") { st.sort = "dist"; $("#mSort").value = "dist"; }
  refresh(true);
}

/* 사고지점이 어디인지 글로도 적는다 — 좌표만 있으면 문자에 쓸 수 없고,
   문자로 넘기기 전에 맞는 자리인지 눈으로 확인할 방법도 없다.
   행정경계로 어림잡은 값은 '대략'이라고 적어 확정값과 구분한다. */
function accChip() {
  var a = st.accAddr;
  if (!a) return "";
  var txt = [a.sgg, a.emd, (a.road + " " + (a.no || "")).trim()]
    .filter(Boolean).join(" ");
  if (!txt) return "";
  return '<span class="ms-acc"><b>사고지점</b>' + esc(txt)
    + (a.exact ? "" : '<i title="행정경계와 가까운 대피장소 주소로 어림잡은 값입니다">대략</i>')
    + "</span>";
}

function renderSummary() {
  var el = $("#mSum");
  /* 빈 상태에서는 좁은 화면의 '한 줄 가로 스크롤'을 풀어야 한다 —
     안내 문구가 길어 단추가 화면 오른쪽 밖으로 밀려나기 때문이다. */
  el.classList.toggle("is-empty", !st.all.length);

  if (!st.acc || !st.all.length) {
    el.hidden = !st.acc;
    if (st.acc) {
      /* 안내만 하고 끝내면 정작 '찾는 범위' 고르는 칸은 오른쪽 목록 안에 있어,
         좁은 화면에서는 지도 아래로 한참 내려가야 보입니다. 여기서 바로
         넓힐 수 있게 단추를 둡니다. */
      var next = nextScope();
      el.innerHTML = accChip()
        + '<span class="ms-none">사고지점 주변에 표시할 대피장소가 없습니다.</span>'
        + (next
            ? '<button type="button" class="ms-more noprint">반경 '
              + fmtDist(+next) + " 안에서 찾기</button>"
            : '<span class="ms-none">가장 넓은 범위(20km)에도 등록된 대피장소가 없습니다.</span>');
      var wide = $(".ms-more", el);
      if (wide) wide.onclick = function () { setScope(next); };
    }
    return;
  }
  el.hidden = false;

  var sorted = st.all.slice().sort(function (a, b) { return a.d - b.d; });
  var near = sorted[0];
  var parts = [];
  parts.push(accChip());
  parts.push('<span class="ms-near"><b>가장 가까운 곳</b>' + esc(near.name)
    + '<em>' + fmtDist(near.d) + " " + dirName(near.b) + "쪽 · "
    + MC.tripPair(near.d).label + "</em></span>");

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
    var more = allRows().filter(function (s) {
      return !have[s.key] && distM(st.acc.lat, st.acc.lon, s.lat, s.lon) <= 5000;
    }).length;
    if (more)
      parts.push('<button type="button" class="ms-more noprint">반경 5km 안 다른 시·군·구에 '
        + more + "곳 더 있습니다 · 범위 넓히기</button>");
  }

  el.innerHTML = parts.join("");
  var b = $(".ms-more", el);
  if (b) b.onclick = function () { setScope("5000"); };
}

/* ── 가까운 3곳 ───────────────────────────────────────────────
   오른쪽에 전체 목록이 있는데도 지도 위에 세 줄을 따로 띄우는 이유는,
   급할 때 필요한 것이 "훑어볼 목록"이 아니라 "그래서 어디로 보내면 되는가"
   이기 때문입니다. 지도에서 눈을 떼지 않고 읽고, 눌러서 바로 경로선까지
   보게 합니다.

   여기 숫자는 검색어(st.q)와 무관하게 항상 실제 최근접 3곳입니다 —
   목록을 걸러 놓은 상태에서 "가장 가까운 곳"이 달라져 보이면, 그게 곧
   잘못된 대피 안내가 됩니다. */
function renderNear() {
  var el = $("#mNear");
  if (!st.acc || !st.all.length) { el.hidden = true; return; }
  var top = st.all.slice().sort(function (a, b) { return a.d - b.d; }).slice(0, 3);
  el.hidden = false;
  el.classList.toggle("folded", st.nearFold);

  /* 머리표는 접기·펴기 단추 자체입니다 — 닫아 놓고 되돌릴 방법이 없으면 안 됩니다 */
  var head = '<button type="button" class="mnear-h" id="mNearH" aria-expanded="'
    + (st.nearFold ? "false" : "true") + '">'
    + '<b>가까운 대피장소</b> ' + top.length + "곳"
    + '<svg class="mnear-c" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M6 9l6 6 6-6"/></svg></button>';

  if (st.nearFold) {
    el.innerHTML = head;
    $("#mNearH").onclick = function () { st.nearFold = false; renderNear(); };
    return;
  }

  el.innerHTML = head
    + top.map(function (s, n) {
        var t = MC.tripPair(s.d);
        var i = st.show.indexOf(s);                 // 목록에서 걸러졌으면 -1
        return '<button type="button" class="mnear-it' + (i >= 0 && i === st.sel ? " on" : "")
          + '" data-k="' + esc(s.key) + '">'
          + '<span class="mnear-r"><i class="mnear-n">' + (n + 1) + "</i>"
          + "<b>" + esc(s.name) + '</b><span class="mnear-d">' + fmtDist(s.d) + "</span></span>"
          + '<span class="mnear-t"><em>' + t.label + "</em> · " + dirName(s.b) + "쪽"
          + (s.cap ? " · 수용 " + Number(s.cap).toLocaleString() + "명" : "") + "</span>"
          + "</button>";
      }).join("")
    + '<p class="mnear-note">직선거리를 도로 사정에 맞춰 늘려 잡은 어림값입니다. '
    + "실제 소요시간은 지형·통제 상황에 따라 달라집니다.</p>";

  $("#mNearH").onclick = function () { st.nearFold = true; renderNear(); };
  $$(".mnear-it", el).forEach(function (b) {
    b.onclick = function () {
      /* 검색어 때문에 목록에서 빠져 있으면 먼저 검색을 비운다 —
         눌렀는데 아무 일도 안 일어나는 것처럼 보이면 안 된다. */
      var find = function () {
        return st.show.map(function (s) { return s.key; }).indexOf(b.dataset.k);
      };
      if (find() < 0) { st.q = ""; $("#mQ").value = ""; recompute(); renderList(); }
      var i = find();
      if (i >= 0) select(i, false);
    };
  });
}

/* 어디 소속인지 보이게 시·군·구를 앞에 붙인다 — 반경으로 찾으면 여러 시·군·구가
   섞이기 때문이다. 원자료의 주소는 시·군·구가 빠진 것이 원칙이지만 들어 있는
   행도 있어, 이미 있으면 덧붙이지 않는다("남구 광주 남구 …" 방지). */
function placeOf(s) {
  var addr = String(s.addr || "");
  return addr.indexOf(s.sgg) >= 0 ? addr : (s.sgg + " " + addr).trim();
}

/* 한 곳의 이동시간 한 줄. 실제 도로 경로를 받아 온 곳만 그 값을 쓰고,
   나머지는 직선 어림값입니다. 둘을 눈으로 구분할 수 있어야 하므로 실제
   경로에는 표시를 붙입니다 — 어림값을 확정된 값으로 오해하면 안 됩니다. */
function tripLine(s) {
  var rt = st.route && st.route.key === s.key ? st.route : null;
  if (rt) return '<em>' + MC.tripPair(rt.dist, true).label + "</em>"
    + ' <span class="l6-tag">실제 도로 ' + fmtDist(rt.dist) + "</span>";
  var t = MC.tripPair(s.d);
  return "<em>" + t.label + "</em>"
    + (!t.walk ? " · 걸어서 가기 어려운 거리" : " · 직선거리로 어림한 값");
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

  /* 두 자료가 섞여 있을 때만 줄마다 어느 쪽인지 답니다. 한 종류만 보고 있으면
     위 딱지에 이미 적혀 있어, 모든 줄에 같은 말을 붙이면 읽을 것만 늘어납니다. */
  var kinds = {};
  st.show.forEach(function (s) { kinds[s.src] = true; });
  var mixed = kinds.chem && kinds.temp;

  $("#shList").innerHTML = st.show.map(function (s, i) {
    var on = i === st.sel;
    var bar = acc && maxD
      ? '<div class="ms-bar"><i style="width:' + Math.max(2, Math.round(s.d / maxD * 100)) + '%"></i></div>'
      : "";
    return '<div class="ms-it' + (on ? " on" : "") + (s.inRing ? " ring" : "")
      + '" data-i="' + i + '" role="button" tabindex="0" aria-pressed="' + (on ? "true" : "false") + '">'
      + '<div class="l1"><b>' + esc(s.name) + "</b>"
      + (mixed ? '<span class="ms-kd ' + s.src + '">' + SRC_SHORT[s.src] + "</span>" : "")
      + (s.detail ? '<span class="dt">' + esc(s.detail) + "</span>" : "")
      + (acc ? '<span class="d">' + fmtDist(s.d) + " " + dirName(s.b) + "</span>" : "")
      + "</div>" + bar
      + (acc ? '<div class="l6">' + tripLine(s) + "</div>" : "")
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

/* ── 도보 경로 ────────────────────────────────────────────────
   직선은 "어느 쪽으로 얼마나"는 알려 주지만 걸어서 갈 수 있는 길인지는
   알려 주지 못합니다. 강·철길·고속도로가 사이에 있으면 직선으로는 가까워도
   한참 돌아가야 합니다. 고른 곳 하나에 대해서만 실제 경로를 받아옵니다.

   못 받아 오면 지금까지처럼 직선을 그립니다 — 경로가 없다고 아무것도 안
   그리면 화면이 더 나빠집니다. 목록과 '가까운 3곳'은 직선 어림값 그대로
   둡니다. 고를 때마다 세 건씩 더 부르면 느려지고, 급할 때 필요한 것은
   목록의 정밀도가 아니라 지금 고른 한 곳의 실제 길입니다. */
var routeAbort = null, routeSeq = 0;
function requestRoute() {
  if (routeAbort) { routeAbort(); routeAbort = null; }
  routeSeq++;
  st.route = null; st.routeErr = null; st.routeBusy = false;

  var s = st.sel >= 0 ? st.show[st.sel] : null;
  if (!s || !st.acc || !st.walk || !window.ONLINE) return;

  var seq = routeSeq;
  st.routeBusy = true;
  routeAbort = ONLINE.route(st.acc, { lat: s.lat, lon: s.lon }, function (r, err) {
    if (seq !== routeSeq) return;               // 그새 다른 곳을 골랐다
    routeAbort = null;
    st.routeBusy = false;
    st.route = r ? { key: s.key, path: r.path, dist: r.dist } : null;
    st.routeErr = err;
    draw(); showAddr(); renderList();
  });
}

function select(i, fromMap) {
  st.sel = (st.sel === i ? -1 : i);
  requestRoute();
  renderList(); renderNear(); renderToSms(); draw(); showAddr();
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
    + (s.d != null ? "<em>사고지점에서 " + fmtDist(s.d) + " " + dirName(s.b) + "쪽</em>" : "")
    + (st.route && st.route.key === s.key
        ? "<em>도로 " + fmtDist(st.route.dist) + " · "
          + MC.tripPair(st.route.dist, true).label + "</em>"
        : (st.routeBusy && st.sel >= 0 && st.show[st.sel] === s ? "<em>길 찾는 중…</em>" : ""));
}

function renderLegend() {
  var it = [];
  var has = { chem: false, temp: false };
  st.show.forEach(function (s) { has[s.src] = true; });
  if (has.chem || !has.temp) it.push('<span><i class="dot sh"></i>화학사고 대피장소</span>');
  if (has.temp) it.push('<span><i class="dot tmp"></i>이재민 임시주거시설</span>');
  if (st.acc) it.push('<span><i class="dot ac"></i>사고지점</span>');
  if (st.me) it.push('<span><i class="dot me"></i>내 위치</span>');
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
  syncSort(); renderSrcBar();
  renderSummary(); renderNear(); renderList(); renderLegend(); renderToSms();
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
  /* 단추 위 이름표가 이미 "사고지점"이라고 말하므로 단추에서는 뺍니다 —
     좁은 조건 줄에서 같은 말이 두 번 들어가면 다른 조건을 밀어냅니다. */
  b.textContent = m === "acc" ? "지도를 누르세요" : (st.acc ? "다시 찍기" : "지도에서 찍기");
  SVG.classList.toggle("crosshair", m === "acc");
}

/* 사고지점을 찍는 곳은 네 군데다 — 지도 누르기, 위경도 입력, 주소 검색,
   내 위치. 예전에는 범위(반경)를 잡아 주는 코드가 주소 검색과 내 위치에만
   있어서, 지도를 눌러 찍으면 지역도 범위도 정해지지 않은 채로 남아 목록이
   빈 채로 나왔다. 찍는 방법에 따라 결과가 달라지면 안 되므로, 범위 기본값을
   여기 한 곳에서 잡는다.

   반경 5km 로 잡는 이유: 사고지점을 찍었다는 것은 "여기 주변을 보겠다"는
   뜻이고, 시·군 경계 근처 사고에서는 옆 시·군 대피장소가 관내보다 가깝다.
   이미 지역이나 범위를 골라 둔 사용자의 선택은 건드리지 않는다. */
function setAcc(lat, lon, jump) {
  st.acc = { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 };
  $("#acLat").value = st.acc.lat;
  $("#acLon").value = st.acc.lon;

  var wide = !st.scope && !st.sido && !st.sgg;
  if (wide) st.scope = "5000";

  if (st.sort === "name") { st.sort = "dist"; $("#mSort").value = "dist"; }
  setMode("pick");
  recompute();
  syncSort();                      // 범위 칸이 여기서 열린다 (사고지점이 있어야 열림)
  if (wide) $("#mScope").value = "5000";
  lookupAccAddr();                 // 여기가 어느 시·군·구 어느 읍·면·동인가
  renderSrcBar();                  // 범위가 바뀌었으니 자료별 개수도 다시 센다
  renderSummary(); renderNear(); renderList(); renderLegend(); renderToSms(); showAddr();
  moveToAcc(!!jump);
}

/* ── 사고지점의 주소 ──────────────────────────────────────────
   주민대피 문자에는 "○○시 ○○동 ○○에서 발생한" 처럼 시·군·구와 읍·면·동이
   들어갑니다. 좌표만으로는 그 칸을 채울 수 없어 담당자가 따로 찾아 넣어야
   했는데, 지도가 이미 아는 것을 다시 찾게 하는 셈이었습니다.

   두 단계로 채웁니다.
     1) 인터넷 없이  — 그리고 있는 행정경계로 시·군·구를 가리고(MC.sggAt),
        읍·면·동은 2km 안에 대피장소가 있으면 그 주소에서 뽑습니다.
     2) 인터넷이 되면 — 브이월드 주소로 덮어씁니다. 이쪽이 정확합니다.
   어느 쪽으로 알아냈는지 화면에 표시해, 어림값을 확정값으로 오해하지 않게
   합니다. 못 알아내면 그 칸은 넘기지 않습니다 — 틀린 값보다 빈 칸이 낫습니다. */
var ACC_EMD_MAX = 2000;            // 이보다 먼 대피장소의 읍·면·동은 쓰지 않는다
var accSeq = 0;

/* "개령면 감문로 277(신룡리)" → "개령면" / "시청1길 1(신음동)" → "신음동" */
function emdOf(addr) {
  var s = String(addr || "");
  var m = /(^|[\s(])([가-힣0-9]+(?:읍|면|동))(?=[\s)]|$)/.exec(s);
  return m ? m[2] : "";
}

function lookupAccAddr() {
  st.accAddr = null;
  accSeq++;
  if (!st.acc) return;

  /* 1) 인터넷 없이 — 어림값 */
  var here = MC.sggAt(st.acc.lat, st.acc.lon);
  /* 읍·면·동은 가까운 시설의 주소에서 뽑습니다. 켜고 끈 것과 무관하게 두 자료를
     모두 봅니다 — 여기서 필요한 것은 '주소가 적힌 가장 가까운 지점'이지
     '지금 지도에 켜 둔 것'이 아니기 때문입니다. */
  var pool = MC.shelters("", "");
  if (MC.hasTemp()) pool = pool.concat(MC.tempShelters("", ""));
  var near = pool.map(function (s) {
    return { s: s, d: distM(st.acc.lat, st.acc.lon, s.lat, s.lon) };
  }).sort(function (a, b) { return a.d - b.d; })[0];
  var emd = near && near.d <= ACC_EMD_MAX ? emdOf(near.s.addr) : "";
  if (here || emd) {
    st.accAddr = { sido: here ? here.sido : "", sgg: here ? here.sgg : "",
                   emd: emd, road: "", no: "", exact: false };
  }

  /* 2) 인터넷이 되면 — 정확한 값으로 덮어쓴다 */
  if (!window.ONLINE || !ONLINE.revgeo) return;
  var seq = accSeq;
  ONLINE.revgeo(st.acc.lat, st.acc.lon, function (a) {
    if (seq !== accSeq || !a) return;      // 그새 다른 곳을 찍었다
    st.accAddr = { sido: a.sido, sgg: a.sgg, emd: a.emd,
                   road: a.road, no: a.no, exact: true };
    renderSummary(); renderToSms();
  });
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
/* 시·군·구 경계의 가운데 — 공용(assets/mapcore.js). ①③ 도 같은 값을 씁니다. */
var boundaryCenter = MC.boundaryCenter;
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
var KIND_LABEL = { sgg: "시·군·구", dong: "읍·면·동", place: "대피장소",
                   poi: "장소", addr: "주소" };
var addrRows = [], addrSel = -1;

/* ── 인터넷 장소 검색 ────────────────────────────────────────
   도구 안에 든 자료로만 찾으면 "여수시청"이나 "○○화학 여수공장" 같은
   이름은 나오지 않습니다. 사고는 등록된 대피장소가 아니라 그런 곳에서
   납니다. 그래서 브이월드 검색을 함께 겁니다(assets/online.js).

   도구 안 결과를 먼저 즉시 보여 주고, 인터넷 결과는 도착하는 대로 아래에
   덧붙입니다 — 응답을 기다리느라 아무것도 안 보이는 시간이 없게 합니다.
   인터넷이 안 되면 지금까지처럼 도구 안 결과만 나옵니다. */
var addrQ = "";
var addrOn = { q: "", rows: [], busy: false, err: null };
var addrTimer = null, addrSeq = 0;

function askOnline(q) {
  var t = String(q || "").trim();
  clearTimeout(addrTimer);
  addrSeq++;
  /* 한 글자로 부르면 결과가 너무 많고 요청만 늘어난다 */
  if (!window.ONLINE || t.length < 2) {
    addrOn = { q: t, rows: [], busy: false, err: null };
    return;
  }
  addrOn = { q: t, rows: [], busy: true, err: null };
  var seq = addrSeq;
  addrTimer = setTimeout(function () {          // 치는 도중에 매번 부르지 않는다
    ONLINE.search(t, function (rows, err) {
      if (seq !== addrSeq) return;              // 그새 더 쳤다 — 늦게 온 응답은 버린다
      addrOn = { q: t, rows: rows || [], busy: false, err: err };
      if (!$("#addrPop").hidden) drawAddrPop();
    });
  }, 350);
}

function renderAddrPop(q) {
  addrQ = q;
  askOnline(q);
  drawAddrPop();
}

function drawAddrPop() {
  var pop = $("#addrPop");
  var t = addrQ.trim();
  var mine = searchPlaces(addrQ);
  var net = addrOn.q === t ? addrOn.rows : [];
  var busy = addrOn.q === t && addrOn.busy;
  addrRows = mine.concat(net);
  addrSel = -1;

  var row = function (p, i) {
    return '<div class="mpk-row" role="option" data-i="' + i + '">'
      + '<span class="nm">' + esc(p.label)
      + (p.sub ? ' <i class="sub">' + esc(p.sub) + "</i>" : "") + "</span>"
      + '<span class="en">' + esc(KIND_LABEL[p.kind] || "") + "</span></div>";
  };

  if (!addrRows.length && !busy) {
    pop.innerHTML = t
      ? '<div class="mpk-none">‘' + esc(addrQ) + "’ 과 맞는 곳이 없습니다.<br>"
        + "사업장·건물 이름이나 도로명 주소로도 찾을 수 있습니다.</div>"
      : '<div class="mpk-none">사업장·건물 이름, 도로명 주소, 시군구·읍면동으로 찾습니다.<br>'
        + "예) 여수시청 · 산단로 79 · 강릉시 옥계면</div>";
  } else {
    var body = '<div class="mpk-list" id="addrList">' + addrRows.map(row).join("");
    if (busy) body += '<div class="mpk-busy">인터넷에서 찾는 중…</div>';
    else if (addrOn.q === t && addrOn.err && !net.length)
      body += '<div class="mpk-busy off">인터넷 검색을 쓸 수 없습니다 ('
        + esc(addrOn.err) + ") · 등록된 자료에서만 찾았습니다</div>";
    pop.innerHTML = body + "</div>"
      + '<div class="mpk-ft">'
      + (net.length ? "장소·주소를 고르면 그 자리를 사고지점으로 찍습니다"
                    : "고르면 그 언저리로 이동합니다 · 정확한 사고지점은 지도를 눌러 찍으세요")
      + "</div>";
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

  /* 인터넷에서 찾은 사업장·주소는 좌표가 그 건물의 것이라 정확합니다.
     한 번 더 지도를 누르게 할 이유가 없으므로 바로 사고지점으로 찍습니다.
     (도구 안에서 찾은 시군구·읍면동은 평균 좌표라 그렇게 하지 않습니다.) */
  if (p.exact) {
    pickedPlace = { label: p.label, sub: p.sub || "" };   // 문자로 넘길 장소명
    setAcc(p.lat, p.lon, true);          // 범위 기본값은 setAcc 이 잡는다
    toast("<b>‘" + esc(p.label) + "’ 을(를) 사고지점으로 찍었습니다.</b> "
      + "자리가 다르면 지도를 눌러 다시 찍으면 됩니다.");
    return;
  }

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
  st.acc = null; st.scope = ""; st.accAddr = null; accSeq++;
  pickedPlace = null;
  $("#acLat").value = ""; $("#acLon").value = ""; $("#mScope").value = "";
  st.sort = "name"; $("#mSort").value = "name";
  setMode("pick");
  refresh(true);
}

/* ══ 문자 작성으로 넘기기 ════════════════════════════════════
   지도에서 사고지점을 찍고 대피장소를 확인한 뒤, 그 내용을 다시 손으로
   옮겨 적지 않고 그대로 문자 작성 화면에서 이어 쓰게 합니다.

   ── 무엇을 넘기는가 ──────────────────────────────────────
   문안이 요구하는 칸을 지도가 아는 만큼 채웁니다. 다만 어림으로 지어내지는
   않습니다 — 모르면 빈 칸으로 두는 편이 틀린 값을 발송하는 것보다 낫습니다.

     시군    사고지점의 시·군·구 (사고지점 주소 → 행정경계 → 가까운 대피장소 순).
     읍면동  사고지점의 읍·면·동 (브이월드 주소, 없으면 2km 안 대피장소 주소).
     사업장  검색으로 찍었으면 그 장소 이름. 지도를 눌러 찍었으면 사고지점의
             도로명 주소(예: "시청1길 1") — 이름을 모를 때 그 자리를 가리키는
             가장 정확한 말이기 때문입니다.
     대피소  고른 곳이 있으면 그것, 없으면 가장 가까운 곳.

   대상지역(문자를 받을 지역)은 넘기지 않습니다 — 사고 위치가 아니라
   "어디까지 보낼 것인가"라는 판단이고, 그 판단은 도구가 하지 않습니다.
   ═══════════════════════════════════════════════════════════ */
var SMS_SEED = "nics.sms.seed.v1";

/* 사고지점이 검색으로 찍혔을 때 그 장소 이름·주소를 기억해 둔다 */
var pickedPlace = null;

function seedFromMap() {
  if (!st.acc) return null;
  var near = st.all.slice().sort(function (a, b) { return a.d - b.d; })[0] || null;
  var sel = st.sel >= 0 ? st.show[st.sel] : null;
  var a = st.accAddr;
  var data = {};

  /* 시·군·구 — 사고지점 자체의 값이 가장 정확하다. 없으면 지금까지처럼
     가까운 대피장소의 시·군·구(반경 안이므로 같은 시·군·구일 때가 많다). */
  if (a && a.sgg) data["시군"] = a.sgg;
  else if (sel || near) data["시군"] = (sel || near).sgg;
  else if (st.sgg) data["시군"] = st.sgg;

  if (a && a.emd) data["읍면동"] = a.emd;

  if (pickedPlace) {
    data["사업장"] = pickedPlace.label;
    /* 검색 결과 주소에 읍·면·동이 있으면, 주소를 못 받아 왔을 때 대신 쓴다 */
    if (!data["읍면동"]) {
      var m = emdOf(pickedPlace.sub);
      if (m) data["읍면동"] = m;
    }
  } else if (a && a.road) {
    /* 지도를 눌러 찍었으면 장소 이름을 알 수 없다. 도로명 주소가 그 자리를
       가리키는 가장 정확한 말이므로 그것을 넣는다("○○길 12에서 발생한"). */
    data["사업장"] = (a.road + " " + (a.no || "")).trim();
  }

  var shelter = sel || near;
  if (shelter) data["대피소"] = shelter.name;

  return { v: 1, from: "map", ts: Date.now(),
           acc: { lat: st.acc.lat, lon: st.acc.lon },
           /* 어림값으로 채운 것인지 알려 준다 — 문자 화면에서 표시한다 */
           어림: !!(a && !a.exact), data: data };
}

/* 넘길 것이 있을 때만 단추를 보이고, 무엇이 넘어가는지 미리 알려 준다 —
   눌러 보고 나서야 무엇이 채워졌는지 알게 하면 안 된다. */
function renderToSms() {
  var b = $("#btnToSms");
  if (!b) return;
  var seed = seedFromMap();
  b.hidden = !seed;
  if (!seed) return;
  var keys = Object.keys(seed.data);
  $("#toSmsTxt").textContent = keys.length
    ? "이 내용으로 문자 만들기 (" + keys.join("·") + ")"
    : "주민대피 문자 만들기";
}

function goToSms() {
  var seed = seedFromMap();
  if (!seed) return;
  try { sessionStorage.setItem(SMS_SEED, JSON.stringify(seed)); } catch (e) {}
  location.href = "../sms/index.html";
}

/* ── 내 위치 ──────────────────────────────────────────────────
   현장에 나가 휴대전화로 이 화면을 열었을 때, 위도·경도를 손으로 넣지
   않고도 바로 주변 대피장소를 볼 수 있게 하려는 것입니다. 브라우저에
   들어 있는 기능이라 인터넷이 끊긴 곳에서도 됩니다.

   사고지점이 아직 없으면 내 위치를 사고지점으로도 찍습니다 — 현장에서
   여는 경우가 그렇기 때문입니다. 이미 사고지점이 찍혀 있으면 건드리지
   않고 파란 점만 더합니다. 사무실에서 눌렀다고 사고지점이 사무실로
   옮겨가면 안 되기 때문입니다. */
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
      pickedPlace = null;                         // 내 위치는 장소 이름이 아니다
      setAcc(r.lat, r.lon, true);                 // 현장에서 연 경우 — 바로 기준점이 된다
      toast("<b>내 위치를 사고지점으로 찍었습니다.</b> 오차 약 ±" + fmtDist(r.acc)
        + (rough ? " — 실내라 넓게 잡혔습니다. 지도를 눌러 정확한 자리로 고쳐 주세요." : "")
        + " 자리가 다르면 지도를 눌러 다시 찍으면 됩니다.", rough);
    } else {
      var d = distM(st.acc.lat, st.acc.lon, r.lat, r.lon);
      toast("<b>내 위치를 표시했습니다.</b> 사고지점에서 " + fmtDist(d) + " · "
        + MC.trip(d).label + " 거리입니다. 사고지점은 그대로 두었습니다.");
      moveToMe();
    }
    renderLegend(); draw();
  });
}

/* 내 위치가 화면 밖이면 보이게 당긴다 */
function moveToMe() {
  if (!st.me) return;
  var w = mToWorld(Math.max(st.me.acc * 6, 900), st.me.lat);
  if (!st.view) { st.view = { cx: wx(st.me.lon), cy: wy(st.me.lat), w: w }; draw(); return; }
  CAM.animateTo({ cx: wx(st.me.lon), cy: wy(st.me.lat), w: Math.min(w, st.view.w) }, 420);
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
/* ＋/－ 단추는 항상 화면 가운데를 기준으로 확대·축소하며, 얼마나 당겨지는지
   보이도록 부드럽게 움직인다 */
function zoomBtn(f) {
  var nw = Math.max(0.0000015, Math.min(1.2, st.view.w * f));
  CAM.animateTo({ cx: st.view.cx, cy: st.view.cy, w: nw }, 260);
}

/* 끌기·손가락 확대·휠은 세 지도가 같아야 하므로 assets/mapcore.js 에 있다.
   여기서는 "눌렀을 때 무엇을 고르는가"만 정한다. */
function bindMap() {
  MC.panzoom(SVG, {
    view: function () { return st.view; },
    vb: function () { return VB; },
    draw: draw,
    camStop: CAM.stop,
    onTap: function (x, y) {
      if (st.mode === "acc") {
        var ll = toLL(x, y);
        pickedPlace = null;                  // 손으로 찍었으면 장소 이름을 알 수 없다
        setAcc(ll.lat, ll.lon);              // 찍은 자리가 유지되도록 시야는 그대로
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
/* 두 자료의 지역 이름을 합쳐 고를 목록을 만든다 — 한쪽에만 있는 시·군·구도
   고를 수 있어야 한다(예: 화학사고 대피장소가 없는 군에도 임시주거시설은 있다). */
function regionKeys(sido) {
  var out = {};
  [window.SHELTERS || {}, window.TEMPSHELTERS || {}].forEach(function (S) {
    if (sido == null) Object.keys(S).forEach(function (k) { out[k] = 1; });
    else Object.keys(S[sido] || {}).forEach(function (k) { out[k] = 1; });
  });
  return Object.keys(out).sort();
}

function initSelects() {
  var sido = $("#mSido"), sgg = $("#mSgg");
  sido.innerHTML = '<option value="">선택</option>'
    + regionKeys(null).map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  var fillSgg = function () {
    var ks = sido.value ? regionKeys(sido.value) : [];
    sgg.innerHTML = '<option value="">' + (sido.value ? "시·도 전체" : "시·도 먼저") + "</option>"
      + ks.map(function (s) {
          /* 세종은 원자료의 시·군·구 칸이 비어 있어 열쇠가 "null" 입니다.
             값은 그대로 두고(자료를 찾는 열쇠) 보이는 이름만 바꿉니다. */
          return '<option value="' + esc(s) + '">'
            + esc(s === "null" ? "시 전체" : s) + "</option>";
        }).join("");
  };
  fillSgg();
  sido.onchange = function () {
    st.sido = sido.value; st.sgg = ""; fillSgg(); refresh(true);
  };
  sgg.onchange = function () { st.sgg = sgg.value; refresh(true); };
}

function initSrcModal() {
  /* 두 대피처는 지정한 목적도 관리하는 곳도 다릅니다. 어느 쪽을 보고 있는지
     헷갈리면 안 되므로 출처 창에서 그 차이를 분명히 적습니다. */
  var tm = window.TEMPSHELTER_META;
  var tempP = MC.hasTemp()
    ? "<p><b>이재민 임시주거시설</b> — "
      + esc((tm && tm.출처) || "행정안전부 이재민임시주거시설정보")
      + (tm && tm.받은날 ? " · 받은 날 " + esc(tm.받은날) : "")
      + (tm && tm.총건수 ? " (" + Number(tm.총건수).toLocaleString() + "곳 · 좌표 있는 것만)" : "")
      + ". 화학사고 대비로 지정한 곳이 아니라, 재난 때 이재민을 수용하려고 "
      + "시·군·구가 지정해 둔 곳입니다. <b>화학사고 대피장소와 별개의 자료</b>이며, "
      + "화학물질 방호 성능을 따져 고른 곳이 아닙니다.</p>"
    : "";
  $("#ver").innerHTML =
    "<p><b>화학사고 대피장소</b> — " + esc(VERSION.대피장소_출처) + " · 기준일 "
      + esc(VERSION.대피장소_기준일) + " ("
      + SHELTER_META.총건수.toLocaleString() + "곳 · 좌표 포함)</p>"
    + tempP
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
  MC.foldBar();            // 좁은 화면에서 조건 줄 접기
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
    st.q = this.value; recompute(); renderList(); renderNear(); draw();
  };
  $("#mSort").onchange = function () {
    st.sort = this.value; recompute(); renderList(); renderNear(); draw();
  };
  $("#mMat").oninput = function () { st.mat = this.value.trim(); renderRad(); };
  bindWind();
  bindAddrSearch();
  $("#cRings").onchange = function () { st.rings = this.checked; renderLegend(); draw(); };
  var walk = $("#cWalk");
  if (walk) walk.onchange = function () {
    st.walk = this.checked;
    requestRoute();                    // 켜면 지금 고른 곳 경로를 바로 받아온다
    renderLegend(); draw(); showAddr(); renderList();
  };

  $("#btnAcc").onclick = function () { setMode(st.mode === "acc" ? "pick" : "acc"); };
  $("#btnAccClear").onclick = clearAcc;
  $("#btnMe").onclick = locateMe;
  /* 단일 파일판(dist)에는 옆에 문자도구가 없어 이 단추를 빼고 만듭니다 */
  var toSms = $("#btnToSms");
  if (toSms) toSms.onclick = goToSms;

  var latlon = function () {
    var la = parseFloat($("#acLat").value), lo = parseFloat($("#acLon").value);
    /* 우리나라 범위 밖 값은 오타로 보고 무시한다 */
    if (isFinite(la) && isFinite(lo) && la > 32 && la < 40 && lo > 123 && lo < 133) {
      pickedPlace = null;
      setAcc(la, lo, true);
    }
  };
  $("#acLat").oninput = latlon;
  $("#acLon").oninput = latlon;

  $("#btnPrint").onclick = function () { window.print(); };
  $("#btnClear").onclick = function () {
    st.sido = ""; st.sgg = ""; st.scope = ""; st.acc = null; st.radius = null;
    st.mat = ""; st.q = ""; st.sort = "name"; st.rings = true;
    st.me = null;
    st.layers = { chem: true, temp: true };
    st.nearFold = matchMedia("(max-width: 860px)").matches;
    st.route = null; st.routeErr = null; st.routeBusy = false;
    st.accAddr = null; accSeq++;
    pickedPlace = null;
    ["mMat", "mQ", "acLat", "acLon", "mAddrQ"].forEach(function (id) { $("#" + id).value = ""; });
    $("#mSido").value = ""; $("#mSido").onchange();
    $("#mScope").value = ""; $("#mSort").value = "name";
    $("#cRings").checked = true;
    setWind("");
    renderRad();
    toast("");
    setMode("pick");
  };

  setMode("pick");
  showSrc();
  refresh(true);
}

document.addEventListener("DOMContentLoaded", init);
})();
