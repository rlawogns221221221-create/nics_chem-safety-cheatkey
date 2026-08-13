/* 사고지점 주소 — 읍·면·동·사업장까지 문자로 넘어가는가 */
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

const STUB = `window.ONLINE = {
  hasKey: () => true,
  search: (q, done) => done([], null),
  route: () => function(){},
  revgeo: (lat, lon, done) => setTimeout(() => done({
    sido:'경상북도', sgg:'김천시', emd:'신음동', road:'시청1길', no:'1',
    text:'경상북도 김천시 시청1길 1' }, null), 60)
};`;

const vals = (P) => P.evaluate(() => {
  const o = {};
  document.querySelectorAll('#cols input[data-k],#cols textarea[data-k]')
    .forEach(e => { if (e.value) o[e.getAttribute('data-k')] = e.value; });
  return o;
});
const pickEvac = async (P) => {
  await P.evaluate(() => { [...document.querySelectorAll('#stages button')]
    .find(x => /주민소산|대피명령/.test(x.textContent)).click(); });
  await P.waitForTimeout(700);
};

// ══ 1. 인터넷 없이 — 행정경계 + 가까운 대피장소로 어림 ══
{
  const P = await B.newPage({ viewport: { width: 1500, height: 950 } });
  P.on('pageerror', e => errs.push('OFF: ' + e.message));
  await P.goto(`${R}/map/index.html`); await P.waitForTimeout(800);
  await P.fill('#acLat', '36.1400'); await P.fill('#acLon', '128.1137');
  await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(1400);

  const sum = await P.textContent('#mSum');
  chk(/사고지점/.test(sum), '요약 줄에 사고지점 주소가 나온다');
  chk(/김천시/.test(sum) && /신음동/.test(sum), '인터넷 없이도 시·군·구와 읍·면·동을 알아낸다');
  chk(/대략/.test(sum), '어림값임을 표시한다');

  const label = await P.textContent('#toSmsTxt');
  chk(/읍면동/.test(label), `단추에 읍면동이 들어간다 (${label})`);

  await P.click('#btnToSms'); await P.waitForTimeout(1300);
  const bar = await P.textContent('#seedBar');
  chk(/신음동/.test(bar), '알림 띠에 읍·면·동이 있다');
  chk(/어림잡았습니다/.test(bar), '어림값이라고 알리고 확인을 요청한다');

  await pickEvac(P);
  const v = await vals(P);
  chk(v['시군'] === '김천시', `시군 = ${v['시군']}`);
  chk(v['읍면동'] === '신음동', `읍면동 = ${v['읍면동']}`);
  chk(!v['사업장'], '주소를 모르면 사업장은 비워 둔다 (지어내지 않음)');
  await P.close();
}

// ══ 2. 인터넷이 될 때 — 브이월드 주소로 도로명까지 ══
{
  const P = await B.newPage({ viewport: { width: 1500, height: 950 } });
  P.on('pageerror', e => errs.push('ON: ' + e.message));
  await P.goto(`${R}/map/index.html`); await P.waitForTimeout(800);
  await P.evaluate(STUB);
  await P.fill('#acLat', '36.1400'); await P.fill('#acLon', '128.1137');
  await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(1400);

  const sum = await P.textContent('#mSum');
  chk(/시청1길 1/.test(sum), '요약 줄에 도로명 주소까지 나온다');
  chk(!/대략/.test(sum), '정확한 값이면 "대략" 표시가 없다');

  const label = await P.textContent('#toSmsTxt');
  chk(/사업장/.test(label), `단추에 사업장이 들어간다 (${label})`);

  await P.click('#btnToSms'); await P.waitForTimeout(1300);
  const bar = await P.textContent('#seedBar');
  chk(!/어림잡았습니다/.test(bar), '정확한 값이면 어림 경고가 없다');

  await pickEvac(P);
  const v = await vals(P);
  chk(v['읍면동'] === '신음동', `읍면동 = ${v['읍면동']}`);
  chk(v['사업장'] === '시청1길 1', `사업장 = 도로명 주소 (${v['사업장']})`);
  const card = await P.textContent('#out .out');
  chk(/김천시 신음동 시청1길 1에서/.test(card.replace(/\s+/g, ' ')),
    '문안에 "○○시 ○○동 ○○에서" 가 그대로 들어간다');
  await P.close();
}

// ══ 3. 장소 검색으로 찍었으면 그 이름이 우선 ══
{
  const P = await B.newPage({ viewport: { width: 1500, height: 950 } });
  P.on('pageerror', e => errs.push('POI: ' + e.message));
  await P.goto(`${R}/map/index.html`); await P.waitForTimeout(800);
  await P.evaluate(`${STUB}
    window.ONLINE.search = (q, done) => setTimeout(() => done([{
      kind:'poi', label:'○○화학 김천공장', sub:'경상북도 김천시 신음동 12',
      lat:36.1400, lon:128.1137, exact:true }], null), 50);`);
  await P.fill('#mAddrQ', '○○화학'); await P.waitForTimeout(1400);
  const rows = await P.$$('#addrPop .mpk-row');
  chk(rows.length > 0, `검색 결과가 나온다 (${rows.length}건)`);
  await P.evaluate(() => {
    const r = [...document.querySelectorAll('#addrPop .mpk-row')]
      .find(x => /화학/.test(x.textContent));
    if (r) r.click();
  });
  await P.waitForTimeout(1500);
  await P.click('#btnToSms'); await P.waitForTimeout(1300);
  await pickEvac(P);
  const v = await vals(P);
  chk(v['사업장'] === '○○화학 김천공장', `사업장 = 찾은 장소 이름 (${v['사업장']})`);
  chk(v['읍면동'] === '신음동', `읍면동 = ${v['읍면동']}`);
  await P.close();
}

// ══ 4. 사고지점을 바꾸면 주소도 따라 바뀐다 ══
{
  const P = await B.newPage({ viewport: { width: 1500, height: 950 } });
  P.on('pageerror', e => errs.push('MOVE: ' + e.message));
  await P.goto(`${R}/map/index.html`); await P.waitForTimeout(800);
  await P.fill('#acLat', '36.1400'); await P.fill('#acLon', '128.1137');
  await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(1300);
  chk(/김천시/.test(await P.textContent('#mSum')), '처음 = 김천시');
  await P.fill('#acLat', '34.7604'); await P.fill('#acLon', '127.6622');
  await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(1400);
  const sum = await P.textContent('#mSum');
  chk(/여수시/.test(sum), `옮기면 그 자리의 시·군·구로 바뀐다 (${sum.slice(0, 30)})`);
  chk(!/김천/.test(sum), '이전 주소가 남지 않는다');
  await P.click('#btnAccClear'); await P.waitForTimeout(700);
  chk(await P.isHidden('#mSum'), '사고지점을 지우면 요약 줄도 사라진다');
  await P.close();
}

// ══ 5. 인터넷 없이도 시·군·구 판정이 맞는가 ══
{
  const P = await B.newPage();
  P.on('pageerror', e => errs.push('SGG: ' + e.message));
  await P.goto(`${R}/map/index.html`); await P.waitForTimeout(900);
  const cases = [[36.1400, 128.1137, '김천시'], [37.5665, 126.9780, '중구'],
                 [34.7604, 127.6622, '여수시'], [33.4996, 126.5312, '제주시'],
                 [35.8242, 127.1480, '전주시완산구']];
  for (const [la, lo, want] of cases) {
    const got = await P.evaluate(([a, b]) => MAPCORE.sggAt(a, b), [la, lo]);
    chk(got && got.sgg === want, `행정경계 판정 ${want} (받은 값 ${got && got.sgg})`);
  }
  chk(await P.evaluate(() => MAPCORE.sggAt(40.0, 140.0)) === null, '우리나라 밖은 null');
  await P.close();
}

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
