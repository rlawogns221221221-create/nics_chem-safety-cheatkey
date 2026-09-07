/* ② 주민 대피장소 찾기 — 이재민 임시주거시설이 **실제 규모로 들어왔을 때**
   화면이 버티는가.

   ── 왜 이 검사가 따로 있나 ────────────────────────────────────
   tmp2 는 6곳짜리 견본으로 "층이 제대로 나오는가"를 봅니다. 그런데 전국
   이재민 임시주거시설은 **만 곳 단위**입니다. 자료가 들어온 날 지도가 멈추면,
   그때는 사고가 난 뒤일 수 있습니다. 그래서 자료가 오기 전에 **한 시·군·구에
   수십 곳 · 전국 만 이천 곳**을 넣어 보고 미리 잽니다.

   자료 파일을 만들지 않고 `addInitScript` 로 넣습니다 — 저장소의 data/ 를
   건드리지 않아야 다른 묶음과 섞이지 않습니다.

   ‼ 여기 쓰는 자료는 **만들어 낸 값**입니다. 화면이 버티는지 재는 데만 쓰고
     저장소에 남기지 않습니다(진짜 자료는 행안부 오픈API 에서 받습니다). */
import { chromium } from 'playwright';
import fs from 'fs';

const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/tests\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));

const ok = [], bad = [], errs = [];
const chk = (c, m) => (c ? ok : bad).push(m);

/* ── 실제 규모의 자료를 만든다 ────────────────────────────────
   지역 이름은 화학사고 대피장소 자료에서 그대로 가져옵니다(같은 열쇠를 써야
   같은 시·군·구로 묶입니다). 좌표는 그 시·군·구의 대피장소 좌표를 조금씩
   흩어 놓습니다 — 엉뚱한 바다에 찍히지 않게. */
const shTxt = fs.readFileSync(RPATH + '/data/shelters.js', 'utf-8');
const SH = JSON.parse(shTxt.match(/var SHELTERS = (\{[\s\S]*?\});\s*$/m)[1]);

const 목표 = 12000;
const big = {};
let n = 0, 시군구수 = 0;
const 시도들 = Object.keys(SH);
/* 한 시·군·구에 몇 곳을 넣을지 — 전국 12,000곳이 250개 시·군·구에 퍼지면
   한 곳당 40~50곳입니다. 실제 자료도 그 정도입니다(시·군마다 지정 수십 곳). */
outer:
for (const sd of 시도들) {
  for (const sg of Object.keys(SH[sd])) {
    const base = SH[sd][sg][0];
    if (!base) continue;
    const [bla, blo] = [base[5], base[6]];
    if (!isFinite(bla) || !isFinite(blo)) continue;
    시군구수++;
    const rows = [];
    for (let i = 0; i < 48; i++) {
      rows.push([
        `${sg} 제${i + 1}임시주거시설`,
        `${300 + i * 7}㎡`,
        `${sg} 어딘가로 ${i + 1}`,
        40 + i,
        i % 3 === 0 ? '마을회관' : (i % 3 === 1 ? '학교' : '체육관'),
        Math.round((bla + (i % 7 - 3) * 0.004) * 1e5) / 1e5,
        Math.round((blo + (Math.floor(i / 7) % 7 - 3) * 0.005) * 1e5) / 1e5,
        `${sg}청`, '033-000-0000'
      ]);
      n++;
      if (n >= 목표) { (big[sd] = big[sd] || {})[sg] = rows; break outer; }
    }
    (big[sd] = big[sd] || {})[sg] = rows;
  }
}
const 자료 = `window.TEMPSHELTERS = ${JSON.stringify(big)};
window.TEMPSHELTER_META = ${JSON.stringify({
  받은날: '2026-09-07', 총건수: n, 원자료건수: n,
  출처: '검사용으로 만든 값 (실제 자료가 아닙니다)',
  필드: ['시설명', '면적', '주소', '최대수용인원', '시설구분', '위도', '경도', '관리기관', '전화']
})};`;

const B = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const P = await B.newPage({ viewport: { width: 1400, height: 950 } });
P.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
P.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });
await P.addInitScript(자료);

const t0 = Date.now();
await P.goto(ROOT + 'map/index.html');
await P.waitForTimeout(900);
const 열기 = Date.now() - t0;
chk(await P.evaluate(() => !!window.TEMPSHELTERS), `만 이천 곳을 넣고 화면이 열린다 (${n.toLocaleString()}곳 · ${시군구수}개 시·군·구)`);
chk(열기 < 12000, `여는 데 ${(열기 / 1000).toFixed(1)}초 (12초 안)`);
chk(await P.evaluate(() => window.MAPCORE.hasTemp()), '층이 켜진다');
chk(await P.evaluate(() => window.MAPCORE.tempShelters('', '').length) === n,
  `전국 ${n.toLocaleString()}곳을 다 읽는다`);

/* ── 시·군·구를 골랐을 때 ───────────────────────────────────── */
const t1 = Date.now();
await P.selectOption('#mSido', '경상북도'); await P.waitForTimeout(200);
await P.selectOption('#mSgg', '김천시'); await P.waitForTimeout(900);
const 고르기 = Date.now() - t1;
chk(고르기 < 9000, `시·군·구를 고르는 데 ${(고르기 / 1000).toFixed(1)}초 (9초 안)`);
const 목록 = await P.$$eval('#shList .ms-it', e => e.length);
chk(목록 > 40, `한 시·군·구 목록이 나온다 (${목록}줄)`);
const 마커 = await P.$$eval('#map g.pin', e => e.length);
chk(마커 > 40, `지도에 마커가 찍힌다 (${마커}개)`);
/* 두 자료가 섞여 나오므로 줄마다 어느 쪽인지 딱지가 붙어야 합니다 */
const 딱지 = await P.$$eval('#shList .ms-kd', e => e.length);
chk(딱지 > 0, `섞여 있을 때 줄마다 자료 딱지가 붙는다 (${딱지}줄)`);

/* ── 사고지점을 넣었을 때(가장 무거운 자리) ─────────────────── */
const t2 = Date.now();
await P.fill('#acLat', '36.1400'); await P.fill('#acLon', '128.1137');
await P.dispatchEvent('#acLat', 'input');
await P.waitForTimeout(1800);
const 찍기 = Date.now() - t2;
chk(찍기 < 12000, `사고지점을 넣는 데 ${(찍기 / 1000).toFixed(1)}초 (12초 안)`);
chk((await P.$$eval('#shList .ms-it', e => e.length)) > 0, '사고지점 기준 목록이 나온다');
chk(/가장 가까운/.test(await P.textContent('#mSum')), '요약 줄이 가장 가까운 곳을 말한다');

/* 반경을 넓혀 **여러 시·군·구가 한꺼번에** 들어오는 가장 무거운 경우 */
const t3 = Date.now();
await P.selectOption('#mScope', '20000'); await P.waitForTimeout(2200);
const 넓히기 = Date.now() - t3;
const 넓은목록 = await P.$$eval('#shList .ms-it', e => e.length);
const 넓은마커 = await P.$$eval('#map g.pin', e => e.length);
chk(넓히기 < 15000, `반경 20km 로 넓히는 데 ${(넓히기 / 1000).toFixed(1)}초 (15초 안)`);
chk(넓은목록 > 100, `반경 안 목록 ${넓은목록}줄`);
chk(넓은마커 > 100, `반경 안 마커 ${넓은마커}개`);

/* 지도를 끌어 보아 멈추지 않는지 — 마커가 많으면 여기서 굳습니다 */
const box = await P.evaluate(() => {
  const r = document.querySelector('#map').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
const t4 = Date.now();
await P.mouse.move(box.x, box.y);
await P.mouse.down();
for (let i = 1; i <= 6; i++) { await P.mouse.move(box.x - i * 18, box.y - i * 10); await P.waitForTimeout(30); }
await P.mouse.up();
await P.waitForTimeout(600);
const 끌기 = Date.now() - t4;
chk(끌기 < 6000, `지도를 끌어도 굳지 않는다 (${(끌기 / 1000).toFixed(1)}초)`);

/* 한 곳을 골라 보기 — 목록이 길 때 고르는 것도 느려질 수 있습니다 */
const t5 = Date.now();
await P.click('#shList .ms-it >> nth=0'); await P.waitForTimeout(900);
chk(Date.now() - t5 < 8000, `한 곳을 고르는 데 ${((Date.now() - t5) / 1000).toFixed(1)}초`);
chk((await P.$$('#shList .ms-it.on')).length === 1, '고른 줄이 하나만 켜진다');

/* 층을 껐다 켜기 */
await P.click('#mLayers .ms-lyr >> nth=1'); await P.waitForTimeout(900);
const 껐을때 = await P.$$eval('#shList .ms-it', e => e.length);
chk(껐을때 < 넓은목록, `임시주거시설 층을 끄면 줄어든다 (${넓은목록} → ${껐을때})`);
await P.click('#mLayers .ms-lyr >> nth=1'); await P.waitForTimeout(900);
chk((await P.$$eval('#shList .ms-it', e => e.length)) === 넓은목록, '다시 켜면 되돌아온다');

await P.screenshot({ path: 'tmpbig.png' });
console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m)); bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
