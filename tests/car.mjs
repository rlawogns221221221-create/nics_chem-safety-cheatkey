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
const errs=[],ok=[],bad=[]; const chk=(c,m)=>(c?ok:bad).push(m);
const P = await B.newPage({ viewport:{width:1500,height:900} });
P.on('pageerror',e=>errs.push(e.message));
await P.goto(ROOT + 'map/index.html'); await P.waitForTimeout(700);

// 규칙 확인
const r = await P.evaluate(()=>[200,400,401,1200,2900,3100,12000].map(m=>[m,MAPCORE.tripPair(m).label]));
console.log('거리별 표기:'); r.forEach(([m,l])=>console.log(`   ${String(m).padStart(6)}m → ${l}`));
chk(!/차로/.test(r[0][1]) && !/차로/.test(r[1][1]), '400m 이하는 도보만 (차로는 무의미)');
chk(/도보/.test(r[2][1]) && /차로/.test(r[2][1]), '400m 넘으면 도보·차로 둘 다');
chk(/도보/.test(r[4][1]) && /차로/.test(r[4][1]), '2.9km 도 둘 다');
chk(!/도보/.test(r[5][1]) && /차로/.test(r[5][1]), '3km 넘으면 차로만 (걸어서 못 감)');

await P.fill('#acLat','36.1400'); await P.fill('#acLon','128.1137');
await P.dispatchEvent('#acLat','input'); await P.waitForTimeout(1200);
const l6 = await P.$$eval('#shList .l6 em', e=>e.map(x=>x.textContent.trim()));
console.log('\n목록 예시:', l6.slice(0,6).join(' / '));
chk(l6.some(t=>/차로/.test(t)), '목록에 차량 시간이 나온다');
chk(l6.some(t=>/도보.*차로/.test(t)), '가까운 곳은 도보·차로 함께');
const near = await P.$$eval('#mNear .mnear-t em', e=>e.map(x=>x.textContent.trim()));
console.log('3곳 카드:', near.join(' / '));
chk((await P.textContent('#mSum')).includes('차로') || /도보/.test(await P.textContent('#mSum')), '요약 줄에도 표시');

console.log('\nPASS '+ok.length+' / FAIL '+bad.length);
bad.forEach(m=>console.log('  FAIL '+m));
if(errs.length) console.log('JS 오류: '+[...new Set(errs)].join(' / '));
await B.close(); process.exit(bad.length||errs.length?1:0);
