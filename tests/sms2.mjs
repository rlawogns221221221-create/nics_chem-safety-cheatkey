/* ① 문자도구 — 도로 우회 개편 · 안내문구 삭제 · 진입화면 순서 */
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

// ══ 진입화면 순서 ══
{
  const P = await B.newPage({ viewport: { width: 1500, height: 900 } });
  P.on('pageerror', e => errs.push('PORTAL: ' + e.message));
  await P.goto(`${R}/index.html`); await P.waitForTimeout(600);
  /* 진입 화면을 KRDS 표준형으로 다시 만들면서 선택자가 바뀌었습니다
     (.panels .pn .pn-hit → .tools .pn > a). 검사하는 것은 그대로입니다 —
     순서가 '실제 업무 순서'인가. 상사 피드백으로 정한 것이라 바꾸면 안 됩니다. */
  const panels = await P.$$eval('.tools .pn', els => els.map(e => ({
    no: e.querySelector('.pn-no').textContent.trim(),
    title: e.querySelector('h2').textContent.trim(),
    href: e.querySelector('a').getAttribute('href')
  })));
  console.log('진입화면:', panels.map(p => `${p.no} ${p.title}`).join(' / '));
  chk(panels[0].href === 'map/index.html' && panels[0].no === '01', '01 = 대피장소 지도');
  chk(panels[1].href === 'sms/index.html' && panels[1].no === '02', '02 = 주민대피 문자 작성');
  chk(panels[2].href === 'res/index.html' && panels[2].no === '03', '03 = 방제자원 동원');
  // 링크가 실제로 열리는가
  await P.click('.tools .pn:nth-child(1) a'); await P.waitForTimeout(900);
  chk(P.url().includes('/map/'), '첫 카드를 누르면 지도가 열린다');
  await P.close();
}

// ══ 안내문구 ══
{
  const P = await B.newPage({ viewport: { width: 1500, height: 900 } });
  P.on('pageerror', e => errs.push('SMS: ' + e.message));
  await P.goto(`${R}/sms/index.html`); await P.waitForTimeout(700);
  chk(await P.isHidden('#noteWrap'), '고르기 전에는 안내 띠가 없다');
  const body = await P.textContent('body');
  chk(!/고르세요/.test(body) || !/지시받은 문자/.test(body), '"지시받은 문자를 고르세요" 문구 사라짐');

  // 구분을 고르면 안내가 나온다
  await P.click('#stages button >> nth=0');
  await P.waitForTimeout(700);
  chk(!(await P.isHidden('#noteWrap')), '구분을 고르면 안내 띠가 나온다');
  chk((await P.textContent('#noteBar')).length > 10, '그 구분의 설명이 들어 있다');
  await P.close();
}

// ══ 도로 우회 알림 — 사고지역 상황 두 갈래 ══
{
  const P = await B.newPage({ viewport: { width: 1500, height: 900 } });
  P.on('pageerror', e => errs.push('DETOUR: ' + e.message));
  await P.goto(`${R}/sms/index.html`); await P.waitForTimeout(700);

  await P.evaluate(() => {
    [...document.querySelectorAll('#stages button')]
      .find(x => /도로 우회/.test(x.textContent)).click();
  });
  await P.waitForTimeout(900);

  // 고르기 전 — 문안을 만들지 않고 할 일을 적는다
  chk(!(await P.isHidden('#catBar')), '사고지역 상황 고르는 줄이 나온다');
  const cats = await P.$$eval('#catBar .cat', e => e.map(x => x.textContent.trim()));
  chk(cats.length === 2, `상황이 두 갈래 (${cats.join(' / ')})`);
  chk(/실내대피 중일 때/.test(cats[0]), '첫째 = 실내대피 중일 때');
  chk(/대피명령 발령 중일 때/.test(cats[1]), '둘째 = 대피명령 발령 중일 때');
  chk((await P.$$('#out .out')).length === 0, '고르기 전에는 문안을 만들지 않는다');
  const ask = await P.textContent('#out');
  chk(/고르세요/.test(ask), '무엇을 하라고 적어 준다');
  chk(/실내대피 중일 때/.test(ask) && /대피명령 발령 중일 때/.test(ask),
    '고를 것을 이름까지 적어 준다 (고르는 줄에는 이름표가 없으므로)');
  chk(!/사고지역 상황/.test(await P.textContent('#catBar')),
    '고르는 줄에는 이름표를 두지 않는다 (단추 글씨가 이미 말한다)');
  chk(await P.$eval('#catBar', e => e.getAttribute('aria-label')) === '사고지역 상황',
    '화면낭독기용 이름은 aria-label 로 남는다');
  chk(await P.isDisabled('#btnTxt'), '고르기 전에는 기록 저장도 막는다');

  const shown = async () => P.$$eval('#out .out',
    os => os.filter(o => o.offsetParent !== null).map(o => o.querySelector('.no').textContent));
  const heads = async () => P.$$eval('#out .ohd',
    e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));

  // ── 실내대피 중일 때 ──
  await P.click('#catBar .cat >> nth=0'); await P.waitForTimeout(700);
  chk(JSON.stringify(await shown()) === JSON.stringify(['4번', '3번']),
    `실내대피: 발송 문안 4·3번만 (${(await shown()).join(',')})`);
  let hd = await heads();
  chk(hd.some(h => /발송 문안/.test(h)), '실내대피: 발송 문안 묶음이 있다');
  chk(hd.some(h => /상황종료 시 문안/.test(h)), '실내대피: 상황종료 시 문안 묶음이 따로 있다');
  await P.click('#out .ohd.fold'); await P.waitForTimeout(500);
  chk(JSON.stringify(await shown()) === JSON.stringify(['4번', '3번', '6번', '5번']),
    `실내대피: 종료 문안을 펴면 6·5번 (${(await shown()).join(',')})`);

  // ── 대피명령 발령 중일 때 ──
  await P.click('#catBar .cat >> nth=1'); await P.waitForTimeout(700);
  chk(JSON.stringify(await shown()) === JSON.stringify(['10번', '9번']),
    `대피명령: 발송 문안 10·9번만 (${(await shown()).join(',')})`);
  hd = await heads();
  chk(hd.some(h => /상황종료 시 문안/.test(h)), '대피명령: 상황종료 시 문안 묶음이 따로 있다');
  await P.click('#out .ohd.fold'); await P.waitForTimeout(500);
  chk(JSON.stringify(await shown()) === JSON.stringify(['10번', '9번', '12번', '11번']),
    `대피명령: 종료 문안을 펴면 12·11번 (${(await shown()).join(',')})`);

  // 예전 소제목은 없어야 한다
  const all = await P.textContent('#cols');
  chk(!/실내대피 중일 때/.test(await P.textContent('#out')), '문안 묶음 소제목에는 상황 이름이 없다');
  chk(/도로명·장소명/.test(all), '도로 우회에서는 사업장 칸이 도로명·장소명이다');

  // 다른 구분으로 갔다 오면 고른 상황이 남아 있는가
  await P.evaluate(() => {
    [...document.querySelectorAll('#stages button')]
      .find(x => /실내대피 알림/.test(x.textContent)).click();
  });
  await P.waitForTimeout(600);
  chk(await P.isHidden('#catBar'), '다른 구분에는 상황 고르는 줄이 없다');
  await P.evaluate(() => {
    [...document.querySelectorAll('#stages button')]
      .find(x => /도로 우회/.test(x.textContent)).click();
  });
  await P.waitForTimeout(700);
  // 앞에서 종료 문안을 펴 두었으므로 펼침 상태까지 그대로 살아 있어야 한다
  chk(JSON.stringify(await shown()) === JSON.stringify(['10번', '9번', '12번', '11번']),
    `돌아오면 고른 상황과 펼침 상태가 그대로 (${(await shown()).join(',')})`);
  chk(await P.$eval('#catBar .cat:nth-of-type(2)', e => e.getAttribute('aria-pressed')) === 'true',
    '고른 상황 단추가 눌린 채로 표시된다');

  await P.close();
}

console.log('\nPASS ' + ok.length + ' / FAIL ' + bad.length);
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
