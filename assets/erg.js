/* ============================================================
   ERG 거리 읽기 — 04 현장 안전거리 확인이 씁니다

   화학물질안전원 「화학사고 현장대응 물질정보」 460종(data/materials.js)에는
   ERG(비상대응 핸드북) 값이 글로 적혀 있습니다.
     d1 초기이격거리   "소규모 반경 30m / 대규모 반경 300m 이내"
     d2 방호활동거리   "대규모 유출시 풍하방향으로 낮: 1.9km 이내, 밤: 4.5km …
                         •소규모 유출시 풍하방향으로 낮: 0.1km, 밤: 0.2km"
   지도에 그리려면 이 글을 숫자로 읽어야 합니다. 이 파일이 그 일만 합니다.

   ── 왜 원문을 고치지 않고 읽기만 하나 ────────────────────────
   원문 표기가 물질마다 다릅니다(쌍점 유무 · 띄어쓰기 · "육지/수계" ·
   "기체/액체" · "흄" 구분 · "11.0+ km"). 사람이 손으로 표를 다시 만들면
   옮겨 적다 틀립니다. 그래서 원문을 그대로 두고 읽는 규칙만 둡니다 —
   화면에는 **읽은 숫자와 원문을 늘 함께** 보여 줍니다.

   ── 지어내지 않습니다 (CLAUDE.md 2절 3항) ─────────────────────
   · 원문에 없는 조합(예: 대규모 초기이격거리가 없는 물질)은 null 로
     돌려줍니다. 비슷한 값으로 메우지 않습니다 — 화면이 "자료에 없음"
     이라고 적습니다.
   · 원문의 앞뒤가 이상해 보여도(소규모가 대규모보다 큰 물질이 있습니다)
     고치지 않습니다. 원문이 기준입니다.

   ── 구분(육지·수계·기체·액체·고체·흄) ─────────────────────────
   몇몇 물질은 거리가 상태에 따라 따로 적혀 있습니다. 어느 것인지는
   현장이 정하므로 화면이 묻습니다(variants). 원문에 구분이 없는 값은
   모든 구분에 똑같이 씁니다.
   ============================================================ */
(function () {
"use strict";

var VARS = "육지|수계|기체|액체|고체|흄";
var SIZES = "소규모|대규모|소량|대량";

/* "1,000" "0.5" + 단위 → 미터 */
function meters(n, unit) {
  var v = parseFloat(String(n).replace(/,/g, ""));
  if (!isFinite(v)) return null;
  return Math.round(v * (/km/i.test(unit) ? 1000 : 1));
}
function sizeOf(t) { return /^소/.test(t) ? "s" : "l"; }
function blank(t) { return !t || /^[\s:\-–—]*$/.test(String(t)); }

/* 초기이격거리 — "반경 N m" 하나하나를 그 앞에 나온 규모·구분과 짝짓습니다 */
function parseIso(t) {
  var out = [];
  if (blank(t)) return out;
  /* "반경 50 m [대량 유출] 300 m" 처럼 규모 뒤에 '반경' 없이 숫자만 오는
     원문이 있습니다 — 규모를 막 읽은 뒤의 맨숫자만 그 규모의 값으로 칩니다. */
  var size = "", v = "", fresh = false, m;
  var re = new RegExp("(" + SIZES + ")|(" + VARS + ")|반경\\s*([\\d.,]+)\\s*(km|m)"
    + "|([\\d.,]+)\\s*(km|m)(?![a-z])", "g");
  while ((m = re.exec(String(t)))) {
    if (m[1]) { size = sizeOf(m[1]); fresh = true; }
    else if (m[2]) v = m[2];
    else if (m[3] || fresh) {
      var x = m[3] ? meters(m[3], m[4]) : meters(m[5], m[6]);
      if (x) out.push({ size: size, v: v, m: x });
      fresh = false;
    }
  }
  return out;
}

/* 방호활동거리 — '•' 로 나뉜 조각마다 규모·구분을 새로 읽습니다.
     dn   낮·밤 거리가 짝으로 있는 것 (ERG 표 1 — 흡입독성 물질)
     min  "풍하방향으로 N m 이상" (ERG 안내 쪽의 대피 거리)
     ring "반경 N m"
   낮 값을 읽고 밤 값을 만나면 한 줄로 내보냅니다. */
function parsePad(t) {
  var out = [];
  if (blank(t)) return out;
  String(t).split("•").forEach(function (seg) {
    var size = "", v = "", day = null, m;
    var re = new RegExp("(" + SIZES + ")|(" + VARS + ")"
      + "|(낮|밤)\\s*[:：]?\\s*([\\d.,]+)\\s*(\\+?)\\s*(km|m)"
      + "|(반경|풍하\\s*방향(?:으로)?)\\s*([\\d.,]+)\\s*(\\+?)\\s*(km|m)\\s*(이상)?", "g");
    while ((m = re.exec(seg))) {
      if (m[1]) { size = sizeOf(m[1]); day = null; }
      else if (m[2]) { v = m[2]; day = null; }
      else if (m[3]) {
        var x = meters(m[4], m[6]);
        if (m[3] === "낮") day = { m: x, plus: !!m[5] };
        else if (day) {
          out.push({ kind: "dn", size: size, v: v, day: day.m, night: x,
                     dayPlus: day.plus, nightPlus: !!m[5] });
          day = null;
        }
      } else if (m[7]) {
        var y = meters(m[8], m[10]);
        if (y) out.push({ kind: m[7] === "반경" ? "ring" : "min", size: size, v: v,
                          m: y, plus: !!m[9] || !!m[11] });
      }
    }
  });
  return out;
}

/* 한 물질의 읽은 값 (한 번 읽으면 기억해 둡니다) */
var CACHE = {};
function info(mat) {
  if (!mat) return null;
  var key = mat.n;
  if (CACHE[key]) return CACHE[key];
  var iso = parseIso(mat.d1), pad = parsePad(mat.d2);
  var vs = [];
  iso.concat(pad).forEach(function (e) { if (e.v && vs.indexOf(e.v) < 0) vs.push(e.v); });
  var r = {
    iso: iso, pad: pad, variants: vs,
    /* 규모를 물어야 하는가 — 원문 어딘가에 소규모·대규모 구분이 있으면 */
    needSize: iso.concat(pad).some(function (e) { return e.size; }),
    /* 낮·밤이 의미가 있는가 */
    hasDN: pad.some(function (e) { return e.kind === "dn"; }),
    any: iso.length + pad.length > 0
  };
  CACHE[key] = r;
  return r;
}

/* 고른 조건(규모·구분)에 맞는 줄 하나.
   규모·구분이 정확히 맞는 줄을 먼저, 구분 없이 적힌 줄을 그다음으로 씁니다.
   맞는 줄이 없으면 null — 다른 규모·구분의 값을 빌려 오지 않습니다. */
function best(list, size, v) {
  var c = list.filter(function (e) {
    return (e.size === "" || e.size === size) && (e.v === "" || e.v === v);
  });
  c.sort(function (a, b) {
    var sa = (a.size && a.size === size ? 2 : 0) + (a.v && a.v === v ? 1 : 0);
    var sb = (b.size && b.size === size ? 2 : 0) + (b.v && b.v === v ? 1 : 0);
    return sb - sa;
  });
  return c[0] || null;
}

/* sel = { size: "s"|"l"|"", v: 구분|"", night: true|false }
   돌려주는 것 — iso {m} · pad {kind, m, plus, day, night} (없으면 null) */
function pick(inf, sel) {
  if (!inf) return { iso: null, pad: null };
  var size = sel.size || "", v = sel.v || "";
  var iso = best(inf.iso, size, v);
  var dn = best(inf.pad.filter(function (e) { return e.kind === "dn"; }), size, v);
  var pad = null;
  if (dn) {
    pad = { kind: "dn", m: sel.night ? dn.night : dn.day,
            plus: sel.night ? dn.nightPlus : dn.dayPlus, day: dn.day, night: dn.night };
  } else {
    var mn = best(inf.pad.filter(function (e) { return e.kind !== "dn"; }), size, v);
    if (mn) pad = { kind: mn.kind, m: mn.m, plus: mn.plus };
  }
  return { iso: iso ? { m: iso.m } : null, pad: pad };
}

/* ── 낮·밤 ────────────────────────────────────────────────────
   ERG 표의 낮·밤은 해가 떠 있는가로 나눕니다. 날짜와 자리로 일출·일몰을
   계산합니다(NOAA 근사식 · 몇 분 어긋날 수 있어 화면에 '대략'이라 적습니다).
   인터넷이 없어도 됩니다. */
function sun(lat, lon, when) {
  var D2R = Math.PI / 180;
  var d = when || new Date();
  var y0 = Date.UTC(d.getFullYear(), 0, 1);
  var today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  var n = Math.round((today - y0) / 864e5);              // 1월 1일 = 0
  var g = 2 * Math.PI / 365 * n;
  var eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
            - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
           - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
           - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  var c = Math.cos(90.833 * D2R) / (Math.cos(lat * D2R) * Math.cos(decl))
        - Math.tan(lat * D2R) * Math.tan(decl);
  if (c > 1 || c < -1) return null;                      // 백야·극야 — 우리나라엔 없음
  var ha = Math.acos(c) / D2R;
  var base = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return { rise: new Date(base + (720 - 4 * (lon + ha) - eqt) * 60000),
           set:  new Date(base + (720 - 4 * (lon - ha) - eqt) * 60000) };
}
function isNight(lat, lon, when) {
  var t = when || new Date(), s = sun(lat, lon, t);
  if (!s) return false;
  return t < s.rise || t >= s.set;
}

window.ERG = { info: info, pick: pick, sun: sun, isNight: isNight,
               parseIso: parseIso, parsePad: parsePad };
})();
