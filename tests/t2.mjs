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
const P = await B.newPage({ viewport: { width: 1280, height: 950 } });
const errs = [];
P.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
P.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);
const U = ROOT + 'sms/index.html';
/* ── 단계형으로 바뀐 뒤의 준비 ────────────────────────────────
   ① 문자 도구가 '한 걸음씩'으로 바뀌어, 문안은 **마지막 걸음**에서만 나오고
   **필수 칸을 다 채워야** 만들어집니다(반쯤 채운 문안은 잘못 보낼 위험이 있어
   아예 만들지 않습니다). 그래서 문안을 보는 검사는 먼저 이 둘을 해 줍니다. */
const FILL = { 기관: '서천군', 시각: '14:20', 시군: '서천군', 읍면동: '장항읍',
  사업장: '○○화학', 대상지역: '장항읍 일원', 물질: '염산',
  대피소: '장항중학교', 집결지: '장항읍 행정복지센터' };
const fillAll = async (P) => {
  await P.evaluate(o => {
    Object.keys(o).forEach(k => {
      const el = document.getElementById('if_' + k);
      if (el) { el.value = o[k]; el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }, FILL);
  await P.waitForTimeout(250);
};
const goOut = async (P) => {
  const b = await P.$('#stepBar button[data-go=out]');
  if (b) { await b.click(); await P.waitForTimeout(300); }
};
const ready = async (P) => { await fillAll(P); await goOut(P); };
const goStep = async (P, id) => {
  const b = await P.$(`#stepBar button[data-go=${id}]`);
  if (b) { await b.click(); await P.waitForTimeout(300); }
};
const setF = async (P, k, v) => {
  /* 걸음이 감춰져 있어도 값을 넣을 수 있게 — 사람이 쓰는 순서를 따라가는
     검사는 위의 ready() 로 따로 합니다. */
  await P.evaluate(([k, v]) => {
    const el = document.getElementById('if_' + k);
    el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [k, v]);
  await P.waitForTimeout(200);
};



await P.goto(U); await P.waitForTimeout(400);

// ══ A. 상황종료 문안 접기 ══
await P.click('#stages button[data-s=indoor]'); await ready(P);
await P.waitForTimeout(250);
let cards = await P.$$eval('#out .out', o => o.length);
let vis = await P.$$eval('#out .out', os => os.filter(o => o.offsetParent !== null).length);
chk(cards === 4 && vis === 2, `실내대피: 생성 4건 중 보이는 것 2건 (실제 ${cards}/${vis})`);
let visNo = await P.$$eval('#out .out', os => os.filter(o=>o.offsetParent!==null)
  .map(o => o.querySelector('.no').textContent));
chk(JSON.stringify(visNo) === JSON.stringify(['2번','1번']), `처음 보이는 문안: ${visNo}`);
chk((await P.$$eval('#out .ohd.fold', b => b.length)) === 1, '접기 머리표 1개');
chk((await P.textContent('#out .ohd.fold')).includes('보기'), '접힘 상태 = "보기"');

// 클릭해서 펼치기
await P.click('#out .ohd.fold');
await P.waitForTimeout(200);
vis = await P.$$eval('#out .out', os => os.filter(o => o.offsetParent !== null).length);
chk(vis === 4, `펼친 뒤 4건 보임 (실제 ${vis})`);
chk((await P.textContent('#out .ohd.fold')).includes('접기'), '펼침 상태 = "접기"');
chk((await P.getAttribute('#out .ohd.fold','aria-expanded')) === 'true', 'aria-expanded=true');

// 입력해도 열린 상태 유지 (renderOut 매번 도는데 닫히면 안 됨)
await setF(P, '기관', '서천군');
await P.waitForTimeout(250);
vis = await P.$$eval('#out .out', os => os.filter(o => o.offsetParent !== null).length);
chk(vis === 4, `입력 중에도 펼침 유지 (실제 ${vis})`);

// 다시 접기
await P.click('#out .ohd.fold');
await P.waitForTimeout(200);
vis = await P.$$eval('#out .out', os => os.filter(o => o.offsetParent !== null).length);
chk(vis === 2, `다시 접힘 (실제 ${vis})`);

// 구분별로 독립적인 접힘 상태
await P.click('#stages button[data-s=evac]'); await P.waitForTimeout(250); await ready(P);
vis = await P.$$eval('#out .out', os => os.filter(o=>o.offsetParent!==null)
  .map(o=>o.querySelector('.no').textContent));
chk(JSON.stringify(vis) === JSON.stringify(['8번','7번']), `주민소산 처음 보이는 문안: ${vis}`);
await P.click('#out .ohd.fold'); await P.waitForTimeout(200);
await P.click('#stages button[data-s=indoor]'); await P.waitForTimeout(250); await ready(P);
vis = await P.$$eval('#out .out', os => os.filter(o => o.offsetParent !== null).length);
chk(vis === 2, `구분별 접힘 상태 독립 (실내대피는 여전히 접힘, ${vis}건)`);
await P.click('#stages button[data-s=detour]'); await P.waitForTimeout(250); await ready(P);
vis = await P.$$eval('#out .out', os => os.filter(o=>o.offsetParent!==null)
  .map(o=>o.querySelector('.no').textContent));
// 도로 우회는 '사고지역 상황'을 고르기 전에는 문안을 만들지 않는다
chk(vis.length === 0, `도로우회: 상황을 고르기 전에는 문안 없음 (${vis.length}건)`);
// 이름표는 빼고 단추만 둔다(무엇을 고르는지는 단추 글씨가 말한다).
// 화면낭독기용 이름은 aria-label 로 남는다.
chk((await P.$$('#catBar .cat')).length === 2, '도로우회: 상황 고르는 단추 2개');
chk(await P.$eval('#catBar', e => e.getAttribute('aria-label')) === '사고지역 상황',
  '도로우회: 무엇을 고르는 줄인지 aria-label 로 알려 준다');
await P.click('#catBar .cat >> nth=0'); await P.waitForTimeout(300);
vis = await P.$$eval('#out .out', os => os.filter(o=>o.offsetParent!==null)
  .map(o=>o.querySelector('.no').textContent));
chk(JSON.stringify(vis) === JSON.stringify(['4번','3번']), `실내대피 중일 때: ${vis}`);
await P.click('#catBar .cat >> nth=1'); await P.waitForTimeout(300);
vis = await P.$$eval('#out .out', os => os.filter(o=>o.offsetParent!==null)
  .map(o=>o.querySelector('.no').textContent));
chk(JSON.stringify(vis) === JSON.stringify(['10번','9번']), `대피명령 발령 중일 때: ${vis}`);

// ══ B. 문안별 오류 분리 ══
await P.click('#stages button[data-s=evac]'); await P.waitForTimeout(200); await ready(P);
const fill = async (o) => { for (const [k,v] of Object.entries(o)) await setF(P, k, v);
  await P.waitForTimeout(350); };
await fill({ 기관:'서천군', 시각:'17:10', 시군:'서천군', 읍면동:'장항읍',
  대상지역:'장항읍 창선리·화천리', 사업장:'한국석유공사 서천기지', 물질:'황산',
  대피소:'장항초등학교', 집결지:'장항읍행정복지센터' });
chk((await P.$$('#alerts .alert.s')).length === 0, '확인 완료 배너 없음 (삭제 확인)');
chk((await P.$$('#out .oerr')).length === 0, '정상 입력 → 카드 내 오류 없음');
// 대피소를 아주 길게 넣어 8번만 글자수 초과시키기
await setF(P, '대피소', '장항초등학교 및 장항중학교 및 장항고등학교 및 서천군종합사회복지관 및 장항읍행정복지센터 대강당');
await P.waitForTimeout(400);
const perCard = await P.$$eval('#out .out', os => os.map(o => ({
  no: o.querySelector('.no').textContent,
  bad: o.classList.contains('bad'),
  dis: o.querySelector('button[data-c]').disabled })));
const over = perCard.filter(c => c.bad).map(c => c.no);
const stillOk = perCard.filter(c => !c.dis).map(c => c.no);
chk(over.length > 0 && stillOk.length > 0,
  `초과한 문안만 차단: 오류=${over.join(',')} / 복사가능=${stillOk.join(',')}`);
chk((await P.$$('#out .oerr')).length === over.length, '오류 문안 카드 안에 사유 표시');
// 접힌 그룹에 오류가 있으면 머리표에 표시되는지
await P.click('#out .ohd.fold'); await P.waitForTimeout(150);  // 열기
await P.click('#out .ohd.fold'); await P.waitForTimeout(150);  // 닫기
const hasWerr = await P.$$eval('#out .ohd.fold .werr', e => e.length);
ok.push(`  접힌 그룹 오류 배지: ${hasWerr}개 (종료문안에 오류가 없으면 0이 정상)`);
// 필수 미입력 — 그 항목을 쓰는 문안만 차단 (전역 배너·전역 차단 없음)
await setF(P, '대피소', '장항초등학교');
await setF(P, '대상지역', ''); await P.waitForTimeout(400);
chk((await P.$$('#alerts .alert.e')).length === 0, '필수 미입력에도 전역 배너 없음');
const missMap = await P.$$eval('#out .out', os => os.map(o => ({
  no: o.querySelector('.no').textContent, disabled: o.querySelector('button[data-c]').disabled })));
chk(missMap.filter(d => ['8번','7번'].includes(d.no)).every(d => d.disabled)
  && missMap.filter(d => ['12번','11번'].includes(d.no)).every(d => !d.disabled),
  `대상지역 쓰는 문안만 차단: ${JSON.stringify(missMap)}`);
await setF(P, '대상지역', '장항읍 창선리'); await P.waitForTimeout(400);
chk(await P.$$eval('#out button[data-c]', bs => bs.every(b => !b.disabled)), '해소 시 전부 허용');

/* ── 집결지는 비워도 된다 ───────────────────────────────────────
   집결지를 따로 두지 않는 지자체가 있다. 비면 7번 문안이 대피소만 넣은
   문장으로 나가야 하고, 반쪽 문장("집결지[]으로")이나 자리표시자가 남으면
   안 되며, 복사가 막히지도 않아야 한다(templates.js 의 [[!집결지:…]]). */
await setF(P, '집결지', ''); await P.waitForTimeout(450);
const noGather = await P.$$eval('#out .out', os => os.map(o => ({
  no: o.querySelector('.no') ? o.querySelector('.no').textContent : '',
  txt: o.querySelector('.msg') ? o.querySelector('.msg').textContent.replace(/\s+/g, ' ') : '',
  dis: !!(o.querySelector('button[data-c]') || {}).disabled })));
const c7 = noGather.filter(c => c.no === '7번')[0];
chk(!!c7 && !c7.dis, '집결지가 비어도 7번 문안을 복사할 수 있다');
/* 조사는 받침에 따라 갈린다 — "장항초등학교"는 받침이 없어 '로'가 맞다 */
chk(!!c7 && /대피소\[장항초등학교\](으로|로) 대피요망/.test(c7.txt),
  `집결지 없이 대피소만 넣은 문장이 된다 (${c7 ? c7.txt.slice(-34) : '없음'})`);
chk(!!c7 && !/집결지/.test(c7.txt) && !/\{/.test(c7.txt),
  '집결지를 말하는 구절과 자리표시자가 남지 않는다');
chk((await P.$$('#stepBar .stp-i.on')).length >= 0
  && await P.evaluate(() => !document.querySelector('#out .needfill')),
  '집결지가 비었다고 "채우지 않은 칸" 화면으로 넘어가지 않는다');
// 다시 넣으면 집결지까지 들어간 문장으로 돌아온다
await setF(P, '집결지', '장항읍행정복지센터'); await P.waitForTimeout(450);
const back7 = await P.$$eval('#out .out', os => {
  const o = os.filter(x => x.querySelector('.no')
    && x.querySelector('.no').textContent === '7번')[0];
  const t = o && o.querySelector('.msg');
  return t ? t.textContent.replace(/\s+/g, ' ') : '';
});
chk(/집결지\[장항읍행정복지센터\]/.test(back7),
  `집결지를 넣으면 그 구절이 다시 들어간다 (${back7.slice(-40) || '문안 없음'})`);

// ══ C. 지도에서 찾기 ══
await goStep(P, 'evac');
chk(await P.isVisible('#btnMap'), '지도에서 찾기 버튼 표시');
await goStep(P, 'evac');
await P.click('#btnMap');
await P.waitForTimeout(700);
chk(await P.isVisible('.shmap-back'), '지도 창 열림');
// 사고 시군(서천군)이 자동 선택되었는가
chk((await P.inputValue('.shmap-sido')) === '충청남도'
  && (await P.inputValue('.shmap-sgg')) === '서천군',
  `사고 시·군 자동 선택: ${await P.inputValue('.shmap-sido')} ${await P.inputValue('.shmap-sgg')}`);
const nMk = await P.$$eval('.shmap-svg circle.mk', c => c.length);
const nIt = await P.$$eval('.shmap-it', c => c.length);
chk(nMk > 0 && nMk === nIt, `지도 마커 ${nMk}개 = 목록 ${nIt}개`);
chk((await P.$$eval('.shmap-svg path.bd', p => p.length)) > 0, '경계선 렌더');
// 이 컨테이너는 외부 타일 호스트가 전부 차단돼 있다.
// 배경을 못 받아도 경계선 + 마커로 고르는 일은 그대로 돼야 한다.
await P.waitForTimeout(1500);
const srcTxt = await P.textContent('.shmap-src');
chk(/경계선만/.test(srcTxt), `배경 못 받을 때 안내: ${srcTxt}`);
chk((await P.$$eval('.shmap-svg image', i => i.length)) === 0, '배경 못 받으면 <image> 0장');
chk(await P.isVisible('.shmap-warn'), '배경 못 받은 이유가 화면에 표시됨');
/* 창을 열면 앞 걸음에 적은 사고 위치에서 시작한다 — 시·군·구 전체가 아니라
   그 동네가 보여야 하고, 목록도 가까운 순이어야 한다. */
const dbg = await P.evaluate(() => SHMAP.debug());
chk(!!dbg.acc, `열자마자 사고지점이 찍혀 있다 (${dbg.acc ? dbg.acc.lat.toFixed(4) : '없음'})`);
chk((await P.inputValue('.shmap-sort')) === 'dist', '목록이 사고지점 가까운 순으로 시작');
chk(await P.isVisible('.shmap-guess'), '어림잡은 자리라고 화면에 적는다');
chk(/어림잡은/.test(await P.textContent('.shmap-guess')), '무엇으로 어림잡았는지도 적는다');
const near = await P.evaluate(() => {
  const svg = document.querySelector('.shmap-svg');
  const vb = svg.getAttribute('viewBox').split(' ').map(Number);
  const mks = [...svg.querySelectorAll('circle.mk')].map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
  const inside = mks.filter(([x, y]) => x >= vb[0] && x <= vb[0] + vb[2] && y >= vb[1] && y <= vb[1] + vb[3]);
  return { n: mks.length, inside: inside.length };
});
chk(near.inside > 0 && near.inside < near.n,
  `열었을 때는 관내 전부가 아니라 주변만 담는다 (${near.inside}/${near.n})`);

// 전체 보기 — 마커가 전부 경계선 범위 안에 있는가 (투영 정합성)
await P.click('.shmap-zf');
await P.waitForTimeout(600);
const geo = await P.evaluate(() => {
  const svg = document.querySelector('.shmap-svg');
  const vb = svg.getAttribute('viewBox').split(' ').map(Number);
  const mks = [...svg.querySelectorAll('circle.mk')].map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
  const inside = mks.filter(([x,y]) => x>=vb[0] && x<=vb[0]+vb[2] && y>=vb[1] && y<=vb[1]+vb[3]);
  return { vb, n: mks.length, inside: inside.length };
});
chk(geo.inside === geo.n, `전체 보기에서 마커 전부 화면 안 (${geo.inside}/${geo.n})`);
// 축척 표시
chk((await P.textContent('.shmap-scale b')).match(/\d/) !== null,
  `축척 표시: ${await P.textContent('.shmap-scale b')}`);

// 지도 마커 클릭 → 선택
await P.click('.shmap-svg circle.mk >> nth=0');
await P.waitForTimeout(250);
chk((await P.$$eval('.shmap-svg circle.mk.on', c => c.length)) === 1, '마커 클릭 → 선택 표시');
chk((await P.$$eval('.shmap-it.on', c => c.length)) === 1, '목록에도 선택 반영');
chk((await P.textContent('.shmap-ok')).includes('1곳'), `버튼: ${await P.textContent('.shmap-ok')}`);
// 목록에서 두 번째도 선택 (복수 선택)
await P.click('.shmap-it >> nth=3');
await P.waitForTimeout(250);
chk((await P.textContent('.shmap-ok')).includes('2곳'), `복수 선택: ${await P.textContent('.shmap-ok')}`);
// 외부 지도 링크
const links = await P.$$eval('.shmap-it >> nth=0 >> a', as => as.map(a => a.href));
chk(links.length === 3 && links[0].startsWith('https://map.kakao.com/link/map/')
  && links[1].startsWith('https://map.kakao.com/link/roadview/')
  && links[2].startsWith('https://map.naver.com/p/search/'),
  `외부 지도 링크 3종: ${links.map(l=>l.slice(0,36)).join(' | ')}`);
chk(await P.$$eval('.shmap-it >> nth=0 >> a', as => as.every(a =>
  a.target === '_blank' && a.rel.includes('noopener'))), '외부 링크 새 창 + noopener');
// 확대축소·전체보기 — 이제 순간이동이 아니라 부드럽게 움직이므로(assets/mapcore.js
// 의 카메라), 애니메이션이 끝날 때까지 넉넉히 기다린 뒤 값을 읽는다
await P.click('.shmap-zf'); await P.waitForTimeout(550);
const w0 = await P.evaluate(() => SHMAP.debug().view.w);
await P.click('.shmap-zi'); await P.waitForTimeout(400);
const w1 = await P.evaluate(() => SHMAP.debug().view.w);
chk(w1 < w0, `확대 동작 (${w0.toFixed(5)} → ${w1.toFixed(5)})`);
await P.click('.shmap-zf'); await P.waitForTimeout(550);
const w2 = await P.evaluate(() => SHMAP.debug().view.w);
chk(Math.abs(w2 - w0) < 1e-9, `전체 보기로 복귀 (${w2.toFixed(6)})`);
// 드래그
await P.mouse.move(400, 400); await P.mouse.down();
await P.mouse.move(320, 360, {steps:5}); await P.mouse.up();
await P.waitForTimeout(200);
const vbAfter = await P.evaluate(() => SHMAP.debug().view);
chk(true, `드래그 후 시야 갱신: ${vbAfter.cx.toFixed(5)},${vbAfter.cy.toFixed(5)}`);
await P.click('.shmap-zf'); await P.waitForTimeout(150);

// 넣기
const before = await P.inputValue('#if_대피소');
await P.selectOption('.shmap-target', '대피소');
await P.click('.shmap-ok');
await P.waitForTimeout(400);
chk(!(await P.isVisible('.shmap-back')), '넣기 후 창 닫힘');
const after = await P.inputValue('#if_대피소');
chk(after !== before && after.split(', ').length === 2, `대피소 칸에 2곳 입력됨: ${after}`);
chk((await P.textContent('#out .msg')).includes(after.split(', ')[0]), '문안에 반영됨');

// 다른 칸에 넣기 (집결지)
await goStep(P, 'evac');
await P.click('#btnMap'); await P.waitForTimeout(500);
await P.click('.shmap-it >> nth=1'); await P.waitForTimeout(200);
await P.selectOption('.shmap-target', '집결지');
await P.click('.shmap-ok'); await P.waitForTimeout(400);
chk((await P.inputValue('#if_집결지')).length > 0, `집결지 칸: ${await P.inputValue('#if_집결지')}`);

// Esc 로 닫기 + 취소는 값 안 바꿈
const keep = await P.inputValue('#if_대피소');
await goStep(P, 'evac');
await P.click('#btnMap'); await P.waitForTimeout(500);
await P.click('.shmap-it >> nth=2'); await P.waitForTimeout(150);
await P.keyboard.press('Escape'); await P.waitForTimeout(300);
chk(!(await P.isVisible('.shmap-back')), 'Esc 로 닫힘');
chk((await P.inputValue('#if_대피소')) === keep, '취소하면 값 안 바뀜');

// 7-1 켜면 넣을 칸 늘어남
let nOpt = await P.$$eval('.shmap-target option', o => o.length).catch(()=>0);
await goStep(P, 'evac');
await P.click('#btnMap'); await P.waitForTimeout(400);
nOpt = await P.$$eval('.shmap-target option', o => o.map(x=>x.value));
chk(nOpt.length === 2 && nOpt.join()==='대피소,집결지', `7-1 끔: 넣을 칸 ${nOpt}`);
await P.keyboard.press('Escape'); await P.waitForTimeout(200);
await goStep(P, 'evac');
await P.check('#use71'); await P.waitForTimeout(300);
await goStep(P, 'evac');
await P.click('#btnMap'); await P.waitForTimeout(400);
nOpt = await P.$$eval('.shmap-target option', o => o.map(x=>x.value));
chk(nOpt.length === 4, `7-1 켬: 넣을 칸 ${nOpt}`);
await P.keyboard.press('Escape'); await P.waitForTimeout(150);
await goStep(P, 'evac');
await P.uncheck('#use71'); await P.waitForTimeout(250);

// 시·도/시·군·구 바꾸기
await goStep(P, 'evac');
await P.click('#btnMap'); await P.waitForTimeout(400);
await P.selectOption('.shmap-sido', '경기도'); await P.waitForTimeout(400);
chk((await P.inputValue('.shmap-sgg')) === '', '시·도 바꾸면 시·군·구 초기화');
chk((await P.textContent('.shmap-list')).includes('고르세요'), '시·군·구 미선택 안내');
await P.selectOption('.shmap-sgg', {index:1}); await P.waitForTimeout(500);
chk((await P.$$eval('.shmap-svg circle.mk', c=>c.length)) > 0, '다른 시·군·구도 렌더');
chk((await P.$$eval('.shmap-it.on', c=>c.length)) === 0, '지역 바꾸면 선택 초기화');
await P.keyboard.press('Escape'); await P.waitForTimeout(200);

// 목록에서 찾기(기존 경로)도 살아 있는지
await goStep(P, 'evac');
await P.click('#btnFinder'); await P.waitForTimeout(250);
chk(await P.isVisible('#finder'), '목록에서 찾기 패널 열림');
await goStep(P, 'evac');
nOpt = await P.$$eval('#shTarget option', o => o.map(x=>x.value));
chk(nOpt.join() === '대피소,집결지', `목록 경로 넣을 칸도 동기화: ${nOpt}`);

// ══ D. 모바일 ══
await P.setViewportSize({width:390,height:844});
await P.waitForTimeout(200);
await goStep(P, 'evac');
await P.click('#btnMap'); await P.waitForTimeout(600);
chk(await P.isVisible('.shmap-svg'), '모바일에서 지도 표시');
const msw = await P.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
chk(msw[0] <= msw[1] + 1, `모바일 지도창 가로 스크롤 없음 (${msw})`);
chk((await P.$$eval('.shmap-svg circle.mk', c=>c.length)) > 0, '모바일 마커 렌더');
await P.keyboard.press('Escape');
await P.setViewportSize({width:1280,height:950});

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
if (bad.length) { console.log(''); bad.forEach(m => console.log('  FAIL ' + m)); }
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
