/* 진입 화면 회귀 (v3 — 전면 분할 패널) — 구조·링크·호버·접근성·반응형 */
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
const errs = []; const ok = [], bad = []; const chk = (c, m) => (c ? ok : bad).push(m);
const URL = ROOT + 'index.html';
const P = await B.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
P.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
let counting = true;
const ext = [];
P.on('request', r => { if (counting && !r.url().startsWith('file:')) ext.push(r.url()); });

await P.goto(URL); await P.waitForTimeout(600);

// ══ 1. 구조 — 시각적 제목 문구는 없지만 h1 은 스크린리더용으로 남아 있음 ══
chk((await P.$$('h1')).length === 1, `h1 하나뿐 (${(await P.$$('h1')).length}개)`);
const h1box = await P.$eval('h1', el => el.getBoundingClientRect());
chk(h1box.width <= 1 && h1box.height <= 1, `h1 이 시각적으로는 안 보임 (${Math.round(h1box.width)}×${Math.round(h1box.height)}px)`);
const h1text = await P.$eval('h1', el => el.textContent.trim());
chk(h1text.length > 0, `h1 텍스트는 실재함 (스크린리더용: "${h1text}")`);
chk((await P.$$('.eyebrow, .stage-head')).length === 0, '이전의 안내 문구 요소가 남아있지 않음');
chk((await P.$$('header.top')).length === 1 && (await P.$$('footer.stage-foot')).length === 1,
  '헤더·푸터 시맨틱 요소');
chk((await P.$$('main#main')).length === 1, 'main 영역 하나');
chk(await P.$eval('.panels', u => u.tagName === 'UL'), '도구 3종이 목록(ul)');
chk((await P.$$('.panels > li')).length === 3, '패널 3장');
chk((await P.$$('script')).length === 0, '자바스크립트 없음 (순수 CSS)');
chk(ext.length === 0, `외부 요청 0건 (실제 ${ext.length}건)`);
counting = false;

// ══ 1-1. 여백 — 패널이 화면 가득 차지 않고 위아래양옆에 숨 쉴 틈이 있는가 ══
const gap = await P.evaluate(() => {
  const wrapBox = document.querySelector('.panels').getBoundingClientRect();
  const stageBox = document.querySelector('.stage').getBoundingClientRect();
  const p = [...document.querySelectorAll('.panels > li')].map(li => li.getBoundingClientRect());
  const cs1 = getComputedStyle(document.querySelectorAll('.panels > li')[0]);
  return {
    topMargin: Math.round(wrapBox.top - stageBox.top),
    bottomMargin: Math.round(stageBox.bottom - wrapBox.bottom),
    sideMargin: Math.round(p[0].left - stageBox.left),
    gapBetween: Math.round(p[1].left - p[0].right),
    radius: cs1.borderRadius
  };
});
chk(gap.topMargin > 20, `패널 위쪽 여백 있음 (${gap.topMargin}px)`);
chk(gap.bottomMargin > 20, `패널 아래쪽 여백 있음 (${gap.bottomMargin}px)`);
chk(gap.sideMargin > 20, `패널 좌우 여백 있음 (${gap.sideMargin}px)`);
chk(gap.gapBetween > 8, `패널 사이 틈 있음 (${gap.gapBetween}px)`);
chk(parseFloat(gap.radius) > 0, `패널 모서리가 둥글게 (${gap.radius})`);

// ══ 2. 기관 로고 — 원본을 자르지 않고 그대로 쓰는가, 왼쪽 배치인가 ══
const mark = await P.evaluate(() => {
  const m = document.querySelector('.top .logo-full');
  if (!m) return null;
  const r = m.getBoundingClientRect();
  return { tag: m.tagName.toLowerCase(), src: m.getAttribute('src'),
           w: Math.round(r.width), h: Math.round(r.height),
           natW: m.naturalWidth, natH: m.naturalHeight, complete: m.complete,
           ratio: +(m.naturalWidth / m.naturalHeight).toFixed(3) };
});
chk(mark && mark.tag === 'img' && mark.src === 'assets/img/gov-logo.png',
  `실제 로고 이미지 사용 (${mark && mark.tag} src=${mark && mark.src})`);
chk(mark && mark.complete && mark.natW > 0 && mark.natH > 0,
  `로고 파일이 실제로 로드됨 (원본 ${mark && mark.natW}×${mark && mark.natH}px)`);
chk(mark && mark.natW === 900 && mark.natH === 322,
  `자르지 않은 원본 크기 그대로 (900×322 기대, 실제 ${mark && mark.natW}×${mark && mark.natH})`);
chk(mark && mark.w >= 20 && mark.h >= 20, `로고 표시 크기 정상 (${mark && mark.w}×${mark && mark.h}px)`);
// CSS 로만 높이를 정하고 폭은 auto 이므로, 화면에 그려진 비율도 원본과 같아야
// (강제로 눌리거나 늘어나지 않아야) "변형 없이" 를 만족한다
chk(mark && Math.abs(mark.w / mark.h - mark.ratio) < 0.02,
  `표시 비율이 원본 비율과 같음 (표시 ${(mark.w/mark.h).toFixed(3)} vs 원본 ${mark && mark.ratio})`);

const left = await P.evaluate(() => {
  const wrapEl = document.querySelector('.top .wrap');
  const wrap = wrapEl.getBoundingClientRect();
  const pad = parseFloat(getComputedStyle(wrapEl).paddingLeft);
  const grp = document.querySelector('.brand-group').getBoundingClientRect();
  const ext = document.querySelector('.top .ext').getBoundingClientRect();
  return { innerLeft: wrap.left + pad, innerRight: wrap.right - pad, grpLeft: grp.left, extRight: ext.right };
});
// .wrap 의 좌우 padding(--pad) 을 뺀 "안쪽" 기준선에 로고는 왼쪽, 링크는 오른쪽으로 붙어야 한다
chk(Math.abs(left.innerLeft - left.grpLeft) < 3,
  `로고 묶음이 상단 바 왼쪽에 붙어 있음 (안쪽 기준선 ${Math.round(left.innerLeft)}px, 로고묶음 왼쪽 ${Math.round(left.grpLeft)}px)`);
chk(Math.abs(left.innerRight - left.extRight) < 3,
  `누리집 링크는 오른쪽 끝에 붙어 있음 (안쪽 기준선 ${Math.round(left.innerRight)}px, 링크 오른쪽 ${Math.round(left.extRight)}px)`);
chk((await P.$$('.brand-tx, .mark')).length === 0, '기관명 중복 텍스트·이전 아이콘 없음 (로고 이미지 하나로 통일)');

// ══ 2-1. 패널 줄이 화면 가운데에 오는가 (좌우 여백이 같아야 한다) ══
const pcenter = await P.evaluate(() => {
  const panels = document.querySelector('.panels').getBoundingClientRect();
  return { left: panels.left, right: window.innerWidth - panels.right, vw: window.innerWidth };
});
chk(Math.abs(pcenter.left - pcenter.right) < 3,
  `패널 3개 줄이 화면 가운데 (왼쪽 여백 ${Math.round(pcenter.left)}px, 오른쪽 여백 ${Math.round(pcenter.right)}px)`);

// ══ 2-2. 화면 전체 배경 사진 — 패널 안이 아니라 .stage 전체에 깔림 ══
const photoEl = await P.evaluate(() => {
  const img = document.querySelector('.stage-photo img');
  if (!img) return null;
  const wrap = document.querySelector('.stage-photo').getBoundingClientRect();
  const stage = document.querySelector('.stage').getBoundingClientRect();
  return { src: img.getAttribute('src'), natW: img.naturalWidth, natH: img.naturalHeight,
    complete: img.complete, wrapW: Math.round(wrap.width), wrapH: Math.round(wrap.height),
    stageW: Math.round(stage.width), stageH: Math.round(stage.height) };
});
chk(!!photoEl, '.stage 안에 화면 전체용 배경 사진 레이어가 있음');
chk(photoEl && photoEl.complete && photoEl.natW > 0, `배경 사진이 실제로 로드됨 (${photoEl && photoEl.natW}×${photoEl && photoEl.natH})`);
chk(photoEl && Math.abs(photoEl.wrapW - photoEl.stageW) < 2 && Math.abs(photoEl.wrapH - photoEl.stageH) < 2,
  '배경 사진 레이어가 어두운 캔버스(.stage) 전체를 채움 (패널 안이 아님)');

// ══ 3. 도구 링크 ══
const links = await P.$$eval('.pn-hit', as => as.map(a => a.getAttribute('href')));
chk(links.length === 3 && links[0] === 'map/index.html' && links[1] === 'sms/index.html'
    && links[2] === 'res/index.html',
  `도구 3개 모두 실제 링크 (${links.join(', ')})`);
chk((await P.$$('.pn.is-soon')).length === 0, '준비 중 패널 없음 (③ 완성)');

await P.click('.panels > li:nth-child(1) .pn-hit'); await P.waitForTimeout(500);
chk(P.url().includes('map/index.html'), '① 패널 → 대피장소 지도로 이동');
await P.goBack(); await P.waitForTimeout(400);
await P.click('.panels > li:nth-child(2) .pn-hit'); await P.waitForTimeout(500);
chk(P.url().includes('sms/index.html'), '② 패널 → 문자 작성 도구로 이동');
await P.goBack(); await P.waitForTimeout(600);

// ══ 3-1. 패널 배경 — 세 패널 모두 손으로 그린 그림(SVG). 실사진은 패널 안이
//         아니라 화면 전체 배경(.stage-photo)에만 쓴다 ══
chk((await P.$$('.pn-art img')).length === 0, '패널 안에는 사진(img)이 없음 — 전부 SVG');
chk((await P.$$('.pn-art svg')).length === 3, '패널 3개 모두 그린 그림(SVG) 사용');
chk((await P.$$('.pn-overlay')).length === 0, '이전에 썼던 사진 위 오버레이 요소는 없음 (② SVG 안에 거리 눈금이 그대로 포함됨)');
chk((await P.$$('.panels > li:nth-child(1) .pn-art svg circle[stroke-dasharray]')).length === 3,
  '① 지도 패널 SVG 안에 거리 눈금 원이 그대로 있음');

// ══ 4. 기본 상태는 최소 정보 (제목만) ══
const vis = await P.$eval('.panels > li:nth-child(1)', li => {
  const d = getComputedStyle(li.querySelector('.pn-d'));
  const g = getComputedStyle(li.querySelector('.pn-go'));
  return { d: +d.opacity, g: +g.opacity };
});
chk(vis.d === 0 && vis.g === 0, '평소엔 설명·이용하기가 숨겨져 있음 (제목만 보임)');

// ══ 5. 마우스 호버 — 패널이 넓어지고 설명이 나타남 ══
await P.mouse.move(5, 5); await P.waitForTimeout(300);   // 호버 상태를 확실히 초기화
const wBefore = await P.$eval('.panels > li:nth-child(2)', el => el.getBoundingClientRect().width);
await P.hover('.panels > li:nth-child(2)'); await P.waitForTimeout(650);
const after = await P.evaluate(() => {
  const li = document.querySelectorAll('.panels > li')[1];
  return { w: li.getBoundingClientRect().width,
    d: +getComputedStyle(li.querySelector('.pn-d')).opacity,
    g: +getComputedStyle(li.querySelector('.pn-go')).opacity,
    art: +getComputedStyle(li.querySelector('.pn-art')).opacity,
    bar: getComputedStyle(li, '::before').width };
});
chk(after.w > wBefore + 60, `호버하면 패널이 넓어짐 (${Math.round(wBefore)} → ${Math.round(after.w)}px)`);
chk(after.d === 1 && after.g === 1, '호버하면 설명·이용하기가 나타남');
chk(after.art > 0.9, `호버하면 배경 그림이 또렷해짐 (opacity ${after.art})`);
chk(parseFloat(after.bar) > 100, `호버하면 위쪽 강조선이 채워짐 (${after.bar})`);
await P.mouse.move(0, 0); await P.waitForTimeout(650);
chk(+(await P.$eval('.panels > li:nth-child(2) .pn-d', e => getComputedStyle(e).opacity)) === 0,
  '마우스를 떼면 다시 접힘');

// ══ 6. 키보드 — 포커스로도 같은 효과 ══
await P.keyboard.press('Tab');
chk(await P.evaluate(() => document.activeElement.className.includes('skip')), '첫 Tab 이 건너뛰기 링크');
await P.evaluate(() => document.querySelector('.pn-hit[href="map/index.html"]').focus());
await P.waitForTimeout(600);
chk(+(await P.$eval('.panels > li:nth-child(1) .pn-d', e => getComputedStyle(e).opacity)) === 1,
  '키보드 포커스로도 설명이 펼쳐짐 (마우스 없이 정보 접근 가능)');
chk(await P.evaluate(() => getComputedStyle(document.activeElement).outlineStyle) !== 'none',
  '초점 테두리 표시');
chk(await P.evaluate(() => {
  document.querySelector('.pn-hit[href="res/index.html"]').focus();
  return document.activeElement.getAttribute('href') === 'res/index.html';
}), '③ 패널도 키보드 초점 이동 가능');

// ══ 7. 문구 ══
const body = (await P.textContent('body')).replace(/\s+/g, ' ');
chk(['혁신','차세대','완벽한','스마트','AI 기반','최고의','100%'].every(w => !body.includes(w)),
  '과장 표현 없음');
chk(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(body), '이모지 없음');
chk(/책임은 관계기관에 있습니다/.test(body), '책임 안내 한 줄 유지');
chk(body.length < 400, `전체 글자 수 최소 (${body.length}자)`);

// ══ 8. 반응형 — 한 화면에 다 들어오는가 ══
for (const [w, h, label] of [[1920,1080,'1920×1080'],[1600,900,'1600×900'],
     [1366,768,'1366×768'],[1280,720,'1280×720']]) {
  await P.setViewportSize({ width: w, height: h });
  await P.evaluate(() => window.scrollTo(0, 0));
  await P.waitForTimeout(250);
  const r = await P.evaluate(() => ({
    ovX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ovY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    dir: getComputedStyle(document.querySelector('.panels')).flexDirection
  }));
  chk(r.ovX <= 0, `${label}: 가로 스크롤 없음`);
  chk(r.ovY <= 1, `${label}: 스크롤 없이 한 화면에 전부 (넘침 ${r.ovY}px)`);
  chk(r.dir === 'row', `${label}: 패널 가로 3분할`);
}
await P.setViewportSize({ width: 1440, height: 900 });

// ══ 9. 모바일 (실제 터치 기기) ══
const ctx2 = await B.newContext({ ...devices['iPhone 13'] });
const M = await ctx2.newPage();
M.on('pageerror', e => errs.push('MOBILE: ' + e.message));
await M.goto(URL); await M.waitForTimeout(900);
chk(!(await M.evaluate(() => matchMedia('(hover:hover)').matches)), '터치 기기로 인식 (hover 없음)');
chk((await M.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0,
  '모바일 가로 스크롤 없음');
chk(await M.$eval('.panels', p => getComputedStyle(p).flexDirection) === 'column', '모바일 세로 배치');
const mob = await M.evaluate(() => [...document.querySelectorAll('.panels > li')].map(li => {
  const b = li.getBoundingClientRect(), body = li.querySelector('.pn-body').getBoundingClientRect();
  return { d: +getComputedStyle(li.querySelector('.pn-d')).opacity,
           clipTop: Math.round(b.top - body.top), clipBot: Math.round(body.bottom - b.bottom) };
}));
chk(mob.every(m => m.d === 1), '모바일에서는 호버 없이도 설명이 항상 보임');
chk(mob.every(m => m.clipTop <= 1 && m.clipBot <= 1),
  `패널 내용이 위아래로 잘리지 않음 (${mob.map(m => m.clipTop + '/' + m.clipBot).join(' ')})`);
const tapH = await M.$eval('.pn-hit', a => a.getBoundingClientRect().height);
chk(tapH >= 44, `터치 영역 44px 이상 (${Math.round(tapH)}px)`);
await ctx2.close();

// ══ 10. 모션 감소 ══
await P.emulateMedia({ reducedMotion: 'reduce' }); await P.waitForTimeout(200);
chk(parseFloat(await P.$eval('.pn', c => getComputedStyle(c).transitionDuration)) < 0.05,
  'prefers-reduced-motion 반영');
await P.emulateMedia({ reducedMotion: 'no-preference' });

// ══ 11. JS 없이 ══
const N = await B.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
await N.goto(URL); await N.waitForTimeout(300);
chk((await N.$$eval('.pn-hit', as => as.length)) === 3, 'JS 꺼도 링크 살아 있음');
await N.click('.pn-hit'); await N.waitForTimeout(400);
chk(N.url().includes('map/index.html'), 'JS 꺼도 진입 가능');
await N.close();

// ══ 12. 인쇄 ══
await P.emulateMedia({ media: 'print' }); await P.waitForTimeout(200);
const pr = await P.evaluate(() => ({
  art: getComputedStyle(document.querySelector('.pn-art')).display,
  photo: getComputedStyle(document.querySelector('.stage-photo')).display,
  d: +getComputedStyle(document.querySelector('.pn-d')).opacity
}));
chk(pr.art === 'none' && pr.photo === 'none' && pr.d > 0.95, '인쇄 시 배경 그림·사진 빼고 내용 전부 표시');
await P.emulateMedia({ media: 'screen' });

await P.screenshot({ path: 't9-v3.png' });

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
