/* ② 대피장소 — 사업장명 검색 · 도보 경로
   바깥 서버는 이 환경에서 막혀 있으므로 ONLINE 을 가짜로 바꿔 끼워
   화면 쪽 동작을 확인하고, 마지막에 진짜(=실패하는) 경로도 확인한다. */
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
const URL = ROOT + 'map/index.html';

/* 김천시청 부근을 가짜 검색 결과로 돌려준다 */
const STUB = `
window.ONLINE = {
  hasKey: () => true,
  search: (q, done) => setTimeout(() => {
    if (/없는/.test(q)) return done([], null);
    if (/끊김/.test(q)) return done([], '연결실패');
    done([
      { kind:'poi',  label:'(가짜) '+q+' 본사', sub:'김천시 시청1길 1', lat:36.1402, lon:128.1140, exact:true },
      { kind:'poi',  label:'(가짜) '+q+' 제2공장', sub:'김천시 공단2길 30', lat:36.1435, lon:128.1371, exact:true },
      { kind:'addr', label:'경상북도 김천시 시청1길 1', sub:'신음동 1', lat:36.1400, lon:128.1137, exact:true }
    ], null);
  }, 60),
  route: (from, to, done) => {
    setTimeout(() => done({
      path: [ {lat:from.lat, lon:from.lon},
              {lat:(from.lat+to.lat)/2 + 0.004, lon:(from.lon+to.lon)/2},
              {lat:(from.lat+to.lat)/2, lon:(from.lon+to.lon)/2 + 0.004},
              {lat:to.lat, lon:to.lon} ],
      dist: 1240
    }, null), 80);
    return () => {};
  }
};`;

async function page(stub) {
  const ctx = await B.newContext({ viewport: { width: 1500, height: 900 } });
  const P = await ctx.newPage();
  P.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  P.on('console', m => { if (m.type() === 'error' && !/TUNNEL|net::/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });
  await P.goto(URL); await P.waitForTimeout(700);
  /* assets/online.js 가 로드된 뒤에 바꿔 끼워야 한다 — 먼저 넣으면
     진짜 구현이 덮어쓴다 */
  if (stub) await P.evaluate(stub);
  return { ctx, P };
}

// ══ 1. 사업장명으로 찾기 ══
{
  const { ctx, P } = await page(STUB);
  await P.fill('#mAddrQ', '한국화학'); await P.waitForTimeout(900);
  chk(!(await P.isHidden('#addrPop')), '검색 결과창이 뜬다');
  const rows = await P.$$eval('#addrPop .mpk-row .nm', e => e.map(x => x.textContent.trim()));
  chk(rows.some(r => /본사/.test(r)), `사업장명으로 찾힌다 (${rows.slice(0,2).join(' / ')})`);
  const kinds = await P.$$eval('#addrPop .mpk-row .en', e => e.map(x => x.textContent.trim()));
  chk(kinds.includes('장소') && kinds.includes('주소'), `종류가 구분된다 (${[...new Set(kinds)].join(', ')})`);
  chk((await P.textContent('#addrPop .mpk-row .sub')).length > 0, '주소가 이름 옆에 함께 나온다');
  chk(/사고지점으로 찍습니다/.test(await P.textContent('#addrPop .mpk-ft')), '고르면 어떻게 되는지 알려준다');

  // 고르면 바로 사고지점이 된다 (좌표가 정확하므로)
  await P.click('#addrPop .mpk-row >> nth=0'); await P.waitForTimeout(1200);
  chk(Math.abs(parseFloat(await P.inputValue('#acLat')) - 36.1402) < 0.001,
    `고르면 그 자리가 사고지점 (${await P.inputValue('#acLat')})`);
  chk((await P.inputValue('#mScope')) === '5000', '주변 5km 범위도 함께 잡힌다');
  chk((await P.$$eval('#shList .ms-it', e => e.length)) > 0, '바로 대피장소 목록이 채워진다');
  chk(/사고지점으로 찍었습니다/.test(await P.textContent('#mToast')), '무엇을 했는지 알려준다');
  await ctx.close();
}

// ══ 2. 도구 안 자료 검색은 그대로 ══
{
  const { ctx, P } = await page(STUB);
  await P.fill('#mAddrQ', '김천'); await P.waitForTimeout(900);
  const kinds = await P.$$eval('#addrPop .mpk-row .en', e => e.map(x => x.textContent.trim()));
  chk(kinds.includes('시·군·구') || kinds.includes('대피장소'),
    `등록된 자료도 함께 나온다 (${[...new Set(kinds)].join(', ')})`);
  const first = await P.textContent('#addrPop .mpk-row:first-child .en');
  /* "대피장소"에도 '장소'가 들어 있으므로 정확히 비교한다 */
  chk(first.trim() !== '장소' && first.trim() !== '주소', `도구 안 결과가 먼저 (${first})`);
  await ctx.close();
}

// ══ 3. 인터넷 검색이 안 될 때 ══
{
  const { ctx, P } = await page(STUB);
  await P.fill('#mAddrQ', '끊김테스트'); await P.waitForTimeout(900);
  chk(/인터넷 검색을 쓸 수 없습니다|맞는 곳이 없습니다/.test(await P.textContent('#addrPop')),
    '안 되면 안 된다고 알려준다');
  await P.fill('#mAddrQ', '없는곳이름'); await P.waitForTimeout(900);
  chk(/맞는 곳이 없습니다/.test(await P.textContent('#addrPop')), '결과 없음 안내');
  await ctx.close();
}

// ══ 4. 도보 경로 ══
{
  const { ctx, P } = await page(STUB);
  await P.fill('#acLat', '36.1400'); await P.fill('#acLon', '128.1137');
  await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(900);
  await P.selectOption('#mScope', '5000'); await P.waitForTimeout(900);
  await P.click('#shList .ms-it >> nth=2'); await P.waitForTimeout(900);

  chk((await P.$$('#map path.route.real')).length === 1, '실제 도로 경로가 그려진다');
  const dash = await P.$eval('#map path.route.real', e => getComputedStyle(e).strokeDasharray);
  chk(dash === 'none' || dash === '', `실제 경로는 실선 (직선 점선과 구분: ${dash})`);
  const pts = await P.$eval('#map path.route.real', e => (e.getAttribute('d').match(/[ML]/g) || []).length);
  chk(pts >= 4, `여러 마디로 꺾인 길 (${pts}점)`);

  const lbl = await P.textContent('#map text.linklbl');
  chk(/도로 1\.2km/.test(lbl), `도로 거리를 적는다 (${lbl})`);
  /* 실제 도로거리 1240m 를 분속 66.7 로 나누면 19분. 우회계수 1.3을 또
     곱하면 24분이 되므로, 두 번 세지 않는지 본다. */
  chk(/도보 19분/.test(lbl), `도로거리에는 우회계수를 다시 곱하지 않는다 (${lbl})`);

  chk((await P.$$('#shList .ms-it.on .l6-tag')).length === 1, '목록 줄에도 실제 도로 표시');
  chk(/실제 도로/.test(await P.textContent('#shList .ms-it.on .l6')), '실제 값임을 밝힌다');
  const others = await P.$$eval('#shList .ms-it:not(.on) .l6', e => e.map(x => x.textContent));
  chk(others.every(t => /어림한 값|걸어서 가기 어려운/.test(t)), '고르지 않은 곳은 어림값 그대로');

  // 끄면 직선으로 돌아간다
  await P.uncheck('#cWalk'); await P.waitForTimeout(700);
  chk((await P.$$('#map path.route.real')).length === 0, '끄면 실제 경로를 안 그린다');
  chk((await P.$$('#map path.route')).length === 1, '끄면 직선은 그대로 그린다');
  chk(/쪽 ·/.test(await P.textContent('#map text.linklbl')), '끄면 직선거리·방위 표시로 돌아간다');
  await P.check('#cWalk'); await P.waitForTimeout(700);
  chk((await P.$$('#map path.route.real')).length === 1, '다시 켜면 경로를 받아온다');

  // 사고지점을 옮기면 예전 경로는 지워진다
  await P.fill('#acLat', '36.1600'); await P.dispatchEvent('#acLat', 'input');
  await P.waitForTimeout(1000);
  chk((await P.$$('#shList .l6-tag')).length === 0, '사고지점을 옮기면 예전 도로값이 남지 않는다');
  await ctx.close();
}

// ══ 5. 인터넷이 아예 없을 때 (진짜 네트워크 — 이 환경에서는 막혀 있다) ══
{
  const { ctx, P } = await page(null);
  await P.fill('#mAddrQ', '김천'); await P.waitForTimeout(1200);
  chk((await P.$$eval('#addrPop .mpk-row', e => e.length)) > 0,
    '인터넷이 없어도 등록된 자료로는 찾힌다');
  await P.fill('#acLat', '36.1400'); await P.fill('#acLon', '128.1137');
  await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(800);
  await P.selectOption('#mScope', '5000'); await P.waitForTimeout(800);
  await P.click('#shList .ms-it >> nth=1'); await P.waitForTimeout(1500);
  chk((await P.$$('#map path.route')).length === 1, '길찾기가 실패해도 직선은 그려진다');
  chk((await P.$$('#map path.route.real')).length === 0, '실패했으니 실제 경로는 없다');
  chk((await P.textContent('#shList .ms-it.on .l6')).includes('어림'), '어림값으로 안내한다');
  await ctx.close();
}

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
