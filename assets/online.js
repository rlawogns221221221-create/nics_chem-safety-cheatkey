/* ============================================================
   인터넷이 있어야 되는 것 — 장소 검색 · 도보 경로

   ② 대피장소 지도(map/index.html)만 이 파일을 불러옵니다.
   ③ 방제자원은 부르지 않습니다 — 업체 담당자 개인정보 취급 방침이 아직
   정해지지 않아, 사고지점·업체 좌표를 바깥으로 내보내는 기능을 붙이지
   않기로 했습니다. 그래서 공용 엔진(mapcore.js)이 아니라 이 파일에
   따로 둡니다. 파일이 분리돼 있으면 "누가 무엇을 바깥으로 보내는가"가
   불러오는 목록만 봐도 드러납니다.

   ── 바깥으로 나가는 것 ──────────────────────────────────────
     장소 검색    검색어         → 국토교통부 브이월드 (api.vworld.kr)
     사고지점 주소 사고지점 좌표  → 국토교통부 브이월드 (api.vworld.kr)
     도보 경로    두 지점의 좌표 → OSRM 공개 서버 (router.project-osrm.org)

   대피장소는 공개 자료이고 검색어도 사용자가 직접 친 것이므로 내보내도
   되는 값입니다. 다만 사고지점 좌표는 경로를 그릴 때 함께 나갑니다.
   대외 발표 전 위치를 밖에 내보내면 안 되는 상황이라면 화면의
   '도보 경로' 스위치를 끄면 됩니다(꺼도 직선 경로는 그대로 나옵니다).

   ── 안 되면 어떻게 되는가 ───────────────────────────────────
   인터넷이 없거나 서버가 응답하지 않아도 화면이 멈추지 않습니다.
     장소 검색    도구 안에 든 자료(대피장소 이름·시군구·읍면동)로만 찾습니다
     사고지점 주소 행정경계(시·군·구)와 가장 가까운 대피장소 주소로 어림잡습니다
     도보 경로    두 지점을 잇는 직선을 그립니다 (지금까지 하던 그대로)
   ============================================================ */
(function () {
"use strict";

/* 응답을 이만큼 기다리고 포기합니다. 급할 때 쓰는 도구라 오래 붙들고
   있으면 안 됩니다 — 실패해도 곧바로 오프라인 결과가 보여야 합니다. */
var TIMEOUT = 6000;

/* 길찾기 서버. 기관 내부에 OSRM 을 세웠다면 이 주소만 바꾸면 됩니다.
   공개 서버는 무보증이라 응답이 늦거나 막힐 수 있고, 그때는 직선으로
   되돌아갑니다. */
var OSRM = "https://router.project-osrm.org/route/v1/foot/";

function key() {
  return String((window.BASEMAP || {}).인증키 || "").trim();
}

/* ══ JSONP ═══════════════════════════════════════════════════
   브이월드 검색 API 는 브라우저에서 직접 부를 때 CORS 가 열려 있지 않은
   경우가 있어, 어느 쪽이든 되는 JSONP 로 부릅니다(<script> 로 불러오는
   방식이라 CORS 를 타지 않습니다).

   JSONP 는 실패를 알려 주지 못하므로 시간 제한을 직접 겁니다. 남겨진
   전역 함수와 <script> 태그는 성공·실패·시간초과 어느 쪽이든 지웁니다. */
var jsonpN = 0;
function jsonp(url, done) {
  var name = "__vwcb" + (++jsonpN);
  var s = document.createElement("script");
  var timer = null;
  var finish = function (data, err) {
    if (!name) return;                       // 이미 끝났다
    clearTimeout(timer);
    try { delete window[name]; } catch (e) { window[name] = undefined; }
    if (s.parentNode) s.parentNode.removeChild(s);
    name = null;
    done(data, err);
  };
  window[name] = function (data) { finish(data, null); };
  timer = setTimeout(function () { finish(null, "시간초과"); }, TIMEOUT);
  s.onerror = function () { finish(null, "연결실패"); };
  s.src = url + "&callback=" + name;
  document.head.appendChild(s);
}

/* ══ 장소 검색 (브이월드) ════════════════════════════════════
   "여수시청"처럼 이름만 알아도 찾히게 하려는 것입니다. 지금까지는 도구
   안에 등록된 대피장소·시군구·읍면동 이름으로만 찾을 수 있었습니다.

   두 종류를 함께 찾습니다.
     place    사업장·건물·시설 이름 (예: ○○화학 여수공장, △△초등학교)
     address  도로명·지번 주소
   둘 다 좌표가 정확하므로, 고르면 그 자리를 사고지점으로 바로 찍습니다.
   (도구 안에서 찾은 시군구·읍면동은 평균 좌표라 그렇게 하지 않습니다.)
   ═══════════════════════════════════════════════════════════ */

function url(type, q) {
  return "https://api.vworld.kr/req/search?service=search&request=search"
    + "&version=2.0&crs=EPSG:4326&size=10&page=1&format=json&errorformat=json"
    + "&type=" + type
    + (type === "address" ? "&category=road" : "")
    + "&query=" + encodeURIComponent(q)
    + "&key=" + encodeURIComponent(key());
}

/* 응답에서 쓸 것만 꺼낸다. 브이월드는 항목 모양이 종류마다 조금씩 달라
   (장소는 title, 주소는 address 아래) 둘 다 훑는다. */
function parse(data, kind) {
  var r = data && data.response;
  if (!r || r.status !== "OK") return [];
  var items = (r.result && r.result.items) || [];
  var out = [];
  items.forEach(function (it) {
    var p = it.point || {};
    var lon = parseFloat(p.x), lat = parseFloat(p.y);
    if (!isFinite(lat) || !isFinite(lon)) return;
    var a = it.address || {};
    var addr = a.road || a.parcel || "";
    var name = it.title || addr;
    if (!name) return;
    out.push({
      kind: kind,                       // "poi" | "addr"
      label: name,
      sub: kind === "poi" ? (addr || it.category || "") : (a.parcel || ""),
      lat: lat, lon: lon,
      exact: true                       // 좌표가 정확하다 = 사고지점으로 바로 써도 된다
    });
  });
  return out;
}

/* 장소와 주소를 함께 찾아 한 목록으로 돌려준다.
   둘 중 하나만 되어도 그것만 돌려준다 — 하나가 막혔다고 검색 전체가
   실패한 것처럼 보이면 안 된다. */
function search(q, done) {
  q = String(q || "").trim();
  if (!q) return done([], null);
  if (!key()) return done([], "브이월드 인증키가 없습니다");

  var got = 0, rows = [], errs = [];
  var back = function (list, err) {
    if (list) rows = rows.concat(list);
    if (err) errs.push(err);
    if (++got < 2) return;
    /* 이름으로 찾은 것(place)을 먼저 — 사업장명을 치는 경우가 대부분이다 */
    rows.sort(function (a, b) {
      return (a.kind === "poi" ? 0 : 1) - (b.kind === "poi" ? 0 : 1);
    });
    done(rows, rows.length ? null : (errs[0] || null));
  };
  jsonp(url("place", q), function (d, e) { back(d ? parse(d, "poi") : null, e); });
  jsonp(url("address", q), function (d, e) { back(d ? parse(d, "addr") : null, e); });
}

/* ══ 사고지점 주소 알아내기 (브이월드 역지오코딩) ═════════════
   지도를 눌러 사고지점을 찍었을 때 그곳이 어느 읍·면·동인지 알아냅니다.
   주민대피 문자에는 "○○시 ○○동 ○○에서 발생한" 처럼 읍·면·동이 들어가는데,
   좌표만으로는 그 값을 채울 수 없어 담당자가 따로 찾아 넣어야 했습니다.

   도로명 주소와 지번 주소를 함께 받습니다(type=BOTH).
     지번 쪽  level3(읍·면) · level4A(법정동·리)  ← 읍·면·동은 여기서 나옵니다
     도로명 쪽 level4L(도로명) · level5(건물번호) ← 장소 이름을 모를 때 대신 씁니다
   시(市) 아래 동은 level3 이 비고 level4A 에 동이, 군(郡) 아래는 level3 에
   읍·면이 들어옵니다. 그래서 level3 을 먼저 보고 없으면 level4A 를 씁니다.
   ═══════════════════════════════════════════════════════════ */
function revUrl(type, lat, lon) {
  return "https://api.vworld.kr/req/address?service=address&request=getAddress"
    + "&version=2.0&crs=EPSG:4326&format=json&errorformat=json&simple=false"
    + "&type=" + type
    + "&point=" + lon + "," + lat
    + "&key=" + encodeURIComponent(key());
}

function revPick(data) {
  var r = data && data.response;
  if (!r || r.status !== "OK") return null;
  var it = (r.result || [])[0];
  if (!it) return null;
  var s = it.structure || {};
  return {
    sido: s.level1 || "",
    sgg: s.level2 || "",
    /* 읍·면이 있으면 그것, 없으면 법정동 */
    emd: s.level3 || s.level4A || "",
    road: s.level4L || "",                 // 도로명 (예: 시청1길)
    no: s.level5 || "",                    // 건물번호
    text: it.text || ""
  };
}

function revgeo(lat, lon, done) {
  if (!key()) return done(null, "브이월드 인증키가 없습니다");
  var got = 0, out = { sido: "", sgg: "", emd: "", road: "", no: "", text: "" }, err = null;
  var back = function (v, e) {
    if (v) {
      /* 두 응답을 합친다 — 읍·면·동은 지번 쪽이, 도로명은 도로명 쪽이 정확하다 */
      ["sido", "sgg", "emd", "road", "no"].forEach(function (k) {
        if (!out[k] && v[k]) out[k] = v[k];
      });
      if (!out.text && v.text) out.text = v.text;
    } else if (e && !err) err = e;
    if (++got < 2) return;
    done(out.sgg || out.emd ? out : null, out.sgg || out.emd ? null : (err || "주소 없음"));
  };
  jsonp(revUrl("parcel", lat, lon), function (d, e) { back(d ? revPick(d) : null, e); });
  jsonp(revUrl("road", lat, lon), function (d, e) { back(d ? revPick(d) : null, e); });
}

/* ══ 도보 경로 (OSRM) ════════════════════════════════════════
   지금까지 그리던 직선은 "어느 쪽으로 얼마나"는 알려 주지만 실제로 걸어서
   갈 수 있는 길인지는 알려 주지 못합니다. 강·철길·고속도로가 사이에 있으면
   직선거리는 가까워도 한참 돌아가야 합니다.

   실패하면 null 을 돌려줍니다. 부르는 쪽은 그때 직선을 그립니다 —
   경로를 못 받았다고 아무것도 안 그리면 화면이 더 나빠집니다.
   ═══════════════════════════════════════════════════════════ */
function route(from, to, done) {
  var u = OSRM + from.lon + "," + from.lat + ";" + to.lon + "," + to.lat
        + "?overview=full&geometries=geojson&alternatives=false&steps=false";

  /* 응답이 늦으면 끊는다. AbortController 가 없는 브라우저에서는
     타이머만 걸어 두고 늦게 온 응답을 버린다. */
  var ac = window.AbortController ? new AbortController() : null;
  var dead = false;
  var timer = setTimeout(function () {
    dead = true;
    if (ac) ac.abort();
    done(null, "시간초과");
  }, TIMEOUT);

  var opt = ac ? { signal: ac.signal } : {};
  fetch(u, opt).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }).then(function (d) {
    if (dead) return;
    clearTimeout(timer);
    var rt = d && d.code === "Ok" && d.routes && d.routes[0];
    if (!rt || !rt.geometry || !rt.geometry.coordinates) return done(null, "경로 없음");
    done({
      /* [[경도, 위도], ...] → 그리기 쉽게 {lat, lon} 으로 */
      path: rt.geometry.coordinates.map(function (c) { return { lon: c[0], lat: c[1] }; }),
      dist: Math.round(rt.distance)          // 도로를 따라간 거리 (m)
    }, null);
  }).catch(function (e) {
    if (dead) return;
    clearTimeout(timer);
    done(null, e && e.name === "AbortError" ? "시간초과" : "연결실패");
  });

  return function abort() {                  // 다른 곳을 고르면 이전 요청을 끊는다
    if (dead) return;
    dead = true;
    clearTimeout(timer);
    if (ac) ac.abort();
  };
}

window.ONLINE = { search: search, revgeo: revgeo, route: route,
                  hasKey: function () { return !!key(); } };

})();
