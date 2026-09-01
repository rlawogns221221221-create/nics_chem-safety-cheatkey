/* ② 지도 → ① 문자 생성 이어쓰기 (피드백 2번) */
import { chromium } from 'playwright';
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
const R = RDIR;

const page = async (w = 1500, h = 900) => {
  const P = await B.newPage({ viewport: { width: w, height: h } });
  P.on('pageerror', e => errs.push(e.message));
  return P;
};

// ══ 1. 사고지점 없으면 단추가 안 보인다 ══
{
  const P = await page();
  await P.goto(`${R}/map/index.html`); await P.waitForTimeout(800);
  chk(await P.isHidden('#btnToSms'), '사고지점 전에는 이어쓰기 단추가 없다');
  await P.close();
}

// ══ 2. 좌표로 사고지점 → 단추 문구 → 넘어가서 값이 들어감 ══
{
  const P = await page();
  await P.goto(`${R}/map/index.html`); await P.waitForTimeout(800);

  // 김천시청 근처
  await P.fill('#acLat', '36.14');
  await P.fill('#acLon', '128.1137');
  await P.waitForTimeout(900);

  chk(!(await P.isHidden('#btnToSms')), '사고지점을 넣으면 단추가 나온다');
  const label = await P.textContent('#toSmsTxt');
  console.log('단추 문구:', label);
  chk(/시군/.test(label), '무엇이 넘어가는지 단추에 적혀 있다 (시군)');
  chk(/대피소/.test(label), '무엇이 넘어가는지 단추에 적혀 있다 (대피소)');

  // 지도에서 본 가까운 곳 이름을 기억해 두고 비교한다
  const expect = await P.evaluate(() => {
    const raw = document.querySelector('#btnToSms');
    return null;
  });
  const firstName = await P.evaluate(() => {
    const el = document.querySelector('#shList .ms-it .l1 b');
    return el ? el.textContent.trim() : null;
  });

  await P.click('#btnToSms');
  await P.waitForTimeout(1200);
  chk(P.url().includes('/sms/'), '문자 생성 도구로 넘어간다');

  chk(!(await P.isHidden('#seedBar')), '넘어온 값을 알리는 띠가 뜬다');
  const bar = await P.textContent('#seedBar');
  console.log('알림 띠:', bar.replace(/\s+/g, ' ').trim());
  chk(/찾기에서 넘어왔습니다/.test(bar), '어디서 왔는지 적혀 있다');
  chk(/김천/.test(bar), '시·군·구가 넘어왔다');

  // 실제 입력칸에 값이 들어갔는지 — 대피소 칸은 '주민소산(대피명령)'에만 있다
  await P.evaluate(() => {
    [...document.querySelectorAll('#stages button')]
      .find(b => /주민소산|대피명령/.test(b.textContent)).click();
  });
  await P.waitForTimeout(800);
  const vals = await P.evaluate(() => {
    const o = {};
    document.querySelectorAll('#cols input[data-k], #cols select[data-k], #cols textarea[data-k]')
      .forEach(el => { if (el.value) o[el.getAttribute('data-k')] = el.value; });
    return o;
  });
  console.log('채워진 칸:', JSON.stringify(vals, null, 0));
  chk(/김천/.test(vals['시군'] || ''), '시군 칸에 값이 들어갔다');
  chk((vals['대피소'] || '').length > 1, '대피소 칸에 값이 들어갔다');
  if (firstName) chk(vals['대피소'] === firstName, '지도에서 가장 가까운 곳이 그대로 넘어왔다');

  // ── 새로고침해도 다시 덮지 않는다 ──
  await P.evaluate(() => {
    document.querySelectorAll('#cols input[data-k]').forEach(el => {
      if (el.getAttribute('data-k') === '대피소') {
        el.value = '내가고친값'; el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });
  await P.waitForTimeout(500);
  await P.reload(); await P.waitForTimeout(900);
  chk(await P.isHidden('#seedBar'), '새로고침하면 알림 띠는 사라진다');
  const after = await P.evaluate(() => {
    const el = [...document.querySelectorAll('#cols input[data-k]')]
      .find(x => x.getAttribute('data-k') === '대피소');
    return el ? el.value : null;
  });
  chk(after === '내가고친값', '새로고침해도 지도값이 내 수정을 덮어쓰지 않는다');
  await P.close();
}

// ══ 3. 알림 띠 닫기 ══
{
  const P = await page();
  await P.goto(`${R}/map/index.html`); await P.waitForTimeout(800);
  await P.fill('#acLat', '36.14'); await P.fill('#acLon', '128.1137');
  await P.waitForTimeout(900);
  await P.click('#btnToSms'); await P.waitForTimeout(1100);
  await P.click('#seedX'); await P.waitForTimeout(400);
  chk(await P.isHidden('#seedBar'), '✕ 를 누르면 알림 띠가 닫힌다');
  await P.close();
}

// ══ 4. 사고지점을 지우면 단추도 사라진다 ══
{
  const P = await page();
  await P.goto(`${R}/map/index.html`); await P.waitForTimeout(800);
  await P.fill('#acLat', '36.14'); await P.fill('#acLon', '128.1137');
  await P.waitForTimeout(900);
  await P.click('#btnAccClear'); await P.waitForTimeout(700);
  chk(await P.isHidden('#btnToSms'), '사고지점을 지우면 단추도 사라진다');
  await P.close();
}

// ══ 5. 모바일에서도 단추가 눌리는 크기인가 ══
{
  const P = await B.newPage({ viewport: { width: 390, height: 664 },
    hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  P.on('pageerror', e => errs.push('MOB: ' + e.message));
  await P.goto(`${R}/map/index.html`); await P.waitForTimeout(900);
  await P.fill('#acLat', '36.14'); await P.fill('#acLon', '128.1137');
  await P.waitForTimeout(900);
  const box = await P.evaluate(() => {
    const b = document.querySelector('#btnToSms');
    if (!b || b.hidden) return null;
    const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log('모바일 단추 크기:', JSON.stringify(box));
  chk(box && box.h >= 40, '모바일에서 단추 높이가 40px 이상');
  await P.close();
}

// ══ 6. 단일 파일판에는 단추가 없고, 그래도 오류가 없다 ══
{
  const P = await page();
  await P.goto(`${R}/dist/화학사고_주민대피장소_찾기.html`); await P.waitForTimeout(1000);
  const has = await P.evaluate(() => !!document.querySelector('#btnToSms'));
  chk(!has, '단일 파일판에는 이어쓰기 단추가 없다');
  await P.fill('#acLat', '36.14'); await P.fill('#acLon', '128.1137');
  await P.waitForTimeout(900);
  const n = await P.evaluate(() => document.querySelectorAll('#shList .ms-it').length);
  console.log('단일 파일판 대피장소 수:', n);
  chk(n > 0, '단일 파일판도 사고지점 주변을 정상으로 찾는다');
  chk(await P.evaluate(() => !document.querySelector('#cWalk')), '단일 파일판에 도보 경로 켜기가 없다');
  await P.close();
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bad.length);
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
