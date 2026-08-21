/* 색·크기 이름(CSS 변수)이 두 화면 모드에서 모두 값을 갖는가.
   ───────────────────────────────────────────────────────────────
   왜 이 검사가 필요한가 — CSS 는 `border:1px solid var(--없는이름)` 을
   만나면 오류를 내지 않고 그 줄을 **통째로 버립니다.** 그래서 이름 하나가
   빠지면 테두리가 아예 사라지거나 반투명 패널의 바탕이 없어지는데, 화면은
   멀쩡해 보여서 눈으로는 찾기 어렵습니다. 실제로 KRDS 로 다시 깔면서
   `--line-d`·`--glass`·`--route` 같은 이름을 고대비 모드에만 넣고 밝은
   모드에 안 넣어, 밝은 화면에서 입력칸 테두리가 통째로 사라졌습니다.

   그래서 스타일시트에서 쓰는 이름을 전부 긁어, 실제 브라우저에서 밝음·고대비
   두 모드로 값이 비어 있지 않은지 확인합니다. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
/* URL 생성자를 쓰지 않습니다 — 문자열만 잘라 씁니다(addr.mjs 와 같은 이유) */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/tests\/$/, '');
const RDIR = ROOT.replace(/\/$/, '');
const RPATH = decodeURIComponent(RDIR.replace(/^file:\/\//, ''));

const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);

/* 스타일시트가 var() 로 부르는 우리 이름들 — KRDS 원본 토큰(--krds-…)은
   그 파일 안에서 정의되므로 여기서 따로 보지 않습니다. */
function usedNames(cssFile) {
  const t = readFileSync(`${RPATH}/${cssFile}`, 'utf8');
  return [...new Set([...t.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map(m => m[1]))]
    .filter(n => !n.startsWith('--krds'));
}

/* 요소 하나에만 매달아 쓰는 이름 — 뿌리(:root)에 없는 것이 정상입니다.
   진입 화면의 도구 카드 색이 카드마다 다른 것이 그 예입니다. */
const SCOPED = ['--pn-c', '--pn-t'];

/* 화면마다 어느 스타일시트를 쓰는가 */
const PAGES = [
  ['sms/index.html', 'assets/shell.css', '① 문자 도구'],
  ['map/index.html', 'assets/shell.css', '② 대피장소 지도'],
  ['res/index.html', 'assets/shell.css', '③ 방제자원'],
  ['index.html', 'assets/portal.css', '진입 화면']
];
const MODES = [['light', '밝은 화면'], ['high-contrast', '고대비 화면']];

const B = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];

for (const [page, css, 이름] of PAGES) {
  const names = usedNames(css).filter(n => SCOPED.indexOf(n) < 0);
  chk(names.length > 10, `${이름} — 검사할 이름을 찾았다 (${names.length}개)`);
  for (const [mode, 모드이름] of MODES) {
    const P = await B.newPage();
    P.on('pageerror', e => errs.push(`${page}: ${e.message}`));
    await P.goto(`${RDIR}/${page}`);
    await P.waitForTimeout(400);
    await P.evaluate(m => document.documentElement.setAttribute('data-krds-mode', m), mode);
    const empty = await P.evaluate(ns => {
      const cs = getComputedStyle(document.documentElement);
      return ns.filter(n => !cs.getPropertyValue(n).trim());
    }, names);
    chk(empty.length === 0,
      `${이름} · ${모드이름} — 값이 빈 이름 ${empty.length}개` +
      (empty.length ? ` (${empty.join(' ')})` : ''));
    await P.close();
  }
}

/* 입력칸 테두리는 눈에 보여야 합니다 — 위 검사를 통과해도 실수로 0px 로
   두면 안 되므로, 실제로 그려진 두께를 재서 확인합니다. */
for (const [mode, 모드이름] of MODES) {
  const P = await B.newPage();
  await P.goto(`${RDIR}/sms/index.html`);
  await P.waitForTimeout(500);
  await P.evaluate(m => document.documentElement.setAttribute('data-krds-mode', m), mode);
  await P.evaluate(() => {
    const b = [...document.querySelectorAll('#stages button')]
      .find(x => /주민소산|대피명령/.test(x.textContent));
    if (b) b.click();
  });
  await P.waitForTimeout(700);
  await P.evaluate(() => {
    const b = document.querySelector('#stepBar button[data-go=info]');
    if (b) b.click();
  });
  await P.waitForTimeout(400);
  const bd = await P.evaluate(() => {
    const e = document.getElementById('if_기관');
    if (!e) return null;
    const s = getComputedStyle(e);
    return { w: parseFloat(s.borderTopWidth), style: s.borderTopStyle };
  });
  chk(bd && bd.w >= 1 && bd.style !== 'none',
    `${모드이름} — 입력칸에 테두리가 보인다 (${bd ? bd.w + 'px ' + bd.style : '칸을 못 찾음'})`);
  await P.close();
}

await B.close();
console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
process.exit(bad.length ? 1 : 0);
