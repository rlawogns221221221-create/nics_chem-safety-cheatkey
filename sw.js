/* ═══════════════════════════════════════════════════════════════
   서비스워커 — 인터넷이 끊겨도 도구가 열리게 하고, 바탕화면에 깔 수 있게
   합니다. **웹서버에 올렸을 때만** 도는 파일입니다.

   ── 왜 필요한가 ────────────────────────────────────────────────
   ① 현장에서 신호가 약하거나 끊겨도 도구가 열려야 합니다. 거리 계산·
      문안 만들기·대피장소 목록은 원래 인터넷 없이 도는 기능인데, 파일
      자체를 못 받으면 화면이 아예 안 뜹니다. 그 파일들을 미리 받아 둡니다.
   ② 안드로이드가 "홈 화면에 추가"를 권하려면 서비스워커가 있어야 합니다.
      (아이폰은 없어도 되지만, 있으면 끊겼을 때도 열립니다)

   ── 어떤 방식으로 캐시하나 ──────────────────────────────────────
   **먼저 저장된 것을 보여 주고, 뒤에서 새것을 받아 둡니다**
   (stale-while-revalidate). 그래서
     · 열면 즉시 뜹니다 — 신호가 나빠도 기다리지 않습니다.
     · 인터넷이 없어도 그대로 열립니다.
     · 자료를 새로 올리면 **그다음에 열 때** 반영됩니다.
   마지막 항목이 이 방식의 값입니다. 자료를 갈아 끼운 직후 한 번은 이전
   자료가 보일 수 있습니다. 그래서 화면마다 **자료 기준일**을 늘 적어 두고
   있습니다 — 어느 시점 자료를 보고 있는지 사람이 확인할 수 있어야 합니다.
   급히 최신으로 맞춰야 하면 새로고침을 두 번 하면 됩니다.

   ── 자료를 새로 올렸을 때 ───────────────────────────────────────
   아래 `버전` 을 올리세요. 브라우저가 이 파일이 바뀐 것을 보고 새 꾸러미를
   내려받습니다. 옛 꾸러미는 activate 에서 지웁니다.
   ⚠ 버전을 안 올려도 stale-while-revalidate 가 파일을 하나씩 갱신하므로
     결국 최신이 됩니다. 버전 올리기는 **한꺼번에 확실히** 갈아 끼우는 길입니다.

   ── 바깥 주소는 건드리지 않습니다 ───────────────────────────────
   배경지도 타일·주소검색은 다른 도메인이라 여기서 가로채지 않고 그대로
   흘려보냅니다. 저장해 봐야 내용을 읽을 수 없고(opaque), 용량만 먹습니다.
   ═══════════════════════════════════════════════════════════════ */
"use strict";

var 버전 = "v1";
var CACHE = "화학사고-초동대응-" + 버전;

/* 미리 받아 둘 것 — 이것만 있으면 네 화면이 인터넷 없이 전부 동작합니다.
   진입 화면 사진(assets/img/site/*.jpg · 1.6MB)은 여기 없습니다. 없어도
   화면은 멀쩡히 뜨고, 처음 열 때 받은 것이 그때 저장됩니다. 휴대전화에서
   첫 방문에 1.6MB 를 더 받게 하지 않으려는 것입니다.

   ⚠ 이 목록은 tests/pwa 가 네 HTML 이 실제로 부르는 것과 대조합니다.
     화면에 파일을 새로 붙이면 여기에도 넣으세요(안 넣으면 검증이 잡습니다). */
var PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",

  "sms/index.html", "sms/app.js",
  "map/index.html", "map/app.js",
  "res/index.html", "res/app.js",

  "assets/krds/krds_tokens.css",
  "assets/shell.css",
  "assets/portal.css",
  "assets/theme.js",
  "assets/portal.js",
  "assets/pwa.js",
  "assets/mapcore.js",
  "assets/matpicker.js",
  "assets/shmap.js",
  "assets/online.js",

  "assets/fonts/PretendardGOV-Regular.subset.woff2",
  "assets/fonts/PretendardGOV-Bold.subset.woff2",

  "assets/img/gov-logo.png",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png",
  "assets/img/icon-180.png",

  "data/basemap.js",
  "data/boundaries.js",
  "data/cases.js",
  "data/materials.js",
  "data/resources.js",
  "data/shelters.js",
  "data/stats.js",
  "data/templates.js",
  "data/version.js",

  /* 있으면 쓰고 없으면 그 기능만 빠지는 파일 — 없어도 설치가 실패하면
     안 되므로 아래에서 하나씩 따로 받습니다(addAll 이 아니라). */
  "data/resources.geo.js",
  "data/tempshelters.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* addAll 을 쓰지 않습니다 — 하나라도 없으면(선택 파일) 전부 실패해
         설치 자체가 안 됩니다. 하나씩 받고 실패는 넘어갑니다.

         cache:"reload" 는 브라우저가 들고 있던 사본을 쓰지 않고 **새로 받게**
         합니다. 그래서 처음 열 때 2.4MB 쯤을 한 번 더 받습니다(화면을 그리며
         이미 받은 것을 또 받는 셈). 그래도 이렇게 두는 이유는, 자료를 갈아
         끼우고 버전을 올렸을 때 **옛 사본이 그대로 굳어 버리는 일**을 막아야
         하기 때문입니다. 승인받은 문안이 옛것인 채로 남는 쪽이 훨씬 나쁩니다. */
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(new Request(url, { cache: "reload" }))["catch"](function () {});
      }));
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) {
        return n === CACHE ? null : caches["delete"](n);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;

  /* 읽기만 가로챕니다 */
  if (req.method !== "GET") return;

  /* 다른 도메인(배경지도 타일·주소검색)은 그대로 흘려보냅니다 */
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        var fresh = fetch(req).then(function (res) {
          /* 200 인 것만 저장합니다. 오류 응답을 저장하면 다음에도 계속
             그 오류가 나옵니다. */
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })["catch"](function () {
          return null;
        });

        /* 저장된 것이 있으면 그것을 즉시 주고, 새것은 뒤에서 받아 둡니다 */
        if (hit) { e.waitUntil(fresh); return hit; }

        return fresh.then(function (res) {
          if (res) return res;
          /* 인터넷도 없고 저장된 것도 없을 때 — 화면 이동이라면 첫 화면을
             대신 보여 줍니다. 빈 오류 화면보다 낫습니다. */
          if (req.mode === "navigate") {
            return cache.match("index.html").then(function (home) {
              return home || Response.error();
            });
          }
          return Response.error();
        });
      });
    })
  );
});
