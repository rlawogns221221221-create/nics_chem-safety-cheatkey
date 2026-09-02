/* 바탕화면에 놓고 쓰기(웹앱) — 그리고 **링크가 확실히 도는지**
   ───────────────────────────────────────────────────────────────
   ── 이 묶음이 이렇게 된 이유 ────────────────────────────────────
   원래 이 묶음은 "서비스워커가 등록되고, 인터넷을 끊어도 화면이 뜬다"를
   검사했습니다. 그런데 실제 배포 주소(Cloudflare Pages)에서 **하위 화면
   (res/index.html 등)으로 들어가면 연결이 끊겼습니다**(ERR_FAILED).
   원인을 셋이나 찾아 고쳤는데(리다이렉트 딱지 지우기 · 미리 받을 때도 같은
   처리 · skipWaiting) **네 번 올려도 그대로였습니다.**

   그래서 서비스워커를 **뺐습니다.** 시범운영에 필요한 것은 "링크를 누르면
   도구가 열리는 것"이고, 되는지 확신 못 하는 기능 때문에 그것이 안 되면
   안 됩니다. 이제 이 묶음이 검사하는 것은 반대입니다 —

     · 서비스워커가 화면을 맡지 않는지(예전 것이 남아 있으면 지워지는지)
     · **리다이렉트를 돌려주는 서버에서도** 하위 화면 진입이 되는지
     · 바탕화면 아이콘에 필요한 것(매니페스트·아이콘·아이폰 태그)은 그대로인지
     · 망분리용 단일 파일과 `file://` 는 영향이 없는지

   검증을 신뢰하지 못하게 된 경험이라 여기서는 **실제 리다이렉트를 돌려주는
   서버를 띄워** 그 상황을 그대로 재현합니다. */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { createServer } from 'http';

/* URL 생성자를 쓰지 않습니다 — 문자열만 잘라 씁니다(tests/tok.mjs 와 같은 이유) */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/tests\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));

const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

/* ── 웹서버 두 대 ──────────────────────────────────────────────
   ① 평범한 서버        ② Cloudflare Pages 처럼 "/res/index.html" 을
                          "/res/" 로 정리해 돌려주는(308) 서버
   실제로 깨진 곳이 ② 였는데 예전 검증에는 ① 밖에 없어서 못 잡았습니다. */
function 서버만들기(주소정리) {
  return createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (주소정리 && p.endsWith('/index.html')) {
      res.writeHead(308, { location: p.slice(0, -'index.html'.length) });
      res.end();
      return;
    }
    const f = p.endsWith('/') ? p + 'index.html' : p;
    if (f.includes('..')) { res.writeHead(400).end(); return; }
    const file = RPATH + f;
    if (!existsSync(file)) { res.writeHead(404).end('없음'); return; }
    const ext = f.slice(f.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': 'no-store' });
    res.end(readFileSync(file));
  });
}
const server = 서버만들기(false);
const server2 = 서버만들기(true);
await new Promise(r => server.listen(0, '127.0.0.1', r));
await new Promise(r => server2.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const BASE2 = `http://127.0.0.1:${server2.address().port}`;

const browser = await chromium.launch();

/* ══ 1. 매니페스트 — 바탕화면 아이콘에 필요한 것 ═════════════ */
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

/* ══ 3. sw.js 는 스스로를 지우는 것이어야 한다 ═══════════════
   실제로 올려 보고 네 번 깨진 뒤 이 기능을 뺐습니다. 파일을 지우지 않고
   남겨 둔 이유는, 이미 예전 판을 열어 본 사람의 브라우저에 고장 난 것이
   설치되어 있어 **그 사람들을 고쳐 주어야** 하기 때문입니다.
   되살리려면 실제 배포 주소에서 하위 화면 진입을 먼저 확인하세요. */
const sw = readFileSync(`${RPATH}/sw.js`, 'utf8');
chk(/registration\.unregister\(\)/.test(sw),
  'sw.js 가 자기 등록을 지운다(예전에 깔린 고장 난 것을 고쳐 준다)');
chk(/caches\["delete"\]|caches\.delete/.test(sw),
  'sw.js 가 저장해 둔 것도 비운다(옛 화면·옛 자료가 남지 않게)');
chk(/self\.skipWaiting\(\)/.test(sw),
  'sw.js 가 skipWaiting() 으로 예전 것을 바로 밀어낸다'
  + '(없으면 탭을 다 닫을 때까지 고장 난 것이 계속 화면을 맡는다)');
chk(!/addEventListener\("fetch"/.test(sw),
  'sw.js 가 fetch 를 가로채지 않는다 — 화면 이동을 망가뜨릴 여지가 없다');
const pwajs = readFileSync(`${RPATH}/assets/pwa.js`, 'utf8');
chk(!/serviceWorker\.register\(/.test(pwajs),
  'pwa.js 가 서비스워커를 등록하지 않는다');
chk(/getRegistrations\(\)/.test(pwajs),
  'pwa.js 가 예전에 설치된 서비스워커를 찾아 지운다');

/* ══ 4. 링크가 도는가 — 평범한 서버 ═════════════════════════ */
for (const [BASEx, 이름] of [[BASE, '평범한 서버'],
                             [BASE2, '주소를 정리해 돌려주는 서버(Cloudflare 식)']]) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASEx}/`);
  await page.waitForLoadState('load');
  chk(await page.evaluate(() => document.querySelectorAll('.pn').length) === 3,
    `${이름} — 진입 화면에 카드 세 장이 뜬다`);

  /* 카드를 실제로 눌러 들어가 본다 — 사용자가 겪은 그 동작 그대로 */
  for (const [n, sel, what] of [
    [1, '.rz', '방제 물품·장비 찾기'],
    [2, '#map', '주민 대피장소 찾기'],
    [3, '.stepbar', '주민대피 문자생성기'],
  ]) {
    await page.goto(`${BASEx}/`);
    await page.waitForLoadState('load');
    let err = null;
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load' }),
        page.click(`.pn:nth-of-type(${n}) a`),
      ]);
    } catch (e) { err = e; }
    chk(!err, `${이름} — ${what} 카드를 눌러 들어갈 수 있다`
      + (err ? ` (${String(err.message || err).slice(0, 70)})` : ''));
    if (!err) {
      chk(await page.$(sel) !== null, `${이름} — ${what} 화면이 그려진다`);
      chk(await page.evaluate(() =>
        typeof window.SHELTERS !== 'undefined' || typeof window.MATERIALS !== 'undefined'),
        `${이름} — ${what} 의 자료가 들어 있다`);
    }
  }

  /* 주소를 직접 쳐서 들어가는 경우도(공문에 적어 보내는 방식) */
  let 직접 = null;
  try {
    await page.goto(`${BASEx}/res/index.html`, { waitUntil: 'load' });
  } catch (e) { 직접 = e; }
  chk(!직접, `${이름} — 주소를 직접 쳐서 하위 화면에 들어갈 수 있다`
    + (직접 ? ` (${String(직접.message || 직접).slice(0, 70)})` : ''));

  /* 서비스워커가 화면을 맡고 있지 않아야 한다 */
  await page.waitForTimeout(600);
  const 맡음 = await page.evaluate(async () => {
    const regs = navigator.serviceWorker.getRegistrations
      ? await navigator.serviceWorker.getRegistrations() : [];
    return { 등록: regs.length, 조종: !!navigator.serviceWorker.controller,
             캐시: (await caches.keys()).length };
  });
  chk(맡음.등록 === 0 && !맡음.조종,
    `${이름} — 서비스워커가 화면을 맡지 않는다 (등록 ${맡음.등록} · 조종 ${맡음.조종})`);
  chk(맡음.캐시 === 0, `${이름} — 저장해 둔 꾸러미가 없다 (${맡음.캐시}개)`);
  await ctx.close();
}

/* ══ 5. 예전에 깔린 고장 난 서비스워커가 스스로 지워지는가 ═══
   이미 사이트를 열어 본 사람의 브라우저에는 예전 것이 남아 있습니다.
   그 상황을 그대로 만들어(예전 sw.js 를 직접 등록) 지금 판을 열었을 때
   지워지는지 봅니다 — 이것이 안 되면 그 사람들은 계속 고장 난 것을 봅니다. */
const c수리 = await browser.newContext();
const p수리 = await c수리.newPage();
await p수리.goto(`${BASE2}/`);
await p수리.waitForLoadState('load');
/* 예전 것처럼 화면 이동을 가로채는 서비스워커를 손으로 등록해 둔다 */
await p수리.evaluate(() => navigator.serviceWorker.register('./sw.js')
  .then(r => r.update()).catch(() => {}));
await p수리.waitForTimeout(1200);
await p수리.goto(`${BASE2}/`);
await p수리.waitForLoadState('load');
await p수리.waitForTimeout(1200);
const 수리결과 = await p수리.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  return { 등록: regs.length, 캐시: (await caches.keys()).length };
});
chk(수리결과.등록 === 0,
  `예전에 깔린 서비스워커가 스스로 지워진다 (남은 등록 ${수리결과.등록}개)`);
let 수리후 = null;
try {
  await p수리.goto(`${BASE2}/res/index.html`, { waitUntil: 'load' });
} catch (e) { 수리후 = e; }
chk(!수리후, '지워진 뒤에는 하위 화면 진입이 정상이다'
  + (수리후 ? ` (${String(수리후.message || 수리후).slice(0, 70)})` : ''));
await c수리.close();

/* ══ 6. 설치 안내 — 기기에 맞는 것만 나오는가 ════════════════ */
const c2 = await browser.newContext();
const p2 = await c2.newPage();
await p2.goto(`${BASE}/index.html`);
await p2.waitForLoadState('load');
chk(await p2.$('.inst') === null, '아무 일 없으면 설치 안내가 없다(빈 자리만 있음)');
/* 크롬·엣지가 "설치할 수 있다"고 알려 오면 단추를 단다.
   (실제 사건은 조건이 맞아야 오므로, 같은 모양의 사건을 만들어 확인합니다) */
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

await browser.close();
server.close();
server2.close();

console.log(`PASS ${ok.length} / FAIL ${bad.length}`);
for (const m of ok) console.log('  ✓ ' + m);
for (const m of bad) console.log('  ✗ ' + m);
process.exit(bad.length ? 1 : 0);
