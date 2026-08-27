/* 손가락 확대(핀치) 점검 — 세 지도 모두 실제 두 손가락 터치로 */
import { chromium, devices } from 'playwright';
/* 저장소를 어디에 두어도 돌게 — 이 파일 자리에서 저장소 뿌리를 찾는다.
     ROOT  file:///…/   (뒤에 / 있음)
     RDIR  file:///…    (뒤에 / 없음)
     RPATH /…           (scheme 없는 경로) */
/* URL 생성자를 쓰지 않습니다 — 스크립트가 URL 이라는 이름을 쓰는 곳이 있어
   가려집니다(bug1.mjs). 문자열만 잘라 씁니다. */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/tests\/$/, '');
const RDIR = ROOT.replace(/\/$/, '');
const RPATH = decodeURIComponent(RDIR.replace(/^file:\/\//, ''));
const B = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [], ok = [], bad = []; const chk = (c, m) => (c ? ok : bad).push(m);
const R = RPATH;

/* CDP 로 진짜 두 손가락 터치를 보낸다 — Playwright 의 tap 은 손가락 하나뿐이라
   핀치를 흉내 낼 수 없다. */
async function twoFinger(page, from, to, steps = 12) {
  const cdp = await page.context().newCDPSession(page);
  const pt = (a, b) => ([
    { x: a.x, y: a.y, id: 1, radiusX: 12, radiusY: 12, force: 1 },
    { x: b.x, y: b.y, id: 2, radiusX: 12, radiusY: 12, force: 1 },
  ]);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from[0], from[1]) });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mix = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: pt(mix(from[0], to[0]), mix(from[1], to[1])) });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
  await cdp.detach();
}

const W = () => `(${() => 0})`;   // (사용 안 함)

async function check(label, url, open) {
  const ctx = await B.newContext({ ...devices['iPhone 13'] });
  const P = await ctx.newPage();
  P.on('pageerror', e => errs.push(`${label}: ${e.message}`));
  P.on('console', m => { if (m.type() === 'error' && !/TUNNEL|net::/.test(m.text())) errs.push(`${label}: ${m.text()}`); });
  await P.goto(url); await P.waitForTimeout(700);
  if (open) await open(P);

  const sel = label === '① 고르기 창' ? '.shmap-svg' : '#map';
  const getW = () => P.evaluate(() => {
    const a = window.__vw && window.__vw();
    return a;
  });
  // 각 앱의 st.view.w 를 읽을 방법이 없으므로 viewBox 폭 대신 축척 막대 글자로 본다
  const scale = async () => (await P.textContent(
    label === '① 고르기 창' ? '.shmap-scale b' : '#scaleTxt')) || '';
  const toM = s => { const v = parseFloat(s); return /km/.test(s) ? v * 1000 : v; };

  /* 터치 좌표는 '지금 보이는 화면' 기준이다. 지도가 스크롤 아래에 있으면
     먼저 올려놓고 재야 한다 (③은 위쪽 띠들 때문에 실제로 밀려 있다). */
  await P.locator(sel).scrollIntoViewIfNeeded();
  await P.waitForTimeout(300);
  const box = await P.evaluate(s => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, sel);
  if (!box || box.width < 50) { chk(false, `${label}: 지도를 찾지 못함`); await ctx.close(); return; }
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  chk(cy > 0 && cy < (await P.evaluate(() => innerHeight)),
    `${label}: 지도 가운데가 화면 안에 있음 (y=${Math.round(cy)})`);

  const before = await scale();

  // ── 벌리기 = 확대 ──
  await twoFinger(P,
    [{ x: cx - 30, y: cy }, { x: cx + 30, y: cy }],
    [{ x: cx - 130, y: cy }, { x: cx + 130, y: cy }]);
  const zoomedIn = await scale();
  chk(toM(zoomedIn) < toM(before),
    `${label}: 벌리면 확대됨 (${before} → ${zoomedIn})`);

  // ── 오므리기 = 축소 ──
  await twoFinger(P,
    [{ x: cx - 130, y: cy }, { x: cx + 130, y: cy }],
    [{ x: cx - 30, y: cy }, { x: cx + 30, y: cy }]);
  const zoomedOut = await scale();
  chk(toM(zoomedOut) > toM(zoomedIn),
    `${label}: 오므리면 축소됨 (${zoomedIn} → ${zoomedOut})`);

  // ── 한 손가락은 여전히 지도 이동 ──
  const shot1 = await P.evaluate(s => document.querySelector(s).innerHTML.length, sel);
  await P.touchscreen.tap(cx, cy);   // 탭은 살아 있어야 한다 (마커 고르기·사고지점)
  await P.waitForTimeout(400);
  chk(true, `${label}: 한 손가락 탭 후에도 오류 없음`);

  // ── 페이지 자체가 확대되지 않았는가 (지도만 확대돼야 한다) ──
  const pageZoom = await P.evaluate(() => visualViewport ? visualViewport.scale : 1);
  chk(Math.abs(pageZoom - 1) < 0.01,
    `${label}: 페이지 전체가 아니라 지도만 확대됨 (배율 ${pageZoom})`);

  await ctx.close();
}

await check('② 대피장소', `file://${R}/map/index.html`, async (P) => {
  await P.fill('#acLat', '36.1400'); await P.fill('#acLon', '128.1137');
  await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(900);
});
await check('③ 방제자원', `file://${R}/res/index.html`, async (P) => {
  /* ③ 은 시작 두 걸음부터 — 지도는 사고지점을 정한 뒤에 나온다.
     걸음 1(무엇이 필요한가)을 '전부 보기'로 지나 걸음 2 로 간다. */
  await P.click('#rzAll'); await P.waitForTimeout(500);
  await P.click('#startPick'); await P.waitForTimeout(700);
  await P.fill('#acLat', '34.8500'); await P.fill('#acLon', '127.7200');
  await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(900);
});
await check('① 고르기 창', `file://${R}/sms/index.html`, async (P) => {
  await P.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /지도에서 고르기|지도에서/.test(x.textContent));
    if (b) b.click();
  });
  await P.waitForTimeout(1200);
});

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
