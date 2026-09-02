/* ============================================================
   바탕화면에 놓고 쓰기 (웹앱 설치)

   ── 무엇을 하나 ─────────────────────────────────────────────
   ① 예전에 설치된 **서비스워커를 지웁니다**(아래 설명).
   ② 진입 화면 아래쪽에 **설치 안내 한 줄**을 답니다.
      · 아이폰 사파리 — 공유 → '홈 화면에 추가' 로 하는 법을 알려 줌
      · 안드로이드·PC 크롬/엣지 — 브라우저가 설치할 수 있다고 알려 오면
        단추를 답니다(안 알려 오면 안 답니다 — 5절)
      · 이미 설치해 앱으로 열었으면 — 아무것도 보여 주지 않음

   ── 왜 서비스워커를 지우나 ───────────────────────────────────
   원래는 여기서 서비스워커를 등록해 "인터넷이 끊겨도 열리게" 했습니다.
   그런데 실제 배포 주소(Cloudflare Pages)에서 **하위 화면으로 들어가면
   연결이 끊겼습니다**(ERR_FAILED). 원인을 셋 찾아 고쳤지만 네 번 올려도
   그대로였고, 시범운영에 필요한 것은 "링크를 누르면 열리는 것"이므로
   그 기능을 뺐습니다.

   문제는 **이미 사이트를 열어 본 사람의 브라우저에 그 고장 난 것이 그대로
   설치되어 있다**는 점입니다. 등록 코드만 없애면 그 사람들은 계속 고장 난
   것을 봅니다 — 자기 브라우저에 남은 것이 계속 일하기 때문입니다.
   그래서 여기서 **찾아서 지웁니다.** `sw.js` 도 스스로를 지우도록 바꿔
   두었습니다(두 길로 확실히).

   ── 왜 진입 화면 **아래쪽**인가 ──────────────────────────────
   머리띠 위쪽에 뭔가를 더하면 띠가 높아져 휴대전화에서 셋째 카드가 화면
   밖으로 밀립니다(전에 실제로 그랬습니다). 그래서 카드 아래, 참고도구
   안내 옆에 둡니다. 도구를 쓰는 데 방해가 되지 않는 자리입니다.

   ── `file://` 에서는 아무 일도 하지 않습니다 ─────────────────
   망분리 PC 용 단일 파일도 그대로 열려야 하므로, 서버에 올렸을 때만
   움직입니다.
   ============================================================ */
(function () {
"use strict";

/* ── ① 예전에 설치된 서비스워커 지우기 ──────────────────────── */

function 서버에올렸나() {
  var p = location.protocol;
  /* localhost 는 개발용으로 브라우저가 예외로 허용합니다 */
  return p === "https:"
      || (p === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname));
}

if ("serviceWorker" in navigator && 서버에올렸나()
    && navigator.serviceWorker.getRegistrations) {
  navigator.serviceWorker.getRegistrations().then(function (목록) {
    for (var i = 0; i < 목록.length; i++) 목록[i].unregister();
  })["catch"](function () { /* 못 지워도 화면은 그대로 돕니다 */ });

  /* 저장해 둔 것도 비웁니다 — 남겨 두면 옛 화면·옛 자료가 계속 보입니다 */
  if (self.caches && caches.keys) {
    caches.keys().then(function (이름들) {
      for (var i = 0; i < 이름들.length; i++) caches["delete"](이름들[i]);
    })["catch"](function () {});
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
