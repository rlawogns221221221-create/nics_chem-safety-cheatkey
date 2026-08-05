/* 화학사고 주민대피 문자 작성 지원도구 — 로직
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

var SESS = "nics.sms.draft.v1";
/* openGrp — 접힌 문안 그룹 중 펼쳐 둔 것. 입력할 때마다 문안을 다시 그리므로
   열어 둔 상태를 state 에 둬야 글자 한 자 칠 때마다 닫히지 않습니다. */
function blankState() {
  return { stage: null, type: "누출", data: {}, unknownMat: false, use71: false, openGrp: {} };
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
      /* 발송 구분이 개편되기 전에 저장된 세션이면 구분만 비운다.
         (없어진 구분 id 가 남아 있으면 화면 조립이 실패한다) */
      if (state.stage && !STAGES.some(function (s) { return s.id === state.stage; }))
        state.stage = null;
      return true;
    }
  } catch (e) {}
  return false;
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
    return { t: fill(applyVariants(s[0], tpl)), d: s[1], n: s[2],
             alt: s[3] ? fill(s[3]) : null, on: true, alted: false };
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
                  : { text: normalize(fill(applyVariants(tpl.text, tpl))), removed: [], over: false };
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

/* 이번 구분에서 실제로 생성할 문안 — 그룹 단위로 돌려준다. 7-1번은 선택했을 때만 */
function stageGroups(stage) {
  return stage.그룹.map(function (g, gi) {
    return {
      제목: g.제목, 접힘: !!g.접힘, key: stage.id + ":" + gi,
      ids: g.문안.filter(function (id) { return !TEMPLATES[id].부가 || state.use71; })
    };
  }).filter(function (g) { return g.ids.length > 0; });
}

/* 그룹이 펼쳐져 있는가 — 접힘 그룹은 눌러서 열 때까지 감춘다 */
function grpOpen(g) {
  return g.접힘 ? !!state.openGrp[g.key] : true;
}

/* 검증
   errs    사고정보 자체의 문제 → 모든 문안 복사를 막는다
   tplErrs 문안 하나의 문제(글자수 초과·표현 충돌) → 그 문안만 막는다
           다른 문안까지 막으면, 쓸 수 있는 문안을 못 쓰게 됩니다.
   warns   판단이 필요한 사항 → 막지 않는다 */
function validate(results) {
  var errs = [], warns = [], tplErrs = {}, d = state.data;
  var addTpl = function (r, m) {
    (tplErrs[r.id] = tplErrs[r.id] || []).push(m);
  };

  // 1. 필수 미입력
  var miss = usedFields().filter(function (f) {
    if (f.k === "물질" && state.unknownMat) return false;
    return !String(d[f.k] || "").trim();
  }).map(function (f) { return f.label; });
  if (miss.length) errs.push("입력되지 않은 항목: " + miss.join(", "));

  // 2. 미치환 자리표시자 / 예시값 잔존
  var all = results.map(function (r) { return r.text; }).join("\n");
  if (/\{[^}]+\}/.test(all)) errs.push("문구에 치환되지 않은 항목이 남아 있습니다.");
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
    errs.push("‘물질 미확인’을 선택했는데 물질명이 입력되어 있습니다. 하나만 선택하세요.");

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

  return { errs: errs, warns: warns, tplErrs: tplErrs };
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

/* 디자인용 아이콘 — 업무 데이터가 아니라 화면 판독을 돕는 표시일 뿐이며
   STAGES 데이터를 변경하지 않습니다. */
var STAGE_ICON = {
  indoor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></svg>',
  detour: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19 12 4l8 15"/><path d="M9 19h6"/><path d="M12 10v4"/></svg>',
  evac: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3v9l4-3"/><path d="M13 12 6 16.5"/><circle cx="5" cy="18" r="1.6" fill="currentColor" stroke="none"/><path d="M9 21h9"/></svg>'
};

function renderStages() {
  $("#stages").innerHTML = STAGES.map(function (s) {
    var on = state.stage === s.id;
    return '<button type="button" data-s="' + s.id + '" aria-pressed="' + on + '">'
      + '<span class="stage-ic" aria-hidden="true">' + (STAGE_ICON[s.id] || "") + "</span>"
      + '<span class="stage-body"><span class="stage-name">' + esc(s.이름) + "</span>"
      + '<span class="stage-desc">' + esc(s.안내) + "</span></span>"
      + '<span class="stage-state"><i class="dot" aria-hidden="true"></i>' + (on ? "선택됨" : "선택") + "</span>"
      + "</button>";
  }).join("");
  $$("#stages button").forEach(function (b) {
    b.onclick = function () { state.stage = b.dataset.s; save(); renderAll(); };
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

function renderFields() {
  var on = !!state.stage, isEvac = state.stage === "evac";
  $("#cols").hidden = !on;
  if (!on) { $("#noteBar").textContent = "보내라고 지시받은 문자를 위에서 고르세요."; return; }

  var stage = curStage();
  $("#noteBar").innerHTML = "<b>" + esc(stage.이름) + "</b> — " + esc(stage.안내)
    + " 필요한 것만 골라 복사하세요.";

  $("#fCommon").innerHTML = FIELDS.공통.map(fieldHtml).join("");
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

/* ── 생성 문안 ────────────────────────────────────────────── */

var lastResults = [];

function renderOut() {
  var stage = curStage();
  if (!stage) { lastResults = []; $("#btnTxt").disabled = true; return; }

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

  /* 접혀 있는 그룹의 오류는 위 알림에 함께 적는다. 안 보이는 곳에서
     오류가 생겼는데 아무 표시가 없으면 모르고 지나칩니다. */
  var tplErrLines = [];
  lastResults.forEach(function (r) {
    (v.tplErrs[r.id] || []).forEach(function (m) {
      tplErrLines.push(r.tpl.번호 + ": " + m);
    });
  });

  var a = "";
  if (v.errs.length || tplErrLines.length)
    a += '<div class="alert e"><b>확인 필요</b><ul><li>'
      + v.errs.concat(tplErrLines).map(esc).join("</li><li>") + "</li></ul></div>";
  if (v.warns.length)
    a += '<div class="alert w"><b>주의</b><ul><li>' + v.warns.map(esc).join("</li><li>") + "</li></ul></div>";
  if (!v.errs.length && !tplErrLines.length && !v.warns.length)
    a += '<div class="alert s"><b>확인 완료</b>필수항목·글자수·논리 검사에서 발견된 문제가 없습니다.</div>';
  $("#alerts").innerHTML = a;

  $("#outCnt").textContent = lastResults.length + "건";

  /* 상태 요약 — 이미 계산된 v·lastResults 값을 그대로 보여줄 뿐, 새로운 판단을 하지 않는다 */
  renderOutStat(v, tplErrLines);

  $("#out").innerHTML = groups.map(function (g) {
    var open = grpOpen(g);
    var nErr = g.results.filter(function (r) {
      return v.errs.length || (v.tplErrs[r.id] || []).length;
    }).length;
    var head = g.접힘
      ? '<button type="button" class="ohd fold" data-g="' + esc(g.key) + '" aria-expanded="' + open + '">'
        + '<i class="cv"></i>' + esc(g.제목) + "<span>" + g.results.length + "건</span>"
        + (!open && nErr ? '<b class="werr">확인 필요</b>' : "")
        + '<em>' + (open ? "접기" : "보기") + "</em></button>"
      : '<div class="ohd">' + esc(g.제목) + "<span>" + g.results.length + "건</span></div>";
    return '<div class="ogrp' + (g.접힘 ? " foldable" : "") + '">' + head
      + '<div class="obody"' + (open ? "" : " hidden") + ">"
      + g.results.map(function (r) { return outCard(r, v.errs, v.tplErrs[r.id] || []); }).join("")
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

/* 생성 문안 패널 최상단 상태 요약 — 순수 표시용, 검증 로직은 그대로 validate()가 담당한다 */
function renderOutStat(v, tplErrLines) {
  var box = $("#outStat");
  if (!box) return;
  if (!lastResults.length) { box.hidden = true; return; }
  box.hidden = false;

  var overN = lastResults.filter(function (r) { return r.over; }).length;
  var nearN = lastResults.filter(function (r) {
    return !r.over && r.limit && r.len > r.limit - 8;
  }).length;
  var lenState = overN ? "err" : (nearN ? "warn" : "ok");
  var lenLabel = overN ? overN + "건 초과" : (nearN ? nearN + "건 근접" : "정상");

  var reqState = v.errs.length ? "err" : "ok";
  var reqLabel = v.errs.length ? "미입력·오류 있음" : "입력 완료";

  var issueN = v.errs.length + tplErrLines.length + v.warns.length;
  var issueState = (v.errs.length || tplErrLines.length) ? "err" : (v.warns.length ? "warn" : "ok");

  box.innerHTML =
    '<div class="st"><span class="n">' + lastResults.length + '</span><span class="l">생성된 문안</span></div>'
    + '<div class="st ' + reqState + '"><span class="n">' + (v.errs.length ? "확인 필요" : "완료") + '</span><span class="l">필수정보 입력</span></div>'
    + '<div class="st ' + lenState + '"><span class="n">' + lenLabel + '</span><span class="l">글자수 검사</span></div>'
    + '<div class="st ' + issueState + '"><span class="n">' + issueN + '</span><span class="l">오류·주의 건수</span></div>';
}

/* 문안 한 건 — 긴급재난문자와 자체 문자발송시스템은 발송 경로가 완전히 다르므로
   테두리·머리표·글자수 표시를 서로 다르게 해서 헷갈리지 않게 합니다. */
var CH_ICON = {
  cbs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  loc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/></svg>'
};

function outCard(r, globalErrs, myErrs) {
  var blocked = globalErrs.length > 0 || myErrs.length > 0;
  var isCbs = r.tpl.channel === "cbs";
  var cls = r.limit ? (r.len > r.limit ? "over" : (r.len > r.limit - 8 ? "near" : "")) : "";
  var cnt = r.limit
    ? '<span class="cnt ' + cls + '">' + r.len + " / " + r.limit + "자</span>"
    : '<span class="cnt"><small>' + r.len + "자 · 제한 없음</small></span>";
  return '<div class="out ' + (isCbs ? "cbs" : "loc") + (myErrs.length ? " bad" : "") + '"><header>'
    + '<span class="ic" aria-hidden="true">' + (isCbs ? CH_ICON.cbs : CH_ICON.loc) + "</span>"
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
  var o = btn.textContent;
  var reset = function () {
    btn.textContent = o; btn.classList.remove("is-done", "is-fail");
  };
  var done = function () {
    btn.textContent = "복사됨"; btn.classList.add("is-done");
    setTimeout(reset, 1400);
  };
  var failed = function () {
    btn.textContent = "복사 실패"; btn.classList.add("is-fail");
    setTimeout(reset, 1400);
  };
  if (navigator.clipboard && window.isSecureContext)
    navigator.clipboard.writeText(t).then(done, function () { fallback(t, done, failed); });
  else fallback(t, done, failed);
}
function fallback(t, done, failed) {
  var ta = document.createElement("textarea");
  ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); }
  catch (e) { if (failed) failed(); window.prompt("아래 문구를 복사하세요 (Ctrl+C)", t); }
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

  /* 지도에서 찾기 — 사고 시·군·구를 이미 적었으면 그 관내를 먼저 보여준다 */
  $("#btnMap").onclick = function () {
    if (typeof SHMAP === "undefined") { alert("지도 화면을 불러오지 못했습니다."); return; }
    var cols = placeTargets();
    var vals = {};
    cols.forEach(function (c) { vals[c.k] = state.data[c.k] || ""; });
    SHMAP.open({
      시군구: String(state.data["시군"] || "").trim(),
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

/* ── 참고 사례 ────────────────────────────────────────────── */

function renderCases() {
  if (typeof CASES === "undefined" || !CASES.length) return;
  $("#dCases").hidden = false;
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

function renderAll() { renderStages(); renderTypes(); renderFields(); renderMatInfo(); renderOut(); }

function init() {
  var resumed = load();
  initShelters();
  renderCases();
  renderAll();
  $("#sessTag").hidden = !resumed;

  var hv = $("#hdrVer");
  if (hv) { hv.textContent = "v" + VERSION.도구버전; hv.hidden = false; }

  $("#btnTxt").onclick = saveTxt;
  $("#btnReset").onclick = function () {
    if (!confirm("입력한 사고정보를 모두 지우고 처음으로 돌아갑니다. 계속할까요?")) return;
    try { sessionStorage.removeItem(SESS); } catch (e) {}
    state = blankState();
    $("#sessTag").hidden = true;
    var f = $("#finder");
    if (f) { f.hidden = true; $("#btnFinder").textContent = "관내 대피장소 목록에서 찾기"; }
    renderAll();
    window.scrollTo(0, 0);
  };

  $("#ver").innerHTML =
    "문안 근거 — " + esc(VERSION.문안근거) + " · 반영일 " + esc(VERSION.반영일) + "<br>"
    + "대피장소 — " + esc(VERSION.대피장소_출처) + " · 기준일 " + esc(VERSION.대피장소_기준일)
    + " (" + (SHELTER_META ? SHELTER_META.총건수.toLocaleString() : "-") + "곳)<br>"
    + "물질정보 — " + esc(VERSION.물질정보_출처) + " · " + esc(VERSION.물질정보_기준) + "<br>"
    + "사고유형 구분 — " + esc(VERSION.통계_출처) + " " + esc(VERSION.통계_기간)
    + " (" + (typeof STATS !== "undefined" ? STATS.총건수.toLocaleString() : "-") + "건)<br>"
    + "글자수 상한 — 긴급재난문자 " + VERSION.글자수.cbs + "자"
    + (VERSION.글자수_검증여부 ? "" : " · <b>실제 발송시스템과 산정방식 대조 전</b>") + "<br>"
    + "추가문의 전화 — 문구에 넣지 않음 (문의 폭주 방지)<br>"
    + "도구 버전 " + esc(VERSION.도구버전) + " · 관리 " + esc(VERSION.관리부서);
}

document.addEventListener("DOMContentLoaded", init);
})();
