/* ② 대피장소 지도 — 이재민 임시주거시설 층 검증 */
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
const U = ROOT + 'map/index.html';

await P.goto(U); await P.waitForTimeout(500);

// ══ A. 자료가 실렸는가 ══
chk(await P.evaluate(() => !!window.TEMPSHELTERS), '자료 파일이 실렸다');
chk(await P.evaluate(() => window.MAPCORE.hasTemp()), 'MC.hasTemp() = true');
chk(await P.evaluate(() => window.MAPCORE.tempShelters('경상북도', '김천시').length) === 4,
    '김천시 임시주거시설 4곳');
chk(await P.evaluate(() => window.MAPCORE.tempShelters('', '').length) === 6, '전국 6곳');
chk(await P.evaluate(() => window.MAPCORE.tempShelters('', '')[0].src) === 'temp', 'src = temp');
chk(await P.evaluate(() => window.MAPCORE.shelters('', '')[0].src) === 'chem', 'src = chem');
chk(await P.evaluate(() => window.MAPCORE.shelters('', '')[0].key.indexOf('chem|') === 0),
    '열쇠에 자료 종류가 앞에 붙는다');

// ══ B. 고르는 줄 ══
chk(!(await P.isHidden('#mLayers')), '자료 고르는 줄이 보인다');
let chips = await P.$$eval('#mLayers .ms-lyr', bs => bs.map(b => b.textContent.trim()));
chk(chips.length === 2, `딱지 2개 (실제 ${chips.length})`);
chk(chips[0].includes('화학사고 대피장소') && chips[1].includes('이재민 임시주거시설'),
    `딱지 이름: ${chips.join(' / ')}`);
chk(await P.$$eval('#mLayers .ms-lyr.on', b => b.length) === 2, '처음엔 둘 다 켜져 있다');

// ══ C. 시·군·구를 고르면 두 자료가 함께 나온다 ══
await P.selectOption('#mSido', '경상북도'); await P.waitForTimeout(200);
await P.selectOption('#mSgg', '김천시'); await P.waitForTimeout(400);
const nChem = await P.evaluate(() => window.MAPCORE.shelters('경상북도', '김천시').length);
let rows = await P.$$eval('#shList .ms-it', r => r.length);
chk(rows === nChem + 4, `목록 = 화학사고 ${nChem} + 이재민 4 = ${nChem + 4} (실제 ${rows})`);
chk((await P.textContent('#listCnt')).trim() === (nChem + 4) + '곳', `머리표 곳수: ${await P.textContent('#listCnt')}`);
let cnt = await P.$$eval('#mLayers .ms-lyr b', bs => bs.map(b => b.textContent));
chk(cnt[0] === String(nChem) && cnt[1] === '4', `딱지 개수 ${cnt.join(' / ')}`);

// 마커도 두 색으로 찍혔는가
chk(await P.$$eval('#map circle.mk.tmp', c => c.length) === 4, '보라 마커 4개');
chk(await P.$$eval('#map circle.mk:not(.tmp)', c => c.length) === nChem, `초록 마커 ${nChem}개`);

// 목록 줄에 어느 자료인지 딱지가 붙는가
chk(await P.$$eval('#shList .ms-kd.temp', e => e.length) === 4, '이재민 딱지 4줄');
chk(await P.$$eval('#shList .ms-kd.chem', e => e.length) === nChem, `화학사고 딱지 ${nChem}줄`);

// 범례
let leg = await P.textContent('#mLeg');
chk(leg.includes('화학사고 대피장소') && leg.includes('이재민 임시주거시설'), `범례: ${leg}`);

// ══ D. 켜고 끄기 ══
await P.click('#mLayers .ms-lyr.temp'); await P.waitForTimeout(350);
rows = await P.$$eval('#shList .ms-it', r => r.length);
chk(rows === nChem, `이재민 끄면 ${nChem}줄 (실제 ${rows})`);
chk(await P.$$eval('#map circle.mk.tmp', c => c.length) === 0, '보라 마커 사라짐');
chk(await P.$$eval('#shList .ms-kd', e => e.length) === 0, '한 종류만이면 줄 딱지 안 붙음');
chk(!(await P.textContent('#mLeg')).includes('이재민'), '범례에서도 빠짐');
chk(await P.getAttribute('#mLayers .ms-lyr.temp', 'aria-pressed') === 'false', 'aria-pressed=false');

// 마지막 하나까지 끄지는 못한다
await P.click('#mLayers .ms-lyr.chem'); await P.waitForTimeout(350);
chk(await P.$$eval('#shList .ms-it', r => r.length) === nChem, '마지막 하나는 꺼지지 않는다');
chk(!(await P.isHidden('#mToast')), '왜 안 꺼지는지 알려준다');

// 이재민만 보기
await P.click('#mLayers .ms-lyr.temp'); await P.waitForTimeout(300);
await P.click('#mLayers .ms-lyr.chem'); await P.waitForTimeout(350);
rows = await P.$$eval('#shList .ms-it', r => r.length);
chk(rows === 4, `이재민만 4줄 (실제 ${rows})`);
chk(await P.$$eval('#map circle.mk.tmp', c => c.length) === 4, '보라 마커만 4개');
chk(await P.$$eval('#map circle.mk:not(.tmp)', c => c.length) === 0, '초록 마커 없음');
await P.click('#mLayers .ms-lyr.chem'); await P.waitForTimeout(350);

// ══ E. 사고지점 · 반경 ══
await P.fill('#acLat', '36.14'); await P.fill('#acLon', '128.11'); await P.waitForTimeout(700);
const near = await P.evaluate(() => {
  const el = document.querySelector('.ms-near');
  return el ? el.textContent : '';
});
chk(near.includes('시험용 임시주거시설 가'), `가장 가까운 곳 = 이재민 시설 (${near.slice(0, 40)})`);
/* 시·군·구를 골라 둔 상태라 범위는 '관내' 그대로다 */
cnt = await P.$$eval('#mLayers .ms-lyr b', bs => bs.map(b => b.textContent));
chk(cnt[0] === String(nChem) && cnt[1] === '4', `사고지점 찍은 뒤 개수 ${cnt.join(' / ')}`);
rows = await P.$$eval('#shList .ms-it', r => r.length);
chk(rows === nChem + 4, `목록 ${rows}줄`);

// 가까운 3곳 카드에서 이재민 시설을 골라도 동작하나
await P.click('#mNear .mnear-it'); await P.waitForTimeout(400);
chk(await P.$$eval('#shList .ms-it.on', e => e.length) === 1, '고르면 목록에서도 선택된다');
chk(await P.$$eval('#map circle.mk.tmp.on', c => c.length) === 1, '고른 보라 마커가 커진다');
chk((await P.textContent('#mAddr')).includes('시험용'), '지도 위 주소칸에 이름이 나온다');

// ① 문자로 넘기기 — 이재민 시설을 고른 상태에서도 대피장소로 넘어가야 한다
chk(!(await P.isHidden('#btnToSms')), '문자 만들기 단추가 나온다');
const seed = await P.evaluate(() => {
  document.querySelector('#btnToSms').click();
  return sessionStorage.getItem('nics.sms.seed.v1');
});
chk(seed && seed.includes('시험용'), `넘긴 자료에 고른 시설이 들어간다`);

// ══ F. 지역을 안 고르고 사고지점만 찍으면 반경 5km ══
await P.goto(U); await P.waitForTimeout(500);
await P.fill('#acLat', '36.14'); await P.fill('#acLon', '128.11'); await P.waitForTimeout(700);
chk(await P.inputValue('#mScope') === '5000', '범위가 자동으로 반경 5km');
const inScope = await P.evaluate(() => ({
  chem: window.MAPCORE.shelters('', '').filter(s =>
    window.MAPCORE.distM(36.14, 128.11, s.lat, s.lon) <= 5000).length,
  temp: window.MAPCORE.tempShelters('', '').filter(s =>
    window.MAPCORE.distM(36.14, 128.11, s.lat, s.lon) <= 5000).length
}));
cnt = await P.$$eval('#mLayers .ms-lyr b', bs => bs.map(b => b.textContent));
chk(cnt[0] === String(inScope.chem) && cnt[1] === String(inScope.temp),
    `반경 5km 안 개수 ${cnt.join(' / ')} (기대 ${inScope.chem} / ${inScope.temp})`);
rows = await P.$$eval('#shList .ms-it', r => r.length);
chk(rows === inScope.chem + inScope.temp, `반경 목록 ${rows}줄 (기대 ${inScope.chem + inScope.temp})`);
chk(inScope.temp > 0 && inScope.temp < 6, `반경 안 이재민 시설 ${inScope.temp}곳 — 반경으로 걸러진다`);

// ══ G. 초기화 ══
await P.goto(U); await P.waitForTimeout(500);
await P.click('#mLayers .ms-lyr.temp'); await P.waitForTimeout(300);
await P.click('#btnClear'); await P.waitForTimeout(400);
chk(await P.$$eval('#mLayers .ms-lyr.on', b => b.length) === 2, '초기화하면 둘 다 다시 켜진다');

console.log('통과 ' + ok.length + ' / 실패 ' + bad.length);
bad.forEach(m => console.log('  ✗ ' + m));
if (errs.length) { console.log('오류:'); errs.forEach(e => console.log('  ' + e)); }
await B.close();
