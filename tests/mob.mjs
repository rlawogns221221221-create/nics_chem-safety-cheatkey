/* 모바일 전체 점검 — 진입화면 + 세 도구, 여러 기기, 세로·가로
 *
 * ── 왜 다시 썼나 ────────────────────────────────────────────────
 * 예전 판은 "문제 0건"을 내내 통과시키면서 실제로는 아래 다섯 가지를 놓쳤습니다
 * (사용자가 휴대전화로 열어 보고 "깨지는 부분이 좀 많다"고 했습니다).
 *
 *   ① 요약 띠가 가로 스크롤 상자 안에 있어 **450px 이 화면 밖에 숨어** 있었다.
 *      — 가장 가까운 대피장소의 거리가 잘려 안 보였는데, 상자 안이라 '넘침'
 *        검사에 걸리지 않았습니다. → 이제 **숨은 양**을 잽니다.
 *   ② 분류 단추 안에서 글자가 상자 밖으로 3px 삐져나왔다.
 *      — 요소 자체는 화면 안이라 안 걸렸습니다. → 이제 **자식이 제 상자를
 *        넘는지**를 봅니다.
 *   ③ 지도 왼쪽 위 범례와 '가까운 곳' 카드가 겹쳐 글자를 가렸다.
 *      — 겹침 검사에 .maplegend 가 빠져 있었습니다. → 목록을 넓혔습니다.
 *   ④ 첫 화면이 세로 가운데 정렬이라 위아래로 280px 씩 비어 있었다.
 *      → 이제 **첫 화면 위쪽 빈 자리**를 잽니다.
 *   ⑤ 지도 아래쪽 축척·체크상자·주소 카드가 서로 밟고 있었다. → ③과 같은 검사.
 *
 * 그리고 예전 판은 **첫 화면만** 봤습니다. 진짜 문제는 값을 넣은 뒤에 나오므로
 * 이제 도구마다 실제로 눌러 결과 화면까지 들어가서 봅니다.
 */
import { chromium, devices } from 'playwright';
/* 저장소를 어디에 두어도 돌게 — 이 파일 자리에서 저장소 뿌리를 찾는다.
   URL 생성자를 쓰지 않습니다(bug1.mjs 와 같은 이유). 문자열만 잘라 씁니다. */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/tests\/$/, '');
const R = ROOT.replace(/\/$/, '');
const B = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const found = [];                       // 문제만 모은다
const note = (dev, page, msg) => found.push(`[${dev} · ${page}] ${msg}`);
let checks = 0;

/* 실제로 쓰이는 작은 화면들. 320 은 아직 남아 있는 가장 작은 화면이고,
   360×640 은 현장에 많은 보급형이다. */
const DEVICES = [
  ['작은화면(320)', { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['갤럭시S8(360)', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
  ['아이폰13(390)', devices['iPhone 13']],
  ['아이폰13 가로', { ...devices['iPhone 13'], viewport: { width: 844, height: 390 } }],
  ['아이패드(820)', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];

/* ── 화면 안에서 재는 것들 ──────────────────────────────────────
   브라우저 안에서 도는 코드라 최신 문법을 씁니다(tests/ 는 예외). */
const PROBE = () => {
  const W = document.documentElement.clientWidth;
  const nm = el => (el.id ? '#' + el.id : el.tagName.toLowerCase()
    + (typeof el.className === 'string' && el.className.trim()
       ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
  const vis = el => {
    const c = getComputedStyle(el);
    return c.display !== 'none' && c.visibility !== 'hidden' && +c.opacity > 0.01;
  };
  const out = { over: [], spill: [], hidden: [], tiny: [], small: [] };

  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('svg') || !vis(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;

    /* ① 화면 밖으로 — 조상이 잘라 주는(스크롤 되는) 것은 뺀다 */
    if (r.right > W + 1 || r.left < -1) {
      let cut = false;
      for (let p = el.parentElement; p; p = p.parentElement)
        if (getComputedStyle(p).overflowX !== 'visible') { cut = true; break; }
      if (!cut) out.over.push(nm(el) + ` ${Math.round(r.right - W)}px`);
    }

    /* ② 자식이 제 상자를 넘는가 — 단추 안에서 글자가 삐져나오는 경우.
          상자가 스크롤되거나 일부러 잘라내는 것(overflow≠visible)은 뺀다.
          위쪽 조상이 잘라 주는 경우도 뺀다 — 머리띠 사진은 일부러 조금 크게
          그렸다가 제자리로 돌아오고, 그 넘침은 머리띠가 잘라 냅니다. */
    const cs = getComputedStyle(el);
    let clipped = false;
    for (let p = el.parentElement; p; p = p.parentElement)
      if (getComputedStyle(p).overflow !== 'visible') { clipped = true; break; }
    if (!clipped && cs.overflow === 'visible' && el.children.length) {
      for (const k of el.children) {
        if (!vis(k) || k.closest('svg') !== null) continue;
        const kr = k.getBoundingClientRect();
        if (kr.height < 1) continue;
        const dy = Math.round(Math.max(kr.bottom - r.bottom, r.top - kr.top));
        if (dy > 2) out.spill.push(`${nm(el)} 안의 ${nm(k)} ${dy}px`);
      }
    }

    /* ③ 가로로 미는 상자 안에 얼마나 숨어 있나 — 40px 넘게 숨으면 못 읽는다.
          지도(#map)는 원래 끌어 보는 것이라 뺀다. */
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.id !== 'map') {
      const gap = el.scrollWidth - el.clientWidth;
      if (gap > 40) out.hidden.push(nm(el) + ` ${gap}px 숨음`);
    }
  });

  /* ④ 손가락으로 누르기 — 40px 이상 (KRDS·접근성) */
  document.querySelectorAll('button,a[href],select,summary,input[type=checkbox],input[type=radio]')
    .forEach(el => {
      if (!vis(el) || el.offsetParent === null) return;
      const hit = ((el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) || el;
      const r = hit.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      if (r.height < 32 || r.width < 24) out.tiny.push(nm(el) + ` ${Math.round(r.width)}×${Math.round(r.height)}`);
    });

  /* ⑤ 너무 작은 글자 */
  document.querySelectorAll('body *').forEach(el => {
    if (!el.childNodes.length || el.offsetParent === null) return;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 11) out.small.push(nm(el) + ` ${fs}px`);
  });

  const uniq = a => [...new Set(a)].slice(0, 6);
  return { over: uniq(out.over), spill: uniq(out.spill), hidden: uniq(out.hidden),
           tiny: uniq(out.tiny), small: uniq(out.small),
           scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
};

/* 지도 위에 떠 있는 것들이 서로 겹치는가 — 겹치면 아래 것의 글자를 가린다 */
const OVERLAP = () => {
  const sels = ['.mapleft', '.maplegend', '.mnear', '.mapaddr', '.mapscale',
                '.mapacc', '.mapctl', '.mtoast', '.mob'];
  const els = [];
  sels.forEach(s => document.querySelectorAll(s).forEach(e => {
    const c = getComputedStyle(e);
    if (c.display === 'none' || c.visibility === 'hidden' || e.hidden) return;
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) els.push([s, r, e]);
  }));
  const out = [];
  for (let i = 0; i < els.length; i++)
    for (let j = i + 1; j < els.length; j++) {
      /* 담는 상자와 그 안의 것은 겹치는 게 당연하다 */
      if (els[i][2].contains(els[j][2]) || els[j][2].contains(els[i][2])) continue;
      const a = els[i][1], b = els[j][1];
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 6 && oy > 6) out.push(`${els[i][0]} ↔ ${els[j][0]} (${Math.round(ox)}×${Math.round(oy)}px)`);
    }
  return [...new Set(out)].slice(0, 4);
};

/* ── 사고지점 줄 — 위도와 경도가 같은 줄에 있는가 ─────────────────
   ‼ 예전에는 그냥 flex-wrap 이라 브라우저가 남는 자리대로 접어서 위도는
   첫 줄, 경도는 둘째 줄로 갈라졌습니다. 한 쌍인데 따로 놓이면 "값이 두
   군데에 있다"고 읽혀 보기 나쁩니다(사용자 지적). 자리를 격자로 못 박은
   뒤라 다시 갈라지면 여기서 걸립니다. */
const COORDROW = () => {
  const row = document.querySelector('.mb-accrow');
  if (!row) return null;
  const ll = [...row.querySelectorAll('label')]
    .map(e => Math.round(e.getBoundingClientRect().top));
  if (ll.length < 2) return null;
  return ll[0] === ll[1] ? null : `위도(${ll[0]}px)와 경도(${ll[1]}px)가 다른 줄`;
};

/* ── 첫 화면에 지도가 얼마나 보이는가 ─────────────────────────────
   지도 도구인데 지도가 안 보이면 아무 소용이 없습니다. 사용자가 "지도를
   보는 화면이 너무 작아서 답답하다"고 한 그 자리입니다 — 그때는 상단 바·
   조건 줄·요약 띠가 465px 을 먹어 지도가 **199px** 밖에 안 보였습니다.

   170px 은 손을 본 뒤 실제로 잰 값 가운데 가장 낮은 것(320px 화면의 ③)에서
   딱 떨어지는 선입니다. ③ 이 ② 보다 낮은 것은 '찾는 조건 바꾸기' 띠가
   하나 더 있기 때문이고, 그 띠는 ③ 에만 필요합니다.
   ※ 이 환경은 배경지도 타일을 못 받아 경고 띠(31px)가 늘 떠 있습니다.
      인터넷이 되는 곳에서는 그만큼 더 보입니다. */
const MAPSEEN = () => {
  const m = document.getElementById('map');
  if (!m) return null;
  const r = m.getBoundingClientRect();
  const seen = Math.round(Math.min(r.bottom, innerHeight) - r.top);
  return seen < 170
    ? `첫 화면에 지도가 ${seen}px 만 보임 (지도 시작 ${Math.round(r.top)}px / 화면 ${innerHeight}px)`
    : null;
};

/* 첫 화면이 세로 가운데 정렬이라 위쪽이 텅 비지 않았는가 */
const DEADTOP = sel => {
  const box = document.querySelector(sel);
  if (!box) return -1;
  const kid = box.firstElementChild;
  if (!kid) return -1;
  return Math.round(kid.getBoundingClientRect().top - box.getBoundingClientRect().top);
};

const report = (dev, pname, d) => {
  if (d.scroll > 1) note(dev, pname, `가로로 ${d.scroll}px 넘침`);
  if (d.over.length) note(dev, pname, `화면 밖으로 나감: ${d.over.join(' / ')}`);
  if (d.spill.length) note(dev, pname, `글자가 상자 밖으로: ${d.spill.join(' / ')}`);
  if (d.hidden.length) note(dev, pname, `가로 상자에 내용이 숨음: ${d.hidden.join(' / ')}`);
  if (d.tiny.length) note(dev, pname, `누르기 작음: ${d.tiny.join(' / ')}`);
  if (d.small.length) note(dev, pname, `글자 작음(11px 미만): ${d.small.join(' / ')}`);
};

for (const [dev, cfg] of DEVICES) {
  const wide = cfg.viewport.width >= 800;
  for (const pname of ['진입화면', '① 문자작성', '② 대피장소', '③ 방제 동원']) {
    const ctx = await B.newContext({ ...cfg, permissions: ['geolocation'],
      geolocation: { latitude: 36.14, longitude: 128.1137, accuracy: 50 } });
    const P = await ctx.newPage();
    const jsErr = [];
    P.on('pageerror', e => jsErr.push(e.message));
    P.on('console', m => { if (m.type() === 'error' && !/TUNNEL|net::/.test(m.text())) jsErr.push(m.text()); });

    if (pname === '진입화면') {
      await P.goto(`${R}/index.html`); await P.waitForTimeout(700);
      report(dev, pname, await P.evaluate(PROBE));

    } else if (pname.includes('문자')) {
      await P.goto(`${R}/sms/index.html`); await P.waitForTimeout(700);
      checks++;
      /* 첫 화면 — 고를 것이 셋뿐이라 위쪽이 비면 화면이 고장 난 것처럼 보인다 */
      const dead = await P.evaluate(DEADTOP, '.stepsz');
      if (!wide && dead > cfg.viewport.height * 0.2)
        note(dev, pname, `첫 화면 위쪽이 ${dead}px 비어 있다 (세로 가운데 정렬)`);
      report(dev, pname, await P.evaluate(PROBE));
      /* 분류를 고른 뒤 — 접힌 띠에서 글자가 넘치던 자리 */
      await P.click('.steps button.stp'); await P.waitForTimeout(900);
      report(dev, pname + '(고른 뒤)', await P.evaluate(PROBE));
      /* 마지막 걸음(문안 확인) — 못 채운 칸 목록이 나오는 자리 */
      await P.$$eval('.stepbar .stp-i button', bs => bs[bs.length - 1].click());
      await P.waitForTimeout(700);
      report(dev, pname + '(문안 확인)', await P.evaluate(PROBE));

      /* ‼ '지도에서 찾기' 창 — 휴대전화에서 조건 줄·경고 띠가 길어지면서
         **목록 칸이 0px 로 눌리고 아래 단추와 겹쳤습니다.** 눈으로는 잘
         안 보이는 자리라(창을 열어야 나옴) 검사로 못 박습니다. */
      const evac = await P.$$('.stepbar .stp-i button');
      for (const b of evac) {
        if (/대피장소/.test(await b.textContent())) { await b.click(); break; }
      }
      await P.waitForTimeout(500);
      const mb = await P.$('#btnMap');
      if (mb && await mb.isVisible()) {
        await mb.click(); await P.waitForTimeout(1200);
        checks++;
        report(dev, pname + '(지도에서 찾기)', await P.evaluate(PROBE));
        const sh = await P.evaluate(() => {
          const g = s => { const e = document.querySelector(s);
            return e ? Math.round(e.getBoundingClientRect().height) : -1; };
          const li = g('.shmap-list'), mp = g('.shmap-mapwrap');
          const bad = [];
          if (li >= 0 && li < 60) bad.push(`목록 칸이 ${li}px 로 눌림`);
          if (mp >= 0 && mp < 150) bad.push(`지도 칸이 ${mp}px 로 눌림`);
          return bad;
        });
        if (sh.length) note(dev, pname + '(지도에서 찾기)', sh.join(' / '));
        const x = await P.$('.shmap-x');
        if (x) await x.click();
      }

    } else {
      const isRes = pname.includes('방제');
      await P.goto(`${R}/${isRes ? 'res' : 'map'}/index.html`); await P.waitForTimeout(800);
      checks++;
      if (isRes) {
        /* ③ 은 시작이 두 걸음 — 지도·조건은 사고지점을 정한 뒤에 나온다.
           걸음 1(무엇이 필요한가)·걸음 2(사고지점)를 각각 재고 지나갑니다. */
        const dead = await P.evaluate(DEADTOP, '.rz');
        if (!wide && dead > cfg.viewport.height * 0.2)
          note(dev, pname, `시작 화면 위쪽이 ${dead}px 비어 있다 (세로 가운데 정렬)`);
        report(dev, pname + '(걸음1 필요한 것)', await P.evaluate(PROBE));
        const need = await P.$('.rz-need');
        if (need) { await need.click(); await P.waitForTimeout(300); }
        const nx = await P.$('#rzNext');
        if (nx) { await nx.click(); await P.waitForTimeout(500); }
        report(dev, pname + '(걸음2 사고지점)', await P.evaluate(PROBE));
        const b = await P.$('#startPick');
        if (b) { await b.click(); await P.waitForTimeout(900); }
      }
      report(dev, pname, await P.evaluate(PROBE));
      /* 좌표를 넣어 결과 화면까지 — 요약 띠·가까운 곳 카드가 여기서 나온다 */
      await P.fill('#acLat', '36.1400');
      await P.fill('#acLon', '128.1137');
      await P.dispatchEvent('#acLon', 'change');
      await P.waitForTimeout(1600);
      report(dev, pname + '(결과)', await P.evaluate(PROBE));
      const ov = await P.evaluate(OVERLAP);
      if (ov.length) note(dev, pname + '(결과)', `지도 위 패널끼리 겹침: ${ov.join(', ')}`);
      /* 사고지점 줄과 지도 자리 — 이번에 사용자가 짚은 두 가지 */
      const cr = await P.evaluate(COORDROW);
      if (cr) note(dev, pname + '(결과)', cr);
      if (!wide) {
        await P.evaluate(() => window.scrollTo(0, 0));
        const mt = await P.evaluate(MAPSEEN);
        if (mt) note(dev, pname + '(결과)', mt);
      }
      checks += 2;
      /* 지도가 화면에서 사라질 만큼 위가 무겁지 않은가 */
      const m = await P.evaluate(() => {
        const r = document.getElementById('map').getBoundingClientRect();
        return { h: Math.round(r.height), top: Math.round(r.top), vh: innerHeight };
      });
      if (m.h < 180) note(dev, pname, `지도가 너무 낮음 (${m.h}px)`);
      /* 첫 화면에 지도가 조금은 걸쳐 있어야 "아래에 지도가 있다"는 것이 보입니다.
         휴대전화에서는 목록이 지도 아래로 이어지므로 지도 전체가 첫 화면에
         들어올 수는 없습니다 — 60px 도 안 보이면 지도가 있는 줄 모릅니다. */
      if (!wide && m.top > m.vh - 60)
        note(dev, pname, `지도가 첫 화면에 거의 안 보임 (지도 시작 ${m.top}px / 화면 ${m.vh}px)`);
    }
    checks++;

    if (jsErr.length) note(dev, pname, `JS 오류: ${[...new Set(jsErr)].slice(0, 2).join(' / ')}`);
    await ctx.close();
  }
}

console.log(`화면 ${checks}개 점검 · 문제 ${found.length}건\n`);
if (!found.length) console.log('  문제 없음');
/* run.sh 는 '  ✗' 로 시작하는 줄을 실패로 봅니다 — 예전 판은 '  · ' 로
   찍어서 문제를 12건 찾고도 '모두 통과' 로 넘어갔습니다. */
found.forEach(f => console.log('  ✗ ' + f));
await B.close();
process.exit(found.length ? 1 : 0);
