import { chromium, devices } from 'playwright';
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
const ok=[],bad=[]; const chk=(c,m)=>(c?ok:bad).push(m); const errs=[];
const ctx = await B.newContext({ ...devices['iPhone 13'] });
const P = await ctx.newPage();
P.on('pageerror', e => errs.push(e.message));
await P.goto(ROOT + 'map/index.html'); await P.waitForTimeout(700);
// 강원 산간 — 가장 가까운 대피장소가 6.1km 밖이라 기본 5km 안에는 아무것도 없다
await P.fill('#acLat','37.45'); await P.fill('#acLon','128.80');
await P.dispatchEvent('#acLat','input'); await P.waitForTimeout(1000);
chk((await P.$$('#mSum .ms-more')).length===1, '대피장소가 없으면 범위 넓히기 단추가 나온다');
chk(/10km/.test(await P.textContent('#mSum .ms-more')), '지금(5km)보다 한 칸 넓은 범위를 권한다');
const btn = await P.$('#mSum .ms-more');
const r = await btn.boundingBox();
chk(r.height>=32, `단추가 손가락으로 누를 만함 (${Math.round(r.width)}×${Math.round(r.height)})`);
const vp = await P.evaluate(()=>({w:innerWidth,h:innerHeight}));
chk(r.y + r.height < vp.h, `단추가 첫 화면 안에 있다 (y=${Math.round(r.y)} / 화면 ${vp.h})`);
chk(r.x + r.width <= vp.w + 1, `단추가 가로로도 다 보인다 (x=${Math.round(r.x)}~${Math.round(r.x+r.width)} / 폭 ${vp.w})`);
await btn.click(); await P.waitForTimeout(1300);
chk((await P.inputValue('#mScope'))==='10000', '찾는 범위가 10km로 맞춰진다');
// 10km 에도 없으면 20km 를 다시 권한다 — 막다른 안내로 끝나지 않아야 한다
let n = await P.$$eval('#shList .ms-it', e=>e.length);
if (!n) {
  const b2 = await P.$('#mSum .ms-more');
  chk(!!b2, '10km 에도 없으면 20km 로 넓히는 단추가 다시 나온다');
  if (b2) { await b2.click(); await P.waitForTimeout(1300); }
  n = await P.$$eval('#shList .ms-it', e=>e.length);
  chk((await P.inputValue('#mScope'))==='20000', '찾는 범위가 20km로 맞춰진다');
}
chk(n>0, `넓히면 대피장소가 나온다 (${n}곳)`);
// 휴대전화에서는 '가까운 3곳'이 접힌 채로 뜨고, 눌러야 펴진다 (지도를 가리지 않게)
chk((await P.$$('#mNear .mnear-h')).length===1, '가까운 3곳 머리표가 뜬다');
chk(await P.$eval('#mNear', e=>e.classList.contains('folded')), '좁은 화면에서는 접힌 채로 시작한다');
await P.click('#mNear .mnear-h'); await P.waitForTimeout(400);
chk((await P.$$('#mNear .mnear-it')).length>0, '누르면 가까운 3곳이 펴진다');
// ── 20km 에도 없는 곳: 막다른 안내를 정직하게 적는가 ──
{
  const Q = await ctx.newPage();
  Q.on('pageerror', e => errs.push(e.message));
  await Q.goto(ROOT + 'map/index.html'); await Q.waitForTimeout(700);
  await Q.fill('#acLat','37.90'); await Q.fill('#acLon','128.30');   // 가장 가까운 곳이 21km 밖
  await Q.dispatchEvent('#acLat','input'); await Q.waitForTimeout(1000);
  for (let i = 0; i < 3; i++) {
    const b = await Q.$('#mSum .ms-more');
    if (!b) break;
    await b.click(); await Q.waitForTimeout(1200);
  }
  chk((await Q.inputValue('#mScope'))==='20000', '없으면 20km 까지 계속 넓힐 수 있다');
  chk(/가장 넓은 범위/.test(await Q.textContent('#mSum')),
    '20km 에도 없으면 더 넓힐 곳이 없다고 알린다 (헛단추 없음)');
  chk((await Q.$$('#mSum .ms-more')).length===0, '더 넓힐 수 없을 땐 단추도 없다');
  await Q.close();
}

console.log('PASS '+ok.length+' / FAIL '+bad.length+'\n');
ok.forEach(m=>console.log('  ok  '+m)); bad.forEach(m=>console.log('  FAIL '+m));
if(errs.length) console.log('\nJS 오류: '+[...new Set(errs)].join(' / '));
await B.close();
process.exit(bad.length||errs.length?1:0);
