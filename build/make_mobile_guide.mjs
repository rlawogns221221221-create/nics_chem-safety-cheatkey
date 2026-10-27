/* 휴대전화 사용설명서 — 사진 찍기 + PDF 굽기
   ───────────────────────────────────────────────────────────────
       node build/make_mobile_guide.mjs          사진 찍고 PDF 까지
       node build/make_mobile_guide.mjs --pdf    사진은 두고 PDF 만 다시

   원본 글은 docs/모바일_사용설명서.html, 사진은 docs/모바일설명서/*.png,
   결과는 docs/모바일_사용설명서.pdf 입니다.

   ── 왜 따로 만들었나 (2026-10-27 사용자) ─────────────────────────
   "이전 설명서는 별로 마음에 안 들었어. 사용 방법만 나오고 몇 개 도구 이런
   말은 없어야 하고, 기계는~ 이런 문구도 필요 없어. 오직 사용법만, 글은 최대한
   적게, 스크린샷으로 직관적으로. 걸음이라는 단어도 들어가지 않았으면 해."
   그래서 한 쪽에 휴대전화 화면 여섯 장까지, 사진마다 **누를 곳에 붉은 고리**
   하나와 **한 줄 설명**만 둡니다. 아래 검사가 그 약속을 기계로 지킵니다.
     · 원본 글과 **사진 속 글자**에 「걸음」이 있으면 멈춥니다.
     · 「도구는 …」 「판단」 「○개 도구 / 세 가지」 같은 말이 있으면 멈춥니다.
     · 쪽수가 다섯 장(QR 첫 장 + 사용법 넉 장)이 아니면 멈춥니다.

   ── 배경지도 ───────────────────────────────────────────────────
   개발 자리는 타일 서버로 못 나가 지도에 행정경계선만 찍힙니다(CLAUDE.md 6절).
   내는 판은 인터넷이 되는 액션 러너에서 굽습니다(.github/workflows/
   모바일설명서_굽기.yml). 여기서는 구성만 확인합니다.

   ── 고리는 실제 요소를 재어 그립니다 ────────────────────────────
   설명서 쪽에서 좌표로 얹으면 화면을 조금만 고쳐도 엉뚱한 곳을 가리킵니다
   (예전 설명서에서 겪은 일). 찍는 순간 그 요소의 자리를 재어 고리를 넣습니다. */
import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync, existsSync } from 'fs';

const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));
const IMG = `${RPATH}/docs/모바일설명서`;
const HTML = `${RPATH}/docs/모바일_사용설명서.html`;
const PDF = `${RPATH}/docs/모바일_사용설명서.pdf`;
mkdirSync(IMG, { recursive: true });

/* 아이폰 13 — 사파리 주소창을 뺀 높이(664)보다 조금 길게 잡아 한 장에 더 담습니다 */
const 폰 = { ...devices['iPhone 13'], viewport: { width: 390, height: 700 }, deviceScaleFactor: 2 };
const 금지말 = [/걸음/, /도구는/, /판단/, /[0-9세네]\s*(개|가지)\s*(의\s*)?도구/, /도구\s*[0-9세네]\s*(개|가지|종)/];
const 문제 = [];

const browser = await chromium.launch();

/* 이 환경에서만 뜨는 띠(배경지도 못 받음 · 예시값 ○○ 주의)를 가립니다 —
   실제로 쓰면 안 뜨는 것이라 남겨 두면 읽는 사람이 자기 화면이 잘못된 줄
   압니다. 스타일 한 줄로 막아야 화면이 다시 그려도 도로 안 켜집니다. */
const 띠가리기 = (p) => p.evaluate(() => {
  if (document.getElementById('__guideHide')) return;
  const s = document.createElement('style');
  s.id = '__guideHide';
  /* .mpk-busy — 검색 칸 아래 '인터넷 검색을 쓸 수 없습니다 …' 줄. 인터넷이 되는
     실제 주소에서는 안 뜹니다(러너는 브이월드 검색이 막혀 늘 뜹니다 — 6절). */
  s.textContent = '#mWarn,.mbar-warn,.alert.w,.shmap-warn,.mpk-busy{display:none!important}'
    + '*{caret-color:transparent!important}';
  document.head.appendChild(s);
});

/* 누를 곳에 붉은 고리 — 찍고 나면 지웁니다.
   선택자를 여럿 주면 **따로따로** 고리를 그립니다(하나로 묶으면 그 사이의
   다른 칸까지 큰 네모에 들어가 무엇을 누르라는지 흐려집니다). */
const 고리 = async (p, 선택자, 여백 = 6) => {
  let 다 = true;
  for (const s of [].concat(선택자)) 다 = (await 고리하나(p, s, 여백)) && 다;
  return 다;
};
const 고리하나 = (p, 선택자, 여백) => p.evaluate(([sel, pad]) => {
  const e = document.querySelector(sel);
  if (!e) return false;
  const q = e.getBoundingClientRect();
  let l = q.left, t = q.top, r = q.right, b = q.bottom;
  const d = document.createElement('div');
  d.className = '__ring';
  const W = innerWidth, H = innerHeight;
  l = Math.max(3, l - pad); t = Math.max(3, t - pad);
  r = Math.min(W - 3, r + pad); b = Math.min(H - 3, b + pad);
  Object.assign(d.style, { position: 'fixed', left: l + 'px', top: t + 'px',
    width: (r - l) + 'px', height: (b - t) + 'px', border: '3px solid #ff3b30',
    borderRadius: '12px', boxShadow: '0 0 0 5px rgba(255,59,48,.22)',
    pointerEvents: 'none', zIndex: 99999, boxSizing: 'border-box' });
  document.body.appendChild(d);
  return true;
}, [선택자, 여백]);

/* 화면에 실제로 보이는 글자 — 사진 속 「걸음」을 잡으려고 씁니다 */
const 보이는글 = (p) => p.evaluate(() => {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true }))) continue;
    /* 화면낭독기용으로 비켜 둔 글(1px 상자 · sr-only)은 화면에 안 보입니다 */
    let 숨음 = false;
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const z = a.getBoundingClientRect();
      if (z.width <= 2 || z.height <= 2) { 숨음 = true; break; }
    }
    if (숨음) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const q = rg.getBoundingClientRect();
    if (q.width < 3 || q.height < 3 || q.bottom < 0 || q.top > innerHeight || q.right < 0 || q.left > innerWidth) continue;
    out.push(t);
  }
  return out.join(' ');
});

const 찍기 = async (p, 이름, 고를곳) => {
  await 띠가리기(p);
  await p.waitForTimeout(250);
  if (고를곳 && !(await 고리(p, 고를곳))) 문제.push(`${이름}: 고리 자리(${고를곳})를 못 찾음`);
  const 글 = await 보이는글(p);
  금지말.forEach((re) => { if (re.test(글)) 문제.push(`${이름}: 사진 속에 「${글.match(re)[0]}」`); });
  await p.screenshot({ path: `${IMG}/${이름}.png` });
  await p.evaluate(() => document.querySelectorAll('.__ring').forEach((e) => e.remove()));
  console.log(`  ${이름}.png`);
};

/* 주소창 검색 → 첫 줄 고르기. 어림 좌표면 지도를 한 번 눌러 확정합니다
   (실제 화면이 그렇게 묻습니다 — 그 장면도 설명서에 실립니다). */
const 치기 = async (p, 칸, 말) => {
  await p.click(칸);
  await p.type(칸, 말, { delay: 40 });
  await p.waitForTimeout(1300);
};
const 지도누르기 = async (p) => {
  const b = await (await p.$('.mmap')).boundingBox();
  await p.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await p.waitForTimeout(1500);
};
const 맨위 = (p) => p.evaluate(() => scrollTo(0, 0));
const 붙이기 = (p, sel, 위 = 8) => p.evaluate(([s, y]) => {
  const e = document.querySelector(s);
  if (e) scrollTo(0, scrollY + e.getBoundingClientRect().top - y);
}, [sel, 위]);

if (!process.argv.includes('--pdf')) {
  /* ── 시작 — 첫 화면 ─────────────────────────────────────────── */
  {
    const ctx = await browser.newContext(폰);
    const p = await ctx.newPage();
    await p.goto(`${ROOT}index.html`);
    await p.waitForTimeout(2600);           // 카드가 올라오는 것을 기다림
    await 찍기(p, '00-첫화면', '#tools');           // 카드 세 장을 한 고리로
    await ctx.close();
  }

  /* ── 01 방제 물품·장비 찾기 ────────────────────────────────────
     여수시로 찾습니다 — 흡착포를 가진 곳이 70곳 넘게 나와 목록이 목록답게
     보입니다(김천은 한 곳뿐이라 '목록' 사진이 되지 않았습니다). */
  {
    const ctx = await browser.newContext(폰);
    const p = await ctx.newPage();
    await p.goto(`${ROOT}res/index.html`);
    await p.waitForTimeout(1100);
    await 찍기(p, '11-무엇을', '#rzBr');
    await p.click('.rz-br >> nth=1');                     // 방제물품 찾기
    await p.waitForTimeout(600);
    const 흡착 = p.locator('.rz-item', { hasText: '흡착포' }).first();
    await 흡착.click();
    await p.waitForTimeout(300);
    await 흡착.scrollIntoViewIfNeeded();
    await p.evaluate(() => { const e = [...document.querySelectorAll('.rz-item')].find((x) => /흡착포/.test(x.textContent)); e && e.setAttribute('data-guide', '1'); });
    await 찍기(p, '12-물품고르기', ['.rz-item[data-guide]', '#rzNext']);
    await p.click('#rzNext');
    await p.waitForTimeout(700);
    await 치기(p, '#startQ', '여수시');
    await 찍기(p, '13-사고지점', ['#startQ', '.mpk']);
    /* 산단 안의 주소를 고릅니다 — '전라남도 여수시'(시 전체)를 고르면 시 경계의
       가운데가 섬 사이 바다로 잡혀 가장 가까운 곳이 34km 밖으로 나왔습니다. */
    await p.locator('.mpk-row', { hasText: '삼동2길' }).first().click();
    await p.waitForTimeout(1000);
    if (await p.$('text=지도를 누르세요')) await 지도누르기(p);
    await 맨위(p); await p.waitForTimeout(600);
    await 찍기(p, '14-지도', '.list-hint.on');
    await 붙이기(p, '.mside .ms-hd');
    await p.waitForTimeout(600);
    /* 전화번호가 있는 줄을 고릅니다 — 세부 창의 주인공이 번호입니다.
       없는 번호를 지어 넣지 않으므로(2절) 있는 줄을 찾아 누릅니다. */
    const 줄들 = p.locator('#shList .ms-it');
    let 고른 = -1;
    const n = Math.min(await 줄들.count(), 12);
    for (let i = 0; i < n; i++) {
      if (/\d{2,4}-\d{3,4}-\d{4}/.test(await 줄들.nth(i).innerText())) { 고른 = i; break; }
    }
    if (고른 < 0) { 문제.push('방제: 전화번호가 있는 줄이 없음'); 고른 = 0; }
    await 붙이기(p, `#shList .ms-it:nth-child(${고른 + 1})`, 150);
    await p.waitForTimeout(300);
    await 찍기(p, '15-목록', `#shList .ms-it:nth-child(${고른 + 1})`);
    await 줄들.nth(고른).click();
    await p.waitForTimeout(1400);
    await p.evaluate(() => { const d = document.querySelector('#rkDet'); d && d.scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(500);
    await 찍기(p, '16-세부창', '.rkd-tel');
    await ctx.close();
  }

  /* ── 02 주민 대피장소 찾기 ─────────────────────────────────── */
  {
    const ctx = await browser.newContext(폰);
    const p = await ctx.newPage();
    await p.goto(`${ROOT}map/index.html`);
    await p.waitForTimeout(1100);
    await 치기(p, '#mAddrQ', '여수시 주삼동');
    await 찍기(p, '21-주소넣기', ['#mAddrQ', '#addrPop']);
    await p.locator('#addrPop .mpk-row').first().click();
    await p.waitForTimeout(1300);
    await 찍기(p, '22-지도누르기', '.mmap');
    await 지도누르기(p);
    await 맨위(p); await p.waitForTimeout(600);
    await 찍기(p, '23-결과', '.msum');
    await 붙이기(p, '#mLayers');
    await p.waitForTimeout(500);
    await 찍기(p, '24-층고르기', '#mLayers');
    await p.locator('#shList .ms-it').first().click();
    await p.waitForTimeout(1200);
    await 붙이기(p, '#shList .ms-it.on', 110);
    await p.waitForTimeout(400);
    await 찍기(p, '25-길찾기', '#shList .ms-it.on .shmap-ext');
    await 붙이기(p, '#btnToSms', 120);
    await p.waitForTimeout(400);
    await 찍기(p, '26-문자로', '#btnToSms');
    await ctx.close();
  }

  /* ── 03 주민대피 문자생성기 ──────────────────────────────────
     사업장 이름은 ○○화학 입니다 — 실제 회사 이름을 재난문자 예시에 넣지
     않습니다. ○○ 때문에 뜨는 '예시값' 주의 띠는 위 띠가리기가 가립니다. */
  {
    const ctx = await browser.newContext(폰);
    const p = await ctx.newPage();
    await p.goto(`${ROOT}sms/index.html`);
    await p.evaluate(() => sessionStorage.clear());
    await p.goto(`${ROOT}sms/index.html`);
    await p.waitForTimeout(1000);
    await 찍기(p, '31-알림고르기', '#stages button[data-s=evac]');
    await p.click('#stages button[data-s=evac]');
    await p.waitForTimeout(800);
    const 넣기 = (o) => p.evaluate((v) => {
      Object.keys(v).forEach((k) => { const el = document.getElementById('if_' + k);
        if (el) { el.value = v[k]; el.dispatchEvent(new Event('input', { bubbles: true })); } });
    }, o);
    const 가기 = async (말) => {
      await p.$$eval('.stepbar .stp-i button', (bs, m) => {
        const b = bs.find((x) => x.textContent.includes(m)); b && b.click(); }, 말);
      await p.waitForTimeout(700);
    };
    /* 빈 칸 알림 — 일부만 채우고 문안 확인으로 건너뜁니다 */
    await 넣기({ 기관: '여수시', 시각: '14:20' });
    await 가기('사고 발생 위치');
    await 넣기({ 시군: '여수시', 읍면동: '주삼동', 사업장: '○○화학' });
    await p.waitForTimeout(300);
    await 맨위(p);
    await 찍기(p, '32-칸채우기', '#stepNav .sn-next');
    await 가기('사고물질');
    await p.click('#if_물질');
    await p.type('#if_물질', '염산', { delay: 60 });
    await p.waitForTimeout(900);
    await 찍기(p, '33-물질', ['#if_물질', '.mpk']);
    await p.keyboard.press('Escape');
    await p.evaluate(() => { const m = document.querySelector('.mpk'); if (m) m.style.display = 'none'; document.activeElement && document.activeElement.blur(); });
    await p.$$eval('.stepbar .stp-i button', (bs) => bs[bs.length - 1].click());
    await p.waitForTimeout(900);
    await 맨위(p);
    await 찍기(p, '34-빈칸', '.nf-list');
    await 넣기({ 대상지역: '주삼동 일원', 물질: '염산' });
    await 가기('대피장소');
    await p.click('#btnMap');
    await p.waitForTimeout(1800);
    /* 한 곳을 골라 두고 찍습니다 — 아래 '○○ 넣기' 단추가 켜진 모습이 쓰는 법입니다 */
    await p.evaluate(() => { const it = document.querySelector('.shmap-list .shmap-it'); it && it.click(); });
    await p.waitForTimeout(700);
    await 찍기(p, '35-대피장소', ['.shmap-mapwrap', '.shmap-ok']);
    const 넣음 = await p.$('.shmap-ok:not([disabled])');
    if (넣음) { await 넣음.click(); await p.waitForTimeout(700); }
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    await 넣기({ 집결지: '' });
    await p.$$eval('.stepbar .stp-i button', (bs) => bs[bs.length - 1].click());
    await p.waitForTimeout(1200);
    await 맨위(p);
    await 찍기(p, '36-복사', '#out button[data-c]');
    await ctx.close();
  }
}

/* ── PDF ─────────────────────────────────────────────────────── */
{
  const 원본 = readFileSync(HTML, 'utf8');
  const 본문 = 원본.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ');
  금지말.forEach((re) => { const m = 본문.match(re); if (m) 문제.push(`설명서 글에 「${m[0]}」`); });
  [...원본.matchAll(/src="((?:모바일설명서|QR)\/[^"]+)"/g)].forEach((m) => {
    if (!existsSync(`${RPATH}/docs/${m[1]}`)) 문제.push(`그림이 없음: ${m[1]}`);
  });
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  const p = await ctx.newPage();
  await p.goto('file://' + HTML);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.pdf({ path: PDF, format: 'A4', printBackground: true, preferCSSPageSize: true });
  /* 쪽마다 넘치지 않았는지 — A4 높이(297mm)를 넘는 쪽이 있으면 다음 쪽으로 밀립니다 */
  const 넘침 = await p.$$eval('.page', (ps) => ps.map((e, i) => [i + 1, Math.round(e.scrollHeight / 3.7795)])
    .filter(([, mm]) => mm > 297));
  넘침.forEach(([i, mm]) => 문제.push(`${i}쪽이 ${mm}mm — A4(297mm)를 넘습니다`));
  const 쪽 = (readFileSync(PDF, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`\n  docs/모바일_사용설명서.pdf  ${쪽}쪽`);
  if (쪽 !== 5) 문제.push(`쪽수가 ${쪽} — 다섯 장(QR 첫 장 + 사용법 넉 장)이어야 합니다`);
  await ctx.close();
}
await browser.close();

if (문제.length) {
  console.error('\n⚠ 고칠 것');
  문제.forEach((m) => console.error('  · ' + m));
  process.exitCode = 1;
}
