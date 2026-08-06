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
    warn = src
      ? "<b>" + escAttr(d.이름) + " 배경지도를 불러오지 못해 " + escAttr(src.이름)
        + "(으)로 바꿨습니다.</b> " + escAttr(d.진단 || "") + link
      : "<b>배경지도를 불러오지 못해 행정경계선만 표시합니다.</b> "
        + escAttr(d.진단 || "") + " 인터넷 연결이 차단된 환경인지도 확인하세요." + link;
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

window.MAPCORE = {
  /* 투영 */
  wx: wx, wy: wy, wxInv: wxInv, wyInv: wyInv,
  mToWorld: mToWorld, worldToM: worldToM,
  /* 거리·방위 */
  distM: distM, bearing: bearing, dirName: dirName,
  fmtDist: fmtDist, niceDist: niceDist, scale: scale,
  /* 그리기 */
  boundaryPaths: boundaryPaths, matchSgg: matchSgg,
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
