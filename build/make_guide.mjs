/* 지자체 담당자용 설명서 만들기 (PDF 두 가지)
   ───────────────────────────────────────────────────────────────
       node build/make_guide.mjs

   ── 무엇을 하나 ────────────────────────────────────────────────
   ① 실제 화면을 몰아 놓고 **사진을 찍습니다**(docs/guide-img/).
      손으로 캡처하면 화면을 고칠 때마다 설명서 사진이 옛것이 됩니다.
      여기서 찍으면 언제든 다시 돌려 최신으로 맞출 수 있습니다.
   ② `docs/사용설명서.html`(10쪽)과 `docs/원페이퍼.html`(1쪽)을 각각
      **A4 인쇄용 PDF** 로 굽습니다.
      · 사용설명서 — 처음 접하는 사람이 앉아서 읽는 것
      · 원페이퍼   — 인쇄해 책상·상황실에 붙여 두고 급할 때 보는 것
      원페이퍼는 **한 쪽을 넘기면 멈춥니다.** 두 쪽이 되면 '한 장 요약'이
      아니고, 붙여 둘 수도 없기 때문입니다.

   ── 왜 PDF 인가 ────────────────────────────────────────────────
   지자체에 공문으로 붙이고, 인쇄해 상황실에 두고, 휴대전화로도 열어 봅니다.
   그 셋을 한 파일로 하는 것은 PDF 뿐입니다. 받는 사람이 실수로 고칠 수도
   없습니다(문안·수치가 들어 있어 그 편이 낫습니다).

   ── 배경지도가 없는 사진에 대하여 ──────────────────────────────
   이 개발 환경은 바깥 인터넷으로 못 나가서 **배경지도 타일을 못 받습니다.**
   그래서 지도 사진에는 행정경계선과 표시만 나옵니다. 실제 화면에는 도로·
   건물이 함께 보입니다 — 설명서에도 그렇게 적어 두었습니다. 없는 것을
   있는 것처럼 그려 넣지 않습니다. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

/* URL 생성자를 쓰지 않습니다 — 문자열만 잘라 씁니다(tests/tok.mjs 와 같은 이유) */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));
const IMG = `${RPATH}/docs/guide-img`;
mkdirSync(IMG, { recursive: true });

const PC = { width: 1280, height: 900 };
const 폰 = { width: 390, height: 780 };

const browser = await chromium.launch();

/* 이 환경은 배경지도 타일을 못 받아 "배경지도를 불러오지 못했습니다" 띠가
   뜹니다. 실제 배포 주소에서는 뜨지 않는 띠이므로, 설명서 사진에서는
   가립니다 — 없는 고장을 설명서에 실어 놓으면 읽는 사람이 자기 화면이
   잘못된 줄 압니다. (지도에 배경이 없는 것은 사진 설명에 적어 둡니다) */
const 띠가리기 = async (page) => {
  await page.evaluate(() => {
    const w = document.querySelector('#mWarn');
    if (w) w.hidden = true;
  });
  await page.waitForTimeout(150);
};

const 찍기 = async (page, 이름, sel) => {
  const t = sel ? await page.$(sel) : null;
  const buf = t ? await t.screenshot() : await page.screenshot();
  writeFileSync(`${IMG}/${이름}.png`, buf);
  console.log(`  docs/guide-img/${이름}.png  ${(buf.length / 1024).toFixed(0)} KB`);
};

/* ── 첫 화면 ─────────────────────────────────────────────────── */
{
  /* 이 두 장은 실사 사진이 들어 있어 그대로 두면 PDF 가 6MB 를 넘습니다.
     공문에 붙이는 파일이라 크기도 중요합니다 — 설명서에서 보이는 크기
     (A4 폭 182mm)에 필요한 만큼만 잡습니다. */
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 1.25 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}index.html`);
  await p.waitForTimeout(1500);
  await 찍기(p, '01-첫화면-pc', 'main .wrap');
  await ctx.close();

  const c2 = await browser.newContext({ viewport: 폰, deviceScaleFactor: 1.6,
    hasTouch: true, isMobile: true });
  const p2 = await c2.newPage();
  await p2.goto(`${ROOT}index.html`);
  await p2.waitForTimeout(1500);
  await 찍기(p2, '02-첫화면-폰');
  await c2.close();
}

/* ── ① 방제 물품·장비 찾기 ───────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}res/index.html`);
  await p.waitForTimeout(900);
  await 찍기(p, '10-방제-걸음1', '.rz');

  /* 두 갈래를 골라 걸음 2 로 — 사람이 하는 것과 같은 순서 */
  await p.click('.rz-need >> nth=0');
  await p.click('.rz-need >> nth=1');
  await p.waitForTimeout(200);
  await p.click('#rzNext');
  await p.waitForTimeout(400);
  await 찍기(p, '11-방제-걸음2', '.rz');

  /* 사고지점을 좌표로 넣어 결과 화면까지 — 주소검색은 인터넷이 필요해
     이 환경에서 못 씁니다. 화면 모양은 어느 길로 넣든 같습니다. */
  await p.click('#startSkip');
  await p.waitForTimeout(700);
  await p.fill('#acLat', '36.1195');
  await p.fill('#acLon', '128.1135');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1200);
  await 띠가리기(p);
  await 찍기(p, '12-방제-결과');
  await ctx.close();
}

/* ── ② 주민 대피장소 찾기 ────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}map/index.html`);
  await p.waitForTimeout(900);
  await 찍기(p, '20-대피장소-시작', '.mb-acc');

  await p.fill('#acLat', '36.1195');
  await p.fill('#acLon', '128.1135');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1400);
  await 띠가리기(p);
  await 찍기(p, '21-대피장소-결과');
  await ctx.close();
}

/* ── ③ 주민대피 문자생성기 ───────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}sms/index.html`);
  await p.waitForTimeout(900);
  await 찍기(p, '30-문자-발송구분');

  await p.click('#stages button[data-s=evac]');
  await p.waitForTimeout(500);
  await 찍기(p, '31-문자-걸음');

  /* 필수 칸을 채워야 문안이 만들어집니다(반쪽 문안은 아예 안 만듭니다) */
  await p.evaluate(o => {
    Object.keys(o).forEach(k => {
      const el = document.getElementById('if_' + k);
      if (el) { el.value = o[k]; el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }, { 기관: '서천군', 시각: '14:20', 시군: '서천군', 읍면동: '장항읍',
       사업장: '○○화학', 대상지역: '장항읍 일원', 물질: '염산',
       대피소: '장항중학교', 집결지: '장항읍 행정복지센터' });
  await p.waitForTimeout(400);
  const b = await p.$('#stepBar button[data-go=out]');
  if (b) { await b.click(); await p.waitForTimeout(700); }
  await 찍기(p, '32-문자-문안');
  await ctx.close();
}

/* ── 설명서를 PDF 로 굽기 ────────────────────────────────────── */
async function 굽기(원본, 낼이름, 여백) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${ROOT}docs/${원본}`);
  await p.waitForLoadState('load');
  await p.waitForTimeout(1200);
  const out = `${RPATH}/docs/${낼이름}`;
  await p.pdf({ path: out, format: 'A4', printBackground: true,
    margin: { top: 여백, bottom: 여백, left: 여백, right: 여백 } });
  await ctx.close();
  const size = readFileSync(out).length;
  console.log(`\ndocs/${낼이름}   ${(size / 1024).toFixed(0)} KB`);
  return out;
}

await 굽기('사용설명서.html', '화학사고_초동대응_지원_서비스_사용설명서.pdf', '14mm');
const 한장 = await 굽기('원페이퍼.html', '화학사고_초동대응_지원_서비스_한장요약.pdf', '10mm');

/* 원페이퍼가 한 쪽을 넘겼는지 셉니다 — PDF 안의 "/Type /Page" 개수.
   넘겼는데 모르고 나눠 주면 '한 장 요약'이 아니게 됩니다. */
{
  const buf = readFileSync(한장).toString('latin1');
  const 쪽 = (buf.match(/\/Type\s*\/Page[^s]/g) || []).length;
  if (쪽 > 1) {
    console.error(`\n⚠ 원페이퍼가 ${쪽}쪽이 되었습니다 — 내용을 줄이거나 `
      + `docs/원페이퍼.html 의 글자·여백을 줄이세요.`);
    process.exitCode = 1;
  } else {
    console.log('  원페이퍼 한 쪽 확인');
  }
}

await browser.close();
console.log('→ 사진을 다시 찍고 설명서를 다시 구웠습니다.');
