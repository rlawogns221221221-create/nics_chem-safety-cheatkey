/* ============================================================
   지도 공용 엔진 — 투영 · 거리 · 배경지도 타일 · 행정경계선

   ① 문자 작성 도구의 "지도에서 고르기" 창(assets/shmap.js)과
   ② 대피장소 지도(map/app.js)가 같은 코드를 씁니다.
   앞으로 만들 ③ 방제자원업체 지도도 이 파일을 그대로 씁니다.
   따로 두면 타일 대체 규칙 같은 것을 고칠 때 두 번 고쳐야 하고,
   한쪽만 고쳐지면 두 지도가 서로 다르게 동작하게 됩니다.

   ── 좌표계 ─────────────────────────────────────────────────
   웹 메르카토르(EPSG:3857)를 0~1 로 정규화한 '세계좌표'를 씁니다.
   배경지도 타일이 이 좌표계를 쓰므로 타일·경계선·마커가 정확히 겹칩니다.

   그리기는 화면 픽셀 좌표로 합니다(viewBox="0 0 폭 높이").
   세계좌표를 viewBox 에 그대로 넣으면 SVG 내부 float32(유효자리 7자리)
   때문에 확대할수록 도형이 떨리거나 사라집니다. 투영은 배정도인 이곳에서
   끝내고, SVG 에는 픽셀 값만 넘깁니다. 덕분에 선 굵기·글자 크기도
   그냥 픽셀이라 확대해도 변하지 않습니다.

   ── 시야(vb) 규약 ───────────────────────────────────────────
   {x, y, w, h}  세계좌표로 나타낸 보이는 범위
   {sw, sh}      그 범위가 그려질 화면 크기 (픽셀)
   ============================================================ */
(function () {
"use strict";

var TAU = Math.PI * 2;
var EQUATOR = 40075016.686;              // 적도 둘레 (m) = 세계좌표 1.0
var D2R = Math.PI / 180;

/* ── 투영 ─────────────────────────────────────────────────── */
function wx(lon) { return (+lon + 180) / 360; }
function wy(lat) {
  var l = Math.max(-85.05112878, Math.min(85.05112878, +lat));
  var s = Math.sin(l * D2R);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (2 * TAU);
}
function wxInv(x) { return x * 360 - 180; }
function wyInv(y) { return Math.atan(Math.sinh((0.5 - y) * TAU)) / D2R; }

/* 미터 ↔ 세계좌표 길이. 메르카토르는 등각이라 위도에 따라 축척이 달라진다. */
function mToWorld(m, lat) { return m / (EQUATOR * Math.cos(lat * D2R)); }
function worldToM(w, lat) { return w * EQUATOR * Math.cos(lat * D2R); }

/* ── 거리·방위 ────────────────────────────────────────────── */

/* 직선거리 (m) — 하버사인. 지형·도로를 고려하지 않는다. */
function distM(a, b, c, d) {
  var R = 6371000;
  var dLat = (c - a) * D2R, dLon = (d - b) * D2R;
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(a * D2R) * Math.cos(c * D2R) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
/* 방위각 (도, 북=0) */
function bearing(a, b, c, d) {
  var y = Math.sin((d - b) * D2R) * Math.cos(c * D2R);
  var x = Math.cos(a * D2R) * Math.sin(c * D2R)
        - Math.sin(a * D2R) * Math.cos(c * D2R) * Math.cos((d - b) * D2R);
  return (Math.atan2(y, x) / D2R + 360) % 360;
}
var DIRS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
function dirName(deg) { return DIRS[Math.round(deg / 45) % 8]; }

/* 급할 때 읽는 값이라 자리수를 늘리지 않는다 (1.2km 로 충분).
   딱 떨어지면 소수점을 붙이지 않는다 — "1.0km 안 3곳" 보다 "1km 안 3곳" 이 읽기 쉽다. */
function fmtDist(m) {
  if (m < 1000) return Math.round(m) + "m";
  var km = m / 1000;
  if (km >= 100) return Math.round(km) + "km";
  return (Math.round(km * 10) % 10 === 0 ? km.toFixed(0) : km.toFixed(1)) + "km";
}

/* 눈금·반경에 쓰는 '떨어지지 않는' 거리 값 */
var NICE = [10, 20, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000,
            10000, 20000, 30000, 50000, 100000, 200000];
function niceDist(target) {
  return NICE.reduce(function (a, b) {
    return Math.abs(b - target) < Math.abs(a - target) ? b : a;
  });
}

/* ══ 이동 시간 어림 ══════════════════════════════════════════
   "1.2km" 만으로는 대피 안내를 쓸 수 없습니다. 주민에게는 "걸어서 몇 분",
   방제업체에는 "차로 몇 분"이 실제로 필요한 값입니다.

   ── 왜 길찾기 서버를 쓰지 않는가 ──────────────────────────
   공개 길찾기 API(OSRM 등)로 실제 도로 경로를 받아 오는 방법이 있지만
   이 도구에는 쓰지 않았습니다.
     · 망분리된 행정망 PC에서는 어차피 실패합니다. 매번 응답을 기다렸다
       실패하는 동안 화면이 멈춘 것처럼 보입니다.
     · 사고지점 좌표를 외부(대개 해외) 서버로 보내게 됩니다. 대외 발표
       전의 화학사고 위치는 그렇게 다룰 값이 아닙니다.
     · 단일 파일 배포본이 내건 "외부 서버로 어떤 정보도 전송하지 않습니다"
       약속이 깨집니다.

   그래서 좌표만으로 계산하는 어림값을 씁니다. 대신 어림이라는 사실을
   화면에도 적어 두어, 이 숫자를 확정된 소요시간으로 오해하지 않게 합니다.

   ── 어떻게 어림하는가 ────────────────────────────────────
   실제 길은 직선보다 돌아갑니다. 직선거리를 그대로 나누면 늘 짧게 나와
   "가면 되겠네" 하고 판단을 그르칩니다. 도시부 도로망에서 실제 도로거리를
   직선거리로 나눈 값은 대체로 1.3 안팎이라, 그만큼 늘려 잡습니다.
   ═══════════════════════════════════════════════════════════ */

var DETOUR = 1.3;                  // 실제 이동거리 ÷ 직선거리
var WALK_MPM = 66.7;               // 성인 평균 도보 4km/h ≒ 66.7 m/분
var WALKABLE = 3000;               // 이 거리를 넘으면 걸어서 대피시키지 않는다 (직선 m)

/* 차량 평균속도 — 표지판 제한속도보다 느립니다(신호·좌회전 대기·정체).
   멀수록 간선도로·국도 비중이 커져 평균이 올라갑니다. */
function carMpm(m) {
  if (m <= 5000) return 417;       // 시가지 25km/h
  if (m <= 20000) return 667;      // 40km/h
  return 917;                      // 55km/h
}

function tripMin(m, mode) {
  var road = m * DETOUR;
  return Math.max(1, Math.round(road / (mode === "walk" ? WALK_MPM : carMpm(m))));
}

function fmtMin(min) {
  if (min < 60) return min + "분";
  var h = Math.floor(min / 60), r = min % 60;
  return h + "시간" + (r ? " " + r + "분" : "");
}

/* 한 마디로 읽히는 이동시간.
   mode 를 주지 않으면 걸어갈 만한 거리인지 보고 스스로 고릅니다 —
   4km 떨어진 대피장소에 "도보 78분"이라고 적어 봐야 쓸 데가 없고,
   200m 앞 방제업체에 "차로 1분"도 마찬가지입니다. */
function trip(m, mode) {
  var use = mode === "walk" || mode === "car" ? mode : (m <= WALKABLE ? "walk" : "car");
  var min = tripMin(m, use);
  return { mode: use, min: min, walkable: m <= WALKABLE,
           label: (use === "walk" ? "도보 " : "차로 ") + fmtMin(min) };
}

/* ══ 내 위치 ════════════════════════════════════════════════
   브라우저에 들어 있는 기능이라 인터넷이 끊긴 곳에서도 동작합니다
   (위성·기지국·와이파이로 단말이 직접 계산합니다). 단일 파일 배포본을
   현장에서 휴대전화로 열어도 그대로 됩니다.

   실패했을 때 "위치를 가져올 수 없습니다" 한 줄만 띄우면 사용자는 무엇을
   해야 할지 알 수 없으므로, 원인별로 다음에 할 일까지 적어 돌려줍니다.
   ═══════════════════════════════════════════════════════════ */

var GEOMSG = {
  1: "위치 권한이 거부되어 있습니다. 주소창 왼쪽 자물쇠(또는 ⓘ)를 눌러 "
   + "위치 권한을 ‘허용’으로 바꾼 뒤 다시 눌러 주세요.",
  2: "지금 위치를 확인하지 못했습니다. 건물 안쪽이나 지하에서는 신호가 "
   + "닿지 않을 수 있습니다. 창가나 실외에서 다시 시도해 보세요.",
  3: "위치를 찾는 데 너무 오래 걸립니다. 하늘이 보이는 곳에서 다시 눌러 주세요."
};

function locate(done) {
  if (!navigator.geolocation)
    return done({ err: "이 브라우저는 위치 찾기를 지원하지 않습니다." });
  /* http:// 로 올린 페이지에서는 브라우저가 위치를 막습니다.
     file:// 로 연 단일 파일과 https:// 는 허용됩니다. */
  if (!window.isSecureContext && location.protocol !== "file:")
    return done({ err: "http:// 주소에서는 브라우저가 위치 사용을 막습니다. "
                     + "https:// 주소로 열거나, 내려받은 파일을 직접 열어 주세요." });
  navigator.geolocation.getCurrentPosition(
    function (p) {
      done({ lat: p.coords.latitude, lon: p.coords.longitude,
             acc: Math.round(p.coords.accuracy || 0) });
    },
    function (e) { done({ err: GEOMSG[e.code] || "위치를 찾지 못했습니다." }); },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
}

/* ── 축척 막대 ────────────────────────────────────────────── */
/* 화면 가로의 1/4 에 가까운 '떨어지는' 거리를 고른다 */
function scale(vb) {
  var latC = wyInv(vb.y + vb.h / 2);
  var full = distM(latC, wxInv(vb.x), latC, wxInv(vb.x + vb.w));
  var pick = niceDist(full / 4);
  return { m: pick, px: Math.max(22, Math.round(pick / full * vb.sw)),
           label: pick >= 1000 ? (pick / 1000) + "km" : pick + "m" };
}

/* ══ 배경지도 타일 ═══════════════════════════════════════════
   타일을 미리 확인하지 않고 바로 그립니다. 확인 단계를 두면 배경이 뜰 수
   있는데도 그 시간만큼 빈 지도가 보이기 때문입니다.

   타일 한 장씩 <img> 로 받아 두고, 받아진 것만 화면에 얹습니다.
   한 원본에서 연달아 실패하면 그 원본은 쓸 수 없다고 보고 대체순서의
   다음 원본으로 자동 전환합니다 → 배경 없는 지도가 남지 않습니다.
   ═══════════════════════════════════════════════════════════ */

var TILE = {};        // 타일 주소 → "ok" | "bad" | "…"
var SRCSTAT = {};     // 원본 id → {ok, bad}
var DEAD = {};        // 못 쓰는 것으로 판정된 원본 id
var CUR = null;       // 사용자가 고른 원본 id
var timer = null, listeners = [];

function cfg() { return window.BASEMAP || {}; }
function sources() { return cfg().배경 || []; }
function srcById(id) {
  return sources().filter(function (s) { return s.id === id; })[0] || null;
}
function usable(s) {
  if (!s || DEAD[s.id]) return false;
  if (s.키필요 && !String(cfg().인증키 || "").trim()) return false;
  return true;
}
/* 지금 쓸 배경 원본 — 고른 것이 못 쓰게 됐으면 대체순서에서 찾는다 */
function curSrc() {
  if (!cfg().사용) return null;
  var s = srcById(CUR);
  if (usable(s)) return s;
  var order = (cfg().대체순서 || []).concat(sources().map(function (x) { return x.id; }));
  for (var i = 0; i < order.length; i++) {
    var c = srcById(order[i]);
    if (usable(c)) { CUR = c.id; return c; }
  }
  return null;
}

function tileUrl(tpl, z, x, y) {
  return String(tpl)
    .replace("{키}", encodeURIComponent(cfg().인증키 || ""))
    .replace("{z}", z).replace("{x}", x).replace("{y}", y);
}

/* 타일 상태가 바뀌면 화면을 다시 그리라고 알린다.
   여러 장이 한꺼번에 도착하므로 조금 모았다가 한 번만 알린다. */
function notify() {
  if (timer) return;
  timer = setTimeout(function () {
    timer = null;
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }, 70);
}

/* 한 원본에서 성공은 없고 실패만 쌓이면 그 원본은 포기한다.
   문턱을 4장으로 둔 이유: 화면 가장자리 타일 한두 장이 없는 경우
   (확대 한계·바다 영역)를 서버 장애로 오판하지 않기 위한 것입니다. */
function tally(sid, res) {
  var s = SRCSTAT[sid] = SRCSTAT[sid] || { ok: 0, bad: 0 };
  s[res === "ok" ? "ok" : "bad"]++;
  if (res !== "ok" && s.ok === 0 && s.bad >= 4 && !DEAD[sid]) {
    DEAD[sid] = true;
    if (CUR === sid) CUR = null;            // curSrc() 가 다음 원본을 찾는다
  }
  notify();
}

function loadTile(url, sid) {
  var s = TILE[url];
  if (s) return s;
  TILE[url] = "…";
  var im = new Image();
  im.onload = function () {
    TILE[url] = im.naturalWidth > 1 ? "ok" : "bad";
    tally(sid, TILE[url]);
  };
  im.onerror = function () { TILE[url] = "bad"; tally(sid, "bad"); };
  im.src = url;
  return "…";
}

/* 지금 시야에 필요한 타일을 화면 픽셀 좌표의 <image> 로 돌려준다.
   아직 안 받아진 타일은 넣지 않는다 — 받아지면 notify() 로 다시 그린다. */
function tileLayer(vb) {
  var src = curSrc();
  if (!src) return "";
  var z = Math.round(Math.log(vb.sw / vb.w / 256) / Math.LN2);
  z = Math.max(cfg().최소확대 || 6, Math.min(src.최대확대 || 19, z));
  var n = Math.pow(2, z), sz = 1 / n;
  var x0 = Math.floor(vb.x * n), x1 = Math.floor((vb.x + vb.w) * n);
  var y0 = Math.floor(vb.y * n), y1 = Math.floor((vb.y + vb.h) * n);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 160) return "";     // 안전장치
  var base = [], over = [];
  for (var X = x0; X <= x1; X++) {
    for (var Y = y0; Y <= y1; Y++) {
      if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
      var u = tileUrl(src.주소, z, X, Y);
      if (loadTile(u, src.id) === "ok") base.push(tileImg(vb, u, X, Y, sz, z));
      if (src.겹침) {
        var o = tileUrl(src.겹침, z, X, Y);
        if (loadTile(o, src.id) === "ok") over.push(tileImg(vb, o, X, Y, sz, z));
      }
    }
  }
  if (!base.length && !over.length) return "";
  return '<g class="tl">' + base.join("") + over.join("") + "</g>";
}

function tileImg(vb, u, X, Y, sz, z) {
  var x0 = (X * sz - vb.x) / vb.w * vb.sw;
  var y0 = (Y * sz - vb.y) / vb.h * vb.sh;
  var w = sz / vb.w * vb.sw, h = sz / vb.h * vb.sh;
  /* 타일 경계에 흰 실선이 보이지 않도록 반 픽셀 겹쳐 그린다 */
  return '<image href="' + escAttr(u) + '" x="' + (x0 - 0.5).toFixed(2)
    + '" y="' + (y0 - 0.5).toFixed(2) + '" width="' + (w + 1).toFixed(2)
    + '" height="' + (h + 1).toFixed(2) + '" preserveAspectRatio="none"'
    + ' data-t="' + z + "/" + X + "/" + Y + '"/>';
}

function escAttr(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

/* 배경지도 상태 — 두 지도가 똑같은 문구로 알려야 하므로 여기서 만든다.
   못 쓰게 판정된 원본이 있으면 이유와 확인 방법까지 적는다. 조용히
   경계선만 남기면 사용자는 무엇이 잘못됐는지 알 수 없습니다. */
function tileStatus() {
  var src = curSrc();
  var label = src ? (src.저작권 || src.이름)
    : (cfg().사용 ? "배경지도 없음 · 행정경계선만 표시" : "행정경계선만 표시");
  var dead = sources().filter(function (s) { return DEAD[s.id]; });
  var warn = "";
  if (dead.length) {
    var d = dead[0];
    var probe = tileUrl(d.주소, 15, 27960, 12854);       // 서울시청 부근 타일 한 장
    var link = ' <a href="' + escAttr(probe) + '" target="_blank" rel="noopener noreferrer">'
      + "타일 주소 직접 열어보기</a> — 새 창에 뜨는 메시지가 실제 원인입니다.";
    /* 뒷부분(원인 진단·확인 방법)은 이 도구를 설치·설정하는 사람에게 필요한
       내용이고, 현장에서 쓰는 사람에게는 굵은 첫 문장이면 충분합니다.
       좁은 화면에서는 이 띠가 여섯 줄까지 늘어나 지도를 밀어내므로 감춥니다
       (assets/shell.css 의 .wd). */
    var detail = function (t) { return '<span class="wd">' + t + link + "</span>"; };
    warn = src
      ? "<b>" + escAttr(d.이름) + " 배경지도를 불러오지 못해 " + escAttr(src.이름)
        + "(으)로 바꿨습니다.</b> " + detail(escAttr(d.진단 || ""))
      : "<b>배경지도를 불러오지 못해 행정경계선만 표시합니다.</b> "
        + detail(escAttr(d.진단 || "") + " 인터넷 연결이 차단된 환경인지도 확인하세요.");
  }
  return { src: src, label: label, warn: warn };
}

/* ── 행정경계선 ───────────────────────────────────────────────
   data/boundaries.js 의 델타 인코딩된 고리를 화면 픽셀 path 로 바꾼다.
   isOn(경계) 가 참이면 강조 표시(class="bd on")한다. */
function boundaryPaths(vb, isOn) {
  if (typeof window.BOUNDARIES === "undefined") return "";
  var mx = vb.sw * 0.35, my = vb.sh * 0.35;      // 화면 밖 여유 (px)
  var out = [];
  window.BOUNDARIES.forEach(function (f) {
    var on = !!(isOn && isOn(f));
    f.r.forEach(function (ring) {
      var X = 0, Y = 0, d = "", any = false, inside = false, lx = 1e9, ly = 1e9;
      for (var i = 0; i < ring.length; i += 2) {
        if (i === 0) { X = ring[0]; Y = ring[1]; } else { X += ring[i]; Y += ring[i + 1]; }
        var sx = (wx(X / window.BOUNDARY_SCALE) - vb.x) / vb.w * vb.sw;
        var sy = (wy(Y / window.BOUNDARY_SCALE) - vb.y) / vb.h * vb.sh;
        if (sx > -mx && sx < vb.sw + mx && sy > -my && sy < vb.sh + my) inside = true;
        /* 확대하면 한 픽셀 안에 여러 점이 몰린다 — 눈에 안 보이는 점은 건넌다 */
        if (any && Math.abs(sx - lx) < 0.4 && Math.abs(sy - ly) < 0.4) continue;
        d += (any ? "L" : "M") + sx.toFixed(1) + " " + sy.toFixed(1);
        lx = sx; ly = sy; any = true;
      }
      if (inside && any) out.push('<path d="' + d + '" class="bd' + (on ? " on" : "") + '"/>');
    });
  });
  return out.join("");
}

/* ── 경로선 ───────────────────────────────────────────────────
   사고지점에서 고른 곳까지 어느 쪽으로 얼마나 가야 하는지 한눈에 보이도록
   굵게 긋습니다. 실제 도로 경로가 아니라 직선입니다 — 도로를 따라가면
   이보다 멉니다(위 '이동 시간 어림' 참고). 그래서 실선이 아닌 긴 점선으로
   두어, 도로 경로처럼 보이지 않게 합니다.

   배경지도가 깔리면 지도의 도로·건물 색과 겹쳐 선이 묻히므로 흰 테두리를
   먼저 깔고 그 위에 색선을 올립니다. 색만으로 구분하지 않는 것과 같은
   이유로, 굵기까지 확실히 키웁니다. */
function routePath(x1, y1, x2, y2) {
  var d = "M" + x1.toFixed(1) + " " + y1.toFixed(1)
        + "L" + x2.toFixed(1) + " " + y2.toFixed(1);
  return '<path class="route-cas" d="' + d + '"/>'
       + '<path class="route" d="' + d + '"/>';
}

/* 2018년 경계 데이터와 현재 행정구역명이 다른 곳 */
var ALIAS = { "미추홀구": "남구" };
function matchSgg(bName, sgg) {
  if (!sgg) return false;
  if (bName === sgg) return true;
  if (ALIAS[sgg] && bName === ALIAS[sgg]) return true;
  return bName.indexOf(sgg) === 0 || sgg.indexOf(bName) === 0;
}

/* ── 대피장소 데이터 읽기 ──────────────────────────────────────
   SHELTERS[시도][시군구] = [[장소명, 상세, 주소, 수용, 구분, 위도, 경도, 부서, 전화], ...]
   좌표가 없는 곳은 지도에 찍을 수 없으므로 건넌다. */
function shelters(sido, sgg) {
  var out = [];
  var S = window.SHELTERS || {};
  var sds = sido ? [sido] : Object.keys(S);
  sds.forEach(function (sd) {
    var sgs = sgg ? [sgg] : Object.keys(S[sd] || {});
    sgs.forEach(function (sg) {
      ((S[sd] || {})[sg] || []).forEach(function (r) {
        if (r[5] == null || r[6] == null) return;
        out.push({ key: sd + "|" + sg + "|" + r[0] + "|" + r[5] + "," + r[6],
                   sido: sd, sgg: sg, name: r[0], detail: r[1], addr: r[2],
                   cap: r[3], kind: r[4], lat: r[5], lon: r[6], dept: r[7], tel: r[8] });
      });
    });
  });
  return out;
}

/* 시·군·구 이름만 알 때 시·도 찾기 (동명 시·군·구가 있으면 첫 번째) */
function findSido(sgg) {
  var S = window.SHELTERS || {}, hit = null;
  Object.keys(S).forEach(function (sd) {
    if (!hit && S[sd] && S[sd][sgg]) hit = sd;
  });
  return hit;
}

/* 외부 지도 확인 링크 — 인증키 없이 동작하는 공개 주소만 씁니다.
   도로·건물을 보면서 위치를 최종 확인하는 용도이며, 새 창으로 열리므로
   보고 있던 화면은 그대로 남습니다. */
function extLinks(s) {
  var q = encodeURIComponent(s.name + " " + (s.sgg || "") + " " + (s.addr || ""));
  var kakao = "https://map.kakao.com/link/map/" + encodeURIComponent(s.name)
            + "," + s.lat + "," + s.lon;
  var road = "https://map.kakao.com/link/roadview/" + s.lat + "," + s.lon;
  var naver = "https://map.naver.com/p/search/" + q;
  return '<span class="shmap-ext">'
    + '<a href="' + kakao + '" target="_blank" rel="noopener noreferrer">카카오맵</a>'
    + '<a href="' + road + '" target="_blank" rel="noopener noreferrer">로드뷰</a>'
    + '<a href="' + naver + '" target="_blank" rel="noopener noreferrer">네이버지도</a>'
    + "</span>";
}

/* ── 카메라(시야 이동) ────────────────────────────────────────
   ①②(map/app.js, assets/shmap.js) 가 각자 만들어 쓰던 requestAnimationFrame
   트윈을 한 곳으로 모았다. 어느 지도든 확대·축소·전체보기·조건 바뀜으로
   시야가 바뀔 때 항상 이 함수를 거치면, 순간이동 없이 "어디서 어디로,
   얼마나" 움직였는지 눈으로 좇을 수 있다.

   getView()/setView(v) 로 호출측의 view 객체({cx,cy,w})를 읽고 쓰며,
   매 프레임 redraw() 를 부른다. 반환하는 stop() 은 드래그를 시작하거나
   다른 이동을 새로 걸 때 진행 중이던 트윈을 끊는 용도다. */
function makeCamera(getView, setView, redraw) {
  var anim = null;
  function stop() { if (anim) { cancelAnimationFrame(anim); anim = null; } }
  function animateTo(target, ms) {
    stop();
    var view = getView();
    var from = { cx: view.cx, cy: view.cy, w: view.w }, t0 = null;
    var step = function (ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / ms);
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // 완만한 가감속
      setView({
        cx: from.cx + (target.cx - from.cx) * e,
        cy: from.cy + (target.cy - from.cy) * e,
        w: from.w + (target.w - from.w) * e
      });
      redraw();
      if (p < 1) anim = requestAnimationFrame(step); else anim = null;
    };
    anim = requestAnimationFrame(step);
  }
  return { animateTo: animateTo, stop: stop, isAnimating: function () { return !!anim; } };
}

/* ══ 지도 조작 — 끌기 · 손가락 확대 · 휠 ══════════════════════
   세 지도(①의 고르기 창, ② 대피장소, ③ 방제자원)가 똑같은 코드를 각자
   복사해 쓰고 있었습니다. 그래서 손가락으로 확대하는 기능이 빠져 있다는
   것이 세 곳에서 한꺼번에 문제가 되었고, 세 곳을 따로 고치면 다음에 또
   어긋납니다. 한 곳에 모읍니다.

   ── 왜 브라우저 기본 확대를 쓰지 않는가 ───────────────────
   CSS 에 touch-action:none 을 걸어 두었습니다. 이걸 풀면 브라우저가 페이지
   전체를 확대해 버려서, 지도만 확대되는 것이 아니라 조건 줄·목록까지 같이
   커지고 화면 밖으로 밀려납니다. 지도 안에서만 확대되게 하려면 우리가
   직접 처리해야 합니다.

   ── 손가락 두 개를 어떻게 읽는가 ──────────────────────────
   두 손가락이 닿는 순간의 간격(d0)과 그 중간점 아래에 있던 실제 지점을
   기억해 둡니다. 그다음에는 매 순간
       새 폭 = 처음 폭 × (d0 ÷ 지금 간격)
   으로 잡고, 기억해 둔 지점이 지금 중간점 아래에 오도록 시야를 옮깁니다.
   그래서 벌리면 확대되고, 두 손가락을 함께 움직이면 그만큼 따라 움직입니다.
   매 프레임 상대적으로 곱해 나가면 오차가 쌓여 손가락과 지도가 어긋납니다.
   ═══════════════════════════════════════════════════════════ */

function panzoom(svg, o) {
  var MINW = o.minW || 0.0000015;      // 최대 확대 — 화면 가로 약 50m
  var MAXW = o.maxW || 1.2;            // 최소 확대 — 지구 한 바퀴 언저리
  var TAP = 8;                         // 이만큼 안 움직이면 '눌렀다'로 본다 (px)

  var pts = {};                        // 지금 닿아 있는 손가락 pointerId → {x,y}
  var drag = null;                     // 한 손가락 끌기
  var pinch = null;                    // 두 손가락 확대
  var tapped = false;                  // 손가락 두 개가 닿은 적이 있으면 눌림 취소

  function ids() { return Object.keys(pts); }
  function rect() { return svg.getBoundingClientRect(); }

  /* 화면 좌표 아래에 있는 세계좌표 */
  function worldAt(x, y) {
    var vb = o.vb(), r = rect();
    return { x: vb.x + (x - r.left) / r.width * vb.w,
             y: vb.y + (y - r.top) / r.height * vb.h };
  }

  /* 폭을 nw 로 바꾸되, 세계좌표 w 가 화면의 (x, y) 아래에 오게 한다 */
  function apply(nw, w, x, y) {
    var vb = o.vb(), r = rect(), v = o.view();
    nw = Math.max(MINW, Math.min(MAXW, nw));
    var nh = nw * (vb.sh / vb.sw);
    var rx = (x - r.left) / r.width, ry = (y - r.top) / r.height;
    v.cx = w.x - (rx - 0.5) * nw;
    v.cy = w.y - (ry - 0.5) * nh;
    v.w = nw;
    o.draw();
  }

  function startPinch() {
    var a = pts[ids()[0]], b = pts[ids()[1]];
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    pinch = {
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      w0: o.view().w,
      anchor: worldAt(mx, my)
    };
    drag = null;
    tapped = false;
  }

  svg.addEventListener("pointerdown", function (e) {
    if (o.camStop) o.camStop();
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
    var n = ids().length;
    if (n === 1) {
      var v = o.view();
      drag = { x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy, moved: false };
      tapped = true;
    } else if (n === 2) {
      startPinch();
    } else {
      drag = null; pinch = null; tapped = false;   // 세 손가락 이상은 무시
    }
  });

  svg.addEventListener("pointermove", function (e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };

    if (pinch && ids().length >= 2) {
      var a = pts[ids()[0]], b = pts[ids()[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      apply(pinch.w0 * (pinch.d0 / d), pinch.anchor,
            (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (!drag) return;
    var vb = o.vb(), v = o.view();
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > TAP) drag.moved = true;
    v.cx = drag.cx - dx / vb.sw * vb.w;
    v.cy = drag.cy - dy / vb.sh * vb.h;
    o.draw();
  });

  function lift(e, cancelled) {
    var had = !!pts[e.pointerId];
    delete pts[e.pointerId];
    try { svg.releasePointerCapture(e.pointerId); } catch (err) {}
    if (!had) return;

    var n = ids().length;
    if (pinch) {
      /* 한 손가락만 떼면 남은 손가락으로 계속 끌 수 있게 이어 준다 */
      pinch = null;
      if (n === 1) {
        var v = o.view(), p = pts[ids()[0]];
        drag = { x: p.x, y: p.y, cx: v.cx, cy: v.cy, moved: true };
      }
      return;
    }
    var moved = drag && drag.moved;
    drag = null;
    if (cancelled || moved || !tapped || n > 0) { tapped = false; return; }
    tapped = false;
    if (o.onTap) o.onTap(e.clientX, e.clientY);
  }

  svg.addEventListener("pointerup", function (e) { lift(e, false); });
  svg.addEventListener("pointercancel", function (e) { lift(e, true); });

  svg.addEventListener("wheel", function (e) {
    e.preventDefault();
    if (o.camStop) o.camStop();
    var v = o.view();
    apply(v.w * (e.deltaY > 0 ? 1.25 : 0.8),
          worldAt(e.clientX, e.clientY), e.clientX, e.clientY);
  }, { passive: false });
}

/* ── 조건 줄 접기 ─────────────────────────────────────────────
   좁은 화면에서 조건들이 세로로 쌓여 지도를 아래로 밀어냅니다(갤럭시S8에서
   320px, 화면의 절반). 주소 검색만 남기고 접어 두었다가 필요할 때 폅니다.
   접는 것은 CSS 미디어쿼리 안에서만 일어나므로, 넓은 화면에서는 이 클래스가
   붙어 있어도 아무것도 가려지지 않습니다.

   ②(map)와 ③(res)이 같은 구조를 쓰므로 여기에 둡니다. */
function foldBar() {
  var bar = document.querySelector(".mbar");
  var btn = document.getElementById("mbToggle");
  if (!bar || !btn) return;
  var narrow = window.matchMedia("(max-width: 860px)");

  function set(folded) {
    bar.classList.toggle("folded", folded);
    btn.setAttribute("aria-expanded", String(!folded));
    btn.firstChild.nodeValue = folded ? "조건 더보기" : "조건 접기";
  }
  set(narrow.matches);
  btn.onclick = function () { set(!bar.classList.contains("folded")); };

  /* 화면을 돌리거나 창을 넓혔을 때 — 넓어지면 펴진 상태로 두어야
     "접기" 단추만 남고 내용이 안 보이는 어정쩡한 상태가 안 된다 */
  var on = function (e) { set(e.matches); };
  if (narrow.addEventListener) narrow.addEventListener("change", on);
  else if (narrow.addListener) narrow.addListener(on);
}

window.MAPCORE = {
  /* 투영 */
  wx: wx, wy: wy, wxInv: wxInv, wyInv: wyInv,
  mToWorld: mToWorld, worldToM: worldToM,
  /* 거리·방위 */
  distM: distM, bearing: bearing, dirName: dirName,
  fmtDist: fmtDist, niceDist: niceDist, scale: scale,
  /* 이동 시간 어림 · 내 위치 */
  trip: trip, fmtMin: fmtMin, walkable: WALKABLE, locate: locate,
  /* 그리기 */
  boundaryPaths: boundaryPaths, matchSgg: matchSgg, routePath: routePath,
  /* 카메라 · 조작 */
  camera: makeCamera, panzoom: panzoom, foldBar: foldBar,
  /* 데이터 */
  shelters: shelters, findSido: findSido, extLinks: extLinks,
  /* 배경지도 타일 */
  tiles: {
    cfg: cfg,
    sources: sources,
    current: curSrc,
    isDead: function (id) { return !!DEAD[id]; },
    use: function (id) { CUR = id; },
    /* 다시 시도해 볼 기회를 준다 — 일시적인 장애였을 수 있다 */
    revive: function (id) { DEAD[id] = false; SRCSTAT[id] = { ok: 0, bad: 0 }; },
    url: tileUrl,
    layer: tileLayer,
    status: tileStatus,
    onChange: function (fn) { listeners.push(fn); }
  }
};

})();
