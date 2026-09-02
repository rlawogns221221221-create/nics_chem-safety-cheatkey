/* 바탕화면에 놓고 쓰기(웹앱) + 인터넷 없이 열리기
   ───────────────────────────────────────────────────────────────
   왜 이 검증이 필요한가 — 이 기능은 **웹서버에 올렸을 때만** 돕니다.
   개발 중에는 file:// 로 열어 보는데, 그 상태에서는 서비스워커가 아예
   막혀 있어서 "잘 되는 것처럼" 보입니다. 실제로 올린 뒤에야 안 되는 것을
   알게 되면 이미 지자체에 링크를 뿌린 뒤입니다.

   그래서 여기서는 **진짜 웹서버를 띄워** localhost 로 열어 봅니다
   (브라우저는 localhost 를 https 와 같게 취급해 서비스워커를 허용합니다).
   그리고 실제로 **인터넷을 끊고** 다시 열어 화면이 뜨는지 봅니다.

   또 하나 — sw.js 의 미리받을목록(PRECACHE)이 화면이 실제로 부르는 것과
   어긋나면, 끊긴 자리에서 도구가 반쪽만 열립니다. 눈으로는 못 찾습니다.
   그래서 네 HTML 을 긁어 목록과 대조합니다. */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { createServer } from 'http';

/* URL 생성자를 쓰지 않습니다 — 문자열만 잘라 씁니다(tests/tok.mjs 와 같은 이유) */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/tests\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));

const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);

/* ── 아주 작은 정적 웹서버 ────────────────────────────────────
   http-server 같은 도구를 새로 들이지 않습니다. 이 저장소는 npm 을 쓰지
   않는 것이 규칙이고, 필요한 것은 "파일을 그대로 돌려주는 것"뿐입니다. */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  /* 상위 폴더로 빠져나가는 요청은 막습니다 */
  if (p.includes('..')) { res.writeHead(400).end(); return; }
  const file = RPATH + p;
  if (!existsSync(file)) { res.writeHead(404).end('없음'); return; }
  const ext = p.slice(p.lastIndexOf('.'));
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    /* 서비스워커 동작만 보면 되므로 브라우저 캐시는 끕니다 */
    'cache-control': 'no-store',
  });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();

/* ══ 1. 매니페스트 ═══════════════════════════════════════════ */
const mf = JSON.parse(readFileSync(`${RPATH}/manifest.webmanifest`, 'utf8'));
chk(mf.name === '화학사고 초동대응 지원 서비스',
  `매니페스트 이름이 정해진 서비스명이다 (${mf.name})`);
/* 홈 화면 이름표는 기기가 열 글자쯤에서 자릅니다 — 길면 "화학사고 초…" 가 됩니다 */
chk(mf.short_name && mf.short_name.length <= 12,
  `짧은 이름이 홈 화면에서 안 잘린다 (${mf.short_name} · ${mf.short_name.length}자)`);
chk(mf.display === 'standalone', `앱처럼 열린다 (display=${mf.display})`);
/* 상대경로여야 어느 서버의 어느 폴더에 올려도 동작합니다 */
chk(!mf.start_url.startsWith('/') && !mf.scope.startsWith('/'),
  `start_url·scope 가 상대경로다 (${mf.start_url} · ${mf.scope})`);
for (const ic of mf.icons.concat(...(mf.shortcuts || []).map(s => s.icons || [])))
  chk(existsSync(`${RPATH}/${ic.src}`), `아이콘 파일이 있다 — ${ic.src}`);
const sizes = mf.icons.map(i => i.sizes);
chk(sizes.includes('192x192') && sizes.includes('512x512'),
  `안드로이드가 요구하는 192·512 가 다 있다`);
chk(mf.icons.some(i => i.purpose === 'maskable'),
  `maskable 아이콘이 있다 — 기기가 동그라미로 잘라도 그림이 안 잘린다`);

/* PNG 는 앞머리 24바이트에 크기가 적혀 있습니다 — 파일을 열지 않고 읽습니다 */
function pngSize(rel) {
  const b = readFileSync(`${RPATH}/${rel}`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
for (const [rel, want] of [['assets/img/icon-192.png', 192],
                           ['assets/img/icon-512.png', 512],
                           ['assets/img/icon-180.png', 180]]) {
  const [w, h] = pngSize(rel);
  chk(w === want && h === want, `${rel} 이 실제로 ${want}×${want} 이다 (${w}×${h})`);
}

/* ══ 2. 네 화면의 머리 태그 ══════════════════════════════════ */
const PAGES = ['index.html', 'sms/index.html', 'map/index.html', 'res/index.html'];
for (const rel of PAGES) {
  const html = readFileSync(`${RPATH}/${rel}`, 'utf8');
  const up = rel === 'index.html' ? './' : '../';
  chk(html.includes(`<link rel="manifest" href="${up}manifest.webmanifest">`),
    `${rel} — 매니페스트를 상대경로로 부른다`);
  chk(html.includes(`href="${up}assets/img/icon-180.png"`),
    `${rel} — 아이폰 홈 화면 아이콘이 있다`);
  chk(/name="apple-mobile-web-app-title" content="화학사고 초동대응"/.test(html),
    `${rel} — 아이폰 홈 화면 이름이 있다`);
  chk(/<link rel="icon" href="data:image\/svg\+xml,/.test(html),
    `${rel} — 탭 아이콘이 주소 안에 들어 있다(파일을 더 부르지 않는다)`);
  chk(html.includes(`<script src="${up}assets/pwa.js"></script>`),
    `${rel} — pwa.js 를 부른다`);
}

/* ══ 3. 미리받을목록이 화면과 어긋나지 않는가 ════════════════ */
const sw = readFileSync(`${RPATH}/sw.js`, 'utf8');

/* 실제로 겪은 사고 — 페이지 이동(mode:"navigate") 요청 객체를 그대로
   캐시 키로 쓰면 일부 브라우저에서 저장이 조용히 실패해, 첫 방문에 아직
   안 받아 둔 하위 화면(res/index.html 등)으로 들어갈 때만 연결이 아예
   끊겼다(ERR_FAILED). 사진 같은 하위 자원은 이동 요청이 아니라 멀쩡했다.
   주소 문자열로 저장·조회하게 고쳤다 — 이 검사가 되돌아가는 것을 막는다. */
chk(!/cache\.put\(req[,)]/.test(sw) && !/cache\.match\(req[,)]/.test(sw),
  'sw.js 가 요청 객체가 아니라 주소 문자열로 캐시를 저장·조회한다'
  + '(페이지 이동 요청을 그대로 캐시 키로 쓰면 하위 화면 진입이 끊긴다)');

/* 실제로 겪은 또 하나의 사고 — Cloudflare Pages 는 "/res/index.html" 을
   "/res/" 로 정리해 돌려주는데(리다이렉트), cache.add() 로 미리 받으면
   그 리다이렉트를 따라간 표시(redirected:true)가 붙은 채로 저장된다.
   나중에 화면 이동 때 그 저장본을 그대로 돌려주기만 해도 끊긴다 —
   그래서 install 단계에서 cache.add() 대신 fetch 한 뒤 표시를 지우고
   직접 넣어야 한다. */
chk(!/cache\.add\(/.test(sw),
  'sw.js 가 설치 단계에서 cache.add() 를 쓰지 않는다'
  + '(리다이렉트를 따라간 표시가 붙은 채로 저장되어 나중에 하위 화면 진입이 끊긴다)');

/* 실제로 겪은 세 번째 사고 — 고친 서비스워커를 올려도 화면이 그대로였다.
   서비스워커는 기본적으로 "이 사이트를 열어 둔 탭이 전부 닫힐 때까지"
   옛 것이 계속 맡는다. 옛 것이 고장 나 있으면 고친 것을 올려도 사용자는
   계속 고장 난 것을 본다(고친 판을 두 번 올리고도 그대로였던 이유).
   skipWaiting() 이 있어야 새로고침 한 번으로 갈린다. */
chk(/self\.skipWaiting\(\)/.test(sw),
  'sw.js 가 skipWaiting() 으로 고친 판을 바로 넘겨받는다'
  + '(없으면 고장 난 판이 탭을 다 닫을 때까지 계속 화면을 맡는다)');
chk(/PRECACHE\.map[\s\S]*?res\.redirected/.test(sw),
  'sw.js 가 미리 받을 때도 리다이렉트 표시를 지우고 저장한다');
const listed = new Set(
  (sw.match(/var PRECACHE = \[([\s\S]*?)\n\];/)[1].match(/"([^"]+)"/g) || [])
    .map(s => s.slice(1, -1)));
/* 일부러 미리 받지 않는 것 — 진입 화면 사진(1.6MB). 없어도 화면은 뜨고,
   처음 열 때 받은 것이 그때 저장됩니다. */
const RUNTIME_ONLY = /^assets\/img\/site\//;
const missing = [];
for (const rel of PAGES) {
  const dir = rel.includes('/') ? rel.slice(0, rel.indexOf('/') + 1) : '';
  const html = readFileSync(`${RPATH}/${rel}`, 'utf8');
  for (const m of html.matchAll(/(?:src|href)="(?!https?:|#|data:|mailto:|tel:)([^"]+)"/g)) {
    /* 화면 기준 경로를 사이트 뿌리 기준으로 바꿉니다 */
    let ref = m[1].replace(/^\.\//, '');
    ref = ref.startsWith('../') ? ref.slice(3) : dir + ref;
    if (RUNTIME_ONLY.test(ref)) continue;
    if (!listed.has(ref) && !missing.includes(ref)) missing.push(ref);
  }
}
chk(missing.length === 0,
  missing.length ? `sw.js 의 PRECACHE 에 빠진 것: ${missing.join(', ')}`
                 : 'sw.js 가 화면이 부르는 것을 빠짐없이 미리 받는다');
/* 반대 방향 — 목록에 있는데 파일이 없으면(선택 파일 빼고) 오타입니다 */
const OPTIONAL = new Set(['data/resources.geo.js', 'data/tempshelters.js']);
const ghosts = [...listed].filter(
  r => r !== './' && !OPTIONAL.has(r) && !existsSync(`${RPATH}/${r}`));
chk(ghosts.length === 0,
  ghosts.length ? `PRECACHE 에 없는 파일이 적혀 있다: ${ghosts.join(', ')}`
                : 'PRECACHE 에 적힌 파일이 모두 실제로 있다');

/* ══ 4. 진짜 서버에서 서비스워커가 등록되는가 ════════════════ */
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${BASE}/index.html`);
await page.waitForLoadState('load');

const reg = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.ready;
  return { scope: r.scope, active: !!r.active };
});
chk(reg.active, '서비스워커가 실제로 등록되어 돈다');
chk(reg.scope === `${BASE}/`, `관할이 사이트 뿌리다 (${reg.scope})`);

/* 관할이 뿌리여야 도구 세 개까지 덮습니다. assets/ 안에 두면 여기서 걸립니다. */
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null,
  { timeout: 10000 }).catch(() => {});
chk(await page.evaluate(() => !!navigator.serviceWorker.controller),
  '이 화면이 서비스워커의 관할 안에 있다');

/* 미리받기가 끝날 때까지 기다립니다 */
await page.waitForFunction(async () => {
  const ks = await caches.keys();
  if (!ks.length) return false;
  const c = await caches.open(ks[0]);
  return (await c.keys()).length > 30;
}, null, { timeout: 30000 });
const cached = await page.evaluate(async () => {
  const ks = await caches.keys();
  const c = await caches.open(ks[0]);
  return (await c.keys()).length;
});
chk(cached > 30, `파일 ${cached}개를 미리 받아 두었다`);

/* ══ 5. 인터넷을 끊고 다시 열어 본다 ═════════════════════════ */
await ctx.setOffline(true);

await page.goto(`${BASE}/index.html`);
const offPortal = await page.evaluate(() => ({
  cards: document.querySelectorAll('.pn').length,
  title: (document.querySelector('.hero h1') || {}).textContent || '',
}));
chk(offPortal.cards === 3, `끊긴 채로도 진입 화면에 카드 세 장이 뜬다 (${offPortal.cards}장)`);
chk(/화학사고/.test(offPortal.title), '끊긴 채로도 머리띠 제목이 뜬다');

for (const [rel, sel, what] of [
  /* 진입 화면 카드 차례대로. 번호를 안 붙인 것은 폴더 이름표(①=sms)와
     카드 번호(01=res)가 어긋나 헷갈리기 때문입니다(CLAUDE.md 1절). */
  ['res/index.html', '.rz', '방제 물품·장비 찾기'],
  ['map/index.html', '#map', '주민 대피장소 찾기'],
  ['sms/index.html', '.stepbar', '주민대피 문자생성기'],
]) {
  await page.goto(`${BASE}/${rel}`);
  const got = await page.evaluate(s => ({
    has: !!document.querySelector(s),
    /* 자료 파일까지 받아졌는지 — 못 받으면 전역 변수가 없습니다 */
    data: typeof window.SHELTERS !== 'undefined' || typeof window.MATERIALS !== 'undefined',
    err: (document.body.textContent || '').includes('없음'),
  }), sel);
  chk(got.has, `끊긴 채로도 ${what} 화면이 그려진다`);
  chk(got.data, `끊긴 채로도 ${what} 의 자료가 들어 있다`);
}

await ctx.setOffline(false);
await ctx.close();

/* ══ 6. 설치 안내 — 기기에 맞는 것만 나오는가 ════════════════ */
/* 크롬·엣지: beforeinstallprompt 가 오면 단추가 생긴다.
   (실제 사건은 설치 조건이 다 맞아야 오므로, 같은 모양의 사건을 만들어
    우리 코드가 그것을 받아 단추를 만드는지 봅니다) */
const c2 = await browser.newContext();
const p2 = await c2.newPage();
await p2.goto(`${BASE}/index.html`);
await p2.waitForLoadState('load');
chk(await p2.$('.inst') === null, '아무 일 없으면 설치 안내가 없다(빈 자리만 있음)');
await p2.evaluate(() => {
  const e = new Event('beforeinstallprompt');
  e.prompt = () => { window.__눌렀나 = true; };
  window.dispatchEvent(e);
});
const btn = await p2.$('.instbtn');
chk(!!btn, '설치할 수 있게 되면 단추가 생긴다');
if (btn) {
  const box = await btn.boundingBox();
  chk(box && box.height >= 40, `단추가 손가락으로 누를 만하다 (${Math.round(box?.height)}px)`);
  await btn.click();
  chk(await p2.evaluate(() => window.__눌렀나 === true),
    '단추를 누르면 브라우저 설치 창이 뜬다');
  chk(await p2.evaluate(() => document.querySelector('.instbtn').disabled),
    '한 번 누르면 단추가 잠긴다(같은 창이 두 번 뜨지 않게)');
}
/* 설치 안내가 카드보다 아래에 있어야 합니다 — 위에 끼우면 휴대전화에서
   셋째 카드가 화면 밖으로 밀립니다(전에 실제로 그랬습니다). */
const order = await p2.evaluate(() => {
  const cards = document.querySelector('.pnl') || document.querySelector('.pn');
  const inst = document.querySelector('.inst');
  return cards && inst
    ? (cards.getBoundingClientRect().top < inst.getBoundingClientRect().top)
    : null;
});
chk(order === true, '설치 안내가 도구 카드보다 아래에 있다');
await c2.close();

/* 아이폰: 사건이 오지 않으므로 글로 알려 준다 */
const c3 = await browser.newContext({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) '
    + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  viewport: { width: 390, height: 750 }, hasTouch: true, isMobile: true,
});
const p3 = await c3.newPage();
await p3.goto(`${BASE}/index.html`);
await p3.waitForLoadState('load');
const tip = await p3.textContent('.inst').catch(() => '');
chk(/홈 화면에 추가/.test(tip || ''),
  `아이폰에서는 공유 메뉴로 넣는 법을 알려 준다 (${(tip || '').slice(0, 24)}…)`);
chk(await p3.$('.instbtn') === null,
  '아이폰에는 눌러도 소용없는 설치 단추를 만들지 않는다');
/* 화면 밖으로 밀지 않았는지 */
const spill = await p3.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
chk(spill <= 0, `설치 안내가 좁은 화면을 옆으로 밀지 않는다 (${spill}px)`);
await c3.close();

/* ══ 7. 망분리용 단일 파일에는 들어가지 않았는가 ═════════════ */
const DIST = [
  'dist/화학사고_주민대피문자_생성기.html',
  'dist/화학사고_주민대피장소_찾기.html',
  'dist/화학사고_방제물품장비_찾기.html',
  'preview/진입화면_한파일.html',
];
for (const rel of DIST) {
  const t = readFileSync(`${RPATH}/${rel}`, 'utf8');
  const name = rel.split('/').pop();
  chk(!/<link rel="manifest"/.test(t), `${name} — 매니페스트를 부르지 않는다`);
  chk(!/<link rel="apple-touch-icon"/.test(t), `${name} — 없는 아이콘 파일을 부르지 않는다`);
  chk(!/<script src="[^"]*pwa\.js"/.test(t), `${name} — pwa.js 를 부르지 않는다`);
  chk(/<link rel="icon" href="data:image\/svg\+xml,/.test(t),
    `${name} — 탭 아이콘은 그대로 있다(주소 안에 들어 있어 파일이 필요 없음)`);
}

/* ══ 8. file:// 로 열어도 그대로 도는가 ══════════════════════ */
/* 서비스워커는 file:// 에서 막혀 있습니다. 막힌 것을 부르다 오류가 나면
   화면이 멈출 수 있으므로, 조용히 넘어가는지 봅니다. */
const c4 = await browser.newContext();
const p4 = await c4.newPage();
const errs = [];
p4.on('pageerror', e => errs.push(String(e)));
await p4.goto(`${ROOT}index.html`);
await p4.waitForLoadState('load');
chk(errs.length === 0, `file:// 로 열어도 오류가 없다 (${errs.join(' / ') || '없음'})`);
chk(await p4.evaluate(() => document.querySelectorAll('.pn').length) === 3,
  'file:// 로 열어도 카드 세 장이 그대로 뜬다');
chk(await p4.$('.inst') === null,
  'file:// 에서는 설치 안내를 띄우지 않는다(설치할 수 없는 상태이므로)');
await c4.close();

/* ══ 9. Cloudflare 식 "주소 정리" 리다이렉트를 실제로 겪어 본다 ══
   실제 사고 — Cloudflare Pages 는 "/res/index.html" 요청을 "/res/" 로
   자동으로 정리해(308) 돌려준다. 우리 서비스워커가 화면 이동(navigate)
   요청에 그 리다이렉트를 그대로 따라간 응답을 돌려주면, 크롬이
   "주소창과 실제로 받아 온 곳이 다르다"며 연결 자체를 거부한다
   (ERR_FAILED). 앞의 1~8절은 이 서버가 리다이렉트를 하지 않아 이 사고를
   그대로 두면 못 잡는다 — 그래서 실제로 리다이렉트하는 서버를 하나 더
   띄워, 진짜로 겪어 보고 확인한다. */
const server2 = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/index.html')) {
    res.writeHead(308, { location: p.slice(0, -'index.html'.length) });
    res.end();
    return;
  }
  let f = p.endsWith('/') ? p + 'index.html' : p;
  if (f.includes('..')) { res.writeHead(400).end(); return; }
  const file = RPATH + f;
  if (!existsSync(file)) { res.writeHead(404).end('없음'); return; }
  const ext = f.slice(f.lastIndexOf('.'));
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise(r => server2.listen(0, '127.0.0.1', r));
const BASE2 = `http://127.0.0.1:${server2.address().port}`;

const c5 = await browser.newContext();
const p5 = await c5.newPage();
/* 실제 이용자도 뿌리 주소로 열지 "…/index.html" 로 직접 열지 않는다 */
await p5.goto(`${BASE2}/`);
await p5.waitForLoadState('load');
await p5.waitForFunction(() => !!navigator.serviceWorker.controller, null,
  { timeout: 10000 }).catch(() => {});
/* 미리받기가 res/index.html 까지 끝날 때까지 기다린다 — 이 목록에 있는
   화면은 미리 받아 두는 것이 설계이므로, 끝난 뒤에 들어가는 것이
   실제 상황과 같다(사용자도 사이트를 열고 몇 초 뒤에 카드를 눌렀다). */
await p5.waitForFunction(async () => {
  const ks = await caches.keys();
  if (!ks.length) return false;
  const c = await caches.open(ks[0]);
  return (await c.match('res/index.html')) !== undefined;
}, null, { timeout: 15000 }).catch(() => {});

let navErr = null;
try {
  await p5.goto(`${BASE2}/res/index.html`, { waitUntil: 'load' });
} catch (e) {
  navErr = e;
}
chk(!navErr,
  '리다이렉트를 돌려주는 서버에서도 하위 화면 진입이 끊기지 않는다'
  + (navErr ? ` (${String(navErr.message || navErr).slice(0, 90)})` : ''));
if (!navErr) {
  chk(await p5.$('.rz') !== null,
    '리다이렉트를 지나 실제로 방제 물품·장비 찾기 화면이 그려진다');
}

/* 미리 받아 둔 사본이 **없는** 상태로도 들어가 본다.
   앞 검사는 미리받기가 끝난 뒤라 캐시에 있는 것을 돌려주는 길만 지났다.
   실제로는 미리받기가 끝나기 전에 카드를 누르는 사람도 있고, 목록에 없는
   주소로 들어오는 경우도 있다. 그때는 서비스워커가 **그 자리에서 받아**
   돌려주는데, 리다이렉트를 따라간 응답을 그대로 돌려주면 역시 끊긴다.
   그래서 저장된 사본을 일부러 지우고 다시 들어가 본다. */
await p5.evaluate(async () => {
  const ks = await caches.keys();
  for (const k of ks) {
    const c = await caches.open(k);
    for (const r of await c.keys()) {
      if (r.url.endsWith('/res/index.html')) await c.delete(r);
    }
  }
});
let navErr2 = null;
try {
  await p5.goto(`${BASE2}/`);
  await p5.goto(`${BASE2}/res/index.html`, { waitUntil: 'load' });
} catch (e) {
  navErr2 = e;
}
chk(!navErr2,
  '미리 받아 둔 사본이 없어도(그 자리에서 받아 올 때도) 진입이 끊기지 않는다'
  + (navErr2 ? ` (${String(navErr2.message || navErr2).slice(0, 90)})` : ''));
if (!navErr2) {
  chk(await p5.$('.rz') !== null,
    '그 자리에서 받아 온 화면도 제대로 그려진다');
}
await c5.close();
server2.close();

await browser.close();
server.close();

console.log(`PASS ${ok.length} / FAIL ${bad.length}`);
for (const m of ok) console.log('  ✓ ' + m);
for (const m of bad) console.log('  ✗ ' + m);
process.exit(bad.length ? 1 : 0);
