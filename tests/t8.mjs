/* ② 대피장소 지도 회귀 — 지도로 찾기 기능을 합친 뒤
   배경지도 · 거리 눈금 · 요약 줄 · 행정구역 넘어 찾기 · 연결선 · 인쇄 · 모바일 */
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
const P = await B.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
const errs = []; P.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
const ok = [], bad = []; const chk = (c, m) => (c ? ok : bad).push(m);
const URL = ROOT + 'map/index.html';
const tile = r => r.fulfill({ path: RPATH + '/tests/fixtures/tile.png', contentType: 'image/png' });

await P.route(/vworld|openstreetmap/, tile);
await P.goto(URL); await P.waitForTimeout(500);

// ══ 1. 화면 뼈대 ══
chk((await P.textContent('.top h1')).trim() === '화학사고 대피장소 지도',
  `제목: "${(await P.textContent('.top h1')).trim()}"`);
chk((await P.$$('.top h1 .sub')).length === 0, '부제 없음 (① 도구와 같은 방식으로 간소화)');
chk((await P.$$('.foot .disc')).length === 0, '하단 안내문구 → 자료 출처 창으로 이동');
chk(await P.isVisible('#btnSrc'), '자료 출처 단추 있음');
chk(!(await P.isVisible('#srcModal')), '처음엔 자료 출처 창 닫힘');
await P.click('#btnSrc'); await P.waitForTimeout(200);
chk(await P.isVisible('#srcModal'), '자료 출처 창 열림');
chk((await P.textContent('#srcModal')).includes('직선거리'), '직선거리 주의문구 유지');
chk((await P.textContent('#srcModal')).includes('법적 행정경계가 아닙니다'), '경계 주의문구 유지');
await P.keyboard.press('Escape'); await P.waitForTimeout(200);
chk(!(await P.isVisible('#srcModal')), 'Esc 로 닫힘');

// ══ 2. 배경지도 (지도로 찾기에서 가져온 기능) ══
chk((await P.$$eval('#mLyr button', b => b.map(x => x.textContent))).length === 3,
  '배경지도 3종 고르기 단추');
await P.selectOption('#mSido', '충청남도'); await P.waitForTimeout(150);
await P.selectOption('#mSgg', '서산시'); await P.waitForTimeout(1500);
const nImg = (await P.$$('#map image')).length;
chk(nImg > 0, `배경지도 타일 렌더 (<image> ${nImg}장)`);
chk(await P.$eval('#map', s => s.classList.contains('hasbg')), '배경 있을 때 hasbg 대비 전환');
chk((await P.$$('#map circle.mk')).length === 8, `마커 렌더 (${(await P.$$('#map circle.mk')).length}곳)`);
chk((await P.$$('#map path.bd')).length > 0, '행정경계선 렌더');
chk((await P.textContent('#scaleTxt')).length > 0, `축척 막대: ${await P.textContent('#scaleTxt')}`);

// 배경 바꾸기
await P.click('#mLyr button[data-s=osm]'); await P.waitForTimeout(900);
chk(await P.$eval('#mLyr button[data-s=osm]', b => b.getAttribute('aria-pressed') === 'true'),
  'OpenStreetMap 으로 전환됨');
await P.click('#mLyr button[data-s=vworld]'); await P.waitForTimeout(900);

// ══ 3. 사고지점 · 거리 눈금 ══
chk(await P.$eval('#mSort option[value=dist]', o => o.disabled), '사고지점 전: 거리순 정렬 잠김');
chk(await P.$eval('#mScope option[value="5000"]', o => o.disabled), '사고지점 전: 반경 범위 잠김');
chk((await P.$$('#map circle.grid')).length === 0, '사고지점 전: 거리 눈금 없음');

await P.click('#btnAcc');
chk((await P.textContent('#btnAcc')).includes('누르세요'), '사고지점 찍기 모드 표시');
chk(await P.$eval('#map', s => s.classList.contains('crosshair')), '십자 커서로 바뀜');
let bb = await (await P.$('#map')).boundingBox();
await P.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
await P.waitForTimeout(900);
chk(!!(await P.inputValue('#acLat')), `지도 클릭 → 사고지점 ${await P.inputValue('#acLat')}, ${await P.inputValue('#acLon')}`);
chk(!(await P.$eval('#map', s => s.classList.contains('crosshair'))), '찍은 뒤 커서 원복');
chk(await P.inputValue('#mSort') === 'dist', '사고지점 찍으면 가까운 순으로 자동 전환');
chk((await P.$$('#map line.acc')).length === 2, '사고지점 십자 표시');

const rings = await P.$$eval('#map text.gridlbl', t => t.map(x => x.textContent));
chk(rings.length >= 2, `거리 눈금 고리 ${rings.length}개: ${rings.join(', ')}`);
chk(rings.every(r => /^\d+(\.\d)?(m|km)$/.test(r)), '눈금 라벨이 떨어지는 거리 값');
/* 시·군 전체를 보던 화면에서 찍었을 때 눈금이 20km 처럼 크게 잡히면 쓸모가 없다 */
chk(/^(\d+(\.\d)?m|[1-9](\.\d)?km)$/.test(rings[0]),
  `가장 안쪽 눈금이 주변을 가늠할 만한 크기 (${rings[0]})`);
await P.uncheck('#cRings'); await P.waitForTimeout(300);
chk((await P.$$('#map circle.grid')).length === 0, '거리 눈금 끄기 동작');
await P.check('#cRings'); await P.waitForTimeout(300);

// ══ 4. 요약 줄 ══
const sum = (await P.textContent('#mSum')).replace(/\s+/g, ' ');
chk(await P.isVisible('#mSum'), '사고지점 찍으면 요약 줄 표시');
chk(/가장 가까운 곳/.test(sum), '요약: 가장 가까운 곳');
chk(/1km 안 \d+곳/.test(sum) && /5km 안 \d+곳/.test(sum), `요약: 거리 구간별 개수 — ${sum.slice(0, 80)}`);
chk(!/1\.0km/.test(sum), '딱 떨어지는 거리는 소수점 없이 (1km)');

// ══ 5. 물질 → 영향 참고 반경 ══
await P.fill('#mMat', '염소'); await P.waitForTimeout(400);
await P.keyboard.press('Escape');
chk(await P.isVisible('#mRad'), '물질 입력 시 반경 줄 표시');
const rbs = await P.$$('#mRad button[data-r]');
chk(rbs.length > 0, `물질정보에서 뽑은 반경 후보 ${rbs.length}개`);
await rbs[0].click(); await P.waitForTimeout(600);
chk((await P.$$('#map circle.ring')).length === 1, '영향 참고 반경 원 렌더');
chk((await P.textContent('#mSum')).includes('영향 참고 반경'), '요약에 반경 안 개수 표시');
chk((await P.textContent('#mRad')).includes('물질정보 원문'), '물질정보 원문 접어 두기');
await P.fill('#mMat', '없는물질이름'); await P.waitForTimeout(400);
chk((await P.textContent('#mRad')).includes('목록에 없습니다'), '460종에 없는 물질 안내');
await P.fill('#mMat', ''); await P.waitForTimeout(300);

// ══ 6. 풍향 · 풍하방향 (나침반 팝오버) ══
await P.click('#windBtn'); await P.waitForTimeout(150);
await P.click('.wr-b[data-deg="270"]'); await P.waitForTimeout(400);
chk((await P.$$('#map path.lee')).length === 1, '풍하방향 부채꼴 렌더');
chk((await P.textContent('#mLeg')).includes('풍하방향'), '범례에 풍하방향 추가');
chk((await P.textContent('#windBtnTxt')) === '서풍', '풍향 단추에 고른 방향 표시');
await P.click('#windClear'); await P.waitForTimeout(300);   // 팝오버는 방향을 골라도 열려 있다
chk((await P.$$('#map path.lee')).length === 0, '풍향 지우면 부채꼴 사라짐');
chk((await P.textContent('#windBtnTxt')) === '설정 안 함', '풍향 단추도 초기 문구로 복귀');

// ══ 7. 목록 · 연결선 · 복사 ══
await P.click('#shList .ms-it:first-child'); await P.waitForTimeout(700);
chk((await P.$$('#map path.route')).length === 1, '고른 곳까지 경로선');
chk((await P.$$('#map path.route-cas')).length === 1, '경로선에 흰 테두리 (배경지도 위 가독성)');
chk((await P.$eval('#map path.route', e => parseFloat(getComputedStyle(e).strokeWidth))) >= 4,
  '경로선이 얇은 점선이 아니라 굵게');
const ll = await P.textContent('#map text.linklbl');
chk(/(m|km)\s.*쪽.*분/.test(ll), `경로선에 거리·방위·이동시간 표시: ${ll}`);
chk(await P.isVisible('#mAddr'), '지도 위 주소 표시');
chk((await P.$$('#shList .ms-it.on .ms-cp button')).length === 2, '고른 줄에 복사 단추');
chk((await P.$$('#shList .ms-it.on a')).length === 3, '외부 지도 링크 3종 (카카오·로드뷰·네이버)');
chk((await P.$$('#shList .ms-bar')).length > 0, '거리 막대 렌더 (줄끼리 견주기)');

// 검색
await P.fill('#mQ', '초등학교'); await P.waitForTimeout(400);
const f = await P.$$eval('#shList .ms-it .l1 b', b => b.map(x => x.textContent));
chk(f.length > 0 && f.every(n => n.includes('초등학교')), `검색 걸림 (${f.length}곳)`);
await P.fill('#mQ', '없는이름ㅁㄴㅇ'); await P.waitForTimeout(300);
chk((await P.textContent('#shList')).includes('맞는 곳이 없습니다'), '검색 결과 없음 안내');
await P.fill('#mQ', ''); await P.waitForTimeout(300);

// ══ 8. 행정구역 넘어 찾기 — 이 화면의 핵심 개선 ══
await P.click('#btnClear'); await P.waitForTimeout(400);
await P.selectOption('#mSido', '광주광역시'); await P.waitForTimeout(150);
await P.selectOption('#mSgg', '남구'); await P.waitForTimeout(400);
const nIn = await P.textContent('#listCnt');
await P.fill('#acLat', '35.15045'); await P.fill('#acLon', '126.89069');
await P.waitForTimeout(900);
const btnMore = await P.$('.ms-more');
chk(!!btnMore, '경계 근처 사고: 옆 시·군·구에 더 있다고 알려 줌');
chk((await btnMore.textContent()).includes('다른 시·군·구'), `안내: ${(await btnMore.textContent()).trim()}`);
await btnMore.click(); await P.waitForTimeout(900);
chk(await P.inputValue('#mScope') === '5000', '범위 넓히기 → 사고지점 반경 5km');
const sggs = await P.$$eval('#shList .ms-it .l2', ls =>
  [...new Set(ls.map(l => l.textContent.trim().split(' ')[0]))]);
chk(sggs.length > 1, `행정구역을 넘어 찾음 (${sggs.join(', ')})`);
const ds = await P.$$eval('#shList .ms-it .l1 .d', d => d.map(x => x.textContent));
chk(ds.length > +nIn.replace(/\D/g, ''), `관내 ${nIn} → 반경 ${ds.length}곳으로 늘어남`);
const meters = ds.map(t => t.includes('km') ? parseFloat(t) * 1000 : parseFloat(t));
chk(meters.every((v, i) => i === 0 || v >= meters[i - 1] - 1), '가까운 순 정렬 유지');
chk(meters[meters.length - 1] <= 5000, '반경 5km 밖은 안 나옴');
await P.screenshot({ path: 't8-cross.png' });

// ══ 9. 초기화 ══
await P.click('#btnClear'); await P.waitForTimeout(500);
chk(!(await P.inputValue('#acLat')) && await P.inputValue('#mSido') === ''
    && await P.inputValue('#mScope') === '' && !(await P.isVisible('#mSum')),
  '초기화 — 사고지점·지역·범위·요약 모두 원복');
chk((await P.textContent('#shList')).includes('시·도와 시·군·구를 고르세요'), '초기화 후 안내문구');

// ══ 10. 인쇄 ══
await P.selectOption('#mSido', '충청남도'); await P.waitForTimeout(150);
await P.selectOption('#mSgg', '서산시'); await P.waitForTimeout(500);
await P.emulateMedia({ media: 'print' }); await P.waitForTimeout(300);
const pr = await P.evaluate(() => ({
  bar: getComputedStyle(document.querySelector('.mbar')).display,
  acc: getComputedStyle(document.querySelector('.mapacc')).display,
  ctl: getComputedStyle(document.querySelector('.mapctl')).display,
  list: document.querySelectorAll('#shList .ms-it').length,
  ov: getComputedStyle(document.querySelector('.ms-list')).overflowY
}));
chk(pr.bar === 'none' && pr.acc === 'none' && pr.ctl === 'none', '인쇄: 조작 UI 숨김');
chk(pr.list === 8 && pr.ov === 'visible', `인쇄: 목록 전체 나옴 (${pr.list}곳, 스크롤 해제)`);
await P.emulateMedia({ media: 'screen' });

// ══ 11. 모바일 ══
const M = await B.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
await M.route(/vworld|openstreetmap/, tile);
M.on('pageerror', e => errs.push('MOBILE: ' + e.message));
await M.goto(URL); await M.waitForTimeout(400);
await M.selectOption('#mSido', '충청남도'); await M.waitForTimeout(150);
await M.selectOption('#mSgg', '서산시'); await M.waitForTimeout(800);
chk((await M.$$('#map circle.mk')).length === 8, '모바일 마커 렌더');
await M.click('#btnAcc'); await M.waitForTimeout(200);
bb = await (await M.$('#map')).boundingBox();          // 단추 누르며 스크롤되므로 다시 잰다
await M.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
await M.waitForTimeout(800);
chk(!!(await M.inputValue('#acLat')), '모바일에서 지도 눌러 사고지점 찍기');
const over = await M.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
chk(over <= 0, `모바일 가로 스크롤 없음 (넘침 ${over}px)`);
await M.screenshot({ path: 't8-mobile.png' });

// ══ 12. 단일 파일 빌드 ══
const D = await B.newPage({ viewport: { width: 1400, height: 900 } });
await D.route(/vworld|openstreetmap/, tile);
D.on('pageerror', e => errs.push('DIST: ' + e.message));
await D.goto(ROOT + 'dist/'
  + encodeURIComponent('화학사고_대피장소_지도.html'));
await D.waitForTimeout(600);
await D.selectOption('#mSido', '충청남도'); await D.waitForTimeout(150);
await D.selectOption('#mSgg', '서산시'); await D.waitForTimeout(1200);
chk((await D.$$('#map circle.mk')).length === 8, '단일 파일: 마커 렌더');
chk((await D.$$('#map image')).length > 0, '단일 파일: 배경지도 렌더');
await D.fill('#acLat', '36.78'); await D.fill('#acLon', '126.45'); await D.waitForTimeout(800);
chk((await D.$$('#map circle.grid')).length > 0, '단일 파일: 거리 눈금 동작');
chk(await D.isVisible('#mSum'), '단일 파일: 요약 줄 동작');

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
