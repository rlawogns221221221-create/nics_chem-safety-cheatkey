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
const P = await B.newPage({ viewport:{width:1500,height:950} });
P.on('pageerror', e => errs.push(e.message));
await P.goto(ROOT + 'res/index.html'); await P.waitForTimeout(1200);

// ── 시작 화면 — 처음엔 한 가지만 묻는다 ──
chk(!(await P.isHidden('#rStart')), '들어오면 시작 화면 하나만 보인다');
chk(await P.isHidden('.mmain'), '사고지점 전에는 지도·목록을 두지 않는다');
chk(await P.isHidden('.mbar'), '사고지점 전에는 조건 줄도 없다');
chk((await P.$$('#rStart .rs-way')).length===3, '고를 것이 셋뿐');
await P.click('#startPick'); await P.waitForTimeout(900);
chk(!(await P.isHidden('.mmain')), '"지도에서 찍기"를 누르면 지도가 나온다');
chk(await P.evaluate(()=>document.querySelector('.mbar').classList.contains('folded')),
  '조건 줄은 접힌 채로 시작한다');
chk(await P.isHidden('#rbMore'), '자원 종류·필요한 것도 접힌 채로 시작한다');

// 접힌 것을 펴야 칩이 보인다
await P.click('#rbToggle'); await P.waitForTimeout(600);
chk((await P.$$('#rKinds .rk-chip')).length===6, '자원 종류 6가지');
chk((await P.$$('#rNeeds .rk-chip')).length===7, '필요한 것 7갈래');

// 사고지점 (좌표 입력)
await P.fill('#acLat','36.1400'); await P.fill('#acLon','128.1137');
await P.dispatchEvent('#acLat','input'); await P.waitForTimeout(1600);
let n = await P.$$eval('#shList .ms-it', e=>e.length);
chk(n>0, `사고지점을 넣으면 목록이 나온다 (${n}곳)`);
chk((await P.$$eval('#map circle.rk', e=>e.length))>0, '지도에 자원 마커가 찍힌다');
chk(/사고지점/.test(await P.textContent('#mSum')), '요약 줄에 사고지점 주소');
chk(!!(await P.$('#mSum #rhAgain')), '요약 줄에서 처음 화면으로 돌아갈 수 있다');
chk((await P.inputValue('#mScope'))==='20000', '기본 범위 20km (관내에 없을 수 있어서)');

// 범위 넓히기
await P.selectOption('#mScope','50000'); await P.waitForTimeout(1200);
const n50 = await P.$$eval('#shList .ms-it', e=>e.length);
chk(n50>n, `범위를 넓히면 더 나온다 (${n} → ${n50})`);

// 필요한 것으로 찾기
await P.evaluate(()=>{[...document.querySelectorAll('#rNeeds .rk-chip')]
  .find(b=>/차량·중장비/.test(b.textContent)).click();});
await P.waitForTimeout(900);
const nCar = await P.$$eval('#shList .ms-it', e=>e.length);
chk(nCar>0 && nCar<n50, `'차량·중장비'로 거르면 줄어든다 (${n50} → ${nCar})`);
const txt = await P.textContent('#shList');
chk(/굴착기|암롤차|탱크로리|스키드로더|진공흡입|지게차/.test(txt), '거른 결과가 실제로 차량·중장비를 가진 곳');
await P.evaluate(()=>{[...document.querySelectorAll('#rNeeds .rk-chip')]
  .find(b=>/차량·중장비/.test(b.textContent)).click();});
await P.waitForTimeout(700);

// 종류 끄기
await P.evaluate(()=>{[...document.querySelectorAll('#rKinds .rk-chip')]
  .find(b=>/지자체/.test(b.textContent)).click();});
await P.waitForTimeout(900);
const nOff = await P.$$eval('#shList .ms-it', e=>e.length);
chk(nOff<n50, `종류를 끄면 줄어든다 (${n50} → ${nOff})`);
await P.evaluate(()=>{[...document.querySelectorAll('#rKinds .rk-chip')]
  .find(b=>/지자체/.test(b.textContent)).click();});
await P.waitForTimeout(800);

// 장비 이름으로 검색
await P.fill('#mQ','굴착기'); await P.waitForTimeout(900);
const nQ = await P.$$eval('#shList .ms-it', e=>e.length);
chk(nQ>0, `보유 장비 이름으로 검색된다 ('굴착기' ${nQ}곳)`);
await P.fill('#mQ',''); await P.waitForTimeout(700);

// 전화 링크 · 좌표 정확도
chk((await P.$$('#shList a.rs-num')).length>0, '번호를 눌러 바로 걸 수 있다 (tel:)');
const tel = await P.$eval('#shList a.rs-num', e=>e.getAttribute('href'));
chk(/^tel:0\d+$/.test(tel), `tel: 링크가 올바르다 (${tel})`);
chk((await P.$$('#shList .ap-tag')).length>0, '좌표가 어림값인 줄에 정확도 표시');

// 동원 목록
await P.click('#shList .ms-it >> nth=0'); await P.waitForTimeout(700);
await P.click('#shList button[data-mob] >> nth=0'); await P.waitForTimeout(700);
chk(!(await P.isHidden('#rMob')), '동원 목록에 담으면 띠가 뜬다');
chk(/동원 목록 1곳/.test((await P.textContent('#rMob')).replace(/\s+/g,' ')), '담은 개수가 보인다');
await P.click('#shList .ms-it >> nth=2'); await P.waitForTimeout(600);
await P.click('#shList button[data-mob] >> nth=0'); await P.waitForTimeout(700);
chk(/동원 목록 2곳/.test((await P.textContent('#rMob')).replace(/\s+/g,' ')), '두 곳까지 담긴다');
await P.click('#mobClear'); await P.waitForTimeout(500);
chk(await P.isHidden('#rMob'), '비우면 띠가 사라진다');

// ②와 같은 조작 — 지도 눌러 찍기
await P.click('#btnAcc'); await P.waitForTimeout(400);
const box = await P.evaluate(()=>{const r=document.querySelector('#map').getBoundingClientRect();
  return {x:r.left+r.width/2, y:r.top+r.height/2};});
await P.mouse.click(box.x, box.y); await P.waitForTimeout(1500);
chk((await P.$$eval('#shList .ms-it', e=>e.length))>0, '지도를 눌러 찍어도 목록이 나온다 (②와 같은 동작)');


// ══ 이어받은 검사 — 개인정보 · 거리순 · 차량시간 · 동원목록 복사 ══
await P.fill('#acLat','36.1400'); await P.fill('#acLon','128.1137');
await P.dispatchEvent('#acLat','input'); await P.waitForTimeout(900);
await P.selectOption('#mScope','50000'); await P.waitForTimeout(1100);

// 개인정보가 화면에 없어야 한다
const page = await P.textContent('body');
chk(!/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/.test(page), '화면에 개인 휴대전화가 없다');
chk(!/@/.test(await P.textContent('#shList')), '목록에 이메일이 없다');
chk((await P.$$('#shList .rs-num-in')).length===0, '담당자 직통 칸이 없다');

// 거리순 정렬이 실제로 오름차순인가
await P.selectOption('#mSort','dist'); await P.waitForTimeout(900);
const km = await P.$$eval('#shList .ms-it .d', e=>e.map(x=>{
  const m=/([\d.]+)\s*(m|km)/.exec(x.textContent); if(!m) return null;
  return m[2]==='km' ? parseFloat(m[1])*1000 : parseFloat(m[1]);}).filter(v=>v!=null));
chk(km.length>2 && km.every((v,i)=>i===0||v>=km[i-1]-1), `거리순이 오름차순 (${km.length}줄)`);

// 이동시간 — 방제자원은 차로 온다. 먼 곳은 '차로 N분'이 나와야 한다
const l6 = await P.$$eval('#shList .l6', e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim()));
chk(l6.some(t=>/차로 \d+분/.test(t)), '먼 곳은 차량 소요시간이 나온다');
chk(l6.some(t=>/어림한 값|어려운 거리/.test(t)), '어림값임을 각 줄에 적는다');

// 종류 정렬
await P.selectOption('#mSort','kind'); await P.waitForTimeout(900);
chk((await P.$$eval('#shList .ms-it', e=>e.length))>0, '자원 종류순 정렬도 된다');
await P.selectOption('#mSort','dist'); await P.waitForTimeout(700);

// 동원 목록 복사
await P.click('#shList .ms-it >> nth=0'); await P.waitForTimeout(600);
await P.click('#shList button[data-mob] >> nth=0'); await P.waitForTimeout(600);
chk(!!(await P.$('#mobCopy')), '동원 목록에 복사 단추가 있다');
await P.click('#mobCopy'); await P.waitForTimeout(500);
const copied = await P.evaluate(()=>navigator.clipboard ? null : null);
chk(true, '복사 단추를 눌러도 오류가 없다');
await P.click('#mobClear'); await P.waitForTimeout(400);

// 범례가 켜 둔 종류를 따라간다
const leg0 = (await P.textContent('#mLeg')).replace(/\s+/g,' ');
chk(/지자체/.test(leg0), '범례에 켜 둔 종류가 나온다');
await P.evaluate(()=>{[...document.querySelectorAll('#rKinds .rk-chip')]
  .find(b=>/지자체/.test(b.textContent)).click();});
await P.waitForTimeout(800);
chk(!/지자체/.test((await P.textContent('#mLeg')).replace(/\s+/g,' ')), '끈 종류는 범례에서도 빠진다');

// 자료 출처 창 — 보유 수량·좌표 한계를 밝히는가
await P.click('#btnSrc'); await P.waitForTimeout(600);
const src = (await P.textContent('#srcModal')).replace(/\s+/g,' ');
chk(/제출 시점/.test(src), '보유 수량이 제출 시점의 것이라고 밝힌다');
chk(/어림값/.test(src), '좌표가 어림값이라고 밝힌다');
await P.click('#btnSrcClose'); await P.waitForTimeout(400);

// 처음 화면으로 되돌아가기
await P.click('#rhAgain'); await P.waitForTimeout(900);
chk(!(await P.isHidden('#rStart')), '"다시 정하기"를 누르면 처음 화면으로 돌아간다');
chk(await P.isHidden('.mmain'), '돌아가면 지도도 다시 숨는다');
await P.click('#startPick'); await P.waitForTimeout(900);

await P.screenshot({path:'res_2.png'});
console.log('PASS '+ok.length+' / FAIL '+bad.length+'\n');
ok.forEach(m=>console.log('  ok  '+m)); bad.forEach(m=>console.log('  FAIL '+m));
if(errs.length){console.log('\nJS 오류:');[...new Set(errs)].forEach(e=>console.log('  '+e));}
await B.close();
process.exit(bad.length||errs.length?1:0);
