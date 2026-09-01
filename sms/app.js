/* 화학사고 주민대피 문자생성기 — 로직
   외부 라이브러리·네트워크 호출 없음. 입력값은 브라우저 밖으로 나가지 않습니다. */
(function () {
"use strict";

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
};

/* 글자수 — 코드포인트 단위(공백·문장부호 포함).
   실제 재난문자방송시스템의 산정 방식과 대조 후 확정해야 합니다. */
function count(s) { return Array.from(String(s)).length; }

/* 발송 구분 3개를 고르는 첫 화면 버튼 그림 — 진입화면(portal.css) 패널의
   손그림 느낌을 밝은 화면에 맞게 가져온 것. 장식일 뿐 정보를 담지 않으므로
   aria-hidden 으로 숨긴다. */
var STAGE_ICONS = {
  indoor:
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M10 29 32 12l22 17" stroke-width="3.4"/>'
    + '<path d="M15.5 26v27h33V26" stroke-width="3.4"/>'
    + '<rect x="27" y="35.5" width="10" height="17.5" rx="1.6" stroke-width="2.8"/>'
    + '<path d="M41 8.5a12 12 0 0 1 5 9" stroke-width="2.6" opacity=".55"/>'
    + '<path d="M47.5 4a18.5 18.5 0 0 1 7.5 14.5" stroke-width="2.4" opacity=".32"/>'
    + '</svg>',
  detour:
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M8 49c10.5 0 14.5-4 20-14s9.5-14 20-14" stroke-width="4.6"/>'
    + '<path d="M39.5 12.5l9 8.5-9 8.5" stroke-width="3.6"/>'
    + '<path d="M12 56h9M12 56v-7" stroke-width="2.6" opacity=".5"/>'
    + '</svg>',
  evac:
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M32 55S18 41 18 30a14 14 0 1 1 28 0c0 11-14 25-14 25z" stroke-width="3.2"/>'
    + '<circle cx="32" cy="29.5" r="5.6" stroke-width="2.8"/>'
    + '<path d="M8 12.5l7 7M56 12.5l-7 7M8 47.5l7-7M56 47.5l-7-7" stroke-width="2.6" opacity=".5"/>'
    + '</svg>'
};

var SESS = "nics.sms.draft.v1";
/* openGrp — 접힌 문안 그룹 중 펼쳐 둔 것. 입력할 때마다 문안을 다시 그리므로
   열어 둔 상태를 state 에 둬야 글자 한 자 칠 때마다 닫히지 않습니다. */
function blankState() {
  /* cat — 하위 분류를 둔 구분에서 고른 것 {구분id: 분류id}.
     지금은 도로 우회 알림만 씁니다(사고지역이 실내대피 중인가 대피명령 중인가). */
  return { stage: null, cat: {}, type: "누출", data: {},
           unknownMat: false, use71: false, openGrp: {},
           /* step — 지금 몇 걸음째인가(걸음 id). 새로 고쳐도 그 자리에서 잇는다 */
           step: null,
           /* acc — ② 지도에서 찍어 넘어온 사고지점 좌표. '지도에서 찾기'를
              그 자리에서 열려고 들고 있습니다(문안에는 쓰지 않습니다). */
           acc: null };
}
var state = blankState();

/* ── 상태 저장 (sessionStorage: 브라우저를 닫으면 사라짐) ───────── */
function save() {
  try { sessionStorage.setItem(SESS, JSON.stringify(state)); } catch (e) {}
}
function load() {
  try {
    var r = sessionStorage.getItem(SESS);
    if (!r) return false;
    var o = JSON.parse(r);
    if (o && o.data) {
      state = o;
      if (!state.openGrp) state.openGrp = {};
      if (!state.cat) state.cat = {};        // 하위 분류가 생기기 전 세션
      /* 발송 구분이 개편되기 전에 저장된 세션이면 구분만 비운다.
         (없어진 구분 id 가 남아 있으면 화면 조립이 실패한다) */
      if (state.stage && !STAGES.some(function (s) { return s.id === state.stage; }))
        state.stage = null;
      return true;
    }
  } catch (e) {}
  return false;
}

/* ══ 주민 대피장소 찾기에서 넘어온 값 받기 ════════════════════════
   ② 주민 대피장소 찾기에서 사고지점을 찍고 대피장소를 확인한 뒤 "이 내용으로
   문자 만들기"를 누르면, 그 값이 sessionStorage 에 담겨 이 화면으로
   넘어옵니다(map/app.js 의 goToSms). 같은 내용을 두 번 입력하지 않게
   하려는 것입니다.

   ── 받은 값을 어떻게 다루는가 ────────────────────────────
   덮어씁니다. 지도에서 방금 정하고 온 값이 이 화면에 남아 있던 값보다
   최신이기 때문입니다. 대신 무엇이 채워졌는지 화면에 그대로 적어 둡니다 —
   모르는 사이에 값이 바뀌어 있으면 그게 더 위험합니다.

   발송 구분은 고르지 않습니다. 어느 문안을 보낼지는 지시받아 정하는
   것이지 지도가 정할 수 있는 것이 아닙니다.
   ═══════════════════════════════════════════════════════════ */
var SEED = "nics.sms.seed.v1";
var seedInfo = null;                 // 이번에 넘어온 것 (안내 표시용)

function takeSeed() {
  var raw = null;
  try {
    raw = sessionStorage.getItem(SEED);
    sessionStorage.removeItem(SEED);   // 한 번만 쓴다 — 새로고침해도 다시 덮지 않게
  } catch (e) { return; }
  if (!raw) return;
  var o;
  try { o = JSON.parse(raw); } catch (e) { return; }
  if (!o || o.v !== 1 || !o.data) return;

  var filled = [];
  Object.keys(o.data).forEach(function (k) {
    var v = String(o.data[k] == null ? "" : o.data[k]).trim();
    if (!v) return;
    state.data[k] = v;
    filled.push(k);
  });
  if (!filled.length) return;
  seedInfo = { keys: filled, acc: o.acc || null, 어림: !!o.어림 };
  /* 좌표는 state 에 남긴다 — 6걸음(대피장소)에서 '지도에서 찾기'를 누를 때
     이 자리에서 열어 주려는 것이다. 알림 띠를 닫거나 새로고침해도 남아야
     하므로 seedInfo 가 아니라 state 에 둔다. */
  if (o.acc && o.acc.lat != null && o.acc.lon != null) {
    state.acc = { lat: +o.acc.lat, lon: +o.acc.lon, 어림: !!o.어림,
                  근거: "주민 대피장소 찾기에서 찍은 사고지점" };
  }
  save();
}

/* '지도에서 찾기' 를 열 때 어느 자리를 보여 줄까.
   ② 지도에서 찍어 넘어온 좌표가 가장 정확하다. 없으면 앞 걸음에 적은
   시·군·구·읍·면·동으로 어림잡는다(assets/mapcore.js 의 placeAt).
   둘 다 없으면 null — 그러면 지금까지처럼 시·군·구 관내를 보여 준다. */
function accPoint() {
  var sgg = String(state.data["시군"] || "").trim();
  var emd = String(state.data["읍면동"] || "").trim();

  /* 지도에서 들고 온 좌표는 그 사이 사용자가 시·군·구를 다른 곳으로 고쳤을
     수 있다. 그때는 옛 좌표를 쓰면 엉뚱한 데가 열리므로 버린다. */
  var a = state.acc;
  if (a && a.lat != null && a.lon != null) {
    var at = window.MAPCORE && MAPCORE.sggAt ? MAPCORE.sggAt(a.lat, a.lon) : null;
    if (!sgg || !at || MAPCORE.matchSgg(at.sgg, sgg)) return a;
  }
  if (!sgg || !window.MAPCORE || !MAPCORE.placeAt) return null;
  return MAPCORE.placeAt(sgg, emd);
}

/* 무엇이 어디서 넘어왔는지 화면에 적는다 */
function renderSeedBar() {
  var el = $("#seedBar");
  if (!el) return;
  el.hidden = !seedInfo;
  if (!seedInfo) return;
  var names = { 시군: "사고 시·군·구", 읍면동: "사고 읍·면·동",
                사업장: "사업장·장소명", 대피소: "대피소" };
  el.innerHTML = '<div class="wrap"><span class="sb-t">'
    + "<b>주민 대피장소 찾기에서 넘어왔습니다.</b> "
    + seedInfo.keys.map(function (k) {
        return '<i><em>' + esc(names[k] || k) + "</em>" + esc(state.data[k]) + "</i>";
      }).join("")
    /* 지도가 인터넷으로 주소를 확인하지 못하고 행정경계·가까운 대피장소로
       어림잡았다면 그 사실을 적는다 — 발송 전에 한 번 더 보게 하려는 것이다. */
    + (seedInfo.어림
        ? '<span class="sb-warn">사고지점 주소를 인터넷으로 확인하지 못해 '
          + "행정경계와 가까운 대피장소 주소로 어림잡았습니다. 보내기 전에 "
          + "시·군·구와 읍·면·동이 맞는지 확인하세요.</span>"
        : "")
    + "</span>"
    + '<button type="button" class="seed-x" id="seedX" aria-label="이 알림 닫기">✕</button>'
    + "</div>";
  $("#seedX").onclick = function () { seedInfo = null; renderSeedBar(); };
}

/* ── 문안 조립 ─────────────────────────────────────────────── */

function matValue() {
  return state.unknownMat ? "화학물질" : (state.data["물질"] || "");
}

/* 값 조회 — 사고 시·군이 발송기관과 같으면 문구에서 생략(글자수 절약) */
function val(k) {
  if (k === "물질") return matValue();
  if (k === "시군") {
    var g = String(state.data["기관"] || "").trim();
    var s = String(state.data["시군"] || "").trim();
    if (s && g && s === g) return "";
    return s;
  }
  var v = state.data[k];
  return (v === undefined) ? undefined : v;
}

/* ── 한글 조사 자동 선택 ──────────────────────────────────────
   {키:이/가}  값 + 조사      {~키:으로/로}  조사만
   받침 있으면 앞의 것, 없으면 뒤의 것. '으로/로'는 ㄹ 받침도 뒤의 것. */
function jongOf(ch) {
  var c = String(ch).charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28;      // 0 = 받침 없음
  if (c >= 0x30 && c <= 0x39) return "0136780".indexOf(String(ch)) >= 0 ? 1 : 0; // 숫자 발음
  return -1;                                                      // 판정 불가
}
function pickJosa(word, pair) {
  var p = String(pair).split("/"), A = p[0], B = p[1] === undefined ? "" : p[1];
  var w = String(word).replace(/[\s)\]}．.,·]+$/, "");            // 끝의 괄호·부호 제거
  if (!w) return "";
  var j = jongOf(w.slice(-1));
  if (j < 0) return A;                                            // 판정 불가 → 앞의 것
  if (j === 0) return B;                                          // 받침 없음
  if (j === 8 && /^으/.test(A)) return B;                         // ㄹ 받침 + 으로 → 로
  return A;
}

var PH = /\{(~?)([^:}]+)(?::([^}]*))?\}/g;
var VAR = /\{@([^}]+)\}/g;

/* ── 있을 때만 넣는 구절 ──────────────────────────────────────
     [[집결지:…]]    집결지에 값이 있을 때만 이 구절을 쓴다
     [[!집결지:…]]   집결지가 비었을 때만 이 구절을 쓴다

   왜 이런 것이 필요한가 — 집결지를 두지 않는 지자체가 있습니다. 그때
   "대피소[○○]나 집결지[]으로" 같은 반쪽 문장이 나가면 안 되고, 빈 칸이라고
   문안을 아예 안 만들어 버려도 안 됩니다. 그래서 **두 문장을 템플릿에 그대로
   써 두고** 값이 있는 쪽을 씁니다 — 기계가 문장을 조립하는 것이 아니라,
   사람이 미리 적어 둔 두 문장 중 하나가 그대로 나갑니다. */
var CHUNK = /\[\[(!?)([^:\]]+):([\s\S]*?)\]\]/g;
function applyChunks(t) {
  return String(t).replace(CHUNK, function (m, neg, k, body) {
    var has = !!String(val(k) == null ? "" : val(k)).trim();
    return (neg ? !has : has) ? body : "";
  });
}

/* {@상황} → 템플릿의 변형표에서 현재 사고유형에 맞는 문구로 교체 */
function applyVariants(t, tpl) {
  return String(t).replace(VAR, function (m, key) {
    var v = tpl && tpl.변형 && tpl.변형[key];
    if (!v) return m;
    return v[state.type] || v["누출"] || "";
  });
}

function fill(t) {
  return String(t).replace(PH, function (m, only, k, josa) {
    var v = val(k);
    if (v === undefined || v === "") return only ? "" : (v === "" ? "" : m);
    return (only ? "" : v) + (josa ? pickJosa(v, josa) : "");
  });
}

/* 세그먼트를 붙인 뒤 구분자·공백 정리 */
function normalize(s) {
  return s.replace(/\s*\/\s*/g, "/").replace(/\/{2,}/g, "/")
          .replace(/[ \t]{2,}/g, " ")
          .replace(/\s+([,.·])/g, "$1")
          .replace(/[,·]\s*$/, "")
          .replace(/^[\s\/]+|[\s\/]+$/g, "");
}

/* 긴급재난문자: 글자수 상한에 맞춰 낮은 우선순위부터 축약 */
function buildCbs(tpl, limit) {
  var segs = tpl.seg.map(function (s) {
    return { t: fill(applyChunks(applyVariants(s[0], tpl))), d: s[1], n: s[2],
             alt: s[3] ? fill(applyChunks(s[3])) : null, on: true, alted: false };
  });
  var render = function () {
    return normalize(segs.filter(function (s) { return s.on; })
      .map(function (s) { return s.alted ? s.alt : s.t; }).join(""));
  };

  var text = render(), cut = [];
  if (limit > 0) {
    // 1차: 우선순위가 낮은 것부터 잘라내며 상한 이하로 내림
    var order = segs.filter(function (s) { return s.d > 0; })
                    .sort(function (a, b) { return a.d - b.d; });
    for (var i = 0; i < order.length && count(text) > limit; i++) {
      var s = order[i];
      if (s.alt) { s.alted = true; } else { s.on = false; }
      cut.push(s); text = render();
    }
    // 2차: 과하게 잘린 경우 되살릴 수 있는 것부터 복원 (중요한 것 = 나중에 잘린 것)
    for (var j = cut.length - 1; j >= 0; j--) {
      var c = cut[j], wasAlt = c.alted, wasOn = c.on;
      if (wasAlt) c.alted = false; else c.on = true;
      var t2 = render();
      if (count(t2) <= limit) { cut.splice(j, 1); text = t2; }
      else { c.alted = wasAlt; c.on = wasOn; }
    }
  }
  var removed = cut.map(function (s) { return s.alted ? s.n + "→간략표기" : s.n; });
  return { text: text, removed: removed, over: limit > 0 && count(text) > limit };
}

function build(id) {
  var tpl = TEMPLATES[id];
  var limit = VERSION.글자수[tpl.channel] || 0;
  var r = tpl.seg ? buildCbs(tpl, limit)
                  : { text: normalize(fill(applyChunks(applyVariants(tpl.text, tpl)))),
                      removed: [], over: false };
  r.tpl = tpl; r.id = id; r.limit = limit; r.len = count(r.text);
  return r;
}

/* ── 검증 ──────────────────────────────────────────────────── */

function usedFields() {
  var f = FIELDS.공통.slice();
  if (state.stage === "evac") {
    f = f.concat(FIELDS.evac.filter(function (x) { return !x.부가 || state.use71; }));
  }
  return f;
}

/* 지금 고른 발송 구분 */
function curStage() {
  return STAGES.filter(function (s) { return s.id === state.stage; })[0] || null;
}

/* 입력칸 이름 — 발송 구분에 따라 다르게 부르는 칸이 있다
   (도로 우회 알림에서는 사고 지점이 사업장이 아니라 도로일 수 있음) */
function fieldLabel(f) {
  var s = curStage();
  return (s && s.라벨 && s.라벨[f.k]) || f.label;
}

/* ── 하위 분류 ────────────────────────────────────────────────
   한 발송 구분 안에서 상황에 따라 문안이 갈리는 경우를 담습니다. 지금은
   도로 우회 알림 하나뿐입니다 — 사고지역이 실내대피 중인지 대피명령 중인지에
   따라 우회 문구가 다르고, 상황종료 문안도 그에 맞춰 짝이 달라집니다.
   고른 쪽 문안만 보여 줍니다. 넷을 한꺼번에 늘어놓으면 지금 상황과 맞지 않는
   문안까지 훑어야 하고, 급할 때 그 자리에서 잘못 고를 여지가 생깁니다. */
function catsOf(stage) {
  return (stage && stage.분류) || null;
}
function curCat(stage) {
  var cs = catsOf(stage);
  if (!cs) return null;
  var id = state.cat && state.cat[stage.id];
  return cs.filter(function (c) { return c.id === id; })[0] || null;
}

/* 이번 구분에서 실제로 생성할 문안 — 그룹 단위로 돌려준다. 7-1번은 선택했을 때만.
   하위 분류가 있는 구분은 고르기 전까지 아무것도 만들지 않는다 — 상황을 정하지
   않은 채로 문안이 떠 있으면 어느 쪽을 보는 것인지 알 수 없다. */
function stageGroups(stage) {
  var cat = curCat(stage);
  var groups = catsOf(stage) ? (cat ? cat.그룹 : []) : stage.그룹;
  var pre = stage.id + (cat ? "/" + cat.id : "");
  return groups.map(function (g, gi) {
    return {
      제목: g.제목, 접힘: !!g.접힘, key: pre + ":" + gi,
      ids: g.문안.filter(function (id) { return !TEMPLATES[id].부가 || state.use71; })
    };
  }).filter(function (g) { return g.ids.length > 0; });
}

/* 그룹이 펼쳐져 있는가 — 접힘 그룹은 눌러서 열 때까지 감춘다 */
function grpOpen(g) {
  return g.접힘 ? !!state.openGrp[g.key] : true;
}

/* 문안이 실제로 쓰는 입력 항목만 뽑는다 — 채워지기 전 원문에서 {키} 자리표시자를
   찾는다. 사고유형별 변형 문구에도 자리표시자가 있을 수 있어 함께 뽑는다
   (예: 변형.상황.누출 안의 "{물질:이/가} 누출되는…"). 대피소는 실내대피 문안에는
   없으므로, 그 문안에서는 대피소가 비어 있어도 문제 삼지 않게 하기 위한 것이다. */
var USEDKEYS = {};
function usedKeysOf(tpl) {
  if (USEDKEYS[tpl.번호]) return USEDKEYS[tpl.번호];
  var src = tpl.text || (tpl.seg || []).map(function (s) { return s[0] + (s[3] || ""); }).join(" ");
  if (tpl.변형) {
    Object.keys(tpl.변형).forEach(function (vk) {
      var opts = tpl.변형[vk];
      Object.keys(opts).forEach(function (ok) { src += " " + opts[ok]; });
    });
  }
  var keys = {};
  String(src).replace(PH, function (m, only, k) {
    if (k.charAt(0) !== "@") keys[k] = true;   // {@상황} 은 사고유형 변형 표시일 뿐 입력칸이 아니다
  });
  return (USEDKEYS[tpl.번호] = Object.keys(keys));
}

var FIELD_BY_KEY = null;
function labelOf(k) {
  if (!FIELD_BY_KEY) {
    FIELD_BY_KEY = {};
    FIELDS.공통.concat(FIELDS.evac).forEach(function (f) { FIELD_BY_KEY[f.k] = f; });
  }
  var f = FIELD_BY_KEY[k];
  return f ? fieldLabel(f) : k;
}

/* 비어도 되는 항목인가 — FIELDS 에서 req 를 두지 않은 것.
   그 항목을 말하는 구절은 [[키:…]] 로 문안에서 빠지므로 반쪽 문장이 되지 않는다. */
var OPTIONAL_K = null;
function isOptionalKey(k) {
  if (!OPTIONAL_K) {
    OPTIONAL_K = {};
    FIELDS.공통.concat(FIELDS.evac).forEach(function (f) {
      if (!f.req) OPTIONAL_K[f.k] = true;
    });
  }
  return !!OPTIONAL_K[k];
}

/* 문안 하나가 아직 채우지 않은 항목 — 이 문안이 실제로 쓰는 항목만 검사한다 */
function missingKeysFor(tpl) {
  return usedKeysOf(tpl).filter(function (k) {
    if (isOptionalKey(k)) return false;
    if (k === "물질") return !state.unknownMat && !String(state.data["물질"] || "").trim();
    return !String(state.data[k] || "").trim();
  });
}

/* 검증
   tplErrs 문안 하나의 문제(미입력·글자수 초과·표현 충돌) → 그 문안 카드 안에
           빨간 글씨로 표시하고 그 문안만 복사를 막는다. 다른 문안까지 막으면
           쓸 수 있는 문안을 못 쓰게 되므로, 전체를 막는 오류는 두지 않는다.
   warns   판단이 필요한 사항 → 막지 않는다 */
function validate(results) {
  var warns = [], tplErrs = {}, d = state.data;
  var addTpl = function (r, m) {
    (tplErrs[r.id] = tplErrs[r.id] || []).push(m);
  };

  // 1. 문안별 필수 입력 확인 — 그 문안이 실제로 쓰는 항목만 검사한다
  results.forEach(function (r) {
    var missing = missingKeysFor(r.tpl);
    if (missing.length)
      addTpl(r, "입력되지 않은 항목: " + missing.map(labelOf).join(", "));
    else if (/\{[^}]+\}/.test(r.text))
      addTpl(r, "문구에 채워지지 않은 항목이 남아 있습니다.");
  });

  // 2. 예시값 잔존
  var all = results.map(function (r) { return r.text; }).join("\n");
  var ex = ["고담", "강담", "구담", "○○", "OO"].filter(function (w) { return all.indexOf(w) >= 0; });
  if (ex.length) warns.push("표준(안) 예시값으로 보이는 표현이 남아 있습니다: " + ex.join(", "));

  // 3. 글자수 초과 — 그 문안만 막는다
  results.forEach(function (r) {
    if (r.over) addTpl(r, "축약 후에도 " + r.limit + "자를 " + (r.len - r.limit)
      + "자 초과합니다. 대상지역·대피소 표기를 줄이세요.");
  });

  // 4. 논리 충돌 — 한 화면에 알림 문안과 종료 문안이 함께 나오므로
  //    화면에서 고른 구분이 아니라 문안 하나하나의 단계로 검사합니다.
  var evacWords = /즉시\s*대피|대피바람|대피요망|대피하시|대피명령|대피발령/;
  results.forEach(function (r) {
    var st = r.tpl.단계;
    if ((st === "indoor" || st === "indoor_end") && evacWords.test(r.text))
      addTpl(r, "실내대피 문안인데 외부 대피 지시 표현이 포함되어 있습니다.");
    if ((st === "indoor_end" || st === "evac_end") && /발령|즉시\s*대피/.test(r.text))
      addTpl(r, "종료 문안인데 대피 발령 표현이 포함되어 있습니다.");
  });

  // 5. 물질 미확인인데 물질명이 입력된 경우
  if (state.unknownMat && String(d["물질"] || "").trim())
    warns.push("‘물질 미확인’을 선택했는데 물질명이 입력되어 있습니다. 하나만 선택하세요.");

  // 6. 지역 정합성
  var dong = String(d["읍면동"] || "").trim();
  var area = String(d["대상지역"] || "");
  if (dong && area && area.indexOf(dong) < 0)
    warns.push("대상지역(" + area + ")에 사고 읍·면·동(" + dong + ")이 포함되어 있지 않습니다. 의도한 것인지 확인하세요.");

  if (state.stage === "evac") {
    var sh = String(d["대피소"] || "");
    if (dong && sh && sh.indexOf(dong) >= 0)
      warns.push("대피소가 사고 발생 읍·면·동(" + dong + ") 안에 있는 것으로 보입니다. 확산방향을 확인하세요.");
    if (sh && area && sh === area)
      warns.push("대피소와 대상지역이 같게 입력되었습니다.");
  }

  // 7. 사고유형 ↔ 물질 특성 정합성 (경고만, 문구는 바꾸지 않음)
  if (!state.unknownMat) {
    var mm = findMaterial(d["물질"] || "");
    if (mm && (state.type === "화재" || state.type === "폭발")
        && mm.fe && /없음|낮음|비인화성|불연/.test(mm.fe))
      warns.push("‘" + mm.n + "’은(는) 물질정보상 " + mm.fe
        + "으로 기재돼 있습니다. 사고유형이 " + state.type + "인지 확인하세요.");
  }

  // 8. 시각 형식
  ["시각", "집결시각"].forEach(function (k) {
    var v = String(d[k] || "").trim();
    if (v && !/^\d{1,2}:\d{2}$/.test(v)) warns.push(k + " 형식을 확인하세요 (예: 17:10).");
  });

  return { warns: warns, tplErrs: tplErrs };
}


/* ══════════════════════════════════════════════════════════════
   화면
   왼쪽 = 입력, 오른쪽 = 생성 문안. 입력하는 동안 문안이 계속 보입니다.
   ══════════════════════════════════════════════════════════════ */

/* ── 물질정보 조회 ────────────────────────────────────────────
   460종 물질정보에서 이름·유사명·CAS 로 찾는다. 판단은 하지 않고 보여주기만 한다. */
var MATIDX = null;
function normName(x) { return String(x).replace(/[\s·,()]/g, "").toLowerCase(); }
function matIndex() {
  if (MATIDX) return MATIDX;
  MATIDX = {};
  (typeof MATERIALS === "undefined" ? [] : MATERIALS).forEach(function (m) {
    [m.n].concat(m.a || []).concat(m.c ? [m.c] : []).forEach(function (k) {
      var key = normName(k);
      if (key && !MATIDX[key]) MATIDX[key] = m;
    });
  });
  return MATIDX;
}
function findMaterial(name) {
  var q = normName(name);
  if (!q) return null;
  var idx = matIndex();
  return idx[q] || idx[q.replace(/\d+(\.\d+)?%?$/, "")] || null;   // "염산35%" → "염산"
}

/* 사고유형에 따라 참고할 거리가 달라진다 (원자료 「대응 방법」 항목) */
function distanceInfo(m) {
  if (!m) return [];
  if (state.type === "화재" || state.type === "폭발")
    return m.d3 ? [["화재 동반 시 대피거리", m.d3]] : [];
  var out = [];
  if (m.d1) out.push(["초기이격거리 (전 방향)", m.d1]);
  if (m.d2) out.push(["방호활동거리 (풍하방향)", m.d2]);
  return out;
}

/* 요약 한 줄 + 펼치면 상세. 기본은 접힌 상태라 화면이 길어지지 않는다. */
function renderMatInfo() {
  var box = $("#matInfo");
  if (!box) return;
  var open = $(".matbar", box) && $(".matbar", box).open;

  if (state.unknownMat) {
    box.innerHTML = '<div class="matbar none"><div style="padding:8px 11px;color:var(--warn)">'
      + "물질 미확인 — 문구에 <b>화학물질</b>로 표기됩니다.</div></div>";
    return;
  }
  var name = String(state.data["물질"] || "").trim();
  if (!name) { box.innerHTML = ""; return; }

  var m = findMaterial(name);
  if (!m) {
    box.innerHTML = '<div class="matbar none"><div style="padding:8px 11px">'
      + "<b>물질정보 없음</b> — ‘" + esc(name) + "’은(는) 460종 목록에 없습니다. "
      + "문구 생성에는 영향이 없습니다.</div></div>";
    return;
  }

  // 요약 줄: 근무자가 가장 먼저 알아야 할 것만
  var head = [];
  if (m.s) head.push(esc(m.s));
  if (m.vdn > 1.1) head.push("<b>공기보다 무거움</b>");
  else if (m.vdn && m.vdn < 0.9) head.push("공기보다 가벼움");
  if (m.fe && !/없음|낮음|비인화성|불연/.test(m.fe)) head.push("<b>화재·폭발 가능</b>");
  if (m.hz >= 3) head.push("<b>건강위험 " + m.hz + "단계</b>");

  var rows = [];
  distanceInfo(m).forEach(function (x) { rows.push(x); });
  if (m.fe) rows.push(["화재·폭발 가능성", m.fe]);
  if (m.vd) rows.push(["증기밀도 / 비중", m.vd + (m.sg ? " / " + m.sg : "")]);
  if (m.fp) rows.push(["인화점", m.fp + (m.el ? " · 폭발한계 " + m.el : "")]);
  if (m.sy) rows.push(["흡입 시 증상", m.sy]);
  var 응급 = [m.e3 && "눈: " + m.e3, m.e2 && "피부: " + m.e2, m.e1 && "흡입: " + m.e1]
             .filter(Boolean).join("\n");
  if (응급) rows.push(["응급조치", 응급]);

  box.innerHTML =
    '<details class="matbar"' + (open ? " open" : "") + "><summary>"
    + "<b>" + esc(m.n) + "</b>"
    + '<span style="font-size:11.5px">' + esc(m.c ? "CAS " + m.c : "") + "</span>"
    + "<span>" + head.join(" · ") + "</span>"
    + '<span class="more">물질정보</span></summary>'
    + '<div class="body"><dl>'
    + rows.map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("")
    + '</dl><p class="src">화학물질안전원 「화학사고 현장대응 물질정보」 발췌. '
    + "<b>대피 범위·행동요령의 판단 근거가 아니라 참고 자료입니다.</b> "
    + "거리 값은 지시받은 대상지역이 타당한지 대조하는 용도로만 보십시오.</p></div></details>";

  $(".matbar", box).ontoggle = function () { /* 열림 상태만 유지 */ };
}

/* ── 입력 폼 ──────────────────────────────────────────────── */

function fieldHtml(f) {
  var v = esc(state.data[f.k] || "");
  var id = "if_" + f.k;
  var input = f.type === "time"
    ? '<input type="time" id="' + id + '" data-k="' + f.k + '" value="' + v + '">'
    : '<input type="text" id="' + id + '" data-k="' + f.k + '" value="' + v + '"'
      + (f.물질 ? " data-matpicker autocomplete=\"off\"" : "") + ">";
  return '<div class="f' + (f.wide ? " wide" : "") + '">'
    + '<label for="' + id + '">' + esc(fieldLabel(f)) + (f.req ? '<span class="req">*</span>' : "") + "</label>"
    + input
    + (f.help ? '<span class="fh">' + esc(f.help) + "</span>" : "")
    + (f.물질
        ? '<label class="chk" style="padding:1px 0;font-size:12px"><input type="checkbox" id="unkMat"'
          + (state.unknownMat ? " checked" : "") + "><span>물질 미확인</span></label>"
        : "")
    + "</div>";
}

/* 사고정보를 번호 매긴 묶음으로 그린다 — 처음 보는 근무자도 위에서부터
   순서대로 채우면 되도록. 강조 묶음(대상지역)은 사고 위치와 헷갈리기 쉬운
   항목이라 색을 넣어 눈에 띄게 했습니다. */
function fieldGroupHtml(g) {
  var fields = FIELDS.공통.filter(function (f) { return f.그룹 === g.id; });
  if (!fields.length) return "";
  return '<div class="fgrp step' + (g.강조 ? " fgrp-accent" : "")
    + '" data-step="' + g.id + '">'
    /* 번호는 위의 진행 표시가 붙입니다 — 여기에 또 매기면 같은 묶음이 화면에서
       두 개의 번호(묶음 4 · 걸음 5)를 갖게 되어 어느 쪽이 맞는지 헷갈립니다. */
    + '<div class="fgrp-hd"><b>' + esc(g.제목) + "</b>"
    + (g.설명 ? '<span class="fgrp-d">' + esc(g.설명) + "</span>" : "") + "</div>"
    + '<div class="grid">' + fields.map(fieldHtml).join("") + "</div></div>";
}

function bindFields(root) {
  $$("input[data-k]", root).forEach(function (el) {
    el.oninput = function () {
      state.data[el.dataset.k] = el.value; save();
      if (el.dataset.k === "물질") renderMatInfo();
      renderOut();
    };
  });
  var u = $("#unkMat", root);
  if (u) u.onchange = function () {
    state.unknownMat = u.checked; save(); renderMatInfo(); renderOut();
  };
}

/* 버튼 DOM 은 한 번만 만든다 — 고를 때마다 innerHTML 로 다시 그리면 방금 누른
   버튼이 통째로 새 엘리먼트로 바뀌어 버려서, 그 버튼에 걸어 둔 "정사각형 →
   작은 띠" 축소 트랜지션이 재생되지 못하고 곧장 최종 모습으로 툭 나타난다
   (실제로 그랬음 — 브라우저가 "이전 모습"을 그려 볼 기회 자체가 없었던 것).
   그래서 버튼은 처음 한 번만 만들고, 고른 뒤에는 aria-pressed 속성만 바꾼다. */
function renderStages() {
  var box = $("#stages");
  if (!box.children.length) {
    box.innerHTML = STAGES.map(function (s) {
      return '<button type="button" class="stp" data-s="' + s.id + '" aria-pressed="false">'
        + '<span class="stp-ic" aria-hidden="true">' + (STAGE_ICONS[s.id] || "") + "</span>"
        + "<b>" + esc(s.이름) + "</b>"
        + (s.짧은설명 ? '<span class="stp-d">' + esc(s.짧은설명) + "</span>" : "")
        + "</button>";
    }).join("");
    $$("#stages button").forEach(function (b) {
      b.onclick = function () { state.stage = b.dataset.s; save(); renderAll(); };
    });
  }
  $$("#stages button").forEach(function (b) {
    b.setAttribute("aria-pressed", String(state.stage === b.dataset.s));
  });
}

function renderTypes() {
  $("#types").innerHTML = INCIDENT_TYPES.map(function (t) {
    return '<button type="button" data-t="' + t.id + '" aria-pressed="' + (state.type === t.id)
      + '" title="' + esc(t.설명) + '">' + esc(t.이름) + "</button>";
  }).join("");
  $$("#types button").forEach(function (b) {
    b.onclick = function () { state.type = b.dataset.t; save(); renderAll(); };
  });
}

/* 하위 분류 고르는 줄 — 고르기 전에는 오른쪽 칸에 문안이 하나도 없으므로
   여기서 무엇을 고르라는 말을 해 준다 */
function renderCatBar() {
  var el = $("#catBar");
  if (!el) return;
  var stage = curStage(), cats = catsOf(stage);
  el.hidden = !cats;
  if (!cats) return;

  /* 무엇을 고르는 줄인지는 단추 글씨("실내대피 중일 때")가 이미 말하고 있어
     앞에 이름표를 따로 두지 않습니다. 화면에서 읽히는 이름은 aria-label 로만
     남겨, 화면낭독기 사용자도 무엇을 고르는지 알 수 있게 합니다. */
  var cur = curCat(stage);
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", stage.분류제목 || "상황");
  el.innerHTML = cats.map(function (c) {
        return '<button type="button" class="cat" data-c="' + esc(c.id) + '"'
          + ' aria-pressed="' + (cur && cur.id === c.id) + '"'
          + (c.짧은설명 ? ' title="' + esc(c.짧은설명) + '"' : "") + ">"
          + esc(c.이름) + "</button>";
      }).join("");

  $$("#catBar .cat").forEach(function (b) {
    b.onclick = function () {
      state.cat[stage.id] = (state.cat[stage.id] === b.dataset.c ? null : b.dataset.c);
      save(); renderAll();
    };
  });
}

function renderFields() {
  var on = !!state.stage, isEvac = state.stage === "evac";
  $("#cols").hidden = !on;
  /* 구분을 고르면 위의 정사각형 버튼 3개를 작은 띠로 접어, 문자 생성칸이
     화면을 더 넓게 쓸 수 있게 한다 (assets/shell.css body.has-stage 규칙) */
  document.body.classList.toggle("has-stage", on);
  /* 고르기 전에는 안내 띠 자체를 감춘다 — 바로 위 큰 단추 3개가 이미
     "무엇을 고르라"는 말을 하고 있어 같은 말이 두 번 나온다. */
  $("#noteWrap").hidden = !on;
  if (!on) { $("#noteBar").textContent = ""; return; }

  var stage = curStage();
  $("#noteBar").innerHTML = "<b>" + esc(stage.이름) + "</b> — " + esc(stage.안내)
    + " 필요한 것만 골라 복사하세요.";

  $("#fCommon").innerHTML = FIELD_GROUPS.map(fieldGroupHtml).join("");
  bindFields($("#fCommon"));

  $("#evacWrap").hidden = !isEvac;
  if (isEvac) {
    $("#fEvac").innerHTML = FIELDS.evac.filter(function (f) { return !f.부가; }).map(fieldHtml).join("");
    $("#fEvacExtra").innerHTML = FIELDS.evac.filter(function (f) { return f.부가; }).map(fieldHtml).join("");
    bindFields($("#fEvac")); bindFields($("#fEvacExtra"));

    var c71 = $("#use71");
    c71.checked = state.use71;
    $("#fEvacExtra").hidden = !state.use71;
    c71.onchange = function () {
      state.use71 = c71.checked; $("#fEvacExtra").hidden = !c71.checked;
      syncTargets(); save(); renderOut();
    };
  }
}


/* ══ 한 걸음씩 (단계형) ══════════════════════════════════════════
   예전에는 입력칸 여덟 개가 한 화면에 쌓여 있고 그 옆에 결과 네 건이 동시에
   떠 있었습니다. 사고 접수 직후에 어디를 먼저 만져야 하는지 화면이 말해 주지
   않았고, 빈칸이 남은 미완성 문안이 완성된 문안과 똑같이 보였습니다.

   그래서 **한 화면에 한 묶음만** 묻습니다. 지금 몇 걸음째인지 위에 늘 보이고,
   마지막 걸음에서 문안을 봅니다. 순서대로 가는 것이 기본이지만 진행 표시를
   눌러 아무 걸음으로나 건너뛸 수 있습니다 — 급할 때는 아는 값부터 채우는
   사람도 있고, 지도에서 값을 들고 오면 이미 채워진 걸음도 있습니다.
   ══════════════════════════════════════════════════════════════ */

/* 걸음 목록은 고른 발송 구분에 따라 달라진다(대피장소를 안 쓰는 구분도 있다) */
function stepList() {
  var stage = curStage();
  if (!stage) return [];
  var steps = [{ id: "type", 제목: "사고유형" }];
  FIELD_GROUPS.forEach(function (g) {
    steps.push({ id: g.id, 제목: g.제목 });
  });
  if (stage.id === "evac") steps.push({ id: "evac", 제목: "대피장소" });
  steps.push({ id: "out", 제목: "문안 확인" });
  return steps;
}

function stepIndex(id) {
  var l = stepList(), i;
  for (i = 0; i < l.length; i++) if (l[i].id === id) return i;
  return 0;
}

/* 이 걸음에서 묻는 항목들 — 다 채웠는지 표시하고, 빠진 것을 찾아갈 때 쓴다 */
function stepKeys(id) {
  if (id === "type" || id === "out") return [];
  if (id === "evac") {
    return FIELDS.evac.filter(function (f) { return f.req && !f.부가; })
      .map(function (f) { return f.k; });
  }
  return FIELDS.공통.filter(function (f) { return f.그룹 === id && f.req; })
    .map(function (f) { return f.k; });
}

/* 이 걸음의 필수 항목이 다 찼는가 — 진행 표시의 체크로 보여 준다.
   지금 쓰는 문안이 실제로 쓰는 항목만 본다(안 쓰는 칸까지 채우라고 하면 안 됨) */
function stepFilled(id) {
  if (id === "type") return !!state.type;
  if (id === "out") return true;
  var need = stepKeys(id).filter(function (k) { return usedFieldKeys()[k]; });
  if (!need.length) return true;
  return need.every(function (k) {
    if (k === "물질") return state.unknownMat || !!String(state.data["물질"] || "").trim();
    return !!String(state.data[k] || "").trim();
  });
}

/* 지금 고른 구분의 문안들이 실제로 쓰는 항목 (키 → true) */
var USEDF_CACHE = null, USEDF_KEY = "";
function usedFieldKeys() {
  var stage = curStage();
  var key = (stage ? stage.id : "") + "|" + (curCat(stage) ? curCat(stage).id : "")
          + "|" + state.use71;
  if (USEDF_CACHE && USEDF_KEY === key) return USEDF_CACHE;
  var out = {};
  stageGroups(stage).forEach(function (g) {
    g.ids.forEach(function (id) {
      var tpl = TEMPLATES[id];   /* TEMPLATES 는 id 를 열쇠로 하는 객체다 */
      if (tpl) usedKeysOf(tpl).forEach(function (k) { out[k] = true; });
    });
  });
  USEDF_CACHE = out; USEDF_KEY = key;
  return out;
}

/* 아직 못 채운 항목 — 어느 걸음으로 가야 하는지까지 함께 돌려준다 */
function missingByStep() {
  var used = usedFieldKeys(), out = [];
  stepList().forEach(function (s) {
    if (s.id === "type" || s.id === "out") return;
    var miss = stepKeys(s.id).filter(function (k) {
      if (!used[k]) return false;
      if (k === "물질") return !state.unknownMat && !String(state.data["물질"] || "").trim();
      return !String(state.data[k] || "").trim();
    });
    if (miss.length) out.push({ step: s.id, 제목: s.제목, keys: miss });
  });
  return out;
}

function gotoStep(id) {
  state.step = id;
  save();
  showStep();
  /* 걸음을 옮기면 화면 위쪽으로 올린다 — 아래로 스크롤된 채 새 걸음이 나오면
     빈 화면을 본 것처럼 느껴진다 */
  var bar = $("#stepBar");
  if (bar && bar.getBoundingClientRect().top < 0) bar.scrollIntoView({ block: "start" });
}

function renderStepBar() {
  var bar = $("#stepBar"), list = stepList();
  if (!list.length) { bar.hidden = true; return; }
  bar.hidden = false;
  var cur = stepIndex(state.step);
  bar.innerHTML = list.map(function (s, i) {
    var done = i < cur && stepFilled(s.id);
    var state2 = i === cur ? "on" : (done ? "done" : (stepFilled(s.id) ? "ok" : ""));
    return '<li class="stp-i ' + state2 + '">'
      + '<button type="button" data-go="' + s.id + '"'
      + (i === cur ? ' aria-current="step"' : "") + '>'
      + '<i>' + (done ? "✓" : (i + 1)) + "</i>"
      + "<b>" + esc(s.제목) + "</b></button></li>";
  }).join("");
  $$("#stepBar button").forEach(function (b) {
    b.onclick = function () { gotoStep(b.dataset.go); };
  });
}

function renderStepNav() {
  var nav = $("#stepNav"), list = stepList();
  if (!list.length) { nav.hidden = true; return; }
  nav.hidden = false;
  var i = stepIndex(state.step);
  var prev = i > 0 ? list[i - 1] : null;
  var next = i + 1 < list.length ? list[i + 1] : null;
  nav.innerHTML =
    (prev ? '<button type="button" class="sn-prev" data-go="' + prev.id + '">'
       + "이전 — " + esc(prev.제목) + "</button>" : '<span class="sn-sp"></span>')
    + (next ? '<button type="button" class="p sn-next" data-go="' + next.id + '">'
       + (next.id === "out" ? "문안 만들기" : "다음 — " + esc(next.제목)) + "</button>"
       : '<button type="button" class="sn-first" data-go="' + list[0].id + '">'
       + "처음 걸음으로</button>");
  $$("#stepNav button").forEach(function (b) {
    b.onclick = function () { gotoStep(b.dataset.go); };
  });
}

function showStep() {
  var list = stepList();
  if (!list.length) return;
  if (!state.step || stepIndex(state.step) < 0
      || !list.filter(function (s) { return s.id === state.step; }).length) {
    state.step = list[0].id;
  }
  /* 물질 고르기 목록이 떠 있는 채로 걸음을 옮기면, 붙어 있던 입력칸이 사라져
     목록만 화면 왼쪽 위에 떠 있게 됩니다(실제로 그랬음). 걸음을 바꿀 때 닫습니다. */
  if (window.MatPicker) window.MatPicker.close();
  $$(".step").forEach(function (el) {
    el.hidden = el.dataset.step !== state.step;
  });
  /* 사고정보 묶음을 담는 상자도 그 안에 보이는 묶음이 없으면 감춥니다 —
     빈 상자가 여백만 차지해 상자 안이 갈라져 보였습니다. */
  var fc = $("#fCommon");
  if (fc) {
    fc.hidden = !FIELD_GROUPS.filter(function (g) { return g.id === state.step; }).length;
  }
  /* 마지막 걸음에서는 입력 칸 자체를 감춥니다 — 안 그러면 빈 '사고정보' 상자가
     문안 위에 남습니다(실제로 그랬음). 반대로 입력 걸음에서는 문안 칸을
     감추는데, 그것은 위의 .step 규칙이 이미 합니다. */
  var inp = $("#inPanel");
  if (inp) inp.hidden = state.step === "out";
  renderStepBar();
  renderStepNav();
}

/* ── 생성 문안 ────────────────────────────────────────────── */

var lastResults = [];

function renderOut() {
  var stage = curStage();
  if (!stage) { lastResults = []; $("#btnTxt").disabled = true; return; }

  /* 하위 분류를 아직 안 골랐으면 문안을 만들지 않는다 — 무엇을 보고 있는지
     모르는 채로 문안이 떠 있으면 안 된다. 빈 칸만 남기지 말고 할 일을 적는다. */
  if (catsOf(stage) && !curCat(stage)) {
    lastResults = [];
    $("#alerts").innerHTML = "";
    $("#outCnt").textContent = "";
    /* 고르는 줄에서 이름표를 뺐으므로, 무엇을 고르는 것인지는 여기서 말한다 */
    var names = catsOf(stage).map(function (c) { return "<b>" + esc(c.이름) + "</b>"; });
    $("#out").innerHTML = '<p class="out-ask">' + esc(stage.분류제목 || "상황")
      + "을 위에서 고르세요 — " + names.join(" 또는 ") + "."
      + "<span>사고지역 안의 상태에 따라 우회 문구와 상황종료 문안이 다릅니다.</span></p>";
    $("#btnTxt").disabled = true;
    return;
  }

  /* ── 아직 못 채운 칸이 있으면 문안을 만들지 않는다 ──────────────
     예전에는 {시각}·{읍면동} 처럼 빈칸이 남은 문안을 그대로 보여 주고, 그
     아래에 빨간 글씨로 "입력되지 않은 항목: …" 을 길게 붙였습니다. 완성된
     문안과 모양이 똑같아서 그대로 복사해 보낼 위험이 있었고, 빨간 글씨가
     정작 읽어야 할 문안을 덮었습니다.

     지금은 **문안 자체를 만들지 않고**, 무엇이 비었는지와 어느 걸음으로 가면
     되는지만 보여 줍니다. 채우면 그 자리에 문안이 나타납니다. */
  var miss = missingByStep();
  if (miss.length) {
    lastResults = [];
    $("#alerts").innerHTML = "";
    $("#outCnt").textContent = "";
    var n = 0;
    miss.forEach(function (m) { n += m.keys.length; });
    $("#out").innerHTML = '<div class="needfill">'
      + '<b class="nf-hd">아직 채우지 않은 칸이 ' + n + '개 있습니다</b>'
      + '<p class="nf-d">다 채우면 여기에 발송문안이 만들어집니다. '
      + '반쯤 채운 문안은 잘못 보낼 위험이 있어 만들지 않습니다.</p>'
      + '<ul class="nf-list">'
      + miss.map(function (m) {
          return '<li><button type="button" data-go="' + esc(m.step) + '">'
            + '<b>' + esc(m.제목) + '</b>'
            + '<span>' + m.keys.map(labelOf).map(esc).join(" · ") + '</span>'
            + '<em>채우러 가기</em></button></li>';
        }).join("")
      + "</ul></div>";
    $$("#out .needfill button").forEach(function (b) {
      b.onclick = function () { gotoStep(b.dataset.go); };
    });
    $("#btnTxt").disabled = true;
    return;
  }

  /* 그룹 구조는 화면 표시용, lastResults 는 검증·기록·복사용 평면 목록 */
  lastResults = [];
  var groups = stageGroups(stage).map(function (g) {
    g.results = g.ids.map(function (id) {
      var r = build(id);
      r.i = lastResults.length; r.그룹 = g.제목;
      lastResults.push(r);
      return r;
    });
    return g;
  });

  var v = validate(lastResults);

  /* 필수 미입력·글자수 초과 같은 문제는 이제 각 문안 카드 안에 빨간 글씨로
     표시합니다(outCard 의 .oerr). 판단이 필요한 사항(지역 불일치 등)만
     여기 주의 문구로 남깁니다 — 전체를 막는 오류 배너는 두지 않습니다. */
  $("#alerts").innerHTML = v.warns.length
    ? '<div class="alert w"><b>주의</b><ul><li>' + v.warns.map(esc).join("</li><li>") + "</li></ul></div>"
    : "";

  $("#outCnt").textContent = lastResults.length + "건";

  $("#out").innerHTML = groups.map(function (g) {
    var open = grpOpen(g);
    var nErr = g.results.filter(function (r) { return (v.tplErrs[r.id] || []).length; }).length;
    var head = g.접힘
      ? '<button type="button" class="ohd fold" data-g="' + esc(g.key) + '" aria-expanded="' + open + '">'
        + '<i class="cv"></i>' + esc(g.제목) + "<span>" + g.results.length + "건</span>"
        + (!open && nErr ? '<b class="werr">확인 필요</b>' : "")
        + '<em>' + (open ? "접기" : "보기") + "</em></button>"
      : '<div class="ohd">' + esc(g.제목) + "<span>" + g.results.length + "건</span></div>";
    return '<div class="ogrp' + (g.접힘 ? " foldable" : "") + '">' + head
      + '<div class="obody"' + (open ? "" : " hidden") + ">"
      + g.results.map(function (r) { return outCard(r, v.tplErrs[r.id] || []); }).join("")
      + "</div></div>";
  }).join("");

  $$("#out .ohd.fold").forEach(function (b) {
    b.onclick = function () {
      state.openGrp[b.dataset.g] = !state.openGrp[b.dataset.g];
      save(); renderOut();
    };
  });
  $$("#out button[data-c]").forEach(function (b) {
    b.onclick = function () { copyText(lastResults[b.dataset.c].text, b); };
  });
  $("#btnTxt").disabled = !lastResults.length;
}

/* 문안 한 건 — 긴급재난문자와 자체 문자발송시스템은 발송 경로가 완전히 다르므로
   테두리·머리표·글자수 표시를 서로 다르게 해서 헷갈리지 않게 합니다. */
function outCard(r, myErrs) {
  var blocked = myErrs.length > 0;
  var isCbs = r.tpl.channel === "cbs";
  var cls = r.limit ? (r.len > r.limit ? "over" : (r.len > r.limit - 8 ? "near" : "")) : "";
  var cnt = r.limit
    ? '<span class="cnt ' + cls + '">' + r.len + " / " + r.limit + "자</span>"
    : '<span class="cnt"><small>' + r.len + "자 · 제한 없음</small></span>";
  return '<div class="out ' + (isCbs ? "cbs" : "loc") + (myErrs.length ? " bad" : "") + '"><header>'
    + '<span class="ch">' + (isCbs ? "긴급재난문자" : "자체 문자발송시스템") + "</span>"
    + '<span class="no">' + esc(r.tpl.번호) + "</span>"
    + '<span class="who">' + esc(r.tpl.대상) + "</span></header>"
    + '<div class="msg">' + esc(r.text) + "</div>"
    + (myErrs.length
        ? '<div class="oerr">' + myErrs.map(esc).join("<br>") + "</div>" : "")
    + (r.removed.length
        ? '<div class="cut">' + (r.limit || 90) + "자에 맞추려고 <b>" + esc(r.removed.join(", "))
          + "</b> 항목을 제외했습니다.</div>" : "")
    + "<footer>" + cnt
    + '<button class="sm' + (blocked ? "" : " p") + '" data-c="' + r.i + '"'
    + (blocked ? " disabled" : "") + ">복사</button></footer></div>";
}

function copyText(t, btn) {
  var done = function () {
    var o = btn.textContent; btn.textContent = "복사됨";
    setTimeout(function () { btn.textContent = o; }, 1400);
  };
  if (navigator.clipboard && window.isSecureContext)
    navigator.clipboard.writeText(t).then(done, function () { fallback(t, done); });
  else fallback(t, done);
}
function fallback(t, done) {
  var ta = document.createElement("textarea");
  ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); }
  catch (e) { window.prompt("아래 문구를 복사하세요 (Ctrl+C)", t); }
  document.body.removeChild(ta);
}

/* ── 대피장소 찾기 ────────────────────────────────────────── */

function shelterList() {
  return ((SHELTERS[$("#sSido").value] || {})[$("#sSgg").value]) || [];
}

/* 고른 대피장소를 넣을 수 있는 칸 — 7-1번을 쓰지 않으면 부가 칸은 빼둔다 */
var PLACE_KEYS = ["대피소", "집결지", "자력대피불가집결지", "반려동물대피소"];
function placeTargets() {
  return FIELDS.evac.filter(function (f) {
    return PLACE_KEYS.indexOf(f.k) >= 0 && (!f.부가 || state.use71);
  }).map(function (f) { return { k: f.k, label: f.label }; });
}

/* 고른 곳을 입력칸에 넣는다 (지도·목록 공용) */
function putPlaces(names, target) {
  var el = $("#if_" + target);
  if (!el) return;
  el.value = names.join(", ");
  state.data[target] = el.value;
  save(); renderOut();
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

/* 지도 창에 넘길 영향 참고 반경 후보 — 입력한 사고물질의 물질정보에서 뽑는다.
   ※ 확산 모델링 결과가 아니라 물질정보에 적힌 참고 거리입니다.
      어디까지 대피시킬지는 도구가 판단하지 않습니다. */
function radiusOptions() {
  if (state.unknownMat) return [];
  var m = findMaterial(state.data["물질"] || "");
  if (!m) return [];
  var out = [];
  [["초기이격거리 (전 방향)", m.d1], ["방호활동거리 (풍하방향)", m.d2],
   ["화재 동반 시 대피거리", m.d3]].forEach(function (x) {
    if (!x[1]) return;
    pickDistances(x[1]).forEach(function (v) {
      if (out.some(function (o) { return o.m === v; })) return;
      out.push({ m: v, label: x[0] + " — " + x[1],
                 짧은: (v < 1000 ? v + "m" : (v / 1000) + "km") });
    });
  });
  return out.sort(function (a, b) { return a.m - b.m; }).slice(0, 6);
}

function initShelters() {
  var sido = $("#sSido"), sgg = $("#sSgg"), list = $("#sList");
  sido.innerHTML = '<option value="">선택</option>'
    + Object.keys(SHELTERS).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  sgg.innerHTML = '<option value="">시·도 먼저</option>';

  sido.onchange = function () {
    var m = SHELTERS[sido.value] || {};
    sgg.innerHTML = '<option value="">선택</option>'
      + Object.keys(m).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
    list.innerHTML = ""; $("#sCnt").textContent = "";
  };
  sgg.onchange = function () {
    var arr = shelterList();
    list.innerHTML = arr.map(function (s, i) {
      return '<option value="' + i + '">' + esc(s[0] + (s[1] ? " (" + s[1] + ")" : "")
        + " · " + s[2] + (s[3] ? " · 수용 " + s[3].toLocaleString() + "명" : "")) + "</option>";
    }).join("");
    $("#sCnt").textContent = arr.length ? "관내 " + arr.length + "곳" : "등록된 곳이 없습니다";
  };

  $("#btnFinder").onclick = function () {
    var f = $("#finder");
    f.hidden = !f.hidden;
    this.textContent = f.hidden ? "목록에서 찾기" : "목록 닫기";
    if (!f.hidden) syncTargets();
  };

  /* 지도에서 찾기 — 앞 걸음에서 적은 사고 위치 자리에서 열린다 */
  $("#btnMap").onclick = function () {
    if (typeof SHMAP === "undefined") { alert("지도 화면을 불러오지 못했습니다."); return; }
    var cols = placeTargets();
    var vals = {};
    cols.forEach(function (c) { vals[c.k] = state.data[c.k] || ""; });
    SHMAP.open({
      시군구: String(state.data["시군"] || "").trim(),
      사고지점: accPoint(),
      칸목록: cols,
      기본칸: cols.length ? cols[0].k : "대피소",
      값들: vals,                                  // 이미 넣어 둔 곳은 체크된 채로
      반경후보: radiusOptions(),
      물질: state.unknownMat ? "" : (state.data["물질"] || ""),
      onPick: putPlaces
    });
  };

  $("#btnPick").onclick = function () {
    var arr = shelterList();
    var picked = $$("option:checked", list).map(function (o) { return arr[o.value][0]; });
    if (!picked.length) { alert("대피장소를 하나 이상 선택하세요."); return; }
    putPlaces(picked, $("#shTarget").value);
  };
  syncTargets();
}

/* 넣을 칸 목록을 현재 상태에 맞춘다 (7-1번 선택 여부로 칸이 늘고 줄어듦) */
function syncTargets() {
  var sel = $("#shTarget");
  if (!sel) return;
  var keep = sel.value;
  sel.innerHTML = placeTargets().map(function (c) {
    return '<option value="' + esc(c.k) + '">' + esc(c.label) + "</option>";
  }).join("");
  if (keep) sel.value = keep;
  if (!sel.value && sel.options.length) sel.selectedIndex = 0;
}

/* ── 참고 사례 ──────────────────────────────────────────────
   본문 화면에는 두지 않고, 위쪽 "실제 발송 사례" 버튼을 눌렀을 때만 창으로
   띄웁니다. 나중에 100건 넘게 늘어나도 본문을 밀어내지 않도록 하기 위한 것으로,
   창 안 목록은 스크롤됩니다. */

function renderCases() {
  var btn = $("#btnCases");
  if (typeof CASES === "undefined" || !CASES.length) { btn.hidden = true; return; }
  btn.hidden = false;
  $("#caseN").textContent = "(" + CASES.length + "건)";
  var mats = Object.keys(CASES.reduce(function (a, c) { a[c.물질] = 1; return a; }, {})).sort();
  $("#caseF").innerHTML = '<option value="">전체</option>'
    + mats.map(function (m) { return "<option>" + esc(m) + "</option>"; }).join("");

  var draw = function () {
    var f = $("#caseF").value;
    var rows = CASES.filter(function (c) { return !f || c.물질 === f; });
    $("#caseList").innerHTML = rows.map(function (c) {
      return '<div class="case"><div class="meta"><span>' + esc(c.단계) + "</span><span>"
        + esc(c.물질) + "</span><span>" + c.글자수 + "자"
        + (c.글자수 > 90 ? " · 90자 초과" : "") + "</span></div>" + esc(c.본문) + "</div>";
    }).join("") || '<p style="font-size:13px;color:var(--ink3)">해당 사례가 없습니다.</p>';
  };
  $("#caseF").onchange = draw; draw();

  btn.onclick = openCases;
  $("#btnCasesClose").onclick = closeCases;
  $("#casesModal").onclick = function (e) { if (e.target.id === "casesModal") closeCases(); };
}

function openCases() {
  $("#casesModal").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeCases() {
  $("#casesModal").hidden = true;
  document.body.style.overflow = "";
}

/* ── 기록 저장 ────────────────────────────────────────────── */

function saveTxt() {
  var now = new Date(), pad = function (n) { return String(n).padStart(2, "0"); };
  var ts = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate())
         + " " + pad(now.getHours()) + ":" + pad(now.getMinutes());
  var stage = curStage();

  var L = ["화학사고 주민대피 문자 — 생성 기록", "생성일시: " + ts,
           "발송구분: " + (stage ? stage.이름 : "-"), "사고유형: " + state.type,
           "도구: " + VERSION.도구명 + " " + VERSION.도구버전
             + " (문안근거: " + VERSION.문안근거 + ", 반영일 " + VERSION.반영일 + ")",
           "", "[입력값]"];
  usedFields().forEach(function (f) {
    L.push("  " + fieldLabel(f) + ": "
      + ((f.k === "물질" && state.unknownMat) ? "미확인" : (state.data[f.k] || "-")));
  });
  L.push("", "[생성 문안]");
  var lastGrp = null;
  lastResults.forEach(function (r) {
    if (r.그룹 !== lastGrp) { lastGrp = r.그룹; L.push("", "【" + lastGrp + "】"); }
    L.push("", "── " + r.tpl.번호 + " · " + r.tpl.제목,
           "   (" + r.len + "자" + (r.limit ? " / 상한 " + r.limit + "자" : "") + ")");
    if (r.removed.length) L.push("   축약으로 제외된 항목: " + r.removed.join(", "));
    L.push(r.text);
  });
  L.push("", "※ 본 기록은 작성 지원도구의 생성 결과이며 실제 발송 내역이 아닙니다.");

  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + L.join("\n")], { type: "text/plain;charset=utf-8" }));
  a.download = "화학사고_문자_" + ts.replace(/[-: ]/g, "") + ".txt";
  a.click(); URL.revokeObjectURL(a.href);
}

/* ── 초기화 ───────────────────────────────────────────────── */

function renderAll() {
  renderStages(); renderTypes(); renderFields(); renderCatBar();
  renderMatInfo(); renderOut(); renderSeedBar();
  /* 맨 나중에 — 위에서 입력칸·문안을 새로 그리며 hidden 을 풀어 놓기 때문에,
     어느 걸음을 보여 줄지는 마지막에 정해야 한다. */
  showStep();
}

function init() {
  var resumed = load();
  takeSeed();              // 지도에서 넘어온 값이 있으면 채운다 (load 뒤에 와야 덮인다)
  initShelters();
  renderCases();
  renderAll();
  $("#sessTag").hidden = !resumed;

  $("#btnTxt").onclick = saveTxt;
  $("#btnReset").onclick = function () {
    if (!confirm("입력한 사고정보를 모두 지우고 처음으로 돌아갑니다. 계속할까요?")) return;
    try { sessionStorage.removeItem(SESS); } catch (e) {}
    state = blankState();
    seedInfo = null;
    $("#sessTag").hidden = true;
    var f = $("#finder");
    if (f) { f.hidden = true; $("#btnFinder").textContent = "관내 대피장소 목록에서 찾기"; }
    renderAll();
    window.scrollTo(0, 0);
  };

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !$("#casesModal").hidden) closeCases();
  });
}

document.addEventListener("DOMContentLoaded", init);
})();
