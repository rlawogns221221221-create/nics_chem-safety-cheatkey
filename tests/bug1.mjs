/* 사고지점을 찍는 네 가지 방법이 모두 같은 결과를 내는가 */
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
const LAT = 36.1400, LON = 128.1137;   // 김천시청

const STUB = `window.ONLINE = { hasKey:()=>true,
  search:(q,done)=>setTimeout(()=>done([{kind:'poi',label:'김천시청',sub:'시청1길 1',
    lat:${LAT},lon:${LON},exact:true}],null),50),
  route:(f,t,done)=>{setTimeout(()=>done(null,'없음'),30); return ()=>{};} };`;

async function open(stub) {
  const ctx = await B.newContext({ viewport:{width:1500,height:900}, permissions:['geolocation'],
    geolocation:{ latitude:LAT, longitude:LON, accuracy:40 } });
  const P = await ctx.newPage();
  P.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await P.goto(URL); await P.waitForTimeout(700);
  if (stub) await P.evaluate(STUB);
  return { ctx, P };
}
const shown = P => P.$$eval('#shList .ms-it', e => e.length);

// ── ① 지도를 눌러 찍기 (문제가 있던 경로) ──
{
  const { ctx, P } = await open();
  await P.click('#btnAcc');                               // 사고지점 찍기 모드
  chk((await P.textContent('#btnAcc')).includes('지도를 누르세요'), '① 찍기 모드로 바뀜');
  const b = await P.evaluate(() => {
    const r = document.getElementById('map').getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  });
  await P.mouse.click(b.x, b.y); await P.waitForTimeout(1200);
  const n = await shown(P);
  chk(n > 0, `① 지도를 눌러 찍으면 대피장소가 나온다 (${n}곳)`);
  chk((await P.inputValue('#mScope')) === '5000', '① 찾는 범위가 5km 로 잡힘');
  chk(!!(await P.inputValue('#acLat')), '① 위경도 칸도 채워짐');
  chk((await P.$$('#mNear .mnear-it')).length > 0, '① 가까운 3곳 카드도 나온다');
  await ctx.close();
}

// ── ② 위경도 직접 입력 ──
{
  const { ctx, P } = await open();
  await P.fill('#acLat', String(LAT)); await P.fill('#acLon', String(LON));
  await P.dispatchEvent('#acLat', 'input'); await P.waitForTimeout(1200);
  const n = await shown(P);
  chk(n > 0, `② 위경도를 직접 넣어도 나온다 (${n}곳)`);
  chk((await P.inputValue('#mScope')) === '5000', '② 범위 5km');
  await ctx.close();
}

// ── ③ 주소·장소 검색 ──
{
  const { ctx, P } = await open(true);
  await P.fill('#mAddrQ', '김천시청'); await P.waitForTimeout(800);
  await P.click('#addrPop .mpk-row >> nth=0'); await P.waitForTimeout(1200);
  const n = await shown(P);
  chk(n > 0, `③ 주소 검색으로 찍어도 나온다 (${n}곳)`);
  await ctx.close();
}

// ── ④ 내 위치 ──
{
  const { ctx, P } = await open();
  await P.click('#btnMe'); await P.waitForTimeout(1800);
  const n = await shown(P);
  chk(n > 0, `④ 내 위치로 찍어도 나온다 (${n}곳)`);
  await ctx.close();
}

// ── 이미 고른 지역·범위는 건드리지 않는가 ──
{
  const { ctx, P } = await open();
  await P.selectOption('#mSido', '경상북도'); await P.waitForTimeout(500);
  await P.selectOption('#mSgg', '김천시'); await P.waitForTimeout(900);
  const before = await shown(P);
  await P.click('#btnAcc');
  const b = await P.evaluate(() => {
    const r = document.getElementById('map').getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  });
  await P.mouse.click(b.x, b.y); await P.waitForTimeout(1200);
  chk((await P.inputValue('#mScope')) === '',
    '이미 시·군·구를 골라 뒀으면 관내 보기를 유지한다 (사용자 선택 존중)');
  chk((await P.inputValue('#mSgg')) === '김천시', '고른 시·군·구도 그대로');
  chk((await shown(P)) === before, `목록도 그대로 (${before}곳)`);
  await ctx.close();
}

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
