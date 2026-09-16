/* 성과요약서 이미지(참고 2)용 **깨끗한** 화면 사진 찍기
   ───────────────────────────────────────────────────────────────
       node build/make_shots.mjs            (개발 자리 — 배경지도 없음)
       Actions → "성과 이미지 굽기"          (러너 — 배경지도까지 나옴)

   ── 왜 설명서 사진을 그대로 쓰지 않나 ──────────────────────────
   `docs/guide-img/` 의 사진에는 **붉은 번호 딱지(①②③)가 박혀** 있습니다.
   설명서에서는 그 번호를 옆 글이 풀어 주지만, 성과요약서 이미지 양식에는
   "이미지별 설명을 간략히" 만 적으므로 번호만 남으면 무엇을 가리키는지
   알 수 없습니다. 그래서 딱지 없는 사진을 따로 찍습니다.

   ── 배경지도 ───────────────────────────────────────────────────
   개발 자리는 타일 서버로 못 나가 지도에 **행정경계선만** 찍힙니다
   (CLAUDE.md 6절). 주최 측이 성과사례집·카드뉴스에 쓴다고 했으므로,
   실제로 내는 사진은 **인터넷이 되는 액션 러너**에서 굽습니다.
   여기서는 화면 구성만 확인하는 용도입니다.
   ⚠ 자막·안내를 손으로 그려 넣지 않습니다 — 없는 것을 있는 것처럼
     보이게 하면 안 됩니다(2절). 찍힌 그대로 냅니다. */
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, statSync } from 'fs';

/* URL 생성자를 쓰지 않습니다 — 문자열만 잘라 씁니다(tests/tok.mjs 와 같은 이유) */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));
const OUT = `${RPATH}/docs/성과이미지`;
mkdirSync(OUT, { recursive: true });

const PC = { width: 1440, height: 900 };
const 폰 = { width: 390, height: 780 };

/* 영상과 같은 사고지점을 씁니다 — 세 도구가 같은 상황을 보여 주어야
   심사위원이 화면을 이어서 읽습니다(2026-09-14 사용자 지시로 통일). */
const 사업장 = 'SK하이닉스';

const browser = await chromium.launch();

/* 이 환경에서만 뜨는 띠(배경지도 못 받음)는 가립니다 — 실제 주소에서는
   뜨지 않는 것이라 남겨 두면 읽는 사람이 고장으로 봅니다. */
const 띠가리기 = async (p) => {
  await p.evaluate(() => {
    const w = document.querySelector('#mWarn');
    if (w) w.hidden = true;
    document.querySelectorAll('.alert.w').forEach((e) => { e.style.display = 'none'; });
  });
  await p.waitForTimeout(150);
};

const 찍기 = async (p, 이름, 자를곳) => {
  await p.screenshot({ path: `${OUT}/${이름}.png`, clip: 자를곳 || undefined });
  console.log(`  ${이름}.png`);
};

/* 사고지점을 이름으로 넣습니다. ②③ 모두 자기 자료 안에서 찾습니다 —
   ② 는 data/places.js, ③ 은 data/resources2.js 입니다. */
const 이름으로찍기 = async (p, 칸, 이름) => {
  await p.click(칸);
  await p.type(칸, 이름, { delay: 30 });
  await p.waitForTimeout(1200);
  const 줄 = p.locator('.mpk-row').first();
  if (!(await 줄.count())) { console.error('  ⚠ 검색 결과 없음: ' + 이름); return false; }
  await 줄.click();
  await p.waitForTimeout(900);
  /* 어림 좌표는 자동 확정하지 않습니다 — 지도를 한 번 눌러 확정합니다 */
  if (await p.$('text=지도를 누르세요')) {
    const m = await p.$('.mmap');
    const b = await m.boundingBox();
    await p.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.46);
    await p.waitForTimeout(1200);
  }
  return true;
};

/* ── ① 대표이미지 — 진입 화면(도구 세 가지가 한눈에) ───────────── */
{
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}index.html`);
  await p.waitForTimeout(2200);          // 머리띠 사진·카드가 올라오는 것을 기다림
  await 찍기(p, '01-대표-진입화면');
  await ctx.close();
}

/* ── ② 주민 대피장소 찾기 — 결과 화면 ──────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}map/index.html`);
  await p.waitForTimeout(1200);
  await 이름으로찍기(p, '#mAddrQ', 사업장);
  await p.waitForTimeout(1500);
  await 띠가리기(p);
  await 찍기(p, '02-대피장소-결과');
  await ctx.close();
}

/* ── ③ 방제 물품·장비 찾기 — 세부사항 창(전화번호가 가장 큼) ─────
   ⚠ **전화번호가 있는 줄**을 골라야 합니다. 이 창의 주인공이 번호인데,
     원자료에 번호가 없는 자리(환경청 장비함 등)를 고르면 그 자리에
     "번호 확인 필요" 만 보입니다 — 기능을 보여 주는 사진이 못 됩니다.
     없는 번호를 지어 넣지는 않으므로(2절 3항), 있는 줄을 찾아 누릅니다. */
{
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}res/index.html`);
  await p.waitForTimeout(1000);
  /* 물품 갈래로 갑니다 — 영상과 같은 사고지점(SK하이닉스)을 **이름으로**
     넣으려면 그 갈래여야 합니다. ③ 의 도구 안 검색은 **고른 갈래 안에서만**
     찾는데, SK하이닉스는 물품 보유처라 업체 갈래에는 없습니다. */
  await p.click('.rz-br >> nth=1');                 // 방제물품 찾기
  await p.waitForTimeout(700);
  /* 업체 갈래는 `.rz-need`(허가 7갈래), 물품 갈래는 `.rz-item`(이름 27가지)
     입니다 — 걸음 2가 갈래마다 다르므로 선택자도 다릅니다. */
  await p.click('.rz-item >> nth=5');
  await p.click('#rzNext');
  await p.waitForTimeout(900);
  await 이름으로찍기(p, '#startQ', 사업장);
  await p.waitForTimeout(1200);
  /* 관내에 몇 곳 없으면 범위를 넓힙니다 — 화면에 원래 있는 기능이고,
     번호가 있는 보유처가 나올 자리를 만듭니다. */
  const 넓히기 = await p.$('text=범위 넓히기');
  if (넓히기) { await 넓히기.click(); await p.waitForTimeout(1500); }
  const 줄수 = await p.locator('#shList .ms-it').count();
  let 찾음 = false;
  for (let i = 0; i < Math.min(줄수, 8); i++) {
    await p.locator('#shList .ms-it').nth(i).click();
    await p.waitForTimeout(1100);
    const tel = await p.$eval('.rkd-tel', (e) => e.textContent.trim()).catch(() => '');
    if (/\d{2,4}-\d{3,4}-\d{4}/.test(tel)) { 찾음 = true; break; }
    const 닫 = await p.$('.rkd-close');
    if (닫) { await 닫.click(); await p.waitForTimeout(400); }
  }
  if (!찾음) console.error('  ⚠ 전화번호가 있는 줄을 못 찾았습니다 — 사진을 확인하세요');
  /* ⚠ 띠 가리기는 **찍기 바로 앞**에서 합니다. 배경지도가 브이월드 → OSM 으로
     바뀌는 띠는 타일을 받아 본 **뒤에** 뜨는데, 먼저 가려 두면 그 사이에 다시
     나타납니다(러너 사진에 노란 띠가 그대로 찍혔습니다). */
  await 띠가리기(p);
  await 찍기(p, '03-방제-세부창');
  await ctx.close();
}

/* ── ④ 주민대피 문자생성기 — 만들어진 표준문안 ─────────────────── */
{
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}sms/index.html`);
  await p.waitForTimeout(900);
  await p.click('#stages button[data-s=indoor]');
  await p.waitForTimeout(500);
  await p.click('#types button[data-t="누출"]');
  /* 실제 회사 이름이 재난문자 예시에 들어갑니다 — 이 사진을 쓸 때는
     설명에 **가상 상황**임을 반드시 적습니다(영상 자막과 같은 이유). */
  await p.evaluate((o) => {
    Object.keys(o).forEach((k) => {
      const el = document.getElementById('if_' + k);
      if (el) { el.value = o[k]; el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }, { 기관: '청주시', 시각: '14:20', 시군: '청주시', 읍면동: '흥덕구',
       사업장: 'SK하이닉스㈜ 청주', 대상지역: '흥덕구 일원', 물질: '염화수소/염산' });
  await p.waitForTimeout(500);
  await p.keyboard.press('Escape');
  await p.evaluate(() => {
    const m = document.querySelector('.mpk');
    if (m) { m.hidden = true; m.style.display = 'none'; }
  });
  const 가기 = await p.$('#stepBar button[data-go=out]');
  if (가기) { await 가기.click(); await p.waitForTimeout(1400); }
  await 띠가리기(p);
  await 찍기(p, '04-문자-문안');
  await ctx.close();
}

/* ── ⑤ 휴대전화 — 현장에서 쓰는 화면 ───────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: 폰, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}index.html`);
  await p.waitForTimeout(2200);
  await 찍기(p, '05-휴대전화-진입화면');
  await ctx.close();
}

await browser.close();

const 목록 = readdirSync(OUT).filter((f) => f.endsWith('.png')).sort();
console.log(`\ndocs/성과이미지/  ${목록.length}장`);
목록.forEach((f) => {
  const kb = statSync(`${OUT}/${f}`).size / 1024;
  console.log(`  ${f}  ${kb.toFixed(0)} KB`);
});
if (목록.length < 5) {
  console.error('\n⚠ 사진이 모자랍니다 — 위 경고를 보세요.');
  process.exitCode = 1;
}
