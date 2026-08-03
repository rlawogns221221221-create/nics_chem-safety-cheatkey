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
var state = { stage: null, type: "누출", data: {}, unknownMat: false, use71: false };

/* ── 상태 저장 (sessionStorage: 브라우저를 닫으면 사라짐) ───────── */
function save() {
  try { sessionStorage.setItem(SESS, JSON.stringify(state)); } catch (e) {}
}
function load() {
  try {
    var r = sessionStorage.getItem(SESS);
    if (!r) return false;
    var o = JSON.parse(r);
    if (o && o.data) { state = o; return true; }
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

/* 이번 단계에서 실제로 생성할 문안 — 7-1번은 선택했을 때만 */
function stageTemplates(stage) {
  return stage.문안.filter(function (id) { return !TEMPLATES[id].부가 || state.use71; });
}

function validate(results) {
  var errs = [], warns = [], d = state.data;

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

  // 3. 글자수 초과
  results.forEach(function (r) {
    if (r.over) errs.push(r.tpl.번호 + " 문안이 축약 후에도 " + r.limit + "자를 "
      + (r.len - r.limit) + "자 초과합니다. 대상지역·대피소 표기를 줄이세요.");
  });

  // 4. 논리 충돌
  var evacWords = /즉시\s*대피|대피바람|대피요망|대피하시|대피명령|대피발령/;
  if (state.stage === "indoor" || state.stage === "indoor_end") {
    results.forEach(function (r) {
      if (evacWords.test(r.text))
        errs.push(r.tpl.번호 + ": 실내대피 단계인데 외부 대피 지시 표현이 포함되어 있습니다.");
    });
  }
  if (state.stage === "indoor_end" || state.stage === "evac_end") {
    results.forEach(function (r) {
      if (/발령|즉시\s*대피/.test(r.text))
        errs.push(r.tpl.번호 + ": 종료 단계인데 대피 발령 표현이 포함되어 있습니다.");
    });
  }

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

  return { errs: errs, warns: warns };
}

/* ── 화면 ──────────────────────────────────────────────────── */

function renderTypes() {
  var wrap = $("#types");
  if (!wrap) return;
  wrap.innerHTML = INCIDENT_TYPES.map(function (t) {
    var n = (STATS && STATS.사고유형 && STATS.사고유형[t.id]) || 0;
    return '<button class="stg sm" type="button" data-t="' + t.id + '" aria-pressed="'
      + (state.type === t.id) + '"><b>' + esc(t.이름) + "</b><span>" + esc(t.설명)
      + (n ? " · " + n + "건" : "") + "</span></button>";
  }).join("");
  $$("#types .stg").forEach(function (b) {
    b.onclick = function () { state.type = b.dataset.t; save(); renderAll(); };
  });
}

function renderStages() {
  $("#stages").innerHTML = STAGES.map(function (s) {
    return '<button class="stg" type="button" data-s="' + s.id + '" aria-pressed="'
      + (state.stage === s.id) + '"><b>' + esc(s.이름) + "</b><span>" + esc(s.설명) + "</span></button>";
  }).join("");
  $$("#stages .stg").forEach(function (b) {
    b.onclick = function () { state.stage = b.dataset.s; save(); renderAll(); };
  });
}

function fieldHtml(f) {
  var v = esc(state.data[f.k] || "");
  var id = "if_" + f.k;
  var input = f.type === "time"
    ? '<input type="time" id="' + id + '" data-k="' + f.k + '" value="' + v + '">'
    : '<input type="text" id="' + id + '" data-k="' + f.k + '" value="' + v + '"'
      + (f.물질 ? ' list="matList" autocomplete="off"' : "") + ">";
  var extra = "";
  if (f.물질) {
    extra = '<label class="chk" style="padding:2px 0"><input type="checkbox" id="unkMat"'
      + (state.unknownMat ? " checked" : "") + '><span>물질 미확인 — 문구에 <b>화학물질</b>로 표기</span></label>';
  }
  return '<div class="f' + (f.wide ? " wide" : "") + '">'
    + '<label for="' + id + '">' + esc(f.label) + (f.req ? '<span class="req">*</span>' : "") + "</label>"
    + input
    + (f.help ? '<span class="fh">' + esc(f.help) + "</span>" : "")
    + extra + "</div>";
}

/* ── 물질정보 조회 ────────────────────────────────────────────
   460종 물질정보에서 이름·유사명·CAS 로 찾는다. 판단은 하지 않고 보여주기만 한다. */
var MATIDX = null;
function matIndex() {
  if (MATIDX) return MATIDX;
  MATIDX = {};
  var norm = function (x) { return String(x).replace(/[\s·,()]/g, "").toLowerCase(); };
  (typeof MATERIALS === "undefined" ? [] : MATERIALS).forEach(function (m) {
    [m.n].concat(m.a || []).concat(m.c ? [m.c] : []).forEach(function (k) {
      var key = norm(k);
      if (key && !MATIDX[key]) MATIDX[key] = m;
    });
    // "염소, 클로로" 처럼 쉼표로 여러 이름이 붙은 표제 분리
    String(m.n).split(/\s*,\s*/).forEach(function (k) {
      var key = norm(k);
      if (key && !MATIDX[key]) MATIDX[key] = m;
    });
  });
  return MATIDX;
}
function findMaterial(name) {
  var norm = function (x) { return String(x).replace(/[\s·,()]/g, "").toLowerCase(); };
  var q = norm(name);
  if (!q) return null;
  var idx = matIndex();
  if (idx[q]) return idx[q];
  // 농도 표기 제거 후 재시도 ("염산35%" → "염산")
  var q2 = q.replace(/\d+(\.\d+)?%?$/, "");
  return idx[q2] || null;
}

/* 사고유형에 따라 참고할 거리 정보가 달라진다 (원자료 「대응 방법」 항목) */
function distanceInfo(m) {
  if (!m) return [];
  if (state.type === "화재" || state.type === "폭발") {
    return m.d3 ? [["화재 동반 시 대피거리", m.d3]] : [];
  }
  var out = [];
  if (m.d1) out.push(["초기이격거리 (전 방향)", m.d1]);
  if (m.d2) out.push(["방호활동거리 (풍하방향)", m.d2]);
  return out;
}

function renderMatInfo() {
  var box = $("#matInfo");
  if (!box) return;
  if (state.unknownMat) {
    box.innerHTML = '<div class="alert i"><b>물질 미확인</b><span>물질이 확인되면 다시 조회하세요. '
      + '문구에는 <b>화학물질</b>로 표기됩니다.</span></div>';
    return;
  }
  var name = String(state.data["물질"] || "").trim();
  if (!name) { box.innerHTML = ""; return; }
  var m = findMaterial(name);
  if (!m) {
    box.innerHTML = '<div class="alert w"><b>물질정보 없음</b><span>‘' + esc(name)
      + '’은(는) 460종 물질정보에서 찾지 못했습니다. 문구 생성에는 영향이 없습니다. '
      + '이름·농도 표기를 바꿔 다시 시도해 보세요.</span></div>';
    return;
  }

  var rows = [];
  if (m.s)  rows.push(["성상·냄새", m.s]);
  if (m.vd) rows.push(["증기밀도", m.vd + (m.vdn > 1.1 ? " — 공기보다 무거움" : (m.vdn && m.vdn < 0.9 ? " — 공기보다 가벼움" : ""))]);
  if (m.fe) rows.push(["화재·폭발 가능성", m.fe]);
  if (m.fp) rows.push(["인화점", m.fp + (m.el ? " · 폭발한계 " + m.el : "")]);
  distanceInfo(m).forEach(function (x) { rows.push(x); });
  if (m.sy) rows.push(["흡입 시 증상", m.sy]);
  var 응급 = [m.e3 ? "눈: " + m.e3 : "", m.e2 ? "피부: " + m.e2 : "", m.e1 ? "흡입: " + m.e1 : ""]
              .filter(Boolean).join("\n");
  if (응급) rows.push(["응급조치", 응급]);

  // 판단 보조 알림 — 도구가 문구를 바꾸지는 않는다
  var notes = [];
  if (m.vdn > 1.1)
    notes.push("공기보다 무거운 물질입니다(증기밀도 " + m.vd + "). 지하·저지대·하수도에 체류할 수 있습니다.");
  if (m.fe && !/없음|낮음|비인화성|불연/.test(m.fe))
    notes.push("화재·폭발 가능성이 있는 물질입니다. 화기 사용 금지 안내가 필요한지 검토하세요.");
  if (m.hz >= 3)
    notes.push("NFPA 건강위험도 " + m.hz + "단계로 인체 유해성이 높습니다.");

  box.innerHTML =
    '<div class="matcard"><header>' + esc(m.n) + (m.e ? ' <em>' + esc(m.e) + "</em>" : "")
    + (m.c ? ' <span class="tag">CAS ' + esc(m.c) + "</span>" : "") + "</header>"
    + '<dl>' + rows.map(function (r) {
        return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>";
      }).join("") + "</dl>"
    + (notes.length ? '<div class="alert w" style="margin:10px 12px 12px"><b>참고</b><div><ul><li>'
        + notes.map(esc).join("</li><li>") + "</li></ul></div></div>" : "")
    + '<p class="matfoot">화학물질안전원 「화학사고 현장대응 물질정보」 발췌. '
    + '<b>대피 범위·행동요령의 판단 근거가 아니라 참고 자료입니다.</b> '
    + "거리 값은 지시받은 대상지역이 타당한지 확인하는 용도로만 보십시오.</p></div>";
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
  if (u) u.onchange = function () { state.unknownMat = u.checked; save(); renderMatInfo(); renderOut(); };
}

/* 숨겨진 카드를 건너뛰고 보이는 카드에만 1,2,3… 을 다시 매김 */
function renumber() {
  var n = 0;
  ["#cStage", "#cType", "#cInfo", "#cEvac", "#cOut"].forEach(function (sel) {
    var card = $(sel);
    if (!card || card.hidden) return;
    var badge = $(".step", card);
    if (badge) badge.textContent = ++n;
  });
}

function renderFields() {
  var isEvac = state.stage === "evac";
  $("#cInfo").hidden = !state.stage;
  $("#cType").hidden = !state.stage;
  $("#cEvac").hidden = !isEvac;

  $("#fCommon").innerHTML = FIELDS.공통.map(fieldHtml).join("");
  bindFields($("#fCommon"));

  if (isEvac) {
    $("#fEvac").innerHTML = FIELDS.evac.filter(function (f) { return !f.부가; }).map(fieldHtml).join("");
    $("#fEvacExtra").innerHTML = FIELDS.evac.filter(function (f) { return f.부가; }).map(fieldHtml).join("");
    bindFields($("#fEvac")); bindFields($("#fEvacExtra"));

    var c71 = $("#use71"), d71 = $("#d71");
    c71.checked = state.use71;
    d71.hidden = !state.use71;
    d71.open = state.use71;
    c71.onchange = function () {
      state.use71 = c71.checked;
      d71.hidden = !c71.checked; d71.open = c71.checked;
      save(); renderOut();
    };
  }
}

var lastResults = [];

function renderOut() {
  var stage = STAGES.filter(function (s) { return s.id === state.stage; })[0];
  $("#cOut").hidden = !stage;
  if (!stage) return;

  lastResults = stageTemplates(stage).map(build);
  var v = validate(lastResults);

  var a = "";
  if (v.errs.length)
    a += '<div class="alert e"><b>확인 필요</b><div><ul><li>'
       + v.errs.map(esc).join("</li><li>") + "</li></ul></div></div>";
  if (v.warns.length)
    a += '<div class="alert w"><b>주의</b><div><ul><li>'
       + v.warns.map(esc).join("</li><li>") + "</li></ul></div></div>";
  if (!v.errs.length && !v.warns.length)
    a += '<div class="alert s"><b>확인 완료</b><span>필수항목·글자수·논리 검사에서 발견된 문제가 없습니다.</span></div>';
  $("#alerts").innerHTML = a;

  var blocked = v.errs.length > 0;

  $("#out").innerHTML = lastResults.map(function (r, i) {
    var cls = r.limit ? (r.len > r.limit ? "over" : (r.len > r.limit - 8 ? "near" : "")) : "";
    var cnt = r.limit
      ? '<span class="cnt ' + cls + '">' + r.len + " / " + r.limit + '자</span>'
      : '<span class="cnt"><small>' + r.len + "자 · 길이 제한 없음</small></span>";
    var chip = r.tpl.channel === "cbs"
      ? '<span class="tag">긴급재난문자</span>' : '<span class="tag g">자체 시스템</span>';
    var note = r.removed.length
      ? '<div class="alert i" style="margin:0 13px 11px"><b>축약함</b><span>'
        + r.limit + "자에 맞추기 위해 <b>" + esc(r.removed.join(", "))
        + "</b> 항목을 제외했습니다. 필요하면 입력값을 줄이고 다시 확인하세요.</span></div>"
      : "";
    return '<div class="out"><header><h3>' + esc(r.tpl.번호) + " <em>· " + esc(r.tpl.대상)
      + "</em></h3>" + chip + "</header>"
      + '<div class="msg" id="m' + i + '">' + esc(r.text) + "</div>" + note
      + "<footer>" + cnt
      + '<button class="sm' + (blocked ? "" : " p") + '" data-c="' + i + '"'
      + (blocked ? " disabled" : "") + ">이 문안 복사</button></footer></div>";
  }).join("");

  $$("#out button[data-c]").forEach(function (b) {
    b.onclick = function () { copyText(lastResults[b.dataset.c].text, b); };
  });

  gate();
  renumber();
}

/* 복사 전 3항목 확인 */
function gate() {
  var ok = $$(".gate").every(function (c) { return c.checked; });
  var hasErr = $("#alerts .alert.e") !== null;
  $$("#out button[data-c]").forEach(function (b) {
    b.disabled = hasErr || !ok;
    b.classList.toggle("p", !b.disabled);
  });
  $("#btnTxt").disabled = !lastResults.length;
}

function copyText(t, btn) {
  var done = function () {
    var o = btn.textContent; btn.textContent = "복사됨";
    setTimeout(function () { btn.textContent = o; }, 1400);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(t).then(done, function () { fallback(t, done); });
  } else fallback(t, done);
}
function fallback(t, done) {
  var ta = document.createElement("textarea");
  ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); }
  catch (e) { window.prompt("아래 문구를 복사하세요 (Ctrl+C)", t); }
  document.body.removeChild(ta);
}

/* ── 대피장소 ──────────────────────────────────────────────── */

function renderShelters() {
  var sido = $("#sSido"), sgg = $("#sSgg"), list = $("#sList");
  sido.innerHTML = '<option value="">선택</option>'
    + Object.keys(SHELTERS).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");

  sido.onchange = function () {
    var m = SHELTERS[sido.value] || {};
    sgg.innerHTML = '<option value="">선택</option>'
      + Object.keys(m).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
    list.innerHTML = ""; $("#sCnt").textContent = "";
  };

  sgg.onchange = function () {
    var arr = ((SHELTERS[sido.value] || {})[sgg.value]) || [];
    list.innerHTML = arr.map(function (s, i) {
      var label = s[0] + (s[1] ? " (" + s[1] + ")" : "") + " · " + s[2]
        + (s[3] ? " · 수용 " + s[3].toLocaleString() + "명" : "");
      return '<option value="' + i + '">' + esc(label) + "</option>";
    }).join("");
    $("#sCnt").textContent = arr.length ? "· 관내 " + arr.length + "곳" : "· 등록된 대피장소가 없습니다";
  };

  list.onchange = function () {
    var arr = ((SHELTERS[sido.value] || {})[sgg.value]) || [];
    var picked = $$("option:checked", list).map(function (o) { return arr[o.value][0]; });
    if (!picked.length) return;
    var target = $("#shTarget").value;
    var el = $("#if_" + target);
    if (el) { el.value = picked.join(", "); state.data[target] = el.value; save(); renderOut(); }
  };
}

/* ── 참고 사례 ─────────────────────────────────────────────── */

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
    }).join("") || '<p class="hint">해당 사례가 없습니다.</p>';
  };
  $("#caseF").onchange = draw; draw();
}

/* ── TXT 저장 ──────────────────────────────────────────────── */

function saveTxt() {
  var now = new Date();
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var ts = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate())
         + " " + pad(now.getHours()) + ":" + pad(now.getMinutes());
  var stage = STAGES.filter(function (s) { return s.id === state.stage; })[0];

  var L = ["화학사고 주민대피 문자 — 생성 기록", "생성일시: " + ts,
           "발송단계: " + (stage ? stage.이름 : "-"),
           "사고유형: " + state.type,
           "도구: " + VERSION.도구명 + " " + VERSION.도구버전
             + " (문안근거: " + VERSION.문안근거 + ", 반영일 " + VERSION.반영일 + ")",
           "", "[입력값]"];
  usedFields().forEach(function (f) {
    var v = (f.k === "물질" && state.unknownMat) ? "미확인" : (state.data[f.k] || "-");
    L.push("  " + f.label + ": " + v);
  });
  L.push("", "[생성 문안]");
  lastResults.forEach(function (r) {
    L.push("", "── " + r.tpl.번호 + " · " + r.tpl.제목,
           "   (" + r.len + "자" + (r.limit ? " / 상한 " + r.limit + "자" : "") + ")");
    if (r.removed.length) L.push("   축약으로 제외된 항목: " + r.removed.join(", "));
    L.push(r.text);
  });
  L.push("", "※ 본 기록은 작성 지원도구의 생성 결과이며 실제 발송 내역이 아닙니다.");

  var blob = new Blob(["﻿" + L.join("\n")], { type: "text/plain;charset=utf-8" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "화학사고_문자_" + ts.replace(/[-: ]/g, "") + ".txt";
  a.click(); URL.revokeObjectURL(a.href);
}

/* ── 초기화 ────────────────────────────────────────────────── */

function renderAll() {
  renderStages(); renderTypes(); renderFields(); renderMatInfo(); renderOut(); renumber();
}

function init() {
  // 대피장소 선택 결과를 넣을 대상 선택칸을 동적으로 추가
  var t = document.createElement("div");
  t.className = "f";
  t.innerHTML = '<label for="shTarget">선택한 장소를 넣을 칸</label>'
    + '<select id="shTarget"><option value="대피소">대피소</option>'
    + '<option value="집결지">집결지</option>'
    + '<option value="반려동물대피소">반려동물 동반 대피소</option></select>';
  $("#sList").closest(".f").parentNode.appendChild(t);

  // 물질 자동완성 목록 (사고 빈도가 높은 물질을 앞에)
  var dl = document.createElement("datalist");
  dl.id = "matList";
  var freq = (typeof STATS !== "undefined" && STATS.물질빈도) ? STATS.물질빈도 : {};
  var list = (typeof MATERIALS === "undefined" ? [] : MATERIALS).slice().sort(function (a, b) {
    var fa = (freq[a.n] || {}).n || 0, fb = (freq[b.n] || {}).n || 0;
    return fb - fa || a.n.localeCompare(b.n, "ko");
  });
  dl.innerHTML = list.map(function (m) {
    var f = (freq[m.n] || {}).n;
    return '<option value="' + esc(m.n) + '">' + esc(m.e || "") + (f ? " · 사고 " + f + "건" : "") + "</option>";
  }).join("");
  document.body.appendChild(dl);

  var resumed = load();
  renderShelters();
  renderCases();
  renderAll();
  $("#sessTag").hidden = !resumed;

  $$(".gate").forEach(function (c) { c.onchange = gate; });
  $("#btnTxt").onclick = saveTxt;
  $("#btnReset").onclick = function () {
    if (!confirm("사고 세션을 종료하고 모든 입력값을 지웁니다. 계속할까요?")) return;
    try { sessionStorage.removeItem(SESS); } catch (e) {}
    state = { stage: null, type: "누출", data: {}, unknownMat: false, use71: false };
    $$(".gate").forEach(function (c) { c.checked = false; });
    var c = $("#use71"); if (c) c.checked = false;
    $("#sessTag").hidden = true;
    renderAll();
    window.scrollTo(0, 0);
  };

  $("#ver").innerHTML =
    "문안 근거: " + esc(VERSION.문안근거) + " · 반영일 " + esc(VERSION.반영일) + "<br>"
    + "대피장소: " + esc(VERSION.대피장소_출처) + " · 기준일 " + esc(VERSION.대피장소_기준일)
    + " (" + (SHELTER_META ? SHELTER_META.총건수.toLocaleString() : "-") + "건)<br>"
    + "물질정보: " + esc(VERSION.물질정보_출처) + " · " + esc(VERSION.물질정보_기준) + "<br>"
    + "사고유형 구분: " + esc(VERSION.통계_출처) + " " + esc(VERSION.통계_기간)
    + " (" + (typeof STATS !== "undefined" ? STATS.총건수.toLocaleString() : "-") + "건)<br>"
    + "글자수 상한: 긴급재난문자 " + VERSION.글자수.cbs + "자"
    + (VERSION.글자수_검증여부 ? "" : " · <b>실제 발송시스템과 산정방식 대조 전</b>") + "<br>"
    + "도구 버전 " + esc(VERSION.도구버전) + " · 관리 " + esc(VERSION.관리부서);
}

document.addEventListener("DOMContentLoaded", init);
})();
