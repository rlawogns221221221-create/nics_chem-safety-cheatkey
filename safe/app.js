/* ============================================================
   04 현장 안전거리 확인 (2026-11-09 사용자 결정)

   물질과 사고지점을 넣으면 ERG 초기이격거리(사고지점 둘레 원)와
   방호활동 구역(바람이 불어가는 쪽)을 지도에 그리고, **내 위치**나
   **지도에서 누른 곳**이 그 안인지 사실대로 적습니다.

   ── 무엇을 적고 무엇을 적지 않나 ──────────────────────────────
   · "초기이격거리 안 / 방호활동 구역 안 / 두 구역 밖" — 그림과 자리의
     사실만 적습니다. "위험·안전" 같은 단정은 쓰지 않습니다(사용자 결정).
   · 거리는 물질정보 460종의 ERG 원문에서 읽습니다(assets/erg.js).
     원문에 없는 조합은 "자료에 없음" — 비슷한 값으로 메우지 않습니다.
   · 유출 규모·구분(육지·수계 등)은 **사람이 고릅니다.** 도구가 미리
     골라 두면 그것이 곧 판단이 됩니다(CLAUDE.md 2절 1항).
     낮·밤은 해가 떠 있는가라는 사실이라 저절로 정하고, 바꿀 수 있게 둡니다.

   ── 구역 모양 ────────────────────────────────────────────────
   · 초기이격 — 사고지점을 가운데 둔 원.
   · 방호활동 — 사고지점에서 바람이 불어가는 쪽으로 그 거리만큼, 폭도
     같은 정사각형(ERG 그림 방식). 바람 방향을 모르면 방향을 정할 수
     없으므로 **점선 원으로 거리만** 보여 주고 그렇게 적습니다.
     ⚠ ERG 원문 파일을 받으면 그림과 한 번 더 대조합니다(CLAUDE.md 8절).
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

var MC = window.MAPCORE, ERG = window.ERG;
var wx = MC.wx, wy = MC.wy, wxInv = MC.wxInv, wyInv = MC.wyInv;
var mToWorld = MC.mToWorld, distM = MC.distM, bearing = MC.bearing;
var dirName = MC.dirName, fmtDist = MC.fmtDist;

var st = {
  mat: null,                 // 고른 물질 (MATERIALS 한 줄)
  inf: null,                 // ERG.info(mat)
  size: "",                  // "s" 소규모 · "l" 대규모 · "" 아직 안 고름
  v: "",                     // 구분(육지·수계 …) — 원문이 나뉜 물질만
  time: "auto",              // "auto" · "day" · "night"
  wind: "",                  // 바람이 불어오는 쪽 (도, 북=0) · "" 모름
  acc: null,                 // 사고지점 {lat, lon}
  accName: "",               // 검색으로 찍었으면 그 이름
  me: null,                  // 내 위치 {lat, lon, acc}
  watchId: null,             // 내 위치를 계속 받는 중이면 그 번호
  probe: null,               // 지도를 눌러 확인한 곳 {lat, lon}
  mode: "pick",              // "acc" = 다음 누름이 사고지점
  view: null
};
var SVG = null, VB = null;
var CAM = MC.camera(function () { return st.view; }, function (v) { st.view = v; }, draw);
MC.tiles.onChange(function () { if (st.view) draw(); });

/* ── 물질 ──────────────────────────────────────────────────────
   ② 와 같은 규칙으로 찾습니다 — 표시명 · 유사명 · CAS 번호. */
function normName(x) { return String(x).replace(/[\s·,()]/g, "").toLowerCase(); }
var MATIDX = null;
function findMaterial(name) {
  if (!MATIDX) {
    MATIDX = {};
    (window.MATERIALS || []).forEach(function (m) {
      [m.n].concat(String(m.n).split("/")).concat(m.a || []).concat(m.c ? [m.c] : [])
        .forEach(function (k) {
          var key = normName(k);
          if (key && !MATIDX[key]) MATIDX[key] = m;
        });
    });
  }
  var q = normName(name);
  return q ? (MATIDX[q] || null) : null;
}

function setMat(txt) {
  var m = findMaterial(txt);
  if (m === st.mat) return;
  st.mat = m;
  st.inf = m ? ERG.info(m) : null;
  /* 구분은 물질마다 다르므로 새 물질에 없는 구분이면 지웁니다.
     구분이 하나뿐이면 물을 것이 없으니 그것으로 둡니다. */
  var vs = st.inf ? st.inf.variants : [];
  if (vs.indexOf(st.v) < 0) st.v = vs.length === 1 ? vs[0] : "";
  renderOpts(); update(true);
}

/* ── 지금 고른 조건의 거리 ─────────────────────────────────── */
function sunPoint() {
  if (st.acc) return st.acc;
  if (st.me) return st.me;
  return { lat: 36.4, lon: 127.8 };              // 아직 아무 자리도 없으면 국토 가운데
}
function isNight() {
  if (st.time === "day") return false;
  if (st.time === "night") return true;
  var p = sunPoint();
  return ERG.isNight(p.lat, p.lon, new Date());
}
function zones() {
  if (!st.inf) return null;
  return ERG.pick(st.inf, { size: st.size, v: st.v, night: isNight() });
}
/* 아직 사람이 골라야 할 것 — 고르기 전에는 거리를 정할 수 없습니다 */
function needs() {
  var n = [];
  if (!st.inf || !st.inf.any) return n;
  if (st.inf.needSize && !st.size) n.push("유출 규모");
  if (st.inf.variants.length > 1 && !st.v) n.push("구분");
  return n;
}
function padLabel(p) {
  if (!p) return "";
  return fmtDist(p.m) + (p.plus || p.kind === "min" ? " 이상" : "");
}
var SIZE_KO = { s: "소규모", l: "대규모" };

/* ── 한 자리가 구역 안인가 (사실만) ─────────────────────────────
   방호활동 구역은 사고지점에서 풍하방향으로 L, 폭 L(가운데 축 ±L/2). */
function judge(p, z) {
  var a = st.acc;
  var d = distM(a.lat, a.lon, p.lat, p.lon);
  var b = bearing(a.lat, a.lon, p.lat, p.lon);
  var r = { d: d, b: b, iso: null, pad: null };
  if (z.iso) r.iso = d <= z.iso.m;
  if (z.pad) {
    var L = z.pad.m;
    if (z.pad.kind === "ring") {
      r.pad = d <= L ? "in" : "out";
    } else if (st.wind !== "") {
      var down = (+st.wind + 180) % 360;
      var t = (b - down) * Math.PI / 180;
      var along = d * Math.cos(t), across = d * Math.sin(t);
      r.along = along; r.across = Math.abs(across);
      r.pad = (along >= 0 && along <= L && Math.abs(across) <= L / 2) ? "in" : "out";
      if (r.pad === "in") r.side = Math.max(0, Math.round(L / 2 - Math.abs(across)));
    } else {
      r.pad = d <= L ? "near" : "out";       // 방향을 모름 — 거리만 견줍니다
    }
  }
  return r;
}

/* 받침에 맞춰 조사 하나만 붙입니다 — "구분을(를)" · "유출 규모을(를)" 처럼
   두 꼴을 함께 적었더니 틀린 쪽이 그대로 읽혔습니다(2026-11-09 글자 검토).
   한글이 아닌 글자(숫자·영문·괄호)로 끝나면 어느 쪽인지 몰라 두 꼴을 둡니다. */
function josa(w, a, b) {
  w = String(w);
  var c = w.charCodeAt(w.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 ? a : b;
  return a + "(" + b + ")";
}
/* 한 덩어리로 읽어야 하는 토막 — 줄이 그 가운데서 바뀌지 않게 묶습니다 */
function nb(s) { return '<span class="nb">' + s + "</span>"; }

/* ── 지금 상태 ──────────────────────────────────────────────── */
function stepHint(n, txt, done) {
  return '<li class="' + (done ? "done" : "") + '"><b>' + n + '</b><div class="st">' + txt + "</div></li>";
}
function renderStat() {
  var el = $("#sfStat");
  var need = needs();
  var z = zones();
  var html = "";

  /* 아직 그릴 것이 없으면 무엇을 하면 되는지 차례로 */
  if (!st.mat || !st.acc || need.length) {
    html += '<ol class="sf-steps">'
      + stepHint(1, st.mat ? "물질 — <span>" + esc(st.mat.n) + "</span>" : "물질을 고르세요", !!st.mat)
      /* 찍는 방법 셋은 아랫줄에 따로 — 괄호로 이어 붙였더니 "이름으로 / 찾기)" 로
         갈라졌습니다. 이름은 위 단추 글자와 같게 씁니다. */
      + stepHint(2, st.acc ? "사고지점 — <span>" + esc(accText()) + "</span>"
                            : "사고지점을 정하세요<small>" + nb("지도에서 찍기") + " · " + nb("내 위치로 찍기")
                              + " · " + nb("이름으로 찾기") + "</small>", !!st.acc)
      + (need.length ? stepHint(3, esc(need.join("·")) + josa(need[need.length - 1], "을", "를") + " 고르세요", false) : "")
      + "</ol>";
  }

  if (st.mat && st.inf && !st.inf.any) {
    html += '<p class="sf-none">‘' + esc(st.mat.n) + "’" + josa(st.mat.n, "은", "는") + " 초기이격거리·방호활동거리 "
      + "<b>자료가 없습니다.</b></p>";
  }

  /* 거리 요약 — 고른 조건에서 읽은 값 */
  if (z && !need.length && st.inf.any) {
    var cond = [st.size ? SIZE_KO[st.size] : "", st.v,
                st.inf.hasDN && z.pad && z.pad.kind === "dn" ? (isNight() ? "밤" : "낮") : ""]
      .filter(Boolean).join(" · ");
    html += '<div class="sf-zone">'
      + '<span class="zi iso"><i></i>초기이격 <b>' + (z.iso ? fmtDist(z.iso.m) : "자료에 없음") + "</b></span>"
      /* '풍하' 같은 말은 붙이지 않습니다 — 어렵다는 지적(2026-11-09 사용자).
         어느 쪽으로 퍼지는지는 표 아래 설명과 지도의 화살표가 말합니다. */
      + '<span class="zi pad"><i></i>방호활동 <b>' + (z.pad ? padLabel(z.pad) : "자료에 없음") + "</b></span>"
      + (cond ? '<span class="zc">' + esc(cond) + "</span>" : "")
      + "</div>";
    if (z.pad && z.pad.kind !== "ring" && st.wind === "")
      html += '<p class="sf-wnote">' + nb("바람 방향을 고르면") + " " + nb("방호활동 구역이 그려지고")
        + " " + nb("그 안인지 알려 드립니다.") + "</p>";
  }

  /* 내 위치 · 누른 곳 */
  if (st.acc && z && !need.length && st.inf.any) {
    if (st.me) html += pointRow("내 위치", "me", judge(st.me, z), z);
    if (st.probe) html += pointRow("누른 곳", "probe", judge(st.probe, z), z, true);
  }

  html += '<div class="sf-acts">'
    + '<button type="button" class="sf-watch' + (st.watchId != null ? " on" : "") + '" id="btnWatch"'
    + ' aria-pressed="' + (st.watchId != null ? "true" : "false") + '">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"'
    + ' stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="8.4"/>'
    + '<path d="M12 1.4v3M12 19.6v3M1.4 12h3M19.6 12h3"/></svg>'
    + (st.watchId != null ? "내 위치 확인 끄기" : "내 위치 확인") + "</button>"
    + (st.acc && st.mat && !need.length
        ? '<span class="sf-tap">지도를 누르면 그 자리도 확인합니다</span>' : "")
    + "</div>";

  el.innerHTML = html;
  $("#btnWatch").onclick = toggleWatch;
  var px = $(".sf-pt .px", el);
  if (px) px.onclick = function () { st.probe = null; update(false); };
}

function pointRow(name, cls, r, z, closable) {
  var lv, txt;
  if (r.iso) { lv = "iso"; txt = "초기이격거리 안"; }
  else if (r.pad === "in") { lv = "pad"; txt = "방호활동 구역 안"; }
  else if (r.pad === "near") { lv = "near"; txt = "방호활동거리(" + padLabel(z.pad) + ")보다 가까움"; }
  else if (z.iso || z.pad) {
    lv = "out";
    txt = z.iso && z.pad ? "두 구역 밖" : (z.iso ? "초기이격거리 밖" : "방호활동 구역 밖");
  } else { lv = "out"; txt = "구역 정보 없음"; }

  /* 10m 안이면 방향이 뜻이 없습니다 — "사고지점에서 0m 북쪽" 으로 읽혔습니다 */
  var sub = [r.d < 10 ? "사고지점에서 10m 안" : "사고지점에서 " + fmtDist(r.d) + " " + dirName(r.b) + "쪽"];
  if (r.iso && z.iso) sub.push("초기이격 경계까지 " + fmtDist(Math.max(0, z.iso.m - r.d)));
  /* '구역 옆 경계' 만으로는 어느 구역인지 몰라 이름을 붙입니다 */
  if (r.pad === "in" && r.side != null) sub.push("방호활동 옆 경계까지 " + fmtDist(r.side));
  if (r.pad === "near") sub.push("바람 방향 모름");
  if (name === "내 위치" && st.me && st.me.stale) sub.push("신호 끊김 — 마지막으로 받은 자리");
  else if (name === "내 위치" && st.me && st.me.acc > 0) sub.push("위치 오차 ±" + fmtDist(st.me.acc));

  return '<div class="sf-pt ' + cls + " " + lv + '">'
    + '<b class="pk">' + name + "</b>"
    + '<span class="pv">' + esc(txt) + "</span>"
    /* 토막마다 묶어 둡니다 — "위치 / 오차 ±20m" 처럼 갈라지지 않게 */
    + '<span class="pd">' + sub.map(function (s) { return nb(esc(s)); }).join(" · ") + "</span>"
    + (closable ? '<button type="button" class="px" aria-label="누른 곳 지우기">×</button>' : "")
    + "</div>";
}

function accText() {
  if (!st.acc) return "";
  if (st.accName) return st.accName;
  var h = MC.sggAt(st.acc.lat, st.acc.lon);
  return h ? (h.sido + " " + (h.sgg && h.sgg !== "null" ? h.sgg : "")).trim() + " (대략)"
           : st.acc.lat + ", " + st.acc.lon;
}

/* ── 조건 칸 (규모 · 낮밤 · 구분 · 바람) ───────────────────────── */
function renderOpts() {
  var inf = st.inf;
  /* 규모 — 원문에 규모 구분이 있을 때만 묻습니다 */
  var needSize = !!(inf && inf.needSize);
  $$("#segSize button").forEach(function (b) {
    b.setAttribute("aria-pressed", String(st.size === b.dataset.v));
    b.disabled = !!inf && !needSize;
  });
  $("#segSize").classList.toggle("need", needSize && !st.size);
  $("#segSize").title = inf && !needSize ? "이 물질은 유출 규모 구분이 없습니다" : "";

  /* 낮·밤 */
  var night = isNight(), hasDN = !!(inf && inf.hasDN);
  $$("#segTime button").forEach(function (b) {
    b.setAttribute("aria-pressed", String((b.dataset.v === "night") === night));
    b.disabled = !!inf && !hasDN;
  });
  $("#segTime").title = inf && !hasDN ? "이 물질은 낮·밤 구분이 없습니다" : "";
  var tEl = $("#sfTime");
  var p = sunPoint(), s = ERG.sun(p.lat, p.lon, new Date());
  if (hasDN && s) {
    tEl.hidden = false;
    tEl.innerHTML = (st.time === "auto"
        ? "<b>" + (night ? "밤" : "낮") + "</b> · 일출 " + hhmm(s.rise) + " · 일몰 " + hhmm(s.set)
          + " 기준으로 저절로 정함(대략" + (st.acc ? "" : " · 사고지점을 정하면 그 자리 기준") + ")"
        : "<b>" + (night ? "밤" : "낮") + "</b> — 직접 고름 · "
          + '<button type="button" class="sf-auto" id="btnTimeAuto">일출·일몰로 다시 정하기</button>');
    var ba = $("#btnTimeAuto");
    if (ba) ba.onclick = function () { st.time = "auto"; renderOpts(); update(false); };
  } else tEl.hidden = true;

  /* 구분 */
  var vs = inf ? inf.variants : [];
  $("#sfVarRow").hidden = vs.length < 2;
  $("#segVar").innerHTML = vs.map(function (v) {
    return '<button type="button" data-v="' + esc(v) + '" aria-pressed="' + (st.v === v) + '">'
      + esc(v) + "</button>";
  }).join("");
  $("#segVar").classList.toggle("need", vs.length > 1 && !st.v);
  $$("#segVar button").forEach(function (b) {
    b.onclick = function () { st.v = b.dataset.v; renderOpts(); update(true); };
  });
}
function hhmm(d) {
  var h = d.getHours(), m = d.getMinutes();
  return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
}

/* ── 자세히 — 안전거리 표 · (접어 둔) 물질 정보 ──────────────────
   이 화면의 중심은 **현장 안전거리**입니다(2026-11-09 사용자 — "물질에 대한
   내용이 글로 나온 것은 필요할 때만 볼 수 있게 하고, 우리의 근본인 현장
   안전거리만 집중할 수 있게"). 그래서 늘 보이는 것은 거리 표 하나이고,
   물질정보의 글(거리 설명·증상·응급조치)은 「물질 정보 더 보기」 한 곳에
   접어 둡니다. 화면에 '원문'이라는 말도 쓰지 않습니다(같은 날 사용자).

   ‼ 내 위치를 받을 때마다 다시 그리면 펼쳐 둔 것이 저절로 접힙니다(읽는
   중에 닫힘). 그래서 물질·조건이 바뀔 때만 다시 그리고, 펼침 상태는
   기억해 둡니다. */
var moreKey = "", moreOpen = false;
function renderMore() {
  var el = $("#sfMore");
  var m = st.mat;
  if (!m) { el.hidden = true; el.innerHTML = ""; moreKey = ""; return; }
  var key = [m.n, st.size, st.v, isNight()].join("|");
  if (key === moreKey && !el.hidden) return;
  moreKey = key;
  el.hidden = false;
  var h = "";

  /* 거리 표 — 지금 고른 칸을 짚어 둡니다 (같은 물질의 다른 조건도 한눈에) */
  if (st.inf && st.inf.any && (st.inf.variants.length < 2 || st.v)) {
    var night = isNight();
    var rows = [["s", "소규모"], ["l", "대규모"]].filter(function (x) {
      return st.inf.needSize || x[0] === "s";
    });
    /* 낮·밤이 있으면 머리를 두 줄로 — '방호활동 낮' 을 한 칸에 적었더니 좁은
       화면에서 "방호활동 / 낮" 으로 갈라졌습니다. 방호활동 아래에 낮·밤을 둡니다. */
    var head = st.inf.hasDN
      ? '<tr><th rowspan="2"></th><th rowspan="2">초기이격</th><th colspan="2">방호활동</th></tr>'
        + "<tr><th>낮</th><th>밤</th></tr>"
      : "<tr><th></th><th>초기이격</th><th>방호활동</th></tr>";
    var body = rows.map(function (x) {
      var dz = ERG.pick(st.inf, { size: x[0], v: st.v, night: false });
      var nz = ERG.pick(st.inf, { size: x[0], v: st.v, night: true });
      var on = !st.inf.needSize || st.size === x[0];
      var cell = function (val, hit) {
        return "<td" + (hit ? ' class="hit"' : "") + ">" + val + "</td>";
      };
      var rowName = st.inf.needSize ? x[1] : "모든 규모";
      if (st.inf.hasDN) {
        var dnp = dz.pad && dz.pad.kind === "dn";
        return "<tr><th>" + rowName + "</th>"
          + cell(dz.iso ? fmtDist(dz.iso.m) : "–", on)
          + cell(dnp ? padLabel(dz.pad) : (dz.pad ? padLabel(dz.pad) : "–"), on && (!night || !dnp))
          + cell(nz.pad && nz.pad.kind === "dn" ? padLabel(nz.pad) : "–", on && night && dnp)
          + "</tr>";
      }
      return "<tr><th>" + rowName + "</th>" + cell(dz.iso ? fmtDist(dz.iso.m) : "–", on)
        + cell(dz.pad ? padLabel(dz.pad) : "–", on) + "</tr>";
    }).join("");
    h += '<div class="sf-blk"><h2>안전거리 <i>' + esc(m.n) + (st.v ? " · " + esc(st.v) : "") + "</i></h2>"
      + '<table class="sf-tbl">' + head + body + "</table>"
      /* 읽는 법은 문장 대신 지도와 같은 색 표시 + 짧은 말로 —
         "방호활동은 바람이 불어가는 쪽 거리" 가 너무 어렵다는 지적(2026-11-09 사용자) */
      + '<ul class="sf-key">'
      + '<li><i class="iso"></i><b>초기이격</b>사고지점 둘레 모든 방향</li>'
      + '<li><i class="pad"></i><b>방호활동</b>바람 따라 퍼지는 쪽</li>'
      + '<li><i class="none"></i><b>–</b>자료 없음</li></ul></div>';
  }

  /* 물질 정보 — 필요할 때만 펼쳐 봅니다. 숫자를 어떻게 읽었는지 사람이
     대조할 수 있도록 물질정보의 글을 고치지 않고 그대로 싣습니다. */
  var dist = [["초기이격거리", m.d1], ["방호활동거리", m.d2], ["화재 시 대피거리", m.d3]];
  var aid = [["흡입 시 증상", m.sy], ["흡입 시 응급조치", m.e1],
             ["피부에 닿았을 때", m.e2], ["눈에 들어갔을 때", m.e3]];
  var dl = function (rows) {
    rows = rows.filter(function (x) { return x[1]; });
    return rows.length ? '<dl class="sf-raw">' + rows.map(function (x) {
      return "<dt>" + x[0] + "</dt><dd>" + esc(x[1]) + "</dd>";
    }).join("") + "</dl>" : "";
  };
  var distH = dl(dist), aidH = dl(aid);
  if (distH || aidH)
    h += '<details class="sf-blk sf-aid" id="sfInfo"' + (moreOpen ? " open" : "") + ">"
      /* 제목과 곁말을 따로 묶습니다 — 좁은 화면에서 "물질 정보 더 / 보기" 로
         갈라졌습니다. 곁말은 자리가 모자라면 통째로 아랫줄로 갑니다. */
      + "<summary><span>물질 정보 더 보기</span> <i>거리 설명 · 증상 · 응급조치</i></summary>"
      + (distH ? '<h3 class="sf-h3">거리 설명</h3>' + distH : "")
      + (aidH ? '<h3 class="sf-h3">증상 · 응급조치</h3>' + aidH : "")
      + '<p class="sf-src">' + esc(VERSION.물질정보_출처) + "</p></details>";

  el.innerHTML = h;
  var d = $("#sfInfo");
  if (d) d.addEventListener("toggle", function () { moreOpen = d.open; });
}

/* 이어 가기 — 단일 파일에는 이 줄이 없습니다(build_single.py 가 뺌) */
function renderNext() {
  var nav = $("#sfNext");
  if (!nav) return;
  nav.hidden = !st.mat;
  $("#goMap").hidden = !st.acc;
}

/* ① 대피장소 찾기로 — 사고지점·물질·바람을 들고 갑니다. 그 화면의
   '영향 참고 반경'에는 **초기이격거리**만 넘깁니다(전 방향 원이라
   그 화면의 원과 뜻이 같습니다). 방호활동 거리는 방향이 있는 구역이라
   원으로 넘기면 뜻이 달라집니다. */
function goMap() {
  if (!st.acc) return;
  var z = zones();
  var seed = { v: 1, from: "safe", ts: Date.now(), acc: { lat: st.acc.lat, lon: st.acc.lon },
               mat: st.mat ? st.mat.n : "", wind: st.wind,
               radius: z && z.iso ? z.iso.m : null };
  try { sessionStorage.setItem("nics.map.seed.v1", JSON.stringify(seed)); } catch (e) {}
  location.href = "../map/index.html";
}
function goSms() {
  if (!st.mat) return;
  var seed = { v: 1, from: "safe", ts: Date.now(), data: { 물질: st.mat.n } };
  if (st.acc) {
    seed.acc = { lat: st.acc.lat, lon: st.acc.lon };
    seed.근거 = "현장 안전거리 확인에서 정한 사고지점";
  }
  try { sessionStorage.setItem("nics.sms.seed.v1", JSON.stringify(seed)); } catch (e) {}
  location.href = "../sms/index.html";
}

/* ── 사고지점 ──────────────────────────────────────────────── */
function setMode(m) {
  st.mode = m;
  var b = $("#btnPick");
  b.setAttribute("aria-pressed", String(m === "acc"));
  b.textContent = m === "acc" ? "지도를 누르세요" : (st.acc ? "다시 찍기" : "지도에서 찍기");
  SVG.classList.toggle("crosshair", m === "acc");
}
function setAcc(lat, lon, name) {
  st.acc = { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 };
  st.accName = name || "";
  st.probe = null;
  setMode("pick");
  renderOpts();                         // 낮·밤이 그 자리의 일출·일몰로 바뀝니다
  update(true);
}

/* ── 내 위치 ──────────────────────────────────────────────────
   "내 위치 확인"은 끄기 전까지 계속 받습니다(watchPosition) — 걸어서
   옮기면 안/밖과 거리가 따라 바뀌어야 합니다. 인터넷이 없어도 됩니다. */
function geoOK() {
  if (!navigator.geolocation) { toast("<b>이 브라우저는 위치 찾기를 지원하지 않습니다.</b>", true); return false; }
  if (!window.isSecureContext && location.protocol !== "file:") {
    toast("<b>http:// 주소에서는 브라우저가 위치 사용을 막습니다.</b> https:// 주소로 열어 주세요.", true);
    return false;
  }
  return true;
}
var GEOMSG = { 1: "위치 사용을 허용하지 않았습니다. 브라우저 설정에서 허용해 주세요.",
               2: "위치를 알 수 없습니다. 실외에서 다시 시도해 주세요.",
               3: "위치를 받는 데 시간이 너무 걸렸습니다." };
var firstFix = true;
function toggleWatch() {
  if (st.watchId != null) {
    navigator.geolocation.clearWatch(st.watchId);
    st.watchId = null; st.me = null;
    toast("내 위치 확인을 껐습니다.");
    update(false);
    return;
  }
  if (!geoOK()) return;
  firstFix = true;
  toast("위치를 찾고 있습니다…");
  st.watchId = navigator.geolocation.watchPosition(function (p) {
    st.me = { lat: p.coords.latitude, lon: p.coords.longitude,
              acc: Math.round(p.coords.accuracy || 0) };
    if (firstFix) {
      firstFix = false;
      toast("<b>내 위치를 계속 확인합니다.</b> 움직이면 결과도 따라 바뀝니다."
        + (st.me.acc > 300 ? " 오차가 ±" + fmtDist(st.me.acc) + "로 큽니다(실내일 수 있음)." : ""),
        st.me.acc > 300);
      renderOpts();
      update(true);
    } else update(false);
  }, function (e) {
    /* 권한을 거부했을 때만 끕니다. 신호가 잠깐 끊긴 것(터널·건물 안 ·
       응답 늦음)으로 끄면, 현장에서 걷다가 확인이 통째로 꺼져 다시 눌러야
       합니다 — 브라우저는 오류 뒤에도 계속 위치를 받아 줍니다.
       그동안 화면의 '내 위치'는 **마지막으로 받은 자리**라고 적습니다. */
    if (e.code === 1 || !st.me) {
      if (st.watchId != null) navigator.geolocation.clearWatch(st.watchId);
      st.watchId = null; st.me = null;
      toast("<b>내 위치를 찾지 못했습니다.</b> " + (GEOMSG[e.code] || ""), true);
    } else {
      st.me.stale = true;
      toast("<b>위치 신호가 잠시 끊겼습니다.</b> 마지막으로 받은 자리를 보여 주며 계속 받고 있습니다.", true);
    }
    update(false);
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  renderStat();
}
function hereAsAcc() {
  if (!geoOK()) return;
  toast("위치를 찾고 있습니다…");
  MC.locate(function (r) {
    if (r.err) { toast("<b>내 위치를 찾지 못했습니다.</b> " + r.err, true); return; }
    if (st.watchId == null) st.me = r;
    setAcc(r.lat, r.lon, "내 위치에서 찍음");
    toast("<b>내 위치를 사고지점으로 찍었습니다.</b> 오차 약 ±" + fmtDist(r.acc)
      + " · 자리가 다르면 지도에서 다시 찍으세요.", r.acc > 300);
  });
}

/* ── 주소·장소 검색 ────────────────────────────────────────────
   ② 대피장소 찾기와 같은 색인입니다(시·군·구 · 읍·면·동 · 사업장 이름).
   우리 자료로 찾은 곳은 평균·주소 좌표라 **고른다고 사고지점이 찍히지
   않습니다** — 그 언저리로 옮긴 뒤 지도를 한 번 눌러 확정합니다(② 와 같음).
   인터넷 검색(브이월드)으로 찾은 건물은 좌표가 정확해 바로 찍습니다. */
var PLACE_IDX = null;
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
      if (any && sgg !== "null") {
        var c = MC.boundaryCenter(sido, sgg);
        out.push({ label: sido + " " + sgg, lat: c ? c.lat : rows[0][5], lon: c ? c.lon : rows[0][6],
                   kind: "sgg" });
      }
    });
  });
  Object.keys(dong).forEach(function (key) {
    var d = dong[key];
    out.push({ label: d.sido + " " + (d.sgg === "null" ? "" : d.sgg + " ") + d.nm,
               lat: d.sy / d.n, lon: d.sx / d.n, kind: "dong" });
  });
  (window.PLACES || []).forEach(function (b) {
    if (b.la == null || b.lo == null) return;
    out.push({ label: b.n + " · " + b.sd + " " + b.sg, lat: b.la, lon: b.lo, kind: "biz", name: b.n });
  });
  PLACE_IDX = out;
  return out;
}
/* 이 화면의 사고지점은 거의 사업장이라 사업장을 시·군·구 다음에 둡니다
   (② 는 대피장소가 본디 자료라 사업장을 맨 뒤에 둡니다). */
var KIND_ORDER = { sgg: 0, biz: 1, dong: 2 };
var KIND_LABEL = { sgg: "시·군·구", dong: "읍·면·동", biz: "사업장", poi: "장소", addr: "주소" };
function searchPlaces(q) {
  var nq = String(q || "").trim().replace(/\s+/g, "");
  if (!nq) return [];
  var rows = placeIndex().filter(function (p) { return p.label.replace(/\s+/g, "").indexOf(nq) >= 0; });
  rows.sort(function (a, b) {
    var an = a.label.replace(/\s+/g, ""), bn = b.label.replace(/\s+/g, "");
    var ra = an.indexOf(nq) === 0 ? 0 : 1, rb = bn.indexOf(nq) === 0 ? 0 : 1;
    return ra - rb || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || an.length - bn.length;
  });
  return rows.slice(0, 30);
}
var addrQ = "", addrRows = [], addrSel = -1;
var addrOn = { q: "", rows: [], busy: false, err: null }, addrTimer = null, addrSeq = 0;
function askOnline(q) {
  var t = String(q || "").trim();
  clearTimeout(addrTimer);
  addrSeq++;
  if (!window.ONLINE || t.length < 2) { addrOn = { q: t, rows: [], busy: false, err: null }; return; }
  addrOn = { q: t, rows: [], busy: true, err: null };
  var seq = addrSeq;
  addrTimer = setTimeout(function () {
    ONLINE.search(t, function (rows, err) {
      if (seq !== addrSeq) return;
      addrOn = { q: t, rows: rows || [], busy: false, err: err };
      if (!$("#addrPop").hidden) drawAddrPop();
    });
  }, 350);
}
function drawAddrPop() {
  var pop = $("#addrPop"), t = addrQ.trim();
  var net = addrOn.q === t ? addrOn.rows : [];
  var busy = addrOn.q === t && addrOn.busy;
  /* 같은 곳이 두 번 나오지 않게 — 이름+보조글이 같거나, 이름이 같고 25m 안 */
  var seen = {};
  addrRows = [];
  searchPlaces(addrQ).concat(net).forEach(function (r) {
    var k = String(r.label) + "|" + String(r.sub || "");
    if (seen[k]) return;
    for (var i = 0; i < addrRows.length; i++) {
      var o = addrRows[i];
      if (o.label === r.label && Math.abs(o.lat - r.lat) < 0.00025 && Math.abs(o.lon - r.lon) < 0.0003) return;
    }
    seen[k] = 1; addrRows.push(r);
  });
  addrSel = -1;
  if (!addrRows.length && !busy) {
    pop.innerHTML = '<div class="mpk-none">' + (t ? "‘" + esc(t) + "’" + josa(t, "과", "와") + " 맞는 곳이 없습니다."
      : "사업장 이름, 시·군·구, 읍·면·동으로 찾습니다.") + "</div>";
  } else {
    pop.innerHTML = '<div class="mpk-list">' + addrRows.map(function (p, i) {
        return '<div class="mpk-row" role="option" data-i="' + i + '"><span class="nm">' + esc(p.label)
          + (p.sub ? ' <i class="sub">' + esc(p.sub) + "</i>" : "") + '</span><span class="en">'
          + esc(KIND_LABEL[p.kind] || "") + "</span></div>";
      }).join("")
      + (busy ? '<div class="mpk-busy">인터넷에서 찾는 중…</div>' : "")
      + "</div>"
      + '<div class="mpk-ft">' + (net.length ? "장소·주소를 고르면 그 자리를 사고지점으로 찍습니다"
          : "고르면 그 언저리로 이동합니다 · 정확한 사고지점은 지도를 눌러 찍으세요") + "</div>";
    $$(".mpk-row", pop).forEach(function (el) {
      el.onclick = function () { pickAddr(addrRows[+el.dataset.i]); };
    });
  }
  pop.hidden = false;
  placePopover(pop, $("#sfAddr"), true);
}
function closeAddrPop() { $("#addrPop").hidden = true; addrSel = -1; }
function pickAddr(p) {
  closeAddrPop();
  $("#sfAddr").value = p.label;
  if (p.exact) {
    setAcc(p.lat, p.lon, p.label);
    toast("<b>‘" + esc(p.label) + "’" + josa(p.label, "을", "를") + " 사고지점으로 찍었습니다.</b> 자리가 다르면 지도에서 다시 찍으세요.");
    return;
  }
  if (!st.view) fit();
  CAM.animateTo({ cx: wx(p.lon), cy: wy(p.lat), w: mToWorld(p.kind === "sgg" ? 9000 : 1500, p.lat) }, 420);
  pendingName = p.kind === "biz" ? p.name : "";
  setMode("acc");
  toast("<b>그 언저리로 옮겼습니다.</b> 정확한 사고지점을 지도에서 눌러 찍으세요.");
}
var pendingName = "";            // 사업장으로 찾아 옮긴 뒤 찍으면 그 이름을 붙입니다
function placePopover(pop, anchor, grow) {
  var r = anchor.getBoundingClientRect();
  var w = grow ? Math.max(r.width, 300) : pop.offsetWidth;
  pop.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - w - 8))) + "px";
  pop.style.top = Math.round(r.bottom + 6) + "px";
  if (grow) pop.style.width = Math.min(w, window.innerWidth - 16) + "px";
}
function bindAddr() {
  var input = $("#sfAddr"), pop = $("#addrPop");
  input.oninput = function () { addrQ = input.value; askOnline(addrQ); drawAddrPop(); };
  input.onfocus = function () { if (input.value.trim()) { addrQ = input.value; drawAddrPop(); } };
  input.onkeydown = function (e) {
    if (pop.hidden) return;
    var els = $$(".mpk-row", pop);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (addrSel >= 0 && els[addrSel]) els[addrSel].classList.remove("on");
      addrSel = Math.max(0, Math.min(els.length - 1, addrSel + (e.key === "ArrowDown" ? 1 : -1)));
      if (els[addrSel]) { els[addrSel].classList.add("on"); els[addrSel].scrollIntoView({ block: "nearest" }); }
    } else if (e.key === "Enter" && addrSel >= 0) { e.preventDefault(); pickAddr(addrRows[addrSel]); }
    else if (e.key === "Escape") closeAddrPop();
  };
  document.addEventListener("mousedown", function (e) {
    if (!pop.hidden && e.target !== input && !pop.contains(e.target)) closeAddrPop();
  });
}

/* ── 바람 (나침반) — ② 와 같은 창 ───────────────────────────── */
var WIND_DIRS = [
  { deg: 0, ko: "북" }, { deg: 45, ko: "북동" }, { deg: 90, ko: "동" }, { deg: 135, ko: "남동" },
  { deg: 180, ko: "남" }, { deg: 225, ko: "남서" }, { deg: 270, ko: "서" }, { deg: 315, ko: "북서" }
];
function windKo(deg) { return WIND_DIRS.filter(function (d) { return d.deg === +deg; })[0].ko; }
function buildWindPop() {
  $("#windPop").innerHTML =
    '<div class="windpop-hd">바람이 <b>불어오는 쪽</b>을 고르세요</div>'
    + '<div class="windrose"><div class="wr-ring"></div><div class="wr-arrow" id="wrArrow" hidden></div>'
    + '<div class="wr-hub"></div>'
    + WIND_DIRS.map(function (d) {
        var rad = d.deg * Math.PI / 180;
        return '<button type="button" class="wr-b" data-deg="' + d.deg + '" style="left:'
          + (50 + Math.sin(rad) * 38).toFixed(1) + "%;top:" + (50 - Math.cos(rad) * 38).toFixed(1)
          + '%" aria-pressed="false" title="' + d.ko + "풍 — " + d.ko + '쪽에서 불어옴">' + d.ko + "</button>";
      }).join("")
    + "</div>"
    + '<div class="wr-cap" id="wrCap"></div>'
    + '<button type="button" class="sm windpop-clear" id="windClear">모름 / 표시 안 함</button>';
  $$("#windPop .wr-b").forEach(function (b) { b.onclick = function () { setWind(b.dataset.deg); }; });
  $("#windClear").onclick = function () { setWind(""); };
}
function updateWindUI() {
  var has = st.wind !== "";
  $("#windBtn").classList.toggle("on", has);
  $("#windBtnTxt").textContent = has ? windKo(st.wind) + "풍" : "고르기";
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
  $("#windPop").hidden = true;
  $("#windBtn").setAttribute("aria-expanded", "false");
  update(true);
}
function bindWind() {
  buildWindPop(); updateWindUI();
  $("#windBtn").onclick = function () {
    var pop = $("#windPop");
    pop.hidden = !pop.hidden;
    $("#windBtn").setAttribute("aria-expanded", String(!pop.hidden));
    if (!pop.hidden) placePopover(pop, $("#windBtn"));
  };
  document.addEventListener("mousedown", function (e) {
    var pop = $("#windPop"), btn = $("#windBtn");
    if (!pop.hidden && !btn.contains(e.target) && !pop.contains(e.target)) {
      pop.hidden = true; btn.setAttribute("aria-expanded", "false");
    }
  });
}

/* ── 지도 ──────────────────────────────────────────────────── */
function svgSize() {
  var r = SVG.getBoundingClientRect();
  return { w: r.width || 390, h: r.height || 420 };
}
function viewBox() {
  var s = svgSize(), w = st.view.w, h = w * (s.h / s.w);
  return { x: st.view.cx - w / 2, y: st.view.cy - h / 2, w: w, h: h, sw: s.w, sh: s.h };
}
function pX(lon) { return (wx(lon) - VB.x) / VB.w * VB.sw; }
function pY(lat) { return (wy(lat) - VB.y) / VB.h * VB.sh; }
function pxLen(m, lat) { return mToWorld(m, lat) / VB.w * VB.sw; }
function toLL(cx, cy) {
  var r = SVG.getBoundingClientRect();
  return { lon: wxInv(VB.x + (cx - r.left) / r.width * VB.w),
           lat: wyInv(VB.y + (cy - r.top) / r.height * VB.h) };
}
/* 방위 deg 로 L 만큼 간 화면 좌표 (북=0, 화면 y 는 아래로) */
function ray(x, y, deg, L) {
  var a = deg * Math.PI / 180;
  return { x: x + Math.sin(a) * L, y: y - Math.cos(a) * L };
}
function P(p) { return p.x.toFixed(1) + " " + p.y.toFixed(1); }

/* 그릴 수 있는 구역 — 사람이 고를 것이 남았으면 그리지 않습니다 */
function drawable() {
  if (!st.acc || !st.inf || !st.inf.any || needs().length) return null;
  return zones();
}

/* 구역·사고지점·내 위치·누른 곳이 다 들어오는 시야 */
function fitTarget() {
  var m = 2, M = -1, n = 2, N = -1, any = false;
  var add = function (x, y) { m = Math.min(m, x); M = Math.max(M, x); n = Math.min(n, y); N = Math.max(N, y); any = true; };
  var sz = svgSize(), ratio = sz.w / Math.max(1, sz.h), asp = Math.min(1.35, ratio);
  if (st.acc) {
    var z = drawable();
    var reach = Math.max(z && z.iso ? z.iso.m : 0, z && z.pad ? z.pad.m : 0) || 600;
    var ax = wx(st.acc.lon), ay = wy(st.acc.lat), r = mToWorld(reach, st.acc.lat);
    if (z && z.pad && z.pad.kind !== "ring" && st.wind !== "") {
      /* 방호활동 구역이 바람 쪽으로 뻗어 있으니 그쪽을 담습니다 */
      var down = ((+st.wind + 180) % 360) * Math.PI / 180;
      var ux = Math.sin(down), uy = -Math.cos(down), half = r / 2;
      [[0, 0], [r, half], [r, -half], [0, half], [0, -half]].forEach(function (c) {
        add(ax + ux * c[0] - uy * c[1], ay + uy * c[0] + ux * c[1]);
      });
      var ri = z.iso ? mToWorld(z.iso.m, st.acc.lat) : 0;
      add(ax - ri, ay - ri); add(ax + ri, ay + ri);
    } else { add(ax - r, ay - r); add(ax + r, ay + r); }
    /* 내 위치·누른 곳은 구역 언저리에 있을 때만 시야에 넣습니다 — 수백 km
       떨어진 사무실에서 켜 두면 구역이 점 하나로 쪼그라듭니다. */
    [st.me, st.probe].forEach(function (p) {
      if (p && distM(st.acc.lat, st.acc.lon, p.lat, p.lon) <= reach * 3) add(wx(p.lon), wy(p.lat));
    });
  } else if (st.me) {
    var rm = mToWorld(1500, st.me.lat);
    add(wx(st.me.lon) - rm, wy(st.me.lat) - rm); add(wx(st.me.lon) + rm, wy(st.me.lat) + rm);
  }
  if (!any) {
    var x0 = wx(124.6), x1 = wx(131.0), y0 = wy(38.7), y1 = wy(33.1);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
             w: Math.max((x1 - x0) * 1.08, (y1 - y0) * 1.08 * ratio) };
  }
  return { cx: (m + M) / 2, cy: (n + N) / 2,
           w: Math.max((M - m) * 1.2, (N - n) * 1.2 * asp, 0.00004) };
}
function fit() {
  var t = fitTarget();
  if (!st.view) { st.view = t; draw(); return; }
  CAM.animateTo(t, 420);
}

function draw() {
  if (!st.view) { st.view = fitTarget(); }
  VB = viewBox();
  var vb = VB, g = [];
  g.push('<rect x="0" y="0" width="' + vb.sw + '" height="' + vb.sh + '" class="bg"/>');
  var tl = MC.tiles.layer(vb);
  g.push(tl);
  SVG.classList.toggle("hasbg", !!tl);
  g.push('<g class="bds">' + MC.boundaryPaths(vb, function () { return false; }) + "</g>");

  var z = drawable(), acc = st.acc, ax = 0, ay = 0;
  if (acc) { ax = pX(acc.lon); ay = pY(acc.lat); }

  if (acc && z) {
    /* 방호활동 — 바람을 알면 풍하 정사각형, 모르면 점선 원(거리만) */
    if (z.pad) {
      var L = pxLen(z.pad.m, acc.lat), lab;
      if (z.pad.kind === "ring") {
        g.push('<circle class="zpad" cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="' + L.toFixed(1) + '"/>');
        lab = { x: ax, y: ay + L - 8 };
      } else if (st.wind !== "") {
        var down = (+st.wind + 180) % 360;
        var a1 = ray(ax, ay, down - 90, L / 2), a2 = ray(ax, ay, down + 90, L / 2);
        var b1 = ray(a1.x, a1.y, down, L), b2 = ray(a2.x, a2.y, down, L);
        g.push('<path class="zpad" d="M' + P(a1) + "L" + P(b1) + "L" + P(b2) + "L" + P(a2) + 'Z"/>');
        lab = ray(ax, ay, down, L * 0.62);
        /* 바람 화살표 — 사고지점에서 불어가는 쪽으로 */
        var h0 = ray(ax, ay, down, Math.min(L * 0.25, 70) + 16), h1 = ray(ax, ay, down, Math.min(L * 0.25, 70) + 52);
        var w1 = ray(h1.x, h1.y, down + 150, 10), w2 = ray(h1.x, h1.y, down - 150, 10);
        g.push('<path class="zwind" d="M' + P(h0) + "L" + P(h1) + "M" + P(w1) + "L" + P(h1) + "L" + P(w2) + '"/>');
      } else {
        g.push('<circle class="zpad nodir" cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="' + L.toFixed(1) + '"/>');
        lab = { x: ax, y: ay + L - 8 };
      }
      g.push('<text class="zlbl pad" x="' + lab.x.toFixed(1) + '" y="' + lab.y.toFixed(1) + '" font-size="12.5">'
        + "방호활동 " + esc(padLabel(z.pad)) + (z.pad.kind !== "ring" && st.wind === "" ? " · 바람 방향 모름" : "")
        + "</text>");
    }
    /* 초기이격 — 사고지점 둘레 원 */
    if (z.iso) {
      var R = pxLen(z.iso.m, acc.lat);
      g.push('<circle class="ziso" cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="' + R.toFixed(1) + '"/>');
      g.push('<text class="zlbl iso" x="' + ax.toFixed(1) + '" y="' + (ay - Math.max(R, 22) - 6).toFixed(1)
        + '" font-size="12.5">초기이격 ' + fmtDist(z.iso.m) + "</text>");
    }
  }

  /* 누른 곳 — 사고지점과 잇는 가는 선 + 작은 점 */
  if (acc && st.probe) {
    var qx = pX(st.probe.lon), qy = pY(st.probe.lat);
    g.push('<line class="zlink" x1="' + ax.toFixed(1) + '" y1="' + ay.toFixed(1) + '" x2="' + qx.toFixed(1)
      + '" y2="' + qy.toFixed(1) + '"/>');
    g.push('<circle class="zprobe" cx="' + qx.toFixed(1) + '" cy="' + qy.toFixed(1) + '" r="7"/>');
    g.push('<text class="zlbl probe" x="' + qx.toFixed(1) + '" y="' + (qy - 13).toFixed(1) + '" font-size="12">누른 곳 '
      + fmtDist(distM(acc.lat, acc.lon, st.probe.lat, st.probe.lon)) + "</text>");
  }

  /* 내 위치가 사고지점 바로 위(30px 안)면 두 이름표가 겹쳐 둘 다 안 읽혔습니다
     ('내 위치로 찍기' 를 누르면 늘 그렇습니다). 그때는 한 줄로 함께 적습니다. */
  var meOnAcc = !!(acc && st.me) && Math.sqrt(Math.pow(pX(st.me.lon) - ax, 2) + Math.pow(pY(st.me.lat) - ay, 2)) < 30;

  /* 사고지점 — 십자 */
  if (acc) {
    var K = 13;
    g.push('<line class="acc" x1="' + (ax - K).toFixed(1) + '" y1="' + ay.toFixed(1) + '" x2="' + (ax + K).toFixed(1)
      + '" y2="' + ay.toFixed(1) + '"/><line class="acc" x1="' + ax.toFixed(1) + '" y1="' + (ay - K).toFixed(1)
      + '" x2="' + ax.toFixed(1) + '" y2="' + (ay + K).toFixed(1) + '"/>');
    g.push('<circle class="accdot" cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="6"/>');
    g.push('<text class="acclbl" x="' + ax.toFixed(1) + '" y="' + (ay + K + 16).toFixed(1) + '" font-size="12">'
      + (meOnAcc ? "사고지점 · 내 위치" : "사고지점") + "</text>");
  }

  /* 내 위치 — 맨 나중에(무엇에도 가리지 않게). 오차 범위도 함께 */
  if (st.me) {
    var mx = pX(st.me.lon), my = pY(st.me.lat);
    if (st.me.acc > 0) {
      var ar = pxLen(st.me.acc, st.me.lat);
      if (ar > 6) g.push('<circle class="meacc" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1)
        + '" r="' + Math.min(ar, vb.sw).toFixed(1) + '"/>');
    }
    g.push('<circle class="mepulse" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="19"/>');
    g.push('<circle class="me" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="6.6"/>');
    if (!meOnAcc)
      g.push('<text class="melbl" x="' + mx.toFixed(1) + '" y="' + (my + 21).toFixed(1) + '" font-size="11.5">내 위치</text>');
  }

  SVG.setAttribute("viewBox", "0 0 " + vb.sw + " " + vb.sh);
  SVG.innerHTML = g.join("");
  var s = MC.scale(vb);
  $("#scaleBar").style.width = s.px + "px";
  $("#scaleTxt").textContent = s.label;
}

function renderLegend() {
  var z = drawable(), it = [];
  if (st.acc) it.push('<span><i class="dot ac"></i>사고지점</span>');
  if (z && z.iso) it.push('<span><i class="zk iso"></i>초기이격</span>');
  if (z && z.pad) it.push('<span><i class="zk pad' + (z.pad.kind !== "ring" && st.wind === "" ? " nodir" : "")
    + '"></i>방호활동</span>');
  if (st.me) it.push('<span><i class="dot me"></i>내 위치</span>');
  var el = $("#mLeg");
  el.innerHTML = it.join("");
  el.hidden = !it.length;
}

/* ── 한 번에 다시 그리기 ────────────────────────────────────── */
function update(refit) {
  renderStat(); renderMore(); renderNext(); renderLegend();
  if (refit) fit(); else draw();
}

var toastTimer = null;
function toast(msg, isErr) {
  var el = $("#mToast");
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  if (!msg) { el.hidden = true; return; }
  el.hidden = false;
  el.className = "mtoast noprint" + (isErr ? " err" : "");
  el.innerHTML = msg;
  toastTimer = setTimeout(function () { el.hidden = true; toastTimer = null; }, isErr ? 11000 : 5000);
}

function bindMap() {
  MC.panzoom(SVG, {
    view: function () { return st.view; },
    vb: function () { return VB; },
    draw: draw,
    camStop: CAM.stop,
    onTap: function (x, y) {
      var ll = toLL(x, y);
      if (st.mode === "acc" || !st.acc) {
        setAcc(ll.lat, ll.lon, pendingName);
        pendingName = "";
        return;
      }
      st.probe = { lat: ll.lat, lon: ll.lon };
      update(false);
    }
  });
  $("#zIn").onclick = function () { CAM.animateTo({ cx: st.view.cx, cy: st.view.cy, w: st.view.w * 0.7 }, 260); };
  $("#zOut").onclick = function () { CAM.animateTo({ cx: st.view.cx, cy: st.view.cy, w: Math.min(1.2, st.view.w * 1.42) }, 260); };
  $("#zFit").onclick = fit;
  window.addEventListener("resize", function () { if (st.view) draw(); });
  /* 아이폰 사파리는 주소창이 접힐 때 resize 를 주지 않습니다(② 와 같은 이유) */
  if (window.ResizeObserver) {
    var 칸 = SVG.parentNode, 지난 = 0;
    new ResizeObserver(function () {
      var h = Math.round(칸.getBoundingClientRect().height);
      if (h && Math.abs(h - 지난) > 2) { 지난 = h; if (st.view) draw(); }
    }).observe(칸);
  }
}

function initSrc() {
  $("#ver").innerHTML =
    "<p><b>거리</b> — " + esc(VERSION.물질정보_출처) + "에 적힌 초기이격거리·방호활동거리를 "
    + "읽어 그렸습니다. 자료에 없는 조합(예: 대규모 초기이격거리가 없는 물질)은 "
    + "<b>자료에 없음</b>으로 적고 그리지 않습니다. 화면 아래 ‘물질 정보 더 보기’에서 "
    + "물질정보의 글과 대조할 수 있습니다.</p>"
    + "<p><b>초기이격</b> — 사고지점을 가운데 둔 원입니다.</p>"
    + "<p><b>방호활동</b> — 사고지점에서 바람 따라 퍼지는 쪽으로 그 거리만큼, 폭도 같은 "
    + "정사각형으로 그립니다. 바람 방향을 고르지 않으면 방향을 정할 수 없어 같은 거리의 "
    + "점선 원으로 거리만 보여 줍니다.</p>"
    + "<p><b>낮·밤</b> — 사고지점의 일출·일몰을 날짜로 계산해 저절로 고릅니다(근사식이라 "
    + "몇 분 어긋날 수 있습니다). 단추로 바꿀 수 있습니다.</p>"
    + "<p><b>유출 규모·구분</b> — 현장이 정하는 것이라 도구가 미리 고르지 않습니다.</p>"
    + "<p><b>내 위치</b> — 이 기기의 위치 기능을 씁니다(인터넷이 없어도 됩니다). "
    + "위치는 이 화면 밖으로 보내지 않습니다. 실내에서는 오차가 커질 수 있습니다.</p>"
    + "<p><b>배경지도</b> — " + esc(VERSION.배경지도) + ". 인터넷이 되는 환경에서만 표시됩니다.</p>"
    + "<p><b>행정경계</b> — " + esc(VERSION.경계_출처) + ". 위치를 가늠하기 위한 배경선입니다.</p>"
    + "<p class=\"src\">도구 버전 " + esc(VERSION.도구버전) + " · 반영일 " + esc(VERSION.반영일) + "</p>";
  var open = function () { $("#srcModal").hidden = false; document.body.style.overflow = "hidden"; };
  var close = function () { $("#srcModal").hidden = true; document.body.style.overflow = ""; };
  $("#btnSrc").onclick = open;
  $("#btnSrcClose").onclick = close;
  $("#srcModal").onclick = function (e) { if (e.target.id === "srcModal") close(); };
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!$("#srcModal").hidden) close();
    else if (!$("#windPop").hidden) { $("#windPop").hidden = true; $("#windBtn").setAttribute("aria-expanded", "false"); }
    else if (!$("#addrPop").hidden) closeAddrPop();
    else if (st.mode === "acc") setMode("pick");
  });
}

function init() {
  SVG = $("#map");
  initSrc();
  bindMap();
  bindWind();
  bindAddr();

  $("#sfMat").oninput = function () { setMat(this.value); };
  if ($("#goMap")) { $("#goMap").onclick = goMap; $("#goSms").onclick = goSms; }
  $$("#segSize button").forEach(function (b) {
    b.onclick = function () { st.size = b.dataset.v; renderOpts(); update(true); };
  });
  $$("#segTime button").forEach(function (b) {
    b.onclick = function () { st.time = b.dataset.v; renderOpts(); update(true); };
  });
  $("#btnPick").onclick = function () { setMode(st.mode === "acc" ? "pick" : "acc"); };
  $("#btnHereAcc").onclick = hereAsAcc;
  $("#btnClear").onclick = function () {
    if (st.watchId != null) navigator.geolocation.clearWatch(st.watchId);
    st.mat = null; st.inf = null; st.size = ""; st.v = ""; st.time = "auto"; st.wind = "";
    st.acc = null; st.accName = ""; st.me = null; st.watchId = null; st.probe = null;
    pendingName = "";
    $("#sfMat").value = ""; $("#sfAddr").value = "";
    updateWindUI(); renderOpts(); setMode("pick"); toast("");
    update(true);
  };

  setMode("pick");
  renderOpts();
  update(true);
}

document.addEventListener("DOMContentLoaded", init);
})();
