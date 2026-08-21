/* 진입 화면 회귀 (v4 — KRDS 표준형)

   예전 화면은 어두운 캔버스 + 마우스를 올리면 넓어지는 패널 3개였고, 이 묶음도
   그 호버 동작과 삽화(SVG)를 검사했습니다. 사용자가 KRDS 표준형으로 다시
   만들기로 정해(자바스크립트도 허용) 검사 내용을 새로 씁니다.

   지금 확인하는 것
     · 구조·기관 로고·도구 세 링크
     · **처음부터 설명이 다 보이는가** — 새 설계의 핵심(호버로만 드러나면 안 됨)
     · 고대비(어두운) 화면 켜고 끄기와 기억
     · KRDS 규격 — 본문 17px 이상, 초점 표시, 터치 영역
     · 반응형·모션 감소·JS 꺼짐·인쇄 */
import { chromium, devices } from 'playwright';
/* 저장소를 어디에 두어도 돌게 — 이 파일 자리에서 저장소 뿌리를 찾는다. */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/tests\/$/, '');
const B = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = []; const ok = [], bad = []; const chk = (c, m) => (c ? ok : bad).push(m);
const PAGE = ROOT + 'index.html';
const P = await B.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
P.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
let counting = true;
const ext = [];
P.on('request', r => { if (counting && !r.url().startsWith('file:')) ext.push(r.url()); });

await P.goto(PAGE); await P.waitForTimeout(700);

// ══ 1. 구조 ══
chk((await P.$$('h1')).length === 1, `h1 하나뿐 (${(await P.$$('h1')).length}개)`);
const h1 = await P.$eval('h1', el => ({
  t: el.textContent.trim(), r: el.getBoundingClientRect(),
  fs: parseFloat(getComputedStyle(el).fontSize)
}));
chk(h1.r.width > 100 && h1.r.height > 20, `제목이 화면에 보인다 (${Math.round(h1.r.width)}×${Math.round(h1.r.height)}px)`);
chk(h1.t.includes('화학사고'), `제목: "${h1.t}"`);
chk(h1.fs >= 24, `제목이 KRDS heading 크기 (${h1.fs}px)`);
chk((await P.$$('header.top')).length === 1 && (await P.$$('footer')).length === 1,
  '헤더·푸터 시맨틱 요소');
chk((await P.$$('main#main')).length === 1, 'main 영역 하나');
chk(await P.$eval('.tools', u => u.tagName === 'UL'), '도구 3종이 목록(ul)');
chk((await P.$$('.tools > li')).length === 3, '도구 카드 3장');
chk(ext.length === 0, `외부 요청 0건 (실제 ${ext.length}건)`);
counting = false;

// ══ 2. KRDS 규격 ══
const spec = await P.evaluate(() => ({
  root: parseFloat(getComputedStyle(document.documentElement).fontSize),
  body: parseFloat(getComputedStyle(document.body).fontSize),
  desc: parseFloat(getComputedStyle(document.querySelector('.pn-d')).fontSize),
  fam: getComputedStyle(document.body).fontFamily,
  gov: document.fonts.check('17px "Pretendard GOV"'),
  lh: parseFloat(getComputedStyle(document.body).lineHeight)
      / parseFloat(getComputedStyle(document.body).fontSize)
}));
chk(Math.abs(spec.root - 10) < 0.2, `뿌리 글자크기 62.5% = 10px (실제 ${spec.root}px)`);
chk(spec.body >= 16, `본문 16px 이상 — KRDS 기준 (실제 ${spec.body}px)`);
chk(spec.desc >= 16, `도구 설명도 16px 이상 (실제 ${spec.desc}px)`);
chk(/Pretendard GOV/.test(spec.fam), 'KRDS 표준 서체를 첫 순위로 지정');
chk(spec.gov, 'Pretendard GOV 파일이 실제로 불러와졌다');
chk(spec.lh >= 1.5, `줄높이 150% 이상 (실제 ${spec.lh.toFixed(2)})`);

// ══ 3. 기관 로고 — 원본 비율 그대로, 왼쪽 ══
const logo = await P.evaluate(() => {
  const img = document.querySelector('.logo-full');
  const r = img.getBoundingClientRect();
  return { w: r.width, h: r.height, x: r.left, nw: img.naturalWidth, nh: img.naturalHeight };
});
chk(logo.nw > 0, '로고 이미지가 실제로 불러와졌다');
const ratio = (logo.w / logo.h) / (logo.nw / logo.nh);
chk(Math.abs(ratio - 1) < 0.02, `로고 비율 그대로 (원본 대비 ${ratio.toFixed(3)}배)`);
chk(logo.x < 260, `로고가 머리띠 왼쪽에 (x=${Math.round(logo.x)})`);

// ══ 4. 도구 링크 — 카드 전체가 링크이고 '실제 업무 순서' ══
//    지도 → 문자 → 방제자원. 상사 피드백으로 정한 순서라 바꾸면 안 됩니다(b0802d4).
const links = await P.$$eval('.tools > li > a', as => as.map(a => a.getAttribute('href')));
chk(links.length === 3 && links[0] === 'map/index.html' && links[1] === 'sms/index.html'
    && links[2] === 'res/index.html', `링크 순서 지도→문자→방제: ${links.join(' / ')}`);
const nos = await P.$$eval('.pn-no', ns => ns.map(n => n.textContent.trim()));
chk(nos.join('') === '010203', `번호 01·02·03 (실제 ${nos.join('·')})`);
const hit = await P.evaluate(() => {
  const a = document.querySelector('.tools > li > a'), li = a.parentElement;
  const ar = a.getBoundingClientRect(), lr = li.getBoundingClientRect();
  return ar.width / lr.width;
});
chk(hit > 0.98, `카드 전체가 누를 수 있는 영역 (폭 비율 ${hit.toFixed(2)})`);

// ══ 5. 처음부터 다 보인다 — 새 설계의 핵심 ══
//    예전에는 마우스를 올려야 설명이 나타났습니다. 터치 화면·키보드 사용자에게
//    불리했고, 급할 때 무엇을 고를지 판단할 정보가 감춰져 있었습니다.
const shown = await P.evaluate(() => [...document.querySelectorAll('.tools > li')].map(li => {
  const d = li.querySelector('.pn-d'), m = li.querySelector('.pn-meta');
  const cs = getComputedStyle(d), ms = getComputedStyle(m);
  return { d: +cs.opacity, dh: d.getBoundingClientRect().height,
           m: +ms.opacity, mh: m.getBoundingClientRect().height };
}));
chk(shown.every(s => s.d > 0.95 && s.dh > 20), '세 카드 모두 설명이 처음부터 보인다');
chk(shown.every(s => s.m > 0.95 && s.mh > 10), '자료 건수도 처음부터 보인다');

// ══ 6. 고대비(어두운) 화면 ══
const before = await P.evaluate(() => getComputedStyle(document.body).backgroundColor);
chk(await P.evaluate(() => document.documentElement.getAttribute('data-krds-mode')) === 'light',
  '처음에는 밝은 화면');
chk(!!(await P.$('.modebtn')), '고대비 단추가 머리띠에 있다');
await P.click('.modebtn'); await P.waitForTimeout(400);
const hcMode = await P.evaluate(() => document.documentElement.getAttribute('data-krds-mode'));
const after = await P.evaluate(() => getComputedStyle(document.body).backgroundColor);
chk(hcMode === 'high-contrast', `누르면 KRDS 고대비 모드 (${hcMode})`);
chk(after !== before, `바탕색이 실제로 바뀐다 (${before} → ${after})`);
const lum = s => { const [r, g, b] = s.match(/\d+/g).map(Number); return (r * 299 + g * 587 + b * 114) / 1000; };
chk(lum(after) < 60, `고대비 바탕이 어둡다 (밝기 ${Math.round(lum(after))})`);
chk(lum(await P.evaluate(() => getComputedStyle(document.body).color)) > 180,
  '고대비 글자는 밝다');
// 새로 고쳐도 유지되는가 (localStorage)
await P.reload(); await P.waitForTimeout(500);
chk(await P.evaluate(() => document.documentElement.getAttribute('data-krds-mode')) === 'high-contrast',
  '새로 고쳐도 고대비가 유지된다');
await P.click('.modebtn'); await P.waitForTimeout(300);
chk(await P.evaluate(() => document.documentElement.getAttribute('data-krds-mode')) === 'light',
  '다시 누르면 밝은 화면으로 돌아온다');

// ══ 7. 초점 — 키보드로 갈 수 있고 표시가 보인다 ══
/* 새로 불러온다 — blur() 만으로는 탭 순서의 기준점이 되돌아가지 않아
   앞에서 누른 단추 다음 요소로 넘어간다(실제로 그랬음). */
await P.reload(); await P.waitForTimeout(500);
await P.keyboard.press('Tab');   // 첫 탭은 건너뛰기 링크여야 한다
await P.waitForTimeout(350);      // 나타나는 동작(transition)이 끝나기를 기다린다
const skip = await P.evaluate(() => {
  const a = document.activeElement;
  return { cls: a.className, top: a.getBoundingClientRect().top };
});
chk(/skip/.test(skip.cls) && skip.top > -10, `첫 탭은 건너뛰기 링크이고 화면에 나타난다 (y=${Math.round(skip.top)})`);
const focusRing = await P.evaluate(() => {
  const a = document.querySelector('.tools > li > a');
  a.focus();
  const cs = getComputedStyle(a);
  return cs.boxShadow;
});
chk(/rgb/.test(focusRing) && !/none/.test(focusRing), `카드에 초점 표시가 보인다 (${focusRing.slice(0, 40)}…)`);

// ══ 8. 터치 영역 — KRDS·접근성 ══
const taps = await P.evaluate(() => [...document.querySelectorAll('.top .act a, .top .act button')]
  .map(el => el.getBoundingClientRect().height));
chk(taps.every(h => h >= 40), `머리띠 단추가 40px 이상 (${taps.map(Math.round).join('/')})`);

// ══ 9. 반응형 ══
for (const [w, cols] of [[1440, 3], [1000, 3], [760, 1], [390, 1]]) {
  await P.setViewportSize({ width: w, height: 900 }); await P.waitForTimeout(300);
  const info = await P.evaluate(() => {
    const li = [...document.querySelectorAll('.tools > li')];
    const tops = new Set(li.map(x => Math.round(x.getBoundingClientRect().top)));
    return { cols: li.length / tops.size, over: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  chk(!info.over, `${w}px — 가로 스크롤 없음`);
  chk(Math.round(info.cols) === cols, `${w}px — 카드 ${cols}열 (실제 ${Math.round(info.cols)})`);
}
await P.setViewportSize({ width: 1440, height: 900 }); await P.waitForTimeout(200);

// ══ 10. 모바일 (실제 터치 기기) ══
const M = await B.newPage({ ...devices['iPhone 13'] });
M.on('pageerror', e => errs.push('MOBILE: ' + e.message));
await M.goto(PAGE); await M.waitForTimeout(600);
chk(!(await M.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)),
  '휴대전화 — 가로 스크롤 없음');
const mDesc = await M.evaluate(() =>
  +getComputedStyle(document.querySelector('.pn-d')).opacity);
chk(mDesc > 0.95, '휴대전화에서도 설명이 보인다 (호버가 없는 기기)');
await M.tap('.tools > li > a'); await M.waitForTimeout(600);
chk(M.url().includes('map/index.html'), '손가락으로 눌러 도구로 이동');
await M.close();

// ══ 11. 모션 감소 ══
await P.emulateMedia({ reducedMotion: 'reduce' }); await P.waitForTimeout(200);
chk(parseFloat(await P.$eval('.tools > li > a', a => getComputedStyle(a).transitionDuration)) < 0.05,
  'prefers-reduced-motion 반영');
await P.emulateMedia({ reducedMotion: 'no-preference' });

// ══ 12. JS 없이 — 고대비 단추는 없어도 진입은 되어야 한다 ══
const N = await B.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
await N.goto(PAGE); await N.waitForTimeout(300);
chk((await N.$$eval('.tools > li > a', as => as.length)) === 3, 'JS 꺼도 링크 살아 있음');
chk((await N.$$('.modebtn')).length === 0, 'JS 꺼지면 고대비 단추는 안 만들어진다');
chk(+(await N.$eval('.pn-d', d => getComputedStyle(d).opacity)) > 0.95,
  'JS 꺼도 설명이 보인다 (CSS 로만 그린다)');
await N.click('.tools > li > a'); await N.waitForTimeout(400);
chk(N.url().includes('map/index.html'), 'JS 꺼도 진입 가능');
await N.close();

// ══ 13. 인쇄 — 고대비로 보고 있어도 흰 종이에 검정 ══
await P.click('.modebtn'); await P.waitForTimeout(300);   // 고대비로 바꿔 두고
await P.emulateMedia({ media: 'print' }); await P.waitForTimeout(250);
const pr = await P.evaluate(() => ({
  photo: getComputedStyle(document.querySelector('.hero-art')).display,
  act: getComputedStyle(document.querySelector('.top .act')).display,
  card: getComputedStyle(document.querySelector('.tools > li > a')).backgroundColor,
  ink: getComputedStyle(document.body).color,
  d: +getComputedStyle(document.querySelector('.pn-d')).opacity
}));
chk(pr.photo === 'none', '인쇄 시 머리띠 그림 빼기');
chk(pr.act === 'none', '인쇄 시 단추 줄 빼기');
chk(lum(pr.card) > 200, `인쇄 시 카드 바탕이 흰색 (밝기 ${Math.round(lum(pr.card))})`);
chk(lum(pr.ink) < 60, `인쇄 시 글자가 검정 (밝기 ${Math.round(lum(pr.ink))})`);
chk(pr.d > 0.95, '인쇄 시 설명 전부 표시');
await P.emulateMedia({ media: 'screen' });
await P.click('.modebtn'); await P.waitForTimeout(300);   // 밝은 화면으로 되돌린다

/* ══ 14. 그린 그림 ════════════════════════════════════════════════
   사진을 쓰지 않습니다 — 사용자가 "사진을 이렇게 쓰면 오히려 복잡하다"고
   해서 걷어내고, 머리띠와 카드 세 장에 **그린 그림(SVG)** 을 넣었습니다.
   파일을 따로 받지 않으므로 바깥 요청이 늘지 않아야 하고, 세 카드의 그림
   칸 높이가 같아야 카드 줄이 맞습니다. */
await P.setViewportSize({ width: 1440, height: 900 }); await P.waitForTimeout(300);
const art = await P.evaluate(() => {
  const ph = [...document.querySelectorAll('.pn-ph')];
  const box = e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; };
  return {
    hero: !!document.querySelector('.hero-art svg, svg.hero-art'),
    n: ph.length,
    svgN: document.querySelectorAll('.pn-ph svg').length,
    imgN: document.querySelectorAll('.pn-ph img').length,
    boxes: ph.map(box),
    /* 장식이라 화면낭독기에는 읽히지 않아야 합니다 — 무엇을 하는 도구인지는
       제목·설명이 말합니다. */
    hidden: ph.every(e => e.getAttribute('aria-hidden') === 'true'),
    heroHidden: (document.querySelector('.hero-art') || {}).getAttribute
      && document.querySelector('.hero-art').getAttribute('aria-hidden') === 'true'
  };
});
chk(art.hero, '머리띠에 그린 그림이 있다');
chk(art.n === 3 && art.svgN === 3, `카드 세 장에 그림이 하나씩 (칸 ${art.n} · 그림 ${art.svgN})`);
chk(art.imgN === 0, '카드 그림은 사진 파일이 아니라 그린 그림이다');
const spread = Math.max(...art.boxes.map(b => b.h)) - Math.min(...art.boxes.map(b => b.h));
chk(spread < 2, `카드 그림 칸 높이가 모두 같다 (${art.boxes.map(b => Math.round(b.h)).join('/')}px)`);
chk(art.boxes.every(b => Math.abs(b.w / b.h - 300 / 132) < 0.03),
  `카드 그림 칸 비율이 정해진 값(300:132) (${art.boxes.map(b => (b.w / b.h).toFixed(2)).join('/')})`);
chk(art.hidden && art.heroHidden, '그림은 장식이라 화면낭독기에 읽히지 않는다');
/* 사진 파일을 아예 쓰지 않는가 — 로고 하나만 있어야 합니다 */
const imgs = await P.evaluate(() => [...document.images].map(i => i.getAttribute('src')));
chk(imgs.length === 1 && /gov-logo/.test(imgs[0]),
  `그림 파일은 기관 로고 하나뿐 (${imgs.join(', ')})`);
/* 머리띠 제목이 짙은 바탕 위에서 읽히는가 */
const heroTxt = await P.evaluate(() => ({
  bg: getComputedStyle(document.querySelector('.hero')).backgroundColor,
  fg: getComputedStyle(document.querySelector('.hero h1')).color
}));
chk(lum(heroTxt.fg) - lum(heroTxt.bg) > 120,
  `머리띠 제목과 바탕의 밝기 차가 충분하다 (${Math.round(lum(heroTxt.bg))} → ${Math.round(lum(heroTxt.fg))})`);

await P.screenshot({ path: 't9-portal.png' });

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
