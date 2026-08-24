/* 진입 화면 회귀 (v5 — 사용자 개선(안) 반영)

   v4 는 "설명이 처음부터 다 보이는가"를 검사했습니다. 사용자가 개선(안)을
   그려 오면서 **평소에는 아주 단순한 카드, 마우스를 올리면 설명** 으로
   바꾸기로 정해 그 부분을 새로 씁니다.

   설명을 호버로 감추는 것은 접근성에서 조심할 일이라, 감추지 않고 **비켜
   두었는지**(글이 늘 문서에 있고 opacity 만 0) · 호버가 없는 기기와 인쇄에서는
   **처음부터 펼쳐지는지**를 함께 검사합니다. 그것이 이 판의 핵심입니다.

   지금 확인하는 것
     · 구조·기관 로고·도구 세 링크
     · 평소에는 번호·이름·자료 건수만 (미니멀)
     · 마우스를 올리면 설명이 올라오고 화살표 단추가 파랗게 찬다
     · 키보드 초점에서도 같고, 손가락 기기·인쇄에서는 처음부터 펼쳐진다
     · 사진 네 장이 실제로 불러와지고, 그 위 딱지가 살아 움직인다
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
/* 제목 계단 — h1(서비스) → h2(업무도구 3종) → h3(도구 이름). 건너뛰지 않는다 */
const hs = await P.$$eval('h1,h2,h3', es => es.map(e => e.tagName));
chk(hs[0] === 'H1' && hs[1] === 'H2' && hs.filter(t => t === 'H3').length === 3,
  `제목 계단 h1→h2→h3×3 (${hs.join('>')})`);
chk(ext.length === 0, `외부 요청 0건 (실제 ${ext.length}건)`);
counting = false;

// ══ 2. KRDS 규격 ══
const spec = await P.evaluate(() => ({
  root: parseFloat(getComputedStyle(document.documentElement).fontSize),
  body: parseFloat(getComputedStyle(document.body).fontSize),
  desc: parseFloat(getComputedStyle(document.querySelector('.pn-d')).fontSize),
  name: parseFloat(getComputedStyle(document.querySelector('.pn h3')).fontSize),
  fam: getComputedStyle(document.body).fontFamily,
  gov: document.fonts.check('17px "Pretendard GOV"'),
  lh: parseFloat(getComputedStyle(document.body).lineHeight)
      / parseFloat(getComputedStyle(document.body).fontSize)
}));
chk(Math.abs(spec.root - 10) < 0.2, `뿌리 글자크기 62.5% = 10px (실제 ${spec.root}px)`);
chk(spec.body >= 16, `본문 16px 이상 — KRDS 기준 (실제 ${spec.body}px)`);
chk(spec.desc >= 14, `도구 설명 14px 이상 (실제 ${spec.desc}px)`);
chk(spec.name >= 20, `도구 이름이 번호보다 크다 (실제 ${spec.name}px)`);
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
/* 번호 배지는 세 장 모두 같은 색 — 도구마다 다른 원색을 쓰지 않습니다
   (KRDS: 색은 역할로 쓴다. 개선(안)에서도 배지 셋이 같은 파랑입니다) */
const noBg = await P.$$eval('.pn-no', ns => ns.map(n => getComputedStyle(n).backgroundColor));
chk(new Set(noBg).size === 1, `번호 배지 색이 세 장 모두 같다 (${[...new Set(noBg)].join(' / ')})`);
const hit = await P.evaluate(() => {
  const a = document.querySelector('.tools > li > a'), li = a.parentElement;
  const ar = a.getBoundingClientRect(), lr = li.getBoundingClientRect();
  return ar.width / lr.width;
});
chk(hit > 0.98, `카드 전체가 누를 수 있는 영역 (폭 비율 ${hit.toFixed(2)})`);

// ══ 5. 평소에는 단순하게 · 올리면 설명 ══════════════════════════
/* 개선(안)의 핵심입니다. 다만 **감추는 것이 아니라 비켜 두는 것**이어야
   합니다 — 글이 문서에서 사라지면 화면낭독기가 읽지 못합니다. */
const rest = await P.evaluate(() => [...document.querySelectorAll('.tools > li')].map(li => {
  const ov = li.querySelector('.pn-ov'), d = li.querySelector('.pn-d');
  const m = li.querySelector('.pn-meta'), h = li.querySelector('h3');
  return {
    ov: +getComputedStyle(ov).opacity,
    len: d.textContent.trim().length,
    disp: getComputedStyle(d).display, vis: getComputedStyle(d).visibility,
    m: +getComputedStyle(m).opacity, mh: m.getBoundingClientRect().height,
    hh: h.getBoundingClientRect().height,
    go: getComputedStyle(li.querySelector('.pn-go')).backgroundColor
  };
}));
chk(rest.every(s => s.ov < 0.05), '평소에는 설명이 비켜 있다 (카드가 단순하다)');
chk(rest.every(s => s.len > 30 && s.disp !== 'none' && s.vis !== 'hidden'),
  '설명 글은 늘 문서에 있다 — 화면낭독기가 읽는다 (display/visibility 로 지우지 않음)');
chk(rest.every(s => s.m > 0.95 && s.mh > 10), '자료 건수는 처음부터 보인다');
chk(rest.every(s => s.hh > 20), '도구 이름은 처음부터 보인다');

await P.hover('.tools > li:nth-child(1) > a'); await P.waitForTimeout(420);
const hov = await P.evaluate(() => {
  const li = document.querySelector('.tools > li');
  const cs = getComputedStyle(li.querySelector('.pn-ov'));
  return {
    ov: +cs.opacity, tr: cs.transform,
    go: getComputedStyle(li.querySelector('.pn-go')).backgroundColor,
    bd: getComputedStyle(li.querySelector('a')).borderTopColor,
    lb: +getComputedStyle(li.querySelector('.pn-lbs')).opacity,
    dRect: li.querySelector('.pn-d').getBoundingClientRect(),
    phRect: li.querySelector('.pn-ph').getBoundingClientRect()
  };
});
chk(hov.ov > 0.95, `마우스를 올리면 설명이 올라온다 (불투명도 ${hov.ov})`);
chk(hov.tr === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(hov.tr),
  `설명이 제자리까지 올라왔다 (${hov.tr})`);
chk(hov.dRect.top >= hov.phRect.top - 1 && hov.dRect.bottom <= hov.phRect.bottom + 1,
  '설명이 그림 칸 안에 들어온다 (잘리지 않는다)');
chk(hov.go !== rest[0].go, `올리면 화살표 단추가 채워진다 (${rest[0].go} → ${hov.go})`);
chk(hov.lb < 0.05, '설명이 올라오면 그림 위 딱지는 비켜 준다');
await P.mouse.move(2, 2); await P.waitForTimeout(300);

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

// ══ 7. 초점 — 키보드로 갈 수 있고, 설명도 같이 나온다 ══
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
/* 건너뛰기 → 고대비 단추 → 누리집 → 첫 카드 */
await P.keyboard.press('Tab'); await P.keyboard.press('Tab'); await P.keyboard.press('Tab');
await P.waitForTimeout(420);
const kb = await P.evaluate(() => {
  const a = document.activeElement;
  const li = a.closest ? a.closest('li') : null;
  return {
    isCard: !!(li && li.classList.contains('pn')),
    ring: getComputedStyle(a).boxShadow,
    ov: li ? +getComputedStyle(li.querySelector('.pn-ov')).opacity : -1
  };
});
chk(kb.isCard, '탭 네 번이면 첫 도구 카드에 초점이 온다');
chk(/rgb/.test(kb.ring) && !/none/.test(kb.ring), `카드에 초점 표시가 보인다 (${kb.ring.slice(0, 40)}…)`);
chk(kb.ov > 0.95, '키보드 초점에서도 설명이 나온다 (마우스 없이도 읽을 수 있다)');

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
    return { cols: li.length / tops.size, over: document.documentElement.scrollWidth > innerWidth + 1,
             /* 좁은 화면에서 머리띠 글자가 단추와 겹치지 않는가 */
             bump: (() => {
               const s = document.querySelector('.svc'), a = document.querySelector('.top .act');
               if (!s || !a || getComputedStyle(s).display === 'none') return false;
               const sr = s.getBoundingClientRect(), ar = a.getBoundingClientRect();
               return sr.right > ar.left + 1 && sr.top < ar.bottom && sr.bottom > ar.top;
             })() };
  });
  chk(!info.over, `${w}px — 가로 스크롤 없음`);
  chk(Math.round(info.cols) === cols, `${w}px — 카드 ${cols}열 (실제 ${Math.round(info.cols)})`);
  chk(!info.bump, `${w}px — 머리띠 서비스명이 단추와 겹치지 않는다`);
}
await P.setViewportSize({ width: 1440, height: 900 }); await P.waitForTimeout(200);

// ══ 10. 모바일 (실제 터치 기기) ══
/* 손가락으로 쓰는 기기에는 올릴 마우스가 없습니다 — 설명이 처음부터
   펼쳐져 있어야 합니다. 여기서 막히면 휴대전화 사용자는 설명을 못 읽습니다. */
const M = await B.newPage({ ...devices['iPhone 13'] });
M.on('pageerror', e => errs.push('MOBILE: ' + e.message));
await M.goto(PAGE); await M.waitForTimeout(600);
chk(!(await M.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)),
  '휴대전화 — 가로 스크롤 없음');
const mob = await M.evaluate(() => {
  const li = document.querySelector('.tools > li');
  const ov = li.querySelector('.pn-ov'), d = li.querySelector('.pn-d');
  const or = ov.getBoundingClientRect(), pr = li.querySelector('.pn-ph').getBoundingClientRect();
  return {
    hoverNone: matchMedia('(hover: none)').matches,
    ov: +getComputedStyle(ov).opacity,
    inside: or.bottom <= pr.bottom + 1 && or.top >= pr.top - 1,
    dh: d.getBoundingClientRect().height,
    lb: getComputedStyle(li.querySelector('.pn-lbs')).display
  };
});
chk(mob.hoverNone, '휴대전화는 호버가 없는 기기로 잡힌다');
chk(mob.ov > 0.95 && mob.dh > 20, '휴대전화에서는 설명이 처음부터 펼쳐진다');
chk(mob.inside, '펼쳐진 설명이 그림 칸 안에 들어온다 (잘리지 않는다)');
chk(mob.lb === 'none', '휴대전화에서는 그림 위 딱지를 빼 설명과 겹치지 않게 한다');
await M.tap('.tools > li > a'); await M.waitForTimeout(600);
chk(M.url().includes('map/index.html'), '손가락으로 눌러 도구로 이동');
await M.close();

// ══ 11. 모션 감소 — 되풀이되는 움직임은 멈추고, 멈춘 채로 다 보인다 ══
await P.emulateMedia({ reducedMotion: 'reduce' }); await P.waitForTimeout(300);
chk(parseFloat(await P.$eval('.tools > li > a', a => getComputedStyle(a).transitionDuration)) < 0.05,
  'prefers-reduced-motion 반영');
const rm = await P.evaluate(() => {
  const lb = document.querySelector('.pn-lb');
  const img = document.querySelector('.hero-img');
  return { lbName: getComputedStyle(lb).animationName, lbOp: +getComputedStyle(lb).opacity,
           imgName: getComputedStyle(img).animationName,
           card: getComputedStyle(document.querySelector('.pn')).animationName,
           h1: +getComputedStyle(document.querySelector('.hero h1')).opacity,
           cardOp: +getComputedStyle(document.querySelector('.pn')).opacity };
});
chk(rm.lbName === 'none' && rm.imgName === 'none' && rm.card === 'none',
  `움직임을 줄이면 동작이 멈춘다 (딱지 ${rm.lbName} · 사진 ${rm.imgName} · 카드 ${rm.card})`);
chk(rm.lbOp > 0.95 && rm.h1 > 0.95, '멈춘 상태에서도 딱지와 제목이 다 보인다');
chk(rm.cardOp > 0.95, '멈춘 상태에서도 카드가 다 보인다');
await P.emulateMedia({ reducedMotion: 'no-preference' }); await P.waitForTimeout(200);

// ══ 12. JS 없이 — 고대비 단추만 없고, 나머지는 그대로 ══
const N = await B.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
await N.goto(PAGE); await N.waitForTimeout(300);
chk((await N.$$eval('.tools > li > a', as => as.length)) === 3, 'JS 꺼도 링크 살아 있음');
chk((await N.$$('.modebtn')).length === 0, 'JS 꺼지면 고대비 단추는 안 만들어진다');
await N.hover('.tools > li:nth-child(1) > a'); await N.waitForTimeout(400);
chk(+(await N.$eval('.pn-ov', o => getComputedStyle(o).opacity)) > 0.95,
  'JS 꺼도 올리면 설명이 나온다 (CSS 로만 그린다)');
await N.click('.tools > li > a'); await N.waitForTimeout(400);
chk(N.url().includes('map/index.html'), 'JS 꺼도 진입 가능');
await N.close();

// ══ 13. 인쇄 — 고대비로 보고 있어도 흰 종이에 검정 ══
await P.click('.modebtn'); await P.waitForTimeout(300);   // 고대비로 바꿔 두고
await P.emulateMedia({ media: 'print' }); await P.waitForTimeout(250);
const pr = await P.evaluate(() => ({
  photo: getComputedStyle(document.querySelector('.hero-ph')).display,
  art: getComputedStyle(document.querySelector('.pn-art')).display,
  act: getComputedStyle(document.querySelector('.top .act')).display,
  card: getComputedStyle(document.querySelector('.tools > li > a')).backgroundColor,
  ink: getComputedStyle(document.body).color,
  ov: +getComputedStyle(document.querySelector('.pn-ov')).opacity,
  d: +getComputedStyle(document.querySelector('.pn-d')).opacity,
  dh: document.querySelector('.pn-d').getBoundingClientRect().height
}));
chk(pr.photo === 'none', '인쇄 시 머리띠 사진 빼기');
chk(pr.art === 'none', '인쇄 시 카드 사진 빼기');
chk(pr.act === 'none', '인쇄 시 단추 줄 빼기');
chk(lum(pr.card) > 200, `인쇄 시 카드 바탕이 흰색 (밝기 ${Math.round(lum(pr.card))})`);
chk(lum(pr.ink) < 60, `인쇄 시 글자가 검정 (밝기 ${Math.round(lum(pr.ink))})`);
chk(pr.ov > 0.95 && pr.d > 0.95 && pr.dh > 20, '인쇄 시 설명은 글자로 펼쳐진다');
await P.emulateMedia({ media: 'screen' });
await P.click('.modebtn'); await P.waitForTimeout(300);   // 밝은 화면으로 되돌린다

/* ══ 14. 사진과 그 위의 딱지 ═════════════════════════════════════
   사용자가 준 실사 사진 4장(머리띠 1 + 카드 3)을 씁니다. 사진은 파일이라
   **실제로 불러와졌는지**가 중요합니다 — 경로가 틀리면 화면에 빈 칸이 남고,
   그것을 눈으로 못 보고 넘기기 쉽습니다(naturalWidth 로 확인).

   카드 세 장의 사진 칸은 비율(16:9)과 높이가 **정확히 같아야** 카드 줄이
   맞습니다. build/make_site_images.py 가 미리 잘라 두는 이유입니다.

   딱지는 "사진 위의 글자가 살아 움직였으면 좋겠다"는 요청으로 넣은 것이고,
   **지어낸 수치를 적지 않았는지**도 함께 봅니다 — 거리·시간을 적으면
   자료처럼 읽혀 잘못된 값을 주게 됩니다. */
await P.setViewportSize({ width: 1440, height: 900 }); await P.waitForTimeout(400);
const art = await P.evaluate(() => {
  const at = [...document.querySelectorAll('.pn-art')];
  const box = e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; };
  const hero = document.querySelector('.hero-img');
  const cards = [...document.querySelectorAll('.pn-art img')];
  return {
    hero: !!hero, heroLoaded: !!hero && hero.naturalWidth > 100,
    heroFit: hero ? getComputedStyle(hero).objectFit : '',
    veil: !!document.querySelector('.hero-veil'),
    n: at.length,
    imgN: cards.length,
    imgLoaded: cards.every(i => i.naturalWidth > 100),
    imgFit: cards.every(i => getComputedStyle(i).objectFit === 'cover'),
    /* 사진은 장식입니다 — 무엇을 하는 도구인지는 제목·설명이 말합니다 */
    imgAlt: cards.every(i => i.getAttribute('alt') === ''),
    svgN: document.querySelectorAll('.pn-art svg').length,
    boxes: [...document.querySelectorAll('.pn-ph')].map(box),
    hidden: at.every(e => e.getAttribute('aria-hidden') === 'true'),
    /* 설명(.pn-ov)은 사진 칸 밖에 있어야 화면낭독기가 읽습니다 */
    ovOutside: [...document.querySelectorAll('.pn-ov')]
      .every(o => !o.closest('[aria-hidden="true"]')),
    heroHidden: document.querySelector('.hero-ph').getAttribute('aria-hidden') === 'true',
    lbs: [...document.querySelectorAll('.tools > li')]
      .map(li => [...li.querySelectorAll('.pn-lb')].map(b => b.textContent.trim())),
    lbAnim: getComputedStyle(document.querySelector('.pn-lb')).animationName,
    lbIn: [...document.querySelectorAll('.tools > li')].every(li => {
      const p = li.querySelector('.pn-ph').getBoundingClientRect();
      return [...li.querySelectorAll('.pn-lb')].every(b => {
        const r = b.getBoundingClientRect();
        return r.left >= p.left - 1 && r.right <= p.right + 1
            && r.top >= p.top - 1 && r.bottom <= p.bottom + 1;
      });
    })
  };
});
chk(art.hero && art.heroLoaded, '머리띠 사진이 실제로 불러와졌다');
chk(art.heroFit === 'cover', `머리띠 사진이 칸을 채운다 (object-fit:${art.heroFit})`);
chk(art.veil, '머리띠 사진 위에 글자용 막(.hero-veil)이 있다');
chk(art.n === 3 && art.imgN === 3, `카드 세 장에 사진이 하나씩 (칸 ${art.n} · 사진 ${art.imgN})`);
chk(art.imgLoaded, '카드 사진 세 장이 모두 실제로 불러와졌다');
chk(art.imgFit, '카드 사진이 칸을 채운다 (object-fit:cover)');
chk(art.svgN === 0, '카드 그림 칸은 선 그림이 아니라 사진이다');
const spread = Math.max(...art.boxes.map(b => b.h)) - Math.min(...art.boxes.map(b => b.h));
chk(spread < 2, `카드 사진 칸 높이가 모두 같다 (${art.boxes.map(b => Math.round(b.h)).join('/')}px)`);
chk(art.boxes.every(b => Math.abs(b.w / b.h - 16 / 9) < 0.03),
  `카드 사진 칸 비율이 정해진 값(16:9) (${art.boxes.map(b => (b.w / b.h).toFixed(2)).join('/')})`);
chk(art.hidden && art.heroHidden && art.imgAlt,
  '사진은 장식이라 화면낭독기에 읽히지 않는다 (aria-hidden · alt="")');
chk(art.ovOutside, '설명은 그 밖에 있어 화면낭독기가 읽는다');
chk(art.lbs.every(l => l.length >= 2), `카드마다 딱지가 두 개 이상 (${art.lbs.map(l => l.length).join('/')})`);
chk(art.lbAnim !== 'none', `딱지가 살아 움직인다 (${art.lbAnim})`);
chk(art.lbIn, '딱지가 사진 칸 밖으로 삐져나오지 않는다');
/* 딱지에 지어낸 수치가 없는가 — 숫자가 들어가면 자료처럼 읽힙니다 */
const flat = art.lbs.reduce((a, b) => a.concat(b), []);
chk(flat.every(t => !/\d/.test(t)), `딱지에 지어낸 수치가 없다 (${flat.join(' / ')})`);
/* 쓰는 그림 파일 — 기관 로고 + 사진 4장 */
const imgs = await P.evaluate(() => [...document.images].map(i => i.getAttribute('src')));
chk(imgs.length === 5 && imgs.filter(u => /gov-logo/.test(u)).length === 1
    && imgs.filter(u => /img\/site\//.test(u)).length === 4,
  `그림 파일은 로고 1 + 사진 4 (${imgs.length}개)`);
/* 사진 위 제목이 읽히는가 — 글자가 앉는 자리를 덮는 막(--veil)과 견줍니다.
   사진은 자리마다 밝기가 달라서, 막의 색으로 대비를 고정해 둔 것입니다. */
const rgba = s => { const m = s.match(/[\d.]+/g).map(Number);
  return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000; };
const heroTxt = await P.evaluate(() => ({
  veil: getComputedStyle(document.documentElement).getPropertyValue('--veil').trim(),
  fg: getComputedStyle(document.querySelector('.hero h1')).color
}));
chk(Math.abs(rgba(heroTxt.fg) - rgba(heroTxt.veil)) > 120,
  `머리띠 제목과 막의 밝기 차가 충분하다 (막 ${Math.round(rgba(heroTxt.veil))} ↔ 글자 ${Math.round(rgba(heroTxt.fg))})`);

await P.screenshot({ path: 't9-portal.png' });

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
