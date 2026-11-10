/* 04 현장 안전거리 확인 — ERG 거리 읽기 · 구역 그리기 · 내 위치 안/밖 · 이어 가기
   (2026-11-09 사용자 결정으로 만든 넷째 도구)

   무엇을 지키는지 —
   · 원문(물질정보 460종)의 숫자를 **빠짐없이** 읽는가. 하나라도 못 읽으면
     그 물질에서 구역이 조용히 빠집니다.
   · 사람이 골라야 하는 것(유출 규모·구분)을 도구가 미리 고르지 않는가.
   · 화면이 **사실만** 말하는가 — "초기이격거리 안/밖" · "방호활동 구역 안".
     "위험합니다·안전합니다" 같은 단정이 들어가면 실패입니다(사용자 결정).
   · 내 위치가 움직이면 결과가 따라 바뀌는가(watchPosition).
   · 휴대전화가 먼저 — 390px 에서 가로로 밀리지 않고, 누르는 것은 40px 이상.
   · 상황 공유(2026-11-10) — 링크 하나로 같은 상황이 서는가, **내 위치가 링크에
     들어가지 않는가**, 잘린 링크에서 지어 메우지 않는가. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/tests\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/\/$/, '').replace(/^file:\/\//, ''));
const B = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = []; const ok = [], bad = []; const chk = (c, m) => (c ? ok : bad).push(m);
const watch = (p) => {
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/TUNNEL|net::/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });
};

/* 여수 산단 언저리 — 사고지점으로 씁니다 */
const ACC = { latitude: 34.7905, longitude: 127.6520 };
const near = (dn, de) => ({ latitude: ACC.latitude + dn / 111000,
  longitude: ACC.longitude + de / (111000 * Math.cos(ACC.latitude * Math.PI / 180)), accuracy: 15 });

const ctx = await B.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  timezoneId: 'Asia/Seoul', locale: 'ko-KR',
  permissions: ['geolocation'], geolocation: { ...ACC, accuracy: 15 },
});
const P = await ctx.newPage(); watch(P);
await P.goto(`file://${RPATH}/safe/index.html`); await P.waitForTimeout(700);

// ══ 1. 원문 읽기 — 460종 전부 ══
const rd = await P.evaluate(() => {
  const M = window.MATERIALS, E = window.ERG;
  let full = 0, part = 0, none = 0;
  const miss = [];
  M.forEach(m => {
    const i = E.info(m);
    if (i.pad.some(e => e.kind === 'dn')) full++; else if (i.any) part++; else none++;
    /* 원문의 숫자 개수와 읽은 개수를 견줍니다 */
    const n2 = ((m.d2 || '').match(/[\d.]+\s*\+?\s*k?m\b/g) || []).length;
    const g2 = i.pad.reduce((a, e) => a + (e.kind === 'dn' ? 2 : 1), 0);
    if (n2 !== g2) miss.push('d2 ' + m.n);
    const n1 = ((m.d1 || '').match(/[\d.,]+\s*k?m\b/g) || []).length;
    /* 아크릴로일클로라이드의 초기이격 원문은 "풍하방향으로 50m 이상" — 반경이
       아니라 원으로 그리지 않습니다(원문은 화면에 그대로 보입니다). */
    if (n1 !== i.iso.length && !/^풍하방향/.test(m.d1)) miss.push('d1 ' + m.n);
  });
  const g = n => E.info(M.find(m => m.n === n));
  const pk = (n, s, v, night) => E.pick(g(n), { size: s, v: v || '', night: night });
  return { n: M.length, full, part, none, miss,
    am: [pk('암모니아', 's', '', false), pk('암모니아', 'l', '', false), pk('암모니아', 'l', '', true)],
    amNone: pk('암모니아', '', '', true),
    cl: pk('염소', 'l', '', true),
    sulf: g('황산').variants, sulfF: pk('황산', 'l', '흄', true), sulfL: pk('황산', 'l', '액체', true),
    thio: pk('염화티오닐', 'l', '수계', true),
    dmc: pk('다이메틸카보네이트', 'l', '', false),
    xyl: pk('m-자일렌', 's', '', false),
    cf: g('염소 펜타플루오라이드').pad.find(e => e.kind === 'dn' && e.size === 'l'),
    h2o2: g('과산화수소') };
});
chk(rd.n === 460, `물질 460종 (${rd.n})`);
chk(rd.full === 92 && rd.part === 254 && rd.none === 114,
  `낮·밤 표가 있는 물질 92 · 일부 254 · 없음 114 (${rd.full}/${rd.part}/${rd.none})`);
chk(rd.miss.length === 0, `원문의 숫자를 빠짐없이 읽었다 (못 읽은 것 ${rd.miss.length}: ${rd.miss.slice(0, 5).join(', ')})`);
chk(rd.am[0].iso.m === 30 && rd.am[0].pad.m === 100, `암모니아 소규모·낮 = 초기이격 30m · 방호 100m`);
chk(rd.am[1].iso.m === 300 && rd.am[1].pad.m === 1900, `암모니아 대규모·낮 = 300m · 1.9km`);
chk(rd.am[2].pad.m === 4500, `암모니아 대규모·밤 = 4.5km`);
chk(rd.amNone.iso === null && rd.amNone.pad === null,
  '규모를 안 고르면 거리를 정하지 않는다(도구가 대신 고르지 않음)');
chk(rd.cl.iso.m === 1000 && rd.cl.pad.m === 11000, `염소 대규모·밤 = 1km · 11km`);
chk(rd.sulf.join('/') === '액체/흄', `황산은 '액체·흄' 구분을 묻는다 (${rd.sulf.join('/')})`);
chk(rd.sulfF.pad.m === 6300 && rd.sulfF.iso === null,
  '황산 흄 대규모·밤 = 방호 6.3km · 초기이격은 원문에 없음(지어내지 않음)');
chk(rd.sulfL.iso.m === 50 && rd.sulfL.pad.kind === 'min' && rd.sulfL.pad.m === 50,
  '황산 액체 = 초기이격 50m · 풍하 50m 이상');
chk(rd.thio.iso.m === 100 && rd.thio.pad.m === 11000, '염화티오닐 수계 대규모·밤 = 100m · 11km');
chk(rd.dmc.iso.m === 300, "'반경 50 m [대량 유출] 300 m' 의 대규모 = 300m");
chk(rd.xyl.pad && rd.xyl.pad.m === 300 && rd.xyl.pad.kind === 'min', "'풍하 방향으로 300 m 이상'(띄어 씀)도 읽는다");
chk(rd.cf && rd.cf.night === 11000 && rd.cf.nightPlus, "'11.0+ km' 를 11km 이상으로 읽는다");
chk(!rd.h2o2.needSize && rd.h2o2.variants.length === 2, '과산화수소 — 규모 구분 없음 · 액체/고체만 묻는다');

/* 낮·밤 — 여수 2026-11-09 일출 06:5x · 일몰 17:2x (KST) */
const sun = await P.evaluate(() => {
  const s = window.ERG.sun(34.7905, 127.652, new Date('2026-11-09T12:00:00+09:00'));
  const k = d => d.getHours() * 60 + d.getMinutes();
  return { r: k(s.rise), s: k(s.set) };
});
chk(Math.abs(sun.r - (6 * 60 + 57)) <= 6 && Math.abs(sun.s - (17 * 60 + 29)) <= 6,
  `일출·일몰 계산 (여수 11/9 — ${Math.floor(sun.r / 60)}:${sun.r % 60} · ${Math.floor(sun.s / 60)}:${sun.s % 60})`);

// ══ 2. 처음 화면 — 무엇을 하면 되는지 ══
chk(await P.isVisible('.sf-steps'), '처음에는 할 일을 차례로 보여 준다');
/* 사고가 잦은 물질 칩은 두었다가 뺐습니다(2026-11-09 사용자 — "오히려 헷갈린다").
   되살아나면 여기서 걸립니다. */
chk((await P.$$('.sf-chip, #sfChips')).length === 0, '사고가 잦은 물질 칩이 없다(물질은 입력칸 하나로)');
chk((await P.$$('#map .ziso, #map .zpad')).length === 0, '물질·사고지점 전에는 구역을 그리지 않는다');

// ══ 3. 암모니아 · 내 위치로 사고지점 · 규모 ══
await P.fill('#sfMat', '암모니아');
await P.click('#btnHereAcc'); await P.waitForTimeout(1200);
chk((await P.textContent('#sfStat')).includes('유출 규모'), '규모를 고르라고 한다');
chk(await P.$eval('#segSize', e => e.classList.contains('need')), '고를 칸이 눈에 띈다(.need)');
chk((await P.$$('#map .ziso')).length === 0, '규모를 고르기 전에는 원을 그리지 않는다');
await P.click('#segSize button[data-v="l"]'); await P.click('#segTime button[data-v="day"]');
await P.waitForTimeout(600);
let s = await P.textContent('#sfStat');
chk(/초기이격\s*300m/.test(s) && /방호활동\s*1\.9km/.test(s), `대규모·낮 거리 요약 (${s.replace(/\s+/g, ' ').slice(0, 60)})`);
chk((await P.$$('#map circle.ziso')).length === 1, '초기이격 원을 그린다');
chk((await P.$$('#map circle.zpad.nodir')).length === 1, '바람을 모르면 방호활동은 점선 원(거리만)');
chk(s.includes('바람 방향을 고르면'), '바람을 고르면 구역이 그려진다고 알려 준다');
await P.click('#segTime button[data-v="night"]'); await P.waitForTimeout(400);
chk(/방호활동\s*4\.5km/.test(await P.textContent('#sfStat')), '밤으로 바꾸면 4.5km');
chk(await P.isVisible('#btnTimeAuto'), '직접 고른 뒤 일출·일몰로 되돌리는 단추');
await P.click('#btnTimeAuto'); await P.click('#segTime button[data-v="day"]'); await P.waitForTimeout(300);

/* 원의 크기가 실제 300m 인가 — 축척 막대와 견줍니다 */
const rr = await P.evaluate(() => {
  const c = document.querySelector('#map circle.ziso');
  const bar = document.querySelector('#scaleBar').getBoundingClientRect().width;
  const t = document.querySelector('#scaleTxt').textContent;
  const m = /km/.test(t) ? parseFloat(t) * 1000 : parseFloat(t);
  return { r: +c.getAttribute('r'), pxPerM: bar / m };
});
chk(Math.abs(rr.r / rr.pxPerM - 300) < 25, `초기이격 원의 반지름이 300m (${Math.round(rr.r / rr.pxPerM)}m)`);

// ══ 4. 바람 → 풍하 정사각형 · 내 위치 안/밖 ══
await P.click('#windBtn'); await P.click('#windPop .wr-b[data-deg="225"]'); await P.waitForTimeout(600);
chk((await P.$$('#map path.zpad')).length === 1, '바람을 고르면 방호활동 구역(정사각형)을 그린다');
chk((await P.$$('#map path.zwind')).length === 1, '바람이 불어가는 쪽 화살표');
const sq = await P.evaluate(() => {
  const d = document.querySelector('#map path.zpad').getAttribute('d');
  const n = d.match(/-?[\d.]+/g).map(Number);
  const pts = [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]], [n[6], n[7]]];
  const L = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return [L(pts[0], pts[1]), L(pts[1], pts[2]), L(pts[2], pts[3]), L(pts[3], pts[0])];
});
chk(Math.max(...sq) - Math.min(...sq) < 2, `구역은 정사각형 — 길이·폭이 같다 (${sq.map(Math.round).join('/')}px)`);

await P.click('#btnWatch'); await P.waitForTimeout(1000);
const status = async () => (await P.textContent('.sf-pt.me')) || '';
await ctx.setGeolocation(near(50, 0)); await P.waitForTimeout(1200);
s = await status();
chk(s.includes('초기이격거리 안') && (await P.$$('.sf-pt.me.iso')).length === 1, `50m 북쪽 → 초기이격거리 안 (${s.trim().slice(0, 30)})`);
chk(/경계까지/.test(s), '경계까지 거리를 적는다');
await ctx.setGeolocation(near(707, 707)); await P.waitForTimeout(1200);
s = await status();
chk(s.includes('방호활동 구역 안') && (await P.$$('.sf-pt.me.pad')).length === 1, `1km 풍하(북동) → 방호활동 구역 안 (${s.trim().slice(0, 30)})`);
await ctx.setGeolocation(near(-707, -707)); await P.waitForTimeout(1200);
s = await status();
chk(s.includes('두 구역 밖'), `1km 풍상(남서) → 두 구역 밖 (${s.trim().slice(0, 30)})`);
/* 사실만 — 단정하는 말이 없어야 합니다 */
const all = await P.textContent('#sfStat');
chk(!/위험합니다|안전합니다|대피하세요|안전한|위험한/.test(all), '결과는 사실만 적는다(위험·안전 단정 없음)');

/* 지도를 누른 곳 */
/* 지도가 화면 아래에 있으면 누를 수 없으므로 먼저 보이게 합니다(휴대전화) */
await P.locator('#map').scrollIntoViewIfNeeded(); await P.waitForTimeout(300);
const box = await P.locator('#map').boundingBox();
await P.touchscreen.tap(box.x + box.width * 0.25, box.y + box.height * 0.4); await P.waitForTimeout(500);
chk((await P.$$('.sf-pt.probe')).length === 1, '지도를 누르면 그 자리도 확인한다');
await P.click('.sf-pt .px'); await P.waitForTimeout(300);
chk((await P.$$('.sf-pt.probe')).length === 0, '누른 곳은 × 로 지운다');
await P.click('#btnWatch'); await P.waitForTimeout(300);
chk((await P.$$('.sf-pt.me')).length === 0, '내 위치 확인을 끄면 그 줄이 사라진다');
await ctx.setGeolocation({ ...ACC, accuracy: 15 });

/* 원문·표 */
/* 물질 정보는 접혀 있고(필요할 때만 펼침 · 2026-11-09 사용자), 펼치면 물질정보의
   글이 고치지 않은 채로 나온다. 내 위치를 받아 다시 그려도 펼친 채로 남아야
   한다(읽는 중에 닫히면 안 됨). 화면에 '원문'이라는 말은 쓰지 않는다. */
chk(await P.$eval('#sfInfo', d => !d.open), '물질 정보는 처음에 접혀 있다');
await P.click('#sfInfo summary'); await P.waitForTimeout(200);
/* 물질정보 글은 원문의 나눔 표시(• · / · [ ] · ※)마다 줄을 바꿉니다 — 한 줄로 흘러
   읽기 어렵다는 사용자 댓글(2026-11-09). 글자는 한 자도 바꾸지 않습니다. */
const ddl = await P.$$eval('#sfInfo dl:first-of-type dd', ds => ds.map(d =>
  [...d.querySelectorAll('.mtx > li')].map(li => li.textContent.trim())));
chk(ddl[0] && ddl[0].join('|') === '소규모 반경 30m|대규모 반경 300m 이내',
  `초기이격거리 글이 규모마다 한 줄 (${(ddl[0] || []).join(' | ')})`);
chk(ddl[1] && ddl[1].length === 2 && /^대규모 유출시/.test(ddl[1][0]) && /^소규모 유출시/.test(ddl[1][1]),
  `방호활동거리 글이 「•」 항목마다 한 줄 (${(ddl[1] || []).map(x => x.slice(0, 8)).join(' | ')})`);
/* 460종 전부 — 나눈 뒤에도 글자가 하나도 빠지지 않고, 「•」 가 남은 칸이 없어야 합니다 */
const mt = await P.evaluate(() => {
  const F = ['d1', 'd2', 'd3', 'sy', 'e1', 'e2', 'e3'], box = document.createElement('div');
  let lost = [], dot = [], split = 0;
  for (const m of MATERIALS) for (const f of F) {
    const v = m[f]; if (!v) continue;
    box.innerHTML = MatPicker.textHtml(v);
    if (box.querySelector('li, span')) split++;
    const a = box.textContent.replace(/[\s•\/]/g, ''), b = v.replace(/[\s•\/]/g, '');
    if (a !== b) lost.push(m.n + ' ' + f);
    if (/•/.test(box.textContent)) dot.push(m.n + ' ' + f);
  }
  return { lost, dot, split };
});
chk(mt.lost.length === 0, `물질정보 글을 나눠도 글자가 빠지지 않는다 (${mt.split}칸 나눔 · 빠진 곳 ${mt.lost.slice(0, 3).join(', ') || '없음'})`);
chk(mt.dot.length === 0, `「•」 로 이어 붙은 채 남은 칸이 없다 (${mt.dot.slice(0, 3).join(', ') || '없음'})`);
await P.click('#btnWatch'); await P.waitForTimeout(900);
await ctx.setGeolocation(near(80, 0)); await P.waitForTimeout(1200);
chk(await P.$eval('#sfInfo', d => d.open), '내 위치가 바뀌어 다시 그려도 펼친 채로 남는다');
await P.click('#btnWatch'); await P.waitForTimeout(300);
await ctx.setGeolocation({ ...ACC, accuracy: 15 });
const 원문 = await P.evaluate(() => ['.sf-q', '#sfStat', '#sfMore', '#mLeg']
  .map(s => document.querySelector(s).textContent).join(' ') + document.title);
chk(!/원문/.test(원문), "화면에 '원문' 이라는 말이 없다");
/* 어려운 말 — "방호활동은 바람이 불어가는 쪽 거리" 가 너무 어렵다는 지적(2026-11-09).
   '풍하'·'미입력' 대신 "바람 따라 퍼지는 쪽"·"바람 방향 모름" 으로 씁니다 */
/* 접어 둔 「물질 정보 더 보기」 안은 물질정보의 글을 고치지 않고 싣는 자리라 뺍니다 */
const 우리말 = await P.evaluate(() => {
  const c = document.querySelector('#sfMore').cloneNode(true);
  const i = c.querySelector('#sfInfo'); if (i) i.remove();
  return ['.sf-q', '#sfStat', '#mLeg'].map(s => document.querySelector(s).textContent).join(' ')
    + c.textContent + [...document.querySelectorAll('#map text')].map(t => t.textContent).join(' ');
});
chk(!/풍하|미입력|불어가는/.test(우리말), `어려운 말(풍하·미입력·불어가는)이 없다`);
chk((await P.textContent('.sf-key')).includes('바람 따라 퍼지는 쪽'), '표 아래 읽는 법은 쉬운 말로');
chk((await P.$$('.sf-tbl td.hit')).length >= 2, '거리 표에서 지금 고른 칸을 짚는다');

// ══ 5. 자료가 없는 물질 · 구분이 있는 물질 ══
await P.fill('#sfMat', '붕산'); await P.waitForTimeout(400);
s = await P.textContent('#sfStat');
chk(s.includes('자료가 없습니다') && (await P.$$('#map .ziso, #map .zpad')).length === 0,
  '거리 자료가 없는 물질은 그렇다고 적고 그리지 않는다');
await P.fill('#sfMat', '염화티오닐'); await P.waitForTimeout(400);
chk(await P.isVisible('#sfVarRow'), '원문이 육지·수계로 나뉜 물질은 구분을 묻는다');
chk(await P.$eval('#segVar', e => e.classList.contains('need')), '구분도 도구가 미리 고르지 않는다');
/* 구분은 가짓수만큼만 — 줄 끝까지 늘어나지 않습니다(사용자 — "2개면 2개만 딱 딱") */
const vb = await P.evaluate(() => {
  const seg = document.querySelector('#segVar').getBoundingClientRect();
  const row = document.querySelector('#sfVarRow .sf-in').getBoundingClientRect();
  return { n: document.querySelectorAll('#segVar button').length, w: seg.width, row: row.width };
});
chk(vb.n === 2 && vb.w < vb.row * 0.7, `구분 칸이 두 칸 폭만큼만 (${Math.round(vb.w)} / 줄 ${Math.round(vb.row)}px)`);
await P.fill('#sfMat', '황산'); await P.waitForTimeout(300);
chk((await P.$$eval('#segVar button', b => b.map(x => x.textContent.trim()).join('·'))) === '액체·흄',
  '황산은 액체·흄 두 칸');
await P.fill('#sfMat', '염화티오닐'); await P.waitForTimeout(300);
await P.click('#segVar button[data-v="수계"]'); await P.click('#segTime button[data-v="night"]'); await P.waitForTimeout(400);
chk(/방호활동\s*11km/.test(await P.textContent('#sfStat')), '염화티오닐 수계·대규모·밤 = 11km');
await P.fill('#sfMat', '과산화수소'); await P.waitForTimeout(400);
chk(await P.$eval('#segSize button', b => b.disabled), '규모 구분이 없는 물질은 규모 단추를 잠근다');

// ══ 5-1. 물질 칸을 다시 누르면 새로 찾기 (2026-11-09 사용자 댓글) ══
/* "검색했다가 다시 클릭하면 이전 내용을 직접 지우고 다시 눌러야 한다" — 누르면 칸이
   비고 전체 목록이 열려야 합니다. 아무것도 안 고르고 나가면 원래 물질로 돌아옵니다. */
await P.keyboard.press('Escape'); await P.waitForTimeout(150);
await P.click('#sfMat'); await P.waitForTimeout(250);
const fr = await P.evaluate(() => ({ v: document.querySelector('#sfMat').value,
  ph: document.querySelector('#sfMat').placeholder,
  cnt: (document.querySelector('#mpkCnt') || {}).textContent || '',
  open: !document.querySelector('#mpkCnt').closest('.mpk').hidden }));
chk(fr.v === '' && fr.open && /사고 많은 순/.test(fr.cnt),
  `다시 누르면 칸이 비고 전체 목록이 열린다 (값 '${fr.v}' · ${fr.cnt})`);
chk(fr.ph === '과산화수소', `지금 고른 물질은 흐린 글씨로 보인다 (${fr.ph})`);
chk((await P.textContent('#sfStat')).length > 0 && await P.$eval('#segSize button', b => b.disabled),
  '칸을 비워도 화면은 원래 물질 그대로다(아직 안 골랐으므로)');
await P.keyboard.press('Escape'); await P.waitForTimeout(150);
chk(await P.inputValue('#sfMat') === '과산화수소', '아무것도 안 고르고 닫으면 원래 물질로 돌아온다');
await P.click('#sfMat'); await P.waitForTimeout(200);
await P.keyboard.type('황산'); await P.waitForTimeout(250);
await P.click('.mpk-row >> nth=0'); await P.waitForTimeout(300);
chk(await P.inputValue('#sfMat') === '황산'
  && (await P.$$eval('#segVar button', b => b.map(x => x.textContent.trim()).join('·'))) === '액체·흄',
  '다시 눌러 새 이름을 치고 고르면 그 물질로 바뀐다');
await P.click('#sfMat'); await P.waitForTimeout(200);
await P.click('#sfStat', { position: { x: 5, y: 5 } }); await P.waitForTimeout(200);
chk(await P.inputValue('#sfMat') === '황산', '칸 밖을 눌러 나가도 원래 물질로 돌아온다');

// ══ 6. 휴대전화 — 가로 밀림 · 손가락 크기 ══
for (const w of [320, 390]) {
  await P.setViewportSize({ width: w, height: 760 }); await P.waitForTimeout(300);
  const o = await P.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  chk(o <= 1, `${w}px — 가로로 밀리지 않는다 (넘침 ${o}px)`);
}
const small = await P.$$eval('.sf-q button:not([disabled]), .sf-acts button, .mapctl button', bs =>
  bs.filter(b => b.offsetParent).map(b => [b.textContent.trim() || b.title, b.getBoundingClientRect().height])
    .filter(x => x[1] < 31.5));
chk(small.length === 0, `누르는 것이 충분히 크다 (작은 것: ${small.map(x => x[0] + ' ' + Math.round(x[1])).join(', ')})`);

// ══ 7. 이어 가기 — ① 대피장소 · ② 문자 ══
await P.fill('#sfMat', '암모니아'); await P.waitForTimeout(300);
await P.click('#segSize button[data-v="l"]'); await P.waitForTimeout(300);
chk(await P.isVisible('#goMap') && await P.isVisible('#goSms'), '이어 가기 단추 두 개');
await P.click('#goMap'); await P.waitForURL(/map\/index\.html/); await P.waitForTimeout(1200);
const mp = await P.evaluate(() => ({ mat: document.querySelector('#mMat').value,
  lat: document.querySelector('#acLat').value,
  r: [...document.querySelectorAll('#mRad button[aria-pressed="true"]')].map(b => b.textContent).join(),
  toast: document.querySelector('#mToast').textContent }));
chk(mp.mat === '암모니아' && Math.abs(+mp.lat - ACC.latitude) < 1e-4,
  `① 대피장소 찾기가 사고지점·물질을 받는다 (${mp.mat} · ${mp.lat})`);
chk(mp.r === '300m', `영향 참고 반경은 초기이격거리만 넘긴다 (${mp.r})`);
chk(mp.toast.includes('현장 안전거리 확인'), '어디서 왔는지 알려 준다');
await P.goto(`file://${RPATH}/safe/index.html`); await P.waitForTimeout(500);
await P.fill('#sfMat', '암모니아'); await P.waitForTimeout(200);
await P.click('#goSms'); await P.waitForURL(/sms\/index\.html/); await P.waitForTimeout(900);
const sb = await P.textContent('#seedBar');
chk(/현장 안전거리 확인에서 넘어왔습니다/.test(sb) && sb.includes('암모니아'),
  `② 문자생성기가 물질을 받는다 (${sb.replace(/\s+/g, ' ').slice(0, 50)})`);
await ctx.close();

// ══ 8. 넓은 화면 — 지도가 오른쪽 ══
const W = await B.newPage({ viewport: { width: 1440, height: 900 } }); watch(W);
await W.goto(`file://${RPATH}/safe/index.html`); await W.waitForTimeout(500);
const wl = await W.evaluate(() => ({ map: document.querySelector('.sf-map').getBoundingClientRect(),
  q: document.querySelector('.sf-q').getBoundingClientRect() }));
chk(wl.map.left >= wl.q.right - 1 && wl.map.height > 600, `넓은 화면 — 조건 왼쪽 · 지도 오른쪽 (지도 ${Math.round(wl.map.width)}×${Math.round(wl.map.height)})`);
await W.close();

// ══ 9. 망분리용 단일 파일 ══
const D = await B.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); watch(D);
await D.goto(`file://${RPATH}/dist/` + encodeURIComponent('화학사고_현장안전거리_확인.html'));
await D.waitForTimeout(700);
const dd = await D.evaluate(() => ({ next: !!document.querySelector('#sfNext'),
  ext: [...document.querySelectorAll('script[src], link[href]')].map(e => e.getAttribute('src') || e.getAttribute('href'))
    .filter(u => u && !/^data:/.test(u)) }));
chk(!dd.next, '단일 파일에는 이어 가기 줄이 없다(옆 도구가 없음)');
chk(dd.ext.length === 0, `단일 파일이 바깥 파일을 부르지 않는다 (${dd.ext.join(', ')})`);
await D.fill('#sfMat', '염산');
await D.locator('#map').scrollIntoViewIfNeeded(); await D.waitForTimeout(300);
const db = await D.locator('#map').boundingBox();
await D.touchscreen.tap(db.x + db.width / 2, db.y + db.height / 2); await D.waitForTimeout(500);
await D.click('#segSize button[data-v="s"]'); await D.waitForTimeout(500);
chk((await D.$$('#map circle.ziso')).length === 1, '단일 파일에서도 구역을 그린다');
chk(await D.isVisible('#btnShare') && (await D.$$('#shareModal')).length === 1,
  '단일 파일에도 상황 공유가 있다(링크는 사이트 주소로)');
await D.close();

// ══ 10. 상황 공유 — 링크 하나로 같은 상황을 보내고 받기 (2026-11-10) ══
/* 서버가 없습니다 — 상황을 주소 뒤 # 에 담고, 받은 화면이 그것을 읽습니다.
   휴대전화의 공유 창(navigator.share)은 이 검사에서 가짜로 바꿔 넘긴 것을 받습니다. */
const SHARE_HOME = 'https://rlawogns221221221-create.github.io/nics_chem-safety-cheatkey/safe/';
const 폰 = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  timezoneId: 'Asia/Seoul', locale: 'ko-KR' };
const sc = await B.newContext({ ...폰, permissions: ['geolocation'], geolocation: { ...ACC, accuracy: 15 } });
await sc.addInitScript(() => { navigator.share = d => { window.__shared = d; return Promise.resolve(); }; });
const 채우기 = async (pg, mat, size) => {
  await pg.fill('#sfMat', mat); await pg.keyboard.press('Escape');
  await pg.click('#btnHereAcc'); await pg.waitForTimeout(1200);
  if (size) await pg.click(`#segSize button[data-v="${size}"]`);
  await pg.waitForTimeout(400);
};
const S1 = await sc.newPage(); watch(S1);
await S1.goto(`file://${RPATH}/safe/index.html`); await S1.waitForTimeout(500);
chk(!(await S1.$('#btnShare')), '물질·사고지점 전에는 공유 단추가 없다');
await S1.fill('#sfMat', '암모니아'); await S1.keyboard.press('Escape');
await S1.click('#btnHereAcc'); await S1.waitForTimeout(1200);
chk(!(await S1.$('#btnShare')), '유출 규모를 고르기 전에도 없다(반쪽 상황을 보내지 않음)');
await S1.click('#segSize button[data-v="l"]'); await S1.click('#segTime button[data-v="night"]');
await S1.click('#windBtn'); await S1.click('#windPop .wr-b[data-deg="225"]'); await S1.waitForTimeout(400);
/* 내 위치를 사고지점에서 옮겨 둡니다 — 링크나 글에 내 위치가 들어가면 여기서 걸립니다 */
const ME2 = near(400, 300);
await sc.setGeolocation(ME2);
await S1.click('#btnWatch'); await S1.waitForTimeout(1200);
chk(await S1.isVisible('#btnShare'), '조건이 다 갖춰지면 상황 공유 단추');
await S1.click('#btnShare'); await S1.waitForTimeout(300);
const sh = await S1.evaluate(() => window.__shared);
const su = new URL(sh.url), hp = new URLSearchParams(su.hash.slice(1));
chk(sh.url.startsWith(SHARE_HOME + '#'), `파일로 열었으면 사이트 주소로 링크를 만든다 (${sh.url.slice(0, 64)})`);
chk(hp.get('m') === '암모니아' && hp.get('la') === '34.7905' && hp.get('lo') === '127.652' && hp.get('z') === 'l'
  && hp.get('w') === '225' && hp.get('t') === 'n' && /^\d{12}$/.test(hp.get('at') || ''),
  `링크에 물질·사고지점·규모·바람·낮밤·보낸 시각이 담긴다 (${decodeURIComponent(su.hash)})`);
chk(!hp.has('n'), '"내 위치에서 찍음" 이름표는 링크에 넣지 않는다(받은 쪽에서 뜻이 틀려짐)');
const meLat = ME2.latitude.toFixed(4), meLon = ME2.longitude.toFixed(4);
chk(![meLat, meLon].some(x => sh.url.includes(x) || sh.text.includes(x)),
  `내 위치는 링크에도 글에도 없다 (${meLat}, ${meLon})`);
chk(/물질: 암모니아 \(대규모 · 밤\)/.test(sh.text) && sh.text.includes('바람: 남서풍')
  && /초기이격 300m · 방호활동 4\.5km/.test(sh.text) && sh.text.includes('전라남도 여수시(대략)'),
  '함께 보내는 글에 화면의 사실이 그대로(물질·조건·바람·두 거리·지역)');
chk(!/위험합니다|안전합니다|대피하세요|안전한|위험한|원문|풍하/.test(sh.text), '함께 보내는 글도 사실만(단정·어려운 말 없음)');
await S1.close();

/* 받는 쪽 — 위치 권한도 없는 다른 휴대전화 */
const rc = await B.newContext(폰);
const S2 = await rc.newPage(); watch(S2);
await S2.goto(`file://${RPATH}/safe/index.html` + su.hash); await S2.waitForTimeout(900);
const rv = await S2.evaluate(() => ({ mat: document.querySelector('#sfMat').value,
  stat: document.querySelector('#sfStat').textContent, time: document.querySelector('#sfTime').textContent,
  night: document.querySelector('#segTime button[data-v="night"]').getAttribute('aria-pressed'),
  big: document.querySelector('#segSize button[data-v="l"]').getAttribute('aria-pressed'),
  wind: document.querySelector('#windBtnTxt').textContent,
  iso: document.querySelectorAll('#map circle.ziso').length, pad: document.querySelectorAll('#map path.zpad').length,
  me: !!document.querySelector('.sf-pt.me') }));
chk(rv.mat === '암모니아' && rv.big === 'true' && rv.night === 'true' && rv.wind === '남서풍',
  `받으면 같은 조건이 선다 (${rv.mat} · 대규모 ${rv.big} · 밤 ${rv.night} · ${rv.wind})`);
chk(rv.iso === 1 && rv.pad === 1, '받으면 같은 구역을 그린다(초기이격 원 · 방호활동 정사각형)');
chk(/공유받은 상황/.test(rv.stat) && /\d+월 \d+일 \d\d:\d\d에 보냄/.test(rv.stat), '맨 위에 공유받은 상황 · 보낸 시각');
chk(/방호활동\s*4\.5km/.test(rv.stat) && rv.time.includes('보낸 사람 기준'),
  '낮·밤은 보낸 사람 화면 그대로(밤 4.5km) · "보낸 사람 기준" 이라고 적는다');
chk(!rv.me, '받은 쪽에 내 위치를 지어 넣지 않는다');
await S2.click('#segSize button[data-v="s"]'); await S2.waitForTimeout(300);
chk(!/공유받은 상황/.test(await S2.textContent('#sfStat')), "조건을 바꾸면 '공유받은 상황' 딱지를 내린다");
/* 같은 창에서 다른 링크 — # 만 바뀌면 화면을 새로 읽지 않습니다 */
await S2.evaluate(h => { location.hash = h; }, '#m=' + encodeURIComponent('염산') + '&la=35.5&lo=129.3&z=s&t=d');
await S2.waitForTimeout(700);
chk((await S2.inputValue('#sfMat')).includes('염산') && /공유받은 상황/.test(await S2.textContent('#sfStat')),
  '같은 창에서 다른 링크를 열어도 새 상황을 읽는다');
await S2.$eval('#btnClear', b => b.click()); await S2.waitForTimeout(300);
chk(!/m=/.test(await S2.evaluate(() => location.hash)), '처음부터를 누르면 주소의 # 도 지운다(새로고침해도 안 되살아남)');
/* 잘린 링크 — 지어 메우지 않고 못 읽었다고 적습니다 */
await S2.goto(`file://${RPATH}/safe/index.html#m=%ZZ&la=999&lo=x`); await S2.reload(); await S2.waitForTimeout(700);
const bad1 = await S2.textContent('#sfStat');
chk(/물질·사고지점을 읽지 못했습니다/.test(bad1) && !/공유받은 상황/.test(bad1)
  && (await S2.$$('#map .ziso, #map .zpad')).length === 0, '잘린 링크 — 못 읽었다고 적고 아무것도 그리지 않는다');
await S2.goto(`file://${RPATH}/safe/index.html#m=${encodeURIComponent('암모니아')}&la=91&lo=127`);
await S2.reload(); await S2.waitForTimeout(700);
chk(await S2.inputValue('#sfMat') === '암모니아' && /사고지점을 읽지 못했습니다/.test(await S2.textContent('#sfStat')),
  '읽은 것(물질)만 쓰고 못 읽은 것(사고지점)은 그렇다고 적는다');
await rc.close();

/* 공유 창이 없는 브라우저(대부분의 PC) — 글과 링크를 복사합니다 */
const cc = await B.newContext({ ...폰, permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
  geolocation: { ...ACC, accuracy: 15 } });
await cc.addInitScript(() => { try { delete Navigator.prototype.share; } catch (e) {} });
const S3 = await cc.newPage(); watch(S3);
await S3.goto(`file://${RPATH}/safe/index.html`); await S3.waitForTimeout(500);
await 채우기(S3, '염산', 's');
await S3.click('#btnShare'); await S3.waitForTimeout(500);
const clip = await S3.evaluate(() => navigator.clipboard.readText().catch(e => 'ERR ' + e.message));
chk(clip.startsWith('[화학사고 현장 안전거리 확인]') && clip.includes(SHARE_HOME + '#m='),
  `공유 창이 없으면 글과 링크를 복사한다 (${clip.split('\n').pop().slice(0, 50)})`);
chk((await S3.textContent('#sfStat')).includes('링크를 복사했습니다'), '복사했다고 알려 준다');
await cc.close();

/* 복사까지 막힌 곳(확인용 사본 등) — 직접 복사할 창 */
const mc = await B.newContext({ ...폰, permissions: ['geolocation'], geolocation: { ...ACC, accuracy: 15 } });
await mc.addInitScript(() => {
  try { delete Navigator.prototype.share; } catch (e) {}
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('막힘')) } });
  document.execCommand = () => false;
});
const S4 = await mc.newPage(); watch(S4);
await S4.goto(`file://${RPATH}/safe/index.html`); await S4.waitForTimeout(500);
await 채우기(S4, '염산', 's');
await S4.click('#btnShare'); await S4.waitForTimeout(400);
chk(await S4.isVisible('#shareModal') && (await S4.inputValue('#shareText')).includes(SHARE_HOME + '#m='),
  '공유·복사가 다 막히면 직접 복사할 창에 글과 링크를 보여 준다');
await S4.keyboard.press('Escape'); await S4.waitForTimeout(200);
chk(!(await S4.isVisible('#shareModal')), 'Esc 로 그 창을 닫는다');
await mc.close();

/* 웹 주소로 열었으면 그 주소로 — 사이트를 어디에 올리든(Cloudflare · 다른 기관) 맞게 */
const 종류 = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  const f = path.join(RPATH, decodeURIComponent(q.url.split(/[?#]/)[0]));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': 종류[path.extname(f)] || 'application/octet-stream' }); r.end(b);
  });
});
await new Promise(res => srv.listen(0, '127.0.0.1', res));
const 웹 = `http://127.0.0.1:${srv.address().port}/safe/index.html`;
await sc.setGeolocation({ ...ACC, accuracy: 15 });
const S5 = await sc.newPage(); watch(S5);
await S5.goto(웹); await S5.waitForTimeout(600);
await 채우기(S5, '암모니아', 'l');
await S5.click('#btnShare'); await S5.waitForTimeout(300);
const wurl = (await S5.evaluate(() => window.__shared)).url;
chk(wurl.startsWith(웹 + '#m='), `웹 주소로 열었으면 그 주소로 링크를 만든다 (${wurl.slice(0, 50)})`);
const S6 = await (await B.newContext(폰)).newPage(); watch(S6);
await S6.goto(wurl); await S6.waitForTimeout(900);
chk(await S6.inputValue('#sfMat') === '암모니아' && (await S6.$$('#map circle.ziso')).length === 1,
  '그 링크를 다른 휴대전화에서 열면 같은 구역이 선다');
await sc.close(); srv.close();

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
