/* ============================================================
   바탕화면에 놓고 쓰기 (웹앱 설치) + 인터넷 없이도 열리게 하기

   ── 무엇을 하나 ─────────────────────────────────────────────
   ① 서비스워커(../sw.js)를 등록해 파일을 미리 받아 둡니다. 그래야
      현장에서 신호가 끊겨도 도구가 열리고, 안드로이드가 "홈 화면에 추가"를
      권합니다.
   ② 진입 화면 아래쪽에 **설치 안내 한 줄**을 답니다.
      · 안드로이드·PC 크롬/엣지 — 단추를 눌러 바로 설치
      · 아이폰 사파리 — 공유 → '홈 화면에 추가' 로 하는 법을 알려 줌
      · 이미 설치해 앱으로 열었으면 — 아무것도 보여 주지 않음

   ── 왜 진입 화면 **아래쪽**인가 ──────────────────────────────
   머리띠 위쪽에 뭔가를 더하면 띠가 높아져 휴대전화에서 셋째 카드가 화면
   밖으로 밀립니다(전에 실제로 그랬습니다). 그래서 카드 아래, 참고도구
   안내 옆에 둡니다. 도구를 쓰는 데 방해가 되지 않는 자리입니다.

   ── 파일을 서버에 올렸을 때만 돕니다 ─────────────────────────
   `file://` 로 열거나 `http://` 로 올리면 브라우저가 서비스워커를 막습니다.
   그때는 **아무 일도 하지 않고 조용히 넘어갑니다** — 망분리 PC 용 단일
   파일도 그대로 열려야 하기 때문입니다.
   ============================================================ */
(function () {
"use strict";

/* ── ① 서비스워커 등록 ──────────────────────────────────────── */

/* 이 파일이 어디에 있는지로 사이트 뿌리를 찾습니다. 진입 화면은 뿌리에,
   도구 세 개는 한 칸 아래에 있어서 `../sw.js` 와 `./sw.js` 가 갈립니다.
   경로를 화면마다 손으로 적으면 하나 빠뜨리게 되므로 여기서 계산합니다. */
function siteRoot() {
  var s = document.currentScript;
  if (!s || !s.src) return null;
  return s.src.replace(/assets\/pwa\.js.*$/, "");
}

function 서버에올렸나() {
  var p = location.protocol;
  /* localhost 는 개발용으로 브라우저가 예외로 허용합니다 */
  return p === "https:"
      || (p === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname));
}

if ("serviceWorker" in navigator && 서버에올렸나()) {
  var root = siteRoot();
  if (root) {
    window.addEventListener("load", function () {
      /* updateViaCache:"none" — sw.js 자체는 늘 새로 확인하게 합니다.
         이것이 없으면 브라우저가 옛 sw.js 를 하루까지 들고 있어서
         자료를 갈아 끼워도 반영이 늦습니다. */
      navigator.serviceWorker.register(root + "sw.js",
        { scope: root, updateViaCache: "none" })["catch"](function () {
          /* 등록이 안 돼도 화면은 그대로 동작합니다 — 알릴 일이 아닙니다 */
        });
    });
  }
}

/* ── ② 설치 안내 ───────────────────────────────────────────── */

function 이미앱으로열었나() {
  try {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
      return true;
  } catch (e) { /* 오래된 브라우저 */ }
  return navigator.standalone === true;   /* 아이폰 사파리 */
}

function 아이폰인가() {
  var ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  /* 아이패드는 iPadOS 13 부터 자기를 맥이라고 말합니다. 손가락으로 누르는
     맥은 없으므로 그것으로 가릅니다. */
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

var slot = null, prompt = null;

function 자리찾기() {
  if (slot) return slot;
  var host = document.querySelector("[data-install-slot]");
  if (!host) return null;
  slot = document.createElement("p");
  slot.className = "inst noprint";
  host.appendChild(slot);
  return slot;
}

/* 크롬·엣지는 설치할 수 있게 되면 이 사건을 보냅니다. 기본 동작(주소창
   구석의 작은 아이콘)만으로는 아무도 못 찾으므로, 우리가 단추를 답니다. */
window.addEventListener("beforeinstallprompt", function (e) {
  if (이미앱으로열었나()) return;
  e.preventDefault();               /* 브라우저 자체 안내를 잠시 막고 */
  prompt = e;                       /* 단추를 눌렀을 때 우리가 띄웁니다 */
  var box = 자리찾기();
  if (!box) return;
  box.innerHTML = "";
  box.appendChild(document.createTextNode("이 서비스를 바탕화면에 놓고 쓸 수 있습니다. "));
  var b = document.createElement("button");
  b.type = "button";
  b.className = "instbtn";
  b.appendChild(document.createTextNode("바탕화면에 추가"));
  b.onclick = function () {
    if (!prompt) return;
    prompt.prompt();
    prompt = null;
    b.disabled = true;
  };
  box.appendChild(b);
});

window.addEventListener("appinstalled", function () {
  if (slot) slot.parentNode.removeChild(slot);
  slot = null;
  prompt = null;
});

/* 아이폰 사파리는 위 사건을 보내지 않습니다 — 사람이 공유 단추를 눌러야
   합니다. 그 방법을 모르면 영영 설치하지 못하므로 글로 적어 줍니다. */
function 아이폰안내() {
  if (!아이폰인가() || 이미앱으로열었나()) return;
  var box = 자리찾기();
  if (!box) return;
  box.textContent = "아이폰·아이패드에서는 사파리 아래쪽 공유 단추(□↑)를 누르고 "
    + "‘홈 화면에 추가’ 를 고르면, 바탕화면 아이콘으로 바로 열 수 있습니다.";
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", 아이폰안내);
else 아이폰안내();

})();
