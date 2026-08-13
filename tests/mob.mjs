/* 모바일 전체 점검 — 진입화면 + 세 도구, 여러 기기, 세로·가로 */
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
const R = RDIR;
const found = [];                       // 문제만 모은다
const note = (dev, page, msg) => found.push(`[${dev} · ${page}] ${msg}`);
let checks = 0;

/* 실제로 쓰이는 작은 화면들. 360×640 은 아직 현장에 많은 보급형이다. */
const DEVICES = [
  ['갤럭시S8(360)', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
                     userAgent: devices['Galaxy S8'] ? devices['Galaxy S8'].userAgent : undefined }],
  ['아이폰13(390)', devices['iPhone 13']],
  ['아이폰13 가로', { ...devices['iPhone 13'], viewport: { width: 844, height: 390 } }],
  ['아이패드(820)', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];

const PAGES = [
  ['진입화면', `${R}/index.html`],
  ['① 문자작성', `${R}/sms/index.html`],
  ['② 대피장소', `${R}/map/index.html`],
  ['③ 방제자원', `${R}/res/index.html`],
];

for (const [dev, cfg] of DEVICES) {
  for (const [pname, url] of PAGES) {
    const ctx = await B.newContext({ ...cfg, permissions: ['geolocation'],
      geolocation: { latitude: 36.14, longitude: 128.1137, accuracy: 50 } });
    const P = await ctx.newPage();
    const jsErr = [];
    P.on('pageerror', e => jsErr.push(e.message));
    P.on('console', m => { if (m.type() === 'error' && !/TUNNEL|net::/.test(m.text())) jsErr.push(m.text()); });
    await P.goto(url); await P.waitForTimeout(800);
    // ③ 은 시작 화면부터 — 지도·조건은 사고지점을 정한 뒤에 나온다
    if (pname.includes('방제자원')) {
      const b = await P.$('#startPick');
      if (b) { await b.click(); await P.waitForTimeout(900); }
    }
    checks++;

    // ── 1. 가로 스크롤 (화면 밖으로 삐져나감) ──
    const over = await P.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) {
      const culprits = await P.evaluate(() => {
        const W = document.documentElement.clientWidth, out = [];
        document.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > W + 1)
            out.push((el.id ? '#' + el.id : el.tagName.toLowerCase()
              + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''))
              + ` (오른쪽 ${Math.round(r.right - W)}px 초과)`);
        });
        return [...new Set(out)].slice(0, 4);
      });
      note(dev, pname, `가로로 ${over}px 넘침 → ${culprits.join(', ')}`);
    }

    // ── 2. 누르기 힘든 버튼 (권장 44×44, 최소 32 는 넘어야) ──
    const tiny = await P.evaluate(() => {
      const out = [];
      document.querySelectorAll('button, a[href], select, input[type=checkbox]').forEach(el => {
        if (el.offsetParent === null) return;                 // 안 보이는 것 제외
        /* 체크박스를 라벨이 감싸고 있으면 라벨 전체가 누르는 자리다 —
           체크박스만 재면 실제보다 작게 나온다 */
        const hit = (el.type === 'checkbox' && el.closest('label')) || el;
        const r = hit.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.height < 32 || r.width < 24)
          out.push((el.id ? '#' + el.id : (el.textContent || el.tagName).trim().slice(0, 14))
            + ` ${Math.round(r.width)}×${Math.round(r.height)}`);
      });
      return [...new Set(out)].slice(0, 6);
    });
    if (tiny.length) note(dev, pname, `손가락으로 누르기 작음: ${tiny.join(' / ')}`);

    // ── 3. 너무 작은 글자 ──
    const small = await P.evaluate(() => {
      const out = [];
      document.querySelectorAll('body *').forEach(el => {
        if (!el.childNodes.length || el.offsetParent === null) return;
        const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
        if (!hasText) return;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 11) out.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''} ${fs}px`);
      });
      return [...new Set(out)].slice(0, 5);
    });
    if (small.length) note(dev, pname, `글자 작음(11px 미만): ${small.join(' / ')}`);

    // ── 4. 지도가 있는 화면: 지도 높이·조작부 확인 ──
    if (await P.$('#map')) {
      const m = await P.evaluate(() => {
        const r = document.getElementById('map').getBoundingClientRect();
        const acc = document.querySelector('.mapacc');
        return { h: Math.round(r.height), top: Math.round(r.top),
                 accH: acc ? Math.round(acc.getBoundingClientRect().height) : 0,
                 vh: innerHeight };
      });
      if (m.h < 180) note(dev, pname, `지도가 너무 낮음 (${m.h}px)`);
      if (m.accH > m.h * 0.45)
        note(dev, pname, `사고지점 조작줄이 지도를 ${Math.round(m.accH / m.h * 100)}% 가림 (지도 ${m.h}px / 조작줄 ${m.accH}px)`);
    }

    // ── 5. 겹쳐서 글자를 가리는 것 ──
    const overlap = await P.evaluate(() => {
      const pick = s => [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null
        && !e.hidden && e.getBoundingClientRect().width > 0);
      const floats = pick('.mnear, .mapaddr, .mapscale, .maplegend, .mtoast, .mapctl, .mob');
      const out = [];
      for (let i = 0; i < floats.length; i++)
        for (let j = i + 1; j < floats.length; j++) {
          const a = floats[i].getBoundingClientRect(), b = floats[j].getBoundingClientRect();
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 8 && oy > 8) {
            const nm = e => e.id ? '#' + e.id : '.' + e.className.trim().split(/\s+/)[0];
            out.push(`${nm(floats[i])} ↔ ${nm(floats[j])} (${Math.round(ox)}×${Math.round(oy)}px)`);
          }
        }
      return [...new Set(out)].slice(0, 4);
    });
    if (overlap.length) note(dev, pname, `지도 위 패널끼리 겹침: ${overlap.join(', ')}`);

    // ── 6. 자바스크립트 오류 ──
    if (jsErr.length) note(dev, pname, `JS 오류: ${[...new Set(jsErr)].slice(0, 2).join(' / ')}`);

    await ctx.close();
  }
}

console.log(`화면 ${checks}개 점검 · 문제 ${found.length}건\n`);
if (!found.length) console.log('  문제 없음');
found.forEach(f => console.log('  · ' + f));
await B.close();
