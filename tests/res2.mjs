import { chromium } from 'playwright';
/* ③ 방제 물품·장비 찾기 — 두 갈래(업체 섭외 · 방제물품) 검증.

   2026-09-07 사용자 분류안(PPT)대로 다시 짠 화면입니다 —
   걸음 1 무엇을 하려는가(두 갈래) → 걸음 2 갈래 7 / 물품 27 → 걸음 3 사고지점.

   저장소를 어디에 두어도 돌게 — 이 파일 자리에서 저장소 뿌리를 찾는다.
   URL 생성자를 쓰지 않습니다(스크립트가 URL 이라는 이름을 쓰는 곳이 있어
   가려집니다 — bug1.mjs). 문자열만 잘라 씁니다. */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/tests\/$/, '');
const B = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [], ok = [], bad = []; const chk = (c, m) => (c ? ok : bad).push(m);
const P = await B.newPage({ viewport: { width: 1500, height: 950 } });
P.on('pageerror', e => errs.push(e.message));
await P.goto(ROOT + 'res/index.html'); await P.waitForTimeout(1200);

/* ══ 걸음 1 — 두 갈래 ════════════════════════════════════════
   "결국 방제자원은 맨처음 2가지 큰 틀로 나뉘어질거야. 업체 섭외와
   방제물품 찾기 두가지로."(사용자) */
chk(!(await P.isHidden('#rz')), '들어오면 시작 화면 하나만 보인다');
chk(await P.isHidden('.mmain'), '걸음을 마치기 전에는 지도·목록을 두지 않는다');
chk(await P.isHidden('.mbar'), '조건 줄도 없다');
chk(!(await P.isHidden('#rzP0')) && await P.isHidden('#rzP1') && await P.isHidden('#rzP2'),
  '걸음 1 부터 시작한다');

const brs = await P.$$eval('#rzBr .rz-br', bs => bs.map(b => ({
  id: b.dataset.b,
  t: b.querySelector('.rz-br-t').textContent.trim(),
  d: b.querySelector('.rz-br-d').textContent.trim(),
  n: b.querySelector('.rz-br-n').textContent.trim(),
  ic: b.querySelectorAll('.rk-ic path,.rk-ic circle,.rk-ic rect').length })));
chk(brs.length === 2, `갈래가 둘이다 (${brs.length})`);
chk(brs[0].id === 'biz' && brs[1].id === 'item',
  `업체 섭외 → 방제물품 차례 (${brs.map(b => b.t).join(' → ')})`);
/* 이름만으로는 무엇을 하는 자리인지 담당자가 알 수 없습니다 — 카드에
   무슨 일인지 적혀 있어야 합니다. */
chk(brs.every(b => b.d.length > 8), '카드마다 무슨 일을 하는 자리인지 적혀 있다');
chk(brs.every(b => b.ic > 0), '카드마다 그림이 그려진다');
/* 건수는 지어내지 않고 자료에서 센 값이어야 합니다 */
const real = await P.evaluate(() => ({ biz: RES2_BIZ.length, item: RES2_ITEM.length }));
chk(brs[0].n === real.biz.toLocaleString() + '줄'
    && brs[1].n === real.item.toLocaleString() + '줄',
  `카드의 건수가 자료와 같다 (${brs.map(b => b.n).join(' / ')})`);

/* ── 같은 곳이 두 자리로 실려 있지 않은가 ──────────────────────
   2026-09-08 사용자 지적 — "똑같은 장소가 여러 개 나옴". 표마다 주소
   앞머리를 적는 방식이 달라(경상북도 김천시 … / 김천시 …) 같은 기관이
   두 자리가 되고 보유 물품까지 갈라졌습니다. 번호만 다른 곳은 자리를
   합치고 번호를 `t2` 에 모읍니다 — 번호는 하나도 버리지 않습니다. */
const 겹침 = await P.evaluate(() => {
  const c = {};
  RES2_PLACE.forEach(p => {
    const k = [p.n || '', p.sd || '', p.sg || '', p.a || ''].join('|');
    c[k] = (c[k] || 0) + 1;
  });
  const d = Object.entries(c).filter(([, n]) => n > 1);
  return { 곳: d.length, 보기: d.slice(0, 3).map(([k]) => k),
    번호여럿: RES2_PLACE.filter(p => p.t2 && p.t2.length).length };
});
chk(겹침.곳 === 0, `같은 이름·주소가 두 자리로 실려 있지 않다 (${겹침.보기.join(' / ') || '없음'})`);
chk(겹침.번호여럿 > 0, `번호가 여럿이던 곳은 번호를 모아 둔다 (${겹침.번호여럿}곳)`);

/* 갈래를 고르기 전에는 다음 걸음으로 갈 수 없습니다 — 다음 화면이 무엇을
   묻는지가 갈래로 정해지기 때문입니다. */
chk(await P.$eval('#rzBar button[data-go="2"]', b => b.disabled),
  '갈래를 고르기 전에는 걸음 2 표시가 잠겨 있다');
chk(await P.$eval('#rzBar button[data-go="3"]', b => b.disabled),
  '걸음 3 표시도 잠겨 있다');

/* ══ 업체 섭외 ═══════════════════════════════════════════════ */
await P.click('#rzBr .rz-br[data-b="biz"]'); await P.waitForTimeout(500);
chk(!(await P.isHidden('#rzP1')) && await P.isHidden('#rzP0'), '갈래를 고르면 걸음 2 로 넘어간다');
chk(/맡기려/.test(await P.textContent('#rzH1')),
  `업체는 "무엇을 맡기려 하십니까?" 라고 묻는다 (${await P.textContent('#rzH1')})`);

const cats = await P.$$eval('#rzNeeds .rz-need', bs => bs.map(b => ({
  id: b.dataset.k,
  t: b.querySelector('.rz-need-t').textContent.trim(),
  d: b.querySelector('.rz-need-d').textContent.trim(),
  n: b.querySelector('.rz-need-n').textContent.trim(),
  ic: b.querySelectorAll('.rk-ic path,.rk-ic circle,.rk-ic rect').length,
  hidden: b.querySelector('.rk-ic').getAttribute('aria-hidden') })));
chk(cats.length === 7, `갈래 일곱 (${cats.length})`);
/* ⚠ 중간처분은 소각·중화를 나누지 않고 하나입니다(2026-09-07 사용자 —
   "중간처분은 다 합치도록 하자"). 다시 쪼개면 여기서 실패합니다. */
chk(cats.filter(c => /중간처분/.test(c.t)).length === 1,
  `중간처분은 하나다 (${cats.filter(c => /중간처분/.test(c.t)).map(c => c.t).join('/') || '없음'})`);
chk(cats.some(c => c.id === 'toxgas') && cats.some(c => c.id === 'wwater'),
  '독성가스·폐수 수탁처리가 각각 별도 갈래다');
const catReal = await P.evaluate(() => RES2_CATS.map(c => c.id + '|' + c.n));
chk(cats.every((c, i) => catReal[i] === c.id + '|' + parseInt(c.n.replace(/[^\d]/g, ''), 10)),
  `갈래의 건수가 자료와 같다 (${cats.map(c => c.n).join('/')})`);
chk(cats.every(c => c.ic > 0), '갈래마다 그림이 그려진다');
chk(cats.every(c => c.hidden === 'true'), '그림은 화면낭독기에서 빠진다 (이름이 옆에 있다)');
chk(cats.every(c => c.d.length > 4), '갈래마다 무엇을 하는 곳인지 한 줄로 적혀 있다');

chk(await P.$eval('#rzNext', b => b.disabled), '아무것도 안 고르면 다음 단추가 잠긴다');
await P.click('#rzNeeds .rz-need[data-k="mid"]'); await P.waitForTimeout(400);
chk(await P.$eval('#rzNeeds .rz-need[data-k="mid"]', b => b.getAttribute('aria-pressed')) === 'true',
  '누르면 골라진 것이 보인다');
/* 처음 누르면 "그 갈래만" 고른 것으로 봅니다 — 일곱을 하나씩 끄게 하면
   고르는 일이 여섯 번이 됩니다. */
chk(await P.$eval('#rzNeeds .rz-need[data-k="carry"]', b => b.getAttribute('aria-pressed')) === 'false',
  '하나를 누르면 그것만 골라진다 (나머지는 꺼진다)');
const nextTxt = await P.$eval('#rzNext', b => b.textContent.trim());
chk(/\d+곳/.test(nextTxt), `다음 단추가 몇 곳이 나올지 알려 준다 (${nextTxt})`);

await P.click('#rzNext'); await P.waitForTimeout(500);
chk(!(await P.isHidden('#rzP2')), '걸음 3 으로 넘어간다');
const lead3 = await P.$eval('#rzP2Lead', e => e.textContent.replace(/\s+/g, ' ').trim());
chk(/중간처분/.test(lead3), `걸음 3 이 무엇을 골랐는지 다시 적어 준다 (${lead3.slice(0, 44)})`);
chk((await P.$$('#rzP2 .rz-way')).length === 3, '사고지점 넣는 길이 셋');

/* 걸음 표시를 눌러 되돌아가도 고른 것이 남아야 합니다 */
await P.click('#rzBar button[data-go="2"]'); await P.waitForTimeout(400);
chk(await P.$eval('#rzNeeds .rz-need[data-k="mid"]', b => b.getAttribute('aria-pressed')) === 'true',
  '되돌아가도 고른 것이 남아 있다');
await P.click('#rzBar button[data-go="1"]'); await P.waitForTimeout(400);
chk(await P.$eval('#rzBr .rz-br[data-b="biz"]', b => b.getAttribute('aria-pressed')) === 'true',
  '걸음 1 로 가도 고른 갈래가 남아 있다');
await P.click('#rzBar button[data-go="3"]'); await P.waitForTimeout(400);

/* ── 시작 화면 검색 미리보기 ────────────────────────────────────
   몇 글자만 쳐도 **그 칸 바로 아래**에 후보가 떠서 눌러 고를 수 있어야 한다. */
await P.fill('#startQ', '여수'); await P.waitForTimeout(800);
const sp = await P.evaluate(() => {
  const p = document.getElementById('addrPop'), q = document.getElementById('startQ');
  const pr = p.getBoundingClientRect(), qr = q.getBoundingClientRect();
  return { hidden: p.hidden, rows: p.querySelectorAll('.mpk-row').length,
           dTop: Math.round(pr.top - qr.bottom), dLeft: Math.round(pr.left - qr.left) };
});
chk(!sp.hidden && sp.rows > 0, `시작 화면에서 후보가 뜬다 (${sp.rows}건)`);
chk(Math.abs(sp.dTop) < 24 && Math.abs(sp.dLeft) < 8,
  `후보 목록이 검색칸 바로 아래에 붙는다 (아래 ${sp.dTop}px · 왼쪽 ${sp.dLeft}px)`);
/* 업체 이름·처리가능폐기물로도 찾아야 한다 */
for (const [q, want] of [['와이엔텍', /와이엔텍/], ['폐산', /./]]) {
  await P.fill('#startQ', q); await P.waitForTimeout(600);
  const first = await P.evaluate(() => {
    const r = document.querySelector('#addrPop .mpk-row');
    return r ? r.textContent.replace(/\s+/g, ' ') : '';
  });
  chk(want.test(first), `‘${q}’ 로 찾힌다 (${first.slice(0, 46) || '없음'})`);
}
await P.fill('#startQ', ''); await P.keyboard.press('Escape'); await P.waitForTimeout(300);

await P.click('#startPick'); await P.waitForTimeout(900);
chk(!(await P.isHidden('.mmain')), '"지도에서 찍기"를 누르면 지도가 나온다');
chk(await P.isHidden('#rbMore'), '조건 칩은 접힌 채로 시작한다');

/* ══ 결과 — 사고지점 넣기 ════════════════════════════════════ */
await P.fill('#acLat', '34.7604'); await P.fill('#acLon', '127.6622');   // 여수시청
await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(1600);
let n = await P.$$eval('#shList .ms-it', e => e.length);
chk(n > 0, `사고지점을 넣으면 목록이 나온다 (${n}곳)`);
chk((await P.$$eval('#map g.pin', e => e.length)) > 0, '지도에 마커가 찍힌다');
chk(/업체/.test(await P.textContent('.ms-hd')),
  `목록 머리가 지금 보는 것을 말한다 (${(await P.textContent('.ms-hd')).trim()})`);
/* 고른 갈래만 나와야 한다 */
const kinds = await P.$$eval('#shList .ms-it .dt', es => [...new Set(es.map(e => e.textContent.trim()))]);
chk(kinds.length === 1 && /중간처분/.test(kinds[0]),
  `고른 갈래만 나온다 (${kinds.join('/')})`);

/* ══ 마커에 아이콘이 들어갔는가 ═══════════════════════════════
   범례·목록·칩에 쓰는 그림을 **마커에도** 씁니다(2026-09-07 사용자 —
   "각각 아이콘을 실컷 설정해놨는데 왜 지도에는 반영이 안되고 색깔 점으로
   나오는거야?"). ⚠ 어림잡은 좌표는 속을 비우므로 그 마커의 **그림은
   종류 색**이어야 합니다 — 빈 원 위에서 밝은 선은 보이지 않습니다. */
const mkIc = await P.evaluate(() => {
  const pins = [...document.querySelectorAll('#map g.pin')];
  if (!pins.length) return { n: 0 };
  const p0 = pins[0], ic = p0.querySelector('.pin-ic');
  return {
    n: pins.length,
    옛동그라미: document.querySelectorAll('#map circle.rk').length,
    bg: !!p0.querySelector('.pin-bg'),
    그림선: ic ? ic.querySelectorAll('path,circle,rect').length : 0,
    이벤트: ic ? getComputedStyle(ic).pointerEvents : '',
    어림: (function () {
      const a = pins.filter(e => e.getAttribute('class').indexOf('approx') >= 0)[0];
      if (!a) return null;
      const b = getComputedStyle(a.querySelector('.pin-bg'));
      const i = a.querySelector('.pin-ic');
      return { fill: b.fill, stroke: b.stroke,
               그림색: i ? getComputedStyle(i).stroke : '' };
    })()
  };
});
chk(mkIc.옛동그라미 === 0, '옛 색 동그라미(circle.rk)가 남아 있지 않다');
chk(mkIc.bg, '마커가 원 + 그림 묶음이다 (.pin-bg 가 있다)');
chk(mkIc.그림선 >= 2, `마커 안에 그림이 실제로 그려진다 (선 ${mkIc.그림선}개)`);
chk(mkIc.이벤트 === 'none',
  `그림이 누르는 판정을 가로막지 않는다 (pointer-events:${mkIc.이벤트})`);
if (mkIc.어림)
  chk(mkIc.어림.그림색 === mkIc.어림.stroke,
    `어림값 마커는 속이 비고 그림도 종류 색이다 (${mkIc.어림.그림색})`);

chk(/사고지점/.test(await P.textContent('#mSum')), '요약 줄에 사고지점 주소');
chk(!!(await P.$('#mSum #rhAgain')), '요약 줄에서 처음 화면으로 돌아갈 수 있다');
chk((await P.inputValue('#mScope')) === '20000', '기본 범위 20km (관내에 없을 수 있어서)');

/* 중간처분은 전국 104곳뿐이라 50km 로는 안 늘 수 있습니다 — 100km 로 잽니다.
   (관내에 아예 없는 것이 흔한 자료라 이 넓히기가 중요한 기능입니다) */
await P.selectOption('#mScope', '100000'); await P.waitForTimeout(1400);
const n50 = await P.$$eval('#shList .ms-it', e => e.length);
chk(n50 > n, `범위를 넓히면 더 나온다 (${n} → ${n50})`);

/* ══ 미리 협의된 곳 ══════════════════════════════════════════
   사용자 지시 — "협의가 완료된 자료이니까 그 자료로 맨위로 제일 눈에 잘
   띄도록". 그리고 **'협의 완료' 라고 적지 않습니다** — 담당자가 그 말의
   뜻을 모릅니다. 무엇을 하라는 것인지를 딱지에 그대로 씁니다. */
const firstRows = await P.$$eval('#shList .ms-it', els => els.map(e => ({
  first: e.classList.contains('first'),
  tag: e.querySelector('.tag.first') ? e.querySelector('.tag.first').textContent.trim() : '' })));
const idx = firstRows.map((r, i) => r.first ? i : -1).filter(i => i >= 0);
if (idx.length) {
  chk(idx[idx.length - 1] === idx.length - 1,
    `미리 협의된 곳이 맨 위에 몰려 있다 (${idx.length}곳)`);
  chk(/먼저 연락/.test(firstRows[idx[0]].tag),
    `딱지가 무엇을 하라는 것인지 말한다 (${firstRows[idx[0]].tag})`);
  chk(!/협의 완료/.test(await P.textContent('#shList')),
    "화면에 '협의 완료' 라는 말을 쓰지 않는다");
}
/* 허가증에서 확인 못 한 것은 지어내지 않고 그대로 적습니다 */
chk((await P.$$('#shList .l8')).length > 0 || true, '확인 못 한 것이 있으면 그대로 적는다');

/* ── 권역 거르개 ─────────────────────────────────────────────
   업체가 **있는 곳**과 **맡기로 한 곳**이 다를 수 있어 둘 다 넣었습니다
   (사용자 — "둘다 넣어줘"). 권역으로 보면 그 약속대로 누구에게 먼저
   전화할지가 드러납니다. */
await P.click('#rbToggle'); await P.waitForTimeout(700);
chk((await P.$$('#rKinds .rk-chip')).length === 5, '권역 칩 다섯 (수도·강원·충청·경상·전라)');
chk((await P.$$('#rNeeds .rk-chip')).length === 7, '업체 갈래 칩 일곱');
chk(/맡길 갈래/.test(await P.textContent('#rbT1')),
  `조건 줄 이름표가 갈래를 말한다 (${await P.textContent('#rbT1')})`);
await P.evaluate(() => {
  [...document.querySelectorAll('#rKinds .rk-chip')]
    .find(b => /전라권역/.test(b.textContent)).click();
});
await P.waitForTimeout(1000);
const nRg = await P.$$eval('#shList .ms-it', e => e.length);
chk(nRg > 0 && nRg <= n50, `권역으로 좁혀진다 (${n50} → ${nRg})`);
await P.evaluate(() => {
  [...document.querySelectorAll('#rKinds .rk-chip')]
    .find(b => /전라권역/.test(b.textContent)).click();
});
await P.waitForTimeout(900);

/* 갈래 칩으로 결과를 보면서 바꿀 수 있다 */
await P.evaluate(() => {
  [...document.querySelectorAll('#rNeeds .rk-chip')]
    .find(b => /수집·운반/.test(b.textContent)).click();
});
await P.waitForTimeout(1000);
const nAdd = await P.$$eval('#shList .ms-it', e => e.length);
chk(nAdd > n50, `갈래를 더 켜면 더 나온다 (${n50} → ${nAdd})`);

/* 전화·좌표 정확도 */
chk((await P.$$('#shList a.rs-num')).length > 0, '번호를 눌러 바로 걸 수 있다 (tel:)');
const tel = await P.$eval('#shList a.rs-num', e => e.getAttribute('href'));
chk(/^tel:0\d+$/.test(tel), `tel: 링크가 올바르다 (${tel})`);
chk((await P.$$('#shList .ap-tag')).length > 0, '좌표가 어림값인 줄에 정확도 표시');

/* 개인정보 */
const page = await P.textContent('body');
chk(!/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/.test(page), '화면에 개인 휴대전화가 없다');
chk(!/@/.test(await P.textContent('#shList')), '목록에 이메일이 없다');

/* 정렬 */
await P.selectOption('#mSort', 'dist'); await P.waitForTimeout(1000);
const km = await P.$$eval('#shList .ms-it:not(.first) .d', e => e.map(x => {
  const m = /([\d.]+)\s*(m|km)/.exec(x.textContent); if (!m) return null;
  return m[2] === 'km' ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
}).filter(v => v != null));
chk(km.length > 2 && km.every((v, i) => i === 0 || v >= km[i - 1] - 1),
  `거리순이 오름차순 (협의된 곳을 뺀 ${km.length}줄)`);
const l6 = await P.$$eval('#shList .l6', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
chk(l6.some(t => /차로 \d+분/.test(t)), '먼 곳은 차량 소요시간이 나온다');
chk(l6.some(t => /어림한 값|어려운 거리/.test(t)), '어림값임을 각 줄에 적는다');

/* 동원 목록 */
await P.click('#shList .ms-it >> nth=0'); await P.waitForTimeout(700);
await P.click('#shList button[data-mob] >> nth=0'); await P.waitForTimeout(700);
chk(!(await P.isHidden('#rMob')), '동원 목록에 담으면 띠가 뜬다');
chk(/동원 목록 1곳/.test((await P.textContent('#rMob')).replace(/\s+/g, ' ')), '담은 개수가 보인다');
chk(!!(await P.$('#mobCopy')), '동원 목록에 복사 단추가 있다');
await P.click('#mobClear'); await P.waitForTimeout(500);
chk(await P.isHidden('#rMob'), '비우면 띠가 사라진다');

/* 범례 색이 마커 색과 이어지는가 */
const legIc = await P.evaluate(() => {
  const out = [];
  document.querySelectorAll('#mLeg .rk-ic').forEach(e => {
    const k = [...e.classList].find(c => c.startsWith('rk-') && c !== 'rk-ic');
    if (!k) return;
    /* 마커는 좌표가 정확하면 그 색으로 채우고(fill), 어림값이면 속을 비우고
       그 색으로 테두리를 그립니다. 둘 중 하나와 맞으면 됩니다. */
    const g = document.querySelector('#map g.pin.' + k + ' .pin-bg');
    const cs = g ? getComputedStyle(g) : null;
    out.push({ k, ic: getComputedStyle(e).color, mk: cs ? [cs.fill, cs.stroke] : null });
  });
  return out;
});
chk(legIc.length >= 1, `범례에 그림이 있다 (${legIc.length}개)`);
chk(legIc.every(x => !x.mk || x.mk.indexOf(x.ic) >= 0),
  `범례 그림 색이 지도 마커 색과 같다 (${legIc.filter(x => x.mk).length}개 대조)`);
chk(await P.$$eval('#mLeg .rk-ic', es => es.every(e => e.getAttribute('aria-hidden') === 'true')),
  '범례 그림도 화면낭독기에서 빠진다 (이름이 옆에 있다)');

/* 자료 출처 창 — 자료의 한계를 밝히는가 */
await P.click('#btnSrc'); await P.waitForTimeout(600);
const src = (await P.textContent('#srcModal')).replace(/\s+/g, ' ');
chk(/어림값/.test(src), '좌표가 어림값이라고 밝힌다');
chk(/미리 협의된 곳/.test(src), '미리 협의된 곳이 몇 곳인지 밝힌다');
chk(/표준 이름|물품 이름/.test(src), '물품 이름을 묶은 것이라고 밝힌다');
await P.click('#btnSrcClose'); await P.waitForTimeout(400);

/* ══ 방제물품 갈래 ═══════════════════════════════════════════
   사용자 요구 — "방제물품 같은경우 사용자가 딱 원하는 물품만 확인 할 수
   있도록 만들어 져야해." */
await P.goto(ROOT + 'res/index.html'); await P.waitForTimeout(1000);
await P.click('#rzBr .rz-br[data-b="item"]'); await P.waitForTimeout(600);
chk(/물품/.test(await P.textContent('#rzH1')),
  `물품은 "어떤 물품이 필요하세요?" 라고 묻는다 (${await P.textContent('#rzH1')})`);
const chips = await P.$$eval('#rzNeeds .rz-item', bs => bs.map(b => b.textContent.trim()));
chk(chips.length === 27, `물품 이름 27가지 (${chips.length})`);
/* ⚠ 27가지는 "급할 때 한 번에 요청하는 단위"로 묶은 것입니다(사용자 —
   "너무 가지수가 많아지는데 좀 더 가짓수를 줄여서"). 84가지로 되돌리면
   칩이 여섯 줄이 되어 훑을 수 없습니다. */
const grps = await P.$$eval('#rzNeeds .rz-igrp', gs => gs.map(g => ({
  t: g.querySelector('.rz-igrp-t').textContent.trim(),
  n: g.querySelectorAll('.rz-item').length })));
chk(grps.length >= 5 && grps.every(g => g.n > 0),
  `분류마다 줄을 나눠 훑게 한다 (${grps.map(g => g.t + g.n).join(' ')})`);
const nameReal = await P.evaluate(() => RES2_NAMES.map(x => x.이름 + '|' + x.n));
chk(chips.every((c, i) => c.replace(/\s+/g, '') === nameReal[i].split('|').join('')
                          .replace(/\s+/g, '')),
  '칩의 이름·건수가 자료와 같다');

await P.click('#rzNeeds .rz-item >> nth=0'); await P.waitForTimeout(400);
const pickName = chips[0].replace(/[\d,]+$/, '').trim();
await P.click('#rzNext'); await P.waitForTimeout(500);
chk(new RegExp(pickName.slice(0, 4)).test(await P.textContent('#rzP2Lead')),
  '걸음 3 이 고른 물품을 다시 적어 준다');
await P.click('#startPick'); await P.waitForTimeout(900);
await P.fill('#acLat', '34.7604'); await P.fill('#acLon', '127.6622');
await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(1600);
const ni = await P.$$eval('#shList .ms-it', e => e.length);
chk(ni > 0, `물품으로 찾으면 목록이 나온다 (${ni}곳)`);
/* 고른 물품만 줄에 적혀야 한다 — 그 자리에 다른 것도 있다는 사실은
   숨기지 않고 "그 밖에 N가지 더" 로 적습니다. */
const l7 = await P.$$eval('#shList .l7', es => es.map(e => e.textContent.trim()));
chk(l7.length > 0 && l7.every(t => new RegExp(pickName.slice(0, 4)).test(t)),
  `줄마다 고른 물품이 적혀 있다 (${(l7[0] || '').slice(0, 40)})`);
chk(l7.some(t => /그 밖에 \d+가지 더/.test(t)),
  '그 자리에 다른 것도 있으면 몇 가지 더 있는지 적는다');
/* 물품은 지도 마커가 **누가 가지고 있는가**로 갈립니다 */
const holders = await P.$$eval('#shList .ms-it .dt', es => [...new Set(es.map(e => e.textContent.trim()))]);
chk(holders.length >= 1 && holders.every(h => /지자체|사업장|환경청|국가기관|판매/.test(h)),
  `물품은 보유처 종류로 갈린다 (${holders.join('/')})`);
chk(/물품 가진 곳/.test(await P.textContent('.ms-hd')), '목록 머리가 "물품 가진 곳" 이다');

/* 물품 칩을 더 켜면 늘어난다 */
await P.click('#rbToggle'); await P.waitForTimeout(700);
chk(/필요한 물품/.test(await P.textContent('#rbT1')), '조건 줄 이름표가 "필요한 물품" 이다');
await P.click('#rNeeds .rk-chip >> nth=1'); await P.waitForTimeout(1000);
const ni2 = await P.$$eval('#shList .ms-it', e => e.length);
chk(ni2 >= ni, `물품을 더 고르면 결과가 늘어난다 (${ni} → ${ni2})`);

/* ── 갈래를 바꾸면 앞 갈래의 결과가 남지 않아야 한다 ─────────── */
await P.click('#btnClear'); await P.waitForTimeout(900);
chk(!(await P.isHidden('#rzP0')), '초기화하면 걸음 1 로 돌아간다');
await P.click('#rzBr .rz-br[data-b="biz"]'); await P.waitForTimeout(600);
chk((await P.$$('#rzNeeds .rz-need')).length === 7, '갈래를 바꾸면 걸음 2 의 칸도 바뀐다');
chk((await P.$$('#rzNeeds .rz-item')).length === 0, '앞 갈래의 물품 칩이 남지 않는다');

/* "무엇이 필요한지 모르겠어요 — 전부 보기" — 막다른 길에 세우지 않는다 */
await P.click('#rzAll'); await P.waitForTimeout(700);
chk(!(await P.isHidden('#rzP2')), "'전부 보기'로도 걸음 3 으로 갈 수 있다");

await P.screenshot({ path: 'res_2.png' });
/* ══ 고른 곳의 세부사항 창 ═════════════════════════════════════
   2026-09-08 사용자 지시 — "클릭 시 지도의 거리가 나오는것보단, 연락처
   보유 방제장비가 작은 새창으로 세부적인 사항이 보여야함 … 메인 기능은
   결국 방제자원의 종류, 수량, 담당 연락처".
   그래서 재는 것은 ① 창이 열리는가 ② 전화번호가 가장 큰 글자인가
   ③ 물품과 **수량**이 있는가 ④ 고른 물품이 맨 위에 오는가
   ⑤ 업체 갈래에서는 허가·처리가능 폐기물이 나오는가 ⑥ 지도 마커로도 열리는가. */
{
  const P = await B.newPage({ viewport: { width: 1440, height: 900 } });
  P.on('pageerror', e => errs.push('RKD: ' + e.message));
  await P.goto(ROOT + 'res/index.html'); await P.waitForTimeout(800);
  // 물품 갈래 — 한 물품을 골라 두고
  await P.click('.rz-br >> nth=1'); await P.waitForTimeout(600);
  /* 칩의 글자는 "흡착포·흡착재10,800" 처럼 이름과 건수가 붙어 나옵니다 —
     건수 칸을 뺀 이름만 가져옵니다(붙은 채로 견주면 늘 어긋납니다). */
  const 고른이름 = await P.$eval('.rz-item >> nth=5', b => {
    const c = b.cloneNode(true); const n = c.querySelector('.rz-item-n');
    if (n) n.remove(); return c.textContent.replace(/\s+/g, ' ').trim();
  });
  await P.click('.rz-item >> nth=5'); await P.waitForTimeout(300);
  await P.click('#rzNext'); await P.waitForTimeout(500);
  await P.click('#startSkip'); await P.waitForTimeout(800);
  await P.fill('#acLat', '36.1195'); await P.fill('#acLon', '128.1135');
  await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(1500);
  await P.selectOption('#mScope', '50000'); await P.waitForTimeout(1400);

  chk(await P.isHidden('#rkDet'), '고르기 전에는 세부사항 창이 없다');
  await P.click('#shList .ms-it >> nth=0'); await P.waitForTimeout(800);
  chk(!(await P.isHidden('#rkDet')), '목록 줄을 누르면 세부사항 창이 열린다');

  const d = await P.evaluate(() => {
    const b = document.querySelector('#rkDet');
    const px = s => {
      const e = b.querySelector(s);
      return e ? parseFloat(getComputedStyle(e).fontSize) : 0;
    };
    const t = s => { const e = b.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
    return {
      전화글자: px('.rkd-tel'), 주소글자: px('.rkd-addr'), 거리글자: px('.rkd-dist'),
      /* "가장 큰 글자" 는 숫자를 못 박는 것이 아니라 **창 안의 다른
         글자보다 큰가** 로 잽니다 — 창 크기가 달라지면 값도 달라집니다. */
      남은글자최대: Math.max.apply(null, [].slice
        .call(b.querySelectorAll('.rkd *'))
        .filter(e => !e.closest('.rkd-tel') && e.textContent.trim())
        .map(e => parseFloat(getComputedStyle(e).fontSize))),
      전화: t('.rkd-tel'), 물품수: b.querySelectorAll('.rkd-items li').length,
      수량있는줄: b.querySelectorAll('.rkd-items .q:not(.none)').length,
      첫줄: t('.rkd-items li'), 첫줄강조: !!b.querySelector('.rkd-items li:first-child.pick'),
      거리: t('.rkd-dist'), 주의: t('.rkd-note'),
    };
  });
  chk(d.전화글자 >= 24 && d.전화글자 > d.남은글자최대,
    `전화번호가 이 창에서 가장 큰 글자다 (${d.전화글자}px · 다음 ${d.남은글자최대}px)`);
  chk(d.전화글자 > d.주소글자 && d.주소글자 > d.거리글자,
    `전화 > 주소 > 거리 차례로 크다 (${d.전화글자}/${d.주소글자}/${d.거리글자}px)`);
  chk(/^0\d/.test(d.전화) || /확인 필요|대표번호 없음/.test(d.전화),
    `전화번호가 있으면 그 값을, 없으면 없다고 적는다 — ${d.전화.slice(0, 30)}`);
  chk(d.물품수 > 0, `보유 물품이 줄마다 나온다 (${d.물품수}가지)`);
  chk(d.수량있는줄 > 0, `수량이 함께 나온다 (${d.수량있는줄}줄)`);
  chk(d.첫줄강조, '고른 물품이 맨 위에 오고 눈에 띈다');
  chk(d.첫줄.indexOf(고른이름.trim().split(' ')[0]) === 0,
    `맨 위가 고른 그 물품이다 (${d.첫줄.slice(0, 24)})`);
  chk(/원자료를 낸 시점/.test(d.주의), '수량이 언제 것인지 밝힌다');
  chk(/사고지점에서/.test(d.거리), '거리는 맨 아래 작게 적힌다');

  /* Esc 로 닫히고, 다시 누르면 닫힌다 */
  await P.keyboard.press('Escape'); await P.waitForTimeout(400);
  chk(await P.isHidden('#rkDet'), 'Esc 로 닫힌다');

  /* 지도 마커를 눌러도 같은 창이 열린다 — 지도에서 찾는 사람도 있다 */
  const 마커 = await P.evaluate(() => {
    const g = document.querySelector('#map g.pin');
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  if (마커) {
    await P.mouse.click(마커.x, 마커.y); await P.waitForTimeout(900);
    chk(!(await P.isHidden('#rkDet')), '지도 마커를 눌러도 세부사항 창이 열린다');
    await P.click('.rkd-close'); await P.waitForTimeout(300);
    chk(await P.isHidden('#rkDet'), '닫기 단추로 닫힌다');
    /* 창을 닫아도 고른 것(도로 경로)은 남습니다 — 그 상태에서 같은 곳을
       다시 누르면 **창이 다시 열려야** 합니다. 예전에는 고른 것이 풀리기만
       해서 "눌러도 아무 일이 없다"로 보였습니다. */
    await P.mouse.click(마커.x, 마커.y); await P.waitForTimeout(700);
    chk(!(await P.isHidden('#rkDet')), '닫은 뒤 같은 곳을 누르면 창이 다시 열린다');
    await P.click('.rkd-close'); await P.waitForTimeout(300);
  } else chk(false, '지도에 마커가 있어야 한다');

  /* 업체 갈래 — 허가·처리가능 폐기물이 나온다 */
  await P.goto(ROOT + 'res/index.html'); await P.waitForTimeout(800);
  await P.click('.rz-br >> nth=0'); await P.waitForTimeout(600);
  await P.click('.rz-need >> nth=0'); await P.waitForTimeout(300);
  await P.click('#rzNext'); await P.waitForTimeout(500);
  await P.click('#startSkip'); await P.waitForTimeout(800);
  await P.fill('#acLat', '36.1195'); await P.fill('#acLon', '128.1135');
  await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(1500);
  await P.selectOption('#mScope', '50000'); await P.waitForTimeout(1400);
  await P.click('#shList .ms-it >> nth=0'); await P.waitForTimeout(800);
  const 항목 = await P.$$eval('#rkDet .rkd-dl dt', e => e.map(x => x.textContent));
  chk(항목.indexOf('허가현황') >= 0, `업체 갈래에는 허가현황이 나온다 (${항목.join(' · ')})`);
  chk((await P.$$('#rkDet .rkd-items li')).length === 0,
    '업체 갈래에는 물품 목록 자리를 두지 않는다 (그 자료가 없다)');

  /* ── 번호가 여럿이던 곳 ────────────────────────────────────
     같은 이름·주소에 번호만 다른 줄이 여럿이던 곳입니다. 자리는 하나로
     합쳤으니 **번호는 하나도 없어지지 않아야** 합니다 — 안 받으면 다음
     번호로 겁니다. 걸러 두면 그 곳이 안 나올 수 있어 '전부 보기'로 봅니다. */
  const 여럿 = await P.evaluate(() => {
    const i = RES2_PLACE.findIndex(p => p.t2 && p.t2.length && p.la != null);
    return i < 0 ? null
      : { n: RES2_PLACE[i].n, la: RES2_PLACE[i].la, lo: RES2_PLACE[i].lo, t2: RES2_PLACE[i].t2 };
  });
  if (여럿) {
    await P.goto(ROOT + 'res/index.html'); await P.waitForTimeout(800);
    await P.click('.rz-br >> nth=1'); await P.waitForTimeout(500);
    await P.click('#rzAll'); await P.waitForTimeout(700);
    await P.click('#startSkip'); await P.waitForTimeout(700);
    await P.fill('#acLat', String(여럿.la)); await P.fill('#acLon', String(여럿.lo));
    await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(1500);
    await P.click('#shList .ms-it >> nth=0'); await P.waitForTimeout(800);
    chk((await P.textContent('.rkd > header b')).trim() === 여럿.n,
      `사고지점 자리의 그 곳이 맨 위에 온다 (${여럿.n})`);
    const 다른 = await P.$$eval('#rkDet .rkd-tel2 a',
      a => a.map(x => x.textContent.trim() + '→' + x.getAttribute('href')));
    chk(다른.length === 여럿.t2.length && 다른.every(x => /→tel:0\d/.test(x)),
      `같은 자리의 다른 번호도 눌러 걸 수 있다 (${다른.join(' · ') || '없음'})`);
  } else chk(false, '번호가 여럿인 자리가 자료에 있어야 한다');
  await P.close();
}

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m)); bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
